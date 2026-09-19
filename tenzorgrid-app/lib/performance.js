// Performance — one answer to "how is this learner doing".
//
// WHY THIS FILE EXISTS
//
// Before it, seven places independently averaged task scores, with four different
// population definitions and two different null policies:
//
//   promotion         (t.score || 0)                       an unscored task counts as 0
//   Performance page  (t.score || 0)                       same
//   productivityAt    (t.score || 0) over graded+gradedAt   same, narrower population
//   profile           AVG(score) WHERE score IS NOT NULL    unscored excluded
//   projectCompletion typeof t.score === 'number'           unscored excluded
//   meetings          typeof t.score === 'number'           unscored excluded
//
// On a learner with one graded-but-unscored task those produce 77 and 80 for the same
// period -- and 77 is the number gating promotion while 80 is the number their manager
// quotes in the 1:1. Today production cannot actually produce an unscored graded task,
// so the two agree by luck rather than by design. This file makes them agree by design.
//
// THE RULE: an unscored task is NOT a zero.
//
// A task the engine never scored is missing data, not a failure. Counting it as zero
// invents a bad result the learner never earned -- and does it in the one place that
// decides whether they get promoted. Every metric here excludes unscored work from the
// numerator AND the denominator, which is what the correct three sites already did.
//
// WHAT THIS FILE IS NOT
//
// It is not a scoreboard. It computes numbers because promotion and appraisal genuinely
// need them, but the learner-facing Performance record leads with evidence and manager
// observations -- the numbers stay mostly internal, which is what M07 asks for.

const { db } = require('./db');

// ---- populations -------------------------------------------------------------------------
//
// One definition of "work that can be measured", used everywhere. A parked task is real
// work that was attempted and set aside; it keeps whatever score it earned, so it counts
// in quality if it has one -- but it is not a delivery, so it never counts in timeliness.
function isScored(t) {
  return typeof t.score === 'number' && Number.isFinite(t.score);
}
function isDelivered(t) {
  return t.status === 'graded';
}

// ---- period scoping ------------------------------------------------------------------------
//
// Built once and passed down, so no caller re-scans history for itself. A period is just a
// predicate over a task row plus a label, which keeps "this week" and "career to date" the
// same shape and stops a caller inventing a third meaning of "recent".
function periodFor(spec, run) {
  if (!spec || spec === 'career') {
    return { key: 'career', label: 'Career to date', covers: () => true };
  }
  if (spec === 'project' && run) {
    const from = Date.parse(run.started_at);
    const to = run.completed_at ? Date.parse(run.completed_at) + 60000 : Infinity;
    return {
      key: 'project',
      label: 'This project',
      runId: run.id,
      covers: (t) => {
        const at = Date.parse(t.graded_at || t.assigned_at || '');
        return Number.isFinite(at) && at >= from && at <= to;
      },
    };
  }
  return { key: 'career', label: 'Career to date', covers: () => true };
}

// ---- the canonical metrics ------------------------------------------------------------------

// Quality: the mean score of work that was actually scored.
//
// null when there is nothing to average -- never 0. A learner with no graded work has an
// unknown quality, not a bad one, and every consumer here distinguishes the two.
function quality(tasks, period) {
  const scored = tasks.filter((t) => isScored(t) && (!period || period.covers(t)));
  if (!scored.length) return { value: null, n: 0 };
  return {
    value: Math.round(scored.reduce((s, t) => s + t.score, 0) / scored.length),
    n: scored.length,
  };
}

// Timeliness: the share of deliveries that met their date.
//
// Only counts work that has both a delivery moment and a deadline to miss. A task with no
// due date cannot be late, so including it would quietly inflate the number.
function timeliness(tasks, period) {
  const delivered = tasks.filter((t) => isDelivered(t) && t.graded_at && t.due_at
    && (!period || period.covers(t)));
  if (!delivered.length) return { value: null, n: 0 };
  const onTime = delivered.filter((t) => Date.parse(t.graded_at) <= Date.parse(t.due_at));
  return { value: Math.round((onTime.length / delivered.length) * 100), n: delivered.length };
}

// Volume, for context rather than judgement.
function delivery(tasks, period) {
  const mine = tasks.filter((t) => !period || period.covers(t));
  return {
    approved: mine.filter((t) => isDelivered(t)).length,
    parked: mine.filter((t) => t.status === 'parked').length,
    total: mine.length,
  };
}

// The whole canonical set for one learner and one period. Every consumer takes this.
function metricsFor(enrollmentId, { tasks, period } = {}) {
  const rows = tasks || db.prepare('SELECT * FROM sim_tasks WHERE enrollment_id = ?').all(enrollmentId);
  const p = period || periodFor('career');
  return {
    period: { key: p.key, label: p.label },
    quality: quality(rows, p),
    timeliness: timeliness(rows, p),
    delivery: delivery(rows, p),
  };
}

// ---- capabilities ---------------------------------------------------------------------------
//
// Deliberately built on the skill axes the product already has rather than a second
// taxonomy. What changes is the FRAMING: the engine keeps its points because projects and
// the skill matrix read them, but a career surface says what somebody has demonstrated and
// shows the work that demonstrates it.
//
// The axes a learner cannot yet touch are excluded rather than reported as zero -- an axis
// nobody at this level has a task for is missing data, and showing "Leadership 0" to a
// junior would be the same lie as counting an unscored task as a fail.
const CAPABILITY_LABEL = {
  sql: 'SQL and querying',
  python: 'Analysis in Python',
  dataViz: 'Data visualisation',
  communication: 'Stakeholder communication',
  businessLogic: 'Business judgement',
  coaching: 'Coaching and review',
  delivery: 'Delivery and ownership',
};

// Evidence states. Explicit thresholds, because §6 allows a qualitative label only when a
// deterministic rule stands behind it -- and "Not enough evidence yet" is a more credible
// thing to show than a confident label derived from one data point.
const EVIDENCE_STATES = {
  NONE: 'Not enough evidence yet',
  EMERGING: 'Early evidence',
  DEVELOPING: 'Developing',
  CONSISTENT: 'Consistently demonstrated',
};

const MIN_FOR_STATE = 2;      // below this, we say so rather than guessing
const CONSISTENT_AT = 6;      // pieces of scored work touching the axis
const CONSISTENT_SCORE = 70;  // and holding up while doing it

function capabilityState(n, avg) {
  if (n < MIN_FOR_STATE) return EVIDENCE_STATES.NONE;
  if (n >= CONSISTENT_AT && avg !== null && avg >= CONSISTENT_SCORE) return EVIDENCE_STATES.CONSISTENT;
  if (n >= CONSISTENT_AT || (avg !== null && avg >= CONSISTENT_SCORE)) return EVIDENCE_STATES.DEVELOPING;
  return EVIDENCE_STATES.EMERGING;
}

// What a learner has actually demonstrated, with the work that demonstrates it.
//
// `axesAvailable` is the set this level can move; anything outside it is left out entirely
// rather than reported as unproven.
function capabilities(tasks, axesAvailable) {
  const byAxis = {};
  for (const t of tasks) {
    if (!isScored(t) || !t.skills_json) continue;
    let skills;
    try { skills = JSON.parse(t.skills_json); } catch { continue; }
    for (const [axis, weight] of Object.entries(skills)) {
      if (typeof weight !== 'number' || weight <= 0) continue;
      if (axesAvailable && !axesAvailable.includes(axis)) continue;
      byAxis[axis] = byAxis[axis] || { axis, n: 0, sum: 0, examples: [] };
      byAxis[axis].n += 1;
      byAxis[axis].sum += t.score;
      // Keep the strongest few as the evidence a learner can actually look at.
      byAxis[axis].examples.push({ taskId: t.id, title: t.title, score: t.score, at: t.graded_at });
    }
  }
  return Object.values(byAxis).map((c) => {
    const avg = c.n ? Math.round(c.sum / c.n) : null;
    return {
      axis: c.axis,
      label: CAPABILITY_LABEL[c.axis] || c.axis,
      state: capabilityState(c.n, avg),
      evidenceCount: c.n,
      // Internal. Useful for ordering and for promotion, not for putting a number on a
      // person's communication skills on a page they read about themselves.
      averageScore: avg,
      examples: c.examples.sort((a, b) => b.score - a.score).slice(0, 3),
    };
  }).sort((a, b) => b.evidenceCount - a.evidenceCount);
}

// ---- development history ------------------------------------------------------------------
//
// M06 left goals as active/superseded, which cannot express "you have been working on this
// for three weeks" or "this got better". Both of those are countable without a model.
function developmentHistory(enrollmentId) {
  const goals = db.prepare('SELECT * FROM sim_development_goals WHERE enrollment_id = ? ORDER BY created_at')
    .all(enrollmentId);
  if (!goals.length) return { current: null, history: [], recurring: [] };

  // A theme is recurring when the same competency has been set as the focus more than
  // once. That is a fact about the goals, not an inference about the person.
  const byCompetency = {};
  for (const g of goals) {
    byCompetency[g.competency] = byCompetency[g.competency] || { competency: g.competency, times: 0, titles: [] };
    byCompetency[g.competency].times += 1;
    if (!byCompetency[g.competency].titles.includes(g.title)) byCompetency[g.competency].titles.push(g.title);
  }
  const recurring = Object.values(byCompetency)
    .filter((x) => x.times > 1)
    .map((x) => ({
      competency: x.competency,
      label: CAPABILITY_LABEL[x.competency] || x.competency,
      times: x.times,
      titles: x.titles,
    }));

  const current = goals.filter((g) => g.status === 'active').slice(-1)[0] || null;
  return {
    current: current ? {
      competency: current.competency, title: current.title, reason: current.reason,
      setInWeek: current.week_index, since: current.created_at,
    } : null,
    history: goals.map((g) => ({
      competency: g.competency, title: g.title, weekIndex: g.week_index, status: g.status,
    })),
    recurring,
  };
}

module.exports = {
  isScored, isDelivered,
  periodFor, quality, timeliness, delivery, metricsFor,
  CAPABILITY_LABEL, EVIDENCE_STATES, MIN_FOR_STATE, CONSISTENT_AT, CONSISTENT_SCORE,
  capabilityState, capabilities,
  developmentHistory,
};
