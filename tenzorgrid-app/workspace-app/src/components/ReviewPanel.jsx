import React, { useMemo, useState } from 'react';
import { MessageSquareQuote, Send, CheckCircle2, PauseCircle, AlertCircle } from 'lucide-react';
import { Avatar } from './ui.jsx';
import { api } from '../api.js';

// Asha's sign-off conversation.
//
// A submitted task is not finished — it sits here until she is satisfied the learner
// can explain a choice they made. The score is deliberately not shown while this is
// open: telling someone they scored 90 and then asking them to justify their work
// turns the conversation into a formality, which is the one thing it must not be.

function Bubble({ from, name, photoUrl, children }) {
  const mine = from === 'learner';
  return (
    <div className={`flex gap-2.5 ${mine ? 'flex-row-reverse' : ''}`}>
      <Avatar name={name} photoUrl={photoUrl} size={26} className="shrink-0 mt-0.5" />
      <div className={`max-w-[80%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
        mine ? 'bg-slate-900 text-white rounded-tr-sm' : 'bg-white border border-slate-200 text-slate-800 rounded-tl-sm'}`}>
        {children}
      </div>
    </div>
  );
}

export default function ReviewPanel({ task, manager, learnerName, learnerPhotoUrl, onStateChange }) {
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // Kept locally so the learner sees the whole exchange without a page refresh.
  const [thread, setThread] = useState([]);
  const [outcome, setOutcome] = useState(null);

  const roundsLeft = useMemo(
    () => (outcome ? 0 : task.reviewRoundsLeft ?? 2),
    [task.reviewRoundsLeft, outcome],
  );

  async function send() {
    const text = answer.trim();
    if (!text) return;
    setBusy(true); setError('');
    try {
      const d = await api.answerReview(task.id, text);
      setThread((t) => [...t, { from: 'learner', body: text }, { from: 'manager', body: d.reply }]);
      setAnswer('');
      if (d.accepted) setOutcome({ kind: 'accepted', score: d.score, feedback: d.feedback });
      else if (d.parked) setOutcome({ kind: 'parked' });
      // Refresh the board last, so the exchange above is already on screen.
      if (d.state) onStateChange(d.state);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border-2 border-amber-200 bg-amber-50/40 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-amber-200 bg-amber-50">
        <MessageSquareQuote size={15} className="text-amber-700" />
        <span className="text-xs font-extrabold text-amber-900 uppercase tracking-wide">
          {manager ? `${manager.name.split(' ')[0]} is reviewing this` : 'In review'}
        </span>
        {!outcome && (
          <span className="ml-auto text-[11px] font-bold text-amber-700">
            {roundsLeft} {roundsLeft === 1 ? 'attempt' : 'attempts'} left
          </span>
        )}
      </div>

      <div className="p-4 space-y-3">
        <Bubble from="manager" name={manager ? manager.name : 'Asha Rao'} photoUrl={manager && manager.avatarUrl}>
          {task.reviewQuestion}
        </Bubble>

        {thread.map((m, i) => (
          <Bubble
            key={i}
            from={m.from}
            name={m.from === 'learner' ? learnerName : (manager ? manager.name : 'Asha Rao')}
            photoUrl={m.from === 'learner' ? learnerPhotoUrl : (manager && manager.avatarUrl)}
          >
            {m.body}
          </Bubble>
        ))}

        {error && (
          <div className="flex gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3">
            <AlertCircle size={14} className="text-rose-500 mt-0.5 shrink-0" />
            <p className="text-xs text-rose-800 font-medium">{error}</p>
          </div>
        )}

        {!outcome && (
          <div className="pt-1">
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              rows={3}
              placeholder="Explain why you made that choice…"
              aria-label="Your answer to the review question"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-amber-300"
            />
            <div className="flex items-center justify-between gap-3 mt-2">
              <p className="text-[11px] text-slate-500 leading-snug">
                Say <em>why</em>, not what the code does. She's checking you understood the choice.
              </p>
              <button
                onClick={send}
                disabled={busy || !answer.trim()}
                aria-label="Send answer to your manager"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 disabled:opacity-40 shrink-0"
              >
                <Send size={12} />{busy ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>
        )}

        {outcome && outcome.kind === 'accepted' && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <CheckCircle2 size={15} className="text-emerald-600" />
              <span className="text-sm font-extrabold text-slate-900">Signed off — {outcome.score}/100</span>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">{outcome.feedback}</p>
          </div>
        )}

        {outcome && outcome.kind === 'parked' && (
          <div className="rounded-xl border border-slate-300 bg-slate-50 p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <PauseCircle size={15} className="text-slate-500" />
              <span className="text-sm font-extrabold text-slate-900">Parked for now</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              This one stays open and counts against the project until it's signed off. Take the next task
              and come back to it — that's what your manager would want you doing.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
