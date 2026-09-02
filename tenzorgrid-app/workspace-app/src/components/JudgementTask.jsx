import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Send, AlertCircle, Mail, Code2, Table2, CheckSquare, Square } from 'lucide-react';

// The two task types that are not code.
//
// `choice`  — a structured judgement over an exhibit: a colleague's query, a stakeholder's
//             email, a result table. The learner ticks what is true. Selecting everything
//             scores zero, and the UI says so up front — the habit being taught is
//             discrimination, not caution.
//
// `writeup` — a real email composer. The recipient, subject and word limit are all shown,
//             because a brief that hides what it is asking for is a trick rather than an
//             assessment. What the piece has to cover is listed too; how to cover it is
//             the work.

const EXHIBIT_ICON = { sql: Code2, email: Mail, table: Table2 };

function Exhibit({ exhibit }) {
  if (!exhibit) return null;
  const Icon = EXHIBIT_ICON[exhibit.kind] || Mail;
  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <div className="flex items-center gap-2 px-3.5 py-2 bg-slate-50 border-b border-slate-200">
        <Icon size={13} className="text-slate-500 shrink-0" />
        <span className="text-[11px] font-bold text-slate-600 truncate">{exhibit.from}</span>
        {exhibit.subject && (
          <span className="text-[11px] text-slate-400 truncate">· {exhibit.subject}</span>
        )}
      </div>
      <pre className={`px-3.5 py-3 text-xs leading-relaxed whitespace-pre-wrap overflow-x-auto ${
        exhibit.kind === 'email' ? 'font-sans text-slate-700' : 'font-mono text-slate-800'}`}>
        {exhibit.body}
      </pre>
    </div>
  );
}

function ChoiceTask({ wb, onSubmit, submitting, isGraded }) {
  const spec = wb.choice;
  const [picked, setPicked] = useState([]);
  const [error, setError] = useState('');

  function toggle(key) {
    setPicked((p) => (p.includes(key) ? p.filter((k) => k !== key) : [...p, key]));
  }

  async function send() {
    if (!picked.length) { setError('Pick at least one before submitting.'); return; }
    setError('');
    await onSubmit(JSON.stringify(picked));
  }

  return (
    <div className="flex flex-col min-w-0">
      <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-slate-200 bg-slate-50/60">
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Your judgement</span>
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
        <Exhibit exhibit={spec.exhibit} />

        <div>
          <p className="text-sm font-bold text-slate-900 mb-1">{spec.prompt}</p>
          {/* Stated plainly, because it changes how people answer: a learner who thinks
              caution is free will tick everything, and that is the habit worth breaking. */}
          <p className="text-[11px] text-slate-500 mb-3">
            Flagging something that isn't a problem costs you the same as missing one.
          </p>

          <div className="space-y-1.5">
            {spec.options.map((o) => {
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
                  <Box size={16} className={`shrink-0 mt-0.5 ${on ? 'text-indigo-600' : 'text-slate-300'}`} />
                  <span className="leading-snug">{o.label}</span>
                </button>
              );
            })}
          </div>
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

function WriteupTask({ wb, onSubmit, submitting, isGraded }) {
  const spec = wb.writeup;
  const [body, setBody] = useState('');
  const [error, setError] = useState('');

  const words = useMemo(() => body.trim().split(/\s+/).filter(Boolean).length, [body]);
  const over = spec.maxWords && words > spec.maxWords;

  async function send() {
    if (words < 20) { setError('There is not enough here to send to anyone yet.'); return; }
    setError('');
    await onSubmit(body);
  }

  return (
    <div className="flex flex-col min-w-0">
      <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-slate-200 bg-slate-50/60">
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Compose</span>
        <button
          onClick={send}
          disabled={submitting || isGraded}
          aria-label="Submit for grading"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 disabled:opacity-40"
        >
          <Send size={12} />{submitting ? 'Sending…' : 'Send'}
        </button>
      </div>

      <div className="p-4 space-y-3.5 min-w-0">
        <Exhibit exhibit={spec.exhibit} />

        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-3.5 py-2 border-b border-slate-200 bg-slate-50">
            <p className="text-xs text-slate-500">To: <span className="font-semibold text-slate-800">{spec.to}</span></p>
            <p className="text-xs text-slate-500">Subject: <span className="font-semibold text-slate-800">{spec.subject}</span></p>
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={9}
            disabled={isGraded}
            aria-label="Your email to the stakeholder"
            placeholder="Lead with the answer…"
            className="w-full px-3.5 py-3 text-sm resize-y focus:outline-none disabled:bg-slate-50"
          />
          <div className="flex items-center justify-between gap-3 px-3.5 py-2 border-t border-slate-200 bg-slate-50">
            <span className={`text-[11px] font-bold ${over ? 'text-rose-600' : 'text-slate-500'}`}>
              {words} / {spec.maxWords} words
            </span>
            {over && <span className="text-[11px] text-rose-600">Over the brief</span>}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3">
          <p className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500 mb-1.5">It needs to cover</p>
          <ul className="space-y-1">
            {spec.covers.map((c, i) => (
              <li key={i} className="text-xs text-slate-700 flex gap-2">
                <span className="text-slate-400">·</span>{c}
              </li>
            ))}
          </ul>
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

export default function JudgementTask(props) {
  return props.wb.tool === 'writeup' ? <WriteupTask {...props} /> : <ChoiceTask {...props} />;
}
