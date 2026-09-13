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
  'board-pack': [
    {
      key: 'tda-01', day: 1, type: 'learning', via: 'email', from: 'finance_analyst', minutes: 13,
      subject: 'Why three people got three answers',
      title: 'Read: a number is a definition with arithmetic attached',
      body: `Diya. Three of us submitted three revenue figures and all three are correct. That is worth sitting with, because it is the normal case rather than the unusual one.

Revenue for a retail year has at least three independent choices baked into it. Gross or net of returns. Whole estate or like-for-like. Known data faults corrected or left. Three binary choices gives eight defensible answers, and ours happened to be three of them.

Nobody made an error. Everybody omitted the same thing: saying which choices they took.

The consequence is specific and expensive. Two figures in circulation with no bridge between them does not cause a debate about definitions — it causes a debate about competence. Somebody is assumed to have got it wrong, and the meeting is about that instead of about the business.

So: the definition travels with the number, always, in the same sentence. Not a footnote, not an appendix, not a conversation you had with the person who asked. Written next to the figure, every time it appears.`,
      check: {
        kind: 'choice',
        prompt: 'Two teams report different revenue for the same year. What is the most likely cause?',
        options: [
          { key: 'defs', correct: true, label: 'Different definitions, both unstated' },
          { key: 'error', correct: false, label: 'An arithmetic error in one of them' },
          { key: 'data', correct: false, label: 'A data quality problem affecting one source' },
          { key: 'timing', correct: false, label: 'The two were run at different times' },
        ],
        why: 'All three happen. Definitions are by far the commonest, and the only one where both parties are right and both feel accused.',
      },
    },
    {
      key: 'tda-02', day: 1, type: 'learning', via: 'email', from: 'line_manager', minutes: 11,
      subject: 'Replacing three people\'s work',
      title: 'Asha: how to pick one number without losing three people',
      body: `You are about to tell three colleagues that the pack will not use any of their figures. Handle that badly and you will get fewer submissions next year, and they will arrive later and less finished.

Two things.

Say they were right before you say what you chose. It is true — each computed a correct answer to a real question — and it has to be the first sentence, not a softening clause at the end.

And do not discard their work. All three figures belong in the bridge. Ravi's gross is what Finance reconciles against, Diya's net is what the tills say, Sneha's like-for-like is what the trading discussion needs. They become the explanation rather than the competition, and each of them sees their number on the page.

The failure mode is the lead who quietly produces a fourth figure and presents it as the answer. Technically fine, and everybody who submitted learns that submitting was pointless.`,
      check: {
        kind: 'choice',
        prompt: 'Three colleagues submitted three correct figures. The pack needs a fourth. What do you do with theirs?',
        options: [
          { key: 'bridge', correct: true, label: 'Put all three in the bridge, as the explanation of the headline' },
          { key: 'discard', correct: false, label: 'Use the new figure and explain privately why theirs were not used' },
          { key: 'pick', correct: false, label: 'Pick the closest of the three rather than producing a fourth' },
          { key: 'credit', correct: false, label: 'Use the new figure and credit all three in the pack' },
        ],
        why: 'Picking the closest publishes a figure that answers the wrong question. Crediting people for work you did not use is worse than not crediting them — the bridge uses it.',
      },
    },
    {
      key: 'tda-03', day: 2, type: 'learning', via: 'email', from: 'data_engineer', minutes: 12,
      subject: 'A bridge that ties',
      title: 'Read: why reconciliation is the whole job',
      body: `Karthik. A bridge is a sequence of steps from one figure to another where every step is named and the arithmetic is exact. Not approximately exact. Exact.

The reason is not pedantry. A bridge is the artefact that converts "your number disagrees with mine" into "here is where they diverge, and here is why". It only does that if somebody can add it up in the room and get your answer. One rupee out and the entire page is suspect, including the parts that are right.

Three rules I would hold you to.

Every step names what it removes AND why. "Less duplicates ₹3,46,357" is half a step; "a feed fault duplicated one store-month" is the other half.

Both ends are figures somebody actually quotes. A bridge from a number nobody uses to another number nobody uses is a nice piece of arithmetic that helps no one.

And it comes from one computation. If the eight figures in your bridge come from eight queries, they will drift the first time a definition changes, and the drift will appear in the room rather than in your review.`,
      check: {
        kind: 'choice',
        prompt: 'Your bridge is out by ₹40 on ₹4.8 crore. What do you do?',
        options: [
          { key: 'find', correct: true, label: 'Find it before the pack goes out' },
          { key: 'round', correct: false, label: 'Round every figure to the nearest lakh so it disappears' },
          { key: 'note', correct: false, label: 'Add a rounding note' },
          { key: 'ignore', correct: false, label: 'Ignore it — it is immaterial at that scale' },
        ],
        why: 'It is immaterial to the business and fatal to the bridge. Rounding to hide it is worse, because the difference is still there and now nobody can see where.',
      },
    },
    {
      key: 'tda-04', day: 2, type: 'judgement', via: 'chat', from: 'stakeholder', minutes: 6,
      subject: 'Can we simplify the bridge?',
      title: 'Vikram wants fewer steps',
      body: `Seven steps is a lot for a board slide. Can we collapse it to two — headline and like-for-like — and put the detail in an appendix?`,
      check: {
        kind: 'answer',
        prompt: 'Reply in a sentence or two.',
        markers: ['steps|explanation|why|55|lakh|appendix|nobody reads|collaps|difference|unexplain'],
        why: 'The steps ARE the explanation. Collapsed to two, the ₹55 lakh between the ends becomes unexplainable again, which is the problem the bridge was built to solve.',
      },
    },
    {
      key: 'tda-05', day: 3, type: 'learning', via: 'email', from: 'line_manager', minutes: 13,
      subject: 'Repair or exclude',
      title: 'Read: the same fault, two correct treatments',
      body: `You are about to find that a correction you made three months ago was wrong. It was not — it was right for what you were doing then and wrong for what you are doing now, and the difference is worth getting exactly straight.

When a period is corrupt you have two moves. REPAIR it, if the fault is deterministic and you can recover the truth. EXCLUDE it, if you cannot.

For the trading review you were comparing halves. Every line in that month was duplicated, so you could not tell which of each pair was real — except that both were identical, which means either one is. At the time you excluded the month, which kept the comparison clean and cost nothing, because a comparison does not need that store-month, only a consistent basis on both sides.

For a total it is different. The board is being told what the business earned. Excluding the month understates it by ₹3.46 lakh of trade that genuinely happened. Correcting downward to avoid a data fault is still an error — it just feels safer, which is exactly why it is easy to defend and hard to notice.

The rule: repair when you can, exclude when you cannot, and let the question decide which matters.`,
      check: {
        kind: 'choice',
        prompt: 'Every row in one store-month is duplicated exactly once. You need a total for the year. What do you do?',
        options: [
          { key: 'repair', correct: true, label: 'Keep one row of each pair — the trade is recoverable' },
          { key: 'exclude', correct: false, label: 'Exclude the store-month, since the data cannot be trusted' },
          { key: 'estimate', correct: false, label: 'Replace the month with an average of its neighbours' },
          { key: 'flag', correct: false, label: 'Include it as loaded and flag the figure as provisional' },
        ],
        why: 'Both rows are identical, so either is the real one and the repair is certain. Excluding understates by real money; estimating invents a number; flagging publishes a figure you know is wrong.',
      },
    },
    {
      key: 'tda-06', day: 3, type: 'judgement', via: 'chat', from: 'finance_analyst', minutes: 6,
      subject: 'So which of my numbers were wrong?',
      title: 'Diya asks what else needs restating',
      body: `If the duplicate has been in there since March, how many of my monthly reports are wrong, and do I restate them?`,
      check: {
        kind: 'answer',
        prompt: 'Answer both parts.',
        markers: ['march|one month|3,?46|346|only|store 3|small|material|her call|restate|going forward|not all'],
        why: 'One store, one month, ₹3.46 lakh. Everything since is affected by that one figure and nothing else. Whether to restate is her judgement on materiality, and the useful input is the exact size rather than a blanket answer.',
      },
    },
    {
      key: 'tda-07', day: 4, type: 'learning', via: 'email', from: 'stakeholder', minutes: 14,
      subject: 'Forecasts and the word conservative',
      title: 'Read: an estimate is assumptions with a number attached',
      body: `Vikram. I have put next year at this year plus five percent, and you are about to tell me why that is wrong. Before you do, here is what I have learned from twenty years of being told.

A forecast is not a prediction. It is a set of assumptions, and the number is an output. Which means the assumptions are the deliverable and the number is the summary.

Four assumptions hide inside "this year plus five percent". That the base is right. That the estate is unchanged. That trading grows. That anything unusual in the base repeats. Every one of those is a decision, and every one of them was taken silently.

The one that catches people is the word CONSERVATIVE. It gets attached to any assumption of no growth. But if trading is falling, flat is not conservative — it is optimistic, and telling a board an estimate is conservative when the risk is on the downside is the single most expensive sentence in any pack.

The test: for each assumption, would the board be surprised to learn it was made? If yes, it goes on the page.`,
      check: {
        kind: 'choice',
        prompt: 'Like-for-like trading fell in the second half. Your estimate assumes it is flat next year. Is that conservative?',
        options: [
          { key: 'optimistic', correct: true, label: 'No — it is optimistic against the only trend evidence available' },
          { key: 'yes', correct: false, label: 'Yes, since it assumes no growth' },
          { key: 'neutral', correct: false, label: 'Neutral, since it neither grows nor declines' },
          { key: 'depends', correct: false, label: 'It depends what the board expects' },
        ],
        why: 'Conservative means erring against yourself. With a falling trend, assuming flat errs in your favour — and a board told "conservative" will place its risk on the wrong side.',
      },
    },
    {
      key: 'tda-08', day: 4, type: 'pressure', via: 'email', from: 'stakeholder', minutes: 8,
      subject: 'The board needs a single number',
      title: 'Vikram will not take a range',
      body: `I understand the two scenarios. The board will not accept a range — they want a number to plan against and they will ask me to pick one in the room.

So pick one. Which is it?`,
      check: {
        kind: 'choice',
        prompt: 'What do you give him?',
        options: [
          { key: 'promo', correct: true, label: 'The figure that matches whatever the promotion decision turns out to be, and ask who takes that decision' },
          { key: 'lower', correct: false, label: 'The lower one, as the prudent choice' },
          { key: 'mid', correct: false, label: 'The midpoint of the two' },
          { key: 'higher', correct: false, label: 'The higher one, since the board wants growth' },
        ],
        why: 'The two scenarios differ by one decision the business has not taken. Picking prudently, optimistically or splitting the difference all take that decision on their behalf, quietly, in a number.',
      },
    },
    {
      key: 'tda-09', day: 5, type: 'learning', via: 'email', from: 'line_manager', minutes: 12,
      subject: 'Four packs, four of the same failure',
      title: 'Read: what the quarter actually taught',
      body: `Look back across the four reviews you have led this quarter.

Trading: a correct number under a claim it did not support. Margin: a column whose name did not match its meaning. Range: a measure that computed cleanly and described nothing. This one: three correct numbers answering three unstated questions.

Not one of them was an arithmetic error. Every single one was a gap between what a number was and what somebody believed it was.

That is the thing a lead is for, and it is why more careful analysts do not fix it. The gap does not live in the analysis — it lives between the analysis and the sentence somebody writes on top of it, and only the person who owns both can close it.

Which is why the standard you write this week matters more than any of the four analyses. Definitions at the front. One computation behind the figures. Corrections disclosed on the page. Sign-off covering the sentences, not just the cells.

Four controls, four failures, one each. Write them down and this quarter is the last time.`,
      check: {
        kind: 'choice',
        prompt: 'Across four reviews, none of the problems was an arithmetic error. What does that tell you about where to spend attention?',
        options: [
          { key: 'meaning', correct: true, label: 'On establishing what a quantity is before computing with it' },
          { key: 'review', correct: false, label: 'On more thorough checking of calculations' },
          { key: 'tools', correct: false, label: 'On better tooling and automated tests' },
          { key: 'people', correct: false, label: 'On hiring more experienced analysts' },
        ],
        why: 'Checking arithmetic finds arithmetic errors, and there were none. Tooling and experience both help and neither closes the gap between a number and what somebody believes it means.',
      },
    },
    {
      key: 'tda-10', day: 5, type: 'reflection', via: 'chat', from: 'line_manager', minutes: 9,
      subject: 'Last one at this level',
      title: 'Asha: what you would do differently',
      body: `That is four projects as lead. Before the promotion conversation, one question, and I want the honest version.

Across the four, where did you take longer than you needed to because you were checking something that was fine? And where did you move faster than you should have?

I am not looking for modesty. I am looking for whether you can tell the difference yet — because at the next level nobody will have time to check your work, and the only control left is your own sense of which things need it.`,
      check: {
        kind: 'answer',
        prompt: 'Answer both halves honestly.',
        markers: ['check|time|slow|fast|assum|took|should|cover|stock|definition|bridge|estimate|trust|verif|too quick|too long'],
        why: 'There is no right answer. What matters is whether the two halves are specific — a lead who can only name things they did well has not yet developed the sense the question is about.',
      },
    },
  ],
  'range-review': [
    {
      key: 'tca-01', day: 1, type: 'learning', via: 'email', from: 'data_engineer', minutes: 12,
      subject: 'Start from the population',
      title: 'Read: the rows that are not there',
      body: `Karthik. One habit, and it is the single most common source of silently wrong analysis.

When you ask "which products underperform", the instinct is to query sales and rank ascending. That query can only return products that have a sales row. A product that never sold has none, so it cannot be at the bottom of your list — it is not on the list at all.

The general form: whenever the question is about a POPULATION, start the query from the table that defines the population, and LEFT JOIN the activity onto it. Products, then sales. Employees, then payroll. Customers, then orders. Never the other way round.

The tell is that your row count matches the activity table rather than the population table. Sixty-one products in a range review of sixty-eight is a bug, and it looks exactly like a correct answer.

This is why zero and NULL are different things, and why COALESCE belongs in nearly every one of these queries. A zero is a measurement. A missing row is a silence, and silence is what you were asked to find.`,
      check: {
        kind: 'choice',
        prompt: 'You rank products by sales ascending and get 61 rows. The products table has 68. What is happening?',
        options: [
          { key: 'missing', correct: true, label: 'Seven products have no sales rows and the join deleted them' },
          { key: 'filter', correct: false, label: 'A filter somewhere is excluding seven products' },
          { key: 'dupes', correct: false, label: 'Seven products are duplicated and have been collapsed' },
          { key: 'fine', correct: false, label: 'Nothing — 61 is the number of products that trade' },
        ],
        why: 'The last one is the dangerous answer, because it is nearly true and it ends the investigation. The seven that do not trade are precisely what a range review is for.',
      },
    },
    {
      key: 'tca-02', day: 1, type: 'learning', via: 'email', from: 'line_manager', minutes: 11,
      subject: 'Delists and the arithmetic of a saving',
      title: 'Read: a cut is a cost with a saving attached',
      body: `Asha. You will be asked what a delist saves, and the honest answer has a shape worth learning once.

Removing a line loses its margin. That number is exact and you can compute it today.

It saves shelf space, buying attention and working capital. Those are real and none of them is in a sales table. Somebody can price them — a space planner, a buyer, finance — but not you, and not from this data.

And the net depends on substitution: what a customer buys when the thing they came for is gone. That is the single largest term in the equation and it is unmeasurable from till data.

So the structure of your answer is always: here is the cost, exactly; here is what the saving is made of and who can price it; here is the unknown that decides the sign. Never a single net figure, because you would have invented two thirds of it.

Watch for the framing flip. Papers ask "what does the delist save", which presumes the answer. Say the cost first.`,
      check: {
        kind: 'choice',
        prompt: 'Asked what a delist saves, what is the first number in your reply?',
        options: [
          { key: 'cost', correct: true, label: 'The margin it removes' },
          { key: 'net', correct: false, label: 'A net figure combining margin lost and space released' },
          { key: 'space', correct: false, label: 'The shelf space freed, since that is what was asked' },
          { key: 'none', correct: false, label: 'None — the question cannot be answered from this data' },
        ],
        why: 'Half of it can be answered exactly, and leading with that half is what stops the paper opening on an invented saving.',
      },
    },
    {
      key: 'tca-03', day: 2, type: 'judgement', via: 'chat', from: 'stakeholder', minutes: 6,
      subject: 'Just cut the bottom 20',
      title: 'Vikram wants a simple cut',
      body: `Bottom twenty lines are 8.6% of margin. Cut them, keep 91% of the money with a third fewer products. That is obviously right.`,
      check: {
        kind: 'answer',
        prompt: 'Reply in a sentence or two.',
        markers: ['lose|cost|not save|8\\.6|18 lakh|substitut|space|not quantif|which saving|trade'],
        why: '8.6% is what you LOSE. The saving is in space and attention, which nobody has costed, and substitution decides the net. "Keep 91%" is the same number told as though the other 8.6% were free.',
      },
    },
    {
      key: 'tca-04', day: 2, type: 'policy', via: 'email', from: 'people_partner', minutes: 7,
      subject: 'Delist decisions and supplier relationships',
      title: 'Neha: delists are commercial conversations',
      body: `A note as you produce delist candidates.

A delist list is commercially sensitive in a specific way: it tells a supplier which of their lines we are about to drop, before we have negotiated. That changes the negotiation, and not in our favour.

Two rules. Candidate lists do not leave the buying and analytics teams until buying say so. And never confirm or deny a specific line to anybody outside that group, including in casual conversation — "I can't discuss the range review" is a complete answer and is what everyone else uses.

If a supplier or an agency asks you directly, it goes to Sneha.`,
      check: {
        kind: 'choice',
        prompt: 'A supplier contact asks whether their line is on the candidate list. What do you say?',
        options: [
          { key: 'refer', correct: true, label: 'That you cannot discuss the range review, and refer them to Sneha' },
          { key: 'deny', correct: false, label: 'That it is not on the list, if it genuinely is not' },
          { key: 'vague', correct: false, label: 'That no decisions have been made yet' },
          { key: 'ignore', correct: false, label: 'Nothing, and report the approach to Sneha afterwards' },
        ],
        why: 'Denying for lines that are safe means silence identifies the ones that are not. "No decisions yet" is the same problem in softer words. And a question you will not answer still needs an answer given.',
      },
    },
    {
      key: 'tca-05', day: 3, type: 'learning', via: 'email', from: 'data_engineer', minutes: 14,
      subject: 'When output is suspiciously tidy',
      title: 'Read: a measure that cannot be measuring anything',
      body: `You are about to compute stock cover, and it will produce a number for every product. Before you publish it, look at the spread.

Cover for sixty-one products lands between 0.43 and 1.09 months, clustered around 0.7. Every product in the range holds roughly twenty units, whether it sells 234 a year or 482.

That is not a finding about our stock policy. No replenishment system in the world holds the same quantity of a fast line and a slow one. When a measure comes out nearly uniform across a population you know to be varied, the measure is broken, not the population.

Two causes here and both are fatal. The counts do not respond to demand at all, so they are not describing stock policy. And four snapshots a year cannot characterise a position that turns over monthly — a point-in-time reading on one day in January says nothing about the other eighty-nine.

The discipline: before publishing a derived measure, look at its DISTRIBUTION, not just its values. A number you can compute is not the same as a number that means something, and a tidy distribution is a warning rather than a comfort.`,
      check: {
        kind: 'choice',
        prompt: 'A derived measure comes out almost identical across a population you know varies a lot. What does that suggest?',
        options: [
          { key: 'broken', correct: true, label: 'The measure is not capturing what it claims to' },
          { key: 'stable', correct: false, label: 'The underlying process is well controlled' },
          { key: 'sample', correct: false, label: 'The sample is too small to show variation' },
          { key: 'good', correct: false, label: 'Nothing — uniformity is a neutral result' },
        ],
        why: 'Well-controlled processes still vary with demand. Uniformity where you expect variation means the inputs are not carrying the information you assumed.',
      },
    },
    {
      key: 'tca-06', day: 3, type: 'pressure', via: 'chat', from: 'stakeholder', minutes: 6,
      subject: 'Can you just give me the cover number anyway?',
      title: 'Vikram wants it with a caveat',
      body: `I hear you on the stock counts. But the paper has a section for it and an empty section looks worse than a caveated number.

Give me the figure and I will footnote it as indicative.`,
      check: {
        kind: 'choice',
        prompt: 'What do you do?',
        options: [
          { key: 'no', correct: true, label: 'Decline, and offer wording explaining why the section is empty' },
          { key: 'give', correct: false, label: 'Supply it with the caveat he has offered' },
          { key: 'range', correct: false, label: 'Supply a range rather than a point figure' },
          { key: 'other', correct: false, label: 'Substitute a different stock measure without telling him' },
        ],
        why: 'A footnote never travels with the number. A range implies the uncertainty is statistical when the measure is simply not measuring stock. And swapping in something else silently is worse than either.',
      },
    },
    {
      key: 'tca-07', day: 4, type: 'learning', via: 'email', from: 'finance_analyst', minutes: 12,
      subject: 'Distribution is not performance',
      title: 'Read: the two reasons a line looks weak',
      body: `Diya. A line at the bottom of your margin table is there for one of two reasons and they need opposite responses.

Nobody wants it. It is in twelve stores, customers walk past it, it earns little. Delist.

Almost nobody stocks it. It is in seven stores, sells perfectly well in those seven, and looks small only because it is nowhere. That is a distribution decision somebody already made, and delisting it confirms a judgement rather than testing one.

Total margin cannot tell these apart. Margin per carrying store can, and the two rankings will disagree — which is the useful part, because a candidate that fails BOTH tests is robust and a candidate that fails only one needs a conversation.

The trap on the other side: a low-distribution line performing well per store looks like an obvious rollout candidate. It usually is not, because the stores carrying it are rarely a random sample. If it is only in flagships, its per-store performance tells you about flagship customers, not about the product.`,
      check: {
        kind: 'choice',
        prompt: 'A line is in seven stores, earns little in total and performs well per store. What is it?',
        options: [
          { key: 'unclear', correct: true, label: 'Ambiguous — its total is low because of distribution, and where it is stocked is not random' },
          { key: 'delist', correct: false, label: 'A delist candidate, since total margin is what the business earns' },
          { key: 'rollout', correct: false, label: 'A rollout candidate, since it performs where it is stocked' },
          { key: 'fine', correct: false, label: 'Performing as intended — nothing to do' },
        ],
        why: 'Both confident answers are available and neither is supported. Which stores carry it decides everything, and this data cannot say whether they chose it or it chose them.',
      },
    },
    {
      key: 'tca-08', day: 4, type: 'judgement', via: 'email', from: 'engineering_manager', minutes: 8,
      subject: 'Should we build a range dashboard?',
      title: 'Arjun offers to automate the range review',
      body: `This looks like it should be a dashboard rather than a week of somebody's time every season.

I can build one. What should be on it, and is there anything that should deliberately NOT be?`,
      check: {
        kind: 'choice',
        prompt: 'What is the most important thing to tell him?',
        options: [
          { key: 'population', correct: true, label: 'It must start from products, or it will silently omit lines that never sold' },
          { key: 'cover', correct: false, label: 'Leave stock cover off until the counts improve' },
          { key: 'margin', correct: false, label: 'Use margin on the cost that applied, not current cost' },
          { key: 'all', correct: false, label: 'All of these matter equally' },
        ],
        why: 'All three belong in the spec. But the other two produce visibly wrong numbers somebody can challenge; the population error produces a dashboard that looks perfect and is missing the worst lines in the range, every season, forever.',
      },
    },
    {
      key: 'tca-09', day: 5, type: 'learning', via: 'email', from: 'line_manager', minutes: 10,
      subject: 'Sign-off means the sentences',
      title: 'Read: what comes back in after you take it out',
      body: `You told buying on Wednesday that stock cover cannot be computed from these counts. It will be in their draft on Friday.

This is not bad faith. A paper has a section for stock, somebody needs to fill it, and your email is in a different thread from the document. Things you remove in conversation come back in writing unless you remove them in writing too.

Two habits that prevent most of it.

Put the refusal in the document, not only in the reply. One line — "stock cover is not included; the counts do not vary with demand and cannot support it" — is far harder to delete than an absence.

And when you sign off, read the draft as though you had never seen the analysis. Every sentence is a claim. Ask of each one: which table did this come from? "Confirms the range is over-extended" came from nowhere, and it is sitting on top of your name.`,
      check: {
        kind: 'choice',
        prompt: 'You told a stakeholder verbally that a measure cannot be used. How do you stop it reappearing?',
        options: [
          { key: 'document', correct: true, label: 'Put the exclusion and its reason into the document itself' },
          { key: 'repeat', correct: false, label: 'Repeat it at sign-off' },
          { key: 'email', correct: false, label: 'Send a written summary of the conversation' },
          { key: 'escalate', correct: false, label: 'Raise it with their manager' },
        ],
        why: 'A separate email lives in a separate thread. Repeating at sign-off relies on you seeing every draft. The absence has to be visible in the artefact or somebody will fill it in good faith.',
      },
    },
    {
      key: 'tca-10', day: 5, type: 'reflection', via: 'chat', from: 'line_manager', minutes: 8,
      subject: 'Three reviews, three of the same thing',
      title: 'Asha: notice the pattern across your three projects',
      body: `Step back across the three reviews you have led.

Trading: a number that was right and a claim on top of it that was not. Margin: a column that meant something other than its name. Range: a measure that computed cleanly and described nothing.

Different data, same failure — the number was never the problem. Every time, it was the gap between what the number was and what somebody believed it was.

Which suggests where your attention goes at this level. Not on computing more carefully. On establishing, before anything else, what a quantity actually is: as of when, over what population, counting what.

One question. Of the three, which would you have been least likely to catch if nobody had pointed you at it?`,
      check: {
        kind: 'answer',
        prompt: 'Answer honestly, and say what would have made you catch it.',
        markers: ['cover|stock|uniform|distribution|margin|cost|basis|claim|slide|population|never sold|left join|spread|check'],
        why: 'The stock one is the usual answer, because it produces a plausible number rather than an odd one. The habit that catches it is looking at the spread of a derived measure before publishing its values.',
      },
    },
  ],
  'margin-review': [
    {
      key: 'tba-01', day: 1, type: 'learning', via: 'email', from: 'finance_analyst', minutes: 13,
      subject: 'Cost is a date, not a number',
      title: 'Read: which cost, and when',
      body: `Diya. Before you compute a margin, the thing nobody tells you: a product does not have a cost. It has a cost on a date.

Our products table carries unit_cost, and that is the cost right now. It also carries previous_unit_cost and cost_changed_on, which exist precisely because the current one is not what we paid all year. Fifteen of sixty-eight products moved, all upward, by 19% on average.

Two questions get asked of the same table and they want different answers.

WHAT HAPPENED wants the cost that applied on the day of the sale. Restating last year at today's cost rewrites history and always in the same direction — it makes the past look worse than it was, because costs rise.

WHAT SHOULD WE DO wants today's cost, because next year's margin depends on next year's costs. It should also use undiscounted price, or you project forward a promotion nobody has decided to repeat.

Produce both, label both, never blend them. A single column headed "margin" with no basis stated is how two teams end up with different numbers and no way to reconcile.`,
      check: {
        kind: 'choice',
        prompt: 'You are asked which products to stock next year. Which cost basis?',
        options: [
          { key: 'current', correct: true, label: "Today's cost, and undiscounted price" },
          { key: 'applied', correct: false, label: 'The cost that applied at the time of each sale' },
          { key: 'avg', correct: false, label: 'An average of the two, weighted by volume' },
          { key: 'either', correct: false, label: 'Either — the difference is immaterial for a planning exercise' },
        ],
        why: 'It is a forward-looking decision, so the historical cost is irrelevant to it. Averaging produces a figure correct for neither question and impossible to explain. And 26.6% of revenue sits on the products that moved.',
      },
    },
    {
      key: 'tba-02', day: 1, type: 'learning', via: 'email', from: 'line_manager', minutes: 11,
      subject: 'Rate and contribution',
      title: 'Read: the two numbers that get confused',
      body: `Asha. The single most expensive confusion in retail analytics, and you will meet it this week.

MARGIN RATE is margin over revenue — a percentage. MARGIN CONTRIBUTION is margin in rupees. They answer different questions and they frequently rank things in opposite orders.

Here, Merchandise earns 65% and contributes ₹28 lakh. Equipment earns 34.7% and contributes ₹1.08 crore. Rank by rate and Equipment is worst in the book. Rank by contribution and it is the business.

A range review that acts on the rate table cuts the category paying the rent.

The rule: whenever you publish a rate, publish the contribution beside it. It costs one column and it prevents the entire class of decision where somebody improves a percentage by shrinking the company.

The same applies to targets, which you will be asked about on Tuesday. A blended rate target can always be hit by selling a different mix. Pair it with an absolute figure and it stops being gameable in the one direction that matters.`,
      check: {
        kind: 'choice',
        prompt: 'A category has the lowest margin rate and the highest margin contribution. What does that tell you?',
        options: [
          { key: 'both', correct: true, label: 'Nothing on its own — you need to know what the decision is before either number matters' },
          { key: 'cut', correct: false, label: 'It is a candidate for reduction' },
          { key: 'grow', correct: false, label: 'It should be grown, since it contributes most' },
          { key: 'normal', correct: false, label: 'It is normal for a large category and needs no comment' },
        ],
        why: 'A pricing decision cares about the rate. A range decision cares about the contribution. A capacity decision cares about neither. The mistake is reading a number before knowing the question.',
      },
    },
    {
      key: 'tba-03', day: 2, type: 'judgement', via: 'chat', from: 'stakeholder', minutes: 6,
      subject: 'Just the margin percentage',
      title: 'Vikram wants one number per category',
      body: `For the range slide I want one number per category. Margin percentage. Clean.

Contribution is a second column and the slide is already busy.`,
      check: {
        kind: 'answer',
        prompt: 'Reply in a sentence or two.',
        markers: ['equipment|contribution|rupee|crore|1\\.08|rank|order|revers|cut|largest|merchandise|65'],
        why: 'A rate-only slide puts Merchandise top and Equipment bottom. Equipment is ₹1.08 crore of margin. The second column is what stops somebody cutting the category that pays the rent.',
      },
    },
    {
      key: 'tba-04', day: 2, type: 'policy', via: 'email', from: 'finance_analyst', minutes: 8,
      subject: 'Margin figures leaving the team',
      title: 'Diya: margin numbers are commercially sensitive',
      body: `A standing note now that you are producing margin by category.

Product-level and category-level margin is commercially sensitive. It must not appear in anything that goes to suppliers, and that includes range review documents that get shared during negotiation.

If a supplier learns what we make on their line, the next cost conversation starts from a different place. Aggregate figures at total-business level are fine; anything that lets a supplier infer their own line is not.

If in doubt, send it to me before it leaves the building.`,
      check: {
        kind: 'choice',
        prompt: 'A supplier asks for the range review document that contains category margin. What do you do?',
        options: [
          { key: 'check', correct: true, label: 'Do not send it, and route the request to Diya' },
          { key: 'send', correct: false, label: 'Send it — they supply the category, so it is their own data' },
          { key: 'redact', correct: false, label: 'Redact their line and send the rest' },
          { key: 'total', correct: false, label: 'Send total-business margin instead' },
        ],
        why: 'Redacting one line still lets them infer it from the total. Substituting a different figure without being asked to is a decision that is not yours to take alone.',
      },
    },
    {
      key: 'tba-05', day: 3, type: 'learning', via: 'email', from: 'data_engineer', minutes: 14,
      subject: 'Errors that shift and errors that distort',
      title: 'Read: why an uneven error is worse than a big one',
      body: `Karthik. You have found that the naive cost method understates margin by about 4% overall. Before you decide whether that matters, look at how it is distributed.

Equipment 6.99%. Coffee 3.22%. Bakery 1.46%. Tea and Merchandise exactly nothing.

If the error were a uniform 4% everywhere, every ranking, every ratio and every trend would be intact. You could publish the numbers with a note and nothing built on them would be wrong.

It is not uniform. It sits wherever the repriced products are, which is wherever it likes. So it moves categories relative to each other, and the range review is a decision about categories relative to each other.

The same thing happens across time, and this one is nastier. Before a cost change the two methods differ; after it they agree. So the naive method always penalises the past and never the present, which manufactures an improving trend out of nothing at all.

Rule of thumb: ask whether an error is a shift or a distortion. A shift you can caveat. A distortion you have to fix.`,
      check: {
        kind: 'choice',
        prompt: 'Which error is more dangerous in a comparison?',
        options: [
          { key: 'uneven', correct: true, label: 'A 7% error in one category and none in another' },
          { key: 'uniform', correct: false, label: 'A uniform 15% error across every category' },
          { key: 'random', correct: false, label: 'A random error averaging 10% with no pattern' },
          { key: 'same', correct: false, label: 'They are equally dangerous — size is what matters' },
        ],
        why: 'A uniform error preserves every ranking and ratio. A random one averages out across a large table. A structured, uneven one moves things relative to each other, which is exactly what a comparison measures.',
      },
    },
    {
      key: 'tba-06', day: 3, type: 'pressure', via: 'chat', from: 'finance_analyst', minutes: 6,
      subject: 'How many old reports are wrong?',
      title: 'Diya realises what this means for history',
      body: `If margin has always been computed on current cost, then every margin figure we have published is wrong.

How far back does this go, and do I have to restate?`,
      check: {
        kind: 'answer',
        prompt: 'Answer both parts.',
        markers: ['every|all|since|reprice|september|uneven|categor|restate|which|material|forward|from now|not all'],
        why: 'Everything computed since the first reprice in September is affected, unevenly. Whether to restate is her call, and the useful input is which figures moved enough to matter — not a blanket yes or no.',
      },
    },
    {
      key: 'tba-07', day: 4, type: 'learning', via: 'email', from: 'stakeholder', minutes: 12,
      subject: 'Reading a promotion',
      title: 'Read: three numbers, not one',
      body: `Vikram. Every promotion readout I have seen in fifteen years is argued with one number, and it is always the wrong one.

Marketing quotes revenue. Finance quotes margin rate. Both are true and neither settles anything.

The only honest readout has three: volume, revenue and absolute margin, each against a normal period. Here that is 55% more units, 39% more revenue, 12% more margin. Three numbers, and the shape of them tells you everything — volume rising fastest and margin slowest is the signature of buying turnover with discount.

Whether that is good depends entirely on what the promotion was for. Clearing stock that would otherwise be written off: excellent. Buying customers who come back: possibly excellent, and you cannot tell from till data. Hitting a revenue target: you succeeded at a cost you should be able to state.

Which is why the readout should never end in a recommendation. State the trade and the objective it was measured against. If nobody wrote down the objective, that is the finding.`,
      check: {
        kind: 'choice',
        prompt: 'A promotion delivers 55% more units, 39% more revenue and 12% more margin. Was it worth it?',
        options: [
          { key: 'depends', correct: true, label: 'Unanswerable from this data — it depends what it was for' },
          { key: 'yes', correct: false, label: 'Yes, margin went up' },
          { key: 'no', correct: false, label: 'No, the margin rate collapsed' },
          { key: 'marginal', correct: false, label: 'Marginally, since margin rose less than costs of the discount' },
        ],
        why: 'Margin rising is a fact, not a verdict. So is the rate falling. Clearing dead stock, buying share and hitting a target are three objectives judged on three different numbers, and nobody recorded which applied.',
      },
    },
    {
      key: 'tba-08', day: 4, type: 'judgement', via: 'email', from: 'engineering_manager', minutes: 8,
      subject: 'The discount curve',
      title: 'Arjun wants to model the discount curve',
      body: `Your discount table is interesting. Margin falls with discount up to 20% and then flattens — 25.4% and 26.6% at the two deepest bands.

I could fit a curve to that and give pricing a model. Worth doing?`,
      check: {
        kind: 'choice',
        prompt: 'What do you tell him?',
        options: [
          { key: 'thin', correct: true, label: 'Not on this data — the two deepest bands are 326 lines out of 9,022' },
          { key: 'yes', correct: false, label: 'Yes, a fitted curve would be more useful than a table' },
          { key: 'shape', correct: false, label: 'Yes, but constrain it to be monotonic' },
          { key: 'never', correct: false, label: 'No — discount curves cannot be modelled from transaction data' },
        ],
        why: 'Constraining the shape means imposing the answer you wanted. And the objection is not that it cannot be done — it is that the region he is most interested in is the region with almost no data in it.',
      },
    },
    {
      key: 'tba-09', day: 5, type: 'learning', via: 'email', from: 'line_manager', minutes: 11,
      subject: 'Words that survive being forwarded',
      title: 'Read: "held up", "accretive", and other load-bearing words',
      body: `You are about to sign off a note. Watch for words that are technically defensible and leave the wrong impression, because those are much harder to challenge than plain errors.

"Margin held up at 35.5%" — against a normal 44%. Nothing held up. The word is doing all the work and it is unfalsifiable, because nobody said what it held up against.

"Margin-accretive" — absolute margin rose, so it is true. Everyone reads it as margin improving. The rate fell nine points.

"Analytics confirm" — you did not confirm anything, you measured something. That phrase converts a measurement into an endorsement and attaches your team's name to a decision you did not make.

The test I use: if this sentence were forwarded on its own, with no table under it and nobody to ask, what would the reader believe? If the answer is something you would not say out loud, the sentence is wrong even if every word in it is accurate.`,
      check: {
        kind: 'choice',
        prompt: 'Which phrase is most dangerous in a note you sign off?',
        options: [
          { key: 'confirm', correct: true, label: '"Analytics confirm the promotion was margin-accretive and recommend repeating it"' },
          { key: 'held', correct: false, label: '"Margin held up at 35.5%"' },
          { key: 'best', correct: false, label: '"November was our strongest trading month"' },
          { key: 'rev', correct: false, label: '"39% more revenue than a typical month"' },
        ],
        why: 'All but the last are slippery. But that one attributes a recommendation to your team that you never made, and it is the sentence that will be quoted when the decision is questioned.',
      },
    },
    {
      key: 'tba-10', day: 5, type: 'reflection', via: 'chat', from: 'line_manager', minutes: 8,
      subject: 'Before the range review',
      title: 'Asha: you changed a number everyone was using',
      body: `Worth noticing what happened this week.

Margin has been reported on the wrong cost basis for as long as anyone has been reporting it. Nobody was careless — the column is called unit_cost and it behaves like a cost. The failure was that nobody asked WHEN.

That question, "as of when", is most of what separates a number that is right from a number that is nearly right. Cost as of when. Estate as of when. Price as of when. Almost every quantity in a business has a date attached and almost every table drops it.

One question before you send the range review: which other figures your team publishes have a hidden "as of when" in them that nobody has asked about?`,
      check: {
        kind: 'answer',
        prompt: 'Name one, and say what could be wrong with it.',
        markers: ['store|estate|open|clos|price|list|categor|product|band|target|stock|count|as of|when|change|histor|current'],
        why: 'Store format and the estate itself both change. List price changes. A product\'s category can be reclassified. Any of them applied retrospectively rewrites history the same way the cost did.',
      },
    },
  ],
  'trading-review': [
    {
      key: 'taa-01', day: 1, type: 'learning', via: 'email', from: 'line_manager', minutes: 13,
      subject: 'What changes now you are the lead',
      title: 'Read: you own what leaves the team',
      body: `Asha. First project at this level, so let me be direct about what is different.

As an analyst you were judged on the work you produced. As a lead you are judged on the work that leaves the team, whether or not you wrote it. Ravi's draft going to the board with a wrong transaction count is your problem now, and "he sent it before I saw it" is not a defence anybody accepts twice.

That has a practical consequence. Most of your week is spent reading other people's numbers rather than making your own, and reading a number properly means asking three things: what is it counting, what population is it over, and what would make it wrong.

The third one is the habit that takes longest to build. It is not scepticism for its own sake — it is that a number which flatters somebody has already passed one filter that a number which embarrasses them has not. Somebody wanted the star performer to be real. Nobody wanted the decline to be real. Guess which one got checked.

So: check the flattering number hardest. Every time.`,
      check: {
        kind: 'choice',
        prompt: 'A draft shows nine stores declining and one growing strongly. Which figure do you verify first?',
        options: [
          { key: 'growing', correct: true, label: 'The one that is growing' },
          { key: 'declining', correct: false, label: 'The nine declining, since that is the bigger business impact' },
          { key: 'total', correct: false, label: 'The estate total, since everything rolls up to it' },
          { key: 'all', correct: false, label: 'All of them equally — there is no reason to prefer one' },
        ],
        why: 'The exception is where the error is, and the flattering exception is the one nobody has already questioned. Checking everything equally sounds rigorous and is how limited time gets spent uniformly on the wrong things.',
      },
    },
    {
      key: 'taa-02', day: 1, type: 'learning', via: 'email', from: 'finance_analyst', minutes: 11,
      subject: 'Gross, net, and why Finance keeps correcting you',
      title: 'Read: the words retail arguments are made of',
      body: `Diya. You are about to publish a revenue figure, so here are the three definitions that cause most of the arguments between Finance and Analytics.

GROSS revenue is what was rung through the till on sales. NET is gross minus returns. Neither is more correct; they answer different questions. Gross tells you what the stores sold, net tells you what the business kept. The unforgivable thing is publishing one without saying which.

A TRANSACTION, to a board, means a customer buying something. In a till table a refund is also a row. Counting it as a transaction inflates the count and deflates the average, and both errors point the same way, so the average transaction value comes out low twice over.

LIKE-FOR-LIKE means the same stores in both periods. The moment an estate opens or closes anything, the total and the like-for-like diverge, and a pack that does not carry both will be asked for the other one in the room.

Get these three right and most of the reconciliation meetings stop happening.`,
      check: {
        kind: 'choice',
        prompt: 'Which pair of figures should always appear together in a retail pack?',
        options: [
          { key: 'both', correct: true, label: 'Total estate revenue and like-for-like revenue' },
          { key: 'grossonly', correct: false, label: 'Gross revenue and units sold' },
          { key: 'netatv', correct: false, label: 'Net revenue and average transaction value' },
          { key: 'lfl', correct: false, label: 'Like-for-like revenue alone, since it is the cleaner measure' },
        ],
        why: 'Like-for-like says whether the shops are trading better. The total says what the business actually earned. Publish one and you will be asked for the other before the end of the meeting.',
      },
    },
    {
      key: 'taa-03', day: 2, type: 'judgement', via: 'chat', from: 'stakeholder', minutes: 6,
      subject: 'Can I just have a league table?',
      title: 'Vikram wants stores ranked, full stop',
      body: `I do not need per-day anything. I need a list of stores best to worst so I know who to call.

Can you just send that?`,
      check: {
        kind: 'answer',
        prompt: 'Reply in a sentence or two.',
        markers: ['open|day|february|october|part|new|normalis|per day|format|not compar|salt lake|sector'],
        why: 'A raw league table puts a store that opened in February at the bottom and a store that closed in January in the middle. He would call the wrong people. Send the ranking, per day open, with the format beside it.',
      },
    },
    {
      key: 'taa-04', day: 2, type: 'policy', via: 'email', from: 'people_partner', minutes: 7,
      subject: 'Store performance data and individual managers',
      title: 'Neha: store numbers are about people too',
      body: `Now that you are producing store-level performance reporting, one thing to be aware of.

A store is a person. Every figure you publish about a store is, in practice, a figure about its manager, and it will be read that way whether or not you intend it. That does not mean you should soften anything — it means the figure has to be right, and it has to be normalised so that a manager is not marked down for having opened in February.

Two practical rules. Never circulate a store ranking without the normalisation that makes it fair. And if a store's numbers are affected by something outside the manager's control — a refit, a closure next door, a data fault — that note goes on the same page as the number, not in a follow-up.`,
      check: {
        kind: 'choice',
        prompt: 'A store looks worst in the estate because it opened four months ago. What do you publish?',
        options: [
          { key: 'norm', correct: true, label: 'The normalised figure, with the opening date on the same page' },
          { key: 'raw', correct: false, label: 'The raw figure — it is what actually happened' },
          { key: 'omit', correct: false, label: 'Leave the store out until it has a full year' },
          { key: 'later', correct: false, label: 'The raw figure now, with a note circulated separately' },
        ],
        why: 'Omitting them hides a new investment the board approved. A note circulated separately never catches up with the number it was meant to qualify.',
      },
    },
    {
      key: 'taa-05', day: 3, type: 'learning', via: 'email', from: 'data_engineer', minutes: 14,
      subject: 'How feeds break, and how to tell',
      title: 'Read: the shapes of a broken load',
      body: `Karthik. You have found a store-month that looks too good. Before you call it a data fault, here is how the common failures actually look, because they are distinguishable.

A DOUBLE LOAD gives you exact duplicate rows — every field identical except the surrogate key — covering one contiguous window for one source. Line count and value both exactly double. This is the one you have.

A PARTIAL LOAD gives you a window with far too few rows and nothing duplicated. It looks like a bad month, which is why it is more dangerous than a double load: nobody questions a bad month.

A LATE LOAD gives you rows arriving with an old business date. Totals for a closed period change after you have published them, which is how you discover it.

A SCHEMA DRIFT gives you a column that changes meaning partway through — prices suddenly ex-VAT, quantities suddenly in cases. No duplicates, no gaps, just a step change in a ratio.

The diagnostic in every case is the same: group by source and period, and look for the period that does not behave like its neighbours. One query, and it should run every month whether or not anybody is suspicious.`,
      check: {
        kind: 'choice',
        prompt: 'Which of these failures is most likely to go unnoticed?',
        options: [
          { key: 'partial', correct: true, label: 'A partial load — it looks like a bad month, and bad months get accepted' },
          { key: 'double', correct: false, label: 'A double load, because the numbers look plausible' },
          { key: 'late', correct: false, label: 'A late load, because published totals change quietly' },
          { key: 'drift', correct: false, label: 'Schema drift, because no rows are missing or repeated' },
        ],
        why: 'All four hide well. But a double load gets caught the moment somebody celebrates it, and drift and late arrival both change something visible. A missing week just looks like trade was soft, and nobody investigates soft.',
      },
    },
    {
      key: 'taa-06', day: 3, type: 'judgement', via: 'chat', from: 'line_manager', minutes: 7,
      subject: 'Ravi is going to be embarrassed',
      title: 'Asha: correcting someone on your own team',
      body: `You are about to tell Ravi that the headline he was proudest of is a data fault. He drafted it, he called it out specifically, and he sent it to you to check.

Two things matter here and they pull in different directions.

He has to hear it from you, clearly, today. Softening it into "we might want to look at March" means it goes in the pack.

And he has to still send you the next draft. He did the right thing — he circulated early and asked. If being checked costs him something, the next one arrives finished, or does not arrive at all.

The way through is to make the fault the subject, not him. "March is loaded twice" is about the feed. "You did not spot the duplicate" is about Ravi. The first one is also more useful, because the feed is the thing that needs fixing.`,
      check: {
        kind: 'choice',
        prompt: 'How do you open the message to Ravi?',
        options: [
          { key: 'fault', correct: true, label: 'With the fault: March is loaded twice in the source' },
          { key: 'soft', correct: false, label: 'With a suggestion that March might be worth another look' },
          { key: 'praise', correct: false, label: 'With praise for the draft, then the problem' },
          { key: 'ask', correct: false, label: 'By asking him how he calculated the 21%' },
        ],
        why: 'Asking how he calculated it implies the arithmetic was wrong. It was not — the source is. Leading with praise before a correction reads as a setup, and softening it means it ships.',
      },
    },
    {
      key: 'taa-07', day: 4, type: 'learning', via: 'email', from: 'line_manager', minutes: 12,
      subject: 'When you are asked to name a cause',
      title: 'Read: "pick one" is not a question you have to answer',
      body: `Vikram will ask you why the estate declined, and he will frame it so that not answering looks like evasion. That framing is the thing to notice.

You have sales, products, stores and stock counts. Footfall is not in there. Competitors are not in there. Pricing decisions, marketing spend, the weather, the economy — none of it. You can say with confidence WHERE the decline sits. You cannot say WHY, and no amount of pressure changes which tables exist.

The failure mode is picking the most plausible-sounding cause because the room needs one. It feels helpful. What it actually does is put your name on an assertion that will be repeated in three more meetings, acted on in a budget, and never traced back.

The answer that works is three parts: here is what I can show, here is what I cannot, here is what would settle it. The third part is what stops it sounding like a refusal. "Footfall counters would answer this in a month" turns you from an obstacle into the person with the plan.`,
      check: {
        kind: 'choice',
        prompt: 'You are pressed to name a cause the data cannot establish. What is the complete answer?',
        options: [
          { key: 'three', correct: true, label: 'What you can show, what you cannot, and what would settle it' },
          { key: 'refuse', correct: false, label: 'That the data cannot answer the question' },
          { key: 'likely', correct: false, label: 'The most likely cause, flagged as a hypothesis' },
          { key: 'defer', correct: false, label: 'That you will come back once you have more data' },
        ],
        why: 'Stopping at the refusal is accurate and leaves the room stuck. A hypothesis offered under pressure gets quoted without the flag. Coming back later means the decision gets made without you.',
      },
    },
    {
      key: 'taa-08', day: 4, type: 'judgement', via: 'email', from: 'finance_analyst', minutes: 8,
      subject: 'Your number does not tie to mine',
      title: 'Diya cannot reconcile your total',
      body: `I have ₹4.85 crore net for the year from the warehouse. You have ₹4.78 crore.

Seven lakh apart is not a rounding difference. One of us has a filter the other does not. Which is it?`,
      check: {
        kind: 'choice',
        prompt: 'What is the difference, and what do you do about it?',
        options: [
          { key: 'disclose', correct: true, label: 'You excluded the duplicated store-month; tell her exactly what and why' },
          { key: 'hers', correct: false, label: 'Her figure is wrong because it includes the duplicates' },
          { key: 'adopt', correct: false, label: 'Adopt her figure so the pack ties to the warehouse' },
          { key: 'note', correct: false, label: 'Add a note to the pack saying figures may differ from the warehouse' },
        ],
        why: 'Her figure is what the warehouse says, which is a fact about the warehouse rather than an error on her part. Adopting it puts a known-wrong number in the pack. A vague note tells nobody how to reproduce either figure.',
      },
    },
    {
      key: 'taa-09', day: 5, type: 'learning', via: 'email', from: 'stakeholder', minutes: 10,
      subject: 'How a slide gets wrong without a wrong number',
      title: 'Read: arithmetic right, claim wrong',
      body: `Vikram. A thing worth internalising before you sign anything off.

Most bad slides do not contain a bad number. They contain a correct number with a sentence built on top of it that the number does not support. Three patterns cover nearly all of it.

CAUSAL DRIFT. "Revenue fell, driven by Equipment." Equipment is the biggest category, so of course it moves the total most. "Driven by" turns arithmetic into a cause and invites a decision about Equipment.

COMPARISON DRIFT. "The new store is outperforming the estate average." True only if you compare an express store with an average that is mostly flagships. The number is right and the comparison is not.

DISCLOSURE DRIFT. "Data quality issues have been corrected." Nobody can reproduce your figure from that sentence, and next quarter the difference will be found by somebody who does not know where to look.

When you sign something off you are signing the sentences, not the cells.`,
      check: {
        kind: 'choice',
        prompt: 'A slide says "revenue fell 17%, driven by a slowdown in Equipment". Equipment is 64% of revenue. What is wrong?',
        options: [
          { key: 'causal', correct: true, label: '"Driven by" claims a cause; being the largest category is arithmetic' },
          { key: 'pct', correct: false, label: 'The 17% should be stated per category' },
          { key: 'nothing', correct: false, label: 'Nothing — Equipment did decline and it is the largest category' },
          { key: 'scope', correct: false, label: 'It should say which stores are included' },
        ],
        why: 'Scope does belong on the slide, and that is a separate fix. The load-bearing error is that "driven by" will send somebody to review the Equipment range when the decline is broad.',
      },
    },
    {
      key: 'taa-10', day: 5, type: 'reflection', via: 'chat', from: 'line_manager', minutes: 8,
      subject: 'Before the pack goes',
      title: 'Asha: what would you change about how this gets made?',
      body: `Step back from the numbers for a moment.

This week you found a duplicated month that nobody had noticed in three months of reporting, three undefined terms in a board pack, and a store ranking that was really a ranking of trading days. None of those were hard to find. All of them had shipped before.

That is the part that should bother you, and it is the part a lead is actually responsible for. Finding it once is analysis. Making sure it cannot ship again is the job.

So: what is the one change you would make to how this reporting is produced? Not a list — one, the one you would actually put in place on Monday.`,
      check: {
        kind: 'answer',
        prompt: 'Name the single change you would make, and why that one.',
        markers: ['duplicat|check|test|automat|definition|glossary|agree|like.for.like|review|before|sign.?off|monthly|routine'],
        why: 'Any of them is defensible. What is not defensible is a list of five — a lead who cannot say which change matters most has not decided, and nothing gets implemented.',
      },
    },
  ],
  'experiment-readout': [
    {
      key: 'ea-01', day: 1, type: 'learning', via: 'email', from: 'data_engineer', minutes: 14,
      subject: 'Read this before you open the assignment table',
      title: 'Read: what randomisation is actually for',
      body: `Karthik. You are about to read an A/B test, so it is worth being exact about what the method buys you.

Randomisation does one job: it makes the two arms identical in expectation on EVERYTHING, including the things nobody measured or thought of. That is why a difference in outcome can be attributed to the change. It is the whole argument.

Break the randomisation and you have two groups of people who differ in the treatment and in who-knows-what-else. The arithmetic still works. The inference does not.

So the first query on any experiment is never the outcome. It is the balance check: are the arms the same size, and are they made of the same people? Compare them on every attribute you have that plausibly predicts the outcome.

And note the asymmetry. If the balance check passes, you have learned a little. If it fails, you have learned that the headline everyone is quoting means something other than what they think. That is the highest-value query you will run all week and it takes about four lines.`,
      check: {
        kind: 'choice',
        prompt: 'What does randomisation protect against that a balance check does not?',
        options: [
          { key: 'unknown', correct: true, label: 'Confounders nobody measured or thought to check' },
          { key: 'noise', correct: false, label: 'Random variation in the outcome' },
          { key: 'small', correct: false, label: 'Small sample sizes' },
          { key: 'bias', correct: false, label: 'Bias in how the outcome is measured' },
        ],
        why: 'A balance check can only test the attributes you have. Randomisation covers the ones you do not, which is why adjusting after the fact is always weaker than assigning properly in the first place.',
      },
    },
    {
      key: 'ea-02', day: 1, type: 'judgement', via: 'chat', from: 'line_manager', minutes: 7,
      subject: 'Priya has already told people it lost',
      title: 'Asha: correcting a conclusion that is already circulating',
      body: `Read the situation before you read the data. Priya has a number, she believes it, and she has said it out loud to people above her.

If you come back Thursday with "actually it won", you are not delivering a finding. You are asking her to reverse herself in public, and how you hand that over decides whether she thanks you or fights you.

Two rules. Tell her early — the moment you know the comparison is broken, not when you know the answer. A day-one "this may not say what we think" is a collaboration. A day-four reversal is an ambush.

And never frame it as her being wrong. She read a correctly computed number. The number answered a different question than the one she asked it. Those are genuinely different things and the distinction is not a kindness, it is accurate.`,
      check: {
        kind: 'choice',
        prompt: 'You know on Monday that the arms are imbalanced. You will not have the corrected result until Wednesday. When do you tell Priya?',
        options: [
          { key: 'monday', correct: true, label: 'Monday — that the comparison is broken, even without knowing which way it will go' },
          { key: 'wednesday', correct: false, label: 'Wednesday, with the corrected result, so you only disturb her once' },
          { key: 'ifreverses', correct: false, label: 'Only if the result actually reverses' },
          { key: 'friday', correct: false, label: 'Friday, in the readout, where it belongs' },
        ],
        why: 'She is briefing people on it today. Every day you wait is another room that heard the old number, and the correction gets more expensive for her each time.',
      },
    },
    {
      key: 'ea-03', day: 2, type: 'learning', via: 'email', from: 'line_manager', minutes: 12,
      subject: 'Reproduce before you correct',
      title: 'Read: always match the number you are about to change',
      body: `Small habit, disproportionate payoff.

Before you correct anybody's figure, reproduce it exactly. Same filters, same population, same decimal. If you cannot get to 45.0 and 36.1, you do not yet know whether you are correcting their analysis or arguing with a different one.

Two things happen when you skip this. The conversation becomes about whose query is right, which you will not win quickly and which teaches nobody anything. And occasionally you discover the original number was not reproducible at all, which is a completely different and much more urgent finding.

When you can say "I get your number exactly, and here is why it answers a different question", the disagreement is over in one sentence. The alternative is a week of two people running queries at each other.`,
      check: {
        kind: 'choice',
        prompt: 'Why reproduce a figure you already believe is misleading?',
        options: [
          { key: 'same', correct: true, label: 'So the disagreement is about interpretation rather than about whose query is right' },
          { key: 'polite', correct: false, label: 'Politeness — it shows you took their work seriously' },
          { key: 'check', correct: false, label: 'To check your own SQL' },
          { key: 'audit', correct: false, label: 'Because the audit trail requires it' },
        ],
        why: 'All four have something to them, but only one changes how the conversation goes. Matching their number removes the entire category of argument you cannot win quickly.',
      },
    },
    {
      key: 'ea-04', day: 2, type: 'pressure', via: 'chat', from: 'people_partner', minutes: 5,
      subject: 'Heads up on the all-hands',
      title: 'Neha: the result is going in the all-hands deck',
      body: `Just so you know — the onboarding result is in Friday's all-hands deck. Slide 14, "what we learned from onboarding_v2".

Comms have already drafted it around the rollback. If that changes, I need to know by Thursday lunchtime or it ships as written.`,
      check: {
        kind: 'answer',
        prompt: 'What do you tell Neha today?',
        markers: ['may change|might|likely|reverse|hold|draft|thursday|will know|wednesday|not final|expect'],
        why: 'She has given you a deadline and an escape hatch. Tell her today that it may reverse and when you will know, so the slide is not built twice.',
      },
    },
    {
      key: 'ea-05', day: 3, type: 'learning', via: 'email', from: 'data_engineer', minutes: 15,
      subject: "Simpson's paradox, and what to do about it",
      title: "Read: when the parts and the whole disagree",
      body: `You have just produced a table where treatment beats control on web, beats control on mobile, and loses overall. Nothing is broken. This is a known and entirely arithmetic phenomenon.

A pooled rate is a weighted average of its segment rates, weighted by how many people are in each segment. If the two arms have different weights, the pooled comparison is partly a comparison of the WEIGHTS rather than of the rates.

Here treatment is 73% mobile and control is 28% mobile, and mobile activates at roughly a third of web's rate. So treatment is carrying a heavier load of the low-activating segment. Give it the same load as control and it wins.

The fix is standardisation. Take one reference population — usually the pooled mix of everyone in the experiment — and apply each arm's within-segment rates to it. Both arms are then scored against the same mix, so the only remaining difference is the thing you are testing.

One caution. Standardising corrects the confounder you measured. It does nothing about the ones you did not, and an experiment whose assignment was broken on one attribute may well be broken on others you cannot see. Report the adjusted number AND the fact that the assignment was not random.`,
      check: {
        kind: 'choice',
        prompt: 'Standardising the two arms to a common platform mix gives treatment +9.5 points. What can you now claim?',
        options: [
          { key: 'adjusted', correct: true, label: 'An adjusted estimate, with the caveat that assignment was not random' },
          { key: 'causal', correct: false, label: 'That the new onboarding causes a 9.5 point improvement' },
          { key: 'nothing', correct: false, label: 'Nothing — the broken assignment makes the data unusable' },
          { key: 'exact', correct: false, label: 'That the true effect is 9.5 points, since the confounder is now removed' },
        ],
        why: 'Adjustment removes the confounder you measured. Anything else correlated with device is still in there, so the estimate is real but it is not experimental evidence.',
      },
    },
    {
      key: 'ea-06', day: 3, type: 'judgement', via: 'email', from: 'engineering_manager', minutes: 8,
      subject: 'How did the bucketing go wrong?',
      title: 'Arjun wants to know whose fault it was',
      body: `I hear the assignment was bucketed on device identifier. That is my team's code.

Before this becomes a thing in a post-mortem — is the finding "the experiment was run wrong" or "the analysis caught something"? Those land very differently for the people who wrote it.`,
      check: {
        kind: 'choice',
        prompt: 'How do you characterise the bucketing problem in your readout?',
        options: [
          { key: 'mechanism', correct: true, label: 'As a mechanism to fix in the re-run, stated without attributing it to anyone' },
          { key: 'blame', correct: false, label: 'As an error by the team that implemented the assignment' },
          { key: 'omit', correct: false, label: 'Leave it out — the corrected result is what matters' },
          { key: 'downplay', correct: false, label: 'Mention it as a minor technical detail' },
        ],
        why: 'It is the single most important thing to change next time, so it cannot be omitted or softened. But naming it as a mechanism rather than a culprit is what gets it fixed instead of defended.',
      },
    },
    {
      key: 'ea-07', day: 4, type: 'learning', via: 'email', from: 'line_manager', minutes: 13,
      subject: 'Subgroups, and how findings get manufactured',
      title: 'Read: the difference between a finding and a story',
      body: `You now have the means to produce almost any conclusion anyone wants, and this is the week you learn not to.

Five channels, three plans, two invite paths, two platforms. That is sixteen or so subgroup comparisons available to you. If the treatment genuinely does nothing at all, two or three of those will still look striking. That is not bad luck, it is what sixteen comparisons do.

Two tests before a subgroup result becomes a finding.

Was the split named before you saw the result? The platform split here was forced on you by the assignment mechanism — you had no choice but to look at it. Channel and plan you went to AFTER seeing the answer, which makes them hypotheses.

Is the cell big enough to distinguish a real difference from a few coin flips? Fifteen users means one person is nearly seven percentage points. A twenty-point swing on that base is unremarkable.

The partner result in your table fails both tests. Somebody will find it anyway, so the readout should say you looked, say what it is worth, and say what would settle it.`,
      check: {
        kind: 'choice',
        prompt: 'What makes the platform split different from the channel split in this analysis?',
        options: [
          { key: 'forced', correct: true, label: 'The assignment mechanism forced it — it was not chosen after seeing the result' },
          { key: 'bigger', correct: false, label: 'Platform has larger cells' },
          { key: 'predicts', correct: false, label: 'Platform predicts activation and channel does not' },
          { key: 'binary', correct: false, label: 'Platform is binary and channel has five levels' },
        ],
        why: 'Cell size and predictive power both matter, but the decisive difference is that you had to look at platform. A split you were compelled into is evidence; a split you chose after seeing the answer is a hypothesis.',
      },
    },
    {
      key: 'ea-08', day: 4, type: 'pressure', via: 'chat', from: 'stakeholder', minutes: 6,
      subject: 'Just give me the carve-out',
      title: 'Vikram pushes again on partner',
      body: `I hear you on sample size. But the partner number is 67 vs 33 — that is not a rounding error, it is double.

We only have 42 partner users in the test. Excluding them from the rollout costs us basically nothing and covers the downside. Why is that not just sensible risk management?`,
      check: {
        kind: 'answer',
        prompt: 'Answer the risk-management framing specifically.',
        markers: ['permanent|two path|maintain|forever|cost|not free|both direction|equally likely|noise|15|would also'],
        why: 'A carve-out is not free — it is two onboarding paths to maintain indefinitely. And a swing that size on 15 users is as likely to point the wrong way as the right one, so the "downside cover" is imaginary in both directions.',
      },
    },
    {
      key: 'ea-09', day: 5, type: 'learning', via: 'email', from: 'line_manager', minutes: 11,
      subject: 'Precision you can defend',
      title: 'Read: how many digits you have earned',
      body: `Your standardised result is 47.1 against 37.6. You will be tempted to write exactly that, because it is what came out of the notebook.

Do not. On 291 users, the second digit is not real. Quote it and it gets repeated to one decimal place for a year, in decks you never see, as though it were measured.

Round to what you can defend. "About nine points better." "Better in both segments." Those survive being forwarded without you in the thread, which is the actual test of a number in a readout.

There is a related habit worth having. Prefer percentage points to ratios for effects like this. "Nine points better" is hard to misread. "A quarter better" is the same fact framed to sound larger, and somebody will use it that way.

The rule underneath both: write the number at the precision your evidence supports, not the precision your tool printed.`,
      check: {
        kind: 'choice',
        prompt: 'Your standardised figures are 37.6 and 47.1 on 291 users. What goes in the readout headline?',
        options: [
          { key: 'about', correct: true, label: '"About nine points better, once the arms are matched"' },
          { key: 'exact', correct: false, label: '"47.1% against 37.6%"' },
          { key: 'ratio', correct: false, label: '"Roughly 25% better"' },
          { key: 'round', correct: false, label: '"47% against 38%"' },
        ],
        why: 'The last one is better than quoting decimals but still presents two point estimates as though they were measured. Leading with the difference, hedged, is what survives being forwarded.',
      },
    },
    {
      key: 'ea-10', day: 5, type: 'reflection', via: 'chat', from: 'line_manager', minutes: 8,
      subject: 'Before the readout goes',
      title: 'Asha: you have reversed a company decision',
      body: `Worth sitting with for a moment. Ten days ago this company was going to roll back a change that works. The only reason it is not is that somebody checked the composition of the arms before reading the outcome.

That is the senior job in one sentence. Not harder SQL — asking whether the comparison in front of you is a comparison at all.

Two questions before you send it, and they are the ones I would ask in a review.

If Priya forwards your readout to someone who was not in any of these conversations, what is the one sentence they will take away? Make sure it is the one you want.

And: what would have to be true for you to be wrong?`,
      check: {
        kind: 'answer',
        prompt: 'Answer the second one. What would make your conclusion wrong?',
        markers: ['confound|unmeasur|device|correlat|not random|another|other variable|assign|small|33|web arm|selection|unknown'],
        why: 'Something else correlated with device that you cannot see, and a 33-user web treatment cell carrying the larger of the two segment effects. Naming your own weakest point is what stops somebody else naming it for you.',
      },
    },
  ],
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
  'capacity-review': [
    {
      key: 'maa-01', day: 1, type: 'learning', via: 'email', from: 'line_manager', minutes: 14,
      subject: 'Your first week with the team as the subject',
      title: 'Asha: what changes when the data is about people you manage',
      body: `Congratulations on the job. Here is the part nobody puts in the handover note.

Every review you have run so far was about something — a market, a product, a payroll. This one is about thirteen people who report to you, and that changes what a wrong answer costs. A misread retail figure produces a bad range decision and somebody notices in a month. A misread capacity figure produces a performance conversation with a named person, and that lands on them the same afternoon.

So two rules, and they are not optional at this level.

First: no measure leaves your desk attached to a person's name unless you would defend it in a room with them in it. Not "unless it is accurate" — accurate is not the bar. Defensible in front of the person.

Second: when somebody asks you to rank the team, the honest answer is usually that ranking them is your job and not the data's. You are the instrument. That is uncomfortable and it is what you are paid for.

You will get asked for the table this week. Everybody does.`,
      check: {
        kind: 'choice',
        prompt: 'What is the bar for publishing a measure with somebody\'s name against it?',
        options: [
          { key: 'defend', correct: true, label: 'You would defend it in a room with that person present' },
          { key: 'accurate', correct: false, label: 'It is arithmetically accurate' },
          { key: 'caveat', correct: false, label: 'It carries a caveat about what it does and does not show' },
          { key: 'asked', correct: false, label: 'Somebody senior has asked for it twice' },
        ],
        why: 'Accuracy is cheap — the hours table is accurate. A caveat does not travel with the document. And being asked twice is pressure, not evidence.',
      },
    },
    {
      key: 'maa-02', day: 1, type: 'learning', via: 'email', from: 'finance_analyst', minutes: 11,
      subject: 'How a budget round actually reads numbers',
      title: 'Diya: a rate is a weapon, not a fact',
      body: `You are about to hand figures into a budget round for the first time. A short warning about what happens to them in there.

A budget round does not read your analysis. It reads one number per cost line and compares it to the other cost lines. Whatever you send, the thing that survives is the rate — cost per something, per head, per output. It gets lifted out of your email, put on a slide, and repeated in rooms you are not in.

So the question to ask before you publish a rate is not "is this correct". It is: what will this number be used to argue, by someone who has read nothing else?

A cost per analysis that is eight times too high will be used to argue that analytics is expensive. It will not be used to argue that the timesheets are incomplete, however clearly you say so, because the sentence about timesheets does not fit on the slide and the rate does.

If a rate cannot survive being quoted alone, do not produce it. Give them the thing that can.`,
      check: {
        kind: 'answer',
        prompt: 'What question should you ask before publishing a rate?',
        markers: ['argue|used|quoted|alone|without|context|slide|read nothing|survive|on its own'],
        why: 'Correctness is the easy test and it is not the binding one. The binding test is what the number does once it is separated from everything you wrote around it.',
      },
    },
    {
      key: 'maa-03', day: 2, type: 'learning', via: 'email', from: 'data_engineer', minutes: 12,
      subject: 'Why the timesheets look like that',
      title: 'Rahul: self-reported data measures the reporting, not the thing',
      body: `Before you draw conclusions from the time logs, some history on where they come from.

Nobody is required to fill them in. There is no approval step, no reminder, and no consequence for an empty week. They exist because a tool we bought in 2023 had the feature switched on by default.

That gives you a classic self-reported dataset, and self-reported datasets have one property worth memorising: the variation between people is mostly variation in reporting behaviour, not in the underlying thing. When response is voluntary and unenforced, whoever answers is whoever finds answering easy.

Two practical consequences.

Proportions survive better than totals. If somebody logs half their time, the SHAPE of what they logged is probably roughly right even though the level is badly wrong. What people work on is more recoverable than how much.

And comparisons between people do not survive at all. A total that is uniformly short can be scaled by a factor you estimate. A comparison between a diligent logger and a lax one cannot be rescued by any factor, because you would need a different factor for each of them and the data cannot tell you either.`,
      check: {
        kind: 'choice',
        prompt: 'Which use of a voluntary, unenforced timesheet is least damaged by its coverage?',
        options: [
          { key: 'mix', correct: true, label: 'The mix — what proportion of effort went to each requesting function' },
          { key: 'rate', correct: false, label: 'Cost per hour, scaled up to allow for the missing time' },
          { key: 'rank', correct: false, label: 'Ranking analysts by hours, with people present less than a year excluded' },
          { key: 'total', correct: false, label: 'Total hours worked by the team this year' },
        ],
        why: 'Scaling needs a factor you do not have. Ranking needs a different factor per person. The total is simply eight times short. The mix is the one thing a partial sample can still carry.',
      },
    },
    {
      key: 'maa-04', day: 2, type: 'policy', via: 'email', from: 'people_partner', minutes: 9,
      subject: 'Before you use timesheet data about individuals',
      title: 'Neha: the rules on individual performance data',
      body: `Flagging this now because you have pulled the time logs and the budget round is coming.

The policy is short. Data collected for one purpose is not automatically available for another. The time logs were switched on to attribute effort to projects. Using them to assess individual performance is a different purpose, and it needs the people concerned to know it is happening.

That is not a bureaucratic point. If thirteen people learn in a budget round that their timesheets were used to rank them, two things follow: the ones who look bad are being assessed on an administrative habit, and everybody starts logging strategically from the following Monday. You lose the data and the trust in one move.

If you do intend to use it that way, tell the team first, in writing, before it leaves your desk. If you do not intend to, tell them that too — they will hear that analytics timesheets came up in a budget round either way, and the version they hear from you is better than the version they hear from somebody else.`,
      check: {
        kind: 'choice',
        prompt: 'You are using team timesheet data in a budget conversation. What does the team need from you?',
        options: [
          { key: 'before', correct: true, label: 'To hear it from you, in writing, before it leaves your desk' },
          { key: 'after', correct: false, label: 'A summary afterwards of what was said and decided' },
          { key: 'nothing', correct: false, label: 'Nothing, as long as no individual is named' },
          { key: 'consent', correct: false, label: 'Individual sign-off from each of the thirteen' },
        ],
        why: 'Afterwards is too late to be a choice. Aggregation helps but the team still hears their timesheets came up. Individual consent turns a management decision into a negotiation.',
      },
    },
    {
      key: 'maa-05', day: 3, type: 'learning', via: 'email', from: 'line_manager', minutes: 15,
      subject: 'Denominators',
      title: 'Asha: the same cost, divided two ways',
      body: `You have found the coverage problem. Now the harder half: what to do with two numbers that are both arithmetically correct and eight times apart.

The team costs roughly ₹3.09 crore a year. Divide by the 3,193 hours anyone bothered to log and you get about ₹9,664 an hour. Divide by the hours the company actually paid for — days present, working days, eight hours a day — and you get about ₹1,241.

Neither is a mistake. They answer different questions. The first answers "what does an hour of recorded analyst time cost", which is a question about the timesheet. The second answers "what does an hour of analyst capacity cost", which is a question about the business.

The instinct is to publish the second and call the first wrong. Do not do that. Publish the second and SHOW the first, because somebody else will compute the first within a week and you want them to find your version of it rather than discover it themselves and wonder what else you left out.

The general rule: when a figure has a defensible alternative, the alternative goes on the same page. A number that only survives because nobody else has done the arithmetic is not a number you own.`,
      check: {
        kind: 'answer',
        prompt: 'Why show the naive rate rather than only the defensible one?',
        markers: ['somebody|someone|else|will|compute|find|discover|own|transparen|same page|credib|trust|later|themselves'],
        why: 'Because the arithmetic is two lines and someone will do it. A figure you did not mention, found by someone else, costs more than the figure itself ever could.',
      },
    },
    {
      key: 'maa-06', day: 3, type: 'learning', via: 'chat', from: 'stakeholder', minutes: 8,
      subject: 'What I actually do with your numbers',
      title: 'Vikram: how a rate gets used once it leaves you',
      body: `Since we are going to disagree this week, here is my side, so you know what you are arguing with.

I am not trying to catch anybody out. I sit in a room with six cost lines and I have to say something about each of them. For most of them I have a rate. Cost per order, cost per ticket, cost per hire. When analytics has no rate, the room does not conclude that analytics is unmeasurable. It concludes that analytics has not done the work, and the cut lands there rather than somewhere else.

So when I push you for a number, that is what I am pushing for. Something I can put next to the other five lines.

What actually helps me is a rate you will defend, plus one sentence on what it does not mean. What does not help me is being told the question is wrong, because I still have to say something in that room.

Give me something I can carry.`,
      check: {
        kind: 'choice',
        prompt: 'What is the strongest response to "I need a rate for the room"?',
        options: [
          { key: 'defensible', correct: true, label: 'Give the capacity-hour rate, with the naive one shown beside it and one line on the difference' },
          { key: 'refuse', correct: false, label: 'Explain that no rate is defensible until timesheet coverage improves' },
          { key: 'naive', correct: false, label: 'Give the logged-hour rate with a clear health warning attached' },
          { key: 'defer', correct: false, label: 'Ask for the budget conversation to be deferred to the next round' },
        ],
        why: 'Refusing leaves him with nothing and the cut lands on analytics anyway. The naive rate with a warning is the rate without the warning by the second retelling. The answer is a rate you will stand behind.',
      },
    },
    {
      key: 'maa-07', day: 4, type: 'learning', via: 'email', from: 'people_partner', minutes: 12,
      subject: 'Headcount, capacity and the word establishment',
      title: 'Neha: fourteen people is not fourteen people',
      body: `You are being asked whether fourteen is the right number, so it is worth being precise about what fourteen means.

Establishment is the number of posts. Headcount is the number of humans in them on a given day. Capacity is what those humans were actually present to do over a period, and it is the only one of the three that belongs in the denominator of anything.

This year they are all different. Somebody left at the end of January and somebody joined in March. Thirteen people below manager level bought you 11.92 person-years — a whole person short of what the headcount suggests, from ordinary joining and leaving nobody did anything wrong in.

That gap is also why "we are at fourteen and still behind" is not the argument it sounds like. Some of the shortfall is not a shortfall in establishment at all; it is the six weeks a post sat empty and the three months before a March joiner was useful. Hiring does not fix that. Faster replacement does, and it is cheaper.

The sentence worth having ready: a post is not a person, and a person is not a person-year.`,
      check: {
        kind: 'choice',
        prompt: 'Thirteen people below manager level, 11.92 person-years present. What does that gap chiefly show?',
        options: [
          { key: 'churn', correct: true, label: 'Ordinary joining and leaving, which hiring more posts does not fix' },
          { key: 'absence', correct: false, label: 'Unrecorded absence that should be investigated' },
          { key: 'under', correct: false, label: 'That the team is under-established by about one post' },
          { key: 'error', correct: false, label: 'A data problem in the start and leave dates' },
        ],
        why: 'A leaver in January and a joiner in March account for it exactly. Reading it as under-establishment turns a replacement-speed problem into a hiring request.',
      },
    },
    {
      key: 'maa-08', day: 4, type: 'learning', via: 'email', from: 'finance_analyst', minutes: 10,
      subject: 'Cancelled work in a budget conversation',
      title: 'Diya: the cheapest capacity in the building',
      body: `You have found 485 hours logged against work that was later cancelled — about 15% of everything recorded. A word on how to use that, because it is the most useful thing in your whole review and the easiest to waste.

Do not present it as waste. The moment it is called waste, the conversation becomes about who cancelled what, and the requesting functions become defensive, and nothing changes.

Present it as available capacity. Fifteen per cent of effort went to work the business stopped wanting. Recovering even half of that is worth more than a hire, costs nothing, and is in the gift of the people in the room rather than the people in your team.

That reframes the whole establishment question. "Do we need more analysts" becomes "do we want to keep paying for work we cancel", and the second question is one an exec can act on this quarter.

One caution. The 15% is a floor, not an estimate. It is 15% of LOGGED hours, and logged hours are an eighth of the real ones. The proportion is the reliable part.`,
      check: {
        kind: 'answer',
        prompt: 'Why present cancelled effort as available capacity rather than as waste?',
        markers: ['defensive|blame|who|actionable|act|capacity|hire|cheaper|reframe|room|their gift|change|argument'],
        why: 'Waste is an accusation and produces a search for the guilty. Available capacity is an offer, and it turns a hiring request into a decision the room can actually take.',
      },
    },
    {
      key: 'maa-09', day: 5, type: 'learning', via: 'email', from: 'line_manager', minutes: 13,
      subject: 'Writing for a budget round',
      title: 'Asha: what a slide does to a sentence',
      body: `Last thing before this goes in. A note on the medium, because the budget pack is not an email and will not behave like one.

A slide is read for four seconds by someone who is thinking about the next slide. Whatever is largest and most quotable is what survives; everything else is decoration. That is not a failure of the audience, it is what packs are for.

So: whatever you most need to be true about how your figures are read has to be the biggest thing on the page, not a qualifier under it. If the coverage caveat matters more than the rate — and here it does — then the coverage is the line and the rate is the supporting detail, not the other way round.

And be specific about the failure you are preventing. "Utilisation is low at 13%, suggesting spare capacity" is a sentence somebody will write with no bad intent at all. It reads as an observation. It is actually a recommendation to cut, dressed as arithmetic, and it will be read as one.

Your job on a slide is not to be accurate. It is to make the wrong reading harder than the right one.`,
      check: {
        kind: 'choice',
        prompt: 'The slide says "utilisation is low at 13%, suggesting spare capacity". What is wrong with it?',
        options: [
          { key: 'recommend', correct: true, label: 'It reads as an observation but functions as a recommendation to cut' },
          { key: 'rounding', correct: false, label: 'The figure should be 12.8% rather than 13%' },
          { key: 'vague', correct: false, label: 'It does not say what period the utilisation covers' },
          { key: 'jargon', correct: false, label: 'Utilisation is a term the board will not know' },
        ],
        why: 'The rounding is the least of it. The number is not utilisation at all — it is timesheet coverage — and the second clause converts a measurement error into a resourcing decision.',
      },
    },
    {
      key: 'maa-10', day: 5, type: 'reflection', via: 'chat', from: 'line_manager', minutes: 7,
      subject: 'End of your first review as manager',
      title: 'Asha: what you refused',
      body: `Week done. One reflection rather than a debrief.

The technical work this week was not hard. Coverage, a denominator, a couple of group-bys. Any of your team could have written the queries.

What you did that they could not was refuse the table. Vikram asked twice, politely, with a good reason, and offered to read it sensibly. Saying no to that costs something — he is senior, he is not being unreasonable, and the refusal makes you look obstructive for about a day.

That is most of the job now. Not finding the number. Deciding which numbers are allowed to exist with names attached to them, and carrying the cost of the ones you withhold.

Have a think over the weekend about what else in the team's reporting would not survive the test you applied this week.`,
      check: {
        kind: 'answer',
        prompt: 'What was the hardest part of this week, and why?',
        markers: ['refus|no|decline|table|withhold|say no|vikram|cost|obstruct|unpopular|judgement|stand'],
        why: 'The queries were routine. Declining a reasonable request from a senior person, twice, with no data to hide behind, is the part that is new at this level.',
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
  'board-pack': [
    {
      key: 'tds-01', day: 1, type: 'scope', via: 'email', from: 'line_manager',
      subject: 'How much of the pack do you want to own?',
      body: `You can reconcile the three revenue figures and hand the rest back, or you can own the whole pack including the forward estimate.

Owning it means you carry the estimate into the room. Your call.`,
      needsReply: true,
      expect: ['choose', 'say what owning it requires'],
      markers: ['own|whole|all|estimate|assumption|reconcil|both|yes|scope|room|carry'],
      ifIgnored: 'Asha assumes the narrow scope, and the estimate goes in as this year plus five percent with nobody having checked it.',
      note: 'Owning the estimate is the right call and it has a condition: the assumptions go on the page or you cannot defend it.',
    },
    {
      key: 'tds-02', day: 1, type: 'noise', via: 'email', from: 'broadcast',
      subject: 'Board papers — circulation deadline',
      body: `A reminder that all board papers must reach the company secretary five working days before the meeting.

Function heads have been notified directly of their deadlines.`,
      expect: ['archive it'],
      note: 'Directed at function heads, who have been told separately. Nothing to do.',
    },
    {
      key: 'tds-03', day: 2, type: 'pressure', via: 'chat', from: 'stakeholder',
      subject: 'Revenue number, now',
      body: `Someone has asked me for the year revenue figure for an external filing. What do I give them?`,
      needsReply: true,
      expect: ['net, whole estate', 'and say why not like-for-like'],
      markers: ['net|whole|all store|entire|estate|not like.for.like|48|4\\.81|statutory|external|dedup'],
      ifIgnored: 'A like-for-like figure ends up in an external filing, understating the business by ₹36 lakh with no way to explain it later.',
      note: 'External filings want what the business earned: net, every store, corrected. Like-for-like is a management measure.',
    },
    {
      key: 'tds-04', day: 2, type: 'noise', via: 'chat', from: 'data_engineer',
      subject: 'Turning the bridge into a scheduled view',
      body: `Since you are building it as one computation this year, I am wrapping it in a scheduled view with the window dates and the like-for-like test as parameters rather than literals.

Next year it is a refresh instead of a rebuild. Nothing needed from you.`,
      expect: ['archive it'],
      note: 'He has read the shape of what you built and drawn the right conclusion. Nothing to answer.',
    },
    {
      key: 'tds-05', day: 3, type: 'judgement', via: 'email', from: 'finance_analyst',
      subject: 'You are changing the correction again',
      body: `The trading review excluded that whole month. Now you are halving it instead.

I have to explain to my team why the same fault has been treated two different ways in two documents. Help me out.`,
      needsReply: true,
      expect: ['explain the two treatments', 'say why both are right'],
      markers: ['comparison|total|repair|exclude|question|different|both|earned|clean|recover|identical'],
      ifIgnored: 'Finance conclude the analytics team changes its mind, and every future correction is challenged on principle.',
      note: 'Repair for a total, exclude for a comparison. Same fault, different question, both defensible — and that is a sentence worth her having.',
    },
    {
      key: 'tds-06', day: 3, type: 'noise', via: 'email', from: 'it_ops',
      subject: 'Automated: duplicate-load check now active',
      body: `The scheduled duplicate-load check for the retail feed is now active and will run on the first of each month.

Alerts route to the retail analytics distribution list. No action required.`,
      expect: ['archive it'],
      note: 'The control you asked for, now live. Nothing to reply to — and worth noticing that it exists because somebody asked.',
    },
    {
      key: 'tds-07', day: 4, type: 'pressure', via: 'email', from: 'stakeholder',
      subject: 'The board will want growth',
      body: `I have been doing this a long time and a flat number does not land. They will ask what we are doing about it and the answer cannot be "nothing".

Can we not find a growth assumption we can justify?`,
      needsReply: true,
      expect: ['decline to invent one', 'offer what would justify one'],
      markers: ['cannot|no evidence|declin|fell|17|justif|would need|plan|initiative|not from this|separate'],
      ifIgnored: 'A growth assumption goes into the estimate with analytics\' name on it and no evidence behind it.',
      note: 'A growth assumption has to come from a plan somebody owns — a new store, a range change, a price move — not from the analysis.',
    },
    {
      key: 'tds-08', day: 4, type: 'question', via: 'email', from: 'people_partner',
      subject: 'Store targets from your estimate',
      body: `If the board accepts your number, it becomes next year's store targets.

Is there anything about how you built it that would make a per-store split unfair?`,
      needsReply: true,
      expect: ['name what would make a naive split unfair'],
      markers: ['new store|annualis|salt lake|sector|part year|closed|promotion|november|flat|assum|not evenly|daily rate'],
      ifIgnored: 'Store targets are set by splitting the total evenly, and two new stores get targets built on an annualised opening peak.',
      note: 'The new stores are annualised from a few months at their opening rate, and the estimate assumes flat trading everywhere. Neither survives being turned into a store target unexamined.',
    },
    {
      key: 'tds-09', day: 5, type: 'judgement', via: 'email', from: 'stakeholder',
      subject: 'A board member has pre-read it',
      body: `One of the non-executives has read the pack early and come back with a question: why is revenue different from the figure in the half-year pack?

I need an answer before Thursday.`,
      needsReply: true,
      expect: ['the basis changed, not the figure', 'point at the bridge'],
      markers: ['basis|definition|bridge|not wrong|different question|page|reconcil|both|gross|net|like.for.like'],
      ifIgnored: 'Vikram answers from memory in the meeting and the board spends its time on which number is right.',
      note: 'The figure did not change — the basis did, and the bridge is on the page precisely so this question has a one-sentence answer.',
    },
    {
      key: 'tds-10', day: 5, type: 'question', via: 'chat', from: 'line_manager',
      subject: 'One line for the board summary',
      body: `One line from you at the top of the summary. What does the board need to know before anything else?`,
      needsReply: true,
      expect: ['one thing', 'stated as what it changes'],
      markers: ['like.for.like|declin|fell|17|trading|estate|new store|growth|not|headline|basis'],
      ifIgnored: 'Asha writes it from the definitions note, which is the least interesting page in the pack.',
      note: 'The business is larger and the shops are trading worse. That is the sentence, and everything else in the pack supports it.',
    },
  ],
  'range-review': [
    {
      key: 'tcs-01', day: 1, type: 'scope', via: 'email', from: 'stakeholder',
      subject: 'How wide is this review?',
      body: `Range review or full space review? The second one means bringing in the planogram system and that is a fortnight, not a week.

What do you want to take on?`,
      needsReply: true,
      expect: ['pick a scope', 'say what the narrower one cannot answer'],
      markers: ['range|week|not space|planogram|cannot|space|saving|scope|delist|narrower|without'],
      ifIgnored: 'Vikram assumes a full space review, and the paper arrives expecting a saving figure the range data cannot produce.',
      note: 'Scoping to the range is the right call for a week. Say what it means you will not be able to answer — which is the saving side of the delist.',
    },
    {
      key: 'tcs-02', day: 1, type: 'noise', via: 'email', from: 'broadcast',
      subject: 'Spring reset dates confirmed',
      body: `Store reset dates for the spring range change have been confirmed and published to the operations calendar.

Store teams have been briefed directly. No action for support functions.`,
      expect: ['archive it'],
      note: 'Useful context, no action.',
    },
    {
      key: 'tcs-03', day: 2, type: 'pressure', via: 'chat', from: 'stakeholder',
      subject: 'Bottom twenty, this afternoon',
      body: `Can you send me the bottom twenty lines by margin? Putting a slide together for the buying meeting.`,
      needsReply: true,
      expect: ['send it with the cost framing', 'name what is missing'],
      markers: ['8\\.6|lose|cost|not save|substitut|space|seven|never sold|separate|context'],
      ifIgnored: 'A bottom-twenty list goes into a buying meeting framed as a saving, with none of the seven never-sold lines on it.',
      note: 'The list is fine to send. What it must not go out as is a saving, and it should not exclude the seven that never sold.',
    },
    {
      key: 'tcs-04', day: 2, type: 'noise', via: 'chat', from: 'data_engineer',
      subject: 'Scheduling a range-completeness check',
      body: `The seven never-ranged lines would be caught by a one-line check, so I am scheduling it monthly and pointing the alert at buying rather than us — they are the ones who can act on it.

Live from next month. Nothing needed from you.`,
      expect: ['archive it'],
      note: 'He has decided and told you. Useful to know, nothing to answer.',
    },
    {
      key: 'tcs-05', day: 3, type: 'judgement', via: 'email', from: 'finance_analyst',
      subject: 'Stock cover for the working capital paper',
      body: `I am writing the working capital paper and I was told you have stock cover by product now.

Can you send it? I need it by Thursday.`,
      needsReply: true,
      expect: ['decline', 'explain why and what would fix it'],
      markers: ['cannot|not|uniform|same|twenty|20|regardless|quarterly|snapshot|counts|movement|weekly|do not'],
      ifIgnored: 'The cover figure ends up in a working capital paper, where a wrong number has a direct financial consequence.',
      note: 'This is the second team asking for it. Declining in writing, with the reason, is what stops it circulating.',
    },
    {
      key: 'tcs-06', day: 3, type: 'noise', via: 'email', from: 'it_ops',
      subject: 'Automated: stock count file received',
      body: `The quarterly stock count file for the current period has been received and loaded.

Records processed: 613. No errors. No action required.`,
      expect: ['archive it'],
      note: 'Automated and successful — and quietly the reason the cover calculation cannot work. Nothing to reply to.',
    },
    {
      key: 'tcs-07', day: 4, type: 'pressure', via: 'email', from: 'stakeholder',
      subject: 'Supplier has heard about the review',
      body: `One of our coffee suppliers has heard there is a range review and asked me directly whether their lines are affected.

You have the list. What do I tell them?`,
      needsReply: true,
      expect: ['do not confirm or deny', 'route it to buying'],
      markers: ['sneha|buying|cannot|not discuss|refer|route|negotiat|commercial|no comment|them'],
      ifIgnored: 'Vikram answers on instinct, and the supplier enters the next cost negotiation knowing which of their lines we were about to drop.',
      note: 'Not yours to answer, and a denial for safe lines makes silence identify the unsafe ones. It goes to Sneha.',
    },
    {
      key: 'tcs-08', day: 4, type: 'question', via: 'chat', from: 'line_manager',
      subject: 'Is the candidate list defensible?',
      body: `Before this goes to buying — if Sneha challenges a specific line, can you say why it is on the list?`,
      needsReply: true,
      expect: ['yes, and say on what basis'],
      markers: ['never sold|margin|120|threshold|which test|both|per store|rule|stated|each'],
      ifIgnored: 'The list goes over with no stated basis, and the first challenged line collapses the whole paper.',
      note: 'Each candidate fails a named test: never sold, or under the margin floor. Being able to say which is what makes it survive a meeting.',
    },
    {
      key: 'tcs-09', day: 5, type: 'judgement', via: 'email', from: 'people_partner',
      subject: 'Buying team and the never-ranged lines',
      body: `The seven lines that were never ranged were signed off by a buyer who still works here.

Your note frames it as a process gap, which I think is right. But it will be read by her manager. Anything you want to change before it goes wider?`,
      needsReply: true,
      expect: ['keep the process framing', 'say what makes it not an individual failure'],
      markers: ['process|system|not|individual|nobody|no check|invisible|gap|anyone|would have|blameless'],
      ifIgnored: 'A process finding becomes a performance conversation about one buyer, and the process stays unfixed.',
      note: 'Nobody could see them — every review used a query that deletes them. That is the sentence that keeps it about the process.',
    },
    {
      key: 'tcs-10', day: 5, type: 'question', via: 'chat', from: 'line_manager',
      subject: 'One line for the buying meeting agenda',
      body: `Buying meet Monday. One line from you on the agenda.`,
      needsReply: true,
      expect: ['one thing', 'the one that changes the decision'],
      markers: ['seven|never|cost|not saving|6\\.8|cover|cannot|framing|lose'],
      ifIgnored: 'Asha writes it from the paper\'s first paragraph, which is the methodology note.',
      note: 'Either the seven invisible lines or the fact that the delist is a cost rather than a saving. Both change what happens in the room.',
    },
  ],
  'margin-review': [
    {
      key: 'tbs-01', day: 1, type: 'scope', via: 'email', from: 'finance_analyst',
      subject: 'Do you need supplier invoices?',
      body: `If the cost column is not reliable I can request the actual invoice history from procurement. It is about a week to get it.

Do you need it, or can you work with what is in the table?`,
      needsReply: true,
      expect: ['answer yes or no', 'say what the table already supports'],
      markers: ['previous_unit_cost|cost_changed_on|two point|enough|no|not need|table|sufficient|later|history|already'],
      ifIgnored: 'Procurement spend a week on an extract that arrives after the range review, and the review uses the naive figure anyway.',
      note: 'The table has the previous cost and the date it changed. That is a two-point history and it is enough for this.',
    },
    {
      key: 'tbs-02', day: 1, type: 'noise', via: 'email', from: 'broadcast',
      subject: 'Quarterly all-hands — slides due Friday',
      body: `A reminder that slides for the quarterly all-hands are due with Comms by Friday.

Function leads have been contacted directly where a contribution is expected.`,
      expect: ['archive it'],
      note: 'Directed at people who have been contacted directly. You have not been.',
    },
    {
      key: 'tbs-03', day: 2, type: 'pressure', via: 'chat', from: 'stakeholder',
      subject: 'Range slide, this afternoon',
      body: `Range review prep is at four. Send me margin by category — I will put it straight on the slide.`,
      needsReply: true,
      expect: ['send rate and contribution together', 'say why both'],
      markers: ['contribution|rupee|both|two column|crore|lakh|equipment|rank|revers|1\\.08'],
      ifIgnored: 'The rate-only table goes on the slide, Equipment ranks last, and the range review opens with a proposal to cut it.',
      note: 'Rate alone ranks Merchandise first and the largest margin contributor last. Send both columns.',
    },
    {
      key: 'tbs-04', day: 2, type: 'question', via: 'chat', from: 'data_engineer',
      subject: 'Which cost do you want in the view?',
      body: `Building the cost view you asked about. Quick question — do you want it to carry the applicable cost, the current cost, or both?

Both is barely more work if you tell me now.`,
      needsReply: true,
      expect: ['answer', 'say what each is for'],
      markers: ['both|two|applicable|current|report|forward|range|purpose|label|column'],
      ifIgnored: 'The view ships with one cost, and the range review rebuilds the other one by hand three weeks later.',
      note: 'Both, clearly named. One is for reporting what happened, the other for deciding what to stock.',
    },
    {
      key: 'tbs-05', day: 3, type: 'noise', via: 'email', from: 'security',
      subject: 'Automated: supplier portal certificate renewed',
      body: `The certificate for the supplier pricing portal has been renewed and will expire in twelve months.

No action required. Access is unaffected.`,
      expect: ['archive it'],
      note: 'Automated, renewed, nothing to do.',
    },
    {
      key: 'tbs-06', day: 3, type: 'noise', via: 'email', from: 'it_ops',
      subject: 'Automated: query timeout threshold raised',
      body: `The analytics warehouse query timeout has been raised from 60 to 180 seconds following a review of long-running reports.

No action required.`,
      expect: ['archive it'],
      note: 'Automated, helpful, nothing to answer.',
    },
    {
      key: 'tbs-07', day: 4, type: 'pressure', via: 'chat', from: 'stakeholder',
      subject: 'Marketing want the November number',
      body: `Marketing are writing up the November promotion and want a line from us.

They have asked for "the revenue uplift". Can I just give them 39%?`,
      needsReply: true,
      expect: ['say what else has to go with it', 'give the other figures'],
      markers: ['margin|12|units|55|rate|35\\.5|44|three|alone|context|not just'],
      ifIgnored: 'A 39% uplift figure enters circulation with no margin beside it, and next year\'s promotion is planned on it.',
      note: 'The revenue number alone is the most flattering of the three and it will be the only one anybody remembers.',
    },
    {
      key: 'tbs-08', day: 4, type: 'question', via: 'email', from: 'people_partner',
      subject: 'Store manager bonus and margin',
      body: `Store manager bonuses are partly on margin percentage. Now that the cost basis is changing, some managers will see their figure move through no action of their own.

Does that affect anyone materially, and what should I tell them?`,
      needsReply: true,
      expect: ['say the restatement is a basis change, not performance', 'say who is most affected'],
      markers: ['basis|not performance|no action|equipment|categor|mix|restate|same period|both|compar|explain'],
      ifIgnored: 'Managers see their margin percentage change with no explanation and conclude the numbers are arbitrary.',
      note: 'Stores selling more Equipment move most, because that is where the reprices are. It is a basis change and both bases should be shown for the same period.',
    },
    {
      key: 'tbs-09', day: 5, type: 'judgement', via: 'email', from: 'stakeholder',
      subject: 'Planning want a recommendation',
      body: `Planning have asked again for a straight recommendation on repeating November. They say a trade-off table is not a decision.

They are not wrong about that. What do we do?`,
      needsReply: true,
      expect: ['hold the line on who decides', 'say what would let you recommend'],
      markers: ['objective|what it was for|stock|repeat|came back|would need|if|then|their decision|cannot|missing'],
      ifIgnored: 'Analytics is recorded as having recommended the promotion, and owns the outcome.',
      note: 'They are right that a table is not a decision. The answer is what is missing — the objective, and whether those customers returned.',
    },
    {
      key: 'tbs-10', day: 5, type: 'question', via: 'chat', from: 'line_manager',
      subject: 'One line for the range review agenda',
      body: `Range review is Monday. One line from you on the agenda — what does the team need to know before they start?`,
      needsReply: true,
      expect: ['one thing', 'the one that changes the decision'],
      markers: ['cost basis|restate|contribution|rate|equipment|crore|both|margin moved|not what|basis'],
      ifIgnored: 'The review opens on the old margin figures and the correction comes out halfway through.',
      note: 'Every margin figure they have seen was on the wrong basis, and Equipment is the largest contributor despite the lowest rate. One of those two.',
    },
  ],
  'trading-review': [
    {
      key: 'tas-01', day: 1, type: 'scope', via: 'email', from: 'stakeholder',
      subject: 'How deep does this go?',
      body: `Board is Tuesday. Do you want to do the full job on this pack, or check the headline figures and leave the rest?

Your call — I would rather you told me what is realistic than promised the lot and delivered half.`,
      needsReply: true,
      expect: ['pick a scope', 'say what you are leaving out'],
      markers: ['headline|figure|definition|like.for.like|store|check|scope|full|not|leave|tuesday|priorit'],
      ifIgnored: 'Vikram assumes a full review, tells the board the pack has been audited, and finds out in the room what was not looked at.',
      note: 'He has asked you to scope your own work, which is the lead question. Name what you will cover and what you will not.',
    },
    {
      key: 'tas-02', day: 1, type: 'noise', via: 'email', from: 'it_ops',
      subject: 'Automated: warehouse refresh completed',
      body: `The nightly retail warehouse refresh completed successfully at 03:14.

No action required.`,
      expect: ['archive it'],
      note: 'Automated, successful, nothing to do. Which is worth noticing later in the week — this is the job that loaded March twice and reported success.',
    },
    {
      key: 'tas-03', day: 2, type: 'noise', via: 'chat', from: 'data_engineer',
      subject: 'Building a store_days view this afternoon',
      body: `Noticed everyone computes days-open from opened_on and closed_on by hand, and three people have three versions of it.

Putting it in a view this afternoon — store_days, one row per store per reporting window. No action needed from you, just so you know it will be there tomorrow.`,
      expect: ['archive it'],
      note: 'He is telling you, not asking you. Useful to know, nothing to answer.',
    },
    {
      key: 'tas-04', day: 2, type: 'pressure', via: 'email', from: 'stakeholder',
      subject: 'Store league table for the ops call',
      body: `Ops call is in an hour and I want to open with the store ranking.

Send me whatever you have — I will caveat it.`,
      needsReply: true,
      expect: ['send the normalised version', 'name what makes it comparable'],
      markers: ['per day|open|normalis|format|salt lake|sector|february|october|compar|caveat|which'],
      ifIgnored: 'The raw ranking goes to the ops call, and the manager of a store that opened in February is asked to explain why they are bottom of the estate.',
      note: '"I will caveat it" never survives the room. Send the version that does not need one.',
    },
    {
      key: 'tas-05', day: 3, type: 'judgement', via: 'email', from: 'engineering_manager',
      subject: 'You think our loader is broken?',
      body: `Karthik mentioned you found duplicate rows in the retail feed.

Before this becomes a ticket — are you certain, or is it possible two customers bought the same thing on the same day? That happens.`,
      needsReply: true,
      expect: ['state the evidence', 'distinguish it from coincidence'],
      markers: ['52|104|every|all|contiguous|month|one store|pattern|elsewhere|2|coincidence|concentrat'],
      ifIgnored: 'Arjun closes it as expected behaviour, and March 2026 stays wrong in every report built on it.',
      note: 'He is right that coincidental matches happen. The answer is the concentration: every line in one store-month, against at most two anywhere else.',
    },
    {
      key: 'tas-06', day: 3, type: 'noise', via: 'email', from: 'facilities',
      subject: 'Fire drill — Thursday 11:00',
      body: `A routine fire drill will take place on Thursday at 11:00.

Please leave the building by the nearest exit and reassemble in the car park. Expect to be out for about twenty minutes.`,
      expect: ['archive it'],
      note: 'Nothing to answer.',
    },
    {
      key: 'tas-07', day: 4, type: 'pressure', via: 'chat', from: 'stakeholder',
      subject: 'Just give me a reason',
      body: `I have asked twice now. Nine stores down and I cannot walk into the board and say "we do not know".

Footfall, pricing, range or economy. Pick the most likely one and I will present it as a hypothesis.`,
      needsReply: true,
      expect: ['decline to pick', 'give him what you can show and what would settle it'],
      markers: ['cannot|can.t|no footfall|not in|no data|categor|where|equipment|show|would need|counter|competitor|promotion|november'],
      ifIgnored: 'He picks one himself, presents it as analytics\' view, and a budget decision follows from it.',
      note: 'Naming a cause "as a hypothesis" is how it gets quoted without the hedge. Give him where the decline sits and what would establish why.',
    },
    {
      key: 'tas-08', day: 4, type: 'question', via: 'email', from: 'finance_analyst',
      subject: 'Which number goes in the statutory pack?',
      body: `I need one revenue figure for the statutory reporting and I cannot use two.

Gross or net? And is it the whole estate or your like-for-like set?`,
      needsReply: true,
      expect: ['answer both questions', 'give a reason'],
      markers: ['net|whole|all|total|estate|statutory|not like.for.like|every store|entire|include'],
      ifIgnored: 'Diya picks one, and the statutory figure and the board figure differ with no explanation on record.',
      note: 'Statutory reporting wants what the business actually earned: net, whole estate. Like-for-like is a management measure, not an accounting one.',
    },
    {
      key: 'tas-09', day: 5, type: 'judgement', via: 'email', from: 'people_partner',
      subject: 'Ashok Nagar\'s manager has seen the draft',
      body: `The earlier draft with the 21% growth went out on a distribution list wider than intended. Ashok Nagar's manager has seen it and has told her team.

She is going to see the corrected version on Tuesday. How do you want to handle that?`,
      needsReply: true,
      expect: ['say she should be told before Tuesday', 'and by whom'],
      markers: ['before|today|tomorrow|tell|direct|call|her|advance|not the board|data fault|not her|no reflection'],
      ifIgnored: 'A store manager finds out in a board pack that her celebrated result was a data error, having already told her team about it.',
      note: 'She has to hear it before the room does, and she has to hear that it was a feed fault rather than anything she did.',
    },
    {
      key: 'tas-10', day: 5, type: 'question', via: 'chat', from: 'line_manager',
      subject: 'One line for the leadership summary',
      body: `I need a single line from you for the leadership summary that goes out with the pack.

Not the caveats. The thing that changes what we do.`,
      needsReply: true,
      expect: ['one finding', 'stated as a decision'],
      markers: ['like.for.like|17|decline|nine|estate|down|second half|check|duplicat|definition'],
      ifIgnored: 'Asha writes it from the pack\'s opening paragraph, which is the definitions section.',
      note: 'One sentence. The estate declined, it was not visible in the draft, and that is the thing leadership needs.',
    },
  ],
  'experiment-readout': [
    {
      key: 'es-01', day: 1, type: 'scope', via: 'email', from: 'stakeholder',
      subject: 'Do you need the raw assignment logs?',
      body: `The bucketing service writes its own logs — every assignment decision with the inputs it used.

Karthik can pull them but it is a day of work. Do you need them, or is the assignment table enough?`,
      needsReply: true,
      expect: ['answer yes or no', 'say what would change your mind'],
      markers: ['enough|no|not need|table|later|if|confirm|mechanism|device|cause|would help'],
      ifIgnored: 'Karthik spends a day on logs that arrive after the readout, or the mechanism goes into the re-run recommendation unverified.',
      note: 'The assignment table shows the imbalance. The logs would confirm WHY, which matters for the re-run but not for the readout.',
    },
    {
      key: 'es-02', day: 1, type: 'noise', via: 'email', from: 'broadcast',
      subject: 'All-hands moved to Friday 4pm',
      body: `This week's all-hands has moved from Thursday to Friday at 4pm to accommodate the leadership offsite.

Calendar invites have been updated automatically.`,
      expect: ['archive it'],
      note: 'Calendar already updated. Nothing to do.',
    },
    {
      key: 'es-03', day: 2, type: 'pressure', via: 'chat', from: 'stakeholder',
      subject: 'Posting in 10 minutes',
      body: `Drafting the #growth post now — treatment 36 vs control 45, rolling back.

Going out in ten minutes unless I hear otherwise.`,
      needsReply: true,
      expect: ['ask him to hold', 'give the reason'],
      markers: ['hold|wait|don.t|do not|pause|73|27|mobile|composition|not comparable|before'],
      ifIgnored: 'The rollback goes out to the whole growth channel and has to be publicly retracted on Thursday.',
      note: 'Ten minutes is enough for one sentence. The composition numbers are the sentence.',
    },
    {
      key: 'es-04', day: 2, type: 'question', via: 'chat', from: 'data_engineer',
      subject: 'Assignment table — one thing to know',
      body: `Saw you in the assignment table. One thing that is not documented anywhere: users who signed up outside 1 March to 15 May were never assigned at all.

Might be useful to you as an untouched comparison group. Might not. Flagging it either way.`,
      needsReply: true,
      expect: ['acknowledge', 'say whether it is useful'],
      markers: ['useful|yes|baseline|control|unassign|outside|compar|confirm|platform|thanks'],
      ifIgnored: 'Karthik stops flagging things that are not in the docs, which is most of what is worth knowing about this data.',
      note: 'It is extremely useful — it is the baseline that proves the platform gap exists independently of the experiment.',
    },
    {
      key: 'es-05', day: 3, type: 'judgement', via: 'email', from: 'people_partner',
      subject: 'Friday all-hands, slide 14',
      body: `Comms have slide 14 drafted as "what we learned from onboarding_v2 — knowing when to roll back".

You mentioned the result might move. I need the final version by Thursday lunchtime or this ships as written. What should it say?`,
      needsReply: true,
      expect: ['say the result reversed', 'give the line for the slide'],
      markers: ['revers|opposite|better|won|both segment|mix|composition|not roll|ship|keep'],
      ifIgnored: 'The company is told at an all-hands that it wisely rolled back a change that actually works.',
      note: 'She has given you a deadline and offered to rewrite it. This is the cheapest correction available all week.',
    },
    {
      key: 'es-06', day: 3, type: 'noise', via: 'email', from: 'security',
      subject: 'Automated: quarterly access review complete',
      body: `Your access to the analytics warehouse has been reviewed and retained at the current level.

No action required. The next review is scheduled for December.`,
      expect: ['archive it'],
      note: 'Automated, retained, nothing required.',
    },
    {
      key: 'es-07', day: 4, type: 'pressure', via: 'chat', from: 'stakeholder',
      subject: 'The partner carve-out',
      body: `Still think we should exclude partner signups from the rollout. 67 vs 33 is not nothing.

What is the actual harm in being cautious here?`,
      needsReply: true,
      expect: ['name the cost of the carve-out', 'address the cell size'],
      markers: ['15|27|small|permanent|two path|maintain|not free|noise|both direction|as likely'],
      ifIgnored: 'The rollout ships with a permanent carve-out built on fifteen users, and nobody ever revisits it.',
      note: 'Being cautious is not free. Two onboarding paths forever, on evidence that points either way.',
    },
    {
      key: 'es-08', day: 4, type: 'policy', via: 'email', from: 'people_partner',
      subject: 'Experiment results and external communication',
      body: `A standing reminder as more teams run their own tests.

Experiment results involving customer behaviour must not be shared outside the company — including in conference talks, blog posts and recruiting material — without review. This applies to aggregate results as well as anything user-level.

The review is quick. Getting it wrong is not.`,
      expect: ['read it and apply it'],
      note: 'A standing policy sent to everyone. Relevant to what you are writing, but it does not need an answer.',
    },
    {
      key: 'es-09', day: 5, type: 'judgement', via: 'email', from: 'engineering_manager',
      subject: 'Post-mortem framing',
      body: `We are doing a short post-mortem on the bucketing. I want to write it up as "analysis caught a methodology problem" rather than "engineering shipped a broken experiment".

Is that a fair characterisation of what happened, in your view?`,
      needsReply: true,
      expect: ['answer honestly', 'keep the mechanism in the record'],
      markers: ['fair|yes|both|mechanism|device|bucket|user id|must|record|change|re.run|so long as'],
      ifIgnored: 'The post-mortem ships without the one detail that stops it happening again, and Arjun believes you were fine with that.',
      note: 'The framing is fine. What must survive it is "bucket on user id, not device" — that is the whole lesson.',
    },
    {
      key: 'es-10', day: 5, type: 'question', via: 'chat', from: 'line_manager',
      subject: 'One line for Priya\'s leadership update',
      body: `Priya has a leadership update Monday and wants one line from you.

Not the readout — one line. What does she say?`,
      needsReply: true,
      expect: ['one sentence', 'the corrected direction, hedged appropriately'],
      markers: ['better|about nine|9|both|web and mobile|matched|like for like|ship|keep|reverse'],
      ifIgnored: 'Asha writes it from the readout\'s first paragraph, which is not the same as the sentence you would have chosen.',
      note: 'One sentence that survives being repeated without you in the room. That is the whole skill.',
    },
  ],
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
  'capacity-review': [
    {
      key: 'mas-01', day: 1, type: 'scope', via: 'email', from: 'line_manager',
      subject: 'How much of this do you want to take on?',
      body: `Vikram has asked you three questions and only one of them is a data question.

You can answer the cost question and leave the establishment case to me, or you can own the whole thing into the budget round. If you own it, you present it.

Tell me which by tonight.`,
      needsReply: true,
      expect: ['choose', 'say what owning it requires'],
      markers: ['own|whole|all three|establishment|present|both|yes|scope|round|carry|coverage|condition'],
      ifIgnored: 'Asha takes the narrow scope, and the establishment case goes into the round built on a cost per analysis nobody has checked.',
      note: 'Owning it is right, and it has a condition: the coverage problem goes in first, or the rate you produce gets used without it.',
    },
    {
      key: 'mas-02', day: 1, type: 'noise', via: 'email', from: 'broadcast',
      subject: 'Budget round — submission window and templates',
      body: `The FY27 budget submission window opens on the 6th and closes on the 24th.

Cost centre owners will receive their templates directly from Finance. No action is required from anyone else at this stage.`,
      expect: ['archive it'],
      note: 'Cost centre owners get their templates directly. Nothing here for you yet.',
    },
    {
      key: 'mas-03', day: 2, type: 'pressure', via: 'chat', from: 'stakeholder',
      subject: 'Quick one — who is your strongest?',
      body: `Informal, not for anything official. Out of your thirteen, who would you say is carrying the most?

I am putting a cross-functional group together and I want your best person on it.`,
      needsReply: true,
      expect: ['answer from your own judgement', 'not from the hours table'],
      markers: ['my view|I think|judge|assess|not the|hours|timesheet|log|would not|based on|know them|work|delivered'],
      ifIgnored: 'He picks from the hours table he has already seen, and the best administrator in the team gets volunteered for a project they did not ask for.',
      note: 'A perfectly reasonable question, and the answer is yours rather than the data\'s. Naming somebody is fine; naming them because they logged 444 hours is not.',
    },
    {
      key: 'mas-04', day: 2, type: 'noise', via: 'chat', from: 'it_ops',
      subject: 'Time logging tool — maintenance window',
      body: `The time logging tool will be unavailable between 22:00 and 01:00 on Saturday for a scheduled upgrade.

Entries submitted before the window are unaffected.`,
      expect: ['archive it'],
      note: 'A maintenance notice on a Saturday night for a tool nobody uses at the weekend.',
    },
    {
      key: 'mas-05', day: 3, type: 'judgement', via: 'email', from: 'stakeholder',
      subject: 'The ₹9,664 figure',
      body: `You sent me a cost per hour on Monday and now you are telling me it is out by a factor of eight.

I have already used it once, in passing, with Finance. What do I tell them?`,
      needsReply: true,
      expect: ['give him the correction and the sentence to use', 'own the Monday figure'],
      markers: ['my|mine|I sent|apolog|correct|1,?241|1241|capacity|coverage|12\\.8|denominator|both|same cost|tell them|say'],
      ifIgnored: 'The ₹9,664 rate circulates in Finance uncorrected and comes back in the budget pack, where it is far harder to withdraw.',
      note: 'He needs a sentence he can send, not an explanation of your method. Own the Monday figure, give him the capacity rate, and say the difference is the denominator rather than the cost.',
    },
    {
      key: 'mas-06', day: 3, type: 'pressure', via: 'chat', from: 'people_partner',
      subject: 'One of the team has asked me something',
      body: `Somebody in your team has asked me, off the record, whether their timesheet is being looked at for the budget round. They are worried.

I have not said anything. But you should know the question is being asked.`,
      needsReply: true,
      expect: ['tell the team directly rather than answering through Neha'],
      markers: ['tell|write|team|all|everyone|directly|today|note|before|myself|not through|transparen|will not|ranking'],
      ifIgnored: 'The question spreads as a rumour for three days before your note arrives, and the note then reads as a response to the rumour rather than as the plan.',
      note: 'Answering Neha answers one person. The other twelve are having the same thought, and the note you owe them is due today rather than Friday.',
    },
    {
      key: 'mas-07', day: 4, type: 'scope', via: 'email', from: 'engineering_manager',
      subject: 'Can I borrow your capacity method?',
      body: `I hear you are doing days-present rather than headcount for the analytics capacity number.

Engineering has the same problem and I would like to use the same method so the two are comparable in the round. Can you send me how you did it?`,
      needsReply: true,
      expect: ['yes, with the caveat about his own time data'],
      markers: ['yes|happy|send|method|days present|working days|caveat|your|timesheet|coverage|capacity|denominator|comparab'],
      ifIgnored: 'Engineering submits a headcount-based capacity figure, analytics submits a presence-based one, and the two cost lines are compared as though they were computed the same way.',
      note: 'Worth saying yes to — two cost lines computed the same way is worth more than either one being slightly better. The capacity method is portable; anything built on his time logs is not.',
    },
    {
      key: 'mas-08', day: 4, type: 'noise', via: 'email', from: 'facilities',
      subject: 'Desk moves — analytics floor',
      body: `The analytics team will move from the fourth floor to the sixth on the weekend of the 18th.

Crates will be delivered on the 16th. Personal items only; monitors and docks stay with the desks.`,
      expect: ['archive it'],
      note: 'A desk move in three weeks. Nothing that needs you this week.',
    },
    {
      key: 'mas-09', day: 5, type: 'pressure', via: 'chat', from: 'finance_analyst',
      subject: 'Slide deadline is 4pm',
      body: `I need the analytics slide signed off by four. If I do not hear from you I will send the version I drafted.

It is one slide. Is it really worth another round?`,
      needsReply: true,
      expect: ['yes', 'send the replacement wording rather than a list of objections'],
      markers: ['yes|worth|replac|wording|here is|rewrite|send|instead|13%|utilisation|coverage|9,?664|cut|misread'],
      ifIgnored: 'Her draft goes in: ₹9,664 an hour, utilisation at 13%, headcount above requirement, and a recommendation to review individual performance.',
      note: 'She is not being difficult — she has a deadline and a draft. Objections cost her time she does not have; replacement wording costs her nothing.',
    },
    {
      key: 'mas-10', day: 5, type: 'noise', via: 'email', from: 'comms',
      subject: 'Internal newsletter — analytics mention',
      body: `We are running a short piece on the analytics team in next month's internal newsletter, focused on the dashboard work for Support.

Copy has been agreed with Sneha and nothing further is needed from you.`,
      expect: ['archive it'],
      note: 'Already agreed with the person who owns it. Nothing to add.',
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
  'board-pack': {
    key: 'tdq-board', title: 'Year-End Board Pack — end of project',
    intro: 'Ten questions on the week. Not a pass or fail — it tells both of us what stuck.',
    questions: [
      {
        id: 'q1', topic: 'business-sense',
        q: 'Three colleagues submit ₹5.00, ₹4.85 and ₹4.45 crore for the same year. What is the most likely explanation?',
        options: [
          { key: 'c', label: 'Three correct computations of three different definitions, none of them stated', correct: true },
          { key: 'a', label: 'Two of the three contain errors' },
          { key: 'b', label: 'They queried the data at different times' },
          { key: 'd', label: 'One of them used a corrupted source' },
        ],
        why: 'Gross or net, whole estate or like-for-like, corrected or not. Three binary choices give eight defensible answers, and nobody wrote down which they took.',
      },
      {
        id: 'q2', topic: 'business-sense',
        q: 'Which figure belongs in an external filing?',
        options: [
          { key: 'b', label: 'Net of returns, every store, with the known fault corrected', correct: true },
          { key: 'a', label: 'Gross revenue, since it is the most complete' },
          { key: 'c', label: 'Like-for-like, since it is the cleanest comparison' },
          { key: 'd', label: 'Whichever figure Finance already published' },
        ],
        why: 'It is what the business earned. Gross counts money that was refunded; like-for-like excludes ₹36 lakh of trade from stores the company owns.',
      },
      {
        id: 'q3', topic: 'sql',
        q: 'What must be true of a bridge before it goes in a pack?',
        options: [
          { key: 'a', label: 'Every step reconciles to the rupee, and names both what it removes and why', correct: true },
          { key: 'b', label: 'It is simplified to two or three steps for a board audience' },
          { key: 'c', label: 'It starts and ends on the two most conservative figures' },
          { key: 'd', label: 'It is rounded consistently to the nearest lakh' },
        ],
        why: 'A bridge exists so somebody can add it up in the room and get your answer. Collapsing the steps removes the explanation; rounding to hide a gap leaves the gap and hides where it is.',
      },
      {
        id: 'q4', topic: 'statistics',
        q: 'Every row in one store-month is duplicated exactly once. You need the year total. What do you do?',
        options: [
          { key: 'd', label: 'Keep one row of each pair — the trade is recoverable with certainty', correct: true },
          { key: 'a', label: 'Exclude the whole store-month' },
          { key: 'b', label: 'Replace the month with the average of its neighbours' },
          { key: 'c', label: 'Include it as loaded and mark the figure provisional' },
        ],
        why: 'Both rows are identical, so either is the real one. Excluding the month understates by ₹3.46 lakh of trade that genuinely happened — correcting downward to avoid a fault is still an error.',
      },
      {
        id: 'q5', topic: 'statistics',
        q: 'The trading review excluded that month and this pack halves it. Was the earlier treatment wrong?',
        options: [
          { key: 'c', label: 'No — exclusion is right for a comparison, repair is right for a total', correct: true },
          { key: 'a', label: 'Yes, and the trading review should be reissued' },
          { key: 'b', label: 'Yes, but it is immaterial at that scale' },
          { key: 'd', label: 'No, and the pack should exclude it too for consistency' },
        ],
        why: 'A comparison needs a consistent basis on both sides and does not need that store-month at all. A total has to include money that was earned. Same fault, different question.',
      },
      {
        id: 'q6', topic: 'business-sense',
        q: 'Why should every published figure in a pack come from one computation?',
        options: [
          { key: 'a', label: 'Figures from one computation cannot disagree, and a definition change propagates everywhere at once', correct: true },
          { key: 'b', label: 'It runs faster' },
          { key: 'c', label: 'It is easier to write' },
          { key: 'd', label: 'It is required for audit' },
        ],
        why: 'Eight figures from eight queries is exactly how three people produced three revenue numbers. The structural fix is one computation, not three more careful people.',
      },
      {
        id: 'q7', topic: 'statistics',
        q: 'Like-for-like trading fell in the second half. Your estimate assumes it is flat next year. Is that conservative?',
        options: [
          { key: 'b', label: 'No — flat errs in your favour against the only trend evidence there is', correct: true },
          { key: 'a', label: 'Yes, since it assumes no growth' },
          { key: 'c', label: 'Neutral, since it neither grows nor declines' },
          { key: 'd', label: 'It depends on what the board expects' },
        ],
        why: 'Conservative means erring against yourself. Telling a board an estimate is conservative when the risk is on the downside is the most expensive sentence in any pack.',
      },
      {
        id: 'q8', topic: 'business-sense',
        q: 'Your two scenarios differ by ₹15.2 lakh depending on whether the promotion repeats. The board wants one number. What do you give them?',
        options: [
          { key: 'd', label: 'The figure matching whichever way that decision goes, and ask who takes it', correct: true },
          { key: 'a', label: 'The lower one, as the prudent choice' },
          { key: 'b', label: 'The midpoint' },
          { key: 'c', label: 'The higher one, since the board wants growth' },
        ],
        why: 'Picking prudently, optimistically or splitting the difference all take a business decision on the board\'s behalf, quietly, inside a number.',
      },
      {
        id: 'q9', topic: 'communication',
        q: 'A summary says "like-for-like declined, offset by two successful new store openings". What is wrong?',
        options: [
          { key: 'a', label: 'A trading trend and added capacity are not commensurable, and "successful" is a judgement nobody made', correct: true },
          { key: 'b', label: 'Nothing — both statements are supported by the figures' },
          { key: 'c', label: 'The new stores should be excluded from the summary entirely' },
          { key: 'd', label: 'It should quantify the decline' },
        ],
        why: '"Offset" implies one compensated for the other. And whether an opening was successful is a question about capital returns that this analysis never asked.',
      },
      {
        id: 'q10', topic: 'communication',
        q: 'A board member asks why revenue differs from the half-year pack. What is the answer?',
        options: [
          { key: 'c', label: 'The figure did not change — the basis did, and both are on the page', correct: true },
          { key: 'a', label: 'The earlier pack used an incorrect methodology' },
          { key: 'b', label: 'The difference is technical and not material to the decision' },
          { key: 'd', label: 'A data quality issue has since been corrected' },
        ],
        why: 'The earlier pack used an unstated basis, not an incorrect one — and blaming colleagues in front of a board costs more than it buys. ₹55 lakh across the four bases is not technical, and the correction is only part of the gap.',
      },
    ],
  },
  'range-review': {
    key: 'tcq-range', title: 'Range & Space Review — end of project',
    intro: 'Ten questions on the week. Not a pass or fail — it tells both of us what stuck.',
    questions: [
      {
        id: 'q1', topic: 'sql',
        q: 'You rank products by sales ascending to find the weakest lines. What does that query structurally miss?',
        options: [
          { key: 'b', label: 'Products with no sales rows — they are absent, not bottom-ranked', correct: true },
          { key: 'a', label: 'Products sold in only one store' },
          { key: 'c', label: 'Products whose sales are all returns' },
          { key: 'd', label: 'Nothing, if the join is written correctly' },
        ],
        why: 'Seven of sixty-eight lines have never sold. They have no row to rank, so every previous range review was blind to the worst lines in the book.',
      },
      {
        id: 'q2', topic: 'sql',
        q: 'What is the general rule for a question about a population?',
        options: [
          { key: 'c', label: 'Start from the table that defines the population and LEFT JOIN the activity onto it', correct: true },
          { key: 'a', label: 'Start from the largest table for performance' },
          { key: 'b', label: 'Start from the activity table and filter' },
          { key: 'd', label: 'Use a FULL OUTER JOIN so nothing is lost' },
        ],
        why: 'Products then sales; employees then payroll; customers then orders. The tell that you got it backwards is a row count matching the activity table rather than the population.',
      },
      {
        id: 'q3', topic: 'business-sense',
        q: 'The bottom twenty lines carry 8.6% of margin. What does delisting them do?',
        options: [
          { key: 'a', label: 'Loses 8.6% of margin, against a saving in space and capital that is not in this data', correct: true },
          { key: 'b', label: 'Saves 8.6% of margin' },
          { key: 'c', label: 'Is broadly neutral, since the lines barely contribute' },
          { key: 'd', label: 'Cannot be assessed at all' },
        ],
        why: 'The margin is exactly computable and it is a cost. The saving is real and lives in space, buying time and working capital — none of which a sales table holds.',
      },
      {
        id: 'q4', topic: 'statistics',
        q: 'Stock cover comes out between 0.43 and 1.09 months for all 61 products, while annual sales run 234 to 482 units. What does that tell you?',
        options: [
          { key: 'd', label: 'The measure is not capturing stock policy — holdings do not vary with demand', correct: true },
          { key: 'a', label: 'Replenishment is unusually well controlled' },
          { key: 'b', label: 'The range is running dangerously low on cover' },
          { key: 'c', label: 'The stock counts need weighting by store' },
        ],
        why: 'Every product holds about twenty units whether it sells 234 a year or 482. No replenishment system behaves that way, and no weighting recovers information that was never recorded.',
      },
      {
        id: 'q5', topic: 'business-sense',
        q: 'A stakeholder asks for the cover figure anyway, offering to footnote it as indicative. What do you do?',
        options: [
          { key: 'b', label: 'Decline, and give him wording explaining why the section is empty', correct: true },
          { key: 'a', label: 'Supply it with his caveat' },
          { key: 'c', label: 'Supply a range instead of a point figure' },
          { key: 'd', label: 'Substitute a different stock measure' },
        ],
        why: 'A footnote does not travel with the number. A range implies statistical uncertainty when the measure is simply not measuring stock. Substituting silently is worse than either.',
      },
      {
        id: 'q6', topic: 'business-sense',
        q: 'Why does a delist rule expressed as "under 1.5% of category margin" fail?',
        options: [
          { key: 'a', label: 'It cannot see the never-sold lines, and run twice it delists the whole range', correct: true },
          { key: 'b', label: 'The threshold is arbitrary' },
          { key: 'c', label: 'It should be based on revenue, not margin' },
          { key: 'd', label: 'It ignores stock cover' },
        ],
        why: 'Every threshold is chosen, so arbitrariness is not the objection. A share-based rule leaves nothing to be a share of for a line that never sold, and after each cut the survivors re-share 100% and a new bottom appears.',
      },
      {
        id: 'q7', topic: 'statistics',
        q: 'A line is in seven stores, earns little in total and performs well per store. What is it?',
        options: [
          { key: 'c', label: 'Ambiguous — its total is low because of distribution, and the stores carrying it are not a random sample', correct: true },
          { key: 'a', label: 'A delist candidate' },
          { key: 'b', label: 'A rollout candidate' },
          { key: 'd', label: 'Performing as intended' },
        ],
        why: 'Total margin and margin per carrying store measure different things. If it is only in flagships, its per-store figure describes flagship customers rather than the product.',
      },
      {
        id: 'q8', topic: 'communication',
        q: 'A paper says "stock cover analysis confirms the range is over-extended", after you told them the measure does not work. What went wrong?',
        options: [
          { key: 'b', label: 'The refusal lived in an email rather than in the document', correct: true },
          { key: 'a', label: 'Bad faith by the author' },
          { key: 'c', label: 'You should have escalated to their manager' },
          { key: 'd', label: 'Nothing — sign-off is the point at which to catch it' },
        ],
        why: 'A paper has a section, somebody fills it, and your reply is in a different thread. An absence with a stated reason in the document itself is much harder to overwrite than a silence.',
      },
      {
        id: 'q9', topic: 'data-ethics',
        q: 'A supplier asks whether their line is on the delist candidate list. What do you say?',
        options: [
          { key: 'd', label: 'That you cannot discuss the range review, and refer them to buying', correct: true },
          { key: 'a', label: 'That it is not on the list, if that is true' },
          { key: 'b', label: 'That no decisions have been made' },
          { key: 'c', label: 'Nothing, and report it afterwards' },
        ],
        why: 'Denying for safe lines means silence identifies the unsafe ones. "No decisions yet" has the same problem in softer words, and an unanswered question still needs an answer given.',
      },
      {
        id: 'q10', topic: 'business-sense',
        q: 'Seven lines were listed and never ranged. How should that be written up?',
        options: [
          { key: 'a', label: 'As a process gap — no report could show them, so nobody could have seen them', correct: true },
          { key: 'b', label: 'As a buying error by whoever signed them off' },
          { key: 'c', label: 'Not at all, since the delist resolves it' },
          { key: 'd', label: 'As a data quality problem in the products table' },
        ],
        why: 'The data is correct — the lines genuinely exist and genuinely never sold. What failed is that every report used a query that deletes them, and a monthly completeness check fixes that permanently.',
      },
    ],
  },
  'margin-review': {
    key: 'tbq-margin', title: 'Margin & Promotion Review — end of project',
    intro: 'Ten questions on the week. Not a pass or fail — it tells both of us what stuck.',
    questions: [
      {
        id: 'q1', topic: 'business-sense',
        q: 'products.unit_cost is the cost today. You are reporting what last year earned. Which cost do you use?',
        options: [
          { key: 'b', label: 'The cost that applied on the day of each sale', correct: true },
          { key: 'a', label: 'The current cost, since it is the most accurate figure available' },
          { key: 'c', label: 'An average of current and previous cost' },
          { key: 'd', label: 'Either — the difference is immaterial' },
        ],
        why: 'Restating history at current cost rewrites it, always in the same direction, because costs rise. And 26.6% of revenue sits on products that were repriced upward by 19% on average.',
      },
      {
        id: 'q2', topic: 'business-sense',
        q: 'You are deciding what to stock NEXT year. Which cost basis?',
        options: [
          { key: 'c', label: 'Current cost, and undiscounted price', correct: true },
          { key: 'a', label: 'The cost that applied at the time of each historical sale' },
          { key: 'b', label: 'Current cost, and the prices actually realised' },
          { key: 'd', label: 'Whichever was used in the last range review, for consistency' },
        ],
        why: 'A forward decision depends on forward costs. Using realised prices bakes in a promotion nobody has decided to repeat — half the Equipment revenue was discounted.',
      },
      {
        id: 'q3', topic: 'statistics',
        q: 'The naive cost method understates Equipment margin by 7%, Coffee by 3%, and Tea by nothing. Why is that worse than a uniform 15% error?',
        options: [
          { key: 'a', label: 'An uneven error moves categories relative to each other, which is what the comparison measures', correct: true },
          { key: 'b', label: 'It is not worse — 15% is a larger absolute distortion' },
          { key: 'c', label: 'Because Equipment is the largest category' },
          { key: 'd', label: 'Because the error cannot be corrected without invoice data' },
        ],
        why: 'A uniform error preserves every ranking and every ratio and can be caveated. A structured one has to be fixed, because the range review is a decision about categories relative to each other.',
      },
      {
        id: 'q4', topic: 'statistics',
        q: 'Why does the naive method manufacture an improving trend?',
        options: [
          { key: 'd', label: 'The two methods diverge before a cost change and agree after it, so the past is penalised and the present is not', correct: true },
          { key: 'a', label: 'Because costs rise faster than prices' },
          { key: 'b', label: 'Because more products were repriced in the second half' },
          { key: 'c', label: 'It does not — the distortion is constant over time' },
        ],
        why: 'It is systematic, not random. The naive figure understated the first half by 6.5% and the second by 2.3%, so a real decline reads as a mild one.',
      },
      {
        id: 'q5', topic: 'business-sense',
        q: 'Equipment has the lowest margin RATE in the book and the highest margin CONTRIBUTION. What follows?',
        options: [
          { key: 'b', label: 'Nothing until you know what decision is being made', correct: true },
          { key: 'a', label: 'It should be de-emphasised in favour of higher-rate categories' },
          { key: 'c', label: 'Its pricing needs review' },
          { key: 'd', label: 'The blended rate should be the reported measure' },
        ],
        why: 'A pricing decision cares about the rate, a range decision about the contribution. Halving Equipment loses half of ₹1.08 crore, and Merchandise would have to quadruple to replace it.',
      },
      {
        id: 'q6', topic: 'business-sense',
        q: 'Why is a blended gross margin target of 46% a bad target?',
        options: [
          { key: 'c', label: 'It can be hit by selling less Equipment, with no product trading better', correct: true },
          { key: 'a', label: 'It is too ambitious given the category mix' },
          { key: 'b', label: 'Targets should always be absolute, never rates' },
          { key: 'd', label: 'It does not account for returns' },
        ],
        why: 'Equipment is 64% of revenue at the lowest rate, so shrinking it lifts the blend and shrinks the business — and the target records that as success. Pairing it with an absolute figure fixes it.',
      },
      {
        id: 'q7', topic: 'statistics',
        q: 'November delivered 55% more units, 39% more revenue and 12% more margin than a normal month. What is the shape of that telling you?',
        options: [
          { key: 'a', label: 'Turnover was bought with discount — volume rose fastest and margin slowest', correct: true },
          { key: 'b', label: 'The promotion failed, since the margin rate fell nine points' },
          { key: 'c', label: 'The promotion succeeded, since it was the best revenue month' },
          { key: 'd', label: 'Nothing — three measures moving together is normal seasonality' },
        ],
        why: 'The ordering of the three rises is the signature. Whether the trade was worth it depends on what the promotion was for, which nobody recorded.',
      },
      {
        id: 'q8', topic: 'statistics',
        q: 'Margin falls steadily with discount to 20%, then rises slightly at the 25% and 30% bands. What is that?',
        options: [
          { key: 'd', label: 'Noise — those two bands hold 326 lines out of 9,022', correct: true },
          { key: 'a', label: 'A floor below which margin stops eroding' },
          { key: 'b', label: 'Evidence that deep discounts are safe' },
          { key: 'c', label: 'A data error in the discount field' },
        ],
        why: 'Under 2% of the data each, and which products happened to be discounted drives the difference. Fitting a curve through the thinnest region is how a table becomes a licence to discount harder.',
      },
      {
        id: 'q9', topic: 'communication',
        q: 'A draft note says "Analytics confirm the promotion was margin-accretive and recommend repeating it". What is the worst part?',
        options: [
          { key: 'b', label: '"Recommend" — you measured a trade, you did not make a recommendation', correct: true },
          { key: 'a', label: '"Margin-accretive", which is misleading about the rate' },
          { key: 'c', label: '"Confirm", which overstates certainty' },
          { key: 'd', label: 'Nothing — absolute margin did rise' },
        ],
        why: 'All three phrases are slippery. But attributing a recommendation to your team puts your name on a decision you did not make, and that is the sentence quoted when it is questioned.',
      },
      {
        id: 'q10', topic: 'data-ethics',
        q: 'Store manager bonuses depend partly on margin percentage, and the cost basis is being corrected. What do you tell People Ops?',
        options: [
          { key: 'a', label: 'That it is a basis change, not performance, and both bases should be shown for the same period', correct: true },
          { key: 'b', label: 'That the new figures are correct and the old ones should be discarded' },
          { key: 'c', label: 'That bonuses should be frozen until the basis is settled' },
          { key: 'd', label: 'Nothing — the change is technical and does not concern them' },
        ],
        why: 'Stores selling more Equipment move most, through no action of their own. Showing both bases for one period is what makes the change legible instead of arbitrary.',
      },
    ],
  },
  'trading-review': {
    key: 'taq-trading', title: 'Half-Year Trading Review — end of project',
    intro: 'Ten questions on the week. Not a pass or fail — it tells both of us what stuck.',
    questions: [
      {
        id: 'q1', topic: 'business-sense',
        q: 'A draft shows nine stores declining and one growing strongly. Which do you verify first?',
        options: [
          { key: 'a', label: 'The one that is growing', correct: true },
          { key: 'b', label: 'The nine declining, since that is the larger business impact' },
          { key: 'c', label: 'The estate total, since everything rolls up to it' },
          { key: 'd', label: 'All equally — there is no reason to prefer one' },
        ],
        why: 'The exception is where the error is, and a flattering exception has already passed one filter that an unflattering one has not. Somebody wanted the star to be real.',
      },
      {
        id: 'q2', topic: 'sql',
        q: 'Returns are stored as negative quantities in the sales table. What does COUNT(*) give you?',
        options: [
          { key: 'c', label: 'Till lines, including refunds — not transactions in the sense a board means', correct: true },
          { key: 'a', label: 'The number of transactions' },
          { key: 'b', label: 'The number of items sold' },
          { key: 'd', label: 'The number of transactions, net of returns' },
        ],
        why: '9,022 lines against 8,530 sale lines. Counting refunds as transactions inflates the count and deflates the average value, and both errors push the same way.',
      },
      {
        id: 'q3', topic: 'business-sense',
        q: 'Two stores opened during the reporting year and one closed. What must the pack carry?',
        options: [
          { key: 'b', label: 'Both a total-estate figure and a like-for-like figure over a stable set of stores', correct: true },
          { key: 'a', label: 'The total estate figure, since that is what the business earned' },
          { key: 'c', label: 'Like-for-like only, since it is the cleaner comparison' },
          { key: 'd', label: 'The total with the part-year stores scaled up to a full year' },
        ],
        why: 'Like-for-like says whether the shops are trading better; the total says what the business earned. Publish one and you will be asked for the other in the room. Scaling a four-month store to twelve is a forecast presented as a result.',
      },
      {
        id: 'q4', topic: 'statistics',
        q: 'Revenue per trading day and revenue per day open give different rankings. Which is the better productivity measure, and why?',
        options: [
          { key: 'd', label: 'Per day open — a day with no sales is a bad day, not an absent one', correct: true },
          { key: 'a', label: 'Per trading day, because it only counts days the store actually traded' },
          { key: 'b', label: 'Neither — use the annual total' },
          { key: 'c', label: 'They are equivalent for a busy estate' },
        ],
        why: 'Dividing by days with a sale deletes the worst days from the average, and it flatters exactly the quietest stores. Baner records a sale on 268 days of roughly 365 open.',
      },
      {
        id: 'q5', topic: 'sql',
        q: 'How do you distinguish a double-loaded feed from two customers coincidentally buying the same thing?',
        options: [
          { key: 'a', label: 'By concentration — every line in one contiguous store-month, against one or two anywhere else', correct: true },
          { key: 'b', label: 'By checking whether the rows have sequential ids' },
          { key: 'c', label: 'By whether the duplicated revenue is material' },
          { key: 'd', label: 'You cannot — identical rows are always ambiguous' },
        ],
        why: 'Coincidental matches are scattered and rare. Fifty-two duplicate groups covering all 104 of one store\'s March lines is a feed replayed.',
      },
      {
        id: 'q6', topic: 'business-sense',
        q: 'You exclude the duplicated store-month from your figures. What else must you do?',
        options: [
          { key: 'c', label: 'Disclose the exclusion, so the figure can be reproduced and reconciled', correct: true },
          { key: 'a', label: 'Nothing — the corrected figure is the right one' },
          { key: 'b', label: 'Delete the duplicate rows from the warehouse' },
          { key: 'd', label: 'Use the warehouse figure instead, so the pack ties' },
        ],
        why: 'Finance has the uncorrected figure. An undisclosed filter means the two never reconcile and nobody knows which to believe — and you should not have write access to the source anyway.',
      },
      {
        id: 'q7', topic: 'communication',
        q: 'You are pressed to name a cause for the decline. Footfall, competitor and market data are all absent. What is the complete answer?',
        options: [
          { key: 'b', label: 'What you can show, what you cannot, and what data would settle it', correct: true },
          { key: 'a', label: 'The most plausible cause, clearly flagged as a hypothesis' },
          { key: 'c', label: 'That the data cannot answer the question' },
          { key: 'd', label: 'That you will investigate and come back' },
        ],
        why: 'A hypothesis offered under pressure gets repeated without its flag. Stopping at the refusal leaves the room stuck. The third part is what makes it a plan rather than an obstacle.',
      },
      {
        id: 'q8', topic: 'communication',
        q: 'A slide reads "revenue fell 17%, driven by a slowdown in Equipment". Equipment is the largest category. What is wrong?',
        options: [
          { key: 'd', label: '"Driven by" asserts a cause; being the biggest category is arithmetic', correct: true },
          { key: 'a', label: 'Nothing — Equipment declined and it is the largest category' },
          { key: 'b', label: 'The figure should be stated per category' },
          { key: 'c', label: 'It should name the stores included' },
        ],
        why: 'Scope belongs on the slide too, but the load-bearing error is that "driven by" will send somebody to review the Equipment range when the decline is broad.',
      },
      {
        id: 'q9', topic: 'business-sense',
        q: 'Half-on-half comparison shows a 17.3% decline. The first half contains a discount-driven promotion month. What does that mean?',
        options: [
          { key: 'a', label: 'The comparison overstates the decline, and the pack has to say so', correct: true },
          { key: 'b', label: 'Nothing — both halves are six months' },
          { key: 'c', label: 'The promotion month should be excluded from both halves' },
          { key: 'd', label: 'The decline is understated, since the promotion cost margin' },
        ],
        why: 'November is the biggest revenue month of the year and it sits entirely in the first half. Excluding it is defensible too — silently leaving it in and calling the result like-for-like is not.',
      },
      {
        id: 'q10', topic: 'data-ethics',
        q: 'A store manager has already told her team about a growth figure that turns out to be a data fault. When does she find out?',
        options: [
          { key: 'c', label: 'Before the board pack circulates, and told that it was a feed fault, not her result', correct: true },
          { key: 'a', label: 'In the corrected pack, along with everyone else' },
          { key: 'b', label: 'She does not need to be told — the figure was never hers' },
          { key: 'd', label: 'After the board meeting, so the correction is settled first' },
        ],
        why: 'She acted on a number your team published. Letting her discover the correction in a room, or after it, is a cost your error imposed on somebody who did nothing wrong.',
      },
    ],
  },
  'experiment-readout': {
    key: 'eq-experiment', title: 'Onboarding Experiment Readout — end of project',
    intro: 'Ten questions on the week. Not a pass or fail — it tells both of us what stuck.',
    questions: [
      {
        id: 'q1', topic: 'statistics',
        q: 'What is the first query you run on an experiment result?',
        options: [
          { key: 'b', label: 'A balance check — are the arms the same size and made of the same people?', correct: true },
          { key: 'a', label: 'The outcome, per arm' },
          { key: 'c', label: 'A significance test on the difference' },
          { key: 'd', label: 'The sample size needed for the effect you expect' },
        ],
        why: 'If the balance check fails, the outcome number means something other than what everyone thinks it means. It takes four lines and it is the highest-value query of the week.',
      },
      {
        id: 'q2', topic: 'statistics',
        q: 'Control is 27.8% mobile and treatment is 73.0% mobile. Why does this matter more than the arms being 169 and 122?',
        options: [
          { key: 'c', label: 'Unequal size costs precision; unequal composition biases the estimate', correct: true },
          { key: 'a', label: 'It does not — both are symptoms of the same problem' },
          { key: 'b', label: 'Because 73% is further from 50% than 122 is from 145' },
          { key: 'd', label: 'Because platform is the only attribute recorded on users' },
        ],
        why: 'A smaller arm gives you a wider interval around the right answer. A differently composed arm gives you a narrow interval around the wrong one.',
      },
      {
        id: 'q3', topic: 'statistics',
        q: 'Treatment beats control on web (66.7 v 55.7) and on mobile (24.7 v 17.0), but loses overall (36.1 v 45.0). What is this?',
        options: [
          { key: 'a', label: "Simpson's paradox — the pooled average is weighted by a different mix in each arm", correct: true },
          { key: 'b', label: 'An arithmetic error in one of the two calculations' },
          { key: 'c', label: 'Evidence that the effect is real only within segments' },
          { key: 'd', label: 'A sign that the sample is too small to be stable' },
        ],
        why: 'Both calculations are correct. The pooled figure is partly a comparison of the platform mixes rather than of the onboarding.',
      },
      {
        id: 'q4', topic: 'statistics',
        q: 'Would a much larger sample have prevented this reversal?',
        options: [
          { key: 'd', label: 'No — it would have reproduced the same skew more precisely', correct: true },
          { key: 'a', label: 'Yes, imbalances average out as n grows' },
          { key: 'b', label: 'Yes, if the assignment were still random' },
          { key: 'c', label: 'Only if the segments were also balanced by size' },
        ],
        why: 'Sample size cures noise, not systematic assignment bias. Bucketing on device would produce the same 73/28 split at any n.',
      },
      {
        id: 'q5', topic: 'sql',
        q: 'How do you standardise the two arms to a common platform mix?',
        options: [
          { key: 'b', label: "Apply each arm's within-segment rates to the pooled population's segment weights", correct: true },
          { key: 'a', label: 'Take the simple average of each arm\'s two segment rates' },
          { key: 'c', label: 'Drop users from the larger arm until the arms match' },
          { key: 'd', label: 'Report only the segment with the larger sample' },
        ],
        why: 'A simple average weights a 33-user cell equally with an 89-user one. Standardising uses the real mix, so both arms are scored against the same population.',
      },
      {
        id: 'q6', topic: 'statistics',
        q: 'After standardising, treatment is +9.5 points. What have you established?',
        options: [
          { key: 'c', label: 'An adjusted observational estimate — the confounder you measured is removed, others may remain', correct: true },
          { key: 'a', label: 'A causal effect of 9.5 points' },
          { key: 'b', label: 'Nothing, because the assignment was not random' },
          { key: 'd', label: 'That the true effect lies between 7.7 and 11.0 points' },
        ],
        why: 'Randomisation protects against confounders you never measured. Standardising protects only against platform, and the assignment was bucketed on device — so anything else travelling with device travels with the arms.',
      },
      {
        id: 'q7', topic: 'statistics',
        q: 'Partner-sourced users show control 66.7% against treatment 33.3%, on 27 and 15 users. What is it?',
        options: [
          { key: 'd', label: 'An underpowered post-hoc subgroup — expected to appear somewhere across sixteen splits', correct: true },
          { key: 'a', label: 'Evidence the change harms partner-sourced users' },
          { key: 'b', label: 'A second instance of the same composition problem' },
          { key: 'c', label: 'A reason to exclude partner users from the rollout' },
        ],
        why: 'On 15 users one person is 6.7 points. Across five channels, three plans and two invite paths, two or three extremes will appear even if the treatment does nothing at all.',
      },
      {
        id: 'q8', topic: 'business-sense',
        q: 'What makes the platform split legitimate evidence when the channel split is not?',
        options: [
          { key: 'a', label: 'The assignment mechanism forced it — you had no choice but to look at it', correct: true },
          { key: 'b', label: 'Platform has larger cells' },
          { key: 'c', label: 'Platform is a stronger predictor of activation' },
          { key: 'd', label: 'Platform was recorded before the experiment started' },
        ],
        why: 'A split you were compelled into by the broken randomisation is evidence. A split you chose after seeing the answer is a hypothesis, however large the gap looks.',
      },
      {
        id: 'q9', topic: 'communication',
        q: 'Priya will be asked in a leadership meeting how much better it is. What should she say?',
        options: [
          { key: 'b', label: '"About nine points better on activation, once we compare like with like"', correct: true },
          { key: 'a', label: '"47.1% against 37.6%"' },
          { key: 'c', label: '"Roughly a quarter better"' },
          { key: 'd', label: '"The original number was wrong"' },
        ],
        why: 'On 291 users the decimal is fiction and will be repeated for a year. The ratio framing inflates a rate difference. And the original figure was correctly computed — it answered a different question.',
      },
      {
        id: 'q10', topic: 'communication',
        q: 'You discover on Monday that the arms are imbalanced. The corrected result will not be ready until Wednesday. When do you tell Priya, who has already briefed people?',
        options: [
          { key: 'a', label: 'Monday — that the comparison is broken, even without knowing which way it goes', correct: true },
          { key: 'b', label: 'Wednesday, with the corrected result, so she is only disturbed once' },
          { key: 'c', label: 'Only if the result actually reverses' },
          { key: 'd', label: 'Friday, in the readout' },
        ],
        why: 'She is briefing people today. Every day of silence is another room that heard the old number, and a day-four reversal is an ambush where a day-one warning is a collaboration.',
      },
    ],
  },
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
  'capacity-review': {
    key: 'maq-capacity', title: 'Demand & Capacity Review — end of project',
    intro: 'Ten questions on the week. Not a pass or fail — it tells both of us what stuck.',
    questions: [
      {
        id: 'q1', topic: 'business-sense',
        q: 'An exec asks what an analysis costs, who is most productive, and whether all fourteen people are needed. What kind of request is that?',
        options: [
          { key: 'b', label: 'A resourcing question asked in the shape of a productivity question', correct: true },
          { key: 'a', label: 'Three separate questions that happen to share an email' },
          { key: 'c', label: 'A performance question with a cost question attached to it' },
          { key: 'd', label: 'A straightforward reporting request on data you already hold' },
        ],
        why: 'The decision behind all three is whether to fund the team at its current size. Answering the productivity question on its own terms is how you spend a week being responsive and useless.',
      },
      {
        id: 'q2', topic: 'statistics',
        q: 'The team logged 3,193 hours against 24,857 hours of paid capacity. What does that 12.8% most directly invalidate?',
        options: [
          { key: 'c', label: 'Any rate with logged hours in the denominator', correct: true },
          { key: 'a', label: 'The record of which requests people worked on' },
          { key: 'b', label: 'The proportion of effort going to each requesting function' },
          { key: 'd', label: 'The count of delivered requests' },
        ],
        why: 'A missing eighth of the denominator multiplies every rate built on it by about eight. What people worked on survives far better than how much.',
      },
      {
        id: 'q3', topic: 'sql',
        q: 'Why does every capacity query in this review carry WHERE level <> \'manager\'?',
        options: [
          { key: 'a', label: 'The manager does not deliver requests, so including her adds cost and capacity that produce no output', correct: true },
          { key: 'b', label: 'Manager-level time logs are recorded in a different system' },
          { key: 'c', label: 'Her day rate is high enough to distort any average' },
          { key: 'd', label: 'Data about your own line manager should not appear in a budget pack' },
        ],
        why: 'She is real cost and real capacity, but not delivery capacity. Leaving her in makes every per-person figure quietly worse in a way nobody reading the output would spot.',
      },
      {
        id: 'q4', topic: 'data-ethics',
        q: 'A senior stakeholder asks twice for per-person logged hours, promising to read it sensibly. What do you do?',
        options: [
          { key: 'd', label: 'Decline that table, and offer delivered work per person-year by level instead', correct: true },
          { key: 'a', label: 'Send it with a written health warning at the top' },
          { key: 'b', label: 'Send it with the two part-year people removed' },
          { key: 'c', label: 'Send it to his manager instead so the request is on the record' },
        ],
        why: 'He probably would read it sensibly. The document outlives the conversation, and the next reader will not have been in it. The health warning does not travel; the ranking does.',
      },
      {
        id: 'q5', topic: 'statistics',
        q: 'Logged-day coverage across the team runs from 19.2% to 49.1%. What does a ranking of analysts by hours logged mostly measure?',
        options: [
          { key: 'b', label: 'How diligently each person fills in a timesheet', correct: true },
          { key: 'a', label: 'How much work each person was assigned' },
          { key: 'c', label: 'How much each person actually worked' },
          { key: 'd', label: 'How long each person has been with the team' },
        ],
        why: 'Assignment and time present are in there too, and both are outside the person\'s control. Actual work done is not in the top three.',
      },
      {
        id: 'q6', topic: 'business-sense',
        q: 'Thirteen people below manager level. 11.92 person-years present. What follows?',
        options: [
          { key: 'c', label: 'Ordinary joining and leaving cost about a person-year, which faster replacement fixes and hiring does not', correct: true },
          { key: 'a', label: 'The team is under-established by roughly one post' },
          { key: 'b', label: 'There is about a person-year of unexplained absence to investigate' },
          { key: 'd', label: 'Headcount should be reported as twelve rather than thirteen' },
        ],
        why: 'A January leaver and a March joiner account for it exactly. Reading it as under-establishment converts a replacement-speed problem into a hiring request.',
      },
      {
        id: 'q7', topic: 'business-sense',
        q: '485 hours — 15% of all logged effort — went to requests later cancelled. How should that enter a budget conversation?',
        options: [
          { key: 'a', label: 'As capacity available without hiring, and as a floor rather than an estimate', correct: true },
          { key: 'b', label: 'As waste, quantified by requesting function' },
          { key: 'c', label: 'As a reason to exclude cancelled work from every cost figure' },
          { key: 'd', label: 'As evidence that intake needs an approval step' },
        ],
        why: 'Called waste it produces a search for the guilty. Called available capacity it is an offer the room can accept this quarter. And it is 15% of logged hours, so the real figure is larger.',
      },
      {
        id: 'q8', topic: 'communication',
        q: 'A budget slide reads: "Utilisation across the team is low at 13%, suggesting spare capacity." What is the most serious problem with it?',
        options: [
          { key: 'd', label: 'The 13% is timesheet coverage, not utilisation, and the second clause turns a measurement gap into a case for cutting', correct: true },
          { key: 'a', label: 'It should say 12.8% rather than rounding to 13%' },
          { key: 'b', label: 'It does not state the period the figure covers' },
          { key: 'c', label: 'Utilisation is a term the audience will not recognise' },
        ],
        why: 'Every option is a real flaw and only one of them cuts the team. The sentence reads as an observation and functions as a recommendation.',
      },
      {
        id: 'q9', topic: 'data-ethics',
        q: 'You are about to use the team\'s timesheet data in a budget conversation. When do they hear about it?',
        options: [
          { key: 'b', label: 'Before it leaves your desk, in writing, from you', correct: true },
          { key: 'a', label: 'Afterwards, with a summary of what was said' },
          { key: 'c', label: 'Only if an individual is named in what you send' },
          { key: 'd', label: 'Not at all, since it is aggregated' },
        ],
        why: 'Data gathered to attribute effort to projects is being used for something else. Afterwards is too late to be a choice, and they will hear it came up either way.',
      },
      {
        id: 'q10', topic: 'business-sense',
        q: 'The same annual cost gives ₹9,664 per logged hour and about ₹1,241 per capacity hour. What do you publish?',
        options: [
          { key: 'c', label: 'The capacity rate, with the naive one shown beside it and one line on why they differ', correct: true },
          { key: 'a', label: 'The capacity rate only, since the other is built on a broken denominator' },
          { key: 'b', label: 'The naive rate only, since it is the one derived from real recorded work' },
          { key: 'd', label: 'Neither, until timesheet coverage is good enough to support a rate' },
        ],
        why: 'The naive figure is two lines of arithmetic away and somebody will find it. Far better they find your version of it than discover it themselves and wonder what else was left out. Publishing nothing leaves the room with no analytics rate at all, and the cut lands there.',
      },
    ],
  },
};

function activitiesFor(projectKey) { return ACTIVITIES[projectKey] || []; }
function situationsFor(projectKey) { return SITUATIONS[projectKey] || []; }
function quizFor(projectKey) { return QUIZZES[projectKey] || null; }

module.exports = { ACTIVITIES, SITUATIONS, QUIZZES, activitiesFor, situationsFor, quizFor };
