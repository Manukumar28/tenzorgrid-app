import React from 'react';
import { Keyboard, Info } from 'lucide-react';
import { BentoCard } from './ui.jsx';

// Settings that actually do something. The rest of this tab stayed an honest "coming
// soon" for a long time because there was nothing real to put in it; there is now.

function Toggle({ on, onChange, label, note, ariaLabel }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-800">{label}</p>
        {note && <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{note}</p>}
      </div>
      <button
        onClick={() => onChange(!on)}
        role="switch"
        aria-checked={on}
        aria-label={ariaLabel || label}
        className={`relative w-11 h-6 rounded-full transition-colors shrink-0 mt-0.5 ${
          on ? 'bg-indigo-600' : 'bg-slate-200'}`}
      >
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${
          on ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </div>
  );
}

export default function SettingsTab({ prefs, onPrefs }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 items-start">
      <BentoCard hover={false}>
        <div className="flex items-center gap-2 mb-1">
          <Keyboard size={18} className="text-indigo-500" />
          <h3 className="text-base font-bold">Chat</h3>
        </div>
        <p className="text-xs text-slate-500 mb-2">How messages get sent in the chat dock.</p>

        <div className="divide-y divide-slate-100">
          <Toggle
            on={prefs.enterToSend}
            onChange={(v) => onPrefs({ ...prefs, enterToSend: v })}
            label="Press Enter to send"
            ariaLabel="Press Enter to send"
            note={prefs.enterToSend
              ? 'Enter sends your message. Shift+Enter starts a new line.'
              : 'Enter starts a new line. Shift+Enter sends.'}
          />
        </div>

        <p className="text-[11px] text-slate-400 mt-3 leading-relaxed">
          Saved in this browser. It is a typing habit rather than account data, so it does
          not follow you to another machine.
        </p>
      </BentoCard>

      <BentoCard hover={false}>
        <div className="flex items-center gap-2 mb-1">
          <Info size={18} className="text-slate-400" />
          <h3 className="text-base font-bold">Everything else</h3>
        </div>
        <p className="text-sm text-slate-500 leading-relaxed">
          Notification preferences, schedule changes and account settings are not built yet.
          They are listed here rather than shown as dead switches.
        </p>
      </BentoCard>
    </div>
  );
}
