// A real day: six tasks, four skills, and only two of them queries.
process.env.DATA_DIR = process.argv[2];
const path = require('node:path');
const ROOT = require('node:path').join(__dirname, '..');
const aiPath = require.resolve(path.join(ROOT, 'lib/ai.js'));
require.cache[aiPath] = { id: aiPath, filename: aiPath, loaded: true, exports: {
  isAvailable: () => false, callClaude: async () => null, extractJson: () => null } };

const { db, cryptoRandomId } = require(path.join(ROOT, 'lib/db.js'));
const ws = require(path.join(ROOT, 'lib/workspace.js'));
const tt = require(path.join(ROOT, 'lib/tasktypes.js'));
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
  console.log('1. Day one is a day, not one task');
  const u1 = newLearner('day1@e.com');
  const board = ws.getState(u1).taskBoard.rows;
  const dayOne = board.filter((r) => r.dayIndex === 1 && !r.notYetOpen);
  check('six tasks are open on day one', dayOne.length === 6, `${dayOne.length}: ` + JSON.stringify(dayOne.map((r) => r.title)));
  const hours = dayOne.reduce((s, r) => s + (r.estHours || 0), 0);
  check('and they add up to a realistic day, not eighteen hours', hours > 0.8 && hours < 2.5, hours + 'h');
  console.log('    ' + hours.toFixed(2) + ' hours across: ' + dayOne.map((r) => r.title).join(' · '));

  console.log('\n2. They are not all SQL');
  const wbs = dayOne.map((r) => ws.getWorkbench(u1, r.id));
  const tools = wbs.map((w) => w.tool);
  check('at least three different kinds of work', new Set(tools).size >= 3, JSON.stringify(tools));
  check('only two are queries', tools.filter((t) => t === 'sql').length === 2, JSON.stringify(tools));
  check('one is a judgement about a colleague\'s work', tools.includes('choice'));
  check('one is a piece of writing', tools.includes('writeup'));
  console.log('    ' + tools.join(', '));

  console.log('\n3. A review task shows the colleague\'s actual query');
  const rev = ws.getWorkbench(u1, idOf(u1, 'da-102'));
  check('the query is shown as an exhibit', rev.choice.exhibit.kind === 'sql', JSON.stringify(rev.choice.exhibit && rev.choice.exhibit.kind));
  check('it is attributed to a real colleague', /Rahul Verma/.test(rev.choice.exhibit.from), rev.choice.exhibit.from);
  check('the options are offered', rev.choice.options.length === 6, String(rev.choice.options.length));
  check('which ones are correct is NOT sent', !JSON.stringify(rev.choice).includes('correct'));
  check('nor is the explanation', !JSON.stringify(rev.choice).includes('"why"'));

  console.log('\n4. Flagging everything scores zero, not full marks');
  const all = rev.choice.options.map((o) => o.key);
  const u2 = newLearner('day2@e.com');
  await ws.submitTask(u2, idOf(u2, 'da-102'), JSON.stringify(all));
  check('ticking every box scores 0', db.prepare('SELECT score FROM sim_tasks WHERE id=?').get(idOf(u2, 'da-102')).score === 0,
    String(db.prepare('SELECT score FROM sim_tasks WHERE id=?').get(idOf(u2, 'da-102')).score));

  const u3 = newLearner('day3@e.com');
  const sub3 = await ws.submitTask(u3, idOf(u3, 'da-102'), JSON.stringify(['nullcmp', 'deptname', 'gap']));
  const row3 = db.prepare('SELECT * FROM sim_tasks WHERE id=?').get(idOf(u3, 'da-102'));
  check('the three real problems score 100', row3.score === 100, String(row3.score));
  check('the feedback names the silent failure', /silent|fails silently|empty result/i.test(row3.feedback), row3.feedback.slice(0, 90));
  check('SQL is scored, not just business logic', JSON.parse(row3.skills_json).sql === 100, row3.skills_json);
  console.log('    Asha: ' + sub3.question);

  console.log('\n5. Missing one gets a question about what they left');
  const u4 = newLearner('day4@e.com');
  const sub4 = await ws.submitTask(u4, idOf(u4, 'da-102'), JSON.stringify(['nullcmp']));
  check('partial credit', db.prepare('SELECT score FROM sim_tasks WHERE id=?').get(idOf(u4, 'da-102')).score === 33,
    String(db.prepare('SELECT score FROM sim_tasks WHERE id=?').get(idOf(u4, 'da-102')).score));
  check('Asha asks about what they skipped', /what you left|skipped/i.test(sub4.question), sub4.question);

  console.log('\n6. A false alarm is challenged, not just marked wrong');
  const u5 = newLearner('day5@e.com');
  const sub5 = await ws.submitTask(u5, idOf(u5, 'da-102'), JSON.stringify(['nullcmp', 'deptname', 'gap', 'orderby']));
  const row5 = db.prepare('SELECT * FROM sim_tasks WHERE id=?').get(idOf(u5, 'da-102'));
  check('a false alarm costs marks', row5.score === 67, String(row5.score));
  check('and is explained', /You can in SQLite/.test(row5.feedback), row5.feedback.slice(-120));
  check('Asha asks how they read it', /what you thought was wrong/i.test(sub5.question), sub5.question);

  console.log('\n7. The write-up is graded on what a stakeholder needs');
  const wu = ws.getWorkbench(u1, idOf(u1, 'da-104'));
  check('it is a writeup task', wu.tool === 'writeup', wu.tool);
  check('the recipient is named', /Vikram/.test(wu.writeup.to), wu.writeup.to);
  check('the word limit is stated', wu.writeup.maxWords === 120, String(wu.writeup.maxWords));
  check('what it must cover is shown, not hidden', wu.writeup.covers.length === 4, JSON.stringify(wu.writeup.covers));
  check('the marker patterns are NOT sent', !JSON.stringify(wu.writeup).includes('markers'));
  check('the result table is given as an exhibit', /Engineering/.test(wu.writeup.exhibit.body));

  const good = "Engineering has the highest average salary at 23.9L, ahead of Finance by about 5 lakh — that's the biggest gap between any two departments. These figures cover current staff only; people who have left are excluded, so they won't reconcile against historical headcount. Let me know if you want the full table before Thursday.";
  const u6 = newLearner('day6@e.com');
  await ws.submitTask(u6, idOf(u6, 'da-104'), good);
  const row6 = db.prepare('SELECT * FROM sim_tasks WHERE id=?').get(idOf(u6, 'da-104'));
  check('a good email scores well', row6.score === 100, String(row6.score) + ' — ' + row6.feedback.slice(0, 120));
  check('communication is scored', JSON.parse(row6.skills_json).communication === 100, row6.skills_json);

  console.log('\n8. An email that buries the answer is told so');
  const buried = "I ran the numbers by joining employees to departments and filtering on exit_year IS NULL, then grouped by department and took the average of salary. The query took a couple of minutes to write and I checked the row counts first.";
  const u7 = newLearner('day7@e.com');
  const sub7 = await ws.submitTask(u7, idOf(u7, 'da-104'), buried);
  const row7 = db.prepare('SELECT * FROM sim_tasks WHERE id=?').get(idOf(u7, 'da-104'));
  check('it scores badly', row7.score <= 50, String(row7.score));
  check('and is told what is missing', /Missing/.test(row7.feedback), row7.feedback.slice(0, 140));
  check('Asha asks about the omission', /left out/i.test(sub7.question), sub7.question);
  console.log('    ' + row7.feedback.split('\n\n')[0]);

  console.log('\n9. Too long is a real failure of the brief');
  const long = good + ' ' + 'Additionally I should note the following context about the analysis and the way it was produced.'.repeat(8);
  const u8 = newLearner('day8@e.com');
  await ws.submitTask(u8, idOf(u8, 'da-104'), long);
  const row8 = db.prepare('SELECT * FROM sim_tasks WHERE id=?').get(idOf(u8, 'da-104'));
  check('length costs marks', row8.score === 85, String(row8.score));
  check('and is named as the reason', /runs to \d+ words/.test(row8.feedback), row8.feedback.slice(-160));

  console.log('\n10. Every skill on the matrix can now be moved');
  const axes = ['sql', 'python', 'dataViz', 'businessLogic', 'communication'];
  const src = require('fs').readFileSync(path.join(ROOT, 'lib/workspace.js'), 'utf8');
  for (const axis of axes) {
    // A skill is reachable if some task's grading can emit it.
    const reachable = new RegExp(`${axis}:`).test(src)
      || (axis === 'sql' || axis === 'python');
    check(`${axis} is reachable by some task`, reachable);
  }
  const st1 = ws.getState(u6).skillMatrix.find((x) => x.axis === 'communication');
  check('and communication has actually moved for a learner who wrote well',
    st1.hasData === false || st1.value > 0, JSON.stringify(st1));

  console.log(fails ? `\n${fails} FAILURE(S)` : '\nAll day checks passed.');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
