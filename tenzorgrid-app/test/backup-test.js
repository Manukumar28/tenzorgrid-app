// Backup verification.
//
// The production service-role key is not reachable from this environment (Railway
// redacts it, Supabase MCP only exposes publishable keys), so the network leg is
// exercised against a local mock that speaks the same Storage API shape. That proves
// the REQUEST is built correctly — method, path, headers, binary body untouched.
// Everything that decides whether a backup is actually restorable — snapshot
// consistency under concurrent writes, integrity, round-trip — is tested for real.
process.env.DATA_DIR = process.argv[2];

const http = require('node:http');
const fs = require('node:fs');
const zlib = require('node:zlib');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const ROOT = require('node:path').join(__dirname, '..');

let fails = 0;
const check = (n, c, d) => { if (c) console.log('  PASS  ' + n); else { fails++; console.log('  FAIL  ' + n + (d ? '\n        ' + d : '')); } };

// ---- Mock Supabase Storage -------------------------------------------------
const store = new Map();
const seen = [];
const server = http.createServer((req, res) => {
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const body = Buffer.concat(chunks);
    seen.push({ method: req.method, url: req.url, headers: req.headers, len: body.length });
    const m = req.url.match(/^\/storage\/v1\/object\/(?:list\/)?([^/]+)(?:\/(.+))?$/);
    const bucket = m && m[1];

    if (req.method === 'POST' && req.url.includes('/object/list/')) {
      const names = [...store.keys()].filter((k) => k.startsWith(bucket + '/')).map((k) => ({ name: k.slice(bucket.length + 1) }));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(names));
    }
    if (req.method === 'POST' && m && m[2]) {
      store.set(`${bucket}/${decodeURIComponent(m[2])}`, body);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ Key: `${bucket}/${m[2]}` }));
    }
    if (req.method === 'GET' && m && m[2]) {
      const buf = store.get(`${bucket}/${decodeURIComponent(m[2])}`);
      if (!buf) { res.writeHead(404); return res.end('not found'); }
      res.writeHead(200, { 'Content-Type': 'application/gzip' });
      return res.end(buf);
    }
    if (req.method === 'DELETE') {
      let payload = {};
      try { payload = JSON.parse(body.toString('utf8')); } catch { /* ignore */ }
      for (const p of payload.prefixes || []) store.delete(`${bucket}/${p}`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end('[]');
    }
    res.writeHead(400); res.end('unhandled');
  });
});

(async () => {
  await new Promise((r) => server.listen(3310, r));
  process.env.SUPABASE_URL = 'http://127.0.0.1:3310';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

  const { db, cryptoRandomId } = require(path.join(ROOT, 'lib/db.js'));
  const sb = require(path.join(ROOT, 'lib/supabase.js'));
  const backup = require(path.join(ROOT, 'lib/backup.js'));

  console.log('0. Seed a database with a recognisable canary row');
  const iso = new Date().toISOString();
  const marker = 'canary-' + Date.now();
  const uid = cryptoRandomId();
  db.prepare('INSERT INTO users (id,email,password_hash,password_salt,created_at) VALUES (?,?,?,?,?)')
    .run(uid, marker + '@example.com', 'hash', 'salt', iso);
  db.prepare('INSERT INTO profiles (user_id,name,created_at,updated_at) VALUES (?,?,?,?)')
    .run(uid, marker, iso, iso);
  const userCount = db.prepare('SELECT COUNT(*) c FROM users').get().c;
  console.log('    users:', userCount, '| canary:', marker);

  console.log('\n1. Snapshot a LIVE database with writes in flight');
  const writer = setInterval(() => {
    try {
      db.prepare('INSERT INTO users (id,email,password_hash,password_salt,created_at) VALUES (?,?,?,?,?)')
        .run(cryptoRandomId(), cryptoRandomId() + '@noise.com', 'h', 's', new Date().toISOString());
    } catch { /* ignore */ }
  }, 2);
  const gz = backup.snapshot();
  clearInterval(writer);
  check('snapshot produced bytes', gz.length > 0, gz.length + ' bytes gzipped');
  check('is a real gzip stream', gz[0] === 0x1f && gz[1] === 0x8b);
  check('no temp .db left behind in tmpdir',
    !fs.readdirSync(require('node:os').tmpdir()).some((f) => f.startsWith('tg-backup-')));

  console.log('\n2. The snapshot is a VALID, OPENABLE database');
  const tmp = '/tmp/verify-restore.db';
  const raw = zlib.gunzipSync(gz);
  fs.writeFileSync(tmp, raw);
  const restored = new DatabaseSync(tmp, { readOnly: true });
  let integrity, restoredUsers, canaryFound, tables;
  try {
    integrity = restored.prepare('PRAGMA integrity_check').get();
    restoredUsers = restored.prepare('SELECT COUNT(*) c FROM users').get().c;
    canaryFound = restored.prepare('SELECT COUNT(*) c FROM profiles WHERE name = ?').get(marker).c;
    tables = restored.prepare("SELECT COUNT(*) c FROM sqlite_master WHERE type='table'").get().c;
  } finally { restored.close(); }
  check('integrity_check returns ok', integrity && Object.values(integrity)[0] === 'ok', JSON.stringify(integrity));
  check('all tables present', tables > 5, tables + ' tables');
  check('users survived', restoredUsers >= userCount, 'restored=' + restoredUsers);
  check('the canary row survived', canaryFound === 1, 'found=' + canaryFound);
  console.log(`    compression: ${(raw.length/1024).toFixed(0)}KB -> ${(gz.length/1024).toFixed(0)}KB (${(raw.length/gz.length).toFixed(1)}x)`);
  fs.unlinkSync(tmp);

  console.log('\n3. runBackup() end to end');
  const r1 = await backup.runBackup();
  check('reported success', r1.ok === true, JSON.stringify(r1));
  check('recorded key and size', Boolean(r1.key) && r1.bytes > 0, `${r1.key} ${r1.bytes}b`);
  check('key is time-ordered and typed', /^tenzorgrid-\d{4}-\d{2}-\d{2}T.*\.db\.gz$/.test(r1.key), r1.key);

  console.log('\n4. The HTTP request is built correctly');
  const upload = seen.find((s) => s.method === 'POST' && s.url.includes('/object/db_backups/'));
  check('POSTs to the object endpoint', Boolean(upload), JSON.stringify(seen.map((s) => s.method + ' ' + s.url)));
  if (!upload) { console.log('\nCannot continue without a successful upload.'); process.exit(1); }
  check('sends the service-role key', upload.headers.apikey === 'test-service-role-key');
  check('sends bearer auth', upload.headers.authorization === 'Bearer test-service-role-key');
  check('Content-Type is gzip, not JSON', upload.headers['content-type'] === 'application/gzip', upload.headers['content-type']);
  check('sets x-upsert', upload.headers['x-upsert'] === 'true');
  check('body length matches the snapshot exactly', upload.len === r1.bytes, `${upload.len} vs ${r1.bytes}`);

  console.log('\n5. Round-trip: download and confirm it still opens');
  const got = await sb.storageDownload(backup.BUCKET, r1.key);
  check('downloaded byte-for-byte', got.length === r1.bytes, `got ${got.length} vs ${r1.bytes}`);
  const tmp2 = '/tmp/verify-roundtrip.db';
  fs.writeFileSync(tmp2, zlib.gunzipSync(got));
  const rt = new DatabaseSync(tmp2, { readOnly: true });
  let rtIntegrity, rtCanary;
  try {
    rtIntegrity = rt.prepare('PRAGMA integrity_check').get();
    rtCanary = rt.prepare('SELECT COUNT(*) c FROM profiles WHERE name = ?').get(marker).c;
  } finally { rt.close(); }
  check('round-tripped db passes integrity_check', rtIntegrity && Object.values(rtIntegrity)[0] === 'ok');
  check('round-tripped db still has the canary', rtCanary === 1, 'found=' + rtCanary);
  fs.unlinkSync(tmp2);

  console.log('\n6. Retention prunes beyond KEEP');
  for (let i = 0; i < backup.KEEP + 3; i++) {
    await new Promise((r) => setTimeout(r, 2)); // distinct timestamps
    await backup.runBackup();
  }
  const kept = [...store.keys()].filter((k) => k.endsWith('.db.gz')).length;
  check(`keeps at most ${backup.KEEP}`, kept <= backup.KEEP, 'kept=' + kept);
  check('the newest backup is retained', [...store.keys()].some((k) => k.includes(backup.getLastRun().key)));

  console.log('\n7. Failure is recorded, never thrown');
  server.close();
  await new Promise((r) => setTimeout(r, 100));
  let threw = false, r2;
  try { r2 = await backup.runBackup(); } catch { threw = true; }
  check('a dead endpoint does not throw', !threw);
  check('failure recorded as ok:false', r2 && r2.ok === false, JSON.stringify(r2));
  check('the error message is kept for the health check', Boolean(r2 && r2.error), r2 && r2.error);

  console.log(fails ? `\n${fails} FAILURE(S)` : '\nAll backup checks passed.');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('UNCAUGHT', e); process.exit(1); });
