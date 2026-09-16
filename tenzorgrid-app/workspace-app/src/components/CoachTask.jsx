import React, { useMemo, useState } from 'react';
import { Send, AlertCircle, Mail, Code2, Table2, CheckSquare, Square, StickyNote, GraduationCap } from 'lucide-react';

// The coaching task — the senior responsibility slot.
//
// Two halves in one submission, because coaching really is two skills and people are
// reliably good at one and bad at the other: seeing what is wrong, and saying it in a way
// the other person can act on. Both are graded, fifty-fifty.
//
// The halves are shown together rather than as a two-step wizard on purpose. You write the
// message while looking at what you decided was wrong — which is how it works at a desk,
// and it stops the reply drifting away from the diagnosis behind it.

const EXHIBIT_ICON = { sql: Code2, email: Mail, table: Table2, note: StickyNote };

function Exhibit({ exhibit }) {
  if (!exhibit) return null;
  const Icon = EXHIBIT_ICON[exhibit.kind] || Mail;
  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <div className="flex items-center gap-2 px-3.5 py-2 bg-slate-50 border-b border-slate-200">
        <Icon size={13} className="text-slate-500 shrink-0" />
        <span className="text-[12px] font-bold text-slate-600 truncate">{exhibit.from}</span>
        {exhibit.subject && <span className="text-[12px] text-slate-500 truncate">· {exhibit.subject}</span>}
      </div>
      <pre className={`px-3.5 py-3 text-xs leading-relaxed whitespace-pre-wrap overflow-x-auto ${
        exhibit.kind === 'sql' ? 'font-mono text-slate-800' : 'font-sans text-slate-700'}`}>
        {exhibit.body}
      </pre>
    </div>
  );
}

export default function CoachTask({ wb, onSubmit, submitting, isGraded }) {
  const spec = wb.coach;
  const [picked, setPicked] = useState([]);
  const [reply, setReply] = useState('');
  const [error, setError] = useState('');

  const words = useMemo(() => reply.trim().split(/\s+/).filter(Boolean).length, [reply]);
  const max = spec.reply.maxWords;
  const over = max && words > max;

  function toggle(key) {
    setPicked((p) => (p.includes(key) ? p.filter((k) => k !== key) : [...p, key]));
  }

  async function send() {
    if (!picked.length) { setError('Say what you think is wrong before you write to him.'); return; }
    if (words < 20) { setError('There is not enough here for him to act on yet.'); return; }
    setError('');
    await onSubmit(JSON.stringify({ picked, reply }));
  }

  return (
    <div className="flex flex-col min-w-0">
      <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-slate-200 bg-slate-50/60">
        <span className="flex items-center gap-1.5 text-[12px] font-bold text-slate-500 uppercase tracking-wider">
          <GraduationCap size={13} /> Coaching
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
        {spec.mentee && (
          <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 border border-amber-100 px-3.5 py-2.5">
            <GraduationCap size={14} className="text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-900">
              <span className="font-bold">{spec.mentee}</span>
              {spec.menteeTitle ? ` · ${spec.menteeTitle}` : ''} — you are the senior on this.
              Both halves are marked: what you spot, and what you say.
            </p>
          </div>
        )}

        <Exhibit exhibit={spec.exhibit} />

        {/* Half one — the diagnosis. */}
        <div>
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-[12px] font-bold uppercase tracking-wider text-slate-500">Step 1</span>
            <p className="text-sm font-bold text-slate-900">{spec.diagnose.prompt}</p>
          </div>
          <p className="text-[12px] text-slate-500 mb-3">
            Flagging something that isn't a problem costs you the same as missing one — and it
            costs him more, because he'll go and "fix" it.
          </p>
          <div className="space-y-1.5">
            {spec.diagnose.options.map((o) => {
              const on = picked.includes(o.key);
              const Box = on ? CheckSquare : Square;
              return (
                <button
                  key={o.key}
                  onClick={() => toggle(o.key)}
                  aria-label={o.label}
                  aria-pressed={on}
                  disabled={isGraded}
                  className={`w-full flex items-start gap-2.5 text-left rounded-xl border-2 px-3.5 py-2.5 text-sm transition-colors disabled:opacity-60 ${
                    on ? 'border-indigo-500 bg-indigo-50 text-slate-900 font-semibold'
                       : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'}`}
                >
                  <Box size={16} className={`shrink-0 mt-0.5 ${on ? 'text-indigo-600' : 'text-slate-500'}`} />
                  <span className="leading-snug">{o.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Half two — what he actually receives. */}
        <div>
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-[12px] font-bold uppercase tracking-wider text-slate-500">Step 2</span>
            <p className="text-sm font-bold text-slate-900">{spec.reply.prompt}</p>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-slate-500 mb-2">
            {spec.reply.to && <span>To: <span className="font-semibold text-slate-700">{spec.reply.to}</span></span>}
            {max && (
              <span className={over ? 'text-rose-600 font-bold' : ''}>
                {words}/{max} words{over ? ' — over' : ''}
              </span>
            )}
          </div>
          {spec.reply.covers && spec.reply.covers.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {spec.reply.covers.map((c) => (
                <span key={c} className="text-[12px] text-slate-600 bg-slate-100 rounded-md px-2 py-0.5">{c}</span>
              ))}
            </div>
          )}
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            disabled={isGraded}
            rows={8}
            aria-label="Your reply"
            placeholder={`Write to ${spec.mentee ? spec.mentee.split(' ')[0] : 'them'}…`}
            className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm leading-relaxed focus:outline-none focus:border-indigo-400 disabled:bg-slate-50"
          />
          <p className="text-[12px] text-slate-500 mt-1.5">
            He has to be able to fix it himself afterwards. Handing him the corrected version
            gets today sorted and teaches him nothing.
          </p>
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
