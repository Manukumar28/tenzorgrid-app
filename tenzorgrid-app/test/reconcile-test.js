// Reproduces the reported bug: an account that started Pay Equity Audit BEFORE the
// Python task was added to it, and is therefore stuck forever.
process.env.DATA_DIR = process.argv[2];
const path = require('node:path');
const ROOT = require('node:path').join(__dirname, '..');
const aiPath = require.resolve(path.join(ROOT, 'lib/ai.js'));
require.cache[aiPath] = { id: aiPath, filename: aiPath, loaded: true, exports: {
  isAvailable: () => false, callClaude: async () => null, extractJson: () => null } };

const { db, cryptoRandomId } = require(path.join(ROOT, 'lib/db.js'));
const ws = require(path.join(ROOT, 'lib/workspace.js'));
const answers = require('./answers.js');
// Finishing a project means finishing whatever tasks it has today — see answers.js.
const finishAll = (uid, only) => answers.finishOpenTasks(ws, db, uid, only);
// A project no longer completes when its tasks do — it needs the activities, the
// situations and the quiz too. Anything that wants to reach the NEXT project has to clear
// all four, which is what this does.
const finishProject = (uid) => answers.finishWholeProject(ws, db, uid);

// Projects now mix task types — a chart task is submitted as choices, not SQL. This
// signs off whatever a project's remaining tasks happen to be.
const CHART_ANSWERS = {
  'da-006': '{"type":"bar","x":"department","y":"avg_salary","sort":"desc","baselineZero":true}',
  'da-007': '{"type":"line","x":"hire_year","y":"headcount","sort":"none"}',
};
async function signOffChart(uid, taskKey) {
  const e = ws.getEnrollment(uid);
  const row = db.prepare('SELECT id FROM sim_tasks WHERE enrollment_id=? AND task_key=?').get(e.id, taskKey);
  if (!row) return;
  db.prepare("UPDATE sim_tasks SET opens_at = NULL WHERE id = ?").run(row.id);
  await ws.submitTask(uid, row.id, CHART_ANSWERS[taskKey]);
  await ws.answerReview(uid, row.id,
    'Bars compare a value across categories and sorting puts the answer first for the reader.');
}

// The skills check now precedes the first project, so every learner in these tests takes
// it the way a real one would.
const _st = require(path.join(ROOT, 'lib/skilltest.js'));
const passSkillTest = (uid) => ws.submitSkillTest(uid, Object.fromEntries(_st.QUESTIONS.map((q) => [q.id, q.answer])));


// Submitting no longer completes a task — Asha's sign-off does.
async function submitAndSignOff(uid, taskId, code, result) {
  await ws.submitTask(uid, taskId, code, result);
  return ws.answerReview(uid, taskId,
    'I filtered that way because including the wrong rows would skew the number away from what the business actually asked about.');
}

let fails = 0;
const check = (n, c, d) => { if (c) console.log('  PASS  ' + n); else { fails++; console.log('  FAIL  ' + n + (d ? '\n        ' + d : '')); } };

const REF = {
  'da-001': 'SELECT d.name AS department, AVG(e.salary) AS avg_salary FROM employees e JOIN departments d ON d.id = e.department_id WHERE e.exit_year IS NULL GROUP BY d.name ORDER BY avg_salary DESC',
  'da-002': 'SELECT hire_year, COUNT(*) AS headcount, AVG(salary) AS avg_salary FROM employees GROUP BY hire_year ORDER BY hire_year',
  'hc-120': 'SELECT role, MIN(salary) AS min_salary, MAX(salary) AS max_salary, AVG(salary) AS avg_salary, MAX(salary) - MIN(salary) AS spread FROM employees WHERE exit_year IS NULL GROUP BY role ORDER BY spread DESC',
};

(async () => {
  const uid = cryptoRandomId(), iso = new Date().toISOString();
  db.prepare('INSERT INTO users (id,email,password_hash,password_salt,created_at) VALUES (?,?,?,?,?)').run(uid,'stuck@e.com','x','y',iso);
  db.prepare('INSERT INTO profiles (user_id,name,created_at,updated_at) VALUES (?,?,?,?)').run(uid,'Manukumar R',iso,iso);
  const enr = ws.startEnrollment(uid, { level:'junior', scheduleType:'weekday', scheduleDays:null });
  passSkillTest(uid);

  const idOf = (k) => (db.prepare('SELECT id FROM sim_tasks WHERE enrollment_id=? AND task_key=?').get(enr.id, k) || {}).id;

  console.log('0. Grade two tasks so the second project is running');
  await finishProject(uid);
  ws.startProject(uid, 'headcount-trends');

  console.log('\n1. Recreate the stranded state — delete hc-121 as if it never existed');
  db.prepare("DELETE FROM sim_tasks WHERE enrollment_id=? AND task_key='hc-121'").run(enr.id);
  db.prepare("DELETE FROM sim_messages WHERE enrollment_id=? AND task_id IS NOT NULL AND task_id NOT IN (SELECT id FROM sim_tasks)").run(enr.id);
  const before = db.prepare('SELECT task_key FROM sim_tasks WHERE enrollment_id=?').all(enr.id).map((r) => r.task_key);
  check('account has hc-120 but NOT hc-121 (the reported state)',
    before.includes('hc-120') && !before.includes('hc-121'), JSON.stringify(before));

  console.log('\n2. Reading state repairs it automatically');
  const st = ws.getState(uid);
  const after = st.tasks.map((t) => t.task_key);
  check('hc-121 is now assigned', after.includes('hc-121'), JSON.stringify(after));
  check('nothing else was duplicated', after.length === new Set(after).size, JSON.stringify(after));
  const pe = st.projects.projects.find((p) => p.key === 'headcount-trends');
  check('Pay Equity Audit is active, not stuck', pe.status === 'active', pe.status);
  check('it shows a real next task', Boolean(pe.phase), String(pe.phase));
  console.log('    next up:', pe.phase);

  const msg = db.prepare("SELECT body FROM sim_messages WHERE enrollment_id=? AND body LIKE '%added%' ORDER BY created_at DESC LIMIT 1").get(enr.id);
  check('Asha explains where the new task came from', Boolean(msg), msg && msg.body.slice(0, 90));

  console.log('\n3. The project can now actually be COMPLETED');
  // The repair is proven above. All this needs is to get the project finished, which the
  // shared helper does properly — including closing each day, since days no longer roll
  // over on their own.
  await finishProject(uid);

  const st2 = ws.getState(uid);
  const pe2 = st2.projects.projects.find((p) => p.key === 'headcount-trends');
  check('the repaired project now reads COMPLETED', pe2.status === 'completed', pe2.status);
  check('progress is 100%', pe2.progressPct === 100, String(pe2.progressPct));

  console.log('\n4. The repair did not cost them the ladder');
  // Both authored junior projects are delivered, so the promotion bar is met and the
  // senior board is what comes next. The bar counts projects that are finished being
  // WRITTEN, so it moves as content lands rather than demanding projects that do not
  // exist yet.
  const keys4 = st2.projects.projects.map((p) => p.key);
  check('the senior board is now what is on offer', keys4.includes('reliability-review'), JSON.stringify(keys4));
  check('and the repaired project is still counted as delivered',
    st2.projects.projects.find((p) => p.key === 'headcount-trends').status === 'completed');

  console.log('\n5. Reconciliation must NOT start projects the learner never touched');
  const uid2 = cryptoRandomId();
  db.prepare('INSERT INTO users (id,email,password_hash,password_salt,created_at) VALUES (?,?,?,?,?)').run(uid2,'fresh@e.com','x','y',iso);
  db.prepare('INSERT INTO profiles (user_id,name,created_at,updated_at) VALUES (?,?,?,?)').run(uid2,'Fresh User',iso,iso);
  ws.startEnrollment(uid2, { level:'junior', scheduleType:'weekday', scheduleDays:null });
  passSkillTest(uid2);
  const fresh = ws.getState(uid2);
  const keys = fresh.tasks.map((t) => t.task_key).sort();
  // A new account gets its first PROJECT's tasks — which now includes a day-2 chart task,
  // assigned but not yet open. What must not happen is tasks from projects they have
  // never started.
  check('a new account has its first project\'s tasks and nothing else',
    keys.every((k) => k.startsWith('da-')) && keys.includes('da-001') && keys.includes('da-100'),
    JSON.stringify(keys));
  check('and nothing from a project they never started',
    !keys.some((k) => ['da-002', 'hc-120', 'da-004', 'hc-121', 'da-007'].includes(k)), JSON.stringify(keys));
  const statuses = fresh.projects.projects.map((p) => p.key + '=' + p.status);
  check('untouched projects were not silently started',
    fresh.projects.projects.filter((p) => p.status === 'active').length === 1, JSON.stringify(statuses));

  console.log('\n6. Running it repeatedly changes nothing (idempotent)');
  const n1 = ws.getState(uid).tasks.length;
  ws.getState(uid); ws.getState(uid);
  const n2 = ws.getState(uid).tasks.length;
  check('task count is stable across repeated reads', n1 === n2, `${n1} -> ${n2}`);

  console.log(fails ? `\n${fails} FAILURE(S)` : '\nAll reconciliation checks passed.');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
