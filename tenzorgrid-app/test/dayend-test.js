// The day ends, is congratulated, and stops. Mail arrives through it rather than at nine.
process.env.DATA_DIR = process.argv[2];
process.env.TIME_TRAVEL = '1';
const path = require('node:path');
const ROOT = require('node:path').join(__dirname, '..');
const aiPath = require.resolve(path.join(ROOT, 'lib/ai.js'));
require.cache[aiPath] = { id: aiPath, filename: aiPath, loaded: true, exports: {
  isAvailable: () => false, callClaude: async () => null, extractJson: () => null } };
const { db, cryptoRandomId } = require(path.join(ROOT, 'lib/db.js'));
const ws = require(path.join(ROOT, 'lib/workspace.js'));
const st = require(path.join(ROOT, 'lib/skilltest.js'));
const items = require(path.join(ROOT, 'lib/dayitems.js'));
const mail = require(path.join(ROOT, 'lib/ambientmail.js'));

let fails = 0;
const check = (n, c, d) => { if (c) console.log('  PASS  ' + n); else { fails++; console.log('  FAIL  ' + n + (d ? '\n        ' + d : '')); } };
function learner(email) {
  const uid = cryptoRandomId(), iso = new Date().toISOString();
  db.prepare('INSERT INTO users (id,email,password_hash,password_salt,created_at) VALUES (?,?,?,?,?)').run(uid, email, 'x', 'y', iso);
  db.prepare('INSERT INTO profiles (user_id,name,created_at,updated_at) VALUES (?,?,?,?)').run(uid, 'Manukumar R', iso, iso);
  ws.startEnrollment(uid, { level: 'junior', scheduleType: 'weekday' });
  ws.submitSkillTest(uid, Object.fromEntries(st.QUESTIONS.map((q) => [q.id, q.answer])));
  return uid;
}
const emails = (s) => s.messages.filter((m) => m.sender_archetype !== 'learner' && (m.subject || '').trim());

(async () => {
  console.log('1. The morning is not a wall of mail');
  const u = learner('de1@e.com');
  let s = ws.getState(u);
  console.log(`    ${emails(s).length} emails waiting when you sit down`);
  // Five: the brief, Asha's primer, the kickoff invite, one company notice and one status
  // request. That is a believable Monday morning. The thing being tested is that it is not
  // the day's whole post — the rest arrives while the work is being done.
  check('a believable morning, not the whole day at once',
    emails(s).length >= 1 && emails(s).length <= 6, String(emails(s).length));
  check('one activity has landed, not both', s.activities.filter((a) => a.day === 1).length === 1,
    String(s.activities.filter((a) => a.day === 1).length));
  check('but the day still says it needs two', s.day.activities.total === 2, JSON.stringify(s.day.activities));

  console.log('\n2. More arrives as the work gets done');
  const open = s.taskBoard.rows.filter((r) => !r.notYetOpen && r.status !== 'graded');
  ws.timeTravelCompleteTask(u, open[0].id);
  ws.timeTravelCompleteTask(u, open[1].id);
  s = ws.getState(u);
  console.log(`    ${emails(s).length} emails after two tasks`);
  check('the inbox grew', emails(s).length >= 3, String(emails(s).length));
  check('the second activity has turned up now', s.activities.filter((a) => a.day === 1).length === 2,
    String(s.activities.filter((a) => a.day === 1).length));
  check('and so has the second situation',
    s.situations.filter((x) => x.day === 1 && !x.deskMail).length === 2,
    String(s.situations.filter((x) => x.day === 1 && !x.deskMail).length));

  console.log('\n3. What is still owed today, in words');
  check('the day says what is pending', Array.isArray(s.day.pending) && s.day.pending.length > 0,
    JSON.stringify(s.day.pending));
  check('and it reads like a sentence, not a counter', /task|activit|message/.test(s.day.pending.join(' ')),
    s.day.pending.join(', '));
  check('it is not closeable yet', s.day.readyToClose === false);
  check('closing it now is refused',
    (() => { try { ws.closeDay(u); return false; } catch (e) { return /still have/.test(e.message); } })());

  console.log('\n4. The timesheet has somewhere to go');
  for (const r of ws.getState(u).taskBoard.rows.filter((x) => !x.notYetOpen && x.status !== 'graded')) {
    ws.timeTravelCompleteTask(u, r.id);
  }
  s = ws.getState(u);
  const chore = s.chores.find((c) => c.day === 1);
  check('a chore arrived with a form on it', Boolean(chore && chore.action && chore.action.fields.length >= 1),
    JSON.stringify(s.chores.map((c) => c.key)));
  check('and the project is named in its options',
    chore.action.fields.some((f) => (f.options || []).some((o) => /Compensation/i.test(o))),
    JSON.stringify(chore.action.fields.map((f) => f.options)));
  check('a bad number is refused',
    (() => { try { ws.completeChore(u, chore.key, { hours: 99, charged: 'Training' }); return false; } catch (e) { return /between/.test(e.message); } })());
  const cr = ws.completeChore(u, chore.key, { hours: 7.5, charged: 'Training' });
  check('a good one is accepted', cr.done === true);
  check('and the receipt quotes it back', /7\.5/.test(cr.confirm), cr.confirm);
  check('doing it twice is refused',
    (() => { try { ws.completeChore(u, chore.key, { hours: 7, charged: 'Training' }); return false; } catch (e) { return /already/.test(e.message); } })());

  console.log('\n5. Finishing everything, and being told so');
  const finishRest = (uid) => {
    const state = ws.getState(uid);
    for (const a of state.activities.filter((x) => x.status !== 'done')) {
      const ad = items.activitiesFor('compensation-review').find((z) => z.key === a.key);
      ws.completeActivity(uid, a.key, ad.check.kind === 'choice' ? ad.check.options.find((o) => o.correct).key
        : ad.check.kind === 'answer' ? 'I filtered to current staff with exit_year IS NULL, grouped by department, and used a left join so teams with no rows show as zero rather than disappearing. Next time I would check the row counts sooner.'
        : '');
    }
    for (const x of state.situations.filter((z) => !z.handledAs)) {
      const sd = items.situationsFor('compensation-review').find((z) => z.key === x.key);
      if (!sd || sd.needsReply) {
        ws.handleSituation(uid, x.key, 'reply',
          'Green and on track — I am on the departmental averages now and expect to finish Friday. Nothing is blocked and nothing is outstanding with anyone else. Current staff only, leavers excluded, and I will confirm the headcount against yours today. The headline is a gap of about a fifth; confident on the direction, less on the size because a few cells are thin, so I would carry that forward. There is no region column, so hire year is what I can give you. Yes, four works.');
      } else { ws.handleSituation(uid, x.key, 'archive', ''); }
    }
    for (const r of ws.getState(uid).taskBoard.rows.filter((x) => !x.notYetOpen && x.status !== 'graded')) {
      ws.timeTravelCompleteTask(uid, r.id);
    }
  };
  finishRest(u);
  s = ws.getState(u);
  check('the day is complete', s.day.complete === true, JSON.stringify(s.day));
  check('and offers to wrap up', s.day.readyToClose === true);
  check('but has NOT rolled into tomorrow', s.day.unlocked === 1, String(s.day.unlocked));
  check('nothing is pending', s.day.pending.length === 0, JSON.stringify(s.day.pending));

  const closed = ws.closeDay(u);
  check('closing works', closed.closed === true);
  check('Asha says well done', /that's Monday done/i.test(closed.message), closed.message.slice(0, 80));
  check('and tells them to stop', /pick it up tomorrow|shut the laptop/i.test(closed.message));
  const wrap = emails(ws.getState(u)).find((m) => /you're done/i.test(m.subject || ''));
  check('it is in the inbox too', Boolean(wrap), emails(ws.getState(u)).slice(-3).map((m) => m.subject).join(' | '));

  console.log('\n6. Tomorrow does not start by itself');
  s = ws.getState(u);
  check('still on day 1 after closing', s.day.unlocked === 1, String(s.day.unlocked));
  check('the day reads as closed', s.day.closed === true);
  check('and names what comes next', s.day.nextDayName === 'Tuesday', String(s.day.nextDayName));
  check('no day-2 tasks have opened',
    ws.getState(u).taskBoard.rows.filter((r) => !r.notYetOpen && r.status !== 'graded').length === 0,
    String(ws.getState(u).taskBoard.rows.filter((r) => !r.notYetOpen && r.status !== 'graded').length));
  check('closing twice is refused',
    (() => { try { ws.closeDay(u); return false; } catch (e) { return /already/.test(e.message); } })());
  check("the full day's post was released on the way out",
    (() => {
      const enr = db.prepare('SELECT * FROM sim_enrollments WHERE user_id = ?').get(u);
      const run = db.prepare('SELECT * FROM sim_project_runs WHERE enrollment_id = ? ORDER BY started_at DESC LIMIT 1').get(enr.id);
      const ambient = db.prepare('SELECT COUNT(*) n FROM sim_ambient_mail WHERE enrollment_id = ? AND day_index = 1').get(enr.id).n;
      void run;
      const acts = items.activitiesFor('compensation-review').filter((a) => a.day === 1 && a.via === 'email').length;
      const sits = items.situationsFor('compensation-review').filter((x) => x.day === 1 && x.via === 'email').length;
      return ambient + mail.deskFor(1).length + mail.choresFor(1).length + acts + sits >= 10;
    })());

  const started = ws.startNextDay(u);
  check('starting tomorrow works', started.day === 2, String(started.day));
  s = ws.getState(u);
  check('it is day 2 now', s.day.unlocked === 2 && s.day.dayName === 'Tuesday', JSON.stringify([s.day.unlocked, s.day.dayName]));
  check('the same shape repeats', s.day.tasks.total === 6 && s.day.activities.total === 2 && s.day.situations.total === 2,
    JSON.stringify([s.day.tasks, s.day.activities, s.day.situations]));
  check('day 2 opens with a handful of mail, not a wall',
    s.activities.filter((a) => a.day === 2).length === 1,
    String(s.activities.filter((a) => a.day === 2).length));
  check('and the day is open again', s.day.closed === false && s.day.readyToClose === false);

  console.log('\n7. A project that is not written cannot be started');
  const projects = ws.getState(u).projects.projects;
  // Project 2 is authored in full now, so it is merely locked behind project 1. Project 3
  // is still a stub, and that is what the gate exists for.
  const p2 = projects.find((p) => p.key === 'headcount-trends');
  check('the finished project is locked, not broken', p2.status === 'locked', p2.status);
  check('and it is genuinely complete content', p2.authoring === null, JSON.stringify(p2.authoring));
  // Every project in the catalogue is authored now, at both levels, so there is no stub
  // left to demonstrate the gate on. That is the right outcome and it is what to assert:
  // nothing reports itself as still being written, and a locked project is locked for the
  // ladder reason rather than the authoring one — which is what proves the branch order
  // in getProjects is still right.
  check('no junior project is a stub', projects.every((p) => p.authoring === null),
    JSON.stringify(projects.map((p) => [p.key, p.authoring])));
  check('and none of them reads as being written', projects.every((p) => p.status !== 'writing'),
    JSON.stringify(projects.map((p) => [p.key, p.status])));
  const locked = projects.find((p) => p.status === 'locked');
  check('a locked project is locked by the ladder, not by authoring',
    Boolean(locked) && /Complete \d+ project/.test(locked.requirement || ''),
    locked && locked.requirement);

  db.prepare("UPDATE sim_enrollments SET level = 'senior' WHERE user_id = ?").run(u);
  const seniorProjects = ws.getState(u).projects.projects;
  check('the senior board is authored too', seniorProjects.every((p) => p.authoring === null),
    JSON.stringify(seniorProjects.map((p) => [p.key, p.authoring])));
  check('starting an unknown project is still refused',
    (() => { try { ws.startProject(u, 'no-such-project'); return false; } catch (e) { return /Unknown project/.test(e.message); } })());
  db.prepare("UPDATE sim_enrollments SET level = 'junior' WHERE user_id = ?").run(u);

  check('project 1 is not affected', projects.find((p) => p.key === 'compensation-review').status === 'active');

  // The Recent activity feed on the Tasks page. Every event has to be a real recorded
  // timestamp — a submission, a sign-off, or a colleague writing about a task — because
  // the design it came from also asked for "you created a task", which a learner cannot
  // do and which would therefore have to be invented.
  const board = ws.getState(u).taskBoard;
  check('the task board carries an activity feed', Array.isArray(board.activity));
  const kinds = new Set(board.activity.map((e) => e.kind));
  check('and only reports things that actually happen',
    [...kinds].every((k) => ['signoff', 'submitted', 'message'].includes(k)), [...kinds].join(','));
  check('every event carries a real timestamp and a task title',
    board.activity.every((e) => e.at && !Number.isNaN(Date.parse(e.at)) && e.title),
    JSON.stringify(board.activity.slice(0, 2)));
  check('newest first', board.activity.every((e, i, a) => i === 0 || a[i - 1].at >= e.at));
  const graded = board.rows.filter((r) => r.status === 'graded');
  // The feed is the twelve newest events, so a given task need not be in it. What must
  // hold is that nothing is invented: every sign-off named is a task that really is
  // signed off, and every event points at a task the learner actually has.
  const titles = new Set(board.rows.map((r) => r.title));
  const gradedTitles = new Set(graded.map((r) => r.title));
  check('every event points at a real task', board.activity.every((e) => titles.has(e.title)),
    board.activity.filter((e) => !titles.has(e.title)).map((e) => e.title).join(','));
  check('every sign-off in the feed is a task that really is signed off',
    board.activity.filter((e) => e.kind === 'signoff').every((e) => gradedTitles.has(e.title)),
    board.activity.filter((e) => e.kind === 'signoff' && !gradedTitles.has(e.title)).map((e) => e.title).join(','));
  check('sign-offs carry the score the learner was given',
    board.activity.filter((e) => e.kind === 'signoff').every((e) => e.score === null || Number.isInteger(e.score)));
  // Priorities: the definitions use five spellings and every one has to render a label,
  // or a task comes back with an unlabelled pill on its card and in the workbench.
  check('every task on the board has a priority label',
    board.rows.every((r) => Boolean(r.priorityLabel)),
    board.rows.filter((r) => !r.priorityLabel).map((r) => `${r.title}:${r.priority}`).join(','));

  console.log(fails ? `\n${fails} FAILURE(S)` : '\nAll day-end checks passed.');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
