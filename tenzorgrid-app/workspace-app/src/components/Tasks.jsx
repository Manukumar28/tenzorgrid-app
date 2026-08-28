import React, { useEffect, useState } from 'react';
import { BentoCard, Pill } from './ui.jsx';
import { api } from '../api.js';

export default function Tasks({ state, onStateChange }) {
  const { tasks } = state;
  const [selectedId, setSelectedId] = useState(null);
  const [sql, setSql] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!tasks.length) return;
    if (selectedId && tasks.some((t) => t.id === selectedId)) return;
    const open = tasks.find((t) => t.status === 'assigned');
    setSelectedId((open || tasks[tasks.length - 1]).id);
  }, [tasks, selectedId]);

  const task = tasks.find((t) => t.id === selectedId);

  async function submit() {
    setBusy(true);
    setError('');
    try {
      const data = await api.submitTask(task.id, sql);
      onStateChange(data.state);
      setSql('');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5 items-start">
      <BentoCard index={0} hover={false} className="space-y-2">
        {tasks.map((t) => (
          <button
            key={t.id}
            onClick={() => setSelectedId(t.id)}
            className={`w-full text-left border rounded-lg px-3.5 py-3 transition-colors ${t.id === selectedId ? 'border-indigo-300 bg-indigo-50' : 'border-gray-100 hover:border-gray-200'}`}
          >
            <div className="text-xs font-bold">{t.title}</div>
            <Pill className={`mt-1.5 ${t.status === 'graded' ? 'bg-teal-50 text-teal-600' : 'bg-indigo-50 text-indigo-600'}`}>
              {t.status === 'graded' ? 'Graded' : 'Assigned'}
            </Pill>
            {t.est_hours ? <div className="text-[10.5px] text-gray-300 mt-1">{t.est_hours}h estimated</div> : null}
          </button>
        ))}
        {!tasks.length && <p className="text-sm text-gray-300">No task assigned yet.</p>}
      </BentoCard>

      <BentoCard index={1} hover={false}>
        {!task ? (
          <p className="text-sm text-gray-300">Select a task.</p>
        ) : task.status === 'graded' ? (
          <>
            <p className="text-sm text-gray-500 mb-4"><b className="text-gray-800">{task.title}</b><br />{task.brief}</p>
            <div className="bg-teal-50 rounded-lg px-4 py-3.5">
              <div className="text-teal-700 font-bold text-sm mb-1">Score: {task.score}/100</div>
              <div className="text-[13px] text-teal-900 whitespace-pre-wrap">{task.feedback}</div>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-1"><b className="text-gray-800">{task.title}</b><br />{task.brief}</p>
            <p className="text-[11.5px] text-gray-300 mb-3">This task's tool: SQL editor. Write your query below and submit.</p>
            <textarea
              value={sql}
              onChange={(e) => setSql(e.target.value)}
              rows={6}
              placeholder="SELECT ..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 font-mono text-[13px] mb-3 resize-y"
            />
            {error && <div className="text-red-500 text-xs mb-3">{error}</div>}
            <button onClick={submit} disabled={busy} className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg px-4 py-2 disabled:opacity-60">
              {busy ? 'Submitting…' : 'Submit'}
            </button>
          </>
        )}
      </BentoCard>
    </div>
  );
}
