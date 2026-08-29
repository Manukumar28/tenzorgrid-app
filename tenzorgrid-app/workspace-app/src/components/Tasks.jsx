import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, ClipboardCheck, Users, Gauge } from 'lucide-react';
import { BentoCard, Avatar } from './ui.jsx';
import { Sparkline, TaskHealthDonut, TaskVelocityBar } from './charts.jsx';
import { TaskCard, LockedTaskCard, PRIORITY_PILL } from './taskCards.jsx';
import { api } from '../api.js';

const PRIORITY_OPTIONS = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];
const SORT_OPTIONS = [
  { value: 'due', label: 'Due date' },
  { value: 'priority', label: 'Priority' },
  { value: 'title', label: 'Title' },
];
const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };

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

// The submission workspace — unchanged in substance from the original Tasks tab, because
// this is the actual completion path: work is submitted, graded, and only then done.
function TaskWorkspace({ task, onStateChange }) {
  const [sql, setSql] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { setSql(''); setError(''); }, [task.id]);

  async function submit() {
    setBusy(true);
    setError('');
    try {
      const data = await api.submitTask(task.id, sql);
      onStateChange(data.state);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <BentoCard hover={false}>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
        <div className="min-w-0">
          <h3 className="text-base font-bold">{task.title}</h3>
          {task.projectTitle && <p className="text-xs text-gray-400 mt-0.5">{task.projectTitle}</p>}
        </div>
        <span className={`inline-flex text-[11px] font-bold rounded-md px-2 py-1 ${PRIORITY_PILL[task.priority]}`}>{task.priorityLabel}</span>
      </div>

      <p className="text-sm text-gray-600 leading-relaxed mb-4">{task.brief}</p>

      {task.status === 'graded' ? (
        <div className="bg-emerald-50 border border-emerald-100 rounded-lg px-4 py-3.5">
          <div className="text-emerald-700 font-bold text-sm mb-1.5">Score: {task.score}/100</div>
          <div className="text-sm text-emerald-900 whitespace-pre-wrap leading-relaxed">{task.feedback}</div>
        </div>
      ) : (
        <>
          <p className="text-xs text-gray-400 mb-2">This task's tool: SQL editor. Write your query below and submit it for grading.</p>
          <textarea
            value={sql}
            onChange={(e) => setSql(e.target.value)}
            rows={6}
            placeholder="SELECT ..."
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 font-mono text-sm mb-3 resize-y focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
          {error && <div className="text-red-600 text-xs bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-3">{error}</div>}
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={submit}
            disabled={busy || !sql.trim()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? 'Submitting…' : 'Submit for grading'}
          </motion.button>
        </>
      )}
    </BentoCard>
  );
}

export default function Tasks({ state, onStateChange }) {
  const { taskBoard, roster, projects } = state;
  const [priorityFilter, setPriorityFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [sortBy, setSortBy] = useState('due');
  const [selectedId, setSelectedId] = useState(null);

  const personByArchetype = useMemo(
    () => Object.fromEntries(roster.map((p) => [p.archetype, p])),
    [roster],
  );
  const stakeholderByProject = useMemo(
    () => Object.fromEntries(projects.projects.map((p) => [p.key, personByArchetype[p.stakeholderArchetype]])),
    [projects.projects, personByArchetype],
  );

  const projectOptions = useMemo(() => {
    const seen = new Map();
    for (const r of taskBoard.rows) if (r.projectKey) seen.set(r.projectKey, r.projectTitle);
    return [...seen].map(([value, label]) => ({ value, label }));
  }, [taskBoard.rows]);

  // Default to the most urgent open task so the workspace is never empty on arrival.
  useEffect(() => {
    if (selectedId && taskBoard.rows.some((r) => r.id === selectedId)) return;
    const open = taskBoard.rows.find((r) => r.status !== 'graded');
    setSelectedId((open || taskBoard.rows[taskBoard.rows.length - 1] || {}).id || null);
  }, [taskBoard.rows, selectedId]);

  const visible = useMemo(() => {
    const list = taskBoard.rows.filter((r) => {
      if (priorityFilter && r.priority !== priorityFilter) return false;
      if (projectFilter && r.projectKey !== projectFilter) return false;
      return true;
    });
    const sorted = [...list];
    if (sortBy === 'priority') sorted.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
    else if (sortBy === 'title') sorted.sort((a, b) => a.title.localeCompare(b.title));
    else sorted.sort((a, b) => (a.dueAt || '9999').localeCompare(b.dueAt || '9999'));
    return sorted;
  }, [taskBoard.rows, priorityFilter, projectFilter, sortBy]);

  const lockedVisible = priorityFilter || projectFilter ? [] : taskBoard.locked;
  const selected = taskBoard.rows.find((r) => r.id === selectedId);
  const filtersOn = priorityFilter || projectFilter;
  const { counts, health, velocity, onTimeRate, trend, taskSources } = taskBoard;

  return (
    <div className="space-y-6">
      {/* Title + metric sub-bar */}
      <div>
        <div className="flex items-baseline gap-2.5 flex-wrap mb-3">
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Tasks</h1>
          <span className="text-sm font-semibold text-gray-400">[Focus on deadlines]</span>
        </div>

        <div className="flex items-center justify-between gap-4 flex-wrap border-y border-gray-100 py-2.5">
          <div className="flex items-center gap-x-5 gap-y-1 flex-wrap text-xs text-gray-500">
            <span>My open tasks: <b className="text-gray-800">{counts.open}</b></span>
            <span className="text-gray-200">|</span>
            <span>Due today: <b className="text-gray-800">{counts.dueToday}</b></span>
            <span className="text-gray-200">|</span>
            <span>High priority: <b className="text-gray-800">{counts.highPriority}</b></span>
            {counts.overdue > 0 && (
              <>
                <span className="text-gray-200">|</span>
                <span className="text-red-600 font-semibold">Overdue: {counts.overdue}</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <FilterSelect label="Priority" value={priorityFilter} onChange={setPriorityFilter} options={PRIORITY_OPTIONS} />
            <FilterSelect label="Project" value={projectFilter} onChange={setProjectFilter} options={projectOptions} />
            <FilterSelect label="Sort" value={sortBy === 'due' ? '' : sortBy} onChange={(v) => setSortBy(v || 'due')} options={SORT_OPTIONS} />
          </div>
        </div>
      </div>

      {/* Section 1 — task grid */}
      <section>
        <SectionTitle count={visible.length + lockedVisible.length}>Your tasks</SectionTitle>
        {visible.length || lockedVisible.length ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {visible.map((t, i) => (
              <TaskCard
                key={t.id}
                task={t}
                person={stakeholderByProject[t.projectKey]}
                index={i}
                selected={t.id === selectedId}
                onOpen={() => setSelectedId(t.id)}
              />
            ))}
            {lockedVisible.map((t, i) => (
              <LockedTaskCard key={t.taskKey} task={t} index={visible.length + i} />
            ))}
          </div>
        ) : (
          <BentoCard hover={false} className="text-center py-10">
            <ClipboardCheck size={30} className="text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500 font-medium">
              {filtersOn ? 'No tasks match these filters.' : 'No tasks assigned yet.'}
            </p>
            {filtersOn && (
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={() => { setPriorityFilter(''); setProjectFilter(''); }}
                className="mt-3 text-xs font-bold text-indigo-600 hover:text-indigo-700"
              >
                Clear filters
              </motion.button>
            )}
          </BentoCard>
        )}
      </section>

      {/* Selected task workspace */}
      {selected && (
        <section>
          <SectionTitle>{selected.status === 'graded' ? 'Feedback' : 'Workspace'}</SectionTitle>
          <TaskWorkspace task={selected} onStateChange={onStateChange} />
        </section>
      )}

      {/* Section 2 — analytics */}
      <section>
        <SectionTitle>Delivery analytics</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
          <BentoCard index={0}>
            <h3 className="text-base font-bold mb-0.5">Turnaround</h3>
            <p className="text-xs text-gray-400 mb-2">Avg time from assigned to graded</p>
            <TaskVelocityBar data={velocity} />
          </BentoCard>

          <BentoCard index={1}>
            <h3 className="text-base font-bold mb-0.5">Task health</h3>
            <p className="text-xs text-gray-400 mb-4">Against each task's deadline</p>
            <TaskHealthDonut data={health} onTimeRate={onTimeRate} />
            {counts.withoutDeadline > 0 && (
              <p className="text-[11px] text-gray-400 mt-3">
                {counts.withoutDeadline} task{counts.withoutDeadline === 1 ? '' : 's'} without a deadline excluded.
              </p>
            )}
          </BentoCard>

          <BentoCard index={2}>
            <div className="flex items-center gap-2 mb-0.5">
              <Users size={17} className="text-indigo-500 shrink-0" />
              <h3 className="text-base font-bold">Task owners</h3>
            </div>
            <p className="text-xs text-gray-400 mb-3.5">Who assigned your tasks</p>
            {taskSources.length ? (
              <div className="space-y-3">
                {taskSources.map((s) => (
                  <div key={s.archetype} className="flex items-center gap-2.5">
                    <Avatar name={s.name} avatarUrl={personByArchetype[s.archetype]?.avatarUrl} size={30} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold truncate">{s.name}</div>
                      <div className="text-xs text-gray-400 truncate">{s.title}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-bold text-gray-800">{s.assigned}</div>
                      <div className="text-[10px] text-gray-400 uppercase font-bold tracking-wide">{s.graded} done</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No tasks assigned yet.</p>
            )}
          </BentoCard>

          <BentoCard index={3}>
            <div className="flex items-center gap-2 mb-0.5">
              <Gauge size={17} className="text-teal-500" />
              <h3 className="text-base font-bold">On-time delivery</h3>
            </div>
            <p className="text-xs text-gray-400 mb-3">Share of tasks delivered by their deadline</p>
            <div className="text-4xl font-extrabold text-gray-900 leading-none mb-1">
              {onTimeRate === null ? '—' : `${onTimeRate}%`}
            </div>
            <p className="text-xs text-gray-500 mb-2">
              {onTimeRate === null
                ? 'No graded tasks with a deadline yet.'
                : `Across ${trend.length} delivered task${trend.length === 1 ? '' : 's'}.`}
            </p>
            <Sparkline
              data={trend}
              dataKey="rate"
              color="#14b8a6"
              emptyNote={trend.length === 1 ? 'Trend appears after a second delivery.' : 'No deliveries yet.'}
            />
          </BentoCard>
        </div>
      </section>
    </div>
  );
}
