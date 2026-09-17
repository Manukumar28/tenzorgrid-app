import React from 'react';
import { ArrowLeft, Clock3, CircleDot } from 'lucide-react';
import { iconFor } from '../lib/apps.js';
import { Avatar } from './ui.jsx';

// The chrome an application wears.
//
// Deliberately thin. It does not repeat the company navigation -- the rail is three
// inches to the left and duplicating it inside every tool is how an interface starts
// competing with itself. What it does carry is the two things you lose when you drop into
// a tool and cannot get back on your own: which company's tool this is, and WHY you are
// in it.
//
// That second one is the whole point of the context bar. An analyst three queries deep
// into a schema has forgotten who asked and when it is due, and a workbench that cannot
// answer those is a SQL exercise with a company logo on it.

const STATE_STYLE = {
  Draft: 'bg-slate-100 text-slate-600 border-slate-200',
  'In progress': 'bg-sky-50 text-sky-700 border-sky-200',
  Submitted: 'bg-violet-50 text-violet-700 border-violet-200',
  'Under review': 'bg-violet-50 text-violet-700 border-violet-200',
  Returned: 'bg-rose-50 text-rose-700 border-rose-200',
  Approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

// The engine's own review state, in the words a workplace uses. Nothing here invents a
// transition: every branch reads a field the task already carries.
export function workStateOf(task) {
  if (!task) return 'Draft';
  if (task.status === 'graded') return 'Approved';
  if (task.reviewState === 'pending') return 'Under review';
  if (task.sentBack) return 'Returned';
  if (task.status === 'submitted') return 'Submitted';
  if (task.stagePct > 0) return 'In progress';
  return 'Draft';
}

function ContextField({ label, children }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-bold tracking-[0.1em] text-slate-400 uppercase">{label}</div>
      <div className="text-[12px] font-semibold text-slate-200 truncate mt-0.5">{children}</div>
    </div>
  );
}

export default function AppShell({
  app, company, task, requestedBy, reviewer, onBack, backLabel = 'My Work', right, children,
}) {
  const Icon = iconFor(app);
  const state = workStateOf(task);

  return (
    <div className="rounded-2xl border border-slate-800 overflow-hidden bg-white">
      {/* Application bar. Dark, because a tool is a different surface from a page, and
          the change of surface is what tells you that you have entered one. */}
      <div className="bg-slate-900 text-white">
        <div className="flex items-center gap-3 px-3.5 py-2.5 flex-wrap">
          <button
            onClick={onBack}
            className="shrink-0 inline-flex items-center gap-1.5 px-2 py-1 -ml-1 rounded-lg text-[12px] font-semibold text-slate-300
                       hover:text-white hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          >
            <ArrowLeft size={14} /> {backLabel}
          </button>

          <span className="w-px h-5 bg-slate-700 shrink-0" aria-hidden="true" />

          <span className="shrink-0 w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center">
            <Icon size={15} />
          </span>
          <span className="min-w-0">
            <span className="block text-[13px] font-bold leading-tight truncate">{app ? app.name : 'Workspace'}</span>
            {company && (
              <span className="block text-[10px] text-slate-400 leading-tight truncate">{company.name}</span>
            )}
          </span>

          <span className="ml-auto flex items-center gap-2 shrink-0">
            {right}
            <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold rounded-full border px-2 py-0.5 ${
              STATE_STYLE[state] || STATE_STYLE.Draft}`}>
              <CircleDot size={10} /> {state}
            </span>
          </span>
        </div>

        {/* Why you are here. Everything on this strip comes off the task, the project and
            the roster -- no names are written into this component. */}
        {task && (
          <div className="px-3.5 pb-3 pt-1 border-t border-slate-800/80">
            <div className="text-[14px] font-bold leading-snug">{task.title}</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-5 gap-y-2 mt-2.5">
              {task.projectTitle && <ContextField label="Project">{task.projectTitle}</ContextField>}
              {requestedBy && (
                <ContextField label="Requested by">
                  <span className="inline-flex items-center gap-1.5">
                    <Avatar name={requestedBy.name} avatarUrl={requestedBy.avatarUrl} size={16} />
                    {requestedBy.name}
                  </span>
                </ContextField>
              )}
              {reviewer && (
                <ContextField label="Reviewer">
                  <span className="inline-flex items-center gap-1.5">
                    <Avatar name={reviewer.name} avatarUrl={reviewer.avatarUrl} size={16} />
                    {reviewer.name}
                  </span>
                </ContextField>
              )}
              {task.dueLabel && (
                <ContextField label="Due">
                  <span className={`inline-flex items-center gap-1.5 ${task.overdue ? 'text-rose-300' : ''}`}>
                    <Clock3 size={12} /> {task.dueLabel}
                  </span>
                </ContextField>
              )}
            </div>
          </div>
        )}
      </div>

      {children}
    </div>
  );
}
