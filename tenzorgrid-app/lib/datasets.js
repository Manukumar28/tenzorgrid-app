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
