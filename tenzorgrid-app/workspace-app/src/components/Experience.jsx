import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookMarked, ChevronRight, X, Quote, ShieldCheck } from 'lucide-react';
import { BentoCard } from './ui.jsx';
import { api } from '../api.js';

// The experience record.
//
// A small number of professional stories, not a log. Each one is assembled from rows that
// exist and carries the evidence behind it, so a learner can see WHY the system says they
// did something -- which is the whole basis for trusting it enough to talk about in an
// interview.
//
// Nothing here is a trophy case. There are no badges, no points and no comparison to
// anybody else; the page is a record of work, and the fact that the work was simulated is
// stated plainly rather than buried.

const KIND_LABEL = {
  project: 'Project delivery',
  recovery: 'Recovered work',
  stakeholder: 'Stakeholder change',
  escalation: 'Escalation judgement',
  leadership: 'Leading the work',
};

const KIND_TONE = {
  project: 'bg-slate-100 text-slate-700',
  recovery: 'bg-amber-100 text-amber-800',
  stakeholder: 'bg-violet-100 text-violet-800',
  escalation: 'bg-sky-100 text-sky-800',
  leadership: 'bg-emerald-100 text-emerald-800',
};

const CAPABILITY_LABEL = {
  sql: 'SQL and querying', python: 'Analysis in Python', dataViz: 'Data visualisation',
  communication: 'Stakeholder communication', businessLogic: 'Business judgement',
  coaching: 'Coaching and review', delivery: 'Delivery and ownership',
};

function periodLabel(from, to) {
  if (!from) return null;
  const f = new Date(`${from}T00:00:00Z`);
  const fmt = (d) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  if (!to || to === from) return fmt(f);
  return `${fmt(f)} – ${fmt(new Date(`${to}T00:00:00Z`))}`;
}

function Detail({ entry, onClose }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6"
      role="dialog" aria-label={entry.title}>
      <motion.div
        initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-2xl bg-white shadow-2xl"
      >
        <div className="sticky top-0 flex items-start gap-3 px-5 py-3.5 border-b border-slate-200 bg-slate-50 z-10">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-extrabold text-slate-900 leading-snug">{entry.title}</p>
            <p className="text-[12px] text-slate-500">
              {[entry.project, periodLabel(entry.from, entry.to)].filter(Boolean).join(' · ')}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close"
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400">
            <X size={16} />
          </button>
        </div>

        {/* Deliberately not labelled Situation / Task / Action / Result. The structure
            underneath supports that conversion for a later interview tool, but nobody
            wants their own work history presented as an interview-prep worksheet. */}
        {[['Context', entry.context], ['Your responsibility', entry.responsibility]].map(([label, body]) => body && (
          <div key={label} className="px-5 py-4 border-b border-slate-100">
            <div className="text-[10px] font-bold tracking-[0.12em] text-slate-400 uppercase mb-1.5">{label}</div>
            <p className="text-sm text-slate-700 leading-relaxed">{body}</p>
          </div>
        ))}

        {(entry.actions || []).length > 0 && (
          <div className="px-5 py-4 border-b border-slate-100">
            <div className="text-[10px] font-bold tracking-[0.12em] text-slate-400 uppercase mb-1.5">What you did</div>
            <ul className="space-y-1.5">
              {entry.actions.map((a, i) => (
                <li key={i} className="text-sm text-slate-700 leading-relaxed flex gap-2">
                  <span className="text-slate-300 shrink-0">•</span><span>{a}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {entry.outcome && (
          <div className="px-5 py-4 border-b border-slate-100">
            <div className="text-[10px] font-bold tracking-[0.12em] text-slate-400 uppercase mb-1.5">Outcome</div>
            <p className="text-sm text-slate-700 leading-relaxed">{entry.outcome}</p>
          </div>
        )}

        {/* Why this entry exists. Showing the working is what makes the record credible
            rather than something the product asserts about you. */}
        {(entry.evidence || []).length > 0 && (
          <div className="px-5 py-4 border-b border-slate-100">
            <div className="text-[10px] font-bold tracking-[0.12em] text-slate-400 uppercase mb-1.5">Evidence</div>
            <ul className="space-y-2">
              {entry.evidence.map((e, i) => (
                <li key={i}>
                  <p className="text-[13px] font-semibold text-slate-800 leading-snug">{e.what}</p>
                  {e.detail && <p className="text-[12px] text-slate-500 leading-snug mt-0.5">{e.detail}</p>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Both of these arrive attributed now -- {text, voice, attribution} rather than a
            bare string -- so whose sentence this is travels with the sentence instead of
            being implied by which box it landed in. See lib/vault.js §26. */}
        {entry.managerObservation && (
          <div className="px-5 py-4 border-b border-slate-100">
            <div className="text-[10px] font-bold tracking-[0.12em] text-slate-400 uppercase mb-1.5">What your manager said</div>
            <p className="text-sm text-slate-700 leading-relaxed">{entry.managerObservation.text}</p>
          </div>
        )}

        {/* Kept visibly the learner's own words. The product does not treat what somebody
            wrote about themselves as a fact it asserts on their behalf. */}
        {entry.reflection && (
          <div className="px-5 py-4 border-b border-slate-100">
            <div className="text-[10px] font-bold tracking-[0.12em] text-slate-400 uppercase mb-1.5">
              {entry.reflection.attribution}
            </div>
            <div className="flex gap-2">
              <Quote size={13} className="text-slate-300 shrink-0 mt-1" />
              <p className="text-sm text-slate-600 leading-relaxed italic">{entry.reflection.text}</p>
            </div>
          </div>
        )}

        {(entry.capabilities || []).length > 0 && (
          <div className="px-5 py-4">
            <div className="text-[10px] font-bold tracking-[0.12em] text-slate-400 uppercase mb-2">What this demonstrates</div>
            <div className="flex flex-wrap gap-1.5">
              {entry.capabilities.map((c) => (
                <span key={c} className="text-[12px] font-semibold rounded-md px-2 py-1 bg-indigo-50 text-indigo-800">
                  {CAPABILITY_LABEL[c] || c}
                </span>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

export default function Experience({ state }) {
  const [index, setIndex] = useState(null);
  const [open, setOpen] = useState(null);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    api.getExperience().then((r) => { if (live) setIndex(r.experience); })
      .catch((e) => { if (live) setError(e.message); });
    return () => { live = false; };
  }, []);

  const entries = (index && index.entries) || [];
  // Grouped by the project each piece of work belongs to. A flat grid is fine at six
  // entries and a wall at thirty, and "which project was that on" is the question somebody
  // actually asks of their own history. Within a group the strongest entry leads; the
  // groups themselves run newest first. See lib/vault.js §27/§28.
  const groups = (index && index.groups) || [];
  const shownGroups = filter ? groups.filter((g) => g.title === filter) : groups;
  const projects = useMemo(
    () => [...new Set(groups.map((g) => g.title).filter(Boolean))],
    [groups],
  );

  async function openEntry(key) {
    try {
      const r = await api.getExperience(key);
      setOpen(r.experience);
    } catch (e) { setError(e.message); }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-baseline gap-2.5 flex-wrap">
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Experience</h1>
        <span className="text-sm font-semibold text-slate-500">
          The work you have done, and the evidence behind it
        </span>
        {entries.length > 0 && (
          <span className="text-sm text-slate-400">
            {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
            {projects.length > 1 ? ` across ${projects.length} projects` : ''}
          </span>
        )}
      </div>

      {/* Said plainly and near the top rather than in a footer. This is simulated
          professional experience; a learner should never be in any doubt about that, and
          neither should anything they later export. */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 flex items-start gap-2.5">
        <ShieldCheck size={15} className="text-slate-400 shrink-0 mt-0.5" />
        <p className="text-[13px] text-slate-600 leading-snug">
          <b className="text-slate-800 font-semibold">Professional simulation experience.</b>{' '}
          This is a record of work you did inside the TenzorGrid simulation at Meridian Analytics —
          realistic professional experience, not paid employment.
        </p>
      </div>

      {error && <p className="text-sm text-rose-700">{error}</p>}

      {index === null && !error && <p className="text-sm text-slate-500">Loading…</p>}

      {index !== null && entries.length === 0 && (
        <BentoCard hover={false} className="text-center py-10">
          <BookMarked size={26} className="text-slate-400 mx-auto mb-3" />
          <p className="text-sm text-slate-600 font-medium">Nothing here yet.</p>
          <p className="text-[13px] text-slate-500 mt-1">
            Your first entry is written when you finish a project.
          </p>
        </BentoCard>
      )}

      {projects.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setFilter('')}
            className={`text-[12px] font-bold rounded-lg px-2.5 py-1.5 border ${
              !filter ? 'border-indigo-300 bg-indigo-50 text-indigo-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            All
          </button>
          {projects.map((p) => (
            <button key={p} onClick={() => setFilter(p)}
              className={`text-[12px] font-bold rounded-lg px-2.5 py-1.5 border ${
                filter === p ? 'border-indigo-300 bg-indigo-50 text-indigo-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              {p}
            </button>
          ))}
        </div>
      )}

      {shownGroups.map((group) => (
      <section key={group.key} className="space-y-3">
        {groups.length > 1 && (
          <div className="flex items-baseline gap-2.5 flex-wrap border-b border-slate-200 pb-1.5">
            <h2 className="text-[15px] font-extrabold text-slate-800 tracking-tight">{group.title}</h2>
            <span className="text-[12px] text-slate-400">
              {periodLabel(group.from, group.to)}
              {' · '}
              {group.entries.length} {group.entries.length === 1 ? 'entry' : 'entries'}
            </span>
          </div>
        )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
        {group.entries.map((e, i) => (
          <BentoCard key={e.key} index={i} onClick={() => openEntry(e.key)} className="cursor-pointer flex flex-col">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className={`text-[11px] font-extrabold uppercase tracking-wide rounded px-1.5 py-0.5 ${KIND_TONE[e.kind] || 'bg-slate-100 text-slate-700'}`}>
                {KIND_LABEL[e.kind] || e.kind}
              </span>
              {periodLabel(e.from, e.to) && (
                <span className="text-[12px] text-slate-400">{periodLabel(e.from, e.to)}</span>
              )}
            </div>
            <h3 className="text-sm font-bold text-slate-900 leading-snug">{e.title}</h3>
            {e.project && groups.length <= 1 && (
              <p className="text-[12px] text-slate-500 mt-0.5">{e.project}</p>
            )}
            {/* The card carries the outcome only. The full story is one click away --
                a list of giant cards is not a record, it is a wall. */}
            {e.outcome && (
              <p className="text-[13px] text-slate-600 leading-relaxed mt-2 line-clamp-2">{e.outcome}</p>
            )}
            <div className="mt-auto pt-3 flex items-center justify-between gap-3">
              <div className="flex flex-wrap gap-1">
                {(e.capabilities || []).slice(0, 2).map((c) => (
                  <span key={c} className="text-[11px] font-semibold rounded px-1.5 py-0.5 bg-indigo-50 text-indigo-800">
                    {CAPABILITY_LABEL[c] || c}
                  </span>
                ))}
              </div>
              <span className="inline-flex items-center gap-1 text-[12px] font-bold text-indigo-700 shrink-0">
                Open <ChevronRight size={13} />
              </span>
            </div>
          </BentoCard>
        ))}
      </div>
      </section>
      ))}

      <AnimatePresence>
        {open && <Detail entry={open} onClose={() => setOpen(null)} />}
      </AnimatePresence>
    </div>
  );
}
