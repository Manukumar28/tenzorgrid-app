import React from 'react';
import { motion } from 'framer-motion';

export const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.35, ease: 'easeOut' } }),
};

export function BentoCard({ children, className = '', index = 0, hover = true, ...rest }) {
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="show"
      custom={index}
      whileHover={hover ? { y: -3, boxShadow: '0 12px 24px -8px rgba(15,23,42,.12)' } : undefined}
      className={`bg-white border border-gray-100 rounded-xl shadow-sm p-5 ${className}`}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export function ProgressBar({ value, max = 100, colorClass = 'from-indigo-500 to-teal-400', trackClass = 'bg-gray-100', height = 'h-2' }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={`w-full ${height} ${trackClass} rounded-full overflow-hidden`}>
      <motion.div
        className={`h-full rounded-full bg-gradient-to-r ${colorClass}`}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.8, ease: 'easeOut', delay: 0.15 }}
      />
    </div>
  );
}

export function CircularProgress({ value, max = 100, size = 56, strokeWidth = 6, colorClass = 'text-indigo-500' }) {
  const pct = Math.max(0, Math.min(1, max ? value / max : 0));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={strokeWidth} className="stroke-gray-100" fill="none" />
      <motion.circle
        cx={size / 2} cy={size / 2} r={radius} strokeWidth={strokeWidth}
        className={colorClass} fill="none" strokeLinecap="round" stroke="currentColor"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: circumference * (1 - pct) }}
        transition={{ duration: 0.9, ease: 'easeOut', delay: 0.15 }}
      />
    </svg>
  );
}

export function Pill({ children, className = '' }) {
  return <span className={`inline-block text-[10px] font-bold tracking-wide uppercase px-2 py-1 rounded-full ${className}`}>{children}</span>;
}

export function Avatar({ name, size = 32, className = '' }) {
  const initials = (name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div
      className={`flex items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-teal-400 text-white font-semibold shrink-0 ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials}
    </div>
  );
}
