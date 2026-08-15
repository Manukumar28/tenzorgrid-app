// Dashboard "insights" panel: market value estimate, an upskill target, and
// best-fit jobs with what's missing to close the gap. Rule-based by default
// (transparent, always available); upgraded to AI-assisted reasoning for the
// narrative fields when ANTHROPIC_API_KEY is configured. The best-fit job list
// always comes from the real seeded jobs table, even in AI mode, since the AI
// model has no access to that data itself.
const { db } = require('./db');
const ai = require('./ai');

function heuristicInsights(profile) {
  const skills = new Set((profile.skills || []).map((s) => s.toLowerCase()));
  const jobs = db.prepare('SELECT * FROM jobs').all();

  const scored = jobs.map((job) => {
    const required = JSON.parse(job.required_skills_json);
    const matched = required.filter((s) => skills.has(s.toLowerCase()));
    const overlap = required.length ? matched.length / required.length : 0;
    return { job, required, matched, overlap };
  }).sort((a, b) => b.overlap - a.overlap);

  const withOverlap = scored.filter((s) => s.overlap > 0);
  const pool = withOverlap.length ? withOverlap.slice(0, 5) : scored.slice(0, 5);

  const salaries = pool.map((s) => (s.job.salary_min + s.job.salary_max) / 2).filter(Boolean);
  const marketValue = salaries.length ? Math.round(salaries.reduce((a, b) => a + b, 0) / salaries.length) : null;

  const bestJob = pool[0];
  const upskillMissing = bestJob ? bestJob.required.filter((s) => !skills.has(s.toLowerCase())).slice(0, 4) : [];

  return {
    marketValueLabel: marketValue ? `₹${marketValue.toLocaleString('en-IN')}/yr` : 'Add a few more skills to estimate this',
    upskillTarget: bestJob ? bestJob.job.title : null,
    upskillMissing,
    summary: bestJob
      ? `Your profile is closest to ${bestJob.job.title} roles — closing ${upskillMissing.length || 0} skill gap${upskillMissing.length === 1 ? '' : 's'} would strengthen your matches.`
      : 'Add your skills and experience to unlock personalized insights.',
    bestFit: pool.slice(0, 3).map((s) => ({
      title: s.job.title,
      company: s.job.company,
      matchPct: Math.min(99, Math.round(35 + s.overlap * 65)),
      missing: s.required.filter((r) => !skills.has(r.toLowerCase())).slice(0, 3),
    })),
    source: 'heuristic',
  };
}

async function aiInsights(profile) {
  if (!ai.isAvailable()) return null;
  const prompt = `A job seeker has this profile: role="${profile.role || 'unknown'}", ` +
    `experienceYears=${profile.experienceYears || 0}, currentSalary=${profile.currentSalary || 'unknown'} INR/yr, ` +
    `skills=${(profile.skills || []).join(', ') || 'none listed'}. This is for the Indian job market. ` +
    `Return strict JSON with exactly these keys: marketValueLabel (short string estimate of market salary range ` +
    `for this role/experience level in INR per year, e.g. "₹18L–24L/yr"), upskillTarget (a specific, realistic ` +
    `next-level role title to aim for), upskillMissing (array of up to 4 specific skills to learn to reach that ` +
    `role), summary (one encouraging, specific sentence under 25 words). Return ONLY the JSON object.`;
  try {
    const raw = await ai.callClaude({ prompt, maxTokens: 400 });
    const json = ai.extractJson(raw);
    if (!json) return null;
    return {
      marketValueLabel: typeof json.marketValueLabel === 'string' ? json.marketValueLabel : null,
      upskillTarget: typeof json.upskillTarget === 'string' ? json.upskillTarget : null,
      upskillMissing: Array.isArray(json.upskillMissing) ? json.upskillMissing.filter((s) => typeof s === 'string').slice(0, 4) : [],
      summary: typeof json.summary === 'string' ? json.summary : null,
    };
  } catch (e) {
    console.error('AI insights failed, falling back to heuristic:', e.message);
    return null;
  }
}

async function computeInsights(profile) {
  const heuristic = heuristicInsights(profile);
  const aiResult = await aiInsights(profile);
  if (!aiResult) return heuristic;
  return {
    ...heuristic,
    ...Object.fromEntries(Object.entries(aiResult).filter(([, v]) => v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0))),
    bestFit: heuristic.bestFit, // always grounded in real job data
    source: 'ai',
  };
}

module.exports = { computeInsights };
