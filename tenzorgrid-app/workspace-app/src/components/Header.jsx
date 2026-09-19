import React from 'react';
import { motion } from 'framer-motion';
import { LogOut, Menu } from 'lucide-react';
import AppLauncher from './AppLauncher.jsx';


// The strip above every page: where you are, and the two controls that belong to the
// session rather than to any one screen. It used to carry a "Welcome back" h1 on every
// tab, which Milestone 02 removed -- see below.
export default function Header({ company, employee, apps, state, onLaunchApp, checkedIn, onToggleCheckIn, onLogout, onOpenMenu }) {
  return (
    <div className="flex items-start justify-between gap-3 sm:gap-6 mb-6 flex-wrap">
      <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
        {/* The only way back to the nav once the rail becomes a drawer. */}
        <button
          onClick={onOpenMenu}
          aria-label="Open the menu"
          className="lg:hidden p-2 -ml-1 rounded-lg text-slate-500 hover:bg-slate-100 shrink-0"
        >
          <Menu size={22} />
        </button>
        {/* No <h1> here any more.
            Every page owns its own heading now -- "My Work", "Inbox", "Performance" --
            and the greeting sat above them as a second, louder h1 saying "Welcome back"
            on a screen the learner had navigated to on purpose. Two h1s is an
            accessibility fault and the wrong words at the top of the page. Home carries
            its own greeting; everywhere else this strip just says where you are. */}
        <div className="min-w-0 flex items-center gap-2.5">
          {company && (
            <span className="lg:hidden shrink-0 w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center text-[12px] font-extrabold tracking-tight">
              {company.mark}
            </span>
          )}
          <div className="min-w-0">
            <span className="block lg:hidden text-[13px] font-bold text-slate-700 truncate">
              {company ? company.name : 'Workspace'}
            </span>
            <span className="hidden lg:block text-[13px] font-semibold text-slate-500 truncate">
              {company && employee
                ? `${company.name} · ${employee.department} · ${employee.team}`
                : (company ? company.name : 'Virtual Workspace')}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2.5 sm:gap-4">
        {/* The company's tools. A utility beside the session controls, not a sixth thing
            competing with the navigation for what the product is shaped like. */}
        <AppLauncher apps={apps} state={state} onLaunch={onLaunchApp} />
        <button
          onClick={onToggleCheckIn}
          disabled={checkedIn}
          className="flex items-center gap-2.5"
        >
          <span
            className={`relative block w-9 h-5 rounded-full transition-colors shrink-0 ${
              checkedIn ? 'bg-gradient-to-r from-teal-500 to-indigo-500' : 'bg-gray-200'
            }`}
          >
            <motion.span
              className="absolute top-0.5 left-0.5 block w-4 h-4 rounded-full bg-white shadow"
              animate={{ x: checkedIn ? 16 : 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            />
          </span>
          <span className={`text-xs font-bold ${checkedIn ? 'text-teal-600' : 'text-gray-500'}`}>{checkedIn ? 'Checked In' : 'Check in'}</span>
        </button>

        {/* No badge here. A red count of outstanding work used to hang off this button,
            which read either as a rendering fault or as the product counting reasons not
            to leave. Work is counted in the navigation, beside the page that shows it. */}
        <button
          onClick={onLogout}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 shadow-sm"
        >
          <LogOut size={17} /> Log out
        </button>
      </div>
    </div>
  );
}
