import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Clock3, CheckCircle2, Circle, TriangleAlert, Send, Users, CalendarDays } from 'lucide-react';
import { BentoCard, StatTiles, Avatar } from './ui.jsx';
import { api } from '../api.js';

// One day of the learner's own week. Open days get a form; days that have not arrived are
// shown but shut, so the shape of the week is visible from Monday rather than appearing
// a row at a time.
function MyDay({ day, chargeCodes, onSubmit }) {
  const [hours, setHours] = useState(day.hours == null ? '' : String(day.hours));
  const [chargedTo, setChargedTo] = useState(day.chargedTo || chargeCodes[0]);
  const [note, setNote] = useState(day.note || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);

  const shut = !day.open;
  const filed = day.submitted;

  async function send() {
    setBusy(true); setError('');
    try {
      await onSubmit(day.day, { hours: Number(hours), chargedTo, note });
      setEditing(false);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  return (
    <div className={`rounded-xl border p-3.5 ${
      shut ? 'border-slate-100 bg-slate-50/70' : filed ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-center gap-2.5 mb-2">
        {filed
          ? <CheckCircle2 size={17} className="text-emerald-700 shrink-0" />
          : <Circle size={17} className={shut ? 'text-slate-300 shrink-0' : 'text-slate-400 shrink-0'} />}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-900">{day.name}</p>
          <p className="text-[12px] text-slate-500">
            {shut ? 'Not yet' : filed ? `${day.hours}h · ${day.chargedTo}` : 'Not filed'}
          </p>
        </div>
        {filed && !editing && (
          <button onClick={() => setEditing(true)}
            className="text-[12px] font-bold text-indigo-700 hover:text-indigo-800">Edit</button>
        )}
      </div>

      {!shut && (!filed || editing) && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="number" step="0.5" min="0" max="24" value={hours}
              onChange={(e) => setHours(e.target.value)}
              aria-label={`Hours worked on ${day.name}`}
              placeholder="7.5"
              className="w-24 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
            <select
              value={chargedTo} onChange={(e) => setChargedTo(e.target.value)}
              aria-label={`What ${day.name} was charged to`}
              className="flex-1 min-w-0 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200"
            >
              {chargeCodes.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <input
            value={note} onChange={(e) => setNote(e.target.value)}
            aria-label={`Note for ${day.name}`} placeholder="What you actually did (optional)"
            className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
          <button
            onClick={send} disabled={busy || hours === ''}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 disabled:opacity-40"
          >
            <Send size={12} />{busy ? 'Filing…' : filed ? 'Update' : 'File it'}
          </button>
          {error && <p className="text-[12px] text-rose-700 font-semibold">{error}</p>}
        </div>
      )}
    </div>
  );
}

// The team grid. A cell is a day; an empty one is somebody you have to go and chase, which
// is the entire job this tab exists to teach.
function TeamGrid({ team, totalDays, dayNow, onRemind, roster }) {
  const [busyCell, setBusyCell] = useState('');
  const [note, setNote] = useState(null);

  async function chase(archetype, day) {
    setBusyCell(`${archetype}:${day}`); setNote(null);
    try {
      const r = await onRemind(archetype, day);
      if (r && r.lastChase) setNote(r.lastChase);
    } catch (e) { setNote({ error: e.message }); } finally { setBusyCell(''); }
  }

  const dayCols = Array.from({ length: totalDays }, (_, i) => i + 1);
  const person = (a) => (roster || []).find((p) => p.archetype === a) || {};

  return (
    <div>
      {note && (
        <div className={`rounded-lg border px-3 py-2 mb-3 text-[13px] ${
          note.error ? 'border-rose-200 bg-rose-50 text-rose-800'
            : note.filed ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
          {note.error
            ? note.error
            : <><b>{note.name}:</b> “{note.reply}”{note.filed ? ' — filed.' : ' — still nothing.'}</>}
        </div>
      )}

      <div className="overflow-x-auto -mx-1 px-1">
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-[12px] font-bold text-slate-500 uppercase tracking-wide">
              <th className="text-left py-2 pr-3 font-bold">Who</th>
              {dayCols.map((d) => (
                <th key={d} className={`py-2 px-1 font-bold text-center ${d > dayNow ? 'text-slate-300' : ''}`}>
                  D{d}
                </th>
              ))}
              {/* The dashes already say who is behind; on a phone the count is the first
                  thing worth dropping to keep five day columns on screen. */}
              <th className="hidden sm:table-cell py-2 pl-3 font-bold text-right">State</th>
            </tr>
          </thead>
          <tbody>
            {team.map((p) => (
              <tr key={p.archetype} className="border-t border-slate-100">
                <td className="py-2.5 pr-3 align-middle">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="hidden sm:block shrink-0">
                      <Avatar name={p.name} avatarUrl={person(p.archetype).avatarUrl} size={28} />
                    </span>
                    <div className="min-w-0">
                      <div className="text-[13px] font-bold text-slate-800 truncate">{p.name}</div>
                      <div className="text-[12px] text-slate-500 truncate">{p.habit}</div>
                    </div>
                  </div>
                </td>
                {dayCols.map((d) => {
                  const cell = p.days.find((x) => x.day === d);
                  if (!cell) return <td key={d} className="py-2.5 px-1 text-center text-slate-300 text-[12px]">·</td>;
                  if (cell.submitted) {
                    return (
                      <td key={d} className="py-2.5 px-1 text-center">
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 text-[12px] font-bold tabular-nums"
                          title={`${cell.hours}h`}>{cell.hours}</span>
                      </td>
                    );
                  }
                  const busy = busyCell === `${p.archetype}:${d}`;
                  return (
                    <td key={d} className="py-2.5 px-1 text-center">
                      <motion.button
                        whileTap={{ scale: 0.94 }}
                        onClick={() => chase(p.archetype, d)}
                        disabled={busy || cell.reminded}
                        title={cell.reminded ? 'Already chased' : 'Chase this'}
                        aria-label={`Chase ${p.name} about day ${d}`}
                        className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-[12px] font-bold border-2 border-dashed transition-colors ${
                          cell.reminded
                            ? 'border-amber-300 bg-amber-50 text-amber-700 cursor-default'
                            : 'border-rose-300 text-rose-600 hover:bg-rose-50'}`}
                      >{busy ? '…' : cell.reminded ? '!' : '—'}</motion.button>
                    </td>
                  );
                })}
                <td className="hidden sm:table-cell py-2.5 pl-3 align-middle text-right">
                  <span className={`text-[12px] font-bold ${p.complete ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {p.complete ? 'Up to date' : `${p.missingDays.length} missing`}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[12px] text-slate-500 mt-3">
        A dash is a day nobody filed. Click it to chase them — it sends a real message, and
        they answer. Some people file straight away; some need asking twice.
      </p>
    </div>
  );
}

export default function Timesheets({ state, onStateChange }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try { setData((await api.timesheets()).timesheets); }
    catch (e) { setError(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function submit(day, values) {
    const r = await api.submitTimesheet(day, values);
    setData(r.timesheets);
    if (r.state) onStateChange(r.state);
  }
  async function remind(archetype, day) {
    const r = await api.remindTimesheet(archetype, day);
    setData(r.timesheets);
    if (r.state) onStateChange(r.state);
    return r.timesheets;
  }

  if (error) return <p className="text-sm text-rose-700 font-semibold">{error}</p>;
  if (!data) return <p className="text-sm text-slate-500">Loading…</p>;
  if (!data.open) return <p className="text-sm text-slate-500">{data.reason}</p>;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <div className="flex items-baseline gap-2.5 flex-wrap mb-3">
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Timesheets</h1>
          <span className="text-sm font-semibold text-slate-500">
            [{data.projectTitle || 'This month'} · day {data.dayNow} of {data.totalDays}]
          </span>
        </div>
      </div>

      <StatTiles items={[
        { key: 'mine', label: 'Your days filed', value: `${data.mineSubmitted}/${data.mineDue}`,
          sub: data.mineSubmitted >= data.mineDue ? 'up to date' : 'you owe one', tone: data.mineSubmitted >= data.mineDue ? 'emerald' : 'amber', icon: Clock3 },
        data.canChase && { key: 'team', label: 'Your team', value: data.team.length, sub: 'people filing to you', tone: 'indigo', icon: Users },
        data.canChase && { key: 'gaps', label: 'Missing', value: data.teamMissing,
          sub: data.teamMissing ? 'days nobody filed' : 'everyone up to date', tone: data.teamMissing ? 'rose' : 'emerald', icon: TriangleAlert },
        { key: 'cycle', label: 'Month closes', value: `Day ${data.totalDays}`, sub: 'the week is the month', tone: 'violet', icon: CalendarDays },
      ]} />

      <div className={`grid gap-4 sm:gap-6 items-start ${data.canChase ? 'grid-cols-1 xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)]' : 'grid-cols-1'}`}>
        <BentoCard hover={false}>
          <div className="flex items-start gap-2.5 mb-4">
            <span className="shrink-0 w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
              <Clock3 size={18} />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-bold leading-tight">Your week</h2>
              <p className="text-xs text-slate-500 mt-0.5">File a day at a time — the month closes on the last day</p>
            </div>
          </div>
          <div className="space-y-2.5">
            {data.days.map((d) => (
              <MyDay key={d.day} day={d} chargeCodes={data.chargeCodes} onSubmit={submit} />
            ))}
          </div>
        </BentoCard>

        {data.canChase && (
          <BentoCard hover={false}>
            <div className="flex items-start gap-2.5 mb-4">
              <span className="shrink-0 w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center">
                <Users size={18} />
              </span>
              <div className="min-w-0">
                <h2 className="text-base font-bold leading-tight">Who has not filed</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Chasing this is your job, and it is the part nobody thanks you for
                </p>
              </div>
            </div>
            <TeamGrid
              team={data.team}
              totalDays={data.totalDays}
              dayNow={data.dayNow}
              onRemind={remind}
              roster={state.roster}
            />
          </BentoCard>
        )}
      </div>
    </div>
  );
}
