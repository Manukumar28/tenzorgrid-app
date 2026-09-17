// Navigation — Milestone 02.
//
// The navigation is a config object read by two components, so the things worth asserting
// are the ones a config can get wrong and a screenshot cannot show:
//
//   * every destination in the menu exists as a mounted tab, and every mounted tab is in
//     the menu -- a dead item and an unreachable screen are the same bug twice
//   * permissions survive the regrouping. A junior must not see Appraisals or Attendance.
//   * badges count real state and nothing else
//   * nothing that Today or Overview uniquely held has been quietly dropped
//
// The config is ESM and the harness is CJS, so the file is parsed rather than imported.
// That is uglier than a require and it is the only way to test the real file instead of a
// second copy of it, which is the thing this milestone exists to stop.
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

let fails = 0;
const check = (n, c, d) => { if (c) console.log('  PASS  ' + n); else { fails++; console.log('  FAIL  ' + n + (d ? '\n        ' + d : '')); } };
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
// Code only. A check that cannot tell an element from a comment describing why the
// element was removed will fail on the note explaining the fix -- which is exactly what
// this one did first time, for the second milestone running.
const stripComments = (src) => src
  .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

const navSrc = read('workspace-app/src/lib/navigation.js');
const appSrc = read('workspace-app/src/App.jsx');
const sidebarSrc = read('workspace-app/src/components/Sidebar.jsx');
const mobileSrc = read('workspace-app/src/components/MobileNav.jsx');

// ---- what the config declares -------------------------------------------------------------
const items = [...navSrc.matchAll(/\{\s*id:\s*'([a-z]+)',\s*section:\s*'([a-z]+)',\s*label:\s*'([^']+)'[^}]*?\}/g)]
  .map((m) => ({ id: m[1], section: m[2], label: m[3], src: m[0] }));
const sections = [...navSrc.matchAll(/\{\s*key:\s*'([a-z]+)',\s*label:\s*(null|'[^']*')/g)].map((m) => m[1]);
const mobilePrimary = (navSrc.match(/MOBILE_PRIMARY = \[([^\]]*)\]/) || [])[1] || '';

console.log('\nNavigation\n');

check('the config declares every destination in one place', items.length === 11, `${items.length} items`);
check('grouped into workplace sections rather than one flat list',
  sections.length >= 4 && sections.includes('company') && sections.includes('work'),
  sections.join(','));

// ---- every item is mounted, every mount is an item -----------------------------------------
const mounted = [...appSrc.matchAll(/tab === '([a-z]+)'/g)].map((m) => m[1]);
const declared = items.map((i) => i.id).concat(['settings']);
const dead = declared.filter((id) => !mounted.includes(id));
const orphan = [...new Set(mounted)].filter((id) => !declared.includes(id));
check('no navigation item leads nowhere', dead.length === 0, dead.join(','));
check('no screen is mounted that nothing can reach', orphan.length === 0, orphan.join(','));

// ---- the labels are workplace language, not coursework -------------------------------------
const labels = items.map((i) => i.label);
check('the menu speaks the workplace, not the classroom',
  !labels.some((l) => /training|lesson|module|exercise|course|dashboard|overview/i.test(l)),
  labels.join(' | '));
check('Home is called Home', labels.includes('Home'));
check('the assignments live under My Work', items.find((i) => i.id === 'tasks').label === 'My Work');
check('mail is an Inbox', items.find((i) => i.id === 'emails').label === 'Inbox');
check('and the learner\'s own record is Performance',
  items.find((i) => i.id === 'overview').label === 'Performance');

// ---- page headings agree with the menu that led there ---------------------------------------
const headingOf = (file) => {
  const m = read(file).match(/<h1[^>]*>([^<{]+)</);
  return m ? m[1].trim() : null;
};
// Settings had no heading at all before this milestone; it is in the list now so it
// cannot quietly lose one again.
const pages = [
  ['tasks', 'workspace-app/src/components/Tasks.jsx'],
  ['today', 'workspace-app/src/components/Today.jsx'],
  ['emails', 'workspace-app/src/components/Emails.jsx'],
  ['overview', 'workspace-app/src/components/Overview.jsx'],
  ['projects', 'workspace-app/src/components/Projects.jsx'],
  ['team', 'workspace-app/src/components/Team.jsx'],
  ['timesheets', 'workspace-app/src/components/Timesheets.jsx'],
];

// The strip above every page must not carry a heading of its own. It used to, so every
// destination had two h1s -- "Welcome back, Manu" shouting over "My Work".
check('the header strip above every page does not compete for the heading',
  !/<h1/.test(stripComments(read('workspace-app/src/components/Header.jsx'))));
check('and Settings names itself like every other destination',
  headingOf('workspace-app/src/components/SettingsTab.jsx') === 'Settings');

for (const [id, file] of pages) {
  const want = items.find((i) => i.id === id).label;
  check(`the ${want} page calls itself ${want}`, headingOf(file) === want,
    `heading is "${headingOf(file)}"`);
}

// ---- permissions survived the regrouping ------------------------------------------------------
check('Appraisals is gated to lead and above', /id: 'appraisal'[\s\S]{0,200}?minLevel: 'lead'/.test(navSrc));
check('Attendance is gated to lead and above', /id: 'attendance'[\s\S]{0,200}?minLevel: 'lead'/.test(navSrc));
check('and nothing else claims a gate it should not have',
  (navSrc.match(/minLevel:/g) || []).length === 2);
check('the sidebar asks the config rather than filtering by hand',
  /navigationFor\(level\)/.test(sidebarSrc) && !/LEVEL_RANK\[/.test(sidebarSrc));
check('so does the phone bar', /canSee\(/.test(mobileSrc));

// ---- badges count real things -----------------------------------------------------------------
check('every badge is a function of server state, never a constant',
  !/badge:\s*\d/.test(navSrc) && (navSrc.match(/badge:\s*badges\./g) || []).length === 3,
  (navSrc.match(/badge:\s*badges\.\w+/g) || []).join(','));
check('the inbox badge reads the inbox', /unreadMail:\s*\(s\)[^\n]*inbox/.test(navSrc));
check('and a badge that throws does not take the menu down with it',
  /try \{ return item\.badge\(state\)/.test(navSrc));

// ---- the overlap was resolved by moving things, not deleting them -------------------------------
// Today held the day gate, the activities, the chores and the quiz. Overview held the
// promotion ladder. Losing either to a tidier menu is the failure this milestone invites.
const todaySrc = read('workspace-app/src/components/Today.jsx');
const overviewSrc = read('workspace-app/src/components/Overview.jsx');
for (const [what, src, needle] of [
  ['closing the day', todaySrc, 'onCloseDay'],
  ['starting the next day', todaySrc, 'onStartNextDay'],
  ['the day\'s activities', todaySrc, '<Activity'],
  ['the company chores', todaySrc, '<Chore'],
  ['the end-of-project quiz', todaySrc, '<Quiz'],
  ['the promotion ladder', overviewSrc, 'promotion'],
  ['the skill matrix', overviewSrc, 'skillMatrix'],
  ['manager shoutouts', overviewSrc, 'shoutouts'],
  ['career milestones', overviewSrc, 'milestone'],
]) {
  check(`${what} still exists after the regrouping`, src.includes(needle));
}

// ---- the phone --------------------------------------------------------------------------------
check('the phone bar carries the places you actually open on a phone',
  ['workday', 'emails', 'tasks', 'calendar'].every((id) => mobilePrimary.includes(id)), mobilePrimary.trim());
check('and everything else is one tap away in the drawer that already existed',
  /onOpenMenu/.test(mobileSrc) && /setMenuOpen\(true\)/.test(appSrc));
check('there is exactly one drawer, not two competing menus',
  (appSrc.match(/<Sidebar/g) || []).length === 1);

// ---- accessibility ------------------------------------------------------------------------------
check('the current destination is announced, not just coloured',
  /aria-current=\{active \? 'page' : undefined\}/.test(sidebarSrc)
    && /aria-current=\{active \? 'page' : undefined\}/.test(mobileSrc));
check('keyboard focus is visible on every navigation control',
  /focus-visible:ring/.test(sidebarSrc) && /focus-visible:ring/.test(mobileSrc));
check('the icon-only menu button says what it does', /aria-label="Open the full menu"/.test(mobileSrc));
check('and the section headings are attached to the groups they head',
  /aria-labelledby=/.test(sidebarSrc) && /role="group"/.test(sidebarSrc));

// ---- the engine is untouched ----------------------------------------------------------------------
let seq = 0;
function learner(level) {
  seq += 1;
  const uid = cryptoRandomId(), iso = new Date().toISOString();
  db.prepare('INSERT INTO users (id,email,password_hash,password_salt,created_at) VALUES (?,?,?,?,?)').run(uid, `nav${seq}@t.local`, 'x', 'y', iso);
  db.prepare('INSERT INTO profiles (user_id,name,created_at,updated_at) VALUES (?,?,?,?)').run(uid, 'Manu Kumar', iso, iso);
  ws.startEnrollment(uid, { role: 'data_analyst', level, scheduleType: 'weekdays' });
  ws.submitSkillTest(uid, Object.fromEntries(st.QUESTIONS.map((q) => [q.id, q.answer])));
  return uid;
}
const s = ws.getState(learner('junior'));
check('every field the badges read is still on the payload',
  Boolean(s.inbox && s.inbox.counts) && Array.isArray(s.taskBoard.rows) && Boolean(s.day),
  `inbox=${Boolean(s.inbox)} rows=${Array.isArray(s.taskBoard.rows)} day=${Boolean(s.day)}`);
// The badge and the page it points at have to agree. They did not: work whose day has
// not arrived carries a passed due date, so the badge counted six tasks the board itself
// does not call overdue.
check('the attention badge ignores work that has not opened yet',
  /notYetOpen && \(r\.sentBack \|\| r\.overdue\)/.test(navSrc));
check('the owed-today badge can be computed and is not negative',
  ['tasks', 'activities', 'situations'].every((k) => s.day[k] && s.day[k].total >= s.day[k].done));
const board = {};
for (const t of s.tasks) board[t.day_index] = (board[t.day_index] || 0) + 1;
check('still six tasks a day', [1, 2, 3, 4, 5].every((d) => board[d] === 6), [1, 2, 3, 4, 5].map((d) => board[d]).join(','));
check('still thirty tasks in the week', s.tasks.length === 30, String(s.tasks.length));

console.log(fails ? `\n${fails} FAILURE(S)` : '\nAll navigation checks passed.');
process.exit(fails ? 1 : 0);
