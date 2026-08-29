// Public-holiday reference data, by region.
//
// Deliberately conservative: this carries only national holidays that are either on a
// fixed date or defined by an exact rule (e.g. "fourth Thursday in November"). Movable
// religious dates that follow a lunar calendar — Diwali, Eid, Holi and so on — are NOT
// guessed here, because printing a wrong date on a learner's calendar is worse than
// printing none. Regional and state-level holidays are likewise out of scope.
//
// The UI says which region is in effect and lets the learner change it, so an incomplete
// list is visible as such rather than passing for a complete one.

const FIXED = {
  IN: [
    ['01-26', 'Republic Day'],
    ['08-15', 'Independence Day'],
    ['10-02', 'Gandhi Jayanti'],
  ],
  US: [
    ['01-01', "New Year's Day"],
    ['06-19', 'Juneteenth'],
    ['07-04', 'Independence Day'],
    ['11-11', 'Veterans Day'],
    ['12-25', 'Christmas Day'],
  ],
  GB: [
    ['01-01', "New Year's Day"],
    ['12-25', 'Christmas Day'],
    ['12-26', 'Boxing Day'],
  ],
};

// nth === -1 means "the last such weekday in the month".
// weekday: 0 = Sunday … 6 = Saturday. month is 1-based.
const RULES = {
  IN: [],
  US: [
    { month: 1, weekday: 1, nth: 3, name: 'Martin Luther King Jr. Day' },
    { month: 2, weekday: 1, nth: 3, name: "Presidents' Day" },
    { month: 5, weekday: 1, nth: -1, name: 'Memorial Day' },
    { month: 9, weekday: 1, nth: 1, name: 'Labor Day' },
    { month: 10, weekday: 1, nth: 2, name: 'Columbus Day' },
    { month: 11, weekday: 4, nth: 4, name: 'Thanksgiving' },
  ],
  GB: [
    { month: 5, weekday: 1, nth: 1, name: 'Early May bank holiday' },
    { month: 5, weekday: 1, nth: -1, name: 'Spring bank holiday' },
    { month: 8, weekday: 1, nth: -1, name: 'Summer bank holiday' },
  ],
};

export const REGIONS = [
  { code: 'IN', label: 'India' },
  { code: 'US', label: 'United States' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'NONE', label: 'No holiday calendar' },
];

function pad(n) { return String(n).padStart(2, '0'); }

// nth occurrence of a weekday in a month, as YYYY-MM-DD.
function nthWeekday(year, month, weekday, nth) {
  if (nth === -1) {
    const last = new Date(Date.UTC(year, month, 0)); // day 0 of next month = last of this
    const shift = (last.getUTCDay() - weekday + 7) % 7;
    return `${year}-${pad(month)}-${pad(last.getUTCDate() - shift)}`;
  }
  const first = new Date(Date.UTC(year, month - 1, 1));
  const shift = (weekday - first.getUTCDay() + 7) % 7;
  return `${year}-${pad(month)}-${pad(1 + shift + (nth - 1) * 7)}`;
}

// Meeus/Jones/Butcher Gregorian Easter algorithm — exact, not an approximation.
function easterSunday(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function offsetDays(date, days) {
  const d = new Date(date.getTime() + days * 86400000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

// All holidays for a region in a given year, as { 'YYYY-MM-DD': name }.
export function holidaysForYear(region, year) {
  if (!region || region === 'NONE' || !FIXED[region]) return {};
  const out = {};
  for (const [md, name] of FIXED[region]) out[`${year}-${md}`] = name;
  for (const r of RULES[region] || []) out[nthWeekday(year, r.month, r.weekday, r.nth)] = r.name;
  if (region === 'GB') {
    const easter = easterSunday(year);
    out[offsetDays(easter, -2)] = 'Good Friday';
    out[offsetDays(easter, 1)] = 'Easter Monday';
  }
  return out;
}

// Maps the browser's IANA timezone to a region. This is what makes the calendar follow
// where the learner actually is: someone signing in from London sees UK bank holidays
// without configuring anything. An unrecognised zone resolves to no holiday calendar
// rather than silently defaulting to one country's holidays.
const ZONE_REGION = [
  [/^Asia\/(Kolkata|Calcutta)$/, 'IN'],
  [/^Europe\/London$/, 'GB'],
  [/^America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Detroit|Indiana|Kentucky|Boise|Juneau)/, 'US'],
  [/^Pacific\/Honolulu$/, 'US'],
];

export function detectRegion() {
  let zone = '';
  try { zone = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch { /* ignore */ }
  for (const [re, code] of ZONE_REGION) if (re.test(zone)) return code;
  return 'NONE';
}

const STORE_KEY = 'tg-holiday-region';

export function loadRegion() {
  try {
    const saved = localStorage.getItem(STORE_KEY);
    if (saved && REGIONS.some((r) => r.code === saved)) return saved;
  } catch { /* storage unavailable */ }
  return detectRegion();
}

export function saveRegion(code) {
  try { localStorage.setItem(STORE_KEY, code); } catch { /* ignore */ }
}
