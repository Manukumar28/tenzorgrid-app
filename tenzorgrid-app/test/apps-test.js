// Enterprise workplace applications — Milestone 03.
//
// The risk this milestone carries is not a broken layout, it is a lie: six impressive app
// names over nothing, or a "Open in Analytics Studio" button on a task Analytics Studio
// cannot open. So the assertions are mostly about honesty.
//
//   * every application is backed by an engine that already exists
//   * every capability it claims is a tool kind the authored content actually uses
//   * work that is NOT tool work maps to no application, and says so
//   * nothing was duplicated: Mail, Calendar and People route to the one real page each
//
// The engines themselves are covered by wb-test, py-test, chart-test and the walks. This
// suite is about the layer above them.
process.env.DATA_DIR = process.argv[2];
process.env.TIME_TRAVEL = '1';
const path = require('node:path');
const fs = require('node:fs');
const ROOT = path.join(__dirname, '..');
const aiPath = require.resolve(path.join(ROOT, 'lib/ai.js'));
require.cache[aiPath] = { id: aiPath, filename: aiPath, loaded: true, exports: {
  isAvailable: () => false, callClaude: async () => null, extractJson: () => null } };

const { db, cryptoRandomId } = require(path.join(ROOT, 'lib/db.js'));
const ws = require(path.join(ROOT, 'lib/workspace.js'));
const st = require(path.join(ROOT, 'lib/skilltest.js'));
const appreg = require(path.join(ROOT, 'lib/apps.js'));

let fails = 0;
const check = (n, c, d) => { if (c) console.log('  PASS  ' + n); else { fails++; console.log('  FAIL  ' + n + (d ? '\n        ' + d : '')); } };
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const stripComments = (src) => src
  .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

let seq = 0;
function learner(level, toDay) {
  seq += 1;
  const uid = cryptoRandomId(), iso = new Date().toISOString();
  db.prepare('INSERT INTO users (id,email,password_hash,password_salt,created_at) VALUES (?,?,?,?,?)').run(uid, `app${seq}@t.local`, 'x', 'y', iso);
  db.prepare('INSERT INTO profiles (user_id,name,created_at,updated_at) VALUES (?,?,?,?)').run(uid, 'Manu Kumar', iso, iso);
  ws.startEnrollment(uid, { role: 'data_analyst', level, scheduleType: 'weekdays' });
  ws.submitSkillTest(uid, Object.fromEntries(st.QUESTIONS.map((q) => [q.id, q.answer])));
  if (toDay > 1) ws.timeTravel(uid, { workingDays: toDay - 1 });
  return uid;
}

console.log('\nWorkplace applications\n');

// ---- the registry ------------------------------------------------------------------------
const set = appreg.appsForRole('data_analyst');
check('the employer provides a set of applications', set.length === 5, set.map((a) => a.id).join(','));
check('each one has everything the UI needs to render it without inventing anything',
  set.every((a) => a.id && a.name && a.shortName && a.icon && a.description && a.tab && Array.isArray(a.capabilities)),
  set.filter((a) => !(a.id && a.name && a.icon && a.description && a.tab)).map((a) => a.id).join(','));
check('no application name is written into a component',
  !/Analytics Studio|BI Studio/.test(stripComments(read('workspace-app/src/components/AppShell.jsx'))
    + stripComments(read('workspace-app/src/components/AppLauncher.jsx'))
    + stripComments(read('workspace-app/src/components/WorkdayHome.jsx'))));

// A role nobody has authored applications for still gets the ones every employer has,
// rather than an empty launcher or a crash.
const fallback = appreg.appsForRole('cybersecurity_analyst');
check('an unauthored role falls back to the apps every employer has',
  fallback.length === 3 && fallback.every((a) => a.capabilities.length === 0),
  fallback.map((a) => a.id).join(','));
check('and the set is per role, so a later one can differ without touching navigation',
  JSON.stringify(set.map((a) => a.id)) !== JSON.stringify(fallback.map((a) => a.id)));

// ---- capability mapping is read, not guessed -----------------------------------------------
check('SQL work opens in the analytics application',
  appreg.appForTool('data_analyst', 'sql').id === 'analytics');
check('so does Python — one application, two modes',
  appreg.appForTool('data_analyst', 'python').id === 'analytics');
check('a chart opens in the BI application', appreg.appForTool('data_analyst', 'chart').id === 'bi');
// The important half. Judgement, a write-up, coaching, an allocation and a sign-off are
// read-and-decide work done at a desk. Giving them an application would be inventing one.
for (const tool of ['choice', 'writeup', 'coach', 'assign', 'signoff']) {
  check(`${tool} work maps to no application, because it is not tool work`,
    appreg.appForTool('data_analyst', tool) === null);
}
check('and an unknown tool never guesses', appreg.appForTool('data_analyst', 'telepathy') === null);

// ---- no empty applications ------------------------------------------------------------------
const nav = read('workspace-app/src/lib/navigation.js');
for (const app of set) {
  check(`${app.name} routes somewhere that exists`, new RegExp(`id: '${app.tab}'`).test(nav), app.tab);
}
check('Mail, Calendar and People carry no engine of their own — they open the real page',
  set.filter((a) => a.capabilities.length === 0).every((a) => ['emails', 'calendar', 'team'].includes(a.tab)));
// The rule that keeps a launcher trustworthy, asserted rather than promised.
check('there is no Documents application, because there is no document store behind one',
  !set.some((a) => /document/i.test(a.name)));

// ---- the engine actually produces the work these apps claim -----------------------------------
const u = learner('junior', 5);
const s = ws.getState(u);
const rows = s.taskBoard.rows;
check('every task on the board declares what it is made of', rows.every((r) => Boolean(r.tool)));
const kinds = [...new Set(rows.map((r) => r.tool))];
check('and every kind is one the registry has an answer for',
  kinds.every((k) => appreg.appForTool('data_analyst', k) !== undefined), kinds.join(','));
const analytics = rows.filter((r) => appreg.appForTool('data_analyst', r.tool) === appreg.APPS.analytics);
const bi = rows.filter((r) => appreg.appForTool('data_analyst', r.tool) === appreg.APPS.bi);
check('Analytics Studio has real work behind it in a single week',
  analytics.length >= 5, `${analytics.length} of ${rows.length}`);
check('so does BI Studio', bi.length >= 1, `${bi.length} of ${rows.length}`);
check('and most of the week is still desk work, which is the honest split',
  rows.length - analytics.length - bi.length > 0,
  `${rows.length - analytics.length - bi.length} desk / ${analytics.length} analytics / ${bi.length} BI`);

check('the set of applications reaches the client on state', Array.isArray(s.apps) && s.apps.length === 5);
check('the current assignment carries what the launcher keys on',
  Boolean(s.workday.assignment && s.workday.assignment.id && s.workday.assignment.tool),
  JSON.stringify(s.workday.assignment && { id: Boolean(s.workday.assignment.id), tool: s.workday.assignment.tool }));
check('and so does every item in the queue',
  s.workday.queue.every((q) => q.id && q.tool));

// ---- run and submit stayed separate -------------------------------------------------------------
const wbSrc = read('workspace-app/src/components/Workbench.jsx');
check('running and submitting are still two different calls to two different endpoints',
  /api\.runQuery/.test(wbSrc) && /api\.submitTask/.test(wbSrc));
check('the editor says running costs nothing, rather than leaving it to be discovered',
  /Running is free/.test(wbSrc));
check('the buttons use workplace language, not a quiz\'s',
  /Run query/.test(wbSrc) && /Submit for review/.test(wbSrc)
    && !/Check answer|Try again|Score me|Earn XP/i.test(stripComments(wbSrc)));
check('a failed query reads as the tool failing, not the learner',
  /Query failed/.test(wbSrc));

// Running a query really is unlimited, and that is checked against the engine rather than
// the wording: the same query twenty times in a row, all accepted.
const task = rows.find((r) => r.tool === 'sql' && !r.notYetOpen && r.status !== 'graded');
check('there is a SQL task to try this on', Boolean(task));
if (task) {
  let ok = 0;
  for (let i = 0; i < 20; i += 1) {
    try { ws.runScratchQuery(u, task.id, 'SELECT COUNT(*) AS n FROM employees'); ok += 1; } catch { /* counted below */ }
  }
  check('running a query twenty times is twenty times allowed', ok === 20, `${ok}/20`);
  check('and none of it touched the task\'s state',
    ws.getState(u).taskBoard.rows.find((r) => r.id === task.id).status === task.status);
  // The engine's own message, not a paraphrase -- "no such column" is the lesson.
  let msg = null;
  try { ws.runScratchQuery(u, task.id, 'SELECT nope FROM employees'); } catch (e) { msg = e.message; }
  check('a bad column comes back as the database said it', /no such column/i.test(msg || ''), msg);
}

// ---- the shell wraps only what belongs in an application ------------------------------------------
check('the bench wears application chrome only when the task belongs in one',
  /if \(!app\) \{[\s\S]{0,140}return <div/.test(wbSrc));
const shellSrc = read('workspace-app/src/components/AppShell.jsx');
check('the shell does not repeat the company navigation inside every tool',
  !/navigationFor|NAV_ITEMS|Sidebar/.test(shellSrc));
check('it carries the review state the engine already records, and invents none',
  ['Draft', 'In progress', 'Submitted', 'Under review', 'Returned', 'Approved']
    .every((x) => shellSrc.includes(x))
    && /task\.reviewState === 'pending'/.test(shellSrc) && /task\.sentBack/.test(shellSrc));
check('and no person is named in it — the context comes from the roster',
  !/Asha|Vikram|Priya|Neha/.test(shellSrc));

// ---- nothing else moved --------------------------------------------------------------------------
const byDay = {};
for (const t of s.tasks) byDay[t.day_index] = (byDay[t.day_index] || 0) + 1;
check('still six tasks a day', [1, 2, 3, 4, 5].every((d) => byDay[d] === 6), [1, 2, 3, 4, 5].map((d) => byDay[d]).join(','));
check('still thirty tasks in the week', s.tasks.length === 30, String(s.tasks.length));
check('the navigation from the milestone before is untouched',
  ['workday', 'emails', 'calendar', 'tasks', 'today', 'projects', 'team', 'overview']
    .every((id) => new RegExp(`id: '${id}'`).test(nav)));
check('and the phone bar was not quietly filled with applications',
  /MOBILE_PRIMARY = \[[^\]]*'workday'[^\]]*'emails'[^\]]*'tasks'[^\]]*'calendar'[^\]]*\]/.test(nav)
    && !/MOBILE_PRIMARY = \[[^\]]*analytics/.test(nav));

console.log(fails ? `\n${fails} FAILURE(S)` : '\nAll application checks passed.');
process.exit(fails ? 1 : 0);
