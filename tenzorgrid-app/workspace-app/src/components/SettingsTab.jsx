import React from 'react';
import { Keyboard, Info, FastForward, Rewind, FlaskConical, AlertTriangle, RotateCcw, CheckCheck, Trash2 } from 'lucide-react';
import { useEffect } from 'react';
import { useState } from 'react';
import { api } from '../api.js';
import { soundEnabled, setSoundEnabled, armSound } from '../sound.js';
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
  // Reset throws away work, so it asks once. A second click on the same button rather
  // than a browser confirm(): the dialog cannot be styled, cannot be tested, and reads
  // as a bug on a page that otherwise never interrupts you.
  const [confirming, setConfirming] = useState(false);
  // Default the pickers to where the learner already is, so pressing the button without
  // touching them is a plain restart rather than a surprise switch.
  const [role, setRole] = useState(tt.role || 'data_analyst');
  const [level, setLevel] = useState(tt.level || 'junior');
  const [note, setNote] = useState('');

  async function move(spec) {
    setBusy(true); setError(''); setNote('');
    try {
      const d = await api.timeTravel(spec);
      if (d.state) onStateChange(d.state);
      // The count is the whole feedback: "nothing happened" and "six tasks cleared" look
      // identical on a board you have not scrolled to yet.
      if (typeof d.completed === 'number') {
        setNote(d.completed ? `Marked ${d.completed} task${d.completed === 1 ? '' : 's'} done.`
                            : 'Nothing open to mark done.');
      }
      setConfirming(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <BentoCard hover={false} className="border-amber-200 bg-amber-50/40">
      <div className="flex items-center gap-2.5 mb-1">
        <span className="shrink-0 w-9 h-9 rounded-xl bg-amber-600 text-white flex items-center justify-center">
          <FlaskConical size={18} />
        </span>
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
        <button
          onClick={() => move({ completeDay: true })}
          disabled={busy}
          aria-label="Mark every open task done for testing"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white border border-emerald-300 text-emerald-700 text-xs font-bold hover:bg-emerald-50 disabled:opacity-40"
        >
          <CheckCheck size={13} /> Finish today's tasks
        </button>
      </div>

      {note && <p className="text-xs text-emerald-800 font-semibold mt-2.5">{note}</p>}

      {/* Separated from the clock buttons, because it is a different kind of action:
          those move you, this deletes you. */}
      <div className="mt-3 pt-3 border-t border-amber-200/70">
        <div className="flex flex-wrap items-end gap-2 mb-2.5">
          <label className="flex flex-col gap-1">
            <span className="text-[12px] font-extrabold uppercase tracking-wide text-slate-500">Role</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              disabled={busy}
              aria-label="Role to start over as"
              className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold disabled:opacity-40"
            >
              {(tt.roles || []).map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[12px] font-extrabold uppercase tracking-wide text-slate-500">Level</span>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              disabled={busy}
              aria-label="Level to start over at"
              className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold disabled:opacity-40"
            >
              {(tt.levels || []).map((l) => <option key={l.key} value={l.key}>{l.label}</option>)}
            </select>
          </label>
          {(role !== tt.role || level !== tt.level) && (
            <span className="text-[12px] text-amber-800 font-semibold pb-2">
              {/* tt.levels already carries the real title for every level of this role,
                  so look the current one up rather than guessing Senior-or-Junior. */}
              Switching from {((tt.levels || []).find((l) => l.key === tt.level) || {}).label || tt.level}
            </span>
          )}
        </div>

        {confirming ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-700 font-semibold">
              This deletes every task, score, email and stand-up. Sure?
            </span>
            <button
              onClick={() => move({ reset: true, role, level })}
              disabled={busy}
              aria-label="Confirm start over"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 disabled:opacity-40"
            >
              <RotateCcw size={13} /> {busy ? 'Resetting…' : 'Yes, start over'}
            </button>
            <button
              onClick={() => setConfirming(false)}
              disabled={busy}
              aria-label="Cancel start over"
              className="px-3 py-2 rounded-lg text-xs font-bold text-slate-500 hover:bg-white disabled:opacity-40"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => { setError(''); setConfirming(true); }}
            disabled={busy}
            aria-label="Start over from day one"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white border border-slate-300 text-slate-600 text-xs font-bold hover:bg-slate-50 disabled:opacity-40"
          >
            <RotateCcw size={13} /> {role !== tt.role || level !== tt.level ? 'Switch and start over' : 'Start over from day 1'}
          </button>
        )}
        <p className="text-[12px] text-slate-500 mt-2 leading-relaxed">
          Back to a brand-new joiner at the role and level above: the welcome mail and the
          skills check, on a clean board. Nothing is rewound — the run is deleted and started
          again, which is the only version of "start over" that is actually true.
        </p>
      </div>

      {error && <p className="text-xs text-rose-700 font-semibold mt-3">{error}</p>}

      <p className="text-[12px] text-amber-800/80 mt-3 leading-relaxed">
        This panel only appears when the server is started with <code>TIME_TRAVEL=1</code>.
        Turn that off before real learners arrive.
      </p>
    </BentoCard>
  );
}

// Start the workspace again.
//
// Not the same thing as the testing panel's "start over", which re-enrols you at the same
// role and level so a tester lands back on day one. This puts you back at the ROLE PICKER,
// because wanting to start again is usually somebody saying they picked the wrong role or
// the wrong level — and there are 153 roles to pick from now.
//
// It is also the one control in the app that destroys work, so it shows what it is about
// to destroy, counted from the learner's own rows. "Are you sure?" is a question nobody
// can answer; "this deletes 46 graded tasks and 9 days at the desk" is.
function ResetWorkspace({ onStateChange }) {
  const [preview, setPreview] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    api.resetPreview()
      .then((d) => { if (alive) setPreview(d.preview); })
      .catch(() => { /* the card still works; it just cannot show the numbers */ });
    return () => { alive = false; };
  }, []);

  async function reset() {
    setBusy(true); setError('');
    try {
      const d = await api.resetWorkspace();
      // A null state is the point: App falls back to the role picker.
      onStateChange(d.state);
    } catch (e) {
      setError(e.message);
      setBusy(false);
      setConfirming(false);
    }
  }

  const lines = preview ? [
    preview.gradedTasks > 0 && `${preview.gradedTasks} graded task${preview.gradedTasks === 1 ? '' : 's'}${
      preview.averageScore === null ? '' : `, averaging ${preview.averageScore}`}`,
    preview.projectsCompleted > 0 && `${preview.projectsCompleted} completed project${preview.projectsCompleted === 1 ? '' : 's'}`,
    preview.daysAttended > 0 && `${preview.daysAttended} day${preview.daysAttended === 1 ? '' : 's'} at the desk`,
    preview.messages > 0 && `${preview.messages} message${preview.messages === 1 ? '' : 's'}`,
    preview.skillTestTaken && 'your skills check and the baseline it set',
  ].filter(Boolean) : [];

  return (
    <BentoCard hover={false}>
      <div className="flex items-center gap-2.5 mb-1">
        <span className="shrink-0 w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center">
          <RotateCcw size={18} />
        </span>
        <h3 className="text-base font-bold">Reset the workspace</h3>
      </div>
      <p className="text-xs text-slate-500 mb-3">
        Clear everything and start again from the role picker — a different role, a
        different level, or the same one from day one.
      </p>

      {preview && (
        <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 mb-3">
          <p className="text-xs font-semibold text-slate-700">
            You joined as a {preview.level}
            {preview.joinedOn ? ` on ${preview.joinedOn}` : ''}.
          </p>
          {lines.length > 0 ? (
            <>
              <p className="text-[12px] text-slate-500 mt-1.5">Resetting deletes:</p>
              <ul className="text-[12px] text-slate-600 mt-1 space-y-0.5 list-disc list-inside">
                {lines.map((l) => <li key={l}>{l}</li>)}
              </ul>
            </>
          ) : (
            <p className="text-[12px] text-slate-500 mt-1.5">
              There is nothing graded yet, so there is nothing much to lose.
            </p>
          )}
        </div>
      )}

      {error && <div className="text-rose-600 text-xs mb-2">{error}</div>}

      {confirming ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle size={14} className="text-rose-500 mt-0.5 shrink-0" />
            <p className="text-xs text-rose-700">
              This cannot be undone and none of it can be recovered. Your account and profile
              stay; the workspace does not.
            </p>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={reset}
              disabled={busy}
              className="flex-1 flex items-center justify-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg py-2 transition-colors disabled:opacity-60"
            >
              <Trash2 size={13} /> {busy ? 'Resetting…' : 'Yes, delete it all'}
            </button>
            <button
              onClick={() => setConfirming(false)}
              disabled={busy}
              className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg py-2 transition-colors"
            >
              Keep my workspace
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => { setConfirming(true); setError(''); }}
          className="w-full flex items-center justify-center gap-1.5 border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold rounded-lg py-2.5 transition-colors"
        >
          <RotateCcw size={13} /> Reset and start again
        </button>
      )}
    </BentoCard>
  );
}

export default function SettingsTab({ prefs, onPrefs, timeTravel, onStateChange }) {
  // Read once on mount rather than held in App state: the preference lives in this
  // browser, nothing else in the app needs to know about it, and a page that has just
  // loaded has not made a sound yet anyway.
  const [sound, setSound] = useState(() => soundEnabled());
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* The one destination that never named itself. Every other page has a heading that
          matches the menu entry that led to it; this one opened straight onto a card. */}
      <div className="flex items-baseline gap-2.5 flex-wrap">
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Settings</h1>
        <span className="text-sm font-semibold text-slate-500">Your preferences on this machine</span>
      </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 items-start">
      <BentoCard hover={false}>
        <div className="flex items-center gap-2.5 mb-1">
          <span className="shrink-0 w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
            <Keyboard size={18} />
          </span>
          <h3 className="text-base font-bold">Chat &amp; sound</h3>
        </div>
        <p className="text-xs text-slate-500 mb-2">How messages get sent, and whether you hear them arrive.</p>

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
          <Toggle
            on={sound}
            onChange={(v) => { setSound(v); setSoundEnabled(v); if (v) armSound(); }}
            label="Sound when something arrives"
            ariaLabel="Sound when something arrives"
            note={sound
              ? 'A soft chime for email, a lighter note for chat.'
              : 'Mail and chat arrive silently.'}
          />
        </div>

        <p className="text-[12px] text-slate-500 mt-3 leading-relaxed">
          Saved in this browser. It is a typing habit rather than account data, so it does
          not follow you to another machine.
        </p>
      </BentoCard>

      {timeTravel && timeTravel.enabled && (
        <TimeTravel tt={timeTravel} onStateChange={onStateChange} />
      )}

      <ResetWorkspace onStateChange={onStateChange} />

      <BentoCard hover={false}>
        <div className="flex items-center gap-2.5 mb-1">
          <span className="shrink-0 w-9 h-9 rounded-xl bg-slate-500 text-white flex items-center justify-center">
            <Info size={18} />
          </span>
          <h3 className="text-base font-bold">Everything else</h3>
        </div>
        <p className="text-sm text-slate-500 leading-relaxed">
          Notification preferences, schedule changes and account settings are not built yet.
          They are listed here rather than shown as dead switches.
        </p>
      </BentoCard>
    </div>
    </div>
  );
}
