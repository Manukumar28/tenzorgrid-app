import React, { useEffect, useRef, useState } from 'react';
import { LayoutGrid, X } from 'lucide-react';
import { iconFor, launchTarget, pendingFor } from '../lib/apps.js';

// The company's tools, one click from anywhere.
//
// It is a utility, not the navigation. Home, Inbox, My Work and the rest are where the
// learner GOES; this is what they work IN, and it stays a small popover rather than
// competing with the rail for the shape of the product.
//
// Every entry is backed by something real. A bench with no open work says so instead of
// opening an empty editor, which is the difference between a tool and a placeholder.
export default function AppLauncher({ apps, state, onLaunch }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const boxRef = useRef(null);
  const btnRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') { setOpen(false); btnRef.current && btnRef.current.focus(); } };
    const onClick = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target) && !btnRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onClick); };
  }, [open]);

  if (!apps || !apps.length) return null;

  function launch(app) {
    const target = launchTarget(app, state);
    if (target.note) { setNote(target.note); return; }
    setNote('');
    setOpen(false);
    onLaunch(target);
  }

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={() => { setOpen((o) => !o); setNote(''); }}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Company applications"
        className={`inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-[12px] font-semibold border transition-colors
          focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
          open ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
      >
        <LayoutGrid size={16} />
        <span className="hidden sm:inline">Apps</span>
      </button>

      {open && (
        <div
          ref={boxRef}
          role="menu"
          aria-label="Company applications"
          className="absolute right-0 mt-2 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white shadow-xl p-2.5"
        >
          <div className="flex items-center justify-between px-1.5 pb-2">
            <span className="text-[10px] font-bold tracking-[0.13em] text-slate-400 uppercase">Applications</span>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close the application list"
              className="p-1 -mr-1 rounded text-slate-400 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            >
              <X size={14} />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-0.5">
            {apps.map((app) => {
              const Icon = iconFor(app);
              const waiting = pendingFor(app, state);
              return (
                <button
                  key={app.id}
                  role="menuitem"
                  onClick={() => launch(app)}
                  className="flex items-start gap-2.5 p-2 rounded-lg text-left hover:bg-slate-50
                             focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                >
                  <span className="shrink-0 w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center">
                    <Icon size={15} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="text-[13px] font-bold text-slate-800">{app.name}</span>
                      {waiting > 0 && (
                        <span className="text-[10px] font-bold rounded-full bg-slate-100 text-slate-600 px-1.5 py-0.5 tabular-nums">
                          {waiting} open
                        </span>
                      )}
                    </span>
                    <span className="block text-[12px] text-slate-500 leading-snug mt-0.5">{app.description}</span>
                  </span>
                </button>
              );
            })}
          </div>

          {note && (
            <p className="mt-1.5 mx-1.5 text-[12px] text-slate-500 border-t border-slate-100 pt-2 leading-snug">{note}</p>
          )}
        </div>
      )}
    </div>
  );
}
