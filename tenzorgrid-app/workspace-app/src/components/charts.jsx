import React from 'react';
import { LineChart, Line, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { Avatar } from './ui.jsx';

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
