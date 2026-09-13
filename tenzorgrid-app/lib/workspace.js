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
  { key: 'lead', label: 'Data Analytics Team Lead' },
  { key: 'manager', label: 'Data Analytics Manager' },
];

const LEVEL_ORDER = LEVELS.map((l) => l.key);
function levelLabel(key) {
  const found = LEVELS.find((l) => l.key === (key || 'junior'));
  return found ? found.label : 'Data Analyst';
}

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
      taskKeys: [
        // Day 1 — what "affected" means. Billing-sync hit two clients; the quarter hit
        // fourteen. The brief says one and the meeting means the other.
        'ph-101', 'ph-102', 'ph-103', 'ph-104', 'da-004', 'ph-105',
        // Day 2 — quantify it. Harborview took 492k rows; Dunmore, the biggest account in
        // the book, lost seven thousand.
        'ph-110', 'ph-111', 'ph-112', 'ph-115', 'ph-113', 'ph-114',
        // Day 3 — the wobble. Lattice has already churned, and severity turns out not to
        // track damage at all.
        'ph-120', 'ph-121', 'ph-122', 'ph-123', 'ph-124', 'ph-125',
        // Day 4 — a second signal. The loudest client is the smallest one.
        'ph-130', 'ph-131', 'ph-132', 'ph-133', 'ph-134', 'ph-135',
        // Day 5 — the recommendation, against a budget that covers four accounts.
        'ph-140', 'ph-141', 'ph-142', 'ph-143', 'ph-144', 'ph-145',
      ],
      skillFocus: ['sql', 'businessLogic', 'communication'],
      impactValue: 21000,
      contributors: [
        { name: 'Sneha Joshi', role: 'Support Lead', does: 'Logged and triaged every incident', day: 1 },
        { name: 'Rahul Verma', role: 'Data Engineer', does: 'Reconstructed the corrupted rows', day: 1 },
        { name: null, role: 'Data Analyst', does: 'The impact and revenue-at-risk analysis', day: 1, throughDay: 5 },
        { name: 'Vikram Nair', role: 'Business Stakeholder', does: 'Takes compensation offers to the clients', day: 5, needsYou: true },
      ],
      unlockAfter: 2,
    },
    {
      key: 'pay-equity-audit',
      title: 'Pay Equity Audit',
      description: 'A role-by-role look at pay spread, to find where the same job is paid very differently.',
      kind: 'audit',
      stakeholder: 'stakeholder',
      difficulty: 'Hard',
      taskKeys: [
        // Day 1 — what equity means here, and how small our role populations are.
        'pe-101', 'pe-102', 'pe-103', 'pe-104', 'pe-105', 'pe-106',
        // Day 2 — spread within role, and whether tenure explains it.
        'pe-110', 'pe-111', 'pe-112', 'pe-113', 'pe-114', 'pe-115',
        // Day 3 — the wobble: nobody is outside their band, so the headline deliverable
        // comes back empty and has to be reported as the assurance it is.
        'pe-120', 'pe-121', 'pe-122', 'pe-123', 'pe-124', 'pe-125',
        // Day 4 — compression. Every Staff Engineer out-earns every Engineering Manager.
        'pe-130', 'pe-131', 'pe-132', 'pe-133', 'pe-134', 'pe-135',
        // Day 5 — the report, under pressure to have found something.
        'pe-140', 'pe-141', 'pe-142', 'pe-143', 'pe-144', 'pe-145',
      ],
      skillFocus: ['sql', 'python', 'businessLogic', 'communication'],
      impactValue: 15000,
      contributors: [
        { name: 'Neha Kulkarni', role: 'People Partner', does: 'Framed the equity question and scope', day: 1 },
        { name: null, role: 'Data Analyst', does: 'The role-by-role pay analysis', day: 1, throughDay: 5 },
        { name: 'Aarav Bose', role: 'Finance Manager', does: 'Costs the remediation from your findings', day: 5, needsYou: true },
      ],
      unlockAfter: 3,
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
        // Day 2 — three measures of "worst service" that name three different services.
        'sa-020', 'sa-021', 'sa-022', 'sa-023', 'sa-024', 'sa-025',
        // Day 3 — the wobble. The fastest-looking service is fastest because its hard
        // incidents never closed, and MTTR is biased the same way everywhere.
        'sa-030', 'sa-031', 'sa-032', 'sa-033', 'sa-034', 'sa-003',
        // Day 4 — blast radius and backlog. The biggest backlog belongs to a client with
        // no incidents at all.
        'sa-040', 'sa-041', 'sa-042', 'sa-043', 'sa-044', 'sa-045',
        // Day 5 — where a quarter of engineering effort goes, which the data will not say.
        'sa-050', 'sa-051', 'sa-052', 'sa-053', 'sa-054', 'sa-055',
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
      taskKeys: [
        // Day 1 — there is no cost column, so build a proxy and say it is one.
        'sb-101', 'sb-102', 'sb-103', 'sa-002', 'sb-104', 'sb-105',
        // Day 2 — flat support load against thirteenfold revenue variation.
        'sb-110', 'sb-111', 'sb-112', 'sb-113', 'sb-114', 'sb-115',
        // Day 3 — the wobble. SUM(DISTINCT mrr), the fix taught last week, silently loses
        // a client because two Starter accounts bill the same amount.
        'sb-120', 'sb-121', 'sb-122', 'sa-004', 'sb-123', 'sb-124',
        // Day 4 — concentration, and a CSM analysis that turns out to be a non-finding.
        'sb-130', 'sb-131', 'sb-132', 'sb-133', 'sb-134', 'sb-135',
        // Day 5 — the Starter recommendation, under pressure to just kill the tier.
        'sb-140', 'sb-141', 'sb-142', 'sb-143', 'sb-144', 'sb-145',
      ],
      skillFocus: ['sql', 'python', 'businessLogic'],
      impactValue: 34000,
      contributors: [
        { name: 'Diya Chandra', role: 'Finance Analyst', does: 'Supplied the revenue baseline', day: 1 },
        { name: null, role: 'Senior Data Analyst', does: 'The cost-to-serve analysis', day: 1, throughDay: 5 },
        { name: 'Vikram Nair', role: 'Business Stakeholder', does: 'Takes the pricing case to the board', day: 5, needsYou: true },
      ],
      unlockAfter: 1,
    },
    {
      key: 'activation-review',
      title: 'Activation & Onboarding Review',
      description: 'Product wants to know why signups are not turning into users, and whether June really was as bad as it looks.',
      kind: 'analysis',
      stakeholder: 'stakeholder',
      difficulty: 'Hard',
      level: 'senior',
      datasetKey: 'product_events',
      taskKeys: [
        // Day 1 — the window. June looks like a collapse and is twelve days of data.
        'ac-101', 'ac-102', 'ac-103', 'ac-104', 'ac-105', 'ac-106',
        // Day 2 — the funnel that is not a funnel: a step converts at 114%.
        'ac-110', 'ac-111', 'ac-112', 'ac-113', 'ac-114', 'ac-115',
        // Day 3 — the wobble. An event fires twice, and only on one mobile build.
        'ac-120', 'ac-121', 'ac-122', 'ac-123', 'ac-124', 'ac-125',
        // Day 4 — who is in the table, and what a session with no duration means.
        'ac-130', 'ac-131', 'ac-132', 'ac-133', 'ac-134', 'ac-135',
        // Day 5 — activation and retention rank the channels differently. Pick one.
        'ac-140', 'ac-141', 'ac-142', 'ac-143', 'ac-144', 'ac-145',
      ],
      skillFocus: ['sql', 'python', 'businessLogic', 'statistics'],
      impactValue: 31000,
      contributors: [
        { name: 'Rohan Desai', role: 'Mobile Engineer', does: 'Owns the client that fires the events', day: 3 },
        { name: null, role: 'Senior Data Analyst', does: 'The activation and retention analysis', day: 1, throughDay: 5 },
        { name: 'Priya Menon', role: 'Head of Product', does: 'Sets next quarter from your recommendation', day: 5, needsYou: true },
      ],
      unlockAfter: 2,
    },
    {
      key: 'experiment-readout',
      title: 'Onboarding Experiment Readout',
      description: 'The new onboarding appears to have lost. Product wants a rollback note; the assignment was not random.',
      kind: 'audit',
      stakeholder: 'stakeholder',
      difficulty: 'Hard',
      level: 'senior',
      datasetKey: 'product_events',
      taskKeys: [
        // Day 1 — check the randomisation before reading the result. It is broken.
        'ex-101', 'ex-102', 'ex-103', 'ex-104', 'ex-105', 'ex-106',
        // Day 2 — reproduce the headline, then rule out the boring explanations.
        'ex-110', 'ex-112', 'ex-113', 'ex-111', 'ex-114', 'ex-115',
        // Day 3 — the wobble, and the whole point: it wins in both segments.
        'ex-120', 'ex-121', 'ex-122', 'ex-123', 'ex-124', 'ex-125',
        // Day 4 — handed the means to manufacture any finding, and having to not.
        'ex-130', 'ex-131', 'ex-132', 'ex-133', 'ex-134', 'ex-135',
        // Day 5 — the readout that reverses what the business was told on Monday.
        'ex-140', 'ex-141', 'ex-142', 'ex-143', 'ex-144', 'ex-145',
      ],
      skillFocus: ['sql', 'python', 'statistics', 'communication'],
      impactValue: 38000,
      contributors: [
        { name: 'Priya Menon', role: 'Head of Product', does: 'Owns the rollout decision', day: 1, throughDay: 5, needsYou: true },
        { name: null, role: 'Senior Data Analyst', does: 'The experiment readout', day: 1, throughDay: 5 },
        { name: 'Vikram Nair', role: 'Business Stakeholder', does: 'Carries the result to the business', day: 5 },
      ],
      unlockAfter: 3,
    },

    // ---- Team Lead track ----------------------------------------------------------
    // The work changes shape here. A lead is rarely the first person to compute a number
    // — they are handed one somebody else computed and asked whether the business can be
    // run on it. So these projects open with a draft, a claim or a slide, and the task is
    // to establish what it is worth before it reaches a room.
    {
      key: 'trading-review',
      title: 'Half-Year Trading Review',
      description: 'The board pack has a draft headline, a star performer and three definitions nobody agreed. Sign it off or fix it.',
      kind: 'review',
      stakeholder: 'stakeholder',
      difficulty: 'Hard',
      level: 'lead',
      datasetKey: 'retail_sales',
      taskKeys: [
        // Day 1 — the headline counts refunds as transactions.
        'ta-101', 'ta-102', 'ta-103', 'ta-104', 'ta-105', 'ta-106',
        // Day 2 — the store ranking is a ranking of trading days.
        'ta-110', 'ta-111', 'ta-112', 'ta-113', 'ta-114', 'ta-115',
        // Day 3 — the wobble. The estate's one growing store is a double-loaded month.
        'ta-120', 'ta-121', 'ta-122', 'ta-123', 'ta-124', 'ta-125',
        // Day 4 — rebuild it like for like, and refuse to name a cause you cannot show.
        'ta-130', 'ta-131', 'ta-132', 'ta-133', 'ta-134', 'ta-135',
        // Day 5 — the pack, the sign-off, and what changes about how this gets produced.
        'ta-140', 'ta-141', 'ta-142', 'ta-143', 'ta-144', 'ta-145',
      ],
      skillFocus: ['sql', 'python', 'businessLogic', 'communication'],
      impactValue: 42000,
      contributors: [
        { name: 'Ravi Menon', role: 'Retail Analyst', does: 'Drafted the pack you are checking', day: 1 },
        { name: null, role: 'Data Analytics Team Lead', does: 'Owns what leaves the team', day: 1, throughDay: 5 },
        { name: 'Priya Menon', role: 'Head of Product', does: 'Presents the trading slide', day: 5, needsYou: true },
      ],
      unlockAfter: 0,
    },
    {
      key: 'margin-review',
      title: 'Margin & Promotion Review',
      description: 'Finance want margin by category. The cost column is today\'s cost, and one month of the year was a promotion nobody documented.',
      kind: 'audit',
      stakeholder: 'stakeholder',
      difficulty: 'Hard',
      level: 'lead',
      datasetKey: 'retail_sales',
      taskKeys: [
        // Day 1 — there is no margin column, and unit_cost is the cost today.
        'tb-101', 'tb-102', 'tb-103', 'tb-104', 'tb-105', 'tb-106',
        // Day 2 — Equipment is two thirds of revenue at the worst rate in the book.
        'tb-110', 'tb-111', 'tb-112', 'tb-113', 'tb-114', 'tb-115',
        // Day 3 — the wobble. The naive cost understates margin UNEVENLY, so it distorts
        // the comparison rather than shifting it, and invents an improving trend.
        'tb-120', 'tb-121', 'tb-122', 'tb-123', 'tb-124', 'tb-125',
        // Day 4 — November: 55% more units, 39% more revenue, 12% more margin.
        'tb-130', 'tb-131', 'tb-132', 'tb-133', 'tb-134', 'tb-135',
        // Day 5 — whether to do it again, and what to instrument before anyone does.
        'tb-140', 'tb-141', 'tb-142', 'tb-143', 'tb-144', 'tb-145',
      ],
      skillFocus: ['sql', 'python', 'businessLogic', 'communication'],
      impactValue: 46000,
      contributors: [
        { name: 'Diya Chandra', role: 'Finance Analyst', does: 'Owns the range review this feeds', day: 1, throughDay: 5, needsYou: true },
        { name: null, role: 'Data Analytics Team Lead', does: 'The margin and promotion analysis', day: 1, throughDay: 5 },
        { name: 'Ravi Menon', role: 'Retail Analyst', does: 'Drafts the planning note', day: 5 },
      ],
      unlockAfter: 1,
    },
    {
      key: 'range-review',
      title: 'Range & Space Review',
      description: 'Buying want a delist list. Seven lines in the range have never been stocked anywhere, and the stock table cannot answer the question they asked.',
      kind: 'review',
      stakeholder: 'stakeholder',
      difficulty: 'Hard',
      level: 'lead',
      datasetKey: 'retail_sales',
      taskKeys: [
        // Day 1 — seven products no store has ever carried, invisible to an inner join.
        'tc-101', 'tc-102', 'tc-103', 'tc-104', 'tc-105', 'tc-106',
        // Day 2 — ten of sixty-one lines carry 55% of the margin, and a delist rule that
        // cannot see the worst lines in the book.
        'tc-110', 'tc-111', 'tc-112', 'tc-113', 'tc-114', 'tc-115',
        // Day 3 — the wobble. Stock cover is computable and meaningless: every product
        // holds about twenty units whether it sells 234 a year or 482.
        'tc-120', 'tc-121', 'tc-122', 'tc-123', 'tc-124', 'tc-125',
        // Day 4 — distribution against performance, and what a delist actually saves.
        'tc-130', 'tc-131', 'tc-132', 'tc-133', 'tc-134', 'tc-135',
        // Day 5 — the paper, the sign-off, and what would make the next one answerable.
        'tc-140', 'tc-141', 'tc-142', 'tc-143', 'tc-144', 'tc-145',
      ],
      skillFocus: ['sql', 'python', 'businessLogic', 'communication'],
      impactValue: 44000,
      contributors: [
        { name: 'Sneha Joshi', role: 'Buying Manager', does: 'Owns the range and the delist decision', day: 1, throughDay: 5, needsYou: true },
        { name: null, role: 'Data Analytics Team Lead', does: 'The range and space analysis', day: 1, throughDay: 5 },
        { name: 'Ravi Menon', role: 'Retail Analyst', does: 'Proposes the delist rule', day: 2 },
      ],
      unlockAfter: 2,
    },
    {
      key: 'board-pack',
      title: 'Year-End Board Pack',
      description: 'Three people submitted three different revenue figures. You own the one the board hears, and the estimate for next year.',
      kind: 'review',
      stakeholder: 'stakeholder',
      difficulty: 'Hard',
      level: 'lead',
      datasetKey: 'retail_sales',
      taskKeys: [
        // Day 1 — three submissions, three correct answers to three unstated questions.
        'td-101', 'td-102', 'td-103', 'td-104', 'td-105', 'td-106',
        // Day 2 — the bridge, which has to reconcile to the rupee.
        'td-110', 'td-111', 'td-112', 'td-113', 'td-114', 'td-115',
        // Day 3 — the wobble. The learner's own earlier correction was right for a
        // comparison and wrong for a total, and cost three and a half lakh of real trade.
        'td-120', 'td-121', 'td-122', 'td-123', 'td-124', 'td-125',
        // Day 4 — an estimate for next year that has to survive being asked what it assumes.
        'td-130', 'td-131', 'td-132', 'td-133', 'td-134', 'td-135',
        // Day 5 — the pack, the board question, and the standard that stops this recurring.
        'td-140', 'td-141', 'td-142', 'td-143', 'td-144', 'td-145',
      ],
      skillFocus: ['sql', 'python', 'businessLogic', 'communication'],
      impactValue: 52000,
      contributors: [
        { name: 'Ravi Menon', role: 'Retail Analyst', does: 'Submitted the gross figure', day: 1 },
        { name: 'Diya Chandra', role: 'Finance Analyst', does: 'Submitted the net figure', day: 1 },
        { name: null, role: 'Data Analytics Team Lead', does: 'Owns the number the board hears', day: 1, throughDay: 5 },
        { name: 'Asha Rao', role: 'Line Manager', does: 'Presents the pack to the board', day: 5, needsYou: true },
      ],
      unlockAfter: 3,
    },
    {
      key: 'capacity-review',
      title: 'Demand & Capacity Review',
      description: 'The budget round wants a cost per analysis and a view on whether fourteen people is right. The timesheets cover an eighth of the paid time.',
      kind: 'review',
      stakeholder: 'stakeholder',
      difficulty: 'Hard',
      level: 'manager',
      datasetKey: 'analytics_ops',
      taskKeys: [
        // Day 1 — the intake. A resourcing question arrives dressed as a productivity one.
        'ma-101', 'ma-102', 'ma-103', 'ma-104', 'ma-105', 'ma-106',
        // Day 2 — who looks busy, which turns out to rank people by timesheet discipline.
        'ma-110', 'ma-111', 'ma-112', 'ma-113', 'ma-114', 'ma-115',
        // Day 3 — the wobble. Coverage is 12.8%, so every rate built on logged hours is
        // out by a factor of eight, including the one already sent.
        'ma-120', 'ma-121', 'ma-122', 'ma-123', 'ma-124', 'ma-125',
        // Day 4 — capacity from presence rather than headcount, and the cost of work
        // nobody ended up wanting.
        'ma-130', 'ma-131', 'ma-132', 'ma-133', 'ma-134', 'ma-135',
        // Day 5 — what the exec is told, what the budget pack may say, and what gets
        // instrumented so the next budget round is not this one again.
        'ma-140', 'ma-141', 'ma-142', 'ma-143', 'ma-144', 'ma-145',
      ],
      skillFocus: ['sql', 'python', 'businessLogic', 'communication'],
      impactValue: 61000,
      contributors: [
        { name: 'Vikram Nair', role: 'Business Stakeholder', does: 'Asks the budget-round question', day: 1, needsYou: true },
        { name: null, role: 'Data Analytics Manager', does: 'Owns the answer and the team it is about', day: 1, throughDay: 5 },
        { name: 'Diya Chandra', role: 'Finance Analyst', does: 'Drafts the analytics slide for the budget pack', day: 5, needsYou: true },
        { name: 'Asha Rao', role: 'Line Manager', does: 'Takes the establishment case into the round', day: 5 },
      ],
      unlockAfter: 0,
    },
    {
      key: 'tooling-review',
      title: 'Tooling & Licence Renewal',
      description: 'A ₹21.6 lakh BI contract auto-renews in forty-six days. Sixteen of its thirty seats have never been assigned to anybody.',
      kind: 'review',
      stakeholder: 'finance_analyst',
      difficulty: 'Hard',
      level: 'manager',
      datasetKey: 'analytics_ops',
      taskKeys: [
        // Day 1 — the estate, and cost per seat, which is where everybody starts.
        'mb-101', 'mb-102', 'mb-103', 'mb-104', 'mb-105', 'mb-106',
        // Day 2 — seats, assignments and active users turn out to be three numbers, and
        // the per-seat ranking inverts when the denominator has people in it.
        'mb-110', 'mb-111', 'mb-112', 'mb-113', 'mb-114', 'mb-115',
        // Day 3 — the wobble. Monday's ranking pointed at the best-used tool in the
        // estate, and the most visible cut is the one that removes a capability.
        'mb-120', 'mb-121', 'mb-122', 'mb-123', 'mb-124', 'mb-125',
        // Day 4 — the recovery in three buckets, and the gap between what is recoverable
        // and what you are willing to recommend.
        'mb-130', 'mb-131', 'mb-132', 'mb-133', 'mb-134', 'mb-135',
        // Day 5 — the renewal, a vendor who would rather you did not, and the checks that
        // stop next year being this week again.
        'mb-140', 'mb-141', 'mb-142', 'mb-143', 'mb-144', 'mb-145',
      ],
      skillFocus: ['sql', 'python', 'businessLogic', 'communication'],
      impactValue: 1389000,
      contributors: [
        { name: 'Diya Chandra', role: 'Finance Analyst', does: 'Owns the renewal and the budget line', day: 1, throughDay: 5, needsYou: true },
        { name: null, role: 'Data Analytics Manager', does: 'Decides the seat counts', day: 1, throughDay: 5 },
        { name: 'Rahul Verma', role: 'Data Engineer', does: 'Reclaims the seats once they are agreed', day: 4 },
        { name: 'Asha Rao', role: 'Line Manager', does: 'Signs off what becomes standing process', day: 5, needsYou: true },
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
  const want = LEVEL_ORDER.includes(level) ? level : 'junior';
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
// Three rungs, because there are four levels. Each names the average a learner has to be
// carrying to climb it. The bar rises with the rung: the same score means something
// different when the work is "answer this question" than when it is "decide what the
// question should be and defend the answer to a board".
const PROMOTION_LADDER = [
  { from: 'junior', to: 'senior', title: 'Senior Data Analyst', minAverage: 75 },
  { from: 'senior', to: 'lead', title: 'Data Analytics Team Lead', minAverage: 80 },
  { from: 'lead', to: 'manager', title: 'Data Analytics Manager', minAverage: 85 },
];

// One month of the programme: four projects at five working days each.
const PROMOTION_PROJECTS_REQUIRED = 4;

// The conversation opens a project BEFORE the decision, which is the user's rule and is
// also how it works in a real company: nobody finds out the bar existed on the day they
// are measured against it. At the third project Asha opens the negotiation and names the
// number; at the fourth she runs the review against it. That gap is one whole project of
// knowing exactly what you are playing for — which is the only thing that makes the
// target actionable rather than a verdict.
const PROMOTION_OPENS_AFTER = 3;
const PROMOTION_DECIDES_AFTER = 4;

function promotionRung(level) {
  return PROMOTION_LADDER.find((r) => r.from === (level || 'junior')) || null;
}

function getPromotion(enrollment, projects, gradedTasks, tasks) {
  const level = enrollment.level || 'junior';
  const rung = promotionRung(level);

  // Top of the ladder. There is nothing left to negotiate, and saying that plainly beats
  // rendering an empty progress card that looks like a bug.
  if (!rung) {
    return {
      awarded: true,
      atTheTop: true,
      atLevel: level,
      toTitle: levelLabel(level),
      criteria: [],
      shortfall: null,
      negotiation: null,
      eligible: false,
      atTheEnd: false,
      parked: [],
    };
  }

  const levelKeys = new Set(
    (PROJECT_CATALOG[enrollment.role] || [])
      .filter((p) => (p.level || 'junior') === level)
      .map((p) => p.key),
  );
  // Only projects that are finished being WRITTEN can be finished by a learner, so the
  // bar is the number of them that exist. Without this, shipping the ladder before the
  // content makes promotion permanently unreachable — the learner clears everything in
  // front of them and is told they are two projects short of something that is not there.
  const readyKeys = new Set(
    (PROJECT_CATALOG[enrollment.role] || [])
      .filter((p) => levelKeys.has(p.key) && projectReadiness(p).ready)
      .map((p) => p.key),
  );
  const decideAfter = Math.min(PROMOTION_DECIDES_AFTER, Math.max(1, readyKeys.size));
  // The conversation still has to come before the decision even on a short level, so it
  // never lands after the thing it was meant to prepare the learner for.
  const opensAfter = Math.max(1, Math.min(PROMOTION_OPENS_AFTER, decideAfter - 1));

  const completed = projects.filter((p) => levelKeys.has(p.key) && p.status === 'completed').length;
  const average = gradedTasks.length
    ? Math.round(gradedTasks.reduce((s, t) => s + (t.score || 0), 0) / gradedTasks.length)
    : null;

  const trainingDone = completed >= decideAfter;
  const performanceMet = average !== null && average >= rung.minAverage;

  // A parked task keeps its project out of `completed`, so a learner who reached the end
  // of the track with parked work would sit in silence forever, never told why the
  // review never came. `atTheEnd` is what actually triggers the conversation: every
  // project at this level started, and every task in them resolved one way or the other.
  const levelTaskKeys = new Set(
    (PROJECT_CATALOG[enrollment.role] || [])
      .filter((p) => levelKeys.has(p.key))
      .flatMap((p) => p.taskKeys),
  );
  const mine = (tasks || []).filter((t) => levelTaskKeys.has(t.task_key));
  const startedProjects = projects.filter((p) => levelKeys.has(p.key) && (p.status === 'active' || p.status === 'completed')).length;
  const parked = mine.filter((t) => t.status === 'parked');
  const atTheEnd = startedProjects >= decideAfter
    && mine.length > 0
    && mine.every((t) => t.status === 'graded' || t.status === 'parked');

  return {
    awarded: false,
    atTheTop: false,
    atLevel: level,
    toTitle: rung.title,
    eligible: trainingDone && performanceMet,
    criteria: [
      {
        key: 'training',
        label: `Complete all ${decideAfter} ${levelLabel(level).toLowerCase()} project${decideAfter === 1 ? '' : 's'}`,
        met: trainingDone,
        value: completed,
        target: decideAfter,
        detail: `${completed} of ${decideAfter} delivered`,
      },
      {
        key: 'performance',
        label: `Average score of ${rung.minAverage} or above`,
        met: performanceMet,
        value: average,
        target: rung.minAverage,
        detail: average === null
          ? 'No graded work yet'
          : `${average} across ${gradedTasks.length} graded task${gradedTasks.length === 1 ? '' : 's'}`,
      },
    ],
    // What the learner is told once the conversation is open: the number to beat, how
    // far off they are today, and which project decides it.
    negotiation: {
      opensAfter,
      decidesAfter: decideAfter,
      open: completed >= opensAfter,
      opened: Boolean(enrollment.promotion_opened_at),
      openedAt: enrollment.promotion_opened_at || null,
      target: rung.minAverage,
      current: average,
      projectsLeft: Math.max(0, decideAfter - completed),
    },
    // Only meaningful while short on score: work they could genuinely lift.
    shortfall: !performanceMet && average !== null ? rung.minAverage - average : null,
    // Internal: whether the review is due, and what is holding it up.
    atTheEnd,
    parked: parked.map((t) => ({ id: t.id, title: t.title })),
  };
}

// Runs at read time, in two phases a project apart.
//
// Phase one opens the negotiation when the third project lands: Asha says the promotion
// conversation has started, names the number, and says which project it will be decided
// on. Phase two runs the review when the fourth lands.
//
// Promotion is announced to you in a real job — you do not click a button to claim it —
// so both phases fire by themselves.
function runPromotionReview(enrollment, promotion, tasks) {
  if (!promotion || promotion.awarded || promotion.atTheTop) return false;
  const rung = promotionRung(enrollment.level || 'junior');
  if (!rung) return false;
  const neg = promotion.negotiation;

  // ---- Phase one: open the conversation, once, at the third project ----------------
  if (neg && neg.open && !neg.opened && !promotion.eligible) {
    const standing = neg.current === null
      ? 'You have nothing graded yet, so there is no number I can quote you — which is its own answer: the next two weeks are the whole case.'
      : neg.current >= rung.minAverage
        ? `You're carrying ${neg.current} right now, so you're above it. Staying above it is the job — one weak project pulls an average down faster than a strong one pushes it up.`
        : `You're carrying ${neg.current} right now, which is ${rung.minAverage - neg.current} short. That's not a verdict, it's a gap with one project left to close it.`;
    addMessage(enrollment.id, 'line_manager', LINE_MANAGER_NAME,
      `I'm opening your promotion conversation now rather than after the fact, because you should know what you're playing for while you can still do something about it.\n\n`
      + `The role is ${rung.title}. There are two conditions and both have to hold — one strong project doesn't cover a weak one.\n\n`
      + `1. All ${neg.decidesAfter} projects at this level delivered. You are on ${neg.decidesAfter - neg.projectsLeft}.\n`
      + `2. An average of ${rung.minAverage} or above across everything I have graded.\n\n`
      + `${standing}\n\n`
      + `I'll run the review the moment your ${ordinalWord(neg.decidesAfter)} project is signed off. Nothing is decided before then, and nothing is deferred after it.`,
      null, `Promotion conversation — ${rung.title}`);
    db.prepare('UPDATE sim_enrollments SET promotion_opened_at = ? WHERE id = ?').run(now(), enrollment.id);
    return false;
  }

  // ---- Phase two: the decision -----------------------------------------------------
  if (promotion.eligible) {
    const at = now();
    db.prepare('UPDATE sim_enrollments SET level = ?, promoted_at = ?, promotion_told_at = NULL, promotion_opened_at = NULL WHERE id = ?')
      .run(rung.to, at, enrollment.id);
    const perf = promotion.criteria.find((c) => c.key === 'performance');
    const train = promotion.criteria.find((c) => c.key === 'training');
    addMessage(enrollment.id, 'line_manager', LINE_MANAGER_NAME,
      `I've put you forward for ${rung.title} and it's gone through.\n\n`
      + `${train.value} projects delivered and an average of ${perf.value} against a bar of ${rung.minAverage} — you cleared both, which is exactly what I told you the conditions were. `
      + `What changes is the work, not the amount of hand-holding: ${LEVEL_STEP_UP[rung.to] || "you'll be judged on judgement as much as on execution"}.\n\n`
      + `Your first ${levelLabel(rung.to).toLowerCase()} project is on your board now.`,
      null, `Promotion — ${rung.title}`);
    addMessage(enrollment.id, 'people_partner', PEOPLE_PARTNER_NAME,
      `Congratulations — your promotion to ${rung.title} is confirmed and effective today. It's on your record, so it'll appear on anything you take out of here.`,
      null, 'Promotion confirmed');
    return true;
  }

  // Not eligible. Say so ONCE, with the arithmetic — but only once they are actually at
  // the end of the level. Telling someone mid-project that they are short is just noise,
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
    body = `We've reached the end of the ${levelLabel(enrollment.level || 'junior').toLowerCase()} track and I want to be straight with you rather than leave you guessing.\n\nI can't put you forward yet, and it isn't the score — it's that ${n === 1 ? 'one task is' : `${n} tasks are`} still parked: ${promotion.parked.map((t) => `"${t.title}"`).join(', ')}. Parked means you got the answer out but couldn't talk me through the choice, and I'm not signing off work neither of us can explain.\n\nThat's the good news, though — it's the one thing here you can fix today. Reopen ${n === 1 ? 'it' : 'them'}, work out what you missed, and resubmit. Then we do the review properly.`;
  } else {
    body = `We've run the review we opened a project ago, and I want to be straight with you rather than leave you guessing.\n\nYou've finished all ${training.target} projects, which is the training condition met. The other one was an average of ${rung.minAverage} and you're at ${perf.value} — ${promotion.shortfall} short.\n\nEverything you've submitted is signed off, so there's nothing sitting there to recover. That means this is a next-cycle conversation, not a this-week one — the work you do from here is what moves it.\n\nThis isn't a judgement on you. It's a number, and numbers move.`;
  }
  addMessage(enrollment.id, 'line_manager', LINE_MANAGER_NAME, body, null, 'Promotion round — where you stand');
  db.prepare('UPDATE sim_enrollments SET promotion_told_at = ? WHERE id = ?').run(now(), enrollment.id);
  return false;
}

// What actually changes at each rung, in Asha's voice. Kept beside the ladder rather than
// inline in the message so a new level cannot ship without someone deciding what it means.
const LEVEL_STEP_UP = {
  senior: 'it stops being "answer this question" and becomes "decide what the question should be", and I\'ll review your judgement as much as your SQL',
  lead: "you'll be reviewing other people's analysis as well as producing your own, and you own what leaves the team whether or not you wrote it",
  manager: 'you own the portfolio and the people in it — what gets worked on, what gets dropped, and what you are prepared to defend upward',
};

function ordinalWord(n) {
  return ({ 1: 'first', 2: 'second', 3: 'third', 4: 'fourth', 5: 'fifth' })[n] || `${n}th`;
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


  // ---- Project 3: Project Phoenix — Outage Impact & Client Recovery -----------------
  //
  // Customer Success has a compensation budget and has to decide who gets it. The week's
  // spine, and every figure in it measured against the generated dataset:
  //
  //   Monday    what "affected" means — billing-sync hit two clients, everything hit
  //             fourteen, and the brief says one while the meeting means the other
  //   Tuesday   quantify the damage — Harborview took 492k rows, and Dunmore, the biggest
  //             client in the book, lost seven thousand
  //   Wednesday the wobble — Lattice already churned, and severity does not track damage
  //   Thursday  a second signal from tickets: the loudest client is the smallest one
  //   Friday    the recommendation, with a budget that does not cover everyone
  //
  // The trap running through it: every instinct here (compensate the biggest, compensate
  // the loudest, compensate by severity) is contradicted by the data.

  'ph-101': {
    title: 'What does "affected" actually mean',
    hint: "Read the brief and the meeting note side by side. They are not asking the same question.",
    brief: "Priya in Customer Success has asked you to size the damage from the billing-sync outage. Before you write any SQL, work out what is actually being asked — because the brief and the conversation behind it do not match.",
    tool: 'choice', datasetKey: 'saas_ops',
    choice: {
      exhibit: {
        kind: 'email', from: 'Vikram Nair', subject: 'Compensation for the outage — need this by Friday',
        body: "We have a goodwill budget and the board wants it spent well. Customer Success needs to know which clients were hurt badly enough to warrant something.\n\nIt started with the billing-sync problem but honestly the whole quarter has been rough for some accounts. Use your judgement on scope — you will see the data before I do.",
      },
      prompt: 'Tick everything that follows from what he has actually asked for.',
      options: [
        { key: 'scope', correct: true, label: 'Scope is a decision you have to make and state, not one you have been given', why: '"Use your judgement on scope" is a real instruction. The analyst who silently picks one and never says which has not done the job.' },
        { key: 'both', correct: true, label: 'Both readings are worth measuring before choosing', why: 'Billing-sync only and any-incident give very different client lists. Knowing the size of that difference is what makes the choice defensible.' },
        { key: 'active', correct: true, label: 'Only clients we still have can be compensated', why: 'A goodwill payment to an account that has already left is not goodwill, it is an accounting error. This matters later than you think.' },
        { key: 'literal', correct: false, label: 'Answer the billing-sync question exactly as written and nothing more', why: 'He told you the quarter was rough for some accounts. Answering the narrow question when you have been handed the wider one is technically compliant and useless.' },
        { key: 'ask', correct: false, label: 'Go back and ask him to define "affected" precisely', why: 'He has explicitly delegated it. Bouncing it back is how an analyst becomes a ticket queue rather than someone whose judgement is wanted.' },
        { key: 'all', correct: false, label: 'Recommend compensating everyone who had any incident at all', why: 'Fourteen of sixteen clients had an incident. A recommendation that covers almost everybody is not a recommendation, it is a refusal to prioritise.' },
      ],
      skills: { businessLogic: 100, communication: 80 },
    },
    estHours: 0.25, priority: 'high', dueInDays: 1, day: 1, difficulty: 'medium',
  },

  'ph-102': {
    title: 'The size of the book',
    hint: "One row. A CASE inside a SUM counts a condition without throwing the other rows away.",
    brief: "Start with the denominator — you cannot say anyone was badly hit without knowing what the book looks like. Write ONE SQL SELECT returning, in a single row: how many clients we have, how many are still active, and the total monthly recurring revenue across all of them.",
    referenceSql: "SELECT COUNT(*) AS clients, SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active, SUM(mrr) AS total_mrr FROM clients",
    datasetKey: 'saas_ops', tool: 'sql', estHours: 0.25, priority: 'medium', dueInDays: 1, day: 1, difficulty: 'easy',
  },

  'ph-103': {
    title: 'Billing-sync, exactly as asked',
    hint: "Filter on the service. Notice how short the answer is before you decide what it means.",
    brief: "Answer the narrow question first, so you know what it is worth. Write ONE SQL SELECT returning every client hit by a BILLING-SYNC incident, with their tier, monthly revenue, how many billing-sync incidents they had and the total rows corrupted. Biggest client first.",
    referenceSql: "SELECT c.company, c.tier, c.mrr, COUNT(i.id) AS incidents, SUM(i.rows_corrupted) AS rows_corrupted FROM clients c JOIN incidents i ON i.client_id = c.id WHERE i.service = 'billing-sync' GROUP BY c.company, c.tier, c.mrr ORDER BY c.mrr DESC",
    datasetKey: 'saas_ops', tool: 'sql', estHours: 0.4, priority: 'high', dueInDays: 2, day: 1, difficulty: 'medium',
  },

  'ph-104': {
    title: 'How much of the quarter was billing-sync',
    hint: "COUNT counts rows. COUNT(DISTINCT ...) counts things. You need both here and they are very different numbers.",
    brief: "Put the billing-sync answer in context. Write ONE SQL SELECT returning, for each service, how many incidents it had and how many DISTINCT clients it hit, most incidents first.",
    referenceSql: 'SELECT service, COUNT(*) AS incidents, COUNT(DISTINCT client_id) AS clients_hit FROM incidents GROUP BY service ORDER BY incidents DESC',
    datasetKey: 'saas_ops', tool: 'sql', estHours: 0.35, priority: 'high', dueInDays: 2, day: 1, difficulty: 'medium',
  },

  'ph-105': {
    title: 'Tell Vikram what you are going to measure',
    hint: "The scope decision is the whole note. Give him the two numbers that make it obvious, then say which you are taking.",
    brief: "Write back with the scope decision. He handed you the judgement call, which means he needs to see you make it — and to be able to stop you if he disagrees, today rather than on Friday. Under 140 words.",
    tool: 'writeup', datasetKey: 'saas_ops',
    writeup: {
      to: 'Vikram Nair', subject: 'Outage compensation — how I am scoping it', maxWords: 140,
      prompt: 'The scope decision, with the evidence that makes it the right one.',
      rubric: [
        { key: 'narrow', label: 'How small the billing-sync answer is', markers: ['two|2 client|three incident|3 incident|billing.sync|only'], why: 'Two clients out of sixteen. If he pictured a big number, he needs correcting now.' },
        { key: 'wide', label: 'How big the any-incident answer is', markers: ['fourteen|14|most|nearly all|all but two'], why: 'Fourteen of sixteen. The other extreme is just as unusable, and saying so proves you looked.' },
        { key: 'choice', label: 'Which scope you are taking', markers: ['I will|I am|taking|going with|propose|recommend|suggest'], why: 'Name it. A note that lays out both and picks neither has handed the decision back.' },
        { key: 'why', label: 'Why that scope', markers: ['because|since|damage|severity|rows|material|meaningful|rank'], why: 'The reason is what lets him overrule you intelligently instead of just deferring.' },
        { key: 'when', label: 'When it lands', markers: ['friday|by|end of|day|thursday'], why: 'He told you Friday. Confirming it is how he stops chasing.' },
      ],
    },
    estHours: 0.4, priority: 'high', dueInDays: 2, day: 1, difficulty: 'medium',
  },

  'ph-110': {
    title: 'Everyone who was hit, and how hard',
    hint: "Rows corrupted is the damage. Order by it, not by who pays us the most — that comparison is the point.",
    brief: "Now the wide version. Write ONE SQL SELECT returning every client with at least one incident: company, tier, monthly revenue, status, how many incidents and total rows corrupted. Worst damage first.",
    referenceSql: 'SELECT c.company, c.tier, c.mrr, c.status, COUNT(i.id) AS incidents, SUM(i.rows_corrupted) AS rows_corrupted FROM clients c JOIN incidents i ON i.client_id = c.id GROUP BY c.company, c.tier, c.mrr, c.status ORDER BY rows_corrupted DESC',
    datasetKey: 'saas_ops', tool: 'sql', estHours: 0.5, priority: 'high', dueInDays: 2, day: 2, difficulty: 'medium',
  },

  'ph-111': {
    title: 'What that table says, and does not',
    hint: "Compare the top of the damage list with the top of the revenue list. They are not the same clients.",
    brief: "You have the damage table. Before anyone sees it, work out what it actually supports — because the obvious reading of it is wrong in two separate ways.",
    tool: 'choice', datasetKey: 'saas_ops',
    choice: {
      prompt: 'Tick everything your own result supports.',
      options: [
        { key: 'harbor', correct: true, label: 'Harborview Bank took by far the worst damage, and is not our biggest client', why: 'Nearly half a million rows across two incidents — roughly three times the next worst — on a Growth account, not an Enterprise one.' },
        { key: 'dunmore', correct: true, label: 'Our largest client by revenue was barely touched', why: 'Dunmore Legal pays the most and lost about seven thousand rows. Any scheme that pays out by account size would send the money exactly where the damage was not.' },
        { key: 'rank', correct: true, label: 'Damage and revenue rank clients in different orders', why: 'That difference IS the finding. If they agreed, nobody would need this analysis.' },
        { key: 'size', correct: false, label: 'Bigger clients were hit harder', why: 'Your own top row contradicts it. This is the assumption everyone walks in with, which is exactly why it has to be killed early.' },
        { key: 'count', correct: false, label: 'The client with the most incidents took the most damage', why: 'Harborview had two. Others had four. Incident count and damage are different measures and they disagree here.' },
        { key: 'everyone', correct: false, label: 'Fourteen of sixteen were affected, so effectively everyone was', why: 'True and useless. The spread between them is enormous — treating it as uniform throws away the only thing that can direct a budget.' },
      ],
      skills: { businessLogic: 100, dataViz: 40 },
    },
    estHours: 0.3, priority: 'high', dueInDays: 3, day: 2, difficulty: 'hard',
  },

  'ph-112': {
    title: 'Who was not touched at all',
    hint: "NOT EXISTS with a correlated subquery. A LEFT JOIN with an IS NULL check works too, if you prefer it.",
    brief: "The clean accounts matter as much as the damaged ones — they are revenue that does not belong anywhere in this analysis. Write ONE SQL SELECT returning every client with NO incidents at all, and their monthly revenue, biggest first.",
    referenceSql: 'SELECT c.company, c.mrr FROM clients c WHERE NOT EXISTS (SELECT 1 FROM incidents i WHERE i.client_id = c.id) ORDER BY c.mrr DESC',
    datasetKey: 'saas_ops', tool: 'sql', estHours: 0.4, priority: 'medium', dueInDays: 3, day: 2, difficulty: 'hard',
  },

  'ph-113': {
    title: 'Chart the damage',
    hint: "These categories have no order of their own, so give them one that helps the reader rank them.",
    brief: "Put rows corrupted per client on a slide for the Customer Success meeting. Clients are categories, not a sequence — which decides both the chart type and what you do about ordering.",
    tool: 'chart', datasetKey: 'saas_ops',
    chart: {
      prompt: 'Rows corrupted per client.',
      sourceSql: 'SELECT c.company, SUM(i.rows_corrupted) AS rows_corrupted FROM clients c JOIN incidents i ON i.client_id = c.id GROUP BY c.company ORDER BY rows_corrupted DESC',
      columns: ['company', 'rows_corrupted'],
      correct: { type: 'bar', x: 'company', y: 'rows_corrupted', sort: 'desc' },
      whyRight: 'Unordered categories compared by size: bars, sorted biggest first so the ranking reads at a glance.',
      why: {
        type: 'Companies are categories, not a sequence. A line between Harborview and Dunmore would imply a path that does not exist.',
        x: 'The client is the category being compared.',
        y: 'Rows corrupted is the damage being measured.',
        sort: 'Nothing orders these for you, so sorting by size does the reader\'s work for them — and here the ranking IS the finding.',
      },
    },
    estHours: 0.25, priority: 'medium', dueInDays: 3, day: 2, difficulty: 'medium',
  },

  'ph-114': {
    title: 'Send the damage table to Priya',
    hint: "Lead with the client nobody expects. The second sentence is the one that stops the money going to the wrong place.",
    brief: "Priya in Customer Success is drafting the compensation list. Send her what you have found so far. The hard part is that her working assumption — look after the big accounts — is the one your data contradicts. Under 150 words.",
    tool: 'writeup', datasetKey: 'saas_ops',
    writeup: {
      to: 'Priya Nair', subject: 'Outage damage — who was actually hit', maxWords: 150,
      prompt: 'The damage picture, with the assumption it overturns named explicitly.',
      rubric: [
        { key: 'worst', label: 'Who took the worst damage', markers: ['harborview|bank'], why: 'Name them. This is the sentence she needs.' },
        { key: 'scale', label: 'How much worse they are than the rest', markers: ['three|3x|times|nearly half|492|most|far'], why: 'A ranking without a gap does not tell her whether the top one is special or just first.' },
        { key: 'biggest', label: 'That the biggest account was barely touched', markers: ['dunmore|largest|biggest|enterprise'], why: 'The whole point. Left unsaid, the budget goes to the loudest and largest by default.' },
        { key: 'clean', label: 'That two clients had no incidents at all', markers: ['two|2 |none|no incident|untouched|clean|not affected'], why: 'Half a million in revenue that belongs nowhere near this. It also shows you checked.' },
        { key: 'next', label: 'What you are doing next', markers: ['next|then|tomorrow|will|working|severity|ticket'], why: 'She is drafting now. Tell her when the rest lands so she does not guess.' },
      ],
    },
    estHours: 0.5, priority: 'high', dueInDays: 3, day: 2, difficulty: 'hard',
  },


  'ph-115': {
    title: 'Broad damage or deep damage',
    hint: "COUNT(DISTINCT service) says how many different things broke. MAX says how bad the worst single one was. They rank clients differently.",
    brief: "Two clients with four incidents each can have had very different quarters. Write ONE SQL SELECT returning, per client with incidents: how many incidents, how many DISTINCT services were involved, and the worst single incident by rows corrupted. Most services affected first.",
    referenceSql: 'SELECT c.company, COUNT(i.id) AS incidents, COUNT(DISTINCT i.service) AS services_hit, MAX(i.rows_corrupted) AS worst_single FROM clients c JOIN incidents i ON i.client_id = c.id GROUP BY c.company ORDER BY services_hit DESC, incidents DESC',
    datasetKey: 'saas_ops', tool: 'sql', estHours: 0.45, priority: 'medium', dueInDays: 3, day: 2, difficulty: 'hard',
  },

  'ph-120': {
    title: 'Only the clients we still have',
    hint: "One of the names on yesterday's list is not a client any more. Find the filter that removes them.",
    brief: "A goodwill payment can only go to somebody who is still with us. Write ONE SQL SELECT returning every ACTIVE client with at least one incident: company, tier, revenue, status and incident count, biggest client first. Then compare the row count against yesterday's.",
    referenceSql: "SELECT c.company, c.tier, c.mrr, c.status, COUNT(i.id) AS incidents FROM clients c JOIN incidents i ON i.client_id = c.id WHERE c.status = 'active' GROUP BY c.company, c.tier, c.mrr, c.status ORDER BY c.mrr DESC",
    datasetKey: 'saas_ops', tool: 'sql', estHours: 0.4, priority: 'high', dueInDays: 3, day: 3, difficulty: 'medium',
  },

  'ph-121': {
    title: 'The client who already left',
    hint: "They churned. Ask what that means for a compensation list, and what it means for the analysis.",
    brief: "One of the damaged accounts is Lattice Education, and they have already churned. Priya's draft list has them on it. Decide what to do.",
    tool: 'choice', datasetKey: 'saas_ops',
    choice: {
      prompt: 'Tick everything that is defensible.',
      options: [
        { key: 'remove', correct: true, label: 'Take them off the compensation list — you cannot retain a client who has gone', why: 'Goodwill spend is meant to keep accounts. Spending it on one that has left is money with no possible return.' },
        { key: 'flag', correct: true, label: 'But say you removed them, and why', why: 'A name quietly vanishing between two drafts is how a reviewer stops trusting the whole list. An exclusion you explain costs nothing.' },
        { key: 'signal', correct: true, label: 'They are still worth reporting as a warning sign', why: 'A damaged account that then churned is the closest thing here to evidence that outages cost retention. That belongs in the write-up even though they get no payment.' },
        { key: 'keep', correct: false, label: 'Leave them in — they were damaged like everyone else', why: 'They were. They are also not a customer. The table measures damage; the list allocates budget, and those are different jobs.' },
        { key: 'winback', correct: false, label: 'Recommend a win-back offer funded from the goodwill budget', why: 'A different decision, made by different people, from a different budget. Quietly repurposing this one would be noticed.' },
        { key: 'silent', correct: false, label: 'Drop them without comment to keep the note short', why: 'This is the one genuinely dishonest option on the list. Shortness is not worth it.' },
      ],
      skills: { businessLogic: 100, communication: 80 },
    },
    estHours: 0.3, priority: 'high', dueInDays: 4, day: 3, difficulty: 'hard',
  },

  'ph-122': {
    title: 'How long incidents take to resolve',
    hint: "An incident with no resolved_at cannot contribute to an average of resolution times. Decide what that means for your COUNT as well.",
    brief: "Priya wants to rank by severity, so check whether severity behaves the way everyone assumes. Write ONE SQL SELECT returning, per severity: how many incidents you counted and the average hours from start to resolution. Some incidents are still open — an incident with no resolution time cannot be part of an average of resolution times, and your count has to reflect whatever you decide.",
    referenceSql: 'SELECT severity, COUNT(*) AS closed, AVG((julianday(resolved_at) - julianday(started_at)) * 24) AS avg_hours FROM incidents WHERE resolved_at IS NOT NULL GROUP BY severity ORDER BY severity',
    datasetKey: 'saas_ops', tool: 'sql', estHours: 0.6, priority: 'high', dueInDays: 4, day: 3, difficulty: 'hard',
  },

  'ph-123': {
    title: 'What is still open',
    hint: "The mirror of the last filter. Three of these are the worst kind.",
    brief: "The incidents you just excluded are not nothing — they are the ones still hurting. Write ONE SQL SELECT returning, per severity, how many incidents are still unresolved.",
    referenceSql: 'SELECT severity, COUNT(*) AS still_open FROM incidents WHERE resolved_at IS NULL GROUP BY severity ORDER BY severity',
    datasetKey: 'saas_ops', tool: 'sql', estHours: 0.25, priority: 'high', dueInDays: 4, day: 3, difficulty: 'easy',
  },

  'ph-124': {
    title: 'Severity is not damage',
    hint: "Put your two results side by side. The order they imply is not the order anyone expects.",
    brief: "You have resolution times by severity and the open count. Priya wants to pay out by severity because it is simple. Decide what you can actually tell her.",
    tool: 'choice', datasetKey: 'saas_ops',
    choice: {
      prompt: 'Tick everything your own results support.',
      options: [
        { key: 'inverted', correct: true, label: 'SEV3 incidents take longer to resolve on average than SEV2', why: 'About 35 hours against 28. Severity is set when an incident opens and reflects urgency, not how long it drags on — this is the evidence.' },
        { key: 'open', correct: true, label: 'The averages exclude seven unresolved incidents, three of them SEV1', why: 'The worst ones are disproportionately still open, which pulls the SEV1 average DOWN. The number flatters us.' },
        { key: 'proxy', correct: true, label: 'Severity is a weak proxy for damage and rows corrupted is a better one', why: 'You have both measures and they disagree. Saying which you trust, and why, is the actual analysis.' },
        { key: 'sev1', correct: false, label: 'SEV1 incidents are resolved fastest, so the process works', why: 'Read again: SEV1 is the SLOWEST of the three at 44 hours, on only four closed incidents. This is what happens when you skim a table for the answer you expected.' },
        { key: 'four', correct: false, label: 'The SEV1 average is reliable — it is the most serious category', why: 'Four closed incidents. Seriousness does not make a small sample large.' },
        { key: 'payout', correct: false, label: 'Paying out by severity is the fairest approach', why: 'It is the simplest. Your own data says it would rank clients in roughly the wrong order.' },
      ],
      skills: { businessLogic: 100, statistics: 80 },
    },
    estHours: 0.35, priority: 'high', dueInDays: 4, day: 3, difficulty: 'hard',
  },

  'ph-125': {
    title: 'Tell Priya severity will not work',
    hint: "You are taking away her simple method. Do not do that without handing her a better one in the same note.",
    brief: "Priya's draft ranks clients by worst severity because it is easy to explain to the board. You are about to tell her that will send the money to the wrong accounts. Say it in a way she can use. Under 160 words.",
    tool: 'writeup', datasetKey: 'saas_ops',
    writeup: {
      to: 'Priya Nair', subject: 'Severity as a ranking — why it will not hold', maxWords: 160,
      prompt: 'The objection, with the replacement attached to it.',
      rubric: [
        { key: 'finding', label: 'That severity does not track resolution time', markers: ['sev3|sev 3|longer|slower|28|35|invert|not track|does not'], why: 'The concrete fact. Without it this is just an opinion about methodology.' },
        { key: 'open', label: 'That unresolved incidents are missing from the averages', markers: ['open|unresolved|seven|7 |exclud|still'], why: 'Three SEV1s still open flatter the SEV1 number. She will be asked about this.' },
        { key: 'better', label: 'What to rank by instead', markers: ['rows|corrupted|damage|volume|impact'], why: 'Never take away the simple method without offering one. She has a board meeting either way.' },
        { key: 'churn', label: 'That Lattice is off the list, and why', markers: ['lattice|churn|left|no longer|former'], why: 'Flagging the removal now stops it being discovered later as a silent edit.' },
        { key: 'usable', label: 'Something she can act on today', markers: ['recommend|suggest|use|rank|list|propose|I would'], why: 'She is drafting now. A note that ends in a problem rather than a next step costs her a day.' },
      ],
    },
    estHours: 0.55, priority: 'high', dueInDays: 4, day: 3, difficulty: 'hard',
  },

  'ph-130': {
    title: 'Who has been complaining',
    hint: "Tickets are a different signal from incidents. Count both the total and the loud ones.",
    brief: "Damage is one signal; how much noise an account is making is another, and they are not the same. Write ONE SQL SELECT returning, per client, how many support tickets they have raised and how many of those are urgent or high priority. Loudest first.",
    referenceSql: "SELECT c.company, COUNT(t.id) AS tickets, SUM(CASE WHEN t.priority IN ('urgent','high') THEN 1 ELSE 0 END) AS urgent_high FROM clients c JOIN tickets t ON t.client_id = c.id GROUP BY c.company ORDER BY urgent_high DESC, tickets DESC",
    datasetKey: 'saas_ops', tool: 'sql', estHours: 0.45, priority: 'high', dueInDays: 4, day: 4, difficulty: 'medium',
  },

  'ph-131': {
    title: 'Revenue by tier, current clients only',
    hint: "This one IS a today question, so the active filter belongs on it.",
    brief: "The board thinks in tiers, so give them the shape of the book. Write ONE SQL SELECT returning, per tier, how many ACTIVE clients there are and their total monthly revenue, biggest revenue first.",
    referenceSql: "SELECT tier, COUNT(*) AS clients, SUM(mrr) AS mrr FROM clients WHERE status = 'active' GROUP BY tier ORDER BY mrr DESC",
    datasetKey: 'saas_ops', tool: 'sql', estHours: 0.3, priority: 'medium', dueInDays: 4, day: 4, difficulty: 'easy',
  },

  'ph-132': {
    title: 'The loudest client is the smallest one',
    hint: "Cross-reference your ticket table against the damage table and the revenue table. Three orderings, three different answers.",
    brief: "Orchid Pharma has raised more urgent tickets than anyone. They are also one of our smallest accounts and took middling damage. Decide what that means for the compensation list.",
    tool: 'choice', datasetKey: 'saas_ops',
    choice: {
      exhibit: {
        kind: 'chat', from: 'Sneha Joshi',
        body: "Heads up before you finalise anything — Orchid Pharma have been on the phone to me every other day. Their CSM is getting hammered. I am not saying they deserve more than anyone else, I am saying you should know they are the ones making noise.",
      },
      prompt: 'Tick everything that is defensible.',
      options: [
        { key: 'separate', correct: true, label: 'Ticket volume measures how much an account complains, not how much it was harmed', why: 'They are genuinely different signals. Conflating them is how budgets end up allocated by whoever shouts.' },
        { key: 'report', correct: true, label: 'Report it as its own column rather than folding it into the damage ranking', why: 'Priya needs to know who is angry — that is real information for a CSM. It just should not silently reorder a damage list.' },
        { key: 'both', correct: true, label: 'An account that is both damaged AND complaining is the strongest case of all', why: 'Where the two signals agree, the case is unarguable. That is worth surfacing explicitly.' },
        { key: 'top', correct: false, label: 'Put Orchid top of the list — they are clearly the most upset', why: 'Fifteen thousand a month and middling damage. This is exactly the decision the analysis exists to prevent.' },
        { key: 'ignore', correct: false, label: 'Ignore tickets entirely — only measured damage counts', why: 'Equally wrong in the other direction. Sneha has told you something true about an account and throwing it away is not rigour.' },
        { key: 'quiet', correct: false, label: 'Assume the quiet clients are fine', why: 'Harborview took the worst damage in the book. Silence is not evidence of satisfaction, and it is often evidence of an account already halfway out the door.' },
      ],
      skills: { businessLogic: 100, communication: 100 },
    },
    estHours: 0.35, priority: 'high', dueInDays: 5, day: 4, difficulty: 'hard',
  },

  'ph-133': {
    title: 'What is still broken, for everyone',
    hint: "Priya needs a row per client, including the ones with nothing open — so the unresolved condition belongs in the JOIN, not the WHERE. Put it in the WHERE and the clean accounts vanish.",
    brief: "Priya is building the outreach list and needs a line for every account, not just the damaged ones — a CSM with nothing open still has to know that. Write ONE SQL SELECT returning EVERY ACTIVE client with their revenue and how many UNRESOLVED incidents they have, including clients with zero. Most open first, then biggest.",
    referenceSql: "SELECT c.company, c.mrr, COUNT(i.id) AS open_incidents FROM clients c LEFT JOIN incidents i ON i.client_id = c.id AND i.resolved_at IS NULL WHERE c.status = 'active' GROUP BY c.company, c.mrr ORDER BY open_incidents DESC, c.mrr DESC",
    datasetKey: 'saas_ops', tool: 'sql', estHours: 0.55, priority: 'high', dueInDays: 5, day: 4, difficulty: 'hard',
  },

  'ph-134': {
    title: 'What Meera is about to send out',
    hint: "She has written four sentences from your tables. Two of them are not in your tables.",
    brief: "Meera in Comms has drafted the summary that goes to the account teams, using your numbers. It goes out under Data & Analytics, which means it goes out as yours. Read it properly.",
    tool: 'choice', datasetKey: 'saas_ops',
    choice: {
      exhibit: {
        kind: 'email', from: 'Meera Pillai', subject: 'Draft note to the account teams — quick check',
        body: "Ready to send unless you shout:\n\n\"Analysis of the quarter's incidents shows our Enterprise accounts bore the brunt of the disruption. Harborview Bank was the single worst affected, with almost half a million records corrupted. Orchid Pharma raised the most urgent tickets and should be prioritised for outreach. Two clients came through the quarter with no incidents at all.\"",
      },
      prompt: 'Tick every sentence you would tell her to change or cut.',
      options: [
        { key: 'enterprise', correct: true, label: 'The "Enterprise accounts bore the brunt" sentence', why: 'The worst-hit account is Growth tier, and the largest Enterprise account was barely scratched. This is the assumption your whole week disproved, about to go out in your name.' },
        { key: 'orchid', correct: true, label: 'The "Orchid should be prioritised" sentence', why: 'It converts ticket volume into priority for compensation, which is the exact conflation you have just spent a day separating.' },
        { key: 'harborview', correct: false, label: 'The Harborview sentence', why: 'Straight out of your own query, and the strongest true finding in the note. Challenging a correct sentence spends the credibility you need for the two that are wrong.' },
        { key: 'clean', correct: false, label: 'The "two clients had no incidents" sentence', why: 'Also correct, and worth keeping — it tells account teams which conversations they do not need to have.' },
        { key: 'all', correct: false, label: 'Ask her to pull the whole note until Friday', why: 'Two sentences are wrong, not the note. Blocking a communication you could fix in one reply makes you the bottleneck rather than the check.' },
        { key: 'numbers', correct: false, label: 'Ask her to remove the specific figures and keep it qualitative', why: 'The figures are the only part that is checkable. Vagueness is not safer, it just moves the error somewhere nobody can see it.' },
      ],
      skills: { communication: 100, businessLogic: 80 },
    },
    estHours: 0.35, priority: 'high', dueInDays: 5, day: 4, difficulty: 'hard',
  },

  'ph-135': {
    title: 'Chart what is still open',
    hint: "Severity has a natural order — SEV1, SEV2, SEV3. Ask whether that order is worth preserving here.",
    brief: "One slide for the operations review: how many incidents remain unresolved at each severity. These categories do have an inherent order, which changes the sorting decision from the last chart you built.",
    tool: 'chart', datasetKey: 'saas_ops',
    chart: {
      prompt: 'Unresolved incidents by severity.',
      sourceSql: 'SELECT severity, COUNT(*) AS still_open FROM incidents WHERE resolved_at IS NULL GROUP BY severity ORDER BY severity',
      columns: ['severity', 'still_open'],
      correct: { type: 'bar', x: 'severity', y: 'still_open', sort: 'none' },
      whyRight: 'Severity is an ordered scale, so keep its own order — but the values are counts of separate categories, so bars rather than a line.',
      why: {
        type: 'Bars. SEV1 to SEV3 is a scale, not a time series — there is no trend between them to trace, just three counts to compare.',
        x: 'Severity is the category.',
        y: 'The number still unresolved.',
        sort: 'Do not sort by value. SEV1, SEV2, SEV3 is the order the reader already has in their head, and reordering it by count makes the chart harder to read, not easier.',
      },
    },
    estHours: 0.25, priority: 'medium', dueInDays: 5, day: 4, difficulty: 'medium',
  },


  'ph-140': {
    title: 'Damage against what they pay us',
    hint: "A ratio needs both numbers in the same row. Divide, and remember integer division will give you zeros.",
    brief: "Two clients can lose the same number of rows and it means very different things depending on what they pay. Write ONE SQL SELECT returning, for each ACTIVE client with incidents: company, tier, revenue, total rows corrupted, and rows corrupted per rupee of monthly revenue. Biggest client first.",
    referenceSql: "SELECT c.company, c.tier, c.mrr, SUM(i.rows_corrupted) AS rows_corrupted, ROUND(SUM(i.rows_corrupted) * 1.0 / c.mrr, 2) AS rows_per_rupee FROM clients c JOIN incidents i ON i.client_id = c.id WHERE c.status = 'active' GROUP BY c.company, c.tier, c.mrr ORDER BY c.mrr DESC",
    datasetKey: 'saas_ops', tool: 'sql', estHours: 0.6, priority: 'high', dueInDays: 5, day: 5, difficulty: 'hard',
  },

  'ph-141': {
    title: 'Cost of the outage per client, in Python',
    // Deliberately flagged for rework: Priya accepts it and then wants it a different way.
    rework: true,
    hint: "Group the incidents by client yourself, then take the middle value as well as the mean — they will not agree and that is the point.",
    brief: "Priya wants a single headline figure for the damage per affected client. The mean is dragged around by one enormous account. In the notebook, compute across ACTIVE clients that had incidents: the mean rows corrupted, the median rows corrupted, and how many clients that covers. Assign a dict with keys mean_rows, median_rows and clients to `result`.",
    tool: 'python', datasetKey: 'saas_ops',
    estHours: 0.6, priority: 'high', dueInDays: 5, day: 5, difficulty: 'hard',
    referenceCompute: (tables) => {
      const active = new Set(tables.clients.filter((c) => c.status === 'active').map((c) => c.id));
      const by = new Map();
      for (const i of tables.incidents) {
        if (!active.has(i.client_id)) continue;
        by.set(i.client_id, (by.get(i.client_id) || 0) + i.rows_corrupted);
      }
      const totals = [...by.values()].sort((a, b) => a - b);
      const m = Math.floor(totals.length / 2);
      const median = totals.length % 2 ? totals[m] : (totals[m - 1] + totals[m]) / 2;
      const mean = totals.reduce((a, b) => a + b, 0) / totals.length;
      return { mean_rows: Math.round(mean), median_rows: median, clients: totals.length };
    },
  },

  'ph-142': {
    title: 'The budget does not cover everyone',
    hint: "Thirteen damaged accounts, a budget that stretches to a handful. Decide what principle you are allocating on, and be able to say it in one sentence.",
    brief: "Vikram confirms the goodwill budget will cover about four or five accounts meaningfully, not thirteen. Decide how you would allocate it.",
    tool: 'choice', datasetKey: 'saas_ops',
    choice: {
      exhibit: {
        kind: 'email', from: 'Vikram Nair', subject: 'Budget reality',
        body: "The number I have got signed off will do something meaningful for four, maybe five accounts. Spread across thirteen it is a gesture nobody will notice.\n\nSo it is a prioritisation, not a distribution. Tell me who and tell me why, and make the why something I can repeat in a board meeting.",
      },
      prompt: 'Tick every basis you could defend in that room.',
      options: [
        { key: 'damage', correct: true, label: 'Rank by measured damage, and fund the top of that list', why: 'It is the measure most directly connected to the thing being compensated, and it is checkable by anyone who asks.' },
        { key: 'risk', correct: true, label: 'Weight toward accounts where damage is large relative to what they pay', why: 'A hundred thousand rows matters more to a fifteen-thousand-a-month account than to a four-hundred-thousand one. This is the ratio you just computed, doing real work.' },
        { key: 'open', correct: true, label: 'Prioritise accounts still living with an unresolved incident', why: 'Compensation for a problem that is fixed is an apology. For one that is ongoing it is a retention move, which is what the budget is actually for.' },
        { key: 'equal', correct: false, label: 'Split it evenly across all thirteen affected accounts', why: 'Vikram has just told you that produces a gesture nobody notices. Even-handedness that achieves nothing is not fairness.' },
        { key: 'mrr', correct: false, label: 'Allocate in proportion to what each account pays us', why: 'That sends the most money to Dunmore, who lost seven thousand rows. Your own table says it is the wrong answer.' },
        { key: 'loud', correct: false, label: 'Start with the accounts raising the most tickets', why: 'It rewards volume of complaint. It is also indefensible in the room the moment somebody asks how the list was built.' },
      ],
      skills: { businessLogic: 100, communication: 100 },
    },
    estHours: 0.35, priority: 'high', dueInDays: 5, day: 5, difficulty: 'hard',
  },

  'ph-143': {
    title: 'The damage by tier',
    hint: "SUM(DISTINCT mrr) avoids counting an account's revenue once per incident. Check your total against the book.",
    brief: "The board reads by tier, so give them that cut. Write ONE SQL SELECT returning, per tier: how many distinct ACTIVE clients were hit, the total rows corrupted, and the total monthly revenue of those clients. Most revenue at risk first.",
    referenceSql: "SELECT c.tier, COUNT(DISTINCT c.id) AS clients_hit, SUM(i.rows_corrupted) AS rows_corrupted, SUM(DISTINCT c.mrr) AS mrr_at_risk FROM clients c JOIN incidents i ON i.client_id = c.id WHERE c.status = 'active' GROUP BY c.tier ORDER BY mrr_at_risk DESC",
    datasetKey: 'saas_ops', tool: 'sql', estHours: 0.55, priority: 'high', dueInDays: 5, day: 5, difficulty: 'hard',
  },

  'ph-144': {
    title: 'Vikram pushes back in the corridor',
    hint: "He is not asking you to change the ranking. He is asking you to say something about the future that you have not measured.",
    brief: "Ten minutes before the meeting, Vikram asks the question he will be asked. Tick every response you can stand behind.",
    tool: 'choice', datasetKey: 'saas_ops',
    choice: {
      exhibit: {
        kind: 'chat', from: 'Vikram Nair',
        body: "One thing and then I will leave you alone. If we do nothing for these accounts, how many of them churn? The board will ask me that number and I would rather not invent one.",
      },
      prompt: 'Which responses are honest and useful to him?',
      options: [
        { key: 'cannot', correct: true, label: '"I cannot give you a churn number — we have one churned account in the whole book"', why: 'One data point. Any churn model built on it would be a guess wearing a percentage sign, and he would repeat it as fact.' },
        { key: 'lattice', correct: true, label: '"What I can tell you is that the one account we did lose had three incidents"', why: 'True, specific, and the strongest thing the data will carry on this question. It is suggestive without pretending to be predictive.' },
        { key: 'offer', correct: true, label: '"If you want a churn number, that needs history we do not hold — I can scope what it would take"', why: 'Turns a no into a next step, which is what a stakeholder can actually use in a meeting.' },
        { key: 'guess', correct: false, label: '"Probably two or three."', why: 'Invented. He specifically said he did not want to invent one, and a number from you carries far more weight than a number from him.' },
        { key: 'pct', correct: false, label: '"About 8% — that is one in thirteen, based on our churn rate"', why: 'A rate computed from a single event, presented to three significant figures. This is the most dangerous option here because it sounds the most rigorous.' },
        { key: 'all', correct: false, label: '"All of them are at risk if we do nothing."', why: 'Unmeasured, unfalsifiable, and it would win you the budget by scaring people. That works exactly once.' },
      ],
      skills: { communication: 100, businessLogic: 100, statistics: 60 },
    },
    estHours: 0.35, priority: 'high', dueInDays: 5, day: 5, difficulty: 'hard',
  },

  'ph-145': {
    title: 'The recommendation, to Customer Success',
    hint: "Who, why, and what you are not claiming. In that order, and the third part is what makes the first two believable.",
    brief: "The deliverable the week has been for. Priya will take this list into the budget conversation and be asked to defend it without you in the room.",
    tool: 'writeup', datasetKey: 'saas_ops',
    writeup: {
      to: 'Priya Nair and Vikram Nair', subject: 'Outage compensation — who, and why', maxWords: 200,
      prompt: 'The recommendation. A short list, the principle behind it, and the limits of it.',
      rubric: [
        { key: 'who', label: 'Named accounts, not a method', markers: ['harborview|ionic|cobalt|keystone|orchid|juniper|pinehill|ferrous'], why: 'She needs a list. A note that describes how to build one has left her the job.' },
        { key: 'basis', label: 'The principle you ranked on', markers: ['rows|corrupted|damage|relative|per rupee|proportion|open|unresolved'], why: 'This is the sentence Vikram repeats in the board meeting. It has to survive being said out loud.' },
        { key: 'not', label: 'That it is deliberately not ranked by account size', markers: ['not|rather than|instead of|mrr|revenue|biggest|largest|size'], why: 'Saying what you did NOT rank on is what stops someone quietly re-sorting the list afterwards.' },
        { key: 'excluded', label: 'That the churned account was removed', markers: ['lattice|churn|left|former|excluded|removed'], why: 'An exclusion you explain is diligence; one that is discovered is a credibility problem.' },
        { key: 'limit', label: 'One thing this does not tell them', markers: ['churn|cannot|can\'t|does not|doesn\'t|predict|severity|no data|one account'], why: 'Volunteering the limit before the board finds it is what makes the rest credible.' },
        { key: 'scope', label: 'Which incidents are in scope', markers: ['all incident|quarter|billing.sync|any|scope|whole'], why: 'You made a scope decision on Monday. The reader has to know which question this answers.' },
      ],
    },
    estHours: 0.7, priority: 'high', dueInDays: 5, day: 5, difficulty: 'hard',
  },


  // ---- Project 4: Pay Equity Audit --------------------------------------------------
  //
  // An audit where the headline finding is that there is nothing to find, which almost no
  // training material ever covers and every auditor meets in their first year. The week:
  //
  //   Monday    what equity means here, and how small our role populations are
  //   Tuesday   spread within role — and eleven of eighteen roles are big enough to look at
  //   Wednesday the wobble: nobody is outside their band. The deliverable is empty.
  //   Thursday  compression — every Staff Engineer out-earns every Engineering Manager
  //   Friday    the report, under pressure to have found something
  //
  // Every figure measured against the dataset. The pressure running through it is the one
  // an auditor actually feels: an empty finding reads as a wasted week unless you can say
  // precisely what you looked for and did not find.

  'pe-101': {
    title: 'What are we actually auditing for',
    hint: "Three different things get called pay equity. Neha's note tells you which one she means if you read it carefully.",
    brief: "Neha has asked for a pay equity audit. That phrase means at least three different things, and doing the wrong one carefully is worse than doing the right one roughly.",
    tool: 'choice', datasetKey: 'hr_core',
    choice: {
      exhibit: {
        kind: 'email', from: 'Neha Kulkarni', subject: 'Pay equity audit — before the comp cycle',
        body: "We are going into the comp cycle in six weeks and I would rather find problems now than have them found for us.\n\nWhat I want to know is whether people doing the same job here are paid consistently, and whether anyone has drifted somewhere they should not be. I am not asking about market rates — we do not have that data and I know it.\n\nWhatever you find, I need to be able to defend the method.",
      },
      prompt: 'Tick everything that follows from what she has asked.',
      options: [
        { key: 'internal', correct: true, label: 'This is internal consistency — same job, same pay — not market benchmarking', why: 'She has explicitly ruled market rates out and told you why. Doing it anyway would answer a question nobody asked with data we do not have.' },
        { key: 'bands', correct: true, label: 'Drift outside the agreed salary bands is in scope', why: '"Drifted somewhere they should not be" is the band question. We hold band_low and band_high, so it is answerable.' },
        { key: 'method', correct: true, label: 'The method matters as much as the finding', why: 'She has to defend it in a comp cycle. An audit whose method cannot be explained is worth nothing regardless of what it found.' },
        { key: 'gender', correct: false, label: 'Break the analysis down by gender and ethnicity', why: 'That is a legitimate and important audit, and this dataset holds neither field. Producing it would mean inventing the inputs.' },
        { key: 'market', correct: false, label: 'Compare our salaries against industry benchmarks', why: 'She ruled it out in the second paragraph. Ignoring an explicit exclusion is how an analyst gets a reputation for not reading the brief.' },
        { key: 'perf', correct: false, label: 'Adjust for individual performance before comparing', why: 'We hold no performance data. Adjusting for something you cannot measure is a way of making any result you like.' },
      ],
      skills: { businessLogic: 100, communication: 80 },
    },
    estHours: 0.25, priority: 'high', dueInDays: 1, day: 1, difficulty: 'medium',
  },

  'pe-102': {
    title: 'How many roles are we comparing within',
    hint: "Two counts in one row. COUNT(DISTINCT role) is the one that decides how much this audit can say.",
    brief: "An audit that compares within roles is limited by how many people share a role. Write ONE SQL SELECT returning, in a single row: how many distinct roles there are among CURRENT staff, and how many current staff there are.",
    referenceSql: 'SELECT COUNT(DISTINCT role) AS roles, COUNT(*) AS people FROM employees WHERE exit_year IS NULL',
    datasetKey: 'hr_core', tool: 'sql', estHours: 0.25, priority: 'high', dueInDays: 1, day: 1, difficulty: 'easy',
  },

  'pe-103': {
    title: 'How many people share each role',
    hint: "Look at the bottom of this list before you plan the rest of the week.",
    brief: "Now the distribution. Write ONE SQL SELECT returning each role held by CURRENT staff and how many people hold it, most people first. The shape of this result decides what the audit can and cannot conclude.",
    referenceSql: 'SELECT role, COUNT(*) AS people FROM employees WHERE exit_year IS NULL GROUP BY role ORDER BY people DESC',
    datasetKey: 'hr_core', tool: 'sql', estHours: 0.3, priority: 'high', dueInDays: 1, day: 1, difficulty: 'easy',
  },

  'pe-104': {
    title: 'Which roles can be audited at all',
    hint: "HAVING filters groups after they are formed. Pick a floor and be ready to defend it.",
    brief: "You cannot say anything about consistency within a role held by one person. Write ONE SQL SELECT returning each role with AT LEAST THREE current holders: the role, how many people, the lowest and highest salary, and the gap between them. Widest gap first.",
    referenceSql: 'SELECT role, COUNT(*) AS people, MIN(salary) AS lowest, MAX(salary) AS highest, MAX(salary) - MIN(salary) AS spread FROM employees WHERE exit_year IS NULL GROUP BY role HAVING COUNT(*) >= 3 ORDER BY spread DESC',
    datasetKey: 'hr_core', tool: 'sql', estHours: 0.45, priority: 'high', dueInDays: 2, day: 1, difficulty: 'medium',
  },

  'pe-105': {
    title: 'What the coverage means for the audit',
    hint: "Count how many roles survived the floor, and how many people those roles cover. Both numbers matter and they say different things.",
    brief: "You have eighteen roles and a floor of three holders. Work out what your audit can actually claim before you spend four more days on it.",
    tool: 'choice', datasetKey: 'hr_core',
    choice: {
      prompt: 'Tick everything your own results support.',
      options: [
        { key: 'eleven', correct: true, label: 'Eleven of the eighteen roles have enough holders to compare within', why: 'Seven do not. Any statement about those roles is a statement about one or two individuals.' },
        { key: 'most', correct: true, label: 'Those eleven roles still cover most of the company', why: 'The excluded roles are small by definition, so excluding them costs far less coverage than the count of roles suggests. Worth saying — it is what makes the audit useful rather than partial.' },
        { key: 'declare', correct: true, label: 'The floor has to be stated in the report', why: 'A threshold you chose and did not disclose is the first thing a reviewer finds and the last time they trust the rest.' },
        { key: 'nothing', correct: false, label: 'With seven roles excluded the audit cannot conclude anything', why: 'Too pessimistic and it abandons the job. Partial coverage, clearly stated, is a normal audit outcome.' },
        { key: 'lower', correct: false, label: 'Lower the floor to two so more roles are covered', why: 'A "spread" between two people is the difference between two individuals. Widening coverage by weakening the meaning of the finding is not a trade worth making.' },
        { key: 'dept', correct: false, label: 'Compare across departments instead, since roles are too small', why: 'Different question. A Support Agent and a Staff Engineer are not doing the same job, so a departmental comparison cannot answer "same job, same pay".' },
      ],
      skills: { businessLogic: 100, statistics: 80 },
    },
    estHours: 0.3, priority: 'high', dueInDays: 2, day: 1, difficulty: 'hard',
  },

  'pe-106': {
    title: 'Tell Neha what the audit will cover',
    hint: "She has to defend the method. Give her the floor, the coverage it buys, and what falls outside it.",
    brief: "Write back at the end of day one with the scope. She said she needs to defend the method — this note is that method, in the form she will quote it. Under 140 words.",
    tool: 'writeup', datasetKey: 'hr_core',
    writeup: {
      to: 'Neha Kulkarni', subject: 'Pay equity audit — scope and method', maxWords: 140,
      prompt: 'The method, stated so she can defend it without you.',
      rubric: [
        { key: 'question', label: 'What you are auditing for', markers: ['same role|within role|consisten|internal|band|drift'], why: 'Name the question. Three things are called pay equity and she needs the report to say which one this is.' },
        { key: 'floor', label: 'The minimum role size you are using', markers: ['three|3 |floor|threshold|at least|minimum'], why: 'The number she will be asked about. Volunteering it is what makes it a method rather than a choice you hid.' },
        { key: 'coverage', label: 'How many roles that covers', markers: ['eleven|11|seven|7 |eighteen|18|most|majority'], why: 'Coverage turns a threshold from an exclusion into a stated limit.' },
        { key: 'out', label: 'What is explicitly out of scope', markers: ['market|benchmark|gender|performance|not|outside|cannot'], why: 'She ruled market data out; saying so back confirms you read it and stops it being raised later.' },
        { key: 'when', label: 'When it lands', markers: ['friday|by|end of|day'], why: 'Six weeks to the comp cycle. A date stops her chasing.' },
      ],
    },
    estHours: 0.45, priority: 'high', dueInDays: 2, day: 1, difficulty: 'medium',
  },

  'pe-110': {
    title: 'The widest gap in the company',
    hint: "You already have the spread. Now express it as a share, because a gap in rupees means nothing without the salary it sits on.",
    brief: "A gap of two lakh means something different on a nine-lakh salary than on a twenty-six-lakh one. Write ONE SQL SELECT returning, for roles with at least three current holders: the role, the count, the lowest salary, and the gap as a PERCENTAGE of the lowest. Widest percentage first.",
    referenceSql: 'SELECT role, COUNT(*) AS people, MIN(salary) AS lowest, ROUND((MAX(salary) - MIN(salary)) * 100.0 / MIN(salary), 1) AS spread_pct FROM employees WHERE exit_year IS NULL GROUP BY role HAVING COUNT(*) >= 3 ORDER BY spread_pct DESC',
    datasetKey: 'hr_core', tool: 'sql', estHours: 0.5, priority: 'high', dueInDays: 2, day: 2, difficulty: 'hard',
  },

  'pe-111': {
    title: 'Is a twelve percent spread a problem',
    hint: "There is no threshold in the data. Whatever you decide, the report has to say who decided it and on what basis.",
    brief: "Your widest role spread is about twelve percent. Neha will ask whether that is acceptable. Decide what you can honestly say.",
    tool: 'choice', datasetKey: 'hr_core',
    choice: {
      prompt: 'Tick everything that is defensible.',
      options: [
        { key: 'nothreshold', correct: true, label: 'The data contains no standard for what an acceptable spread is', why: 'Nothing in the dataset says twelve percent is fine or alarming. Pretending otherwise would be inventing a benchmark and attributing it to the analysis.' },
        { key: 'explain', correct: true, label: 'Tenure and hiring year are plausible explanations you can actually check', why: 'Both are in the table. An unexplained spread and a spread explained by time served are very different findings.' },
        { key: 'report', correct: true, label: 'Report the number and let People Ops set the threshold', why: 'Where the line sits is a policy decision owned by Neha. Measuring is yours; deciding is hers, and being clear about that boundary is most of what makes an audit trusted.' },
        { key: 'fine', correct: false, label: 'Twelve percent is normal, so report no issue', why: '"Normal" according to what? You would be importing a standard from outside the analysis and presenting it as a finding.' },
        { key: 'alarm', correct: false, label: 'Twelve percent is a serious inequity and should be flagged as such', why: 'Equally unfounded in the other direction, and far more expensive — it starts a remediation conversation on the strength of an adjective.' },
        { key: 'hide', correct: false, label: 'Leave the number out and describe the spread qualitatively', why: 'The number is the only checkable thing you have. Replacing it with a word makes the report shorter and useless.' },
      ],
      skills: { businessLogic: 100, communication: 80 },
    },
    estHours: 0.3, priority: 'high', dueInDays: 3, day: 2, difficulty: 'hard',
  },

  'pe-112': {
    title: 'Does tenure explain the spread',
    hint: "Group by role AND hire year. Look at the cell counts before you read anything into the averages.",
    brief: "If the people paid more have been here longer, the spread has an innocent explanation. Write ONE SQL SELECT returning, for CURRENT staff in roles with at least three holders: the role, the hire year, how many people, and the average salary. Role, then year.",
    referenceSql: 'SELECT role, hire_year, COUNT(*) AS people, AVG(salary) AS avg_salary FROM employees WHERE exit_year IS NULL AND role IN (SELECT role FROM employees WHERE exit_year IS NULL GROUP BY role HAVING COUNT(*) >= 3) GROUP BY role, hire_year ORDER BY role, hire_year',
    datasetKey: 'hr_core', tool: 'sql', estHours: 0.6, priority: 'high', dueInDays: 3, day: 2, difficulty: 'hard',
  },

  'pe-113': {
    title: 'Chart the spread by role',
    hint: "Roles have no order of their own. Give them one that lets the reader rank them.",
    brief: "One slide showing the pay spread as a percentage, per role, for the roles big enough to audit. Roles are categories rather than a sequence, which decides the chart type and the ordering.",
    tool: 'chart', datasetKey: 'hr_core',
    chart: {
      prompt: 'Pay spread as a percentage of the lowest salary, by role.',
      sourceSql: 'SELECT role, ROUND((MAX(salary) - MIN(salary)) * 100.0 / MIN(salary), 1) AS spread_pct FROM employees WHERE exit_year IS NULL GROUP BY role HAVING COUNT(*) >= 3 ORDER BY spread_pct DESC',
      columns: ['role', 'spread_pct'],
      correct: { type: 'bar', x: 'role', y: 'spread_pct', sort: 'desc' },
      whyRight: 'Unordered categories compared by size: bars, sorted widest first so the roles needing attention are at the top.',
      why: {
        type: 'Roles are categories, not a sequence. A line between Senior Engineer and Recruiter would imply a progression that does not exist.',
        x: 'The role is the category being compared.',
        y: 'Spread as a percentage is the measured value.',
        sort: 'Nothing orders roles for you, so sorting by size puts the ones that need a conversation where the reader looks first.',
      },
    },
    estHours: 0.25, priority: 'medium', dueInDays: 3, day: 2, difficulty: 'medium',
  },

  'pe-114': {
    title: 'The roles you cannot audit',
    hint: "The mirror of Monday's filter. Name them, because a reader will ask which ones fell out.",
    brief: "Your report has to say what it did not cover. Write ONE SQL SELECT returning each role with FEWER THAN THREE current holders and how many people hold it, smallest first.",
    referenceSql: 'SELECT role, COUNT(*) AS people FROM employees WHERE exit_year IS NULL GROUP BY role HAVING COUNT(*) < 3 ORDER BY people ASC, role',
    datasetKey: 'hr_core', tool: 'sql', estHours: 0.3, priority: 'medium', dueInDays: 3, day: 2, difficulty: 'medium',
  },

  'pe-115': {
    title: 'Send Neha the spread picture',
    hint: "Give her the widest role, the number, and the fact that you have not yet found anyone out of band.",
    brief: "Mid-week note. She is planning the comp cycle and wants to know whether to expect a big remediation bill. Under 150 words.",
    tool: 'writeup', datasetKey: 'hr_core',
    writeup: {
      to: 'Neha Kulkarni', subject: 'Spread within roles — where we are', maxWords: 150,
      prompt: 'The spread picture, with the threshold question handed back to her.',
      rubric: [
        { key: 'widest', label: 'The widest spread and which role it is in', markers: ['senior engineer|software engineer|widest|twelve|12|11|%'], why: 'The concrete headline. Everything else is context for it.' },
        { key: 'pct', label: 'Expressed as a share, not just rupees', markers: ['%|percent|per cent|share|relative|of the'], why: 'Two lakh on nine lakh and two lakh on twenty-six lakh are different findings.' },
        { key: 'threshold', label: 'That where the acceptable line sits is her call', markers: ['your|you|policy|people ops|decide|threshold|standard|not for me|no standard'], why: 'Measuring is yours, deciding is hers. Being explicit about that boundary is what makes an audit trusted rather than resented.' },
        { key: 'tenure', label: 'Whether tenure explains it', markers: ['tenure|hire year|year|longer|time|explain|cell|few'], why: 'The obvious innocent explanation, and the cells are too thin to lean on. Say so before she assumes it.' },
        { key: 'coverage', label: 'The roles outside the audit', markers: ['seven|7 |fewer|small|excluded|not covered|one or two'], why: 'Repeating the limit mid-week stops it being a surprise on Friday.' },
      ],
    },
    estHours: 0.5, priority: 'high', dueInDays: 3, day: 2, difficulty: 'hard',
  },


  'pe-120': {
    title: 'Anyone paid outside their band',
    // Deliberately returns nothing. An empty result is a finding, and an auditor who
    // cannot report one convincingly will eventually invent something instead.
    expectEmpty: true,
    hint: "Run it and trust the result. If it comes back empty, that is an answer — check your query once, then believe it.",
    brief: "The headline check of the whole audit. Write ONE SQL SELECT returning every CURRENT employee whose salary falls OUTSIDE their department's agreed band — below band_low or above band_high — with their name, department, role, salary and both band edges. Highest salary first.",
    referenceSql: 'SELECT e.name, d.name AS department, e.role, e.salary, d.band_low, d.band_high FROM employees e JOIN departments d ON d.id = e.department_id WHERE e.exit_year IS NULL AND (e.salary < d.band_low OR e.salary > d.band_high) ORDER BY e.salary DESC',
    datasetKey: 'hr_core', tool: 'sql', estHours: 0.45, priority: 'high', dueInDays: 3, day: 3, difficulty: 'medium',
  },

  'pe-121': {
    title: 'Your audit found nothing',
    hint: "An empty result is not a failed query. Work out what it entitles you to say, and what it does not.",
    brief: "The band check came back with no rows at all. Nobody in the company is paid outside their band. Neha is expecting findings and you have an empty table. Decide what that actually means.",
    tool: 'choice', datasetKey: 'hr_core',
    choice: {
      prompt: 'Tick everything that is defensible.',
      options: [
        { key: 'finding', correct: true, label: 'An empty result IS the finding, and a good one', why: 'Nobody outside band is exactly what an audit hopes to establish. Reporting it as a result rather than as an absence of results is the whole skill here.' },
        { key: 'verify', correct: true, label: 'Verify it before reporting — run a query you know returns rows', why: 'An empty result and a broken query look identical. Proving the join and the filter work on a case you can predict is ten minutes that protects the entire report.' },
        { key: 'limits', correct: true, label: 'Say what "within band" does and does not guarantee', why: 'Our bands are wide. Sitting inside one says nothing about where in it you sit, which is the finding that IS there.' },
        { key: 'wider', correct: false, label: 'Widen the test until something fails, so there is something to report', why: 'Choosing a threshold because it produces findings is the definition of a rigged audit. It is also very easy to spot afterwards.' },
        { key: 'nothing', correct: false, label: 'Report that the audit found nothing of note', why: '"Nothing of note" throws away a positive assurance that took a week to earn, and invites the question of why anyone bothered.' },
        { key: 'broken', correct: false, label: 'Assume the query is wrong and keep rewriting it', why: 'Reasonable for ten minutes, corrosive after an hour. At some point you have to accept a result that disagrees with what you expected.' },
      ],
      skills: { businessLogic: 100, communication: 100 },
    },
    estHours: 0.35, priority: 'high', dueInDays: 4, day: 3, difficulty: 'hard',
  },

  'pe-122': {
    title: 'Prove the check actually works',
    hint: "Same join, same band arithmetic, a threshold you know will catch people. If this returns rows, the empty result was real.",
    brief: "Before you report an empty finding, prove the machinery works. Write ONE SQL SELECT returning every CURRENT employee sitting in the BOTTOM QUARTER of their department's band: name, department, role, salary, both band edges, and their position in the band as a percentage. Lowest position first.",
    referenceSql: 'SELECT e.name, d.name AS department, e.role, e.salary, d.band_low, d.band_high, ROUND((e.salary - d.band_low) * 100.0 / (d.band_high - d.band_low)) AS band_pct FROM employees e JOIN departments d ON d.id = e.department_id WHERE e.exit_year IS NULL AND (e.salary - d.band_low) * 100.0 / (d.band_high - d.band_low) < 25 ORDER BY band_pct',
    datasetKey: 'hr_core', tool: 'sql', estHours: 0.6, priority: 'high', dueInDays: 4, day: 3, difficulty: 'hard',
  },

  'pe-123': {
    title: 'Where each department sits in its band',
    hint: "Average the position, not the salary. A department can be entirely in band and still sit at the bottom of it.",
    brief: "The real finding is not who is outside the band but where inside it people sit. Write ONE SQL SELECT returning, per department: how many current staff, and their average position within the band as a percentage. Lowest first.",
    referenceSql: 'SELECT d.name AS department, COUNT(*) AS people, ROUND(AVG((e.salary - d.band_low) * 100.0 / (d.band_high - d.band_low))) AS avg_band_pct FROM employees e JOIN departments d ON d.id = e.department_id WHERE e.exit_year IS NULL GROUP BY d.name ORDER BY avg_band_pct',
    datasetKey: 'hr_core', tool: 'sql', estHours: 0.55, priority: 'high', dueInDays: 4, day: 3, difficulty: 'hard',
  },

  'pe-124': {
    title: 'What the band positions tell you',
    hint: "Compare the bottom two departments against the rest, and check how many people each one is.",
    brief: "You have every department's average position in its band. This is the finding the empty band check could not give you. Decide what it supports.",
    tool: 'choice', datasetKey: 'hr_core',
    choice: {
      prompt: 'Tick everything your own result supports.',
      options: [
        { key: 'spread', correct: true, label: 'Departments sit at very different heights within their own bands', why: 'Thirty-seven percent at the bottom against sixty-six at the top. Everyone is compliant and the experience of being paid here is not remotely uniform.' },
        { key: 'compliant', correct: true, label: 'Every one of those departments is fully within band', why: 'Which is precisely why the band check found nothing. The two results together are the story: compliant, and unequal.' },
        { key: 'sizes', correct: true, label: 'The two lowest cover nineteen people between them, so this is not a rounding artefact', why: 'Nine and ten. Large enough that the gap is about how those functions are paid, not about one or two individuals.' },
        { key: 'breach', correct: false, label: 'Marketing being at thirty-seven percent is a band breach', why: 'It is the bottom third of a band they are entirely inside. Calling compliance a breach would be the single fastest way to lose the room.' },
        { key: 'underpaid', correct: false, label: 'Those departments are underpaid relative to the market', why: 'You have no market data — Neha ruled it out on Monday. Against our own bands is the only claim available.' },
        { key: 'fix', correct: false, label: 'Recommend lifting everyone to the band midpoint', why: 'A costed recommendation nobody asked for, on a policy decision that is not yours. Measure, then let People Ops decide where the line goes.' },
      ],
      skills: { businessLogic: 100, communication: 80 },
    },
    estHours: 0.35, priority: 'high', dueInDays: 4, day: 3, difficulty: 'hard',
  },

  'pe-125': {
    title: 'Report an empty finding without sounding empty-handed',
    hint: "Lead with the assurance, not with the absence. Then give her the thing you did find.",
    brief: "Tell Neha that nobody is out of band. This is the hardest note of the week: a true, valuable, week-long result that reads like you found nothing unless you write it properly. Under 160 words.",
    tool: 'writeup', datasetKey: 'hr_core',
    writeup: {
      to: 'Neha Kulkarni', subject: 'Band compliance — the result', maxWords: 160,
      prompt: 'The empty finding, framed as the assurance it is, with the real finding attached.',
      rubric: [
        { key: 'assurance', label: 'Nobody is outside their band — stated as a result', markers: ['no one|nobody|none|every|all|within band|inside|compliant|zero'], why: 'Lead with it. Written as an absence it reads as a wasted week; written as an assurance it is the thing she wanted to be able to say.' },
        { key: 'verified', label: 'That you verified the check rather than trusting an empty table',
          markers: ['verif|check|confirm|tested|proved|sense.check|ran|bottom quarter|control'],
          why: 'An empty result and a broken query look identical. Saying you proved the machinery works is what turns "no rows" into "no exceptions".' },
        { key: 'position', label: 'The real finding — where departments sit inside their bands', markers: ['37|thirty.seven|66|sixty.six|marketing|support|bottom|position|within|lower'], why: 'Compliant and unequal. This is the finding the band check could not produce and it is the one worth acting on.' },
        { key: 'limit', label: 'What being in band does not guarantee', markers: ['wide|does not|doesn.t|not mean|only|still|says nothing|guarantee'], why: 'Our bands are wide enough to contain the whole disparity. Saying so stops "all compliant" being read as "all fine".' },
        { key: 'hers', label: 'That the threshold decision is hers', markers: ['your|you|policy|decide|people ops|not for me|judgement'], why: 'Measuring is yours; setting the acceptable line is hers. Keeping that boundary clean is what makes the audit usable.' },
      ],
    },
    estHours: 0.6, priority: 'high', dueInDays: 4, day: 3, difficulty: 'hard',
  },

  'pe-130': {
    title: 'Managers against their own people',
    hint: "Two conditional MAXes in one pass. LIKE '%Manager%' is crude and it is enough here.",
    brief: "Pay compression is when the people below start catching the people above. Write ONE SQL SELECT returning, per department: the highest-paid manager's salary and the highest-paid non-manager's salary among CURRENT staff. Department order.",
    referenceSql: "SELECT d.name AS department, MAX(CASE WHEN e.role LIKE '%Manager%' THEN e.salary END) AS top_manager, MAX(CASE WHEN e.role NOT LIKE '%Manager%' THEN e.salary END) AS top_ic FROM employees e JOIN departments d ON d.id = e.department_id WHERE e.exit_year IS NULL GROUP BY d.name ORDER BY d.name",
    datasetKey: 'hr_core', tool: 'sql', estHours: 0.55, priority: 'high', dueInDays: 4, day: 4, difficulty: 'hard',
  },

  'pe-131': {
    title: 'The Engineering ladder, rung by rung',
    hint: "One department, grouped by role. Read the top two rows carefully.",
    brief: "One department stands out. Write ONE SQL SELECT returning, for CURRENT Engineering staff only: each role, how many hold it, and the lowest and highest salary in it. Highest-paid role first.",
    referenceSql: "SELECT e.role, COUNT(*) AS people, MIN(e.salary) AS lowest, MAX(e.salary) AS highest FROM employees e JOIN departments d ON d.id = e.department_id WHERE e.exit_year IS NULL AND d.name = 'Engineering' GROUP BY e.role ORDER BY highest DESC",
    datasetKey: 'hr_core', tool: 'sql', estHours: 0.45, priority: 'high', dueInDays: 5, day: 4, difficulty: 'medium',
  },

  'pe-132': {
    title: 'Is compression a problem',
    hint: "Check whether it is one person or the whole rung. That difference decides whether it is an anomaly or a structure.",
    brief: "Every Staff Engineer out-earns every Engineering Manager. Decide what to say about it — and notice this is a case where the obvious alarmed reaction is wrong.",
    tool: 'choice', datasetKey: 'hr_core',
    choice: {
      prompt: 'Tick everything that is defensible.',
      options: [
        { key: 'structural', correct: true, label: 'It is the whole rung, not one individual — so it is a structure, not an anomaly', why: 'Both Staff Engineers sit above all three Engineering Managers. A single overlap is a case; a clean separation is a design.' },
        { key: 'deliberate', correct: true, label: 'It may well be deliberate, and the data cannot tell you', why: 'Plenty of engineering organisations pay senior ICs above line managers on purpose. Reporting it as a fault would assume an intention nobody has stated.' },
        { key: 'report', correct: true, label: 'Report it as an observation and ask whether it is intended', why: 'The right register for a finding you cannot interpret. It gets the fact in front of the person who knows the answer.' },
        { key: 'error', correct: false, label: 'Flag it as a pay error requiring correction', why: 'You do not know that. Recommending someone\'s pay be corrected on the strength of a role title comparison is a serious thing to be wrong about.' },
        { key: 'ignore', correct: false, label: 'Leave it out — managers and ICs are different jobs, so the comparison is meaningless', why: 'The comparison is standard and Neha would expect it. Omitting an awkward finding because it is hard to interpret is the failure mode this whole audit exists to avoid.' },
        { key: 'title', correct: false, label: 'Recommend renaming the Staff Engineer role to resolve it', why: 'Changing a label to make a number look different is the worst option on the list, and somebody will suggest it.' },
      ],
      skills: { businessLogic: 100, communication: 100 },
    },
    estHours: 0.35, priority: 'high', dueInDays: 5, day: 4, difficulty: 'hard',
  },

  'pe-133': {
    title: 'Chart where departments sit in band',
    hint: "Departments are categories. Sorting them by value is what lets a reader see the gap at a glance.",
    brief: "One slide for the comp cycle: average band position per department. This is the finding the audit actually has, so the chart has to make the gap obvious without a caption.",
    tool: 'chart', datasetKey: 'hr_core',
    chart: {
      prompt: 'Average position within the salary band, by department.',
      sourceSql: 'SELECT d.name AS department, ROUND(AVG((e.salary - d.band_low) * 100.0 / (d.band_high - d.band_low))) AS avg_band_pct FROM employees e JOIN departments d ON d.id = e.department_id WHERE e.exit_year IS NULL GROUP BY d.name ORDER BY avg_band_pct',
      columns: ['department', 'avg_band_pct'],
      correct: { type: 'bar', x: 'department', y: 'avg_band_pct', sort: 'asc' },
      whyRight: 'Categories compared by size, sorted so the departments sitting lowest — the ones the comp cycle has to decide about — come first.',
      why: {
        type: 'Departments are categories, not a sequence, so bars rather than a line.',
        x: 'The department is the category.',
        y: 'Average position in band, as a percentage.',
        sort: 'Ascending, because the finding is who sits at the BOTTOM. Sorting descending would bury the point under the departments that are fine.',
      },
    },
    estHours: 0.25, priority: 'medium', dueInDays: 5, day: 4, difficulty: 'medium',
  },

  'pe-134': {
    title: 'What it would cost to lift the bottom',
    hint: "The cost per person is the target minus what they earn now. Sum it per department.",
    brief: "Neha will ask what remediation costs before she asks whether to do it. Write ONE SQL SELECT returning, per department: how many CURRENT staff sit below a quarter of the way up their band, and what it would cost in total to lift each of them to that quarter mark. Most expensive first.",
    referenceSql: 'SELECT d.name AS department, COUNT(*) AS people, SUM(d.band_low + (d.band_high - d.band_low) * 0.25 - e.salary) AS cost_to_lift FROM employees e JOIN departments d ON d.id = e.department_id WHERE e.exit_year IS NULL AND (e.salary - d.band_low) * 100.0 / (d.band_high - d.band_low) < 25 GROUP BY d.name ORDER BY cost_to_lift DESC',
    datasetKey: 'hr_core', tool: 'sql', estHours: 0.65, priority: 'high', dueInDays: 5, day: 4, difficulty: 'hard',
  },

  'pe-135': {
    title: 'What Meera has written about your audit',
    hint: "Three sentences. One is the opposite of what you found.",
    brief: "Meera is drafting the People Ops newsletter item about the audit. It goes out under your analysis. Read it properly.",
    tool: 'choice', datasetKey: 'hr_core',
    choice: {
      exhibit: {
        kind: 'email', from: 'Meera Pillai', subject: 'Newsletter item on the pay audit — OK to send?',
        body: "Short piece for the People Ops update:\n\n\"An independent review of pay across the company found no employees paid outside their agreed salary bands. The review did identify that some departments sit lower within their bands than others, and People Ops will consider this in the coming compensation cycle. No pay inequities were found.\"",
      },
      prompt: 'Tick every sentence you would change or cut.',
      options: [
        { key: 'noineq', correct: true, label: 'The "no pay inequities were found" sentence', why: 'It contradicts the sentence before it. Thirty-seven percent against sixty-six is a disparity — compliant with the bands and not equitable, which is the entire point of the audit.' },
        { key: 'independent', correct: true, label: 'Calling it an "independent review"', why: 'It was done in-house by an analyst reporting to the person commissioning it. That is fine and normal; calling it independent is a claim that would not survive scrutiny.' },
        { key: 'noout', correct: false, label: 'The "no employees outside their bands" sentence', why: 'True, verified, and the assurance the audit exists to provide. Keep it.' },
        { key: 'consider', correct: false, label: 'The "People Ops will consider this" sentence', why: 'Accurate about who owns the decision, which is exactly the boundary you have kept all week.' },
        { key: 'numbers', correct: false, label: 'Ask her to add the specific percentages', why: 'A staff newsletter naming which department is paid lowest would land badly with the people in it. The detail belongs in the report, not the broadcast.' },
        { key: 'pull', correct: false, label: 'Ask her to hold the whole item until after the comp cycle', why: 'Two sentences need fixing. Blocking a communication you could correct in one reply makes you the obstacle rather than the check.' },
      ],
      skills: { communication: 100, businessLogic: 100 },
    },
    estHours: 0.35, priority: 'high', dueInDays: 5, day: 4, difficulty: 'hard',
  },


  'pe-140': {
    title: 'How far the average sits below the top',
    hint: "MAX minus AVG, per role. It answers a different question from MAX minus MIN and Neha will want both.",
    brief: "A spread tells you the range; this tells you whether most people sit near the top or are dragged along behind one high earner. Write ONE SQL SELECT returning, for roles with at least three CURRENT holders: the role, the count, the average salary, and the gap between the highest and the average. Biggest gap first.",
    referenceSql: 'SELECT role, COUNT(*) AS people, AVG(salary) AS avg_salary, MAX(salary) - AVG(salary) AS gap_to_top FROM employees WHERE exit_year IS NULL GROUP BY role HAVING COUNT(*) >= 3 ORDER BY gap_to_top DESC',
    datasetKey: 'hr_core', tool: 'sql', estHours: 0.5, priority: 'high', dueInDays: 5, day: 5, difficulty: 'hard',
  },

  'pe-141': {
    title: 'Median against mean, by role, in Python',
    // Flagged for rework: Neha accepts it and then wants it a different way.
    rework: true,
    hint: "SQLite has no median. Group the salaries by role yourself, sort each group, take the middle — and handle the even-length case.",
    brief: "Every figure in this audit so far has been a mean, and a mean on seven people moves when one of them is unusual. In the notebook, compute for each role with at least three CURRENT holders: the mean salary, the median salary, and the headcount. Sort by the difference between mean and median, largest first. Assign a list of dicts with keys role, mean_salary, median_salary and people to `result`.",
    tool: 'python', datasetKey: 'hr_core',
    estHours: 0.7, priority: 'high', dueInDays: 5, day: 5, difficulty: 'hard',
    referenceCompute: (tables) => {
      const by = new Map();
      for (const e of tables.employees) {
        if (e.exit_year != null) continue;
        if (!by.has(e.role)) by.set(e.role, []);
        by.get(e.role).push(e.salary);
      }
      const median = (xs) => {
        const a = [...xs].sort((p, q) => p - q);
        const m = Math.floor(a.length / 2);
        return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
      };
      return [...by.entries()]
        .filter(([, v]) => v.length >= 3)
        .map(([role, v]) => ({
          role,
          mean_salary: v.reduce((a, b) => a + b, 0) / v.length,
          median_salary: median(v),
          people: v.length,
        }))
        .sort((a, b) => Math.abs(b.mean_salary - b.median_salary) - Math.abs(a.mean_salary - a.median_salary));
    },
  },

  'pe-142': {
    title: 'What the audit is entitled to conclude',
    hint: "Separate the things you measured from the things you would like to be true.",
    brief: "Before you write the report, fix exactly what this week established. Neha will quote whatever you write, so the boundary between measured and inferred has to be exact.",
    tool: 'choice', datasetKey: 'hr_core',
    choice: {
      prompt: 'Tick everything the audit can actually claim.',
      options: [
        { key: 'inband', correct: true, label: 'No current employee is paid outside their department\'s agreed band', why: 'Measured, verified against a control query, and the assurance the audit was commissioned to provide.' },
        { key: 'position', correct: true, label: 'Departments sit at materially different heights within their bands', why: 'Thirty-seven percent against sixty-six, on nine and sixteen people. Measured and large.' },
        { key: 'compression', correct: true, label: 'In Engineering, every Staff Engineer out-earns every Engineering Manager', why: 'A clean structural separation, not a single overlap. Reportable as an observation without claiming it is wrong.' },
        { key: 'fair', correct: false, label: 'Pay at this company is fair', why: 'Fairness is a judgement about whether the differences are justified. You measured the differences; nothing in the data speaks to whether they are deserved.' },
        { key: 'nogap', correct: false, label: 'There are no pay inequities', why: 'Contradicted by your own band-position finding. This is the exact sentence in Meera\'s draft that you asked her to cut.' },
        { key: 'market', correct: false, label: 'Our salaries are competitive', why: 'Requires market data that was ruled out on Monday. It is also the claim people most want the audit to make, which is why it has to be refused explicitly.' },
      ],
      skills: { businessLogic: 100, communication: 100 },
    },
    estHours: 0.35, priority: 'high', dueInDays: 5, day: 5, difficulty: 'hard',
  },

  'pe-143': {
    title: 'Who is furthest below their own role average',
    hint: "A correlated subquery gets each person's role average onto their own row.",
    brief: "The last piece: individuals, not departments. Write ONE SQL SELECT returning each CURRENT employee whose salary is BELOW the average for their own role — name, role, salary, the role average, and the gap. Biggest gap first. Restrict to roles with at least three holders.",
    referenceSql: 'SELECT e.name, e.role, e.salary, (SELECT AVG(x.salary) FROM employees x WHERE x.role = e.role AND x.exit_year IS NULL) AS role_avg, (SELECT AVG(x.salary) FROM employees x WHERE x.role = e.role AND x.exit_year IS NULL) - e.salary AS below_by FROM employees e WHERE e.exit_year IS NULL AND e.role IN (SELECT role FROM employees WHERE exit_year IS NULL GROUP BY role HAVING COUNT(*) >= 3) AND e.salary < (SELECT AVG(x.salary) FROM employees x WHERE x.role = e.role AND x.exit_year IS NULL) ORDER BY below_by DESC',
    datasetKey: 'hr_core', tool: 'sql', estHours: 0.75, priority: 'high', dueInDays: 5, day: 5, difficulty: 'hard',
  },

  'pe-144': {
    title: 'Neha wants a headline',
    hint: "She is not asking you to soften the finding. She is asking for a sentence, and the honest one has two halves.",
    brief: "An hour before her comp-cycle prep, Neha asks for the line. Tick every response you can stand behind.",
    tool: 'choice', datasetKey: 'hr_core',
    choice: {
      exhibit: {
        kind: 'email', from: 'Neha Kulkarni', subject: 'One line for the comp cycle',
        body: "I have the full report and I have read it. What I need now is the sentence I open with.\n\nIf the honest answer is that we are fine, say that — I will take good news. If it is not, I would rather know today than in the meeting.",
      },
      prompt: 'Which openings are honest and useful?',
      options: [
        { key: 'both', correct: true, label: '"Everyone is inside their band, and two departments sit near the bottom of theirs"', why: 'Both halves, in one sentence. The assurance she can give, and the thing she has to decide about.' },
        { key: 'compliant', correct: true, label: '"No band breaches — the question for the comp cycle is where inside the bands people sit"', why: 'Same content, framed as the decision she actually owns. Hands her the agenda rather than a verdict.' },
        { key: 'cost', correct: true, label: '"Nobody is out of band; lifting the fifteen lowest to a quarter of band would cost about eight lakh"', why: 'Assurance plus a costed option. She is going into a budget conversation and this is the number she will be asked for.' },
        { key: 'fine', correct: false, label: '"We are fine — no issues found."', why: 'She offered to take good news, which is exactly when it is tempting. Your own band-position finding contradicts it, and she would be repeating it in a room where somebody has the same data.' },
        { key: 'serious', correct: false, label: '"We have a serious pay equity problem."', why: 'Unfounded in the other direction. Everyone is compliant; "serious problem" is an adjective the data does not support and would start an expensive conversation.' },
        { key: 'more', correct: false, label: '"I would need market data before I could say anything."', why: 'You measured plenty without it. Refusing to summarise a week of real findings because one dimension was out of scope wastes the work.' },
      ],
      skills: { communication: 100, businessLogic: 100 },
    },
    estHours: 0.35, priority: 'high', dueInDays: 5, day: 5, difficulty: 'hard',
  },

  'pe-145': {
    title: 'The audit report',
    hint: "Assurance first, then the finding, then the cost, then the limits. The limits are what make the rest believable.",
    brief: "The deliverable. It goes into the comp cycle pack and Neha will defend the method without you in the room, so the method has to be in the document.",
    tool: 'writeup', datasetKey: 'hr_core',
    writeup: {
      to: 'Neha Kulkarni and the compensation review', subject: 'Pay equity audit — findings', maxWords: 220,
      prompt: 'The report. What you checked, what you found, what it would cost, and what you did not look at.',
      rubric: [
        { key: 'assurance', label: 'Nobody is outside their band', markers: ['no one|nobody|none|all|every|within|inside|compliant|zero|no breach'], why: 'The assurance the audit was commissioned for. It leads.' },
        { key: 'finding', label: 'The band-position disparity', markers: ['37|thirty.seven|66|sixty.six|marketing|support|bottom|position|lower|within their band'], why: 'Compliant and unequal. The finding the band check could not produce.' },
        { key: 'method', label: 'The method — the role-size floor and the coverage it gives', markers: ['three|3 |floor|threshold|eleven|11|seven|7 |minimum|at least'], why: 'She has to defend this. A threshold that appears only in your head is the first thing a reviewer finds.' },
        { key: 'compression', label: 'The Engineering compression, as an observation not a fault', markers: ['staff engineer|compression|manager|out.earn|above|engineering'], why: 'Raise it, do not rule on it. You cannot tell from the data whether it is deliberate.' },
        { key: 'cost', label: 'What remediation would cost', markers: ['cost|lakh|\\d|lift|remediat|eight|805|quarter'], why: 'She is going into a budget conversation. A finding without a price is a problem rather than a decision.' },
        { key: 'limits', label: 'What the audit did NOT cover', markers: ['market|benchmark|gender|performance|not|outside|did not|cannot'], why: 'Volunteering the boundary before someone finds it is what makes everything inside it credible.' },
      ],
    },
    estHours: 0.8, priority: 'high', dueInDays: 5, day: 5, difficulty: 'hard',
  },

  // ---- Senior track -----------------------------------------------------------------
  // The user was explicit that junior and senior differ by PROJECT, not by the same
  // brief written vaguer. So these are different questions, not harder wording: they
  // ask for a rate rather than a total, make the learner decide what to exclude, and
  // end with a recommendation the data does not hand them.
  'sb-130': {
    title: 'What each signing year is worth now',
    hint: "Group by the year they signed. Watch the client counts — some years are one account.",
    brief: "If small accounts grow into large ones, the Starter question answers itself. Write ONE SQL SELECT returning, per signing year across ACTIVE clients: how many clients, their total revenue, and the average. Oldest year first.",
    referenceSql: "SELECT c.signed_year, COUNT(*) AS clients, SUM(c.mrr) AS mrr, ROUND(AVG(c.mrr)) AS avg_mrr FROM clients c WHERE c.status = 'active' GROUP BY c.signed_year ORDER BY c.signed_year",
    datasetKey: 'saas_ops', tool: 'sql', estHours: 0.45, priority: 'high', dueInDays: 4, day: 4, difficulty: 'medium',
  },

  'sb-131': {
    title: 'How the CSM load is distributed',
    hint: "Group by the CSM. Read the result and then decide whether there is anything to report.",
    brief: "Customer Success wants to know whether any CSM is carrying an unfair share. Write ONE SQL SELECT returning, per CSM across ACTIVE clients: how many accounts they hold and the total revenue on them. Most accounts first, then most revenue.",
    referenceSql: "SELECT csm_name, COUNT(*) AS accounts, SUM(mrr) AS mrr FROM clients WHERE status = 'active' GROUP BY csm_name ORDER BY accounts DESC, mrr DESC",
    datasetKey: 'saas_ops', tool: 'sql', estHours: 0.4, priority: 'medium', dueInDays: 4, day: 4, difficulty: 'medium',
  },

  'sb-132': {
    title: 'Reporting that there is nothing to report',
    hint: "Fifteen CSMs, fifteen accounts. Count how many accounts each one holds before deciding what to say.",
    brief: "The CSM load query came back with every CSM holding exactly one account. Priya is expecting a finding about workload balance. Decide what to tell her.",
    tool: 'choice', datasetKey: 'saas_ops',
    choice: {
      prompt: 'Tick everything that is defensible.',
      options: [
        { key: 'uniform', correct: true, label: 'Account load is perfectly uniform — one each — so there is no imbalance to find', why: 'A real answer to the question asked. It is not a failed analysis, it is a negative result and it took one query to establish.' },
        { key: 'revenue', correct: true, label: 'Revenue per CSM is not uniform, and that is the question worth asking instead', why: 'One account at 386,000 and one at 15,000 are very different jobs. The count hides a spread the question was really reaching for.' },
        { key: 'quick', correct: true, label: 'Say it in one line and move on', why: 'A non-finding deserves a sentence, not a section. Spending a page proving nothing is happening is how a report loses the reader before the real findings.' },
        { key: 'fail', correct: false, label: 'Report that the analysis was inconclusive', why: 'It was entirely conclusive. "Inconclusive" describes a failure to establish something, not a clean finding of no difference.' },
        { key: 'drop', correct: false, label: 'Leave it out — nothing interesting came back', why: 'She asked. Silently dropping a question a stakeholder raised means she asks again, or assumes you found something awkward.' },
        { key: 'stretch', correct: false, label: 'Break it down by tier and tenure until a difference appears', why: 'Slicing until something looks significant is how false findings are manufactured, and with fifteen accounts every slice is one or two people.' },
      ],
      skills: { businessLogic: 100, communication: 100 },
    },
    estHours: 0.3, priority: 'medium', dueInDays: 5, day: 4, difficulty: 'medium',
  },

  'sb-133': {
    title: 'Chart the concentration',
    hint: "Fifteen accounts, one measure. Sorted, so the reader can see how fast it falls away.",
    brief: "One slide showing each active account's share of total revenue. The point is how quickly it drops after the top few, so the ordering does all the work.",
    tool: 'chart', datasetKey: 'saas_ops',
    chart: {
      prompt: 'Each active account as a share of total revenue.',
      sourceSql: "SELECT company, ROUND(mrr * 100.0 / (SELECT SUM(mrr) FROM clients WHERE status = 'active'), 1) AS pct_of_book FROM clients WHERE status = 'active' ORDER BY pct_of_book DESC",
      columns: ['company', 'pct_of_book'],
      correct: { type: 'bar', x: 'company', y: 'pct_of_book', sort: 'desc' },
      whyRight: 'Categories compared by size, sorted descending so the concentration in the top few accounts is visible without reading a single label.',
      why: {
        type: 'Companies are categories. Bars compare them; a line would suggest a sequence between unrelated accounts.',
        x: 'The company is the category.',
        y: 'Share of total revenue, as a percentage.',
        sort: 'Descending. The shape of the fall-off IS the finding — unsorted, the concentration is invisible.',
      },
    },
    estHours: 0.25, priority: 'medium', dueInDays: 5, day: 4, difficulty: 'medium',
  },

  'sb-134': {
    title: 'The Starter tier, account by account',
    hint: "Five rows. Look at how much of the tier's load sits on one of them.",
    brief: "Your recommendation is about a tier, so look at the accounts inside it individually. Write ONE SQL SELECT returning each ACTIVE Starter client: company, revenue, ticket count, incident count, and tickets per hundred thousand of revenue. Heaviest load per rupee first.",
    referenceSql: "SELECT c.company, c.mrr, (SELECT COUNT(*) FROM tickets t WHERE t.client_id = c.id) AS tickets, (SELECT COUNT(*) FROM incidents i WHERE i.client_id = c.id) AS incidents, ROUND((SELECT COUNT(*) FROM tickets t WHERE t.client_id = c.id) * 100000.0 / c.mrr, 2) AS tickets_per_100k FROM clients c WHERE c.status = 'active' AND c.tier = 'Starter' ORDER BY tickets_per_100k DESC",
    datasetKey: 'saas_ops', tool: 'sql', estHours: 0.7, priority: 'high', dueInDays: 5, day: 4, difficulty: 'hard',
  },

  'sb-135': {
    title: 'What Finance has written from your numbers',
    hint: "Three sentences. One converts your proxy into rupees, which you never did.",
    brief: "Diya has drafted the summary for the pricing review using your analysis. It carries your name as the source. Read it properly.",
    tool: 'choice', datasetKey: 'saas_ops',
    choice: {
      exhibit: {
        kind: 'email', from: 'Diya Chandra', subject: 'Draft for the pricing review — check before I circulate',
        body: "Here is what I have:\n\n\"Analysis shows Starter accounts generate a support burden comparable to Enterprise accounts while contributing 5% of revenue. At an estimated 4,000 per ticket, the Starter tier costs us roughly 92,000 a month to serve against 114,000 of revenue. Support load per account is flat across all three tiers. We recommend closing the Starter tier at renewal.\"",
      },
      prompt: 'Tick every sentence you would change or cut.',
      options: [
        { key: 'cost', correct: true, label: 'The "estimated 4,000 per ticket" costing', why: 'That number is hers, not yours, and it converts a relative proxy into an absolute rupee claim — the exact thing you said on Monday the analysis could not do.' },
        { key: 'recommend', correct: true, label: 'The recommendation to close the tier', why: 'Five accounts, no view of what they grow into, and no churn or win-back cost. Your analysis supports a pricing question, not a closure decision.' },
        { key: 'five', correct: true, label: 'The "5% of revenue" figure', why: 'Starter is 114,000 of 2,073,000 — about 5.5%, and it was 99,000 in the version you first sent. Worth checking which number she used before it is circulated.' },
        { key: 'flat', correct: false, label: 'The "support load per account is flat" sentence', why: 'Measured, correct, and the strongest finding in the week. Keep it.' },
        { key: 'burden', correct: false, label: 'The "comparable support burden" sentence', why: 'Also supported — 4.6 tickets against 5.0. It is the sentence the whole review turns on.' },
        { key: 'all', correct: false, label: 'Ask her to remove all the figures and describe it qualitatively', why: 'The figures are the only checkable part. Two claims need fixing, not the existence of numbers.' },
      ],
      skills: { communication: 100, businessLogic: 100 },
    },
    estHours: 0.4, priority: 'high', dueInDays: 5, day: 4, difficulty: 'hard',
  },

  'sb-140': {
    title: 'What the book looks like without Starter',
    hint: "Compare the totals with and without the tier, in one row.",
    brief: "Before recommending anything, size what would actually be lost. Write ONE SQL SELECT returning, in a single row: total active revenue, total active clients, revenue excluding Starter, clients excluding Starter, and the percentage of revenue Starter represents.",
    referenceSql: "SELECT SUM(mrr) AS total_mrr, COUNT(*) AS total_clients, SUM(CASE WHEN tier != 'Starter' THEN mrr ELSE 0 END) AS mrr_without_starter, SUM(CASE WHEN tier != 'Starter' THEN 1 ELSE 0 END) AS clients_without_starter, ROUND(SUM(CASE WHEN tier = 'Starter' THEN mrr ELSE 0 END) * 100.0 / SUM(mrr), 1) AS starter_pct FROM clients WHERE status = 'active'",
    datasetKey: 'saas_ops', tool: 'sql', estHours: 0.6, priority: 'high', dueInDays: 5, day: 5, difficulty: 'hard',
  },

  'sb-141': {
    title: 'Load per account, mean against median, in Python',
    // Flagged for rework: Diya accepts it and then wants it a different way.
    rework: true,
    hint: "Group the ticket counts by tier yourself, then take both the mean and the middle value. One tier will disagree with itself.",
    brief: "Every tier figure this week has been a mean over four to six accounts, and one Starter account is twice as heavy as any other. In the notebook, compute for each tier across ACTIVE clients: the mean tickets per account, the median tickets per account, and the number of accounts. Sort by median descending. Assign a list of dicts with keys tier, mean_tickets, median_tickets and clients to `result`.",
    tool: 'python', datasetKey: 'saas_ops',
    estHours: 0.75, priority: 'high', dueInDays: 5, day: 5, difficulty: 'hard',
    referenceCompute: (tables) => {
      const active = tables.clients.filter((c) => c.status === 'active');
      const counts = new Map();
      for (const t of tables.tickets) counts.set(t.client_id, (counts.get(t.client_id) || 0) + 1);
      const by = new Map();
      for (const c of active) {
        if (!by.has(c.tier)) by.set(c.tier, []);
        by.get(c.tier).push(counts.get(c.id) || 0);
      }
      const median = (xs) => {
        const a = [...xs].sort((p, q) => p - q);
        const m = Math.floor(a.length / 2);
        return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
      };
      return [...by.entries()]
        .map(([tier, v]) => ({
          tier,
          mean_tickets: Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 100) / 100,
          median_tickets: median(v),
          clients: v.length,
        }))
        .sort((a, b) => b.median_tickets - a.median_tickets);
    },
  },

  'sb-142': {
    title: 'What to actually recommend about Starter',
    hint: "Closing a tier and repricing a tier are different decisions with different evidence requirements. Work out which one you have evidence for.",
    brief: "Diya wants a recommendation. Decide what your week actually supports — and notice that the dramatic option is the one it does not.",
    tool: 'choice', datasetKey: 'saas_ops',
    choice: {
      prompt: 'Tick every recommendation you could defend.',
      options: [
        { key: 'reprice', correct: true, label: 'Reprice the tier — the ratio is defensible evidence about price, not about existence', why: 'You have measured load against revenue. That is directly a pricing input, and repricing is reversible in a way that closure is not.' },
        { key: 'selfserve', correct: true, label: 'Reduce the support entitlement at Starter rather than the account count', why: 'It acts on the side you actually measured. If the cost is contact volume, changing what Starter includes addresses it without losing the accounts.' },
        { key: 'watch', correct: true, label: 'Name the one heavy account and handle it separately from the tier', why: 'Orchid Pharma is roughly double the next per rupee. A single-account problem does not need a tier-wide policy.' },
        { key: 'close', correct: false, label: 'Close the tier at renewal', why: 'Five accounts, no data on what they grow into, no churn or acquisition cost, and it is irreversible. The evidence is about pricing and the decision would be about strategy.' },
        { key: 'nothing', correct: false, label: 'Recommend nothing — the sample is too small to act on', why: 'A thirteenfold revenue gap against flat support load is a real signal. Refusing to recommend anything wastes a genuine finding.' },
        { key: 'raise', correct: false, label: 'Raise Starter prices to match the Enterprise revenue-per-ticket ratio', why: 'That would be roughly a fourteenfold increase. Following a ratio to its arithmetic conclusion without asking whether anyone would pay it is not a recommendation.' },
      ],
      skills: { businessLogic: 100, communication: 100 },
    },
    estHours: 0.4, priority: 'high', dueInDays: 5, day: 5, difficulty: 'hard',
  },

  'sb-143': {
    title: 'Which accounts would a price rise reach',
    hint: "Starter accounts with above-median load. Five rows in, fewer out.",
    brief: "A repricing lands on specific customers, so name them. Write ONE SQL SELECT returning each ACTIVE Starter client whose tickets per hundred thousand of revenue is ABOVE the Starter average, with their revenue, tickets and that ratio. Heaviest first.",
    referenceSql: "SELECT c.company, c.mrr, (SELECT COUNT(*) FROM tickets t WHERE t.client_id = c.id) AS tickets, ROUND((SELECT COUNT(*) FROM tickets t WHERE t.client_id = c.id) * 100000.0 / c.mrr, 2) AS tickets_per_100k FROM clients c WHERE c.status = 'active' AND c.tier = 'Starter' AND (SELECT COUNT(*) FROM tickets t WHERE t.client_id = c.id) * 100000.0 / c.mrr > (SELECT AVG((SELECT COUNT(*) FROM tickets t2 WHERE t2.client_id = x.id) * 100000.0 / x.mrr) FROM clients x WHERE x.status = 'active' AND x.tier = 'Starter') ORDER BY tickets_per_100k DESC",
    datasetKey: 'saas_ops', tool: 'sql', estHours: 0.85, priority: 'high', dueInDays: 5, day: 5, difficulty: 'hard',
  },

  'sb-144': {
    title: 'Diya wants the closure recommendation',
    hint: "She is asking you to sign off a strategic decision on pricing evidence. Work out what you can give her instead.",
    brief: "An hour before the pricing review, Diya pushes for the stronger version. Tick every response you can stand behind.",
    tool: 'choice', datasetKey: 'saas_ops',
    choice: {
      exhibit: {
        kind: 'email', from: 'Diya Chandra', subject: 'Can we just say close it?',
        body: "The numbers are stark and everybody in that room already believes Starter is a drag. If your analysis says close it, we close it and we save ourselves a year of arguing.\n\nDoes it say that?",
      },
      prompt: 'Which responses are honest and useful?',
      options: [
        { key: 'no', correct: true, label: '"It says the pricing is wrong. It does not say the tier should not exist."', why: 'Precise about what was measured. One sentence, and it draws the line exactly where the evidence does.' },
        { key: 'missing', correct: true, label: '"Closure needs what Starter accounts become — and I have no data on that"', why: 'Names the specific gap rather than being vague about rigour. If Starter accounts become Growth accounts, closure destroys the pipeline.' },
        { key: 'offer', correct: true, label: '"I can give you a repricing case today that is fully supported"', why: 'Turns a refusal into a deliverable. She gets something for the room and nobody has overstated anything.' },
        { key: 'yes', correct: false, label: '"Yes — the ratio is overwhelming."', why: 'A fourteenfold ratio is overwhelming evidence about price. It is not evidence about strategy, and the room will not preserve that distinction once you have blurred it.' },
        { key: 'room', correct: false, label: '"If the room already believes it, my analysis supports the direction."', why: 'Analysis that agrees with the prevailing view because it is the prevailing view is worth nothing — and this is the exact moment that happens.' },
        { key: 'silent', correct: false, label: 'Give her the numbers and let her draw the conclusion', why: 'She will draw the one she already has, and it will be attributed to you. Declining to interpret your own work is not neutrality here.' },
      ],
      skills: { communication: 100, businessLogic: 100 },
    },
    estHours: 0.4, priority: 'high', dueInDays: 5, day: 5, difficulty: 'hard',
  },

  'sb-145': {
    title: 'The account economics review',
    hint: "The proxy first, then the finding, then what you are and are not recommending.",
    brief: "The deliverable. It goes into the pricing review and Diya will defend the method without you, so the proxy and its limits have to be in the document rather than in your head.",
    tool: 'writeup', datasetKey: 'saas_ops',
    writeup: {
      to: 'Diya Chandra and the pricing review', subject: 'Account economics — findings and recommendation', maxWords: 220,
      prompt: 'The proxy, the finding, the recommendation, and the decision you are explicitly not making.',
      rubric: [
        { key: 'proxy', label: 'That cost is proxied by support volume', markers: ['proxy|ticket|incident|volume|no cost|not a cost|stand.in'], why: 'The load-bearing assumption. It goes first, not in a footnote, because everything after it depends on it.' },
        { key: 'finding', label: 'Flat support load against thirteenfold revenue variation', markers: ['flat|similar|same|4\\.6|5|per account', 'thirteen|13|14|310|23|times|gap'], why: 'The finding of the week, and the sentence that shapes the pricing decision.' },
        { key: 'recommend', label: 'A recommendation about pricing', markers: ['repric|price|entitlement|support|tier|recommend|propose|adjust'], why: 'She needs something to take into the room. A finding with no recommendation gets one supplied by somebody else.' },
        { key: 'not', label: 'That you are NOT recommending closure, and why', markers: ['not|closure|close|do not|cannot|strategy|grow|become|churn|pipeline'], why: 'The distinction the whole week turns on. Left out, it is the conclusion the room will reach anyway.' },
        { key: 'sample', label: 'That the tier is five accounts and one is unusually heavy', markers: ['five|5 |orchid|one account|single|outlier|heavier|double'], why: 'A tier-wide recommendation resting on five accounts has to say so before somebody else notices.' },
        { key: 'correction', label: 'The corrected Starter revenue figure', markers: ['114|correct'], why: 'You sent a wrong number on Tuesday. The final document is where the right one has to appear.' },
      ],
    },
    estHours: 0.85, priority: 'high', dueInDays: 5, day: 5, difficulty: 'hard',
  },

  // ---- Senior project 1: Platform Reliability Review, days 2-5 ----------------------
  //
  // Senior questions, not harder junior ones: rates rather than totals, the learner
  // decides what to exclude, and the recommendation is not in the data. The spine:
  //
  //   Tuesday   three measures of "worst service" that name three different services
  //   Wednesday the wobble: the fastest-looking service is fastest because its hard
  //             incidents are still open. MTTR on closed incidents is survivorship bias.
  //   Thursday  blast radius and backlog -- and the client with the biggest backlog had
  //             no incidents at all
  //   Friday    where a quarter of engineering effort should go, which the data will not
  //             tell you
  //
  // Every figure measured. api-gateway costs 326 hours; billing-sync's 62-hour average is
  // one closed incident; auth-service has three of seven still open.

  'sa-020': {
    title: 'What the outages actually cost in engineering time',
    hint: "SUM and AVG over the same group answer different questions. One is a budget, the other is an experience.",
    brief: "Arjun plans engineering effort in weeks, not incidents. Write ONE SQL SELECT returning, per service: how many CLOSED incidents, the total hours spent on them, and the average hours per incident. Most total hours first. Open incidents have no resolution time, so they cannot be part of either figure.",
    referenceSql: 'SELECT service, COUNT(*) AS closed, ROUND(SUM((julianday(resolved_at) - julianday(started_at)) * 24), 1) AS total_hours, ROUND(AVG((julianday(resolved_at) - julianday(started_at)) * 24), 1) AS avg_hours FROM incidents WHERE resolved_at IS NOT NULL GROUP BY service ORDER BY total_hours DESC',
    datasetKey: 'saas_ops', tool: 'sql', estHours: 0.6, priority: 'high', dueInDays: 2, day: 2, difficulty: 'hard',
  },

  'sa-021': {
    title: 'Three measures, three different answers',
    hint: "Line up frequency, average duration and total hours. Then check how many incidents each average is built on.",
    brief: "You now have three ways to say which service is worst, and they name three different services. Work out what that means before anyone sees a ranking.",
    tool: 'choice', datasetKey: 'saas_ops',
    choice: {
      prompt: 'Tick everything your own results support.',
      options: [
        { key: 'differ', correct: true, label: 'Frequency, average duration and total time each name a different service', why: 'report-builder breaks most often, billing-sync takes longest per incident, api-gateway consumes the most engineering time overall. The disagreement is the finding.' },
        { key: 'sample', correct: true, label: "billing-sync's average rests on a single closed incident", why: 'Three incidents, two still open, one closed. A 62-hour average from one data point is a fact about that incident, not about the service.' },
        { key: 'question', correct: true, label: 'Which measure is right depends on the decision being made', why: 'Reducing customer disruption points at frequency. Freeing engineering capacity points at total hours. Nobody can pick for you without knowing which one Arjun is buying.' },
        { key: 'worst', correct: false, label: 'One service is objectively the worst', why: 'Three measures, three answers. Asserting one ranking as the truth hides the choice you quietly made to get there.' },
        { key: 'avg', correct: false, label: 'Average hours per incident is the fairest measure', why: 'It is the one most distorted by small samples here, and it is the measure that makes the service with two unresolved incidents look worst on the strength of one.' },
        { key: 'combine', correct: false, label: 'Combine the three into a single reliability score', why: 'A composite whose weights you chose, presented as one number, is the fastest way to make an arbitrary decision look objective.' },
      ],
      skills: { businessLogic: 100, statistics: 100 },
    },
    estHours: 0.4, priority: 'high', dueInDays: 3, day: 2, difficulty: 'hard',
  },

  'sa-022': {
    title: 'How much of each service is unfinished',
    hint: "Count open and closed in the same pass. The service with the fewest incidents has the worst ratio.",
    brief: "An average of closed incidents says nothing about the ones still running. Write ONE SQL SELECT returning, per service: total incidents, how many are still open, and how many are closed. Most still open first.",
    referenceSql: 'SELECT service, COUNT(*) AS incidents, SUM(CASE WHEN resolved_at IS NULL THEN 1 ELSE 0 END) AS still_open, COUNT(*) - SUM(CASE WHEN resolved_at IS NULL THEN 1 ELSE 0 END) AS closed FROM incidents GROUP BY service ORDER BY still_open DESC, incidents DESC',
    datasetKey: 'saas_ops', tool: 'sql', estHours: 0.5, priority: 'high', dueInDays: 3, day: 2, difficulty: 'medium',
  },

  'sa-023': {
    title: 'The share still open, by service',
    hint: "A count of open incidents favours the service with most incidents. A share does not.",
    brief: "Two open incidents out of three is a different problem from two out of twenty. Write ONE SQL SELECT returning, per service, the PERCENTAGE of its incidents still unresolved and how many incidents that is over. Worst share first.",
    referenceSql: 'SELECT service, ROUND(SUM(CASE WHEN resolved_at IS NULL THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 1) AS pct_open, COUNT(*) AS incidents FROM incidents GROUP BY service ORDER BY pct_open DESC',
    datasetKey: 'saas_ops', tool: 'sql', estHours: 0.5, priority: 'high', dueInDays: 3, day: 2, difficulty: 'hard',
  },

  'sa-024': {
    title: 'Chart the engineering cost',
    hint: "Services are categories. Sort them so the reader can see where the time goes without reading the labels.",
    brief: "One slide for the engineering planning session: total hours spent per service. Services have no natural order, which decides the chart type and the sorting.",
    tool: 'chart', datasetKey: 'saas_ops',
    chart: {
      prompt: 'Total engineering hours spent per service.',
      sourceSql: 'SELECT service, ROUND(SUM((julianday(resolved_at) - julianday(started_at)) * 24), 1) AS total_hours FROM incidents WHERE resolved_at IS NOT NULL GROUP BY service ORDER BY total_hours DESC',
      columns: ['service', 'total_hours'],
      correct: { type: 'bar', x: 'service', y: 'total_hours', sort: 'desc' },
      whyRight: 'Unordered categories compared by size: bars, sorted so the service consuming the most engineering time is first.',
      why: {
        type: 'Services are categories, not a sequence. A line between api-gateway and auth-service would imply a progression that does not exist.',
        x: 'The service is the category.',
        y: 'Total hours is the cost being compared.',
        sort: 'Nothing orders services for you, so sort by size — and here the ranking is the entire point of the slide.',
      },
    },
    estHours: 0.25, priority: 'medium', dueInDays: 3, day: 2, difficulty: 'medium',
  },

  'sa-025': {
    title: 'Tell Arjun which measure you are using',
    hint: "He is planning capacity. Say which service costs him the most time, and name the measure that makes it so.",
    brief: "Arjun is allocating next quarter's reliability work. Send him the picture. The difficult part is that the three measures disagree and he needs one answer with the reasoning visible. Under 160 words.",
    tool: 'writeup', datasetKey: 'saas_ops',
    writeup: {
      to: 'Arjun Rao', subject: 'Reliability — which service actually costs us', maxWords: 160,
      prompt: 'One ranking, the measure behind it, and the two it disagrees with.',
      rubric: [
        { key: 'answer', label: 'Which service consumes the most engineering time', markers: ['api.gateway|api gateway|326|gateway'], why: 'The number he is buying with. Lead with it.' },
        { key: 'measure', label: 'Which measure that is', markers: ['total|sum|hours|cumulative|overall|aggregate'], why: 'Total hours, not frequency and not average. He has to know which question you answered.' },
        { key: 'disagree', label: 'That the other measures name other services', markers: ['report.builder|billing.sync|most often|frequen|average|longest|different'], why: 'Volunteering the disagreement is what stops somebody arriving with a different ranking and treating yours as wrong.' },
        { key: 'small', label: "That billing-sync's average is one incident", markers: ['one|1 |single|two open|small|sample'], why: 'Otherwise the slowest-looking service gets funded on the strength of a single data point.' },
        { key: 'open', label: 'That these figures cover closed incidents only', markers: ['closed|open|unresolved|exclud|seven|7 '], why: 'A number that silently excludes the unfinished work is the one he will be caught by.' },
      ],
    },
    estHours: 0.55, priority: 'high', dueInDays: 3, day: 2, difficulty: 'hard',
  },

  'sa-030': {
    title: 'What is still running, oldest first',
    hint: "No aggregate. Just the open ones, in the order they started, and read the top row carefully.",
    brief: "Before trusting any average, look at what it left out. Write ONE SQL SELECT listing every UNRESOLVED incident with its service, severity, start time and rows corrupted, oldest first.",
    referenceSql: 'SELECT service, severity, started_at, rows_corrupted FROM incidents WHERE resolved_at IS NULL ORDER BY started_at',
    datasetKey: 'saas_ops', tool: 'sql', estHours: 0.3, priority: 'high', dueInDays: 4, day: 3, difficulty: 'easy',
  },

  'sa-031': {
    title: 'Why the fastest service is not the fastest',
    hint: "Look at auth-service in two tables at once: its average, and how many of its incidents never closed.",
    brief: "auth-service has the lowest average resolution time of any service. It also has three of its seven incidents still open. Work out what that combination means.",
    tool: 'choice', datasetKey: 'saas_ops',
    choice: {
      prompt: 'Tick everything that follows.',
      options: [
        { key: 'survivor', correct: true, label: 'Its average only contains the incidents that finished — the hard ones are still running', why: 'Survivorship bias, exactly. The incidents that would have raised the average are the ones excluded from it, because they have not ended yet.' },
        { key: 'systematic', correct: true, label: 'This biases every service with open incidents in the same direction', why: 'Not a quirk of auth-service. Any MTTR computed on closed incidents flatters whoever has the most unfinished work, which is the opposite of what a reliability metric should do.' },
        { key: 'report', correct: true, label: 'The open count has to sit beside the average wherever it is published', why: 'The two numbers are only meaningful together. An MTTR with no open count next to it is an invitation to be misread.' },
        { key: 'good', correct: false, label: 'auth-service is our most reliable service', why: 'It has the worst unresolved ratio after billing-sync. The measure that makes it look best is the one distorted by that fact.' },
        { key: 'exclude', correct: false, label: 'Exclude services with open incidents from the comparison', why: 'That removes four of five services. A method that discards most of your data to stay clean has stopped answering the question.' },
        { key: 'guess', correct: false, label: 'Estimate resolution times for the open incidents so they can be included', why: 'Inventing the values that would change your conclusion is the most dangerous option on this list, and it is the one that sounds most diligent.' },
      ],
      skills: { statistics: 100, businessLogic: 100 },
    },
    estHours: 0.4, priority: 'high', dueInDays: 4, day: 3, difficulty: 'hard',
  },

  'sa-032': {
    title: 'Does severity predict duration at all',
    hint: "Min and max per severity. Compare the ranges rather than the averages.",
    brief: "Engineering triages by severity, so it is worth knowing whether severity says anything about how long something will take. Write ONE SQL SELECT returning, per severity across CLOSED incidents: how many, the fastest resolution in hours and the slowest. Severity order.",
    referenceSql: 'SELECT severity, COUNT(*) AS closed, ROUND(MIN((julianday(resolved_at) - julianday(started_at)) * 24), 1) AS fastest, ROUND(MAX((julianday(resolved_at) - julianday(started_at)) * 24), 1) AS slowest FROM incidents WHERE resolved_at IS NOT NULL GROUP BY severity ORDER BY severity',
    datasetKey: 'saas_ops', tool: 'sql', estHours: 0.55, priority: 'high', dueInDays: 4, day: 3, difficulty: 'hard',
  },

  'sa-033': {
    title: 'The SEV1 that has been open since May',
    hint: "You have the list. Decide what you are entitled to conclude from one row, and what you would need to ask.",
    brief: "The oldest unresolved incident is a billing-sync SEV1 that started in May. Nobody has mentioned it. Decide how to handle it.",
    tool: 'choice', datasetKey: 'saas_ops',
    choice: {
      prompt: 'Tick everything that is defensible.',
      options: [
        { key: 'raise', correct: true, label: 'Raise it directly with Arjun and Sneha rather than only putting it in the report', why: 'A SEV1 open for months is either a live problem nobody owns or a record that was never closed. Both need a person, and a line in a Friday deck is not a person.' },
        { key: 'ask', correct: true, label: 'Ask whether it is genuinely open or was simply never closed off', why: 'The data cannot distinguish those and they mean completely different things. This is a question, not a finding, until somebody answers it.' },
        { key: 'flag', correct: true, label: 'Note that stale records would distort every open-incident figure you have produced', why: 'If records go unclosed, your unresolved percentages measure record-keeping rather than reliability — and that caveat belongs in the report either way.' },
        { key: 'assume', correct: false, label: 'Report it as a four-month SEV1 outage', why: 'You do not know that. A SEV1 genuinely unresolved for four months would be a company-wide emergency, which is itself evidence the record is probably stale.' },
        { key: 'ignore', correct: false, label: 'Leave it out — one row is not a pattern', why: 'It is a SEV1. Severity exists precisely so single rows get attention, and this is the one thing on your screen that might need action today.' },
        { key: 'close', correct: false, label: 'Treat it as closed for the purposes of the analysis', why: 'Editing an inconvenient record to make the numbers behave is the point at which an analysis stops being trustworthy.' },
      ],
      skills: { businessLogic: 100, communication: 100 },
    },
    estHours: 0.35, priority: 'high', dueInDays: 4, day: 3, difficulty: 'hard',
  },

  'sa-034': {
    title: 'Tell Arjun the MTTR is flattering him',
    hint: "You are undermining a metric his team reports upward. Give him the replacement in the same breath.",
    brief: "Engineering reports mean time to resolve as a headline metric. You have just established it is biased in favour of whoever has the most unfinished work. Tell Arjun. Under 170 words.",
    tool: 'writeup', datasetKey: 'saas_ops',
    writeup: {
      to: 'Arjun Rao', subject: 'MTTR — a problem with how we are computing it', maxWords: 170,
      prompt: 'The bias, why it matters, and what to report instead.',
      rubric: [
        { key: 'bias', label: 'That MTTR excludes unresolved incidents', markers: ['open|unresolved|exclud|closed only|still running|seven|7 '], why: 'The mechanism. Without it this is an assertion about a metric he trusts.' },
        { key: 'direction', label: 'Which way the bias runs', markers: ['flatter|better|lower|down|understate|favour|improve'], why: 'It makes things look better, not worse. That is what makes it dangerous rather than merely imprecise.' },
        { key: 'example', label: 'auth-service as the concrete case', markers: ['auth|fastest|lowest|three|3 of|42'], why: 'The service that looks best on MTTR has the second-worst unresolved ratio. One example beats a paragraph of theory.' },
        { key: 'fix', label: 'What to report alongside it', markers: ['open|unresolved|count|share|percent|beside|alongside|both'], why: 'Never take away a metric without offering the pair that makes it honest. He has to report something on Monday.' },
        { key: 'tone', label: 'Framed as a measurement problem, not a team failing', markers: ['we|our|metric|comput|method|standard|common|not|nobody'], why: 'Almost every company computes MTTR this way. Saying so is both true and the difference between being heard and being resented.' },
      ],
    },
    estHours: 0.6, priority: 'high', dueInDays: 4, day: 3, difficulty: 'hard',
  },

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
  'sa-040': {
    title: 'Blast radius per service',
    hint: "COUNT(DISTINCT client_id) is how many were touched. The ratio tells you whether it hits everyone once or a few repeatedly.",
    brief: "Two services with nine incidents each are different problems if one hit seven clients and the other hit two. Write ONE SQL SELECT returning, per service: how many distinct clients were affected, how many incidents, and incidents per affected client. Most clients first.",
    referenceSql: 'SELECT service, COUNT(DISTINCT client_id) AS clients_hit, COUNT(*) AS incidents, ROUND(COUNT(*) * 1.0 / COUNT(DISTINCT client_id), 2) AS incidents_per_client FROM incidents GROUP BY service ORDER BY clients_hit DESC',
    datasetKey: 'saas_ops', tool: 'sql', estHours: 0.55, priority: 'high', dueInDays: 4, day: 4, difficulty: 'hard',
  },

  'sa-041': {
    title: 'Revenue exposed to each service',
    hint: "SUM(DISTINCT mrr) across a join, or the join multiplies each client's revenue by their incident count.",
    brief: "Arjun is arguing for headcount and revenue is the language that works. Write ONE SQL SELECT returning, per service: how many distinct ACTIVE clients it has affected and the total monthly revenue of those clients. Most revenue first. Watch the join.",
    referenceSql: "SELECT i.service, COUNT(DISTINCT i.client_id) AS clients, SUM(DISTINCT c.mrr) AS mrr_touched FROM incidents i JOIN clients c ON c.id = i.client_id WHERE c.status = 'active' GROUP BY i.service ORDER BY mrr_touched DESC",
    datasetKey: 'saas_ops', tool: 'sql', estHours: 0.65, priority: 'high', dueInDays: 5, day: 4, difficulty: 'hard',
  },

  'sa-042': {
    title: 'The support backlog, by priority',
    hint: "Three conditional counts in one pass. Compare where the volume is against where the urgency is.",
    brief: "Incidents are our view of reliability; tickets are the clients' view. Write ONE SQL SELECT returning, per ticket priority: how many are open, how many pending and how many resolved. Most open first.",
    referenceSql: "SELECT t.priority, SUM(CASE WHEN t.status = 'open' THEN 1 ELSE 0 END) AS open_now, SUM(CASE WHEN t.status = 'pending' THEN 1 ELSE 0 END) AS pending, SUM(CASE WHEN t.status = 'resolved' THEN 1 ELSE 0 END) AS resolved FROM tickets t GROUP BY t.priority ORDER BY open_now DESC",
    datasetKey: 'saas_ops', tool: 'sql', estHours: 0.5, priority: 'high', dueInDays: 5, day: 4, difficulty: 'medium',
  },

  'sa-043': {
    title: 'Who is carrying the backlog',
    hint: "Open and pending are both unfinished. One of the names at the top will surprise you if you remember the incident list.",
    brief: "Write ONE SQL SELECT returning each ACTIVE client with unfinished tickets — open or pending — with their tier, revenue and how many. Biggest backlog first, then biggest client. Then compare the top rows against who actually had incidents.",
    referenceSql: "SELECT c.company, c.tier, c.mrr, SUM(CASE WHEN t.status IN ('open','pending') THEN 1 ELSE 0 END) AS backlog FROM clients c JOIN tickets t ON t.client_id = c.id WHERE c.status = 'active' GROUP BY c.company, c.tier, c.mrr HAVING backlog > 0 ORDER BY backlog DESC, c.mrr DESC",
    datasetKey: 'saas_ops', tool: 'sql', estHours: 0.6, priority: 'high', dueInDays: 5, day: 4, difficulty: 'hard',
  },

  'sa-044': {
    title: 'The client with a backlog and no incidents',
    hint: "Berylline Retail is joint top of the backlog and appears nowhere in the incident list. Work out what that can mean.",
    brief: "Our largest Enterprise account by revenue has the joint-largest support backlog and has not had a single incident all quarter. Decide what that tells you.",
    tool: 'choice', datasetKey: 'saas_ops',
    choice: {
      prompt: 'Tick everything that is defensible.',
      options: [
        { key: 'different', correct: true, label: 'Tickets and incidents measure different things and do not have to agree', why: 'An incident is something we broke. A ticket is a client asking for something. An account can be full of questions, requests and confusion without anything having failed.' },
        { key: 'usage', correct: true, label: 'A big backlog with no incidents may mean heavy usage, or a product they find hard', why: 'Both are plausible, neither is in this data, and both are worth putting to their CSM as a question.' },
        { key: 'reliability', correct: true, label: 'A reliability programme would do nothing for this account', why: 'The single most useful sentence here. It stops reliability investment being justified by a backlog that reliability cannot touch.' },
        { key: 'fine', correct: false, label: 'No incidents means the account is healthy', why: 'They have the joint-largest backlog in the book. Zero incidents and zero problems are not the same measurement.' },
        { key: 'merge', correct: false, label: 'Combine tickets and incidents into one "client pain" score', why: 'It would put an account with five questions alongside one with half a million corrupted rows and lose the distinction that makes either actionable.' },
        { key: 'ignore', correct: false, label: 'Leave tickets out — this is a reliability review', why: 'The backlog is the clients\' experience of the platform, and Arjun will be asked about it. Scoping it out because it complicates the story is the wrong reason.' },
      ],
      skills: { businessLogic: 100, communication: 100 },
    },
    estHours: 0.4, priority: 'high', dueInDays: 5, day: 4, difficulty: 'hard',
  },

  'sa-045': {
    title: 'Chart the unresolved share',
    hint: "Services are categories, and the finding is who is worst — so put worst first.",
    brief: "One slide: the percentage of each service's incidents still unresolved. This is the measure the MTTR hides, so the chart has to make it obvious.",
    tool: 'chart', datasetKey: 'saas_ops',
    chart: {
      prompt: 'Share of incidents still unresolved, by service.',
      sourceSql: 'SELECT service, ROUND(SUM(CASE WHEN resolved_at IS NULL THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 1) AS pct_open FROM incidents GROUP BY service ORDER BY pct_open DESC',
      columns: ['service', 'pct_open'],
      correct: { type: 'bar', x: 'service', y: 'pct_open', sort: 'desc' },
      whyRight: 'Unordered categories compared by size, sorted worst first because the point of the slide is which services are not finishing their work.',
      why: {
        type: 'Services are categories. Bars compare them; a line would invent a progression between them.',
        x: 'The service is the category.',
        y: 'The share unresolved, as a percentage.',
        sort: 'Descending. The reader is looking for the problem, and it should be the first thing under their eye.',
      },
    },
    estHours: 0.25, priority: 'medium', dueInDays: 5, day: 4, difficulty: 'medium',
  },

  'sa-050': {
    title: 'Hours per affected client',
    hint: "Total hours over distinct clients. It answers a question neither of the previous rankings did.",
    brief: "One more angle before the recommendation. Write ONE SQL SELECT returning, per service across CLOSED incidents: total hours, distinct clients affected, and hours per affected client. Highest hours per client first.",
    referenceSql: 'SELECT service, ROUND(SUM((julianday(resolved_at) - julianday(started_at)) * 24), 1) AS total_hours, COUNT(DISTINCT client_id) AS clients, ROUND(SUM((julianday(resolved_at) - julianday(started_at)) * 24) / COUNT(DISTINCT client_id), 1) AS hours_per_client FROM incidents WHERE resolved_at IS NOT NULL GROUP BY service ORDER BY hours_per_client DESC',
    datasetKey: 'saas_ops', tool: 'sql', estHours: 0.6, priority: 'high', dueInDays: 5, day: 5, difficulty: 'hard',
  },

  'sa-051': {
    title: 'Median resolution time, in Python',
    // Flagged for rework: Arjun accepts it and then wants it split a different way.
    rework: true,
    hint: "SQLite has no median. Build the list of durations per service, sort, take the middle, and handle the even-length case.",
    brief: "Every duration figure this week has been a mean, and one 66-hour incident moves a mean built on six. In the notebook, compute for each service across CLOSED incidents: the mean hours, the median hours, and how many incidents. Sort by median descending. Assign a list of dicts with keys service, mean_hours, median_hours and closed to `result`.",
    tool: 'python', datasetKey: 'saas_ops',
    estHours: 0.75, priority: 'high', dueInDays: 5, day: 5, difficulty: 'hard',
    referenceCompute: (tables) => {
      const by = new Map();
      for (const i of tables.incidents) {
        if (!i.resolved_at) continue;
        const hours = (Date.parse(i.resolved_at) - Date.parse(i.started_at)) / 3600000;
        if (!by.has(i.service)) by.set(i.service, []);
        by.get(i.service).push(hours);
      }
      const median = (xs) => {
        const a = [...xs].sort((p, q) => p - q);
        const m = Math.floor(a.length / 2);
        return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
      };
      return [...by.entries()]
        .map(([service, v]) => ({
          service,
          mean_hours: Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10,
          median_hours: Math.round(median(v) * 10) / 10,
          closed: v.length,
        }))
        .sort((a, b) => b.median_hours - a.median_hours);
    },
  },

  'sa-052': {
    title: 'Where a quarter of engineering effort should go',
    hint: "The data ranks services four different ways. Picking one is a judgement, and the report has to show it being made.",
    brief: "Arjun has roughly a quarter of one team to spend on reliability next quarter. Decide what you would recommend — and notice that the data does not contain the answer.",
    tool: 'choice', datasetKey: 'saas_ops',
    choice: {
      exhibit: {
        kind: 'email', from: 'Arjun Rao', subject: 'What do I point them at?',
        body: "I have about a quarter of a team for three months. Not enough to fix everything, plenty to fix one thing properly.\n\nI do not want a dashboard. I want you to tell me where to point them and why, and I want the why to be something I can say to my skip-level without him picking it apart.",
      },
      prompt: 'Tick every recommendation you could defend.',
      options: [
        { key: 'gateway', correct: true, label: 'api-gateway, because it consumes the most engineering time of any service', why: 'A quarter of a team is a capacity decision, and 326 hours is the largest capacity drain on the board. Directly connected to what he is spending.' },
        { key: 'auth', correct: true, label: 'auth-service, because its unresolved backlog is growing and its MTTR hides it', why: 'Three of seven still open, including a SEV1 from May. The case is that the problem is not being finished, which no average will show him.' },
        { key: 'state', correct: true, label: 'Either — provided the report says which measure drove the choice', why: 'Both are defensible; what is not defensible is a recommendation whose basis is invisible. The skip-level will ask exactly that question.' },
        { key: 'billing', correct: false, label: 'billing-sync, because it has the worst average resolution time', why: 'One closed incident. Pointing a quarter of a team at a service on the strength of a single data point is the failure this week was built to prevent.' },
        { key: 'all', correct: false, label: 'Spread the effort proportionally across all five services', why: 'He told you it is enough to fix one thing properly. Proportional allocation is how a reliability programme produces five half-fixes and no measurable change.' },
        { key: 'dashboard', correct: false, label: 'Give him the full ranking and let him choose', why: 'He explicitly said he does not want a dashboard. Declining to recommend when you have the evidence is not neutrality, it is leaving the judgement to somebody with less information.' },
      ],
      skills: { businessLogic: 100, communication: 100 },
    },
    estHours: 0.4, priority: 'high', dueInDays: 5, day: 5, difficulty: 'hard',
  },

  'sa-053': {
    title: 'What reliability work would not touch',
    hint: "Clients with a backlog and no incidents. Their problem is real and it is not this programme's problem.",
    brief: "A recommendation is partly a statement about what will NOT improve. Write ONE SQL SELECT returning each ACTIVE client that has unfinished tickets but NO incidents at all, with their tier, revenue and backlog size. Biggest backlog first.",
    referenceSql: "SELECT c.company, c.tier, c.mrr, SUM(CASE WHEN t.status IN ('open','pending') THEN 1 ELSE 0 END) AS backlog FROM clients c JOIN tickets t ON t.client_id = c.id WHERE c.status = 'active' AND NOT EXISTS (SELECT 1 FROM incidents i WHERE i.client_id = c.id) GROUP BY c.company, c.tier, c.mrr HAVING backlog > 0 ORDER BY backlog DESC",
    datasetKey: 'saas_ops', tool: 'sql', estHours: 0.7, priority: 'high', dueInDays: 5, day: 5, difficulty: 'hard',
  },

  'sa-054': {
    title: 'The skip-level picks it apart',
    hint: "He is asking for a guarantee. Work out which part of it you can actually give.",
    brief: "Your recommendation reaches Arjun's skip-level and comes back with a question. Tick every response you can stand behind.",
    tool: 'choice', datasetKey: 'saas_ops',
    choice: {
      exhibit: {
        kind: 'email', from: 'Vikram Nair', subject: 'Before I sign off the reliability quarter',
        body: "Arjun wants a quarter of a team on this and he is quoting your analysis.\n\nSimple question: if we do it, how much does our incident count drop? I need a number to put against the cost, otherwise I am approving effort against a hope.",
      },
      prompt: 'Which responses are honest and useful?',
      options: [
        { key: 'cannot', correct: true, label: '"I cannot forecast the reduction — we have one quarter of data and no comparable fix to learn from"', why: 'Naming why, not just refusing. One quarter with no prior intervention gives nothing to base a projection on.' },
        { key: 'measure', correct: true, label: '"What I can give you is the current cost, so you can measure the change afterwards"', why: '326 hours is a baseline. Turning an unanswerable forecast into a measurable before-and-after is the move that gets the decision made.' },
        { key: 'target', correct: true, label: '"Set it up as a target rather than a prediction — and agree now how we will check"', why: 'It puts the number where it belongs, as a commitment owned by engineering rather than a forecast owned by the analyst.' },
        { key: 'thirty', correct: false, label: '"Around thirty percent."', why: 'Invented. It will be repeated as your estimate, it will appear in a budget document, and it will be the number you are measured against.' },
        { key: 'industry', correct: false, label: '"Industry benchmarks suggest a forty percent reduction is typical."', why: 'You have no benchmark data and no reason to think another company\'s api-gateway resembles ours. It sounds far more rigorous than the invented number and is the same thing.' },
        { key: 'refuse', correct: false, label: '"That is an engineering question, not an analytics one."', why: 'True and unhelpful. You have the baseline he needs, and pushing the whole question away wastes the leverage the analysis actually has.' },
      ],
      skills: { communication: 100, businessLogic: 100, statistics: 80 },
    },
    estHours: 0.4, priority: 'high', dueInDays: 5, day: 5, difficulty: 'hard',
  },

  'sa-055': {
    title: 'The reliability recommendation',
    hint: "One service, the measure that chose it, what it will not fix, and how you will both know whether it worked.",
    brief: "The deliverable. Arjun will take this to a funding conversation and defend it without you, so everything he needs to defend it has to be in the document.",
    tool: 'writeup', datasetKey: 'saas_ops',
    writeup: {
      to: 'Arjun Rao and Vikram Nair', subject: 'Reliability — where to spend the quarter', maxWords: 220,
      prompt: 'The recommendation: one service, the basis, the limits, and the baseline to measure against.',
      rubric: [
        { key: 'pick', label: 'One named service', markers: ['api.gateway|api gateway|auth.service|auth service|gateway|auth'], why: 'He asked where to point a team. A ranking is not an answer to that question.' },
        { key: 'basis', label: 'The measure that chose it', markers: ['total hours|326|engineering time|capacity|unresolved|open|backlog|share'], why: 'The sentence his skip-level will probe. It has to be one measure, named.' },
        { key: 'rejected', label: 'Why not the service that looks worst on average duration', markers: ['billing.sync|one|single|1 |sample|average|misleading'], why: 'Somebody will arrive with that ranking. Pre-empting it is cheaper than defending against it.' },
        { key: 'mttr', label: 'That MTTR understates services with open work', markers: ['mttr|average|closed|exclud|open|flatter|bias|survivor'], why: 'The methodological finding of the week, and the reason his current metric did not surface this.' },
        { key: 'wont', label: 'What this will NOT improve', markers: ['backlog|ticket|berylline|no incident|not|will not|won.t|unaffected'], why: 'Naming what stays broken is what stops the programme being judged against problems it was never aimed at.' },
        { key: 'baseline', label: 'A baseline to measure the change against', markers: ['baseline|measure|before|after|compare|326|hours|track|re.run'], why: 'Vikram is approving effort against a hope unless you give him something to check it by.' },
      ],
    },
    estHours: 0.8, priority: 'high', dueInDays: 5, day: 5, difficulty: 'hard',
  },

  // ---- Senior project 2: Account Economics Review -----------------------------------
  //
  // Which accounts cost more to serve than they return -- with no cost column anywhere in
  // the data, so the week begins by building a proxy and saying out loud that it is one.
  //
  //   Monday    there is no cost column. Build a defensible proxy or answer nothing.
  //   Tuesday   the finding: support load per account is flat across tiers while revenue
  //             per account varies thirteenfold.
  //   Wednesday the wobble. SUM(DISTINCT mrr) -- the fix taught last week -- silently
  //             loses a client, because two Starter accounts bill the same amount.
  //   Thursday  concentration. Four accounts are sixty percent of the book, and the CSM
  //             load analysis turns out to be a non-finding.
  //   Friday    the Starter tier recommendation, under pressure to just kill it.
  //
  // Measured: Enterprise 5.0 tickets per account, Growth 4.83, Starter 4.6 -- against
  // 310k, 120k and 23k of revenue per account. Starter raises more tickets than
  // Enterprise for nine percent of the revenue.

  'sb-101': {
    title: 'There is no cost column',
    hint: "Look at what the tables actually contain before deciding what can be answered. Then decide what a defensible proxy looks like.",
    brief: "Diya has asked which accounts cost more to serve than they return. Before writing anything, establish what you can actually measure — because the central quantity in that question is not in the data.",
    tool: 'choice', datasetKey: 'saas_ops',
    choice: {
      exhibit: {
        kind: 'email', from: 'Diya Chandra', subject: 'Cost to serve — for the pricing review',
        body: "We are reviewing tier pricing next month and the question I keep being asked is whether the smaller accounts actually pay for themselves.\n\nI do not have a cost-to-serve figure and I do not think anyone does. You have the support and incident data — can you get me close enough to make a pricing decision, or should I stop asking?",
      },
      prompt: 'Tick everything that follows.',
      options: [
        { key: 'proxy', correct: true, label: 'A proxy has to be built — nothing in the data is a cost', why: 'Tickets and incidents are volume, not money. The analysis is possible only if you construct something and are explicit that it is constructed.' },
        { key: 'name', correct: true, label: 'The proxy has to be named and defended in the output', why: 'A pricing decision made on an undisclosed proxy is a pricing decision nobody can audit. Saying "tickets as a proxy for support cost" in the first line is the difference.' },
        { key: 'relative', correct: true, label: 'It can support relative comparisons between tiers, not absolute costs', why: 'You can say Starter costs more per rupee than Enterprise. You cannot say it costs four lakh, and the distinction has to survive into the summary.' },
        { key: 'stop', correct: false, label: 'Tell her to stop asking until Finance produces a cost model', why: 'She offered you that exit and it would be the wrong one. The relative answer is genuinely useful for a pricing decision and it is available today.' },
        { key: 'invent', correct: false, label: 'Estimate a cost per ticket and multiply through', why: 'That converts a defensible relative finding into an invented absolute one. The moment a rupee figure exists it gets quoted without its assumption.' },
        { key: 'mrr', correct: false, label: 'Use revenue alone — low-revenue accounts are the unprofitable ones', why: 'That assumes what the analysis is meant to establish. A small account that never contacts us may be the most profitable thing in the book.' },
      ],
      skills: { businessLogic: 100, communication: 100 },
    },
    estHours: 0.3, priority: 'high', dueInDays: 1, day: 1, difficulty: 'hard',
  },

  'sb-102': {
    title: 'What each tier is worth',
    hint: "No join here, so a plain SUM is correct. Remember that for Wednesday.",
    brief: "Start with the revenue side. Write ONE SQL SELECT returning, per tier across ACTIVE clients: how many clients, the total monthly revenue, and the average revenue per client. Biggest tier by revenue first.",
    referenceSql: "SELECT tier, COUNT(*) AS clients, SUM(mrr) AS mrr, ROUND(AVG(mrr)) AS mrr_per_client FROM clients WHERE status = 'active' GROUP BY tier ORDER BY mrr DESC",
    datasetKey: 'saas_ops', tool: 'sql', estHours: 0.35, priority: 'high', dueInDays: 1, day: 1, difficulty: 'medium',
  },

  'sb-103': {
    title: 'What each tier costs to support',
    hint: "LEFT JOIN so a client with no tickets still counts in the denominator. Compare the answer against the revenue table.",
    brief: "Now the cost proxy. Write ONE SQL SELECT returning, per tier across ACTIVE clients: how many clients, how many tickets in total, and tickets per client. Heaviest support load per client first.",
    referenceSql: "SELECT c.tier, COUNT(DISTINCT c.id) AS clients, COUNT(t.id) AS tickets, ROUND(COUNT(t.id) * 1.0 / COUNT(DISTINCT c.id), 2) AS tickets_per_client FROM clients c LEFT JOIN tickets t ON t.client_id = c.id WHERE c.status = 'active' GROUP BY c.tier ORDER BY tickets_per_client DESC",
    datasetKey: 'saas_ops', tool: 'sql', estHours: 0.5, priority: 'high', dueInDays: 2, day: 1, difficulty: 'hard',
  },

  'sb-104': {
    title: 'What the two tables say together',
    hint: "Put revenue per client beside tickets per client. The ratio between the tiers is the finding.",
    brief: "You have revenue per account and support load per account. Read them together before anyone else does.",
    tool: 'choice', datasetKey: 'saas_ops',
    choice: {
      prompt: 'Tick everything your own results support.',
      options: [
        { key: 'flat', correct: true, label: 'Support load per account is almost identical across the three tiers', why: 'Five, 4.8 and 4.6 tickets. Whatever drives a client to contact us, it is not what they pay.' },
        { key: 'revenue', correct: true, label: 'Revenue per account varies by more than thirteen times', why: 'About 310,000 against about 23,000. Flat cost against steeply varying revenue is the entire economics of this book.' },
        { key: 'starter', correct: true, label: 'Starter accounts raise more tickets in total than Enterprise ones do', why: 'Twenty-three against twenty, for nine percent of the revenue. The sentence a pricing review needs.' },
        { key: 'ent', correct: false, label: 'Enterprise accounts are the most expensive to support', why: 'They have the highest tickets per account by a rounding margin and by far the most revenue behind each one. Reading the raw ticket count as cost ignores the denominator.' },
        { key: 'more', correct: false, label: 'Bigger accounts demand more support', why: 'Your own table says they demand about the same. This is the assumption the analysis exists to test, and it does not survive.' },
        { key: 'kill', correct: false, label: 'The Starter tier should be discontinued', why: 'Five accounts, and you have not looked at what they become. That is Friday\'s decision and it needs more than one ratio.' },
      ],
      skills: { businessLogic: 100, statistics: 80 },
    },
    estHours: 0.35, priority: 'high', dueInDays: 2, day: 1, difficulty: 'hard',
  },

  'sb-105': {
    title: 'Tell Diya what you can and cannot give her',
    hint: "She asked whether to stop asking. Answer that directly, then say what the proxy is.",
    brief: "Write back on day one. She offered you a way out of the question and you are not taking it, so say what you will produce and what it will not be. Under 150 words.",
    tool: 'writeup', datasetKey: 'saas_ops',
    writeup: {
      to: 'Diya Chandra', subject: 'Cost to serve — what I can build', maxWords: 150,
      prompt: 'The proxy, its limits, and the answer to the question she actually asked.',
      rubric: [
        { key: 'yes', label: 'That the question can be answered, at least relatively', markers: ['can|yes|will|able|worth|keep asking|do not stop'], why: 'She asked whether to stop asking. Answer that before anything else.' },
        { key: 'proxy', label: 'What the proxy is', markers: ['ticket|incident|support|volume|proxy|stand.in|substitute'], why: 'Name it in the note, not in a footnote. It is the load-bearing assumption of everything that follows.' },
        { key: 'nocost', label: 'That no cost figure exists in the data', markers: ['no cost|not have|do not have|don.t have|absent|missing|nothing'], why: 'Stating the gap yourself is what stops somebody later treating your ratio as rupees.' },
        { key: 'relative', label: 'That the output is comparative, not absolute', markers: ['relative|compar|between|rank|not absolute|cannot say|per rupee|order'], why: 'The one sentence that prevents your work becoming a cost model somebody budgets against.' },
        { key: 'early', label: 'Something concrete she can already use', markers: ['flat|similar|same|tier|per account|starter|enterprise|thirteen|13'], why: 'The flat-load finding is available on day one and it is the thing that will shape her pricing review.' },
      ],
    },
    estHours: 0.5, priority: 'high', dueInDays: 2, day: 1, difficulty: 'hard',
  },

  'sb-110': {
    title: 'Incidents per tier',
    hint: "COUNT(DISTINCT i.id) once you have joined, or the count multiplies. The ordering will surprise you.",
    brief: "Tickets are what clients ask us; incidents are what we broke. Write ONE SQL SELECT returning, per tier across ACTIVE clients: how many clients, how many incidents, and incidents per client. Most incidents per client first.",
    referenceSql: "SELECT c.tier, COUNT(DISTINCT c.id) AS clients, COUNT(DISTINCT i.id) AS incidents, ROUND(COUNT(DISTINCT i.id) * 1.0 / COUNT(DISTINCT c.id), 2) AS incidents_per_client FROM clients c LEFT JOIN incidents i ON i.client_id = c.id WHERE c.status = 'active' GROUP BY c.tier ORDER BY incidents_per_client DESC",
    datasetKey: 'saas_ops', tool: 'sql', estHours: 0.55, priority: 'high', dueInDays: 2, day: 2, difficulty: 'hard',
  },

  'sb-111': {
    title: 'The tier that breaks most is the one that pays least',
    hint: "Three tiers, three measures, and the ordering is the same every time except for revenue.",
    brief: "Starter accounts have three incidents each; Enterprise accounts have one. Decide what that adds to the economics picture, and be careful about what it does not establish.",
    tool: 'choice', datasetKey: 'saas_ops',
    choice: {
      prompt: 'Tick everything that is defensible.',
      options: [
        { key: 'compound', correct: true, label: 'Starter accounts cost more on both proxies while paying least', why: 'Similar tickets, three times the incidents, a fourteenth of the revenue. Two independent measures pointing the same way is much stronger than either alone.' },
        { key: 'why', correct: true, label: 'Nothing here explains why smaller accounts have more incidents', why: 'Could be product surface, could be self-service, could be which services they use. The data supports the observation and none of the explanations.' },
        { key: 'ask', correct: true, label: 'It is worth asking Engineering before publishing', why: 'Arjun will know in thirty seconds whether Starter accounts sit on a different part of the platform. That converts an odd finding into an explained one.' },
        { key: 'cause', correct: false, label: 'Starter accounts are less technically capable, which causes more incidents', why: 'An incident is something WE broke. Reading client capability into our own failure rate is both unfounded and the sort of sentence that should never leave a building.' },
        { key: 'proof', correct: false, label: 'This proves the Starter tier is unprofitable', why: 'It is strong evidence on the cost side of a ratio whose other side you have proxied. "Proves" is doing work the data cannot.' },
        { key: 'drop', correct: false, label: 'Starter incidents should be deprioritised to reduce cost', why: 'A recommendation about incident response dressed as an economics finding — and one that would make the retention problem worse.' },
      ],
      skills: { businessLogic: 100, communication: 80 },
    },
    estHours: 0.35, priority: 'high', dueInDays: 3, day: 2, difficulty: 'hard',
  },

  'sb-112': {
    title: 'How concentrated is the book',
    hint: "A scalar subquery in the SELECT gives you each client's share of the whole.",
    brief: "Before recommending anything about small accounts, find out how much the big ones carry. Write ONE SQL SELECT returning every ACTIVE client with their revenue and their percentage share of total active revenue, biggest first.",
    referenceSql: "SELECT company, mrr, ROUND(mrr * 100.0 / (SELECT SUM(mrr) FROM clients WHERE status = 'active'), 1) AS pct_of_book FROM clients WHERE status = 'active' ORDER BY mrr DESC",
    datasetKey: 'saas_ops', tool: 'sql', estHours: 0.5, priority: 'high', dueInDays: 3, day: 2, difficulty: 'hard',
  },

  'sb-113': {
    title: 'Chart the tier economics',
    hint: "Three tiers and one measure. Tiers have a natural order — decide whether to keep it.",
    brief: "One slide for the pricing review: revenue per account by tier. Tiers are ordered by size, which makes the sorting decision different from a chart of unordered categories.",
    tool: 'chart', datasetKey: 'saas_ops',
    chart: {
      prompt: 'Average monthly revenue per account, by tier.',
      sourceSql: "SELECT tier, ROUND(AVG(mrr)) AS mrr_per_client FROM clients WHERE status = 'active' GROUP BY tier ORDER BY mrr_per_client DESC",
      columns: ['tier', 'mrr_per_client'],
      correct: { type: 'bar', x: 'tier', y: 'mrr_per_client', sort: 'desc' },
      whyRight: 'Bars for three categories compared by size. Sorting by value happens to match the tier order here, which makes the gap read cleanly.',
      why: {
        type: 'Three categories compared by magnitude. A line would imply Starter, Growth and Enterprise are points on a continuum a reader could interpolate.',
        x: 'The tier is the category.',
        y: 'Revenue per account is the value.',
        sort: 'By value, descending. It agrees with the natural tier order, so the chart reads correctly either way — and the thirteenfold drop is the whole message.',
      },
    },
    estHours: 0.25, priority: 'medium', dueInDays: 3, day: 2, difficulty: 'medium',
  },

  'sb-114': {
    title: 'Revenue per ticket, by tier',
    hint: "Aggregate the revenue with a subquery rather than across the join, or the ticket rows will multiply it.",
    brief: "One number that combines both sides. Write ONE SQL SELECT returning, per tier across ACTIVE clients: the client count, total revenue, total tickets, and revenue per ticket. Most revenue per ticket first.",
    referenceSql: "SELECT c.tier, COUNT(DISTINCT c.id) AS clients, (SELECT SUM(x.mrr) FROM clients x WHERE x.status = 'active' AND x.tier = c.tier) AS mrr, COUNT(t.id) AS tickets, ROUND((SELECT SUM(x.mrr) FROM clients x WHERE x.status = 'active' AND x.tier = c.tier) * 1.0 / COUNT(t.id)) AS mrr_per_ticket FROM clients c LEFT JOIN tickets t ON t.client_id = c.id WHERE c.status = 'active' GROUP BY c.tier ORDER BY mrr_per_ticket DESC",
    datasetKey: 'saas_ops', tool: 'sql', estHours: 0.8, priority: 'high', dueInDays: 3, day: 2, difficulty: 'hard',
  },

  'sb-115': {
    title: 'Send Diya the tier picture',
    hint: "One ratio, three tiers, and the caveat that it is a proxy — in that order.",
    brief: "Mid-week. She is building the pricing review and this is the number that will shape it. Under 160 words.",
    tool: 'writeup', datasetKey: 'saas_ops',
    writeup: {
      to: 'Diya Chandra', subject: 'Tier economics — revenue against support load', maxWords: 160,
      prompt: 'The headline ratio, both measures behind it, and the proxy caveat carried forward.',
      rubric: [
        { key: 'ratio', label: 'The revenue-per-ticket gap between tiers', markers: ['62|24|4|thousand|per ticket|fourteen|14|times|gap'], why: 'The single number the pricing review turns on.' },
        { key: 'flat', label: 'That support load per account is flat', markers: ['flat|similar|same|4\\.|5|per account|tickets per'], why: 'The finding that makes the ratio meaningful rather than obvious.' },
        { key: 'incidents', label: 'That incidents point the same way', markers: ['incident|three|3 |1 |broke|second measure|also'], why: 'Two independent proxies agreeing is much stronger than one, and worth one sentence.' },
        { key: 'proxy', label: 'That this is still a proxy', markers: ['proxy|not cost|no cost|relative|stand.in|approximat'], why: 'Repeating it mid-week is what stops it being dropped from the final summary.' },
        { key: 'next', label: 'What you will look at next', markers: ['next|then|concentrat|cohort|starter|grow|churn|will'], why: 'She is drafting now and a note with no next step makes her ask for one.' },
      ],
    },
    estHours: 0.55, priority: 'high', dueInDays: 3, day: 2, difficulty: 'hard',
  },

  'sb-120': {
    title: 'The fix that breaks',
    hint: "Compute the tier total both ways in the same query and subtract. Then look at which tier loses money.",
    brief: "Last week you were taught to use SUM(DISTINCT mrr) to avoid double counting across a join. Test it. Write ONE SQL SELECT returning, per tier across ACTIVE clients: the client count, the total revenue computed with a plain SUM, the total computed with SUM(DISTINCT), and the difference. Biggest difference first.",
    referenceSql: "SELECT tier, COUNT(*) AS clients, SUM(mrr) AS correct_total, SUM(DISTINCT mrr) AS distinct_total, SUM(mrr) - SUM(DISTINCT mrr) AS lost FROM clients WHERE status = 'active' GROUP BY tier ORDER BY lost DESC",
    datasetKey: 'saas_ops', tool: 'sql', estHours: 0.6, priority: 'high', dueInDays: 3, day: 3, difficulty: 'hard',
  },

  'sb-121': {
    title: 'Why DISTINCT lost fifteen thousand',
    hint: "Find the two Starter accounts billing the same amount. That is the entire mechanism.",
    brief: "SUM(DISTINCT mrr) reports the Starter tier as fifteen thousand smaller than it is. Work out why, and what it means for the technique generally.",
    tool: 'choice', datasetKey: 'saas_ops',
    choice: {
      prompt: 'Tick everything that is true.',
      options: [
        { key: 'values', correct: true, label: 'DISTINCT deduplicates VALUES, not clients — two accounts bill exactly the same', why: 'Nimbus Analytics and Orchid Pharma are both on fifteen thousand. SUM(DISTINCT) sees one number and counts it once, silently dropping a customer.' },
        { key: 'silent', correct: true, label: 'It fails silently and the result still looks plausible', why: 'No error, no warning, and a total that is only slightly wrong. The most dangerous class of bug there is.' },
        { key: 'subquery', correct: true, label: 'A subquery over distinct client ids is the technique that does not have this failure mode', why: 'Deduplicate the CLIENTS and then sum their revenue. It is longer and it is correct regardless of what the values happen to be.' },
        { key: 'always', correct: false, label: 'SUM(DISTINCT) is always wrong and should never be used', why: 'Too strong. It is correct whenever the values are genuinely unique — the problem is that whether they are is a property of today\'s data, not of your query.' },
        { key: 'here', correct: false, label: 'It only matters because this dataset is small', why: 'The opposite. The more clients you have, the more likely two of them share a price point, so the bug becomes more likely at scale, not less.' },
        { key: 'round', correct: false, label: 'Rounding the values before summing would avoid it', why: 'Rounding makes collisions more likely, not less. This is the fix that looks like diligence and makes it worse.' },
      ],
      skills: { sql: 100, businessLogic: 80 },
    },
    estHours: 0.4, priority: 'high', dueInDays: 4, day: 3, difficulty: 'hard',
  },

  'sb-122': {
    title: 'Support load per account, properly',
    hint: "One row per client, so the join cannot double anything. Compare the top of this list with the tier table.",
    brief: "Rebuild the cost proxy at client level. Write ONE SQL SELECT returning each ACTIVE client with at least one ticket: company, tier, revenue, ticket count, and tickets per hundred thousand of revenue. Heaviest load per rupee first.",
    referenceSql: "SELECT c.company, c.tier, c.mrr, COUNT(t.id) AS tickets, ROUND(COUNT(t.id) * 100000.0 / c.mrr, 2) AS tickets_per_100k FROM clients c LEFT JOIN tickets t ON t.client_id = c.id WHERE c.status = 'active' GROUP BY c.id, c.company, c.tier, c.mrr HAVING tickets > 0 ORDER BY tickets_per_100k DESC",
    datasetKey: 'saas_ops', tool: 'sql', estHours: 0.6, priority: 'high', dueInDays: 4, day: 3, difficulty: 'hard',
  },

  'sb-123': {
    title: 'Can five accounts carry a tier decision',
    hint: "Look at how much of the Starter finding is one account, and what happens to the average without it.",
    brief: "Your recommendation would affect the whole Starter tier. It rests on five accounts, and one of them is twice as heavy as any other. Decide what that permits.",
    tool: 'choice', datasetKey: 'saas_ops',
    choice: {
      prompt: 'Tick everything that is defensible.',
      options: [
        { key: 'one', correct: true, label: 'One account drives a large share of the Starter load and must be named', why: 'Orchid Pharma is roughly double the next heaviest per rupee. A tier-wide conclusion resting on one account is a conclusion about that account.' },
        { key: 'both', correct: true, label: 'Report the tier figure with and without it', why: 'It lets the reader see how much of the finding is structural and how much is one customer, which is the question they would ask anyway.' },
        { key: 'direction', correct: true, label: 'The direction survives removing it, even if the size does not', why: 'Worth checking and worth saying. A finding that disappears without its biggest contributor is a different and much weaker finding.' },
        { key: 'enough', correct: false, label: 'Five accounts is enough because the gap is so large', why: 'Effect size does not substitute for sample size — a large gap on five accounts is still five accounts, and two of them leaving would change the picture entirely.' },
        { key: 'exclude', correct: false, label: 'Exclude the outlier so the tier figure is representative', why: 'Removing your heaviest account to make a cost analysis look calmer is the wrong direction of adjustment, and it would be indefensible if discovered.' },
        { key: 'all', correct: false, label: 'Pool all fifteen accounts instead so the sample is bigger', why: 'It would dissolve the tier comparison, which is the entire question. A bigger sample answering nothing is not an improvement.' },
      ],
      skills: { statistics: 100, businessLogic: 100 },
    },
    estHours: 0.4, priority: 'high', dueInDays: 4, day: 3, difficulty: 'hard',
  },

  'sb-124': {
    title: 'Tell Diya the number moved',
    hint: "You corrected your own figure. Say so plainly and say what it was.",
    brief: "The Starter total you sent on Tuesday was fifteen thousand light. Write the correction. This is a short note and the tone of it matters more than the length — under 120 words.",
    tool: 'writeup', datasetKey: 'saas_ops',
    writeup: {
      to: 'Diya Chandra', subject: 'Correction — Starter tier revenue', maxWords: 120,
      prompt: 'The correction: what was wrong, what it should be, and whether anything downstream changes.',
      rubric: [
        { key: 'what', label: 'The corrected figure', markers: ['114|fifteen|15|thousand|correct|should be|actually'], why: 'Lead with the number. A correction that makes the reader hunt for the new value is a second error.' },
        { key: 'why', label: 'Why it was wrong', markers: ['distinct|same|identical|two account|dedup|collapse|value'], why: 'The mechanism, briefly. It tells her whether anything else you sent is affected.' },
        { key: 'scope', label: 'Whether the conclusion changes', markers: ['does not|doesn.t|no change|still|unchanged|same conclusion|direction'], why: 'The question she has the moment she reads it. Answer it before she asks.' },
        { key: 'own', label: 'Owned plainly, without over-apologising', markers: ['I|my|mine|sent|sorry|apolog'], why: 'One clause of ownership. A long apology makes a small correction look like a large one.' },
      ],
    },
    estHours: 0.4, priority: 'high', dueInDays: 4, day: 3, difficulty: 'medium',
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

  // ---- Senior 3 · Activation & Onboarding Review (product_events) -----------------
  // The spine: every number in this dataset is wrong the first time you compute it, and
  // each day teaches a different reason why. Monday the window is partial. Tuesday the
  // funnel is not a funnel, because a third of users were invited into a workspace that
  // already existed. Wednesday an event fires twice. Thursday the company's own staff are
  // in the numbers. Friday activation and retention disagree about which channel is good,
  // and the learner has to say which one they would act on.

  'ac-101': {
    title: 'Read the window before the numbers',
    hint: "Look at the newest rows in every table before you compute anything from them.",
    brief: "Maya has asked why signups collapsed in June. Before answering, establish what period this export actually covers — the answer to her question is mostly in that.",
    tool: 'choice', datasetKey: 'product_events',
    choice: {
      exhibit: {
        kind: 'email', from: 'Maya Iyer', subject: 'June — what happened?',
        body: "Pulled the signup numbers this morning and June is 48 against May's 140. That is a two-thirds drop in a month and nobody upstairs knows why.\n\nI need to take something to the product review on Friday. Can you find out what broke?",
      },
      prompt: 'Tick everything that follows from the data as it stands.',
      options: [
        { key: 'partial', correct: true, label: 'June is not a full month — the data stops on the 12th', why: 'Twelve days against thirty-one. Comparing the totals compares a fortnight with a month, which is the whole of her two-thirds drop.' },
        { key: 'rate', correct: true, label: 'The comparison has to be a daily rate, not a monthly total', why: 'Four signups a day in June against 4.52 in May. That is a real dip and worth a sentence, but it is not a collapse and it is not what she was told.' },
        { key: 'sayso', correct: true, label: 'Every chart from this data needs the cut-off stated on it', why: 'The partial month will be re-read as a cliff by everyone who sees it without the caveat, including Maya, who already has.' },
        { key: 'broke', correct: false, label: 'Something broke in the signup flow in June', why: 'Nothing in the data suggests that, and going looking for a cause before checking the window is how an artefact becomes an incident.' },
        { key: 'exclude', correct: false, label: 'Drop June entirely so the trend is clean', why: 'Twelve days of real signups are real. Dropping them hides the mild dip that IS there, and hiding data to make a chart tidy is how you lose the right to be believed.' },
        { key: 'annualise', correct: false, label: 'Scale June up to thirty days so it is comparable', why: 'Tempting and defensible for a rate, but presenting an invented 120 as if it were a count puts a number in the deck that never happened. Give the rate and say it is a rate.' },
      ],
      skills: { businessLogic: 100, communication: 90 },
    },
    estHours: 0.3, priority: 'high', dueInDays: 1, day: 1, difficulty: 'hard',
  },

  'ac-102': {
    title: 'Signups by month, and by day',
    hint: "The daily rate is the count divided by the days that actually elapsed, and June's is not 30.",
    brief: "Put the shape of it on paper. Write ONE SQL SELECT returning, per signup month: the number of signups, the last calendar day seen in that month, and signups per elapsed day rounded to two places. Oldest month first.",
    referenceSql: "SELECT substr(signup_at, 1, 7) AS month, COUNT(*) AS signups, MAX(substr(signup_at, 9, 2)) AS last_day, ROUND(COUNT(*) * 1.0 / CAST(MAX(substr(signup_at, 9, 2)) AS INTEGER), 2) AS per_day FROM users GROUP BY month ORDER BY month",
    datasetKey: 'product_events', tool: 'sql', estHours: 0.5, priority: 'high', dueInDays: 1, day: 1, difficulty: 'hard',
  },

  'ac-103': {
    title: 'Where they came from',
    hint: "A plain GROUP BY. You will need this split again on Friday, so get the names right now.",
    brief: "Write ONE SQL SELECT returning the number of signups per acquisition channel, and each channel's share of all signups as a percentage rounded to one place. Biggest channel first.",
    referenceSql: "SELECT channel, COUNT(*) AS signups, ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM users), 1) AS pct FROM users GROUP BY channel ORDER BY signups DESC",
    datasetKey: 'product_events', tool: 'sql', estHours: 0.3, priority: 'normal', dueInDays: 1, day: 1, difficulty: 'medium',
  },

  'ac-104': {
    title: 'Two kinds of signup',
    hint: "invited_by_user_id is NULL for people who arrived on their own. That column decides most of tomorrow.",
    brief: "Not everyone who signs up is starting a workspace — some are joining one. Write ONE SQL SELECT returning the number of users of each kind, labelling them self_serve and invited.",
    referenceSql: "SELECT CASE WHEN invited_by_user_id IS NULL THEN 'self_serve' ELSE 'invited' END AS kind, COUNT(*) AS users FROM users GROUP BY kind ORDER BY users DESC",
    datasetKey: 'product_events', tool: 'sql', estHours: 0.35, priority: 'high', dueInDays: 2, day: 1, difficulty: 'medium',
  },

  'ac-105': {
    title: 'What you now know about June',
    hint: "You have the monthly counts and the daily rates side by side. Read both rows.",
    brief: "Before you write to Maya, be clear in your own head about what the June number is and is not.",
    tool: 'choice', datasetKey: 'product_events',
    choice: {
      prompt: 'Tick everything your own query supports.',
      options: [
        { key: 'notcollapse', correct: true, label: 'The two-thirds drop is an artefact of an incomplete month', why: '48 signups over 12 days. The month is not over; the data simply stops.' },
        { key: 'mild', correct: true, label: 'There IS a small real dip — about 4.0 a day against 4.5', why: 'Roughly 11% down on May. Worth a line, not worth an investigation, and saying so protects your credibility when something real does break.' },
        { key: 'growth', correct: true, label: 'The underlying trend to May is growth, not decline', why: '2.84 a day in January rising to 4.52 in May. The panic is about the one month that cannot be read.' },
        { key: 'worst', correct: false, label: 'June is the worst month in the data on a per-day basis', why: 'It is the third best of six. January, February and March are all below it.' },
        { key: 'seasonal', correct: false, label: 'The dip is seasonal', why: 'Six months of data covering one summer cannot establish seasonality. That would need the same month a year earlier and it does not exist here.' },
        { key: 'sample', correct: false, label: 'Twelve days is too few to say anything at all', why: 'Forty-eight signups is a perfectly usable sample for a daily rate. The problem was never the sample size, it was the denominator.' },
      ],
      skills: { businessLogic: 100, statistics: 90 },
    },
    estHours: 0.3, priority: 'high', dueInDays: 2, day: 1, difficulty: 'medium',
  },

  'ac-106': {
    title: 'Answer Maya today',
    hint: "She has a meeting on Friday and a wrong number in her head right now. Fix the number first.",
    brief: "Write back before the end of day one. She believes signups fell by two-thirds. Tell her what actually happened, and do not oversell the good news either. Under 150 words.",
    tool: 'writeup', datasetKey: 'product_events',
    writeup: {
      to: 'Maya Iyer', subject: 'June signups — the number is a window, not a cliff', maxWords: 150,
      prompt: 'What the June figure really is, the honest version of the trend, and what you would put in her Friday pack.',
      rubric: [
        { key: 'partial', label: 'That June is a partial month', markers: ['partial|incomplete|12 day|twelve day|12th|cut.?off|stops|half a month|not a full'], why: 'This is the entire answer to her question and it belongs in the first sentence.' },
        { key: 'rate', label: 'The daily-rate comparison, with numbers', markers: ['per day|a day|daily|4\\.0|4\\.5|rate'], why: 'Replacing a wrong number with no number leaves her with nothing to say on Friday.' },
        { key: 'dip', label: 'That there is a small genuine dip, not nothing', markers: ['dip|slight|small|modest|11%|down a little|softer|slower'], why: 'Overcorrecting to "everything is fine" is the same failure as the panic, pointing the other way.' },
        { key: 'trend', label: 'The real trend through to May', markers: ['grow|rising|rose|up|increase|trend|doubl'], why: 'The context that makes the June number readable at all.' },
        { key: 'caveat', label: 'That the cut-off must be shown on anything she presents', markers: ['label|caveat|footnote|state|mark|show the|note the|annotat'], why: 'Without it the same misreading happens again in the room, and this time with your chart on the screen.' },
      ],
      skills: { communication: 100, businessLogic: 90 },
    },
    estHours: 0.4, priority: 'high', dueInDays: 2, day: 1, difficulty: 'medium',
  },

  'ac-110': {
    title: 'The funnel, as everyone computes it',
    hint: "Count users, not rows. You will find out on Wednesday why that matters more than you think.",
    brief: "Start the activation analysis. Write ONE SQL SELECT returning, for each of the five funnel events, the number of DISTINCT users who fired it. Most users first.",
    referenceSql: "SELECT name, COUNT(DISTINCT user_id) AS users FROM events WHERE name IN ('signup_completed', 'workspace_created', 'data_connected', 'first_report_run', 'invited_teammate') GROUP BY name ORDER BY users DESC",
    datasetKey: 'product_events', tool: 'sql', estHours: 0.4, priority: 'high', dueInDays: 2, day: 2, difficulty: 'medium',
  },

  'ac-111': {
    title: 'Step over step',
    hint: "Divide each step by the one before it. Do not fix what comes out — bring it to the stand-up as it is.",
    brief: "Turn those counts into conversion rates. Write ONE SQL SELECT returning three rows labelled workspace_per_signup, connected_per_workspace and report_per_connected, each the percentage of the previous step, rounded to one place, in that order.",
    referenceSql: "WITH s AS (SELECT name, COUNT(DISTINCT user_id) AS u FROM events WHERE name IN ('signup_completed', 'workspace_created', 'data_connected', 'first_report_run') GROUP BY name) SELECT 'workspace_per_signup' AS step, ROUND((SELECT u FROM s WHERE name = 'workspace_created') * 100.0 / (SELECT u FROM s WHERE name = 'signup_completed'), 1) AS pct UNION ALL SELECT 'connected_per_workspace', ROUND((SELECT u FROM s WHERE name = 'data_connected') * 100.0 / (SELECT u FROM s WHERE name = 'workspace_created'), 1) UNION ALL SELECT 'report_per_connected', ROUND((SELECT u FROM s WHERE name = 'first_report_run') * 100.0 / (SELECT u FROM s WHERE name = 'data_connected'), 1)",
    datasetKey: 'product_events', tool: 'sql', estHours: 0.55, priority: 'high', dueInDays: 3, day: 2, difficulty: 'hard',
  },

  'ac-112': {
    title: 'A step converted at 114%',
    hint: "More people did the second thing than did the first. Ask how that is possible rather than how to hide it.",
    brief: "Your middle step says 114.5%. That is not a rounding problem. Work out what it means before you touch the query.",
    tool: 'choice', datasetKey: 'product_events',
    choice: {
      prompt: 'Tick everything that is true of a funnel step above 100%.',
      options: [
        { key: 'notfunnel', correct: true, label: 'These steps are not a sequence everybody passes through', why: 'A funnel assumes one ordered path. Above 100% is the data telling you that assumption is false — which is information, not an error.' },
        { key: 'skip', correct: true, label: 'Some users reached data_connected without ever creating a workspace', why: '364 connected against 318 who created one. At least 46 people had a workspace they did not make.' },
        { key: 'schema', correct: true, label: 'The explanation should be findable in the schema', why: 'users.invited_by_user_id exists for exactly this reason. A person invited into somebody else\'s workspace never creates one.' },
        { key: 'cap', correct: false, label: 'Cap the step at 100% so the chart reads sensibly', why: 'That deletes the single most interesting fact in the dataset to make a rectangle look tidy.' },
        { key: 'dedupe', correct: false, label: 'It is duplicate rows — count distinct users instead', why: 'You already counted distinct users. There is a duplicate-row problem in here and you will find it tomorrow, but it is not this.' },
        { key: 'broken', correct: false, label: 'The event tracking is broken and the data cannot be used', why: 'The tracking is fine. The model you laid over it was wrong, and that is a much cheaper thing to fix.' },
      ],
      skills: { businessLogic: 100, statistics: 90 },
    },
    estHours: 0.35, priority: 'high', dueInDays: 3, day: 2, difficulty: 'hard',
  },

  'ac-113': {
    title: 'Prove where they came from',
    hint: "Build a set of user_ids per event name once, then test membership. Do not loop the events table four times.",
    brief: "Confirm the explanation rather than assuming it. In the notebook, compute for self_serve and invited users separately: how many users there are, and how many of them fired workspace_created, data_connected and first_report_run. Assign a list of dicts with keys kind, users, workspace, connected and activated to `result`, sorted by kind.",
    tool: 'python', datasetKey: 'product_events',
    estHours: 0.7, priority: 'high', dueInDays: 3, day: 2, difficulty: 'hard',
    referenceCompute: (tables) => {
      const fired = new Map();
      for (const e of tables.events) {
        if (!fired.has(e.name)) fired.set(e.name, new Set());
        fired.get(e.name).add(e.user_id);
      }
      const has = (name, id) => (fired.get(name) || new Set()).has(id);
      const out = new Map();
      for (const u of tables.users) {
        const kind = u.invited_by_user_id == null ? 'self_serve' : 'invited';
        if (!out.has(kind)) out.set(kind, { kind, users: 0, workspace: 0, connected: 0, activated: 0 });
        const row = out.get(kind);
        row.users += 1;
        if (has('workspace_created', u.id)) row.workspace += 1;
        if (has('data_connected', u.id)) row.connected += 1;
        if (has('first_report_run', u.id)) row.activated += 1;
      }
      return [...out.values()].sort((a, b) => (a.kind < b.kind ? -1 : 1));
    },
  },

  'ac-114': {
    title: 'The funnel that is actually a funnel',
    hint: "One population, one ordered path. Everyone in it had to create a workspace to get anywhere.",
    brief: "Rebuild it properly. Write ONE SQL SELECT over SELF-SERVE users only, returning one row per funnel stage — labelled signups, workspace, connected and activated — with the number of users who reached it. Keep them in funnel order, most users first.",
    referenceSql: "SELECT 'signups' AS stage, COUNT(*) AS users FROM users WHERE invited_by_user_id IS NULL UNION ALL SELECT 'workspace', COUNT(*) FROM users u WHERE u.invited_by_user_id IS NULL AND EXISTS (SELECT 1 FROM events e WHERE e.user_id = u.id AND e.name = 'workspace_created') UNION ALL SELECT 'connected', COUNT(*) FROM users u WHERE u.invited_by_user_id IS NULL AND EXISTS (SELECT 1 FROM events e WHERE e.user_id = u.id AND e.name = 'data_connected') UNION ALL SELECT 'activated', COUNT(*) FROM users u WHERE u.invited_by_user_id IS NULL AND EXISTS (SELECT 1 FROM events e WHERE e.user_id = u.id AND e.name = 'first_report_run')",
    datasetKey: 'product_events', tool: 'sql', estHours: 0.6, priority: 'high', dueInDays: 3, day: 2, difficulty: 'hard',
  },

  'ac-115': {
    title: 'What the split actually revealed',
    hint: "Compare the two populations on the last column, not just the first.",
    brief: "Splitting the funnel fixed the impossible number. It also turned up something nobody asked for.",
    tool: 'choice', datasetKey: 'product_events',
    choice: {
      prompt: 'Tick everything your two queries support.',
      options: [
        { key: 'clean', correct: true, label: 'The self-serve funnel is monotonic and readable: 420, 318, 207, 134', why: 'Every step smaller than the one before, one population throughout. That is a funnel.' },
        { key: 'invitedbetter', correct: true, label: 'Invited users activate at roughly twice the rate of self-serve ones', why: '112 of 184 against 134 of 420 — about 61% against 32%. Landing in a workspace where the data is already connected is a real head start.' },
        { key: 'nowork', correct: true, label: 'Not one invited user fired workspace_created', why: 'Zero out of 184, which is what makes the invite path a genuinely different journey rather than a variation on the same one.' },
        { key: 'biggest', correct: false, label: 'The biggest self-serve drop-off is at data_connected', why: '318 to 207 is a loss of 111; 420 to 318 is a loss of 102 — but as a rate, workspace creation loses 24% and connection loses 35%. Say which measure you mean.' },
        { key: 'invitemore', correct: false, label: 'We should convert self-serve signups into invited ones', why: 'You cannot invite somebody into a workspace that does not exist yet. The two populations are not interchangeable and the comparison does not imply a lever.' },
        { key: 'causal', correct: false, label: 'Being invited causes higher activation', why: 'Invited users join workspaces someone already cared enough to set up. The selection is doing work here and the data cannot separate the two.' },
      ],
      skills: { businessLogic: 100, statistics: 100 },
    },
    estHours: 0.35, priority: 'high', dueInDays: 3, day: 2, difficulty: 'hard',
  },

  'ac-120': {
    title: 'Rows against people',
    hint: "COUNT(*) and COUNT(DISTINCT user_id) on the same events. If they differ, somebody fired twice.",
    brief: "Before the funnel goes anywhere near a deck, check the raw event counts. Write ONE SQL SELECT returning, for each funnel event: the row count, the distinct user count, and the difference. Biggest difference first.",
    referenceSql: "SELECT name, COUNT(*) AS rows_, COUNT(DISTINCT user_id) AS users_, COUNT(*) - COUNT(DISTINCT user_id) AS extra FROM events WHERE name IN ('signup_completed', 'workspace_created', 'data_connected', 'first_report_run', 'invited_teammate') GROUP BY name ORDER BY extra DESC",
    datasetKey: 'product_events', tool: 'sql', estHours: 0.4, priority: 'high', dueInDays: 3, day: 3, difficulty: 'medium',
  },

  'ac-121': {
    title: 'Nobody signs up twice',
    hint: "One of those five events is logically impossible to repeat. Start there.",
    brief: "670 signup_completed rows against 604 users. Work out what that tells you before you go looking for the cause.",
    tool: 'choice', datasetKey: 'product_events',
    choice: {
      prompt: 'Tick everything that follows.',
      options: [
        { key: 'impossible', correct: true, label: 'signup_completed repeating is impossible in the real world, so it is a tracking fault', why: 'You cannot complete your own signup twice. Any event with a natural once-per-user meaning is a free integrity check, and this one just failed.' },
        { key: 'allfive', correct: true, label: 'All five events are affected, so it is not specific to one step', why: '66, 35, 33, 24 and 5 extra rows. A bug that hits every event equally is a client or transport problem, not a product one.' },
        { key: 'countdistinct', correct: true, label: 'Every rate computed from COUNT(*) is overstated', why: 'Yesterday you used COUNT(DISTINCT user_id) and were right by luck as much as judgement. Now you know why it is the rule.' },
        { key: 'retry', correct: false, label: 'Users retried because the product was slow', why: 'A plausible story, and testable — but it would not duplicate signup_completed for people who only ever loaded the page once. Find the pattern before writing the narrative.' },
        { key: 'dedupe', correct: false, label: 'Deduplicate the table and move on', why: 'That fixes your query and leaves the bug in production, still corrupting every number anyone else pulls. Find its shape first so it can be reported.' },
        { key: 'ignore', correct: false, label: 'The difference is small enough to ignore', why: '66 phantom signups is 11% of the month-one funnel. It is also a live bug, and its size today is not its size next month.' },
      ],
      skills: { businessLogic: 100, communication: 80 },
    },
    estHours: 0.35, priority: 'urgent', dueInDays: 3, day: 3, difficulty: 'hard',
  },

  'ac-122': {
    title: 'Find the shape of the bug',
    hint: "Events belong to sessions, and sessions know their platform and app version. Join and group by both.",
    brief: "Locate it. Write ONE SQL SELECT joining funnel events to their sessions, returning per platform and app_version: the row count, the number of distinct user-and-event pairs, and rows divided by pairs rounded to two places. Worst ratio first.",
    referenceSql: "SELECT s.platform, s.app_version, COUNT(*) AS rows_, COUNT(DISTINCT e.user_id || '|' || e.name) AS steps, ROUND(COUNT(*) * 1.0 / COUNT(DISTINCT e.user_id || '|' || e.name), 2) AS rows_per_step FROM events e JOIN sessions s ON s.id = e.session_id WHERE e.name IN ('signup_completed', 'workspace_created', 'data_connected', 'first_report_run', 'invited_teammate') GROUP BY s.platform, s.app_version ORDER BY rows_per_step DESC, rows_ DESC",
    datasetKey: 'product_events', tool: 'sql', estHours: 0.7, priority: 'urgent', dueInDays: 4, day: 3, difficulty: 'hard',
  },

  'ac-123': {
    title: 'Scope it for the engineer',
    hint: "An engineer needs the blast radius and the window, not an adjective.",
    brief: "You know which build it is. Now size it. Write ONE SQL SELECT returning one row: how many distinct users fired a duplicated funnel event on mobile 4.3.0, how many surplus rows that produced, and the first and last date ANY mobile 4.3.0 session was seen. Label them users_affected, duplicate_rows, first_seen and last_seen.",
    referenceSql: "SELECT (SELECT COUNT(DISTINCT e.user_id) FROM events e JOIN sessions s2 ON s2.id = e.session_id WHERE s2.platform <> 'web' AND s2.app_version = '4.3.0' AND e.name IN ('signup_completed', 'workspace_created', 'data_connected', 'first_report_run', 'invited_teammate')) AS users_affected, (SELECT COUNT(*) - COUNT(DISTINCT e.user_id || '|' || e.name) FROM events e JOIN sessions s3 ON s3.id = e.session_id WHERE s3.platform <> 'web' AND s3.app_version = '4.3.0' AND e.name IN ('signup_completed', 'workspace_created', 'data_connected', 'first_report_run', 'invited_teammate')) AS duplicate_rows, MIN(substr(s.started_at, 1, 10)) AS first_seen, MAX(substr(s.started_at, 1, 10)) AS last_seen FROM sessions s WHERE s.platform <> 'web' AND s.app_version = '4.3.0'",
    datasetKey: 'product_events', tool: 'sql', estHours: 0.6, priority: 'urgent', dueInDays: 4, day: 3, difficulty: 'hard',
  },

  'ac-124': {
    title: 'What the version numbers tell you',
    hint: "Look at when 4.3.0 stops and what replaces it. The fix may already have shipped.",
    brief: "You have the version timeline. Read what it says about the state of the bug today.",
    tool: 'choice', datasetKey: 'product_events',
    choice: {
      prompt: 'Tick everything the data supports.',
      options: [
        { key: 'both', correct: true, label: 'It affects iOS and Android equally, at exactly 2.00 rows per step', why: 'Both mobile platforms, both exactly double, web untouched. That points at shared mobile code, which is a useful thing for an engineer to be told.' },
        { key: 'window', correct: true, label: 'It is bounded: 6 April to 10 May, then 4.3.1 appears', why: 'The last 4.3.0 session is 10 May and 4.3.1 starts on the 11th. Whether or not anyone knew, the bug stopped shipping a month ago.' },
        { key: 'history', correct: true, label: 'Historical numbers still need correcting even though it is fixed', why: 'Five weeks of inflated events sit in every dashboard anyone has built. A fix forward does not repair the backward record.' },
        { key: 'live', correct: false, label: 'It is still corrupting data today', why: 'No 4.3.0 session exists after 10 May. Reporting a live incident that ended five weeks ago would cost you the next one.' },
        { key: 'web', correct: false, label: 'Web is affected too but less severely', why: 'Every web version sits at exactly 1.00. Not less severe — absent.' },
        { key: 'nofix', correct: false, label: 'Nothing needs reporting since 4.3.1 fixed it', why: 'Somebody fixed a symptom in a release. Whether they knew what it was doing to the analytics is a different question, and the corrupted history is nobody\'s job until you make it somebody\'s.' },
      ],
      skills: { businessLogic: 100, communication: 90 },
    },
    estHours: 0.35, priority: 'high', dueInDays: 4, day: 3, difficulty: 'hard',
  },

  'ac-125': {
    title: 'Report it to Rohan',
    hint: "Lead with the window and the blast radius. He will ask both in his first reply if you do not.",
    brief: "Rohan runs the mobile team. Write him the bug report: what you found, how big it is, when it happened, and what you want him to do about it. Under 160 words.",
    tool: 'writeup', datasetKey: 'product_events',
    writeup: {
      to: 'Rohan Desai', subject: 'Mobile 4.3.0 is double-firing funnel events', maxWords: 160,
      prompt: 'The fault, its exact scope, the fact that it appears already fixed, and the ask.',
      rubric: [
        { key: 'what', label: 'What the fault is', markers: ['twice|double|duplicat|two rows|2 rows|fires again|repeat'], why: 'One sentence, no preamble. He triages a queue.' },
        { key: 'where', label: 'Pinned to mobile 4.3.0 specifically', markers: ['4\\.3\\.0|ios and android|mobile'], why: 'Without the version he has to reproduce it himself, which is a week you do not need to spend.' },
        { key: 'when', label: 'The window, and that 4.3.1 appears to end it', markers: ['4\\.3\\.1|6 april|10 may|april|may|window|five week|5 week|already fixed|no longer'], why: 'Telling him it is live when it is not turns a data-quality ticket into a false alarm.' },
        { key: 'size', label: 'The blast radius in numbers', markers: ['89|163|users affected|duplicate row'], why: 'Scope is what decides whether this is looked at today or in the next cycle, and it is the part only you can supply.' },
        { key: 'ask', label: 'A specific ask', markers: ['confirm|backfill|correct|clean|reprocess|flag|whether|can you|could you'], why: 'A report with no ask gets filed. Name the thing you want: usually confirmation of the cause and a decision on the historical data.' },
      ],
      skills: { communication: 100, businessLogic: 90 },
    },
    estHours: 0.45, priority: 'urgent', dueInDays: 4, day: 3, difficulty: 'hard',
  },

  'ac-130': {
    title: 'Who else is in this table',
    hint: "Look at the email domains. One of them is not a customer.",
    brief: "Before Friday's recommendation, establish who the population actually is. Write ONE SQL SELECT returning, for staff (email_domain meridiansystems.com) and customers separately: the number of users, the number of sessions, and sessions per user rounded to two places.",
    referenceSql: "SELECT CASE WHEN u.email_domain = 'meridiansystems.com' THEN 'staff' ELSE 'customer' END AS seg, COUNT(DISTINCT u.id) AS users, COUNT(s.id) AS sessions, ROUND(COUNT(s.id) * 1.0 / COUNT(DISTINCT u.id), 2) AS sessions_per_user FROM users u LEFT JOIN sessions s ON s.user_id = u.id GROUP BY seg ORDER BY seg",
    datasetKey: 'product_events', tool: 'sql', estHours: 0.45, priority: 'high', dueInDays: 4, day: 4, difficulty: 'medium',
  },

  'ac-131': {
    title: 'What they are doing to the average',
    hint: "Compute activation twice — once over everybody, once over customers only — and put the two side by side.",
    brief: "Quantify the distortion rather than asserting it. Write ONE SQL SELECT returning two rows labelled 'all users' and 'customers only', each with the user count and the activation rate as a percentage rounded to one place. Activation means having fired first_report_run.",
    referenceSql: "SELECT 'all users' AS scope, COUNT(*) AS users, ROUND(AVG(CASE WHEN EXISTS (SELECT 1 FROM events e WHERE e.user_id = u.id AND e.name = 'first_report_run') THEN 1.0 ELSE 0.0 END) * 100, 1) AS activation FROM users u UNION ALL SELECT 'customers only', COUNT(*), ROUND(AVG(CASE WHEN EXISTS (SELECT 1 FROM events e WHERE e.user_id = u.id AND e.name = 'first_report_run') THEN 1.0 ELSE 0.0 END) * 100, 1) FROM users u WHERE u.email_domain <> 'meridiansystems.com'",
    datasetKey: 'product_events', tool: 'sql', estHours: 0.55, priority: 'high', dueInDays: 4, day: 4, difficulty: 'hard',
  },

  'ac-132': {
    title: 'Thirty-one people, a quarter of the sessions',
    hint: "Judge the size of the effect on each metric separately. It is not the same everywhere.",
    brief: "Staff are 5% of the users and 1,144 of the 4,664 sessions. Decide what that means for the rest of the analysis.",
    tool: 'choice', datasetKey: 'product_events',
    choice: {
      prompt: 'Tick everything that is true.',
      options: [
        { key: 'exclude', correct: true, label: 'They should be excluded from every customer-behaviour metric', why: 'They are not customers, they never churn, and they use it six times as much. Any engagement number that includes them describes the company, not the market.' },
        { key: 'sessions', correct: true, label: 'The distortion is far worse for session metrics than for activation', why: 'Activation moves 40.7% to 37.7% — three points. Sessions per user is 36.9 against 6.14. The same contamination is nearly invisible in one metric and dominant in another.' },
        { key: 'say', correct: true, label: 'The exclusion has to be stated wherever the numbers appear', why: 'An unexplained filter is indistinguishable from a mistake to the next person who reruns your query and gets a different answer.' },
        { key: 'keep', correct: false, label: 'Keep them — more data is better', why: 'More of the wrong population is worse, not better. Volume does not fix a definition problem.' },
        { key: 'small', correct: false, label: 'At 5% of users they cannot move anything much', why: 'This is the exact intuition the session figure disproves. Five percent of users producing a quarter of the sessions moves any per-session average a long way.' },
        { key: 'dogfood', correct: false, label: 'Their usage is the best signal we have of what power users do', why: 'They built it, they have no alternative, and their incentives are not a customer\'s. It is the least representative behaviour in the table, not the most.' },
      ],
      skills: { businessLogic: 100, statistics: 100 },
    },
    estHours: 0.35, priority: 'high', dueInDays: 5, day: 4, difficulty: 'hard',
  },

  'ac-133': {
    title: 'Sessions where nothing happened',
    hint: "SQLite has no median, which is the reason this one is in the notebook. Sort the durations yourself and take the middle, remembering the even-length case.",
    brief: "Somebody is about to claim mobile users are less engaged. Check it properly. In the notebook, compute for web and mobile separately: total sessions, how many lasted zero seconds, that as a percentage, the mean duration over all sessions, the mean over only those longer than zero, and the MEDIAN over those longer than zero. Round every figure to one decimal place. Assign a list of dicts with keys grp, sessions, zero, zero_pct, avg_all, avg_real and median_real to `result`, sorted by grp.",
    tool: 'python', datasetKey: 'product_events',
    estHours: 0.8, priority: 'high', dueInDays: 5, day: 4, difficulty: 'hard',
    referenceCompute: (tables) => {
      const by = new Map();
      for (const s of tables.sessions) {
        const grp = s.platform === 'web' ? 'web' : 'mobile';
        if (!by.has(grp)) by.set(grp, []);
        by.get(grp).push(s.duration_seconds);
      }
      const r1 = (n) => Math.round(n * 10) / 10;
      const median = (xs) => {
        const a = [...xs].sort((p, q) => p - q);
        const m = Math.floor(a.length / 2);
        return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
      };
      return [...by.entries()]
        .map(([grp, all]) => {
          const real = all.filter((d) => d > 0);
          return {
            grp,
            sessions: all.length,
            zero: all.length - real.length,
            zero_pct: r1((all.length - real.length) * 100 / all.length),
            avg_all: r1(all.reduce((s, d) => s + d, 0) / all.length),
            avg_real: r1(real.reduce((s, d) => s + d, 0) / real.length),
            median_real: r1(median(real)),
          };
        })
        .sort((a, b) => (a.grp < b.grp ? -1 : 1));
    },
  },

  'ac-134': {
    title: 'The mobile engagement gap',
    hint: "Compare avg_all across the two rows, then compare avg_real. The two comparisons disagree.",
    brief: "Mobile averages 540 seconds against web's 625 — until you drop the sessions that recorded nothing. Say what is actually true.",
    tool: 'choice', datasetKey: 'product_events',
    choice: {
      prompt: 'Tick everything your own numbers support.',
      options: [
        { key: 'artefact', correct: true, label: 'The apparent 14% gap is entirely a measurement artefact', why: 'Excluding zero-length sessions, mobile is 718 seconds against web\'s 703 — mobile is marginally the longer of the two. The sign of the finding flips.' },
        { key: 'bounce', correct: true, label: 'Mobile records far more zero-length sessions: 24.8% against 11.1%', why: 'The beacon fires on load and the user leaves. Twice as often on a phone, which is exactly what you would expect and precisely why it is not an engagement finding.' },
        { key: 'median', correct: true, label: 'The median agrees with the mean once zeros are out — 550 seconds against 535', why: 'Worth checking, because a mean can be dragged by a handful of very long sessions. Here both measures say the same thing, which is what lets you state it without hedging.' },
        { key: 'separate', correct: true, label: 'Mobile activation being poor is a separate, real problem', why: '19.2% against 53.2% is not an artefact. Two different mobile stories live in this dataset and conflating them would lose the true one inside the false one.' },
        { key: 'lessengaged', correct: false, label: 'Mobile users are less engaged once they are in the product', why: 'This is the claim the second average refutes. Once they are genuinely in a session they stay marginally longer.' },
        { key: 'drop', correct: false, label: 'Zero-length sessions are junk and should be deleted', why: 'They are a real signal about how people arrive and bounce. Exclude them from duration averages, keep them for anything about acquisition.' },
        { key: 'nothing', correct: false, label: 'There is no mobile problem here at all', why: 'Over-correcting is the mirror of the original error. Mobile activates at a third of web\'s rate, and that is Friday\'s recommendation.' },
      ],
      skills: { statistics: 100, businessLogic: 100 },
    },
    estHours: 0.4, priority: 'high', dueInDays: 5, day: 4, difficulty: 'hard',
  },

  'ac-135': {
    title: 'Activation by platform, cleanly',
    hint: "Customers only, mobile means not-web, and activation means the event exists.",
    brief: "Put the real platform finding on the table. Write ONE SQL SELECT over CUSTOMERS ONLY returning, for web and mobile: the number of users and the activation rate as a percentage rounded to one place.",
    referenceSql: "SELECT CASE WHEN u.primary_platform = 'web' THEN 'web' ELSE 'mobile' END AS grp, COUNT(*) AS users, ROUND(AVG(CASE WHEN EXISTS (SELECT 1 FROM events e WHERE e.user_id = u.id AND e.name = 'first_report_run') THEN 1.0 ELSE 0.0 END) * 100, 1) AS activation FROM users u WHERE u.email_domain <> 'meridiansystems.com' GROUP BY grp ORDER BY activation DESC",
    datasetKey: 'product_events', tool: 'sql', estHours: 0.5, priority: 'high', dueInDays: 5, day: 4, difficulty: 'medium',
  },

  'ac-140': {
    title: 'Which channel activates best',
    hint: "Customers only. You are ranking channels, so the order of the rows is the answer.",
    brief: "Friday is the recommendation. Start with acquisition. Write ONE SQL SELECT over CUSTOMERS ONLY returning, per channel: the number of users and the activation rate as a percentage rounded to one place. Best activating channel first.",
    referenceSql: "SELECT u.channel, COUNT(*) AS users, ROUND(AVG(CASE WHEN EXISTS (SELECT 1 FROM events e WHERE e.user_id = u.id AND e.name = 'first_report_run') THEN 1.0 ELSE 0.0 END) * 100, 1) AS activation FROM users u WHERE u.email_domain <> 'meridiansystems.com' GROUP BY u.channel ORDER BY activation DESC",
    datasetKey: 'product_events', tool: 'sql', estHours: 0.45, priority: 'high', dueInDays: 5, day: 5, difficulty: 'medium',
  },

  'ac-141': {
    title: 'Which channel stays',
    hint: "A user is retained in week four if they had a session between 28 and 35 days after signing up. Stop at the April cohort so every user has had the chance.",
    brief: "Activation is not the only measure of a good channel. Write ONE SQL SELECT over CUSTOMERS ONLY who signed up in or before April, returning per channel: the number of users and the percentage who had a session between 28 and 35 days after their signup date, rounded to one place. Best retaining channel first.",
    referenceSql: "SELECT u.channel, COUNT(*) AS users, ROUND(AVG(CASE WHEN EXISTS (SELECT 1 FROM sessions s WHERE s.user_id = u.id AND julianday(s.started_at) - julianday(substr(u.signup_at, 1, 10)) >= 28 AND julianday(s.started_at) - julianday(substr(u.signup_at, 1, 10)) < 35) THEN 1.0 ELSE 0.0 END) * 100, 1) AS wk4 FROM users u WHERE u.email_domain <> 'meridiansystems.com' AND substr(u.signup_at, 1, 7) <= '2026-04' GROUP BY u.channel ORDER BY wk4 DESC",
    datasetKey: 'product_events', tool: 'sql', estHours: 0.8, priority: 'high', dueInDays: 5, day: 5, difficulty: 'hard',
    // Deliberately flagged for rework: Asha accepts the ranking and then asks whether it
    // holds once the censored cohorts come out, which is the same query with a tighter
    // window. Being asked for the same thing twice, slightly differently, is the job.
    rework: true,
  },

  'ac-142': {
    title: 'The two rankings disagree',
    hint: "Find the channel that moves furthest between the two lists, and ask which metric the business actually pays for.",
    brief: "Your activation ranking and your retention ranking are not the same ranking. That disagreement is the most useful thing you have found this week.",
    tool: 'choice', datasetKey: 'product_events',
    choice: {
      prompt: 'Tick everything the two tables support.',
      options: [
        { key: 'paid', correct: true, label: 'Paid search activates respectably and then retains worst of all', why: '38.7% activation — third of five — against 14.8% week-four retention, last by a wide margin. It is the clearest disagreement in the data.' },
        { key: 'partner', correct: true, label: 'Partner is strongest on both and is the smallest channel', why: 'Top of the activation table at 50% and top of the retention table at 39.3%, on the fewest users of any channel. Best on both measures and barely being used.' },
        { key: 'wrongmetric', correct: true, label: 'Judging channels on activation alone would rank paid search too highly', why: 'Which is the point: activation measures whether onboarding worked, not whether the user was worth acquiring. They are different questions.' },
        { key: 'kill', correct: false, label: 'Stop spending on paid search', why: 'It is a quarter of all signups. A recommendation that large needs cost-per-acquisition and lifetime value, and neither is in this data.' },
        { key: 'organic', correct: false, label: 'Organic is the weakest channel overall', why: 'It is last on activation but mid-table on retention, and it is the largest channel by volume. Last on one measure is not weakest overall.' },
        { key: 'same', correct: false, label: 'The rankings agree once you allow for sample size', why: 'Paid search has the second-largest sample in the table. Sample size is not what is moving it.' },
      ],
      skills: { businessLogic: 100, statistics: 100 },
    },
    estHours: 0.4, priority: 'high', dueInDays: 5, day: 5, difficulty: 'hard',
  },

  'ac-143': {
    title: 'Retention by cohort',
    hint: "Report how many days the youngest member of each cohort has actually been observed for, beside the retention figure.",
    brief: "Somebody will ask whether retention is getting worse. Write ONE SQL SELECT over CUSTOMERS ONLY returning, per signup month: the number of users, the fewest days any of them has been observed for as at 12 June 2026, and the week-four retention percentage rounded to one place. Oldest cohort first.",
    referenceSql: "SELECT substr(u.signup_at, 1, 7) AS cohort, COUNT(*) AS users, MIN(CAST(julianday('2026-06-12') - julianday(substr(u.signup_at, 1, 10)) AS INTEGER)) AS min_days, ROUND(AVG(CASE WHEN EXISTS (SELECT 1 FROM sessions s WHERE s.user_id = u.id AND julianday(s.started_at) - julianday(substr(u.signup_at, 1, 10)) >= 28 AND julianday(s.started_at) - julianday(substr(u.signup_at, 1, 10)) < 35) THEN 1.0 ELSE 0.0 END) * 100, 1) AS wk4 FROM users u WHERE u.email_domain <> 'meridiansystems.com' GROUP BY cohort ORDER BY cohort",
    datasetKey: 'product_events', tool: 'sql', estHours: 0.75, priority: 'high', dueInDays: 5, day: 5, difficulty: 'hard',
  },

  'ac-144': {
    title: 'Retention is falling off a cliff',
    hint: "Your min_days column is the whole answer. Ask which cohorts could possibly have produced a week-four session.",
    brief: "The cohort table shows week-four retention dropping from 27.9% in April to 14.3% in May to zero in June. Decide what you are looking at.",
    tool: 'choice', datasetKey: 'product_events',
    choice: {
      prompt: 'Tick everything that is true.',
      options: [
        { key: 'censored', correct: true, label: 'June cannot have a week-four figure at all — nobody has been here 28 days', why: 'The youngest June cohort member has been observed for zero days and the oldest for eleven. That zero is not retention, it is arithmetic.' },
        { key: 'maypartial', correct: true, label: 'May is partly censored too, which is why it halves rather than falls to zero', why: 'Only the first fortnight of May signups could reach day 28 before the export. The cohort is a mix of the observed and the unobservable.' },
        { key: 'stopwhere', correct: true, label: 'The chart has to stop at the last fully observed cohort — April', why: 'Jan through April sit between 22.5% and 29.8% with no trend worth reporting. Everything after that is a measurement window, not a behaviour.' },
        { key: 'declining', correct: false, label: 'Retention has been declining since January', why: '29.8, 22.5, 27.3, 27.9. That is noise around a flat line, and February is the low point, not June.' },
        { key: 'urgent', correct: false, label: 'The June collapse needs escalating today', why: 'It is the same mistake as Monday\'s signup panic, one table further in. Twice in one week would be a pattern.' },
        { key: 'impute', correct: false, label: 'Estimate the missing cohorts from the earlier ones', why: 'Then you are reporting your own assumption back to yourself. Leave the cell empty and say why it is empty.' },
      ],
      skills: { statistics: 100, businessLogic: 100 },
    },
    estHours: 0.4, priority: 'high', dueInDays: 5, day: 5, difficulty: 'hard',
  },

  'ac-145': {
    title: 'The recommendation',
    hint: "One recommendation, the reason for it, and the things you are explicitly not claiming. Priya reads the caveats.",
    brief: "Priya runs Product and has to decide where next quarter's onboarding effort goes. Give her the week: what you would change, what the data says, and what it does not. Under 220 words.",
    tool: 'writeup', datasetKey: 'product_events',
    writeup: {
      to: 'Priya Menon', subject: 'Activation review — where the effort should go', maxWords: 220,
      prompt: 'A single clear recommendation, the evidence, and an honest account of the limits.',
      rubric: [
        { key: 'rec', label: 'One specific recommendation', markers: ['mobile|onboarding|partner|recommend|priorit|focus|invest|fix'], why: 'A week of analysis that ends in a list of observations makes the decision somebody else\'s problem.' },
        { key: 'mobile', label: 'The mobile activation gap, with numbers', markers: ['19|53|mobile|platform|third|2\\.7|half'], why: 'The largest real effect you found, and the one with an obvious lever behind it.' },
        { key: 'clean', label: 'That staff were excluded and the funnel split by invite path', markers: ['staff|internal|exclud|meridian|self.serve|invited|invite path'], why: 'Both corrections changed the answer. Stating them is what lets Priya trust the numbers that follow.' },
        { key: 'bug', label: 'The 4.3.0 duplicate and its effect on historical reporting', markers: ['4\\.3\\.0|duplicat|double|bug|inflat'], why: 'She owns dashboards built on the corrupted period. She will hear about it eventually; better from you.' },
        { key: 'limits', label: 'What the data cannot support', markers: ['cannot|can.t|not say|no data|does not|doesn.t|caveat|limit|unable|beyond'], why: 'No cost data, no revenue, censored cohorts. Naming the boundary is what makes the rest of it credible.' },
        { key: 'window', label: 'That the last cohorts are censored, not declining', markers: ['censor|partial|incomplete|window|28 day|not yet|too recent|cut.?off'], why: 'The trap she is most likely to fall into on her own, twice over — signups and retention both.' },
      ],
      skills: { communication: 100, businessLogic: 100, statistics: 90 },
    },
    estHours: 0.7, priority: 'high', dueInDays: 5, day: 5, difficulty: 'hard',
  },


  // ---- Senior 4 · Onboarding Experiment Readout (product_events) -------------------
  // One finding, arrived at four times. Monday the randomisation is broken. Tuesday the
  // naive readout says the new onboarding lost. Wednesday it wins in every segment and
  // the overall number was composition all along. Thursday the learner is handed the
  // means to manufacture any finding they like, and has to not. Friday they write the
  // readout that says the opposite of what the room was told on Tuesday.

  'ex-101': {
    title: 'What you need before reading any result',
    hint: "You have been handed a conclusion. Work out what would have to be true for it to be one.",
    brief: "Priya has the experiment result and wants it written up. Before you compute anything, establish what an experiment readout actually requires.",
    tool: 'choice', datasetKey: 'product_events',
    choice: {
      exhibit: {
        kind: 'email', from: 'Priya Menon', subject: 'onboarding_v2 — write it up please',
        body: "We ran the new onboarding from 1 March to 15 May. I have had the headline from the growth channel: treatment activates at 36% against control's 45%.\n\nSo it lost, and fairly clearly. I need a short readout I can circulate saying we are rolling it back, and ideally why it failed.\n\nCan you have it by Wednesday?",
      },
      prompt: 'Tick everything you should establish before writing a word of that readout.',
      options: [
        { key: 'balance', correct: true, label: 'Whether the two arms are actually comparable', why: 'A difference between arms only measures the change if the arms differ in nothing else. That is the assumption the whole method rests on and it is checkable in one query.' },
        { key: 'window', correct: true, label: 'Whether every assigned user has been observed long enough to activate', why: 'A treatment arm assigned later than control would lose on measurement alone. Cheap to rule out, expensive to miss.' },
        { key: 'who', correct: true, label: 'Who is in the assignment table, including whether staff are', why: 'Same population question as every other week. Eight staff in each arm is balanced, which is luck rather than design.' },
        { key: 'why', correct: false, label: 'Why the new onboarding failed', why: 'She has asked for the cause of a thing you have not yet confirmed happened. Answering that question as framed is how you end up defending a conclusion you never tested.' },
        { key: 'accept', correct: false, label: 'Nothing — the numbers are already computed and they are unambiguous', why: '36 against 45 is unambiguous only about what the raw averages are. It says nothing yet about what caused the difference.' },
        { key: 'rerun', correct: false, label: 'Ask for the experiment to be re-run before commenting', why: 'Ten weeks of data already exist. Read it properly first; a re-run is a recommendation you might reach, not a way to avoid reading.' },
      ],
      skills: { businessLogic: 100, statistics: 100 },
    },
    estHours: 0.35, priority: 'high', dueInDays: 1, day: 1, difficulty: 'hard',
  },

  'ex-102': {
    title: 'What was actually run',
    hint: "Start with the assignment table on its own. You are establishing the shape of the experiment, not its result.",
    brief: "Write ONE SQL SELECT over the assignment table returning, per experiment: how many users were assigned, and the first and last assignment dates. Label them assigned, first_assigned and last_assigned.",
    referenceSql: "SELECT experiment, COUNT(*) AS assigned, MIN(substr(assigned_at, 1, 10)) AS first_assigned, MAX(substr(assigned_at, 1, 10)) AS last_assigned FROM experiment_assignments GROUP BY experiment",
    datasetKey: 'product_events', tool: 'sql', estHours: 0.3, priority: 'high', dueInDays: 1, day: 1, difficulty: 'medium',
  },

  'ex-103': {
    title: 'The two arms',
    hint: "Customers only, same exclusion as every other week. A 50/50 split is what you are checking for.",
    brief: "Write ONE SQL SELECT over CUSTOMERS ONLY returning, per variant: the number of users assigned, and each arm's share of the assigned population as a percentage rounded to one place.",
    referenceSql: "SELECT a.variant, COUNT(*) AS users, ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM experiment_assignments a2 JOIN users u2 ON u2.id = a2.user_id WHERE u2.email_domain <> 'meridiansystems.com'), 1) AS pct FROM experiment_assignments a JOIN users u ON u.id = a.user_id WHERE u.email_domain <> 'meridiansystems.com' GROUP BY a.variant ORDER BY users DESC",
    datasetKey: 'product_events', tool: 'sql', estHours: 0.5, priority: 'high', dueInDays: 1, day: 1, difficulty: 'hard',
  },

  'ex-104': {
    title: 'What each arm is made of',
    hint: "Compare the arms on the one attribute you already know predicts activation. Report each platform as a share OF ITS OWN ARM.",
    brief: "An unequal split is a warning, not a diagnosis. Write ONE SQL SELECT over CUSTOMERS ONLY returning, per variant and platform group (web against mobile): the number of users and that group's percentage of its own arm, rounded to one place.",
    referenceSql: "SELECT a.variant, CASE WHEN u.primary_platform = 'web' THEN 'web' ELSE 'mobile' END AS grp, COUNT(*) AS users, ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (PARTITION BY a.variant), 1) AS pct_of_arm FROM experiment_assignments a JOIN users u ON u.id = a.user_id WHERE u.email_domain <> 'meridiansystems.com' GROUP BY a.variant, grp ORDER BY a.variant, grp",
    datasetKey: 'product_events', tool: 'sql', estHours: 0.8, priority: 'high', dueInDays: 2, day: 1, difficulty: 'hard',
  },

  'ex-105': {
    title: 'This was not a randomised experiment',
    hint: "You know from last week what platform does to activation. Now look at how it is distributed between the arms.",
    brief: "Control is 27.8% mobile. Treatment is 73.0% mobile. Work out what that does to any comparison between them.",
    tool: 'choice', datasetKey: 'product_events',
    choice: {
      prompt: 'Tick everything that follows.',
      options: [
        { key: 'broken', correct: true, label: 'The arms are not comparable, so the headline difference is uninterpretable as it stands', why: 'Treatment is loaded with the platform that activates at a third of web\'s rate. Any gap between the arms is that loading plus whatever the change did, and the raw number cannot separate them.' },
        { key: 'device', correct: true, label: 'The assignment was probably bucketed on something device-related', why: 'A 73/27 split against a 28/72 one is not chance. Something in the rollout mechanism was correlated with the device, and that is worth writing down as the likely cause.' },
        { key: 'salvage', correct: true, label: 'It can still be analysed, but only within platform', why: 'Comparing like with like inside each segment is valid. What is not valid is the pooled average, and the distinction is the whole readout.' },
        { key: 'size', correct: false, label: 'The unequal arm sizes — 169 against 122 — are the main problem', why: 'Unequal sizes cost you precision and nothing else. It is the unequal COMPOSITION that biases the result, and the two are easy to confuse.' },
        { key: 'bin', correct: false, label: 'The experiment is worthless and should be discarded', why: 'Ten weeks of data with a known, measurable confounder is recoverable. Discarding it would throw away a real finding to avoid doing the arithmetic.' },
        { key: 'noise', correct: false, label: 'With nearly 300 users the imbalance will average out', why: 'Sample size fixes noise. It does nothing at all to systematic assignment bias — a larger sample would reproduce this skew more precisely.' },
      ],
      skills: { statistics: 100, businessLogic: 100 },
    },
    estHours: 0.4, priority: 'urgent', dueInDays: 2, day: 1, difficulty: 'hard',
  },

  'ex-106': {
    title: 'Tell Priya on day one',
    hint: "She asked for a rollback note by Wednesday. She needs to know today that the question changed.",
    brief: "You have not computed the result yet and you already know the readout she asked for cannot be written. Say so now, without overclaiming what you will find. Under 150 words.",
    tool: 'writeup', datasetKey: 'product_events',
    writeup: {
      to: 'Priya Menon', subject: 'onboarding_v2 — the arms are not comparable', maxWords: 150,
      prompt: 'What you found in the assignment, why it blocks the readout she asked for, and what you will do instead.',
      rubric: [
        { key: 'skew', label: 'The composition problem, with the numbers', markers: ['73|27|mobile|platform|composition|skew|imbalance|made up of'], why: 'One specific pair of percentages is more persuasive than any amount of methodological language.' },
        { key: 'why', label: 'Why it invalidates the pooled comparison', markers: ['activat|third|lower|worse|confound|not comparable|like for like|apples'], why: 'She needs the mechanism, not just the word "confounded".' },
        { key: 'hold', label: 'That the rollback note should wait', markers: ['hold|wait|not yet|before|pause|premature|would not|don.t circulate'], why: 'The concrete ask. Without it she may circulate the original number anyway.' },
        { key: 'plan', label: 'What you will do instead, and by when', markers: ['segment|within|by platform|split|standardis|weight|wednesday|thursday|instead'], why: 'A problem reported with no path forward reads as obstruction rather than analysis.' },
        { key: 'honest', label: 'That you do not yet know which way it will go', markers: ['may|might|could|not yet|do not know|don.t know|either|possible|until'], why: 'You genuinely do not know on Monday. Implying you do would be the same error she made, pointed the other way.' },
      ],
      skills: { communication: 100, statistics: 90 },
    },
    estHours: 0.45, priority: 'urgent', dueInDays: 2, day: 1, difficulty: 'hard',
  },

  'ex-110': {
    title: 'The number everyone has seen',
    hint: "Reproduce it exactly, customers only. You cannot correct a figure you have not first matched.",
    brief: "Compute the headline. Write ONE SQL SELECT over CUSTOMERS ONLY returning, per variant: users, how many activated, and the activation rate as a percentage rounded to one place.",
    referenceSql: "SELECT a.variant, COUNT(*) AS users, SUM(CASE WHEN EXISTS (SELECT 1 FROM events e WHERE e.user_id = u.id AND e.name = 'first_report_run') THEN 1 ELSE 0 END) AS activated, ROUND(AVG(CASE WHEN EXISTS (SELECT 1 FROM events e WHERE e.user_id = u.id AND e.name = 'first_report_run') THEN 1.0 ELSE 0.0 END) * 100, 1) AS pct FROM experiment_assignments a JOIN users u ON u.id = a.user_id WHERE u.email_domain <> 'meridiansystems.com' GROUP BY a.variant ORDER BY pct DESC",
    datasetKey: 'product_events', tool: 'sql', estHours: 0.55, priority: 'high', dueInDays: 2, day: 2, difficulty: 'hard',
  },

  'ex-112': {
    title: 'Rule out the boring explanations',
    hint: "If treatment users were assigned later they would have had less time to activate. Check it rather than assume it.",
    brief: "Before blaming composition, eliminate measurement. Write ONE SQL SELECT over CUSTOMERS ONLY returning, per variant: the earliest and latest signup date in the arm, and the fewest days any member of it has been observed for as at 12 June 2026. Label them first_signup, last_signup and min_days_observed.",
    referenceSql: "SELECT a.variant, MIN(substr(u.signup_at, 1, 10)) AS first_signup, MAX(substr(u.signup_at, 1, 10)) AS last_signup, MIN(CAST(julianday('2026-06-12') - julianday(substr(u.signup_at, 1, 10)) AS INTEGER)) AS min_days_observed FROM experiment_assignments a JOIN users u ON u.id = a.user_id WHERE u.email_domain <> 'meridiansystems.com' GROUP BY a.variant ORDER BY a.variant",
    datasetKey: 'product_events', tool: 'sql', estHours: 0.6, priority: 'high', dueInDays: 3, day: 2, difficulty: 'hard',
  },

  'ex-113': {
    title: 'Staff in the arms',
    hint: "You exclude them anyway. This is about whether their presence was ALSO lopsided.",
    brief: "Write ONE SQL SELECT over STAFF ONLY returning, per variant, how many were assigned. Label the column staff_assigned.",
    referenceSql: "SELECT a.variant, COUNT(*) AS staff_assigned FROM experiment_assignments a JOIN users u ON u.id = a.user_id WHERE u.email_domain = 'meridiansystems.com' GROUP BY a.variant ORDER BY a.variant",
    datasetKey: 'product_events', tool: 'sql', estHours: 0.3, priority: 'normal', dueInDays: 3, day: 2, difficulty: 'medium',
  },

  'ex-111': {
    title: 'What the headline does and does not say',
    hint: "Two of these are ruled out by queries you have just run. One is not ruled out by anything yet.",
    brief: "You have reproduced 45.0% against 36.1% and checked the obvious alternatives. Say precisely where that leaves you.",
    tool: 'choice', datasetKey: 'product_events',
    choice: {
      prompt: 'Tick everything that is true right now.',
      options: [
        { key: 'reproduced', correct: true, label: 'The headline reproduces exactly on customers only: 45.0 against 36.1', why: 'Matching the number you are about to correct is what stops the conversation becoming an argument about whose query is right.' },
        { key: 'nowindow', correct: true, label: 'It is not a measurement-window artefact — every assigned user has at least 28 days', why: 'Both arms span 1 March to 15 May and the youngest has been observed 28 days. A whole class of explanation is now closed.' },
        { key: 'nostaff', correct: true, label: 'It is not staff contamination — eight in each arm, and they are excluded anyway', why: 'Balanced by luck, not design. Worth one line in the readout precisely because nobody planned it.' },
        { key: 'lost', correct: false, label: 'The new onboarding performed worse', why: 'This is the claim under test, and the composition problem from yesterday is untouched by anything you did today.' },
        { key: 'nothing', correct: false, label: 'Nothing can be concluded from this experiment', why: 'Too strong, and it is the counsel of despair. A confounder you can measure is a confounder you can adjust for.' },
        { key: 'sig', correct: false, label: 'The gap is too large to be chance, so it is real', why: 'Ruling out chance does not rule out bias. A systematic imbalance produces large, stable, entirely spurious gaps.' },
      ],
      skills: { statistics: 100, businessLogic: 100 },
    },
    estHours: 0.35, priority: 'high', dueInDays: 3, day: 2, difficulty: 'hard',
  },

  'ex-114': {
    title: 'The growth channel wants to post it',
    hint: "They are not asking permission. Decide what you would need them to add.",
    brief: "Someone is about to broadcast the rollback. Decide what to do about it today.",
    tool: 'choice', datasetKey: 'product_events',
    choice: {
      exhibit: {
        kind: 'chat', from: 'Vikram Nair', subject: '#growth',
        body: "Posting this to the channel now: \"onboarding_v2 result is in — treatment 36% vs control 45%. We're rolling back. Good news is we caught it in ten weeks.\"\n\nShout if that's wrong.",
      },
      prompt: 'Tick everything you should do.',
      options: [
        { key: 'stop', correct: true, label: 'Ask him to hold it today, before it is posted', why: 'A number in a channel is repeated for months. The cost of asking him to wait a day is far below the cost of a public correction on Thursday.' },
        { key: 'reason', correct: true, label: 'Give him the reason in one line, not a request to trust you', why: '"The arms are 73% and 28% mobile" takes six seconds to read and is impossible to argue with. "I have concerns" invites a debate you will lose to a deadline.' },
        { key: 'when', correct: true, label: 'Tell him when he will have something he can post', why: 'He has a channel to feed. Holding without a date is asking him to choose between you and his job.' },
        { key: 'let', correct: false, label: 'Let it go — he said shout if it is wrong, and you have not finished', why: 'You have finished enough to know the number is not interpretable. That is exactly the shout he asked for.' },
        { key: 'correct', correct: false, label: 'Post the correction in the channel yourself', why: 'Correcting a colleague in public before he has had the chance to correct himself buys one accurate message and costs every future one.' },
        { key: 'escalate', correct: false, label: 'Raise it with Asha before replying to him', why: 'It is a one-line message to someone who explicitly invited it. Escalating a thing you can simply say is how a team stops talking to each other.' },
      ],
      skills: { communication: 100, businessLogic: 90 },
    },
    estHours: 0.35, priority: 'urgent', dueInDays: 3, day: 2, difficulty: 'hard',
  },

  'ex-115': {
    title: 'Hold the line with Vikram',
    hint: "One line of evidence, one commitment, no methodology lecture.",
    brief: "Reply to Vikram in the channel. He is about to post the rollback and asked to be told if it is wrong. Under 100 words.",
    tool: 'writeup', datasetKey: 'product_events',
    writeup: {
      to: 'Vikram Nair', subject: 'Hold the onboarding_v2 post', maxWords: 100,
      prompt: 'The ask, the one-line reason, and when he gets something postable.',
      rubric: [
        { key: 'hold', label: 'A clear ask to hold', markers: ['hold|wait|don.t post|do not post|pause|before you|hang on|give me'], why: 'Lead with it. Everything after is the justification.' },
        { key: 'evidence', label: 'The composition figure', markers: ['73|27|28|mobile|platform|made up|composition|skew'], why: 'The specific pair of numbers is what makes this unarguable in a channel.' },
        { key: 'notyet', label: 'That the direction is genuinely not settled', markers: ['not yet|may|might|could|do not know|don.t know|either way|reverse|change'], why: 'Do not tell him it is wrong. Tell him it is not yet readable, which is what is true on Tuesday.' },
        { key: 'date', label: 'When he gets a number he can post', markers: ['tomorrow|thursday|wednesday|end of|by|day|24 hour'], why: 'Without a date this reads as an indefinite block on his work.' },
      ],
      skills: { communication: 100 },
    },
    estHours: 0.35, priority: 'urgent', dueInDays: 3, day: 2, difficulty: 'medium',
  },

  'ex-120': {
    title: 'Compare like with like',
    hint: "Two segments, two arms, four cells. This is the query the whole week has been building to.",
    brief: "Now the comparison that is actually valid. Write ONE SQL SELECT over CUSTOMERS ONLY returning, per platform group and variant: users, how many activated, and the activation rate as a percentage rounded to one place. Group first, then variant.",
    referenceSql: "SELECT CASE WHEN u.primary_platform = 'web' THEN 'web' ELSE 'mobile' END AS grp, a.variant, COUNT(*) AS users, SUM(CASE WHEN EXISTS (SELECT 1 FROM events e WHERE e.user_id = u.id AND e.name = 'first_report_run') THEN 1 ELSE 0 END) AS activated, ROUND(AVG(CASE WHEN EXISTS (SELECT 1 FROM events e WHERE e.user_id = u.id AND e.name = 'first_report_run') THEN 1.0 ELSE 0.0 END) * 100, 1) AS pct FROM experiment_assignments a JOIN users u ON u.id = a.user_id WHERE u.email_domain <> 'meridiansystems.com' GROUP BY grp, a.variant ORDER BY grp, a.variant",
    datasetKey: 'product_events', tool: 'sql', estHours: 0.7, priority: 'urgent', dueInDays: 3, day: 3, difficulty: 'hard',
    // Deliberately flagged for rework: Priya accepts the four-cell table and then asks
    // for it variant-first rather than segment-first, because that is the order she has
    // to speak it in. A presentation request, not a correction.
    rework: true,
  },

  'ex-121': {
    title: 'It wins in both segments and loses overall',
    hint: "Check the direction inside each segment, then the direction of the pooled number. They disagree.",
    brief: "Mobile: 17.0 against 24.7. Web: 55.7 against 66.7. Pooled: 45.0 against 36.1. Say what you are looking at.",
    tool: 'choice', datasetKey: 'product_events',
    choice: {
      prompt: 'Tick everything that is true.',
      options: [
        { key: 'simpson', correct: true, label: 'A reversal caused by composition — treatment beats control in every segment', why: "Simpson's paradox. It is not a contradiction and not an error: the pooled average is a weighted average, and the weights differ between the arms." },
        { key: 'both', correct: true, label: 'Treatment is ahead by 7.7 points on mobile and 11.0 on web', why: 'Both segments, same direction, and neither margin is small. That consistency is what makes the reversal a composition story rather than a fluke.' },
        { key: 'weights', correct: true, label: 'The pooled figure is measuring the platform mix, not the onboarding', why: 'Treatment is three-quarters mobile, and mobile activates at a third of web\'s rate. Pooling hands the arm with the worse mix a penalty that has nothing to do with the change.' },
        { key: 'error', correct: false, label: 'One of the two calculations must be wrong', why: 'Both are arithmetically correct. That is precisely what makes the paradox worth understanding rather than debugging.' },
        { key: 'pooled', correct: false, label: 'The pooled number is the real one — it is what users actually experienced', why: 'What users experienced is real. It is not an estimate of what the CHANGE did, which is the only question an experiment is run to answer.' },
        { key: 'mobileonly', correct: false, label: 'The new onboarding only helps mobile users', why: 'It helps web users more, in percentage points. The mobile-heavy treatment arm is why the pooled figure falls, not where the benefit is.' },
      ],
      skills: { statistics: 100, businessLogic: 100 },
    },
    estHours: 0.45, priority: 'urgent', dueInDays: 4, day: 3, difficulty: 'hard',
  },

  'ex-122': {
    title: 'One number for the readout',
    hint: "Apply each arm's within-segment rates to the SAME platform mix — the pooled one — so the arms differ only in the thing you are testing.",
    brief: "Priya needs a single figure per arm, not a four-cell table. Standardise them. In the notebook, over CUSTOMERS ONLY, compute each variant's activation rate re-weighted to the platform mix of the whole assigned population. Assign a list of dicts with keys variant and standardised_pct, rounded to one decimal place, sorted by variant, to `result`.",
    tool: 'python', datasetKey: 'product_events',
    estHours: 0.9, priority: 'urgent', dueInDays: 4, day: 3, difficulty: 'hard',
    referenceCompute: (tables) => {
      const users = new Map(tables.users.map((u) => [u.id, u]));
      const activated = new Set(tables.events.filter((e) => e.name === 'first_report_run').map((e) => e.user_id));
      const cells = new Map();
      const groupTotals = new Map();
      for (const a of tables.experiment_assignments) {
        const u = users.get(a.user_id);
        if (!u || u.email_domain === 'meridiansystems.com') continue;
        const grp = u.primary_platform === 'web' ? 'web' : 'mobile';
        const key = a.variant + '|' + grp;
        if (!cells.has(key)) cells.set(key, { n: 0, act: 0 });
        const c = cells.get(key);
        c.n += 1;
        if (activated.has(u.id)) c.act += 1;
        groupTotals.set(grp, (groupTotals.get(grp) || 0) + 1);
      }
      const total = [...groupTotals.values()].reduce((s, n) => s + n, 0);
      const variants = [...new Set([...cells.keys()].map((k) => k.split('|')[0]))].sort();
      return variants.map((variant) => {
        let acc = 0;
        for (const [grp, weight] of groupTotals) {
          const c = cells.get(variant + '|' + grp);
          if (c && c.n) acc += (c.act / c.n) * weight;
        }
        return { variant, standardised_pct: Math.round((acc / total) * 1000) / 10 };
      });
    },
  },

  'ex-123': {
    title: 'Check the mechanism',
    hint: "Users who signed up outside the experiment window were never assigned. They are your untouched baseline.",
    brief: "Confirm that mobile really is the weaker platform, independently of the experiment. Write ONE SQL SELECT over CUSTOMERS ONLY who have NO row in the assignment table, returning per platform group: users and the activation rate as a percentage rounded to one place.",
    referenceSql: "SELECT CASE WHEN u.primary_platform = 'web' THEN 'web' ELSE 'mobile' END AS grp, COUNT(*) AS users, ROUND(AVG(CASE WHEN EXISTS (SELECT 1 FROM events e WHERE e.user_id = u.id AND e.name = 'first_report_run') THEN 1.0 ELSE 0.0 END) * 100, 1) AS pct FROM users u WHERE u.email_domain <> 'meridiansystems.com' AND NOT EXISTS (SELECT 1 FROM experiment_assignments a WHERE a.user_id = u.id) GROUP BY grp ORDER BY pct DESC",
    datasetKey: 'product_events', tool: 'sql', estHours: 0.65, priority: 'high', dueInDays: 4, day: 3, difficulty: 'hard',
  },

  'ex-124': {
    title: 'Which number goes in the readout',
    hint: "You now have three candidates. Only one of them answers the question the experiment was run to answer.",
    brief: "You have the pooled figure, the four-cell table and the standardised pair. Decide what Priya gets.",
    tool: 'choice', datasetKey: 'product_events',
    choice: {
      prompt: 'Tick everything that belongs in the readout.',
      options: [
        { key: 'standard', correct: true, label: 'The standardised pair: 37.6 control against 47.1 treatment', why: 'Both arms evaluated against the same platform mix, so the only remaining difference is the onboarding. This is the estimate of the effect.' },
        { key: 'segments', correct: true, label: 'The per-segment table underneath it', why: 'The standardised number is a summary of those four cells. Showing them is what lets someone check your weighting rather than take it on faith.' },
        { key: 'original', correct: true, label: 'The original 45.0 against 36.1, labelled as the confounded figure', why: 'It is already circulating. A readout that silently replaces it leaves two numbers loose with no explanation of which to believe.' },
        { key: 'baseline', correct: true, label: 'The unassigned baseline — mobile 16.0, web 48.4 — as corroboration', why: 'It shows the platform gap exists outside the experiment entirely, which is what turns "I reweighted it" from a manoeuvre into a documented fact.' },
        { key: 'onlybest', correct: false, label: 'Only the segment where treatment did best, since that is the clearest result', why: 'Reporting the strongest cell and omitting the other is how you would have manufactured the opposite conclusion on Tuesday.' },
        { key: 'avgpct', correct: false, label: 'The simple average of the two segment rates: (24.7 + 66.7) / 2', why: 'That weights a 33-user segment equally with an 89-user one. Standardising uses the real population mix, which is the point.' },
      ],
      skills: { statistics: 100, communication: 100 },
    },
    estHours: 0.4, priority: 'high', dueInDays: 4, day: 3, difficulty: 'hard',
  },

  'ex-125': {
    title: 'Tell Priya it reversed',
    hint: "She told the business it lost. Give her the corrected result and the sentence she can use to explain the change.",
    brief: "Write to Priya. The conclusion she circulated on Monday is the opposite of the corrected one. Make that easy for her to carry. Under 180 words.",
    tool: 'writeup', datasetKey: 'product_events',
    writeup: {
      to: 'Priya Menon', subject: 'onboarding_v2 — the result reverses once the arms are matched',
      maxWords: 180,
      prompt: 'The corrected result, why it moved, and what you are recommending now.',
      rubric: [
        { key: 'result', label: 'The corrected figures', markers: ['37\\.6|47\\.1|standardis|weight|adjust|matched|nine|9\\.5'], why: 'Lead with the answer. The method is the second paragraph.' },
        { key: 'why', label: 'Why the raw number said the opposite', markers: ['mobile|73|composition|mix|confound|weighted|more of'], why: 'Without the mechanism this reads as an analyst producing whichever answer was asked for.' },
        { key: 'segments', label: 'That treatment won in both segments', markers: ['both|each|every|web and mobile|17|24\\.7|55\\.7|66\\.7'], why: 'Consistency across segments is what makes the corrected direction believable rather than an artefact of the correction.' },
        { key: 'rec', label: 'A recommendation, not just a correction', markers: ['roll|ship|keep|not roll back|recommend|adopt|launch|do not'], why: 'She asked for a rollback note. The obligation is to replace it with a decision, not to leave her with a methodology note.' },
        { key: 'caveat', label: 'The limits — non-random assignment, small web treatment arm', markers: ['not random|non.random|assign|33|small|caveat|cannot|limit|confiden|re.run'], why: 'This is an adjusted observational comparison, not a clean experiment. Saying so is what keeps it defensible when somebody checks.' },
      ],
      skills: { communication: 100, statistics: 100 },
    },
    estHours: 0.6, priority: 'urgent', dueInDays: 4, day: 3, difficulty: 'hard',
  },

  'ex-130': {
    title: 'The result by channel',
    hint: "Same four-cell shape, different splitter. Watch the sample sizes in each cell.",
    brief: "Somebody will ask whether the effect holds everywhere. Write ONE SQL SELECT over CUSTOMERS ONLY returning, per channel and variant: users and activation rate as a percentage rounded to one place. Channel, then variant.",
    referenceSql: "SELECT u.channel, a.variant, COUNT(*) AS users, ROUND(AVG(CASE WHEN EXISTS (SELECT 1 FROM events e WHERE e.user_id = u.id AND e.name = 'first_report_run') THEN 1.0 ELSE 0.0 END) * 100, 1) AS pct FROM experiment_assignments a JOIN users u ON u.id = a.user_id WHERE u.email_domain <> 'meridiansystems.com' GROUP BY u.channel, a.variant ORDER BY u.channel, a.variant",
    datasetKey: 'product_events', tool: 'sql', estHours: 0.55, priority: 'normal', dueInDays: 5, day: 4, difficulty: 'medium',
  },

  'ex-131': {
    title: 'The result by plan',
    hint: "Same again. Note how few users are in some of these cells before reading anything into them.",
    brief: "Write ONE SQL SELECT over CUSTOMERS ONLY returning, per plan and variant: users and activation rate as a percentage rounded to one place. Plan, then variant.",
    referenceSql: "SELECT u.plan, a.variant, COUNT(*) AS users, ROUND(AVG(CASE WHEN EXISTS (SELECT 1 FROM events e WHERE e.user_id = u.id AND e.name = 'first_report_run') THEN 1.0 ELSE 0.0 END) * 100, 1) AS pct FROM experiment_assignments a JOIN users u ON u.id = a.user_id WHERE u.email_domain <> 'meridiansystems.com' GROUP BY u.plan, a.variant ORDER BY u.plan, a.variant",
    datasetKey: 'product_events', tool: 'sql', estHours: 0.5, priority: 'normal', dueInDays: 5, day: 4, difficulty: 'medium',
  },

  'ex-132': {
    title: 'Two segments that disagree with everything',
    hint: "Look at the cell sizes behind the two biggest swings before deciding they are findings.",
    brief: "Partner has control at 66.7% against treatment's 33.3%. Business plan has 55.6% against 29.4%. Both point the opposite way to the result. Decide what they are.",
    tool: 'choice', datasetKey: 'product_events',
    choice: {
      prompt: 'Tick everything that is true.',
      options: [
        { key: 'small', correct: true, label: 'Both sit on cells of 15 to 27 users, where a handful of people moves the rate 10 points', why: 'On 15 users one person is 6.7 percentage points. These cells cannot distinguish a real reversal from five coin flips.' },
        { key: 'expected', correct: true, label: 'With five channels and three plans, extreme cells are expected even if nothing is happening', why: 'Sixteen subgroup comparisons will throw up two or three that look striking by chance alone. That is arithmetic, not bad luck.' },
        { key: 'notprespec', correct: true, label: 'Neither split was specified before the result was known', why: 'The platform split was forced on you by the assignment mechanism. These two you went looking for after seeing the answer, which is a different kind of evidence.' },
        { key: 'partner', correct: false, label: 'The new onboarding actively harms partner-sourced users', why: 'On 27 against 15 users, that claim needs far more evidence than a percentage gap. It is the single most quotable wrong sentence available this week.' },
        { key: 'both', correct: false, label: 'Report both alongside the platform finding, for completeness', why: 'Completeness is not the goal — a reader cannot weigh a 15-user cell against a 122-user one, and putting them side by side implies they are comparable.' },
        { key: 'hide', correct: false, label: 'Do not mention subgroup results at all', why: 'Somebody will run these splits. Better that the readout says you looked, they were underpowered, and here is what would settle them.' },
      ],
      skills: { statistics: 100, businessLogic: 100 },
    },
    estHours: 0.45, priority: 'high', dueInDays: 5, day: 4, difficulty: 'hard',
  },

  'ex-133': {
    title: 'The result by invite path',
    hint: "One more splitter, and this one has a real reason to differ. Report it either way.",
    brief: "Write ONE SQL SELECT over CUSTOMERS ONLY returning, for self_serve and invited users and each variant: users and activation rate as a percentage rounded to one place.",
    referenceSql: "SELECT CASE WHEN u.invited_by_user_id IS NULL THEN 'self_serve' ELSE 'invited' END AS kind, a.variant, COUNT(*) AS users, ROUND(AVG(CASE WHEN EXISTS (SELECT 1 FROM events e WHERE e.user_id = u.id AND e.name = 'first_report_run') THEN 1.0 ELSE 0.0 END) * 100, 1) AS pct FROM experiment_assignments a JOIN users u ON u.id = a.user_id WHERE u.email_domain <> 'meridiansystems.com' GROUP BY kind, a.variant ORDER BY kind, a.variant",
    datasetKey: 'product_events', tool: 'sql', estHours: 0.55, priority: 'normal', dueInDays: 5, day: 4, difficulty: 'medium',
  },

  'ex-134': {
    title: 'Vikram found the partner number',
    hint: "He is not wrong that it is in the data. Decide what you owe him, and what you do not.",
    brief: "He has run his own split and wants to use it. Answer him.",
    tool: 'choice', datasetKey: 'product_events',
    choice: {
      exhibit: {
        kind: 'chat', from: 'Vikram Nair', subject: '#growth',
        body: "Ran your query with a channel breakdown. Partner users do WAY worse on treatment — 33% vs 67% on control.\n\nThat's a real segment for us. Can we ship the new onboarding to everyone except partner-sourced signups? Best of both.",
      },
      prompt: 'Tick everything that should be in your reply.',
      options: [
        { key: 'n', correct: true, label: 'The cell sizes: 27 control and 15 treatment', why: 'He has not seen the denominator. Almost nobody reads a subgroup result and checks it, which is why quoting it is the most useful thing you can do.' },
        { key: 'multiple', correct: true, label: 'That sixteen subgroup splits will always produce a couple of extremes', why: 'The general principle, once, so he can apply it himself next time rather than bringing you each new slice.' },
        { key: 'test', correct: true, label: 'What would actually settle it — a pre-specified split in the re-run', why: 'It turns a refusal into a plan, and if partner really is different the re-run will show it.' },
        { key: 'ship', correct: false, label: 'Agree — carving out one segment is a cheap hedge', why: 'It is not cheap. It splits the product into two onboarding paths permanently, on the evidence of 15 users.' },
        { key: 'dismiss', correct: false, label: 'Tell him subgroup analysis is not valid and leave it there', why: 'Subgroup analysis is valid when pre-specified and powered. A flat dismissal is both wrong and guarantees he stops bringing you what he finds.' },
        { key: 'rerun', correct: false, label: 'Offer to re-run the numbers to check', why: 'The numbers are right. Re-running them concedes that the problem was arithmetic, and he will come back with the same figure and more confidence.' },
      ],
      skills: { communication: 100, statistics: 100 },
    },
    estHours: 0.4, priority: 'high', dueInDays: 5, day: 4, difficulty: 'hard',
  },

  'ex-135': {
    title: 'Answer him in the channel',
    hint: "Short. Give him the denominator, the principle, and the way to settle it.",
    brief: "Reply to Vikram about the partner carve-out, in public, without making him look careless. Under 120 words.",
    tool: 'writeup', datasetKey: 'product_events',
    writeup: {
      to: 'Vikram Nair', subject: 'Re: partner segment', maxWords: 120,
      prompt: 'The denominator, why extreme subgroups are expected, and what would settle it.',
      rubric: [
        { key: 'n', label: 'The cell sizes', markers: ['15|27|small|sample|handful|few|denominat'], why: 'The single fact that changes his reading of his own number.' },
        { key: 'why', label: 'That extreme subgroups are expected across many splits', markers: ['sixteen|16|many|several|split|chance|expect|random|multiple'], why: 'The principle, so the next slice does not come back to you.' },
        { key: 'settle', label: 'What would settle it', markers: ['pre.specif|re.run|next|design|power|larger|test it'], why: 'Refusal plus a path is a collaboration. Refusal alone is a blocker.' },
        { key: 'respect', label: 'Written so he keeps bringing you things', markers: ['good|fair|worth|glad|thanks|right to|useful|keep'], why: 'He did the right thing by checking. If answering costs him face he will stop checking, and the next wrong number will go out unexamined.' },
      ],
      skills: { communication: 100 },
    },
    estHours: 0.4, priority: 'normal', dueInDays: 5, day: 4, difficulty: 'medium',
  },

  'ex-140': {
    title: 'The readout table',
    hint: "One row per arm per segment, plus the users behind each. This is the table that goes under the headline.",
    brief: "Assemble what Priya circulates. Write ONE SQL SELECT over CUSTOMERS ONLY returning one row per platform group and variant: the group, the variant, users, activated, and the rate as a percentage rounded to one place — ordered so web comes before mobile and control before treatment within each.",
    referenceSql: "SELECT CASE WHEN u.primary_platform = 'web' THEN 'web' ELSE 'mobile' END AS grp, a.variant, COUNT(*) AS users, SUM(CASE WHEN EXISTS (SELECT 1 FROM events e WHERE e.user_id = u.id AND e.name = 'first_report_run') THEN 1 ELSE 0 END) AS activated, ROUND(AVG(CASE WHEN EXISTS (SELECT 1 FROM events e WHERE e.user_id = u.id AND e.name = 'first_report_run') THEN 1.0 ELSE 0.0 END) * 100, 1) AS pct FROM experiment_assignments a JOIN users u ON u.id = a.user_id WHERE u.email_domain <> 'meridiansystems.com' GROUP BY grp, a.variant ORDER BY CASE WHEN grp = 'web' THEN 0 ELSE 1 END, a.variant",
    datasetKey: 'product_events', tool: 'sql', estHours: 0.6, priority: 'high', dueInDays: 5, day: 5, difficulty: 'hard',
  },

  'ex-141': {
    title: 'The chart for the readout',
    hint: "Four bars, one per arm per segment, and the axis has to start at zero or the reversal looks bigger than it is.",
    brief: "Build the visual. Activation rate for each arm within each platform segment, so the consistency across segments is the thing a reader sees first. Pick the chart type, the fields and the sort.",
    tool: 'chart', datasetKey: 'product_events',
    chart: {
      sourceSql: "SELECT (CASE WHEN u.primary_platform = 'web' THEN 'web' ELSE 'mobile' END) || ' · ' || a.variant AS segment, AVG(CASE WHEN EXISTS (SELECT 1 FROM events e WHERE e.user_id = u.id AND e.name = 'first_report_run') THEN 1.0 ELSE 0.0 END) * 100 AS activation FROM experiment_assignments a JOIN users u ON u.id = a.user_id WHERE u.email_domain <> 'meridiansystems.com' GROUP BY segment ORDER BY activation DESC",
      prompt: 'Activation by arm within platform segment, for the experiment readout.',
      answer: { type: 'bar', x: 'segment', y: 'activation', sort: 'desc', baselineZero: true },
      why: 'Four named categories compared on one measure is a bar chart. Sorted descending the two web bars sit together and the two mobile bars sit together, so the reader sees the within-segment ordering before the between-segment gap. A zero baseline is non-negotiable on a percentage — truncating it here would make a 7.7 point difference look like a doubling.',
    },
    estHours: 0.35, priority: 'high', dueInDays: 5, day: 5, difficulty: 'medium',
  },

  'ex-142': {
    title: 'What this experiment can and cannot support',
    hint: "You corrected a confounder you could see. That is not the same as having run a clean experiment.",
    brief: "Before you write the recommendation, be precise about the strength of what you have.",
    tool: 'choice', datasetKey: 'product_events',
    choice: {
      prompt: 'Tick everything that is true of your corrected result.',
      options: [
        { key: 'adjusted', correct: true, label: 'It is an adjusted observational comparison, not a randomised result', why: 'Randomisation protects against confounders you did not think of. Standardising protects only against the one you measured, and that difference has to be in the readout.' },
        { key: 'direction', correct: true, label: 'The direction is well supported — both segments agree and the margins are wide', why: 'Consistency across independent segments is the strongest thing you have. It is what makes the reversal a finding rather than an artefact of the adjustment.' },
        { key: 'magnitude', correct: true, label: 'The size of the effect is much less certain than its direction', why: 'The web treatment cell has 33 users. The +9.5 point standardised gap is an estimate with a wide interval around it, and quoting it to one decimal implies a precision you do not have.' },
        { key: 'unknown', correct: true, label: 'Anything correlated with device that you have not measured is still uncontrolled', why: 'The assignment was device-bucketed. Whatever else travels with device — country, plan, how people found us — travels with the arms too.' },
        { key: 'proven', correct: false, label: 'It proves the new onboarding is better', why: 'It supports that conclusion. Proof is not a thing an adjusted comparison on 291 users delivers, and the word is what gets quoted back at you.' },
        { key: 'nothing', correct: false, label: 'Non-random assignment means nothing can be concluded', why: 'Then you would have spent a week to arrive back where Monday started. A measured confounder is exactly the case where adjustment is legitimate.' },
      ],
      skills: { statistics: 100, businessLogic: 100 },
    },
    estHours: 0.4, priority: 'high', dueInDays: 5, day: 5, difficulty: 'hard',
  },

  'ex-143': {
    title: 'Design the re-run',
    hint: "Every item here is a fix for something that actually went wrong this week.",
    brief: "You are recommending the change ship, and a proper test alongside it. Specify what the re-run has to do differently.",
    tool: 'choice', datasetKey: 'product_events',
    choice: {
      prompt: 'Tick everything the re-run must include.',
      options: [
        { key: 'bucket', correct: true, label: 'Assignment bucketed on user identifier, not device', why: 'The single cause of everything that went wrong here. Bucketing on device guarantees the arms differ on the strongest predictor you have.' },
        { key: 'checkbalance', correct: true, label: 'A balance check on platform, channel and plan before anyone looks at the outcome', why: 'It takes one query and it would have caught this in week one instead of week ten.' },
        { key: 'prespec', correct: true, label: 'The subgroups written down before the result is known', why: 'The difference between a subgroup finding and a story is whether you named the split first. Partner is the obvious candidate to pre-specify.' },
        { key: 'power', correct: true, label: 'A minimum cell size, so no segment is read off 15 users', why: 'Set it in advance and the question of whether to report a tiny cell never becomes a negotiation.' },
        { key: 'longer', correct: false, label: 'A longer window — ten weeks was not enough', why: 'Ten weeks gave every user at least 28 days to activate. Duration was the one thing that was fine.' },
        { key: 'bigger', correct: false, label: 'A larger sample, which would have avoided the reversal', why: 'More users would have reproduced the same skew more precisely. Sample size does not fix biased assignment, and believing it does is how this recurs.' },
      ],
      skills: { statistics: 100, businessLogic: 100 },
    },
    estHours: 0.4, priority: 'high', dueInDays: 5, day: 5, difficulty: 'hard',
  },

  'ex-144': {
    title: 'The number Priya will be asked in the room',
    hint: "She needs one sentence with one number in it. Work out which number survives being quoted without its table.",
    brief: "Someone in the leadership meeting will ask 'so how much better is it?'. Decide what Priya should say.",
    tool: 'choice', datasetKey: 'product_events',
    choice: {
      prompt: 'Tick the answers Priya can safely give.',
      options: [
        { key: 'ppt', correct: true, label: '"About nine points better on activation, once we compare like with like"', why: 'Gives the magnitude, flags the adjustment, and the hedge is built into the sentence rather than living in a footnote nobody reads.' },
        { key: 'segments', correct: true, label: '"Better on both web and mobile — the earlier number was a mix effect"', why: 'The most defensible form, because it does not depend on trusting the weighting at all.' },
        { key: 'exact', correct: false, label: '"47.1% against 37.6%"', why: 'Quoted to one decimal on 291 users, and it will be repeated to one decimal for a year. The precision is fictional.' },
        { key: 'double', correct: false, label: '"Roughly a quarter better" (47.1 divided by 37.6)', why: 'Relative framing on a rate this size inflates the perception of the effect. Percentage points are what a product decision is made in.' },
        { key: 'rawflip', correct: false, label: '"The original number was wrong"', why: 'It was arithmetically right and answered a different question. Calling a colleague\'s work wrong when it was misinterpreted is both inaccurate and expensive.' },
      ],
      skills: { communication: 100, statistics: 100 },
    },
    estHours: 0.35, priority: 'high', dueInDays: 5, day: 5, difficulty: 'hard',
  },

  'ex-145': {
    title: 'The readout',
    hint: "Result, method, limits, decision, and what the re-run changes. In that order, and nothing else.",
    brief: "Write the readout Priya circulates. It has to replace a conclusion the business has already heard, survive being forwarded without you in the thread, and end in a decision. Under 260 words.",
    tool: 'writeup', datasetKey: 'product_events',
    writeup: {
      to: 'Priya Menon', subject: 'onboarding_v2 — readout and recommendation', maxWords: 260,
      prompt: 'The corrected result, how it was reached, what it cannot support, and what you recommend.',
      rubric: [
        { key: 'result', label: 'The corrected result up front', markers: ['better|improv|higher|47|37\\.6|nine|9\\.5|both segment|win'], why: 'A readout that opens with method loses the reader before the answer.' },
        { key: 'why', label: 'Why the circulated figure said the opposite', markers: ['mobile|73|composition|mix|confound|weight|made up'], why: 'The business heard a number on Monday. Not explaining the reversal leaves two live figures and no way to choose.' },
        { key: 'method', label: 'What you did to correct it', markers: ['standardis|weight|same mix|adjust|within|segment|like with like|matched'], why: 'Reproducible in one sentence, or it is not a readout — it is an assertion.' },
        { key: 'limits', label: 'That assignment was not random, so this is adjusted not randomised', markers: ['not random|non.random|device|bucket|observational|adjust|cannot rule|caveat|limit'], why: 'The honest boundary. Without it the number gets treated as experimental evidence, which it is not.' },
        { key: 'subgroup', label: 'That subgroup splits were checked and were underpowered', markers: ['subgroup|partner|plan|channel|small|15|underpower|not read|chance'], why: 'Somebody will run them. The readout should already have said what they are worth.' },
        { key: 'decide', label: 'A decision and a re-run design', markers: ['recommend|ship|roll out|adopt|keep|re.run|bucket|user id|balance check|pre.specif'], why: 'Two weeks of work has to end in what happens next, not in a summary of what was found.' },
      ],
      skills: { communication: 100, statistics: 100, businessLogic: 100 },
    },
    estHours: 0.8, priority: 'high', dueInDays: 5, day: 5, difficulty: 'hard',
  },


  // ---- Lead 1 · Half-Year Trading Review (retail_sales) ---------------------------
  // First project at Team Lead, and the difference shows in what is being asked. Nobody
  // asks the learner to compute a number here — they are handed numbers other people
  // computed and asked whether the estate can be run on them. Monday the headline double
  // counts returns. Tuesday the ranking is a ranking of trading days. Wednesday the best
  // performing store in the estate turns out to be a double-loaded feed. Thursday the
  // comparison has to be rebuilt like for like. Friday it goes to the board.

  'ta-101': {
    title: 'What the headline is counting',
    hint: "Look at what a return does to each of the three numbers in the note before you check any of them.",
    brief: "Ravi has sent the half-year headline. Before verifying anything, work out which of his three figures can survive contact with the sales table.",
    tool: 'choice', datasetKey: 'retail_sales',
    choice: {
      exhibit: {
        kind: 'email', from: 'Ravi Menon', subject: 'H1 numbers for the board pack',
        body: "Rough cut for Tuesday:\n\n- Revenue for the year: ₹5.00 crore\n- Transactions: 9,022\n- Average transaction value: ₹5,546\n\nBest store is Indiranagar at ₹74.8 lakh, and the star of the half is Ashok Nagar, up 21% on the second half. Worth calling out.\n\nCan you sanity check before it goes in?",
      },
      prompt: 'Tick every problem you can already see, before running a query.',
      options: [
        { key: 'returns', correct: true, label: 'A return is a row in the sales table, so "transactions" counts refunds as sales', why: '9,022 lines include 492 returns. A refund is not a transaction in the sense a board reads that word, and nothing in his note says which he means.' },
        { key: 'atv', correct: true, label: 'Average transaction value computed over all rows is dragged down by negative lines', why: 'Dividing net revenue by a line count that includes refunds is two errors compounding — a smaller numerator over a larger denominator.' },
        { key: 'grossnet', correct: true, label: '"Revenue" needs to say whether it is gross or net of returns', why: 'The two differ by ₹15.7 lakh here. Both are legitimate figures; publishing one unlabelled is what makes it wrong.' },
        { key: 'store', correct: false, label: 'Indiranagar cannot be the best store — flagships always are', why: 'It is the best store on revenue, and checking that is a query rather than a prejudice. Guessing the answer before looking is the habit this whole project is against.' },
        { key: 'crore', correct: false, label: 'Reporting in crore is imprecise and should be avoided', why: 'The unit is fine for a board. What is missing is the definition, not the precision.' },
        { key: 'ashok', correct: false, label: 'A 21% rise is implausible and must be an error', why: 'It IS an error, and you do not know that yet. "Implausible therefore wrong" is a guess that happens to be right, which is the worst kind of analysis to be rewarded for.' },
      ],
      skills: { businessLogic: 100, communication: 90 },
    },
    estHours: 0.35, priority: 'high', dueInDays: 1, day: 1, difficulty: 'hard',
  },

  'ta-102': {
    title: 'Gross, returns and net in one row',
    hint: "A return has a negative quantity. Separate the two directions with CASE inside the SUM rather than filtering the whole query.",
    brief: "Establish the figures properly, as a bridge a board can follow. Write ONE SQL SELECT returning one row PER MEASURE, with columns measure and value, in this order: gross_revenue, returns_value (positive), net_revenue, units_sold, units_returned (positive), sale_lines.",
    referenceSql: "SELECT 'gross_revenue' AS measure, SUM(CASE WHEN quantity > 0 THEN quantity * unit_price ELSE 0 END) AS value FROM sales UNION ALL SELECT 'returns_value', -SUM(CASE WHEN quantity < 0 THEN quantity * unit_price ELSE 0 END) FROM sales UNION ALL SELECT 'net_revenue', SUM(quantity * unit_price) FROM sales UNION ALL SELECT 'units_sold', SUM(CASE WHEN quantity > 0 THEN quantity ELSE 0 END) FROM sales UNION ALL SELECT 'units_returned', -SUM(CASE WHEN quantity < 0 THEN quantity ELSE 0 END) FROM sales UNION ALL SELECT 'sale_lines', SUM(CASE WHEN quantity > 0 THEN 1 ELSE 0 END) FROM sales",
    datasetKey: 'retail_sales', tool: 'sql', estHours: 0.6, priority: 'high', dueInDays: 1, day: 1, difficulty: 'hard',
  },

  'ta-103': {
    title: 'Return rate by category',
    hint: "Two different rates — one on lines, one on value — and they rank the categories differently.",
    brief: "Ravi will be asked which categories come back. Write ONE SQL SELECT returning, per category: the number of lines, returned lines as a percentage of all lines to two places, and returned value as a percentage of gross revenue to two places. Worst by value first.",
    referenceSql: "SELECT p.category, COUNT(*) AS lines, ROUND(SUM(CASE WHEN s.quantity < 0 THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) AS return_line_pct, ROUND(-SUM(CASE WHEN s.quantity < 0 THEN s.quantity * s.unit_price ELSE 0 END) * 100.0 / SUM(CASE WHEN s.quantity > 0 THEN s.quantity * s.unit_price ELSE 0 END), 2) AS return_value_pct FROM sales s JOIN products p ON p.id = s.product_id GROUP BY p.category ORDER BY return_value_pct DESC",
    datasetKey: 'retail_sales', tool: 'sql', estHours: 0.7, priority: 'normal', dueInDays: 2, day: 1, difficulty: 'hard',
  },

  'ta-104': {
    title: 'Average transaction value, done properly',
    hint: "Decide what a transaction is first. Then the query is short.",
    brief: "Rebuild Ravi's third figure, and show him where it bites. Write ONE SQL SELECT returning, per store: his version — net revenue over all lines — the defensible version — gross revenue over sale lines only — and the gap between them. Round each to the nearest rupee, label them naive_atv, sale_atv and gap, and put the biggest gap first.",
    referenceSql: "SELECT st.name, ROUND(SUM(s.quantity * s.unit_price) * 1.0 / COUNT(*)) AS naive_atv, ROUND(SUM(CASE WHEN s.quantity > 0 THEN s.quantity * s.unit_price ELSE 0 END) * 1.0 / SUM(CASE WHEN s.quantity > 0 THEN 1 ELSE 0 END)) AS sale_atv, ROUND(SUM(CASE WHEN s.quantity > 0 THEN s.quantity * s.unit_price ELSE 0 END) * 1.0 / SUM(CASE WHEN s.quantity > 0 THEN 1 ELSE 0 END)) - ROUND(SUM(s.quantity * s.unit_price) * 1.0 / COUNT(*)) AS gap FROM sales s JOIN stores st ON st.id = s.store_id GROUP BY st.id ORDER BY gap DESC",
    datasetKey: 'retail_sales', tool: 'sql', estHours: 0.5, priority: 'high', dueInDays: 2, day: 1, difficulty: 'hard',
  },

  'ta-105': {
    title: 'Which definition goes in the pack',
    hint: "There is no single right answer here. There is a right way to present whichever you pick.",
    brief: "You have both versions. Decide what the board pack should say.",
    tool: 'choice', datasetKey: 'retail_sales',
    choice: {
      prompt: 'Tick everything that belongs in the pack.',
      options: [
        { key: 'label', correct: true, label: 'Whichever figure is used, the definition sits beside it', why: 'Net of returns or gross, sale lines or all lines — a board cannot tell from the number, and next quarter somebody will compute the other one and the two will be compared.' },
        { key: 'both', correct: true, label: 'Gross and net both, with returns shown as the bridge between them', why: 'It is one extra row and it makes the return rate visible as a business fact rather than a definitional footnote.' },
        { key: 'sales', correct: true, label: 'Transaction counts and average values should use sale lines only', why: 'A refund is a transaction in the till system and not in the sense a board means. Counting it as one drags the average down by about ₹300 for no reason anybody could explain in the room.' },
        { key: 'net', correct: false, label: 'Use net revenue everywhere — it is the conservative choice', why: 'Conservative is not the same as correct, and a "conservative" figure quoted against a gross target is exactly how two teams end up arguing about whether a number was hit.' },
        { key: 'drop', correct: false, label: 'Exclude returns from the analysis entirely', why: 'Returns are 3.1% of gross revenue and they are real money leaving. Removing them makes every figure on the page optimistic.' },
        { key: 'footnote', correct: false, label: 'Put the definitions in an appendix so the headline stays clean', why: 'Nobody reads the appendix and the headline is the bit that gets quoted. The definition has to travel with the number.' },
      ],
      skills: { communication: 100, businessLogic: 100 },
    },
    estHours: 0.35, priority: 'high', dueInDays: 2, day: 1, difficulty: 'medium',
  },

  'ta-106': {
    title: 'Reply to Ravi',
    hint: "He asked for a sanity check, not a rewrite. Tell him which figures move and by how much.",
    brief: "Write back on day one. Two of his three numbers change and one needs a definition attached. Be specific and do not make him feel stupid for asking. Under 160 words.",
    tool: 'writeup', datasetKey: 'retail_sales',
    writeup: {
      to: 'Ravi Menon', subject: 'H1 headline — two of the three need changing', maxWords: 160,
      prompt: 'Which figures are wrong, what they should be, and the one definition that has to go in the pack.',
      rubric: [
        { key: 'txn', label: 'That the transaction count includes returns', markers: ['return|refund|492|8,?530|negative|not transaction'], why: 'The clearest of the three and the easiest for him to fix.' },
        { key: 'atv', label: 'The corrected average transaction value', markers: ['5,?8|average|atv|transaction value|per sale'], why: 'Replacing a wrong figure with no figure leaves him nothing for Tuesday.' },
        { key: 'define', label: 'That revenue has to say gross or net', markers: ['gross|net|define|definition|label|state|which'], why: 'The difference is ₹15.7 lakh, and both numbers are defensible — only the silence is not.' },
        { key: 'specific', label: 'Actual numbers, not just categories of problem', markers: ['\\d{3}|lakh|crore|%|percent'], why: 'A sanity check that returns adjectives is not a sanity check.' },
        { key: 'tone', label: 'Written so he asks again next time', markers: ['good|worth|glad|thanks|right to|useful|easy fix|small'], why: 'He circulated a draft for checking, which is exactly the behaviour you want. Making that expensive for him is how drafts stop being circulated.' },
      ],
      skills: { communication: 100, businessLogic: 90 },
    },
    estHours: 0.45, priority: 'high', dueInDays: 2, day: 1, difficulty: 'medium',
  },

  'ta-110': {
    title: 'The estate, with its dates',
    hint: "opened_on and closed_on are the point of this one. Two stores are younger than the reporting window.",
    brief: "Before ranking anything, look at what the estate did this year. Write ONE SQL SELECT returning, per store: name, format, opened_on, closed_on, the number of distinct days it recorded a sale, and net revenue. Biggest revenue first.",
    referenceSql: "SELECT st.name, st.format, st.opened_on, st.closed_on, COUNT(DISTINCT s.sold_at) AS trading_days, SUM(s.quantity * s.unit_price) AS net_revenue FROM stores st LEFT JOIN sales s ON s.store_id = st.id GROUP BY st.id ORDER BY net_revenue DESC",
    datasetKey: 'retail_sales', tool: 'sql', estHours: 0.5, priority: 'high', dueInDays: 2, day: 2, difficulty: 'medium',
  },

  'ta-111': {
    title: 'Three stores that break the ranking',
    hint: "Two opened during the window and one closed during it. Ask what an annual total means for each.",
    brief: "Your estate table has three stores that cannot be compared with the rest on an annual total. Say what to do about each.",
    tool: 'choice', datasetKey: 'retail_sales',
    choice: {
      prompt: 'Tick everything that is true.',
      options: [
        { key: 'partial', correct: true, label: 'Sector 29 and Salt Lake opened inside the window, so their totals are part-year', why: 'October and February openings. Ranking them against a full year is ranking them on how long they have existed.' },
        { key: 'closed', correct: true, label: 'Park Street closed in January and is still in the estate table', why: 'It trades for seven months and then stops. Included in a per-store average it drags the estate down; excluded without saying so, the totals no longer reconcile.' },
        { key: 'normalise', correct: true, label: 'A per-trading-day figure makes them comparable, and has to be labelled as such', why: 'It is the right normalisation and it changes the ranking, which means somebody will notice and ask. Say it on the chart.' },
        { key: 'exclude', correct: true, label: 'Any like-for-like growth comparison has to exclude all three', why: 'You cannot compute a half-on-half change for a store that did not trade in both halves. Like-for-like means the same estate in both periods, and that is ten stores here, not thirteen.' },
        { key: 'drop', correct: false, label: 'Drop the three from the pack entirely', why: 'They are a quarter of the estate and two of them are new investments the board specifically wants to see. Excluded from like-for-like, reported separately.' },
        { key: 'annualise', correct: false, label: 'Scale the part-year stores up to a full year so the totals compare', why: 'A February opening annualised on four months of trading is a forecast presented as a result. Show the rate and call it a rate.' },
      ],
      skills: { businessLogic: 100, statistics: 90 },
    },
    estHours: 0.4, priority: 'high', dueInDays: 3, day: 2, difficulty: 'hard',
  },

  'ta-112': {
    title: 'Revenue per trading day',
    hint: "Divide by the days the store actually recorded sales, not by 365.",
    brief: "Normalise the ranking. Write ONE SQL SELECT returning, per store: name, format, distinct trading days, net revenue, and net revenue per trading day rounded to the nearest rupee. Best per day first.",
    referenceSql: "SELECT st.name, st.format, COUNT(DISTINCT s.sold_at) AS trading_days, SUM(s.quantity * s.unit_price) AS net_revenue, ROUND(SUM(s.quantity * s.unit_price) * 1.0 / COUNT(DISTINCT s.sold_at)) AS revenue_per_day FROM stores st JOIN sales s ON s.store_id = st.id GROUP BY st.id ORDER BY revenue_per_day DESC",
    datasetKey: 'retail_sales', tool: 'sql', estHours: 0.6, priority: 'high', dueInDays: 3, day: 2, difficulty: 'hard',
  },

  'ta-113': {
    title: 'Set the denominator standard',
    hint: "Baner records a sale on 268 days out of roughly 365 open. A flagship records one on nearly every day. That gap is the whole argument.",
    brief: "You have used days-with-a-sale as the denominator. There is another — days the store was open — and the two disagree most for exactly the stores the ranking is used to judge. Write to Ravi setting the standard the team will use, and say why. Under 150 words.",
    tool: 'writeup', datasetKey: 'retail_sales',
    writeup: {
      to: 'Ravi Menon', subject: 'Store productivity — which denominator we use', maxWords: 150,
      prompt: 'Which denominator, why it is the right one, and where the two disagree.',
      rubric: [
        { key: 'pick', label: 'A clear decision, not a comparison', markers: ['days open|use|standard|we will|going forward|I want|should be'], why: 'Ravi needs a rule he can apply, not a discussion of two options.' },
        { key: 'why', label: 'Why days open is the honest denominator', markers: ['bad day|no sale|zero|absent|quiet|delete|remove|worst day|still open'], why: 'A day with no sales is a bad day, not a day that did not happen. Dividing by sale-days quietly deletes the worst days from every average.' },
        { key: 'where', label: 'Where the two disagree, with a store named', markers: ['baner|express|268|quiet|low volume|100|hundred'], why: 'The abstract argument convinces nobody. Baner loses nearly a hundred days between the two definitions.' },
        { key: 'derive', label: 'That it is derivable from columns we already have', markers: ['opened_on|closed_on|derive|comput|two column|already|window'], why: 'Pre-empts the "we do not have that data" answer, which is the usual reason the worse denominator survives.' },
        { key: 'scope', label: 'When the annual total is still the right figure', markers: ['total|absolute|board|still|both|alongside|scale|size'], why: 'Per-day is a productivity measure. It does not replace knowing which store is biggest, and a rule that pretends otherwise gets ignored.' },
      ],
      skills: { communication: 100, statistics: 100 },
    },
    estHours: 0.5, priority: 'high', dueInDays: 3, day: 2, difficulty: 'hard',
  },

  'ta-114': {
    title: 'Revenue per day open',
    hint: "julianday() on the two dates, bounded by the window, and remember a store open all year gets the full span.",
    brief: "Do it the better way. Write ONE SQL SELECT returning, per store: name, the number of days it was open within 1 July 2025 to 30 June 2026 inclusive, net revenue, and revenue per day open rounded to the nearest rupee. Best first.",
    referenceSql: "SELECT st.name, CAST(julianday(MIN(COALESCE(st.closed_on, '2026-06-30'), '2026-06-30')) - julianday(MAX(st.opened_on, '2025-07-01')) + 1 AS INTEGER) AS days_open, SUM(s.quantity * s.unit_price) AS net_revenue, ROUND(SUM(s.quantity * s.unit_price) * 1.0 / (julianday(MIN(COALESCE(st.closed_on, '2026-06-30'), '2026-06-30')) - julianday(MAX(st.opened_on, '2025-07-01')) + 1)) AS revenue_per_day_open FROM stores st JOIN sales s ON s.store_id = st.id GROUP BY st.id ORDER BY revenue_per_day_open DESC",
    datasetKey: 'retail_sales', tool: 'sql', estHours: 0.9, priority: 'high', dueInDays: 3, day: 2, difficulty: 'hard',
  },

  'ta-115': {
    title: 'What the normalised ranking changed',
    hint: "Compare the two orderings you now have, and look hardest at the stores that moved.",
    brief: "You have the raw ranking and the per-day-open ranking. Read the difference.",
    tool: 'choice', datasetKey: 'retail_sales',
    choice: {
      prompt: 'Tick everything your own tables support.',
      options: [
        { key: 'flagships', correct: true, label: 'The four flagships lead on both measures, so that part of the story is robust', why: 'Worth saying explicitly. A normalisation that changed everything would be suspicious; one that confirms the obvious part and corrects the rest is doing its job.' },
        { key: 'saltlake', correct: true, label: 'Salt Lake looks far stronger per day than its annual total suggests', why: 'Last in the estate on a five-month total and ahead of all three express stores on a daily rate. That is a new store trading normally, and the raw ranking makes it look like the worst thing in the business.' },
        { key: 'baner', correct: true, label: 'Baner is the weakest store per day open, and the normalisation does not rescue it', why: 'It is not the smallest store by annual revenue — Salt Lake is, because Salt Lake opened in February. On a per-day basis Baner is last by a distance, and a finding that survives the correction is worth more than one that depends on it.' },
        { key: 'format', correct: true, label: 'Format explains most of the spread, so the ranking should be read within format', why: 'Comparing an express store with a flagship on revenue per day is comparing floor space. The useful question is which store is weak FOR ITS FORMAT.' },
        { key: 'close', correct: false, label: 'Park Street should be closed, given where it ranks', why: 'It closed in January. Recommending an action already taken is the clearest possible sign of not having read the estate table.' },
        { key: 'sector', correct: false, label: 'Sector 29 is underperforming and the opening should be reviewed', why: 'Eight months of trading for an express store, mid-table on a daily rate. There is no evidence of underperformance here and an opening review is an expensive thing to trigger.' },
      ],
      skills: { businessLogic: 100, statistics: 90 },
    },
    estHours: 0.4, priority: 'high', dueInDays: 3, day: 2, difficulty: 'hard',
  },

  'ta-120': {
    title: 'The star of the half',
    hint: "Ravi called out one store as up 21%. Restrict to stores that traded the whole window, then split the year in two.",
    brief: "Check the claim. Write ONE SQL SELECT over stores that were open before 1 July 2025 and have not closed, returning per store: net revenue in the first half, net revenue in the second half, and the percentage change to one place. Fastest growing first.",
    referenceSql: "SELECT st.name, SUM(CASE WHEN s.sold_at < '2026-01-01' THEN s.quantity * s.unit_price ELSE 0 END) AS h1, SUM(CASE WHEN s.sold_at >= '2026-01-01' THEN s.quantity * s.unit_price ELSE 0 END) AS h2, ROUND((SUM(CASE WHEN s.sold_at >= '2026-01-01' THEN s.quantity * s.unit_price ELSE 0 END) - SUM(CASE WHEN s.sold_at < '2026-01-01' THEN s.quantity * s.unit_price ELSE 0 END)) * 100.0 / SUM(CASE WHEN s.sold_at < '2026-01-01' THEN s.quantity * s.unit_price ELSE 0 END), 1) AS pct_change FROM stores st JOIN sales s ON s.store_id = st.id WHERE st.opened_on <= '2025-07-01' AND st.closed_on IS NULL GROUP BY st.id ORDER BY pct_change DESC",
    datasetKey: 'retail_sales', tool: 'sql', estHours: 0.8, priority: 'high', dueInDays: 3, day: 3, difficulty: 'hard',
  },

  'ta-121': {
    title: 'One store up, nine down',
    hint: "Every other store in the estate moved the same way. Ask what would make one store an exception.",
    brief: "Ashok Nagar is up 21.1%. Every other like-for-like store is flat or down, four of them by more than 20%. Decide what to do before you write that up.",
    tool: 'choice', datasetKey: 'retail_sales',
    choice: {
      prompt: 'Tick everything that is a sound response.',
      options: [
        { key: 'suspicious', correct: true, label: 'A single store moving against a uniform estate trend is worth checking before reporting', why: 'Not because it is impossible, but because the cost of checking is an hour and the cost of being wrong in a board pack is the next six months of people checking your work instead of reading it.' },
        { key: 'monthly', correct: true, label: 'Break that store down by month — a real trend and a data fault look different', why: 'A store that genuinely improved improves gradually. A feed problem is a step change in one month and normal either side of it.' },
        { key: 'estate', correct: true, label: 'The estate-wide decline is itself the more important finding', why: 'Nine stores down and the second half weaker across the board. That is the sentence the board needs, and it was not in Ravi\'s note at all.' },
        { key: 'praise', correct: false, label: 'Call it out as the success story, as Ravi suggested', why: 'This is the whole test. A number that flatters somebody is the one you check hardest, not the one you check least.' },
        { key: 'ignore', correct: false, label: 'Leave the store out of the pack until it can be explained', why: 'Silently dropping the one store that does not fit is how an analysis becomes a story. Check it, then report what you find.' },
        { key: 'assume', correct: false, label: 'Assume it is a data fault and exclude it', why: 'You would be right, and you would have guessed. Being right by accident is not repeatable and will not survive the first time the guess is wrong.' },
      ],
      skills: { businessLogic: 100, communication: 90 },
    },
    estHours: 0.4, priority: 'urgent', dueInDays: 4, day: 3, difficulty: 'hard',
  },

  'ta-122': {
    title: 'Ashok Nagar, month by month',
    hint: "Lines as well as revenue. If both double in the same month, it is not a trading story.",
    brief: "Break it down. Write ONE SQL SELECT for store 3 only, returning per month: the number of sale lines and net revenue. Oldest month first.",
    referenceSql: "SELECT substr(sold_at, 1, 7) AS month, COUNT(*) AS lines, SUM(quantity * unit_price) AS net_revenue FROM sales WHERE store_id = 3 GROUP BY month ORDER BY month",
    datasetKey: 'retail_sales', tool: 'sql', estHours: 0.35, priority: 'urgent', dueInDays: 4, day: 3, difficulty: 'medium',
  },

  'ta-123': {
    title: 'Find the duplicates',
    hint: "Two rows are suspect when store, product, date, quantity and price all match. Group on all five and count.",
    brief: "March has twice the lines of a normal month. Test whether they are duplicates. Write ONE SQL SELECT returning, per store and month, the number of groups where the same store, product, date, quantity and price appear more than once. Worst first, and only where there are two or more such groups.",
    referenceSql: "SELECT store_id, substr(sold_at, 1, 7) AS month, COUNT(*) AS dup_groups FROM (SELECT store_id, product_id, sold_at, quantity, unit_price, COUNT(*) AS c FROM sales GROUP BY store_id, product_id, sold_at, quantity, unit_price HAVING c > 1) GROUP BY store_id, month HAVING dup_groups >= 2 ORDER BY dup_groups DESC",
    datasetKey: 'retail_sales', tool: 'sql', estHours: 0.9, priority: 'urgent', dueInDays: 4, day: 3, difficulty: 'hard',
  },

  'ta-124': {
    title: 'Duplicate, or two people buying the same thing',
    hint: "A few matching rows in a year of till data is arithmetic. Fifty-two in one store-month is not.",
    brief: "Identical rows exist elsewhere in the estate too. Decide what distinguishes the March problem from ordinary coincidence.",
    tool: 'choice', datasetKey: 'retail_sales',
    choice: {
      prompt: 'Tick everything that is true.',
      options: [
        { key: 'pattern', correct: true, label: 'It is the concentration that identifies it: 52 groups in one store-month against at most 2 anywhere else', why: 'Two customers buying the same product at the same price on the same day is ordinary. It happening to every line in a month is a load, not a coincidence.' },
        { key: 'all', correct: true, label: 'Every one of Ashok Nagar\'s 104 March lines sits in a duplicate group', why: 'That is the decisive test. A partial overlap would be ambiguous; total coverage of one contiguous month is a feed replayed.' },
        { key: 'lines', correct: true, label: 'Line count doubling alongside revenue rules out a trading explanation', why: 'A genuinely strong month has more lines OR bigger baskets. Exactly twice the lines and exactly twice the revenue is a copy.' },
        { key: 'corrected', correct: true, label: 'Corrected, March is about ₹3.46 lakh, in line with the other months', why: 'The correction lands the month exactly where its neighbours are, which is the confirmation that the diagnosis is right.' },
        { key: 'delete', correct: false, label: 'Delete the duplicate rows and carry on', why: 'You do not have write access to the source and should not want it. Report it, quantify it, and exclude it from your own figures.' },
        { key: 'allstores', correct: false, label: 'The other stores with duplicate groups need investigating too', why: 'One or two matching rows across a year is what you would expect by chance. Raising them as incidents is how a real finding gets lost in noise.' },
      ],
      skills: { businessLogic: 100, statistics: 100 },
    },
    estHours: 0.4, priority: 'urgent', dueInDays: 4, day: 3, difficulty: 'hard',
  },

  'ta-125': {
    title: 'Tell Ravi his star is a double load',
    hint: "He put this in a draft and invited a check. Make the correction easy to carry and give him the real story to replace it.",
    brief: "Write to Ravi. The store he wanted to celebrate is a data fault, the estate-wide picture is worse than his draft implied, and both go in the same note. Under 180 words.",
    tool: 'writeup', datasetKey: 'retail_sales',
    writeup: {
      to: 'Ravi Menon', subject: 'Ashok Nagar — the 21% is a duplicated month', maxWords: 180,
      prompt: 'What the fault is, how you know, what the corrected picture looks like, and the finding that replaces it.',
      rubric: [
        { key: 'what', label: 'That March is loaded twice', markers: ['duplicat|twice|double|loaded|march|repeat'], why: 'Say it plainly in the first line. Everything else is support.' },
        { key: 'evidence', label: 'The evidence, with numbers', markers: ['52|104|every line|all of|twice the lines|group'], why: '"It looks wrong" is an opinion. "Every one of 104 lines appears twice" is a finding.' },
        { key: 'corrected', label: 'What the store actually did', markers: ['3\\.4|346|flat|in line|normal|no growth|not up'], why: 'Correcting a number without replacing it leaves him with a hole in the pack.' },
        { key: 'estate', label: 'The estate-wide decline, which is the real story', markers: ['nine|9|every other|estate|down|decline|second half|weaker'], why: 'The reason this matters is not the one store — it is that the pack was about to celebrate growth in a half that fell.' },
        { key: 'ask', label: 'A specific ask about the feed', markers: ['feed|load|source|systems|reload|check|who|raise|confirm'], why: 'The duplicate is still in the warehouse. Naming who fixes it is what turns a finding into a fix.' },
      ],
      skills: { communication: 100, businessLogic: 100 },
    },
    estHours: 0.55, priority: 'urgent', dueInDays: 4, day: 3, difficulty: 'hard',
  },

  'ta-130': {
    title: 'The estate trend, corrected',
    hint: "Same like-for-like population, but exclude the duplicated store-month rather than the whole store.",
    brief: "Rebuild the half-on-half table with the fault removed. Write ONE SQL SELECT over stores open before 1 July 2025 and not closed, EXCLUDING store 3's March 2026 rows, returning per store: first-half revenue, second-half revenue and the percentage change to one place. Fastest growing first.",
    referenceSql: "SELECT st.name, SUM(CASE WHEN s.sold_at < '2026-01-01' THEN s.quantity * s.unit_price ELSE 0 END) AS h1, SUM(CASE WHEN s.sold_at >= '2026-01-01' THEN s.quantity * s.unit_price ELSE 0 END) AS h2, ROUND((SUM(CASE WHEN s.sold_at >= '2026-01-01' THEN s.quantity * s.unit_price ELSE 0 END) - SUM(CASE WHEN s.sold_at < '2026-01-01' THEN s.quantity * s.unit_price ELSE 0 END)) * 100.0 / SUM(CASE WHEN s.sold_at < '2026-01-01' THEN s.quantity * s.unit_price ELSE 0 END), 1) AS pct_change FROM stores st JOIN sales s ON s.store_id = st.id WHERE st.opened_on <= '2025-07-01' AND st.closed_on IS NULL AND NOT (s.store_id = 3 AND substr(s.sold_at, 1, 7) = '2026-03') GROUP BY st.id ORDER BY pct_change DESC",
    datasetKey: 'retail_sales', tool: 'sql', estHours: 0.8, priority: 'high', dueInDays: 5, day: 4, difficulty: 'hard',
  },

  'ta-131': {
    title: 'Region and format',
    hint: "Careful with the denominator. Joining sales to stores repeats each store's days_open once per till line, so the days have to be summed separately from the revenue.",
    brief: "The board will ask where the decline is concentrated. Write ONE SQL SELECT returning, per region: the number of stores, net revenue, and net revenue divided by the region's total store-days open, rounded to the nearest rupee. Biggest revenue first.",
    referenceSql: "WITH d AS (SELECT st.id, st.region, julianday(MIN(COALESCE(st.closed_on, '2026-06-30'), '2026-06-30')) - julianday(MAX(st.opened_on, '2025-07-01')) + 1 AS days FROM stores st), r AS (SELECT st.region, SUM(s.quantity * s.unit_price) AS net_revenue FROM sales s JOIN stores st ON st.id = s.store_id GROUP BY st.region) SELECT d.region, COUNT(*) AS stores, r.net_revenue, ROUND(r.net_revenue * 1.0 / SUM(d.days)) AS revenue_per_day_open FROM d JOIN r ON r.region = d.region GROUP BY d.region ORDER BY r.net_revenue DESC",
    datasetKey: 'retail_sales', tool: 'sql', estHours: 0.7, priority: 'normal', dueInDays: 5, day: 4, difficulty: 'hard',
  },

  'ta-132': {
    title: 'The chart the board will read',
    hint: "Ranked comparison across named stores, and the axis has to start at zero or the gaps lie.",
    brief: "Build the visual: revenue per day open, by store, for the whole estate. Pick the chart type, the fields and the sort.",
    tool: 'chart', datasetKey: 'retail_sales',
    chart: {
      sourceSql: "SELECT st.name AS store, SUM(s.quantity * s.unit_price) * 1.0 / (julianday(MIN(COALESCE(st.closed_on, '2026-06-30'), '2026-06-30')) - julianday(MAX(st.opened_on, '2025-07-01')) + 1) AS revenue_per_day FROM stores st JOIN sales s ON s.store_id = st.id GROUP BY st.id ORDER BY revenue_per_day DESC",
      prompt: 'Revenue per day open, by store, for the board pack.',
      answer: { type: 'bar', x: 'store', y: 'revenue_per_day', sort: 'desc', baselineZero: true },
      why: 'Thirteen named categories compared on one measure is a bar chart, and sorting it is what turns a list into a ranking. A zero baseline is not optional here — the estate spans roughly four thousand to twenty thousand rupees a day, and truncating the axis would make the weakest store look like it sells nothing.',
    },
    estHours: 0.35, priority: 'normal', dueInDays: 5, day: 4, difficulty: 'medium',
  },

  'ta-133': {
    title: 'The number Ravi will be asked for',
    hint: "One figure for the estate, like for like, with the fault out. Say what it covers.",
    brief: "Produce the single headline. Write ONE SQL SELECT returning one row: first-half revenue, second-half revenue and the percentage change to one place, across like-for-like stores only and excluding the duplicated store-month. Label them h1, h2 and pct_change.",
    referenceSql: "SELECT SUM(CASE WHEN s.sold_at < '2026-01-01' THEN s.quantity * s.unit_price ELSE 0 END) AS h1, SUM(CASE WHEN s.sold_at >= '2026-01-01' THEN s.quantity * s.unit_price ELSE 0 END) AS h2, ROUND((SUM(CASE WHEN s.sold_at >= '2026-01-01' THEN s.quantity * s.unit_price ELSE 0 END) - SUM(CASE WHEN s.sold_at < '2026-01-01' THEN s.quantity * s.unit_price ELSE 0 END)) * 100.0 / SUM(CASE WHEN s.sold_at < '2026-01-01' THEN s.quantity * s.unit_price ELSE 0 END), 1) AS pct_change FROM stores st JOIN sales s ON s.store_id = st.id WHERE st.opened_on <= '2025-07-01' AND st.closed_on IS NULL AND NOT (s.store_id = 3 AND substr(s.sold_at, 1, 7) = '2026-03')",
    datasetKey: 'retail_sales', tool: 'sql', estHours: 0.6, priority: 'high', dueInDays: 5, day: 4, difficulty: 'hard',
    // Deliberately flagged for rework: Ravi accepts the figure and then asks for it with
    // the new stores added back in, because the board will want the total business too.
    rework: true,
  },

  'ta-134': {
    title: 'Vikram wants a reason',
    hint: "He is asking you to name a cause. Check what this dataset can and cannot attribute.",
    brief: "The decline is real. Decide what you can say about why.",
    tool: 'choice', datasetKey: 'retail_sales',
    choice: {
      exhibit: {
        kind: 'email', from: 'Vikram Nair', subject: 'Second half decline — cause?',
        body: "Nine of ten stores down, some by a quarter. That is going to be the first question in the room and I need an answer, not a table.\n\nIs it footfall, pricing, the range, the economy? Pick one.",
      },
      prompt: 'Tick everything that is an honest response.',
      options: [
        { key: 'cannot', correct: true, label: 'This data cannot separate those causes — there is no footfall, no competitor and no market data in it', why: 'Sales, products, stores, stock. Every candidate cause he listed lives outside all four tables.' },
        { key: 'promo', correct: true, label: 'Part of the first half is a promotion month, which flatters the comparison', why: 'November is the biggest month of the year by revenue and it is discount-driven. Half-on-half against a period containing it is not a like-for-like period, even across like-for-like stores.' },
        { key: 'what', correct: true, label: 'You can say what declined — which categories, which formats — without saying why', why: 'That is genuinely useful in the room and it is defensible. "I can tell you where, not why" is a complete answer.' },
        { key: 'offer', correct: true, label: 'Name what data would answer his question', why: 'Footfall counters and a competitor opening schedule would settle it. Saying so turns a refusal into a request.' },
        { key: 'pick', correct: false, label: 'Pick the most plausible cause so he has something to say', why: 'He asked you to pick one, and picking one you cannot evidence is how an analyst becomes the source of a wrong answer with their name on it.' },
        { key: 'economy', correct: false, label: 'Attribute it to the wider market, which is safest', why: 'It is the least falsifiable answer available and therefore the most dangerous. Nothing in the data speaks to the market at all.' },
      ],
      skills: { businessLogic: 100, communication: 100 },
    },
    estHours: 0.4, priority: 'high', dueInDays: 5, day: 4, difficulty: 'hard',
  },

  'ta-135': {
    title: 'Category movement, half on half',
    hint: "Same like-for-like restriction, grouped by category instead of store.",
    brief: "Answer the half of Vikram's question you can. Write ONE SQL SELECT over like-for-like stores, excluding the duplicated store-month, returning per category: first-half revenue, second-half revenue and percentage change to one place. Worst decline first.",
    referenceSql: "SELECT p.category, SUM(CASE WHEN s.sold_at < '2026-01-01' THEN s.quantity * s.unit_price ELSE 0 END) AS h1, SUM(CASE WHEN s.sold_at >= '2026-01-01' THEN s.quantity * s.unit_price ELSE 0 END) AS h2, ROUND((SUM(CASE WHEN s.sold_at >= '2026-01-01' THEN s.quantity * s.unit_price ELSE 0 END) - SUM(CASE WHEN s.sold_at < '2026-01-01' THEN s.quantity * s.unit_price ELSE 0 END)) * 100.0 / SUM(CASE WHEN s.sold_at < '2026-01-01' THEN s.quantity * s.unit_price ELSE 0 END), 1) AS pct_change FROM sales s JOIN products p ON p.id = s.product_id JOIN stores st ON st.id = s.store_id WHERE st.opened_on <= '2025-07-01' AND st.closed_on IS NULL AND NOT (s.store_id = 3 AND substr(s.sold_at, 1, 7) = '2026-03') GROUP BY p.category ORDER BY pct_change ASC",
    datasetKey: 'retail_sales', tool: 'sql', estHours: 0.75, priority: 'high', dueInDays: 5, day: 4, difficulty: 'hard',
  },

  'ta-140': {
    title: 'The new stores, reported separately',
    hint: "These three are excluded from like-for-like, which is exactly why they need their own line.",
    brief: "The board invested in two openings and closed one store. Write ONE SQL SELECT over stores that opened after 1 July 2025 or have closed, returning per store: name, opened_on, closed_on, days open in the window, net revenue, and revenue per day open rounded to the nearest rupee. Best per day first.",
    referenceSql: "SELECT st.name, st.opened_on, st.closed_on, CAST(julianday(MIN(COALESCE(st.closed_on, '2026-06-30'), '2026-06-30')) - julianday(MAX(st.opened_on, '2025-07-01')) + 1 AS INTEGER) AS days_open, SUM(s.quantity * s.unit_price) AS net_revenue, ROUND(SUM(s.quantity * s.unit_price) * 1.0 / (julianday(MIN(COALESCE(st.closed_on, '2026-06-30'), '2026-06-30')) - julianday(MAX(st.opened_on, '2025-07-01')) + 1)) AS revenue_per_day_open FROM stores st JOIN sales s ON s.store_id = st.id WHERE st.opened_on > '2025-07-01' OR st.closed_on IS NOT NULL GROUP BY st.id ORDER BY revenue_per_day_open DESC",
    datasetKey: 'retail_sales', tool: 'sql', estHours: 0.7, priority: 'high', dueInDays: 5, day: 5, difficulty: 'hard',
  },

  'ta-141': {
    title: 'Every figure, and what it covers',
    hint: "Build the reconciliation: total business, like-for-like, and the difference between them.",
    brief: "A board pack has to reconcile. In the notebook, compute three figures for the whole window: total net revenue across the entire estate, net revenue across like-for-like stores only, and net revenue from stores excluded from like-for-like — all with store 3's March 2026 rows removed. Assign a dict with keys total, like_for_like and excluded, each rounded to the nearest rupee, to `result`.",
    tool: 'python', datasetKey: 'retail_sales',
    estHours: 0.8, priority: 'high', dueInDays: 5, day: 5, difficulty: 'hard',
    referenceCompute: (tables) => {
      const stores = new Map(tables.stores.map((s) => [s.id, s]));
      let total = 0, lfl = 0, excluded = 0;
      for (const s of tables.sales) {
        if (s.store_id === 3 && s.sold_at.slice(0, 7) === '2026-03') continue;
        const value = s.quantity * s.unit_price;
        const store = stores.get(s.store_id);
        total += value;
        if (store.opened_on <= '2025-07-01' && store.closed_on == null) lfl += value;
        else excluded += value;
      }
      return { total: Math.round(total), like_for_like: Math.round(lfl), excluded: Math.round(excluded) };
    },
  },

  'ta-142': {
    title: 'What the pack says',
    hint: "Five candidate headlines. Two of them are things you established and two are things you were asked to say.",
    brief: "Decide what the board actually hears.",
    tool: 'choice', datasetKey: 'retail_sales',
    choice: {
      prompt: 'Tick everything that belongs in the pack.',
      options: [
        { key: 'decline', correct: true, label: 'Like-for-like trading declined in the second half across nine of ten stores', why: 'The central finding, and it was not in the draft you were sent to check.' },
        { key: 'fault', correct: true, label: 'One store-month is duplicated in the source and has been excluded', why: 'Disclosing your own correction is what lets somebody reproduce your number. Quietly excluding it means the figures never reconcile with the warehouse again.' },
        { key: 'new', correct: true, label: 'The two new stores are trading in line with their format, reported separately', why: 'They are excluded from like-for-like for a methodological reason, not a performance one, and the board approved the capital.' },
        { key: 'nocause', correct: true, label: 'That the cause cannot be established from this data, and what would establish it', why: 'The question will be asked. Having the answer to "what would you need" ready is the difference between a limit and an excuse.' },
        { key: 'ashokstar', correct: false, label: 'Ashok Nagar as the standout performer', why: 'It is flat once corrected. This is the line the draft opened with and the reason the check was worth doing.' },
        { key: 'economy', correct: false, label: 'That the decline reflects wider market conditions', why: 'Nothing in four tables of till data speaks to the market. It is the most quotable unfalsifiable sentence available and it would be yours.' },
      ],
      skills: { communication: 100, businessLogic: 100 },
    },
    estHours: 0.4, priority: 'high', dueInDays: 5, day: 5, difficulty: 'hard',
  },

  'ta-143': {
    title: 'Sign off Priya\'s slide',
    hint: "Read what the words claim on top of the numbers. The numbers are yours and they are right.",
    brief: "Priya has drafted the trading slide using your figures. Tick every problem with it.",
    tool: 'choice', datasetKey: 'retail_sales',
    choice: {
      exhibit: {
        kind: 'email', from: 'Priya Menon', subject: 'Trading slide — sign off?',
        body: "\"Like-for-like revenue fell 17.3% in H2, driven by a category-wide slowdown in Equipment. Two new stores are already outperforming the estate average. Data quality issues in one store have been corrected.\"\n\nThat's your numbers. OK to go?",
      },
      prompt: 'What needs changing before this goes in?',
      options: [
        { key: 'driven', correct: true, label: '"Driven by" claims a cause the analysis does not establish', why: 'Equipment declined and Equipment is the largest category, so of course it moves the total. That is arithmetic, not a driver, and the word invites a decision about Equipment.' },
        { key: 'outperform', correct: true, label: '"Outperforming the estate average" compares an express store to a flagship average', why: 'Sector 29 is mid-table for its format and below the estate average per day. The claim is flattering and false, and it is about the board\'s own capital decision.' },
        { key: 'vague', correct: true, label: '"Data quality issues have been corrected" hides what was excluded', why: 'One store-month was dropped from the figures. If the next person reruns this and gets a different number, that sentence is why they will not know where to look.' },
        { key: 'promo', correct: true, label: 'The comparison period contains a promotion month and the slide does not say so', why: 'November is the biggest month of the year and discount-driven. Half-on-half against it overstates the decline, and the board will not know unless it is written down.' },
        { key: 'figure', correct: false, label: 'The 17.3% figure is wrong', why: 'It is your figure and it is right. The problem is everything built on top of it.' },
        { key: 'nothing', correct: false, label: 'It is fine — the numbers are correct and she is the one presenting', why: 'Your name is on the data. A slide that is arithmetically right and rhetorically wrong is still wrong, and sign-off is exactly the moment to say so.' },
      ],
      skills: { communication: 100, businessLogic: 100 },
    },
    estHours: 0.45, priority: 'high', dueInDays: 5, day: 5, difficulty: 'hard',
  },

  'ta-144': {
    title: 'Rewrite the slide',
    hint: "Same four facts, none of the claims. Shorter than hers.",
    brief: "Send Priya a replacement for the slide text. It has to survive being read aloud with you not in the room. Under 110 words.",
    tool: 'writeup', datasetKey: 'retail_sales',
    writeup: {
      to: 'Priya Menon', subject: 'Trading slide — suggested wording', maxWords: 110,
      prompt: 'The decline, the scope it covers, the new stores stated fairly, and the exclusion named.',
      rubric: [
        { key: 'lfl', label: 'The decline, scoped to like-for-like', markers: ['like.for.like|lfl|ten store|10 store|same store|17|decline|fell'], why: 'The number means nothing without the population it covers.' },
        { key: 'nocause', label: 'No causal claim', markers: ['largest|biggest|share|arithmetic|not|cannot|where|concentrat'], why: 'Describe where the decline sits without asserting what caused it.' },
        { key: 'newstores', label: 'The new stores stated against their own format', why: 'Comparing an express store to an estate average that is mostly flagships is the error in her draft.', markers: ['format|express|for its|comparable|own|like|separate'] },
        { key: 'exclusion', label: 'The excluded store-month named', markers: ['march|ashok|store 3|duplicat|excluded|one month'], why: 'So the figure can be reproduced by anyone who tries.' },
        { key: 'promo', label: 'The promotion in the comparison period', markers: ['promotion|november|discount|promo'], why: 'The single most important caveat on a half-on-half figure this year.' },
      ],
      skills: { communication: 100 },
    },
    estHours: 0.5, priority: 'high', dueInDays: 5, day: 5, difficulty: 'hard',
  },

  'ta-145': {
    title: 'What you would do next quarter',
    hint: "You have found one data fault and one reporting habit. Both have a fix that outlives this pack.",
    brief: "Asha wants your view as the lead, not as the analyst. What changes about how this reporting is produced? Under 200 words.",
    tool: 'writeup', datasetKey: 'retail_sales',
    writeup: {
      to: 'Asha Rao', subject: 'Trading review — what I would change', maxWords: 200,
      prompt: 'The process changes that would have caught this week\'s problems before they reached a draft.',
      rubric: [
        { key: 'dupcheck', label: 'A duplicate check that runs before the pack is built', markers: ['check|test|automat|before|monitor|alert|routine|each month|validat'], why: 'The fault was findable in one query. The problem was that nobody ran it, and that is fixable permanently.' },
        { key: 'definitions', label: 'Agreed definitions for revenue, transactions and like-for-like', markers: ['definition|define|agree|document|standard|glossary|consistent'], why: 'Three of this week\'s problems were one team meaning something different by a common word.' },
        { key: 'lfl', label: 'Like-for-like as a standing rule when the estate changes', markers: ['like.for.like|lfl|open|clos|estate|new store|exclude'], why: 'Two openings and a closure in one year, and nothing in the reporting knew about any of them.' },
        { key: 'review', label: 'That drafts get checked before they reach a board, not after', markers: ['draft|check|review|before|sign.?off|circulat|early'], why: 'Ravi did the right thing by sending it. Making that a step rather than a favour is the lead\'s job.' },
        { key: 'own', label: 'Written as decisions you would make, not suggestions', markers: ['I would|we should|I will|propose|put in place|add|introduce|make'], why: 'This is the first thing you are asked as a lead. Hedging it reads as declining the responsibility.' },
      ],
      skills: { communication: 100, businessLogic: 100 },
    },
    estHours: 0.6, priority: 'high', dueInDays: 5, day: 5, difficulty: 'hard',
  },


  // ---- Lead 2 · Margin & Promotion Review (retail_sales) --------------------------
  // The week the learner finds out that the cost column is a lie of timing. Monday there
  // is no margin column and the cost that exists is today's. Tuesday Equipment turns out
  // to be two thirds of revenue and the worst margin in the book. Wednesday the naive
  // cost understates margin UNEVENLY — 7% in Equipment, nothing in Tea — so it distorts
  // the ranking rather than shifting it. Thursday November: 55% more units, 39% more
  // revenue, 12% more margin. Friday, whether to do it again.

  'tb-101': {
    title: 'There is no margin column',
    hint: "Look at what products actually carries, and at the two columns next to unit_cost.",
    brief: "Finance want margin by category before the range review. Establish what you can compute and what the cost column actually means before writing anything.",
    tool: 'choice', datasetKey: 'retail_sales',
    choice: {
      exhibit: {
        kind: 'email', from: 'Diya Chandra', subject: 'Margin by category — before the range review',
        body: "We are rebuilding the range plan and I need gross margin by category for the year.\n\nI assume it is unit_price minus unit_cost times quantity? If it is that simple just send me the table and I will stop bothering you.",
      },
      prompt: 'Tick everything that is true before you run her query.',
      options: [
        { key: 'today', correct: true, label: 'unit_cost is the cost TODAY, not the cost when the sale happened', why: 'The table carries previous_unit_cost and cost_changed_on beside it. Those two columns exist precisely because the current cost is not what we paid all year.' },
        { key: 'fifteen', correct: true, label: 'Fifteen products were repriced during the year, and they are a quarter of revenue', why: '26.6% of turnover sits on products whose cost moved. That is far too much to wave through as immaterial.' },
        { key: 'direction', correct: true, label: 'Applying current cost to old sales will understate margin, because the reprices were increases', why: 'Every one of the fifteen went up, by 19% on average. Charging this year\'s cost against last year\'s sales makes the earlier period look less profitable than it was.' },
        { key: 'simple', correct: false, label: 'Her formula is right — it is that simple', why: 'It is right for the 53 products that never moved and wrong for the 15 that did, which is the quarter of revenue she most cares about.' },
        { key: 'cannot', correct: false, label: 'Margin cannot be computed at all without a proper cost history', why: 'You have the previous cost and the date it changed. That is a cost history — a two-point one, but enough to do this properly.' },
        { key: 'returns', correct: false, label: 'Returns make margin impossible to compute', why: 'A return reverses a sale at the price paid, so the margin reverses with it. Negative quantities handle themselves here, which is unusual and worth noticing.' },
      ],
      skills: { businessLogic: 100, statistics: 90 },
    },
    estHours: 0.35, priority: 'high', dueInDays: 1, day: 1, difficulty: 'hard',
  },

  'tb-102': {
    title: 'What moved, and by how much',
    hint: "Only the repriced rows matter here. The percentage is against the OLD cost.",
    brief: "Size the problem. Write ONE SQL SELECT over products whose cost changed, returning: name, category, previous_unit_cost, unit_cost, the increase as a percentage of the previous cost rounded to one place, and the date it changed. Biggest rise first.",
    referenceSql: "SELECT name, category, previous_unit_cost, unit_cost, ROUND((unit_cost - previous_unit_cost) * 100.0 / previous_unit_cost, 1) AS rise_pct, cost_changed_on FROM products WHERE cost_changed_on IS NOT NULL ORDER BY rise_pct DESC",
    datasetKey: 'retail_sales', tool: 'sql', estHours: 0.4, priority: 'high', dueInDays: 1, day: 1, difficulty: 'medium',
  },

  'tb-103': {
    title: 'How much revenue sits on moved costs',
    hint: "One row, two figures, and the share is the point.",
    brief: "Establish materiality. Write ONE SQL SELECT over products THAT SOLD, split by whether the product was ever repriced, returning: the number of such products, net revenue, and that revenue as a percentage of the total rounded to one place. Label the split column repriced with values yes and no.",
    referenceSql: "SELECT CASE WHEN p.cost_changed_on IS NOT NULL THEN 'yes' ELSE 'no' END AS repriced, COUNT(DISTINCT p.id) AS products, SUM(s.quantity * s.unit_price) AS net_revenue, ROUND(SUM(s.quantity * s.unit_price) * 100.0 / (SELECT SUM(quantity * unit_price) FROM sales), 1) AS pct_of_revenue FROM products p JOIN sales s ON s.product_id = p.id GROUP BY repriced ORDER BY net_revenue DESC",
    datasetKey: 'retail_sales', tool: 'sql', estHours: 0.55, priority: 'high', dueInDays: 1, day: 1, difficulty: 'hard',
  },

  'tb-104': {
    title: 'Margin, with the cost that applied',
    hint: "A CASE on the sale date against cost_changed_on. Write it once and you will reuse it every day this week.",
    brief: "Build the expression the whole project rests on. Write ONE SQL SELECT returning, per category: net revenue, gross margin using the cost that applied on the day of sale, and margin as a percentage of revenue to one place. Biggest margin first.",
    referenceSql: "SELECT p.category, SUM(s.quantity * s.unit_price) AS net_revenue, ROUND(SUM(s.quantity * (s.unit_price - CASE WHEN p.cost_changed_on IS NOT NULL AND s.sold_at < p.cost_changed_on THEN p.previous_unit_cost ELSE p.unit_cost END))) AS margin, ROUND(SUM(s.quantity * (s.unit_price - CASE WHEN p.cost_changed_on IS NOT NULL AND s.sold_at < p.cost_changed_on THEN p.previous_unit_cost ELSE p.unit_cost END)) * 100.0 / SUM(s.quantity * s.unit_price), 1) AS margin_pct FROM sales s JOIN products p ON p.id = s.product_id GROUP BY p.category ORDER BY margin DESC",
    datasetKey: 'retail_sales', tool: 'sql', estHours: 0.8, priority: 'high', dueInDays: 2, day: 1, difficulty: 'hard',
  },

  'tb-105': {
    title: 'Answer Diya',
    hint: "She offered to stop bothering you if it was simple. It nearly is, and the exception is a quarter of revenue.",
    brief: "Write back on day one. Tell her what is wrong with the formula, how wrong, and give her the version that works. Under 150 words.",
    tool: 'writeup', datasetKey: 'retail_sales',
    writeup: {
      to: 'Diya Chandra', subject: 'Margin — the cost column is today\'s cost', maxWords: 150,
      prompt: 'What her formula misses, how material it is, and the corrected expression.',
      rubric: [
        { key: 'today', label: 'That unit_cost is current, not historical', markers: ['today|current|now|not.*time of sale|changed|historic'], why: 'The whole finding in one sentence, and it is not obvious from the column name.' },
        { key: 'size', label: 'How much revenue it affects', markers: ['15|fifteen|26|quarter|27%|material'], why: 'Materiality is what decides whether she cares. A quarter of revenue does.' },
        { key: 'fix', label: 'The corrected rule, stated so she can apply it', markers: ['previous_unit_cost|cost_changed_on|before|case|date|which cost'], why: 'Give her the expression. A description of the problem leaves her unable to run anything.' },
        { key: 'direction', label: 'Which way the error goes', markers: ['understate|lower|worse|too low|below|increase|rose|up'], why: 'The reprices were increases, so the naive figure makes the past look less profitable. Knowing the direction tells her which of her old numbers to distrust.' },
        { key: 'yes', label: 'That she was nearly right', markers: ['right|correct|close|nearly|almost|53|most product|otherwise'], why: 'She asked a good question and 53 of 68 products behave exactly as she assumed. Saying so is accurate and keeps the questions coming.' },
      ],
      skills: { communication: 100, businessLogic: 90 },
    },
    estHours: 0.45, priority: 'high', dueInDays: 2, day: 1, difficulty: 'medium',
  },

  'tb-106': {
    title: 'Which cost belongs in which question',
    hint: "Two different questions are being asked of the same table, and they want different costs.",
    brief: "Diya replies asking a sharper question: if she is planning NEXT year's range, should she still use the historical cost?",
    tool: 'choice', datasetKey: 'retail_sales',
    choice: {
      exhibit: {
        kind: 'email', from: 'Diya Chandra', subject: 'Re: Margin — one more thing',
        body: "Understood for reporting what happened. But the range review is about what to stock NEXT year.\n\nFor that, surely I want today's cost, not what we paid in September?",
      },
      prompt: 'Tick everything that is true.',
      options: [
        { key: 'forward', correct: true, label: 'She is right for the forward-looking question — current cost is the relevant one', why: 'What a product will earn next year depends on what it will cost next year. The historical cost is irrelevant to a stocking decision.' },
        { key: 'backward', correct: true, label: 'And wrong for the reporting question, where the historical cost is the only honest one', why: 'Last year\'s performance has to be measured against last year\'s costs. Restating it at current cost rewrites history.' },
        { key: 'both', correct: true, label: 'The two figures should be produced separately and labelled by purpose', why: 'One table headed "margin" with no statement of which cost basis it uses is how two teams end up with different numbers and no way to reconcile them.' },
        { key: 'volume', correct: true, label: 'A forward view should also use current PRICE, not the discounted prices actually charged', why: 'Half the year\'s Equipment revenue was sold at a discount. Projecting forward on realised prices bakes in a promotion nobody has decided to repeat.' },
        { key: 'never', correct: false, label: 'Current cost should never be used — it is not what happened', why: 'Too rigid. It is exactly right for a decision about the future, which is what a range review is.' },
        { key: 'avg', correct: false, label: 'Average the two costs, so one figure serves both purposes', why: 'That produces a number that is correct for neither question and is impossible to explain in a meeting.' },
      ],
      skills: { businessLogic: 100, communication: 100 },
    },
    estHours: 0.4, priority: 'high', dueInDays: 2, day: 1, difficulty: 'hard',
  },

  'tb-110': {
    title: 'Where the money actually is',
    hint: "Revenue share and margin share are different columns and they will not agree.",
    brief: "Set up the category picture. Write ONE SQL SELECT returning, per category: net revenue, its share of total revenue to one place, margin on the cost that applied, and margin's share of total margin to one place. Biggest revenue first.",
    referenceSql: "SELECT p.category, SUM(s.quantity * s.unit_price) AS net_revenue, ROUND(SUM(s.quantity * s.unit_price) * 100.0 / (SELECT SUM(quantity * unit_price) FROM sales), 1) AS revenue_share, ROUND(SUM(s.quantity * (s.unit_price - CASE WHEN p.cost_changed_on IS NOT NULL AND s.sold_at < p.cost_changed_on THEN p.previous_unit_cost ELSE p.unit_cost END))) AS margin, ROUND(SUM(s.quantity * (s.unit_price - CASE WHEN p.cost_changed_on IS NOT NULL AND s.sold_at < p.cost_changed_on THEN p.previous_unit_cost ELSE p.unit_cost END)) * 100.0 / (SELECT SUM(s2.quantity * (s2.unit_price - CASE WHEN p2.cost_changed_on IS NOT NULL AND s2.sold_at < p2.cost_changed_on THEN p2.previous_unit_cost ELSE p2.unit_cost END)) FROM sales s2 JOIN products p2 ON p2.id = s2.product_id), 1) AS margin_share FROM sales s JOIN products p ON p.id = s.product_id GROUP BY p.category ORDER BY net_revenue DESC",
    datasetKey: 'retail_sales', tool: 'sql', estHours: 0.9, priority: 'high', dueInDays: 2, day: 2, difficulty: 'hard',
  },

  'tb-111': {
    title: 'Equipment is the business',
    hint: "Two thirds of revenue at the worst rate in the book. Ask what follows and what does not.",
    brief: "Equipment is 63.9% of revenue and 34.7% margin — the lowest rate of the five categories. Read that properly.",
    tool: 'choice', datasetKey: 'retail_sales',
    choice: {
      prompt: 'Tick everything your table supports.',
      options: [
        { key: 'dominant', correct: true, label: 'Equipment is the business by revenue and still the largest margin contributor', why: '₹3.1 crore of revenue and ₹1.08 crore of margin. The worst RATE in the book is also the biggest absolute contribution, and confusing the two is how a range gets cut.' },
        { key: 'rate', correct: true, label: 'Merchandise earns 65% margin and contributes a fraction of the money', why: '₹28 lakh of margin against Equipment\'s ₹1.08 crore. A high rate on a small base is a nice thing to have, not a strategy.' },
        { key: 'mix', correct: true, label: 'The blended margin rate is mostly a statement about the sales mix', why: 'Shift a little revenue between Equipment and Merchandise and the blended rate moves without any product changing price or cost. Any target set on the blended rate can be hit by mix alone.' },
        { key: 'kill', correct: false, label: 'Equipment should be de-emphasised in favour of higher-margin categories', why: 'Sell half as much Equipment and you lose half of ₹1.08 crore. Merchandise would have to quadruple to replace it, and there is no evidence anybody wants four times as many mugs.' },
        { key: 'bad', correct: false, label: 'A 34.7% margin on the largest category is a problem to fix', why: 'It may be entirely normal for hardware. Nothing in this data says what the category should earn, and calling it a problem assumes an answer.' },
        { key: 'target', correct: false, label: 'The blended rate is the right measure to set a target on', why: 'It is the one number in the table that can be improved by selling a different mix rather than trading better. Targets set on it get hit without anything improving.' },
      ],
      skills: { businessLogic: 100, statistics: 100 },
    },
    estHours: 0.4, priority: 'high', dueInDays: 3, day: 2, difficulty: 'hard',
  },

  'tb-112': {
    title: 'Margin by store, like for like',
    hint: "Restrict to the stable estate — a store that opened in February cannot be compared on a year of margin.",
    brief: "Write ONE SQL SELECT over stores open before 1 July 2025 and not closed, returning per store: net revenue, margin on the cost that applied, and margin percentage to one place. Best rate first.",
    referenceSql: "SELECT st.name, SUM(s.quantity * s.unit_price) AS net_revenue, ROUND(SUM(s.quantity * (s.unit_price - CASE WHEN p.cost_changed_on IS NOT NULL AND s.sold_at < p.cost_changed_on THEN p.previous_unit_cost ELSE p.unit_cost END))) AS margin, ROUND(SUM(s.quantity * (s.unit_price - CASE WHEN p.cost_changed_on IS NOT NULL AND s.sold_at < p.cost_changed_on THEN p.previous_unit_cost ELSE p.unit_cost END)) * 100.0 / SUM(s.quantity * s.unit_price), 1) AS margin_pct FROM sales s JOIN products p ON p.id = s.product_id JOIN stores st ON st.id = s.store_id WHERE st.opened_on <= '2025-07-01' AND st.closed_on IS NULL GROUP BY st.id ORDER BY margin_pct DESC",
    datasetKey: 'retail_sales', tool: 'sql', estHours: 0.8, priority: 'high', dueInDays: 3, day: 2, difficulty: 'hard',
  },

  'tb-113': {
    title: 'The margin chart',
    hint: "Two things per category — the size of the money and the rate it earns. Only one of them is what a bar length should mean here.",
    brief: "Build the visual for the range review: margin contribution by category, so the reader sees where the money comes from before they see which rate is highest. Pick the chart type, the fields and the sort.",
    tool: 'chart', datasetKey: 'retail_sales',
    chart: {
      sourceSql: "SELECT p.category, SUM(s.quantity * (s.unit_price - CASE WHEN p.cost_changed_on IS NOT NULL AND s.sold_at < p.cost_changed_on THEN p.previous_unit_cost ELSE p.unit_cost END)) AS margin FROM sales s JOIN products p ON p.id = s.product_id GROUP BY p.category ORDER BY margin DESC",
      prompt: 'Gross margin contribution by category, for the range review.',
      answer: { type: 'bar', x: 'category', y: 'margin', sort: 'desc', baselineZero: true },
      why: 'Five named categories compared on one quantity is a bar chart, sorted so the contribution order is the first thing read. Margin in rupees rather than margin rate, because the decision the review is about is where the money comes from — a rate chart would put Merchandise first and Equipment last, which is the exact inversion that gets a range cut.',
    },
    estHours: 0.35, priority: 'normal', dueInDays: 3, day: 2, difficulty: 'medium',
  },

  'tb-114': {
    title: 'Ravi has a margin target',
    hint: "Ask what somebody could do to hit this target without anything actually improving.",
    brief: "Ravi proposes a target. Decide what is wrong with it.",
    tool: 'choice', datasetKey: 'retail_sales',
    choice: {
      exhibit: {
        kind: 'chat', from: 'Ravi Menon', subject: '#retail-analytics',
        body: "Proposing we set the team a blended gross margin target of 46% for next year, up from 44.1%.\n\nSimple, one number, everyone understands it. Thoughts?",
      },
      prompt: 'Tick every problem with the target as proposed.',
      options: [
        { key: 'mix', correct: true, label: 'It can be hit by selling less Equipment, with no product trading better', why: 'Equipment is 64% of revenue at the lowest rate. Shrinking it lifts the blend and shrinks the business, and the target would record that as success.' },
        { key: 'absolute', correct: true, label: 'It sets a rate target on a business that needs absolute margin', why: 'Rent and payroll are paid in rupees, not percentages. A higher rate on a smaller base can be a worse year in every way that matters.' },
        { key: 'basis', correct: true, label: 'It does not say which cost basis it is measured on', why: 'Current cost or cost at time of sale changes the whole-year figure by more than four percent — which is twice the improvement he is asking for.' },
        { key: 'pair', correct: true, label: 'A rate target needs a volume or absolute-margin figure beside it', why: 'Two numbers that cannot both be gamed in the same direction. That is the whole fix and it costs one extra line.' },
        { key: 'low', correct: false, label: '46% is too ambitious given the category mix', why: 'You have no basis for that. Nothing in this data says what margin is achievable, and guessing at ambition is the same error as guessing at causes.' },
        { key: 'category', correct: false, label: 'Targets should be set per category instead', why: 'Reasonable and it does not fix the main problem — per-category rate targets are still hit by shifting mix within the category.' },
      ],
      skills: { businessLogic: 100, communication: 100 },
    },
    estHours: 0.4, priority: 'high', dueInDays: 3, day: 2, difficulty: 'hard',
  },

  'tb-115': {
    title: 'Reply to Ravi in the channel',
    hint: "He proposed something in public and asked for thoughts. Give him a better version, not a veto.",
    brief: "Answer in the channel. The idea is right and the measure is gameable. Propose the fix. Under 120 words.",
    tool: 'writeup', datasetKey: 'retail_sales',
    writeup: {
      to: 'Ravi Menon', subject: 'Re: blended margin target', maxWords: 120,
      prompt: 'Why the blended rate alone is gameable, and what to pair it with.',
      rubric: [
        { key: 'game', label: 'How the target can be hit without improving', markers: ['mix|equipment|less|shift|sell fewer|shrink|without'], why: 'Concrete and specific. "Gameable" on its own sounds like a theoretical objection.' },
        { key: 'pair', label: 'A specific pairing', markers: ['absolute|rupee|total margin|volume|alongside|both|pair|second'], why: 'The fix, in one line, so the proposal survives rather than dying.' },
        { key: 'basis', label: 'That the cost basis has to be stated', markers: ['cost basis|which cost|time of sale|current|historic|define'], why: 'Otherwise the baseline moves by more than the target.' },
        { key: 'yes', label: 'Support for the underlying idea', markers: ['good|agree|right|worth|like|yes|support|sensible'], why: 'A target is a good instinct. Replying with only objections is how people stop proposing things in the open.' },
      ],
      skills: { communication: 100 },
    },
    estHours: 0.35, priority: 'normal', dueInDays: 3, day: 2, difficulty: 'medium',
  },

  'tb-120': {
    title: 'Both versions, side by side',
    hint: "Same query twice, one with the CASE and one without. The difference is the column that matters.",
    brief: "Quantify what Diya's original formula would have cost her. Write ONE SQL SELECT returning, per category: margin using current cost only, margin using the cost that applied, and how much the naive figure understates it as a percentage of the correct margin, to two places. Most understated first.",
    referenceSql: "SELECT p.category, ROUND(SUM(s.quantity * (s.unit_price - p.unit_cost))) AS margin_naive, ROUND(SUM(s.quantity * (s.unit_price - CASE WHEN p.cost_changed_on IS NOT NULL AND s.sold_at < p.cost_changed_on THEN p.previous_unit_cost ELSE p.unit_cost END))) AS margin_correct, ROUND((SUM(s.quantity * (s.unit_price - CASE WHEN p.cost_changed_on IS NOT NULL AND s.sold_at < p.cost_changed_on THEN p.previous_unit_cost ELSE p.unit_cost END)) - SUM(s.quantity * (s.unit_price - p.unit_cost))) * 100.0 / SUM(s.quantity * (s.unit_price - CASE WHEN p.cost_changed_on IS NOT NULL AND s.sold_at < p.cost_changed_on THEN p.previous_unit_cost ELSE p.unit_cost END)), 2) AS understated_pct FROM sales s JOIN products p ON p.id = s.product_id GROUP BY p.category ORDER BY understated_pct DESC",
    datasetKey: 'retail_sales', tool: 'sql', estHours: 0.8, priority: 'high', dueInDays: 4, day: 3, difficulty: 'hard',
  },

  'tb-121': {
    title: 'An error that is not a shift',
    hint: "Compare the size of the error across the five categories. It is not the same anywhere.",
    brief: "The naive method understates Equipment by 6.99%, Coffee by 3.22%, Bakery by 1.46% and Tea and Merchandise by nothing at all. Work out why that matters more than the size of the error.",
    tool: 'choice', datasetKey: 'retail_sales',
    choice: {
      prompt: 'Tick everything that is true.',
      options: [
        { key: 'uneven', correct: true, label: 'Because it is uneven, it distorts the comparison between categories, not just the totals', why: 'A uniform 4% error would leave every ranking and every ratio intact. This one moves Equipment relative to Tea, which is exactly the comparison a range review is built on.' },
        { key: 'where', correct: true, label: 'The error sits wherever the repriced products are, which is not evenly spread', why: 'Tea and Merchandise had no reprices at all. Equipment carries most of them and most of the revenue, so it absorbs almost all the distortion.' },
        { key: 'trend', correct: true, label: 'It also distorts any comparison across time, because the error grows the further back you look', why: 'Before a cost change the two methods differ; after it they agree. So the naive method penalises the past and flatters the present, which manufactures an improving trend.' },
        { key: 'small', correct: false, label: 'At under 7% it is within tolerance for a range review', why: 'The decision is between categories whose rates differ by 30 points, but the CHANGES being argued about are two or three points. A 7% distortion on one category swamps the thing being measured.' },
        { key: 'uniform', correct: false, label: 'It could be corrected with a flat adjustment to the total', why: 'A flat adjustment fixes the total and leaves every category comparison wrong. The error has structure, so the correction has to as well.' },
        { key: 'ignore', correct: false, label: 'Since Tea and Merchandise are unaffected, their figures can be used as published', why: 'Their absolute margins are fine and their SHARES of total margin are not, because the denominator moved.' },
      ],
      skills: { statistics: 100, businessLogic: 100 },
    },
    estHours: 0.45, priority: 'urgent', dueInDays: 4, day: 3, difficulty: 'hard',
  },

  'tb-122': {
    title: 'The trend the naive method invents',
    hint: "Half on half, like for like, both methods. Look at what the naive version says about the direction.",
    brief: "Test whether the distortion creates a false trend. Write ONE SQL SELECT over stores open before 1 July 2025 and not closed, returning per half: margin using current cost only, margin using the cost that applied, and the understatement as a percentage of the correct figure to two places. First half first.",
    referenceSql: "SELECT CASE WHEN s.sold_at < '2026-01-01' THEN 'H1' ELSE 'H2' END AS half, ROUND(SUM(s.quantity * (s.unit_price - p.unit_cost))) AS margin_naive, ROUND(SUM(s.quantity * (s.unit_price - CASE WHEN p.cost_changed_on IS NOT NULL AND s.sold_at < p.cost_changed_on THEN p.previous_unit_cost ELSE p.unit_cost END))) AS margin_correct, ROUND((SUM(s.quantity * (s.unit_price - CASE WHEN p.cost_changed_on IS NOT NULL AND s.sold_at < p.cost_changed_on THEN p.previous_unit_cost ELSE p.unit_cost END)) - SUM(s.quantity * (s.unit_price - p.unit_cost))) * 100.0 / SUM(s.quantity * (s.unit_price - CASE WHEN p.cost_changed_on IS NOT NULL AND s.sold_at < p.cost_changed_on THEN p.previous_unit_cost ELSE p.unit_cost END)), 2) AS understated_pct FROM sales s JOIN products p ON p.id = s.product_id JOIN stores st ON st.id = s.store_id WHERE st.opened_on <= '2025-07-01' AND st.closed_on IS NULL GROUP BY half ORDER BY half",
    datasetKey: 'retail_sales', tool: 'sql', estHours: 0.9, priority: 'urgent', dueInDays: 4, day: 3, difficulty: 'hard',
  },

  'tb-123': {
    title: 'The decline the naive method hides',
    hint: "Work out the half-on-half change under each method. They are not the same number.",
    brief: "The naive method understates the first half by 6.5% and the second by 2.3%. Say what that does to anyone reading a trend.",
    tool: 'choice', datasetKey: 'retail_sales',
    choice: {
      prompt: 'Tick everything that follows.',
      options: [
        { key: 'flatter', correct: true, label: 'The naive method makes the margin decline look smaller than it is', why: 'It penalises the earlier period by 6.5% and the later one by only 2.3%, so the gap between them narrows. A real decline reads as a mild one.' },
        { key: 'direction', correct: true, label: 'Both methods still show a decline — the distortion changes the size, not the sign', why: 'Worth stating plainly. Overclaiming that the naive method reverses the finding would be the same sin as the naive method itself.' },
        { key: 'grow', correct: true, label: 'With a larger reprice the same mechanism could invert the trend entirely', why: 'The direction of the distortion is systematic, not random. It will always flatter the present relative to the past, and how much depends only on how big the reprices were.' },
        { key: 'restate', correct: true, label: 'Any margin figure published before this was found needs restating', why: 'Every earlier report used the naive basis. They are not slightly off — they are off by different amounts in different categories.' },
        { key: 'reverse', correct: false, label: 'The naive method reverses the direction of the trend', why: 'Check your own numbers rather than assuming the error is maximal. Both show a fall.' },
        { key: 'noone', correct: false, label: 'Since the direction is unchanged, nothing needs correcting', why: 'The direction is unchanged this half. The category ranking is not, and that is what the range review is deciding on.' },
      ],
      skills: { statistics: 100, businessLogic: 100 },
    },
    estHours: 0.45, priority: 'urgent', dueInDays: 4, day: 3, difficulty: 'hard',
  },

  'tb-124': {
    title: 'A cost basis everybody can apply',
    hint: "Karthik can build it once. Say what it should contain and who has to use it.",
    brief: "This will keep happening while every analyst writes their own CASE expression. Write to Karthik specifying what to build. Under 150 words.",
    tool: 'writeup', datasetKey: 'retail_sales',
    writeup: {
      to: 'Karthik Iyer', subject: 'Cost-at-time-of-sale — can we make this a view', maxWords: 150,
      prompt: 'What the view should contain, why it matters, and what it prevents.',
      rubric: [
        { key: 'what', label: 'What the view holds', markers: ['cost|line|sale|join|applicable|at the time|effective|per row|view'], why: 'Specific enough for him to build without another round trip.' },
        { key: 'why', label: 'Why hand-written expressions are the problem', markers: ['everyone|each|own|different|inconsisten|reproduc|three version|hand'], why: 'The case for the work. Without it this reads as a preference.' },
        { key: 'both', label: 'That both cost bases are needed, for different questions', markers: ['both|current|historic|forward|report|two|purpose|range review'], why: 'A view that only carries the historical cost breaks the range review two weeks later.' },
        { key: 'size', label: 'The materiality, so it gets prioritised', markers: ['26|quarter|15|fifteen|7%|6\\.2|material|crore|lakh'], why: 'Engineers prioritise by impact. Give him the number.' },
        { key: 'clear', label: 'A specific ask rather than a discussion', markers: ['can you|could you|please|would you|propose|suggest|build|add'], why: 'Something he can say yes or no to.' },
      ],
      skills: { communication: 100, businessLogic: 90 },
    },
    estHours: 0.45, priority: 'high', dueInDays: 4, day: 3, difficulty: 'medium',
  },

  'tb-125': {
    title: 'Margin per product, both bases',
    hint: "One pass over the sales, two accumulators per product. Do not query twice.",
    brief: "Give the range review its working table. In the notebook, compute for every product that sold: name, category, units sold (positive quantities only), net revenue, margin on the cost that applied, and margin on current cost. Round the money to whole rupees. Assign the ten products with the LOWEST margin-at-time-of-sale, as a list of dicts with keys name, category, units, revenue, margin_applied and margin_current, sorted ascending by margin_applied, to `result`.",
    tool: 'python', datasetKey: 'retail_sales',
    estHours: 1.0, priority: 'high', dueInDays: 4, day: 3, difficulty: 'hard',
    referenceCompute: (tables) => {
      const products = new Map(tables.products.map((p) => [p.id, p]));
      const acc = new Map();
      for (const s of tables.sales) {
        const p = products.get(s.product_id);
        const applied = p.cost_changed_on != null && s.sold_at < p.cost_changed_on ? p.previous_unit_cost : p.unit_cost;
        if (!acc.has(p.id)) acc.set(p.id, { name: p.name, category: p.category, units: 0, revenue: 0, margin_applied: 0, margin_current: 0 });
        const row = acc.get(p.id);
        if (s.quantity > 0) row.units += s.quantity;
        row.revenue += s.quantity * s.unit_price;
        row.margin_applied += s.quantity * (s.unit_price - applied);
        row.margin_current += s.quantity * (s.unit_price - p.unit_cost);
      }
      return [...acc.values()]
        .map((r) => ({ ...r, revenue: Math.round(r.revenue), margin_applied: Math.round(r.margin_applied), margin_current: Math.round(r.margin_current) }))
        .sort((a, b) => a.margin_applied - b.margin_applied)
        .slice(0, 10);
    },
  },

  'tb-130': {
    title: 'The month that does not fit',
    hint: "Revenue, margin, margin rate and average discount, by month. One row will not look like the others.",
    brief: "Before the promotion question, find it in the data. Write ONE SQL SELECT returning, per month: net revenue, margin on the cost that applied, margin percentage to one place, units sold on positive lines, and average discount to one place. Oldest month first.",
    referenceSql: "SELECT substr(s.sold_at, 1, 7) AS month, SUM(s.quantity * s.unit_price) AS net_revenue, ROUND(SUM(s.quantity * (s.unit_price - CASE WHEN p.cost_changed_on IS NOT NULL AND s.sold_at < p.cost_changed_on THEN p.previous_unit_cost ELSE p.unit_cost END))) AS margin, ROUND(SUM(s.quantity * (s.unit_price - CASE WHEN p.cost_changed_on IS NOT NULL AND s.sold_at < p.cost_changed_on THEN p.previous_unit_cost ELSE p.unit_cost END)) * 100.0 / SUM(s.quantity * s.unit_price), 1) AS margin_pct, SUM(CASE WHEN s.quantity > 0 THEN s.quantity ELSE 0 END) AS units, ROUND(AVG(s.discount_pct), 1) AS avg_discount FROM sales s JOIN products p ON p.id = s.product_id GROUP BY month ORDER BY month",
    datasetKey: 'retail_sales', tool: 'sql', estHours: 0.75, priority: 'high', dueInDays: 5, day: 4, difficulty: 'hard',
  },

  'tb-131': {
    title: 'What November bought',
    hint: "Compare November against the average of the other eleven months on three measures, not one.",
    brief: "November has a 16.9% average discount against about 4% everywhere else — a promotion nobody documented. Read what it did.",
    tool: 'choice', datasetKey: 'retail_sales',
    choice: {
      prompt: 'Tick everything your monthly table supports.',
      options: [
        { key: 'units', correct: true, label: 'It moved about 55% more units than a normal month', why: '2,638 against roughly 1,700. The discount worked, in the sense that it shifted stock.' },
        { key: 'revenue', correct: true, label: 'Revenue was up about 39%, less than the volume rise', why: 'Because each unit went out cheaper. Revenue rising less than volume is the signature of a discount-driven month.' },
        { key: 'margin', correct: true, label: 'Gross margin was up only about 12%', why: '₹19.3 lakh against a normal ₹17.2 lakh. Fifty-five percent more units for twelve percent more margin is the whole finding.' },
        { key: 'rate', correct: true, label: 'The margin rate fell from about 44% to 35.5%', why: 'Nearly nine points. Whether that is a good trade depends on what the volume was for, and nothing in the data says.' },
        { key: 'failed', correct: false, label: 'The promotion failed — margin rate collapsed', why: 'Absolute margin went up. A promotion that increases margin has not failed; it may simply have been an expensive way to do it.' },
        { key: 'succeeded', correct: false, label: 'The promotion succeeded — it was the best month of the year', why: 'Best on revenue, twelfth of twelve on margin rate, and barely ahead on margin. "Best month" is exactly the framing this analysis exists to interrogate.' },
      ],
      skills: { businessLogic: 100, statistics: 100 },
    },
    estHours: 0.45, priority: 'high', dueInDays: 5, day: 4, difficulty: 'hard',
  },

  'tb-132': {
    title: 'Margin at every discount level',
    hint: "Group by the discount column itself. Watch the two deepest bands — there are very few lines in them.",
    brief: "Establish the trade-off curve. Write ONE SQL SELECT returning, per discount level: lines, units on positive quantities, net revenue, margin on the cost that applied, and margin percentage to one place. Shallowest discount first.",
    referenceSql: "SELECT s.discount_pct, COUNT(*) AS lines, SUM(CASE WHEN s.quantity > 0 THEN s.quantity ELSE 0 END) AS units, SUM(s.quantity * s.unit_price) AS net_revenue, ROUND(SUM(s.quantity * (s.unit_price - CASE WHEN p.cost_changed_on IS NOT NULL AND s.sold_at < p.cost_changed_on THEN p.previous_unit_cost ELSE p.unit_cost END))) AS margin, ROUND(SUM(s.quantity * (s.unit_price - CASE WHEN p.cost_changed_on IS NOT NULL AND s.sold_at < p.cost_changed_on THEN p.previous_unit_cost ELSE p.unit_cost END)) * 100.0 / SUM(s.quantity * s.unit_price), 1) AS margin_pct FROM sales s JOIN products p ON p.id = s.product_id GROUP BY s.discount_pct ORDER BY s.discount_pct",
    datasetKey: 'retail_sales', tool: 'sql', estHours: 0.7, priority: 'high', dueInDays: 5, day: 4, difficulty: 'hard',
  },

  'tb-133': {
    title: 'Where the discount landed',
    hint: "November only, by category. The category carrying the discount is the one that can least afford it.",
    brief: "Write ONE SQL SELECT over November 2025 only, returning per category: net revenue, margin percentage to one place, and average discount to one place. Biggest revenue first.",
    referenceSql: "SELECT p.category, SUM(s.quantity * s.unit_price) AS net_revenue, ROUND(SUM(s.quantity * (s.unit_price - CASE WHEN p.cost_changed_on IS NOT NULL AND s.sold_at < p.cost_changed_on THEN p.previous_unit_cost ELSE p.unit_cost END)) * 100.0 / SUM(s.quantity * s.unit_price), 1) AS margin_pct, ROUND(AVG(s.discount_pct), 1) AS avg_discount FROM sales s JOIN products p ON p.id = s.product_id WHERE substr(s.sold_at, 1, 7) = '2025-11' GROUP BY p.category ORDER BY net_revenue DESC",
    datasetKey: 'retail_sales', tool: 'sql', estHours: 0.55, priority: 'high', dueInDays: 5, day: 4, difficulty: 'medium',
  },

  'tb-134': {
    title: 'The 25% band earns more than the 30%',
    hint: "Look at how many lines sit in each of those two bands before deciding what the curve is doing.",
    brief: "Your discount curve falls steadily and then goes back up at the deepest level. Decide what that is.",
    tool: 'choice', datasetKey: 'retail_sales',
    choice: {
      prompt: 'Tick everything that is true.',
      options: [
        { key: 'small', correct: true, label: 'Both bands are tiny — 151 and 175 lines out of 9,022', why: 'Under 2% of the data each. The difference between 25.4% and 26.6% on those volumes is not a signal about anything.' },
        { key: 'mix', correct: true, label: 'Which products happened to be discounted at each level drives the difference', why: 'A deep discount on a high-margin mug and a deep discount on a low-margin grinder land in the same band and earn completely different rates.' },
        { key: 'report', correct: true, label: 'The curve should be reported as monotonic down to 20% and unreliable beyond it', why: 'Honest and useful. The shape is clear where the data is thick and the tail should be marked as thin rather than smoothed away.' },
        { key: 'floor', correct: false, label: 'There is a floor around 25% below which margin stops falling', why: 'That is a model fitted to 326 lines with no mechanism behind it, and it would be quoted as a reason to discount harder.' },
        { key: 'deeper', correct: false, label: 'Deeper discounts are therefore safe', why: 'The one conclusion that would actually cost money, drawn from the thinnest part of the data.' },
        { key: 'error', correct: false, label: 'It indicates a data error in the discount field', why: 'Nothing is wrong with the data. Small samples are noisy, which is not the same as broken.' },
      ],
      skills: { statistics: 100, businessLogic: 100 },
    },
    estHours: 0.4, priority: 'high', dueInDays: 5, day: 4, difficulty: 'hard',
  },

  'tb-135': {
    title: 'Diya asks whether to run it again',
    hint: "She wants a yes or no. Work out what would have to be true for either answer.",
    brief: "Diya wants a yes or no on repeating the November promotion, and calls it our biggest revenue month. Answer the question she actually asked, state the trade, and be clear about what this data cannot settle. Under 160 words.",
    tool: 'writeup', datasetKey: 'retail_sales',
    writeup: {
      to: 'Diya Chandra', subject: 'Repeating the November promotion', maxWords: 160,
      prompt: 'The trade in numbers, what it cannot settle, and the one change worth making if it runs again.',
      rubric: [
        { key: 'trade', label: 'The trade in three numbers', markers: ['55|39|12|units|revenue|margin'], why: 'Three figures carry the decision, and she can act on them without following any of the method.' },
        { key: 'notno', label: 'That it did add margin, so the answer is not simply no', why: 'Absolute margin rose about ₹2 lakh. Discount-driven volume that still grows margin is a legitimate tactic, just an expensive one.', markers: ['add|rose|up|more margin|accretive|higher|2 lakh|12'] },
        { key: 'rate', label: 'The rate fall, stated plainly', markers: ['35\\.5|44|nine|rate|fell|down'], why: 'The number she is least likely to have been shown.' },
        { key: 'cannot', label: 'What this data cannot settle', markers: ['stock|clear|competitor|repeat|came back|cannot|do not have|don.t have|depends|objective'], why: 'Whether it was worth it turns on whether those customers returned, and four tables of till data say nothing about that.' },
        { key: 'equipment', label: 'Where the discount landed', markers: ['equipment|25\\.7|lowest|least margin|hardest|63'], why: 'If it runs again, this is the single actionable change available.' },
      ],
      skills: { communication: 100, businessLogic: 100 },
    },
    estHours: 0.5, priority: 'high', dueInDays: 5, day: 4, difficulty: 'hard',
  },

  'tb-140': {
    title: 'The promotion, per store',
    hint: "Like-for-like stores only. Compare each store's November against its own other months, not against the estate.",
    brief: "Planning will ask whether it worked everywhere. Write ONE SQL SELECT over stores open before 1 July 2025 and not closed, returning per store: November net revenue, average monthly net revenue across its other months, and November as a percentage of that average, to one place. Biggest uplift first.",
    referenceSql: "SELECT st.name, SUM(CASE WHEN substr(s.sold_at, 1, 7) = '2025-11' THEN s.quantity * s.unit_price ELSE 0 END) AS nov_revenue, ROUND(SUM(CASE WHEN substr(s.sold_at, 1, 7) <> '2025-11' THEN s.quantity * s.unit_price ELSE 0 END) / 11.0) AS other_month_avg, ROUND(SUM(CASE WHEN substr(s.sold_at, 1, 7) = '2025-11' THEN s.quantity * s.unit_price ELSE 0 END) * 100.0 / (SUM(CASE WHEN substr(s.sold_at, 1, 7) <> '2025-11' THEN s.quantity * s.unit_price ELSE 0 END) / 11.0), 1) AS nov_vs_avg_pct FROM sales s JOIN stores st ON st.id = s.store_id WHERE st.opened_on <= '2025-07-01' AND st.closed_on IS NULL GROUP BY st.id ORDER BY nov_vs_avg_pct DESC",
    datasetKey: 'retail_sales', tool: 'sql', estHours: 0.9, priority: 'high', dueInDays: 5, day: 5, difficulty: 'hard',
  },

  'tb-141': {
    title: 'The promotion summary',
    hint: "One pass, two buckets: November and everything else. Report both and the ratio.",
    brief: "Build the figure planning will quote. In the notebook, compare November 2025 against the average of the other eleven months on four measures: units sold on positive lines, net revenue, margin on the cost that applied, and margin percentage. Round money and units to whole numbers and percentages to one decimal place. Assign a dict with keys nov and other_month_avg — each a dict with keys units, revenue, margin and margin_pct — to `result`.",
    tool: 'python', datasetKey: 'retail_sales',
    estHours: 1.0, priority: 'high', dueInDays: 5, day: 5, difficulty: 'hard',
    referenceCompute: (tables) => {
      const products = new Map(tables.products.map((p) => [p.id, p]));
      const bucket = { nov: { units: 0, revenue: 0, margin: 0 }, other: { units: 0, revenue: 0, margin: 0 } };
      for (const s of tables.sales) {
        const p = products.get(s.product_id);
        const cost = p.cost_changed_on != null && s.sold_at < p.cost_changed_on ? p.previous_unit_cost : p.unit_cost;
        const b = s.sold_at.slice(0, 7) === '2025-11' ? bucket.nov : bucket.other;
        if (s.quantity > 0) b.units += s.quantity;
        b.revenue += s.quantity * s.unit_price;
        b.margin += s.quantity * (s.unit_price - cost);
      }
      const shape = (b, months) => ({
        units: Math.round(b.units / months),
        revenue: Math.round(b.revenue / months),
        margin: Math.round(b.margin / months),
        margin_pct: Math.round((b.margin / b.revenue) * 1000) / 10,
      });
      return { nov: shape(bucket.nov, 1), other_month_avg: shape(bucket.other, 11) };
    },
  },

  'tb-142': {
    title: 'What the range review is told',
    hint: "Separate what you measured from what you were asked to conclude.",
    brief: "Decide what goes to Diya's range review.",
    tool: 'choice', datasetKey: 'retail_sales',
    choice: {
      prompt: 'Tick everything that belongs in it.',
      options: [
        { key: 'basis', correct: true, label: 'That margin is stated on the cost that applied at the time of sale, and why', why: 'Every earlier figure used a different basis. Without the statement, hers and yours will differ and nobody will know which is right.' },
        { key: 'contribution', correct: true, label: 'Margin contribution in rupees alongside margin rate', why: 'The decision is where the money comes from. A rate table alone ranks Merchandise first and Equipment last, which is the inversion that gets a range cut.' },
        { key: 'promo', correct: true, label: 'That a discount month sits inside the year and distorts any annual rate', why: 'One month at 35.5% pulls the annual blend down. Anybody comparing this year to a year without a promotion is comparing two different trading strategies.' },
        { key: 'forward', correct: true, label: 'A forward-looking view at current cost and undiscounted price, separately labelled', why: 'She asked for this explicitly and she was right to. Stocking decisions are about next year, and it must not be confused with the reporting figure.' },
        { key: 'target', correct: false, label: 'A recommended blended margin target', why: 'You argued against exactly this on Tuesday. Nothing in the data says what margin is achievable.' },
        { key: 'cut', correct: false, label: 'A recommendation to reduce the Equipment range', why: 'Equipment is the largest margin contributor in the business. The rate is the lowest and the money is the biggest, and a range review that confuses those loses ₹1.08 crore.' },
      ],
      skills: { businessLogic: 100, communication: 100 },
    },
    estHours: 0.4, priority: 'high', dueInDays: 5, day: 5, difficulty: 'hard',
    // Deliberately flagged for rework: Diya accepts the summary and then wants the same
    // margin table with current cost as well, for the forward view.
    rework: true,
  },

  'tb-143': {
    title: 'Sign off the planning note',
    hint: "The numbers came from you. Read what the sentences claim on top of them.",
    brief: "Planning have drafted the note that goes with the promotion decision. Tick every problem.",
    tool: 'choice', datasetKey: 'retail_sales',
    choice: {
      exhibit: {
        kind: 'email', from: 'Ravi Menon', subject: 'Promotion note — OK to send?',
        body: "\"November remains our strongest trading month, delivering 39% more revenue than a typical month. Margin held up at 35.5%. Analytics confirm the promotion was margin-accretive and recommend repeating it. Discounts beyond 25% show no further margin erosion.\"",
      },
      prompt: 'What has to change before this goes out?',
      options: [
        { key: 'held', correct: true, label: '"Margin held up at 35.5%" describes a nine-point fall as stability', why: 'Every other month is around 44%. "Held up" is doing an enormous amount of work in that sentence and it is the opposite of what happened to the rate.' },
        { key: 'recommend', correct: true, label: 'You did not recommend repeating it', why: 'You said it added margin and that whether it was worth it depends on things this data does not hold. Attributing a recommendation to analytics is the line to strike.' },
        { key: 'tail', correct: true, label: 'The claim about discounts beyond 25% rests on 326 lines', why: 'It is the thinnest part of the data and the sentence turns it into a licence to discount harder. Of everything in the note, this one could actually cost money.' },
        { key: 'accretive', correct: true, label: '"Margin-accretive" is true and will be read as "margin-improving"', why: 'Absolute margin rose 12%; the rate fell nine points. The word is defensible and the impression it leaves is not, which is worse than a plain error.' },
        { key: 'revenue', correct: false, label: 'The 39% revenue figure is wrong', why: 'It is your figure and it is right. As usual the problem is the sentences built on top.' },
        { key: 'units', correct: false, label: 'It should lead with the 55% volume rise', why: 'Arguable, and a matter of emphasis rather than accuracy. Fix the four claims that are wrong before rewriting the ones that are merely a choice.' },
      ],
      skills: { communication: 100, businessLogic: 100 },
    },
    estHours: 0.45, priority: 'high', dueInDays: 5, day: 5, difficulty: 'hard',
  },

  'tb-144': {
    title: 'Rewrite the promotion note',
    hint: "Same decision, none of the four claims. Give planning the trade and let them decide.",
    brief: "Send Ravi replacement wording. It has to be usable by someone deciding whether to run the promotion again, with you not in the room. Under 130 words.",
    tool: 'writeup', datasetKey: 'retail_sales',
    writeup: {
      to: 'Ravi Menon', subject: 'Promotion note — suggested wording', maxWords: 130,
      prompt: 'The trade stated in three numbers, the rate fall stated honestly, and the decision left where it belongs.',
      rubric: [
        { key: 'trade', label: 'The trade in numbers', markers: ['55|39|12|units|revenue|margin'], why: 'Three figures carry the entire decision and nobody needs the method.' },
        { key: 'rate', label: 'The rate fall stated as a fall', markers: ['35\\.5|44|fell|down|nine|lower|drop'], why: 'The sentence the draft was written to avoid.' },
        { key: 'nodecide', label: 'The decision left with planning', markers: ['depend|for planning|their call|decide|whether|if the aim|context'], why: 'Analytics supplies the trade. Whether it is worth it needs stock, competitor and repeat-purchase information nobody has.' },
        { key: 'tail', label: 'The deep-discount claim removed or qualified', markers: ['thin|few|326|151|175|small|unreliable|cannot|not enough|below 20'], why: 'The only sentence in the draft that could directly cause a loss.' },
        { key: 'equipment', label: 'Where the discount landed', markers: ['equipment|25\\.7|lowest|least margin|hardest'], why: 'If it runs again, this is the single actionable change available.' },
      ],
      skills: { communication: 100, businessLogic: 100 },
    },
    estHours: 0.5, priority: 'high', dueInDays: 5, day: 5, difficulty: 'hard',
  },

  'tb-145': {
    title: 'What you would measure next time',
    hint: "Every gap you hit this week was a measurement that does not exist. Name the ones worth building.",
    brief: "Asha wants your view as the lead. If the promotion runs again, what has to be in place before it starts so the readout is not another week of this? Under 200 words.",
    tool: 'writeup', datasetKey: 'retail_sales',
    writeup: {
      to: 'Asha Rao', subject: 'If the promotion runs again — what to instrument first', maxWords: 200,
      prompt: 'What to record before it starts, and what question each thing answers.',
      rubric: [
        { key: 'flag', label: 'That promotions should be recorded as such, not inferred', markers: ['flag|record|mark|table|calendar|know|documented|inferred|discover'], why: 'You found this one by noticing a discount column. The next one should not need finding.' },
        { key: 'baseline', label: 'A pre-agreed comparison period', markers: ['baseline|compar|before|prior|control|which month|agree'], why: 'Otherwise the readout is an argument about which months count as normal.' },
        { key: 'repeat', label: 'Whether discounted customers come back', markers: ['repeat|return|again|retention|subsequent|later|next month|cohort'], why: 'The single biggest unknown in this week\'s answer, and the one that decides whether the trade was good.' },
        { key: 'stock', label: 'What the promotion was FOR', markers: ['stock|clear|objective|aim|purpose|why|goal|intent'], why: 'Clearing old stock and buying market share are different objectives that would be judged on different numbers.' },
        { key: 'basis', label: 'The cost basis agreed in advance', markers: ['cost basis|time of sale|current|view|standard|agree'], why: 'Half of this week went on establishing which cost to use. That is a decision that can be made once.' },
      ],
      skills: { communication: 100, businessLogic: 100 },
    },
    estHours: 0.6, priority: 'high', dueInDays: 5, day: 5, difficulty: 'hard',
  },


  // ---- Lead 3 · Range & Space Review (retail_sales) -------------------------------
  // The delist week. Monday the range has seven products in it that no store has ever
  // stocked, and an inner join makes them invisible. Tuesday the money is concentrated in
  // ten of sixty-one lines. Wednesday the stock table offers a cover calculation that
  // looks computable and is not — every product holds about twenty units regardless of
  // how fast it sells. Thursday the express stores carry a third of the range. Friday a
  // delist list that has to survive somebody asking what each removal is worth.

  'tc-101': {
    title: 'Count the range',
    hint: "The number in the products table and the number anybody has ever sold are different numbers.",
    brief: "Buying want a delist list. Start by establishing what is actually in the range. Write ONE SQL SELECT returning one row per measure, with columns measure and value, in this order: in_range, ever_sold, never_sold.",
    referenceSql: "SELECT 'in_range' AS measure, COUNT(*) AS value FROM products UNION ALL SELECT 'ever_sold', COUNT(DISTINCT product_id) FROM sales UNION ALL SELECT 'never_sold', (SELECT COUNT(*) FROM products) - (SELECT COUNT(DISTINCT product_id) FROM sales)",
    datasetKey: 'retail_sales', tool: 'sql', estHours: 0.4, priority: 'high', dueInDays: 1, day: 1, difficulty: 'medium',
  },

  'tc-102': {
    title: 'The seven nobody has seen',
    hint: "An inner join to sales deletes them. You need a LEFT JOIN or a NOT EXISTS.",
    brief: "Seven products are in the range and have never sold a single unit. Write ONE SQL SELECT listing them: name, category, subcategory, list_price and unit_cost. Most expensive first.",
    referenceSql: "SELECT p.name, p.category, p.subcategory, p.list_price, p.unit_cost FROM products p WHERE NOT EXISTS (SELECT 1 FROM sales s WHERE s.product_id = p.id) ORDER BY p.list_price DESC",
    datasetKey: 'retail_sales', tool: 'sql', estHours: 0.45, priority: 'high', dueInDays: 1, day: 1, difficulty: 'medium',
  },

  'tc-103': {
    title: 'Why the usual query would have missed them',
    hint: "Think about what happens to a product with no matching rows when you JOIN rather than LEFT JOIN.",
    brief: "Every previous range review ranked products by sales and took the bottom of the list. Work out what that misses.",
    tool: 'choice', datasetKey: 'retail_sales',
    choice: {
      prompt: 'Tick everything that is true.',
      options: [
        { key: 'invisible', correct: true, label: 'An inner join makes a product with no sales invisible, not bottom-ranked', why: 'There is no row to rank. The seven worst-performing products in the range have never appeared in a single performance report.' },
        { key: 'worst', correct: true, label: 'They are unambiguously the worst lines in the book', why: 'Zero units, zero margin, and they still occupy a slot in the range plan and somebody\'s buying time.' },
        { key: 'why', correct: true, label: 'The interesting question is why they were listed and never ranged', why: 'Buying signed them off and nobody put them on a planogram. That is a process failure worth more than the seven delists.' },
        { key: 'zero', correct: false, label: 'They would appear with zero units in any correctly written query', why: 'Only with a LEFT JOIN or NOT EXISTS. The phrase "correctly written" is doing the work — the point is that the obvious query is the wrong one.' },
        { key: 'new', correct: false, label: 'They are probably new lines that have not launched yet', why: 'Nothing in the data says when a product was listed, so that is a guess. It is also checkable by asking buying, which is the right next step rather than an assumption.' },
        { key: 'delete', correct: false, label: 'They should be deleted from the products table', why: 'Delisting is a commercial decision and the table is not yours. Flagging them is the job.' },
      ],
      skills: { businessLogic: 100, statistics: 90 },
    },
    estHours: 0.35, priority: 'high', dueInDays: 2, day: 1, difficulty: 'hard',
  },

  'tc-104': {
    title: 'Range and performance in one table',
    hint: "LEFT JOIN from products, and COALESCE the aggregates so a never-sold line reads zero rather than NULL.",
    brief: "Build the working table for the review. Write ONE SQL SELECT returning, for EVERY product: name, category, units sold on positive lines, net revenue, margin on the cost that applied, and how many stores have ever sold it. Zeros for products that never sold. Weakest margin first.",
    referenceSql: "SELECT p.name, p.category, COALESCE(SUM(CASE WHEN s.quantity > 0 THEN s.quantity ELSE 0 END), 0) AS units, COALESCE(SUM(s.quantity * s.unit_price), 0) AS net_revenue, ROUND(COALESCE(SUM(s.quantity * (s.unit_price - CASE WHEN p.cost_changed_on IS NOT NULL AND s.sold_at < p.cost_changed_on THEN p.previous_unit_cost ELSE p.unit_cost END)), 0)) AS margin, COUNT(DISTINCT s.store_id) AS stores FROM products p LEFT JOIN sales s ON s.product_id = p.id GROUP BY p.id ORDER BY margin ASC, units ASC",
    datasetKey: 'retail_sales', tool: 'sql', estHours: 0.9, priority: 'high', dueInDays: 2, day: 1, difficulty: 'hard',
  },

  'tc-105': {
    title: 'Range gaps by category',
    hint: "Count products in the range and products that sold, per category. The gap is not evenly spread.",
    brief: "Write ONE SQL SELECT returning, per category: products in the range, products that have ever sold, and the number that never have. Biggest gap first.",
    referenceSql: "SELECT p.category, COUNT(DISTINCT p.id) AS in_range, COUNT(DISTINCT s.product_id) AS ever_sold, COUNT(DISTINCT p.id) - COUNT(DISTINCT s.product_id) AS never_sold FROM products p LEFT JOIN sales s ON s.product_id = p.id GROUP BY p.category ORDER BY never_sold DESC, in_range DESC",
    datasetKey: 'retail_sales', tool: 'sql', estHours: 0.55, priority: 'normal', dueInDays: 2, day: 1, difficulty: 'medium',
  },

  'tc-106': {
    title: 'Tell buying what you found',
    hint: "Seven delists is the small news. The process that listed them is the big news.",
    brief: "Write to Sneha in buying. Under 150 words.",
    tool: 'writeup', datasetKey: 'retail_sales',
    writeup: {
      to: 'Sneha Joshi', subject: 'Seven lines in the range that no store has ever stocked', maxWords: 150,
      prompt: 'What you found, why nobody had seen it, and the question you need her to answer.',
      rubric: [
        { key: 'seven', label: 'The seven products, named or counted', markers: ['seven|7|never sold|no store|zero|not ranged'], why: 'Specific and checkable in one line.' },
        { key: 'why', label: 'Why previous reviews missed them', markers: ['join|no row|invisible|not appear|rank|bottom|left join|absent'], why: 'Without this it looks like nobody was paying attention, rather than that the standard query cannot see them.' },
        { key: 'ask', label: 'The question only buying can answer', markers: ['were they|why|intended|planogram|launch|discontinued|deliberate|should they'], why: 'They may be deliberate — a launch that slipped, a supplier commitment. You cannot tell and she can.' },
        { key: 'process', label: 'That the listing process is the larger finding', markers: ['process|how|listed|sign.?off|planogram|gap between|system|again'], why: 'Seven delists is worth very little. A range that can carry lines nobody stocks is worth fixing.' },
        { key: 'concrete', label: 'A next step', markers: ['confirm|tell me|let me know|come back|check|review|by'], why: 'A finding with no next step gets acknowledged and filed.' },
      ],
      skills: { communication: 100, businessLogic: 90 },
    },
    estHours: 0.45, priority: 'high', dueInDays: 2, day: 1, difficulty: 'medium',
  },

  'tc-110': {
    title: 'Where the margin actually sits',
    hint: "Rank products by margin, then ask how much of the total the top few carry.",
    brief: "Establish the concentration. Write ONE SQL SELECT over products that sold, returning one row per band with columns band and pct_of_margin — the share of total margin, to one place — for top_10, top_20 and bottom_20, in that order.",
    referenceSql: "WITH m AS (SELECT p.id, SUM(s.quantity * (s.unit_price - CASE WHEN p.cost_changed_on IS NOT NULL AND s.sold_at < p.cost_changed_on THEN p.previous_unit_cost ELSE p.unit_cost END)) AS marg FROM products p JOIN sales s ON s.product_id = p.id GROUP BY p.id) SELECT 'top_10' AS band, ROUND((SELECT SUM(marg) FROM (SELECT marg FROM m ORDER BY marg DESC LIMIT 10)) * 100.0 / (SELECT SUM(marg) FROM m), 1) AS pct_of_margin UNION ALL SELECT 'top_20', ROUND((SELECT SUM(marg) FROM (SELECT marg FROM m ORDER BY marg DESC LIMIT 20)) * 100.0 / (SELECT SUM(marg) FROM m), 1) UNION ALL SELECT 'bottom_20', ROUND((SELECT SUM(marg) FROM (SELECT marg FROM m ORDER BY marg ASC LIMIT 20)) * 100.0 / (SELECT SUM(marg) FROM m), 1)",
    datasetKey: 'retail_sales', tool: 'sql', estHours: 0.9, priority: 'high', dueInDays: 2, day: 2, difficulty: 'hard',
  },

  'tc-111': {
    title: 'Ten lines, half the money',
    hint: "Work out what delisting the bottom twenty would actually save, and what it would cost.",
    brief: "Ten of sixty-one products carry 55.3% of margin. The bottom twenty carry 8.6%. Read that before anybody proposes a cut.",
    tool: 'choice', datasetKey: 'retail_sales',
    choice: {
      prompt: 'Tick everything that follows.',
      options: [
        { key: 'concentrated', correct: true, label: 'The range is heavily concentrated — a third of the lines carry nearly three quarters of the margin', why: 'Twenty of sixty-one products at 72.5%. That is the shape of nearly every retail range and it is the reason delisting feels easy.' },
        { key: 'notfree', correct: true, label: 'Delisting the bottom twenty does not save 8.6% of margin — it loses it', why: 'The saving is in space, buying time and working capital, none of which is in this data. The margin is a straightforward loss and it is the only number here you can actually quantify.' },
        { key: 'substitution', correct: true, label: 'Some of that lost margin would move to remaining products, and nothing here says how much', why: 'A customer who came for a delisted tea may buy another tea or may leave. Substitution is the whole economics of a delist and this data cannot see it.' },
        { key: 'cut', correct: false, label: 'The bottom twenty should be delisted — 8.6% of margin is not worth the complexity', why: 'You have not costed the complexity. Trading a quantified ₹18 lakh against an unquantified saving is exactly the decision that needs both numbers.' },
        { key: 'top', correct: false, label: 'Buying effort should concentrate on the top ten', why: 'They are already working. Where the money sits tells you what to protect, not where attention is most productive.' },
        { key: 'tail', correct: false, label: 'A long tail of low-margin lines is a sign of poor range management', why: 'It is the normal shape of a range. Whether it is too long is a question about space and attention, neither of which this data holds.' },
      ],
      skills: { businessLogic: 100, statistics: 100 },
    },
    estHours: 0.45, priority: 'high', dueInDays: 3, day: 2, difficulty: 'hard',
  },

  'tc-112': {
    title: 'The tail, costed',
    hint: "Rank by margin ascending, take the bottom twenty, and total what they actually contribute.",
    brief: "Put names against the proposal. Write ONE SQL SELECT listing the twenty lowest-margin products that sold: name, category, units on positive lines, margin on the cost that applied, and that product's share of total margin to two places. Weakest first.",
    referenceSql: "WITH m AS (SELECT p.id, p.name, p.category, SUM(CASE WHEN s.quantity > 0 THEN s.quantity ELSE 0 END) AS units, SUM(s.quantity * (s.unit_price - CASE WHEN p.cost_changed_on IS NOT NULL AND s.sold_at < p.cost_changed_on THEN p.previous_unit_cost ELSE p.unit_cost END)) AS marg FROM products p JOIN sales s ON s.product_id = p.id GROUP BY p.id) SELECT name, category, units, ROUND(marg) AS margin, ROUND(marg * 100.0 / (SELECT SUM(marg) FROM m), 2) AS pct_of_margin FROM m ORDER BY marg ASC LIMIT 20",
    datasetKey: 'retail_sales', tool: 'sql', estHours: 0.9, priority: 'high', dueInDays: 3, day: 2, difficulty: 'hard',
  },

  'tc-113': {
    title: 'The concentration chart',
    hint: "Categories, one measure, sorted. The same chart you would draw for any contribution question.",
    brief: "Build the visual for the range review: margin contribution by subcategory, so buying can see which parts of the range carry the money. Pick the chart type, the fields and the sort.",
    tool: 'chart', datasetKey: 'retail_sales',
    chart: {
      sourceSql: "SELECT p.category || ' · ' || p.subcategory AS subcategory, SUM(s.quantity * (s.unit_price - CASE WHEN p.cost_changed_on IS NOT NULL AND s.sold_at < p.cost_changed_on THEN p.previous_unit_cost ELSE p.unit_cost END)) AS margin FROM products p JOIN sales s ON s.product_id = p.id GROUP BY p.category, p.subcategory ORDER BY margin DESC",
      prompt: 'Margin contribution by subcategory, for the range review.',
      answer: { type: 'bar', x: 'subcategory', y: 'margin', sort: 'desc', baselineZero: true },
      why: 'Named categories compared on one quantity, sorted so the contribution order is what the reader takes away. Margin in rupees rather than rate, because a delist decision is about what a slot earns — and a zero baseline because the smallest subcategories would otherwise look like they contribute nothing at all.',
    },
    estHours: 0.35, priority: 'normal', dueInDays: 3, day: 2, difficulty: 'medium',
  },

  'tc-114': {
    title: 'Ravi proposes a rule',
    hint: "Apply his rule to the table you already have and see which lines it would remove.",
    brief: "Ravi has a delist rule. Work out what it would actually do.",
    tool: 'choice', datasetKey: 'retail_sales',
    choice: {
      exhibit: {
        kind: 'chat', from: 'Ravi Menon', subject: '#retail-analytics',
        body: "Proposing a simple delist rule for the range review: any product contributing under 1.5% of category margin goes.\n\nObjective, repeatable, no arguing about individual lines. Good?",
      },
      prompt: 'Tick every problem with the rule as written.',
      options: [
        { key: 'invisible', correct: true, label: 'It cannot see the seven products that never sold', why: 'They have no category margin to be a percentage of, so a rule expressed as a share of category never reaches them. The worst lines in the range are immune to it.' },
        { key: 'relative', correct: true, label: 'A percentage of category means small categories lose lines that large ones would keep', why: '1.5% of Bakery is a fraction of 1.5% of Equipment. The same rupee contribution survives in one category and is cut in another.' },
        { key: 'ratchet', correct: true, label: 'Applied repeatedly it never stops — every cut creates a new bottom', why: 'Once the tail is removed the remaining lines re-share 100%, and a fresh set falls under 1.5%. A rule with no floor delists the whole range eventually.' },
        { key: 'role', correct: true, label: 'It takes no account of what a line is for', why: 'An opening price point or a line that brings people in can carry very little margin of its own and still be the reason a basket exists.' },
        { key: 'objective', correct: false, label: 'It is not objective, because the threshold was chosen arbitrarily', why: 'Every threshold is chosen. Arbitrariness is not the problem — the problems are what it cannot see and what it does when you run it twice.' },
        { key: 'margin', correct: false, label: 'It should use revenue rather than margin', why: 'Margin is the better measure of what a slot earns. Changing it to revenue fixes nothing and loses the one thing the rule gets right.' },
      ],
      skills: { businessLogic: 100, communication: 100 },
    },
    estHours: 0.45, priority: 'high', dueInDays: 3, day: 2, difficulty: 'hard',
  },

  'tc-115': {
    title: 'Give Ravi a better rule',
    hint: "Keep what works about his — objective and repeatable — and fix the four things it does wrong.",
    brief: "Reply in the channel. He asked for thoughts on a rule, in public, and the instinct is right. Under 130 words.",
    tool: 'writeup', datasetKey: 'retail_sales',
    writeup: {
      to: 'Ravi Menon', subject: 'Re: delist rule', maxWords: 130,
      prompt: 'What the rule misses, and a version that survives being run twice.',
      rubric: [
        { key: 'never', label: 'That it cannot reach the never-sold lines', markers: ['never sold|seven|7|zero|no margin|invisible|cannot see|immune'], why: 'The most concrete failure and the easiest to demonstrate.' },
        { key: 'absolute', label: 'An absolute floor rather than a share of category', markers: ['absolute|rupee|floor|fixed|lakh|per slot|not percent|share'], why: 'The fix for both the small-category problem and the ratchet.' },
        { key: 'ratchet', label: 'That a share-based rule never terminates', markers: ['again|repeat|twice|ratchet|re.?share|next year|keeps|eventually|never stop'], why: 'The failure nobody notices until the second review.' },
        { key: 'role', label: 'That some lines earn their slot in other ways', markers: ['role|entry|opening|price point|traffic|basket|footfall|why it is there'], why: 'A rule with no exception process becomes a rule people work around.' },
        { key: 'support', label: 'Support for the idea of having a rule', markers: ['good|agree|right|worth|like|yes|sensible|keep'], why: 'Objective and repeatable are the right instincts. Replying with only objections is how people stop proposing things in the open.' },
      ],
      skills: { communication: 100, businessLogic: 100 },
    },
    estHours: 0.4, priority: 'normal', dueInDays: 3, day: 2, difficulty: 'medium',
  },

  'tc-120': {
    title: 'Stock cover, as requested',
    hint: "Average units on hand over average monthly sales. Compute it before deciding whether it means anything.",
    brief: "Buying have asked for months of stock cover per product, to support the delist. Write ONE SQL SELECT over products that sold, returning: name, category, average monthly units sold to one place, average units on hand to one place, and months of cover to two places. Highest cover first.",
    referenceSql: "WITH u AS (SELECT p.id, p.name, p.category, SUM(CASE WHEN s.quantity > 0 THEN s.quantity ELSE 0 END) / 12.0 AS monthly_units FROM products p JOIN sales s ON s.product_id = p.id GROUP BY p.id), k AS (SELECT product_id, AVG(units_on_hand) AS stock FROM stock_counts GROUP BY product_id) SELECT u.name, u.category, ROUND(u.monthly_units, 1) AS monthly_units, ROUND(k.stock, 1) AS avg_stock, ROUND(k.stock / u.monthly_units, 2) AS months_cover FROM u JOIN k ON k.product_id = u.id ORDER BY months_cover DESC",
    datasetKey: 'retail_sales', tool: 'sql', estHours: 0.85, priority: 'high', dueInDays: 3, day: 3, difficulty: 'hard',
  },

  'tc-121': {
    title: 'Every product holds about twenty units',
    hint: "Look at the spread of avg_stock across sixty-one products, then at the spread of monthly sales. They do not match.",
    brief: "Your cover figures run from 0.43 to 1.09 months and cluster around 0.7. Decide whether that is a finding or a warning.",
    tool: 'choice', datasetKey: 'retail_sales',
    choice: {
      prompt: 'Tick everything that is true.',
      options: [
        { key: 'flat', correct: true, label: 'Average stock is 14.8 to 24.0 units for every product, while sales run 234 to 482 a year', why: 'A product selling twice as fast holds the same stock as one selling half as fast. That is not how replenishment works anywhere.' },
        { key: 'implausible', correct: true, label: 'A cover figure that is nearly uniform across the whole range cannot be describing stock policy', why: 'The output is suspiciously tidy, which is the signal. Real cover varies enormously between a fast coffee and a slow grinder.' },
        { key: 'refuse', correct: true, label: 'The right answer to buying is that this table cannot support the question', why: 'You can compute the number. Publishing it would give a delist decision a spurious input, and it would be your input.' },
        { key: 'quarterly', correct: true, label: 'Four snapshots a year cannot capture a stock position that turns over monthly', why: 'Even if the counts were demand-linked, a quarterly point-in-time reading says almost nothing about a line selling twenty units a month.' },
        { key: 'lowcover', correct: false, label: 'The range is running at under a month of cover and is at risk of stockouts', why: 'It is the conclusion the number invites and it rests entirely on a measure you have just shown is not measuring anything.' },
        { key: 'fix', correct: false, label: 'Weight the stock counts by store to correct the distortion', why: 'There is nothing to correct. The counts do not vary with demand, and no weighting recovers information that was never recorded.' },
      ],
      skills: { statistics: 100, businessLogic: 100 },
    },
    estHours: 0.5, priority: 'urgent', dueInDays: 4, day: 3, difficulty: 'hard',
  },

  'tc-122': {
    title: 'Prove it properly',
    hint: "Band the products by how fast they sell and show average stock in each band. If stock responded to demand the bands would differ.",
    brief: "Do not assert it — demonstrate it. Write ONE SQL SELECT banding products that sold into low (under 300 units), mid (300 to 399) and high (400 or more), returning per band: the number of products, average annual units, and average units on hand to one place.",
    referenceSql: "WITH u AS (SELECT p.id, SUM(CASE WHEN s.quantity > 0 THEN s.quantity ELSE 0 END) AS units FROM products p JOIN sales s ON s.product_id = p.id GROUP BY p.id), k AS (SELECT product_id, AVG(units_on_hand) AS stock FROM stock_counts GROUP BY product_id) SELECT CASE WHEN u.units < 300 THEN 'low' WHEN u.units < 400 THEN 'mid' ELSE 'high' END AS band, COUNT(*) AS products, ROUND(AVG(u.units)) AS avg_units, ROUND(AVG(k.stock), 1) AS avg_stock FROM u JOIN k ON k.product_id = u.id GROUP BY band ORDER BY avg_units",
    datasetKey: 'retail_sales', tool: 'sql', estHours: 0.8, priority: 'urgent', dueInDays: 4, day: 3, difficulty: 'hard',
  },

  'tc-123': {
    title: 'Tell buying the measure does not work',
    hint: "They asked for a number. You are declining to give it and you need them to understand why, not to think you could not do it.",
    brief: "Write to Sneha. She asked for stock cover to support the delist and you are not going to supply it. Under 160 words.",
    tool: 'writeup', datasetKey: 'retail_sales',
    writeup: {
      to: 'Sneha Joshi', subject: 'Stock cover — the counts will not support it', maxWords: 160,
      prompt: 'What you found, the evidence, why you will not publish the figure, and what would fix it.',
      rubric: [
        { key: 'flat', label: 'That stock does not vary with sales rate', markers: ['same|flat|uniform|20|twenty|regardless|no relation|independent|does not vary'], why: 'The observation, stated so she can check it herself.' },
        { key: 'evidence', label: 'The banded evidence', markers: ['band|low|high|fast|slow|19|20|234|482|twice'], why: 'Fast-selling and slow-selling lines hold the same stock. That comparison is the proof.' },
        { key: 'refuse', label: 'That you will not publish a cover figure', markers: ['not|won.t|will not|cannot|decline|hold|rather not|no cover'], why: 'Be explicit. A caveated number gets used without its caveat.' },
        { key: 'notability', label: 'That this is about the data, not about difficulty', markers: ['can compute|easy|not hard|the data|counts|quarterly|four|snapshot|record'], why: 'Otherwise she hears "the analyst could not do it" and asks someone else who will.' },
        { key: 'fix', label: 'What would make it answerable', markers: ['daily|weekly|movement|receipt|delivery|more frequent|per store|system|epos'], why: 'Turns a refusal into a request, and it is a request somebody can actually action.' },
      ],
      skills: { communication: 100, statistics: 100 },
    },
    estHours: 0.5, priority: 'urgent', dueInDays: 4, day: 3, difficulty: 'hard',
  },

  'tc-124': {
    title: 'The measures that survive',
    hint: "Three of these you have computed this week and can defend. Three you cannot.",
    brief: "Buying still need a delist basis. Decide what you can actually give them.",
    tool: 'choice', datasetKey: 'retail_sales',
    choice: {
      prompt: 'Tick every measure this data supports.',
      options: [
        { key: 'margin', correct: true, label: 'Margin contribution per product, on the cost that applied', why: 'Directly computed, defensible, and the closest thing to what a slot earns.' },
        { key: 'breadth', correct: true, label: 'How many stores carry each line', why: 'A line in two stores and a line in twelve are different propositions, and the sales table says which is which.' },
        { key: 'never', correct: true, label: 'Whether a line has ever sold at all', why: 'The cleanest signal in the dataset and the one the standard query cannot see.' },
        { key: 'cover', correct: false, label: 'Months of stock cover', why: 'You have just spent a day establishing that it is not measuring anything.' },
        { key: 'velocity', correct: false, label: 'Rate of sale per store per week', why: 'Computable and misleading here — a line carried only by flagships will look fast because of where it is stocked, not because of what it is.' },
        { key: 'substitution', correct: false, label: 'What customers would buy instead if a line went', why: 'The single most important number for a delist decision and it is nowhere in these four tables.' },
      ],
      skills: { businessLogic: 100, statistics: 100 },
    },
    estHours: 0.4, priority: 'high', dueInDays: 4, day: 3, difficulty: 'hard',
  },

  'tc-125': {
    title: 'The delist candidates, defensible version',
    hint: "One pass over sales, one over products, and a rule you can state in a sentence.",
    brief: "Build the candidate list on measures that survive. In the notebook, return every product that either never sold, or contributed under ₹120,000 of margin on the cost that applied. Assign a list of dicts with keys name, category, units, margin and stores — margin rounded to whole rupees — sorted ascending by margin then by name, to `result`.",
    tool: 'python', datasetKey: 'retail_sales',
    estHours: 1.0, priority: 'high', dueInDays: 4, day: 3, difficulty: 'hard',
    referenceCompute: (tables) => {
      const acc = new Map();
      for (const p of tables.products) acc.set(p.id, { name: p.name, category: p.category, units: 0, margin: 0, stores: new Set() });
      const products = new Map(tables.products.map((p) => [p.id, p]));
      for (const s of tables.sales) {
        const p = products.get(s.product_id);
        const cost = p.cost_changed_on != null && s.sold_at < p.cost_changed_on ? p.previous_unit_cost : p.unit_cost;
        const row = acc.get(p.id);
        if (s.quantity > 0) row.units += s.quantity;
        row.margin += s.quantity * (s.unit_price - cost);
        row.stores.add(s.store_id);
      }
      return [...acc.values()]
        .map((r) => ({ name: r.name, category: r.category, units: r.units, margin: Math.round(r.margin), stores: r.stores.size }))
        .filter((r) => r.stores === 0 || r.margin < 120000)
        .sort((a, b) => a.margin - b.margin || (a.name < b.name ? -1 : 1));
    },
  },

  'tc-130': {
    title: 'Range breadth by store',
    hint: "Count distinct products sold per store. Format explains almost all of it.",
    brief: "Buying will ask whether the range fits the estate. Write ONE SQL SELECT returning, per store: format, the number of distinct products it has sold, and that as a percentage of the full range to one place. Widest range first.",
    referenceSql: "SELECT st.name, st.format, COUNT(DISTINCT s.product_id) AS products_sold, ROUND(COUNT(DISTINCT s.product_id) * 100.0 / (SELECT COUNT(*) FROM products), 1) AS pct_of_range FROM stores st JOIN sales s ON s.store_id = st.id GROUP BY st.id ORDER BY products_sold DESC",
    datasetKey: 'retail_sales', tool: 'sql', estHours: 0.5, priority: 'high', dueInDays: 5, day: 4, difficulty: 'medium',
  },

  'tc-131': {
    title: 'How many stores carry each line',
    hint: "Count distinct stores per product and then count how many products sit at each level.",
    brief: "Write ONE SQL SELECT returning, for each number of stores carrying a line, how many products are at that level. Fewest stores first, and include the products carried by none.",
    referenceSql: "SELECT stores_carried, COUNT(*) AS products FROM (SELECT p.id, COUNT(DISTINCT s.store_id) AS stores_carried FROM products p LEFT JOIN sales s ON s.product_id = p.id GROUP BY p.id) GROUP BY stores_carried ORDER BY stores_carried",
    datasetKey: 'retail_sales', tool: 'sql', estHours: 0.55, priority: 'normal', dueInDays: 5, day: 4, difficulty: 'medium',
  },

  'tc-132': {
    title: 'The express stores carry a third of the range',
    hint: "Compare the flagship number with the express numbers and ask what that does to a national delist.",
    brief: "Flagships sell 61 of 68 lines. The express stores sell between 22 and 32. Work out what that means for a single delist list.",
    tool: 'choice', datasetKey: 'retail_sales',
    choice: {
      prompt: 'Tick everything that follows.',
      options: [
        { key: 'notnational', correct: true, label: 'A single national delist list applies a decision to stores that never carried the line', why: 'Removing something from Sector 29 that Sector 29 never stocked achieves nothing and makes the list look bigger than it is.' },
        { key: 'weak', correct: true, label: 'A line carried by few stores looks weak on total margin whether or not it sells well', why: 'Distribution and performance are different things, and total margin confuses them. Two of the candidates are in seven stores.' },
        { key: 'perstore', correct: true, label: 'Margin per store carrying the line is the fairer comparison', why: 'It separates "nobody wants this" from "almost nobody stocks this", which are opposite problems with opposite answers.' },
        { key: 'format', correct: true, label: 'The delist question is really a range-by-format question', why: 'An express store with a third of the range has already made most of these decisions. The real question is what the full range should be and what each format takes from it.' },
        { key: 'expand', correct: false, label: 'The express stores should carry more of the range', why: 'They have a third of the space. Nothing in this data says what would fit, and adding lines to a small store is how you get the tail problem you are trying to fix.' },
        { key: 'drop', correct: false, label: 'Lines carried by fewer than nine stores should be delisted on that basis alone', why: 'That is the mistake this whole task is about. Low distribution may mean nobody ranged it, which is a buying decision rather than a customer verdict.' },
      ],
      skills: { businessLogic: 100, statistics: 100 },
    },
    estHours: 0.45, priority: 'high', dueInDays: 5, day: 4, difficulty: 'hard',
  },

  'tc-133': {
    title: 'Margin per store carrying the line',
    hint: "Divide the line's margin by the number of stores that actually sell it, not by thirteen.",
    brief: "Correct for distribution. Write ONE SQL SELECT over products that sold, returning: name, category, the number of stores carrying it, total margin on the cost that applied, and margin per carrying store rounded to the nearest rupee. Weakest per store first.",
    referenceSql: "SELECT p.name, p.category, COUNT(DISTINCT s.store_id) AS stores, ROUND(SUM(s.quantity * (s.unit_price - CASE WHEN p.cost_changed_on IS NOT NULL AND s.sold_at < p.cost_changed_on THEN p.previous_unit_cost ELSE p.unit_cost END))) AS margin, ROUND(SUM(s.quantity * (s.unit_price - CASE WHEN p.cost_changed_on IS NOT NULL AND s.sold_at < p.cost_changed_on THEN p.previous_unit_cost ELSE p.unit_cost END)) / COUNT(DISTINCT s.store_id)) AS margin_per_store FROM products p JOIN sales s ON s.product_id = p.id GROUP BY p.id ORDER BY margin_per_store ASC",
    datasetKey: 'retail_sales', tool: 'sql', estHours: 0.8, priority: 'high', dueInDays: 5, day: 4, difficulty: 'hard',
    // Deliberately flagged for rework: Sneha accepts the list and then wants it split by
    // format, because an express store and a flagship do not take the same decision.
    rework: true,
  },

  'tc-134': {
    title: 'The list changes',
    hint: "Compare the bottom of the total-margin list with the bottom of the per-store list. Some lines move a long way.",
    brief: "Correcting for distribution changes which lines look weakest. Say what that means for the recommendation.",
    tool: 'choice', datasetKey: 'retail_sales',
    choice: {
      prompt: 'Tick everything that is true.',
      options: [
        { key: 'moves', correct: true, label: 'Lines carried by few stores move up the list once distribution is accounted for', why: 'They were near the bottom on total margin because of where they are stocked. On a per-store basis they are unremarkable.' },
        { key: 'stay', correct: true, label: 'Lines that are weak in twelve stores stay weak on either measure', why: 'The most useful result of the correction: it tells you which candidates are robust to how you measure them.' },
        { key: 'both', correct: true, label: 'The recommendation should name which measure each candidate fails on', why: 'A line that fails on both is a different case from one that fails on total margin alone, and buying will want to know which they are looking at.' },
        { key: 'either', correct: false, label: 'Per-store margin should replace total margin as the delist measure', why: 'Total margin is what the business loses. Per-store margin is what the shelf earns. A delist needs both, and substituting one for the other just moves the blind spot.' },
        { key: 'noone', correct: false, label: 'Since the list changes, neither measure can be trusted', why: 'Both are correct measures of different things. Disagreement between two right answers is information, not a reason to abandon both.' },
        { key: 'expand2', correct: false, label: 'Low-distribution lines that perform well per store should be rolled out wider', why: 'It is the interesting hypothesis and this data cannot test it — you do not know whether they sell well because they are good or because flagship customers buy differently.' },
      ],
      skills: { businessLogic: 100, statistics: 100 },
    },
    estHours: 0.45, priority: 'high', dueInDays: 5, day: 4, difficulty: 'hard',
  },

  'tc-135': {
    title: 'Sneha wants a number for the saving',
    hint: "Work out which part of the saving you can compute and which part you cannot.",
    brief: "Sneha wants a rupee figure for what the delist saves, to put in the range review paper. Half of that question is computable and half is not. Answer her. Under 150 words.",
    tool: 'writeup', datasetKey: 'retail_sales',
    writeup: {
      to: 'Sneha Joshi', subject: 'What the delist is worth', maxWords: 150,
      prompt: 'The half you can compute, the half you cannot, and how the figure should be framed in the paper.',
      rubric: [
        { key: 'loses', label: 'The margin the delist costs, with a figure', markers: ['lose|cost|at risk|6\\.8|14 lakh|1,?4|margin of|forego'], why: 'The only directly measured number in the decision, and it points the opposite way to the one she asked for.' },
        { key: 'saving', label: 'What the saving is made of, and that it is not in this data', markers: ['space|buying|working capital|shelf|slot|not in|outside|cannot|do not have'], why: 'Naming the three components tells her who can price them, which beats a refusal.' },
        { key: 'substitution', label: 'Substitution as the unknown that decides it', markers: ['substitut|instead|switch|buy another|move to|half|net'], why: 'If customers buy something else the loss shrinks. Till data cannot see it.' },
        { key: 'frame', label: 'That it should be framed as a cost to justify, not a saving to bank', markers: ['cost|justif|frame|not a saving|against|trade|rather than'], why: 'A paper that opens with an uncomputed saving is how a range gets cut on a number that was never true.' },
        { key: 'noestimate', label: 'That you will not supply an industry estimate', markers: ['not estimate|won.t|will not|no benchmark|industry|made up|invent|our data'], why: 'She will quote the number, not the source.' },
      ],
      skills: { communication: 100, businessLogic: 100 },
    },
    estHours: 0.5, priority: 'high', dueInDays: 5, day: 4, difficulty: 'hard',
  },

  'tc-140': {
    title: 'What the candidates are worth',
    hint: "Same rule as the notebook, summed. This is the number that goes in the paper.",
    brief: "Cost the recommendation. Write ONE SQL SELECT returning one row for every product that either never sold or contributed under ₹120,000 of margin: how many there are, their combined units, revenue and margin, and their share of total margin to one place. Label them candidates, units, revenue, margin and pct_of_margin.",
    referenceSql: "WITH m AS (SELECT p.id, COALESCE(SUM(CASE WHEN s.quantity > 0 THEN s.quantity ELSE 0 END), 0) AS units, COALESCE(SUM(s.quantity * s.unit_price), 0) AS revenue, COALESCE(SUM(s.quantity * (s.unit_price - CASE WHEN p.cost_changed_on IS NOT NULL AND s.sold_at < p.cost_changed_on THEN p.previous_unit_cost ELSE p.unit_cost END)), 0) AS marg, COUNT(DISTINCT s.store_id) AS stores FROM products p LEFT JOIN sales s ON s.product_id = p.id GROUP BY p.id) SELECT COUNT(*) AS candidates, SUM(units) AS units, ROUND(SUM(revenue)) AS revenue, ROUND(SUM(marg)) AS margin, ROUND(SUM(marg) * 100.0 / (SELECT SUM(marg) FROM m), 1) AS pct_of_margin FROM m WHERE stores = 0 OR marg < 120000",
    datasetKey: 'retail_sales', tool: 'sql', estHours: 0.9, priority: 'high', dueInDays: 5, day: 5, difficulty: 'hard',
  },

  'tc-141': {
    title: 'The candidates, with both measures',
    hint: "Each candidate needs to say which test it failed, so buying can argue with the right one.",
    brief: "Assemble the paper's appendix. Write ONE SQL SELECT over the delist candidates returning: name, category, stores carrying it, units, total margin, and margin per carrying store — zero where nothing sold. Weakest total margin first.",
    referenceSql: "SELECT p.name, p.category, COUNT(DISTINCT s.store_id) AS stores, COALESCE(SUM(CASE WHEN s.quantity > 0 THEN s.quantity ELSE 0 END), 0) AS units, ROUND(COALESCE(SUM(s.quantity * (s.unit_price - CASE WHEN p.cost_changed_on IS NOT NULL AND s.sold_at < p.cost_changed_on THEN p.previous_unit_cost ELSE p.unit_cost END)), 0)) AS margin, CASE WHEN COUNT(DISTINCT s.store_id) = 0 THEN 0 ELSE ROUND(SUM(s.quantity * (s.unit_price - CASE WHEN p.cost_changed_on IS NOT NULL AND s.sold_at < p.cost_changed_on THEN p.previous_unit_cost ELSE p.unit_cost END)) / COUNT(DISTINCT s.store_id)) END AS margin_per_store FROM products p LEFT JOIN sales s ON s.product_id = p.id GROUP BY p.id HAVING COUNT(DISTINCT s.store_id) = 0 OR SUM(s.quantity * (s.unit_price - CASE WHEN p.cost_changed_on IS NOT NULL AND s.sold_at < p.cost_changed_on THEN p.previous_unit_cost ELSE p.unit_cost END)) < 120000 ORDER BY margin ASC, p.name",
    datasetKey: 'retail_sales', tool: 'sql', estHours: 0.9, priority: 'high', dueInDays: 5, day: 5, difficulty: 'hard',
  },

  'tc-142': {
    title: 'What the paper says',
    hint: "Two things you established, two things you refused, and one thing you do not know.",
    brief: "Decide what goes in the range review paper.",
    tool: 'choice', datasetKey: 'retail_sales',
    choice: {
      prompt: 'Tick everything that belongs in it.',
      options: [
        { key: 'never', correct: true, label: 'The seven never-ranged lines, and the process question behind them', why: 'The cleanest finding of the week and the one with a fix that outlives the review.' },
        { key: 'cost', correct: true, label: 'The margin the candidate list would cost, stated as a cost', why: 'It is the only quantified figure in the decision and it points the opposite way to the framing the paper was requested in.' },
        { key: 'nocover', correct: true, label: 'That stock cover was requested, computed and rejected, with the reason', why: 'Somebody else will compute it. The paper should already say why it was not used, or the omission looks like an oversight.' },
        { key: 'twomeasures', correct: true, label: 'Which test each candidate fails — total margin, distribution, or both', why: 'A line weak in twelve stores and a line barely stocked are different cases, and buying will argue them differently.' },
        { key: 'saving', correct: false, label: 'An estimated saving from the delist', why: 'Space, buying time and working capital are real and none of them is in these four tables. An estimate here would be the most-quoted number in the paper.' },
        { key: 'rule', correct: false, label: 'A standing rule to delist anything under 1.5% of category margin', why: 'You argued against exactly this on Tuesday, and it still cannot see the seven lines that never sold.' },
      ],
      skills: { businessLogic: 100, communication: 100 },
    },
    estHours: 0.4, priority: 'high', dueInDays: 5, day: 5, difficulty: 'hard',
  },

  'tc-143': {
    title: 'Sign off the range paper',
    hint: "Read what the sentences claim on top of your numbers. Three of the four go further than the analysis does.",
    brief: "Sneha has drafted the paper using your work. Tick every problem.",
    tool: 'choice', datasetKey: 'retail_sales',
    choice: {
      exhibit: {
        kind: 'email', from: 'Sneha Joshi', subject: 'Range paper — sign off?',
        body: "\"Analytics have identified a tail of underperforming lines representing under 9% of margin. Delisting them releases shelf space and working capital at minimal commercial risk. Stock cover analysis confirms the range is over-extended. We recommend removing all candidates at the spring reset.\"\n\nGood to go?",
      },
      prompt: 'What has to change?',
      options: [
        { key: 'cover', correct: true, label: '"Stock cover analysis confirms" — you told her that analysis does not work', why: 'It is the sentence you spent Wednesday and a whole email preventing, and it has come back in as supporting evidence.' },
        { key: 'risk', correct: true, label: '"Minimal commercial risk" is an assessment nobody has made', why: 'Substitution is unmeasured. The risk could be near zero or it could be most of the margin, and the paper asserts the first.' },
        { key: 'releases', correct: true, label: '"Releases shelf space and working capital" states a saving that was never quantified', why: 'Both are real and both are outside this data. Stating them as achieved outcomes is how a cost becomes a saving on paper.' },
        { key: 'all', correct: true, label: '"Removing all candidates" ignores that they fail different tests', why: 'Seven never sold at all. Others are weak only on total margin because they are barely stocked. Treating them as one list removes the distinction you built.' },
        { key: 'nine', correct: false, label: 'The "under 9% of margin" figure is wrong', why: 'It is your figure and it is right. As usual the arithmetic survives and the sentences do not.' },
        { key: 'spring', correct: false, label: 'The spring reset is the wrong time to do it', why: 'Nothing in this data speaks to timing, and objecting to it would be exactly the kind of unevidenced claim the rest of this list is about.' },
      ],
      skills: { communication: 100, businessLogic: 100 },
    },
    estHours: 0.45, priority: 'high', dueInDays: 5, day: 5, difficulty: 'hard',
  },

  'tc-144': {
    title: 'Rewrite the paper\'s summary',
    hint: "Same candidates, none of the four claims, and the cost stated as a cost.",
    brief: "Send Sneha replacement wording for the summary paragraph. Under 140 words.",
    tool: 'writeup', datasetKey: 'retail_sales',
    writeup: {
      to: 'Sneha Joshi', subject: 'Range paper — suggested summary', maxWords: 140,
      prompt: 'The candidates split by the test they fail, the margin at risk stated as a cost, and the saving named as unquantified.',
      rubric: [
        { key: 'split', label: 'Candidates split by which test they fail', markers: ['never|seven|7|distribution|stores|total margin|two group|separately|different'], why: 'The distinction the paper flattened and the one buying will argue on.' },
        { key: 'cost', label: 'The margin stated as a cost, not a saving', markers: ['cost|lose|loses|at risk|forego|give up|margin of'], why: 'The framing reversal is the whole point of the rewrite.' },
        { key: 'unquantified', label: 'That space and working capital are real but unquantified here', markers: ['space|working capital|not quantif|cannot|outside|do not have|no data|elsewhere'], why: 'Names the missing half without pretending it does not exist.' },
        { key: 'nocover', label: 'No stock cover claim', markers: ['cover|stock|not used|excluded|counts|cannot support|removed'], why: 'Either drop the sentence or say why it is not there. Silence lets somebody re-add it.' },
        { key: 'substitution', label: 'Substitution named as the open question', markers: ['substitut|instead|switch|buy another|move to|unknown|risk'], why: 'The single largest determinant of whether the delist is a good idea.' },
      ],
      skills: { communication: 100, businessLogic: 100 },
    },
    estHours: 0.5, priority: 'high', dueInDays: 5, day: 5, difficulty: 'hard',
  },

  'tc-145': {
    title: 'What you would put in place',
    hint: "Two failures this week were data that does not exist. One was a query pattern. All three have a fix.",
    brief: "Asha wants your view as the lead. What changes so the next range review is not another week of this? Under 200 words.",
    tool: 'writeup', datasetKey: 'retail_sales',
    writeup: {
      to: 'Asha Rao', subject: 'Range review — what I would change', maxWords: 200,
      prompt: 'The changes that would make the next review answerable, and what each unlocks.',
      rubric: [
        { key: 'leftjoin', label: 'That range reporting must start from products, not sales', markers: ['left join|from products|not sales|never sold|zero|every product|start'], why: 'One query pattern, and it is the reason seven lines were invisible for as long as anybody has been reviewing the range.' },
        { key: 'stock', label: 'Stock movement rather than quarterly snapshots', markers: ['stock|movement|daily|weekly|receipt|deliver|snapshot|quarterly|more frequent'], why: 'Without it, cover and stockouts stay unanswerable every single review.' },
        { key: 'space', label: 'Space or slot data, so a delist has two sides', markers: ['space|slot|planogram|shelf|facing|capacity|cost of'], why: 'The saving half of the trade is currently unmeasurable, which is why delist papers keep asserting it.' },
        { key: 'listing', label: 'A check that listed lines are actually ranged', markers: ['listed|ranged|planogram|process|sign.?off|gap|report|flag|monitor'], why: 'The seven lines were a process failure, and the fix costs one scheduled query.' },
        { key: 'own', label: 'Written as decisions, not suggestions', markers: ['I would|we will|I will|propose|put in place|add|introduce|ask for'], why: 'A lead asked what changes is being asked to decide, not to list options.' },
      ],
      skills: { communication: 100, businessLogic: 100 },
    },
    estHours: 0.6, priority: 'high', dueInDays: 5, day: 5, difficulty: 'hard',
  },


  // ---- Lead 4 · Year-End Board Pack (retail_sales) --------------------------------
  // The last Team Lead project, and the one where the learner owns the number rather
  // than checking somebody else's. Monday three people submit three different revenue
  // figures. Tuesday they have to reconcile exactly. Wednesday the learner's own earlier
  // correction turns out to have been right for a comparison and wrong for a total.
  // Thursday an estimate for next year that has to survive being asked what it assumes.
  // Friday the pack, and the standard that stops this recurring.

  'td-101': {
    title: 'Three people, three revenue figures',
    hint: "None of them is wrong. Work out what each one is counting before you touch a query.",
    brief: "Three submissions for the year-end pack, three different numbers. Establish what each is measuring.",
    tool: 'choice', datasetKey: 'retail_sales',
    choice: {
      exhibit: {
        kind: 'email', from: 'Asha Rao', subject: 'Year-end pack — three numbers, one board',
        body: "Three submissions in and no two agree on revenue for the year.\n\nRavi: ₹5.00 crore.\nDiya: ₹4.85 crore.\nSneha: ₹4.45 crore.\n\nBoard is Thursday week. I need one number, and I need to be able to explain the other two.",
      },
      prompt: 'Tick everything that is likely true.',
      options: [
        { key: 'defs', correct: true, label: 'All three are probably correct computations of different things', why: 'Gross or net of returns, whole estate or like-for-like, with or without the duplicated month. Three choices, eight possible answers, and nobody wrote down which they took.' },
        { key: 'spread', correct: true, label: 'The spread is about ₹55 lakh, which is larger than most decisions in the pack', why: 'Eleven percent of the business. A pack that cannot say which figure it means cannot support anything built on it.' },
        { key: 'bridge', correct: true, label: 'The fix is a bridge between them, not a choice among them', why: 'A board that hears "we picked Diya\'s" learns nothing. A board that sees gross, less returns, less a duplicated month, less non-comparable stores, understands the business.' },
        { key: 'wrong', correct: false, label: 'At least two of the three must contain an error', why: 'That is the assumption to avoid. Three right answers to three unstated questions is far more common than two mistakes.' },
        { key: 'highest', correct: false, label: 'The highest figure is the one to use, since it is the most complete', why: 'Gross revenue is the most complete and the least honest — it counts money that was refunded.' },
        { key: 'average', correct: false, label: 'Take the middle figure as a reasonable compromise', why: 'It would be a number that answers no question at all, and nobody could reproduce it.' },
      ],
      skills: { businessLogic: 100, communication: 100 },
    },
    estHours: 0.4, priority: 'high', dueInDays: 1, day: 1, difficulty: 'hard',
  },

  'td-102': {
    title: 'Every figure they could have meant',
    hint: "Four definitions, four rows. You have computed all of them in previous weeks.",
    brief: "Lay out the candidates. Write ONE SQL SELECT returning one row per basis, with columns basis and revenue, in this order: gross, net, net_dedup (net with the duplicated rows removed), and net_dedup_lfl (also restricted to stores trading the whole window).",
    referenceSql: "SELECT 'gross' AS basis, SUM(CASE WHEN quantity > 0 THEN quantity * unit_price ELSE 0 END) AS revenue FROM sales UNION ALL SELECT 'net', SUM(quantity * unit_price) FROM sales UNION ALL SELECT 'net_dedup', (SELECT SUM(quantity * unit_price) FROM sales) - (SELECT SUM(quantity * unit_price) / 2 FROM sales WHERE store_id = 3 AND substr(sold_at, 1, 7) = '2026-03') UNION ALL SELECT 'net_dedup_lfl', (SELECT SUM(s.quantity * s.unit_price) FROM sales s JOIN stores st ON st.id = s.store_id WHERE st.opened_on <= '2025-07-01' AND st.closed_on IS NULL) - (SELECT SUM(quantity * unit_price) / 2 FROM sales WHERE store_id = 3 AND substr(sold_at, 1, 7) = '2026-03')",
    datasetKey: 'retail_sales', tool: 'sql', estHours: 0.9, priority: 'high', dueInDays: 1, day: 1, difficulty: 'hard',
  },

  'td-103': {
    title: 'Match each submission',
    hint: "Round your four figures to the nearest lakh and compare them with what the three people sent.",
    brief: "Work out who computed what. Say which basis each of the three submissions corresponds to.",
    tool: 'choice', datasetKey: 'retail_sales',
    choice: {
      prompt: 'Tick everything your table supports.',
      options: [
        { key: 'ravi', correct: true, label: 'Ravi\'s ₹5.00 crore is gross revenue, before returns', why: '₹5,00,34,052. He has counted what went through the till and not what came back.' },
        { key: 'diya', correct: true, label: 'Diya\'s ₹4.85 crore is net of returns, whole estate, duplicates included', why: '₹4,84,62,913. The straightforward reading of the table, and the one Finance would take.' },
        { key: 'sneha', correct: true, label: 'Sneha\'s ₹4.45 crore is net, de-duplicated and like-for-like', why: '₹4,44,98,388. She has applied every correction, which makes it the right measure of trading and the wrong measure of what the business earned.' },
        { key: 'nobody', correct: false, label: 'Nobody computed net with duplicates removed but all stores included', why: 'Correct — and it is the figure the board actually needs, which is why none of the three is usable as submitted.' },
        { key: 'sneha2', correct: false, label: 'Sneha\'s figure is the most correct and should be the headline', why: 'It excludes two new stores and a closed one. The board approved that capital and the pack cannot silently drop it from the total.' },
        { key: 'ravi2', correct: false, label: 'Ravi has made an error', why: 'Gross revenue is a real figure that Finance uses. He did not label it, which is a different failure from computing it wrongly.' },
      ],
      skills: { businessLogic: 100, statistics: 90 },
    },
    estHours: 0.4, priority: 'high', dueInDays: 2, day: 1, difficulty: 'hard',
  },

  'td-104': {
    title: 'The figure nobody submitted',
    hint: "Net, duplicates removed, every store included. That is what the business earned.",
    brief: "Compute the headline. Write ONE SQL SELECT returning one row: net revenue with the duplicated rows removed and every store included, the gross figure, the value of returns, and — for contrast — the same corrected figure restricted to stores trading the whole window. Label them headline, gross, returns and like_for_like.",
    referenceSql: "SELECT (SELECT SUM(quantity * unit_price) FROM sales) - (SELECT SUM(quantity * unit_price) / 2 FROM sales WHERE store_id = 3 AND substr(sold_at, 1, 7) = '2026-03') AS headline, (SELECT SUM(CASE WHEN quantity > 0 THEN quantity * unit_price ELSE 0 END) FROM sales) AS gross, (SELECT -SUM(CASE WHEN quantity < 0 THEN quantity * unit_price ELSE 0 END) FROM sales) AS returns, (SELECT SUM(s.quantity * s.unit_price) FROM sales s JOIN stores st ON st.id = s.store_id WHERE st.opened_on <= '2025-07-01' AND st.closed_on IS NULL) - (SELECT SUM(quantity * unit_price) / 2 FROM sales WHERE store_id = 3 AND substr(sold_at, 1, 7) = '2026-03') AS like_for_like",
    datasetKey: 'retail_sales', tool: 'sql', estHours: 0.6, priority: 'high', dueInDays: 2, day: 1, difficulty: 'hard',
  },

  'td-105': {
    title: 'Tell the three of them at once',
    hint: "Nobody is wrong. Say so first, then say what the pack will use and why.",
    brief: "Write to all three. They will each see the others' figures in the pack and each assume theirs was rejected. Under 170 words.",
    tool: 'writeup', datasetKey: 'retail_sales',
    writeup: {
      to: 'Ravi Menon, Diya Chandra and Sneha Joshi', subject: 'Year-end revenue — all three are right', maxWords: 170,
      prompt: 'That each figure is a correct answer to a different question, which the pack will use, and the rule going forward.',
      rubric: [
        { key: 'allright', label: 'That none of them made an error', markers: ['all|each|three|right|correct|no error|different question|not wrong'], why: 'Say it first. Three people whose work has just been replaced need to know they were not wrong before they hear what was chosen.' },
        { key: 'which', label: 'What each one computed', markers: ['gross|net|return|like.for.like|lfl|duplicat|estate|all store'], why: 'Naming each basis is what turns a disagreement into a definitions problem.' },
        { key: 'headline', label: 'The figure the pack will carry, and why', markers: ['4\\.81|48,?1|net|dedup|all store|board|headline|earned'], why: 'What the business earned, on every store, with the known fault removed.' },
        { key: 'others', label: 'That the other two still appear, as the bridge', markers: ['bridge|also|alongside|reconcil|show|both|appendix|beside'], why: 'Nothing is discarded. The three figures become the explanation rather than the argument.' },
        { key: 'rule', label: 'A rule so this does not recur', markers: ['label|define|state|basis|going forward|standard|always|glossary'], why: 'Three people made the same omission, which means it is a process gap rather than three oversights.' },
      ],
      skills: { communication: 100, businessLogic: 100 },
    },
    estHours: 0.5, priority: 'high', dueInDays: 2, day: 1, difficulty: 'hard',
  },

  'td-106': {
    title: 'What a definitions note has to fix',
    hint: "Each ambiguity cost you a submission this week. Which ones would recur next year?",
    brief: "You are going to write a standing definitions note. Decide what has to be in it.",
    tool: 'choice', datasetKey: 'retail_sales',
    choice: {
      prompt: 'Tick every term that has to be defined before the next pack.',
      options: [
        { key: 'revenue', correct: true, label: 'Revenue — gross or net of returns', why: 'A ₹15.7 lakh difference and three people who each assumed the other meaning was obvious.' },
        { key: 'lfl', correct: true, label: 'Like-for-like — which stores, and on what date test', why: 'Two openings and a closure in one year. Without a rule, everybody draws the boundary differently and the totals stop tying.' },
        { key: 'txn', correct: true, label: 'Transaction — whether a refund counts as one', why: 'It changes the count by 492 and the average value by nearly ₹500, and it has already gone into one draft.' },
        { key: 'correction', correct: true, label: 'How a known data fault is handled and disclosed', why: 'The duplicated month has now been treated three different ways by three people, and none of them said so on the page.' },
        { key: 'margin', correct: true, label: 'Margin — on the cost that applied, or on current cost', why: 'A four percent difference overall and nearly seven in Equipment, which is where the range decisions are made.' },
        { key: 'target', correct: false, label: 'The revenue target for next year', why: 'Not a definition. Setting it is the board\'s job and putting it in a glossary would be a quiet way of proposing one.' },
      ],
      skills: { communication: 100, businessLogic: 100 },
    },
    estHours: 0.4, priority: 'normal', dueInDays: 2, day: 1, difficulty: 'medium',
  },

  'td-110': {
    title: 'The bridge, step by step',
    hint: "Each row is a step from the figure above it. The steps have to add up exactly or it is not a bridge.",
    brief: "Build the reconciliation. Write ONE SQL SELECT returning one row per step with columns step and value, in this order: gross, less_returns (negative), net, less_duplicates (negative), headline, less_new_stores (negative), less_closed_store (negative), like_for_like.",
    referenceSql: "WITH d AS (SELECT SUM(quantity * unit_price) / 2 AS dup FROM sales WHERE store_id = 3 AND substr(sold_at, 1, 7) = '2026-03'), n AS (SELECT SUM(s.quantity * s.unit_price) AS newv FROM sales s JOIN stores st ON st.id = s.store_id WHERE st.opened_on > '2025-07-01'), c AS (SELECT SUM(s.quantity * s.unit_price) AS closedv FROM sales s JOIN stores st ON st.id = s.store_id WHERE st.closed_on IS NOT NULL) SELECT 'gross' AS step, (SELECT SUM(CASE WHEN quantity > 0 THEN quantity * unit_price ELSE 0 END) FROM sales) AS value UNION ALL SELECT 'less_returns', (SELECT SUM(CASE WHEN quantity < 0 THEN quantity * unit_price ELSE 0 END) FROM sales) UNION ALL SELECT 'net', (SELECT SUM(quantity * unit_price) FROM sales) UNION ALL SELECT 'less_duplicates', -(SELECT dup FROM d) UNION ALL SELECT 'headline', (SELECT SUM(quantity * unit_price) FROM sales) - (SELECT dup FROM d) UNION ALL SELECT 'less_new_stores', -(SELECT newv FROM n) UNION ALL SELECT 'less_closed_store', -(SELECT closedv FROM c) UNION ALL SELECT 'like_for_like', (SELECT SUM(quantity * unit_price) FROM sales) - (SELECT dup FROM d) - (SELECT newv FROM n) - (SELECT closedv FROM c)",
    datasetKey: 'retail_sales', tool: 'sql', estHours: 1.1, priority: 'high', dueInDays: 2, day: 2, difficulty: 'hard',
  },

  'td-111': {
    title: 'Check it ties',
    hint: "Add the steps up yourself. A bridge that does not reconcile to the rupee is worse than no bridge.",
    brief: "Your bridge runs gross ₹5,00,34,052 to like-for-like ₹4,44,98,388. Decide what has to be true of it before it goes in a pack.",
    tool: 'choice', datasetKey: 'retail_sales',
    choice: {
      prompt: 'Tick everything that is required.',
      options: [
        { key: 'exact', correct: true, label: 'Every step has to reconcile to the rupee, not approximately', why: 'A bridge whose steps nearly add up invites somebody to find the gap in the room, and then nothing else on the page is believed.' },
        { key: 'named', correct: true, label: 'Each step has to say what it removes and why', why: '"Less duplicates ₹3,46,357" means nothing without "a feed fault duplicated one store-month". The number and its reason travel together or not at all.' },
        { key: 'both', correct: true, label: 'Both ends are real figures the board may be quoted', why: 'Gross is what Finance sees in the till system; like-for-like is what the trading discussion uses. The bridge exists so that hearing either does not cause a panic.' },
        { key: 'reproduce', correct: true, label: 'Somebody else has to be able to reproduce every step from the source', why: 'That is the whole function of disclosure. An undisclosed correction is indistinguishable from an error the next time anybody checks.' },
        { key: 'simplify', correct: false, label: 'The bridge should be simplified to two or three steps for a board audience', why: 'The steps ARE the explanation. Collapsing them is how the ₹55 lakh becomes unexplainable again.' },
        { key: 'lflonly', correct: false, label: 'Only the like-for-like end matters, since it is the cleanest', why: 'It excludes ₹36 lakh of trade from stores the board funded. Cleanest is not the same as complete.' },
      ],
      skills: { communication: 100, businessLogic: 100 },
    },
    estHours: 0.4, priority: 'high', dueInDays: 3, day: 2, difficulty: 'hard',
  },

  'td-112': {
    title: 'The bridge chart',
    hint: "Ranked comparison across named steps, and the axis has to start at zero or the steps lie about their size.",
    brief: "Build the visual: the revenue bases side by side, so a reader sees the spread before they read the steps. Pick the chart type, the fields and the sort.",
    tool: 'chart', datasetKey: 'retail_sales',
    chart: {
      sourceSql: "SELECT 'gross' AS basis, SUM(CASE WHEN quantity > 0 THEN quantity * unit_price ELSE 0 END) AS revenue FROM sales UNION ALL SELECT 'net', SUM(quantity * unit_price) FROM sales UNION ALL SELECT 'net de-duplicated', (SELECT SUM(quantity * unit_price) FROM sales) - (SELECT SUM(quantity * unit_price) / 2 FROM sales WHERE store_id = 3 AND substr(sold_at, 1, 7) = '2026-03') UNION ALL SELECT 'like-for-like', (SELECT SUM(s.quantity * s.unit_price) FROM sales s JOIN stores st ON st.id = s.store_id WHERE st.opened_on <= '2025-07-01' AND st.closed_on IS NULL) - (SELECT SUM(quantity * unit_price) / 2 FROM sales WHERE store_id = 3 AND substr(sold_at, 1, 7) = '2026-03')",
      prompt: 'The four revenue bases, for the board pack.',
      answer: { type: 'bar', x: 'basis', y: 'revenue', sort: 'desc', baselineZero: true },
      why: 'Four named bases compared on one measure is a bar chart, sorted so the descent from gross to like-for-like is the shape the reader takes away. The zero baseline is doing real work here — the four figures span only eleven percent, and a truncated axis would turn a definitional difference into what looks like a collapse.',
    },
    estHours: 0.35, priority: 'normal', dueInDays: 3, day: 2, difficulty: 'medium',
  },

  'td-113': {
    title: 'Which figure answers which question',
    hint: "Five questions a board actually asks. Each wants a different one of your four.",
    brief: "The pack will be read by people asking different things. Match the figure to the question.",
    tool: 'choice', datasetKey: 'retail_sales',
    choice: {
      prompt: 'Tick every statement that pairs the right figure with the right question.',
      options: [
        { key: 'earned', correct: true, label: '"What did the business earn?" — net, de-duplicated, all stores', why: 'Every store the company owned, money actually kept, known fault removed. The headline.' },
        { key: 'trading', correct: true, label: '"Are the shops trading better?" — like-for-like', why: 'The only figure where the two periods contain the same estate, which is what the question is about.' },
        { key: 'till', correct: true, label: '"What went through the tills?" — gross', why: 'A real operational figure, used for staffing and for reconciling against the till system.' },
        { key: 'invest', correct: true, label: '"Did the new stores work?" — neither total, but the new stores reported on their own', why: 'They are excluded from like-for-like for a methodological reason, not a performance one, and hiding them in a total answers nothing.' },
        { key: 'oneno', correct: false, label: '"What is the one true revenue number?" — the headline', why: 'There is no one true number, and a pack that pretends otherwise is the reason three people submitted three figures.' },
        { key: 'growth', correct: false, label: '"Did we grow?" — the headline against last year\'s headline', why: 'Last year had a different estate. Growth is a like-for-like question or it is a question about the size of the company, and those are not the same.' },
      ],
      skills: { businessLogic: 100, communication: 100 },
    },
    estHours: 0.4, priority: 'high', dueInDays: 3, day: 2, difficulty: 'hard',
  },

  'td-114': {
    title: 'The estate, reported on its own',
    hint: "The three stores excluded from like-for-like each need a line, with the reason they are excluded.",
    brief: "Write ONE SQL SELECT over stores that opened inside the window or have closed, returning: name, opened_on, closed_on, days open within the window, net revenue, and revenue per day open rounded to the nearest rupee. Best per day first.",
    referenceSql: "SELECT st.name, st.opened_on, st.closed_on, CAST(julianday(MIN(COALESCE(st.closed_on, '2026-06-30'), '2026-06-30')) - julianday(MAX(st.opened_on, '2025-07-01')) + 1 AS INTEGER) AS days_open, SUM(s.quantity * s.unit_price) AS net_revenue, ROUND(SUM(s.quantity * s.unit_price) * 1.0 / (julianday(MIN(COALESCE(st.closed_on, '2026-06-30'), '2026-06-30')) - julianday(MAX(st.opened_on, '2025-07-01')) + 1)) AS revenue_per_day_open FROM stores st JOIN sales s ON s.store_id = st.id WHERE st.opened_on > '2025-07-01' OR st.closed_on IS NOT NULL GROUP BY st.id ORDER BY revenue_per_day_open DESC",
    datasetKey: 'retail_sales', tool: 'sql', estHours: 0.7, priority: 'high', dueInDays: 3, day: 2, difficulty: 'hard',
  },

  'td-115': {
    title: 'Write the definitions note',
    hint: "Five terms, one line each, and a rule about disclosure. Short enough that people read it.",
    brief: "Produce the standing definitions note that goes at the front of every pack from now on. Under 200 words.",
    tool: 'writeup', datasetKey: 'retail_sales',
    writeup: {
      to: 'Retail Analytics team', subject: 'Reporting definitions — standing note', maxWords: 200,
      prompt: 'The terms, defined tightly enough that two people cannot reasonably differ.',
      rubric: [
        { key: 'revenue', label: 'Revenue defined as gross or net', markers: ['gross|net|return|refund|deduct'], why: 'The one that cost ₹15.7 lakh of confusion this week.' },
        { key: 'lfl', label: 'Like-for-like with an explicit date test', markers: ['like.for.like|lfl|open before|trading throughout|both period|closed|1 july|whole window'], why: 'A rule anybody can apply without judgement, or people will apply judgement.' },
        { key: 'txn', label: 'Transaction defined against refunds', markers: ['transaction|refund|return|sale line|positive|count'], why: 'Changes the count by 492 and the average by nearly ₹500.' },
        { key: 'margin', label: 'Margin on a stated cost basis', markers: ['cost|time of sale|applied|current|basis|margin'], why: 'Four percent overall, seven in Equipment, and it decides range decisions.' },
        { key: 'disclose', label: 'A rule that corrections are disclosed on the page', markers: ['disclos|state|show|note|exclusion|correction|on the page|reproduce'], why: 'The rule that makes every other definition checkable rather than a matter of trust.' },
      ],
      skills: { communication: 100, businessLogic: 100 },
    },
    estHours: 0.6, priority: 'high', dueInDays: 3, day: 2, difficulty: 'hard',
  },

  'td-120': {
    title: 'Your own correction, three months on',
    hint: "Look at what you did to the duplicated month last time, and ask whether it was the right operation for a TOTAL.",
    brief: "The trading review excluded store 3's whole March from the comparison. Compare that with removing only the duplicated rows.",
    tool: 'choice', datasetKey: 'retail_sales',
    choice: {
      prompt: 'Tick everything that is true.',
      options: [
        { key: 'toomuch', correct: true, label: 'Excluding the whole month removes ₹3,46,357 of real trade as well as the duplicate', why: 'Every line is duplicated, so half of what is there is genuine. Dropping the month throws away the half that actually happened.' },
        { key: 'right', correct: true, label: 'For the half-on-half COMPARISON, excluding the month was defensible', why: 'You could not tell which of each pair was real, so neither half of the period could be trusted for that store. Dropping it kept the comparison clean.' },
        { key: 'wrong', correct: true, label: 'For a TOTAL it is wrong, because the money was earned', why: 'The board is being told what the business made. Understating it by ₹3.46 lakh to avoid a data fault is a different error, not a safer one.' },
        { key: 'dedupe', correct: true, label: 'Keeping one row of each duplicated pair is the right operation here', why: 'Both rows are identical, so either is the real one. Keeping one recovers the trade and removes the fault.' },
        { key: 'same', correct: false, label: 'The two approaches give the same answer to within rounding', why: '₹3.46 lakh apart. Small against ₹4.8 crore and larger than several line items in the pack.' },
        { key: 'badlast', correct: false, label: 'The trading review should be reissued with the corrected figure', why: 'It was a comparison and the treatment was right for a comparison. Reissuing a correct document would confuse the one thing that is currently settled.' },
      ],
      skills: { businessLogic: 100, statistics: 100 },
    },
    estHours: 0.5, priority: 'urgent', dueInDays: 4, day: 3, difficulty: 'hard',
  },

  'td-121': {
    title: 'What each treatment costs',
    hint: "Three figures for the same year, differing only in how one month is handled.",
    brief: "Quantify the choice. Write ONE SQL SELECT returning one row per treatment with columns treatment and revenue, in this order: as_loaded (no correction), dedup (one row of each duplicated pair kept) and exclude_month (the whole store-month dropped).",
    referenceSql: "SELECT 'as_loaded' AS treatment, SUM(quantity * unit_price) AS revenue FROM sales UNION ALL SELECT 'dedup', (SELECT SUM(quantity * unit_price) FROM sales) - (SELECT SUM(quantity * unit_price) / 2 FROM sales WHERE store_id = 3 AND substr(sold_at, 1, 7) = '2026-03') UNION ALL SELECT 'exclude_month', (SELECT SUM(quantity * unit_price) FROM sales) - (SELECT SUM(quantity * unit_price) FROM sales WHERE store_id = 3 AND substr(sold_at, 1, 7) = '2026-03')",
    datasetKey: 'retail_sales', tool: 'sql', estHours: 0.75, priority: 'urgent', dueInDays: 4, day: 3, difficulty: 'hard',
  },

  'td-122': {
    title: 'Ashok Nagar, corrected properly',
    hint: "Halve March for that store and compare it against its own other months.",
    brief: "Check the correction lands somewhere plausible. Write ONE SQL SELECT for store 3 only, returning per month: net revenue as loaded, and net revenue with March halved. Oldest first.",
    referenceSql: "SELECT substr(sold_at, 1, 7) AS month, SUM(quantity * unit_price) AS as_loaded, CASE WHEN substr(sold_at, 1, 7) = '2026-03' THEN SUM(quantity * unit_price) / 2 ELSE SUM(quantity * unit_price) END AS corrected FROM sales WHERE store_id = 3 GROUP BY month ORDER BY month",
    datasetKey: 'retail_sales', tool: 'sql', estHours: 0.6, priority: 'high', dueInDays: 4, day: 3, difficulty: 'medium',
  },

  'td-123': {
    title: 'When to drop and when to de-duplicate',
    hint: "The question being asked decides it, not the fault.",
    brief: "Write the rule the team will apply next time a period is found to be corrupt. Under 160 words.",
    tool: 'writeup', datasetKey: 'retail_sales',
    writeup: {
      to: 'Retail Analytics team', subject: 'Handling a corrupted period — the rule', maxWords: 160,
      prompt: 'When to repair the data and when to exclude the period, and why the answer depends on the question.',
      rubric: [
        { key: 'repair', label: 'That a repairable fault should be repaired, for totals', markers: ['repair|dedup|half|keep one|recover|correct|total|earned'], why: 'A total has to include money that was actually made, and an identical pair is repairable with certainty.' },
        { key: 'exclude', label: 'That a period you cannot repair is excluded from comparisons', markers: ['exclude|drop|comparison|trend|cannot tell|unrepairable|uncertain|like.for.like'], why: 'The case where the trading review was right, and it needs to stay right.' },
        { key: 'question', label: 'That the question decides which applies', markers: ['depend|question|total|comparison|purpose|what is being asked|use'], why: 'The load-bearing idea. Same fault, two correct treatments.' },
        { key: 'disclose', label: 'That either way it is disclosed', markers: ['disclos|state|note|page|say|reproduc|record'], why: 'Otherwise two packs carry two figures and neither explains the other.' },
        { key: 'concrete', label: 'The March figures as the worked example', markers: ['3,?46|346|march|ashok|store 3|lakh|half'], why: 'A rule with a worked example gets applied. A rule without one gets interpreted.' },
      ],
      skills: { communication: 100, businessLogic: 100 },
    },
    estHours: 0.5, priority: 'high', dueInDays: 4, day: 3, difficulty: 'hard',
  },

  'td-124': {
    title: 'Everything the pack quotes, from one place',
    hint: "One pass over sales. Build every figure the pack needs so they cannot drift apart.",
    brief: "Produce the pack's numbers in a single computation, so no two of them can disagree. In the notebook, compute: gross, returns (positive), net, duplicates (positive), headline (net less duplicates), new_stores, closed_store, and like_for_like (headline less the other two). Round every figure to whole rupees. Assign a dict with those eight keys to `result`.",
    tool: 'python', datasetKey: 'retail_sales',
    estHours: 1.0, priority: 'high', dueInDays: 4, day: 3, difficulty: 'hard',
    referenceCompute: (tables) => {
      const stores = new Map(tables.stores.map((s) => [s.id, s]));
      let gross = 0, returns = 0, net = 0, dupMonth = 0, newStores = 0, closedStore = 0;
      for (const s of tables.sales) {
        const value = s.quantity * s.unit_price;
        net += value;
        if (s.quantity > 0) gross += value; else returns -= value;
        if (s.store_id === 3 && s.sold_at.slice(0, 7) === '2026-03') dupMonth += value;
        const store = stores.get(s.store_id);
        if (store.opened_on > '2025-07-01') newStores += value;
        if (store.closed_on != null) closedStore += value;
      }
      const duplicates = dupMonth / 2;
      const headline = net - duplicates;
      return {
        gross: Math.round(gross),
        returns: Math.round(returns),
        net: Math.round(net),
        duplicates: Math.round(duplicates),
        headline: Math.round(headline),
        new_stores: Math.round(newStores),
        closed_store: Math.round(closedStore),
        like_for_like: Math.round(headline - newStores - closedStore),
      };
    },
  },

  'td-125': {
    title: 'One computation, many figures',
    hint: "Think about what happens when eight numbers in a pack come from eight separate queries.",
    brief: "You have just built every figure the pack quotes in one pass. Say why that matters.",
    tool: 'choice', datasetKey: 'retail_sales',
    choice: {
      prompt: 'Tick everything that is true.',
      options: [
        { key: 'tie', correct: true, label: 'Figures from one computation cannot disagree with each other', why: 'Eight separate queries means eight chances for a filter to differ, and the pack stops reconciling without anybody changing a number.' },
        { key: 'change', correct: true, label: 'A change to a definition propagates everywhere at once', why: 'When the duplicate treatment changed, one line moved and all eight figures stayed consistent. Eight queries would have needed eight edits and somebody would have missed one.' },
        { key: 'audit', correct: true, label: 'It makes the pack auditable — one place to read the rules', why: 'Somebody checking your work reads one function rather than hunting for filters across a folder of SQL.' },
        { key: 'this', correct: true, label: 'It is exactly how the three submissions diverged in the first place', why: 'Three people, three queries, three unstated filters. The structural fix is one computation, not three more careful people.' },
        { key: 'faster', correct: false, label: 'It is faster to run', why: 'True and irrelevant. These figures are computed once a year and correctness is the entire point.' },
        { key: 'always', correct: false, label: 'All analysis should be done this way', why: 'Exploratory work is meant to be throwaway. This applies to the numbers that get published and quoted, which is a much smaller set.' },
      ],
      skills: { businessLogic: 100, communication: 90 },
    },
    estHours: 0.35, priority: 'high', dueInDays: 4, day: 3, difficulty: 'medium',
  },

  'td-130': {
    title: 'The estimate somebody has already made',
    hint: "Check what his 5% growth is being applied to, and what it assumes about the estate.",
    brief: "Vikram has put a number for next year in the draft. Work out what is wrong with it.",
    tool: 'choice', datasetKey: 'retail_sales',
    choice: {
      exhibit: {
        kind: 'email', from: 'Vikram Nair', subject: 'Next year — putting 5.1 crore in the draft',
        body: "Taking this year at ₹4.85 crore and adding 5% growth gives ₹5.09 crore. Round to ₹5.1 crore.\n\nFeels about right and the board will want to see growth. Shout if you disagree.",
      },
      prompt: 'Tick every problem with it.',
      options: [
        { key: 'base', correct: true, label: 'The base includes the duplicated month, so it starts ₹3.46 lakh too high', why: 'He has used the uncorrected figure, which you established on Monday is not the one the pack will carry.' },
        { key: 'closed', correct: true, label: 'It assumes Park Street keeps trading, and Park Street closed in January', why: '₹11.64 lakh of this year\'s revenue cannot recur. The estate next year is not the estate this year.' },
        { key: 'newstores', correct: true, label: 'It ignores that two new stores only traded part of the year', why: 'Sector 29 for 268 days and Salt Lake for 149. A full year of each adds far more than the 5% he is applying.' },
        { key: 'trend', correct: true, label: '5% growth contradicts the trend in the data — like-for-like fell in the second half', why: 'The only trend evidence available points down. Applying growth because the board wants to see growth is the reasoning to name out loud.' },
        { key: 'promo', correct: true, label: 'It assumes the promotion repeats, without saying so', why: 'November added about ₹15.2 lakh of revenue. Whether it runs again is a decision nobody has taken, and the estimate silently takes it.' },
        { key: 'round', correct: false, label: 'Rounding to ₹5.1 crore is too imprecise for a board', why: 'Rounding is the least of it, and an estimate quoted to the rupee would imply precision that no forecast has.' },
      ],
      skills: { businessLogic: 100, statistics: 100 },
    },
    estHours: 0.5, priority: 'urgent', dueInDays: 5, day: 4, difficulty: 'hard',
  },

  'td-131': {
    title: 'What the estate alone does to next year',
    hint: "Annualise each part-year store at its own daily rate, and remove the store that closed.",
    brief: "Build the estate adjustment. Write ONE SQL SELECT returning one row per store that opened inside the window or closed during it, with: name, days open, actual revenue, and revenue annualised to 365 days at the same daily rate, rounded to the nearest rupee.",
    referenceSql: "SELECT st.name, CAST(julianday(MIN(COALESCE(st.closed_on, '2026-06-30'), '2026-06-30')) - julianday(MAX(st.opened_on, '2025-07-01')) + 1 AS INTEGER) AS days_open, SUM(s.quantity * s.unit_price) AS actual, ROUND(SUM(s.quantity * s.unit_price) * 365.0 / (julianday(MIN(COALESCE(st.closed_on, '2026-06-30'), '2026-06-30')) - julianday(MAX(st.opened_on, '2025-07-01')) + 1)) AS annualised FROM stores st JOIN sales s ON s.store_id = st.id WHERE st.opened_on > '2025-07-01' OR st.closed_on IS NOT NULL GROUP BY st.id ORDER BY annualised DESC",
    datasetKey: 'retail_sales', tool: 'sql', estHours: 0.8, priority: 'high', dueInDays: 5, day: 4, difficulty: 'hard',
  },

  'td-132': {
    title: 'The estimate, with its assumptions on the page',
    hint: "Start from the headline, adjust the estate, then decide the promotion separately. Each step is an assumption.",
    brief: "Build the estimate properly. In the notebook, start from the headline figure and produce two scenarios: with the promotion repeated and without it. Adjust for the estate — remove the closed store entirely, and uplift each part-year store to a full year at its own daily rate. Assume flat like-for-like trading. Assign a dict with keys base, estate_adjustment, promotion_value, with_promotion and without_promotion — all rounded to whole rupees — to `result`.",
    tool: 'python', datasetKey: 'retail_sales',
    estHours: 1.2, priority: 'high', dueInDays: 5, day: 4, difficulty: 'hard',
    referenceCompute: (tables) => {
      const stores = new Map(tables.stores.map((s) => [s.id, s]));
      const day = (d) => Date.parse(d + 'T00:00:00Z') / 86400000;
      let net = 0, dupMonth = 0, closed = 0;
      const partYear = new Map();
      const byMonth = new Map();
      for (const s of tables.sales) {
        const value = s.quantity * s.unit_price;
        net += value;
        if (s.store_id === 3 && s.sold_at.slice(0, 7) === '2026-03') dupMonth += value;
        const store = stores.get(s.store_id);
        if (store.closed_on != null) closed += value;
        if (store.opened_on > '2025-07-01') partYear.set(store.id, (partYear.get(store.id) || 0) + value);
        byMonth.set(s.sold_at.slice(0, 7), (byMonth.get(s.sold_at.slice(0, 7)) || 0) + value);
      }
      const base = net - dupMonth / 2;
      let uplift = 0;
      for (const [id, revenue] of partYear) {
        const store = stores.get(id);
        const days = day('2026-06-30') - day(store.opened_on) + 1;
        uplift += revenue * 365 / days - revenue;
      }
      const estate = uplift - closed;
      const nov = byMonth.get('2025-11');
      const others = [...byMonth.entries()].filter(([m]) => m !== '2025-11').map(([, v]) => v);
      const promotion = nov - others.reduce((s, v) => s + v, 0) / others.length;
      return {
        base: Math.round(base),
        estate_adjustment: Math.round(estate),
        promotion_value: Math.round(promotion),
        with_promotion: Math.round(base + estate),
        without_promotion: Math.round(base + estate - promotion),
      };
    },
  },

  'td-133': {
    title: 'What the estimate assumes',
    hint: "Every step you took is an assumption. Name the ones a board should be told about.",
    brief: "Your estimate is not a prediction. Decide what has to be said alongside it.",
    tool: 'choice', datasetKey: 'retail_sales',
    choice: {
      prompt: 'Tick every assumption that has to be stated on the page.',
      options: [
        { key: 'flat', correct: true, label: 'That like-for-like trading is assumed flat, which the data does not support', why: 'The second half fell. Assuming flat is already optimistic, and a board told "no growth assumed" will hear conservatism where there is none.' },
        { key: 'newstores', correct: true, label: 'That the new stores are assumed to continue at their current daily rate', why: 'A store open five months may still be in its opening peak or still building. Annualising assumes neither, and that assumption is invisible in the number.' },
        { key: 'promo', correct: true, label: 'Which scenario assumes the promotion repeats, and that repeating it is a decision nobody has taken', why: 'A ₹15.2 lakh swing that depends entirely on a choice outside this analysis.' },
        { key: 'nomarket', correct: true, label: 'That nothing is assumed about the market, because nothing can be', why: 'No competitor, footfall or macro data exists. Saying so stops the estimate being read as a forecast.' },
        { key: 'range', correct: true, label: 'That it should be presented as a range, not a point', why: 'Two scenarios ₹15.2 lakh apart on a decision not yet taken. A single number hides the decision inside it.' },
        { key: 'confidence', correct: false, label: 'A confidence interval around the estimate', why: 'There is no sampling process here to have an interval about. The uncertainty is in the assumptions, not in the arithmetic, and dressing it as statistics would misrepresent it.' },
      ],
      skills: { statistics: 100, communication: 100 },
    },
    estHours: 0.5, priority: 'high', dueInDays: 5, day: 4, difficulty: 'hard',
  },

  'td-134': {
    title: 'Answer Vikram',
    hint: "He offered you a shout. Replace his number rather than just objecting to it.",
    brief: "Write back. His figure is too high for four separate reasons and you have an alternative with its assumptions attached. Under 180 words.",
    tool: 'writeup', datasetKey: 'retail_sales',
    writeup: {
      to: 'Vikram Nair', subject: 'Next year — what I would put in instead', maxWords: 180,
      prompt: 'What is wrong with the 5% approach, your figures, and the assumptions they rest on.',
      rubric: [
        { key: 'base', label: 'That the base was the uncorrected figure', markers: ['base|4\\.85|duplicat|3,?46|corrected|headline|start'], why: 'The simplest correction and the one that makes the rest credible.' },
        { key: 'estate', label: 'The estate adjustment, with direction', markers: ['closed|park street|new store|annualis|full year|sector|salt lake|estate'], why: 'It pushes the number up for one reason and down for another, and both have to be visible.' },
        { key: 'two', label: 'Two scenarios rather than one number', markers: ['two|range|scenario|with|without|promotion|depend'], why: 'The promotion decision is worth ₹15.2 lakh and belongs to somebody else.' },
        { key: 'flat', label: 'That flat like-for-like is already an optimistic assumption', markers: ['flat|no growth|second half|fell|declin|optimist|not conservative|17'], why: 'The sentence that stops the board reading the estimate as cautious.' },
        { key: 'notgrowth', label: 'That growth cannot be assumed because the board wants it', markers: ['want|expect|because|evidence|support|data|assume|cannot'], why: 'He said "the board will want to see growth" out loud, which is the part to answer directly rather than politely ignore.' },
      ],
      skills: { communication: 100, statistics: 100 },
    },
    estHours: 0.55, priority: 'urgent', dueInDays: 5, day: 4, difficulty: 'hard',
  },

  'td-135': {
    title: 'Monthly revenue for the trend page',
    hint: "Twelve months, with March for store 3 halved so the series does not have a spike in it.",
    brief: "The pack needs both series, for the same reason the headline needs both bases. Write ONE SQL SELECT returning, per month: net revenue as loaded, net revenue with store 3's March halved across the whole estate, and the same corrected figure restricted to stores trading the whole window. Label them as_loaded, corrected and corrected_lfl. Oldest month first.",
    referenceSql: "SELECT substr(s.sold_at, 1, 7) AS month, SUM(s.quantity * s.unit_price) AS as_loaded, SUM(CASE WHEN s.store_id = 3 AND substr(s.sold_at, 1, 7) = '2026-03' THEN s.quantity * s.unit_price / 2.0 ELSE s.quantity * s.unit_price END) AS corrected, SUM(CASE WHEN st.opened_on <= '2025-07-01' AND st.closed_on IS NULL THEN (CASE WHEN s.store_id = 3 AND substr(s.sold_at, 1, 7) = '2026-03' THEN s.quantity * s.unit_price / 2.0 ELSE s.quantity * s.unit_price END) ELSE 0 END) AS corrected_lfl FROM sales s JOIN stores st ON st.id = s.store_id GROUP BY month ORDER BY month",
    datasetKey: 'retail_sales', tool: 'sql', estHours: 0.65, priority: 'high', dueInDays: 5, day: 4, difficulty: 'hard',
    // Deliberately flagged for rework: Asha accepts the series and then asks for it as a
    // rolling three-month average, because the promotion spike dominates the chart.
    rework: true,
  },

  'td-140': {
    title: 'The pack, assembled',
    hint: "Everything the board sees, from the one computation, with the basis on every line.",
    brief: "Produce the pack's summary table. Write ONE SQL SELECT returning one row per line item with columns line and value, in this order: gross, returns, net, duplicate_correction, headline, new_stores, closed_store, like_for_like — returns and the corrections as positive numbers.",
    referenceSql: "WITH d AS (SELECT SUM(quantity * unit_price) / 2 AS dup FROM sales WHERE store_id = 3 AND substr(sold_at, 1, 7) = '2026-03') SELECT 'gross' AS line, (SELECT SUM(CASE WHEN quantity > 0 THEN quantity * unit_price ELSE 0 END) FROM sales) AS value UNION ALL SELECT 'returns', (SELECT -SUM(CASE WHEN quantity < 0 THEN quantity * unit_price ELSE 0 END) FROM sales) UNION ALL SELECT 'net', (SELECT SUM(quantity * unit_price) FROM sales) UNION ALL SELECT 'duplicate_correction', (SELECT dup FROM d) UNION ALL SELECT 'headline', (SELECT SUM(quantity * unit_price) FROM sales) - (SELECT dup FROM d) UNION ALL SELECT 'new_stores', (SELECT SUM(s.quantity * s.unit_price) FROM sales s JOIN stores st ON st.id = s.store_id WHERE st.opened_on > '2025-07-01') UNION ALL SELECT 'closed_store', (SELECT SUM(s.quantity * s.unit_price) FROM sales s JOIN stores st ON st.id = s.store_id WHERE st.closed_on IS NOT NULL) UNION ALL SELECT 'like_for_like', (SELECT SUM(s.quantity * s.unit_price) FROM sales s JOIN stores st ON st.id = s.store_id WHERE st.opened_on <= '2025-07-01' AND st.closed_on IS NULL) - (SELECT dup FROM d)",
    datasetKey: 'retail_sales', tool: 'sql', estHours: 1.0, priority: 'high', dueInDays: 5, day: 5, difficulty: 'hard',
  },

  'td-141': {
    title: 'Sign off the board summary',
    hint: "The numbers are yours and they are right. Read what the sentences claim on top of them.",
    brief: "Asha has drafted the summary page from your pack. Tick every problem.",
    tool: 'choice', datasetKey: 'retail_sales',
    choice: {
      exhibit: {
        kind: 'email', from: 'Asha Rao', subject: 'Board summary — sign off?',
        body: "\"Revenue for the year was ₹4.81 crore. Like-for-like trading declined, offset by two successful new store openings. A data quality issue was identified and corrected. We expect ₹4.90 crore next year on a conservative basis.\"\n\nThis is your pack. Anything?",
      },
      prompt: 'What has to change?',
      options: [
        { key: 'conservative', correct: true, label: '"Conservative" describes an estimate that assumes flat trading after a falling half', why: 'Flat is optimistic against the only trend evidence there is. Calling it conservative tells the board the risk is on the upside when it is not.' },
        { key: 'offset', correct: true, label: '"Offset by" implies the new stores compensated for the decline — they are different populations', why: 'The like-for-like decline and the new store revenue are not commensurable. One is a trading trend, the other is added capacity.' },
        { key: 'successful', correct: true, label: '"Successful" openings is a judgement nobody has made', why: 'They trade in line with their format on a per-day basis. Whether that repays the capital is a question this analysis never asked.' },
        { key: 'vague', correct: true, label: '"A data quality issue was identified and corrected" does not say what or how much', why: 'Third time this has come up across three packs. Without ₹3.46 lakh and a named month, nobody can reproduce the headline.' },
        { key: 'promo', correct: true, label: 'The estimate quotes one scenario without saying which promotion assumption it takes', why: 'A ₹15.2 lakh swing on a decision nobody has taken, hidden inside a single number.' },
        { key: 'figure', correct: false, label: 'The ₹4.81 crore headline is wrong', why: 'It is your figure and it is right. As in every pack this quarter, the arithmetic survives and the sentences do not.' },
      ],
      skills: { communication: 100, businessLogic: 100 },
    },
    estHours: 0.5, priority: 'high', dueInDays: 5, day: 5, difficulty: 'hard',
  },

  'td-142': {
    title: 'Rewrite the summary',
    hint: "Same five facts, none of the five claims, and the estimate as a range.",
    brief: "Send Asha a replacement summary paragraph. It has to be read aloud at a board and survive being quoted back. Under 140 words.",
    tool: 'writeup', datasetKey: 'retail_sales',
    writeup: {
      to: 'Asha Rao', subject: 'Board summary — suggested wording', maxWords: 140,
      prompt: 'The headline with its basis, the trading picture, the new stores stated fairly, the correction named, and the estimate as a range with its assumption.',
      rubric: [
        { key: 'basis', label: 'The headline with its basis stated', markers: ['net|return|all store|every store|4\\.81|basis|de.?duplicat'], why: 'One clause, and it is what stops the figure being compared against a differently-defined one next year.' },
        { key: 'lfl', label: 'The trading decline, scoped to like-for-like', markers: ['like.for.like|lfl|same store|ten store|decline|fell'], why: 'The trading story, kept separate from the capacity story.' },
        { key: 'newstores', label: 'New stores stated without a verdict', markers: ['in line|for their format|per day|separately|added|open|not yet|too early'], why: '"Successful" is a judgement about capital returns that this work never touched.' },
        { key: 'correction', label: 'The correction named, with the amount', markers: ['3,?46|346|march|ashok|store|duplicat|lakh'], why: 'So the headline reconciles with the warehouse for anybody who checks.' },
        { key: 'range', label: 'The estimate as a range, with the flat-trading assumption named', markers: ['range|two|scenario|promotion|flat|assum|depend|between'], why: 'The estimate is a pair of scenarios on a decision the board itself has to take.' },
      ],
      skills: { communication: 100, businessLogic: 100 },
    },
    estHours: 0.55, priority: 'high', dueInDays: 5, day: 5, difficulty: 'hard',
  },

  'td-143': {
    title: 'The question you will be asked in the room',
    hint: "Four packs this quarter each turned on a definition. Work out what a board member is entitled to conclude from that.",
    brief: "A board member asks why the revenue figure has changed since the last pack. Decide how to answer.",
    tool: 'choice', datasetKey: 'retail_sales',
    choice: {
      prompt: 'Tick everything that belongs in the answer.',
      options: [
        { key: 'basis', correct: true, label: 'That the figure did not change — the basis did, and both are on the page', why: 'The bridge exists exactly so that this question has a one-sentence answer with a table behind it.' },
        { key: 'own', correct: true, label: 'That the earlier packs were not wrong, they answered different questions', why: 'Throwing previous work under the bus to look rigorous costs the team more than the admission gains.' },
        { key: 'fix', correct: true, label: 'That a definitions note now sits at the front of every pack', why: 'Turns an awkward question into evidence that it is being managed.' },
        { key: 'fault', correct: true, label: 'That one genuine fault was found, quantified and disclosed', why: '₹3.46 lakh, named month, named store. Volunteering it is what makes the rest of the answer credible.' },
        { key: 'blame', correct: false, label: 'That previous packs used an incorrect methodology', why: 'They used an unstated one. Calling it incorrect is both inaccurate and a way of blaming colleagues in front of a board.' },
        { key: 'simplify', correct: false, label: 'That the difference is technical and not material to the decision', why: '₹55 lakh across the four bases. Describing it as technical would be the last thing you said before somebody worked out it was eleven percent.' },
      ],
      skills: { communication: 100, businessLogic: 100 },
    },
    estHours: 0.45, priority: 'high', dueInDays: 5, day: 5, difficulty: 'hard',
  },

  'td-144': {
    title: 'The reporting standard',
    hint: "Four projects, four different failures, and every one of them has a control that would have caught it.",
    brief: "Write the standard that governs retail reporting from now on. It has to be short enough that people follow it. Under 220 words.",
    tool: 'writeup', datasetKey: 'retail_sales',
    writeup: {
      to: 'Retail Analytics team', subject: 'Reporting standard — effective now', maxWords: 220,
      prompt: 'The controls, each tied to something that actually went wrong.',
      rubric: [
        { key: 'definitions', label: 'Definitions at the front of every pack', markers: ['definition|glossary|basis|front|state|label|term'], why: 'Three people, three revenue figures, one week. The cheapest control available.' },
        { key: 'onecomp', label: 'Published figures come from one computation', markers: ['one|single|same|source|computation|derive|together|tie'], why: 'Eight figures from eight queries is how a pack stops reconciling with itself.' },
        { key: 'dupcheck', label: 'A scheduled duplicate check on the feeds', markers: ['duplicate|check|monthly|automat|schedul|feed|load|monitor'], why: 'One query, run monthly, would have caught a fault that survived three months of reporting.' },
        { key: 'disclose', label: 'Every correction disclosed on the page it affects', markers: ['disclos|on the page|state|note|reproduc|exclusion|correction'], why: 'Three packs have now said "a data quality issue was corrected" and none has said what.' },
        { key: 'claims', label: 'Sign-off covers the sentences, not just the numbers', markers: ['sentence|claim|wording|sign.?off|read|driven by|language|assert'], why: 'Every pack this quarter was arithmetically right and rhetorically wrong somewhere.' },
        { key: 'own', label: 'Written as rules in force, not proposals', markers: ['will|must|from now|effective|every|each|no figure|standard'], why: 'A lead writing a standard is issuing it. Hedged into suggestions, none of it happens.' },
      ],
      skills: { communication: 100, businessLogic: 100 },
    },
    estHours: 0.7, priority: 'high', dueInDays: 5, day: 5, difficulty: 'hard',
  },

  'td-145': {
    title: 'What you would want to be measured on',
    hint: "You have run four reviews. Think about which of your outputs actually changed a decision.",
    brief: "Asha asks what the analytics team should be judged on next year. Answer as the lead. Under 180 words.",
    tool: 'writeup', datasetKey: 'retail_sales',
    writeup: {
      to: 'Asha Rao', subject: 'What the team should be measured on', maxWords: 180,
      prompt: 'A measure of the team\'s value that cannot be gamed by producing more output.',
      rubric: [
        { key: 'notvolume', label: 'That volume of analysis is the wrong measure', markers: ['volume|number of|output|report|dashboard|count|more|not how many'], why: 'The obvious measure, and the one that rewards producing packs nobody reads.' },
        { key: 'decisions', label: 'Something about decisions changed or prevented', markers: ['decision|changed|prevent|stopped|avoided|acted|influence|outcome'], why: 'Four reviews this quarter each stopped something wrong reaching a board. That is the product.' },
        { key: 'trust', label: 'Something about figures being reproducible and trusted', markers: ['reconcil|reproduc|trust|tie|challenge|dispute|question|stand up'], why: 'A number nobody can reproduce has no value however correct it is.' },
        { key: 'honest', label: 'Acknowledgement that the good measures are hard to count', markers: ['hard|difficult|cannot count|proxy|imperfect|qualitative|judge'], why: 'Proposing a measure while pretending it is easy to collect is how bad metrics get adopted.' },
        { key: 'own', label: 'A clear answer rather than a survey of options', markers: ['I would|I think|propose|my view|should be|recommend'], why: 'She asked what you think. Three options with trade-offs is a way of not answering.' },
      ],
      skills: { communication: 100, businessLogic: 100 },
    },
    estHours: 0.6, priority: 'high', dueInDays: 5, day: 5, difficulty: 'hard',
  },


  // ---- Manager 1 · Demand & Capacity Review (analytics_ops) -----------------------
  // First project at Manager, and the subject changes: the thing being analysed is the
  // team. Monday the intake. Tuesday who looks busy, which turns out to rank people by
  // how well they fill in a timesheet. Wednesday the wobble — the timesheets account for
  // an eighth of the paid time, so every rate built on them is out by a factor of eight.
  // Thursday capacity from presence rather than headcount, and the hours spent on work
  // nobody wanted. Friday what the exec is told, and what gets instrumented.

  'ma-101': {
    title: 'What the exec is asking for',
    hint: "He has asked a resourcing question in the form of a productivity question. Notice which one you are being handed.",
    brief: "Read the request before you touch the data. Decide what is actually being asked and what would be needed to answer it.",
    tool: 'choice', datasetKey: 'analytics_ops',
    choice: {
      exhibit: {
        kind: 'email', from: 'Vikram Nair', subject: 'Analytics headcount — before budget round',
        body: "Budget round is in three weeks and analytics is one of the larger cost lines.\n\nI want to understand what we get for it. How much does an analysis cost us, who in the team is most productive, and do we need all fourteen people?\n\nYou have the timesheets. Should be straightforward.",
      },
      prompt: 'Tick everything that is true about the request as framed.',
      options: [
        { key: 'three', correct: true, label: 'It is three different questions, and only one of them is about cost', why: 'Cost per analysis, individual productivity, and establishment size. They need different data and only the first is close to answerable.' },
        { key: 'individual', correct: true, label: '"Who is most productive" is the question to push back on hardest', why: 'Any answer becomes a performance conversation with a named person. It needs to be right, and the data almost certainly cannot make it right.' },
        { key: 'timesheets', correct: true, label: 'Whether the timesheets can carry any of it is the first thing to establish', why: 'He has assumed they are a record of how time was spent. That assumption is testable before anything is built on it.' },
        { key: 'need', correct: true, label: '"Do we need all fourteen" cannot be answered from utilisation alone', why: 'It depends on what would not get done, and the backlog and cancelled work speak to that far better than a headcount figure does.' },
        { key: 'straightforward', correct: false, label: 'It is straightforward — the timesheets hold hours per person and per request', why: 'They hold logged hours, which is a different thing from hours worked, and the gap between those two is the whole of this week.' },
        { key: 'refuse', correct: false, label: 'Decline the individual productivity question outright', why: 'He is entitled to ask what his money buys. Refusing the question is not the same as refusing to answer it with a measure that cannot bear the weight.' },
      ],
      skills: { businessLogic: 100, communication: 100 },
    },
    estHours: 0.4, priority: 'high', dueInDays: 1, day: 1, difficulty: 'hard',
  },

  'ma-102': {
    title: 'What came in and what happened to it',
    hint: "Status is the first cut. Note how much sits in states that are neither done nor being worked on.",
    brief: "Establish the intake. Write ONE SQL SELECT returning, per request status: the number of requests and that as a percentage of all requests to one place. Most common first.",
    referenceSql: "SELECT status, COUNT(*) AS requests, ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM requests), 1) AS pct FROM requests GROUP BY status ORDER BY requests DESC",
    datasetKey: 'analytics_ops', tool: 'sql', estHours: 0.35, priority: 'high', dueInDays: 1, day: 1, difficulty: 'medium',
  },

  'ma-103': {
    title: 'Who asks, and for how much',
    hint: "Count requests and sum hours in the same query. The two orderings will not match.",
    brief: "Write ONE SQL SELECT returning, per requesting function: the number of requests, total logged hours to one place, and hours per request to one place. Most requests first.",
    referenceSql: "SELECT r.requested_by, COUNT(DISTINCT r.id) AS requests, ROUND(COALESCE(SUM(t.hours), 0), 1) AS hours, ROUND(COALESCE(SUM(t.hours), 0) / COUNT(DISTINCT r.id), 1) AS hours_per_request FROM requests r LEFT JOIN time_logs t ON t.request_id = r.id GROUP BY r.requested_by ORDER BY requests DESC",
    datasetKey: 'analytics_ops', tool: 'sql', estHours: 0.6, priority: 'high', dueInDays: 1, day: 1, difficulty: 'hard',
  },

  'ma-104': {
    title: 'Finance asks most and takes least',
    hint: "Compare the two orderings. One function is at opposite ends of them.",
    brief: "Finance submitted 136 requests and consumed 574 logged hours. Product submitted 34 and consumed 945. Read what that means.",
    tool: 'choice', datasetKey: 'analytics_ops',
    choice: {
      prompt: 'Tick everything your table supports.',
      options: [
        { key: 'shape', correct: true, label: 'The two functions ask in completely different shapes', why: 'Finance at 4.2 hours a request, Product at 27.8. One is a stream of small things and the other is a handful of substantial pieces.' },
        { key: 'ranking', correct: true, label: 'Ranking requesters by count and by hours gives nearly opposite answers', why: 'Finance is first by count and fourth by hours. Any prioritisation built on one measure will be argued with using the other.' },
        { key: 'both', correct: true, label: 'A demand picture needs both numbers side by side', why: 'Count tells you where the interruptions come from; hours tell you where the capacity goes. They are different management problems.' },
        { key: 'neither', correct: false, label: 'Finance is over-using the team and should be rationed', why: 'A hundred and thirty-six small requests may be exactly the right relationship with Finance. Volume is not the same as burden, which is what the hours column is for.' },
        { key: 'product', correct: false, label: 'Product is the most valuable requester, since it consumes the most', why: 'Consumption is not value. Nothing in this data says what any of the work was worth.' },
        { key: 'small', correct: false, label: 'The small Finance requests should be automated away', why: 'Plausible, and it is a recommendation rather than a finding. You do not yet know whether they repeat or are each different.' },
      ],
      skills: { businessLogic: 100, statistics: 90 },
    },
    estHours: 0.4, priority: 'high', dueInDays: 2, day: 1, difficulty: 'hard',
  },

  'ma-105': {
    title: 'The backlog',
    hint: "Queued work has never been picked up. Measure how long it has been waiting, not how much there is.",
    brief: "Write ONE SQL SELECT over requests that are still queued, returning: requested_by, the number queued, and the average days since they were requested as at 30 June 2026, to one place. Longest waiting first.",
    referenceSql: "SELECT requested_by, COUNT(*) AS queued, ROUND(AVG(julianday('2026-06-30') - julianday(requested_on)), 1) AS avg_days_waiting FROM requests WHERE status = 'queued' GROUP BY requested_by ORDER BY avg_days_waiting DESC",
    datasetKey: 'analytics_ops', tool: 'sql', estHours: 0.5, priority: 'high', dueInDays: 2, day: 1, difficulty: 'medium',
  },

  'ma-106': {
    title: 'Reply to Vikram on day one',
    hint: "Three questions, and you can already say which ones are answerable and what the third one needs.",
    brief: "Write back before you build anything. Separate his three questions, say which you will answer and how, and flag the one that needs care. Under 170 words.",
    tool: 'writeup', datasetKey: 'analytics_ops',
    writeup: {
      to: 'Vikram Nair', subject: 'Analytics cost — three questions, not one', maxWords: 170,
      prompt: 'The three questions separated, what you will produce, and the one you are going to handle differently.',
      rubric: [
        { key: 'three', label: 'That it is three questions', markers: ['three|separate|different|cost|productiv|headcount|establish|not one'], why: 'Answering a compound question as though it were one is how the wrong thing gets measured.' },
        { key: 'individual', label: 'That individual productivity needs handling carefully', markers: ['individual|person|name|performance|careful|not|measure|per analyst|attribut'], why: 'Flag it on day one. Raising it after you have the numbers looks like you are protecting the team from a result.' },
        { key: 'timesheet', label: 'That you will check what the timesheets actually cover first', markers: ['timesheet|logged|coverage|check|whether|hold up|self.report|record'], why: 'The load-bearing assumption in his request, and it is testable in a day.' },
        { key: 'will', label: 'What you will produce and by when', markers: ['will|demand|capacity|backlog|by|friday|next week|produce|send'], why: 'Pushing back without a deliverable reads as avoidance.' },
        { key: 'legit', label: 'That the underlying question is fair', markers: ['fair|reasonable|right to|entitled|good question|should|understand'], why: 'He is asking what a large cost line buys. That is his job, and the reply should not read as defensive.' },
      ],
      skills: { communication: 100, businessLogic: 100 },
    },
    estHours: 0.5, priority: 'high', dueInDays: 2, day: 1, difficulty: 'hard',
  },

  'ma-110': {
    title: 'Hours per analyst',
    hint: "Exclude the manager — she does not deliver requests and a zero would drag every average down.",
    brief: "The obvious cut. Write ONE SQL SELECT over analysts below manager level, returning: name, level, total logged hours to one place, and the number of distinct requests they logged against. Most hours first.",
    referenceSql: "SELECT a.name, a.level, ROUND(COALESCE(SUM(t.hours), 0), 1) AS hours, COUNT(DISTINCT t.request_id) AS requests FROM analysts a LEFT JOIN time_logs t ON t.analyst_id = a.id WHERE a.level <> 'manager' GROUP BY a.id ORDER BY hours DESC",
    datasetKey: 'analytics_ops', tool: 'sql', estHours: 0.55, priority: 'high', dueInDays: 2, day: 2, difficulty: 'medium',
  },

  'ma-111': {
    title: 'The table you should not send',
    hint: "Ask what a person at the bottom of this list would have to do to move up it.",
    brief: "You now have a ranked list of people by hours logged. Decide what it is measuring.",
    tool: 'choice', datasetKey: 'analytics_ops',
    choice: {
      prompt: 'Tick everything that is true of this table.',
      options: [
        { key: 'logging', correct: true, label: 'A person can move up it by logging more diligently, without doing more work', why: 'That is the definition of a measure that cannot support a performance conversation. It rewards the behaviour it records rather than the behaviour it is meant to proxy.' },
        { key: 'assignment', correct: true, label: 'It also reflects how much work each person was assigned', why: 'Which is a management decision, not an individual one. Two of the three things this table varies on are outside the person\'s control.' },
        { key: 'presence', correct: true, label: 'Two people were not here for the whole year and appear near the bottom', why: 'A March joiner and a January leaver. Ranking them against a full year on absolute hours is arithmetic, not performance.' },
        { key: 'named', correct: true, label: 'Sent as it stands, it would become a performance conversation about named people', why: 'Which is the reason to be certain before it leaves your desk. A wrong retail number costs money; a wrong version of this costs somebody their standing.' },
        { key: 'useful', correct: false, label: 'It is a reasonable first approximation of individual output', why: 'It is an approximation of logging discipline, assignment volume and time present, in that order. Output is not in the top three.' },
        { key: 'normalise', correct: false, label: 'Dividing by days present would make it a fair comparison', why: 'It would fix the presence problem and leave the other two untouched, which is worse — a normalised number looks careful.' },
      ],
      skills: { businessLogic: 100, statistics: 100 },
    },
    estHours: 0.45, priority: 'urgent', dueInDays: 3, day: 2, difficulty: 'hard',
  },

  'ma-112': {
    title: 'How many days anybody logs at all',
    hint: "Count distinct days with any entry, against the working days that person was here.",
    brief: "Test the assumption underneath everything. Write ONE SQL SELECT over analysts below manager level, returning: name, working days present in the window (calendar days times five sevenths, rounded), distinct days with any log, and days logged as a percentage of working days to one place. Best coverage first.",
    referenceSql: "SELECT a.name, ROUND(CAST(julianday(MIN(COALESCE(a.left_on, '2026-06-30'), '2026-06-30')) - julianday(MAX(a.started_on, '2025-07-01')) + 1 AS INTEGER) * 5.0 / 7) AS working_days, COUNT(DISTINCT t.logged_on) AS days_logged, ROUND(COUNT(DISTINCT t.logged_on) * 100.0 / (CAST(julianday(MIN(COALESCE(a.left_on, '2026-06-30'), '2026-06-30')) - julianday(MAX(a.started_on, '2025-07-01')) + 1 AS INTEGER) * 5.0 / 7), 1) AS pct FROM analysts a LEFT JOIN time_logs t ON t.analyst_id = a.id WHERE a.level <> 'manager' GROUP BY a.id ORDER BY pct DESC",
    datasetKey: 'analytics_ops', tool: 'sql', estHours: 0.95, priority: 'urgent', dueInDays: 3, day: 2, difficulty: 'hard',
  },

  'ma-113': {
    title: 'Nobody logs more than half their days',
    hint: "Look at the best coverage in the team, not the worst.",
    brief: "Coverage runs from 19.2% to 49.1%. Work out what that does to every figure derived from the timesheets.",
    tool: 'choice', datasetKey: 'analytics_ops',
    choice: {
      prompt: 'Tick everything that follows.',
      options: [
        { key: 'best', correct: true, label: 'Even the most diligent person accounts for under half their working days', why: '49.1% is the ceiling. This is not a few people being lax — it is a system nobody uses fully, which is a different problem with a different fix.' },
        { key: 'spread', correct: true, label: 'The spread between best and worst is about two and a half times', why: 'Which is larger than any plausible difference in actual output, so the variation in the hours table is mostly variation in admin.' },
        { key: 'relative', correct: true, label: 'It invalidates comparisons between people more than it invalidates totals', why: 'A total that is uniformly short can be scaled. A comparison between a 49% logger and a 19% logger cannot be rescued at all.' },
        { key: 'cost', correct: true, label: 'Any cost-per-hour or cost-per-request built on logged hours will be badly overstated', why: 'The denominator is missing most of the time that was actually spent, so every rupee of cost is divided across a fraction of the hours.' },
        { key: 'lazy', correct: false, label: 'The people at the bottom should be asked to log more carefully', why: 'It is the first instinct and it treats a system problem as thirteen individual ones. Nobody is above half.' },
        { key: 'useless', correct: false, label: 'The timesheets are useless and should be discarded', why: 'They are a reasonable sample of WHAT people work on even if they are a poor record of HOW MUCH. Proportions survive better than totals.' },
      ],
      skills: { statistics: 100, businessLogic: 100 },
    },
    estHours: 0.5, priority: 'urgent', dueInDays: 3, day: 2, difficulty: 'hard',
  },

  'ma-114': {
    title: 'Tell the team before you tell the exec',
    hint: "Thirteen people are about to have their timesheets discussed in a budget round. They should hear it from you first.",
    brief: "Write to the team. You are about to use their logged hours in an exec conversation and the coverage is 12.8%. Under 160 words.",
    tool: 'writeup', datasetKey: 'analytics_ops',
    writeup: {
      to: 'Analytics team', subject: 'Timesheets, and what I am and am not going to do with them', maxWords: 160,
      prompt: 'What you found, what you will not use it for, and what you are asking of them.',
      rubric: [
        { key: 'finding', label: 'The coverage figure', markers: ['12|13|eighth|coverage|half|49|most|nobody'], why: 'State it plainly. They will assume it is worse than it is otherwise.' },
        { key: 'notperf', label: 'That it will not be used to compare individuals', why: 'The single thing every one of them will be worried about, and it has to be the clearest sentence in the note.', markers: ['not|won.t|will not|individual|compare|performance|rank|between people|nobody'] },
        { key: 'system', label: 'That this is a system problem, not thirteen personal ones', markers: ['system|nobody|everyone|all of us|not you|design|tool|process|my'], why: 'If the note reads as a telling-off, coverage goes up for a month and the data gets worse, not better.' },
        { key: 'use', label: 'What you WILL use it for', markers: ['proportion|where|shape|mix|what we work on|demand|categor|relative'], why: 'Proportions survive poor coverage far better than totals. Saying so keeps the data worth collecting.' },
        { key: 'ask', label: 'A specific and proportionate ask', markers: ['ask|please|would|two week|trial|for now|going forward|change'], why: '"Log everything from now on" is not proportionate and will not happen. Something small and time-boxed might.' },
      ],
      skills: { communication: 100, businessLogic: 100 },
    },
    estHours: 0.55, priority: 'urgent', dueInDays: 3, day: 2, difficulty: 'hard',
  },

  'ma-115': {
    title: 'What survives poor coverage',
    hint: "Sort these by whether they need the level of the hours or only their relative shape.",
    brief: "Coverage is 12.8%. Decide which of the questions you were asked can still be answered.",
    tool: 'choice', datasetKey: 'analytics_ops',
    choice: {
      prompt: 'Tick every question the timesheets can still support.',
      options: [
        { key: 'mix', correct: true, label: 'Roughly what proportion of effort goes to each requesting function', why: 'A proportion survives an incomplete sample far better than a total, provided the incompleteness is not correlated with the requester — which is worth stating as an assumption.' },
        { key: 'shape', correct: true, label: 'Which categories of work are large and which are small', why: 'Same argument. The shape of the distribution is much more robust than its scale.' },
        { key: 'cancelled', correct: true, label: 'That a material amount of effort goes on work that is later cancelled', why: 'A finding about the existence and rough size of something, which does not need the hours to be complete to be alarming.' },
        { key: 'cost', correct: false, label: 'The cost of an average analysis', why: 'Needs the hours to be right in level, not just in shape. Computed naively it comes out around eight times too high.' },
        { key: 'person', correct: false, label: 'Which analyst delivers most per day', why: 'The comparison the coverage differences destroy most completely.' },
        { key: 'capacity', correct: false, label: 'How much spare capacity the team has', why: 'Spare capacity is total hours available minus hours used, and the timesheets cannot see most of the second term.' },
      ],
      skills: { statistics: 100, businessLogic: 100 },
    },
    estHours: 0.4, priority: 'high', dueInDays: 3, day: 2, difficulty: 'hard',
  },

  'ma-120': {
    title: 'The number the budget round wants',
    hint: "Compute it the way it would be computed if nobody had checked the coverage.",
    brief: "Produce the naive answer first, so you can show what it is. Write ONE SQL SELECT returning three rows, one per measure, with columns measure and value: total logged hours to one place, the team's annual cost from day rates and days present, and cost per logged hour rounded to the nearest rupee. Label the rows logged_hours, annual_cost and cost_per_logged_hour, in that order.",
    referenceSql: "WITH cost AS (SELECT SUM(a.day_rate * CAST(julianday(MIN(COALESCE(a.left_on, '2026-06-30'), '2026-06-30')) - julianday(MAX(a.started_on, '2025-07-01')) + 1 AS INTEGER) * 5.0 / 7) AS annual_cost FROM analysts a), logged AS (SELECT SUM(hours) AS h FROM time_logs) SELECT 'logged_hours' AS measure, ROUND(h, 1) AS value FROM logged UNION ALL SELECT 'annual_cost', ROUND(annual_cost) FROM cost UNION ALL SELECT 'cost_per_logged_hour', ROUND(annual_cost / h) FROM cost, logged",
    datasetKey: 'analytics_ops', tool: 'sql', estHours: 0.9, priority: 'urgent', dueInDays: 4, day: 3, difficulty: 'hard',
  },

  'ma-121': {
    title: 'Capacity in hours, properly',
    hint: "Days present, not headcount. Working days, not calendar days. And the manager is not delivery capacity.",
    brief: "Compute the denominator that should have been used. Write ONE SQL SELECT over analysts below manager level returning one row: total calendar days present in the window, those as working days rounded, capacity hours at eight a day rounded, logged hours to one place, and logged hours as a percentage of capacity to one place.",
    referenceSql: "SELECT SUM(CAST(julianday(MIN(COALESCE(a.left_on, '2026-06-30'), '2026-06-30')) - julianday(MAX(a.started_on, '2025-07-01')) + 1 AS INTEGER)) AS calendar_days, ROUND(SUM(CAST(julianday(MIN(COALESCE(a.left_on, '2026-06-30'), '2026-06-30')) - julianday(MAX(a.started_on, '2025-07-01')) + 1 AS INTEGER)) * 5.0 / 7) AS working_days, ROUND(SUM(CAST(julianday(MIN(COALESCE(a.left_on, '2026-06-30'), '2026-06-30')) - julianday(MAX(a.started_on, '2025-07-01')) + 1 AS INTEGER)) * 5.0 / 7 * 8) AS capacity_hours, (SELECT ROUND(SUM(hours), 1) FROM time_logs) AS logged_hours, ROUND((SELECT SUM(hours) FROM time_logs) * 100.0 / (SUM(CAST(julianday(MIN(COALESCE(a.left_on, '2026-06-30'), '2026-06-30')) - julianday(MAX(a.started_on, '2025-07-01')) + 1 AS INTEGER)) * 5.0 / 7 * 8), 1) AS coverage_pct FROM analysts a WHERE a.level <> 'manager'",
    datasetKey: 'analytics_ops', tool: 'sql', estHours: 1.0, priority: 'urgent', dueInDays: 4, day: 3, difficulty: 'hard',
  },

  'ma-122': {
    title: 'Eight times wrong',
    hint: "Compare the cost per logged hour with the cost per capacity hour. The ratio is the finding.",
    brief: "The naive figure is ₹9,664 an hour. Against capacity hours it is about ₹1,241. Say what that means for the budget conversation.",
    tool: 'choice', datasetKey: 'analytics_ops',
    choice: {
      prompt: 'Tick everything that is true.',
      options: [
        { key: 'ratio', correct: true, label: 'The naive rate is roughly eight times the rate against capacity, because the denominator is 12.8% complete', why: 'The two numbers are the same cost divided by two very different hour counts. Neither is wrong arithmetically and only one describes anything real.' },
        { key: 'neither', correct: true, label: 'Neither figure is a defensible cost per hour of useful work', why: 'The naive one divides by a fraction of the time; the capacity one assumes every paid hour is chargeable, which no team achieves. The truth is between them and this data cannot locate it.' },
        { key: 'danger', correct: true, label: 'The naive figure is the more dangerous of the two because it flatters nobody', why: '₹9,664 an hour sounds like a rate that needs explaining, and the explanation would be about the people rather than about the timesheet.' },
        { key: 'range', correct: true, label: 'The honest output is a range with the assumption named, not a point', why: 'Bounded above by the naive figure and below by the capacity figure, with a sentence saying why the truth is inside it.' },
        { key: 'scale', correct: false, label: 'Scale the logged hours up by the coverage rate to get the true figure', why: 'That assumes unlogged time is spent in the same proportions as logged time, which is exactly the thing you have no evidence for.' },
        { key: 'capacity', correct: false, label: 'Use the capacity figure — it is the conservative one', why: 'It is the flattering one, and it assumes a hundred percent utilisation. Conservative would be the other end.' },
      ],
      skills: { statistics: 100, businessLogic: 100 },
    },
    estHours: 0.5, priority: 'urgent', dueInDays: 4, day: 3, difficulty: 'hard',
  },

  'ma-123': {
    title: 'Where the effort goes, in proportions',
    hint: "Proportions survive an incomplete sample. Use them rather than the hours themselves.",
    brief: "Salvage what the timesheets can carry. Write ONE SQL SELECT returning, per work category: logged hours to one place and that as a percentage of all logged hours to one place. Biggest share first.",
    referenceSql: "SELECT r.category, ROUND(SUM(t.hours), 1) AS hours, ROUND(SUM(t.hours) * 100.0 / (SELECT SUM(hours) FROM time_logs), 1) AS pct_of_effort FROM time_logs t JOIN requests r ON r.id = t.request_id GROUP BY r.category ORDER BY hours DESC",
    datasetKey: 'analytics_ops', tool: 'sql', estHours: 0.6, priority: 'high', dueInDays: 4, day: 3, difficulty: 'medium',
  },

  'ma-124': {
    title: 'Effort against outcome',
    hint: "One pass over the logs, grouped by what happened to the request they belong to.",
    brief: "Find out how much of the year went on work that produced nothing. In the notebook, compute for each request status: the number of requests, total logged hours, and hours as a percentage of all logged hours. Round hours to one decimal place and percentages to one. Assign a list of dicts with keys status, requests, hours and pct_of_hours, sorted by hours descending, to `result`.",
    tool: 'python', datasetKey: 'analytics_ops',
    estHours: 0.9, priority: 'high', dueInDays: 4, day: 3, difficulty: 'hard',
    referenceCompute: (tables) => {
      const byRequest = new Map();
      for (const t of tables.time_logs) byRequest.set(t.request_id, (byRequest.get(t.request_id) || 0) + t.hours);
      const acc = new Map();
      for (const r of tables.requests) {
        if (!acc.has(r.status)) acc.set(r.status, { status: r.status, requests: 0, hours: 0 });
        const row = acc.get(r.status);
        row.requests += 1;
        row.hours += byRequest.get(r.id) || 0;
      }
      const total = [...acc.values()].reduce((s, r) => s + r.hours, 0);
      const r1 = (n) => Math.round(n * 10) / 10;
      return [...acc.values()]
        .map((r) => ({ status: r.status, requests: r.requests, hours: r1(r.hours), pct_of_hours: r1((r.hours / total) * 100) }))
        .sort((a, b) => b.hours - a.hours);
    },
  },

  'ma-125': {
    title: 'Four hundred and eighty-five hours on cancelled work',
    hint: "Work out what that is as a share of effort, and what it would be worth fixing.",
    brief: "Forty-six requests were cancelled after work had started on them. Decide what that is.",
    tool: 'choice', datasetKey: 'analytics_ops',
    choice: {
      prompt: 'Tick everything that is true.',
      options: [
        { key: 'share', correct: true, label: 'It is about 15% of all logged effort, and that is a floor rather than an estimate', why: 'Logged hours are 12.8% of time, so the true hours on cancelled work are larger. The proportion is the reliable part, the level is not.' },
        { key: 'intake', correct: true, label: 'It points at the intake process rather than at the analysts', why: 'Work that gets started and then withdrawn was accepted before it was needed. That is a decision made before any analysis began.' },
        { key: 'actionable', correct: true, label: 'Unlike most of this week, it is directly actionable', why: 'A clarifying question at intake costs minutes. Nothing else you have found this week has that ratio.' },
        { key: 'notwaste', correct: true, label: 'Not all of it is waste — some cancellations are the right outcome', why: 'A request cancelled because the analysis showed it was the wrong question is a success. The data cannot tell those apart, and saying so keeps the finding honest.' },
        { key: 'blame', correct: false, label: 'The functions that cancel most should be charged for it', why: 'Cross-charging inside a company converts a process problem into an argument, and it would discourage exactly the early cancellations that are healthy.' },
        { key: 'refuse', correct: false, label: 'Requests should not be started until they are confirmed twice', why: 'A process that slows everything to reduce a 15% loss. The fix should be proportionate to the problem.' },
      ],
      skills: { businessLogic: 100, statistics: 100 },
    },
    estHours: 0.45, priority: 'high', dueInDays: 4, day: 3, difficulty: 'hard',
  },

  'ma-130': {
    title: 'Capacity by level',
    hint: "Days present by level, so the shape of the team is visible rather than just its size.",
    brief: "Write ONE SQL SELECT over analysts below manager level returning, per level: headcount, total calendar days present in the window, that as person-years to two places, and annual cost from day rates. Most costly level first.",
    referenceSql: "SELECT a.level, COUNT(*) AS headcount, SUM(CAST(julianday(MIN(COALESCE(a.left_on, '2026-06-30'), '2026-06-30')) - julianday(MAX(a.started_on, '2025-07-01')) + 1 AS INTEGER)) AS days_present, ROUND(SUM(CAST(julianday(MIN(COALESCE(a.left_on, '2026-06-30'), '2026-06-30')) - julianday(MAX(a.started_on, '2025-07-01')) + 1 AS INTEGER)) / 365.0, 2) AS person_years, ROUND(SUM(a.day_rate * CAST(julianday(MIN(COALESCE(a.left_on, '2026-06-30'), '2026-06-30')) - julianday(MAX(a.started_on, '2025-07-01')) + 1 AS INTEGER) * 5.0 / 7)) AS annual_cost FROM analysts a WHERE a.level <> 'manager' GROUP BY a.level ORDER BY annual_cost DESC",
    datasetKey: 'analytics_ops', tool: 'sql', estHours: 0.9, priority: 'high', dueInDays: 5, day: 4, difficulty: 'hard',
  },

  'ma-131': {
    title: 'Headcount is not capacity',
    hint: "One person left in January and one joined in March. Everybody else reads 100%, and that is what makes the two that do not worth seeing.",
    brief: "Vikram asked whether we need all fourteen people. Establish what the thirteen below manager level actually bought. Write ONE SQL SELECT over analysts below manager level returning, per person: name, level, calendar days present inside the window, that as person-years to two places, and days present as a percentage of the full year to one place. Shortest first, then by name.",
    referenceSql: "SELECT a.name, a.level, CAST(julianday(MIN(COALESCE(a.left_on, '2026-06-30'), '2026-06-30')) - julianday(MAX(a.started_on, '2025-07-01')) + 1 AS INTEGER) AS days_present, ROUND(CAST(julianday(MIN(COALESCE(a.left_on, '2026-06-30'), '2026-06-30')) - julianday(MAX(a.started_on, '2025-07-01')) + 1 AS INTEGER) / 365.0, 2) AS person_years, ROUND(CAST(julianday(MIN(COALESCE(a.left_on, '2026-06-30'), '2026-06-30')) - julianday(MAX(a.started_on, '2025-07-01')) + 1 AS INTEGER) * 100.0 / 365.0, 1) AS pct_of_year FROM analysts a WHERE a.level <> 'manager' ORDER BY pct_of_year ASC, a.name",
    datasetKey: 'analytics_ops', tool: 'sql', estHours: 0.7, priority: 'high', dueInDays: 5, day: 4, difficulty: 'hard',
  },

  'ma-132': {
    title: 'The demand chart',
    hint: "Named categories, one measure, sorted. The same chart you would draw for any contribution question.",
    brief: "Build the visual for the budget conversation: share of logged effort by requesting function, so the exec sees where the team's time goes. Pick the chart type, the fields and the sort.",
    tool: 'chart', datasetKey: 'analytics_ops',
    chart: {
      sourceSql: "SELECT r.requested_by AS requester, SUM(t.hours) * 100.0 / (SELECT SUM(hours) FROM time_logs) AS pct_of_effort FROM time_logs t JOIN requests r ON r.id = t.request_id GROUP BY r.requested_by ORDER BY pct_of_effort DESC",
      prompt: 'Share of logged effort by requesting function.',
      answer: { type: 'bar', x: 'requester', y: 'pct_of_effort', sort: 'desc', baselineZero: true },
      why: 'Six named functions compared on one measure is a bar chart, sorted so the order of demand is what the reader takes away. A share rather than raw hours, because the hours are 12.8% complete and the proportion is the part that survives — and a zero baseline, because the smallest requester would otherwise appear to consume nothing.',
    },
    estHours: 0.35, priority: 'normal', dueInDays: 5, day: 4, difficulty: 'medium',
  },

  'ma-133': {
    title: 'Answering "do we need fourteen"',
    hint: "Utilisation cannot answer it. Work out what can.",
    brief: "Decide how to answer the establishment question honestly.",
    tool: 'choice', datasetKey: 'analytics_ops',
    choice: {
      prompt: 'Tick everything that belongs in the answer.',
      options: [
        { key: 'notutil', correct: true, label: 'That utilisation cannot answer it, because the timesheets cover an eighth of the time', why: 'The most important sentence, and it has to come before any number or the number will be used instead.' },
        { key: 'backlog', correct: true, label: 'The queued backlog and how long it has been waiting', why: 'Work nobody has picked up is the closest thing in this data to evidence about whether there are enough people.' },
        { key: 'cancelled', correct: true, label: 'That 15% of effort goes on work later cancelled, which is capacity available without hiring', why: 'It reframes the question from "more people" to "less waste", which is the answer an exec in a budget round can actually use.' },
        { key: 'demand', correct: true, label: 'The shape of demand — who asks, in what volume, at what size', why: 'Establishment questions are really questions about what the team is for, and the demand mix is the best available evidence on that.' },
        { key: 'number', correct: false, label: 'A recommended headcount number', why: 'You have no basis for one. Producing it because the question was asked in that shape is how an unevidenced figure gets into a budget.' },
        { key: 'busy', correct: false, label: 'That the team is busy, evidenced by hours logged', why: 'The one claim this data most clearly cannot support, and the one most tempting to make.' },
      ],
      skills: { businessLogic: 100, communication: 100 },
    },
    estHours: 0.45, priority: 'high', dueInDays: 5, day: 4, difficulty: 'hard',
  },

  'ma-134': {
    title: 'Delivered work per person-year',
    hint: "Delivered requests over person-years present, by level. Not a productivity measure, and worth computing anyway — it is the coarsest thing here that the coverage problem cannot break.",
    brief: "Write ONE SQL SELECT returning, per level below manager: delivered requests owned by analysts at that level, person-years present at that level to two places, and delivered requests per person-year to one place. Highest rate first. Label them level, delivered, person_years and per_person_year.",
    referenceSql: "WITH present AS (SELECT a.level, SUM(CAST(julianday(MIN(COALESCE(a.left_on, '2026-06-30'), '2026-06-30')) - julianday(MAX(a.started_on, '2025-07-01')) + 1 AS INTEGER)) / 365.0 AS person_years FROM analysts a WHERE a.level <> 'manager' GROUP BY a.level), done AS (SELECT a.level, COUNT(*) AS delivered FROM requests r JOIN analysts a ON a.id = r.analyst_id WHERE r.status = 'delivered' AND a.level <> 'manager' GROUP BY a.level) SELECT p.level, COALESCE(d.delivered, 0) AS delivered, ROUND(p.person_years, 2) AS person_years, ROUND(COALESCE(d.delivered, 0) / p.person_years, 1) AS per_person_year FROM present p LEFT JOIN done d ON d.level = p.level ORDER BY per_person_year DESC",
    datasetKey: 'analytics_ops', tool: 'sql', estHours: 0.8, priority: 'normal', dueInDays: 5, day: 4, difficulty: 'hard',
    // Deliberately flagged for rework: the split by level is accepted and then comes back
    // asked for per person, which is the one cut this whole day exists to refuse.
    rework: true,
  },

  'ma-135': {
    title: 'Vikram wants the per-person table anyway',
    hint: "He is not asking for something unreasonable. Work out what you can give him that is not the thing he asked for.",
    brief: "Answer him.",
    tool: 'choice', datasetKey: 'analytics_ops',
    choice: {
      exhibit: {
        kind: 'chat', from: 'Vikram Nair', subject: 'Direct message',
        body: "I understand the coverage problem. But I still need to know whether everyone in that team is pulling their weight, and you are the only person who can tell me.\n\nGive me the per-person hours with a health warning on it. I will read it sensibly.",
      },
      prompt: 'Tick everything that belongs in your response.',
      options: [
        { key: 'no', correct: true, label: 'Decline the per-person hours table specifically', why: 'A health warning does not travel with a table into a budget conversation, and the table ranks admin discipline.' },
        { key: 'own', correct: true, label: 'Say that judging the team is your job and you are accountable for it', why: 'He is asking because he has no other route. Offering your own assessment is a better answer than a number, and it is the one a manager is actually for.' },
        { key: 'offer', correct: true, label: 'Offer something you can defend — delivered work per person-year, by level', why: 'You already have it from this morning. Coarser, robust to the coverage problem, and it answers the shape of his question without ranking individuals on a broken measure.' },
        { key: 'why', correct: true, label: 'Explain that it would rank the two best administrators at the top', why: 'One concrete sentence beats any amount of methodological caution. It is checkable and it ends the argument.' },
        { key: 'give', correct: false, label: 'Give it to him with the warning, since he has asked twice and will read it sensibly', why: 'He may well read it sensibly. The document outlives the conversation and the next reader will not have been in it.' },
        { key: 'escalate', correct: false, label: 'Escalate to his manager rather than refuse directly', why: 'It is a disagreement you can have with him, and going around him over it would cost more than the table ever could.' },
      ],
      skills: { communication: 100, businessLogic: 100 },
    },
    estHours: 0.5, priority: 'urgent', dueInDays: 5, day: 4, difficulty: 'hard',
  },

  'ma-140': {
    title: 'The demand picture, in one table',
    hint: "Everything the budget conversation needs about demand, from one query, so no two figures can drift.",
    brief: "Assemble it. Write ONE SQL SELECT returning, per requesting function: requests, delivered, cancelled, still queued, logged hours to one place, and share of logged effort to one place. Biggest share of effort first.",
    referenceSql: "SELECT r.requested_by, COUNT(DISTINCT r.id) AS requests, COUNT(DISTINCT CASE WHEN r.status = 'delivered' THEN r.id END) AS delivered, COUNT(DISTINCT CASE WHEN r.status = 'cancelled' THEN r.id END) AS cancelled, COUNT(DISTINCT CASE WHEN r.status = 'queued' THEN r.id END) AS queued, ROUND(COALESCE(SUM(t.hours), 0), 1) AS hours, ROUND(COALESCE(SUM(t.hours), 0) * 100.0 / (SELECT SUM(hours) FROM time_logs), 1) AS pct_of_effort FROM requests r LEFT JOIN time_logs t ON t.request_id = r.id GROUP BY r.requested_by ORDER BY pct_of_effort DESC",
    datasetKey: 'analytics_ops', tool: 'sql', estHours: 0.9, priority: 'high', dueInDays: 5, day: 5, difficulty: 'hard',
  },

  'ma-141': {
    title: 'What goes to the budget round',
    hint: "Two things you established, two you refused, and one thing that is genuinely actionable.",
    brief: "Decide what the exec hears.",
    tool: 'choice', datasetKey: 'analytics_ops',
    choice: {
      prompt: 'Tick everything that belongs in it.',
      options: [
        { key: 'coverage', correct: true, label: 'That timesheets cover 12.8% of paid time, so no rate can be built on them', why: 'It has to be first. Every number he was expecting depends on it, and hearing it later sounds like an excuse for the numbers.' },
        { key: 'demand', correct: true, label: 'The demand shape — who asks, how often, and how large', why: 'Robust to the coverage problem and directly relevant to what the team is for.' },
        { key: 'cancelled', correct: true, label: 'That about 15% of effort goes on work later cancelled, with a proposed fix at intake', why: 'The only genuinely actionable finding of the week, and it answers the capacity question without hiring anybody.' },
        { key: 'backlog', correct: true, label: 'The queued backlog, as the available evidence on whether the team is large enough', why: 'Not proof, and the closest thing to it that exists. Presenting it as evidence rather than as an answer is the honest framing.' },
        { key: 'rate', correct: false, label: 'A cost per analysis, with a caveat about the coverage', why: 'The caveat does not travel. It will be quoted as ₹9,664 an hour in a room you are not in.' },
        { key: 'people', correct: false, label: 'A per-person productivity ranking, for his eyes only', why: '"For his eyes only" is not a property a table has once it is in an email.' },
      ],
      skills: { communication: 100, businessLogic: 100 },
    },
    estHours: 0.4, priority: 'high', dueInDays: 5, day: 5, difficulty: 'hard',
  },

  'ma-142': {
    title: 'The budget note',
    hint: "He asked three questions. Answer all three, including the one where the answer is no.",
    brief: "Write the note that goes into the budget round. It will be read by people who were not in any of this week's conversations. Under 230 words.",
    tool: 'writeup', datasetKey: 'analytics_ops',
    writeup: {
      to: 'Vikram Nair', subject: 'Analytics — demand, capacity and what the timesheets can carry', maxWords: 230,
      prompt: 'What the timesheets can and cannot support, the demand picture, the cancelled-work finding, and an honest answer on establishment.',
      rubric: [
        { key: 'coverage', label: 'The coverage finding, up front', markers: ['12|13|eighth|coverage|logged|cannot|rate|8 times|eight times'], why: 'Everything else in the note depends on it, so it cannot be a caveat at the end.' },
        { key: 'demand', label: 'The demand shape, with the two extremes named', markers: ['finance|product|136|34|4\\.2|27\\.8|small|large|shape'], why: 'One function asks constantly in small pieces and another rarely in large ones. That is the useful sentence about what the team does.' },
        { key: 'cancelled', label: 'The cancelled-effort finding and what to do about it', markers: ['cancel|15|485|46|intake|confirm|withdraw|before'], why: 'The one place this week where a small process change recovers real capacity.' },
        { key: 'establishment', label: 'An honest answer on whether fourteen is right', markers: ['cannot|backlog|queue|evidence|not able|would need|utilisation|capacity'], why: 'Say what the data can and cannot establish, and give him the backlog as the best available evidence.' },
        { key: 'norate', label: 'That you are not supplying a cost per analysis, and why', markers: ['not|won.t|will not|no rate|cost per|9,?664|misleading|decline'], why: 'He asked for it directly. Leaving it out without saying so reads as an oversight and he will ask again.' },
        { key: 'fix', label: 'What you are changing so next year is answerable', markers: ['next|change|instrument|going forward|will|improve|record|fix'], why: 'A manager reporting a measurement failure without owning the fix has described their own gap.' },
      ],
      skills: { communication: 100, businessLogic: 100 },
    },
    estHours: 0.8, priority: 'high', dueInDays: 5, day: 5, difficulty: 'hard',
  },

  'ma-143': {
    title: 'Sign off the budget slide',
    hint: "Four sentences, and three of them claim something the week established was unavailable.",
    brief: "Finance have drafted the analytics slide for the budget pack. Tick every problem.",
    tool: 'choice', datasetKey: 'analytics_ops',
    choice: {
      exhibit: {
        kind: 'email', from: 'Diya Chandra', subject: 'Analytics slide for the budget pack',
        body: "\"Analytics delivered 263 pieces of work at an average cost of ₹9,664 per hour. Utilisation across the team is low at 13%, suggesting spare capacity. Headcount of 14 is above requirement. Recommend holding establishment flat and reviewing individual performance.\"",
      },
      prompt: 'What has to change?',
      options: [
        { key: 'rate', correct: true, label: 'The ₹9,664 rate is the naive figure and will be read as a real cost', why: 'It divides the full cost by an eighth of the hours. Quoted in a budget pack it makes the team look eight times more expensive than it is.' },
        { key: 'util', correct: true, label: '"Utilisation is low at 13%" restates a measurement failure as a finding about the team', why: 'The single most damaging sentence available. 13% is what the timesheet records, not what people did, and it is about to become evidence of idleness.' },
        { key: 'spare', correct: true, label: '"Suggesting spare capacity" and "headcount above requirement" follow from that error', why: 'Two conclusions stacked on a number that measures admin. They would survive into a headcount decision long after anybody remembered where they came from.' },
        { key: 'perf', correct: true, label: '"Reviewing individual performance" is the one recommendation you explicitly refused to support', why: 'It has arrived in the pack anyway, which is exactly what happened to the stock-cover claim in the range review. Refusals have to be written into the document.' },
        { key: 'count', correct: false, label: 'The 263 delivered figure is wrong', why: 'It is right. As in every pack this year, the arithmetic survives and the sentences do not.' },
        { key: 'flat', correct: false, label: 'Holding establishment flat is the wrong recommendation', why: 'It may well be the right call. The problem is the reasoning underneath it, not the conclusion.' },
      ],
      skills: { communication: 100, businessLogic: 100 },
    },
    estHours: 0.5, priority: 'urgent', dueInDays: 5, day: 5, difficulty: 'hard',
  },

  'ma-144': {
    title: 'Rewrite the slide',
    hint: "Same numbers where they are sound, none of the four claims, and the cancelled-work finding in place of the utilisation one.",
    brief: "Send Diya replacement wording. It has to survive a budget round with you not in the room. Under 130 words.",
    tool: 'writeup', datasetKey: 'analytics_ops',
    writeup: {
      to: 'Diya Chandra', subject: 'Analytics slide — suggested wording', maxWords: 130,
      prompt: 'Delivered work, the demand shape, the cancelled-effort finding, and a plain statement that no cost rate is available.',
      rubric: [
        { key: 'norate', label: 'That no defensible cost per hour exists', markers: ['no|not|cannot|unavailable|rate|cost per|timesheet|coverage'], why: 'Say it as a fact about the instrumentation, not as a hedge about the number.' },
        { key: 'notutil', label: 'No utilisation claim', markers: ['13|utilis|not a measure|coverage|record|logged|admin|spare'], why: 'Either remove it or state what 13% actually measures. Leaving it uncorrected is how it becomes evidence.' },
        { key: 'delivered', label: 'What was delivered, and to whom', markers: ['263|deliver|finance|product|request|function'], why: 'The solid ground: counts of work and who asked for it survive the coverage problem entirely.' },
        { key: 'cancelled', label: 'The cancelled-effort finding as the capacity story', markers: ['cancel|15|485|intake|withdraw|recover|without hiring'], why: 'It replaces a false capacity claim with a true one, which is why the slide does not end up shorter.' },
        { key: 'noperf', label: 'No individual performance recommendation', markers: ['individual|performance|remove|not|my|manager|accountab'], why: 'Refused twice this week and still in the draft. It has to come out in writing.' },
      ],
      skills: { communication: 100, businessLogic: 100 },
    },
    estHours: 0.55, priority: 'urgent', dueInDays: 5, day: 5, difficulty: 'hard',
  },

  'ma-145': {
    title: 'What you would instrument',
    hint: "Every question you could not answer this week was a measurement that does not exist. Pick the ones worth building.",
    brief: "You are the manager and the measurement gap is yours. Say what changes before the next budget round, and what each thing would let you answer. Under 220 words.",
    tool: 'writeup', datasetKey: 'analytics_ops',
    writeup: {
      to: 'Asha Rao', subject: 'What I am changing about how we measure ourselves', maxWords: 220,
      prompt: 'The instrumentation changes, each tied to a question you could not answer this week.',
      rubric: [
        { key: 'time', label: 'Something about time recording that is proportionate', markers: ['time|log|record|day|week|allocat|sample|simpler|percentage|rather than'], why: 'Demanding complete timesheets will not work — nobody exceeds half today. A coarser instrument that people actually use beats a precise one they do not.' },
        { key: 'intake', label: 'A change at intake, to catch work that would be cancelled', markers: ['intake|confirm|clarify|before|accept|triage|question|sponsor'], why: 'The one finding with a fix cheaper than the problem.' },
        { key: 'outcome', label: 'Something about whether delivered work was used', markers: ['used|outcome|value|follow.?up|after|impact|decision|was it'], why: 'The question nobody in the company can currently answer, and the one that would change what the team prioritises.' },
        { key: 'capacity', label: 'Capacity measured from presence, as a standing figure', markers: ['presence|days|person.year|capacity|not headcount|joiner|leaver'], why: 'Headcount overstated capacity by about a person-year this year and will again.' },
        { key: 'own', label: 'Written as decisions, not proposals', markers: ['I will|I am|we will|from|changing|introduce|put in place|next'], why: 'A manager describing a measurement gap without owning the fix has described their own failure twice.' },
      ],
      skills: { communication: 100, businessLogic: 100 },
    },
    estHours: 0.7, priority: 'high', dueInDays: 5, day: 5, difficulty: 'hard',
  },

  // ---- Manager 2 · Tooling & Licence Renewal (analytics_ops) ----------------------
  // Second project at Manager. The team is still the subject but the cost line is the
  // tooling rather than the people, which makes it the easier conversation and the more
  // dangerous analysis: nobody defends a seat, so a bad cut here goes through unopposed.
  // Monday the estate and cost per seat. Tuesday seats, assignments and use turn out to
  // be three numbers. Wednesday the wobble — the per-seat ranking pointed at the best-used
  // tool in the estate, and the obvious cut removes a capability. Thursday the recovery
  // in three buckets, and the gap between recoverable and recommendable. Friday the
  // renewal, a vendor who would rather you did not, and the process that stops the drift.

  'mb-101': {
    title: 'The renewal that starts the clock',
    hint: "Read what is being decided and when. One of the three dates in here is the one that matters.",
    brief: "Finance has sent a renewal notice. Work out what is actually being asked of you before you open the data.",
    tool: 'choice', datasetKey: 'analytics_ops',
    choice: {
      exhibit: {
        kind: 'email', from: 'Diya Chandra', subject: 'Analytics tooling — renewals coming up',
        body: "The Clearview BI platform auto-renews on 15 August at ₹21.6 lakh and I need your seat count by Friday or it renews as it stands.\n\nWhile you are in there: the whole analytics tooling line is ₹61.14 lakh and the budget round will ask about it. Anything you can hand back before the round would be useful.\n\nI have pulled cost per seat for each tool if that helps — Northlake looks like the expensive one.",
      },
      prompt: 'Tick everything that is true about what you have just been asked.',
      options: [
        { key: 'deadline', correct: true, label: 'The decision is the BI seat count, and it is due Friday whether or not you are ready', why: 'An auto-renewal is a decision that gets made by default. Friday is not a reporting deadline, it is the last day the default can be changed.' },
        { key: 'wider', correct: true, label: 'The wider question is which tools are worth what they cost, and that has no deadline at all', why: 'Two questions on two clocks. Answering only the urgent one leaves ₹61.14 lakh unexamined until the round asks.' },
        { key: 'perseat', correct: true, label: 'Her cost-per-seat ranking is a claim about the contracts, not about use', why: 'It divides price by seats bought. Nobody has yet asked how many of those seats have a person behind them, which is where the answer is.' },
        { key: 'cheap', correct: false, label: 'Tooling is 16.5% of the analytics cost line, so it is the smaller problem and can wait', why: 'It is the smaller line and the one where money can be handed back this month without anybody losing their job. Small and actionable beats large and immovable.' },
        { key: 'vendor', correct: false, label: 'Northlake is the tool to renegotiate, since cost per seat is highest there', why: 'That is the conclusion her ranking invites and it will not survive Tuesday. Take the ranking as a starting point rather than a finding.' },
        { key: 'defer', correct: false, label: 'Ask her to delay the BI renewal until the full review is done', why: 'An auto-renewal date is a contract term, not a preference. Asking for it to move is how the whole year gets renewed at thirty seats.' },
      ],
      skills: { businessLogic: 100, communication: 100 },
    },
    estHours: 0.4, priority: 'urgent', dueInDays: 1, day: 1, difficulty: 'medium',
  },

  'mb-102': {
    title: 'What we actually buy',
    hint: "Six contracts. Order them by how soon each one can still be changed.",
    brief: "Start with the estate. Write ONE SQL SELECT over licences returning: tool, vendor, seats, annual cost, renewal date, and the number of days from 30 June 2026 to that renewal. Soonest renewal first.",
    referenceSql: "SELECT tool, vendor, seats, annual_cost, renews_on, CAST(julianday(renews_on) - julianday('2026-06-30') AS INTEGER) AS days_to_renewal FROM licences ORDER BY renews_on",
    datasetKey: 'analytics_ops', tool: 'sql', estHours: 0.4, priority: 'urgent', dueInDays: 1, day: 1, difficulty: 'easy',
  },

  'mb-103': {
    title: "Diya's ranking, reproduced",
    hint: "Reproduce it exactly as she would have. You are not agreeing with it, you are establishing what it says.",
    brief: "Before you argue with a figure, be able to produce it. Write ONE SQL SELECT over licences returning tool, seats, annual cost and annual cost per seat rounded to the nearest rupee, most expensive per seat first.",
    referenceSql: "SELECT tool, seats, annual_cost, ROUND(annual_cost * 1.0 / seats) AS cost_per_seat FROM licences ORDER BY cost_per_seat DESC",
    datasetKey: 'analytics_ops', tool: 'sql', estHours: 0.35, priority: 'high', dueInDays: 2, day: 1, difficulty: 'easy',
  },

  'mb-104': {
    title: 'What cost per seat can and cannot say',
    hint: "Everything in that ranking comes from the contract. Ask what is missing.",
    brief: "You have Warehouse compute at ₹1,03,571 a seat and Scheduling at ₹33,000. Decide what that comparison is worth.",
    tool: 'choice', datasetKey: 'analytics_ops',
    choice: {
      prompt: 'Tick everything that is true of a cost-per-seat ranking.',
      options: [
        { key: 'contract', correct: true, label: 'Both numbers in it come from the contract, so it says nothing about use', why: 'Price and seats are what the vendor sold us. Whether anybody opens the tool is a different table entirely.' },
        { key: 'buying', correct: true, label: 'A tool bought with generous headroom looks cheap per seat precisely because the extra seats are empty', why: 'Buying thirty seats for a team of fourteen halves the cost per seat and doubles the waste. The measure rewards the mistake.' },
        { key: 'capability', correct: true, label: 'It treats six tools doing six different jobs as though they were interchangeable', why: 'A warehouse and a scheduler are not substitutes. A per-unit comparison across them is arithmetic without a question behind it.' },
        { key: 'start', correct: true, label: 'It is still a reasonable place to start, because it puts every contract on one page', why: 'Establishing what is bought is a real step. The error is stopping there and calling the top of the list the problem.' },
        { key: 'expensive', correct: false, label: 'It correctly identifies the tool where the company is getting least for its money', why: 'It identifies the tool with the highest sticker price per seat. Those are different claims and Tuesday will separate them.' },
        { key: 'negotiate', correct: false, label: 'It is the right basis for deciding which vendor to renegotiate with', why: 'Renegotiating on price per seat with a vendor whose seats are all in use is a conversation you will lose, and should.' },
      ],
      skills: { businessLogic: 100, statistics: 100 },
    },
    estHours: 0.45, priority: 'high', dueInDays: 2, day: 1, difficulty: 'medium',
  },

  'mb-105': {
    title: 'Seats bought against seats given out',
    hint: "A seat with nobody assigned to it has never been used by anyone and never will be.",
    brief: "The first real question. Write ONE SQL SELECT returning, per tool: seats contracted, seats with somebody assigned to them, seats with nobody assigned, and what those unassigned seats cost a year. Most wasted first.",
    referenceSql: "SELECT l.tool, l.seats, COUNT(la.id) AS assigned, l.seats - COUNT(la.id) AS unassigned_seats, ROUND((l.seats - COUNT(la.id)) * l.annual_cost * 1.0 / l.seats) AS unassigned_cost FROM licences l LEFT JOIN licence_assignments la ON la.licence_id = l.id GROUP BY l.id ORDER BY unassigned_cost DESC",
    datasetKey: 'analytics_ops', tool: 'sql', estHours: 0.7, priority: 'urgent', dueInDays: 2, day: 1, difficulty: 'medium',
  },

  'mb-106': {
    title: 'Hold the renewal',
    hint: "She needs to know the Friday date is now a real decision rather than a formality. Do not send her a finding you cannot yet defend.",
    brief: "Write to Diya on day one. Sixteen of the thirty BI seats have never been assigned to anybody, which is ₹11.52 lakh, and you have not yet looked at whether the other fourteen are used. Under 150 words.",
    tool: 'writeup', datasetKey: 'analytics_ops',
    writeup: {
      to: 'Diya Chandra', subject: 'BI renewal — do not let it auto-renew at thirty', maxWords: 150,
      prompt: 'What you have found so far, and what you will have by Friday.',
      rubric: [
        { key: 'finding', label: 'The sixteen unassigned BI seats and what they cost', markers: ['16|sixteen|unassigned|never|no one|nobody|11\\.5|1,?152|lakh'], why: 'One concrete number on day one is what keeps a renewal open. Method can wait.' },
        { key: 'partial', label: 'That this is seats assigned, not seats used, and use is still to come', markers: ['assign|not used|use|yet|still|Tuesday|further|open|whether'], why: 'The gap between assigned and used is the rest of the week. Implying you already know it is how a number gets quoted early.' },
        { key: 'date', label: 'A commitment to a seat count before Friday', markers: ['friday|by then|before|will have|number|count|thursday|end of the week'], why: 'She asked for a date-bound answer. Anything that does not name the date reads as a request for more time.' },
        { key: 'noblame', label: 'No suggestion that anybody bought badly', markers: ['headroom|growth|planned|at the time|reasonable|understand|not|no blame|sensible'], why: 'Thirty seats for fourteen people was somebody\'s judgement about growth. Leading with that being wrong makes the next renewal harder, not easier.' },
      ],
      skills: { communication: 100, businessLogic: 100 },
    },
    estHours: 0.5, priority: 'urgent', dueInDays: 1, day: 1, difficulty: 'medium',
  },

  'mb-110': {
    title: 'Three numbers that are not the same number',
    hint: "Contracted, assigned, and assigned to somebody who is still here and has opened it recently. Count all three.",
    brief: "Write ONE SQL SELECT returning, per tool: seats contracted, assignments made, assignments held by people who still work here, and assignments held by current staff used since 1 April 2026. Most expensive tool first.",
    referenceSql: "SELECT l.tool, l.seats, COUNT(la.id) AS assigned, SUM(CASE WHEN a.left_on IS NULL THEN 1 ELSE 0 END) AS held_by_current, SUM(CASE WHEN a.left_on IS NULL AND la.last_used_on >= '2026-04-01' THEN 1 ELSE 0 END) AS active_last_quarter FROM licences l LEFT JOIN licence_assignments la ON la.licence_id = l.id LEFT JOIN analysts a ON a.id = la.analyst_id GROUP BY l.id ORDER BY l.annual_cost DESC",
    datasetKey: 'analytics_ops', tool: 'sql', estHours: 1.0, priority: 'urgent', dueInDays: 3, day: 2, difficulty: 'hard',
  },

  'mb-111': {
    title: 'Where the three numbers separate',
    hint: "Look for the tool where assigned and active are furthest apart, and the tool where contracted and assigned are.",
    brief: "You have three counts per tool and they disagree in two different ways. Work out what each disagreement means.",
    tool: 'choice', datasetKey: 'analytics_ops',
    choice: {
      prompt: 'Tick everything that follows from the three counts.',
      options: [
        { key: 'bi', correct: true, label: 'BI has sixteen seats no one has ever held — a buying decision, recoverable at renewal with nobody affected', why: 'Nothing has to change for anybody. The seats are handed back and thirteen people carry on exactly as they were.' },
        { key: 'stat', correct: true, label: 'The Statistical suite has ten assignments and five recent users — a use problem, and cutting it takes something away from somebody', why: 'Every one of those ten seats belongs to a person who might open it next week. That is a different decision from handing back air.' },
        { key: 'kinds', correct: true, label: 'The two gaps need different remedies and should not be added into one waste figure without saying so', why: 'One is recoverable with no consequence and one has a consequence. A single total hides exactly the part a reader needs.' },
        { key: 'leaver', correct: true, label: 'Assigned and held-by-current differ, which means at least one seat belongs to somebody who has left', why: 'Four of them, and nobody noticed for five months. Reclaiming a leaver\'s seats is a process that does not exist here.' },
        { key: 'same', correct: false, label: 'Unassigned seats and unused assignments are both waste and should be reported as one number', why: 'It gives the larger headline and it is the reason cuts get made in the wrong place. A reader who cannot see the split cannot judge the risk.' },
        { key: 'stat2', correct: false, label: 'The Statistical suite has the clearest case for a cut, since half its seats are idle', why: 'It is the most visible gap and the most consequential cut. Wednesday is about why the visible one is the wrong one to start with.' },
      ],
      skills: { businessLogic: 100, statistics: 100 },
    },
    estHours: 0.5, priority: 'urgent', dueInDays: 3, day: 2, difficulty: 'hard',
  },

  'mb-112': {
    title: 'The rate that means something',
    hint: "Same numerator, a denominator with people in it. Put both rates side by side so the reordering is visible.",
    brief: "Write ONE SQL SELECT returning, per tool: annual cost, cost per seat, active users (current staff who used it since 1 April 2026), and cost per active user. Most expensive per active user first, both rates rounded to the rupee.",
    referenceSql: "SELECT l.tool, l.annual_cost, ROUND(l.annual_cost * 1.0 / l.seats) AS cost_per_seat, SUM(CASE WHEN a.left_on IS NULL AND la.last_used_on >= '2026-04-01' THEN 1 ELSE 0 END) AS active_users, ROUND(l.annual_cost * 1.0 / NULLIF(SUM(CASE WHEN a.left_on IS NULL AND la.last_used_on >= '2026-04-01' THEN 1 ELSE 0 END), 0)) AS cost_per_active_user FROM licences l LEFT JOIN licence_assignments la ON la.licence_id = l.id LEFT JOIN analysts a ON a.id = la.analyst_id GROUP BY l.id ORDER BY cost_per_active_user DESC",
    datasetKey: 'analytics_ops', tool: 'sql', estHours: 1.1, priority: 'urgent', dueInDays: 3, day: 2, difficulty: 'hard',
  },

  'mb-113': {
    title: 'The ranking turns over',
    hint: "Compare where each tool sits in the two orderings. One of them moves a long way.",
    brief: "Cost per seat put Warehouse compute at the top. Cost per active user puts it third. Decide what that tells you.",
    tool: 'choice', datasetKey: 'analytics_ops',
    choice: {
      prompt: 'Tick everything that follows from the two rankings disagreeing.',
      options: [
        { key: 'warehouse', correct: true, label: 'Warehouse compute is the best-used tool in the estate — fourteen seats, thirteen active users', why: 'It topped the per-seat table because it is genuinely expensive per seat, and it is expensive per seat because almost nobody is wasting one.' },
        { key: 'bi', correct: true, label: 'BI looks second cheapest per seat and second most expensive per active user', why: 'The clearest illustration of the whole point. Buying sixteen spare seats made the per-seat figure look good and cost ₹11.52 lakh.' },
        { key: 'denominator', correct: true, label: 'The per-seat figure improves whenever we buy seats we do not need', why: 'A measure that rewards over-buying will, given a year, produce over-buying. That is not a comment about anybody; it is what measures do.' },
        { key: 'monday', correct: true, label: "Diya's Monday conclusion about Northlake points at the one contract you should not touch", why: 'And she will have said it to somebody by now. Correcting it is Wednesday morning\'s job, before it reaches the round.' },
        { key: 'both', correct: false, label: 'Both rankings are valid and the honest answer is to publish them side by side without choosing', why: 'They are not equally useful. Publishing both without saying which answers the renewal question is a way of not answering it.' },
        { key: 'stat', correct: false, label: 'The Statistical suite tops the per-active-user table, so it is the clearest cut', why: 'It tops it because five people have not opened it since February. Whether that is waste or a capability in reserve is not something the rate can tell you.' },
      ],
      skills: { statistics: 100, businessLogic: 100 },
    },
    estHours: 0.5, priority: 'urgent', dueInDays: 3, day: 2, difficulty: 'hard',
  },

  'mb-114': {
    title: 'How far each tool moves',
    hint: "Rank on both measures, then subtract. The movement is the finding, not either ranking on its own.",
    brief: "Quantify the reordering. Using the six tools, rank them 1 to 6 by cost per seat and again by cost per active user, and report each tool's two ranks and the change. Return a list of dicts with keys tool, rank_per_seat, rank_per_active and rank_change, ordered by the size of the change, largest first.",
    tool: 'python', datasetKey: 'analytics_ops',
    referenceCompute: "import json\nrows = query(\"SELECT l.tool, l.annual_cost, l.annual_cost * 1.0 / l.seats AS per_seat, SUM(CASE WHEN a.left_on IS NULL AND la.last_used_on >= '2026-04-01' THEN 1 ELSE 0 END) AS active FROM licences l LEFT JOIN licence_assignments la ON la.licence_id = l.id LEFT JOIN analysts a ON a.id = la.analyst_id GROUP BY l.id\")\nfor r in rows:\n    r['per_active'] = r['annual_cost'] / r['active']\nby_seat = sorted(rows, key=lambda r: -r['per_seat'])\nby_active = sorted(rows, key=lambda r: -r['per_active'])\nseat_rank = {r['tool']: i + 1 for i, r in enumerate(by_seat)}\nactive_rank = {r['tool']: i + 1 for i, r in enumerate(by_active)}\nout = [{'tool': t, 'rank_per_seat': seat_rank[t], 'rank_per_active': active_rank[t], 'rank_change': seat_rank[t] - active_rank[t]} for t in seat_rank]\nout.sort(key=lambda r: -abs(r['rank_change']))\nresult = out",
    estHours: 0.8, priority: 'high', dueInDays: 3, day: 2, difficulty: 'hard',
  },

  'mb-115': {
    title: 'Tell the team their seats are being counted',
    hint: "Thirteen people are about to have their tool use looked at. Same rule as the timesheets: they hear it from you first.",
    brief: "Write to the team. You are reviewing licence use ahead of renewals and some seats will be handed back. Under 150 words.",
    tool: 'writeup', datasetKey: 'analytics_ops',
    writeup: {
      to: 'Analytics team', subject: 'Tool seats — what I am looking at and why', maxWords: 150,
      prompt: 'What you are doing, what it is not, and what to do if a seat they need is at risk.',
      rubric: [
        { key: 'what', label: 'What you are actually reviewing — seats and contracts, ahead of renewals', markers: ['seat|licence|license|renew|contract|tool|august|review'], why: 'Naming the thing plainly stops it being guessed at. People assume the worst about any exercise with the word review in it.' },
        { key: 'notperf', label: 'That this is not about individual performance', markers: ['not|performance|assess|judg|about you|individual|nobody|no one'], why: 'Tool telemetry is the second dataset this month that could be read as watching people. Say it is not before somebody asks.' },
        { key: 'ask', label: 'An invitation to say if a seat they need looks unused', markers: ['tell me|let me know|speak|shout|if you|need it|use it|flag|come to me'], why: 'The data cannot distinguish a tool nobody needs from one used twice a year for something important. The people can.' },
        { key: 'nothing', label: 'Reassurance that nothing has been taken away yet', markers: ['nothing|yet|not taken|before|first|no change|will not|until'], why: 'Otherwise the first reaction is to log in to everything on Monday, which destroys exactly the data you are reading.' },
      ],
      skills: { communication: 100, businessLogic: 100 },
    },
    estHours: 0.5, priority: 'high', dueInDays: 3, day: 2, difficulty: 'medium',
  },

  'mb-120': {
    title: 'The seats nobody handed back',
    hint: "Somebody left in January. Find out what they still have.",
    brief: "Write ONE SQL SELECT returning every licence assignment held by somebody who has left: their name, leaving date, the tool, the date they last used it, and what that seat costs a year. Most expensive seat first.",
    referenceSql: "SELECT a.name, a.left_on, l.tool, la.last_used_on, ROUND(l.annual_cost * 1.0 / l.seats) AS per_seat_cost FROM licence_assignments la JOIN analysts a ON a.id = la.analyst_id JOIN licences l ON l.id = la.licence_id WHERE a.left_on IS NOT NULL ORDER BY per_seat_cost DESC",
    datasetKey: 'analytics_ops', tool: 'sql', estHours: 0.6, priority: 'urgent', dueInDays: 4, day: 3, difficulty: 'medium',
  },

  'mb-121': {
    title: 'Monday pointed at the wrong vendor',
    hint: "Diya has already told somebody that Northlake is the expensive one. Work out what that costs if it is not corrected today.",
    brief: "Cost per active user puts Warehouse compute third, not first, and it is the most fully used tool we have. Decide what to do about Monday.",
    tool: 'choice', datasetKey: 'analytics_ops',
    choice: {
      prompt: 'Tick everything that belongs in how you handle this.',
      options: [
        { key: 'correct', correct: true, label: 'Correct it with Diya today, before the renewal conversation with Northlake happens', why: 'Northlake renews on 30 September. A renegotiation opened on the wrong premise is worse than none — it tells the vendor we have not done the work.' },
        { key: 'own', correct: true, label: 'Own it as a shared starting point rather than as her error', why: 'Cost per seat was a reasonable first cut and you reproduced it yourself on Monday. Framing it as her mistake buys nothing and costs a working relationship.' },
        { key: 'concrete', correct: true, label: 'Give her the one sentence that replaces it: fourteen seats, thirteen active users, the best-used tool we have', why: 'A correction without a replacement leaves a hole, and the old number fills holes. Hand her the sentence she can repeat.' },
        { key: 'where', correct: true, label: 'Point at where the money actually is — sixteen unassigned BI seats at ₹11.52 lakh', why: 'It makes the correction useful rather than merely deflating. She came to you for somewhere to cut and there is somewhere to cut.' },
        { key: 'quiet', correct: false, label: 'Leave it, since the BI renewal is the urgent one and Northlake is three months away', why: 'Three months is how long a wrong figure has to become the thing everybody knows. Corrections get cheaper the earlier they are made, never later.' },
        { key: 'blame', correct: false, label: 'Explain that cost per seat was never a sound basis for the comparison', why: 'True, unhelpful, and it invites her to defend it. What she needs is the replacement figure, not a lesson on the old one.' },
      ],
      skills: { communication: 100, businessLogic: 100 },
    },
    estHours: 0.5, priority: 'urgent', dueInDays: 4, day: 3, difficulty: 'hard',
  },

  'mb-122': {
    title: 'Seats held by people who are still here and not using them',
    hint: "Current staff only. The leaver is a different bucket with a different remedy.",
    brief: "Write ONE SQL SELECT returning every assignment held by somebody still employed who has not used it since 1 April 2026: tool, name, level, last used date, days since use as at 30 June 2026, and the annual cost of that seat. Longest idle first.",
    referenceSql: "SELECT l.tool, a.name, a.level, la.last_used_on, CAST(julianday('2026-06-30') - julianday(la.last_used_on) AS INTEGER) AS days_since_use, ROUND(l.annual_cost * 1.0 / l.seats) AS per_seat_cost FROM licence_assignments la JOIN analysts a ON a.id = la.analyst_id JOIN licences l ON l.id = la.licence_id WHERE a.left_on IS NULL AND la.last_used_on < '2026-04-01' ORDER BY days_since_use DESC",
    datasetKey: 'analytics_ops', tool: 'sql', estHours: 0.9, priority: 'urgent', dueInDays: 4, day: 3, difficulty: 'hard',
  },

  'mb-123': {
    title: 'The obvious cut',
    hint: "Every one of those five rows is a named person and one tool. Ask what the tool does before you ask how often it is opened.",
    brief: "Five idle seats, all on the Statistical suite, worth ₹4.6 lakh a year. Decide whether that is the cut to recommend.",
    tool: 'choice', datasetKey: 'analytics_ops',
    choice: {
      prompt: 'Tick everything that should shape the decision.',
      options: [
        { key: 'capability', correct: true, label: 'It is the only tool in the estate that does what it does, so a cut is a capability decision rather than a cost one', why: 'Handing back an unused BI seat changes nothing. Handing back a statistical seat means the next request needing it gets refused or done badly.' },
        { key: 'frequency', correct: true, label: 'Low frequency is not low value — some analysis is done twice a year and matters both times', why: 'The usage data records opens. It has no opinion at all about what was produced, and the two are not the same shape.' },
        { key: 'ask', correct: true, label: 'The five people should be asked before a seat is removed, and they are the only source for the answer', why: 'Five conversations against ₹4.6 lakh is a good trade. The data genuinely cannot distinguish disuse from infrequent necessity.' },
        { key: 'stagger', correct: true, label: 'It renews on 5 October, so there is time to ask — unlike BI', why: 'Ninety-seven days. The reason to decide BI this week and this one next month is the calendar, not the size.' },
        { key: 'cut', correct: false, label: 'Cut all five: five months without opening a tool is evidence enough', why: 'It is the largest single-tool saving on the page and the one most likely to come back as a refused request in November.' },
        { key: 'keep', correct: false, label: 'Leave it entirely — usage data is too weak to support any change here', why: 'Too weak to decide alone is not the same as useless. It tells you exactly which five conversations to have.' },
      ],
      skills: { businessLogic: 100, communication: 100 },
    },
    estHours: 0.5, priority: 'high', dueInDays: 4, day: 3, difficulty: 'hard',
  },

  'mb-124': {
    title: 'Three buckets, three remedies',
    hint: "Never assigned, held by a leaver, held by somebody here who is not using it. Count seats and rupees for each.",
    brief: "Split the recoverable seats by the kind of thing they are. Write ONE SQL SELECT returning three rows with columns bucket, seats and annual_cost: seats never assigned to anybody; seats held by somebody who has left; seats held by current staff unused since 1 April 2026.",
    referenceSql: "SELECT 'seats never assigned' AS bucket, SUM(l.seats - x.assigned) AS seats, ROUND(SUM((l.seats - x.assigned) * l.annual_cost * 1.0 / l.seats)) AS annual_cost FROM licences l JOIN (SELECT licence_id, COUNT(*) AS assigned FROM licence_assignments GROUP BY licence_id) x ON x.licence_id = l.id UNION ALL SELECT 'seats held by a leaver', COUNT(*), ROUND(SUM(l.annual_cost * 1.0 / l.seats)) FROM licence_assignments la JOIN analysts a ON a.id = la.analyst_id JOIN licences l ON l.id = la.licence_id WHERE a.left_on IS NOT NULL UNION ALL SELECT 'held by current staff, unused since 1 April', COUNT(*), ROUND(SUM(l.annual_cost * 1.0 / l.seats)) FROM licence_assignments la JOIN analysts a ON a.id = la.analyst_id JOIN licences l ON l.id = la.licence_id WHERE a.left_on IS NULL AND la.last_used_on < '2026-04-01'",
    datasetKey: 'analytics_ops', tool: 'sql', estHours: 1.1, priority: 'urgent', dueInDays: 4, day: 3, difficulty: 'hard',
  },

  'mb-125': {
    title: 'Correct Monday, in writing',
    hint: "Short. The replacement sentence matters more than the explanation of what was wrong.",
    brief: "Write to Diya. Her cost-per-seat ranking pointed at Northlake, which turns out to be the best-used tool we have. Under 140 words.",
    tool: 'writeup', datasetKey: 'analytics_ops',
    writeup: {
      to: 'Diya Chandra', subject: 'Northlake is the wrong target — here is the right one', maxWords: 140,
      prompt: 'The correction, the replacement, and where the money actually is.',
      rubric: [
        { key: 'correct', label: 'That Northlake is fully used — fourteen seats, thirteen active users', markers: ['14|fourteen|13|thirteen|active|fully|used|all|best'], why: 'The specific counts are what make the correction stick. "It is fine actually" will not survive a second reading of her own table.' },
        { key: 'why', label: 'Why cost per seat misled — it rewards buying seats nobody uses', markers: ['per seat|denominator|seats bought|headroom|spare|reward|empty|unassigned|contract'], why: 'Without the mechanism she has no way to avoid repeating it on the next cost line she looks at.' },
        { key: 'where', label: 'Where the money is instead — the unassigned BI seats', markers: ['BI|Clearview|16|sixteen|11\\.5|1,?152|unassigned|never'], why: 'A correction that only removes a target leaves her worse off than before she asked.' },
        { key: 'shared', label: 'Framed as a shared first cut rather than her error', markers: ['we|I also|first cut|start|reasonable|same|my own|monday|both'], why: 'You produced the same ranking on Monday. Writing it as her mistake is both unkind and inaccurate.' },
      ],
      skills: { communication: 100, businessLogic: 100 },
    },
    estHours: 0.5, priority: 'urgent', dueInDays: 4, day: 3, difficulty: 'hard',
  },

  'mb-130': {
    title: 'Every tool, one table',
    hint: "Recoverable means seats beyond what current active users need. One query, so no two figures in the pack can disagree.",
    brief: "Assemble the review. Write ONE SQL SELECT returning, per tool: seats, annual cost, renewal date, assignments, active users (current staff, used since 1 April 2026), seats above that active count, and what those seats cost a year. Most recoverable first.",
    referenceSql: "SELECT l.tool, l.seats, l.annual_cost, l.renews_on, COUNT(la.id) AS assigned, SUM(CASE WHEN a.left_on IS NULL AND la.last_used_on >= '2026-04-01' THEN 1 ELSE 0 END) AS active_users, l.seats - SUM(CASE WHEN a.left_on IS NULL AND la.last_used_on >= '2026-04-01' THEN 1 ELSE 0 END) AS recoverable_seats, ROUND((l.seats - SUM(CASE WHEN a.left_on IS NULL AND la.last_used_on >= '2026-04-01' THEN 1 ELSE 0 END)) * l.annual_cost * 1.0 / l.seats) AS recoverable_cost FROM licences l LEFT JOIN licence_assignments la ON la.licence_id = l.id LEFT JOIN analysts a ON a.id = la.analyst_id GROUP BY l.id ORDER BY recoverable_cost DESC",
    datasetKey: 'analytics_ops', tool: 'sql', estHours: 1.2, priority: 'urgent', dueInDays: 5, day: 4, difficulty: 'hard',
  },

  'mb-131': {
    title: 'The recovery chart',
    hint: "Six named tools, one measure, sorted. The reader should see where the money is in one glance.",
    brief: "Build the visual for the budget note: recoverable annual cost by tool. Pick the chart type, the fields and the sort.",
    tool: 'chart', datasetKey: 'analytics_ops',
    chart: {
      sourceSql: "SELECT l.tool AS tool, (l.seats - SUM(CASE WHEN a.left_on IS NULL AND la.last_used_on >= '2026-04-01' THEN 1 ELSE 0 END)) * l.annual_cost * 1.0 / l.seats AS recoverable_cost FROM licences l LEFT JOIN licence_assignments la ON la.licence_id = l.id LEFT JOIN analysts a ON a.id = la.analyst_id GROUP BY l.id ORDER BY recoverable_cost DESC",
      prompt: 'Recoverable annual cost by tool.',
      answer: { type: 'bar', x: 'tool', y: 'recoverable_cost', sort: 'desc', baselineZero: true },
      why: 'Six named tools compared on one measure is a bar chart, sorted so the reader sees that BI is most of the answer before reading a single label. A zero baseline because the tools with nothing recoverable must read as nothing rather than as a short bar.',
    },
    estHours: 0.35, priority: 'high', dueInDays: 5, day: 4, difficulty: 'medium',
  },

  'mb-132': {
    title: 'Recoverable is not the same as recommendable',
    hint: "Some of that ₹20.43 lakh needs a conversation first, and some of it needs headroom kept back.",
    brief: "The table says ₹20.43 lakh is recoverable. Decide what you are actually willing to put in front of Finance.",
    tool: 'choice', datasetKey: 'analytics_ops',
    choice: {
      prompt: 'Tick everything that should reduce the headline before it is published.',
      options: [
        { key: 'headroom', correct: true, label: 'Some spare seats have to be kept — a joiner in March needed one and there was no delay because the seats were there', why: 'Cutting to exactly the active count buys a procurement conversation every time somebody joins. Two seats of headroom per tool is cheaper than that.' },
        { key: 'stat', correct: true, label: 'The Statistical suite seats need five conversations before they can be counted as savings', why: 'Recoverable on the table, undecided in reality. Putting it in the headline commits you to a cut you have not yet agreed with the people affected.' },
        { key: 'timing', correct: true, label: 'Only the tools renewing this financial year can deliver a saving this financial year', why: 'Scheduling renews in January 2027. Reporting its ₹99,000 as an in-year saving is a timing error that Finance will find.' },
        { key: 'split', correct: true, label: 'The honest headline is smaller than ₹20.43 lakh and should be shown against it, not instead of it', why: 'Show the theoretical maximum and what you are recommending. The gap between them IS the analysis, and hiding it invites somebody else to find the bigger number.' },
        { key: 'max', correct: false, label: 'Publish ₹20.43 lakh, since it is what the data supports and the caveats are in the appendix', why: 'The headline will be quoted and the appendix will not. A number you cannot deliver becomes a shortfall you have to explain in six months.' },
        { key: 'nothing', correct: false, label: 'Publish nothing until every conversation has happened, since a partial figure will be misused', why: 'BI renews in forty-six days. Waiting for certainty means the ₹11.52 lakh renews itself, which is the one outcome with no upside at all.' },
      ],
      skills: { businessLogic: 100, communication: 100 },
    },
    estHours: 0.55, priority: 'urgent', dueInDays: 5, day: 4, difficulty: 'hard',
  },

  'mb-133': {
    title: 'Reclaiming the leaver seats',
    hint: "Four seats, five months, nobody noticed. The note is about the process rather than the person.",
    brief: "Write to IT operations. Somebody who left on 30 January still holds four licence seats worth ₹2.76 lakh a year. Under 140 words.",
    tool: 'writeup', datasetKey: 'analytics_ops',
    writeup: {
      to: 'IT Operations', subject: 'Licence seats not reclaimed on leaving', maxWords: 140,
      prompt: 'The specific case, the general gap, and what you want to happen.',
      rubric: [
        { key: 'facts', label: 'The specific facts — four seats, left 30 January, ₹2.76 lakh a year', markers: ['4|four|seat|january|2\\.7|2\\.8|276|lakh|five months'], why: 'A process complaint with no instance behind it gets filed. One with a date and a number gets actioned.' },
        { key: 'process', label: 'That the gap is a missing offboarding step, not a mistake by any individual', markers: ['process|step|offboard|leaver|automatic|nobody|checklist|not|blame|system'], why: 'Nobody chose not to reclaim them. Naming it as a process gap is both true and the only framing that gets a process built.' },
        { key: 'ask', label: 'A specific ask — reclaim these four, and add the step', markers: ['reclaim|remove|revoke|add|step|checklist|going forward|future|both'], why: 'Two asks, one immediate and one structural. Sending only the first guarantees the next leaver repeats it.' },
        { key: 'scope', label: 'Acknowledgement that this is only what you can see in analytics tooling', markers: ['analytics|our|only|other team|elsewhere|wider|may|likely|suspect'], why: 'One leaver, four seats, one function. If the step is missing everywhere the number is much larger, and that is their finding to make, not yours to assert.' },
      ],
      skills: { communication: 100, businessLogic: 100 },
    },
    estHours: 0.55, priority: 'high', dueInDays: 5, day: 4, difficulty: 'medium',
  },

  'mb-134': {
    title: 'What to renew each contract at',
    hint: "Active users plus two seats of headroom, and never more seats than we already hold.",
    brief: "Produce the recommendation. Write ONE SQL SELECT returning, per tool: renewal date, seats now, active users, proposed seats (active users plus two, capped at the seats we already have), the cost at the proposed seat count, and the saving. Biggest saving first.",
    referenceSql: "SELECT l.tool, l.renews_on, l.seats AS seats_now, SUM(CASE WHEN a.left_on IS NULL AND la.last_used_on >= '2026-04-01' THEN 1 ELSE 0 END) AS active_users, MIN(l.seats, SUM(CASE WHEN a.left_on IS NULL AND la.last_used_on >= '2026-04-01' THEN 1 ELSE 0 END) + 2) AS seats_proposed, ROUND(l.annual_cost * 1.0 / l.seats * MIN(l.seats, SUM(CASE WHEN a.left_on IS NULL AND la.last_used_on >= '2026-04-01' THEN 1 ELSE 0 END) + 2)) AS cost_proposed, l.annual_cost - ROUND(l.annual_cost * 1.0 / l.seats * MIN(l.seats, SUM(CASE WHEN a.left_on IS NULL AND la.last_used_on >= '2026-04-01' THEN 1 ELSE 0 END) + 2)) AS saving FROM licences l LEFT JOIN licence_assignments la ON la.licence_id = l.id LEFT JOIN analysts a ON a.id = la.analyst_id GROUP BY l.id ORDER BY saving DESC",
    datasetKey: 'analytics_ops', tool: 'sql', estHours: 1.2, priority: 'urgent', dueInDays: 5, day: 4, difficulty: 'hard',
    // Deliberately flagged for rework: the recommendation is accepted and then asked for
    // with a different headroom rule, which is the same query and a different number in
    // front of Finance. Worth feeling how cheap that change is once it is one query.
    rework: true,
  },

  'mb-135': {
    title: 'Going into the renewal conversation',
    hint: "You are about to halve an order with a vendor whose account manager has your number.",
    brief: "Decide how to approach Clearview about renewing at fifteen seats rather than thirty.",
    tool: 'choice', datasetKey: 'analytics_ops',
    choice: {
      prompt: 'Tick everything that belongs in your approach.',
      options: [
        { key: 'evidence', correct: true, label: 'Go in with the assignment counts, because they are checkable and not a matter of opinion', why: 'Thirteen active users out of thirty seats is not an argument, it is an observation. Vendors argue with opinions and concede to counts.' },
        { key: 'renew', correct: true, label: 'Be clear that we are renewing, not leaving — the disagreement is about volume', why: 'A renewal at half the seats is still a sale. Letting it sound like a churn risk invites a retention offer instead of a price.' },
        { key: 'unitprice', correct: true, label: 'Expect the per-seat price to rise when the volume falls, and work out the total before agreeing', why: 'Fifteen seats at a higher unit price can cost more than thirty at the old one. The number that matters is the invoice.' },
        { key: 'timing', correct: true, label: 'Open it now rather than in the last week before 15 August', why: 'A negotiation with no time left in it is a request. Forty-six days is enough to walk away from a first offer.' },
        { key: 'threat', correct: false, label: 'Open by saying we are evaluating alternatives, to improve the position', why: 'We are not, and a bluff that is called costs the whole relationship for the next four renewals. The counts are a strong enough position.' },
        { key: 'quiet', correct: false, label: 'Renew at thirty this year and reduce next year once the usage data is longer', why: 'That is ₹11.52 lakh for another year of data confirming something already visible. The seats have never been assigned to anybody.' },
      ],
      skills: { communication: 100, businessLogic: 100 },
    },
    estHours: 0.5, priority: 'high', dueInDays: 5, day: 4, difficulty: 'hard',
  },

  'mb-140': {
    title: 'The renewal recommendation',
    hint: "Two numbers: what the table says is recoverable, and what you are recommending. The gap is the honest part.",
    brief: "Write to Diya with the answer she asked for on Monday. Fifteen BI seats, ₹13.89 lakh of recommended savings against ₹20.43 lakh theoretically recoverable. Under 200 words.",
    tool: 'writeup', datasetKey: 'analytics_ops',
    writeup: {
      to: 'Diya Chandra', subject: 'Tooling renewals — the seat counts and what they save', maxWords: 200,
      prompt: 'The BI answer she needs by Friday, the wider recommendation, and what you are not yet claiming.',
      rubric: [
        { key: 'bi', label: 'The BI seat count, which is the thing with a Friday deadline', markers: ['15|fifteen|BI|Clearview|seat|renew|10\\.8|1,?080'], why: 'She asked one question with a date on it. Everything else is context, and context that buries the answer is not context.' },
        { key: 'two', label: 'Both figures — recommended against theoretically recoverable', markers: ['13\\.8|13\\.9|1,?389|20\\.4|2,?043|recover|recommend|against|versus|of which'], why: 'One number invites the question "is that all there is". Two numbers answer it before it is asked.' },
        { key: 'gap', label: 'Why the recommendation is lower — headroom, conversations still to have, renewal timing', markers: ['headroom|two seats|conversation|ask|statistical|timing|next year|january|spare|joiner'], why: 'The gap is a judgement you made, so it needs your reasoning attached or somebody will close it for you.' },
        { key: 'northlake', label: 'That Northlake is fully used and should be renewed as it stands', markers: ['northlake|warehouse|fully|13|thirteen|as it stands|no change|renew'], why: 'It was the headline of her Monday email. Leaving it unmentioned means she still half-believes it.' },
        { key: 'nopeople', label: 'No implication that any of this bears on the people question', markers: ['tooling|seat|contract|separate|not|people|headcount|different'], why: 'Two cost lines, two arguments. A tooling saving offered as evidence in a headcount discussion loses both.' },
      ],
      skills: { communication: 100, businessLogic: 100 },
    },
    estHours: 0.75, priority: 'urgent', dueInDays: 5, day: 5, difficulty: 'hard',
  },

  'mb-141': {
    title: 'What Finance does with a saving',
    hint: "A saving offered into a budget round does not stay a saving. Decide what you want it to become.",
    brief: "You are about to hand back ₹13.89 lakh. Decide what to say about what happens to it.",
    tool: 'choice', datasetKey: 'analytics_ops',
    choice: {
      prompt: 'Tick everything that is true about handing back a saving in a budget round.',
      options: [
        { key: 'baseline', correct: true, label: 'It becomes next year\'s baseline, so the saving is made once and expected forever', why: 'Which is the correct outcome and worth going in knowing. A saving presented as a one-off will be treated as a recurring one anyway.' },
        { key: 'credit', correct: true, label: 'Handing it back voluntarily is worth more than having it found, in every round after this one', why: 'A function that finds its own waste is asked to find more. A function whose waste is found for it is cut.' },
        { key: 'specific', correct: true, label: 'Naming what it buys — the March joiner had a seat on day one because there was headroom — protects the headroom you kept', why: 'Unexplained spare seats look like the next saving. Explained ones look like a decision.' },
        { key: 'notrade', correct: false, label: 'It can be traded for headcount, since both are analytics cost', why: 'They are separate lines with separate owners and the trade is not in your gift. Offering it makes the tooling saving look like a negotiating position rather than a finding.' },
        { key: 'hold', correct: false, label: 'Hold it back until the headcount question is settled, so it is available as a concession', why: 'BI renews on 15 August. Holding it means paying it, and being seen to have held it costs the credit as well as the money.' },
        { key: 'quiet', correct: false, label: 'Reduce the seats without flagging it, so the budget stays where it is', why: 'The invoice arrives in Finance. Being discovered to have quietly kept an underspend is expensive in a way ₹13.89 lakh is not.' },
      ],
      skills: { businessLogic: 100, communication: 100 },
    },
    estHours: 0.5, priority: 'high', dueInDays: 5, day: 5, difficulty: 'hard',
  },

  'mb-142': {
    title: 'Tooling against the whole cost line',
    hint: "The people cost you computed last month, and the tooling cost from the contracts. One row.",
    brief: "Put the tooling bill in proportion for the budget note. Write ONE SQL SELECT returning one row: total annual tooling cost, total annual people cost from day rates and days present, and tooling as a percentage of the two combined to one place.",
    referenceSql: "SELECT (SELECT SUM(annual_cost) FROM licences) AS tooling_cost, ROUND((SELECT SUM(a.day_rate * CAST(julianday(MIN(COALESCE(a.left_on, '2026-06-30'), '2026-06-30')) - julianday(MAX(a.started_on, '2025-07-01')) + 1 AS INTEGER) * 5.0 / 7) FROM analysts a)) AS people_cost, ROUND((SELECT SUM(annual_cost) FROM licences) * 100.0 / ((SELECT SUM(annual_cost) FROM licences) + (SELECT SUM(a.day_rate * CAST(julianday(MIN(COALESCE(a.left_on, '2026-06-30'), '2026-06-30')) - julianday(MAX(a.started_on, '2025-07-01')) + 1 AS INTEGER) * 5.0 / 7) FROM analysts a)), 1) AS tooling_pct",
    datasetKey: 'analytics_ops', tool: 'sql', estHours: 0.7, priority: 'high', dueInDays: 5, day: 5, difficulty: 'hard',
  },

  'mb-143': {
    title: 'Clearview comes back',
    hint: "Work out what the offer actually costs over the period it covers, not over the first year.",
    brief: "The vendor has responded to the fifteen-seat proposal. Decide what to do with the offer.",
    tool: 'choice', datasetKey: 'analytics_ops',
    choice: {
      exhibit: {
        kind: 'email', from: 'Clearview Account Team', subject: 'Re: Renewal — seat count',
        body: "Thanks for coming to us early, that helps.\n\nWe can't do fifteen seats at the current unit rate — below twenty the price steps up to ₹84,000 a seat. What we can do is hold all thirty seats at ₹64,000 a seat on a two-year term, which brings the annual down to ₹19.2 lakh from ₹21.6 lakh.\n\nThat is a ₹2.4 lakh saving a year with no change on your side, and it protects you if the team grows.",
      },
      prompt: 'Tick everything that is true about this offer.',
      options: [
        { key: 'worse', correct: true, label: 'It is worse than fifteen seats at ₹84,000, which is ₹12.6 lakh a year', why: 'Their own step-up price on fifteen seats costs ₹6.6 lakh less a year than the discount they are offering. The offer is a discount on seats we do not want.' },
        { key: 'lock', correct: true, label: 'A two-year term removes the decision you have just spent a week earning the right to make', why: 'The value of this review is the ability to set seat counts at each renewal. Trading that for ₹2.4 lakh gives away the mechanism to keep the money.' },
        { key: 'anchor', correct: true, label: 'Comparing it to ₹21.6 lakh makes it look like a saving; comparing it to your proposal makes it a ₹6.6 lakh increase', why: 'The baseline is doing all the work in that email. Choosing which number the comparison is against is most of a negotiation.' },
        { key: 'counter', correct: true, label: 'The step-up price is itself negotiable and is the thing to push on', why: 'They have told you the fifteen-seat price. A one-year term at a better unit rate is a smaller ask than they have just made of you.' },
        { key: 'accept', correct: false, label: 'Accept it — ₹2.4 lakh with no change on our side is the lowest-risk saving available', why: 'It is the lowest-effort saving. It also costs ₹6.6 lakh a year against the alternative and locks it in for two.' },
        { key: 'growth', correct: false, label: 'The growth protection is worth having, given the team may hire next year', why: 'Sixteen seats have gone unused for a year. Paying for growth headroom on that scale is buying insurance against an event that has already failed to happen.' },
      ],
      skills: { businessLogic: 100, communication: 100 },
    },
    estHours: 0.6, priority: 'urgent', dueInDays: 5, day: 5, difficulty: 'hard',
  },

  'mb-144': {
    title: 'Answer the vendor',
    hint: "Hold the position, name the alternative you want, and keep the relationship. You renew with them next year too.",
    brief: "Reply to Clearview. You want fifteen seats on a one-year term at a better unit rate than ₹84,000. Under 150 words.",
    tool: 'writeup', datasetKey: 'analytics_ops',
    writeup: {
      to: 'Clearview Account Team', subject: 'Re: Renewal — seat count', maxWords: 150,
      prompt: 'Decline the two-year offer, state what you want, and keep it a negotiation rather than a stand-off.',
      rubric: [
        { key: 'decline', label: 'A clear decline of the thirty-seat two-year offer', markers: ['not|no|decline|cannot|won\'t|rather not|unable|pass|30|thirty|two.year'], why: 'An ambiguous answer to a vendor offer is read as an opening. Say no in a sentence and spend the rest on what you do want.' },
        { key: 'why', label: 'The reason: sixteen seats have never been assigned to anybody', markers: ['16|sixteen|never|unassigned|13|thirteen|active|use|nobody'], why: 'Checkable, unarguable, and it makes the decline a fact about us rather than a judgement about their pricing.' },
        { key: 'want', label: 'What you are actually asking for — fifteen seats, one year, a rate below the step-up', markers: ['15|fifteen|one.year|12.month|rate|84|unit|below|better'], why: 'A decline with no counter ends the conversation. Naming the shape you want lets them come back with something.' },
        { key: 'relationship', label: 'Kept warm — this is a renewal, not a departure', markers: ['renew|continue|value|work well|happy|relationship|next|keen|intend'], why: 'We are renewing with them either way and there is another renewal in twelve months. Winning ₹6.6 lakh rudely is not winning.' },
      ],
      skills: { communication: 100, businessLogic: 100 },
    },
    estHours: 0.6, priority: 'urgent', dueInDays: 5, day: 5, difficulty: 'hard',
  },

  'mb-145': {
    title: 'So that this is a smaller job next year',
    hint: "Every finding this week came from a gap between two tables that nobody was watching. Pick the checks that would have caught them.",
    brief: "Asha asks what should be standing rather than annual. Propose what gets instrumented. Under 180 words.",
    tool: 'writeup', datasetKey: 'analytics_ops',
    writeup: {
      to: 'Asha Rao', subject: 'Tooling — what should be standing rather than annual', maxWords: 180,
      prompt: 'What to check, how often, and who acts on it.',
      rubric: [
        { key: 'offboard', label: 'A leaver check — seats reclaimed as part of offboarding', markers: ['leaver|offboard|left|reclaim|revoke|exit|automatic|trigger'], why: 'The cheapest of the three findings to prevent and the only one that recurs with every departure.' },
        { key: 'unassigned', label: 'A standing view of seats contracted against seats assigned', markers: ['unassign|contract|assigned|gap|seat|monthly|quarterly|view|dashboard|report'], why: 'Sixteen empty seats existed for a year because no query compared two columns in two tables. It is a scheduled report, not a project.' },
        { key: 'ahead', label: 'A renewal calendar with a decision point well before each date', markers: ['renew|calendar|date|60|90|days|before|ahead|advance|diary|reminder'], why: 'The whole week ran on forty-six days of notice. Ninety days of notice turns a scramble into a decision.' },
        { key: 'owner', label: 'Somebody named as the owner of each check', markers: ['own|owner|me|I will|responsib|IT|who|assign|accountable'], why: 'A process with no name against it is a document. Naming yourself for the ones you own is part of the proposal.' },
        { key: 'nottoomuch', label: 'Restraint — not proposing to monitor individual tool use continuously', markers: ['not|individual|monitor|surveil|person|annual|quarterly|light|enough|proportion'], why: 'A standing per-person usage report would catch things, and it would also change what the data means and how the team feels about being measured.' },
      ],
      skills: { communication: 100, businessLogic: 100 },
    },
    estHours: 0.7, priority: 'high', dueInDays: 5, day: 5, difficulty: 'hard',
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
        throw new Error(`You're already enrolled as a ${levelLabel(existing.level)} and have graded work on record. Moving up a level happens through the promotion round, not by starting again.`);
      }
      // No graded work: wipe the unstarted assignment and re-issue at the new level.
      db.prepare('DELETE FROM sim_tasks WHERE enrollment_id = ?').run(existing.id);
      db.prepare('DELETE FROM sim_project_runs WHERE enrollment_id = ?').run(existing.id);
      db.prepare('UPDATE sim_enrollments SET level = ? WHERE id = ?').run(level, existing.id);
      const fresh = getEnrollment(userId);
      addMessage(fresh.id, 'people_partner', PEOPLE_PARTNER_NAME,
        `Your level has been changed to ${levelLabel(level)}. Asha will assign work at that level — nothing was lost, you hadn't been graded on anything yet.`,
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
    `Welcome to TenzorGrid! I'm ${PEOPLE_PARTNER_NAME} from People Ops. You're joining as a ${levelLabel(level)}. Your Line Manager is Asha Rao — she'll get you started. Ping me any time about policy or onboarding.`);
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

  // Signs the project off the moment the last of the fifty-one items lands, and says so.
  // Read time rather than a scheduler, same as the promotion review below it.
  //
  // This runs BEFORE the projects are read, not after. It used to sit below them, which
  // meant the project a learner had just finished was still 'active' when the promotion
  // round counted, so every promotion event — the conversation opening at project three,
  // the decision at four — landed one page load late. The learner saw their last task
  // graded and nothing happen, then heard about it on some unrelated click afterwards.
  finishProjectIfComplete(enrollment);

  let projects = getProjects(enrollment.role, tasks, streaks, enrollment.id, enrollment.level);

  // The promotion round runs here, before anything is rendered: a learner who has just
  // cleared the bar should see the next board on this load, not the next one.
  let promotion = getPromotion(enrollment, projects.projects, gradedTasks, tasks);

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

  // Read AFTER the promotion round, not before it. Asha's promotion messages — the
  // conversation opening, the verdict — are written during that round, so reading the
  // inbox first showed the learner an unchanged inbox on the very load where the thing
  // they had been working towards actually happened.
  const messages = db.prepare('SELECT * FROM sim_messages WHERE enrollment_id = ? ORDER BY created_at ASC').all(enrollment.id);
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
    // Everything is done — but the last day has not been signed off yet, and signing it
    // off is the moment the whole week builds to. Closing the run here would end the
    // project out from under the learner: activeRun goes null, the wrap-up button never
    // appears, and "that's the week" is never said. Wait for them to clock off.
    if (!dayIsClosed(enrollment, run, PROJECT_WEEK_DAYS)) continue;
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
  // Everything is done, but the last day has not been clocked off — and clocking off is
  // the moment the whole week builds to. Closing here would end the project out from
  // under the learner: activeRun goes null, the wrap-up button never appears, "that's the
  // week" is never said, and closeDay then fails with "no project is running".
  if (!dayIsClosed(enrollment, run, PROJECT_WEEK_DAYS)) return false;

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

// Testing only: jump straight to any finished project.
//
// The unlock gate is real and stays real — but verifying that project four works should
// not require playing projects one to three first, and neither should a learner reporting
// a bug on it. Gated on TIME_TRAVEL like every other shortcut, and it still refuses a
// project that is not finished being written, because starting one of those is the bug.
function timeTravelStartProject(userId, projectKey) {
  if (!TIME_TRAVEL_ENABLED) throw new Error('Time travel is not enabled on this server.');
  const enrollment = getEnrollment(userId);
  if (!enrollment) throw new Error('Not enrolled yet.');
  const def = catalogFor(enrollment.role, enrollment.level).find((p) => p.key === projectKey);
  if (!def) throw new Error('Unknown project for this role and level.');
  const ready = projectReadiness(def);
  if (!ready.ready) throw new Error(`That project is still being written (${ready.missing.join(', ')}).`);

  // Clear whatever is in flight so the board is not two projects deep. Everything else
  // about the run is the real path — the same rows, the same messages, the same drip.
  for (const run of db.prepare('SELECT * FROM sim_project_runs WHERE enrollment_id = ? AND completed_at IS NULL').all(enrollment.id)) {
    const other = catalogFor(enrollment.role, enrollment.level).find((p) => p.key === run.project_key);
    if (other) {
      const keys = other.taskKeys.map(() => '?').join(',');
      db.prepare(`DELETE FROM sim_tasks WHERE enrollment_id = ? AND task_key IN (${keys})`).run(enrollment.id, ...other.taskKeys);
    }
    // Everything belonging to the abandoned run, not just its tasks. An activity row left
    // behind still counts as "already issued", so the new run would never deliver it —
    // and the day would then sit forever at one of two activities with nothing to do.
    db.prepare('DELETE FROM sim_activities WHERE enrollment_id = ? AND project_run_id = ?').run(enrollment.id, run.id);
    db.prepare('DELETE FROM sim_situations WHERE enrollment_id = ? AND project_run_id = ?').run(enrollment.id, run.id);
    db.prepare('DELETE FROM sim_chores WHERE enrollment_id = ? AND project_run_id = ?').run(enrollment.id, run.id);
    db.prepare('DELETE FROM sim_quiz WHERE enrollment_id = ? AND project_key = ?').run(enrollment.id, run.project_key);
    db.prepare('DELETE FROM sim_days WHERE enrollment_id = ? AND project_run_id = ?').run(enrollment.id, run.id);
    db.prepare('DELETE FROM sim_ambient_mail WHERE enrollment_id = ? AND project_run_id = ?').run(enrollment.id, run.id);
    db.prepare('DELETE FROM sim_project_runs WHERE id = ?').run(run.id);
  }

  const run = startProjectRun(enrollment.id, projectKey);
  for (const key of def.taskKeys) {
    const taskId = assignTask(enrollment.id, key, run.started_at);
    const task = TASKS[key];
    if ((TASKS[key].day || 1) === 1) {
      addMessage(enrollment.id, 'line_manager', LINE_MANAGER_NAME,
        `You're picking up ${def.title}. First task: ${task.title}. ${task.brief}`, taskId);
    }
  }
  return { started: projectKey, state: getState(userId) };
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
  timeTravelStartProject,
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
