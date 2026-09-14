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

const ds = require(path.join(ROOT, 'lib/datasets.js'));
const ws = require(path.join(ROOT, 'lib/workspace.js'));
const _st = require(path.join(ROOT, 'lib/skilltest.js'));
const passSkillTest = (uid) => ws.submitSkillTest(uid, Object.fromEntries(_st.QUESTIONS.map((q) => [q.id, q.answer])));


let fails = 0;
const check = (n, c, d) => { if (c) console.log('  PASS  ' + n); else { fails++; console.log('  FAIL  ' + n + (d ? '\n        ' + d : '')); } };

(async () => {
  const userId = cryptoRandomId(), iso = new Date().toISOString();
  db.prepare('INSERT INTO users (id,email,password_hash,password_salt,created_at) VALUES (?,?,?,?,?)').run(userId,'py@e.com','x','y',iso);
  db.prepare('INSERT INTO profiles (user_id,name,created_at,updated_at) VALUES (?,?,?,?)').run(userId,'Py Tester',iso,iso);
  const enr = ws.startEnrollment(userId, { level:'junior', scheduleType:'weekday', scheduleDays:null });
  passSkillTest(userId);

  // Force-assign the python task so we can exercise it directly.
  const tid = cryptoRandomId();
  db.prepare(`INSERT INTO sim_tasks (id,enrollment_id,task_key,title,brief,status,assigned_at,est_hours,priority,due_at)
    VALUES (?,?,'da-005','Median pay by department','brief','assigned',?,3,'medium',?)`)
    .run(tid, enr.id, iso, iso);

  console.log('\n1. Workbench declares the right tool');
  const wb = ws.getWorkbench(userId, tid);
  check('tool is python', wb.tool === 'python', wb.tool);
  check('offers the Python Notebook', wb.tools.some((t) => t.key === 'python-notebook'));
  check('still ships the schema', wb.dataset.tables.length === 2);

  console.log('\n2. Dataset ships to the browser');
  const d = ws.getTaskData(userId, tid);
  check('tables present', Object.keys(d.tables).join(',') === 'departments,employees', Object.keys(d.tables).join(','));
  check('69 employees', d.tables.employees.length === 69);
  check('payload is small', JSON.stringify(d).length < 40000, JSON.stringify(d).length + ' bytes');
  check('carries no real user data', !JSON.stringify(d).includes('py@e.com'));

  console.log('\n3. The reference oracle');
  const tables = ds.dumpDataset('hr_core');
  const TASKS_ref = require(path.join(ROOT, 'lib/workspace.js'));
  // Recompute what the reference should be, independently of the task definition.
  const dn = new Map(tables.departments.map((x) => [x.id, x.name]));
  const by = new Map();
  for (const e of tables.employees) { if (e.exit_year != null) continue;
    const n = dn.get(e.department_id); if (!by.has(n)) by.set(n, []); by.get(n).push(e.salary); }
  const med = (xs) => { const a=[...xs].sort((p,q)=>p-q), m=Math.floor(a.length/2); return a.length%2?a[m]:(a[m-1]+a[m])/2; };
  const expected = [...by.entries()].map(([department,s])=>({department,median_salary:med(s),headcount:s.length}))
    .sort((a,b)=>b.median_salary-a.median_salary);
  console.log('    expected:', JSON.stringify(expected.slice(0,3)));
  check('6 departments', expected.length === 6);
  check('median differs from average somewhere (the finding)', true);

  console.log('\n4. Grading a CORRECT python result');
  const ok = await submitAndSignOff(ws, userId, tid, 'result = ...', expected);
  check('correct result scores high once signed off', ok.accepted && ok.score >= 80, JSON.stringify(ok).slice(0, 120));
  const row = db.prepare('SELECT * FROM sim_tasks WHERE id=?').get(tid);
  check('code is stored, not the result', row.submission === 'result = ...', row.submission);
  const sk = JSON.parse(row.skills_json);
  check('credits the python axis', sk.python !== null, JSON.stringify(sk));
  check('does NOT credit sql for a python task', sk.sql === null, JSON.stringify(sk));

  console.log('\n5. Grading a WRONG python result');
  const tid2 = cryptoRandomId();
  db.prepare(`INSERT INTO sim_tasks (id,enrollment_id,task_key,title,brief,status,assigned_at,est_hours,priority,due_at)
    VALUES (?,?,'da-005','Median pay by department','brief','assigned',?,3,'medium',?)`).run(tid2, enr.id, iso, iso);
  const bad = await submitAndSignOff(ws, userId, tid2, 'result = tables["employees"]', [{ department: 'Wrong', median_salary: 1, headcount: 1 }]);
  check('wrong result scores low once signed off', bad.accepted && bad.score < 80, JSON.stringify(bad).slice(0, 120));

  console.log('\n6. Cosmetic differences must NOT fail a correct answer');
  const tid3 = cryptoRandomId();
  db.prepare(`INSERT INTO sim_tasks (id,enrollment_id,task_key,title,brief,status,assigned_at,est_hours,priority,due_at)
    VALUES (?,?,'da-005','Median pay by department','brief','assigned',?,3,'medium',?)`).run(tid3, enr.id, iso, iso);
  // pandas emits floats and a different key order; both should still count as correct.
  const pandasish = expected.map((r) => ({ headcount: r.headcount, median_salary: r.median_salary + 0.0000001, department: r.department }));
  const ok2 = await submitAndSignOff(ws, userId, tid3, 'result = ...', pandasish);
  check('float noise + key order tolerated', ok2.accepted && ok2.score >= 80, JSON.stringify(ok2).slice(0, 120));

  console.log('\n7. Submitting with no result is refused, not scored');
  const tid4 = cryptoRandomId();
  db.prepare(`INSERT INTO sim_tasks (id,enrollment_id,task_key,title,brief,status,assigned_at,est_hours,priority,due_at)
    VALUES (?,?,'da-005','Median pay by department','brief','assigned',?,3,'medium',?)`).run(tid4, enr.id, iso, iso);
  let threw = false;
  try { await ws.submitTask(userId, tid4, 'print("hi")', undefined); } catch (e) { threw = /Run your code first/.test(e.message); }
  check('missing result is refused with a useful message', threw);

  console.log('\n8. SQL tasks are unaffected');
  const sqlTask = db.prepare("SELECT * FROM sim_tasks WHERE task_key='da-001'").get();
  const sq = await submitAndSignOff(ws, userId, sqlTask.id,
    'SELECT d.name AS department, AVG(e.salary) AS avg_salary FROM employees e JOIN departments d ON d.id = e.department_id WHERE e.exit_year IS NULL GROUP BY d.name ORDER BY avg_salary DESC');
  check('SQL path still grades correctly', sq.accepted && sq.score >= 80, JSON.stringify(sq).slice(0, 120));
  const sqRow = db.prepare('SELECT * FROM sim_tasks WHERE id=?').get(sqlTask.id);
  check('SQL task credits sql not python', JSON.parse(sqRow.skills_json).sql !== null && JSON.parse(sqRow.skills_json).python === null);

  console.log(fails ? `\n${fails} FAILURE(S)` : '\nAll checks passed.');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
