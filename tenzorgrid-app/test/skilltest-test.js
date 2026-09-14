// The skills check runs first, seeds the matrix, and hands over the project.
process.env.DATA_DIR = process.argv[2];
const path = require('node:path');
const ROOT = require('node:path').join(__dirname, '..');
const aiPath = require.resolve(path.join(ROOT, 'lib/ai.js'));
require.cache[aiPath] = { id: aiPath, filename: aiPath, loaded: true, exports: {
  isAvailable: () => false, callClaude: async () => null, extractJson: () => null } };

const { db, cryptoRandomId } = require(path.join(ROOT, 'lib/db.js'));
const ws = require(path.join(ROOT, 'lib/workspace.js'));
const st = require(path.join(ROOT, 'lib/skilltest.js'));

let fails = 0;
const check = (n, c, d) => { if (c) console.log('  PASS  ' + n); else { fails++; console.log('  FAIL  ' + n + (d ? '\n        ' + d : '')); } };

function newLearner(email, name) {
  const uid = cryptoRandomId(), iso = new Date().toISOString();
  db.prepare('INSERT INTO users (id,email,password_hash,password_salt,created_at) VALUES (?,?,?,?,?)').run(uid, email, 'x', 'y', iso);
  db.prepare('INSERT INTO profiles (user_id,name,created_at,updated_at) VALUES (?,?,?,?)').run(uid, name, iso, iso);
  ws.startEnrollment(uid, { level: 'junior', scheduleType: 'weekday', scheduleDays: null });
  return uid;
}
const allRight = () => Object.fromEntries(st.QUESTIONS.map((q) => [q.id, q.answer]));
const allWrong = () => Object.fromEntries(st.QUESTIONS.map((q) => [q.id, q.options.find((o) => o.key !== q.answer).key]));

(async () => {
  console.log('1. A new learner meets the skills check before any project');
  const u1 = newLearner('sk1@e.com', 'Priya Sharma');
  const s1 = ws.getState(u1);
  check('the test is required', s1.skillTest.required === true, JSON.stringify(s1.skillTest.taken));
  check('no task has been assigned yet', s1.tasks.length === 0, JSON.stringify(s1.tasks.map((t) => t.task_key)));
  check('no project is active yet', s1.projects.projects.every((p) => p.status !== 'active'),
    JSON.stringify(s1.projects.projects.map((p) => p.key + '=' + p.status)));
  check('the questions are sent', s1.skillTest.questions.length === 12, String(s1.skillTest.questions.length));
  check('the answers are NOT sent to the browser',
    s1.skillTest.questions.every((q) => !('answer' in q) && q.options.every((o) => !('correct' in o))));
  check('every axis is covered', new Set(s1.skillTest.questions.map((q) => q.axis)).size === 5);
  const welcome = s1.messages.find((m) => /skills check/i.test(m.body));
  check('Asha explains why she is asking', Boolean(welcome), welcome && welcome.body.slice(0, 80));

  console.log('\n2. Submitting it scores every axis and hands over the project');
  const r1 = await ws.submitSkillTest(u1, allRight());
  check('a perfect sheet scores 100 across the board',
    Object.values(r1.result.skills).every((v) => v === 100), JSON.stringify(r1.result.skills));
  check('the overall is reported', r1.result.overall === 100, String(r1.result.overall));
  check('the project is now active',
    r1.state.projects.projects.some((p) => p.status === 'active'),
    JSON.stringify(r1.state.projects.projects.map((p) => p.key + '=' + p.status)));
  check('the first task is assigned', r1.state.tasks.length > 0, JSON.stringify(r1.state.tasks.map((t) => t.task_key)));
  check('the week clock started', Boolean(r1.state.projects.projects.find((p) => p.status === 'active').week));
  const ack = r1.state.messages.filter((m) => /skills check/i.test(m.body)).pop();
  check('Asha names the strongest and weakest area', /strongest area/.test(ack.body) || /starting point/.test(ack.body), ack.body.slice(0, 100));

  console.log('\n3. The matrix now has a line to measure from');
  const m1 = r1.state.skillMatrix.find((x) => x.axis === 'sql');
  check('SQL carries its baseline', m1.baseline === 100, String(m1.baseline));
  check('no movement is claimed before any task is graded', m1.delta === null, String(m1.delta));

  console.log('\n4. A partly-answered sheet scores only what it answered');
  const u2 = newLearner('sk2@e.com', 'Arun Kumar');
  const partial = { 'sql-1': 'a', 'sql-2': 'a', 'sql-3': 'a', 'comm-1': 'b' };
  const r2 = await ws.submitSkillTest(u2, partial);
  check('SQL is scored', r2.result.skills.sql === 100, String(r2.result.skills.sql));
  check('a wrong answer scores 0 for that axis', r2.result.skills.communication === 0, String(r2.result.skills.communication));
  check('an UNANSWERED axis is null, not zero', r2.result.skills.python === null, String(r2.result.skills.python));
  const m2 = r2.state.skillMatrix.find((x) => x.axis === 'python');
  check('and the matrix shows no baseline for it', m2.baseline === null, String(m2.baseline));

  console.log('\n5. It can only be taken once');
  let twice = false;
  try { await ws.submitSkillTest(u2, allRight()); twice = true; } catch (e) {}
  check('a second submission is refused', !twice);
  const empty = await (async () => { try { await ws.submitSkillTest(newLearner('sk3@e.com', 'X Y'), {}); return 'accepted'; } catch (e) { return e.message; } })();
  check('an empty sheet is refused', /Answer at least one/.test(empty), empty);

  console.log('\n6. Getting it wrong is a low baseline, not a rejection');
  const u4 = newLearner('sk4@e.com', 'Sanjay Rao');
  const r4 = await ws.submitSkillTest(u4, allWrong());
  check('every answered axis scores 0', Object.values(r4.result.skills).every((v) => v === 0), JSON.stringify(r4.result.skills));
  check('they still get the project', r4.state.tasks.length > 0, String(r4.state.tasks.length));

  console.log('\n7. A learner already mid-project is offered it, never blocked');
  const u5 = newLearner('sk5@e.com', 'Old Account');
  const e5 = ws.getEnrollment(u5);
  // Recreate a pre-skill-test account: tasks exist, no baseline.
  db.prepare("UPDATE sim_enrollments SET baseline_json=NULL, baseline_at=NULL WHERE id=?").run(e5.id);
  const run = db.prepare('SELECT * FROM sim_project_runs WHERE enrollment_id=?').get(e5.id);
  if (!run) {
    // startEnrollment no longer assigns work, so build the legacy shape by hand.
    ws.submitSkillTest(u5, allRight());
    db.prepare("UPDATE sim_enrollments SET baseline_json=NULL, baseline_at=NULL WHERE id=?").run(e5.id);
  }
  const s5 = ws.getState(u5);
  check('an existing account has work', s5.tasks.length > 0, String(s5.tasks.length));
  check('the test is offered, not required', s5.skillTest.optional === true && s5.skillTest.required === false,
    JSON.stringify({ o: s5.skillTest.optional, r: s5.skillTest.required }));

  console.log('\n8. The bank itself holds up');
  for (const q of st.QUESTIONS) {
    if (!q.options.some((o) => o.key === q.answer)) { fails++; console.log('  FAIL  ' + q.id + ' answer is not one of its options'); }
    if (q.options.length < 3) { fails++; console.log('  FAIL  ' + q.id + ' has too few distractors'); }
    if (!q.why) { fails++; console.log('  FAIL  ' + q.id + ' has no explanation'); }
  }
  check('every question has a valid answer, real distractors and an explanation', true);
  check('no duplicate question ids', new Set(st.QUESTIONS.map((q) => q.id)).size === st.QUESTIONS.length);

  // A browser run once scored 12/12 by clicking the first option every time — the answer
  // was always authored first. Position must never be worth guessing.
  const shown = st.getQuestions();
  const posn = shown.map((q) => q.options.findIndex((o) => o.key === st.QUESTIONS.find((x) => x.id === q.id).answer));
  const tally = {};
  for (const n of posn) tally[n] = (tally[n] || 0) + 1;
  const guessable = Math.max(...Object.values(tally));
  check('picking the same position every time scores at most chance',
    guessable <= Math.ceil(shown.length / 4), `${guessable}/${shown.length} — ${JSON.stringify(tally)}`);
  check('every option survives the reorder',
    shown.every((q, n) => q.options.length === st.QUESTIONS[n].options.length
      && new Set(q.options.map((o) => o.key)).size === q.options.length));
  check('the order is stable between reads', JSON.stringify(st.getQuestions()) === JSON.stringify(shown));

  console.log(fails ? `\n${fails} FAILURE(S)` : '\nAll skill-test checks passed.');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
