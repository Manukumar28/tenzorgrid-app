// Appraisal — rating the people who work for you, and promoting one of them.
//
// The tab exists for one claim, and this suite exists to hold it:
//
//   compliance is not performance.
//
// The Timesheets tab is the most legible thing a new manager has about their team and it
// is almost nothing to do with how good anybody is at the job. So the pack carries the
// filing record next to the delivery record, and the strongest performer is always drawn
// from the bottom half of the filing table. A manager who rates from the timesheet column
// gets it backwards, and both of those are asserted by actually rating thirty boards both
// ways rather than by reading the seed.
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

let fails = 0;
const check = (n, c, d) => { if (c) console.log('  PASS  ' + n); else { fails++; console.log('  FAIL  ' + n + (d ? '\n        ' + d : '')); } };
const threw = (fn) => { try { fn(); return null; } catch (e) { return e.message; } };

let seq = 0;
function learner(level, toDay) {
  seq += 1;
  const uid = cryptoRandomId(), iso = new Date().toISOString();
  db.prepare('INSERT INTO users (id,email,password_hash,password_salt,created_at) VALUES (?,?,?,?,?)').run(uid, `ap${seq}@t.local`, 'x', 'y', iso);
  db.prepare('INSERT INTO profiles (user_id,name,created_at,updated_at) VALUES (?,?,?,?)').run(uid, 'T', iso, iso);
  ws.startEnrollment(uid, { role: 'data_analyst', level, scheduleType: 'weekdays' });
  ws.submitSkillTest(uid, Object.fromEntries(st.QUESTIONS.map((q) => [q.id, q.answer])));
  if (toDay > 1) ws.timeTravel(uid, { workingDays: toDay - 1 });
  return uid;
}

// Two readers of the same pack. One rates the delivery record; one rates the timesheet
// column, which is the mistake the tab is built around.
const byWork = (p) => p.onTime + p.review * 10 + p.delivered * 2 - p.rework * 5;
const byFiling = (p) => p.timesheetsFiled * 100 - p.rework;
function rate(uid, how) {
  const a = ws.getAppraisal(uid);
  const ranked = [...a.people].sort((x, y) => how(y) - how(x));
  const out = {};
  ranked.forEach((p, i) => {
    const rating = i === 0 ? 'Outstanding'
      : i === 1 ? 'Exceeds expectations'
        : (i === ranked.length - 1 && p.onTime < 62) ? 'Below expectations' : 'Meets expectations';
    out[p.archetype] = { rating, justification: `${p.delivered} deliverables, ${p.onTime}% on time, review ${p.review}, ${p.rework} reworks.` };
  });
  return out;
}

console.log('\nAppraisal\n');

// ---- who it belongs to -----------------------------------------------------------------
for (const level of ['junior', 'senior']) {
  const u = learner(level, 1);
  const a = ws.getAppraisal(u);
  check(`a ${level} does not write appraisals`, a.open === false && /line manager/.test(a.reason || ''), a.reason);
  check(`and cannot pull the pack`, /lead and above/.test(threw(() => ws.appraisalCsv(u)) || ''));
  check(`nor rate anybody`, /lead and above/.test(threw(() => ws.submitAppraisal(u, {})) || ''));
  check(`nor promote anybody`, /manager decision/.test(threw(() => ws.promotePerson(u, 'analyst_peer', 'x')) || ''));
}
const leadEarly = learner('lead', 1);
const le = ws.getAppraisal(leadEarly);
check('a lead rates their four', le.open === true && le.people.length === 4, `${le.people.length}`);
check('but a lead cannot promote — that is the manager rung', le.canPromote === false);
check('and promoting is refused at the engine, not just hidden',
  /manager decision/.test(threw(() => ws.promotePerson(leadEarly, le.people[0].archetype, 'x'.repeat(50))) || ''));
check('the window is shut before the cycle closes', le.canSubmit === false);
check('and rating early is refused, saying when it opens',
  /opens on Friday/.test(threw(() => ws.submitAppraisal(leadEarly, rate(leadEarly, byWork))) || ''));
check('but the pack can be pulled from day one', ws.appraisalCsv(leadEarly).split('\n').filter(Boolean).length === 5);

// ---- the pack --------------------------------------------------------------------------
const mgr = learner('manager', 5);
const a0 = ws.getAppraisal(mgr);
const pack = ws.appraisalCsv(mgr).trim().split('\n');
check('the window is open on the last day', a0.canSubmit === true && a0.canPromote === true);
check('the pack has a header and one row each', pack.length === 7, `${pack.length}`);
check('it is in name order, not rank order — the answer is not in the file',
  (() => { const names = pack.slice(1).map((l) => l.split(',')[0]); return names.join() === [...names].sort((x, y) => x.localeCompare(y)).join(); })(),
  pack.slice(1).map((l) => l.split(',')[0]).join(' | '));
// "Analyst, Data Quality" is a real title on this roster and it has a comma in it.
check('a job title with a comma in it does not shift every column after it',
  pack.every((l) => (l.match(/,/g) || []).length === 6 || /"/.test(l)),
  pack.find((l) => (l.match(/,/g) || []).length !== 6) || '');
check('and that row is quoted rather than mangled',
  !pack.some((l) => /^[^,]*,Analyst, Data Quality,/.test(l)));
check('the filing record in the pack is the one the Timesheets tab shows',
  (() => {
    const ts = ws.getTimesheets(mgr);
    return a0.people.every((p) => {
      const row = ts.team.find((t) => t.archetype === p.archetype);
      return row && row.days.filter((d) => d.submitted).length === p.timesheetsFiled;
    });
  })());

// ---- what it refuses -------------------------------------------------------------------
const good = rate(mgr, byWork);
const tweak = (fn) => { const r = JSON.parse(JSON.stringify(good)); fn(r, Object.keys(r)); return r; };
const rejects = [
  ['a board with somebody unrated', tweak((r, k) => { delete r[k[0]]; }), /has no rating yet/],
  ['a reason too thin to send', tweak((r, k) => { r[k[0]].justification = 'Good.'; }), /needs a reason/],
  ['a reason that cites nothing', tweak((r, k) => { r[k[0]].justification = 'They were excellent and everybody likes them a lot.'; }), /does not cite anything/],
  ['two Outstandings', tweak((r, k) => { r[k[0]].rating = 'Outstanding'; r[k[1]].rating = 'Outstanding'; }), /can be Outstanding/],
  ['everybody exceeding', tweak((r) => { for (const v of Object.values(r)) v.rating = 'Exceeds expectations'; }), /above Meets expectations/],
  ['an invented rating', tweak((r, k) => { r[k[0]].rating = 'Superb'; }), /has no rating yet/],
];
for (const [label, bad, re] of rejects) {
  const msg = threw(() => ws.submitAppraisal(mgr, bad));
  check(`it refuses ${label}`, Boolean(msg) && re.test(msg), msg || 'accepted it');
}
check('refusing a board does not count as rating it', ws.getAppraisal(mgr).submitted === null);
check('and promoting before rating is refused',
  /Rate the board first/.test(threw(() => ws.promotePerson(mgr, a0.people[0].archetype, 'x'.repeat(50))) || ''));

// ---- the claim -------------------------------------------------------------------------
const fromWork = [];
const fromFiling = [];
let starWasTopFiler = 0;
let boardsWhereFilingVaries = 0;
for (let i = 0; i < 30; i += 1) {
  const u = learner(i % 2 ? 'lead' : 'manager', 5);
  const people = ws.getAppraisal(u).people;
  const best = [...people].sort((x, y) => byWork(y) - byWork(x))[0];
  const topFiled = Math.max(...people.map((p) => p.timesheetsFiled));
  const lowFiled = Math.min(...people.map((p) => p.timesheetsFiled));
  // A board where everybody filed the same number of days has no misleading column to
  // be misled by, so the claim is only made where there is something to get wrong.
  if (topFiled !== lowFiled) {
    boardsWhereFilingVaries += 1;
    if (best.timesheetsFiled === topFiled) starWasTopFiler += 1;
  }
  const how = i % 3 === 1 ? byFiling : byWork;
  const r = ws.submitAppraisal(u, rate(u, how));
  (how === byWork ? fromWork : fromFiling).push(r.justGraded.score);
}
check('a manager who rates the delivery record is right every time',
  fromWork.every((s) => s === 100), `${fromWork.filter((s) => s < 100).length} of ${fromWork.length} below 100: ${fromWork.join(',')}`);
// Stated as an average rather than per board, because it is an average. On roughly one
// board in fifty -- nearly always a four-person lead board, where there are only three
// distinct tiers to get wrong -- the filing order and the delivery order coincide and a
// manager rating the wrong column is accidentally right. That is a coincidence, not a
// hole: the mechanism underneath it is asserted absolutely, two checks down.
const avgFiling = Math.round(fromFiling.reduce((a, b) => a + b, 0) / Math.max(1, fromFiling.length));
check('a manager who rates the timesheet column instead averages about a third of that',
  fromFiling.length >= 10 && avgFiling < 60,
  `avg ${avgFiling} over ${fromFiling.length} boards: ${fromFiling.join(',')}`);
check('and most boards punish it outright',
  fromFiling.filter((s) => s < 100).length >= fromFiling.length - 1,
  `${fromFiling.filter((s) => s === 100).length} of ${fromFiling.length} came out clean by coincidence`);
check('wherever the filing column says anything, the best performer is never the best filer',
  starWasTopFiler === 0 && boardsWhereFilingVaries >= 20,
  `${starWasTopFiler} of ${boardsWhereFilingVaries} boards had them as the same person`);

// ---- promotion -------------------------------------------------------------------------
const boss = learner('manager', 5);
const filed = ws.submitAppraisal(boss, rate(boss, byWork));
check('a rated board comes back with a score and a reason',
  filed.submitted && typeof filed.submitted.score === 'number' && filed.submitted.feedback.length > 20);
check('rating twice is refused', /already rated this cycle/.test(threw(() => ws.submitAppraisal(boss, good)) || ''));

const ratings = filed.submitted.ratings;
const top = Object.keys(ratings).find((k) => ratings[k].rating === 'Outstanding');
const middling = Object.keys(ratings).find((k) => ratings[k].rating === 'Meets expectations');
check('you cannot promote somebody you just told they are meeting the bar',
  /cannot promote somebody/.test(threw(() => ws.promotePerson(boss, middling, 'x'.repeat(50))) || ''));
check('a promotion with no case is refused',
  /needs a case/.test(threw(() => ws.promotePerson(boss, top, 'because')) || ''));
check('and you cannot promote somebody who is not yours',
  /does not report to you/.test(threw(() => ws.promotePerson(boss, 'nobody', 'x'.repeat(50))) || ''));

const before = ws.getState(boss).team.find((p) => p.archetype === top);
const done = ws.promotePerson(boss, top, 'Strongest delivery record on the board and has been operating a level up all cycle.');
check('a promotion goes through and steps the title up once',
  done.justPromoted.to !== done.justPromoted.from && done.justPromoted.to.length > 0,
  `${done.justPromoted.from} -> ${done.justPromoted.to}`);
check('it is one a cycle',
  /One promotion a cycle/.test(threw(() => {
    const other = Object.keys(ratings).find((k) => k !== top && ratings[k].rating === 'Exceeds expectations');
    return ws.promotePerson(boss, other, 'x'.repeat(50));
  }) || ''));
check('and the same person cannot be promoted twice',
  /already been promoted|One promotion a cycle/.test(threw(() => ws.promotePerson(boss, top, 'x'.repeat(50))) || ''));

// The title has to change everywhere, or the product is disagreeing with itself.
const after = ws.getState(boss).team.find((p) => p.archetype === top);
check('the Team tab shows the new title', after.title === done.justPromoted.to, `${before.title} -> ${after.title}`);
check('and says the person was promoted, so it does not read as a bug', after.promoted === true);
check('the timesheet grid agrees', ws.getTimesheets(boss).team.find((p) => p.archetype === top).title === done.justPromoted.to);
check('the attendance register agrees', ws.getAttendance(boss).people.find((p) => p.archetype === top).title === done.justPromoted.to);
check('so does the pack next time it is pulled',
  ws.appraisalCsv(boss).includes(done.justPromoted.to));
check('they write to say thank you, because somebody just changed their life a bit',
  ws.getState(boss).messages.some((m) => m.sender_archetype === top && /Thank you/i.test(m.subject || '')));
check('and People confirm it in writing',
  ws.getState(boss).messages.some((m) => /promotion confirmed/i.test(m.subject || '')));

// ---- what it did not disturb -----------------------------------------------------------
const cycle = ws.getState(mgr);
const byDay = {};
for (const t of cycle.tasks) byDay[t.day_index] = (byDay[t.day_index] || 0) + 1;
check('still six tasks a day', [1, 2, 3, 4, 5].every((d) => byDay[d] === 6), [1, 2, 3, 4, 5].map((d) => byDay[d]).join(','));
check('still thirty tasks in the week', cycle.tasks.length === 30, String(cycle.tasks.length));

console.log(fails ? `\n${fails} FAILURE(S)` : '\nAll appraisal checks passed.');
process.exit(fails ? 1 : 0);
