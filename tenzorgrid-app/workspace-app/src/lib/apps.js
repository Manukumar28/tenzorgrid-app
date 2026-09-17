import {
  Database, BarChart3, Inbox, CalendarDays, Users, AppWindow,
} from 'lucide-react';

// The client half of the application registry.
//
// The set itself comes from the server on `state.apps`, because which tools an employer
// hands out depends on the role and that is the engine's business. All this file does is
// turn the registry's icon strings into components and answer the two questions the UI
// asks: "which app does this piece of work belong in?" and "where does launching it go?"
//
// Same split lib/projectdocs.js already uses for its tool registry -- icon as a string on
// the server, resolved here -- so there is one convention rather than two.

const ICONS = { Database, BarChart3, Inbox, CalendarDays, Users };

export function iconFor(app) {
  return (app && ICONS[app.icon]) || AppWindow;
}

export function appById(apps, id) {
  return (apps || []).find((a) => a.id === id) || null;
}

// Which application a task belongs in, by its own tool kind. Returns null for the kinds
// that are not tool work -- judgement, write-ups, coaching, allocation, sign-off. Those
// happen at your desk and saying otherwise would be inventing an application.
export function appForTask(apps, task) {
  if (!task || !task.tool) return null;
  return (apps || []).find((a) => (a.capabilities || []).includes(task.tool)) || null;
}

// The verb on the button that opens a piece of work. Names the application only when the
// destination is genuinely known; otherwise the honest generic.
export function openLabelFor(apps, task, started) {
  const app = appForTask(apps, task);
  if (app) return `Open in ${app.name}`;
  return started ? 'Continue work' : 'Start work';
}

// Launching an application from the launcher rather than from a task.
//
// A place (Mail, Calendar, People) just opens. A bench (Analytics Studio, BI Studio) has
// nothing to do without an assignment, so it opens the most pressing piece of open work
// it can actually carry -- and if there is none, it lands on My Work and says why rather
// than opening an empty editor.
export function launchTarget(app, state) {
  if (!app) return { tab: 'workday', taskId: null, note: null };
  if (!app.capabilities || app.capabilities.length === 0) {
    return { tab: app.tab, taskId: null, note: null };
  }
  const rows = ((state && state.taskBoard && state.taskBoard.rows) || [])
    .filter((r) => r.status !== 'graded' && !r.notYetOpen && app.capabilities.includes(r.tool));
  if (rows.length) return { tab: app.tab, taskId: rows[0].id, note: null };
  return { tab: app.tab, taskId: null, note: `Nothing open for ${app.name} right now.` };
}

// How much work is waiting in each application. Real counts off the board, so the
// launcher can be useful rather than decorative; zero means no badge at all.
export function pendingFor(app, state) {
  if (!app || !app.capabilities || !app.capabilities.length) return 0;
  return ((state && state.taskBoard && state.taskBoard.rows) || [])
    .filter((r) => r.status !== 'graded' && !r.notYetOpen && app.capabilities.includes(r.tool)).length;
}
