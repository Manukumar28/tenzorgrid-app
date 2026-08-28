import React, { useState } from 'react';
import { BentoCard, Avatar } from './ui.jsx';
import { api } from '../api.js';

const SENDER_LABEL = { line_manager: 'Asha Rao · Line Manager', people_partner: 'Neha Kulkarni · People Partner', stakeholder: 'Vikram Nair · Business Stakeholder', learner: 'You' };

export default function Team({ state, onStateChange }) {
  const [selected, setSelected] = useState(null);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const person = state.roster.find((p) => p.archetype === selected);
  const isEmailOnly = selected && state.emailArchetypes.includes(selected);
  const thread = selected ? state.messages.filter((m) => m.thread_archetype === selected) : [];

  async function send() {
    if (!msg.trim() || !selected) return;
    setBusy(true);
    setError('');
    try {
      const data = await api.sendMessage(selected, msg);
      onStateChange(data.state);
      setMsg('');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <BentoCard index={0} hover={false}>
        <h3 className="text-sm font-bold mb-3">Your people</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
          {state.roster.map((p) => (
            <button
              key={p.archetype}
              onClick={() => setSelected(p.archetype)}
              className={`text-left border rounded-lg p-3.5 ${p.archetype === selected ? 'border-indigo-300 bg-indigo-50' : 'border-gray-100 hover:border-gray-200'}`}
            >
              <Avatar name={p.name} avatarUrl={p.avatarUrl} size={34} className="mb-2.5" />
              <div className="text-xs font-bold">{p.name}</div>
              <div className="text-[10.5px] text-gray-400">{p.title}</div>
            </button>
          ))}
        </div>
      </BentoCard>

      {person && (
        <BentoCard index={1} hover={false}>
          {isEmailOnly ? (
            <>
              <div className="flex items-center gap-3 mb-1">
                <Avatar name={person.name} avatarUrl={person.avatarUrl} size={38} />
                <h3 className="text-sm font-bold">{person.name}</h3>
              </div>
              <p className="text-sm text-gray-400">External contacts like {person.name} are reached through Emails, not Team Chat.</p>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-3">
                <Avatar name={person.name} avatarUrl={person.avatarUrl} size={38} />
                <h3 className="text-sm font-bold">{person.name} · {person.title}</h3>
              </div>
              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1 mb-3">
                {thread.length ? thread.map((m) => (
                  <div key={m.id} className={`rounded-lg px-3.5 py-2.5 text-[13px] ${m.sender_archetype === 'learner' ? 'bg-indigo-50 ml-6' : 'bg-gray-50'}`}>
                    <div className="text-[10.5px] font-bold text-gray-400 mb-0.5">{SENDER_LABEL[m.sender_archetype] || m.sender_name}</div>
                    {m.body}
                  </div>
                )) : <p className="text-sm text-gray-300">No messages yet — say hello.</p>}
              </div>
              <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={2} placeholder={`Message ${person.name}…`} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm mb-2 resize-y" />
              {error && <div className="text-red-500 text-xs mb-2">{error}</div>}
              <button onClick={send} disabled={busy} className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg px-4 py-2 disabled:opacity-60">
                {busy ? 'Sending…' : 'Send'}
              </button>
            </>
          )}
        </BentoCard>
      )}
    </div>
  );
}
