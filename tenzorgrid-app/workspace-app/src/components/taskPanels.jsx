import React from 'react';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { ArrowRight, ChevronRight, CircleCheckBig, CirclePlay, CalendarDays, TriangleAlert, Clock3,
  MessageSquare, Target } from 'lucide-react';
import { Avatar } from './ui.jsx';
import { PRIORITY_PILL } from './taskCards.jsx';

// The four states a task can be in, in the order it moves through them. Everything on
// this page — the donut, the tiles, the kanban — is cut from this one function, so a
// task counted as "In progress" in the ring is the same task in the tile beside it.
export function bucketOf(t) {
  if (t.status === 'graded') return 'completed';
  if (t.reviewState === 'pending' || t.stage === 'Submitted') return 'inProgress';
  if (t.notYetOpen) return 'upcoming';
  if (t.overdue) return 'overdue';
  return 'assigned';
}

export const BUCKET = {
  completed: { label: 'Completed', color: '#10b981', tile: 'bg-emerald-50 border-emerald-100', ink: 'text-emerald-700', chip: 'bg-emerald-500', Icon: CircleCheckBig },
  inProgress: { label: 'In Progress', color: '#3b82f6', tile: 'bg-blue-50 border-blue-100', ink: 'text-blue-700', chip: 'bg-blue-500', Icon: CirclePlay },
  upcoming: { label: 'Upcoming', color: '#8b5cf6', tile: 'bg-violet-50 border-violet-100', ink: 'text-violet-700', chip: 'bg-violet-500', Icon: CalendarDays },
  overdue: { label: 'Overdue', color: '#ef4444', tile: 'bg-red-50 border-red-100', ink: 'text-red-700', chip: 'bg-red-500', Icon: TriangleAlert },
  assigned: { label: 'Assigned', color: '#94a3b8', tile: 'bg-slate-50 border-slate-100', ink: 'text-slate-600', chip: 'bg-slate-400', Icon: Clock3 },
};

// Counts every panel on the page reads from.
export function tallyTasks(rows, lockedCount) {
  const by = { completed: 0, inProgress: 0, upcoming: 0, overdue: 0, assigned: 0 };
  for (const t of rows) by[bucketOf(t)] += 1;
  const assignedTotal = rows.length;
  return {
    by,
    assignedTotal,
    // Progress is against what you have actually been given, not the whole track —
    // otherwise a manager's first morning reads 0 of 120 and stays near zero for a month.
    pct: assignedTotal ? Math.round((by.completed / assignedTotal) * 100) : 0,
    // Share of everything the track holds, locked projects included. A different, honest
    // number, and the one that answers "how far through the whole thing am I".
    trackPct: assignedTotal + lockedCount
      ? Math.round((by.completed / (assignedTotal + lockedCount)) * 1000) / 10
      : 0,
  };
}

export function CompletionDonut({ tally }) {
  const data = ['completed', 'inProgress', 'upcoming', 'overdue', 'assigned']
    .map((k) => ({ key: k, label: BUCKET[k].label, value: tally.by[k] }))
    .filter((d) => d.value > 0);

  return (
    <div className="flex items-center gap-5 flex-wrap">
      <div className="relative w-[104px] h-[104px] shrink-0">
        {data.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="label" innerRadius="70%" outerRadius="100%"
                paddingAngle={2} stroke="#fff" strokeWidth={2} isAnimationActive>
                {data.map((d) => <Cell key={d.key} fill={BUCKET[d.key].color} />)}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }}
                formatter={(v, n) => [`${v} task${v === 1 ? '' : 's'}`, n]} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="w-full h-full rounded-full border-[10px] border-gray-100" />
        )}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-sm font-extrabold leading-none text-gray-900">
            {tally.by.completed} / {tally.assignedTotal}
          </span>
          <span className="text-[12px] font-bold text-gray-500 mt-0.5">{tally.pct}%</span>
        </div>
      </div>

      <div className="min-w-0">
        <div className="text-sm font-bold text-gray-800 mb-2">Task completion</div>
        {/* Every bucket with anything in it, so the legend adds up to the total in the
            middle of the ring. Dropping the "assigned" slice to keep the design's four
            rows left a legend reading 24 beside a ring reading 30. */}
        <div className="space-y-1">
          {['completed', 'inProgress', 'assigned', 'upcoming', 'overdue']
            .filter((k) => tally.by[k] > 0 || k !== 'assigned')
            .map((k) => (
            <div key={k} className="flex items-center gap-2 text-xs">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: BUCKET[k].color }} />
              <span className="font-bold text-gray-800 w-6 text-right">{tally.by[k]}</span>
              <span className="text-gray-500">{BUCKET[k].label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function StatTile({ bucket, value, sub, index }) {
  const b = BUCKET[bucket];
  // Deliberately not a BentoCard: that sets bg-white, and a tinted tile passed in through
  // className would be fighting it for which background rule the stylesheet emits last.
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: (index || 0) * 0.05, duration: 0.25 }}
      className={`rounded-xl border p-4 min-w-0 ${b.tile}`}
    >
      <div className="flex items-start gap-3">
        <span className={`shrink-0 w-9 h-9 rounded-xl ${b.chip} text-white flex items-center justify-center`}>
          <b.Icon size={18} />
        </span>
        <div className="min-w-0">
          <div className="text-2xl font-extrabold text-gray-900 leading-none">{value}</div>
          <div className={`text-sm font-bold ${b.ink} mt-1`}>{b.label}</div>
          <div className="text-[12px] text-gray-500 mt-0.5 leading-snug">{sub}</div>
        </div>
      </div>
    </motion.div>
  );
}

// One row of My Focus. The left edge carries the urgency so a glance down the column
// sorts itself: red is late, amber is today, slate is simply next.
function FocusRow({ task, person, onOpen, compact }) {
  const urgent = task.overdue ? 'overdue' : task.dueLabel === 'Today' ? 'today' : 'later';
  const skin = {
    overdue: 'border-l-4 border-l-red-400 bg-red-50/60',
    today: 'border-l-4 border-l-amber-400 bg-amber-50/60',
    later: 'border-l-4 border-l-slate-200 bg-white',
  }[urgent];
  const flag = {
    overdue: <span className="inline-flex items-center gap-1 text-[12px] font-extrabold text-red-700 bg-red-100 rounded px-1.5 py-0.5"><TriangleAlert size={11} />{task.dueLabel}</span>,
    today: <span className="inline-flex items-center gap-1 text-[12px] font-extrabold text-amber-800 bg-amber-100 rounded px-1.5 py-0.5"><Clock3 size={11} />Due today</span>,
    later: <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-slate-500"><CalendarDays size={11} />Due {task.dueLabel}</span>,
  }[urgent];

  return (
    <div className={`rounded-xl border border-gray-100 ${skin} p-3.5`}>
      <div className="flex items-start justify-between gap-3 mb-1.5">
        {flag}
        <span className={`shrink-0 inline-flex text-[12px] font-bold rounded px-1.5 py-0.5 ${PRIORITY_PILL[task.priority]}`}>
          {task.priorityLabel}
        </span>
      </div>
      <h4 className="text-sm font-bold text-gray-900 leading-snug">{task.title}</h4>
      {/* Focus is the landing screen of My Work, so anything that changed about a piece of
          work has to be visible HERE. It was only on the queue cards behind the second
          tab, which is the one place a learner might never click. */}
      {task.update && (
        <span className="inline-flex mt-1 text-[11px] font-bold rounded px-1.5 py-0.5 bg-amber-100 text-amber-800">
          {task.update.label}
        </span>
      )}
      {task.projectTitle && <p className="text-[12px] text-gray-500 mt-0.5 truncate">Project: {task.projectTitle}</p>}

      {/* Who this is for. The row used to show the project's stakeholder for every task on
          that project, falling back to the line manager when there wasn't one -- so a task
          the manager handed you personally was still captioned with the client's name. The
          per-task requester is now on the row itself, so use it and only fall back to the
          project stakeholder when a task has none. */}
      {(() => {
        const a = task.assignment || {};
        const name = a.requestedBy || (person && person.name) || null;
        if (!name) return null;
        const avatarUrl = person && person.name === name ? person.avatarUrl : null;
        const lead = a.fromTheLine ? 'From' : 'For';
        if (compact) {
          return (
            <p className="text-[12px] text-gray-500 mt-1 truncate">
              {lead} <span className="font-semibold text-gray-700">{name}</span>
            </p>
          );
        }
        return (
          <div className="flex items-center gap-2 mt-2 min-w-0">
            <Avatar name={name} avatarUrl={avatarUrl} size={20} />
            <span className="text-[12px] text-gray-500 truncate">
              {lead} <span className="font-semibold text-gray-700">{name}</span>
              {a.requestedByTitle && <span className="text-gray-400"> · {a.requestedByTitle}</span>}
            </span>
          </div>
        );
      })()}

      <div className="flex items-center justify-between gap-3 mt-2.5">
        <div className="min-w-0 flex-1">
          <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-400 transition-all"
              style={{ width: `${task.stagePct}%` }} />
          </div>
          <div className="text-[12px] font-semibold text-gray-500 mt-1">{task.stage}</div>
        </div>
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={onOpen}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700"
        >
          Open task <ArrowRight size={13} />
        </motion.button>
      </div>
    </div>
  );
}

export function FocusList({ tasks, personFor, onOpen }) {
  if (!tasks.length) {
    return (
      <p className="text-sm text-gray-500">
        Nothing needs you right now. Everything open has been submitted or has not opened yet.
      </p>
    );
  }
  const [first, second, ...rest] = tasks;
  return (
    <div className="space-y-3">
      <FocusRow task={first} person={personFor(first)} onOpen={() => onOpen(first.id)} />
      {second && <FocusRow task={second} person={personFor(second)} onOpen={() => onOpen(second.id)} />}
      {rest.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {rest.slice(0, 4).map((t) => (
            <FocusRow key={t.id} task={t} person={personFor(t)} onOpen={() => onOpen(t.id)} compact />
          ))}
        </div>
      )}
    </div>
  );
}

// Upcoming, keyed on the project week rather than on a date. Every task in a project
// carries the same deadline, so a date column would print the same Friday five times;
// what a learner plans around is which day a task opens.
export function UpcomingTable({ tasks, onViewAll, compact = false }) {
  if (!tasks.length) {
    return <p className="text-sm text-gray-500">Nothing waiting — everything assigned to you is already open.</p>;
  }
  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="text-[12px] font-bold text-gray-500 uppercase tracking-wide">
            <th className="py-2 pr-3 font-bold">Opens</th>
            <th className="py-2 pr-3 font-bold">Task</th>
            {!compact && <th className="py-2 pr-3 font-bold hidden sm:table-cell">Project</th>}
            <th className="py-2 pr-3 font-bold">Priority</th>
            {!compact && <th className="py-2 pr-3 font-bold hidden md:table-cell">Stage</th>}
            <th className="py-2 w-6" />
          </tr>
        </thead>
        <tbody>
          {tasks.slice(0, 6).map((t) => (
            <tr key={t.id} className="border-t border-gray-100 hover:bg-gray-50/70 transition-colors">
              <td className="py-2.5 pr-3 align-middle whitespace-nowrap">
                <div className="text-xs font-bold text-gray-800">Day {t.dayIndex || '—'}</div>
                <div className="text-[12px] text-gray-500">{t.opensLabel || 'Open now'}</div>
              </td>
              <td className="py-2.5 pr-3 align-middle">
                <span className="text-[14px] font-semibold text-gray-800 leading-snug">{t.title}</span>
              </td>
              {!compact && (
                <td className="py-2.5 pr-3 align-middle hidden sm:table-cell">
                  <span className="text-xs text-gray-500">{t.projectTitle}</span>
                </td>
              )}
              <td className="py-2.5 pr-3 align-middle">
                <span className={`inline-flex text-[12px] font-bold rounded px-1.5 py-0.5 ${PRIORITY_PILL[t.priority]}`}>
                  {t.priorityLabel}
                </span>
              </td>
              {!compact && (
                <td className="py-2.5 pr-3 align-middle hidden md:table-cell">
                  <span className="text-xs text-gray-500">{t.stage}</span>
                </td>
              )}
              <td className="py-2.5 align-middle text-right">
                {/* Opening a task that has not opened yet would land the learner in an
                    editor they cannot submit from, so these are not clickable. */}
                <ChevronRight size={15} className="text-gray-500 inline" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {tasks.length > 6 && (
        <button onClick={onViewAll} className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-700">
          View all {tasks.length} upcoming <ArrowRight size={12} />
        </button>
      )}
    </div>
  );
}

// Task Flow — read-only, by your call. A column is earned by submitting and being signed
// off, so there is nothing to drag: a card moves right when the work does. Clicking one
// opens it in the Workspace tab, which is the only action that makes sense here.
const FLOW_COLUMNS = ['upcoming', 'assigned', 'inProgress', 'completed'];
const FLOW_HEADING = { ...BUCKET, assigned: { ...BUCKET.assigned, label: 'To do' } };

export function TaskFlow({ rows, onOpen }) {
  const cols = FLOW_COLUMNS.map((k) => ({
    key: k,
    label: FLOW_HEADING[k].label,
    color: BUCKET[k].color,
    // Overdue is a warning on a card, not a column of its own — an overdue task is still
    // something you have to do, and filing it separately hides it from the queue it
    // belongs in.
    items: rows.filter((t) => (t.overdue && t.status !== 'graded' ? 'assigned' : bucketOf(t)) === k),
  }));

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
      {cols.map((c) => (
        <div key={c.key} className="rounded-xl border border-gray-100 bg-gray-50/70 p-2.5 min-w-0">
          <div className="flex items-center gap-1.5 mb-2.5 px-0.5">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c.color }} />
            <span className="text-xs font-bold text-gray-700 truncate">{c.label}</span>
            <span className="ml-auto text-[12px] font-bold text-gray-500">{c.items.length}</span>
          </div>
          <div className="space-y-2">
            {c.items.slice(0, 4).map((t) => {
              const clickable = !t.notYetOpen;
              return (
                <button
                  key={t.id}
                  onClick={clickable ? () => onOpen(t.id) : undefined}
                  disabled={!clickable}
                  className={`w-full text-left bg-white border border-gray-100 rounded-lg p-2.5 transition-shadow ${
                    clickable ? 'hover:shadow-md cursor-pointer' : 'opacity-70 cursor-default'
                  }`}
                >
                  <div className="text-[13px] font-semibold text-gray-800 leading-snug line-clamp-2">{t.title}</div>
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <span className="text-[12px] font-semibold text-gray-500">
                      {t.status === 'graded' && t.score !== null ? `${t.score}/100`
                        : t.notYetOpen ? (t.opensLabel || `Day ${t.dayIndex}`)
                          : t.overdue ? t.dueLabel : `Day ${t.dayIndex || '—'}`}
                    </span>
                    <span className="w-1 h-1 rounded-full bg-gray-300" />
                    <span className={`text-[12px] font-bold ${t.overdue && t.status !== 'graded' ? 'text-red-600' : 'text-gray-500'}`}>
                      {t.overdue && t.status !== 'graded' ? 'Overdue' : t.priorityLabel}
                    </span>
                  </div>
                </button>
              );
            })}
            {c.items.length > 4 && (
              <div className="text-[12px] font-semibold text-gray-500 px-0.5 pt-0.5">
                + {c.items.length - 4} more
              </div>
            )}
            {!c.items.length && <div className="text-[12px] text-gray-500 px-0.5 py-1">Nothing here</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

// Timeline — the project week, by your call. Five days, what sits in each, and how far
// each day has been cleared. This is the shape a project actually has; a calendar would
// spread five days of authored work across whatever dates the learner happened to log in.
export function Timeline({ rows }) {
  const days = [1, 2, 3, 4, 5].map((d) => {
    const items = rows.filter((t) => (t.dayIndex || 0) === d);
    const done = items.filter((t) => t.status === 'graded').length;
    const open = items.some((t) => !t.notYetOpen && t.status !== 'graded');
    return { d, items, done, open, locked: items.length > 0 && items.every((t) => t.notYetOpen) };
  });
  const unplaced = rows.filter((t) => !t.dayIndex).length;

  return (
    <div className="space-y-2.5">
      {days.map(({ d, items, done, open, locked }) => (
        <div key={d} className={`rounded-xl border p-3 ${
          open ? 'border-indigo-200 bg-indigo-50/50' : locked ? 'border-gray-100 bg-gray-50/70' : 'border-gray-100 bg-white'
        }`}>
          <div className="flex items-baseline gap-2 flex-wrap mb-2">
            <span className="text-sm font-bold text-gray-800">Day {d}</span>
            {open && <span className="text-[12px] font-extrabold text-indigo-700 bg-indigo-100 rounded px-1.5 py-0.5">Open now</span>}
            {locked && <span className="text-[12px] font-semibold text-gray-500">{items[0].opensLabel || 'Opens later'}</span>}
            <span className="ml-auto text-[12px] font-bold text-gray-500">{done} / {items.length}</span>
          </div>
          <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all"
              style={{ width: items.length ? `${(done / items.length) * 100}%` : '0%' }} />
          </div>
          {items.length > 0 && (
            <p className="text-[12px] text-gray-500 mt-1.5 truncate">
              {items.slice(0, 2).map((t) => t.title).join(' · ')}{items.length > 2 ? ` · +${items.length - 2}` : ''}
            </p>
          )}
        </div>
      ))}
      {unplaced > 0 && (
        <p className="text-[12px] text-gray-500">{unplaced} task{unplaced === 1 ? '' : 's'} not tied to a day.</p>
      )}
    </div>
  );
}

const ACTIVITY_SKIN = {
  signoff: { ring: 'bg-emerald-100 text-emerald-700', Icon: CircleCheckBig },
  submitted: { ring: 'bg-indigo-100 text-indigo-600', Icon: CirclePlay },
  message: { ring: 'bg-amber-100 text-amber-600', Icon: MessageSquare },
};

function ago(iso) {
  const ms = Date.now() - Date.parse(iso);
  if (!Number.isFinite(ms)) return '';
  const m = Math.round(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? '' : 's'} ago`;
}

export function ActivityFeed({ events, personByArchetype }) {
  if (!events || !events.length) {
    return <p className="text-sm text-gray-500">Nothing yet. Submit a task and it shows up here.</p>;
  }
  return (
    <div className="space-y-3">
      {events.map((e, i) => {
        const skin = ACTIVITY_SKIN[e.kind] || ACTIVITY_SKIN.submitted;
        const person = e.archetype ? personByArchetype[e.archetype] : null;
        return (
          <div key={`${e.kind}-${e.at}-${i}`} className="flex items-start gap-2.5">
            <span className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${skin.ring}`}>
              <skin.Icon size={13} />
            </span>
            {person && <Avatar name={person.name} avatarUrl={person.avatarUrl} size={22} className="shrink-0" />}
            <div className="min-w-0 flex-1">
              <p className="text-[14px] text-gray-700 leading-snug">
                {e.kind === 'signoff' && (
                  <>
                    <b className="font-semibold">{e.who}</b> signed off{' '}
                    <span className="font-semibold text-gray-900">{e.title}</span>
                    {e.score !== null && e.score !== undefined && <> — {e.score}/100</>}
                  </>
                )}
                {e.kind === 'submitted' && (
                  <>You submitted <span className="font-semibold text-gray-900">{e.title}</span></>
                )}
                {e.kind === 'message' && (
                  <>
                    <b className="font-semibold">{e.who}</b> wrote about{' '}
                    <span className="font-semibold text-gray-900">{e.title}</span>
                  </>
                )}
              </p>
              <p className="text-[12px] text-gray-500 mt-0.5">{ago(e.at)}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ProgressBanner({ tally }) {
  const pct = tally.pct;
  const line = pct === 0
    ? 'Nothing signed off yet — open the first task and get going.'
    : pct < 50 ? `You've signed off ${pct}% of what you've been given. Keep going.`
      : pct < 100 ? `You've signed off ${pct}% of your tasks. Keep it up!`
        : 'Every task assigned to you is signed off. Nicely done.';
  return (
    <div className="rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100 p-4 flex items-start gap-3">
      <span className="shrink-0 w-9 h-9 rounded-xl bg-emerald-700 text-white flex items-center justify-center">
        <Target size={18} />
      </span>
      <div className="min-w-0">
        <div className="text-sm font-extrabold text-emerald-900">
          {pct === 0 ? 'Fresh start' : pct === 100 ? 'All clear' : 'Good progress'}
        </div>
        <p className="text-xs text-emerald-800/80 mt-0.5 leading-snug">{line}</p>
      </div>
    </div>
  );
}
