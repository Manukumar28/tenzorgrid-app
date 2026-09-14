// Chart tasks: the dataViz axis finally has something that can move it.
process.env.DATA_DIR = process.argv[2];
const path = require('node:path');
const ROOT = require('node:path').join(__dirname, '..');
const aiPath = require.resolve(path.join(ROOT, 'lib/ai.js'));
require.cache[aiPath] = { id: aiPath, filename: aiPath, loaded: true, exports: {
  isAvailable: () => false, callClaude: async () => null, extractJson: () => null } };

const { db, cryptoRandomId } = require(path.join(ROOT, 'lib/db.js'));
const ws = require(path.join(ROOT, 'lib/workspace.js'));
const ct = require(path.join(ROOT, 'lib/charttasks.js'));
const _st = require(path.join(ROOT, 'lib/skilltest.js'));
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
const idOf = (uid, k) => {
  const e = ws.getEnrollment(uid);
  return (db.prepare('SELECT id FROM sim_tasks WHERE enrollment_id=? AND task_key=?').get(e.id, k) || {}).id;
};

(async () => {
  console.log('1. The chart task arrives with its rows and its choices');
  const u1 = newLearner('ch1@e.com');
  const t1 = idOf(u1, 'da-006');
  check('the chart task was assigned', Boolean(t1));
  const wb = ws.getWorkbench(u1, t1);
  check('it is a chart task', wb.tool === 'chart', wb.tool);
  check('the rows are given, not queried', Array.isArray(wb.chart.rows) && wb.chart.rows.length >= 5, wb.chart && String(wb.chart.rows && wb.chart.rows.length));
  check('the columns it can chart are named', JSON.stringify(wb.chart.columns) === '["department","avg_salary"]', JSON.stringify(wb.chart.columns));
  check('chart types are offered', wb.chart.chartTypes.length >= 4);
  check('the correct answer is NOT sent to the browser',
    !JSON.stringify(wb.chart).includes('correct') && !JSON.stringify(wb.chart).includes('whyRight'));
  check('the tool shown is the chart builder', wb.tools.some((t) => t && /Chart Builder/.test(t.name)), JSON.stringify(wb.tools.map((t) => t && t.name)));

  console.log('\n2. The right chart scores full marks');
  const good = { type: 'bar', x: 'department', y: 'avg_salary', sort: 'desc', baselineZero: true };
  const sub1 = await ws.submitTask(u1, t1, JSON.stringify(good));
  check('it goes to review like any other task', sub1.inReview === true);
  const row1 = db.prepare('SELECT * FROM sim_tasks WHERE id=?').get(t1);
  check('scored 100', row1.score === 100, String(row1.score));
  check('dataViz was scored', JSON.parse(row1.skills_json).dataViz === 100, row1.skills_json);
  check('the score is hidden until sign-off', ws.getState(u1).taskBoard.rows.find((r) => r.id === t1).score === null);
  console.log('    Asha: ' + sub1.question);
  check('her question is about a real choice', /pie chart/.test(sub1.question), sub1.question);

  console.log('\n3. A pie chart of averages is marked down, and told why');
  const u2 = newLearner('ch2@e.com');
  const t2 = idOf(u2, 'da-006');
  const sub2 = await ws.submitTask(u2, t2, JSON.stringify({ ...good, type: 'pie' }));
  const row2 = db.prepare('SELECT * FROM sim_tasks WHERE id=?').get(t2);
  check('it loses the chart-type marks', row2.score === 60, String(row2.score));
  check('the feedback explains the category error', /parts of a whole|do not sum/i.test(row2.feedback), row2.feedback.slice(0, 100));
  check('Asha asks about the pie specifically', /pie/.test(sub2.question), sub2.question);
  console.log('    ' + row2.feedback.slice(0, 130));

  console.log('\n4. A truncated axis is caught');
  const u3 = newLearner('ch3@e.com');
  const t3 = idOf(u3, 'da-006');
  await ws.submitTask(u3, t3, JSON.stringify({ ...good, baselineZero: false }));
  const row3 = db.prepare('SELECT * FROM sim_tasks WHERE id=?').get(t3);
  check('it loses marks but not many', row3.score === 85, String(row3.score));
  check('the feedback names the distortion', /3x gap|length/i.test(row3.feedback), row3.feedback.slice(0, 120));

  console.log('\n5. The second chart task punishes pattern-matching, not thinking');
  // da-007 is a time series. A learner who repeats the bar+sorted answer that was right
  // on da-006 should lose exactly those marks — that is the point of the pairing.
  const spec7 = { correct: { type: 'line', x: 'hire_year', y: 'headcount', sort: 'none' },
                  columns: ['hire_year', 'headcount'], prompt: 'x',
                  why: { type: 'a', sort: 'b', x: 'c', y: 'd' } };
  const repeated = ct.grade(spec7, { type: 'bar', x: 'hire_year', y: 'headcount', sort: 'desc' });
  const thought = ct.grade(spec7, { type: 'line', x: 'hire_year', y: 'headcount', sort: 'none' });
  check('repeating the last answer scores badly', repeated.score < 60, String(repeated.score));
  check('thinking about it scores full marks', thought.score === 100, String(thought.score));
  check('and the two answers genuinely differ', repeated.score !== thought.score);
  console.log(`    pattern-matched: ${repeated.score}   thought about it: ${thought.score}`);

  console.log('\n6. Only the fields that apply are graded');
  const scatter = { correct: { type: 'scatter', x: 'mrr', y: 'tickets' }, columns: ['mrr', 'tickets'], prompt: 'x', why: {} };
  check('a scatter is not asked about sorting or baselines',
    JSON.stringify(ct.fieldsFor(scatter)) === '["type","x","y"]', JSON.stringify(ct.fieldsFor(scatter)));
  check('and scores 100 without them', ct.grade(scatter, { type: 'scatter', x: 'mrr', y: 'tickets' }).score === 100);
  const pie = { correct: { type: 'pie', x: 'tier', y: 'clients' }, columns: ['tier', 'clients'], prompt: 'x', why: {} };
  check('a pie is not asked about a zero baseline', !ct.fieldsFor(pie).includes('baselineZero'), JSON.stringify(ct.fieldsFor(pie)));

  console.log('\n7. Empty and malformed submissions are refused');
  const u4 = newLearner('ch4@e.com');
  const t4 = idOf(u4, 'da-006');
  let err = null;
  try { await ws.submitTask(u4, t4, 'not json'); } catch (e) { err = e.message; }
  check('a malformed submission is rejected', /Make your chart choices/.test(err || ''), err);
  check('nothing was written', db.prepare('SELECT status FROM sim_tasks WHERE id=?').get(t4).status === 'assigned');

  console.log('\n8. The skill matrix can finally move on Data Viz');
  await ws.answerReview(u1, t1, 'A bar chart because averages across departments are not parts of a whole, and sorting puts the answer first for the reader.');
  const m = ws.getState(u1).skillMatrix.find((x) => x.axis === 'dataViz');
  check('dataViz now has data', m.hasData === true, JSON.stringify(m));
  check('it has a real value', m.value === 100, String(m.value));
  check('and a delta against the entry test', typeof m.delta === 'number', String(m.delta));
  console.log('    dataViz: baseline ' + m.baseline + ' -> ' + m.value + ' (' + (m.delta >= 0 ? '+' : '') + m.delta + ')');

  console.log(fails ? `\n${fails} FAILURE(S)` : '\nAll chart-task checks passed.');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
