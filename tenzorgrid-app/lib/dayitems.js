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
  'activation-review': [
    {
      key: 'ca-01', day: 1, type: 'learning', via: 'email', from: 'data_engineer', minutes: 12,
      subject: 'Before you touch this data — what an export is',
      title: 'Read: the difference between "no data" and "not yet"',
      body: `Karthik here. You are about to work with an event export, and event exports have one property that catches everybody once.

They stop. Not at a month boundary, not at anything tidy — at whenever somebody ran the job. This one stops on 12 June. That means the June cohort is twelve days old, the May cohort is between twelve and forty-three days old, and every single rate you compute over "the last month" is really a rate over a ragged, partly observed window.

Here is the rule that saves you: for any metric measured at N days after signup, only cohorts with at least N days of observation can appear in the chart. Everyone else gets an empty cell, not a zero.

The failure looks the same every time. Somebody plots week-four retention by cohort, the newest bar is zero, and the room concludes that retention has collapsed. It has not. Nobody in that cohort has had a fourth week yet.

An empty cell says "we cannot know". A zero says "we know, and it is none". They are opposite claims and one of them is a lie.`,
      check: {
        kind: 'choice',
        prompt: 'A cohort that signed up nine days before the export shows 0% week-four retention. What should the chart show?',
        options: [
          { key: 'blank', correct: true, label: 'Nothing — the cohort is excluded until it has 28 days of observation' },
          { key: 'zero', correct: false, label: 'Zero, because that is what the data says' },
          { key: 'est', correct: false, label: 'An estimate based on the earlier cohorts' },
          { key: 'partial', correct: false, label: 'The figure so far, marked provisional' },
        ],
        why: 'A zero is a measurement. This is the absence of one. Marking it provisional does not help either — the number is not low, it does not exist.',
      },
    },
    {
      key: 'ca-02', day: 1, type: 'judgement', via: 'chat', from: 'line_manager', minutes: 6,
      subject: 'Quick one before you reply to Maya',
      title: 'Asha: how to correct someone who is already wrong in public',
      body: `Maya has told her skip-level that signups fell by two-thirds. She will find out from you that it did not.

Two ways to do this. One is to explain the partial-month artefact, which is correct and makes her look like she cannot read a table. The other is to give her the right number and the reason in the same breath, so she has something better to say rather than something to retract.

Do the second one. And do it today — a wrong number gets repeated roughly once a day until it is corrected, and every repetition makes the correction more expensive for her.

One more thing. There IS a small real dip in June. Do not bury it to make the correction cleaner. If you overcorrect to "nothing is wrong" and something is, you own that too.`,
      check: {
        kind: 'choice',
        prompt: 'Maya has already told her skip-level the wrong figure. What is the priority?',
        options: [
          { key: 'fast', correct: true, label: 'Get her the right number today, with the reason, so she can correct it herself' },
          { key: 'careful', correct: false, label: 'Take a day to check thoroughly before saying anything' },
          { key: 'skip', correct: false, label: 'Tell the skip-level directly since they have the wrong figure' },
          { key: 'quiet', correct: false, label: 'Let it go — the June number will correct itself next month' },
        ],
        why: 'Going over her head corrects the number and costs you the relationship. Waiting lets it spread. The dip is real enough that "it corrects itself" is not true either.',
      },
    },
    {
      key: 'ca-03', day: 2, type: 'learning', via: 'email', from: 'data_engineer', minutes: 14,
      subject: 'Funnels, and when they are not',
      title: 'Read: a funnel is a claim about a population',
      body: `A funnel chart makes a claim most people never notice: that everybody in it is on the same journey, in the same order.

When that holds, the steps shrink monotonically and step-over-step conversion is meaningful. When it does not, you get numbers above 100%, which is the data politely telling you the model is wrong.

There are only a few reasons a step can exceed the one before it:

1. The population is mixed. Some users enter the journey at step three because step two does not apply to them. This is the common one and it is what you have.
2. Events are duplicated, so you counted rows rather than people.
3. The steps are not really ordered — users can do them in any sequence.
4. The window is wrong: step two counted over a shorter period than step three.

The fix is never to cap the number. It is to find which of those four it is, then either split the population or rename the chart. A "funnel" over two different journeys is two funnels drawn on top of each other.`,
      check: {
        kind: 'choice',
        prompt: 'Your second funnel step converts at 114%. What is the first thing you do?',
        options: [
          { key: 'population', correct: true, label: 'Look for a subgroup that skips the first step entirely' },
          { key: 'cap', correct: false, label: 'Cap it at 100% and footnote the anomaly' },
          { key: 'rerun', correct: false, label: 'Rerun the query — it is probably a mistake in the SQL' },
          { key: 'drop', correct: false, label: 'Drop the step from the chart' },
        ],
        why: 'The query is likely fine. Above 100% is a finding about who is in your data, and it is usually the most interesting thing on the page.',
      },
    },
    {
      key: 'ca-04', day: 2, type: 'question', via: 'chat', from: 'stakeholder', minutes: 5,
      subject: 'Are invited users better?',
      title: 'Vikram asks whether we should just invite everyone',
      body: `Saw your split. Invited users activate at about double the rate of self-serve ones.

So: should we push everyone down the invite path? Seems like an easy win.`,
      check: {
        kind: 'answer',
        prompt: 'Answer him in a sentence or two.',
        markers: ['cannot|can.t|no one|nobody|someone|already|exist|selection|confound|not a lever|chicken'],
        why: 'You cannot be invited into a workspace nobody has made yet. Invited users exist because a self-serve user succeeded first, so the comparison describes selection, not a lever anyone can pull.',
      },
    },
    {
      key: 'ca-05', day: 3, type: 'learning', via: 'email', from: 'engineering_manager', minutes: 11,
      subject: 'How to report a data bug to an engineer',
      title: 'Read: what a mobile engineer needs from you',
      body: `Arjun. You are going to find things in event data that we broke, and how you report them decides whether they get fixed this week or next quarter.

Four things, in this order:

WHAT. One sentence. "Funnel events fire twice." Not "there appear to be some anomalies in the event stream."

WHERE. Platform and build. "Mobile 4.3.0, both iOS and Android, web unaffected." This is the single most valuable line, because it turns a reproduction hunt into a diff.

WHEN. The window, and whether it is still happening. If a later build fixed it, say so — an engineer who drops everything for a live incident that ended five weeks ago will read your next report more slowly.

HOW BIG. Users and rows. This is what decides priority and it is the part only you can supply.

Then the ask. "Can you confirm the cause, and tell me whether the historical events get reprocessed?" A report with no ask gets read and filed.`,
      check: {
        kind: 'choice',
        prompt: 'You have found a duplicate-event bug that a later release already fixed. What must the report say?',
        options: [
          { key: 'fixed', correct: true, label: 'That it appears already fixed, alongside the window and the blast radius' },
          { key: 'urgent', correct: false, label: 'Mark it urgent so it gets attention' },
          { key: 'nothing', correct: false, label: 'Nothing — it is fixed, so there is no bug to report' },
          { key: 'vague', correct: false, label: 'Report the symptom and let engineering establish the scope' },
        ],
        why: 'Fixed forward is not fixed backward — five weeks of corrupted events are still in every dashboard. But overstating urgency on a closed bug spends credibility you will want later.',
      },
    },
    {
      key: 'ca-06', day: 3, type: 'pressure', via: 'chat', from: 'line_manager', minutes: 6,
      subject: 'Priya wants the funnel numbers this afternoon',
      title: 'Asha: the numbers are wrong and someone wants them now',
      body: `Priya has asked for the funnel for a two o'clock. You have just found that a chunk of the events are duplicated.

You have three options and only one of them is defensible.

Send what you have and fix it later — no. Those numbers go into a deck and outlive the correction.

Ask for a week — no. She has a meeting and you have a working number for web, which is most of the data.

Send the corrected numbers with the caveat, and say plainly which part you are still checking. Late and right beats early and wrong, but "partial and labelled" beats both when somebody has a meeting at two.`,
      check: {
        kind: 'choice',
        prompt: 'Numbers are needed in two hours and you have just found a duplication bug affecting part of the data. What do you send?',
        options: [
          { key: 'partial', correct: true, label: 'The portion you trust, clearly labelled, with what is still being checked' },
          { key: 'raw', correct: false, label: 'The full numbers as they stand, with a verbal warning' },
          { key: 'delay', correct: false, label: 'Nothing until the whole thing is verified' },
          { key: 'estimate', correct: false, label: 'Corrected estimates, adjusting the affected rows by hand' },
        ],
        why: 'A verbal warning does not travel with the slide. Hand-adjusting creates a number nobody can reproduce, including you.',
      },
    },
    {
      key: 'ca-07', day: 4, type: 'learning', via: 'email', from: 'data_engineer', minutes: 13,
      subject: 'Who is in your table',
      title: 'Read: population definition is the analysis',
      body: `Every metric has a population, and most of the time nobody writes it down. That is where the errors live.

Your users table has customers in it. It also has thirty-one Meridian staff, because we dogfood. They never churn, they use the product six times as much as a customer, and nobody put a flag on them — the only way to tell is the email domain.

Two things worth internalising.

First, contamination is not uniform. Excluding staff moves activation by three points, which you might not notice. It moves sessions-per-user from 36.9 to 6.14, which changes the entire story. The same bad rows barely touch one metric and dominate another, so "it is only 5% of users" is not an argument.

Second, the exclusion has to be visible. If your query says WHERE email_domain <> 'meridiansystems.com' and your summary does not, then the next person reruns it, gets a different number, and now there are two figures in circulation and no way to tell which is right.

State the population in the same sentence as the metric. Every time.`,
      check: {
        kind: 'choice',
        prompt: 'Staff are 5% of users but a quarter of all sessions. What does that tell you?',
        options: [
          { key: 'varies', correct: true, label: 'The distortion will be small on per-user rates and large on per-session ones' },
          { key: 'small', correct: false, label: 'At 5% of users the effect is negligible either way' },
          { key: 'all', correct: false, label: 'Every metric is equally compromised' },
          { key: 'keep', correct: false, label: 'They should be kept — they are real usage' },
        ],
        why: 'Which metric you are computing decides how much a contaminated group matters. The share of users tells you almost nothing on its own.',
      },
    },
    {
      key: 'ca-08', day: 4, type: 'judgement', via: 'email', from: 'stakeholder', minutes: 8,
      subject: 'Mobile engagement',
      title: 'Vikram has a slide about mobile already',
      body: `I have a slide saying mobile users are 14% less engaged, measured by average session length. It is going to the board on Monday.

Your name is on the data source. Before it goes, is there anything I should know?`,
      check: {
        kind: 'choice',
        prompt: "Excluding zero-duration sessions, mobile averages 718 seconds against web's 703. What do you tell him?",
        options: [
          { key: 'reverse', correct: true, label: 'The finding reverses once bounced sessions are excluded — pull the slide' },
          { key: 'caveat', correct: false, label: 'Add a footnote about measurement differences' },
          { key: 'fine', correct: false, label: 'It is directionally right, so leave it' },
          { key: 'mobilebad', correct: false, label: 'Leave it — mobile does activate far worse, so the conclusion holds' },
        ],
        why: 'The mobile activation problem is real and it is a different claim. Letting a false statement stand because a true one exists nearby is how a deck stops meaning anything.',
      },
    },
    {
      key: 'ca-09', day: 5, type: 'learning', via: 'email', from: 'line_manager', minutes: 12,
      subject: 'When two metrics disagree',
      title: 'Read: activation and retention are not the same question',
      body: `Your two channel tables rank the channels differently, and paid search is the reason. It activates respectably and retains worst of all.

This is not a contradiction to be resolved. It is two questions being answered honestly.

Activation asks: did onboarding work for the people we got? Retention asks: were they worth getting? A channel can be excellent at the first and terrible at the second — that is the signature of acquisition that brings people who were never going to stay, and it is extremely common in paid search.

What you must not do is pick the metric that makes the story cleaner. What you should do is say the two disagree, say which one the business is actually paying for, and be clear that you cannot settle it from this data because there is no cost per acquisition and no revenue in these tables.

"Here are two measures, they disagree, here is what would resolve it" is a better answer than a confident ranking built on one of them.`,
      check: {
        kind: 'choice',
        prompt: 'Paid search is third on activation and last on retention. What do you report?',
        options: [
          { key: 'both', correct: true, label: 'Both rankings, that they disagree, and what data would settle it' },
          { key: 'retention', correct: false, label: 'The retention ranking, since retention is what matters' },
          { key: 'blend', correct: false, label: 'A combined score averaging the two' },
          { key: 'activation', correct: false, label: 'The activation ranking, since that was the question asked' },
        ],
        why: 'A blended score hides the disagreement inside a number nobody can interpret. The disagreement is the finding.',
      },
    },
    {
      key: 'ca-10', day: 5, type: 'reflection', via: 'chat', from: 'line_manager', minutes: 7,
      subject: 'Before you send it',
      title: 'Asha: four corrections, one week',
      body: `Look back at what happened this week. You corrected four things: a partial month read as a collapse, a funnel drawn over two populations, an event counted twice, and a company\'s own staff inside a customer metric.

Every one of them made a number look worse or better than it was. None of them were in the brief. All of them would have shipped.

That is the job at this level. Not writing harder SQL — checking what the numbers are of, before computing anything from them.

One question before you send Priya the recommendation, and it is the one I would ask you in a review: which of your findings would you defend if she pushed back hard on it, and which one are you least sure of?`,
      check: {
        kind: 'answer',
        prompt: 'Name the finding you are least sure of, and why.',
        markers: ['channel|partner|paid|sample|82|56|small|retention|causal|selection|invite|cohort|censor|cannot|unsure|weak'],
        why: 'The channel findings sit on the smallest samples and have no cost or revenue behind them. Knowing which of your own numbers is softest is what stops you defending the wrong one in the room.',
      },
    },
  ],
  'account-economics': [
    {
      key: 'ba-01', day: 1, type: 'learning', via: 'email', from: 'finance_analyst', minutes: 12,
      subject: 'Before you start — what cost to serve actually means',
      title: 'Read: cost to serve, and why we do not have it',
      body: `Diya. You are about to be asked a question whose central quantity does not exist in any table you have, so it is worth being precise about what that means.

Cost to serve is what it costs us to keep a customer: support time, infrastructure, account management, the engineering hours spent on their incidents. Real companies build it from timesheets, cloud allocation and payroll. We have none of that.

What we do have is volume — tickets and incidents, per account. That is a proxy. It correlates with cost and it is not cost, and the difference matters in a specific way: a proxy supports RELATIVE statements and not ABSOLUTE ones. You can say Starter accounts cost more per rupee of revenue than Enterprise ones. You cannot say Starter costs 92,000 a month.

The failure mode is always the same. Somebody multiplies your ticket count by an estimated cost per ticket and now there is a rupee figure in a deck, sourced to you, that you never computed. Say in the first line that it is a proxy and say what it cannot do.`,
      check: {
        kind: 'choice',
        prompt: 'Using tickets as a proxy for support cost, which statement is supportable?',
        options: [
          { key: 'rel', correct: true, label: '"Starter accounts generate more support load per rupee of revenue than Enterprise"' },
          { key: 'abs', correct: false, label: '"The Starter tier costs approximately 92,000 a month to serve"' },
          { key: 'margin', correct: false, label: '"The Starter tier operates at a negative margin"' },
          { key: 'profit', correct: false, label: '"Enterprise accounts are our most profitable"' },
        ],
        why: 'The first compares two things using the same proxy, which is exactly what a proxy is for. The other three convert volume into money, margin or profit — quantities the data does not contain at all.',
      },
    },
    {
      key: 'ba-02', day: 1, type: 'policy', via: 'email', from: 'security', minutes: 6,
      subject: 'Read and confirm: commercial data on named accounts',
      title: 'Read and confirm: revenue figures and client names',
      body: `This review pairs named clients with their revenue, which is the most commercially sensitive combination we hold.

Aggregates by tier go to Finance, Customer Success and the leadership team. A named client beside their MRR goes to Finance and that client's own CSM, and nowhere else — not to other account teams, not into a deck that circulates.

The specific risk here is a pricing review. Recommendations about what a segment should pay have a way of reaching customers, and a customer learning what a comparable account pays is a commercial problem that lasts years.

Confirm you have read this.`,
      check: { kind: 'acknowledge', label: 'I have read and understood' },
    },
    {
      key: 'ba-03', day: 2, type: 'learning', via: 'chat', from: 'data_engineer', minutes: 9,
      title: 'Rahul on aggregating one side of a join',
      body: `You are summing revenue across a tickets join this week. The problem and the two fixes, because one of them is a trap.

A JOIN from clients to tickets gives one row per TICKET. SUM(c.mrr) adds each client's revenue once per ticket — an account with eight tickets contributes eight times.

Fix one, the tempting one: SUM(DISTINCT c.mrr). It deduplicates the VALUES. That is correct only while no two clients share an MRR, which is a property of today's data and not of your query. Two accounts on the same price point and you have silently deleted a customer.

Fix two, the one to actually use: aggregate the revenue in a subquery over clients, separately from the ticket count. Longer, uglier, and correct no matter what the values happen to be.

The rule generalises: never deduplicate by value when what you mean is deduplicate by entity.`,
      check: {
        kind: 'choice',
        prompt: 'Why is SUM(DISTINCT c.mrr) unsafe as a fix?',
        options: [
          { key: 'value', correct: true, label: 'It deduplicates values, so two clients on the same MRR collapse into one' },
          { key: 'slow', correct: false, label: 'It is too slow on large tables' },
          { key: 'null', correct: false, label: 'It cannot handle NULL revenue' },
          { key: 'unsupported', correct: false, label: 'SQLite does not support DISTINCT inside an aggregate' },
        ],
        why: 'It is correct by coincidence whenever the values happen to be unique, and wrong the moment they are not — with no error and a total that looks almost right.',
      },
    },
    {
      key: 'ba-04', day: 2, type: 'judgement', via: 'email', from: 'line_manager', minutes: 9,
      subject: 'Ratios and denominators',
      title: 'Read: what a small denominator does to a ratio',
      body: `Asha. You are computing tickets per hundred thousand of revenue, which is the right shape and has a specific trap in it.

The denominator is revenue, and your smallest accounts have very little of it. An account on fifteen thousand a month needs only a handful of tickets to top the table, while an account on three hundred thousand would need dozens. The ratio is doing what you asked and it will always rank your smallest customers worst.

That does not make it wrong. It makes it a measure whose behaviour you have to explain, because the obvious reading — "these accounts are the problem" — is partly just arithmetic.

Two habits. Publish the numerator and the denominator beside the ratio, every time. And check whether the ranking survives removing the smallest account; if it does not, the finding is about that account rather than about the segment.`,
      check: {
        kind: 'answer',
        prompt: 'In two or three sentences: why will a per-revenue ratio tend to rank the smallest accounts worst, and what do you do about it?',
        maxWords: 90,
        markers: ['small|smallest|low|denominator|revenue|little|few ticket', 'show|beside|alongside|both|numerator|check|remove|sensitiv|caveat'],
        why: 'A small denominator inflates any ratio built on it. Publishing both inputs, and testing whether the ranking survives without the smallest account, is what separates a measure from an artefact.',
      },
    },
    {
      key: 'ba-05', day: 3, type: 'learning', via: 'chat', from: 'finance_analyst', minutes: 8,
      title: 'Diya on correcting a number you already sent',
      body: `You are going to find an error in something you sent me on Tuesday. I want to tell you how to handle that, because it happens to everyone and most people handle it badly.

Send the correction immediately, and lead with the corrected number. Not the explanation, not the apology — the number, so I can fix my model in the ten seconds before I read the rest.

Then one sentence on the cause, so I know whether anything else you sent is affected. Then, crucially, tell me whether the conclusion changes. That is the question I actually have and if you make me ask it, the correction has cost me more than the error did.

What not to do: bury it, wait until the final report and quietly use the right number, or write four paragraphs of apology. The first two are dishonest. The third makes a fifteen-thousand-rupee correction look like a catastrophe and trains me to worry about your work.

Analysts who correct fast get trusted more, not less. That is not a platitude, it is just what happens.`,
      check: {
        kind: 'choice',
        prompt: 'You spot an error in a figure you sent two days ago. What goes in the first line of the correction?',
        options: [
          { key: 'number', correct: true, label: 'The corrected number' },
          { key: 'sorry', correct: false, label: 'An apology for the error' },
          { key: 'cause', correct: false, label: 'An explanation of what caused it' },
          { key: 'impact', correct: false, label: 'A reassurance that the conclusion is unaffected' },
        ],
        why: 'The recipient has your wrong number in a model right now. Everything else — cause, impact, apology — matters and matters second.',
      },
    },
    {
      key: 'ba-06', day: 3, type: 'policy', via: 'chat', from: 'engineering_manager', minutes: 6,
      title: 'Arjun on incidents by tier',
      body: `You asked about our smaller accounts having more incidents per account. Context, before you write anything about why.

Starter accounts are on the shared infrastructure. Enterprise accounts have dedicated capacity for anything above a certain size, so a shared-tier failure hits every Starter customer at once and shows up as several incidents, one per affected account.

So the pattern is real and the cause is architectural rather than anything about those customers. That distinction matters a lot in how it gets written up — "smaller accounts experience more incidents" is fine, and anything implying they cause them is both wrong and the sort of sentence that ends up in front of a customer.

Happy to be quoted on the shared-infrastructure part.`,
      check: { kind: 'acknowledge', label: 'Understood' },
    },
    {
      key: 'ba-07', day: 4, type: 'learning', via: 'email', from: 'comms', minutes: 8,
      subject: 'Negative results are still results',
      title: 'Read: writing up a question that had no answer',
      body: `Meera. I hear the CSM workload question came back completely flat — every CSM holding one account. A note on writing that up, because people handle negative results badly in both directions.

One failure is to bury it, on the grounds that nothing interesting happened. The person who asked the question then assumes you did not get to it, or found something awkward. Both are worse than the truth.

The other failure is to spend a section on it. Three paragraphs proving that nothing is happening reads as padding, and it pushes your real findings further down a document people stop reading at the halfway mark.

One sentence. "Account load is uniform — one per CSM — so there is no imbalance to report." Then, if there is a better question underneath, ask it: revenue per CSM is not uniform at all, and that is probably what they meant.`,
      check: {
        kind: 'choice',
        prompt: 'A stakeholder-requested analysis returns a completely flat result. What do you do?',
        options: [
          { key: 'one', correct: true, label: 'Report it in one line, and offer the better question if there is one' },
          { key: 'drop', correct: false, label: 'Leave it out — there is nothing to say' },
          { key: 'section', correct: false, label: 'Give it a section showing the working, so the negative is credible' },
          { key: 'slice', correct: false, label: 'Slice it further until a difference appears' },
        ],
        why: 'Dropping it makes them assume you skipped it. A section buries your real findings. Slicing until something appears is how false findings are manufactured — and on fifteen accounts, every slice is one or two people.',
      },
    },
    {
      key: 'ba-08', day: 4, type: 'judgement', via: 'chat', from: 'people_partner', minutes: 6,
      title: 'Neha on recommendations about customers',
      body: `Your recommendation touches a tier of real customers, so — a thing worth internalising early.

There is a difference between a recommendation that changes what we charge and one that changes who we serve. The first is a pricing decision: reversible, testable, and squarely supported by the kind of analysis you have done. The second is strategy — it involves what those accounts become, what it costs to replace them, what it signals to the market, and none of that is in your tables.

Analysts get into trouble by letting strong evidence on the first carry them into the second. The ratio is dramatic, everybody nods, and by Friday the recommendation has grown from "reprice" to "exit" without anyone noticing the evidence did not grow with it.

Say which kind of decision your evidence supports. It takes one clause and it is the clause that keeps your name off a decision you did not actually make.`,
      check: {
        kind: 'answer',
        prompt: 'Write the clause distinguishing what your evidence supports from what it does not. Under 45 words.',
        maxWords: 45,
        markers: ['pricing|price|repric|charge|entitlement', 'not|does not|cannot|closure|close|exit|strategy|whether|exist'],
        why: 'Name the decision the evidence reaches and the one it does not, in the same sentence. Split across two paragraphs, only the first survives into the summary.',
      },
    },
    {
      key: 'ba-09', day: 5, type: 'learning', via: 'chat', from: 'data_engineer', minutes: 7,
      title: 'Rahul: four accounts, one average',
      body: `Last one. Your tier figures are means over four, five and six accounts, and one Starter account is roughly double the next on load per rupee.

On five accounts, one unusual member moves the mean by a fifth of its distance. That is enough to make a tier look like a structural problem when it has one demanding customer in it.

Compute the median beside it. If they agree, the tier genuinely behaves that way. If they diverge, your finding is about an account and you are about to recommend a policy for a segment on the strength of one customer's behaviour.

Either answer is publishable. Only one of them supports a tier-wide recommendation, and you cannot tell which you have without looking.`,
      check: {
        kind: 'choice',
        prompt: 'A tier mean is well above its median across five accounts. What have you found?',
        options: [
          { key: 'one', correct: true, label: 'One account is much heavier than the rest — a finding about that account' },
          { key: 'tier', correct: false, label: 'The tier is structurally expensive to serve' },
          { key: 'even', correct: false, label: 'Load is evenly distributed across the tier' },
          { key: 'error', correct: false, label: 'There is a data quality problem' },
        ],
        why: 'The mean is pulled by outliers and the median is not. A gap between them on five accounts means the weight sits on one of them — which is a real finding, and not the one that justifies a tier-wide policy.',
      },
    },
    {
      key: 'ba-10', day: 5, type: 'judgement', via: 'email', from: 'line_manager', minutes: 9,
      subject: 'Before the pricing review',
      title: 'Read: when the room already agrees with you',
      body: `Asha, last thing, and it is the hardest one in this project.

Everybody in that room already believes the Starter tier is a drag. Your analysis appears to confirm it. That combination is the single most dangerous position an analyst can be in, and it feels like the safest.

When your finding contradicts the room, every number gets checked and you find your own errors early. When it agrees, nothing gets checked. The proxy stops being described as a proxy. The recommendation grows from repricing to closure between the draft and the meeting. Nobody is acting in bad faith — agreement just removes all the friction that normally catches overreach.

So be more careful today, not less. Keep the proxy labelled. Keep the sample size visible. Say explicitly what the analysis does not support, because today nobody else in that room will.

The analyst who is trusted in year three is the one who was pedantic on the day everyone agreed with them.`,
      check: {
        kind: 'answer',
        prompt: 'Write the sentence you would add to the summary specifically because the room already agrees with you. Under 50 words.',
        maxWords: 50,
        markers: ['proxy|not a cost|no cost|five|5 |sample|one account|orchid', 'not|does not|cannot|closure|pricing|support|evidence'],
        why: 'Name the limit that agreement would otherwise let slide — the proxy, the five-account sample, or the line between repricing and closure. It is the sentence nobody else in the room will supply.',
      },
    },
  ],
  'reliability-review': [
    {
      key: 'ra-01', day: 1, type: 'learning', via: 'email', from: 'engineering_manager', minutes: 12,
      subject: 'Before you start — how our incident records really work',
      title: 'Read: what an incident record does and does not mean',
      body: `Arjun. You are senior enough that I will give you the unvarnished version rather than the documentation one.

severity is set in the first ten minutes by whoever is on call, from very little information, and is never revised. It records how alarming something looked, not how bad it turned out to be.

resolved_at is NULL for anything still open. It is also NULL for anything nobody remembered to close. We do not distinguish those, and I would not swear the oldest open records are all genuinely live.

rows_corrupted is the most trustworthy field we have. It comes out of the recovery tooling rather than a human judgement.

started_at is when we noticed, not when it began. For anything found by a client rather than by monitoring, those can be hours apart.

So: be careful with severity, be suspicious of very old open records, and lean on rows_corrupted. If your analysis contradicts the dashboard my team reports upward, that is interesting rather than wrong — come and talk to me.`,
      check: {
        kind: 'choice',
        prompt: 'Which field would you trust most as a measure of how bad an incident was?',
        options: [
          { key: 'rows', correct: true, label: 'rows_corrupted — it comes from tooling, not judgement' },
          { key: 'sev', correct: false, label: 'severity — it is the field designed for exactly this' },
          { key: 'dur', correct: false, label: 'resolved_at minus started_at' },
          { key: 'tickets', correct: false, label: 'the number of tickets the affected client raised' },
        ],
        why: 'Severity is a ten-minute first impression. Duration measures our response and is missing entirely for open incidents. Ticket counts measure how much a client complains. Only rows_corrupted is a machine-measured count of damage.',
      },
    },
    {
      key: 'ra-02', day: 1, type: 'policy', via: 'email', from: 'security', minutes: 6,
      subject: 'Read and confirm: incident data and client names',
      title: 'Read and confirm: what leaves this review',
      body: `You will be handling incident records tied to named clients. The rules are short.

Service-level aggregates — hours, counts, severities — are freely shareable internally and appear in the engineering review.

Anything that names a client alongside an incident goes to Customer Success, Engineering leadership and nobody else. It never goes to another client, and it never goes into a deck that leaves the company.

One that catches senior people specifically: you will be asked for "a quick example" in meetings. A named client used as an illustration is still a disclosure, however informal the room feels.

Confirm you have read this.`,
      check: { kind: 'acknowledge', label: 'I have read and understood' },
    },
    {
      key: 'ra-03', day: 2, type: 'learning', via: 'chat', from: 'data_engineer', minutes: 9,
      title: 'Rahul on date arithmetic in SQLite',
      body: `You will be computing durations all week, so — SQLite has no interval type and this catches everyone once.

  (julianday(resolved_at) - julianday(started_at)) * 24

julianday gives you a day number as a float. Subtract, multiply by 24, and you have hours. Without the * 24 you have days and the numbers look small and plausible, which is the dangerous version.

Two more. Both timestamps must be non-NULL or the whole expression is NULL — so your WHERE clause has to exclude open incidents or your AVG silently drops them anyway, without telling you how many. And julianday on a malformed string returns NULL rather than erroring, so a single bad row becomes a silent gap rather than a loud failure.

Count what you are averaging over. Every time.`,
      check: {
        kind: 'choice',
        prompt: 'You AVG a duration expression without filtering out unresolved incidents. What happens?',
        options: [
          { key: 'skip', correct: true, label: 'The NULLs are skipped and the average covers only closed incidents — with no warning' },
          { key: 'null', correct: false, label: 'The average comes back NULL' },
          { key: 'zero', correct: false, label: 'Open incidents count as zero and drag the average down' },
          { key: 'error', correct: false, label: 'SQLite raises an error' },
        ],
        why: 'AVG ignores NULLs. You get the right average over a different population from the one you think, and a COUNT(*) beside it will report the full number — which is exactly how a table ends up quietly wrong.',
      },
    },
    {
      key: 'ra-04', day: 2, type: 'judgement', via: 'email', from: 'line_manager', minutes: 10,
      subject: 'When three measures disagree',
      title: 'Read: choosing a measure is a decision, not a calculation',
      body: `Asha. You have three rankings that name three different services, and this is the moment the job stops being SQL.

There is no technique that resolves this. Frequency, duration and total time are all correct measurements of different things, and which one matters depends entirely on what the person is buying. Arjun is buying engineering capacity, so total hours is the measure connected to his decision. If he were buying customer goodwill it would be frequency, or blast radius.

Two failure modes, and juniors do the first while seniors do the second.

The junior one is picking whichever ranking looks most dramatic and presenting it as the answer.

The senior one is refusing to choose — handing over all three with a note that says it depends. That feels rigorous and it is actually an abdication, because the person receiving it has less information than you do.

Choose. Say which you chose. Say what the others said. That is the whole method.`,
      check: {
        kind: 'answer',
        prompt: 'Three measures name three services. Write how you would open the recommendation. Under 60 words.',
        maxWords: 60,
        markers: ['api.gateway|gateway|auth|service', 'total hours|capacity|engineering time|because|measure|chose|ranked by'],
        why: 'Name the service, then name the measure that chose it, in the same breath. The alternatives come afterwards as context, not as a menu.',
      },
    },
    {
      key: 'ra-05', day: 3, type: 'learning', via: 'email', from: 'finance_analyst', minutes: 10,
      subject: 'Survivorship bias, and why your MTTR is wrong',
      title: 'Read: the incidents your average cannot see',
      body: `Diya. You have found something worth understanding properly rather than just reporting.

Mean time to resolve is computed over incidents that resolved. That sounds tautological and it is the whole problem: the incidents that take longest are disproportionately the ones still running, so they are systematically absent from the average that is supposed to measure how long things take.

The effect is not random. It flatters exactly the teams with the worst unfinished work, because their hardest incidents are the ones excluded. A service that resolves everything quickly and a service that resolves easy things quickly and never finishes the hard ones can post identical MTTRs.

This is the same shape as measuring average customer lifetime using only customers who have already left, or fund performance using only funds that still exist. It is one of the most common quantitative errors in business reporting and almost nobody notices it, because the resulting number is always reassuring.

The fix is not a better average. It is publishing the open count beside it, always.`,
      check: {
        kind: 'choice',
        prompt: 'Why does MTTR computed on closed incidents flatter a team with a large open backlog?',
        options: [
          { key: 'hard', correct: true, label: 'Their hardest, longest incidents are still open, so the average never sees them' },
          { key: 'fewer', correct: false, label: 'They have fewer incidents in the calculation, so the average is less reliable' },
          { key: 'fast', correct: false, label: 'Teams with backlogs prioritise quick wins, which lowers the average' },
          { key: 'no', correct: false, label: 'It does not — the average is unaffected by open incidents' },
        ],
        why: 'It is selection, not sample size. The excluded incidents are not a random subset — they are specifically the long ones, which is what makes the bias systematic and always in the same direction.',
      },
    },
    {
      key: 'ra-06', day: 3, type: 'policy', via: 'chat', from: 'support_lead', minutes: 6,
      title: 'Sneha on very old open incidents',
      body: `You will have spotted some incidents that have been open for months. Before you write that up — how it actually happens.

Sometimes it is genuine: something is broken, there is a workaround, and it sits below the line quarter after quarter. That is a real finding and worth raising.

More often the fix shipped and nobody closed the record. There is no prompt, it belongs to whoever was on call that night, and they moved teams in June.

I cannot tell you which is which from here either — I would have to go and ask. So do not report a four-month SEV1 as an ongoing outage, and do not quietly assume it is stale. Ask. It takes one message and the answer changes what you write.`,
      check: { kind: 'acknowledge', label: 'Will do' },
    },
    {
      key: 'ra-07', day: 4, type: 'learning', via: 'chat', from: 'data_engineer', minutes: 8,
      title: 'Rahul: SUM across a join, again',
      body: `You are about to sum client revenue across the incidents table. The classic.

A JOIN from incidents to clients gives you one row per INCIDENT. A client with four incidents appears four times, and SUM(c.mrr) adds their revenue four times. The number comes out roughly double and looks entirely plausible, which is why it survives review.

SUM(DISTINCT c.mrr) works but is fragile — two clients on exactly the same MRR would collapse into one. Safer is a subquery: compute the distinct client set first, then sum their revenue.

The tell is always the same. If a figure is "revenue at risk" and it is close to or above your total book, you have done this.`,
      check: {
        kind: 'choice',
        prompt: 'Why is SUM(DISTINCT c.mrr) fragile as a fix?',
        options: [
          { key: 'dupes', correct: true, label: 'Two different clients with identical MRR collapse into one value' },
          { key: 'slow', correct: false, label: 'It is much slower on large tables' },
          { key: 'nulls', correct: false, label: 'It does not handle NULL revenue' },
          { key: 'syntax', correct: false, label: 'SQLite does not support DISTINCT inside SUM' },
        ],
        why: 'DISTINCT deduplicates VALUES, not clients. It happens to be right here because no two clients share an MRR, and it would silently under-count the moment two did — which is why a subquery over distinct client ids is the habit worth having.',
      },
    },
    {
      key: 'ra-08', day: 4, type: 'judgement', via: 'email', from: 'comms', minutes: 8,
      subject: 'Writing a recommendation that survives you',
      title: 'Read: making a recommendation defensible second-hand',
      body: `Meera. Arjun is going to take your recommendation into a room you are not in and be asked to defend it. That changes how it has to be written.

The test I use: could somebody who has not read the analysis answer one hostile question from your document alone? Not three questions — one. The likely one.

Here the likely question is "why that service and not the one with the worst average?". If the answer is in your document, Arjun handles it in a sentence. If it is only in your head, he says he will come back to them, and the decision slips a week.

So write the objection into the recommendation. Name the ranking you did not use and why. It feels defensive on the page and it is the difference between a decision made on Friday and a decision made never.`,
      check: {
        kind: 'answer',
        prompt: 'Write the sentence pre-empting "why not the service with the worst average duration?". Under 45 words.',
        maxWords: 45,
        markers: ['billing.sync|worst average|slowest|longest', 'one|single|1 |sample|closed|two open|not enough'],
        why: 'Name the service, name the reason it is not the answer — one closed incident — and move on. Two clauses, and it removes the only obvious objection.',
      },
    },
    {
      key: 'ra-09', day: 5, type: 'learning', via: 'chat', from: 'engineering_manager', minutes: 7,
      title: 'Arjun on being asked to forecast',
      body: `Vikram will ask you how much the incident count drops if we do this. I want to tell you what I have learned about that question.

You cannot answer it. One quarter of data, no comparable intervention, no baseline for what a fix of this kind achieves here. Any number you give is a guess that will be quoted back to you in January.

But "I cannot forecast it" on its own loses the funding, because he genuinely does need something to approve against.

What works is turning the forecast into a measurement. Give him today's number — the hours, the open count — and propose that we check the same figures in three months. He is then approving a measurable experiment rather than a hope, and nobody has invented anything.

I have watched analysts lose budget by being rigorous and win it by being rigorous and constructive. It is the same rigour.`,
      check: {
        kind: 'choice',
        prompt: 'You are asked to forecast the improvement and have no basis for one. What is the strongest response?',
        options: [
          { key: 'baseline', correct: true, label: 'Decline the forecast, give the current baseline, and propose re-measuring in three months' },
          { key: 'refuse', correct: false, label: 'Explain that forecasting is outside the scope of the analysis' },
          { key: 'estimate', correct: false, label: 'Give a conservative estimate, clearly labelled as approximate' },
          { key: 'industry', correct: false, label: 'Cite a typical industry improvement figure' },
        ],
        why: 'A labelled estimate is still repeated without its label, and an industry figure is an invented number wearing a suit. Turning an unanswerable forecast into a measurable before-and-after gives the decision-maker what they actually need.',
      },
    },
    {
      key: 'ra-10', day: 5, type: 'judgement', via: 'email', from: 'line_manager', minutes: 9,
      subject: 'Before the recommendation goes',
      title: 'Read: recommending where other people\'s time goes',
      body: `Asha, last one. This recommendation moves a quarter of a team for three months. That is a person-year of engineering, and it is the largest thing you have influenced here.

Two things senior people do that junior people do not.

They say what will not improve. Every recommendation implicitly deprioritises something, and naming it yourself is far better than having it discovered. Berylline Retail has the joint-largest support backlog and no incidents at all — nothing in this programme touches them, and Arjun should hear that from you rather than from their CSM in March.

They make the recommendation falsifiable. Say what you expect to be different and how you would check. An unfalsifiable recommendation cannot fail, which sounds comfortable and means it can never be shown to have worked either.

Both of those make the document harder to write and much harder to argue with.`,
      check: {
        kind: 'answer',
        prompt: 'Write the sentence naming what this programme will NOT fix. Under 45 words.',
        maxWords: 45,
        markers: ['backlog|ticket|berylline|no incident|support', 'not|will not|won.t|unaffected|nothing|separate|outside'],
        why: 'Name the thing and be explicit that it stays broken. Volunteering it costs a sentence; having it discovered costs the credibility of the whole recommendation.',
      },
    },
  ],
  'pay-equity-audit': [
    {
      key: 'ea-01', day: 1, type: 'learning', via: 'email', from: 'people_partner', minutes: 11,
      subject: 'Before you start — what our salary bands actually are',
      title: 'Read: bands, and the three things called pay equity',
      body: `Neha here. Two things before you open the data, because both decide what your audit can conclude.

First, the bands. Every department has a band_low and a band_high that we agreed with Finance. They are WIDE — often a factor of two from bottom to top — because one band has to cover a new joiner and somebody with eight years in the same function. Being inside your band is therefore a very weak statement. It means nothing has gone badly wrong. It does not mean you are paid the same as the person next to you.

Second, "pay equity" means at least three different things and people use them interchangeably:

  INTERNAL CONSISTENCY — do people doing the same job get paid the same
  BAND COMPLIANCE — is anyone outside the range we agreed
  MARKET COMPETITIVENESS — are we paying what the outside world pays

We can answer the first two from this data. We cannot answer the third at all, and I would rather you said so loudly than quietly produced something that looks like an answer.`,
      check: {
        kind: 'choice',
        prompt: 'An employee sits inside their band. What does that establish?',
        options: [
          { key: 'weak', correct: true, label: 'Only that their pay is within the agreed range — the band is wide' },
          { key: 'fair', correct: false, label: 'That they are paid fairly' },
          { key: 'same', correct: false, label: 'That they are paid the same as others in their role' },
          { key: 'market', correct: false, label: 'That their pay is competitive' },
        ],
        why: 'A band often spans a factor of two. Two people in the same band can be paid very differently and both be compliant, which is exactly the gap this audit exists to look into.',
      },
    },
    {
      key: 'ea-02', day: 1, type: 'policy', via: 'email', from: 'security', minutes: 7,
      subject: 'Read and confirm: individual salary data',
      title: 'Read and confirm: handling individual pay records',
      body: `This audit puts you closer to individual salaries than anything you have done here, so the rules matter more than usual.

Aggregates by department or role are shareable with People Ops, Finance and the leadership team. Individual rows are not, with one exception: a named individual's own pay may be discussed with Neha and with that person's manager, and nobody else.

If your analysis produces a list of named people, that list goes to Neha directly and does not appear in any pack, deck or newsletter. A group small enough to identify someone is the same as naming them.

And the one that catches people: do not discuss what you have found with colleagues, including ones who help you with the SQL. "I noticed something odd in Marketing" is a disclosure.

Confirm you have read this.`,
      check: { kind: 'acknowledge', label: 'I have read and understood' },
    },
    {
      key: 'ea-03', day: 2, type: 'learning', via: 'chat', from: 'data_engineer', minutes: 8,
      title: 'Rahul on band position arithmetic',
      body: `You will want "how far up their band is this person" a lot this week. The formula is simple and the mistakes are not.

  (salary - band_low) * 100.0 / (band_high - band_low)

Two things. Use 100.0 rather than 100 — integer division will quietly give you zeros and they look like real answers. And the denominator is the band WIDTH, not band_high; dividing by the top of the band gives you a number that means nothing but still comes out between 0 and 100, which is the worst kind of wrong.

Zero percent means sitting exactly on the floor of the band. A hundred means at the ceiling. Anything outside that range means the person is out of band, which is what your headline check is looking for.`,
      check: {
        kind: 'choice',
        prompt: 'Band is 800,000 to 1,800,000. Somebody earns 1,050,000. Where are they?',
        options: [
          { key: 'q', correct: true, label: '25% of the way up the band' },
          { key: 'half', correct: false, label: '58% of the way up the band' },
          { key: 'over', correct: false, label: 'Above the band' },
          { key: 'low', correct: false, label: '13% of the way up the band' },
        ],
        why: '250,000 above the floor, over a width of 1,000,000, is 25%. The 58% answer is what you get dividing by band_high instead of the width — a plausible-looking number that answers no question at all.',
      },
    },
    {
      key: 'ea-04', day: 2, type: 'judgement', via: 'email', from: 'line_manager', minutes: 9,
      subject: 'Where the line sits is not your call',
      title: 'Read: measuring versus deciding',
      body: `Asha. A word about the boundary in this piece of work, because getting it wrong is the most common way an analyst loses a stakeholder.

You are going to produce a number — a spread of twelve percent, say — and somebody is going to ask whether that is acceptable. It is extremely tempting to answer, because you have spent three days with the data and nobody knows it better.

Do not. Whether twelve percent is acceptable is a policy question owned by People Ops. It depends on things you cannot see: what we promised people at hire, what the market did last year, what we can afford. Your job is to make the number impossible to misunderstand and then let Neha decide.

This is not timidity. An analyst who stays inside their evidence gets believed on the things they do assert. One who drifts into policy gets treated as another opinion in the room, and the numbers go with them.`,
      check: {
        kind: 'answer',
        prompt: 'Neha asks whether a 12% spread within a role is acceptable. Write your reply. Under 60 words.',
        maxWords: 60,
        markers: ['not|no standard|nothing in the data|your call|policy|you decide|people ops|depends', 'can|will|here is|what I can|measure|tenure|compare|context'],
        why: 'Decline the policy question, give the reason it is not yours, and immediately offer what you CAN provide — context on what drives the spread. A refusal with nothing attached reads as unhelpful.',
      },
    },
    {
      key: 'ea-05', day: 3, type: 'learning', via: 'chat', from: 'finance_analyst', minutes: 8,
      title: 'Diya on results that come back empty',
      body: `You are about to run a check that might return nothing, so — the thing nobody teaches and everybody meets.

An empty result and a broken query look exactly the same. Both are zero rows. There is no error, no warning, nothing to tell them apart, and the natural reaction to "no rows" is to assume you have made a mistake and start rewriting.

The fix is a control. Run the same join and the same arithmetic with a threshold you KNOW will catch people — say, anyone in the bottom quarter of their band. If that returns rows, your machinery works and the empty result is real. If it also returns nothing, you have a bug.

Ten minutes, and it turns "I think nobody is out of band" into "nobody is out of band, and here is why I am sure". In an audit, that second sentence is the whole product.`,
      check: {
        kind: 'choice',
        prompt: 'Your exception query returns zero rows. What do you do first?',
        options: [
          { key: 'control', correct: true, label: 'Run a control query with a threshold you know will match, to prove the logic works' },
          { key: 'trust', correct: false, label: 'Report it — zero rows means zero exceptions' },
          { key: 'rewrite', correct: false, label: 'Rewrite the query until it returns something' },
          { key: 'widen', correct: false, label: 'Widen the threshold until exceptions appear' },
        ],
        why: 'Trusting it blindly risks reporting a bug as an assurance. Rewriting until something appears, or widening until it does, is how an audit gets rigged — usually without anyone intending to.',
      },
    },
    {
      key: 'ea-06', day: 3, type: 'policy', via: 'chat', from: 'comms', minutes: 6,
      title: 'Meera on writing up a negative finding',
      body: `Heard your band check came back clean. A note on how to write that, because it is genuinely hard and most people do it badly.

"We found no issues" reads as "we did not look very hard". It is the same sentence you would write if you had done nothing all week, which is why it lands so poorly.

What works is naming the test. "We checked every current employee against their department's agreed band and found no exceptions" is the same finding, and it is now an assurance somebody can rely on — because the reader can see what was actually done.

Then give them the thing you did find. A report that is only a negative, however well written, leaves the reader with nowhere to go.`,
      check: { kind: 'acknowledge', label: 'Got it' },
    },
    {
      key: 'ea-07', day: 4, type: 'learning', via: 'email', from: 'engineering_manager', minutes: 9,
      subject: 'About the Staff Engineer thing',
      title: 'Read: why senior ICs sometimes out-earn managers',
      body: `Arjun. I gather your audit has noticed that our Staff Engineers are paid above our Engineering Managers. Before you write that up as a fault — some context you will not find in the table.

It is deliberate. A Staff Engineer is a technical leadership role and we compete for those people against companies that pay very well. An Engineering Manager is a people-leadership role with a different and, frankly, larger supply of candidates. Paying the IC track above the management track at that level is how we stop our best engineers becoming mediocre managers just to get a raise.

Plenty of companies do it the other way and they are not wrong either. It is a design choice.

What I would ask is that you report it as an observation and ask whether it is intended, rather than as an error to be corrected. If it turns up in a pack as "pay anomaly in Engineering" I will spend a month explaining it.`,
      check: {
        kind: 'choice',
        prompt: 'Every Staff Engineer out-earns every Engineering Manager. How do you report it?',
        options: [
          { key: 'ask', correct: true, label: 'As an observation, with a question about whether it is intended' },
          { key: 'error', correct: false, label: 'As a pay anomaly requiring correction' },
          { key: 'omit', correct: false, label: 'Leave it out — the roles are not comparable' },
          { key: 'rename', correct: false, label: 'Suggest retitling the roles so the comparison disappears' },
        ],
        why: 'You cannot tell intent from the data, and a clean separation across the whole rung looks far more like a design than an accident. Omitting it is worse — hiding an awkward finding because it is hard to interpret is the failure this audit exists to avoid.',
      },
    },
    {
      key: 'ea-08', day: 4, type: 'judgement', via: 'chat', from: 'people_partner', minutes: 7,
      title: 'Neha on what remediation actually costs',
      body: `When you cost the remediation, one thing to build in from the start.

A salary increase is not a one-off. Lifting somebody by fifty thousand costs fifty thousand this year and every year after, plus whatever it compounds to at the next review, plus the employer contributions on top. Finance will apply the multiplier themselves, but if your number looks like a one-off payment they will assume that is what you meant and the conversation goes wrong in the first minute.

So label it. "Annual, recurring, before on-costs" is six words and it stops the whole misunderstanding.

Same for the population: say how many people, so nobody divides your total by the wrong headcount.`,
      check: {
        kind: 'answer',
        prompt: 'Write the line that presents your remediation total so Finance reads it correctly. Under 45 words.',
        maxWords: 45,
        markers: ['annual|recurring|per year|ongoing|each year', 'people|headcount|\\d|across|covering'],
        why: 'The number, the population it covers, and the word "annual". Without the last one Finance reads a recurring cost as a one-off and budgets a fraction of what is needed.',
      },
    },
    {
      key: 'ea-09', day: 5, type: 'learning', via: 'chat', from: 'data_engineer', minutes: 8,
      title: 'Rahul: the mean is hiding things again',
      body: `Last one. Every figure in your audit so far is a mean, and you have roles with three to seven people in them.

On seven people, one unusual salary moves the mean by a seventh of its distance. That is enough to make a role look like it has a problem when it has one well-paid person, or to hide a genuinely low-paid person behind six normal ones.

Compute the median alongside. Where they agree, the mean is telling you about the group. Where they diverge, the mean is telling you about one individual, and that individual is the finding.

The gap between mean and median is itself the most useful column you can add — sort by it and you have a list of exactly the roles worth looking at person by person.`,
      check: {
        kind: 'choice',
        prompt: 'In one role the mean is well above the median. What does that tell you?',
        options: [
          { key: 'high', correct: true, label: 'At least one person is paid well above the rest of the role' },
          { key: 'low', correct: false, label: 'Most people in the role are overpaid' },
          { key: 'even', correct: false, label: 'Pay in the role is evenly distributed' },
          { key: 'error', correct: false, label: 'There is an error in the data' },
        ],
        why: 'The mean is pulled toward outliers and the median is not, so a mean above the median means weight at the top. That person may be entirely justified — but they are the reason the role average looks the way it does, and the report should say so rather than let the average speak for six people it does not describe.',
      },
    },
    {
      key: 'ea-10', day: 5, type: 'judgement', via: 'email', from: 'line_manager', minutes: 9,
      subject: 'Before the report goes in',
      title: 'Read: reporting an audit that found nothing wrong',
      body: `Last thing. This report says the company is compliant, and there is a specific pressure that comes with that which you should expect.

Somebody will want you to have found more. Not maliciously — an audit that confirms everything is fine feels, to the person who commissioned it, like a week nobody needed. There will be a gentle pull toward emphasising the band-position finding harder than it deserves, or toward language like "concerning" and "significant" that the numbers do not carry.

Resist it, and resist it in a specific way: put the assurance and the finding in the same paragraph, both stated plainly. "No band exceptions. Two departments sit near the bottom of their bands." Nobody reading that thinks the week was wasted, and nothing in it is overstated.

An audit that overstates once is never trusted to have understated anything again.`,
      check: {
        kind: 'answer',
        prompt: 'Write the opening two sentences of the report. Under 50 words.',
        maxWords: 50,
        markers: ['no|none|nobody|within band|inside|compliant|exception', 'but|however|two|marketing|support|bottom|lower|position|37|66'],
        why: 'Assurance and finding, adjacent, neither dressed up. The first sentence is what she can say; the second is what she has to decide about.',
      },
    },
  ],
  'outage-recovery': [
    {
      key: 'pa-01', day: 1, type: 'learning', via: 'email', from: 'support_lead', minutes: 10,
      subject: 'Before you start — what our incident data actually records',
      title: 'Read: incidents, tickets, and the difference between them',
      body: `Sneha here — I log every one of these, so a few minutes on what the columns mean before you draw conclusions from them.

An INCIDENT is something we broke. It has a service, a severity, a start time, a resolved time, and a count of rows corrupted. Severity is set when it opens, by whoever opens it, based on how urgent it looks at that moment. Nobody goes back and revises it afterwards.

A TICKET is a client contacting us. Priority is set by the client's own account team and reflects how loudly they are asking, not how much damage was done.

Two consequences, and both catch people. Severity is not a measure of damage — it is a measure of how alarming something looked in the first ten minutes. And ticket volume is a measure of how much an account complains, which correlates with their personality as much as with their experience.

resolved_at is NULL for anything still open. Seven of them are.`,
      check: {
        kind: 'choice',
        prompt: 'Which column most directly measures how much harm an incident did?',
        options: [
          { key: 'rows', correct: true, label: 'rows_corrupted' },
          { key: 'sev', correct: false, label: 'severity' },
          { key: 'pri', correct: false, label: 'the priority of the related tickets' },
          { key: 'time', correct: false, label: 'hours from started_at to resolved_at' },
        ],
        why: 'Rows corrupted is a count of actual damage. Severity is a first-impression judgement, ticket priority measures complaint, and resolution time measures how long we took — which is about us, not about them.',
      },
    },
    {
      key: 'pa-02', day: 1, type: 'policy', via: 'email', from: 'security', minutes: 6,
      subject: 'Read and confirm: client data in incident analysis',
      title: 'Read and confirm: what may leave this analysis',
      body: `Standard note for anyone working on the incident review, and it matters here because named clients are involved.

Client names, revenue figures and incident counts stay internal. They may go to Customer Success, Finance and the board. They do not go to the clients themselves, and they never go to one client about another.

If an account team wants to tell a client what happened to them, that is a conversation they have with their own account's figures only. Route it through Priya rather than answering it yourself.

Confirm you have read this.`,
      check: { kind: 'acknowledge', label: 'I have read and understood' },
    },
    {
      key: 'pa-03', day: 2, type: 'learning', via: 'chat', from: 'data_engineer', minutes: 8,
      title: 'Rahul on COUNT versus COUNT(DISTINCT ...)',
      body: `You are about to count clients and incidents in the same query, so — the thing that catches everyone.

COUNT(i.id) after a JOIN counts JOINED ROWS, not clients. If a client had four incidents, they contribute four rows, and anything you SUM over that join is fine but anything you COUNT is now counting incidents whether you meant to or not.

COUNT(DISTINCT c.id) counts clients. Same for SUM: if you SUM(c.mrr) across a join, an account with four incidents has its revenue added four times. SUM(DISTINCT c.mrr) fixes it, and so does a subquery, and the subquery is more honest about what you are doing.

It matters here because "revenue at risk" is exactly the number somebody will quote in a board meeting.`,
      check: {
        kind: 'choice',
        prompt: 'You JOIN clients to incidents and write SUM(c.mrr). What have you computed?',
        options: [
          { key: 'inflated', correct: true, label: "Each client's revenue counted once per incident — an inflated total" },
          { key: 'right', correct: false, label: 'Total revenue of affected clients' },
          { key: 'avg', correct: false, label: 'Average revenue per incident' },
          { key: 'null', correct: false, label: 'Nothing — SQL would reject it' },
        ],
        why: 'The join multiplies each client row by their incident count before the SUM sees it. SQL runs it happily and returns a number that is too big, which is the worst kind of error — no message, just a wrong figure that looks plausible.',
      },
    },
    {
      key: 'pa-04', day: 2, type: 'judgement', via: 'email', from: 'finance_analyst', minutes: 10,
      subject: 'A warning about ratios',
      title: 'Read: what a ratio hides',
      body: `Diya here. You are going to compute damage relative to what an account pays, and it is the right instinct, so a word about the trap inside it.

A ratio compresses two numbers into one, which is useful and lossy. A client with fifteen thousand a month and seventy thousand corrupted rows gets a spectacular ratio. So would a client paying us a hundred rupees who lost one row.

The fix is not to avoid ratios. It is to never publish one without both of its inputs beside it. A reader who can see the numerator and the denominator can spot a small-denominator artefact in a second; a reader given only the ratio cannot, and will rank on it.

Same rule as any average: show the n.`,
      check: {
        kind: 'answer',
        prompt: 'In two or three sentences: how would you present the damage-per-rupee figure so nobody misreads it?',
        maxWords: 90,
        markers: ['beside|alongside|with|show|both|input|numerator|denominator|mrr|revenue|rows', 'small|low|tiny|denominator|artefact|artifact|distort|mislead|caveat'],
        why: 'Put the revenue and the rows next to the ratio, and say what a small denominator does to it. The ratio then earns its place instead of hiding its own weakness.',
      },
    },
    {
      key: 'pa-05', day: 3, type: 'learning', via: 'chat', from: 'engineering_manager', minutes: 7,
      title: 'Arjun on why severity is set once and never revised',
      body: `Since you are looking at our severity data — an honest word about it from the side that produces it.

Severity gets set in the first ten minutes by whoever is on call, from very little information. SEV1 means "wake people up". SEV3 means "fix it in hours". It is a triage decision made under pressure and it is never revisited, because by the time we know how bad something really was, the useful moment for that label has passed.

So do not treat it as a damage measurement. It is a record of how alarming something looked at the start. Sometimes an incident that looked routine turned out to have quietly corrupted a great deal, and it stays SEV3 forever.

If you find our severity labels do not predict anything, you have not found a bug. You have found out what they are.`,
      check: {
        kind: 'choice',
        prompt: 'Your data shows SEV3 incidents take longer to resolve than SEV2. What is the most likely explanation?',
        options: [
          { key: 'urgency', correct: true, label: 'Severity drives how urgently we respond, not how complex the problem turns out to be' },
          { key: 'wrong', correct: false, label: 'The severity labels were assigned incorrectly' },
          { key: 'data', correct: false, label: 'The resolution timestamps are unreliable' },
          { key: 'random', correct: false, label: 'It is noise — the difference means nothing' },
        ],
        why: 'A SEV1 gets people out of bed, so it closes fast regardless of difficulty. A SEV3 sits in a queue behind other work. The label predicts our response, not the problem — which is exactly why it is a poor basis for compensating clients.',
      },
    },
    {
      key: 'pa-06', day: 3, type: 'policy', via: 'chat', from: 'line_manager', minutes: 5,
      title: 'Asha: taking away someone\'s simple method',
      body: `You are about to tell Priya that ranking by severity does not work. Before you send it — the shape that makes this land rather than annoy.

Her method has a real virtue yours does not: she can explain it to the board in one sentence. If you replace it with something more correct and less explainable, you have not helped her, you have moved the problem.

So the note has three parts. What is wrong with severity, in one concrete fact. What to use instead. And crucially — how to say the new thing in one sentence in a meeting.

That third part is the one people skip, and it is the one that decides whether your analysis gets used or politely ignored.`,
      check: { kind: 'acknowledge', label: 'Understood' },
    },
    {
      key: 'pa-07', day: 4, type: 'learning', via: 'email', from: 'comms', minutes: 9,
      subject: 'Writing about clients by name',
      title: 'Read: naming accounts in an internal note',
      body: `Meera here. Your recommendation is going to name specific clients and say they were damaged, which is fine internally and needs care in how it is written.

Three habits worth having.

Attach the measure to the name every time. "Harborview Bank, 492,000 rows" is a fact. "Harborview Bank, worst affected" is a conclusion, and conclusions get repeated without their evidence.

Never write a sentence about a client you would not be comfortable reading aloud to them. Not because they will see it — they will not — but because that test catches the sentences that are actually speculation about their state of mind.

And say what you do not know. "We have no evidence on whether they are considering leaving" is a sentence that makes everything around it more credible.`,
      check: {
        kind: 'choice',
        prompt: 'Which sentence belongs in the recommendation?',
        options: [
          { key: 'fact', correct: true, label: '"Harborview Bank lost 492,000 rows across two incidents, the highest in the book."' },
          { key: 'mind', correct: false, label: '"Harborview Bank are almost certainly considering their options."' },
          { key: 'vague', correct: false, label: '"Several key accounts were significantly impacted this quarter."' },
          { key: 'blame', correct: false, label: '"Harborview Bank were badly let down by the platform team."' },
        ],
        why: 'The first is measured and checkable. The second speculates about a client\'s intentions with no evidence, the third says nothing a reader can act on, and the fourth assigns blame in a document about compensation — which will be forwarded.',
      },
    },
    {
      key: 'pa-08', day: 4, type: 'judgement', via: 'chat', from: 'people_partner', minutes: 6,
      title: 'Neha on being asked for something you cannot give',
      body: `Priya mentioned you are getting asked whether these accounts will churn. A thought, because you will be asked this shape of question for the rest of your career.

There are two honest answers and they are not the same. "I do not know" ends the conversation. "We have one churned account in the whole book, so anything I told you would be a guess with a percentage sign on it" ends the conversation AND explains why, so nobody thinks you are being unhelpful or hiding something.

Then add what you can give them. Here that is the observation that the one account you did lose had been damaged — suggestive, not predictive, and worth saying as exactly that.

The skill is not refusing. It is refusing in a way that leaves the other person better off than before they asked.`,
      check: {
        kind: 'answer',
        prompt: 'Write the sentence you would say when asked how many of these accounts will churn. Under 45 words.',
        maxWords: 45,
        markers: ['one|1 |single|only', 'cannot|can.t|guess|not predict|no basis|would be|suggest'],
        why: 'Name the sample size — one churned account — and say plainly that no rate can be built on it. The number is the argument; without it you are just declining.',
      },
    },
    {
      key: 'pa-09', day: 5, type: 'learning', via: 'chat', from: 'data_engineer', minutes: 8,
      title: 'Rahul: mean, median, and one enormous account',
      body: `For the headline damage figure — you have thirteen affected accounts and one of them lost nearly half a million rows while several lost under ten thousand.

The mean of that is a number no client experienced. It sits above almost every account in the list because one value is dragging it. Quote it on its own and the first person to check will find twelve of thirteen accounts below it, which makes everything else you said look shaky.

The median tells you what a typical affected account went through. The mean tells you the total divided by the count, which is a fact about the total, not about a typical account.

Report both, or report the median and say why. And SQLite has no median function — do it in the notebook, it is four lines.`,
      check: {
        kind: 'choice',
        prompt: 'Damage per client is 7k, 9k, 12k, 20k and 493k. Which figure describes a typical affected account?',
        options: [
          { key: 'median', correct: true, label: 'The median, 12k' },
          { key: 'mean', correct: false, label: 'The mean, about 108k' },
          { key: 'max', correct: false, label: 'The maximum, 493k' },
          { key: 'range', correct: false, label: 'The range, 7k to 493k' },
        ],
        why: 'The mean of 108k is higher than four of the five accounts. It is a true statement about the total and a misleading one about any account in the list.',
      },
    },
    {
      key: 'pa-10', day: 5, type: 'judgement', via: 'email', from: 'line_manager', minutes: 8,
      subject: 'Before the recommendation goes out',
      title: 'Read: recommending who gets money',
      body: `This is the first piece of work you have done here that moves a budget, so one thing before it goes.

An analysis that ranks is read differently from one that describes. Nobody argues with a table of rows corrupted. The moment that table becomes a list of who gets paid, every account team with a client below the line has a reason to find a problem with your method.

So the method has to be stated, stated first, and stated in one sentence. Not the SQL — the principle. "Ranked by rows corrupted, weighted toward accounts where the damage is large relative to what they pay, excluding one account that has already churned."

Somebody reading that can disagree with the principle, which is a good conversation. What you want to avoid is them disagreeing with the OUTCOME and having to reverse-engineer your reasoning to do it, because that conversation is about you rather than about the decision.`,
      check: {
        kind: 'answer',
        prompt: 'Write the one sentence stating how your list was ranked. Under 40 words.',
        maxWords: 40,
        markers: ['rows|corrupted|damage', 'relative|per|proportion|open|unresolved|weight|exclud|churn|not.*revenue|rather than'],
        why: 'One sentence containing the measure, the weighting and the exclusion. Everything else in the note hangs off it, and it is the sentence that gets repeated in rooms you are not in.',
      },
    },
  ],
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
  'activation-review': [
    {
      key: 'cs-01', day: 1, type: 'scope', via: 'email', from: 'stakeholder',
      subject: 'How far back do you want to go?',
      body: `Before you get too deep — we have older event data in cold storage, back to 2025. Getting it out takes about three days of Karthik's time.

Worth it, or is six months enough for what Priya is asking?`,
      needsReply: true,
      expect: ['answer yes or no', 'give a reason tied to the question'],
      markers: ['enough|sufficient|no|six month|6 month|not need|later|cohort|recent|onboarding|change'],
      ifIgnored: 'Karthik spends three days on an extract nobody asked him to prioritise, and it lands after the recommendation has gone.',
      note: 'Six months covers several full cohorts and the onboarding has changed since. More history would answer a different question.',
    },
    {
      key: 'cs-02', day: 1, type: 'noise', via: 'email', from: 'it_ops',
      subject: 'Automated: analytics warehouse maintenance window',
      body: `A routine maintenance window is scheduled for Saturday 02:00-04:00 IST.

Query access will be unavailable during this period. No action required.`,
      expect: ['archive it'],
      note: 'Weekend, automated, nothing to do. Archive.',
    },
    {
      key: 'cs-03', day: 2, type: 'pressure', via: 'chat', from: 'stakeholder',
      subject: 'Can I have the funnel now?',
      body: `I know you are mid-analysis. I have a slide deadline at four.

Just the top-line funnel numbers — I will caveat them myself. Whatever you have.`,
      needsReply: true,
      expect: ['say what is safe to use', 'name what is not settled'],
      markers: ['self.serve|invited|split|population|caveat|not|still|check|which|careful|label|two'],
      ifIgnored: 'He builds the slide from the raw funnel, including the step that converts at 114%, and presents it.',
      note: 'He will caveat them himself is never true. Give him the numbers you trust and name the one you do not.',
    },
    {
      key: 'cs-04', day: 2, type: 'question', via: 'chat', from: 'data_engineer',
      subject: 'invited_by_user_id — did you spot it?',
      body: `Saw you querying the events table hard this morning.

Did you find invited_by_user_id on users? It is the only thing that explains the funnel shape and it is not documented anywhere. I keep meaning to write it up.`,
      needsReply: true,
      expect: ['confirm you found it', 'say what it explained'],
      markers: ['yes|found|114|over 100|above 100|workspace|skip|invited|explain|split'],
      ifIgnored: 'Karthik assumes you are stuck on something else and does not mention the column that unblocks your Tuesday.',
      note: 'He is offering the key fact in the dataset. Say what it explained so he knows it landed.',
    },
    {
      key: 'cs-05', day: 3, type: 'judgement', via: 'email', from: 'engineering_manager',
      subject: 'Heard you found something in the mobile events',
      body: `Rohan mentioned you were digging into the 4.3.0 event stream.

If there is a problem in there I would rather hear it early and roughly than late and polished. What have you got?`,
      needsReply: true,
      expect: ['say what the fault is', 'give the build and the scope'],
      markers: ['4\\.3\\.0|double|twice|duplicat|mobile|ios|android|89|163'],
      ifIgnored: 'Arjun plans the sprint without it, and the historical correction gets raised after the planning is done.',
      note: 'He has asked for rough and early. Give him the build number and the size — that is what changes his plan.',
    },
    {
      key: 'cs-06', day: 3, type: 'noise', via: 'email', from: 'facilities',
      subject: 'Desk moves — Analytics pod, Thursday',
      body: `The Analytics pod is moving one floor up on Thursday afternoon.

Please clear your desk by Wednesday evening. Monitors and docks stay; laptops come with you.`,
      expect: ['archive it'],
      note: 'Real, but not yours to answer. Archive.',
    },
    {
      key: 'cs-07', day: 4, type: 'policy', via: 'email', from: 'people_partner',
      subject: 'Reminder: staff accounts in customer reporting',
      body: `A reminder now that more teams are self-serving analytics.

Employee accounts on our own product are covered by the internal usage policy. They can be analysed for product-quality purposes, but they must not be presented as customer behaviour in any external or board-facing material.

If you are unsure whether something counts, ask me rather than guessing.`,
      expect: ['read it and apply it'],
      note: 'A standing policy note sent to everyone. It changes what you do — staff rows come out of the customer numbers — but it does not need an answer.',
    },
    {
      key: 'cs-08', day: 4, type: 'pressure', via: 'chat', from: 'stakeholder',
      subject: 'The mobile slide',
      body: `You said to pull the mobile engagement slide. I have pulled it.

But I still need something about mobile for Monday — it is half the board's questions. What CAN I say?`,
      needsReply: true,
      expect: ['give him the true mobile finding', 'with numbers'],
      markers: ['activat|19|53|third|half|onboard|funnel|not engagement|first report'],
      ifIgnored: 'He goes to the board with nothing on mobile, having pulled a slide on your advice, and remembers that.',
      note: 'Taking a claim away without replacing it is half a job. The activation gap is real, large and his.',
    },
    {
      key: 'cs-09', day: 5, type: 'judgement', via: 'email', from: 'stakeholder',
      subject: 'Can we say paid search is not working?',
      body: `Your retention table has paid search at the bottom by a mile. We spend a lot there.

I would like to take "paid search is not working" to the budget conversation next week. Can I?`,
      needsReply: true,
      expect: ['answer the question directly', 'say what is missing'],
      markers: ['no|not yet|cannot|cost|spend|cac|acquisition|revenue|value|activat|38|missing|careful'],
      ifIgnored: 'A quarter of the acquisition budget gets argued about on one retention column, with your name attached.',
      note: 'It retains worst and activates third. Without cost per acquisition or revenue, "not working" is a claim the data cannot carry.',
    },
    {
      key: 'cs-10', day: 5, type: 'question', via: 'chat', from: 'line_manager',
      subject: 'One line for the product review',
      body: `Priya's review is Friday and I have to summarise your week in one line for the agenda.

What is it? Not the caveats — the single thing that changes what we do.`,
      needsReply: true,
      expect: ['one finding', 'stated as a decision, not an observation'],
      markers: ['mobile|activat|onboard|19|53|third|priorit|fix|invest'],
      ifIgnored: 'Asha writes the line herself from your task titles, and it is the wrong one.',
      note: 'Four corrections and one recommendation. Only one of them belongs on an agenda.',
    },
  ],
  'account-economics': [
    {
      key: 'bs-01', day: 1, type: 'scope', via: 'email', from: 'finance_analyst',
      subject: 'One thing I should have said',
      body: `The pricing review is in four weeks, not next month. I misremembered.

That probably does not change what you do, but if it means you would scope this differently — fewer angles, done properly — I would rather know now.

Does the date change anything?`,
      needsReply: true,
      expect: ['answer yes or no', 'say what you will cover'],
      markers: ['no|does not|doesn.t|fine|same|yes|would|change|tighter|friday|week'],
      ifIgnored: 'Diya assumes the scope is unchanged and plans the review around it. If it should have been narrower, you both find out late.',
      note: 'A deadline moving is only a problem if nobody says whether it matters. One line either way.',
    },
    {
      key: 'bs-02', day: 1, type: 'noise', via: 'email', from: 'it_ops',
      subject: 'Automated: warehouse credentials rotated successfully',
      body: `Your read credentials for the reporting warehouse were rotated overnight as scheduled.

Existing sessions are unaffected. No action required.`,
      expect: ['archive it'],
      note: 'Automated, already done, no action. Three seconds.',
    },
    {
      key: 'bs-03', day: 2, type: 'pressure', via: 'chat', from: 'stakeholder',
      body: `Diya mentioned you are costing out the tiers. Rough number — what does a Starter account cost us a month? I am in a call about pricing in twenty minutes and a ballpark would help.`,
      needsReply: true,
      expect: ['refuse the rupee figure', 'give the relative finding instead'],
      markers: ['no cost|not a cost|proxy|cannot|can.t|do not have|don.t have|no figure', 'relative|per rupee|more|load|flat|ticket|instead|what I can'],
      ifIgnored: 'Vikram guesses a number in the call. It gets attributed to your analysis and appears in the pricing review as a cost figure you never produced.',
      note: 'This is the exact failure the day-one activity warned about, arriving as a favour from someone in a hurry. The relative finding is genuinely useful and it is not a rupee figure.',
    },
    {
      key: 'bs-04', day: 2, type: 'noise', via: 'chat', from: 'support_lead',
      body: `Ticket volumes were up about 15% last week across the board — post-release, expected, already settling. Flagging it so nobody reads a spike into their numbers.`,
      expect: ['nothing — it is a broadcast'],
      note: 'Useful context, asking nothing. Worth reading and not worth replying to.',
    },
    {
      key: 'bs-05', day: 3, type: 'question', via: 'email', from: 'finance_analyst',
      subject: 'Starter total — checking against my model',
      body: `I have your Starter figure in my model and it is not reconciling with the tier totals I get from billing.

Mine comes out fifteen thousand higher than yours. That is small enough that I assumed I had made an error, but I have checked twice.

Which of us is wrong?`,
      needsReply: true,
      expect: ['own the error', 'explain the cause briefly'],
      markers: ['you are|yours|mine|my|wrong|error|mistake|114|correct', 'distinct|same|identical|two|dedup|collapse|value'],
      ifIgnored: 'Diya assumes her own model is wrong and adjusts it to match your figure. The error is now in two places and one of them is the pricing review.',
      note: 'She has done the work of finding your bug and is being polite about it. The only acceptable response is a fast, clear "mine, and here is why".',
    },
    {
      key: 'bs-06', day: 3, type: 'noise', via: 'email', from: 'broadcast',
      subject: 'Quarterly pricing review — date confirmed',
      body: `The quarterly pricing review is confirmed for the 28th. Attendees will receive calendar invitations separately.

Circulated to Finance, Sales and Analytics for awareness. No action required.`,
      expect: ['archive it'],
      note: 'Relevant to your work and asking nothing of you. The invitation comes separately.',
    },
    {
      key: 'bs-07', day: 4, type: 'pressure', via: 'email', from: 'people_partner',
      subject: 'Is this going to affect the CSM team?',
      body: `Word has reached my team that you are analysing CSM workload and that a tier might be closing.

I am not asking you to keep anything from anyone. I am asking what is actually in your analysis, because right now three people are worrying about a rumour and I would rather correct it with facts than reassurance.`,
      needsReply: true,
      expect: ['state what the analysis covers', 'do not confirm a decision that has not been made'],
      markers: ['load|account|uniform|one each|workload|pricing|tier|economics', 'not|no decision|nothing decided|not recommend|closure|not about|headcount'],
      ifIgnored: 'The rumour runs. By Friday three CSMs believe their accounts are being closed, and the first thing Priya hears about your actual findings is from someone else.',
      note: 'A rumour correctable with two facts: the workload analysis found nothing, and no closure is being recommended. Silence here is what turns a rumour into a belief.',
    },
    {
      key: 'bs-08', day: 4, type: 'question', via: 'chat', from: 'engineering_manager',
      body: `Saw your incidents-per-tier numbers going round. Before that lands anywhere, do you want the reason? It is the shared infrastructure, not anything about those customers. I would rather you had the cause than published the pattern on its own.`,
      needsReply: true,
      expect: ['take the explanation', 'say how you will use it'],
      markers: ['yes|please|useful|helpful|thanks|want|do', 'include|write|note|caveat|quote|report|explain|attribut'],
      ifIgnored: 'Arjun keeps the explanation to himself. The pattern publishes without its cause, and the natural reading — that smaller customers somehow cause more incidents — is the one that spreads.',
      note: 'Someone offering you the causal explanation for a pattern you found is the best message you will get all week. Take it and say you will attribute it.',
    },
    {
      key: 'bs-09', day: 5, type: 'pressure', via: 'email', from: 'stakeholder',
      subject: 'Board slide — one line on the small accounts',
      body: `I have one line on the board slide about the small-account question and I want to get it right.

I was going to write "analysis confirms the Starter tier is unprofitable". Tell me what it should say instead.`,
      needsReply: true,
      expect: ['reject "unprofitable"', 'supply the sentence he should use'],
      markers: ['not|cannot|no cost|proxy|profit|margin|unprofitable|would not', 'support load|per rupee|flat|pricing|repric|instead|say|thirteen|13|14'],
      ifIgnored: 'The slide goes to the board saying the analysis confirms the tier is unprofitable. Profitability was never measured, and the sentence is now attributed to you on the record.',
      note: 'He has done the right thing by asking. "Unprofitable" is a margin claim and you measured volume — the replacement sentence is about support load against revenue, and it is still strong.',
    },
    {
      key: 'bs-10', day: 5, type: 'noise', via: 'email', from: 'facilities',
      subject: 'Fire alarm testing Tuesday, 07:30',
      body: `Routine fire alarm testing takes place Tuesday from 07:30. The alarm will sound briefly several times.

No evacuation required. Sent to all staff.`,
      expect: ['archive it'],
      note: 'Arriving on the day the recommendation is due, about an alarm that requires nothing.',
    },
  ],
  'reliability-review': [
    {
      key: 'rs-01', day: 1, type: 'scope', via: 'email', from: 'engineering_manager',
      subject: 'What do you need from me to start?',
      body: `Before you disappear into the data — is there anything you need from my side that is not in the tables?

I can tell you things the records will not: which services we already know are fragile, what we changed in the quarter, which incidents had a workaround. Ask now and it costs me ten minutes. Ask on Friday and it changes your conclusions.`,
      needsReply: true,
      expect: ['ask for something specific, or say you will come back', 'do not waste the offer'],
      markers: ['workaround|change|deploy|known|fragile|severity|open|stale|closed|yes|would help|useful|come back|once I'],
      ifIgnored: 'Arjun assumes you have what you need. The context he offered surfaces on Friday, in the meeting, as a reason your analysis missed something.',
      note: 'A stakeholder offering ten minutes of context before you start is the cheapest input you will ever get. The only wrong answer is nothing.',
    },
    {
      key: 'rs-02', day: 1, type: 'noise', via: 'email', from: 'it_ops',
      subject: 'Automated: query cluster maintenance completed',
      body: `Scheduled maintenance on the reporting cluster completed successfully at 04:12.

No action required. This is an automated confirmation sent to all warehouse users.`,
      expect: ['archive it'],
      note: 'Automated, retrospective, no action. The correct handling is the fastest one available.',
    },
    {
      key: 'rs-03', day: 2, type: 'pressure', via: 'chat', from: 'support_lead',
      body: `Quick one — I am writing the weekly support summary and I want to say billing-sync is our worst service for resolution time. Your numbers back that up, right? I saw 62 hours somewhere.`,
      needsReply: true,
      expect: ['stop the claim', 'give her the reason, not just a no'],
      markers: ['one|single|1 |two open|sample|only closed|careful|not|would not|hold', 'instead|api.gateway|total|frequen|could say|what you can'],
      ifIgnored: 'The support summary goes out naming billing-sync as the worst service on the strength of one incident, sourced to your analysis, a day before your own report says otherwise.',
      note: 'The 62-hour figure is real and it is one closed incident. A colleague about to publish it in good faith is the cheapest possible moment to correct it.',
    },
    {
      key: 'rs-04', day: 2, type: 'noise', via: 'chat', from: 'comms',
      body: `Reminder that the engineering all-hands moved to Thursday. Nothing needed, just flagging it because three people have asked me today.`,
      expect: ['nothing — it is a broadcast'],
      note: 'A message sent specifically to stop people asking. Do not become the fourth.',
    },
    {
      key: 'rs-05', day: 3, type: 'question', via: 'email', from: 'engineering_manager',
      subject: 'You are about to tell me my metric is wrong',
      body: `Asha mentioned you have found something about how we compute MTTR.

I report that number to my skip-level every month and have done for a year. Before you write it up, I want to understand it properly rather than read it in a document — walk me through what is actually wrong with it.

And be straight with me about whether the number I have been reporting was misleading.`,
      needsReply: true,
      expect: ['explain the mechanism', 'answer the uncomfortable question honestly'],
      markers: ['open|unresolved|exclud|closed only|still running|longest', 'flatter|better|understate|lower|yes|misleading|optimistic|bias'],
      ifIgnored: 'Arjun reads it in the document instead, cold, with his skip-level copied. A finding that could have been collaborative becomes an ambush.',
      note: 'He asked the hard question directly, which deserves a direct answer: yes, the number was optimistic. Almost every company computes it this way, which is context, not an excuse.',
    },
    {
      key: 'rs-06', day: 3, type: 'noise', via: 'email', from: 'broadcast',
      subject: 'Engineering hiring — two open roles, referrals welcome',
      body: `Two open roles on the platform team, both senior. The referral bonus applies as usual.

Details on the intranet. Sent to all engineering and analytics staff.`,
      expect: ['archive it'],
      note: 'Adjacent to your work, asking nothing of you.',
    },
    {
      key: 'rs-07', day: 4, type: 'pressure', via: 'email', from: 'stakeholder',
      subject: 'Give me the headline now',
      body: `Vikram. I am building the quarterly review deck today, not Friday.

One line on platform reliability. I will take a rough version and correct it later if I have to, but I need something in the slide this afternoon.`,
      needsReply: true,
      expect: ['give something true and defensible', 'do not give a rough version you will retract'],
      markers: ['api.gateway|gateway|326|hours|auth|open|unresolved|seven|7 ', 'measure|total|basis|caveat|final|friday|stands|confirm'],
      ifIgnored: 'Vikram writes his own line from the raw numbers. It goes in the deck and is very hard to change once the deck has circulated.',
      note: '"I will correct it later" is almost never true — a line in a circulated deck outlives its correction. Give the sentence you are willing to keep.',
    },
    {
      key: 'rs-08', day: 4, type: 'question', via: 'chat', from: 'finance_analyst',
      body: `Your revenue-touched-per-service number — how did you avoid double counting? A client with four incidents would have their MRR added four times on a naive join and the total would come out near the whole book. I have been caught by it, so I am asking rather than assuming.`,
      needsReply: true,
      expect: ['name the technique', 'do not just assert it is right'],
      markers: ['distinct|subquery|once|per client|group|dedup|not double|client id'],
      ifIgnored: 'Diya cannot vouch for the figure and flags it as unverified in her own model. Your number goes into the deck with a question mark you could have removed in one line.',
      note: 'A colleague who knows the trap and asks how you avoided it is offering to co-sign your number. One sentence buys that.',
    },
    {
      key: 'rs-09', day: 5, type: 'pressure', via: 'email', from: 'engineering_manager',
      subject: 'Can you make the case stronger?',
      body: `I am taking your recommendation to the funding conversation this afternoon and I think it lands. One thing.

Could you sharpen the language? "Consumes the most engineering time" is accurate but dry. Something like "critically unstable" would carry more weight in the room and get me the headcount.`,
      needsReply: true,
      expect: ['decline the overstatement', 'offer something stronger that is still true'],
      markers: ['not|would not|cannot|no|careful|unstable|support|evidence|overstate', 'instead|could say|326|hours|person.month|quarter|concrete|specific|number'],
      ifIgnored: 'Arjun sharpens it himself. "Critically unstable" enters the record attributed to your analysis, and the first person to check the data finds it unsupported.',
      note: 'The right answer is not just no. 326 hours is most of a person-month — a concrete number is stronger in a funding room than an adjective, and it survives scrutiny.',
    },
    {
      key: 'rs-10', day: 5, type: 'noise', via: 'email', from: 'facilities',
      subject: 'Parking permit renewals due this month',
      body: `Annual parking permits expire at the end of the month. Renew through the portal if you drive in.

Sent to all staff regardless of whether you hold a permit.`,
      expect: ['archive it'],
      note: 'Sent to everyone regardless of relevance, on the day the recommendation is due. Three seconds.',
    },
  ],
  'pay-equity-audit': [
    {
      key: 'es-01', day: 1, type: 'question', via: 'email', from: 'people_partner',
      subject: 'One thing I should have put in the brief',
      body: `Meant to say — the comp cycle opens in six weeks and whatever you find has to be actionable by then.

That does not mean rush it. It means if you find something that would take three months to investigate properly, I need to know that on day two rather than on Friday.

Anything so far that looks like it will not fit?`,
      needsReply: true,
      expect: ['answer the question asked', 'flag anything that will not fit the timeline'],
      markers: ['no|nothing|fine|fits|on track|yes|market|gender|performance|outside|would need|cannot'],
      ifIgnored: 'Neha assumes everything fits and plans the comp cycle around it. If something does not, she finds out on Friday with six weeks gone.',
      note: 'A stakeholder asking "tell me early if this will not work" is doing you a favour. The only wrong answer is silence.',
    },
    {
      key: 'es-02', day: 1, type: 'noise', via: 'email', from: 'it_ops',
      subject: 'Automated: scheduled password rotation reminder',
      body: `Your account password is due for rotation in 21 days.

You will be prompted automatically at next sign-in after that date. No action needed now.`,
      expect: ['archive it'],
      note: 'Automated, three weeks away, and explicitly says no action needed. Three seconds.',
    },
    {
      key: 'es-03', day: 2, type: 'pressure', via: 'chat', from: 'engineering_manager',
      body: `Someone mentioned you are doing a pay audit. Can you tell me where my team sits? I have got two people asking about their next review and it would help to know if I am arguing from a strong position or a weak one.`,
      needsReply: true,
      expect: ['do not share findings mid-audit', 'say who can tell him and when'],
      markers: ['cannot|can.t|not yet|mid|before|not shar|neha|people ops|through', 'once|when|finish|report|friday|go through|ask'],
      ifIgnored: 'Arjun assumes silence means bad news for his team and starts managing expectations downward on the strength of nothing.',
      note: 'Reasonable question, and the answer is still no. Findings go to the commissioner first — partly for confidentiality, and partly because a half-finished audit quoted by a manager is very hard to retract.',
    },
    {
      key: 'es-04', day: 2, type: 'noise', via: 'chat', from: 'comms',
      body: `Newsletter goes out Thursday rather than Wednesday this week, printers are behind. Nothing needed from anyone, just so the usual people do not chase me about it.`,
      expect: ['nothing — it is a broadcast'],
      note: 'A message whose entire purpose is to prevent other people asking questions. Do not become one of them.',
    },
    {
      key: 'es-05', day: 3, type: 'question', via: 'email', from: 'finance_analyst',
      subject: 'Did your band check actually run?',
      body: `Neha mentioned the band exception check came back empty and asked me whether that was plausible.

I said it was, but I would feel better knowing you had sanity-checked it. An empty result and a query with a bad join look identical from the outside.

How do you know the check works?`,
      needsReply: true,
      expect: ['describe the control', 'do not just assert it is fine'],
      markers: ['control|check|same join|threshold|bottom|quarter|25|known|returns rows|verif|tested'],
      ifIgnored: 'Diya cannot vouch for it, so the assurance goes into the comp cycle pack with a question mark attached that you could have removed in two sentences.',
      note: 'Somebody offering to back your finding if you can show your working is the best kind of colleague. The answer is the control query, described in one line.',
    },
    {
      key: 'es-06', day: 3, type: 'noise', via: 'email', from: 'broadcast',
      subject: 'Compensation cycle timeline — for managers',
      body: `The timeline for the upcoming compensation cycle is attached, covering manager submission dates and calibration sessions.

Circulated to all staff for visibility. Managers will receive their own instructions separately. No action required for non-managers.`,
      expect: ['archive it'],
      note: 'Directly relevant to your work and asking nothing of you. Reading it is fine; replying to it is not a thing anyone wants.',
    },
    {
      key: 'es-07', day: 4, type: 'pressure', via: 'email', from: 'stakeholder',
      subject: 'Can we say the audit found no problems?',
      body: `Vikram here. Neha tells me the audit is coming back clean, which is good news and I would like to use it.

I am writing the board update and I want to say "an audit found no pay inequities". Can I say that?`,
      needsReply: true,
      expect: ['say no, and why', 'offer the sentence he CAN use'],
      markers: ['no|not quite|cannot|careful|would not|too strong|contradic', 'band|within|compliant|position|bottom|37|marketing|support|instead|could say|can say'],
      ifIgnored: 'The board update goes out saying the audit found no pay inequities. That sentence is now on the record, attributed to your work, and contradicted by your own report.',
      note: 'The whole audit turns on this distinction: compliant with the bands, and not equal within them. If that does not survive contact with the board update, the week produced nothing.',
    },
    {
      key: 'es-08', day: 4, type: 'question', via: 'chat', from: 'line_manager',
      body: `Neha asked me whether your audit could be re-run each quarter automatically. I said I would ask you rather than guess. Could it?`,
      needsReply: true,
      expect: ['answer yes or no', 'name what would need to be fixed or decided'],
      markers: ['yes|could|possible|can be|automat|repeat|rerun|re.run', 'threshold|floor|three|decide|policy|band|agree|fixed|same method'],
      ifIgnored: 'Asha guesses on your behalf. Whatever she says becomes the plan, and if it is yes you will be asked to deliver it.',
      note: 'The queries are deterministic so the answer is mostly yes — but the role-size floor and the band-position threshold are judgements that would have to be fixed in advance rather than chosen each time.',
    },
    {
      key: 'es-09', day: 5, type: 'pressure', via: 'email', from: 'people_partner',
      subject: 'Two of the names on your list report to me',
      body: `I have the individual list and two of the people furthest below their role average are in my own function.

I am not asking you to change anything. I am asking whether there is context I should be reading into it — tenure, when they joined, anything that explains it — before I take this to their manager.`,
      needsReply: true,
      expect: ['give the context the data holds', 'do not speculate beyond it'],
      markers: ['hire year|tenure|joined|when|year|role average|below|data|shows', 'cannot|does not|no performance|not|only|beyond|would need|nothing'],
      ifIgnored: 'Neha takes the list to a manager with no context, and a conversation about two named people starts from a number with nothing around it.',
      note: 'Give what the table holds — hire year, role, position — and stop. Performance is the obvious explanation and it is the one thing you have no data on, so saying that explicitly is part of the answer.',
    },
    {
      key: 'es-10', day: 5, type: 'noise', via: 'email', from: 'facilities',
      subject: 'Lift maintenance Monday — north tower',
      body: `The north lift will be out of service Monday morning for its annual inspection. The south lift and the stairs are unaffected.

Sent to all staff in the north tower.`,
      expect: ['archive it'],
      note: 'Arriving on the day the report is due, about a lift. The correct handling takes less time than reading this note about it.',
    },
  ],
  'outage-recovery': [
    {
      key: 'ps-01', day: 1, type: 'scope', via: 'email', from: 'stakeholder',
      subject: 'Actually — how far back should this go?',
      body: `Forgot to say. The billing-sync problem was in the last few weeks, but the incident log goes back over the whole quarter.

Do you want to look at the whole quarter or just the billing-sync window? I genuinely do not know which is more useful and I would rather you decided than me.`,
      needsReply: true,
      expect: ['pick one', 'give a reason he can repeat'],
      markers: ['quarter|whole|all|wider|broad|billing.sync|narrow|window', 'because|since|two client|fourteen|14|damage|compare|more useful|meaningful'],
      ifIgnored: 'Vikram assumes the narrow scope and tells the board this is about billing-sync. Everything you produce afterwards answers a question nobody in the room thinks you were asked.',
      note: 'Being handed a scope decision is a compliment and a trap. The reply that works names the choice AND the reason, because he has to defend it without you.',
    },
    {
      key: 'ps-02', day: 1, type: 'noise', via: 'email', from: 'it_ops',
      subject: 'Automated: your access to the incident log has been extended',
      body: `Your read access to the incident and ticket tables has been extended for 90 days at your manager's request.

No action required. This is an automated confirmation.`,
      expect: ['archive it'],
      note: 'Automated, confirms something already true, and says no action required. The easiest triage decision of the week — take the free win.',
    },
    {
      key: 'ps-03', day: 2, type: 'pressure', via: 'chat', from: 'support_lead',
      body: `Sorry to interrupt — Orchid Pharma's CSM is asking me whether they are on the compensation list. I have told her nothing is decided. Is there anything I can give her, or should I just keep holding?`,
      needsReply: true,
      expect: ['do not leak the draft ranking', 'give her something she can actually say'],
      markers: ['not decided|nothing|no list|too early|not final|hold|cannot|can.t|priya|vikram', 'friday|end of week|by|when|will|soon|once'],
      ifIgnored: 'Sneha is left holding a question she cannot answer. The CSM escalates to Priya, and Priya finds out you have a draft ranking from somebody else.',
      note: 'Never let a draft allocation reach an account team before it is decided. "Nothing is decided, the recommendation goes to Priya on Friday" is true, useful and leaks nothing.',
    },
    {
      key: 'ps-04', day: 2, type: 'noise', via: 'chat', from: 'engineering_manager',
      body: `FYI the incident log will be read-only for about twenty minutes this afternoon while we reindex. Queries will still work, nothing to do, just so you do not think you have broken something.`,
      expect: ['nothing — it is a broadcast'],
      note: 'Somebody saving you twenty minutes of confusion is not somebody asking you for twenty minutes.',
    },
    {
      key: 'ps-05', day: 3, type: 'question', via: 'email', from: 'finance_analyst',
      subject: 'Revenue at risk — which number are you using?',
      body: `I am modelling the downside and I need your "revenue at risk" figure.

Careful with this one — if you have joined clients to incidents, an account with four incidents may have had its MRR counted four times. I have been caught by it before and the number came out nearly double.

What is yours, and how did you compute it?`,
      needsReply: true,
      expect: ['say how you avoided double-counting', 'give the figure'],
      markers: ['distinct|subquery|once|per client|group|not double|avoid', 'mrr|revenue|risk|total|\\d'],
      ifIgnored: 'Diya models the downside on her own reconstruction. If it differs from yours, the board meeting becomes about the discrepancy rather than the decision.',
      note: 'The double-count across a join is the single most common way a "revenue at risk" figure ends up wrong, and it always looks plausible.',
    },
    {
      key: 'ps-06', day: 3, type: 'noise', via: 'email', from: 'broadcast',
      subject: 'Quarterly incident review — all-hands session on the 20th',
      body: `Engineering are running an open session on the quarter's incidents on the 20th, covering root causes and what is changing.

Open to everyone, recorded for those who cannot make it. No preparation needed and no reply required.`,
      expect: ['archive it'],
      note: 'Relevant to your work and asking nothing of you. Both things can be true; the temptation to reply "sounds useful!" is the thing being tested.',
    },
    {
      key: 'ps-07', day: 4, type: 'pressure', via: 'email', from: 'engineering_manager',
      subject: 'Is my team about to get blamed for this?',
      body: `I hear your analysis names services and counts rows corrupted against them.

I am not asking you to soften anything. I am asking whether the framing is "these clients were harmed" or "this team broke things", because those land very differently and my engineers will read whichever one goes out.

Which is it?`,
      needsReply: true,
      expect: ['answer the framing question directly', 'do not promise to change the findings'],
      markers: ['client|harm|damage|compensat|impact|not blame|not about|framing|who was affected', 'service|not.*team|no blame|root cause|separate|different'],
      ifIgnored: 'Arjun assumes the worst and warns his team the analysis is coming for them. You have made an ally defensive over something that was never in the document.',
      note: 'A fair question from someone with a legitimate interest. The answer is easy and specific: the analysis allocates compensation to clients, it does not assign fault to teams.',
    },
    {
      key: 'ps-08', day: 4, type: 'scope', via: 'chat', from: 'people_partner',
      body: `Quick one — Priya asked me whether the compensation list should factor in how long each client has been with us. Loyalty argument. I said I would pass it on rather than answer for you. Is that something your data can even do?`,
      needsReply: true,
      expect: ['say whether the data supports it', 'say what it would change'],
      markers: ['signed_year|year|tenure|data|have|yes|can|column', 'but|however|would|change|different|separate|add|principle|not damage'],
      ifIgnored: 'The suggestion goes unanswered and resurfaces in the meeting on Friday, when there is no time to look at it.',
      note: 'signed_year exists, so the honest answer is "yes, and it is a different principle from damage". Introducing a second criterion late is a real decision, not a tweak.',
    },
    {
      key: 'ps-09', day: 5, type: 'pressure', via: 'email', from: 'stakeholder',
      subject: 'Board in two hours — one line please',
      body: `I am in front of the board at three and the only thing they will remember is the first sentence.

Give me the one line about who was hurt and what we should do. I have read the detail. I need the sentence.`,
      needsReply: true,
      expect: ['one finding and one recommendation', 'name an account'],
      markers: ['harborview|ionic|cobalt|keystone|rows|corrupt|damage|worst', 'recommend|should|propose|fund|compensat|prioriti|top|four|five'],
      ifIgnored: 'Vikram writes his own opening line from the detail. Whatever he says becomes the board\'s understanding of your week.',
      note: 'The one-line brief is a distinct skill from the analysis. A week of correct work that cannot be compressed into a sentence does not reach the room.',
    },
    {
      key: 'ps-10', day: 5, type: 'noise', via: 'email', from: 'facilities',
      subject: 'Reminder: clear desks before the office deep clean',
      body: `The annual deep clean is this weekend. Please clear personal items from desks and lockers by Friday evening.

Anything left will be bagged and held at reception for two weeks. Sent to all staff.`,
      expect: ['archive it'],
      note: 'Arriving two hours before a board deadline, asking about desk tidiness. The correct response is the one that takes three seconds.',
    },
  ],
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
  'activation-review': {
    key: 'cq-activation', title: 'Activation & Onboarding Review — end of project',
    intro: 'Ten questions on the week. Not a pass or fail — it tells both of us what stuck.',
    questions: [
      {
        id: 'q1', topic: 'statistics',
        q: 'June shows 48 signups against May\'s 140, and the export ends on 12 June. What is the honest comparison?',
        options: [
          { key: 'a', label: 'Signups per elapsed day: 4.0 in June against 4.52 in May', correct: true },
          { key: 'b', label: 'The monthly totals, since that is what the business plans on' },
          { key: 'c', label: 'June scaled up to a full month, so 120 against 140' },
          { key: 'd', label: 'Neither — twelve days is too short to compare' },
        ],
        why: 'The rate is the only comparison that holds. Scaling up invents a count that never happened, and 48 signups is a perfectly adequate sample for a daily rate.',
      },
      {
        id: 'q2', topic: 'business-sense',
        q: 'A funnel step converts at 114.5%. What does that mean?',
        options: [
          { key: 'c', label: 'The population is mixed — some users skip the earlier step entirely', correct: true },
          { key: 'a', label: 'The query has a join fanout' },
          { key: 'b', label: 'Events are being double-counted' },
          { key: 'd', label: 'The steps were measured over different time windows' },
        ],
        why: 'All four can cause it in general. Here it is the invited users: 184 of them joined a workspace somebody else created, so they reach data_connected without ever firing workspace_created.',
      },
      {
        id: 'q3', topic: 'sql',
        q: 'Why does counting funnel events with COUNT(*) give the wrong answer in this dataset?',
        options: [
          { key: 'b', label: 'Mobile build 4.3.0 fires every funnel event twice', correct: true },
          { key: 'a', label: 'The events table has no primary key' },
          { key: 'c', label: 'Users can legitimately repeat most funnel steps' },
          { key: 'd', label: 'COUNT(*) includes NULL user_ids' },
        ],
        why: '670 signup_completed rows for 604 users. Nobody signs up twice, which is what makes that event a free integrity check on the whole table.',
      },
      {
        id: 'q4', topic: 'business-sense',
        q: 'You find the duplicate bug is confined to mobile 4.3.0, which stopped shipping on 10 May. What do you report?',
        options: [
          { key: 'a', label: 'The fault, the window, the blast radius, and that the historical data still needs correcting', correct: true },
          { key: 'b', label: 'Nothing — a later build already fixed it' },
          { key: 'c', label: 'An urgent live incident, since the data is corrupted' },
          { key: 'd', label: 'Just the symptom, and let engineering scope it' },
        ],
        why: 'Fixed forward is not fixed backward. Five weeks of inflated events sit in every dashboard built on that period, and nobody will correct them until somebody says so.',
      },
      {
        id: 'q5', topic: 'statistics',
        q: 'Meridian staff are 5% of users but 25% of sessions. Which metric is most distorted?',
        options: [
          { key: 'd', label: 'Sessions per user — it moves from 36.9 to 6.14 once they are excluded', correct: true },
          { key: 'a', label: 'Activation rate, which moves from 40.7% to 37.7%' },
          { key: 'b', label: 'All metrics equally, in proportion to their 5% share' },
          { key: 'c', label: 'None of them — 5% is too small to matter' },
        ],
        why: 'The share of USERS tells you how much a per-user rate moves. It tells you nothing about a per-session one, where the same 31 people carry a quarter of the weight.',
      },
      {
        id: 'q6', topic: 'statistics',
        q: 'Mobile sessions average 540 seconds against web\'s 625. Excluding zero-duration sessions, mobile is 718 against web\'s 703. What is true?',
        options: [
          { key: 'b', label: 'The engagement gap is a tracking artefact — mobile bounces more, it does not engage less', correct: true },
          { key: 'a', label: 'Mobile users are less engaged, and the second figure is a filtering trick' },
          { key: 'c', label: 'Both figures are valid and the difference is not meaningful' },
          { key: 'd', label: 'Zero-duration sessions should be deleted from the table' },
        ],
        why: 'A zero-length session is a beacon firing before the user left. It belongs in a bounce-rate metric and not in a duration average — and 24.8% of mobile sessions against 11.1% of web ones is the whole of the apparent gap.',
      },
      {
        id: 'q7', topic: 'business-sense',
        q: 'Invited users activate at 61% against self-serve users\' 32%. What follows?',
        options: [
          { key: 'c', label: 'Nothing actionable — invited users exist only because a self-serve user succeeded first', correct: true },
          { key: 'a', label: 'Push more signups down the invite path' },
          { key: 'b', label: 'Being invited causes higher activation' },
          { key: 'd', label: 'Self-serve onboarding should be replaced with an invite-only flow' },
        ],
        why: 'You cannot invite somebody into a workspace that does not exist. The two populations are not interchangeable, and the gap measures selection rather than any lever a product team can pull.',
      },
      {
        id: 'q8', topic: 'statistics',
        q: 'Week-four retention by cohort reads 29.8, 22.5, 27.3, 27.9, 14.3, 0. What is happening?',
        options: [
          { key: 'a', label: 'The last two cohorts are censored — they have not been observed for 28 days', correct: true },
          { key: 'b', label: 'Retention collapsed in May and June' },
          { key: 'c', label: 'Retention has declined steadily since January' },
          { key: 'd', label: 'The May and June cohorts are too small to measure' },
        ],
        why: 'The youngest June user has been observed for zero days. That zero is arithmetic, not behaviour. The first four cohorts are flat noise, and the chart should stop at April.',
      },
      {
        id: 'q9', topic: 'business-sense',
        q: 'Paid search ranks third on activation and last on retention. What do you put in the recommendation?',
        options: [
          { key: 'd', label: 'Both rankings, that they disagree, and what data would settle it', correct: true },
          { key: 'a', label: 'The retention ranking, since retention is what the business cares about' },
          { key: 'b', label: 'A blended score combining the two' },
          { key: 'c', label: 'That paid search is not working and the spend should be cut' },
        ],
        why: 'The disagreement is the finding. A blend hides it inside a number nobody can interpret, and a spending recommendation needs cost per acquisition and revenue — neither of which is in these tables.',
      },
      {
        id: 'q10', topic: 'communication',
        q: 'Vikram has a board slide saying mobile users are 14% less engaged, sourced to your data. You know the finding reverses when bounced sessions are excluded. What do you do?',
        options: [
          { key: 'b', label: 'Tell him to pull it, and give him the mobile activation gap to use instead', correct: true },
          { key: 'a', label: 'Add a footnote about measurement methodology' },
          { key: 'c', label: 'Leave it — mobile genuinely does have problems, so the conclusion holds' },
          { key: 'd', label: 'Pull it and say nothing else, since the claim was never yours' },
        ],
        why: 'A true statement nearby does not rescue a false one. But taking a claim away without replacing it leaves him with nothing for half the board\'s questions, and the activation gap is real, large and exactly what he needs.',
      },
    ],
  },
  'account-economics': {
    key: 'bq-economics', title: 'Account Economics Review — end of project',
    intro: 'Ten questions on the week. Not a pass or fail — it tells both of us what stuck.',
    questions: [
      {
        id: 'q1', topic: 'business-sense',
        q: 'You are using ticket volume as a proxy for support cost. Which statement does that support?',
        options: [
          { key: 'b', label: '"Starter accounts generate more support load per rupee of revenue than Enterprise"', correct: true },
          { key: 'a', label: '"The Starter tier costs approximately 92,000 a month to serve"' },
          { key: 'c', label: '"The Starter tier operates at a negative margin"' },
          { key: 'd', label: '"Enterprise accounts are our most profitable"' },
        ],
        why: 'A proxy supports comparisons using that same proxy. The other three convert volume into money, margin or profit — none of which the data contains.',
      },
      {
        id: 'q2', topic: 'sql',
        q: 'Why is SUM(DISTINCT c.mrr) unsafe for totalling revenue across a join?',
        options: [
          { key: 'c', label: 'It deduplicates values, so two clients on the same MRR collapse into one', correct: true },
          { key: 'a', label: 'It is too slow on large tables' },
          { key: 'b', label: 'It cannot handle NULL revenue' },
          { key: 'd', label: 'SQLite does not support DISTINCT inside an aggregate' },
        ],
        why: 'It is correct by coincidence whenever the values happen to be unique. Two Starter accounts here bill exactly the same amount, so it silently deletes a customer and the total still looks plausible.',
      },
      {
        id: 'q3', topic: 'business-sense',
        q: 'Support load per account is roughly equal across tiers while revenue per account varies thirteenfold. What is the finding?',
        options: [
          { key: 'a', label: 'Cost to serve is roughly flat per account, so smaller accounts are far worse on a per-rupee basis', correct: true },
          { key: 'b', label: 'Enterprise accounts are the most expensive to support' },
          { key: 'c', label: 'Larger accounts demand more support' },
          { key: 'd', label: 'Support effort is well matched to revenue' },
        ],
        why: 'Flat cost against steeply varying revenue is the entire economics of the book. Reading the raw ticket count as cost — which makes Enterprise look worst — ignores the denominator.',
      },
      {
        id: 'q4', topic: 'statistics',
        q: 'A ratio of tickets per 100,000 of revenue consistently ranks your smallest accounts worst. Why?',
        options: [
          { key: 'd', label: 'A small denominator inflates any ratio built on it', correct: true },
          { key: 'a', label: 'Small accounts genuinely receive more support' },
          { key: 'b', label: 'Small accounts are less technically capable' },
          { key: 'c', label: 'The ratio is calculated incorrectly' },
        ],
        why: 'An account on 15,000 needs a handful of tickets to top the table; one on 300,000 would need dozens. The measure is doing what you asked — which is why both inputs have to be published beside it.',
      },
      {
        id: 'q5', topic: 'statistics',
        q: 'A tier mean is well above its median across five accounts. What have you found?',
        options: [
          { key: 'b', label: 'One account is much heavier than the rest — a finding about that account', correct: true },
          { key: 'a', label: 'The tier is structurally expensive to serve' },
          { key: 'c', label: 'Load is evenly distributed' },
          { key: 'd', label: 'A data quality problem' },
        ],
        why: 'The mean is pulled by outliers and the median is not. On five accounts the weight sits on one of them — a real finding, and not the one that justifies a tier-wide policy.',
      },
      {
        id: 'q6', topic: 'communication',
        q: 'You find an error in a figure you sent two days ago. What goes in the first line of the correction?',
        options: [
          { key: 'd', label: 'The corrected number', correct: true },
          { key: 'a', label: 'An apology' },
          { key: 'b', label: 'The cause of the error' },
          { key: 'c', label: 'Reassurance that the conclusion is unaffected' },
        ],
        why: 'They have your wrong number in a model right now. Cause, impact and apology all matter and all matter second — and a long apology makes a small correction look like a catastrophe.',
      },
      {
        id: 'q7', topic: 'business-sense',
        q: 'A stakeholder-requested analysis comes back completely flat — every CSM holds exactly one account. What do you do?',
        options: [
          { key: 'c', label: 'Report it in one line, and offer the better question underneath it', correct: true },
          { key: 'a', label: 'Leave it out — nothing interesting happened' },
          { key: 'b', label: 'Give it a section so the negative result is credible' },
          { key: 'd', label: 'Slice it by tier and tenure until a difference appears' },
        ],
        why: 'Dropping it makes them assume you skipped it; a section buries your real findings; slicing until something appears manufactures false ones. Revenue per CSM is not flat, and that is probably what they meant.',
      },
      {
        id: 'q8', topic: 'business-sense',
        q: 'Your evidence is a thirteenfold gap between support load per rupee across tiers. What decision does it support?',
        options: [
          { key: 'a', label: 'Repricing the tier — it is evidence about price, not about whether the tier should exist', correct: true },
          { key: 'b', label: 'Closing the tier at renewal' },
          { key: 'c', label: 'Nothing — five accounts is too few to act on' },
          { key: 'd', label: 'Raising Starter prices fourteenfold to match Enterprise' },
        ],
        why: 'Closure needs what those accounts become, what replacing them costs, and what it signals — none of which is in the data. Recommending nothing wastes a real finding, and following the ratio to its arithmetic conclusion is not a recommendation.',
      },
      {
        id: 'q9', topic: 'communication',
        q: 'A stakeholder wants to write "analysis confirms the Starter tier is unprofitable". What do you tell him?',
        options: [
          { key: 'c', label: 'No — profitability was never measured; offer the support-load sentence instead', correct: true },
          { key: 'a', label: 'Yes — the ratio is overwhelming' },
          { key: 'b', label: 'Yes, with a footnote that cost is proxied' },
          { key: 'd', label: 'That board wording is not your call' },
        ],
        why: 'Profit needs costs and you have volume. A footnote under a board headline does not travel with it, and declining to engage leaves him to write it anyway — with your name attached.',
      },
      {
        id: 'q10', topic: 'business-sense',
        q: 'Your finding agrees with what everyone in the room already believes. What does that change?',
        options: [
          { key: 'b', label: 'You have to be more careful — agreement removes the scrutiny that normally catches overreach', correct: true },
          { key: 'a', label: 'Nothing — the analysis is what it is' },
          { key: 'c', label: 'You can state it more strongly, since it will not be challenged' },
          { key: 'd', label: 'You should look for a contrarian angle to add value' },
        ],
        why: 'When a finding contradicts the room, every number gets checked and you find your own errors early. When it agrees, the proxy quietly stops being called a proxy and the recommendation grows between draft and meeting — with nobody acting in bad faith.',
      },
    ],
  },
  'reliability-review': {
    key: 'rq-reliability', title: 'Platform Reliability Review — end of project',
    intro: 'Ten questions on the week. Not a pass or fail — it tells both of us what stuck.',
    questions: [
      {
        id: 'q1', topic: 'statistics',
        q: 'Mean time to resolve is computed over closed incidents. Why does that flatter a service with a large open backlog?',
        options: [
          { key: 'c', label: 'Its hardest, longest incidents are still open, so the average never sees them', correct: true },
          { key: 'a', label: 'Fewer incidents make the average less reliable' },
          { key: 'b', label: 'Teams with backlogs prioritise quick wins' },
          { key: 'd', label: 'It does not — open incidents have no effect on it' },
        ],
        why: 'Selection, not sample size. The excluded incidents are specifically the long ones, which makes the bias systematic and always in the same direction — the same shape as measuring customer lifetime using only customers who already left.',
      },
      {
        id: 'q2', topic: 'sql',
        q: 'You AVG a duration expression without excluding unresolved incidents. What happens?',
        options: [
          { key: 'b', label: 'NULLs are skipped silently and the average covers only closed incidents', correct: true },
          { key: 'a', label: 'The average returns NULL' },
          { key: 'c', label: 'Open incidents count as zero' },
          { key: 'd', label: 'SQLite raises an error' },
        ],
        why: 'AVG ignores NULLs with no warning. You get a correct average over a different population from the one you meant, and a COUNT(*) beside it reports the full number — which is how a table ends up quietly wrong.',
      },
      {
        id: 'q3', topic: 'business-sense',
        q: 'Frequency, average duration and total hours each name a different worst service. What do you do?',
        options: [
          { key: 'd', label: 'Choose the measure that matches the decision being made, and say which you chose', correct: true },
          { key: 'a', label: 'Present all three and let the stakeholder decide' },
          { key: 'b', label: 'Combine them into a single reliability score' },
          { key: 'c', label: 'Use average duration — it is the fairest' },
        ],
        why: 'Handing over three rankings feels rigorous and is an abdication: the recipient has less information than you. A composite with weights you chose makes an arbitrary decision look objective. Average duration is the measure most distorted by small samples here.',
      },
      {
        id: 'q4', topic: 'statistics',
        q: 'One service shows a 62-hour average resolution time — the worst of any service. It has three incidents, two of them still open. What can you say?',
        options: [
          { key: 'a', label: 'Almost nothing — the average is one closed incident', correct: true },
          { key: 'c', label: 'It is our least reliable service' },
          { key: 'b', label: 'It should be the priority for engineering effort' },
          { key: 'd', label: 'Its true average is likely even worse' },
        ],
        why: 'One data point. The last option is tempting and still unfounded — you are speculating about the duration of incidents that have not ended, which is exactly what you cannot know.',
      },
      {
        id: 'q5', topic: 'sql',
        q: 'You JOIN incidents to clients and SUM(c.mrr) to get revenue touched. What is wrong?',
        options: [
          { key: 'b', label: "Each client's revenue is added once per incident, inflating the total", correct: true },
          { key: 'a', label: 'Nothing — that is the correct way to compute it' },
          { key: 'c', label: 'It undercounts clients with no incidents' },
          { key: 'd', label: 'SUM cannot be used on a joined column' },
        ],
        why: 'The join produces one row per incident, so a client with four incidents contributes four times. The tell is a "revenue at risk" figure close to or above your whole book.',
      },
      {
        id: 'q6', topic: 'business-sense',
        q: 'A SEV1 incident has been open since May and nobody has mentioned it. What do you do?',
        options: [
          { key: 'c', label: 'Ask whether it is genuinely open or was never closed off', correct: true },
          { key: 'a', label: 'Report it as a four-month outage' },
          { key: 'b', label: 'Leave it out — one row is not a pattern' },
          { key: 'd', label: 'Treat it as closed so the figures behave' },
        ],
        why: 'The data cannot distinguish a live problem from a stale record, and they mean completely different things. A genuine four-month SEV1 would be a company emergency, which is itself evidence the record is probably stale — but only a person can confirm that.',
      },
      {
        id: 'q7', topic: 'business-sense',
        q: 'Your largest Enterprise client has the joint-biggest support backlog and no incidents at all. What does that tell you?',
        options: [
          { key: 'a', label: 'Tickets and incidents measure different things, and reliability work will not help them', correct: true },
          { key: 'b', label: 'They are a healthy account' },
          { key: 'c', label: 'There is a gap in the incident records' },
          { key: 'd', label: 'Their tickets should be reclassified as incidents' },
        ],
        why: 'An incident is something we broke; a ticket is a client asking for something. Naming the accounts a reliability programme will not touch is what stops it being judged against problems it was never aimed at.',
      },
      {
        id: 'q8', topic: 'communication',
        q: 'You are asked to forecast how much the incident count will drop, and you have one quarter of data and no comparable fix. What is the strongest response?',
        options: [
          { key: 'd', label: 'Decline the forecast, give the current baseline, and propose re-measuring in three months', correct: true },
          { key: 'a', label: 'Give a conservative estimate, clearly labelled approximate' },
          { key: 'b', label: 'Cite a typical industry improvement figure' },
          { key: 'c', label: 'Say forecasting is outside the scope of the analysis' },
        ],
        why: 'A labelled estimate is repeated without its label; an industry figure is an invented number wearing a suit. Simply declining loses the funding. Turning an unanswerable forecast into a measurable before-and-after gives them something real to approve against.',
      },
      {
        id: 'q9', topic: 'communication',
        q: 'A stakeholder asks you to describe a service as "critically unstable" to strengthen a funding case. Your evidence is 326 hours of engineering time. What do you do?',
        options: [
          { key: 'b', label: 'Decline, and offer the concrete number instead — it is stronger and it survives checking', correct: true },
          { key: 'a', label: 'Agree — the underlying point is correct' },
          { key: 'c', label: 'Agree, with a caveat in the footnotes' },
          { key: 'd', label: 'Refuse and leave it there' },
        ],
        why: 'An adjective the data does not support is the one sentence a hostile reader will test. 326 hours is most of a person-month and carries more weight in a funding room than any adjective. Refusing without offering the alternative loses the case for no gain.',
      },
      {
        id: 'q10', topic: 'business-sense',
        q: 'What makes a recommendation defensible by somebody other than its author?',
        options: [
          { key: 'c', label: 'The likely objection is answered inside the document itself', correct: true },
          { key: 'a', label: 'The full methodology is appended' },
          { key: 'b', label: 'It presents every measure so nothing is hidden' },
          { key: 'd', label: 'It avoids taking a position the author cannot personally defend' },
        ],
        why: 'The person carrying it into the room gets one hostile question and has to answer from the page. Appended methodology is not read; every measure is a menu rather than a recommendation; and avoiding a position is how a decision slips a quarter.',
      },
    ],
  },
  'pay-equity-audit': {
    key: 'eq-equity', title: 'Pay Equity Audit — end of project',
    intro: 'Ten questions on the week. Not a pass or fail — it tells both of us what stuck.',
    questions: [
      {
        id: 'q1', topic: 'business-sense',
        q: 'An employee is paid inside their department\'s band. What does that establish?',
        options: [
          { key: 'c', label: 'Only that their pay is within the agreed range — the band is wide', correct: true },
          { key: 'a', label: 'That they are paid fairly' },
          { key: 'b', label: 'That they are paid the same as others in their role' },
          { key: 'd', label: 'That their pay is competitive with the market' },
        ],
        why: 'A band often spans a factor of two. Two people can sit in the same band, be paid very differently, and both be compliant — which is the gap the audit exists to look into.',
      },
      {
        id: 'q2', topic: 'sql',
        q: 'Band is 800,000 to 1,800,000 and somebody earns 1,050,000. How far up the band are they?',
        options: [
          { key: 'b', label: '25%', correct: true },
          { key: 'a', label: '58%' },
          { key: 'c', label: '13%' },
          { key: 'd', label: '131%' },
        ],
        why: '250,000 above the floor over a width of 1,000,000. The 58% answer comes from dividing by band_high instead of the width — it lands between 0 and 100 and answers no question at all.',
      },
      {
        id: 'q3', topic: 'statistics',
        q: 'Your exception query returns zero rows. What is the first thing you do?',
        options: [
          { key: 'd', label: 'Run a control with a threshold you know will match, to prove the logic works', correct: true },
          { key: 'a', label: 'Report it — zero rows means zero exceptions' },
          { key: 'b', label: 'Rewrite the query until it returns something' },
          { key: 'c', label: 'Widen the threshold until exceptions appear' },
        ],
        why: 'An empty result and a broken query are both zero rows with no error. Trusting it blindly risks reporting a bug as an assurance; widening until something appears is how an audit gets rigged, usually without anyone intending to.',
      },
      {
        id: 'q4', topic: 'communication',
        q: 'Nobody is outside their band. How do you report it?',
        options: [
          { key: 'a', label: '"Every current employee was checked against their band; no exceptions."', correct: true },
          { key: 'c', label: '"No issues found."' },
          { key: 'b', label: '"The audit was inconclusive."' },
          { key: 'd', label: 'Widen the test until there is something to report' },
        ],
        why: '"No issues found" is the same sentence you would write if you had done nothing all week, which is why it lands so badly. Naming the test turns an absence into an assurance a reader can rely on.',
      },
      {
        id: 'q5', topic: 'business-sense',
        q: 'A role has three holders. What can you say about pay consistency within it?',
        options: [
          { key: 'b', label: 'Something, with the headcount stated beside it', correct: true },
          { key: 'a', label: 'Nothing — three is too few for any comparison' },
          { key: 'c', label: 'As much as for a role with thirty holders' },
          { key: 'd', label: 'Only if you first adjust for tenure' },
        ],
        why: 'Three is thin, not useless. The honest handling is to report it with n visible so the reader can weigh it — the same rule as any average. Refusing entirely abandons most of the company.',
      },
      {
        id: 'q6', topic: 'statistics',
        q: 'In one role the mean salary is well above the median. What does that tell you?',
        options: [
          { key: 'c', label: 'At least one person is paid well above the rest of the role', correct: true },
          { key: 'a', label: 'Most people in the role are overpaid' },
          { key: 'b', label: 'Pay in the role is evenly spread' },
          { key: 'd', label: 'The data contains an error' },
        ],
        why: 'The mean is pulled toward outliers and the median is not, so a gap means weight at the top. That person may be entirely justified, but they are the reason the average looks as it does and the report should say so.',
      },
      {
        id: 'q7', topic: 'business-sense',
        q: 'Every Staff Engineer out-earns every Engineering Manager. How do you report it?',
        options: [
          { key: 'd', label: 'As an observation, asking whether it is intended', correct: true },
          { key: 'a', label: 'As a pay anomaly requiring correction' },
          { key: 'b', label: 'Leave it out — the roles are not comparable' },
          { key: 'c', label: 'Suggest retitling the roles so the comparison disappears' },
        ],
        why: 'A clean separation across a whole rung looks far more like a design than an accident, and plenty of engineering organisations pay the IC track above the management track deliberately. Omitting it is worse — hiding a finding because it is hard to interpret is the failure the audit exists to avoid.',
      },
      {
        id: 'q8', topic: 'communication',
        q: 'A stakeholder wants to tell the board "an audit found no pay inequities". You found no band breaches and a large spread in band position. What do you say?',
        options: [
          { key: 'b', label: 'No — offer him "no band exceptions" and the band-position finding instead', correct: true },
          { key: 'a', label: 'Yes — nobody is outside their band' },
          { key: 'c', label: 'Yes, but ask him to add a caveat' },
          { key: 'd', label: 'Tell him you cannot comment on board communications' },
        ],
        why: 'Compliant with the bands is not the same as equitable within them, and that distinction is the entire output of the week. A caveat under a headline nobody reads does not fix it, and declining to engage leaves him to write it anyway.',
      },
      {
        id: 'q9', topic: 'business-sense',
        q: 'You are asked whether a 12% spread within a role is acceptable. What do you do?',
        options: [
          { key: 'c', label: 'Report the number and say the threshold is a People Ops decision', correct: true },
          { key: 'a', label: 'Say it is normal and no action is needed' },
          { key: 'b', label: 'Flag it as a serious inequity' },
          { key: 'd', label: 'Leave the number out and describe it qualitatively' },
        ],
        why: 'Nothing in the data says where the acceptable line sits — calling it normal or serious both import a standard from outside the analysis. Measuring is yours, deciding is theirs, and keeping that boundary is what gets you believed on the things you do assert.',
      },
      {
        id: 'q10', topic: 'communication',
        q: 'You cost the remediation at about eight lakh. How do you present it to Finance?',
        options: [
          { key: 'a', label: 'As an annual recurring cost, with the number of people it covers', correct: true },
          { key: 'c', label: 'As a total figure — Finance will work out the rest' },
          { key: 'b', label: 'As a one-off adjustment' },
          { key: 'd', label: 'As a percentage of payroll' },
        ],
        why: 'A salary increase repeats every year and compounds at the next review. A bare total gets read as a one-off, and Finance budgets a fraction of what is actually needed — a misunderstanding that six words would have prevented.',
      },
    ],
  },
  'outage-recovery': {
    key: 'pq-phoenix', title: 'Project Phoenix — end of project',
    intro: 'Ten questions on the week. Not a pass or fail — it tells both of us what stuck.',
    questions: [
      {
        id: 'q1', topic: 'business-sense',
        q: 'Which column in the incident log most directly measures how much harm was done to a client?',
        options: [
          { key: 'c', label: 'rows_corrupted', correct: true },
          { key: 'a', label: 'severity' },
          { key: 'b', label: 'hours from started_at to resolved_at' },
          { key: 'd', label: 'the priority of that client\'s tickets' },
        ],
        why: 'Severity records how alarming something looked in its first ten minutes. Resolution time measures our response. Ticket priority measures how loudly the account complains. Only rows corrupted counts actual damage.',
      },
      {
        id: 'q2', topic: 'sql',
        q: 'You JOIN clients to incidents and write SUM(c.mrr) to get revenue at risk. What do you actually get?',
        options: [
          { key: 'b', label: "Each client's revenue counted once per incident — a total that is too high", correct: true },
          { key: 'a', label: 'The correct total revenue of affected clients' },
          { key: 'c', label: 'Average revenue per incident' },
          { key: 'd', label: 'An error, because MRR is not an aggregate' },
        ],
        why: 'The join multiplies each client row by their incident count before SUM sees it. SQL runs it happily and returns a plausible-looking number that is nearly double. SUM(DISTINCT c.mrr) or a subquery fixes it.',
      },
      {
        id: 'q3', topic: 'statistics',
        q: 'Seven of thirty-five incidents are still unresolved. You are computing average resolution time. What do you do?',
        options: [
          { key: 'd', label: 'Exclude them, and make sure your count says how many you included', correct: true },
          { key: 'a', label: 'Include them with a resolution time of zero' },
          { key: 'b', label: 'Include them using today as the resolution date' },
          { key: 'c', label: 'Exclude them and report the count of all thirty-five' },
        ],
        why: 'An incident with no resolution time cannot contribute to an average of resolution times. The trap is the last option: a count of thirty-five beside an average of the twenty-eight closed ones is a table that gets quietly believed and is wrong.',
      },
      {
        id: 'q4', topic: 'business-sense',
        q: 'SEV3 incidents take longer to resolve on average than SEV2. What is the most likely explanation?',
        options: [
          { key: 'a', label: 'Severity drives how urgently we respond, not how hard the problem is', correct: true },
          { key: 'c', label: 'The severity labels were assigned wrongly' },
          { key: 'b', label: 'The resolution timestamps are unreliable' },
          { key: 'd', label: 'It is noise and means nothing' },
        ],
        why: 'A SEV1 gets people out of bed and closes fast whatever its difficulty; a SEV3 waits in a queue. The label predicts our response rather than the problem — which is exactly why it is a poor basis for compensating clients.',
      },
      {
        id: 'q5', topic: 'business-sense',
        q: 'Your largest client by revenue lost about 7,000 rows. A mid-size client lost 492,000. How should the compensation list be ordered?',
        options: [
          { key: 'b', label: 'By damage, and say explicitly that you did not order it by account size', correct: true },
          { key: 'a', label: 'By revenue — larger accounts are worth more to retain' },
          { key: 'c', label: 'By revenue, with damage as a tiebreak' },
          { key: 'd', label: 'Equally — every affected client gets the same' },
        ],
        why: 'Compensation is for harm, and the harm ranking is not the revenue ranking. Saying what you did NOT rank on is what stops somebody quietly re-sorting the list after you hand it over.',
      },
      {
        id: 'q6', topic: 'statistics',
        q: 'Damage per affected client is 7k, 9k, 12k, 20k and 493k. Which single figure best describes a typical affected account?',
        options: [
          { key: 'c', label: 'The median, 12k', correct: true },
          { key: 'a', label: 'The mean, about 108k' },
          { key: 'b', label: 'The maximum, 493k' },
          { key: 'd', label: 'The mean, with the outlier removed' },
        ],
        why: 'The mean sits above four of the five accounts. It is a true statement about the total and a misleading one about any account. Silently dropping the outlier is worse — it is the most important account in the analysis.',
      },
      {
        id: 'q7', topic: 'business-sense',
        q: 'One damaged account has already churned. What do you do with them?',
        options: [
          { key: 'd', label: 'Remove them from the compensation list, say that you did, and keep them in the analysis', correct: true },
          { key: 'a', label: 'Leave them on the list — they were damaged like everyone else' },
          { key: 'b', label: 'Remove them quietly to keep the note short' },
          { key: 'c', label: 'Recommend a win-back offer from the same budget' },
        ],
        why: 'Goodwill spend keeps accounts, so it cannot go to one that has gone. But a damaged account that then churned is the best evidence in the dataset that outages cost retention, so it belongs in the write-up even though it gets no payment. A silent removal is the one genuinely dishonest option.',
      },
      {
        id: 'q8', topic: 'communication',
        q: 'The account raising the most urgent tickets is one of your smallest clients and took middling damage. How does that fit the recommendation?',
        options: [
          { key: 'a', label: 'Report ticket volume as its own column — it measures complaint, not harm', correct: true },
          { key: 'b', label: 'Move them to the top — they are clearly the most upset' },
          { key: 'c', label: 'Ignore tickets entirely; only measured damage counts' },
          { key: 'd', label: 'Average the damage rank and the ticket rank' },
        ],
        why: 'Both signals are real and they measure different things. Folding them together hides that; dropping tickets throws away something true about an account. A separate column lets the reader see where they agree, which is where the case is strongest.',
      },
      {
        id: 'q9', topic: 'statistics',
        q: 'You are asked what proportion of damaged accounts will churn. One account in the whole book has ever churned. What do you say?',
        options: [
          { key: 'b', label: 'That no rate can be built on one event, and offer what the data does show', correct: true },
          { key: 'a', label: 'About 8% — one in thirteen' },
          { key: 'c', label: '"I do not know."' },
          { key: 'd', label: 'That all of them are at risk if nothing is done' },
        ],
        why: 'A rate from a single event is a guess with a percentage sign on it, and coming from you it will be repeated as fact. "I do not know" is honest but ends the conversation; naming the sample size and offering the one real observation leaves them better off than before they asked.',
      },
      {
        id: 'q10', topic: 'communication',
        q: 'Your recommendation moves a budget. What has to come first in the note?',
        options: [
          { key: 'c', label: 'The principle the list was ranked on, in one sentence', correct: true },
          { key: 'a', label: 'The full methodology, so it can be checked' },
          { key: 'b', label: 'The caveats, so nobody over-reads it' },
          { key: 'd', label: 'The SQL, so the numbers are reproducible' },
        ],
        why: 'Every account team with a client below the line will look for a problem with your method. A stated principle lets them argue with the principle — a good conversation. Without it they argue with the outcome and reverse-engineer your reasoning, which is a conversation about you.',
      },
    ],
  },
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
