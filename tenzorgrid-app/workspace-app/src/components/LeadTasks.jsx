import React, { useMemo, useState } from 'react';
import {
  Send, AlertCircle, Users, Clock, StickyNote, Mail, Code2, Table2, CheckCircle2, Circle, Gavel,
} from 'lucide-react';

// The two Team Lead slots.
//
// `assign`  — a week of work and the people to do it. The one thing a lead does that an
//             analyst never does, and unusually gradeable: an assignment is right or wrong
//             against constraints you can count rather than against taste. Capacity is
//             shown as it fills, because a lead who cannot see the overload cannot avoid it.
//
// `signoff` — somebody else's work going out with your name on it. Weighted toward the
//             call rather than the wording, which is the opposite of coaching: a senior who
//             phrases feedback badly has a bad afternoon, a lead who ships the wrong number
//             has a bad quarter.

const EXHIBIT_ICON = { sql: Code2, email: Mail, table: Table2, note: StickyNote };

function Exhibit({ exhibit }) {
  if (!exhibit) return null;
  const Icon = EXHIBIT_ICON[exhibit.kind] || StickyNote;
  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <div className="flex items-center gap-2 px-3.5 py-2 bg-slate-50 border-b border-slate-200">
        <Icon size={13} className="text-slate-500 shrink-0" />
        <span className="text-[11px] font-bold text-slate-600 truncate">{exhibit.from}</span>
      </div>
      <pre className={`px-3.5 py-3 text-xs leading-relaxed whitespace-pre-wrap overflow-x-auto ${
        exhibit.kind === 'sql' ? 'font-mono text-slate-800' : 'font-sans text-slate-700'}`}>
        {exhibit.body}
      </pre>
    </div>
  );
}

export function AssignTask({ wb, onSubmit, submitting, isGraded }) {
  const spec = wb.assign;
  const [picks, setPicks] = useState({});
  const [error, setError] = useState('');

  // Load per person, recomputed as they go. Seeing the overload build is the point — a
  // lead who only finds out on Friday has not planned anything.
  const load = useMemo(() => {
    const out = {};
    for (const item of spec.items) {
      const who = picks[item.key];
      if (who) out[who] = (out[who] || 0) + (item.days || 0);
    }
    return out;
  }, [picks, spec.items]);

  const staffed = Object.values(picks).filter(Boolean).length;

  async function send() {
    if (!staffed) { setError('Nothing is assigned yet.'); return; }
    setError('');
    await onSubmit(JSON.stringify({ assignments: picks }));
  }

  return (
    <div className="flex flex-col min-w-0">
      <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-slate-200 bg-slate-50/60">
        <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
          <Users size={13} /> Staffing — {staffed} of {spec.items.length} assigned
        </span>
        <button
          onClick={send}
          disabled={submitting || isGraded}
          aria-label="Submit for grading"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 disabled:opacity-40"
        >
          <Send size={12} />{submitting ? 'Submitting…' : 'Submit'}
        </button>
      </div>

      <div className="p-4 space-y-4 min-w-0">
        {spec.context && (
          <div className="rounded-xl bg-amber-50 border border-amber-100 px-3.5 py-2.5">
            <p className="text-xs text-amber-900">{spec.context}</p>
          </div>
        )}

        {/* The team, with the load filling up as they assign. */}
        <div className="grid sm:grid-cols-2 gap-2">
          {spec.team.map((m) => {
            const used = load[m.key] || 0;
            const over = m.capacityDays && used > m.capacityDays;
            return (
              <div key={m.key} className={`rounded-xl border px-3.5 py-2.5 ${
                over ? 'border-rose-300 bg-rose-50' : 'border-slate-200 bg-white'}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-slate-900 truncate">{m.name}</span>
                  <span className={`shrink-0 inline-flex items-center gap-1 text-[11px] font-bold tabular-nums ${
                    over ? 'text-rose-600' : 'text-slate-500'}`}>
                    <Clock size={11} />{used}/{m.capacityDays}d
                  </span>
                </div>
                <div className="text-[11px] text-slate-500">{m.title}</div>
                {m.note && <p className="text-[11px] text-slate-500 mt-1 leading-snug">{m.note}</p>}
                {over && <p className="text-[11px] font-bold text-rose-600 mt-1">Over capacity</p>}
              </div>
            );
          })}
        </div>

        {/* The work. */}
        <div className="space-y-2">
          {spec.items.map((item) => (
            <div key={item.key} className="rounded-xl border border-slate-200 px-3.5 py-3">
              <div className="flex items-start justify-between gap-3 mb-2">
                <span className="text-sm font-semibold text-slate-900">{item.label}</span>
                {item.days ? (
                  <span className="shrink-0 text-[11px] font-bold text-slate-500 tabular-nums">{item.days}d</span>
                ) : null}
              </div>
              {item.note && <p className="text-[11px] text-slate-500 mb-2">{item.note}</p>}
              <div className="flex flex-wrap gap-1.5">
                {spec.team.map((m) => {
                  const on = picks[item.key] === m.key;
                  return (
                    <button
                      key={m.key}
                      onClick={() => setPicks((p) => ({ ...p, [item.key]: on ? null : m.key }))}
                      disabled={isGraded}
                      aria-label={`${item.label} to ${m.name}`}
                      aria-pressed={on}
                      className={`text-xs font-semibold rounded-lg border-2 px-2.5 py-1.5 transition-colors disabled:opacity-60 ${
                        on ? 'border-indigo-500 bg-indigo-50 text-slate-900'
                           : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
                    >
                      {m.name.split(' ')[0]}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <p className="text-[11px] text-slate-400">
          Leaving something unstaffed is allowed, and sometimes it is the answer. It is marked
          as a decision either way.
        </p>

        {error && (
          <div className="flex gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3">
            <AlertCircle size={14} className="text-rose-500 mt-0.5 shrink-0" />
            <p className="text-xs text-rose-800 font-medium">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function SignoffTask({ wb, onSubmit, submitting, isGraded }) {
  const spec = wb.signoff;
  const [picked, setPicked] = useState(null);
  const [reply, setReply] = useState('');
  const [error, setError] = useState('');

  const words = useMemo(() => reply.trim().split(/\s+/).filter(Boolean).length, [reply]);
  const max = spec.reply.maxWords;
  const over = max && words > max;

  async function send() {
    if (!picked) { setError('Make the call before you write to them.'); return; }
    if (words < 20) { setError('There is not enough here for them to act on.'); return; }
    setError('');
    await onSubmit(JSON.stringify({ picked: [picked], reply }));
  }

  return (
    <div className="flex flex-col min-w-0">
      <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-slate-200 bg-slate-50/60">
        <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
          <Gavel size={13} /> Sign-off
        </span>
        <button
          onClick={send}
          disabled={submitting || isGraded}
          aria-label="Submit for grading"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 disabled:opacity-40"
        >
          <Send size={12} />{submitting ? 'Submitting…' : 'Submit'}
        </button>
      </div>

      <div className="p-4 space-y-5 min-w-0">
        {spec.from && (
          <div className="flex items-start gap-2.5 rounded-xl bg-indigo-50 border border-indigo-100 px-3.5 py-2.5">
            <Gavel size={14} className="text-indigo-600 mt-0.5 shrink-0" />
            <p className="text-xs text-indigo-900">
              From <span className="font-bold">{spec.from}</span>
              {spec.fromTitle ? ` · ${spec.fromTitle}` : ''} — this goes out under your name,
              not theirs. The call counts for more than the wording.
            </p>
          </div>
        )}

        <Exhibit exhibit={spec.exhibit} />

        <div>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">The call</span>
            <p className="text-sm font-bold text-slate-900">{spec.decision.prompt}</p>
          </div>
          <div className="space-y-1.5">
            {spec.decision.options.map((o) => {
              const on = picked === o.key;
              const Box = on ? CheckCircle2 : Circle;
              return (
                <button
                  key={o.key}
                  onClick={() => setPicked(o.key)}
                  aria-label={o.label}
                  aria-pressed={on}
                  disabled={isGraded}
                  className={`w-full flex items-start gap-2.5 text-left rounded-xl border-2 px-3.5 py-2.5 text-sm transition-colors disabled:opacity-60 ${
                    on ? 'border-indigo-500 bg-indigo-50 text-slate-900 font-semibold'
                       : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'}`}
                >
                  <Box size={16} className={`shrink-0 mt-0.5 ${on ? 'text-indigo-600' : 'text-slate-300'}`} />
                  <span className="leading-snug">{o.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Then tell them</span>
            <p className="text-sm font-bold text-slate-900">{spec.reply.prompt}</p>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 mb-2">
            {spec.reply.to && <span>To: <span className="font-semibold text-slate-700">{spec.reply.to}</span></span>}
            {max && <span className={over ? 'text-rose-600 font-bold' : ''}>{words}/{max} words{over ? ' — over' : ''}</span>}
          </div>
          {spec.reply.covers && spec.reply.covers.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {spec.reply.covers.map((c) => (
                <span key={c} className="text-[11px] text-slate-600 bg-slate-100 rounded-md px-2 py-0.5">{c}</span>
              ))}
            </div>
          )}
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            disabled={isGraded}
            rows={7}
            aria-label="Your reply"
            placeholder={`Write to ${spec.from ? spec.from.split(' ')[0] : 'them'}…`}
            className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm leading-relaxed focus:outline-none focus:border-indigo-400 disabled:bg-slate-50"
          />
        </div>

        {error && (
          <div className="flex gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3">
            <AlertCircle size={14} className="text-rose-500 mt-0.5 shrink-0" />
            <p className="text-xs text-rose-800 font-medium">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
