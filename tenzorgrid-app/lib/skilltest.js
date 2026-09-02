// The entry skill test.
//
// This runs BEFORE the first project, and it exists for one reason the user was explicit
// about: the skill matrix needs a starting point. "Your SQL is 78" means nothing on its
// own; "your SQL was 52 when you joined and it's 78 now" is the sentence a learner can
// take into a salary negotiation. Without a baseline there is no delta, and without a
// delta the matrix is decoration.
//
// Everything here is authored and scored deterministically — no AI call, no per-learner
// generation. That is what keeps the whole twelve weeks at roughly $4 a head, and it is
// also what makes the score comparable between learners and across time.
//
// Design rules for a question in this bank:
//  1. Every distractor must be something a real person would actually pick. A wrong
//     answer nobody would choose measures nothing.
//  2. The question must have exactly one defensible answer. "Best practice" opinions
//     do not belong here — they punish people for a different house style.
//  3. It must be answerable in under a minute. This is a 15-minute assessment on day
//     one, not an exam.

const QUESTIONS = [
  // ---- SQL -------------------------------------------------------------------------
  {
    id: 'sql-1',
    axis: 'sql',
    prompt: 'An `employees` table has a `salary` column and an `exit_year` column that is NULL for people still employed. You need the average salary of CURRENT staff, by department. Which WHERE clause is right?',
    options: [
      { key: 'a', label: 'WHERE exit_year IS NULL' },
      { key: 'b', label: 'WHERE exit_year = NULL' },
      { key: 'c', label: 'WHERE exit_year != 0' },
      { key: 'd', label: 'No WHERE clause is needed' },
    ],
    answer: 'a',
    // b is the classic error — NULL never equals anything, so the query silently returns
    // nothing. d is the mistake that actually reaches production: the number looks fine.
    why: '`= NULL` matches no rows at all, because NULL is never equal to anything — you have to use IS NULL. Leaving the filter out entirely is worse than an error: the query runs, returns a plausible number, and quietly averages in people who left years ago.',
  },
  {
    id: 'sql-2',
    axis: 'sql',
    prompt: 'You join `employees` to `departments` and get MORE rows back than there are employees. What is the most likely cause?',
    options: [
      { key: 'a', label: 'The join condition matches multiple department rows per employee' },
      { key: 'b', label: 'You used LEFT JOIN instead of INNER JOIN' },
      { key: 'c', label: 'The employees table has duplicate primary keys' },
      { key: 'd', label: 'GROUP BY is missing' },
    ],
    answer: 'a',
    why: 'A join fans out when one row on the left matches several on the right. A LEFT JOIN can only ever add unmatched left rows back — it cannot multiply them.',
  },
  {
    id: 'sql-3',
    axis: 'sql',
    prompt: 'Which of these returns the departments where the average salary is above 900,000?',
    options: [
      { key: 'a', label: 'SELECT dept, AVG(salary) FROM e GROUP BY dept HAVING AVG(salary) > 900000' },
      { key: 'b', label: 'SELECT dept, AVG(salary) FROM e WHERE AVG(salary) > 900000 GROUP BY dept' },
      { key: 'c', label: 'SELECT dept, AVG(salary) FROM e WHERE salary > 900000 GROUP BY dept' },
      { key: 'd', label: 'SELECT dept, AVG(salary) FROM e GROUP BY dept WHERE AVG(salary) > 900000' },
    ],
    answer: 'a',
    why: 'WHERE filters rows before grouping, so it cannot see an aggregate. HAVING filters the groups after. Option c is the one that quietly returns a wrong answer rather than an error — it averages only the high earners.',
  },

  // ---- Python ----------------------------------------------------------------------
  {
    id: 'py-1',
    axis: 'python',
    prompt: 'You have `rows`, a list of dicts each with a "salary" key, and some salaries are None. What does `sum(r["salary"] for r in rows)` do?',
    options: [
      { key: 'a', label: 'Raises a TypeError' },
      { key: 'b', label: 'Skips the None values' },
      { key: 'c', label: 'Treats None as 0' },
      { key: 'd', label: 'Returns None' },
    ],
    answer: 'a',
    why: 'Python will not add None to a number — it raises immediately. That is the good case: a silent zero would have given you a wrong total with no warning.',
  },
  {
    id: 'py-2',
    axis: 'python',
    prompt: 'Which one correctly counts how many employees are in each department?',
    options: [
      { key: 'a', label: 'from collections import Counter; Counter(r["dept"] for r in rows)' },
      { key: 'b', label: 'len(set(r["dept"] for r in rows))' },
      { key: 'c', label: 'sorted(rows, key=lambda r: r["dept"])' },
      { key: 'd', label: '[r["dept"] for r in rows].count()' },
    ],
    answer: 'a',
    why: 'Counter gives you the per-department tally. Option b counts how many distinct departments exist, which is a different question people confuse with this one surprisingly often.',
  },

  // ---- Business logic --------------------------------------------------------------
  {
    id: 'biz-1',
    axis: 'businessLogic',
    prompt: 'A stakeholder asks for "the departments where people are underpaid". Before writing any query, what is the right first move?',
    options: [
      { key: 'a', label: 'Ask what they are comparing against — market rate, internal bands, or peers in the same role' },
      { key: 'b', label: 'Return the departments with the lowest average salary' },
      { key: 'c', label: 'Return everyone earning below the company median' },
      { key: 'd', label: 'Ask them to write the query specification themselves' },
    ],
    answer: 'a',
    why: '"Underpaid" is not a column. The three plausible readings give three different answers, and delivering the wrong one confidently is how analysts lose credibility. Asking is not stalling — it is the work.',
  },
  {
    id: 'biz-2',
    axis: 'businessLogic',
    prompt: 'Your analysis shows Support has the lowest average salary in the company. What does that on its own establish?',
    options: [
      { key: 'a', label: 'Very little — it could be seniority mix, market rate for the role, or a genuine pay problem' },
      { key: 'b', label: 'That Support is underpaid and needs a raise' },
      { key: 'c', label: 'That Support has the least valuable work' },
      { key: 'd', label: 'That the data is wrong, since averages should be similar' },
    ],
    answer: 'a',
    why: 'A single average is a starting question, not a finding. The most common way a good analysis gets thrown out in the meeting is overclaiming from one number.',
  },
  {
    id: 'biz-3',
    axis: 'businessLogic',
    prompt: 'Two ways of ranking outage damage — raw hours lost, and revenue at risk — put different clients at the top. What do you do?',
    options: [
      { key: 'a', label: 'Report both, and say plainly which one answers the question that was asked' },
      { key: 'b', label: 'Pick the one with the bigger headline number' },
      { key: 'c', label: 'Average the two rankings together' },
      { key: 'd', label: 'Report only revenue at risk, since money is what matters' },
    ],
    answer: 'a',
    why: 'When two defensible methods disagree, that disagreement IS the finding. Averaging rankings produces a number that means nothing at all.',
  },

  // ---- Data viz --------------------------------------------------------------------
  {
    id: 'viz-1',
    axis: 'dataViz',
    prompt: 'You are showing average salary across eight departments. Which chart?',
    options: [
      { key: 'a', label: 'A horizontal bar chart, sorted by value' },
      { key: 'b', label: 'A pie chart' },
      { key: 'c', label: 'A line chart' },
      { key: 'd', label: 'A stacked area chart' },
    ],
    answer: 'a',
    why: 'Bars compare magnitudes across categories, and sorting does half the reader\'s work. A pie is for parts of a whole — averages do not sum to anything. A line implies these categories have an order they do not have.',
  },
  {
    id: 'viz-2',
    axis: 'dataViz',
    prompt: 'A colleague\'s bar chart of salaries starts its y-axis at 800,000 instead of 0. What is the problem?',
    options: [
      { key: 'a', label: 'It visually exaggerates small differences between the bars' },
      { key: 'b', label: 'Nothing — it uses the space better' },
      { key: 'c', label: 'Bar charts cannot have a numeric y-axis' },
      { key: 'd', label: 'It hides the departments with the highest salaries' },
    ],
    answer: 'a',
    why: 'A bar\'s meaning is its length, so a truncated axis makes a 3% gap look like a 3x gap. It genuinely does use space better — which is exactly why it is a tempting mistake rather than an obvious one.',
  },

  // ---- Communication ---------------------------------------------------------------
  {
    id: 'comm-1',
    axis: 'communication',
    prompt: 'You will miss a Friday deadline. It is Wednesday and you already know. What do you do?',
    options: [
      { key: 'a', label: 'Tell your manager on Wednesday, with a reason and a new date' },
      { key: 'b', label: 'Work through the weekend and say nothing' },
      { key: 'c', label: 'Wait until Friday, in case you catch up' },
      { key: 'd', label: 'Deliver a partial answer on Friday without flagging what is missing' },
    ],
    answer: 'a',
    why: 'A deadline you flag on Wednesday is a scheduling problem. The same deadline flagged on Friday afternoon is a trust problem, and people downstream have already lost two days they could have used.',
  },
  {
    id: 'comm-2',
    axis: 'communication',
    prompt: 'You are writing the first line of an email to a business stakeholder about your salary analysis. What goes there?',
    options: [
      { key: 'a', label: 'The answer to the question they asked' },
      { key: 'b', label: 'The method you used and the tables you joined' },
      { key: 'c', label: 'The caveats and data-quality issues you found' },
      { key: 'd', label: 'A summary of how long the work took' },
    ],
    answer: 'a',
    why: 'They asked a question; lead with the answer, then support it. Method and caveats matter and belong in the email — just not in the first line, where a busy reader decides whether to keep reading.',
  },
];

const AXES = ['sql', 'python', 'dataViz', 'businessLogic', 'communication'];

// The options are authored with the correct one first, because that is how they are
// readable while writing them — and shipping them in that order would make the whole
// test answerable by clicking the top choice twelve times. A browser test did exactly
// that and scored 100.
//
// So the answer's position is rotated through the list. It is deterministic, so every
// learner sees the same arrangement and scores stay comparable; it is even, so no single
// position is worth guessing. The answer is stored as an option KEY, so reordering
// changes nothing about scoring.
function orderedOptions(q, index) {
  const out = q.options.map((o) => ({ key: o.key, label: o.label }));
  const at = out.findIndex((o) => o.key === q.answer);
  // Rotate so the answer lands at a position that cycles through the question list. A
  // random shuffle looked fair but clustered — half the answers still came out first,
  // which is well above chance for a four-option question. Rotation is provably even.
  const want = index % out.length;
  const shift = ((at - want) % out.length + out.length) % out.length;
  return out.slice(shift).concat(out.slice(0, shift));
}

// What the learner sees. The correct answer and the explanation are deliberately NOT in
// here — they are added back per question once the test is submitted.
function getQuestions() {
  return QUESTIONS.map((q, i) => ({
    id: q.id,
    axis: q.axis,
    prompt: q.prompt,
    options: orderedOptions(q, i),
  }));
}

function axisCounts() {
  const counts = {};
  for (const q of QUESTIONS) counts[q.axis] = (counts[q.axis] || 0) + 1;
  return counts;
}

// Scores an answer sheet into a per-axis 0-100 baseline.
//
// An axis with no answered questions comes back null, NOT zero — the same rule the
// grader already follows. A learner who skipped a section has not demonstrated a zero,
// they have demonstrated nothing, and marking that as zero would make their first
// "improvement" a fiction.
function score(answers) {
  const given = answers && typeof answers === 'object' ? answers : {};
  const right = {}, asked = {};
  const review = [];

  for (const q of QUESTIONS) {
    const picked = given[q.id];
    if (picked == null || picked === '') {
      review.push({ id: q.id, axis: q.axis, prompt: q.prompt, picked: null, correct: q.answer, ok: false, why: q.why, skipped: true });
      continue;
    }
    asked[q.axis] = (asked[q.axis] || 0) + 1;
    const ok = picked === q.answer;
    if (ok) right[q.axis] = (right[q.axis] || 0) + 1;
    review.push({
      id: q.id, axis: q.axis, prompt: q.prompt,
      picked, correct: q.answer, ok, why: q.why, skipped: false,
      pickedLabel: (q.options.find((o) => o.key === picked) || {}).label || null,
      correctLabel: (q.options.find((o) => o.key === q.answer) || {}).label || null,
    });
  }

  const skills = {};
  for (const axis of AXES) {
    skills[axis] = asked[axis] ? Math.round(((right[axis] || 0) / asked[axis]) * 100) : null;
  }

  const answered = Object.values(asked).reduce((a, b) => a + b, 0);
  const correct = Object.values(right).reduce((a, b) => a + b, 0);

  return {
    skills,
    answered,
    correct,
    total: QUESTIONS.length,
    overall: answered ? Math.round((correct / answered) * 100) : null,
    review,
  };
}

module.exports = { QUESTIONS, AXES, getQuestions, axisCounts, score };
