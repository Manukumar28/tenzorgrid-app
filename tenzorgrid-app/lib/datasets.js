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

// Names the simulation's own cast already uses.
//
// A generated employee sharing a colleague's name puts that colleague in the table the
// learner is analysing — so the Comms person turns up as an HR Business Partner with a
// salary, and the learner cannot tell whether that is the same person. Phase 11 found this
// in analytics_ops, where the fix was to rename the authored analysts; hr_core draws its
// names at random, so it can produce the collision on any seed and needed a guard instead.
//
// Asha Rao is deliberately absent from this list. She really is the line manager, so her
// appearing in a people dataset is correct rather than a clash.
//
// This is a copy of the roster rather than an import: lib/workspace.js requires this file,
// so reading the cast from there would be a cycle. test/coach-test.js asserts the two stay
// in step, which is the part that actually matters.
const RESERVED_NAMES = new Set([
  'Neha Kulkarni', 'Vikram Nair', 'Rahul Verma', 'Sneha Joshi', 'Arjun Rao',
  'Diya Chandra', 'Meera Pillai', 'Aarav Bose', 'Ishaan Varghese',
  'Ravi Menon', 'Priya Menon', 'Rohan Desai',
]);

// Drawn only when a generated name collides, and drawn in order rather than at random, so
// substituting one does not shift the PRNG by a single step — every salary, hire year and
// exit year in the dataset is byte-identical to what it was before this guard existed.
const SUBSTITUTE_NAMES = [
  'Ritika Vaz', 'Karan Sethi', 'Anusha Rane', 'Vivek Dsouza', 'Tara Fernandes',
  'Rohit Barve', 'Naina Chhabra', 'Aman Tiwari', 'Sonal Wadia', 'Kabir Jaggi',
];

function nameFor(rng, used) {
  const name = `${pick(rng, FIRST_NAMES)} ${pick(rng, LAST_NAMES)}`;
  if (!RESERVED_NAMES.has(name)) return name;
  // Deterministic: the nth collision in a generation always takes the nth substitute.
  const n = used ? used.collisions++ : 0;
  return SUBSTITUTE_NAMES[n % SUBSTITUTE_NAMES.length];
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
  const used = { collisions: 0 };
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
        name: nameFor(rng, used),
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
        // Resolution used to be "the same day, at a random hour", which produced
        // incidents that resolved BEFORE they started and made any duration analysis
        // nonsense. It is now a real elapsed time: one to seventy-two hours after the
        // start, so time-to-resolve is a question the data can actually answer. (Same
        // single random draw as before, so every other generated value is unchanged.)
        resolved_at: stillOpen ? null : addHours(started, intBetween(rng, 1, 72)),
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
// Dataset: product_events
//
// Meridian Systems' own product analytics — who signed up, what they did in their
// first sessions, whether they came back, and what an onboarding experiment did to
// all of it. Four tables, because a product question is never answerable from one:
// "did the new onboarding work?" needs an assignment, an event, a session for the
// platform it happened on, and a user for the cohort it belongs to.
//
// This is a deliberately different analytical domain from hr_core (a snapshot of
// people) and saas_ops (a log of things going wrong). Here the unit of analysis
// moves — sometimes an event, sometimes a session, sometimes a user, sometimes a
// cohort — and choosing the wrong one is the mistake, not a slip in the SQL.
//
// Deliberate quirks, authored on purpose because finding them IS the analysis:
//
//   1. Internal staff are in the data. About 5% of users have an @meridiansystems.com
//      email domain — employees dogfooding the product. They never churn and they use
//      it far more than customers, so every engagement and retention number is wrong
//      until they are excluded. This is the single most common real-world product
//      analytics error.
//
//   2. The funnel is not a funnel. Roughly a third of users were invited into an
//      existing workspace (invited_by_user_id IS NOT NULL), so they never fire
//      workspace_created but do fire data_connected. A naive step-over-step ratio
//      therefore comes out ABOVE 100% at that step. The anomaly is visible; the cause
//      is in the schema.
//
//   3. Sessions of zero seconds. The beacon fires on load and the user leaves, so
//      duration_seconds = 0 — and it happens to 25% of mobile sessions against 11% of
//      web ones. Left in, the mobile average is 540 seconds against web's 625, and
//      mobile looks 14% less engaging. Taken out, mobile is 718 against web's 703 — the
//      sign of the finding flips. Mobile genuinely does activate worse (quirk 6); it
//      does not hold attention worse, and reading the first number as evidence of the
//      second is the trap.
//
//   4. A double-firing event. Mobile app version 4.3.0 (released 6 April, fixed in
//      4.3.1 on 11 May) fires every funnel event twice. Rows per user sits at exactly 2
//      on that version and 1 everywhere else, so COUNT(*) overstates activation and
//      COUNT(DISTINCT user_id) does not. The bug is diagnosable from
//      sessions.app_version, so the learner can explain it and not just notice it.
//
//   5. June is a partial month. Observation stops on 12 June, so June's signup count
//      is 12 days against May's 31. Read as a raw total it looks like the business
//      fell off a cliff; read as a daily rate it is a mild dip. The same censoring
//      makes late-cohort retention uncomputable rather than zero.
//
//   6. Simpson's paradox in the onboarding experiment. onboarding_v2 wins on web AND
//      wins on mobile, but loses overall — because the rollout bucketed on device and
//      pushed far more mobile users into the treatment arm, and mobile converts far
//      worse on both variants. The honest readout is the opposite of the obvious one.
// ---------------------------------------------------------------------------

// Observation window. Signups run from 1 January; the export was taken on the morning
// of 13 June, so 12 June is the last complete day of data.
const PE_LAST_DAY = '2026-06-12';
const PE_MONTHS = [
  { month: 1, days: 31, signups: 88 },
  { month: 2, days: 28, signups: 96 },
  { month: 3, days: 31, signups: 104 },
  { month: 4, days: 30, signups: 128 },
  { month: 5, days: 31, signups: 140 },
  // Twelve days, not thirty-one. Quirk 5 lives here.
  { month: 6, days: 12, signups: 48 },
];

// Acquisition channel, with the weights a mid-market B2B product actually sees.
// Paid search buys the most volume and retains the worst; referral is the reverse.
const PE_CHANNELS = [
  { name: 'organic', weight: 30, retention: 1.00 },
  { name: 'paid_search', weight: 26, retention: 0.55 },
  { name: 'referral', weight: 18, retention: 1.30 },
  { name: 'partner', weight: 14, retention: 1.12 },
  { name: 'outbound', weight: 12, retention: 0.74 },
];

const PE_PLANS = [{ name: 'free', weight: 62 }, { name: 'pro', weight: 27 }, { name: 'business', weight: 11 }];
const PE_COUNTRIES = [
  'India', 'India', 'India', 'United States', 'United States', 'United Kingdom',
  'Germany', 'Singapore', 'Australia', 'Canada', 'United Arab Emirates',
];
const PE_DOMAINS = [
  'gmail.com', 'outlook.com', 'northwind-freight.co', 'berylline.retail', 'cobalthealth.io',
  'dunmorelegal.com', 'everline.media', 'ferrousmfg.com', 'glasshousehotels.com',
  'harborviewbank.com', 'ionicrobotics.ai', 'juniperfoods.co', 'keystone-ins.com',
  'latticeedu.org', 'meridiantransport.co', 'nimbus-analytics.com',
];
// Quirk 1. Staff accounts, indistinguishable except by domain.
const PE_INTERNAL_DOMAIN = 'meridiansystems.com';

const PE_ROUTINE_EVENTS = [
  'dashboard_opened', 'report_viewed', 'report_viewed', 'search_used',
  'export_downloaded', 'settings_changed', 'comment_added',
];

function peWeighted(rng, arr) {
  const total = arr.reduce((s, x) => s + x.weight, 0);
  let r = rng() * total;
  for (const x of arr) { r -= x.weight; if (r <= 0) return x; }
  return arr[arr.length - 1];
}

function peDate(month, day) { return `2026-${pad(month)}-${pad(day)}`; }

// Days between two 'YYYY-MM-DD' strings. Both are UTC midnights, so this is exact.
function peDayDiff(fromDate, toDate) {
  return Math.round((Date.parse(`${toDate}T00:00:00Z`) - Date.parse(`${fromDate}T00:00:00Z`)) / 86400000);
}

function peAddDays(date, n) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
}

function peStamp(rng, date, hourLo, hourHi) {
  return `${date}T${pad(intBetween(rng, hourLo, hourHi))}:${pad(intBetween(rng, 0, 59))}:${pad(intBetween(rng, 0, 59))}Z`;
}

// Shipped releases, so app_version is a fact about when a session happened rather than
// a random label. Quirk 4 needs 4.3.0 to be locatable in time.
function peWebVersion(date) {
  if (date < '2026-02-15') return '3.7.0';
  if (date < '2026-04-10') return '3.8.0';
  return '3.9.0';
}
function peMobileVersion(date) {
  if (date < '2026-03-02') return '4.1.0';
  if (date < '2026-04-06') return '4.2.0';
  if (date < '2026-05-11') return '4.3.0';
  return '4.3.1';
}

// Activation rates per cell. "Activated" means the user reached first_report_run —
// the moment the product has demonstrably done its job once.
//
// Mobile activates at roughly a third of web's rate across the board: that is the
// finding the whole dataset is built around, and it is what makes quirk 6 possible.
const PE_BASE_ACTIVATION = { web: 0.54, mobile: 0.18 };
const PE_EXPERIMENT_ACTIVATION = {
  'web|control': 0.56, 'web|treatment': 0.66,
  'mobile|control': 0.16, 'mobile|treatment': 0.26,
};
// The rollout bucketed on device identifier and enabled the mobile ring first, so the
// arms are badly unbalanced by platform. This is the cause of the paradox.
const PE_TREATMENT_SHARE = { web: 0.24, mobile: 0.64 };
// The experiment ran 1 March to 15 May and then stopped. It is deliberately bounded
// well clear of the end of the data: a readout whose last cohorts are still censored
// tells you about the export date, not about the change. Anyone signing up outside
// these dates saw the old onboarding and is not in experiment_assignments at all.
const PE_EXPERIMENT_FROM = '2026-03-01';
const PE_EXPERIMENT_TO = '2026-05-16';
const PE_EXPERIMENT_KEY = 'onboarding_v2';

function generateProductEvents(seed) {
  const rng = makeRng(seed);

  // --- Phase 1: users -------------------------------------------------------
  // Invitees have to be invited by someone who signed up earlier, so users are built
  // in date order and each invitee picks an inviter from those already created.
  const users = [];
  let uid = 1;
  // Days within a month are drawn and then sorted, so users are created in signup
  // order. That matters for one reason: an invitee must be invited by somebody who was
  // already here, and position in this array is what "already here" means below.
  // `earlier` is the count of users whose signup date is strictly before the one being
  // created, which keeps an invite from travelling backwards in time.
  let earlier = 0;
  for (const m of PE_MONTHS) {
    const days = [];
    for (let i = 0; i < m.signups; i++) days.push(intBetween(rng, 1, m.days));
    days.sort((a, b) => a - b);
    let currentDay = -1;
    for (const day of days) {
      if (day !== currentDay) { earlier = users.length; currentDay = day; }
      const date = peDate(m.month, day);
      const staffRoll = rng() < 0.035;
      // Founders can only exist before there is anyone to be invited by, and a third
      // of everyone else arrives through an invite to an existing workspace (quirk 2).
      const wantsInvite = earlier > 12 && !staffRoll && rng() < 0.33;
      const inviter = wantsInvite
        ? users[intBetween(rng, 0, earlier - 1)]
        : null;
      // Someone invited into a staff workspace is staff too, and inherits the domain
      // below — which is why the internal population lands nearer 5% than the 3.5% who
      // arrive on their own.
      const internal = staffRoll || Boolean(inviter && inviter._internal);
      const platformRoll = rng();
      users.push({
        id: uid++,
        // Invitees inherit the domain and plan of the workspace they joined — that is
        // what makes them one account rather than two.
        email_domain: internal ? PE_INTERNAL_DOMAIN : (inviter ? inviter.email_domain : pick(rng, PE_DOMAINS)),
        country: inviter ? inviter.country : pick(rng, PE_COUNTRIES),
        // Attribution rolls up to whoever brought the account in, so an invitee carries
        // the inviter's channel. There is no 'invite' channel to shortcut quirk 2 with.
        channel: inviter ? inviter.channel : peWeighted(rng, PE_CHANNELS).name,
        plan: inviter ? inviter.plan : peWeighted(rng, PE_PLANS).name,
        primary_platform: platformRoll < 0.54 ? 'web' : (platformRoll < 0.79 ? 'ios' : 'android'),
        signup_at: peStamp(rng, date, 6, 22),
        invited_by_user_id: inviter ? inviter.id : null,
        // Not columns — working state the generator needs and the learner never sees.
        _date: date,
        _internal: internal,
      });
    }
  }

  const groupOf = (u) => (u.primary_platform === 'web' ? 'web' : 'mobile');

  // --- Phase 2: experiment assignment --------------------------------------
  const assignments = [];
  let ai = 1;
  for (const u of users) {
    if (u._date < PE_EXPERIMENT_FROM || u._date >= PE_EXPERIMENT_TO) continue;
    const variant = rng() < PE_TREATMENT_SHARE[groupOf(u)] ? 'treatment' : 'control';
    u._variant = variant;
    assignments.push({
      id: ai++,
      user_id: u.id,
      experiment: PE_EXPERIMENT_KEY,
      variant,
      // Bucketed on the first page load, so within a minute or two of signing up.
      assigned_at: new Date(Date.parse(u.signup_at) + intBetween(rng, 20, 180) * 1000)
        .toISOString().replace(/\.\d{3}Z$/, 'Z'),
    });
  }

  // --- Phase 3: who activated ----------------------------------------------
  // Drawn per cell rather than per user: the count in each cell is EXACT, so the
  // authored finding cannot be washed out by sampling noise. Which users activate is
  // still random — invitees are favoured, because landing in a workspace that already
  // has data connected is a real head start.
  const cells = new Map();
  for (const u of users) {
    const key = u._variant ? `${groupOf(u)}|${u._variant}` : groupOf(u);
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push(u);
  }
  for (const [key, members] of cells) {
    const rate = key.includes('|') ? PE_EXPERIMENT_ACTIVATION[key] : PE_BASE_ACTIVATION[key];
    const scored = members.map((u) => ({ u, score: rng() + (u.invited_by_user_id ? 0.35 : 0) }));
    scored.sort((a, b) => b.score - a.score || a.u.id - b.u.id);
    const take = Math.round(members.length * rate);
    scored.forEach((s, idx) => { s.u._activated = idx < take; });
  }
  // Staff always activate — they were the ones who built it.
  for (const u of users) if (u._internal) u._activated = true;

  // --- Phase 4: sessions and events ----------------------------------------
  const sessions = [];
  const events = [];
  let si = 1;
  let ei = 1;

  for (const u of users) {
    const channel = PE_CHANNELS.find((c) => c.name === u.channel) || PE_CHANNELS[0];
    const observed = peDayDiff(u._date, PE_LAST_DAY);
    const mine = [];

    const addSession = (date, neverBounces) => {
      if (date > PE_LAST_DAY) return;
      const onWeb = u.primary_platform === 'web'
        ? rng() > 0.12
        : rng() < 0.10;
      const platform = onWeb ? 'web' : (u.primary_platform === 'web' ? pick(rng, ['ios', 'android']) : u.primary_platform);
      // Quirk 3 — the beacon fired, the user left. Far commoner on mobile.
      const bounced = !neverBounces && rng() < (platform === 'web' ? 0.13 : 0.30);
      mine.push({
        id: si++,
        user_id: u.id,
        started_at: peStamp(rng, date, 7, 23),
        platform,
        app_version: platform === 'web' ? peWebVersion(date) : peMobileVersion(date),
        // Squared so most sessions are short and a few are long, the way real ones are.
        duration_seconds: bounced ? 0 : roundTo(45 + Math.floor(2600 * rng() * rng()), 5),
      });
    };

    // Everyone has a session on the day they signed up — that is the one
    // signup_completed belongs to, and without it a late-June signup could end up with
    // no events at all.
    addSession(u._date, true);
    const firstWeek = u._internal ? intBetween(rng, 2, 4) : (u._activated ? intBetween(rng, 1, 3) : intBetween(rng, 0, 1));
    for (let k = 0; k < firstWeek; k++) addSession(peAddDays(u._date, intBetween(rng, 0, 6)));

    const weeks = Math.floor(observed / 7);
    for (let w = 1; w <= weeks; w++) {
      const base = u._internal ? 0.95 : (u._activated ? 0.72 : 0.30) * channel.retention * Math.pow(0.86, w - 1);
      if (rng() >= Math.max(0.02, Math.min(0.95, base))) continue;
      const count = u._internal ? intBetween(rng, 2, 5) : intBetween(rng, 1, 3);
      for (let k = 0; k < count; k++) addSession(peAddDays(u._date, w * 7 + intBetween(rng, 0, 6)));
    }

    mine.sort((a, b) => (a.started_at < b.started_at ? -1 : a.started_at > b.started_at ? 1 : a.id - b.id));
    for (const s of mine) sessions.push(s);
    if (!mine.length) continue;


    // The steps this user reached, in order. An invitee joins a workspace that already
    // exists, so workspace_created is simply not in their path (quirk 2).
    const invited = Boolean(u.invited_by_user_id);
    const steps = ['signup_completed'];
    if (u._activated) {
      if (!invited) steps.push('workspace_created');
      steps.push('data_connected', 'first_report_run');
      if (rng() < (invited ? 0.18 : 0.34)) steps.push('invited_teammate');
    } else {
      const depth = rng();
      if (invited) {
        if (depth > 0.28) steps.push('data_connected');
      } else if (depth > 0.70) {
        steps.push('workspace_created', 'data_connected');
      } else if (depth > 0.30) {
        steps.push('workspace_created');
      }
    }

    const stampIn = (session, offset) => new Date(Date.parse(session.started_at) + offset * 1000)
      .toISOString().replace(/\.\d{3}Z$/, 'Z');

    // Reaching the next step usually takes another visit or two, so activation spreads
    // over the first weeks instead of all happening on signup day. A step can only be
    // recorded in a session that lasted longer than zero seconds — a bounce is, by
    // definition, a visit in which nothing happened.
    const hosts = mine.filter((s) => s.duration_seconds > 0);
    const byHost = new Map();
    let cursor = 0;
    for (let idx = 0; idx < steps.length; idx += 1) {
      if (idx > 0) cursor += intBetween(rng, 0, 1);
      // Running out of observed sessions is not the same as never getting there — it
      // means the export was taken first. So the step is simply absent, and every step
      // after it with it. That is why the June cohort's funnel looks worse than the
      // March one: not a worse product, a shorter window. Quirk 5 again, from the other
      // direction, and the reason a cohort chart has to stop where the data does.
      if (cursor >= hosts.length) break;
      const host = hosts[cursor];
      if (!byHost.has(host.id)) byHost.set(host.id, { session: host, names: [] });
      byHost.get(host.id).names.push(steps[idx]);
    }
    for (const { session, names } of byHost.values()) {
      names.forEach((name, k) => {
        // Spread evenly through the session, so steps taken in one sitting are ordered
        // and none of them lands after the session ended.
        const offset = Math.round((session.duration_seconds * (k + 1)) / (names.length + 1));
        events.push({
          id: ei++, session_id: session.id, user_id: u.id, name, occurred_at: stampIn(session, offset),
        });
        // Quirk 4 — the retry bug in mobile 4.3.0, fixed in 4.3.1. The retry is immediate,
        // which is why the pair is seconds apart and easy to recognise once you look.
        if (session.platform !== 'web' && session.app_version === '4.3.0') {
          events.push({
            id: ei++, session_id: session.id, user_id: u.id, name,
            occurred_at: stampIn(session, offset + intBetween(rng, 3, 9)),
          });
        }
      });
    }

    for (const s of mine) {
      if (!s.duration_seconds) continue;
      const count = intBetween(rng, 0, 2);
      for (let k = 0; k < count; k++) {
        events.push({
          id: ei++, session_id: s.id, user_id: u.id,
          name: pick(rng, PE_ROUTINE_EVENTS),
          occurred_at: stampIn(s, intBetween(rng, 5, Math.max(6, s.duration_seconds))),
        });
      }
    }
  }

  for (const u of users) { delete u._date; delete u._internal; delete u._activated; delete u._variant; }

  return { users, sessions, events, experiment_assignments: assignments };
}

// ---------------------------------------------------------------------------
// Dataset: retail_sales
//
// Twelve months of till data across a small retail estate: stores, products, line-level
// sales and periodic stock counts. Built for the Team Lead track, where the work is less
// "compute this" and more "decide whether the number somebody else computed can be
// defended", so the quirks here are the kind that survive a first review and fail a
// second one.
//
// It is a deliberately different shape again from the first three datasets. hr_core is a
// snapshot, saas_ops is an incident log, product_events is a behavioural stream. This is
// a transaction ledger — every row is money that moved, some of it backwards.
//
// Deliberate quirks, authored on purpose because finding them IS the analysis:
//
//   1. Returns are negative quantities on the same table. SUM(quantity) nets them, which
//      is right for units sold and wrong for "how many transactions"; COUNT(*) counts a
//      return as a sale. Nearly every naive revenue or basket figure picks one of these
//      two wrong.
//
//   2. The estate changed during the year. Two stores opened mid-year and one closed, so
//      ranking stores by annual total ranks them by how long they were open. A like-for-
//      like comparison has to restrict to the months every store was trading.
//
//   3. One store's feed was loaded twice. March 2026 for Ashok Nagar exists as exact
//      duplicate rows — same store, product, date, quantity and price, different id. A
//      few identical rows occur naturally elsewhere in a year of till data; what marks
//      this one out is the pattern, not the fact of it. One store, one contiguous month,
//      every row doubled. It inflates that store enough to move it up the ranking.
//
//   4. products.unit_cost is TODAY's cost, not the cost at the time of sale. Fifteen
//      products were repriced upward by suppliers partway through the year, and the
//      table carries the previous cost and the date it changed. Margin computed against
//      the current cost alone applies this year's increases to last year's sales, so it
//      UNDERSTATES margin by about 4% overall and does so unevenly across the months.
//
//   5. There was a promotion, in November, and nothing in the data says so. It is the
//      best month on revenue by a distance and the worst on margin RATE — 40.5% against
//      a typical 46%. The honest reading is the one in between: revenue up about 26% on
//      a normal month, gross margin up about 11%. The discount bought a great deal of
//      turnover and very little profit, and either single number on its own tells the
//      wrong story.
//
//   6. Seven products never sold at all. They are listed in the range and were never
//      ranged in any store, so they are absent from the sales table entirely and any
//      inner join silently drops them — and "which products underperform" is exactly the
//      question where the missing rows are the answer.
// ---------------------------------------------------------------------------

const RETAIL_FROM = '2025-07-01';
const RETAIL_TO = '2026-06-30';

const RETAIL_STORES = [
  { id: 1, name: 'Indiranagar', city: 'Bengaluru', region: 'South', format: 'flagship', opened_on: '2019-04-12', closed_on: null },
  { id: 2, name: 'Koramangala', city: 'Bengaluru', region: 'South', format: 'standard', opened_on: '2020-08-01', closed_on: null },
  { id: 3, name: 'Ashok Nagar', city: 'Chennai', region: 'South', format: 'standard', opened_on: '2018-11-20', closed_on: null },
  { id: 4, name: 'Banjara Hills', city: 'Hyderabad', region: 'South', format: 'flagship', opened_on: '2019-09-05', closed_on: null },
  { id: 5, name: 'Andheri West', city: 'Mumbai', region: 'West', format: 'standard', opened_on: '2017-06-15', closed_on: null },
  { id: 6, name: 'Bandra', city: 'Mumbai', region: 'West', format: 'flagship', opened_on: '2021-02-10', closed_on: null },
  { id: 7, name: 'Baner', city: 'Pune', region: 'West', format: 'express', opened_on: '2022-05-01', closed_on: null },
  { id: 8, name: 'Vastrapur', city: 'Ahmedabad', region: 'West', format: 'standard', opened_on: '2021-11-08', closed_on: null },
  { id: 9, name: 'Connaught Place', city: 'Delhi', region: 'North', format: 'flagship', opened_on: '2016-03-22', closed_on: null },
  { id: 10, name: 'Saket', city: 'Delhi', region: 'North', format: 'standard', opened_on: '2020-01-17', closed_on: null },
  // Quirk 2. Two of these opened during the window and one closed inside it, so any
  // annual total silently ranks the estate by trading days.
  { id: 11, name: 'Sector 29', city: 'Gurugram', region: 'North', format: 'express', opened_on: '2025-10-06', closed_on: null },
  { id: 12, name: 'Salt Lake', city: 'Kolkata', region: 'East', format: 'standard', opened_on: '2026-02-02', closed_on: null },
  { id: 13, name: 'Park Street', city: 'Kolkata', region: 'East', format: 'express', opened_on: '2019-07-30', closed_on: '2026-01-31' },
];

const RETAIL_CATEGORIES = [
  { name: 'Coffee', subs: ['Beans', 'Ground', 'Capsules'], cost_lo: 240, cost_hi: 900, markup_lo: 1.9, markup_hi: 2.6, weight: 5 },
  { name: 'Tea', subs: ['Leaf', 'Bags', 'Speciality'], cost_lo: 120, cost_hi: 620, markup_lo: 2.0, markup_hi: 2.9, weight: 4 },
  { name: 'Equipment', subs: ['Brewers', 'Grinders', 'Accessories'], cost_lo: 850, cost_hi: 9800, markup_lo: 1.4, markup_hi: 1.9, weight: 3 },
  { name: 'Bakery', subs: ['Biscuits', 'Cakes'], cost_lo: 60, cost_hi: 340, markup_lo: 2.2, markup_hi: 3.2, weight: 3 },
  { name: 'Merchandise', subs: ['Mugs', 'Bottles', 'Apparel'], cost_lo: 180, cost_hi: 1400, markup_lo: 2.4, markup_hi: 3.6, weight: 2 },
];

const PRODUCT_WORDS = [
  'Arabica', 'Robusta', 'Monsoon', 'Nilgiri', 'Coorg', 'Chikmagalur', 'Assam', 'Darjeeling',
  'Highland', 'Estate', 'Reserve', 'Heritage', 'Morning', 'Midnight', 'Amber', 'Copper',
  'Slate', 'Ember', 'Harvest', 'Cascade', 'Summit', 'Grove', 'Terrace', 'Meridian',
];
const PRODUCT_SUFFIX = ['Blend', 'Select', 'Classic', 'Gold', 'No. 7', 'Single Origin', 'Everyday', 'Signature'];

// The promotion. One month of heavy discounting that buys volume and gives back margin —
// quirk 5. The dates are real and knowable from the data, not stated anywhere.
const PROMO_MONTH = '2025-11';
// Quirk 3. One store, one week, loaded twice.
const DUPLICATE_STORE_ID = 3;
const DUPLICATE_WINDOW = ['2026-03-01', '2026-03-31'];

function retailDays(fromDate, toDate) {
  return Math.round((Date.parse(toDate + 'T00:00:00Z') - Date.parse(fromDate + 'T00:00:00Z')) / 86400000);
}
function retailAddDays(date, n) {
  return new Date(Date.parse(date + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
}

function generateRetailSales(seed) {
  const rng = makeRng(seed);

  // --- Products -------------------------------------------------------------
  const products = [];
  let pid = 1;
  for (const cat of RETAIL_CATEGORIES) {
    const count = cat.weight * 4;
    for (let i = 0; i < count; i++) {
      const cost = roundTo(intBetween(rng, cat.cost_lo, cat.cost_hi), 10);
      const markup = cat.markup_lo + rng() * (cat.markup_hi - cat.markup_lo);
      // Quirk 4. A supplier repriced these partway through the year, and the table keeps
      // the old cost beside the new one. Margin before that date uses the old figure.
      const repriced = rng() < 0.14;
      const changedOn = repriced ? retailAddDays(RETAIL_FROM, intBetween(rng, 60, 300)) : null;
      products.push({
        id: pid++,
        name: `${pick(rng, PRODUCT_WORDS)} ${pick(rng, PRODUCT_SUFFIX)}`,
        category: cat.name,
        subcategory: pick(rng, cat.subs),
        unit_cost: cost,
        previous_unit_cost: repriced ? roundTo(cost * (0.78 + rng() * 0.14), 10) : null,
        cost_changed_on: changedOn,
        list_price: roundTo(cost * markup, 10),
      });
    }
  }

  // Quirk 6. Seven products are in the range and ranged by nobody — signed off by
  // buying, never put on a planogram. They will not appear in the sales table at all.
  const neverStocked = new Set();
  while (neverStocked.size < 7) neverStocked.add(products[intBetween(rng, 0, products.length - 1)].id);

  // --- Sales ----------------------------------------------------------------
  const sales = [];
  let sid = 1;
  const span = retailDays(RETAIL_FROM, RETAIL_TO);

  // How busy each store is, so the estate is not uniform. Flagships carry the volume.
  const busyness = { flagship: 1.0, standard: 0.62, express: 0.34 };

  // Which products a store actually stocks. An express store carries a fraction of the
  // range, which is why some products look like they failed when they were never listed.
  const rangeFor = (store) => (store.format === 'flagship' ? 1.0 : store.format === 'standard' ? 0.78 : 0.42);

  for (const store of RETAIL_STORES) {
    const stocked = products.filter((p) => !neverStocked.has(p.id) && rng() < rangeFor(store));
    if (!stocked.length) stocked.push(products.find((p) => !neverStocked.has(p.id)));

    for (let d = 0; d < span; d++) {
      const date = retailAddDays(RETAIL_FROM, d);
      if (store.opened_on > date) continue;
      if (store.closed_on && date > store.closed_on) continue;
      // Sunday is quiet, Saturday is busy. A day with no rows at all is a real closure.
      const dow = new Date(date + 'T00:00:00Z').getUTCDay();
      const dayWeight = dow === 0 ? 0.45 : dow === 6 ? 1.45 : 1.0;
      const month = date.slice(0, 7);
      const promo = month === PROMO_MONTH;
      // The promotion buys roughly half as much volume again.
      const lines = Math.round(intBetween(rng, 1, 5) * busyness[store.format] * dayWeight * (promo ? 1.5 : 1));

      for (let k = 0; k < lines; k++) {
        const product = pick(rng, stocked);
        // Quirk 1. A return is a negative quantity on the same table, priced at what was
        // originally paid. Around one line in eighteen.
        const isReturn = rng() < 0.055;
        const qty = isReturn ? -intBetween(rng, 1, 2) : intBetween(rng, 1, 4);
        // Discount is deeper and far commoner during the promotion.
        const discount = promo
          ? pick(rng, [0, 10, 15, 20, 20, 25, 30])
          : pick(rng, [0, 0, 0, 0, 5, 10, 15]);
        sales.push({
          id: sid++,
          store_id: store.id,
          product_id: product.id,
          sold_at: date,
          quantity: qty,
          unit_price: roundTo(product.list_price * (1 - discount / 100), 1),
          discount_pct: discount,
        });
      }
    }
  }

  // Quirk 3. The feed for one store, one week, was loaded a second time. Same store,
  // product, date, quantity and price — a different id, which is the only thing that
  // makes them two rows rather than one.
  const dupes = sales.filter((s) => s.store_id === DUPLICATE_STORE_ID
    && s.sold_at >= DUPLICATE_WINDOW[0] && s.sold_at <= DUPLICATE_WINDOW[1]);
  for (const s of dupes) sales.push({ ...s, id: sid++ });

  // --- Stock counts ---------------------------------------------------------
  // Counted quarterly, for the range each store actually carries. Quarterly rather than
  // monthly because four counts a year answer every stock question this dataset is for,
  // and monthly counts were four times the rows for no extra teaching.
  const stock_counts = [];
  let stid = 1;
  for (const store of RETAIL_STORES) {
    const sold = new Set(sales.filter((s) => s.store_id === store.id).map((s) => s.product_id));
    for (let m = 0; m < 4; m++) {
      const date = retailAddDays(RETAIL_FROM, m * 91);
      if (store.opened_on > date) continue;
      if (store.closed_on && date > store.closed_on) continue;
      for (const product of products) {
        if (!sold.has(product.id)) continue;
        stock_counts.push({
          id: stid++,
          store_id: store.id,
          product_id: product.id,
          counted_on: date,
          units_on_hand: intBetween(rng, 0, 40),
        });
      }
    }
  }

  return { stores: RETAIL_STORES, products, sales, stock_counts };
}

// ---------------------------------------------------------------------------
// Dataset: analytics_ops
//
// The analytics function's own operation: who works here, what the business asks for,
// where the hours go, and what the tooling costs. Built for the Manager track, where the
// subject of the analysis stops being a market or a product and becomes the team itself.
//
// That changes what a wrong answer costs. A misread retail figure produces a bad range
// decision. A misread capacity figure produces a performance conversation with a person,
// and the quirks here are chosen accordingly — most of them are ways of accidentally
// measuring somebody's admin habits and calling it their output.
//
// Deliberate quirks, authored on purpose because finding them IS the analysis:
//
//   1. Time logging is self-reported and wildly uneven. Some analysts log nearly every
//      working day and some log about half. Hours per person therefore ranks people by
//      how diligently they fill in a timesheet, and the two most "productive" people on
//      that measure are the two best at admin.
//
//   2. One analyst left in January and another joined in March. Capacity computed from
//      headcount counts both for the whole year; capacity computed from days present
//      does not. The gap is about a fifth of a person-year.
//
//   3. Cancelled work still has hours against it. Requests that were withdrawn or
//      abandoned carry real logged time, so any "hours per delivered request" that
//      filters to delivered work quietly hides the effort that produced nothing.
//
//   4. Two functions ask in completely different shapes. Finance submits many small
//      requests; Product submits few large ones. Rank the requesters by count and Finance
//      dominates; rank by hours and Product does. Neither is the answer on its own.
//
//   5. Delivery is recorded when the analyst closes the ticket, and some tickets are
//      reopened afterwards. Lead time measured to the first delivery understates the
//      true elapsed time for exactly the requests that went wrong.
//
//   6. Tool licences are bought in seats and used by people. One tool has far more seats
//      than it has assignments, and another has assignments that have not been touched
//      in months. Seats, assignments and active users are three different numbers and
//      the renewal decision needs all three.
// ---------------------------------------------------------------------------

const OPS_FROM = '2025-07-01';
const OPS_TO = '2026-06-30';

const OPS_ANALYSTS = [
  { id: 1, name: 'Asha Rao', level: 'manager', started_on: '2021-03-01', left_on: null, day_rate: 16000, logging: 0.92 },
  { id: 2, name: 'Devika Raghavan', level: 'lead', started_on: '2022-06-13', left_on: null, day_rate: 12500, logging: 0.88 },
  { id: 3, name: 'Suresh Balan', level: 'lead', started_on: '2023-01-09', left_on: null, day_rate: 12000, logging: 0.54 },
  { id: 4, name: 'Aditi Sharma', level: 'senior', started_on: '2023-05-02', left_on: null, day_rate: 9500, logging: 0.95 },
  { id: 5, name: 'Nikhil Varma', level: 'senior', started_on: '2022-11-21', left_on: null, day_rate: 9800, logging: 0.61 },
  { id: 6, name: 'Karthik Iyer', level: 'senior', started_on: '2024-02-19', left_on: null, day_rate: 9200, logging: 0.83 },
  { id: 7, name: 'Tanvi Deshmukh', level: 'senior', started_on: '2023-09-04', left_on: null, day_rate: 9400, logging: 0.49 },
  { id: 8, name: 'Imran Qureshi', level: 'senior', started_on: '2024-07-15', left_on: null, day_rate: 9100, logging: 0.90 },
  { id: 9, name: 'Harini Gopal', level: 'junior', started_on: '2024-10-07', left_on: null, day_rate: 6200, logging: 0.86 },
  { id: 10, name: 'Yash Chitale', level: 'junior', started_on: '2025-01-13', left_on: null, day_rate: 6000, logging: 0.58 },
  { id: 11, name: 'Ananya Bose', level: 'junior', started_on: '2025-04-01', left_on: null, day_rate: 5900, logging: 0.79 },
  // Quirk 2. One leaver and one joiner inside the window, so headcount and days present
  // give different capacity by about a fifth of a person-year.
  { id: 12, name: 'Farhan Sheikh', level: 'junior', started_on: '2024-08-19', left_on: '2026-01-30', day_rate: 6100, logging: 0.72 },
  { id: 13, name: 'Lakshmi Krishnan', level: 'senior', started_on: '2026-03-02', left_on: null, day_rate: 9600, logging: 0.81 },
  { id: 14, name: 'Nithya Menon', level: 'junior', started_on: '2025-06-16', left_on: null, day_rate: 6000, logging: 0.66 },
];

// Quirk 4. Finance asks for many small things; Product asks for few large ones. Counting
// requests and counting hours therefore rank the requesters in almost opposite orders.
const OPS_REQUESTERS = [
  { name: 'Finance', weight: 34, size_lo: 2, size_hi: 9 },
  { name: 'Retail Ops', weight: 24, size_lo: 3, size_hi: 16 },
  { name: 'Product', weight: 11, size_lo: 22, size_hi: 70 },
  { name: 'Marketing', weight: 15, size_lo: 4, size_hi: 20 },
  { name: 'People', weight: 9, size_lo: 3, size_hi: 12 },
  { name: 'Exec', weight: 7, size_lo: 10, size_hi: 38 },
];

const OPS_CATEGORIES = ['report', 'analysis', 'dashboard', 'data-fix', 'adhoc'];
const OPS_PRIORITIES = ['urgent', 'high', 'normal', 'normal', 'low'];
const OPS_TITLES = [
  'Monthly trading summary', 'Cohort retention view', 'Supplier spend breakdown',
  'Headcount reconciliation', 'Store ranking refresh', 'Margin by subcategory',
  'Campaign attribution', 'Stock position extract', 'Churn drivers', 'Basket composition',
  'Returns analysis', 'Payroll variance', 'Range performance', 'Promotion readout',
  'Forecast accuracy', 'Data quality report', 'Customer segmentation', 'Price elasticity',
];

const OPS_TOOLS = [
  { id: 1, tool: 'Warehouse compute', vendor: 'Northlake', seats: 14, annual_cost: 1450000, renews_on: '2026-09-30' },
  { id: 2, tool: 'BI platform', vendor: 'Clearview', seats: 30, annual_cost: 2160000, renews_on: '2026-08-15' },
  { id: 3, tool: 'Notebook hosting', vendor: 'Pinegrove', seats: 12, annual_cost: 540000, renews_on: '2026-11-01' },
  { id: 4, tool: 'Data catalogue', vendor: 'Orrery', seats: 14, annual_cost: 780000, renews_on: '2026-07-20' },
  { id: 5, tool: 'Scheduling', vendor: 'Tidewater', seats: 8, annual_cost: 264000, renews_on: '2027-01-12' },
  { id: 6, tool: 'Statistical suite', vendor: 'Kestrel', seats: 10, annual_cost: 920000, renews_on: '2026-10-05' },
];

function opsDay(date) { return Date.parse(date + 'T00:00:00Z') / 86400000; }
function opsDate(n) { return new Date(n * 86400000).toISOString().slice(0, 10); }
function opsIsWeekend(date) { const d = new Date(date + 'T00:00:00Z').getUTCDay(); return d === 0 || d === 6; }

function generateAnalyticsOps(seed) {
  const rng = makeRng(seed);
  const from = opsDay(OPS_FROM);
  const to = opsDay(OPS_TO);

  // Who is available on a given day, so capacity is a fact about presence rather than
  // about headcount.
  const present = (a, date) => a.started_on <= date && (a.left_on == null || date <= a.left_on);

  // --- Requests -------------------------------------------------------------
  const requests = [];
  let rid = 1;
  const total = 384;
  for (let i = 0; i < total; i++) {
    const requester = peWeighted(rng, OPS_REQUESTERS);
    const requestedOn = opsDate(intBetween(rng, from, to));
    const candidates = OPS_ANALYSTS.filter((a) => present(a, requestedOn) && a.level !== 'manager');
    const owner = candidates.length ? pick(rng, candidates) : OPS_ANALYSTS[1];

    // Most work gets done. Some is still open, and some is cancelled — quirk 3, because
    // cancelled work still consumed hours.
    const roll = rng();
    const status = roll < 0.70 ? 'delivered' : roll < 0.82 ? 'in_progress' : roll < 0.90 ? 'queued' : 'cancelled';

    const startLag = status === 'queued' ? null : intBetween(rng, 0, 24);
    const startedOn = startLag == null ? null : opsDate(Math.min(opsDay(requestedOn) + startLag, to));
    const workDays = intBetween(rng, 2, 30);
    const deliveredOn = status === 'delivered'
      ? opsDate(Math.min(opsDay(startedOn) + workDays, to))
      : null;
    // Quirk 5. Some delivered work comes back. The reopen is recorded but the original
    // delivery date is not moved, so lead time to first delivery understates the truth.
    const reopened = status === 'delivered' && rng() < 0.13 ? intBetween(rng, 1, 2) : 0;
    const closedOn = reopened && deliveredOn
      ? opsDate(Math.min(opsDay(deliveredOn) + intBetween(rng, 5, 40), to))
      : deliveredOn;

    requests.push({
      id: rid++,
      title: `${pick(rng, OPS_TITLES)} — ${requester.name}`,
      requested_by: requester.name,
      category: pick(rng, OPS_CATEGORIES),
      priority: pick(rng, OPS_PRIORITIES),
      requested_on: requestedOn,
      started_on: startedOn,
      delivered_on: deliveredOn,
      closed_on: closedOn,
      reopened,
      status,
      analyst_id: status === 'queued' ? null : owner.id,
      _size: intBetween(rng, requester.size_lo, requester.size_hi),
    });
  }

  // --- Time logs ------------------------------------------------------------
  // Hours are logged against a request on working days between start and close. Quirk 1:
  // each analyst logs only a fraction of the days they actually worked, and the fraction
  // is a property of the person, not of the work.
  const time_logs = [];
  let tid = 1;
  const byId = new Map(OPS_ANALYSTS.map((a) => [a.id, a]));
  for (const r of requests) {
    if (r.analyst_id == null || r.started_on == null) continue;
    const analyst = byId.get(r.analyst_id);
    const end = r.closed_on || opsDate(Math.min(opsDay(r.started_on) + intBetween(rng, 3, 25), to));
    let remaining = r._size;
    for (let d = opsDay(r.started_on); d <= opsDay(end) && remaining > 0; d += 1) {
      const date = opsDate(d);
      if (opsIsWeekend(date)) continue;
      if (rng() > analyst.logging) { remaining -= Math.min(remaining, 1.5); continue; }
      const hours = Math.min(remaining, Math.round((0.5 + rng() * 5) * 2) / 2);
      if (hours <= 0) break;
      // A request can still be open after the person working it has left, and the walk
      // above does not know that. Nobody fills in a timesheet after their last day, so the
      // entry lands on the leaving date instead — which is what actually happens: people
      // close out their outstanding time on the way out of the door. Clamping rather than
      // dropping keeps the hours where they were spent, so every total holds.
      const on = analyst.left_on && date > analyst.left_on ? analyst.left_on : date;
      time_logs.push({ id: tid++, analyst_id: analyst.id, request_id: r.id, logged_on: on, hours });
      remaining -= hours;
    }
  }

  // --- Licence assignments ---------------------------------------------------
  // Quirk 6. Seats are bought, assignments are made, and use is a third thing. The BI
  // platform has thirty seats for a team of fourteen; the statistical suite is assigned
  // to people who have not opened it in months; and the January leaver's four seats were
  // never handed back, which is the commonest and least visible way a tooling bill grows.
  const licence_assignments = [];
  let lid = 1;
  for (const tool of OPS_TOOLS) {
    for (const a of OPS_ANALYSTS) {
      const wants = tool.id === 2 ? 0.95
        : tool.id === 6 ? 0.70
        : tool.id === 5 ? 0.45
        : 0.85;
      if (rng() > wants) continue;
      // Days since last use. The statistical suite is where the stale ones are.
      const staleness = tool.id === 6 ? intBetween(rng, 5, 300) : intBetween(rng, 0, 45);
      licence_assignments.push({
        id: lid++,
        licence_id: tool.id,
        analyst_id: a.id,
        assigned_on: a.started_on > OPS_FROM ? a.started_on : OPS_FROM,
        // Nobody opens a tool after their last day. The seat stays assigned, because
        // reclaiming it is a job somebody has to remember to do and nobody did.
        last_used_on: a.left_on && opsDate(to - staleness) > a.left_on
          ? a.left_on
          : opsDate(to - staleness),
      });
    }
  }

  for (const r of requests) delete r._size;
  return { analysts: OPS_ANALYSTS, requests, time_logs, licences: OPS_TOOLS, licence_assignments };
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

  product_events: {
    key: 'product_events',
    label: 'Product Events',
    description: 'Signups, sessions, product events and onboarding experiment arms for the Meridian product itself.',
    seed: 20260903,
    tables: [
      {
        name: 'users',
        note: 'One row per signup. invited_by_user_id is NULL for people who started a workspace themselves.',
        columns: [
          { name: 'id', type: 'INTEGER', note: 'Primary key' },
          { name: 'email_domain', type: 'TEXT', note: 'Domain only, never the address' },
          { name: 'country', type: 'TEXT' },
          { name: 'channel', type: 'TEXT', note: 'organic, paid_search, referral, partner or outbound' },
          { name: 'plan', type: 'TEXT', note: 'free, pro or business' },
          { name: 'primary_platform', type: 'TEXT', note: 'web, ios or android' },
          { name: 'signup_at', type: 'TEXT', note: 'ISO 8601 timestamp' },
          { name: 'invited_by_user_id', type: 'INTEGER', note: 'NULL if self-serve; otherwise the inviter' },
        ],
      },
      {
        name: 'sessions',
        note: 'One row per visit. duration_seconds is 0 when the page loaded and the user left.',
        columns: [
          { name: 'id', type: 'INTEGER', note: 'Primary key' },
          { name: 'user_id', type: 'INTEGER', note: 'References users.id' },
          { name: 'started_at', type: 'TEXT', note: 'ISO 8601 timestamp' },
          { name: 'platform', type: 'TEXT', note: 'web, ios or android — the device used, not the signup device' },
          { name: 'app_version', type: 'TEXT', note: 'Release running during the session' },
          { name: 'duration_seconds', type: 'INTEGER' },
        ],
      },
      {
        name: 'events',
        note: 'One row per tracked action. Funnel steps are signup_completed, workspace_created, data_connected, first_report_run and invited_teammate.',
        columns: [
          { name: 'id', type: 'INTEGER', note: 'Primary key' },
          { name: 'session_id', type: 'INTEGER', note: 'References sessions.id' },
          { name: 'user_id', type: 'INTEGER', note: 'References users.id' },
          { name: 'name', type: 'TEXT' },
          { name: 'occurred_at', type: 'TEXT', note: 'ISO 8601 timestamp' },
        ],
      },
      {
        name: 'experiment_assignments',
        note: 'Which arm of the onboarding_v2 test a user was bucketed into. Only users who signed up after it launched appear.',
        columns: [
          { name: 'id', type: 'INTEGER', note: 'Primary key' },
          { name: 'user_id', type: 'INTEGER', note: 'References users.id' },
          { name: 'experiment', type: 'TEXT' },
          { name: 'variant', type: 'TEXT', note: 'control or treatment' },
          { name: 'assigned_at', type: 'TEXT', note: 'ISO 8601 timestamp' },
        ],
      },
    ],
    schema: `
      CREATE TABLE users (
        id INTEGER PRIMARY KEY, email_domain TEXT NOT NULL, country TEXT NOT NULL,
        channel TEXT NOT NULL, plan TEXT NOT NULL, primary_platform TEXT NOT NULL,
        signup_at TEXT NOT NULL, invited_by_user_id INTEGER
      );
      CREATE TABLE sessions (
        id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, started_at TEXT NOT NULL,
        platform TEXT NOT NULL, app_version TEXT NOT NULL, duration_seconds INTEGER NOT NULL
      );
      CREATE TABLE events (
        id INTEGER PRIMARY KEY, session_id INTEGER NOT NULL, user_id INTEGER NOT NULL,
        name TEXT NOT NULL, occurred_at TEXT NOT NULL
      );
      CREATE TABLE experiment_assignments (
        id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, experiment TEXT NOT NULL,
        variant TEXT NOT NULL, assigned_at TEXT NOT NULL
      );
      CREATE INDEX idx_events_user ON events (user_id, name);
      CREATE INDEX idx_sessions_user ON sessions (user_id, started_at);
    `,
    generate: generateProductEvents,
  },

  retail_sales: {
    key: 'retail_sales',
    label: 'Retail Sales',
    description: 'Twelve months of store, product, till-line and stock-count data across a thirteen-store estate.',
    seed: 20260904,
    tables: [
      {
        name: 'stores',
        note: 'The estate. closed_on is NULL for stores still trading; opened_on can fall inside the reporting window.',
        columns: [
          { name: 'id', type: 'INTEGER', note: 'Primary key' },
          { name: 'name', type: 'TEXT' },
          { name: 'city', type: 'TEXT' },
          { name: 'region', type: 'TEXT', note: 'North, South, East or West' },
          { name: 'format', type: 'TEXT', note: 'flagship, standard or express' },
          { name: 'opened_on', type: 'TEXT', note: 'ISO date' },
          { name: 'closed_on', type: 'TEXT', note: 'NULL if still trading' },
        ],
      },
      {
        name: 'products',
        note: 'The range. unit_cost is the cost TODAY; previous_unit_cost and cost_changed_on describe a supplier reprice.',
        columns: [
          { name: 'id', type: 'INTEGER', note: 'Primary key' },
          { name: 'name', type: 'TEXT' },
          { name: 'category', type: 'TEXT' },
          { name: 'subcategory', type: 'TEXT' },
          { name: 'unit_cost', type: 'INTEGER', note: 'Current cost to us, INR' },
          { name: 'previous_unit_cost', type: 'INTEGER', note: 'NULL if never repriced' },
          { name: 'cost_changed_on', type: 'TEXT', note: 'NULL if never repriced' },
          { name: 'list_price', type: 'INTEGER', note: 'Undiscounted shelf price, INR' },
        ],
      },
      {
        name: 'sales',
        note: 'One row per till line. quantity is NEGATIVE for a return. unit_price is what was actually charged.',
        columns: [
          { name: 'id', type: 'INTEGER', note: 'Primary key' },
          { name: 'store_id', type: 'INTEGER', note: 'References stores.id' },
          { name: 'product_id', type: 'INTEGER', note: 'References products.id' },
          { name: 'sold_at', type: 'TEXT', note: 'ISO date' },
          { name: 'quantity', type: 'INTEGER', note: 'Negative for returns' },
          { name: 'unit_price', type: 'INTEGER', note: 'Price charged per unit, INR' },
          { name: 'discount_pct', type: 'INTEGER', note: 'Discount applied, as a percentage of list' },
        ],
      },
      {
        name: 'stock_counts',
        note: 'Monthly physical counts, for the range each store actually carries.',
        columns: [
          { name: 'id', type: 'INTEGER', note: 'Primary key' },
          { name: 'store_id', type: 'INTEGER', note: 'References stores.id' },
          { name: 'product_id', type: 'INTEGER', note: 'References products.id' },
          { name: 'counted_on', type: 'TEXT', note: 'ISO date' },
          { name: 'units_on_hand', type: 'INTEGER' },
        ],
      },
    ],
    schema: `
      CREATE TABLE stores (
        id INTEGER PRIMARY KEY, name TEXT NOT NULL, city TEXT NOT NULL, region TEXT NOT NULL,
        format TEXT NOT NULL, opened_on TEXT NOT NULL, closed_on TEXT
      );
      CREATE TABLE products (
        id INTEGER PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL, subcategory TEXT NOT NULL,
        unit_cost INTEGER NOT NULL, previous_unit_cost INTEGER, cost_changed_on TEXT,
        list_price INTEGER NOT NULL
      );
      CREATE TABLE sales (
        id INTEGER PRIMARY KEY, store_id INTEGER NOT NULL, product_id INTEGER NOT NULL,
        sold_at TEXT NOT NULL, quantity INTEGER NOT NULL, unit_price INTEGER NOT NULL,
        discount_pct INTEGER NOT NULL
      );
      CREATE TABLE stock_counts (
        id INTEGER PRIMARY KEY, store_id INTEGER NOT NULL, product_id INTEGER NOT NULL,
        counted_on TEXT NOT NULL, units_on_hand INTEGER NOT NULL
      );
      CREATE INDEX idx_sales_store ON sales (store_id, sold_at);
      CREATE INDEX idx_sales_product ON sales (product_id);
    `,
    generate: generateRetailSales,
  },

  analytics_ops: {
    key: 'analytics_ops',
    label: 'Analytics Operations',
    description: 'The analytics function itself: people, incoming requests, logged hours and tool licences.',
    seed: 20260905,
    tables: [
      {
        name: 'analysts',
        note: 'The team. left_on is NULL for people still here; started_on can fall inside the reporting window.',
        columns: [
          { name: 'id', type: 'INTEGER', note: 'Primary key' },
          { name: 'name', type: 'TEXT' },
          { name: 'level', type: 'TEXT', note: 'junior, senior, lead or manager' },
          { name: 'started_on', type: 'TEXT', note: 'ISO date' },
          { name: 'left_on', type: 'TEXT', note: 'NULL if still here' },
          { name: 'day_rate', type: 'INTEGER', note: 'Fully loaded cost per working day, INR' },
        ],
      },
      {
        name: 'requests',
        note: 'Work asked of the team. delivered_on is when the analyst closed it; closed_on accounts for reopens.',
        columns: [
          { name: 'id', type: 'INTEGER', note: 'Primary key' },
          { name: 'title', type: 'TEXT' },
          { name: 'requested_by', type: 'TEXT', note: 'The function that asked' },
          { name: 'category', type: 'TEXT', note: 'report, analysis, dashboard, data-fix or adhoc' },
          { name: 'priority', type: 'TEXT', note: 'urgent, high, normal or low' },
          { name: 'requested_on', type: 'TEXT', note: 'ISO date' },
          { name: 'started_on', type: 'TEXT', note: 'NULL if never picked up' },
          { name: 'delivered_on', type: 'TEXT', note: 'First delivery. NULL if not delivered' },
          { name: 'closed_on', type: 'TEXT', note: 'Final close, after any reopen' },
          { name: 'reopened', type: 'INTEGER', note: 'How many times it came back' },
          { name: 'status', type: 'TEXT', note: 'delivered, in_progress, queued or cancelled' },
          { name: 'analyst_id', type: 'INTEGER', note: 'NULL while unassigned' },
        ],
      },
      {
        name: 'time_logs',
        note: 'Self-reported hours. Coverage varies a great deal between people.',
        columns: [
          { name: 'id', type: 'INTEGER', note: 'Primary key' },
          { name: 'analyst_id', type: 'INTEGER', note: 'References analysts.id' },
          { name: 'request_id', type: 'INTEGER', note: 'References requests.id' },
          { name: 'logged_on', type: 'TEXT', note: 'ISO date' },
          { name: 'hours', type: 'REAL' },
        ],
      },
      {
        name: 'licences',
        note: 'Tooling contracts. seats is what is paid for, not what is used.',
        columns: [
          { name: 'id', type: 'INTEGER', note: 'Primary key' },
          { name: 'tool', type: 'TEXT' },
          { name: 'vendor', type: 'TEXT' },
          { name: 'seats', type: 'INTEGER', note: 'Seats contracted' },
          { name: 'annual_cost', type: 'INTEGER', note: 'INR per year' },
          { name: 'renews_on', type: 'TEXT', note: 'ISO date' },
        ],
      },
      {
        name: 'licence_assignments',
        note: 'Who has been given a seat, and when they last used it.',
        columns: [
          { name: 'id', type: 'INTEGER', note: 'Primary key' },
          { name: 'licence_id', type: 'INTEGER', note: 'References licences.id' },
          { name: 'analyst_id', type: 'INTEGER', note: 'References analysts.id' },
          { name: 'assigned_on', type: 'TEXT', note: 'ISO date' },
          { name: 'last_used_on', type: 'TEXT', note: 'ISO date' },
        ],
      },
    ],
    schema: `
      CREATE TABLE analysts (
        id INTEGER PRIMARY KEY, name TEXT NOT NULL, level TEXT NOT NULL,
        started_on TEXT NOT NULL, left_on TEXT, day_rate INTEGER NOT NULL
      );
      CREATE TABLE requests (
        id INTEGER PRIMARY KEY, title TEXT NOT NULL, requested_by TEXT NOT NULL,
        category TEXT NOT NULL, priority TEXT NOT NULL, requested_on TEXT NOT NULL,
        started_on TEXT, delivered_on TEXT, closed_on TEXT, reopened INTEGER NOT NULL,
        status TEXT NOT NULL, analyst_id INTEGER
      );
      CREATE TABLE time_logs (
        id INTEGER PRIMARY KEY, analyst_id INTEGER NOT NULL, request_id INTEGER NOT NULL,
        logged_on TEXT NOT NULL, hours REAL NOT NULL
      );
      CREATE TABLE licences (
        id INTEGER PRIMARY KEY, tool TEXT NOT NULL, vendor TEXT NOT NULL,
        seats INTEGER NOT NULL, annual_cost INTEGER NOT NULL, renews_on TEXT NOT NULL
      );
      CREATE TABLE licence_assignments (
        id INTEGER PRIMARY KEY, licence_id INTEGER NOT NULL, analyst_id INTEGER NOT NULL,
        assigned_on TEXT NOT NULL, last_used_on TEXT NOT NULL
      );
      CREATE INDEX idx_logs_analyst ON time_logs (analyst_id, logged_on);
      CREATE INDEX idx_logs_request ON time_logs (request_id);
    `,
    generate: generateAnalyticsOps,
  },
};

const DEFAULT_DATASET = 'hr_core';

function getDataset(key) {
  return DATASETS[key] || DATASETS[DEFAULT_DATASET];
}

// Builds a fresh, isolated in-memory database for one execution. Callers MUST close it
// (see runQuery's finally block) — one of these is created per query run.
// `iso` plus n hours, in the same 'YYYY-MM-DDTHH:MM:00Z' shape the generator emits.
function addHours(iso, n) {
  const d = new Date(iso);
  d.setUTCHours(d.getUTCHours() + n);
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z').replace(/:\d\dZ$/, ':00Z');
}

// Generated rows, cached per dataset key.
//
// Generation is a pure function of a fixed seed, so the result is the same object graph
// every time and there is no reason to recompute it once per query. The DATABASE is
// still built fresh for every execution — a learner's SQL must never be able to see
// another learner's leftovers — but the rows it is filled from are computed once per
// process. product_events is an order of magnitude bigger than the first two datasets,
// which is what made this worth doing: nothing reads these rows except the inserts
// below, and nothing writes to them at all.
const generatedCache = new Map();
function generatedRows(def) {
  if (!generatedCache.has(def.key)) generatedCache.set(def.key, def.generate(def.seed));
  return generatedCache.get(def.key);
}

function buildDatasetDb(key) {
  const def = getDataset(key);
  const mem = new DatabaseSync(':memory:');
  mem.exec(def.schema);
  const data = generatedRows(def);

  // One transaction around the whole load. Without it SQLite commits every INSERT
  // separately, which on the ten-thousand-row datasets costs more than everything else
  // in this function put together.
  mem.exec('BEGIN');
  for (const table of def.tables) {
    const rows = data[table.name] || [];
    if (!rows.length) continue;
    const cols = table.columns.map((c) => c.name);
    const stmt = mem.prepare(
      `INSERT INTO ${table.name} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`
    );
    for (const row of rows) stmt.run(...cols.map((c) => (row[c] === undefined ? null : row[c])));
  }
  mem.exec('COMMIT');
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

// The whole dataset as plain JSON, for the Python notebook.
//
// SQL tasks execute server-side against SQLite; Python executes in the learner's own
// browser under Pyodide, so the data has to travel to them. It is the same generated
// fixture either way — no real user data is ever in it — so shipping it to the client
// gives nothing away. Rows come out of the built database rather than straight from the
// generator, so the notebook and the SQL terminal can never disagree about what a table
// contains.
function dumpDataset(key) {
  const def = getDataset(key);
  const mem = buildDatasetDb(key);
  try {
    const out = {};
    for (const t of def.tables) out[t.name] = mem.prepare(`SELECT * FROM ${t.name}`).all();
    return out;
  } finally {
    mem.close();
  }
}

module.exports = { DATASETS, DEFAULT_DATASET, getDataset, buildDatasetDb, describeDataset, dumpDataset, makeRng };
