import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { X, CheckCircle2, Target, CornerUpLeft, Users } from 'lucide-react';
import { Avatar } from './ui.jsx';
import { api } from '../api.js';

// The weekly 1:1.
//
// A structured workplace conversation, not a video call: header, participants, what she
// noticed, what you say back, and one thing to work on. There is deliberately no camera
// tile, no "join" button and no call timer -- none of those would be real, and a fake
// video screen is the one thing the brief rules out by name.
//
// Nothing on this screen is a grade. The learner's reflection is stored exactly as they
// wrote it and never marked, so there is no score to render and no place to put one.

function Section({ label, children }) {
  return (
    <div className="px-5 py-4 border-b border-slate-100 last:border-0">
      <div className="text-[10px] font-bold tracking-[0.12em] text-slate-400 uppercase mb-2">{label}</div>
      {children}
    </div>
  );
}

// The week in numbers. Only the figures that carry meaning for the conversation -- a 1:1
// that opened with twelve metrics would be a dashboard with a face on it.
function TheWeek({ e }) {
  const stats = [
    [e.approvedCount, 'signed off'],
    [e.returnedCount, e.returnedCount === 1 ? 'came back' : 'came back'],
    [e.recoveredCount, 'put right'],
    [e.escalationCount, e.escalationCount === 1 ? 'escalation' : 'escalations'],
    [e.situationsHandled, 'things handled'],
    [e.unansweredCount, 'left unanswered'],
  ].filter(([n]) => n > 0);
  if (!stats.length) return <p className="text-sm text-slate-500">A quiet week.</p>;
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-2">
      {stats.map(([n, label]) => (
        <div key={label}>
          <span className="text-lg font-extrabold text-slate-900 tabular-nums">{n}</span>{' '}
          <span className="text-[13px] text-slate-500">{label}</span>
        </div>
      ))}
      {e.avgScore !== null && e.avgScore !== undefined && (
        <div>
          <span className="text-lg font-extrabold text-slate-900 tabular-nums">{e.avgScore}</span>{' '}
          <span className="text-[13px] text-slate-500">average on work signed off</span>
        </div>
      )}
    </div>
  );
}

export default function OneToOne({ meetingKey, manager, onClose, onStateChange }) {
  const [meeting, setMeeting] = useState(null);
  const [choice, setChoice] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);

  useEffect(() => {
    let live = true;
    api.getOneToOne(meetingKey)
      .then((r) => { if (live) setMeeting(r.meeting); })
      .catch((e) => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [meetingKey]);

  async function finish() {
    if (!choice) { setError('Pick the one that fits before finishing.'); return; }
    setBusy(true); setError('');
    try {
      const r = await api.completeOneToOne(meeting.key, choice, text);
      setDone(r);
      if (r.state && onStateChange) onStateChange(r.state);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const managerName = (manager && manager.name) || 'Asha Rao';
  const shell = (body) => (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6"
      role="dialog" aria-label="Weekly one to one">
      <motion.div
        initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-2xl bg-white shadow-2xl"
      >
        <div className="sticky top-0 flex items-center gap-3 px-5 py-3.5 border-b border-slate-200 bg-slate-50 z-10">
          <Avatar name={managerName} photoUrl={manager && manager.avatarUrl} size={30} />
          <div className="min-w-0">
            <p className="text-sm font-extrabold text-slate-900 leading-tight">
              Your 1:1 with {managerName.split(' ')[0]}
            </p>
            <p className="text-[12px] text-slate-500">
              {meeting ? `Week ${meeting.weekIndex} · ${meeting.project.title}` : 'Loading'}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close the meeting"
            className="ml-auto p-2 rounded-lg text-slate-500 hover:bg-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400">
            <X size={16} />
          </button>
        </div>
        {body}
      </motion.div>
    </div>
  );

  if (error && !meeting) return shell(<div className="p-6 text-sm text-rose-700">{error}</div>);
  if (!meeting) return shell(<div className="p-6 text-sm text-slate-500">Opening…</div>);

  if (done) {
    return shell(
      <div className="p-6">
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle2 size={17} className="text-emerald-700" />
          <span className="text-sm font-extrabold text-slate-900">That is us done</span>
        </div>
        <p className="text-sm text-slate-700 leading-relaxed">{done.reply}</p>
        {done.goal && (
          <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50/70 p-4">
            <div className="flex items-center gap-2 mb-1">
              <Target size={14} className="text-indigo-700" />
              <span className="text-[10px] font-bold tracking-[0.12em] text-indigo-700 uppercase">
                What you are working on
              </span>
            </div>
            <p className="text-sm font-bold text-slate-900">{done.goal.title}</p>
            {done.goal.reason && <p className="text-[13px] text-slate-600 mt-1 leading-relaxed">{done.goal.reason}</p>}
          </div>
        )}
        <button onClick={onClose}
          className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900 text-white text-[13px] font-bold hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400">
          Back to work
        </button>
      </div>,
    );
  }

  const completed = meeting.status === 'completed';

  return shell(
    <>
      <Section label="In the room">
        <div className="flex flex-wrap gap-4">
          {meeting.participants.map((p) => (
            <div key={p.archetype} className="flex items-center gap-2">
              <Avatar name={p.name} photoUrl={p.avatarUrl} size={26} />
              <div className="min-w-0">
                <div className="text-[13px] font-bold text-slate-800 leading-tight">{p.name}</div>
                <div className="text-[12px] text-slate-500">{p.title}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Last week's focus, and what actually happened to it. This is the part that makes
          her feel like a manager who remembers -- and it is two database rows, not a
          model with a memory. Never labelled pass or fail: development is longitudinal. */}
      {meeting.followUp && (
        <Section label="What you were working on">
          <div className="flex items-start gap-2">
            <CornerUpLeft size={14} className="text-slate-400 mt-1 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900">{meeting.followUp.title}</p>
              {meeting.followUp.progress && (
                <p className="text-[13px] text-slate-600 mt-1 leading-relaxed">
                  {meeting.followUp.progress.encountered === 0
                    ? 'Nothing came up this week that would have tested it.'
                    : `${meeting.followUp.progress.encountered} ${meeting.followUp.progress.encountered === 1 ? 'chance' : 'chances'} to practise it — `
                      + [
                        meeting.followUp.progress.handledDirectly && `${meeting.followUp.progress.handledDirectly} you handled yourself`,
                        meeting.followUp.progress.escalated && `${meeting.followUp.progress.escalated} you passed to me`,
                        meeting.followUp.progress.missed && `${meeting.followUp.progress.missed} went unanswered`,
                      ].filter(Boolean).join(', ') + '.'}
                </p>
              )}
            </div>
          </div>
        </Section>
      )}

      <Section label="This week">
        <TheWeek e={meeting.evidence} />
      </Section>

      <Section label={`What ${managerName.split(' ')[0]} noticed`}>
        {meeting.observations.length ? (
          <ul className="space-y-2.5">
            {meeting.observations.map((o) => (
              <li key={o.key} className="text-sm text-slate-700 leading-relaxed">{o.text}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">Nothing that needs saying — a clean week.</p>
        )}
      </Section>

      {completed ? (
        <Section label="What you said">
          <p className="text-sm text-slate-700">
            {(meeting.reflectionOptions.find((r) => r.key === meeting.reflectionChoice) || {}).label}
          </p>
          {meeting.reflectionText && (
            <p className="text-[13px] text-slate-600 mt-2 leading-relaxed italic">“{meeting.reflectionText}”</p>
          )}
          {meeting.managerReply && (
            <p className="text-sm text-slate-700 mt-3 leading-relaxed">{meeting.managerReply}</p>
          )}
          {meeting.outcome && (
            <div className="mt-3 flex items-center gap-2">
              <Target size={13} className="text-indigo-700" />
              <span className="text-[13px] font-bold text-slate-800">{meeting.outcome.title}</span>
            </div>
          )}
        </Section>
      ) : (
        <>
          <Section label="Over to you">
            <p className="text-sm text-slate-700 mb-3">Anything you would do differently?</p>
            <div className="space-y-1.5">
              {meeting.reflectionOptions.map((r) => (
                <label key={r.key}
                  className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 cursor-pointer transition-colors ${
                    choice === r.key ? 'border-indigo-400 bg-indigo-50/70' : 'border-slate-200 hover:bg-slate-50'}`}>
                  <input type="radio" name="reflection" value={r.key} checked={choice === r.key}
                    onChange={() => setChoice(r.key)} className="mt-0.5 accent-indigo-600" />
                  <span className="text-[13px] text-slate-700 leading-snug">{r.label}</span>
                </label>
              ))}
            </div>
            {/* Free text, stored as written and never marked. This is a reflection, not
                an answer, so there is nothing here to get right. */}
            <textarea
              rows={3} value={text} onChange={(e) => setText(e.target.value)}
              aria-label="Anything else you want to say"
              placeholder="Anything else? Optional — this is not marked."
              className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </Section>
          <div className="px-5 py-4">
            {error && <p className="text-[13px] text-rose-700 mb-2">{error}</p>}
            <button onClick={finish} disabled={busy}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900 text-white text-[13px] font-bold hover:bg-slate-800 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400">
              <Users size={15} /> {busy ? 'Finishing…' : 'Finish the 1:1'}
            </button>
          </div>
        </>
      )}
    </>,
  );
}
