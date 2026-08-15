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
