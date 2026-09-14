process.env.DATA_DIR = process.argv[2];
const path = require('node:path');
const ROOT = require('node:path').join(__dirname, '..');
const aiPath = require.resolve(path.join(ROOT, 'lib/ai.js'));
require.cache[aiPath] = { id: aiPath, filename: aiPath, loaded: true, exports: {
  isAvailable: () => false, callClaude: async () => null, extractJson: () => null } };

const { db, cryptoRandomId } = require(path.join(ROOT, 'lib/db.js'));

// The gate: submitting no longer completes a task — Asha must sign it off first.
// A reasoned answer is accepted by the offline judge (>=12 words containing a reason).
async function submitAndSignOff(ws, uid, taskId, code, result) {
  await ws.submitTask(uid, taskId, code, result);
  const r = await ws.answerReview(uid, taskId,
    'I filtered that way because including the wrong rows would skew the number away from what the business actually asked about.');
  return r;
}

const ws = require(path.join(ROOT, 'lib/workspace.js'));
const _st = require(path.join(ROOT, 'lib/skilltest.js'));
const passSkillTest = (uid) => ws.submitSkillTest(uid, Object.fromEntries(_st.QUESTIONS.map((q) => [q.id, q.answer])));


let fails = 0;
const check = (n, c, d) => { if (c) console.log('  PASS  ' + n); else { fails++; console.log('  FAIL  ' + n + (d ? '\n        ' + d : '')); } };

(async () => {
  const userId = cryptoRandomId(), iso = new Date().toISOString();
  db.prepare('INSERT INTO users (id,email,password_hash,password_salt,created_at) VALUES (?,?,?,?,?)')
    .run(userId, 'wb@example.com', 'x', 'y', iso);
  db.prepare('INSERT INTO profiles (user_id,name,created_at,updated_at) VALUES (?,?,?,?)')
    .run(userId, 'Test Learner', iso, iso);
  ws.startEnrollment(userId, { level: 'junior', scheduleType: 'weekday', scheduleDays: null });
  passSkillTest(userId);

  console.log('\n1. Project brief document');
  const b = ws.getProjectBrief(userId, 'compensation-review');
  check('brief returns the authored doc', Boolean(b.doc));
  check('has all 3 sections', Boolean(b.doc.projectTitle && b.doc.primaryObjective && b.doc.tools.length), JSON.stringify(Object.keys(b.doc)));
  check('company + role present', b.doc.companyName === 'Meridian Systems' && b.doc.yourRole === 'Data Analyst');
  check('role responsibilities listed', b.doc.roleResponsibilities.length >= 3);
  check('deliverables listed', b.doc.deliverables.length >= 1);
  check('live vs planned tools split', b.doc.liveTools.length === 4 && b.doc.plannedTools.length === 0,
    'live=' + b.doc.liveTools.length + ' planned=' + b.doc.plannedTools.length);
  check('unlocked at 0 graded', b.unlocked === true);

  const phoenix = ws.getProjectBrief(userId, 'outage-recovery');
  check('Phoenix locked until 3 graded', phoenix.unlocked === false, 'unlockAfter=' + phoenix.unlockAfter);
  check('Phoenix flags the CRM as planned, not live',
    phoenix.doc.plannedTools.some((t) => t.key === 'crm' && t.status === 'planned'));
  check('Phoenix binds to saas_ops', phoenix.doc.datasetKey === 'saas_ops');

  console.log('\n2. Workbench bootstrap');
  const task = db.prepare("SELECT * FROM sim_tasks WHERE task_key = 'da-001' LIMIT 1").get();
  const wb = ws.getWorkbench(userId, task.id);
  check('returns dataset schema', wb.dataset && wb.dataset.tables.length === 2, JSON.stringify(wb.dataset && wb.dataset.tables.map(t=>t.name)));
  check('tables carry row counts', wb.dataset.tables.every((t) => t.rowCount > 0),
    JSON.stringify(wb.dataset.tables.map((t) => t.name + '=' + t.rowCount)));
  check('columns carry types', wb.dataset.tables[1].columns.every((c) => c.type));
  check('exit_year documented as nullable',
    wb.dataset.tables[1].columns.find((c) => c.name === 'exit_year').note.includes('NULL'));

  console.log('\n3. Scratch run (explore without grading)');
  const r = ws.runScratchQuery(userId, task.id, 'SELECT name, salary FROM employees ORDER BY salary DESC LIMIT 5');
  check('returns rows', r.rows.length === 5);
  check('returns columns', JSON.stringify(r.columns) === '["name","salary"]', JSON.stringify(r.columns));
  check('reports elapsed time', typeof r.elapsedMs === 'number');
  check('names the dataset', r.datasetKey === 'hr_core');

  const big = ws.runScratchQuery(userId, task.id, 'SELECT a.id, b.id AS b_id FROM employees a, employees b');
  check('caps runaway result sets at 200', big.rows.length === 200 && big.truncated === true,
    'got ' + big.rows.length + ' truncated=' + big.truncated + ' total=' + big.totalRows);

  console.log('\n4. Safety — the practice DB can never reach real data');
  for (const [label, sql] of [
    ['DROP is refused', 'DROP TABLE employees'],
    ['DELETE is refused', 'DELETE FROM employees'],
    ['UPDATE is refused', 'UPDATE employees SET salary = 0'],
    ['ATTACH is refused', "SELECT 1; ATTACH DATABASE 'x.db' AS x"],
    ['multi-statement is refused', 'SELECT 1; SELECT 2'],
  ]) {
    let threw = false;
    try { ws.runScratchQuery(userId, task.id, sql); } catch (e) { threw = true; }
    check(label, threw);
  }
  let sawUsers = false;
  try { ws.runScratchQuery(userId, task.id, 'SELECT * FROM users'); sawUsers = true; } catch (e) {}
  check('real users table is not reachable from the practice DB', !sawUsers);

  console.log('\n5. Grading still works against the new schema');
  const correct = 'SELECT d.name AS department, AVG(e.salary) AS avg_salary FROM employees e JOIN departments d ON d.id = e.department_id WHERE e.exit_year IS NULL GROUP BY d.name ORDER BY avg_salary DESC';
  const good = await submitAndSignOff(ws, userId, task.id, correct);
  check('correct answer scores high once signed off', good.accepted && good.score >= 80, JSON.stringify(good).slice(0, 120));

  // A SQL task specifically: the workbench under test here is the SQL one, and the
  // project now also carries a chart task that submits choices rather than a query.
  const t2 = db.prepare("SELECT * FROM sim_tasks WHERE status != 'graded' AND task_key LIKE 'da-00[1234]' LIMIT 1").get()
    || db.prepare("SELECT * FROM sim_tasks WHERE status != 'graded' AND task_key IN ('da-001','da-002','da-003','da-004') LIMIT 1").get();
  if (t2) {
    const wrong = await submitAndSignOff(ws, userId, t2.id, 'SELECT department_id, AVG(salary) AS avg_salary FROM employees GROUP BY department_id');
    check('wrong answer scores low once signed off', wrong.accepted && wrong.score < 80, JSON.stringify(wrong).slice(0, 120));
  }

  console.log(fails ? `\n${fails} FAILURE(S)` : '\nAll checks passed.');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
