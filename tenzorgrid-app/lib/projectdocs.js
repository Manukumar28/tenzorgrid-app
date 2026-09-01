// Project documents — the brief a learner reads BEFORE they start work.
//
// The structure is fixed and deliberately shaped like a real internal project brief,
// in three sections:
//
//   1. Executive Summary   — why this matters and what happens if it goes wrong.
//   2. Objectives & Deliverables — what must physically be produced to pass.
//   3. Resource Stack      — exactly which tools are available, so nobody hunts for
//                            a tool that doesn't exist.
//
// AUTHORED, NOT GENERATED AT RUNTIME. Same reasoning as lib/datasets.js: a brief has
// to agree exactly with the dataset a learner queries and the reference answer their
// work is graded against. An AI writing a fresh brief per learner would eventually
// promise a table that isn't there or an objective the data can't support. The AI's
// leverage is at authoring time — drafting new briefs against a real dataset, which a
// human then accepts into this file.

// ---------------------------------------------------------------------------
// Tool registry.
//
// `status` is the honest bit. 'live' means it works in the app today; 'planned' means
// it is on the roadmap and the brief says so rather than pretending. A learner who
// goes looking for a Virtual CRM that does not exist loses trust in everything else
// the brief says, so we never list a tool without marking what it actually is.
//
// `icon` names a lucide-react icon; the frontend maps it (see toolIcons in the
// Workbench). Keeping it a string keeps this file free of frontend imports.
// ---------------------------------------------------------------------------

const TOOLS = {
  'sql-terminal': {
    key: 'sql-terminal',
    label: 'Data Terminal',
    icon: 'Terminal',
    status: 'live',
    summary: 'Write and run SQL against the project dataset.',
    detail: 'A full editor with syntax highlighting and autocomplete. Run a query as often as you like to explore, then submit when you are confident. Read-only: SELECT statements only.',
  },
  'schema-browser': {
    key: 'schema-browser',
    label: 'Schema Browser',
    icon: 'Database',
    status: 'live',
    summary: 'Inspect every table, column and row count in the dataset.',
    detail: 'Sits alongside the Data Terminal. Click a table to insert its name into your query.',
  },
  'email-client': {
    key: 'email-client',
    label: 'Email Client',
    icon: 'Mail',
    status: 'live',
    summary: 'Correspond with your stakeholder and send written deliverables.',
    detail: 'Found in the Emails tab. External and formal — this is where a stakeholder chases you.',
  },
  'team-chat': {
    key: 'team-chat',
    label: 'Team Chat',
    icon: 'MessagesSquare',
    status: 'live',
    summary: 'Ask your line manager or People Partner a question.',
    detail: 'Found in the Team tab. Internal and quick. Your manager will unblock you but will not do the work for you.',
  },
  'python-notebook': {
    key: 'python-notebook',
    label: 'Python Notebook',
    icon: 'FileCode2',
    status: 'live',
    summary: 'Run real Python in the browser, with the standard library.',
    detail: 'Real CPython 3.12 with the full standard library — statistics, collections, itertools, json. The project dataset is pre-loaded as a `tables` dict of plain rows, so there are no file paths to fight with. Runs entirely on your machine, so nothing you try is sent anywhere. There is no pandas yet. First run downloads the runtime, which takes a few seconds.',
  },
  'crm': {
    key: 'crm',
    label: 'Virtual CRM',
    icon: 'Contact',
    status: 'planned',
    summary: 'Client records, account history and call logging.',
    detail: 'Not yet available.',
  },
};

function toolsFor(keys) {
  return (keys || []).map((k) => TOOLS[k]).filter(Boolean);
}

// ---------------------------------------------------------------------------
// The documents.
//
// One per project key in PROJECT_CATALOG. `datasetKey` binds the brief to the data a
// learner will actually query, which is what keeps the two from drifting apart.
// ---------------------------------------------------------------------------

const PROJECT_DOCS = {
  'compensation-review': {
    projectTitle: 'Q1 Compensation Review',
    companyName: 'Meridian Systems',
    companyBlurb: 'A 400-person B2B software company. You sit in the Data & Analytics function.',
    yourRole: 'Data Analyst',
    roleResponsibilities: [
      'Own the analysis end to end — nobody will check your SQL before it reaches leadership.',
      'Answer the business question that was asked, not the one that is easiest to query.',
      'Flag anything in the data that looks wrong, rather than quietly working around it.',
    ],
    scenario:
      'Leadership is preparing the Q1 compensation cycle and has asked for a departmental pay picture before budgets are locked. Vikram Nair needs to know which function is paying the most on average and by how much it leads the next one. Get this wrong and the wrong department gets the raise pool.',
    estimatedMinutes: 45,
    difficulty: 'Medium',
    primaryObjective: 'Produce an accurate average-salary ranking by department, with the gap between the top two quantified.',
    constraints: [
      { label: 'Data scope', value: 'Current employees only — the table also holds people who have left.' },
      { label: 'Query style', value: 'One SELECT statement. No temporary tables.' },
      { label: 'Deadline', value: '2 working days from assignment.' },
    ],
    deliverables: [
      { text: 'A single SQL query returning average salary per department, highest first.', via: 'sql-terminal' },
      { text: 'Submit it for grading — Asha Rao reviews correctness and query quality.', via: 'sql-terminal' },
    ],
    watchOutFor: [
      'The employees table includes leavers. exit_year is NULL for current staff.',
      'Salary sits in employees, but department names sit in departments — you will need a JOIN.',
    ],
    toolKeys: ['sql-terminal', 'schema-browser', 'email-client', 'team-chat'],
    datasetKey: 'hr_core',
  },

  'headcount-trends': {
    projectTitle: 'Headcount & Hiring Trends',
    companyName: 'Meridian Systems',
    companyBlurb: 'A 400-person B2B software company. You sit in the Data & Analytics function.',
    yourRole: 'Data Analyst',
    roleResponsibilities: [
      'Turn a vague People Ops question into a precise, defensible number.',
      'Present the trend, not just the rows — the reader wants the shape of hiring over time.',
    ],
    scenario:
      'People Ops is building next year\'s hiring plan and cannot say what recent intakes actually cost. Asha Rao has asked you for the hiring pattern by year, alongside what each cohort cost on average, so the plan is built on evidence rather than memory.',
    estimatedMinutes: 40,
    difficulty: 'Medium',
    primaryObjective: 'Show how many people were hired each year and the average salary of each intake.',
    constraints: [
      { label: 'Grouping', value: 'By hire year. Every year with a hire must appear.' },
      { label: 'Query style', value: 'One SELECT statement.' },
      { label: 'Deadline', value: '3 working days from assignment.' },
    ],
    deliverables: [
      { text: 'A SQL query returning hires per year and average starting salary per year.', via: 'sql-terminal' },
      { text: 'Submit it for grading.', via: 'sql-terminal' },
    ],
    watchOutFor: [
      'Someone hired in 2019 who has since left was still a 2019 hire — think about whether they belong in the count.',
      'Ordering by year is not the same as ordering by volume. Read what was asked.',
    ],
    toolKeys: ['sql-terminal', 'schema-browser', 'email-client', 'team-chat'],
    datasetKey: 'hr_core',
  },

  'pay-equity-audit': {
    projectTitle: 'Pay Equity Audit',
    companyName: 'Meridian Systems',
    companyBlurb: 'A 400-person B2B software company. You sit in the Data & Analytics function.',
    yourRole: 'Data Analyst',
    roleResponsibilities: [
      'Find where the same job is paid very differently, and be able to defend the finding.',
      'Separate a real equity problem from ordinary seniority spread.',
      'Write it up so a non-technical reader can act on it.',
    ],
    scenario:
      'A pay-equity question has been raised informally and leadership wants to know whether there is a real problem before it becomes a formal one. You have been asked for a role-by-role view of pay spread — where two people doing the same job are paid very differently, and how wide that gap goes.',
    estimatedMinutes: 60,
    difficulty: 'Hard',
    primaryObjective: 'Identify, per role, the minimum, maximum and average salary and the spread between them — ranked by the widest spread.',
    constraints: [
      { label: 'Data scope', value: 'Current employees only.' },
      { label: 'Sensitivity', value: 'This is a live HR matter. State what the data shows and nothing beyond it.' },
      { label: 'Deadline', value: '4 working days from assignment.' },
    ],
    deliverables: [
      { text: 'A SQL query giving min, max, average and spread per role, widest spread first.', via: 'sql-terminal' },
      { text: 'A Python analysis returning the MEDIAN salary and headcount per department, highest median first. SQLite has no MEDIAN function, so this half genuinely cannot be done in SQL.', via: 'python-notebook' },
      { text: 'Submit each for grading.', via: 'sql-terminal' },
    ],
    watchOutFor: [
      'A wide spread inside one role is not automatically unfair — a Staff Engineer and a new joiner can share a title band.',
      'Roles with only one person have a spread of zero. Decide whether they belong in the answer.',
      'At least one senior individual contributor out-earns their own manager. That is real, not a data error.',
      'Median and average are not the same number here, and the gap between them is itself the finding — a few very large salaries pull the average away from what a typical person in that department actually earns.',
    ],
    toolKeys: ['sql-terminal', 'python-notebook', 'schema-browser', 'email-client', 'team-chat'],
    datasetKey: 'hr_core',
  },

  'outage-recovery': {
    projectTitle: 'Project Phoenix: Outage Impact & Client Recovery',
    companyName: 'Acme Logistics SaaS',
    companyBlurb: 'A logistics platform serving 16 enterprise and mid-market accounts.',
    yourRole: 'Data Analyst, embedded with Customer Success',
    roleResponsibilities: [
      'Quantify the damage before anyone negotiates — Customer Success cannot make an offer without a number.',
      'Rank accounts by business risk, not by raw incident size. Those are not the same ranking.',
      'Exclude accounts that are already gone. Recommending a retention package for a churned client is a factual error.',
    ],
    scenario:
      'A cascading failure across the billing-sync and data-export services corrupted client data over several weeks. Customer Success must now decide who to compensate and how much, before renewals come up. You own the impact analysis that decision rests on.',
    estimatedMinutes: 75,
    difficulty: 'Hard',
    primaryObjective: 'Rank affected active clients by the revenue genuinely at risk, so compensation goes where it protects the most recurring revenue.',
    constraints: [
      { label: 'Data scope', value: 'Active clients only. One account has already churned.' },
      { label: 'Business rule', value: 'Rows corrupted measures damage. It does not measure what that damage costs us.' },
      { label: 'Open incidents', value: 'Some incidents have no resolved_at. Decide how you treat them and be ready to say why.' },
    ],
    deliverables: [
      { text: 'A SQL query ranking affected active clients by monthly recurring revenue at risk.', via: 'sql-terminal' },
      { text: 'Submit it for grading.', via: 'sql-terminal' },
    ],
    watchOutFor: [
      'Ranking by rows_corrupted puts Growth-tier accounts on top. Ranking by revenue at risk puts Enterprise on top. Only one of those answers the question that was asked.',
      'incidents joins to clients on client_id. A client with no incident should not silently appear as zero.',
    ],
    toolKeys: ['sql-terminal', 'schema-browser', 'email-client', 'team-chat', 'crm'],
    datasetKey: 'saas_ops',
  },
};

// Assembles the full document for a project. Returns null for a project with no
// authored doc, so callers can fall back to the short catalog description rather than
// rendering an empty brief.
function getProjectDoc(projectKey) {
  const doc = PROJECT_DOCS[projectKey];
  if (!doc) return null;
  return {
    ...doc,
    tools: toolsFor(doc.toolKeys),
    // Split out so the UI can warn about unavailable tools separately from the ones
    // the learner can actually open.
    liveTools: toolsFor(doc.toolKeys).filter((t) => t.status === 'live'),
    plannedTools: toolsFor(doc.toolKeys).filter((t) => t.status !== 'live'),
  };
}

function datasetKeyFor(projectKey) {
  const doc = PROJECT_DOCS[projectKey];
  return doc ? doc.datasetKey : null;
}

module.exports = { TOOLS, PROJECT_DOCS, getProjectDoc, datasetKeyFor, toolsFor };
