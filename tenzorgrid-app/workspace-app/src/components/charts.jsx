import React from 'react';
import {
  LineChart, Line, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  BarChart, Bar, XAxis, CartesianGrid, Tooltip, LabelList,
  PieChart, Pie, Cell,
} from 'recharts';
import { Avatar } from './ui.jsx';

// Skill points per axis. This is ONE measure compared across categories, so every bar
// takes the same hue — colouring each bar differently would encode rank, which carries
// no information and is a well-known chart anti-pattern. Values are direct-labelled, so
// the y-axis is dropped entirely and the grid stays recessive.
export function SkillPointsBar({ data }) {
  if (!data || !data.length) {
    return (
      <div className="h-44 flex items-center justify-center text-sm text-gray-400 font-medium text-center px-4">
        No skill points yet — they're earned when a task is graded.
      </div>
    );
  }
  return (
    <div className="h-44 -mx-1">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 22, right: 8, bottom: 0, left: 8 }}>
          <CartesianGrid vertical={false} stroke="#f1f5f9" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11.5, fill: '#64748b', fontWeight: 600 }}
            axisLine={false}
            tickLine={false}
            interval={0}
          />
          <Tooltip
            cursor={{ fill: '#f8fafc' }}
            contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12, boxShadow: '0 6px 16px -6px rgba(15,23,42,.15)' }}
            labelStyle={{ fontWeight: 700, color: '#334155' }}
            formatter={(v) => [`${v} pts`, 'Skill points']}
          />
          <Bar dataKey="points" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={44} isAnimationActive>
            <LabelList dataKey="points" position="top" style={{ fill: '#334155', fontSize: 11.5, fontWeight: 700 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Sparkline({ data, dataKey = 'score', color = '#14b8a6', height = 'h-10', emptyNote = 'Not enough data yet' }) {
  if (!data || data.length < 2) {
    return <div className={`${height} flex items-center text-xs text-gray-400 font-medium`}>{emptyNote}</div>;
  }
  return (
    <div className={`${height} -mx-1`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2.4} dot={false} isAnimationActive />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// Status colours are reserved and semantic here — good / neutral / warning / critical —
// never reused as decorative series colours. The legend carries a label and a count
// beside every swatch, so the split is never communicated by colour alone.
const HEALTH_COLOR = {
  onTime: '#10b981',
  inProgress: '#94a3b8',
  late: '#f59e0b',
  overdue: '#ef4444',
};

export function TaskHealthDonut({ data, onTimeRate }) {
  const total = (data || []).reduce((s, d) => s + d.value, 0);
  if (!total) {
    return (
      <div className="h-40 flex items-center justify-center text-sm text-gray-400 font-medium text-center px-4">
        No tasks with a deadline yet.
      </div>
    );
  }
  // Stacked rather than side-by-side: in a narrow analytics column a side legend
  // truncates its own labels ("On time" -> "O..."), which defeats the point of
  // labelling the slices at all.
  return (
    <div className="space-y-3">
      <div className="relative w-28 h-28 mx-auto">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data} dataKey="value" nameKey="label"
              innerRadius="62%" outerRadius="100%" paddingAngle={2} stroke="#fff" strokeWidth={2}
              isAnimationActive
            >
              {data.map((d) => <Cell key={d.key} fill={HEALTH_COLOR[d.key]} />)}
            </Pie>
            <Tooltip
              contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }}
              formatter={(v, n) => [`${v} task${v === 1 ? '' : 's'}`, n]}
            />
          </PieChart>
        </ResponsiveContainer>
        {onTimeRate !== null && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-lg font-extrabold leading-none text-gray-900">{onTimeRate}%</span>
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wide mt-0.5">On time</span>
          </div>
        )}
      </div>
      <div className="space-y-1.5">
        {data.map((d) => (
          <div key={d.key} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: HEALTH_COLOR[d.key] }} />
            <span className="text-gray-600 font-medium flex-1 min-w-0">{d.label}</span>
            <span className="font-bold text-gray-800 shrink-0">{d.value}</span>
            <span className="text-gray-400 shrink-0 w-9 text-right">{Math.round((d.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Average turnaround per priority: one measure across categories, so a single hue —
// colouring each bar by its priority would restate the label, not add information.
export function TaskVelocityBar({ data }) {
  if (!data || !data.length) {
    return (
      <div className="h-40 flex items-center justify-center text-sm text-gray-400 font-medium text-center px-4">
        No delivered tasks yet — turnaround appears once work is graded.
      </div>
    );
  }
  // Sub-hour turnarounds would round away to "0h", so the unit follows the data.
  const useHours = Math.max(...data.map((d) => d.minutes)) >= 120;
  const fmt = (m) => (useHours ? `${Math.round((m / 60) * 10) / 10}h` : `${m}m`);
  return (
    <div className="h-40 -mx-1">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 22, right: 8, bottom: 0, left: 8 }}>
          <CartesianGrid vertical={false} stroke="#f1f5f9" />
          <XAxis dataKey="label" tick={{ fontSize: 11.5, fill: '#64748b', fontWeight: 600 }} axisLine={false} tickLine={false} interval={0} />
          <Tooltip
            cursor={{ fill: '#f8fafc' }}
            contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }}
            labelStyle={{ fontWeight: 700, color: '#334155' }}
            formatter={(v, n, p) => [`${fmt(v)} avg over ${p.payload.count} task${p.payload.count === 1 ? '' : 's'}`, 'Turnaround']}
          />
          <Bar dataKey="minutes" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={44} isAnimationActive>
            <LabelList dataKey="minutes" position="top" formatter={fmt} style={{ fill: '#334155', fontSize: 11.5, fontWeight: 700 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// A single-value meter. One hue per gauge because each is its own magnitude, not a
// category being compared — and the value is printed, so the reading never depends on
// judging an arc by eye.
export function SkillGauge({ label, value, hasData }) {
  const pct = Math.max(0, Math.min(100, value || 0));
  const data = [{ v: pct }, { v: 100 - pct }];
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-24 h-12">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data} dataKey="v" cx="50%" cy="100%"
              startAngle={180} endAngle={0}
              innerRadius="70%" outerRadius="100%"
              stroke="none" isAnimationActive
            >
              <Cell fill={hasData ? '#6366f1' : '#e2e8f0'} />
              <Cell fill="#f1f5f9" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-x-0 bottom-0 text-center">
          <span className={`text-sm font-extrabold ${hasData ? 'text-slate-900' : 'text-slate-300'}`}>
            {hasData ? pct : '—'}
          </span>
        </div>
      </div>
      <span className="text-[11px] font-bold text-slate-500 mt-1">{label}</span>
    </div>
  );
}

// Progress per project. One measure across categories, so a single hue.
export function MilestoneBars({ data }) {
  if (!data || !data.length) {
    return <div className="h-40 flex items-center justify-center text-sm text-slate-400 font-medium">No projects yet.</div>;
  }
  return (
    <div className="h-40 -mx-1">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 22, right: 8, bottom: 0, left: 8 }}>
          <CartesianGrid vertical={false} stroke="#f1f5f9" />
          <XAxis dataKey="short" tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} axisLine={false} tickLine={false} interval={0} />
          <Tooltip
            cursor={{ fill: '#f8fafc' }}
            contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }}
            formatter={(v, n, p) => [`${v}% — ${p.payload.status}`, p.payload.title]}
          />
          <Bar dataKey="progressPct" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={46} isAnimationActive>
            <LabelList dataKey="progressPct" position="top" formatter={(v) => `${v}%`} style={{ fill: '#334155', fontSize: 11, fontWeight: 700 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SkillRadar({ axes, learnerName, learnerPhotoUrl }) {
  const hasAnyData = axes.some((a) => a.hasData);
  return (
    <div className="relative h-64 -mx-2">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={axes} outerRadius="42%" margin={{ top: 10, right: 58, bottom: 10, left: 58 }}>
          <PolarGrid stroke="#eef0f4" />
          <PolarAngleAxis dataKey="label" tick={{ fontSize: 11.5, fill: '#4b5563', fontWeight: 700 }} />
          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
          <Radar dataKey="value" stroke="#6366f1" fill="#6366f1" fillOpacity={0.22} strokeWidth={2} isAnimationActive />
        </RadarChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <Avatar name={learnerName} photoUrl={learnerPhotoUrl} size={40} className="ring-2 ring-white shadow" />
      </div>
      {!hasAnyData && (
        <p className="absolute bottom-0 inset-x-0 text-center text-xs text-gray-400 font-medium">Complete a task to populate your skill matrix</p>
      )}
    </div>
  );
}
