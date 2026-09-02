const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const { URL } = require('node:url');

const { createUser, authenticate, createSession, getUserBySession, destroySession, parseCookies, getUserExtras, setPro, SESSION_DAYS } = require('./lib/auth');
const { getProfile, upsertProfile, computeMatches, UPLOADS_DIR } = require('./lib/profile');
const { extractFromCv } = require('./lib/cvparse');
const { SKILLS, SKILL_CATEGORIES } = require('./lib/skills-data');
const { listExperiences, addExperience, deleteExperience } = require('./lib/experience');
const { listCertifications, addCertification, deleteCertification } = require('./lib/certifications');
const { listEducation, addEducation, deleteEducation } = require('./lib/education');
const { savePhoto } = require('./lib/profile');
const { computeInsights } = require('./lib/insights');
const { syncJobsFromAdzuna } = require('./lib/jobsync');
const workspace = require('./lib/workspace');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const MAX_BODY_BYTES = 12 * 1024 * 1024; // 12MB (accommodates base64 CV upload)

// In-memory sliding-window rate limiter for login/signup — a single Railway instance
// keeps this in process memory (resets on restart/redeploy), which is fine here: the
// goal is just to make brute-force password guessing and mass fake-account creation
// slow and annoying, not airtight. Keyed by client IP.
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX = 10;
const rateLimitHits = new Map(); // `${bucket}:${ip}` -> [timestamps]
function isRateLimited(bucket, req) {
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const hits = (rateLimitHits.get(key) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  hits.push(now);
  rateLimitHits.set(key, hits);
  return hits.length > RATE_LIMIT_MAX;
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  // Needed by the self-hosted Python runtime: a browser refuses to import a module
  // served as octet-stream, and WebAssembly.instantiateStreaming refuses anything that
  // is not application/wasm.
  '.mjs': 'text/javascript; charset=utf-8',
  '.wasm': 'application/wasm',
  '.zip': 'application/zip',
  '.map': 'application/json; charset=utf-8',
};

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('Request body too large'), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (chunks.length === 0) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (e) {
        reject(Object.assign(new Error('Invalid JSON body'), { statusCode: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, data) {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

// Railway (and most hosts) terminate TLS at the edge and set this env var, so we can
// tell we're being served over HTTPS even though Node itself only ever sees plain HTTP
// from the proxy. Locally (no RAILWAY_ENVIRONMENT, no NODE_ENV=production) this stays
// off so the session cookie still works over plain http://localhost during development.
const IS_PRODUCTION = Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV === 'production');
const COOKIE_SECURE = IS_PRODUCTION ? '; Secure' : '';

function setSessionCookie(res, token) {
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  res.setHeader('Set-Cookie', `session=${encodeURIComponent(token)}; HttpOnly; Path=/; Max-Age=${maxAge}; SameSite=Lax${COOKIE_SECURE}`);
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax${COOKIE_SECURE}`);
}

function getCurrentUser(req) {
  const cookies = parseCookies(req);
  return getUserBySession(cookies.session);
}

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function serveStatic(req, res, urlPath) {
  let filePath = urlPath === '/' ? '/landing.html' : urlPath;
  filePath = path.normalize(filePath).replace(/^(\.\.[/\\])+/, '');
  const fullPath = path.join(PUBLIC_DIR, filePath);

  if (!fullPath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.readFile(fullPath, (err, data) => {
    if (err) {
      // Friendly 404 page fallback to landing for unknown routes without a dot (SPA-ish nicety)
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Not found');
    }
    const ext = path.extname(fullPath);
    // The Python runtime is ~14MB of immutable, version-pinned files. Without a long
    // cache a learner re-downloads all of it on every visit, which would make the
    // notebook feel broken on a slow connection.
    const headers = { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' };
    if (filePath.startsWith('/pyodide/') || filePath.startsWith('/workspace-assets/')) {
      headers['Cache-Control'] = 'public, max-age=31536000, immutable';
    }
    res.writeHead(200, headers);
    res.end(data);
  });
}

async function handleApi(req, res, url) {
  const { pathname } = url;

  // ---- POST /api/signup ----
  if (pathname === '/api/signup' && req.method === 'POST') {
    if (isRateLimited('signup', req)) return sendJson(res, 429, { error: 'Too many attempts — please try again in a few minutes.' });
    const body = await readJsonBody(req);
    const email = (body.email || '').trim().toLowerCase();
    const password = body.password || '';
    const dob = (body.dob || '').trim();
    const gender = (body.gender || '').trim();
    const profession = (body.profession || '').trim();
    if (!isValidEmail(email)) return sendJson(res, 400, { error: 'Please enter a valid email address.' });
    if (password.length < 8) return sendJson(res, 400, { error: 'Password must be at least 8 characters.' });
    if (!dob) return sendJson(res, 400, { error: 'Please enter your date of birth.' });
    if (!gender) return sendJson(res, 400, { error: 'Please select a gender.' });
    if (!profession) return sendJson(res, 400, { error: 'Please select your profession.' });
    try {
      const user = createUser(email, password, { dob, gender, profession });
      const session = createSession(user.id);
      setSessionCookie(res, session.token);
      return sendJson(res, 200, { ok: true, userId: user.id });
    } catch (e) {
      if (e.code === 'EMAIL_TAKEN') return sendJson(res, 409, { error: e.message });
      console.error(e);
      return sendJson(res, 500, { error: 'Something went wrong creating your account.' });
    }
  }

  // ---- POST /api/login ----
  if (pathname === '/api/login' && req.method === 'POST') {
    if (isRateLimited('login', req)) return sendJson(res, 429, { error: 'Too many attempts — please try again in a few minutes.' });
    const body = await readJsonBody(req);
    const email = (body.email || '').trim().toLowerCase();
    const password = body.password || '';
    const user = authenticate(email, password);
    if (!user) return sendJson(res, 401, { error: 'Incorrect email or password.' });
    const session = createSession(user.id);
    setSessionCookie(res, session.token);
    return sendJson(res, 200, { ok: true });
  }

  // ---- POST /api/logout ----
  if (pathname === '/api/logout' && req.method === 'POST') {
    const cookies = parseCookies(req);
    destroySession(cookies.session);
    clearSessionCookie(res);
    return sendJson(res, 200, { ok: true });
  }

  // ---- GET /api/me ----
  if (pathname === '/api/me' && req.method === 'GET') {
    const user = getCurrentUser(req);
    if (!user) return sendJson(res, 200, { authenticated: false });
    const profile = getProfile(user.id);
    const extras = getUserExtras(user.id);
    return sendJson(res, 200, { authenticated: true, email: user.email, ...extras, hasProfile: Boolean(profile), profile });
  }

  // ---- POST /api/onboarding ----
  if (pathname === '/api/onboarding' && req.method === 'POST') {
    const user = getCurrentUser(req);
    if (!user) return sendJson(res, 401, { error: 'Please log in first.' });
    const body = await readJsonBody(req);

    if (!body.name || !body.name.trim()) return sendJson(res, 400, { error: 'Name is required.' });
    if (!body.role || !body.role.trim()) return sendJson(res, 400, { error: 'Current role is required.' });

    try {
      const profile = upsertProfile(user.id, {
        name: body.name.trim(),
        role: body.role.trim(),
        experienceYears: Number(body.experienceYears) || 0,
        currentSalary: Number(body.currentSalary) || 0,
        expectedSalary: Number(body.expectedSalary) || 0,
        relocation: body.relocation || 'No',
        notes: (body.notes || '').trim(),
        skills: body.skills || [],
        cv: body.cv || null,
      });
      return sendJson(res, 200, { ok: true, profile });
    } catch (e) {
      if (e.code === 'BAD_CV_TYPE' || e.code === 'CV_TOO_LARGE') return sendJson(res, 400, { error: e.message });
      console.error(e);
      return sendJson(res, 500, { error: 'Something went wrong saving your profile.' });
    }
  }

  // ---- GET /api/jobs ----
  // Free accounts only ever get the top 3 matches back — the full list is a Pro
  // feature, and that has to be enforced here, not just by hiding it in the UI,
  // or anyone can call this endpoint directly and read every match for free.
  if (pathname === '/api/jobs' && req.method === 'GET') {
    const user = getCurrentUser(req);
    if (!user) return sendJson(res, 401, { error: 'Please log in first.' });
    const profile = getProfile(user.id);
    const extras = getUserExtras(user.id);
    const matches = computeMatches(profile ? profile.skills : []);
    const jobs = extras.isPro ? matches : matches.slice(0, 3);
    return sendJson(res, 200, { jobs, totalCount: matches.length });
  }

  // ---- GET /api/cv (download own CV) ----
  if (pathname === '/api/cv' && req.method === 'GET') {
    const user = getCurrentUser(req);
    if (!user) return sendJson(res, 401, { error: 'Please log in first.' });
    const profile = getProfile(user.id);
    if (!profile || !profile.hasCv) return sendJson(res, 404, { error: 'No CV uploaded yet.' });
    const { db } = require('./lib/db');
    const row = db.prepare('SELECT cv_stored_name, cv_filename, cv_mime FROM profiles WHERE user_id = ?').get(user.id);
    const filePath = path.join(UPLOADS_DIR, row.cv_stored_name);
    if (!fs.existsSync(filePath)) return sendJson(res, 404, { error: 'CV file missing on server.' });
    res.writeHead(200, {
      'Content-Type': row.cv_mime || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${row.cv_filename || 'resume'}"`,
    });
    return fs.createReadStream(filePath).pipe(res);
  }

  // ---- GET /api/skills (bundled list for the autosuggestion field) ----
  if (pathname === '/api/skills' && req.method === 'GET') {
    return sendJson(res, 200, { skills: SKILLS, categories: SKILL_CATEGORIES });
  }

  // ---- POST /api/cv-parse (best-effort text extraction + field guessing from an uploaded CV) ----
  // If no file is included in the body, falls back to re-scanning the CV already on file for this
  // user, so the dashboard can offer "re-scan my CV" without requiring a fresh upload each time.
  if (pathname === '/api/cv-parse' && req.method === 'POST') {
    const user = getCurrentUser(req);
    if (!user) return sendJson(res, 401, { error: 'Please log in first.' });
    const body = await readJsonBody(req);
    try {
      let buffer, mime;
      if (body.cv && body.cv.dataBase64) {
        buffer = Buffer.from(body.cv.dataBase64, 'base64');
        mime = body.cv.mime;
      } else {
        const { db } = require('./lib/db');
        const row = db.prepare('SELECT cv_stored_name, cv_mime FROM profiles WHERE user_id = ?').get(user.id);
        if (!row || !row.cv_stored_name) return sendJson(res, 400, { error: 'No CV on file — please upload one.' });
        const filePath = path.join(UPLOADS_DIR, row.cv_stored_name);
        if (!fs.existsSync(filePath)) return sendJson(res, 404, { error: 'CV file missing on server.' });
        buffer = fs.readFileSync(filePath);
        mime = row.cv_mime;
      }
      const result = await extractFromCv(buffer, mime);
      return sendJson(res, 200, result);
    } catch (e) {
      console.error('CV parse error:', e);
      return sendJson(res, 200, { name: null, role: null, experienceYears: null, skills: [], experience: [], certifications: [], education: [], source: 'none' });
    }
  }

  // ---- POST /api/photo (profile photo upload) ----
  if (pathname === '/api/photo' && req.method === 'POST') {
    const user = getCurrentUser(req);
    if (!user) return sendJson(res, 401, { error: 'Please log in first.' });
    const body = await readJsonBody(req);
    try {
      const photoUrl = savePhoto(user.id, body.photo || null);
      return sendJson(res, 200, { ok: true, photoUrl });
    } catch (e) {
      if (['BAD_PHOTO', 'BAD_PHOTO_TYPE', 'PHOTO_TOO_LARGE', 'NO_PROFILE'].includes(e.code)) {
        return sendJson(res, 400, { error: e.message });
      }
      console.error(e);
      return sendJson(res, 500, { error: 'Something went wrong saving your photo.' });
    }
  }

  // ---- GET /api/experiences / POST /api/experiences / DELETE /api/experiences/:id ----
  if (pathname === '/api/experiences' && req.method === 'GET') {
    const user = getCurrentUser(req);
    if (!user) return sendJson(res, 401, { error: 'Please log in first.' });
    return sendJson(res, 200, { experiences: listExperiences(user.id) });
  }
  if (pathname === '/api/experiences' && req.method === 'POST') {
    const user = getCurrentUser(req);
    if (!user) return sendJson(res, 401, { error: 'Please log in first.' });
    const body = await readJsonBody(req);
    try {
      addExperience(user.id, body);
      return sendJson(res, 200, { experiences: listExperiences(user.id) });
    } catch (e) {
      if (e.code === 'BAD_EXPERIENCE') return sendJson(res, 400, { error: e.message });
      console.error(e);
      return sendJson(res, 500, { error: 'Something went wrong saving that role.' });
    }
  }
  const expMatch = pathname.match(/^\/api\/experiences\/([a-f0-9]+)$/);
  if (expMatch && req.method === 'DELETE') {
    const user = getCurrentUser(req);
    if (!user) return sendJson(res, 401, { error: 'Please log in first.' });
    deleteExperience(user.id, expMatch[1]);
    return sendJson(res, 200, { experiences: listExperiences(user.id) });
  }

  // ---- GET /api/certifications / POST /api/certifications / DELETE /api/certifications/:id ----
  if (pathname === '/api/certifications' && req.method === 'GET') {
    const user = getCurrentUser(req);
    if (!user) return sendJson(res, 401, { error: 'Please log in first.' });
    return sendJson(res, 200, { certifications: listCertifications(user.id) });
  }
  if (pathname === '/api/certifications' && req.method === 'POST') {
    const user = getCurrentUser(req);
    if (!user) return sendJson(res, 401, { error: 'Please log in first.' });
    const body = await readJsonBody(req);
    try {
      addCertification(user.id, body);
      return sendJson(res, 200, { certifications: listCertifications(user.id) });
    } catch (e) {
      if (e.code === 'BAD_CERTIFICATION') return sendJson(res, 400, { error: e.message });
      console.error(e);
      return sendJson(res, 500, { error: 'Something went wrong saving that certification.' });
    }
  }
  const certMatch = pathname.match(/^\/api\/certifications\/([a-f0-9]+)$/);
  if (certMatch && req.method === 'DELETE') {
    const user = getCurrentUser(req);
    if (!user) return sendJson(res, 401, { error: 'Please log in first.' });
    deleteCertification(user.id, certMatch[1]);
    return sendJson(res, 200, { certifications: listCertifications(user.id) });
  }

  // ---- GET /api/education / POST /api/education / DELETE /api/education/:id ----
  if (pathname === '/api/education' && req.method === 'GET') {
    const user = getCurrentUser(req);
    if (!user) return sendJson(res, 401, { error: 'Please log in first.' });
    return sendJson(res, 200, { education: listEducation(user.id) });
  }
  if (pathname === '/api/education' && req.method === 'POST') {
    const user = getCurrentUser(req);
    if (!user) return sendJson(res, 401, { error: 'Please log in first.' });
    const body = await readJsonBody(req);
    try {
      addEducation(user.id, body);
      return sendJson(res, 200, { education: listEducation(user.id) });
    } catch (e) {
      if (e.code === 'BAD_EDUCATION') return sendJson(res, 400, { error: e.message });
      console.error(e);
      return sendJson(res, 500, { error: 'Something went wrong saving that qualification.' });
    }
  }
  const eduMatch = pathname.match(/^\/api\/education\/([a-f0-9]+)$/);
  if (eduMatch && req.method === 'DELETE') {
    const user = getCurrentUser(req);
    if (!user) return sendJson(res, 401, { error: 'Please log in first.' });
    deleteEducation(user.id, eduMatch[1]);
    return sendJson(res, 200, { education: listEducation(user.id) });
  }

  // ---- POST /api/subscribe (dev-mode instant Pro activation; no payment gateway yet) ----
  if (pathname === '/api/subscribe' && req.method === 'POST') {
    const user = getCurrentUser(req);
    if (!user) return sendJson(res, 401, { error: 'Please log in first.' });
    setPro(user.id, true);
    return sendJson(res, 200, { ok: true, isPro: true });
  }

  // ---- GET /api/insights (market value, upskill target, best-fit jobs) ----
  if (pathname === '/api/insights' && req.method === 'GET') {
    const user = getCurrentUser(req);
    if (!user) return sendJson(res, 401, { error: 'Please log in first.' });
    const profile = getProfile(user.id);
    if (!profile) return sendJson(res, 404, { error: 'Complete your profile first.' });
    try {
      const insights = await computeInsights(profile);
      return sendJson(res, 200, insights);
    } catch (e) {
      console.error('Insights error:', e);
      return sendJson(res, 500, { error: 'Could not compute insights right now.' });
    }
  }

  // ---- Virtual Workspace (P0: Data Analyst, IC track only, no billing gate yet) ----
  if (pathname === '/api/workspace/state' && req.method === 'GET') {
    const user = getCurrentUser(req);
    if (!user) return sendJson(res, 401, { error: 'Please log in first.' });
    return sendJson(res, 200, { state: workspace.getState(user.id) });
  }

  if (pathname === '/api/workspace/enroll' && req.method === 'POST') {
    const user = getCurrentUser(req);
    if (!user) return sendJson(res, 401, { error: 'Please log in first.' });
    const body = await readJsonBody(req);
    const level = ['junior', 'senior'].includes(body.level) ? body.level : 'junior';
    const scheduleType = ['weekdays', 'weekends', 'custom'].includes(body.scheduleType) ? body.scheduleType : 'weekdays';
    try {
      const enrollment = workspace.startEnrollment(user.id, { level, scheduleType, scheduleDays: body.scheduleDays });
      return sendJson(res, 200, { enrollment, state: workspace.getState(user.id) });
    } catch (e) {
      console.error('Workspace enroll error:', e);
      return sendJson(res, 500, { error: 'Could not start Virtual Workspace right now.' });
    }
  }

  if (pathname === '/api/workspace/skill-test' && req.method === 'POST') {
    const user = getCurrentUser(req);
    if (!user) return sendJson(res, 401, { error: 'Please log in first.' });
    const body = await readJsonBody(req);
    try {
      return sendJson(res, 200, workspace.submitSkillTest(user.id, body.answers));
    } catch (e) {
      return sendJson(res, 400, { error: e.message });
    }
  }

  if (pathname === '/api/workspace/checkin' && req.method === 'POST') {
    const user = getCurrentUser(req);
    if (!user) return sendJson(res, 401, { error: 'Please log in first.' });
    try {
      return sendJson(res, 200, { state: workspace.checkIn(user.id) });
    } catch (e) {
      return sendJson(res, 400, { error: e.message });
    }
  }

  const taskSubmitMatch = pathname.match(/^\/api\/workspace\/tasks\/([a-f0-9]+)\/submit$/);
  if (taskSubmitMatch && req.method === 'POST') {
    const user = getCurrentUser(req);
    if (!user) return sendJson(res, 401, { error: 'Please log in first.' });
    const body = await readJsonBody(req);
    // `sql` for the Data Terminal, `code` + `result` for the Python notebook (whose
    // output is computed in the browser, since that is where Pyodide runs).
    const code = typeof body.code === 'string' ? body.code : body.sql;
    if (!code || typeof code !== 'string') return sendJson(res, 400, { error: 'Your work is required.' });
    try {
      const result = await workspace.submitTask(user.id, taskSubmitMatch[1], code, body.result);
      return sendJson(res, 200, { ...result, state: workspace.getState(user.id) });
    } catch (e) {
      return sendJson(res, 400, { error: e.message });
    }
  }

  // The project document a learner reads before starting. Read-only.
  const projectBriefMatch = pathname.match(/^\/api\/workspace\/projects\/([a-z0-9-]+)\/brief$/);
  if (projectBriefMatch && req.method === 'GET') {
    const user = getCurrentUser(req);
    if (!user) return sendJson(res, 401, { error: 'Please log in first.' });
    try {
      return sendJson(res, 200, { brief: workspace.getProjectBrief(user.id, projectBriefMatch[1]) });
    } catch (e) {
      return sendJson(res, 400, { error: e.message });
    }
  }

  // Workbench bootstrap: the task, plus the schema of the dataset it is graded against.
  const workbenchMatch = pathname.match(/^\/api\/workspace\/tasks\/([a-zA-Z0-9_-]+)\/workbench$/);
  if (workbenchMatch && req.method === 'GET') {
    const user = getCurrentUser(req);
    if (!user) return sendJson(res, 401, { error: 'Please log in first.' });
    try {
      return sendJson(res, 200, { workbench: workspace.getWorkbench(user.id, workbenchMatch[1]) });
    } catch (e) {
      return sendJson(res, 400, { error: e.message });
    }
  }

  // The learner's answer to Asha's review question. This is what actually completes a
  // task — grading alone no longer does.
  const reviewMatch = pathname.match(/^\/api\/workspace\/tasks\/([a-zA-Z0-9_-]+)\/review$/);
  if (reviewMatch && req.method === 'POST') {
    const user = getCurrentUser(req);
    if (!user) return sendJson(res, 401, { error: 'Please log in first.' });
    const body = await readJsonBody(req);
    if (!body.answer || typeof body.answer !== 'string') return sendJson(res, 400, { error: 'Write your answer first.' });
    try {
      return sendJson(res, 200, await workspace.answerReview(user.id, reviewMatch[1], body.answer));
    } catch (e) {
      return sendJson(res, 400, { error: e.message });
    }
  }

  // The project dataset as JSON, for the Python notebook to load into pandas.
  const taskDataMatch = pathname.match(/^\/api\/workspace\/tasks\/([a-zA-Z0-9_-]+)\/data$/);
  if (taskDataMatch && req.method === 'GET') {
    const user = getCurrentUser(req);
    if (!user) return sendJson(res, 401, { error: 'Please log in first.' });
    try {
      return sendJson(res, 200, workspace.getTaskData(user.id, taskDataMatch[1]));
    } catch (e) {
      return sendJson(res, 400, { error: e.message });
    }
  }

  // Scratch run — execute SQL without submitting or grading it. Deliberately NOT rate
  // limited by the AI budget, because no AI call happens here: it is pure SQLite over a
  // throwaway in-memory database. Learners should explore as much as they want.
  const taskRunMatch = pathname.match(/^\/api\/workspace\/tasks\/([a-zA-Z0-9_-]+)\/run$/);
  if (taskRunMatch && req.method === 'POST') {
    const user = getCurrentUser(req);
    if (!user) return sendJson(res, 401, { error: 'Please log in first.' });
    const body = await readJsonBody(req);
    if (!body.sql || typeof body.sql !== 'string') return sendJson(res, 400, { error: 'A SQL query is required.' });
    try {
      return sendJson(res, 200, workspace.runScratchQuery(user.id, taskRunMatch[1], body.sql));
    } catch (e) {
      // A syntax error is expected, normal feedback here — not a server fault.
      return sendJson(res, 400, { error: e.message });
    }
  }

  const projectStartMatch = pathname.match(/^\/api\/workspace\/projects\/([a-z0-9-]+)\/start$/);
  if (projectStartMatch && req.method === 'POST') {
    const user = getCurrentUser(req);
    if (!user) return sendJson(res, 401, { error: 'Please log in first.' });
    try {
      return sendJson(res, 200, { state: workspace.startProject(user.id, projectStartMatch[1]) });
    } catch (e) {
      return sendJson(res, 400, { error: e.message });
    }
  }

  if (pathname === '/api/workspace/messages' && req.method === 'POST') {
    const user = getCurrentUser(req);
    if (!user) return sendJson(res, 401, { error: 'Please log in first.' });
    const body = await readJsonBody(req);
    if (!body.archetype || typeof body.archetype !== 'string') return sendJson(res, 400, { error: 'A recipient is required.' });
    if (!body.body || typeof body.body !== 'string') return sendJson(res, 400, { error: 'A message is required.' });
    try {
      const state = await workspace.sendLearnerMessage(user.id, body.archetype, body.body, body.subject);
      return sendJson(res, 200, { state });
    } catch (e) {
      return sendJson(res, 400, { error: e.message });
    }
  }

  if (pathname === '/api/workspace/emails/mark' && req.method === 'POST') {
    const user = getCurrentUser(req);
    if (!user) return sendJson(res, 401, { error: 'Please log in first.' });
    const body = await readJsonBody(req);
    try {
      const state = workspace.markMessages(user.id, body.ids, {
        read: typeof body.read === 'boolean' ? body.read : undefined,
        starred: typeof body.starred === 'boolean' ? body.starred : undefined,
      });
      return sendJson(res, 200, { state });
    } catch (e) {
      return sendJson(res, 400, { error: e.message });
    }
  }

  if (pathname === '/api/workspace/checklist' && req.method === 'POST') {
    const user = getCurrentUser(req);
    if (!user) return sendJson(res, 401, { error: 'Please log in first.' });
    const body = await readJsonBody(req);
    if (!body.itemKey || typeof body.itemKey !== 'string') return sendJson(res, 400, { error: 'An item key is required.' });
    try {
      const state = workspace.toggleChecklistItem(user.id, body.itemKey, Boolean(body.checked));
      return sendJson(res, 200, { state });
    } catch (e) {
      return sendJson(res, 400, { error: e.message });
    }
  }

  sendJson(res, 404, { error: 'Not found' });
}

// Baseline security headers on every response. The CSP allows 'unsafe-inline' for
// script/style because every page here is plain inline <script>/<style> (zero build
// step, zero external JS) — the real value of the policy is still blocking any
// externally-hosted script/style/frame the app itself never intended to load, plus
// frame-ancestors, which stops the whole site from being iframed for clickjacking.
function applySecurityHeaders(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    // 'wasm-unsafe-eval' is what lets the self-hosted Python runtime compile. It permits
    // WebAssembly compilation ONLY — it does not re-enable eval() or new Function() for
    // JavaScript, which is why it is used here in preference to the much broader
    // 'unsafe-eval'. Without it the notebook does not fail loudly: Pyodide logs a
    // CompileError and then hangs, so the learner sees a spinner forever.
    "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '));
  if (IS_PRODUCTION) res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
}

const server = http.createServer(async (req, res) => {
  try {
    applySecurityHeaders(req, res);
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith('/api/')) {
      await handleApi(req, res, url);
    } else {
      serveStatic(req, res, url.pathname);
    }
  } catch (err) {
    console.error(err);
    if (!res.headersSent) sendJson(res, err.statusCode || 500, { error: err.message || 'Server error' });
  }
});

server.listen(PORT, () => {
  console.log(`TenzorGrid app running at http://localhost:${PORT}`);
});

// Refresh real job postings from Adzuna shortly after boot, then once a day.
// Free-tier Adzuna budget is 250 calls/month; 6 queries/day keeps this well under it.
const JOB_SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000;
setTimeout(() => { syncJobsFromAdzuna().catch((e) => console.error('[jobsync] initial sync failed:', e.message)); }, 10 * 1000);
setInterval(() => { syncJobsFromAdzuna().catch((e) => console.error('[jobsync] scheduled sync failed:', e.message)); }, JOB_SYNC_INTERVAL_MS);
