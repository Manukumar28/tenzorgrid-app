import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, ChevronRight, Search, Flag, Check, X as XIcon, Lock, Star,
  ClipboardCheck, Mail, CalendarDays, AlertTriangle,
} from 'lucide-react';
import { BentoCard, Avatar } from './ui.jsx';
import { REGIONS, holidaysForYear, loadRegion, saveRegion } from '../lib/holidays.js';

const DOWS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function pad(n) { return String(n).padStart(2, '0'); }
function key(y, m, d) { return `${y}-${pad(m + 1)}-${pad(d)}`; }

// Event kinds carry a colour and a dot so a day's contents read at a glance.
const KIND = {
  due: { dot: 'bg-red-500', chip: 'border-l-red-500', label: 'Deadline', icon: AlertTriangle },
  'due-done': { dot: 'bg-emerald-500', chip: 'border-l-emerald-500', label: 'Deadline met', icon: Check },
  assigned: { dot: 'bg-indigo-500', chip: 'border-l-indigo-500', label: 'Assigned', icon: ClipboardCheck },
  graded: { dot: 'bg-teal-500', chip: 'border-l-teal-500', label: 'Graded', icon: Check },
  message: { dot: 'bg-amber-500', chip: 'border-l-amber-400', label: 'Message', icon: Mail },
};

const PRIORITY_PILL = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-emerald-100 text-emerald-700',
};

function StatusPill({ tone, icon: Icon, children }) {
  return (
    <span className={`inline-flex items-center gap-0.5 text-[9px] font-bold rounded px-1 py-0.5 leading-none ${tone}`}>
      <Icon size={9} strokeWidth={3} /> {children}
    </span>
  );
}

export default function CalendarTab({ state }) {
  const { calendar, attendance, roster } = state;
  const todayKey = calendar.today;

  const [cursor, setCursor] = useState(() => {
    const [y, m] = todayKey.split('-').map(Number);
    return { year: y, month: m - 1 };
  });
  const [direction, setDirection] = useState(0);
  const [selected, setSelected] = useState(todayKey);
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState(() => loadRegion());

  const personByArchetype = useMemo(
    () => Object.fromEntries(roster.map((p) => [p.archetype, p])),
    [roster],
  );

  const holidays = useMemo(() => holidaysForYear(region, cursor.year), [region, cursor.year]);
  const attendedSet = useMemo(() => new Set(attendance.days), [attendance.days]);

  // Events indexed by day, filtered by the search box so the grid dots and the day panel
  // always agree with what was searched for.
  const eventsByDay = useMemo(() => {
    const q = query.trim().toLowerCase();
    const map = {};
    for (const e of calendar.events) {
      if (q && !(`${e.title} ${e.detail || ''}`.toLowerCase().includes(q))) continue;
      (map[e.date] = map[e.date] || []).push(e);
    }
    return map;
  }, [calendar.events, query]);

  const grid = useMemo(() => {
    const { year, month } = cursor;
    const firstDow = new Date(Date.UTC(year, month, 1)).getUTCDay();
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const cells = [];
    for (let i = 0; i < firstDow; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  }, [cursor]);

  function move(delta) {
    setDirection(delta);
    setCursor((c) => {
      const m = c.month + delta;
      if (m < 0) return { year: c.year - 1, month: 11 };
      if (m > 11) return { year: c.year + 1, month: 0 };
      return { year: c.year, month: m };
    });
  }

  // A day's full state. Everything here is derived from real records: the joining date,
  // stored attendance, and the holiday table for the chosen region.
  function dayState(dk) {
    const dow = new Date(`${dk}T00:00:00Z`).getUTCDay();
    const beforeJoining = dk < calendar.joinedOn;
    const isJoinDay = dk === calendar.joinedOn;
    const isToday = dk === todayKey;
    const isFuture = dk > todayKey;
    const weekend = dow === 0 || dow === 6;
    const holiday = holidays[dk] || null;
    const present = attendedSet.has(dk);
    // Absent only makes sense on a past working day the learner was actually enrolled
    // for — never before joining, never on a weekend or holiday, never in the future, and
    // never on the joining day itself, since enrolling is not something you can miss.
    const absent = !present && !beforeJoining && !isFuture && !isToday && !weekend && !holiday && !isJoinDay;
    return { dow, beforeJoining, isJoinDay, isToday, isFuture, weekend, holiday, present, absent };
  }

  const selectedState = dayState(selected);
  const selectedEvents = eventsByDay[selected] || [];
  const [sy, sm, sd] = selected.split('-').map(Number);

  // Real upcoming items only — the next dated records after today.
  const upcoming = useMemo(() => calendar.events
    .filter((e) => e.date >= todayKey && (e.kind === 'due' || e.kind === 'assigned'))
    .slice(0, 5), [calendar.events, todayKey]);

  const monthAttended = attendance.days.filter((d) => d.startsWith(`${cursor.year}-${pad(cursor.month + 1)}`)).length;

  return (
    <div className="space-y-4">
      {/* Title + search */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-baseline gap-2.5 flex-wrap">
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Calendar</h1>
          <span className="text-sm font-semibold text-slate-400">[Work schedule]</span>
        </div>
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search deadlines, tasks, messages…"
            aria-label="Search calendar"
            className="w-full bg-white border border-slate-200 rounded-full pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap border-y border-slate-100 py-2.5">
        <div className="flex items-center gap-x-5 gap-y-1 flex-wrap text-xs text-slate-500">
          <span>Attendance: <b className="text-slate-800">{attendance.attendedDays}/{attendance.milestoneDays}</b> toward your first certificate</span>
          <span className="text-slate-200">|</span>
          <span>This month: <b className="text-slate-800">{monthAttended}</b></span>
          <span className="text-slate-200">|</span>
          <span>Joined: <b className="text-slate-800">{calendar.joinedOn}</b></span>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[11px] font-semibold text-slate-500">Holidays</label>
          <select
            value={region}
            onChange={(e) => { setRegion(e.target.value); saveRegion(e.target.value); }}
            aria-label="Holiday region"
            className="text-xs font-semibold rounded-full border border-slate-200 bg-white text-slate-600 px-3 py-1.5 cursor-pointer hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          >
            {REGIONS.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-5 items-start">
        {/* Month grid */}
        <BentoCard hover={false}>
          <div className="flex items-center justify-between gap-3 mb-4">
            <button onClick={() => move(-1)} aria-label="Previous month" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
              <ChevronLeft size={18} />
            </button>
            <h3 className="text-base font-bold">{MONTHS[cursor.month]} {cursor.year}</h3>
            <button onClick={() => move(1)} aria-label="Next month" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1.5 mb-1.5">
            {DOWS.map((d) => (
              <div key={d} className="text-center text-[10px] font-bold text-slate-400 uppercase pb-1">{d}</div>
            ))}
          </div>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`${cursor.year}-${cursor.month}`}
              initial={{ opacity: 0, x: direction > 0 ? 28 : direction < 0 ? -28 : 0 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction > 0 ? -28 : 28 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="grid grid-cols-7 gap-1.5"
            >
              {grid.map((d, i) => {
                if (!d) return <div key={`e${i}`} />;
                const dk = key(cursor.year, cursor.month, d);
                const st = dayState(dk);
                const evs = eventsByDay[dk] || [];
                const isSel = dk === selected;

                let cls = 'bg-white hover:bg-slate-50 border-slate-100';
                if (st.beforeJoining) cls = 'bg-slate-50 border-slate-100 cursor-not-allowed';
                else if (st.holiday) cls = 'bg-red-500 border-red-500 text-white hover:bg-red-500';
                else if (st.weekend) cls = 'bg-slate-100 border-slate-100 text-slate-400';
                if (st.isJoinDay) cls = 'bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-600';

                return (
                  <button
                    key={dk}
                    disabled={st.beforeJoining}
                    onClick={() => setSelected(dk)}
                    title={st.beforeJoining ? 'Before you joined' : st.holiday || undefined}
                    className={`relative aspect-square rounded-lg border p-1 text-left transition-colors ${cls} ${
                      isSel ? 'ring-2 ring-indigo-400' : ''
                    } ${st.isToday && !isSel ? 'ring-1 ring-indigo-300' : ''}`}
                  >
                    <span className={`text-[11px] font-bold ${st.beforeJoining ? 'text-slate-300' : ''}`}>{d}</span>

                    {st.beforeJoining && <Lock size={9} className="absolute top-1 right-1 text-slate-300" />}
                    {st.isJoinDay && <Star size={10} className="absolute top-1 right-1 text-white fill-white" />}
                    {st.holiday && !st.isJoinDay && <Flag size={9} className="absolute top-1 right-1 text-white" />}

                    {/* Attendance verdicts, only where they are meaningful */}
                    <span className="absolute bottom-0.5 left-0.5 right-0.5 flex items-center justify-between gap-0.5">
                      <span className="flex gap-0.5 flex-wrap">
                        {evs.slice(0, 4).map((e) => (
                          <span key={e.id} className={`w-1.5 h-1.5 rounded-full ${KIND[e.kind]?.dot || 'bg-slate-400'}`} />
                        ))}
                      </span>
                      {st.present && !st.isJoinDay && <StatusPill tone="bg-emerald-100 text-emerald-700" icon={Check}>P</StatusPill>}
                      {st.absent && <StatusPill tone="bg-red-100 text-red-700" icon={XIcon}>A</StatusPill>}
                    </span>
                  </button>
                );
              })}
            </motion.div>
          </AnimatePresence>

          {/* Legend — states are named, never colour-only */}
          <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 mt-4 pt-3 border-t border-slate-100 text-[10px] text-slate-500 font-medium">
            <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-indigo-600" /> Joined</span>
            <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-red-500" /> Holiday</span>
            <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-slate-100 border border-slate-200" /> Weekend</span>
            <span className="inline-flex items-center gap-1"><Lock size={10} /> Before joining</span>
            <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-500" /> Deadline</span>
            <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-indigo-500" /> Assigned</span>
            <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Message</span>
          </div>
          {region === 'NONE' && (
            <p className="text-[10px] text-slate-400 mt-2">
              No holiday calendar for your region — pick one above to show public holidays.
            </p>
          )}
        </BentoCard>

        {/* Day panel */}
        <BentoCard hover={false} className="xl:sticky xl:top-4">
          <h3 className="text-base font-bold mb-0.5">
            {MONTHS[sm - 1]} {sd}, {sy}
          </h3>
          <p className="text-xs text-slate-400 mb-4">Selected day</p>

          <div className="flex flex-wrap gap-1.5 mb-4">
            {selectedState.isJoinDay && <span className="text-[11px] font-bold rounded-md px-2 py-1 bg-indigo-100 text-indigo-700">You joined today</span>}
            {selectedState.holiday && <span className="text-[11px] font-bold rounded-md px-2 py-1 bg-red-100 text-red-700">{selectedState.holiday}</span>}
            {selectedState.weekend && <span className="text-[11px] font-bold rounded-md px-2 py-1 bg-slate-100 text-slate-600">Weekend</span>}
            {selectedState.present && <span className="text-[11px] font-bold rounded-md px-2 py-1 bg-emerald-100 text-emerald-700">Present</span>}
            {selectedState.absent && <span className="text-[11px] font-bold rounded-md px-2 py-1 bg-red-100 text-red-700">Absent</span>}
            {/* Only nudge on a day the learner was actually expected to work. */}
            {selectedState.isToday && !selectedState.present && !selectedState.weekend && !selectedState.holiday && (
              <span className="text-[11px] font-bold rounded-md px-2 py-1 bg-amber-100 text-amber-700">Not checked in yet</span>
            )}
            {selectedState.isFuture && <span className="text-[11px] font-bold rounded-md px-2 py-1 bg-slate-100 text-slate-500">Upcoming</span>}
          </div>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={selected}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1"
            >
              {selectedEvents.length ? selectedEvents.map((e) => {
                const k = KIND[e.kind] || KIND.message;
                const Icon = k.icon;
                const person = e.archetype ? personByArchetype[e.archetype] : null;
                return (
                  <motion.div
                    key={e.id}
                    whileHover={{ y: -2 }}
                    className={`border border-slate-100 border-l-[3px] ${k.chip} rounded-lg px-3 py-2.5 bg-white`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                        <Icon size={11} /> {k.label}
                      </span>
                      <span className="text-[10px] text-slate-400 shrink-0">
                        {new Date(e.at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="text-sm font-bold leading-snug mb-0.5">{e.title}</div>
                    {e.detail && <p className="text-xs text-slate-500 leading-snug">{e.detail}</p>}
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {person && (
                        <span className="inline-flex items-center gap-1.5">
                          <Avatar name={person.name} avatarUrl={person.avatarUrl} size={18} />
                          <span className="text-[11px] text-slate-500">{person.name}</span>
                        </span>
                      )}
                      {e.priority && (
                        <span className={`text-[10px] font-bold rounded px-1.5 py-0.5 ${PRIORITY_PILL[e.priority]}`}>
                          {e.priority[0].toUpperCase() + e.priority.slice(1)}
                        </span>
                      )}
                    </div>
                  </motion.div>
                );
              }) : (
                <div className="text-center py-8">
                  <CalendarDays size={26} className="text-slate-300 mx-auto mb-2.5" />
                  <p className="text-sm text-slate-500 font-medium">
                    {selectedState.beforeJoining
                      ? 'Before you joined the workspace.'
                      : query ? 'Nothing on this day matches your search.' : 'Nothing scheduled on this day.'}
                  </p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {upcoming.length > 0 && (
            <div className="mt-4 pt-3.5 border-t border-slate-100">
              <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2.5">Coming up</h4>
              <div className="space-y-1.5">
                {upcoming.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => {
                      const [y, m] = e.date.split('-').map(Number);
                      setDirection(0);
                      setCursor({ year: y, month: m - 1 });
                      setSelected(e.date);
                    }}
                    className="w-full text-left flex items-center gap-2 text-xs hover:bg-slate-50 rounded px-1.5 py-1"
                  >
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${KIND[e.kind]?.dot || 'bg-slate-400'}`} />
                    <span className="text-slate-400 shrink-0 w-16">{e.date.slice(5)}</span>
                    <span className="font-semibold text-slate-700 truncate">{e.title}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </BentoCard>
      </div>
    </div>
  );
}
