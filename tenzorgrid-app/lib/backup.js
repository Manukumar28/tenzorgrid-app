// Off-box backup of the whole SQLite database.
//
// Everything a learner has — their tasks, their scores, every message and stand-up —
// lives in one file on one Railway volume. A volume is not a backup: delete the service,
// lose the disk, mis-restore a deploy, and it is all gone with no second copy anywhere.
// This takes a consistent snapshot, gzips it, and puts it in Supabase Storage, which is a
// different provider on different hardware.
//
// Two things make a backup real rather than decorative, and both are tested:
//   - It is taken with VACUUM INTO, not by copying the file. Copying a live SQLite
//     database while writes are in flight gives you a file that may not open, because
//     the copy can straddle a transaction. VACUUM INTO takes a read transaction and
//     writes a fresh, defragmented database that is consistent as at that instant.
//   - It is checked by being restored. The test gunzips the result, opens it, runs
//     PRAGMA integrity_check and looks for a canary row. A backup nobody has restored is
//     a guess.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const { db } = require('./db.js');
const sb = require('./supabase.js');

const BUCKET = 'db_backups';

// Roughly a fortnight of dailies. Enough to notice and recover from corruption that was
// not spotted the same day, without paying to keep the database forever.
const KEEP = 14;

let lastRun = null;

// A consistent snapshot of the live database, gzipped.
//
// VACUUM INTO needs a path that does not yet exist, so the temp name is random and the
// file is removed in a finally — a half-gigabyte stray .db left in tmpdir on a small
// container is its own outage.
function snapshot() {
  const tmp = path.join(os.tmpdir(), `tg-backup-${crypto.randomBytes(8).toString('hex')}.db`);
  try {
    db.exec(`VACUUM INTO '${tmp.replace(/'/g, "''")}'`);
    return zlib.gzipSync(fs.readFileSync(tmp), { level: 6 });
  } finally {
    try { fs.unlinkSync(tmp); } catch { /* never let cleanup mask the real error */ }
  }
}

// Sorts lexicographically into time order, which is what makes retention a simple slice.
function keyFor(now = new Date()) {
  return `tenzorgrid-${now.toISOString().replace(/[:.]/g, '-')}.db.gz`;
}

async function prune() {
  const listed = await sb.storageList(BUCKET);
  const names = (Array.isArray(listed) ? listed : [])
    .map((o) => o && o.name)
    .filter((n) => typeof n === 'string' && n.endsWith('.db.gz'))
    .sort();
  if (names.length <= KEEP) return 0;
  const doomed = names.slice(0, names.length - KEEP);
  await sb.storageRemove(BUCKET, doomed);
  return doomed.length;
}

// Never throws. A backup that takes the app down when the far end is unreachable is a
// worse outage than the one it was insuring against, so every failure is recorded and
// returned for the health check to surface.
async function runBackup() {
  const startedAt = new Date();
  try {
    const gz = snapshot();
    const key = keyFor(startedAt);
    await sb.storageUpload(BUCKET, key, gz, 'application/gzip');
    let pruned = 0;
    try {
      pruned = await prune();
    } catch (e) {
      // Retention failing does not make the backup that just landed any less valid.
      lastRun = { ok: true, key, bytes: gz.length, at: startedAt.toISOString(), pruneError: e.message };
      return lastRun;
    }
    lastRun = { ok: true, key, bytes: gz.length, pruned, at: startedAt.toISOString() };
    return lastRun;
  } catch (e) {
    lastRun = { ok: false, error: e.message, at: startedAt.toISOString() };
    return lastRun;
  }
}

function getLastRun() {
  return lastRun;
}

module.exports = { BUCKET, KEEP, snapshot, runBackup, getLastRun, keyFor };
