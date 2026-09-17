import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Clock3, ArrowRight, Mail, MessageSquare, AlertTriangle, CornerUpLeft, CalendarClock,
  Building2, ChevronRight, Coffee, Target, PenLine, CheckCircle2, Moon,
} from 'lucide-react';
import { BentoCard, Avatar, TONE } from './ui.jsx';
import { Situation } from './Today.jsx';
import { api } from '../api.js';

// One icon per kind of slot, so the shape of a day is legible before any of the words are
// read. A day that is all focus blocks looks different from one that is all review.
const SLOT_ICON = {
  standup: MessageSquare, focus: Target, admin: Mail, lunch: Coffee,
  review: CheckCircle2, wrap: Moon,
};
const HEADLINE_ICON = {
  standup: MessageSquare, returned: CornerUpLeft, overdue: AlertTriangle,
  mail: Mail, situation: PenLine,
};

// ---- The workday header ------------------------------------------------------------------
//
// Who you are and where you are, before anything about how you are doing. Five seconds of
// reading should answer "which company, which team, whose team" -- the questions a real
// first week is mostly made of.
function WorkdayHeader({ company, employee, workday }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-4 sm:px-6 pt-5 pb-4 border-b border-slate-100">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">
              {workday.greeting}, {employee.firstName}.
            </h1>
            <p className="text-[13px] sm:text-sm text-slate-500 mt-1">{workday.dateLabel}</p>
          </div>
          <div className="flex items-start gap-3 min-w-0">
            <span className="shrink-0 w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center text-[13px] font-extrabold tracking-tight">
              {company.mark}
            </span>
            <div className="min-w-0">
              <div className="text-[14px] font-bold text-slate-900 leading-tight">{company.name}</div>
              <div className="text-[12px] text-slate-500 leading-tight mt-0.5">{employee.department}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Employee context: enough to place yourself, never a profile page. */}
      <div className="px-4 sm:px-6 py-3 bg-slate-50/70 flex items-center gap-x-5 gap-y-2 flex-wrap text-[12px]">
        <span className="flex items-center gap-2 min-w-0">
          <Avatar name={employee.name} size={22} />
          <b className="text-slate-800 truncate">{employee.title}</b>
        </span>
        <span className="text-slate-500 truncate">{employee.team}</span>
        {employee.manager && (
          <span className="text-slate-500 truncate">
            Manager: <b className="text-slate-700 font-semibold">{employee.manager.name}</b>
          </span>
        )}
        <span className="text-slate-400 hidden sm:inline truncate">{employee.employeeId}</span>
        <span className="text-slate-400 hidden md:inline truncate">{employee.city} · {employee.workArrangement}</span>
      </div>
    </div>
  );
}

// ---- What is happening -------------------------------------------------------------------
function Headlines({ items, onTab }) {
  if (!items.length) {
    return (
      <p className="text-[13px] text-slate-500 px-1">
        Nothing is waiting on you. That is a real state and it does not last.
      </p>
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
      {items.map((h, i) => {
        const Icon = HEADLINE_ICON[h.kind] || AlertTriangle;
        const t = TONE[h.tone] || TONE.slate;
        const clickable = Boolean(h.tab && onTab);
        return (
          <motion.button
            key={h.kind + i}
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
            onClick={clickable ? () => onTab(h.tab) : undefined}
            disabled={!clickable}
            className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left ${t.tile} ${
              clickable ? 'hover:brightness-[0.97] cursor-pointer' : 'cursor-default'}`}
          >
            <span className={`shrink-0 w-7 h-7 rounded-lg ${t.chip} text-white flex items-center justify-center`}>
              <Icon size={14} />
            </span>
            <span className="text-[13px] font-semibold text-slate-800 leading-snug min-w-0">{h.text}</span>
            {clickable && <ChevronRight size={15} className="ml-auto shrink-0 text-slate-400" />}
          </motion.button>
        );
      })}
    </div>
  );
}

// ---- The current assignment --------------------------------------------------------------
//
// The single loudest thing on the page, because on a real day there is one thing you are
// supposed to be doing and everything else is noise about it.
function estimateOf(hours) {
  if (!hours || hours < 0.17) return null;
  if (hours < 1) return `about ${Math.round(hours * 60)} min`;
  return `about ${Math.round(hours * 10) / 10}h`;
}

function CurrentAssignment({ a, onOpen }) {
  if (!a) {
    return (
      <BentoCard hover={false}>
        <div className="text-[11px] font-bold tracking-[0.12em] text-slate-400 uppercase mb-2">Current assignment</div>
        <p className="text-sm text-slate-600">
          Nothing is open. Either the day is done or the next piece has not landed yet — the
          timeline below says which.
        </p>
      </BentoCard>
    );
  }
  return (
    <div className={`rounded-2xl border-2 p-4 sm:p-5 ${
      a.sentBack ? 'border-rose-300 bg-rose-50/40' : a.overdue ? 'border-amber-300 bg-amber-50/40' : 'border-indigo-300 bg-indigo-50/30'}`}>
      <div className="flex items-center gap-2 mb-2.5 flex-wrap">
        <span className="text-[11px] font-bold tracking-[0.12em] text-indigo-700 uppercase">Current assignment</span>
        {a.sentBack && (
          <span className="text-[11px] font-bold rounded px-1.5 py-0.5 bg-rose-600 text-white uppercase tracking-wide">
            {a.sentBack === 'redo' ? 'Returned' : 'Change requested'}
          </span>
        )}
        {a.overdue && !a.sentBack && (
          <span className="text-[11px] font-bold rounded px-1.5 py-0.5 bg-amber-600 text-white uppercase tracking-wide">Past due</span>
        )}
      </div>

      <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight leading-snug">{a.title}</h2>
      {a.projectTitle && <p className="text-[13px] font-semibold text-slate-500 mt-0.5">{a.projectTitle}</p>}

      {a.sentBackNote && (
        <p className="text-[13px] text-rose-900 bg-white/70 border border-rose-200 rounded-lg px-3 py-2 mt-3 leading-relaxed">
          {a.sentBackNote}
        </p>
      )}
      {!a.sentBackNote && a.brief && (
        <p className="text-[13px] text-slate-600 mt-2.5 leading-relaxed line-clamp-3">{a.brief}</p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-5 gap-y-3 mt-4">
        {[
          ['Requested by', a.requestedBy && a.requestedBy.name, a.requestedBy && a.requestedBy.title],
          ['Reviewer', a.reviewer && a.reviewer.name, a.reviewer && a.reviewer.title],
          // "about 0.1h" is six minutes and reads as a glitch. Below half an hour it is
          // minutes; below ten it is not worth saying at all.
          ['Due', a.dueLabel || '—', estimateOf(a.estHours)],
          ['Priority', a.priorityLabel || '—', null],
        ].filter(([, v]) => v).map(([label, value, sub]) => (
          <div key={label} className="min-w-0">
            <div className="text-[11px] font-bold tracking-wide text-slate-500 uppercase">{label}</div>
            <div className="text-[13px] font-bold text-slate-800 truncate mt-0.5">{value}</div>
            {sub && <div className="text-[12px] text-slate-500 truncate">{sub}</div>}
          </div>
        ))}
      </div>

      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={() => onOpen(a.taskId)}
        className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900 text-white text-[13px] font-bold hover:bg-slate-800"
      >
        {a.stagePct > 0 ? 'Continue work' : 'Start work'} <ArrowRight size={15} />
      </motion.button>
    </div>
  );
}

// ---- My day --------------------------------------------------------------------------------
function Timeline({ slots, onOpen }) {
  return (
    <BentoCard hover={false}>
      <div className="flex items-center gap-2 mb-3.5">
        <span className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0">
          <CalendarClock size={16} />
        </span>
        <div className="min-w-0">
          <h3 className="text-base font-bold leading-tight">My day</h3>
          <p className="text-xs text-slate-500 leading-snug">Office hours, and what is in them</p>
        </div>
      </div>
      <ol className="relative">
        {slots.map((s) => {
          const Icon = SLOT_ICON[s.kind] || Clock3;
          return (
            <li key={s.at} className="flex gap-3 pb-1">
              <div className="w-11 shrink-0 pt-1.5 text-right">
                <span className={`text-[12px] font-bold tabular-nums ${s.now ? 'text-indigo-700' : s.past ? 'text-slate-300' : 'text-slate-500'}`}>
                  {s.at}
                </span>
              </div>
              <div className="flex flex-col items-center shrink-0">
                <span className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                  s.now ? 'bg-indigo-600 text-white' : s.past ? 'bg-slate-100 text-slate-300' : 'bg-slate-100 text-slate-500'}`}>
                  <Icon size={12} />
                </span>
                <span className="flex-1 w-px bg-slate-100 my-0.5" />
              </div>
              <div className={`min-w-0 flex-1 pb-3 ${s.past && !s.now ? 'opacity-45' : ''}`}>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {s.taskId ? (
                    <button onClick={() => onOpen(s.taskId)} className="text-[13px] font-bold text-slate-800 hover:text-indigo-700 text-left truncate">
                      {s.title}
                    </button>
                  ) : (
                    <span className={`text-[13px] font-bold ${s.empty ? 'text-slate-400' : 'text-slate-800'}`}>{s.title}</span>
                  )}
                  {s.now && <span className="text-[10px] font-extrabold rounded px-1.5 py-0.5 bg-indigo-600 text-white tracking-wide">NOW</span>}
                  {s.next && <span className="text-[10px] font-extrabold rounded px-1.5 py-0.5 bg-slate-800 text-white tracking-wide">NEXT</span>}
                </div>
                {s.detail && <div className="text-[12px] text-slate-500 leading-snug mt-0.5">{s.detail}</div>}
              </div>
            </li>
          );
        })}
      </ol>
    </BentoCard>
  );
}

// ---- The queue -----------------------------------------------------------------------------
function WorkQueue({ rows, onOpen, onTab }) {
  if (!rows.length) {
    return (
      <BentoCard hover={false}>
        <h3 className="text-base font-bold mb-1">Your work</h3>
        <p className="text-[13px] text-slate-500">Nothing else outstanding.</p>
      </BentoCard>
    );
  }
  return (
    <BentoCard hover={false}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="text-base font-bold leading-tight">Your work</h3>
          <p className="text-xs text-slate-500 leading-snug">Who asked, when it lands, where it stands</p>
        </div>
        <button onClick={() => onTab('tasks')} className="shrink-0 text-[12px] font-bold text-indigo-700 hover:underline">
          My Work
        </button>
      </div>
      <ul className="divide-y divide-slate-100">
        {rows.map((r) => {
          const t = TONE[r.state.tone] || TONE.slate;
          return (
            <li key={r.taskId}>
              <button onClick={() => onOpen(r.taskId)} className="w-full flex items-center gap-3 py-2.5 text-left group">
                <span className={`shrink-0 text-[11px] font-bold rounded px-1.5 py-1 border ${t.tile} ${t.ink} w-[104px] text-center`}>
                  {r.state.label}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-bold text-slate-800 truncate group-hover:text-indigo-700">{r.title}</span>
                  <span className="block text-[12px] text-slate-500 truncate">
                    {[r.requestedBy && `for ${r.requestedBy}`, r.projectTitle].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <span className="shrink-0 text-[12px] text-slate-500 hidden sm:block">{r.dueLabel || ''}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </BentoCard>
  );
}

// ---- Since you were away --------------------------------------------------------------------
function SinceAway({ data, onTab }) {
  if (!data.since || !data.items.length) return null;
  const gapDays = Math.floor((Date.now() - Date.parse(data.since)) / 86400000);
  return (
    <BentoCard hover={false} className="border-slate-300 bg-slate-50/60">
      <h3 className="text-base font-bold mb-0.5">Since you were away</h3>
      <p className="text-xs text-slate-500 mb-3">
        {gapDays >= 1 ? `The last ${gapDays === 1 ? 'day' : `${gapDays} days`}` : 'While you were gone'} — the place kept going.
      </p>
      <ul className="space-y-1.5">
        {data.items.map((it, i) => (
          <li key={i}>
            <button
              onClick={it.tab ? () => onTab(it.tab) : undefined}
              disabled={!it.tab}
              className={`w-full text-left text-[13px] text-slate-700 leading-snug flex gap-2 ${it.tab ? 'hover:text-indigo-700' : 'cursor-default'}`}
            >
              <span className="text-slate-300 shrink-0">—</span>
              <span className="min-w-0">{it.text}</span>
            </button>
          </li>
        ))}
      </ul>
    </BentoCard>
  );
}

// ---- Manager, projects ----------------------------------------------------------------------
function ManagerNote({ note, manager, onTab }) {
  if (!note) return null;
  return (
    <BentoCard hover={false}>
      <div className="flex items-start gap-3">
        <Avatar name={note.name} avatarUrl={note.avatarUrl} size={36} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-[13px] font-bold text-slate-800">{note.name}</span>
            {manager && <span className="text-[12px] text-slate-500">{manager.title}</span>}
          </div>
          {note.subject && <div className="text-[13px] font-semibold text-slate-700 mt-1">{note.subject}</div>}
          <p className="text-[13px] text-slate-600 leading-relaxed mt-0.5 line-clamp-3">{note.body}</p>
          <button onClick={() => onTab('emails')} className="text-[12px] font-bold text-indigo-700 hover:underline mt-1.5">
            Open in Inbox
          </button>
        </div>
      </div>
    </BentoCard>
  );
}

function ProjectHealth({ rows, onTab }) {
  if (!rows.length) return null;
  const tone = (h) => (h === 'at risk' ? 'text-rose-700 bg-rose-50 border-rose-200'
    : h === 'delivered' ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
      : 'text-slate-600 bg-slate-50 border-slate-200');
  return (
    <BentoCard hover={false}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <Building2 size={15} className="text-slate-400 shrink-0" />
          <h3 className="text-base font-bold leading-tight">Projects</h3>
        </div>
        <button onClick={() => onTab('projects')} className="shrink-0 text-[12px] font-bold text-indigo-700 hover:underline">
          Projects
        </button>
      </div>
      <ul className="space-y-2.5">
        {rows.map((p) => (
          <li key={p.key}>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[13px] font-bold text-slate-800 min-w-0 truncate">{p.title}</span>
              <span className={`text-[10px] font-extrabold uppercase tracking-wide rounded px-1.5 py-0.5 border ${tone(p.health)}`}>
                {p.health}
              </span>
            </div>
            <div className="text-[12px] text-slate-500 mt-0.5">
              {[p.phase, p.due].filter(Boolean).join(' · ')}
            </div>
            <div className="h-1 rounded-full bg-slate-100 mt-1.5 overflow-hidden">
              <div className="h-full rounded-full bg-slate-800" style={{ width: `${p.progressPct}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </BentoCard>
  );
}

// ---- The page --------------------------------------------------------------------------------
export default function WorkdayHome({ state, onStateChange, onTab, onOpenTask }) {
  const { company, employee, workday } = state;
  const [busy, setBusy] = useState(false);

  // The project's own workplace situations, unhandled. These keep the exact controls they
  // have on Today -- reply, later, archive, escalate -- because the judgement they teach is
  // the point of them, and a second copy of that UI would be a second thing to get wrong.
  const openSituations = useMemo(
    () => (state.situations || []).filter((x) => !x.handledAs && !x.deskMail).slice(0, 2),
    [state.situations],
  );

  async function handleSituation(key, action, text) {
    setBusy(true);
    try {
      const d = await api.handleSituation(key, action, text);
      if (d.state) onStateChange(d.state);
    } finally { setBusy(false); }
  }

  // Missing context should never blank the page — an old session, or a learner between
  // projects, still gets a workspace rather than a spinner that never resolves.
  if (!company || !employee || !workday) {
    return <p className="text-sm text-slate-500">Setting up your workspace…</p>;
  }

  const openTask = (taskId) => {
    if (onOpenTask) onOpenTask(taskId);
    else onTab('tasks');
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      <WorkdayHeader company={company} employee={employee} workday={workday} />

      <Headlines items={workday.headlines} onTab={onTab} />

      <CurrentAssignment a={workday.assignment} onOpen={openTask} />

      {/* Desktop is information-rich; on a phone this stacks in the order the spec asks
          for — what is happening, what to work on, what is next, then everything else. */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5 items-start">
        <div className="lg:col-span-2 space-y-4 sm:space-y-5 min-w-0">
          <WorkQueue rows={workday.queue} onOpen={openTask} onTab={onTab} />

          {openSituations.length > 0 && (
            <BentoCard hover={false}>
              <div className="mb-3">
                <h3 className="text-base font-bold leading-tight">On your desk</h3>
                <p className="text-xs text-slate-500 leading-snug">
                  Came in addressed to you. Each one wants a decision, not an answer.
                </p>
              </div>
              <div className={`space-y-3 ${busy ? 'opacity-60 pointer-events-none' : ''}`}>
                {openSituations.map((item) => (
                  <Situation key={item.key} item={item} onHandle={handleSituation} />
                ))}
              </div>
              <button onClick={() => onTab('today')} className="text-[12px] font-bold text-indigo-700 hover:underline mt-3">
                My Day — everything else today
              </button>
            </BentoCard>
          )}

          <SinceAway data={workday.sinceAway} onTab={onTab} />
        </div>

        <div className="space-y-4 sm:space-y-5 min-w-0">
          <Timeline slots={workday.timeline} onOpen={openTask} />
          <ManagerNote note={workday.managerNote} manager={employee.manager} onTab={onTab} />
          <ProjectHealth rows={workday.projectHealth} onTab={onTab} />
        </div>
      </div>
    </div>
  );
}
