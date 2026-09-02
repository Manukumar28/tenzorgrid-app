import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { BarChart3, Send, AlertCircle } from 'lucide-react';

// The chart builder.
//
// `dataViz` has been an axis on the skill matrix since the beginning with no task that
// could move it, which is worse than not having the axis at all — it reported a
// permanent zero on a skill the learner was never given a chance to show.
//
// What is being assessed here is judgement, not matplotlib syntax: which chart, what on
// each axis, how ordered, and where the value axis starts. So the learner makes those
// four choices and watches the chart change underneath them. Seeing a truncated axis
// exaggerate a 3% gap is a far better teacher than being told it does.

const PALETTE = ['#6366f1', '#14b8a6', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#ef4444', '#84cc16'];

function Preview({ rows, choice, columns }) {
  const { type, x, y, sort, baselineZero } = choice;

  const data = useMemo(() => {
    if (!x || !y) return [];
    const out = rows.map((r) => ({ ...r, __x: r[x], __y: Number(r[y]) })).filter((r) => Number.isFinite(r.__y));
    if (sort === 'desc') out.sort((a, b) => b.__y - a.__y);
    else if (sort === 'asc') out.sort((a, b) => a.__y - b.__y);
    return out;
  }, [rows, x, y, sort]);

  if (!x || !y) {
    return (
      <div className="h-72 flex items-center justify-center text-xs text-slate-400">
        Choose what goes on each axis to see the chart.
      </div>
    );
  }

  // The whole point of the baseline choice is that you can SEE it distort the bars, so
  // the preview honours it rather than quietly normalising.
  const values = data.map((d) => d.__y);
  const min = Math.min(...values);
  const domain = baselineZero || !['bar', 'column'].includes(type)
    ? [0, 'auto']
    : [Math.floor(min * 0.98), 'auto'];

  const common = { data, margin: { top: 16, right: 16, bottom: 8, left: 8 } };
  const axes = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
      <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} />
    </>
  );

  return (
    <div className="h-72 px-1">
      <ResponsiveContainer width="100%" height="100%">
        {type === 'pie' ? (
          <PieChart>
            <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} />
            <Pie data={data} dataKey="__y" nameKey="__x" outerRadius={100} label={(d) => d.__x}>
              {data.map((d, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
            </Pie>
          </PieChart>
        ) : type === 'line' ? (
          <LineChart {...common}>
            {axes}
            <XAxis dataKey="__x" tick={{ fontSize: 11 }} />
            <YAxis domain={domain} tick={{ fontSize: 11 }} width={60} />
            <Line type="monotone" dataKey="__y" stroke="#6366f1" strokeWidth={2.4} dot={{ r: 3 }} />
          </LineChart>
        ) : type === 'scatter' ? (
          <ScatterChart {...common}>
            {axes}
            <XAxis dataKey="__x" type="number" tick={{ fontSize: 11 }} />
            <YAxis dataKey="__y" tick={{ fontSize: 11 }} width={60} />
            <Scatter data={data} fill="#6366f1" />
          </ScatterChart>
        ) : (
          <BarChart {...common} layout={type === 'bar' ? 'vertical' : 'horizontal'}>
            {axes}
            {type === 'bar' ? (
              <>
                <XAxis type="number" domain={domain} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="__x" tick={{ fontSize: 11 }} width={110} />
              </>
            ) : (
              <>
                <XAxis dataKey="__x" tick={{ fontSize: 11 }} />
                <YAxis domain={domain} tick={{ fontSize: 11 }} width={60} />
              </>
            )}
            <Bar dataKey="__y" fill="#6366f1" radius={type === 'bar' ? [0, 5, 5, 0] : [5, 5, 0, 0]} />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

function Choice({ label, children }) {
  return (
    <div>
      <p className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500 mb-1.5">{label}</p>
      {children}
    </div>
  );
}

function Options({ items, value, onPick, ariaPrefix }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((o) => (
        <button
          key={o.key}
          onClick={() => onPick(o.key)}
          title={o.note || ''}
          aria-label={`${ariaPrefix}: ${o.label}`}
          aria-pressed={value === o.key}
          className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border-2 transition-colors ${
            value === o.key
              ? 'border-indigo-500 bg-indigo-50 text-slate-900'
              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function ChartBuilder({ wb, onGraded, onSubmit, submitting, isGraded }) {
  const chart = wb.chart;
  const [choice, setChoice] = useState({
    type: null, x: null, y: null, sort: 'none', baselineZero: true,
  });
  const [error, setError] = useState('');

  const colOptions = chart.columns.map((c) => ({ key: c, label: c }));
  const asks = chart.asks;
  const ready = asks.every((f) => (f === 'baselineZero' ? true : choice[f] !== null && choice[f] !== undefined));

  async function send() {
    if (!ready) { setError('Make every choice before you submit.'); return; }
    setError('');
    // Only the fields this chart is actually graded on are sent — a scatter has no
    // baseline question, and answering one that was never asked would be noise.
    const payload = {};
    for (const f of asks) payload[f] = choice[f];
    await onSubmit(JSON.stringify(payload));
  }

  return (
    <div className="flex flex-col min-w-0">
      <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-slate-200 bg-slate-50/60">
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Chart Builder</span>
        <button
          onClick={send}
          disabled={submitting || isGraded || !ready}
          aria-label="Submit for grading"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 disabled:opacity-40"
        >
          <Send size={12} />{submitting ? 'Submitting…' : 'Submit'}
        </button>
      </div>

      <div className="p-4 space-y-4 min-w-0">
        <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5">
          <BarChart3 size={14} className="text-slate-500 mt-0.5 shrink-0" />
          <p className="text-xs text-slate-700 leading-relaxed">
            <span className="font-bold">{chart.prompt}</span> — {wb.chart.rows.length} rows, already
            queried for you. What's being marked here is how you present them.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <Preview rows={chart.rows} choice={choice} columns={chart.columns} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Choice label="Chart type">
            <Options items={chart.chartTypes} value={choice.type} ariaPrefix="Chart type"
              onPick={(k) => setChoice((c) => ({ ...c, type: k }))} />
          </Choice>
          {asks.includes('sort') && (
            <Choice label="Order">
              <Options items={chart.sorts} value={choice.sort} ariaPrefix="Order"
                onPick={(k) => setChoice((c) => ({ ...c, sort: k }))} />
            </Choice>
          )}
          <Choice label="Category axis">
            <Options items={colOptions} value={choice.x} ariaPrefix="Category axis"
              onPick={(k) => setChoice((c) => ({ ...c, x: k }))} />
          </Choice>
          <Choice label="Value axis">
            <Options items={colOptions} value={choice.y} ariaPrefix="Value axis"
              onPick={(k) => setChoice((c) => ({ ...c, y: k }))} />
          </Choice>
          {asks.includes('baselineZero') && (
            <Choice label="Value axis starts at">
              <Options
                items={[{ key: 'zero', label: 'Zero' }, { key: 'data', label: 'The lowest value' }]}
                value={choice.baselineZero ? 'zero' : 'data'}
                ariaPrefix="Value axis starts at"
                onPick={(k) => setChoice((c) => ({ ...c, baselineZero: k === 'zero' }))}
              />
            </Choice>
          )}
        </div>

        {error && (
          <div className="flex gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3">
            <AlertCircle size={14} className="text-rose-500 mt-0.5 shrink-0" />
            <p className="text-xs text-rose-800 font-medium">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
