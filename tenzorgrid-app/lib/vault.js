// Experience record — the stories behind the work.
//
// Performance is longitudinal: how am I doing, what am I demonstrating, where am I
// improving. Experience is episodic: what happened, what did I do, what came of it.
// They are deliberately not the same system and must not collapse into each other.
//
// THE ONE RULE THAT MATTERS: NOTHING IS INVENTED
//
// Every sentence produced here is assembled from rows that exist. The dangerous failure
// is not a crash, it is a plausible sentence nobody can trace -- "improved retention by
// 12%" out of a task that analysed retention, or "saved the company £500k" out of a
// recommendation that was never costed. So:
//
//   * claims describe what the learner ANALYSED, DECIDED, COMMUNICATED, CORRECTED or had
//     APPROVED -- never a downstream business outcome
//   * every entry carries source ids, so any claim can be followed back
//   * an automated audit refuses any entry whose prose contains an impact claim
//
// WRITTEN ONCE, AT A RESOLVED BOUNDARY
//
// Entries are created at project completion and at 1:1 completion -- points where the
// chain has already finished. An entry is never updated afterwards, so a story cannot
// half-exist and duplicates are impossible rather than merely prevented.

const { db, cryptoRandomId } = require('./db');
const performance = require('./performance');

const now = () => new Date().toISOString();
const day = (iso) => String(iso || '').slice(0, 10);

const KIND = {
  PROJECT: 'project',            // a week delivered
  RECOVERY: 'recovery',          // work returned, corrected, approved
  STAKEHOLDER: 'stakeholder',    // a scope change or challenge handled
  ESCALATION: 'escalation',      // a judgement about when to involve your manager
  LEADERSHIP: 'leadership',      // staffing, sign-off, coaching
};

// Significance is about WHAT HAPPENED, not how hard the SQL was. A technically trivial
// decision to hold a number back until it was verified is stronger professional evidence
// than a difficult query that went through without comment -- so nothing here reads task
// difficulty.
//
// Kept internal and used for selection and ordering. Labelling a learner's own experience
// "routine" on screen would be a discouraging thing to read and adds nothing.
const SIGNIFICANCE = { ROUTINE: 'routine', MEANINGFUL: 'meaningful', HIGH: 'high' };

// ---- claim safety ------------------------------------------------------------------------
//
// The audit that stops this feature becoming a liability. Any phrasing that asserts a
// business result the simulation never established is refused outright rather than
// softened, because a softened invented claim is still an invented claim.
const FORBIDDEN_CLAIM = new RegExp([
  'increas\\w*\\s+(revenue|retention|sales|profit|margin|conversion)',
  'improv\\w*\\s+(retention|revenue|conversion|margin|profit)',
  'reduc\\w*\\s+(churn|cost|spend|headcount)\\s+by',
  'sav\\w*\\s+(the company|£|\\$|€)',
  'deliver\\w*\\s+(£|\\$|€)\\s*[\\d,.]+',
  'drove\\s+\\w+\\s+growth',
  'led\\s+(a\\s+)?company-wide',
  'transform\\w*\\s+the\\s+business',
  '\\bROI\\b',
  'by\\s+\\d+(\\.\\d+)?\\s*%',
].join('|'), 'i');

// Returns the offending phrase, or null when the prose is safe.
function unsupportedClaim(entry) {
  const prose = [entry.title, entry.context, entry.responsibility, entry.outcome]
    .concat(entry.actions || [])
    .filter(Boolean).join(' \n ');
  const m = prose.match(FORBIDDEN_CLAIM);
  return m ? m[0] : null;
}

// ---- storage ----------------------------------------------------------------------------

function insertOnce(sql, params) {
  try {
    db.prepare(sql).run(...params);
    return params[0];
  } catch (e) {
    if (/UNIQUE constraint failed/i.test(e.message)) return null;
    throw e;
  }
}

// The single write path. Everything goes through the audit first -- there is no way to
// add an entry that bypasses it, which is the point.
function record(enrollmentId, entry) {
  const bad = unsupportedClaim(entry);
  if (bad) {
    // Refused rather than trimmed. An entry that needed editing to be truthful should not
    // exist, and a silent pass would be the worst outcome available here.
    throw new Error(`Refusing to record an unsupported claim: "${bad}"`);
  }
  return insertOnce(
    `INSERT INTO sim_experiences (id, enrollment_id, source_key, kind, title, project_key,
       project_title, project_run_id, role_level, period_from, period_to, context,
       responsibility, actions_json, outcome, capabilities_json, evidence_json, source_json,
       significance, manager_observation, reflection, simulated, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    [cryptoRandomId(), enrollmentId, entry.sourceKey, entry.kind, entry.title,
     entry.projectKey || null, entry.projectTitle || null, entry.runId || null,
     entry.level || null, entry.from || null, entry.to || null, entry.context || null,
     entry.responsibility || null, JSON.stringify(entry.actions || []), entry.outcome || null,
     JSON.stringify(entry.capabilities || []), JSON.stringify(entry.evidence || []),
     JSON.stringify(entry.sources || {}), entry.significance || SIGNIFICANCE.ROUTINE,
     entry.managerObservation || null, entry.reflection || null, now()],
  );
}

const parse = (json, fallback) => { try { return JSON.parse(json); } catch { return fallback; } };

function list(enrollmentId) {
  return db.prepare('SELECT * FROM sim_experiences WHERE enrollment_id = ? ORDER BY period_to DESC, created_at DESC')
    .all(enrollmentId);
}

function byKey(enrollmentId, sourceKey) {
  return db.prepare('SELECT * FROM sim_experiences WHERE enrollment_id = ? AND source_key = ?')
    .get(enrollmentId, sourceKey);
}

// The index Home and the list view read: enough to choose one, not the whole story.
function summarise(row) {
  return {
    key: row.source_key,
    kind: row.kind,
    title: row.title,
    project: row.project_title,
    from: row.period_from,
    to: row.period_to,
    outcome: row.outcome,
    capabilities: parse(row.capabilities_json, []),
    // Simulated work, said on every row rather than once in a footer.
    simulated: Boolean(row.simulated),
  };
}

// The whole story, read when somebody opens one.
function detail(row) {
  return {
    ...summarise(row),
    context: row.context,
    responsibility: row.responsibility,
    actions: parse(row.actions_json, []),
    evidence: parse(row.evidence_json, []),
    managerObservation: row.manager_observation,
    // Kept visibly separate from system evidence. What the learner wrote about themselves
    // is theirs; it is not treated as a fact the product asserts on their behalf.
    reflection: row.reflection,
    level: row.role_level,
  };
}

// ---- composing stories from evidence ------------------------------------------------------
//
// Each builder returns an entry or null. They read structured fields only -- pattern,
// state, kind, handled_as -- never a rendered headline, which was M05's own warning.

// A returned piece of work that was put right. One story from a four-link chain.
function recoveryEntry({ enrollmentId, run, project, level, returned, recovered, task, riskEffect, observation }) {
  if (!returned || !recovered || !task) return null;
  const sources = {
    taskIds: [task.id],
    eventIds: [returned.id, recovered.id].filter(Boolean),
    effectIds: riskEffect ? [riskEffect.id] : [],
    projectRunId: run.id,
  };
  const evidence = [
    { what: `"${task.title}" was returned for another look`, detail: returned.detail || null, sourceId: returned.id },
    riskEffect ? { what: `${project.title} was marked at risk`, detail: riskEffect.reason || null, sourceId: riskEffect.id } : null,
    { what: 'The corrected work was approved', detail: null, sourceId: recovered.id },
    riskEffect && riskEffect.cleared_at
      ? { what: `${project.title} returned to on track`, detail: null, sourceId: riskEffect.id } : null,
  ].filter(Boolean);

  return {
    sourceKey: `recovery:${task.id}`,
    kind: KIND.RECOVERY,
    // Named after the work, not after the mistake. "Retention analysis, corrected and
    // approved" is what somebody would say about this in an interview.
    title: `${task.title} — corrected and approved`,
    projectKey: project.key, projectTitle: project.title, runId: run.id, level,
    from: day(run.started_at), to: day(run.completed_at || now()),
    context: `On ${project.title}, work submitted for review was returned before it went further.`,
    responsibility: `Owning "${task.title}" through review to approval.`,
    actions: [
      returned.detail ? `Took the reviewer's point: ${returned.detail}` : 'Took the reviewer\'s point on the work.',
      'Reworked the analysis and resubmitted it.',
    ],
    // Says exactly what happened and stops there. No business result is claimed, because
    // the simulation established an approval, not an outcome in the world.
    outcome: riskEffect
      ? 'The corrected work was approved and the project returned to on track.'
      : 'The corrected work was approved.',
    capabilities: ['businessLogic'],
    evidence, sources,
    significance: SIGNIFICANCE.HIGH,
    managerObservation: observation || null,
  };
}

// A stakeholder changed what they wanted, and the learner absorbed it.
function scopeEntry({ enrollmentId, run, project, level, event, amendment }) {
  if (!event) return null;
  return {
    sourceKey: `scope:${event.id}`,
    kind: KIND.STAKEHOLDER,
    title: `Scope change on ${project.title}`,
    projectKey: project.key, projectTitle: project.title, runId: run.id, level,
    from: day(run.started_at), to: day(run.completed_at || now()),
    context: `Part-way through ${project.title}, the person who had asked for the work changed what they needed.`,
    responsibility: 'Picking the change up rather than delivering what was originally written.',
    actions: [
      amendment && amendment.value ? `Took on the amended request: ${amendment.value}` : 'Took on the amended request.',
      'Carried the change into the work rather than raising it as a blocker.',
    ],
    outcome: 'The delivered work reflected what was actually needed rather than the original brief.',
    capabilities: ['communication', 'businessLogic'],
    evidence: [
      { what: 'The request was amended mid-project', detail: amendment ? amendment.value : null, sourceId: event.id },
    ],
    sources: { eventIds: [event.id], effectIds: amendment ? [amendment.id] : [], projectRunId: run.id },
    significance: SIGNIFICANCE.MEANINGFUL,
  };
}

// A judgement call about when to involve your manager.
function escalationEntry({ enrollmentId, run, project, level, event }) {
  if (!event) return null;
  return {
    sourceKey: `escalation:${event.id}`,
    kind: KIND.ESCALATION,
    title: `Escalation judgement on ${project.title}`,
    projectKey: project.key, projectTitle: project.title, runId: run.id, level,
    from: day(run.started_at), to: day(run.completed_at || now()),
    context: `A request arrived on ${project.title} that was ambiguous enough to be worth a second opinion.`,
    responsibility: 'Deciding whether to resolve it directly or bring the line manager in.',
    actions: ['Passed the request up to the line manager rather than answering it alone.'],
    outcome: 'The manager took coordination of the request.',
    capabilities: ['communication'],
    evidence: [{ what: 'The request was escalated to the line manager', detail: event.detail || null, sourceId: event.id }],
    sources: { eventIds: [event.id], projectRunId: run.id },
    significance: SIGNIFICANCE.MEANINGFUL,
  };
}

// A delivered week. Routine on purpose -- most weeks are, and saying so plainly is more
// credible than dressing every completed project as an achievement.
function projectEntry({ run, project, level, metrics, situations, leadershipCounts, observation, reflection }) {
  const lead = leadershipCounts || {};
  const leadershipWork = (lead.assign || 0) + (lead.signoff || 0) + (lead.coach || 0);
  const actions = [
    `Delivered ${metrics.delivery.approved} ${metrics.delivery.approved === 1 ? 'piece' : 'pieces'} of work across the project.`,
    situations ? `Handled ${situations} ${situations === 1 ? 'request' : 'requests'} that arrived unannounced during the week.` : null,
    // Leadership work is named as itself rather than folded into "pieces of work", so a
    // manager's record does not read like a junior analyst's with a different title.
    lead.assign ? `Staffed the week across the team (${lead.assign} allocation ${lead.assign === 1 ? 'decision' : 'decisions'}).` : null,
    lead.signoff ? `Made ${lead.signoff} sign-off ${lead.signoff === 1 ? 'decision' : 'decisions'} on work going out.` : null,
    lead.coach ? `Worked through ${lead.coach} ${lead.coach === 1 ? 'review' : 'reviews'} with a colleague on their analysis.` : null,
  ].filter(Boolean);

  return {
    sourceKey: `project:${run.id}`,
    kind: leadershipWork ? KIND.LEADERSHIP : KIND.PROJECT,
    title: project.title,
    projectKey: project.key, projectTitle: project.title, runId: run.id, level,
    from: day(run.started_at), to: day(run.completed_at || now()),
    context: project.description || `A piece of analysis work delivered for ${project.title}.`,
    responsibility: leadershipWork
      ? `Running ${project.title} — allocating the work, reviewing output and owning what went out.`
      : `Delivering the analysis for ${project.title} and responding to the people who asked for it.`,
    actions,
    outcome: metrics.quality.value !== null
      ? `The project was completed, with ${metrics.delivery.approved} pieces of work approved.`
      : 'The project was completed.',
    capabilities: leadershipWork ? ['delivery', 'coaching'] : ['sql', 'communication'],
    evidence: [
      { what: `${metrics.delivery.approved} pieces of work approved`, detail: null, sourceId: run.id },
      metrics.timeliness.value !== null
        ? { what: `${metrics.timeliness.value}% of deliveries met their date`, detail: null, sourceId: run.id } : null,
    ].filter(Boolean),
    sources: { projectRunId: run.id },
    significance: leadershipWork ? SIGNIFICANCE.MEANINGFUL : SIGNIFICANCE.ROUTINE,
    managerObservation: observation || null,
    reflection: reflection || null,
  };
}

module.exports = {
  KIND, SIGNIFICANCE, FORBIDDEN_CLAIM,
  unsupportedClaim, record, insertOnce, list, byKey, summarise, detail, parse,
  recoveryEntry, scopeEntry, escalationEntry, projectEntry,
};
