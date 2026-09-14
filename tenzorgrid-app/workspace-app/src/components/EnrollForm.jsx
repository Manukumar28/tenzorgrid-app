import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, ChevronLeft, Lock, Check, ArrowRight, Bell, X,
  CalendarDays, Layers, TrendingUp, Wrench, Building2, UserRound,
} from 'lucide-react';
import { api } from '../api.js';

// The enrolment screen.
//
// It used to ask three questions — level, schedule, go — and tell the learner nothing
// about what they were joining. Two of those three controls did not work: the level
// dropdown offered two of four levels (and the server silently downgraded anything else),
// and the schedule was written to the database and never read again.
//
// So this does two jobs. On the right it picks a role out of a 153-role catalogue, which
// means category, function, role and then the level ladder that role actually has. On the
// left it says what the job is — the company, the manager, the rungs and their real bars,
// what a week contains, and which tools exist. Every figure on the left comes from the
// server's measurement of the authored content, never from a number typed into this file,
// because a screen that quotes a week that differs from the week you get is worse than a
// screen that says nothing.

const SCHEDULES = [
  { key: 'weekdays', label: 'Weekdays (Mon–Fri)', available: true },
  { key: 'weekends', label: 'Weekends', available: false },
  { key: 'custom', label: 'Custom days', available: false },
];

function Stat({ icon: Icon, value, label }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon size={15} className="text-indigo-500 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <div className="text-sm font-bold text-gray-900 leading-tight">{value}</div>
        <div className="text-[11px] text-gray-500 leading-tight">{label}</div>
      </div>
    </div>
  );
}

// The left pane. With nothing picked it explains the product; with a live role picked it
// describes that role's actual track.
function PitchHeader({ detail, totalRoles, liveRoles }) {
  return (
    <div>
      <div className="text-[11px] font-bold tracking-[0.14em] uppercase text-indigo-600 mb-2">
        TenzorGrid · Virtual Workspace
      </div>
      <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 leading-[1.1]">
        A simulated job, not a course.
      </h1>
      <p className="text-sm text-gray-600 mt-3 max-w-md">
        Real projects with real deadlines, colleagues who hand work over and wait on yours,
        and a line manager who signs off every submission — so you finish with something you
        can actually talk about in an interview.
      </p>

      {!detail && (
        <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
          <div className="text-sm font-bold text-gray-900">{totalRoles} roles catalogued</div>
          <p className="text-xs text-gray-500 mt-1.5">
            {liveRoles === 1 ? 'One is open today' : `${liveRoles} are open today`} — the rest are
            being built. Pick any of them and we will tell you when yours opens.
          </p>
        </div>
      )}
    </div>
  );
}

// The cards that describe the role actually selected. Every figure comes from the server's
// measurement of the authored content.
function PitchDetail({ detail, level }) {
  const lvl = detail && detail.levels.find((l) => l.key === level);
  if (!detail) return null;
  return (
    <div>
      {detail && (
        <motion.div
          key={detail.key + level}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="space-y-4"
        >
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex items-start gap-2.5 mb-3">
              <Building2 size={15} className="text-indigo-500 mt-0.5 shrink-0" />
              <p className="text-xs text-gray-600">{detail.company}</p>
            </div>
            <div className="flex items-center gap-2.5 pt-3 border-t border-gray-100">
              <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 grid place-items-center text-xs font-bold shrink-0">
                {detail.manager.name.split(' ').map((n) => n[0]).join('')}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-gray-900">{detail.manager.name}</div>
                <div className="text-[11px] text-gray-500">
                  {detail.manager.title} — the only person who grades your work
                </div>
              </div>
            </div>
          </div>

          {lvl && lvl.firstProject && (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-5">
              <div className="text-[10px] font-bold tracking-wider uppercase text-indigo-600 mb-1.5">
                Your first project
              </div>
              <div className="text-sm font-bold text-gray-900">{lvl.firstProject}</div>
              {lvl.firstProjectBlurb && (
                <p className="text-xs text-gray-600 mt-1.5">{lvl.firstProjectBlurb}</p>
              )}
              <p className="text-[11px] text-gray-500 mt-3 pt-3 border-t border-indigo-100">
                Day one is a 15-minute skills check, not a task — it sets the baseline your
                skill matrix is measured against.
              </p>
            </div>
          )}

          {detail.week && (
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="text-[10px] font-bold tracking-wider uppercase text-gray-400 mb-3">
                What a week is
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3.5">
                <Stat icon={CalendarDays} value={`${detail.week.days} working days`} label="one project, one week" />
                <Stat icon={Layers} value={`${detail.week.tasks} tasks`} label={`about ${detail.week.hoursPerDay} hours a day`} />
                <Stat icon={Layers} value={`${detail.week.activities} activities`} label="reading and training" />
                <Stat icon={Layers} value={`${detail.week.situations} situations`} label="inbound — not all deserve a reply" />
              </div>
            </div>
          )}

          {detail.ladder && detail.ladder.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp size={14} className="text-indigo-500" />
                <div className="text-[10px] font-bold tracking-wider uppercase text-gray-400">
                  The ladder
                </div>
              </div>
              <div className="space-y-2">
                {detail.ladder.map((r) => (
                  <div key={r.to} className="flex items-baseline justify-between gap-3 text-xs">
                    <span className="text-gray-700 font-semibold truncate">{r.to}</span>
                    <span className="text-gray-400 shrink-0 tabular-nums">
                      {r.minAverage} avg · {detail.projectsRequired} projects
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-gray-500 mt-3 pt-3 border-t border-gray-100">
                Promotion needs both: the average <em>and</em> the projects finished. Your
                manager opens the conversation a project before she decides.
              </p>
            </div>
          )}

          {detail.tools && detail.tools.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="flex items-center gap-2 mb-3">
                <Wrench size={14} className="text-indigo-500" />
                <div className="text-[10px] font-bold tracking-wider uppercase text-gray-400">
                  Tools you get
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {detail.tools.map((t) => (
                  <span key={t.label} className="text-[11px] font-semibold text-gray-600 bg-gray-100 rounded-md px-2 py-1">
                    {t.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}

// The "we're building this" modal. It is also the only demand signal we have about which
// role to author next, which is why it asks rather than just apologising.
function ComingSoon({ role, alreadyAsked, onAsk, onClose }) {
  const [asked, setAsked] = useState(alreadyAsked);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function ask() {
    setBusy(true);
    setErr('');
    try {
      await onAsk(role.key);
      setAsked(true);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-gray-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
         onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} aria-label="Close"
                className="absolute top-4 right-4 text-gray-300 hover:text-gray-500">
          <X size={18} />
        </button>

        <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 grid place-items-center mb-4">
          <Wrench size={18} />
        </div>
        <h3 className="text-base font-extrabold text-gray-900">{role.label}</h3>
        <p className="text-sm text-gray-500 mt-1.5">
          We are working on this one — it is not open yet. Building a role properly means a
          dataset, four projects and a hundred and twenty graded tasks, so we open them one
          at a time rather than half-finished.
        </p>
        {role.note && (
          <p className="text-xs text-gray-400 mt-3 border-l-2 border-gray-100 pl-3">{role.note}</p>
        )}

        {err && <div className="text-red-500 text-xs mt-4">{err}</div>}

        <div className="mt-5">
          {asked ? (
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-600 bg-emerald-50 rounded-lg px-4 py-2.5">
              <Check size={15} /> You are on the list for this one.
            </div>
          ) : (
            <button
              onClick={ask}
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-800 text-white font-semibold text-sm rounded-lg py-2.5 transition-colors disabled:opacity-60"
            >
              <Bell size={15} /> {busy ? 'Adding you…' : 'Tell me when it opens'}
            </button>
          )}
        </div>
        <p className="text-[11px] text-gray-400 mt-3 text-center">
          We build the roles most people ask for first.
        </p>
      </motion.div>
    </div>
  );
}

function RoleButton({ role, selected, onClick }) {
  const live = role.status === 'live';
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-lg border px-3.5 py-2.5 transition-colors ${
        selected
          ? 'border-indigo-500 bg-indigo-50'
          : live
            ? 'border-gray-200 bg-white hover:border-indigo-300'
            : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={`text-sm font-semibold truncate ${live ? 'text-gray-900' : 'text-gray-500'}`}>
          {role.label}
        </span>
        {live ? (
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-emerald-600 bg-emerald-50 rounded px-1.5 py-0.5">
            Open
          </span>
        ) : (
          <Lock size={12} className="shrink-0 text-gray-300" />
        )}
      </div>
    </button>
  );
}

export default function EnrollForm({ onEnrolled }) {
  const [catalogue, setCatalogue] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [category, setCategory] = useState(null);
  const [query, setQuery] = useState('');
  const [roleKey, setRoleKey] = useState(null);
  const [level, setLevel] = useState('junior');
  const [scheduleType, setScheduleType] = useState('weekdays');
  const [comingSoon, setComingSoon] = useState(null);
  const [interested, setInterested] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    api.getCatalogue()
      .then((d) => {
        if (!live) return;
        setCatalogue(d.catalogue);
        setInterested(d.catalogue.interested || []);
        // Land on the one role somebody can actually start rather than making them hunt
        // for it through six categories.
        const open = d.catalogue.categories
          .flatMap((c) => c.subcategories.flatMap((s) => s.roles))
          .find((r) => r.status === 'live');
        if (open) { setRoleKey(open.key); setLevel(open.levels[0].key); }
      })
      .catch((e) => { if (live) setLoadError(e.message); });
    return () => { live = false; };
  }, []);

  const allRoles = useMemo(() => (catalogue
    ? catalogue.categories.flatMap((c) => c.subcategories.flatMap(
      (s) => s.roles.map((r) => ({ ...r, category: c.key, subcategory: s.label }))))
    : []), [catalogue]);

  const selected = allRoles.find((r) => r.key === roleKey) || null;
  const detail = selected && selected.status === 'live' && catalogue
    ? catalogue.detail[selected.key] : null;

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return allRoles.filter((r) => r.label.toLowerCase().includes(q)
      || r.subcategory.toLowerCase().includes(q)).slice(0, 40);
  }, [query, allRoles]);

  function pick(role) {
    if (role.status === 'live') {
      setRoleKey(role.key);
      setLevel(role.levels[0].key);
      setError('');
    } else {
      setComingSoon(role);
    }
  }

  async function askFor(key) {
    await api.registerRoleInterest(key);
    setInterested((prev) => (prev.includes(key) ? prev : [...prev, key]));
  }

  async function submit() {
    if (!selected || selected.status !== 'live') return;
    setBusy(true);
    setError('');
    try {
      const data = await api.enroll(selected.key, level, scheduleType);
      onEnrolled(data.state);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-gray-50 grid place-items-center px-4">
        <div className="text-center">
          <p className="text-sm text-gray-600">Could not load the role catalogue.</p>
          <p className="text-xs text-gray-400 mt-1">{loadError}</p>
        </div>
      </div>
    );
  }

  if (!catalogue) {
    return (
      <div className="min-h-screen bg-gray-50 grid place-items-center px-4">
        <div className="text-sm text-gray-400">Loading roles…</div>
      </div>
    );
  }

  const activeCategory = catalogue.categories.find((c) => c.key === category) || null;

  return (
    <div className="min-h-screen bg-gray-50 px-4 sm:px-6 py-8 sm:py-12">
      {/* On a phone the order is headline, then the choice, then the detail — the picker
          must not sit below four cards of pitch. On a wide screen the pitch takes the left
          column and the picker the right, which is the same content in two readings. */}
      <div className="max-w-5xl mx-auto flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:grid-rows-[auto_1fr] lg:items-start lg:gap-x-12 lg:gap-y-6">
        <div className="lg:col-start-1 lg:row-start-1">
          <PitchHeader
            detail={detail}
            totalRoles={catalogue.totalRoles}
            liveRoles={catalogue.liveRoles}
          />
        </div>

        <div className="lg:col-start-2 lg:row-start-1 lg:row-span-2 bg-white border border-gray-200 rounded-2xl shadow-sm p-5 sm:p-6 w-full">
          <h2 className="text-base font-extrabold text-gray-900">Choose your role</h2>
          <p className="text-xs text-gray-500 mt-1 mb-4">
            {catalogue.totalRoles} roles across {catalogue.categories.length} categories.
            The ones marked <span className="font-semibold text-emerald-600">Open</span> can be
            started today.
          </p>

          <div className="relative mb-4">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${catalogue.totalRoles} roles…`}
              aria-label="Search roles"
              className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400"
            />
          </div>

          {/* Search wins over browsing: if they are typing, show matches and nothing else. */}
          {results ? (
            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
              {results.length === 0 && (
                <p className="text-xs text-gray-400 py-4 text-center">No role matches that.</p>
              )}
              {results.map((r) => (
                <div key={r.key}>
                  <div className="text-[10px] uppercase tracking-wide text-gray-400 mb-0.5">{r.subcategory}</div>
                  <RoleButton role={r} selected={r.key === roleKey} onClick={() => pick(r)} />
                </div>
              ))}
            </div>
          ) : !activeCategory ? (
            <div className="grid sm:grid-cols-2 gap-2">
              {catalogue.categories.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setCategory(c.key)}
                  className="text-left rounded-xl border border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/40 transition-colors p-3.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-gray-900">{c.label}</span>
                    {c.liveCount > 0 && (
                      <span className="shrink-0 text-[10px] font-bold uppercase text-emerald-600 bg-emerald-50 rounded px-1.5 py-0.5">
                        {c.liveCount} open
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">{c.blurb}</p>
                  <p className="text-[11px] text-gray-400 mt-1.5">{c.roleCount} roles</p>
                </button>
              ))}
            </div>
          ) : (
            <div>
              <button
                onClick={() => setCategory(null)}
                className="flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-900 mb-3"
              >
                <ChevronLeft size={14} /> All categories
              </button>
              <div className="space-y-4 max-h-72 overflow-y-auto pr-1">
                {activeCategory.subcategories.map((s) => (
                  <div key={s.label}>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                      {s.label}
                    </div>
                    <div className="space-y-1.5">
                      {s.roles.map((r) => (
                        <RoleButton key={r.key} role={r} selected={r.key === roleKey} onClick={() => pick(r)} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selected && selected.status === 'live' && (
            <div className="mt-5 pt-5 border-t border-gray-100">
              <div className="flex items-center gap-2 mb-4">
                <UserRound size={15} className="text-indigo-500" />
                <span className="text-sm font-bold text-gray-900">{selected.label}</span>
              </div>

              <label className="block text-xs font-bold text-gray-500 mb-1.5">Level</label>
              <p className="text-[11px] text-gray-400 mb-2">
                Each level gets different projects, not the same work described differently.
                Starting above Junior skips the promotion rounds below it.
              </p>
              <div className="space-y-1.5 mb-4">
                {selected.levels.map((l) => (
                  <button
                    key={l.key}
                    onClick={() => setLevel(l.key)}
                    className={`w-full text-left rounded-lg border px-3.5 py-2.5 flex items-center justify-between gap-2 transition-colors ${
                      level === l.key ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300'
                    }`}
                  >
                    <span className="text-sm font-semibold text-gray-900 truncate">{l.label}</span>
                    {level === l.key && <Check size={14} className="text-indigo-600 shrink-0" />}
                  </button>
                ))}
              </div>

              <label className="block text-xs font-bold text-gray-500 mb-1.5">Training schedule</label>
              <select
                value={scheduleType}
                onChange={(e) => setScheduleType(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm mb-1.5"
              >
                {SCHEDULES.map((s) => (
                  <option key={s.key} value={s.key} disabled={!s.available}>
                    {s.label}{s.available ? '' : ' — coming soon'}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-gray-400 mb-4">
                The programme runs Monday to Friday today. Weekend and custom schedules are
                not wired up yet, so we are not offering them rather than quietly ignoring
                what you pick.
              </p>

              <div className="bg-indigo-50 text-indigo-700 text-xs rounded-lg px-4 py-3 mb-4">
                Free while Virtual Workspace is in early access. A certificate becomes eligible
                after 66 days at the desk — about three months of weekdays.
              </div>

              {error && <div className="text-red-500 text-xs mb-3">{error}</div>}

              <button
                onClick={submit}
                disabled={busy}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-lg py-3 transition-colors disabled:opacity-60"
              >
                {busy ? 'Starting…' : `Start as a ${(selected.levels.find((l) => l.key === level) || {}).label || selected.label}`}
                {!busy && <ArrowRight size={15} />}
              </button>
            </div>
          )}
        </div>

        <div className="lg:col-start-1 lg:row-start-2">
          <PitchDetail detail={detail} level={level} />
        </div>
      </div>

      <AnimatePresence>
        {comingSoon && (
          <ComingSoon
            role={comingSoon}
            alreadyAsked={interested.includes(comingSoon.key)}
            onAsk={askFor}
            onClose={() => setComingSoon(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
