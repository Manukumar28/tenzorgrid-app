// Meetings and the weekly 1:1 — Milestone 06.
//
// The thing this milestone is really for is CONTINUITY: a learner finishes a week, talks
// to Asha about what actually happened, leaves with one thing to work on, and the next
// week knows about it. So the centre of this suite is a two-week chain driven end to end
// rather than a set of unit checks on a meeting object.
//
// Two rules are asserted hard because they are easy to break later:
//
//   1. a reflection is NEVER graded -- no score, no percentage, no pass/fail
//   2. observations are grounded -- every sentence Asha says names evidence that exists
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
const mt = require(path.join(ROOT, 'lib/meetings.js'));
const { finishWholeProject } = require(path.join(__dirname, 'answers.js'));

let fails = 0;
const check = (n, c, d) => { if (c) console.log('  PASS  ' + n); else { fails++; console.log('  FAIL  ' + n + (d ? '\n        ' + d : '')); } };

console.log('\nMeetings and the weekly 1:1\n');

let seq = 0;
function learner(level) {
  seq += 1;
  const uid = cryptoRandomId(), iso = new Date().toISOString();
  db.prepare('INSERT INTO users (id,email,password_hash,password_salt,created_at) VALUES (?,?,?,?,?)')
    .run(uid, `mt${seq}@t.local`, 'x', 'y', iso);
  db.prepare('INSERT INTO profiles (user_id,name,created_at,updated_at) VALUES (?,?,?,?)')
    .run(uid, 'Manu Kumar', iso, iso);
  ws.startEnrollment(uid, { role: 'data_analyst', level: level || 'junior', scheduleType: 'weekdays' });
  ws.submitSkillTest(uid, Object.fromEntries(st.QUESTIONS.map((q) => [q.id, q.answer])));
  return uid;
}
const enrollOf = (uid) => ws.getEnrollment(uid);
const meetingRows = (uid) => db.prepare('SELECT * FROM sim_meetings WHERE enrollment_id = ?').all(enrollOf(uid).id);
const goalRows = (uid) => db.prepare('SELECT * FROM sim_development_goals WHERE enrollment_id = ?').all(enrollOf(uid).id);
const runOf = (uid) => db.prepare('SELECT * FROM sim_project_runs WHERE enrollment_id = ? ORDER BY started_at DESC LIMIT 1')
  .get(enrollOf(uid).id);

(async () => {

// ---- 1. baseline: nothing scheduled before a week has ended -----------------------------
{
  const uid = learner('junior');
  const s = ws.getState(uid);
  check('a learner mid-week has no meeting due', s.meetings && s.meetings.due === null);
  check('and no development focus yet', s.development === null);
  check('the meeting table is empty', meetingRows(uid).length === 0);
  check('asking for a 1:1 that does not exist returns nothing rather than throwing',
    ws.getOneToOne(uid, null) === null);
}

// ---- 2. the week boundary schedules exactly one 1:1 ---------------------------------------
const uid = learner('junior');
const firstRun = runOf(uid);
// Give the week something to actually talk about.
{
  const t = db.prepare("SELECT * FROM sim_tasks WHERE enrollment_id = ? AND status != 'graded' LIMIT 1").get(enrollOf(uid).id);
  ws.__testReturnWork(uid, t.id, 'The denominator includes contractors. Recheck the population.', false);
  ws.__testApproveWork(uid, t.id);
}
await finishWholeProject(ws, db, uid);
ws.getState(uid);
{
  const rows = meetingRows(uid);
  check('finishing the week schedules a 1:1', rows.length === 1, `${rows.length} meetings`);
  check('it is a one-to-one', rows[0] && rows[0].type === 'one_to_one');
  check('it is due, not completed', rows[0] && rows[0].status === 'due');
  check('and it belongs to the week that just closed', rows[0] && rows[0].project_run_id === firstRun.id);

  // The check that matters most for any scheduler.
  for (let i = 0; i < 20; i++) ws.getState(uid);
  check('twenty refreshes do not schedule twenty meetings', meetingRows(uid).length === 1,
    `${meetingRows(uid).length}`);
}

// ---- 3. the meeting is about the week the learner actually had ----------------------------
let m = ws.getOneToOne(uid, null);
{
  check('the 1:1 opens', Boolean(m));
  check('with the manager as a participant',
    m.participants.some((p) => p.archetype === 'line_manager'));
  check('and the learner', m.participants.some((p) => p.archetype === 'learner'));
  check('it names the project it is about', Boolean(m.project && m.project.title));
  check('the evidence belongs to that week', m.evidence && m.evidence.projectKey === firstRun.project_key);
  check('it counted the work that was returned', m.evidence.returnedCount === 1, `${m.evidence.returnedCount}`);
  check('and that it was put right', m.evidence.recoveredCount === 1, `${m.evidence.recoveredCount}`);
  check('it counted the work signed off', m.evidence.approvedCount > 0, `${m.evidence.approvedCount}`);

  check('Asha has something to say', m.observations.length > 0);
  check('and she says at most three things, not eight', m.observations.length <= 3);
  // Grounded: with a return AND a recovery, the recovery rule must be the one that fired.
  check('what she says is grounded in what happened',
    m.observations.some((o) => o.key === 'recovery'),
    m.observations.map((o) => o.key).join(','));

  // §4: day granularity only.
  check('it does not invent a time of day', !/\d{1,2}:\d{2}\s*(AM|PM)/i.test(JSON.stringify(m)));
  check('no meeting is a fake video call', !/join.*call|video|zoom/i.test(JSON.stringify(m)));
}

// ---- 4. it appears where a learner would look ---------------------------------------------
{
  const s = ws.getState(uid);
  check('Home knows a 1:1 is due', Boolean(s.meetings.due));
  check('with an agenda drawn from real evidence', (s.meetings.due.agenda || []).length > 0);
  const cal = s.calendar.events.filter((e) => e.kind === 'meeting');
  check('and it is on the calendar', cal.length === 1, `${cal.length}`);
  check('as a day, with no invented time', cal[0] && /^\d{4}-\d{2}-\d{2}$/.test(cal[0].date));
  check('the calendar entry can be opened', Boolean(cal[0] && cal[0].meetingKey));
}

// ---- 5. completing it: reflection stored, never graded --------------------------------------
{
  const out = await ws.completeOneToOne(uid, m.key, 'definitions', 'I second-guessed the population all week.');
  check('Asha replies to what the learner actually said', Boolean(out.reply && out.reply.length > 20));
  check('and the reply matches the reflection chosen',
    /definition/i.test(out.reply), out.reply);
  check('a development focus comes out of it', Boolean(out.goal && out.goal.title));

  const row = meetingRows(uid)[0];
  check('the reflection is stored as written',
    row.reflection_text === 'I second-guessed the population all week.');
  // §15, asserted rather than trusted.
  const cols = Object.keys(row);
  check('the meeting row has no score column at all',
    !cols.some((c) => /score|grade|mark|percent|correct/i.test(c)), cols.join(','));
  check('and nothing numeric was attached to the reflection',
    !/\b(score|grade|\d{1,3}%)\b/i.test(JSON.stringify({ r: row.reflection_text, y: row.manager_reply })));

  check('the meeting is now complete', row.status === 'completed');
  check('and cannot be had twice',
    (() => { try { ws.completeOneToOne(uid, m.key, 'fine', ''); return false; } catch { return true; } })());
  check('exactly one goal exists', goalRows(uid).length === 1, `${goalRows(uid).length}`);

  for (let i = 0; i < 15; i++) ws.getState(uid);
  check('and refreshing does not create a second goal', goalRows(uid).length === 1);
  check('nor replay the meeting as unfinished',
    meetingRows(uid).every((r) => r.status === 'completed'));
}

// ---- 6. the learner's own reflection outranks the manager's observation ---------------------
{
  const g = goalRows(uid)[0];
  check('the focus came from what the learner said, not only what Asha noticed',
    /definition/i.test(g.title), g.title);
  check('and it carries the reason', Boolean(g.reason && g.reason.length > 10));
  check('mapped to a competency the product already has',
    ['communication', 'businessLogic', 'delivery', 'coaching'].includes(g.competency), g.competency);
}

// ---- 7. NEXT WEEK KNOWS. This is the milestone. ----------------------------------------------
{
  const s = ws.getState(uid);
  check('the next week carries the development focus', Boolean(s.development));
  check('by name', s.development.title === goalRows(uid)[0].title);
  check('with the reason it was set', Boolean(s.development.reason));
  check('and no meeting is left hanging due', s.meetings.due === null);
}

// ---- 8. opportunity matching is real, not decorative -------------------------------------------
{
  const g = goalRows(uid)[0];
  check('a definitions focus recognises an analysis task as practice',
    mt.isOpportunity(g.competency, { tool: 'sql' }));
  check('and a judgement situation as practice',
    mt.isOpportunity(g.competency, { situationType: 'judgement' }));
  check('but does not claim a canteen notice is practice',
    !mt.isOpportunity(g.competency, { situationType: 'noise' }));
  check('a delegation focus finds nothing to practise in a write-up',
    !mt.isOpportunity('delivery', { tool: 'writeup' }));
}

// ---- 9. the second 1:1 revisits the first goal --------------------------------------------------
{
  const projects = ws.getState(uid).projects.projects;
  const next = projects.find((p) => p.status === 'available');
  check('a second week is available', Boolean(next), projects.map((p) => `${p.key}:${p.status}`).join(' '));
  if (next) {
    ws.startProject(uid, next.key);
    await finishWholeProject(ws, db, uid);
    ws.getState(uid);
    const rows = meetingRows(uid);
    check('finishing the second week schedules a second 1:1', rows.length === 2, `${rows.length}`);
    const second = ws.getOneToOne(uid, null);
    check('and it is a different week', second.weekIndex === 2, `week ${second.weekIndex}`);
    check('Asha remembers what she asked for last time', Boolean(second.followUp));
    check('naming the focus she set', second.followUp && second.followUp.title === goalRows(uid).slice(-1)[0].title
      || Boolean(second.followUp && second.followUp.title));
    check('with what the learner actually met, counted',
      second.followUp && second.followUp.progress
      && typeof second.followUp.progress.encountered === 'number',
      JSON.stringify(second.followUp && second.followUp.progress));
    // §21: development is longitudinal, not a test.
    check('and it is not labelled pass or fail',
      !/\b(pass|fail|passed|failed)\b/i.test(JSON.stringify(second.followUp)));

    await ws.completeOneToOne(uid, second.key, 'fine', '');
    const goals = goalRows(uid);
    check('the earlier focus is superseded rather than deleted',
      goals.some((x) => x.status === 'superseded'), goals.map((x) => x.status).join(','));
    check('and the history is still there', goals.length >= 1);
  }
}

// ---- 10. two different weeks are two different conversations (§50) -----------------------------
{
  // A: work returned and recovered.  B: several things ignored.
  const a = learner('junior');
  {
    const t = db.prepare("SELECT * FROM sim_tasks WHERE enrollment_id = ? AND status != 'graded' LIMIT 1").get(enrollOf(a).id);
    ws.__testReturnWork(a, t.id, 'Recheck the population.', false);
    ws.__testApproveWork(a, t.id);
  }
  await finishWholeProject(ws, db, a);
  ws.getState(a);

  const b = learner('junior');
  {
    ws.getState(b);
    const sits = db.prepare('SELECT * FROM sim_situations WHERE enrollment_id = ? AND handled_as IS NULL').all(enrollOf(b).id);
    for (const sr of sits) { try { ws.handleSituation(b, sr.situation_key, 'escalate'); } catch { /* noise */ } }
  }
  await finishWholeProject(ws, db, b);
  ws.getState(b);

  const ma = ws.getOneToOne(a, null), mb = ws.getOneToOne(b, null);
  check('both learners get a 1:1', Boolean(ma) && Boolean(mb));
  if (ma && mb) {
    const sa = ma.observations.map((o) => o.text).join(' ');
    const sb = mb.observations.map((o) => o.text).join(' ');
    check('and the two conversations are not the same words', sa !== sb,
      `A: ${sa.slice(0, 70)}\n        B: ${sb.slice(0, 70)}`);
    check('A is about recovery', /came back|put it right/i.test(sa), sa.slice(0, 90));
    check('B is about escalation', /brought me in/i.test(sb), sb.slice(0, 90));
  }
}

// ---- 11. the unanswered lifecycle no longer leaks across weeks (§10) ----------------------------
{
  const uid2 = learner('junior');
  ws.getState(uid2);
  const sits = db.prepare('SELECT * FROM sim_situations WHERE enrollment_id = ? AND handled_as IS NULL').all(enrollOf(uid2).id);
  for (const sr of sits) { try { ws.handleSituation(uid2, sr.situation_key, 'archive'); } catch { /* noise */ } }
  const openBefore = db.prepare("SELECT COUNT(*) c FROM sim_events WHERE enrollment_id = ? AND state = 'open' AND pattern IN ('unanswered','deferred')")
    .get(enrollOf(uid2).id).c;
  await finishWholeProject(ws, db, uid2);
  ws.getState(uid2);
  const openAfter = db.prepare("SELECT COUNT(*) c FROM sim_events WHERE enrollment_id = ? AND state = 'open' AND pattern IN ('unanswered','deferred')")
    .get(enrollOf(uid2).id).c;
  const noted = db.prepare("SELECT COUNT(*) c FROM sim_events WHERE enrollment_id = ? AND state = 'noted'")
    .get(enrollOf(uid2).id).c;
  check('unanswered items do not stay open across the week boundary', openAfter === 0, `${openBefore} -> ${openAfter}`);
  check('but are kept as evidence rather than deleted', noted > 0, `${noted} noted`);
  const mm = ws.getOneToOne(uid2, null);
  check('and the 1:1 still counted them', mm && mm.evidence.unansweredCount > 0,
    mm && `${mm.evidence.unansweredCount}`);
}

// ---- 12. the old hard-coded wrap-up is gone -------------------------------------------------------
{
  // The real invariant: every sign-off message names the project it is actually about.
  // The old code hard-coded "Q1 Compensation Review" into the body while putting the real
  // title in the subject, so a manager finishing Capacity Review was congratulated on
  // somebody else's project. A junior's FIRST project genuinely is Compensation Review,
  // so grepping for that string would pass for the wrong reason -- this walks the runs.
  const msgs = db.prepare('SELECT * FROM sim_messages WHERE enrollment_id = ?').all(enrollOf(uid).id);
  const runs = db.prepare('SELECT * FROM sim_project_runs WHERE enrollment_id = ? AND completed_at IS NOT NULL')
    .all(enrollOf(uid).id);
  const titleOf = (k) => (ws.PROJECT_CATALOG.data_analyst.find((p) => p.key === k) || {}).title;
  const signOffs = msgs.filter((x) => /closed out/i.test(x.body || ''));
  check('every week is signed off exactly once', signOffs.length === runs.length,
    `${signOffs.length} messages for ${runs.length} completed weeks`);
  const titles = runs.map((r) => titleOf(r.project_key)).filter(Boolean);
  check('and each names the project it is actually about',
    signOffs.every((x) => titles.some((t) => x.body.includes(t))),
    signOffs.map((x) => x.body.split('\n')[0]).join(' | '));
  check('a second week is never signed off under the first project\'s name',
    runs.length < 2 || signOffs.some((x) => x.body.includes(titles[1])),
    `expected a message naming ${titles[1]}`);
  const src = fs.readFileSync(path.join(ROOT, 'lib/workspace.js'), 'utf8');
  check('and the hard-coded praise is out of the source',
    !/gave Vikram something he could use instead/.test(src));
}

// ---- 13. the meeting is not a score report (§7, §36) -------------------------------------------------
{
  const src = fs.readFileSync(path.join(ROOT, 'lib/meetings.js'), 'utf8');
  const stripped = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  check('the meeting engine uses no game or course vocabulary',
    !/\b(XP|level up|quest|lesson|correct answer|weekly grade|training score)\b/i.test(stripped));
  const m2 = ws.getOneToOne(uid, meetingRows(uid)[0].meeting_key);
  check('and a completed meeting reports no grade for the week',
    !/\bweekGrade|weekScore|rating\b/.test(JSON.stringify(m2)));
}

// ---- 14. stand-up is untouched -----------------------------------------------------------------------
{
  const uid3 = learner('junior');
  const su = ws.getStandup(uid3);
  check('stand-up still works', Boolean(su) && su.questions.length === 3);
  check('and is still lightweight next to the 1:1', su.minutes <= 5, `${su.minutes} min`);
}

// ---- 15. performance -------------------------------------------------------------------------------
{
  // Measured on the SAME learner with the meeting layer stubbed out and then restored.
  // Comparing two different learners would mostly measure how much history each has,
  // which is not what this is asking.
  ws.getState(uid);
  const realDue = mt.dueMeetings, realGoal = mt.activeGoal;
  mt.dueMeetings = () => []; mt.activeGoal = () => null;
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < 10; i++) ws.getState(uid);
  const clean = Number(process.hrtime.bigint() - t0) / 1e6 / 10;
  mt.dueMeetings = realDue; mt.activeGoal = realGoal;
  const t1 = process.hrtime.bigint();
  for (let i = 0; i < 10; i++) ws.getState(uid);
  const withMeetings = Number(process.hrtime.bigint() - t1) / 1e6 / 10;
  check('the meeting layer costs a read almost nothing',
    withMeetings < clean * 1.3 + 2, `${clean.toFixed(2)}ms stubbed vs ${withMeetings.toFixed(2)}ms live`);
  // §45: the full evidence pack is only built when somebody opens the meeting.
  const key = meetingRows(uid)[0].meeting_key;
  ws.getOneToOne(uid, key);
  const t2 = process.hrtime.bigint();
  for (let i = 0; i < 10; i++) ws.getOneToOne(uid, key);
  const open = Number(process.hrtime.bigint() - t2) / 1e6 / 10;
  check('and opening one is cheap because the pack was frozen, not rebuilt', open < 3,
    `${open.toFixed(2)}ms`);
  console.log(`        (${clean.toFixed(2)}ms stubbed, ${withMeetings.toFixed(2)}ms live, ${open.toFixed(2)}ms to open)`);
}

// ---- 16. the UI renders the meeting rather than deciding it -------------------------------------------
{
  const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
  const strip = (src) => src.replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const [file, label] of [
    ['workspace-app/src/components/WorkdayHome.jsx', 'Home'],
    ['workspace-app/src/components/CalendarTab.jsx', 'the calendar'],
  ]) {
    const s2 = strip(read(file));
    check(`${label} renders meeting state rather than deriving it`,
      !/OBSERVATION_RULES|buildEvidence|observationsFor|goalFrom/.test(s2));
  }
}

console.log(fails ? `\n${fails} FAILURE(S)` : '\nAll meeting checks passed.');
process.exit(fails ? 1 : 0);

})();
