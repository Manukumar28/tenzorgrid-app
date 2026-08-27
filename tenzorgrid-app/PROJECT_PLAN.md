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
- **P0 (starting now):** data model (`sim_enrollments`, `sim_tasks`, `sim_messages`,
  `sim_scores`, `sim_attendance`), the character engine (archetype + skin + instance →
  system prompt → `callClaude()`), the task engine, and the Line Manager rubric grader.
- **P1:** Data Analyst, IC track, full weekly loop (task → chat → submission → grading →
  dashboard), attendance tracking. No certificate issuance yet.
- **P2:** Manager track + team assembly wizard, Salesforce Admin as the second role, 5-6
  more roles from the catalog, the three added domain skins.
- **P3:** Employee ID issuance, certificate PDF, recurring-milestone re-issuance, the public
  HR verification portal, defence-interview flow.

Six modules total in this phase, three are visual upgrades of what exists, three are new
builds:
- Resume Prep — ATS score dial + live rewrite view
- Career Upgrade — Skill Tree (this is where Three.js first gets used)
- Career Transition — drag-slider resume morph
- Auto Apply — job radar + pipeline tracker
- Mock Interviews — voice/avatar version; ships text-only first — also promised as
  "coming soon" on the Career Growth page

## Phase 2 — Business Growth pillar — NOT STARTED
## Phase 3 — Smart Trading pillar — NOT STARTED (paper-trading only until compliance review)
## Phase 4 — Custom AI Solutions pillar — NOT STARTED (mostly a B2B sales motion, lighter build)

## Next immediate step

Virtual Workspace engineering has started (P0: data model, character engine, task engine,
rubric grader — see Phase 1 above for the full decision log). If resuming this after a
context reset, re-read this file's Phase 1 section first, then check `lib/` for whatever
P0 modules already exist (`sim_*` tables, a character/task engine file) before assuming
nothing has been built yet.
