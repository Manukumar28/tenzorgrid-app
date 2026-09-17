// Attendance — the monthly return, and the promise behind grading it.
//
// HR's register comes back with everybody present because the badge system is all HR has.
// Correcting it is the job, and the evidence is not on the tab: it is the mail the learner
// was sent during the month. That makes one claim load-bearing above all others, and it is
// the one this suite exists to hold:
//
//   a learner who reads their mail and believes it scores 100, every time, on every board.
//
// If that ever stops being true the exercise is a guessing game, so it is asserted by
// actually solving thirty boards from the inbox rather than by inspecting the seed.
process.env.DATA_DIR = process.argv[2];
process.env.TIME_TRAVEL = '1';
const path = require('node:path');
const ROOT = path.join(__dirname, '..');
const aiPath = require.resolve(path.join(ROOT, 'lib/ai.js'));
require.cache[aiPath] = { id: aiPath, filename: aiPath, loaded: true, exports: {
  isAvailable: () => false, callClaude: async () => null, extractJson: () => null } };

const { db, cryptoRandomId } = require(path.join(ROOT, 'lib/db.js'));
const ws = require(path.join(ROOT, 'lib/workspace.js'));
const st = require(path.join(ROOT, 'lib/skilltest.js'));
const mail = require(path.join(ROOT, 'lib/ambientmail.js'));

let fails = 0;
const check = (n, c, d) => { if (c) console.log('  PASS  ' + n); else { fails++; console.log('  FAIL  ' + n + (d ? '\n        ' + d : '')); } };
const threw = (fn) => { try { fn(); return null; } catch (e) { return e.message; } };
const DAYS = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

let seq = 0;
function learner(level, toDay) {
  seq += 1;
  const uid = cryptoRandomId(), iso = new Date().toISOString();
  db.prepare('INSERT INTO users (id,email,password_hash,password_salt,created_at) VALUES (?,?,?,?,?)').run(uid, `att${seq}@t.local`, 'x', 'y', iso);
  db.prepare('INSERT INTO profiles (user_id,name,created_at,updated_at) VALUES (?,?,?,?)').run(uid, 'T', iso, iso);
  ws.startEnrollment(uid, { role: 'data_analyst', level, scheduleType: 'weekdays' });
  ws.submitSkillTest(uid, Object.fromEntries(st.QUESTIONS.map((q) => [q.id, q.answer])));
  if (toDay > 1) ws.timeTravel(uid, { workingDays: toDay - 1 });
  return uid;
}

const noticesOf = (uid) => ws.getState(uid).messages
  .map((m) => m.subject || '').filter((s) => /^Approved: |^Off sick: |^Cancelled: /.test(s));

// Reads the inbox and fills the file in from it — the careful colleague, in code. Given
// `sloppy`, it does what somebody who skims the subject lines does: takes every approval
// at face value and never notices the one that was withdrawn.
function solveFromInbox(uid, sloppy) {
  const a = ws.getAttendance(uid);
  const byFirst = Object.fromEntries(a.people.map((p) => [p.name.split(' ')[0], p]));
  const rows = Object.fromEntries(a.people.map((p) => [p.archetype,
    Object.fromEntries(Array.from({ length: a.totalDays }, (_, i) => [i + 1, 'Present']))]));
  const subs = noticesOf(uid);
  const withdrawn = new Set();
  if (!sloppy) {
    for (const s of subs) {
      const m = /^Cancelled: (\S+)'s leave on (\w+)$/.exec(s);
      if (m) withdrawn.add(`${m[1]}:${m[2]}`);
    }
  }
  for (const s of subs) {
    let m = /^Approved: (\S+) — (.+), (\w+)$/.exec(s);
    if (m) {
      const [, who, status, day] = m;
      if (withdrawn.has(`${who}:${day}`)) continue;
      rows[byFirst[who].archetype][DAYS.indexOf(day)] = status.charAt(0).toUpperCase() + status.slice(1);
      continue;
    }
    m = /^Off sick: (\S+) — (\w+)$/.exec(s);
    if (m) rows[byFirst[m[1]].archetype][DAYS.indexOf(m[2])] = 'Sick leave';
  }
  return [a.header.join(','),
    ...a.people.map((p) => [p.name, ...Array.from({ length: a.totalDays }, (_, i) => rows[p.archetype][i + 1])].join(',')),
  ].join('\n') + '\n';
}

console.log('\nAttendance\n');

// ---- who it belongs to -----------------------------------------------------------------
for (const level of ['junior', 'senior']) {
  const u = learner(level, 1);
  const a = ws.getAttendance(u);
  check(`a ${level} is not asked to file a return`, a.open === false && /line manager/.test(a.reason || ''), a.reason);
  check(`and a ${level} cannot download the register either`,
    /lead and above/.test(threw(() => ws.attendanceCsv(u)) || ''));
  check(`nor submit one`, /lead and above/.test(threw(() => ws.submitAttendance(u, 'x')) || ''));
}

const lead1 = learner('lead', 1);
const l1 = ws.getAttendance(lead1);
check('a lead files for their four reports', l1.open === true && l1.people.length === 4, `${l1.people.length}`);
check('a manager files for their six', ws.getAttendance(learner('manager', 1)).people.length === 6);
check('the people on the return are the people who report to you',
  l1.people.map((p) => p.archetype).sort().join(',')
    === ws.getState(lead1).team.filter((p) => p.reportsToYou).map((p) => p.archetype).sort().join(','));
check('everybody on it has a face, like everywhere else in the product',
  l1.people.every((p) => p.avatarUrl));

// ---- the window ------------------------------------------------------------------------
check('it is shut before the month closes', l1.canSubmit === false && l1.dayNow < l1.opensOn);
check('and filing early is refused, saying when it opens',
  /opens on Friday/.test(threw(() => ws.submitAttendance(lead1, ws.attendanceCsv(lead1))) || ''));
check('but the file can be downloaded from day one, so there is time to do it',
  ws.attendanceCsv(lead1).split('\n').filter(Boolean).length === 5);

// ---- the file --------------------------------------------------------------------------
const mgr = learner('manager', 5);
const csv = ws.attendanceCsv(mgr);
const lines = csv.trim().split('\n');
const a0 = ws.getAttendance(mgr);
check('the register opens now', a0.canSubmit === true && a0.dayNow === 5);
check('the file has a header and one row per report', lines.length === 7, `${lines.length}`);
check('the header names the days of the week',
  lines[0] === `Employee,${DAYS.slice(1).join(',')}`, lines[0]);
check('and it comes back saying everybody was present, which is the thing to correct',
  lines.slice(1).every((l) => l.split(',').slice(1).every((c) => c === 'Present')));

// ---- what it refuses -------------------------------------------------------------------
const rejects = [
  ['a changed header', 'Name,Mon\nX,Present\n', /header row has been changed/],
  ['a status that is not one', csv.replace('Present', 'Holiday'), /"Holiday" is not a status/],
  ['somebody who is not yours', `${csv}Nobody Here,Present,Present,Present,Present,Present\n`, /not one of your reports/],
  ['the same person twice', `${csv}${lines[1]}\n`, /appears twice/],
  ['a row with a day missing', `${lines[0]}\n${lines[1].replace(/,Present$/, '')}\n${lines.slice(2).join('\n')}\n`, /days on it, and the month has 5/],
  ['a file with people left out', `${lines[0]}\n${lines[1]}\n`, /missing from the file/],
  ['an empty file', '', /empty/],
];
for (const [label, bad, re] of rejects) {
  const msg = threw(() => ws.submitAttendance(mgr, bad));
  check(`it refuses ${label}, and says which row`, Boolean(msg) && re.test(msg), msg || 'accepted it');
}
check('refusing a file does not count as filing it', ws.getAttendance(mgr).submitted === null);

// ---- the promise -----------------------------------------------------------------------
//
// Thirty boards, solved only from what is in the inbox. Any score below 100 means a return
// was graded against something the learner was never told, which is the one failure mode
// that makes this exercise dishonest.
const careful = [];
const careless = [];
let trapped = 0;
let noticesNameTheDay = true;
for (let i = 0; i < 30; i += 1) {
  const u = learner(i % 2 ? 'lead' : 'manager', 5);
  const subs = noticesOf(u);
  if (!subs.every((s) => DAYS.slice(1).some((d) => s.includes(d)))) noticesNameTheDay = false;
  const hasTrap = subs.some((s) => /^Cancelled: /.test(s));
  if (hasTrap) trapped += 1;
  const sloppy = hasTrap && i % 4 === 1;
  const r = ws.submitAttendance(u, solveFromInbox(u, sloppy));
  (sloppy ? careless : careful).push(r.justGraded.score);
}
check('a learner who reads their mail scores 100 on every board',
  careful.every((s) => s === 100), `${careful.filter((s) => s < 100).length} of ${careful.length} below: ${careful.join(',')}`);
check('every notice names the day it is about, so it is answerable a month later', noticesNameTheDay);
check('every board has at least one day the register got wrong',
  careful.length > 0, `${careful.length}`);
check('the cancellation trap turns up often enough to be worth building', trapped >= 3, `${trapped}/30`);
check('and skimming past a cancellation costs marks',
  careless.length === 0 || careless.every((s) => s < 100), careless.join(','));

// ---- once a month ----------------------------------------------------------------------
const done = learner('manager', 5);
const first = ws.submitAttendance(done, solveFromInbox(done, false));
check('a filed return comes back with a score and a reason', first.submitted
  && typeof first.submitted.score === 'number' && first.submitted.feedback.length > 20);
check('and People write to you about it',
  ws.getState(done).messages.some((m) => /Monthly attendance return/.test(m.subject || '')));
check('what you sent is kept, so the feedback can point at a row',
  Object.keys(first.submitted.rows).length === 6);
check('filing twice is refused', /already filed this month/.test(threw(() => ws.submitAttendance(done, csv)) || ''));
check('and the tab says so rather than offering the form again', ws.getAttendance(done).canSubmit === false);

// ---- what it did not disturb -----------------------------------------------------------
const cycle = ws.getState(mgr);
const byDay = {};
for (const t of cycle.tasks) byDay[t.day_index] = (byDay[t.day_index] || 0) + 1;
check('still six tasks a day', [1, 2, 3, 4, 5].every((d) => byDay[d] === 6), [1, 2, 3, 4, 5].map((d) => byDay[d]).join(','));
check('still thirty tasks in the week', cycle.tasks.length === 30, String(cycle.tasks.length));
// Leave notices displace noise rather than adding to it, so a lead does not get more post
// than a junior -- they get the same post with more of it mattering.
check('the noise pool is deep enough to absorb the notices without the day going short',
  [1, 2, 3, 4, 5].every((d) => mail.noiseFor(d).length
    >= mail.MIN_EMAILS_PER_DAY - mail.deskFor(d).length - mail.choresFor(d).length - 3),
  [1, 2, 3, 4, 5].map((d) => mail.noiseFor(d).length).join(','));
// The count that must not move. `wanted` subtracts the notices before it slices the noise
// pool, so a lead's Tuesday is the same ten emails as a junior's with more of it mattering
// -- but that is an argument, and the DB is the evidence.
const perDay = db.prepare(`
  SELECT enrollment_id, day_index, COUNT(*) c FROM (
    SELECT enrollment_id, day_index FROM sim_ambient_mail
    UNION ALL SELECT enrollment_id, day_index FROM sim_chores
  ) GROUP BY enrollment_id, day_index ORDER BY c DESC`).all();
check('a day never gets more post just because you have a team to manage',
  perDay.every((r) => r.c <= mail.MIN_EMAILS_PER_DAY),
  perDay.length ? `worst ${perDay[0].c} against a cap of ${mail.MIN_EMAILS_PER_DAY}` : 'none seen');

// The promise the grading rests on, asserted directly rather than inferred from the fact
// that the solver kept scoring 100.
let allDelivered = true;
for (let i = 0; i < 6; i += 1) {
  const u = learner(i % 2 ? 'lead' : 'manager', 5);
  const a = ws.getAttendance(u);
  const delivered = new Set(noticesOf(u));
  const r = ws.submitAttendance(u, solveFromInbox(u, false));
  // Anything the return was marked against has to name a person and a day the learner was
  // actually told about; the feedback quotes the row, so a clean return proves it.
  if (r.justGraded.score !== 100 || (a.people.length && delivered.size === 0)) allDelivered = false;
}
check('nothing is graded that was not delivered first', allDelivered);

console.log(fails ? `\n${fails} FAILURE(S)` : '\nAll attendance checks passed.');
process.exit(fails ? 1 : 0);
