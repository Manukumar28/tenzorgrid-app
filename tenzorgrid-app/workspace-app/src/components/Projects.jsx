import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, Award, Medal, Flame, Trophy, FolderOpen } from 'lucide-react';
import { BentoCard } from './ui.jsx';
import { SkillPointsBar } from './charts.jsx';
import { ActiveProjectCard, AvailableProjectCard, LockedProjectCard, CompletedProjectCard, money } from './projectCards.jsx';
import { api } from '../api.js';

const BADGE_ICON = {
  'first-delivery': Medal,
  'top-marks': Award,
  'streak-keeper': Flame,
  'full-sweep': Trophy,
};

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'available', label: 'Available' },
  { value: 'locked', label: 'Locked' },
  { value: 'completed', label: 'Completed' },
];

function FilterSelect({ label, value, onChange, options }) {
  const active = value !== '';
  return (
    <div className="relative inline-flex items-center">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className={`appearance-none text-xs font-semibold rounded-full pl-3.5 pr-8 py-1.5 cursor-pointer border transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-200 ${
          active ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
        }`}
      >
        <option value="">{label}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown size={13} className={`absolute right-2.5 pointer-events-none ${active ? 'text-indigo-500' : 'text-gray-400'}`} />
    </div>
  );
}

function SectionTitle({ children, count }) {
  return (
    <div className="flex items-baseline gap-2 mb-3.5">
      <h2 className="text-sm font-bold text-gray-700">{children}</h2>
      {count !== undefined && <span className="text-xs font-semibold text-gray-400">{count}</span>}
    </div>
  );
}

function Badge({ badge }) {
  const Icon = BADGE_ICON[badge.key] || Medal;
  return (
    <div className="relative group flex flex-col items-center gap-1.5">
      <div
        className={`w-14 h-14 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 ${
          badge.earned ? 'bg-gradient-to-br from-amber-400 to-orange-400 shadow-sm' : 'bg-gray-100'
        }`}
      >
        <Icon size={24} className={badge.earned ? 'text-white' : 'text-gray-300'} strokeWidth={2.1} />
      </div>
      <span className={`text-[10px] font-bold text-center leading-tight ${badge.earned ? 'text-gray-700' : 'text-gray-400'}`}>
        {badge.label}
      </span>
      <div className="absolute bottom-full mb-2 hidden group-hover:block z-10 w-40">
        <div className="bg-gray-900 text-white text-[11px] font-medium rounded-lg px-2.5 py-1.5 text-center leading-snug shadow-lg">
          {badge.note}
          {!badge.earned && <div className="text-gray-400 mt-0.5">Not earned yet</div>}
        </div>
      </div>
    </div>
  );
}

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

  async function startProject(key) {
    setStarting(key);
    setError(null);
    try {
      const res = await api.startProject(key);
      onStateChange(res.state);
    } catch (e) {
      setError(e.message);
    } finally {
      setStarting(null);
    }
  }

  const trackLabel = `${enrollment.level === 'senior' ? 'Senior' : 'Junior'} Data Analyst track`;

  return (
    <div className="space-y-6">
      {/* Title + metadata sub-bar */}
      <div>
        <div className="flex items-baseline gap-2.5 flex-wrap mb-3">
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Projects</h1>
          <span className="text-sm font-semibold text-gray-400">[{trackLabel}]</span>
        </div>

        <div className="flex items-center justify-between gap-4 flex-wrap border-y border-gray-100 py-2.5">
          <div className="flex items-center gap-x-5 gap-y-1 flex-wrap text-xs text-gray-500">
            <span>Active projects: <b className="text-gray-800">{data.activeCount}</b></span>
            <span className="text-gray-200">|</span>
            <span>Skill points gained: <b className="text-gray-800">{data.skillPointsTotal}</b></span>
            <span className="text-gray-200">|</span>
            <span>
              Top stakeholder:{' '}
              <b className="text-gray-800">{data.topStakeholder || '—'}</b>
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <FilterSelect label="By status" value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} />
            <FilterSelect label="By skill" value={skillFilter} onChange={setSkillFilter} options={skillOptions} />
            <FilterSelect label="By stakeholder" value={stakeholderFilter} onChange={setStakeholderFilter} options={stakeholderOptions} />
          </div>
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-2.5">{error}</div>
      )}

      {/* Section 1 — in progress */}
      {active.length > 0 && (
        <section>
          <SectionTitle count={active.length}>In progress</SectionTitle>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {active.map((p, i) => (
              <ActiveProjectCard
                key={p.key}
                project={p}
                person={personByArchetype[p.stakeholderArchetype]}
                index={i}
                onOpenTasks={() => onTab('tasks')}
              />
            ))}
          </div>
        </section>
      )}

      {/* Section 2 — discovery and archive */}
      {others.length > 0 && (
        <section>
          <SectionTitle count={others.length}>Discover &amp; archive</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
            {others.map((p, i) => {
              const person = personByArchetype[p.stakeholderArchetype];
              if (p.status === 'completed') return <CompletedProjectCard key={p.key} project={p} person={person} index={i} />;
              if (p.status === 'available') {
                return (
                  <AvailableProjectCard
                    key={p.key}
                    project={p}
                    person={person}
                    index={i}
                    starting={starting === p.key}
                    onStart={() => startProject(p.key)}
                  />
                );
              }
              return <LockedProjectCard key={p.key} project={p} person={person} index={i} />;
            })}
          </div>
        </section>
      )}

      {!visible.length && (
        <BentoCard hover={false} className="text-center py-10">
          <FolderOpen size={30} className="text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500 font-medium">
            {filtersOn ? 'No projects match these filters.' : 'No projects in this track yet.'}
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

      {/* Section 3 — analytics and achievements */}
      <section>
        <SectionTitle>Progress &amp; achievements</SectionTitle>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <BentoCard index={0}>
            <h3 className="text-base font-bold mb-0.5">Skill points earned</h3>
            <p className="text-xs text-gray-400 mb-2">From graded project tasks</p>
            <SkillPointsBar data={data.skillPoints} />
          </BentoCard>

          <BentoCard index={1} className="flex flex-col justify-center">
            <h3 className="text-base font-bold mb-3">Total project impact</h3>
            <div className="text-4xl font-extrabold text-gray-900 leading-none">{money(data.totalImpact)}</div>
            <p className="text-xs text-gray-500 mt-2.5 leading-relaxed">
              {data.completedCount > 0
                ? `Business impact from ${data.completedCount} completed project${data.completedCount === 1 ? '' : 's'}.`
                : 'Impact is banked when a project is delivered — nothing counted yet.'}
            </p>
          </BentoCard>

          <BentoCard index={2}>
            <h3 className="text-base font-bold mb-0.5">Achievements</h3>
            <p className="text-xs text-gray-400 mb-4">
              {data.badges.filter((b) => b.earned).length} of {data.badges.length} earned
            </p>
            <div className="grid grid-cols-4 gap-2">
              {data.badges.map((b) => <Badge key={b.key} badge={b} />)}
            </div>
          </BentoCard>
        </div>
      </section>
    </div>
  );
}
