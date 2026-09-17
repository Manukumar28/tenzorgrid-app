// Assignments — Milestone 04.
//
// A derivation layer over 480 live tasks. Two things can go wrong with that and only one
// of them is a crash:
//
//   1. a task gets no context, or context that points at somebody who does not exist
//   2. a task gets context that is WRONG in a way that reads as nonsense -- a Finance
//      stakeholder requesting an HR coaching conversation, a chart assignment whose
//      deliverable says "write SQL", a junior signing off an executive release
//
// The second is the dangerous one, because nothing throws. So this suite audits all 480
// live assignments rather than sampling, and asserts the specific absurdities by name.
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
const asg = require(path.join(ROOT, 'lib/assignments.js'));

let fails = 0;
const check = (n, c, d) => { if (c) console.log('  PASS  ' + n); else { fails++; console.log('  FAIL  ' + n + (d ? '\n        ' + d : '')); } };
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const stripComments = (src) => src
  .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

console.log('\nAssignments\n');

// ---- build every live assignment, once ---------------------------------------------------
const roster = ws.ROSTER;
const projectOf = {};
for (const list of Object.values(ws.PROJECT_CATALOG)) {
  for (const p of list) for (const k of p.taskKeys) projectOf[k] = p;
}
const live = Object.entries(ws.TASKS).filter(([k]) => projectOf[k]);
const built = live.map(([key, def]) => ({
  key, def,
  a: asg.build({ taskDef: def, task: { title: def.title, brief: def.brief }, project: projectOf[key], roster }),
}));

check('every live task is covered', built.length === 480, `${built.length}`);
check('and the reserve content the catalogue does not use is left alone',
  Object.keys(ws.TASKS).length - built.length === 122, `${Object.keys(ws.TASKS).length - built.length} unused`);

// ---- nothing is missing ---------------------------------------------------------------------
const names = new Set(roster.map((p) => p.name));
check('every assignment names a requester', built.every((b) => b.a.requestedBy && b.a.requestedBy.name));
check('and that requester is a real person on the roster',
  built.every((b) => names.has(b.a.requestedBy.name)),
  built.filter((b) => !names.has(b.a.requestedBy.name)).slice(0, 3).map((b) => b.key).join(','));
check('every assignment names a reviewer', built.every((b) => b.a.reviewer && b.a.reviewer.name));
check('every assignment belongs to a project', built.every((b) => b.a.project && b.a.project.title));
check('every assignment says why the business cares', built.every((b) => b.a.why && b.a.why.length > 40),
  built.filter((b) => !b.a.why).slice(0, 3).map((b) => b.key).join(','));
check('and every one says what is being handed over', built.every((b) => b.a.deliverable && b.a.deliverable.length > 10));
check('the ask is the authored brief, not a paraphrase of it',
  built.every((b) => b.a.request === b.def.brief));

// ---- the absurdities, by name -----------------------------------------------------------------
const bad = (label, fn) => {
  const hits = built.filter(fn);
  check(label, hits.length === 0, hits.slice(0, 4).map((b) => `${b.key} → ${b.a.requestedBy.name}`).join(' | '));
};
// Coaching a junior and staffing a week come down the line. A business stakeholder asking
// for either is the exact nonsense a naive template produces.
bad('no stakeholder requests a coaching conversation',
  (b) => b.def.tool === 'coach' && b.a.requestedBy.archetype !== 'line_manager');
bad('no stakeholder staffs your week for you',
  (b) => b.def.tool === 'assign' && b.a.requestedBy.archetype !== 'line_manager');
bad('no chart assignment asks for SQL as its deliverable',
  (b) => b.def.tool === 'chart' && /\bSQL\b|\bquery\b/i.test(b.a.deliverable));
bad('no SQL assignment asks for a chart as its deliverable',
  (b) => b.def.tool === 'sql' && /chart|visual/i.test(b.a.deliverable));
// The manager IS the requester on 110 live tasks, and that is not a bug: two projects
// declare her their stakeholder (headcount-trends, headcount-case) and other briefs say
// outright that she asked. What the brief warns against is her becoming the requester
// merely BECAUSE she reviews -- a fallback that quietly makes everything hers. So her
// being asked-and-reviewer has to be traceable to authored content every single time.
const managerAsked = built.filter((b) => b.a.requestedBy.archetype === 'line_manager' && b.a.source === 'business');
check('the manager is only ever the requester because something authored says so',
  managerAsked.every((b) => {
    const proj = projectOf[b.key];
    if (proj && proj.stakeholder === 'line_manager') return true;   // the project is hers
    const opening = String(b.def.brief || '').split(/(?<=[.?!])\s/).slice(0, 2).join(' ');
    return /Asha[^.]{0,90}\b(wants?|needs?|has asked|asked|is asking|would like|requires?)\b/i.test(opening);
  }),
  managerAsked.filter((b) => {
    const proj = projectOf[b.key];
    if (proj && proj.stakeholder === 'line_manager') return false;
    const opening = String(b.def.brief || '').split(/(?<=[.?!])\s/).slice(0, 2).join(' ');
    return !/Asha[^.]{0,90}\b(wants?|needs?|has asked|asked|is asking|would like|requires?)\b/i.test(opening);
  }).slice(0, 4).map((b) => b.key).join(','));
check('and she reviews everything, which is the distinction the two fields exist for',
  built.every((b) => b.a.reviewer.archetype === 'line_manager'));
bad('no deliverable is the word "task"', (b) => /\btask\b/i.test(b.a.deliverable));
// Being mentioned is not the same as having asked. "Ravi has sent through the headline
// figure" makes Ravi the subject, and taking him as the requester was this layer's first
// bug. The risky path is the one where a brief OVERRIDES the project's own stakeholder --
// 27 tasks do -- so that is where the evidence has to be.
const overrides = built.filter((b) => {
  const proj = projectOf[b.key];
  return b.a.source === 'business' && proj && b.a.requestedBy.archetype !== proj.stakeholder;
});
check('a brief only overrides the project stakeholder when it says that person asked',
  overrides.length > 0 && overrides.every((b) => {
    const opening = String(b.def.brief || '').split(/(?<=[.?!])\s/).slice(0, 2).join(' ');
    const first = b.a.requestedBy.name.split(' ')[0];
    const at = opening.indexOf(first);
    return at >= 0 && /\b(wants?|needs?|has asked|have asked|asked|is asking|are asking|would like|requires?)\b/i
      .test(opening.slice(at, at + 90));
  }),
  `${overrides.length} overrides, bad: ${overrides.filter((b) => {
    const opening = String(b.def.brief || '').split(/(?<=[.?!])\s/).slice(0, 2).join(' ');
    const at = opening.indexOf(b.a.requestedBy.name.split(' ')[0]);
    return at < 0 || !/\b(wants?|needs?|asked|is asking|would like|requires?)\b/i.test(opening.slice(at, at + 90));
  }).slice(0, 4).map((b) => b.key).join(',')}`);

// ---- determinism --------------------------------------------------------------------------------
const again = live.map(([key, def]) => asg.build({
  taskDef: def, task: { title: def.title, brief: def.brief }, project: projectOf[key], roster,
}));
check('the same task is the same assignment every single time',
  built.every((b, i) => JSON.stringify(b.a) === JSON.stringify(again[i])));
check('and no randomness is reachable from this layer',
  !/Math\.random|Date\.now\(\)/.test(stripComments(read('lib/assignments.js'))));

// ---- source split ---------------------------------------------------------------------------------
const fromLine = built.filter((b) => b.a.source === 'line');
check('work that comes down the line is marked as such', fromLine.length === 60, `${fromLine.length}`);
check('and it is exactly the coaching and the staffing',
  fromLine.every((b) => ['coach', 'assign'].includes(b.def.tool)));
const requesters = new Set(built.map((b) => b.a.requestedBy.archetype));
check('more than one kind of person asks for work',
  requesters.size >= 5, [...requesters].join(','));

// ---- a sample across levels and types, printed for the record --------------------------------------
console.log('\n  — sample —');
for (const tool of ['sql', 'python', 'chart', 'choice', 'writeup', 'coach', 'assign', 'signoff']) {
  const b = built.find((x) => x.def.tool === tool);
  if (!b) continue;
  console.log(`  ${tool.padEnd(8)} ${b.key}  "${b.a.title}"`);
  console.log(`           ${b.a.source === 'line' ? 'from' : 'for'} ${b.a.requestedBy.name} (${b.a.requestedBy.title}) · reviewed by ${b.a.reviewer.name}`);
  console.log(`           deliverable: ${b.a.deliverable}`);
}
console.log('');

// ---- it reaches the surfaces ------------------------------------------------------------------------
let seq = 0;
function learner(level, toDay) {
  seq += 1;
  const uid = cryptoRandomId(), iso = new Date().toISOString();
  db.prepare('INSERT INTO users (id,email,password_hash,password_salt,created_at) VALUES (?,?,?,?,?)').run(uid, `as${seq}@t.local`, 'x', 'y', iso);
  db.prepare('INSERT INTO profiles (user_id,name,created_at,updated_at) VALUES (?,?,?,?)').run(uid, 'Manu Kumar', iso, iso);
  ws.startEnrollment(uid, { role: 'data_analyst', level, scheduleType: 'weekdays' });
  ws.submitSkillTest(uid, Object.fromEntries(st.QUESTIONS.map((q) => [q.id, q.answer])));
  if (toDay > 1) ws.timeTravel(uid, { workingDays: toDay - 1 });
  return uid;
}
for (const level of ['junior', 'senior', 'lead', 'manager']) {
  const u = learner(level, 3);
  const s = ws.getState(u);
  check(`a ${level}'s board carries a requester on every row`,
    s.taskBoard.rows.every((r) => r.assignment && r.assignment.requestedBy),
    s.taskBoard.rows.filter((r) => !(r.assignment && r.assignment.requestedBy)).length + ' without');
  const open = s.taskBoard.rows.find((r) => r.status !== 'graded' && !r.notYetOpen);
  if (open) {
    const wb = ws.getWorkbench(u, open.id);
    check(`and a ${level} opening one gets the full context`,
      Boolean(wb.assignment && wb.assignment.why && wb.assignment.deliverable && wb.assignment.requestedBy));
    check(`the bench and the board agree on who asked (${level})`,
      wb.assignment.requestedBy.name === open.assignment.requestedBy);
  }
  // "Task owners" is a count of who actually asked, so it has to be countable off the
  // rows themselves. It used to credit every row on a project to that project's
  // stakeholder, which hid the manager's own coaching and staffing requests entirely.
  const tally = {};
  for (const r of s.taskBoard.rows) {
    const a = r.assignment && r.assignment.requestedByArchetype;
    if (a) tally[a] = (tally[a] || 0) + 1;
  }
  const panel = Object.fromEntries(s.taskBoard.taskSources.map((x) => [x.archetype, x.assigned]));
  const keys = [...new Set([...Object.keys(tally), ...Object.keys(panel)])].sort();
  check(`a ${level}'s task owners panel counts the rows it is a summary of`,
    keys.every((k) => tally[k] === panel[k]), `rows ${JSON.stringify(tally)} vs panel ${JSON.stringify(panel)}`);
  check(`and its totals add back up to the board (${level})`,
    s.taskBoard.taskSources.reduce((n, x) => n + x.assigned, 0) === s.taskBoard.rows.length);
}
// A lead is handed coaching and staffing work by her own manager, so her board must name
// more than one requester -- the bug this panel had was invisible on a junior's board.
{
  const s = ws.getState(learner('lead', 3));
  check('a lead sees work from more than one person',
    s.taskBoard.taskSources.length > 1, s.taskBoard.taskSources.map((x) => `${x.name}:${x.assigned}`).join(', '));
  check('and the line manager is among them',
    s.taskBoard.taskSources.some((x) => x.archetype === 'line_manager'));
  check('the work she is handed directly is marked as coming from the line, not for a client',
    s.taskBoard.rows.filter((r) => r.assignment && r.assignment.fromTheLine)
      .every((r) => r.assignment.requestedByArchetype === 'line_manager'));
}
const home = ws.getState(learner('junior', 2)).workday.assignment;
check('Home carries the same summary and a deliverable',
  Boolean(home && home.assignment && home.assignment.requestedBy && home.deliverable));

// ---- no duplicated logic in the UI -------------------------------------------------------------------
for (const [file, label] of [
  ['workspace-app/src/components/AppShell.jsx', 'the application shell'],
  ['workspace-app/src/components/WorkdayHome.jsx', 'Home'],
  ['workspace-app/src/components/taskCards.jsx', 'the assignment card'],
  ['workspace-app/src/components/taskPanels.jsx', 'the focus list'],
]) {
  const src = stripComments(read(file));
  check(`${label} renders the assignment rather than deriving one`,
    !/stakeholderArchetype|PROJECT_DOCS|requesterFor|scenario:/.test(src));
}
check('difficulty is gone from the work surfaces, and only from the surfaces',
  !/task\.difficulty/.test(stripComments(read('workspace-app/src/components/taskCards.jsx')))
    && /difficulty/.test(read('lib/workspace.js')));
check('and no work surface calls anything a challenge, a level or a quiz',
  !/\b(challenge|quest|XP\b|correct answer|lesson)\b/i.test(
    stripComments(read('workspace-app/src/components/taskCards.jsx'))
    + stripComments(read('workspace-app/src/components/Workbench.jsx'))
    + stripComments(read('workspace-app/src/components/AppShell.jsx'))));

// ---- pedagogy is untouched ------------------------------------------------------------------------------
const s2 = ws.getState(learner('junior', 1));
const byDay = {};
for (const t of s2.tasks) byDay[t.day_index] = (byDay[t.day_index] || 0) + 1;
check('still six tasks a day', [1, 2, 3, 4, 5].every((d) => byDay[d] === 6), [1, 2, 3, 4, 5].map((d) => byDay[d]).join(','));
check('still thirty tasks in the week', s2.tasks.length === 30);
check('the engine still knows every task\'s difficulty and estimate',
  live.every(([, d]) => d.difficulty || d.estHours));
check('and every grader payload survived untouched',
  live.filter(([, d]) => d.tool === 'sql').every(([, d]) => d.referenceSql));

console.log(fails ? `\n${fails} FAILURE(S)` : '\nAll assignment checks passed.');
process.exit(fails ? 1 : 0);
