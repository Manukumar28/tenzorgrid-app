// Persistence layer. Uses Node's built-in node:sqlite (no external DB driver needed).
// Requires Node >= 22.5.

const path = require('node:path');
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');

// DATA_DIR can be overridden with an env var so a hosting platform's persistent
// volume (e.g. Railway, Fly.io, Render) can be mounted somewhere and pointed to here.
// Without it, data is stored locally under ./data — fine for local dev, but NOT
// persistent on hosts with an ephemeral filesystem (data disappears on redeploy).
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'tenzorgrid.db');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  dob TEXT,
  gender TEXT,
  profession TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  name TEXT,
  current_role TEXT,
  experience_years REAL,
  current_salary REAL,
  expected_salary REAL,
  relocation TEXT,
  notes TEXT,
  skills_json TEXT,
  cv_filename TEXT,
  cv_stored_name TEXT,
  cv_mime TEXT,
  photo_data_url TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS experiences (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization TEXT NOT NULL,
  role TEXT NOT NULL,
  achievements TEXT,
  start_year INTEGER,
  end_year INTEGER,
  is_current INTEGER NOT NULL DEFAULT 0,
  salary REAL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  portal TEXT NOT NULL,
  location TEXT,
  required_skills_json TEXT NOT NULL,
  salary_min REAL,
  salary_max REAL,
  posted_at TEXT
);

CREATE TABLE IF NOT EXISTS certifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  issuer TEXT NOT NULL,
  issue_year INTEGER,
  expiry_year INTEGER,
  credential_id TEXT,
  credential_url TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS education (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  institution TEXT NOT NULL,
  degree TEXT NOT NULL,
  field_of_study TEXT,
  start_year INTEGER,
  end_year INTEGER,
  is_current INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

-- Caches AI-generated job summaries/skills keyed by the source posting's external_id,
-- so a posting that reappears across daily syncs is never re-sent to the AI —
-- this is the thing that keeps AI usage bounded to "once per posting ever seen".
CREATE TABLE IF NOT EXISTS job_ai_cache (
  external_id TEXT PRIMARY KEY,
  summary TEXT,
  skills_json TEXT,
  nice_to_have_json TEXT,
  created_at TEXT NOT NULL
);

-- ---- Virtual Workspace (Career Growth Phase 1) ----
-- P0 scope: one enrollment per user, one role (Data Analyst), IC track only.
-- No payment wiring yet (/api/subscribe is still the dev-mode stub) — enrollment
-- status just tracks 'trial' vs 'active' so the billing gate can be added later
-- without a schema change.
CREATE TABLE IF NOT EXISTS sim_enrollments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  level TEXT NOT NULL,
  track TEXT NOT NULL,
  schedule_type TEXT NOT NULL,
  schedule_days_json TEXT,
  status TEXT NOT NULL DEFAULT 'trial',
  trial_ends_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sim_tasks (
  id TEXT PRIMARY KEY,
  enrollment_id TEXT NOT NULL REFERENCES sim_enrollments(id) ON DELETE CASCADE,
  task_key TEXT NOT NULL,
  title TEXT NOT NULL,
  brief TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'assigned',
  submission TEXT,
  score INTEGER,
  feedback TEXT,
  assigned_at TEXT NOT NULL,
  submitted_at TEXT,
  graded_at TEXT
);

CREATE TABLE IF NOT EXISTS sim_messages (
  id TEXT PRIMARY KEY,
  enrollment_id TEXT NOT NULL REFERENCES sim_enrollments(id) ON DELETE CASCADE,
  sender_archetype TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  body TEXT NOT NULL,
  task_id TEXT,
  created_at TEXT NOT NULL
);

-- One row per project a learner has started: when their week began, when it is due,
-- and how far the deadline pressure has escalated. Derived state would lose the
-- escalation history, and "have we already emailed them about this?" has to be durable
-- or the learner gets the same chase every time the page loads.
CREATE TABLE IF NOT EXISTS sim_project_runs (
  id TEXT PRIMARY KEY,
  enrollment_id TEXT NOT NULL REFERENCES sim_enrollments(id) ON DELETE CASCADE,
  project_key TEXT NOT NULL,
  started_at TEXT NOT NULL,
  due_at TEXT NOT NULL,
  nudge_level INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT,
  UNIQUE(enrollment_id, project_key)
);

-- Who the learner has actually talked to, and who has become a friend. Friendship is
-- earned by talking rather than clicked: a colleague you have exchanged a few messages
-- with will give you a real hint on the task you are stuck on, one you have never spoken
-- to gives you a polite brush-off. That is how it works in an office.
CREATE TABLE IF NOT EXISTS sim_contacts (
  id TEXT PRIMARY KEY,
  enrollment_id TEXT NOT NULL REFERENCES sim_enrollments(id) ON DELETE CASCADE,
  archetype TEXT NOT NULL,
  messages_sent INTEGER NOT NULL DEFAULT 0,
  friends_at TEXT,
  last_at TEXT,
  UNIQUE(enrollment_id, archetype)
);

CREATE TABLE IF NOT EXISTS sim_standups (
  id TEXT PRIMARY KEY,
  enrollment_id TEXT NOT NULL REFERENCES sim_enrollments(id) ON DELETE CASCADE,
  stood_up_on TEXT NOT NULL,
  answers_json TEXT NOT NULL,
  spoken INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  UNIQUE(enrollment_id, stood_up_on)
);

CREATE TABLE IF NOT EXISTS sim_attendance (
  id TEXT PRIMARY KEY,
  enrollment_id TEXT NOT NULL REFERENCES sim_enrollments(id) ON DELETE CASCADE,
  attended_on TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(enrollment_id, attended_on)
);

-- ---- The rest of a working day (content model v1) ----
-- These four tables hold a learner's RECORD of activities, quiz questions, situations and
-- the people they have met. The content itself — which activities exist, what the questions
-- are, what mail a project sends — lives in code, exactly as tasks do: sim_tasks is a
-- learner's copy of a task, not the task library. Same split here, for the same reason.
-- Authored content has to be deterministic and reviewable in a diff; only what a specific
-- learner did belongs in the database.

-- One row per activity offered to a learner on a given day. Two anchors are offered every
-- working day; one rotating activity is drawn from the level's pool. Keyed by DATE rather
-- than by project day, because the anchors span projects and the rotation is what stops a
-- week repeating itself.
CREATE TABLE IF NOT EXISTS sim_activities (
  id TEXT PRIMARY KEY,
  enrollment_id TEXT NOT NULL REFERENCES sim_enrollments(id) ON DELETE CASCADE,
  activity_key TEXT NOT NULL,
  project_run_id TEXT,
  day_index INTEGER,
  assigned_on TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  -- Null for the many activities that are simply done or not done. Only the ones worth
  -- judging (mentoring, a written handover) carry a number, and it feeds the conduct
  -- score, never the project score.
  score INTEGER,
  payload_json TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(enrollment_id, activity_key, assigned_on)
);

-- A learner sees each question once and never again, which is what UNIQUE on
-- (enrollment_id, question_key) enforces. A bank that repeats itself teaches recall of the
-- bank rather than of the subject.
CREATE TABLE IF NOT EXISTS sim_quiz (
  id TEXT PRIMARY KEY,
  enrollment_id TEXT NOT NULL REFERENCES sim_enrollments(id) ON DELETE CASCADE,
  question_key TEXT NOT NULL,
  project_key TEXT,
  answered_on TEXT NOT NULL,
  chosen TEXT,
  correct INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  UNIQUE(enrollment_id, question_key)
);

-- Something that happened which the learner did not plan for: the stakeholder adding to the
-- brief, Finance wanting a number by three, a meeting invite, or a timesheet reminder that
-- deserves no reply at all. handled_as records what they did with it — including
-- 'ignored', because silence has to be a recorded choice for it to cost anything.
CREATE TABLE IF NOT EXISTS sim_situations (
  id TEXT PRIMARY KEY,
  enrollment_id TEXT NOT NULL REFERENCES sim_enrollments(id) ON DELETE CASCADE,
  situation_key TEXT NOT NULL,
  project_run_id TEXT,
  message_id TEXT,
  delivered_at TEXT,
  handled_as TEXT,
  handled_at TEXT,
  score INTEGER,
  created_at TEXT NOT NULL,
  UNIQUE(enrollment_id, situation_key)
);

-- Who this learner has actually worked with. A project declares the cast it needs and those
-- people are written here when the run starts, so the Team tab shows the people on THIS
-- project rather than a fixed org chart — and so somebody met in week one is still
-- recognised in week nine.
CREATE TABLE IF NOT EXISTS sim_cast (
  id TEXT PRIMARY KEY,
  enrollment_id TEXT NOT NULL REFERENCES sim_enrollments(id) ON DELETE CASCADE,
  project_run_id TEXT,
  archetype TEXT NOT NULL,
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  met_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(enrollment_id, project_run_id, archetype)
);

-- Ambient company mail. The all-hands invite, the VPN maintenance window, the newsletter.
-- None of it needs anything from the learner; it exists so the inbox has something to
-- ignore, because triage cannot be practised on an inbox where every message matters.
-- Only the fact of delivery is stored -- the body lives in code like every other piece of
-- content -- so that a page refresh does not send Thursday's all-hands invite twice.
CREATE TABLE IF NOT EXISTS sim_ambient_mail (
  id TEXT PRIMARY KEY,
  enrollment_id TEXT NOT NULL REFERENCES sim_enrollments(id) ON DELETE CASCADE,
  project_run_id TEXT,
  mail_key TEXT NOT NULL,
  day_index INTEGER,
  message_id TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(enrollment_id, project_run_id, mail_key)
);

-- One row per working day the learner has closed.
--
-- A day used to end by simply not having anything left in it, which meant the moment a
-- learner finished their sixth task the product rolled them into tomorrow without ever
-- saying well done. Closing a day is now something the learner DOES, and this is where it
-- is recorded -- so the congratulation has somewhere to live, and so nothing advances on
-- its own.
CREATE TABLE IF NOT EXISTS sim_days (
  id TEXT PRIMARY KEY,
  enrollment_id TEXT NOT NULL REFERENCES sim_enrollments(id) ON DELETE CASCADE,
  project_run_id TEXT,
  day_index INTEGER NOT NULL,
  closed_at TEXT,
  started_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(enrollment_id, project_run_id, day_index)
);

-- The small compulsory things a job is made of: the timesheet, the policy tick, the desk
-- booking. Not graded and they gate nothing -- they exist because a reminder that
-- timesheets close on Friday is only realistic if there is somewhere to go and log them.
CREATE TABLE IF NOT EXISTS sim_chores (
  id TEXT PRIMARY KEY,
  enrollment_id TEXT NOT NULL REFERENCES sim_enrollments(id) ON DELETE CASCADE,
  project_run_id TEXT,
  chore_key TEXT NOT NULL,
  day_index INTEGER,
  message_id TEXT,
  values_json TEXT,
  done_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(enrollment_id, chore_key)
);

CREATE INDEX IF NOT EXISTS idx_sim_chores_run ON sim_chores(enrollment_id, project_run_id);
CREATE INDEX IF NOT EXISTS idx_sim_days_run ON sim_days(enrollment_id, project_run_id);
CREATE INDEX IF NOT EXISTS idx_sim_ambient_run ON sim_ambient_mail(enrollment_id, project_run_id);
CREATE INDEX IF NOT EXISTS idx_sim_activities_day ON sim_activities(enrollment_id, assigned_on);
CREATE INDEX IF NOT EXISTS idx_sim_situations_run ON sim_situations(enrollment_id, project_run_id);
CREATE INDEX IF NOT EXISTS idx_sim_cast_run ON sim_cast(enrollment_id, project_run_id);
`);

// Safe migration helper for columns added after the DB was first created
// (e.g. on the live Railway volume, which already has a users/profiles table
// without these columns). SQLite errors if the column already exists — we
// just ignore that specific case.
function ensureColumn(table, column, declaration) {
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${declaration}`);
  } catch (e) {
    if (!/duplicate column name/i.test(e.message)) throw e;
  }
}
ensureColumn('users', 'dob', 'TEXT');
ensureColumn('users', 'gender', 'TEXT');
ensureColumn('users', 'profession', 'TEXT');
ensureColumn('profiles', 'photo_data_url', 'TEXT');
ensureColumn('users', 'is_pro', 'INTEGER DEFAULT 0');
ensureColumn('jobs', 'apply_url', 'TEXT');
ensureColumn('jobs', 'external_id', 'TEXT');
ensureColumn('jobs', 'source', 'TEXT');
ensureColumn('jobs', 'description', 'TEXT');
ensureColumn('jobs', 'nice_to_have_skills_json', 'TEXT');
ensureColumn('jobs', 'source_domain', 'TEXT');
ensureColumn('jobs', 'core_role', 'TEXT');
ensureColumn('jobs', 'summary', 'TEXT');
ensureColumn('sim_messages', 'subject', 'TEXT');
ensureColumn('sim_tasks', 'est_hours', 'REAL');
ensureColumn('sim_messages', 'thread_archetype', 'TEXT');
ensureColumn('sim_tasks', 'skills_json', 'TEXT');
ensureColumn('sim_enrollments', 'checklist_json', 'TEXT');

// The entry skill test: the learner's starting point, taken before the first project so
// the skill matrix has something to measure improvement against. Stored as one JSON blob
// rather than five columns because it is written once and always read whole.
ensureColumn('sim_enrollments', 'baseline_json', 'TEXT');
ensureColumn('sim_enrollments', 'baseline_at', 'TEXT');

// Promotion: when the learner cleared the junior track, and whether they have already
// been told they fell short. Both are durable because a promotion is an event, not a
// derived flag — and because "have we already had this conversation?" must survive a
// page reload.
ensureColumn('sim_enrollments', 'promoted_at', 'TEXT');
ensureColumn('sim_enrollments', 'promotion_told_at', 'TEXT');
// When the promotion conversation was OPENED, which now happens a project before the
// decision rather than at the same moment as it. Cleared on every promotion, because the
// next rung has its own conversation.
ensureColumn('sim_enrollments', 'promotion_opened_at', 'TEXT');
ensureColumn('sim_tasks', 'priority', 'TEXT');
ensureColumn('sim_tasks', 'due_at', 'TEXT');
ensureColumn('sim_messages', 'read_at', 'TEXT');
// The verification gate. A task is only DONE when the line manager has questioned the
// learner about it and accepted the answer — so `status` gains 'in_review' and 'parked'
// between 'submitted' and 'graded'. Rows written before this shipped have review_state
// NULL and are treated as already accepted, so no existing progress is undone.
ensureColumn('sim_tasks', 'review_state', 'TEXT');
ensureColumn('sim_tasks', 'review_rounds', 'INTEGER');
ensureColumn('sim_tasks', 'review_question', 'TEXT');
// A project runs as a five-working-day week, so a task belongs to a day and only opens
// when that day arrives. Rows written before this have day_index NULL and open
// immediately, which is exactly how they behaved before.
ensureColumn('sim_tasks', 'day_index', 'INTEGER');
ensureColumn('sim_tasks', 'opens_at', 'TEXT');
ensureColumn('sim_tasks', 'difficulty', 'TEXT');
ensureColumn('sim_messages', 'starred', 'INTEGER');

// A project can now run past its five days rather than simply being late: unfinished work
// carries into the next day and the deadline moves with it. `extended_days` is what the
// score decay is calculated from, and `carried_from_day` records that a task was not
// originally today's — both written by later work, declared here so the shape of the model
// is in one place.
ensureColumn('sim_project_runs', 'extended_days', 'INTEGER');
ensureColumn('sim_tasks', 'carried_from_day', 'INTEGER');
// Activities and situations are judged separately from the project. Mixing them would mean
// a learner who did excellent analysis and ignored every email scored the same as one who
// did both — and the second is the employable one.
ensureColumn('sim_enrollments', 'conduct_score', 'INTEGER');
// Added after sim_days shipped, so a live volume that already has the table gets it too.
ensureColumn('sim_days', 'started_at', 'TEXT');

// Seed a small starter set of jobs the first time the DB is created, so the
// dashboard has something real (if modest) to match against on day one.
// This is a stand-in for the future real job-aggregation feature.
const jobCount = db.prepare('SELECT COUNT(*) as c FROM jobs').get().c;
if (jobCount === 0) {
  const insertJob = db.prepare(`
    INSERT INTO jobs (id, title, company, portal, location, required_skills_json, salary_min, salary_max, posted_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const seed = [
    ['Senior Frontend Engineer', 'Nimbus Cloud', 'LinkedIn', 'Bengaluru (Hybrid)', ['JavaScript', 'React', 'TypeScript', 'CSS'], 1800000, 2600000],
    ['Product Engineer', 'Fintra', 'Naukri', 'Remote', ['React', 'Node.js', 'SQL', 'REST APIs'], 1600000, 2400000],
    ['Full Stack Developer', 'Orbitly', 'Indeed', 'Pune (Hybrid)', ['JavaScript', 'React', 'Node.js', 'MongoDB'], 1400000, 2000000],
    ['Software Engineer II', 'Vectra Labs', 'LinkedIn', 'Remote', ['System design', 'Kubernetes', 'Java', 'SQL'], 2000000, 3000000],
    ['Backend Engineer', 'Northgate', 'Naukri', 'Hyderabad', ['Go', 'Distributed systems', 'gRPC', 'SQL'], 1800000, 2700000],
    ['React Developer', 'Fablo', 'Company career page', 'Remote', ['React', 'TypeScript', 'Testing (Jest)', 'CSS'], 1200000, 1800000],
    ['Platform Engineer', 'Ridgeline', 'Company career page', 'Bengaluru', ['Kubernetes', 'Terraform', 'AWS', 'CI/CD'], 2200000, 3200000],
    ['DevOps Engineer', 'Corewave', 'Company career page', 'Remote', ['AWS', 'Docker', 'CI/CD', 'Linux'], 1700000, 2500000],
    ['Engineering Manager', 'Haloform', 'LinkedIn', 'Bengaluru', ['Leadership', 'System design', 'Node.js', 'SQL'], 3000000, 4200000],
    ['QA Lead', 'Marbletree', 'Indeed', 'Remote', ['Testing (Jest)', 'Automation', 'CI/CD', 'SQL'], 1500000, 2100000],
  ];
  for (const [title, company, portal, location, skills, min, max] of seed) {
    insertJob.run(
      cryptoRandomId(), title, company, portal, location,
      JSON.stringify(skills), min, max, new Date().toISOString()
    );
  }
}

function cryptoRandomId() {
  return require('node:crypto').randomBytes(12).toString('hex');
}

module.exports = { db, UPLOADS_DIR, cryptoRandomId };
