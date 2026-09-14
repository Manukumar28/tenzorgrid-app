// The role catalogue, and the enrolment it drives.
//
// This suite exists because of two defects it now guards against. The level dropdown
// offered two of the four levels, and the server clamped anything else back to 'junior'
// silently — so eight authored projects were unreachable from a fresh enrolment and
// nothing said so. And the header built its own job title from `level === 'senior'`,
// which read "Junior Data Analyst" to a Team Lead and to a Manager.
//
// Both were invisible from every existing test, because every existing test enrols at
// junior or senior and never looks at what the learner is called.
process.env.DATA_DIR = process.argv[2];
const path = require('node:path');
const ROOT = require('node:path').join(__dirname, '..');
const aiPath = require.resolve(path.join(ROOT, 'lib/ai.js'));
require.cache[aiPath] = { id: aiPath, filename: aiPath, loaded: true, exports: {
  isAvailable: () => false, callClaude: async () => null, extractJson: () => null } };

const { db, cryptoRandomId } = require(path.join(ROOT, 'lib/db.js'));
const ws = require(path.join(ROOT, 'lib/workspace.js'));
const roles = require(path.join(ROOT, 'lib/roles.js'));
const items = require(path.join(ROOT, 'lib/dayitems.js'));

let fails = 0;
const check = (n, c, d) => { if (c) console.log('  PASS  ' + n); else { fails++; console.log('  FAIL  ' + n + (d ? '\n        ' + d : '')); } };

function newUser(email) {
  const uid = cryptoRandomId(), iso = new Date().toISOString();
  db.prepare('INSERT INTO users (id,email,password_hash,password_salt,created_at) VALUES (?,?,?,?,?)').run(uid, email, 'x', 'y', iso);
  db.prepare('INSERT INTO profiles (user_id,name,created_at,updated_at) VALUES (?,?,?,?)').run(uid, 'Test Learner', iso, iso);
  return uid;
}

console.log('\n1. The catalogue is whole');
check('every role has a unique key', new Set(roles.ROLES.map((r) => r.key)).size === roles.ROLES.length);
check('every role sits in a category', roles.ROLES.every((r) => r.category),
  roles.ROLES.filter((r) => !r.category).map((r) => r.key).join(','));
const subs = new Set(roles.ROLES.map((r) => r.subcategory));
const declared = new Set(roles.CATEGORIES.flatMap((c) => c.subcategories));
check('every function a role claims is declared on a category',
  [...subs].every((s) => declared.has(s)), [...subs].filter((s) => !declared.has(s)).join(','));
check('and every declared function actually has roles in it',
  [...declared].every((s) => subs.has(s)), [...declared].filter((s) => !subs.has(s)).join(','));
check('every role carries a note', roles.ROLES.every((r) => (r.note || '').length > 10));

console.log('\n2. Levels belong to the role');
check('every role has three rungs or four', roles.ROLES.every((r) => r.levels.length === 3 || r.levels.length === 4));
const four = roles.ROLES.filter((r) => r.levels.length === 4).map((r) => r.key);
check('and only Data Analyst has four', four.length === 1 && four[0] === 'data_analyst', four.join(','));
check('a three-rung role runs junior -> senior -> lead',
  roles.levelsFor('kyc_aml_analyst').join(',') === 'junior,senior,lead');
check('a three-rung ladder has two rungs and tops out at Lead',
  roles.ladderFor('kyc_aml_analyst').length === 2
  && roles.ladderFor('kyc_aml_analyst')[1].to === 'lead');
check('Data Analyst keeps the authored titles',
  roles.levelTitle('data_analyst', 'lead') === 'Data Analytics Team Lead'
  && roles.levelTitle('data_analyst', 'manager') === 'Data Analytics Manager');
check('an unauthored role still names its rungs readably',
  roles.levelTitle('medical_coder', 'junior') === 'Junior Medical Coder'
  && roles.levelTitle('medical_coder', 'lead') === 'Lead Medical Coder');

console.log('\n3. The Data Analyst ladder is unchanged by being derived');
const ladder = roles.ladderFor('data_analyst');
check('three rungs', ladder.length === 3, String(ladder.length));
check('bars are 75 / 80 / 85', ladder.map((r) => r.minAverage).join(',') === '75,80,85',
  ladder.map((r) => r.minAverage).join(','));
check('titles are the authored ones',
  ladder.map((r) => r.title).join(' | ') === 'Senior Data Analyst | Data Analytics Team Lead | Data Analytics Manager',
  ladder.map((r) => r.title).join(' | '));

console.log('\n4. Only an authored role can be started');
check('exactly one role is live', roles.liveRoles().length === 1);
check('and it is data_analyst', roles.liveRoles()[0].key === 'data_analyst');
check('no role is marked live without a project catalogue',
  roles.liveRoles().every((r) => (ws.ROLE_CATALOG[r.key])));
{
  const uid = newUser('unbuilt@test.local');
  let msg = '';
  try { ws.startEnrollment(uid, { role: 'medical_coder', level: 'junior', scheduleType: 'weekdays' }); }
  catch (e) { msg = e.message; }
  check('an unbuilt role is refused, by name', /Medical Coder/.test(msg) && /building/.test(msg), msg);
  check('and no enrollment row is left behind', !ws.getEnrollment(uid));
}
{
  const uid = newUser('badlevel@test.local');
  let msg = '';
  try { ws.startEnrollment(uid, { role: 'data_analyst', level: 'principal', scheduleType: 'weekdays' }); }
  catch (e) { msg = e.message; }
  check('a level the role does not have is refused rather than downgraded',
    /doesn't have a principal level/.test(msg), msg);
}

console.log('\n5. Every level can actually be enrolled at');
// The defect: the server clamped to junior/senior, so Team Lead and Manager could only be
// reached by promotion. Eight authored projects had no way in.
const EXPECT = {
  junior: { title: 'Junior Data Analyst', first: 'Q1 Compensation Review' },
  senior: { title: 'Senior Data Analyst', first: 'Platform Reliability Review' },
  lead: { title: 'Data Analytics Team Lead', first: 'Half-Year Trading Review' },
  manager: { title: 'Data Analytics Manager', first: 'Demand & Capacity Review' },
};
for (const [level, want] of Object.entries(EXPECT)) {
  const uid = newUser(`lvl-${level}@test.local`);
  ws.startEnrollment(uid, { role: 'data_analyst', level, scheduleType: 'weekdays' });
  const e = ws.getEnrollment(uid);
  check(`${level}: the enrollment keeps the level it was given`, e && e.level === level, e ? e.level : 'none');
  const state = ws.getState(uid);
  check(`${level}: the learner is called "${want.title}"`,
    state.enrollment.levelTitle === want.title, state.enrollment.levelTitle);
  check(`${level}: the role label is sent too`, state.enrollment.roleLabel === 'Data Analyst',
    state.enrollment.roleLabel);
  const board = state.projects.projects.map((p) => p.title);
  check(`${level}: the board opens on "${want.first}"`, board.includes(want.first), board.join(' | '));
}

console.log('\n6. What the enrolment screen is told matches the authored content');
const cat = ws.getCatalogue(null);
check('every catalogued role reaches the picker',
  cat.categories.reduce((n, c) => n + c.roleCount, 0) === roles.ROLES.length);
check('the live count is honest', cat.liveRoles === roles.liveRoles().length);
const d = cat.detail.data_analyst;
check('four levels are offered', d.levels.length === 4, String(d.levels.length));
check('each level names four projects', d.levels.every((l) => l.projectCount === 4),
  d.levels.map((l) => `${l.key}:${l.projectCount}`).join(' '));
check('every level names its first project', d.levels.every((l) => l.firstProject));
// The week quoted on the screen has to be the week that actually arrives.
const sampleKey = 'compensation-review';
check('the week it quotes is measured, not asserted',
  d.week.tasks === 30
  && d.week.activities === items.activitiesFor(sampleKey).length
  && d.week.situations === items.situationsFor(sampleKey).length,
  JSON.stringify(d.week));
check('only tools that exist are promised', d.tools.length > 0 && d.tools.every((t) => t.label));
check('the ladder shown is the ladder enforced',
  d.ladder.map((r) => r.minAverage).join(',') === ladder.map((r) => r.minAverage).join(','));

console.log('\n7. Asking for a role we have not built');
{
  const uid = newUser('interest@test.local');
  const r1 = ws.recordRoleInterest(uid, 'kyc_aml_analyst');
  check('the ask is recorded and names the role', r1.interested && /KYC/.test(r1.role), JSON.stringify(r1));
  ws.recordRoleInterest(uid, 'kyc_aml_analyst');
  const n = db.prepare('SELECT COUNT(*) c FROM sim_role_interest WHERE user_id = ?').get(uid).c;
  check('asking twice is not two votes', n === 1, String(n));
  check('the catalogue tells them they already asked',
    ws.getCatalogue(uid).interested.includes('kyc_aml_analyst'));
  let msg = '';
  try { ws.recordRoleInterest(uid, 'data_analyst'); } catch (e) { msg = e.message; }
  check('a role that is already open cannot be waitlisted', /open already/.test(msg), msg);
  msg = '';
  try { ws.recordRoleInterest(uid, 'not_a_role'); } catch (e) { msg = e.message; }
  check('an unknown role is refused', /Unknown role/.test(msg), msg);
}

console.log(fails ? `\n${fails} FAILURE(S)` : '\nAll role checks passed.');
process.exit(fails ? 1 : 0);
