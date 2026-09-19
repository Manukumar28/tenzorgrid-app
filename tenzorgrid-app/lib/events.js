// Workplace events — the simulation moving because something happened.
//
// Until now the world only changed when the learner finished a piece of authored work.
// This is the layer that lets a decision, a return, or a sign-off leave a mark that is
// still there tomorrow.
//
// THE AUTHORED BASELINE IS NEVER WRITTEN TO
//
// Tasks, project docs and the 160 authored situations are the baseline. Everything here
// is an overlay in sim_events / sim_event_effects, and effective state is
//
//     baseline  +  active effects  =  what the learner sees
//
// so a learner with no events has a workplace that behaves exactly as it did before.
//
// WHERE THE CONSEQUENCES CAME FROM
//
// Mostly they were already written. 103 of the 160 situations carry an `ifIgnored` line
// -- "Asha assumes the narrow scope, and the estimate goes in as this year plus five
// percent with nobody having checked it" -- which until now was only ever shown as
// feedback text. Nothing happened. This engine makes those authored consequences real
// rather than inventing new ones, which is why the language in a follow-up is better than
// any template would produce.
//
// DETERMINISM
//
// There is no randomness here, seeded or otherwise. Every event is caused by a specific
// persisted action -- this situation was deferred, this task was returned -- and is keyed
// on that action. Given the same learner, day, and history, the same events exist. Tests
// can replay a chain exactly.
//
// IDEMPOTENCY
//
// Structural, not careful. `event_key` and `effect_key` are UNIQUE per enrolment and
// derived from the cause, so recording the same thing twice is a constraint violation
// rather than a duplicate row. Refreshing twenty times cannot produce twenty messages
// from Finance. Every insert here goes through insertOnce(), which swallows exactly that
// violation and nothing else.

const { db, cryptoRandomId } = require('./db');

const now = () => new Date().toISOString();

// ---- patterns ---------------------------------------------------------------------------
//
// Deliberately few. Six patterns that chain into each other beat thirty that each fire
// once and mean nothing. Each one names a real workplace moment and is triggered by a
// real persisted action, never by a timer and never by a die roll.
const PATTERNS = {
  // Work came back from review. The most consequential thing that happens to an analyst.
  WORK_RETURNED: 'work-returned',
  // ...and was then put right. Recovery is the point; a permanent penalty teaches nothing.
  WORK_RECOVERED: 'work-recovered',
  // A stakeholder changed or clarified what they wanted, and the learner answered.
  REQUIREMENT_CHANGE: 'requirement-change',
  // Something that needed an answer did not get one. The authored ifIgnored comes true.
  UNANSWERED: 'unanswered',
  // Put off until later. Comes back; never blocks the day.
  DEFERRED: 'deferred',
  // Passed up the line. The manager becomes visibly involved.
  ESCALATED: 'escalated',
};

// Effect kinds. Only things a real system can actually honour -- there are no hidden
// scalars here that nothing reads.
const EFFECTS = {
  PROJECT_HEALTH: 'project_health',       // at_risk on a project run, with a reason
  ASSIGNMENT_NOTE: 'assignment_note',     // a short status line on one task
  AMENDMENT: 'amendment',                 // appended context on a project's assignments
  COORDINATOR: 'coordinator',             // manager took coordination after an escalation
  PRIORITY: 'priority',                   // priority raised on one task
  FOLLOW_UP: 'follow_up',                 // a message was generated; recorded so it is not sent twice
};

// The situation types that are genuinely about the work rather than office noise. Only
// these can move project health or amend an assignment -- a deferred canteen notice is
// not a project risk, and treating it as one is exactly the "alarm feed" failure mode.
const CONSEQUENTIAL_TYPES = new Set([
  'scope', 'scope-creep', 'pressure', 'challenge', 'question',
  'judgement', 'blocked', 'status-chase', 'bad-news', 'forward', 'side-request',
]);

// Types where the stakeholder is changing what they asked for, as opposed to merely
// asking about it. Only these produce an amendment on the assignment.
const AMENDING_TYPES = new Set(['scope', 'scope-creep', 'forward', 'side-request']);

function isConsequential(def) {
  return Boolean(def && def.needsReply && CONSEQUENTIAL_TYPES.has(def.type));
}

// ---- storage ------------------------------------------------------------------------------

// The one insert used by everything here. Returns the row id on success and null when the
// row already existed, so every caller gets "did I actually do this?" for free and no
// caller has to remember to check first.
function insertOnce(sql, params) {
  try {
    db.prepare(sql).run(...params);
    return params[0];
  } catch (e) {
    if (/UNIQUE constraint failed/i.test(e.message)) return null;
    throw e;
  }
}

function recordEvent({
  enrollmentId, key, pattern, runId, taskId, situationKey,
  source, dayIndex, headline, detail,
}) {
  const id = cryptoRandomId();
  const written = insertOnce(
    `INSERT INTO sim_events (id, enrollment_id, event_key, pattern, project_run_id, task_id,
                             situation_key, source_archetype, day_index, headline, detail,
                             state, occurred_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)`,
    [id, enrollmentId, key, pattern, runId || null, taskId || null, situationKey || null,
     source || null, dayIndex || null, headline, detail || null, now()],
  );
  if (written) return { id, created: true };
  const existing = db.prepare('SELECT id FROM sim_events WHERE enrollment_id = ? AND event_key = ?')
    .get(enrollmentId, key);
  return { id: existing ? existing.id : null, created: false };
}

function applyEffect({
  enrollmentId, key, eventId, kind, runId, taskId, target, value, reason,
}) {
  return insertOnce(
    `INSERT INTO sim_event_effects (id, enrollment_id, effect_key, event_id, kind,
                                    project_run_id, task_id, target, value, reason,
                                    active, applied_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    [cryptoRandomId(), enrollmentId, key, eventId || null, kind, runId || null,
     taskId || null, target || null, value || null, reason || null, now()],
  );
}

// Consequences are not permanent punishment. Clearing keeps the row -- the history is the
// point -- and flips it inactive so effective state stops reading it.
function clearEffects(enrollmentId, { kind, taskId, runId }) {
  const where = ['enrollment_id = ?', 'active = 1'];
  const args = [enrollmentId];
  if (kind) { where.push('kind = ?'); args.push(kind); }
  if (taskId) { where.push('task_id = ?'); args.push(taskId); }
  if (runId) { where.push('project_run_id = ?'); args.push(runId); }
  const res = db.prepare(`UPDATE sim_event_effects SET active = 0, cleared_at = ?
                          WHERE ${where.join(' AND ')}`).run(now(), ...args);
  return res.changes || 0;
}

function resolveEvent(enrollmentId, key, resolution) {
  db.prepare(`UPDATE sim_events SET state = 'resolved', resolution = ?, resolved_at = ?
              WHERE enrollment_id = ? AND event_key = ? AND state != 'resolved'`)
    .run(resolution || null, now(), enrollmentId, key);
}

// ---- reading -------------------------------------------------------------------------------

function activeEffects(enrollmentId) {
  return db.prepare('SELECT * FROM sim_event_effects WHERE enrollment_id = ? AND active = 1')
    .all(enrollmentId);
}

function openEvents(enrollmentId) {
  return db.prepare("SELECT * FROM sim_events WHERE enrollment_id = ? AND state = 'open' ORDER BY occurred_at DESC")
    .all(enrollmentId);
}

function allEvents(enrollmentId, limit) {
  return db.prepare('SELECT * FROM sim_events WHERE enrollment_id = ? ORDER BY occurred_at DESC LIMIT ?')
    .all(enrollmentId, limit || 50);
}

// ---- effective state -------------------------------------------------------------------------
//
// baseline + effects. Nothing here mutates anything; it is the read side of the overlay.

// Project health, as an overlay on the health the schedule already implies.
//
// The derived baseline -- a week past its date, a colleague stuck waiting -- stays exactly
// as it was. An event can push a project to at risk on top of that, and unlike the derived
// version it carries a REASON, because a status without evidence is just a colour.
function projectHealthOverlay(effects, runId) {
  const rows = effects.filter((e) => e.kind === EFFECTS.PROJECT_HEALTH && e.project_run_id === runId);
  if (!rows.length) return null;
  return {
    health: 'at risk',
    reason: rows.map((r) => r.reason).filter(Boolean)[0] || null,
    reasons: rows.map((r) => r.reason).filter(Boolean),
    since: rows.map((r) => r.applied_at).sort()[0] || null,
  };
}

// Everything an event has changed about one task's assignment.
//
// The authored brief is untouched and always rendered. An amendment is APPENDED and
// attributed, because "Priya later said to exclude trial accounts" is a different and more
// useful fact than a brief that silently changed under the learner.
function assignmentOverlay(effects, { taskId, runId }) {
  const mine = effects.filter((e) => (e.task_id && e.task_id === taskId)
    || (!e.task_id && e.project_run_id && e.project_run_id === runId));
  if (!mine.length) return null;

  const amendments = mine.filter((e) => e.kind === EFFECTS.AMENDMENT).map((e) => ({
    from: e.target || null,
    text: e.value,
    at: e.applied_at,
  }));
  const notes = mine.filter((e) => e.kind === EFFECTS.ASSIGNMENT_NOTE && e.task_id === taskId)
    .map((e) => ({ text: e.value, reason: e.reason || null, at: e.applied_at }));
  const coordinator = mine.filter((e) => e.kind === EFFECTS.COORDINATOR)
    .map((e) => e.value)[0] || null;
  const priority = mine.filter((e) => e.kind === EFFECTS.PRIORITY && e.task_id === taskId)
    .map((e) => e.value)[0] || null;

  if (!amendments.length && !notes.length && !coordinator && !priority) return null;
  return {
    amendments: amendments.sort((a, b) => String(a.at).localeCompare(String(b.at))),
    notes,
    coordinatedBy: coordinator,
    priority,
    changed: true,
  };
}

module.exports = {
  PATTERNS,
  EFFECTS,
  CONSEQUENTIAL_TYPES,
  AMENDING_TYPES,
  isConsequential,
  recordEvent,
  applyEffect,
  clearEffects,
  resolveEvent,
  activeEffects,
  openEvents,
  allEvents,
  projectHealthOverlay,
  assignmentOverlay,
};
