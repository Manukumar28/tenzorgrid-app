import React, { useMemo, useState } from 'react';
import { AlertTriangle, Archive, ArrowRight, ArrowUpRight, CheckCircle2, ChevronDown, Circle, ClipboardCheck, ClipboardList, Clock, GraduationCap, Mail, MessageSquare, Moon, PartyPopper, Send, Sunrise, Timer } from 'lucide-react';
import { BentoCard } from './ui.jsx';
import { api } from '../api.js';

// Today: the day in all three currencies.
//
// The task board answers "what analysis is outstanding". This answers the question a person
// actually has at 9am — what does today look like, and am I finished. Six tasks, two
// activities, two situations, and on the last day a quiz. A day is not over until all of it
// is, which is the thing that stops the product reading as a worksheet with a theme.

function Counter({ label, done, total, tone }) {
  const complete = total > 0 && done >= total;
  return (
    <div className="flex items-center gap-3">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
        complete ? 'bg-emerald-500' : tone}`}>
        {complete
          ? <CheckCircle2 size={18} className="text-white" strokeWidth={2.3} />
          : <span className="text-white text-xs font-extrabold tabular-nums">{Math.max(0, total - done)}</span>}
      </div>
      <div className="min-w-0">
        <p className="text-[12px] font-extrabold uppercase tracking-wide text-slate-500">{label}</p>
        {/* "6 of 6" on its own is read as a total, not as progress — the number in the
            chip beside it is what is LEFT, so the two together were saying opposite
            things with no label to tell them apart. */}
        <p className="text-sm font-bold text-slate-900 tabular-nums">
          {done}<span className="text-slate-500 font-semibold">/{total}</span>{' '}
          <span className={`text-[12px] font-bold ${complete ? 'text-emerald-700' : 'text-slate-500'}`}>
            {complete ? 'done' : `· ${total - done} left`}
          </span>
        </p>
      </div>
    </div>
  );
}

function Via({ via }) {
  const Icon = via === 'chat' ? MessageSquare : Mail;
  return (
    <span className="inline-flex items-center gap-1 text-[12px] font-bold uppercase tracking-wide text-slate-500">
      <Icon size={11} />{via === 'chat' ? 'Chat' : 'Email'}
    </span>
  );
}

// ---- Activities ----------------------------------------------------------------------

function Activity({ item, onDone, openByDefault }) {
  const [answer, setAnswer] = useState('');
  const [picked, setPicked] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const done = item.status === 'done';
  // An activity is a piece of reading with a question at the end, and rendering every one
  // of them open meant the column was 1,635px of essay before a learner had decided what
  // to do first — one card alone ran to 884px. Only the one being worked on is open.
  const [open, setOpen] = useState(Boolean(openByDefault) && !done);

  async function send() {
    setBusy(true); setError('');
    try {
      await onDone(item.key, item.check.kind === 'choice' ? picked : answer);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  const ready = item.check.kind === 'acknowledge'
    || (item.check.kind === 'choice' ? Boolean(picked) : answer.trim().split(/\s+/).length >= 5);

  return (
    <div className={`rounded-xl border p-4 ${done ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-start gap-2.5 mb-2">
        {done
          ? <CheckCircle2 size={17} className="text-emerald-700 shrink-0 mt-0.5" />
          : <Circle size={17} className="text-slate-500 shrink-0 mt-0.5" />}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <Via via={item.via} />
            <span className="text-[12px] font-bold uppercase tracking-wide text-slate-500">{item.type}</span>
            <span className="inline-flex items-center gap-1 text-[12px] text-slate-500"><Timer size={10} />{item.minutes} min</span>
            {done && typeof item.score === 'number' && (
              <span className="text-[12px] font-extrabold text-emerald-700">{item.score}%</span>
            )}
          </div>
          <p className="font-bold text-sm text-slate-900 leading-snug">{item.title}</p>
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={`${open ? 'Collapse' : 'Open'}: ${item.title}`}
          className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 text-[12px] font-bold text-slate-600 hover:bg-slate-50"
        >
          {open ? 'Close' : done ? 'Review' : 'Read'}
          <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {open
        ? <p className="text-[14px] text-slate-600 whitespace-pre-wrap leading-relaxed mb-3 pl-[27px]">{item.body}</p>
        : (
          <p className="text-[13px] text-slate-500 leading-snug mb-1 pl-[27px] line-clamp-2">
            {String(item.body || '').replace(/\s+/g, ' ').trim()}
          </p>
        )}

      {!done && open && (
        <div className="pl-[27px] space-y-2">
          {item.check.kind === 'choice' && (
            <>
              <p className="text-xs font-bold text-slate-800">{item.check.prompt}</p>
              <div className="space-y-1.5">
                {item.check.options.map((o) => (
                  <button
                    key={o.key}
                    onClick={() => setPicked(o.key)}
                    aria-label={o.label}
                    aria-pressed={picked === o.key}
                    className={`w-full text-left rounded-lg border-2 px-3 py-2 text-[14px] transition-colors ${
                      picked === o.key ? 'border-indigo-500 bg-indigo-50 font-semibold' : 'border-slate-200 hover:border-slate-300'}`}
                  >{o.label}</button>
                ))}
              </div>
            </>
          )}
          {item.check.kind === 'answer' && (
            <>
              <p className="text-xs font-bold text-slate-800">{item.check.prompt}</p>
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                rows={3}
                aria-label={item.check.prompt}
                placeholder="A few lines is enough…"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[14px] resize-y focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
              {item.check.maxWords && (
                <p className="text-[12px] text-slate-500">
                  {answer.trim().split(/\s+/).filter(Boolean).length} / {item.check.maxWords} words
                </p>
              )}
            </>
          )}
          <button
            onClick={send}
            disabled={busy || !ready}
            aria-label={`Complete: ${item.title}`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 disabled:opacity-40"
          >
            <Send size={12} />{busy ? 'Sending…' : item.check.kind === 'acknowledge' ? (item.check.label || 'Done') : 'Send'}
          </button>
          {error && <p className="text-xs text-rose-700 font-semibold">{error}</p>}
        </div>
      )}
    </div>
  );
}

// ---- Situations ------------------------------------------------------------------------

const ACTIONS = [
  { key: 'reply', label: 'Reply', Icon: Send },
  { key: 'defer', label: 'Later', Icon: Clock },
  { key: 'archive', label: 'Archive', Icon: Archive },
  { key: 'escalate', label: 'Escalate', Icon: ArrowUpRight },
];

function Situation({ item, onHandle }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const done = Boolean(item.handledAs);

  async function act(action) {
    if (action === 'reply' && !open) { setOpen(true); return; }
    setBusy(true); setError('');
    try {
      await onHandle(item.key, action, text);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  return (
    <div className={`rounded-xl border p-4 ${done ? 'border-slate-200 bg-slate-50/60' : 'border-amber-200 bg-amber-50/30'}`}>
      <div className="flex items-center gap-2 flex-wrap mb-1">
        <Via via={item.via} />
        <span className="text-[12px] font-bold uppercase tracking-wide text-slate-500">{item.type}</span>
        {done && (
          <span className="text-[12px] font-extrabold uppercase tracking-wide px-1.5 py-0.5 rounded bg-slate-200 text-slate-600">
            {item.handledAs}
          </span>
        )}
        {done && typeof item.score === 'number' && (
          <span className={`text-[12px] font-extrabold ${item.score >= 70 ? 'text-emerald-700' : item.score >= 40 ? 'text-amber-700' : 'text-rose-700'}`}>
            {item.score}%
          </span>
        )}
      </div>
      {item.senderName && (
        <p className="text-[12px] font-bold text-slate-500 mb-0.5">{item.senderName}</p>
      )}
      {item.subject && <p className="font-bold text-sm text-slate-900 leading-snug mb-1">{item.subject}</p>}
      <p className="text-[14px] text-slate-600 whitespace-pre-wrap leading-relaxed">{item.body}</p>

      {/* What it was looking for is shown only AFTER it is handled. Telling the learner
          which mail matters is the answer to the only question triage asks. */}
      {done && item.expect && item.expect.length > 0 && (
        <div className="mt-3 rounded-lg bg-white border border-slate-200 px-3 py-2">
          <p className="text-[12px] font-extrabold uppercase tracking-wide text-slate-500 mb-1">It needed</p>
          <ul className="space-y-0.5">
            {item.expect.map((e, i) => (
              <li key={i} className="text-[13px] text-slate-600 flex gap-1.5"><span className="text-slate-500">·</span>{e}</li>
            ))}
          </ul>
          {item.note && <p className="text-[13px] text-slate-500 mt-2 leading-relaxed">{item.note}</p>}
        </div>
      )}

      {!done && (
        <div className="mt-3 space-y-2">
          {open && (
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              aria-label="Your reply"
              placeholder="Your reply…"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[14px] resize-y focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          )}
          <div className="flex flex-wrap gap-1.5">
            {ACTIONS.map(({ key, label, Icon }) => (
              <button
                key={key}
                onClick={() => act(key)}
                disabled={busy || (key === 'reply' && open && text.trim().length < 10)}
                aria-label={`${label} — ${item.subject || item.type}`}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border disabled:opacity-40 ${
                  key === 'reply' ? 'bg-slate-900 text-white border-slate-900 hover:bg-slate-800'
                                  : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'}`}
              >
                <Icon size={12} />{key === 'reply' && open ? 'Send' : label}
              </button>
            ))}
          </div>
          {error && <p className="text-xs text-rose-700 font-semibold">{error}</p>}
        </div>
      )}
    </div>
  );
}

// ---- Company admin -----------------------------------------------------------------------
//
// The timesheet, the policy tick, the desk booking. A reminder that timesheets close on
// Friday is only realistic if there is somewhere to go and log them — otherwise the
// learner's first thought is "where would I even do that?", which is a fair question and
// exactly the wrong one to be having mid-analysis. So the form comes with the email.

function Chore({ item, onDone }) {
  const [values, setValues] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setValues((prev) => ({ ...prev, [k]: v }));

  async function submit() {
    setBusy(true); setError('');
    try {
      await onDone(item.key, values);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  return (
    <div className={`rounded-xl border p-4 ${item.done ? 'border-slate-200 bg-slate-50/60' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-center gap-2 flex-wrap mb-1">
        <span className="inline-flex items-center gap-1 text-[12px] font-extrabold uppercase tracking-wide text-slate-500">
          <ClipboardList size={11} /> Admin
        </span>
        {item.done && (
          <span className="text-[12px] font-extrabold uppercase tracking-wide px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">
            Done
          </span>
        )}
      </div>
      {item.senderName && <p className="text-[12px] font-bold text-slate-500 mb-0.5">{item.senderName}</p>}
      <p className="font-bold text-sm text-slate-900 leading-snug mb-1">{item.subject}</p>
      <p className="text-[14px] text-slate-600 whitespace-pre-wrap leading-relaxed">{item.body}</p>

      {item.done ? (
        <div className="mt-3 rounded-lg bg-white border border-slate-200 px-3 py-2">
          <p className="text-[12px] font-extrabold uppercase tracking-wide text-slate-500 mb-1">Submitted</p>
          <ul className="space-y-0.5">
            {Object.entries(item.values || {}).map(([k, v]) => (
              <li key={k} className="text-[13px] text-slate-600">{k}: <span className="font-semibold text-slate-800">{v}</span></li>
            ))}
          </ul>
        </div>
      ) : item.action ? (
        <div className="mt-3 space-y-2.5">
          {item.action.fields.map((f) => (
            <div key={f.key}>
              {f.kind === 'ack' ? (
                <label className="flex items-start gap-2 text-[14px] text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={values[f.key] === true}
                    onChange={(e) => set(f.key, e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-slate-300 shrink-0"
                  />
                  <span>{f.label}</span>
                </label>
              ) : (
                <>
                  <label className="block text-[12px] font-bold text-slate-500 mb-1" htmlFor={`ch-${item.key}-${f.key}`}>
                    {f.label}
                  </label>
                  {f.kind === 'number' ? (
                    <input
                      id={`ch-${item.key}-${f.key}`}
                      type="number"
                      min={f.min} max={f.max} step={f.step}
                      placeholder={f.placeholder}
                      value={values[f.key] ?? ''}
                      onChange={(e) => set(f.key, e.target.value)}
                      className="w-full max-w-[180px] rounded-lg border border-slate-200 px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    />
                  ) : (
                    <select
                      id={`ch-${item.key}-${f.key}`}
                      value={values[f.key] ?? ''}
                      onChange={(e) => set(f.key, e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[14px] bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    >
                      <option value="">Choose…</option>
                      {(f.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  )}
                </>
              )}
            </div>
          ))}
          <button
            onClick={submit}
            disabled={busy}
            aria-label={`${item.action.submitLabel} — ${item.subject}`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 disabled:opacity-40"
          >
            <Send size={12} />{item.action.submitLabel}
          </button>
          {error && <p className="text-xs text-rose-700 font-semibold">{error}</p>}
        </div>
      ) : null}
    </div>
  );
}

// ---- The Friday quiz ---------------------------------------------------------------------

function Quiz({ quiz, onSubmit }) {
  const [answers, setAnswers] = useState({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  if (quiz.taken && !result) {
    return (
      <BentoCard hover={false}>
        <div className="flex items-center gap-2 mb-1">
          <GraduationCap size={18} className="text-indigo-600" />
          <h3 className="text-base font-bold">{quiz.title}</h3>
        </div>
        <p className="text-sm text-slate-500">
          Done — <b className="text-slate-900">{quiz.right} of {quiz.total}</b> ({quiz.score}%).
        </p>
      </BentoCard>
    );
  }

  if (result) {
    return (
      <BentoCard hover={false}>
        <div className="flex items-center gap-2 mb-2">
          <GraduationCap size={18} className="text-indigo-600" />
          <h3 className="text-base font-bold">{result.right} of {result.total}</h3>
        </div>
        <div className="space-y-2.5">
          {result.results.map((r) => (
            <div key={r.id} className={`rounded-lg border px-3 py-2 ${r.correct ? 'border-emerald-200 bg-emerald-50/40' : 'border-rose-200 bg-rose-50/40'}`}>
              <p className="text-[14px] font-semibold text-slate-800 mb-1">{r.q}</p>
              {/* The reason is the point. A score with no explanation teaches nothing. */}
              <p className="text-[13px] text-slate-600 leading-relaxed">{r.why}</p>
            </div>
          ))}
        </div>
      </BentoCard>
    );
  }

  if (!quiz.open) {
    return (
      <BentoCard hover={false} className="border-slate-200">
        <div className="flex items-center gap-2 mb-1">
          <GraduationCap size={18} className="text-slate-500" />
          <h3 className="text-base font-bold text-slate-500">{quiz.title}</h3>
        </div>
        <p className="text-sm text-slate-500">Opens on the last day, once the week's work is delivered.</p>
      </BentoCard>
    );
  }

  const answered = Object.keys(answers).length;

  return (
    <BentoCard hover={false}>
      <div className="flex items-center gap-2 mb-1">
        <GraduationCap size={18} className="text-indigo-600" />
        <h3 className="text-base font-bold">{quiz.title}</h3>
      </div>
      <p className="text-sm text-slate-500 mb-4">{quiz.intro}</p>
      <div className="space-y-4">
        {quiz.questions.map((q, i) => (
          <div key={q.id}>
            <p className="text-sm font-semibold text-slate-900 mb-2">
              <span className="text-slate-500 mr-1.5 tabular-nums">{i + 1}.</span>{q.q}
            </p>
            <div className="space-y-1.5 pl-5">
              {q.options.map((o) => (
                <button
                  key={o.key}
                  onClick={() => setAnswers((a) => ({ ...a, [q.id]: o.key }))}
                  aria-label={o.label}
                  aria-pressed={answers[q.id] === o.key}
                  className={`w-full text-left rounded-lg border-2 px-3 py-2 text-[14px] transition-colors ${
                    answers[q.id] === o.key ? 'border-indigo-500 bg-indigo-50 font-semibold' : 'border-slate-200 hover:border-slate-300'}`}
                >{o.label}</button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3 mt-5">
        <button
          onClick={async () => {
            setBusy(true); setError('');
            try { setResult(await onSubmit(answers)); }
            catch (e) { setError(e.message); } finally { setBusy(false); }
          }}
          disabled={busy || answered < quiz.questions.length}
          aria-label="Submit the quiz"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 disabled:opacity-40"
        >
          <Send size={13} />{busy ? 'Marking…' : 'Submit'}
        </button>
        <span className="text-xs text-slate-500 tabular-nums">{answered} of {quiz.questions.length} answered</span>
      </div>
      {error && <p className="text-xs text-rose-700 font-semibold mt-2">{error}</p>}
    </BentoCard>
  );
}

// ---- The tab ------------------------------------------------------------------------------

// Today's six tasks, listed on Today.
//
// This tab counted tasks in its header and then never showed one: a learner saw
// "TASKS 6/6", scrolled past two essays, four emails and a timesheet, and never found the
// six pieces of work the day is actually made of, because they live on the Tasks tab.
// That was the single biggest reason the page was hard to follow.
function TodaysTasks({ rows, onOpen }) {
  if (!rows.length) return null;
  return (
    <BentoCard hover={false}>
      <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <span className="shrink-0 w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
            <ClipboardCheck size={18} />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-bold leading-tight">Today's tasks</h2>
            <p className="text-xs text-slate-500 mt-0.5">The work itself — open one to write the answer</p>
          </div>
        </div>
        <button
          onClick={onOpen}
          className="shrink-0 inline-flex items-center gap-1 text-xs font-bold text-indigo-700 hover:text-indigo-800"
        >
          Open the board <ArrowRight size={13} />
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {rows.map((t) => {
          const done = t.status === 'graded';
          return (
            <button
              key={t.id}
              onClick={onOpen}
              className={`flex items-center gap-2.5 text-left rounded-lg border px-3 py-2.5 transition-colors ${
                done ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200 bg-white hover:border-indigo-300'}`}
            >
              {done
                ? <CheckCircle2 size={16} className="text-emerald-700 shrink-0" />
                : <Circle size={16} className="text-slate-400 shrink-0" />}
              <span className={`text-[13px] font-semibold leading-snug min-w-0 flex-1 ${
                done ? 'text-slate-500 line-through' : 'text-slate-800'}`}>{t.title}</span>
              <span className="shrink-0 text-[12px] font-semibold text-slate-500 tabular-nums">
                {done && t.score !== null && t.score !== undefined ? `${t.score}%` : `~${t.estHours}h`}
              </span>
            </button>
          );
        })}
      </div>
    </BentoCard>
  );
}

export default function Today({ state, onStateChange, onTab }) {
  const { day, activities, situations, quiz, projectCompletion, taskBoard } = state;
  const [filter, setFilter] = useState('today');

  const shownDay = day ? day.unlocked : null;
  // Scoped to the day the header is counting, so the list and the "TASKS 6/6" beside it
  // are always the same six things.
  const todaysTasks = useMemo(
    () => ((taskBoard && taskBoard.rows) || []).filter((r) => (r.dayIndex || null) === shownDay),
    [taskBoard, shownDay],
  );
  const acts = useMemo(
    () => (activities || []).filter((a) => (filter === 'today' ? a.day === shownDay : true)),
    [activities, filter, shownDay],
  );
  // The project's situations and the company's mail share a table and a set of controls,
  // but they are not the same thing to the learner: two of these finish the day, and the
  // rest are just the job. Splitting them is the only honest way to show that.
  const all = useMemo(
    () => (situations || []).filter((x) => (filter === 'today' ? x.day === shownDay : true)),
    [situations, filter, shownDay],
  );
  const sits = useMemo(() => all.filter((x) => !x.deskMail), [all]);
  const todaysChores = useMemo(
    () => (state.chores || []).filter((c) => (filter === 'today' ? c.day === shownDay : true)),
    [state.chores, filter, shownDay],
  );
  const desk = useMemo(() => all.filter((x) => x.deskMail), [all]);
  const deskOpen = desk.filter((x) => !x.handledAs).length;

  async function doActivity(key, answer) {
    const d = await api.completeActivity(key, answer);
    if (d.state) onStateChange(d.state);
  }
  async function doSituation(key, action, text) {
    const d = await api.handleSituation(key, action, text);
    if (d.state) onStateChange(d.state);
  }
  async function doQuiz(answers) {
    const d = await api.submitQuiz(answers);
    if (d.state) onStateChange(d.state);
    return d;
  }
  async function doChore(key, values) {
    const d = await api.completeChore(key, values);
    if (d.state) onStateChange(d.state);
  }
  async function onCloseDay() {
    try {
      const d = await api.closeDay();
      if (d.state) onStateChange(d.state);
    } catch (e) { /* eslint-disable-next-line no-alert */ alert(e.message); }
  }
  async function onStartNextDay() {
    try {
      const d = await api.startNextDay();
      if (d.state) onStateChange(d.state);
    } catch (e) { /* eslint-disable-next-line no-alert */ alert(e.message); }
  }

  const finished = projectCompletion && projectCompletion.complete;

  return (
    <div className="space-y-4">
      <div className="flex items-baseline gap-2.5 flex-wrap">
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Today</h1>
        <span className="text-sm font-semibold text-slate-500">
          {day ? `Day ${day.unlocked} of ${day.totalDays}` : 'Nothing running'}
        </span>
      </div>

      {finished && (
        <BentoCard hover={false} className="border-emerald-300 bg-emerald-50/50">
          <div className="flex items-start gap-3">
            <PartyPopper size={22} className="text-emerald-700 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <h3 className="text-base font-bold text-slate-900 mb-1">Project complete</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                {projectCompletion.tasks.total} tasks, {projectCompletion.activities.total} activities,{' '}
                {projectCompletion.situations.total} situations{projectCompletion.quiz.taken ? ' and the quiz' : ''} — all done
                {projectCompletion.avgScore ? `, averaging ${projectCompletion.avgScore} on the graded work` : ''}.
                Asha's sign-off is in your inbox.
              </p>
              <button
                onClick={() => onTab && onTab('projects')}
                className="mt-2.5 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-slate-800"
              >
                Pick up the next project
              </button>
            </div>
          </div>
        </BentoCard>
      )}

      {/* The day is over, and it says so.
          A working day ends with somebody telling you that is enough — and a day that
          simply runs out of things in it never gets to. This is the one moment in the week
          where the product has something unambiguously good to say, so it gets the whole
          card and the next day waits behind a button rather than arriving underneath it. */}
      {day && day.closed && (
        <BentoCard hover={false} className="border-indigo-300 bg-indigo-50/50">
          <div className="flex items-start gap-3">
            <Moon size={22} className="text-indigo-600 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-bold text-slate-900 mb-1">
                That's {day.dayName} done — good work.
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                {day.tasks.total} tasks through review, {day.activities.total} activities, and you
                cleared everything that landed on you
                {day.quizTaken ? ', quiz included' : ''}. Nothing else from Asha today.
              </p>
              {day.nextDayName ? (
                <button
                  onClick={onStartNextDay}
                  aria-label={`Start ${day.nextDayName}`}
                  className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-slate-800"
                >
                  <Sunrise size={13} /> Start {day.nextDayName}
                </button>
              ) : (
                <p className="text-sm font-bold text-indigo-800 mt-2">That was the last day of the project.</p>
              )}
            </div>
          </div>
        </BentoCard>
      )}

      {day && !day.closed && (
        <BentoCard hover={false} className={day.readyToClose ? 'border-emerald-300 bg-emerald-50/40' : ''}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Counter label="Tasks" done={day.tasks.done} total={day.tasks.total} tone="bg-indigo-500" />
            <Counter label="Activities" done={day.activities.done} total={day.activities.total} tone="bg-sky-500" />
            <Counter label="Situations" done={day.situations.done} total={day.situations.total} tone="bg-amber-500" />
          </div>

          {day.readyToClose ? (
            <div className="mt-4 flex items-center gap-3 flex-wrap">
              <button
                onClick={onCloseDay}
                aria-label="Sign off for the day"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700"
              >
                <Moon size={15} /> That's the day — sign off
              </button>
              <p className="text-xs text-slate-600 font-semibold">
                Everything for {day.dayName} is done.
              </p>
            </div>
          ) : (
            <p className="text-xs text-slate-500 mt-4 leading-relaxed">
              {/* Counters say "4 of 6". This says what the missing two actually are, which
                  is what a person needs in order to go and do them. */}
              <span className="font-bold text-slate-700">Still to do today: </span>
              {day.pending && day.pending.length ? day.pending.join(', ') : 'nothing — you are clear'}.
              {' '}The day finishes when all of it is clear, not when the tasks are.
            </p>
          )}
        </BentoCard>
      )}

      <div className="flex gap-1.5">
        {[['today', 'Today'], ['all', 'The whole week']].map(([k, label]) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            aria-pressed={filter === k}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
              filter === k ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}
          >{label}</button>
        ))}
      </div>

      <TodaysTasks rows={todaysTasks} onOpen={() => onTab && onTab('tasks')} />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
        <div className="space-y-3 min-w-0">
          {/* Both columns used to be a bare shouty label. A learner on day one has no way
              to know that "activities" is reading-with-a-question and the other column is
              mail that has to be dealt with, so each says so in one line. */}
          <div>
            <h2 className="text-sm font-extrabold uppercase tracking-wide text-slate-500">Activities</h2>
            <p className="text-xs text-slate-500 mt-0.5">Short reading, each with a question at the end</p>
          </div>
          {acts.length === 0 && <p className="text-sm text-slate-500">Nothing yet.</p>}
          {/* The first one still to do opens itself, so the column always offers something
              to start rather than a row of shut doors. */}
          {acts.map((a) => (
            <Activity
              key={a.key}
              item={a}
              onDone={doActivity}
              openByDefault={a.key === (acts.find((x) => x.status !== 'done') || {}).key}
            />
          ))}
        </div>
        <div className="space-y-3 min-w-0">
          <div>
            <h2 className="text-sm font-extrabold uppercase tracking-wide text-slate-500">
              What landed on you
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Messages that need a decision — reply, defer, archive or escalate</p>
          </div>
          {sits.length === 0 && <p className="text-sm text-slate-500">Quiet so far.</p>}
          {sits.map((x) => <Situation key={x.key} item={x} onHandle={doSituation} />)}
        </div>
      </div>

      {/* Mail addressed to you by name. It does not finish the day and it is not supposed
          to — the point is that a real inbox asks for things on top of the work, and the
          people asking are the ones who decide what your week looked like. */}
      {desk.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-baseline gap-2.5 flex-wrap">
            <h2 className="text-sm font-extrabold uppercase tracking-wide text-slate-500">
              Addressed to you
            </h2>
            <span className="text-xs font-semibold text-slate-500">
              {deskOpen > 0
                ? `${deskOpen} waiting on a reply — they don't finish the day, but people are waiting`
                : 'All answered'}
            </span>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 items-start">
            {desk.map((x) => <Situation key={x.key} item={x} onHandle={doSituation} />)}
          </div>
        </div>
      )}

      {todaysChores.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-baseline gap-2.5 flex-wrap">
            <h2 className="text-sm font-extrabold uppercase tracking-wide text-slate-500">Company admin</h2>
            <span className="text-xs font-semibold text-slate-500">
              Dull, compulsory, fifteen seconds — like the real ones
            </span>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 items-start">
            {todaysChores.map((c) => <Chore key={c.key} item={c} onDone={doChore} />)}
          </div>
        </div>
      )}

      {quiz && <Quiz quiz={quiz} onSubmit={doQuiz} />}
    </div>
  );
}
