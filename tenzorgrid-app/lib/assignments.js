// Assignments — workplace meaning over the existing task engine.
//
// The task stays the executable, gradeable unit. Nothing here changes what is asked, how
// it is marked, when it unlocks, or what it is worth. This layer answers the questions a
// task row cannot: who wants this, why does the business care, and what am I handing over.
//
// WHAT THIS IS NOT
//
// It is not a rewrite of 602 briefs, and it does not invent business context. The briefs
// already carry it -- "Vikram wants to know which department is paying the most", "It goes
// out under your name on Friday" -- and rewriting them would have destroyed better writing
// than any template produces. What was missing was structure, a requester as a real field,
// and the project scenario in lib/projectdocs.js, which was written for all sixteen
// projects and never reached the learner.
//
// So every field below is DERIVED from something authored, in this order:
//
//   1. an explicit `assignment` block on the task, if one is ever authored
//   2. the task's own brief          -> what I need from you
//   3. the project's scenario        -> why this matters
//   4. a template keyed on the tool  -> the deliverable
//   5. a professional generic        -> only when nothing above exists
//
// The fallback is deliberately vague rather than specific. "Prepare the requested analysis
// for the project team" is a worse sentence than the real thing and a much better one than
// a board meeting that does not exist.

const projectdocs = require('./projectdocs');

// What a piece of work produces, by the kind of work it is. Generic on purpose: a future
// role's `deploy` or `triage` tool adds a line here, and nothing else changes.
//
// None of these say "complete the task". A stakeholder does not ask for a completed task,
// they ask for a number they can act on, a chart they can show, or a decision.
const DELIVERABLE_BY_TOOL = {
  sql: 'A query, and the number it produces.',
  python: 'A computed result, with the working visible in the notebook.',
  chart: 'One chart, ready to put in front of the people who asked.',
  choice: 'A decision, and it is yours to make.',
  writeup: 'A written reply the recipient can act on without asking you anything else.',
  coach: 'A reply that leaves them able to fix it themselves.',
  assign: 'An allocation for the week that survives contact with it.',
  signoff: 'A sign-off decision — it goes out under your name either way.',
};
const DELIVERABLE_FALLBACK = 'The finished piece of work, ready for review.';

// The shape of the ask, in one line, for a board row. Compact by design -- see the note on
// `summarise` below.
const ASK_BY_TOOL = {
  sql: 'Query the data',
  python: 'Work it out in Python',
  chart: 'Build the visual',
  choice: 'Make the call',
  writeup: 'Write to them',
  coach: 'Coach them through it',
  assign: 'Staff the week',
  signoff: 'Sign it off, or do not',
};

// Work that comes from inside the line rather than from the business.
//
// Coaching a junior and staffing a week are not things a stakeholder asks for; they are
// things your manager hands you because you are the one above them now. Getting this wrong
// is the specific absurdity the brief warns about -- a Finance stakeholder requesting an HR
// coaching conversation.
const MANAGER_SOURCED_TOOLS = new Set(['coach', 'assign']);

// Everybody a brief could plausibly name, longest first so "Asha Rao" wins over "Asha".
function rosterIndex(roster) {
  return [...(roster || [])]
    .filter((p) => p && p.name && p.archetype !== 'learner')
    .sort((a, b) => b.name.length - a.name.length);
}

// Being named in a brief is not the same as having asked for something.
//
// Three real openings, and only the first is a requester:
//
//   "Vikram wants to know which department is paying the most"   <- asked
//   "Ishaan has been asked to help and has sent you his first cut" <- the subject
//   "Ravi has sent through the headline figure for the pack"       <- the subject
//
// Taking the first name in the sentence made a junior analyst the requester of his own
// coaching, which is the shape of nonsense a template produces when it pattern-matches
// instead of reading. So a named requester has to be doing a requesting verb, close
// enough to the name to be about them.
const REQUESTING_VERB = /\b(wants?|needs?|has asked|have asked|asked (?:you )?for|is asking|are asking|would like|requires?)\b/i;

function namedRequesterIn(sentence, people) {
  for (const p of people) {
    const first = p.name.split(' ')[0];
    const at = sentence.indexOf(p.name) >= 0 ? sentence.indexOf(p.name) : sentence.indexOf(first);
    if (at < 0) continue;
    // The verb has to follow the name, within the clause -- "Vikram wants" counts,
    // "reply to Vikram once Finance needs it" does not.
    const after = sentence.slice(at, at + 90);
    if (REQUESTING_VERB.test(after)) return p;
  }
  return null;
}

// Who wants this.
//
// Deterministic, and in a fixed order so the same task cannot be a Finance request on
// Monday and a Marketing one after a refresh:
//
//   1. an authored requester on the task, if one is ever written
//   2. the manager, for work that comes down the line rather than in from the business
//   3. whoever the brief's opening says ASKED for it -- the author named them on purpose
//   4. the project's own stakeholder
//
// Step 2 sits above step 3 deliberately. Coaching and staffing come from your manager
// whoever the brief happens to mention first.
function requesterFor(taskDef, brief, project, roster) {
  const people = rosterIndex(roster);
  const find = (a) => people.find((p) => p.archetype === a) || null;

  if (taskDef && taskDef.assignment && taskDef.assignment.requester) {
    const explicit = find(taskDef.assignment.requester);
    if (explicit) return explicit;
  }

  if (taskDef && MANAGER_SOURCED_TOOLS.has(taskDef.tool)) return find('line_manager');

  const opening = String(brief || '').split(/(?<=[.?!])\s/).slice(0, 2).join(' ');
  const named = namedRequesterIn(opening, people);
  if (named) return named;

  return find((project && project.stakeholder) || 'stakeholder') || find('stakeholder');
}

// Who checks it. Always the line manager: she is the only person in the simulation who
// signs work off, and conflating her with the requester is exactly the collapse the
// experience is trying to avoid -- the stakeholder wants the outcome, the manager owns
// whether it is good enough.
function reviewerFor(roster) {
  return rosterIndex(roster).find((p) => p.archetype === 'line_manager') || null;
}

// Why the business cares. One per project, already written, sixteen for sixteen.
function whyFor(projectKey) {
  const doc = projectdocs.getProjectDoc ? projectdocs.getProjectDoc(projectKey) : null;
  const src = doc || (projectdocs.PROJECT_DOCS || {})[projectKey];
  if (!src) return null;
  return {
    scenario: src.scenario || null,
    objective: src.primaryObjective || null,
    watchOutFor: Array.isArray(src.watchOutFor) ? src.watchOutFor : [],
  };
}

function deliverableFor(taskDef) {
  if (taskDef && taskDef.assignment && taskDef.assignment.deliverable) return taskDef.assignment.deliverable;
  return DELIVERABLE_BY_TOOL[(taskDef && taskDef.tool) || 'sql'] || DELIVERABLE_FALLBACK;
}

// The compact form, for a board row or a queue line.
//
// The full context is prose and there can be 120 rows on a manager's board; building all
// of it for every row would have inflated the payload for text nothing on that screen
// renders. A row needs to know who asked and what shape the work is. That is all this is.
function summarise(taskDef, row, project, roster) {
  const requester = requesterFor(taskDef, (row && row.brief) || (taskDef && taskDef.brief), project, roster);
  return {
    requestedBy: requester ? requester.name : null,
    requestedByTitle: requester ? requester.title : null,
    requestedByArchetype: requester ? requester.archetype : null,
    ask: ASK_BY_TOOL[(taskDef && taskDef.tool)] || null,
    fromTheLine: Boolean(taskDef && MANAGER_SOURCED_TOOLS.has(taskDef.tool)),
  };
}

// The full thing, built only for a task somebody has actually opened.
function build({ taskDef, task, project, roster, resources }) {
  const brief = (task && task.brief) || (taskDef && taskDef.brief) || '';
  const requester = requesterFor(taskDef, brief, project, roster);
  const reviewer = reviewerFor(roster);
  const why = whyFor(project && project.key);
  const person = (p) => (p ? { archetype: p.archetype, name: p.name, title: p.title, avatarUrl: p.avatarUrl || null } : null);

  return {
    title: (task && task.title) || (taskDef && taskDef.title) || 'Assignment',
    // The ask, as authored. Not paraphrased, not split by a regex that would eventually
    // cut a sentence in half -- the brief already says what is needed.
    request: brief,
    why: why && why.scenario ? why.scenario : null,
    objective: why ? why.objective : null,
    watchOutFor: why ? why.watchOutFor : [],
    deliverable: deliverableFor(taskDef),
    requestedBy: person(requester),
    reviewer: person(reviewer),
    // Where the work came from, in a word, so a surface can say "from your manager"
    // without re-deriving the rule.
    source: taskDef && MANAGER_SOURCED_TOOLS.has(taskDef.tool) ? 'line' : 'business',
    project: project ? { key: project.key, title: project.title } : null,
    tool: taskDef ? taskDef.tool : null,
    // Only things that genuinely exist. A link to a brief that is not written, or a
    // dataset a task does not use, is worse than no link at all.
    resources: (resources || []).filter((r) => r && r.label && r.kind),
  };
}

module.exports = {
  DELIVERABLE_BY_TOOL,
  ASK_BY_TOOL,
  MANAGER_SOURCED_TOOLS,
  requesterFor,
  reviewerFor,
  whyFor,
  deliverableFor,
  summarise,
  build,
};
