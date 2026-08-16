const { db, cryptoRandomId } = require('./db');

function listCertifications(userId) {
  const rows = db.prepare(
    'SELECT * FROM certifications WHERE user_id = ? ORDER BY COALESCE(issue_year, 0) DESC'
  ).all(userId);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    issuer: r.issuer,
    issueYear: r.issue_year,
    expiryYear: r.expiry_year,
    credentialId: r.credential_id || '',
    credentialUrl: r.credential_url || '',
  }));
}

function addCertification(userId, input) {
  if (!input.name || !input.name.trim()) {
    const err = new Error('Certification name is required.');
    err.code = 'BAD_CERTIFICATION';
    throw err;
  }
  if (!input.issuer || !input.issuer.trim()) {
    const err = new Error('Issuing organization is required.');
    err.code = 'BAD_CERTIFICATION';
    throw err;
  }
  const id = cryptoRandomId();
  db.prepare(`
    INSERT INTO certifications (id, user_id, name, issuer, issue_year, expiry_year, credential_id, credential_url, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, userId, input.name.trim(), input.issuer.trim(),
    input.issueYear ? Number(input.issueYear) : null,
    input.expiryYear ? Number(input.expiryYear) : null,
    (input.credentialId || '').trim() || null,
    (input.credentialUrl || '').trim() || null,
    new Date().toISOString()
  );
  return { id };
}

function deleteCertification(userId, id) {
  db.prepare('DELETE FROM certifications WHERE id = ? AND user_id = ?').run(id, userId);
}

module.exports = { listCertifications, addCertification, deleteCertification };
