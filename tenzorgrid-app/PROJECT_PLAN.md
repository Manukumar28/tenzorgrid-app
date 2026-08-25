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

## Phase 1 — Complete the Career Growth pillar — NOT STARTED

From the original roadmap, six modules, three are visual upgrades of what exists, three
are new builds:
- Resume Prep — ATS score dial + live rewrite view
- Career Upgrade — Skill Tree (this is where Three.js first gets used)
- Career Transition — drag-slider resume morph
- Auto Apply — job radar + pipeline tracker
- Virtual Workspace — deferred within Phase 1 too (heaviest build, daily AI-manager
  loop) — now also promised on the Career Growth page as "coming soon," so there's
  user-facing expectation once Phase 1 starts
- Mock Interviews — voice/avatar version; ships text-only first — also promised as
  "coming soon" on the Career Growth page

## Phase 2 — Business Growth pillar — NOT STARTED
## Phase 3 — Smart Trading pillar — NOT STARTED (paper-trading only until compliance review)
## Phase 4 — Custom AI Solutions pillar — NOT STARTED (mostly a B2B sales motion, lighter build)

## Next immediate step

Ask the user: start Phase 1 (Career Growth pillar completion), or address one of the
open items (missing nav links, SEO/gitignore cleanup) first?
