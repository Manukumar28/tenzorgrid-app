// Moving the clock so a five-day week can be walked through in one sitting.
process.env.DATA_DIR = process.argv[2];
process.env.TIME_TRAVEL = '1';
const path = require('node:path');
const ROOT = require('node:path').join(__dirname, '..');
const aiPath = require.resolve(path.join(ROOT, 'lib/ai.js'));
require.cache[aiPath] = { id: aiPath, filename: aiPath, loaded: true, exports: {
  isAvailable: () => false, callClaude: async () => null, extractJson: () => null } };

const { db, cryptoRandomId } = require(path.join(ROOT, 'lib/db.js'));
const ws = require(path.join(ROOT, 'lib/workspace.js'));
const _st = require(path.join(ROOT, 'lib/skilltest.js'));
const answers = require('./answers.js');

let fails = 0;
const check = (n, c, d) => { if (c) console.log('  PASS  ' + n); else { fails++; console.log('  FAIL  ' + n + (d ? '\n        ' + d : '')); } };

function newLearner(email, level) {
  const uid = cryptoRandomId(), iso = new Date().toISOString();
  db.prepare('INSERT INTO users (id,email,password_hash,password_salt,created_at) VALUES (?,?,?,?,?)').run(uid, email, 'x', 'y', iso);
  db.prepare('INSERT INTO profiles (user_id,name,created_at,updated_at) VALUES (?,?,?,?)').run(uid, 'Priya Sharma', iso, iso);
  ws.startEnrollment(uid, { level: level || 'junior', scheduleType: 'weekday', scheduleDays: null });
  ws.submitSkillTest(uid, Object.fromEntries(_st.QUESTIONS.map((q) => [q.id, q.answer])));
  return uid;
}
const dayOf = (uid) => {
  const p = ws.getState(uid).projects.projects.find((x) => x.status === 'active');
  return p && p.week ? p.week.day : null;
};
const openTasks = (uid) => ws.getState(uid).taskBoard.rows.filter((r) => !r.notYetOpen && r.status !== 'graded');

(async () => {
  console.log('1. It moves the learner to the next day');
  const u1 = newLearner('tt1@e.com');
  check('starts on day 1', dayOf(u1) === 1, String(dayOf(u1)));
  const before = openTasks(u1).length;
  ws.timeTravel(u1, { workingDays: 1 });
  check('now on day 2', dayOf(u1) === 2, String(dayOf(u1)));
  const after = openTasks(u1).length;
  check('day 2 work has opened', after > before, `${before} → ${after} open`);
  console.log('    day 1: ' + before + ' open  →  day 2: ' + after + ' open');

  console.log('\n2. Everything dated moves together');
  // Shifting only some clocks would produce a state the product can never reach on its
  // own, and then a bug found while testing might not be a real bug.
  const u2 = newLearner('tt2@e.com');
  const e2 = ws.getEnrollment(u2);
  const snap = () => ({
    enrol: ws.getEnrollment(u2).created_at,
    run: db.prepare('SELECT started_at, due_at FROM sim_project_runs WHERE enrollment_id=?').get(e2.id),
    task: db.prepare('SELECT assigned_at, opens_at FROM sim_tasks WHERE enrollment_id=? AND task_key=?').get(e2.id, 'da-006'),
    msg: db.prepare('SELECT created_at FROM sim_messages WHERE enrollment_id=? ORDER BY created_at LIMIT 1').get(e2.id),
  });
  const a = snap();
  ws.timeTravel(u2, { workingDays: 1 });
  const b = snap();
  const moved = (x, y) => Math.round((Date.parse(x) - Date.parse(y)) / 3600000);
  // One WORKING day is not always 24 hours of calendar. Asking for the next working day
  // from a Saturday has to cross the weekend, so the shift is 48 hours — and a test that
  // hard-codes 24 passes Monday to Friday and fails at the weekend, which is exactly the
  // bug this suite exists to catch rather than reproduce.
  const shifted = moved(a.enrol, b.enrol);
  check('everything moved by a whole number of days', shifted % 24 === 0 && shifted > 0, shifted + 'h');
  check('the project run moved by the same amount', moved(a.run.started_at, b.run.started_at) === shifted);
  check('the deadline moved by the same amount', moved(a.run.due_at, b.run.due_at) === shifted);
  // opens_at is the one field that does NOT simply slide 24 hours, and must not: it is
  // derived in WORKING days from the start, so sliding it by calendar days puts a Friday
  // project's day-2 work on the Sunday. The invariant that matters is that it stays
  // consistent with where the week now begins.
  const day2 = db.prepare('SELECT opens_at FROM sim_tasks WHERE enrollment_id=? AND day_index=2 LIMIT 1').get(e2.id);
  const wantOpen = (() => {
    const d = new Date(b.run.started_at);
    d.setUTCHours(0, 0, 0, 0);
    const wknd = (x) => x.getUTCDay() === 0 || x.getUTCDay() === 6;
    while (wknd(d)) d.setUTCDate(d.getUTCDate() + 1);
    let counted = 1;
    while (counted < 2) { d.setUTCDate(d.getUTCDate() + 1); if (!wknd(d)) counted += 1; }
    return d.toISOString();
  })();
  check("day 2's opens_at is one WORKING day after the moved start", day2.opens_at === wantOpen,
    `${day2.opens_at} vs ${wantOpen}`);
  check('messages moved by the same amount', moved(a.msg.created_at, b.msg.created_at) === shifted);

  console.log('\n3. The whole week is reachable');
  const u3 = newLearner('tt3@e.com');
  const seen = [];
  for (let i = 0; i < 5; i++) {
    seen.push({ day: dayOf(u3), open: openTasks(u3).length });
    if (i < 4) ws.timeTravel(u3, { workingDays: 1 });
  }
  check('day advances 1→2→3→4→5', JSON.stringify(seen.map((s) => s.day)) === '[1,2,3,4,5]', JSON.stringify(seen.map((s) => s.day)));
  console.log('    ' + seen.map((s) => `day ${s.day}: ${s.open} open`).join('  |  '));

  console.log('\n4. Pushing past the deadline makes the chase fire');
  const u4 = newLearner('tt4@e.com');
  ws.timeTravel(u4, { to: 'past-deadline' });
  const chase = db.prepare("SELECT subject FROM sim_messages WHERE enrollment_id=? AND subject LIKE 'Where are we%'")
    .get(ws.getEnrollment(u4).id);
  check('Asha chases once the deadline has passed', Boolean(chase), chase && chase.subject);
  const p4 = ws.getState(u4).projects.projects.find((x) => x.status === 'active');
  check('the project reads as overdue', p4.week.onTrack === false, JSON.stringify({ overdue: p4.week.overdueDays }));

  console.log('\n5. It goes backwards too');
  const u5 = newLearner('tt5@e.com');
  ws.timeTravel(u5, { workingDays: 3 });
  check('forward to day 4', dayOf(u5) === 4, String(dayOf(u5)));
  ws.timeTravel(u5, { workingDays: -3 });
  check('and back to day 1', dayOf(u5) === 1, String(dayOf(u5)));

  console.log("\n6. Yesterday's stand-up doesn't block today's");
  const u6 = newLearner('tt6@e.com');
  await ws.submitStandup(u6, { done: 'a', today: 'b', blockers: 'no' });
  check('done for today', ws.getState(u6).standup.done === true);
  ws.timeTravel(u6, { workingDays: 1 });
  check('a new day gets a new stand-up', ws.getState(u6).standup.done === false);

  console.log('\n7. Graded work survives the trip');
  const u7 = newLearner('tt7@e.com');
  await answers.finishOpenTasks(ws, db, u7, ['da-001']);
  const gradedBefore = ws.getState(u7).taskBoard.rows.filter((r) => r.status === 'graded').length;
  ws.timeTravel(u7, { workingDays: 2 });
  const st7 = ws.getState(u7);
  check('the graded task is still graded', st7.taskBoard.rows.filter((r) => r.status === 'graded').length === gradedBefore, String(gradedBefore));
  check('and still carries its score', st7.taskBoard.rows.find((r) => r.status === 'graded').score > 0);

  console.log('\n8. It refuses nonsense, and is off by default');
  let err = null;
  try { ws.timeTravel(u1, { days: 0 }); } catch (e) { err = e.message; }
  check('zero is refused', /between -60 and 60/.test(err || ''), err);
  err = null;
  try { ws.timeTravel(u1, { days: 400 }); } catch (e) { err = e.message; }
  check('an absurd jump is refused', /between -60 and 60/.test(err || ''), err);

  const st = ws.getState(u1);
  check('the control reports itself enabled here', st.timeTravel.enabled === true);
  check('and says which day the learner is on', typeof st.timeTravel.day === 'number', JSON.stringify(st.timeTravel));

  console.log('\n9. Reset puts the learner back at day one with nothing on record');
  const u9 = newLearner('tt9@e.com');
  await answers.finishOpenTasks(ws, db, u9, ['da-001']);
  await ws.submitStandup(u9, { done: 'a', today: 'b', blockers: 'no' });
  ws.timeTravel(u9, { workingDays: 3 });
  const oldId = ws.getEnrollment(u9).id;
  check('set up: on day 4 with graded work', dayOf(u9) === 4 &&
    ws.getState(u9).taskBoard.rows.some((r) => r.status === 'graded'), String(dayOf(u9)));

  ws.timeTravelReset(u9);
  const e9 = ws.getEnrollment(u9);
  check('a brand-new enrollment replaces the old one', Boolean(e9) && e9.id !== oldId);
  check('the level is kept', e9.level === 'junior', e9.level);

  // The cascade is the whole mechanism, so check the tables directly rather than
  // trusting that getState looks clean.
  for (const t of ['sim_tasks', 'sim_project_runs', 'sim_messages', 'sim_standups', 'sim_contacts', 'sim_attendance']) {
    const left = db.prepare(`SELECT COUNT(*) c FROM ${t} WHERE enrollment_id = ?`).get(oldId).c;
    check(`${t} rows are gone`, left === 0, String(left));
  }

  const st9 = ws.getState(u9);
  check('no graded work survives', !st9.taskBoard.rows.some((r) => r.status === 'graded'),
    JSON.stringify(st9.taskBoard.rows.map((r) => r.status)));
  check("today's stand-up is available again", st9.standup.done === false);
  // Day one for a new joiner is the skills check, not a project — the same place a real
  // new starter lands, which is the point of reset.
  check('the skills check is waiting again', st9.skillTest.taken === false && st9.skillTest.required === true,
    JSON.stringify({ taken: st9.skillTest.taken, required: st9.skillTest.required }));
  check('the welcome mail is there', st9.messages.some((m) => /welcome/i.test(m.body)));

  console.log('\n10. Reset needs the gate too');
  err = null;
  try { ws.timeTravelReset('nobody-at-all'); } catch (e) { err = e.message; }
  check('an unknown learner is refused', /Not enrolled/.test(err || ''), err);

  console.log('\n11. Reset can switch level, which is the point of the picker');
  const u11 = newLearner('tt11@e.com', 'junior');
  await answers.finishOpenTasks(ws, db, u11, ['da-001']);
  check('set up: junior with graded work', ws.getEnrollment(u11).level === 'junior');

  ws.timeTravelReset(u11, { level: 'senior' });
  const e11 = ws.getEnrollment(u11);
  check('now enrolled as senior', e11.level === 'senior', e11.level);
  check('and the junior work is gone', !ws.getState(u11).taskBoard.rows.some((r) => r.status === 'graded'));

  // The whole reason a tester switches level is to see DIFFERENT work. If the catalogue
  // did not change, the switch looks like it worked and silently did not.
  ws.submitSkillTest(u11, Object.fromEntries(_st.QUESTIONS.map((q) => [q.id, q.answer])));
  const projects11 = [...new Set(ws.getState(u11).taskBoard.rows.map((r) => r.projectKey))];
  check('senior work is what arrives, not junior work',
    projects11.includes('reliability-review') && !projects11.includes('compensation-review'),
    projects11.join(','));

  console.log('\n12. And back down again, plus it refuses nonsense');
  ws.timeTravelReset(u11, { level: 'junior' });
  check('switched back to junior', ws.getEnrollment(u11).level === 'junior');
  err = null;
  try { ws.timeTravelReset(u11, { level: 'wizard' }); } catch (e) { err = e.message; }
  check('an unknown level is refused', /Unknown level/.test(err || ''), err);
  err = null;
  try { ws.timeTravelReset(u11, { role: 'astronaut' }); } catch (e) { err = e.message; }
  check('an unknown role is refused', /Unknown role/.test(err || ''), err);
  check('the learner is untouched by a refused switch', ws.getEnrollment(u11).level === 'junior');

  console.log('\n13. The panel offers what actually exists');
  const tt13 = ws.getState(u11).timeTravel;
  check('roles come from the catalogue', Array.isArray(tt13.roles) && tt13.roles.length >= 1,
    JSON.stringify(tt13.roles));
  check('all four levels are offered', tt13.levels.length === 4, JSON.stringify(tt13.levels));
  check('it reports where the learner is now', tt13.level === 'junior' && tt13.role === 'data_analyst');

  console.log('\n14. Marking a task done without doing it');
  const u14 = newLearner('tt14@e.com');
  const openRows = () => ws.getState(u14).taskBoard.rows.filter((r) => r.status !== 'graded' && !r.notYetOpen);
  const first = openRows()[0];
  check('set up: day 1 has open work', openRows().length === 6, String(openRows().length));

  ws.timeTravelCompleteTask(u14, first.id);
  const done14 = ws.getState(u14).taskBoard.rows.find((r) => r.id === first.id);
  check('the task is signed off', done14.status === 'graded', done14.status);
  check('it carries a plausible score, not 100', done14.score === 82, String(done14.score));
  // The wording moved from "not graded" to "not reviewed" when the product stopped
  // calling sign-off "grading" everywhere. What the assertion is actually about is that
  // the row does not pretend anybody looked at the work.
  check('and says plainly that nobody actually reviewed it',
    /not (graded|reviewed)/i.test(done14.feedback || '') && /stand-in/i.test(done14.feedback || ''),
    done14.feedback);
  check('the rest are untouched', openRows().length === 5, String(openRows().length));

  let err14 = null;
  try { ws.timeTravelCompleteTask(u14, first.id); } catch (e) { err14 = e.message; }
  check('doing it twice is refused', /already signed off/.test(err14 || ''), err14);
  err14 = null;
  try { ws.timeTravelCompleteTask(u14, 'not-a-task'); } catch (e) { err14 = e.message; }
  check('an unknown task is refused', /No such task/.test(err14 || ''), err14);

  console.log('\n15. Finishing the whole day, without touching tomorrow');
  const u15 = newLearner('tt15@e.com');
  const later15 = ws.getState(u15).taskBoard.rows.filter((r) => r.notYetOpen).length;
  check('set up: some work belongs to later days', later15 > 0, String(later15));

  const res15 = ws.timeTravelCompleteDay(u15);
  check('it reports how many it cleared', res15.completed === 6, String(res15.completed));
  const st15 = ws.getState(u15);
  check('nothing open is left today',
    st15.taskBoard.rows.filter((r) => r.status !== 'graded' && !r.notYetOpen).length === 0);
  // The day-by-day drip is itself worth testing, so clearing today must not clear tomorrow.
  check('later days are left alone', st15.taskBoard.rows.filter((r) => r.notYetOpen).length === later15,
    String(st15.taskBoard.rows.filter((r) => r.notYetOpen).length));

  ws.timeTravel(u15, { workingDays: 1 });
  const res15b = ws.timeTravelCompleteDay(u15);
  check('day 2 work then arrives and can be cleared too', res15b.completed === 6, String(res15b.completed));

  console.log('\n16. And the whole thing is gated');
  check('completing needs an enrolled learner',
    (() => { try { ws.timeTravelCompleteDay('nobody'); return false; } catch (e) { return /Not enrolled/.test(e.message); } })());

  console.log('\n17. A project that starts on any weekday still opens day 2');
  // This suite used to pass every day of the week except Friday, which is exactly when it
  // mattered: a Friday start puts day 2 on the Monday — three CALENDAR days ahead but one
  // WORKING day. The old code slid opens_at by calendar days, landing it on the Sunday, so
  // the card read "day 2 of 5" above a board with nothing new on it.
  //
  // Rather than trusting today's date, this walks a start through every weekday.
  const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  for (let back = 0; back < 7; back++) {
    const u = newLearner(`tt17-${back}@e.com`);
    const en = ws.getEnrollment(u);
    // Move the whole run back `back` days so it began on a different weekday, then ask for
    // the next day the way the button does.
    const shift = back * 24 * 60 * 60 * 1000;
    if (shift) {
      db.prepare('UPDATE sim_project_runs SET started_at = ?, due_at = ? WHERE enrollment_id = ?')
        .run(new Date(Date.parse(ws.getEnrollment(u).created_at) - shift).toISOString(),
             new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString(), en.id);
      db.prepare('UPDATE sim_enrollments SET created_at = ? WHERE id = ?')
        .run(new Date(Date.now() - shift).toISOString(), en.id);
    }
    const run = db.prepare('SELECT started_at FROM sim_project_runs WHERE enrollment_id = ?').get(en.id);
    const startedOn = WEEKDAY[new Date(run.started_at).getUTCDay()];
    if (startedOn === 'Saturday' || startedOn === 'Sunday') continue; // no week begins there

    // Moving the start back also moves the learner forward, so they are not on day 1 when
    // the button is pressed. What must hold is the same either way: the day advances by
    // exactly one, and work that was shut is now open.
    const s0 = ws.getState(u);
    const active0 = s0.projects.projects.find((x) => x.status === 'active');
    const dayBefore = active0.week.day;
    const lastDay = active0.week.totalDays;
    const before = s0.taskBoard.rows.filter((r) => !r.notYetOpen && r.status !== 'graded').length;

    // On the last day of the week there is no next day to move to, and timeTravel says so
    // rather than inventing a day 6. This used to assert that the call clamped silently
    // and STILL opened more work, which cannot both be true on a day where everything is
    // already open — so the suite crashed here on every run and nobody saw it, because
    // run-all.sh counted PASS lines and never looked at the exit code.
    if (dayBefore >= lastDay) {
      let msg = '';
      try { ws.timeTravel(u, { workingDays: 1 }); } catch (e) { msg = e.message; }
      check(`a ${startedOn} start is on the last day and is told so, not moved to day ${lastDay + 1}`,
        /A project week is \d+ days/.test(msg), msg || '(no error thrown)');
      continue;
    }

    ws.timeTravel(u, { workingDays: 1 });
    const s = ws.getState(u);
    const p = s.projects.projects.find((x) => x.status === 'active');
    const after = s.taskBoard.rows.filter((r) => !r.notYetOpen && r.status !== 'graded').length;
    check(`a ${startedOn} start advances a day AND opens work`,
      p.week.day === dayBefore + 1 && after > before,
      `day ${dayBefore} -> ${p.week.day} (wanted ${dayBefore + 1}), ${before} -> ${after} open`);
  }

  console.log(fails ? `\n${fails} FAILURE(S)` : '\nAll time-travel checks passed.');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
