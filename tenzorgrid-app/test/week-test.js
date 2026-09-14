// Phase 2: the week runs day by day, the deadline bites, and the learner can see
// whose work is waiting on theirs.
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


let fails = 0;
const check = (n, c, d) => { if (c) console.log('  PASS  ' + n); else { fails++; console.log('  FAIL  ' + n + (d ? '\n        ' + d : '')); } };

const REF = {
  'da-001': 'SELECT d.name AS department, AVG(e.salary) AS avg_salary FROM employees e JOIN departments d ON d.id = e.department_id WHERE e.exit_year IS NULL GROUP BY d.name ORDER BY avg_salary DESC',
  'da-002': 'SELECT hire_year, COUNT(*) AS headcount, AVG(salary) AS avg_salary FROM employees GROUP BY hire_year ORDER BY hire_year',
  'da-003': 'SELECT role, MIN(salary) AS min_salary, MAX(salary) AS max_salary, AVG(salary) AS avg_salary, MAX(salary) - MIN(salary) AS spread FROM employees WHERE exit_year IS NULL GROUP BY role ORDER BY spread DESC',
};
async function signOff(uid, taskId, code, result) {
  await ws.submitTask(uid, taskId, code, result);
  return ws.answerReview(uid, taskId,
    'I filtered that way because including the wrong rows would skew the number away from what the business actually asked about.');
}
function newLearner(email, name) {
  const uid = cryptoRandomId(), iso = new Date().toISOString();
  db.prepare('INSERT INTO users (id,email,password_hash,password_salt,created_at) VALUES (?,?,?,?,?)').run(uid, email, 'x', 'y', iso);
  db.prepare('INSERT INTO profiles (user_id,name,created_at,updated_at) VALUES (?,?,?,?)').run(uid, name, iso, iso);
  ws.startEnrollment(uid, { level: 'junior', scheduleType: 'weekday', scheduleDays: null });
  passSkillTest(uid);
  return uid;
}
const idOf = (uid, k) => {
  const e = ws.getEnrollment(uid);
  return (db.prepare('SELECT id FROM sim_tasks WHERE enrollment_id=? AND task_key=?').get(e.id, k) || {}).id;
};
const runOf = (uid, key) => {
  const e = ws.getEnrollment(uid);
  return db.prepare('SELECT * FROM sim_project_runs WHERE enrollment_id=? AND project_key=?').get(e.id, key);
};
const shift = (uid, key, days) => {
  const e = ws.getEnrollment(uid);
  db.prepare("UPDATE sim_project_runs SET started_at = ?, due_at = ? WHERE enrollment_id=? AND project_key=?")
    .run(new Date(Date.now() - days * 86400000).toISOString(),
         new Date(Date.now() - (days - 7) * 86400000).toISOString(), e.id, key);
};

(async () => {
  console.log('1. Starting a project opens a real week');
  const u1 = newLearner('week1@e.com', 'Priya Sharma');
  const run = runOf(u1, 'compensation-review');
  check('a project run exists', Boolean(run), JSON.stringify(run));
  check('it has a start and a deadline', Boolean(run.started_at && run.due_at));
  const dayOf = (iso) => Date.parse(iso.slice(0, 10) + 'T00:00:00Z');
  const span = Math.round((dayOf(run.due_at) - dayOf(run.started_at)) / 86400000);
  check('the deadline is 4-6 calendar days out (5 working days)', span >= 4 && span <= 6, span + ' days');
  check('no chase has been sent yet', run.nudge_level === 0);

  const st1 = ws.getState(u1);
  const p1 = st1.projects.projects.find((p) => p.key === 'compensation-review');
  check('the project reports its week', Boolean(p1.week), JSON.stringify(p1.week && Object.keys(p1.week)));
  check('it is on day 1 of 5', p1.week.day === 1 && p1.week.totalDays === 5, `day ${p1.week.day}/${p1.week.totalDays}`);
  check('it is on track', p1.week.onTrack === true);

  console.log('\n2. The learner can see whose work brackets theirs');
  const c = p1.week.contributors;
  check('three contributors listed', c.length === 3, JSON.stringify(c.map((x) => x.role)));
  const upstream = c.find((x) => x.role === 'Data Engineer');
  const you = c.find((x) => x.name === null);
  const downstream = c.find((x) => x.role === 'Comms');
  check('the upstream engineer is already done', upstream.state === 'done', upstream.state + ' — ' + upstream.note);
  check('the learner is in progress', you.state === 'in-progress', you.state + ' — ' + you.note);
  check('someone downstream is queued behind the learner', downstream.state === 'waiting', JSON.stringify(downstream));
  check('but is not called blocked on day 1', downstream.state !== 'blocked', downstream.state);
  check('and is named', typeof downstream.name === 'string' && downstream.name.length > 0, downstream.name);
  check('nobody is cried wolf over on day 1', p1.week.blocking.length === 0, JSON.stringify(p1.week.blocking));
  console.log('    downstream:', downstream.name, '—', downstream.note);

  // Once the deadline passes, the same person IS genuinely stuck and says so.
  const u1b = newLearner('week1b@e.com', 'Late Learner');
  shift(u1b, 'compensation-review', 8);
  const lateP = ws.getState(u1b).projects.projects.find((p) => p.key === 'compensation-review');
  const lateDown = lateP.week.contributors.find((x) => x.role === 'Comms');
  check('once late, they ARE blocked', lateDown.state === 'blocked', lateDown.state + ' — ' + lateDown.note);
  check('and the project names them', lateP.week.blocking.length === 1, JSON.stringify(lateP.week.blocking));
  console.log('    when late:', lateP.week.blocking.join(', '), '—', lateDown.note);

  console.log('\n3. Finishing the work unblocks them');
  await finishAll(u1); // the project is a whole week of work now, not one query
  const st1b = ws.getState(u1);
  const p1b = st1b.projects.projects.find((p) => p.key === 'compensation-review');
  const downstream2 = p1b.week.contributors.find((x) => x.role === 'Comms');
  check('the blocked colleague is now unblocked', downstream2.state === 'done', downstream2.state + ' — ' + downstream2.note);
  check('nobody is listed as blocked', p1b.week.blocking.length === 0, JSON.stringify(p1b.week.blocking));

  console.log('\n4. A later-day task exists but is not yet workable');
  const u2 = newLearner('week2@e.com', 'Arun Kumar');
  await finishProject(u2);
  ws.startProject(u2, 'headcount-trends');

  const st2 = ws.getState(u2);
  const day3 = st2.taskBoard.rows.find((r) => r.title === 'Attrition by department');
  check('the day-3 task is visible', Boolean(day3));
  check('it is marked as not yet open', day3.notYetOpen === true, JSON.stringify({ n: day3.notYetOpen, s: day3.stage }));
  check('its stage reads "Opens later"', day3.stage === 'Opens later', day3.stage);
  check('it carries its day number', day3.dayIndex === 3, String(day3.dayIndex));
  const day1 = st2.taskBoard.rows.find((r) => r.title === 'How many people are we talking about');
  check('the day-1 task IS workable', day1.notYetOpen === false, JSON.stringify({ n: day1.notYetOpen, s: day1.stage }));
  const announced = db.prepare("SELECT COUNT(*) c FROM sim_messages WHERE task_id = ? AND sender_archetype='line_manager'").get(day3.id).c;
  check('a task that has not opened is not announced', announced === 0, 'messages=' + announced);

  console.log('\n5. When its day arrives it opens and Asha announces it');
  const e2 = ws.getEnrollment(u2);
  db.prepare("UPDATE sim_tasks SET opens_at = ? WHERE id = ?").run(new Date(Date.now() - 3600000).toISOString(), day3.id);
  const st2b = ws.getState(u2);
  const day3b = st2b.taskBoard.rows.find((r) => r.id === day3.id);
  check('it is now workable', day3b.notYetOpen === false, JSON.stringify({ n: day3b.notYetOpen, s: day3b.stage }));
  const msg = db.prepare("SELECT body FROM sim_messages WHERE task_id=? AND sender_archetype='line_manager'").get(day3.id);
  check('Asha announced it on the day', Boolean(msg), msg && msg.body.slice(0, 70));
  ws.getState(u2); ws.getState(u2);
  const count = db.prepare("SELECT COUNT(*) c FROM sim_messages WHERE task_id=? AND sender_archetype='line_manager'").get(day3.id).c;
  check('it is announced exactly once, not on every read', count === 1, 'messages=' + count);

  console.log('\n6. Missing the deadline is felt — Asha chases first');
  const u3 = newLearner('week3@e.com', 'Sanjay Rao');
  shift(u3, 'compensation-review', 8); // due yesterday
  ws.getState(u3);
  const chase1 = db.prepare("SELECT * FROM sim_messages WHERE enrollment_id=? AND subject LIKE 'Where are we%'").get(ws.getEnrollment(u3).id);
  check('Asha emails when the deadline passes', Boolean(chase1), chase1 && chase1.subject);
  check('she names the project', chase1 && /Q1 Compensation Review/.test(chase1.subject + chase1.body));
  check('she names the learner', chase1 && /Sanjay/.test(chase1.body));
  // With a whole day outstanding she gives a count; with one or two left she names them,
  // because a chase you can act on from the email itself is worth more than a tally.
  // Everything still outstanding on the project, including work whose day has not yet
  // come — an overdue project's unopened tasks are outstanding too.
  const openNow = ws.getState(u3).taskBoard.rows.filter((r) => r.status !== 'graded').length;
  check('she says how much is outstanding', chase1 && new RegExp(`${openNow} tasks`).test(chase1.body),
    chase1 && chase1.body.split('\n')[0]);
  check('and says it grammatically', chase1 && !/tasks (?:is|isn't)\b/.test(chase1.body),
    chase1 && chase1.body.split('\n')[0]);

  // And the naming branch: one task left, so she names it.
  const u3b = newLearner('week3b@e.com', 'Nita Shah');
  // Everything on the project except one task — the list grows as the week is authored,
  // so name what to LEAVE rather than what to finish.
  const e3b = ws.getEnrollment(u3b);
  const leaveOne = db.prepare('SELECT task_key FROM sim_tasks WHERE enrollment_id = ?').all(e3b.id)
    .map((r) => r.task_key).filter((k) => k !== 'da-001');
  await finishAll(u3b, leaveOne);
  shift(u3b, 'compensation-review', 8);
  ws.getState(u3b);
  const chase1b = db.prepare("SELECT * FROM sim_messages WHERE enrollment_id=? AND subject LIKE 'Where are we%'").get(ws.getEnrollment(u3b).id);
  check('with one task left she names it', chase1b && /"Department salary breakdown"/.test(chase1b.body),
    chase1b && chase1b.body.split('\n')[0]);
  console.log('    ' + chase1.subject + ' —', chase1.body.split('\n')[0].slice(0, 95));

  ws.getState(u3); ws.getState(u3);
  const n1 = db.prepare("SELECT COUNT(*) c FROM sim_messages WHERE enrollment_id=? AND subject LIKE 'Where are we%'").get(ws.getEnrollment(u3).id).c;
  check('she does not re-send it on every page load', n1 === 1, 'sent=' + n1);

  console.log('\n7. Three days late, the stakeholder escalates');
  shift(u3, 'compensation-review', 10);
  db.prepare("UPDATE sim_project_runs SET nudge_level = 1 WHERE enrollment_id = ?").run(ws.getEnrollment(u3).id);
  ws.getState(u3);
  const chase2 = db.prepare("SELECT * FROM sim_messages WHERE enrollment_id=? AND sender_archetype='stakeholder' AND subject LIKE 'Re:%'").get(ws.getEnrollment(u3).id);
  check('Vikram escalates', Boolean(chase2), chase2 && chase2.subject);
  check('he explains who is held up downstream', chase2 && /downstream|can't start/i.test(chase2.body));
  console.log('    ' + chase2.subject + ' —', chase2.body.split('\n')[0].slice(0, 95));

  console.log('\n8. A finished project is never chased');
  const u4 = newLearner('week4@e.com', 'Kavya Nair');
  // A project is complete on all four currencies now, not just its tasks.
  await finishProject(u4);
  shift(u4, 'compensation-review', 20);
  ws.getState(u4);
  const chased = db.prepare("SELECT COUNT(*) c FROM sim_messages WHERE enrollment_id=? AND subject LIKE 'Where are we%'").get(ws.getEnrollment(u4).id).c;
  check('no chase for completed work', chased === 0, 'sent=' + chased);
  const closed = runOf(u4, 'compensation-review');
  check('the run is marked complete', Boolean(closed.completed_at), String(closed.completed_at));

  console.log('\n9. Existing accounts get a week backfilled from their real start');
  const u5 = newLearner('week5@e.com', 'Old Account');
  const e5 = ws.getEnrollment(u5);
  const oldStart = new Date(Date.now() - 3 * 86400000).toISOString();
  db.prepare('DELETE FROM sim_project_runs WHERE enrollment_id = ?').run(e5.id);
  db.prepare('UPDATE sim_tasks SET assigned_at = ? WHERE enrollment_id = ?').run(oldStart, e5.id);
  ws.getState(u5);
  const backfilled = runOf(u5, 'compensation-review');
  check('a run was backfilled', Boolean(backfilled));
  check('it uses their real start, not today', backfilled.started_at === oldStart, backfilled.started_at);


  console.log('\n10. A count the learner can reconcile with what they can see');
  // "6 of 7 signed off" was true and unhelpful: the seventh was a later-day task showing
  // as "Opens later", so the learner counted six and thought the total was wrong.
  const u9 = newLearner('week9@e.com', 'Counting Carla');
  let p9 = ws.getState(u9).projects.projects.find((p) => p.key === 'compensation-review');
  const notOpen = ws.getState(u9).taskBoard.rows.filter((r) => r.notYetOpen).length;
  check('the note warns that some work is not open yet', /not open yet/.test(p9.week.contributors.find((c) => !c.name).note),
    p9.week.contributors.find((c) => !c.name).note);
  check('and the number matches the board', new RegExp(`${notOpen} not open yet`).test(p9.week.contributors.find((c) => !c.name).note),
    `board says ${notOpen}`);

  // Finish everything that is actually open, and the card should say you are up to date.
  // Taken from the board rather than from opens_at. A task is workable once its day has
  // arrived OR been earned, and asking the database about opens_at alone gets a different
  // — and now wrong — answer from the screen the learner is looking at.
  const e9 = ws.getEnrollment(u9);
  const openIds = ws.getState(u9).taskBoard.rows.filter((r) => !r.notYetOpen).map((r) => r.id);
  const openTaskKeys = openIds.length
    ? db.prepare(`SELECT task_key FROM sim_tasks WHERE enrollment_id = ? AND id IN (${openIds.map(() => '?').join(',')})`)
        .all(e9.id, ...openIds).map((r) => r.task_key)
    : [];
  await finishAll(u9, openTaskKeys);
  p9 = ws.getState(u9).projects.projects.find((p) => p.key === 'compensation-review');
  const note9 = p9.week.contributors.find((c) => !c.name).note;
  check('with everything available done, it says so', p9.week.allCaughtUp === true, JSON.stringify({ c: p9.week.allCaughtUp, note: note9 }));
  check('and names the day the rest arrives', Boolean(p9.week.waitingUntil), String(p9.week.waitingUntil));
  check('the note reads as up-to-date, not behind', /opens|open/.test(note9) && !/signed off$/.test(note9), note9);
  console.log('    ' + note9);

  console.log(fails ? `\n${fails} FAILURE(S)` : '\nAll week checks passed.');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
