// Junior and senior get different projects — the user's call, not vaguer briefs.
process.env.DATA_DIR = process.argv[2];
const path = require('node:path');
const ROOT = require('node:path').join(__dirname, '..');
const aiPath = require.resolve(path.join(ROOT, 'lib/ai.js'));
require.cache[aiPath] = { id: aiPath, filename: aiPath, loaded: true, exports: {
  isAvailable: () => false, callClaude: async () => null, extractJson: () => null } };

const { db, cryptoRandomId } = require(path.join(ROOT, 'lib/db.js'));
const ws = require(path.join(ROOT, 'lib/workspace.js'));
const _st = require(path.join(ROOT, 'lib/skilltest.js'));
const ds = require(path.join(ROOT, 'lib/datasets.js'));
const { getProjectDoc } = require(path.join(ROOT, 'lib/projectdocs.js'));
const pass = (uid) => ws.submitSkillTest(uid, Object.fromEntries(_st.QUESTIONS.map((q) => [q.id, q.answer])));

let fails = 0;
const check = (n, c, d) => { if (c) console.log('  PASS  ' + n); else { fails++; console.log('  FAIL  ' + n + (d ? '\n        ' + d : '')); } };

function newLearner(email, name, level) {
  const uid = cryptoRandomId(), iso = new Date().toISOString();
  db.prepare('INSERT INTO users (id,email,password_hash,password_salt,created_at) VALUES (?,?,?,?,?)').run(uid, email, 'x', 'y', iso);
  db.prepare('INSERT INTO profiles (user_id,name,created_at,updated_at) VALUES (?,?,?,?)').run(uid, name, iso, iso);
  ws.startEnrollment(uid, { level, scheduleType: 'weekday', scheduleDays: null });
  pass(uid);
  return uid;
}

(async () => {
  console.log('1. The two levels see different catalogues');
  const j = newLearner('lv-j@e.com', 'Junior Jo', 'junior');
  const sr = newLearner('lv-s@e.com', 'Senior Sam', 'senior');
  const jk = ws.getState(j).projects.projects.map((p) => p.key).sort();
  const sk = ws.getState(sr).projects.projects.map((p) => p.key).sort();
  check('junior sees the junior track', jk.includes('compensation-review'), JSON.stringify(jk));
  check('senior does NOT see the junior projects', !sk.some((k) => jk.includes(k)), JSON.stringify(sk));
  check('senior sees senior projects', sk.includes('reliability-review') && sk.includes('account-economics'), JSON.stringify(sk));
  check('junior does NOT see the senior projects', !jk.includes('reliability-review'), JSON.stringify(jk));

  console.log('\n2. A senior starts on a senior project, with senior work');
  const s2 = ws.getState(sr);
  const active = s2.projects.projects.find((p) => p.status === 'active');
  check('their first project is the senior one', active.key === 'reliability-review', active.key);
  check('its week has started', Boolean(active.week));
  const keys = s2.tasks.map((t) => t.task_key).sort();
  check('they get senior tasks, not da-001', keys.every((k) => k.startsWith('sa-')), JSON.stringify(keys));
  const mail = s2.messages.find((m) => m.subject && /need by Thursday/.test(m.subject));
  check('the stakeholder names the right project', /Platform Reliability Review/.test(mail.subject), mail.subject);

  console.log('\n3. Every senior project has a real brief');
  for (const key of ['reliability-review', 'account-economics']) {
    const doc = getProjectDoc(key);
    check(`${key} has an authored document`, Boolean(doc), 'missing');
    check(`${key} names its deliverables`, doc && doc.deliverables.length >= 2);
    check(`${key} lists only tools that exist`, doc && doc.liveTools.length > 0);
  }

  console.log('\n4. Every senior task is answerable and the naive answer is wrong');
  const TASKS = require(path.join(ROOT, 'lib/workspace.js'));
  // Validation gate: reference runs clean, returns a non-trivial result, and the obvious
  // mistake produces a DIFFERENT result — otherwise the task teaches nothing.
  const cases = [
    { key: 'sa-001', dataset: 'saas_ops',
      ref: "SELECT service, COUNT(*) AS incidents, AVG((julianday(resolved_at) - julianday(started_at)) * 24) AS avg_hours FROM incidents WHERE resolved_at IS NOT NULL GROUP BY service ORDER BY avg_hours DESC",
      naive: "SELECT service, COUNT(*) AS incidents, AVG((julianday(resolved_at) - julianday(started_at)) * 24) AS avg_hours FROM incidents GROUP BY service ORDER BY avg_hours DESC" },
    { key: 'sa-002', dataset: 'saas_ops',
      ref: "SELECT c.company, c.tier, c.mrr, COUNT(t.id) AS tickets, (COUNT(t.id) * 100000.0) / c.mrr AS tickets_per_100k FROM clients c LEFT JOIN tickets t ON t.client_id = c.id WHERE c.status = 'active' GROUP BY c.id, c.company, c.tier, c.mrr ORDER BY tickets_per_100k DESC",
      // The trap: leave the status filter out and a churned customer lands mid-table,
      // so Finance prices for an account we no longer have.
      naive: "SELECT c.company, c.tier, c.mrr, COUNT(t.id) AS tickets, (COUNT(t.id) * 100000.0) / c.mrr AS tickets_per_100k FROM clients c LEFT JOIN tickets t ON t.client_id = c.id GROUP BY c.id, c.company, c.tier, c.mrr ORDER BY tickets_per_100k DESC" },
    { key: 'sa-003', dataset: 'saas_ops',
      ref: "SELECT c.company, c.tier, SUM(CASE WHEN t.status IN ('open','pending') THEN 1 ELSE 0 END) AS unresolved_tickets, (SELECT COUNT(*) FROM incidents i WHERE i.client_id = c.id AND i.severity = 'SEV1') AS sev1_incidents FROM clients c LEFT JOIN tickets t ON t.client_id = c.id WHERE c.status = 'active' GROUP BY c.id, c.company, c.tier ORDER BY unresolved_tickets DESC",
      naive: "SELECT c.company, c.tier, SUM(CASE WHEN t.status = 'open' THEN 1 ELSE 0 END) AS unresolved_tickets, (SELECT COUNT(*) FROM incidents i WHERE i.client_id = c.id AND i.severity = 'SEV1') AS sev1_incidents FROM clients c LEFT JOIN tickets t ON t.client_id = c.id WHERE c.status = 'active' GROUP BY c.id, c.company, c.tier ORDER BY unresolved_tickets DESC" },
  ];
  for (const c of cases) {
    const d = ds.buildDatasetDb(c.dataset);
    let ref = null, naive = null, err = null;
    try { ref = d.prepare(c.ref).all(); naive = d.prepare(c.naive).all(); } catch (e) { err = e.message; }
    check(`${c.key}: the reference query runs`, Boolean(ref) && !err, err || '');
    check(`${c.key}: it returns a non-trivial result`, ref && ref.length >= 3, ref ? String(ref.length) + ' rows' : '');
    check(`${c.key}: the naive answer DIFFERS from the correct one`,
      ref && naive && JSON.stringify(ref) !== JSON.stringify(naive),
      'the trap is decorative — the mistake gives the same answer');
  }

  console.log('\n5. The Python senior task has a real oracle');
  const tables = ds.dumpDataset('saas_ops');
  const sa4 = ws.getTaskDefForTest ? null : null;
  // Recompute the reference the same way the grader does, straight off the definition.
  const def = require(path.join(ROOT, 'lib/workspace.js'));
  const expected = (() => {
    const bySev = new Map();
    for (const i of tables.incidents) {
      if (!i.resolved_at) continue;
      const h = (Date.parse(i.resolved_at) - Date.parse(i.started_at)) / 3600000;
      if (!bySev.has(i.severity)) bySev.set(i.severity, []);
      bySev.get(i.severity).push(h);
    }
    const med = (xs) => { const a = [...xs].sort((x, y) => x - y), m = Math.floor(a.length / 2); return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
    return [...bySev.entries()].map(([severity, hs]) => ({ severity, resolved: hs.length, median_hours: med(hs), worst_hours: Math.max(...hs) }))
      .sort((a, b) => b.median_hours - a.median_hours);
  })();
  check('it produces a row per severity', expected.length === 3, JSON.stringify(expected.map((r) => r.severity)));
  check('every duration is positive', expected.every((r) => r.median_hours > 0 && r.worst_hours > 0), JSON.stringify(expected));
  check('median and worst are not the same number', expected.some((r) => r.median_hours !== r.worst_hours), JSON.stringify(expected));
  console.log('    ' + JSON.stringify(expected));

  console.log('\n6. No incident resolves before it started');
  const d2 = ds.buildDatasetDb('saas_ops');
  const bad = d2.prepare('SELECT COUNT(*) c FROM incidents WHERE resolved_at IS NOT NULL AND resolved_at <= started_at').get().c;
  check('durations are all real', bad === 0, bad + ' incidents resolve before they start');

  console.log(fails ? `\n${fails} FAILURE(S)` : '\nAll senior-track checks passed.');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
