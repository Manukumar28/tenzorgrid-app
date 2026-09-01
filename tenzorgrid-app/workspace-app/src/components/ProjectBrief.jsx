import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  X, Building2, UserRound, Clock, Target, ListChecks, AlertTriangle, Lock,
  Terminal, Database, Mail, MessagesSquare, FileCode2, Contact, ShieldCheck, Play,
} from 'lucide-react';
import { api } from '../api.js';

// Tool icons are named as strings by the backend registry (lib/projectdocs.js) so that
// file stays free of frontend imports. This is the one place the mapping lives.
const TOOL_ICON = {
  Terminal, Database, Mail, MessagesSquare, FileCode2, Contact,
};

function Section({ n, title, subtitle, children }) {
  return (
    <section className="border-t border-slate-200 pt-6 mt-6 first:border-0 first:pt-0 first:mt-0">
      <div className="flex items-baseline gap-3 mb-4">
        <span className="w-6 h-6 rounded-md bg-slate-900 text-white text-xs font-bold grid place-items-center shrink-0">{n}</span>
        <div>
          <h3 className="text-base font-extrabold text-slate-900 leading-tight">{title}</h3>
          {subtitle && <p className="text-xs text-slate-400 font-medium mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function Field({ icon: Icon, label, children }) {
  return (
    <div className="flex gap-3">
      {Icon && <Icon size={15} className="text-slate-400 mt-0.5 shrink-0" />}
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</div>
        <div className="text-sm text-slate-800 font-medium mt-0.5">{children}</div>
      </div>
    </div>
  );
}

const DIFFICULTY_TONE = {
  Easy: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Medium: 'bg-amber-50 text-amber-700 border-amber-200',
  Hard: 'bg-rose-50 text-rose-700 border-rose-200',
};

// A tool card. `status` is shown honestly — a planned tool is visibly greyed and
// labelled, because the whole point of the Resource Stack section is that a learner
// never goes hunting for something that isn't built yet.
function ToolCard({ tool }) {
  const Icon = TOOL_ICON[tool.icon] || Terminal;
  const live = tool.status === 'live';
  return (
    <div className={`rounded-xl border p-3 ${live ? 'border-slate-200 bg-white' : 'border-dashed border-slate-200 bg-slate-50/60'}`}>
      <div className="flex items-center gap-2.5">
        <span className={`w-8 h-8 rounded-lg grid place-items-center shrink-0 ${live ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
          <Icon size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <div className={`text-sm font-bold leading-tight ${live ? 'text-slate-900' : 'text-slate-400'}`}>{tool.label}</div>
          <div className="text-[11px] font-semibold mt-0.5">
            {live
              ? <span className="text-emerald-600">Available in this workspace</span>
              : <span className="text-slate-400">Not yet available</span>}
          </div>
        </div>
      </div>
      <p className={`text-xs mt-2 leading-relaxed ${live ? 'text-slate-600' : 'text-slate-400'}`}>{tool.summary}</p>
      {live && tool.detail && <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">{tool.detail}</p>}
    </div>
  );
}

// The pre-start project document. Everything here is authored content bound to a real
// dataset (see lib/projectdocs.js) — no fabricated metrics, and the tool list reflects
// what the app can actually do today.
export default function ProjectBrief({ projectKey, onClose, onStarted }) {
  const [brief, setBrief] = useState(null);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    let live = true;
    api.projectBrief(projectKey)
      .then((d) => { if (live) setBrief(d.brief); })
      .catch((e) => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [projectKey]);

  async function start() {
    setStarting(true);
    setError('');
    try {
      const d = await api.startProject(projectKey);
      onStarted && onStarted(d.state);
      onClose && onClose();
    } catch (e) {
      setError(e.message);
      setStarting(false);
    }
  }

  const doc = brief && brief.doc;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-start justify-center p-4 sm:p-8 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-auto"
      >
        <header className="flex items-start justify-between gap-4 p-6 pb-0">
          <div className="min-w-0">
            <div className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider mb-1">Project brief</div>
            <h2 className="text-xl font-extrabold text-slate-900 leading-tight">
              {doc ? doc.projectTitle : brief ? brief.title : 'Loading…'}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close project brief"
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 shrink-0"
          >
            <X size={18} />
          </button>
        </header>

        <div className="p-6">
          {error && <p className="text-sm text-rose-600 font-medium mb-4">{error}</p>}
          {!brief && !error && <p className="text-sm text-slate-400 font-medium">Loading the brief…</p>}

          {brief && !doc && (
            <p className="text-sm text-slate-500 font-medium">
              No detailed brief has been written for this project yet.
            </p>
          )}

          {doc && (
            <>
              {/* 1 — Executive summary: why this matters and what breaks if it goes wrong. */}
              <Section n="1" title="Executive Summary" subtitle="The context you are walking into">
                <div className="grid sm:grid-cols-2 gap-4 mb-4">
                  <Field icon={Building2} label="Company">
                    {doc.companyName}
                    <span className="block text-xs text-slate-400 font-normal mt-0.5">{doc.companyBlurb}</span>
                  </Field>
                  <Field icon={UserRound} label="Your role">{doc.yourRole}</Field>
                  <Field icon={Clock} label="Estimated time">{doc.estimatedMinutes} minutes</Field>
                  <Field icon={Target} label="Difficulty">
                    <span className={`inline-block px-2 py-0.5 rounded-md border text-xs font-bold ${DIFFICULTY_TONE[brief.difficulty] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                      {brief.difficulty}
                    </span>
                  </Field>
                </div>

                <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">The scenario</div>
                  <p className="text-sm text-slate-700 leading-relaxed">{doc.scenario}</p>
                </div>

                <div className="mt-4">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Your responsibilities</div>
                  <ul className="space-y-1.5">
                    {doc.roleResponsibilities.map((r, i) => (
                      <li key={i} className="flex gap-2.5 text-sm text-slate-700 leading-relaxed">
                        <ShieldCheck size={14} className="text-indigo-500 mt-1 shrink-0" />
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Section>

              {/* 2 — What must actually be produced. */}
              <Section n="2" title="Objectives & Deliverables" subtitle="What you must produce to pass">
                <div className="rounded-xl border-2 border-indigo-100 bg-indigo-50/50 p-4 mb-4">
                  <div className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider mb-1.5">Primary objective</div>
                  <p className="text-sm text-slate-800 font-semibold leading-relaxed">{doc.primaryObjective}</p>
                </div>

                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Constraints</div>
                <div className="space-y-2 mb-5">
                  {doc.constraints.map((c, i) => (
                    <div key={i} className="flex gap-3 text-sm">
                      <span className="text-slate-500 font-bold w-28 shrink-0">{c.label}</span>
                      <span className="text-slate-700 flex-1">{c.value}</span>
                    </div>
                  ))}
                </div>

                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Required deliverables</div>
                <ol className="space-y-2 mb-5">
                  {doc.deliverables.map((d, i) => (
                    <li key={i} className="flex gap-3 text-sm text-slate-700">
                      <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-600 text-[11px] font-bold grid place-items-center shrink-0 mt-px">{i + 1}</span>
                      <span className="leading-relaxed">{d.text}</span>
                    </li>
                  ))}
                </ol>

                {doc.watchOutFor && doc.watchOutFor.length > 0 && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle size={14} className="text-amber-600" />
                      <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Watch out for</span>
                    </div>
                    <ul className="space-y-1.5">
                      {doc.watchOutFor.map((w, i) => (
                        <li key={i} className="text-xs text-amber-900 leading-relaxed flex gap-2">
                          <span className="text-amber-400 shrink-0">•</span><span>{w}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Section>

              {/* 3 — Exactly which tools exist, so nobody hunts for one that doesn't. */}
              <Section n="3" title="The Resource Stack" subtitle="Tools authorized for this project">
                <div className="grid sm:grid-cols-2 gap-3">
                  {doc.tools.map((t) => <ToolCard key={t.key} tool={t} />)}
                </div>
                {doc.plannedTools.length > 0 && (
                  <p className="text-xs text-slate-400 mt-3 leading-relaxed">
                    {doc.plannedTools.length === 1 ? 'One tool listed above is' : `${doc.plannedTools.length} tools listed above are`}{' '}
                    still being built. You can complete this project without{' '}
                    {doc.plannedTools.length === 1 ? 'it' : 'them'} — it is listed so you know what the full brief would involve.
                  </p>
                )}
              </Section>

              {/* Tasks in this project */}
              <Section n="4" title="Work Breakdown" subtitle="The tasks that make up this project">
                <div className="space-y-2">
                  {brief.tasks.map((t) => (
                    <div key={t.taskKey} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold text-slate-800">{t.title}</div>
                        <div className="text-[11px] text-slate-400 font-medium mt-0.5">
                          {t.estHours ? `~${t.estHours}h` : 'Unestimated'} · {t.priority} priority
                        </div>
                      </div>
                      <span className={`text-[11px] font-bold px-2 py-1 rounded-md shrink-0 ${
                        t.status === 'graded' ? 'bg-emerald-50 text-emerald-700'
                          : t.status === 'not-started' ? 'bg-slate-100 text-slate-500'
                          : 'bg-indigo-50 text-indigo-700'}`}>
                        {t.status === 'graded' ? `Graded · ${t.score}` : t.status === 'not-started' ? 'Not started' : t.status}
                      </span>
                    </div>
                  ))}
                </div>
              </Section>
            </>
          )}
        </div>

        {brief && (
          <footer className="flex items-center justify-between gap-4 border-t border-slate-200 p-5 bg-slate-50/60 rounded-b-2xl">
            {!brief.unlocked ? (
              <p className="text-xs text-slate-500 font-medium flex items-center gap-2">
                <Lock size={14} className="text-slate-400" />
                Unlocks after {brief.unlockAfter} graded task{brief.unlockAfter === 1 ? '' : 's'} — you have {brief.gradedCount}.
              </p>
            ) : brief.started ? (
              <p className="text-xs text-emerald-700 font-semibold">You have already started this project.</p>
            ) : (
              <p className="text-xs text-slate-500 font-medium">Read the brief, then start when you're ready.</p>
            )}

            <button
              onClick={start}
              disabled={!brief.unlocked || brief.started || starting}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              <Play size={14} />
              {starting ? 'Starting…' : brief.started ? 'In progress' : 'Start project'}
            </button>
          </footer>
        )}
      </motion.div>
    </div>
  );
}
