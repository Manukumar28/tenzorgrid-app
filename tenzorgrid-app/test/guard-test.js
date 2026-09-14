process.env.DATA_DIR = process.argv[2];
const path = require('node:path');
const ROOT = require('node:path').join(__dirname, '..');
const ws = require(path.join(ROOT, 'lib/workspace.js'));

let fails = 0;
const check = (n, c, d) => { if (c) console.log('  PASS  ' + n); else { fails++; console.log('  FAIL  ' + n + (d ? '\n        ' + d : '')); } };

const run = (sql) => {
  try { return { ok: true, rows: ws.runPracticeQuery(sql, 'hr_core').rows }; }
  catch (e) { return { ok: false, err: e.message }; }
};

console.log('1. THE REPORTED BUG — the editor\'s own starter template');
const starter = `-- Write your query here.
-- Ctrl-Space for autocomplete. Ctrl-Enter to run.

SELECT d.name AS department, AVG(e.salary) AS avg_salary
FROM employees e JOIN departments d ON d.id = e.department_id
WHERE e.exit_year IS NULL
GROUP BY d.name ORDER BY avg_salary DESC`;
const r1 = run(starter);
check('the exact query from the screenshot now runs', r1.ok, r1.err);
check('and returns 6 departments', r1.ok && r1.rows.length === 6, r1.ok ? 'rows=' + r1.rows.length : r1.err);
if (r1.ok) console.log('    top:', JSON.stringify(r1.rows[0]));

console.log('\n2. Comments no longer trip the keyword blocklist');
for (const [label, sql] of [
  ['a comment containing "delete"', "-- don't delete the leavers filter\nSELECT COUNT(*) c FROM employees"],
  ['a comment containing "update"', "SELECT COUNT(*) c FROM employees -- update this later"],
  ['a block comment', "/* drop this later */ SELECT COUNT(*) c FROM employees"],
  ['a comment containing a semicolon', "-- step 1; then step 2\nSELECT COUNT(*) c FROM employees"],
  ['trailing semicolon', 'SELECT COUNT(*) c FROM employees;'],
  ['leading blank lines', '\n\n   SELECT COUNT(*) c FROM employees'],
  ['a CTE (WITH ... SELECT)', 'WITH cur AS (SELECT * FROM employees WHERE exit_year IS NULL) SELECT COUNT(*) c FROM cur'],
  ['a string containing a semicolon', "SELECT 'a;b' AS x"],
  ['a string containing the word drop', "SELECT 'drop' AS x"],
  ['an escaped quote', "SELECT 'it''s fine' AS x"],
  ['lowercase select', 'select count(*) c from employees'],
]) {
  const r = run(sql);
  check(label, r.ok, r.err);
}

console.log('\n3. Everything dangerous is STILL refused');
for (const [label, sql] of [
  ['DROP', 'DROP TABLE employees'],
  ['DELETE', 'DELETE FROM employees'],
  ['UPDATE', 'UPDATE employees SET salary = 0'],
  ['INSERT', "INSERT INTO employees VALUES (1,'x',1,'r',1,2020,NULL,'BLR')"],
  ['CREATE', 'CREATE TABLE evil (id INT)'],
  ['ATTACH', "ATTACH DATABASE 'other.db' AS other"],
  ['PRAGMA', 'PRAGMA table_list'],
  ['VACUUM', 'VACUUM'],
  ['multi-statement', 'SELECT 1; SELECT 2'],
  ['SELECT then DROP', 'SELECT 1; DROP TABLE employees'],
  ['write hidden behind a comment', '-- SELECT 1\nDROP TABLE employees'],
  ['write hidden after a block comment', '/* SELECT */ DELETE FROM employees'],
  ['write smuggled inside a string, then real', "SELECT 'x'; DROP TABLE employees"],
  ['CTE that writes', 'WITH x AS (SELECT 1) DELETE FROM employees'],
  ['empty', '   '],
  ['comment only', '-- just a comment'],
  ['reaching the real users table', 'SELECT * FROM users'],
  ['reaching sessions', 'SELECT * FROM sessions'],
]) {
  const r = run(sql);
  check(label + ' refused', !r.ok, r.ok ? 'ALLOWED — ' + JSON.stringify(r.rows).slice(0, 90) : undefined);
}

console.log('\n4. The smuggling check, stated precisely');
// A string literal's CONTENTS must never satisfy the "starts with select" test.
const r4 = run("'SELECT 1'");
check('a bare string literal is not a SELECT', !r4.ok, r4.ok ? 'ALLOWED' : undefined);

console.log(fails ? `\n${fails} FAILURE(S)` : '\nAll guard checks passed.');
process.exit(fails ? 1 : 0);
