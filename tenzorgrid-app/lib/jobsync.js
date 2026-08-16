// Pulls real listings from Adzuna and fans them out to both stores:
//  - Supabase `job_postings` (durable, private, RLS-protected archive)
//  - local SQLite `jobs` table (what computeMatches()/GET /api/jobs actually read)
// Keeping a local mirror avoids rewriting the matching engine to speak Postgres
// over HTTP on every request; Supabase stays the source-of-truth store the user
// asked for.
const { db, cryptoRandomId } = require('./db');
const { isAdzunaConfigured, fetchAllConfiguredJobs } = require('./adzuna');
const { isSupabaseConfigured, upsertJobPostings } = require('./supabase');

const insertJob = db.prepare(`
  INSERT INTO jobs (id, title, company, portal, location, required_skills_json, salary_min, salary_max, posted_at, apply_url, external_id, source, description)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

function toSupabaseRow(job) {
  return {
    source: job.source,
    external_id: job.externalId,
    title: job.title,
    company: job.company,
    location: job.location,
    apply_url: job.applyUrl,
    description: job.description,
    core_role: job.coreRole,
    mandatory_skills: job.skills,
    nice_to_have_skills: [],
    salary_perks: { min: job.salaryMin, max: job.salaryMax },
    posted_at: job.postedAt,
    is_active: true,
  };
}

async function syncJobsFromAdzuna() {
  if (!isAdzunaConfigured()) {
    console.log('[jobsync] Adzuna not configured, skipping.');
    return { fetched: 0 };
  }

  const jobs = await fetchAllConfiguredJobs();
  if (!jobs.length) {
    console.log('[jobsync] No jobs returned from Adzuna this run.');
    return { fetched: 0 };
  }

  if (isSupabaseConfigured()) {
    try {
      await upsertJobPostings(jobs.map(toSupabaseRow));
    } catch (e) {
      console.error('[jobsync] Supabase upsert failed:', e.message);
    }
  }

  db.exec('BEGIN');
  try {
    db.exec('DELETE FROM jobs');
    for (const job of jobs) {
      insertJob.run(
        cryptoRandomId(), job.title, job.company, 'Adzuna', job.location,
        JSON.stringify(job.skills || []), job.salaryMin, job.salaryMax,
        job.postedAt || new Date().toISOString(), job.applyUrl, job.externalId,
        job.source, job.description
      );
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }

  console.log(`[jobsync] Synced ${jobs.length} real job postings from Adzuna.`);
  return { fetched: jobs.length };
}

module.exports = { syncJobsFromAdzuna };
