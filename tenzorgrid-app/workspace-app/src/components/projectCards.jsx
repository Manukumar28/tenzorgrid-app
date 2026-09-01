import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { LineChart, LayoutDashboard, Scale, Code2, Lock, Clock, ArrowRight, ChevronRight, FileText} from 'lucide-react';
import { BentoCard, ProgressBar, Avatar } from './ui.jsx';

export function money(n) {
  return `$${(n || 0).toLocaleString('en-US')}`;
}

// A project's `kind` is authored in the catalog and only ever picks an icon/accent —
// it carries no data, so it can never disagree with the numbers on the card.
const KIND_ICON = { analysis: LineChart, dashboard: LayoutDashboard, audit: Scale, api: Code2 };
const KIND_ACCENT = {
  analysis: 'from-indigo-500 to-indigo-400',
  dashboard: 'from-teal-500 to-teal-400',
  audit: 'from-fuchsia-500 to-purple-500',
  api: 'from-blue-500 to-cyan-400',
};
const DIFFICULTY_STYLE = {
  Easy: 'bg-emerald-50 text-emerald-600',
  Medium: 'bg-amber-50 text-amber-600',
  Hard: 'bg-red-50 text-red-500',
};

function KindIcon({ kind, size = 'w-12 h-12', icon = 22 }) {
  const Icon = KIND_ICON[kind] || LineChart;
  return (
    <div className={`${size} rounded-xl shrink-0 flex items-center justify-center bg-gradient-to-br ${KIND_ACCENT[kind] || KIND_ACCENT.analysis}`}>
      <Icon size={icon} className="text-white" strokeWidth={2.1} />
    </div>
  );
}

function Tag({ children, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold rounded-md px-2 py-1 ${className}`}>
      {children}
    </span>
  );
}

function SkillGainTag({ skill }) {
  return (
    <Tag className="bg-gray-50 border border-gray-100 text-gray-600">
      {skill.label}
      <span className="text-indigo-600">+{skill.points}</span>
    </Tag>
  );
}

function Stakeholder({ person, label = 'Stakeholder' }) {
  if (!person) return null;
  return (
    <div className="flex items-center gap-2 min-w-0">
      <Avatar name={person.name} avatarUrl={person.avatarUrl} size={22} />
      <span className="text-xs text-gray-500 truncate">
        {label}: <span className="font-semibold text-gray-700">{person.name}</span>
      </span>
    </div>
  );
}

function ActionButton({ children, onClick, variant = 'primary', disabled = false, className = '' }) {
  const styles = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm',
    secondary: 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50',
  }[variant];
  return (
    <motion.button
      whileTap={disabled ? undefined : { scale: 0.97 }}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 text-xs font-bold rounded-lg px-3.5 py-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${styles} ${className}`}
    >
      {children}
    </motion.button>
  );
}

// Every card gets this, in every state: the brief is a reference document, not a
// one-time gate. A learner mid-task who has forgotten the constraint should be able to
// reopen it without abandoning their work.
export function BriefLink({ onClick }) {
  if (!onClick) return null;
  return (
    <button
      onClick={onClick}
      aria-label="Read the project brief"
      className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-500 hover:text-indigo-600"
    >
      <FileText size={12} />Read brief
    </button>
  );
}

export function ActiveProjectCard({ project, person, index, onOpenTasks, onOpenBrief }) {
  return (
    <BentoCard index={index} className="flex flex-col">
      <div className="flex items-start gap-3.5 mb-4">
        <KindIcon kind={project.kind} />
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-bold uppercase tracking-wide text-indigo-500 mb-0.5">Active project</div>
          <h3 className="text-base font-bold leading-snug truncate">{project.title}</h3>
          <div className="mt-1.5"><Stakeholder person={person} /></div>
        </div>
      </div>

      <div className="mb-4">
        <div className="flex items-baseline justify-between gap-3 mb-2">
          <span className="text-sm font-semibold text-gray-700 truncate">{project.phase || 'In progress'}</span>
          <span className="text-xs font-bold text-gray-500 shrink-0">{project.progressPct}% complete</span>
        </div>
        <ProgressBar value={project.progressPct} max={100} colorClass="from-indigo-500 to-teal-400" />
      </div>

      <div className="mt-auto">
        {project.skillsGained.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {project.skillsGained.map((s) => <SkillGainTag key={s.axis} skill={s} />)}
          </div>
        )}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {/* Not banked yet — this project is still open, so it reads as a target. */}
          <span className="text-xs font-bold text-emerald-600">{money(project.impactValue)} on delivery</span>
          <div className="flex items-center gap-3">
            <BriefLink onClick={onOpenBrief} />
            <ActionButton onClick={onOpenTasks}>
              Continue <ArrowRight size={14} />
            </ActionButton>
          </div>
        </div>
      </div>
    </BentoCard>
  );
}

export function AvailableProjectCard({ project, person, index, onStart, starting, onOpenBrief }) {
  return (
    <BentoCard index={index} className="flex flex-col">
      <div className="flex items-start gap-3 mb-3">
        <KindIcon kind={project.kind} size="w-10 h-10" icon={19} />
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-bold uppercase tracking-wide text-blue-500 mb-0.5">Available</div>
          <h3 className="text-sm font-bold leading-snug">{project.title}</h3>
        </div>
      </div>

      <p className="text-xs text-gray-500 leading-relaxed mb-3 line-clamp-3">{project.description}</p>

      <div className="flex flex-wrap gap-1.5 mb-3">
        <Tag className={DIFFICULTY_STYLE[project.difficulty] || DIFFICULTY_STYLE.Medium}>{project.difficulty}</Tag>
        {project.estHours > 0 && (
          <Tag className="bg-gray-50 border border-gray-100 text-gray-600">
            <Clock size={12} /> ~{project.estHours}h
          </Tag>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {project.skillFocus.map((s) => (
          <Tag key={s.axis} className="bg-indigo-50 text-indigo-600">{s.label}</Tag>
        ))}
      </div>

      <div className="mt-auto space-y-2.5">
        <div className="text-xs font-bold text-emerald-600">{money(project.impactValue)} on delivery</div>
        <div className="mb-0.5"><Stakeholder person={person} /></div>
        <ActionButton onClick={onStart} disabled={starting} className="w-full">
          {starting ? 'Opening…' : 'View brief & start'}
        </ActionButton>
        <div className="pt-0.5"><BriefLink onClick={onOpenBrief} /></div>
      </div>
    </BentoCard>
  );
}

export function LockedProjectCard({ project, person, index, onOpenBrief }) {
  return (
    <BentoCard index={index} hover={false} className="flex flex-col bg-gray-50/60">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center bg-gray-200">
          <Lock size={18} className="text-gray-500" strokeWidth={2.2} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-0.5">Locked</div>
          <h3 className="text-sm font-bold leading-snug text-gray-600">{project.title}</h3>
        </div>
      </div>

      <p className="text-xs text-gray-400 leading-relaxed mb-3 line-clamp-3">{project.description}</p>

      {/* The real gate, stated plainly rather than dressed up as a mystery. */}
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 bg-white border border-gray-100 rounded-lg px-2.5 py-2 mb-3">
        <Lock size={12} className="shrink-0" />
        <span className="truncate">{project.requirement}</span>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3">
        <Tag className={`${DIFFICULTY_STYLE[project.difficulty] || DIFFICULTY_STYLE.Medium} opacity-70`}>{project.difficulty}</Tag>
        {project.estHours > 0 && (
          <Tag className="bg-white border border-gray-100 text-gray-500"><Clock size={12} /> ~{project.estHours}h</Tag>
        )}
      </div>

      <div className="mt-auto"><BriefLink onClick={onOpenBrief} /></div>

      <div className="mt-auto opacity-70"><Stakeholder person={person} /></div>
    </BentoCard>
  );
}

const GRADE_RING = {
  A: 'border-emerald-400 text-emerald-600',
  B: 'border-teal-400 text-teal-600',
  C: 'border-amber-400 text-amber-600',
  D: 'border-orange-400 text-orange-500',
  E: 'border-red-400 text-red-500',
};

export function CompletedProjectCard({ project, person, index, onOpenBrief }) {
  const [open, setOpen] = useState(false);
  // Only ever real grader feedback — a task with none simply isn't listed.
  const feedback = project.tasks.filter((t) => t.feedback);

  return (
    <BentoCard index={index} className="flex flex-col">
      <div className="text-[11px] font-bold uppercase tracking-wide text-emerald-500 mb-2.5">Completed</div>
      <div className="flex items-start gap-3 mb-3">
        <div className={`w-14 h-14 rounded-full border-4 shrink-0 flex items-center justify-center bg-white ${GRADE_RING[project.grade] || GRADE_RING.C}`}>
          <span className="text-xl font-extrabold leading-none">{project.grade}</span>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold leading-snug">{project.title}</h3>
          <div className="text-xs text-gray-500 mt-1">Score: <span className="font-bold text-gray-700">{project.avgScore}%</span></div>
        </div>
      </div>

      <div className="space-y-2 mb-3">
        <Stakeholder person={person} />
        <div className="text-xs text-gray-500">
          Impact banked: <span className="font-bold text-emerald-600">{money(project.impactValue)}</span>
        </div>
      </div>

      {project.skillsGained.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {project.skillsGained.map((s) => <SkillGainTag key={s.axis} skill={s} />)}
        </div>
      )}

      <div className="mt-auto">
        <ActionButton variant="secondary" onClick={() => setOpen((v) => !v)} disabled={!feedback.length} className="w-full">
          {feedback.length ? (open ? 'Hide feedback' : 'View feedback') : 'No feedback recorded'}
          {feedback.length > 0 && <ChevronRight size={14} className={open ? 'rotate-90 transition-transform' : 'transition-transform'} />}
        </ActionButton>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="overflow-hidden mt-3 space-y-2.5"
          >
            {feedback.map((t) => (
              <div key={t.id} className="text-xs bg-gray-50 border border-gray-100 rounded-lg p-2.5">
                <div className="font-bold text-gray-700 mb-1">{t.title} — {t.score}%</div>
                <p className="text-gray-600 leading-relaxed whitespace-pre-line">{t.feedback}</p>
              </div>
            ))}
          </motion.div>
        )}
      </div>
    </BentoCard>
  );
}
