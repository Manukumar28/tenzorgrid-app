import React from 'react';
import { motion } from 'framer-motion';
import { LogOut } from 'lucide-react';
import { Avatar } from './ui.jsx';

export default function Header({ name, photoUrl, roleLabel, checkedIn, onToggleCheckIn, onLogout, pendingCount }) {
  return (
    <div className="flex items-start justify-between gap-6 mb-6 flex-wrap">
      <div className="flex items-center gap-3.5">
        <Avatar name={name} photoUrl={photoUrl} size={44} className="ring-2 ring-white shadow-sm" />
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Welcome back, {name} — {roleLabel}</h1>
          <p className="text-sm text-gray-400 mt-1">Here's how your Virtual Workspace is going.</p>
        </div>
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

        <div className="relative">
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 shadow-sm"
          >
            <LogOut size={17} /> Log out
          </button>
          {pendingCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-4.5 h-4.5 min-w-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-gray-50">
              {pendingCount}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
