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
  },
};

function now() { return new Date().toISOString(); }
function today() { return new Date().toISOString().slice(0, 10); }

function getEnrollment(userId) {
  return db.prepare('SELECT * FROM sim_enrollments WHERE user_id = ? ORDER BY created_at DESC LIMIT 1').get(userId);
}

function addMessage(enrollmentId, senderArchetype, senderName, body, taskId) {
  const id = cryptoRandomId();
  db.prepare(`
    INSERT INTO sim_messages (id, enrollment_id, sender_archetype, sender_name, body, task_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, enrollmentId, senderArchetype, senderName, body, taskId || null, now());
  return id;
}

function assignTask(enrollmentId, taskKey) {
  const def = TASKS[taskKey];
  if (!def) throw new Error('Unknown task: ' + taskKey);
  const id = cryptoRandomId();
  db.prepare(`
    INSERT INTO sim_tasks (id, enrollment_id, task_key, title, brief, status, assigned_at)
    VALUES (?, ?, ?, ?, ?, 'assigned', ?)
  `).run(id, enrollmentId, taskKey, def.title, def.brief, now());
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
    INSERT INTO sim_enrollments (id, user_id, role, level, track, schedule_type, schedule_days_json, status, trial_ends_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'trial', ?, ?)
  `).run(id, userId, role, level, track, scheduleType, JSON.stringify(scheduleDays || null), trialEndsAt, now());

  addMessage(id, 'people_partner', PEOPLE_PARTNER_NAME,
    `Welcome to TenzorGrid! I'm ${PEOPLE_PARTNER_NAME} from People Ops. You're joining as a ${level === 'senior' ? 'Senior' : 'Junior'} Data Analyst. Your Line Manager is Asha Rao — she'll assign your first task shortly. Ping me any time about policy or onboarding.`);
  addMessage(id, 'line_manager', LINE_MANAGER_NAME,
    `Hi, welcome to the team. Take a bit to settle in — I'll send your first task in a moment.`);

  const taskId = assignTask(id, 'da-001');
  const task = TASKS['da-001'];
  addMessage(id, 'line_manager', LINE_MANAGER_NAME,
    `First task: ${task.title}. ${task.brief}`, taskId);

  return getEnrollment(userId);
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
  return {
    enrollment,
    messages,
    tasks,
    attendance: {
      attendedDays,
      milestoneDays,
      checkedInToday: attendanceRows.some((r) => r.attended_on === today()),
    },
  };
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

Respond with ONLY a JSON object: {"score": <0-100 integer>, "feedback": "<your in-character feedback, first person as Asha>"}`;

async function gradeSubmission(taskDef, submittedSql, submittedResult, referenceResult) {
  const prompt = `Task brief: ${taskDef.brief}

Reference (correct) result:
${JSON.stringify(referenceResult)}

Learner's submitted SQL:
${submittedSql}

Learner's actual result:
${JSON.stringify(submittedResult)}`;

  if (ai.isAvailable()) {
    const text = await ai.callClaude({ system: LINE_MANAGER_GRADING_SYSTEM, prompt, maxTokens: 400 });
    const parsed = ai.extractJson(text);
    if (parsed && typeof parsed.score === 'number' && typeof parsed.feedback === 'string') {
      return { score: Math.max(0, Math.min(100, Math.round(parsed.score))), feedback: parsed.feedback };
    }
  }

  // Deterministic fallback so the loop still works with no AI key configured —
  // same "heuristic when AI is off" pattern the rest of the app already uses.
  const matches = JSON.stringify(submittedResult) === JSON.stringify(referenceResult);
  return matches
    ? { score: 90, feedback: "Correct — that matches what I'd expect. Ship it." }
    : { score: 45, feedback: "That doesn't match what I'm seeing when I run it myself. Check your GROUP BY and sort order, then resubmit." };
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

  const { score, feedback } = await gradeSubmission(taskDef, sql, submittedResult, referenceResult);

  db.prepare(`
    UPDATE sim_tasks SET status = 'graded', submission = ?, score = ?, feedback = ?, submitted_at = ?, graded_at = ?
    WHERE id = ?
  `).run(sql, score, feedback, now(), now(), taskId);

  addMessage(enrollment.id, 'learner', 'You', `Submitted:\n${sql}`, taskId);
  addMessage(enrollment.id, 'line_manager', LINE_MANAGER_NAME, feedback, taskId);

  return { score, feedback, result: submittedResult };
}

module.exports = {
  ROLE_CATALOG,
  startEnrollment,
  getEnrollment,
  getState,
  checkIn,
  submitTask,
  runPracticeQuery,
};
