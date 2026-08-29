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

const { DatabaseSync } = require('node:sqlite');
const { db, cryptoRandomId } = require('./db');
const ai = require('./ai');
const { pickAvatar } = require('./avatars');

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
      key: 'pay-equity-audit',
      title: 'Pay Equity Audit',
      description: 'A role-by-role look at pay spread, to find where the same job is paid very differently.',
      kind: 'audit',
      stakeholder: 'stakeholder',
      difficulty: 'Hard',
      taskKeys: ['da-003'],
      skillFocus: ['sql', 'businessLogic', 'communication'],
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
const PRACTICE_SCHEMA = `
  CREATE TABLE employees (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    department TEXT NOT NULL,
    role TEXT NOT NULL,
    salary INTEGER NOT NULL,
    hire_year INTEGER NOT NULL
  );
`;
const PRACTICE_ROWS = [
  [1, 'Ananya Iyer', 'Engineering', 'Software Engineer', 1450000, 2022],
  [2, 'Rohan Mehta', 'Engineering', 'Senior Engineer', 2100000, 2019],
  [3, 'Kavya Reddy', 'Engineering', 'Software Engineer', 1380000, 2023],
  [4, 'Arjun Nair', 'Engineering', 'Engineering Manager', 2900000, 2017],
  [5, 'Priya Menon', 'Sales', 'Account Executive', 980000, 2021],
  [6, 'Karthik Rao', 'Sales', 'Sales Manager', 1900000, 2018],
  [7, 'Ishita Shah', 'Sales', 'Account Executive', 1050000, 2022],
  [8, 'Aditya Kapoor', 'Marketing', 'Marketing Specialist', 890000, 2023],
  [9, 'Meera Pillai', 'Marketing', 'Marketing Manager', 1650000, 2019],
  [10, 'Rahul Verma', 'Support', 'Support Agent', 620000, 2023],
  [11, 'Sneha Joshi', 'Support', 'Support Lead', 1050000, 2020],
  [12, 'Vivaan Malhotra', 'Support', 'Support Agent', 650000, 2022],
  [13, 'Diya Chandra', 'Finance', 'Financial Analyst', 1250000, 2021],
  [14, 'Aarav Bose', 'Finance', 'Finance Manager', 2250000, 2018],
  [15, 'Sanya Kulkarni', 'Engineering', 'Senior Engineer', 2050000, 2020],
  [16, 'Ibrahim Sheikh', 'Sales', 'Sales Manager', 1950000, 2017],
];

function buildPracticeDb() {
  const mem = new DatabaseSync(':memory:');
  mem.exec(PRACTICE_SCHEMA);
  const insert = mem.prepare('INSERT INTO employees (id, name, department, role, salary, hire_year) VALUES (?, ?, ?, ?, ?, ?)');
  for (const row of PRACTICE_ROWS) insert.run(...row);
  return mem;
}

// da-001 is the only task in P0 — enough to prove the whole loop end to end before
// building out a task library.
const TASKS = {
  'da-001': {
    title: 'Department salary breakdown',
    brief: "Vikram (Business Stakeholder) wants to know which department is paying the most, on average, and by how much it leads the next one. Write ONE SQL SELECT query against the `employees` table (columns: id, name, department, role, salary, hire_year) that returns each department's average salary, sorted highest to lowest.",
    referenceSql: 'SELECT department, AVG(salary) AS avg_salary FROM employees GROUP BY department ORDER BY avg_salary DESC',
    estHours: 3,
  },
  'da-002': {
    title: 'Hiring trend by year',
    brief: "Asha wants to see how hiring has moved year on year. Write ONE SQL SELECT query against the `employees` table (columns: id, name, department, role, salary, hire_year) returning, for each hire_year, how many people were hired and their average salary, oldest year first.",
    referenceSql: 'SELECT hire_year, COUNT(*) AS headcount, AVG(salary) AS avg_salary FROM employees GROUP BY hire_year ORDER BY hire_year',
    estHours: 2,
  },
  'da-003': {
    title: 'Pay spread by role',
    brief: "Vikram is checking whether people doing the same job are paid consistently. Write ONE SQL SELECT query against the `employees` table (columns: id, name, department, role, salary, hire_year) returning, for each role, the lowest, highest and average salary plus the gap between highest and lowest, widest gap first.",
    referenceSql: 'SELECT role, MIN(salary) AS min_salary, MAX(salary) AS max_salary, AVG(salary) AS avg_salary, MAX(salary) - MIN(salary) AS spread FROM employees GROUP BY role ORDER BY spread DESC',
    estHours: 4,
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
  db.prepare(`
    INSERT INTO sim_tasks (id, enrollment_id, task_key, title, brief, status, assigned_at, est_hours)
    VALUES (?, ?, ?, ?, ?, 'assigned', ?, ?)
  `).run(id, enrollmentId, taskKey, def.title, def.brief, now(), def.estHours || null);
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

function getState(userId) {
  const enrollment = getEnrollment(userId);
  if (!enrollment) return null;
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
    roster: rosterWithAvatars(),
    emailArchetypes: EMAIL_ARCHETYPES,
    projects,
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
function assertReadOnlySelect(sql) {
  const trimmed = sql.trim().replace(/;+\s*$/, '');
  if (!trimmed) throw new Error('Query is empty.');
  if (trimmed.includes(';')) throw new Error('Only a single statement is allowed.');
  if (!/^select\b/i.test(trimmed)) throw new Error('Only SELECT queries are allowed here.');
  if (/\b(insert|update|delete|drop|alter|attach|pragma|create|replace)\b/i.test(trimmed)) {
    throw new Error('Only read-only SELECT queries are allowed here.');
  }
  return trimmed;
}

function runPracticeQuery(sql) {
  const clean = assertReadOnlySelect(sql);
  const mem = buildPracticeDb();
  try {
    const rows = mem.prepare(clean).all();
    return rows;
  } finally {
    mem.close();
  }
}

const LINE_MANAGER_GRADING_SYSTEM = `You are Asha Rao, the Line Manager archetype in TenzorGrid's Virtual Workspace — a behavioural work simulator. You are the ONLY character who grades. Your comms style is short, direct, bullet points, warm but never soft. You never do the learner's thinking for them and you never rewrite their query — you assess what they submitted.

Grade the learner's SQL submission against the task brief, the reference result, and their actual result. Score 0-100 on correctness and query quality (readability, appropriate use of GROUP BY/aggregate functions, no unnecessary complexity). Then write brief, specific, in-character feedback (2-4 short lines, bullet points ok) — coach, don't lecture; note one thing they did well if there is one.

Also score the submission 0-100 on each of these skill axes, but ONLY for axes this specific task actually exercises — use null for any axis a SQL task like this one has no basis to judge (e.g. a pure SQL task has no python or dataViz signal at all): sql, python, dataViz, communication (is the query itself readable/well-structured), businessLogic (did they answer what the stakeholder actually asked).

Respond with ONLY a JSON object: {"score": <0-100 integer>, "feedback": "<your in-character feedback, first person as Asha>", "skills": {"sql": <0-100 or null>, "python": <0-100 or null>, "dataViz": <0-100 or null>, "communication": <0-100 or null>, "businessLogic": <0-100 or null>}}`;

function cleanSkills(raw) {
  const out = {};
  for (const axis of SKILL_AXES) {
    const v = raw && raw[axis];
    out[axis] = typeof v === 'number' ? Math.max(0, Math.min(100, Math.round(v))) : null;
  }
  return out;
}

async function gradeSubmission(taskDef, submittedSql, submittedResult, referenceResult) {
  const prompt = `Task brief: ${taskDef.brief}

Reference (correct) result:
${JSON.stringify(referenceResult)}

Learner's submitted SQL:
${submittedSql}

Learner's actual result:
${JSON.stringify(submittedResult)}`;

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
  const matches = JSON.stringify(submittedResult) === JSON.stringify(referenceResult);
  const base = matches
    ? { score: 90, feedback: "Correct — that matches what I'd expect. Ship it." }
    : { score: 45, feedback: "That doesn't match what I'm seeing when I run it myself. Check your GROUP BY and sort order, then resubmit." };
  return { ...base, skills: cleanSkills({ sql: base.score, businessLogic: base.score, communication: base.score }) };
}

async function submitTask(userId, taskId, sql) {
  const enrollment = getEnrollment(userId);
  if (!enrollment) throw new Error('Not enrolled');
  const task = db.prepare('SELECT * FROM sim_tasks WHERE id = ? AND enrollment_id = ?').get(taskId, enrollment.id);
  if (!task) throw new Error('Task not found');
  const taskDef = TASKS[task.task_key];
  if (!taskDef) throw new Error('Unknown task definition');
  if (countTodaysAiUse(enrollment.id).submissions >= DAILY_AI_LIMITS.submissions) {
    throw new Error(`You've hit today's limit of ${DAILY_AI_LIMITS.submissions} graded submissions. Come back tomorrow — your work is saved.`);
  }

  const submittedResult = runPracticeQuery(sql); // throws on invalid/unsafe SQL
  const referenceResult = runPracticeQuery(taskDef.referenceSql);

  const { score, feedback, skills } = await gradeSubmission(taskDef, sql, submittedResult, referenceResult);

  db.prepare(`
    UPDATE sim_tasks SET status = 'graded', submission = ?, score = ?, feedback = ?, skills_json = ?, submitted_at = ?, graded_at = ?
    WHERE id = ?
  `).run(sql, score, feedback, JSON.stringify(skills), now(), now(), taskId);

  addMessage(enrollment.id, 'learner', 'You', `Submitted:\n${sql}`, taskId);
  addMessage(enrollment.id, 'line_manager', LINE_MANAGER_NAME, feedback, taskId);

  return { score, feedback, result: submittedResult };
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
  sendLearnerMessage,
  toggleChecklistItem,
  startProject,
};
