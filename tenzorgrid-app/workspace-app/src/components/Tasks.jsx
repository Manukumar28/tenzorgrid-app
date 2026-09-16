import React, { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, ClipboardCheck, Users, Gauge, MessageSquare, RotateCcw, Search, History,
  Target, ListChecks, CalendarClock, CheckCircle2, LayoutGrid, MonitorPlay } from 'lucide-react';
import { BentoCard, Avatar, ProgressBar } from './ui.jsx';
import { Sparkline, TaskHealthDonut, TaskVelocityBar } from './charts.jsx';
import { TaskCard, LockedTaskCard, PRIORITY_PILL } from './taskCards.jsx';
import { CompletionDonut, StatTile, FocusList, UpcomingTable, TaskFlow, Timeline,
  ActivityFeed, ProgressBanner, tallyTasks, bucketOf } from './taskPanels.jsx';
import { api } from '../api.js';
const Workbench = lazy(() => import('./Workbench.jsx'));

const PRIORITY_OPTIONS = [
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];
// The definitions spell the middle tier both `medium` and `normal`, so the filter and
// the sort both have to fold them together or a Medium filter hides half its matches.
const samePriority = (a, b) => (a === 'normal' ? 'medium' : a) === (b === 'normal' ? 'medium' : b);
const SORT_OPTIONS = [
  { value: 'due', label: 'Due date' },
  { value: 'priority', label: 'Priority' },
  { value: 'title', label: 'Title' },
];
const PRIORITY_RANK = { urgent: 0, high: 1, medium: 2, normal: 2, low: 3 };
// Status here means the bucket a task sits in, which is the same vocabulary the donut,
// the tiles and the tabs use. "Assignee" is deliberately absent: every task belongs to
// the learner, so the useful question is who asked for it, which is the Requested by
// filter below.
const STATUS_OPTIONS = [
  { value: 'assigned', label: 'Assigned' },
  { value: 'inProgress', label: 'In Progress' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'completed', label: 'Completed' },
];

// The six views of the task list. Workspace is the one that matters: before it existed
// the editor lived at the bottom of a page that was 120 cards long, so opening a task
// scrolled the learner nineteen screens down and picking the next one scrolled them back.
// As a tab it is one click from anywhere and the travel disappears entirely.
const VIEWS = [
  { key: 'focus', label: 'Focus', Icon: Target },
  { key: 'mine', label: 'My Tasks', Icon: ListChecks },
  { key: 'upcoming', label: 'Upcoming', Icon: CalendarClock },
  { key: 'completed', label: 'Completed', Icon: CheckCircle2 },
  { key: 'all', label: 'All', Icon: LayoutGrid },
  { key: 'workspace', label: 'Workspace', Icon: MonitorPlay },
];

// What each view is for, said once so an empty one can explain itself rather than
// showing a bare "nothing here".
const EMPTY_COPY = {
  focus: 'Nothing to work on right now — check Upcoming for what opens next.',
  mine: 'No tasks assigned yet.',
  upcoming: 'Nothing waiting. Everything assigned to you is open.',
  completed: 'Nothing signed off yet.',
  all: 'No tasks assigned yet.',
};

const VIEW_BLURB = {
  focus: 'Tasks you can work on right now',
  mine: 'Everything assigned to you on this project',
  upcoming: 'Assigned, but not open yet',
  completed: 'Signed off',
  all: 'Every task in the track, including what is still locked',
};

function ViewTabs({ view, onView, counts }) {
  return (
    <div role="tablist" aria-label="Task views" className="flex items-center gap-1 flex-wrap">
      {VIEWS.map(({ key, label, Icon }) => {
        const active = view === key;
        const count = counts[key];
        return (
          <button
            key={key}
            role="tab"
            aria-selected={active}
            onClick={() => onView(key)}
            className={`inline-flex items-center gap-1.5 px-3 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200 rounded-t ${
              active
                ? 'border-indigo-500 text-indigo-700'
                : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-200'
            }`}
          >
            <Icon size={15} className="shrink-0" />
            <span>{label}</span>
            {count !== undefined && count !== null && (
              <span className={`text-[11px] font-bold rounded-full px-1.5 py-0.5 ${
                active ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'
              }`}>{count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

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

// The submission workspace. For an ungraded task this is now the full Workbench — a
// real editor with the dataset schema beside it and a free Run button — rather than a
// bare textarea. Graded tasks keep the compact feedback panel, since there is nothing
// left to write. The Workbench is lazy-loaded so learners who never open the Tasks tab
// don't pay to download a code editor.
function TaskWorkspace({ task, manager, learnerName, learnerPhotoUrl, onStateChange, onOpenChat }) {
  const managerFirst = (manager ? manager.name : 'Asha Rao').split(' ')[0];
  return (
    <BentoCard hover={false}>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
        <div className="min-w-0">
          <h3 className="text-base font-bold">{task.title}</h3>
          {task.projectTitle && <p className="text-xs text-gray-400 mt-0.5">{task.projectTitle}</p>}
        </div>
        <span className={`inline-flex text-[11px] font-bold rounded-md px-2 py-1 ${PRIORITY_PILL[task.priority]}`}>{task.priorityLabel}</span>
      </div>

      {/* Three states, in the order a task actually moves through them: waiting on the
          manager's sign-off, done, or still being worked on. */}
      {task.reviewState === 'pending' ? (
        <>
          <p className="text-sm text-gray-600 leading-relaxed mb-4">{task.brief}</p>
          {/* The sign-off conversation happens in the chat window with the manager, not
              here. A review panel bolted into the workbench read as a form to fill in;
              a manager questioning your work is a conversation, and it belongs where
              every other conversation with her already is. */}
          <button
            onClick={() => onOpenChat && onOpenChat('line_manager')}
            aria-label="Open the sign-off chat with your manager"
            className="w-full flex items-center gap-3 rounded-xl border-2 border-amber-200 bg-amber-50 px-4 py-3.5 text-left hover:bg-amber-100 transition-colors"
          >
            <Avatar name={manager ? manager.name : 'Asha Rao'} avatarUrl={manager && manager.avatarUrl} size={34} className="shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-extrabold text-amber-900">
                {manager ? manager.name.split(' ')[0] : 'Asha'} is reviewing this — she's asked you something
              </p>
              <p className="text-xs text-amber-800/80 truncate mt-0.5">{task.reviewQuestion}</p>
            </div>
            <span className="shrink-0 inline-flex items-center gap-1.5 text-xs font-bold text-amber-900">
              <MessageSquare size={14} /> Reply in chat
            </span>
          </button>
          {/* Take it back before you have to defend it. Halfway through composing an answer
              is exactly when people realise their query was wrong, and defending work you
              already know is wrong is not a skill worth practising. */}
          {task.reviewRoundsLeft === 2 && (
            <button
              onClick={async () => {
                try {
                  const d = await api.redoSubmission(task.id);
                  if (d.state) onStateChange(d.state);
                } catch (e) { /* eslint-disable-next-line no-alert */ alert(e.message); }
              }}
              aria-label="Take the submission back and redo it"
              className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-600 text-xs font-bold hover:bg-slate-50"
            >
              <RotateCcw size={12} /> Actually, let me redo this
            </button>
          )}
        </>
      ) : task.status === 'graded' ? (
        <>
          <p className="text-sm text-gray-600 leading-relaxed mb-4">{task.brief}</p>
          <div className="bg-emerald-50 border border-emerald-100 rounded-lg px-4 py-3.5">
            <div className="text-emerald-700 font-bold text-sm mb-1.5">Signed off — {task.score}/100</div>
            <div className="text-sm text-emerald-900 whitespace-pre-wrap leading-relaxed">{task.feedback}</div>
          </div>
        </>
      ) : (
        <>
          {/* Sent back. The banner sits above the editor rather than replacing it — a
              reopened task is one you have to do again, so the reason and the tools to
              act on it need to be on the same screen. */}
          {task.sentBack && (
            <div className={`mb-4 rounded-lg border px-4 py-3.5 ${task.sentBack === 'rework' ? 'bg-violet-50 border-violet-200' : 'bg-amber-50 border-amber-200'}`}>
              <div className="flex items-center gap-2 mb-1.5">
                <RotateCcw size={14} className={task.sentBack === 'rework' ? 'text-violet-700' : 'text-amber-700'} />
                <span className={`text-sm font-bold ${task.sentBack === 'rework' ? 'text-violet-800' : 'text-amber-800'}`}>
                  {task.sentBack === 'rework'
                    ? `${managerFirst} wants this done a different way`
                    : `${managerFirst} sent this back`}
                </span>
              </div>
              {task.sentBackNote && (
                <p className={`text-sm whitespace-pre-wrap leading-relaxed ${task.sentBack === 'rework' ? 'text-violet-900' : 'text-amber-900'}`}>
                  {task.sentBackNote}
                </p>
              )}
            </div>
          )}
          <Suspense fallback={<p className="text-sm text-gray-400 font-medium py-6">Loading the editor…</p>}>
            <Workbench taskId={task.id} onGraded={onStateChange} />
          </Suspense>
        </>
      )}
    </BentoCard>
  );
}

export default function Tasks({ state, learnerName, learnerPhotoUrl, onStateChange, onOpenChat }) {
  const { taskBoard, roster, projects } = state;

  // Testing only, and only when the server allows it. Reaching the seventh task by
  // answering the six in front of it is data entry, not testing.
  async function testComplete(taskId) {
    try {
      const d = await api.timeTravel({ completeTaskId: taskId });
      if (d.state) onStateChange(d.state);
    } catch (e) {
      // eslint-disable-next-line no-alert
      alert(e.message);
    }
  }
  const [priorityFilter, setPriorityFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [askedByFilter, setAskedByFilter] = useState('');
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState('due');
  const [selectedId, setSelectedId] = useState(null);
  const [view, setView] = useState('focus');
  const [boardTab, setBoardTab] = useState('flow');

  // Opening a task switches to the Workspace tab rather than scrolling to it. The old
  // behaviour smooth-scrolled the learner to an editor seventeen thousand pixels down
  // the page, which worked once and then stranded them there.
  function openTask(id) {
    setSelectedId(id);
    setView('workspace');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function changeView(next) {
    setView(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

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
    // A task whose day has not arrived is not a candidate — landing on a workspace the
    // learner cannot use yet would read as broken.
    const open = taskBoard.rows.find((r) => r.status !== 'graded' && !r.notYetOpen);
    setSelectedId((open || taskBoard.rows[taskBoard.rows.length - 1] || {}).id || null);
  }, [taskBoard.rows, selectedId]);

  // Which rows each view is made of. Focus is the only one that matters on a normal
  // morning: of the 120 rows a manager carries, six are workable and the rest either
  // have not opened yet or sit behind a project gate.
  const viewRows = useMemo(() => ({
    focus: taskBoard.rows.filter((r) => r.status !== 'graded' && !r.notYetOpen),
    mine: taskBoard.rows.filter((r) => r.status !== 'graded'),
    upcoming: taskBoard.rows.filter((r) => r.notYetOpen),
    completed: taskBoard.rows.filter((r) => r.status === 'graded'),
    all: taskBoard.rows,
  }), [taskBoard.rows]);

  const viewCounts = useMemo(() => ({
    focus: viewRows.focus.length,
    mine: viewRows.mine.length,
    upcoming: viewRows.upcoming.length,
    completed: viewRows.completed.length,
    all: viewRows.all.length + taskBoard.locked.length,
    workspace: undefined,
  }), [viewRows, taskBoard.locked.length]);

  const tally = useMemo(
    () => tallyTasks(taskBoard.rows, taskBoard.locked.length),
    [taskBoard.rows, taskBoard.locked.length],
  );

  // My Focus: what is actually workable, worst first. Overdue, then due today, then the
  // rest in due order — the order somebody would pick them up in.
  const focusTasks = useMemo(() => {
    const rank = (t) => (t.overdue ? 0 : t.dueLabel === 'Today' ? 1 : 2);
    return [...viewRows.focus].sort((a, b) => rank(a) - rank(b)
      || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
      || (a.dayIndex || 0) - (b.dayIndex || 0));
  }, [viewRows.focus]);

  const upcomingTasks = useMemo(
    () => [...viewRows.upcoming].sort((a, b) => (a.dayIndex || 0) - (b.dayIndex || 0)),
    [viewRows.upcoming],
  );

  const askedByOptions = useMemo(() => {
    const seen = new Map();
    for (const r of taskBoard.rows) {
      const who = stakeholderByProject[r.projectKey];
      if (who && !seen.has(who.archetype)) seen.set(who.archetype, who.name);
    }
    return [...seen].map(([value, label]) => ({ value, label }));
  }, [taskBoard.rows, stakeholderByProject]);

  const visible = useMemo(() => {
    const base = viewRows[view] || viewRows.focus;
    const q = query.trim().toLowerCase();
    const list = base.filter((r) => {
      if (priorityFilter && !samePriority(r.priority, priorityFilter)) return false;
      if (projectFilter && r.projectKey !== projectFilter) return false;
      if (statusFilter && bucketOf(r) !== statusFilter) return false;
      if (askedByFilter) {
        const who = stakeholderByProject[r.projectKey];
        if (!who || who.archetype !== askedByFilter) return false;
      }
      if (q && !`${r.title} ${r.projectTitle || ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
    const sorted = [...list];
    // Work that has not opened yet always sorts last, whichever key is chosen. Without
    // this, every task in a project shares one deadline, so a due-date sort interleaved
    // Monday's work with Thursday's and put an "Opens Thursday" card second on the page.
    const byOpen = (a, b) => (a.notYetOpen === b.notYetOpen ? 0 : a.notYetOpen ? 1 : -1);
    const then = sortBy === 'priority'
      ? (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
      : sortBy === 'title'
        ? (a, b) => a.title.localeCompare(b.title)
        : (a, b) => (a.dueAt || '9999').localeCompare(b.dueAt || '9999') || (a.dayIndex || 0) - (b.dayIndex || 0);
    sorted.sort((a, b) => byOpen(a, b) || then(a, b));
    return sorted;
  }, [viewRows, view, priorityFilter, projectFilter, statusFilter, askedByFilter, query, sortBy, stakeholderByProject]);

  // Locked work is a real part of the track, but it is 90 of the 120 cards and none of
  // it can be clicked. It belongs in All, where somebody has gone looking for it.
  const filtersOn = priorityFilter || projectFilter || statusFilter || askedByFilter || query.trim();
  const lockedVisible = view === 'all' && !filtersOn ? taskBoard.locked : [];
  const selected = taskBoard.rows.find((r) => r.id === selectedId);
  const { counts, health, velocity, onTimeRate, productivity, trend, taskSources } = taskBoard;

  return (
    <div className="space-y-6">
      {/* Title + metric sub-bar */}
      <div>
        <div className="flex items-baseline gap-2.5 flex-wrap mb-3">
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Tasks</h1>
          <span className="text-sm font-semibold text-gray-400">[Track your work and stay ahead]</span>
        </div>

      </div>

      {/* Completion, and the four states a task can be in. Every figure here is counted
          from the same rows the tabs and the list below are built from. */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,320px)_minmax(0,1fr)] gap-4 sm:gap-5">
        <BentoCard hover={false}>
          <CompletionDonut tally={tally} />
        </BentoCard>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatTile index={0} bucket="completed" value={tally.by.completed}
            sub={`${tally.trackPct}% of the whole track`} />
          <StatTile index={1} bucket="inProgress" value={tally.by.inProgress} sub="Submitted or in review" />
          <StatTile index={2} bucket="upcoming" value={tally.by.upcoming}
            sub={tally.by.upcoming ? 'Later this week' : 'Nothing waiting'} />
          <StatTile index={3} bucket="overdue" value={tally.by.overdue}
            sub={tally.by.overdue ? 'Needs attention' : 'All on time'} />
        </div>
      </div>

      {/* Tabs on the left, search and filters on the right — one row, as drawn. */}
      <div className="flex items-end justify-between gap-x-4 gap-y-3 flex-wrap border-b border-gray-200">
        <ViewTabs view={view} onView={changeView} counts={viewCounts} />
        <div className="flex items-center gap-2 flex-wrap pb-2">
        <div className="relative min-w-[170px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tasks..."
            aria-label="Search tasks"
            className="w-full text-xs font-medium rounded-full border border-gray-200 bg-white pl-8 pr-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </div>

          <FilterSelect label="Status" value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} />
          <FilterSelect label="Priority" value={priorityFilter} onChange={setPriorityFilter} options={PRIORITY_OPTIONS} />
          <FilterSelect label="Project" value={projectFilter} onChange={setProjectFilter} options={projectOptions} />
          <FilterSelect label="Requested by" value={askedByFilter} onChange={setAskedByFilter} options={askedByOptions} />
          <FilterSelect label="Sort" value={sortBy === 'due' ? '' : sortBy} onChange={(v) => setSortBy(v || 'due')} options={SORT_OPTIONS} />
        </div>
      </div>

      {/* The Focus view is the landing screen, so it gets the designed layout rather than
          a card grid: what needs you now on the left, what is coming on the right. Every
          other view stays a plain list, because that is what you switched to it for. */}
      {/* Two columns only while there is something in Focus. At the end of a day, when
          every workable task is signed off, My Focus is a single sentence — beside a
          six-row Upcoming table that left 514px of empty page next to it. */}
      {view === 'focus' && !filtersOn && (
        <div className={`grid gap-4 sm:gap-6 items-start ${
          focusTasks.length ? 'grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,380px)]' : 'grid-cols-1'}`}>
          <BentoCard hover={false}>
            <div className="flex items-center gap-2 mb-0.5">
              <Target size={17} className="text-indigo-500 shrink-0" />
              <h2 className="text-base font-bold">My Focus</h2>
            </div>
            <p className="text-xs text-gray-400 mb-4">Tasks that need your attention right now</p>
            <FocusList tasks={focusTasks} stakeholderByProject={stakeholderByProject} onOpen={openTask} />
            {focusTasks.length > 6 && (
              <button onClick={() => changeView('mine')} className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-700">
                View all {focusTasks.length} open
              </button>
            )}
          </BentoCard>

          <BentoCard hover={false}>
            <div className="flex items-center gap-2 mb-0.5">
              <CalendarClock size={17} className="text-violet-500 shrink-0" />
              <h2 className="text-base font-bold">Upcoming</h2>
            </div>
            <p className="text-xs text-gray-400 mb-4">Your next tasks, by the day they open</p>
            <UpcomingTable tasks={upcomingTasks} onViewAll={() => changeView('upcoming')} compact />
          </BentoCard>
        </div>
      )}

      {/* Task Flow and Timeline. Read-only: a card moves right when the work does, so
          there is nothing here to drag. */}
      {view === 'focus' && !filtersOn && (
        <BentoCard hover={false}>
          <div className="flex items-center gap-1 mb-4 border-b border-gray-100 -mt-1">
            {[
              { key: 'flow', label: 'Task Flow', Icon: LayoutGrid },
              { key: 'timeline', label: 'Timeline', Icon: CalendarClock },
            ].map(({ key, label, Icon }) => (
              <button
                key={key}
                role="tab"
                aria-selected={boardTab === key}
                onClick={() => setBoardTab(key)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${
                  boardTab === key ? 'border-indigo-500 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                <Icon size={15} /> {label}
              </button>
            ))}
          </div>
          {boardTab === 'flow'
            ? <TaskFlow rows={taskBoard.rows} onOpen={openTask} />
            : <Timeline rows={taskBoard.rows} />}
        </BentoCard>
      )}

      {view === 'focus' && !filtersOn && (
        <div className={`grid gap-4 sm:gap-6 items-start ${
          (taskBoard.activity || []).length ? 'grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,380px)]' : 'grid-cols-1'}`}>
          <BentoCard hover={false}>
            <div className="flex items-center gap-2 mb-0.5">
              <History size={17} className="text-amber-500 shrink-0" />
              <h2 className="text-base font-bold">Recent activity</h2>
            </div>
            <p className="text-xs text-gray-400 mb-4">What has actually happened on your work</p>
            <ActivityFeed events={taskBoard.activity} personByArchetype={personByArchetype} />
          </BentoCard>
          <ProgressBanner tally={tally} />
        </div>
      )}

      {/* Section 1 — task grid */}
      {view !== 'workspace' && !(view === 'focus' && !filtersOn) && (
      <section>
        <SectionTitle count={visible.length + lockedVisible.length}>
          {VIEWS.find((v) => v.key === view).label}
        </SectionTitle>
        <p className="text-xs text-gray-400 -mt-2.5 mb-3.5">{VIEW_BLURB[view]}</p>
        {visible.length || lockedVisible.length ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {visible.map((t, i) => (
              <TaskCard
                key={t.id}
                task={t}
                person={stakeholderByProject[t.projectKey]}
                index={i}
                selected={t.id === selectedId}
                onOpen={() => openTask(t.id)}
                onTestComplete={state.timeTravel && state.timeTravel.enabled ? testComplete : null}
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
              {filtersOn ? 'No tasks match these filters.' : EMPTY_COPY[view]}
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
      )}

      {/* The Workspace tab — the editor, on its own, full width. */}
      {view === 'workspace' && (
        <section>
          {selected ? (
            <>
              <SectionTitle>
                {selected.reviewState === 'pending' ? 'Sign-off' : selected.status === 'graded' ? 'Feedback' : 'Workspace'}
              </SectionTitle>
              <TaskWorkspace
                task={selected}
                onOpenChat={onOpenChat}
                manager={personByArchetype.line_manager}
                learnerName={learnerName}
                learnerPhotoUrl={learnerPhotoUrl}
                onStateChange={onStateChange}
              />
            </>
          ) : (
            <BentoCard hover={false} className="text-center py-12">
              <MonitorPlay size={30} className="text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500 font-medium">No task open.</p>
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={() => changeView('focus')}
                className="mt-3 text-xs font-bold text-indigo-600 hover:text-indigo-700"
              >
                Pick one from Focus
              </motion.button>
            </BentoCard>
          )}
        </section>
      )}

      {/* Section 2 — analytics. Not on the Workspace tab: the editor gets the page. */}
      {view !== 'workspace' && (
      <section>
        <SectionTitle>Delivery analytics</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
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
              <Gauge size={17} className="text-teal-500 shrink-0" />
              <h3 className="text-base font-bold">Productivity score</h3>
            </div>
            <p className="text-xs text-gray-400 mb-2.5">Quality, timeliness and consistency</p>

            <div className="flex items-baseline gap-1.5 mb-3">
              <span className="text-4xl font-extrabold text-gray-900 leading-none">
                {productivity.score === null ? '—' : productivity.score}
              </span>
              {productivity.score !== null && <span className="text-sm font-bold text-gray-400">/ 100</span>}
            </div>

            {productivity.score === null ? (
              <p className="text-xs text-gray-500">Complete a task to see your score.</p>
            ) : (
              <div className="space-y-2">
                {productivity.parts.map((p) => (
                  <div key={p.key}>
                    <div className="flex items-baseline justify-between gap-2 mb-1">
                      <span className="text-[11px] font-semibold text-gray-600 truncate">
                        {p.label} <span className="text-gray-400 font-medium">{Math.round(p.weight * 100)}%</span>
                      </span>
                      <span className={`text-[11px] font-bold shrink-0 ${p.value === null ? 'text-gray-300' : 'text-gray-700'}`}>
                        {p.value === null ? 'n/a' : p.value}
                      </span>
                    </div>
                    {/* A component with no data yet is shown as an empty track and left out
                        of the score entirely, rather than counted as a zero. */}
                    <ProgressBar
                      value={p.value === null ? 0 : p.value}
                      max={100}
                      height="h-1.5"
                      colorClass={p.value === null ? 'from-gray-200 to-gray-200' : 'from-teal-500 to-emerald-400'}
                    />
                  </div>
                ))}
                {productivity.parts.some((p) => p.value === null) && (
                  <p className="text-[10px] text-gray-400 pt-0.5">
                    Parts marked n/a aren't scored yet and don't count against you.
                  </p>
                )}
                {trend.length > 1 && (
                  <div className="pt-1">
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-0.5">Trend</div>
                    <Sparkline data={trend} dataKey="score" color="#14b8a6" height="h-8" />
                  </div>
                )}
              </div>
            )}
          </BentoCard>
        </div>
      </section>
      )}
    </div>
  );
}
