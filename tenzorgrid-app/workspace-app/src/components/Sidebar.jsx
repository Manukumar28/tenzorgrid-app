import React, { useEffect, useState } from 'react';
import { LayoutGrid, FolderOpen, ClipboardCheck, Calendar, Mail, Users, Settings, ArrowLeft, LogOut, X, Sun, Clock3, ClipboardList, Star, Home } from 'lucide-react';

// `minLevel` hides a tab below that rung. It is a convenience only — the engine checks
// the level on every call, because a tab you cannot see is not a permission, it is a
// tidier menu.
const NAV = [
  { key: 'workday', label: 'Workday', icon: Home },
  { key: 'overview', label: 'Overview', icon: LayoutGrid },
  { key: 'today', label: 'Today', icon: Sun },
  { key: 'projects', label: 'Projects', icon: FolderOpen },
  { key: 'tasks', label: 'Tasks', icon: ClipboardCheck },
  { key: 'timesheets', label: 'Timesheets', icon: Clock3 },
  { key: 'attendance', label: 'Attendance', icon: ClipboardList, minLevel: 'lead' },
  { key: 'appraisal', label: 'Appraisal', icon: Star, minLevel: 'lead' },
  { key: 'calendar', label: 'Calendar', icon: Calendar },
  { key: 'emails', label: 'Emails', icon: Mail },
  { key: 'team', label: 'Team', icon: Users },
  { key: 'settings', label: 'Settings', icon: Settings },
];

const LEVEL_RANK = { junior: 0, senior: 1, lead: 2, manager: 3 };

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);
  return now;
}

const WEATHER_BY_HOUR = (h) => (h < 6 ? 'clear night' : h < 12 ? 'mostly clear' : h < 17 ? 'partly cloudy' : h < 20 ? 'mostly clear' : 'clear night');

// On a phone the 240px rail took 60% of the screen and pushed the content off the edge —
// the page scrolled 431px sideways on a 390px device. Below `lg` it is a drawer instead:
// off-canvas by default, slid in over a scrim when the header's menu button is pressed.
// Above `lg` it is exactly the rail it always was, so nothing changes on a laptop.
export default function Sidebar({ tab, onTab, roleLabel, levelLabel, level, company, onLogout, unreadCount = 0, open = false, onClose }) {
  const rank = LEVEL_RANK[level] === undefined ? 0 : LEVEL_RANK[level];
  const nav = NAV.filter((n) => !n.minLevel || rank >= LEVEL_RANK[n.minLevel]);
  const now = useClock();
  const time = now.toTimeString().slice(0, 5);
  const date = `${String(now.getDate()).padStart(2, '0')}-${now.toLocaleString('en', { month: 'short' }).toUpperCase()}-${now.getFullYear()}`;
  const weather = WEATHER_BY_HOUR(now.getHours());

  // Picking a tab on a phone should close the drawer — leaving it open over the thing you
  // just asked to see is the classic mobile-nav mistake.
  const pick = (key) => { onTab(key); if (onClose) onClose(); };

  return (
    <>
      {open && (
        <button
          onClick={onClose}
          aria-label="Close the menu"
          className="lg:hidden fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-[1px]"
        />
      )}
      <aside
        className={`w-60 shrink-0 border-r border-gray-100 bg-white flex flex-col h-screen px-3 py-5
          fixed inset-y-0 left-0 z-40 transition-transform duration-200
          ${open ? 'translate-x-0' : '-translate-x-full'}
          lg:sticky lg:top-0 lg:translate-x-0 lg:z-auto`}
      >
      {/* The employer is the identity inside the workspace; TenzorGrid is the platform it
          runs on and sits underneath it. A learner should see who they work for first. */}
      <div className="px-2 mb-6 flex items-center gap-2.5">
        {company ? (
          <>
            <span className="shrink-0 w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center text-[12px] font-extrabold tracking-tight">
              {company.mark}
            </span>
            <span className="min-w-0">
              <span className="block font-extrabold text-gray-900 text-[14px] leading-tight truncate">{company.name}</span>
              <span className="block text-[11px] text-gray-400 leading-tight truncate">
                on Tenzor<span className="text-teal-700 font-semibold">Grid</span>
              </span>
            </span>
          </>
        ) : (
          <>
            <img src="/assets/icon.svg" alt="" className="w-7 h-7" />
            <span className="font-extrabold text-gray-900">Tenzor<span className="text-teal-700">Grid</span></span>
          </>
        )}
        <button
          onClick={onClose}
          aria-label="Close the menu"
          className="lg:hidden ml-auto p-1.5 -mr-1 rounded-lg text-slate-500 hover:bg-slate-100"
        >
          <X size={18} />
        </button>
      </div>

      <nav className="flex-1 flex flex-col gap-1">
        {nav.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => pick(key)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
              tab === key ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
            }`}
          >
            <Icon size={26} strokeWidth={2} className="shrink-0" />
            <span className="flex-1">{label}</span>
            {key === 'emails' && unreadCount > 0 && (
              <span className="shrink-0 min-w-[20px] px-1.5 py-0.5 rounded-full bg-red-600 text-white text-[12px] font-bold text-center">
                {unreadCount}
              </span>
            )}
          </button>
        ))}
      </nav>

      <div className="mt-4 space-y-2">
        <div className="rounded-lg bg-indigo-50 px-3 py-2.5">
          <div className="text-[12px] font-bold tracking-wide text-indigo-700 uppercase">{roleLabel}</div>
          <div className="text-xs font-bold text-indigo-700">{levelLabel}</div>
        </div>
        <div className="rounded-lg bg-gray-50 px-3 py-2.5 text-[12px] text-gray-500 font-medium">
          {time}, {date}, {weather}
        </div>
        <div className="flex flex-col gap-1 pt-1">
          <a href="/dashboard.html" className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-semibold text-gray-500 hover:bg-gray-50 hover:text-gray-800 whitespace-nowrap">
            <ArrowLeft size={18} className="shrink-0" /> Dashboard
          </a>
          <button onClick={onLogout} className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-semibold text-gray-500 hover:bg-gray-50 hover:text-gray-800 whitespace-nowrap">
            <LogOut size={18} className="shrink-0" /> Log out
          </button>
        </div>
      </div>
      </aside>
    </>
  );
}
