// Minimal Supabase REST (PostgREST) client using node:https — no SDK dependency.
// Used as the durable, private store for aggregated job postings. Writes use the
// service role key so they bypass RLS (the anon key is read-only by design).
const https = require('node:https');
const { URL } = require('node:url');

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL && SERVICE_ROLE_KEY);
}

function supabaseRequest(method, pathAndQuery, body, extraHeaders) {
  return new Promise((resolve, reject) => {
    if (!isSupabaseConfigured()) {
      reject(new Error('Supabase not configured (missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)'));
      return;
    }
    const url = new URL(SUPABASE_URL + pathAndQuery);
    const payload = body != null ? Buffer.from(JSON.stringify(body)) : null;
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': payload.length } : {}),
        ...extraHeaders,
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          if (!data) return resolve(null);
          try { resolve(JSON.parse(data)); } catch { resolve(null); }
        } else {
          reject(new Error(`Supabase ${method} ${pathAndQuery} failed: ${res.statusCode} ${data.slice(0, 500)}`));
        }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// Upserts job postings keyed on (source, external_id) so re-running a fetch
// updates existing rows instead of creating duplicates.
function upsertJobPostings(rows) {
  if (!rows || !rows.length) return Promise.resolve(null);
  return supabaseRequest(
    'POST',
    '/rest/v1/job_postings?on_conflict=source,external_id',
    rows,
    { Prefer: 'resolution=merge-duplicates,return=minimal' }
  );
}

module.exports = { isSupabaseConfigured, upsertJobPostings };
