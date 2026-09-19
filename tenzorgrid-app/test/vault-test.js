// Performance record and Experience Vault — Milestone 07.
//
// Two things have to hold and only one of them is a crash:
//
//   1. one number means one thing -- Performance, the 1:1, promotion and appraisal must
//      not quietly answer "how good is this learner" differently
//   2. NOTHING IS INVENTED -- a Vault entry may describe what was analysed, decided,
//      communicated, corrected or approved, and must never claim a business outcome the
//      simulation did not establish
//
// The second is the dangerous one. A fabricated "improved retention by 12%" looks like a
// feature working until somebody puts it on a CV, so the claim audit here runs over every
// entry the engine can actually produce rather than over a sample.
process.env.DATA_DIR = process.argv[2];
process.env.TIME_TRAVEL = '1';
const path = require('node:path');
const fs = require('node:fs');
const ROOT = path.join(__dirname, '..');
const aiPath = require.resolve(path.join(ROOT, 'lib/ai.js'));
require.cache[aiPath] = { id: aiPath, filename: aiPath, loaded: true, exports: {
  isAvailable: () => false, callClaude: async () => null, extractJson: () => null } };

const { db, cryptoRandomId } = require(path.join(ROOT, 'lib/db.js'));
const ws = require(path.join(ROOT, 'lib/workspace.js'));
const st = require(path.join(ROOT, 'lib/skilltest.js'));
const perf = require(path.join(ROOT, 'lib/performance.js'));
const vault = require(path.join(ROOT, 'lib/vault.js'));
const { finishWholeProject } = require(path.join(__dirname, 'answers.js'));

let fails = 0;
const check = (n, c, d) => { if (c) console.log('  PASS  ' + n); else { fails++; console.log('  FAIL  ' + n + (d ? '\n        ' + d : '')); } };

console.log('\nPerformance record and Experience Vault\n');

let seq = 0;
function learner(level) {
  seq += 1;
  const uid = cryptoRandomId(), iso = new Date().toISOString();
  db.prepare('INSERT INTO users (id,email,password_hash,password_salt,created_at) VALUES (?,?,?,?,?)')
    .run(uid, `v${seq}@t.local`, 'x', 'y', iso);
  db.prepare('INSERT INTO profiles (user_id,name,created_at,updated_at) VALUES (?,?,?,?)')
    .run(uid, 'Manu Kumar', iso, iso);
  ws.startEnrollment(uid, { role: 'data_analyst', level: level || 'junior', scheduleType: 'weekdays' });
  ws.submitSkillTest(uid, Object.fromEntries(st.QUESTIONS.map((q) => [q.id, q.answer])));
  return uid;
}
const enrollOf = (uid) => ws.getEnrollment(uid);
const expRows = (uid) => db.prepare('SELECT * FROM sim_experiences WHERE enrollment_id = ?').all(enrollOf(uid).id);

(async () => {

// ---- 1. the canonical metric ----------------------------------------------------------------
{
  // The exact divergence M06 predicted and M07 exists to remove: an unscored graded task.
  const tasks = [
    { id: 'a', status: 'graded', score: 80 },
    { id: 'b', status: 'graded', score: 80 },
    { id: 'c', status: 'graded', score: null },
  ];
  const oldWay = Math.round(tasks.reduce((s, t) => s + (t.score || 0), 0) / tasks.length);
  const canonical = perf.quality(tasks).value;
  check('the old formula counted an unscored task as a zero', oldWay === 53, `${oldWay}`);
  check('the canonical one excludes it instead', canonical === 80, `${canonical}`);
  check('and reports how many it actually averaged', perf.quality(tasks).n === 2);
  check('nothing to average is null, never zero', perf.quality([]).value === null);
  check('timeliness needs both a delivery and a deadline',
    perf.timeliness([{ status: 'graded', graded_at: '2026-01-01T00:00:00Z' }]).value === null);
}

// ---- 2. no surface disagrees with another ------------------------------------------------------
const uid = learner('junior');
{
  const t = db.prepare("SELECT * FROM sim_tasks WHERE enrollment_id = ? AND status != 'graded' LIMIT 1").get(enrollOf(uid).id);
  ws.__testReturnWork(uid, t.id, 'The denominator includes contractors. Recheck the population.', false);
  ws.__testApproveWork(uid, t.id);
}
await finishWholeProject(ws, db, uid);
ws.getState(uid);
{
  const s = ws.getState(uid);
  const record = ws.getPerformanceRecord(uid);
  const meeting = ws.getOneToOne(uid, null);
  const tasks = db.prepare('SELECT * FROM sim_tasks WHERE enrollment_id = ?').all(enrollOf(uid).id);
  const canonical = perf.quality(tasks).value;

  check('the Performance page and the canonical metric agree',
    record.metrics.quality.value === canonical, `${record.metrics.quality.value} vs ${canonical}`);
  check('the payload headline agrees too',
    s.performance.avgScore === canonical, `${s.performance.avgScore} vs ${canonical}`);
  check('and promotion is gated on the same number',
    s.promotion.averageScore === undefined || s.promotion.averageScore === null
      || s.promotion.averageScore === canonical,
    `promotion=${s.promotion.averageScore} canonical=${canonical}`);
  // §37: the meeting's value is frozen, but it was computed by the same rule, so for a
  // week that has not changed since it closed the two must still match.
  check('the 1:1 quoted the same rule when it froze its pack',
    meeting.evidence.avgScore === perf.quality(tasks.filter((x) => x.status === 'graded')).value,
    `meeting=${meeting.evidence.avgScore}`);
}

// ---- 3. capabilities are evidence-backed ---------------------------------------------------
//
// Capability evidence comes from `skills_json`, which the REAL submission path writes and
// the test harness does not -- it stamps rows graded directly. So this drives one genuine
// submission through submitTask rather than asserting against a shortcut, otherwise the
// capability model would be tested against data no learner ever produces.
{
  const cap = learner('junior');
  ws.getState(cap);
  const sqlTask = db.prepare("SELECT * FROM sim_tasks WHERE enrollment_id = ? AND status != 'graded'")
    .all(enrollOf(cap).id)
    .find((t) => (ws.TASKS[t.task_key] || {}).referenceSql);
  check('there is a real query task to submit', Boolean(sqlTask));
  if (sqlTask) {
    await ws.submitTask(cap, sqlTask.id, ws.TASKS[sqlTask.task_key].referenceSql);
    const row = db.prepare('SELECT skills_json, score FROM sim_tasks WHERE id = ?').get(sqlTask.id);
    check('submitting real work records which capabilities it touched', Boolean(row.skills_json),
      JSON.stringify(row));
  }
  const capRecord = ws.getPerformanceRecord(cap);
  check('capabilities are reported once there is real work behind them',
    capRecord.capabilities.length > 0, JSON.stringify(capRecord.capabilities.map((c) => c.axis)));
  check('each names what it is in professional language',
    capRecord.capabilities.every((c) => c.label && !/^[a-z]+$/.test(c.label)),
    capRecord.capabilities.map((c) => c.label).join(','));
}
{
  const record = ws.getPerformanceRecord(uid);
  check('every capability carries evidence',
    record.capabilities.every((c) => c.evidenceCount > 0 && c.examples.length > 0));
  check('every example points at a real task',
    record.capabilities.every((c) => c.examples.every((x) => x.taskId
      && db.prepare('SELECT 1 FROM sim_tasks WHERE id = ?').get(x.taskId))));
  check('a state is never claimed on one data point',
    perf.capabilityState(1, 95) === perf.EVIDENCE_STATES.NONE);
  check('and "not enough evidence yet" is a real answer',
    Object.values(perf.EVIDENCE_STATES).includes('Not enough evidence yet'));
  // A junior cannot move the leadership axes, so they must be absent rather than zero.
  check('axes this level cannot touch are left out, not shown as zero',
    !record.capabilities.some((c) => c.axis === 'delivery' || c.axis === 'coaching'),
    record.capabilities.map((c) => c.axis).join(','));
}

// ---- 4. the recovery chain becomes ONE story ---------------------------------------------------
{
  const rows = expRows(uid);
  check('the week produced experience entries', rows.length > 0, `${rows.length}`);
  const rec = rows.filter((r) => r.kind === 'recovery');
  check('the returned-and-recovered work is exactly one entry', rec.length === 1, `${rec.length}`);
  if (rec[0]) {
    const d = vault.detail(rec[0]);
    check('it tells the whole sequence', d.evidence.length >= 3, `${d.evidence.length} evidence items`);
    check('including that it was returned',
      d.evidence.some((e) => /returned/i.test(e.what)));
    check('and that the correction was approved',
      d.evidence.some((e) => /approved/i.test(e.what)));
    check('it has context, responsibility, actions and an outcome',
      Boolean(d.context && d.responsibility && d.actions.length && d.outcome));
    const src = vault.parse(rec[0].source_json, {});
    check('every source id resolves to a real row',
      (src.taskIds || []).every((id) => db.prepare('SELECT 1 FROM sim_tasks WHERE id = ?').get(id))
      && (src.eventIds || []).every((id) => db.prepare('SELECT 1 FROM sim_events WHERE id = ?').get(id)),
      JSON.stringify(src));
    check('and it does not leak internal ids into the prose',
      !/[0-9a-f]{16,}/.test([d.title, d.context, d.responsibility, d.outcome].concat(d.actions).join(' ')));
  }
}

// ---- 4b. a project entry counts the whole project ------------------------------------------------
{
  const row = expRows(uid).find((r) => r.kind === 'project' || r.kind === 'leadership');
  check('the project entry exists', Boolean(row));
  if (row) {
    const d = vault.detail(row);
    const graded = db.prepare("SELECT COUNT(*) c FROM sim_tasks WHERE enrollment_id = ? AND status = 'graded'")
      .get(enrollOf(uid).id).c;
    const claimed = Number((d.outcome.match(/with (\d+) pieces/) || [])[1] || 0);
    // A project's work is the work in that project, not the work whose timestamp happens
    // to land between two moments. Scoping by the clock dropped 23 of 30 on a
    // time-travelled week, and the entry quietly understated what the learner did.
    check('it counts the project\'s work, not a time window', claimed === graded,
      `claimed ${claimed} of ${graded} graded`);
  }
}

// ---- 5. THE CLAIM AUDIT ------------------------------------------------------------------------
{
  const all = db.prepare('SELECT * FROM sim_experiences').all();
  check('there are entries to audit', all.length > 0, `${all.length}`);
  const offenders = all.map((r) => {
    const d = vault.detail(r);
    const bad = vault.unsupportedClaim({
      title: d.title, context: d.context, responsibility: d.responsibility,
      outcome: d.outcome, actions: d.actions,
    });
    return bad ? `${r.source_key}: "${bad}"` : null;
  }).filter(Boolean);
  check('NO entry claims a business outcome the simulation never established',
    offenders.length === 0, offenders.slice(0, 3).join('\n        '));

  // The audit has to actually bite, or it is decoration.
  const bites = [
    { title: 'x', outcome: 'Increased retention by 12% across the book.' },
    { title: 'x', outcome: 'Saved the company £500k on tooling.' },
    { title: 'Led a company-wide transformation', outcome: 'done' },
    { title: 'x', outcome: 'Improved conversion for the quarter.' },
    { title: 'x', outcome: 'Reduced churn by 8 points.' },
  ];
  check('and the audit catches the phrasings it is there to catch',
    bites.every((b) => vault.unsupportedClaim(b)),
    bites.filter((b) => !vault.unsupportedClaim(b)).map((b) => b.outcome).join(' | '));
  check('while letting truthful description through',
    !vault.unsupportedClaim({
      title: 'Retention analysis — corrected and approved',
      outcome: 'The corrected work was approved and the project returned to on track.',
      actions: ['Reworked the analysis and resubmitted it.'],
    }));
  // Belt and braces: the write path itself refuses, so nothing can sneak in later.
  let refused = false;
  try { vault.record(enrollOf(uid).id, { sourceKey: 'bad:1', kind: 'project', title: 'x', outcome: 'Increased revenue by 20%' }); }
  catch { refused = true; }
  check('the write path refuses an unsupported claim outright', refused);
}

// ---- 6. no task flood, and no duplicates -------------------------------------------------------
{
  const rows = expRows(uid);
  check('a thirty-task week does not produce thirty entries', rows.length <= 6, `${rows.length}`);
  check('the week itself is one entry',
    rows.filter((r) => r.kind === 'project' || r.kind === 'leadership').length === 1);

  for (let i = 0; i < 20; i++) ws.getState(uid);
  check('twenty refreshes add nothing', expRows(uid).length === rows.length,
    `${expRows(uid).length} vs ${rows.length}`);
  const keys = expRows(uid).map((r) => r.source_key);
  check('and every source key is unique', new Set(keys).size === keys.length);
}

// ---- 7. simulation qualification is on every row -------------------------------------------------
{
  const rows = expRows(uid);
  check('every entry is marked as simulated experience', rows.every((r) => r.simulated === 1));
  const idx = ws.getExperience(uid, null);
  check('and the record says so at the top', idx.simulated === true);
  check('under a label that does not claim employment',
    /simulation/i.test(idx.label) && !/\bemployer\b/i.test(idx.label), idx.label);
  const src = fs.readFileSync(path.join(ROOT, 'lib/vault.js'), 'utf8');
  check('nothing in the vault calls Meridian an employer',
    !/employer/i.test(src.replace(/\/\/.*$/gm, '')));
}

// ---- 8. reflection stays the learner's, observation stays the manager's ---------------------------
{
  const m = ws.getOneToOne(uid, null);
  if (m) await ws.completeOneToOne(uid, m.key, 'definitions', 'I was unsure about the population.');
  const rows = expRows(uid);
  check('a reflection is never merged into system evidence',
    rows.every((r) => {
      const d = vault.detail(r);
      return !d.evidence.some((e) => /I was unsure/i.test(e.what || ''));
    }));
  check('the entry keeps reflection and observation in separate fields',
    rows.every((r) => Object.keys(r).includes('reflection') && Object.keys(r).includes('manager_observation')));
}

// ---- 9. development history: recurring themes ------------------------------------------------------
{
  const d = perf.developmentHistory(enrollOf(uid).id);
  check('the current focus is reported', Boolean(d.current));
  check('with its history', d.history.length >= 1);
  check('a single goal is not called recurring', d.recurring.length === 0, JSON.stringify(d.recurring));
}

// ---- 10. two different learners, two different records ----------------------------------------------
{
  const b = learner('junior');
  ws.getState(b);
  for (const sr of db.prepare('SELECT * FROM sim_situations WHERE enrollment_id = ? AND handled_as IS NULL').all(enrollOf(b).id)) {
    try { ws.handleSituation(b, sr.situation_key, 'escalate'); } catch { /* noise */ }
  }
  await finishWholeProject(ws, db, b);
  ws.getState(b);
  const kindsA = expRows(uid).map((r) => r.kind).sort().join(',');
  const kindsB = expRows(b).map((r) => r.kind).sort().join(',');
  check('an escalation-heavy week produces escalation evidence',
    expRows(b).some((r) => r.kind === 'escalation'), kindsB);
  check('and the two records are materially different', kindsA !== kindsB,
    `A: ${kindsA}\n        B: ${kindsB}`);
}

// ---- 11. leadership reads as leadership ---------------------------------------------------------------
{
  const mgr = learner('manager');
  ws.getState(mgr);
  await finishWholeProject(ws, db, mgr);
  ws.getState(mgr);
  const rows = expRows(mgr);
  check('a manager gets experience entries', rows.length > 0, `${rows.length}`);
  const lead = rows.find((r) => r.kind === 'leadership');
  check('their week reads as running a team, not as analysis', Boolean(lead),
    rows.map((r) => r.kind).join(','));
  if (lead) {
    const d = vault.detail(lead);
    check('naming the leadership work they actually did',
      d.actions.some((a) => /staffed|sign-off|review/i.test(a)), d.actions.join(' | '));
    check('and it is not a junior portfolio with a different title',
      /running|allocating|owning/i.test(d.responsibility), d.responsibility);
  }
}

// ---- 12. backfill for a learner who predates the vault ------------------------------------------------
{
  const old = learner('junior');
  await finishWholeProject(ws, db, old);
  ws.getState(old);
  const before = expRows(old).length;
  check('a finished week produced entries', before > 0, `${before}`);

  // Simulate a learner whose history exists but whose vault does not.
  db.prepare('DELETE FROM sim_experiences WHERE enrollment_id = ?').run(enrollOf(old).id);
  check('the vault is now empty for them', expRows(old).length === 0);
  ws.getState(old);
  const after = expRows(old).length;
  check('opening the workspace backfills it from real history', after > 0, `${after}`);
  check('and produces the same entries as living through it did', after === before,
    `${after} vs ${before}`);
  for (let i = 0; i < 10; i++) ws.getState(old);
  check('backfill is idempotent', expRows(old).length === after);
  check('no entry was invented for a project they never finished',
    expRows(old).every((r) => !r.project_run_id
      || db.prepare('SELECT 1 FROM sim_project_runs WHERE id = ? AND completed_at IS NOT NULL').get(r.project_run_id)));
}

// ---- 13. baseline: nothing before a week has finished ---------------------------------------------------
{
  const fresh = learner('junior');
  const s = ws.getState(fresh);
  check('a mid-week learner has no experience entries', s.experience.count === 0);
  check('and the record opens without throwing', Boolean(ws.getExperience(fresh, null)));
  check('reporting an empty record rather than an error',
    ws.getExperience(fresh, null).entries.length === 0);
  const rec = ws.getPerformanceRecord(fresh);
  check('the performance record opens too', Boolean(rec));
  check('with no capability claimed on no evidence',
    rec.capabilities.every((c) => c.evidenceCount > 0));
}

// ---- 14. payload stays compact (§45) ---------------------------------------------------------------------
{
  const s = ws.getState(uid);
  const expBytes = Buffer.byteLength(JSON.stringify(s.experience));
  check('the state carries an index, not the whole graph', expBytes < 4096, `${expBytes} bytes`);
  check('and it is genuinely just a summary',
    (s.experience.recent || []).every((e) => e.context === undefined && e.evidence === undefined));
  const full = ws.getExperience(uid, expRows(uid)[0].source_key);
  check('the full story is available on request', Boolean(full && full.evidence));
}

// ---- 15. promotion and appraisal are untouched ------------------------------------------------------------
{
  const s = ws.getState(uid);
  check('promotion still reports its own decision', Boolean(s.promotion));
  check('and the vault cannot grant one',
    !/promot/i.test(fs.readFileSync(path.join(ROOT, 'lib/vault.js'), 'utf8').replace(/\/\/.*$/gm, '')));
  check('nor decide progression',
    !/unlock|level_up|levelUp/i.test(fs.readFileSync(path.join(ROOT, 'lib/vault.js'), 'utf8')));
}

// ---- 16. no peer comparison anywhere (§41) ------------------------------------------------------------------
{
  const strip = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const f of ['lib/performance.js', 'lib/vault.js']) {
    check(`${f} makes no comparison to other people`,
      !/top \d+%|better than|percentile|leaderboard|rank(ing|ed)?\b|vs\. peers/i.test(strip(f)));
  }
}

console.log(fails ? `\n${fails} FAILURE(S)` : '\nAll performance and experience checks passed.');
process.exit(fails ? 1 : 0);

})();
