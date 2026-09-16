// A1: does an existing database — one written by the OLD schema — upgrade cleanly?
//
// A fresh DB proves nothing. Every real learner's data lives on the Railway volume and was
// created before these tables existed, so the only migration worth testing is the one that
// starts from yesterday's file.
const path = require('node:path');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const ROOT = require('node:path').join(__dirname, '..');
const DIR = process.argv[2];

let fails = 0;
const check = (n, c, d) => { if (c) console.log('  PASS  ' + n); else { fails++; console.log('  FAIL  ' + n + (d ? '\n        ' + d : '')); } };

// 1. Build a database with the PREVIOUS schema, by checking out the old db.js.
//
// Pinned to the last commit BEFORE A1 rather than to origin/main. Once A1 merged, main
// contained the new tables and this test quietly started comparing the new schema against
// itself — passing while proving nothing. The upgrade path a real learner's file takes is
// from this commit, and it does not change just because main moved on.
const PRE_A1 = 'ff1a21076657444b55933b2ee06f3f7b3fa28d55';
fs.mkdirSync(DIR, { recursive: true });
const oldDb = execFileSync('git', ['show', `${PRE_A1}:tenzorgrid-app/lib/db.js`], { cwd: ROOT }).toString();
const oldPath = path.join(DIR, 'db-old.js');
fs.writeFileSync(oldPath, oldDb.replace(/require\('\.\//g, `require('${ROOT}/lib/`));

console.log('1. A database written by the old schema');
process.env.DATA_DIR = DIR;
let old = require(oldPath);
const uid = old.cryptoRandomId(), iso = new Date().toISOString();
old.db.prepare('INSERT INTO users (id,email,password_hash,password_salt,created_at) VALUES (?,?,?,?,?)').run(uid, 'a1@e.com', 'x', 'y', iso);
old.db.prepare('INSERT INTO profiles (user_id,name,created_at,updated_at) VALUES (?,?,?,?)').run(uid, 'Priya Sharma', iso, iso);
const eid = old.cryptoRandomId();
old.db.prepare(`INSERT INTO sim_enrollments (id,user_id,role,level,track,schedule_type,status,created_at)
                VALUES (?,?,?,?,?,?,?,?)`).run(eid, uid, 'data_analyst', 'junior', 'ic', 'weekday', 'trial', iso);
old.db.prepare(`INSERT INTO sim_tasks (id,enrollment_id,task_key,title,brief,status,score,assigned_at)
                VALUES (?,?,?,?,?,?,?,?)`).run(old.cryptoRandomId(), eid, 'da-001', 'T', 'B', 'graded', 88, iso);
const before = {
  tasks: old.db.prepare('SELECT COUNT(*) c FROM sim_tasks').get().c,
  score: old.db.prepare('SELECT score FROM sim_tasks LIMIT 1').get().score,
};
check('old schema wrote a graded task', before.tasks === 1 && before.score === 88);
check('old schema has none of the new tables',
  old.db.prepare("SELECT COUNT(*) c FROM sqlite_master WHERE name IN ('sim_activities','sim_quiz','sim_situations','sim_cast')").get().c === 0);
old.db.close();
delete require.cache[require.resolve(oldPath)];

// 2. Now open the SAME FILE with the new schema.
console.log('\n2. The same file, opened by the new schema');
for (const k of Object.keys(require.cache)) if (k.includes('/lib/db.js')) delete require.cache[k];
const fresh = require(path.join(ROOT, 'lib/db.js'));
const has = (t) => fresh.db.prepare("SELECT COUNT(*) c FROM sqlite_master WHERE type='table' AND name=?").get(t).c === 1;
for (const t of ['sim_activities', 'sim_quiz', 'sim_situations', 'sim_cast']) check(t + ' now exists', has(t));

const col = (t, c) => fresh.db.prepare(`PRAGMA table_info(${t})`).all().some((r) => r.name === c);
check('sim_project_runs gained extended_days', col('sim_project_runs', 'extended_days'));
check('sim_tasks gained carried_from_day', col('sim_tasks', 'carried_from_day'));
check('sim_enrollments gained conduct_score', col('sim_enrollments', 'conduct_score'));

console.log('\n3. Nothing that was there before was lost or changed');
const after = fresh.db.prepare('SELECT COUNT(*) c FROM sim_tasks').get().c;
const score = fresh.db.prepare('SELECT score, status FROM sim_tasks LIMIT 1').get();
check('the task is still there', after === before.tasks, `${before.tasks} -> ${after}`);
check('its score is untouched', score.score === 88, String(score.score));
check('its status is untouched', score.status === 'graded', score.status);
check('the enrollment survived', fresh.db.prepare('SELECT COUNT(*) c FROM sim_enrollments').get().c === 1);
check('new columns are NULL on old rows, not zero',
  fresh.db.prepare('SELECT carried_from_day cd FROM sim_tasks LIMIT 1').get().cd === null);

console.log('\n4. Opening it a second time is safe');
for (const k of Object.keys(require.cache)) if (k.includes('/lib/db.js')) delete require.cache[k];
let twice = true;
try { require(path.join(ROOT, 'lib/db.js')); } catch (e) { twice = false; console.log('        ' + e.message); }
check('re-running the migration does not throw', twice);

console.log('\n5. The new tables accept and cascade', '');
const r = fresh.db.prepare('SELECT id FROM sim_enrollments LIMIT 1').get();
fresh.db.prepare(`INSERT INTO sim_activities (id,enrollment_id,activity_key,assigned_on,created_at)
                  VALUES (?,?,?,?,?)`).run(fresh.cryptoRandomId(), r.id, 'learn-window-fns', '2026-09-10', iso);
fresh.db.prepare(`INSERT INTO sim_quiz (id,enrollment_id,question_key,answered_on,chosen,correct,created_at)
                  VALUES (?,?,?,?,?,?,?)`).run(fresh.cryptoRandomId(), r.id, 'q-null-compare', '2026-09-10', 'b', 1, iso);
check('an activity row inserts', fresh.db.prepare('SELECT COUNT(*) c FROM sim_activities').get().c === 1);
check('a quiz row inserts', fresh.db.prepare('SELECT COUNT(*) c FROM sim_quiz').get().c === 1);
let dup = false;
try { fresh.db.prepare(`INSERT INTO sim_quiz (id,enrollment_id,question_key,answered_on,correct,created_at) VALUES (?,?,?,?,?,?)`)
  .run(fresh.cryptoRandomId(), r.id, 'q-null-compare', '2026-09-11', 0, iso); } catch (e) { dup = true; }
check('the same question cannot be asked twice in one project', dup);
// The other half of that key, and the reason it has three columns. Every project's quiz
// reuses the same ten question ids, so with the key on (enrollment, question) alone a
// learner answered q1 in project one and was then permanently unable to submit the quiz
// at the end of project two — the project could not complete and nothing further
// unlocked. Nothing caught it because the only suite that runs two projects on one
// enrollment was crashing, and run-all.sh did not look at exit codes.
let across = false;
try {
  fresh.db.prepare(`INSERT INTO sim_quiz (id,enrollment_id,question_key,project_key,answered_on,correct,created_at) VALUES (?,?,?,?,?,?,?)`)
    .run(fresh.cryptoRandomId(), r.id, 'q-null-compare', 'a-different-project', '2026-09-12', 1, iso);
  across = true;
} catch { across = false; }
check('but the same question CAN be asked again in a different project', across);
fresh.db.prepare('DELETE FROM sim_enrollments WHERE id = ?').run(r.id);
check('deleting the enrollment cascades the new tables',
  fresh.db.prepare('SELECT COUNT(*) c FROM sim_activities').get().c === 0 &&
  fresh.db.prepare('SELECT COUNT(*) c FROM sim_quiz').get().c === 0);

console.log(fails ? `\n${fails} FAILURE(S)` : '\nAll A1 migration checks passed.');
process.exit(fails ? 1 : 0);
