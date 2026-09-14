// The cast is real, chat is chat, email is email, and the review reads like a person.
process.env.DATA_DIR = process.argv[2];
const path = require('node:path');
const ROOT = require('node:path').join(__dirname, '..');
const aiPath = require.resolve(path.join(ROOT, 'lib/ai.js'));
require.cache[aiPath] = { id: aiPath, filename: aiPath, loaded: true, exports: {
  isAvailable: () => false, callClaude: async () => null, extractJson: () => null } };

const { db, cryptoRandomId } = require(path.join(ROOT, 'lib/db.js'));
const ws = require(path.join(ROOT, 'lib/workspace.js'));
const _st = require(path.join(ROOT, 'lib/skilltest.js'));
const answers = require('./answers.js');
const pass = (uid) => ws.submitSkillTest(uid, Object.fromEntries(_st.QUESTIONS.map((q) => [q.id, q.answer])));

let fails = 0;
const check = (n, c, d) => { if (c) console.log('  PASS  ' + n); else { fails++; console.log('  FAIL  ' + n + (d ? '\n        ' + d : '')); } };

function newLearner(email) {
  const uid = cryptoRandomId(), iso = new Date().toISOString();
  db.prepare('INSERT INTO users (id,email,password_hash,password_salt,created_at) VALUES (?,?,?,?,?)').run(uid, email, 'x', 'y', iso);
  db.prepare('INSERT INTO profiles (user_id,name,created_at,updated_at) VALUES (?,?,?,?)').run(uid, 'Priya Sharma', iso, iso);
  ws.startEnrollment(uid, { level: 'junior', scheduleType: 'weekday', scheduleDays: null });
  pass(uid);
  return uid;
}

(async () => {
  console.log('1. Everyone named on a task is someone you can reach');
  const u1 = newLearner('tm1@e.com');
  const team = ws.getState(u1).team;
  check('the team is more than three people', team.length >= 9, String(team.length));
  for (const name of ['Rahul Verma', 'Sneha Joshi', 'Arjun Rao', 'Meera Pillai', 'Diya Chandra', 'Aarav Bose']) {
    check(`${name} is in the team`, team.some((m) => m.name === name), JSON.stringify(team.map((m) => m.name)));
  }
  check('each colleague says what they help with', team.filter((m) => !m.core).every((m) => m.helpsWith.length > 0));
  check('everyone has a distinct avatar', new Set(team.map((m) => m.avatarUrl)).size === team.length);
  check('only the line manager grades', team.filter((m) => m.grades).length === 1);

  console.log('\n2. A colleague answers about their patch and redirects outside it');
  const off = await ws.sendLearnerMessage(u1, 'data_engineer', 'Can you help? I am stuck on the writing for the leadership summary.');
  const r1 = off.messages[off.messages.length - 1].body;
  check('they send you to the right person, by name', /Meera/.test(r1), r1);
  check('and say why it is not theirs', /area|comms/i.test(r1), r1);
  console.log('    ' + r1);

  const on = await ws.sendLearnerMessage(u1, 'data_engineer', 'I am stuck on the sql joins, any idea?');
  check('on their own patch they engage', /tables|column/i.test(on.messages[on.messages.length - 1].body));

  console.log('\n3. Talking to someone makes them a friend, and a friend gives a real hint');
  const before = ws.getState(u1).team.find((m) => m.name === 'Rahul Verma');
  check('they start as a stranger', before.friend === false && before.messagesToFriend === 1, JSON.stringify({ f: before.friend, n: before.messagesToFriend }));
  const third = await ws.sendLearnerMessage(u1, 'data_engineer', 'Still stuck on the sql — how do I handle the nulls?');
  const after = ws.getState(u1).team.find((m) => m.name === 'Rahul Verma');
  check('three messages in, they know you', after.friend === true);
  check('and they say so', third.messages.some((m) => /good to actually know you/.test(m.body)));

  // Now a friend, ask about the open task.
  const helped = await ws.sendLearnerMessage(u1, 'data_engineer', 'I am stuck on the sql, any idea what I am missing?');
  const hint = helped.messages[helped.messages.length - 1].body;
  check('a friend gives a hint about the task actually open', hint.length > 60, hint);
  console.log('    ' + hint.split('\n')[0]);

  console.log('\n4. The hint is a pointer, never the answer');
  const src = require('node:fs').readFileSync(path.join(ROOT, 'lib/workspace.js'), 'utf8');
  const hints = [...src.matchAll(/\n    hint: "([^"]+)"/g)].map((m) => m[1]);
  check('every task has one', hints.length >= 26, String(hints.length));
  check('none of them is a query', hints.every((h) => !/SELECT .*FROM/i.test(h)), hints.filter((h) => /SELECT .*FROM/i.test(h)).join(' | '));

  console.log('\n5. Chat stays out of the inbox');
  const st = ws.getState(u1);
  const chatBodies = st.messages.filter((m) => (m.thread_archetype || m.sender_archetype) === 'data_engineer').map((m) => m.body);
  check('the chat happened', chatBodies.length >= 8, String(chatBodies.length));
  const inboxText = JSON.stringify(st.inbox);
  check('none of it is in the inbox', !chatBodies.some((b) => inboxText.includes(b.slice(0, 40))), 'chat leaked into email');
  check('the inbox still has real correspondence', st.inbox.threads.length > 0, String(st.inbox.threads.length));
  check('and every inbox thread has a subject', st.inbox.threads.every((t) => t.subject && t.subject.length > 0));

  console.log('\n6. Asha picks the submission up before she questions it');
  const u2 = newLearner('tm2@e.com');
  const e2 = ws.getEnrollment(u2);
  const t2 = db.prepare("SELECT * FROM sim_tasks WHERE enrollment_id=? AND task_key='da-001'").get(e2.id);
  await ws.submitTask(u2, t2.id, answers.ANSWERS['da-001']);
  const thread = db.prepare("SELECT * FROM sim_messages WHERE task_id=? AND sender_archetype='line_manager' ORDER BY created_at ASC").all(t2.id);
  check('she acknowledges receipt first', /picking it up now/.test(thread[0].body), thread[0] && thread[0].body);
  check('she names the task she received', /Department salary breakdown/.test(thread[0].body));
  check('then comes back having read it', /^Right, read it\./.test(thread[1].body), thread[1] && thread[1].body.slice(0, 60));
  check('the status is in review, not graded', db.prepare('SELECT status FROM sim_tasks WHERE id=?').get(t2.id).status === 'in_review');
  check('and the score is still withheld', ws.getState(u2).taskBoard.rows.find((r) => r.id === t2.id).score === null);
  console.log('    ' + thread[0].body);
  console.log('    ' + thread[1].body.slice(0, 100));

  console.log('\n7. Sign-off still completes it');
  await ws.answerReview(u2, t2.id, answers.REVIEW_REPLY);
  check('graded after she is satisfied', db.prepare('SELECT status FROM sim_tasks WHERE id=?').get(t2.id).status === 'graded');

  console.log(fails ? `\n${fails} FAILURE(S)` : '\nAll team/chat checks passed.');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
