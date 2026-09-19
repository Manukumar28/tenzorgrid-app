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

// ---- reading the record back (M08 §27, §28) ---------------------------------------------
//
// `significance` was written on every row, indexed, and read by absolutely nothing. M08
// §27 says use it or take it out. It gets used, because the volume problem in §28 has the
// same answer: after three weeks a learner has eight entries and after twelve they will
// have thirty, and "most recent first" means the page opens on whatever happened last --
// which for most weeks is a routine delivery.
//
// The order is significance first, then recency inside it. A returned piece of work put
// right is the entry somebody should see before a fourth ordinary week, whenever it
// happened. This is an ordering, not a filter: nothing is hidden, and `listByDate` is
// still there for surfaces that genuinely want a timeline.
const SIGNIFICANCE_ORDER = { high: 0, meaningful: 1, routine: 2 };

function listByDate(enrollmentId) {
  return db.prepare('SELECT * FROM sim_experiences WHERE enrollment_id = ? ORDER BY period_to DESC, created_at DESC')
    .all(enrollmentId);
}

function list(enrollmentId) {
  return listByDate(enrollmentId).sort((a, b) => {
    const bySignificance = (SIGNIFICANCE_ORDER[a.significance] ?? 2) - (SIGNIFICANCE_ORDER[b.significance] ?? 2);
    if (bySignificance !== 0) return bySignificance;
    return String(b.period_to || b.created_at).localeCompare(String(a.period_to || a.created_at));
  });
}

// The record, grouped the way somebody actually thinks about their own history: by the
// project it happened on, newest project first, with the strongest entry leading each
// group. Thirty flat cards is a wall; six projects with three or four entries each is a
// career.
function grouped(enrollmentId) {
  const rows = list(enrollmentId);
  const order = [];
  const byProject = new Map();
  for (const row of listByDate(enrollmentId)) {
    const key = row.project_key || 'other';
    if (!byProject.has(key)) {
      byProject.set(key, { key, title: row.project_title || 'Other work', from: row.period_from, to: row.period_to, rows: [] });
      order.push(key);
    }
    const g = byProject.get(key);
    if (row.period_from && (!g.from || row.period_from < g.from)) g.from = row.period_from;
    if (row.period_to && (!g.to || row.period_to > g.to)) g.to = row.period_to;
  }
  for (const row of rows) byProject.get(row.project_key || 'other').rows.push(row);
  return order.map((k) => byProject.get(k));
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

// ---- the reflection trust boundary (M08 §26) ---------------------------------------------
//
// M07 kept what a learner wrote about themselves in its own column and its own paragraph,
// and relied on every future reader honouring that. A convention. The failure it is meant
// to prevent -- somebody's own words being replayed back at them as a finding the system
// has made, or worse, exported as one -- is a one-line mistake away for anybody who
// assembles a payload without knowing the rule.
//
// So attribution travels WITH the text instead of being implied by which field it sits
// in. A reflection is not a string; it is an object that says who wrote it. A composer
// that treats it as a string gets "[object Object]" -- loud, immediate and impossible to
// ship -- rather than a quiet misattribution. `attributed` is the shape; `isLearnerVoice`
// is how a checker recognises it without having to know the field name it arrived under.
const VOICE = { LEARNER: 'learner', MANAGER: 'manager', SYSTEM: 'system' };

function attributed(text, voice) {
  if (text === null || text === undefined || text === '') return null;
  return {
    text: String(text),
    voice,
    // Spelled out, because the whole point is that a reader who has never seen this file
    // still cannot mistake whose sentence this is.
    byLearner: voice === VOICE.LEARNER,
    attribution: voice === VOICE.LEARNER
      ? 'Written by you at the time'
      : voice === VOICE.MANAGER ? 'Said by your manager' : 'Recorded by the system',
  };
}

const isLearnerVoice = (v) => Boolean(v && typeof v === 'object' && v.voice === VOICE.LEARNER);

// The gate. Anything a learner wrote must be attributed to them, and must never appear in
// a field the product speaks in -- the entry's own prose, or its evidence list.
function assertVoices(entry, where) {
  const at = where || 'experience entry';
  if (!entry || typeof entry !== 'object') return entry;
  if (entry.reflection !== null && entry.reflection !== undefined && !isLearnerVoice(entry.reflection)) {
    throw new Error(`${at}: a reflection reached a surface without being attributed to the learner.`);
  }
  const learnerText = entry.reflection ? entry.reflection.text.trim() : null;
  if (learnerText) {
    const systemProse = [entry.context, entry.responsibility, entry.outcome, entry.title]
      .concat(entry.actions || [])
      .concat((entry.evidence || []).map((e) => `${e.what || ''} ${e.detail || ''}`))
      .filter(Boolean).join(' \n ');
    if (systemProse.includes(learnerText)) {
      throw new Error(`${at}: the learner's own words are being presented as something the system established.`);
    }
  }
  return entry;
}

// The whole story, read when somebody opens one.
//
// `voices` is the manager's observation and the learner's reflection for the week this
// entry belongs to, supplied by the caller from the 1:1 rather than stored here.
//
// That split is deliberate, and it fixes something M07 left broken. Entries are written at
// project completion, which happens BEFORE the weekly 1:1; the two columns meant to carry
// those sentences were therefore filled in by nothing at all, and the Experience page had
// two sections that could never render. The obvious repair -- go back and update the entry
// after the meeting -- would break the rule that makes this table trustworthy: an entry is
// written once at a resolved boundary and never edited afterwards.
//
// So the row keeps what the row established, and what was SAID about the week is joined in
// at read time from the meeting that said it. Append-only storage, composed surface.
function detail(row, voices) {
  const v = voices || {};
  return assertVoices({
    ...summarise(row),
    context: row.context,
    responsibility: row.responsibility,
    actions: parse(row.actions_json, []),
    evidence: parse(row.evidence_json, []),
    // Both voices carry their attribution rather than relying on which field they sit in.
    managerObservation: attributed(row.manager_observation || v.managerObservation, VOICE.MANAGER),
    reflection: attributed(row.reflection || v.reflection, VOICE.LEARNER),
    level: row.role_level,
  }, `experience ${row.source_key}`);
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


// What the stakeholder actually ASKED for, out of what they wrote.
//
// The amendment stored on an event is the whole message, greeting and all. Taking its
// first sixty characters -- which is what this did -- produced Experience cards titled
// "Scope change: I know this is not your project and I am sorry. I need total…" and
// "Scope change: Thanks for the call yesterday, that was useful. One…". Both are real
// sentences the stakeholder wrote, and neither says what changed, which is the one thing
// the title exists to say.
//
// Nothing is invented here: the ask is SELECTED from the message rather than summarised.
// Real requests are marked in English -- "could you also", "I need", "do you want" -- so
// the sentence carrying one of those markers is the ask. Failing that, the longest
// sentence beats the first, because pleasantries are short and requests are not.
const ASK_MARKER = /\b(could you|can you|would you|do you want|i need|i'd need|please|can we|are you able)\b/i;

function askIn(message) {
  const text = String(message || '').replace(/\s+/g, ' ').trim();
  if (!text) return null;
  const sentences = text.split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter(Boolean);
  if (sentences.length <= 1) return text;
  const asked = sentences.find((x) => ASK_MARKER.test(x));
  if (asked) return asked;
  return sentences.reduce((best, x) => (x.length > best.length ? x : best), '');
}

// A stakeholder changed what they wanted, and the learner absorbed it.
function scopeEntry({ enrollmentId, run, project, level, event, amendment }) {
  if (!event) return null;
  // Two amendments on one project produced two cards reading "Scope change on Q1
  // Compensation Review" with identical outcome text -- not duplicates in the data, but
  // indistinguishable on screen, which is the same problem as far as a reader is
  // concerned. The title now carries what actually changed.
  const what = askIn(amendment && amendment.value);
  const shortWhat = what
    ? (what.length > 64 ? `${what.slice(0, 61).replace(/[\s,;:.]+\S*$/, '')}…` : what)
    : null;
  return {
    sourceKey: `scope:${event.id}`,
    kind: KIND.STAKEHOLDER,
    title: shortWhat ? `Scope change: ${shortWhat}` : `Scope change on ${project.title}`,
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
// When is a week actually "leading the work"? (M08 §30)
//
// This used to be `any leadership task at all`, which meant a senior who sat in on one
// review got an entry titled under "Leading the work" whose responsibility line read
// "Running Q1 Compensation Review -- allocating the work, reviewing output and owning
// what went out." They did none of those things. They helped with one review.
//
// The distinction that matters to anybody reading this later is between DOING leadership
// work and HOLDING the job. Staffing is the giveaway: deciding who does what is something
// only the person running the week does, so a single allocation decision qualifies.
// Sign-off and coaching are things a senior does routinely without running anything, so
// those need to be the shape of the week rather than a moment in it.
//
// Below the line the work is still recorded -- it happened, and it is good evidence --
// it just does not get to rename the week.
const LEADERSHIP_REVIEWS_FOR_FRAMING = 3;

function ledTheWork(lead) {
  if (!lead) return false;
  if ((lead.assign || 0) > 0) return true;
  return ((lead.signoff || 0) + (lead.coach || 0)) >= LEADERSHIP_REVIEWS_FOR_FRAMING;
}

function projectEntry({ run, project, level, metrics, situations, leadershipCounts, observation, reflection }) {
  const lead = leadershipCounts || {};
  const leadershipWork = ledTheWork(lead);
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

// ---- the provenance contract (M08 §24) ------------------------------------------------
//
// `simulated` used to be a column with DEFAULT 1 and a boolean on the way out. That is a
// convention, not a contract. A default cannot stop a new surface from assembling an
// experience payload by hand and forgetting it, and nothing anywhere refused a payload
// that arrived without it -- which matters more than it sounds, because the single thing
// this record must never do is present itself as paid employment.
//
// So provenance stops being a field somebody remembers to set and becomes a gate every
// outbound payload has to pass. One frozen object, one stamp function, and a check that
// throws. Throwing is deliberate: an experience payload that lost its provenance on the
// way out is a broken path, and a surface that renders nothing is far less dangerous than
// one that renders somebody's simulated week as a job they held.
const PROVENANCE = Object.freeze({
  simulated: true,
  // Where the work happened, in the world. An export needs this to be able to say what
  // the record IS without the reader having to already know.
  environment: 'TenzorGrid simulation',
  // Deliberately NOT called an employer. test/vault-test.js guards that word out of this
  // file, and it is right to: "employer" is the one noun that turns a simulated week into
  // a job somebody held.
  organisation: 'Meridian Analytics',
  // The sentence. Held here rather than retyped on each surface, so the Experience page,
  // the record header and anything exported later cannot word it three different ways.
  statement: 'Simulated professional experience, not paid employment.',
});

// Stamp a payload on its way out. Returns a new object; never mutates the caller's.
function withProvenance(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('Nothing to stamp.');
  return { ...payload, provenance: PROVENANCE, simulated: true };
}

// The gate. Throws with the path that failed, so a missing stamp names itself rather than
// turning into a quiet `undefined` on a page somebody reads about their own career.
function assertProvenance(payload, where) {
  const at = where || 'experience payload';
  if (!payload || typeof payload !== 'object') throw new Error(`${at}: nothing to check.`);
  if (payload.simulated !== true) throw new Error(`${at}: missing the simulated flag.`);
  const p = payload.provenance;
  if (!p || p.simulated !== true || !p.statement) throw new Error(`${at}: missing provenance.`);
  // Anything list-shaped underneath carries it too -- a single entry lifted out of an
  // index and rendered on its own must still say what it is.
  for (const entry of payload.entries || []) {
    if (entry && entry.simulated !== true) {
      throw new Error(`${at}: entry "${entry.key || '?'}" is not marked simulated.`);
    }
  }
  return payload;
}

// ---- claim composition safety (M08 §25) -------------------------------------------------
//
// M07's audit runs over ONE entry's own prose at the moment it is written. That stops the
// engine inventing "improved retention by 12%" inside a story. It does nothing about the
// dangerous case, which is prose composed ACROSS entries later -- exactly what a résumé
// bullet is. "Delivered four analytics projects worth £116,400 to the business" contains
// no forbidden phrase, is assembled entirely from true rows, and is still a claim nobody
// can stand behind.
//
// This is the infrastructure for that, and nothing more: no Resume UI, which §55 rules
// out. A caller hands over a candidate sentence and the evidence it is drawn from, and
// gets back a verdict with a reason.
//
// THREE RULES, in order of how often they catch something:
//
//   1. no forbidden impact language          -- the M07 audit, reused rather than forked
//   2. every NUMBER in the claim must appear in the evidence
//   3. a claim that cites no evidence is not a claim, it is an assertion
//
// Rule 2 is the one that generalises. A figure a learner can point at is a fact about
// their work; the same figure with no source behind it is the thing that ends a
// conversation badly in an interview.

// Numbers as a reader would say them: 12, 12.5, 1,240, £116,400, 80%.
const NUMBER_IN_TEXT = /\d[\d,]*(?:\.\d+)?/g;
const normaliseNumber = (t) => String(t).replace(/,/g, '');

// Every number the supporting evidence actually establishes.
function numbersIn(evidence) {
  const found = new Set();
  const walk = (v) => {
    if (v === null || v === undefined) return;
    if (typeof v === 'number') { found.add(normaliseNumber(v)); return; }
    if (typeof v === 'string') {
      for (const m of v.match(NUMBER_IN_TEXT) || []) found.add(normaliseNumber(m));
      return;
    }
    if (Array.isArray(v)) { v.forEach(walk); return; }
    if (typeof v === 'object') { Object.values(v).forEach(walk); }
  };
  walk(evidence);
  return found;
}

// validateClaim(claim, sourceEvidence) -> { ok, reason, unsupported }
//
// `sourceEvidence` is whatever the claim was built from: an entry, a list of entries, a
// metrics object, or any mix. It is walked rather than required to be a particular shape,
// because the point is to make this cheap enough that every future composer uses it.
function validateClaim(claim, sourceEvidence) {
  const text = String(claim || '').trim();
  if (!text) return { ok: false, reason: 'empty', detail: 'There is no claim to check.' };

  const forbidden = text.match(FORBIDDEN_CLAIM);
  if (forbidden) {
    return {
      ok: false,
      reason: 'impact-claim',
      detail: `"${forbidden[0]}" asserts a business result the simulation never established.`,
    };
  }

  const cited = numbersIn(sourceEvidence);
  const claimed = (text.match(NUMBER_IN_TEXT) || []).map(normaliseNumber);

  if (!cited.size && claimed.length) {
    return {
      ok: false,
      reason: 'no-evidence',
      detail: 'The claim carries figures and nothing was supplied to support them.',
      unsupported: [...new Set(claimed)],
    };
  }

  // A year is not a metric. "in 2026" should not have to be justified by a row.
  const isYear = (n) => /^(19|20)\d\d$/.test(n);
  const unsupported = [...new Set(claimed)].filter((n) => !isYear(n) && !cited.has(n));
  if (unsupported.length) {
    return {
      ok: false,
      reason: 'unsupported-figure',
      detail: `Nothing in the evidence establishes ${unsupported.map((n) => `"${n}"`).join(', ')}.`,
      unsupported,
    };
  }

  return { ok: true };
}

// The same check, applied to a whole composed passage sentence by sentence, so a caller
// finds out WHICH sentence is the problem rather than that something somewhere is.
function validatePassage(passage, sourceEvidence) {
  const sentences = String(passage || '').split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter(Boolean);
  for (const sentence of sentences) {
    const verdict = validateClaim(sentence, sourceEvidence);
    if (!verdict.ok) return { ...verdict, sentence };
  }
  return { ok: true };
}

module.exports = {
  KIND, SIGNIFICANCE, FORBIDDEN_CLAIM,
  unsupportedClaim, record, insertOnce, list, listByDate, grouped, byKey, summarise, detail, parse,
  ledTheWork, LEADERSHIP_REVIEWS_FOR_FRAMING, askIn,
  VOICE, attributed, isLearnerVoice, assertVoices,
  PROVENANCE, withProvenance, assertProvenance,
  validateClaim, validatePassage, numbersIn,
  recoveryEntry, scopeEntry, escalationEntry, projectEntry,
};
