import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Minus, Send, Smile, MessageSquare, Users, Handshake } from 'lucide-react';
import { Avatar } from './ui.jsx';
import { api } from '../api.js';

// The chat dock.
//
// Gmail's model, because it is the one people already know: a persistent bar at the
// bottom-right, a search to find a colleague, and each conversation a small window you
// can minimise and leave running while you work. That last part is the point — you are
// meant to be asking someone a question WHILE you are stuck on the query, not leaving
// the workbench to go to a chat page.
//
// Email stays a threaded inbox. Chat is where the quick back-and-forth happens. Keeping
// them separate is what stops the inbox turning into a chat log.

const EMOJI = [
  '👍', '🙏', '👌', '🎉', '🔥', '💪', '👀', '🤔',
  '😄', '😅', '😬', '🙂', '😊', '😍', '🤝', '✅',
  '❌', '⚠️', '📊', '📈', '📉', '🗂️', '⏰', '☕',
];

function EmojiPicker({ onPick, onClose }) {
  return (
    <div className="absolute bottom-full right-0 mb-2 w-56 rounded-xl border border-slate-200 bg-white shadow-lg p-2 z-10">
      <div className="grid grid-cols-8 gap-0.5">
        {EMOJI.map((e) => (
          <button
            key={e}
            onClick={() => { onPick(e); onClose(); }}
            aria-label={`Insert ${e}`}
            className="w-6 h-6 text-base leading-none rounded hover:bg-slate-100"
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}

function ChatWindow({ person, messages, onClose, onMinimise, onSend, enterToSend, minimised, index, review }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [emoji, setEmoji] = useState(false);
  const [error, setError] = useState('');
  const scroller = useRef(null);
  const box = useRef(null);

  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
  }, [messages.length, minimised]);

  async function send() {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true); setError('');
    try {
      await onSend(body);
      setText('');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  // Enter-to-send is a preference because both habits are real: some people send on
  // Enter, some expect a newline. Whichever is off is still reachable with Shift.
  function onKeyDown(e) {
    if (e.key !== 'Enter') return;
    const wantsSend = enterToSend ? !e.shiftKey : (e.shiftKey || e.metaKey || e.ctrlKey);
    if (wantsSend) { e.preventDefault(); send(); }
  }

  const unreadFromThem = messages.filter((m) => m.from !== 'learner').length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      style={{ right: 16 + index * 420 }}
      className="fixed bottom-0 z-40 w-[404px] max-w-[calc(100vw-2rem)] rounded-t-xl border border-slate-200 border-b-0 bg-white shadow-2xl overflow-hidden"
    >
      <div
        onClick={onMinimise}
        role="button"
        aria-label={`${minimised ? 'Open' : 'Minimise'} chat with ${person.name}`}
        className="flex items-center gap-2 px-3 py-2 bg-slate-900 text-white cursor-pointer select-none"
      >
        <Avatar name={person.name} avatarUrl={person.avatarUrl} size={24} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold leading-tight truncate">{person.name}</p>
          <p className="text-[12px] text-slate-500 truncate">
            {review ? `Signing off "${review.title}"` : person.title}
          </p>
        </div>
        {person.friend && (
          <span title="You know each other" className="shrink-0"><Handshake size={13} className="text-teal-300" /></span>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onMinimise(); }}
          aria-label={`Minimise chat with ${person.name}`}
          className="p-1 rounded hover:bg-white/15 shrink-0"
        >
          <Minus size={14} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          aria-label={`Close chat with ${person.name}`}
          className="p-1 rounded hover:bg-white/15 shrink-0"
        >
          <X size={14} />
        </button>
      </div>

      {!minimised && (
        <>
          {review && (
            <div className="flex items-center gap-2 px-3.5 py-2 bg-amber-50 border-b border-amber-200">
              <span className="text-[12px] font-extrabold text-amber-900 uppercase tracking-wide truncate">
                Sign-off · {review.title}
              </span>
              <span className="ml-auto text-[12px] font-bold text-amber-700 shrink-0">
                {review.roundsLeft} {review.roundsLeft === 1 ? 'attempt' : 'attempts'} left
              </span>
            </div>
          )}
          <div ref={scroller} className="h-[26rem] max-h-[60vh] overflow-y-auto px-3.5 py-3.5 space-y-2.5 bg-slate-50">
            {messages.length === 0 && (
              <div className="text-center pt-6">
                <p className="text-xs text-slate-500 leading-relaxed px-3">
                  {person.about}
                </p>
                {person.helpsWith && person.helpsWith.length > 0 && (
                  <p className="text-[12px] text-slate-500 mt-2 px-3">
                    Ask about: {person.helpsWith.join(', ')}
                  </p>
                )}
                {!person.core && !person.friend && person.messagesToFriend > 0 && (
                  <p className="text-[12px] text-indigo-600 font-semibold mt-2.5">
                    {person.messagesToFriend} more {person.messagesToFriend === 1 ? 'message' : 'messages'} and they'll know you well enough to really help
                  </p>
                )}
              </div>
            )}
            {messages.map((m, i) => {
              const mine = m.from === 'learner';
              return (
                <div key={i} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[14px] leading-relaxed whitespace-pre-line ${
                    mine ? 'bg-indigo-600 text-white rounded-br-sm' : 'bg-white border border-slate-200 text-slate-800 rounded-bl-sm'}`}>
                    {m.body}
                  </div>
                </div>
              );
            })}
            {busy && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-3 py-2">
                  <span className="text-[12px] text-slate-500">{person.name.split(' ')[0]} is typing…</span>
                </div>
              </div>
            )}
          </div>

          {error && <p className="px-3 py-1.5 text-[12px] text-rose-700 bg-rose-50 font-semibold">{error}</p>}

          <div className="relative border-t border-slate-200 p-2">
            {emoji && <EmojiPicker onPick={(e) => setText((t) => t + e)} onClose={() => setEmoji(false)} />}
            {review && (
              <p className="text-[12px] text-slate-500 mb-1.5 px-0.5">
                Say <em>why</em>, not what the code does. She's checking you understood the choice.
              </p>
            )}
            <div className="flex items-end gap-1.5">
              <textarea
                ref={box}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={onKeyDown}
                rows={2}
                aria-label={`Message ${person.name}`}
                placeholder={review
                  ? 'Answer her — say why you made that choice…'
                  : (enterToSend ? 'Message… (Enter to send)' : 'Message… (Shift+Enter to send)')}
                className="flex-1 resize-none max-h-32 rounded-lg border border-slate-200 px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
              <button
                onClick={() => setEmoji((v) => !v)}
                aria-label="Add an emoji"
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 shrink-0"
              >
                <Smile size={16} />
              </button>
              <button
                onClick={send}
                disabled={busy || !text.trim()}
                aria-label={`Send to ${person.name}`}
                className="p-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-40 shrink-0"
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        </>
      )}
    </motion.div>
  );
}

export default function ChatDock({ state, onStateChange, enterToSend, openWith }) {
  const [open, setOpen] = useState([]);        // archetypes with a window
  const [minimised, setMinimised] = useState([]);
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState('');

  const roster = state.team || [];
  const messages = state.messages || [];

  // A task waiting on the manager's sign-off. The conversation belongs here rather than
  // in a panel inside the workbench: a manager questioning your work is a conversation,
  // and it should happen where every other conversation with her already does.
  const review = useMemo(() => {
    const rows = (state.taskBoard && state.taskBoard.rows) || [];
    const t = rows.find((r) => r.reviewState === 'pending');
    return t ? { taskId: t.id, title: t.title, roundsLeft: t.reviewRoundsLeft ?? 2 } : null;
  }, [state.taskBoard]);

  // Open her window by itself when she asks something — being questioned should not be
  // something you have to go looking for.
  useEffect(() => {
    if (!review) return;
    setOpen((o) => (o.includes('line_manager') ? o : [...o, 'line_manager'].slice(-3)));
    setMinimised((m) => m.filter((a) => a !== 'line_manager'));
  }, [review && review.taskId]);

  // Another tab asking for a conversation — the sign-off pointer on the Tasks board.
  useEffect(() => {
    if (!openWith) return;
    setOpen((o) => (o.includes(openWith.archetype) ? o : [...o, openWith.archetype].slice(-3)));
    setMinimised((m) => m.filter((a) => a !== openWith.archetype));
  }, [openWith && openWith.at]);

  // One conversation per person, in the order it happened.
  const threads = useMemo(() => {
    const by = {};
    for (const m of messages) {
      const who = m.thread_archetype || m.sender_archetype;
      if (!who) continue;
      (by[who] = by[who] || []).push({
        from: m.sender_archetype === 'learner' ? 'learner' : who,
        body: m.body,
        at: m.created_at,
      });
    }
    return by;
  }, [messages]);

  const found = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = roster.filter((p) => !q
      || p.name.toLowerCase().includes(q)
      || p.title.toLowerCase().includes(q)
      || (p.helpsWith || []).some((h) => h.toLowerCase().includes(q)));
    // People you already know come first — that is who you actually want to reach.
    return [...list].sort((a, b) => (b.friend ? 1 : 0) - (a.friend ? 1 : 0));
  }, [roster, query]);

  function openChat(archetype) {
    setPicking(false); setQuery('');
    setMinimised((m) => m.filter((a) => a !== archetype));
    setOpen((o) => (o.includes(archetype) ? o : [...o, archetype].slice(-3)));
  }

  async function send(archetype, body) {
    // While a sign-off is open, what you type to your manager IS your answer to it —
    // there is no separate box to find.
    if (archetype === 'line_manager' && review) {
      const d = await api.answerReview(review.taskId, body);
      if (d.state) onStateChange(d.state);
      return;
    }
    const d = await api.sendMessage(archetype, body);
    if (d.state) onStateChange(d.state);
  }

  return (
    <>
      {open.map((archetype, i) => {
        const person = roster.find((p) => p.archetype === archetype);
        if (!person) return null;
        return (
          <ChatWindow
            key={archetype}
            index={i}
            person={person}
            messages={threads[archetype] || []}
            minimised={minimised.includes(archetype)}
            enterToSend={enterToSend}
            review={archetype === 'line_manager' ? review : null}
            onClose={() => setOpen((o) => o.filter((a) => a !== archetype))}
            onMinimise={() => setMinimised((m) => m.includes(archetype) ? m.filter((a) => a !== archetype) : [...m, archetype])}
            onSend={(body) => send(archetype, body)}
          />
        );
      })}

      {/* The dock itself — always reachable, never in the way of the workbench. */}
      <div className="fixed bottom-0 right-4 z-30" style={{ right: 16 + open.length * 420 }}>
        <AnimatePresence>
          {picking && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              className="absolute bottom-full right-0 mb-2 w-96 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden"
            >
              <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-200">
                <Search size={14} className="text-slate-500 shrink-0" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label="Search your colleagues"
                  placeholder="Search people or what they help with…"
                  className="flex-1 text-xs focus:outline-none"
                />
              </div>
              <div className="max-h-[26rem] overflow-y-auto">
                {found.length === 0 && (
                  <p className="px-3 py-4 text-xs text-slate-500 text-center">Nobody here matches that.</p>
                )}
                {found.map((p) => (
                  <button
                    key={p.archetype}
                    onClick={() => openChat(p.archetype)}
                    aria-label={`Chat to ${p.name}`}
                    className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 text-left"
                  >
                    <Avatar name={p.name} avatarUrl={p.avatarUrl} size={30} className="shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-900 truncate">
                        {p.name}
                        {p.friend && <Handshake size={11} className="inline ml-1.5 text-teal-500 -mt-0.5" />}
                      </p>
                      <p className="text-[12px] text-slate-500 truncate">{p.title}</p>
                    </div>
                    {p.unread > 0 && (
                      <span className="shrink-0 min-w-[18px] px-1 rounded-full bg-red-600 text-white text-[12px] font-bold text-center">
                        {p.unread}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={() => setPicking((v) => !v)}
          aria-label="Open team chat"
          className="flex items-center gap-2 px-4 py-2.5 rounded-t-xl bg-slate-900 text-white text-xs font-bold shadow-2xl hover:bg-slate-800"
        >
          <MessageSquare size={14} />
          Chat
          <Users size={13} className="opacity-60" />
        </button>
      </div>
    </>
  );
}
