import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ClipboardCheck, ArrowRight, ArrowLeft, Check, X, Sparkles } from 'lucide-react';
import { api } from '../api.js';

// The skills check.
//
// It runs before the first project because it is the BASELINE — the line the skill
// matrix measures from. Twelve weeks later "my SQL went from 52 to 84" is a sentence a
// learner can say in an interview; "my SQL is 84" is not.
//
// Two things it is deliberately not: it is not pass/fail (a low score still gets the
// project, and the copy says so before the first question), and it is not timed. Anxiety
// would only make the baseline wrong in the direction that flatters the product later.

const AXIS_LABEL = {
  sql: 'SQL', python: 'Python', dataViz: 'Data Viz',
  businessLogic: 'Business Logic', communication: 'Communication',
};

function Intro({ count, minutes, onStart, optional }) {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-400 flex items-center justify-center mb-5">
          <ClipboardCheck size={24} className="text-white" strokeWidth={2.1} />
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900 mb-2">Before your first project</h1>
        <p className="text-sm text-slate-600 leading-relaxed mb-4">
          {count} questions, about {minutes} minutes. Your manager uses this to pitch your first
          project at the right level — and it becomes the starting line on your skill matrix.
        </p>
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 mb-6">
          <p className="text-sm text-slate-700 leading-relaxed">
            <strong className="font-bold">This is not pass/fail.</strong> A low score changes
            nothing about the work you get — it just means there's more visible movement to show
            for the next twelve weeks. Answer honestly; a flattering baseline only makes your
            progress look smaller later.
          </p>
        </div>
        {optional && (
          <p className="text-xs text-slate-500 mb-5">
            You're already partway through a project, so this is optional. Taking it still gives
            your matrix a line to measure from.
          </p>
        )}
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={onStart}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800"
        >
          Start the skills check <ArrowRight size={15} />
        </motion.button>
      </div>
    </div>
  );
}

function Result({ result, onDone }) {
  const scored = Object.entries(result.skills).filter(([, v]) => typeof v === 'number');
  return (
    <div className="max-w-2xl mx-auto">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={18} className="text-indigo-500" />
          <h1 className="text-2xl font-extrabold text-slate-900">Your starting line</h1>
        </div>
        <p className="text-sm text-slate-600 mb-6">
          {result.correct} of {result.answered} correct. These are the numbers your progress is
          measured against — nothing here is a verdict.
        </p>

        <div className="space-y-3 mb-7">
          {scored.map(([axis, v]) => (
            <div key={axis}>
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-xs font-bold text-slate-700">{AXIS_LABEL[axis] || axis}</span>
                <span className="text-xs font-extrabold text-slate-900">{v}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }} animate={{ width: `${v}%` }} transition={{ duration: 0.6 }}
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-teal-400"
                />
              </div>
            </div>
          ))}
        </div>

        <details className="mb-6">
          <summary className="text-xs font-bold text-slate-600 cursor-pointer hover:text-indigo-600">
            See what each answer was testing
          </summary>
          <ul className="mt-3 space-y-3">
            {result.review.filter((r) => !r.skipped).map((r) => (
              <li key={r.id} className="rounded-xl border border-slate-200 p-3.5">
                <div className="flex items-start gap-2 mb-1.5">
                  {r.ok
                    ? <Check size={14} className="text-emerald-600 mt-0.5 shrink-0" />
                    : <X size={14} className="text-rose-500 mt-0.5 shrink-0" />}
                  <span className="text-xs font-bold text-slate-800 leading-snug">{r.prompt}</span>
                </div>
                {!r.ok && r.correctLabel && (
                  <p className="text-[11px] text-slate-600 mb-1 pl-6">
                    Answer: <span className="font-semibold text-slate-800">{r.correctLabel}</span>
                  </p>
                )}
                <p className="text-[11px] text-slate-500 leading-relaxed pl-6">{r.why}</p>
              </li>
            ))}
          </ul>
        </details>

        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={onDone}
          aria-label="Go to your first project"
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800"
        >
          Go to your first project <ArrowRight size={15} />
        </motion.button>
      </div>
    </div>
  );
}

export default function SkillTest({ skillTest, onDone }) {
  const [started, setStarted] = useState(false);
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [nextState, setNextState] = useState(null);

  const qs = skillTest.questions;
  const q = qs[i];
  const answered = useMemo(() => Object.keys(answers).length, [answers]);

  async function submit() {
    setBusy(true); setError('');
    try {
      const d = await api.submitSkillTest(answers);
      // The new state is held here, not handed up yet: pushing it to App immediately
      // would clear the gate and unmount this screen before the learner has seen their
      // own baseline, which is the one thing this whole step exists to show them.
      setResult(d.result);
      setNextState(d.state || null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (result) return <Result result={result} onDone={() => onDone(nextState)} />;
  if (!started) {
    return <Intro count={qs.length} minutes={skillTest.minutes} optional={skillTest.optional} onStart={() => setStarted(true)} />;
  }

  const last = i === qs.length - 1;
  return (
    <div className="max-w-2xl mx-auto">
      <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
        <div className="flex items-center gap-3 mb-5">
          <span className="text-[11px] font-extrabold uppercase tracking-wide text-indigo-500">
            {AXIS_LABEL[q.axis] || q.axis}
          </span>
          <span className="text-[11px] font-bold text-slate-400">Question {i + 1} of {qs.length}</span>
          <div className="ml-auto flex gap-1">
            {qs.map((x, n) => (
              <span key={x.id} className={`h-1.5 w-4 rounded-full ${
                answers[x.id] ? 'bg-indigo-500' : n === i ? 'bg-slate-400' : 'bg-slate-200'}`} />
            ))}
          </div>
        </div>

        <h2 className="text-base font-bold text-slate-900 leading-relaxed mb-5">{q.prompt}</h2>

        <div className="space-y-2 mb-6">
          {q.options.map((o) => {
            const picked = answers[q.id] === o.key;
            return (
              <button
                key={o.key}
                onClick={() => setAnswers((a) => ({ ...a, [q.id]: o.key }))}
                className={`w-full text-left rounded-xl border-2 px-4 py-3 text-sm transition-colors ${
                  picked ? 'border-indigo-500 bg-indigo-50 text-slate-900 font-semibold'
                         : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'}`}
              >
                {o.label}
              </button>
            );
          })}
        </div>

        {error && <p className="text-xs text-rose-700 font-semibold mb-3">{error}</p>}

        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => setI((n) => Math.max(0, n - 1))}
            disabled={i === 0}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 disabled:opacity-30 hover:text-slate-900"
          >
            <ArrowLeft size={14} /> Back
          </button>
          {last ? (
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={submit}
              disabled={busy || !answered}
              aria-label="Submit the skills check"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 disabled:opacity-40"
            >
              {busy ? 'Scoring…' : `Submit (${answered}/${qs.length} answered)`}
            </motion.button>
          ) : (
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => setI((n) => Math.min(qs.length - 1, n + 1))}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800"
            >
              Next <ArrowRight size={14} />
            </motion.button>
          )}
        </div>
        <p className="text-[11px] text-slate-400 mt-3">
          You can skip anything you're unsure of — an unanswered area is left blank on your
          matrix rather than scored as a zero.
        </p>
      </div>
    </div>
  );
}
