// Virtual Workspace — P0 slice.
//
// Scope, deliberately narrow (see PROJECT_PLAN.md, Phase 1): one role (Data Analyst),
// individual-contributor track only, no certificate issuance yet, no live per-learner
// containers. SQL tasks run against a synthetic practice dataset built fresh in an
// isolated in-memory node:sqlite database for every execution — this NEVER touches
// tenzorgrid.db (which holds real users, sessions and password hashes). A learner's
// query can only ever see data we seeded on purpose.
//
// Character engine: archetype + domain skin -> a system prompt handed to lib/ai.js's
// callClaude(). Only the Line Manager grades (non-negotiable rule from the character
// architecture) — every other character just applies pressure or narrates.

const { db, cryptoRandomId } = require('./db');
const ai = require('./ai');
const { pickAvatar } = require('./avatars');
const { buildDatasetDb, describeDataset, dumpDataset, DEFAULT_DATASET } = require('./datasets');
const { getProjectDoc, TOOLS } = require('./projectdocs');
const skilltest = require('./skilltest');
const charttasks = require('./charttasks');
const tasktypes = require('./tasktypes');
const dayitems = require('./dayitems');
const ambientmail = require('./ambientmail');

const LINE_MANAGER_NAME = 'Asha Rao';
const STAKEHOLDER_NAME = 'Vikram Nair';
const PEOPLE_PARTNER_NAME = 'Neha Kulkarni';

// The levels a learner can be enrolled at. The switcher offers these and timeTravelReset
// validates against them, so the two can never drift apart.
const LEVELS = [
  { key: 'junior', label: 'Junior Data Analyst' },
  { key: 'senior', label: 'Senior Data Analyst' },
];

const ROLE_CATALOG = {
  data_analyst: { label: 'Data Analyst', skin: 'Data & Analytics' },
};

// The Team tab roster. Manager-track direct reports get added here once team
// assembly ships (P2) — for the IC track this fixed cast is the whole org chart
// above the learner. `gender` is required on every entry: it's what picks a fitting
// avatar illustration out of the pool (see lib/avatars.js) — new characters added
// later (more roles, the manager track) just need a name/title/gender here and get a
// real avatar automatically, no manual picking required.
// The cast.
//
// It used to be three people, while tasks and project briefs named seven more — you were
// asked to review Rahul's query and brief Arjun without either of them existing anywhere
// you could reach. Anyone whose name appears on a task or a project is now a real
// colleague you can message.
//
// `core` marks the three who drive the simulation: only the Line Manager grades, and the
// other two carry the HR and stakeholder pressure. The rest are colleagues — they answer
// about their own patch, and they are who you go to when you are stuck.
//
// `helpsWith` is what that person can actually be useful about. It is authored rather
// than inferred, because a colleague who confidently answers a question outside their job
// is worse than one who says "not my area, ask Rahul".
const ROSTER = [
  { archetype: 'line_manager', name: LINE_MANAGER_NAME, title: 'Line Manager', gender: 'female', core: true,
    helpsWith: ['scope', 'priorities', 'feedback'], about: 'Your manager. She assigns your work and she is the only person who signs it off.' },
  { archetype: 'people_partner', name: PEOPLE_PARTNER_NAME, title: 'People Partner (HR)', gender: 'female', core: true,
    helpsWith: ['policy', 'bands', 'headcount'], about: 'People Ops. Owns the salary bands and the headcount data, and framed the equity question.' },
  { archetype: 'stakeholder', name: STAKEHOLDER_NAME, title: 'Business Stakeholder', gender: 'male', core: true,
    helpsWith: ['what the business needs', 'deadlines'], about: 'The person your analysis is for. He will tell you what he needs, rarely how to get it.' },

  { archetype: 'data_engineer', name: 'Rahul Verma', title: 'Data Engineer', gender: 'male',
    helpsWith: ['sql', 'joins', 'the source tables', 'nulls'], about: 'Pulled and validated the HR source tables. Knows where the data is odd and why.' },
  { archetype: 'support_lead', name: 'Sneha Joshi', title: 'Support Lead', gender: 'female',
    helpsWith: ['incidents', 'tickets', 'severity'], about: 'Logs and triages every incident. If you are unsure what a SEV1 actually means here, ask her.' },
  { archetype: 'engineering_manager', name: 'Arjun Rao', title: 'Engineering Manager', gender: 'male',
    helpsWith: ['reliability', 'what engineering will act on'], about: 'Plans engineering effort from your findings. Will argue with your numbers, which is useful.' },
  { archetype: 'finance_analyst', name: 'Diya Chandra', title: 'Finance Analyst', gender: 'female',
    helpsWith: ['revenue', 'cost', 'the salary baseline'], about: 'Supplies the cost and revenue baselines. Good on what a number means to Finance.' },
  { archetype: 'comms', name: 'Meera Pillai', title: 'Comms', gender: 'female',
    helpsWith: ['writing', 'how to say it', 'the leadership summary'], about: 'Turns your analysis into something leadership reads. Blunt about unclear writing.' },
  { archetype: 'finance_manager', name: 'Aarav Bose', title: 'Finance Manager', gender: 'male',
    helpsWith: ['remediation cost', 'budget'], about: 'Costs the remediation from your findings. Thinks in what it would take to fix.' },
];

// Everyone who is not one of the three core characters. These are the people a learner
// can befriend and ask for help.
const COLLEAGUES = ROSTER.filter((r) => !r.core);

// Assigns each roster member a stable avatar from their gender's pool, guaranteeing no
// two characters shown together end up with the same picture.
function rosterWithAvatars(enrollmentId) {
  const used = new Set();
  const contacts = enrollmentId
    ? Object.fromEntries(db.prepare('SELECT * FROM sim_contacts WHERE enrollment_id = ?').all(enrollmentId)
        .map((c) => [c.archetype, c]))
    : {};
  return ROSTER.map((p) => {
    const c = contacts[p.archetype];
    return {
      ...p,
      avatarUrl: pickAvatar(p.archetype, p.gender, used),
      friend: Boolean(c && c.friends_at),
      // How many more messages before this person counts as someone you know. Shown so
      // the learner can see that talking to people is going somewhere.
      messagesToFriend: p.core ? 0 : Math.max(0, FRIENDSHIP_AT - ((c && c.messages_sent) || 0)),
    };
  });
}

// Archetypes whose messages surface in the Emails tab (external-facing, formal)
// rather than Team Chat (internal). Only Vikram exists in P0; customer/client
// archetypes join this list as later roles add them.
const EMAIL_ARCHETYPES = ['stakeholder'];

// The project catalog for a role. This is authored curriculum — the scenario a learner
// works inside — in the same way TASKS and MILESTONE already are. `impactValue` is the
// business value the simulated project represents; it is NOT a claim about anything the
// learner has earned. What they've actually banked is computed from their own graded
// rows (getProjects), and Total impact only ever counts projects genuinely finished.
//
// Every project queries the same `employees` practice table, so the titles stay inside
// the data we actually seed. A project promising a churn or inventory dataset would be
// a brief no learner could complete, because no such table exists to query.
//
// `unlockAfter` is the number of projects that must be completed first — a real gate,
// checked against real completions, not decoration.
const PROJECT_CATALOG = {
  data_analyst: [
    {
      key: 'compensation-review',
      title: 'Q1 Compensation Review',
      description: 'A departmental pay analysis for the leadership team, run out of the Data & Analytics function.',
      kind: 'analysis',
      stakeholder: 'stakeholder',
      difficulty: 'Medium',
      taskKeys: [
        // Day 1 — scope it, look at the data, do the analysis, check a colleague, decide
        // what you can claim, write to the stakeholder.
        'da-100', 'da-101', 'da-001', 'da-102', 'da-103', 'da-104',
        // Day 2 — the stakeholder changes the question, and the honest answer is not the
        // obvious one.
        'da-110', 'da-006', 'da-111', 'da-112', 'da-113', 'da-114',
        // Day 3 — the wobble. Vikram asks for a regional split; the data supports it and
        // the answer is still no, which is much harder to say than "we do not have that".
        'da-120', 'da-121', 'da-122', 'da-123', 'da-124', 'da-125',
        // Day 4 — consolidate, and check what other people are about to say in your name.
        'da-130', 'da-131', 'da-132', 'da-133', 'da-134', 'da-135',
        // Day 5 — deliver, with someone waiting. Hardest, and not because the SQL is
        // harder: because you have to stand behind it while a stakeholder pushes.
        'da-140', 'da-141', 'da-142', 'da-143', 'da-144', 'da-145',
      ],
      skillFocus: ['sql', 'dataViz', 'businessLogic', 'communication'],
      impactValue: 12400,
      // The rest of the project, so the learner can see their part of a whole rather
      // than a task list. These are named participants in the scenario, NOT members of
      // the messageable roster — nobody can chat to them, and nothing claims they can.
      contributors: [
        { name: 'Rahul Verma', role: 'Data Engineer', does: 'Pulled and validated the HR source tables', day: 1 },
        { name: null, role: 'Data Analyst', does: 'The compensation analysis', day: 1, throughDay: 5 },
        { name: 'Meera Pillai', role: 'Comms', does: 'Writes the leadership summary', day: 5, needsYou: true },
      ],
      unlockAfter: 0,
    },
    {
      key: 'headcount-trends',
      title: 'Headcount & Hiring Trends',
      description: 'People Ops wants the hiring pattern by year, and what each intake cost on average.',
      kind: 'dashboard',
      stakeholder: 'line_manager',
      difficulty: 'Medium',
      taskKeys: [
        // Day 1 — what hiring has actually done, and the two years too thin to read.
        'hc-101', 'hc-102', 'da-002', 'hc-103', 'hc-104', 'hc-105',
        // Day 2 — what each intake cost, and why the cheapest year is not a finding.
        'hc-110', 'hc-111', 'da-007', 'hc-112', 'hc-113', 'hc-114',
        // Day 3 — attrition. Six leavers in total, two each in three departments: the
        // request is reasonable, the data exists, and the answer is still no.
        'hc-120', 'hc-121', 'hc-122', 'hc-123', 'hc-124', 'hc-125',
        // Day 4 — where the hiring actually went, and what Comms is about to say in
        // your name.
        'hc-130', 'hc-131', 'hc-132', 'hc-133', 'hc-134', 'hc-135',
        // Day 5 — the plan, with Neha pushing for a single number.
        'hc-140', 'hc-141', 'hc-142', 'hc-143', 'hc-144', 'hc-145',
      ],
      skillFocus: ['sql', 'dataViz'],
      impactValue: 8000,
      contributors: [
        { name: 'Diya Chandra', role: 'Finance Analyst', does: 'Supplied the salary cost baseline', day: 1 },
        { name: null, role: 'Data Analyst', does: 'The hiring trend analysis', day: 1, throughDay: 5 },
        { name: 'Neha Kulkarni', role: 'People Partner', does: 'Builds next year\'s hiring plan on your numbers', day: 5, needsYou: true },
      ],
      unlockAfter: 1,
    },
    {
      key: 'outage-recovery',
      title: 'Project Phoenix: Outage Impact & Client Recovery',
      description: 'Quantify who the billing-sync outage really hurt, so Customer Success knows where to spend the compensation budget.',
      kind: 'analysis',
      stakeholder: 'stakeholder',
      difficulty: 'Hard',
      taskKeys: ['da-004'],
      skillFocus: ['sql', 'businessLogic', 'communication'],
      impactValue: 21000,
      contributors: [
        { name: 'Sneha Joshi', role: 'Support Lead', does: 'Logged and triaged every incident', day: 1 },
        { name: 'Rahul Verma', role: 'Data Engineer', does: 'Reconstructed the corrupted rows', day: 1 },
        { name: null, role: 'Data Analyst', does: 'The impact and revenue-at-risk analysis', day: 1, throughDay: 5 },
        { name: 'Vikram Nair', role: 'Business Stakeholder', does: 'Takes compensation offers to the clients', day: 5, needsYou: true },
      ],
      unlockAfter: 3,
    },
    {
      key: 'pay-equity-audit',
      title: 'Pay Equity Audit',
      description: 'A role-by-role look at pay spread, to find where the same job is paid very differently.',
      kind: 'audit',
      stakeholder: 'stakeholder',
      difficulty: 'Hard',
      taskKeys: ['da-003', 'da-005'],
      skillFocus: ['sql', 'python', 'businessLogic', 'communication'],
      impactValue: 15000,
      contributors: [
        { name: 'Neha Kulkarni', role: 'People Partner', does: 'Framed the equity question and scope', day: 1 },
        { name: null, role: 'Data Analyst', does: 'The role-by-role pay analysis', day: 1, throughDay: 5 },
        { name: 'Aarav Bose', role: 'Finance Manager', does: 'Costs the remediation from your findings', day: 5, needsYou: true },
      ],
      unlockAfter: 2,
    },

    // ---- Senior track -------------------------------------------------------------
    // The user's call, and the right one: a senior learner gets DIFFERENT projects, not
    // the same brief written vaguer. These sit on the ops dataset rather than HR, ask
    // for rates and distributions rather than totals, and leave the learner to decide
    // what to exclude — which is most of what seniority actually is.
    {
      key: 'reliability-review',
      title: 'Platform Reliability Review',
      description: 'Engineering leadership needs to know which service costs the most time when it breaks, and where the backlog is concentrated.',
      kind: 'analysis',
      stakeholder: 'stakeholder',
      difficulty: 'Hard',
      level: 'senior',
      taskKeys: [
        // Day 1 — same six-slot shape as the junior week, senior questions.
        'sa-010', 'sa-011', 'sa-001', 'sa-012', 'sa-013', 'sa-014',
        'sa-003',
      ],
      skillFocus: ['sql', 'businessLogic', 'communication'],
      impactValue: 28000,
      contributors: [
        { name: 'Sneha Joshi', role: 'Support Lead', does: 'Logged and triaged every incident', day: 1 },
        { name: null, role: 'Senior Data Analyst', does: 'The reliability and backlog analysis', day: 1, throughDay: 5 },
        { name: 'Arjun Rao', role: 'Engineering Manager', does: 'Plans next quarter from your findings', day: 5, needsYou: true },
      ],
      unlockAfter: 0,
    },
    {
      key: 'account-economics',
      title: 'Account Economics Review',
      description: 'Finance wants to know which accounts cost more to support than they return, and where the engineering time actually goes.',
      kind: 'audit',
      stakeholder: 'stakeholder',
      difficulty: 'Hard',
      level: 'senior',
      taskKeys: ['sa-002', 'sa-004'],
      skillFocus: ['sql', 'python', 'businessLogic'],
      impactValue: 34000,
      contributors: [
        { name: 'Diya Chandra', role: 'Finance Analyst', does: 'Supplied the revenue baseline', day: 1 },
        { name: null, role: 'Senior Data Analyst', does: 'The cost-to-serve analysis', day: 1, throughDay: 5 },
        { name: 'Vikram Nair', role: 'Business Stakeholder', does: 'Takes the pricing case to the board', day: 5, needsYou: true },
      ],
      unlockAfter: 1,
    },
  ],
};

// Junior and senior see different catalogues. A project with no `level` is junior-track;
// this is the one place the split is decided, so nothing downstream has to know about it.
//
// `touchedKeys` is what a promoted learner has already worked on. Those projects stay in
// their catalogue for good: promotion must never erase the record of how they got there,
// which is the whole thing they are meant to walk into an interview with.
function catalogFor(role, level, touchedKeys) {
  const all = PROJECT_CATALOG[role] || [];
  const want = level === 'senior' ? 'senior' : 'junior';
  const touched = touchedKeys instanceof Set ? touchedKeys : new Set(touchedKeys || []);
  return all.filter((p) => (p.level || 'junior') === want || touched.has(p.key));
}

// Which projects this learner has actually worked on, from their own task rows. A
// promoted learner keeps these in their catalogue for good.
function touchedProjectKeys(role, tasks) {
  const keys = new Set();
  const have = new Set(tasks.map((t) => t.task_key));
  for (const p of PROJECT_CATALOG[role] || []) {
    if (p.taskKeys.some((k) => have.has(k))) keys.add(p.key);
  }
  return keys;
}

// The promotion review.
//
// The user's rule, in their words: promote on "performance AND training done". Both, not
// either — finishing four projects badly is not a promotion, and one brilliant project
// out of four is not a body of work. The two criteria are reported separately with real
// numbers, because "you were not promoted" is a sentence that has to come with the
// arithmetic behind it.
const PROMOTION = {
  from: 'junior',
  to: 'senior',
  // One month of the programme: four projects at five working days each.
  projectsRequired: 4,
  // A grade average, not a productivity blend. Timeliness and check-in consistency are
  // real signals but they are not competence, and a promotion is about competence.
  minAverage: 70,
  title: 'Senior Data Analyst',
};

function getPromotion(enrollment, projects, gradedTasks, tasks) {
  if ((enrollment.level || 'junior') !== PROMOTION.from && !enrollment.promoted_at) return null;

  const juniorKeys = new Set(
    (PROJECT_CATALOG[enrollment.role] || [])
      .filter((p) => (p.level || 'junior') === PROMOTION.from)
      .map((p) => p.key),
  );
  // Only projects that are finished being WRITTEN can be finished by a learner, so the
  // bar is the number of them that exist. Without this, shipping the ladder before the
  // content makes promotion permanently unreachable — the learner clears everything in
  // front of them and is told they are two projects short of something that is not there.
  const readyJuniorKeys = new Set(
    (PROJECT_CATALOG[enrollment.role] || [])
      .filter((p) => juniorKeys.has(p.key) && projectReadiness(p).ready)
      .map((p) => p.key),
  );
  const required = Math.min(PROMOTION.projectsRequired, Math.max(1, readyJuniorKeys.size));
  const completed = projects.filter((p) => juniorKeys.has(p.key) && p.status === 'completed').length;
  const average = gradedTasks.length
    ? Math.round(gradedTasks.reduce((s, t) => s + (t.score || 0), 0) / gradedTasks.length)
    : null;

  const trainingDone = completed >= required;
  const performanceMet = average !== null && average >= PROMOTION.minAverage;

  // A parked task keeps its project out of `completed`, so a learner who reached the end
  // of the track with parked work would sit in silence forever, never told why the
  // review never came. `atTheEnd` is what actually triggers the conversation: every
  // junior project started, and every task in them resolved one way or the other.
  const juniorTaskKeys = new Set(
    (PROJECT_CATALOG[enrollment.role] || [])
      .filter((p) => juniorKeys.has(p.key))
      .flatMap((p) => p.taskKeys),
  );
  const mine = (tasks || []).filter((t) => juniorTaskKeys.has(t.task_key));
  const startedProjects = projects.filter((p) => juniorKeys.has(p.key) && (p.status === 'active' || p.status === 'completed')).length;
  const parked = mine.filter((t) => t.status === 'parked');
  const atTheEnd = startedProjects >= required
    && mine.length > 0
    && mine.every((t) => t.status === 'graded' || t.status === 'parked');

  return {
    awarded: Boolean(enrollment.promoted_at),
    awardedAt: enrollment.promoted_at || null,
    toTitle: PROMOTION.title,
    eligible: trainingDone && performanceMet,
    criteria: [
      {
        key: 'training',
        label: `Complete all ${required} junior project${required === 1 ? '' : 's'}`,
        met: trainingDone,
        value: completed,
        target: required,
        detail: `${completed} of ${required} delivered`,
      },
      {
        key: 'performance',
        label: `Average score of ${PROMOTION.minAverage} or above`,
        met: performanceMet,
        value: average,
        target: PROMOTION.minAverage,
        detail: average === null
          ? 'No graded work yet'
          : `${average} across ${gradedTasks.length} graded task${gradedTasks.length === 1 ? '' : 's'}`,
      },
    ],
    // Only meaningful while short on score: work they could genuinely lift.
    shortfall: !performanceMet && average !== null ? PROMOTION.minAverage - average : null,
    // Internal: whether the review is due, and what is holding it up.
    atTheEnd,
    parked: parked.map((t) => ({ id: t.id, title: t.title })),
  };
}

// Runs the review at read time. Promotion is announced to you in a real job — you do not
// click a button to claim it — so this fires by itself once both criteria hold.
function runPromotionReview(enrollment, promotion, tasks) {
  if (!promotion || promotion.awarded) return false;

  if (promotion.eligible) {
    const at = now();
    db.prepare('UPDATE sim_enrollments SET level = ?, promoted_at = ? WHERE id = ?')
      .run(PROMOTION.to, at, enrollment.id);
    const perf = promotion.criteria.find((c) => c.key === 'performance');
    addMessage(enrollment.id, 'line_manager', LINE_MANAGER_NAME,
      `I've put you forward for ${PROMOTION.title} and it's gone through.\n\nFour projects delivered and an average of ${perf.value} across them — that's the bar, and you cleared it on both counts rather than scraping one. What changes: you'll get different work, not the same work with less hand-holding. It's less "answer this question" and more "decide what the question should be", and I'll be reviewing your judgement as much as your SQL.\n\nYour first senior project is on your board now.`,
      null, `Promotion — ${PROMOTION.title}`);
    addMessage(enrollment.id, 'people_partner', PEOPLE_PARTNER_NAME,
      `Congratulations — your promotion to ${PROMOTION.title} is confirmed and effective today. It's on your record, so it'll appear on anything you take out of here.`,
      null, 'Promotion confirmed');
    return true;
  }

  // Not eligible. Say so ONCE, with the arithmetic — but only once they are actually at
  // the end of the track. Telling someone mid-project that they are short is just noise,
  // and leaving someone who HAS reached the end in silence is worse: they would never
  // learn why the review did not come.
  const training = promotion.criteria.find((c) => c.key === 'training');
  const perf = promotion.criteria.find((c) => c.key === 'performance');
  if (!promotion.atTheEnd || enrollment.promotion_told_at) return false;

  // Parked work comes first, because it is both the reason the review is blocked and the
  // one thing they can genuinely act on today. A parked task can be resubmitted; a
  // signed-off one cannot, so promising improvement with nothing to improve would be a lie.
  let body;
  if (promotion.parked.length) {
    const n = promotion.parked.length;
    body = `We've reached the end of the junior track and I want to be straight with you rather than leave you guessing.\n\nI can't put you forward yet, and it isn't the score — it's that ${n === 1 ? 'one task is' : `${n} tasks are`} still parked: ${promotion.parked.map((t) => `"${t.title}"`).join(', ')}. Parked means you got the answer out but couldn't talk me through the choice, and I'm not signing off work neither of us can explain.\n\nThat's the good news, though — it's the one thing here you can fix today. Reopen ${n === 1 ? 'it' : 'them'}, work out what you missed, and resubmit. Then we do the review properly.`;
  } else {
    body = `We've done the promotion round and I want to be straight with you rather than leave you guessing.\n\nYou've finished all ${training.target} projects, which is the training half done. The other half is an average of ${PROMOTION.minAverage} and you're at ${perf.value} — ${promotion.shortfall} short.\n\nEverything you've submitted is signed off, so there's nothing sitting there to recover. That means this is a next-cycle conversation, not a this-week one — the work you do from here is what moves it.\n\nThis isn't a judgement on you. It's a number, and numbers move.`;
  }
  addMessage(enrollment.id, 'line_manager', LINE_MANAGER_NAME, body, null, 'Promotion round — where you stand');
  db.prepare('UPDATE sim_enrollments SET promotion_told_at = ? WHERE id = ?').run(now(), enrollment.id);
  return false;
}

// A graded task scores 0-100 on each skill axis it exercises. Skill *points* are that
// score on a 0-5 scale (score / 20), so one perfect task is worth 5.0 points on an
// axis. Defined here so the Projects tab and any later view agree on what a point is.
const SKILL_POINTS_PER_SCORE = 1 / 20;

// Grade bands for a completed project, from the real average score of its tasks.
const GRADE_BANDS = [
  { min: 90, letter: 'A' },
  { min: 80, letter: 'B' },
  { min: 70, letter: 'C' },
  { min: 60, letter: 'D' },
  { min: 0, letter: 'E' },
];

// The five axes the Skill Matrix (Overview tab) reports on. A task only ever moves the
// axes it actually exercises — da-001 is a SQL task, so python/dataViz genuinely stay at
// 0 until a task exists that touches them. No axis is ever synthesized.
const SKILL_AXES = ['sql', 'python', 'dataViz', 'communication', 'businessLogic'];
const SKILL_AXIS_LABEL = { sql: 'SQL', python: 'Python', dataViz: 'Data Viz', communication: 'Communication', businessLogic: 'Business Logic' };

// Self-paced product: a learner is never expected to sit here for a full workday.
// Two hours is the realistic daily pace, and it's what "how long is my open workload"
// estimates are measured against.
const HOURS_PER_DAY_TARGET = 2;

// Every graded submission and every learner-sent chat/email costs an AI call, so
// those — not the hours figure — are what actually drive cost. These are per-learner,
// per-day ceilings generous enough that nobody working normally will ever reach them,
// but low enough that a runaway loop or someone spamming the chat box can't run up a
// bill. Counted from existing rows (no extra table needed): see countTodaysAiUse.
// Six tasks a day is the intended pace, so a ceiling of exactly six left no headroom:
// one parked task resubmitted and the learner was locked out until tomorrow. Eight gives
// two retries a day, which is enough to recover from a bad morning and still far below
// anything that could run up a bill.
// Eight was right when a day was one or two graded pieces of work. A day is now six tasks,
// and Asha can send any of them back to be done again — so a learner having a bad Wednesday
// could hit the ceiling doing exactly what the product asked of them, which is the worst
// possible moment to be told to come back tomorrow. Twelve leaves room for six tasks and
// half a day of rework, and is still far below anything that could run up a bill.
const DAILY_AI_LIMITS = { submissions: 12, messages: 20 };

// A grade at or above this is treated as genuinely good work — the threshold for
// Asha's feedback being surfaced as a shoutout rather than just routine feedback.
const SHOUTOUT_SCORE = 80;

const CHECKLIST_ITEMS = {
  data_analyst: [
    { key: 'daily-quiz-ethics', label: 'Daily quiz: Data ethics' },
    { key: 'review-project-docs', label: 'Review project docs' },
    { key: 'set-up-profile', label: 'Set up your workspace profile' },
  ],
};

const LEARNING_PATH = {
  data_analyst: [
    { title: 'Advanced SQL: Window Functions', note: 'RANK, LAG/LEAD and running totals — the next step up from GROUP BY.' },
    { title: 'Reading a P&L like an analyst', note: 'The vocabulary Vikram and other stakeholders assume you already know.' },
    { title: 'Writing findings a stakeholder will actually read', note: 'Structuring a short written recommendation, not just a query result.' },
  ],
};

// Real, currently-trackable milestone requirements only — no fabricated "Level 3 in
// Python" style claims for skills we have no tasks to actually assess yet.
// The certificate milestone. This used to name a target ROLE ("Associate Data Analyst"),
// which now contradicts the promotion track sitting beside it on the same page — a
// learner promoted to Senior was still being told to work towards Associate. They are
// different things and should read as different things: promotion is the job you hold,
// the milestone is the credential you can take away.
const MILESTONE = {
  data_analyst: {
    targetRole: 'Certificate of Simulated Experience',
    requirements: [
      { key: 'tasks', label: 'Complete 5 graded tasks', target: 5, metric: 'tasksCompleted' },
      { key: 'attendance', label: 'Reach 66 attendance days', target: 66, metric: 'attendedDays' },
    ],
  },
};

// The practice dataset every Data Analyst task runs against. Rebuilt fresh, in memory,
// for every single query execution — a learner's SELECT can never persist a change or
// see anything outside this table.
// The task library. Every task names the dataset it is graded against, so a learner's
// query and the reference query always run over the same tables — see lib/datasets.js
// for why that determinism is what makes grading possible at all.
//
// `estHours` is what the task actually takes a learner, in hours — so most are fractions.
// They used to be whole hours, written when a project was a single task and the number was
// decorative. Six tasks a day against a two-hour daily target means a task is twenty
// minutes, and a day that adds up to eighteen hours is a promise the product cannot keep.
//
// `brief` deliberately does NOT list the columns any more: the Schema Browser in the
// workbench shows them live, which means the brief can never drift out of date with
// the data, and reading a schema is itself part of the job.
const TASKS = {
  'da-001': {
    title: 'Department salary breakdown',
    // What a colleague who knows you would point at — the trap, never the answer.
    hint: "The employees table still has people who've left in it. exit_year is NULL for anyone current — that filter is the whole difference between a right and a wrong number here.",
    brief: "Vikram (Business Stakeholder) wants to know which department is paying the most, on average, and by how much it leads the next one. Write ONE SQL SELECT query returning each department's NAME and its average salary, highest first. Two things to get right: department names live in `departments`, not `employees`, and the employees table still holds people who have left (exit_year is set) — leadership is asking about current staff.",
    referenceSql: 'SELECT d.name AS department, AVG(e.salary) AS avg_salary FROM employees e JOIN departments d ON d.id = e.department_id WHERE e.exit_year IS NULL GROUP BY d.name ORDER BY avg_salary DESC',
    datasetKey: 'hr_core',
    tool: 'sql',
    estHours: 0.4,
    priority: 'high',
    dueInDays: 2,
    // Opens on working day 1 of the project week.
    day: 1,
    difficulty: 'medium',
  },
  'da-002': {
    title: 'Hiring trend by year',
    // What a colleague who knows you would point at — the trap, never the answer.
    hint: "Careful — this one is about intake, not headcount. Someone hired in 2019 who has since left was still a 2019 hire.",
    brief: "Asha wants to see how hiring has moved year on year for next year's plan. Write ONE SQL SELECT query returning, for each hire_year, how many people were hired and their average salary, oldest year first. Someone hired in 2019 who has since left was still a 2019 hire — this question is about intake, not current headcount.",
    referenceSql: 'SELECT hire_year, COUNT(*) AS headcount, AVG(salary) AS avg_salary FROM employees GROUP BY hire_year ORDER BY hire_year',
    datasetKey: 'hr_core',
    tool: 'sql',
    estHours: 0.3,
    priority: 'medium',
    dueInDays: 3,
    // Opens on working day 1 of the project week.
    day: 1,
    difficulty: 'easy',
  },
  'da-003': {
    title: 'Pay spread by role',
    // What a colleague who knows you would point at — the trap, never the answer.
    hint: "Spread is just MAX minus MIN. The bit people miss is filtering to current staff before they group.",
    brief: "Vikram is checking whether people doing the same job are paid consistently. Write ONE SQL SELECT query returning, for each role, the lowest, highest and average salary plus the gap between highest and lowest, widest gap first. Current employees only — a leaver's old salary is not evidence about today's pay.",
    referenceSql: 'SELECT role, MIN(salary) AS min_salary, MAX(salary) AS max_salary, AVG(salary) AS avg_salary, MAX(salary) - MIN(salary) AS spread FROM employees WHERE exit_year IS NULL GROUP BY role ORDER BY spread DESC',
    datasetKey: 'hr_core',
    tool: 'sql',
    estHours: 0.4,
    priority: 'high',
    dueInDays: 4,
    // Opens on working day 1 of the project week.
    day: 1,
    difficulty: 'hard',
  },
  'da-004': {
    title: 'Outage impact by client',
    // What a colleague who knows you would point at — the trap, never the answer.
    hint: "Rank by what the damage costs, not by how big it looks. And one of those accounts has already churned.",
    brief: "Customer Success has to decide who gets compensated after the billing-sync outage, and they need the damage quantified first. Write ONE SQL SELECT query listing each AFFECTED, STILL-ACTIVE client with their tier, monthly recurring revenue, how many incidents hit them and the total rows corrupted — ordered so the accounts putting the most recurring revenue at risk come first. One account has already churned; recommending a retention package for them would be an error.",
    referenceSql: "SELECT c.company, c.tier, c.mrr, COUNT(i.id) AS incidents, SUM(i.rows_corrupted) AS rows_corrupted FROM clients c JOIN incidents i ON i.client_id = c.id WHERE c.status = 'active' GROUP BY c.company, c.tier, c.mrr ORDER BY c.mrr DESC",
    datasetKey: 'saas_ops',
    tool: 'sql',
    estHours: 0.6,
    priority: 'high',
    dueInDays: 5,
    // Opens on working day 1 of the project week.
    day: 1,
    difficulty: 'hard',
  },
  // ---- Day 1, in full ----------------------------------------------------------------
  //
  // A learner who finishes one query in ten minutes and then has nothing to do for the
  // rest of the day has not had a day at work. This is what the first day of the
  // compensation review actually looks like: scope it, look at the data, do the analysis,
  // check a colleague's work, decide what you can honestly claim, then write to the
  // stakeholder. Six tasks, about 85 minutes, and only two of them are queries.
  'da-100': {
    title: 'Scope the request',
    // What a colleague who knows you would point at — the trap, never the answer.
    hint: "Read what he asked for twice. There are two deliverables in that email, not one — the second is easy to read straight past.",
    brief: "Before you write any SQL: read Vikram's email again and work out what he is actually asking for. Tick everything that is genuinely part of this request. Getting this wrong costs a day, because you find out at the end.",
    tool: 'choice',
    datasetKey: 'hr_core',
    choice: {
      prompt: 'Which of these are part of what Vikram asked for?',
      exhibit: {
        kind: 'email',
        from: 'Vikram Nair, Business Stakeholder',
        subject: 'Department salary numbers — need by Thursday',
        body: "Hi — following up on the department pay numbers Asha mentioned. I need to know which function is paying the most on average and by how much it leads the next one, for the leadership review on Thursday. This is about what we're paying people now, not historically. Let me know if anything's unclear about what I'm after.",
      },
      options: [
        { key: 'avg', correct: true, label: 'Average salary for each department', why: 'He asked which function is paying the most on average — this is the core of it.' },
        { key: 'gap', correct: true, label: 'The gap between the top department and the next one', why: '"By how much it leads the next one" is a second, separate number. It is easy to read past and it is half the request.' },
        { key: 'current', correct: true, label: 'Current employees only', why: '"What we\'re paying people now, not historically" rules out anyone who has left.' },
        { key: 'individuals', correct: false, label: 'A list of the highest-paid individuals', why: 'He asked about departments. Individual salaries are a different question, and circulating them would be a real problem.' },
        { key: 'trend', correct: false, label: 'How pay has changed over the last three years', why: 'Explicitly not what he asked — he said now, not historically. Answering a bigger question than the one asked is how deadlines get missed.' },
        { key: 'benchmark', correct: false, label: 'How our pay compares to the market', why: 'There is no market data in this dataset. Promising it would be a commitment you cannot keep.' },
      ],
      skills: { businessLogic: 100, communication: 80 },
      whyRight: 'You read what was asked rather than what would be interesting, and you spotted that "by how much it leads" is a second deliverable.',
    },
    estHours: 0.1,
    priority: 'high',
    dueInDays: 1,
    day: 1,
    difficulty: 'easy',
  },

  'da-101': {
    title: 'Get your bearings in the data',
    // What a colleague who knows you would point at — the trap, never the answer.
    hint: "Two subqueries in one SELECT is the tidy way to get two unrelated counts in a single row.",
    brief: "Before the real query, check what you are working with. Write ONE SQL SELECT that returns how many CURRENT employees there are and how many departments — two numbers, one row. This takes two minutes and it is the difference between spotting a problem now and spotting it in front of leadership.",
    referenceSql: 'SELECT (SELECT COUNT(*) FROM employees WHERE exit_year IS NULL) AS current_employees, (SELECT COUNT(*) FROM departments) AS departments',
    datasetKey: 'hr_core',
    tool: 'sql',
    estHours: 0.15,
    priority: 'medium',
    dueInDays: 1,
    day: 1,
    difficulty: 'easy',
  },

  'da-102': {
    title: "Review Rahul's query",
    // What a colleague who knows you would point at — the trap, never the answer.
    hint: "Look hard at the WHERE clause. There's a comparison in there that matches nothing at all rather than erroring.",
    brief: "Rahul on the data engineering side sent over a query he wrote for the same question, to save you time. Read it properly before you use it. Flag what is actually wrong — and only what is actually wrong. Flagging everything is not review, it is noise, and it is scored as such here.",
    tool: 'choice',
    datasetKey: 'hr_core',
    choice: {
      prompt: "What is wrong with this query? Tick only the real problems.",
      exhibit: {
        kind: 'sql',
        from: 'Rahul Verma, Data Engineer',
        body: "SELECT e.department_id, AVG(e.salary) AS avg_salary\nFROM employees e\nWHERE e.exit_year = NULL\nGROUP BY e.department_id\nORDER BY avg_salary DESC",
      },
      options: [
        { key: 'nullcmp', correct: true, label: '`exit_year = NULL` will not match anything', why: 'NULL is never equal to anything, so this returns zero rows. It is the single most common SQL mistake and it fails silently — no error, just an empty result.' },
        { key: 'deptname', correct: true, label: 'It returns department_id, not the department name', why: 'Vikram is not going to read "department 4". The names live in the departments table, which means a JOIN.' },
        { key: 'gap', correct: true, label: 'It does not give the gap to the next department', why: 'Half the request. The query answers "who is highest" but not "by how much".' },
        { key: 'orderby', correct: false, label: 'You cannot ORDER BY an alias', why: 'You can in SQLite — ORDER BY sees the select list. This one is fine.' },
        { key: 'groupby', correct: false, label: 'GROUP BY is on the wrong column', why: 'Grouping by department is exactly right for a per-department average.' },
        { key: 'avg', correct: false, label: 'AVG is the wrong function here', why: 'He asked for the average. AVG is the right tool; whether an average is the right STATISTIC is a fair question, but it is not an error in the query.' },
      ],
      skills: { sql: 100, businessLogic: 90 },
      whyRight: 'You found the silent one. `= NULL` returning nothing is the failure that reaches production, because it looks like a working query.',
    },
    estHours: 0.25,
    priority: 'high',
    dueInDays: 1,
    day: 1,
    difficulty: 'medium',
  },

  'da-103': {
    title: 'What can you actually claim?',
    // What a colleague who knows you would point at — the trap, never the answer.
    hint: "Ask yourself what each statement would need as evidence. Most of them need a comparison the analysis never made.",
    brief: "You have your numbers. Before they go anywhere: which of these statements does your result genuinely support? This is the difference between an analyst leadership trusts and one they stop inviting.",
    tool: 'choice',
    datasetKey: 'hr_core',
    choice: {
      prompt: 'Your analysis shows Engineering has the highest average salary and Support the lowest. Which statements does that support?',
      options: [
        { key: 'highest', correct: true, label: 'Engineering has the highest average salary of any department', why: 'This is a restatement of what you measured. It is safe because it claims nothing beyond the number.' },
        { key: 'gapfact', correct: true, label: 'The gap between the top two departments is [X]', why: 'Also directly measured, and it is the second half of what Vikram asked for.' },
        { key: 'underpaid', correct: false, label: 'Support is underpaid', why: '"Underpaid" is a comparison against something — market rate, internal bands, peers in the same role. You have not measured any of those. This is the claim that gets an analysis thrown out in the meeting.' },
        { key: 'valuable', correct: false, label: 'Engineering is the most valuable function', why: 'Pay is what we spend, not what we get back. Nothing here measures value.' },
        { key: 'raise', correct: false, label: 'Support needs a pay rise', why: 'A recommendation, not a finding. It might be right, but your data does not establish it — seniority mix alone could explain the whole gap.' },
        { key: 'seniority', correct: false, label: 'Engineering staff are more senior on average', why: 'Plausible, and it might even be why the gap exists — but you have not looked at seniority. Do not assert the explanation you happen to believe.' },
      ],
      skills: { businessLogic: 100, communication: 90 },
      whyRight: 'You separated what you measured from what you suspect. Most of the wrong answers here are things that might well be true — the point is that this analysis does not show them.',
    },
    estHours: 0.2,
    priority: 'high',
    dueInDays: 1,
    day: 1,
    difficulty: 'medium',
  },

  'da-104': {
    title: 'Write to Vikram',
    // What a colleague who knows you would point at — the trap, never the answer.
    hint: "Lead with the answer, not the method. He decides whether to keep reading in your first line.",
    brief: "Send Vikram the answer. He is a business stakeholder preparing for a leadership review, not an analyst — he wants the number and what it means, not your method. Keep it under 120 words. Lead with the answer: he decides whether to keep reading in the first line.",
    tool: 'writeup',
    datasetKey: 'hr_core',
    writeup: {
      to: 'Vikram Nair, Business Stakeholder',
      subject: 'Re: Department salary numbers',
      prompt: 'Write the email. Under 120 words.',
      maxWords: 120,
      exhibit: {
        kind: 'table',
        from: 'Your result',
        body: 'Engineering    2,391,000\nFinance        1,893,000\nSales          1,704,000\nPeople Ops     1,497,000\nMarketing      1,168,000\nSupport          855,000',
      },
      rubric: [
        { key: 'answer', label: 'The answer, in the first line', markers: ['engineering'], why: 'He asked which department pays most. Name it before anything else — a busy reader decides in the first sentence whether to keep going.' },
        { key: 'gap', label: 'The gap to the next department', markers: ['gap|ahead|lead|next|finance|ahead of|more than'], why: 'He asked for this explicitly. Leaving it out means he has to come back and ask, which costs you a day and some credibility.' },
        { key: 'scope', label: 'What the number covers', markers: ["current|still (?:here|employed|with us)|leaver|excluded|people who (?:have )?left"], why: 'You excluded leavers. Saying so briefly protects you if anyone reconciles your figure against headcount — and it shows you thought about it.' },
        { key: 'next', label: 'What happens next, or what you need', markers: ['let me know|happy to|if you|any questions|shout|before thursday|ahead of|next step|come back'], why: 'End with a handle. An email that just stops leaves the reader to work out whether anything is expected of them.' },
      ],
      whyRight: 'Answer first, the second number he asked for, an honest word about scope, and a clear ending. That is the whole job of this email.',
    },
    estHours: 0.35,
    priority: 'high',
    dueInDays: 1,
    day: 1,
    difficulty: 'medium',
  },

  // ---- Day 2: the requirement changes --------------------------------------------------
  //
  // A stakeholder changing the question mid-week is a non-negotiable design point of the
  // character architecture, and it is the whole shape of this day. Vikram comes back
  // asking "is Support underpaid?" — a question the averages from day one cannot answer,
  // but the salary bands can. The payoff is that the honest answer contradicts the
  // obvious one: Support has the lowest average, but MARKETING sits lowest in its own
  // band. A learner who reasons from day one's chart gets it wrong.
  'da-110': {
    title: "Vikram changes the question",
    // What a colleague who knows you would point at — the trap, never the answer.
    hint: "Split what he asked into things the data can answer and things it can't. 'Underpaid' compared to what, exactly?",
    brief: "Vikram has read your numbers and come back with a follow-up. Read it carefully: some of what he is now asking is a different question from the one you answered yesterday, and some of it he cannot have. Tick what is genuinely answerable from the data you have.",
    tool: 'choice',
    datasetKey: 'hr_core',
    choice: {
      prompt: 'What can you actually answer from this request?',
      exhibit: {
        kind: 'email',
        from: 'Vikram Nair, Business Stakeholder',
        subject: 'Re: Department salary numbers',
        body: "Thanks — this is useful. Leadership's follow-up: Support is miles below everyone else. Are they underpaid? And if so are we at risk of losing them? I'd like something on this for the same review.",
      },
      options: [
        { key: 'band', correct: true, label: 'Where each department sits within its own salary band', why: 'Every department has a band_low and band_high. Position within the band is the closest thing in this data to a defensible reading of "underpaid".' },
        { key: 'compare', correct: true, label: 'Whether Support is lower in its band than other departments are in theirs', why: 'This is the comparison that actually answers his question, and it is the one that changes the answer.' },
        { key: 'leavers', correct: true, label: 'How many people have left each department', why: 'exit_year gives you this. It is weak evidence for attrition risk, but it is real evidence and it is the only thing here that speaks to his second question.' },
        { key: 'market', correct: false, label: 'Whether Support is paid below the market rate', why: 'There is no market data anywhere in this dataset. This is the reading of "underpaid" he probably means, and you cannot give it to him — saying so is part of the job.' },
        { key: 'risk', correct: false, label: 'Whether Support staff are about to resign', why: 'Nothing here measures intent. Past leavers are not a forecast, and presenting them as one would be the kind of overclaim that gets an analysis thrown out.' },
        { key: 'satisfaction', correct: false, label: 'Whether Support staff are unhappy with their pay', why: 'No survey data exists. Inferring feelings from salary figures is not analysis.' },
      ],
      skills: { businessLogic: 100, communication: 85 },
      whyRight: 'You separated the parts of his question the data can answer from the parts it cannot — and noticed that "underpaid" needs a comparison he did not specify.',
    },
    estHours: 0.15,
    priority: 'high',
    dueInDays: 2,
    day: 2,
    difficulty: 'medium',
  },

  'da-111': {
    title: 'Pay against the band',
    // What a colleague who knows you would point at — the trap, never the answer.
    hint: "The band columns live on departments, not employees, so you'll need them in the GROUP BY too. And use 100.0, not 100, or the division goes to integers.",
    brief: "Every department has a salary band — a floor and a ceiling that HR set for it. Write ONE SQL SELECT returning, for each department, its average salary for current staff, its band floor and ceiling, and where that average sits inside the band as a percentage. Lowest position first. This is the number that answers Vikram's question, and it is not the same ranking as yesterday's.",
    referenceSql: 'SELECT d.name AS department, AVG(e.salary) AS avg_salary, d.band_low, d.band_high, (AVG(e.salary) - d.band_low) * 100.0 / (d.band_high - d.band_low) AS band_position FROM employees e JOIN departments d ON d.id = e.department_id WHERE e.exit_year IS NULL GROUP BY d.name, d.band_low, d.band_high ORDER BY band_position ASC',
    datasetKey: 'hr_core',
    tool: 'sql',
    estHours: 0.4,
    priority: 'high',
    dueInDays: 2,
    day: 2,
    difficulty: 'hard',
  },

  'da-112': {
    title: 'The answer changed',
    // What a colleague who knows you would point at — the trap, never the answer.
    hint: "Two measures disagreeing isn't an error to resolve. Ask which question each one answers.",
    brief: "Look at what you just produced next to yesterday's ranking. Support has the lowest average salary in the company — but it is not the department sitting lowest in its own band. Marketing is. Which of these does that support?",
    tool: 'choice',
    datasetKey: 'hr_core',
    choice: {
      prompt: 'Support has the lowest average pay. Marketing sits lowest in its own band. What follows?',
      options: [
        { key: 'diff', correct: true, label: 'The two measures answer different questions and disagree here', why: 'Absolute pay and position-in-band are not the same thing. When two defensible measures disagree, that disagreement is the finding.' },
        { key: 'marketing', correct: true, label: 'On the band measure, Marketing has the stronger case for being underpaid', why: 'Marketing sits at 37% of its band against Support at 47% — relative to what the company itself decided the role is worth, Marketing is further down.' },
        { key: 'bandlow', correct: true, label: "Support's low average is partly explained by Support having a lower band", why: 'The band floor and ceiling are set per department. A low average inside a low band is a different situation from a low average inside a high band.' },
        { key: 'fine', correct: false, label: 'Support is therefore paid fairly', why: 'Sitting mid-band says the department is paid consistently with its own band. Whether the BAND is right is a question this data cannot touch.' },
        { key: 'wrong', correct: false, label: "Yesterday's analysis was wrong", why: 'It was not wrong. It answered the question that was asked — which department pays most on average. A different question has a different answer.' },
        { key: 'raise', correct: false, label: 'Marketing should get a pay rise', why: 'A recommendation, not a finding. It might be the right call, but the data establishes a position in a band, not what to do about it.' },
      ],
      skills: { businessLogic: 100, dataViz: 70 },
      whyRight: 'You held both numbers at once without deciding one of them must be a mistake. Two measures disagreeing is information, not an error to resolve.',
    },
    estHours: 0.2,
    priority: 'high',
    dueInDays: 2,
    day: 2,
    difficulty: 'hard',
  },

  'da-113': {
    title: 'Who has been leaving',
    // What a colleague who knows you would point at — the trap, never the answer.
    hint: "SUM with a CASE inside it gets you both counts in one pass — no need for two queries.",
    brief: "Vikram also asked about attrition risk. Write ONE SQL SELECT returning, for each department, how many people have LEFT and how many are still there. Most leavers first. Be honest with yourself about what this can and cannot tell him — you will be asked.",
    referenceSql: "SELECT d.name AS department, SUM(CASE WHEN e.exit_year IS NOT NULL THEN 1 ELSE 0 END) AS leavers, SUM(CASE WHEN e.exit_year IS NULL THEN 1 ELSE 0 END) AS current_staff FROM employees e JOIN departments d ON d.id = e.department_id GROUP BY d.name ORDER BY leavers DESC",
    datasetKey: 'hr_core',
    tool: 'sql',
    estHours: 0.3,
    priority: 'medium',
    dueInDays: 3,
    day: 2,
    difficulty: 'medium',
  },


  // ---- Day 3: the wobble ---------------------------------------------------------------
  // Vikram has asked for a regional split. The data supports it and the answer is still no,
  // which is a harder thing to say than "we do not have that column".

  'da-120': {
    title: 'Can we even do the regional split?',
    hint: "Do not answer from memory. Run it, look at how many people land in each cell, then decide.",
    brief: "Vikram wants the pay analysis split by office location. Before you answer him, find out what that would actually look like. Write ONE SQL SELECT returning, for each department and location, the number of CURRENT employees and their average salary. Smallest groups first.",
    referenceSql: "SELECT d.name AS department, e.location, COUNT(*) AS headcount, AVG(e.salary) AS avg_salary FROM employees e JOIN departments d ON d.id = e.department_id WHERE e.exit_year IS NULL GROUP BY d.name, e.location ORDER BY headcount ASC",
    datasetKey: 'hr_core', tool: 'sql', estHours: 0.4, priority: 'high', dueInDays: 3, day: 3, difficulty: 'medium',
  },

  'da-121': {
    title: 'What that result means for Vikram',
    hint: "Look at the headcounts you just produced, then reread Monday's note about groups under five.",
    brief: "You have the department-by-location grid in front of you. Neha's data-handling note on Monday said a group under five people is identifying. Which of these does your result support?",
    tool: 'choice', datasetKey: 'hr_core',
    choice: {
      prompt: 'Tick everything your own result supports.',
      options: [
        { key: 'possible', correct: true, label: 'The split is technically possible — the location data is there', why: 'It is. That is what makes this hard: the easy answer of "we cannot" is not available to you.' },
        { key: 'tiny', correct: true, label: 'Almost every department-by-location group has fewer than five people in it', why: 'Twenty-five of the twenty-six. Several have one person in them.' },
        { key: 'identify', correct: true, label: 'Publishing it at that grain would effectively publish individual salaries', why: 'An average over two people, next to a department and a city, is two salaries. That is the thing Monday\'s note told you not to do.' },
        { key: 'nodata', correct: false, label: 'We do not hold location data, so the request cannot be met', why: 'We do hold it. Telling a stakeholder something does not exist when it does is a lie with a very short shelf life — it lasts until someone opens the table.' },
        { key: 'grey', correct: false, label: 'It would be fine if the small groups were greyed out', why: 'Shading a number does not un-publish it. The value is still on the page.' },
        { key: 'refuse', correct: false, label: 'Location is never a legitimate cut of pay data', why: 'It often is — at a grain where the groups are big enough. The problem here is the size, not the dimension.' },
      ],
      skills: { businessLogic: 100, communication: 60 },
    },
    estHours: 0.25, priority: 'high', dueInDays: 3, day: 3, difficulty: 'hard',
  },

  'da-122': {
    title: 'A cut that is actually safe',
    hint: "One dimension instead of two. Check the counts come out big enough to stand behind.",
    brief: "Give Vikram something usable instead. Write ONE SQL SELECT returning, for each LOCATION on its own, the current headcount and average salary, largest headcount first. Ignore department entirely — that is the point.",
    referenceSql: "SELECT location, COUNT(*) AS headcount, AVG(salary) AS avg_salary FROM employees WHERE exit_year IS NULL GROUP BY location ORDER BY headcount DESC",
    datasetKey: 'hr_core', tool: 'sql', estHours: 0.35, priority: 'normal', dueInDays: 3, day: 3, difficulty: 'medium',
  },

  'da-123': {
    title: "Check Diya's reconciliation",
    hint: "Read the WHERE clause, then read what she says the query is for. They are not the same thing.",
    brief: "Diya from Finance sent the query behind her Engineering figure, the one that disagreed with yours. She says it shows 'what we currently pay Engineering'. Tick every problem with it.",
    tool: 'choice', datasetKey: 'hr_core',
    choice: {
      exhibit: {
        kind: 'sql', from: 'Diya Chandra', subject: 'my engineering number',
        body: "SELECT AVG(salary) AS avg_salary\nFROM employees e\nJOIN departments d ON d.id = e.department_id\nWHERE d.name = 'Engineering'",
      },
      prompt: 'What is wrong with this, given what she says it shows?',
      options: [
        { key: 'leavers', correct: true, label: 'It includes people who have left, so it is not what we CURRENTLY pay', why: 'No exit_year filter. Two Engineering leavers are in that average. Her query is defensible for cost; her description of it is not.' },
        { key: 'nocount', correct: true, label: 'There is no headcount alongside it, so nobody can judge the average', why: 'Rahul\'s point on Tuesday. An average without its n is a number you cannot argue with or against.' },
        { key: 'join', correct: false, label: 'The join is wrong', why: 'It is correct — d.id to e.department_id is exactly right.' },
        { key: 'groupby', correct: false, label: 'It is missing a GROUP BY', why: 'It does not need one. She filters to a single department and aggregates the whole thing, which is valid.' },
        { key: 'avg', correct: false, label: 'AVG is the wrong function', why: 'For "what do we pay on average", AVG is the right tool. Whether an average is the right STATISTIC is a fair question, but it is not an error in the query.' },
      ],
      skills: { sql: 100, businessLogic: 80 },
    },
    estHours: 0.3, priority: 'normal', dueInDays: 3, day: 3, difficulty: 'medium',
  },

  'da-124': {
    title: 'Both numbers, side by side',
    hint: "Two aggregates over the same table, split by whether exit_year is NULL. A CASE inside the AVG does it in one pass.",
    brief: "Settle it with data rather than argument. Write ONE SQL SELECT returning, for each department, the average salary of CURRENT staff and the average salary of EVERYONE ever employed there, plus both headcounts. Order by department name.",
    referenceSql: "SELECT d.name AS department, AVG(CASE WHEN e.exit_year IS NULL THEN e.salary END) AS current_avg, SUM(CASE WHEN e.exit_year IS NULL THEN 1 ELSE 0 END) AS current_headcount, AVG(e.salary) AS all_time_avg, COUNT(*) AS all_time_headcount FROM employees e JOIN departments d ON d.id = e.department_id GROUP BY d.name ORDER BY d.name",
    datasetKey: 'hr_core', tool: 'sql', estHours: 0.5, priority: 'high', dueInDays: 3, day: 3, difficulty: 'hard',
  },

  'da-125': {
    title: 'Write back to Vikram about the split',
    hint: "Lead with whether he is getting it. The reason comes second, and it is about people, not about columns.",
    brief: "Reply to Vikram's request for a regional breakdown. He is a stakeholder, not an analyst — he does not care about GROUP BY, he cares whether he can put a number on a slide.",
    tool: 'writeup', datasetKey: 'hr_core',
    writeup: {
      to: 'Vikram Nair', subject: 'Re: One more thing on the comp review', maxWords: 140,
      prompt: 'Tell him where the regional split stands.',
      rubric: [
        { key: 'answer', label: 'Whether he is getting it, in the first line', markers: ['not|cannot|can\'t|unable|afraid|won\'t be'], why: 'He needs to know inside one sentence whether to plan around it.' },
        { key: 'why', label: 'The real reason — group sizes, not missing data', markers: ['small|few|five|handful|one or two|individual|identif'], why: 'Saying "we do not have it" would be untrue and he would find out. The honest reason is that the groups are too small to publish without exposing individuals.' },
        { key: 'instead', label: 'What he CAN have', markers: ['location|city|overall|company|department|instead|can give|happy to'], why: 'A no with nothing attached is not an answer a stakeholder can use. Location on its own is safe.' },
        { key: 'next', label: 'A handle for what happens now', markers: ['let me know|if you|happy to|shout|before|friday|come back|would that'], why: 'End with something he can respond to.' },
      ],
    },
    estHours: 0.35, priority: 'high', dueInDays: 3, day: 3, difficulty: 'hard',
  },

  // ---- Day 4: consolidate, and check other people's work -------------------------------

  'da-130': {
    title: 'Who is furthest from their ceiling',
    hint: "Distance to the top of the band, not position within it. Different question, different ORDER BY.",
    brief: "Vikram asked a follow-up: which departments have the most headroom left in their band. Write ONE SQL SELECT returning, per department, current average salary, the band ceiling, and the gap between them in rupees. Biggest gap first.",
    referenceSql: "SELECT d.name AS department, AVG(e.salary) AS avg_salary, d.band_high, d.band_high - AVG(e.salary) AS headroom FROM employees e JOIN departments d ON d.id = e.department_id WHERE e.exit_year IS NULL GROUP BY d.name, d.band_high ORDER BY headroom DESC",
    datasetKey: 'hr_core', tool: 'sql', estHours: 0.35, priority: 'normal', dueInDays: 4, day: 4, difficulty: 'medium',
  },

  'da-131': {
    title: 'Seniority, or pay?',
    hint: "You need role and department together. Watch which departments end up with one person per role.",
    brief: "Asha wants to know whether the Marketing gap is a pay story or a seniority story. Write ONE SQL SELECT returning, for each department and role, the current headcount and average salary. Department then role.",
    referenceSql: "SELECT d.name AS department, e.role, COUNT(*) AS headcount, AVG(e.salary) AS avg_salary FROM employees e JOIN departments d ON d.id = e.department_id WHERE e.exit_year IS NULL GROUP BY d.name, e.role ORDER BY d.name, e.role",
    datasetKey: 'hr_core', tool: 'sql', estHours: 0.45, priority: 'high', dueInDays: 4, day: 4, difficulty: 'hard',
  },

  'da-132': {
    title: 'What the role breakdown does and does not tell you',
    hint: "You measured pay by role. You did not measure whether the role MIX differs, which is the actual question.",
    brief: "Look at what you just produced. Asha asked whether Marketing's low band position is about pay levels or about who works there. Which claims does your result support?",
    tool: 'choice', datasetKey: 'hr_core',
    choice: {
      prompt: 'Tick every claim your result actually supports.',
      options: [
        { key: 'mix', correct: true, label: 'You can now see how many people sit in each role in each department', why: 'That is exactly what the headcount column gives you, and it is the raw material for the seniority question.' },
        { key: 'within', correct: true, label: 'You can compare pay for the same role across departments', why: 'A Marketing Manager and a Support Manager are now side by side, which is a fair comparison in a way that department averages are not.' },
        { key: 'smallcells', correct: true, label: 'Several department-and-role groups are too small to draw conclusions from', why: 'Same trap as Wednesday, one dimension down. Some roles have a single person in them.' },
        { key: 'proven', correct: false, label: 'It proves the gap is caused by seniority mix', why: 'It is consistent with that. Proving it needs you to hold role constant and compare, which is the next step, not this one.' },
        { key: 'underpaid', correct: false, label: 'It shows Marketing staff are paid below their peers elsewhere', why: 'Only if you actually compared like roles and they came out lower. The table alone does not say this.' },
        { key: 'promote', correct: false, label: 'It shows Marketing needs more senior roles', why: 'That is a recommendation about what the org should look like. Nothing here measures what the work requires.' },
      ],
      skills: { businessLogic: 100 },
    },
    estHours: 0.25, priority: 'high', dueInDays: 4, day: 4, difficulty: 'hard',
  },

  'da-133': {
    title: 'A chart the board will read',
    hint: "Ranked comparison across categories, and the axis has to start at zero or the gaps lie.",
    brief: "Build the visual for the leadership pack: band position by department, so the comparison is obvious at a glance. Pick the chart type, the fields and the sort.",
    tool: 'chart', datasetKey: 'hr_core',
    chart: {
      sourceSql: "SELECT d.name AS department, (AVG(e.salary) - d.band_low) * 100.0 / (d.band_high - d.band_low) AS band_position FROM employees e JOIN departments d ON d.id = e.department_id WHERE e.exit_year IS NULL GROUP BY d.name, d.band_low, d.band_high ORDER BY band_position ASC",
      prompt: 'Band position by department, for a board pack.',
      answer: { type: 'bar', x: 'department', y: 'band_position', sort: 'asc', baselineZero: true },
      why: 'A ranked comparison across a handful of named categories is a bar chart. Sorted ascending it puts the department the board is asking about first, and a zero baseline is non-negotiable — truncating the axis on a percentage exaggerates every gap on the page.',
    },
    estHours: 0.3, priority: 'normal', dueInDays: 4, day: 4, difficulty: 'medium',
  },

  'da-134': {
    title: "Review Meera's summary line",
    hint: "The numbers are right. Read what the words claim on top of them.",
    brief: "Meera has drafted the opening line of the leadership summary. Tick every problem with it.",
    tool: 'choice', datasetKey: 'hr_core',
    choice: {
      exhibit: {
        kind: 'email', from: 'Meera Pillai', subject: 'Draft opening — comp review',
        body: "Marketing is our most underpaid function, sitting at just 37% of its salary band against a company average of 56%. We recommend an immediate correction in the April cycle to prevent attrition.",
      },
      prompt: 'What needs to change before this goes out?',
      options: [
        { key: 'underpaid', correct: true, label: '"Underpaid" claims a comparison we have not made', why: 'Position in band measures against bands WE set. Underpaid means against the market, and there is no market data anywhere in this analysis.' },
        { key: 'attrition', correct: true, label: '"Prevent attrition" asserts a cause and a consequence we have not measured', why: 'Nothing in this week\'s work measures why anyone leaves, or whether they are going to.' },
        { key: 'nocount', correct: true, label: 'It gives no sense that Marketing is nine people', why: 'Nine. A reader who assumes it is ninety will weight the finding very differently, and someone in the room will know.' },
        { key: 'figure', correct: false, label: 'The 37% figure is wrong', why: 'It is right. The number is not the problem — everything built on top of it is.' },
        { key: 'recommend', correct: false, label: 'Analysts should never make recommendations', why: 'They should. A recommendation the evidence supports is the most useful thing you produce. This one is not supported, which is different.' },
      ],
      skills: { communication: 100, businessLogic: 90 },
    },
    estHours: 0.3, priority: 'high', dueInDays: 4, day: 4, difficulty: 'hard',
  },

  'da-135': {
    title: 'Rewrite the opening line',
    hint: "Say what you measured, name the size, and let the recommendation follow from the evidence rather than lead it.",
    brief: "Rewrite Meera's opening so it says what the analysis actually supports. It still has to be something a board will read and act on — a paragraph of hedging is not an improvement.",
    tool: 'writeup', datasetKey: 'hr_core',
    writeup: {
      to: 'Meera Pillai', subject: 'Re: Draft opening — comp review', maxWords: 120,
      prompt: 'Your version of the opening.',
      rubric: [
        { key: 'measured', label: 'What was actually measured — position in our own bands', markers: ['band|position|floor|ceiling|range we set|our (own )?band'], why: 'Naming the measure stops a reader inventing a different one.' },
        { key: 'figure', label: 'The figure, and which department', markers: ['37|marketing'], why: 'The finding still has to be in there. Precision is not hedging.' },
        { key: 'size', label: 'How many people it rests on', markers: ['nine|9|small|headcount|people'], why: 'Nine people. A board weighting a finding needs to know that.' },
        { key: 'honest', label: 'No claim about market rate or attrition', markers: ['^(?!.*(underpaid|below market|attrition|will leave|resign)).*$'], why: 'Neither is supported. Leaving them out is the whole point of the rewrite.' },
      ],
    },
    estHours: 0.4, priority: 'high', dueInDays: 4, day: 4, difficulty: 'hard',
  },

  // ---- Day 5: deliver, with someone waiting --------------------------------------------
  // Friday is the hardest day, deliberately. The work is not harder SQL; it is being asked
  // to stand behind what you produced while someone pushes back on it.

  'da-140': {
    title: 'The number Finance will check',
    hint: "They will reconcile against total spend, so give them the total as well as the average.",
    brief: "Finance will reconcile your pack against their own figures. Write ONE SQL SELECT returning, per department, current headcount, average salary and TOTAL current salary cost, ordered by total cost descending.",
    referenceSql: "SELECT d.name AS department, COUNT(*) AS headcount, AVG(e.salary) AS avg_salary, SUM(e.salary) AS total_cost FROM employees e JOIN departments d ON d.id = e.department_id WHERE e.exit_year IS NULL GROUP BY d.name ORDER BY total_cost DESC",
    datasetKey: 'hr_core', tool: 'sql', estHours: 0.35, priority: 'high', dueInDays: 5, day: 5, difficulty: 'medium',
  },

  'da-141': {
    title: 'The one you will be asked about',
    hint: "Everything in one query: the position, the size, and the gap to the department above. This is the row the board will stop on.",
    brief: "Build the single table that answers the whole brief. Write ONE SQL SELECT returning, per department: current headcount, average salary, band floor and ceiling, and position in band as a percentage. Lowest position first. This is what goes in the pack.",
    referenceSql: "SELECT d.name AS department, COUNT(*) AS headcount, AVG(e.salary) AS avg_salary, d.band_low, d.band_high, (AVG(e.salary) - d.band_low) * 100.0 / (d.band_high - d.band_low) AS band_position FROM employees e JOIN departments d ON d.id = e.department_id WHERE e.exit_year IS NULL GROUP BY d.name, d.band_low, d.band_high ORDER BY band_position ASC",
    datasetKey: 'hr_core', tool: 'sql', estHours: 0.5, priority: 'high', dueInDays: 5, day: 5, difficulty: 'hard',
    rework: true,
  },

  'da-142': {
    title: 'Median or mean?',
    hint: "Think about which departments have one very senior person in a small group.",
    brief: "Asha asks, on the way into the room: should the pack use the mean or the median? Tick everything that is true.",
    tool: 'choice', datasetKey: 'hr_core',
    choice: {
      prompt: 'Which of these are true of choosing between mean and median here?',
      options: [
        { key: 'outlier', correct: true, label: 'In a small department, one senior salary pulls the mean noticeably', why: 'Finance is seven people. One Finance Manager moves that average in a way it would not move a department of sixty.' },
        { key: 'band', correct: true, label: 'Band position is built on whichever you choose, so the choice changes the headline', why: 'It is not a presentational detail. Swap the statistic and the ranking can change.' },
        { key: 'say', correct: true, label: 'Whichever you pick, the pack has to say which it is', why: 'A reader comparing to their own figure needs to know what they are comparing to.' },
        { key: 'always', correct: false, label: 'Median is always the right choice for salary', why: 'Usually better for "what does a typical person earn", but if the question is cost, the mean times headcount is what reconciles to the budget.' },
        { key: 'both', correct: false, label: 'Showing both is the safe answer', why: 'Two numbers for the same thing with no guidance pushes your decision onto the reader. Sometimes right; not a default.' },
        { key: 'nodiff', correct: false, label: 'With this few people it makes no difference', why: 'Exactly backwards. Small groups are where it makes the MOST difference.' },
      ],
      skills: { businessLogic: 100, dataViz: 40 },
    },
    estHours: 0.25, priority: 'high', dueInDays: 5, day: 5, difficulty: 'hard',
  },

  'da-143': {
    title: 'Median by department, in Python',
    hint: "SQLite has no median. Group the salaries yourself and take the middle — and remember the even-length case.",
    brief: "Produce the median version so Asha can see both before she decides. In the notebook, compute for each department: the MEDIAN salary of current staff and the headcount. Sort by median descending. Assign a list of dicts with keys department, median_salary, headcount to `result`.",
    tool: 'python', datasetKey: 'hr_core',
    estHours: 0.6, priority: 'high', dueInDays: 5, day: 5, difficulty: 'hard',
    referenceCompute: (tables) => {
      const dn = new Map(tables.departments.map((d) => [d.id, d.name]));
      const by = new Map();
      for (const e of tables.employees) {
        if (e.exit_year != null) continue;
        const n = dn.get(e.department_id);
        if (!by.has(n)) by.set(n, []);
        by.get(n).push(e.salary);
      }
      const median = (xs) => { const a = [...xs].sort((p, q) => p - q), m = Math.floor(a.length / 2); return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
      return [...by.entries()]
        .map(([department, v]) => ({ department, median_salary: median(v), headcount: v.length }))
        .sort((a, b) => b.median_salary - a.median_salary);
    },
  },

  'da-144': {
    title: 'Vikram pushes back',
    hint: "He is not asking you to change the number. He is asking you to say something you have not measured.",
    brief: "Ten minutes before the meeting, Vikram asks you directly. Tick every response that is defensible.",
    tool: 'choice', datasetKey: 'hr_core',
    choice: {
      exhibit: {
        kind: 'email', from: 'Vikram Nair', subject: 'Quick one before we go in',
        body: "I just need a yes or no from you and then I will stop asking. Are we underpaying Marketing? The board will ask me directly and I would rather not say 'it depends'.",
      },
      prompt: 'Which responses can you actually stand behind?',
      options: [
        { key: 'lowest', correct: true, label: '"They sit lowest in their band of any department — 37%, on nine people"', why: 'Measured, precise, and it carries the size. This is the true thing you can say fastest.' },
        { key: 'cannot', correct: true, label: '"I cannot answer underpaid without market data — I can tell you where they sit against our own bands"', why: 'Naming the boundary and immediately offering what you DO have is the difference between being cautious and being useless.' },
        { key: 'offer', correct: true, label: '"If the board needs a market comparison, we would need to buy benchmark data — I can scope that"', why: 'It turns a no into a next step, which is what a stakeholder can use in the room.' },
        { key: 'yes', correct: false, label: '"Yes."', why: 'You have not measured it. Saying yes because it is the answer he wants is how an analyst stops being trusted — and the first time it is wrong, publicly, is the last time.' },
        { key: 'no', correct: false, label: '"No."', why: 'Equally unsupported. Confidently wrong in the other direction is not more honest.' },
        { key: 'depends', correct: false, label: '"It depends."', why: 'True and useless. He told you he does not want it and he is right — it gives him nothing to say.' },
      ],
      skills: { communication: 100, businessLogic: 100 },
    },
    estHours: 0.3, priority: 'high', dueInDays: 5, day: 5, difficulty: 'hard',
  },

  'da-145': {
    title: 'The finding, to leadership',
    hint: "Answer in the first line. Size and scope right after. The recommendation last, and only what the evidence carries.",
    brief: "Write the summary that goes with the pack. This is the piece of work the whole week has been building to, and the only part most of the board will read.",
    tool: 'writeup', datasetKey: 'hr_core',
    writeup: {
      to: 'Vikram Nair and the leadership team', subject: 'Q1 Compensation Review — findings', maxWords: 200,
      prompt: 'The summary. Everything you can stand behind, nothing you cannot.',
      rubric: [
        { key: 'answer', label: 'The finding, in the first line', markers: ['marketing|37'], why: 'Most of the board reads one line. Make it the one that matters.' },
        { key: 'measure', label: 'What "lowest" is measured against', markers: ['band|floor|ceiling|range we set|our own'], why: 'Against our bands, not the market. Say so before someone assumes the other.' },
        { key: 'size', label: 'The headcount behind it', markers: ['nine|9|small|headcount|people'], why: 'Nine people. A finding that hides its own sample size gets taken apart in the room.' },
        { key: 'scope', label: 'Who is included — current staff', markers: ['current|still (here|with us|employed)|excl|leaver|left'], why: 'Finance has a different number because they include leavers. Naming your population is what stops that becoming an argument.' },
        { key: 'limit', label: 'One thing this does NOT tell them', markers: ['market|benchmark|cannot|can\'t|does not|doesn\'t|no data|outside'], why: 'Volunteering the limit before you are asked is what makes the rest of it credible.' },
        { key: 'next', label: 'What you want them to do', markers: ['recommend|suggest|propose|next|would|scope|benchmark|review'], why: 'End with the decision you want, or the analysis just sits there.' },
      ],
    },
    estHours: 0.6, priority: 'high', dueInDays: 5, day: 5, difficulty: 'hard',
  },

  'da-114': {
    title: 'Tell Vikram the answer is not the obvious one',
    // What a colleague who knows you would point at — the trap, never the answer.
    hint: "Say the thing he didn't ask about. The interesting finding isn't in the department he named.",
    brief: "Write back to Vikram. The hard part is not the number — it is that his premise was reasonable and the data does not support it. Say what you found, name the department that actually has the strongest case, and be straight that market rate is not something you can give him. Under 140 words.",
    tool: 'writeup',
    datasetKey: 'hr_core',
    writeup: {
      to: 'Vikram Nair, Business Stakeholder',
      subject: 'Re: Department salary numbers — on Support',
      prompt: 'Write the reply. Under 140 words.',
      maxWords: 140,
      exhibit: {
        kind: 'table',
        from: 'Position within own salary band',
        body: 'Marketing     36.6%\nSupport       46.9%\nPeople Ops    61.3%\nFinance       63.1%\nSales         63.7%\nEngineering   66.1%',
      },
      rubric: [
        { key: 'answer', label: 'The direct answer to what he asked about Support', markers: ['support'], why: 'He asked about Support by name. Answer that first, even though the interesting finding is elsewhere.' },
        { key: 'marketing', label: 'That Marketing has the stronger case', markers: ['marketing'], why: 'This is the actual finding. Burying it because it was not what he asked about would be the safe choice and the wrong one.' },
        { key: 'method', label: 'What "position in band" means, in one line', markers: ['band|floor|ceiling|range|bracket'], why: 'He is not an analyst. A number he cannot interpret is a number he will not use.' },
        { key: 'limit', label: 'That market rate is not available', markers: ['market|benchmark|external|outside data|do not have|don\'t have|no data'], why: 'He probably means market rate by "underpaid". Saying plainly what you cannot answer is what stops him assuming you did.' },
      ],
      whyRight: 'You answered his question, told him the more useful thing he did not ask about, explained the measure in a line, and were straight about the limit.',
    },
    estHours: 0.4,
    priority: 'high',
    dueInDays: 3,
    day: 2,
    difficulty: 'hard',
  },

  // ---- Senior day 1 --------------------------------------------------------------------
  //
  // Same six-slot shape as the junior day — scope, warm up, analyse, review, judge,
  // communicate — but the questions are senior ones: the scoping task has a genuine
  // ambiguity to resolve rather than a mis-read to catch, and the write-up goes to an
  // engineering manager who will argue back.
  'sa-010': {
    title: 'Scope the reliability question',
    // What a colleague who knows you would point at — the trap, never the answer.
    hint: "'Worst' is doing a lot of work in that sentence. How many different questions could it mean?",
    brief: "Arjun wants to know 'which service is worst'. That phrase hides at least three different questions, and they do not have the same answer. Decide which ones are worth putting in front of him — and which are the same question wearing different words.",
    tool: 'choice',
    datasetKey: 'saas_ops',
    choice: {
      prompt: "Which of these are distinct, answerable readings of 'which service is worst'?",
      exhibit: {
        kind: 'email',
        from: 'Arjun Rao, Engineering Manager',
        subject: 'Next quarter planning',
        body: "We keep going round in circles on where to put the reliability effort next quarter. Half the room says api-gateway because it's always breaking, half says billing-sync because when it goes it really goes. Can you settle it? Which service is worst.",
      },
      options: [
        { key: 'freq', correct: true, label: 'Which service fails most often', why: 'Frequency. It is what "always breaking" means, and it is a real measure.' },
        { key: 'mttr', correct: true, label: 'Which service takes longest to fix when it does fail', why: 'Cost per failure. This is the other half of the room, and it is a genuinely different ranking.' },
        { key: 'total', correct: true, label: 'Which service costs the most engineering hours in total', why: 'Frequency times duration. It is the one that actually answers "where should the effort go", and neither half of the room asked for it.' },
        { key: 'blame', correct: false, label: 'Which team owns the worst service', why: 'There is no team ownership in this data, and turning a reliability question into a question about who is at fault is how you stop being invited.' },
        { key: 'sev', correct: false, label: 'Which service has the most SEV1s', why: 'Not a distinct question — it is the frequency measure with a filter on it. Presenting it as a fourth angle pads the analysis without adding one.' },
        { key: 'future', correct: false, label: 'Which service will fail next quarter', why: 'A forecast. Thirty-five incidents over three months is not enough history to predict from, and saying so is more useful than a number nobody should trust.' },
      ],
      skills: { businessLogic: 100, communication: 85 },
      whyRight: 'You found the third question neither side asked — total cost — and you spotted that the SEV1 angle is the frequency measure in disguise.',
    },
    estHours: 0.2,
    priority: 'high',
    dueInDays: 1,
    day: 1,
    difficulty: 'medium',
  },

  'sa-011': {
    title: 'How often each service breaks',
    // What a colleague who knows you would point at — the trap, never the answer.
    hint: "SUM with a CASE gets you the SEV1 count alongside the total without a second query.",
    brief: "Start with the simple half of the argument. Write ONE SQL SELECT returning, for each service, how many incidents it has had in total and how many of those were SEV1, most incidents first. This is the frequency picture — half the room's position, quantified.",
    referenceSql: "SELECT service, COUNT(*) AS incidents, SUM(CASE WHEN severity = 'SEV1' THEN 1 ELSE 0 END) AS sev1 FROM incidents GROUP BY service ORDER BY incidents DESC",
    datasetKey: 'saas_ops',
    tool: 'sql',
    estHours: 0.25,
    priority: 'medium',
    dueInDays: 1,
    day: 1,
    difficulty: 'easy',
  },

  'sa-012': {
    title: "Review Sneha's query",
    // What a colleague who knows you would point at — the trap, never the answer.
    hint: "Look at what the COUNT covers versus what the AVG covers. They are not the same set of rows.",
    brief: "Sneha on the support side wrote this to answer the same question and wants a second pair of eyes before it goes anywhere. Flag what is genuinely wrong. Flagging things that are fine is not caution here — it costs you the same as missing something.",
    tool: 'choice',
    datasetKey: 'saas_ops',
    choice: {
      prompt: 'What is wrong with this query? Only the real problems.',
      exhibit: {
        kind: 'sql',
        from: 'Sneha Joshi, Support Lead',
        body: "SELECT service,\n       COUNT(*) AS incidents,\n       AVG((julianday(resolved_at) - julianday(started_at)) * 24) AS avg_hours\nFROM incidents\nGROUP BY service\nORDER BY avg_hours DESC",
      },
      options: [
        { key: 'mixed', correct: true, label: 'The count includes unresolved incidents but the average cannot', why: 'AVG skips NULLs silently, so the average covers only closed incidents while the count covers all of them. Two different denominators in one row, and nothing on screen says so.' },
        { key: 'nofilter', correct: true, label: 'There is no filter on resolved_at', why: 'Seven incidents are still open. Whether they belong in the count is a judgement call — but it has to be made deliberately, not left to AVG to decide quietly.' },
        { key: 'avgshape', correct: true, label: 'An average alone hides the outliers this question is about', why: 'The argument is about services that "really go" when they go. A mean flattens exactly the tail that matters; a median plus a worst case would show it.' },
        { key: 'julian', correct: false, label: 'julianday is the wrong function for this', why: 'It is the right tool in SQLite — the difference of two julian days times 24 is hours. Nothing wrong here.' },
        { key: 'order', correct: false, label: 'Ordering by avg_hours is wrong', why: 'It is one defensible ordering for "slowest to fix". Not an error.' },
        { key: 'groupby', correct: false, label: 'GROUP BY service is too coarse', why: 'Service is exactly the grain the question is asked at. Splitting further would answer a question nobody asked.' },
      ],
      skills: { sql: 100, businessLogic: 95 },
      whyRight: 'You caught the mismatched denominators — a row where the count and the average describe different sets of incidents, with nothing to warn the reader.',
    },
    estHours: 0.3,
    priority: 'high',
    dueInDays: 2,
    day: 1,
    difficulty: 'hard',
  },

  'sa-013': {
    title: 'Settle the argument, honestly',
    // What a colleague who knows you would point at — the trap, never the answer.
    hint: "Both halves of the room are right about different things. That's the answer, not a problem with the data.",
    brief: "You have frequency and you have time-to-resolve. api-gateway breaks most often; billing-sync takes by far the longest to fix. Which statements can you defend in the room?",
    tool: 'choice',
    datasetKey: 'saas_ops',
    choice: {
      prompt: 'What do your two measures actually establish?',
      options: [
        { key: 'both', correct: true, label: 'Both halves of the room are right, about different things', why: 'api-gateway leads on frequency, billing-sync on time-to-resolve. The argument was never about the data; it was about which measure counts.' },
        { key: 'third', correct: true, label: 'The question they should be asking is total time lost, not either measure alone', why: 'Frequency times duration is the thing that maps to engineering effort, and it is the number that actually informs where next quarter goes.' },
        { key: 'thin', correct: true, label: "billing-sync's average rests on very few resolved incidents", why: 'One resolved incident behind that number. It is the highest figure on the table and the least reliable, and not saying so would be a real failure.' },
        { key: 'winner', correct: false, label: 'You can name one service as definitively worst', why: 'Only by picking a measure and not telling anyone you picked it. That is how an analyst wins an argument and loses trust.' },
        { key: 'nothing', correct: false, label: 'The data is too thin to say anything useful', why: 'Overcorrection. It is thin in one specific place, and saying which place is far more useful than refusing to answer.' },
        { key: 'ignore', correct: false, label: 'Unresolved incidents can be ignored as noise', why: 'Three of the seven open incidents are SEV1s. The ones still open may well be the worst ones, which is the opposite of noise.' },
      ],
      skills: { businessLogic: 100, communication: 90 },
      whyRight: 'You resolved the argument by naming the measure rather than picking a side, and you flagged that your own biggest number is your least reliable one.',
    },
    estHours: 0.25,
    priority: 'high',
    dueInDays: 2,
    day: 1,
    difficulty: 'hard',
  },

  'sa-014': {
    title: 'Brief Arjun',
    // What a colleague who knows you would point at — the trap, never the answer.
    hint: "Undercut your own biggest number before someone else does — check how many incidents it rests on.",
    brief: "Arjun asked you to settle an argument. You are going to tell him the argument was miscast — both sides were measuring different things — and then give him the number he actually needs. He will push back, so make it defensible in a paragraph. Under 150 words.",
    tool: 'writeup',
    datasetKey: 'saas_ops',
    writeup: {
      to: 'Arjun Rao, Engineering Manager',
      subject: 'Re: Next quarter planning',
      prompt: 'Write the brief. Under 150 words.',
      maxWords: 150,
      exhibit: {
        kind: 'table',
        from: 'Your two measures',
        body: 'By frequency        api-gateway   9 incidents\n                    report-builder 10 incidents\n\nBy time to resolve  billing-sync  62.0h  (1 resolved)\n                    api-gateway   40.8h  (8 resolved)\n                    data-export   39.0h  (6 resolved)',
      },
      rubric: [
        { key: 'reframe', label: 'That the two sides are measuring different things', markers: ['different|two measure|frequency|how often|both'], why: 'This is the actual answer. Giving him a winner without this just moves the argument rather than settling it.' },
        { key: 'numbers', label: 'Both measures, with the services named', markers: ['api-gateway|billing-sync|report-builder'], why: 'He needs to see the evidence, not just the conclusion — he is going to repeat this to the people who disagreed.' },
        { key: 'caveat', label: "That billing-sync's figure rests on one resolved incident", markers: ['one|1 resolved|single|thin|small|few'], why: 'It is your headline number and your weakest. If he finds this out in the meeting rather than from you, nothing else you said survives.' },
        { key: 'reco', label: 'A recommendation on what to measure or do next', markers: ['recommend|suggest|would|propose|next|total|hours lost|effort'], why: 'A senior brief ends with a view. Handing over two tables and letting the room resume the argument is not a settled question.' },
      ],
      whyRight: 'You reframed the argument, showed both measures, undercut your own biggest number before anyone else could, and finished with a view.',
    },
    estHours: 0.45,
    priority: 'high',
    dueInDays: 2,
    day: 1,
    difficulty: 'hard',
  },

  // ---- Presentation ------------------------------------------------------------------
  // A chart task is graded on judgement, not syntax: which chart, what on each axis, how
  // ordered, and whether the value axis starts at zero. Deterministic, so it costs
  // nothing and can run as often as the week needs.
  'da-006': {
    title: 'Chart the department pay gap',
    // What a colleague who knows you would point at — the trap, never the answer.
    hint: "Eight categories, one number each. And think about where the axis should start before you decide it looks better truncated.",
    brief: "Vikram is putting your department salary numbers in front of the leadership team on Thursday and wants one chart, not a table. Choose how to present it: the chart type, what goes on each axis, how it is ordered, and where the value axis starts. He is comparing one number across eight departments — that constraint should decide most of your choices for you.",
    tool: 'chart',
    datasetKey: 'hr_core',
    chart: {
      prompt: 'Average salary by department, for current staff.',
      // The rows the learner is charting. Graded on presentation, not on producing them.
      sourceSql: 'SELECT d.name AS department, AVG(e.salary) AS avg_salary FROM employees e JOIN departments d ON d.id = e.department_id WHERE e.exit_year IS NULL GROUP BY d.name ORDER BY avg_salary DESC',
      columns: ['department', 'avg_salary'],
      correct: { type: 'bar', x: 'department', y: 'avg_salary', sort: 'desc', baselineZero: true },
      whyRight: 'Bars compare magnitudes across categories, sorting does half the reader\'s work, and a zero baseline keeps the differences honest.',
      why: {
        type: 'Averages across departments are not parts of a whole, so a pie is a category error — they do not sum to anything. A line implies these categories have an order they do not have. Bars compare magnitudes, which is the question being asked.',
        x: 'The categories go on the category axis. Putting salary there leaves nothing to compare across.',
        y: 'The measured value belongs on the value axis — that is the thing whose length carries the meaning.',
        sort: 'Sorting by value does half the reader\'s work for them. Leadership is asking which department leads and by how much; an alphabetical chart makes them find that out themselves.',
        baselineZero: 'A bar\'s meaning is its length. Starting the axis at 800,000 makes a 3% gap look like a 3x gap — it genuinely uses the space better, which is exactly why it is a tempting mistake rather than an obvious one.',
      },
    },
    estHours: 0.25,
    priority: 'medium',
    dueInDays: 2,
    day: 2,
    difficulty: 'easy',
  },
  'da-007': {
    title: 'Chart the hiring trend',
    // What a colleague who knows you would point at — the trap, never the answer.
    hint: "This one isn't the same shape as the last chart. Ask whether these categories have an order.",
    brief: "People Ops wants your hiring-by-year numbers on one slide for the planning session. Same decisions as before — chart type, axes, ordering, baseline — but this is a different shape of question from the last one, and the answer that was right there is not automatically right here. Think about what these categories are before you pick.",
    tool: 'chart',
    datasetKey: 'hr_core',
    chart: {
      prompt: 'Headcount hired per year.',
      sourceSql: 'SELECT hire_year, COUNT(*) AS headcount FROM employees GROUP BY hire_year ORDER BY hire_year',
      columns: ['hire_year', 'headcount'],
      // The trap: the previous task rewarded bar + sorted-by-value. Years are an ORDERED
      // sequence, so both of those are now wrong. A learner who pattern-matches the last
      // answer loses exactly the marks they should.
      correct: { type: 'line', x: 'hire_year', y: 'headcount', sort: 'none' },
      whyRight: 'Years are an ordered sequence, so a line shows the trend and the order carries meaning of its own.',
      why: {
        type: 'Years are ordered and evenly spaced, which is exactly what a line chart is for — it shows the direction of travel between them. Bars would work, but they invite the reader to compare 2019 with 2023 as if they were unrelated categories rather than points on a trend.',
        x: 'The year is the sequence you are plotting along.',
        y: 'Headcount is the measured value.',
        sort: 'Do not sort a time series by value. Reordering the years destroys the only thing the chart is meant to show.',
      },
    },
    estHours: 0.25,
    priority: 'medium',
    dueInDays: 3,
    day: 2,
    difficulty: 'medium',
  },


  // ---- Project 2: Headcount & Hiring Trends -----------------------------------------
  //
  // People Ops needs next year's hiring plan, and the honest version of this week is that
  // the data will not carry the story they are hoping for. The week's spine:
  //
  //   Monday    what hiring has actually done — and two years too thin to read
  //   Tuesday   what each intake cost, and why the cheapest year means nothing
  //   Wednesday attrition, which is six people in total and cannot be split by department
  //   Thursday  where the hiring actually went — People Ops hired seven of its own nine
  //   Friday    the plan, with Neha pushing for a single number you cannot defend
  //
  // Every figure in these briefs and rubrics was measured against the generated dataset
  // rather than assumed. The trap running through the whole week is the opposite of
  // project 1's: this project is about INTAKE, so filtering to current staff is usually
  // the wrong move — except in the four places where it is the only right one.

  'hc-101': {
    title: 'What is actually being asked for',
    hint: "Read what Neha needs to DO with it. A plan needs a direction and a size, not a table.",
    brief: "Neha in People Ops has asked for 'the hiring trends'. Before you write a line of SQL, work out what she is actually going to do with it.",
    tool: 'choice', datasetKey: 'hr_core',
    choice: {
      exhibit: {
        kind: 'email', from: 'Neha Kulkarni', subject: 'Hiring trends for next year\'s plan',
        body: "Morning — I am building next year's hiring plan and I need to understand what we have actually been doing. How many people we take on, what that has cost, and whether anything has changed. Asha said you would have it by Friday.\n\nI have to take a number to the budget round, so the more you can tell me about what is normal for us, the better.",
      },
      prompt: 'Tick everything that follows from what she has asked for.',
      options: [
        { key: 'intake', correct: true, label: 'This is about hiring INTAKE, not current headcount', why: 'Somebody hired in 2019 who has since left was still a 2019 hire. Filtering them out would understate every year in the series.' },
        { key: 'direction', correct: true, label: 'She needs a direction of travel, not just this year\'s figure', why: '"Whether anything has changed" is a trend question. One number cannot answer it.' },
        { key: 'cost', correct: true, label: 'Cost per intake matters as much as the count', why: 'She said budget round. A plan for ten hires means nothing without what ten hires cost.' },
        { key: 'names', correct: false, label: 'She needs the list of people hired each year', why: 'She is planning, not auditing. Named individuals are both useless to her and a data-handling problem you would have created for yourself.' },
        { key: 'current', correct: false, label: 'Filter to current staff throughout — leavers are not relevant to a plan', why: 'This is the single mistake this project is built around. Leavers still consumed a hiring slot and a budget in the year they were hired.' },
        { key: 'wait', correct: false, label: 'Ask her to specify the exact tables and columns first', why: 'She does not know them and it is not her job to. Going back with "what do you want" when the ask is legible is how an analyst becomes a ticket queue.' },
      ],
      skills: { businessLogic: 100, communication: 60 },
    },
    estHours: 0.25, priority: 'high', dueInDays: 1, day: 1, difficulty: 'easy',
  },

  'hc-102': {
    title: 'How many people are we talking about',
    hint: "One row, three numbers. A CASE inside a SUM counts a condition without throwing the other rows away.",
    brief: "Before anything else, get the size of the thing. Write ONE SQL SELECT returning three figures in a single row: how many people the company has EVER hired, how many are still here, and how many have left. Do not filter any of them out — use a CASE so all three come from the same pass.",
    referenceSql: 'SELECT COUNT(*) AS ever_hired, SUM(CASE WHEN exit_year IS NULL THEN 1 ELSE 0 END) AS still_here, SUM(CASE WHEN exit_year IS NOT NULL THEN 1 ELSE 0 END) AS leavers FROM employees',
    datasetKey: 'hr_core', tool: 'sql', estHours: 0.3, priority: 'high', dueInDays: 1, day: 1, difficulty: 'easy',
  },

  'hc-103': {
    title: 'What the trend does and does not say',
    hint: "Look at the counts, not the shape. Two of those years have almost nobody in them.",
    brief: "You have the hiring series in front of you. Before you show it to anyone, decide what it actually supports.",
    tool: 'choice', datasetKey: 'hr_core',
    choice: {
      prompt: 'Tick everything your own result supports.',
      options: [
        { key: 'dip', correct: true, label: 'Hiring collapsed in 2021 and 2022, then recovered', why: 'Ten in 2020, then four and two, then six, nine and seven. That is the clearest thing in the series.' },
        { key: 'thin', correct: true, label: 'The 2022 figure rests on two people', why: 'Two. Any average built on it is a statement about two individuals wearing the clothes of a trend.' },
        { key: 'recovered', correct: true, label: 'The last three years are back around the long-run level', why: 'Six, nine and seven against a ten-year average of about seven. That is the useful sentence for a plan.' },
        { key: 'cause', correct: false, label: 'The dip shows the company had a hiring freeze', why: 'It shows hiring fell. Why it fell is not in this table, and a freeze is only one of several explanations.' },
        { key: 'growth', correct: false, label: 'Headcount grew every year', why: 'Intake is not net growth — you have not looked at leavers yet. Two different questions.' },
        { key: 'best', correct: false, label: '2022 was our most cost-effective hiring year', why: 'That is tomorrow\'s trap, arriving early. A low average over two people is not a cost-effectiveness finding.' },
      ],
      skills: { businessLogic: 100, dataViz: 40 },
    },
    estHours: 0.25, priority: 'high', dueInDays: 2, day: 1, difficulty: 'medium',
  },

  'hc-104': {
    title: 'Which years are too thin to read',
    hint: "HAVING filters groups after they are formed. WHERE cannot see a COUNT.",
    brief: "Neha will quote whatever you give her, so find the years that cannot carry a claim. Write ONE SQL SELECT returning each hire_year with FEWER THAN FIVE hires and how many there were, smallest first.",
    referenceSql: 'SELECT hire_year, COUNT(*) AS hired FROM employees GROUP BY hire_year HAVING COUNT(*) < 5 ORDER BY hired ASC',
    datasetKey: 'hr_core', tool: 'sql', estHours: 0.35, priority: 'medium', dueInDays: 2, day: 1, difficulty: 'medium',
  },

  'hc-105': {
    title: 'First note back to Neha',
    hint: "Tell her what you have got and what is coming. The caveat about the thin years belongs here, not on Friday.",
    brief: "Write back to Neha at the end of day one. She has not asked for anything yet — this is you telling her where it is going, which is what stops her guessing. Under 130 words.",
    tool: 'writeup', datasetKey: 'hr_core',
    writeup: {
      to: 'Neha Kulkarni', subject: 'Hiring trends — where I have got to', maxWords: 130,
      prompt: 'The end-of-day note. What you have, what it says, what is next.',
      rubric: [
        { key: 'have', label: 'What you have actually produced', markers: ['hiring|hire|intake|year|series|trend'], why: 'Start with the thing that exists. She can act on that today.' },
        { key: 'shape', label: 'The shape of it — the dip and the recovery', markers: ['2021|2022|dip|fell|drop|recover|back'], why: 'The one finding worth her knowing tonight rather than Friday.' },
        { key: 'thin', label: 'That two of the years are too small to read', markers: ['two|2 |four|small|thin|few|caveat|careful'], why: 'Flagging it now stops her quoting 2022 at somebody on Wednesday.' },
        { key: 'scope', label: 'That this counts everyone hired, leavers included', markers: ['ever|all|includ|leaver|left|intake|not current'], why: 'She will assume current staff unless you say otherwise, and then her numbers will not match yours.' },
        { key: 'next', label: 'What is coming next', markers: ['next|tomorrow|cost|then|will|working on'], why: 'A status note without a next step makes her ask for one.' },
      ],
    },
    estHours: 0.4, priority: 'medium', dueInDays: 2, day: 1, difficulty: 'medium',
  },


  'hc-110': {
    title: 'What each intake cost',
    hint: "Two aggregates over the same group. SUM answers what it cost, AVG answers what a hire cost.",
    brief: "Neha has a budget round, so the count is only half the question. Write ONE SQL SELECT returning, for each hire_year, how many people were hired, the total salary of that intake and the average, oldest year first. Everyone hired that year, including people who have since left — they were still paid.",
    referenceSql: 'SELECT hire_year, COUNT(*) AS hired, SUM(salary) AS total_cost, AVG(salary) AS avg_salary FROM employees GROUP BY hire_year ORDER BY hire_year',
    datasetKey: 'hr_core', tool: 'sql', estHours: 0.4, priority: 'high', dueInDays: 2, day: 2, difficulty: 'medium',
  },

  'hc-111': {
    title: 'The cheapest year we ever had',
    hint: "Look at the count in that row before you look at the average. Then decide whether it is a finding.",
    brief: "Your cost table says 2022 had by far the lowest average salary per hire — about eleven lakh below the year before it. Neha would love that sentence. Decide what you can actually say about it.",
    tool: 'choice', datasetKey: 'hr_core',
    choice: {
      prompt: 'Tick everything that is defensible.',
      options: [
        { key: 'two', correct: true, label: 'The 2022 average is two people, so it is not a hiring-cost finding', why: 'Two salaries. Move either of them and the "trend" moves with it. This is the whole point of the task.' },
        { key: 'juniors', correct: true, label: 'A low average is as likely to mean we hired juniors as that we paid less', why: 'Average salary mixes seniority with rate. Without the roles you cannot tell those apart, and they mean opposite things to a plan.' },
        { key: 'exclude', correct: true, label: 'Report it with the headcount beside it, or leave it out', why: 'Either is honest. Quoting the average alone is the only option that is not.' },
        { key: 'efficient', correct: false, label: '2022 was our most cost-efficient hiring year', why: 'It is a sentence that will be repeated in a budget meeting and cannot survive one question. Do not put it in her hands.' },
        { key: 'repeat', correct: false, label: 'Recommend repeating the 2022 approach', why: 'There was no approach — there were two hires in the middle of a collapse in hiring. You would be recommending an accident.' },
        { key: 'drop', correct: false, label: 'Quietly drop 2022 from the table without saying so', why: 'Silently removing an inconvenient row is worse than reporting it badly. If it is excluded, the reader has to know it was.' },
      ],
      skills: { businessLogic: 100, communication: 60 },
    },
    estHours: 0.3, priority: 'high', dueInDays: 3, day: 2, difficulty: 'hard',
  },

  'hc-112': {
    title: 'Chart what a hire costs',
    hint: "Same sequence as the last chart, different measure. Ask yourself whether zero belongs on this axis.",
    brief: "Put average salary per intake year on a slide for the budget pack. It is the same horizontal sequence as the hiring chart, so the same reasoning about order applies — but this is a money value, not a count, and that changes one of the decisions.",
    tool: 'chart', datasetKey: 'hr_core',
    chart: {
      prompt: 'Average salary of each year\'s intake.',
      sourceSql: 'SELECT hire_year, AVG(salary) AS avg_salary FROM employees GROUP BY hire_year ORDER BY hire_year',
      columns: ['hire_year', 'avg_salary'],
      correct: { type: 'line', x: 'hire_year', y: 'avg_salary', sort: 'none' },
      whyRight: 'Years are an ordered sequence, so a line carries the direction of travel — and the order is the finding.',
      why: {
        type: 'Still a time series, so still a line. Bars would invite the reader to compare 2016 against 2023 as unrelated categories rather than as points on a path.',
        x: 'The year is the sequence.',
        y: 'Average salary is the measured value.',
        sort: 'Never sort a time series by value. Reordering the years destroys the only thing the chart exists to show.',
      },
    },
    estHours: 0.25, priority: 'medium', dueInDays: 3, day: 2, difficulty: 'medium',
  },

  'hc-113': {
    title: 'Only the years big enough to trust',
    hint: "Same HAVING as yesterday, pointing the other way.",
    brief: "Rebuild the cost table with the thin years taken out, so there is a version Neha can quote without a footnote. Write ONE SQL SELECT returning hire_year, the number hired and the average salary, for years with AT LEAST FIVE hires, oldest first.",
    referenceSql: 'SELECT hire_year, COUNT(*) AS hired, AVG(salary) AS avg_salary FROM employees GROUP BY hire_year HAVING COUNT(*) >= 5 ORDER BY hire_year',
    datasetKey: 'hr_core', tool: 'sql', estHours: 0.35, priority: 'medium', dueInDays: 3, day: 2, difficulty: 'medium',
  },

  'hc-114': {
    title: 'What a hire costs, to Neha',
    hint: "Give her the number she can budget with, and tell her which years you left out and why.",
    brief: "Neha needs a cost-per-hire figure for the budget round. Write it up. The difficulty is that the honest answer has an exclusion in it, and an exclusion you do not explain looks like a mistake. Under 150 words.",
    tool: 'writeup', datasetKey: 'hr_core',
    writeup: {
      to: 'Neha Kulkarni', subject: 'What a hire has cost us', maxWords: 150,
      prompt: 'The cost-per-hire note, with the exclusion explained rather than hidden.',
      rubric: [
        { key: 'figure', label: 'A usable cost-per-hire figure', markers: ['\\d{2}|lakh|average|avg|cost|salary|₹|rs'], why: 'She is going into a budget round. Give her the number.' },
        { key: 'excluded', label: 'That 2021 and 2022 are excluded', markers: ['2021|2022|exclud|left out|omit|remov'], why: 'An unexplained exclusion reads as an error when someone checks it.' },
        { key: 'why', label: 'Why they are excluded — too few people', markers: ['two|four|small|thin|few|sample|count'], why: 'The reason is the whole defence. Without it the exclusion looks like picking the years that suit you.' },
        { key: 'mix', label: 'That average salary reflects seniority, not just rate', markers: ['senior|junior|mix|role|level|who we hire|composition'], why: 'A plan built on the average without this will underfund a year of senior hiring.' },
        { key: 'scope', label: 'That this is everyone hired, leavers included', markers: ['leaver|left|includ|ever|all hires|intake'], why: 'Her instinct will be current staff. Say it before the numbers diverge.' },
      ],
    },
    estHours: 0.5, priority: 'high', dueInDays: 3, day: 2, difficulty: 'hard',
  },


  'hc-120': {
    title: 'How many people have actually left',
    hint: "Count the leavers by the year they left, not the year they joined.",
    brief: "Neha wants attrition in the plan. Find out what there is to work with first. Write ONE SQL SELECT returning, for each exit_year, how many people left, oldest year first. Only people who have actually left.",
    referenceSql: 'SELECT exit_year, COUNT(*) AS leavers FROM employees WHERE exit_year IS NOT NULL GROUP BY exit_year ORDER BY exit_year',
    datasetKey: 'hr_core', tool: 'sql', estHours: 0.3, priority: 'high', dueInDays: 3, day: 3, difficulty: 'easy',
  },

  'hc-121': {
    title: 'Attrition by department',
    hint: "Run it before you form a view. The answer is more awkward than either 'yes' or 'no'.",
    brief: "Neha has asked specifically for attrition split by department, so she knows where to focus retention. Write ONE SQL SELECT returning, for each department, how many people have left, most first. Then look hard at what comes back.",
    referenceSql: 'SELECT d.name AS department, COUNT(*) AS leavers FROM employees e JOIN departments d ON d.id = e.department_id WHERE e.exit_year IS NOT NULL GROUP BY d.name ORDER BY leavers DESC',
    datasetKey: 'hr_core', tool: 'sql', estHours: 0.35, priority: 'high', dueInDays: 3, day: 3, difficulty: 'medium',
  },

  'hc-122': {
    title: 'What that result lets you tell her',
    hint: "Three departments, two leavers each, three departments with none. Ask what a difference of two people would do to that ranking.",
    brief: "You have the departmental attrition table. Neha is going to build a retention plan on whatever you send her. Decide what it actually supports.",
    tool: 'choice', datasetKey: 'hr_core',
    choice: {
      prompt: 'Tick everything that is defensible.',
      options: [
        { key: 'six', correct: true, label: 'Six leavers in total is too few to rank departments by', why: 'Six people across six departments. One more leaver anywhere reorders the whole table, which means the order carries no information.' },
        { key: 'flat', correct: true, label: 'The three departments with any attrition all have exactly two', why: 'Support, Finance and Engineering, two each. There is no worst department here — there is a tie and three zeroes.' },
        { key: 'company', correct: true, label: 'Company-wide attrition is something you CAN report', why: 'Six of sixty-nine ever hired. That is a real figure at the level the data supports, and it is worth giving her.' },
        { key: 'support', correct: false, label: 'Support has the worst retention problem', why: 'It is joint first on two people, and it is also the largest of the three. Reported as a finding it would send a retention budget somewhere the evidence does not point.' },
        { key: 'zero', correct: false, label: 'Marketing, Sales and People Ops have no retention risk', why: 'They have no leavers in this dataset. Over six total departures, "none yet" and "no risk" are very different claims.' },
        { key: 'percent', correct: false, label: 'Convert to a percentage per department so it looks more rigorous', why: 'Two out of ten as "20%" is the same two people with a decimal point in front of them. A percentage on a tiny denominator hides the sample size rather than fixing it.' },
      ],
      skills: { businessLogic: 100, communication: 80 },
    },
    estHours: 0.3, priority: 'high', dueInDays: 4, day: 3, difficulty: 'hard',
  },

  'hc-123': {
    title: 'Something you can say instead',
    hint: "You cannot split six people by department. You can ask how long they stayed.",
    brief: "Give Neha a retention finding the data does carry. Write ONE SQL SELECT returning, for people who have left, how many years they stayed and how many people that was, shortest tenure first.",
    referenceSql: 'SELECT exit_year - hire_year AS years_stayed, COUNT(*) AS people FROM employees WHERE exit_year IS NOT NULL GROUP BY years_stayed ORDER BY years_stayed',
    datasetKey: 'hr_core', tool: 'sql', estHours: 0.35, priority: 'high', dueInDays: 4, day: 3, difficulty: 'medium',
  },

  'hc-124': {
    title: 'Who is here now, by department',
    hint: "This one IS a current-staff question. The filter you have been leaving off all week belongs here.",
    brief: "The plan needs a base to build on: what the company looks like today. Write ONE SQL SELECT returning, for each department, the CURRENT headcount and average salary, largest first. Leavers are not part of today's headcount — this is the one kind of question where filtering them out is correct.",
    referenceSql: 'SELECT d.name AS department, COUNT(*) AS headcount, AVG(e.salary) AS avg_salary FROM employees e JOIN departments d ON d.id = e.department_id WHERE e.exit_year IS NULL GROUP BY d.name ORDER BY headcount DESC',
    datasetKey: 'hr_core', tool: 'sql', estHours: 0.4, priority: 'high', dueInDays: 4, day: 3, difficulty: 'medium',
  },

  'hc-125': {
    title: 'Tell Neha attrition is not the story',
    hint: "Do not lead with what you cannot do. Lead with what you found, then say where it stops.",
    brief: "Neha asked for a departmental attrition split and you are not going to give her one. This is the hardest note of the week: the request was reasonable, the data exists, and the answer is still no. Say it in a way she can take into a planning meeting. Under 160 words.",
    tool: 'writeup', datasetKey: 'hr_core',
    writeup: {
      to: 'Neha Kulkarni', subject: 'Attrition — what I can and cannot give you', maxWords: 160,
      prompt: 'The no, with something usable attached to it.',
      rubric: [
        { key: 'total', label: 'The company-wide figure, which you CAN give her', markers: ['six|6 |total|company|overall|across'], why: 'Lead with what exists. A note that opens with a refusal gets read as obstruction.' },
        { key: 'why', label: 'Why the departmental split will not hold', markers: ['few|small|six|two|sample|rank|order|noise'], why: 'The reason has to be specific. "Not enough data" without a number is something she will push back on, and should.' },
        { key: 'tenure', label: 'The tenure finding you can offer instead', markers: ['tenure|year|stayed|first year|early|long'], why: 'Four of six left inside a year. That is a real retention signal at a grain the data supports.' },
        { key: 'not', label: 'That "no leavers" is not the same as "no risk"', markers: ['not|no risk|does not mean|cannot conclude|absence|yet'], why: 'Otherwise she plans retention budget away from three departments on the strength of nothing.' },
        { key: 'offer', label: 'What would let you answer it properly', markers: ['exit|interview|survey|more|longer|track|future|collect'], why: 'Turning a no into a next step is what stops it being a dead end.' },
      ],
    },
    estHours: 0.55, priority: 'high', dueInDays: 4, day: 3, difficulty: 'hard',
  },


  'hc-130': {
    title: 'Where the hiring actually went',
    hint: "Filter on hire_year, not exit_year. This is about who we took on, whoever is still here.",
    brief: "Neha's plan allocates next year's hires between departments, so she needs to know how the last few were allocated. Write ONE SQL SELECT returning, for each department, how many people were hired from 2023 onwards, most first.",
    referenceSql: 'SELECT d.name AS department, COUNT(*) AS hired FROM employees e JOIN departments d ON d.id = e.department_id WHERE e.hire_year >= 2023 GROUP BY d.name ORDER BY hired DESC',
    datasetKey: 'hr_core', tool: 'sql', estHours: 0.4, priority: 'high', dueInDays: 4, day: 4, difficulty: 'medium',
  },

  'hc-131': {
    title: 'And where those people sit',
    hint: "Current staff this time — you are describing the office as it is today, not who was ever hired.",
    brief: "The plan has a desk-space line in it, so Neha needs the geography. Write ONE SQL SELECT returning, for each location, the CURRENT headcount and average salary, largest first.",
    referenceSql: 'SELECT location, COUNT(*) AS headcount, AVG(salary) AS avg_salary FROM employees WHERE exit_year IS NULL GROUP BY location ORDER BY headcount DESC',
    datasetKey: 'hr_core', tool: 'sql', estHours: 0.35, priority: 'medium', dueInDays: 4, day: 4, difficulty: 'medium',
  },

  'hc-132': {
    title: 'Finance has a different number',
    hint: "Both numbers are right. The question is which one answers which question.",
    brief: "Diya in Finance has been building the same picture from her side and her headcount does not match yours. Work out what has happened before you reply.",
    tool: 'choice', datasetKey: 'hr_core',
    choice: {
      exhibit: {
        kind: 'email', from: 'Diya Chandra', subject: 'Our headcount numbers do not agree',
        body: "I have 63 and your deck says 69. That is a six-person gap and we are both presenting on Friday.\n\nI do not think either of us is wrong, but we cannot walk in with two numbers. Which is it?",
      },
      prompt: 'Tick everything that is true and worth saying to her.',
      options: [
        { key: 'both', correct: true, label: 'Both are right — they answer different questions', why: 'Sixty-nine is everyone ever hired. Sixty-three is who is here today. The gap is the six leavers, exactly.' },
        { key: 'name', correct: true, label: 'The fix is to label each number with its population', why: '"Hires since 2016" and "current headcount" can sit on the same slide without contradicting each other. Two bare 60-somethings cannot.' },
        { key: 'mine', correct: true, label: 'For a HIRING plan, the intake number is the relevant one', why: 'She is planning hires. A plan that ignores everyone who has left understates what hiring has had to replace.' },
        { key: 'wrong', correct: false, label: 'Tell her Finance\'s number is wrong', why: 'It is not, and saying so to the person who owns the cost baseline is a fight you would lose in public on Friday.' },
        { key: 'split', correct: false, label: 'Average the two and present 66', why: 'A number that describes nothing, defended by no one. This is how a reconciliation turns into a fabrication.' },
        { key: 'drop', correct: false, label: 'Drop headcount from your deck to avoid the clash', why: 'The clash is the interesting part and it takes one sentence to resolve. Removing it leaves the same confusion, just later.' },
      ],
      skills: { businessLogic: 100, communication: 100 },
    },
    estHours: 0.3, priority: 'high', dueInDays: 4, day: 4, difficulty: 'hard',
  },

  'hc-133': {
    title: 'Chart the department mix',
    hint: "These categories have no natural order, so you get to choose one. Choose the one that helps the reader.",
    brief: "Put current headcount by department on a slide. This is a different shape of question from the two time series you have charted this week — these categories are not a sequence, and that changes both the chart type and what you do about ordering.",
    tool: 'chart', datasetKey: 'hr_core',
    chart: {
      prompt: 'Current headcount in each department.',
      sourceSql: 'SELECT d.name AS department, COUNT(*) AS headcount FROM employees e JOIN departments d ON d.id = e.department_id WHERE e.exit_year IS NULL GROUP BY d.name ORDER BY headcount DESC',
      columns: ['department', 'headcount'],
      correct: { type: 'bar', x: 'department', y: 'headcount', sort: 'desc' },
      whyRight: 'Unordered categories compared by size: bars, sorted biggest first so the ranking is readable at a glance.',
      why: {
        type: 'Departments are categories, not a sequence. A line between Engineering and Finance would imply a path that does not exist.',
        x: 'The department is the category being compared.',
        y: 'Headcount is the measured value.',
        sort: 'Nothing orders these for you, so sorting by size does the reader\'s work for them. This is the opposite of the time-series rule, and knowing which case you are in is the skill.',
      },
    },
    estHours: 0.25, priority: 'medium', dueInDays: 5, day: 4, difficulty: 'medium',
  },

  'hc-134': {
    title: 'How new is each team',
    hint: "Two conditions in the same WHERE: still here, AND hired recently.",
    brief: "One thing worth knowing before you plan next year: how much of each team is recent. Write ONE SQL SELECT returning, for each department, how many CURRENT staff joined in 2023 or later, most first.",
    referenceSql: 'SELECT d.name AS department, COUNT(*) AS joined_recently FROM employees e JOIN departments d ON d.id = e.department_id WHERE e.exit_year IS NULL AND e.hire_year >= 2023 GROUP BY d.name ORDER BY joined_recently DESC',
    datasetKey: 'hr_core', tool: 'sql', estHours: 0.4, priority: 'high', dueInDays: 5, day: 4, difficulty: 'medium',
  },

  'hc-135': {
    title: 'What Meera is about to say in your name',
    hint: "She has written three sentences from your tables. Two of them are not in your tables.",
    brief: "Meera in Comms has drafted the intro for the planning pack using your numbers. It goes out under the Data & Analytics banner, which means it goes out as yours. Read it properly.",
    tool: 'choice', datasetKey: 'hr_core',
    choice: {
      exhibit: {
        kind: 'email', from: 'Meera Pillai', subject: 'Draft intro for the planning pack — quick check',
        body: "Here is the opening paragraph, built from your analysis:\n\n\"Hiring has recovered strongly since the 2021-22 slowdown, with 2024 our second-largest intake in a decade. Our most efficient hiring year was 2022, at under ten lakh per hire. Attrition is concentrated in Support, where retention work should focus. People Ops has grown fastest, with seven of its nine current staff joining since 2023.\"\n\nHappy to send unless you shout.",
      },
      prompt: 'Tick every sentence you would tell her to change or cut.',
      options: [
        { key: 'efficient', correct: true, label: 'The "most efficient hiring year was 2022" sentence', why: 'Two people. You spent Tuesday establishing this is not a finding, and here it is about to go out in your name.' },
        { key: 'support', correct: true, label: 'The "attrition concentrated in Support" sentence', why: 'Two leavers, tied with two other departments. This is Wednesday\'s work being undone in a paragraph.' },
        { key: 'recovered', correct: false, label: 'The "hiring has recovered" sentence', why: 'That one is supported — six, nine and seven against a collapse to four and two. Cutting a true sentence costs you credibility for the ones you do challenge.' },
        { key: 'peopleops', correct: false, label: 'The People Ops growth sentence', why: 'Seven of nine, straight out of your own query. It is the strongest real finding in the pack.' },
        { key: 'second', correct: false, label: 'The "second-largest intake in a decade" claim', why: 'Nine in 2024, behind only 2020\'s ten — though it ties with 2017 and 2018. Defensible as written, and worth knowing it is a three-way tie if anyone pushes.' },
        { key: 'all', correct: false, label: 'Ask her to remove all the numbers and keep it qualitative', why: 'The numbers are the point of the pack. The problem is two specific claims, not the existence of figures.' },
      ],
      skills: { communication: 100, businessLogic: 80 },
    },
    estHours: 0.35, priority: 'high', dueInDays: 5, day: 4, difficulty: 'hard',
  },


  'hc-140': {
    title: 'Hires against leavers, year by year',
    hint: "Two counts over different columns. A correlated subquery per year is the readable way to do it.",
    brief: "A hiring plan is about net change, not intake alone. Write ONE SQL SELECT returning, for each year the company hired in: the year, how many were hired, how many left in that same year, and the net change. Oldest year first.",
    referenceSql: 'SELECT y.yr AS year, (SELECT COUNT(*) FROM employees WHERE hire_year = y.yr) AS hired, (SELECT COUNT(*) FROM employees WHERE exit_year = y.yr) AS left_us, (SELECT COUNT(*) FROM employees WHERE hire_year = y.yr) - (SELECT COUNT(*) FROM employees WHERE exit_year = y.yr) AS net FROM (SELECT DISTINCT hire_year AS yr FROM employees) y ORDER BY y.yr',
    datasetKey: 'hr_core', tool: 'sql', estHours: 0.6, priority: 'high', dueInDays: 5, day: 5, difficulty: 'hard',
  },

  'hc-141': {
    title: 'Median tenure, in Python',
    // Deliberately flagged for rework: Asha accepts the answer and then asks for it a
    // different way. Being told your correct answer is not the right approach is the most
    // common experience of a first year and almost nothing simulates it.
    rework: true,
    hint: "SQLite has no median. Build the list of tenures yourself and take the middle, and handle the even-length case.",
    brief: "Neha wants to know how long people stay, and the average is dragged around by six data points. In the notebook, compute the MEDIAN number of years that leavers stayed, and how many leavers that is based on. Assign a dict with keys median_tenure and leavers to `result`.",
    tool: 'python', datasetKey: 'hr_core',
    estHours: 0.5, priority: 'high', dueInDays: 5, day: 5, difficulty: 'hard',
    referenceCompute: (tables) => {
      const tenures = tables.employees
        .filter((e) => e.exit_year != null)
        .map((e) => e.exit_year - e.hire_year)
        .sort((a, b) => a - b);
      const m = Math.floor(tenures.length / 2);
      const median = tenures.length % 2 ? tenures[m] : (tenures[m - 1] + tenures[m]) / 2;
      return { median_tenure: median, leavers: tenures.length };
    },
  },

  'hc-142': {
    title: 'What to actually plan for',
    hint: "You have ten years of intake and a recent three that look different from the middle three. Decide which base is defensible.",
    brief: "Neha needs a planning assumption. You have the whole series, the dip, the recovery and six leavers. Decide what you would put your name to.",
    tool: 'choice', datasetKey: 'hr_core',
    choice: {
      prompt: 'Tick every basis you could defend in a budget meeting.',
      options: [
        { key: 'recent', correct: true, label: 'The last three years — six, nine and seven — as the working range', why: 'Post-recovery, three consecutive years, twenty-two people. It is the most recent period that looks like a normal state.' },
        { key: 'longrun', correct: true, label: 'The ten-year average of about seven a year, as a sense check', why: 'Sixty-nine over ten years. Useful precisely because it agrees with the recent three — two methods landing in the same place is worth saying.' },
        { key: 'replace', correct: true, label: 'Plus whatever attrition is expected to take out', why: 'A plan for seven hires with six historical leavers in the background is a plan for net growth of slightly under seven. Say which one you mean.' },
        { key: 'peak', correct: false, label: 'The 2020 peak of ten, since we should aim high', why: 'Planning to the best year you ever had is not a forecast, it is an aspiration with a number on it. It will be wrong in the direction that costs money.' },
        { key: 'dip', correct: false, label: 'The 2021-22 average, as the conservative option', why: 'Three a year across the worst two years in the series, six people in total. Conservative and unrepresentative are not the same thing.' },
        { key: 'trend', correct: false, label: 'Extrapolate the 2023-25 line forward to get next year\'s figure', why: 'Six, nine, seven is not a line — it is noise around seven. Fitting a trend to three points and projecting it is how a plan acquires false precision.' },
      ],
      skills: { businessLogic: 100, communication: 80 },
    },
    estHours: 0.3, priority: 'high', dueInDays: 5, day: 5, difficulty: 'hard',
  },

  'hc-143': {
    title: 'How much of each team is new',
    hint: "Current staff only, with a CASE inside the SUM so you get both numbers from one pass.",
    brief: "The last piece before you write the plan. Write ONE SQL SELECT returning, for each department: the CURRENT headcount, and how many of those people joined in 2023 or later. Largest team first. One of these departments is going to surprise you.",
    referenceSql: 'SELECT d.name AS department, COUNT(*) AS headcount, SUM(CASE WHEN e.hire_year >= 2023 THEN 1 ELSE 0 END) AS recent_joiners FROM employees e JOIN departments d ON d.id = e.department_id WHERE e.exit_year IS NULL GROUP BY d.name ORDER BY headcount DESC',
    datasetKey: 'hr_core', tool: 'sql', estHours: 0.45, priority: 'high', dueInDays: 5, day: 5, difficulty: 'hard',
  },

  'hc-144': {
    title: 'Neha wants one number',
    hint: "She is not asking you to be more accurate. She is asking you to be more certain than you are.",
    brief: "An hour before the budget round, Neha asks for the thing you have spent the week explaining you cannot give her cleanly. Tick every response you can stand behind.",
    tool: 'choice', datasetKey: 'hr_core',
    choice: {
      exhibit: {
        kind: 'email', from: 'Neha Kulkarni', subject: 'Just give me the number',
        body: "I know all the caveats and I have read them. But Finance will not accept a range and I have twenty minutes in that room.\n\nHow many people should we plan to hire next year? One number.",
      },
      prompt: 'Which responses are both honest and useful to her?',
      options: [
        { key: 'seven', correct: true, label: '"Seven — that is both the ten-year average and the middle of the last three years"', why: 'A single number she can use, with the reasoning compressed into one clause. Giving a number is not dishonest when you can defend it.' },
        { key: 'plusattr', correct: true, label: '"Seven to hold steady — more if you want the headcount to grow"', why: 'It answers the question and surfaces the assumption hidden inside it, which is the bit Finance will actually probe.' },
        { key: 'whereitgoes', correct: true, label: '"I can give you seven, but the split between departments is the number worth arguing about"', why: 'Redirects her to the decision that actually matters — People Ops took seven of its nine in three years — without refusing the one she asked for.' },
        { key: 'refuse', correct: false, label: '"I cannot give you a single number responsibly"', why: 'You can. Seven is defensible twice over. Refusing here is not rigour, it is leaving her to invent a number that has no analysis behind it at all.' },
        { key: 'ten', correct: false, label: '"Ten — better to ask high and get cut back"', why: 'Playing the budget game with a number that came out of your analysis puts your credibility behind someone else\'s negotiating tactic.' },
        { key: 'caveats', correct: false, label: 'Send the caveats again and let her decide', why: 'She has read them and said so. Repeating them is not care, it is refusing to do the last and hardest part of the job.' },
      ],
      skills: { communication: 100, businessLogic: 100 },
    },
    estHours: 0.35, priority: 'high', dueInDays: 5, day: 5, difficulty: 'hard',
  },

  'hc-145': {
    title: 'The hiring plan, to People Ops',
    hint: "Number first. Then what it is built on, then the one thing you would not bet on.",
    brief: "The deliverable the whole week has been for. Neha will paste this into the budget pack, so write it as something that survives being read by Finance without you in the room.",
    tool: 'writeup', datasetKey: 'hr_core',
    writeup: {
      to: 'Neha Kulkarni and the budget round', subject: 'Hiring plan — the numbers behind it', maxWords: 200,
      prompt: 'The plan. A number, its basis, its limits, and where the real decision is.',
      rubric: [
        { key: 'number', label: 'A planning number, in the first line', markers: ['seven|7|six|eight|around|about'], why: 'She has twenty minutes in that room. Lead with the thing she has to say.' },
        { key: 'basis', label: 'What it is built on', markers: ['average|last three|2023|2024|2025|ten year|history|recent'], why: 'Two methods agreeing is the strongest sentence in the note. Say both.' },
        { key: 'attrition', label: 'Whether it replaces leavers or grows headcount', markers: ['attrition|leaver|replace|net|grow|steady|hold'], why: 'The same seven means two different budgets. Finance will find this gap if you leave it.' },
        { key: 'split', label: 'Where the hires have actually been going', markers: ['people ops|engineering|sales|department|split|mix|allocat'], why: 'Seven of People Ops\'s nine joined since 2023. That is the finding a plan can actually act on.' },
        { key: 'limit', label: 'One thing this cannot tell her', markers: ['cannot|can\'t|does not|doesn\'t|attrition|six|small|thin|2021|2022|assume'], why: 'Volunteering the limit before Finance finds it is what makes the rest credible.' },
        { key: 'scope', label: 'Which population the numbers describe', markers: ['ever hired|intake|current|leaver|includ|69|63'], why: 'Finance has 63 and you have 69. Label it or spend the meeting on it.' },
      ],
    },
    estHours: 0.6, priority: 'high', dueInDays: 5, day: 5, difficulty: 'hard',
  },

  // ---- Senior track -----------------------------------------------------------------
  // The user was explicit that junior and senior differ by PROJECT, not by the same
  // brief written vaguer. So these are different questions, not harder wording: they
  // ask for a rate rather than a total, make the learner decide what to exclude, and
  // end with a recommendation the data does not hand them.
  'sa-001': {
    title: 'Time to resolve, by service',
    // What a colleague who knows you would point at — the trap, never the answer.
    hint: "An incident with no resolved_at can't contribute to an average of resolution times. Decide what that means for your COUNT as well.",
    brief: "Engineering leadership wants to know which service is costing us the most time when it breaks — not how often it breaks. Write ONE SQL SELECT query returning, per service, how many incidents you counted and the average hours from start to resolution, slowest first. The judgement call is yours: some incidents are still open, and an incident with no resolution time cannot contribute to an average of resolution times. Decide what to do with them and make sure your count reflects that decision — a count of all incidents beside an average of only the closed ones is the kind of table that gets quietly believed and is wrong.",
    referenceSql: "SELECT service, COUNT(*) AS incidents, AVG((julianday(resolved_at) - julianday(started_at)) * 24) AS avg_hours FROM incidents WHERE resolved_at IS NOT NULL GROUP BY service ORDER BY avg_hours DESC",
    datasetKey: 'saas_ops',
    tool: 'sql',
    estHours: 0.5,
    priority: 'high',
    dueInDays: 2,
    day: 1,
    difficulty: 'hard',
  },
  'sa-002': {
    title: 'Support load against revenue',
    // What a colleague who knows you would point at — the trap, never the answer.
    hint: "LEFT JOIN, so an account with no tickets still shows. And check the status filter — one client isn't with us any more.",
    brief: "Finance wants to know which accounts cost more to support than they are worth. Write ONE SQL SELECT query returning, for every ACTIVE client, their company, tier, monthly recurring revenue, how many tickets they have raised, and tickets per 100,000 of MRR — heaviest support load per revenue first. One account has already churned — it is still in the table and it has raised tickets, so leaving the status filter out puts a customer we no longer have into a pricing decision. Use a LEFT JOIN so an account with no tickets would still appear with a zero, and watch the division: without a decimal, some engines will hand you integers.",
    referenceSql: "SELECT c.company, c.tier, c.mrr, COUNT(t.id) AS tickets, (COUNT(t.id) * 100000.0) / c.mrr AS tickets_per_100k FROM clients c LEFT JOIN tickets t ON t.client_id = c.id WHERE c.status = 'active' GROUP BY c.id, c.company, c.tier, c.mrr ORDER BY tickets_per_100k DESC",
    datasetKey: 'saas_ops',
    tool: 'sql',
    estHours: 0.6,
    priority: 'high',
    dueInDays: 3,
    day: 1,
    difficulty: 'hard',
  },
  'sa-003': {
    title: 'Unresolved backlog by client',
    // What a colleague who knows you would point at — the trap, never the answer.
    hint: "'Not resolved' covers open AND pending. Counting only 'open' understates every account.",
    brief: "Before the quarterly business reviews, Customer Success needs to know who is walking in angry. Write ONE SQL SELECT query returning, for each ACTIVE client, their company, tier, how many tickets are still open or pending, and how many SEV1 incidents they have taken — worst backlog first. 'Not resolved' covers both open and pending; treating pending as handled is how a QBR goes badly.",
    referenceSql: "SELECT c.company, c.tier, SUM(CASE WHEN t.status IN ('open','pending') THEN 1 ELSE 0 END) AS unresolved_tickets, (SELECT COUNT(*) FROM incidents i WHERE i.client_id = c.id AND i.severity = 'SEV1') AS sev1_incidents FROM clients c LEFT JOIN tickets t ON t.client_id = c.id WHERE c.status = 'active' GROUP BY c.id, c.company, c.tier ORDER BY unresolved_tickets DESC",
    datasetKey: 'saas_ops',
    tool: 'sql',
    estHours: 0.4,
    priority: 'medium',
    dueInDays: 4,
    day: 3,
    difficulty: 'medium',
  },
  'sa-004': {
    title: 'Where the engineering time went',
    // What a colleague who knows you would point at — the trap, never the answer.
    hint: "Median and worst case, not average. The tail is the thing the platform team is arguing about.",
    brief: "The platform team is arguing about where to spend next quarter. Averages hide the outliers, so they want the shape of it: for each severity, the number of RESOLVED incidents, the median hours to resolve, and the single worst case. The dataset is loaded for you as `tables` — a dict of table name to a list of plain dict rows; timestamps are ISO 8601 strings. SQLite has no median, which is why this one is Python. Return a list of dicts with keys `severity`, `resolved`, `median_hours` and `worst_hours`, sorted by median hours highest first. Standard library only, no pandas. Assign your answer to `result`.",
    referenceCompute: (tables) => {
      const bySev = new Map();
      for (const i of tables.incidents) {
        if (!i.resolved_at) continue;
        const hours = (Date.parse(i.resolved_at) - Date.parse(i.started_at)) / 3600000;
        if (!bySev.has(i.severity)) bySev.set(i.severity, []);
        bySev.get(i.severity).push(hours);
      }
      const median = (xs) => {
        const a = [...xs].sort((x, y) => x - y);
        const mid = Math.floor(a.length / 2);
        return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
      };
      return [...bySev.entries()]
        .map(([severity, hs]) => ({
          severity,
          resolved: hs.length,
          median_hours: median(hs),
          worst_hours: Math.max(...hs),
        }))
        .sort((a, b) => b.median_hours - a.median_hours);
    },
    datasetKey: 'saas_ops',
    tool: 'python',
    estHours: 0.6,
    priority: 'medium',
    dueInDays: 4,
    day: 3,
    difficulty: 'hard',
  },
  'da-005': {
    title: 'Median pay by department',
    // What a colleague who knows you would point at — the trap, never the answer.
    hint: "SQLite has no median, which is the whole reason this one is Python. statistics.median is right there.",
    brief: "Averages are being skewed by a handful of very senior people, so Asha wants the MEDIAN salary per department instead — the midpoint, which a couple of large salaries cannot drag around. SQLite has no MEDIAN function, which is exactly why this one is a Python task. The dataset is already loaded for you as `tables` — a dict of table name to a list of plain dict rows. Produce a list of dicts, one per department, each containing the department NAME, its median salary, and its current headcount, sorted by median salary highest first. The standard library is available (`statistics.median` is the obvious tool); there is no pandas. Current employees only. Assign your answer to a variable called `result`.",
    // No referenceSql: this is the point of the task. The expected answer is computed
    // here, in JavaScript, from the same rows the notebook receives — so it stays an
    // independent oracle rather than being whatever the learner's code happened to say.
    referenceCompute: (tables) => {
      const deptName = new Map(tables.departments.map((d) => [d.id, d.name]));
      const byDept = new Map();
      for (const e of tables.employees) {
        if (e.exit_year !== null && e.exit_year !== undefined) continue;
        const name = deptName.get(e.department_id);
        if (!byDept.has(name)) byDept.set(name, []);
        byDept.get(name).push(e.salary);
      }
      const median = (xs) => {
        const a = [...xs].sort((x, y) => x - y);
        const mid = Math.floor(a.length / 2);
        return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
      };
      return [...byDept.entries()]
        .map(([department, sals]) => ({ department, median_salary: median(sals), headcount: sals.length }))
        .sort((a, b) => b.median_salary - a.median_salary);
    },
    datasetKey: 'hr_core',
    tool: 'python',
    estHours: 0.5,
    priority: 'medium',
    dueInDays: 4,
    // Opens on working day 3 of the project week.
    day: 3,
    difficulty: 'medium',
  },
};

function now() { return new Date().toISOString(); }
function today() { return new Date().toISOString().slice(0, 10); }

function getEnrollment(userId) {
  return db.prepare('SELECT * FROM sim_enrollments WHERE user_id = ? ORDER BY created_at DESC LIMIT 1').get(userId);
}

function addMessage(enrollmentId, senderArchetype, senderName, body, taskId, subject, threadArchetype) {
  const id = cryptoRandomId();
  db.prepare(`
    INSERT INTO sim_messages (id, enrollment_id, sender_archetype, sender_name, body, task_id, subject, thread_archetype, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, enrollmentId, senderArchetype, senderName, body, taskId || null, subject || null, threadArchetype || senderArchetype, now());
  return id;
}

// `weekStart` is the project's day 1. A task belonging to day 3 opens two working days
// after that, so the week arrives in instalments the way real work does rather than as
// a wall of thirty tasks on Monday morning.
function assignTask(enrollmentId, taskKey, weekStart) {
  const def = TASKS[taskKey];
  if (!def) throw new Error('Unknown task: ' + taskKey);
  const id = cryptoRandomId();
  const assignedAt = now();
  const opensAt = weekStart && def.day
    ? addWorkingDays(weekStart, def.day).toISOString()
    : null;
  // A real deadline, set when the work is handed over — that's what makes "due today",
  // "overdue" and the on-time rate computable rather than decorative. Rows written
  // before this column existed get the same deadline reconstructed at read time from
  // assigned_at + dueInDays (see getTasksView).
  const dueAt = def.dueInDays
    ? new Date(Date.parse(assignedAt) + def.dueInDays * 24 * 60 * 60 * 1000).toISOString()
    : null;
  db.prepare(`
    INSERT INTO sim_tasks (id, enrollment_id, task_key, title, brief, status, assigned_at, est_hours, priority, due_at, day_index, opens_at, difficulty)
    VALUES (?, ?, ?, ?, ?, 'assigned', ?, ?, ?, ?, ?, ?, ?)
  `).run(id, enrollmentId, taskKey, def.title, def.brief, assignedAt, def.estHours || null, def.priority || 'medium', dueAt,
         def.day || null, opensAt, def.difficulty || null);
  return id;
}

// Starts a learner's Virtual Workspace program. No payment check here yet —
// /api/subscribe is still the Phase 0 dev-mode stub; this just records the
// configuration choices from the HR session (role/level/schedule) so billing
// can be wired in later without a schema change.
function startEnrollment(userId, { level, scheduleType, scheduleDays }) {
  const existing = getEnrollment(userId);
  if (existing && existing.status !== 'ended') {
    // Re-enrolling used to return the old row and silently discard the level you just
    // picked — so choosing Senior on an account that started Junior looked like the two
    // levels shared a catalogue. They do not; the choice was being thrown away.
    //
    // Before any work is graded, changing your mind is legitimate and the switch is
    // honoured. Once work is graded it is not a setup choice any more, it is a transfer,
    // and it happens through promotion rather than by re-running the form.
    if (level && level !== existing.level) {
      const graded = db.prepare("SELECT COUNT(*) c FROM sim_tasks WHERE enrollment_id = ? AND status = 'graded'")
        .get(existing.id).c;
      if (graded > 0) {
        throw new Error(`You're already enrolled as a ${existing.level === 'senior' ? 'Senior' : 'Junior'} Data Analyst and have graded work on record. Moving up a level happens through the promotion round, not by starting again.`);
      }
      // No graded work: wipe the unstarted assignment and re-issue at the new level.
      db.prepare('DELETE FROM sim_tasks WHERE enrollment_id = ?').run(existing.id);
      db.prepare('DELETE FROM sim_project_runs WHERE enrollment_id = ?').run(existing.id);
      db.prepare('UPDATE sim_enrollments SET level = ? WHERE id = ?').run(level, existing.id);
      const fresh = getEnrollment(userId);
      addMessage(fresh.id, 'people_partner', PEOPLE_PARTNER_NAME,
        `Your level has been changed to ${level === 'senior' ? 'Senior' : 'Junior'} Data Analyst. Asha will assign work at that level — nothing was lost, you hadn't been graded on anything yet.`,
        null, 'Level updated');
      if (fresh.baseline_at) beginNextProject(fresh);
      return getEnrollment(userId);
    }
    return existing;
  }

  const role = 'data_analyst'; // only role built in P0
  const track = 'ic'; // manager track needs team assembly — P2
  const trialEndsAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
  const id = cryptoRandomId();
  db.prepare(`
    INSERT INTO sim_enrollments (id, user_id, role, level, track, schedule_type, schedule_days_json, status, trial_ends_at, checklist_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'trial', ?, '{}', ?)
  `).run(id, userId, role, level, track, scheduleType, JSON.stringify(scheduleDays || null), trialEndsAt, now());

  addMessage(id, 'people_partner', PEOPLE_PARTNER_NAME,
    `Welcome to TenzorGrid! I'm ${PEOPLE_PARTNER_NAME} from People Ops. You're joining as a ${level === 'senior' ? 'Senior' : 'Junior'} Data Analyst. Your Line Manager is Asha Rao — she'll get you started. Ping me any time about policy or onboarding.`);
  // Day one is the skill test, not the first task. The learner asked for this ordering
  // and their reasoning was better than mine: the test is the BASELINE for the skill
  // matrix. Without it, "your SQL improved" is a claim with nothing behind it.
  addMessage(id, 'line_manager', LINE_MANAGER_NAME,
    "Hi, welcome to the team. Before I hand you a project, I'd like a quick read on where you're strong — there's a short skills check on your dashboard, about fifteen minutes. It isn't a pass/fail: I use it to pitch your first project at the right level, and you'll be able to watch these numbers move as you deliver work.");

  return getEnrollment(userId);
}

function shiftDay(dateStr, delta) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

// Consecutive check-in days, from real attendance rows only. The current streak is
// still alive if the learner checked in today OR yesterday — breaking it the moment
// today starts would punish someone who simply hasn't logged in yet this morning.
// A project week is five WORKING days. Weekends are skipped rather than counted, so a
// learner who starts on a Thursday gets Thu, Fri, Mon, Tue, Wed — not Thu to Monday.
// Their own start day counts as day 1: waiting until next Monday to begin would kill
// the momentum of having just signed up.
function isWeekend(d) {
  const day = d.getUTCDay();
  return day === 0 || day === 6;
}

// The date `n` working days after `fromIso`, counting the start date as day 1.
function addWorkingDays(fromIso, n) {
  const d = new Date(fromIso);
  d.setUTCHours(0, 0, 0, 0);
  // If they start on a weekend, the week begins on the next working day.
  while (isWeekend(d)) d.setUTCDate(d.getUTCDate() + 1);
  let counted = 1;
  while (counted < n) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (!isWeekend(d)) counted += 1;
  }
  return d;
}

const PROJECT_WEEK_DAYS = 5;

function computeStreaks(days) {
  if (!days.length) return { current: 0, longest: 0 };
  const attended = new Set(days);

  let longest = 0, run = 0, prev = null;
  for (const day of days) {
    run = prev && shiftDay(prev, 1) === day ? run + 1 : 1;
    if (run > longest) longest = run;
    prev = day;
  }

  const todayStr = today();
  let cursor = attended.has(todayStr) ? todayStr : shiftDay(todayStr, -1);
  let current = 0;
  while (attended.has(cursor)) { current += 1; cursor = shiftDay(cursor, -1); }

  return { current, longest };
}

// The learner's own best-ever grade — self-referential progress, which (unlike peer
// ranking) stays motivating whether they're top of the cohort or not.
function computePersonalBest(gradedTasks) {
  if (!gradedTasks.length) return null;
  const best = gradedTasks.reduce((a, b) => ((b.score || 0) > (a.score || 0) ? b : a));
  return { score: best.score, title: best.title, date: best.graded_at };
}

// Asha's real grading feedback on work that actually scored well. Never synthesized —
// if nothing has cleared the bar yet the card says so honestly.
function getShoutouts(gradedTasks) {
  return gradedTasks
    .filter((t) => (t.score || 0) >= SHOUTOUT_SCORE && t.feedback)
    .sort((a, b) => (b.graded_at || '').localeCompare(a.graded_at || ''))
    .slice(0, 3)
    .map((t) => ({ taskId: t.id, title: t.title, score: t.score, feedback: t.feedback, date: t.graded_at, from: LINE_MANAGER_NAME }));
}

// Today's AI spend for one enrollment, derived from rows we already write: a graded
// task means a grading call, a learner-sent message means a reply call.
function countTodaysAiUse(enrollmentId) {
  const todayStr = today();
  // Only the task types that actually cost an AI call are counted. Grading a query or a
  // notebook calls the model three times over (mark it, ask the review question, judge the
  // answer); a chart, a judgement and a write-up are all graded deterministically and only
  // touch the model once, at sign-off. Charging them at the same rate meant a learner
  // doing the intended six-task day could be locked out by work that cost nothing.
  const AI_GRADED = new Set(['sql', 'python']);
  const submissions = db.prepare(
    "SELECT task_key FROM sim_tasks WHERE enrollment_id = ? AND status = 'graded' AND substr(graded_at, 1, 10) = ?"
  ).all(enrollmentId, todayStr)
    .filter((r) => AI_GRADED.has((TASKS[r.task_key] || {}).tool || 'sql')).length;
  // The stand-up is excluded: this cap exists to bound AI SPEND, and the stand-up is
  // scripted and answered without an AI call. Charging it against the chat allowance
  // would mean doing the daily ritual costs you a question you might need later.
  const messages = db.prepare(
    "SELECT COUNT(*) AS c FROM sim_messages WHERE enrollment_id = ? AND sender_archetype = 'learner' AND task_id IS NULL AND substr(created_at, 1, 10) = ? AND (subject IS NULL OR subject NOT LIKE 'Stand-up —%')"
  ).get(enrollmentId, todayStr).c;
  return { submissions, messages };
}

// `baseline` is the entry skill test, when one was taken. It is what turns the matrix
// from a snapshot into evidence: the learner can point at the movement, which is the
// thing an interview or a salary conversation actually needs.
//
// An axis the test did not cover, or that no graded task has exercised, stays null and
// reports no movement. A delta computed against nothing is worse than no delta.
function getSkillMatrix(gradedTasks, baseline) {
  const sums = {}, counts = {};
  for (const axis of SKILL_AXES) { sums[axis] = 0; counts[axis] = 0; }
  for (const t of gradedTasks) {
    if (!t.skills_json) continue;
    const skills = JSON.parse(t.skills_json);
    for (const axis of SKILL_AXES) {
      if (typeof skills[axis] === 'number') { sums[axis] += skills[axis]; counts[axis] += 1; }
    }
  }
  const base = (baseline && baseline.skills) || {};
  return SKILL_AXES.map((axis) => {
    const hasData = counts[axis] > 0;
    const value = hasData ? Math.round(sums[axis] / counts[axis]) : 0;
    const start = typeof base[axis] === 'number' ? base[axis] : null;
    return {
      axis,
      label: SKILL_AXIS_LABEL[axis],
      value,
      hasData,
      baseline: start,
      // Movement is only real when there are two real numbers to subtract.
      delta: hasData && start !== null ? value - start : null,
    };
  });
}

function gradeLetter(score) {
  return (GRADE_BANDS.find((b) => score >= b.min) || GRADE_BANDS[GRADE_BANDS.length - 1]).letter;
}

// Skill points earned by a set of graded tasks, per axis. An axis the grader had no
// basis to judge comes back null in skills_json and contributes nothing at all — it is
// never counted as a zero, which would quietly drag the total down.
function skillPointsFor(gradedTasks) {
  const points = {};
  for (const axis of SKILL_AXES) points[axis] = 0;
  for (const t of gradedTasks) {
    if (!t.skills_json) continue;
    let skills;
    try { skills = JSON.parse(t.skills_json); } catch { continue; }
    for (const axis of SKILL_AXES) {
      if (typeof skills[axis] === 'number') points[axis] += skills[axis] * SKILL_POINTS_PER_SCORE;
    }
  }
  return points;
}

function round1(n) { return Math.round(n * 10) / 10; }

// Everything the Projects tab renders, derived entirely from the learner's own task
// rows. A project is `active` once its tasks are assigned, `completed` when every one of
// them is graded, `available` when its unlock gate is cleared, and `locked` until then.
// Nothing here is assumed: a learner who has finished nothing gets zeroes and empty
// states, not a populated-looking dashboard.
// `enrollmentId` is optional — when given, each project also carries its real deadline
// and the state of everyone else working on it.
// The learner's place in a project that other people are also working on.
//
// This is what turns a task list into a job. The data engineer finished on Monday
// whether or not the learner showed up; the person downstream cannot start until the
// learner delivers. Seeing your own segment sitting unfinished between two that are
// done is a far stronger signal than any score.
//
// The named colleagues here are participants in the authored scenario, not members of
// the messageable roster — nothing offers to chat to them, because nothing can.
function projectWeek(run, def, taskRows, nowMs) {
  if (!run) return null;

  const dayNow = projectDayOn(run.started_at, nowMs);
  const dueMs = Date.parse(run.due_at);
  const overdueDays = nowMs > dueMs ? Math.floor((nowMs - dueMs) / DAY_MS) : 0;
  // Counted in WORKING days, because that is the unit the week itself is in. Reporting
  // "7 days left" beside "day 1 of 5" is the kind of small contradiction that makes a
  // learner stop trusting every other number on the page.
  const daysLeft = overdueDays ? 0 : Math.max(0, PROJECT_WEEK_DAYS - dayNow);

  const total = def.taskKeys.length;
  const done = taskRows.filter((t) => t.status === 'graded').length;
  const learnerPct = total ? Math.round((done / total) * 100) : 0;
  const learnerDone = total > 0 && done === total;

  // "6 of 7 signed off" was true and unhelpful: the seventh was a later-day task showing
  // as "Opens later" on the board, so the learner counted six and thought the total was
  // wrong. The number has to explain itself — say how much is outstanding AND when it
  // becomes workable, or a correct figure reads as a bug.
  const outstanding = taskRows.filter((t) => t.status !== 'graded');
  // Openness has to be decided by exactly the rule the task board uses, or this note
  // contradicts the screen it sits next to. A task is workable once its day has ARRIVED
  // on the calendar or been EARNED by finishing the day before — counting only the
  // calendar made every task on a fresh Monday read as "not open yet", and the card then
  // congratulated the learner for being up to date on a day they had not started.
  const unlocked = unlockedDay({ id: run.enrollment_id }, run);
  const notYetOpen = outstanding.filter((t) => !taskIsOpen(t, unlocked, nowMs));
  const workable = outstanding.length - notYetOpen.length;
  const nextOpensAt = notYetOpen.length
    ? notYetOpen.map((t) => Date.parse(t.opens_at)).sort((a, b) => a - b)[0]
    : null;
  const opensLabel = nextOpensAt
    ? new Date(nextOpensAt).toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' })
    : null;

  let learnerNote;
  if (learnerDone) {
    learnerNote = 'Delivered';
  } else if (!workable && notYetOpen.length) {
    // Everything available is done and the rest is waiting on its day. Saying so is the
    // difference between "you are behind" and "you are up to date".
    learnerNote = `${done} of ${total} — ${notYetOpen.length === 1 ? 'the last one opens' : `${notYetOpen.length} more open`} ${opensLabel}`;
  } else if (notYetOpen.length) {
    learnerNote = `${done} of ${total} signed off · ${notYetOpen.length} not open yet`;
  } else {
    learnerNote = `${done} of ${total} signed off`;
  }

  const contributors = (def.contributors || []).map((c) => {
    const isLearner = c.name === null;
    if (isLearner) {
      return {
        name: null, role: c.role, does: c.does,
        state: learnerDone ? 'done' : 'in-progress',
        pct: learnerPct,
        note: learnerNote,
      };
    }
    // A colleague whose work comes BEFORE the learner's is done once their day has
    // passed. One who depends on the learner is blocked until the learner delivers —
    // and says so, by name.
    // Someone who picks the work up on day 5 is not yet BLOCKED on day 1 — they are
    // simply next. Calling them blocked from the first morning would cry wolf, and a
    // warning that is always on is a warning nobody reads. They turn red only once their
    // own day has arrived or the project is late.
    if (c.needsYou) {
      if (learnerDone) {
        return { name: c.name, role: c.role, does: c.does, state: 'done', pct: 100,
                 note: 'Picked it up from your analysis' };
      }
      const stuck = overdueDays > 0 || dayNow >= (c.day || PROJECT_WEEK_DAYS);
      return {
        name: c.name, role: c.role, does: c.does,
        state: stuck ? 'blocked' : 'waiting',
        pct: 0,
        note: stuck ? 'Waiting on your numbers' : `Picks it up on day ${c.day || PROJECT_WEEK_DAYS}`,
      };
    }
    const started = dayNow >= (c.day || 1);
    return {
      name: c.name, role: c.role, does: c.does,
      state: started ? 'done' : 'scheduled',
      pct: started ? 100 : 0,
      note: started ? 'Done' : `Starts day ${c.day || 1}`,
    };
  });

  return {
    day: dayNow,
    totalDays: PROJECT_WEEK_DAYS,
    dueAt: run.due_at,
    daysLeft,
    overdueDays,
    onTrack: !overdueDays,
    // Everything available is finished and the rest is waiting on its day — the learner
    // is up to date, not behind, and the card should say which.
    allCaughtUp: !learnerDone && workable === 0 && notYetOpen.length > 0,
    waitingOn: notYetOpen.length,
    waitingUntil: opensLabel,
    // Named so the UI can say WHO is held up, not just that something is.
    blocking: !learnerDone
      ? contributors.filter((c) => c.state === 'blocked').map((c) => c.name).filter(Boolean)
      : [],
    contributors,
  };
}

// Is a project actually finished being WRITTEN?
//
// A project with two authored tasks and no activities presented itself as a five-day week,
// and then behaved like one: a day with zero activities and zero situations completes the
// moment its tasks do, so the learner was rolled through "day 2 of 5" above an empty board
// with a blank Today tab. That was three separate bug reports with one cause.
//
// So the shape is now checked at the door. A project that is not fully authored is shown
// as being written and cannot be started at all, which is both honest and impossible to
// get wrong later: authoring the content is what makes a project startable, and there is
// no second place to remember to update.
function projectReadiness(def) {
  const missing = [];
  const tasks = (def.taskKeys || []).length;
  const acts = dayitems.activitiesFor(def.key).length;
  const sits = dayitems.situationsFor(def.key).length;
  const quiz = dayitems.quizFor(def.key);
  if (tasks < PROJECT_WEEK_DAYS * DAY_SHAPE.tasks) missing.push(`${tasks}/${PROJECT_WEEK_DAYS * DAY_SHAPE.tasks} tasks`);
  if (acts < PROJECT_WEEK_DAYS * DAY_SHAPE.activities) missing.push(`${acts}/${PROJECT_WEEK_DAYS * DAY_SHAPE.activities} activities`);
  if (sits < PROJECT_WEEK_DAYS * DAY_SHAPE.situations) missing.push(`${sits}/${PROJECT_WEEK_DAYS * DAY_SHAPE.situations} situations`);
  if (!quiz) missing.push('no quiz');
  return { ready: missing.length === 0, missing };
}

function getProjects(role, tasks, streaks, enrollmentId, level) {
  const catalog = catalogFor(role, level, touchedProjectKeys(role, tasks));
  const byKey = {};
  for (const t of tasks) (byKey[t.task_key] = byKey[t.task_key] || []).push(t);

  const nowMs = Date.now();
  const runsByKey = {};
  if (enrollmentId) {
    for (const r of db.prepare('SELECT * FROM sim_project_runs WHERE enrollment_id = ?').all(enrollmentId)) {
      runsByKey[r.project_key] = r;
    }
  }

  // Pass 1 — real progress per project, independent of any unlock rule.
  const base = catalog.map((def) => {
    const taskRows = def.taskKeys.flatMap((k) => byKey[k] || []);
    const graded = taskRows.filter((t) => t.status === 'graded');
    const started = taskRows.length > 0;
    const completed = started && graded.length === def.taskKeys.length;

    // A graded task counts in full, one submitted but not yet graded counts half.
    const weighted = taskRows.reduce((sum, t) => sum + (t.status === 'graded' ? 1 : t.submission ? 0.5 : 0), 0);
    const progressPct = def.taskKeys.length ? Math.round((weighted / def.taskKeys.length) * 100) : 0;

    const avg = graded.length ? Math.round(graded.reduce((s, t) => s + (t.score || 0), 0) / graded.length) : null;
    const openTask = taskRows.find((t) => t.status !== 'graded');

    return {
      def,
      started,
      completed,
      progressPct,
      week: started ? projectWeek(runsByKey[def.key], def, taskRows, nowMs) : null,
      avgScore: avg,
      grade: avg === null ? null : gradeLetter(avg),
      // The phase is the task actually open right now, not an invented milestone name.
      phase: openTask ? openTask.title : completed ? 'Delivered' : null,
      skillPoints: skillPointsFor(graded),
      // Same float-summing trap as the workload card — round where it is computed.
      estHours: Math.round(def.taskKeys.reduce((s, k) => s + ((TASKS[k] && TASKS[k].estHours) || 0), 0) * 10) / 10,
      tasks: taskRows.map((t) => ({
        id: t.id, title: t.title, status: t.status, score: t.score,
        feedback: t.feedback, submittedAt: t.submitted_at,
      })),
    };
  });

  const completedCount = base.filter((p) => p.completed).length;

  const projects = base.map((p) => {
    const unlocked = completedCount >= p.def.unlockAfter;
    const ready = projectReadiness(p.def);
    // 'writing' outranks 'available' but never overrides a project already under way —
    // a learner mid-project must not have it pulled out from under them.
    const status = p.completed ? 'completed'
      : p.started ? 'active'
      : !ready.ready ? 'writing'
      : unlocked ? 'available' : 'locked';
    return {
      key: p.def.key,
      title: p.def.title,
      description: p.def.description,
      kind: p.def.kind,
      difficulty: p.def.difficulty,
      stakeholderArchetype: p.def.stakeholder,
      skillFocus: p.def.skillFocus.map((axis) => ({ axis, label: SKILL_AXIS_LABEL[axis] })),
      impactValue: p.def.impactValue,
      estHours: p.estHours,
      status,
      progressPct: p.progressPct,
      week: p.week,
      phase: p.phase,
      avgScore: p.avgScore,
      grade: p.grade,
      // Only what this project actually moved, so an empty project shows no tags.
      skillsGained: SKILL_AXES
        .filter((axis) => p.skillPoints[axis] > 0)
        .map((axis) => ({ axis, label: SKILL_AXIS_LABEL[axis], points: round1(p.skillPoints[axis]) })),
      tasks: p.tasks,
      // What is actually standing between the learner and this project.
      requirement: !ready.ready ? 'Still being written — not ready to start yet'
        : unlocked ? null
        : `Complete ${p.def.unlockAfter} project${p.def.unlockAfter === 1 ? '' : 's'} first`,
      // Only useful to us, but visible in the state so a test can say exactly what is
      // missing rather than just that something is.
      authoring: ready.ready ? null : ready.missing,
      unlockAfter: p.def.unlockAfter,
    };
  });

  const gradedAll = tasks.filter((t) => t.status === 'graded');
  const pointsByAxis = skillPointsFor(gradedAll);
  const skillPoints = SKILL_AXES
    .map((axis) => ({ axis, label: SKILL_AXIS_LABEL[axis], points: round1(pointsByAxis[axis]) }))
    .filter((s) => s.points > 0);
  const skillPointsTotal = round1(skillPoints.reduce((s, a) => s + a.points, 0));

  // Impact only ever counts finished work. Nothing is banked for a project in flight.
  const totalImpact = projects.filter((p) => p.status === 'completed').reduce((s, p) => s + p.impactValue, 0);

  // The stakeholder behind the most projects the learner has actually touched.
  const stakeholderCounts = {};
  for (const p of projects) {
    if (p.status === 'locked' || p.status === 'available') continue;
    stakeholderCounts[p.stakeholderArchetype] = (stakeholderCounts[p.stakeholderArchetype] || 0) + 1;
  }
  const topArchetype = Object.keys(stakeholderCounts).sort((a, b) => stakeholderCounts[b] - stakeholderCounts[a])[0] || null;
  const topStakeholder = topArchetype ? (ROSTER.find((r) => r.archetype === topArchetype) || {}).name || null : null;

  const bestScore = gradedAll.reduce((best, t) => Math.max(best, t.score || 0), 0);
  const badges = [
    { key: 'first-delivery', label: 'First Delivery', note: 'Complete your first project', earned: completedCount >= 1 },
    { key: 'top-marks', label: 'Top Marks', note: 'Score 90 or above on a task', earned: bestScore >= 90 },
    { key: 'streak-keeper', label: 'Streak Keeper', note: 'Check in 5 days in a row', earned: (streaks.longest || 0) >= 5 },
    { key: 'full-sweep', label: 'Full Sweep', note: 'Complete every project in the track', earned: catalog.length > 0 && completedCount === catalog.length },
  ];

  return {
    projects,
    skillPoints,
    skillPointsTotal,
    totalImpact,
    topStakeholder,
    badges,
    activeCount: projects.filter((p) => p.status === 'active').length,
    completedCount,
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;
const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };
const PRIORITY_LABEL = { high: 'High', medium: 'Medium', low: 'Low' };

function startOfDay(ms) {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

// Whole calendar days from now until a deadline: 0 is today, 1 tomorrow, negative overdue.
function daysUntil(dueAt, nowMs) {
  return Math.round((startOfDay(Date.parse(dueAt)) - startOfDay(nowMs)) / DAY_MS);
}

function dueLabel(dueAt, nowMs) {
  const d = daysUntil(dueAt, nowMs);
  if (d < 0) return `Overdue by ${Math.abs(d)} day${Math.abs(d) === 1 ? '' : 's'}`;
  if (d === 0) return 'Today';
  if (d === 1) return 'Tomorrow';
  if (d <= 6) return new Date(Date.parse(dueAt)).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
  return new Date(Date.parse(dueAt)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

// The Productivity score deliberately blends three different real signals rather than
// restating grade quality, which the Overview's Performance Score already reports on its
// own — a second card showing the same number would be noise:
//   Quality     50%  average grade across graded tasks
//   Timeliness  30%  share of deliveries that met their deadline
//   Consistency 20%  days checked in across the last fortnight
// Quality carries the most weight because it measures the work itself; timeliness is
// professional behaviour around that work; consistency is the habit underneath both.
const PRODUCTIVITY_PARTS = [
  { key: 'quality', label: 'Quality', note: 'Average grade', weight: 0.5 },
  { key: 'timeliness', label: 'Timeliness', note: 'Met the deadline', weight: 0.3 },
  { key: 'consistency', label: 'Consistency', note: 'Check-ins, last 14 days', weight: 0.2 },
];
const CONSISTENCY_WINDOW_DAYS = 14;
// Below this there simply isn't enough history to call something a habit, so consistency
// stays absent rather than scoring a brand-new learner down for days they never had.
const CONSISTENCY_MIN_DAYS = 3;

function consistencyAt(attendanceDays, enrollStartMs, atMs) {
  const elapsed = Math.floor((startOfDay(atMs) - startOfDay(enrollStartMs)) / DAY_MS) + 1;
  if (elapsed < CONSISTENCY_MIN_DAYS) return null;
  const windowDays = Math.min(CONSISTENCY_WINDOW_DAYS, elapsed);
  const windowStart = startOfDay(atMs) - (windowDays - 1) * DAY_MS;
  const attended = attendanceDays.filter((d) => {
    const ms = Date.parse(`${d}T00:00:00Z`);
    return ms >= windowStart && ms <= startOfDay(atMs);
  }).length;
  return Math.round((attended / windowDays) * 100);
}

// A component with no data yet is left out and the remaining weights are renormalised, so
// a learner is never marked down for a signal they haven't had the chance to produce. With
// nothing to go on at all the score is null rather than zero.
function productivityAt(gradedUpTo, deliveriesUpTo, attendanceDays, enrollStartMs, atMs) {
  const values = {
    quality: gradedUpTo.length
      ? Math.round(gradedUpTo.reduce((s, t) => s + (t.score || 0), 0) / gradedUpTo.length)
      : null,
    timeliness: deliveriesUpTo.length
      ? Math.round((deliveriesUpTo.filter((d) => d.outcome === 'onTime').length / deliveriesUpTo.length) * 100)
      : null,
    consistency: consistencyAt(attendanceDays, enrollStartMs, atMs),
  };

  const parts = PRODUCTIVITY_PARTS.map((p) => ({ ...p, value: values[p.key] }));
  const active = parts.filter((p) => p.value !== null);
  const totalWeight = active.reduce((s, p) => s + p.weight, 0);
  const score = totalWeight
    ? Math.round(active.reduce((s, p) => s + p.weight * p.value, 0) / totalWeight)
    : null;
  return { score, parts };
}

// Everything the Tasks tab shows. A task in this product is completed by submitting work
// and being graded — there is no "mark done" flag — so `stage` reports where the task
// genuinely is (Assigned -> Submitted -> Graded) rather than an invented percentage.
function getTasksView(role, tasks, projects, nowMs, attendanceDays, enrollStartMs, level, unlockedDayIndex) {
  const catalog = catalogFor(role, level, touchedProjectKeys(role, tasks));
  const projectByTaskKey = {};
  for (const p of catalog) {
    for (const k of p.taskKeys) projectByTaskKey[k] = p;
  }
  const projectStatus = Object.fromEntries(projects.projects.map((p) => [p.key, p]));

  const rows = tasks.map((t) => {
    const def = TASKS[t.task_key] || {};
    const proj = projectByTaskKey[t.task_key];
    const graded = t.status === 'graded';
    // A task belonging to a later day in the week is real, visible and dated — but not
    // yet workable. Showing it greyed with its day is what makes the week legible;
    // hiding it entirely would make the project look smaller than it is.
    // Two ways in, and either is enough. The clock opens a day when it arrives; finishing
    // the day before opens the next one immediately. Somebody who clears Monday by eleven
    // starts Tuesday at eleven rather than waiting for a product they are paying for — and
    // the deadline, which is what makes this a job, is still governed by the clock.
    const notYetOpen = !taskIsOpen(t, unlockedDayIndex, nowMs);
    const stage = graded ? 'Graded' : t.submission ? 'Submitted' : notYetOpen ? 'Opens later' : 'Assigned';
    const stagePct = graded ? 100 : t.submission ? 50 : 0;
    const priority = t.priority || def.priority || 'medium';

    // Tasks assigned before due_at existed still carry a deadline implicitly: dueInDays
    // is a fixed property of the task definition and assigned_at is a real recorded
    // timestamp, so this reconstructs the deadline the task always had rather than
    // inventing one. Without it, every account created before that column shipped would
    // show permanently empty health and on-time cards.
    const dueAt = t.due_at || (t.assigned_at && def.dueInDays
      ? new Date(Date.parse(t.assigned_at) + def.dueInDays * DAY_MS).toISOString()
      : null);

    let outcome = null; // only meaningful once there is a deadline to judge against
    if (dueAt) {
      if (graded) outcome = Date.parse(t.graded_at) <= Date.parse(dueAt) ? 'onTime' : 'late';
      else outcome = nowMs > Date.parse(dueAt) ? 'overdue' : 'inProgress';
    }

    return {
      id: t.id,
      title: t.title,
      brief: t.brief,
      status: t.status,
      // The score stays hidden until Asha signs the task off — see submitTask.
      score: t.review_state === 'pending' ? null : t.score,
      feedback: t.review_state === 'pending' ? null : t.feedback,
      reviewState: t.review_state || null,
      // Sent back by Asha. 'redo' means the work was weak; 'rework' means it was right and
      // she wants it done differently, which is a different message to put on a card.
      sentBack: t.review_state === 'redo' || t.review_state === 'rework' ? t.review_state : null,
      sentBackNote: t.review_state === 'redo' || t.review_state === 'rework' ? t.review_question : null,
      reviewQuestion: t.review_state === 'pending' ? t.review_question : null,
      reviewRoundsLeft: t.review_state === 'pending' ? Math.max(0, 2 - (t.review_rounds || 0)) : null,
      estHours: t.est_hours,
      gradedAt: t.graded_at || null,
      dayIndex: t.day_index || null,
      difficulty: t.difficulty || def.difficulty || null,
      notYetOpen,
      opensAt: t.opens_at || null,
      // "Opens Thursday" beats a locked padlock with no date — the learner should be able
      // to plan their week, not just be told to come back later.
      opensLabel: notYetOpen
        ? new Date(t.opens_at).toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' })
        : null,
      priority,
      priorityLabel: PRIORITY_LABEL[priority],
      dueAt,
      dueLabel: dueAt ? dueLabel(dueAt, nowMs) : null,
      overdue: outcome === 'overdue',
      outcome,
      stage,
      stagePct,
      projectKey: proj ? proj.key : null,
      projectTitle: proj ? proj.title : null,
    };
  });

  rows.sort((a, b) => {
    if ((a.status === 'graded') !== (b.status === 'graded')) return a.status === 'graded' ? 1 : -1;
    // Work you can actually start comes before work that has not opened yet.
    if (a.notYetOpen !== b.notYetOpen) return a.notYetOpen ? 1 : -1;
    if (a.notYetOpen && b.notYetOpen) return (a.dayIndex || 0) - (b.dayIndex || 0);
    const p = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (p) return p;
    return (a.dueAt || '').localeCompare(b.dueAt || '');
  });

  const open = rows.filter((r) => r.status !== 'graded');

  // Tasks sitting behind a project gate the learner hasn't cleared yet — a real lock,
  // with the real requirement attached, not a teaser.
  const locked = [];
  for (const p of catalog) {
    const st = projectStatus[p.key];
    if (!st || st.status !== 'locked') continue;
    for (const k of p.taskKeys) {
      const def = TASKS[k];
      if (!def) continue;
      locked.push({
        taskKey: k,
        title: def.title,
        brief: def.brief,
        priority: def.priority || 'medium',
        priorityLabel: PRIORITY_LABEL[def.priority || 'medium'],
        estHours: def.estHours || null,
        projectTitle: p.title,
        difficulty: p.difficulty,
        requirement: st.requirement,
      });
    }
  }

  // Health is only computed for tasks that actually carry a deadline; anything without
  // one is reported separately rather than being silently counted as on time.
  const withDeadline = rows.filter((r) => r.outcome);
  const healthCounts = { onTime: 0, late: 0, overdue: 0, inProgress: 0 };
  for (const r of withDeadline) healthCounts[r.outcome] += 1;
  const health = [
    { key: 'onTime', label: 'On time', value: healthCounts.onTime },
    { key: 'inProgress', label: 'In progress', value: healthCounts.inProgress },
    { key: 'late', label: 'Late', value: healthCounts.late },
    { key: 'overdue', label: 'Overdue', value: healthCounts.overdue },
  ].filter((s) => s.value > 0);

  // Turnaround: real hours from hand-over to grade, averaged per priority.
  const buckets = {};
  for (const t of tasks) {
    if (t.status !== 'graded' || !t.assigned_at || !t.graded_at) continue;
    const pr = t.priority || (TASKS[t.task_key] || {}).priority || 'medium';
    const minutes = (Date.parse(t.graded_at) - Date.parse(t.assigned_at)) / (60 * 1000);
    (buckets[pr] = buckets[pr] || []).push(minutes);
  }
  // Reported in minutes so a fast turnaround stays a real, visible value instead of
  // rounding to "0h"; the chart picks whether to render it as minutes or hours.
  const velocity = ['high', 'medium', 'low']
    .filter((p) => buckets[p] && buckets[p].length)
    .map((p) => ({
      priority: p,
      label: PRIORITY_LABEL[p],
      minutes: Math.round(buckets[p].reduce((s, m) => s + m, 0) / buckets[p].length),
      count: buckets[p].length,
    }));

  const delivered = rows
    .filter((r) => r.outcome === 'onTime' || r.outcome === 'late')
    .sort((a, b) => (a.gradedAt || '').localeCompare(b.gradedAt || ''));
  const onTimeRate = delivered.length
    ? Math.round((delivered.filter((d) => d.outcome === 'onTime').length / delivered.length) * 100)
    : null;

  const gradedRows = rows
    .filter((r) => r.status === 'graded' && r.gradedAt)
    .sort((a, b) => a.gradedAt.localeCompare(b.gradedAt));

  const productivity = productivityAt(gradedRows, delivered, attendanceDays, enrollStartMs, nowMs);

  // The trend is replayed, not stored: each point recomputes the score from only the
  // tasks and check-ins that existed at that moment, so the line is a real history rather
  // than today's score projected backwards.
  const trend = gradedRows
    .map((r, i) => {
      const atMs = Date.parse(r.gradedAt);
      const { score } = productivityAt(
        gradedRows.slice(0, i + 1),
        delivered.filter((d) => d.gradedAt && Date.parse(d.gradedAt) <= atMs),
        attendanceDays,
        enrollStartMs,
        atMs,
      );
      return { n: i + 1, score, title: r.title };
    })
    .filter((p) => p.score !== null);

  // Who the work actually comes from — real counts of who assigned and who graded,
  // not a ranking of simulated people against each other.
  const sources = {};
  for (const p of catalog) {
    for (const k of p.taskKeys) {
      if (!rows.some((r) => r.projectKey === p.key)) continue;
      const person = ROSTER.find((x) => x.archetype === p.stakeholder);
      if (!person) continue;
      sources[person.archetype] = sources[person.archetype] || { archetype: person.archetype, name: person.name, title: person.title, assigned: 0, graded: 0 };
    }
  }
  for (const r of rows) {
    const p = catalog.find((x) => x.key === r.projectKey);
    if (!p) continue;
    const person = ROSTER.find((x) => x.archetype === p.stakeholder);
    if (!person || !sources[person.archetype]) continue;
    sources[person.archetype].assigned += 1;
    if (r.status === 'graded') sources[person.archetype].graded += 1;
  }
  const taskSources = Object.values(sources).sort((a, b) => b.assigned - a.assigned);

  return {
    rows,
    locked,
    counts: {
      open: open.length,
      dueToday: open.filter((r) => r.dueAt && daysUntil(r.dueAt, nowMs) === 0).length,
      highPriority: open.filter((r) => r.priority === 'high').length,
      overdue: open.filter((r) => r.overdue).length,
      total: rows.length,
      withoutDeadline: rows.length - withDeadline.length,
    },
    health,
    velocity,
    onTimeRate,
    productivity,
    trend,
    taskSources,
  };
}

// Inbox categories. Every category maps to a real sender archetype — the tab bar only
// ever renders categories that actually have mail, so it can never advertise a folder
// that is permanently empty. Archetypes added later (customer, client, direct reports on
// the manager track) get a tab automatically the first time they send something.
const MAIL_CATEGORY = {
  // Every colleague who can send mail gets a readable tab. Without this a thread from Diya
  // filed itself under "finance_analyst", which is the internal name for her job and not
  // something any learner should ever see.
  ...Object.fromEntries(ROSTER.map((r) => [r.archetype, { key: r.archetype, label: r.title, tone: 'gray' }])),
  stakeholder: { key: 'stakeholder', label: 'Stakeholder', tone: 'amber' },
  line_manager: { key: 'line_manager', label: 'Line Manager', tone: 'emerald' },
  people_partner: { key: 'people_partner', label: 'HR', tone: 'purple' },
  // The ambient senders — the Programme Office, IT, the company newsletter. They are not
  // colleagues you can chat to, they only ever appear as mail, which is why they are
  // named here rather than in the roster.
  ...Object.fromEntries(Object.entries(ambientmail.AMBIENT_SENDERS)
    .map(([key, v]) => [key, { key, label: v.label, tone: v.tone }])),
};

function normalizedSubject(m) {
  return (m.subject || '').replace(/^(Re:\s*)+/i, '').trim();
}

// Groups the learner's messages into threads. Read and starred state is stored per
// message but presented per thread, which is how a mail client actually behaves: opening
// a conversation clears its unread count, starring flags the whole exchange.
function getInbox(messages, nowMs) {
  const threads = new Map();

  for (const m of messages) {
    const archetype = m.thread_archetype || m.sender_archetype;
    if (archetype === 'learner') continue; // a learner's own note is never its own thread
    // Email and chat are now genuinely different things: a message with a SUBJECT is
    // correspondence and belongs in the inbox; one without is a chat-dock exchange and
    // belongs there. Without this rule, opening the dock and saying "hi" to six
    // colleagues would fill the inbox with one-line threads and make it useless as an
    // inbox — which is exactly what an inbox that is really a chat log looks like.
    if (!normalizedSubject(m)) continue;
    const subject = normalizedSubject(m);
    const key = `${archetype}::${subject || 'direct'}`;
    if (!threads.has(key)) {
      threads.set(key, { key, archetype, subject, msgs: [] });
    }
    threads.get(key).msgs.push(m);
  }

  const list = [...threads.values()].map((t) => {
    const msgs = [...t.msgs].sort((a, b) => a.created_at.localeCompare(b.created_at));
    const last = msgs[msgs.length - 1];
    const fromOthers = msgs.filter((m) => m.sender_archetype !== 'learner');
    // Only incoming mail can be unread — the learner's own replies never count.
    const unread = fromOthers.filter((m) => !m.read_at).length;
    const category = MAIL_CATEGORY[t.archetype] || { key: t.archetype, label: t.archetype, tone: 'gray' };
    const senderName = (fromOthers[0] || last).sender_name;

    return {
      key: t.key,
      archetype: t.archetype,
      category: category.key,
      categoryLabel: category.label,
      tone: category.tone,
      senderName,
      subject: t.subject || `Messages with ${senderName}`,
      snippet: (last.body || '').replace(/\s+/g, ' ').trim().slice(0, 140),
      lastAt: last.created_at,
      unread,
      starred: msgs.some((m) => m.starred),
      ids: msgs.map((m) => m.id),
      messages: msgs.map((m) => ({
        id: m.id,
        senderArchetype: m.sender_archetype,
        senderName: m.sender_name,
        body: m.body,
        createdAt: m.created_at,
        readAt: m.read_at || null,
        taskId: m.task_id || null,
      })),
    };
  });

  list.sort((a, b) => b.lastAt.localeCompare(a.lastAt));

  // Category counts drive the tab bar, so a tab only exists where mail exists.
  const categories = [];
  for (const t of list) {
    let c = categories.find((x) => x.key === t.category);
    if (!c) {
      c = { key: t.category, label: t.categoryLabel, tone: t.tone, total: 0, unread: 0 };
      categories.push(c);
    }
    c.total += 1;
    c.unread += t.unread > 0 ? 1 : 0;
  }

  return {
    threads: list,
    categories,
    counts: {
      total: list.length,
      unread: list.filter((t) => t.unread > 0).length,
      starred: list.filter((t) => t.starred).length,
    },
  };
}

// Calendar events are real dated records only — when a task was handed over, when it is
// due, when it was graded, and when a character wrote to the learner. There is no meeting
// or video-call model in this product, so no meetings are invented here: a "9:30 Churn
// Model Review" with a Join button would be a fiction with a dead button behind it.
//
// Dates are UTC day keys, matching how sim_attendance already stores attended_on, so a
// day never disagrees with its own attendance mark.
function dayKey(iso) {
  return new Date(Date.parse(iso)).toISOString().slice(0, 10);
}

function getCalendar(enrollment, tasks, messages, nowMs) {
  const events = [];

  for (const t of tasks) {
    const def = TASKS[t.task_key] || {};
    const priority = t.priority || def.priority || 'medium';
    if (t.assigned_at) {
      events.push({
        id: `${t.id}-assigned`, date: dayKey(t.assigned_at), at: t.assigned_at,
        kind: 'assigned', title: t.title, detail: 'Task assigned to you', priority, taskId: t.id,
      });
    }
    const due = t.due_at || (t.assigned_at && def.dueInDays
      ? new Date(Date.parse(t.assigned_at) + def.dueInDays * DAY_MS).toISOString()
      : null);
    if (due) {
      events.push({
        id: `${t.id}-due`, date: dayKey(due), at: due,
        kind: t.status === 'graded' ? 'due-done' : 'due',
        title: t.title,
        detail: t.status === 'graded' ? 'Deadline (delivered)' : 'Deadline',
        priority, taskId: t.id,
      });
    }
    if (t.graded_at) {
      events.push({
        id: `${t.id}-graded`, date: dayKey(t.graded_at), at: t.graded_at,
        kind: 'graded', title: t.title,
        detail: `Graded${typeof t.score === 'number' ? ` — ${t.score}/100` : ''}`,
        priority, taskId: t.id,
      });
    }
  }

  for (const m of messages) {
    if (m.sender_archetype === 'learner') continue;
    events.push({
      id: `${m.id}-msg`, date: dayKey(m.created_at), at: m.created_at,
      kind: 'message', title: m.subject || `Message from ${m.sender_name}`,
      detail: (m.body || '').replace(/\s+/g, ' ').trim().slice(0, 120),
      archetype: m.sender_archetype, senderName: m.sender_name, priority: null,
    });
  }

  events.sort((a, b) => a.at.localeCompare(b.at));

  return {
    joinedOn: dayKey(enrollment.created_at),
    today: new Date(nowMs).toISOString().slice(0, 10),
    events,
  };
}

// The Team tab's per-character data. Nothing about a character is invented here.
//
// In particular there is no competency score for these people — they are archetypes, not
// assessed employees — so instead of fabricating "Asha: SQL 82", the radar reports the
// skill mix that character's projects genuinely demand, which is real catalog content and
// actually useful: it tells the learner what working with them will require.
//
// Availability is likewise real rather than a decorative presence dot: it reflects whether
// the learner can actually get a reply right now, given the daily AI message allowance.
function getTeam(role, rosterList, projects, messages, messagesRemaining, level) {
  const catalog = catalogFor(role, level);
  const projectStatus = Object.fromEntries(projects.projects.map((p) => [p.key, p]));

  return rosterList.map((person) => {
    const mine = catalog.filter((p) => p.stakeholder === person.archetype);

    const owned = mine.map((p) => {
      const st = projectStatus[p.key] || {};
      return {
        key: p.key,
        title: p.title,
        status: st.status || 'locked',
        progressPct: st.progressPct || 0,
      };
    });

    const demand = {};
    for (const axis of SKILL_AXES) demand[axis] = 0;
    for (const p of mine) for (const axis of p.skillFocus) demand[axis] += 1;
    const peak = Math.max(1, ...Object.values(demand));
    const skillDemand = SKILL_AXES.map((axis) => ({
      axis,
      label: SKILL_AXIS_LABEL[axis],
      value: Math.round((demand[axis] / peak) * 100),
      projects: demand[axis],
    }));

    const thread = messages.filter((m) => (m.thread_archetype || m.sender_archetype) === person.archetype);
    const incoming = thread.filter((m) => m.sender_archetype !== 'learner');
    const last = thread[thread.length - 1];

    return {
      archetype: person.archetype,
      name: person.name,
      title: person.title,
      avatarUrl: person.avatarUrl,
      // Only the Line Manager grades — a real, load-bearing rule of the character engine,
      // not a label. It's why "Review work" only makes sense for one person.
      grades: person.archetype === 'line_manager',
      owned,
      skillDemand,
      hasDemand: Object.values(demand).some((v) => v > 0),
      messageCount: thread.length,
      unread: incoming.filter((m) => !m.read_at).length,
      lastContactAt: last ? last.created_at : null,
      available: messagesRemaining > 0,
      // The colleague half of the cast: who they are, what they can actually help with,
      // and whether the learner has talked to them enough to be owed a real answer.
      core: Boolean(person.core),
      about: person.about || null,
      helpsWith: person.helpsWith || [],
      friend: Boolean(person.friend),
      messagesToFriend: person.messagesToFriend,
    };
  });
}

// Brings a learner's assigned tasks back in line with the catalog.
//
// startProject() assigns a project's tasks ONCE, at the moment it is started. So when a
// task is later added to a project that people have already started, those learners
// never receive it — and because a project is only "completed" when every task in its
// definition is graded, their project can never finish, nothing further unlocks, and no
// next task appears. That is exactly what happened when the Python task was added to
// Pay Equity Audit.
//
// Rather than migrate once and hope, this reconciles on every read: any project a
// learner has started that is missing tasks gets them assigned now, with a message
// explaining where the new work came from. It is a no-op for everyone already in sync,
// and it makes every future catalog change safe by construction.
function reconcileProjectTasks(enrollment) {
  const catalog = catalogFor(enrollment.role, enrollment.level);
  if (!catalog.length) return 0;

  const rows = db.prepare('SELECT task_key, assigned_at FROM sim_tasks WHERE enrollment_id = ? ORDER BY assigned_at ASC').all(enrollment.id);
  const have = new Set(rows.map((r) => r.task_key));
  let added = 0;

  for (const def of catalog) {
    // A project started before project runs existed has no week. Backfill one from when
    // its first task was actually assigned, so the deadline is honest rather than
    // restarting the clock today.
    if (def.taskKeys.some((k) => have.has(k))) {
      const existing = db.prepare('SELECT id FROM sim_project_runs WHERE enrollment_id = ? AND project_key = ?')
        .get(enrollment.id, def.key);
      if (!existing) {
        const firstRow = rows.find((r) => def.taskKeys.includes(r.task_key));
        const startedAt = (firstRow && firstRow.assigned_at) || now();
        const dueAt = addWorkingDays(startedAt, PROJECT_WEEK_DAYS);
        dueAt.setUTCHours(23, 59, 59, 0);
        db.prepare(`INSERT INTO sim_project_runs (id, enrollment_id, project_key, started_at, due_at, nudge_level)
          VALUES (?, ?, ?, ?, ?, 0)`).run(cryptoRandomId(), enrollment.id, def.key, startedAt, dueAt.toISOString());
      }
    }
    // Only projects the learner has actually started. An untouched project must stay
    // untouched — assigning its tasks here would silently start it for them.
    const started = def.taskKeys.some((k) => have.has(k));
    if (!started) continue;

    for (const key of def.taskKeys) {
      if (have.has(key) || !TASKS[key]) continue;
      // Use the project's real start so a catch-up task lands on its proper day rather
      // than opening immediately and breaking the shape of the week.
      const run = db.prepare('SELECT started_at FROM sim_project_runs WHERE enrollment_id = ? AND project_key = ?')
        .get(enrollment.id, def.key);
      const taskId = assignTask(enrollment.id, key, run ? run.started_at : null);
      const task = TASKS[key];
      addMessage(enrollment.id, 'line_manager', LINE_MANAGER_NAME,
        `One more for ${def.title} — we've added ${task.title} to the scope. ${task.brief}`, taskId);
      have.add(key);
      added += 1;
    }
  }
  return added;
}

function getState(userId) {
  // `let`, not `const`: the promotion round below can change the learner's level
  // part-way through this read, and everything after it must see the new one.
  let enrollment = getEnrollment(userId);
  if (!enrollment) return null;

  // Catch up any project whose task list grew after the learner started it, before
  // anything below reads the task rows.
  reconcileProjectTasks(enrollment);
  // Then advance the week: open whatever today unlocks, and chase anything overdue.
  releaseDueTasks(enrollment);
  nudgeOverdueProjects(userId, enrollment);

  const messages = db.prepare('SELECT * FROM sim_messages WHERE enrollment_id = ? ORDER BY created_at ASC').all(enrollment.id);
  const tasks = db.prepare('SELECT * FROM sim_tasks WHERE enrollment_id = ? ORDER BY assigned_at ASC').all(enrollment.id);
  const attendanceRows = db.prepare('SELECT attended_on FROM sim_attendance WHERE enrollment_id = ? ORDER BY attended_on ASC').all(enrollment.id);
  const attendedDays = attendanceRows.length;
  const trainingMonthDays = 22;
  const milestoneDays = trainingMonthDays * 3; // 66 — first certificate eligibility

  const gradedTasks = tasks.filter((t) => t.status === 'graded');
  const avgScore = gradedTasks.length
    ? Math.round(gradedTasks.reduce((sum, t) => sum + (t.score || 0), 0) / gradedTasks.length)
    : null;
  // Estimates are fractions of an hour now, so these sums are floating point and printed
  // straight onto the dashboard — "1.7000000000000002h" is what a learner actually saw.
  // Rounded to one decimal at the source, so every consumer gets the same clean number.
  const round1 = (n) => Math.round(n * 10) / 10;
  const hoursAssigned = round1(tasks.reduce((sum, t) => sum + (t.est_hours || 0), 0));
  const hoursCompleted = round1(gradedTasks.reduce((sum, t) => sum + (t.est_hours || 0), 0));
  const hoursOpen = round1(Math.max(0, hoursAssigned - hoursCompleted));

  // Real day-over-day movement only: compare the running average including today's
  // grades against what it was before any grade landed today. If every graded task so
  // far was graded today, the whole score was earned today, so the delta equals the
  // score itself rather than being fabricated as 0.
  const todayStr = today();
  const gradedBeforeToday = gradedTasks.filter((t) => (t.graded_at || '').slice(0, 10) !== todayStr);
  const avgScoreBeforeToday = gradedBeforeToday.length
    ? Math.round(gradedBeforeToday.reduce((sum, t) => sum + (t.score || 0), 0) / gradedBeforeToday.length)
    : null;
  const scoreDeltaToday = avgScore === null ? null : avgScore - (avgScoreBeforeToday === null ? 0 : avgScoreBeforeToday);

  const baseline = enrollment.baseline_json ? JSON.parse(enrollment.baseline_json) : null;
  const skillTest = getSkillTest(enrollment);

  const streaks = computeStreaks(attendanceRows.map((r) => r.attended_on));
  let projects = getProjects(enrollment.role, tasks, streaks, enrollment.id, enrollment.level);

  // The promotion round runs here, before anything is rendered: a learner who has just
  // cleared the bar should see the senior board on this load, not the next one.
  let promotion = getPromotion(enrollment, projects.projects, gradedTasks, tasks);
  // Signs the project off the moment the last of the fifty-one items lands, and says so.
  // Read time rather than a scheduler, same as the promotion review below it.
  finishProjectIfComplete(enrollment);

  if (promotion && runPromotionReview(enrollment, promotion, tasks)) {
    enrollment = getEnrollment(userId);
    projects = getProjects(enrollment.role, tasks, streaks, enrollment.id, enrollment.level);
    promotion = getPromotion(enrollment, projects.projects, gradedTasks, tasks);
    // The senior track has to actually start, or the promotion message points at an
    // empty board.
    beginNextProject(enrollment);
    const refreshed = db.prepare('SELECT * FROM sim_tasks WHERE enrollment_id = ? ORDER BY assigned_at ASC').all(enrollment.id);
    tasks.length = 0;
    tasks.push(...refreshed);
    projects = getProjects(enrollment.role, tasks, streaks, enrollment.id, enrollment.level);
  }
  closeCompletedRuns(enrollment, projects.projects);
  const rosterList = rosterWithAvatars(enrollment.id);
  const aiUse = countTodaysAiUse(enrollment.id);
  const messagesRemaining = Math.max(0, DAILY_AI_LIMITS.messages - aiUse.messages);
  // The day the learner has EARNED, which may be ahead of the day the calendar has
  // reached. Computed before the board so tasks can open on either.
  const runNow = activeRun(enrollment);
  // The most recent run whether or not it is still open. A learner who has just finished a
  // project should still see what they finished and how the quiz went — blanking the page
  // the moment they succeed is the opposite of the intended moment.
  const runShown = runNow || db.prepare('SELECT * FROM sim_project_runs WHERE enrollment_id = ? ORDER BY COALESCE(completed_at, started_at) DESC LIMIT 1')
    .get(enrollment.id);
  const dayUnlocked = unlockedDay(enrollment, runNow);
  // Issuing is idempotent — guarded on the row already existing — so running it on every
  // read is how the day's mail arrives without a scheduler.
  if (runNow) for (let d = 1; d <= dayUnlocked; d++) {
    issueDayItems(enrollment, runNow, d);
    issueDayMail(enrollment, runNow, d);
  }

  const taskBoard = getTasksView(
    enrollment.role, tasks, projects, Date.now(),
    attendanceRows.map((r) => r.attended_on),
    Date.parse(enrollment.created_at),
    enrollment.level,
    dayUnlocked,
  );

  const scoreHistory = gradedTasks.map((t) => ({ date: t.graded_at, score: t.score, title: t.title }));
  const checklistState = JSON.parse(enrollment.checklist_json || '{}');
  const checklist = (CHECKLIST_ITEMS[enrollment.role] || []).map((item) => ({ ...item, checked: Boolean(checklistState[item.key]) }));

  const milestoneDef = MILESTONE[enrollment.role];
  const milestoneMetrics = { tasksCompleted: gradedTasks.length, attendedDays };
  const milestone = milestoneDef ? {
    targetRole: milestoneDef.targetRole,
    requirements: milestoneDef.requirements.map((r) => ({
      key: r.key, label: r.label, target: r.target,
      current: Math.min(r.target, milestoneMetrics[r.metric] || 0),
      done: (milestoneMetrics[r.metric] || 0) >= r.target,
    })),
  } : null;

  return {
    enrollment,
    messages,
    tasks,
    roster: rosterList,
    emailArchetypes: EMAIL_ARCHETYPES,
    projects,
    taskBoard,
    inbox: getInbox(messages, Date.now()),
    calendar: getCalendar(enrollment, tasks, messages, Date.now()),
    team: getTeam(enrollment.role, rosterList, projects, messages, messagesRemaining, enrollment.level),
    messagesRemaining,
    performance: {
      tasksCompleted: gradedTasks.length,
      tasksTotal: tasks.length,
      avgScore,
      // Performance Score and Avg Grade both read off the same real average today —
      // there's only one scoring signal in P0. They're kept as separate fields because
      // once composite scoring (factoring in attendance/consistency, not just task
      // grades) ships, Performance Score will diverge from the raw grade average.
      avgGrade: avgScore,
      scoreDeltaToday,
      hoursAssigned,
      hoursCompleted,
      hoursOpen,
      hoursPerDayTarget: HOURS_PER_DAY_TARGET,
      daysAtPace: Math.ceil(hoursOpen / HOURS_PER_DAY_TARGET),
      personalBest: computePersonalBest(gradedTasks),
    },
    attendance: {
      attendedDays,
      milestoneDays,
      checkedInToday: attendanceRows.some((r) => r.attended_on === today()),
      days: attendanceRows.map((r) => r.attended_on),
      streak: streaks,
    },
    // The day in all three currencies, not just tasks. A day that is "6 of 6" on tasks and
    // silent about the two activities and two situations still owed is the old model
    // wearing new numbers.
    day: runNow ? (() => {
      const progress = dayProgress(enrollment, runNow, dayUnlocked);
      const closed = dayIsClosed(enrollment, runNow, dayUnlocked);
      return {
        ...progress,
        unlocked: dayUnlocked,
        totalDays: PROJECT_WEEK_DAYS,
        shape: DAY_SHAPE,
        dayName: DAY_NAMES[dayUnlocked] || `Day ${dayUnlocked}`,
        // Everything done, nothing signed off yet: the moment the whole day is built
        // around, and the only time the wrap-up button exists.
        readyToClose: Boolean(progress && progress.complete) && !closed,
        closed,
        // What is actually left, in words, so the learner can go and do it rather than
        // reverse-engineer it from three counters.
        pending: dayPending(progress),
        isLastDay: dayUnlocked >= PROJECT_WEEK_DAYS,
        nextDayName: dayUnlocked < PROJECT_WEEK_DAYS ? (DAY_NAMES[dayUnlocked + 1] || `Day ${dayUnlocked + 1}`) : null,
        closedAt: (dayRow(enrollment, runNow, dayUnlocked) || {}).closed_at || null,
      };
    })() : null,
    activities: runNow ? db.prepare('SELECT * FROM sim_activities WHERE enrollment_id = ? AND project_run_id = ? ORDER BY day_index, created_at')
      .all(enrollment.id, runNow.id).map((r) => {
        const def = dayitems.activitiesFor(runNow.project_key).find((a) => a.key === r.activity_key) || {};
        return {
          key: r.activity_key, day: r.day_index, status: r.status, score: r.score,
          type: def.type, via: def.via, from: def.from, minutes: def.minutes,
          title: def.title, subject: def.subject || null, body: def.body,
          // The correct option and the rubric markers stay on the server, exactly as they
          // do for tasks.
          check: def.check ? (def.check.kind === 'choice'
            ? { kind: 'choice', prompt: def.check.prompt,
                options: tasktypes.shuffleSeeded(def.check.options.map((o) => ({ key: o.key, label: o.label })),
                  tasktypes.seedFrom(`${enrollment.id}-${r.activity_key}`)) }
            : def.check.kind === 'answer'
              ? { kind: 'answer', prompt: def.check.prompt, maxWords: def.check.maxWords }
              : { kind: 'acknowledge', label: def.check.label || 'Done' }) : null,
        };
      }) : [],
    situations: runNow ? db.prepare('SELECT * FROM sim_situations WHERE enrollment_id = ? AND project_run_id = ? ORDER BY created_at')
      .all(enrollment.id, runNow.id).map((r) => {
        const def = situationDef(runNow.project_key, r.situation_key) || {};
        const delivered = r.message_id
          ? db.prepare('SELECT subject, body, sender_name FROM sim_messages WHERE id = ?').get(r.message_id)
          : null;
        return {
          key: r.situation_key, day: def.day, type: def.type, via: def.via, from: def.from,
          // Ambient desk mail is part of the job, not part of the day gate — the flag is
          // what lets the Today tab say so rather than quietly inflating the counter.
          deskMail: Boolean(def.deskMail),
          senderName: def.senderName || (delivered && delivered.sender_name) || null,
          // The stored copy, so {name} and {project} read as they were actually sent.
          subject: (delivered && delivered.subject) || def.subject || null,
          body: (delivered && delivered.body) || def.body,
          handledAs: r.handled_as, score: r.score,
          // Deliberately NOT sent: whether it needs a reply. Being told which mail matters
          // is the answer to the only question triage asks.
          expect: r.handled_as ? (def.expect || []) : null,
          note: r.handled_as ? (def.note || null) : null,
        };
      }) : [],
    // The company admin. Kept apart from the day's work on purpose: it is part of the job
    // and none of it counts toward finishing the day.
    chores: runNow ? db.prepare('SELECT * FROM sim_chores WHERE enrollment_id = ? AND project_run_id = ? ORDER BY created_at')
      .all(enrollment.id, runNow.id).map((r) => {
        const def = ambientmail.choreByKey(r.chore_key) || {};
        const delivered = r.message_id
          ? db.prepare('SELECT subject, body FROM sim_messages WHERE id = ?').get(r.message_id)
          : null;
        const projectDef = catalogFor(enrollment.role, enrollment.level).find((p) => p.key === runNow.project_key);
        const projectTitle = projectDef ? projectDef.title : 'this project';
        return {
          key: r.chore_key, day: r.day_index, from: def.from || null,
          senderName: def.senderName || null,
          subject: (delivered && delivered.subject) || def.subject || null,
          body: (delivered && delivered.body) || def.body || null,
          action: def.action ? {
            submitLabel: def.action.submitLabel,
            fields: def.action.fields.map((f) => ({
              ...f,
              options: f.options ? f.options.map((o) => fillMail(o, '', projectTitle)) : undefined,
            })),
          } : null,
          done: Boolean(r.done_at),
          values: r.values_json ? JSON.parse(r.values_json) : null,
        };
      }) : [],
    quiz: runShown ? getQuiz(enrollment, runShown) : null,
    projectCompletion: runShown ? projectCompletion(enrollment, runShown) : null,
    skillTest,
    promotion,
    timeTravel: timeTravelState(enrollment, projects.projects),
    standup: getStandup(userId),
    skillMatrix: getSkillMatrix(gradedTasks, baseline),
    scoreHistory,
    shoutouts: getShoutouts(gradedTasks),
    checklist,
    learningPath: LEARNING_PATH[enrollment.role] || [],
    milestone,
  };
}

// Starts an available project by assigning its tasks. The unlock gate is enforced here,
// not just hidden in the UI — calling this directly for a locked project is refused.
// The week as a durable object: when it started, when it is due, and how far the
// pressure has escalated.
function startProjectRun(enrollmentId, projectKey) {
  const startedAt = now();
  const dueAt = addWorkingDays(startedAt, PROJECT_WEEK_DAYS);
  dueAt.setUTCHours(23, 59, 59, 0); // the deadline is end of day 5, not the start of it
  db.prepare(`
    INSERT INTO sim_project_runs (id, enrollment_id, project_key, started_at, due_at, nudge_level)
    VALUES (?, ?, ?, ?, ?, 0)
    ON CONFLICT(enrollment_id, project_key) DO NOTHING
  `).run(cryptoRandomId(), enrollmentId, projectKey, startedAt, dueAt.toISOString());
  return db.prepare('SELECT * FROM sim_project_runs WHERE enrollment_id = ? AND project_key = ?').get(enrollmentId, projectKey);
}

// What a late project costs, in the only currency that lands: the people waiting on you
// say so. Two escalations, then it stops — a third identical chase is noise, and noise
// is ignored. Nudges are recorded so reloading the page never re-sends one.
const OVERDUE_NUDGES = [
  {
    afterDays: 1,
    from: 'line_manager',
    subject: 'Where are we on {project}?',
    body: "{name}, the deadline for {project} was yesterday and {open} {be} still not signed off.\n\nI'm not chasing to nag — I need to tell Vikram something. Reply here with where you've got to and what's in the way, and I'll manage his expectations.",
  },
  {
    afterDays: 3,
    from: 'stakeholder',
    subject: 'Re: {project} — I need a date',
    body: "I've been waiting three days past the date we agreed for {project}.\n\nI have people downstream who can't start until this lands, and I've had to tell the leadership review it's delayed. I'm not looking for the analysis to be rushed — I'm looking for a date I can rely on. When will it be with me?",
  },
];

// Chases address the learner the way a colleague would — by first name, or not at all.
function firstName(full) {
  const t = String(full || '').trim();
  return t ? t.split(/\s+/)[0] : '';
}

// Sends whichever chase is now due, at most one per read. Returns how many were sent.
function nudgeOverdueProjects(userId, enrollment) {
  const catalog = catalogFor(enrollment.role, enrollment.level);
  const runs = db.prepare('SELECT * FROM sim_project_runs WHERE enrollment_id = ? AND completed_at IS NULL').all(enrollment.id);
  if (!runs.length) return 0;

  const profile = db.prepare('SELECT name FROM profiles WHERE user_id = ?').get(userId);
  const learner = firstName(profile && profile.name) || 'there';
  const nowMs = Date.now();
  let sent = 0;

  for (const run of runs) {
    const def = catalog.find((p) => p.key === run.project_key);
    if (!def) continue;

    const overdueDays = Math.floor((nowMs - Date.parse(run.due_at)) / DAY_MS);
    if (overdueDays < OVERDUE_NUDGES[0].afterDays) continue;

    // Still open work on this project? A finished-but-unmarked project must not be chased.
    const rows = db.prepare('SELECT * FROM sim_tasks WHERE enrollment_id = ?').all(enrollment.id)
      .filter((t) => def.taskKeys.includes(t.task_key));
    const open = rows.filter((t) => t.status !== 'graded');
    if (!open.length) continue;

    const level = run.nudge_level || 0;
    const next = OVERDUE_NUDGES[level];
    if (!next || overdueDays < next.afterDays) continue;

    const person = ROSTER.find((r) => r.archetype === next.from);
    const fill = (t) => t
      .replace(/\{name\}/g, learner)
      .replace(/\{project\}/g, def.title)
      // Name the work rather than counting it wherever that is still readable. "2 tasks"
      // makes the learner go and look; naming them means the chase can be acted on from
      // the email itself.
      .replace(/\{open\}/g, open.length <= 2
        ? open.map((t) => `"${t.title}"`).join(' and ')
        : `${open.length} tasks`)
      // "7 tasks still isn't signed off" — the template was written when the only
      // substitution was a single named task.
      .replace(/\{be\}/g, open.length === 1 ? 'is' : 'are');

    addMessage(enrollment.id, next.from, person.name, fill(next.body), null, fill(next.subject), next.from);
    db.prepare('UPDATE sim_project_runs SET nudge_level = ? WHERE id = ?').run(level + 1, run.id);
    sent += 1;
  }
  return sent;
}

// Announces tasks whose day has arrived. A task assigned on Monday but belonging to
// Wednesday should ARRIVE on Wednesday — the drip is what makes the week feel like a
// week rather than a backlog. The announcement message doubles as the record that it
// has been released, so this never fires twice.
function releaseDueTasks(enrollment) {
  const nowMs = Date.now();
  const run = activeRun(enrollment);
  const unlocked = run ? unlockedDay(enrollment, run) : 1;
  const due = db.prepare(`
    SELECT t.* FROM sim_tasks t
    WHERE t.enrollment_id = ? AND t.day_index > 1
      AND NOT EXISTS (SELECT 1 FROM sim_messages m WHERE m.task_id = t.id AND m.sender_archetype = 'line_manager')
  `).all(enrollment.id).filter((t) => taskIsOpen(t, unlocked, nowMs));

  for (const t of due) {
    addMessage(enrollment.id, 'line_manager', LINE_MANAGER_NAME,
      `Next one's ready: ${t.title}. ${t.brief}`, t.id);
  }
  return due.length;
}

// Marks a run finished so it stops being chased.
//
// "Finished" used to mean the tasks were graded, which was the whole definition when tasks
// were the whole product. It is not any more: a project is done on 30 tasks, 10 activities,
// 10 situations and the quiz. Closing on tasks alone would have shut the run — and with it
// the quiz the learner had not sat yet — the moment the last query was signed off.
function closeCompletedRuns(enrollment, projects) {
  for (const p of projects) {
    if (p.status !== 'completed') continue;
    const run = db.prepare('SELECT * FROM sim_project_runs WHERE enrollment_id = ? AND project_key = ? AND completed_at IS NULL')
      .get(enrollment.id, p.key);
    if (!run) continue;
    const c = projectCompletion(enrollment, run);
    if (c && !c.complete) continue;
    db.prepare('UPDATE sim_project_runs SET completed_at = ? WHERE id = ?').run(now(), run.id);
  }
}

// Hands over the next project on the learner's own catalogue. Used twice: once when the
// skills check is done (welcome -> skills check -> project, the day-one order), and again
// the moment they are promoted, so the promotion message never points at an empty board.
function beginNextProject(enrollment) {
  const tasks = db.prepare('SELECT task_key FROM sim_tasks WHERE enrollment_id = ?').all(enrollment.id);
  const have = new Set(tasks.map((t) => t.task_key));

  // The first project on their CURRENT catalogue that they have not started. On day one
  // that is their first project; the moment they are promoted it is their first senior
  // one, which is why this is not called beginFirstProject any more.
  const def = catalogFor(enrollment.role, enrollment.level)
    .find((p) => !p.taskKeys.some((k) => have.has(k)));
  if (!def) return null;

  const run = startProjectRun(enrollment.id, def.key);
  let firstId = null;
  for (const key of def.taskKeys) {
    const taskId = assignTask(enrollment.id, key, run.started_at);
    if ((TASKS[key].day || 1) === 1 && !firstId) firstId = taskId;
  }
  const task = TASKS[def.taskKeys[0]];
  addMessage(enrollment.id, 'line_manager', LINE_MANAGER_NAME,
    `You're on ${def.title} — first task: ${task.title}. ${task.brief}`, firstId);
  // The stakeholder's note names the actual project. It used to hardcode the junior
  // compensation brief, which read as a mistake the moment a senior learner arrived.
  addMessage(enrollment.id, 'stakeholder', STAKEHOLDER_NAME,
    `Hi — following up on ${def.title}, which Asha mentioned you're picking up. I need it for a leadership review, so ideally by end of day Thursday. Let me know if anything's unclear about what I'm after.`,
    firstId, `${def.title} — need by Thursday`);
  return run;
}

// The skills check, as the learner sees it. `pending` is the gate: until it is done the
// dashboard has no project on it, which is the point — the test is the first thing that
// happens, not a side quest tucked in a menu.
//
// An account enrolled BEFORE this shipped already has tasks. Those learners are offered
// the test but never blocked by it: retro-fitting a gate onto someone mid-project would
// take work away from them to make a number tidier.
function getSkillTest(enrollment) {
  const taken = Boolean(enrollment.baseline_at);
  const hasWork = db.prepare('SELECT COUNT(*) c FROM sim_tasks WHERE enrollment_id = ?').get(enrollment.id).c > 0;
  return {
    taken,
    // Only a learner with no work yet is held here.
    required: !taken && !hasWork,
    optional: !taken && hasWork,
    takenAt: enrollment.baseline_at || null,
    result: taken ? JSON.parse(enrollment.baseline_json || 'null') : null,
    questions: taken ? [] : skilltest.getQuestions(),
    minutes: 15,
  };
}

function submitSkillTest(userId, answers) {
  const enrollment = getEnrollment(userId);
  if (!enrollment) throw new Error('Not enrolled yet.');
  if (enrollment.baseline_at) throw new Error('You have already taken the skills check.');

  const result = skilltest.score(answers);
  if (!result.answered) throw new Error('Answer at least one question before submitting.');

  db.prepare('UPDATE sim_enrollments SET baseline_json = ?, baseline_at = ? WHERE id = ?')
    .run(JSON.stringify({ skills: result.skills, overall: result.overall, answered: result.answered, correct: result.correct, total: result.total }),
         now(), enrollment.id);

  // Asha reacts to what the test actually showed. Naming the strongest and weakest axis
  // is the difference between a score and a conversation — and it is derived, so it can
  // never contradict the numbers on the matrix.
  const scored = Object.entries(result.skills).filter(([, v]) => typeof v === 'number');
  const sorted = [...scored].sort((a, b) => b[1] - a[1]);
  const best = sorted[0], worst = sorted[sorted.length - 1];
  const line = best && worst && best[0] !== worst[0]
    ? `Your strongest area is ${SKILL_AXIS_LABEL[best[0]]} (${best[1]}) and the one with the most room is ${SKILL_AXIS_LABEL[worst[0]]} (${worst[1]}).`
    : 'That gives me a starting point to measure against.';
  addMessage(enrollment.id, 'line_manager', LINE_MANAGER_NAME,
    `Got your skills check — ${result.correct} of ${result.answered}. ${line}\n\nNothing here is a verdict; it's the line we measure from. Every task you deliver updates these, and in twelve weeks you'll be able to show the difference rather than assert it.`);

  beginNextProject(getEnrollment(userId));
  return { result, state: getState(userId) };
}

// ---- The two-minute stand-up -------------------------------------------------------
//
// A daily stand-up is the one workplace ritual that costs nothing to simulate and does
// the most to make this feel like a job rather than a course: three questions, out loud,
// with someone who already knows what you were meant to be doing.
//
// It is spoken in the browser via the Web Speech API — Asha through speechSynthesis, the
// learner through SpeechRecognition — so it costs nothing per learner. Recognition is
// Chrome/Edge only, so every question also takes typing. The text path is the real path
// and voice is the upgrade, not the other way round: a learner on Firefox must get the
// whole ritual, not a degraded stub.
//
// Asha's questions are built from the learner's OWN state, which is the entire point.
// "How did the department salary breakdown go?" lands; "what did you do yesterday?" is
// a form. Nothing here calls the AI.
function getStandup(userId) {
  const enrollment = getEnrollment(userId);
  if (!enrollment) return null;

  const day = today();
  const doneRow = db.prepare('SELECT * FROM sim_standups WHERE enrollment_id = ? AND stood_up_on = ?')
    .get(enrollment.id, day);

  const profile = db.prepare('SELECT name FROM profiles WHERE user_id = ?').get(userId);
  const learner = firstName(profile && profile.name) || 'there';
  const tasks = db.prepare('SELECT * FROM sim_tasks WHERE enrollment_id = ?').all(enrollment.id);
  const graded = tasks.filter((t) => t.status === 'graded');
  // The same rule the board uses. Asha asking "what are you picking up today?" without
  // naming anything, above a board with six open tasks on it, is the stand-up equivalent
  // of the Friday bug: a second copy of "is this open yet" that had drifted.
  const standupRun = activeRun(enrollment);
  const standupDay = standupRun ? unlockedDay(enrollment, standupRun) : 1;
  const open = tasks.filter((t) => t.status !== 'graded' && taskIsOpen(t, standupDay, Date.now()));

  // "Since we last spoke" is the honest framing — this is self-paced, so yesterday may
  // have been a week ago, and pretending otherwise would be the first false note.
  const lastStandup = db.prepare('SELECT stood_up_on FROM sim_standups WHERE enrollment_id = ? ORDER BY stood_up_on DESC LIMIT 1')
    .get(enrollment.id);
  const since = lastStandup ? Date.parse(lastStandup.stood_up_on + 'T00:00:00Z') : Date.parse(enrollment.created_at);
  const closedSince = graded.filter((t) => t.graded_at && Date.parse(t.graded_at) >= since);

  const runs = db.prepare('SELECT * FROM sim_project_runs WHERE enrollment_id = ? AND completed_at IS NULL').all(enrollment.id);
  const catalog = catalogFor(enrollment.role, enrollment.level);
  const late = runs.filter((r) => Date.now() > Date.parse(r.due_at))
    .map((r) => (catalog.find((p) => p.key === r.project_key) || {}).title)
    .filter(Boolean);

  const questions = [
    {
      id: 'done',
      // Naming the actual task is what makes this a conversation rather than a form.
      text: closedSince.length
        ? `Since we last spoke you got ${closedSince.length === 1 ? `"${closedSince[0].title}"` : `${closedSince.length} tasks`} signed off. How did that go?`
        : `Morning ${learner}. Where did you get to since we last spoke?`,
      hint: 'One or two sentences is plenty.',
    },
    {
      id: 'today',
      text: open.length
        ? `What are you taking on today? I've got "${open[0].title}" open against your name.`
        : "What are you picking up today?",
      hint: open.length ? `Open right now: ${open.map((t) => t.title).join(', ')}` : null,
    },
    {
      id: 'blockers',
      text: late.length
        ? `Anything in your way? ${late.join(' and ')} ${late.length === 1 ? 'is' : 'are'} past its date, so be straight with me — I'd rather know now.`
        : "Anything blocking you? If there is, say so now rather than on Friday.",
      hint: 'Say "nothing" if there is nothing. That is a real answer.',
    },
  ];

  return {
    date: day,
    done: Boolean(doneRow),
    doneAt: doneRow ? doneRow.created_at : null,
    manager: LINE_MANAGER_NAME,
    learner,
    greeting: `Morning ${learner} — two minutes, three questions.`,
    questions,
    // Said out loud at the end, so the learner hears that it landed somewhere.
    minutes: 2,
  };
}

// Records the stand-up and posts it into the message thread, because a stand-up nobody
// can refer back to is theatre. Asha's closing line is derived from what was actually
// said — specifically, whether a blocker was raised.
function submitStandup(userId, answers, spoken) {
  const enrollment = getEnrollment(userId);
  if (!enrollment) throw new Error('Not enrolled yet.');

  const day = today();
  if (db.prepare('SELECT 1 FROM sim_standups WHERE enrollment_id = ? AND stood_up_on = ?').get(enrollment.id, day)) {
    throw new Error("You've already done today's stand-up.");
  }

  const given = answers && typeof answers === 'object' ? answers : {};
  const clean = {};
  for (const k of ['done', 'today', 'blockers']) {
    clean[k] = String(given[k] || '').trim().slice(0, 2000);
  }
  if (!clean.done && !clean.today && !clean.blockers) {
    throw new Error('Say something before you finish the stand-up.');
  }

  db.prepare(`INSERT INTO sim_standups (id, enrollment_id, stood_up_on, answers_json, spoken, created_at)
              VALUES (?, ?, ?, ?, ?, ?)`)
    .run(cryptoRandomId(), enrollment.id, day, JSON.stringify(clean), spoken ? 1 : 0, now());

  const profile = db.prepare('SELECT name FROM profiles WHERE user_id = ?').get(userId);
  const learner = firstName(profile && profile.name) || 'there';

  // The learner's own words go in as their message, so the thread reads as a record of
  // what they said — not a summary written on their behalf.
  addMessage(enrollment.id, 'learner', profile && profile.name ? profile.name : 'You',
    `Stand-up — ${day}\n\nSince we last spoke: ${clean.done || '—'}\nToday: ${clean.today || '—'}\nBlockers: ${clean.blockers || '—'}`,
    null, `Stand-up — ${day}`, 'line_manager');

  // A raised blocker gets acknowledged as a blocker. Saying "great, thanks" to someone
  // who just told you they are stuck is how a manager loses people.
  const raised = clean.blockers && !/^(no|none|nothing|nope|n\/a|all good|nothing really)\b/i.test(clean.blockers);
  const reply = raised
    ? `Thanks ${learner} — noted on the blocker, and thanks for saying it now rather than Friday. Put what you have into the workbench and message me the specific bit that's stuck; I'd rather unpick it with you than have you sit on it.`
    : `Thanks ${learner}. That's what I needed — go and make a start, and shout if the picture changes during the day.`;
  addMessage(enrollment.id, 'line_manager', LINE_MANAGER_NAME, reply, null, `Re: Stand-up — ${day}`, 'line_manager');

  return { reply, raisedBlocker: Boolean(raised), state: getState(userId) };
}

// ---- The rest of the working day ------------------------------------------------------
//
// Six tasks, two activities and two situations, five days, and a quiz on the Friday.
//
// The rule that shapes all of this: activities and situations ARRIVE. They are not a list
// the learner works down at their leisure — Asha sends you a module, Vikram adds to the
// brief on Wednesday afternoon, Finance wants a number by three. Both land in the inbox or
// the chat dock while you are mid-task, and that interruption is the thing being practised.
// So issuing an item and delivering the message are the same act, and neither happens until
// the day it belongs to has actually opened.

const DAY_SHAPE = { tasks: 6, activities: 2, situations: 2 };

function itemRow(table, enrollmentId, key) {
  return db.prepare(`SELECT * FROM ${table} WHERE enrollment_id = ? AND ${table === 'sim_activities' ? 'activity_key' : 'situation_key'} = ?`)
    .get(enrollmentId, key);
}

// Put the day's activities and situations in front of the learner, once.
//
// Guarded by the row already existing rather than by a flag, because getState runs on every
// page load and a learner who refreshes twice must not get Vikram's email twice.
// The second activity and the second situation are not waiting for you at nine. They turn
// up while you are mid-task, which is the whole point of them: after a couple of tasks are
// through, or after ten minutes at the desk if the task is a hard one. Tied to tasks rather
// than to the clock alone so it can never stall a day — a day needs its six tasks anyway,
// and by the second one everything has landed.
const ITEM_TASKS_APART = 2;
const ITEM_MINUTES_APART = 10;

function itemHasLanded(enrollment, run, dayIndex, index) {
  if (index <= 0) return true;
  const openedAt = dayOpenedAt(enrollment, run, dayIndex);
  const minutes = Math.max(0, (Date.now() - Date.parse(openedAt)) / 60000);
  const def = catalogFor(enrollment.role, enrollment.level).find((p) => p.key === run.project_key);
  const keys = def ? def.taskKeys : [];
  const signedOff = db.prepare('SELECT task_key, status, day_index FROM sim_tasks WHERE enrollment_id = ?')
    .all(enrollment.id)
    .filter((t) => keys.includes(t.task_key) && t.day_index === dayIndex
      && (t.status === 'graded' || t.status === 'parked')).length;
  return signedOff >= index * ITEM_TASKS_APART || minutes >= index * ITEM_MINUTES_APART;
}

function issueDayItems(enrollment, run, dayIndex) {
  if (!run || !dayIndex) return 0;
  let issued = 0;

  const todaysActs = dayitems.activitiesFor(run.project_key).filter((a) => a.day === dayIndex);
  for (const [index, a] of todaysActs.entries()) {
    if (!itemHasLanded(enrollment, run, dayIndex, index)) continue;
    if (itemRow('sim_activities', enrollment.id, a.key)) continue;
    const person = ROSTER.find((r) => r.archetype === a.from) || ROSTER[0];
    const messageId = addMessage(enrollment.id, a.from, person.name, a.body, null,
      a.via === 'email' ? a.subject : null, a.from);
    db.prepare(`INSERT INTO sim_activities (id, enrollment_id, activity_key, project_run_id, day_index, assigned_on, status, payload_json, created_at)
                VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?)`)
      .run(cryptoRandomId(), enrollment.id, a.key, run.id, dayIndex, today(),
           JSON.stringify({ messageId }), now());
    issued += 1;
  }

  const todaysSits = dayitems.situationsFor(run.project_key).filter((x) => x.day === dayIndex);
  for (const [index, sit] of todaysSits.entries()) {
    if (!itemHasLanded(enrollment, run, dayIndex, index)) continue;
    if (itemRow('sim_situations', enrollment.id, sit.key)) continue;
    const person = ROSTER.find((r) => r.archetype === sit.from) || ROSTER[0];
    const messageId = addMessage(enrollment.id, sit.from, person.name, sit.body, null,
      sit.via === 'email' ? sit.subject : null, sit.from);
    db.prepare(`INSERT INTO sim_situations (id, enrollment_id, situation_key, project_run_id, message_id, delivered_at, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(cryptoRandomId(), enrollment.id, sit.key, run.id, messageId, now(), now());
    issued += 1;
  }
  return issued;
}

// ---- Ten emails a day, two of them wanting an answer ----------------------------------
//
// The project supplies four messages on a good day and none on a quiet one, and an inbox
// with four messages in it does not teach anyone to triage. So on top of whatever the
// project sends, every day gets topped up to ten emails: two addressed to the learner by
// name and needing a reply, and company noise for the rest.
//
// The two that need a reply are handled through exactly the same reply / defer / archive /
// escalate machinery as a project situation and scored the same way — but they do NOT
// count toward the day gate. The day is finished by six tasks, two activities and two
// situations; somebody asking for a status line is part of the job, not a fifth kind of
// homework, and making it one would mean a learner could be blocked from tomorrow by an
// email the Programme Office sent for its own convenience.

function fillMail(text, learnerName, projectTitle) {
  return String(text || '')
    .replace(/\{name\}/g, learnerName)
    .replace(/\{project\}/g, projectTitle);
}

// How many emails have already landed for this project run on this day. Counts only mail
// with a subject, because that is what getInbox counts as an email — a subject-less
// message is a chat-dock line and does not fill an inbox.
function emailsIssuedForDay(enrollment, run, dayIndex) {
  const actEmails = dayitems.activitiesFor(run.project_key)
    .filter((a) => a.day === dayIndex && a.via === 'email').length;
  const sitEmails = dayitems.situationsFor(run.project_key)
    .filter((x) => x.day === dayIndex && x.via === 'email').length;
  return actEmails + sitEmails;
}

// How much of today's post has been delivered yet.
//
// Ten emails landing in one go the moment a day opens is not an inbox, it is a wall. Real
// mail arrives while you are doing something else, which is the entire reason interruption
// is worth practising. So the day's post is released against an allowance that grows two
// ways: every task you sign off brings something in, and so does simply spending time at
// your desk. Both, because a learner who works fast should not sit in silence, and one who
// is stuck on a hard task should not have a dead inbox either.
const MAIL_OPENING_BATCH = 2;      // what is waiting when you sit down
const MAIL_MINUTES_EACH = 3;       // and one more every few minutes after that

function dayOpenedAt(enrollment, run, dayIndex) {
  const row = dayRow(enrollment, run, dayIndex);
  if (row) return row.created_at;
  const created = now();
  db.prepare(`INSERT INTO sim_days (id, enrollment_id, project_run_id, day_index, created_at)
              VALUES (?, ?, ?, ?, ?)
              ON CONFLICT(enrollment_id, project_run_id, day_index) DO NOTHING`)
    .run(cryptoRandomId(), enrollment.id, run.id, dayIndex, created);
  const again = dayRow(enrollment, run, dayIndex);
  return again ? again.created_at : created;
}

function mailAllowance(enrollment, run, dayIndex) {
  const openedAt = dayOpenedAt(enrollment, run, dayIndex);
  const minutes = Math.max(0, (Date.now() - Date.parse(openedAt)) / 60000);

  const def = catalogFor(enrollment.role, enrollment.level).find((p) => p.key === run.project_key);
  const keys = def ? def.taskKeys : [];
  const signedOff = db.prepare('SELECT task_key, status, day_index FROM sim_tasks WHERE enrollment_id = ?')
    .all(enrollment.id)
    .filter((t) => keys.includes(t.task_key) && t.day_index === dayIndex
      && (t.status === 'graded' || t.status === 'parked')).length;

  return MAIL_OPENING_BATCH + signedOff + Math.floor(minutes / MAIL_MINUTES_EACH);
}

// The order today's post arrives in. Deterministic — what lands on a learner's Wednesday
// is reviewable in a diff like everything else — and deliberately interleaved so the two
// messages that want an answer are not all at the front or all at the back. One turns up
// early, one lands in the middle of the afternoon.
function mailSequence(enrollment, run, dayIndex) {
  const desk = ambientmail.deskFor(dayIndex);
  const chores = ambientmail.choresFor(dayIndex);
  const already = emailsIssuedForDay(enrollment, run, dayIndex) + desk.length + chores.length;
  const wanted = Math.max(0, ambientmail.MIN_EMAILS_PER_DAY - already);
  const noise = ambientmail.noiseFor(dayIndex).slice(0, wanted);

  const order = [];
  // The two that want an answer land early enough to be acted on — second thing you open,
  // and again a couple of tasks later. Pushing them to the back of the day would mean a
  // learner who works fast never sees them before signing off.
  const deskAt = new Set([1, 3]);
  const choreAt = new Set([6]);    // the timesheet, late enough that you have hours to log
  let d = 0;
  let c = 0;
  let n = 0;
  const total = desk.length + chores.length + noise.length;
  for (let i = 0; i < total; i += 1) {
    if (deskAt.has(i) && d < desk.length) { order.push({ kind: 'desk', mail: desk[d] }); d += 1; continue; }
    if (choreAt.has(i) && c < chores.length) { order.push({ kind: 'chore', mail: chores[c] }); c += 1; continue; }
    if (n < noise.length) { order.push({ kind: 'noise', mail: noise[n] }); n += 1; continue; }
    if (d < desk.length) { order.push({ kind: 'desk', mail: desk[d] }); d += 1; continue; }
    if (c < chores.length) { order.push({ kind: 'chore', mail: chores[c] }); c += 1; continue; }
  }
  return order;
}

function issueDayMail(enrollment, run, dayIndex) {
  if (!run || !dayIndex) return 0;
  const def = catalogFor(enrollment.role, enrollment.level).find((p) => p.key === run.project_key);
  const projectTitle = def ? def.title : 'this project';
  const profile = db.prepare('SELECT name FROM profiles WHERE user_id = ?').get(enrollment.user_id);
  const learnerName = firstName(profile && profile.name) || 'there';

  const sequence = mailSequence(enrollment, run, dayIndex);
  // A closed day releases whatever is left of its post. Otherwise a learner who cleared
  // the day in forty minutes would carry two undelivered newsletters into tomorrow, and
  // the daily count would quietly stop being ten.
  const allowance = dayIsClosed(enrollment, run, dayIndex)
    ? sequence.length
    : mailAllowance(enrollment, run, dayIndex);
  let issued = 0;

  for (const [i, item] of sequence.entries()) {
    if (i >= allowance) break;
    const mail = item.mail;
    if (item.kind === 'desk') {
      // The two that are addressed to you. Stored as situations so the learner handles
      // them with the controls they already know, keyed 'dm-' so the day gate can tell
      // them apart — they are part of the job, not a fifth kind of homework.
      if (itemRow('sim_situations', enrollment.id, mail.key)) continue;
      const messageId = addMessage(enrollment.id, mail.from, mail.senderName,
        fillMail(mail.body, learnerName, projectTitle), null,
        fillMail(mail.subject, learnerName, projectTitle), mail.from);
      db.prepare(`INSERT INTO sim_situations (id, enrollment_id, situation_key, project_run_id, message_id, delivered_at, created_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .run(cryptoRandomId(), enrollment.id, mail.key, run.id, messageId, now(), now());
    } else if (item.kind === 'chore') {
      if (db.prepare('SELECT id FROM sim_chores WHERE enrollment_id = ? AND chore_key = ?').get(enrollment.id, mail.key)) continue;
      const messageId = addMessage(enrollment.id, mail.from, mail.senderName,
        fillMail(mail.body, learnerName, projectTitle), null,
        fillMail(mail.subject, learnerName, projectTitle), mail.from);
      db.prepare(`INSERT INTO sim_chores (id, enrollment_id, project_run_id, chore_key, day_index, message_id, created_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .run(cryptoRandomId(), enrollment.id, run.id, mail.key, dayIndex, messageId, now());
    } else {
      const seen = db.prepare('SELECT id FROM sim_ambient_mail WHERE enrollment_id = ? AND project_run_id = ? AND mail_key = ?')
        .get(enrollment.id, run.id, mail.key);
      if (seen) continue;
      const messageId = addMessage(enrollment.id, mail.from, mail.senderName,
        fillMail(mail.body, learnerName, projectTitle), null,
        fillMail(mail.subject, learnerName, projectTitle), mail.from);
      db.prepare(`INSERT INTO sim_ambient_mail (id, enrollment_id, project_run_id, mail_key, day_index, message_id, created_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .run(cryptoRandomId(), enrollment.id, run.id, mail.key, dayIndex, messageId, now());
    }
    issued += 1;
  }
  return issued;
}

// One place that knows what a situation row means, whether it came from the project or
// from the ambient stream. Everything downstream — handling, scoring, the state payload —
// goes through here rather than assuming the key belongs to the project.
function situationDef(projectKey, key) {
  const own = dayitems.situationsFor(projectKey || '').find((x) => x.key === key);
  if (own) return own;
  const desk = ambientmail.deskByKey(key);
  return desk ? { ...desk, deskMail: true, type: desk.type || 'desk mail' } : null;
}

// What the learner still owes today, in all three currencies.
//
// A day is not finished when the tasks are. That was the old model and it is why the
// product read as a worksheet: the analysis was the only thing that counted, so everything
// else felt optional and therefore was.
function dayProgress(enrollment, run, dayIndex) {
  if (!run || !dayIndex) return null;
  const def = catalogFor(enrollment.role, enrollment.level).find((p) => p.key === run.project_key);
  const keys = def ? def.taskKeys : [];

  // This project's tasks only. An earlier version had a `|| true` in the filter that made
  // the guard do nothing, so a learner's second project would have counted the first one's
  // rows as today's work.
  const tasks = db.prepare('SELECT task_key, status, day_index FROM sim_tasks WHERE enrollment_id = ?')
    .all(enrollment.id)
    .filter((t) => keys.includes(t.task_key) && t.day_index === dayIndex);
  const tasksDone = tasks.filter((t) => t.status === 'graded' || t.status === 'parked').length;

  const actKeys = dayitems.activitiesFor(run.project_key).filter((a) => a.day === dayIndex).map((a) => a.key);
  const acts = db.prepare('SELECT status FROM sim_activities WHERE enrollment_id = ? AND project_run_id = ? AND day_index = ?')
    .all(enrollment.id, run.id, dayIndex);
  const actsDone = acts.filter((a) => a.status === 'done').length;

  const sitKeys = dayitems.situationsFor(run.project_key).filter((x) => x.day === dayIndex).map((x) => x.key);
  const sits = sitKeys.length
    ? db.prepare(`SELECT handled_as FROM sim_situations WHERE enrollment_id = ? AND situation_key IN (${sitKeys.map(() => '?').join(',')})`)
        .all(enrollment.id, ...sitKeys)
    : [];
  const sitsDone = sits.filter((x) => x.handled_as).length;

  // What this day actually HAS, not what the shape says it should have. A day with four
  // authored tasks is complete at four; the alternative is a learner stuck forever on a
  // sixth task nobody wrote. The shape is the authoring target, checked by its own test,
  // not a runtime assertion aimed at the person using the product.
  // Counted from what the day HAS AUTHORED, not from what has been delivered so far. Mail
  // now arrives through the day rather than all at nine, so counting delivered rows would
  // make the target move under the learner: "1 of 1 activities" at ten o'clock and "1 of 2"
  // after the second one lands.
  const need = { tasks: tasks.length, activities: actKeys.length, situations: sitKeys.length };

  // The quiz belongs to the last day, so the last day is not finished without it. Without
  // this a learner could sign off Friday having skipped it, and the project would then be
  // permanently one item short of complete with nothing left on the board to explain why.
  const quizDef = dayitems.quizFor(run.project_key);
  const quizRequired = Boolean(quizDef) && dayIndex >= PROJECT_WEEK_DAYS;
  const quizTaken = quizRequired
    ? db.prepare('SELECT COUNT(*) n FROM sim_quiz WHERE enrollment_id = ? AND project_key = ?')
        .get(enrollment.id, run.project_key).n > 0
    : false;

  return {
    day: dayIndex,
    tasks: { done: tasksDone, total: need.tasks },
    activities: { done: actsDone, total: need.activities },
    situations: { done: sitsDone, total: need.situations },
    quizRequired,
    quizTaken,
    complete: tasksDone >= need.tasks && actsDone >= need.activities && sitsDone >= need.situations
      && (!quizRequired || quizTaken),
  };
}

// Closing the day.
//
// A day used to end by simply running out of things in it: the sixth task was signed off
// and the learner was already on tomorrow, with nothing having said well done. That is the
// opposite of how a working day feels, and it is the one moment in the week where the
// product has something unambiguously good to say.
//
// So closing is now an act. The day becomes CLOSEABLE when everything in it is done, the
// learner closes it, Asha writes to say what they got through, and only then does tomorrow
// exist. Nothing advances on its own.

function dayRow(enrollment, run, dayIndex) {
  return db.prepare('SELECT * FROM sim_days WHERE enrollment_id = ? AND project_run_id = ? AND day_index = ?')
    .get(enrollment.id, run.id, dayIndex);
}

function dayIsClosed(enrollment, run, dayIndex) {
  const row = dayRow(enrollment, run, dayIndex);
  return Boolean(row && row.closed_at);
}

// The next day opens when today has been CLOSED, not when the clock says so.
//
// The learner's rule, and the right one: somebody who clears Monday by eleven should start
// Tuesday at eleven, not wait until tomorrow for a product they are paying for. The clock
// still governs the DEADLINE — that pressure is most of what makes this a job rather than a
// course — so this is additive: a task opens if its day has arrived OR the day before it is
// signed off.
function dayIsStarted(enrollment, run, dayIndex) {
  if (dayIndex <= 1) return true; // day one starts when the project does
  const row = dayRow(enrollment, run, dayIndex);
  return Boolean(row && row.started_at);
}

// Which day the CALENDAR has reached, read off the tasks themselves rather than
// recomputed from the run's start.
//
// The two must never disagree: the board decides a task is open from its own opens_at, and
// time travel rewrites those. Deriving this independently produced a counter that said
// "day 1 of 5" above twelve open tasks — the same class of bug as the Friday one, from the
// same cause of having two places that know when a day begins.
function unlockedDay(enrollment, run) {
  if (!run) return 1;
  const total = PROJECT_WEEK_DAYS;
  let day = 1;
  while (day < total) {
    // Signed off yesterday AND clocked on today. Both are deliberate: finishing Monday's
    // last task must not slide the learner straight into Tuesday, or the well done they
    // just earned would be on screen for about a second before six more tasks replaced it.
    //
    // The calendar overrides both, because it does in life. If the day this work belongs
    // to has actually arrived, it has arrived whether or not yesterday was finished —
    // yesterday's leftovers become overdue, which is exactly what they are. This is also
    // what keeps time travel usable as a testing tool.
    if (!dayIsClosed(enrollment, run, day)) break;
    if (!dayIsStarted(enrollment, run, day + 1)) break;
    day += 1;
  }
  // The calendar overrides both, because it does in life. If the day this work belongs to
  // has actually arrived, it has arrived whether or not yesterday was signed off —
  // yesterday's leftovers become overdue, which is exactly what they are. It is also what
  // keeps time travel usable as a testing tool.
  return Math.max(day, projectDayOn(run.started_at, Date.now()));
}

// Clocking on tomorrow. The learner's own call, so the end of a day is a full stop rather
// than a comma.
function startNextDay(userId) {
  const enrollment = getEnrollment(userId);
  if (!enrollment) throw new Error('Not enrolled yet.');
  const run = activeRun(enrollment);
  if (!run) throw new Error('No project is running.');

  const current = unlockedDay(enrollment, run);
  if (!dayIsClosed(enrollment, run, current)) throw new Error('Finish today before starting tomorrow.');
  const next = current + 1;
  if (next > PROJECT_WEEK_DAYS) throw new Error('That was the last day of this project.');

  db.prepare(`INSERT INTO sim_days (id, enrollment_id, project_run_id, day_index, started_at, created_at)
              VALUES (?, ?, ?, ?, ?, ?)
              ON CONFLICT(enrollment_id, project_run_id, day_index)
              DO UPDATE SET started_at = COALESCE(sim_days.started_at, excluded.started_at),
                            created_at = excluded.created_at`)
    .run(cryptoRandomId(), enrollment.id, run.id, next, now(), now());

  return { day: next, state: getState(userId) };
}

// What the day still wants from you. The counters say 4 of 6; this says what the missing
// two actually are, which is what a person needs in order to go and do them.
function dayPending(progress) {
  if (!progress) return [];
  const bits = [];
  const left = (done, total, one, many) => {
    const n = Math.max(0, total - done);
    if (n > 0) bits.push(`${n} ${n === 1 ? one : many}`);
  };
  left(progress.tasks.done, progress.tasks.total, 'task', 'tasks');
  left(progress.activities.done, progress.activities.total, 'activity', 'activities');
  left(progress.situations.done, progress.situations.total, 'message to deal with', 'messages to deal with');
  if (progress.quizRequired && !progress.quizTaken) bits.push('the quiz');
  return bits;
}

const DAY_NAMES = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

function closeDay(userId) {
  const enrollment = getEnrollment(userId);
  if (!enrollment) throw new Error('Not enrolled yet.');
  const run = activeRun(enrollment);
  if (!run) throw new Error('No project is running.');

  const dayIndex = unlockedDay(enrollment, run);
  if (dayIsClosed(enrollment, run, dayIndex)) throw new Error('You have already signed off today.');

  const progress = dayProgress(enrollment, run, dayIndex);
  if (!progress || !progress.complete) {
    const pending = dayPending(progress);
    throw new Error(pending.length
      ? `Not yet — you still have ${pending.join(', ')} today.`
      : 'Today is not finished yet.');
  }

  db.prepare(`INSERT INTO sim_days (id, enrollment_id, project_run_id, day_index, closed_at, created_at)
              VALUES (?, ?, ?, ?, ?, ?)
              ON CONFLICT(enrollment_id, project_run_id, day_index) DO UPDATE SET closed_at = excluded.closed_at`)
    .run(cryptoRandomId(), enrollment.id, run.id, dayIndex, now(), now());

  const def = catalogFor(enrollment.role, enrollment.level).find((p) => p.key === run.project_key);
  const learner = firstName((db.prepare('SELECT name FROM profiles WHERE user_id = ?').get(userId) || {}).name) || 'there';
  const last = dayIndex >= PROJECT_WEEK_DAYS;
  const dayName = DAY_NAMES[dayIndex] || `day ${dayIndex}`;

  // Named, not generic. "Good work today" is what a bot says; a manager tells you what she
  // saw you get through, because that is the part you can be proud of tomorrow.
  const body = last
    ? `${learner} — that's the week. ${progress.tasks.total} tasks signed off, ${progress.activities.total} activities, everything in your inbox dealt with, and the quiz sat.

`
      + `That is a full project delivered, which is not a small thing for a first one. Take the win. I'll have the next piece of work ready when you are.`
    : `${learner} — that's ${dayName} done. ${progress.tasks.total} tasks through review, ${progress.activities.total} activities, and you cleared what landed on you.

`
      + `Nothing else from me today. Shut the laptop — we'll pick it up tomorrow.`;

  addMessage(enrollment.id, 'line_manager', LINE_MANAGER_NAME, body, null,
    last ? `${def ? def.title : 'The project'} — that's the week` : `${dayName} — you're done`, 'line_manager');

  return {
    closed: true,
    day: dayIndex,
    last,
    summary: {
      tasks: progress.tasks.total,
      activities: progress.activities.total,
      situations: progress.situations.total,
      quiz: Boolean(progress.quizTaken),
    },
    message: body,
    state: getState(userId),
  };
}

// ---- Activities ----------------------------------------------------------------------

function gradeActivityAnswer(check, text) {
  const body = String(text || '').trim();
  const words = body.split(/\s+/).filter(Boolean).length;
  if (words < 5) return { score: 0, feedback: 'There is not enough here to be an answer.' };
  const hit = (check.markers || []).filter((m) => new RegExp(m, 'i').test(body)).length;
  const total = (check.markers || []).length || 1;
  const over = check.maxWords && words > check.maxWords;
  let score = Math.round((hit / total) * 100);
  if (over) score = Math.max(0, score - 10);
  return {
    score,
    feedback: hit === total
      ? (check.why || 'That covers it.')
      : `${check.why || ''}`.trim() || 'Some of what this was looking for is missing.',
  };
}

function completeActivity(userId, activityKey, answer) {
  const enrollment = getEnrollment(userId);
  if (!enrollment) throw new Error('Not enrolled yet.');
  const row = itemRow('sim_activities', enrollment.id, activityKey);
  if (!row) throw new Error('That activity has not arrived yet.');
  if (row.status === 'done') throw new Error('You have already done that one.');

  const run = db.prepare('SELECT * FROM sim_project_runs WHERE id = ?').get(row.project_run_id);
  const def = dayitems.activitiesFor(run ? run.project_key : '').find((a) => a.key === activityKey);
  if (!def) throw new Error('Unknown activity.');

  let score = null;
  let feedback = null;
  const check = def.check || { kind: 'acknowledge' };

  if (check.kind === 'choice') {
    const picked = String(answer || '');
    const right = (check.options.find((o) => o.correct) || {}).key;
    score = picked === right ? 100 : 0;
    feedback = check.why || (score ? 'Correct.' : 'Not quite.');
  } else if (check.kind === 'answer') {
    const marked = gradeActivityAnswer(check, answer);
    score = marked.score;
    feedback = marked.feedback;
  }

  db.prepare("UPDATE sim_activities SET status = 'done', score = ?, payload_json = ?, completed_at = ? WHERE id = ?")
    .run(score, JSON.stringify({ ...(safeJson(row.payload_json) || {}), answer: String(answer || '') }), now(), row.id);

  // The person who sent it replies, because an activity that vanishes when you finish it
  // does not feel like something a colleague asked you for.
  const person = ROSTER.find((r) => r.archetype === def.from) || ROSTER[0];
  if (feedback) {
    addMessage(enrollment.id, def.from, person.name, feedback, null,
      def.via === 'email' ? `Re: ${def.subject}` : null, def.from);
  }
  return { score, feedback, state: getState(userId) };
}

// ---- Situations ------------------------------------------------------------------------

const SITUATION_ACTIONS = ['reply', 'defer', 'archive', 'escalate'];

function handleSituation(userId, situationKey, action, text) {
  const enrollment = getEnrollment(userId);
  if (!enrollment) throw new Error('Not enrolled yet.');
  if (!SITUATION_ACTIONS.includes(action)) throw new Error('Unknown action.');
  const row = itemRow('sim_situations', enrollment.id, situationKey);
  if (!row) throw new Error('That has not arrived yet.');
  if (row.handled_as) throw new Error('You have already dealt with that one.');

  const run = db.prepare('SELECT * FROM sim_project_runs WHERE id = ?').get(row.project_run_id);
  const def = situationDef(run ? run.project_key : '', situationKey);
  if (!def) throw new Error('Unknown situation.');

  let score = 0;
  let feedback = '';

  if (def.needsReply) {
    if (action === 'reply') {
      const marked = gradeActivityAnswer({ markers: def.markers, maxWords: 160, why: '' }, text);
      score = marked.score;
      feedback = score >= 50
        ? 'Thanks — that is what I needed.'
        : 'Noted, though that leaves the bit I actually asked about open.';
    } else if (action === 'escalate') {
      // Escalating something you could have answered is not free. It is not wrong either —
      // sometimes it is exactly right — so it scores in the middle rather than at zero.
      score = 40;
      feedback = 'Passed up the line. Fair enough, though this one was probably yours to answer.';
    } else {
      score = 0;
      feedback = def.ifIgnored || 'Left unanswered.';
    }
  } else {
    // The noise. Archiving or deferring it is the CORRECT handling, and replying to it is
    // the mistake — twenty minutes spent on a timesheet reminder is twenty minutes gone.
    // Without this, triage is not a decision and the learner simply answers everything.
    score = (action === 'archive' || action === 'defer') ? 100 : 30;
    feedback = score === 100
      ? 'Right call — that one needed nothing from you.'
      : 'You answered a message that did not need one. Not a disaster, but that is time you had.';
  }

  db.prepare("UPDATE sim_situations SET handled_as = ?, handled_at = ?, score = ? WHERE id = ?")
    .run(action, now(), score, row.id);

  if (action === 'reply' && String(text || '').trim()) {
    // The Programme Office is not on the roster — it only ever exists as mail — so an
    // ambient sender carries its own display name rather than being looked up.
    const person = ROSTER.find((r) => r.archetype === def.from);
    const senderName = def.senderName || (person ? person.name : ROSTER[0].name);
    const subject = row.message_id
      ? (db.prepare('SELECT subject FROM sim_messages WHERE id = ?').get(row.message_id) || {}).subject
      : def.subject;
    addMessage(enrollment.id, 'learner', 'You', String(text).trim(), null,
      def.via === 'email' ? `Re: ${subject || def.subject}` : null, def.from);
    addMessage(enrollment.id, def.from, senderName, feedback, null,
      def.via === 'email' ? `Re: ${subject || def.subject}` : null, def.from);
  }
  return { score, feedback, state: getState(userId) };
}

// Doing the timesheet.
//
// Validated properly rather than waved through, because a form that accepts anything is
// not a form, it is a button with a text box next to it. Nothing here is graded and none
// of it gates the day — the only reward is the small satisfaction of the thing being done,
// which is exactly the reward the real ones carry.
function completeChore(userId, choreKey, values) {
  const enrollment = getEnrollment(userId);
  if (!enrollment) throw new Error('Not enrolled yet.');
  const row = db.prepare('SELECT * FROM sim_chores WHERE enrollment_id = ? AND chore_key = ?')
    .get(enrollment.id, choreKey);
  if (!row) throw new Error('That has not arrived yet.');
  if (row.done_at) throw new Error('You have already done that one.');

  const def = ambientmail.choreByKey(choreKey);
  if (!def) throw new Error('Unknown item.');

  const run = db.prepare('SELECT * FROM sim_project_runs WHERE id = ?').get(row.project_run_id);
  const projectDef = run ? catalogFor(enrollment.role, enrollment.level).find((p) => p.key === run.project_key) : null;
  const projectTitle = projectDef ? projectDef.title : 'this project';

  const given = values && typeof values === 'object' ? values : {};
  const clean = {};
  for (const field of def.action.fields) {
    const raw = given[field.key];
    if (field.kind === 'ack') {
      if (field.required && raw !== true) throw new Error(`Tick "${field.label}" first.`);
      clean[field.key] = raw === true ? 'Confirmed' : 'Not confirmed';
    } else if (field.kind === 'number') {
      const n = Number(raw);
      if (!Number.isFinite(n)) throw new Error(`${field.label} needs a number.`);
      if (n < field.min || n > field.max) throw new Error(`${field.label} should be between ${field.min} and ${field.max}.`);
      clean[field.key] = String(n);
    } else if (field.kind === 'choice') {
      const options = field.options.map((o) => fillMail(o, '', projectTitle));
      if (!options.includes(String(raw))) throw new Error(`Pick one of the options for ${field.label}.`);
      clean[field.key] = String(raw);
    }
  }

  db.prepare('UPDATE sim_chores SET values_json = ?, done_at = ? WHERE id = ?')
    .run(JSON.stringify(clean), now(), row.id);

  // The confirmation quotes back what was entered, because a receipt that does not tell
  // you what it received is not a receipt.
  let confirm = def.confirm;
  for (const [k, v] of Object.entries(clean)) confirm = confirm.split(`{${k}}`).join(v);
  const subject = row.message_id
    ? (db.prepare('SELECT subject FROM sim_messages WHERE id = ?').get(row.message_id) || {}).subject
    : def.subject;
  addMessage(enrollment.id, def.from, def.senderName, confirm, null,
    `Re: ${subject || def.subject}`, def.from);

  return { done: true, confirm, values: clean, state: getState(userId) };
}

// ---- The Friday quiz -------------------------------------------------------------------

function getQuiz(enrollment, run) {
  if (!run) return null;
  const quiz = dayitems.quizFor(run.project_key);
  if (!quiz) return null;
  const taken = db.prepare('SELECT COUNT(*) c FROM sim_quiz WHERE enrollment_id = ? AND project_key = ?')
    .get(enrollment.id, run.project_key).c;
  const day = unlockedDay(enrollment, run);
  const lastDayDone = (dayProgress(enrollment, run, PROJECT_WEEK_DAYS) || {}).tasks;
  const open = day >= PROJECT_WEEK_DAYS && lastDayDone && lastDayDone.done >= lastDayDone.total;

  if (taken) {
    const rows = db.prepare('SELECT correct FROM sim_quiz WHERE enrollment_id = ? AND project_key = ?')
      .all(enrollment.id, run.project_key);
    const right = rows.filter((r) => r.correct).length;
    return { key: quiz.key, title: quiz.title, taken: true, open: false,
             score: Math.round((right / rows.length) * 100), right, total: rows.length, questions: [] };
  }
  return {
    key: quiz.key, title: quiz.title, intro: quiz.intro, taken: false, open,
    // Not sat yet, so the answers stay on the server. Options are shuffled per learner for
    // the same reason the judgement tasks are.
    questions: open ? quiz.questions.map((q, i) => ({
      id: q.id, topic: q.topic, q: q.q,
      options: tasktypes.shuffleSeeded(q.options.map((o) => ({ key: o.key, label: o.label })),
        tasktypes.seedFrom(`${enrollment.id}-${q.id}`)),
    })) : [],
    total: quiz.questions.length,
  };
}

function submitQuiz(userId, answers) {
  const enrollment = getEnrollment(userId);
  if (!enrollment) throw new Error('Not enrolled yet.');
  // The most recent run, open or not. Sitting the quiz is what CLOSES the project, so by
  // the time someone submits it a second time there is no active run — and "no project is
  // running" is a confusing thing to be told when the truthful answer is that you already
  // did this one.
  const run = activeRun(enrollment)
    || db.prepare('SELECT * FROM sim_project_runs WHERE enrollment_id = ? ORDER BY COALESCE(completed_at, started_at) DESC LIMIT 1').get(enrollment.id);
  if (!run) throw new Error('No project is running.');
  const quiz = dayitems.quizFor(run.project_key);
  if (!quiz) throw new Error('No quiz for this project.');
  const already = db.prepare('SELECT COUNT(*) c FROM sim_quiz WHERE enrollment_id = ? AND project_key = ?')
    .get(enrollment.id, run.project_key).c;
  if (already) throw new Error('You have already sat this one.');

  const given = (answers && typeof answers === 'object') ? answers : {};
  const marked = [];
  for (const q of quiz.questions) {
    const chosen = given[q.id] || null;
    const right = (q.options.find((o) => o.correct) || {}).key;
    const correct = chosen === right ? 1 : 0;
    db.prepare(`INSERT INTO sim_quiz (id, enrollment_id, question_key, project_key, answered_on, chosen, correct, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(cryptoRandomId(), enrollment.id, q.id, run.project_key, today(), chosen, correct, now());
    marked.push({ id: q.id, q: q.q, chosen, right, correct: Boolean(correct), why: q.why });
  }
  const right = marked.filter((m) => m.correct).length;
  return { score: Math.round((right / marked.length) * 100), right, total: marked.length,
           results: marked, state: getState(userId) };
}

function activeRun(enrollment) {
  return db.prepare('SELECT * FROM sim_project_runs WHERE enrollment_id = ? AND completed_at IS NULL ORDER BY started_at DESC LIMIT 1')
    .get(enrollment.id);
}

// ---- Finishing the project --------------------------------------------------------------
//
// Everything has to be done, not just the analysis: 30 tasks, 10 activities, 10 situations
// and the quiz. Then Asha says so properly — naming what they actually did rather than
// congratulating them in general, because a generic well done from a manager is worth less
// than nothing and every learner knows it.

function projectCompletion(enrollment, run) {
  if (!run) return null;
  const def = catalogFor(enrollment.role, enrollment.level).find((p) => p.key === run.project_key);
  if (!def) return null;

  const rows = db.prepare('SELECT task_key, status, score FROM sim_tasks WHERE enrollment_id = ?').all(enrollment.id)
    .filter((t) => def.taskKeys.includes(t.task_key));
  const tasksDone = rows.filter((t) => t.status === 'graded' || t.status === 'parked').length;

  const acts = db.prepare('SELECT status, score FROM sim_activities WHERE enrollment_id = ? AND project_run_id = ?')
    .all(enrollment.id, run.id);
  // Project situations only. The ambient desk mail shares this table, and counting it here
  // would let a learner finish the project by answering the Programme Office ten times.
  const ownSitKeys = new Set(dayitems.situationsFor(run.project_key).map((x) => x.key));
  const sits = db.prepare('SELECT situation_key, handled_as, score FROM sim_situations WHERE enrollment_id = ? AND project_run_id = ?')
    .all(enrollment.id, run.id)
    .filter((x) => ownSitKeys.has(x.situation_key));
  const quizRows = db.prepare('SELECT correct FROM sim_quiz WHERE enrollment_id = ? AND project_key = ?')
    .all(enrollment.id, run.project_key);

  const totalActs = dayitems.activitiesFor(run.project_key).length;
  const totalSits = dayitems.situationsFor(run.project_key).length;
  const hasQuiz = Boolean(dayitems.quizFor(run.project_key));

  const complete = tasksDone >= def.taskKeys.length
    && acts.filter((a) => a.status === 'done').length >= totalActs
    && sits.filter((x) => x.handled_as).length >= totalSits
    && (!hasQuiz || quizRows.length > 0);

  const graded = rows.filter((t) => t.status === 'graded' && typeof t.score === 'number');
  return {
    complete,
    tasks: { done: tasksDone, total: def.taskKeys.length },
    activities: { done: acts.filter((a) => a.status === 'done').length, total: totalActs },
    situations: { done: sits.filter((x) => x.handled_as).length, total: totalSits },
    quiz: { taken: quizRows.length > 0, required: hasQuiz,
            score: quizRows.length ? Math.round((quizRows.filter((q) => q.correct).length / quizRows.length) * 100) : null },
    avgScore: graded.length ? Math.round(graded.reduce((a, t) => a + t.score, 0) / graded.length) : null,
    best: graded.length ? graded.slice().sort((a, b) => b.score - a.score)[0] : null,
  };
}

// Sign the project off and say so. Fires at read time, once, the moment everything is done.
function finishProjectIfComplete(enrollment) {
  const run = activeRun(enrollment);
  if (!run) return false;
  const c = projectCompletion(enrollment, run);
  if (!c || !c.complete) return false;

  db.prepare('UPDATE sim_project_runs SET completed_at = ? WHERE id = ?').run(now(), run.id);

  const def = catalogFor(enrollment.role, enrollment.level).find((p) => p.key === run.project_key);
  const profile = db.prepare('SELECT name FROM profiles WHERE user_id = ?').get(enrollment.user_id);
  const learner = firstName(profile && profile.name) || 'there';
  const bestTitle = c.best ? c.best.title || '' : '';

  // Specific, because specific is the only kind that lands. "Well done on the project" is
  // what a manager says when they have not read it.
  const lines = [
    `${learner} — that is Q1 Compensation Review closed out. Properly done.`,
    '',
    `You delivered ${c.tasks.total} pieces of work across the week, handled ${c.situations.total} things that landed on you unannounced, and got through the training alongside it${c.avgScore ? `, averaging ${c.avgScore} on the graded work` : ''}.`,
  ];
  if (c.quiz.taken && c.quiz.score !== null) {
    lines.push('', `The Friday check came out at ${c.quiz.score}%. ${c.quiz.score >= 70 ? 'That is a good read on the week.' : 'Worth going back over the ones you missed — the reasons are on each of them.'}`);
  }
  lines.push('',
    'What I would actually tell someone about you: you took a question that could not be answered as asked, said so early, and gave Vikram something he could use instead. That is the part people find hard.',
    '',
    'Next one is waiting when you are. Take a break first — you have earned the afternoon.');

  addMessage(enrollment.id, 'line_manager', LINE_MANAGER_NAME, lines.join('\n'), null,
    `${def ? def.title : 'Project'} — signed off`, 'line_manager');
  return true;
}

// ---- Testing the week without waiting a week -----------------------------------------
//
// Day 2 arrives tomorrow, which makes the week impossible to test in one sitting. This
// moves a learner's whole clock backwards by a day, so "now" lands on the next day of
// their project. Everything dated moves together — the project run, its deadline, and
// every task's assigned/opens/due timestamps — because shifting only some of them would
// produce a state the product can never reach on its own, and then a bug found while
// testing might not be a real bug.
//
// Gated on TIME_TRAVEL=1. This has to be off for real learners: a control that skips a
// day would let anyone walk past every deadline in the programme, and the deadline is
// most of what makes this a job rather than a course.
const TIME_TRAVEL_ENABLED = process.env.TIME_TRAVEL === '1';

function shiftIso(iso, ms) {
  return iso ? new Date(Date.parse(iso) - ms).toISOString() : iso;
}

// How many CALENDAR days to shift so the learner advances `n` WORKING days.
//
// A flat 24 hours is the obvious implementation and the wrong one: shift a Monday start
// twice and you land on Saturday, where the working-day counter does not move and pressing
// the button again appears to do nothing. That is exactly what happened — the day stuck
// at 3 and would not go further.
//
// Rather than compute it, search for it: ask the day counter itself how far back the
// start has to move. Slower and obviously right, against arithmetic that was neither.
// Is this task workable yet?
//
// One rule, in one place. It is the third time a second copy of this has drifted out of
// step with the board — a Friday start, a Saturday "complete the day" that cleared nothing,
// a project card congratulating a learner who had not started. A task is open once its day
// has ARRIVED on the calendar or been EARNED by finishing the day before.
function taskIsOpen(task, unlockedDayIndex, nowMs) {
  const arrived = !task.opens_at || Date.parse(task.opens_at) <= nowMs;
  const earned = unlockedDayIndex && task.day_index && task.day_index <= unlockedDayIndex;
  return Boolean(arrived || earned);
}

// Which day of a project week the calendar has reached.
//
// There is exactly one definition of this, and everything uses it: the task board, the
// project card, the day counter and time travel. Three of those used to compute it three
// slightly different ways, which is how a Friday start produced "day 2 of 5" above an
// empty board, and how "jump one working day" on a Saturday moved the learner BACKWARDS
// into the previous week.
//
// The definition is the one the work itself already obeys: day N has arrived when
// addWorkingDays(start, N) has passed, because that is exactly when day N's tasks open.
function projectDayOn(startIso, nowMs) {
  let day = 1;
  for (let d = 1; d <= PROJECT_WEEK_DAYS; d += 1) {
    if (addWorkingDays(startIso, d).getTime() <= nowMs) day = d;
  }
  return day;
}

function calendarDaysForWorkingDays(startIso, n) {
  const nowMs = Date.now();
  const want = projectDayOn(startIso, nowMs) + Number(n);
  if (want < 1 || want > PROJECT_WEEK_DAYS) {
    throw new Error(`A project week is ${PROJECT_WEEK_DAYS} days — day ${want} is outside it.`);
  }
  // Moving the START backwards moves the learner FORWARDS through the week. Search in
  // whole calendar days for the smallest shift that lands on the day asked for; weekends
  // make the relationship non-linear, which is the entire reason this is a search rather
  // than arithmetic.
  const dir = n > 0 ? 1 : -1;
  for (let shift = dir; Math.abs(shift) <= 60; shift += dir) {
    const moved = new Date(Date.parse(startIso) - shift * DAY_MS).toISOString();
    if (projectDayOn(moved, nowMs) === want) return shift;
  }
  throw new Error('Could not reach that day.');
}

function timeTravel(userId, spec) {
  if (!TIME_TRAVEL_ENABLED) throw new Error('Time travel is not enabled on this server.');
  const enrollment = getEnrollment(userId);
  if (!enrollment) throw new Error('Not enrolled yet.');

  const opts = (spec && typeof spec === 'object') ? spec : { days: spec };
  const run = db.prepare('SELECT * FROM sim_project_runs WHERE enrollment_id = ? AND completed_at IS NULL ORDER BY started_at DESC LIMIT 1')
    .get(enrollment.id);

  let n;
  if (opts.to === 'past-deadline') {
    // Landing exactly on the deadline is not past it — the chase needs a full day to have
    // elapsed. Computing that by hand is the friction this panel exists to remove.
    if (!run) throw new Error('No project is running, so there is no deadline to miss.');
    // The deadline is end-of-day, and a chase needs a FULL day to have elapsed past it.
    // Landing eight hours past midnight on the due date counts as zero days overdue, so
    // the first attempt at this quietly did nothing.
    n = Math.ceil((Date.parse(run.due_at) - Date.now()) / DAY_MS) + 1;
    if (n <= 0) throw new Error('That deadline has already passed.');
  } else if (opts.workingDays) {
    if (!run) throw new Error('No project is running yet.');
    n = calendarDaysForWorkingDays(run.started_at, Number(opts.workingDays));
  } else {
    n = Number(opts.days);
  }

  if (!Number.isFinite(n) || n === 0 || Math.abs(n) > 60) {
    throw new Error('Move by between -60 and 60 days.');
  }
  const ms = n * DAY_MS;

  // The enrollment itself, so "days since joining" and the calendar's joining-day lock
  // move with everything else.
  db.prepare('UPDATE sim_enrollments SET created_at = ? WHERE id = ?')
    .run(shiftIso(enrollment.created_at, ms), enrollment.id);

  for (const r of db.prepare('SELECT * FROM sim_project_runs WHERE enrollment_id = ?').all(enrollment.id)) {
    db.prepare('UPDATE sim_project_runs SET started_at = ?, due_at = ?, completed_at = ? WHERE id = ?')
      .run(shiftIso(r.started_at, ms), shiftIso(r.due_at, ms), shiftIso(r.completed_at, ms), r.id);
  }

  // opens_at is REBUILT from the moved start rather than slid along with everything else.
  //
  // Sliding it looks right and is wrong across a weekend. A project starting on a Friday has
  // its day-2 work opening on the Monday — three calendar days later, but only one WORKING
  // day. Move the clock on by one working day and the shift is one calendar day, so the day
  // counter correctly reads 2 while opens_at lands on the Sunday and the work stays shut.
  // The learner sees "day 2 of 5" above an empty board.
  //
  // A bigger shift cannot fix it either: enough to drag Monday into the past would carry the
  // counter to day 4. The two quantities are measured in different units, so the only sound
  // answer is to derive one from the other — which is what created them in the first place.
  const movedRun = db.prepare('SELECT started_at FROM sim_project_runs WHERE enrollment_id = ? AND completed_at IS NULL ORDER BY started_at DESC LIMIT 1')
    .get(enrollment.id);
  for (const t of db.prepare('SELECT * FROM sim_tasks WHERE enrollment_id = ?').all(enrollment.id)) {
    const opensAt = (t.day_index && movedRun)
      ? addWorkingDays(movedRun.started_at, t.day_index).toISOString()
      : shiftIso(t.opens_at, ms);
    db.prepare('UPDATE sim_tasks SET assigned_at = ?, opens_at = ?, due_at = ?, submitted_at = ?, graded_at = ? WHERE id = ?')
      .run(shiftIso(t.assigned_at, ms), opensAt, shiftIso(t.due_at, ms),
           shiftIso(t.submitted_at, ms), shiftIso(t.graded_at, ms), t.id);
  }

  // Messages too, or the inbox shows tomorrow's mail arriving before today's.
  for (const m of db.prepare('SELECT id, created_at FROM sim_messages WHERE enrollment_id = ?').all(enrollment.id)) {
    db.prepare('UPDATE sim_messages SET created_at = ? WHERE id = ?').run(shiftIso(m.created_at, ms), m.id);
  }

  // Attendance is stored as a plain date, so it shifts by whole days only.
  const whole = Math.trunc(n);
  if (whole !== 0) {
    for (const a of db.prepare('SELECT id, attended_on FROM sim_attendance WHERE enrollment_id = ?').all(enrollment.id)) {
      db.prepare('UPDATE sim_attendance SET attended_on = ? WHERE id = ?')
        .run(shiftDay(a.attended_on, -whole), a.id);
    }
  }

  // The stand-up is recorded per day, so yesterday's would otherwise block today's.
  db.prepare('DELETE FROM sim_standups WHERE enrollment_id = ?').run(enrollment.id);

  return getState(userId);
}

// Start the whole simulation over: back to day one, nothing on record.
//
// The clock buttons move a learner forward, and there is no arithmetic that reliably
// undoes several of them — "back a day" four times does not return you to where you
// started once messages have fired and a project has been graded. So reset does not try
// to rewind. It deletes the enrollment and re-creates it, which is the only version of
// "start over" that is actually true.
//
// Every simulation table is ON DELETE CASCADE from sim_enrollments and foreign keys are
// enforced, so removing that one row takes the tasks, project runs, messages, contacts,
// stand-ups and attendance with it. The learner lands back where a new joiner lands: the
// welcome mail and the skills check, with the same level and schedule they picked.
function timeTravelReset(userId, opts) {
  if (!TIME_TRAVEL_ENABLED) throw new Error('Time travel is not enabled on this server.');
  const enrollment = getEnrollment(userId);
  if (!enrollment) throw new Error('Not enrolled yet, so there is nothing to reset.');

  const { schedule_type: scheduleType, schedule_days_json: scheduleDaysJson } = enrollment;
  let scheduleDays = null;
  try { scheduleDays = JSON.parse(scheduleDaysJson); } catch { scheduleDays = null; }

  // Landing somewhere the tester did not ask for is worse than refusing, because they would
  // spend the next ten minutes testing the wrong level without noticing.
  const level = (opts && opts.level) || enrollment.level;
  if (!LEVELS.some((l) => l.key === level)) throw new Error(`Unknown level: ${level}`);
  const role = (opts && opts.role) || enrollment.role;
  if (!ROLE_CATALOG[role]) throw new Error(`Unknown role: ${role}`);

  db.prepare('DELETE FROM sim_enrollments WHERE id = ?').run(enrollment.id);
  startEnrollment(userId, { level, scheduleType, scheduleDays });
  // startEnrollment only builds Data Analyst today; when a second role exists it will take
  // the role too. Setting it here means the switcher is already honest about what it did.
  if (role !== 'data_analyst') {
    db.prepare('UPDATE sim_enrollments SET role = ? WHERE user_id = ?').run(role, userId);
  }
  return getState(userId);
}

// Fill the skills check in without answering it.
//
// The check gates the whole dashboard — deliberately, because on a real day one there is
// genuinely nothing else yet. But that makes it a wall for whoever is testing: every reset
// would mean twelve questions before you can reach the thing you actually changed.
//
// The answers are fixed rather than random, and deliberately imperfect: seven of twelve
// right. A baseline of 100 would make every later improvement look like a flat line, which
// is the opposite of what the skill matrix is for.
function timeTravelSkipSkillTest(userId) {
  if (!TIME_TRAVEL_ENABLED) throw new Error('Time travel is not enabled on this server.');
  const enrollment = getEnrollment(userId);
  if (!enrollment) throw new Error('Not enrolled yet.');
  if (enrollment.baseline_at) return getState(userId);

  const questions = skilltest.QUESTIONS;
  const answers = {};
  questions.forEach((q, i) => {
    const wrong = (q.options.find((o) => o.key !== q.answer) || q.options[0]).key;
    answers[q.id] = i < 7 ? q.answer : wrong;
  });
  submitSkillTest(userId, answers);
  return getState(userId);
}

// Mark a task done without doing it.
//
// Testing anything past a single task means getting through the ones in front of it, and
// answering six SQL questions to reach the seventh is not testing, it is data entry.
//
// This deliberately bypasses grading rather than submitting a correct answer. Every task
// type would otherwise need its own "what is the right answer" path here, and that code
// would rot the moment a new type is added — silently, because a tester skipping a task
// does not read the score. Writing the outcome directly is honest about what it is, and
// the feedback line says so on the learner's own board.
//
// The score is a fixed 82: good work, not perfect. A wall of 100s would make the skill
// matrix, the promotion threshold and the shoutout rule all behave in ways no real learner
// would ever produce, which is the opposite of useful for testing.
const TEST_COMPLETE_SCORE = 82;

function completeOneTask(enrollment, row) {
  db.prepare(`UPDATE sim_tasks
                 SET status = 'graded', score = ?, feedback = ?, submission = ?,
                     review_state = NULL, review_question = NULL,
                     opens_at = NULL, submitted_at = ?, graded_at = ?
               WHERE id = ?`)
    .run(TEST_COMPLETE_SCORE,
         'Completed from the testing panel — this was not graded, and the score is a fixed stand-in.',
         '(auto-completed for testing)', now(), now(), row.id);
}

function timeTravelCompleteTask(userId, taskId) {
  if (!TIME_TRAVEL_ENABLED) throw new Error('Time travel is not enabled on this server.');
  const enrollment = getEnrollment(userId);
  if (!enrollment) throw new Error('Not enrolled yet.');
  const row = db.prepare('SELECT * FROM sim_tasks WHERE id = ? AND enrollment_id = ?')
    .get(taskId, enrollment.id);
  if (!row) throw new Error('No such task.');
  if (row.status === 'graded') throw new Error('That task is already signed off.');

  completeOneTask(enrollment, row);
  return getState(userId);
}

// Everything the learner can currently see and work on. A task belonging to a later day is
// left alone: the drip is itself a thing worth testing, and clearing it here would hide
// whether it works.
function timeTravelCompleteDay(userId) {
  if (!TIME_TRAVEL_ENABLED) throw new Error('Time travel is not enabled on this server.');
  const enrollment = getEnrollment(userId);
  if (!enrollment) throw new Error('Not enrolled yet.');

  const nowMs = Date.now();
  // The same rule the board uses. Filtering on opens_at alone cleared nothing at all on a
  // weekend, because a project starting on a Saturday has its day-1 work opening Monday.
  const run = activeRun(enrollment);
  const unlocked = run ? unlockedDay(enrollment, run) : 1;
  const rows = db.prepare("SELECT * FROM sim_tasks WHERE enrollment_id = ? AND status != 'graded'")
    .all(enrollment.id)
    .filter((t) => taskIsOpen(t, unlocked, nowMs));

  for (const row of rows) completeOneTask(enrollment, row);
  return { completed: rows.length, state: getState(userId) };
}

// Where the learner currently is, so the control can say what pressing it will do.
function timeTravelState(enrollment, projects) {
  if (!TIME_TRAVEL_ENABLED) return { enabled: false };
  const active = projects.find((p) => p.status === 'active' && p.week);
  return {
    enabled: true,
    day: active ? active.week.day : null,
    totalDays: active ? active.week.totalDays : null,
    project: active ? active.title : null,
    // Built from the catalogue rather than hardcoded in the UI, so the picker grows on its
    // own the day a second role is added and nobody has to remember to update a dropdown.
    roles: Object.entries(ROLE_CATALOG).map(([key, r]) => ({ key, label: r.label })),
    levels: LEVELS,
    role: enrollment.role,
    level: enrollment.level,
  };
}

function startProject(userId, projectKey) {
  const enrollment = getEnrollment(userId);
  if (!enrollment) throw new Error('Not enrolled yet.');
  const def = catalogFor(enrollment.role, enrollment.level).find((p) => p.key === projectKey);
  if (!def) throw new Error('Unknown project.');

  const tasks = db.prepare('SELECT * FROM sim_tasks WHERE enrollment_id = ?').all(enrollment.id);
  const attendanceRows = db.prepare('SELECT attended_on FROM sim_attendance WHERE enrollment_id = ?').all(enrollment.id);
  const streaks = computeStreaks(attendanceRows.map((r) => r.attended_on));
  const current = getProjects(enrollment.role, tasks, streaks, enrollment.id, enrollment.level).projects.find((p) => p.key === projectKey);

  if (current.status === 'writing') {
    throw new Error('That project is still being written — it is not ready to start yet.');
  }
  if (current.status === 'locked') throw new Error(`${current.requirement} before starting this one.`);
  if (current.status !== 'available') throw new Error('That project is already underway.');

  const run = startProjectRun(enrollment.id, projectKey);

  for (const key of def.taskKeys) {
    const taskId = assignTask(enrollment.id, key, run.started_at);
    const task = TASKS[key];
    // Only day-1 work is announced. A task that opens on Wednesday should arrive on
    // Wednesday, not sit in the inbox from Monday spoiling the shape of the week.
    if ((TASKS[key].day || 1) === 1) {
      addMessage(enrollment.id, 'line_manager', LINE_MANAGER_NAME,
        `You're picking up ${def.title}. First task: ${task.title}. ${task.brief}`, taskId);
    }
  }
  return getState(userId);
}

// Read/star updates. Scoped to the caller's own enrollment, so a crafted request can
// never touch another learner's mail even if it guesses valid message ids.
function markMessages(userId, ids, patch) {
  const enrollment = getEnrollment(userId);
  if (!enrollment) throw new Error('Not enrolled yet.');
  if (!Array.isArray(ids) || !ids.length) throw new Error('No messages specified.');
  if (ids.length > 200) throw new Error('Too many messages in one request.');
  if (!ids.every((id) => typeof id === 'string' && /^[a-f0-9]{1,64}$/i.test(id))) {
    throw new Error('Invalid message id.');
  }

  const placeholders = ids.map(() => '?').join(',');
  if (typeof patch.read === 'boolean') {
    db.prepare(`UPDATE sim_messages SET read_at = ? WHERE enrollment_id = ? AND id IN (${placeholders})`)
      .run(patch.read ? now() : null, enrollment.id, ...ids);
  }
  if (typeof patch.starred === 'boolean') {
    db.prepare(`UPDATE sim_messages SET starred = ? WHERE enrollment_id = ? AND id IN (${placeholders})`)
      .run(patch.starred ? 1 : 0, enrollment.id, ...ids);
  }
  return getState(userId);
}

function toggleChecklistItem(userId, itemKey, checked) {
  const enrollment = getEnrollment(userId);
  if (!enrollment) throw new Error('Not enrolled yet.');
  const validKeys = (CHECKLIST_ITEMS[enrollment.role] || []).map((i) => i.key);
  if (!validKeys.includes(itemKey)) throw new Error('Unknown checklist item.');
  const state = JSON.parse(enrollment.checklist_json || '{}');
  state[itemKey] = Boolean(checked);
  db.prepare('UPDATE sim_enrollments SET checklist_json = ? WHERE id = ?').run(JSON.stringify(state), enrollment.id);
  return getState(userId);
}

function checkIn(userId) {
  const enrollment = getEnrollment(userId);
  if (!enrollment) throw new Error('Not enrolled');
  try {
    db.prepare('INSERT INTO sim_attendance (id, enrollment_id, attended_on, created_at) VALUES (?, ?, ?, ?)')
      .run(cryptoRandomId(), enrollment.id, today(), now());
  } catch (e) {
    if (!/UNIQUE/i.test(e.message)) throw e; // already checked in today — fine, idempotent
  }
  return getState(userId);
}

// Only SELECT is ever allowed, and only a single statement — enforced even though the
// query already runs against a disposable in-memory DB with nothing sensitive in it.
// Defense in depth costs nothing here.
// Removes SQL comments and blanks out string literals, so the safety checks below see
// only executable code. Three things were wrong without this: the editor's own starter
// template begins with `-- Write your query here.`, so the very first Run was rejected
// for "not starting with SELECT"; a comment like `-- don't delete this` tripped the
// keyword blocklist; and a semicolon or an apostrophe inside a string was read as a
// second statement.
//
// String literals are blanked rather than removed so their position is preserved but
// their CONTENTS can never satisfy a check — a query is not allowed to smuggle
// `; DROP` past the guard by hiding it in quotes. What is left is exactly what SQLite
// will execute, minus the text it ignores.
function stripSqlNoise(sql) {
  let out = '';
  let i = 0;
  while (i < sql.length) {
    const c = sql[i];
    const next = sql[i + 1];

    if (c === '-' && next === '-') {                 // line comment
      const nl = sql.indexOf('\n', i);
      i = nl === -1 ? sql.length : nl;
      out += ' ';
      continue;
    }
    if (c === '/' && next === '*') {                 // block comment
      const end = sql.indexOf('*/', i + 2);
      i = end === -1 ? sql.length : end + 2;
      out += ' ';
      continue;
    }
    if (c === "'" || c === '"') {                    // string literal / quoted identifier
      const quote = c;
      i += 1;
      while (i < sql.length) {
        if (sql[i] === quote) {
          if (sql[i + 1] === quote) { i += 2; continue; } // doubled quote is an escape
          i += 1;
          break;
        }
        i += 1;
      }
      out += quote + quote;                          // keep it a literal, drop its contents
      continue;
    }
    out += c;
    i += 1;
  }
  return out;
}

function assertReadOnlySelect(sql) {
  const original = String(sql || '').trim();
  if (!original) throw new Error('Query is empty.');

  // Every check runs against the code with comments and string contents removed.
  const code = stripSqlNoise(original).trim().replace(/;+\s*$/, '');
  if (!code) throw new Error('Query is empty.');
  if (code.includes(';')) throw new Error('Only a single statement is allowed.');

  // WITH is allowed as well as SELECT: a common table expression is ordinary analyst
  // work and is read-only on its own. It cannot be used to smuggle a write, because the
  // keyword blocklist below still applies to the whole statement.
  if (!/^(select|with)\b/i.test(code)) {
    throw new Error('Only SELECT queries are allowed here.');
  }
  if (/\b(insert|update|delete|drop|alter|attach|detach|pragma|create|replace|vacuum|reindex|analyze)\b/i.test(code)) {
    throw new Error('Only read-only SELECT queries are allowed here.');
  }

  // The ORIGINAL text is returned and executed — comments are harmless to SQLite and
  // keeping them means the learner runs exactly what they wrote.
  return original.replace(/;+\s*$/, '');
}

// Runs one read-only SELECT against a freshly built copy of the named dataset. A new
// in-memory database per call means a learner's query can never see another learner's
// state, and can never see anything we did not seed on purpose.
//
// `limit` caps what comes back to the browser. A learner exploring with SELECT * on a
// 100-row table is fine; the cap exists so a cross join can't return a million rows
// and lock up their tab.
function runPracticeQuery(sql, datasetKey, limit) {
  const clean = assertReadOnlySelect(sql);
  const mem = buildDatasetDb(datasetKey || DEFAULT_DATASET);
  try {
    const rows = mem.prepare(clean).all();
    if (limit && rows.length > limit) {
      return { rows: rows.slice(0, limit), truncated: true, totalRows: rows.length };
    }
    return { rows, truncated: false, totalRows: rows.length };
  } finally {
    mem.close();
  }
}

// The dataset a task is graded against, resolved from the task definition.
function datasetForTask(taskKey) {
  const def = TASKS[taskKey];
  return (def && def.datasetKey) || DEFAULT_DATASET;
}

// Scratch execution from the workbench — run as often as you like, nothing is recorded
// and nothing is graded. This is the single most important affordance in the tool: a
// learner who cannot see their own intermediate results is guessing, not analysing.
function runScratchQuery(userId, taskId, sql) {
  const enrollment = getEnrollment(userId);
  if (!enrollment) throw new Error('Not enrolled');
  const task = db.prepare('SELECT * FROM sim_tasks WHERE id = ? AND enrollment_id = ?').get(taskId, enrollment.id);
  if (!task) throw new Error('Task not found');
  const datasetKey = datasetForTask(task.task_key);
  const started = Date.now();
  const out = runPracticeQuery(sql, datasetKey, 200);
  return {
    ...out,
    columns: out.rows.length ? Object.keys(out.rows[0]) : [],
    elapsedMs: Date.now() - started,
    datasetKey,
  };
}

// The pre-start project document. Returns the authored brief plus this learner's real
// position on it — whether it is unlocked, and how its tasks are going — so the reader
// sees one page rather than a brief here and a status somewhere else.
function getProjectBrief(userId, projectKey) {
  const enrollment = getEnrollment(userId);
  if (!enrollment) throw new Error('Not enrolled');

  const catalog = catalogFor(enrollment.role, enrollment.level);
  const entry = catalog.find((p) => p.key === projectKey);
  if (!entry) throw new Error('Unknown project.');

  const doc = getProjectDoc(projectKey);
  const tasks = db.prepare('SELECT * FROM sim_tasks WHERE enrollment_id = ? ORDER BY assigned_at ASC').all(enrollment.id);
  const gradedCount = tasks.filter((t) => t.status === 'graded').length;

  const myTasks = entry.taskKeys.map((key) => {
    const row = tasks.find((t) => t.task_key === key);
    const def = TASKS[key] || {};
    return {
      taskKey: key,
      taskId: row ? row.id : null,
      title: def.title || key,
      estHours: def.estHours || null,
      priority: def.priority || 'medium',
      status: row ? row.status : 'not-started',
      score: row ? row.score : null,
    };
  });

  return {
    projectKey,
    // Catalog facts stay the source of truth for gating and value, so the brief can
    // never disagree with the Projects board about whether something is unlocked.
    title: entry.title,
    difficulty: entry.difficulty,
    impactValue: entry.impactValue,
    skillFocus: entry.skillFocus,
    unlocked: gradedCount >= (entry.unlockAfter || 0),
    unlockAfter: entry.unlockAfter || 0,
    gradedCount,
    started: myTasks.some((t) => t.taskId),
    tasks: myTasks,
    doc,
  };
}

// Schema for the browser panel beside the editor.
function getWorkbench(userId, taskId) {
  const enrollment = getEnrollment(userId);
  if (!enrollment) throw new Error('Not enrolled');
  const task = db.prepare('SELECT * FROM sim_tasks WHERE id = ? AND enrollment_id = ?').get(taskId, enrollment.id);
  if (!task) throw new Error('Task not found');
  const datasetKey = datasetForTask(task.task_key);
  const def = TASKS[task.task_key] || {};
  const tool = def.tool || 'sql';
  return {
    taskId: task.id,
    taskKey: task.task_key,
    title: task.title,
    brief: task.brief,
    status: task.status,
    score: task.score,
    feedback: task.feedback,
    submission: task.submission || '',
    tool,
    dataset: describeDataset(datasetKey),
    // A chart task is graded on presentation, so the rows are given rather than queried
    // — asking them to rewrite a query they have already been marked on would be busywork
    // and would confuse what the task is actually assessing.
    chart: tool === 'chart' && def.chart
      ? { ...charttasks.present(def.chart), rows: runPracticeQuery(def.chart.sourceSql, datasetKey, 200).rows }
      : null,
    // Seeded on this learner's own task row, so the order is stable across reloads for
    // them and different from anyone else's.
    choice: tool === 'choice' && def.choice ? tasktypes.presentChoice(def.choice, task.id) : null,
    writeup: tool === 'writeup' && def.writeup ? tasktypes.presentWriteup(def.writeup) : null,
    tools: tool === 'python'
      ? [TOOLS['python-notebook'], TOOLS['schema-browser']]
      : tool === 'chart'
        ? [TOOLS['chart-builder'], TOOLS['schema-browser']]
        : tool === 'writeup'
          ? [TOOLS['email-client']]
          : tool === 'choice'
            ? [TOOLS['schema-browser']]
            : [TOOLS['sql-terminal'], TOOLS['schema-browser']],
  };
}

// The dataset as JSON, for the Python notebook to load into pandas. Only ever the
// generated practice fixture — there is no real user data in it to leak.
function getTaskData(userId, taskId) {
  const enrollment = getEnrollment(userId);
  if (!enrollment) throw new Error('Not enrolled');
  const task = db.prepare('SELECT * FROM sim_tasks WHERE id = ? AND enrollment_id = ?').get(taskId, enrollment.id);
  if (!task) throw new Error('Task not found');
  const datasetKey = datasetForTask(task.task_key);
  return { datasetKey, tables: dumpDataset(datasetKey) };
}

const LINE_MANAGER_GRADING_SYSTEM = `You are Asha Rao, the Line Manager archetype in TenzorGrid's Virtual Workspace — a behavioural work simulator. You are the ONLY character who grades. Your comms style is short, direct, bullet points, warm but never soft. You never do the learner's thinking for them and you never rewrite their query — you assess what they submitted.

Grade the learner's SQL submission against the task brief, the reference result, and their actual result. Score 0-100 on correctness and query quality (readability, appropriate use of GROUP BY/aggregate functions, no unnecessary complexity). Then write brief, specific, in-character feedback (2-4 short lines, bullet points ok) — coach, don't lecture; note one thing they did well if there is one.

Also score the submission 0-100 on each of these skill axes, but ONLY for axes this specific task actually exercises — use null for any axis this submission gives you no basis to judge (a pure SQL task has no python or dataViz signal at all, and a Python task has no sql signal): sql, python, dataViz, communication (is the code itself readable/well-structured), businessLogic (did they answer what the stakeholder actually asked).

Respond with ONLY a JSON object: {"score": <0-100 integer>, "feedback": "<your in-character feedback, first person as Asha>", "skills": {"sql": <0-100 or null>, "python": <0-100 or null>, "dataViz": <0-100 or null>, "communication": <0-100 or null>, "businessLogic": <0-100 or null>}}`;

function cleanSkills(raw) {
  const out = {};
  for (const axis of SKILL_AXES) {
    const v = raw && raw[axis];
    out[axis] = typeof v === 'number' ? Math.max(0, Math.min(100, Math.round(v))) : null;
  }
  return out;
}

async function gradeSubmission(taskDef, submittedCode, submittedResult, referenceResult, tool) {
  const lang = tool === 'python' ? 'Python' : 'SQL';
  const prompt = `Task brief: ${taskDef.brief}

Language: ${lang}

Reference (correct) result:
${JSON.stringify(referenceResult)}

Learner's submitted ${lang}:
${submittedCode}

Learner's actual result:
${JSON.stringify(submittedResult)}${tool === 'python' ? `

Note: this Python ran in the learner's browser, so the result above is what they
reported rather than something we re-ran. Weight the CODE heavily — if the code could
not plausibly produce the reported result, say so and score accordingly.` : ''}`;

  if (ai.isAvailable()) {
    const text = await ai.callClaude({ system: LINE_MANAGER_GRADING_SYSTEM, prompt, maxTokens: 500 });
    const parsed = ai.extractJson(text);
    if (parsed && typeof parsed.score === 'number' && typeof parsed.feedback === 'string') {
      return {
        score: Math.max(0, Math.min(100, Math.round(parsed.score))),
        feedback: parsed.feedback,
        skills: cleanSkills(parsed.skills),
      };
    }
  }

  // Deterministic fallback so the loop still works with no AI key configured — same
  // "heuristic when AI is off" pattern the rest of the app already uses. It can only
  // honestly speak to the axes a correctness check actually covers (sql, businessLogic,
  // communication via a query-length proxy) — python/dataViz stay null, same as the AI
  // path would leave them for a SQL-only task.
  const matches = rowsMatch(submittedResult, referenceResult);
  const base = matches
    ? { score: 90, feedback: "Correct — that matches what I'd expect. Ship it." }
    : { score: 45, feedback: "That doesn't match what I'm seeing when I run it myself. Check your GROUP BY and sort order, then resubmit." };
  // Only claim the axis the submission actually exercised.
  const axis = tool === 'python' ? 'python' : 'sql';
  return { ...base, skills: cleanSkills({ [axis]: base.score, businessLogic: base.score, communication: base.score }) };
}

// Normalises a result set so two correct answers that differ only cosmetically compare
// equal: numbers that are integers in one engine and floats in the other, column order,
// and pandas' habit of emitting NaN where SQL emits NULL.
function normaliseRows(rows) {
  if (!Array.isArray(rows)) return null;
  return rows.map((r) => {
    const out = {};
    for (const k of Object.keys(r || {}).sort()) {
      let v = r[k];
      if (typeof v === 'number') {
        if (!Number.isFinite(v)) v = null;                       // NaN / Infinity -> NULL
        else v = Math.round(v * 1e6) / 1e6;                      // kill float noise
      }
      out[k.toLowerCase()] = v;
    }
    return out;
  });
}

function rowsMatch(a, b) {
  return JSON.stringify(normaliseRows(a)) === JSON.stringify(normaliseRows(b));
}

// ---------------------------------------------------------------------------
// The verification gate.
//
// A correct answer is not a finished task. Before anything counts, Asha asks the
// learner ONE question about a choice they actually made — why they filtered the way
// they did, why that join, why they left the leavers in — and only her acceptance
// completes it. That conversation IS the product: writing a GROUP BY is learnable from
// any tutorial, but being asked "walk me through why" by someone who will not accept a
// vague answer is the thing an interview does and nothing else practises.
//
// The question must be about THEIR submission. A generic "can you explain your
// approach?" gets clicked through like a cookie banner and the whole mechanic dies, so
// the prompt below is built around their code and their result, and the offline
// fallback inspects their code for specific, checkable choices.
// ---------------------------------------------------------------------------

const MAX_REVIEW_ROUNDS = 2; // after this the task is parked, so a stuck day can continue

const REVIEW_ASK_SYSTEM = `You are Asha Rao, Line Manager in a Data & Analytics team, reviewing a junior analyst's submitted work before you sign it off.

Ask exactly ONE question about a specific choice they made in the code in front of you. Quote or name the actual thing — the filter they used or omitted, the join, the column they grouped by, the ordering. A question that would fit any submission is a failed question.

If their result is wrong, do not tell them the answer and do not say it is wrong. Ask the question that leads them to notice it themselves.

Short and direct: one or two sentences, the way a busy manager types in chat. No greeting, no praise, no preamble. Output only the question.`;

const REVIEW_JUDGE_SYSTEM = `You are Asha Rao, Line Manager, deciding whether a junior analyst's answer to your review question is good enough to sign off their work.

Accept when they show they understood the choice they made and can justify it — even if the wording is casual or imperfect. You are testing understanding, not eloquence, and not whether they used the right jargon.

Push back when the answer is vague, restates the question, describes WHAT the code does without saying WHY, or is plainly guessing.

Respond with ONLY a JSON object:
{"accept": true|false, "reply": "<what you say to them, 1-2 sentences, in character>"}

When accepting, your reply signs it off and moves on. When pushing back, your reply names what is missing and asks again — never give them the answer.`;

// Deterministic review question, used when no AI key is configured. It inspects the
// submission for choices that are actually checkable, so even the offline path asks
// about something real rather than reaching for a generic prompt.
function fallbackReviewQuestion(taskDef, code, matched) {
  const sql = String(code || '').toLowerCase();
  const tool = taskDef.tool || 'sql';

  if (tool === 'sql') {
    if (/from\s+employees/.test(sql) && !/exit_year/.test(sql)) {
      return "Your query counts everyone who has ever worked here, including people who have left. Was that deliberate?";
    }
    if (/department_id/.test(sql) && !/join/.test(sql)) {
      return "You've grouped by department_id, so the output is numbers rather than department names. How would a reader of this know which is which?";
    }
    if (/avg\(/.test(sql) && !/order\s+by/.test(sql)) {
      return "There's no ORDER BY, so the rows come back in whatever order SQLite feels like. What order did you intend?";
    }
    if (!matched) {
      return "This doesn't match what I get when I run it. Talk me through your filtering — where do you think we differ?";
    }
    return "Talk me through your WHERE clause — what are you deliberately leaving out, and why?";
  }

  if (!matched) {
    return "Your numbers don't line up with mine. Walk me through how you grouped the rows before you took the median.";
  }
  return "Why the median here rather than the average? Give me the one-line version I could repeat to Vikram.";
}

// Asks the opening review question. Called once, immediately after grading.
async function askReviewQuestion(taskDef, code, submittedResult, referenceResult, matched) {
  if (ai.isAvailable()) {
    const prompt = `Task they were given: ${taskDef.brief}

Their ${taskDef.tool === 'python' ? 'Python' : 'SQL'}:
${code}

What their code returned:
${JSON.stringify(submittedResult).slice(0, 900)}

What the correct answer is:
${JSON.stringify(referenceResult).slice(0, 900)}

Their result ${matched ? 'MATCHES' : 'DOES NOT MATCH'} the correct answer.`;
    const q = await ai.callClaude({ system: REVIEW_ASK_SYSTEM, prompt, maxTokens: 150 });
    if (q && q.trim()) return q.trim();
  }
  return fallbackReviewQuestion(taskDef, code, matched);
}

// Judges the learner's answer. Returns { accept, reply }.
async function judgeReviewAnswer(taskDef, code, question, answer, round) {
  if (ai.isAvailable()) {
    const prompt = `The task: ${taskDef.brief}

Their code:
${code}

You asked them:
${question}

They answered:
${answer}

${round >= MAX_REVIEW_ROUNDS ? 'This is their final attempt — if it is still not good enough, say so plainly and tell them to park it and come back to it.' : ''}`;
    const text = await ai.callClaude({ system: REVIEW_JUDGE_SYSTEM, prompt, maxTokens: 250 });
    const parsed = ai.extractJson(text);
    if (parsed && typeof parsed.accept === 'boolean' && typeof parsed.reply === 'string') {
      return { accept: parsed.accept, reply: parsed.reply.trim() };
    }
  }

  // Offline: a substantive answer that explains rather than restates is accepted. This
  // is a weak judge on purpose — with no model available it is better to let a real
  // attempt through than to block a learner behind a rule that cannot read.
  const a = String(answer || '').trim();
  const words = a.split(/\s+/).filter(Boolean).length;
  // Reasoning does not always announce itself with "because". A good explanation of a
  // chart choice — "bars compare a value across categories, and sorting puts the answer
  // first for the reader" — carries its argument in the structure rather than in a
  // connective, and the narrower list rejected exactly that.
  const explains = /\bbecause\b|\bsince\b|\bso that\b|\bto avoid\b|\bwould\b|\botherwise\b|\brather than\b|\bwhich means\b|\bif (?:you|we|i)\b|\bthat way\b|\bmakes? (?:it|the|them)\b|\bputs?\b|\bshows?\b|\bhides?\b|\bskews?\b/i.test(a);
  if (words >= 12 && explains) {
    return { accept: true, reply: "That's the reasoning I wanted to hear. Signed off — next one's yours." };
  }
  // A chart task has no code, so telling the learner their answer described "the code"
  // reads as a bug in the product rather than feedback on their work.
  const noun = (taskDef && taskDef.tool) === 'chart' ? 'the chart shows' : 'the code does';
  return {
    accept: false,
    reply: `That tells me what ${noun}, not why you chose it. Give me the reason — what would go wrong if you'd done it the other way?`,
  };
}

// The learner's answer to Asha's review question. Accepting completes the task and
// unlocks whatever comes next; a second failed round parks it so the day can continue.
async function answerReview(userId, taskId, answer) {
  const enrollment = getEnrollment(userId);
  if (!enrollment) throw new Error('Not enrolled');
  const task = db.prepare('SELECT * FROM sim_tasks WHERE id = ? AND enrollment_id = ?').get(taskId, enrollment.id);
  if (!task) throw new Error('Task not found');
  if (task.review_state !== 'pending') throw new Error('This task is not waiting on a review answer.');

  const clean = String(answer || '').trim();
  if (!clean) throw new Error('Write your answer before sending it.');

  const taskDef = TASKS[task.task_key] || {};
  const round = (task.review_rounds || 0) + 1;

  addMessage(enrollment.id, 'learner', 'You', clean, taskId, null, 'line_manager');
  const { accept, reply } = await judgeReviewAnswer(taskDef, task.submission, task.review_question, clean, round);

  if (accept) {
    // Good work, and she wants it differently anyway. Deterministic rather than random —
    // which task gets reworked has to be the same for every learner, or one person meets
    // the hardest thing in the product and another never does.
    if (taskDef.rework && task.review_state !== 'rework') {
      const note = REWORK_NOTES[tasktypes.seedFrom(task.task_key) % REWORK_NOTES.length];
      reopenTask(enrollment, task, `${reply}\n\n${note}`, true);
      return { accepted: false, rework: true, reply, note, state: getState(userId) };
    }
    // Signed off. NOW the score is revealed and the task counts — 'graded' stays the
    // terminal state, so everything downstream (projects, analytics, unlocks) is
    // unchanged by the gate existing.
    db.prepare("UPDATE sim_tasks SET status = 'graded', review_state = 'accepted', review_rounds = ?, graded_at = ? WHERE id = ?")
      .run(round, now(), taskId);
    addMessage(enrollment.id, 'line_manager', LINE_MANAGER_NAME, reply, taskId);
    addMessage(enrollment.id, 'line_manager', LINE_MANAGER_NAME, task.feedback, taskId);
    return { accepted: true, reply, score: task.score, feedback: task.feedback, state: getState(userId) };
  }

  // Weak work is not a conversation to be won — it is work to be redone. Below the
  // threshold she stops asking questions and sends it back, which is what a manager
  // actually does and what the learner's own rule asks for.
  if (!accept && typeof task.score === 'number' && task.score < REOPEN_BELOW) {
    reopenTask(enrollment, task,
      `${reply}\n\nLet's not go round on this — take it back and have another go. ${task.feedback || ''}`.trim(),
      false);
    return { accepted: false, reopened: true, reply, state: getState(userId) };
  }

  if (round >= MAX_REVIEW_ROUNDS) {
    // Parked, not failed. A real manager moves you on rather than letting you sit on
    // one thing all day; the task stays visibly incomplete and counts against the
    // project, which is the pressure without the dead end.
    db.prepare("UPDATE sim_tasks SET status = 'parked', review_state = 'parked', review_rounds = ? WHERE id = ?")
      .run(round, taskId);
    addMessage(enrollment.id, 'line_manager', LINE_MANAGER_NAME, reply, taskId);
    addMessage(enrollment.id, 'line_manager', LINE_MANAGER_NAME,
      `Let's park ${task.title} for now and come back to it — take the next one so the day isn't lost.`, taskId);
    return { accepted: false, parked: true, reply, state: getState(userId) };
  }

  db.prepare('UPDATE sim_tasks SET review_rounds = ? WHERE id = ?').run(round, taskId);
  addMessage(enrollment.id, 'line_manager', LINE_MANAGER_NAME, reply, taskId);
  return { accepted: false, parked: false, reply, roundsLeft: MAX_REVIEW_ROUNDS - round, state: getState(userId) };
}

// Take it back before you have to defend it.
//
// A submission goes straight to Asha, who asks a question about it. Halfway through
// composing an answer is exactly when people realise their query was wrong — and defending
// work you already know is wrong is not a skill worth practising. Allowed only in the first
// round: once you have argued a position, changing the work underneath it is a different
// thing, and Asha would notice.
function redoSubmission(userId, taskId) {
  const enrollment = getEnrollment(userId);
  if (!enrollment) throw new Error('Not enrolled');
  const task = db.prepare('SELECT * FROM sim_tasks WHERE id = ? AND enrollment_id = ?').get(taskId, enrollment.id);
  if (!task) throw new Error('Task not found');
  if (task.status === 'graded') throw new Error('That one is already signed off.');
  if (task.status !== 'in_review') throw new Error('There is nothing submitted to take back.');
  if ((task.review_rounds || 0) > 0) {
    throw new Error('You have already answered Asha on this one — see it through rather than starting again.');
  }

  db.prepare(`UPDATE sim_tasks
                 SET status = 'assigned', score = NULL, feedback = NULL, skills_json = NULL,
                     submitted_at = NULL, review_state = NULL, review_question = NULL, review_rounds = 0
               WHERE id = ?`).run(taskId);
  // The submission text itself is kept, so they edit rather than retype.
  addMessage(enrollment.id, 'learner', 'You',
    `Actually — let me take that one back and redo it before you spend time on it.`, taskId, null, 'line_manager');
  addMessage(enrollment.id, 'line_manager', LINE_MANAGER_NAME,
    `No problem, I had not opened it yet. Send it again when you are happy with it.`, taskId, null, 'line_manager');
  return { state: getState(userId) };
}

// Asha sending the work back.
//
// Two different things live here, and conflating them would lose the more valuable one.
//
// A REDO is "this is wrong, do it again" — the score was weak and the work needs fixing.
//
// A REWORK is "this is right, and I want it done differently". Being told your correct
// answer is not the right approach is the single most common experience of a real analyst's
// first year, and almost nothing simulates it. She names the constraint — use a median, do
// it without a subquery, break it out by year — and the learner has to satisfy it.
const REOPEN_BELOW = 60;

const REWORK_NOTES = [
  'It works, but I would like it done with a median rather than a mean — one big salary is carrying that number and I do not want to defend it in the room.',
  'Right answer, wrong shape. Can you do it without the subquery? Whoever picks this up in April needs to be able to read it.',
  'This is fine as far as it goes. Break it out by hire year as well — I think the gap is a seniority story and I want to know before Vikram asks.',
];

function reopenTask(enrollment, task, reason, isRework) {
  // The reason is kept on the row as well as sent as a chat message. A learner who comes
  // back to the Tasks tab tomorrow should not have to go hunting through the thread to
  // find out why the card is open again — it belongs above the editor they have to use.
  db.prepare(`UPDATE sim_tasks
                 SET status = 'assigned', review_state = ?, review_question = ?,
                     submitted_at = NULL, graded_at = NULL
               WHERE id = ?`).run(isRework ? 'rework' : 'redo', reason, task.id);
  addMessage(enrollment.id, 'line_manager', LINE_MANAGER_NAME, reason, task.id, null, 'line_manager');
}

function safeJson(text) {
  try { return JSON.parse(text); } catch { return null; }
}

// Asha picking the work up.
//
// A submission used to jump straight to her question, which read as a machine responding
// rather than a manager reviewing. A real one acknowledges receipt first, then comes back
// with the actual question — and that gap is the whole reason "in review" is a state
// rather than a formality. Two messages, in order, so the thread reads like a person
// working through your submission.
function openReview(enrollment, task, question, taskId) {
  addMessage(enrollment.id, 'line_manager', LINE_MANAGER_NAME,
    `Got your submission on "${task.title}" — picking it up now. Give me a minute to read it properly.`,
    taskId);
  addMessage(enrollment.id, 'line_manager', LINE_MANAGER_NAME,
    `Right, read it. ${question}`,
    taskId);
}

// Asha's question for a judgement or a piece of writing. Always about something they
// actually did — the specific thing they missed, or the specific claim they made.
function judgementReviewQuestion(taskDef, tool, answer, marked) {
  if (tool === 'writeup') {
    const missed = (marked.detail.missed || [])[0];
    const point = missed && (taskDef.writeup.rubric.find((r) => r.key === missed) || {}).label;
    if (point) {
      return `Before this goes out — you've left out ${point.toLowerCase()}. Was that deliberate, or did it get lost in the edit? Tell me how you'd handle it if Vikram reads this and comes back asking.`;
    }
    return `That reads well. One thing: if Vikram forwards it to someone who wasn't in the original conversation, does it still stand on its own? Talk me through what they'd take from it.`;
  }
  if (marked.detail.falseAlarms) {
    return `You flagged something that isn't actually a problem. Walk me through what you thought was wrong with it — I'd rather know how you read it than just correct you.`;
  }
  if (marked.detail.found < marked.detail.total) {
    return `You got ${marked.detail.found} of ${marked.detail.total}. Take another look at what you left — what would have to be true for the ones you skipped to be fine?`;
  }
  return `All of them, and nothing extra. Tell me which one you'd have caught last — the one that took you longest to be sure about.`;
}

// Asha's sign-off question for a chart. Deterministic, and always about a choice they
// actually made — asked about the first thing they got wrong if there is one, and about
// the load-bearing choice if there is not. A generic "why this chart?" would fit any
// submission, which is the definition of a failed question.
function chartReviewQuestion(taskDef, answer, marked) {
  const wrong = marked.notes.find((n) => !n.ok);
  if (wrong) {
    if (wrong.field === 'type') {
      return `You went with a ${answer.type} here. Talk me through that — what is it about this data that made a ${answer.type} the right shape for it?`;
    }
    if (wrong.field === 'sort') {
      return `On the ordering — you chose "${answer.sort}". Who is reading this chart, and what do you want them to notice first?`;
    }
    if (wrong.field === 'baselineZero') {
      return `Your value axis doesn't start at zero. That's a deliberate choice with a real effect on how the chart reads — what was your thinking?`;
    }
    return `You put "${answer[wrong.field]}" on the ${wrong.field} axis. Why that one round rather than the other?`;
  }
  return `That's the chart I'd have made. Before I take it to Vikram — if he asks you why not a pie chart, what do you tell him?`;
}

async function submitTask(userId, taskId, code, computedResult) {
  const enrollment = getEnrollment(userId);
  if (!enrollment) throw new Error('Not enrolled');
  const task = db.prepare('SELECT * FROM sim_tasks WHERE id = ? AND enrollment_id = ?').get(taskId, enrollment.id);
  if (!task) throw new Error('Task not found');
  const taskDef = TASKS[task.task_key];
  if (!taskDef) throw new Error('Unknown task definition');
  if (countTodaysAiUse(enrollment.id).submissions >= DAILY_AI_LIMITS.submissions) {
    throw new Error(`You've hit today's limit of ${DAILY_AI_LIMITS.submissions} graded submissions. Come back tomorrow — your work is saved.`);
  }

  const datasetKey = datasetForTask(task.task_key);
  const tool = taskDef.tool || 'sql';

  let submittedResult;
  let referenceResult;

  // Choice and write-up tasks are graded against an authored spec rather than a dataset
  // comparison — there is no query to run. Both still go to Asha for sign-off afterwards,
  // because being able to explain the judgement is the point of every task here.
  if (tool === 'choice' || tool === 'writeup') {
    const answer = tool === 'choice' ? safeJson(code) : String(code || '');
    if (tool === 'choice' && !Array.isArray(answer)) {
      throw new Error('Pick your answers before submitting.');
    }
    if (tool === 'writeup' && !answer.trim()) {
      throw new Error('Write something before submitting.');
    }
    const marked = tool === 'choice'
      ? tasktypes.gradeChoice(taskDef.choice, answer)
      : tasktypes.gradeWriteup(taskDef.writeup, answer);

    const stored = tool === 'choice' ? JSON.stringify(answer) : answer;
    db.prepare(`
      UPDATE sim_tasks SET status = 'in_review', submission = ?, score = ?, feedback = ?, skills_json = ?,
        submitted_at = ?, graded_at = NULL, review_state = 'pending', review_rounds = 0
      WHERE id = ?
    `).run(stored, marked.score, marked.feedback, JSON.stringify(marked.skills), now(), taskId);

    addMessage(enrollment.id, 'learner', 'You',
      tool === 'writeup' ? answer : `Flagged ${answer.length} item${answer.length === 1 ? '' : 's'}.`, taskId);

    const question = judgementReviewQuestion(taskDef, tool, answer, marked);
    db.prepare('UPDATE sim_tasks SET review_question = ? WHERE id = ?').run(question, taskId);
    openReview(enrollment, task, question, taskId);
    return { inReview: true, question, result: marked.detail };
  }

  // A chart is graded field by field against an authored spec, with no AI call and no
  // dataset comparison — the rows were given, so what is under assessment is entirely
  // the presentation choices.
  if (tool === 'chart') {
    const answer = typeof code === 'string' ? safeJson(code) : code;
    if (!answer || typeof answer !== 'object') {
      throw new Error('Make your chart choices before submitting.');
    }
    const marked = charttasks.grade(taskDef.chart, answer);
    db.prepare(`
      UPDATE sim_tasks SET status = 'in_review', submission = ?, score = ?, feedback = ?, skills_json = ?,
        submitted_at = ?, graded_at = NULL, review_state = 'pending', review_rounds = 0
      WHERE id = ?
    `).run(JSON.stringify(answer), marked.score, marked.feedback, JSON.stringify(marked.skills), now(), taskId);

    addMessage(enrollment.id, 'learner', 'You',
      `Submitted a ${answer.type || 'chart'}: ${answer.x} against ${answer.y}.`, taskId);

    const question = chartReviewQuestion(taskDef, answer, marked);
    db.prepare('UPDATE sim_tasks SET review_question = ? WHERE id = ?').run(question, taskId);
    openReview(enrollment, task, question, taskId);
    return { inReview: true, question, result: marked.notes };
  }

  if (tool === 'python') {
    // Python runs in the learner's own browser under Pyodide, so — unlike SQL — the
    // server never executes their code and CANNOT independently reproduce their output.
    // The result they send is therefore a claim, not a proof: a determined learner could
    // post the right rows without writing the code that produces them.
    //
    // That is an accepted trade. Running Python server-side would mean sandboxing
    // arbitrary user code, which is a genuinely hard security problem and not one worth
    // taking on to grade a training exercise. What protects the assessment is that the
    // grader reads the CODE, not just the answer, and the reference below is computed
    // here from the same rows — so a mismatch is always caught even though a match is
    // not, on its own, proof of work.
    if (!Array.isArray(computedResult)) {
      throw new Error('Run your code first — the notebook needs a `result` to submit.');
    }
    submittedResult = computedResult;
    referenceResult = typeof taskDef.referenceCompute === 'function'
      ? taskDef.referenceCompute(dumpDataset(datasetKey))
      : [];
  } else {
    // Both queries run against the same dataset, so the comparison is apples to apples.
    submittedResult = runPracticeQuery(code, datasetKey).rows; // throws on invalid/unsafe SQL
    referenceResult = runPracticeQuery(taskDef.referenceSql, datasetKey).rows;
  }

  const { score, feedback, skills } = await gradeSubmission(taskDef, code, submittedResult, referenceResult, tool);

  // The score is computed now but NOT surfaced yet, and the task is NOT done. It goes
  // to Asha for review first — a manager questions your reasoning before signing off,
  // and telling the learner their mark up front would make that conversation pointless.
  // status stays out of 'graded' until she accepts, so nothing downstream counts it.
  db.prepare(`
    UPDATE sim_tasks SET status = 'in_review', submission = ?, score = ?, feedback = ?, skills_json = ?,
      submitted_at = ?, graded_at = NULL, review_state = 'pending', review_rounds = 0
    WHERE id = ?
  `).run(code, score, feedback, JSON.stringify(skills), now(), taskId);

  addMessage(enrollment.id, 'learner', 'You', `Submitted:\n${code}`, taskId);

  const matched = rowsMatch(submittedResult, referenceResult);
  const question = await askReviewQuestion(taskDef, code, submittedResult, referenceResult, matched);
  db.prepare('UPDATE sim_tasks SET review_question = ? WHERE id = ?').run(question, taskId);
  openReview(enrollment, task, question, taskId);

  return { inReview: true, question, result: submittedResult };
}

// Canned, in-character responses for archetypes that don't warrant an AI call for
// every reply — keeps the Team/Emails chat honest (a message always gets an answer)
// without spending an AI call on People Ops small talk.
const CANNED_REPLIES = {
  people_partner: "Thanks for flagging — noted. Ping me any time about policy or onboarding.",
  stakeholder: "Thanks for the update, appreciate it — let me know if anything changes on timing.",
  data_engineer: "Sure — I pulled those tables, so if something looks wrong in them it probably is. Tell me which column and I'll tell you what I know.",
  support_lead: "Happy to help. I log every incident that comes in, so ask me anything about how they're classified.",
  engineering_manager: "Go ahead. Fair warning, I'll push back on the numbers — that's not me being difficult, it's how I check them.",
  finance_analyst: "Of course. I own the cost baselines, so if you need to know what a figure means to Finance, that's my patch.",
  comms: "Happy to read anything before it goes out. I'm blunt about unclear writing, which people usually want after the fact.",
  finance_manager: "Sure. I cost the fixes, so I think in what it'd take to put right rather than what went wrong.",
};

// How many exchanges before a colleague counts as someone you know. Three is enough to
// have said something real and short enough to reach in a day.
const FRIENDSHIP_AT = 3;

function getContact(enrollmentId, archetype) {
  return db.prepare('SELECT * FROM sim_contacts WHERE enrollment_id = ? AND archetype = ?')
    .get(enrollmentId, archetype);
}

// Records that the learner spoke to someone, and returns whether that made them a friend.
function noteContact(enrollmentId, archetype) {
  const row = getContact(enrollmentId, archetype);
  const at = now();
  if (!row) {
    db.prepare('INSERT INTO sim_contacts (id, enrollment_id, archetype, messages_sent, last_at) VALUES (?, ?, ?, 1, ?)')
      .run(cryptoRandomId(), enrollmentId, archetype, at);
    return { count: 1, justBecameFriends: false, friends: false };
  }
  const count = row.messages_sent + 1;
  const becameFriends = !row.friends_at && count >= FRIENDSHIP_AT;
  db.prepare('UPDATE sim_contacts SET messages_sent = ?, last_at = ?, friends_at = COALESCE(friends_at, ?) WHERE id = ?')
    .run(count, at, becameFriends ? at : null, row.id);
  return { count, justBecameFriends: becameFriends, friends: Boolean(row.friends_at) || becameFriends };
}

// What a colleague says back.
//
// The useful part is that they answer about THEIR patch and redirect outside it, by name.
// A colleague who confidently answers anything is worse than one who says "not mine, ask
// Rahul" — the redirect teaches the learner who the org is, which is half of what being
// new at a job actually is.
//
// A friend will also give a real hint on the task the learner has open. Someone they have
// never spoken to will not. That is the whole incentive to talk to people.
function colleagueReply(person, learnerBody, { friends, openTask }) {
  const text = String(learnerBody || '').toLowerCase();
  const mine = (person.helpsWith || []).some((topic) => text.includes(topic.toLowerCase()));

  // Who should they be asking instead? Match the message against everyone else's patch.
  const better = ROSTER.find((r) => r.archetype !== person.archetype
    && (r.helpsWith || []).some((topic) => text.includes(topic.toLowerCase())));

  const asking = /\?|help|stuck|how do|how can|what should|any idea|not sure/.test(text);

  if (asking && better && !mine) {
    return `That's more ${firstName(better.name)}'s area than mine — ${better.title.toLowerCase()}. ${firstName(better.name)} will know straight away; I'd only be guessing.`;
  }

  if (asking && friends && openTask && openTask.hint) {
    return `${openTask.hint}\n\nThat's what I'd look at first. Shout if it doesn't land.`;
  }

  if (asking && friends) {
    // `about` is written in the third person for the Team card, so it cannot be spoken.
    const patch = (person.helpsWith || []).slice(0, 2).join(' and ');
    return `Happy to look. Send me what you've got and I'll tell you what I'd check${patch ? ` — ${patch} is my patch` : ''}.`;
  }

  if (asking) {
    return `${CANNED_REPLIES[person.archetype] || 'Got it, thanks — noted.'}`;
  }

  return CANNED_REPLIES[person.archetype] || 'Got it, thanks — noted.';
}

const LINE_MANAGER_CHAT_SYSTEM = `You are Asha Rao, the Line Manager archetype in TenzorGrid's Virtual Workspace — a behavioural work simulator. Your comms style is short, direct, warm but never soft, 1-3 sentences. Reply in character to the learner's chat message. You are not grading anything here — that only happens on task submission. Never rewrite or solve their task for them.

Respond with ONLY the reply text, no preamble, no JSON.`;

async function replyAsArchetype(archetype, learnerBody, context) {
  if (archetype === 'line_manager' && ai.isAvailable()) {
    const reply = await ai.callClaude({ system: LINE_MANAGER_CHAT_SYSTEM, prompt: learnerBody, maxTokens: 200 });
    if (reply) return reply.trim();
  }
  const person = ROSTER.find((r) => r.archetype === archetype);
  if (person && !person.core) {
    return colleagueReply(person, learnerBody, context || {});
  }
  return CANNED_REPLIES[archetype] || "Got it, thanks — noted.";
}

// Learner-initiated chat/email. Team tab uses this for line_manager/people_partner;
// Emails tab uses it for stakeholder (and any future EMAIL_ARCHETYPES), threading
// the reply's subject off the original.
async function sendLearnerMessage(userId, archetype, body, subject) {
  const enrollment = getEnrollment(userId);
  if (!enrollment) throw new Error('Not enrolled yet.');
  const person = ROSTER.find((r) => r.archetype === archetype);
  if (!person) throw new Error('Unknown recipient.');
  const clean = (body || '').trim();
  if (!clean) throw new Error('Message cannot be empty.');
  if (countTodaysAiUse(enrollment.id).messages >= DAILY_AI_LIMITS.messages) {
    throw new Error(`You've hit today's limit of ${DAILY_AI_LIMITS.messages} messages. Your team will pick this up again tomorrow.`);
  }

  addMessage(enrollment.id, 'learner', 'You', clean, null, subject || null, archetype);

  const contact = noteContact(enrollment.id, archetype);
  // The task they are actually working on, so a friend's help can be about that rather
  // than generic encouragement.
  const openRow = db.prepare(
    "SELECT task_key FROM sim_tasks WHERE enrollment_id = ? AND status NOT IN ('graded','parked') ORDER BY assigned_at ASC LIMIT 1"
  ).get(enrollment.id);
  const openTask = openRow ? TASKS[openRow.task_key] : null;

  const reply = await replyAsArchetype(archetype, clean, { friends: contact.friends, openTask });
  const replySubject = subject ? 'Re: ' + subject.replace(/^Re:\s*/i, '') : null;
  addMessage(enrollment.id, archetype, person.name, reply, null, replySubject, archetype);

  if (contact.justBecameFriends) {
    addMessage(enrollment.id, archetype, person.name,
      `By the way — good to actually know you. Ping me directly if you get stuck on something in my area, I'd rather that than watch you lose a morning to it.`,
      null, replySubject, archetype);
  }

  return getState(userId);
}

module.exports = {
  closeDay,
  startNextDay,
  completeChore,

  ROLE_CATALOG,
  startEnrollment,
  getEnrollment,
  getState,
  checkIn,
  submitTask,
  runPracticeQuery,
  runScratchQuery,
  answerReview,
  getWorkbench,
  getTaskData,
  getProjectBrief,
  sendLearnerMessage,
  toggleChecklistItem,
  startProject,
  submitSkillTest,
  timeTravel,
  redoSubmission,
  completeActivity,
  handleSituation,
  submitQuiz,
  timeTravelReset,
  timeTravelSkipSkillTest,
  timeTravelCompleteTask,
  timeTravelCompleteDay,
  getStandup,
  submitStandup,
  markMessages,
};
