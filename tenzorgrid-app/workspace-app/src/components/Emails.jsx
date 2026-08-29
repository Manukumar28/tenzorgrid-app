import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Search, Star, Inbox, Pencil, Reply, ChevronDown, Plus, X, Mail, MailOpen, CheckCheck,
} from 'lucide-react';
import { BentoCard, Avatar } from './ui.jsx';
import { api } from '../api.js';

// Pastel category badges, one per real sender archetype. `tone` comes from the backend,
// which only ever emits a category that has actual mail behind it.
const TONE = {
  amber: 'bg-amber-100 text-amber-800',
  emerald: 'bg-emerald-100 text-emerald-800',
  purple: 'bg-purple-100 text-purple-800',
  gray: 'bg-slate-100 text-slate-700',
};

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'unread', label: 'Unread first' },
];

const DRAFT_PREFIX = 'tg-draft:';

// Drafts live in this browser only. That is genuinely what an unsent draft is here —
// nothing has been sent, so there is no server-side record to show.
function loadDrafts() {
  const out = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(DRAFT_PREFIX)) {
        const v = localStorage.getItem(k);
        if (v && v.trim()) out[k.slice(DRAFT_PREFIX.length)] = v;
      }
    }
  } catch { /* storage unavailable — drafts simply don't persist */ }
  return out;
}
function saveDraft(key, text) {
  try {
    if (text && text.trim()) localStorage.setItem(DRAFT_PREFIX + key, text);
    else localStorage.removeItem(DRAFT_PREFIX + key);
  } catch { /* ignore */ }
}

function relativeTime(iso) {
  const diff = Date.now() - Date.parse(iso);
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function FilterSelect({ label, value, onChange, options }) {
  const active = value !== '' && value !== 'newest';
  return (
    <div className="relative inline-flex items-center">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className={`appearance-none text-xs font-semibold rounded-full pl-3.5 pr-8 py-1.5 cursor-pointer border transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-200 ${
          active ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
        }`}
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown size={13} className={`absolute right-2.5 pointer-events-none ${active ? 'text-indigo-500' : 'text-slate-400'}`} />
    </div>
  );
}

function Composer({ roster, onClose, onSent }) {
  const [to, setTo] = useState(roster[0]?.archetype || '');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState(() => loadDrafts().compose || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { saveDraft('compose', body); }, [body]);

  async function send() {
    if (!body.trim() || !to) return;
    setBusy(true); setError('');
    try {
      const data = await api.sendMessage(to, body, subject.trim() || undefined);
      saveDraft('compose', '');
      onSent(data.state);
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-slate-900/30 p-4"
      onClick={onClose}
    >
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold">New message</h3>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
        </div>

        <label className="block text-xs font-bold text-slate-500 mb-1">To</label>
        <select
          value={to} onChange={(e) => setTo(e.target.value)}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-200"
        >
          {roster.map((p) => <option key={p.archetype} value={p.archetype}>{p.name} — {p.title}</option>)}
        </select>

        <label className="block text-xs font-bold text-slate-500 mb-1">Subject</label>
        <input
          value={subject} onChange={(e) => setSubject(e.target.value)}
          placeholder="Optional"
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-200"
        />

        <textarea
          value={body} onChange={(e) => setBody(e.target.value)} rows={6}
          placeholder="Write your message…"
          className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm resize-y mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-200"
        />
        {error && <div className="text-red-600 text-xs bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-3">{error}</div>}
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] text-slate-400">Saved as a draft while you type</span>
          <motion.button
            whileTap={{ scale: 0.97 }} onClick={send} disabled={busy || !body.trim()}
            aria-label="Send message"
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? 'Sending…' : 'Send'}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

export default function Emails({ state, onStateChange }) {
  const { inbox, roster } = state;
  const [tab, setTab] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [query, setQuery] = useState('');
  const [selectedKey, setSelectedKey] = useState(null);
  const [composing, setComposing] = useState(false);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [drafts, setDrafts] = useState(() => loadDrafts());
  const markedRef = useRef(new Set());

  const personByArchetype = useMemo(
    () => Object.fromEntries(roster.map((p) => [p.archetype, p])),
    [roster],
  );

  const draftThreadKeys = Object.keys(drafts).filter((k) => k !== 'compose');

  const tabs = useMemo(() => ([
    { key: 'all', label: 'All mail', icon: Inbox, count: inbox.counts.total },
    { key: 'unread', label: 'Unread', icon: Mail, count: inbox.counts.unread },
    { key: 'starred', label: 'Starred', icon: Star, count: inbox.counts.starred },
    { key: 'drafts', label: 'Drafts', icon: Pencil, count: draftThreadKeys.length + (drafts.compose ? 1 : 0) },
    ...inbox.categories.map((c) => ({ key: c.key, label: c.label, icon: Inbox, count: c.total })),
  ]), [inbox, drafts, draftThreadKeys.length]);

  const visible = useMemo(() => {
    let list = inbox.threads;
    if (tab === 'unread') list = list.filter((t) => t.unread > 0);
    else if (tab === 'starred') list = list.filter((t) => t.starred);
    else if (tab === 'drafts') list = list.filter((t) => drafts[t.key]);
    else if (tab !== 'all') list = list.filter((t) => t.category === tab);

    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((t) =>
        t.subject.toLowerCase().includes(q) ||
        t.snippet.toLowerCase().includes(q) ||
        t.senderName.toLowerCase().includes(q) ||
        t.messages.some((m) => (m.body || '').toLowerCase().includes(q)));
    }

    const sorted = [...list];
    if (sortBy === 'oldest') sorted.sort((a, b) => a.lastAt.localeCompare(b.lastAt));
    else if (sortBy === 'unread') sorted.sort((a, b) => (b.unread > 0) - (a.unread > 0) || b.lastAt.localeCompare(a.lastAt));
    else sorted.sort((a, b) => b.lastAt.localeCompare(a.lastAt));
    return sorted;
  }, [inbox.threads, tab, query, sortBy, drafts]);

  const selected = inbox.threads.find((t) => t.key === selectedKey) || null;

  useEffect(() => {
    if (selected) return;
    setSelectedKey(visible.length ? visible[0].key : null);
  }, [visible, selected]);

  // Opening a thread marks it read, once. The guard stops the state refresh that follows
  // from re-triggering the same call in a loop.
  useEffect(() => {
    if (!selected || !selected.unread) return;
    if (markedRef.current.has(selected.key)) return;
    markedRef.current.add(selected.key);
    api.markEmails(selected.ids, { read: true })
      .then((d) => onStateChange(d.state))
      .catch(() => markedRef.current.delete(selected.key));
  }, [selected, onStateChange]);

  useEffect(() => { setReply(drafts[selectedKey] || ''); setError(''); }, [selectedKey]);

  async function toggleStar(thread, e) {
    e.stopPropagation();
    try {
      const data = await api.markEmails(thread.ids, { starred: !thread.starred });
      onStateChange(data.state);
    } catch { /* leave the UI as-is if the write fails */ }
  }

  async function markUnread() {
    if (!selected) return;
    markedRef.current.delete(selected.key);
    const data = await api.markEmails(selected.ids, { read: false });
    onStateChange(data.state);
  }

  function onReplyChange(v) {
    setReply(v);
    saveDraft(selectedKey, v);
    setDrafts(loadDrafts());
  }

  async function sendReply() {
    if (!reply.trim() || !selected) return;
    setBusy(true); setError('');
    try {
      const data = await api.sendMessage(selected.archetype, reply, selected.subject);
      onStateChange(data.state);
      saveDraft(selectedKey, '');
      setDrafts(loadDrafts());
      setReply('');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Title + search */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-baseline gap-2.5 flex-wrap">
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Emails</h1>
          <span className="text-sm font-semibold text-slate-400">[Unified communications]</span>
        </div>
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search mail, people, keywords…"
            aria-label="Search mail"
            className="w-full bg-white border border-slate-200 rounded-full pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </div>
      </div>

      {/* Stats + sort */}
      <div className="flex items-center justify-between gap-4 flex-wrap border-y border-slate-100 py-2.5">
        <div className="flex items-center gap-x-5 gap-y-1 flex-wrap text-xs text-slate-500">
          <span>Inbox: <b className="text-slate-800">{inbox.counts.total}</b></span>
          <span className="text-slate-200">|</span>
          <span>Unread: <b className="text-slate-800">{inbox.counts.unread}</b></span>
          <span className="text-slate-200">|</span>
          <span>Starred: <b className="text-slate-800">{inbox.counts.starred}</b></span>
        </div>
        <div className="flex items-center gap-2">
          <FilterSelect label="Sort" value={sortBy} onChange={setSortBy} options={SORT_OPTIONS} />
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setComposing(true)}
            className="inline-flex items-center gap-1.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 text-white text-xs font-bold rounded-full px-4 py-2 shadow-sm"
          >
            <Plus size={14} /> Compose
          </motion.button>
        </div>
      </div>

      {/* Category tabs — only categories that actually have mail */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-100 -mb-px">
        {tabs.map((t) => {
          const Icon = t.icon;
          const on = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold whitespace-nowrap border-b-2 transition-colors ${
                on ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon size={14} /> {t.label}
              {t.count > 0 && (
                <span className={`text-[10px] rounded-full px-1.5 py-0.5 ${on ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Split pane */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-5 items-start">
        <BentoCard hover={false} className="p-0 overflow-hidden">
          {visible.length ? (
            <div className="divide-y divide-slate-100">
              {visible.map((t, i) => (
                <motion.button
                  key={t.key}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.03, 0.3), duration: 0.25 }}
                  onClick={() => setSelectedKey(t.key)}
                  className={`w-full text-left px-4 py-3 flex items-start gap-2.5 transition-colors ${
                    t.key === selectedKey ? 'bg-indigo-50/70' : 'hover:bg-slate-50/80'
                  }`}
                >
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label={t.starred ? 'Unstar' : 'Star'}
                    onClick={(e) => toggleStar(t, e)}
                    onKeyDown={(e) => { if (e.key === 'Enter') toggleStar(t, e); }}
                    className="mt-0.5 shrink-0"
                  >
                    <Star
                      size={15}
                      className={`transition-colors ${t.starred ? 'text-amber-400 fill-amber-400' : 'text-slate-300 hover:text-slate-400'}`}
                    />
                  </span>

                  <Avatar name={t.senderName} avatarUrl={personByArchetype[t.archetype]?.avatarUrl} size={30} className="mt-0.5" />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className={`text-[10px] font-bold rounded-md px-1.5 py-0.5 ${TONE[t.tone] || TONE.gray}`}>
                        {t.categoryLabel}
                      </span>
                      {t.unread > 0 && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" aria-label="Unread" />}
                      {drafts[t.key] && <span className="text-[10px] font-bold text-amber-600">Draft</span>}
                    </div>
                    <div className={`text-sm truncate ${t.unread > 0 ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'}`}>
                      {t.subject}
                    </div>
                    <div className="text-xs text-slate-400 truncate">{t.snippet}</div>
                  </div>

                  <span className="text-[11px] text-slate-400 shrink-0 mt-0.5">{relativeTime(t.lastAt)}</span>
                </motion.button>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 px-6">
              <Inbox size={28} className="text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500 font-medium">
                {query ? 'Nothing matches that search.' : tab === 'drafts' ? 'No drafts.' : 'Nothing here yet.'}
              </p>
            </div>
          )}
        </BentoCard>

        {/* Reading pane */}
        <BentoCard hover={false} className="lg:sticky lg:top-4">
          {!selected ? (
            <div className="text-center py-12">
              <MailOpen size={28} className="text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500 font-medium">Select a message to read it.</p>
            </div>
          ) : (
            <>
              <div className="flex items-start gap-3 mb-4">
                <Avatar name={selected.senderName} avatarUrl={personByArchetype[selected.archetype]?.avatarUrl} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`text-[10px] font-bold rounded-md px-1.5 py-0.5 ${TONE[selected.tone] || TONE.gray}`}>
                      {selected.categoryLabel}
                    </span>
                    <span className="text-xs font-semibold text-slate-600">{selected.senderName}</span>
                  </div>
                  <h3 className="text-base font-bold leading-snug">{selected.subject}</h3>
                </div>
                <button
                  onClick={() => toggleStar(selected, { stopPropagation() {} })}
                  aria-label={selected.starred ? 'Unstar' : 'Star'}
                  className="shrink-0"
                >
                  <Star size={17} className={selected.starred ? 'text-amber-400 fill-amber-400' : 'text-slate-300 hover:text-slate-400'} />
                </button>
              </div>

              <div className="space-y-3.5 max-h-[420px] overflow-y-auto pr-1 mb-4">
                {selected.messages.map((m) => {
                  const mine = m.senderArchetype === 'learner';
                  return (
                    <div key={m.id} className={`rounded-lg px-3.5 py-3 ${mine ? 'bg-indigo-50/70 ml-6' : 'bg-slate-50 mr-6'}`}>
                      <div className="flex items-baseline justify-between gap-3 mb-1">
                        <span className="text-xs font-bold text-slate-700">{mine ? 'You' : m.senderName}</span>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {new Date(m.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">{m.body}</p>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500">
                  <Reply size={14} /> Reply to {selected.senderName}
                </span>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={markUnread}
                  className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg px-2.5 py-1.5"
                >
                  <CheckCheck size={13} /> Mark unread
                </motion.button>
              </div>

              <textarea
                value={reply}
                onChange={(e) => onReplyChange(e.target.value)}
                rows={3}
                placeholder="Write a reply…"
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm resize-y mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
              {error && <div className="text-red-600 text-xs bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-3">{error}</div>}
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={sendReply}
                disabled={busy || !reply.trim()}
                aria-label="Send reply"
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {busy ? 'Sending…' : 'Send reply'}
              </motion.button>
            </>
          )}
        </BentoCard>
      </div>

      {composing && (
        <Composer roster={roster} onClose={() => setComposing(false)} onSent={onStateChange} />
      )}
    </div>
  );
}
