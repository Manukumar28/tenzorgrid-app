import React from 'react';
import { motion } from 'framer-motion';
import { LogOut, Menu } from 'lucide-react';
import { Avatar } from './ui.jsx';

// `compact` drops the greeting block and keeps only the controls. The Workday Home carries
// its own header -- company, greeting, date, who you are -- and two "Welcome back, Manu"
// lines stacked on one screen is the thing that makes a product look unfinished.
export default function Header({ name, photoUrl, roleLabel, company, employee, checkedIn, onToggleCheckIn, onLogout, pendingCount, onOpenMenu, compact }) {
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
        {compact ? (
          <div className="min-w-0 flex items-center gap-2.5">
            {company && (
              <span className="shrink-0 w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center text-[12px] font-extrabold tracking-tight lg:hidden">
                {company.mark}
              </span>
            )}
            <span className="text-[13px] font-bold text-slate-700 truncate lg:hidden">
              {company ? company.name : 'Workspace'}
            </span>
          </div>
        ) : (
          <>
            <Avatar name={name} photoUrl={photoUrl} size={52} className="ring-2 ring-white shadow-sm hidden sm:block" />
            <div className="min-w-0">
              {/* A 2xl heading on a 390px screen wrapped to one word per line. */}
              <h1 className="text-lg sm:text-2xl font-extrabold text-gray-900 tracking-tight leading-tight">
                Welcome back, {name} <span className="hidden sm:inline">— {roleLabel}</span>
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 mt-0.5 sm:mt-1 sm:hidden">{roleLabel}</p>
              {/* Where you work, rather than a line about the product you are working in. */}
              <p className="text-sm text-gray-500 mt-1 hidden sm:block">
                {company && employee
                  ? `${company.name} · ${employee.department} · ${employee.team}`
                  : "Here's how your Virtual Workspace is going."}
              </p>
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-4">
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

        {/* The badge overhangs by 6px, and this sits at the right edge of the page — that
            overhang was enough to make the whole document scroll sideways on a phone. */}
        <div className="relative mr-1.5">
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 shadow-sm"
          >
            <LogOut size={17} /> Log out
          </button>
          {pendingCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-4.5 h-4.5 min-w-[18px] px-1 rounded-full bg-red-600 text-white text-[12px] font-bold flex items-center justify-center border-2 border-gray-50">
              {pendingCount}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
