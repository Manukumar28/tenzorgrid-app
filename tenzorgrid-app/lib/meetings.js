// Meetings — the conversation at the end of a week.
//
// The weekly 1:1 is what makes this simulation continuous rather than episodic. A learner
// finishes a week, sits down with Asha, hears specifically what she noticed, says what
// they found hard, and leaves with ONE thing to work on that the next week knows about.
//
// WHAT THIS IS NOT
//
// It is not a weekly score report. Nothing here produces a grade, a percentage or a
// pass/fail, and the learner's reflection is never marked -- §15 of the brief is a rule,
// not a preference, and it is asserted in the suite.
//
// EVIDENCE IS STRUCTURED, NEVER PROSE
//
// Milestone 05's own report warned that building a meeting by parsing event headlines
// would be a trap. So everything here aggregates FIELDS -- event.pattern, event.state,
// effect.kind, task.review_state, situation.handled_as -- and never reads a headline.
// A headline is for a person; a pattern is for a program.
//
// DETERMINISM
//
// No randomness and no LLM. Observations come from explicit rules over counted evidence,
// the development goal comes from the observation, and the manager's reply to a
// reflection comes from a lookup. Given the same week, the same meeting.
//
// EVIDENCE IS FROZEN AT SCHEDULING TIME
//
// A 1:1 is a conversation about a week that has finished. If it recomputed its own
// evidence from live tables every time it was opened, the meeting would quietly rewrite
// its own history -- "12 assignments completed" would read differently depending on when
// you looked. So the pack is computed once, when the meeting is scheduled, and stored.

const { db, cryptoRandomId } = require('./db');
const performance = require('./performance');

const now = () => new Date().toISOString();
const dayKey = (iso) => String(iso || '').slice(0, 10);

const TYPES = { ONE_TO_ONE: 'one_to_one' };
const STATUS = { DUE: 'due', COMPLETED: 'completed' };

// ---- competencies ---------------------------------------------------------------------
//
// Reusing the skill axes the product already has rather than inventing a second
// vocabulary. A goal names one of these, which is what lets the next week recognise work
// that would practise it.
const COMPETENCY = {
  COMMUNICATION: 'communication',
  BUSINESS: 'businessLogic',
  DELIVERY: 'delivery',
  COACHING: 'coaching',
};

// ---- evidence -----------------------------------------------------------------------------
//
// One query pass over the week, counting structured fields. Everything below is a real
// row: no estimates, no invented signals, and nothing included merely because it exists.
function buildEvidence(enrollmentId, run, opts) {
  const o = opts || {};
  const startMs = Date.parse(run.started_at);
  const inWeek = (iso) => {
    if (!iso) return false;
    const ms = Date.parse(iso);
    return ms >= startMs && (!run.completed_at || ms <= Date.parse(run.completed_at) + 60000);
  };

  const tasks = db.prepare('SELECT * FROM sim_tasks WHERE enrollment_id = ?').all(enrollmentId);
  const keys = new Set(o.taskKeys || []);
  const mine = keys.size ? tasks.filter((t) => keys.has(t.task_key)) : tasks;

  const approved = mine.filter((t) => t.status === 'graded');
  const scored = approved.filter((t) => typeof t.score === 'number');
  const onTime = approved.filter((t) => t.graded_at && t.due_at
    && Date.parse(t.graded_at) <= Date.parse(t.due_at));
  const late = approved.filter((t) => t.graded_at && t.due_at
    && Date.parse(t.graded_at) > Date.parse(t.due_at));

  // Events, counted by PATTERN and STATE. Never by headline.
  const events = db.prepare('SELECT * FROM sim_events WHERE enrollment_id = ? AND project_run_id = ?')
    .all(enrollmentId, run.id);
  const byPattern = (p) => events.filter((e) => e.pattern === p);
  const returned = byPattern('work-returned');
  const recovered = byPattern('work-recovered');
  const escalated = byPattern('escalated');
  const amended = byPattern('requirement-change');
  const unanswered = byPattern('unanswered');
  const deferred = byPattern('deferred');

  // Project health, from the effect rows rather than from a rendered status string.
  const healthEffects = db.prepare(`SELECT * FROM sim_event_effects
                                    WHERE enrollment_id = ? AND project_run_id = ? AND kind = 'project_health'`)
    .all(enrollmentId, run.id);
  const wentAtRisk = healthEffects.length;
  const riskCleared = healthEffects.filter((e) => e.active === 0 && e.cleared_at).length;

  // Situations, by how they were handled.
  const situations = db.prepare('SELECT * FROM sim_situations WHERE enrollment_id = ? AND project_run_id = ?')
    .all(enrollmentId, run.id);
  const handled = situations.filter((s) => s.handled_as);
  const countHandled = (how) => handled.filter((s) => s.handled_as === how).length;

  return {
    weekOf: dayKey(run.started_at),
    closedOn: dayKey(run.completed_at || now()),
    projectKey: run.project_key,

    approvedCount: approved.length,
    totalCount: mine.length,
    // Average grade over the week, computed by the canonical rule so the number Asha
    // quotes can never disagree with the one on the Performance page.
    //
    // The RESULT is then frozen onto the meeting row. That is deliberate and is not a
    // contradiction: the formula is shared so two surfaces agree today, and the value is
    // stored so a future change to the formula cannot silently rewrite what a manager
    // said to somebody three weeks ago.
    avgScore: performance.quality(mine).value,
    onTimeCount: onTime.length,
    lateCount: late.length,

    returnedCount: returned.length,
    recoveredCount: recovered.length,
    // The titles, for the manager to be able to NAME the piece of work. Read off the task
    // row, not off an event headline.
    returnedTitles: returned.map((e) => {
      const t = tasks.find((x) => x.id === e.task_id);
      return t ? t.title : null;
    }).filter(Boolean),

    escalationCount: escalated.length,
    amendmentCount: amended.length,
    unansweredCount: unanswered.length,
    deferredCount: deferred.filter((e) => e.state === 'open').length,

    wentAtRisk,
    riskCleared,

    situationsHandled: handled.length,
    situationsTotal: situations.length,
    repliedCount: countHandled('reply'),
    archivedCount: countHandled('archive'),
    escalatedSituations: countHandled('escalate'),
  };
}

// ---- manager observations ------------------------------------------------------------------
//
// An explicit rule system, in priority order. Each rule states the condition that fires it
// and produces a sentence that NAMES the evidence -- because "great job this week" is what
// a manager says when they have not read anything.
//
// Every rule carries the competency it implies, so the development goal falls out of the
// observation rather than being chosen separately and possibly disagreeing with it.
const OBSERVATION_RULES = [
  {
    key: 'recovery',
    when: (e) => e.returnedCount > 0 && e.recoveredCount >= e.returnedCount,
    competency: COMPETENCY.BUSINESS,
    say: (e) => `${e.returnedTitles[0] ? `"${e.returnedTitles[0]}"` : 'A piece of work'} came back this week and you put it right rather than arguing about it. That is the part most people find hard.`,
    goal: { title: 'Validate definitions before sharing numbers', reason: 'Work came back once this week over how the population was defined.' },
  },
  {
    key: 'unrecovered',
    when: (e) => e.returnedCount > e.recoveredCount,
    competency: COMPETENCY.BUSINESS,
    say: (e) => `${e.returnedTitles[0] ? `"${e.returnedTitles[0]}"` : 'Something'} is still sitting with you after I sent it back. I would rather it came back to me wrong than not at all.`,
    goal: { title: 'Close out returned work before starting the next thing', reason: 'Work returned this week was still open at the end of it.' },
  },
  {
    key: 'escalation',
    when: (e) => e.escalationCount >= 2,
    competency: COMPETENCY.COMMUNICATION,
    say: (e) => `You brought me in ${e.escalationCount} times this week. Some of those were right; I do not think all of them were.`,
    goal: { title: 'Clarify before escalating', reason: 'Several requests came up the line before they had been explored directly.' },
  },
  {
    key: 'unanswered',
    when: (e) => e.unansweredCount >= 2,
    competency: COMPETENCY.COMMUNICATION,
    say: (e) => `${e.unansweredCount} people asked you something this week and did not get an answer. They each went ahead on an assumption instead.`,
    goal: { title: 'Answer the people waiting on you, even briefly', reason: 'More than one request went unanswered and the sender acted on a guess.' },
  },
  {
    key: 'scope',
    when: (e) => e.amendmentCount >= 1,
    competency: COMPETENCY.BUSINESS,
    say: (e) => `The ask changed under you ${e.amendmentCount === 1 ? 'once' : `${e.amendmentCount} times`} and you picked it up rather than delivering what was originally written.`,
    goal: { title: 'Confirm what changed, in writing, when scope moves', reason: 'The request was amended mid-week.' },
  },
  {
    key: 'late',
    when: (e) => e.lateCount >= 2,
    competency: COMPETENCY.DELIVERY,
    say: (e) => `${e.lateCount} pieces of work landed after their date. None of them were disasters, but nobody heard from you before the date passed.`,
    goal: { title: 'Flag a slip before the deadline, not after', reason: 'Work landed late without warning.' },
  },
  {
    key: 'quality',
    when: (e) => e.avgScore !== null && e.avgScore >= 80 && e.returnedCount === 0,
    competency: COMPETENCY.COMMUNICATION,
    say: (e) => `The technical work held up all week — ${e.avgScore} average and nothing came back. The next thing that will hold you back is not SQL.`,
    goal: { title: 'Lead with the business implication, not the method', reason: 'The analysis is reliable; what it means for the reader is the next step.' },
  },
  {
    key: 'steady',
    when: (e) => e.approvedCount > 0,
    competency: COMPETENCY.DELIVERY,
    say: (e) => `${e.approvedCount} ${e.approvedCount === 1 ? 'piece' : 'pieces'} of work signed off and ${e.situationsHandled} ${e.situationsHandled === 1 ? 'thing' : 'things'} dealt with that arrived unannounced. A steady week.`,
    goal: { title: 'Take on one piece of work that stretches you', reason: 'A clean week with nothing that went wrong is a week to push on.' },
  },
];

// At most three, and the first one is what the goal comes from. A manager does not read
// out eight bullet points, and a meeting that did would be a dashboard.
function observationsFor(evidence) {
  const fired = OBSERVATION_RULES.filter((r) => r.when(evidence));
  return fired.slice(0, 3).map((r) => ({
    key: r.key,
    competency: r.competency,
    text: r.say(evidence),
    goal: r.goal,
  }));
}

// ---- reflection ----------------------------------------------------------------------------
//
// Authored choices, so the manager can respond to what was actually said without needing a
// model to read it. The free-text box beside them is stored and never marked.
//
// Each choice carries the competency it points at, so a learner who names something
// different from what Asha noticed can still steer their own development focus -- which is
// what a real 1:1 does.
const REFLECTIONS = [
  {
    key: 'escalated_early',
    label: 'I brought things to you sooner than I needed to',
    competency: COMPETENCY.COMMUNICATION,
    reply: 'That is worth working on. Next week, try getting to the bottom of an ambiguous request yourself before bringing me in — unless the risk is material, in which case come straight to me.',
    goal: { title: 'Clarify before escalating', reason: 'You said you brought things up the line earlier than you needed to.' },
  },
  {
    key: 'assumed',
    label: 'I assumed what someone meant instead of asking',
    competency: COMPETENCY.COMMUNICATION,
    reply: 'It happens to everyone and it is expensive when it happens late. One question at the start of a request costs a minute; finding out at the end costs the day.',
    goal: { title: 'Ask the clarifying question before you start', reason: 'You said you worked from an assumption rather than checking.' },
  },
  {
    key: 'definitions',
    label: 'I was not confident the numbers meant what I said they meant',
    competency: COMPETENCY.BUSINESS,
    reply: 'Good instinct to say so. Write the definition down before you write the query — who is in, who is out, and over what window. That is the bit Finance will check.',
    goal: { title: 'Validate definitions before sharing numbers', reason: 'You said you were not sure the figures meant what you reported.' },
  },
  {
    key: 'pace',
    label: 'I had more on than I could get through',
    competency: COMPETENCY.DELIVERY,
    reply: 'Then I need to hear that on the Tuesday, not the Friday. Tell me what is going to slip while there is still something I can do about it.',
    goal: { title: 'Flag a slip before the deadline, not after', reason: 'You said the workload was more than the week had room for.' },
  },
  {
    key: 'explaining',
    label: 'The analysis was fine but explaining it was harder',
    competency: COMPETENCY.COMMUNICATION,
    reply: 'That is the right thing to be working on at this point. Open with what it means for the person reading it, then show them how you got there.',
    goal: { title: 'Lead with the business implication, not the method', reason: 'You said the explanation was harder than the analysis.' },
  },
  {
    key: 'fine',
    label: 'Nothing I would change — it went about right',
    competency: null,
    reply: 'Fair enough. I will take you at your word on that, and we will see what next week throws at you.',
    goal: null,
  },
];

const reflectionByKey = (key) => REFLECTIONS.find((r) => r.key === key) || null;

// ---- the development goal ----------------------------------------------------------------
//
// One per meeting. The learner's own reflection wins over the manager's observation when
// they name something -- it is their development, and somebody who has spotted their own
// problem should not be told to work on a different one.
function goalFrom(observations, reflectionKey) {
  const chosen = reflectionByKey(reflectionKey);
  if (chosen && chosen.goal) {
    return { competency: chosen.competency, title: chosen.goal.title, reason: chosen.goal.reason, from: 'reflection' };
  }
  // "Nothing I would change" is a real answer, so it does not get overridden by a rule --
  // but a week with something genuinely wrong in it still produces a focus.
  const strong = observations.find((o) => o.goal && o.key !== 'steady');
  if (chosen && chosen.key === 'fine' && !strong) return null;
  const src = strong || observations.find((o) => o.goal);
  if (!src) return null;
  return { competency: src.competency, title: src.goal.title, reason: src.goal.reason, from: 'observation' };
}

// ---- opportunity matching (§20) -------------------------------------------------------------
//
// What in NEXT week would practise the goal. Deterministic, and only where a genuine match
// exists -- a goal about delegation has nothing to practise on a junior's board, and
// pretending otherwise would be the fake-opportunity failure the brief rules out.
const OPPORTUNITY = {
  [COMPETENCY.COMMUNICATION]: {
    situationTypes: ['scope', 'scope-creep', 'question', 'status-chase', 'side-request', 'challenge'],
    tools: ['writeup', 'choice'],
  },
  [COMPETENCY.BUSINESS]: {
    situationTypes: ['challenge', 'judgement', 'bad-news', 'forward'],
    tools: ['sql', 'python', 'choice'],
  },
  [COMPETENCY.DELIVERY]: {
    situationTypes: ['pressure', 'blocked', 'status-chase'],
    tools: ['assign', 'signoff'],
  },
  [COMPETENCY.COACHING]: {
    situationTypes: [],
    tools: ['coach'],
  },
};

function isOpportunity(competency, { situationType, tool }) {
  const m = OPPORTUNITY[competency];
  if (!m) return false;
  if (situationType && m.situationTypes.includes(situationType)) return true;
  if (tool && m.tools.includes(tool)) return true;
  return false;
}

// How the goal fared: what the learner met, and what they did with it. Counted off
// handled_as and event patterns, not off a judgement about whether they "passed" --
// development is longitudinal and this is a conversation, not a mark.
function goalProgress(enrollmentId, goal, run, situationDefFor) {
  if (!goal || !run) return null;
  const situations = db.prepare('SELECT * FROM sim_situations WHERE enrollment_id = ? AND project_run_id = ?')
    .all(enrollmentId, run.id);
  let encountered = 0, handledDirectly = 0, escalated = 0, missed = 0;
  for (const s of situations) {
    const def = situationDefFor ? situationDefFor(run.project_key, s.situation_key) : null;
    if (!def || !isOpportunity(goal.competency, { situationType: def.type })) continue;
    encountered += 1;
    if (s.handled_as === 'reply') handledDirectly += 1;
    else if (s.handled_as === 'escalate') escalated += 1;
    else if (s.handled_as === 'archive' && def.needsReply) missed += 1;
  }
  return { encountered, handledDirectly, escalated, missed };
}

// ---- storage ----------------------------------------------------------------------------------

function insertOnce(sql, params) {
  try {
    db.prepare(sql).run(...params);
    return params[0];
  } catch (e) {
    if (/UNIQUE constraint failed/i.test(e.message)) return null;
    throw e;
  }
}

function meetingByKey(enrollmentId, key) {
  return db.prepare('SELECT * FROM sim_meetings WHERE enrollment_id = ? AND meeting_key = ?')
    .get(enrollmentId, key);
}

function dueMeetings(enrollmentId) {
  return db.prepare("SELECT * FROM sim_meetings WHERE enrollment_id = ? AND status = 'due' ORDER BY scheduled_on")
    .all(enrollmentId);
}

function allMeetings(enrollmentId, limit) {
  return db.prepare('SELECT * FROM sim_meetings WHERE enrollment_id = ? ORDER BY created_at DESC LIMIT ?')
    .all(enrollmentId, limit || 20);
}

function activeGoal(enrollmentId) {
  return db.prepare("SELECT * FROM sim_development_goals WHERE enrollment_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1")
    .get(enrollmentId);
}

function goalHistory(enrollmentId, limit) {
  return db.prepare('SELECT * FROM sim_development_goals WHERE enrollment_id = ? ORDER BY created_at DESC LIMIT ?')
    .all(enrollmentId, limit || 10);
}

const parse = (json, fallback) => { try { return JSON.parse(json); } catch { return fallback; } };

module.exports = {
  TYPES, STATUS, COMPETENCY, OBSERVATION_RULES, REFLECTIONS, OPPORTUNITY,
  buildEvidence, observationsFor, reflectionByKey, goalFrom,
  isOpportunity, goalProgress,
  insertOnce, meetingByKey, dueMeetings, allMeetings, activeGoal, goalHistory,
  parse, dayKey,
};
