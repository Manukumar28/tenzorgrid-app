// Persists AI-generated job summaries/skills keyed by external_id, so the same
// posting reappearing across daily Adzuna syncs is never re-sent to the AI.
const { db } = require('./db');

function getCached(externalId) {
  const row = db.prepare('SELECT * FROM job_ai_cache WHERE external_id = ?').get(externalId);
  if (!row) return null;
  return {
    summary: row.summary || '',
    skills: JSON.parse(row.skills_json || '[]'),
    niceToHave: JSON.parse(row.nice_to_have_json || '[]'),
  };
}

function setCached(externalId, { summary, skills, niceToHave }) {
  db.prepare(`
    INSERT INTO job_ai_cache (external_id, summary, skills_json, nice_to_have_json, created_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(external_id) DO UPDATE SET summary = excluded.summary, skills_json = excluded.skills_json, nice_to_have_json = excluded.nice_to_have_json
  `).run(externalId, summary || '', JSON.stringify(skills || []), JSON.stringify(niceToHave || []), new Date().toISOString());
}

module.exports = { getCached, setCached };
