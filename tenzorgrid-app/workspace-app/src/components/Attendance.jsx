import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ClipboardList, Download, Upload, CheckCircle2, TriangleAlert, CalendarDays, Users, Lock,
} from 'lucide-react';
import { BentoCard, StatTiles, SectionHeading, Avatar } from './ui.jsx';
import { api } from '../api.js';

// Three steps, numbered, because the process IS the lesson and a learner who has never
// filed a return has no idea it has steps. Download, fix, send back.
function Step({ n, title, children, done, dim }) {
  return (
    <div className={`flex gap-3 ${dim ? 'opacity-55' : ''}`}>
      <span className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-[13px] font-extrabold ${
        done ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'}`}>
        {done ? <CheckCircle2 size={15} /> : n}
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="text-[14px] font-bold text-slate-800 mb-1">{title}</div>
        {children}
      </div>
    </div>
  );
}

// What HR sent: everybody present, every day. Read-only on purpose — this is the thing
// being corrected, not the place to correct it.
function Register({ people, days, rows, statuses }) {
  const tone = (s) => (s === 'Present' ? 'text-slate-600'
    : s === 'Work from home' ? 'text-sky-700 font-bold'
      : 'text-amber-800 font-bold');
  const shortFor = (s) => ({
    'Present': 'P', 'Work from home': 'WFH', 'Annual leave': 'AL', 'Sick leave': 'SL', 'Unpaid leave': 'UL',
  }[s] || s);
  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <table className="w-full border-collapse">
        <thead>
          <tr className="text-[12px] font-bold text-slate-500 uppercase tracking-wide">
            <th className="text-left py-2 pr-3 font-bold">Who</th>
            {days.map((d) => <th key={d.day} className="py-2 px-1 font-bold text-center">{d.short}</th>)}
          </tr>
        </thead>
        <tbody>
          {people.map((p) => (
            <tr key={p.archetype} className="border-t border-slate-100">
              <td className="py-2.5 pr-3 align-middle">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="hidden sm:block shrink-0"><Avatar name={p.name} avatarUrl={p.avatarUrl} size={26} /></span>
                  <div className="min-w-0">
                    <div className="text-[13px] font-bold text-slate-800 truncate">{p.name}</div>
                    <div className="text-[12px] text-slate-500 truncate">{p.title}</div>
                  </div>
                </div>
              </td>
              {days.map((d) => {
                const v = ((rows || {})[p.archetype] || {})[d.day] || 'Present';
                return (
                  <td key={d.day} className={`py-2.5 px-1 text-center text-[12px] tabular-nums ${tone(v)}`} title={v}>
                    {shortFor(v)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-[12px] text-slate-500 mt-3">
        Key: {statuses.map((s) => `${shortFor(s)} = ${s.toLowerCase()}`).join(' · ')}
      </p>
    </div>
  );
}

export default function Attendance({ onStateChange }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [upload, setUpload] = useState({ name: '', text: '', error: '', busy: false });
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    try { setData((await api.attendance()).attendance); }
    catch (e) { setError(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  function pick(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setUpload({ name: file.name, text: String(reader.result || ''), error: '', busy: false });
    reader.onerror = () => setUpload({ name: '', text: '', error: 'That file could not be read.', busy: false });
    reader.readAsText(file);
  }

  async function send() {
    setUpload((u) => ({ ...u, busy: true, error: '' }));
    try {
      const r = await api.submitAttendance(upload.text);
      setData(r.attendance);
      if (r.state) onStateChange(r.state);
      setUpload({ name: '', text: '', error: '', busy: false });
      if (fileRef.current) fileRef.current.value = '';
    } catch (e) {
      setUpload((u) => ({ ...u, busy: false, error: e.message }));
    }
  }

  if (error) return <p className="text-sm text-rose-700 font-semibold">{error}</p>;
  if (!data) return <p className="text-sm text-slate-500">Loading…</p>;
  if (!data.open) {
    return (
      <BentoCard hover={false}>
        <SectionHeading icon={Lock} tone="slate" title="Attendance"
          note="Not yours yet — and that is the point of the rung above." />
        <p className="text-sm text-slate-600">{data.reason}</p>
      </BentoCard>
    );
  }

  const days = Array.from({ length: data.totalDays }, (_, i) => ({
    day: i + 1, short: (data.header[i + 1] || `D${i + 1}`).slice(0, 3),
  }));
  const filed = data.submitted;
  const openYet = data.dayNow >= data.opensOn;
  const score = filed ? filed.score : null;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-baseline gap-2.5 flex-wrap">
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Attendance</h1>
        <span className="text-sm font-semibold text-slate-500">
          [{data.projectTitle || 'This month'} · day {data.dayNow} of {data.totalDays}]
        </span>
      </div>

      <StatTiles items={[
        { key: 'people', label: 'On your return', value: data.people.length, sub: 'people you sign for', tone: 'indigo', icon: Users },
        { key: 'window', label: filed ? 'Filed' : openYet ? 'Open now' : 'Opens',
          value: filed ? '✓' : `Day ${data.opensOn}`,
          sub: filed ? 'payroll has it' : openYet ? 'the month closes today' : 'the last day of the month',
          tone: filed ? 'emerald' : openYet ? 'amber' : 'slate', icon: CalendarDays },
        filed && { key: 'score', label: 'Return accuracy', value: `${score}%`,
          sub: score === 100 ? 'nothing wrong with it' : 'see what came back', tone: score >= 80 ? 'emerald' : 'rose', icon: score >= 80 ? CheckCircle2 : TriangleAlert },
      ]} />

      {filed ? (
        <BentoCard hover={false}>
          <SectionHeading icon={score >= 80 ? CheckCircle2 : TriangleAlert} tone={score >= 80 ? 'emerald' : 'rose'}
            title={`Filed — ${score}%`} note="What People came back with. It is also in your inbox." />
          <div className={`rounded-xl border p-3.5 text-sm whitespace-pre-line leading-relaxed ${
            score >= 80 ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-rose-200 bg-rose-50 text-rose-900'}`}>
            {filed.feedback}
          </div>
          <div className="mt-5">
            <div className="text-[13px] font-bold text-slate-700 mb-2">What you sent</div>
            <Register people={data.people} days={days} rows={filed.rows} statuses={data.statuses} />
          </div>
        </BentoCard>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 items-start">
          <BentoCard hover={false}>
            <SectionHeading icon={ClipboardList} tone="indigo" title="The monthly return"
              note="Three steps, and the middle one does not happen on this page." />
            <div className="space-y-5">
              <Step n={1} title="Download the register HR sent you">
                <p className="text-[13px] text-slate-600 mb-2.5 leading-relaxed">
                  It comes back with everybody marked present, every day. The badge system is
                  all People have — it does not know who was on leave.
                </p>
                <motion.a whileTap={{ scale: 0.97 }} href={api.attendanceCsvUrl} download
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-indigo-600 text-white text-[13px] font-bold hover:bg-indigo-700">
                  <Download size={15} /> attendance-register.csv
                </motion.a>
              </Step>

              <Step n={2} title="Correct it against what you were told">
                <p className="text-[13px] text-slate-600 leading-relaxed">
                  Every approval, sick note and cancellation came to you by mail during the
                  month. Go back through it. A withdrawn request is not leave — marking
                  somebody away who was at their desk takes a day's pay off them, and it
                  counts against this return exactly as hard as missing a day does.
                </p>
                <p className="text-[12px] text-slate-500 mt-2">
                  Statuses this file accepts: {data.statuses.join(', ')}.
                </p>
              </Step>

              <Step n={3} title="Send it back" dim={!openYet}>
                {!openYet ? (
                  <p className="text-[13px] text-slate-600">
                    The return closes the month, so it opens on {data.header[data.opensOn]}.
                    You can start on the file now.
                  </p>
                ) : (
                  <div>
                    <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={pick}
                      className="block w-full text-[13px] text-slate-600 file:mr-3 file:px-3.5 file:py-2 file:rounded-lg file:border-0 file:bg-slate-800 file:text-white file:text-[13px] file:font-bold hover:file:bg-slate-900" />
                    {upload.name && (
                      <p className="text-[12px] text-slate-600 mt-2">
                        Ready to send: <b>{upload.name}</b>, {upload.text.split('\n').filter(Boolean).length - 1} rows.
                      </p>
                    )}
                    {upload.error && (
                      <div className="mt-2.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-800 text-[13px] p-2.5 leading-relaxed">
                        {upload.error}
                      </div>
                    )}
                    <motion.button whileTap={{ scale: 0.97 }} onClick={send}
                      disabled={!upload.text || upload.busy}
                      className="mt-3 inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-emerald-600 text-white text-[13px] font-bold disabled:bg-slate-300 disabled:text-slate-500 hover:bg-emerald-700">
                      <Upload size={15} /> {upload.busy ? 'Sending…' : 'File the return'}
                    </motion.button>
                    <p className="text-[12px] text-slate-500 mt-2">
                      Once a month, once only. Payroll runs off it.
                    </p>
                  </div>
                )}
              </Step>
            </div>
          </BentoCard>

          <BentoCard hover={false}>
            <SectionHeading icon={Users} tone="slate" title="What HR sent"
              note="The same thing that is in the file — here so you can see what you are correcting." />
            <Register people={data.people} days={days} rows={data.draft} statuses={data.statuses} />
          </BentoCard>
        </div>
      )}
    </div>
  );
}
