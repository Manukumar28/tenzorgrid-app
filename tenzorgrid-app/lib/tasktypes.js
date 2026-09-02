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

// What the learner is shown. Correct answers and rubric markers never leave the server.
function presentChoice(spec) {
  return {
    prompt: spec.prompt,
    // Read-only context — a colleague's query, a stakeholder's message, a result table.
    exhibit: spec.exhibit || null,
    multi: spec.multi !== false,
    options: spec.options.map((o) => ({ key: o.key, label: o.label })),
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

module.exports = { gradeChoice, gradeWriteup, presentChoice, presentWriteup };
