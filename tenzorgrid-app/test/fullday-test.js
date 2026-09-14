// The whole day: 6 tasks, 2 activities, 2 situations — and the project that ends when all
// fifty-one items are done.
process.env.DATA_DIR = process.argv[2];
process.env.TIME_TRAVEL = '1';
const path = require('node:path');
const ROOT = require('node:path').join(__dirname, '..');
const aiPath = require.resolve(path.join(ROOT, 'lib/ai.js'));
require.cache[aiPath] = { id: aiPath, filename: aiPath, loaded: true, exports: {
  isAvailable: () => false, callClaude: async () => null, extractJson: () => null } };

const { db, cryptoRandomId } = require(path.join(ROOT, 'lib/db.js'));
const ws = require(path.join(ROOT, 'lib/workspace.js'));
const st = require(path.join(ROOT, 'lib/skilltest.js'));
const items = require(path.join(ROOT, 'lib/dayitems.js'));

let fails = 0;
const check = (n, c, d) => { if (c) console.log('  PASS  ' + n); else { fails++; console.log('  FAIL  ' + n + (d ? '\n        ' + d : '')); } };

// The second activity and situation arrive once a couple of tasks are through, so a
// learner who has just sat down has not met them yet. Suites that need the whole day on
// screen clear two tasks first, which is what a person would have done by then anyway.
function warmUp(uid) {
  for (const r of ws.getState(uid).taskBoard.rows.filter((x) => !x.notYetOpen && x.status !== 'graded').slice(0, 2)) {
    ws.timeTravelCompleteTask(uid, r.id);
  }
}

function learner(email) {
  const uid = cryptoRandomId(), iso = new Date().toISOString();
  db.prepare('INSERT INTO users (id,email,password_hash,password_salt,created_at) VALUES (?,?,?,?,?)').run(uid, email, 'x', 'y', iso);
  db.prepare('INSERT INTO profiles (user_id,name,created_at,updated_at) VALUES (?,?,?,?)').run(uid, 'Priya Sharma', iso, iso);
  ws.startEnrollment(uid, { level: 'junior', scheduleType: 'weekday' });
  ws.submitSkillTest(uid, Object.fromEntries(st.QUESTIONS.map((q) => [q.id, q.answer])));
  return uid;
}

(async () => {
  console.log('1. Day one arrives with more than tasks on it');
  const u = learner('fd1@e.com');
  let s = ws.getState(u);
  check('the day is reported in three currencies', s.day && s.day.tasks && s.day.activities && s.day.situations,
    JSON.stringify(s.day));
  // The day's work no longer all lands at nine. The first of each is waiting; the second
  // turns up once a couple of tasks are through, which is the interruption being practised.
  check('the first activity is waiting', s.activities.filter((a) => a.day === 1).length === 1,
    String(s.activities.filter((a) => a.day === 1).length));
  check('but the day still knows it owes two', s.day.activities.total === 2,
    JSON.stringify(s.day.activities));
  check('the first situation has landed', s.situations.filter((x) => x.day === 1 && !x.deskMail).length === 1,
    String(s.situations.filter((x) => x.day === 1 && !x.deskMail).length));
  check('and the day still owes two of those', s.day.situations.total === 2,
    JSON.stringify(s.day.situations));

  // Clear two tasks and the rest of the morning arrives.
  const firstTwo = s.taskBoard.rows.filter((r) => !r.notYetOpen && r.status !== 'graded').slice(0, 2);
  for (const r of firstTwo) ws.timeTravelCompleteTask(u, r.id);
  s = ws.getState(u);
  check('both activities have arrived now', s.activities.filter((a) => a.day === 1).length === 2,
    String(s.activities.filter((a) => a.day === 1).length));
  check('both situations too', s.situations.filter((x) => x.day === 1 && !x.deskMail).length === 2,
    String(s.situations.filter((x) => x.day === 1 && !x.deskMail).length));
  check('and two emails addressed to the learner needing a reply',
    s.situations.filter((x) => x.day === 1 && x.deskMail).length === 2,
    String(s.situations.filter((x) => x.day === 1 && x.deskMail).length));
  check('day 2 has not been issued yet', s.activities.filter((a) => a.day === 2).length === 0);

  console.log('\n2. They arrived as mail and chat, not as a list');
  const subjects = s.messages.map((m) => m.subject || '').filter(Boolean);
  check('an email is in the inbox', subjects.some((x) => /timesheets close/i.test(x)), subjects.slice(0, 6).join(' | '));
  check('and it came from a real colleague',
    s.messages.some((m) => /Kickoff/i.test(m.subject || '')));

  console.log('\n3. Reading the page twice does not send the mail twice');
  const before = s.messages.length;
  ws.getState(u); ws.getState(u);
  check('no duplicates', ws.getState(u).messages.length === before, `${before} -> ${ws.getState(u).messages.length}`);

  console.log('\n4. An activity is answered, and the sender replies');
  const act = ws.getState(u).activities.find((a) => a.day === 1 && a.check.kind === 'choice');
  const def = items.activitiesFor('compensation-review').find((a) => a.key === act.key);
  const right = def.check.options.find((o) => o.correct).key;
  const r1 = ws.completeActivity(u, act.key, right);
  check('a correct answer scores 100', r1.score === 100, String(r1.score));
  check('and the sender comes back', r1.state.messages.some((m) => (m.body || '').includes('NULL never equals')));
  check('doing it twice is refused',
    (() => { try { ws.completeActivity(u, act.key, right); return false; } catch (e) { return /already/.test(e.message); } })());

  const ack = ws.getState(u).activities.find((a) => a.day === 1 && a.check.kind === 'acknowledge');
  ws.completeActivity(u, ack.key, '');
  check('an acknowledgement closes without a score',
    ws.getState(u).activities.find((a) => a.key === ack.key).status === 'done');
  check('both of day one\'s activities are done now',
    ws.getState(u).day.activities.done === 2, JSON.stringify(ws.getState(u).day.activities));

  console.log('\n5. The noise is supposed to be ignored');
  const noise = ws.getState(u).situations.find((x) => x.day === 1 && /timesheets/i.test(x.subject || ''));
  const rn = ws.handleSituation(u, noise.key, 'archive', '');
  check('archiving the timesheet reminder is the RIGHT answer', rn.score === 100, String(rn.score));

  const u2 = learner('fd2@e.com');
  warmUp(u2);
  const noise2 = ws.getState(u2).situations.find((x) => /timesheets/i.test(x.subject || ''));
  const rn2 = ws.handleSituation(u2, noise2.key, 'reply', 'Thanks, will do!');
  check('replying to it costs you', rn2.score < 50, String(rn2.score));
  check('and it says why', /did not need one/i.test(rn2.feedback), rn2.feedback);

  console.log('\n6. The one that needs an answer');
  const invite = ws.getState(u).situations.find((x) => /Kickoff/i.test(x.subject || ''));
  const ri = ws.handleSituation(u, invite.key, 'reply', 'Four works for me — see you then.');
  check('a real reply scores', ri.score >= 50, String(ri.score));
  const u3 = learner('fd3@e.com');
  const inv3 = ws.getState(u3).situations.find((x) => /Kickoff/i.test(x.subject || ''));
  const ri3 = ws.handleSituation(u3, inv3.key, 'archive', '');
  check('archiving one that needed an answer scores zero', ri3.score === 0, String(ri3.score));
  check('and tells you what it cost', /takes the silence/i.test(ri3.feedback), ri3.feedback);

  console.log('\n7. The day is not done until all ten items are');
  let d = ws.getState(u).day;
  check('activities and situations are complete', d.activities.done === 2 && d.situations.done === 2);
  check('but the day is not, because the tasks are not', d.complete === false, JSON.stringify(d));

  const open = ws.getState(u).taskBoard.rows.filter((r) => !r.notYetOpen && r.status !== 'graded');
  check('the rest of day one is still there', open.length === 4, String(open.length));
  for (const row of open) ws.timeTravelCompleteTask(u, row.id);
  // `day` reports the day you are NOW on, so finishing day one moves it to two — which is
  // the observable meaning of "day one is complete".
  // Finishing the work makes the day CLOSEABLE. It does not roll over on its own — that
  // was the whole point of the change, so the well done has somewhere to live.
  check('the day is now closeable', ws.getState(u).day.readyToClose === true,
    JSON.stringify(ws.getState(u).day));
  ws.closeDay(u);
  ws.startNextDay(u);
  check('and once signed off, it is day two', ws.getState(u).day.day === 2,
    JSON.stringify(ws.getState(u).day));

  console.log('\n8. Finishing today opens tomorrow — no waiting for the clock');
  const s2 = ws.getState(u);
  check('the unlocked day moved to 2', s2.day.unlocked === 2, String(s2.day.unlocked));
  check('day 2 work is on the board', s2.taskBoard.rows.filter((r) => !r.notYetOpen && r.status !== 'graded').length === 6,
    String(s2.taskBoard.rows.filter((r) => !r.notYetOpen && r.status !== 'graded').length));
  check('and day 2 mail has started arriving', s2.activities.filter((a) => a.day === 2).length >= 1);
  check('day 3 has not', s2.activities.filter((a) => a.day === 3).length === 0);

  console.log('\n9. The quiz waits for the last day');
  check('not open on day 2', ws.getState(u).quiz && ws.getState(u).quiz.open === false);

  console.log('\n10. Walking the whole project to the end');
  const finishDay = (uid) => {
    const state = ws.getState(uid);
    for (const a of state.activities.filter((x) => x.status !== 'done')) {
      const ad = items.activitiesFor('compensation-review').find((z) => z.key === a.key);
      const ans = ad.check.kind === 'choice' ? ad.check.options.find((o) => o.correct).key
        : ad.check.kind === 'answer' ? 'I excluded the two zero-salary rows on unpaid leave, filtered to current staff using exit_year IS NULL, and grouped by department. A left join keeps teams with no rows so they show as zero rather than vanishing. Next time I would check the counts sooner.'
        : '';
      ws.completeActivity(uid, a.key, ans);
    }
    for (const x of state.situations.filter((z) => !z.handledAs)) {
      const sd = items.situationsFor('compensation-review').find((z) => z.key === x.key);
      if (!sd) {
        // Ambient desk mail — a status request from the Programme Office or a colleague.
        // It is answered like anything else, but it is not one of the project's ten.
        ws.handleSituation(uid, x.key, 'reply',
          'Green, on track. I am on the departmental averages and the band position now and I expect to finish by Friday; the only risk is the small sample in a few departments, which I will caveat. Nothing is blocked and nothing is outstanding with anyone else. Yesterday\'s tasks are signed off, the rest are with Asha for review. The headline is a pay gap of around a fifth between the highest and lowest departments; I am reasonably confident on the direction, less on the size because some cells are thin. I would recommend we carry the small-sample question into the next piece of work. My totals are current staff only with leavers excluded, and I will confirm the headcount against yours today.');
        continue;
      }
      if (sd.needsReply) {
        ws.handleSituation(uid, x.key, 'reply',
          'Yes — four works. There is no region or location column in the dataset so a regional split is not possible before Friday; I can give you hire year instead. Current staff only, leavers excluded. I will exclude the two zero-salary sabbatical rows and footnote it. Done so far: the departmental averages and the band position. Left: the write-up tomorrow.');
      } else {
        ws.handleSituation(uid, x.key, 'archive', '');
      }
    }
    for (const row of ws.getState(uid).taskBoard.rows.filter((r) => !r.notYetOpen && r.status !== 'graded')) {
      ws.timeTravelCompleteTask(uid, row.id);
    }
    // Sign off and clock on, the way a learner does.
    const after = ws.getState(uid);
    if (after.day && after.day.readyToClose) {
      ws.closeDay(uid);
      if (ws.getState(uid).day.nextDayName) ws.startNextDay(uid);
    }
  };
  let pc = null;
  for (let i = 0; i < 10; i++) {
    const st0 = ws.getState(u);
    pc = st0.projectCompletion || pc;
    if (!st0.day || (st0.projectCompletion && st0.projectCompletion.complete)) break;
    finishDay(u);
  }
  pc = ws.getState(u).projectCompletion || pc;
  console.log(`    tasks ${pc.tasks.done}/${pc.tasks.total} · activities ${pc.activities.done}/${pc.activities.total} · situations ${pc.situations.done}/${pc.situations.total} · quiz ${pc.quiz.taken}`);
  check('every task is done', pc.tasks.done === pc.tasks.total);
  check('all ten activities', pc.activities.done === 10, `${pc.activities.done}`);
  check('all ten situations', pc.situations.done === 10, `${pc.situations.done}`);
  check('and the project count ignores the desk mail sharing the table',
    pc.situations.total === 10, `${pc.situations.total}`);

  console.log('\n11. The Friday quiz');
  const q = ws.getState(u).quiz;
  check('it is open now', q.open === true, JSON.stringify({ open: q.open, taken: q.taken }));
  check('it has ten questions', q.questions.length === 10, String(q.questions.length));
  check('the correct answer is not always first', (() => {
    const firsts = q.questions.map((x) => x.options[0].key);
    return new Set(firsts).size > 1;
  })(), q.questions.map((x) => x.options[0].key).join(''));

  const quizDef = items.quizFor('compensation-review');
  const answers = {};
  quizDef.questions.forEach((qq, i) => {
    answers[qq.id] = i < 7 ? (qq.options.find((o) => o.correct).key)
                           : (qq.options.find((o) => !o.correct).key);
  });
  const qr = ws.submitQuiz(u, answers);
  check('it marks what you got right', qr.right === 7 && qr.total === 10, `${qr.right}/${qr.total}`);
  check('and shows the reasoning', qr.results.every((r) => r.why && r.why.length > 20));
  check('you cannot sit it twice',
    (() => { try { ws.submitQuiz(u, answers); return false; } catch (e) { return /already/.test(e.message); } })());

  console.log('\n12. The project closes itself, and Asha says so');
  // Signing off the last day is what completes the project — it is the moment the week
  // builds to, and closing the run before it would skip the well done entirely.
  if (ws.getState(u).day && ws.getState(u).day.readyToClose) ws.closeDay(u);
  const done = ws.getState(u);
  check('the project is complete', done.projectCompletion === null || done.projectCompletion.complete,
    JSON.stringify(done.projectCompletion && done.projectCompletion.tasks));
  const signoff = done.messages.find((m) => /signed off/i.test(m.subject || ''));
  check('a sign-off message arrived', Boolean(signoff), (done.messages[0] || {}).subject);
  if (signoff) {
    check('it names what they actually did, not just well done',
      /unannounced|could not be answered|said so early/i.test(signoff.body), signoff.body.slice(0, 90));
    check('and points at the next one', /next one/i.test(signoff.body));
  }

  console.log(fails ? `\n${fails} FAILURE(S)` : '\nAll full-day checks passed.');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
