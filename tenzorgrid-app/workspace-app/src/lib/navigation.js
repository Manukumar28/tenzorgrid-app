import {
  Home, Inbox, Calendar, ClipboardCheck, Sun, FolderOpen, Users, Star,
  TrendingUp, Clock3, ClipboardList, Settings,
} from 'lucide-react';

// The navigation, as one object.
//
// It used to be a flat array of twelve equal-weight tabs in Sidebar.jsx, which is what a
// product looks like when its screens were added one at a time. An employee does not hold
// twelve equal destinations in their head; they hold a handful of places they go, grouped
// by what kind of thing happens there.
//
// Everything about a destination lives here -- label, icon, which section it belongs to,
// who is allowed to see it, and what its badge counts. Sidebar and the mobile bar both
// read this, so a label can never disagree with a permission, and adding a destination is
// one entry rather than four edits in three files.
//
// `id` is the internal tab key and deliberately unchanged from before this milestone. The
// learner sees "My Work"; the code still says `tasks`. Renaming the identifiers would have
// bought nothing and touched the workbench routing, the deep links from Home, and every
// test that names a tab.

export const SECTIONS = [
  // The employer's name, not the product's. This is the group an employee thinks of as
  // "the company" -- where you start, what came in, what is scheduled.
  { key: 'company', label: null },
  { key: 'work', label: 'Work' },
  { key: 'people', label: 'People' },
  { key: 'career', label: 'Career' },
  { key: 'workplace', label: 'Workplace' },
];

export const LEVEL_RANK = { junior: 0, senior: 1, lead: 2, manager: 3 };

// Badges are selectors over server state, never constants. A count that cannot be derived
// from the payload does not get a badge -- the point of a number in navigation is that it
// is true, and a decorative one teaches a learner to ignore all of them.
const badges = {
  unreadMail: (s) => (s && s.inbox ? s.inbox.counts.unread : 0),
  // Work that is actually shouting: sent back by your manager, or past its date. Not
  // "everything open", which on a Monday is the whole week and says nothing.
  //
  // `notYetOpen` is excluded, and that is not a detail. A task whose day has not arrived
  // carries a due date that has already passed, so counting it made the badge read 19
  // beside a card on the same screen reading 13 Overdue -- the board's own count, which
  // has always excluded unopened work. A number in the navigation that disagrees with
  // the page it points at is worse than no number.
  workNeedingAttention: (s) => ((s && s.taskBoard && s.taskBoard.rows) || [])
    .filter((r) => r.status !== 'graded' && !r.notYetOpen && (r.sentBack || r.overdue)).length,
  // What today still owes, in the day cycle's own currency: the activities, situations
  // and tasks the day counts. Same numbers the day gate uses to decide it can close.
  owedToday: (s) => {
    const d = s && s.day;
    if (!d) return 0;
    const left = (part) => Math.max(0, (part.total || 0) - (part.done || 0));
    return left(d.tasks || {}) + left(d.activities || {}) + left(d.situations || {});
  },
};

export const NAV_ITEMS = [
  // ---- The company: where a day starts ----
  { id: 'workday', section: 'company', label: 'Home', icon: Home, primary: true,
    hint: 'What is happening at work' },
  { id: 'emails', section: 'company', label: 'Inbox', icon: Inbox, primary: true,
    hint: 'Mail from colleagues and the company', badge: badges.unreadMail, badgeTone: 'rose' },
  { id: 'calendar', section: 'company', label: 'Calendar', icon: Calendar, primary: true,
    hint: 'Deadlines, sign-offs and what landed when' },

  // ---- Work: what you are here to do ----
  { id: 'tasks', section: 'work', label: 'My Work', icon: ClipboardCheck, primary: true,
    hint: 'Your assignments and the workbench', badge: badges.workNeedingAttention, badgeTone: 'amber' },
  { id: 'today', section: 'work', label: 'My Day', icon: Sun, primary: true,
    hint: "Today's reading, judgement calls and admin", badge: badges.owedToday, badgeTone: 'slate' },
  { id: 'projects', section: 'work', label: 'Projects', icon: FolderOpen, primary: true,
    hint: 'The initiatives your work belongs to' },

  // ---- People ----
  { id: 'team', section: 'people', label: 'Team', icon: Users,
    hint: 'Colleagues, and who reports to you' },
  // Rating your reports is a people-management job, not your own career record. Filing it
  // under Performance would have put two things called performance in one menu.
  { id: 'appraisal', section: 'people', label: 'Appraisals', icon: Star, minLevel: 'lead',
    hint: 'Rate your reports, and promote' },

  // ---- Career: your own record ----
  { id: 'overview', section: 'career', label: 'Performance', icon: TrendingUp,
    hint: 'Your scores, skills and the rung above' },

  // ---- Workplace administration ----
  { id: 'timesheets', section: 'workplace', label: 'Timesheets', icon: Clock3,
    hint: 'File your hours; chase your team' },
  { id: 'attendance', section: 'workplace', label: 'Attendance', icon: ClipboardList, minLevel: 'lead',
    hint: 'The monthly return' },
];

// Sits outside the groups, pinned to the bottom. It is not a workplace destination.
export const SETTINGS_ITEM = { id: 'settings', label: 'Settings', icon: Settings, hint: 'Your preferences' };

// The handful a phone puts within thumb reach. Everything else is one tap further, in the
// drawer that already existed -- one navigation system with a fast path, not two.
export const MOBILE_PRIMARY = ['workday', 'emails', 'tasks', 'calendar'];

export function canSee(item, level) {
  if (!item.minLevel) return true;
  const rank = LEVEL_RANK[level] === undefined ? 0 : LEVEL_RANK[level];
  return rank >= LEVEL_RANK[item.minLevel];
}

export function visibleItems(level) {
  return NAV_ITEMS.filter((i) => canSee(i, level));
}

// Grouped and ready to render, with empty sections dropped -- a junior has no Appraisals
// and no Attendance, and a heading over nothing is worse than no heading.
export function navigationFor(level) {
  return SECTIONS
    .map((s) => ({ ...s, items: visibleItems(level).filter((i) => i.section === s.key) }))
    .filter((s) => s.items.length > 0);
}

export function badgeFor(item, state) {
  if (!item.badge || !state) return 0;
  try { return item.badge(state) || 0; } catch { return 0; }
}

// One place that knows what a destination is called, so a page heading and the menu entry
// that led to it cannot drift apart.
export function labelFor(id) {
  const item = NAV_ITEMS.find((i) => i.id === id);
  if (item) return item.label;
  return id === SETTINGS_ITEM.id ? SETTINGS_ITEM.label : id;
}
