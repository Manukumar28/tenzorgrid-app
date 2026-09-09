import React from 'react';
import { Keyboard, Info, FastForward, Rewind, FlaskConical, AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { api } from '../api.js';
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

// Testing the week without waiting a week.
//
// Day 2 arrives tomorrow, which makes a five-day project impossible to walk through in
// one sitting. This shifts the learner's whole clock so "now" lands on the next day.
//
// Only rendered when the server has TIME_TRAVEL=1. It has to stay off for real learners:
// a button that skips a day would walk past every deadline in the programme, and the
// deadline is most of what makes this a job rather than a course.
function TimeTravel({ tt, onStateChange }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function move(spec) {
    setBusy(true); setError('');
    try {
      const d = await api.timeTravel(spec);
      if (d.state) onStateChange(d.state);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <BentoCard hover={false} className="border-amber-200 bg-amber-50/40">
      <div className="flex items-center gap-2 mb-1">
        <FlaskConical size={18} className="text-amber-600" />
        <h3 className="text-base font-bold">Testing — move the clock</h3>
      </div>
      <p className="text-xs text-slate-600 mb-3 leading-relaxed">
        Moves your whole workspace forward a working day, so later-day tasks open and the
        week actually advances. Everything dated moves together, so the state you land on
        is one the product could genuinely reach on its own. "Miss the deadline" jumps to
        just past the due date, which is what makes the chase emails fire.
      </p>

      {tt.project && (
        <p className="text-sm font-semibold text-slate-800 mb-3">
          {tt.project} — day {tt.day} of {tt.totalDays}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {/* Working days, not calendar days: a flat 24 hours lands on Saturday and the day
            counter does not move, so the button appears to do nothing. */}
        <button
          onClick={() => move({ workingDays: 1 })}
          disabled={busy}
          aria-label="Move forward one working day"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 disabled:opacity-40"
        >
          <FastForward size={13} /> Next day
        </button>
        <button
          onClick={() => move({ to: 'past-deadline' })}
          disabled={busy}
          aria-label="Jump past the deadline"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white border border-rose-300 text-rose-700 text-xs font-bold hover:bg-rose-50 disabled:opacity-40"
        >
          <AlertTriangle size={13} /> Miss the deadline
        </button>
        <button
          onClick={() => move({ workingDays: -1 })}
          disabled={busy}
          aria-label="Move back one working day"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white border border-slate-300 text-slate-500 text-xs font-bold hover:bg-slate-50 disabled:opacity-40"
        >
          <Rewind size={13} /> Back a day
        </button>
      </div>

      {error && <p className="text-xs text-rose-700 font-semibold mt-3">{error}</p>}

      <p className="text-[11px] text-amber-800/80 mt-3 leading-relaxed">
        This panel only appears when the server is started with <code>TIME_TRAVEL=1</code>.
        Turn that off before real learners arrive.
      </p>
    </BentoCard>
  );
}

export default function SettingsTab({ prefs, onPrefs, timeTravel, onStateChange }) {
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

      {timeTravel && timeTravel.enabled && (
        <TimeTravel tt={timeTravel} onStateChange={onStateChange} />
      )}

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
