// The other task types: what an analyst's day is actually made of.
//
// A day of six SQL queries is not a job, it is a worksheet. A real analyst's morning is a
// bit of querying and a lot of everything else — reading the brief properly, checking
// someone else's work, deciding what a number does and does not support, and writing the
// thing that goes to the stakeholder.
//
// Two graders live here:
//
//   `choice`  — a structured judgement. The learner picks from options, some of which are
//               correct. Deterministic, so it costs nothing. Used for reviewing a
//               colleague's query, scoping a request, and deciding what a result supports.
//
//   `writeup` — prose. Graded against an authored rubric of points that must be present.
//               Without an AI key there is a deterministic check that looks for each
//               rubric point's own markers and says plainly what it looked for. Blunt, but
//               a blunt instrument that explains itself beats refusing to grade.

// ---- Structured judgement -----------------------------------------------------------
//
// Scored on both what they picked and what they left. Selecting everything must not score
// well — "flag every line as a problem" is not review, it is noise, and a grader that
// rewarded it would teach exactly the wrong habit.
function gradeChoice(spec, answer) {
  const picked = new Set(Array.isArray(answer) ? answer : (answer && answer.picked) || []);
  const right = spec.options.filter((o) => o.correct).map((o) => o.key);
  const wrong = spec.options.filter((o) => !o.correct).map((o) => o.key);

  const found = right.filter((k) => picked.has(k)).length;
  const falseAlarms = wrong.filter((k) => picked.has(k)).length;

  // Missing a real problem and inventing one weigh the same. The denominator is the number
  // of real problems, so a learner who ticks every box scores zero rather than full marks.
  const score = Math.max(0, Math.round(((found - falseAlarms) / right.length) * 100));

  const missed = spec.options.filter((o) => o.correct && !picked.has(o.key));
  const invented = spec.options.filter((o) => !o.correct && picked.has(o.key));

  const parts = [];
  if (found) parts.push(`You caught ${found} of ${right.length}.`);
  for (const o of missed) parts.push(`Missed: ${o.label} — ${o.why}`);
  for (const o of invented) parts.push(`Not a problem: ${o.label} — ${o.why}`);
  if (!missed.length && !invented.length) {
    parts.push(spec.whyRight || 'Exactly right, and nothing flagged that was not a problem.');
  }

  return {
    score,
    feedback: parts.join('\n\n'),
    skills: spec.skills || { businessLogic: score },
    detail: { found, total: right.length, falseAlarms },
  };
}

// ---- Prose --------------------------------------------------------------------------
//
// The rubric is a list of points the piece has to make. Each carries `markers`: the words
// or shapes that show the point was made.
function gradeWriteup(spec, text) {
  const body = String(text || '').trim();
  const words = body.split(/\s+/).filter(Boolean).length;

  if (words < 20) {
    return {
      score: 0,
      feedback: 'There is not enough here to send to anyone. Say what you found, what it means, and what you want them to do about it.',
      skills: { communication: 0 },
      detail: { words, hit: [], missed: spec.rubric.map((r) => r.key) },
    };
  }

  const hit = [], missed = [];
  for (const point of spec.rubric) {
    const found = (point.markers || []).some((m) => new RegExp(m, 'i').test(body));
    (found ? hit : missed).push(point);
  }

  let score = Math.round((hit.length / spec.rubric.length) * 100);
  // Length is not quality, but a stakeholder email that runs to 400 words is a real
  // failure of the brief and the learner should hear about it.
  const tooLong = spec.maxWords && words > spec.maxWords;
  if (tooLong) score = Math.max(0, score - 15);

  const parts = [];
  if (hit.length) parts.push(`Covered: ${hit.map((p) => p.label).join(', ')}.`);
  for (const p of missed) parts.push(`Missing — ${p.label}: ${p.why}`);
  if (tooLong) {
    parts.push(`It runs to ${words} words. ${spec.maxWords} is the brief, and a stakeholder who has to scroll usually stops reading before your recommendation.`);
  }
  if (!missed.length && !tooLong) {
    parts.push(spec.whyRight || 'That covers everything it needed to, in a length someone will actually read.');
  }

  return {
    score,
    feedback: parts.join('\n\n'),
    skills: { communication: score, businessLogic: Math.round(score * 0.8) },
    detail: { words, hit: hit.map((p) => p.key), missed: missed.map((p) => p.key) },
  };
}

// ---- Coaching -------------------------------------------------------------------------
//
// The senior slot. Somebody junior has done a piece of work and it is not right, and the
// job is no longer to fix it — it is to see what is wrong and then tell them in a way that
// leaves them able to do it themselves next time.
//
// Graded as two halves because it really is two skills, and people are reliably good at
// one and bad at the other:
//
//   diagnose — what is actually wrong with this. Reuses the judgement grader, including
//              the rule that ticking every box scores zero. Flagging everything in a
//              junior's work is not review, it is discouragement with a checklist.
//   reply    — what you say to them. Reuses the prose grader against an authored rubric.
//
// Fifty-fifty on purpose. A correct diagnosis delivered badly is most of what makes people
// quit a job, and a kind message that misses the bug ships the bug.
const COACH_SPLIT = { diagnose: 0.5, reply: 0.5 };

function gradeCoach(spec, answer) {
  const picked = (answer && answer.picked) || [];
  const reply = (answer && answer.reply) || '';

  const d = gradeChoice(spec.diagnose, picked);
  const r = gradeWriteup(spec.reply, reply);
  const score = Math.round(d.score * COACH_SPLIT.diagnose + r.score * COACH_SPLIT.reply);

  const who = spec.menteeName || 'them';
  const parts = [
    `What you spotted — ${d.score}/100`,
    d.feedback,
    `How you said it — ${r.score}/100`,
    r.feedback,
  ];
  // The failure worth naming out loud, because it is the one that feels like helping.
  if (d.score >= 70 && r.score < 50) {
    parts.push(`You found it. ${who} still has to hear it in a way they can act on, though — being right is the easy half.`);
  }
  if (d.score < 50 && r.score >= 70) {
    parts.push(`That reads well, which is worse than it sounds: you have told ${who} confidently about the wrong thing.`);
  }

  return {
    score,
    feedback: parts.join('\n\n'),
    skills: {
      coaching: score,
      communication: r.score,
      businessLogic: d.score,
    },
    detail: { diagnose: d.detail, reply: r.detail, diagnoseScore: d.score, replyScore: r.score },
  };
}

// ---- Allocation -----------------------------------------------------------------------
//
// The first Team Lead slot: a week of work and the people to do it. This is the one thing
// a lead does that an analyst never does, and it is unusually gradeable — an assignment is
// right or wrong against constraints you can count, not against taste.
//
// Each item names who should do it, who could, and who must not with the reason. "Must
// not" is the interesting column: it is where the leaver, the six-week joiner and the
// person already at capacity live, and a lead who staffs one of them has made a decision
// with a name attached to it.
const ASSIGN_SCORE = { best: 100, acceptable: 60, other: 25, forbidden: 0 };

function gradeAssign(spec, answer) {
  const picks = (answer && answer.assignments) || {};
  const byKey = Object.fromEntries(spec.team.map((m) => [m.key, m]));
  const notes = [];
  let total = 0;

  for (const item of spec.items) {
    const who = picks[item.key];
    const person = byKey[who];
    let band;
    if (!who) band = 'other';
    else if (item.forbidden && item.forbidden[who]) band = 'forbidden';
    else if ((item.best || []).includes(who)) band = 'best';
    else if ((item.acceptable || []).includes(who)) band = 'acceptable';
    else band = 'other';
    total += ASSIGN_SCORE[band];

    const name = person ? person.name.split(' ')[0] : 'nobody';
    if (band === 'forbidden') notes.push(`${item.label} → ${name}: ${item.forbidden[who]}`);
    else if (band === 'other') notes.push(`${item.label} → ${name}. ${item.why}`);
    else if (band === 'acceptable') notes.push(`${item.label} → ${name} works, but ${item.why}`);
  }

  let score = spec.items.length ? Math.round(total / spec.items.length) : 0;

  // Capacity is a hard constraint and deserves to be felt as one. A lead who assigns four
  // days of work to somebody with two has not made a plan, they have made a wish.
  const load = {};
  for (const item of spec.items) {
    const who = picks[item.key];
    if (who) load[who] = (load[who] || 0) + (item.days || 0);
  }
  const over = [];
  for (const m of spec.team) {
    if (load[m.key] && m.capacityDays && load[m.key] > m.capacityDays) {
      over.push(`${m.name.split(' ')[0]} is carrying ${load[m.key]} days against ${m.capacityDays} available`);
    }
  }
  if (over.length) {
    score = Math.max(0, score - 20 * over.length);
    notes.push(`Over capacity — ${over.join('; ')}. Somebody has to be told this does not fit, and it is better that it is you, today.`);
  }

  const unassigned = spec.items.filter((i) => !picks[i.key]);
  if (unassigned.length) notes.push(`Left unassigned: ${unassigned.map((i) => i.label).join(', ')}.`);

  if (!notes.length) notes.push(spec.whyRight || 'Everything staffed to somebody who can carry it, inside the time they actually have.');

  return {
    score,
    feedback: notes.join('\n\n'),
    skills: { delivery: score, businessLogic: score },
    detail: { items: spec.items.length, over: over.length, unassigned: unassigned.length },
  };
}

// ---- Sign-off -------------------------------------------------------------------------
//
// The second Team Lead slot: work you did not do, going out with your name on it.
//
// Weighted toward the call rather than the wording — the opposite of the coaching split.
// A senior who phrases feedback badly has a bad afternoon; a lead who ships the wrong
// number has a bad quarter, and the person who wrote it is not the one who answers for it.
const SIGNOFF_SPLIT = { decision: 0.6, reply: 0.4 };

function gradeSignoff(spec, answer) {
  const picked = (answer && answer.picked) || [];
  const reply = (answer && answer.reply) || '';

  const d = gradeChoice(spec.decision, picked);
  const r = gradeWriteup(spec.reply, reply);
  const score = Math.round(d.score * SIGNOFF_SPLIT.decision + r.score * SIGNOFF_SPLIT.reply);

  const parts = [`The call — ${d.score}/100`, d.feedback, `What you said — ${r.score}/100`, r.feedback];
  if (d.score < 50 && r.score >= 70) {
    parts.push('Well put, and it goes out wrong. Nobody downstream will be able to tell those apart.');
  }
  if (d.score >= 70 && r.score < 50) {
    parts.push('Right call. The person who wrote it still has to understand why, or you will be making the same call again next week.');
  }

  return {
    score,
    feedback: parts.join('\n\n'),
    skills: { delivery: d.score, communication: r.score, coaching: score, businessLogic: d.score },
    detail: { decision: d.detail, reply: r.detail, decisionScore: d.score, replyScore: r.score },
  };
}

// ---- Option order ---------------------------------------------------------------------
//
// Authored option lists put the correct answers first, because that is how a person writes
// them. Shipped that way, every judgement task in the product could be beaten by ticking
// the top boxes without reading a word — which is the exact habit these tasks exist to
// break. Found by the learner, not by a test, which is its own lesson.
//
// The shuffle is SEEDED rather than random. Random would reorder the options every time the
// page reloaded, which lets someone refresh their way to a second look and quietly makes
// "the third one" mean nothing between the learner and their manager. Seeded on the
// learner's own task row, the order is stable for them and different from anyone else's.

function seedFrom(str) {
  // FNV-1a. Small, no dependencies, and spreads similar keys (da-100, da-101) far apart —
  // which matters here, because neighbouring tasks are exactly what we do not want
  // shuffled the same way.
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function rngFrom(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleSeeded(items, seed) {
  const out = items.slice();
  const rng = rngFrom(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// What the learner is shown. Correct answers and rubric markers never leave the server —
// and now neither does the authored ORDER, which was leaking the answer just as surely.
function presentChoice(spec, seed) {
  const options = spec.options.map((o) => ({ key: o.key, label: o.label }));
  return {
    prompt: spec.prompt,
    // Read-only context — a colleague's query, a stakeholder's message, a result table.
    exhibit: spec.exhibit || null,
    multi: spec.multi !== false,
    options: seed ? shuffleSeeded(options, seedFrom(String(seed))) : options,
  };
}

function presentWriteup(spec) {
  return {
    prompt: spec.prompt,
    exhibit: spec.exhibit || null,
    to: spec.to || null,
    subject: spec.subject || null,
    maxWords: spec.maxWords || null,
    // The rubric LABELS are shown — a brief that hides what it is asking for is a trick,
    // not an assessment. The markers behind them are not.
    covers: spec.rubric.map((r) => r.label),
  };
}

// The coaching task as the learner sees it: the junior's work, what might be wrong with
// it, and a box to write to them. Correct answers and rubric markers stay on the server,
// and the diagnosis options are shuffled on the same seeded basis as any other judgement.
function presentCoach(spec, seed) {
  return {
    mentee: spec.menteeName || null,
    menteeTitle: spec.menteeTitle || null,
    prompt: spec.prompt,
    exhibit: spec.exhibit || null,
    diagnose: presentChoice(spec.diagnose, seed),
    reply: presentWriteup(spec.reply),
  };
}

// The week as the learner sees it: the work, the people, and what each of them has on.
// Who SHOULD do what never leaves the server.
function presentAssign(spec) {
  return {
    prompt: spec.prompt,
    context: spec.context || null,
    team: spec.team.map((m) => ({
      key: m.key, name: m.name, title: m.title,
      capacityDays: m.capacityDays, note: m.note || null,
    })),
    items: spec.items.map((i) => ({ key: i.key, label: i.label, days: i.days || null, note: i.note || null })),
  };
}

function presentSignoff(spec, seed) {
  return {
    from: spec.fromName || null,
    fromTitle: spec.fromTitle || null,
    prompt: spec.prompt,
    exhibit: spec.exhibit || null,
    decision: presentChoice(spec.decision, seed),
    reply: presentWriteup(spec.reply),
  };
}

module.exports = {
  gradeChoice, gradeWriteup, gradeCoach, gradeAssign, gradeSignoff,
  presentChoice, presentWriteup, presentCoach, presentAssign, presentSignoff,
  shuffleSeeded, seedFrom,
};
