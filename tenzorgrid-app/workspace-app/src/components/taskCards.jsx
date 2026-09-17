import React from 'react';
import { motion } from 'framer-motion';
import { Database, Lock, Clock, ArrowRight, CheckCircle2, AlertTriangle, CalendarClock, FlaskConical } from 'lucide-react';
import { BentoCard, ProgressBar, Avatar } from './ui.jsx';

// Keyed on every spelling the task definitions actually use, not just the three the
// filter dropdown offers. A task marked `urgent` or `normal` used to fall through to
// undefined here and render an unstyled, unlabelled pill.
export const PRIORITY_PILL = {
  urgent: 'bg-red-600 text-white',
  high: 'bg-red-600 text-white',
  medium: 'bg-amber-700 text-white',
  normal: 'bg-amber-700 text-white',
  low: 'bg-emerald-700 text-white',
};

// DIFFICULTY_PILL lived here. "Medium" and "Hard" are curriculum words: the engine
// still sequences on difficulty and the graders still use it, but a colleague asking you
// for a number does not grade the request first.

function Pill({ children, className = '' }) {
  return <span className={`inline-flex items-center gap-1 text-[12px] font-bold rounded-md px-2 py-1 ${className}`}>{children}</span>;
}

// The bar reports the stage the task is genuinely at (Assigned -> Submitted -> Graded).
// A task here is completed by submitting work and having it graded, so there is no
// partial "70% done" to report — showing one would be inventing progress.
const STAGE_COLOR = {
  Assigned: 'from-gray-300 to-gray-300',
  Submitted: 'from-amber-400 to-amber-300',
  Graded: 'from-emerald-500 to-teal-400',
};

export function TaskCard({ task, person, index, selected, onOpen, onTestComplete }) {
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
      {onTestComplete && !graded && (
        <button
          onClick={(e) => { e.stopPropagation(); onTestComplete(task.id); }}
          aria-label={`Mark "${task.title}" done for testing`}
          title="Testing only — marks this done without grading it"
          className="self-start mb-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 border border-amber-300 text-amber-800 text-[12px] font-extrabold uppercase tracking-wide hover:bg-amber-100"
        >
          <FlaskConical size={11} /> Mark done
        </button>
      )}
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
            {task.sentBack && (
              <Pill className={task.sentBack === 'rework'
                ? 'bg-violet-100 text-violet-700'
                : 'bg-amber-100 text-amber-800'}>
                {task.sentBack === 'rework' ? 'Do it differently' : 'Sent back'}
              </Pill>
            )}
            {task.overdue && !soon && (
              <Pill className="bg-red-50 text-red-700"><AlertTriangle size={11} /> Overdue</Pill>
            )}
            {graded && <Pill className="bg-emerald-50 text-emerald-700">{task.score}%</Pill>}
          </div>
          <h3 className={`text-sm font-bold leading-snug ${soon ? 'text-slate-600' : ''}`}>{task.title}</h3>
        </div>
      </div>

      {/* Who asked, and what for. The card used to lead with "Medium" and "~0.4h
          estimated" -- an estimate is a workplace fact and stays, but difficulty is a
          curriculum word and does not belong on a request from a colleague.

          The requester carries the avatar. It used to sit in the footer showing the
          project's stakeholder for every card, so a card reading "From Asha Rao" was
          signed off with Vikram's face. One person per card, and it is the one who
          asked. */}
      <div className="text-xs text-gray-500 space-y-1 mb-3">
        {task.assignment && task.assignment.requestedBy && (
          <div className="flex items-center gap-2 min-w-0">
            <Avatar
              name={task.assignment.requestedBy}
              avatarUrl={person && person.name === task.assignment.requestedBy ? person.avatarUrl : null}
              size={22}
            />
            <span className="truncate">
              {task.assignment.fromTheLine ? 'From' : 'For'}{' '}
              <span className="font-semibold text-gray-700">{task.assignment.requestedBy}</span>
              {task.assignment.requestedByTitle && (
                <span className="text-gray-400"> · {task.assignment.requestedByTitle}</span>
              )}
            </span>
          </div>
        )}
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
          <span className="text-[12px] font-bold text-gray-500 uppercase tracking-wide">Stage</span>
          <span className="text-xs font-bold text-gray-700">{task.stage}</span>
        </div>
        <ProgressBar value={task.stagePct} max={100} colorClass={STAGE_COLOR[task.stage]} />
      </div>

      <div className="mt-auto flex items-center justify-end gap-3">
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
          <div className="text-[12px] font-bold uppercase tracking-wide text-gray-500 mb-0.5">Locked</div>
          <h3 className="text-sm font-bold leading-snug text-gray-600">{task.title}</h3>
        </div>
      </div>

      <p className="text-xs text-gray-500 leading-relaxed mb-3 line-clamp-2">{task.brief}</p>

      <div className="flex items-center gap-1.5 text-[12px] font-semibold text-gray-500 bg-white border border-gray-100 rounded-lg px-2.5 py-2 mb-3">
        <Lock size={12} className="shrink-0" />
        <span className="truncate">{task.requirement}</span>
      </div>

      <div className="mt-auto space-y-2">
        <div className="text-xs text-gray-500 truncate">Project: <span className="font-semibold text-gray-500">{task.projectTitle}</span></div>
        <div className="flex flex-wrap gap-1.5">
          {task.estHours ? <Pill className="bg-white border border-gray-100 text-gray-500"><Clock size={11} /> ~{task.estHours}h</Pill> : null}
        </div>
      </div>
    </BentoCard>
  );
}
