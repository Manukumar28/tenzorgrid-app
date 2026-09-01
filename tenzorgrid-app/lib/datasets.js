// Practice datasets for the Virtual Workspace.
//
// WHY THIS IS GENERATED CODE AND NOT AI-GENERATED-AT-RUNTIME DATA
// ----------------------------------------------------------------
// A learner's SQL is graded by running their query AND the task's reference query
// against the SAME database and comparing results. That only works if the data is
// identical on both runs — so the data must be deterministic.
//
// So the AI's job is done at AUTHORING time (designing the schema, the realistic
// value distributions, the deliberate quirks worth discovering), and the generation
// itself is a seeded pseudo-random function. Same seed in, byte-identical rows out,
// every time, on every machine, forever. That gives us the volume and realism of
// generated data with the verifiability of a fixed fixture — and it costs nothing
// per run, which matters given the AI budget.
//
// Every dataset is built fresh in an isolated in-memory node:sqlite database for each
// execution. It NEVER touches tenzorgrid.db (real users, sessions, password hashes).

const { DatabaseSync } = require('node:sqlite');

// Mulberry32 — small, fast, well-distributed 32-bit PRNG. Any seeded generator would
// do; what matters is that it is pure and stable across Node versions (Math.random
// is neither, which is exactly why we can't use it here).
function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const intBetween = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));

// Rounded to the nearest `step` so salaries look like salaries (1,450,000) rather
// than like generator output (1,447,332).
const roundTo = (n, step) => Math.round(n / step) * step;

const FIRST_NAMES = [
  'Ananya', 'Rohan', 'Kavya', 'Arjun', 'Priya', 'Karthik', 'Ishita', 'Aditya',
  'Meera', 'Rahul', 'Sneha', 'Vivaan', 'Diya', 'Aarav', 'Sanya', 'Ibrahim',
  'Nithya', 'Farhan', 'Lakshmi', 'Tanvi', 'Zoya', 'Dev', 'Anjali', 'Siddharth',
  'Riya', 'Manish', 'Pooja', 'Varun', 'Neelam', 'Yash', 'Aisha', 'Gaurav',
];
const LAST_NAMES = [
  'Iyer', 'Mehta', 'Reddy', 'Nair', 'Menon', 'Rao', 'Shah', 'Kapoor', 'Pillai',
  'Verma', 'Joshi', 'Malhotra', 'Chandra', 'Bose', 'Kulkarni', 'Sheikh', 'Desai',
  'Banerjee', 'Krishnan', 'Ahuja', 'Sinha', 'Chopra',
];

function nameFor(rng) {
  return `${pick(rng, FIRST_NAMES)} ${pick(rng, LAST_NAMES)}`;
}

// ---------------------------------------------------------------------------
// Dataset: hr_core
//
// The people dataset behind the compensation and headcount projects. Two tables so
// that a learner has to JOIN to answer anything about cost centres — a single flat
// table teaches nothing about relational thinking.
//
// Deliberate quirks, authored on purpose because finding them IS the analysis:
//   - Support is genuinely underpaid relative to every other function.
//   - A handful of Senior Engineers out-earn their own Engineering Manager.
//   - Two departments have identical headcount but very different payroll.
//   - `exit_year` is NULL for current staff, so any headcount question that ignores
//     it silently counts leavers. That is the single most common real-world error.
// ---------------------------------------------------------------------------

const DEPARTMENTS = [
  { id: 1, name: 'Engineering', cost_center: 'CC-1001', band_low: 1200000, band_high: 3000000 },
  { id: 2, name: 'Sales', cost_center: 'CC-2001', band_low: 900000, band_high: 2100000 },
  { id: 3, name: 'Marketing', cost_center: 'CC-2002', band_low: 800000, band_high: 1800000 },
  { id: 4, name: 'Support', cost_center: 'CC-3001', band_low: 550000, band_high: 1200000 },
  { id: 5, name: 'Finance', cost_center: 'CC-4001', band_low: 1100000, band_high: 2400000 },
  { id: 6, name: 'People Ops', cost_center: 'CC-4002', band_low: 850000, band_high: 1900000 },
];

const ROLES_BY_DEPT = {
  Engineering: ['Software Engineer', 'Software Engineer', 'Senior Engineer', 'Staff Engineer', 'Engineering Manager'],
  Sales: ['Account Executive', 'Account Executive', 'Senior Account Executive', 'Sales Manager'],
  Marketing: ['Marketing Specialist', 'Content Strategist', 'Marketing Manager'],
  Support: ['Support Agent', 'Support Agent', 'Support Lead', 'Support Manager'],
  Finance: ['Financial Analyst', 'Senior Analyst', 'Finance Manager'],
  'People Ops': ['Recruiter', 'HR Business Partner', 'People Ops Manager'],
};

// Seniority multiplier applied within a department's band. Managers sit high, but not
// so high that the "senior IC out-earns their manager" quirk disappears.
const SENIORITY = {
  'Software Engineer': 0.25, 'Senior Engineer': 0.72, 'Staff Engineer': 0.92, 'Engineering Manager': 0.80,
  'Account Executive': 0.22, 'Senior Account Executive': 0.62, 'Sales Manager': 0.85,
  'Marketing Specialist': 0.20, 'Content Strategist': 0.38, 'Marketing Manager': 0.86,
  'Support Agent': 0.18, 'Support Lead': 0.55, 'Support Manager': 0.84,
  'Financial Analyst': 0.28, 'Senior Analyst': 0.60, 'Finance Manager': 0.88,
  Recruiter: 0.24, 'HR Business Partner': 0.52, 'People Ops Manager': 0.87,
};

const LOCATIONS = ['Bengaluru', 'Mumbai', 'Pune', 'Hyderabad', 'Remote'];

function generateHrCore(seed) {
  const rng = makeRng(seed);
  const employees = [];
  let id = 1;

  for (const dept of DEPARTMENTS) {
    // Engineering is the biggest function; Support is deliberately large relative to
    // its payroll so the underpayment shows up as a real finding, not a rounding blip.
    const headcount = dept.name === 'Engineering' ? 18
      : dept.name === 'Support' ? 12
      : dept.name === 'Sales' ? 12
      : intBetween(rng, 7, 9);

    for (let i = 0; i < headcount; i++) {
      const role = pick(rng, ROLES_BY_DEPT[dept.name]);
      const seniority = SENIORITY[role];
      const spread = dept.band_high - dept.band_low;
      // +/- 8% jitter within the band, so two people in the same role differ — which
      // is the entire premise of a pay-equity audit.
      const jitter = (rng() - 0.5) * 0.16;
      const salary = roundTo(dept.band_low + spread * Math.max(0.05, Math.min(1, seniority + jitter)), 10000);

      const hireYear = intBetween(rng, 2016, 2025);
      // ~12% have left. exit_year is NULL for everyone else — the trap described above.
      const hasLeft = rng() < 0.12;
      const exitYear = hasLeft ? Math.min(2025, hireYear + intBetween(rng, 1, 5)) : null;

      employees.push({
        id: id++,
        name: nameFor(rng),
        department_id: dept.id,
        role,
        salary,
        hire_year: hireYear,
        exit_year: exitYear,
        location: pick(rng, LOCATIONS),
      });
    }
  }

  return { departments: DEPARTMENTS, employees };
}

// ---------------------------------------------------------------------------
// Dataset: saas_ops
//
// Clients, incidents and support tickets for the outage / client-recovery scenarios.
// Three tables, so answering "which of our biggest accounts were hurt worst?" needs a
// two-hop JOIN plus an aggregate — genuinely the shape of the work, not a toy.
//
// Deliberate quirks:
//   - The largest incident hit mid-tier clients, not the enterprise ones, so ranking
//     by raw rows_corrupted gives the wrong business answer. Weighting by MRR gives
//     the right one.
//   - resolved_at is NULL for still-open incidents, so any AVG over duration must
//     decide what to do with them.
//   - One client churned already (status = 'churned'); including them in a retention
//     recommendation is a factual error the grader can catch.
// ---------------------------------------------------------------------------

const CLIENT_NAMES = [
  'Northwind Freight', 'Berylline Retail', 'Cobalt Health', 'Dunmore Legal',
  'Everline Media', 'Ferrous Manufacturing', 'Glasshouse Hotels', 'Harborview Bank',
  'Ionic Robotics', 'Juniper Foods', 'Keystone Insurance', 'Lattice Education',
  'Meridian Transport', 'Nimbus Analytics', 'Orchid Pharma', 'Pinehill Realty',
];
const TIERS = [
  { tier: 'Enterprise', mrr_low: 180000, mrr_high: 420000, weight: 4 },
  { tier: 'Growth', mrr_low: 60000, mrr_high: 175000, weight: 6 },
  { tier: 'Starter', mrr_low: 12000, mrr_high: 55000, weight: 6 },
];
const SERVICES = ['api-gateway', 'billing-sync', 'report-builder', 'data-export', 'auth-service'];
const SEVERITIES = ['SEV1', 'SEV2', 'SEV3'];
const TICKET_STATUS = ['open', 'pending', 'resolved', 'resolved', 'resolved'];
const TICKET_PRIORITY = ['urgent', 'high', 'normal', 'normal', 'low'];

function pad(n) { return String(n).padStart(2, '0'); }
function isoDay(rng, month, dayLo, dayHi, hourLo, hourHi) {
  return `2026-${pad(month)}-${pad(intBetween(rng, dayLo, dayHi))}T${pad(intBetween(rng, hourLo, hourHi))}:${pad(intBetween(rng, 0, 59))}:00Z`;
}

function generateSaasOps(seed) {
  const rng = makeRng(seed);

  const clients = [];
  let ci = 0;
  for (const t of TIERS) {
    for (let i = 0; i < t.weight; i++) {
      const name = CLIENT_NAMES[ci];
      clients.push({
        id: ci + 1,
        company: name,
        tier: t.tier,
        mrr: roundTo(intBetween(rng, t.mrr_low, t.mrr_high), 1000),
        signed_year: intBetween(rng, 2018, 2025),
        // Exactly one churned account, always the same one for a given seed.
        status: ci === 11 ? 'churned' : 'active',
        csm_name: nameFor(rng),
      });
      ci++;
    }
  }

  const incidents = [];
  let ii = 1;
  for (const client of clients) {
    // Most accounts got hit — a blast radius of two or three clients is not an
    // analysis, it is a list. The churned account is FORCED to have at least one
    // incident, otherwise filtering on status='active' changes nothing and the
    // "don't compensate a client who already left" trap is decorative.
    const count = client.status === 'churned'
      ? intBetween(rng, 1, 3)
      : (rng() < 0.25 ? 0 : intBetween(rng, 1, 4));
    for (let k = 0; k < count; k++) {
      const severity = pick(rng, SEVERITIES);
      const started = isoDay(rng, intBetween(rng, 5, 8), 1, 28, 0, 23);
      const stillOpen = rng() < 0.15;
      // Growth-tier accounts take the heaviest data damage — the quirk that makes
      // "rank by rows_corrupted" the wrong business answer.
      const damageBase = client.tier === 'Growth' ? 90000 : 25000;
      incidents.push({
        id: ii++,
        client_id: client.id,
        service: pick(rng, SERVICES),
        severity,
        started_at: started,
        resolved_at: stillOpen ? null : started.replace(/T\d\d/, `T${pad(intBetween(rng, 0, 23))}`),
        rows_corrupted: severity === 'SEV1' ? intBetween(rng, damageBase, damageBase * 3) : intBetween(rng, 500, damageBase),
      });
    }
  }

  const tickets = [];
  let ti = 1;
  for (const client of clients) {
    const count = intBetween(rng, 2, 9);
    for (let k = 0; k < count; k++) {
      tickets.push({
        id: ti++,
        client_id: client.id,
        opened_at: isoDay(rng, intBetween(rng, 5, 8), 1, 28, 8, 20),
        status: pick(rng, TICKET_STATUS),
        priority: pick(rng, TICKET_PRIORITY),
        subject: `${pick(rng, ['Data mismatch in', 'Cannot export from', 'Slow response on', 'Login failure on', 'Missing records in'])} ${pick(rng, SERVICES)}`,
      });
    }
  }

  return { clients, incidents, tickets };
}

// ---------------------------------------------------------------------------
// Registry
//
// `seed` is fixed per dataset, NOT per learner. Two learners on the same task see the
// same numbers, which is what lets a task have one authored reference answer and lets
// two learners compare notes without one of them being wrong.
// ---------------------------------------------------------------------------

const DATASETS = {
  hr_core: {
    key: 'hr_core',
    label: 'HR Core',
    description: 'Employee, compensation and headcount records for the whole company.',
    seed: 20260901,
    tables: [
      {
        name: 'departments',
        note: 'One row per function, with its cost centre and salary band.',
        columns: [
          { name: 'id', type: 'INTEGER', note: 'Primary key' },
          { name: 'name', type: 'TEXT' },
          { name: 'cost_center', type: 'TEXT' },
          { name: 'band_low', type: 'INTEGER', note: 'Bottom of the salary band' },
          { name: 'band_high', type: 'INTEGER', note: 'Top of the salary band' },
        ],
      },
      {
        name: 'employees',
        note: 'One row per person ever hired. exit_year is NULL for current staff.',
        columns: [
          { name: 'id', type: 'INTEGER', note: 'Primary key' },
          { name: 'name', type: 'TEXT' },
          { name: 'department_id', type: 'INTEGER', note: 'References departments.id' },
          { name: 'role', type: 'TEXT' },
          { name: 'salary', type: 'INTEGER', note: 'Annual, in INR' },
          { name: 'hire_year', type: 'INTEGER' },
          { name: 'exit_year', type: 'INTEGER', note: 'NULL if still employed' },
          { name: 'location', type: 'TEXT' },
        ],
      },
    ],
    schema: `
      CREATE TABLE departments (
        id INTEGER PRIMARY KEY, name TEXT NOT NULL, cost_center TEXT NOT NULL,
        band_low INTEGER NOT NULL, band_high INTEGER NOT NULL
      );
      CREATE TABLE employees (
        id INTEGER PRIMARY KEY, name TEXT NOT NULL, department_id INTEGER NOT NULL,
        role TEXT NOT NULL, salary INTEGER NOT NULL, hire_year INTEGER NOT NULL,
        exit_year INTEGER, location TEXT NOT NULL
      );
    `,
    generate: generateHrCore,
  },

  saas_ops: {
    key: 'saas_ops',
    label: 'SaaS Operations',
    description: 'Client accounts, platform incidents and support tickets.',
    seed: 20260902,
    tables: [
      {
        name: 'clients',
        note: 'Customer accounts. status is active or churned.',
        columns: [
          { name: 'id', type: 'INTEGER', note: 'Primary key' },
          { name: 'company', type: 'TEXT' },
          { name: 'tier', type: 'TEXT', note: 'Enterprise, Growth or Starter' },
          { name: 'mrr', type: 'INTEGER', note: 'Monthly recurring revenue, INR' },
          { name: 'signed_year', type: 'INTEGER' },
          { name: 'status', type: 'TEXT' },
          { name: 'csm_name', type: 'TEXT', note: 'Customer success manager' },
        ],
      },
      {
        name: 'incidents',
        note: 'Platform outages. resolved_at is NULL while still open.',
        columns: [
          { name: 'id', type: 'INTEGER', note: 'Primary key' },
          { name: 'client_id', type: 'INTEGER', note: 'References clients.id' },
          { name: 'service', type: 'TEXT' },
          { name: 'severity', type: 'TEXT', note: 'SEV1 is most severe' },
          { name: 'started_at', type: 'TEXT', note: 'ISO 8601 timestamp' },
          { name: 'resolved_at', type: 'TEXT', note: 'NULL if unresolved' },
          { name: 'rows_corrupted', type: 'INTEGER' },
        ],
      },
      {
        name: 'tickets',
        note: 'Support tickets raised by clients.',
        columns: [
          { name: 'id', type: 'INTEGER', note: 'Primary key' },
          { name: 'client_id', type: 'INTEGER', note: 'References clients.id' },
          { name: 'opened_at', type: 'TEXT' },
          { name: 'status', type: 'TEXT', note: 'open, pending or resolved' },
          { name: 'priority', type: 'TEXT', note: 'urgent, high, normal or low' },
          { name: 'subject', type: 'TEXT' },
        ],
      },
    ],
    schema: `
      CREATE TABLE clients (
        id INTEGER PRIMARY KEY, company TEXT NOT NULL, tier TEXT NOT NULL,
        mrr INTEGER NOT NULL, signed_year INTEGER NOT NULL, status TEXT NOT NULL,
        csm_name TEXT NOT NULL
      );
      CREATE TABLE incidents (
        id INTEGER PRIMARY KEY, client_id INTEGER NOT NULL, service TEXT NOT NULL,
        severity TEXT NOT NULL, started_at TEXT NOT NULL, resolved_at TEXT,
        rows_corrupted INTEGER NOT NULL
      );
      CREATE TABLE tickets (
        id INTEGER PRIMARY KEY, client_id INTEGER NOT NULL, opened_at TEXT NOT NULL,
        status TEXT NOT NULL, priority TEXT NOT NULL, subject TEXT NOT NULL
      );
    `,
    generate: generateSaasOps,
  },
};

const DEFAULT_DATASET = 'hr_core';

function getDataset(key) {
  return DATASETS[key] || DATASETS[DEFAULT_DATASET];
}

// Builds a fresh, isolated in-memory database for one execution. Callers MUST close it
// (see runQuery's finally block) — one of these is created per query run.
function buildDatasetDb(key) {
  const def = getDataset(key);
  const mem = new DatabaseSync(':memory:');
  mem.exec(def.schema);
  const data = def.generate(def.seed);

  for (const table of def.tables) {
    const rows = data[table.name] || [];
    if (!rows.length) continue;
    const cols = table.columns.map((c) => c.name);
    const stmt = mem.prepare(
      `INSERT INTO ${table.name} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`
    );
    for (const row of rows) stmt.run(...cols.map((c) => (row[c] === undefined ? null : row[c])));
  }
  return mem;
}

// What the schema browser in the workbench renders. Row counts come from actually
// counting the built database rather than from the generator's intent, so the panel
// can never drift from the data a query will really see.
function describeDataset(key) {
  const def = getDataset(key);
  const mem = buildDatasetDb(key);
  try {
    return {
      key: def.key,
      label: def.label,
      description: def.description,
      tables: def.tables.map((t) => ({
        name: t.name,
        note: t.note || null,
        rowCount: mem.prepare(`SELECT COUNT(*) AS c FROM ${t.name}`).get().c,
        columns: t.columns.map((c) => ({ name: c.name, type: c.type, note: c.note || null })),
      })),
    };
  } finally {
    mem.close();
  }
}

module.exports = { DATASETS, DEFAULT_DATASET, getDataset, buildDatasetDb, describeDataset, makeRng };
