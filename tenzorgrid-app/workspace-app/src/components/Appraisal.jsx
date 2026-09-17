import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Star, Download, Lock, TriangleAlert, CheckCircle2, TrendingUp, Scale, Clock3, Award,
} from 'lucide-react';
import { BentoCard, StatTiles, SectionHeading, Avatar } from './ui.jsx';
import { api } from '../api.js';

const RATING_TONE = {
  'Outstanding': 'border-violet-300 bg-violet-50 text-violet-800',
  'Exceeds expectations': 'border-emerald-300 bg-emerald-50 text-emerald-800',
  'Meets expectations': 'border-slate-300 bg-slate-50 text-slate-700',
  'Below expectations': 'border-rose-300 bg-rose-50 text-rose-800',
};

// The pack, on the page as well as in the file. The numbers are the argument, so they are
// shown next to the box where the argument gets written -- but the file is still the
// deliverable, because a real cycle is done in a spreadsheet next to a calendar.
function PersonRow({ p, entry, ratings, onChange, readOnly }) {
  const filedAll = p.timesheetsFiled >= p.timesheetsDue;
  return (
    <div className="rounded-xl border border-slate-200 p-3.5">
      <div className="flex items-start gap-3 mb-3">
        <Avatar name={p.name} avatarUrl={p.avatarUrl} size={34} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[14px] font-bold text-slate-800">{p.name}</span>
            {p.promoted && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-violet-700 bg-violet-50 border border-violet-200 rounded px-1.5 py-0.5">
                <Award size={11} /> promoted
              </span>
            )}
          </div>
          <div className="text-[12px] text-slate-500">{p.title}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-3">
        {[
          ['Deliverables', p.delivered, 'slate'],
          ['On time', `${p.onTime}%`, p.onTime >= 85 ? 'emerald' : p.onTime >= 65 ? 'slate' : 'rose'],
          ['Review', p.review, p.review >= 4 ? 'emerald' : p.review >= 3 ? 'slate' : 'rose'],
          ['Reworks', p.rework, p.rework <= 1 ? 'emerald' : p.rework <= 2 ? 'slate' : 'rose'],
          ['Timesheets', `${p.timesheetsFiled}/${p.timesheetsDue}`, filedAll ? 'sky' : 'sky'],
        ].map(([label, value, tone]) => (
          <div key={label} className={`rounded-lg border px-2 py-1.5 ${
            tone === 'emerald' ? 'border-emerald-200 bg-emerald-50'
              : tone === 'rose' ? 'border-rose-200 bg-rose-50'
                : tone === 'sky' ? 'border-sky-200 bg-sky-50' : 'border-slate-200 bg-slate-50'}`}>
            <div className="text-[15px] font-extrabold text-slate-900 leading-none tabular-nums">{value}</div>
            <div className="text-[11px] font-bold text-slate-600 mt-1">{label}</div>
          </div>
        ))}
      </div>

      {readOnly ? (
        <div>
          <span className={`inline-block text-[12px] font-bold rounded-lg border px-2 py-1 ${RATING_TONE[entry.rating] || ''}`}>
            {entry.rating}
          </span>
          <p className="text-[13px] text-slate-600 mt-2 leading-relaxed whitespace-pre-line">{entry.justification}</p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {ratings.map((r) => (
              <button key={r} onClick={() => onChange({ ...entry, rating: r })}
                className={`text-[12px] font-bold rounded-lg border px-2.5 py-1.5 transition-colors ${
                  entry.rating === r ? RATING_TONE[r] : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                {r}
              </button>
            ))}
          </div>
          <textarea rows={2} value={entry.justification}
            onChange={(e) => onChange({ ...entry, justification: e.target.value })}
            placeholder="Why — and quote a number from the pack. They will read this."
            className="w-full text-[13px] rounded-lg border border-slate-200 px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-200" />
        </div>
      )}
    </div>
  );
}

function Promote({ people, ratings, used, onPromote }) {
  const eligible = people.filter((p) => !p.promoted
    && ['Outstanding', 'Exceeds expectations'].includes((ratings[p.archetype] || {}).rating));
  const [who, setWho] = useState('');
  const [why, setWhy] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (used) {
    return <p className="text-[13px] text-slate-600">One promotion a cycle, and it is spent. Budget is budget.</p>;
  }
  if (!eligible.length) {
    return (
      <p className="text-[13px] text-slate-600">
        Nobody on this board is above Meets expectations this cycle, so there is nobody to put
        forward. That is a legitimate answer to a promotion round and it is most of them.
      </p>
    );
  }

  async function go() {
    setBusy(true); setError('');
    try { await onPromote(who, why); setWho(''); setWhy(''); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-2.5">
      <p className="text-[13px] text-slate-600 leading-relaxed">
        One step, one person, and it does not come back. Their title changes everywhere and
        stays changed — on the Team tab, on your timesheet grid, on next month's register.
      </p>
      <select value={who} onChange={(e) => setWho(e.target.value)}
        className="w-full text-[13px] rounded-lg border border-slate-200 px-2.5 py-2 bg-white">
        <option value="">Who are you putting forward?</option>
        {eligible.map((p) => (
          <option key={p.archetype} value={p.archetype}>
            {p.name} — {p.title} ({(ratings[p.archetype] || {}).rating})
          </option>
        ))}
      </select>
      <textarea rows={3} value={why} onChange={(e) => setWhy(e.target.value)}
        placeholder="The case. Vikram will read it, and so will the people you did not promote."
        className="w-full text-[13px] rounded-lg border border-slate-200 px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-violet-200" />
      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 text-rose-800 text-[13px] p-2.5 leading-relaxed">{error}</div>
      )}
      <motion.button whileTap={{ scale: 0.97 }} onClick={go} disabled={!who || busy}
        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-violet-600 text-white text-[13px] font-bold disabled:bg-slate-300 disabled:text-slate-500 hover:bg-violet-700">
        <TrendingUp size={15} /> {busy ? 'Confirming…' : 'Promote'}
      </motion.button>
    </div>
  );
}

export default function Appraisal({ onStateChange }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [entries, setEntries] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setData((await api.appraisal()).appraisal); }
    catch (e) { setError(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  // After filing, count what was actually submitted rather than the empty draft state --
  // otherwise the quota tile reads "—/2" next to a board that plainly has ratings on it.
  const counts = useMemo(() => {
    const source = data && data.submitted
      ? Object.values(data.submitted.ratings)
      : Object.values(entries);
    const c = {};
    for (const e of source) if (e.rating) c[e.rating] = (c[e.rating] || 0) + 1;
    return c;
  }, [entries, data]);

  if (error) return <p className="text-sm text-rose-700 font-semibold">{error}</p>;
  if (!data) return <p className="text-sm text-slate-500">Loading…</p>;
  if (!data.open) {
    return (
      <BentoCard hover={false}>
        <SectionHeading icon={Lock} tone="slate" title="Appraisal"
          note="Not yours yet — and that is the point of the rung above." />
        <p className="text-sm text-slate-600">{data.reason}</p>
      </BentoCard>
    );
  }

  const filed = data.submitted;
  const openYet = data.dayNow >= data.opensOn;
  const above = (counts.Outstanding || 0) + (counts['Exceeds expectations'] || 0);
  const rated = Object.values(entries).filter((e) => e.rating).length;

  async function submit() {
    setBusy(true); setSubmitError('');
    try {
      const r = await api.submitAppraisal(entries);
      setData(r.appraisal);
      if (r.state) onStateChange(r.state);
    } catch (e) { setSubmitError(e.message); } finally { setBusy(false); }
  }

  async function promote(archetype, justification) {
    const r = await api.promotePerson(archetype, justification);
    setData(r.appraisal);
    if (r.state) onStateChange(r.state);
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-baseline gap-2.5 flex-wrap">
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Appraisals</h1>
        <span className="text-sm font-semibold text-slate-500">
          [{data.projectTitle || 'This cycle'} · day {data.dayNow} of {data.totalDays}]
        </span>
      </div>

      <StatTiles items={[
        { key: 'people', label: 'To rate', value: data.people.length, sub: 'everyone who reports to you', tone: 'indigo', icon: Star },
        { key: 'quota', label: 'Above Meets', value: `${above}/${data.quota.aboveMeets}`,
          sub: `and ${data.quota.outstanding} Outstanding, no more`, tone: above > data.quota.aboveMeets ? 'rose' : 'amber', icon: Scale },
        { key: 'window', label: filed ? 'Rated' : openYet ? 'Open now' : 'Opens',
          value: filed ? `${filed.score}%` : openYet ? 'Today' : `Day ${data.opensOn}`,
          sub: filed ? 'held up against the pack' : openYet ? 'the cycle closes today' : 'the last day of the cycle',
          tone: filed ? (filed.score >= 80 ? 'emerald' : 'rose') : openYet ? 'amber' : 'slate', icon: filed ? CheckCircle2 : Clock3 },
        data.canPromote && { key: 'promo', label: 'Promotions', value: data.promotions.length,
          sub: data.promotionUsed ? 'spent for this cycle' : 'one available', tone: 'violet', icon: TrendingUp },
      ]} />

      {filed && (
        <BentoCard hover={false}>
          <SectionHeading icon={filed.score >= 80 ? CheckCircle2 : TriangleAlert} tone={filed.score >= 80 ? 'emerald' : 'rose'}
            title={`Ratings in — ${filed.score}% held up`}
            note="What People came back with, measured against the pack you were given." />
          <div className={`rounded-xl border p-3.5 text-sm whitespace-pre-line leading-relaxed ${
            filed.score >= 80 ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-rose-200 bg-rose-50 text-rose-900'}`}>
            {filed.feedback}
          </div>
        </BentoCard>
      )}

      {data.canPromote && filed && (
        <BentoCard hover={false}>
          <SectionHeading icon={TrendingUp} tone="violet" title="Promotion"
            note="A manager's call, and the only one on this page that is permanent." />
          <Promote people={data.people} ratings={filed.ratings} used={data.promotionUsed} onPromote={promote} />
          {data.promotions.length > 0 && (
            <ul className="mt-4 space-y-1.5">
              {data.promotions.map((p) => {
                const who = data.people.find((x) => x.archetype === p.archetype);
                return (
                  <li key={p.archetype} className="text-[13px] text-slate-600">
                    <b className="text-slate-800">{who ? who.name : p.archetype}</b> — {p.from} → <b className="text-violet-700">{p.to}</b>
                  </li>
                );
              })}
            </ul>
          )}
        </BentoCard>
      )}

      <BentoCard hover={false}>
        <SectionHeading icon={Star} tone="indigo"
          title={filed ? 'What you wrote' : 'The board'}
          note={filed
            ? 'Kept, because a rating you cannot produce later is a rating you did not really make.'
            : 'Rate the work. The timesheet column is there because it is the easiest thing to see and the least informative.'}
          right={!filed && (
            <a href={api.appraisalCsvUrl} download
              className="shrink-0 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 text-white text-[12px] font-bold hover:bg-slate-900">
              <Download size={14} /> The pack
            </a>
          )} />

        {!filed && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 mb-4">
            <p className="text-[13px] text-amber-900 leading-relaxed">
              <b>At most {data.quota.outstanding} Outstanding and {data.quota.aboveMeets} of {data.people.length} above
              Meets expectations.</b> A rating is a ranking whether or not you write one down, and
              "everybody exceeded" is how a scale stops meaning anything. Every rating needs a
              reason of at least {data.justificationMin} characters citing a number — it goes to them.
            </p>
          </div>
        )}

        <div className="space-y-3">
          {data.people.map((p) => (
            <PersonRow key={p.archetype} p={p} ratings={data.ratings} readOnly={Boolean(filed)}
              entry={filed ? (filed.ratings[p.archetype] || { rating: '', justification: '' })
                : (entries[p.archetype] || { rating: '', justification: '' })}
              onChange={(e) => setEntries((prev) => ({ ...prev, [p.archetype]: e }))} />
          ))}
        </div>

        {!filed && (
          <div className="mt-4">
            {submitError && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 text-rose-800 text-[13px] p-2.5 mb-3 leading-relaxed">
                {submitError}
              </div>
            )}
            {!openYet ? (
              <p className="text-[13px] text-slate-600">
                The window opens on day {data.opensOn}, when the cycle closes. Read the pack now.
              </p>
            ) : (
              <motion.button whileTap={{ scale: 0.97 }} onClick={submit}
                disabled={busy || rated < data.people.length}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-indigo-600 text-white text-[13px] font-bold disabled:bg-slate-300 disabled:text-slate-500 hover:bg-indigo-700">
                <Star size={15} /> {busy ? 'Sending…' : `Submit ${data.people.length} ratings`}
              </motion.button>
            )}
            {openYet && rated < data.people.length && (
              <p className="text-[12px] text-slate-500 mt-2">
                {data.people.length - rated} still unrated. Nobody gets skipped.
              </p>
            )}
          </div>
        )}
      </BentoCard>
    </div>
  );
}
