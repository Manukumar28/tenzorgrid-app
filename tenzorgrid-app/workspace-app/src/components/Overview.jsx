import React from 'react';
import { CheckCircle2, BarChart3, CalendarDays, Clock, Trophy, GraduationCap, ClipboardList, Target, Flame, Award, Quote } from 'lucide-react';
import { BentoCard, ProgressBar, CircularProgress, Pill, Avatar } from './ui.jsx';
import { SkillRadar } from './charts.jsx';
import { api } from '../api.js';

const ROLE_BADGE = {
  stakeholder: 'bg-blue-50 text-blue-600',
  line_manager: 'bg-emerald-50 text-emerald-600',
  people_partner: 'bg-amber-50 text-amber-600',
  learner: 'bg-gray-100 text-gray-500',
};
const ROLE_TITLE = {
  stakeholder: 'Business Stakeholder',
  line_manager: 'Line Manager',
  people_partner: 'People Ops',
  learner: 'You',
};

function summaryNote(state) {
  const { avgScore } = state.performance;
  if (avgScore === null) return "No graded tasks yet — complete your first task to see how you're tracking.";
  const dataAxes = state.skillMatrix.filter((a) => a.hasData);
  const weakest = dataAxes.length ? [...dataAxes].sort((a, b) => a.value - b.value)[0] : null;
  const base = avgScore >= 80 ? "Today's performance is on track relative to peers." : "Today's performance is a little behind target.";
  const focus = weakest ? ` Focus on '${weakest.label}' for further optimization.` : ' Complete more tasks to unlock a full skill breakdown.';
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
      <div className="text-[13px] text-gray-500 font-medium mt-1.5 mb-2">{label}</div>
      <div className="mt-auto">{children}</div>
    </BentoCard>
  );
}

export default function Overview({ state, learnerName, learnerPhotoUrl, onStateChange }) {
  const { performance, attendance, tasks, skillMatrix, shoutouts, checklist, learningPath, milestone, messages, roster } = state;
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
  const delta = performance.scoreDeltaToday;

  return (
    <div className="grid grid-cols-12 gap-6">
      <div className="col-span-12 xl:col-span-9 space-y-6">

        {/* KPI row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <KpiCard
            index={0} icon={CheckCircle2} iconClass="bg-gradient-to-br from-indigo-500 to-indigo-400"
            label="Tasks completed" value={`${performance.tasksCompleted}/${performance.tasksTotal}`}
            corner={<CircularProgress value={performance.tasksCompleted} max={performance.tasksTotal || 1} size={40} strokeWidth={4.5} colorClass="text-indigo-500" />}
          >
            <div className="text-xs font-semibold text-indigo-500">{tasksPct}% complete</div>
          </KpiCard>
          <KpiCard
            index={1} icon={BarChart3} iconClass="bg-gradient-to-br from-fuchsia-500 via-purple-500 to-indigo-500"
            label="Performance Score" value={performance.avgScore === null ? '—' : `${performance.avgScore}%`}
          >
            <div className="text-xs text-gray-500 font-medium">
              Avg Grade: <span className="text-gray-700 font-semibold">{performance.avgGrade === null ? '—' : `${performance.avgGrade}%`}</span>
            </div>
            {delta !== null && (
              <div className={`text-xs font-bold mt-0.5 ${delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-red-500' : 'text-gray-400'}`}>
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <BentoCard index={4} className="lg:col-span-3">
            <h3 className="text-base font-bold mb-3.5">Task progress</h3>
            <div className="space-y-3">
              {tasks.map((t) => (
                <div key={t.id} className="flex items-start gap-2.5">
                  <CheckCircle2 size={20} className={`shrink-0 mt-px ${t.status === 'graded' ? 'text-teal-500' : 'text-gray-200'}`} strokeWidth={2.3} />
                  <span className={`text-sm font-medium ${t.status === 'graded' ? 'line-through text-gray-400' : 'text-gray-700'}`}>{t.title}</span>
                </div>
              ))}
              {!tasks.length && <p className="text-sm text-gray-400">No tasks assigned yet.</p>}
            </div>
          </BentoCard>

          <BentoCard index={5} className="lg:col-span-5">
            <h3 className="text-base font-bold mb-1">Skill matrix</h3>
            <SkillRadar axes={skillMatrix} learnerName={learnerName} learnerPhotoUrl={learnerPhotoUrl} />
          </BentoCard>

          <BentoCard index={6} className="lg:col-span-4 flex flex-col">
            <h3 className="text-base font-bold mb-3.5">Your momentum</h3>

            <div className="flex items-center gap-3.5">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-orange-500 to-amber-400 flex items-center justify-center shrink-0">
                <Flame size={26} className="text-white" strokeWidth={2.1} />
              </div>
              <div className="min-w-0">
                <div className="text-3xl font-extrabold leading-none">{streak.current}</div>
                <div className="text-[13px] text-gray-500 font-medium mt-1">
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
                <p className="text-xs text-gray-400">Complete a task to set your first best score.</p>
              )}
            </div>
          </BentoCard>
        </div>

        {/* Bottom row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                      <span className="text-xs text-gray-400">{new Date(m.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">{m.body}</p>
                  </div>
                </div>
              ))}
              {!activity.length && <p className="text-sm text-gray-400">Nothing yet.</p>}
            </div>
          </BentoCard>

          <div className="space-y-6">
            <BentoCard index={8}>
              <div className="flex items-center gap-2.5 mb-2.5">
                <Target size={22} className="text-indigo-500" />
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
      <div className="col-span-12 xl:col-span-3 space-y-6">
        <BentoCard index={2}>
          <div className="flex items-center gap-2.5 mb-3.5">
            <ClipboardList size={22} className="text-indigo-500" />
            <h3 className="text-base font-bold">Quick tasks</h3>
          </div>
          <div className="space-y-3">
            {checklist.map((item) => (
              <label key={item.key} className="flex items-center gap-2.5 cursor-pointer select-none">
                <input type="checkbox" checked={item.checked} onChange={() => toggleItem(item)} className="w-4 h-4 rounded accent-indigo-500" />
                <span className={`text-sm ${item.checked ? 'line-through text-gray-300' : 'text-gray-700'}`}>{item.label}</span>
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
                    <Pill className="bg-amber-50 text-amber-600">{s.score}%</Pill>
                  </div>
                  <p className="text-xs text-gray-400 mt-1 truncate">{s.title}</p>
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

        {milestone && (
          <BentoCard index={5}>
            <div className="flex items-center gap-2.5 mb-1.5">
              <Trophy size={22} className="text-amber-500" />
              <h3 className="text-base font-bold">Career milestones</h3>
            </div>
            <p className="text-sm text-gray-500 mb-2.5">Target: <span className="font-semibold text-gray-700">{milestone.targetRole}</span></p>
            <ProgressBar value={milestonePct} max={100} colorClass="from-amber-500 to-orange-400" />
            <div className="space-y-2.5 mt-3.5">
              {milestone.requirements.map((r) => (
                <div key={r.key} className="flex items-center gap-2.5">
                  <CheckCircle2 size={20} className={r.done ? 'text-amber-500' : 'text-gray-200'} strokeWidth={2.3} />
                  <span className="text-sm text-gray-700">{r.label} <span className="text-gray-400">({r.current}/{r.target})</span></span>
                </div>
              ))}
            </div>
          </BentoCard>
        )}
      </div>
    </div>
  );
}
