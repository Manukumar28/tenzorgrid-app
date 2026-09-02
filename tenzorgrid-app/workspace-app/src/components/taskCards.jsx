import React from 'react';
import { motion } from 'framer-motion';
import { Database, Lock, Clock, ArrowRight, CheckCircle2, AlertTriangle, CalendarClock } from 'lucide-react';
import { BentoCard, ProgressBar, Avatar } from './ui.jsx';

export const PRIORITY_PILL = {
  high: 'bg-red-500 text-white',
  medium: 'bg-amber-400 text-white',
  low: 'bg-emerald-500 text-white',
};

const DIFFICULTY_PILL = {
  Easy: 'bg-emerald-50 text-emerald-600',
  Medium: 'bg-amber-50 text-amber-600',
  Hard: 'bg-red-50 text-red-500',
};

function Pill({ children, className = '' }) {
  return <span className={`inline-flex items-center gap-1 text-[11px] font-bold rounded-md px-2 py-1 ${className}`}>{children}</span>;
}

// The bar reports the stage the task is genuinely at (Assigned -> Submitted -> Graded).
// A task here is completed by submitting work and having it graded, so there is no
// partial "70% done" to report — showing one would be inventing progress.
const STAGE_COLOR = {
  Assigned: 'from-gray-300 to-gray-300',
  Submitted: 'from-amber-400 to-amber-300',
  Graded: 'from-emerald-500 to-teal-400',
};

export function TaskCard({ task, person, index, selected, onOpen }) {
  const graded = task.status === 'graded';
  // A task belonging to a later day is real and dated, but not yet workable. It reads as
  // scheduled rather than locked — the learner has not failed a gate, the day just hasn't
  // arrived. Clicking it does nothing, so the card is not made to look clickable.
  const soon = task.notYetOpen;
  return (
    <BentoCard
      index={index}
      className={`flex flex-col transition-colors ${soon ? 'bg-slate-50/70' : 'cursor-pointer'} ${selected ? 'ring-2 ring-indigo-300 border-indigo-200' : ''}`}
      hover={!soon}
      onClick={soon ? undefined : onOpen}
    >
      <div className="flex items-start gap-3 mb-3">
        <div className={`w-10 h-10 rounded-xl shrink-0 flex items-center justify-center ${
          soon ? 'bg-slate-200'
          : graded ? 'bg-gradient-to-br from-emerald-500 to-teal-400'
          : 'bg-gradient-to-br from-indigo-500 to-indigo-400'}`}>
          {soon ? <CalendarClock size={18} className="text-slate-500" strokeWidth={2.2} />
            : graded ? <CheckCircle2 size={19} className="text-white" strokeWidth={2.2} />
            : <Database size={18} className="text-white" strokeWidth={2.2} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {task.dayIndex && (
              <Pill className={soon ? 'bg-slate-200 text-slate-600' : 'bg-slate-100 text-slate-600'}>Day {task.dayIndex}</Pill>
            )}
            {soon
              ? <Pill className="bg-white border border-slate-200 text-slate-500">Opens {task.opensLabel}</Pill>
              : <Pill className={PRIORITY_PILL[task.priority]}>{task.priorityLabel}</Pill>}
            {task.overdue && !soon && (
              <Pill className="bg-red-50 text-red-600"><AlertTriangle size={11} /> Overdue</Pill>
            )}
            {graded && <Pill className="bg-emerald-50 text-emerald-600">{task.score}%</Pill>}
          </div>
          <h3 className={`text-sm font-bold leading-snug ${soon ? 'text-slate-600' : ''}`}>{task.title}</h3>
        </div>
      </div>

      <div className="text-xs text-gray-500 space-y-1 mb-3">
        {task.projectTitle && (
          <div className="truncate">Project: <span className="font-semibold text-gray-700">{task.projectTitle}</span></div>
        )}
        {task.dueLabel && (
          <div>
            Due: <span className={`font-semibold ${task.overdue ? 'text-red-600' : 'text-gray-700'}`}>{task.dueLabel}</span>
          </div>
        )}
        {task.estHours ? (
          <div className="flex items-center gap-1"><Clock size={12} /> ~{task.estHours}h estimated</div>
        ) : null}
      </div>

      <div className="mb-3">
        <div className="flex items-baseline justify-between mb-1.5">
          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Stage</span>
          <span className="text-xs font-bold text-gray-700">{task.stage}</span>
        </div>
        <ProgressBar value={task.stagePct} max={100} colorClass={STAGE_COLOR[task.stage]} />
      </div>

      <div className="mt-auto flex items-center justify-between gap-3">
        {person ? (
          <div className="flex items-center gap-2 min-w-0">
            <Avatar name={person.name} avatarUrl={person.avatarUrl} size={26} />
            <span className="text-xs text-gray-500 truncate">{person.name}</span>
          </div>
        ) : <span />}
        {soon ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold rounded-lg px-3.5 py-2 shrink-0 bg-white border border-slate-200 text-slate-500">
            <CalendarClock size={13} /> Opens {task.opensLabel}
          </span>
        ) : (
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={(e) => { e.stopPropagation(); onOpen(); }}
            className={`inline-flex items-center gap-1.5 text-xs font-bold rounded-lg px-3.5 py-2 shrink-0 transition-colors ${
              graded ? 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'
            }`}
          >
            {graded ? 'View feedback' : 'Open task'} <ArrowRight size={13} />
          </motion.button>
        )}
      </div>
    </BentoCard>
  );
}

export function LockedTaskCard({ task, index }) {
  return (
    <BentoCard index={index} hover={false} className="flex flex-col bg-gray-50/60">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center bg-gray-200">
          <Lock size={18} className="text-gray-500" strokeWidth={2.2} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-0.5">Locked</div>
          <h3 className="text-sm font-bold leading-snug text-gray-600">{task.title}</h3>
        </div>
      </div>

      <p className="text-xs text-gray-400 leading-relaxed mb-3 line-clamp-2">{task.brief}</p>

      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 bg-white border border-gray-100 rounded-lg px-2.5 py-2 mb-3">
        <Lock size={12} className="shrink-0" />
        <span className="truncate">{task.requirement}</span>
      </div>

      <div className="mt-auto space-y-2">
        <div className="text-xs text-gray-400 truncate">Project: <span className="font-semibold text-gray-500">{task.projectTitle}</span></div>
        <div className="flex flex-wrap gap-1.5">
          <Pill className={`${DIFFICULTY_PILL[task.difficulty] || DIFFICULTY_PILL.Medium} opacity-80`}>{task.difficulty}</Pill>
          {task.estHours ? <Pill className="bg-white border border-gray-100 text-gray-500"><Clock size={11} /> ~{task.estHours}h</Pill> : null}
        </div>
      </div>
    </BentoCard>
  );
}
