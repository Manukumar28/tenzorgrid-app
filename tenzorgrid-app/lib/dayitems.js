// The rest of a working day: activities, situations, and the Friday quiz.
//
// A day is six tasks, two activities and two situations — and on the last day, one quiz.
// Tasks are the project. These three are everything else a person does between nine and
// six, and they are what stops the product being a worksheet.
//
// The important design rule, which is easy to get wrong: ACTIVITIES AND SITUATIONS ARRIVE.
// They are not a list the learner works down. An activity is Asha sending you a module to
// read; a situation is Vikram adding to the brief on Wednesday afternoon. Both land in the
// inbox or the chat dock while you are in the middle of something else, which is the whole
// point — the interruption IS the skill being practised.
//
// Content lives here rather than in the database for the same reason tasks do: it has to be
// deterministic and reviewable in a diff. Only what a specific learner did gets stored.

// ---- Activities ---------------------------------------------------------------------
//
// `check` is how the activity is closed off:
//   acknowledge  — read it and say so. Genuinely just attendance; not everything is graded.
//   answer       — write a few lines. Marked against rubric markers, lightly.
//   choice       — pick from options. The module's comprehension check.
//
// `via` decides where it lands. Email for anything with a subject line and a sender who
// would write one; chat for the things a colleague would just say to you.

const ACTIVITIES = {
  'headcount-trends': [
    {
      key: 'ha-01', day: 1, type: 'learning', via: 'email', from: 'people_partner', minutes: 10,
      subject: 'Intake vs headcount — the distinction this project turns on',
      title: 'Read: why hiring questions are not headcount questions',
      body: `Neha here. Before you start on the plan, five minutes on the one distinction that decides whether this analysis is right.

HEADCOUNT is who is here today. INTAKE is who we took on in a given year. They are different populations and they answer different questions.

Somebody hired in 2019 who left in 2022 was still a 2019 hire. They took a hiring slot, they cost a salary, and they are part of what 2019 looked like. If you filter them out of the hiring series because they are not here now, every year before last gets quietly understated — and the further back you go, the worse it gets.

So for most of this week, do NOT filter on exit_year. The exceptions are the questions that genuinely are about today: who is in each team now, where they sit. Those are headcount questions and the filter belongs on them.

Getting this backwards is the single most common way this analysis goes wrong.`,
      check: {
        kind: 'choice',
        prompt: 'Which of these needs the current-staff filter?',
        options: [
          { key: 'now', correct: true, label: 'How many people are in Engineering today' },
          { key: 'series', correct: false, label: 'How many people we hired in 2019' },
          { key: 'cost', correct: false, label: 'What the 2020 intake cost us in salary' },
          { key: 'trend', correct: false, label: 'Whether hiring has gone up or down since 2016' },
        ],
        why: 'Only the first is a question about today. The other three are about intake, and filtering out leavers would understate every historical year.',
      },
    },
    {
      key: 'ha-02', day: 1, type: 'policy', via: 'email', from: 'security', minutes: 6,
      subject: 'Read and confirm: planning data and what may circulate',
      title: 'Read and confirm: what goes in a planning pack',
      body: `Standard note for anyone working on workforce planning, and it matters this month because the pack goes to the budget round.

Two rules:

One. Headcount and hiring numbers at department level are fine to circulate. Individual salaries, names, or any cut small enough to identify a person are not — and a department with two people in it is a cut small enough to identify a person.

Two. Nothing leaves company systems. Not to a personal drive, not to personal email, not to an external sharing link. If somebody outside needs a figure, it goes through your manager.

Confirm you have read this.`,
      check: { kind: 'acknowledge', label: 'I have read and understood' },
    },
    {
      key: 'ha-03', day: 2, type: 'learning', via: 'chat', from: 'data_engineer', minutes: 8,
      title: 'Rahul on HAVING, and why WHERE will not do it',
      body: `Saw you are on the hiring counts — one thing that catches people, since you will want it today.

WHERE filters rows BEFORE they are grouped. HAVING filters the groups AFTER. So if you want "only years with at least five hires", WHERE cannot help you: at the point WHERE runs, there is no COUNT yet, just individual employee rows.

  GROUP BY hire_year HAVING COUNT(*) >= 5

That is it. The error message if you try it in WHERE is unhelpful — "misuse of aggregate" — so it is worth knowing the rule rather than decoding the message.`,
      check: {
        kind: 'choice',
        prompt: 'You want departments whose average salary is above 15 lakh. Where does that condition go?',
        options: [
          { key: 'having', correct: true, label: 'HAVING AVG(salary) > 1500000' },
          { key: 'where', correct: false, label: 'WHERE AVG(salary) > 1500000' },
          { key: 'both', correct: false, label: 'WHERE salary > 1500000, then GROUP BY' },
          { key: 'order', correct: false, label: 'ORDER BY AVG(salary) > 1500000' },
        ],
        why: 'It is a condition on an aggregate, so it can only be evaluated once the groups exist. WHERE salary > 1500000 is a different question entirely — it throws away individual people before averaging, which inflates every department.',
      },
    },
    {
      key: 'ha-04', day: 2, type: 'judgement', via: 'email', from: 'finance_analyst', minutes: 10,
      subject: 'Small samples — the thing that will bite you this week',
      title: 'Read: what a small denominator does to an average',
      body: `Diya here. You are about to compute average salary per intake year, so a warning about the shape of our data.

Two of those years have almost nobody in them. When you average over two people, the result is not a statistic about hiring — it is two salaries with a division sign between them. Move either person and the whole "trend" moves.

The dangerous part is that it looks identical to a real finding. A table of ten years with one strikingly low number in it invites exactly one sentence: "our most efficient hiring year". That sentence will get repeated in a budget meeting, and it will not survive the first person who asks how many people it is based on.

The fix is not complicated. Put the count next to every average you publish. A reader who can see n = 2 will draw their own conclusion, and it will be the right one.`,
      check: {
        kind: 'answer',
        prompt: 'In two or three sentences: what would you do with the 2022 average, and why?',
        maxWords: 90,
        markers: ['two|2 people|small|count|sample|n =|headcount', 'caveat|alongside|beside|footnote|exclude|omit|with the count|show'],
        why: 'Either report it with the count visible or leave it out and say you have — both are honest. Quoting the average on its own is the only option that is not.',
      },
    },
    {
      key: 'ha-05', day: 3, type: 'learning', via: 'chat', from: 'people_partner', minutes: 7,
      title: 'Neha on what six data points can and cannot carry',
      body: `Before you send me the attrition split — a thing I have learned the hard way in People Ops.

We have had six leavers. Six. Split those across six departments and you get a table that looks like analysis and is actually arithmetic on almost nothing. One more departure anywhere reorders it completely.

I will still ask you for the split, because that is what the plan template has on it. What I need from you is the push-back, with the reason attached. "Not enough data" on its own I will argue with. "Six leavers, and one more anywhere changes the ranking" I cannot argue with.

Say the second one.`,
      check: {
        kind: 'choice',
        prompt: 'What makes a small-sample objection land with a stakeholder?',
        options: [
          { key: 'specific', correct: true, label: 'Naming the number, and what would change if it moved by one' },
          { key: 'vague', correct: false, label: 'Saying the sample is not statistically significant' },
          { key: 'refuse', correct: false, label: 'Declining to produce the table at all' },
          { key: 'pct', correct: false, label: 'Converting to percentages so the scale is clearer' },
        ],
        why: 'Specifics are arguable with; generalities are not, which sounds like an advantage and is the opposite — an unarguable objection gets ignored. Percentages on a denominator of ten hide the sample rather than exposing it.',
      },
    },
    {
      key: 'ha-06', day: 3, type: 'policy', via: 'chat', from: 'line_manager', minutes: 5,
      title: 'Asha: how to say no to a reasonable request',
      body: `You are about to tell Neha she cannot have something she has asked for politely and for good reasons. A shape that works:

One, lead with what you DO have. A note that opens with a refusal gets read as obstruction no matter how well the rest is argued.

Two, the reason, with a number in it.

Three, the nearest thing you can actually give her.

Four, what would let you answer it properly later.

The bit people skip is the third one. Without it you have given her a problem; with it you have given her a decision.`,
      check: { kind: 'acknowledge', label: 'Got it' },
    },
    {
      key: 'ha-07', day: 4, type: 'learning', via: 'email', from: 'comms', minutes: 9,
      subject: 'Ordered or not — the only chart question that matters',
      title: 'Read: when to sort a chart, and when sorting destroys it',
      body: `Meera here. You have three charts in this pack and they are not the same kind of thing, which trips people up.

Years are a SEQUENCE. They have an order that exists whether you like it or not, and that order is usually the finding. Never sort a time series by value — you would be destroying the only thing the chart is there to show.

Departments are CATEGORIES. Nothing orders them, so you get to choose, and choosing size means the reader can rank them at a glance instead of hunting. Sorting here does the reader's work for them.

Same data, opposite advice. The skill is knowing which case you are in before you reach for the sort control.`,
      check: {
        kind: 'choice',
        prompt: 'You are charting average salary by location. Sort or not?',
        options: [
          { key: 'sort', correct: true, label: 'Sort by value — locations have no inherent order' },
          { key: 'alpha', correct: false, label: 'Alphabetically, so it is easy to find a specific city' },
          { key: 'none', correct: false, label: 'Leave it in whatever order the query returned' },
          { key: 'never', correct: false, label: 'Never sort — it misleads the reader' },
        ],
        why: 'Cities are categories, so sorting by value is the reader-friendly choice. Alphabetical is defensible in a lookup table and poor in a chart; query order is arbitrary and therefore meaningless.',
      },
    },
    {
      key: 'ha-08', day: 4, type: 'judgement', via: 'chat', from: 'finance_analyst', minutes: 6,
      title: 'Diya on two numbers that disagree',
      body: `We are going to end up with different headcounts, so let us agree how to handle it now rather than in front of the budget round.

Neither of us is going to be wrong. I count people we pay; you are counting people we hired. Those genuinely differ, and the difference is exactly the leavers.

The fix is not to pick a winner. It is to put the population on the label. "Hires since 2016: 69" and "Current headcount: 63" can sit on the same slide all day. Two unlabelled numbers in the sixties cannot, and the meeting will be about the gap instead of the plan.`,
      check: {
        kind: 'answer',
        prompt: 'Write the one line you would say to Finance when your headcount does not match theirs. Under 40 words.',
        maxWords: 40,
        markers: ['both|different question|population|label|mine counts|yours counts|intake|current'],
        why: 'Concede immediately that both are right, name the populations, and move on. The analyst who tries to win this exchange loses either the argument or the relationship.',
      },
    },
    {
      key: 'ha-09', day: 5, type: 'learning', via: 'chat', from: 'data_engineer', minutes: 8,
      title: 'Rahul: the median, and why SQLite will not give you one',
      body: `For the tenure number — SQLite has no median function. No MEDIAN(), no PERCENTILE(). You will not find it, so do not spend twenty minutes looking.

Two options. Do it in the notebook: pull the values, sort them, take the middle one, and handle the even-length case by averaging the two in the middle. Or do it in SQL with a window function and a row count, which works and which nobody reading it in April will thank you for.

Use Python. It is four lines and it is obvious.

And the reason it matters here: you have six tenures. An average over six values with two outliers in it is a number that describes none of the six people.`,
      check: {
        kind: 'choice',
        prompt: 'Six leavers stayed 1, 1, 1, 1, 4 and 4 years. What is the median?',
        options: [
          { key: 'one', correct: true, label: '1 year' },
          { key: 'two', correct: false, label: '2 years' },
          { key: 'twohalf', correct: false, label: '2.5 years' },
          { key: 'four', correct: false, label: '4 years' },
        ],
        why: 'Sorted, the two middle values are the third and fourth: 1 and 1. Their average is 1. The mean is 2 — a figure no leaver was anywhere near, which is exactly why the median is the honest one to report.',
      },
    },
    {
      key: 'ha-10', day: 5, type: 'judgement', via: 'email', from: 'line_manager', minutes: 8,
      subject: 'Before you send the plan',
      title: 'Read: giving a number when you would rather give a range',
      body: `Last thing before this goes out, and it is the hardest habit to build.

At some point someone with twenty minutes in a budget meeting will ask you for one number. Your instinct will be to give them the range, the caveats and the reasoning, because that is what is true.

That instinct is right up until the moment they have told you they have read the caveats. After that, continuing to withhold a number is not rigour — it is leaving them to invent one, and the number they invent will have no analysis behind it at all.

If you can defend a figure, give it. Put the assumption in the same sentence if you need to. "Seven, if you mean holding steady" is a single number and a caveat in six words.

The judgement is not "never commit". It is "commit to what you can defend, and be exact about what you are assuming".`,
      check: {
        kind: 'answer',
        prompt: 'Neha has read your caveats and wants one number. Write the sentence you send. Under 40 words.',
        maxWords: 40,
        markers: ['seven|7|six|eight', 'steady|replace|attrition|grow|assum|if you|hold'],
        why: 'A number plus the assumption it rests on, in one line. Either half alone fails her: the number without the assumption gets misused, the assumption without the number gets ignored.',
      },
    },
  ],
  'compensation-review': [
    {
      key: 'ca-01', day: 1, type: 'learning', via: 'email', from: 'line_manager', minutes: 12,
      subject: 'Before you start — how our HR tables fit together',
      title: 'Read: the HR schema, and the one column that catches everyone',
      body: `Welcome again. Before you open the workbench, five minutes on how our people data is laid out.

Two tables matter this week. employees holds one row per person — salary, role, hire_year, and exit_year. departments holds one row per function, with the pay band we agreed for it: band_low and band_high.

The column that catches everyone is exit_year. It is NULL for anyone still here. Not zero, not blank — NULL. And NULL does not equal anything in SQL, including itself, so "WHERE exit_year = NULL" returns nothing at all and tells you nothing is wrong. Use IS NULL.

You will use that this week. Most compensation questions are about people we currently employ.`,
      check: {
        kind: 'choice',
        prompt: 'You want only people who still work here. Which is right?',
        options: [
          { key: 'isnull', label: 'WHERE exit_year IS NULL', correct: true },
          { key: 'eqnull', label: 'WHERE exit_year = NULL', correct: false },
          { key: 'zero', label: 'WHERE exit_year = 0', correct: false },
          { key: 'notnull', label: 'WHERE exit_year IS NOT NULL', correct: false },
        ],
        why: 'NULL never equals anything, so `= NULL` matches no rows and fails silently. IS NULL is the only form that works — and IS NOT NULL would give you exactly the people who have left.',
      },
    },
    {
      key: 'ca-02', day: 1, type: 'policy', via: 'email', from: 'people_partner', minutes: 8,
      subject: 'Data handling — please read and confirm',
      title: 'Read and confirm: what you may and may not circulate',
      body: `Standard note for anyone joining Data & Analytics, and it matters more this week than most because you are working on pay.

Three rules:

One. Aggregate freely, identify never. Average salary by department is a normal request. A list of what named individuals earn is not, no matter who asks.

Two. Small groups are identifying. A department with three people in it does not become anonymous because you took an average — anyone who knows two of the salaries can work out the third. If a group is under five, say so rather than publishing it.

Three. If you are unsure whether something can be shared, ask before sending, not after.

Confirm you have read this.`,
      check: { kind: 'acknowledge', label: 'I have read and understood' },
    },
    {
      key: 'ca-03', day: 2, type: 'drill', via: 'chat', from: 'data_engineer', minutes: 5,
      title: 'Three-minute drill: join the two tables',
      body: `Quick one while you have the schema open — worth doing before you need it under time pressure.

Which join gives you every current employee WITH their department name attached, and drops nobody?`,
      check: {
        kind: 'choice',
        prompt: 'Pick the one that keeps every employee and adds the department name.',
        options: [
          { key: 'inner', label: 'employees e JOIN departments d ON d.id = e.department_id', correct: true },
          { key: 'cross', label: 'employees e, departments d', correct: false },
          { key: 'wrongkey', label: 'employees e JOIN departments d ON d.id = e.id', correct: false },
          { key: 'right', label: 'departments d RIGHT JOIN employees e ON d.id = e.id', correct: false },
        ],
        why: 'Every employee has a department_id, so an inner join on that key loses nobody. Joining on e.id would match an employee to a department by coincidence of numbering — a bug that produces plausible-looking nonsense.',
      },
    },
    {
      key: 'ca-04', day: 2, type: 'shadow', via: 'email', from: 'data_engineer', minutes: 10,
      subject: 'FYI — my validation notes on the HR extract',
      title: 'Read how Rahul checked the data before handing it over',
      body: `Sending you what I did before this landed with you, partly so you know what has already been ruled out and partly because it is worth knowing how to check an extract.

Four things I looked at:

Row count against the source system — matched, 69 rows.
Salary range — nothing negative, nothing absurd at either end.
exit_year — 6 populated, 63 NULL. That reconciles with the headcount People Ops gave me.
department_id — every row has one, all of them exist in departments. No orphans.

The thing to watch is not an error, it is the sizes. Finance is 7 current people. Marketing and People Ops are 9 each. Those are small enough that one person joining or leaving moves the average visibly, and small enough that a department average starts to identify individuals if you slice it any further.`,
      check: {
        kind: 'answer',
        prompt: 'Rahul says the extract is clean. What is he actually warning you about, and what will you do?',
        maxWords: 80,
        markers: ['small|seven|7|nine|9|size|few people|headcount|finance|marketing', 'count|alongside|report|caveat|note|flag|show'],
        why: 'Nothing is wrong with the data — he is warning you about group SIZE. Finance is seven people. An average over seven moves visibly when one person joins, and slicing it further starts identifying individuals. Carrying the count next to every average is the answer.',
      },
    },
    {
      key: 'ca-05', day: 3, type: 'peer-help', via: 'chat', from: 'support_lead', minutes: 8,
      title: 'Sneha is stuck and has asked you',
      body: `Hey — you are the analyst on the comp review, so you will know this faster than me.

I am pulling ticket volumes by team and I want an average per team. But some teams have no tickets at all this month, and they are just vanishing from my results instead of showing as zero. I am using a normal JOIN.

What am I doing wrong?`,
      check: {
        kind: 'answer',
        prompt: 'Answer Sneha. Help her see it — do not just hand her the query.',
        maxWords: 90,
        markers: ['left join|outer join', 'zero|no tickets|no rows|nothing to match'],
        why: 'An inner join drops teams with nothing to match. A LEFT JOIN keeps them and gives NULL, which she can turn into zero. Helping someone see WHY their rows vanished is worth more than pasting a query at them — and is the difference between a colleague people come back to and one they stop asking.',
      },
    },
    {
      key: 'ca-06', day: 3, type: 'tool-tip', via: 'chat', from: 'data_engineer', minutes: 5,
      title: 'Rahul shares something worth stealing',
      body: `Trick I use constantly and nobody teaches: before you trust any GROUP BY, run it with COUNT(*) next to whatever you are aggregating.

SELECT department, COUNT(*), AVG(salary) FROM ... GROUP BY department

The count tells you whether the average means anything. An average over three people and an average over two hundred look identical in a results grid, and one of them is worth acting on.

Try it on your compensation query before you send anything to Vikram.`,
      check: { kind: 'acknowledge', label: 'Tried it — I see what he means' },
    },
    {
      key: 'ca-07', day: 4, type: 'document', via: 'email', from: 'line_manager', minutes: 15,
      subject: 'Write up your method while it is fresh',
      title: 'Document what you did, for whoever picks this up next',
      body: `Before Friday, write up how you got your numbers. Not the findings — the method.

The test is simple: could someone repeat your analysis next quarter and land on the same figures without asking you a single question? That means saying which rows you included, which you excluded and why, and anything you decided along the way that a reasonable person might have decided differently.

It takes fifteen minutes now and saves someone a day in April.`,
      check: {
        kind: 'answer',
        prompt: 'Write the method note. What did you include, what did you exclude, and what did you decide?',
        maxWords: 150,
        markers: ['current|exit_year|still (here|employed)|leaver', 'exclud|filter|left out|removed', 'depart|group'],
        why: 'A method note has to name the population (current staff, leavers excluded), what was filtered out and why, and how the figures were grouped. Anything less and the next person is guessing.',
      },
    },
    {
      key: 'ca-08', day: 4, type: 'feedback', via: 'chat', from: 'comms', minutes: 10,
      title: 'Meera wants a second pair of eyes on her summary',
      body: `Draft of the leadership summary — can you sanity-check the numbers bit before it goes out?

"Engineering is our highest-paid function, earning 23.9L on average. Support, at 14.1L, is significantly underpaid and we should correct this in the next cycle."

Anything you would change?`,
      check: {
        kind: 'answer',
        prompt: 'Reply to Meera. Be useful, not pedantic.',
        maxWords: 100,
        markers: ['underpaid|below market|benchmark|no (market|external) data|cannot say|band'],
        why: '"Underpaid" is a comparison against something we have not measured — there is no market data anywhere in this dataset. The figures are fine; the word is the problem, and it is the kind of word that gets an analysis thrown out in the room.',
      },
    },
    {
      key: 'ca-09', day: 5, type: 'ritual', via: 'chat', from: 'line_manager', minutes: 10,
      title: 'Friday retro — five minutes on how the week went',
      body: `Last thing before we close this out. Short retro, same three questions I ask everyone.

What went well, what did not, and what would you do differently if you ran this week again?

Honest answers are more useful to me than tidy ones. I am not marking you on this.`,
      check: {
        kind: 'answer',
        prompt: 'What went well, what did not, and what would you change?',
        maxWords: 120,
        markers: ['\\w{40,}|went well|difficult|hard|next time|differently|slower|faster'],
        why: 'Retros only work when they are specific. "It went fine" tells your manager nothing and tells you less.',
      },
    },
    {
      key: 'ca-10', day: 5, type: 'reflection', via: 'chat', from: 'line_manager', minutes: 8,
      title: 'One thing you now know that you did not on Monday',
      body: `Last one, and it is for you more than for me.

Name one specific thing you can do now that you could not on Monday morning. Not "I learned SQL" — something you could describe to someone in a sentence.

The people who get good at this are the ones who can say what changed.`,
      check: {
        kind: 'answer',
        prompt: 'One specific thing you can do now that you could not on Monday.',
        maxWords: 80,
        markers: ['\\w{30,}'],
        why: 'Naming the specific thing is what turns a week of work into something you can say out loud in an interview.',
      },
    },
  ],
};

// ---- Situations ---------------------------------------------------------------------
//
// Two a day, unannounced. `needsReply: false` on some of them is not padding — it is the
// whole mechanism. If everything in the inbox deserves an answer then triage is not a
// decision and the learner simply answers everything, which is the habit we would be
// training. `ifIgnored` is what happens when they leave it: silence has to cost something
// for the choice to be real, and has to cost nothing for the noise.

const SITUATIONS = {
  'headcount-trends': [
    {
      key: 'hs-01', day: 1, type: 'question', via: 'email', from: 'people_partner',
      subject: 'One thing I should have said in the brief',
      body: `Forgot to mention — the budget round wants the plan in the same format as last year, which has a single hiring number at the top and the reasoning underneath.

So whatever else you produce, I need to end up with one figure I can put in that box. Not asking for it now. Just flagging it so it is not a surprise on Friday.

Does that change how you would approach the week?`,
      needsReply: true,
      expect: ['acknowledge the constraint', 'say what it changes, or that it does not'],
      markers: ['yes|no|understood|noted|fine|does not change|helps|will|plan|number|friday'],
      ifIgnored: 'Neha assumes you have not read it and re-sends it on Thursday, by which point the framing would have been useful two days earlier.',
      note: 'Knowing the shape of the deliverable on Monday changes what you collect all week. This is the cheapest question you will be asked.',
    },
    {
      key: 'hs-02', day: 1, type: 'noise', via: 'email', from: 'facilities',
      subject: 'Automated: meeting room 4B is now bookable again',
      body: `Room 4B is back in service following the AV replacement.

This notice is sent to all staff with a booking history in the last quarter. No action required and no reply needed.`,
      expect: ['archive it'],
      note: 'An automated notice with "no reply needed" in it is the easiest triage decision you will get. Take the free win.',
    },
    {
      key: 'hs-03', day: 2, type: 'scope', via: 'email', from: 'stakeholder',
      subject: 'Can you add contractors to this?',
      body: `Vikram here — I know this is Neha's piece but I have an interest.

Can the hiring numbers include contractors as well as permanent staff? We have spent a lot on contract engineering over the last two years and if the plan ignores it we will end up making the same decision twice.

Reasonable ask?`,
      needsReply: true,
      expect: ['check whether the data holds contractors before answering', 'say what you actually have'],
      markers: ['employee|table|data|do not have|don.t have|no contractor|only permanent|check|not in|dataset'],
      ifIgnored: 'Vikram assumes contractors are in the numbers and says so in the budget round. The correction lands on you, in the room.',
      note: 'The employees table holds permanent staff only. The answer is not "no" — it is "not in this data, and here is what it would take", which is a different conversation.',
    },
    {
      key: 'hs-04', day: 2, type: 'noise', via: 'chat', from: 'engineering_manager',
      body: `Anyone else getting the warehouse timeout on big GROUP BYs this morning? Platform say it is the index rebuild, should clear by lunch. Not asking for anything, just so nobody spends an hour debugging their own query.`,
      expect: ['nothing — it is a broadcast'],
      note: 'Somebody saving you an hour is not somebody asking you for one. A thumbs-up at most.',
    },
    {
      key: 'hs-05', day: 3, type: 'pressure', via: 'chat', from: 'people_partner',
      body: `Any luck with the attrition split by department? I have the retention section of the plan open in front of me and it is the only bit I cannot fill in. Even a rough version would let me move on.`,
      needsReply: true,
      expect: ['say no clearly', 'give the number of leavers', 'offer what you can give instead'],
      markers: ['six|6 |too few|small|cannot|can.t|not enough', 'tenure|company|overall|instead|but I can|what I can'],
      ifIgnored: 'Neha fills the retention section with the raw two-two-two table and builds a plan on it. Correcting that on Friday is much more expensive than answering now.',
      note: '"Even a rough version" is the moment the wrong number enters the document. Rough is fine when the sample is large; it is not what is wrong here.',
    },
    {
      key: 'hs-06', day: 3, type: 'noise', via: 'chat', from: 'comms',
      body: `Fyi the planning pack template has moved to the new drive. Same link as the all-hands deck. Nothing needed from you, just so you do not go looking in the old place on Friday afternoon.`,
      expect: ['archive it'],
      note: 'Useful, and needs nothing. Both of those can be true at once.',
    },
    {
      key: 'hs-07', day: 4, type: 'question', via: 'email', from: 'finance_analyst',
      subject: 'Which headcount are you using?',
      body: `I am putting the cost lines together and I want to make sure we are not about to contradict each other.

My baseline is people we currently pay. If your number is bigger than mine, I would like to know why before Friday rather than during it.

What is yours, and what is in it?`,
      needsReply: true,
      expect: ['give your number and say what population it covers', 'name the gap as the leavers'],
      markers: ['69|sixty-nine|ever hired|intake|all hires', 'leaver|left|six|difference|gap|both|current'],
      ifIgnored: 'Nobody reconciles. On Friday the meeting is about whose spreadsheet is wrong rather than about the hiring plan.',
      note: 'Two numbers that should match and do not is the most common way an analysis dies in public. Ten minutes on Thursday prevents it.',
    },
    {
      key: 'hs-08', day: 4, type: 'pressure', via: 'email', from: 'engineering_manager',
      subject: 'Engineering headcount for next year',
      body: `I hear you are doing the hiring plan. Engineering is the biggest team and we have hired almost nobody for two years while People Ops has grown steadily.

I am not asking you to argue my case. I am asking whether your numbers show what I think they show, because if they do I would rather raise it myself with the right figure attached than guess.`,
      needsReply: true,
      expect: ['answer what the data shows', 'do not take a side in his budget case'],
      markers: ['engineering|people ops|recent|2023|since|four|seven|hire', 'data|shows|number|figure|not|cannot|argue|decision'],
      ifIgnored: 'Arjun raises it with a number he estimated himself. If it is wrong, the error is traced to the analyst who did not answer.',
      note: 'Giving someone the correct figure is not taking their side. Refusing to, because the figure helps them, is taking the other one.',
    },
    {
      key: 'hs-09', day: 5, type: 'pressure', via: 'email', from: 'people_partner',
      subject: 'In the room in an hour',
      body: `I am in the budget round at eleven and I still do not have the top-line number.

I have read everything you have sent me and I understand the caveats. I am not asking you to pretend they do not exist. I am asking what to say when they ask how many people we are hiring.`,
      needsReply: true,
      expect: ['give a number', 'name the assumption it rests on'],
      markers: ['seven|7|six|eight', 'steady|replace|attrition|grow|assum|if|hold|net'],
      ifIgnored: 'Neha goes in without a figure and picks one on the spot. Whatever she says becomes the plan, and it has no analysis behind it.',
      note: 'The caveats were the work. Withholding the number after she has read them is not rigour — it is making her invent one.',
    },
    {
      key: 'hs-10', day: 5, type: 'noise', via: 'email', from: 'broadcast',
      subject: 'Budget round timetable — all sessions',
      body: `The full budget round timetable for the next fortnight is attached, covering every function.

Circulated to all staff for visibility. Your own session will be booked by your cost centre owner. No action required.`,
      expect: ['archive it'],
      note: 'A timetable for twenty meetings you are not in. The temptation to read it carefully is the thing being tested.',
    },
  ],
  'compensation-review': [
    {
      key: 'cs-01', day: 1, type: 'invite', via: 'email', from: 'stakeholder',
      subject: 'Kickoff — 20 mins, this afternoon?',
      body: `Hi — Vikram here, I am the one who asked for this piece of work.

Wanted to grab twenty minutes to walk you through what is behind the request, since a brief never quite captures it. Rough version: the board asked me a question in the last meeting that I could not answer, and I would rather not be in that position again in April.

Are you free at four? If not, tell me when suits.`,
      needsReply: true,
      expect: ['accept or decline clearly', 'a time, or a reason'],
      markers: ['four|4|yes|works|can do|afternoon|instead|sorry|unfortunately|tomorrow|morning'],
      ifIgnored: 'Vikram takes the silence as a no and briefs you by email instead — thinner than the conversation would have been.',
    },
    {
      key: 'cs-02', day: 1, type: 'noise', via: 'email', from: 'people_partner',
      subject: 'Reminder: timesheets close Friday 5pm',
      body: `Automated reminder for everyone in Data & Analytics.

Timesheets for this week close at 5pm Friday. If yours is already submitted you can ignore this.

Do not reply to this address.`,
      needsReply: false,
      ifIgnored: 'Nothing. It said not to reply.',
    },
    {
      key: 'cs-03', day: 2, type: 'scope-creep', via: 'email', from: 'stakeholder',
      subject: 'One more thing on the comp review',
      body: `Thanks for the call yesterday, that was useful.

One addition, and I appreciate it is late: could you also split this by region? I realised on the way home that a national average is going to get picked apart in the room, because Bangalore and Pune are not the same market.

Understand if this pushes the timeline. Let me know either way.`,
      needsReply: true,
      expect: ['that it is technically possible', 'why you should not publish it anyway', 'what you can give him instead'],
      markers: ['location|region|city|split', 'small|few|under five|identif|privacy|policy|one person|two people|cannot publish|should not'],
      ifIgnored: 'Vikram assumes it is in hand and tells the board a regional breakdown is coming.',
      note: 'There IS a location column, so this is not a "we cannot do that" — it is worse. Splitting six departments across five locations gives 26 groups, and 25 of them have fewer than five people in them. Several have one. The data-handling note you read on Monday says a group under five is identifying, and it is right: publishing "the average Marketing salary in Hyderabad" where Marketing in Hyderabad is two people publishes two salaries. Saying yes here is the easiest mistake in the week to make.',
    },
    {
      key: 'cs-04', day: 2, type: 'forward', via: 'email', from: 'people_partner',
      subject: 'Fwd: Band review outcome — for your awareness',
      body: `Forwarding this because it touches what you are working on.

The band review completed last month, which means the band_low and band_high figures in the departments table are current as of March. Anything you read about position-in-band is against the NEW bands, not the ones people were hired into.

Worth a footnote if you are presenting it. No action needed from you.`,
      needsReply: false,
      ifIgnored: 'Nothing immediately — but if you present band position without the footnote, someone in the room will know the bands moved.',
    },
    {
      key: 'cs-05', day: 3, type: 'challenge', via: 'chat', from: 'finance_analyst',
      subject: null,
      body: `Sorry to barge in — Diya from Finance.

I have got a figure for Engineering average salary and it does not match yours. Mine is about 1.8 lakh lower.

I am including everyone who was employed at any point this financial year, because that is what the cost actually was. I think you might be looking at current staff only?

Neither of us is wrong exactly, but we cannot both present at the same meeting.`,
      needsReply: true,
      expect: ['acknowledge both are defensible', 'name the actual difference', 'propose one for the meeting'],
      markers: ['current|still here|leaver|left|exit', 'cost|spend|question|asked|depends|purpose|both'],
      ifIgnored: 'Diya presents her number. Yours is on the slide behind it. The room notices.',
    },
    {
      key: 'cs-06', day: 3, type: 'blocked', via: 'chat', from: 'data_engineer',
      subject: null,
      body: `Heads up — the refresh I was going to run tonight is blocked, the source system is down for maintenance until tomorrow.

Your tables are fine, they are from Monday's pull. Nothing you have done needs redoing. But if you were waiting on fresher numbers for anything, they are not coming today.

Shout if that breaks something.`,
      needsReply: false,
      ifIgnored: 'Nothing — Rahul told you precisely so you would not waste time waiting.',
    },
    {
      key: 'cs-07', day: 4, type: 'side-request', via: 'email', from: 'finance_analyst',
      subject: 'Quick one — need a number by 3pm',
      body: `I know this is not your project and I am sorry.

I need total current headcount, broken down by department, for a budget pack that goes out at three. It is one query for you and it would take me half a day to work out where the data lives.

If you cannot, say so and I will find another way — I would rather know now.`,
      needsReply: true,
      expect: ['a clear yes or no', 'if yes, when'],
      markers: ['yes|sure|can do|send|before|three|3pm|no|cannot|can\'t|sorry|after|tomorrow|busy'],
      ifIgnored: 'Diya waits until 3pm, then escalates to Asha asking whether you are overloaded. Asha asks you about it.',
    },
    {
      key: 'cs-08', day: 4, type: 'status-chase', via: 'chat', from: 'line_manager',
      subject: null,
      body: `Where are we on the comp review? Vikram just asked me in the corridor and I did not have a good answer.

Short version is fine — what is done, what is left, anything you are worried about.`,
      needsReply: true,
      expect: ['what is done', 'what is left', 'any risk, named'],
      markers: ['done|finished|complete', 'left|remaining|still|tomorrow|friday'],
      ifIgnored: 'Asha answers Vikram with a guess. It is optimistic, and now you have to meet it.',
    },
    {
      key: 'cs-09', day: 5, type: 'bad-news', via: 'email', from: 'finance_analyst',
      subject: 'Before this goes out — how many people is the Marketing number?',
      body: `Saw the draft. One question before it lands with the board.

You have Marketing lowest in band at 37%, with Support at 47%. That is the headline and it is the bit people will act on.

How many people is the Marketing figure built from? Because if it is a handful, the gap between 37 and 47 could be two or three individual salaries rather than anything structural — and the board will absolutely ask, because someone there will know how big that team is.

Not saying you are wrong. Saying be ready.`,
      needsReply: true,
      expect: ['the actual headcount', 'what that does to how firmly you can put it'],
      markers: ['nine|9|ten|10|small|few', 'caveat|careful|note|count|alongside|not structural|individual|cannot say|firmly|hedge|show the'],
      ifIgnored: 'The number goes to the board without its headcount. Someone asks in the room, and the answer comes from Finance instead of from you.',
    },
    {
      key: 'cs-10', day: 5, type: 'noise', via: 'email', from: 'people_partner',
      subject: 'TenzorGrid Weekly — new joiners, office notices, Friday lunch',
      body: `This week at TenzorGrid.

Four new joiners across Engineering and Support — say hello if you see them on the fourth floor.

The lift on the B side is out until Wednesday. Stairs or the A-side lift.

Friday lunch is moved to 1pm because of the all-hands.

Nominations for the quarterly shout-outs close next Friday.`,
      needsReply: false,
      ifIgnored: 'Nothing. It is a newsletter.',
    },
  ],
};

// ---- The Friday quiz -----------------------------------------------------------------
//
// One per project, ten questions, sat on the last day AFTER the work is delivered. It
// checks what the week taught rather than what was memorised on Monday, which is why it
// sits at the end rather than the beginning.
//
// Wrong options have to be plausible. An obviously silly distractor teaches nothing and
// makes the right answer findable without knowing anything.

const QUIZZES = {
  'headcount-trends': {
    key: 'hq-head', title: 'Headcount & Hiring Trends — end of project',
    intro: 'Ten questions on the week. Not a pass or fail — it tells both of us what stuck.',
    questions: [
      {
        id: 'q1', topic: 'business-sense',
        q: 'You are asked how many people we hired in 2019. Should you filter out people who have since left?',
        options: [
          { key: 'b', label: 'No — they were still a 2019 hire', correct: true },
          { key: 'a', label: 'Yes — we only count people who are still here' },
          { key: 'c', label: 'Only if they left within a year' },
          { key: 'd', label: 'Yes, and note the exclusion in a footnote' },
        ],
        why: 'Intake and headcount are different populations. Filtering leavers out of a historical hiring series understates every year, and the further back you go the worse it gets — which makes hiring look like it grew when it did not.',
      },
      {
        id: 'q2', topic: 'sql',
        q: 'You want only the hire years with at least five hires. Where does that condition go?',
        options: [
          { key: 'c', label: 'HAVING COUNT(*) >= 5, after GROUP BY', correct: true },
          { key: 'a', label: 'WHERE COUNT(*) >= 5' },
          { key: 'b', label: 'WHERE hire_year IN (SELECT hire_year FROM employees LIMIT 5)' },
          { key: 'd', label: 'ORDER BY COUNT(*) DESC LIMIT 5' },
        ],
        why: 'WHERE runs before the rows are grouped, so there is no COUNT for it to test. HAVING filters the groups once they exist. The LIMIT option answers a completely different question — the five biggest years, not the years above a threshold.',
      },
      {
        id: 'q3', topic: 'statistics',
        q: 'One hire year shows an average salary far below every other year. It is based on two people. What do you report?',
        options: [
          { key: 'd', label: 'The figure with the headcount beside it, or not at all', correct: true },
          { key: 'a', label: 'That it was our most cost-effective hiring year' },
          { key: 'b', label: 'Nothing — quietly leave the row out' },
          { key: 'c', label: 'The figure, since it is what the data says' },
        ],
        why: 'Two salaries with a division sign between them is not a finding about hiring cost. Reporting it bare invites a sentence that cannot survive one question; removing it silently is worse, because the reader cannot see that you did.',
      },
      {
        id: 'q4', topic: 'business-sense',
        q: 'Six people have left the company in total, spread across three departments with two each. What can you say about departmental retention?',
        options: [
          { key: 'a', label: 'Nothing useful — one more leaver anywhere reorders the table', correct: true },
          { key: 'c', label: 'That those three departments have a retention problem' },
          { key: 'b', label: 'Convert to percentages of each department to make it comparable' },
          { key: 'd', label: 'That the departments with zero leavers have no retention risk' },
        ],
        why: 'A ranking that a single event would reverse carries no information. Percentages on a denominator of ten hide the sample size rather than fixing it, and "no leavers yet" is a very different claim from "no risk".',
      },
      {
        id: 'q5', topic: 'dataViz',
        q: 'You are charting headcount by department. Should you sort the bars?',
        options: [
          { key: 'b', label: 'Yes, by size — departments have no inherent order', correct: true },
          { key: 'a', label: 'No — never reorder a chart' },
          { key: 'c', label: 'Alphabetically, so readers can find a department' },
          { key: 'd', label: 'By cost centre number' },
        ],
        why: 'Categories with no natural order let you choose one, and size does the reader\'s ranking work for them. This is the opposite of a time series, where sorting by value destroys the only thing the chart shows — knowing which case you are in is the skill.',
      },
      {
        id: 'q6', topic: 'statistics',
        q: 'Six leavers stayed 1, 1, 1, 1, 4 and 4 years. Which figure best describes a typical departure?',
        options: [
          { key: 'c', label: 'The median, 1 year', correct: true },
          { key: 'a', label: 'The mean, 2 years' },
          { key: 'b', label: 'The range, 1 to 4 years' },
          { key: 'd', label: 'The mode and the mean together' },
        ],
        why: 'The mean of 2 describes none of the six people. Four of them left inside a year, which is the actual retention signal, and the median is the figure that carries it.',
      },
      {
        id: 'q7', topic: 'communication',
        q: 'Finance has 63 and you have 69. What do you do?',
        options: [
          { key: 'd', label: 'Label each number with its population and put both on the slide', correct: true },
          { key: 'a', label: 'Tell Finance their number is wrong' },
          { key: 'b', label: 'Present 66 as a reconciled figure' },
          { key: 'c', label: 'Drop headcount from your deck to avoid the clash' },
        ],
        why: 'Both are right and they answer different questions — the gap is exactly the six leavers. Averaging two populations produces a number that describes neither, and removing the clash leaves the same confusion to surface later.',
      },
      {
        id: 'q8', topic: 'business-sense',
        q: 'Comms drafts an intro using your numbers, and one sentence is not supported by them. It goes out under Data & Analytics. What do you do?',
        options: [
          { key: 'b', label: 'Name the specific sentences to change, and leave the supported ones alone', correct: true },
          { key: 'a', label: 'Approve it — Comms owns the wording' },
          { key: 'c', label: 'Ask for all the numbers to be removed' },
          { key: 'd', label: 'Rewrite the whole paragraph yourself' },
        ],
        why: 'It goes out in your name, so it is yours to check. Challenging everything costs you the credibility you need for the claims that actually matter, and stripping the figures removes the point of the pack.',
      },
      {
        id: 'q9', topic: 'communication',
        q: 'A stakeholder has read all your caveats and still wants one number for a meeting in twenty minutes. You can defend a figure. What do you send?',
        options: [
          { key: 'a', label: 'The number, with the assumption it rests on in the same sentence', correct: true },
          { key: 'c', label: 'The range, so they can choose' },
          { key: 'b', label: 'The caveats again — they clearly have not absorbed them' },
          { key: 'd', label: 'Nothing you cannot state with confidence' },
        ],
        why: 'Once they have read the caveats, withholding a number is not rigour — it leaves them to invent one with no analysis behind it. "Seven, if you mean holding steady" is a number and a caveat in six words.',
      },
      {
        id: 'q10', topic: 'business-sense',
        q: 'Hiring over the last three years was 6, 9 and 7. What is the defensible planning assumption?',
        options: [
          { key: 'c', label: 'Around seven — which is also the ten-year average', correct: true },
          { key: 'a', label: 'Fit a trend to the three points and extrapolate' },
          { key: 'b', label: 'Ten, matching the best year on record' },
          { key: 'd', label: 'Three, matching the most recent downturn' },
        ],
        why: 'Six, nine and seven is noise around seven, not a line — fitting a trend to three points buys false precision. Two independent methods landing on the same figure is the strongest thing you can say about it.',
      },
    ],
  },
  'compensation-review': {
    key: 'cq-comp', title: 'Q1 Compensation Review — end of project',
    intro: 'Ten questions on the week. Not a pass or fail — it tells both of us what stuck.',
    questions: [
      {
        id: 'q1', topic: 'sql',
        q: 'You want only people who currently work here. exit_year is NULL for current staff. Which filter works?',
        options: [
          { key: 'a', label: 'WHERE exit_year IS NULL', correct: true },
          { key: 'b', label: 'WHERE exit_year = NULL' },
          { key: 'c', label: 'WHERE exit_year = \'\'' },
          { key: 'd', label: 'WHERE NOT exit_year' },
        ],
        why: 'NULL is never equal to anything, including itself. `= NULL` returns no rows and no error — the most dangerous kind of mistake, because it looks like a clean result.',
      },
      {
        id: 'q2', topic: 'statistics',
        q: 'A department of four people has one director on 60L and three juniors on 8L. Which figure describes what a typical person there earns?',
        options: [
          { key: 'b', label: 'The median, 8L', correct: true },
          { key: 'a', label: 'The mean, 21L' },
          { key: 'c', label: 'The range, 8L to 60L' },
          { key: 'd', label: 'The mean, because it uses every value' },
        ],
        why: 'One extreme value drags the mean to 21L, which describes nobody in the room. The median is what a typical person actually earns. Using every value is not a virtue when one of them is an outlier.',
      },
      {
        id: 'q3', topic: 'data-ethics',
        q: 'A manager asks you for the salaries of the three people on their team, by name. What do you do?',
        options: [
          { key: 'c', label: 'Decline, and point them at People Ops — individual pay is not yours to circulate', correct: true },
          { key: 'a', label: 'Send it — they are the manager, it is their team' },
          { key: 'b', label: 'Send it anonymised as three unlabelled numbers' },
          { key: 'd', label: 'Send the team average instead' },
        ],
        why: 'A manager may well be entitled to it, but not through you and not by email from the analytics team. Anonymising three numbers for someone who knows all three people is not anonymising anything — and the team average of three is the same problem wearing a hat.',
      },
      {
        id: 'q4', topic: 'business-sense',
        q: 'Your result shows Support has the lowest average salary of any department. Which claim does that support?',
        options: [
          { key: 'a', label: 'Support has the lowest average salary of any department', correct: true },
          { key: 'b', label: 'Support staff are underpaid' },
          { key: 'c', label: 'Support is the least valued function' },
          { key: 'd', label: 'Support has a retention risk' },
        ],
        why: 'Only the restatement is safe. "Underpaid" needs a benchmark you do not have; "least valued" confuses cost with worth; "retention risk" is a forecast from a number that measures nothing about intent.',
      },
      {
        id: 'q5', topic: 'sql',
        q: 'Your GROUP BY returns an average for each department. What should you add before trusting it?',
        options: [
          { key: 'b', label: 'COUNT(*), so you can see how many people each average is built from', correct: true },
          { key: 'a', label: 'ORDER BY, so the biggest is first' },
          { key: 'c', label: 'A HAVING clause to drop small departments' },
          { key: 'd', label: 'ROUND(), so the numbers are readable' },
        ],
        why: 'An average over three people and one over two hundred look identical in a results grid. The count is what tells you which of them is worth acting on. Dropping small departments silently is worse than showing them with their count.',
      },
      {
        id: 'q6', topic: 'communication',
        q: 'You are writing to a stakeholder who asked which department pays most. Where does the answer go?',
        options: [
          { key: 'c', label: 'In the first line', correct: true },
          { key: 'a', label: 'At the end, after the method' },
          { key: 'b', label: 'In an attached spreadsheet' },
          { key: 'd', label: 'After the caveats, so it is not misread' },
        ],
        why: 'A busy reader decides in the first sentence whether to keep going. Caveats matter and they go after the answer — leading with them buries the thing they asked for and reads as hedging.',
      },
      {
        id: 'q7', topic: 'compensation',
        q: 'A department sits at 37% of its salary band. What does that mean?',
        options: [
          { key: 'd', label: 'Its average pay is 37% of the way from the band floor to the band ceiling', correct: true },
          { key: 'a', label: 'It is paid 37% of what it should be' },
          { key: 'b', label: '37% of its people are underpaid' },
          { key: 'c', label: 'It is 37% below market rate' },
        ],
        why: 'Position in band is a distance between the floor and ceiling WE set — nothing to do with market rate, and not a proportion of people. It is the closest thing in this dataset to a defensible reading of "low", which is exactly why it is worth being precise about.',
      },
      {
        id: 'q8', topic: 'data-ethics',
        q: 'A stakeholder asks you to split department averages by office location. The data supports it, but most department-by-location groups have one to three people in them. What do you do?',
        options: [
          { key: 'b', label: 'Say it is possible but should not be published at that grain, and offer a coarser cut', correct: true },
          { key: 'a', label: 'Produce it — they asked, and the data is there' },
          { key: 'c', label: 'Produce it but mark the small groups in grey' },
          { key: 'd', label: 'Refuse and say the data does not exist' },
        ],
        why: 'An average over two people publishes two salaries, whatever you shade it. Marking them grey does not un-publish them. And saying the data does not exist is a lie that lasts exactly as long as it takes someone to open the table — the honest answer names the real reason and offers something usable instead.',
      },
      {
        id: 'q9', topic: 'business-sense',
        q: 'A stakeholder asks for something the dataset cannot answer. When do you tell them?',
        options: [
          { key: 'a', label: 'Immediately, with what you can give them instead', correct: true },
          { key: 'c', label: 'At the end, in the caveats' },
          { key: 'b', label: 'When they ask why it is missing' },
          { key: 'd', label: 'Find a proxy and present it as the answer' },
        ],
        why: 'Saying it on Tuesday is a small problem. Saying it on Friday is a large one, because by then they have told someone else it is coming. A proxy presented as the answer is the version that ends careers.',
      },
      {
        id: 'q10', topic: 'statistics',
        q: 'Finance computes average salary including everyone employed at any point this year. You compute it for current staff only. Who is right?',
        options: [
          { key: 'c', label: 'Both — they answer different questions, and the meeting needs to pick one', correct: true },
          { key: 'a', label: 'You — leavers are not current pay' },
          { key: 'b', label: 'Finance — it is the real cost' },
          { key: 'd', label: 'Neither — you should average the two figures' },
        ],
        why: 'Finance is measuring spend; you are measuring what we pay people now. Both are defensible and they are not interchangeable — the job is to name the difference and get one chosen before the meeting, not to win it. Averaging two different questions produces a number that answers neither.',
      },
    ],
  },
};

function activitiesFor(projectKey) { return ACTIVITIES[projectKey] || []; }
function situationsFor(projectKey) { return SITUATIONS[projectKey] || []; }
function quizFor(projectKey) { return QUIZZES[projectKey] || null; }

module.exports = { ACTIVITIES, SITUATIONS, QUIZZES, activitiesFor, situationsFor, quizFor };
