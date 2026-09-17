// Company, employee and workday context — Milestone 01.
//
// The thing being tested is not a layout, it is a claim: that the workspace can tell a
// learner where they work, who they are there, and what is happening today, using only
// what the simulation already knows. So every assertion below asks the same question in a
// different place — is this sentence derived, or is it decoration?
//
// Two rules carry most of the weight:
//   * nothing in the workday is invented. A headline exists because a count is non-zero.
//   * nothing in the identity is a second copy. Title comes from the role ladder, the
//     manager comes from the roster, the start date comes from the enrolment row.
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
const company = require(path.join(ROOT, 'lib/company.js'));
const roles = require(path.join(ROOT, 'lib/roles.js'));

let fails = 0;
const check = (n, c, d) => { if (c) console.log('  PASS  ' + n); else { fails++; console.log('  FAIL  ' + n + (d ? '\n        ' + d : '')); } };

let seq = 0;
function learner(level, name, toDay) {
  seq += 1;
  const uid = cryptoRandomId(), iso = new Date().toISOString();
  db.prepare('INSERT INTO users (id,email,password_hash,password_salt,created_at) VALUES (?,?,?,?,?)').run(uid, `wd${seq}@t.local`, 'x', 'y', iso);
  db.prepare('INSERT INTO profiles (user_id,name,created_at,updated_at) VALUES (?,?,?,?)').run(uid, name || 'Manu Kumar', iso, iso);
  ws.startEnrollment(uid, { role: 'data_analyst', level, scheduleType: 'weekdays' });
  ws.submitSkillTest(uid, Object.fromEntries(st.QUESTIONS.map((q) => [q.id, q.answer])));
  if (toDay > 1) ws.timeTravel(uid, { workingDays: toDay - 1 });
  return uid;
}

console.log('\nWorkday\n');

// ---- the company is configuration, not UI -----------------------------------------------
const co = company.companyFor('Data & Analytics');
check('the employer has a name, an industry and somewhere to be',
  Boolean(co.name && co.industry && co.primaryLocation && co.primaryLocation.city));
check('its mark is derived from the name, so a rename cannot leave the old initials behind',
  company.companyFor('Data & Analytics', null).mark === 'MA'
    && company.initials('Northgate Data Group') === 'ND');
check('a data role lands in a data department',
  co.org.department === 'Business Analytics' && co.org.team === 'Product & Customer Analytics');
// The whole point of keying the map on the business FUNCTION: another role must not have
// to be special-cased into an org chart written for analysts.
check('a role from another function lands somewhere else entirely',
  company.orgUnitFor('Technology').division !== co.org.division
    && company.orgUnitFor('Finance & Accounting').department !== co.org.department,
  `${company.orgUnitFor('Technology').division} / ${company.orgUnitFor('Finance & Accounting').department}`);
// All nineteen of them, named from the catalogue rather than from a list typed here --
// the day somebody adds a twentieth function, this goes red instead of quietly sending
// that role to the fallback department.
const functions = [...new Set(roles.ROLES.map((r) => r.subcategory))];
check('all nineteen business functions in the catalogue have somewhere to sit',
  functions.length >= 19 && functions.every((f) => company.ORG_BY_FUNCTION[f]),
  `${functions.length} functions, unmapped: ${functions.filter((f) => !company.ORG_BY_FUNCTION[f]).join(', ') || 'none'}`);
check('and an unknown one still produces a readable sentence rather than undefined',
  Boolean(company.orgUnitFor('Something Nobody Wrote').department));

// ---- the employee is derived, never stored twice -----------------------------------------
const junior = learner('junior', 'Manu Kumar', 1);
const e = ws.getState(junior).employee;
check('the employee is named from their own profile', e.name === 'Manu Kumar' && e.firstName === 'Manu');
check('their title is the role ladder\'s, not a copy of it',
  e.title === roles.levelTitle('data_analyst', 'junior'), e.title);
check('they have an employee number in the company\'s own series',
  /^MA-\d{4}$/.test(e.employeeId), e.employeeId);
check('which does not move between reads', ws.getState(junior).employee.employeeId === e.employeeId);
check('their manager is the manager from the roster, not a new character',
  e.manager && e.manager.name === (ws.getState(junior).roster.find((r) => r.archetype === 'line_manager') || {}).name,
  e.manager && e.manager.name);
check('and is described by what they manage', /Manager$/.test(e.manager.title), e.manager.title);
check('their start date is when they actually joined',
  e.startDate === db.prepare('SELECT created_at FROM sim_enrollments WHERE user_id = ?').get(junior).created_at);
check('they are placed in a division, a department and a team', Boolean(e.division && e.department && e.team));
check('and told where they work and how', Boolean(e.location && e.workArrangement));

// A promotion up the ladder has to move the title here too, or identity and progression
// are two systems telling a learner two different things.
const lead = learner('lead', 'Manu Kumar', 1);
check('a learner further up the ladder carries the further-up title',
  ws.getState(lead).employee.title === roles.levelTitle('data_analyst', 'lead')
    && ws.getState(lead).employee.title !== e.title,
  ws.getState(lead).employee.title);
check('two learners get two employee numbers',
  ws.getState(lead).employee.employeeId !== e.employeeId);

// ---- the workday is assembled from real state ---------------------------------------------
const s = ws.getState(junior);
const w = s.workday;
check('the day knows what time of day it is', /morning|afternoon|evening|early|here/i.test(w.greeting), w.greeting);
check('and says the date like a person would', /\d/.test(w.dateLabel) && /[A-Za-z]/.test(w.dateLabel), w.dateLabel);

check('the timeline is a working day, not a list of tasks', w.timeline.length === 7);
check('at most one slot is NOW', w.timeline.filter((x) => x.now).length <= 1);
check('at most one slot is NEXT', w.timeline.filter((x) => x.next).length <= 1);
check('NEXT is never a slot that has already finished or has nothing in it',
  w.timeline.every((x) => !x.next || (!x.past && !x.empty && !x.done)));
check('a focus block names work you could actually be doing',
  w.timeline.filter((x) => x.kind === 'focus').every((x) => x.empty || Boolean(x.taskId)));
check('and an empty slot says so rather than inventing a meeting',
  w.timeline.every((x) => !x.empty || Boolean(x.detail)));

// The headline strip is the claim most at risk of becoming decoration, so it is checked
// against the counts it is supposed to be reading.
const unread = s.inbox.counts.unread;
const mailHeadline = w.headlines.find((h) => h.kind === 'mail');
check('a headline about unread mail matches the actual unread count',
  unread === 0 ? !mailHeadline : Boolean(mailHeadline) && mailHeadline.text.includes(String(unread)),
  `unread=${unread} headline=${mailHeadline && mailHeadline.text}`);
check('every headline is one of the kinds the engine can support',
  w.headlines.every((h) => ['standup', 'returned', 'overdue', 'mail', 'situation'].includes(h.kind)),
  w.headlines.map((h) => h.kind).join(','));
check('and there are never more than four of them', w.headlines.length <= 4);

check('the current assignment is the top of the board, not a second opinion',
  w.assignment && w.assignment.taskId
    === s.taskBoard.rows.filter((r) => r.status !== 'graded' && !r.notYetOpen)[0].id);
check('it names who asked for it and who signs it off',
  Boolean(w.assignment.requestedBy && w.assignment.reviewer), JSON.stringify(w.assignment.requestedBy));
check('the reviewer is the manager', w.assignment.reviewer.name === e.manager.name);
check('the queue never repeats the current assignment',
  w.queue.every((q) => q.taskId !== w.assignment.taskId));
check('and never contains finished work',
  w.queue.every((q) => !['Signed off', 'Graded'].includes(q.state.label)));
check('every queued item carries a workplace state rather than a score',
  w.queue.every((q) => q.state && q.state.label && !/\d+%|XP|difficulty/i.test(q.state.label)),
  w.queue.map((q) => q.state.label).join(' | '));

check('project health reads the project\'s own week',
  w.projectHealth.every((p) => ['on track', 'at risk', 'delivered'].includes(p.health)),
  w.projectHealth.map((p) => p.health).join(','));

// ---- since you were away -----------------------------------------------------------------
check('a first visit has nothing to catch up on', w.sinceAway.items.length === 0 || w.sinceAway.since !== null);
const enr = db.prepare('SELECT id FROM sim_enrollments WHERE user_id = ?').get(junior);
db.prepare('UPDATE sim_presence SET last_seen_at = ?, previous_seen_at = NULL WHERE enrollment_id = ?')
  .run(new Date(Date.now() - 2 * 86400000).toISOString(), enr.id);
const away = ws.getState(junior).workday.sinceAway;
check('coming back after two days shows what happened', away.since !== null && away.items.length > 0,
  `${away.items.length} items`);
check('every item is something that actually has a record behind it',
  away.items.every((i) => ['signoff', 'returned', 'message', 'project'].includes(i.kind)),
  away.items.map((i) => i.kind).join(','));
// Reading the page twice in one sitting must not wipe the summary you came back to read.
const again = ws.getState(junior).workday.sinceAway;
check('and it does not erase itself the moment you click another tab',
  again.since === away.since && again.items.length === away.items.length,
  `${away.items.length} -> ${again.items.length}`);

// ---- the quiet states ---------------------------------------------------------------------
// Everything above runs on a busy board. The page has to survive the opposite.
const fresh = learner('junior', 'Quiet Learner', 1);
const qs = ws.getState(fresh);
check('a learner with nothing urgent still gets a company, a title and a manager',
  Boolean(qs.company.name && qs.employee.title && qs.employee.manager));
check('and a timeline, an assignment and a queue that do not throw',
  qs.workday.timeline.length === 7 && Array.isArray(qs.workday.queue));

// ---- what must not have moved --------------------------------------------------------------
const board = {};
for (const t of s.tasks) board[t.day_index] = (board[t.day_index] || 0) + 1;
check('still six tasks a day', [1, 2, 3, 4, 5].every((d) => board[d] === 6), [1, 2, 3, 4, 5].map((d) => board[d]).join(','));
check('still thirty tasks in the week', s.tasks.length === 30, String(s.tasks.length));
check('every tab the workday links to still exists in the payload',
  ['tasks', 'emails', 'today', 'projects'].every((tab) => {
    if (tab === 'tasks') return Array.isArray(s.taskBoard.rows);
    if (tab === 'emails') return Boolean(s.inbox);
    if (tab === 'today') return Array.isArray(s.situations);
    return Array.isArray(s.projects.projects);
  }));

// ---- the peer-comparison claim -------------------------------------------------------------
// There is no cohort, no peer distribution and nothing that could produce a ranking, so a
// sentence claiming one was a benchmark the product could not honour.
// Comments are stripped first. The note explaining why the sentence was removed quotes
// the sentence, and a check that cannot tell the difference between shipping a claim and
// explaining why you stopped shipping it is not checking anything.
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const uiSrc = fs.readdirSync(path.join(ROOT, 'workspace-app/src/components'))
  .filter((f) => f.endsWith('.jsx'))
  .map((f) => stripComments(fs.readFileSync(path.join(ROOT, 'workspace-app/src/components', f), 'utf8')))
  .join('\n');
check('no screen claims a comparison against other learners',
  !/relative to peers|compared to peers|ahead of peers|peer average|percentile/i.test(uiSrc));

console.log(fails ? `\n${fails} FAILURE(S)` : '\nAll workday checks passed.');
process.exit(fails ? 1 : 0);
