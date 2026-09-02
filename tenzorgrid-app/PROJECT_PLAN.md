# TenzorGrid — Project Plan & Current State

This file is the persistent memory for this project across sessions/context resets.
**Read this first** before doing anything else. Update it whenever nearing a context
limit, after finishing a phase, or after any decision that changes the plan.

## Product vision

TenzorGrid is a four-pillar AI SaaS platform (from the V3 business plan):

1. **Career Growth** (branded name; internally "Job Assistant") — job matching, resume,
   interview prep, career upgrade/transition guidance. **This is the only pillar built
   so far.**
2. **Business Growth** (was "Business Assistant") — ad generation, CRM, lead scoring,
   forecasting. Not started.
3. **Smart Trading** (was "Trader Assistant") — algorithmic strategy, sentiment, risk
   management. Not started.
4. **Custom AI Solutions** (was "Custom AI Automation") — bespoke workflows, RAG
   chatbots, API access. B2B, sold via conversation, not self-serve. Not started.

One account, multiple pillars — a user can activate any combination; each pillar has
its own onboarding that only triggers when activated.

## Key decisions on record (don't relitigate without reason)

1. **Build order:** Career Growth → Business Growth → Smart Trading → Custom AI
   Solutions. Trader pillar carries the most legal exposure (real-money auto-trading
   brushes SEBI algo-trading rules in India); Custom AI is B2B and needs the other
   three proving the platform first.
2. **Stack:** Keep the zero-npm-dependency Node.js + SQLite backbone. Animation via
   GSAP, **vendored locally** (`public/vendor/gsap.min.js`, fetched via npm but not a
   project dependency) rather than a CDN — the site's CSP (`script-src 'self'`) blocks
   third-party script origins, which was deliberate hardening from PR #13. Don't loosen
   the CSP for a CDN; vendor the file instead.
3. **Risk gating:** Real trading execution and real ad spend ship simulated/paper-mode
   first. Flipping to live money is a separate milestone needing explicit user sign-off.
4. **Naming:** Plain, literal, self-explanatory names only — no clever/abstract
   metaphors (learned this the hard way: first pass used "Orbit/Beacon/Vector/Circuit,"
   rejected as needing explanation, which defeats the point of a name). Icons must be
   bold, recognizable, real objects (rocket, briefcase, candlesticks, chip) — never
   emoji, never abstract line-art that doesn't read as anything at a glance.
5. **Monetization is not an afterthought.** Real prices always, upgrade moments woven
   through the product (not one box), genuine engagement mechanics (progress bars,
   milestone celebrations) — never fake urgency, fake countdowns, or confirm-shaming.
6. **Git workflow quirk:** GitHub squash-merges create a new commit hash on `main` that
   isn't a descendant of the feature branch's last commit. After every merge, before
   new work: `git fetch origin main && git checkout -B claude/tenzorgrid-project-transfer-0cm81z origin/main`,
   then `git push --force-with-lease` when pushing the next round (safe — the branch
   only ever contains already-merged history at that point).
   **This step is easy to skip when resuming after a session interruption** (it was
   skipped once, on the PR #19 work, and turned the usual harmless divergence into a
   real GitHub-reported merge conflict — fixed by cherry-picking the stray commit onto
   a fresh branch off `origin/main`). Always run the reset explicitly as the first
   action of any resumed session, even if the previous turn was cut off mid-work.
7. **PR flow:** Create PR against `main`, squash-merge, confirm Railway deploy status
   before telling the user it's live (Railway only auto-deploys from `main`).
8. **Whenever the user asks for a design upgrade, always look for premium icons/images
   and premium design quality first** — don't default to basic/flat icon libraries
   (Lucide, Heroicons, emoji) for anything the user will actually look at. Source real
   illustrated/3D-style assets and polish, matching the bar set by the Virtual Workspace
   redesign: a first pass using DiceBear's flat "notionists" line-art for character
   avatars was explicitly rejected ("why don't we use advanced 3D Avatar Illustration
   Icon Set designs") in favor of self-hosted 3D illustrations from the user's own Figma
   account. The user has a Figma account connected (`mcp__Figma__*` tools) — when premium
   icons/avatars are needed, check there first (existing files, or a well-matched Figma
   Community pack the user duplicates in); self-host the result under
   `public/assets/...` rather than hotlinking a third-party generator API (matches the
   zero-external-dependency stack decision above, and avoids repeating the DiceBear
   mismatch). Only fall back to a plain icon library when the user hasn't specifically
   asked for a design upgrade, or for icons that are genuinely incidental (not part of
   the visual identity being upgraded).
9. **Cap AI cost at the AI call, not at a proxy for it.** Every graded submission and
   every learner-sent chat/email is a real API call and the only meaningful cost driver
   in the Virtual Workspace — time-on-platform figures are not. So per-learner, per-day
   ceilings live in `DAILY_AI_LIMITS` (`lib/workspace.js`) and are enforced where the
   calls actually happen (`submitTask`, `sendLearnerMessage`), returning a friendly
   "come back tomorrow" rather than a hard error. They're counted from rows already
   written (`countTodaysAiUse`), so adding or tuning a cap needs no schema change. Any
   future AI-backed feature gets the same treatment before it ships, not after.
10. **Motivate with the learner's own progress, not peer ranking.** The Overview
   leaderboard was removed deliberately: peer comparison demotivates everyone who isn't
   near the top, which is most people, and a solo learner just saw themself. Engagement
   cards should key off self-referential progress instead — streaks, personal bests, real
   manager praise — and every one of them must be computed from stored rows. The standing
   no-fake-data rule applies with full force here: an invented streak or a synthesized
   compliment is worse than an honest empty state.

## Live infrastructure

- **Domain:** `tenzorgrid.com` (GoDaddy) → forwards to `www.tenzorgrid.com` → Railway
  custom domain (CNAME). Apex can't take a CNAME directly (DNS spec — NS/SOA already
  live there), hence the forward. Both verified and SSL-issued as of this session.
- **Hosting:** Railway project `amusing-joy` (id `d6f02aa0-a970-45c4-9ee0-4a8f475c2570`),
  service `tenzorgrid-app` (id `88ef07a5-5817-41a1-bafa-130f384be971`), deploys from
  `main`, root directory `tenzorgrid-app/` (repo has an outer wrapper directory —
  the real app lives one level down).
- **Repo:** `Manukumar28/tenzorgrid-app`. Designated working branch:
  `claude/tenzorgrid-project-transfer-0cm81z`.

## Phase 0 — Foundation, monetization, onboarding fix — ✅ COMPLETE

Shipped (across PRs #14, #16, #17, all squash-merged to `main`):

- Real pricing page (Free / Pro ₹499mo·₹4,999yr / Founding Member ₹249mo capped at 500),
  billing toggle, FAQ — `subscribe.html`
- Post-login welcome/pillar-picker screen, fixes the old forced-CV-upload complaint —
  `welcome.html`
- In-context upgrade teasers: blurred locked job cards with real hidden-count —
  `dashboard.html`
- 4-pillar landing page with real names, replacing "Pillar 3/4/5" placeholders —
  `landing.html`
- Dashboard pillar switcher (tabs for all 4 pillars, 3 locked with toast on click)
- Profile-completion meter with milestone confetti (`animations.js` → `TG.confetti`)
- GSAP animation layer, vendored locally — `public/vendor/gsap.min.js`,
  `public/animations.js` (shared: `fadeInUp`, `staggerIn`, `countUp`, `hoverLift`,
  `crossfade`, `confetti`)
- Plain-language pillar renaming + bold gradient SVG icon system (rocket, briefcase,
  candlesticks, circuit chip) — applied consistently across landing, welcome, dashboard
  switcher
- Landing page pillar cards drawn as a connected "constellation" with animated lines
  between them (had to widen card gaps + brighten the lines — first version was
  invisible)
- Onboarding CV-upload scan animation (shows while `/api/cv-parse` is in flight, reveals
  what was found, pops Step 2 fields on first fill) — `onboarding.html`
- Career Growth explainer page upgrade: icon badges, a real dashboard-preview card
  before the signup ask, "Coming soon" section (Virtual Workspace, AI Mock Interviews) —
  `career-growth.html`
- Career Growth page rebuilt again as 11 interactive flip cards (hover on desktop, tap
  on touch, keyboard-accessible) replacing the static feature list: Your Dashboard, Job
  Search, Application Tracker, Resume & Interview Prep, Salary Insights (new — surfaces
  existing `insights.js` market-value data as its own card), Career Upgrade, Career
  Transition, Course Recommendations, Auto Apply (all live), Virtual Workspace and AI
  Mock Interviews (both "Soon"). Also fixed a real routing bug: `landing.html` was
  sending logged-in users with a profile straight to `/dashboard.html` when they clicked
  the Career Growth pillar card, skipping this explainer page — now everyone lands here
  first and clicks through via the page's own nav (PR #19).
- Flip cards replaced again (user feedback: flipping "is not much professional") with an
  Apple.com-style sliding carousel — cards auto-advance slowly, pause on interaction,
  navigable via prev/next arrows, pagination dots, or native swipe/scroll (CSS
  scroll-snap). Each of the 11 cards now has a bespoke SVG illustration (self-authored,
  not a generated raster asset — `public/assets/career-cards/`, unique gradient + scene
  per feature, e.g. a dashboard mockup for Your Dashboard, a forked path for Career
  Transition) instead of a small line icon, with the description as a permanent caption
  overlay at the bottom of the card rather than hidden behind an interaction. Soon cards
  (Virtual Workspace, AI Mock Interviews) use desaturated art to read as not-yet-live at
  a glance. Respects `prefers-reduced-motion`, lazy-loads off-screen images, hides arrows
  on narrow viewports (PR #21).
- Carousel replaced on this page (kept in `styles.css`, unused, for a later spot — the
  user said the landing page, TBD) with a full-width responsive grid — the carousel's
  fixed-width 3-card row centered in a wide viewport read as "mid of system" with "very
  few information" visible. Grid auto-fits up to 5+ columns on wide screens. Also:
  removed the "Your Dashboard" card (redundant with the page's own dashboard CTA), made
  every card clickable (live cards are auth-aware links matching the page's other CTAs;
  Soon cards trigger the same toast pattern as the dashboard's locked-pillar tabs), and
  moved Virtual Workspace to the first card position — user confirmed it's next up for
  development (PR #23).
- Dashboard (`dashboard.html`) gained a real left sidebar (11 items mirroring the Career
  Growth grid) replacing its unused left-side dead space with a single centered column —
  clicking an item switches a right-hand panel via URL hash (linkable/bookmarkable,
  works with back/forward), same active-panel mechanism as `pro.html`'s existing
  `.pro-tabs`/`.pro-panel`. Panel content is honest about what's built: Dashboard/Job
  Search/Salary Insights/Career Upgrade show real data; Resume & Interview Prep/Career
  Upgrade/Career Transition are Pro-gated — Pro subscribers get a real deep link into the
  matching `pro.html` tab (which gained hash-based initial-tab support, e.g.
  `/pro.html#upgrade`), everyone else sees an honest "Unlock with Pro" prompt instead of
  a fake preview; Application Tracker/Course Recommendations/Auto Apply/Virtual
  Workspace/AI Mock Interviews show an honest "not built yet" panel (nothing exists for
  these anywhere in the app yet). Career Growth's live cards now carry a `data-hash` per
  feature so a logged-in user with a profile clicking one lands directly on the matching
  dashboard panel instead of the generic dashboard home (PR #25). Also widened the
  dashboard shell + header from the shared 1320px `.container` to a page-scoped 1800px
  `.container-app` so it uses the full window on wide screens, without affecting other
  pages that still use the narrower shared class (PR #26).
- `.container-app` extended to `pro.html` (header + `.dash-wrap`), `career-growth.html`
  (nav bar only — hero headline text stays in the narrower `.container` for readability),
  and `landing.html` (replacing the one-off `.container-wide`) — a full site-wide width
  audit. Confirmed with the user first that `login.html`, `signup.html`,
  `onboarding.html`, `welcome.html`, and `subscribe.html` should stay at their current
  deliberately-narrow, form-focused widths rather than also stretching to 1800px — those
  are small forms/pricing tables, not content surfaces, and forcing them wider would
  create dead space rather than remove it (PR #28).

**Not done, deferred on purpose:** Three.js (nothing needs 3D yet — waits for Phase 1's
Skill Tree module). Real payment gateway (still `/api/subscribe` dev-mode stub — flip to
live is its own future milestone). Postgres/vector-DB migration (SQLite is fine at this
scale).

## Known open items (not yet triaged — user said "let it be, later")

- User flagged: "Matching jobs and subscription navigations are missing" on some page
  (exact location not yet confirmed — revisit when user wants it addressed, don't guess
  and fix blind).
- From the original pre-Phase-0 audit, still open: no `.gitignore`, no SEO meta/OG tags/
  robots.txt/sitemap, `subscribe.html`-adjacent pages may still have a stray `alert()`
  somewhere worth a final check.

## Phase 1 — Complete the Career Growth pillar — IN PROGRESS (Virtual Workspace)

**Virtual Workspace — build started.** Full plan is in a private Claude artifact ("Virtual
Workspace Blueprint," not committed to the repo — re-derive from this summary if the
artifact is ever unreachable). Built from the user's own two prep documents: a 26-archetype
AI character architecture (7 pressure families, 4 non-negotiable rules — only the Line
Manager grades, characters know less than the learner, latency is a feature, hostility is
capped) and a 152-tool enterprise integration matrix (4 access tiers: self-hosted container,
learner's own free account + OAuth, desktop + artifact upload, not integrable).

**Decisions locked (all six confirmed, nothing blocking engineering):**
- **Pricing:** ₹1,999/month, a subscription entirely separate from the ₹499 Pro plan (no
  shared entitlement either direction). 3-day free trial, coupon codes supported. Price is
  calculated and charged only *after* the HR configuration wizard finishes (role → level →
  team → schedule) — never guessed upfront.
- **Schedule-based pricing:** learner picks Weekdays / Weekends / Custom at onboarding via a
  switch UI. Price scales with days/week (₹1,999 full 5-day week, ₹799 weekends, ₹400 ×
  custom days/week — proposed figures, adjust at build time if needed).
- **Certification is a recurring milestone, not one-time:** a "training month" = 22 attended
  days (a standard weekday month's count), applied uniformly regardless of schedule, so a
  weekend learner's 3-month milestone takes ~2.5 calendar months but the same 66 attended
  days. User-facing copy leads with the training requirement, not the price: "A minimum of
  3 months of hands-on experience is required before your certificate is eligible." Learner
  can keep training past the first milestone; every additional 66 days unlocks a re-issuable
  updated certificate, released only when the learner confirms.
- **Verification identity:** a permanent TenzorGrid **Employee ID** (`TG-EMP-{role
  family}-{year}-{sequence}`), looked up at `tenzorgrid.com/verify/{id}`. Full name shown by
  default on the public HR verification page (lookup requires the exact ID, which only
  reaches an employer via the candidate — initials would defeat the page's purpose without
  adding real privacy protection). Deeper content (transcripts, artifacts) stays
  consent-gated. Mandatory disclaimer on every certificate/verification page: this is
  simulated experience, not a record of paid employment.
- **P0 launch role:** Data Analyst, individual-contributor track only, no certificate at
  this stage — prove the experience is good before making it a credential.
- **Added domain skins for Phase 2:** Legal & Paralegal, Manufacturing & Quality (Six
  Sigma/ISO), Executive/Admin Coordination — each reuses existing archetypes, so it's
  content authoring, not new engineering.

**Engineering scoping call (mine, to unblock starting immediately):** deferring live
per-learner tool containers (Tier A: SQL/Python/VS Code sandboxes) — that's a real
container-orchestration infrastructure project Railway doesn't provide out of the box.
First working version instead runs the Data Analyst role's SQL tasks against the app's own
embedded `node:sqlite`, and the AI characters run on the Anthropic wrapper that already
exists at `lib/ai.js` (`ANTHROPIC_API_KEY` is already live in Railway prod — confirmed, no
new integration needed). Revisit real containers once there's a paying cohort to justify
the infra spend. Real payment processing also doesn't exist yet (`/api/subscribe` is still
the Phase 0 dev-mode stub) — Virtual Workspace can be fully built and tested against that
stub; wiring a real gateway for ₹1,999/mo billing is a separate, later prerequisite before
this can actually generate revenue.

**Roadmap (P0 → P3), from the blueprint:**
- **P0 — ✅ SHIPPED (PR #31).** Data model (`sim_enrollments`, `sim_tasks`, `sim_messages`,
  `sim_attendance` — `sim_scores` folded into `sim_tasks.score` for now, split out later if
  the dashboard needs a weekly competency trend), the character engine
  (`lib/workspace.js` — archetype + skin → system prompt → the existing `callClaude()`),
  the task engine, and the Line Manager rubric grader. Ships as a real, working slice:
  Data Analyst is live at `/workspace.html`, flipped from "Soon" to "Live" on both the
  Career Growth grid and the dashboard sidebar. One task (`da-001`, department salary
  breakdown) proves the full loop — enroll → Line Manager assigns → learner submits SQL
  → graded (AI-scored when `ANTHROPIC_API_KEY` is set, deterministic correctness check as
  fallback) → feedback lands in chat → attendance counts toward the 66-day milestone.
  SQL runs against a synthetic in-memory dataset, never the real `tenzorgrid.db`. No
  certificate issuance, no payment gate, no manager track yet — all deliberately P1+.
- **P0.5 — ✅ SHIPPED.** Full UI rebuild. The user rejected the original two-panel
  chat+task layout as too thin for a ₹1,999/mo product ("this is not worth for 1999/-")
  and gave an explicit sidebar-app spec to match, matching a reference SaaS dashboard's
  structure. `/workspace.html` is now a real sidebar app shell with seven tabs — Overview
  (performance stat cards + task-progress bar + recent activity), Projects (the learner's
  one project shown with completed/ongoing task counts and a folder-style file browser of
  submitted work), Tasks (list + detail view, with the SQL editor embedded inline as "the
  respective tool" for SQL tasks), Calendar (a real month grid with attended days
  highlighted), Emails (stakeholder message threads, with reply — grouped/threaded by
  subject), Team (roster cards for Line Manager/People Partner/Business Stakeholder, with
  a real per-person chat for internal roster members — external contacts route to Emails
  instead), and Settings (honest "coming soon" placeholder, per the user's own words).
  Analytics and Documents were explicitly dropped — not required. Team/Emails chat is a
  new, small backend addition (`sendLearnerMessage()` in `lib/workspace.js`, backed by a
  new `sim_messages.thread_archetype` column): the Line Manager replies via `lib/ai.js`
  when a key is configured, other archetypes get an honest canned acknowledgement — same
  "AI upgrades a heuristic, never required" pattern the grader already uses. Verified
  end-to-end with Playwright across all seven tabs before shipping.
- **P0.6 — ✅ SHIPPED.** Premium React redesign of the Overview page. The user called the
  P0.5 UI "very basic" and handed over a full design spec (Linear/Stripe-style "Bento box"
  dashboard: React, Tailwind, Recharts, Framer Motion, Lucide-React). Architecture decision,
  put to the user directly: the rest of TenzorGrid stays zero-npm-dependency vanilla JS on
  purpose, so rather than pulling that stack into the whole app, it's scoped to a new
  `workspace-app/` subproject (its own `package.json`/dependencies) that Vite builds
  straight into `public/workspace.html` + `public/workspace-assets/` — the user chose to
  adopt the full stack rather than fake the look in vanilla CSS. Root `package.json` gained
  one `build` script Railway's Nixpacks runs automatically before `npm start`; confirmed
  live via a real deploy (build ran, server booted clean, no errors). `public/workspace.html`
  is now a gitignored build artifact, not a tracked file.
  Overview is now a real Bento dashboard: animated KPI cards (tasks completed, average-score
  sparkline, attendance, hours assigned), a skill-matrix radar chart, a leaderboard, a
  task-progress list, a recent-activity feed, a weekly goal tracker + summary note, a
  quick-tasks checklist, a suggested learning path, and career milestones — plus a
  redesigned header/sidebar. All other tabs ported to the same component library for visual
  consistency. Every number is real, per the product's standing no-fake-data rule: skill
  matrix comes from a genuine per-axis breakdown the Line Manager's grading call now returns
  (an axis a task doesn't exercise stays `null`, never synthesized); leaderboard is real
  peers only (first name + last initial, no padded fake competitors — a learner training
  alone just sees themselves); career milestones only track metrics actually recorded
  (graded tasks, attendance days), no fabricated skill-leveling system; the header's
  notification badge is a real open-task count. New `sim_tasks.skills_json` and
  `sim_enrollments.checklist_json` columns back the skill matrix and the persisted
  quick-tasks checklist. Caught and fixed two real bugs in Playwright testing before
  shipping: the header toggle knob overlapping its own label, and the radar chart's
  left-axis labels clipping against the card edge.
- **P1 — next:** build out the task library beyond the single `da-001` task (multiple
  tasks per week, a Stakeholder message that changes a requirement mid-task per the
  architecture's non-negotiable design point), weekly 1:1 pacing, and a
  performance-dashboard view of Virtual Workspace progress (the mockup from the blueprint,
  section 7). Still Data Analyst / IC only, still no certificate.
- **P2:** Manager track + team assembly wizard, Salesforce Admin as the second role, 5-6
  more roles from the catalog, the three added domain skins.
- **P3:** Employee ID issuance, certificate PDF, recurring-milestone re-issuance, the public
  HR verification portal, defence-interview flow. Real payment gateway for the ₹1,999/mo
  subscription needs to land before or alongside this — certificates are the thing this
  feature is actually monetizing.

Six modules total in this phase, three are visual upgrades of what exists, three are new
builds:
- Resume Prep — ATS score dial + live rewrite view
- Career Upgrade — Skill Tree (this is where Three.js first gets used)
- Career Transition — drag-slider resume morph
- Auto Apply — job radar + pipeline tracker
- Mock Interviews — voice/avatar version; ships text-only first — also promised as
  "coming soon" on the Career Growth page

## Virtual Workspace — the 12-week career simulation (ACTIVE BUILD)

This is the current line of work and supersedes the older "P1 — next" bullet above. The
user set the destination in their own words:

> "User need to take hands on experience to crack the interview and negotiate for higher
> salary with virtual experience."

That reframes the product. It is not a course with tasks in it; it is a **simulated job** a
learner can talk about in an interview and evidence with an employee ID. The whole build is
judged against one question: *would a hiring manager believe the story this learner tells
about their last twelve weeks?*

### The learner's journey (the user's own 13-point sequence, in order)

1. Sign up → HR configuration (role, level, schedule).
2. **Skill test first** — before any project. The user overruled my proposed ordering here
   and was right: the test is the *baseline* for the skill matrix, so the learner can watch
   their own scores move as they complete work. Without the baseline the matrix has no
   starting point and "you improved" is unprovable.
3. Skill scores map onto the skill matrix → the learner sees where they actually stand.
4. Joining day / welcome from People Ops + Line Manager.
5. Project assigned, with a real project document (Executive Summary / Objectives &
   Deliverables / Resource Stack).
6. The week runs **day by day** — tasks arrive on their day, not as a Monday backlog.
7. Work happens in-app (SQL workbench, Python notebook) against generated practice data.
8. Submissions are **signed off by the manager**, not auto-graded silently.
9. Deadlines are real; missing them is felt through the people waiting on you.
10. Colleagues' work brackets the learner's — someone upstream hands over, someone
    downstream is blocked.
11. Weekly retro / 1:1 with the manager.
12. Twelve weeks of this → performance record, skill-matrix delta, portfolio of work.
13. Interview defence + certificate + employee ID.

### The five decisions the user settled (do not relitigate)

| Question | Their answer |
| --- | --- |
| Difficulty ramp | Yes — a day starts easier and ends harder; Friday is the hardest |
| Where the skill test sits | **Before** the project is assigned; scores seed the skill matrix |
| What junior vs senior changes | **Different projects** — not the same brief written vaguer |
| Weekends | Start from the day they join; count **5 working days** per project. Join on a Thursday → Thursday is the full skill-test day, project lands Friday |
| Where to start | "Go ahead" — build in the order below |

Plus one addition: **"Can we have a 2 min voice meeting?"** — yes. Web Speech API
(`speechSynthesis` + `SpeechRecognition`), zero cost, Chrome/Edge only, so it needs a text
fallback for the ~30% of browsers without `SpeechRecognition`. Placed at the Monday project
kickoff. Explicitly sequenced **after Phase 2** by the user.

### Cost position

Everything here holds at roughly **$4 per learner for the full 12 weeks**, because the
expensive parts are authored or generated deterministically, not called at runtime:

- Practice datasets are **seeded** (`lib/datasets.js`, mulberry32 PRNG), not AI-generated
  per learner. This is the keystone decision: identical data for every learner is what
  makes automatic grading possible at all.
- Project documents are authored content (`lib/projectdocs.js`), not generated.
- AI is used only for the manager's sign-off questions and chat replies, and is capped by
  `DAILY_AI_LIMITS`. Every AI path has a deterministic fallback that produces a real,
  specific result — never a degraded stub.

**The validation gate for any generated content** (apply this to every new dataset/task):
a reference query must run clean, return a non-trivial result, **and the naive wrong answer
must differ from the correct one**. If the obvious mistake produces the same number, the
task teaches nothing and cannot be graded.

### Build phases

- **Phase 0 — ✅ SHIPPED (#51, #52).** The tooling a simulated job actually needs.
  `lib/datasets.js` (seeded `hr_core` and `saas_ops` datasets with *authored quirks*: six
  leavers hiding behind a NULL `exit_year`, Support underpaid against the rest, raw-damage
  and revenue-at-risk rankings that deliberately disagree — these are the traps that make a
  submission worth reviewing); `lib/projectdocs.js` (the three-section project document and
  a tool registry marking each tool `live` or `planned`, so nothing is promised that isn't
  there); the **SQL workbench** (CodeMirror 6 — chosen over Monaco at ~1/10th the weight —
  with a schema browser and a results grid); and the **Python notebook** (Pyodide 0.26.4,
  self-hosted, real CPython 3.12 in WebAssembly, stdlib only).
  Two findings worth keeping: the CSP had to gain `'wasm-unsafe-eval'` or Pyodide throws a
  `CompileError` and then **never settles**, so the symptom is an infinite spinner with no
  error surfaced; and `npx vite build` silently skips `postbuild.js`, so always use
  `npm run build` or you ship a stale bundle against a fresh backend.
- **Phase 1 — ✅ SHIPPED (#54). The verification gate.** A correct answer no longer
  completes a task. Submitting moves it to `in_review`, the score is **withheld**, and Asha
  asks one question about a choice the learner actually made in their own code. Two rounds;
  a reasoned answer signs it off and reveals the score, two vague ones park the task so the
  day can continue. The score is hidden on purpose — telling someone they scored 90 and
  then asking them to justify their work turns the conversation into a formality, which is
  the one thing it must not be. Backed by `sim_tasks.review_state/review_rounds/
  review_question` and `ReviewPanel.jsx`.
- **Phase 2 — ✅ SHIPPED (#55). The week and the deadline.**
  A project is now a **five-working-day week** with a real deadline, not an open-ended
  bag of tasks. New `sim_project_runs` table (start, due, escalation level, completion) and
  `sim_tasks.day_index/opens_at/difficulty`. What it produces: tasks release on their day
  and Asha announces each one exactly once; the deadline is computed in working days from
  the learner's actual join day (weekend starts roll to Monday); missing it brings **two
  escalations and then silence** — Asha at +1 day naming the learner and the outstanding
  work, Vikram at +3 explaining who downstream is stuck (a third identical chase is noise,
  and noise gets ignored); and every project shows its **contributors** — who handed work
  over, and who is *blocked on the learner by name*, which flips to "Picked it up from your
  analysis" the moment they deliver. A finished project is never chased. Existing accounts
  get a week backfilled from their real `assigned_at`, so nobody's clock starts today.
  Green against a 40-check backend suite plus a browser pass.
- **Phase 2 — ✅ SHIPPED (#55).** Frontend included: the active project card carries a
  five-pip week strip with the deadline counted in **working** days (reporting "7 days
  left" beside "day 1 of 5" is the kind of contradiction that makes a learner stop
  trusting every other number), and the contributor list shows who handed over and who is
  next. A colleague who picks the work up on day 5 reads as *queued* on day 1 and only
  turns red once their day arrives or the project is late — a warning that is always on
  is a warning nobody reads. Task cards carry their day and say "Opens Thursday" rather
  than showing a padlock.
- **Phase 3a — ✅ SHIPPED (#56). The skills check.** Twelve authored questions across all
  five axes, scored deterministically with no AI call, taken **before** the first project.
  The matrix now carries `baseline` and `delta` per axis, so "my SQL went from 52 to 84"
  is a sentence backed by two real numbers. An unanswered axis is NULL, never zero. Asha
  hands over the first project herself, naming the strongest and weakest area from the
  actual result. Accounts enrolled earlier are offered the test but never blocked by it.
  One finding worth keeping: the browser test scored 12/12 by clicking the top option
  twelve times, because the answers were all authored first. Answer position now rotates
  evenly, and a test fails if that regresses — **check this on any new question bank.**
- **Phase 4 — ✅ SHIPPED (#57). The two-minute stand-up.** Three questions, spoken by Asha
  through `speechSynthesis` and answered by voice through `SpeechRecognition` or by
  typing. Local, free, no audio leaves the machine. Her questions are built from the
  learner's real state; a raised blocker is answered as a blocker; the learner's own
  words go into the thread verbatim. **Typing is the real path and voice is the upgrade**
  — recognition is Chrome/Edge only, so voice-first would have broken it for roughly a
  third of learners. Excluded from the daily AI cap, since it costs nothing.
- **Phase 3b — ✅ SHIPPED. Junior and senior get different projects.** Not the same brief
  written vaguer — different questions. The senior track (`Platform Reliability Review`,
  `Account Economics Review`) sits on the ops dataset, asks for **rates and distributions
  rather than totals** (time-to-resolve per service, tickets per 100k of MRR, median and
  worst-case hours by severity), and leaves the learner to decide what to exclude, which
  is most of what seniority actually is. `catalogFor(role, level)` is the single place the
  split is decided. Every senior task was put through the validation gate, and **one
  failed it**: the sa-002 trap was decorative until it was rebuilt around the churned
  account. Authoring it also surfaced a real data bug — the generator was resolving
  incidents *before* they started, which made any duration analysis nonsense; fixed
  without changing the random draw sequence, so every other generated value is unchanged.
- **Phase 4b — ✅ SHIPPED. The promotion round.** The user's rule, in their words:
  promote on *"performance AND training done"* — both, not either. Four junior projects
  delivered **and** an average of 70 or above. The two criteria are reported separately
  with real numbers, because "you were not promoted" is a sentence that has to come with
  the arithmetic behind it. Promotion fires by itself at read time (you are told about a
  promotion, you do not claim one), switches the catalogue to the senior track and starts
  the first senior project immediately, and **keeps every junior project on the board** —
  `catalogFor` takes the projects the learner has touched, because a promotion that
  erased the record would delete the very thing they are meant to walk into an interview
  with. Building it found a design hole: a **parked task keeps its project out of
  `completed`**, so a learner who reached the end of the track with parked work would sit
  in silence forever, never told why the review never came. The review now triggers on
  *every junior task resolved* (graded or parked), and Asha names the parked work as the
  one thing they can fix today. Also separated two progression systems that had started
  to contradict each other on the same page: the milestone is now the **certificate**,
  not a competing job title.

### The 12-week shape (the user's arithmetic, confirmed)

**30 tasks per project · 6 per day · 5 days per project · 4 projects per month · promote
after month one.** Three consequences, all of which change what gets built next:

1. **A task must be roughly 20 minutes.** Six a day against `HOURS_PER_DAY_TARGET = 2`.
   The tasks currently in `TASKS` are 2–5 estimated hours each — an order of magnitude
   too big. The unit has to shrink before any authoring starts.
2. **`DAILY_AI_LIMITS.submissions = 6` is exactly six**, with no headroom: one parked
   task retried and the learner is locked out for the day. **Raise it to 8.**
3. **Six tasks a day cannot all be SQL.** The user's answer, when asked: a realistic
   day's mix, *but it must cover every skill the role needs — visualisation, analysis,
   communication, all of it.* So the task engine needs a **type system** — analysis
   (SQL), notebook (Python), **chart** (currently the `dataViz` axis has NO task that
   exercises it — a real hole), **write-up** (an email to a stakeholder), **review**
   (critique a colleague's query), **decision** (make the recommendation). Not everything
   needs a reference query, which is also what makes 360 tasks authorable at all.

- **Phase 5a — ✅ SHIPPED. Chart tasks, and the daily cap raised.** `dataViz` had been an
  axis on the skill matrix since the beginning with **no task that could ever move it** —
  worse than not having the axis, because it reported a permanent zero on a skill the
  learner was never given a chance to show. A chart task hands over the rows already
  queried and grades the *presentation*: chart type, both axes, ordering, and whether the
  value axis starts at zero. Deterministic, no AI call, so it can run as often as the week
  needs. Two of them are authored as a **pair that punishes pattern-matching**: da-006 is
  categories (bar, sorted by value, zero baseline); da-007 is a time series, where
  repeating that answer scores 35 instead of 100. `DAILY_AI_LIMITS.submissions` raised
  6 → 8, since six tasks a day against a cap of exactly six left no room to resubmit a
  parked task.
  Two things this build surfaced: the offline review judge rejected a genuinely good
  chart answer because its reasoning markers were tuned to SQL prose, and it told the
  learner their answer described "the code" on a task that has none. And a browser
  assertion that only checked `.recharts-surface` exists passed against an empty chart —
  it now asserts on bar geometry, and proves the lesson: at a zero baseline the
  biggest:smallest bar ratio is **2.8x**, truncated it is **28.6x**.
  *Note for future browser tests:* a `fullPage` screenshot resizes the viewport, which
  makes `ResponsiveContainer` re-render and Recharts replay its entry animation from zero
  — so a fullPage capture of a fresh chart photographs an empty one. Scope the capture to
  the element.

- **Phase 5b — ✅ SHIPPED. A real day, and the last two task types.** The user tested it
  live and hit the gap exactly: *"i completed the 1st task in 10min what should i do rest
  of the hours?"* — day one had one task on it. It now has **six, totalling ~1.45 hours**,
  and only two are queries: scope the request → get your bearings in the data → the
  analysis → **review Rahul's query** → what can you actually claim? → **write to Vikram**.
  Two new graders in `lib/tasktypes.js`, both deterministic:
  - **`choice`** — a structured judgement over an exhibit (a colleague's query, a
    stakeholder's email). Scored on what was picked *and what was left*: **ticking every
    box scores zero**, because "flag everything" is not review, it is noise, and a grader
    that rewarded it would teach the wrong habit. The UI says so before they answer.
  - **`writeup`** — a real email composer with the recipient, subject and word budget
    shown, graded against an authored rubric. Going over the word limit costs marks and
    is named as the reason.
  **Every task estimate was re-cut**: they were whole hours, written when a project was a
  single task and the number was decorative. Day one added up to 4 hours before, 18 if
  scaled to six tasks. All five matrix axes are now reachable by some task.
  Two accounting bugs this surfaced: the daily submission cap was counting **task types
  that make no AI call** (a chart and a judgement are graded deterministically), so a
  learner doing the intended six-task day could be locked out by work that cost nothing —
  only `sql` and `python` count now. And Asha's overdue chase read *"7 tasks still isn't
  signed off"*, a template written when the only substitution was one named task.
  Test debt paid off too: four suites broke every time a project gained a task, because
  each knew how to answer `da-001` and nothing else. `scratchpad/answers.js` is now the
  one place a correct answer for any task lives.

- **Phase 5c — next. The rest of the week, then the arc.** Day 1 of one project is
  authored; **days 2–5 are still nearly empty** (day 2 has one chart task, days 4 and 5
  have nothing at all, so no learner has ever seen a Friday). The pattern is proven and
  the shape is right — what remains is authoring, at roughly 30 tasks per project, against
  the validation gate. Then the weekly retro/1:1, the performance record, and the
  interview defence.

**The real gate on all of this is content, not code.** The machinery for a week can be
built and tested against the five tasks that exist today; authoring the ~30-task arc is a
separate job and is what actually stands between here and a shippable twelve weeks.

### Open items on this build

- **The database still has no backup anywhere.** `lib/backup.js` is written and tested
  (`VACUUM INTO` snapshot → gzip, ~27x → Supabase `db_backups` bucket, keep 6) but sits
  unmerged on branch `claude/tenzorgrid-project-transfer-0cm81z` along with `/api/health`,
  photos-to-disk, template character replies and the AI-escalation budget. Railway's HOBBY
  plan reports `maxBackupsCount: 0`, so there is no platform fallback. **Merge this.**
- Character memory (`eae3fdb`) is held on cost grounds — the user wants an alternative
  costed first.
- Deferred by the user, don't start unprompted: Settings tab, storage migration to
  Postgres, pandas in the notebook, 3D KPI icons, calendar meetings.

## Phase 2 — Business Growth pillar — NOT STARTED
## Phase 3 — Smart Trading pillar — NOT STARTED (paper-trading only until compliance review)
## Phase 4 — Custom AI Solutions pillar — NOT STARTED (mostly a B2B sales motion, lighter build)

## Next immediate step

**Now: finish Phase 2 of the Virtual Workspace 12-week build (see that section above), then
Phase 3, 4 and 5 in order.** The user is not asking for further unprompted UI refinement —
the refinement notes below are history, kept because they record decisions worth not
relitigating. Also outstanding and independent of all of it: **merge the backup branch**, the
database has no backup anywhere.

### Earlier state (history)

Virtual Workspace P0, P0.5, and the P0.6 React redesign are shipped and live — Data Analyst
is a real, working role at `/workspace.html`, presented as a premium Bento-box React app
(Overview / Projects / Tasks / Calendar / Emails / Team / Settings), no longer "Soon"
anywhere in the app. Since P0.6 shipped: sidebar/KPI/section icons and avatars were sized
up twice more (user feedback both times — "icons look too small") and every card's text
was bumped off a too-small baseline for legibility at desktop width — all shipped and live.
`lib/workspace.js` and the `sim_*` tables in `lib/db.js` are the backend to read first, not
something to rebuild; the frontend lives in `workspace-app/` (React/Vite/Tailwind/
Recharts/Framer Motion — its own subproject, own `package.json`) and builds into
`public/workspace.html` + `public/workspace-assets/`, which are gitignored generated
artifacts, not tracked files — after any backend change, `cd workspace-app && npm run build`
(or root `npm run build`) regenerates them before testing locally.

**Overview page, second refinement pass (shipped):** the Tasks-completed progress ring was
realigned into the KPI icon row; "Average score" became a **Performance Score** card (big %,
`Avg Grade` sub-line, and a real `+X% today` delta computed by comparing the running average
with today's grades against the average before today's grades landed — no fabricated number);
the **Leaderboard was removed entirely** (card + `getLeaderboard`/`displayName` backend), on
the reasoning that peer ranking demotivates everyone not near the top; and two
engagement/sentiment cards were added in its place — **"Your momentum"** (consecutive
check-in-day streak + longest streak + personal-best score, all from existing
`sim_attendance`/`sim_tasks` rows) and **"Manager shoutouts"** (Asha's real grading feedback
on tasks that scored >= 80). All of it reads off data already stored; nothing is synthesized.

**Hours / AI-cost decision (decision 9 below):** the old flat "8 hours assigned" daily target
was unrealistic for a self-paced product and, more importantly, was the wrong lever for cost
control — hours are just a scheduling expectation, whereas the actual AI spend comes from
grading calls and chat/email replies. So the card became **"Open workload"** (open hours
remaining, with a `≈N days at 2h/day` pace estimate against `HOURS_PER_DAY_TARGET = 2`), and
cost is now genuinely capped by `DAILY_AI_LIMITS` in `lib/workspace.js` — 6 graded submissions
and 20 learner messages per enrollment per day, enforced in `submitTask`/`sendLearnerMessage`
with a friendly "come back tomorrow" error. Counted from existing rows via `countTodaysAiUse`,
so no schema change was needed. Revisit those two numbers if real usage or AI pricing shifts.

**Projects tab, full rebuild (shipped):** the placeholder Projects tab (one card + a file
list) became a real, premium three-section page built to a user-supplied design spec. The
backend gained a **`PROJECT_CATALOG`** in `lib/workspace.js` — authored curriculum, exactly
like `TASKS`/`MILESTONE`, where `impactValue` is the value a simulated project *represents*,
never a claim about the learner — plus `getProjects()`, which derives every displayed number
from the learner's own `sim_tasks` rows. Four real states: `active` (tasks assigned),
`completed` (all its tasks graded), `available` (unlock gate cleared), `locked` (not yet).
`unlockAfter` is a genuine gate enforced server-side in `startProject()`, not just hidden in
the UI. Two new tasks (`da-002` hiring trend, `da-003` pay spread) were added so `available`
and `locked` are reachable states rather than decoration; both query the same `employees`
practice table — **project titles must stay inside that dataset**, since a brief promising a
churn or inventory table would be one no learner could actually complete. Derived metrics:
skill points (`score / 20`, so a perfect task = 5.0 on an axis), grade letters from real
averages, total impact summed over *completed* projects only, and 4 achievement badges with
real earn conditions. Frontend is `Projects.jsx` + `projectCards.jsx` (4 card components) +
`SkillPointsBar` in `charts.jsx`; the three filter dropdowns genuinely filter, and their
options are built from the catalog so they can never offer a choice matching nothing.

Note on that build: the design spec's sample numbers (`+$12,400`, `$85,000`, `Skill Points: 15`,
`Energy: 85%`) were mockup filler, and per decision 3 none of them were hardcoded — every one
is computed or, where there's no data source (the "Energy" pill), left out and flagged to the
user. The spec's per-bar rainbow on the skill chart was also deliberately not followed: one
measure across categories is a single series, so all bars share one hue — colouring by rank
encodes nothing. Same reasoning for the spec's sidebar/header, which already existed as
shared components and were left alone rather than duplicated per-tab.

**Tasks tab, full rebuild (shipped):** the two-pane task list became a premium board built
to a user-supplied design spec, **without losing the submission workspace** — that flow is
the core loop of the product and is preserved intact inside the new page. Tasks gained real
`priority` and `due_at` columns (both via `ensureColumn`, so the live Railway volume
migrates safely); deadlines are set in `assignTask()` from the catalog's `dueInDays`, which
is what makes "due today", "overdue" and the on-time rate genuinely computable. New
`getTasksView()` derives: per-task stage, due labels, overdue flags, a task-health split, a
turnaround chart (real minutes from assigned to graded, per priority), an on-time delivery
rate with a running trend, and the locked tasks sitting behind unstarted project gates.

Three spec departures worth remembering, all deliberate:
1. **No "Mark Complete" button.** A task here is completed by submitting work and being
   graded. A button that just flipped a flag would let learners skip the work and would
   make every downstream number (scores, skill points, project completion) meaningless.
   The card action is "Open task" -> the submission workspace instead.
2. **No progress percentage per task.** There are no sub-steps to measure, so the bar
   reports the real stage (Assigned -> Submitted -> Graded). A "70% done" would be invented.
3. **No "Top Contributor" leaderboard.** The user removed leaderboards from Overview one
   iteration earlier (decision above), and the only other "contributors" here are simulated
   characters — ranking them against the learner would be fabrication. That slot became
   **"Task owners"**: real counts of who assigned and who graded, no ranking.

Turnaround is stored in minutes and the chart picks minutes-or-hours, because a fast
submission would otherwise round to a meaningless "0h" bar with no height.

**Deadlines for pre-migration rows (fix, shipped):** health and on-time were initially
computed only for tasks carrying a stored deadline, which left both cards permanently empty
for every account enrolled before `due_at` shipped — the user hit exactly this. Deadlines
are now reconstructed at read time from `assigned_at + dueInDays` when the column is null.
That is a reconstruction, not a back-date: `dueInDays` is a fixed property of the task
definition and `assigned_at` is a real timestamp, so the derived value equals what would
have been stored had the column existed. Nothing is written back, so it self-heals.

**Productivity score (shipped):** replaced the "On-time delivery" card. Deliberately a
*blend* rather than a restatement of grade quality, since Overview's Performance Score
already reports that alone — Quality 50% (average grade), Timeliness 30% (share of
deliveries meeting their deadline), Consistency 20% (check-ins across the last 14 days,
suppressed until 3 days have elapsed since there isn't enough history before that to call
something a habit). A component with no data is **excluded and the remaining weights
renormalised**, never counted as a zero, so a learner is not marked down for a signal they
have not had the chance to produce; with nothing at all the score is `null`, not 0. The
card shows the weighted breakdown so the number is always explainable. The trend line is
*replayed* — each point recomputes the score from only the tasks and check-ins that existed
at that moment — so it is real history without storing daily snapshots.

**Emails tab, unified inbox (shipped):** rebuilt as a Gmail-style split pane over the
learner's **real** `sim_messages` rows. The spec asked for "mock email data structured by
role category" — that was not built, since the messages a learner has actually received
are real records and hardcoding invented ones would be exactly the fabrication decision 3
forbids. `sim_messages` gained `read_at` and `starred` (via `ensureColumn`), which makes
Inbox / Unread / Starred counts and the sidebar's red badge real rather than mockup
numbers. `getInbox()` groups messages into threads by archetype + normalised subject;
read/starred are stored per message but presented per thread, which is how a mail client
actually behaves. `markMessages()` is scoped to the caller's own enrollment and validates
id shape, so a crafted request cannot touch another learner's mail.

Category tabs are **generated from categories that actually have mail** — the spec listed
Customer, My Team, Project Team, Coworkers and Promo, none of which have a sending
archetype yet, and a permanently-empty folder is worse than no folder. `MAIL_CATEGORY` maps
archetype -> label/tone, so those tabs appear automatically the first time such an archetype
sends something (customer/client archetypes are already on the roadmap). Drafts are
localStorage-backed, which is genuinely what an unsent draft is here — nothing has been
sent, so there is no server record to show. Forward and "Mark as handled" were not built:
there is no recipient beyond the three characters to forward to, and "handled" would just
duplicate read state.

Note the overlap this creates: Emails now covers all three archetypes, while the Team tab
still offers per-person chat over the same rows. That mirrors real workplaces (Slack and
email both exist) but is worth revisiting if the user wants Team slimmed to a directory.

**Calendar tab, rebuild (shipped):** month grid + day agenda, driven by real dated records.
`getCalendar()` emits events only from things that actually happened — task assigned, task
due (reconstructed for pre-migration rows the same way the Tasks tab does), task graded,
and messages received. **No meetings were invented.** The spec asked for "Churn Model
Review, 9:30 AM, [Join Meeting]" — there is no meeting or video-call model in this product,
so that card would have been fiction behind a dead button. If scheduled meetings are wanted
they need building for real (the character engine could generate them).

Two user-specified requirements, both real:
1. **Regional holidays.** `workspace-app/src/lib/holidays.js` detects region from the
   browser's IANA timezone (Asia/Kolkata -> IN, Europe/London -> GB, US zones -> US), with a
   manual override persisted in localStorage. Deliberately conservative: **fixed-date and
   exactly-rule-defined national holidays only** (e.g. "4th Thursday in November", plus a
   Meeus/Jones/Butcher Easter computation for UK Good Friday/Easter Monday). Lunar-calendar
   dates (Diwali, Eid, Holi) and state-level holidays are NOT guessed — a wrong date on a
   learner's calendar is worse than none. An unrecognised timezone resolves to **no** holiday
   calendar with a visible note, never silently to one country's holidays.
2. **Pre-joining days blocked.** Days before `enrollment.created_at` are disabled, padlocked
   and unclickable; the joining day is marked with a star and its own indigo cell.

Attendance verdicts are derived, not stored: Present = a real `sim_attendance` row; Absent =
a past working day, after joining, not a weekend/holiday, with no row. A learner is never
marked Absent before joining, in the future, or **on the joining day itself** — enrolling is
not something you can miss. "Not checked in yet" only nudges on a day they were actually
expected to work. Day keys are UTC throughout, matching how `attended_on` is already stored,
so a cell can never disagree with its own attendance mark.

Note: date-fns was specified but not added — the month maths is ~15 lines of native `Date`
and the bundle is already over Vite's 500 kB warning threshold.

**Team tab, rebuild (shipped):** profile pane + member grid + analytics, over the three
real characters. The spec's "Sarah J." and "David K." were **not** added — inventing
colleagues who do not exist in the simulation would be fabrication, and the mockup listed
David K. twice anyway. `getTeam()` returns, per character: the projects they actually own
(from `PROJECT_CATALOG.stakeholder`, with live status), real message counts / unread / last
contact, and whether they grade (only the Line Manager does — a load-bearing rule of the
character engine, which is why "Ask for a review" appears for Asha alone).

Two things the spec wanted that had no honest source, reworked rather than faked:
1. **Per-member skill radar.** These are archetypes, not assessed employees; no competency
   data exists. Instead the panel shows **the skill mix their projects demand**, which is
   real catalog content and more useful ("working with Asha means SQL + Data Viz"). Rendered
   as bars, not the specified radar: a person owns one or two projects, so only two or three
   of five axes are ever non-zero and the radar collapsed into a sliver that read as broken.
2. **Online/Offline presence.** There is no presence system, and these characters reply on
   demand. The dot now reports something real — whether a reply can actually be had right
   now, given the remaining daily AI message allowance (`DAILY_AI_LIMITS.messages`). When
   the cap is hit it reads "Daily message limit reached" and the send buttons disable.

"Team Skill Average" became **"Your skill levels"** (real `skillMatrix` gauges) — a team
average would require inventing competency numbers for the cast. The action buttons send
real messages through the same API as Emails, each with its own intent line, rather than
being decorative. Note the Emails/Team overlap remains: Emails is the unified inbox, Team is
the people view; both read the same `sim_messages` rows.

**Deferred, waiting on the user:** sourcing premium 3D icons for the Overview KPI cards (they
still use plain Lucide icons in colored badges — see decision 8 above, this is the case that
prompted that rule). The user paused this ("okk icon i will give later") and will supply icons
directly; don't restart Drive/Figma sourcing unprompted. Context if it resumes: figma.com is
blocked at this sandbox's network egress layer (confirmed — don't retry direct Figma downloads
or curl figma.com), `mcp__Google_Drive__download_file_content` works but fails above ~8MB
despite a documented 10MB cap, and team-character avatars are already done and are the pattern
to follow (`lib/avatars.js` + `public/assets/avatars/`, self-hosted, deterministic per-character
picking). Any previously downloaded icon zips lived only in a session scratchpad and are gone.

The user also said UI refinement is ongoing/iterative ("we will bring all the cases here"
one at a time) — don't start further unprompted UI work beyond what's already mid-flight
above; wait for the next specific ask. See Phase 1 above for the full P1/P2/P3 roadmap once
the user is ready to move past refinement.
