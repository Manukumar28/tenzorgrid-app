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

const LINE_MANAGER_NAME = 'Asha Rao';
const STAKEHOLDER_NAME = 'Vikram Nair';
const PEOPLE_PARTNER_NAME = 'Neha Kulkarni';

const ROLE_CATALOG = {
  data_analyst: { label: 'Data Analyst', skin: 'Data & Analytics' },
};

// The Team tab roster. Manager-track direct reports get added here once team
// assembly ships (P2) — for the IC track this fixed cast is the whole org chart
// above the learner.
const ROSTER = [
  { archetype: 'line_manager', name: LINE_MANAGER_NAME, title: 'Line Manager' },
  { archetype: 'people_partner', name: PEOPLE_PARTNER_NAME, title: 'People Partner (HR)' },
  { archetype: 'stakeholder', name: STAKEHOLDER_NAME, title: 'Business Stakeholder' },
];

// Archetypes whose messages surface in the Emails tab (external-facing, formal)
// rather than Team Chat (internal). Only Vikram exists in P0; customer/client
// archetypes join this list as later roles add them.
const EMAIL_ARCHETYPES = ['stakeholder'];

const PROJECTS = {
  data_analyst: {
    title: 'Q1 Compensation Review',
    description: "A departmental pay analysis for the leadership team, run out of the Data & Analytics function.",
  },
};

// The five axes the Skill Matrix (Overview tab) reports on. A task only ever moves the
// axes it actually exercises — da-001 is a SQL task, so python/dataViz genuinely stay at
// 0 until a task exists that touches them. No axis is ever synthesized.
const SKILL_AXES = ['sql', 'python', 'dataViz', 'communication', 'businessLogic'];
const SKILL_AXIS_LABEL = { sql: 'SQL', python: 'Python', dataViz: 'Data Viz', communication: 'Communication', businessLogic: 'Business Logic' };

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

// First name + last initial only — real learners, but never a full name or email
// exposed to a stranger peer on the leaderboard.
function displayName(fullName) {
  const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'Learner';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

// Real peers only — no synthesized competitors. A learner training alone just sees
// themself, honestly, rather than a padded-out fake leaderboard.
function getLeaderboard(userId, role) {
  const rows = db.prepare(`
    SELECT se.id as enrollment_id, se.user_id, p.name
    FROM sim_enrollments se
    LEFT JOIN profiles p ON p.user_id = se.user_id
    WHERE se.role = ?
  `).all(role);

  const scored = rows.map((r) => {
    const graded = db.prepare("SELECT score FROM sim_tasks WHERE enrollment_id = ? AND status = 'graded'").all(r.enrollment_id);
    const avgScore = graded.length ? Math.round(graded.reduce((s, t) => s + t.score, 0) / graded.length) : null;
    return { userId: r.user_id, name: displayName(r.name), avgScore, isYou: r.user_id === userId };
  });

  scored.sort((a, b) => (b.avgScore ?? -1) - (a.avgScore ?? -1));
  return scored.slice(0, 5);
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

  const projectDef = PROJECTS[enrollment.role];
  const project = projectDef ? {
    title: projectDef.title,
    description: projectDef.description,
    tasksCompleted: gradedTasks.length,
    tasksTotal: tasks.length,
    files: tasks.filter((t) => t.submission).map((t) => ({
      taskId: t.id, name: t.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.sql',
      title: t.title, submittedAt: t.submitted_at, score: t.score,
    })),
  } : null;

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
    roster: ROSTER,
    emailArchetypes: EMAIL_ARCHETYPES,
    project,
    performance: {
      tasksCompleted: gradedTasks.length,
      tasksTotal: tasks.length,
      avgScore,
      hoursAssigned,
      hoursTarget: 8,
    },
    attendance: {
      attendedDays,
      milestoneDays,
      checkedInToday: attendanceRows.some((r) => r.attended_on === today()),
      days: attendanceRows.map((r) => r.attended_on),
    },
    skillMatrix: getSkillMatrix(gradedTasks),
    scoreHistory,
    leaderboard: getLeaderboard(userId, enrollment.role),
    checklist,
    learningPath: LEARNING_PATH[enrollment.role] || [],
    milestone,
  };
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
};
