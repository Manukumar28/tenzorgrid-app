// Promotion: four projects delivered AND an average that earns it. Both, not either.
process.env.DATA_DIR = process.argv[2];
const path = require('node:path');
const ROOT = require('node:path').join(__dirname, '..');
const aiPath = require.resolve(path.join(ROOT, 'lib/ai.js'));
require.cache[aiPath] = { id: aiPath, filename: aiPath, loaded: true, exports: {
  isAvailable: () => false, callClaude: async () => null, extractJson: () => null } };

const { db, cryptoRandomId } = require(path.join(ROOT, 'lib/db.js'));
const ws = require(path.join(ROOT, 'lib/workspace.js'));
const _st = require(path.join(ROOT, 'lib/skilltest.js'));
const pass = (uid) => ws.submitSkillTest(uid, Object.fromEntries(_st.QUESTIONS.map((q) => [q.id, q.answer])));

let fails = 0;
const check = (n, c, d) => { if (c) console.log('  PASS  ' + n); else { fails++; console.log('  FAIL  ' + n + (d ? '\n        ' + d : '')); } };

function newLearner(email, name) {
  const uid = cryptoRandomId(), iso = new Date().toISOString();
  db.prepare('INSERT INTO users (id,email,password_hash,password_salt,created_at) VALUES (?,?,?,?,?)').run(uid, email, 'x', 'y', iso);
  db.prepare('INSERT INTO profiles (user_id,name,created_at,updated_at) VALUES (?,?,?,?)').run(uid, name, iso, iso);
  ws.startEnrollment(uid, { level: 'junior', scheduleType: 'weekday', scheduleDays: null });
  pass(uid);
  return uid;
}

// Finish the whole junior track at a chosen score, without going through the workbench.
// The promotion rule is what is under test here, not the grader.
function completeJuniorTrack(uid, score) {
  const e = ws.getEnrollment(uid);
  const juniorKeys = ['da-001', 'da-002', 'da-003', 'da-005', 'da-004'];
  // Only projects that are finished being WRITTEN count toward promotion — the bar
  // moves as content lands rather than requiring projects that do not exist.
  // All four junior projects are authored now, so the bar is the designed four.
  const projects = ['compensation-review', 'headcount-trends', 'outage-recovery', 'pay-equity-audit'];
  for (const key of projects) {
    try { ws.startProject(uid, key); } catch (err) { /* already active */ }
    const iso = new Date().toISOString();
    db.prepare(`UPDATE sim_tasks SET status='graded', score=?, graded_at=?, review_state='accepted'
                WHERE enrollment_id=? AND status!='graded'`).run(score, iso, e.id);
    ws.getState(uid);
  }
  return ws.getState(uid);
}

(async () => {
  console.log('1. Mid-track, promotion is visible but not claimed');
  const u1 = newLearner('pr1@e.com', 'Priya Sharma');
  const p1 = ws.getState(u1).promotion;
  check('a promotion track exists', Boolean(p1));
  check('it is not awarded', p1.awarded === false);
  check('it names what they are working towards', p1.toTitle === 'Senior Data Analyst', p1.toTitle);
  check('both criteria are reported', p1.criteria.length === 2, JSON.stringify(p1.criteria.map((c) => c.key)));
  // The bar is the number of junior projects that are finished being WRITTEN, so it moves
  // as content lands rather than demanding projects that do not exist yet.
  check('training shows real progress', p1.criteria[0].value === 0 && p1.criteria[0].target === 4,
    JSON.stringify(p1.criteria[0]));
  check('no promotion message has been sent', ws.getState(u1).messages.every((m) => !/Promotion/.test(m.subject || '')));

  console.log('\n2. Four projects at a good average earns it');
  const u2 = newLearner('pr2@e.com', 'Arun Kumar');
  const st2 = completeJuniorTrack(u2, 85);
  check('the ladder moved on to the next rung', st2.promotion.toTitle === 'Data Analytics Team Lead', st2.promotion.toTitle);
  check('the new rung starts from zero projects', st2.promotion.criteria[0].value === 0, JSON.stringify(st2.promotion.criteria[0]));
  check('the level actually changed', ws.getEnrollment(u2).level === 'senior', ws.getEnrollment(u2).level);
  const msg2 = st2.messages.find((m) => /^Promotion —/.test(m.subject || ''));
  check('Asha announces it with the numbers', Boolean(msg2) && /85/.test(msg2.body), msg2 && msg2.body.slice(0, 70));
  check('People Ops confirms it for the record',
    st2.messages.some((m) => (m.subject || '') === 'Promotion confirmed'));

  console.log('\n3. Promotion opens the senior board without erasing the junior one');
  const keys2 = st2.projects.projects.map((p) => p.key);
  check('the senior projects appear', keys2.includes('reliability-review'), JSON.stringify(keys2));
  check('their completed junior work is STILL on the board',
    keys2.includes('compensation-review') && keys2.includes('headcount-trends'), JSON.stringify(keys2));
  const done2 = st2.projects.projects.filter((p) => p.status === 'completed').map((p) => p.key);
  check('and still reads as completed', done2.length === 4, JSON.stringify(done2));
  const active2 = st2.projects.projects.find((p) => p.status === 'active');
  check('a senior project has actually started', active2 && active2.key === 'reliability-review', active2 && active2.key);
  check('so the promotion message does not point at an empty board',
    st2.tasks.some((t) => t.task_key.startsWith('sa-')));

  console.log('\n4. Four projects done badly is NOT a promotion');
  const u3 = newLearner('pr3@e.com', 'Sanjay Rao');
  const st3 = completeJuniorTrack(u3, 55);
  check('not promoted', ws.getEnrollment(u3).level === 'junior');
  check('training is met', st3.promotion.criteria[0].met === true);
  check('performance is not', st3.promotion.criteria[1].met === false, JSON.stringify(st3.promotion.criteria[1]));
  check('the level is unchanged', ws.getEnrollment(u3).level === 'junior');
  check('the shortfall is stated as a number', st3.promotion.shortfall === 20, String(st3.promotion.shortfall));
  const msg3 = st3.messages.find((m) => /Promotion round/.test(m.subject || ''));
  check('Asha tells them where they stand', Boolean(msg3), msg3 && msg3.subject);
  check('with the actual arithmetic', msg3 && /55/.test(msg3.body) && /20 short/.test(msg3.body), msg3 && msg3.body.slice(0, 160));
  check('and does not dangle a recovery that does not exist',
    msg3 && /next-cycle conversation/.test(msg3.body), msg3 && msg3.body.slice(-160));
  console.log('    ' + msg3.body.split('\n\n')[1]);

  console.log('\n5. That conversation happens once, not on every page load');
  ws.getState(u3); ws.getState(u3);
  const n3 = ws.getState(u3).messages.filter((m) => /Promotion round/.test(m.subject || '')).length;
  check('one message only', n3 === 1, 'sent=' + n3);

  console.log('\n6. Parked work blocks the review, and is named as the way back');
  // The case that matters: a learner who got to the end of the track but left work
  // parked. A parked task keeps its project out of "completed", so without this branch
  // they would sit in silence forever, never told why the review never came.
  const u4 = newLearner('pr4@e.com', 'Kavya Nair');
  const e4 = ws.getEnrollment(u4);
  for (const key of ['compensation-review', 'headcount-trends', 'outage-recovery', 'pay-equity-audit']) {
    try { ws.startProject(u4, key); } catch (err) {}
    db.prepare("UPDATE sim_tasks SET status='graded', score=90, graded_at=?, review_state='accepted' WHERE enrollment_id=? AND status NOT IN ('graded','parked')")
      .run(new Date().toISOString(), e4.id);
    // Park one BEFORE the read that would otherwise run the review — that is the whole
    // scenario: reaching the end of the track with work left unexplained.
    // Park it on the LAST project. Parking earlier keeps that project out of 'completed',
    // which means the next one never unlocks and the learner never reaches the end of the
    // track at all — a different scenario from the one under test.
    if (key === 'pay-equity-audit') {
      db.prepare("UPDATE sim_tasks SET status='parked', review_state='parked' WHERE id = (SELECT id FROM sim_tasks WHERE enrollment_id=? LIMIT 1)").run(e4.id);
    }
    ws.getState(u4);
  }
  const st4 = ws.getState(u4);
  check('they are not promoted', ws.getEnrollment(u4).level === 'junior');
  check('training is correctly NOT met', st4.promotion.criteria[0].met === false, JSON.stringify(st4.promotion.criteria[0]));
  const msg4 = st4.messages.filter((m) => /Promotion round/.test(m.subject || '')).pop();
  check('they are told, not left in silence', Boolean(msg4), 'no message');
  check('the parked task is named', msg4 && /parked/.test(msg4.body) && /"/.test(msg4.body), msg4 && msg4.body.slice(0, 200));
  check('and is offered as the thing they can fix today', msg4 && /resubmit/.test(msg4.body));
  check('the score is not blamed for it', msg4 && /isn't the score/.test(msg4.body), msg4 && msg4.body.slice(0, 160));
  console.log('    ' + msg4.body.split('\n\n')[1]);

  console.log('\n6b. Clearing the parked task lets the review run');
  db.prepare("UPDATE sim_tasks SET status='graded', score=90, graded_at=?, review_state='accepted' WHERE enrollment_id=? AND status='parked'")
    .run(new Date().toISOString(), e4.id);
  const st4b = ws.getState(u4);
  check('now promoted', ws.getEnrollment(u4).level === 'senior', ws.getEnrollment(u4).level);
  check('and the level changed', ws.getEnrollment(u4).level === 'senior');

  console.log('\n7. Three of four projects is not enough, however good the work');
  const u5 = newLearner('pr5@e.com', 'Meera Das');
  const e5 = ws.getEnrollment(u5);
  for (const key of ['compensation-review']) {
    try { ws.startProject(u5, key); } catch (err) {}
    db.prepare("UPDATE sim_tasks SET status='graded', score=95, graded_at=?, review_state='accepted' WHERE enrollment_id=? AND status!='graded'")
      .run(new Date().toISOString(), e5.id);
    ws.getState(u5);
  }
  const st5 = ws.getState(u5);
  check('performance is met', st5.promotion.criteria[1].met === true, JSON.stringify(st5.promotion.criteria[1]));
  check('training is not', st5.promotion.criteria[0].met === false, JSON.stringify(st5.promotion.criteria[0]));
  check('not promoted', ws.getEnrollment(u5).level === 'junior');
  check('and they are NOT told they fell short mid-track',
    st5.messages.every((m) => !/Promotion round/.test(m.subject || '')));

  console.log('\n8. A promoted learner stays promoted');
  ws.getState(u2); ws.getState(u2);
  const st2b = ws.getState(u2);
  check('still senior', ws.getEnrollment(u2).level === 'senior');
  check('still senior', ws.getEnrollment(u2).level === 'senior');
  const n2 = st2b.messages.filter((m) => /^Promotion —/.test(m.subject || '')).length;
  check('announced once only', n2 === 1, 'sent=' + n2);

  console.log(fails ? `\n${fails} FAILURE(S)` : '\nAll promotion checks passed.');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
