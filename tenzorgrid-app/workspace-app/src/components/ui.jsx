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
      // `min-w-0` is load-bearing: a CSS grid track defaults to min-width:auto, so a card
      // whose content has a wide min-content pushes its whole column past the viewport and
      // the page scrolls sideways. Without this, no amount of responsive column counts
      // helps — the workspace overflowed a 390px phone by 230px because of it.
      className={`bg-white border border-gray-100 rounded-xl shadow-sm p-4 sm:p-6 min-w-0 ${className}`}
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

export function CircularProgress({ value, max = 100, size = 56, strokeWidth = 6, colorClass = 'text-indigo-600' }) {
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
  return <span className={`inline-block text-[12px] font-bold tracking-wide uppercase px-2.5 py-1 rounded-full ${className}`}>{children}</span>;
}

// `photoUrl` is a real uploaded photo (only ever the current learner's own — never
// synthesized for a real person). `avatarUrl` is a self-hosted 3D illustration
// (public/assets/avatars/) already picked server-side for a fictional cast member
// (see lib/avatars.js) — same character always gets the same picture. If the image
// fails to load, it falls back to initials rather than showing a broken image.
export function Avatar({ name, size = 32, className = '', photoUrl, avatarUrl }) {
  const [failed, setFailed] = React.useState(false);
  const initials = (name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const src = photoUrl || avatarUrl;

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={name || 'avatar'}
        onError={() => setFailed(true)}
        className={`rounded-full object-cover shrink-0 bg-gray-100 ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className={`flex items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-teal-400 text-white font-semibold shrink-0 ${className}`}
      // Initials never drop below 12px however small the circle is. At size * 0.38 a
      // 28px avatar rendered them at 10.6px, which was the last sub-12px text in the app.
      style={{ width: size, height: size, fontSize: Math.max(12, Math.round(size * 0.38)) }}
    >
      {initials}
    </div>
  );
}

// A row of small coloured stat tiles, and the section heading that sits above a card.
//
// Both exist because measuring the eight tabs found coloured area at about 1% on every
// one of them: white cards on a white page, with the key numbers of each tab rendered as
// a grey pipe-separated sentence. The tiles give those numbers a shape and a colour, and
// the heading gives every card an icon chip, so a tab reads as something rather than as
// a wall of white.
export const TONE = {
  indigo: { tile: 'bg-indigo-50 border-indigo-100', chip: 'bg-indigo-600', ink: 'text-indigo-700' },
  violet: { tile: 'bg-violet-50 border-violet-100', chip: 'bg-violet-600', ink: 'text-violet-700' },
  emerald: { tile: 'bg-emerald-50 border-emerald-100', chip: 'bg-emerald-600', ink: 'text-emerald-700' },
  amber: { tile: 'bg-amber-50 border-amber-100', chip: 'bg-amber-600', ink: 'text-amber-800' },
  rose: { tile: 'bg-rose-50 border-rose-100', chip: 'bg-rose-600', ink: 'text-rose-700' },
  sky: { tile: 'bg-sky-50 border-sky-100', chip: 'bg-sky-600', ink: 'text-sky-700' },
  slate: { tile: 'bg-slate-50 border-slate-200', chip: 'bg-slate-500', ink: 'text-slate-700' },
};

export function StatTiles({ items }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {items.filter(Boolean).map(({ key, label, value, sub, tone = 'slate', icon: Icon }, i) => {
        const t = TONE[tone] || TONE.slate;
        return (
          <motion.div
            key={key || label}
            variants={fadeUp}
            initial="hidden"
            animate="show"
            custom={i}
            className={`rounded-xl border p-3.5 min-w-0 ${t.tile}`}
          >
            <div className="flex items-start gap-2.5">
              {Icon && (
                <span className={`shrink-0 w-8 h-8 rounded-lg ${t.chip} text-white flex items-center justify-center`}>
                  <Icon size={16} />
                </span>
              )}
              <div className="min-w-0">
                <div className="text-xl font-extrabold text-gray-900 leading-none">{value}</div>
                <div className={`text-xs font-bold mt-1 ${t.ink}`}>{label}</div>
                {sub && <div className="text-[12px] text-gray-600 mt-0.5 leading-snug">{sub}</div>}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

export function SectionHeading({ icon: Icon, tone = 'indigo', title, note, right }) {
  const t = TONE[tone] || TONE.indigo;
  return (
    <div className="flex items-start justify-between gap-3 mb-4">
      <div className="flex items-start gap-2.5 min-w-0">
        {Icon && (
          <span className={`shrink-0 w-9 h-9 rounded-xl ${t.chip} text-white flex items-center justify-center`}>
            <Icon size={18} />
          </span>
        )}
        <div className="min-w-0">
          <h3 className="text-base font-bold leading-tight">{title}</h3>
          {note && <p className="text-xs text-gray-500 mt-0.5 leading-snug">{note}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}
