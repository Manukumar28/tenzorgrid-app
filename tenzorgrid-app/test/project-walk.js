// Walk any finished project through all five days as a learner would, and assert the
// whole shape holds: 6+2+2 a day, mail arriving, the day closing, the quiz on Friday,
// and the project completing on 30 + 10 + 1 + 10.
//
// Takes the project key as argv[3] so every project gets the same test rather than each
// one getting a bespoke suite that quietly checks less.
process.env.DATA_DIR = process.argv[2];
process.env.TIME_TRAVEL = '1';
const PROJECT = process.argv[3];
const path = require('node:path');
const ROOT = require('node:path').join(__dirname, '..');
const aiPath = require.resolve(path.join(ROOT, 'lib/ai.js'));
require.cache[aiPath] = { id: aiPath, filename: aiPath, loaded: true, exports: {
  isAvailable: () => false, callClaude: async () => null, extractJson: () => null } };
const { db, cryptoRandomId } = require(path.join(ROOT, 'lib/db.js'));
const ws = require(path.join(ROOT, 'lib/workspace.js'));
const st = require(path.join(ROOT, 'lib/skilltest.js'));
const items = require(path.join(ROOT, 'lib/dayitems.js'));
const mail = require(path.join(ROOT, 'lib/ambientmail.js'));

let fails = 0;
const check = (n, c, d) => { if (c) console.log('  PASS  ' + n); else { fails++; console.log('  FAIL  ' + n + (d ? '\n        ' + d : '')); } };
const emails = (s) => s.messages.filter((m) => m.sender_archetype !== 'learner' && (m.subject || '').trim());

const PROSE = 'Ranked by rows corrupted rather than by account size, weighted toward accounts where the damage is large relative to what they pay, and excluding Lattice Education because they have already churned. Harborview Bank lost 492,000 rows across two incidents, roughly three times the next worst, while Dunmore Legal, our largest account, lost about seven thousand. Two clients had no incidents at all. Severity does not track damage — SEV3 resolves slower than SEV2 — and seven incidents are still open, three of them SEV1, so those averages exclude them. I cannot give a churn rate from one churned account; what I can say is that the one account we lost had three incidents. Scope is the whole quarter, not billing-sync alone, which hit only two clients. Current staff and active clients only, counted once each rather than once per incident. Nothing is decided yet and the recommendation goes to Priya on Friday. Green and on track, no blockers, and I will confirm the revenue-at-risk figure against yours today using SUM(DISTINCT mrr) so nothing is double counted. I would recommend we fund the top four by damage. Yes, that works for me.';

(async () => {
  const uid = cryptoRandomId(), iso = new Date().toISOString();
  db.prepare('INSERT INTO users (id,email,password_hash,password_salt,created_at) VALUES (?,?,?,?,?)').run(uid, 'walk@e.com', 'x', 'y', iso);
  db.prepare('INSERT INTO profiles (user_id,name,created_at,updated_at) VALUES (?,?,?,?)').run(uid, 'Manukumar R', iso, iso);
  // Senior projects need a senior learner, or catalogFor never offers them.
  const SENIOR = ['reliability-review', 'account-economics', 'activation-review', 'experiment-readout'];
  const LEAD = ['trading-review', 'margin-review', 'range-review', 'board-pack'];
  const MANAGER = ['capacity-review', 'tooling-review', 'intake-review', 'headcount-case'];
  const level = MANAGER.includes(PROJECT) ? 'manager'
    : LEAD.includes(PROJECT) ? 'lead' : SENIOR.includes(PROJECT) ? 'senior' : 'junior';
  ws.startEnrollment(uid, { level, scheduleType: 'weekday' });
  ws.submitSkillTest(uid, Object.fromEntries(st.QUESTIONS.map((q) => [q.id, q.answer])));

  console.log(`0. Getting ${PROJECT} started`);
  const enr = ws.getEnrollment(uid);
  // The unlock gate is real and stays real. This is the testing door through it, which is
  // the same one the time-travel panel offers, so the suite exercises the path a person
  // reporting a bug on project four would actually use.
  ws.timeTravelStartProject(uid, PROJECT);
  let s = ws.getState(uid);
  check('the project is active', s.projects.projects.find((p) => p.key === PROJECT).status === 'active');
  check('thirty tasks were assigned',
    db.prepare('SELECT COUNT(*) n FROM sim_tasks WHERE enrollment_id = ?').get(enr.id).n === 30,
    String(db.prepare('SELECT COUNT(*) n FROM sim_tasks WHERE enrollment_id = ?').get(enr.id).n));

  const perDayEmails = [];
  for (let day = 1; day <= 5; day += 1) {
    console.log(`\n${day}. Day ${day}`);
    s = ws.getState(uid);
    check(`day ${day} is the current day`, s.day.unlocked === day, `unlocked=${s.day.unlocked}`);
    check(`day ${day} wants six tasks`, s.day.tasks.total === 6, JSON.stringify(s.day.tasks));
    check(`day ${day} wants two activities`, s.day.activities.total === 2, JSON.stringify(s.day.activities));
    check(`day ${day} wants two situations`, s.day.situations.total === 2, JSON.stringify(s.day.situations));
    const inboxAtDawn = emails(s).length;

    // Work it the way a person would: a couple of tasks, deal with what that brought in,
    // repeat until the day will close.
    for (let pass = 0; pass < 10; pass += 1) {
      const cur = ws.getState(uid);
      if (!cur.day || cur.day.readyToClose) break;
      for (const a of cur.activities.filter((x) => x.status !== 'done')) {
        const def = items.activitiesFor(PROJECT).find((z) => z.key === a.key);
        await ws.completeActivity(uid, a.key, def.check.kind === 'choice'
          ? def.check.options.find((o) => o.correct).key
          : def.check.kind === 'answer' ? PROSE : '');
      }
      for (const x of cur.situations.filter((z) => !z.handledAs)) {
        const def = items.situationsFor(PROJECT).find((z) => z.key === x.key);
        if (!def || def.needsReply) await ws.handleSituation(uid, x.key, 'reply', PROSE);
        else await ws.handleSituation(uid, x.key, 'archive', '');
      }
      for (const c of ws.getState(uid).chores.filter((x) => !x.done)) {
        const vals = {};
        for (const f of c.action.fields) {
          vals[f.key] = f.kind === 'ack' ? true : f.kind === 'number' ? f.min + 1 : f.options[0];
        }
        await ws.completeChore(uid, c.key, vals);
      }
      const open = ws.getState(uid).taskBoard.rows.filter((r) => !r.notYetOpen && r.status !== 'graded');
      // Do NOT break when the tasks run out: the second activity and situation land
      // after a couple of tasks are through, so there is always one more sweep to do.
      for (const r of open.slice(0, 2)) ws.timeTravelCompleteTask(uid, r.id);
    }

    if (day === 5) {
      const q = ws.getState(uid).quiz;
      check('the quiz is open on the last day', q && q.open === true, JSON.stringify(q && { open: q.open, taken: q.taken }));
      check('it has ten questions', q && q.questions.length === 10, String(q && q.questions.length));
      const def = items.quizFor(PROJECT);
      const answers = {};
      def.questions.forEach((qq, i) => {
        answers[qq.id] = i < 8 ? qq.options.find((o) => o.correct).key : qq.options.find((o) => !o.correct).key;
      });
      const qr = await ws.submitQuiz(uid, answers);
      check('it marks what you got right', qr.right === 8 && qr.total === 10, `${qr.right}/${qr.total}`);
    }

    // The morning's post has to be a believable inbox, not the whole day at once. Measured
    // as the growth during the day rather than the total, which only ever goes up.
    check(`day ${day} did not deliver its whole post at dawn`,
      emails(ws.getState(uid)).length > inboxAtDawn, `${inboxAtDawn} at dawn`);
    const ready = ws.getState(uid);
    check(`day ${day} became closeable`, ready.day && ready.day.readyToClose === true,
      JSON.stringify(ready.day && ready.day.pending));
    const closed = await ws.closeDay(uid);
    check(`day ${day} closed and Asha said so`, closed.closed === true && closed.message.length > 40);

    const enr2 = ws.getEnrollment(uid);
    const run = db.prepare('SELECT * FROM sim_project_runs WHERE enrollment_id = ? ORDER BY started_at DESC LIMIT 1').get(enr2.id);
    const ambient = db.prepare('SELECT COUNT(*) n FROM sim_ambient_mail WHERE enrollment_id = ? AND day_index = ?').get(enr2.id, day).n;
    const actE = items.activitiesFor(PROJECT).filter((a) => a.day === day && a.via === 'email').length;
    const sitE = items.situationsFor(PROJECT).filter((x) => x.day === day && x.via === 'email').length;
    const total = ambient + mail.deskFor(day).length + mail.choresFor(day).length + actE + sitE;
    perDayEmails.push(total);
    check(`day ${day} delivered at least ten emails`, total >= 10, String(total));
    void run;

    if (day < 5) {
      const next = ws.startNextDay(uid);
      check(`day ${day + 1} starts on request`, next.day === day + 1, String(next.day));
    }
  }

  console.log(`\n6. The project closes on all four currencies`);
  console.log(`    emails per day: ${perDayEmails.join(', ')}`);
  const done = ws.getState(uid);
  const pc = done.projectCompletion;
  console.log(`    tasks ${pc.tasks.done}/${pc.tasks.total} · activities ${pc.activities.done}/${pc.activities.total} · situations ${pc.situations.done}/${pc.situations.total} · quiz ${pc.quiz.taken}`);
  check('thirty tasks', pc.tasks.done === 30 && pc.tasks.total === 30);
  check('ten activities', pc.activities.done === 10 && pc.activities.total === 10);
  check('ten situations', pc.situations.done === 10 && pc.situations.total === 10);
  check('the quiz was sat', pc.quiz.taken === true);
  check('the project is complete', pc.complete === true);
  const signoff = done.messages.find((m) => /that's the week|signed off/i.test(m.subject || ''));
  check('a sign-off message arrived', Boolean(signoff), (done.messages.slice(-3).map((m) => m.subject) || []).join(' | '));
  check('the project reads as completed',
    done.projects.projects.find((p) => p.key === PROJECT).status === 'completed',
    done.projects.projects.find((p) => p.key === PROJECT).status);

  console.log(fails ? `\n${fails} FAILURE(S)` : `\nAll ${PROJECT} checks passed.`);
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
