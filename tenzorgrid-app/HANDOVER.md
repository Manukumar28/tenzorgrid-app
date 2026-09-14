# TenzorGrid — session handover

**Written 14 Sep 2026.** Paste this into a new chat as the first message, or just say
*"read HANDOVER.md and PROJECT_PLAN.md"*.

`PROJECT_PLAN.md` is the persistent memory and the fuller document — read it second. This
file is the short version plus the things that only live in a chat and would otherwise be
lost: what is blocking, what I would do next, and the working habits that produced the code
you are inheriting.

---

## 1. What this is

TenzorGrid is a four-pillar AI SaaS platform. Only the **Career Growth** pillar is built.
Inside it, the current line of work is the **Virtual Workspace** — a simulated job, not a
course. The user's own framing:

> "User need to take hands on experience to crack the interview and negotiate for higher
> salary with virtual experience."

Everything is judged against one question: *would a hiring manager believe the story this
learner tells about their last twelve weeks?*

The user, **Manukumar R**, is a non-technical founder. He directs the work conversationally,
tests personally, and reports symptoms accurately — when he says *"per day only one task
creating"*, measure it, because it has been true every time. Explain decisions in plain
terms; he will push back well when something is wrong.

---

## 2. Where things stand

**The Data Analyst track is complete at all four levels and live.**

| | |
| --- | --- |
| Projects | **16** — Junior, Senior, Team Lead, Manager × 4 each |
| Tasks | **480** (30 per project, 6 a day, 5 days) |
| Activities | **160** (10 per project) |
| Situations | **160** (10 per project) |
| Quizzes | **16** (one per project, Friday) |
| Project briefs | **16** |
| Datasets | **5**, all seeded and deterministic |
| Tests | **23 suites, 16 five-day walks, 2,389 assertions, all green** |

Live at `https://www.tenzorgrid.com/workspace.html`. Merged as **#76**, deployed
14 Sep 2026. `PROJECT_PLAN.md` was brought up to date in **#77**.

### The catalogue

| Level | Projects | Dataset |
| --- | --- | --- |
| Junior | Q1 Compensation Review · Headcount & Hiring Trends · Outage Impact & Client Recovery · Pay Equity Audit | `hr_core`, `saas_ops` |
| Senior | Platform Reliability Review · Account Economics Review · Activation & Onboarding Review · Onboarding Experiment Readout | `saas_ops`, `product_events` |
| Team Lead | Half-Year Trading Review · Margin & Promotion Review · Range & Space Review · Year-End Board Pack | `retail_sales` |
| Manager | Demand & Capacity Review · Tooling & Licence Renewal · Intake & Prioritisation · The Headcount Case | `analytics_ops` |

Promotion ladder: junior→senior at **75**, senior→lead at **80**, lead→manager at **85**.
The conversation **opens at project 3** and the **verdict lands at project 4** — the user's
rule, so nobody discovers the bar on the day they are measured against it. Manager is the
top; the card reads "Top of the ladder" and the machinery stays silent.

---

## 3. Blocking — do these before real learners arrive

1. **`TIME_TRAVEL=1` is still set on Railway.** It is what makes the track testable in one
   sitting. It also walks past every deadline in the programme, and the deadline is most of
   what makes this a job. **Remove the variable.**
2. **The database has no backup anywhere.** `lib/backup.js` is written and tested
   (`VACUUM INTO` → gzip ~27x → Supabase `db_backups`, keep 6) but sits **unmerged** on
   branch `claude/tenzorgrid-project-transfer-0cm81z`, along with `/api/health`,
   photos-to-disk, template character replies and the AI-escalation budget. Railway's HOBBY
   plan reports `maxBackupsCount: 0`, so there is no platform fallback. **Merge it.**

---

## 4. What I would do next, in order

1. **Phase 7 — the last three of the user's own thirteen points.** The weekly retro/1:1,
   the performance record, and the interview defence + certificate + employee ID.
   *A learner currently finishes four weeks of real work with no artefact to take to an
   interview, which is the entire stated purpose of the product.* This is the gap I would
   argue hardest for.
2. **Weeks 5–12.** Four weeks authored against a twelve-week promise. What happens after
   the Manager track completes is currently: nothing.
3. **A second role.** Everything built — the day model, the ladder, the content gate, the
   walker — is role-agnostic. `ROLE_CATALOG` has one entry, `data_analyst`.

The user was testing the full track when this session ended. **Ask what he found before
starting anything** — his testing has changed the plan more than once.

---

## 5. The code

| File | Lines | What it is |
| --- | --- | --- |
| `lib/workspace.js` | ~12,800 | The core. Catalogue, all 480 tasks, day engine, promotion, mail, review gate |
| `lib/dayitems.js` | ~7,150 | Activities, situations, quizzes — 16 projects' worth |
| `lib/datasets.js` | ~1,550 | Five seeded datasets, mulberry32 PRNG |
| `lib/projectdocs.js` | ~680 | 16 project briefs + the tool registry |
| `lib/db.js` | ~460 | SQLite schema, `ensureColumn()` safe migrations |
| `lib/tasktypes.js` | ~175 | The deterministic graders (chart, choice, writeup) |
| `workspace-app/` | — | React/Vite/Tailwind/Recharts frontend, its own `package.json` |

**The repo lives in a subdirectory**: `/home/user/tenzorgrid-app/tenzorgrid-app`. The parent
is not the repo. This catches everyone once.

**The frontend is a generated artifact.** `public/workspace.html` and
`public/workspace-assets/` are gitignored. After any backend change:
`cd workspace-app && npm run build` (or root `npm run build`). **Never `npx vite build`** —
it silently skips `postbuild.js` and ships a stale bundle against a fresh backend.

### Testing

The whole harness now lives in `test/` and is committed — **it used to live only in an
ephemeral scratchpad, which is why this handover exists at all.**

```bash
./test/run-all.sh           # 23 suites + 16 five-day walks, ~2 minutes
node test/content-gate-test.js /tmp/x    # just the content rules
node test/project-walk.js /tmp/x capacity-review   # one project, five days
```

Two of those suites are the reason 480 authored tasks are maintainable:

- **`content-gate-test.js`** holds every finished project to the shape: 30 tasks over
  5 days, ≥3 tool kinds per day, ≥3 SQL tasks that exercise the dataset's characteristic
  mistake **and whose naive form returns a different answer**, at most one single-row query,
  ≥3 no-reply situations, ≥1 task flagged for rework, and the full 10/10/1.
- **`project-walk.js`** walks any project through all five days as a learner would.

Known: **`tmpl-test.js` is stale and failing**, and was failing on `main` before this work
started. It is excluded from `run-all.sh`, which means nobody is watching whatever it was
written to watch.

---

## 6. How to author content, if you add any

This is the part that does not survive in code comments, and it is most of what made the
track good rather than merely complete.

**The rhythm, per project:**

> measure the dataset with real queries first → design the five days around the quirks you
> find → write 30 tasks in day-blocks → write 10 activities + 10 situations + the quiz →
> run the content gate → run the five-day walk → fix → commit

**Every project follows the same five-day arc.** This is what made 16 of them authorable:

| Day | Shape |
| --- | --- |
| Mon | The intake — what is actually being asked, which is rarely what was written |
| Tue | Warm up on the data; produce the obvious answer |
| Wed | **The wobble** — the finding that overturns Monday's answer |
| Thu | Rebuild properly; decide what can honestly be claimed |
| Fri | What gets published, and what changes so it cannot recur |

**The non-negotiable discipline:** *every figure quoted in a brief, option, rubric or quiz
answer is measured against the generated data, not assumed.* When a measured value
disagrees with authored text, **the text is corrected** — never leave a learner to see a
contradiction between the brief and their own query result. Roughly a dozen figures were
corrected this way while authoring, and three real data bugs were found by the same habit.

**What each level changes.** "Different projects, not the same brief written vaguer" was the
user's decision and it has to mean something concrete:

- **Junior** — compute the number correctly. The traps are population traps.
- **Senior** — rates and distributions rather than totals; decide what to exclude.
- **Team Lead** — you are handed a number somebody else computed and asked whether the
  business can be run on it.
- **Manager** — *the subject of the analysis becomes the team you manage.* A misread retail
  figure produces a bad range decision; a misread capacity figure produces a performance
  conversation with a named person.

**Each dataset has a characteristic population mistake**, and the gate enforces that every
project exercises the one it uses:

| Dataset | The mistake |
| --- | --- |
| `hr_core` | leavers still counted as current staff |
| `saas_ops` | a client who has already churned |
| `product_events` | Meridian's own staff left in a customer metric |
| `retail_sales` | a fixed estate when stores opened and closed; inner-joining sales to products |
| `analytics_ops` | the manager in a delivery denominator; the leaver still in every table; timing work to first delivery rather than final close |

---

## 7. Decisions on record — don't relitigate without a reason

- **Seeded datasets, not AI-generated per learner.** Identical data for every learner is
  what makes automatic grading possible at all. This is the keystone decision and the reason
  the whole twelve weeks costs about **$4 per learner**.
- **The skill test comes *before* the first project.** It is the baseline for the skill
  matrix; without it "you improved" is unprovable. The user overruled my ordering here and
  was right.
- **Junior and senior get different projects**, not the same brief written vaguer.
- **Promote on performance AND training done** — both, reported separately with the
  arithmetic attached.
- **Only the Line Manager grades.** Other characters help, redirect, and get in the way.
- **The score is withheld until the manager signs off.** Telling someone they scored 90 and
  then asking them to justify their work turns the conversation into a formality.
- **Four of ten situations deserve no reply.** If everything in the inbox matters, triage is
  not a decision and the habit trained is "answer everything".
- **Typing is the real path, voice is the upgrade.** `SpeechRecognition` is Chrome/Edge
  only; voice-first would have broken it for a third of learners.

---

## 8. Environment

- **Railway** project `d6f02aa0-a970-45c4-9ee0-4a8f475c2570`, service
  `88ef07a5-5817-41a1-bafa-130f384be971`, production env
  `18f4be3c-199f-4e8c-bfd7-435a0ebd6326`. Deploys on push to `main`.
- Env vars set: `ANTHROPIC_API_KEY`, `DATA_DIR`, `SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY`, `ADZUNA_APP_ID`, `ADZUNA_APP_KEY`, **`TIME_TRAVEL`** (remove
  this one — see §3).
- **Outbound HTTPS to `www.tenzorgrid.com` and Railway is blocked from the agent sandbox.**
  You cannot curl the live site. Verify deploys through the Railway MCP tools —
  `list-deployments` for status, `get-logs` for the boot line.
- **Pushing directly to `main` is blocked** by an auto-mode policy classifier. Push a
  branch, open a PR, merge the PR. That works.
- Commit attribution and PR footers are set by the harness; follow whatever the session's
  system reminder says rather than copying the last commit.

---

## 9. Things that will waste your time if nobody tells you

- `pkill -f <pattern>` kills your own shell. Don't.
- `cd X && cmd` does not reliably persist — the working directory resets between calls. Use
  absolute paths.
- The shell eats single quotes in `node -e '...'`. Write patch scripts to a file with a
  quoted heredoc, or use `python3 - <<'PYEOF'`.
- A `fullPage` Playwright screenshot resizes the viewport, which makes `ResponsiveContainer`
  re-render and Recharts replay its entry animation from zero — so a fullPage capture of a
  fresh chart photographs an empty one. Scope the capture to the element.
- The CSP needs `'wasm-unsafe-eval'` or Pyodide throws a `CompileError` and then **never
  settles** — the symptom is an infinite spinner with no error surfaced.
- The GitHub merge API has returned HTTP 500 on all three merge methods and then succeeded
  on a retry. Retry before concluding anything is wrong.

---

## 10. One correction I owe the record

When I finished the Manager level I told the user "twenty projects, 600 tasks". That was
wrong arithmetic — four levels × four projects is **sixteen**, and 16 × 30 is **480**. The
figure appears wrongly in the commit message for the Manager 4 commit (`be3080c`) and in the
squashed body of #76. Every figure in `PROJECT_PLAN.md` and in this file was read off the
code rather than recalled. If you quote a number to the user, measure it first.
