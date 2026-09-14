// The verification gate: a correct answer must survive Asha's questioning before it counts.
process.env.DATA_DIR = process.argv[2];
const path = require('node:path');
const ROOT = require('node:path').join(__dirname, '..');

let aiOn = false, calls = [];
let judgeVerdict = { accept: true, reply: 'Good — signed off.' };
const aiPath = require.resolve(path.join(ROOT, 'lib/ai.js'));
require.cache[aiPath] = { id: aiPath, filename: aiPath, loaded: true, exports: {
  isAvailable: () => aiOn,
  callClaude: async (a) => {
    calls.push(a);
    if (/deciding whether/.test(a.system)) return JSON.stringify(judgeVerdict);
    if (/Ask exactly ONE question/.test(a.system)) return 'You filtered on exit_year IS NULL — why does that matter for what Vikram asked?';
    return JSON.stringify({ score: 90, feedback: 'Correct.', skills: { sql: 90 } });
  },
  extractJson: (t) => { try { return JSON.parse(t); } catch { return null; } },
} };

const { db, cryptoRandomId } = require(path.join(ROOT, 'lib/db.js'));
const ws = require(path.join(ROOT, 'lib/workspace.js'));
const answers = require('./answers.js');
// Finishing a project means finishing whatever tasks it has today — see answers.js.
const finishAll = (uid, only) => answers.finishOpenTasks(ws, db, uid, only);

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

const CORRECT = 'SELECT d.name AS department, AVG(e.salary) AS avg_salary FROM employees e JOIN departments d ON d.id = e.department_id WHERE e.exit_year IS NULL GROUP BY d.name ORDER BY avg_salary DESC';
const FORGOT_LEAVERS = 'SELECT d.name AS department, AVG(e.salary) AS avg_salary FROM employees e JOIN departments d ON d.id = e.department_id GROUP BY d.name ORDER BY avg_salary DESC';

function newLearner(email) {
  const uid = cryptoRandomId(), iso = new Date().toISOString();
  db.prepare('INSERT INTO users (id,email,password_hash,password_salt,created_at) VALUES (?,?,?,?,?)').run(uid, email, 'x', 'y', iso);
  db.prepare('INSERT INTO profiles (user_id,name,created_at,updated_at) VALUES (?,?,?,?)').run(uid, 'Priya Sharma', iso, iso);
  ws.startEnrollment(uid, { level: 'junior', scheduleType: 'weekday', scheduleDays: null });
  passSkillTest(uid);
  return uid;
}
// The first SQL task specifically: day one now opens with a scoping judgement, and this
// suite is about the grading-and-sign-off flow for a query.
const firstTask = (uid) => ws.getState(uid).tasks.find((t) => t.task_key === 'da-001');

(async () => {
  console.log('1. A correct answer does NOT complete the task on its own');
  aiOn = false;
  const u1 = newLearner('gate1@e.com');
  const t1 = firstTask(u1);
  const sub = await ws.submitTask(u1, t1.id, CORRECT);
  check('submit reports it is in review', sub.inReview === true, JSON.stringify(Object.keys(sub)));
  check('Asha asked a question', Boolean(sub.question), sub.question);
  console.log('    Asha:', sub.question);

  let row = db.prepare('SELECT * FROM sim_tasks WHERE id=?').get(t1.id);
  check('status is in_review, NOT graded', row.status === 'in_review', row.status);
  check('review is pending', row.review_state === 'pending', row.review_state);
  check('the score exists internally', row.score >= 80, String(row.score));

  const board = ws.getState(u1).taskBoard.rows.find((r) => r.id === t1.id);
  check('the score is HIDDEN from the learner', board.score === null, String(board.score));
  check('the question is surfaced to the UI', Boolean(board.reviewQuestion));
  check('two rounds are available', board.reviewRoundsLeft === 2, String(board.reviewRoundsLeft));

  const proj = ws.getState(u1).projects.projects.find((p) => p.key === 'compensation-review');
  check('the project does NOT count it as complete', proj.status !== 'completed', proj.status);

  console.log('\n2. The offline question is about their ACTUAL code');
  const u2 = newLearner('gate2@e.com');
  const t2 = firstTask(u2);
  const sub2 = await ws.submitTask(u2, t2.id, FORGOT_LEAVERS);
  console.log('    Asha:', sub2.question);
  check('it names the specific mistake they made', /left|leaver|ever worked here/i.test(sub2.question), sub2.question);
  check('it does not give away the answer', !/exit_year IS NULL/i.test(sub2.question), sub2.question);

  console.log('\n3. Weak work is sent back rather than argued over');
  // The rule the product now follows: if the manager is not satisfied, the task REOPENS.
  // Going three rounds of conversation about a query that forgot its filter teaches the
  // learner to defend bad work, which is the opposite of the intention.
  const r1 = await ws.answerReview(u2, t2.id, 'it groups by department');
  check('vague answer rejected', r1.accepted === false, JSON.stringify(r1.reply));
  check('and the task comes back to be redone', r1.reopened === true, JSON.stringify(r1));
  const backOpen = db.prepare('SELECT status, review_state FROM sim_tasks WHERE id = ?').get(t2.id);
  check('it is open again, not parked', backOpen.status === 'assigned', JSON.stringify(backOpen));
  check('and marked as a redo so the board can say so', backOpen.review_state === 'redo', backOpen.review_state);
  console.log('    Asha:', r1.reply);

  // The reason has to survive the page reload that follows. A learner who comes back
  // tomorrow should see why the card is open again without hunting through the chat.
  const backRow = ws.getState(u2).taskBoard.rows.find((r) => r.id === t2.id);
  check('the board flags it as sent back', backRow.sentBack === 'redo', JSON.stringify(backRow.sentBack));
  check('and carries the reason, not just the flag',
    typeof backRow.sentBackNote === 'string' && backRow.sentBackNote.length > 40,
    JSON.stringify(backRow.sentBackNote));
  check('the reason is the one she actually sent',
    (backRow.sentBackNote || '').includes('another go'), backRow.sentBackNote);
  check('and the task is still workable, not just annotated',
    backRow.status === 'assigned' && backRow.notYetOpen !== true, JSON.stringify(backRow.status));

  console.log('\n3b. Redo it properly and it goes through');
  // The whole point of sending it back: the learner fixes the WORK, not the argument.
  const again = await ws.submitTask(u2, t2.id, CORRECT);
  check('the corrected query is accepted for review', Boolean(again.question), JSON.stringify(again).slice(0, 80));
  const r2 = await ws.answerReview(u2, t2.id,
    'I excluded leavers because their old salaries would drag the department average away from what current staff actually earn.');
  check('reasoned answer accepted', r2.accepted === true, JSON.stringify(r2.reply));
  check('the score is revealed on acceptance', r2.score >= 40, String(r2.score));
  console.log('    Asha:', r2.reply);

  const row2 = db.prepare('SELECT * FROM sim_tasks WHERE id=?').get(t2.id);
  check('status is now graded', row2.status === 'graded', row2.status);
  check('review_state is accepted', row2.review_state === 'accepted', row2.review_state);
  check('graded_at was set on acceptance', Boolean(row2.graded_at));

  console.log('\n4. Good work, but you cannot explain it — parked rather than reopened');
  // Parking still exists, and now it means something more precise. Weak work comes BACK to
  // be redone; work that is right but cannot be justified is parked, because redoing a
  // correct query would teach nothing. The two paths are different on purpose.
  const u3 = newLearner('gate3@e.com');
  const t3 = firstTask(u3);
  await ws.submitTask(u3, t3.id, CORRECT);
  await ws.answerReview(u3, t3.id, 'idk');
  const p = await ws.answerReview(u3, t3.id, 'no idea');
  check('parked after 2 rounds', p.parked === true, JSON.stringify(p));
  const row3 = db.prepare('SELECT * FROM sim_tasks WHERE id=?').get(t3.id);
  check('status is parked', row3.status === 'parked', row3.status);
  check('a parked task is NOT counted as graded', row3.status !== 'graded');
  const parkMsg = db.prepare("SELECT body FROM sim_messages WHERE task_id=? AND body LIKE '%park%' ORDER BY created_at DESC LIMIT 1").get(t3.id);
  check('Asha tells them to move on', Boolean(parkMsg), parkMsg && parkMsg.body);
  let reAnswered = false;
  try { await ws.answerReview(u3, t3.id, 'trying again'); reAnswered = true; } catch (e) {}
  check('a parked task stops accepting answers', !reAnswered);

  console.log('\n5. With AI on, the question is built from their real submission');
  aiOn = true; calls = [];
  const u4 = newLearner('gate4@e.com');
  const t4 = firstTask(u4);
  await ws.submitTask(u4, t4.id, CORRECT);
  const askCall = calls.find((c) => /Ask exactly ONE question/.test(c.system));
  check('a question call was made', Boolean(askCall));
  check('their actual code was sent to Asha', askCall.prompt.includes('exit_year IS NULL'));
  check('the correct answer was sent for comparison', /correct answer is/.test(askCall.prompt));
  check('she is told whether it matched', /MATCHES|DOES NOT MATCH/.test(askCall.prompt));
  check('she is told not to ask a generic question', /would fit any submission is a failed question/.test(askCall.system));

  judgeVerdict = { accept: false, reply: 'Not quite — why that filter specifically?' };
  const j1 = await ws.answerReview(u4, t4.id, 'because of the filter');
  check('AI rejection is honoured', j1.accepted === false);
  const judgeCall = calls.find((c) => /deciding whether/.test(c.system));
  check('the judge sees her own question', judgeCall.prompt.includes('exit_year IS NULL — why does that matter'));
  check('the judge sees their answer', judgeCall.prompt.includes('because of the filter'));

  judgeVerdict = { accept: true, reply: 'That works. Signed off.' };
  const j2 = await ws.answerReview(u4, t4.id, 'leavers would skew the average away from current staff');
  check('AI acceptance completes it', j2.accepted === true);
  check('final round told her it was the last attempt',
    calls.filter((c) => /deciding whether/.test(c.system)).pop().prompt.includes('final attempt'));

  console.log('\n6. Existing accounts are not broken');
  const u5 = newLearner('gate5@e.com');
  const t5 = firstTask(u5);
  // A row from before the gate shipped: graded, with review_state NULL.
  // Every task in the project, since it now carries a presentation task alongside the
  // query — the point of the check is the NULL review_state, not the task count.
  db.prepare("UPDATE sim_tasks SET status='graded', score=88, graded_at=?, review_state=NULL WHERE enrollment_id=(SELECT enrollment_id FROM sim_tasks WHERE id=?)")
    .run(new Date().toISOString(), t5.id);
  const st5 = ws.getState(u5);
  const b5 = st5.taskBoard.rows.find((r) => r.id === t5.id);
  check('a legacy graded task still shows its score', b5.score === 88, String(b5.score));
  const p5 = st5.projects.projects.find((x) => x.key === 'compensation-review');
  check('a legacy graded task still completes its project', p5.status === 'completed', p5.status);

  console.log(fails ? `\n${fails} FAILURE(S)` : '\nAll gate checks passed.');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
