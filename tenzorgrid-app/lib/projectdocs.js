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
  'chart-builder': {
    name: 'Chart Builder',
    status: 'live',
    blurb: 'Choose how a result set is presented — chart type, axes, ordering, baseline — with a live preview.',
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

  // ---- Senior track -------------------------------------------------------------
  // Written to a senior brief, not a longer one: the objective is a recommendation, the
  // constraints leave a judgement call open rather than closing it, and 'watch out for'
  // names the traps without saying which side to come down on.
  'reliability-review': {
    projectTitle: 'Platform Reliability Review',
    companyName: 'Acme Logistics SaaS',
    companyBlurb: 'A logistics platform serving 16 enterprise and mid-market accounts.',
    yourRole: 'Senior Data Analyst, embedded with Platform Engineering',
    roleResponsibilities: [
      'Decide what belongs in the numbers. Nobody senior will be told which rows to exclude.',
      'Report the shape of the data, not just its middle. An average that hides the worst case is not a reliability picture.',
      'Say what you would do about it. A senior analysis that stops at the table has stopped early.',
    ],
    scenario:
      'Engineering leadership is planning next quarter and cannot agree on where the time goes. Frequency and cost are being used interchangeably in the argument, and they are not the same thing: the service that breaks most often is not necessarily the one that costs the most to fix. Meanwhile Customer Success needs to know which accounts are walking into their QBRs with an unresolved backlog.',
    estimatedMinutes: 90,
    difficulty: 'Hard',
    primaryObjective: 'Establish which service costs the most engineering time per failure, and which active accounts carry the worst unresolved backlog — with a recommendation on where next quarter should go.',
    constraints: [
      { label: 'Data scope', value: 'Active clients for the backlog view. Your call on the incident view — and be ready to defend it.' },
      { label: 'Open incidents', value: 'Some incidents have no resolved_at. They cannot contribute to a resolution time. Whether they belong in the count is the question.' },
      { label: 'Query style', value: 'One SELECT per deliverable. No temporary tables.' },
    ],
    deliverables: [
      { text: 'A SQL query giving time-to-resolve per service, slowest first.', via: 'sql-terminal' },
      { text: 'A SQL query giving unresolved backlog and SEV1 exposure per active client.', via: 'sql-terminal' },
    ],
    watchOutFor: [
      'A count of all incidents printed beside an average over only the closed ones is internally inconsistent — and it is the kind of table people quietly believe.',
      "'Not resolved' covers open AND pending. Counting only 'open' understates every account's backlog.",
      'A client with no tickets still has a backlog of zero. That row is information, not an absence.',
    ],
    toolKeys: ['sql-terminal', 'schema-browser', 'email-client', 'team-chat', 'crm'],
    datasetKey: 'saas_ops',
  },

  'account-economics': {
    projectTitle: 'Account Economics Review',
    companyName: 'Acme Logistics SaaS',
    companyBlurb: 'A logistics platform serving 16 enterprise and mid-market accounts.',
    yourRole: 'Senior Data Analyst, embedded with Finance',
    roleResponsibilities: [
      'Normalise before you compare. A big account raising more tickets is not the same as a costly account.',
      'Keep the rows that make the point, including the empty ones.',
      'Give Finance a number they can put in a pricing conversation, not a table they have to interpret.',
    ],
    scenario:
      'Finance is rebuilding the pricing model and suspects some accounts cost more to serve than they return. Raw ticket counts favour the biggest customers and tell them nothing. Separately, the platform team wants the distribution of engineering time by severity — medians and worst cases, not averages, because the outliers are the argument.',
    estimatedMinutes: 90,
    difficulty: 'Hard',
    primaryObjective: 'Produce a cost-to-serve ranking that survives being divided by revenue, and a severity-level picture of engineering time that shows the tail as well as the middle.',
    constraints: [
      { label: 'Data scope', value: 'Active clients only for the economics view.' },
      { label: 'Business rule', value: 'Support load must be expressed per unit of revenue, or the largest customer always looks worst.' },
      { label: 'Tooling', value: 'SQLite has no median. The distribution work belongs in the notebook.' },
    ],
    deliverables: [
      { text: 'A SQL query giving tickets per 100k of MRR for every active client.', via: 'sql-terminal' },
      { text: 'A Python analysis giving median and worst-case resolution hours by severity.', via: 'python-notebook' },
    ],
    watchOutFor: [
      'One account has churned and still has tickets against it. Without the status filter it lands mid-table and Finance prices for a customer we no longer have.',
      'Dividing by MRR without casting will do integer division in some engines. Check your zero-decimal results.',
      'Median is not average. If they agree here, you have probably computed the average twice.',
    ],
    toolKeys: ['sql-terminal', 'schema-browser', 'python-notebook', 'email-client', 'team-chat', 'crm'],
    datasetKey: 'saas_ops',
  },

  'activation-review': {
    projectTitle: 'Activation & Onboarding Review',
    companyName: 'Meridian Systems',
    companyBlurb: 'Your own employer. This week the product under analysis is the one Meridian sells.',
    yourRole: 'Senior Data Analyst, embedded with Product',
    roleResponsibilities: [
      'Establish what the data covers before you compute anything from it.',
      'Define the population deliberately. Who is in the table is a decision, not a given.',
      'Report the thing that is true, including when it is the opposite of what you were asked to confirm.',
    ],
    scenario:
      'Product has two questions and one of them is wrong. Maya believes June signups collapsed. Priya wants to know why signups are not becoming users, and has next quarter of engineering time riding on the answer. Somewhere in between, the numbers on the dashboard everyone already trusts turn out to have been inflated for five weeks.',
    estimatedMinutes: 100,
    difficulty: 'Hard',
    primaryObjective: 'A defensible activation picture — correct population, correct funnel shape, correct observation window — and one recommendation Priya can act on.',
    constraints: [
      { label: 'Data scope', value: 'The export ends on 12 June 2026. Nothing after that exists, and the last cohorts are incomplete rather than bad.' },
      { label: 'Population', value: 'Meridian staff use the product too. Decide whether they belong in a customer metric, and say so either way.' },
      { label: 'Counting rule', value: 'Count users, not rows. There is a reason, and you will find it on Wednesday.' },
    ],
    deliverables: [
      { text: 'A funnel that is monotonic, over a population that makes sense.', via: 'sql-terminal' },
      { text: 'A scoped bug report for the mobile team.', via: 'email-client' },
      { text: 'One recommendation to the Head of Product, with its limits stated.', via: 'email-client' },
    ],
    watchOutFor: [
      'A third of users were invited into a workspace that already existed. They never create one, which is why a naive funnel step converts above 100%.',
      'Every funnel event is duplicated in one mobile build. COUNT(*) and COUNT(DISTINCT user_id) disagree, and only one of them is right.',
      'The newest cohorts have not been observed long enough to have a week-four retention figure. An empty cell is not a zero.',
      'Zero-duration sessions are twice as common on mobile. Leave them in and mobile looks less engaging; take them out and the finding reverses.',
    ],
    toolKeys: ['sql-terminal', 'schema-browser', 'email-client', 'team-chat'],
    datasetKey: 'product_events',
  },

  'experiment-readout': {
    projectTitle: 'Onboarding Experiment Readout',
    companyName: 'Meridian Systems',
    companyBlurb: 'Your own employer. The experiment under review is one the product team ran on Meridian customers.',
    yourRole: 'Senior Data Analyst, embedded with Product',
    roleResponsibilities: [
      'Check whether a comparison is valid before reporting what it says.',
      'Correct a number the business has already been told, without making the person who told them look careless.',
      'Report the effect you can defend, at the precision you can defend it to.',
    ],
    scenario:
      'onboarding_v2 ran for ten weeks and the headline says it lost: 36% activation against control\'s 45%. Priya wants a rollback note by Wednesday and the growth channel is about to post the result. The assignment, it turns out, was bucketed on device — so the treatment arm is three-quarters mobile and the control arm is three-quarters web, on a product where mobile activates at a third of web\'s rate.',
    estimatedMinutes: 110,
    difficulty: 'Hard',
    primaryObjective: 'A defensible readout of what onboarding_v2 actually did, and a decision Priya can act on.',
    constraints: [
      { label: 'Data scope', value: 'Customers only. Eight Meridian staff sit in each arm.' },
      { label: 'Comparison rule', value: 'Two arms can only be compared on the thing being tested if they match on everything else. Establish that before reading any result.' },
      { label: 'Reporting rule', value: 'A subgroup result you went looking for after seeing the answer is a hypothesis, not a finding.' },
    ],
    deliverables: [
      { text: 'A balance check on the two arms, before any outcome is computed.', via: 'sql-terminal' },
      { text: 'A standardised comparison that holds the platform mix constant.', via: 'python-notebook' },
      { text: 'A readout that replaces the circulated figure and ends in a decision.', via: 'email-client' },
    ],
    watchOutFor: [
      'The arms are 169 and 122 — but the unequal SIZE costs precision, while the unequal COMPOSITION is what biases the result. They are different problems.',
      'Treatment wins on web and wins on mobile, and loses overall. Both calculations are correct.',
      'Sixteen subgroup splits will always produce two or three extremes. Two of them here point the opposite way to the result, on cells of fifteen users.',
      'A larger sample would have reproduced this skew more precisely, not fixed it. Sample size does not cure biased assignment.',
    ],
    toolKeys: ['sql-terminal', 'schema-browser', 'python-notebook', 'email-client', 'team-chat'],
    datasetKey: 'product_events',
  },

  'trading-review': {
    projectTitle: 'Half-Year Trading Review',
    companyName: 'Meridian Retail',
    companyBlurb: 'Meridian\'s thirteen-store retail arm. You lead the analytics team that reports on it.',
    yourRole: 'Data Analytics Team Lead',
    roleResponsibilities: [
      'You own what leaves the team, whether or not you wrote it.',
      'Check the number that flatters somebody hardest, not least.',
      'Say what you can show and refuse, out loud, to say what you cannot.',
    ],
    scenario:
      'Ravi has drafted the half-year pack and sent it for a sanity check. It has a revenue figure with no definition, a transaction count that includes refunds, a store ranking that is really a ranking of trading days, and one celebrated star performer. The board meets Tuesday.',
    estimatedMinutes: 120,
    difficulty: 'Hard',
    primaryObjective: 'A trading picture the board can act on: defined figures, a like-for-like comparison, and no claim the data cannot carry.',
    constraints: [
      { label: 'Data scope', value: 'Twelve months to 30 June 2026. The estate changed during it — two openings and a closure.' },
      { label: 'Counting rule', value: 'Returns are negative rows in the same table. Decide what a transaction is and say so.' },
      { label: 'Reporting rule', value: 'Any figure you correct has to be disclosed, or the pack stops reconciling with the warehouse.' },
    ],
    deliverables: [
      { text: 'A defined gross-to-net bridge for the year.', via: 'sql-terminal' },
      { text: 'A like-for-like half-on-half comparison across a stable estate.', via: 'sql-terminal' },
      { text: 'Sign-off, or a rewrite, of the trading slide.', via: 'email-client' },
    ],
    watchOutFor: [
      'The one store growing against a uniformly declining estate is the one to check first, not last.',
      'Revenue per trading day and revenue per day open are different denominators, and they disagree most for the quietest stores.',
      'The comparison period contains a discount-driven promotion month. Half-on-half against it overstates the decline.',
      'A slide can be arithmetically right and still claim something the analysis never established.',
    ],
    toolKeys: ['sql-terminal', 'schema-browser', 'python-notebook', 'email-client', 'team-chat'],
    datasetKey: 'retail_sales',
  },

  'margin-review': {
    projectTitle: 'Margin & Promotion Review',
    companyName: 'Meridian Retail',
    companyBlurb: 'Meridian\'s thirteen-store retail arm. You lead the analytics team that reports on it.',
    yourRole: 'Data Analytics Team Lead',
    roleResponsibilities: [
      'Know which version of a number answers which question, and label both.',
      'Refuse measures that can be hit without anything improving.',
      'Give a decision-maker the trade, not your opinion of the trade.',
    ],
    scenario:
      'Finance are rebuilding the range plan and want gross margin by category. There is no margin column, and the cost column is today\'s cost rather than the cost when each sale happened — fifteen products were repriced upward during the year and they carry a quarter of revenue. Somewhere in the middle of it, one month turns out to have been a promotion nobody wrote down.',
    estimatedMinutes: 130,
    difficulty: 'Hard',
    primaryObjective: 'Margin the range review can be planned on, and an honest account of what the promotion bought.',
    constraints: [
      { label: 'Cost basis', value: 'Reporting uses the cost that applied on the day of sale. A forward-looking view uses current cost. Never one table for both.' },
      { label: 'Data scope', value: 'Comparisons across periods use the stable estate — two stores opened inside the window and one closed.' },
      { label: 'Measure rule', value: 'A rate that can be improved by changing the sales mix is not, on its own, a target.' },
    ],
    deliverables: [
      { text: 'Margin by category on the cost that applied, with contribution beside rate.', via: 'sql-terminal' },
      { text: 'A quantified account of what the promotion cost and bought.', via: 'python-notebook' },
      { text: 'Replacement wording for the planning note.', via: 'email-client' },
    ],
    watchOutFor: [
      'The naive cost error is uneven — 7% in Equipment, nothing in Tea — so it distorts the comparison between categories rather than shifting the total.',
      'It also flatters the present against the past, because the two methods agree after a cost change and diverge before it.',
      'Equipment has the lowest margin rate and the largest margin contribution. A range review that confuses those loses a crore.',
      'The discount curve reverses at the deepest band, on 326 lines out of 9,022. That tail is the thinnest part of the data and the easiest place to lose money.',
    ],
    toolKeys: ['sql-terminal', 'schema-browser', 'python-notebook', 'email-client', 'team-chat'],
    datasetKey: 'retail_sales',
  },

  'range-review': {
    projectTitle: 'Range & Space Review',
    companyName: 'Meridian Retail',
    companyBlurb: 'Meridian\'s thirteen-store retail arm. You lead the analytics team that reports on it.',
    yourRole: 'Data Analytics Team Lead',
    roleResponsibilities: [
      'Start from the population, not from the rows that happen to exist.',
      'Refuse a measure that produces suspiciously tidy output, and say why in writing.',
      'State a delist as a cost to be justified, never as a saving nobody computed.',
    ],
    scenario:
      'Buying want a delist list for the spring reset and have asked for stock cover to support it. Seven of the sixty-eight lines in the range have never sold a unit anywhere, and no previous review has seen them. The stock counts will produce a cover figure, and it will not mean anything.',
    estimatedMinutes: 125,
    difficulty: 'Hard',
    primaryObjective: 'A delist candidate list built only on measures this data can defend, costed honestly.',
    constraints: [
      { label: 'Population', value: 'Range reporting starts from products. A product with no sales has no row in sales, and an inner join deletes it.' },
      { label: 'Cost basis', value: 'Margin uses the cost that applied on the day of sale.' },
      { label: 'Framing', value: 'The margin a delist removes is computable. The space and capital it frees is not, and must not be estimated.' },
    ],
    deliverables: [
      { text: 'A range table covering every product, including those that never sold.', via: 'sql-terminal' },
      { text: 'A delist candidate list with the test each line fails.', via: 'python-notebook' },
      { text: 'A written refusal of the stock cover measure, with the evidence.', via: 'email-client' },
    ],
    watchOutFor: [
      'Seven lines have no sales rows at all. Every previous review ranked products by sales and never saw them.',
      'Average stock is 14.8 to 24.0 units for every product while annual sales run 234 to 482. Stock does not respond to demand here, so cover is not measuring anything.',
      'A delist rule expressed as a share of category margin never terminates — every cut creates a new bottom.',
      'Total margin and margin per carrying store rank the candidates differently. Both are correct measures of different things.',
    ],
    toolKeys: ['sql-terminal', 'schema-browser', 'python-notebook', 'email-client', 'team-chat'],
    datasetKey: 'retail_sales',
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
