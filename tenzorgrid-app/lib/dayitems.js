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
