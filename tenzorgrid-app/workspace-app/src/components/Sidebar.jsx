import React, { useEffect, useState } from 'react';
import { ArrowLeft, LogOut, X } from 'lucide-react';
import { Avatar } from './ui.jsx';
import { navigationFor, badgeFor, SETTINGS_ITEM } from '../lib/navigation.js';

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);
  return now;
}

const WEATHER_BY_HOUR = (h) => (h < 6 ? 'clear night' : h < 12 ? 'mostly clear' : h < 17 ? 'partly cloudy' : h < 20 ? 'mostly clear' : 'clear night');

const BADGE_TONE = {
  rose: 'bg-rose-600 text-white',
  amber: 'bg-amber-500 text-white',
  slate: 'bg-slate-200 text-slate-700',
};

// One destination. `primary` is the difference between a place you go every day and a
// place you go when something needs filing -- it buys a slightly heavier weight and a
// slightly darker ink, not a different shape. Making every item identical was the thing
// that made twelve tabs read as twelve equally important training modules.
function NavItem({ item, active, onPick, count }) {
  const Icon = item.icon;
  return (
    <button
      onClick={() => onPick(item.id)}
      aria-current={active ? 'page' : undefined}
      title={item.hint}
      className={`group relative w-full flex items-center gap-2.5 pl-3 pr-2.5 py-2 rounded-lg text-left
        transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-1
        ${active ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}
    >
      {/* A 2px rule at the leading edge. An enterprise product says "you are here" with a
          mark in the margin, not with a glowing pill. */}
      <span
        aria-hidden="true"
        className={`absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full transition-colors ${
          active ? 'bg-slate-900' : 'bg-transparent'}`}
      />
      <Icon size={17} strokeWidth={active ? 2.3 : 1.9} className="shrink-0" />
      <span className={`flex-1 truncate ${
        item.primary ? 'text-[14px] font-semibold' : 'text-[13px] font-medium'}`}>
        {item.label}
      </span>
      {count > 0 && (
        <span className={`shrink-0 min-w-[19px] px-1.5 py-0.5 rounded-full text-[11px] font-bold text-center tabular-nums ${
          BADGE_TONE[item.badgeTone] || BADGE_TONE.slate}`}>
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  );
}

// On a phone the 240px rail took 60% of the screen and pushed the content off the edge —
// the page scrolled 431px sideways on a 390px device. Below `lg` it is a drawer instead:
// off-canvas by default, slid in over a scrim when the header's menu button is pressed.
// Above `lg` it is exactly the rail it always was, so nothing changes on a laptop.
export default function Sidebar({
  tab, onTab, roleLabel, levelLabel, level, company, employee, state,
  onLogout, open = false, onClose,
}) {
  const sections = navigationFor(level);
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
        aria-label={company ? `${company.name} navigation` : 'Workspace navigation'}
        className={`w-60 shrink-0 border-r border-slate-200 bg-white flex flex-col h-screen px-3 py-4
          fixed inset-y-0 left-0 z-40 transition-transform duration-200 overflow-y-auto
          ${open ? 'translate-x-0' : '-translate-x-full'}
          lg:sticky lg:top-0 lg:translate-x-0 lg:z-auto`}
      >
        {/* The employer is the identity inside the workspace; TenzorGrid is the platform it
            runs on and sits underneath it. A learner should see who they work for first. */}
        <div className="px-2 pb-3.5 mb-2 border-b border-slate-100 flex items-center gap-2.5">
          {company ? (
            <>
              <span className="shrink-0 w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center text-[12px] font-extrabold tracking-tight">
                {company.mark}
              </span>
              <span className="min-w-0">
                <span className="block font-extrabold text-slate-900 text-[14px] leading-tight truncate">{company.name}</span>
                <span className="block text-[11px] text-slate-400 leading-tight truncate">
                  on Tenzor<span className="text-teal-700 font-semibold">Grid</span>
                </span>
              </span>
            </>
          ) : (
            <>
              <img src="/assets/icon.svg" alt="" className="w-7 h-7" />
              <span className="font-extrabold text-slate-900">Tenzor<span className="text-teal-700">Grid</span></span>
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

        <nav className="flex-1 flex flex-col gap-0.5 pb-2" aria-label="Workplace">
          {sections.map((section) => (
            <div key={section.key} className={section.label ? 'mt-3.5' : ''}>
              {section.label && (
                <div
                  id={`nav-section-${section.key}`}
                  className="px-3 pb-1 text-[10px] font-bold tracking-[0.13em] text-slate-400 uppercase select-none"
                >
                  {section.label}
                </div>
              )}
              <div
                className="flex flex-col gap-0.5"
                role="group"
                aria-labelledby={section.label ? `nav-section-${section.key}` : undefined}
              >
                {section.items.map((item) => (
                  <NavItem
                    key={item.id}
                    item={item}
                    active={tab === item.id}
                    onPick={pick}
                    count={badgeFor(item, state)}
                  />
                ))}
              </div>
            </div>
          ))}

          {/* Outside the groups, against the bottom of the list: not a workplace
              destination, just where your own preferences live. */}
          <div className="mt-auto pt-3">
            <NavItem item={SETTINGS_ITEM} active={tab === SETTINGS_ITEM.id} onPick={pick} count={0} />
          </div>
        </nav>

        <div className="pt-3 border-t border-slate-100 space-y-2">
          {/* Who you are here, quietly. The role strip used to be a filled indigo block
              that shouted louder than the company name above it. */}
          <div className="flex items-center gap-2.5 px-2">
            <Avatar name={employee ? employee.name : ''} size={28} />
            <div className="min-w-0">
              <div className="text-[12px] font-bold text-slate-700 leading-tight truncate">{levelLabel || roleLabel}</div>
              <div className="text-[11px] text-slate-400 leading-tight truncate">
                {employee ? employee.team : roleLabel}
              </div>
            </div>
          </div>
          <div className="px-2 text-[11px] text-slate-400 font-medium">
            {time} · {date} · {weather}
          </div>
          <div className="flex flex-col gap-0.5">
            <a
              href="/dashboard.html"
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-800 whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            >
              <ArrowLeft size={16} className="shrink-0" /> Dashboard
            </a>
            <button
              onClick={onLogout}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-800 whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            >
              <LogOut size={16} className="shrink-0" /> Log out
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
