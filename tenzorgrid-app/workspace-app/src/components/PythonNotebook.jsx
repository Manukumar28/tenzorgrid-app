import React, { useEffect, useRef, useState } from 'react';
import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { python } from '@codemirror/lang-python';
import { autocompletion, completionKeymap } from '@codemirror/autocomplete';
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching, indentUnit } from '@codemirror/language';
import { searchKeymap } from '@codemirror/search';
import { Play, Send, Terminal as TerminalIcon, AlertCircle, CheckCircle2, Loader2, Cpu } from 'lucide-react';
import { api } from '../api.js';

// Real CPython, compiled to WebAssembly, running in the learner's own tab.
//
// SELF-HOSTED, NOT CDN-LOADED. The runtime is copied out of node_modules into
// /pyodide/ at build time (see workspace-app/postbuild.js). Three reasons: learners on
// restrictive campus or corporate networks can still run Python, a CDN outage cannot
// take the tool down, and the version is pinned by package.json rather than by a URL
// nobody re-reads. The files are served with a one-year immutable cache, so the ~14MB
// download happens once per learner, not once per visit.
//
// STANDARD LIBRARY ONLY, deliberately. pandas ships as a separate set of WebAssembly
// wheels that are not part of the npm package, so including it would mean either a CDN
// round-trip (losing every advantage above) or an environment that has pandas for some
// learners and not others — which is intolerable when the task is graded. `statistics`,
// `collections` and `itertools` cover this task honestly, and working from lists of
// dicts is arguably the better first lesson anyway.

const PYODIDE_URL = '/pyodide/';

// Everything the learner's code can rely on being there already. Keeping the data as
// plain lists of dicts (rather than hiding it behind a helper class) means what they
// learn here is ordinary Python, transferable to any job.
const PREAMBLE = `
import json, math, statistics, itertools
from collections import defaultdict, Counter

tables = json.loads(__tg_data__)

def __tg_clean(v):
    if isinstance(v, float):
        if math.isnan(v) or math.isinf(v):
            return None
        return v
    return v

def __tg_pack(r):
    """Normalises whatever the learner assigned to \`result\` into rows we can grade."""
    if r is None:
        return None
    if isinstance(r, dict):
        r = [r]
    if not isinstance(r, (list, tuple)):
        return json.dumps([{"value": __tg_clean(r)}], default=str)
    out = []
    for row in r:
        if isinstance(row, dict):
            out.append({k: __tg_clean(v) for k, v in row.items()})
        elif isinstance(row, (list, tuple)):
            out.append({f"col{i}": __tg_clean(v) for i, v in enumerate(row)})
        else:
            out.append({"value": __tg_clean(row)})
    return json.dumps(out, default=str)
`;

const STARTER = `# The project dataset is already loaded as \`tables\`:
#   tables["employees"]   -> list of dicts, one per row
#   tables["departments"] -> list of dicts, one per row
#
# The standard library is available: statistics, collections, itertools, math.
# Assign your answer to \`result\` — a list of dicts is ideal.
# Ctrl-Enter runs.

print(tables["employees"][0])

result = []
`;

const EDITOR_THEME = EditorView.theme({
  '&': { fontSize: '13px', backgroundColor: '#ffffff', height: '100%' },
  '.cm-content': { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', padding: '12px 0' },
  '.cm-gutters': { backgroundColor: '#f8fafc', border: 'none', color: '#94a3b8', fontSize: '12px' },
  '.cm-activeLine': { backgroundColor: '#f8fafc' },
  '.cm-activeLineGutter': { backgroundColor: '#f1f5f9', color: '#475569' },
  '&.cm-focused': { outline: 'none' },
});

// One interpreter per page, shared across tasks and reused between runs. Booting
// CPython is expensive enough that doing it per-run would make the tool unusable.
let pyodidePromise = null;

// Pyodide does NOT reject when WebAssembly compilation is refused — it logs a
// CompileError to the console and then never settles. That is exactly what a
// too-strict Content-Security-Policy produces, and it turns a clear failure into an
// infinite spinner, so the boot is raced against a deadline and reported honestly.
const BOOT_TIMEOUT_MS = 90000;

function getPyodide(onProgress) {
  if (!pyodidePromise) {
    pyodidePromise = Promise.race([
      (async () => {
        onProgress && onProgress('Downloading the Python runtime…');
        const { loadPyodide } = await import(/* @vite-ignore */ `${PYODIDE_URL}pyodide.mjs`);
        onProgress && onProgress('Starting Python…');
        return loadPyodide({ indexURL: PYODIDE_URL });
      })(),
      new Promise((_, reject) => setTimeout(
        () => reject(new Error(
          'The Python runtime did not start within 90 seconds. This is usually a slow '
          + 'connection — reload and try again. If it keeps happening, your browser may '
          + 'be blocking WebAssembly.')),
        BOOT_TIMEOUT_MS,
      )),
    ]).catch((e) => {
      pyodidePromise = null; // let a later attempt retry rather than failing forever
      throw e;
    });
  }
  return pyodidePromise;
}

function ResultGrid({ rows }) {
  if (!rows || !rows.length) return null;
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  return (
    <div className="overflow-auto max-h-full">
      <table className="w-full text-xs border-collapse">
        <thead className="sticky top-0 bg-slate-50 z-10">
          <tr>{cols.map((c) => (
            <th key={c} className="text-left font-bold text-slate-600 px-3 py-2 border-b border-slate-200 whitespace-nowrap">{c}</th>
          ))}</tr>
        </thead>
        <tbody>
          {rows.slice(0, 200).map((row, i) => (
            <tr key={i} className="hover:bg-slate-50/70">
              {cols.map((c) => (
                <td key={c} className="px-3 py-1.5 border-b border-slate-100 text-slate-700 whitespace-nowrap tabular-nums">
                  {row[c] === null || row[c] === undefined
                    ? <span className="text-slate-300 italic">None</span>
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

export default function PythonNotebook({ wb, onGraded }) {
  const [booting, setBooting] = useState('');
  const [ready, setReady] = useState(false);
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [stdout, setStdout] = useState('');
  const [error, setError] = useState('');
  const [rows, setRows] = useState(null);
  const [elapsed, setElapsed] = useState(null);
  const [graded, setGraded] = useState(null);

  const hostRef = useRef(null);
  const viewRef = useRef(null);
  const pyRef = useRef(null);
  const dataRef = useRef(null);

  useEffect(() => {
    if (!hostRef.current || viewRef.current) return;
    const state = EditorState.create({
      doc: wb.submission || STARTER,
      extensions: [
        lineNumbers(), history(), bracketMatching(), highlightActiveLine(),
        autocompletion(), indentUnit.of('    '),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        python(),
        keymap.of([
          { key: 'Mod-Enter', run: () => { run(); return true; }, preventDefault: true },
          indentWithTab, ...defaultKeymap, ...historyKeymap, ...completionKeymap, ...searchKeymap,
        ]),
        EditorView.lineWrapping,
        EDITOR_THEME,
      ],
    });
    viewRef.current = new EditorView({ state, parent: hostRef.current });
    return () => { viewRef.current && viewRef.current.destroy(); viewRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const code = () => (viewRef.current ? viewRef.current.state.doc.toString() : '');

  // Boots the interpreter and loads this task's data into it. Only ever done once.
  async function ensureReady() {
    if (pyRef.current) return pyRef.current;
    const py = await getPyodide(setBooting);
    setBooting('Loading the project dataset…');
    const data = dataRef.current || (dataRef.current = await api.taskData(wb.taskId));
    py.globals.set('__tg_data__', JSON.stringify(data.tables));
    await py.runPythonAsync(PREAMBLE);
    pyRef.current = py;
    setBooting('');
    setReady(true);
    return py;
  }

  async function run() {
    setRunning(true); setError(''); setStdout(''); setRows(null); setElapsed(null);
    let buffer = '';
    try {
      const py = await ensureReady();
      py.setStdout({ batched: (s) => { buffer += s + '\n'; } });
      py.setStderr({ batched: (s) => { buffer += s + '\n'; } });

      // Clear any `result` left over from a previous run, so a run that fails to set
      // one shows as empty rather than silently reusing the last good answer.
      await py.runPythonAsync('globals().pop("result", None)');

      const t0 = performance.now();
      await py.runPythonAsync(code());
      const packed = await py.runPythonAsync('__tg_pack(result) if "result" in globals() else None');
      setElapsed(Math.round(performance.now() - t0));
      setStdout(buffer);
      setRows(packed ? JSON.parse(packed) : null);
    } catch (e) {
      setStdout(buffer);
      // Pyodide puts the full Python traceback in the message; the last line is the
      // actual error, which is what a learner needs first.
      setError(String(e.message || e));
      setBooting('');
    } finally {
      setRunning(false);
    }
  }

  async function submit() {
    if (!rows) { setError('Run your code first — there is no `result` to submit yet.'); return; }
    setSubmitting(true); setError('');
    try {
      const d = await api.submitPython(wb.taskId, code(), rows);
      setGraded({ score: d.score, feedback: d.feedback });
      onGraded && onGraded(d.state);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  const isGraded = wb.status === 'graded' || graded;
  // The traceback's last non-empty line is the message a learner acts on.
  const errorHeadline = error ? (error.trim().split('\n').filter(Boolean).pop() || error) : '';

  return (
    <div className="flex flex-col min-w-0">
      <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-slate-200 bg-slate-50/60">
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
          <Cpu size={12} className="text-indigo-500" />Python Notebook
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={run} disabled={running || isGraded}
            aria-label="Run code"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 disabled:opacity-40"
          >
            {running ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
            {running ? 'Running…' : 'Run'}
          </button>
          <button
            onClick={submit} disabled={submitting || isGraded || !rows}
            aria-label="Submit for grading"
            title={!rows ? 'Run your code first' : undefined}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 disabled:opacity-40"
          >
            <Send size={12} />{submitting ? 'Submitting…' : 'Submit'}
          </button>
        </div>
      </div>

      <div ref={hostRef} className="min-h-[13rem] max-h-[20rem] overflow-auto border-b border-slate-200" />

      <div className="flex-1 min-h-[9rem] flex flex-col">
        <div className="flex items-center gap-3 px-3 py-1.5 border-b border-slate-100">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <TerminalIcon size={11} />Output
          </span>
          {elapsed !== null && (
            <span className="text-[11px] text-slate-400 font-medium">
              {rows ? `${rows.length} row${rows.length === 1 ? '' : 's'} · ` : ''}{elapsed}ms
            </span>
          )}
          {booting && (
            <span className="text-[11px] text-indigo-600 font-semibold flex items-center gap-1.5">
              <Loader2 size={10} className="animate-spin" />{booting}
            </span>
          )}
        </div>

        <div className="flex-1 overflow-auto">
          {!ready && !booting && !error && (
            <p className="p-4 text-xs text-slate-400 font-medium leading-relaxed">
              Real Python runs here, in your browser — nothing you try is sent anywhere.
              The first run downloads the runtime (about 14MB) and takes a few seconds; after
              that it is instant. Running is free and unlimited — only Submit is graded.
            </p>
          )}

          {stdout && (
            <pre className="px-3 py-2 text-[11.5px] font-mono text-slate-700 whitespace-pre-wrap leading-relaxed border-b border-slate-100">{stdout}</pre>
          )}

          {error && (
            <div className="m-3 rounded-lg border border-rose-200 bg-rose-50 p-3">
              <div className="flex gap-2">
                <AlertCircle size={14} className="text-rose-500 mt-0.5 shrink-0" />
                <p className="text-xs text-rose-800 font-bold leading-relaxed">{errorHeadline}</p>
              </div>
              {error.includes('\n') && (
                <pre className="mt-2 text-[10.5px] font-mono text-rose-700/80 whitespace-pre-wrap max-h-40 overflow-auto">{error}</pre>
              )}
            </div>
          )}

          {rows && rows.length > 0 && (
            <>
              <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">result</div>
              <ResultGrid rows={rows} />
            </>
          )}
          {rows && rows.length === 0 && (
            <p className="p-4 text-xs text-slate-400 font-medium">
              Your code ran, but <code className="font-mono">result</code> is empty.
            </p>
          )}
          {!rows && !error && ready && !running && (
            <p className="px-3 py-2 text-xs text-amber-700 font-medium">
              No <code className="font-mono">result</code> was set — assign your answer to a variable called <code className="font-mono">result</code> to submit it.
            </p>
          )}
        </div>
      </div>

      {isGraded && (
        <div className="border-t border-slate-200 p-4 bg-emerald-50/50">
          <div className="flex items-center gap-2 mb-1.5">
            <CheckCircle2 size={15} className="text-emerald-600" />
            <span className="text-sm font-extrabold text-slate-900">Graded — {graded ? graded.score : wb.score}/100</span>
          </div>
          <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">{graded ? graded.feedback : wb.feedback}</p>
        </div>
      )}
    </div>
  );
}
