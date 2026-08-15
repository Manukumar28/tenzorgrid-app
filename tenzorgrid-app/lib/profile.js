const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { db, UPLOADS_DIR, cryptoRandomId } = require('./db');

const MAX_CV_BYTES = 8 * 1024 * 1024; // 8MB
const MAX_PHOTO_BYTES = 1.5 * 1024 * 1024; // 1.5MB
const ALLOWED_CV_MIME = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
const ALLOWED_PHOTO_MIME = new Set(['image/png', 'image/jpeg', 'image/webp']);

function getProfile(userId) {
  const row = db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(userId);
  if (!row) return null;
  return {
    name: row.name,
    role: row.current_role,
    experienceYears: row.experience_years,
    currentSalary: row.current_salary,
    expectedSalary: row.expected_salary,
    relocation: row.relocation,
    notes: row.notes,
    skills: row.skills_json ? JSON.parse(row.skills_json) : [],
    cvFilename: row.cv_filename,
    hasCv: Boolean(row.cv_stored_name),
    photoUrl: row.photo_data_url || null,
    updatedAt: row.updated_at,
  };
}

function savePhoto(userId, photo) {
  // photo: { mime, dataBase64 }
  if (!photo || !photo.dataBase64) {
    const err = new Error('No photo data provided.');
    err.code = 'BAD_PHOTO';
    throw err;
  }
  if (!ALLOWED_PHOTO_MIME.has(photo.mime)) {
    const err = new Error('Photo must be a PNG, JPG, or WEBP image.');
    err.code = 'BAD_PHOTO_TYPE';
    throw err;
  }
  const buffer = Buffer.from(photo.dataBase64, 'base64');
  if (buffer.length > MAX_PHOTO_BYTES) {
    const err = new Error('Photo is too large (max 1.5MB).');
    err.code = 'PHOTO_TOO_LARGE';
    throw err;
  }
  const existing = db.prepare('SELECT user_id FROM profiles WHERE user_id = ?').get(userId);
  if (!existing) {
    const err = new Error('Complete your profile before adding a photo.');
    err.code = 'NO_PROFILE';
    throw err;
  }
  const dataUrl = `data:${photo.mime};base64,${photo.dataBase64}`;
  db.prepare('UPDATE profiles SET photo_data_url = ?, updated_at = ? WHERE user_id = ?')
    .run(dataUrl, new Date().toISOString(), userId);
  return dataUrl;
}

function saveCvFile(userId, cv) {
  // cv: { filename, mime, dataBase64 }
  if (!cv || !cv.dataBase64) return { storedName: null, filename: null, mime: null };
  if (!ALLOWED_CV_MIME.has(cv.mime)) {
    const err = new Error('CV must be a PDF or Word document.');
    err.code = 'BAD_CV_TYPE';
    throw err;
  }
  const buffer = Buffer.from(cv.dataBase64, 'base64');
  if (buffer.length > MAX_CV_BYTES) {
    const err = new Error('CV file is too large (max 8MB).');
    err.code = 'CV_TOO_LARGE';
    throw err;
  }
  const ext = cv.mime === 'application/pdf' ? '.pdf' : '.docx';
  const storedName = `${userId}-${cryptoRandomId()}${ext}`;
  fs.writeFileSync(path.join(UPLOADS_DIR, storedName), buffer);
  return { storedName, filename: cv.filename || 'resume' + ext, mime: cv.mime };
}

function upsertProfile(userId, input) {
  const now = new Date().toISOString();
  const existing = db.prepare('SELECT user_id, cv_stored_name FROM profiles WHERE user_id = ?').get(userId);

  let cvInfo = { storedName: existing ? existing.cv_stored_name : null, filename: null, mime: null };
  if (input.cv && input.cv.dataBase64) {
    // Replace any previous CV file.
    if (existing && existing.cv_stored_name) {
      const oldPath = path.join(UPLOADS_DIR, existing.cv_stored_name);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    cvInfo = saveCvFile(userId, input.cv);
  }

  const skills = Array.isArray(input.skills) ? input.skills.filter(Boolean).slice(0, 40) : [];

  if (existing) {
    db.prepare(`
      UPDATE profiles SET
        name = ?, current_role = ?, experience_years = ?, current_salary = ?, expected_salary = ?,
        relocation = ?, notes = ?, skills_json = ?,
        cv_filename = COALESCE(?, cv_filename), cv_stored_name = COALESCE(?, cv_stored_name), cv_mime = COALESCE(?, cv_mime),
        updated_at = ?
      WHERE user_id = ?
    `).run(
      input.name, input.role, input.experienceYears, input.currentSalary, input.expectedSalary,
      input.relocation, input.notes || '', JSON.stringify(skills),
      cvInfo.filename, cvInfo.storedName, cvInfo.mime,
      now, userId
    );
  } else {
    db.prepare(`
      INSERT INTO profiles (
        user_id, name, current_role, experience_years, current_salary, expected_salary,
        relocation, notes, skills_json, cv_filename, cv_stored_name, cv_mime, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId, input.name, input.role, input.experienceYears, input.currentSalary, input.expectedSalary,
      input.relocation, input.notes || '', JSON.stringify(skills),
      cvInfo.filename, cvInfo.storedName, cvInfo.mime, now, now
    );
  }

  return getProfile(userId);
}

// Simple, explainable overlap-based match score: (matching skills / required skills).
// This is a rule-based v1 stand-in for the real AI-driven matching described in the PRD —
// intentionally transparent rather than a black box, and easy to swap out later.
function computeMatches(userSkills) {
  const normalizedUser = new Set((userSkills || []).map((s) => s.trim().toLowerCase()));
  const jobs = db.prepare('SELECT * FROM jobs ORDER BY posted_at DESC').all();
  return jobs.map((job) => {
    const required = JSON.parse(job.required_skills_json);
    const matched = required.filter((s) => normalizedUser.has(s.trim().toLowerCase()));
    const missing = required.filter((s) => !normalizedUser.has(s.trim().toLowerCase()));
    const rawScore = required.length ? matched.length / required.length : 0;
    // Floor at 35% so an empty/sparse profile doesn't show a discouraging 0% —
    // mirrors "at least some baseline fit" the way a recruiter skim would.
    const score = Math.round(35 + rawScore * 65);
    return {
      id: job.id,
      title: job.title,
      company: job.company,
      portal: job.portal,
      location: job.location,
      salaryMin: job.salary_min,
      salaryMax: job.salary_max,
      matchScore: Math.min(99, score),
      matchedSkills: matched,
      missingSkills: missing,
    };
  }).sort((a, b) => b.matchScore - a.matchScore);
}

module.exports = { getProfile, upsertProfile, computeMatches, savePhoto, UPLOADS_DIR };
