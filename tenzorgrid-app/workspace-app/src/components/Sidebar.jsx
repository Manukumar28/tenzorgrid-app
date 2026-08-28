import React, { useEffect, useState } from 'react';
import { LayoutGrid, FolderOpen, ClipboardCheck, Calendar, Mail, Users, Settings, ArrowLeft, LogOut } from 'lucide-react';

const NAV = [
  { key: 'overview', label: 'Overview', icon: LayoutGrid },
  { key: 'projects', label: 'Projects', icon: FolderOpen },
  { key: 'tasks', label: 'Tasks', icon: ClipboardCheck },
  { key: 'calendar', label: 'Calendar', icon: Calendar },
  { key: 'emails', label: 'Emails', icon: Mail },
  { key: 'team', label: 'Team', icon: Users },
  { key: 'settings', label: 'Settings', icon: Settings },
];

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);
  return now;
}

const WEATHER_BY_HOUR = (h) => (h < 6 ? 'clear night' : h < 12 ? 'mostly clear' : h < 17 ? 'partly cloudy' : h < 20 ? 'mostly clear' : 'clear night');

export default function Sidebar({ tab, onTab, roleLabel, levelLabel, onLogout }) {
  const now = useClock();
  const time = now.toTimeString().slice(0, 5);
  const date = `${String(now.getDate()).padStart(2, '0')}-${now.toLocaleString('en', { month: 'short' }).toUpperCase()}-${now.getFullYear()}`;
  const weather = WEATHER_BY_HOUR(now.getHours());

  return (
    <aside className="w-60 shrink-0 border-r border-gray-100 bg-white flex flex-col h-screen sticky top-0 px-3 py-5">
      <div className="px-2 mb-6 flex items-center gap-2">
        <img src="/assets/icon.svg" alt="" className="w-7 h-7" />
        <span className="font-extrabold text-gray-900">Tenzor<span className="text-teal-500">Grid</span></span>
      </div>

      <nav className="flex-1 flex flex-col gap-1">
        {NAV.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => onTab(key)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
              tab === key ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
            }`}
          >
            <Icon size={17} strokeWidth={2.1} />
            {label}
          </button>
        ))}
      </nav>

      <div className="mt-4 space-y-2">
        <div className="rounded-lg bg-indigo-50 px-3 py-2.5">
          <div className="text-[10px] font-bold tracking-wide text-indigo-400 uppercase">{roleLabel}</div>
          <div className="text-xs font-bold text-indigo-700">{levelLabel}</div>
        </div>
        <div className="rounded-lg bg-gray-50 px-3 py-2.5 text-[11px] text-gray-500 font-medium">
          {time}, {date}, {weather}
        </div>
        <div className="flex items-center gap-1 pt-1">
          <a href="/dashboard.html" className="flex-1 flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-semibold text-gray-500 hover:bg-gray-50 hover:text-gray-800">
            <ArrowLeft size={14} /> Dashboard
          </a>
          <button onClick={onLogout} className="flex-1 flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-semibold text-gray-500 hover:bg-gray-50 hover:text-gray-800">
            <LogOut size={14} /> Log out
          </button>
        </div>
      </div>
    </aside>
  );
}
