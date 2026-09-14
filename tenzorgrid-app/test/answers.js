// The one place every suite gets a correct answer for a task.
//
// Four suites broke each time a project gained a task, because each of them knew how to
// answer da-001 and nothing else. This is that knowledge in one file: give it a task key
// and it submits the right thing, whatever type the task happens to be.
const path = require('node:path');
const ROOT = require('node:path').join(__dirname, '..');

const ANSWERS = {
  // SQL
  'da-001': 'SELECT d.name AS department, AVG(e.salary) AS avg_salary FROM employees e JOIN departments d ON d.id = e.department_id WHERE e.exit_year IS NULL GROUP BY d.name ORDER BY avg_salary DESC',
  'da-002': 'SELECT hire_year, COUNT(*) AS headcount, AVG(salary) AS avg_salary FROM employees GROUP BY hire_year ORDER BY hire_year',
  'da-003': 'SELECT role, MIN(salary) AS min_salary, MAX(salary) AS max_salary, AVG(salary) AS avg_salary, MAX(salary) - MIN(salary) AS spread FROM employees WHERE exit_year IS NULL GROUP BY role ORDER BY spread DESC',
  'da-004': "SELECT c.company, c.tier, c.mrr, COUNT(i.id) AS incidents, SUM(i.rows_corrupted) AS rows_corrupted FROM clients c JOIN incidents i ON i.client_id = c.id WHERE c.status = 'active' GROUP BY c.company, c.tier, c.mrr ORDER BY c.mrr DESC",
  'da-101': 'SELECT (SELECT COUNT(*) FROM employees WHERE exit_year IS NULL) AS current_employees, (SELECT COUNT(*) FROM departments) AS departments',
  'sa-001': "SELECT service, COUNT(*) AS incidents, AVG((julianday(resolved_at) - julianday(started_at)) * 24) AS avg_hours FROM incidents WHERE resolved_at IS NOT NULL GROUP BY service ORDER BY avg_hours DESC",
  'sa-002': "SELECT c.company, c.tier, c.mrr, COUNT(t.id) AS tickets, (COUNT(t.id) * 100000.0) / c.mrr AS tickets_per_100k FROM clients c LEFT JOIN tickets t ON t.client_id = c.id WHERE c.status = 'active' GROUP BY c.id, c.company, c.tier, c.mrr ORDER BY tickets_per_100k DESC",
  'sa-003': "SELECT c.company, c.tier, SUM(CASE WHEN t.status IN ('open','pending') THEN 1 ELSE 0 END) AS unresolved_tickets, (SELECT COUNT(*) FROM incidents i WHERE i.client_id = c.id AND i.severity = 'SEV1') AS sev1_incidents FROM clients c LEFT JOIN tickets t ON t.client_id = c.id WHERE c.status = 'active' GROUP BY c.id, c.company, c.tier ORDER BY unresolved_tickets DESC",

  // Charts
  'da-006': '{"type":"bar","x":"department","y":"avg_salary","sort":"desc","baselineZero":true}',
  'da-007': '{"type":"line","x":"hire_year","y":"headcount","sort":"none"}',

  'da-111': 'SELECT d.name AS department, AVG(e.salary) AS avg_salary, d.band_low, d.band_high, (AVG(e.salary) - d.band_low) * 100.0 / (d.band_high - d.band_low) AS band_position FROM employees e JOIN departments d ON d.id = e.department_id WHERE e.exit_year IS NULL GROUP BY d.name, d.band_low, d.band_high ORDER BY band_position ASC',
  'da-113': "SELECT d.name AS department, SUM(CASE WHEN e.exit_year IS NOT NULL THEN 1 ELSE 0 END) AS leavers, SUM(CASE WHEN e.exit_year IS NULL THEN 1 ELSE 0 END) AS current_staff FROM employees e JOIN departments d ON d.id = e.department_id GROUP BY d.name ORDER BY leavers DESC",
  'sa-011': "SELECT service, COUNT(*) AS incidents, SUM(CASE WHEN severity = 'SEV1' THEN 1 ELSE 0 END) AS sev1 FROM incidents GROUP BY service ORDER BY incidents DESC",

  // Judgements
  'da-110': '["band","compare","leavers"]',
  'da-112': '["diff","marketing","bandlow"]',
  'sa-010': '["freq","mttr","total"]',
  'sa-012': '["mixed","nofilter","avgshape"]',
  'sa-013': '["both","third","thin"]',

  // Prose
  'da-114': "Support is not the department with the strongest case — Marketing is. Marketing sits at 37% of its own salary band against Support at 47%, so relative to what we decided the roles are worth, Marketing is further down. Position in band means where the average sits between the floor and ceiling HR set for that department. I can't tell you whether either is below market rate; we hold no external benchmark data.",
  'sa-014': "The two sides are measuring different things, which is why the argument hasn't settled. api-gateway leads on frequency at 9 incidents; billing-sync leads on time to resolve at 62 hours. Worth flagging that the billing-sync figure rests on one resolved incident, so it's the least reliable number here. I'd recommend we measure total hours lost — frequency times duration — rather than either alone.",
  'da-100': '["avg","gap","current"]',
  'da-102': '["nullcmp","deptname","gap"]',
  'da-103': '["highest","gapfact"]',

  // Prose
  'da-104': "Engineering has the highest average salary at 23.9L, ahead of Finance by about 5 lakh. These figures cover current staff only; people who have left are excluded. Let me know if you want the full table before Thursday.",
};

// Python tasks need their expected result computed, not typed.
function computedFor(taskKey) {
  const ds = require(path.join(ROOT, 'lib/datasets.js'));
  const median = (xs) => { const a = [...xs].sort((p, q) => p - q), m = Math.floor(a.length / 2); return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
  if (taskKey === 'da-005') {
    const t = ds.dumpDataset('hr_core');
    const dn = new Map(t.departments.map((d) => [d.id, d.name]));
    const by = new Map();
    for (const e of t.employees) {
      if (e.exit_year != null) continue;
      const n = dn.get(e.department_id);
      if (!by.has(n)) by.set(n, []);
      by.get(n).push(e.salary);
    }
    return [...by.entries()]
      .map(([department, s]) => ({ department, median_salary: median(s), headcount: s.length }))
      .sort((a, b) => b.median_salary - a.median_salary);
  }
  if (taskKey === 'sa-004') {
    const t = ds.dumpDataset('saas_ops');
    const bySev = new Map();
    for (const i of t.incidents) {
      if (!i.resolved_at) continue;
      const h = (Date.parse(i.resolved_at) - Date.parse(i.started_at)) / 3600000;
      if (!bySev.has(i.severity)) bySev.set(i.severity, []);
      bySev.get(i.severity).push(h);
    }
    return [...bySev.entries()]
      .map(([severity, hs]) => ({ severity, resolved: hs.length, median_hours: median(hs), worst_hours: Math.max(...hs) }))
      .sort((a, b) => b.median_hours - a.median_hours);
  }
  return null;
}

// An answer that satisfies the offline review judge for any task type.
const REVIEW_REPLY = 'I filtered it that way because including the wrong rows would skew the number away from what the business actually asked about, and that would show up in the meeting rather than here.';

// Signs off every open task on the learner's board, whatever type each one is. `only`
// restricts it to specific task keys.
async function finishOpenTasks(ws, db, uid, only) {
  const e = ws.getEnrollment(uid);
  const rows = db.prepare("SELECT * FROM sim_tasks WHERE enrollment_id = ? AND status NOT IN ('graded')").all(e.id);
  for (const row of rows) {
    if (only && !only.includes(row.task_key)) continue;
    // Marked rather than submitted.
    //
    // This used to push every task through the real grader, which was a nice idea and the
    // wrong one: a project is now thirty tasks, Asha can send any of them back, and a suite
    // that compresses five days into one instant hits the daily submission cap doing
    // exactly what the product asks. The cap is a real limit doing its real job.
    //
    // Nothing is lost. The suites that actually test grading — gate-test, chart-test,
    // py-test — call submitTask themselves and assert on what comes back. This helper only
    // ever existed to get a suite PAST work it was not testing.
    // Dated by the day the task belongs to, not all stamped now.
    //
    // The daily cap counts tasks GRADED TODAY, however they were graded — so marking a
    // whole five-day project in one instant trips a limit that exists to bound AI spend
    // across a real week. Spreading the dates is not a trick to get past it; it is what the
    // rows would actually look like.
    const daysAgo = Math.max(0, 5 - (row.day_index || 1));
    const when = new Date(Date.now() - daysAgo * 24 * 3600 * 1000).toISOString();
    db.prepare(`UPDATE sim_tasks SET status = 'graded', score = 80, feedback = 'Marked by the test harness.',
                  submission = '(test harness)', review_state = NULL, review_question = NULL, opens_at = NULL,
                  submitted_at = ?, graded_at = ? WHERE id = ?`)
      .run(when, when, row.id);
  }
}

// Finish an entire project — all four currencies, not just the tasks.
//
// "Complete" stopped meaning "the queries are graded" the day activities, situations and
// the quiz became part of a project. Any suite that needs to get PAST project one has to
// clear all of it, which is what this does.
async function finishWholeProject(ws, db, uid) {
  const items = require(path.join(ROOT, 'lib/dayitems.js'));
  const PROSE = 'I excluded leavers with exit_year IS NULL and kept the count beside every average, because Finance is seven people and Marketing nine. A left join keeps teams with no rows so they show zero rather than vanishing. Location exists but 25 of the 26 department-by-location cells are under five people, so publishing that grain would identify individuals; location on its own is safe. Done so far: the averages and the band position. Left: the write-up tomorrow.';

  for (let pass = 0; pass < 12; pass++) {
    const st = ws.getState(uid);
    if (!st.day) break;
    const key = st.projectCompletion ? null : null;
    for (const a of st.activities.filter((x) => x.status !== 'done')) {
      const run = db.prepare('SELECT project_key FROM sim_project_runs WHERE enrollment_id = (SELECT id FROM sim_enrollments WHERE user_id = ?) ORDER BY started_at DESC LIMIT 1').get(uid);
      const d = items.activitiesFor(run.project_key).find((z) => z.key === a.key);
      if (!d) continue;
      const ans = d.check.kind === 'choice' ? d.check.options.find((o) => o.correct).key
        : d.check.kind === 'answer' ? PROSE : '';
      await ws.completeActivity(uid, a.key, ans);
    }
    for (const x of st.situations.filter((z) => !z.handledAs)) {
      const run = db.prepare('SELECT project_key FROM sim_project_runs WHERE enrollment_id = (SELECT id FROM sim_enrollments WHERE user_id = ?) ORDER BY started_at DESC LIMIT 1').get(uid);
      const d = items.situationsFor(run.project_key).find((z) => z.key === x.key);
      if (!d) continue;
      await ws.handleSituation(uid, x.key, d.needsReply ? 'reply' : 'archive', PROSE);
    }
    // Marked directly rather than submitted. This helper exists to get a suite PAST a
    // project, and a project is thirty tasks — pushing all of them through the grader in
    // one simulated day would hit the daily submission cap, which is a real limit doing its
    // real job rather than anything wrong with the test.
    const e = ws.getEnrollment(uid);
    for (const row of db.prepare("SELECT id, day_index FROM sim_tasks WHERE enrollment_id = ? AND status NOT IN ('graded')").all(e.id)) {
      const ago = Math.max(0, 5 - (row.day_index || 1));
      const at = new Date(Date.now() - ago * 24 * 3600 * 1000).toISOString();
      db.prepare(`UPDATE sim_tasks SET status = 'graded', score = 80, feedback = 'Marked by the test harness.',
                    submission = '(test harness)', review_state = NULL, review_question = NULL, opens_at = NULL,
                    submitted_at = ?, graded_at = ? WHERE id = ?`)
        .run(at, at, row.id);
    }
    const q = ws.getState(uid).quiz;
    if (q && q.open && !q.taken) {
      const run = db.prepare('SELECT project_key FROM sim_project_runs WHERE enrollment_id = (SELECT id FROM sim_enrollments WHERE user_id = ?) ORDER BY started_at DESC LIMIT 1').get(uid);
      const def = items.quizFor(run.project_key);
      const answers = {};
      for (const qq of def.questions) answers[qq.id] = qq.options.find((o) => o.correct).key;
      await ws.submitQuiz(uid, answers);
    }
    // Sign off the day and clock on for the next one. A day no longer rolls over on its
    // own — that was the point of the change — so a helper that gets a suite PAST a
    // project has to do what a learner does.
    const after = ws.getState(uid);
    if (after.day && after.day.readyToClose) {
      await ws.closeDay(uid);
      const closed = ws.getState(uid);
      if (closed.day && closed.day.closed && closed.day.nextDayName) ws.startNextDay(uid);
    }

    const pc = ws.getState(uid).projectCompletion;
    if (pc && pc.complete) break;
  }
}

module.exports = { ANSWERS, computedFor, finishOpenTasks, finishWholeProject, REVIEW_REPLY };
