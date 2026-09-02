import React, { useEffect, useMemo, useRef, useState } from 'react';
import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { sql, SQLite } from '@codemirror/lang-sql';
import { autocompletion, completionKeymap } from '@codemirror/autocomplete';
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching } from '@codemirror/language';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { Play, Send, Database, Table2, ChevronRight, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { api } from '../api.js';
import PythonNotebook from './PythonNotebook.jsx';
import ChartBuilder from './ChartBuilder.jsx';
import JudgementTask from './JudgementTask.jsx';

// CodeMirror 6 rather than Monaco. Monaco is literally VS Code's editor but ships
// ~2.5MB before a learner can type a character; CodeMirror gives the same felt
// experience — syntax highlighting, line numbers, autocomplete, bracket matching,
// undo history, Tab indent — for roughly a tenth of that. On the connections a lot of
// our learners are on, that difference is the difference between the tool opening and
// the tool being abandoned.

const EDITOR_THEME = EditorView.theme({
  '&': { fontSize: '13px', backgroundColor: '#ffffff', height: '100%' },
  '.cm-content': { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', padding: '12px 0' },
  '.cm-gutters': { backgroundColor: '#f8fafc', border: 'none', color: '#94a3b8', fontSize: '12px' },
  '.cm-activeLine': { backgroundColor: '#f8fafc' },
  '.cm-activeLineGutter': { backgroundColor: '#f1f5f9', color: '#475569' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { overflow: 'auto' },
});

// Feeds the dataset's real tables and columns to autocomplete, so Ctrl-Space offers
// the columns that actually exist rather than a generic SQL word list. This is the
// single feature that makes the editor feel like a real tool instead of a textarea.
function schemaForCompletion(dataset) {
  if (!dataset) return {};
  const out = {};
  for (const t of dataset.tables) out[t.name] = t.columns.map((c) => c.name);
  return out;
}

function ResultGrid({ result }) {
  if (!result) return null;
  if (!result.rows.length) {
    return (
      <div className="p-6 text-center text-sm text-slate-400 font-medium">
        Query ran fine but returned no rows.
      </div>
    );
  }
  return (
    <div className="overflow-auto max-h-full">
      <table className="w-full text-xs border-collapse">
        <thead className="sticky top-0 bg-slate-50 z-10">
          <tr>
            {result.columns.map((c) => (
              <th key={c} className="text-left font-bold text-slate-600 px-3 py-2 border-b border-slate-200 whitespace-nowrap">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.rows.map((row, i) => (
            <tr key={i} className="hover:bg-slate-50/70">
              {result.columns.map((c) => (
                <td key={c} className="px-3 py-1.5 border-b border-slate-100 text-slate-700 whitespace-nowrap tabular-nums">
                  {/* NULL is rendered distinctly — telling NULL apart from an empty
                      string is exactly the kind of thing these tasks turn on. */}
                  {row[c] === null || row[c] === undefined
                    ? <span className="text-slate-300 italic">NULL</span>
                    : String(row[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SchemaBrowser({ dataset, onInsert }) {
  const [open, setOpen] = useState(() => new Set(dataset ? dataset.tables.map((t) => t.name) : []));
  if (!dataset) return null;

  const toggle = (name) => setOpen((prev) => {
    const next = new Set(prev);
    if (next.has(name)) next.delete(name); else next.add(name);
    return next;
  });

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-3 py-2.5 border-b border-slate-200 sticky top-0 bg-white z-10">
        <div className="flex items-center gap-2">
          <Database size={14} className="text-indigo-500" />
          <span className="text-xs font-bold text-slate-800">{dataset.label}</span>
        </div>
        <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{dataset.description}</p>
      </div>

      {dataset.tables.map((t) => (
        <div key={t.name} className="border-b border-slate-100">
          <button
            onClick={() => toggle(t.name)}
            className="w-full flex items-center gap-1.5 px-3 py-2 hover:bg-slate-50 text-left"
          >
            <ChevronRight size={12} className={`text-slate-400 transition-transform ${open.has(t.name) ? 'rotate-90' : ''}`} />
            <Table2 size={13} className="text-slate-400 shrink-0" />
            <span className="text-xs font-bold text-slate-700 flex-1 min-w-0 truncate">{t.name}</span>
            <span className="text-[10px] text-slate-400 font-semibold tabular-nums shrink-0">{t.rowCount}</span>
          </button>

          {open.has(t.name) && (
            <div className="pb-1.5">
              {t.note && <p className="text-[10px] text-slate-400 px-3 pb-1.5 leading-snug italic">{t.note}</p>}
              {t.columns.map((c) => (
                <button
                  key={c.name}
                  onClick={() => onInsert && onInsert(c.name)}
                  title={c.note || `${c.name} — ${c.type}`}
                  className="w-full flex items-baseline gap-2 pl-8 pr-3 py-1 hover:bg-indigo-50 text-left group"
                >
                  <span className="text-[11px] font-mono text-slate-700 group-hover:text-indigo-700">{c.name}</span>
                  <span className="text-[10px] text-slate-400 ml-auto shrink-0">{c.type}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// The task workbench: schema on the left, editor top-right, results bottom-right.
// Run is free and unlimited (pure SQLite, no AI call); Submit is the graded action and
// is spent from the daily budget — the UI keeps that distinction obvious, because a
// learner who is afraid to experiment does not learn.
export default function Workbench({ taskId, onGraded }) {
  const [wb, setWb] = useState(null);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [runError, setRunError] = useState('');
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [graded, setGraded] = useState(null);

  const hostRef = useRef(null);
  const viewRef = useRef(null);

  useEffect(() => {
    let live = true;
    api.workbench(taskId)
      .then((d) => { if (live) setWb(d.workbench); })
      .catch((e) => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [taskId]);

  const schema = useMemo(() => schemaForCompletion(wb && wb.dataset), [wb]);

  // The editor is created once the schema is known, so autocomplete has the real
  // tables from the first keystroke rather than after a refresh.
  useEffect(() => {
    if (!wb || !hostRef.current || viewRef.current) return;

    const state = EditorState.create({
      doc: wb.submission || '-- Write your query here.\n-- Ctrl-Space for autocomplete. Ctrl-Enter to run.\n\nSELECT ',
      extensions: [
        lineNumbers(),
        history(),
        bracketMatching(),
        highlightActiveLine(),
        highlightSelectionMatches(),
        autocompletion(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        sql({ dialect: SQLite, schema, upperCaseKeywords: true }),
        keymap.of([
          // Ctrl/Cmd-Enter runs, the way every SQL client does it.
          { key: 'Mod-Enter', run: () => { runQuery(); return true; }, preventDefault: true },
          indentWithTab,
          ...defaultKeymap, ...historyKeymap, ...completionKeymap, ...searchKeymap,
        ]),
        EditorView.lineWrapping,
        EDITOR_THEME,
      ],
    });

    viewRef.current = new EditorView({ state, parent: hostRef.current });
    return () => { viewRef.current && viewRef.current.destroy(); viewRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wb]);

  const currentSql = () => (viewRef.current ? viewRef.current.state.doc.toString() : '');

  function insertAtCursor(text) {
    const view = viewRef.current;
    if (!view) return;
    const { from, to } = view.state.selection.main;
    view.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + text.length } });
    view.focus();
  }

  async function runQuery() {
    const q = currentSql().trim();
    if (!q) return;
    setRunning(true); setRunError(''); setResult(null);
    try {
      setResult(await api.runQuery(taskId, q));
    } catch (e) {
      setRunError(e.message);
    } finally {
      setRunning(false);
    }
  }

  async function submit() {
    const q = currentSql().trim();
    if (!q) return;
    return send(q);
  }

  // A chart task submits its choices as JSON rather than code. Same endpoint, same
  // review flow afterwards — only what is being submitted differs.
  async function submitChoices(payload) {
    return send(payload);
  }

  async function send(payload) {
    setSubmitting(true); setRunError('');
    try {
      const d = await api.submitTask(taskId, payload);
      setGraded({ score: d.score, feedback: d.feedback });
      onGraded && onGraded(d.state);
    } catch (e) {
      setRunError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (error) return <p className="text-sm text-rose-600 font-medium p-4">{error}</p>;
  if (!wb) return <p className="text-sm text-slate-400 font-medium p-4">Opening the workbench…</p>;

  const isGraded = wb.status === 'graded' || graded;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200">
        <h3 className="text-sm font-extrabold text-slate-900">{wb.title}</h3>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">{wb.brief}</p>
      </div>

      {/* A write-up has no schema pane, so it gets the full width rather than an empty
          220px column beside it. */}
      <div className={`grid grid-cols-1 min-h-[26rem] ${
        wb.tool === 'writeup' ? '' : 'lg:grid-cols-[minmax(0,220px)_minmax(0,1fr)]'}`}>
        {wb.tool !== 'writeup' && (
          <div className="border-b lg:border-b-0 lg:border-r border-slate-200 max-h-56 lg:max-h-none overflow-hidden">
            <SchemaBrowser dataset={wb.dataset} onInsert={wb.tool === 'python' || wb.tool === 'choice' ? null : insertAtCursor} />
          </div>
        )}

        {wb.tool === 'python' ? (
          <PythonNotebook wb={wb} onGraded={onGraded} />
        ) : wb.tool === 'chart' ? (
          <ChartBuilder wb={wb} onGraded={onGraded} onSubmit={submitChoices} submitting={submitting} isGraded={isGraded} />
        ) : (wb.tool === 'choice' || wb.tool === 'writeup') ? (
          <JudgementTask wb={wb} onSubmit={submitChoices} submitting={submitting} isGraded={isGraded} />
        ) : (
        <div className="flex flex-col min-w-0">
          <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-slate-200 bg-slate-50/60">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">SQL Editor</span>
            <div className="flex items-center gap-2">
              <button
                onClick={runQuery}
                disabled={running || isGraded}
                aria-label="Run query"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 disabled:opacity-40"
              >
                <Play size={12} />{running ? 'Running…' : 'Run'}
              </button>
              <button
                onClick={submit}
                disabled={submitting || isGraded}
                aria-label="Submit for grading"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 disabled:opacity-40"
              >
                <Send size={12} />{submitting ? 'Submitting…' : 'Submit'}
              </button>
            </div>
          </div>

          <div ref={hostRef} className="min-h-[11rem] max-h-[18rem] overflow-auto border-b border-slate-200" />

          <div className="flex-1 min-h-[9rem] overflow-hidden flex flex-col">
            <div className="flex items-center gap-3 px-3 py-1.5 border-b border-slate-100 bg-white">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Results</span>
              {result && (
                <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                  <Clock size={10} />
                  {result.totalRows} row{result.totalRows === 1 ? '' : 's'} · {result.elapsedMs}ms
                  {result.truncated && <span className="text-amber-600 font-semibold ml-1">(showing first {result.rows.length})</span>}
                </span>
              )}
            </div>

            <div className="flex-1 overflow-auto">
              {runError && (
                <div className="m-3 rounded-lg border border-rose-200 bg-rose-50 p-3 flex gap-2">
                  <AlertCircle size={14} className="text-rose-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-rose-800 font-medium leading-relaxed">{runError}</p>
                </div>
              )}
              {!runError && !result && (
                <p className="p-4 text-xs text-slate-400 font-medium">
                  Run your query to see results. Running is free and unlimited — only Submit is graded.
                </p>
              )}
              {!runError && <ResultGrid result={result} />}
            </div>
          </div>
        </div>
        )}
      </div>

      {(graded || wb.status === 'graded') && (
        <div className="border-t border-slate-200 p-4 bg-emerald-50/50">
          <div className="flex items-center gap-2 mb-1.5">
            <CheckCircle2 size={15} className="text-emerald-600" />
            <span className="text-sm font-extrabold text-slate-900">
              Graded — {graded ? graded.score : wb.score}/100
            </span>
          </div>
          <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">
            {graded ? graded.feedback : wb.feedback}
          </p>
        </div>
      )}
    </div>
  );
}
