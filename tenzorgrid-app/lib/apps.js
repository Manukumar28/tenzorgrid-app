// The applications the employer provides.
//
// Milestone 02 gave the company a navigation: Home, Inbox, My Work, and the rest. That is
// where you GO. This is what you WORK IN, and the two are not the same thing -- an
// employee navigates their company through the company's menu and does specialised work
// through the tools it hands them. Collapsing the two would have turned the sidebar into
// a tool palette, which is how the twelve-flat-tabs problem started.
//
// Three rules hold this file together:
//
//  1. NOTHING HERE IS A NEW ENGINE. Every application names an existing system by the
//     `tool` kinds it already handles or the destination it already routes to. Analytics
//     Studio is the SQL and Python workbench with a company's name on the door; it does
//     not re-implement a line of it.
//
//  2. NO EMPTY APPS. An application only appears if something real is behind it. There is
//     no Documents entry, because a read-only project brief and an emailed write-up are
//     not a document store, and an app that opens onto nothing costs more trust than it
//     buys. lib/projectdocs.js has kept that same rule for tools since it was written.
//
//  3. NOT EVERY TASK IS TOOL WORK. Judgement, coaching, allocation and sign-off are read
//     and decide -- done at your desk, not in an application. They deliberately map to no
//     app, and the workbench keeps rendering them exactly as it did.
//
// `icon` is a lucide-react name as a string, so this file stays free of frontend imports
// -- the same convention projectdocs.js already uses for its tool registry.

// Applications keyed by id. `capabilities` are the task `tool` kinds an application can
// carry; `tab` is the destination it routes to when it is a place rather than a bench.
const APPS = {
  analytics: {
    id: 'analytics',
    name: 'Analytics Studio',
    shortName: 'Analytics',
    icon: 'Database',
    category: 'analysis',
    description: 'Query the company data estate, explore the schema, and work in SQL or Python.',
    // What it opens onto: a task of one of these kinds, in My Work.
    capabilities: ['sql', 'python'],
    tab: 'tasks',
    // The chrome it wants. Dense and technical.
    character: 'technical',
  },
  bi: {
    id: 'bi',
    name: 'BI Studio',
    shortName: 'BI',
    icon: 'BarChart3',
    category: 'analysis',
    description: 'Turn a result set into something a stakeholder can read and act on.',
    capabilities: ['chart'],
    tab: 'tasks',
    character: 'visual',
  },
  mail: {
    id: 'mail',
    name: 'Mail',
    shortName: 'Mail',
    icon: 'Inbox',
    category: 'communication',
    description: 'Correspondence with colleagues, stakeholders and the company.',
    capabilities: [],
    tab: 'emails',
    character: 'plain',
  },
  calendar: {
    id: 'calendar',
    name: 'Calendar',
    shortName: 'Calendar',
    icon: 'CalendarDays',
    category: 'communication',
    description: 'Deadlines, sign-offs and what landed when.',
    capabilities: [],
    tab: 'calendar',
    character: 'plain',
  },
  people: {
    id: 'people',
    name: 'People',
    shortName: 'People',
    icon: 'Users',
    category: 'company',
    description: 'Your colleagues, what they know, and who reports to you.',
    capabilities: [],
    tab: 'team',
    character: 'plain',
  },
};

// Which applications a role's employer provides.
//
// Today every live role is an analyst, so there is one set. The indirection is the point:
// a Software Engineer's employer hands out a Development Studio and a Cybersecurity
// Analyst's hands out a Security Console, and neither needs the navigation, the shell or
// any component to change -- they need an entry here and an engine behind it. A role with
// no entry gets the communication apps, which every employer has.
const APPS_BY_ROLE = {
  data_analyst: ['analytics', 'bi', 'mail', 'calendar', 'people'],
};
const APPS_DEFAULT = ['mail', 'calendar', 'people'];

function appsForRole(roleKey) {
  return (APPS_BY_ROLE[roleKey] || APPS_DEFAULT).map((id) => APPS[id]).filter(Boolean);
}

// Which application a piece of work belongs in, by the task's own tool kind. Deliberately
// not a guess from the title: the engine already records what a task is made of, and
// reading it here is the difference between "Open in Analytics Studio" being true and
// being a label that is right most of the time.
function appForTool(roleKey, tool) {
  if (!tool) return null;
  return appsForRole(roleKey).find((a) => a.capabilities.includes(tool)) || null;
}

module.exports = { APPS, APPS_BY_ROLE, APPS_DEFAULT, appsForRole, appForTool };
