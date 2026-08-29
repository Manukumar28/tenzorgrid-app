import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, MessageSquare, ClipboardCheck, FolderOpen, Send, Users, CheckCircle2, Circle, Gavel,
} from 'lucide-react';
import { BentoCard, Avatar } from './ui.jsx';
import { SkillGauge, MilestoneBars } from './charts.jsx';
import { api } from '../api.js';

const PROJECT_STATUS_PILL = {
  active: 'bg-indigo-50 text-indigo-700',
  completed: 'bg-emerald-50 text-emerald-700',
  available: 'bg-blue-50 text-blue-700',
  locked: 'bg-slate-100 text-slate-500',
};

function relativeTime(iso) {
  if (!iso) return null;
  const m = Math.floor((Date.now() - Date.parse(iso)) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// What a person's projects demand — not an invented competency score for a fictional
// colleague. Rendered as bars rather than the radar the spec asked for: a person owns one
// or two projects, so only two or three of the five axes are ever non-zero, and a radar at
// that density collapses into a sliver that reads as broken rather than as sparse.
function DemandBars({ axes }) {
  const shown = axes.filter((a) => a.value > 0);
  return (
    <div className="space-y-2 mb-1">
      {shown.map((a) => (
        <div key={a.axis}>
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-[11px] font-semibold text-slate-600">{a.label}</span>
            <span className="text-[10px] text-slate-400">
              {a.projects} project{a.projects === 1 ? '' : 's'}
            </span>
          </div>
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-indigo-400"
              initial={{ width: 0 }}
              animate={{ width: `${a.value}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function MemberCard({ member, selected, index, onSelect }) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.28 }}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
      onClick={onSelect}
      className={`text-left bg-white border rounded-xl shadow-sm hover:shadow-md p-4 transition-shadow ${
        selected ? 'border-indigo-300 ring-2 ring-indigo-200' : 'border-slate-100'
      }`}
    >
      <div className="flex items-start gap-2.5 mb-2.5">
        <Avatar name={member.name} avatarUrl={member.avatarUrl} size={38} />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold truncate">{member.name}</div>
          <div className="text-[11px] text-slate-500 truncate">{member.title}</div>
        </div>
        {member.unread > 0 && (
          <span className="shrink-0 min-w-[18px] px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold text-center">
            {member.unread}
          </span>
        )}
      </div>

      {/* Availability is real: it says whether a reply can actually be had right now. */}
      <div className="flex items-center gap-1.5 mb-2.5">
        <span className={`w-2 h-2 rounded-full ${member.available ? 'bg-emerald-500' : 'bg-slate-300'}`} />
        <span className={`text-[11px] font-semibold ${member.available ? 'text-emerald-600' : 'text-slate-400'}`}>
          {member.available ? 'Available to message' : 'Daily message limit reached'}
        </span>
      </div>

      <div className="flex flex-wrap gap-1">
        {member.owned.length ? member.owned.slice(0, 2).map((p) => (
          <span key={p.key} className={`text-[10px] font-semibold rounded px-1.5 py-0.5 truncate max-w-full ${PROJECT_STATUS_PILL[p.status]}`}>
            {p.title}
          </span>
        )) : (
          <span className="text-[10px] text-slate-400">No projects assigned</span>
        )}
      </div>

      <div className="flex items-center gap-3 mt-2.5 pt-2.5 border-t border-slate-100 text-[10px] text-slate-400">
        <span>{member.messageCount} message{member.messageCount === 1 ? '' : 's'}</span>
        {member.lastContactAt && <span>· {relativeTime(member.lastContactAt)}</span>}
      </div>
    </motion.button>
  );
}

export default function Team({ state, onStateChange, onTab }) {
  const { team, skillMatrix, projects, messagesRemaining } = state;
  const [selectedKey, setSelectedKey] = useState(team[0]?.archetype || null);
  const [query, setQuery] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState('');

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return team;
    return team.filter((m) => `${m.name} ${m.title}`.toLowerCase().includes(q));
  }, [team, query]);

  useEffect(() => {
    if (visible.some((m) => m.archetype === selectedKey)) return;
    setSelectedKey(visible[0]?.archetype || null);
  }, [visible, selectedKey]);

  const selected = team.find((m) => m.archetype === selectedKey) || null;

  useEffect(() => { setNote(''); setError(''); setSent(''); }, [selectedKey]);

  // Real sends, not decorative buttons: each opens with a different intent line, then
  // goes through the same message API the Emails tab uses.
  async function send(intro) {
    if (!selected) return;
    const body = `${intro}${note.trim() ? `\n\n${note.trim()}` : ''}`;
    setBusy(true); setError(''); setSent('');
    try {
      const data = await api.sendMessage(selected.archetype, body);
      onStateChange(data.state);
      setNote('');
      setSent(`Sent to ${selected.name}.`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  // Gauges show the learner's own measured levels. A "team average" would have to invent
  // competency numbers for the characters, which do not exist.
  const gaugeAxes = useMemo(
    () => ['sql', 'python', 'dataViz'].map((a) => skillMatrix.find((s) => s.axis === a)).filter(Boolean),
    [skillMatrix],
  );

  const milestones = useMemo(() => projects.projects.map((p, i) => ({
    short: `P${i + 1}`,
    title: p.title,
    status: p.status,
    progressPct: p.status === 'completed' ? 100 : p.progressPct,
  })), [projects.projects]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-baseline gap-2.5 flex-wrap">
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Team</h1>
          <span className="text-sm font-semibold text-slate-400">[Collaboration hub]</span>
        </div>
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people and roles…"
            aria-label="Search team"
            className="w-full bg-white border border-slate-200 rounded-full pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </div>
      </div>

      <div className="flex items-center gap-x-5 gap-y-1 flex-wrap border-y border-slate-100 py-2.5 text-xs text-slate-500">
        <span>People: <b className="text-slate-800">{team.length}</b></span>
        <span className="text-slate-200">|</span>
        <span>Unread: <b className="text-slate-800">{team.reduce((s, m) => s + m.unread, 0)}</b></span>
        <span className="text-slate-200">|</span>
        <span>Messages left today: <b className="text-slate-800">{messagesRemaining}</b></span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-5 items-start">
        {/* Profile */}
        <BentoCard hover={false} className="xl:sticky xl:top-4">
          <AnimatePresence mode="wait" initial={false}>
            {selected ? (
              <motion.div
                key={selected.archetype}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div className="flex items-center gap-3.5 mb-3">
                  <Avatar name={selected.name} avatarUrl={selected.avatarUrl} size={56} className="ring-2 ring-white shadow-sm" />
                  <div className="min-w-0">
                    <h3 className="text-lg font-extrabold leading-tight">{selected.name}</h3>
                    <p className="text-sm text-slate-500">{selected.title}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 mb-4">
                  <span className={`inline-flex items-center gap-1 text-[11px] font-bold rounded-md px-2 py-1 ${
                    selected.available ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {selected.available ? <CheckCircle2 size={11} /> : <Circle size={11} />}
                    {selected.available ? 'Available' : 'Limit reached'}
                  </span>
                  {selected.grades && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold rounded-md px-2 py-1 bg-amber-50 text-amber-700">
                      <Gavel size={11} /> Grades your work
                    </span>
                  )}
                  {selected.lastContactAt && (
                    <span className="text-[11px] font-semibold rounded-md px-2 py-1 bg-slate-100 text-slate-500">
                      Last contact {relativeTime(selected.lastContactAt)}
                    </span>
                  )}
                </div>

                <h4 className="text-xs font-bold text-slate-600 mb-0.5">Skills their work demands</h4>
                <p className="text-[11px] text-slate-400 mb-1">
                  {selected.hasDemand
                    ? 'From the projects they own — not a rating of them.'
                    : 'No projects assigned to them yet.'}
                </p>
                {selected.hasDemand
                  ? <DemandBars axes={selected.skillDemand} />
                  : <div className="h-20 flex items-center justify-center text-sm text-slate-400">Nothing to show yet</div>}

                <h4 className="text-xs font-bold text-slate-600 mb-2 mt-3">Their projects</h4>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {selected.owned.length ? selected.owned.map((p) => (
                    <span key={p.key} className={`text-[11px] font-semibold rounded-md px-2 py-1 ${PROJECT_STATUS_PILL[p.status]}`}>
                      {p.title} · {p.status}
                    </span>
                  )) : <span className="text-xs text-slate-400">None assigned.</span>}
                </div>

                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder={`Add a line for ${selected.name.split(' ')[0]} (optional)…`}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-y mb-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
                {error && <div className="text-red-600 text-xs bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-2.5">{error}</div>}
                {sent && <div className="text-emerald-700 text-xs bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 mb-2.5">{sent}</div>}

                <div className="space-y-2">
                  <motion.button
                    whileTap={{ scale: 0.97 }} disabled={busy || !selected.available}
                    onClick={() => send('Could we set up a quick sync?')}
                    className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-bold rounded-lg px-3 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send size={13} /> Request sync
                  </motion.button>

                  {selected.grades ? (
                    <motion.button
                      whileTap={{ scale: 0.97 }} disabled={busy || !selected.available}
                      onClick={() => send('Could you review my latest submission when you get a moment?')}
                      className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-bold rounded-lg px-3 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ClipboardCheck size={13} /> Ask for a review
                    </motion.button>
                  ) : (
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={() => onTab('projects')}
                      className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-bold rounded-lg px-3 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                    >
                      <FolderOpen size={13} /> See their projects
                    </motion.button>
                  )}

                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => onTab('emails')}
                    className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-bold rounded-lg px-3 py-2.5 bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
                  >
                    <MessageSquare size={13} /> Open conversation
                  </motion.button>
                </div>
              </motion.div>
            ) : (
              <div className="text-center py-10">
                <Users size={28} className="text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-500 font-medium">No one matches that search.</p>
              </div>
            )}
          </AnimatePresence>
        </BentoCard>

        <div className="space-y-5">
          {/* Member grid */}
          <div>
            <div className="flex items-baseline gap-2 mb-3">
              <h2 className="text-sm font-bold text-slate-700">Your org chart</h2>
              <span className="text-xs font-semibold text-slate-400">{visible.length}</span>
            </div>
            {visible.length ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-4">
                {visible.map((m, i) => (
                  <MemberCard
                    key={m.archetype}
                    member={m}
                    index={i}
                    selected={m.archetype === selectedKey}
                    onSelect={() => setSelectedKey(m.archetype)}
                  />
                ))}
              </div>
            ) : (
              <BentoCard hover={false} className="text-center py-8">
                <p className="text-sm text-slate-500 font-medium">No one matches that search.</p>
              </BentoCard>
            )}
            <p className="text-[11px] text-slate-400 mt-2.5">
              This is the whole cast for the individual-contributor track. Direct reports appear here when the manager track ships.
            </p>
          </div>

          {/* Analytics */}
          <BentoCard hover={false}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-base font-bold mb-0.5">Your skill levels</h3>
                <p className="text-xs text-slate-400 mb-4">Measured from your graded work, not a team average</p>
                <div className="flex items-end justify-around gap-2">
                  {gaugeAxes.map((a) => (
                    <SkillGauge key={a.axis} label={a.label} value={a.value} hasData={a.hasData} />
                  ))}
                </div>
                {gaugeAxes.every((a) => !a.hasData) && (
                  <p className="text-[11px] text-slate-400 text-center mt-3">
                    Complete a task to populate these.
                  </p>
                )}
              </div>

              <div>
                <h3 className="text-base font-bold mb-0.5">Project progress</h3>
                <p className="text-xs text-slate-400 mb-2">Across the track's projects</p>
                <MilestoneBars data={milestones} />
              </div>
            </div>
          </BentoCard>
        </div>
      </div>
    </div>
  );
}
