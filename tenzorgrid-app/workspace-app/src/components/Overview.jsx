import React from 'react';
import { ArrowRight, Award, BarChart3, CalendarDays, CheckCircle2, Circle, ClipboardList, Clock, Flame, GraduationCap, Quote, Target, TrendingUp, Trophy } from 'lucide-react';
import { BentoCard, ProgressBar, CircularProgress, Pill, Avatar } from './ui.jsx';
import { SkillRadar } from './charts.jsx';
import { api } from '../api.js';

const ROLE_BADGE = {
  stakeholder: 'bg-blue-50 text-blue-700',
  line_manager: 'bg-emerald-50 text-emerald-700',
  people_partner: 'bg-amber-50 text-amber-700',
  learner: 'bg-gray-100 text-gray-500',
};
const ROLE_TITLE = {
  stakeholder: 'Business Stakeholder',
  line_manager: 'Line Manager',
  people_partner: 'People Ops',
  learner: 'You',
};

// "On track relative to peers" claimed a comparison against other learners that does not
// exist -- there is no cohort, no peer distribution, and nothing that could produce that
// sentence. It read as a real benchmark and it was decoration. What this can honestly say
// is what YOUR work has done, against the bar the work itself was set.
function summaryNote(state) {
  const { avgScore, tasksCompleted } = state.performance;
  if (avgScore === null) return "No graded work yet — your first sign-off is what starts this.";
  const dataAxes = state.skillMatrix.filter((a) => a.hasData);
  const weakest = dataAxes.length ? [...dataAxes].sort((a, b) => a.value - b.value)[0] : null;
  const base = `${tasksCompleted} piece${tasksCompleted === 1 ? '' : 's'} of work signed off, averaging ${avgScore}.`;
  const focus = weakest
    ? ` The weakest of your marks so far is '${weakest.label}' — that is where the next point is.`
    : ' A few more tasks and the skill breakdown fills in.';
  return base + focus;
}

function KpiCard({ index, icon: Icon, iconClass, label, value, corner, children }) {
  return (
    <BentoCard index={index} className="flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${iconClass}`}>
          <Icon size={26} className="text-white" strokeWidth={2.1} />
        </div>
        {corner}
      </div>
      <div className="text-3xl font-extrabold leading-none">{value}</div>
      <div className="text-[14px] text-gray-500 font-medium mt-1.5 mb-2">{label}</div>
      <div className="mt-auto">{children}</div>
    </BentoCard>
  );
}

export default function Overview({ state, learnerName, learnerPhotoUrl, onStateChange }) {
  const { performance, attendance, tasks, skillMatrix, shoutouts, checklist, learningPath, milestone, promotion, messages, roster } = state;
  const streak = attendance.streak;
  const personalBest = performance.personalBest;

  const activity = messages.filter((m) => !m.body.startsWith('Submitted:') && m.sender_archetype !== 'learner').slice(-6).reverse();
  const rosterByArchetype = Object.fromEntries(roster.map((p) => [p.archetype, p]));

  async function toggleItem(item) {
    const data = await api.toggleChecklist(item.key, !item.checked);
    onStateChange(data.state);
  }

  const milestonePct = milestone
    ? Math.round((milestone.requirements.reduce((s, r) => s + r.current / r.target, 0) / milestone.requirements.length) * 100)
    : 0;
  const tasksPct = performance.tasksTotal ? Math.round((performance.tasksCompleted / performance.tasksTotal) * 100) : 0;
  // What is actually workable. state.tasks are raw rows, so this reads opens_at directly
  // rather than the taskBoard's derived notYetOpen, which is not on them. A task whose day
  // has not arrived is not open, and listing all of those is what made this card a wall.
  const nowMs = Date.now();
  const openTasks = tasks.filter((t) => t.status !== 'graded'
    && (!t.opens_at || Date.parse(t.opens_at) <= nowMs));
  const delta = performance.scoreDeltaToday;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-16 gap-4 sm:gap-6">
      <div className="min-w-0 xl:col-span-11 space-y-4 sm:space-y-6">

        {/* KPI row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
          <KpiCard
            index={0} icon={CheckCircle2} iconClass="bg-gradient-to-br from-indigo-500 to-indigo-400"
            label="Tasks completed" value={`${performance.tasksCompleted}/${performance.tasksTotal}`}
            corner={<CircularProgress value={performance.tasksCompleted} max={performance.tasksTotal || 1} size={40} strokeWidth={4.5} colorClass="text-indigo-600" />}
          >
            <div className="text-xs font-semibold text-indigo-600">{tasksPct}% complete</div>
          </KpiCard>
          <KpiCard
            index={1} icon={BarChart3} iconClass="bg-gradient-to-br from-fuchsia-500 via-purple-500 to-indigo-500"
            label="Performance Score" value={performance.avgScore === null ? '—' : `${performance.avgScore}%`}
          >
            <div className="text-xs text-gray-500 font-medium">
              Avg Grade: <span className="text-gray-700 font-semibold">{performance.avgGrade === null ? '—' : `${performance.avgGrade}%`}</span>
            </div>
            {delta !== null && (
              <div className={`text-xs font-bold mt-0.5 ${delta > 0 ? 'text-emerald-700' : delta < 0 ? 'text-red-500' : 'text-gray-500'}`}>
                {delta > 0 ? '+' : ''}{delta}% today
              </div>
            )}
          </KpiCard>
          <KpiCard index={2} icon={CalendarDays} iconClass="bg-gradient-to-br from-amber-500 to-amber-400" label="Attendance days" value={`${attendance.attendedDays}/${attendance.milestoneDays}`}>
            <ProgressBar value={attendance.attendedDays} max={attendance.milestoneDays} colorClass="from-amber-500 to-amber-300" />
          </KpiCard>
          <KpiCard index={3} icon={Clock} iconClass="bg-gradient-to-br from-purple-500 to-purple-400" label="Open workload" value={`${performance.hoursOpen}h`}>
            <ProgressBar value={performance.hoursCompleted} max={performance.hoursAssigned || 1} colorClass="from-purple-500 to-indigo-400" />
            <p className="text-xs text-gray-500 mt-2">
              {performance.hoursOpen === 0
                ? 'All caught up — nice work.'
                : `≈${performance.daysAtPace} ${performance.daysAtPace === 1 ? 'day' : 'days'} at ${performance.hoursPerDayTarget}h/day`}
            </p>
          </KpiCard>
        </div>

        {/* Middle row — the skill radar needs the widest slot, its axis labels clip below ~300px */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
          {/* An overview summarises; it does not re-list the Tasks tab. This card used to
              print every assigned task — thirty of them at manager level, each wrapping to
              three lines in a quarter-width column, 1,912px tall. Because a grid row is as
              tall as its tallest cell, it also stretched the two cards beside it to 1,912px
              and left about 1,500px of white in each. It now shows the shape of the week
              and the few things actually open, and points at the tab that holds the rest. */}
          <BentoCard index={4} className="lg:col-span-4">
            <h3 className="text-base font-bold mb-1">Task progress</h3>
            <p className="text-xs text-gray-500 mb-3.5">
              {performance.tasksCompleted} of {performance.tasksTotal} signed off
            </p>
            <ProgressBar
              value={performance.tasksCompleted}
              max={performance.tasksTotal || 1}
              colorClass="from-teal-500 to-emerald-400"
            />

            {openTasks.length ? (
              <>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mt-4 mb-2">Open now</p>
                <div className="space-y-2.5">
                  {openTasks.slice(0, 4).map((t) => (
                    <button
                      key={t.id}
                      onClick={() => onTab && onTab('tasks')}
                      className="w-full flex items-start gap-2.5 text-left group"
                    >
                      <Circle size={17} className="text-gray-300 shrink-0 mt-0.5" strokeWidth={2.3} />
                      <span className="text-sm font-medium text-gray-700 leading-snug group-hover:text-indigo-700">{t.title}</span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-500 mt-4">
                {tasks.length ? 'Nothing open right now.' : 'No tasks assigned yet.'}
              </p>
            )}

            {tasks.length > 0 && (
              <button
                onClick={() => onTab && onTab('tasks')}
                className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-indigo-700 hover:text-indigo-800"
              >
                {openTasks.length > 4
                  ? `See all ${tasks.length} in Tasks`
                  : 'Open the Tasks board'}
                <ArrowRight size={13} />
              </button>
            )}
          </BentoCard>

          <BentoCard index={5} className="lg:col-span-5">
            <h3 className="text-base font-bold mb-1">Skill matrix</h3>
            <SkillRadar axes={skillMatrix} learnerName={learnerName} learnerPhotoUrl={learnerPhotoUrl} />
          </BentoCard>

          <BentoCard index={6} className="lg:col-span-3 flex flex-col">
            <h3 className="text-base font-bold mb-3.5">Momentum</h3>

            <div className="flex items-center gap-3.5">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-orange-500 to-amber-400 flex items-center justify-center shrink-0">
                <Flame size={26} className="text-white" strokeWidth={2.1} />
              </div>
              <div className="min-w-0">
                <div className="text-3xl font-extrabold leading-none">{streak.current}</div>
                <div className="text-[14px] text-gray-500 font-medium mt-1">
                  {streak.current === 1 ? 'day streak' : 'day streak'}
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-3">
              {streak.current === 0
                ? 'Check in today to start a streak.'
                : attendance.checkedInToday
                  ? `Longest streak: ${streak.longest} ${streak.longest === 1 ? 'day' : 'days'}.`
                  : "Check in today to keep it alive."}
            </p>

            <div className="border-t border-gray-100 mt-4 pt-4">
              <div className="flex items-center gap-2.5 mb-2">
                <Award size={20} className="text-teal-500" strokeWidth={2.3} />
                <span className="text-sm font-bold">Personal best</span>
              </div>
              {personalBest ? (
                <>
                  <div className="text-2xl font-extrabold leading-none">{personalBest.score}%</div>
                  <p className="text-xs text-gray-500 mt-1.5 leading-snug">{personalBest.title}</p>
                </>
              ) : (
                <p className="text-xs text-gray-500">Complete a task to set your first best score.</p>
              )}
            </div>
          </BentoCard>
        </div>

        {/* Bottom row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          <BentoCard index={7} className="lg:col-span-2">
            <h3 className="text-base font-bold mb-3.5">Recent activity</h3>
            <div className="space-y-4">
              {activity.map((m) => (
                <div key={m.id} className="flex items-start gap-3.5">
                  <Avatar
                    name={m.sender_name}
                    avatarUrl={rosterByArchetype[m.sender_archetype]?.avatarUrl}
                    photoUrl={m.sender_archetype === 'learner' ? learnerPhotoUrl : undefined}
                    size={38}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold">{m.sender_name}</span>
                      <Pill className={ROLE_BADGE[m.sender_archetype] || ROLE_BADGE.learner}>{(ROLE_TITLE[m.sender_archetype] || m.sender_archetype).toUpperCase()}</Pill>
                      <span className="text-xs text-gray-500">{new Date(m.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">{m.body}</p>
                  </div>
                </div>
              ))}
              {!activity.length && <p className="text-sm text-gray-500">Nothing yet.</p>}
            </div>
          </BentoCard>

          <div className="space-y-6">
            <BentoCard index={8}>
              <div className="flex items-center gap-2.5 mb-2.5">
                <Target size={22} className="text-indigo-600" />
                <h3 className="text-base font-bold">Weekly goal: 80% performance score</h3>
              </div>
              <ProgressBar value={performance.avgScore || 0} max={80} colorClass="from-indigo-500 to-teal-400" />
              <p className="text-xs text-gray-500 mt-2.5">{performance.avgScore === null ? 'No graded tasks yet.' : `Currently at ${performance.avgScore}.`}</p>
            </BentoCard>
            <BentoCard index={9} hover={false} className="bg-gradient-to-br from-indigo-50 to-teal-50 border-0">
              <p className="text-sm text-indigo-900 leading-relaxed">{summaryNote(state)}</p>
            </BentoCard>
          </div>
        </div>
      </div>

      {/* Far right column */}
      <div className="min-w-0 xl:col-span-5 space-y-4 sm:space-y-6">
        <BentoCard index={2}>
          <div className="flex items-center gap-2.5 mb-3.5">
            <ClipboardList size={22} className="text-indigo-600" />
            <h3 className="text-base font-bold">Quick tasks</h3>
          </div>
          <div className="space-y-3">
            {checklist.map((item) => (
              <label key={item.key} className="flex items-center gap-2.5 cursor-pointer select-none">
                <input type="checkbox" checked={item.checked} onChange={() => toggleItem(item)} className="w-4 h-4 rounded accent-indigo-500" />
                <span className={`text-sm ${item.checked ? 'line-through text-gray-500' : 'text-gray-700'}`}>{item.label}</span>
              </label>
            ))}
          </div>
        </BentoCard>

        <BentoCard index={3}>
          <div className="flex items-center gap-2.5 mb-3.5">
            <Quote size={22} className="text-amber-500" />
            <h3 className="text-base font-bold">Manager shoutouts</h3>
          </div>
          {shoutouts.length ? (
            <div className="space-y-4">
              {shoutouts.map((s) => (
                <div key={s.taskId} className="border-l-2 border-amber-300 pl-3">
                  <p className="text-sm text-gray-700 leading-snug line-clamp-4">{s.feedback}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Avatar name={s.from} avatarUrl={rosterByArchetype.line_manager?.avatarUrl} size={22} />
                    <span className="text-xs font-semibold text-gray-600">{s.from}</span>
                    <Pill className="bg-amber-50 text-amber-700">{s.score}%</Pill>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 truncate">{s.title}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 leading-snug">Score 80% or higher on a task and your manager's feedback shows up here.</p>
          )}
        </BentoCard>

        <BentoCard index={4}>
          <div className="flex items-center gap-2.5 mb-3.5">
            <GraduationCap size={22} className="text-teal-500" />
            <h3 className="text-base font-bold">Suggested learning path</h3>
          </div>
          <div className="space-y-3.5">
            {learningPath.map((m) => (
              <div key={m.title}>
                <div className="text-sm font-semibold text-gray-700">{m.title}</div>
                <div className="text-xs text-gray-500 leading-snug mt-0.5">{m.note}</div>
              </div>
            ))}
          </div>
        </BentoCard>

        {/* Promotion. The two criteria are shown separately with their real numbers,
            because "you were not promoted" is a sentence that has to come with the
            arithmetic behind it — a single bar would hide which half is short. */}
        {promotion && (
          <BentoCard index={5} className={promotion.atTheTop ? 'border-emerald-200 bg-emerald-50/40' : ''}>
            <div className="flex items-center gap-2.5 mb-1.5">
              <TrendingUp size={22} className={promotion.atTheTop ? 'text-emerald-700' : 'text-indigo-600'} />
              <h3 className="text-base font-bold">
                {promotion.atTheTop ? 'Top of the ladder'
                  : promotion.negotiation?.open ? 'Promotion conversation open'
                  : 'Promotion track'}
              </h3>
            </div>
            <p className="text-sm text-gray-500 mb-3.5">
              {promotion.atTheTop ? (
                <>You are <span className="font-semibold text-gray-800">{promotion.toTitle}</span> — there is no rung above this one.</>
              ) : (
                <>Next level: <span className="font-semibold text-gray-700">{promotion.toTitle}</span></>
              )}
            </p>
            {/* Once the conversation is open the learner knows the number and which
                project decides it, so the card says both. Before that it is deliberately
                quiet — a target you cannot yet act on is pressure, not information. */}
            {promotion.negotiation?.open && !promotion.atTheTop && (
              <p className="text-xs text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg px-2.5 py-2 mb-3.5 leading-relaxed">
                {promotion.negotiation.projectsLeft > 0
                  ? `Asha has opened your review. It is decided when project ${promotion.negotiation.decidesAfter} is signed off — ${promotion.negotiation.projectsLeft} to go.`
                  : 'Asha has opened your review. Every task from here counts toward the decision.'}
              </p>
            )}
            <div className="space-y-3">
              {promotion.criteria.map((c) => (
                <div key={c.key} className="flex items-start gap-2.5">
                  <CheckCircle2
                    size={20}
                    className={c.met ? 'text-emerald-500 mt-px' : 'text-gray-200 mt-px'}
                    strokeWidth={2.3}
                  />
                  <div className="min-w-0">
                    <p className="text-sm text-gray-700 leading-snug">{c.label}</p>
                    <p className={`text-xs font-semibold ${c.met ? 'text-emerald-700' : 'text-gray-500'}`}>{c.detail}</p>
                  </div>
                </div>
              ))}
            </div>
            {!promotion.atTheTop && promotion.shortfall !== null && (
              <p className="text-xs text-gray-500 mt-3.5 leading-relaxed">
                {promotion.shortfall} points short on average score. Every task you deliver moves it.
              </p>
            )}
          </BentoCard>
        )}

        {milestone && (
          <BentoCard index={6}>
            <div className="flex items-center gap-2.5 mb-1.5">
              <Trophy size={22} className="text-amber-500" />
              <h3 className="text-base font-bold">Career milestones</h3>
            </div>
            <p className="text-sm text-gray-500 mb-2.5">Working towards: <span className="font-semibold text-gray-700">{milestone.targetRole}</span></p>
            <ProgressBar value={milestonePct} max={100} colorClass="from-amber-500 to-orange-400" />
            <div className="space-y-2.5 mt-3.5">
              {milestone.requirements.map((r) => (
                <div key={r.key} className="flex items-center gap-2.5">
                  <CheckCircle2 size={20} className={r.done ? 'text-amber-500' : 'text-gray-200'} strokeWidth={2.3} />
                  <span className="text-sm text-gray-700">{r.label} <span className="text-gray-500">({r.current}/{r.target})</span></span>
                </div>
              ))}
            </div>
          </BentoCard>
        )}
      </div>
    </div>
  );
}
