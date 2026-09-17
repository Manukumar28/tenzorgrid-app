'use strict';

// The rest of the inbox.
//
// A real analyst's mail is not four messages a day, all of them about the thing they are
// working on. It is thirty, of which two want something from them and the rest are the
// company talking to itself: the all-hands invite, the VPN maintenance window, the
// newsletter, another team's release note. Deciding which two matter is most of the skill,
// and you cannot practise that decision on an inbox where every message matters.
//
// So this module supplies two streams, both arriving as email on the day they belong to:
//
//   DESK  — two a day, addressed to the learner by name, needing a reply. Project status,
//           task status, a direct question from a colleague. These are handled through the
//           same reply / defer / archive / escalate machinery as a project situation, and
//           scored the same way, but they deliberately do NOT count toward the day gate:
//           the day is finished by six tasks, two activities and two situations, and a
//           colleague asking for a status line is not a fifth kind of homework.
//
//   NOISE — everything else, eight a day, enough to bring the day to ten emails minimum.
//           Archiving it is the correct handling. Replying to it is the mistake.
//
// Both pools are deliberately generic — {project} and {name} are filled in at delivery —
// so every project we ever author inherits a full inbox without writing forty more emails.

// The floor from the spec: ten emails a day, two of them wanting an answer.
const MIN_EMAILS_PER_DAY = 10;
const DESK_PER_DAY = 2;

// ---- Two a day, addressed to you ------------------------------------------------------
//
// `markers` are matched case-insensitively against the reply; the score is the share of
// them hit, so they are written as alternations rather than exact phrases. `expect` is
// shown only AFTER the learner has dealt with the mail — telling them in advance which
// mail matters is the answer to the only question triage asks.

const DESK = [
  {
    key: 'dm-01', type: 'status request', day: 1, from: 'pmo', senderName: 'Programme Office', via: 'email',
    needsReply: true,
    subject: 'Weekly status line needed — {project}',
    body: "Hi {name},\n\nYou're on the portfolio report this week for {project}. I need one line from you by end of day, in this shape:\n\n  • what you're working on right now\n  • when you expect it to finish\n  • anything that could push that date\n\nIt goes into the pack unedited, so write it the way you'd want it read.\n\nProgramme Office",
    markers: ['work|analys|task|start|underway|looking', 'friday|day 5|end of (the )?week|by \\w+day|expect', 'risk|blocker|nothing|no issue|on track|depend|wait'],
    expect: [
      'Name the actual work, not "the project" — the pack is read by people who do not know what you were given.',
      'Give a date. "Soon" is what makes a portfolio report useless.',
      'Say the risk even when there is not one. "No blockers" is information; silence is not.',
    ],
    ifIgnored: 'Your line in the portfolio pack went in as "no update received", which is the one status nobody wants next to their name.',
    note: 'A status line is three facts in one sentence. It is asked of you every week for the rest of your career, so it is worth being fast at.',
  },
  {
    key: 'dm-02', type: 'direct question', day: 1, from: 'finance_analyst', senderName: 'Diya Chandra', via: 'email',
    needsReply: true,
    subject: 'Quick one before you get going',
    body: "{name} — before you go too far, which salary snapshot are you working from?\n\nWe hold two and they do not agree: the one in the HR export you have been given, and Finance's own baseline. If you are about to quote a number at Vikram I would rather we were quoting the same one.\n\nDiya",
    markers: ['hr|export|dataset|given|source|table', 'salary|snapshot|baseline|figure|number', 'check|confirm|reconcile|compare|same|match|tell me|let you know'],
    expect: [
      'Say which source you are actually using. Naming it is the whole answer.',
      'Offer to reconcile the two rather than asserting yours is right — you do not yet know that it is.',
    ],
    ifIgnored: 'Diya went ahead on the Finance baseline. If your headline number differs from hers on Friday, that difference is now yours to explain.',
    note: 'Two systems holding the same number differently is the normal state of a company, not an exception. The analyst who asks which one early does not get ambushed late.',
  },

  {
    key: 'dm-03', type: 'status request', day: 2, from: 'line_manager', senderName: 'Asha Rao', via: 'email',
    needsReply: true,
    subject: 'Where did yesterday land?',
    body: "Morning {name},\n\nI have my one-to-one with Vikram at eleven and he will ask. Can you tell me which of yesterday's tasks are actually signed off, which are still with me, and what you have picked up today?\n\nNo need to write an essay — three lines is plenty.\n\nAsha",
    markers: ['sign(ed)? ?off|done|complete|graded|finish', 'review|with you|waiting|pending|open|left|remain', 'today|now|next|picked up|start'],
    expect: [
      'Separate what is finished from what is waiting on someone else. Those are very different statuses and managers care about the difference.',
      'Say what you are on today, so she can tell Vikram where the week is going, not just where it has been.',
    ],
    ifIgnored: 'Asha went into her one-to-one without your update and had to say she would come back to him. She will not chase you twice.',
    note: 'The manager is not checking up on you. She is being asked a question in a room you are not in, and you are the only person who can answer it.',
  },
  {
    key: 'dm-04', type: 'request', day: 2, from: 'comms', senderName: 'Meera Pillai', via: 'email',
    needsReply: true,
    subject: 'One line for the internal newsletter',
    body: "Hi {name},\n\nWe're running a short piece on what each team is working on this quarter. Could you give me one plain-English sentence on {project} — what it is and why it matters — that a person in Sales would understand?\n\nNo jargon, no acronyms. It goes out Thursday.\n\nMeera",
    markers: ['pay|salar|compensat|band|gap|equit|review|analys', 'fair|why|so that|make sure|understand|decide|because|help'],
    expect: [
      'Write it for the person in Sales, not for your manager. If it contains an acronym, it is not finished.',
      'Say why it matters as well as what it is — the second half is the part people remember.',
    ],
    ifIgnored: 'Your team was left out of the newsletter. Not a disaster, but visibility is not free and that was a free one.',
    note: 'Being able to say what you are doing in one sentence a stranger understands is a genuine, tested skill. Most analysts cannot.',
  },

  {
    key: 'dm-05', type: 'status request', day: 3, from: 'pmo', senderName: 'Programme Office', via: 'email',
    needsReply: true,
    subject: 'RAG status for {project} — mid-week check',
    body: "{name},\n\nMid-week check on {project}. I need a RAG status — green, amber or red — and one sentence of reasoning.\n\nA reminder of what we mean by them here: green is on track, amber is at risk but recoverable without help, red is will miss the date without a decision from someone else.\n\nProgramme Office",
    markers: ['green|amber|red', 'because|as|since|due to|reason|on track|at risk|behind|ahead'],
    expect: [
      'Pick a colour. An unanswered RAG is recorded as red anyway.',
      'Justify it in one sentence. A colour with no reason is a guess, and everyone reading the pack knows it.',
      'Amber is not an admission of failure — it is the only status that gets you help before the deadline.',
    ],
    ifIgnored: 'No status came back, so {project} went into the pack as red. You will be asked about that.',
    note: 'People report green until the day they report red, which is why nobody trusts a RAG. Reporting amber when it is amber is the whole point of the system.',
  },
  {
    key: 'dm-06', type: 'direct question', day: 3, from: 'engineering_manager', senderName: 'Arjun Rao', via: 'email',
    needsReply: true,
    subject: 'Should I wait for your numbers?',
    body: "{name} — I'm building next quarter's headcount plan and I've heard your review might change what the bands look like.\n\nDo I hold off until you're done, or carry on with what I have? I can wait a few days but not two weeks. Straight answer is fine.\n\nArjun",
    markers: ['friday|day 5|end of (the )?week|\\bby\\b|date|days', 'wait|hold|carry on|go ahead|proceed|don.?t wait|continue'],
    expect: [
      'Answer the question he asked — wait or carry on — before anything else.',
      'Give him the date, so "wait" is a decision he can plan around rather than an open ticket.',
    ],
    ifIgnored: 'Arjun carried on with the old bands. If yours land differently on Friday, his plan is wrong and it will be traced back to this email.',
    note: 'Somebody asking "should I wait for you?" is telling you your work is on their critical path. The worst answer is no answer.',
  },

  {
    key: 'dm-07', type: 'direct question', day: 4, from: 'line_manager', senderName: 'Asha Rao', via: 'email',
    needsReply: true,
    subject: 'How confident are you in the headline number?',
    body: "{name},\n\nBefore this goes anywhere near Friday's room — how confident are you in the headline figure, and what would change it?\n\nI am not looking for you to say you are certain. I am looking for you to know where it is soft, because Vikram will find that spot in about ninety seconds.\n\nAsha",
    markers: ['confiden|sure|certain|comfortable|fairly|reasonab|not entirely', 'small|sample|few|thin|outlier|missing|null|assumption|caveat|depend|if|soft'],
    expect: [
      'Name the soft spot yourself. If she finds it and you did not, the number is not the problem any more — you are.',
      'Confidence is a range, not a yes. "Confident on the direction, less on the size" is a real answer.',
    ],
    ifIgnored: 'Asha took the number into Friday without knowing where it was thin. Whatever gets asked in that room, she will be answering it cold.',
    note: 'Senior people do not trust analysts who are certain. They trust the ones who can say exactly which part they would not bet on.',
  },
  {
    key: 'dm-08', type: 'reconciliation', day: 4, from: 'finance_analyst', senderName: 'Diya Chandra', via: 'email',
    needsReply: true,
    subject: 'Does my total match yours?',
    body: "{name} — I have the current staff cost baseline coming out at a number I am happy with.\n\nBefore Friday, can you tell me whether your total headcount and total salary spend agree with mine? If they do not, it will be the leavers or the joiners, it always is. Better we find it today than in the room.\n\nDiya",
    markers: ['headcount|staff|people|employee|count|total', 'leaver|joiner|current|active|exclude|include|filter|left|end.?date'],
    expect: [
      'Say what your totals actually are. A reconciliation without numbers is not a reconciliation.',
      'Go straight to the usual culprit — whether leavers are in or out — rather than waiting to be told.',
    ],
    ifIgnored: 'Nobody reconciled. If your total and Finance\'s differ on Friday, the meeting stops being about pay equity and starts being about whose spreadsheet is wrong.',
    note: 'Two numbers that should match and do not is the single most common way an analysis dies in public. Checking takes ten minutes.',
  },

  {
    key: 'dm-09', type: 'briefing request', day: 5, from: 'stakeholder', senderName: 'Vikram Menon', via: 'email',
    needsReply: true,
    subject: 'What can I say this afternoon?',
    body: "{name} — I'm in front of the leadership team at four and {project} is on the agenda.\n\nI don't need the analysis. I need to know what I'm allowed to say: what you found, how sure we are, and what you want them to do about it. If there's something I should NOT say yet, tell me that too.\n\nVikram",
    markers: ['found|gap|differ|show|result|finding|number|%|percent', 'confiden|sure|caveat|small|sample|careful|not|preliminar|subject to', 'recommend|suggest|should|next|propose|decision|ask'],
    expect: [
      'Three things, in his order: what you found, how sure you are, what you want them to do.',
      'Flag what he should not say yet. A stakeholder who repeats a soft number in a leadership room has been let down by you, not by himself.',
      'He asked for what he can say, not for the method. Do not send him the method.',
    ],
    ifIgnored: 'Vikram went in with his own reading of your work. Whatever he told that room is now what the company believes you found.',
    note: 'Briefing the person who will speak for you is a separate skill from doing the work, and it is the one that decides whether the work changes anything.',
  },
  {
    key: 'dm-10', type: 'closure check', day: 5, from: 'pmo', senderName: 'Programme Office', via: 'email',
    needsReply: true,
    subject: 'Closing {project} — confirm before I sign it off',
    body: "{name},\n\n{project} is due to close today. Before I mark it complete I need you to confirm:\n\n  • is the deliverable actually done, in your view\n  • is anything still outstanding, and who holds it\n  • anything we should carry into the next piece of work\n\nIf it is not done, say so. A project closed early comes back as a worse one.\n\nProgramme Office",
    markers: ['done|complete|finish|deliver|yes|ready|closed', 'outstanding|nothing|remaining|open|left|follow.?up|none', 'next|carry|forward|future|recommend|later|revisit'],
    expect: [
      'Answer all three, in order. A closure note that skips the outstanding items is how work quietly disappears.',
      'If something is unfinished, say it now. It costs you nothing today and a great deal in six weeks.',
      'The carry-forward line is where you get to set up your next project. Use it.',
    ],
    ifIgnored: '{project} was closed on the Programme Office\'s assumption rather than your confirmation. Anything left open is now nobody\'s.',
    note: 'Closing a project properly is how the next one starts on time. Almost nobody does it, which is exactly why it gets noticed.',
  },
];

// ---- The other eight ------------------------------------------------------------------
//
// Company mail. None of it needs anything from the learner; archiving or deferring it is
// the correct handling and is scored as such. It is here because an inbox with nothing to
// ignore does not teach anyone to triage.

const NOISE = [
  // Day 1 — Monday-shaped.
  { key: 'nz-101', day: 1, from: 'broadcast', senderName: 'TenzorGrid Internal', subject: 'All-hands this Thursday, 16:00 — agenda attached',
    body: "Quarterly all-hands is Thursday at 16:00 in the main room and on the usual link.\n\nAgenda: quarter results, the two new market launches, an update on the office move, and twenty minutes of open Q&A. Submit questions in advance through the form if you would like them answered live.\n\nNo need to reply to this." },
  { key: 'nz-102', day: 1, from: 'it_ops', senderName: 'IT Service Desk', subject: 'Planned VPN maintenance — Saturday 02:00-05:00',
    body: "The VPN will be unavailable on Saturday between 02:00 and 05:00 while we move to the new gateway.\n\nIf you work weekends, plan around it. No action needed from you and no reconfiguration required afterwards — your existing profile will continue to work." },
  { key: 'nz-103', day: 1, from: 'people_partner', senderName: 'Priya Nair', subject: 'Reminder: benefits enrolment window closes in 10 days',
    body: "A reminder that the annual benefits window closes in ten days. If you are happy with your current selections you do not need to do anything — they roll over automatically.\n\nIf you want to change anything, the portal link is in the intranet under People." },
  { key: 'nz-104', day: 1, from: 'broadcast', senderName: 'TenzorGrid Internal', subject: 'Newsletter — week 14',
    body: "This week: the Bengaluru team hit their reliability target four months early; a write-up of how the new onboarding flow cut setup time by half; two open roles in Platform worth referring people to; and the coffee machine on floor three has been fixed, again.\n\nRead the full issue on the intranet." },
  { key: 'nz-105', day: 1, from: 'pmo', senderName: 'Programme Office', subject: 'FYI — portfolio report published',
    body: "The portfolio report for last week is published and available on the shared drive.\n\nSent to everyone with an active project for visibility. No action required." },
  { key: 'nz-106', day: 1, from: 'security', senderName: 'Security Team', subject: 'Phishing simulation results — team summary',
    body: "Our quarterly phishing simulation ran last week. Across the company, 8% clicked and 2% entered credentials, both improved on last quarter.\n\nNo individual results are shared with managers. The refresher module is optional and takes six minutes." },
  { key: 'nz-107', day: 1, from: 'facilities', senderName: 'Workplace Team', subject: 'Desk booking now open for next month',
    body: "Desk booking for next month opened this morning. The usual rule applies: book what you will use, release what you will not.\n\nFloor two is closed for carpet replacement in the last week of the month." },
  { key: 'nz-108', day: 1, from: 'learning', senderName: 'Learning & Development', subject: 'New on the learning platform this month',
    body: "Added this month: an advanced SQL window functions course, a short series on presenting to executives, and a refreshed statistics primer.\n\nAll optional, all self-paced. Your manager can approve time for any of them if you ask." },

  // Day 2.
  { key: 'nz-201', day: 2, from: 'broadcast', senderName: 'TenzorGrid Internal', subject: 'Welcome to the four people who joined this week',
    body: "Please welcome our new joiners: two in Platform Engineering, one in Customer Success and one in Legal.\n\nTheir intros are on the intranet. If they land in your area, a fifteen-minute call in their first fortnight is worth more to them than you would think." },
  { key: 'nz-202', day: 2, from: 'it_ops', senderName: 'IT Service Desk', subject: 'Your password expires in 14 days',
    body: "An automated reminder that your account password expires in fourteen days.\n\nYou can change it at any time from the self-service portal. You will be reminded again at seven days and at two." },
  { key: 'nz-203', day: 2, from: 'engineering_manager', senderName: 'Arjun Rao', subject: 'Release notes — data platform 4.2',
    body: "Data platform 4.2 went out last night. Query timeouts on the reporting cluster are up from 60s to 300s, the old v1 export endpoint is now deprecated, and column-level lineage is visible in the catalogue.\n\nSent to all data consumers for awareness. Nothing breaks today." },
  { key: 'nz-204', day: 2, from: 'finance_ops', senderName: 'Finance Operations', subject: 'Expense claims for last month — cut-off Friday',
    body: "Last month's expense claims must be submitted by Friday to make this payroll run.\n\nAnything later moves to next month. If you have no claims, ignore this." },
  { key: 'nz-205', day: 2, from: 'broadcast', senderName: 'TenzorGrid Internal', subject: 'Upcoming: customer advisory board, 12th',
    body: "Twelve customers join us on the 12th for the advisory board. Expect visitors on floor four and a quieter than usual leadership team that day.\n\nThemes this round: reporting, reliability and pricing transparency." },
  { key: 'nz-206', day: 2, from: 'people_partner', senderName: 'Priya Nair', subject: 'Engagement survey opens Monday',
    body: "The half-yearly engagement survey opens Monday and stays open for two weeks. It takes about eight minutes and results are anonymous below team level.\n\nLast round's biggest theme was clarity of career paths, and you will see what came of that in the results deck." },
  { key: 'nz-207', day: 2, from: 'support_lead', senderName: 'Sneha Joshi', subject: 'Weekly incident digest — 1 SEV2, 4 SEV3',
    body: "Last week: one SEV2 (checkout latency, resolved in 41 minutes) and four SEV3s, all closed.\n\nFull write-ups are linked in the digest. Circulated for awareness — no action for anyone outside Support." },
  { key: 'nz-208', day: 2, from: 'facilities', senderName: 'Workplace Team', subject: 'Fire drill Wednesday, approximately 11:00',
    body: "There will be a fire drill on Wednesday at approximately 11:00. Please leave by your nearest exit and assemble in the north car park.\n\nIt should take under fifteen minutes. Plan meetings accordingly." },

  // Day 3.
  { key: 'nz-301', day: 3, from: 'broadcast', senderName: 'TenzorGrid Internal', subject: 'Quarter results are in — summary',
    body: "Revenue closed the quarter 6% above plan, driven mostly by renewals rather than new business. Gross margin improved slightly. Headcount grew by 31.\n\nThe full deck and the CEO's write-up are on the intranet ahead of Thursday's all-hands." },
  { key: 'nz-302', day: 3, from: 'pmo', senderName: 'Programme Office', subject: 'Projects starting next month — for visibility',
    body: "Three pieces of work kick off next month: the pricing review, the customer health score rebuild, and phase two of the data catalogue.\n\nCirculated so teams can see what is coming. Resourcing conversations happen through your manager, not through us." },
  { key: 'nz-303', day: 3, from: 'it_ops', senderName: 'IT Service Desk', subject: 'Laptop refresh cycle — eligibility list published',
    body: "The annual laptop refresh list is published. If your machine is over three years old you are on it and IT will contact you directly to arrange a swap.\n\nNo action needed unless you hear from us." },
  { key: 'nz-304', day: 3, from: 'comms', senderName: 'Meera Pillai', subject: 'Style guide updated — numbers and dates',
    body: "The internal style guide has been updated with a short section on numbers and dates, mostly because we keep arguing about them.\n\nShort version: spell out numbers under ten in prose, use figures in tables, and write dates as 14 April rather than 14/04." },
  { key: 'nz-305', day: 3, from: 'learning', senderName: 'Learning & Development', subject: 'Lunch & learn Friday: "Reading a P&L"',
    body: "Friday's lunch and learn is an hour on reading a profit and loss statement, run by someone from Finance and aimed at people who have never had to.\n\nOptional, recorded, and there is food." },
  { key: 'nz-306', day: 3, from: 'security', senderName: 'Security Team', subject: 'Reminder: do not share data extracts outside the company',
    body: "A reminder that employee-level and customer-level extracts must not leave company systems — no personal drives, no personal email, no external sharing links.\n\nIf you need to share an analysis externally, aggregate it first and ask us if you are unsure." },
  { key: 'nz-307', day: 3, from: 'broadcast', senderName: 'TenzorGrid Internal', subject: 'Office move update — timeline confirmed',
    body: "The move to the new building is confirmed for the last weekend of next quarter. Teams will be told their floor allocation six weeks beforehand.\n\nNothing changes for anyone before then." },
  { key: 'nz-308', day: 3, from: 'finance_ops', senderName: 'Finance Operations', subject: 'Budget planning cycle opens in two weeks',
    body: "The planning cycle for next year opens in two weeks. Cost centre owners will get templates directly.\n\nIf you are not a cost centre owner, this does not affect you." },

  // Day 4.
  { key: 'nz-401', day: 4, from: 'broadcast', senderName: 'TenzorGrid Internal', subject: 'Newsletter — week 15',
    body: "This week: photos from the advisory board, a profile of the Support team's on-call rotation, three internal moves worth congratulating, and a reminder that the referral bonus has gone up.\n\nFull issue on the intranet." },
  { key: 'nz-402', day: 4, from: 'it_ops', senderName: 'IT Service Desk', subject: 'Scheduled reporting downtime Sunday 06:00-08:00',
    body: "The reporting warehouse will be unavailable on Sunday between 06:00 and 08:00 for index maintenance.\n\nScheduled reports due in that window will run afterwards. No action needed." },
  { key: 'nz-403', day: 4, from: 'people_partner', senderName: 'Priya Nair', subject: 'Mid-year review window — dates for your diary',
    body: "Mid-year reviews open in three weeks and close a fortnight later. Your manager will book the conversation; you will be asked to write a short self-assessment first.\n\nGuidance and last year's template are on the People pages." },
  { key: 'nz-404', day: 4, from: 'support_lead', senderName: 'Sneha Joshi', subject: 'Weekly incident digest — quiet week',
    body: "Two SEV3s, both closed inside an hour, and nothing above that. Quietest week since the platform upgrade.\n\nCirculated for awareness." },
  { key: 'nz-405', day: 4, from: 'pmo', senderName: 'Programme Office', subject: 'Template refresh — project closure notes',
    body: "We have shortened the project closure template from four pages to one. It now asks for what was delivered, what is outstanding, and what should carry forward.\n\nIt applies to projects closing from next week." },
  { key: 'nz-406', day: 4, from: 'facilities', senderName: 'Workplace Team', subject: 'Cycle storage is moving to the basement',
    body: "Cycle storage moves to the basement from Monday. Access is via your existing badge.\n\nThe ground floor racks will be removed over the weekend — please take bikes home before Friday evening." },
  { key: 'nz-407', day: 4, from: 'learning', senderName: 'Learning & Development', subject: 'You have 2 optional modules outstanding',
    body: "An automated note: you have two optional learning modules outstanding, both with no deadline.\n\nIf you would rather not receive these reminders you can turn them off in your platform settings." },
  { key: 'nz-408', day: 4, from: 'engineering_manager', senderName: 'Arjun Rao', subject: 'Deprecation notice: v1 export endpoint, 90 days',
    body: "The v1 export endpoint will be switched off in ninety days. Everything it does is available on v2 with the same authentication.\n\nIf you use it in a saved job, migrate it before then. If you do not know whether you do, the catalogue will tell you." },

  // Day 5 — Friday-shaped.
  { key: 'nz-501', day: 5, from: 'broadcast', senderName: 'TenzorGrid Internal', subject: 'All-hands recording and Q&A answers',
    body: "Thursday's all-hands recording is up, along with written answers to the eleven questions we did not get to.\n\nThe two most asked were about the office move and about promotion timing; both are answered in full." },
  { key: 'nz-502', day: 5, from: 'people_partner', senderName: 'Priya Nair', subject: 'Long service — congratulations to this month\'s list',
    body: "Eleven people reach a long service milestone this month, including two at ten years.\n\nThe full list is on the intranet. Do go and say something to the ones you work with." },
  { key: 'nz-503', day: 5, from: 'it_ops', senderName: 'IT Service Desk', subject: 'Survey: how did we do on your last ticket?',
    body: "You closed a ticket with us recently. If you have thirty seconds, the survey is two questions.\n\nEntirely optional, and we do read the free-text answers." },
  { key: 'nz-504', day: 5, from: 'finance_ops', senderName: 'Finance Operations', subject: 'Payroll cut-off moved forward one day this month',
    body: "Because of the bank holiday, payroll cut-off moves forward by one day this month. Anything submitted after Thursday lands next month.\n\nPay dates are unchanged." },
  { key: 'nz-505', day: 5, from: 'comms', senderName: 'Meera Pillai', subject: 'Draft: the piece on your team goes out Thursday',
    body: "The newsletter piece covering your team is drafted and scheduled for Thursday.\n\nSending so nobody is surprised to see it. It has already been through the usual check, so there is nothing you need to do." },
  { key: 'nz-506', day: 5, from: 'security', senderName: 'Security Team', subject: 'Access review — your manager has confirmed your permissions',
    body: "The quarterly access review is complete. Your manager confirmed your current system permissions and no changes were made.\n\nSent for your records." },
  { key: 'nz-507', day: 5, from: 'pmo', senderName: 'Programme Office', subject: 'Portfolio report — {project} appears this week',
    body: "This week's portfolio report is published and {project} appears in it.\n\nCirculated for visibility. Your status line went in as submitted." },
  { key: 'nz-508', day: 5, from: 'broadcast', senderName: 'TenzorGrid Internal', subject: 'Friday social — 17:30, ground floor',
    body: "Drinks and something to eat from 17:30 on the ground floor. No agenda, no speeches.\n\nEveryone welcome, including people who are only in for the food." },
];

// ---- Company admin you can actually do ------------------------------------------------
//
// A reminder to do something is only realistic if there is somewhere to go and do it.
// Without that it is a sign on a wall, and the learner's first thought is "where would I
// even do that?" -- which is a fair question and the wrong one to be thinking about
// mid-analysis.
//
// So the admin mail carries the form with it. These are not graded and they do not gate
// the day; they are the small, dull, compulsory things a job is actually made of, and
// doing them takes fifteen seconds. Field kinds are deliberately few: a number, a choice,
// or a tick.
//
// Hours used to be one of these, on Monday and again on Friday. They are not any more:
// timesheets became a place rather than a form, because chasing other people's is half
// the job at lead and above and you cannot chase a mail you have already replied to.

const CHORES = [
  {
    key: 'ch-01', day: 1, from: 'finance_ops', senderName: 'Finance Operations',
    subject: 'Expenses — last month closes Wednesday',
    body: "Hi {name},\n\nIf you spent anything on the company last month, get it in by Wednesday. After that it lands in the next period and you wait another month to see it.\n\nSeparately: hours no longer come through us by mail. They live on the Timesheets tab now, and they are due daily rather than in one Friday panic.",
    action: {
      submitLabel: 'Send my claim',
      fields: [
        { key: 'amount', label: 'Amount to claim (₹)', kind: 'number', min: 0, max: 50000, step: 100, placeholder: '0', required: true },
        { key: 'charged', label: 'Charge it to', kind: 'choice', required: true,
          options: ['Nothing to claim', '{project}', 'Internal / admin', 'Training'] },
      ],
    },
    confirm: 'Claim recorded — ₹{amount} against {charged}. It clears with the next payroll run.',
  },
  {
    key: 'ch-02', day: 2, from: 'security', senderName: 'Security Team',
    subject: 'Annual confirmation: data handling',
    body: "This is the yearly one, and it matters more than usual for you this month because you are working on people data.\n\nThree things you are confirming:\n\n  • employee-level extracts stay inside company systems\n  • you aggregate before sharing anything outside your team\n  • if you are not sure whether something can be shared, you ask first\n\nTick and you are done for another year.",
    action: {
      submitLabel: 'I confirm',
      fields: [
        { key: 'confirmed', label: 'I have read and I confirm the three points above', kind: 'ack', required: true },
      ],
    },
    confirm: 'Recorded. That is you clear for the year — thank you.',
  },
  {
    key: 'ch-03', day: 3, from: 'facilities', senderName: 'Workplace Team',
    subject: 'Book your desk for next week',
    body: "Desk booking for next week is open. Pick a floor and how many days you expect to be in.\n\nBook what you will use and release what you will not — we are running at about 80% on Tuesdays and Wednesdays and it makes a real difference.",
    action: {
      submitLabel: 'Book it',
      fields: [
        { key: 'floor', label: 'Floor', kind: 'choice', required: true,
          options: ['Floor 2 — Data & Analytics', 'Floor 3 — quiet zone', 'Floor 4 — project rooms'] },
        { key: 'days', label: 'Days in the office next week', kind: 'number', min: 0, max: 5, step: 1, placeholder: '3', required: true },
      ],
    },
    confirm: 'Booked — {days} days on {floor}. Your badge will let you in from Monday.',
  },
  {
    key: 'ch-04', day: 4, from: 'people_partner', senderName: 'Priya Nair',
    subject: 'Two questions — engagement pulse',
    body: "We run this every quarter and it takes about twenty seconds. Answers are anonymous below team level and we do publish what comes back, including the uncomfortable parts.\n\nLast round the biggest theme was clarity of career paths, which is why the levelling guide exists now.",
    action: {
      submitLabel: 'Send my answers',
      fields: [
        { key: 'clarity', label: 'I am clear on what is expected of me this week', kind: 'choice', required: true,
          options: ['Strongly agree', 'Agree', 'Neither', 'Disagree', 'Strongly disagree'] },
        { key: 'workload', label: 'My workload is manageable', kind: 'choice', required: true,
          options: ['Strongly agree', 'Agree', 'Neither', 'Disagree', 'Strongly disagree'] },
      ],
    },
    confirm: 'Got it, thank you. Results go out in a fortnight.',
  },
  {
    key: 'ch-05', day: 5, from: 'it_ops', senderName: 'IT Service Desk',
    subject: 'Licence true-up — are you still using these?',
    body: "We pay per seat for a handful of tools and we are billed whether you open them or not. Once a month we ask.\n\nSay what you actually use. Nothing bad happens if you hand a licence back and want it again later — it takes an hour to reissue.",
    action: {
      submitLabel: 'Confirm my tools',
      fields: [
        { key: 'bi_seat', label: 'The BI dashboard seat', kind: 'choice', required: true,
          options: ['Using it weekly', 'Using it occasionally', 'Hand it back'] },
        { key: 'confirmed', label: 'I have checked this rather than guessed', kind: 'ack', required: true },
      ],
    },
    confirm: 'Noted — {bi_seat}. That is the true-up done for the month.',
  },
];

function choresFor(dayIndex) {
  return CHORES.filter((c) => c.day === dayIndex);
}

function choreByKey(key) {
  return CHORES.find((c) => c.key === key) || null;
}

// The ambient senders are not colleagues — you cannot chat to the Programme Office and it
// has no desk. They exist only as mail, which is why they live here and not in the roster.
const AMBIENT_SENDERS = {
  pmo: { label: 'Programme Office', tone: 'blue' },
  broadcast: { label: 'Company', tone: 'gray' },
  it_ops: { label: 'IT', tone: 'gray' },
  security: { label: 'Security', tone: 'gray' },
  facilities: { label: 'Workplace', tone: 'gray' },
  learning: { label: 'Learning', tone: 'blue' },
  finance_ops: { label: 'Finance Ops', tone: 'gray' },
};

function deskFor(dayIndex) {
  return DESK.filter((d) => d.day === dayIndex);
}

function noiseFor(dayIndex) {
  return NOISE.filter((n) => n.day === dayIndex);
}

function deskByKey(key) {
  return DESK.find((d) => d.key === key) || null;
}

module.exports = {
  MIN_EMAILS_PER_DAY,
  DESK_PER_DAY,
  DESK,
  NOISE,
  CHORES,
  choresFor,
  choreByKey,
  AMBIENT_SENDERS,
  deskFor,
  noiseFor,
  deskByKey,
};
