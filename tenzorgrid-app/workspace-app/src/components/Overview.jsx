import React from 'react';
import { CheckCircle2, BarChart3, CalendarDays, Clock, Trophy, GraduationCap, ClipboardList, Target } from 'lucide-react';
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
  const { performance, attendance, tasks, skillMatrix, checklist, learningPath, milestone, messages, roster } = state;

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
          <KpiCard index={3} icon={Clock} iconClass="bg-gradient-to-br from-purple-500 to-purple-400" label="Hours assigned" value={`${performance.hoursAssigned}/${performance.hoursTarget}h`}>
            <ProgressBar value={performance.hoursAssigned} max={performance.hoursTarget} colorClass="from-purple-500 to-indigo-400" />
          </KpiCard>
        </div>

        {/* Middle row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <BentoCard index={4}>
            <h3 className="text-base font-bold mb-3.5">Task progress</h3>
            <div className="space-y-3">
              {tasks.map((t) => (
                <div key={t.id} className="flex items-center gap-2.5">
                  <CheckCircle2 size={20} className={t.status === 'graded' ? 'text-teal-500' : 'text-gray-200'} strokeWidth={2.3} />
                  <span className={`text-sm font-medium ${t.status === 'graded' ? 'line-through text-gray-400' : 'text-gray-700'}`}>{t.title}</span>
                </div>
              ))}
              {!tasks.length && <p className="text-sm text-gray-400">No tasks assigned yet.</p>}
            </div>
          </BentoCard>

          <BentoCard index={5}>
            <h3 className="text-base font-bold mb-1">Skill matrix</h3>
            <SkillRadar axes={skillMatrix} learnerName={learnerName} learnerPhotoUrl={learnerPhotoUrl} />
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
          <BentoCard index={4}>
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
