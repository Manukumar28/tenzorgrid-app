import React from 'react';
import { Menu } from 'lucide-react';
import { NAV_ITEMS, MOBILE_PRIMARY, canSee, badgeFor } from '../lib/navigation.js';

// The phone bar.
//
// Not a second navigation system: the last button opens the drawer that already existed,
// so everything is still reachable in exactly one place. What this adds is a thumb-reach
// path to the four destinations somebody opens on a phone -- start of day, what came in,
// what to do, what is scheduled -- instead of making all of them a two-tap trip through a
// menu.
//
// Fixed to the bottom on small screens only; the rail is unchanged from `lg` up.
export default function MobileNav({ tab, onTab, onOpenMenu, level, state }) {
  const items = MOBILE_PRIMARY
    .map((id) => NAV_ITEMS.find((i) => i.id === id))
    .filter((i) => i && canSee(i, level));

  // Opaque, not translucent. At 95% the page text underneath showed through the labels
  // and the bar read as a rendering fault rather than a surface.
  return (
    <nav
      aria-label="Primary"
      className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200
                 shadow-[0_-1px_3px_rgba(15,23,42,0.06)]
                 flex items-stretch pb-[env(safe-area-inset-bottom)]"
    >
      {items.map((item) => {
        const Icon = item.icon;
        const active = tab === item.id;
        const count = badgeFor(item, state);
        return (
          <button
            key={item.id}
            onClick={() => onTab(item.id)}
            aria-current={active ? 'page' : undefined}
            className={`relative flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 py-2
              focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-400
              ${active ? 'text-slate-900' : 'text-slate-400'}`}
          >
            {/* Top rule rather than a pill, to match the rail's leading-edge marker. */}
            <span aria-hidden="true" className={`absolute top-0 inset-x-4 h-[2px] rounded-full ${active ? 'bg-slate-900' : 'bg-transparent'}`} />
            <span className="relative">
              <Icon size={20} strokeWidth={active ? 2.3 : 1.9} />
              {count > 0 && (
                <span className="absolute -top-1.5 -right-2.5 min-w-[17px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold leading-4 text-center tabular-nums">
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </span>
            <span className={`text-[10px] truncate max-w-full ${active ? 'font-bold' : 'font-semibold'}`}>{item.label}</span>
          </button>
        );
      })}
      <button
        onClick={onOpenMenu}
        aria-label="Open the full menu"
        className="flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 py-2 text-slate-400
                   focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-400"
      >
        <Menu size={20} strokeWidth={1.9} />
        <span className="text-[10px] font-semibold">More</span>
      </button>
    </nav>
  );
}
