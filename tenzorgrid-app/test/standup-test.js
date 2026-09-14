// The two-minute stand-up: scripted from the learner's real state, recorded, answered.
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

const _st = require(path.join(ROOT, 'lib/skilltest.js'));
const passSkillTest = (uid) => ws.submitSkillTest(uid, Object.fromEntries(_st.QUESTIONS.map((q) => [q.id, q.answer])));

let fails = 0;
const check = (n, c, d) => { if (c) console.log('  PASS  ' + n); else { fails++; console.log('  FAIL  ' + n + (d ? '\n        ' + d : '')); } };

const REF = 'SELECT d.name AS department, AVG(e.salary) AS avg_salary FROM employees e JOIN departments d ON d.id = e.department_id WHERE e.exit_year IS NULL GROUP BY d.name ORDER BY avg_salary DESC';

function newLearner(email, name) {
  const uid = cryptoRandomId(), iso = new Date().toISOString();
  db.prepare('INSERT INTO users (id,email,password_hash,password_salt,created_at) VALUES (?,?,?,?,?)').run(uid, email, 'x', 'y', iso);
  db.prepare('INSERT INTO profiles (user_id,name,created_at,updated_at) VALUES (?,?,?,?)').run(uid, name, iso, iso);
  ws.startEnrollment(uid, { level: 'junior', scheduleType: 'weekday', scheduleDays: null });
  passSkillTest(uid);
  return uid;
}
const enrOf = (uid) => ws.getEnrollment(uid);

(async () => {
  console.log('1. Asha asks about the learner\'s actual work, not a form');
  const u1 = newLearner('su1@e.com', 'Priya Sharma');
  const s1 = ws.getState(u1).standup;
  check('a stand-up is waiting', s1 && s1.done === false, JSON.stringify(s1 && s1.done));
  check('three questions', s1.questions.length === 3, String(s1.questions.length));
  check('she greets them by name', /Priya/.test(s1.greeting), s1.greeting);
  const today = s1.questions.find((q) => q.id === 'today');
  const openTitles = ws.getState(u1).taskBoard.rows.filter((r) => r.status !== 'graded' && !r.notYetOpen).map((r) => r.title);
  check('she names a task actually open against them',
    openTitles.some((t) => today.text.includes(t)), today.text + ' | open: ' + JSON.stringify(openTitles));
  console.log('    ' + today.text);
  const blockers = s1.questions.find((q) => q.id === 'blockers');
  check('with nothing overdue she asks plainly', !/past its date/.test(blockers.text), blockers.text);

  console.log('\n2. Answering it records the exchange in the thread');
  const r1 = await ws.submitStandup(u1, { done: 'Read the brief and explored the tables.', today: 'Writing the department query.', blockers: 'Nothing' }, true);
  check('Asha replies', Boolean(r1.reply), r1.reply);
  check('no blocker was raised', r1.raisedBlocker === false);
  const mine = db.prepare("SELECT * FROM sim_messages WHERE enrollment_id=? AND sender_archetype='learner' AND subject LIKE 'Stand-up%'").get(enrOf(u1).id);
  check('the learner\'s own words are the record', /Writing the department query/.test(mine.body), mine.body.slice(0, 60));
  const hers = db.prepare("SELECT * FROM sim_messages WHERE enrollment_id=? AND sender_archetype='line_manager' AND subject LIKE 'Re: Stand-up%'").get(enrOf(u1).id);
  check('her reply is in the same thread', Boolean(hers) && hers.thread_archetype === 'line_manager');
  check('it is marked done for today', ws.getState(u1).standup.done === true);
  check('whether it was spoken is recorded',
    db.prepare('SELECT spoken FROM sim_standups WHERE enrollment_id=?').get(enrOf(u1).id).spoken === 1);

  console.log('\n3. It happens once a day');
  let twice = false;
  try { await ws.submitStandup(u1, { done: 'x', today: 'y', blockers: 'z' }); twice = true; } catch (e) {}
  check('a second stand-up the same day is refused', !twice);
  const empty = await (async () => { try { await ws.submitStandup(newLearner('su2@e.com', 'A B'), { done: '', today: '', blockers: '' }); return 'accepted'; } catch (e) { return e.message; } })();
  check('an empty stand-up is refused', /Say something/.test(empty), empty);

  console.log('\n4. A raised blocker is treated as a blocker');
  const u3 = newLearner('su3@e.com', 'Arun Kumar');
  const r3 = await ws.submitStandup(u3, { done: 'Not much', today: 'The salary query', blockers: "I can't work out how to exclude the leavers." });
  check('the blocker is recognised', r3.raisedBlocker === true);
  check('she does not thank them and move on', /noted on the blocker/i.test(r3.reply), r3.reply);
  console.log('    ' + r3.reply.slice(0, 110));

  const u4 = newLearner('su4@e.com', 'Kavya Nair');
  const r4 = await ws.submitStandup(u4, { done: 'Finished the brief', today: 'The query', blockers: 'nothing really' });
  check('"nothing really" is not treated as a blocker', r4.raisedBlocker === false, r4.reply.slice(0, 60));

  console.log('\n5. She knows when the learner is late');
  const u5 = newLearner('su5@e.com', 'Sanjay Rao');
  db.prepare("UPDATE sim_project_runs SET due_at = ? WHERE enrollment_id = ?")
    .run(new Date(Date.now() - 2 * 86400000).toISOString(), enrOf(u5).id);
  const s5 = ws.getState(u5).standup;
  const b5 = s5.questions.find((q) => q.id === 'blockers');
  check('she names what is past its date', /Q1 Compensation Review/.test(b5.text) && /past its date/.test(b5.text), b5.text);
  console.log('    ' + b5.text);

  console.log('\n6. She refers to work that actually got signed off');
  const u6 = newLearner('su6@e.com', 'Meera Das');
  const t6 = ws.getState(u6).tasks.find((t) => t.task_key === 'da-001');
  await ws.submitTask(u6, t6.id, REF);
  await ws.answerReview(u6, t6.id, 'I excluded leavers because their old salaries would drag the department average away from what current staff actually earn.');
  const s6 = ws.getState(u6).standup;
  const d6 = s6.questions.find((q) => q.id === 'done');
  check('she names the task that got signed off', /Department salary breakdown/.test(d6.text), d6.text);
  console.log('    ' + d6.text);

  console.log('\n7. The stand-up does not eat the daily AI allowance');
  const u7 = newLearner('su7@e.com', 'Ravi Menon');
  const before = ws.getState(u7).team.messagesRemaining;
  await ws.submitStandup(u7, { done: 'a', today: 'b', blockers: 'no' });
  const after = ws.getState(u7).team.messagesRemaining;
  check('the message allowance is untouched', before === after, `${before} -> ${after}`);

  console.log(fails ? `\n${fails} FAILURE(S)` : '\nAll stand-up checks passed.');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
