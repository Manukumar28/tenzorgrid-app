const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const { URL } = require('node:url');

const { createUser, authenticate, createSession, getUserBySession, destroySession, parseCookies, getUserExtras, SESSION_DAYS } = require('./lib/auth');
const { getProfile, upsertProfile, computeMatches, UPLOADS_DIR } = require('./lib/profile');
const { extractFromCv } = require('./lib/cvparse');
const { SKILLS, SKILL_CATEGORIES } = require('./lib/skills-data');
const { listExperiences, addExperience, deleteExperience } = require('./lib/experience');
const { savePhoto } = require('./lib/profile');
const { computeInsights } = require('./lib/insights');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const MAX_BODY_BYTES = 12 * 1024 * 1024; // 12MB (accommodates base64 CV upload)

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
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

function setSessionCookie(res, token) {
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  res.setHeader('Set-Cookie', `session=${encodeURIComponent(token)}; HttpOnly; Path=/; Max-Age=${maxAge}; SameSite=Lax`);
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', 'session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax');
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
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

async function handleApi(req, res, url) {
  const { pathname } = url;

  // ---- POST /api/signup ----
  if (pathname === '/api/signup' && req.method === 'POST') {
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
  if (pathname === '/api/jobs' && req.method === 'GET') {
    const user = getCurrentUser(req);
    if (!user) return sendJson(res, 401, { error: 'Please log in first.' });
    const profile = getProfile(user.id);
    const matches = computeMatches(profile ? profile.skills : []);
    return sendJson(res, 200, { jobs: matches });
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
  if (pathname === '/api/cv-parse' && req.method === 'POST') {
    const user = getCurrentUser(req);
    if (!user) return sendJson(res, 401, { error: 'Please log in first.' });
    const body = await readJsonBody(req);
    if (!body.cv || !body.cv.dataBase64) return sendJson(res, 400, { error: 'No CV data provided.' });
    try {
      const buffer = Buffer.from(body.cv.dataBase64, 'base64');
      const result = await extractFromCv(buffer, body.cv.mime);
      return sendJson(res, 200, result);
    } catch (e) {
      console.error('CV parse error:', e);
      return sendJson(res, 200, { name: null, role: null, experienceYears: null, skills: [], experience: [], source: 'none' });
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

  sendJson(res, 404, { error: 'Not found' });
}

const server = http.createServer(async (req, res) => {
  try {
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
