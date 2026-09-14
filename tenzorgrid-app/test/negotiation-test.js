// The promotion negotiation: opened a project BEFORE the decision, naming the number.
//
// The user's rule is that nobody should discover the bar on the day they are measured
// against it. So this suite cares about ORDER as much as content: the conversation has
// to arrive at project three, state the target, and the verdict has to arrive at four.
process.env.DATA_DIR = process.argv[2];
const path = require('node:path');
const ROOT = require('node:path').join(__dirname, '..');
const aiPath = require.resolve(path.join(ROOT, 'lib/ai.js'));
require.cache[aiPath] = { id: aiPath, filename: aiPath, loaded: true, exports: {
  isAvailable: () => false, callClaude: async () => null, extractJson: () => null } };
const { db, cryptoRandomId } = require(path.join(ROOT, 'lib/db.js'));
const ws = require(path.join(ROOT, 'lib/workspace.js'));

let fails = 0;
const check = (n, c, d) => { if (c) console.log('  PASS  ' + n); else { fails++; console.log('  FAIL  ' + n + (d ? '\n        ' + d : '')); } };

let seq = 0;
function newLearner(email) {
  const uid = cryptoRandomId();
  db.prepare('INSERT INTO users (id,email,password_hash,password_salt,created_at) VALUES (?,?,?,?,?)')
    .run(uid, email, 'x', 'y', new Date().toISOString());
  seq += 1;
  ws.startEnrollment(uid, { level: 'junior', scheduleType: 'weekday', scheduleDays: null });
  ws.getState(uid);
  return uid;
}

const JUNIOR = ['compensation-review', 'headcount-trends', 'outage-recovery', 'pay-equity-audit'];
const MANAGER = ['capacity-review', 'tooling-review', 'intake-review', 'headcount-case'];

// Deliver the next project at a chosen score and return the state after it.
function deliver(uid, key, score) {
  const e = ws.getEnrollment(uid);
  try { ws.startProject(uid, key); } catch (err) { /* already active */ }
  db.prepare(`UPDATE sim_tasks SET status='graded', score=?, graded_at=?, review_state='accepted'
              WHERE enrollment_id=? AND status!='graded'`).run(score, new Date().toISOString(), e.id);
  return ws.getState(uid);
}
const promoMsgs = (st, re) => st.messages.filter((m) => re.test(m.subject || ''));

(async () => {
  console.log('1. Nothing is said before the third project');
  const u1 = newLearner('ng1@e.com');
  let st = deliver(u1, JUNIOR[0], 90);
  check('no conversation after project 1', promoMsgs(st, /Promotion conversation/).length === 0);
  check('the card keeps it quiet too', st.promotion.negotiation.open === false, JSON.stringify(st.promotion.negotiation));
  st = deliver(u1, JUNIOR[1], 90);
  check('no conversation after project 2', promoMsgs(st, /Promotion conversation/).length === 0);

  console.log('\n2. The third project opens it, and it names the number');
  st = deliver(u1, JUNIOR[2], 90);
  const open = promoMsgs(st, /Promotion conversation/);
  check('exactly one conversation opens', open.length === 1, 'sent=' + open.length);
  check('it names the role', open[0] && /Senior Data Analyst/.test(open[0].subject), open[0] && open[0].subject);
  check('it states the target score', open[0] && /average of 75/.test(open[0].body), open[0] && open[0].body.slice(0, 200));
  check('it states the project condition', open[0] && /All 4 projects/.test(open[0].body), open[0] && open[0].body.slice(0, 240));
  check('it says which project decides it', open[0] && /fourth project is signed off/.test(open[0].body));
  check('it tells them where they stand now', open[0] && /90/.test(open[0].body));
  check('the card shows it as open', st.promotion.negotiation.open === true);
  check('and says how many projects are left', st.promotion.negotiation.projectsLeft === 1, String(st.promotion.negotiation.projectsLeft));
  check('but has NOT decided anything yet', ws.getEnrollment(u1).level === 'junior');

  console.log('\n3. It opens once, not on every page load');
  ws.getState(u1); ws.getState(u1);
  check('still one message', promoMsgs(ws.getState(u1), /Promotion conversation/).length === 1);

  console.log('\n4. The fourth project decides it');
  st = deliver(u1, JUNIOR[3], 90);
  check('promoted', ws.getEnrollment(u1).level === 'senior', ws.getEnrollment(u1).level);
  const award = promoMsgs(st, /^Promotion —/);
  check('Asha announces it', award.length === 1);
  check('quoting the bar she named', award[0] && /bar of 75/.test(award[0].body), award[0] && award[0].body.slice(0, 200));
  check('and what changes about the work', award[0] && /decide what the question should be/.test(award[0].body));

  console.log('\n5. Below the bar, the conversation still opens — the verdict differs');
  const u2 = newLearner('ng2@e.com');
  for (const k of JUNIOR.slice(0, 3)) deliver(u2, k, 60);
  const st2 = ws.getState(u2);
  const open2 = promoMsgs(st2, /Promotion conversation/);
  check('it opened anyway', open2.length === 1);
  check('and told them they were short, with the gap', open2[0] && /15 short/.test(open2[0].body), open2[0] && open2[0].body.slice(0, 300));
  const st2b = deliver(u2, JUNIOR[3], 60);
  check('not promoted', ws.getEnrollment(u2).level === 'junior');
  check('the verdict references the conversation', promoMsgs(st2b, /Promotion round/).length === 1);

  console.log('\n6. The ladder resets for the next rung');
  const st3 = ws.getState(u1);
  check('the next rung is Team Lead', st3.promotion.toTitle === 'Data Analytics Team Lead', st3.promotion.toTitle);
  check('its bar is higher', st3.promotion.criteria[1].target === 80, JSON.stringify(st3.promotion.criteria[1]));
  check('the conversation is closed again', st3.promotion.negotiation.opened === false);
  check('and project progress restarts at zero', st3.promotion.criteria[0].value === 0);

  console.log('\n7. At the top of the ladder there is nothing to negotiate');
  // Manager is the last rung. The negotiation machinery has to stay silent rather than
  // open a conversation about a promotion that does not exist, and the fourth project has
  // to complete normally rather than producing a verdict.
  const u3 = newLearner('ng3@e.com');
  db.prepare('UPDATE sim_enrollments SET level = ? WHERE user_id = ?').run('manager', u3);
  ws.getState(u3);
  check('the card knows it is the top', ws.getState(u3).promotion.atTheTop === true,
    JSON.stringify(ws.getState(u3).promotion).slice(0, 200));
  // At the top, toTitle is the title already held rather than a next rung — the card
  // reads "You are Data Analytics Manager", so the field carries the current level.
  check('and names the title already held rather than a next one',
    ws.getState(u3).promotion.toTitle === 'Data Analytics Manager',
    String(ws.getState(u3).promotion.toTitle));
  check('with no criteria to chase', ws.getState(u3).promotion.criteria.length === 0);
  check('and no negotiation object at all', ws.getState(u3).promotion.negotiation === null);
  for (const k of MANAGER.slice(0, 3)) deliver(u3, k, 95);
  const st4 = ws.getState(u3);
  check('no conversation opens at the third project', promoMsgs(st4, /Promotion conversation/).length === 0);
  const st5 = deliver(u3, MANAGER[3], 95);
  check('no verdict arrives at the fourth', promoMsgs(st5, /^Promotion —|Promotion round/).length === 0);
  check('still a manager', ws.getEnrollment(u3).level === 'manager', ws.getEnrollment(u3).level);
  check('all four manager projects completed',
    st5.projects.projects.filter((p) => p.status === 'completed').length === 4,
    JSON.stringify(st5.projects.projects.map((p) => [p.key, p.status])));

  console.log(fails ? `\n${fails} FAILURE(S)` : '\nAll negotiation checks passed.');
  process.exit(fails ? 1 : 0);
})();
