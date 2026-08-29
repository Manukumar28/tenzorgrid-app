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

CREATE TABLE IF NOT EXISTS sim_attendance (
  id TEXT PRIMARY KEY,
  enrollment_id TEXT NOT NULL REFERENCES sim_enrollments(id) ON DELETE CASCADE,
  attended_on TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(enrollment_id, attended_on)
);
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
ensureColumn('sim_tasks', 'priority', 'TEXT');
ensureColumn('sim_tasks', 'due_at', 'TEXT');

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
