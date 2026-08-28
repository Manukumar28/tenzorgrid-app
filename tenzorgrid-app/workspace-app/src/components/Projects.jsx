import React from 'react';
import { Folder } from 'lucide-react';
import { BentoCard, ProgressBar, Pill } from './ui.jsx';

export default function Projects({ state }) {
  const p = state.project;
  if (!p) return <BentoCard>No project assigned yet.</BentoCard>;

  return (
    <div className="space-y-5">
      <BentoCard index={0}>
        <h3 className="text-lg font-extrabold mb-1.5">{p.title}</h3>
        <p className="text-sm text-gray-500 mb-4">{p.description}</p>
        <ProgressBar value={p.tasksTotal ? (p.tasksCompleted / p.tasksTotal) * 100 : 0} max={100} />
        <p className="text-sm text-gray-500 mt-2.5">{p.tasksCompleted} of {p.tasksTotal} tasks completed</p>
      </BentoCard>

      <BentoCard index={1}>
        <h3 className="text-base font-bold mb-3.5">Files</h3>
        {p.files.length ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {p.files.map((f) => (
              <div key={f.taskId} className="border border-gray-100 bg-gray-50 rounded-lg p-4">
                <Folder size={26} className="text-indigo-500 fill-indigo-100 mb-3" strokeWidth={1.8} />
                <div className="text-sm font-bold leading-snug">{f.title}</div>
                <div className="text-xs text-gray-500 mt-1">{f.name}</div>
                <div className="text-xs text-gray-400">{new Date(f.submittedAt).toLocaleDateString()}</div>
                <Pill className="bg-teal-50 text-teal-600 mt-2.5">{f.score}/100</Pill>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">Nothing submitted yet — completed task files will show up here.</p>
        )}
      </BentoCard>
    </div>
  );
}
