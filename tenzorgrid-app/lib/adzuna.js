// Fetches real job postings from the Adzuna API (https://developer.adzuna.com/).
// Free tier: 250 calls/month. Each query below costs exactly 1 call regardless of
// results_per_page, so we ask for the max (50) rather than trading coverage for
// call budget — see jobsync.js for the refresh schedule.
const https = require('node:https');
const { SKILL_CATEGORIES } = require('./skills-data');

const APP_ID = process.env.ADZUNA_APP_ID || '';
const APP_KEY = process.env.ADZUNA_APP_KEY || '';
const COUNTRY = 'in';

const SOFT_SKILLS_CATEGORY = 'Leadership & soft skills';
const SOFT_SKILLS = (SKILL_CATEGORIES.find((c) => c.category === SOFT_SKILLS_CATEGORY) || { skills: [] }).skills;

// Each query is scoped to the skill categories relevant to that profession, so
// extraction pulls domain-specific skills instead of generic filler ("Leadership",
// "Communication") that shows up in almost every job description and used to make
// every match score converge on ~99% regardless of actual fit.
const QUERIES = [
  { query: 'software engineer', categories: ['Programming languages', 'Frontend', 'Backend', 'Data & databases', 'Cloud & DevOps'] },
  { query: 'data analyst', categories: ['Data science & AI', 'Data & databases', 'Programming languages'] },
  { query: 'accountant', categories: ['Accounting & bookkeeping', 'Finance & operations'] },
  { query: 'customer support', categories: ['Customer service & support'] },
  { query: 'sales executive', categories: ['Sales & marketing'] },
  { query: 'hr executive', categories: ['HR & entrepreneurship'] },
];

function isAdzunaConfigured() {
  return Boolean(APP_ID && APP_KEY);
}

function fetchJson(urlStr) {
  return new Promise((resolve, reject) => {
    https.get(urlStr, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
        } else {
          reject(new Error(`Adzuna request failed: ${res.statusCode} ${data.slice(0, 300)}`));
        }
      });
    }).on('error', reject);
  });
}

// Scoped, domain-specific skill tagging: only scans skill lists relevant to the
// query's profession. Falls back to scanning every category if that turns up
// nothing (e.g. an oddly-worded posting), so we're not left with zero skills.
function extractSkillsFromText(text, categoryNames) {
  const lower = (text || '').toLowerCase();
  const pools = SKILL_CATEGORIES.filter((c) => categoryNames.includes(c.category));
  const scan = (list) => {
    const found = [];
    for (const skill of list) {
      if (lower.includes(skill.toLowerCase())) {
        found.push(skill);
        if (found.length >= 8) break;
      }
    }
    return found;
  };
  const scoped = scan(pools.flatMap((c) => c.skills));
  if (scoped.length) return scoped;
  return scan(SKILL_CATEGORIES.filter((c) => c.category !== SOFT_SKILLS_CATEGORY).flatMap((c) => c.skills));
}

// Soft/transferable skills are tracked separately from mandatory domain skills so
// they contribute a small bonus to match scoring instead of dominating it.
function extractSoftSkills(text) {
  const lower = (text || '').toLowerCase();
  const found = [];
  for (const skill of SOFT_SKILLS) {
    if (lower.includes(skill.toLowerCase())) {
      found.push(skill);
      if (found.length >= 3) break;
    }
  }
  return found;
}

function normalizeAdzunaResult(r, queryMeta) {
  const text = `${r.title} ${r.description}`;
  return {
    source: 'adzuna',
    externalId: String(r.id),
    title: r.title || 'Untitled role',
    company: (r.company && r.company.display_name) || 'Unknown company',
    location: (r.location && r.location.display_name) || '',
    description: r.description || '',
    applyUrl: r.redirect_url || '',
    coreRole: queryMeta.query,
    skills: extractSkillsFromText(text, queryMeta.categories),
    softSkills: extractSoftSkills(text),
    salaryMin: r.salary_min || null,
    salaryMax: r.salary_max || null,
    postedAt: r.created || null,
  };
}

async function fetchAdzunaJobs(queryMeta, { page = 1, resultsPerPage = 50 } = {}) {
  if (!isAdzunaConfigured()) throw new Error('Adzuna not configured (missing ADZUNA_APP_ID / ADZUNA_APP_KEY)');
  const params = new URLSearchParams({
    app_id: APP_ID,
    app_key: APP_KEY,
    results_per_page: String(resultsPerPage),
    'content-type': 'application/json',
    what: queryMeta.query,
  });
  const url = `https://api.adzuna.com/v1/api/jobs/${COUNTRY}/search/${page}?${params.toString()}`;
  const json = await fetchJson(url);
  return (json.results || []).map((r) => normalizeAdzunaResult(r, queryMeta));
}

// Adzuna's redirect_url is a tracking link, not the real job board — this resolves
// it to the actual destination host (e.g. "indeed.com", a company's own domain)
// so the UI can show the real portal name/logo. Bounded hops + timeout + capped
// concurrency so a slow/broken redirect can't stall the whole sync.
function resolveFinalHost(urlStr, hopsLeft = 4) {
  return new Promise((resolve) => {
    if (!urlStr || hopsLeft <= 0) return resolve(null);
    let settled = false;
    const done = (val) => { if (!settled) { settled = true; resolve(val); } };
    let target;
    try { target = new URL(urlStr); } catch { return resolve(null); }
    const req = https.request({
      hostname: target.hostname,
      path: target.pathname + target.search,
      method: 'HEAD',
      timeout: 4000,
    }, (res) => {
      const loc = res.headers.location;
      if (res.statusCode >= 300 && res.statusCode < 400 && loc) {
        resolveFinalHost(new URL(loc, target).toString(), hopsLeft - 1).then(done);
      } else {
        done(target.hostname.replace(/^www\./, ''));
      }
      res.resume();
    });
    req.on('timeout', () => { req.destroy(); done(null); });
    req.on('error', () => done(null));
    req.end();
  });
}

async function withConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let i = 0;
  async function next() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await worker(items[idx]).catch(() => null);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, next));
  return results;
}

async function fetchAllConfiguredJobs() {
  const all = [];
  for (const queryMeta of QUERIES) {
    try {
      const jobs = await fetchAdzunaJobs(queryMeta);
      all.push(...jobs);
    } catch (e) {
      console.error(`[adzuna] fetch failed for "${queryMeta.query}":`, e.message);
    }
  }
  const hosts = await withConcurrency(all, 8, (job) => resolveFinalHost(job.applyUrl));
  all.forEach((job, idx) => { job.portalDomain = hosts[idx] || null; });
  return all;
}

module.exports = { isAdzunaConfigured, fetchAdzunaJobs, fetchAllConfiguredJobs };
