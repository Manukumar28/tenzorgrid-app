// Real, user-managed experience cards (replaces the earlier single fabricated
// "current role" card that was just mirroring onboarding data).
const { db, cryptoRandomId } = require('./db');

function listExperiences(userId) {
  const rows = db.prepare(
    'SELECT * FROM experiences WHERE user_id = ? ORDER BY is_current DESC, COALESCE(end_year, 9999) DESC, start_year DESC'
  ).all(userId);
  return rows.map((r) => ({
    id: r.id,
    organization: r.organization,
    role: r.role,
    achievements: r.achievements || '',
    startYear: r.start_year,
    endYear: r.end_year,
    isCurrent: Boolean(r.is_current),
    salary: r.salary,
  }));
}

function addExperience(userId, input) {
  if (!input.organization || !input.organization.trim()) {
    const err = new Error('Organization name is required.');
    err.code = 'BAD_EXPERIENCE';
    throw err;
  }
  if (!input.role || !input.role.trim()) {
    const err = new Error('Role is required.');
    err.code = 'BAD_EXPERIENCE';
    throw err;
  }
  const id = cryptoRandomId();
  const isCurrent = Boolean(input.isCurrent);
  db.prepare(`
    INSERT INTO experiences (id, user_id, organization, role, achievements, start_year, end_year, is_current, salary, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, userId, input.organization.trim(), input.role.trim(), (input.achievements || '').trim(),
    input.startYear ? Number(input.startYear) : null,
    isCurrent ? null : (input.endYear ? Number(input.endYear) : null),
    isCurrent ? 1 : 0,
    input.salary ? Number(input.salary) : null,
    new Date().toISOString()
  );
  return { id };
}

function deleteExperience(userId, id) {
  db.prepare('DELETE FROM experiences WHERE id = ? AND user_id = ?').run(id, userId);
}

module.exports = { listExperiences, addExperience, deleteExperience };
