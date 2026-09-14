// Manager — running two teams through two leads, and the portfolio they sit in.
//
// Three of the six every day, which is the widest responsibility layer in the track. The
// analyst slots still ask what the number is; these ask who does the work, whether it
// goes out, and what somebody outside your team is told. Held to the same bar as the rest
// of the track: the leads are real and messageable, an allocation is graded against
// constraints you can count, and nothing that decides the answer reaches the browser.
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
const mgKeys = [...new Set([...src.slice(TASKS_START, TASKS_END).matchAll(/\n  '(mg-\d+)': \{/g)].map((m) => m[1]))];
function chunkFor(key) {
  const at = src.indexOf(`  '${key}': {`);
  let next = src.indexOf("\n  '", at + 6);
  if (next < 0 || next > TASKS_END) next = TASKS_END;
  return src.slice(at, next);
}
const MANAGER_PROJECTS = ['capacity-review', 'tooling-review', 'intake-review', 'headcount-case'];
function keysOf(projectKey) {
  const body = src.slice(src.indexOf(`key: '${projectKey}'`));
  const list = body.match(/taskKeys: \[([\s\S]*?)\n      \]/);
  return [...list[1].matchAll(/'([a-z]{2}-\d+)'/g)].map((m) => m[1]);
}
const estOf = {};
for (const m of src.slice(TASKS_START, TASKS_END).matchAll(/\n  '([a-z]{2}-\d+)': \{([\s\S]*?)\n  \},\n/g)) {
  estOf[m[1]] = parseFloat((m[2].match(/estHours: ([\d.]+)/) || [])[1] || 0);
}

(async () => {
  console.log('1. Three responsibility slots a day, at manager and only at manager');
  check('sixty manager tasks are authored', mgKeys.length === 60, String(mgKeys.length));
  for (const p of MANAGER_PROJECTS) {
    const mg = keysOf(p).filter((k) => k.startsWith('mg-'));
    check(`${p}: fifteen responsibility tasks`, mg.length === 15, mg.join(','));
  }
  for (const level of ['junior', 'senior', 'lead']) {
    const keys = ws.getState(learner(`mgr-not-${level}@t.local`, level)).tasks.map((t) => t.task_key);
    check(`a ${level} gets none of them`, !keys.some((k) => k.startsWith('mg-')));
  }
  const uid = learner('mgr@t.local', 'manager');
  const board = ws.getState(uid).tasks.filter((t) => t.task_key.startsWith('mg-'));
  check('a manager gets fifteen on their first project', board.length === 15, String(board.length));

  // Counted from the definitions rather than read off the titles: one allocation and two
  // sign-offs every day, in every one of the four projects.
  for (const p of MANAGER_PROJECTS) {
    const keys = keysOf(p);
    let ok = true; const shape = [];
    for (let d = 0; d < 5; d++) {
      const day = keys.slice(d * 6, d * 6 + 6).filter((k) => k.startsWith('mg-'));
      const a = day.filter((k) => /tool: 'assign'/.test(chunkFor(k))).length;
      const s = day.filter((k) => /tool: 'signoff'/.test(chunkFor(k))).length;
      shape.push(`${a}a/${s}s`);
      if (a !== 1 || s !== 2) ok = false;
    }
    check(`${p}: one allocation and two sign-offs every day`, ok, shape.join(' '));
  }

  console.log('\n2. The day still lands on the manager target');
  // The responsibility layer displaces analysis rather than being added on top of it.
  // 3.5 hours a day over five days is the target the level is sold on, so it is measured
  // here rather than assumed.
  check('the manager day target is 3.5 hours',
    ws.getState(uid).performance.hoursPerDayTarget === 3.5,
    String(ws.getState(uid).performance.hoursPerDayTarget));
  // estHours are authored estimates, so the bar is a quarter of an hour across the whole
  // week — three minutes a day — rather than an exact match. Tight enough that a project
  // which quietly drifts to four hours a day fails here.
  for (const p of MANAGER_PROJECTS) {
    const total = keysOf(p).reduce((s, k) => s + (estOf[k] || 0), 0);
    check(`${p}: the week lands on 17.5 hours`, Math.abs(total - 17.5) <= 0.25, total.toFixed(2));
  }

  console.log('\n3. Two leads, and they are yours');
  const mgrRoster = ws.getState(uid).roster;
  for (const name of ['Devika Raghavan', 'Suresh Balan']) {
    const p = mgrRoster.find((m) => m.name === name);
    check(`${name} is a messageable colleague at manager`, Boolean(p && p.avatarUrl), '');
    check(`${name} is marked as reporting to you`, Boolean(p && p.reportsToYou), '');
  }
  const leadRoster = ws.getState(learner('ld-mgr@t.local', 'lead')).roster;
  check('a lead is not shown the two team leads', !leadRoster.some((p) => p.name === 'Devika Raghavan'));
  check('a lead still has their own three reports',
    leadRoster.filter((p) => p.reportsToYou).length === 4,
    String(leadRoster.filter((p) => p.reportsToYou).length));
  check('a manager has more reports than a lead does',
    mgrRoster.filter((p) => p.reportsToYou).length > leadRoster.filter((p) => p.reportsToYou).length);
  const junRoster = ws.getState(learner('jr-mgr@t.local', 'junior')).roster;
  check('a junior has none at all', junRoster.every((p) => !p.reportsToYou));
  // The Team tab renders state.team, not state.roster. The flag has to survive the trip
  // through getTeam or the pill never appears, which is exactly how it shipped broken once.
  const mgrTeam = ws.getState(uid).team;
  check('the Team tab is told who reports to you',
    mgrTeam.filter((m) => m.reportsToYou).length === mgrRoster.filter((p) => p.reportsToYou).length,
    `${mgrTeam.filter((m) => m.reportsToYou).length} on the team card vs ${mgrRoster.filter((p) => p.reportsToYou).length} on the roster`);
  check('and both leads carry the flag there',
    ['Devika Raghavan', 'Suresh Balan'].every((n) => mgrTeam.some((m) => m.name === n && m.reportsToYou)));

  console.log('\n4. Every manager task is well formed');
  let nAssign = 0, nSignoff = 0;
  for (const key of mgKeys) {
    const chunk = chunkFor(key);
    if (/tool: 'assign'/.test(chunk)) {
      nAssign += 1;
      check(`${key}: everyone in the allocation has a capacity`,
        (chunk.match(/capacityDays: \d/g) || []).length >= 3,
        String((chunk.match(/capacityDays: \d/g) || []).length));
      check(`${key}: at least one allocation would be a real mistake`,
        (chunk.match(/forbidden: \{ \w/g) || []).length >= 1);
      check(`${key}: every item explains itself`,
        (chunk.match(/why: '/g) || []).length >= (chunk.match(/label: '/g) || []).length - 1);
      // A manager works through leads. Every allocation has to contain at least one thing
      // that is theirs and cannot be handed down, or the level is just lead again.
      check(`${key}: something in it belongs to you and nobody else`,
        /best: \['you'\], acceptable: \[\]/.test(chunk));
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
      check(`${key}: is one of the two manager types`, false, 'neither assign nor signoff');
    }
  }
  check('twenty allocations and forty sign-offs', nAssign === 20 && nSignoff === 40,
    `${nAssign} assign / ${nSignoff} signoff`);

  console.log('\n5. Allocation is graded against what you can count');
  const t = ws.getState(uid).tasks.find((x) => x.task_key === 'mg-101');
  const wb = ws.getWorkbench(uid, t.id);
  check('the workbench serves an allocation', wb.tool === 'assign' && Boolean(wb.assign));
  const raw = JSON.stringify(wb.assign);
  check('who should do what never reaches the browser',
    !raw.includes('best') && !raw.includes('forbidden') && !raw.includes('acceptable'));
  check('but capacity does, because they have to plan against it', /capacityDays/.test(raw));

  await ws.submitTask(uid, t.id, JSON.stringify({ assignments: {
    timelogs: 'suresh', demand: 'devika', exec: 'you', backlog: 'devika' } }));
  check('working through the leads scores full marks',
    db.prepare('SELECT score FROM sim_tasks WHERE id = ?').get(t.id).score === 100);

  // The failure this level is really about: a new manager who keeps doing the analysis
  // and sends a lead to hold the exec conversation.
  const u2 = learner('mgr2@t.local', 'manager');
  const t2 = ws.getState(u2).tasks.find((x) => x.task_key === 'mg-101');
  await ws.submitTask(u2, t2.id, JSON.stringify({ assignments: {
    timelogs: 'you', demand: 'you', exec: 'devika', backlog: 'you' } }));
  const bad = db.prepare('SELECT score, feedback FROM sim_tasks WHERE id = ?').get(t2.id);
  check('taking the analysis back and delegating the exec call is punished', bad.score < 40, String(bad.score));
  check('and the feedback says so in words', /exec|Devika|authority|manager/i.test(bad.feedback), bad.feedback);
  check('over-capacity is named as over-capacity', /Over capacity/.test(bad.feedback), bad.feedback);

  console.log('\n6. Sign-off weights the call above the wording');
  const sg = ws.getState(uid).tasks.find((x) => x.task_key === 'mg-102');
  const wb2 = ws.getWorkbench(uid, sg.id);
  check('the workbench serves a sign-off', wb2.tool === 'signoff' && Boolean(wb2.signoff));
  check('it names who sent it', wb2.signoff.from === 'Devika Raghavan');
  check('no answers leak', !JSON.stringify(wb2.signoff).includes('correct'));

  const good = 'Thanks for this. Before I say yes — if you had to drop one thing off that list, what would it be? I am not telling you to move anything, the allocation is your call and your team. It is the "it is tight but we always get there" that I want to look at, because that is how a team quietly absorbs too much until somebody leaves. Give me the one you would drop and I will take it somewhere else.';
  const r2 = await ws.submitTask(uid, sg.id, JSON.stringify({ picked: ['push'], reply: good }));
  check('a right call, well explained, scores full marks',
    r2.result.decisionScore === 100 && r2.result.replyScore === 100, JSON.stringify(r2.result));

  const u3 = learner('mgr3@t.local', 'manager');
  const sg3 = ws.getState(u3).tasks.find((x) => x.task_key === 'mg-102');
  await ws.submitTask(u3, sg3.id, JSON.stringify({ picked: ['cut'], reply: good }));
  const wrongCall = db.prepare('SELECT score FROM sim_tasks WHERE id = ?').get(sg3.id).score;
  const u4 = learner('mgr4@t.local', 'manager');
  const sg4 = ws.getState(u4).tasks.find((x) => x.task_key === 'mg-102');
  await ws.submitTask(u4, sg4.id, JSON.stringify({ picked: ['push'], reply: 'Not signing this off. Redo it and send it back.' }));
  const badWords = db.prepare('SELECT score FROM sim_tasks WHERE id = ?').get(sg4.id).score;
  check('reaching over the lead scores worse than a blunt message',
    wrongCall < badWords, `wrong call ${wrongCall} vs blunt ${badWords}`);
  check('and both are marked down', wrongCall < 70 && badWords < 80, `${wrongCall} / ${badWords}`);

  console.log('\n7. Half an answer is refused');
  const u5 = learner('mgr5@t.local', 'manager');
  const t5 = ws.getState(u5).tasks.find((x) => x.task_key === 'mg-102');
  let msg = '';
  try { await ws.submitTask(u5, t5.id, JSON.stringify({ picked: [], reply: good })); } catch (e) { msg = e.message; }
  check('a reply with no decision is refused', /make the call/i.test(msg), msg);
  msg = '';
  try { await ws.submitTask(u5, t5.id, JSON.stringify({ picked: ['push'], reply: '' })); } catch (e) { msg = e.message; }
  check('a decision with no reply is refused', /write your reply/i.test(msg), msg);
  const t6 = ws.getState(u5).tasks.find((x) => x.task_key === 'mg-101');
  msg = '';
  try { await ws.submitTask(u5, t6.id, JSON.stringify({ assignments: {} })); } catch (e) { msg = e.message; }
  check('an empty week is refused', /nothing is assigned/i.test(msg), msg);

  console.log('\n8. The two leads are the dataset, on purpose');
  // Every other colleague is kept out of the generator's name pool so a learner never
  // meets two people with the same name. These two are the exception: the manager's own
  // leads are the people in the analytics_ops team table, and the tasks depend on that.
  const ds = require(path.join(ROOT, 'lib/datasets.js'));
  const mem = ds.buildDatasetDb('analytics_ops');
  const generated = new Set(mem.prepare('SELECT name FROM analysts').all().map((r) => r.name));
  mem.close();
  for (const name of ['Devika Raghavan', 'Suresh Balan']) {
    check(`${name} is in the analytics_ops team table`, generated.has(name));
    const p = mgrRoster.find((m) => m.name === name);
    check(`${name} is declared as a deliberate overlap`, p && p.alsoInDataset === 'analytics_ops');
  }
  const dsSrc = fs.readFileSync(path.join(ROOT, 'lib/datasets.js'), 'utf8');
  const reservedBlock = (dsSrc.match(/const RESERVED_NAMES = new Set\(\[([\s\S]*?)\]\)/) || [])[1]
    .split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  const reserved = new Set([...reservedBlock.matchAll(/'([^']+)'/g)].map((m) => m[1]));
  check('and neither is in the reserved list, which would have kept them apart',
    !reserved.has('Devika Raghavan') && !reserved.has('Suresh Balan'));
  const clash = mgrRoster.filter((p) => generated.has(p.name) && p.archetype !== 'line_manager' && !p.alsoInDataset);
  check('everybody else still cannot collide', clash.length === 0, clash.map((p) => p.name).join(','));

  console.log(fails ? `\n${fails} FAILURE(S)` : '\nAll manager checks passed.');
  process.exit(fails ? 1 : 0);
})();
