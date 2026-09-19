import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, ChevronDown, FolderOpen, Sparkles, UserRound } from 'lucide-react';
import { BentoCard, StatTiles } from './ui.jsx';
import { SkillPointsBar } from './charts.jsx';
import { ActiveProjectCard, AvailableProjectCard, LockedProjectCard, CompletedProjectCard, money } from './projectCards.jsx';
import { api } from '../api.js';
import ProjectBrief from './ProjectBrief.jsx';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'available', label: 'Available' },
  { value: 'locked', label: 'Locked' },
  { value: 'completed', label: 'Completed' },
];

function FilterSelect({ label, value, onChange, options }) {
  const active = value !== '';
  return (
    // A fixed cap, not a percentage. A native select sizes itself to its widest OPTION, so
    // a learner with three projects made this 417px wide inside a 390px viewport and the
    // whole page scrolled sideways. `max-w-full` did nothing about it: the percentage
    // resolves against a containing block that is itself sized by its content. The chosen
    // label truncates; the dropdown still shows every option in full.
    <div className="relative inline-flex items-center min-w-0">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className={`appearance-none text-xs font-semibold rounded-full pl-3.5 pr-8 py-1.5 cursor-pointer border transition-colors max-w-[11rem] sm:max-w-[15rem] truncate focus:outline-none focus:ring-2 focus:ring-indigo-200 ${
          active ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
        }`}
      >
        <option value="">{label}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown size={13} className={`absolute right-2.5 pointer-events-none ${active ? 'text-indigo-600' : 'text-gray-500'}`} />
    </div>
  );
}

function SectionTitle({ children, count }) {
  return (
    <div className="flex items-baseline gap-2 mb-3.5">
      <h2 className="text-sm font-bold text-gray-700">{children}</h2>
      {count !== undefined && <span className="text-xs font-semibold text-gray-500">{count}</span>}
    </div>
  );
}

// The Badge component stood here: a gold-gradient tile per trophy, with a hover tip
// reading "Not earned yet". Four of them sat on this page — First Delivery, Top Marks,
// Streak Keeper, Full Sweep — while Experience.jsx opened with "Nothing here is a trophy
// case. There are no badges, no points and no comparison to anybody else." Both statements
// could not be true, and the one on the Experience page is the one this product means.
// Nothing in the engine ever read them.


export default function Projects({ state, onStateChange, onTab }) {
  const { projects: data, roster, enrollment } = state;
  const [statusFilter, setStatusFilter] = useState('');
  const [skillFilter, setSkillFilter] = useState('');
  const [stakeholderFilter, setStakeholderFilter] = useState('');
  const [starting, setStarting] = useState(null);
  const [error, setError] = useState(null);

  const personByArchetype = useMemo(
    () => Object.fromEntries(roster.map((p) => [p.archetype, p])),
    [roster],
  );

  // Filter options come from the catalog itself, so they can never offer a choice
  // that matches nothing.
  const skillOptions = useMemo(() => {
    const seen = new Map();
    for (const p of data.projects) for (const s of p.skillFocus) seen.set(s.axis, s.label);
    return [...seen].map(([value, label]) => ({ value, label }));
  }, [data.projects]);

  const stakeholderOptions = useMemo(() => {
    const seen = new Map();
    for (const p of data.projects) {
      const person = personByArchetype[p.stakeholderArchetype];
      if (person) seen.set(p.stakeholderArchetype, person.name);
    }
    return [...seen].map(([value, label]) => ({ value, label }));
  }, [data.projects, personByArchetype]);

  const visible = data.projects.filter((p) => {
    if (statusFilter && p.status !== statusFilter) return false;
    if (skillFilter && !p.skillFocus.some((s) => s.axis === skillFilter)) return false;
    if (stakeholderFilter && p.stakeholderArchetype !== stakeholderFilter) return false;
    return true;
  });

  const active = visible.filter((p) => p.status === 'active');
  const others = visible.filter((p) => p.status !== 'active');
  const filtersOn = statusFilter || skillFilter || stakeholderFilter;

  // Opening the brief IS the start flow — the actual start happens from inside the
  // document, once the learner has read the objective and the constraints.
  const [briefKey, setBriefKey] = useState(null);

  // The engine sends the real title for the role and level. Deriving it here got a Team
  // Lead and a Manager both labelled "Junior Data Analyst track" — the same bug that was
  // fixed in the header, still living in this one.
  const roleLabel = enrollment.levelTitle || 'Junior Data Analyst';

  return (
    <div className="space-y-6">
      {/* Title + metadata sub-bar */}
      <div>
        <div className="flex items-baseline gap-2.5 flex-wrap mb-3">
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Projects</h1>
          <span className="text-sm font-semibold text-gray-500">The initiatives your work belongs to, as a {roleLabel}</span>
        </div>

        <StatTiles items={[
          { key: 'active', label: 'Active', value: data.activeCount, sub: data.activeCount === 1 ? 'project underway' : 'projects underway', tone: 'indigo', icon: FolderOpen },
          { key: 'done', label: 'Completed', value: data.completedCount ?? 0, sub: 'signed off', tone: 'emerald', icon: CheckCircle2 },
          // The number is real -- it is the weighted skill attribution the engine records
          // on graded work -- but "points earned" is the wrong frame for a career signal.
          { key: 'points', label: 'Capability evidence', value: data.skillPointsTotal, sub: 'recorded across your work', tone: 'violet', icon: Sparkles },
          { key: 'who', label: 'Top stakeholder', value: (data.topStakeholder || '—').split(' ')[0], sub: data.topStakeholder ? 'raises most of your work' : 'nobody yet', tone: 'amber', icon: UserRound },
        ]} />

        <div className="flex items-center justify-end gap-4 flex-wrap pt-1">
          <div className="flex items-center gap-2 flex-wrap">
            <FilterSelect label="By status" value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} />
            <FilterSelect label="By skill" value={skillFilter} onChange={setSkillFilter} options={skillOptions} />
            <FilterSelect label="By stakeholder" value={stakeholderFilter} onChange={setStakeholderFilter} options={stakeholderOptions} />
          </div>
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-4 py-2.5">{error}</div>
      )}

      {/* Section 1 — in progress */}
      {active.length > 0 && (
        <section>
          <SectionTitle count={active.length}>In progress</SectionTitle>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {active.map((p, i) => (
              <ActiveProjectCard
                key={p.key}
                project={p}
                person={personByArchetype[p.stakeholderArchetype]}
                index={i}
                onOpenTasks={() => onTab('tasks')}
                onOpenBrief={() => setBriefKey(p.key)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Section 2 — discovery and archive */}
      {others.length > 0 && (
        <section>
          <SectionTitle count={others.length}>Discover &amp; archive</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
            {others.map((p, i) => {
              const person = personByArchetype[p.stakeholderArchetype];
              if (p.status === 'completed') return <CompletedProjectCard key={p.key} project={p} person={person} index={i} onOpenBrief={() => setBriefKey(p.key)} />;
              if (p.status === 'available') {
                return (
                  <AvailableProjectCard
                    key={p.key}
                    project={p}
                    person={person}
                    index={i}
                    starting={starting === p.key}
                    onStart={() => setBriefKey(p.key)}
                    onOpenBrief={() => setBriefKey(p.key)}
                  />
                );
              }
              return <LockedProjectCard key={p.key} project={p} person={person} index={i} onOpenBrief={() => setBriefKey(p.key)} />;
            })}
          </div>
        </section>
      )}

      {!visible.length && (
        <BentoCard hover={false} className="text-center py-10">
          <FolderOpen size={30} className="text-gray-500 mx-auto mb-3" />
          <p className="text-sm text-gray-500 font-medium">
            {filtersOn ? 'No projects match these filters.' : 'No projects at this level yet.'}
          </p>
          {filtersOn && (
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => { setStatusFilter(''); setSkillFilter(''); setStakeholderFilter(''); }}
              className="mt-3 text-xs font-bold text-indigo-600 hover:text-indigo-700"
            >
              Clear filters
            </motion.button>
          )}
        </BentoCard>
      )}

      {/* Section 3 — what the work adds up to */}
      <section>
        <SectionTitle>What the work adds up to</SectionTitle>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <BentoCard index={0}>
            {/* "Skill points earned ... from graded project tasks" is an XP counter. The
                data underneath is real -- which capabilities the work you have had signed
                off actually touched -- and that is what it now says. */}
            <h3 className="text-base font-bold mb-0.5">Where your work has been</h3>
            <p className="text-xs text-gray-500 mb-2">Weighted by the work Asha has signed off</p>
            <SkillPointsBar data={data.skillPoints} />
          </BentoCard>

          <BentoCard index={1} className="flex flex-col justify-center">
            {/* This said "Total project impact" over a four-times-bold pound figure, with
                "Business impact from 3 completed projects" underneath it, in a section
                headed "achievements". Read plainly, that is the product telling a learner
                they personally delivered £116,400 of value — and it is the exact sentence
                lib/vault.js REFUSES to write into an Experience entry, because the
                simulation never established any such outcome. One page cannot enforce a
                rule the next page breaks in bold.

                The figure itself is legitimate and worth keeping: a real project charter
                carries a value, and knowing the work you are on matters to the business is
                part of understanding a workplace. It belongs to the PROJECT. So it is
                framed as the project's worth, not as something the learner banked. */}
            <h3 className="text-base font-bold mb-3">What this work is worth to Meridian</h3>
            <div className="text-4xl font-extrabold text-gray-900 leading-none">{money(data.totalImpact)}</div>
            <p className="text-xs text-gray-500 mt-2.5 leading-relaxed">
              {data.completedCount > 0
                ? `The value the business put on the ${data.completedCount} project${data.completedCount === 1 ? '' : 's'} you have finished. It is what the work was worth to them, not a result you delivered.`
                : 'Each project carries a value to the business. This fills in as you finish them.'}
            </p>
          </BentoCard>
        </div>
      </section>

      {briefKey && (
        <ProjectBrief
          projectKey={briefKey}
          onClose={() => setBriefKey(null)}
          onStarted={(state) => onStateChange(state)}
        />
      )}
    </div>
  );
}
