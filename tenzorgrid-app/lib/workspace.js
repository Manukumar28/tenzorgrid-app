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

const LINE_MANAGER_NAME = 'Asha Rao';
const STAKEHOLDER_NAME = 'Vikram Nair';
const PEOPLE_PARTNER_NAME = 'Neha Kulkarni';

const ROLE_CATALOG = {
  data_analyst: { label: 'Data Analyst', skin: 'Data & Analytics' },
};

// The Team tab roster. Manager-track direct reports get added here once team
// assembly ships (P2) — for the IC track this fixed cast is the whole org chart
// above the learner. `gender` is required on every entry: it's what picks a fitting
// avatar illustration out of the pool (see lib/avatars.js) — new characters added
// later (more roles, the manager track) just need a name/title/gender here and get a
// real avatar automatically, no manual picking required.
const ROSTER = [
  { archetype: 'line_manager', name: LINE_MANAGER_NAME, title: 'Line Manager', gender: 'female' },
  { archetype: 'people_partner', name: PEOPLE_PARTNER_NAME, title: 'People Partner (HR)', gender: 'female' },
  { archetype: 'stakeholder', name: STAKEHOLDER_NAME, title: 'Business Stakeholder', gender: 'male' },
];

// Assigns each roster member a stable avatar from their gender's pool, guaranteeing no
// two characters shown together end up with the same picture.
function rosterWithAvatars() {
  const used = new Set();
  return ROSTER.map((p) => ({ ...p, avatarUrl: pickAvatar(p.archetype, p.gender, used) }));
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
      taskKeys: ['da-001'],
      skillFocus: ['sql', 'businessLogic'],
      impactValue: 12400,
      unlockAfter: 0,
    },
    {
      key: 'headcount-trends',
      title: 'Headcount & Hiring Trends',
      description: 'People Ops wants the hiring pattern by year, and what each intake cost on average.',
      kind: 'dashboard',
      stakeholder: 'line_manager',
      difficulty: 'Medium',
      taskKeys: ['da-002'],
      skillFocus: ['sql', 'dataViz'],
      impactValue: 8000,
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
      unlockAfter: 2,
    },
  ],
};

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
const DAILY_AI_LIMITS = { submissions: 6, messages: 20 };

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
const MILESTONE = {
  data_analyst: {
    targetRole: 'Associate Data Analyst',
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
// `brief` deliberately does NOT list the columns any more: the Schema Browser in the
// workbench shows them live, which means the brief can never drift out of date with
// the data, and reading a schema is itself part of the job.
const TASKS = {
  'da-001': {
    title: 'Department salary breakdown',
    brief: "Vikram (Business Stakeholder) wants to know which department is paying the most, on average, and by how much it leads the next one. Write ONE SQL SELECT query returning each department's NAME and its average salary, highest first. Two things to get right: department names live in `departments`, not `employees`, and the employees table still holds people who have left (exit_year is set) — leadership is asking about current staff.",
    referenceSql: 'SELECT d.name AS department, AVG(e.salary) AS avg_salary FROM employees e JOIN departments d ON d.id = e.department_id WHERE e.exit_year IS NULL GROUP BY d.name ORDER BY avg_salary DESC',
    datasetKey: 'hr_core',
    tool: 'sql',
    estHours: 3,
    priority: 'high',
    dueInDays: 2,
  },
  'da-002': {
    title: 'Hiring trend by year',
    brief: "Asha wants to see how hiring has moved year on year for next year's plan. Write ONE SQL SELECT query returning, for each hire_year, how many people were hired and their average salary, oldest year first. Someone hired in 2019 who has since left was still a 2019 hire — this question is about intake, not current headcount.",
    referenceSql: 'SELECT hire_year, COUNT(*) AS headcount, AVG(salary) AS avg_salary FROM employees GROUP BY hire_year ORDER BY hire_year',
    datasetKey: 'hr_core',
    tool: 'sql',
    estHours: 2,
    priority: 'medium',
    dueInDays: 3,
  },
  'da-003': {
    title: 'Pay spread by role',
    brief: "Vikram is checking whether people doing the same job are paid consistently. Write ONE SQL SELECT query returning, for each role, the lowest, highest and average salary plus the gap between highest and lowest, widest gap first. Current employees only — a leaver's old salary is not evidence about today's pay.",
    referenceSql: 'SELECT role, MIN(salary) AS min_salary, MAX(salary) AS max_salary, AVG(salary) AS avg_salary, MAX(salary) - MIN(salary) AS spread FROM employees WHERE exit_year IS NULL GROUP BY role ORDER BY spread DESC',
    datasetKey: 'hr_core',
    tool: 'sql',
    estHours: 4,
    priority: 'high',
    dueInDays: 4,
  },
  'da-004': {
    title: 'Outage impact by client',
    brief: "Customer Success has to decide who gets compensated after the billing-sync outage, and they need the damage quantified first. Write ONE SQL SELECT query listing each AFFECTED, STILL-ACTIVE client with their tier, monthly recurring revenue, how many incidents hit them and the total rows corrupted — ordered so the accounts putting the most recurring revenue at risk come first. One account has already churned; recommending a retention package for them would be an error.",
    referenceSql: "SELECT c.company, c.tier, c.mrr, COUNT(i.id) AS incidents, SUM(i.rows_corrupted) AS rows_corrupted FROM clients c JOIN incidents i ON i.client_id = c.id WHERE c.status = 'active' GROUP BY c.company, c.tier, c.mrr ORDER BY c.mrr DESC",
    datasetKey: 'saas_ops',
    tool: 'sql',
    estHours: 5,
    priority: 'high',
    dueInDays: 5,
  },
  'da-005': {
    title: 'Median pay by department',
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
    estHours: 3,
    priority: 'medium',
    dueInDays: 4,
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

function assignTask(enrollmentId, taskKey) {
  const def = TASKS[taskKey];
  if (!def) throw new Error('Unknown task: ' + taskKey);
  const id = cryptoRandomId();
  const assignedAt = now();
  // A real deadline, set when the work is handed over — that's what makes "due today",
  // "overdue" and the on-time rate computable rather than decorative. Rows written
  // before this column existed get the same deadline reconstructed at read time from
  // assigned_at + dueInDays (see getTasksView).
  const dueAt = def.dueInDays
    ? new Date(Date.parse(assignedAt) + def.dueInDays * 24 * 60 * 60 * 1000).toISOString()
    : null;
  db.prepare(`
    INSERT INTO sim_tasks (id, enrollment_id, task_key, title, brief, status, assigned_at, est_hours, priority, due_at)
    VALUES (?, ?, ?, ?, ?, 'assigned', ?, ?, ?, ?)
  `).run(id, enrollmentId, taskKey, def.title, def.brief, assignedAt, def.estHours || null, def.priority || 'medium', dueAt);
  return id;
}

// Starts a learner's Virtual Workspace program. No payment check here yet —
// /api/subscribe is still the Phase 0 dev-mode stub; this just records the
// configuration choices from the HR session (role/level/schedule) so billing
// can be wired in later without a schema change.
function startEnrollment(userId, { level, scheduleType, scheduleDays }) {
  const existing = getEnrollment(userId);
  if (existing && existing.status !== 'ended') return existing;

  const role = 'data_analyst'; // only role built in P0
  const track = 'ic'; // manager track needs team assembly — P2
  const trialEndsAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
  const id = cryptoRandomId();
  db.prepare(`
    INSERT INTO sim_enrollments (id, user_id, role, level, track, schedule_type, schedule_days_json, status, trial_ends_at, checklist_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'trial', ?, '{}', ?)
  `).run(id, userId, role, level, track, scheduleType, JSON.stringify(scheduleDays || null), trialEndsAt, now());

  addMessage(id, 'people_partner', PEOPLE_PARTNER_NAME,
    `Welcome to TenzorGrid! I'm ${PEOPLE_PARTNER_NAME} from People Ops. You're joining as a ${level === 'senior' ? 'Senior' : 'Junior'} Data Analyst. Your Line Manager is Asha Rao — she'll assign your first task shortly. Ping me any time about policy or onboarding.`);
  addMessage(id, 'line_manager', LINE_MANAGER_NAME,
    `Hi, welcome to the team. Take a bit to settle in — I'll send your first task in a moment.`);

  const taskId = assignTask(id, 'da-001');
  const task = TASKS['da-001'];
  addMessage(id, 'line_manager', LINE_MANAGER_NAME,
    `First task: ${task.title}. ${task.brief}`, taskId);
  addMessage(id, 'stakeholder', STAKEHOLDER_NAME,
    "Hi — following up on the department pay numbers Asha mentioned. I need this for a leadership review, so ideally by end of day Thursday. Let me know if anything's unclear about what I'm after.",
    taskId, 'Department salary numbers — need by Thursday');

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
  const submissions = db.prepare(
    "SELECT COUNT(*) AS c FROM sim_tasks WHERE enrollment_id = ? AND status = 'graded' AND substr(graded_at, 1, 10) = ?"
  ).get(enrollmentId, todayStr).c;
  const messages = db.prepare(
    "SELECT COUNT(*) AS c FROM sim_messages WHERE enrollment_id = ? AND sender_archetype = 'learner' AND task_id IS NULL AND substr(created_at, 1, 10) = ?"
  ).get(enrollmentId, todayStr).c;
  return { submissions, messages };
}

function getSkillMatrix(gradedTasks) {
  const sums = {}, counts = {};
  for (const axis of SKILL_AXES) { sums[axis] = 0; counts[axis] = 0; }
  for (const t of gradedTasks) {
    if (!t.skills_json) continue;
    const skills = JSON.parse(t.skills_json);
    for (const axis of SKILL_AXES) {
      if (typeof skills[axis] === 'number') { sums[axis] += skills[axis]; counts[axis] += 1; }
    }
  }
  return SKILL_AXES.map((axis) => ({
    axis,
    label: SKILL_AXIS_LABEL[axis],
    value: counts[axis] ? Math.round(sums[axis] / counts[axis]) : 0,
    hasData: counts[axis] > 0,
  }));
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
function getProjects(role, tasks, streaks) {
  const catalog = PROJECT_CATALOG[role] || [];
  const byKey = {};
  for (const t of tasks) (byKey[t.task_key] = byKey[t.task_key] || []).push(t);

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
      avgScore: avg,
      grade: avg === null ? null : gradeLetter(avg),
      // The phase is the task actually open right now, not an invented milestone name.
      phase: openTask ? openTask.title : completed ? 'Delivered' : null,
      skillPoints: skillPointsFor(graded),
      estHours: def.taskKeys.reduce((s, k) => s + ((TASKS[k] && TASKS[k].estHours) || 0), 0),
      tasks: taskRows.map((t) => ({
        id: t.id, title: t.title, status: t.status, score: t.score,
        feedback: t.feedback, submittedAt: t.submitted_at,
      })),
    };
  });

  const completedCount = base.filter((p) => p.completed).length;

  const projects = base.map((p) => {
    const unlocked = completedCount >= p.def.unlockAfter;
    const status = p.completed ? 'completed' : p.started ? 'active' : unlocked ? 'available' : 'locked';
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
      phase: p.phase,
      avgScore: p.avgScore,
      grade: p.grade,
      // Only what this project actually moved, so an empty project shows no tags.
      skillsGained: SKILL_AXES
        .filter((axis) => p.skillPoints[axis] > 0)
        .map((axis) => ({ axis, label: SKILL_AXIS_LABEL[axis], points: round1(p.skillPoints[axis]) })),
      tasks: p.tasks,
      // What is actually standing between the learner and this project.
      requirement: unlocked ? null : `Complete ${p.def.unlockAfter} project${p.def.unlockAfter === 1 ? '' : 's'} first`,
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
function getTasksView(role, tasks, projects, nowMs, attendanceDays, enrollStartMs) {
  const catalog = PROJECT_CATALOG[role] || [];
  const projectByTaskKey = {};
  for (const p of catalog) {
    for (const k of p.taskKeys) projectByTaskKey[k] = p;
  }
  const projectStatus = Object.fromEntries(projects.projects.map((p) => [p.key, p]));

  const rows = tasks.map((t) => {
    const def = TASKS[t.task_key] || {};
    const proj = projectByTaskKey[t.task_key];
    const graded = t.status === 'graded';
    const stage = graded ? 'Graded' : t.submission ? 'Submitted' : 'Assigned';
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
      reviewQuestion: t.review_state === 'pending' ? t.review_question : null,
      reviewRoundsLeft: t.review_state === 'pending' ? Math.max(0, 2 - (t.review_rounds || 0)) : null,
      estHours: t.est_hours,
      gradedAt: t.graded_at || null,
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
  stakeholder: { key: 'stakeholder', label: 'Stakeholder', tone: 'amber' },
  line_manager: { key: 'line_manager', label: 'Line Manager', tone: 'emerald' },
  people_partner: { key: 'people_partner', label: 'HR', tone: 'purple' },
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
function getTeam(role, rosterList, projects, messages, messagesRemaining) {
  const catalog = PROJECT_CATALOG[role] || [];
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
  const catalog = PROJECT_CATALOG[enrollment.role] || [];
  if (!catalog.length) return 0;

  const rows = db.prepare('SELECT task_key FROM sim_tasks WHERE enrollment_id = ?').all(enrollment.id);
  const have = new Set(rows.map((r) => r.task_key));
  let added = 0;

  for (const def of catalog) {
    // Only projects the learner has actually started. An untouched project must stay
    // untouched — assigning its tasks here would silently start it for them.
    const started = def.taskKeys.some((k) => have.has(k));
    if (!started) continue;

    for (const key of def.taskKeys) {
      if (have.has(key) || !TASKS[key]) continue;
      const taskId = assignTask(enrollment.id, key);
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
  const enrollment = getEnrollment(userId);
  if (!enrollment) return null;

  // Catch up any project whose task list grew after the learner started it, before
  // anything below reads the task rows.
  reconcileProjectTasks(enrollment);

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
  const hoursAssigned = tasks.reduce((sum, t) => sum + (t.est_hours || 0), 0);
  const hoursCompleted = gradedTasks.reduce((sum, t) => sum + (t.est_hours || 0), 0);
  const hoursOpen = Math.max(0, hoursAssigned - hoursCompleted);

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

  const streaks = computeStreaks(attendanceRows.map((r) => r.attended_on));
  const projects = getProjects(enrollment.role, tasks, streaks);
  const rosterList = rosterWithAvatars();
  const aiUse = countTodaysAiUse(enrollment.id);
  const messagesRemaining = Math.max(0, DAILY_AI_LIMITS.messages - aiUse.messages);
  const taskBoard = getTasksView(
    enrollment.role, tasks, projects, Date.now(),
    attendanceRows.map((r) => r.attended_on),
    Date.parse(enrollment.created_at),
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
    team: getTeam(enrollment.role, rosterList, projects, messages, messagesRemaining),
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
    skillMatrix: getSkillMatrix(gradedTasks),
    scoreHistory,
    shoutouts: getShoutouts(gradedTasks),
    checklist,
    learningPath: LEARNING_PATH[enrollment.role] || [],
    milestone,
  };
}

// Starts an available project by assigning its tasks. The unlock gate is enforced here,
// not just hidden in the UI — calling this directly for a locked project is refused.
function startProject(userId, projectKey) {
  const enrollment = getEnrollment(userId);
  if (!enrollment) throw new Error('Not enrolled yet.');
  const def = (PROJECT_CATALOG[enrollment.role] || []).find((p) => p.key === projectKey);
  if (!def) throw new Error('Unknown project.');

  const tasks = db.prepare('SELECT * FROM sim_tasks WHERE enrollment_id = ?').all(enrollment.id);
  const attendanceRows = db.prepare('SELECT attended_on FROM sim_attendance WHERE enrollment_id = ?').all(enrollment.id);
  const streaks = computeStreaks(attendanceRows.map((r) => r.attended_on));
  const current = getProjects(enrollment.role, tasks, streaks).projects.find((p) => p.key === projectKey);

  if (current.status === 'locked') throw new Error(`${current.requirement} before starting this one.`);
  if (current.status !== 'available') throw new Error('That project is already underway.');

  for (const key of def.taskKeys) {
    const taskId = assignTask(enrollment.id, key);
    const task = TASKS[key];
    addMessage(enrollment.id, 'line_manager', LINE_MANAGER_NAME,
      `You're picking up ${def.title}. First task: ${task.title}. ${task.brief}`, taskId);
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

  const catalog = PROJECT_CATALOG[enrollment.role] || [];
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
    tools: tool === 'python'
      ? [TOOLS['python-notebook'], TOOLS['schema-browser']]
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
  const explains = /\bbecause\b|\bsince\b|\bso that\b|\bto avoid\b|\bwould\b|\botherwise\b/i.test(a);
  if (words >= 12 && explains) {
    return { accept: true, reply: "That's the reasoning I wanted to hear. Signed off — next one's yours." };
  }
  return {
    accept: false,
    reply: "That tells me what the code does, not why you chose it. Give me the reason — what would go wrong if you'd done it the other way?",
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
    // Signed off. NOW the score is revealed and the task counts — 'graded' stays the
    // terminal state, so everything downstream (projects, analytics, unlocks) is
    // unchanged by the gate existing.
    db.prepare("UPDATE sim_tasks SET status = 'graded', review_state = 'accepted', review_rounds = ?, graded_at = ? WHERE id = ?")
      .run(round, now(), taskId);
    addMessage(enrollment.id, 'line_manager', LINE_MANAGER_NAME, reply, taskId);
    addMessage(enrollment.id, 'line_manager', LINE_MANAGER_NAME, task.feedback, taskId);
    return { accepted: true, reply, score: task.score, feedback: task.feedback, state: getState(userId) };
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
  addMessage(enrollment.id, 'line_manager', LINE_MANAGER_NAME, question, taskId);

  return { inReview: true, question, result: submittedResult };
}

// Canned, in-character responses for archetypes that don't warrant an AI call for
// every reply — keeps the Team/Emails chat honest (a message always gets an answer)
// without spending an AI call on People Ops small talk.
const CANNED_REPLIES = {
  people_partner: "Thanks for flagging — noted. Ping me any time about policy or onboarding.",
  stakeholder: "Thanks for the update, appreciate it — let me know if anything changes on timing.",
};

const LINE_MANAGER_CHAT_SYSTEM = `You are Asha Rao, the Line Manager archetype in TenzorGrid's Virtual Workspace — a behavioural work simulator. Your comms style is short, direct, warm but never soft, 1-3 sentences. Reply in character to the learner's chat message. You are not grading anything here — that only happens on task submission. Never rewrite or solve their task for them.

Respond with ONLY the reply text, no preamble, no JSON.`;

async function replyAsArchetype(archetype, learnerBody) {
  if (archetype === 'line_manager' && ai.isAvailable()) {
    const reply = await ai.callClaude({ system: LINE_MANAGER_CHAT_SYSTEM, prompt: learnerBody, maxTokens: 200 });
    if (reply) return reply.trim();
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
  const reply = await replyAsArchetype(archetype, clean);
  const replySubject = subject ? 'Re: ' + subject.replace(/^Re:\s*/i, '') : null;
  addMessage(enrollment.id, archetype, person.name, reply, null, replySubject, archetype);

  return getState(userId);
}

module.exports = {
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
  markMessages,
};
