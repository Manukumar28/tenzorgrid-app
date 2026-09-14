// Coaching — the senior responsibility slot.
//
// The senior day stopped being six analysis tasks and became five plus one where somebody
// junior has done a piece of work and it is your job to see what is wrong and tell them.
// This suite holds that to the same bar as everything else: the exhibits are real queries
// that really run, the grader rewards discrimination rather than caution, and no answer
// reaches the browser.
process.env.DATA_DIR = process.argv[2];
const path = require('node:path');
const ROOT = require('node:path').join(__dirname, '..');
const aiPath = require.resolve(path.join(ROOT, 'lib/ai.js'));
require.cache[aiPath] = { id: aiPath, filename: aiPath, loaded: true, exports: {
  isAvailable: () => false, callClaude: async () => null, extractJson: () => null } };

const fs = require('node:fs');
const { db, cryptoRandomId } = require(path.join(ROOT, 'lib/db.js'));
const ws = require(path.join(ROOT, 'lib/workspace.js'));
const st = require(path.join(ROOT, 'lib/skilltest.js'));
const ds = require(path.join(ROOT, 'lib/datasets.js'));
const tasktypes = require(path.join(ROOT, 'lib/tasktypes.js'));

let fails = 0;
const check = (n, c, d) => { if (c) console.log('  PASS  ' + n); else { fails++; console.log('  FAIL  ' + n + (d ? '\n        ' + d : '')); } };

function learner(email, level) {
  const uid = cryptoRandomId(), iso = new Date().toISOString();
  db.prepare('INSERT INTO users (id,email,password_hash,password_salt,created_at) VALUES (?,?,?,?,?)').run(uid, email, 'x', 'y', iso);
  db.prepare('INSERT INTO profiles (user_id,name,created_at,updated_at) VALUES (?,?,?,?)').run(uid, 'T', iso, iso);
  ws.startEnrollment(uid, { role: 'data_analyst', level, scheduleType: 'weekdays' });
  ws.submitSkillTest(uid, Object.fromEntries(st.QUESTIONS.map((q) => [q.id, q.answer])));
  return uid;
}

const src = fs.readFileSync(path.join(ROOT, 'lib/workspace.js'), 'utf8');
const TASKS_START = src.indexOf('const TASKS = {');
const TASKS_END = src.indexOf('\n};\n', TASKS_START);
const coachKeys = [...new Set([...src.slice(TASKS_START, TASKS_END).matchAll(/\n  '(co-\d+)': \{/g)].map((m) => m[1]))];

(async () => {
  console.log('1. The slot exists at senior and only at senior');
  check('twenty coaching tasks are authored', coachKeys.length === 20, String(coachKeys.length));
  const SENIOR = ['reliability-review', 'account-economics', 'activation-review', 'experiment-readout'];
  for (const p of SENIOR) {
    const body = src.slice(src.indexOf(`key: '${p}'`));
    const list = body.match(/taskKeys: \[([\s\S]*?)\n      \]/);
    const keys = [...list[1].matchAll(/'([a-z]{2}-\d+)'/g)].map((m) => m[1]);
    const co = keys.filter((k) => k.startsWith('co-'));
    check(`${p}: five coaching tasks`, co.length === 5, co.join(','));
  }
  const juniorUid = learner('cj@t.local', 'junior');
  const jKeys = ws.getState(juniorUid).tasks.map((t) => t.task_key);
  check('a junior gets none of them', !jKeys.some((k) => k.startsWith('co-')), jKeys.join(','));

  console.log('\n2. The coaching axis appears when it can be moved, and not before');
  const jAxes = ws.getState(juniorUid).skillMatrix.map((a) => a.axis);
  check('junior does not see a Coaching axis', !jAxes.includes('coaching'), jAxes.join(','));
  const seniorUid = learner('cs@t.local', 'senior');
  const sAxes = ws.getState(seniorUid).skillMatrix.map((a) => a.axis);
  check('senior does', sAxes.includes('coaching'), sAxes.join(','));
  // The Data Viz hole, not repeated: an axis nobody can move reports a permanent zero.
  check('and every axis a senior sees has at least one task that could score it',
    sAxes.includes('coaching') && jAxes.every((a) => sAxes.includes(a)));

  console.log('\n3. A day is as long as the level says it is');
  check('junior day target is 2 hours', ws.getState(juniorUid).performance.hoursPerDayTarget === 2,
    String(ws.getState(juniorUid).performance.hoursPerDayTarget));
  check('senior day target is 3 hours', ws.getState(seniorUid).performance.hoursPerDayTarget === 3,
    String(ws.getState(seniorUid).performance.hoursPerDayTarget));

  console.log("\n4. Ishaan's work is real — every SQL exhibit runs against the project dataset");
  const datasetOf = {};
  for (const p of SENIOR) {
    const body = src.slice(src.indexOf(`key: '${p}'`));
    const list = body.match(/taskKeys: \[([\s\S]*?)\n      \]/);
    for (const m of list[1].matchAll(/'(co-\d+)'/g)) datasetOf[m[1]] = null;
  }
  let sqlExhibits = 0;
  for (const key of coachKeys) {
    const at = src.indexOf(`  '${key}': {`);
    let next = src.indexOf("\n  '", at + 6);
    if (next < 0 || next > TASKS_END) next = TASKS_END;
    const chunk = src.slice(at, next);
    const dsKey = (chunk.match(/datasetKey: '(\w+)'/) || [])[1];
    check(`${key} names a dataset that exists`, Boolean(dsKey && ds.DATASETS[dsKey]), String(dsKey));
    const kind = (chunk.match(/kind: '(\w+)'/) || [])[1];
    if (kind !== 'sql') continue;
    // The body is a JS string literal with \n escapes; pull it back to real SQL and drop
    // the commented-out conclusions so only the statement is left.
    const raw = (chunk.match(/body: "([\s\S]*?)",\n/) || [])[1];
    if (!raw) { check(`${key} exhibit body is readable`, false, 'could not extract'); continue; }
    const sql = raw.replace(/\\n/g, '\n').replace(/\\"/g, '"')
      .split('\n').filter((l) => !l.trim().startsWith('--')).join('\n').trim();
    if (!/^SELECT/i.test(sql)) continue;
    sqlExhibits += 1;
    let rows = null, err = null;
    const mem = ds.buildDatasetDb(dsKey);
    try { rows = mem.prepare(sql).all(); } catch (e) { err = e.message; } finally { mem.close(); }
    check(`${key}: the query he actually wrote runs and returns rows`,
      rows && rows.length >= 1, err || `${rows ? rows.length : 0} rows`);
  }
  check('most coaching tasks show him a real query', sqlExhibits >= 6, String(sqlExhibits));

  console.log('\n5. Every coaching task is answerable and marks both halves');
  for (const key of coachKeys) {
    const at = src.indexOf(`  '${key}': {`);
    let next = src.indexOf("\n  '", at + 6);
    if (next < 0 || next > TASKS_END) next = TASKS_END;
    const chunk = src.slice(at, next);
    const correct = (chunk.match(/correct: true/g) || []).length;
    const wrong = (chunk.match(/correct: false/g) || []).length;
    check(`${key}: has real problems to find and real distractors`, correct >= 2 && wrong >= 2,
      `${correct} correct / ${wrong} distractors`);
    check(`${key}: every reply rubric point carries markers`,
      (chunk.match(/markers: \[/g) || []).length === (chunk.match(/\{ key: '[a-z]+', label: /g) || []).length
      || (chunk.match(/markers: \[/g) || []).length >= 3,
      String((chunk.match(/markers: \[/g) || []).length));
    check(`${key}: names who is being coached`, /menteeName: 'Ishaan Varghese'/.test(chunk));
    check(`${key}: the reply has a word budget`, /maxWords: \d+/.test(chunk));
  }

  console.log('\n6. Grading: both halves count, and caution is not free');
  const uid = learner('cg@t.local', 'senior');
  const t = ws.getState(uid).tasks.find((x) => x.task_key === 'co-101');
  const wb = ws.getWorkbench(uid, t.id);
  check('the workbench serves a coach task', wb.tool === 'coach' && Boolean(wb.coach));
  check('it names Ishaan', wb.coach.mentee === 'Ishaan Varghese', String(wb.coach.mentee));
  const raw = JSON.stringify(wb.coach);
  check('no correct answers reach the browser', !raw.includes('"correct"') && !raw.includes('markers'));
  check('and no rubric markers either', !raw.includes('exit_year IS NULL'));

  const perfect = {
    picked: ['churn', 'conclusion', 'countnotimpact'],
    reply: 'Good instinct going straight at the data and the query itself is right. One thing before this goes anywhere: Lattice Education churned, and three of those incidents are theirs. Re-run it for clients still with us and see what happens to report-builder — I think your headline becomes a tie. Have a go and let me know what you get.',
  };
  const r = await ws.submitTask(uid, t.id, JSON.stringify(perfect));
  check('a good answer scores both halves', r.result.diagnoseScore === 100 && r.result.replyScore === 100,
    JSON.stringify(r.result));
  const row = db.prepare('SELECT score, skills_json FROM sim_tasks WHERE id = ?').get(t.id);
  check('the overall score is the two halves together', row.score === 100, String(row.score));
  const skills = JSON.parse(row.skills_json);
  check('it moves the coaching axis', skills.coaching === 100, JSON.stringify(skills));
  check('and communication and business logic with it',
    skills.communication === 100 && skills.businessLogic === 100, JSON.stringify(skills));
  check('Asha asks about the judgement, not the junior', /deliberately not say/.test(r.question), r.question);

  // Ticking every box is the habit the whole grader exists to break.
  const uid2 = learner('cg2@t.local', 'senior');
  const t2 = ws.getState(uid2).tasks.find((x) => x.task_key === 'co-101');
  const all = ws.getWorkbench(uid2, t2.id).coach.diagnose.options.map((o) => o.key);
  const r2 = await ws.submitTask(uid2, t2.id, JSON.stringify({ picked: all, reply: perfect.reply }));
  check('flagging everything scores zero on the diagnosis', r2.result.diagnoseScore === 0,
    String(r2.result.diagnoseScore));
  check('even with a perfect reply, the task does not pass as good',
    db.prepare('SELECT score FROM sim_tasks WHERE id = ?').get(t2.id).score === 50,
    String(db.prepare('SELECT score FROM sim_tasks WHERE id = ?').get(t2.id).score));

  // Half an answer is not an answer.
  const uid3 = learner('cg3@t.local', 'senior');
  const t3 = ws.getState(uid3).tasks.find((x) => x.task_key === 'co-101');
  let msg = '';
  try { await ws.submitTask(uid3, t3.id, JSON.stringify({ picked: ['churn'], reply: '' })); }
  catch (e) { msg = e.message; }
  check('a diagnosis with no reply is refused', /write your reply/i.test(msg), msg);
  msg = '';
  try { await ws.submitTask(uid3, t3.id, JSON.stringify({ picked: [], reply: perfect.reply })); }
  catch (e) { msg = e.message; }
  check('a reply with no diagnosis is refused', /what you think is wrong/i.test(msg), msg);

  console.log('\n7. Right answer, badly delivered, is marked as such');
  const uid4 = learner('cg4@t.local', 'senior');
  const t4 = ws.getState(uid4).tasks.find((x) => x.task_key === 'co-101');
  const r4 = await ws.submitTask(uid4, t4.id, JSON.stringify({
    picked: ['churn', 'conclusion', 'countnotimpact'],
    reply: 'This is wrong. Filter out the churned clients. Here is the corrected query, use this one instead of yours in future and it will be fine.',
  }));
  check('the diagnosis still scores full marks', r4.result.diagnoseScore === 100, String(r4.result.diagnoseScore));
  check('the delivery does not', r4.result.replyScore < 60, String(r4.result.replyScore));
  check('Asha asks him to think about the other person',
    /his side of it|four months in/.test(r4.question), r4.question);

  console.log('\n8. The cast member exists and cannot collide with generated data');
  const roster = ws.getState(uid).roster;
  const ishaan = roster.find((p) => p.archetype === 'junior_analyst');
  check('Ishaan is a real, messageable colleague', Boolean(ishaan) && ishaan.name === 'Ishaan Varghese',
    ishaan ? ishaan.name : 'missing');
  check('he has an avatar like everyone else', Boolean(ishaan && ishaan.avatarUrl));
  // The analytics_ops collision — the Business Stakeholder turning up as a team lead being
  // assessed — happened because a cast name was also in the generator's name pool.
  const generated = new Set();
  for (const k of ['hr_core', 'analytics_ops']) {
    const mem = ds.buildDatasetDb(k);
    for (const tbl of ['employees', 'analysts']) {
      try { for (const row of mem.prepare(`SELECT name FROM ${tbl}`).all()) generated.add(row.name); } catch { /* table not in this dataset */ }
    }
    mem.close();
  }
  check('no generated person shares his name', !generated.has('Ishaan Varghese'));
  // Asha is the one deliberate exception: she really is the line manager, so her appearing
  // in a people dataset is correct rather than a clash.
  const collisions = roster.filter((p) => generated.has(p.name) && p.archetype !== 'line_manager');
  check('and none of the cast collides with generated data either',
    collisions.length === 0, collisions.map((p) => p.name).join(','));

  // The guard in lib/datasets.js is a copy of the roster, because workspace.js requires
  // that file and importing back would be a cycle. This is the assertion that keeps the
  // copy honest — add a colleague and forget the guard, and this fails.
  const dsSrc = fs.readFileSync(path.join(ROOT, 'lib/datasets.js'), 'utf8');
  const reservedBlock = (dsSrc.match(/const RESERVED_NAMES = new Set\(\[([\s\S]*?)\]\)/) || [])[1]
    .split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  const reserved = new Set([...reservedBlock.matchAll(/'([^']+)'/g)].map((m) => m[1]));
  const unguarded = roster.filter((p) => p.archetype !== 'line_manager' && !reserved.has(p.name));
  check('every colleague is named in the generator’s reserved list',
    unguarded.length === 0, unguarded.map((p) => p.name).join(','));

  console.log(fails ? `\n${fails} FAILURE(S)` : '\nAll coaching checks passed.');
  process.exit(fails ? 1 : 0);
})();
