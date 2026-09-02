// Chart tasks: the missing half of a data analyst.
//
// `dataViz` has been an axis on the skill matrix since the beginning with no task that
// could ever move it. That is worse than not having the axis — it reports a permanent
// zero on a skill the learner is never given a chance to show.
//
// A chart task hands the learner a result set and asks them to present it. They choose
// the chart type, what goes on each axis, how it is ordered, and whether the value axis
// starts at zero. That is graded against an authored spec, field by field, with no AI
// call — which is what makes it affordable six times a day.
//
// Why choices and not free-form code: the thing being assessed is JUDGEMENT, not
// matplotlib syntax. "Bar, not pie, because averages don't sum to a whole" is the
// lesson; whether they can remember `plt.bar(...)` is not, and grading rendered images
// is not something this can do honestly.

const CHART_TYPES = [
  { key: 'bar', label: 'Bar chart', note: 'Compare a value across categories' },
  { key: 'column', label: 'Column chart', note: 'Same, drawn vertically' },
  { key: 'line', label: 'Line chart', note: 'A value changing over an ordered sequence' },
  { key: 'pie', label: 'Pie chart', note: 'Parts of a single whole' },
  { key: 'scatter', label: 'Scatter plot', note: 'Relationship between two numbers' },
];

const SORTS = [
  { key: 'desc', label: 'Highest first' },
  { key: 'asc', label: 'Lowest first' },
  { key: 'none', label: "Leave in the data's own order" },
];

// Each field is graded separately and carries its own weight, because the mistakes are
// not equal: a pie chart of averages is a category error, whereas an unsorted bar chart
// is merely harder to read.
const WEIGHTS = { type: 40, x: 15, y: 15, sort: 15, baselineZero: 15 };

function fieldsFor(spec) {
  // A chart that is not a bar/column has no meaningful zero-baseline question, and a
  // scatter has no sort. Only ask about what applies, or the learner is graded on a
  // choice that does not exist.
  const asks = ['type', 'x', 'y'];
  if (spec.correct.type !== 'scatter' && spec.correct.type !== 'pie') asks.push('sort');
  if (['bar', 'column'].includes(spec.correct.type)) asks.push('baselineZero');
  return asks;
}

function grade(spec, answer) {
  const given = answer && typeof answer === 'object' ? answer : {};
  const asks = fieldsFor(spec);
  const total = asks.reduce((s, f) => s + WEIGHTS[f], 0);

  let earned = 0;
  const notes = [];
  for (const field of asks) {
    const want = spec.correct[field];
    const got = given[field];
    const ok = field === 'baselineZero' ? Boolean(got) === Boolean(want) : got === want;
    if (ok) earned += WEIGHTS[field];
    notes.push({ field, ok, got: got === undefined ? null : got, want, why: ok ? null : (spec.why || {})[field] || null });
  }

  const score = Math.round((earned / total) * 100);
  const wrong = notes.filter((n) => !n.ok);

  const feedback = wrong.length === 0
    ? `That's the right chart. ${spec.whyRight || ''}`.trim()
    : wrong.map((n) => n.why).filter(Boolean).join('\n\n')
      || 'Some of those choices would make the number harder to read than it needs to be.';

  return {
    score,
    feedback,
    notes,
    // dataViz is what this measures. Business logic gets a read only from the chart-type
    // choice, which is the one field that is genuinely about understanding the data
    // rather than presenting it.
    skills: {
      dataViz: score,
      businessLogic: notes.find((n) => n.field === 'type').ok ? 100 : 40,
    },
  };
}

// What the learner is asked to choose from. The correct answer is never sent.
function present(spec) {
  return {
    prompt: spec.prompt,
    columns: spec.columns,
    chartTypes: CHART_TYPES,
    sorts: SORTS,
    asks: fieldsFor(spec),
  };
}

module.exports = { CHART_TYPES, SORTS, grade, present, fieldsFor };
