import React from 'react';
import {
  LineChart, Line, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  BarChart, Bar, XAxis, CartesianGrid, Tooltip, LabelList,
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

export function Sparkline({ data }) {
  if (!data || data.length < 2) {
    return <div className="h-10 flex items-center text-xs text-gray-400 font-medium">Not enough data yet</div>;
  }
  return (
    <div className="h-10 -mx-1">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line type="monotone" dataKey="score" stroke="#14b8a6" strokeWidth={2.4} dot={false} isAnimationActive />
        </LineChart>
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
