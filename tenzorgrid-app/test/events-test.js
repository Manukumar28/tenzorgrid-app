// Workplace events — Milestone 05.
//
// Two things have to be true of an event engine and only one of them is a crash:
//
//   1. the chains work — a decision leaves a mark, and the mark can be lifted
//   2. NOTHING DUPLICATES — refreshing twenty times does not produce twenty messages
//      from Finance, twenty risk transitions, or twenty amendments on one brief
//
// The second is the dangerous one, because it looks fine on the first load. So the
// duplication checks here hammer the read path deliberately rather than politely.
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
const ev = require(path.join(ROOT, 'lib/events.js'));
const dayitems = require(path.join(ROOT, 'lib/dayitems.js'));

let fails = 0;
const check = (n, c, d) => { if (c) console.log('  PASS  ' + n); else { fails++; console.log('  FAIL  ' + n + (d ? '\n        ' + d : '')); } };

console.log('\nWorkplace events\n');

let seq = 0;
function learner(level) {
  seq += 1;
  const uid = cryptoRandomId(), iso = new Date().toISOString();
  db.prepare('INSERT INTO users (id,email,password_hash,password_salt,created_at) VALUES (?,?,?,?,?)')
    .run(uid, `ev${seq}@t.local`, 'x', 'y', iso);
  db.prepare('INSERT INTO profiles (user_id,name,created_at,updated_at) VALUES (?,?,?,?)')
    .run(uid, 'Manu Kumar', iso, iso);
  ws.startEnrollment(uid, { role: 'data_analyst', level: level || 'junior', scheduleType: 'weekdays' });
  ws.submitSkillTest(uid, Object.fromEntries(st.QUESTIONS.map((q) => [q.id, q.answer])));
  return uid;
}
const enrollOf = (uid) => ws.getEnrollment(uid);
const runOf = (uid) => db.prepare('SELECT * FROM sim_project_runs WHERE enrollment_id = ? ORDER BY started_at DESC LIMIT 1')
  .get(enrollOf(uid).id);
const eventsOf = (uid) => db.prepare('SELECT * FROM sim_events WHERE enrollment_id = ? ORDER BY occurred_at').all(enrollOf(uid).id);
const effectsOf = (uid) => db.prepare('SELECT * FROM sim_event_effects WHERE enrollment_id = ?').all(enrollOf(uid).id);
const msgsOf = (uid) => db.prepare('SELECT * FROM sim_messages WHERE enrollment_id = ?').all(enrollOf(uid).id);
// A situation the learner has actually been handed, of a given authored type.
// The consequential situations are authored on days 2-5, so a learner standing on Monday
// morning has only been handed the meeting invite. Walk forward until the one being asked
// for has actually landed, rather than asserting against a day that cannot contain it.
function openSituation(uid, pred) {
  for (let hop = 0; hop < 5; hop++) {
    const e = enrollOf(uid), run = runOf(uid);
    ws.getState(uid);
    const rows = db.prepare('SELECT * FROM sim_situations WHERE enrollment_id = ? AND handled_as IS NULL').all(e.id);
    for (const r of rows) {
      const def = dayitems.situationsFor(run.project_key).find((x) => x.key === r.situation_key);
      if (def && pred(def)) return { row: r, def };
    }
    try { ws.timeTravel(uid, { workingDays: 1 }); } catch { return null; }
  }
  return null;
}

// ---- 1. baseline: no events means nothing changed ------------------------------------------
{
  const uid = learner('junior');
  const s = ws.getState(uid);
  check('a learner nothing has happened to has no events', eventsOf(uid).length === 0);
  check('and no effects', effectsOf(uid).length === 0);
  check('the payload still says so explicitly', s.events && s.events.openCount === 0);
  check('every board row reports no update', s.taskBoard.rows.every((r) => r.update === null));
  check('and project health is still on track with no invented reason',
    (s.workday.projectHealth || []).every((p) => p.health !== 'at risk' || p.reason),
    JSON.stringify((s.workday.projectHealth || []).map((p) => [p.health, p.reason])));
}

// ---- 2. deferral: comes back, never blocks the day -----------------------------------------
{
  const uid = learner('junior');
  const found = openSituation(uid, (d) => d.needsReply);
  check('a learner is handed something that needs an answer', Boolean(found));
  if (found) {
    ws.handleSituation(uid, found.row.situation_key, 'defer');
    const deferKey = `${ev.PATTERNS.DEFERRED}:${found.row.situation_key}`;
    const rec = eventsOf(uid).find((e) => e.event_key === deferKey);
    check('putting it off records an open event', Boolean(rec) && rec.state === 'open');

    const row = db.prepare('SELECT * FROM sim_situations WHERE id = ?').get(found.row.id);
    check('and it still counts as handled, so the day can never be blocked by it',
      row.handled_as === 'defer');

    // The point of Later: you can come back to it.
    let repicked = true;
    try { ws.handleSituation(uid, found.row.situation_key, 'archive'); }
    catch { repicked = false; }
    check('a deferred item can be picked up again', repicked);
    check('and dealing with it closes the deferral',
      (eventsOf(uid).find((e) => e.event_key === deferKey) || {}).state === 'resolved');
  }
}

// ---- 3. anything actually dealt with stays dealt with --------------------------------------
{
  const uid = learner('junior');
  const found = openSituation(uid, (d) => d.needsReply);
  if (found) {
    ws.handleSituation(uid, found.row.situation_key, 'archive');
    let refused = false;
    try { ws.handleSituation(uid, found.row.situation_key, 'reply', 'changed my mind'); }
    catch { refused = true; }
    check('an archived situation cannot be re-handled', refused);
  }
}

// ---- 4. an unanswered ask has the consequence its author wrote -------------------------------
{
  const uid = learner('junior');
  const found = openSituation(uid, (d) => d.needsReply && d.ifIgnored && ev.CONSEQUENTIAL_TYPES.has(d.type));
  check('there is an authored situation with a written consequence', Boolean(found));
  if (found) {
    const before = msgsOf(uid).length;
    ws.handleSituation(uid, found.row.situation_key, 'archive');
    const key = `${ev.PATTERNS.UNANSWERED}:${found.row.situation_key}`;
    const rec = eventsOf(uid).find((e) => e.event_key === key);
    check('ignoring it records the event', Boolean(rec));
    const after = msgsOf(uid);
    check('and the person who asked follows up', after.length > before);
    const followUp = after.find((m) => m.body && m.body.includes(found.def.ifIgnored));
    check('using the consequence the author actually wrote', Boolean(followUp),
      found.def.ifIgnored.slice(0, 60));

    // Hammer the read path. This is the check that matters.
    for (let i = 0; i < 20; i++) ws.getState(uid);
    const sameFollowUps = msgsOf(uid).filter((m) => m.body && m.body.includes(found.def.ifIgnored));
    check('twenty refreshes do not send it twenty times', sameFollowUps.length === 1,
      `${sameFollowUps.length} copies`);
    const dupEvents = eventsOf(uid).filter((e) => e.event_key === key);
    check('and do not record the event twice', dupEvents.length === 1);
  }
}

// ---- 5. escalation means something ---------------------------------------------------------
{
  const uid = learner('junior');
  const found = openSituation(uid, (d) => d.needsReply);
  if (found) {
    ws.handleSituation(uid, found.row.situation_key, 'escalate');
    const coord = effectsOf(uid).filter((e) => e.kind === ev.EFFECTS.COORDINATOR && e.active === 1);
    check('escalating puts the manager on the work', coord.length === 1 && coord[0].value === 'line_manager');
    const mgr = msgsOf(uid).filter((m) => m.sender_archetype === 'line_manager'
      && m.body.includes('Picked this up from you'));
    check('and she says so, once', mgr.length === 1);

    for (let i = 0; i < 15; i++) ws.getState(uid);
    check('refreshing does not make her say it again',
      msgsOf(uid).filter((m) => m.body.includes('Picked this up from you')).length === 1);
    check('nor duplicate the coordination',
      effectsOf(uid).filter((e) => e.kind === ev.EFFECTS.COORDINATOR).length === 1);

    const s = ws.getState(uid);
    const row = s.taskBoard.rows.find((r) => r.update && r.update.coordinatedBy);
    check('and the work shows the manager is coordinating it', Boolean(row),
      'no row carries a coordinator');
  }
}

// ---- 6. a changed ask amends the brief rather than rewriting it ------------------------------
{
  const uid = learner('junior');
  const found = openSituation(uid, (d) => d.needsReply && ev.AMENDING_TYPES.has(d.type));
  if (found) {
    const task = db.prepare("SELECT * FROM sim_tasks WHERE enrollment_id = ? AND status != 'graded' LIMIT 1")
      .get(enrollOf(uid).id);
    const briefBefore = task.brief;
    ws.handleSituation(uid, found.row.situation_key, 'reply', 'Understood — I will scope it that way.');

    const amend = effectsOf(uid).filter((e) => e.kind === ev.EFFECTS.AMENDMENT);
    check('replying to a change of scope records an amendment', amend.length === 1);
    check('attributed to the person who asked', Boolean(amend[0] && amend[0].target));

    const after = db.prepare('SELECT brief FROM sim_tasks WHERE id = ?').get(task.id);
    check('and the authored brief is NOT rewritten', after.brief === briefBefore);

    const wb = ws.getWorkbench(uid, task.id);
    check('the workbench shows the original request unchanged', wb.brief === briefBefore);
    check('with the amendment appended and attributed',
      Boolean(wb.assignment.update && wb.assignment.update.amendments.length === 1
        && wb.assignment.update.amendments[0].from));

    for (let i = 0; i < 15; i++) ws.getState(uid);
    check('and it is still exactly one amendment after fifteen reads',
      effectsOf(uid).filter((e) => e.kind === ev.EFFECTS.AMENDMENT).length === 1);
  } else {
    check('a scope-change situation exists to test', false, 'none found on this project');
  }
}

// ---- 7. failure and recovery — the chain that matters -----------------------------------------
{
  const uid = learner('junior');
  const e = enrollOf(uid), run = runOf(uid);
  const task = db.prepare("SELECT * FROM sim_tasks WHERE enrollment_id = ? AND status != 'graded' LIMIT 1").get(e.id);

  // Drive the engine's own return path rather than faking rows.
  ws.__testReturnWork(uid, task.id, 'The denominator includes contractors. Recheck the population.', false);

  const returned = eventsOf(uid).filter((x) => x.pattern === ev.PATTERNS.WORK_RETURNED);
  check('returned work records an event', returned.length === 1);
  const risk = effectsOf(uid).filter((x) => x.kind === ev.EFFECTS.PROJECT_HEALTH && x.active === 1);
  check('and puts the project at risk', risk.length === 1);
  check('with a reason a person could read',
    Boolean(risk[0] && risk[0].reason && risk[0].reason.length > 20), risk[0] && risk[0].reason);

  let s = ws.getState(uid);
  let health = (s.workday.projectHealth || []).find((p) => p.key === run.project_key);
  check('the project card says at risk', Boolean(health) && health.health === 'at risk',
    health && health.health);
  check('and never says it without saying why', Boolean(health && health.reason));

  const board = s.taskBoard.rows.find((r) => r.id === task.id);
  check('the card shows the work came back', Boolean(board && board.update && board.update.note));

  for (let i = 0; i < 20; i++) ws.getState(uid);
  check('twenty reads do not multiply the risk',
    effectsOf(uid).filter((x) => x.kind === ev.EFFECTS.PROJECT_HEALTH).length === 1);

  // Put it right.
  ws.__testApproveWork(uid, task.id);
  check('correcting it records the recovery',
    eventsOf(uid).some((x) => x.pattern === ev.PATTERNS.WORK_RECOVERED));
  check('and lifts the risk',
    effectsOf(uid).filter((x) => x.kind === ev.EFFECTS.PROJECT_HEALTH && x.active === 1).length === 0);

  s = ws.getState(uid);
  health = (s.workday.projectHealth || []).find((p) => p.key === run.project_key);
  check('so the project is back on track', Boolean(health) && health.health !== 'at risk',
    health && health.health);

  // The history is the point — this is what a weekly 1:1 will read later.
  const chain = eventsOf(uid).filter((x) => x.task_id === task.id);
  check('the whole chain is still on record', chain.length === 2);
  check('and the return is marked resolved rather than deleted',
    chain.find((x) => x.pattern === ev.PATTERNS.WORK_RETURNED).state === 'resolved');
  check('the risk effect is kept as evidence, not thrown away',
    effectsOf(uid).some((x) => x.kind === ev.EFFECTS.PROJECT_HEALTH && x.active === 0 && x.cleared_at));
}

// ---- 8. a second return is a second event -------------------------------------------------
{
  const uid = learner('junior');
  const task = db.prepare("SELECT * FROM sim_tasks WHERE enrollment_id = ? AND status != 'graded' LIMIT 1")
    .get(enrollOf(uid).id);
  ws.__testReturnWork(uid, task.id, 'First go.', false);
  db.prepare('UPDATE sim_tasks SET review_rounds = 1 WHERE id = ?').run(task.id);
  ws.__testReturnWork(uid, task.id, 'Second go.', false);
  check('being sent back twice is two events, because it happened twice',
    eventsOf(uid).filter((x) => x.pattern === ev.PATTERNS.WORK_RETURNED).length === 2);
  check('but still only one open risk on the project',
    effectsOf(uid).filter((x) => x.kind === ev.EFFECTS.PROJECT_HEALTH && x.active === 1).length === 1);
}

// ---- 9. a rework is not a crisis -----------------------------------------------------------
{
  const uid = learner('junior');
  const task = db.prepare("SELECT * FROM sim_tasks WHERE enrollment_id = ? AND status != 'graded' LIMIT 1")
    .get(enrollOf(uid).id);
  ws.__testReturnWork(uid, task.id, 'Right answer, do it with a median.', true);
  check('work that was right and is wanted differently still records an event',
    eventsOf(uid).filter((x) => x.pattern === ev.PATTERNS.WORK_RETURNED).length === 1);
  check('and notes it on the card',
    effectsOf(uid).some((x) => x.kind === ev.EFFECTS.ASSIGNMENT_NOTE));
  check('but does NOT cry wolf by calling the project at risk',
    effectsOf(uid).filter((x) => x.kind === ev.EFFECTS.PROJECT_HEALTH).length === 0);
}

// ---- 10. determinism ------------------------------------------------------------------------
{
  const keysFor = () => {
    const uid = learner('junior');
    const found = openSituation(uid, (d) => d.needsReply && d.ifIgnored && ev.CONSEQUENTIAL_TYPES.has(d.type));
    if (found) ws.handleSituation(uid, found.row.situation_key, 'archive');
    const task = db.prepare("SELECT * FROM sim_tasks WHERE enrollment_id = ? AND status != 'graded' LIMIT 1")
      .get(enrollOf(uid).id);
    ws.__testReturnWork(uid, task.id, 'Recheck the population.', false);
    ws.getState(uid);
    return eventsOf(uid).map((x) => `${x.pattern}|${x.headline}`).sort();
  };
  const a = keysFor(), b = keysFor();
  check('two learners taking the same actions get exactly the same events',
    JSON.stringify(a) === JSON.stringify(b), `${JSON.stringify(a)}\n        vs ${JSON.stringify(b)}`);
  check('and there were some to compare', a.length >= 2, `${a.length}`);
}

// ---- 11. time travel ------------------------------------------------------------------------
{
  const uid = learner('junior');
  const found = openSituation(uid, (d) => d.needsReply);
  if (found) {
    ws.handleSituation(uid, found.row.situation_key, 'defer');
    const before = msgsOf(uid).length;
    ws.timeTravel(uid, { workingDays: 1 });
    ws.getState(uid);
    const chased = msgsOf(uid).filter((m) => m.body.includes('Following up on this'));
    check('something put off comes back on a later day', chased.length === 1, `${chased.length}`);

    ws.timeTravel(uid, { workingDays: 1 });
    for (let i = 0; i < 10; i++) ws.getState(uid);
    check('and is chased once, not once per day and not once per refresh',
      msgsOf(uid).filter((m) => m.body.includes('Following up on this')).length === 1);
    check('the deferral event is still open until it is actually dealt with',
      eventsOf(uid).some((x) => x.pattern === ev.PATTERNS.DEFERRED && x.state === 'open'));
  }
}

// ---- 12. the overlay never touches the baseline ------------------------------------------------
{
  const uid = learner('junior');
  const before = db.prepare('SELECT id, brief, title, due_at, priority FROM sim_tasks WHERE enrollment_id = ? ORDER BY id')
    .all(enrollOf(uid).id);
  const found = openSituation(uid, (d) => d.needsReply);
  if (found) ws.handleSituation(uid, found.row.situation_key, 'escalate');
  const task = before[0];
  ws.__testReturnWork(uid, task.id, 'Back to you.', false);
  ws.getState(uid);
  const after = db.prepare('SELECT id, brief, title, due_at, priority FROM sim_tasks WHERE enrollment_id = ? ORDER BY id')
    .all(enrollOf(uid).id);
  check('no authored brief was rewritten',
    before.every((b, i) => b.brief === after[i].brief));
  check('no title was rewritten', before.every((b, i) => b.title === after[i].title));
  // The deliberate answer to "can deadlines move?": yes the column supports it, no we do
  // not use it. Pressure is expressed in words, not by quietly editing a date.
  check('and no deadline was silently moved',
    before.every((b, i) => b.due_at === after[i].due_at));
}

// ---- 13. events reach the surfaces --------------------------------------------------------------
{
  const uid = learner('junior');
  const task = db.prepare("SELECT * FROM sim_tasks WHERE enrollment_id = ? AND status != 'graded' LIMIT 1")
    .get(enrollOf(uid).id);
  ws.__testReturnWork(uid, task.id, 'The population is wrong.', false);
  const s = ws.getState(uid);
  check('Home carries the open events', s.events.openCount >= 1);
  check('each one has a headline a person could read',
    s.events.open.every((x) => x.headline && x.headline.length > 10));
  const wb = ws.getWorkbench(uid, task.id);
  check('and the tool shows the note without leaving the app',
    Boolean(wb.assignment.update && wb.assignment.update.notes.length));
}

// ---- 14. it does not become an alarm feed ---------------------------------------------------
{
  const uid = learner('junior');
  const e = enrollOf(uid);
  const rows = db.prepare('SELECT * FROM sim_situations WHERE enrollment_id = ? AND handled_as IS NULL').all(e.id);
  for (const r of rows) { try { ws.handleSituation(uid, r.situation_key, 'archive'); } catch { /* noise */ } }
  const s = ws.getState(uid);
  check('even a learner who ignored everything sees at most six things on Home',
    s.events.open.length <= 6, `${s.events.open.length}`);
}

// ---- 15. the UI renders the overlay rather than deriving one ---------------------------------
{
  const fs = require('node:fs');
  const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
  const stripComments = (src) => src
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const [file, label] of [
    ['workspace-app/src/components/WorkdayHome.jsx', 'Home'],
    ['workspace-app/src/components/Workbench.jsx', 'the workbench'],
    ['workspace-app/src/components/taskCards.jsx', 'the queue card'],
    ['workspace-app/src/components/taskPanels.jsx', 'the focus list'],
  ]) {
    const src = stripComments(read(file));
    check(`${label} renders event state rather than deciding it`,
      !/sim_event|applyEffect|recordEvent|at_risk|PATTERNS\./.test(src));
  }
  // The rule this milestone turns on: a status must carry its evidence. Asserted against
  // the source so a later edit cannot quietly drop the reason and leave a bare colour.
  const home = read('workspace-app/src/components/WorkdayHome.jsx');
  check('and Home cannot show "at risk" without the reason beside it',
    /p\.health === 'at risk' && p\.reason/.test(home));
}

// ---- 16. performance: reading is not running the engine ------------------------------------
{
  const uid = learner('manager');
  ws.getState(uid);
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < 10; i++) ws.getState(uid);
  const clean = Number(process.hrtime.bigint() - t0) / 1e6 / 10;

  const task = db.prepare("SELECT * FROM sim_tasks WHERE enrollment_id = ? AND status != 'graded' LIMIT 1")
    .get(enrollOf(uid).id);
  ws.__testReturnWork(uid, task.id, 'Back to you.', false);
  ws.getState(uid);
  const t1 = process.hrtime.bigint();
  for (let i = 0; i < 10; i++) ws.getState(uid);
  const withEvents = Number(process.hrtime.bigint() - t1) / 1e6 / 10;

  check('a read with events is not materially slower than one without',
    withEvents < clean * 1.5 + 2, `${clean.toFixed(2)}ms clean vs ${withEvents.toFixed(2)}ms with events`);
  console.log(`        (${clean.toFixed(2)}ms clean, ${withEvents.toFixed(2)}ms with events)`);
}

console.log(fails ? `\n${fails} FAILURE(S)` : '\nAll event checks passed.');
process.exit(fails ? 1 : 0);
