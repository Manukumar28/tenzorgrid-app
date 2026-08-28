import React from 'react';
import { BentoCard } from './ui.jsx';

const DOWS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function CalendarTab({ state }) {
  const { attendance } = state;
  const now = new Date();
  const year = now.getFullYear(), month = now.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const attendedSet = new Set(attendance.days);
  const todayStr = now.toISOString().slice(0, 10);

  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <BentoCard hover={false}>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="text-sm font-bold">{now.toLocaleString(undefined, { month: 'long', year: 'numeric' })}</h3>
        <span className="text-xs text-gray-400"><b className="text-gray-700">{attendance.attendedDays}</b> / {attendance.milestoneDays} days toward your first certificate milestone</span>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {DOWS.map((d) => <div key={d} className="text-center text-[10px] font-bold text-gray-300 uppercase pb-1">{d}</div>)}
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const attended = attendedSet.has(dateStr);
          const isToday = dateStr === todayStr;
          return (
            <div
              key={i}
              className={`aspect-square rounded-lg flex items-center justify-center text-[12.5px] font-medium ${
                attended ? 'bg-gradient-to-br from-teal-500 to-teal-400 text-white font-bold' : 'bg-gray-50 text-gray-500'
              } ${isToday ? 'ring-2 ring-indigo-400' : ''}`}
            >
              {d}
            </div>
          );
        })}
      </div>
    </BentoCard>
  );
}
