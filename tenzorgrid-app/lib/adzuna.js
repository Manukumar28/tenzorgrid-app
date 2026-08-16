// Fetches real job postings from the Adzuna API (https://developer.adzuna.com/).
// Free tier: 250 calls/month, so the query list below is kept small and each
// refresh only pulls page 1 for each query (see jobsync.js for the schedule).
const https = require('node:https');
const { SKILLS } = require('./skills-data');

const APP_ID = process.env.ADZUNA_APP_ID || '';
const APP_KEY = process.env.ADZUNA_APP_KEY || '';
const COUNTRY = 'in';

// A modest spread across the role categories the app already recognizes
// (tech + the newer non-tech categories), balanced against the free call budget.
const QUERIES = [
  'software engineer',
  'data analyst',
  'accountant',
  'customer support',
  'sales executive',
  'hr executive',
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

// Cheap deterministic skill tagging: scan title+description for known skill
// strings from our own taxonomy, since Adzuna doesn't return structured skills.
function extractSkillsFromText(text) {
  const lower = (text || '').toLowerCase();
  const found = [];
  for (const skill of SKILLS) {
    if (lower.includes(skill.toLowerCase())) {
      found.push(skill);
      if (found.length >= 8) break;
    }
  }
  return found;
}

function normalizeAdzunaResult(r) {
  return {
    source: 'adzuna',
    externalId: String(r.id),
    title: r.title || 'Untitled role',
    company: (r.company && r.company.display_name) || 'Unknown company',
    location: (r.location && r.location.display_name) || '',
    description: r.description || '',
    applyUrl: r.redirect_url || '',
    coreRole: (r.category && r.category.label) || null,
    skills: extractSkillsFromText(`${r.title} ${r.description}`),
    salaryMin: r.salary_min || null,
    salaryMax: r.salary_max || null,
    postedAt: r.created || null,
  };
}

async function fetchAdzunaJobs(what, { page = 1, resultsPerPage = 20 } = {}) {
  if (!isAdzunaConfigured()) throw new Error('Adzuna not configured (missing ADZUNA_APP_ID / ADZUNA_APP_KEY)');
  const params = new URLSearchParams({
    app_id: APP_ID,
    app_key: APP_KEY,
    results_per_page: String(resultsPerPage),
    'content-type': 'application/json',
    what,
  });
  const url = `https://api.adzuna.com/v1/api/jobs/${COUNTRY}/search/${page}?${params.toString()}`;
  const json = await fetchJson(url);
  return (json.results || []).map(normalizeAdzunaResult);
}

async function fetchAllConfiguredJobs() {
  const all = [];
  for (const what of QUERIES) {
    try {
      const jobs = await fetchAdzunaJobs(what);
      all.push(...jobs);
    } catch (e) {
      console.error(`[adzuna] fetch failed for "${what}":`, e.message);
    }
  }
  return all;
}

module.exports = { isAdzunaConfigured, fetchAdzunaJobs, fetchAllConfiguredJobs };
