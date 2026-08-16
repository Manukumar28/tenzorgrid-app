// User-managed education/qualification cards — same pattern as experience.js.
const { db, cryptoRandomId } = require('./db');

function listEducation(userId) {
  const rows = db.prepare(
    'SELECT * FROM education WHERE user_id = ? ORDER BY is_current DESC, COALESCE(end_year, 9999) DESC, start_year DESC'
  ).all(userId);
  return rows.map((r) => ({
    id: r.id,
    institution: r.institution,
    degree: r.degree,
    fieldOfStudy: r.field_of_study || '',
    startYear: r.start_year,
    endYear: r.end_year,
    isCurrent: Boolean(r.is_current),
  }));
}

function addEducation(userId, input) {
  if (!input.institution || !input.institution.trim()) {
    const err = new Error('Institution name is required.');
    err.code = 'BAD_EDUCATION';
    throw err;
  }
  if (!input.degree || !input.degree.trim()) {
    const err = new Error('Degree / qualification is required.');
    err.code = 'BAD_EDUCATION';
    throw err;
  }
  const id = cryptoRandomId();
  const isCurrent = Boolean(input.isCurrent);
  db.prepare(`
    INSERT INTO education (id, user_id, institution, degree, field_of_study, start_year, end_year, is_current, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, userId, input.institution.trim(), input.degree.trim(), (input.fieldOfStudy || '').trim() || null,
    input.startYear ? Number(input.startYear) : null,
    isCurrent ? null : (input.endYear ? Number(input.endYear) : null),
    isCurrent ? 1 : 0,
    new Date().toISOString()
  );
  return { id };
}

function deleteEducation(userId, id) {
  db.prepare('DELETE FROM education WHERE id = ? AND user_id = ?').run(id, userId);
}

module.exports = { listEducation, addEducation, deleteEducation };
