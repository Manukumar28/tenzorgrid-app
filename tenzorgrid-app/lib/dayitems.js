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
