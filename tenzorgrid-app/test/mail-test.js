// Ten emails a day, two of them wanting an answer.
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
const mail = require(path.join(ROOT, 'lib/ambientmail.js'));

let fails = 0;
const check = (n, c, d) => { if (c) console.log('  PASS  ' + n); else { fails++; console.log('  FAIL  ' + n + (d ? '\n        ' + d : '')); } };

function learner(email, name) {
  const uid = cryptoRandomId(), iso = new Date().toISOString();
  db.prepare('INSERT INTO users (id,email,password_hash,password_salt,created_at) VALUES (?,?,?,?,?)').run(uid, email, 'x', 'y', iso);
  db.prepare('INSERT INTO profiles (user_id,name,created_at,updated_at) VALUES (?,?,?,?)').run(uid, name || 'Priya Sharma', iso, iso);
  ws.startEnrollment(uid, { level: 'junior', scheduleType: 'weekday' });
  ws.submitSkillTest(uid, Object.fromEntries(st.QUESTIONS.map((q) => [q.id, q.answer])));
  return uid;
}

// Everything the learner has been sent that has a subject on it. That is the same rule
// getInbox uses to tell an email from a chat line, so it is the honest thing to count.
function emailsSent(s) {
  return s.messages.filter((m) => m.sender_archetype !== 'learner' && (m.subject || '').trim());
}

(async () => {
  console.log('1. The content is shaped the way the spec asks');
  check('two a day are addressed to the learner', [1, 2, 3, 4, 5].every((d) => mail.deskFor(d).length === 2),
    [1, 2, 3, 4, 5].map((d) => mail.deskFor(d).length).join(','));
  check('every one of them needs a reply', mail.DESK.every((d) => d.needsReply));
  check('every one of them says what a good answer contains',
    mail.DESK.every((d) => Array.isArray(d.expect) && d.expect.length >= 2 && d.markers.length >= 2));
  check('and what it costs to ignore it', mail.DESK.every((d) => (d.ifIgnored || '').length > 30));
  check('there is enough noise to fill any day',
    [1, 2, 3, 4, 5].every((d) => mail.noiseFor(d).length >= mail.MIN_EMAILS_PER_DAY - mail.DESK_PER_DAY),
    [1, 2, 3, 4, 5].map((d) => mail.noiseFor(d).length).join(','));
  check('one piece of company admin a day, with a form on it',
    [1, 2, 3, 4, 5].every((d) => mail.choresFor(d).length === 1
      && mail.choresFor(d)[0].action.fields.length >= 1),
    [1, 2, 3, 4, 5].map((d) => mail.choresFor(d).length).join(','));
  const keys = [...mail.DESK, ...mail.NOISE, ...mail.CHORES].map((x) => x.key);
  check('no two pieces of mail share a key', new Set(keys).size === keys.length);

  console.log('\n2. Day one fills an inbox, not a notification tray');
  const u = learner('mail1@e.com');
  let s = ws.getState(u);
  const first = emailsSent(s);
  console.log(`    ${first.length} emails waiting when you sit down`);
  check('a believable morning, not the whole day at once', first.length >= 1 && first.length <= 6,
    String(first.length));

  // Clear a couple of tasks and the rest of the post arrives, which is the point: mail
  // turns up while you are doing something else.
  for (const r of s.taskBoard.rows.filter((x) => !x.notYetOpen && x.status !== 'graded').slice(0, 3)) {
    ws.timeTravelCompleteTask(u, r.id);
  }
  s = ws.getState(u);
  const d1 = emailsSent(s);
  console.log(`    ${d1.length} after three tasks`);
  check('the inbox filled up as the work got done', d1.length > first.length, `${first.length} -> ${d1.length}`);
  check('two of them are addressed to the learner and want an answer',
    s.situations.filter((x) => x.day === 1 && x.deskMail).length === 2,
    String(s.situations.filter((x) => x.day === 1 && x.deskMail).length));
  check('and company noise is in there too',
    d1.some((m) => /all-hands/i.test(m.subject)), d1.map((m) => m.subject).join(' | '));
  check('the learner is addressed by their own first name',
    d1.some((m) => /Priya/.test(m.body || '')), '');
  check('and the project is named, not left as a placeholder',
    !d1.some((m) => /\{project\}|\{name\}/.test(`${m.subject} ${m.body}`)),
    (d1.find((m) => /\{/.test(`${m.subject} ${m.body}`)) || {}).subject);

  console.log('\n3. Refreshing the page does not re-send the morning post');
  const before = emailsSent(ws.getState(u)).length;
  ws.getState(u); ws.getState(u); ws.getState(u);
  check('still the same count', emailsSent(ws.getState(u)).length === before,
    `${before} -> ${emailsSent(ws.getState(u)).length}`);

  console.log('\n4. Answering the two that matter');
  const desk = ws.getState(u).situations.filter((x) => x.day === 1 && x.deskMail);
  const status = desk.find((x) => /status line/i.test(x.subject));
  check('the Programme Office asked for a status line', Boolean(status), desk.map((x) => x.subject).join(' | '));
  const good = ws.handleSituation(u, status.key, 'reply',
    'I am working on the departmental pay averages now. I expect to finish by Friday. The only risk is that a few departments have very few people in them, which I will caveat rather than let it push the date.');
  check('a real status line scores', good.score >= 60, String(good.score));
  check('and only then are you told what it was looking for',
    (ws.getState(u).situations.find((x) => x.key === status.key).expect || []).length >= 2);

  const u2 = learner('mail2@e.com');
  const st2 = ws.getState(u2).situations.find((x) => x.deskMail && /status line/i.test(x.subject));
  const bad = ws.handleSituation(u2, st2.key, 'archive', '');
  check('archiving one that was addressed to you scores zero', bad.score === 0, String(bad.score));
  check('and it says what that cost', /portfolio pack|no update/i.test(bad.feedback) || bad.feedback.length > 10,
    bad.feedback);
  const ign = ws.getState(u2).situations.find((x) => x.key === st2.key);
  check('the consequence is on the card afterwards', Boolean(ign.note), JSON.stringify(ign.note));

  console.log('\n5. Answering the noise is not how you finish the day');
  let day = ws.getState(u).day;
  check('the day gate still shows two situations, not four',
    day.situations.total === 2, JSON.stringify(day.situations));
  check('and answering the desk mail did not tick one off',
    day.situations.done === 0, JSON.stringify(day.situations));

  console.log('\n6. Every day of the week is a full inbox');
  const u3 = learner('mail3@e.com', 'Arun Mehta');
  const perDay = [];
  // Work each day the way a person would: a couple of tasks, then deal with what that
  // brought in, then the rest — repeating until the day will actually close. A single
  // pass is not enough now that the second activity arrives mid-morning.
  const REPLY = 'Green and on track — I am on the departmental averages now and expect to finish Friday. Nothing is blocked and nothing is outstanding with anyone else. Current staff only, leavers excluded, and I will confirm the headcount against yours today. The headline is a gap of about a fifth; confident on the direction, less sure of the size because a few cells are thin, so I would carry that forward. There is no region column, so hire year is what I can give you. Yes, four works.';
  for (let d = 1; d <= 5; d += 1) {
    for (let pass = 0; pass < 8; pass += 1) {
      const st3 = ws.getState(u3);
      if (!st3.day || st3.day.readyToClose) break;
      for (const a of st3.activities.filter((x) => x.status !== 'done')) {
        const ad = items.activitiesFor('compensation-review').find((z) => z.key === a.key);
        ws.completeActivity(u3, a.key, ad.check.kind === 'choice'
          ? ad.check.options.find((o) => o.correct).key
          : ad.check.kind === 'answer'
            ? 'I filtered to current staff with exit_year IS NULL, grouped by department and used a left join so teams with no rows show as zero rather than disappearing. Next time I would check the row counts sooner.'
            : '');
      }
      for (const x of st3.situations.filter((z) => !z.handledAs)) {
        const sd = items.situationsFor('compensation-review').find((z) => z.key === x.key);
        if (!sd || sd.needsReply) ws.handleSituation(u3, x.key, 'reply', REPLY);
        else ws.handleSituation(u3, x.key, 'archive', '');
      }
      const open = ws.getState(u3).taskBoard.rows.filter((r) => !r.notYetOpen && r.status !== 'graded');
      if (!open.length) continue;
      // Two at a time, so the mid-morning arrivals actually get a chance to arrive.
      for (const row of open.slice(0, 2)) ws.timeTravelCompleteTask(u3, row.id);
    }
    const ready = ws.getState(u3);
    if (ready.day && ready.day.readyToClose) {
      ws.closeDay(u3);
      if (ws.getState(u3).day.nextDayName) ws.startNextDay(u3);
    }
  }

  // Counted per project day rather than as an increment, because a learner's own replies
  // and the answers to them also land in the inbox and would flatter the number.
  const enr = db.prepare('SELECT * FROM sim_enrollments WHERE user_id = ?').get(u3);
  for (let d = 1; d <= 5; d++) {
    const ambient = db.prepare('SELECT COUNT(*) n FROM sim_ambient_mail WHERE enrollment_id = ? AND day_index = ?')
      .get(enr.id, d).n;
    const actEmails = items.activitiesFor('compensation-review').filter((a) => a.day === d && a.via === 'email').length;
    const sitEmails = items.situationsFor('compensation-review').filter((x) => x.day === d && x.via === 'email').length;
    perDay.push(ambient + mail.deskFor(d).length + mail.choresFor(d).length + actEmails + sitEmails);
  }
  console.log(`    inbound emails per day: ${perDay.join(', ')}`);
  check('every day of the project delivered at least ten', perDay.every((n) => n >= 10), perDay.join(','));
  const allDesk = ws.getState(u3).situations.filter((x) => x.deskMail);
  check('ten pieces of desk mail across the week', allDesk.length === 10, String(allDesk.length));
  check('two on every day', [1, 2, 3, 4, 5].every((d) => mail.deskFor(d).length === 2));
  const subs = emailsSent(ws.getState(u3)).map((m) => m.subject);
  check('and no email was sent twice', new Set(subs).size === subs.length,
    subs.filter((x, i) => subs.indexOf(x) !== i).join(' | '));

  console.log('\n7. Replying by email comes back by email');
  const anyDesk = ws.getState(u3).situations.find((x) => x.deskMail && x.handledAs === 'reply');
  const thread = ws.getState(u3).inbox.threads.find((t) => t.messages.some((m) => m.senderArchetype === 'learner'));
  check('the learner\'s reply is in the inbox thread, not the chat dock', Boolean(thread),
    'no thread carries a learner message');
  check('the sender answered in the same thread',
    Boolean(thread && thread.messages.filter((m) => m.senderArchetype !== 'learner').length >= 2));
  check('an ambient sender signs with its own name, not a colleague\'s',
    ws.getState(u3).messages.some((m) => m.sender_name === 'Programme Office'));

  console.log(fails ? `\n${fails} FAILURE(S)` : '\nAll mail checks passed.');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
