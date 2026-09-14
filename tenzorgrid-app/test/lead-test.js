// Team Lead — staffing the week, and owning what leaves the team.
//
// Two of the six every day. The analyst slots ask what the number is; these ask who does
// the work and whether it goes out. Held to the same bar as everything else: the team is
// real and messageable, an assignment is graded against constraints you can count, and
// nothing that decides the answer reaches the browser.
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
const leadKeys = [...new Set([...src.slice(TASKS_START, TASKS_END).matchAll(/\n  '(tl-\d+)': \{/g)].map((m) => m[1]))];
function chunkFor(key) {
  const at = src.indexOf(`  '${key}': {`);
  let next = src.indexOf("\n  '", at + 6);
  if (next < 0 || next > TASKS_END) next = TASKS_END;
  return src.slice(at, next);
}

(async () => {
  console.log('1. Two responsibility slots a day, at lead and only at lead');
  check('forty lead tasks are authored', leadKeys.length === 40, String(leadKeys.length));
  const LEAD = ['trading-review', 'margin-review', 'range-review', 'board-pack'];
  for (const p of LEAD) {
    const body = src.slice(src.indexOf(`key: '${p}'`));
    const list = body.match(/taskKeys: \[([\s\S]*?)\n      \]/);
    const keys = [...list[1].matchAll(/'([a-z]{2}-\d+)'/g)].map((m) => m[1]);
    const tl = keys.filter((k) => k.startsWith('tl-'));
    check(`${p}: ten responsibility tasks`, tl.length === 10, tl.join(','));
  }
  for (const level of ['junior', 'senior']) {
    const keys = ws.getState(learner(`lv-${level}@t.local`, level)).tasks.map((t) => t.task_key);
    check(`a ${level} gets none of them`, !keys.some((k) => k.startsWith('tl-')));
  }
  const leadUid = learner('ld@t.local', 'lead');
  const leadKeysOnBoard = ws.getState(leadUid).tasks.filter((t) => t.task_key.startsWith('tl-'));
  check('a lead gets ten on their first project', leadKeysOnBoard.length === 10, String(leadKeysOnBoard.length));
  // Counted from the task definitions rather than guessed from the titles: five weeks to
  // staff and five things to sign off, one of each a day.
  const split = { assign: 0, signoff: 0 };
  for (const row of leadKeysOnBoard) {
    const c = chunkFor(row.task_key);
    if (/tool: 'assign'/.test(c)) split.assign += 1;
    if (/tool: 'signoff'/.test(c)) split.signoff += 1;
  }
  check('five of each — one staffing decision and one sign-off a day',
    split.assign === 5 && split.signoff === 5, JSON.stringify(split));

  console.log('\n2. The team is real, and only exists where it should');
  const leadRoster = ws.getState(leadUid).roster;
  for (const name of ['Ravi Menon', 'Nadia Baig', 'Zubin Wadia', 'Ishaan Varghese']) {
    check(`${name} is a messageable colleague at lead`, leadRoster.some((p) => p.name === name), '');
  }
  // Ravi was named fifty-three times in this level's task text and could not be reached.
  check('Ravi Menon, named all over the lead track, is finally reachable',
    leadRoster.some((p) => p.name === 'Ravi Menon' && p.avatarUrl));
  const junRoster = ws.getState(learner('jr2@t.local', 'junior')).roster;
  check('a junior is not shown three direct reports', !junRoster.some((p) => p.name === 'Ravi Menon'));
  check('but Ishaan is visible from the start, because senior coaches him',
    junRoster.some((p) => p.name === 'Ishaan Varghese'));

  console.log('\n3. Delivery arrives with the team');
  const lAxes = ws.getState(leadUid).skillMatrix.map((a) => a.axis);
  const sAxes = ws.getState(learner('sn2@t.local', 'senior')).skillMatrix.map((a) => a.axis);
  check('a lead sees a Delivery axis', lAxes.includes('delivery'), lAxes.join(','));
  check('a senior does not', !sAxes.includes('delivery'), sAxes.join(','));
  check('a lead still sees Coaching', lAxes.includes('coaching'));
  check('the lead day target is 3.25 hours',
    ws.getState(leadUid).performance.hoursPerDayTarget === 3.25,
    String(ws.getState(leadUid).performance.hoursPerDayTarget));

  console.log('\n4. Every lead task is well formed');
  let nAssign = 0, nSignoff = 0;
  for (const key of leadKeys) {
    const chunk = chunkFor(key);
    if (/tool: 'assign'/.test(chunk)) {
      nAssign += 1;
      check(`${key}: everyone on the team has a capacity`,
        (chunk.match(/capacityDays: \d/g) || []).length >= 4,
        String((chunk.match(/capacityDays: \d/g) || []).length));
      check(`${key}: at least one staffing would be a real mistake`,
        (chunk.match(/forbidden: \{ \w/g) || []).length >= 1);
      check(`${key}: every item explains itself`,
        (chunk.match(/why: '/g) || []).length >= (chunk.match(/label: '/g) || []).length - 1);
    } else if (/tool: 'signoff'/.test(chunk)) {
      nSignoff += 1;
      check(`${key}: exactly one right call`, (chunk.match(/correct: true/g) || []).length === 1,
        String((chunk.match(/correct: true/g) || []).length));
      check(`${key}: at least three wrong ones, each with a reason`,
        (chunk.match(/correct: false/g) || []).length >= 3);
      check(`${key}: the reply has a word budget`, /maxWords: \d+/.test(chunk));
      check(`${key}: every rubric point carries markers`,
        (chunk.match(/markers: \[/g) || []).length >= 3,
        String((chunk.match(/markers: \[/g) || []).length));
    } else {
      check(`${key}: is one of the two lead types`, false, 'neither assign nor signoff');
    }
  }
  check('twenty of each', nAssign === 20 && nSignoff === 20, `${nAssign} assign / ${nSignoff} signoff`);

  console.log('\n5. Staffing is graded against what you can count');
  const t = ws.getState(leadUid).tasks.find((x) => x.task_key === 'tl-101');
  const wb = ws.getWorkbench(leadUid, t.id);
  check('the workbench serves a staffing task', wb.tool === 'assign' && Boolean(wb.assign));
  const raw = JSON.stringify(wb.assign);
  check('who should do what never reaches the browser',
    !raw.includes('best') && !raw.includes('forbidden') && !raw.includes('acceptable'));
  check('but capacity does, because they have to plan against it', /capacityDays/.test(raw));

  const r = await ws.submitTask(leadUid, t.id, JSON.stringify({ assignments: {
    headline: 'ravi', duplicates: 'nadia', estate: 'zubin', returns: 'ishaan', chart: 'ishaan' } }));
  check('a sound plan scores full marks',
    db.prepare('SELECT score FROM sim_tasks WHERE id = ?').get(t.id).score === 100);
  check('and Asha asks where the slack is', /sick on Tuesday|least sure/.test(r.question), r.question);

  const u2 = learner('ld2@t.local', 'lead');
  const t2 = ws.getState(u2).tasks.find((x) => x.task_key === 'tl-101');
  await ws.submitTask(u2, t2.id, JSON.stringify({ assignments: {
    headline: 'zubin', duplicates: 'ravi', estate: 'ravi', returns: 'ravi', chart: 'ravi' } }));
  const bad = db.prepare('SELECT score, feedback FROM sim_tasks WHERE id = ?').get(t2.id);
  check('staffing the graduate onto the board pack is punished', bad.score < 30, String(bad.score));
  check('and the feedback says why, by name', /Zubin/.test(bad.feedback) && /six weeks/i.test(bad.feedback));
  check('over-capacity is named as over-capacity', /Over capacity/.test(bad.feedback));

  console.log('\n6. Sign-off weights the call above the wording');
  const sg = ws.getState(leadUid).tasks.find((x) => x.task_key === 'tl-102');
  const wb2 = ws.getWorkbench(leadUid, sg.id);
  check('the workbench serves a sign-off', wb2.tool === 'signoff' && Boolean(wb2.signoff));
  check('it names who sent it', wb2.signoff.from === 'Ravi Menon');
  check('no answers leak', !JSON.stringify(wb2.signoff).includes('correct'));

  const good = 'Holding this one. The board asked for net, so that is the measure in the top line — gross being the bigger number is the reason not to use it. It goes out under my name so I have to be able to defend the choice of measure. Can you get me the net version by tomorrow lunchtime?';
  const r2 = await ws.submitTask(leadUid, sg.id, JSON.stringify({ picked: ['hold'], reply: good }));
  check('a right call, well explained, scores full marks',
    r2.result.decisionScore === 100 && r2.result.replyScore === 100, JSON.stringify(r2.result));

  // The weighting is the point: shipping the wrong thing politely is worse than the reverse.
  const u3 = learner('ld3@t.local', 'lead');
  const sg3 = ws.getState(u3).tasks.find((x) => x.task_key === 'tl-102');
  await ws.submitTask(u3, sg3.id, JSON.stringify({ picked: ['ship'], reply: good }));
  const wrongCall = db.prepare('SELECT score FROM sim_tasks WHERE id = ?').get(sg3.id).score;
  const u4 = learner('ld4@t.local', 'lead');
  const sg4 = ws.getState(u4).tasks.find((x) => x.task_key === 'tl-102');
  await ws.submitTask(u4, sg4.id, JSON.stringify({ picked: ['hold'], reply: 'No. Do it again properly this time and send it back to me when it is actually finished.' }));
  const badWords = db.prepare('SELECT score FROM sim_tasks WHERE id = ?').get(sg4.id).score;
  check('the wrong call scores worse than the blunt message',
    wrongCall < badWords, `wrong call ${wrongCall} vs blunt ${badWords}`);
  check('and both are marked down', wrongCall < 70 && badWords < 80, `${wrongCall} / ${badWords}`);

  console.log('\n7. Half an answer is refused');
  const u5 = learner('ld5@t.local', 'lead');
  const t5 = ws.getState(u5).tasks.find((x) => x.task_key === 'tl-102');
  let msg = '';
  try { await ws.submitTask(u5, t5.id, JSON.stringify({ picked: [], reply: good })); } catch (e) { msg = e.message; }
  check('a reply with no decision is refused', /make the call/i.test(msg), msg);
  msg = '';
  try { await ws.submitTask(u5, t5.id, JSON.stringify({ picked: ['hold'], reply: '' })); } catch (e) { msg = e.message; }
  check('a decision with no reply is refused', /write your reply/i.test(msg), msg);
  const t6 = ws.getState(u5).tasks.find((x) => x.task_key === 'tl-101');
  msg = '';
  try { await ws.submitTask(u5, t6.id, JSON.stringify({ assignments: {} })); } catch (e) { msg = e.message; }
  check('an empty week is refused', /nothing is assigned/i.test(msg), msg);

  console.log('\n8. The new cast cannot collide with generated data');
  const ds = require(path.join(ROOT, 'lib/datasets.js'));
  const generated = new Set();
  for (const k of ['hr_core', 'analytics_ops']) {
    const mem = ds.buildDatasetDb(k);
    for (const tbl of ['employees', 'analysts']) {
      try { for (const row of mem.prepare(`SELECT name FROM ${tbl}`).all()) generated.add(row.name); } catch { /* not in this dataset */ }
    }
    mem.close();
  }
  const clash = leadRoster.filter((p) => generated.has(p.name) && p.archetype !== 'line_manager');
  check('no colleague shares a name with a generated person', clash.length === 0, clash.map((p) => p.name).join(','));
  const dsSrc = fs.readFileSync(path.join(ROOT, 'lib/datasets.js'), 'utf8');
  const reservedBlock = (dsSrc.match(/const RESERVED_NAMES = new Set\(\[([\s\S]*?)\]\)/) || [])[1]
    .split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  const reserved = new Set([...reservedBlock.matchAll(/'([^']+)'/g)].map((m) => m[1]));
  const unguarded = leadRoster.filter((p) => p.archetype !== 'line_manager' && !reserved.has(p.name));
  check('and every one of them is in the generator’s reserved list',
    unguarded.length === 0, unguarded.map((p) => p.name).join(','));

  console.log(fails ? `\n${fails} FAILURE(S)` : '\nAll lead checks passed.');
  process.exit(fails ? 1 : 0);
})();
