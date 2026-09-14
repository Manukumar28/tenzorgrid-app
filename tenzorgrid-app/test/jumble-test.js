// A2: can a learner beat the judgement tasks without reading them?
//
// The measure is not "are the options shuffled" — that is easy to make true and easy to
// make useless. It is: what does the laziest possible strategy actually SCORE?
process.env.DATA_DIR = process.argv[2];
process.env.TIME_TRAVEL = '1';
const path = require('node:path');
const ROOT = require('node:path').join(__dirname, '..');
const aiPath = require.resolve(path.join(ROOT, 'lib/ai.js'));
require.cache[aiPath] = { id: aiPath, filename: aiPath, loaded: true, exports: {
  isAvailable: () => false, callClaude: async () => null, extractJson: () => null } };

const { db, cryptoRandomId } = require(path.join(ROOT, 'lib/db.js'));
const ws = require(path.join(ROOT, 'lib/workspace.js'));
const tt = require(path.join(ROOT, 'lib/tasktypes.js'));
const st = require(path.join(ROOT, 'lib/skilltest.js'));

let fails = 0;
const check = (n, c, d) => { if (c) console.log('  PASS  ' + n); else { fails++; console.log('  FAIL  ' + n + (d ? '\n        ' + d : '')); } };

// Every authored choice spec, straight out of the module.
const SPECS = [];
{
  const fs = require('node:fs');
  const src = fs.readFileSync(path.join(ROOT, 'lib/workspace.js'), 'utf8');
  const start = src.indexOf('const TASKS = {');
  const body = src.slice(start, src.indexOf('\n};', start));
  for (const m of body.matchAll(/'((?:da|sa)-\d+)': \{/g)) {
    const chunk = body.slice(m.index, body.indexOf("\n  '", m.index + 5));
    if (!/tool: 'choice'/.test(chunk)) continue;
    const opts = [...chunk.matchAll(/key: '([a-z]+)', correct: (true|false)/g)]
      .map((o) => ({ key: o[1], correct: o[2] === 'true' }));
    if (opts.length) SPECS.push({ key: m[1], options: opts });
  }
}

console.log('1. There are judgement tasks to protect');
check('found the authored choice tasks', SPECS.length >= 8, `${SPECS.length} found`);

// How a lazy learner scores: tick the first N boxes, where N is however many are correct.
// (Generous to the cheat — they do not even have to know N.)
function lazyScore(spec, shownOrder) {
  const right = spec.options.filter((o) => o.correct).map((o) => o.key);
  const picked = new Set(shownOrder.slice(0, right.length).map((o) => o.key));
  const found = right.filter((k) => picked.has(k)).length;
  const wrong = spec.options.filter((o) => !o.correct).map((o) => o.key);
  const alarms = wrong.filter((k) => picked.has(k)).length;
  return Math.max(0, Math.round(((found - alarms) / right.length) * 100));
}

console.log('\n2. Before the fix: the authored order gave the game away');
const authored = SPECS.map((s) => lazyScore(s, s.options));
const authoredAvg = authored.reduce((a, b) => a + b, 0) / authored.length;
console.log('    authored order, clicking the top boxes: ' + authored.join(', '));
check('the authored order really was beatable', authoredAvg > 80, `avg ${authoredAvg.toFixed(0)}`);

console.log("\n3. After the fix: clicking the top boxes is worth no more than blind luck");
// The bar is not "a low number" — a biased shuffle can produce a low number too. The bar is
// the value random guessing is WORTH, computed exactly, so the test proves the shuffle is
// uniform rather than merely unhelpful.
//
// Picking the first r of n from a uniform permutation makes `found` hypergeometric. The
// grader clips a negative score at zero, so the expectation is NOT (2r-n)/n — the clipping
// lifts it. For the usual 3-of-6 shape it works out at exactly 20, with a 1-in-20 chance of
// full marks. Anything at that value is the shuffle doing its job perfectly.
function comb(n, k) {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1);
  return r;
}
function expectedLazyScore(r, n) {
  let e = 0;
  for (let k = 0; k <= r; k++) {
    const p = (comb(r, k) * comb(n - r, r - k)) / comb(n, r);
    e += p * Math.max(0, Math.round(((2 * k - r) / r) * 100));
  }
  return e;
}

const LEARNERS = 400;
let total = 0, perfect = 0, n = 0, expected = 0;
for (const spec of SPECS) {
  const r = spec.options.filter((o) => o.correct).length;
  expected += expectedLazyScore(r, spec.options.length) * LEARNERS;
  for (let i = 0; i < LEARNERS; i++) {
    const shown = tt.presentChoice({ prompt: 'x', options: spec.options }, `${spec.key}-row${i}`).options;
    const sc = lazyScore(spec, shown);
    total += sc; n++;
    if (sc === 100) perfect++;
  }
}
const avg = total / n;
const theory = expected / n;
console.log(`    ${n} attempts across ${SPECS.length} tasks`);
console.log(`    measured average ${avg.toFixed(1)}  |  blind guessing is worth ${theory.toFixed(1)}`);
console.log(`    scored full marks: ${((perfect / n) * 100).toFixed(1)}%`);

check('guessing by position is worth exactly what blind luck is worth',
  Math.abs(avg - theory) < 3, `measured ${avg.toFixed(1)} vs theory ${theory.toFixed(1)}`);
check('it is no longer a reliable way through', avg < 25, `avg ${avg.toFixed(1)}`);
check('it collapsed from the authored order', avg < authoredAvg - 60, `${authoredAvg.toFixed(0)} -> ${avg.toFixed(1)}`);
// The residual chance of a lucky 100 is a property of asking someone to pick 3 of 6, not of
// the shuffle. Driving it lower means more options or fewer correct ones — an authoring
// decision, and one worth taking when these tasks get written properly.
check('a lucky full mark stays near its floor', perfect / n < 0.08, `${((perfect / n) * 100).toFixed(1)}%`);

console.log('\n4. The same learner sees the same order every time');
const a = tt.presentChoice({ prompt: 'x', options: SPECS[0].options }, 'task-row-abc').options.map((o) => o.key);
const b = tt.presentChoice({ prompt: 'x', options: SPECS[0].options }, 'task-row-abc').options.map((o) => o.key);
check('reloading does not reshuffle', a.join() === b.join(), `${a.join()} vs ${b.join()}`);
// Reshuffling on reload would let someone refresh their way to a second look, and would
// make "the third one" mean nothing between a learner and their manager.
const c = tt.presentChoice({ prompt: 'x', options: SPECS[0].options }, 'task-row-xyz').options.map((o) => o.key);
check('a different learner sees a different order', a.join() !== c.join(), a.join());

console.log('\n5. Shuffling the display did not break grading');
const spec0 = { prompt: 'x', options: SPECS[0].options.map((o) => ({ ...o, label: o.key, why: '' })) };
const rightKeys = spec0.options.filter((o) => o.correct).map((o) => o.key);
check('the correct KEYS still score 100', tt.gradeChoice(spec0, rightKeys).score === 100,
  String(tt.gradeChoice(spec0, rightKeys).score));
check('ticking everything still scores 0', tt.gradeChoice(spec0, spec0.options.map((o) => o.key)).score === 0);

console.log('\n6. End to end: a real learner gets a shuffled workbench');
const uid = cryptoRandomId(), iso = new Date().toISOString();
db.prepare('INSERT INTO users (id,email,password_hash,password_salt,created_at) VALUES (?,?,?,?,?)').run(uid, 'j@e.com', 'x', 'y', iso);
db.prepare('INSERT INTO profiles (user_id,name,created_at,updated_at) VALUES (?,?,?,?)').run(uid, 'Priya Sharma', iso, iso);
ws.startEnrollment(uid, { level: 'junior', scheduleType: 'weekday' });
ws.submitSkillTest(uid, Object.fromEntries(st.QUESTIONS.map((q) => [q.id, q.answer])));
const row = ws.getState(uid).taskBoard.rows.find((r) => !r.notYetOpen);
const wb = ws.getWorkbench(uid, row.id);
if (wb.choice) {
  check('the workbench sends options', wb.choice.options.length > 0);
  const wb2 = ws.getWorkbench(uid, row.id);
  check('and the same ones in the same order on a reload',
    wb.choice.options.map((o) => o.key).join() === wb2.choice.options.map((o) => o.key).join());
} else {
  check('first open task is a choice task (setup)', false, 'tool was ' + wb.tool);
}

console.log(fails ? `\n${fails} FAILURE(S)` : '\nAll jumble checks passed.');
process.exit(fails ? 1 : 0);
