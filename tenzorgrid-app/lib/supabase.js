// Minimal Supabase REST (PostgREST) client using node:https — no SDK dependency.
// Used as the durable, private store for aggregated job postings. Writes use the
// service role key so they bypass RLS (the anon key is read-only by design).
const https = require('node:https');
const http = require('node:http');
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

// ---- Storage ---------------------------------------------------------------
//
// The database backup lives in Supabase Storage rather than in a table: it is a single
// binary blob per run, and PostgREST is the wrong shape for that. These four calls are
// the whole of the Storage API this product needs.
//
// They do not go through supabaseRequest() because that one JSON-encodes its body and is
// hard-wired to https. A gzipped database has to arrive byte-for-byte, and the backup
// test points SUPABASE_URL at a local http mock, so the transport is chosen from the URL.
function storageRequest(method, pathAndQuery, body, extraHeaders, wantBuffer) {
  return new Promise((resolve, reject) => {
    if (!isSupabaseConfigured()) {
      reject(new Error('Supabase not configured (missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)'));
      return;
    }
    const url = new URL(SUPABASE_URL + pathAndQuery);
    const transport = url.protocol === 'http:' ? http : https;
    const payload = body == null ? null
      : Buffer.isBuffer(body) ? body
        : Buffer.from(JSON.stringify(body));
    const req = transport.request({
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port || (url.protocol === 'http:' ? 80 : 443),
      path: url.pathname + url.search,
      method,
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        ...(payload ? { 'Content-Length': payload.length } : {}),
        ...extraHeaders,
      },
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        if (res.statusCode >= 200 && res.statusCode < 300) {
          if (wantBuffer) return resolve(buf);
          if (!buf.length) return resolve(null);
          try { resolve(JSON.parse(buf.toString('utf8'))); } catch { resolve(null); }
        } else {
          reject(new Error(`Supabase storage ${method} ${pathAndQuery} failed: ${res.statusCode} ${buf.toString('utf8').slice(0, 300)}`));
        }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// x-upsert lets a re-run of the same day overwrite rather than 409.
function storageUpload(bucket, key, buffer, contentType = 'application/octet-stream') {
  return storageRequest('POST', `/storage/v1/object/${bucket}/${encodeURIComponent(key)}`, buffer, {
    'Content-Type': contentType,
    'x-upsert': 'true',
  });
}

function storageDownload(bucket, key) {
  return storageRequest('GET', `/storage/v1/object/${bucket}/${encodeURIComponent(key)}`, null, {}, true);
}

function storageList(bucket, prefix = '') {
  return storageRequest('POST', `/storage/v1/object/list/${bucket}`, {
    prefix, limit: 1000, sortBy: { column: 'name', order: 'asc' },
  }, { 'Content-Type': 'application/json' });
}

function storageRemove(bucket, keys) {
  if (!keys || !keys.length) return Promise.resolve(null);
  return storageRequest('DELETE', `/storage/v1/object/${bucket}`, { prefixes: keys }, {
    'Content-Type': 'application/json',
  });
}

module.exports = {
  isSupabaseConfigured, upsertJobPostings,
  storageUpload, storageDownload, storageList, storageRemove,
};
