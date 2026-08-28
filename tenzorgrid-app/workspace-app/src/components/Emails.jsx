import React, { useEffect, useState } from 'react';
import { BentoCard } from './ui.jsx';
import { api } from '../api.js';

function threadKey(m) {
  return (m.subject || '').replace(/^Re:\s*/i, '').trim() || m.thread_archetype;
}

const SENDER_LABEL = { line_manager: 'Asha Rao · Line Manager', people_partner: 'Neha Kulkarni · People Partner', stakeholder: 'Vikram Nair · Business Stakeholder', learner: 'You' };

export default function Emails({ state, onStateChange }) {
  const emails = state.messages.filter((m) => state.emailArchetypes.includes(m.thread_archetype));
  const threadsMap = new Map();
  for (const m of emails) {
    const key = threadKey(m);
    if (!threadsMap.has(key)) threadsMap.set(key, []);
    threadsMap.get(key).push(m);
  }
  const threads = [...threadsMap.entries()]
    .map(([key, msgs]) => ({ key, msgs, last: msgs[msgs.length - 1] }))
    .sort((a, b) => new Date(b.last.created_at) - new Date(a.last.created_at));

  const [selectedKey, setSelectedKey] = useState(null);
  const [reply, setReply] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!threads.length) return;
    if (selectedKey && threadsMap.has(selectedKey)) return;
    setSelectedKey(threads[0].key);
  }, [threads.map((t) => t.key).join(',')]);

  const activeThread = threads.find((t) => t.key === selectedKey);

  async function send() {
    if (!reply.trim() || !activeThread) return;
    setBusy(true);
    setError('');
    try {
      const archetype = activeThread.msgs.find((m) => m.sender_archetype !== 'learner')?.sender_archetype || activeThread.msgs[0].thread_archetype;
      const subject = activeThread.last.subject || '';
      const data = await api.sendMessage(archetype, reply, subject);
      onStateChange(data.state);
      setReply('');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-5 items-start">
      <BentoCard index={0} hover={false} className="p-3.5 space-y-2">
        {threads.map((t) => (
          <button
            key={t.key}
            onClick={() => setSelectedKey(t.key)}
            className={`w-full text-left border rounded-lg px-3.5 py-3 ${t.key === selectedKey ? 'border-indigo-300 bg-indigo-50' : 'border-gray-100 hover:border-gray-200'}`}
          >
            <div className="text-sm font-bold">{t.last.subject || t.key}</div>
            <div className="text-xs text-gray-500 mt-0.5">{SENDER_LABEL[t.msgs.find((m) => m.sender_archetype !== 'learner')?.sender_archetype] || t.key}</div>
            <div className="text-xs text-gray-400">{new Date(t.last.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric' })}</div>
          </button>
        ))}
        {!threads.length && <p className="text-sm text-gray-400">No emails yet.</p>}
      </BentoCard>

      <BentoCard index={1} hover={false}>
        {!activeThread ? (
          <p className="text-sm text-gray-400">Select a thread.</p>
        ) : (
          <>
            <h3 className="text-base font-bold mb-3.5">{activeThread.last.subject || activeThread.key}</h3>
            <div className="divide-y divide-gray-100">
              {activeThread.msgs.map((m) => (
                <div key={m.id} className="py-3.5">
                  <div className="text-sm font-bold">{SENDER_LABEL[m.sender_archetype] || m.sender_name}</div>
                  <div className="text-xs text-gray-400 mb-2">{new Date(m.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                  <div className="text-sm text-gray-600 whitespace-pre-wrap">{m.body}</div>
                </div>
              ))}
            </div>
            <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={3} placeholder="Write a reply…" className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm mt-4 mb-3 resize-y" />
            {error && <div className="text-red-500 text-xs mb-2">{error}</div>}
            <button onClick={send} disabled={busy} className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg px-4 py-2 disabled:opacity-60">
              {busy ? 'Sending…' : 'Send reply'}
            </button>
          </>
        )}
      </BentoCard>
    </div>
  );
}
