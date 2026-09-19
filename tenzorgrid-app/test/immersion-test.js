// Immersion and realism — Milestone 08.
//
// M08 asks one question: would somebody who knew nothing about how this was built
// experience a believable workplace, or notice they are inside a training product?
//
// Most of that is a judgement made by looking at screens, which is where the milestone
// started and where the findings came from. This suite holds the parts of the answer that
// are mechanical, because those are the ones that rot quietly:
//
//   1. a deadline is a day you could actually have met it on            (the §1 P0)
//   2. reading a page does not change the world                         (§38)
//   3. a record that leaves this product says what it is                (§24)
//   4. a claim composed from evidence is checked against that evidence  (§25)
//   5. what a learner wrote about themselves stays theirs               (§26)
//   6. one coaching session is not "running the project"                (§30)
//   7. the product does not talk like a course                          (§1)
//
// The vocabulary check at the end is a source scan, and deliberately blunt. A blunt guard
// that occasionally needs a word added to its allow-list is worth more than a clever one
// that lets "Suggested learning path" back onto the Performance page.
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
const perf = require(path.join(ROOT, 'lib/performance.js'));
const vault = require(path.join(ROOT, 'lib/vault.js'));
const { finishWholeProject } = require(path.join(__dirname, 'answers.js'));

let fails = 0;
const check = (n, c, d) => { if (c) console.log('  PASS  ' + n); else { fails++; console.log('  FAIL  ' + n + (d ? '\n        ' + d : '')); } };

console.log('\nImmersion and realism\n');

let seq = 0;
function learner(level) {
  seq += 1;
  const uid = cryptoRandomId(), iso = new Date().toISOString();
  db.prepare('INSERT INTO users (id,email,password_hash,password_salt,created_at) VALUES (?,?,?,?,?)')
    .run(uid, `im${seq}@t.local`, 'x', 'y', iso);
  db.prepare('INSERT INTO profiles (user_id,name,created_at,updated_at) VALUES (?,?,?,?)')
    .run(uid, 'Manu Kumar', iso, iso);
  ws.startEnrollment(uid, { role: 'data_analyst', level: level || 'junior', scheduleType: 'weekdays' });
  ws.submitSkillTest(uid, Object.fromEntries(st.QUESTIONS.map((q) => [q.id, q.answer])));
  return uid;
}
const enrollOf = (uid) => ws.getEnrollment(uid);
const isWeekendIso = (iso) => { const d = new Date(iso); return d.getUTCDay() === 0 || d.getUTCDay() === 6; };

(async () => {

// ---- 1. a deadline you could actually have met ------------------------------------------
//
// The finding that started this milestone. due_at used to be assigned_at + dueInDays in
// plain CALENDAR days, while opens_at walked forward through WORKING days. Two calendars,
// one task. Every piece of work with an opening day was already past its deadline on the
// morning it appeared, and one deadline in six landed on a day the calendar itself shades
// as a weekend.
//
// This is asserted over the whole catalogue rather than a sample, because the failure was
// uniform and nobody noticed for months.
{
  const uid = learner('junior');
  const rows = db.prepare('SELECT * FROM sim_tasks WHERE enrollment_id = ?').all(enrollOf(uid).id);
  const withBoth = rows.filter((t) => t.due_at && t.opens_at);
  check('the learner has work with both an opening day and a deadline', withBoth.length > 0, `${withBoth.length}`);

  const early = withBoth.filter((t) => Date.parse(t.due_at) < Date.parse(t.opens_at));
  check('no deadline falls before the task it belongs to opens', early.length === 0,
    early.slice(0, 3).map((t) => `${t.title}: opens ${t.opens_at.slice(0, 10)}, due ${t.due_at.slice(0, 10)}`).join('; '));

  const weekend = rows.filter((t) => t.due_at && isWeekendIso(t.due_at));
  check('no deadline falls on a Saturday or Sunday', weekend.length === 0,
    weekend.slice(0, 3).map((t) => `${t.title} due ${t.due_at.slice(0, 10)}`).join('; '));

  // The one that matters to the learner: do the work on the day it lands, and you are on
  // time. Measured at 5pm on the opening day, which is the latest a normal day would end.
  const lateOnArrival = withBoth.filter(
    (t) => Date.parse(t.opens_at) + 17 * 3600 * 1000 > Date.parse(t.due_at),
  );
  check('work done on the day it opens is never recorded late', lateOnArrival.length === 0,
    `${lateOnArrival.length} of ${withBoth.length}`);

  // And the deadline stays inside the week it belongs to, rather than drifting past it.
  const outside = rows.filter((t) => t.due_at && t.day_index && t.opens_at
    && Date.parse(t.due_at) - Date.parse(t.opens_at) > 7 * 24 * 3600 * 1000);
  check('and never more than a week past its own opening day', outside.length === 0, `${outside.length}`);
}

// ---- 2. reading a page does not change the world (§38) ------------------------------------
//
// getState() IS this product's clock. There is no scheduler: the day's mail arrives, the
// week advances, the project closes, the meeting is scheduled and the experience entries
// are written, all on a read. That is a deliberate design and it is why a learner who
// leaves for a week comes back to a workplace that moved.
//
// What makes it safe rather than reckless is that every one of those writes is idempotent
// by construction -- a UNIQUE source key and an insertOnce that swallows exactly that
// violation. This is the assertion that keeps it true: after the first read settles, a
// second read adds nothing, anywhere.
{
  const uid = learner('junior');
  await finishWholeProject(ws, db, uid);

  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'sim_%'").all()
    .map((r) => r.name)
    .filter((t) => { try { db.prepare(`SELECT enrollment_id FROM ${t} LIMIT 1`).get(); return true; } catch { return false; } });
  const census = () => Object.fromEntries(tables.map((t) => [
    t, db.prepare(`SELECT COUNT(*) c FROM ${t} WHERE enrollment_id = ?`).get(enrollOf(uid).id).c]));

  ws.getState(uid);                 // let the first read do whatever it is going to do
  const before = census();
  for (let i = 0; i < 5; i++) ws.getState(uid);
  const after = census();

  const moved = tables.filter((t) => before[t] !== after[t]);
  check('five more reads of the same state write nothing new', moved.length === 0,
    moved.map((t) => `${t}: ${before[t]} -> ${after[t]}`).join('; '));

  // The one table that is SUPPOSED to move on a read, so the check above cannot pass by
  // the whole mechanism being dead.
  const presence = db.prepare('SELECT * FROM sim_presence WHERE enrollment_id = ?').get(enrollOf(uid).id);
  check('presence is still stamped, so the audit is not passing on a broken clock',
    Boolean(presence && presence.last_seen_at));
}

// ---- 3. the provenance contract (§24) -------------------------------------------------------
{
  const uid = learner('junior');
  await finishWholeProject(ws, db, uid);

  const index = ws.getExperience(uid, null);
  check('the experience index carries provenance', Boolean(index.provenance && index.provenance.simulated === true));
  check('and states what it is in words', /simulated/i.test(index.provenance.statement));
  // The word "employment" is allowed to appear, and has to: the sentence is "not paid
  // employment". What must never appear is a CLAIM of it, so the check is that every
  // mention is negated rather than that the word is absent.
  const claims = (index.provenance.statement + ' ' + index.label)
    .split(/(?<=[.!?])\s+/)
    .filter((x) => /\bemploy(er|ment|ed)\b/i.test(x))
    .filter((x) => !/\b(not|never|rather than|instead of)\b/i.test(x));
  check('and never claims employment', claims.length === 0, claims.join(' | '));

  const one = index.entries[0] && ws.getExperience(uid, index.entries[0].key);
  check('a single story lifted out of the index carries it too',
    Boolean(one && one.provenance && one.simulated === true));

  const record = ws.getPerformanceRecord(uid);
  check('so does the performance record', Boolean(record.provenance && record.simulated === true));

  // The gate is a gate, not a habit: a payload without provenance is refused outright.
  let threw = null;
  try { vault.assertProvenance({ entries: [] }, 'test'); } catch (e) { threw = e.message; }
  check('a payload without provenance is refused rather than repaired', Boolean(threw), String(threw));

  let threw2 = null;
  try {
    vault.assertProvenance(vault.withProvenance({ entries: [{ key: 'x', simulated: false }] }), 'test');
  } catch (e) { threw2 = e.message; }
  check('and so is one whose entries are not marked', Boolean(threw2), String(threw2));
}

// ---- 4. claim composition safety (§25) --------------------------------------------------------
//
// M07 audits one entry's prose as it is written. This is the other half: prose composed
// ACROSS entries afterwards, which is what a résumé bullet is and where the real danger
// lives. No Resume UI is built here -- §55 rules that out -- only the check it would have
// to pass.
{
  const evidence = { approved: 30, timeliness: 92, project: 'Q1 Compensation Review' };

  check('a claim whose figures all come from the evidence passes',
    vault.validateClaim('Delivered 30 pieces of work, 92% of them on their date.', evidence).ok);

  const invented = vault.validateClaim('Delivered work worth 116400 to the business.', evidence);
  check('a figure nothing establishes is refused', !invented.ok && invented.reason === 'unsupported-figure',
    JSON.stringify(invented));
  check('and the refusal names the figure', (invented.unsupported || []).includes('116400'));

  const impact = vault.validateClaim('Improved retention across the quarter.', evidence);
  check('an impact claim is refused even with no numbers in it',
    !impact.ok && impact.reason === 'impact-claim', JSON.stringify(impact));

  check('a claim with figures and no evidence at all is refused',
    vault.validateClaim('Saved 40 hours a week.', null).ok === false);

  check('a year is not treated as an unsupported metric',
    vault.validateClaim('Worked on Q1 Compensation Review in 2026.', evidence).ok);

  // A passage names the sentence that failed, not just that something did.
  const passage = vault.validatePassage(
    'Delivered 30 pieces of work. Increased revenue by 12%.', evidence);
  check('a passage reports which sentence is the problem',
    !passage.ok && /Increased revenue/.test(passage.sentence || ''), JSON.stringify(passage));

  // The real entries the engine produces must themselves survive the composition check --
  // the audit at write time and the audit at composition time must not disagree.
  const uid = learner('junior');
  await finishWholeProject(ws, db, uid);
  const idx = ws.getExperience(uid, null);
  let bad = null;
  for (const summary of idx.entries) {
    const entry = ws.getExperience(uid, summary.key);
    const prose = [entry.title, entry.context, entry.responsibility, entry.outcome]
      .concat(entry.actions || []).filter(Boolean).join(' ');
    const verdict = vault.validatePassage(prose, entry);
    if (!verdict.ok) { bad = `${summary.key}: ${verdict.detail} — "${verdict.sentence}"`; break; }
  }
  check('every entry the engine writes passes the composition check against its own evidence',
    bad === null, bad);
}

// ---- 5. the reflection trust boundary (§26) ---------------------------------------------------
{
  const uid = learner('junior');
  await finishWholeProject(ws, db, uid);
  const due = ws.getState(uid).meetings.due;
  const words = 'I did not check who reads the number after I hand it over.';
  if (due) await ws.completeOneToOne(uid, due.key, 'definitions', words);

  const idx = ws.getExperience(uid, null);
  const entries = idx.entries.map((e) => ws.getExperience(uid, e.key));
  const withReflection = entries.filter((e) => e.reflection);
  check('a reflection reaches the surface at all', withReflection.length > 0);

  check('and arrives attributed rather than as a bare string',
    withReflection.every((e) => typeof e.reflection === 'object' && e.reflection.byLearner === true));
  check('with the attribution said in words',
    withReflection.every((e) => /you/i.test(e.reflection.attribution)));

  check("the manager's observation is attributed too, and separately",
    entries.filter((e) => e.managerObservation)
      .every((e) => e.managerObservation.voice === 'manager'));

  check("the learner's words never appear in the system's own prose",
    entries.every((e) => ![e.context, e.responsibility, e.outcome, e.title]
      .concat(e.actions || [])
      .concat((e.evidence || []).map((x) => `${x.what} ${x.detail || ''}`))
      .filter(Boolean).join(' ').includes(words)));

  // Structural, not conventional: a composer that hands over an unattributed reflection is
  // stopped, rather than quietly publishing somebody's own words as a finding.
  let threw = null;
  try { vault.assertVoices({ reflection: 'I was unsure.', evidence: [] }, 'test'); } catch (e) { threw = e.message; }
  check('an unattributed reflection is refused', Boolean(threw), String(threw));

  let threw2 = null;
  try {
    vault.assertVoices({
      reflection: vault.attributed('I was unsure.', vault.VOICE.LEARNER),
      context: 'The analyst said I was unsure. about the population',
      evidence: [],
    }, 'test');
  } catch (e) { threw2 = e.message; }
  check("and so is the system repeating the learner's sentence as its own", Boolean(threw2), String(threw2));
}

// ---- 6. leadership framing has a threshold (§30) -----------------------------------------------
//
// "Running the project -- allocating the work, reviewing output and owning what went out"
// is a claim about the job somebody held. It used to be triggered by any single piece of
// leadership work, so a senior who sat in on one review got it.
{
  check('one coaching session does not make a week leadership',
    vault.ledTheWork({ coach: 1 }) === false);
  check('nor does a single sign-off', vault.ledTheWork({ signoff: 1 }) === false);
  check('nor two of them together', vault.ledTheWork({ signoff: 1, coach: 1 }) === false);
  check('three reviews is the shape of the week, so it does',
    vault.ledTheWork({ signoff: 2, coach: 1 }) === true);
  check('and staffing the week always does, because only the person running it decides that',
    vault.ledTheWork({ assign: 1 }) === true);
  check('a week with no leadership work at all is not leadership',
    vault.ledTheWork({}) === false && vault.ledTheWork(null) === false);
}

// ---- 7. significance is read, not just written (§27) ---------------------------------------------
{
  const uid = learner('junior');
  await finishWholeProject(ws, db, uid);
  const rows = vault.list(enrollOf(uid).id);
  check('the record comes back with something in it', rows.length > 0);

  const order = { high: 0, meaningful: 1, routine: 2 };
  const ranks = rows.map((r) => order[r.significance] ?? 2);
  check('and is ordered so the work worth seeing is not buried under routine weeks',
    ranks.every((v, i) => i === 0 || ranks[i - 1] <= v), JSON.stringify(rows.map((r) => r.significance)));

  const byDate = vault.listByDate(enrollOf(uid).id);
  check('the date ordering is still available for anything that wants a timeline',
    byDate.length === rows.length);

  const groups = vault.grouped(enrollOf(uid).id);
  check('and the record can be read grouped by project', groups.length > 0 && Array.isArray(groups[0].rows));
  check('with every entry in exactly one group',
    groups.reduce((n, g) => n + g.rows.length, 0) === rows.length);
}

// ---- 8. a capability trend needs enough work behind it (§29) --------------------------------------
{
  const rising = Array.from({ length: 10 }, (_, i) => ({ score: 60 + i * 4, at: `2026-01-${String(i + 1).padStart(2, '0')}` }));
  check('a trend is reported once there is enough signed-off work',
    perf.trendFor(rising).direction === 'improving', JSON.stringify(perf.trendFor(rising)));

  const few = rising.slice(0, 4);
  check('and withheld when there is not', perf.trendFor(few).direction === null);
  check('saying so rather than calling it flat', /Needs \d+/.test(perf.trendFor(few).reason));

  const flat = Array.from({ length: 10 }, (_, i) => ({ score: 80, at: `2026-01-${String(i + 1).padStart(2, '0')}` }));
  check('a genuinely level record reads as steady, not as improvement',
    perf.trendFor(flat).direction === 'steady');

  const wobble = Array.from({ length: 10 }, (_, i) => ({ score: i < 5 ? 80 : 82, at: `2026-01-${String(i + 1).padStart(2, '0')}` }));
  check('and a two-point wobble is not called progress', perf.trendFor(wobble).direction === 'steady',
    JSON.stringify(perf.trendFor(wobble)));
}

// ---- 9. the scope-change title says what changed (§1) ---------------------------------------------
//
// PR #100 put the amendment into the title to stop two cards reading identically. It used
// the first sixty characters of the stakeholder's message, which on a real message is the
// apology: "Scope change: I know this is not your project and I am sorry. I need total…".
{
  check('the ask is picked out of a message that opens with an apology',
    vault.askIn('I know this is not your project and I am sorry. I need total current headcount by department.')
      === 'I need total current headcount by department.');
  check('and out of one that opens with thanks',
    /could you also split this by region/.test(
      vault.askIn('Thanks for the call yesterday, that was useful. One addition: could you also split this by region?')));
  check('a single-sentence message is returned whole',
    vault.askIn('Split this by region as well, please.') === 'Split this by region as well, please.');
  check('and nothing is invented when there is nothing to read', vault.askIn('') === null && vault.askIn(null) === null);
}

// ---- 10. the product does not talk like a course (§1) ------------------------------------------------
//
// A source scan over the strings the UI actually renders. Comments are stripped first --
// this file and the ones it checks talk ABOUT the leaks they removed, and a guard that
// cannot tell a fix from the thing it fixed is useless.
//
// Deliberately blunt. Adding a word to the allow-list should feel like a decision.
{
  const COMPONENTS = path.join(ROOT, 'workspace-app/src');
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => (
    d.isDirectory() ? walk(path.join(dir, d.name))
      : /\.jsx?$/.test(d.name) ? [path.join(dir, d.name)] : []));

  // Only the words a person can actually read: quoted string literals and JSX text nodes.
  // Comments go first -- this file and the ones it checks describe the leaks they removed,
  // and a guard that cannot tell a fix from the thing it fixed is worthless. Identifiers
  // go too: `attendance.streak` is a variable holding a real run of days, and renaming
  // working code to satisfy a text scan would be the tail wagging the dog.
  function readableText(file) {
    const src = fs.readFileSync(file, 'utf8')
      .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, ' ')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/^\s*\/\/.*$/gm, ' ');
    const out = [];
    for (const m of src.matchAll(/'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g)) {
      // Inside a template literal, `${streak.longest}` is an identifier, not a word
      // anybody reads. Renaming working code to satisfy a text scan would be the tail
      // wagging the dog, so the expressions come out and the prose stays.
      out.push(String(m[1] || m[2] || m[3] || '').replace(/\$\{[^}]*\}/g, ' '));
    }
    // JSX text: what sits between a closing > and the next <, with expressions dropped.
    for (const m of src.matchAll(/>([^<>{}]{3,})</g)) out.push(m[1]);
    // A class attribute is Tailwind, not prose, and is full of words like "track".
    return out.filter((t) => !/^[\w-]+(\s+[\w:/[\]().-]+)*$/.test(t) || /\s/.test(t) === false
      ? true : !/(^|\s)(bg|text|border|rounded|flex|grid|px|py|mt|mb|gap|w|h)-/.test(t)).join('\n');
  }

  const BANNED = [
    ['course', /\bcourses?\b/i],
    ['lesson', /\blessons?\b/i],
    ['module', /\bmodules?\b/i],
    ['curriculum', /\bcurriculum\b/i],
    ['learning path', /learning path/i],
    ['certificate', /\bcertificates?\b/i],
    ['badge', /\bbadges?\b/i],
    ['streak', /\bstreaks?\b/i],
    ['personal best', /personal best/i],
    ['shoutout', /shout ?outs?/i],
    ['skill points', /skill points/i],
    ['XP', /\bXP\b/],
    ['leaderboard', /leaderboard/i],
    ['the whole track', /the whole track/i],
    ['level up', /\blevel ?up\b/i],
  ];

  // A line that NEGATES the word is the product drawing the distinction on purpose --
  // "A simulated job, not a course" is the single most important sentence on the enrolment
  // screen, and a guard that removed it would be doing harm.
  const negated = (line) => /\b(not|never|no|rather than|instead of|isn't|is not)\b/i.test(line);

  // One allowance, and it has to earn its place. A badge system is the thing on the door
  // that logs who came in; People Ops running an attendance return off it is exactly the
  // kind of true workplace detail this milestone is trying to protect.
  const ALLOWED = [/badge system/i, /access badge/i];

  const hits = [];
  for (const file of walk(COMPONENTS)) {
    for (const line of readableText(file).split('\n')) {
      if (negated(line) || ALLOWED.some((re) => re.test(line))) continue;
      for (const [word, re] of BANNED) {
        if (re.test(line)) hits.push(`${path.relative(ROOT, file)}: "${word}" in "${line.trim().slice(0, 70)}"`);
      }
    }
  }
  check('no screen talks about courses, certificates, badges, streaks or points',
    hits.length === 0, hits.slice(0, 8).join('\n        '));
}

// ---- 11. the working week agrees with itself -----------------------------------------------------
//
// Home printed "Saturday 19 September" and laid a 09:30 stand-up underneath it while the
// calendar on the next tab shaded the same day as a weekend. Three surfaces, three
// opinions about whether anybody was at work.
{
  const uid = learner('junior');
  const s = ws.getState(uid);
  const w = s.workday;
  check('Home says whether the office is open', typeof w.officeOpen === 'boolean');

  const saidWeekend = /saturday|sunday/i.test(w.dateLabel);
  check('and the open/closed answer matches the day it just printed',
    saidWeekend === (w.officeOpen === false), `${w.dateLabel} / officeOpen=${w.officeOpen}`);

  if (saidWeekend) {
    check('a weekend says so rather than leaving it to be noticed', Boolean(w.dayNote));
    check('and nothing on the timeline is happening right now',
      w.timeline.every((slot) => !slot.now && !slot.next));
  } else {
    check('a working day carries no weekend note', w.dayNote === null);
    check('and the timeline has exactly one thing next, or none left today',
      w.timeline.filter((slot) => slot.next).length <= 1);
  }
}

// ---- 12. Asha's first message does not argue with its own numbers -----------------------------------
//
// "Your strongest area is SQL (100) and the one with the most room is Communication (100)"
// -- the guard was on the axis NAMES differing, not the scores.
{
  const uid = learner('junior');   // answers every question correctly, so every axis is level
  const msg = db.prepare(`SELECT body FROM sim_messages WHERE enrollment_id = ?
                          AND body LIKE '%skills check%' ORDER BY created_at LIMIT 1`)
    .get(enrollOf(uid).id);
  check('the skills-check message exists', Boolean(msg), 'no message');
  if (msg) {
    const m = msg.body.match(/strongest area is [^(]+\((\d+)\).*most room is [^(]+\((\d+)\)/);
    check('if it names a strongest and a weakest, they are actually different',
      !m || Number(m[1]) > Number(m[2]), msg.body.slice(0, 160));
  }
}

console.log(fails ? `\n${fails} FAILURE(S)` : '\nAll immersion checks passed.');
process.exit(fails ? 1 : 0);

})();
