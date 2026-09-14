// Guards the practice datasets themselves.
//
// Every figure in a project brief, rubric or quiz answer is measured against these
// tables. So the tables are a published contract: if a generator changes, the authored
// content that quotes it has to be re-measured, and the way to be told that is for this
// suite to go red. The assertions are therefore exact, on purpose.
const path = require('node:path');
const crypto = require('node:crypto');
const ROOT = require('node:path').join(__dirname, '..');
const ds = require(path.join(ROOT, 'lib/datasets.js'));

let fails = 0;
const check = (n, c, d) => { if (c) console.log('  PASS  ' + n); else { fails++; console.log('  FAIL  ' + n + (d ? '\n        ' + d : '')); } };
const eq = (n, got, want) => check(n, got === want, 'got ' + JSON.stringify(got) + ', want ' + JSON.stringify(want));
const near = (n, got, want, tol) => check(n, Math.abs(got - want) <= tol, 'got ' + got + ', want ' + want + ' +/-' + tol);

const db = ds.buildDatasetDb('product_events');
const one = (sql) => Object.values(db.prepare(sql).get())[0];
const all = (sql) => db.prepare(sql).all();

console.log('\nDeterminism');
const hash = (k) => crypto.createHash('sha256').update(JSON.stringify(ds.dumpDataset(k))).digest('hex');
for (const k of ['hr_core', 'saas_ops', 'product_events', 'retail_sales', 'analytics_ops']) eq(k + ' stable across builds', hash(k), hash(k));
eq('hr_core still 69 employees', ds.describeDataset('hr_core').tables.find((t) => t.name === 'employees').rowCount, 69);
eq('saas_ops still 16 clients', ds.describeDataset('saas_ops').tables.find((t) => t.name === 'clients').rowCount, 16);

console.log('\nproduct_events — size');
eq('users', one('SELECT COUNT(*) FROM users'), 604);
eq('sessions', one('SELECT COUNT(*) FROM sessions'), 4664);
eq('events', one('SELECT COUNT(*) FROM events'), 5646);
eq('assignments', one('SELECT COUNT(*) FROM experiment_assignments'), 307);

console.log('\nproduct_events — referential integrity');
eq('no orphan sessions', one('SELECT COUNT(*) FROM sessions s LEFT JOIN users u ON u.id=s.user_id WHERE u.id IS NULL'), 0);
eq('no orphan events', one('SELECT COUNT(*) FROM events e LEFT JOIN sessions s ON s.id=e.session_id WHERE s.id IS NULL'), 0);
eq('event user matches session user', one('SELECT COUNT(*) FROM events e JOIN sessions s ON s.id=e.session_id WHERE s.user_id<>e.user_id'), 0);
eq('no self-invites', one('SELECT COUNT(*) FROM users WHERE invited_by_user_id=id'), 0);
eq('no invite travels back in time', one('SELECT COUNT(*) FROM users a JOIN users b ON b.id=a.invited_by_user_id WHERE b.signup_at>=a.signup_at'), 0);
eq('no session before its signup', one("SELECT COUNT(*) FROM sessions s JOIN users u ON u.id=s.user_id WHERE substr(s.started_at,1,10)<substr(u.signup_at,1,10)"), 0);
eq('no session past the export date', one("SELECT COUNT(*) FROM sessions WHERE started_at>'2026-06-13'"), 0);
eq('no event before its session', one('SELECT COUNT(*) FROM events e JOIN sessions s ON s.id=e.session_id WHERE e.occurred_at<s.started_at'), 0);
eq('no event after its session ends', one('SELECT COUNT(*) FROM events e JOIN sessions s ON s.id=e.session_id WHERE julianday(e.occurred_at)>julianday(s.started_at)+(s.duration_seconds+15)/86400.0'), 0);
eq('no event in a zero-duration session', one('SELECT COUNT(*) FROM events e JOIN sessions s ON s.id=e.session_id WHERE s.duration_seconds=0'), 0);
eq('every user has a signup event', one("SELECT COUNT(*) FROM users u WHERE NOT EXISTS (SELECT 1 FROM events e WHERE e.user_id=u.id AND e.name='signup_completed')"), 0);
eq('activation implies data_connected', one("SELECT COUNT(*) FROM (SELECT user_id FROM events WHERE name='first_report_run' EXCEPT SELECT user_id FROM events WHERE name='data_connected')"), 0);
eq('one assignment per user', one('SELECT COUNT(*) FROM (SELECT user_id FROM experiment_assignments GROUP BY user_id HAVING COUNT(*)>1)'), 0);
eq('nobody assigned before signing up', one('SELECT COUNT(*) FROM experiment_assignments a JOIN users u ON u.id=a.user_id WHERE a.assigned_at<u.signup_at'), 0);
eq('assignment window respected', one("SELECT COUNT(*) FROM experiment_assignments a JOIN users u ON u.id=a.user_id WHERE substr(u.signup_at,1,10)<'2026-03-01' OR substr(u.signup_at,1,10)>='2026-05-16'"), 0);

console.log('\nQuirk 1 — internal staff distort everything');
eq('staff users', one("SELECT COUNT(*) FROM users WHERE email_domain='meridiansystems.com'"), 31);
const perUser = (dom) => one(`SELECT ROUND(1.0*COUNT(s.id)/COUNT(DISTINCT u.id),2) FROM users u LEFT JOIN sessions s ON s.user_id=u.id WHERE u.email_domain ${dom} 'meridiansystems.com'`);
check('staff use it far more than customers', perUser('=') > perUser('<>') * 4, 'staff ' + perUser('=') + ' vs customers ' + perUser('<>'));
check('staff are a quarter of all sessions', one("SELECT ROUND(100.0*SUM(CASE WHEN u.email_domain='meridiansystems.com' THEN 1 ELSE 0 END)/COUNT(*),1) FROM sessions s JOIN users u ON u.id=s.user_id") > 20);

console.log('\nQuirk 2 — the funnel step that exceeds 100%');
const step = (name) => one(`SELECT COUNT(DISTINCT user_id) FROM events WHERE name='${name}'`);
check('data_connected exceeds workspace_created', step('data_connected') > step('workspace_created'),
  step('data_connected') + ' vs ' + step('workspace_created'));
eq('no invitee ever creates a workspace', one("SELECT COUNT(DISTINCT u.id) FROM users u JOIN events e ON e.user_id=u.id AND e.name='workspace_created' WHERE u.invited_by_user_id IS NOT NULL"), 0);
check('invitees are about a third of signups', Math.abs(one('SELECT ROUND(100.0*SUM(CASE WHEN invited_by_user_id IS NOT NULL THEN 1 ELSE 0 END)/COUNT(*),1) FROM users') - 30) < 6);

console.log('\nQuirk 3 — zero-duration sessions hide the real story');
const zeroPct = (p) => one(`SELECT ROUND(100.0*SUM(CASE WHEN duration_seconds=0 THEN 1 ELSE 0 END)/COUNT(*),1) FROM sessions WHERE platform ${p}`);
check('mobile bounces far more than web', zeroPct("<> 'web'") > zeroPct("= 'web'") * 1.8, zeroPct("<> 'web'") + '% vs ' + zeroPct("= 'web'") + '%');
const avg = (p, f) => one(`SELECT ROUND(AVG(duration_seconds),1) FROM sessions WHERE platform ${p} ${f}`);
check('with zeros in, mobile looks much worse', avg("<> 'web'", '') < avg("= 'web'", '') * 0.9);
check('with zeros out, mobile and web are within 20 seconds',
  Math.abs(avg("<> 'web'", 'AND duration_seconds>0') - avg("= 'web'", 'AND duration_seconds>0')) < 20,
  avg("<> 'web'", 'AND duration_seconds>0') + ' vs ' + avg("= 'web'", 'AND duration_seconds>0'));

console.log('\nQuirk 4 — mobile 4.3.0 double-fires every funnel step');
const FUNNEL = "('signup_completed','workspace_created','data_connected','first_report_run','invited_teammate')";
for (const r of all(`SELECT s.platform, s.app_version, ROUND(1.0*COUNT(*)/COUNT(DISTINCT e.user_id||'|'||e.name),2) ratio
    FROM events e JOIN sessions s ON s.id=e.session_id WHERE e.name IN ${FUNNEL}
    GROUP BY s.platform, s.app_version`)) {
  const buggy = r.platform !== 'web' && r.app_version === '4.3.0';
  eq(`${r.platform} ${r.app_version} rows per step`, r.ratio, buggy ? 2 : 1);
}
check('signup_completed has more rows than users', one("SELECT COUNT(*) FROM events WHERE name='signup_completed'") > 604);

console.log('\nQuirk 5 — June is twelve days, not a collapse');
const jun = all("SELECT COUNT(*) n FROM users WHERE substr(signup_at,1,7)='2026-06'")[0].n;
const may = all("SELECT COUNT(*) n FROM users WHERE substr(signup_at,1,7)='2026-05'")[0].n;
check('June looks like a cliff on raw counts', jun < may * 0.4, jun + ' vs ' + may);
check('but the daily rate barely moves', Math.abs(jun / 12 - may / 31) < 0.8, (jun / 12).toFixed(2) + '/day vs ' + (may / 31).toFixed(2) + '/day');
eq('nothing signs up after the 12th', one("SELECT COUNT(*) FROM users WHERE substr(signup_at,1,10)>'2026-06-12'"), 0);

console.log("\nQuirk 6 — Simpson's paradox in onboarding_v2");
for (const excl of ['', "AND u.email_domain<>'meridiansystems.com'"]) {
  const label = excl ? 'excl staff' : 'all users';
  const rate = (where) => one(`SELECT ROUND(100.0*AVG(CASE WHEN EXISTS (SELECT 1 FROM events e WHERE e.user_id=u.id AND e.name='first_report_run') THEN 1.0 ELSE 0.0 END),1)
    FROM experiment_assignments a JOIN users u ON u.id=a.user_id WHERE ${where} ${excl}`);
  const webC = rate("u.primary_platform='web' AND a.variant='control'");
  const webT = rate("u.primary_platform='web' AND a.variant='treatment'");
  const mobC = rate("u.primary_platform<>'web' AND a.variant='control'");
  const mobT = rate("u.primary_platform<>'web' AND a.variant='treatment'");
  const allC = rate("a.variant='control'");
  const allT = rate("a.variant='treatment'");
  check(`[${label}] treatment wins on web`, webT > webC + 5, webT + ' vs ' + webC);
  check(`[${label}] treatment wins on mobile`, mobT > mobC + 5, mobT + ' vs ' + mobC);
  check(`[${label}] treatment loses overall`, allT < allC - 5, allT + ' vs ' + allC);
}
const skew = (v) => one(`SELECT ROUND(100.0*AVG(CASE WHEN u.primary_platform<>'web' THEN 1.0 ELSE 0.0 END),1)
  FROM experiment_assignments a JOIN users u ON u.id=a.user_id WHERE a.variant='${v}'`);
check('the arms are badly skewed by platform', skew('treatment') > skew('control') * 2, skew('treatment') + '% vs ' + skew('control') + '% mobile');

console.log('\nFindings the projects will be built on');
const actBy = (p) => one(`SELECT ROUND(100.0*AVG(CASE WHEN EXISTS (SELECT 1 FROM events e WHERE e.user_id=u.id AND e.name='first_report_run') THEN 1.0 ELSE 0.0 END),1)
  FROM users u WHERE u.email_domain<>'meridiansystems.com' AND u.primary_platform ${p}`);
check('web activates far better than mobile', actBy("='web'") > actBy("<>'web'") * 2, actBy("='web'") + '% vs ' + actBy("<>'web'") + '%');
const ret4 = (ch) => one(`SELECT ROUND(100.0*AVG(CASE WHEN EXISTS (SELECT 1 FROM sessions s WHERE s.user_id=u.id
    AND julianday(s.started_at)-julianday(substr(u.signup_at,1,10))>=28
    AND julianday(s.started_at)-julianday(substr(u.signup_at,1,10))<35) THEN 1.0 ELSE 0.0 END),1)
  FROM users u WHERE u.email_domain<>'meridiansystems.com' AND substr(u.signup_at,1,7)<='2026-04' AND u.channel='${ch}'`);
check('referral retains far better than paid_search', ret4('referral') > ret4('paid_search') * 2, ret4('referral') + '% vs ' + ret4('paid_search') + '%');
const w4 = (m) => one(`SELECT ROUND(100.0*AVG(CASE WHEN EXISTS (SELECT 1 FROM sessions s WHERE s.user_id=u.id
    AND julianday(s.started_at)-julianday(substr(u.signup_at,1,10))>=28
    AND julianday(s.started_at)-julianday(substr(u.signup_at,1,10))<35) THEN 1.0 ELSE 0.0 END),1)
  FROM users u WHERE u.email_domain<>'meridiansystems.com' AND substr(u.signup_at,1,7)='${m}'`);
check('late cohorts are censored, not collapsing', w4('2026-06') === 0 && w4('2026-05') < w4('2026-03') * 0.6,
  'Mar ' + w4('2026-03') + '%, May ' + w4('2026-05') + '%, Jun ' + w4('2026-06') + '%');

// ---------------------------------------------------------------------------
// retail_sales
// ---------------------------------------------------------------------------
const rdb = ds.buildDatasetDb('retail_sales');
const r1 = (sql) => Object.values(rdb.prepare(sql).get())[0];
const rall = (sql) => rdb.prepare(sql).all();

console.log('\nretail_sales — size and integrity');
eq('stores', r1('SELECT COUNT(*) FROM stores'), 13);
eq('products', r1('SELECT COUNT(*) FROM products'), 68);
eq('sales lines', r1('SELECT COUNT(*) FROM sales'), 9022);
eq('stock counts', r1('SELECT COUNT(*) FROM stock_counts'), 2214);
eq('no orphan sales store', r1('SELECT COUNT(*) FROM sales s LEFT JOIN stores t ON t.id=s.store_id WHERE t.id IS NULL'), 0);
eq('no orphan sales product', r1('SELECT COUNT(*) FROM sales s LEFT JOIN products p ON p.id=s.product_id WHERE p.id IS NULL'), 0);
eq('no sale before its store opened', r1('SELECT COUNT(*) FROM sales s JOIN stores t ON t.id=s.store_id WHERE s.sold_at < t.opened_on'), 0);
eq('no sale after its store closed', r1('SELECT COUNT(*) FROM sales s JOIN stores t ON t.id=s.store_id WHERE t.closed_on IS NOT NULL AND s.sold_at > t.closed_on'), 0);
eq('no sale outside the reporting window', r1("SELECT COUNT(*) FROM sales WHERE sold_at < '2025-07-01' OR sold_at > '2026-06-30'"), 0);
eq('no zero-quantity lines', r1('SELECT COUNT(*) FROM sales WHERE quantity = 0'), 0);
eq('reprice fields agree with each other', r1('SELECT COUNT(*) FROM products WHERE (cost_changed_on IS NULL) <> (previous_unit_cost IS NULL)'), 0);
eq('every list price is above cost', r1('SELECT COUNT(*) FROM products WHERE list_price <= unit_cost'), 0);

console.log('\nQuirk R1 — returns are negative rows on the same table');
const ret = rall("SELECT CASE WHEN quantity<0 THEN 'return' ELSE 'sale' END k, COUNT(*) lines, SUM(quantity) units FROM sales GROUP BY k");
check('returns exist', ret.some((x) => x.k === 'return' && x.lines > 300), JSON.stringify(ret));
check('returns carry negative units', ret.find((x) => x.k === 'return').units < 0);
const gross = r1('SELECT SUM(CASE WHEN quantity>0 THEN quantity*unit_price ELSE 0 END) FROM sales');
const net = r1('SELECT SUM(quantity*unit_price) FROM sales');
check('gross and net revenue differ by a few percent', gross > net && (gross - net) / gross > 0.02 && (gross - net) / gross < 0.06,
  `gross ${gross}, net ${net}`);

console.log('\nQuirk R2 — the estate changed mid-year');
eq('two stores opened inside the window', r1("SELECT COUNT(*) FROM stores WHERE opened_on > '2025-07-01'"), 2);
eq('one store closed inside it', r1('SELECT COUNT(*) FROM stores WHERE closed_on IS NOT NULL'), 1);
const rawRank = rall('SELECT s.name, SUM(sl.quantity*sl.unit_price) rev FROM sales sl JOIN stores s ON s.id=sl.store_id GROUP BY s.name ORDER BY rev DESC').map((r) => r.name);
const dayRank = rall('SELECT s.name, SUM(sl.quantity*sl.unit_price)*1.0/COUNT(DISTINCT sl.sold_at) pd FROM sales sl JOIN stores s ON s.id=sl.store_id GROUP BY s.name ORDER BY pd DESC').map((r) => r.name);
check('the two rankings are not the same', JSON.stringify(rawRank) !== JSON.stringify(dayRank));
check('a part-year store moves when normalised', Math.abs(rawRank.indexOf('Salt Lake') - dayRank.indexOf('Salt Lake')) >= 2,
  `raw ${rawRank.indexOf('Salt Lake')}, per-day ${dayRank.indexOf('Salt Lake')}`);

console.log('\nQuirk R3 — one store-month was loaded twice');
const dupRows = rall(`SELECT store_id, substr(sold_at,1,7) month, COUNT(*) groups FROM
  (SELECT store_id, product_id, sold_at, quantity, unit_price, COUNT(*) c FROM sales
   GROUP BY store_id, product_id, sold_at, quantity, unit_price HAVING c > 1)
  GROUP BY store_id, month ORDER BY groups DESC`);
check('exactly one store-month stands out', dupRows[0].groups > 20 && dupRows[1].groups < 5,
  JSON.stringify(dupRows.slice(0, 3)));
eq('and it is Ashok Nagar in March', dupRows[0].store_id + ' ' + dupRows[0].month, '3 2026-03');
const marchLines = r1("SELECT COUNT(*) FROM sales WHERE store_id=3 AND substr(sold_at,1,7)='2026-03'");
const marchDup = r1(`SELECT SUM(c) FROM (SELECT COUNT(*) c FROM sales WHERE store_id=3 AND substr(sold_at,1,7)='2026-03'
  GROUP BY product_id, sold_at, quantity, unit_price HAVING c>1)`);
eq('every line in that month is duplicated', marchDup, marchLines);

console.log('\nQuirk R4 — unit_cost is today, not the day of sale');
eq('repriced products', r1('SELECT COUNT(*) FROM products WHERE cost_changed_on IS NOT NULL'), 15);
check('every reprice was upward', r1('SELECT COUNT(*) FROM products WHERE previous_unit_cost IS NOT NULL AND previous_unit_cost >= unit_cost') === 0);
const mNaive = r1('SELECT SUM(sl.quantity*(sl.unit_price - p.unit_cost)) FROM sales sl JOIN products p ON p.id=sl.product_id');
const mReal = r1(`SELECT SUM(sl.quantity*(sl.unit_price - CASE WHEN p.cost_changed_on IS NOT NULL AND sl.sold_at < p.cost_changed_on
  THEN p.previous_unit_cost ELSE p.unit_cost END)) FROM sales sl JOIN products p ON p.id=sl.product_id`);
check('using current cost understates margin by 3-6%', mReal > mNaive && (mReal - mNaive) / mReal > 0.03 && (mReal - mNaive) / mReal < 0.06,
  `naive ${Math.round(mNaive)}, correct ${Math.round(mReal)}`);

console.log('\nQuirk R5 — the promotion month');
const months = rall(`SELECT substr(sl.sold_at,1,7) month, SUM(sl.quantity*sl.unit_price) revenue,
  SUM(sl.quantity*(sl.unit_price - CASE WHEN p.cost_changed_on IS NOT NULL AND sl.sold_at < p.cost_changed_on
    THEN p.previous_unit_cost ELSE p.unit_cost END)) margin, AVG(sl.discount_pct) disc
  FROM sales sl JOIN products p ON p.id=sl.product_id GROUP BY month`);
const byRev = [...months].sort((a, b) => b.revenue - a.revenue);
const byRate = [...months].sort((a, b) => (a.margin / a.revenue) - (b.margin / b.revenue));
eq('the best revenue month is November', byRev[0].month, '2025-11');
eq('and it is the worst month on margin rate', byRate[0].month, '2025-11');
check('its discount is several times normal', byRev[0].disc > 12, String(Math.round(byRev[0].disc * 10) / 10));
const others = months.filter((m) => m.month !== '2025-11');
const avgRev = others.reduce((s, m) => s + m.revenue, 0) / others.length;
const avgMar = others.reduce((s, m) => s + m.margin, 0) / others.length;
check('revenue up far more than margin', (byRev[0].revenue / avgRev - 1) > 2 * (byRev[0].margin / avgMar - 1),
  `revenue +${Math.round((byRev[0].revenue / avgRev - 1) * 100)}%, margin +${Math.round((byRev[0].margin / avgMar - 1) * 100)}%`);

console.log('\nQuirk R6 — products that never sold');
eq('seven products never sold', r1('SELECT COUNT(*) FROM products p WHERE NOT EXISTS (SELECT 1 FROM sales s WHERE s.product_id=p.id)'), 7);
const cats = rall(`SELECT p.category, COUNT(DISTINCT p.id) in_range, COUNT(DISTINCT s.product_id) sold
  FROM products p LEFT JOIN sales s ON s.product_id=p.id GROUP BY p.category`);
check('an inner join would drop products from several categories', cats.filter((c) => c.in_range > c.sold).length >= 2,
  JSON.stringify(cats));

rdb.close();

// analytics_ops
// ---------------------------------------------------------------------------
// The Manager track's dataset, and the one where a wrong figure lands on a named
// colleague rather than on a range decision. Every assertion here is quoted somewhere in
// the Demand & Capacity Review — the coverage, the two rates, the person-year gap — so a
// generator change that moves any of them has to move the authored content with it.
const adb = ds.buildDatasetDb('analytics_ops');
const a1 = (sql) => Object.values(adb.prepare(sql).get())[0];

const DAYS_PRESENT = "CAST(julianday(MIN(COALESCE(a.left_on, '2026-06-30'), '2026-06-30')) - julianday(MAX(a.started_on, '2025-07-01')) + 1 AS INTEGER)";

console.log('\nanalytics_ops — size and integrity');
eq('analysts', a1('SELECT COUNT(*) FROM analysts'), 14);
eq('requests', a1('SELECT COUNT(*) FROM requests'), 384);
eq('time logs', a1('SELECT COUNT(*) FROM time_logs'), 1226);
eq('licences', a1('SELECT COUNT(*) FROM licences'), 6);
eq('licence assignments', a1('SELECT COUNT(*) FROM licence_assignments'), 68);
eq('exactly one manager', a1("SELECT COUNT(*) FROM analysts WHERE level = 'manager'"), 1);
eq('no orphan time log analyst', a1('SELECT COUNT(*) FROM time_logs t LEFT JOIN analysts a ON a.id=t.analyst_id WHERE a.id IS NULL'), 0);
eq('no orphan time log request', a1('SELECT COUNT(*) FROM time_logs t LEFT JOIN requests r ON r.id=t.request_id WHERE r.id IS NULL'), 0);
eq('no orphan assignment', a1('SELECT COUNT(*) FROM licence_assignments la LEFT JOIN licences l ON l.id=la.licence_id WHERE l.id IS NULL'), 0);
eq('no hours logged before the analyst joined', a1('SELECT COUNT(*) FROM time_logs t JOIN analysts a ON a.id=t.analyst_id WHERE t.logged_on < a.started_on'), 0);
eq('no hours logged after the analyst left', a1('SELECT COUNT(*) FROM time_logs t JOIN analysts a ON a.id=t.analyst_id WHERE a.left_on IS NOT NULL AND t.logged_on > a.left_on'), 0);
eq('no log outside the reporting window', a1("SELECT COUNT(*) FROM time_logs WHERE logged_on < '2025-07-01' OR logged_on > '2026-06-30'"), 0);
eq('nothing delivered before it was requested', a1('SELECT COUNT(*) FROM requests WHERE delivered_on IS NOT NULL AND delivered_on < requested_on'), 0);
eq('nothing closed before it was delivered', a1('SELECT COUNT(*) FROM requests WHERE closed_on IS NOT NULL AND delivered_on IS NOT NULL AND closed_on < delivered_on'), 0);
eq('every delivered request has a delivery date', a1("SELECT COUNT(*) FROM requests WHERE status = 'delivered' AND delivered_on IS NULL"), 0);
eq('nothing queued has been started', a1("SELECT COUNT(*) FROM requests WHERE status = 'queued' AND started_on IS NOT NULL"), 0);

console.log('\nQuirk A1 — self-reported time covers an eighth of the paid hours');
near('logged hours', a1('SELECT SUM(hours) FROM time_logs'), 3193, 0.5);
near('capacity hours below manager level',
  a1(`SELECT SUM(${DAYS_PRESENT}) * 5.0 / 7 * 8 FROM analysts a WHERE a.level <> 'manager'`), 24857, 1);
near('coverage is 12.8%',
  a1(`SELECT (SELECT SUM(hours) FROM time_logs) * 100.0 / (SELECT SUM(${DAYS_PRESENT}) * 5.0 / 7 * 8 FROM analysts a WHERE a.level <> 'manager')`), 12.8, 0.05);
near('best day-logging coverage is 49.1%',
  a1(`SELECT MAX(pct) FROM (SELECT COUNT(DISTINCT t.logged_on) * 100.0 / (${DAYS_PRESENT} * 5.0 / 7) AS pct FROM analysts a LEFT JOIN time_logs t ON t.analyst_id = a.id WHERE a.level <> 'manager' GROUP BY a.id)`), 49.1, 0.05);
near('worst day-logging coverage is 19.2%',
  a1(`SELECT MIN(pct) FROM (SELECT COUNT(DISTINCT t.logged_on) * 100.0 / (${DAYS_PRESENT} * 5.0 / 7) AS pct FROM analysts a LEFT JOIN time_logs t ON t.analyst_id = a.id WHERE a.level <> 'manager' GROUP BY a.id)`), 19.2, 0.05);
check('nobody logs even half their working days',
  a1(`SELECT MAX(pct) FROM (SELECT COUNT(DISTINCT t.logged_on) * 100.0 / (${DAYS_PRESENT} * 5.0 / 7) AS pct FROM analysts a LEFT JOIN time_logs t ON t.analyst_id = a.id WHERE a.level <> 'manager' GROUP BY a.id)`) < 50);

console.log('\nQuirk A1b — the two rates, eight times apart');
near('annual cost', a1(`SELECT SUM(a.day_rate * ${DAYS_PRESENT} * 5.0 / 7) FROM analysts a`), 30857857, 1);
near('cost per logged hour is about 9,664',
  a1(`SELECT (SELECT SUM(a.day_rate * ${DAYS_PRESENT} * 5.0 / 7) FROM analysts a) / (SELECT SUM(hours) FROM time_logs)`), 9664, 1);
near('cost per capacity hour is about 1,241',
  a1(`SELECT (SELECT SUM(a.day_rate * ${DAYS_PRESENT} * 5.0 / 7) FROM analysts a) / (SELECT SUM(${DAYS_PRESENT}) * 5.0 / 7 * 8 FROM analysts a WHERE a.level <> 'manager')`), 1241, 1);

console.log('\nQuirk A2 — headcount is not capacity');
eq('thirteen below manager level', a1("SELECT COUNT(*) FROM analysts WHERE level <> 'manager'"), 13);
near('but only 11.92 person-years present',
  a1(`SELECT SUM(${DAYS_PRESENT}) / 365.0 FROM analysts a WHERE a.level <> 'manager'`), 11.92, 0.005);
eq('one leaver inside the window', a1("SELECT COUNT(*) FROM analysts WHERE left_on IS NOT NULL"), 1);
eq('one joiner inside the window', a1("SELECT COUNT(*) FROM analysts WHERE started_on > '2025-07-01'"), 1);

console.log('\nQuirk A3 — cancelled work still carries hours');
eq('cancelled requests', a1("SELECT COUNT(*) FROM requests WHERE status = 'cancelled'"), 46);
near('hours logged against them', a1("SELECT SUM(t.hours) FROM time_logs t JOIN requests r ON r.id=t.request_id WHERE r.status = 'cancelled'"), 485, 0.5);
near('which is 15.2% of all logged effort',
  a1("SELECT (SELECT SUM(t.hours) FROM time_logs t JOIN requests r ON r.id=t.request_id WHERE r.status = 'cancelled') * 100.0 / (SELECT SUM(hours) FROM time_logs)"), 15.2, 0.05);
eq('delivered requests', a1("SELECT COUNT(*) FROM requests WHERE status = 'delivered'"), 263);
eq('nothing queued has hours against it',
  a1("SELECT COUNT(*) FROM time_logs t JOIN requests r ON r.id=t.request_id WHERE r.status = 'queued'"), 0);

console.log('\nQuirk A4 — two functions ask in opposite shapes');
const shapes = adb.prepare("SELECT r.requested_by, COUNT(DISTINCT r.id) AS n, COALESCE(SUM(t.hours), 0) AS hours FROM requests r LEFT JOIN time_logs t ON t.request_id = r.id GROUP BY r.requested_by").all();
const byCount = [...shapes].sort((x, y) => y.n - x.n)[0];
const byHours = [...shapes].sort((x, y) => y.hours - x.hours)[0];
check('ranking by count and by hours give different winners', byCount.requested_by !== byHours.requested_by,
  byCount.requested_by + ' by count, ' + byHours.requested_by + ' by hours');
eq('and the one that asks most often is Finance', byCount.requested_by, 'Finance');

console.log('\nQuirk A6 — seats, assignments and active users are three numbers');
const seats = adb.prepare('SELECT l.tool, l.seats, COUNT(la.id) AS assigned, SUM(CASE WHEN la.last_used_on >= \'2026-04-01\' THEN 1 ELSE 0 END) AS recent FROM licences l LEFT JOIN licence_assignments la ON la.licence_id = l.id GROUP BY l.id').all();
check('at least one tool has more seats than assignments', seats.some((t) => t.seats > t.assigned), JSON.stringify(seats));
check('at least one tool has assignments nobody has touched lately', seats.some((t) => t.assigned > 0 && t.recent < t.assigned), JSON.stringify(seats));

adb.close();

console.log('\nSchema browser agrees with the data');
for (const key of ['product_events', 'retail_sales', 'analytics_ops']) {
const desc = ds.describeDataset(key);
const dump = ds.dumpDataset(key);
for (const t of desc.tables) {
  eq(t.name + ' row count matches the dump', t.rowCount, dump[t.name].length);
  const cols = Object.keys(dump[t.name][0]).sort().join(',');
  eq(t.name + ' columns match the dump', t.columns.map((c) => c.name).sort().join(','), cols);
}
}

db.close();
console.log(fails ? `\n${fails} FAILED` : '\nall green');
process.exit(fails ? 1 : 0);
