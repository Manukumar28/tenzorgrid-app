// The fictional employer.
//
// TenzorGrid is the platform. The company a learner works for inside it is the
// experience, and it has to behave like an organisation rather than a skin: it has a
// name, an industry, offices, and a structure that puts the learner somewhere specific
// inside it. "Product & Customer Analytics, Data & Insights" is a different sentence from
// "Data Analyst track, level 2", and it is the sentence a job actually says to you.
//
// Two rules hold this file together:
//
//  1. Nothing here is a UI string. Components read the resolved object; they never know
//     the word "Meridian". Swapping in a second employer is a data change.
//  2. Nothing here is role-specific. The org map is keyed on the business FUNCTION from
//     lib/roles.js, of which there are nineteen, so a Cybersecurity Analyst lands in a
//     Security department and a Financial Analyst lands in Finance without anybody
//     editing a component. Role-specific content stays in the role's own catalogue.

// Where each of the nineteen business functions sits in the org. Division is the big
// block on the org chart, department is who you belong to, team is who you sit with.
//
// These are deliberately ordinary. A believable company does not name its analytics team
// "Team Rocket" -- it names it after the thing it looks at, and the dullness is the point.
const ORG_BY_FUNCTION = {
  'Data & Analytics': { division: 'Data & Insights', department: 'Business Analytics', team: 'Product & Customer Analytics' },
  Technology: { division: 'Engineering', department: 'Platform Engineering', team: 'Core Services' },
  'Business, Product & Project': { division: 'Product', department: 'Product Management', team: 'Growth & Lifecycle' },
  'Risk, Governance & Corporate': { division: 'Corporate', department: 'Risk & Governance', team: 'Controls & Assurance' },
  'Finance & Accounting': { division: 'Finance', department: 'Financial Planning & Analysis', team: 'Commercial Finance' },
  'BFSI Operations': { division: 'Operations', department: 'Banking Operations', team: 'Client Servicing' },
  'Capital Markets & Fund Services': { division: 'Operations', department: 'Fund Services', team: 'Trade & Valuations' },
  'Operations & Supply Chain': { division: 'Operations', department: 'Supply Chain', team: 'Planning & Fulfilment' },
  'Manufacturing, Construction & Facilities': { division: 'Operations', department: 'Production & Facilities', team: 'Site Operations' },
  'Retail, E-commerce & Hospitality': { division: 'Commercial', department: 'Retail & E-commerce', team: 'Trading & Merchandising' },
  'HR & People': { division: 'People', department: 'People Operations', team: 'People Analytics & Reward' },
  'Marketing & Growth': { division: 'Commercial', department: 'Marketing', team: 'Growth & Performance' },
  'Sales & Customer': { division: 'Commercial', department: 'Revenue', team: 'Customer Success' },
  'Healthcare, Life Sciences & Legal': { division: 'Regulated Services', department: 'Clinical & Legal Operations', team: 'Evidence & Review' },
  'Trust, Safety & Content Operations': { division: 'Regulated Services', department: 'Trust & Safety', team: 'Content Operations' },
  'Legal Process & eDiscovery': { division: 'Regulated Services', department: 'Legal Operations', team: 'Discovery & Review' },
  'Sustainability, ESG & Safety': { division: 'Corporate', department: 'Sustainability & Safety', team: 'ESG Reporting' },
  'Education & Development Sector': { division: 'Corporate', department: 'Learning & Development', team: 'Programmes' },
  'Media & Language': { division: 'Commercial', department: 'Content & Localisation', team: 'Editorial' },
};

// The fallback is not a placeholder -- an unmapped function has to produce a sentence a
// learner can read without noticing anything is missing.
const ORG_DEFAULT = { division: 'Operations', department: 'Business Services', team: 'Delivery' };

const COMPANIES = {
  meridian: {
    key: 'meridian',
    name: 'Meridian Analytics',
    shortName: 'Meridian',
    // Two letters on a square. Cheaper than an image, works at any size, and survives a
    // rename because it is derived below rather than typed here.
    industry: 'Technology · Data Intelligence',
    description:
      'Meridian Analytics builds the reporting and decision tooling that mid-market SaaS '
      + 'and retail businesses run on. About 1,400 people across four offices, most of the '
      + 'revenue from subscription platform work, and a data estate big enough that nobody '
      + 'has the whole picture in their head.',
    founded: 2011,
    headcount: 1400,
    headquarters: 'Bengaluru',
    // The first entry is where a new joiner is placed unless something says otherwise.
    locations: [
      { city: 'Bengaluru', country: 'India', label: 'Bengaluru — Embassy Tech Village', primary: true },
      { city: 'Pune', country: 'India', label: 'Pune — Kharadi' },
      { city: 'London', country: 'United Kingdom', label: 'London — Aldgate' },
      { city: 'Singapore', country: 'Singapore', label: 'Singapore — Anson Road' },
    ],
    workArrangement: 'Hybrid — three days in the office',
    workingHours: { start: '09:30', end: '18:00' },
    // Prefix for employee numbers. Derived from the name rather than typed, so a rename
    // cannot leave a company called Northgate issuing MA- numbers.
    employeeIdPrefix: null,
  },
};

const DEFAULT_COMPANY = 'meridian';

function initials(name) {
  return String(name || '')
    .split(/\s+/).filter(Boolean).slice(0, 2)
    .map((w) => w[0].toUpperCase()).join('') || 'CO';
}

function orgUnitFor(businessFunction) {
  return ORG_BY_FUNCTION[businessFunction] || ORG_DEFAULT;
}

// The resolved company. `businessFunction` is the subcategory from lib/roles.js; passing
// it in places the learner inside the org in the same call that names the employer, so a
// caller cannot end up with one and not the other.
function companyFor(businessFunction, companyKey) {
  const c = COMPANIES[companyKey || DEFAULT_COMPANY] || COMPANIES[DEFAULT_COMPANY];
  const primary = c.locations.find((l) => l.primary) || c.locations[0];
  return {
    key: c.key,
    name: c.name,
    shortName: c.shortName,
    mark: initials(c.name),
    industry: c.industry,
    description: c.description,
    founded: c.founded,
    headcount: c.headcount,
    headquarters: c.headquarters,
    locations: c.locations,
    primaryLocation: primary,
    workArrangement: c.workArrangement,
    workingHours: c.workingHours,
    org: orgUnitFor(businessFunction),
  };
}

// A stable employee number. Seeded off the enrolment id so it survives every reload and
// never collides with the learner's own account id, and prefixed from the company name so
// it reads like something payroll issued rather than something a UI generated.
function employeeIdFor(company, seed) {
  const text = String(seed || '');
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  const prefix = company.employeeIdPrefix || initials(company.name);
  return `${prefix}-${1000 + (h % 9000)}`;
}

module.exports = {
  COMPANIES,
  DEFAULT_COMPANY,
  ORG_BY_FUNCTION,
  ORG_DEFAULT,
  orgUnitFor,
  companyFor,
  employeeIdFor,
  initials,
};
