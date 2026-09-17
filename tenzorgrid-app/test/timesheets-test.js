// Timesheets — the first piece of the management cycle.
//
// A timesheet is the dullest thing in an office and the first thing that goes wrong, which
// is exactly why it is worth simulating. Three claims are under test here:
//
//   * everybody files, but only a lead and above sees who else has not
//   * the grid is seeded, so the same learner finds the same person late twice running
//   * chasing is a real message to a real person and it mostly works
//
// The last one matters most. A reminder that changed nothing would teach the opposite of
// the lesson, and a reminder that always worked would teach a different wrong one.
process.env.DATA_DIR = process.argv[2];
const path = require('node:path');
const ROOT = path.join(__dirname, '..');
const aiPath = require.resolve(path.join(ROOT, 'lib/ai.js'));
require.cache[aiPath] = { id: aiPath, filename: aiPath, loaded: true, exports: {
  isAvailable: () => false, callClaude: async () => null, extractJson: () => null } };

const fs = require('node:fs');
const { db, cryptoRandomId } = require(path.join(ROOT, 'lib/db.js'));
const ws = require(path.join(ROOT, 'lib/workspace.js'));
const st = require(path.join(ROOT, 'lib/skilltest.js'));
const mail = require(path.join(ROOT, 'lib/ambientmail.js'));

let fails = 0;
const check = (n, c, d) => { if (c) console.log('  PASS  ' + n); else { fails++; console.log('  FAIL  ' + n + (d ? '\n        ' + d : '')); } };
const threw = (fn) => { try { fn(); return null; } catch (e) { return e.message; } };

function learner(email, level) {
  const uid = cryptoRandomId(), iso = new Date().toISOString();
  db.prepare('INSERT INTO users (id,email,password_hash,password_salt,created_at) VALUES (?,?,?,?,?)').run(uid, email, 'x', 'y', iso);
  db.prepare('INSERT INTO profiles (user_id,name,created_at,updated_at) VALUES (?,?,?,?)').run(uid, 'T', iso, iso);
  ws.startEnrollment(uid, { role: 'data_analyst', level, scheduleType: 'weekdays' });
  ws.submitSkillTest(uid, Object.fromEntries(st.QUESTIONS.map((q) => [q.id, q.answer])));
  return uid;
}

console.log('\nTimesheets\n');

// ---- who sees what ---------------------------------------------------------------------
const jun = learner('ts-jun@t.local', 'junior');
const lead = learner('ts-lead@t.local', 'lead');
const mgr = learner('ts-mgr@t.local', 'manager');

const j = ws.getTimesheets(jun);
const l = ws.getTimesheets(lead);
const m = ws.getTimesheets(mgr);

check('a junior can file their own hours', j.open === true && j.days.length === 5);
check('a junior is shown nobody to chase', j.canChase === false && j.team.length === 0,
  `canChase=${j.canChase} team=${j.team.length}`);
check('a lead sees their four reports', l.canChase === true && l.team.length === 4, `team=${l.team.length}`);
check('a manager sees their six', m.canChase === true && m.team.length === 6, `team=${m.team.length}`);
check('the team on the tab is the team on the Team tab',
  l.team.map((t) => t.archetype).sort().join(',')
    === ws.getState(lead).team.filter((p) => p.reportsToYou).map((p) => p.archetype).sort().join(','));
check('only days that have happened are open to file',
  l.days.filter((d) => d.open).length === l.dayNow, `dayNow=${l.dayNow}`);
check('everybody starts owing the days so far',
  l.mineSubmitted === 0 && l.mineDue === l.dayNow);

// ---- filing your own -------------------------------------------------------------------
const after = ws.submitTimesheet(lead, 1, { hours: 7.5, chargedTo: 'Project delivery', note: 'intake' });
const monday = after.days.find((d) => d.day === 1);
check('filing a day records the hours and the charge code',
  monday.submitted === true && monday.hours === 7.5 && monday.chargedTo === 'Project delivery');
check('and the note comes back with it', monday.note === 'intake');
check('the counter moves', after.mineSubmitted === 1);

const again = ws.submitTimesheet(lead, 1, { hours: 8, chargedTo: 'Line management' });
check('re-filing the same day corrects it rather than duplicating it',
  again.mineSubmitted === 1 && again.days.find((d) => d.day === 1).hours === 8,
  `submitted=${again.mineSubmitted}`);

check('a day outside the week is refused',
  threw(() => ws.submitTimesheet(lead, 9, { hours: 7, chargedTo: 'Project delivery' })) === 'That is not a day of this week.');
check('a day that has not happened yet is refused',
  /has not happened yet/.test(threw(() => ws.submitTimesheet(lead, 5, { hours: 7, chargedTo: 'Project delivery' })) || ''));
check('impossible hours are refused',
  threw(() => ws.submitTimesheet(lead, 1, { hours: 99, chargedTo: 'Project delivery' })) === 'Hours must be between 0 and 24.');
check('an invented charge code is refused',
  threw(() => ws.submitTimesheet(lead, 1, { hours: 7, chargedTo: 'Whatever' })) === 'Choose what the time was charged to.');
check('the charge codes offered are the ones accepted',
  after.chargeCodes.length >= 3 && after.chargeCodes.every((c) => {
    try { ws.submitTimesheet(lead, 1, { hours: 7, chargedTo: c }); return true; } catch { return false; }
  }), after.chargeCodes.join('|'));

// ---- the grid is seeded ----------------------------------------------------------------
const first = ws.getTimesheets(mgr);
const second = ws.getTimesheets(mgr);
check('the same learner finds the same people missing twice running',
  JSON.stringify(first.team.map((t) => [t.archetype, t.missingDays]))
    === JSON.stringify(second.team.map((t) => [t.archetype, t.missingDays])));
check('teamMissing is the sum of what the grid actually shows',
  first.teamMissing === first.team.reduce((n, t) => n + t.missingDays.length, 0),
  `${first.teamMissing}`);
check('every person carries a stated habit',
  first.team.every((t) => typeof t.habit === 'string' && t.habit.length > 0));
check('a filed day carries hours and an unfiled one does not',
  first.team.every((t) => t.days.every((d) => (d.submitted ? typeof d.hours === 'number' : d.hours === null))));
check('the grid only covers days that have happened',
  first.team.every((t) => t.days.length === first.dayNow && t.days.every((d) => d.day <= first.dayNow)));

// The seed has to key on the learner, or every board in the product is the same board.
// Compared on habit rather than on day one's filed/not-filed: six booleans that are mostly
// true will coincide between two learners often enough to redden this suite for no reason,
// where six four-way habits coinciding across three learners is one run in seventeen
// million. Enrollment ids are random, so this is the honest way to assert a seeded thing.
const mgr2 = learner('ts-mgr2@t.local', 'manager');
const mgr3 = learner('ts-mgr3@t.local', 'manager');
const habitsOf = (uid) => ws.getTimesheets(uid).team.map((t) => t.habit).join('|');
const habitVectors = [habitsOf(mgr), habitsOf(mgr2), habitsOf(mgr3)];
check('a different learner gets a differently-seeded team',
  new Set(habitVectors).size > 1, habitVectors.join('  //  '));

// ---- chasing ---------------------------------------------------------------------------
check('a junior may not chase',
  threw(() => ws.remindTimesheet(jun, 'analyst_peer', 1)) === 'Only a lead or above chases timesheets.');
check('you may not chase somebody who does not report to you',
  /does not report to you/.test(threw(() => ws.remindTimesheet(mgr, 'not_a_person', 1)) || ''));

// On day one there are only six cells on a board, and a week where all six happen to be
// filed is a perfectly legal outcome of the seed — so look across all three manager boards
// rather than asserting the first one has a gap, which would redden this suite about one
// run in twelve for no reason at all.
const boards = [[mgr, first], [mgr2, ws.getTimesheets(mgr2)], [mgr3, ws.getTimesheets(mgr3)]];
const withGap = boards.find(([, b]) => b.team.some((t) => t.missingDays.length > 0));
check('somebody across three manager boards is behind on day one of looking', Boolean(withGap),
  boards.map(([, b]) => b.teamMissing).join(','));

if (withGap) {
  const [chaser, board0] = withGap;
  const late = board0.team.find((t) => t.missingDays.length > 0);
  const day = late.missingDays[0];
  const before = ws.getState(chaser).messages.length;
  const res = ws.remindTimesheet(chaser, late.archetype, day);
  check('chasing sends a real message from that person',
    ws.getState(chaser).messages.length === before + 1);
  const msg = ws.getState(chaser).messages.find((x) => x.sender_archetype === late.archetype);
  check('and the message is from the person you chased, not the system',
    Boolean(msg) && msg.sender_name === late.name, msg ? msg.sender_name : 'none');
  check('the reply says whether they filed or not',
    typeof res.lastChase.reply === 'string' && res.lastChase.reply.length > 10);
  check('a reply that claims a day names the day rather than numbering it',
    !res.lastChase.filed || /Monday|Tuesday|Wednesday|Thursday|Friday/.test(res.lastChase.reply),
    res.lastChase.reply);

  const row = res.team.find((t) => t.archetype === late.archetype);
  check('the grid agrees with what they said',
    res.lastChase.filed
      ? !row.missingDays.includes(day) && row.days.find((d) => d.day === day).hours > 0
      : row.missingDays.includes(day) && row.remindedDays.includes(day),
    `filed=${res.lastChase.filed} missing=${row.missingDays.join(',')}`);
  check('the missing count moved only if they actually filed',
    res.teamMissing === board0.teamMissing - (res.lastChase.filed ? 1 : 0),
    `${board0.teamMissing} -> ${res.teamMissing}`);

  const second2 = threw(() => ws.remindTimesheet(chaser, late.archetype, day));
  check('you cannot chase the same day twice',
    /already filed|already chased/.test(second2 || ''), second2 || 'no error');
}

// ---- the hours left the mail --------------------------------------------------------
// Monday and Friday used to open with a timesheet form in the inbox. They moved here, and
// the point of moving them is that the day did not get emptier.
const choreText = JSON.stringify(mail.CHORES);
check('no chore collects hours any more',
  !/[Tt]imesheet — |Hours worked today|Total hours this week/.test(choreText));
check('every day still has exactly one chore',
  [1, 2, 3, 4, 5].every((d) => mail.choresFor(d).length === 1),
  [1, 2, 3, 4, 5].map((d) => mail.choresFor(d).length).join(','));
check('and each replacement still asks for something',
  mail.choresFor(1)[0].action.fields.length >= 1 && mail.choresFor(5)[0].action.fields.length >= 1);
check('the chore keys did not change, so a run mid-flight does not lose its day',
  mail.choreByKey('ch-01') !== null && mail.choreByKey('ch-05') !== null);

// ---- the day cycle is untouched --------------------------------------------------------
// The user's standing rule: 6 tasks, 2 activities, 2 situations, 1 quiz. Adding a tab must
// not have quietly spent one of those slots.
const board = ws.getState(mgr);
const byDay = {};
for (const t of board.tasks) byDay[t.day_index] = (byDay[t.day_index] || 0) + 1;
check('still six tasks a day', [1, 2, 3, 4, 5].every((d) => byDay[d] === 6),
  [1, 2, 3, 4, 5].map((d) => byDay[d]).join(','));
check('still thirty tasks in the week', board.tasks.length === 30, String(board.tasks.length));

console.log(fails ? `\n${fails} FAILURE(S)` : '\nAll timesheet checks passed.');
process.exit(fails ? 1 : 0);
