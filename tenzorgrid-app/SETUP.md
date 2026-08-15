# TenzorGrid — Setup & Go-Live Guide

This is the real, working first slice of TenzorGrid: account signup/login, the onboarding
questionnaire with CV upload, and a profile dashboard that shows real matching jobs computed
from your actual skills. It is a plain Node.js application with **no external dependencies to
install** — it uses Node's own built-in web server and built-in database (SQLite), so there is
nothing to `npm install` and nothing that can go out of date or break from a package update.

That also means there's no framework "magic" to learn — it's about 700 lines of plain,
readable JavaScript across a handful of files, which should make it easier for any developer
you bring on later to understand quickly.

## Updating your already-live app with this new version

Your app is already live on Railway, connected to your `tenzorgrid-app` GitHub repository —
this zip is an update, not a first deploy. Claude does not currently have permission to push
directly to your GitHub repo from this session (even though you connected a GitHub
integration, no working GitHub write-access tool showed up here — this looks like a gap on
the tooling side, not something you did wrong), so the fastest way to get these changes live is:

1. Unzip this file on your computer.
2. Go to your repository on github.com (`Manukumar28/tenzorgrid-app`), open the
   `tenzorgrid-app` folder inside it, and delete the old files (select all → Delete files),
   or just drag-and-drop the new unzipped files in — GitHub will ask to overwrite/replace,
   confirm yes for each. Commit the change.
3. Railway is already watching that repo/branch, so it will automatically start a new
   deployment within a few seconds. Watch the Deployments tab until it shows "Success," then
   open your live URL and try it.

Existing signed-up users, their profiles, and uploaded CVs are untouched by this update —
they live on the persistent Volume, not in the code.

## What's real vs. what's still ahead

Real and working right now: account creation (with date of birth, gender, and profession),
login, a multi-pillar landing page (Career Growth live, Entrepreneur/Pillar 3/4/5 marked
"coming soon"), a dedicated Career Growth explainer page, onboarding with CV upload that
auto-fills your name/role/experience/skills (salary is always manual), a skills
autosuggestion field, a profile dashboard with a profile photo, an insights panel (market
value estimate, upskill target, best-fit jobs), real user-managed experience cards, and job
matching (a transparent skill-overlap score against a small starter set of jobs — not yet
pulling live listings from real job portals). The dashboard shows your top 2–3 matches;
seeing the full list routes to a subscription page that lists what's included — there's no
payment gateway wired up yet, by design, until that's the next thing to build.

Not built yet: the entire Auto Apply / Career Upgrade / Career Transition / Resume Builder /
Interview Prep subscriber area (that's Phase 2, and Auto Apply specifically still needs the
feasibility research we discussed before any of it gets built), and the actual payment
gateway behind the subscription page.

### Optional: turning on real AI (CV parsing + insights)

CV parsing and the dashboard's insights panel work out of the box using a transparent,
rule-based approach — no setup needed. If you want to upgrade them to use real AI (Claude)
for better accuracy, get an API key from console.anthropic.com and add it as an environment
variable named `ANTHROPIC_API_KEY` in Railway's Variables tab for this service, then redeploy.
The app automatically detects the key and switches over — nothing else to configure, and
nothing breaks if you never add one.

## Running it on your own computer first (optional but reassuring)

1. Install Node.js version 22.5 or newer from nodejs.org if you don't already have it.
2. Open a terminal in this folder and run: `npm start`
3. Open `http://localhost:3000` in your browser. Sign up, upload a test CV, fill in the
   onboarding form, and you should land on a dashboard with your real info and a list of
   ranked matching jobs.
4. Stop it any time with Ctrl+C. Your test data lives in a file at `data/tenzorgrid.db` —
   delete that file (and anything in `data/uploads`) if you want to start over clean.

## Putting it live on the internet

This app needs to run as a small always-on server with a persistent disk (somewhere the
SQLite database file and uploaded CVs won't disappear between visits or restarts) — that
rules out purely "serverless" hosts like plain Vercel. I'd recommend **Railway**
(railway.app) — it's the simplest path for this shape of app and has a small free usage
allowance to start, then moves to a low usage-based cost (typically a few dollars a month for
an app this size) once you're past the trial. Render.com and Fly.io work the same way if you'd
rather compare.

Steps, in plain terms:

1. **Put the code on GitHub.** Create a free GitHub account if you don't have one
   (github.com), create a new repository (name it `tenzorgrid-app` or similar), and upload
   this folder to it. If you're not comfortable with `git` commands, GitHub's website lets you
   drag-and-drop files directly into a new repository.
2. **Create a Railway account** at railway.app and sign in with your GitHub account.
3. **New Project → Deploy from GitHub repo**, and pick the repository you just created.
   Railway will detect it's a Node.js app automatically.
4. **Add a Volume** (Railway calls it that) in the project settings, and mount it at
   `/data`. This is the persistent disk — without this step, every time you redeploy the app,
   all signed-up users and uploaded CVs would be wiped.
5. **Add an environment variable**: `DATA_DIR` = `/data` (this tells the app to store its
   database and uploaded files on that persistent volume instead of the temporary local
   folder).
6. Deploy. Railway will give you a public URL like `tenzorgrid-app-production.up.railway.app`.
   Open it, sign up for a real account, and confirm everything works the same way it did
   locally.
7. **Custom domain (optional, later):** once you've registered `tenzorgrid.com` (or whatever
   you land on) with a domain registrar, Railway's settings let you point it at your app in a
   few clicks — happy to walk through that step when you're ready for it.

I can't create these accounts on your behalf, but once you've got a Railway (or Render/Fly)
account and a GitHub account, tell me and I'll walk through the exact clicks with you, or if
you connect your computer to this session I can help push the code directly.

## Before this handles real users' data

A few things worth doing before treating this as production-ready with real people's personal
information (name, salary, CV): put the app behind HTTPS (Railway/Render do this
automatically), add rate-limiting on the login/signup endpoints to slow down brute-force
attempts, add a "forgot password" flow (there isn't one yet — currently a lost password means
losing access to that account), and review India's data-protection obligations (the DPDP Act)
for what consent language and data-handling practices you're required to have given you're
storing resumes and salary data. I'm not a lawyer and this isn't legal advice — flagging it so
it doesn't get missed.

## Project structure

```
server.js          — the HTTP server: routing, API endpoints, static file serving
lib/db.js          — SQLite setup, schema, seed jobs
lib/auth.js        — password hashing, sessions, cookies
lib/profile.js     — profile save/load, CV file handling, job matching logic
public/            — every page the browser loads (plain HTML/CSS/JS, no build step)
data/              — the SQLite database file and uploaded CVs (created automatically)
```
