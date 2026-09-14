// The gate every authored task has to pass before a learner ever sees it.
//
// Three things, and the third is the one that matters: a task whose naive wrong answer
// produces the same rows as the correct one teaches nothing and cannot be graded, because
// the grader compares results.
//
// Runs over every project that claims to be finished, so authoring the next one cannot
// quietly skip the checks the last one had to pass.
process.env.DATA_DIR = process.argv[2];
const path = require('node:path');
const ROOT = require('node:path').join(__dirname, '..');
const aiPath = require.resolve(path.join(ROOT, 'lib/ai.js'));
require.cache[aiPath] = { id: aiPath, filename: aiPath, loaded: true, exports: {
  isAvailable: () => false, callClaude: async () => null, extractJson: () => null } };
const fs = require('node:fs');
const ds = require(path.join(ROOT, 'lib/datasets.js'));
const items = require(path.join(ROOT, 'lib/dayitems.js'));
const runQuery = (sql, key) => {
  const mem = ds.buildDatasetDb(key);
  try { return { rows: mem.prepare(sql).all() }; } finally { mem.close(); }
};

let fails = 0;
const check = (n, c, d) => { if (c) console.log('  PASS  ' + n); else { fails++; console.log('  FAIL  ' + n + (d ? '\n        ' + d : '')); } };

const src = fs.readFileSync(path.join(ROOT, 'lib/workspace.js'), 'utf8');

// Which projects claim to be finished. A project with no activities authored is a stub and
// is gated out of the product elsewhere; it is not held to these rules.
const PROJECTS = [
  { key: 'compensation-review', next: "key: 'headcount-trends'", dataset: 'hr_core' },
  { key: 'headcount-trends', next: "key: 'outage-recovery'", dataset: 'hr_core' },
  { key: 'outage-recovery', next: "key: 'pay-equity-audit'", dataset: 'saas_ops' },
  { key: 'pay-equity-audit', next: '// ---- Senior track', dataset: 'hr_core' },
  { key: 'reliability-review', next: "key: 'account-economics'", dataset: 'saas_ops' },
  { key: 'account-economics', next: "key: 'activation-review'", dataset: 'saas_ops' },
  { key: 'activation-review', next: "key: 'experiment-readout'", dataset: 'product_events' },
  { key: 'experiment-readout', next: '// ---- Team Lead track', dataset: 'product_events' },
  { key: 'trading-review', next: "key: 'margin-review'", dataset: 'retail_sales' },
  { key: 'margin-review', next: "key: 'range-review'", dataset: 'retail_sales' },
  { key: 'range-review', next: "key: 'board-pack'", dataset: 'retail_sales' },
  { key: 'board-pack', next: "key: 'capacity-review'", dataset: 'retail_sales' },
  { key: 'capacity-review', next: "key: 'tooling-review'", dataset: 'analytics_ops' },
  { key: 'tooling-review', next: "key: 'intake-review'", dataset: 'analytics_ops' },
  { key: 'intake-review', next: "key: 'headcount-case'", dataset: 'analytics_ops' },
  // The last project in the catalogue, so the slice runs to the start of TASKS.
  { key: 'headcount-case', next: 'const TASKS', dataset: 'analytics_ops' },
];

function taskKeysFor(p) {
  const body = src.slice(src.indexOf(`key: '${p.key}'`), src.indexOf(p.next));
  const list = body.match(/taskKeys: \[([\s\S]*?)\n      \]/);
  return list ? [...list[1].matchAll(/'([a-z]{2}-\d+)'/g)].map((m) => m[1]) : [];
}

const TASKS_START = src.indexOf('const TASKS = {');
const TASKS_END = src.indexOf('\n};\n', TASKS_START);

function defsFor(keys) {
  const defs = {};
  for (const k of keys) {
    const at = src.indexOf(`  '${k}': {`);
    if (at < 0) { defs[k] = null; continue; }
    // Clamp to the end of the TASKS map. Without this the LAST task in the whole
    // catalogue has no following "\n  '" inside TASKS, so its chunk ran to the end of
    // the file and matched anything later in the module — which handed whichever task
    // happened to be authored last a free pass on every check in this suite.
    let next = src.indexOf("\n  '", at + 6);
    if (next < 0 || next > TASKS_END) next = TASKS_END;
    const chunk = src.slice(at, next);
    defs[k] = {
      day: Number((chunk.match(/\bday: (\d+)/) || [])[1] || 0),
      tool: (chunk.match(/tool: '(\w+)'/) || [])[1] || 'sql',
      sql: (chunk.match(/referenceSql: ['"]([\s\S]*?)['"],\n/) || [])[1] || null,
      hasHint: /hint:/.test(chunk),
      rework: /rework: true/.test(chunk),
      // A query that deliberately returns nothing. An empty result is a finding — the
      // whole point of the band-compliance check — so the task declares it rather than
      // the gate assuming every query must produce rows.
      expectEmpty: /expectEmpty: true/.test(chunk),
    };
  }
  return defs;
}

for (const p of PROJECTS) {
  console.log(`\n================ ${p.key} ================`);
  const keys = taskKeysFor(p);
  const defs = defsFor(keys);

  console.log('1. The project is the shape the spec asks for');
  check('thirty tasks', keys.length === 30, `${keys.length} tasks`);
  check('no duplicates', new Set(keys).size === keys.length);
  check('every key has a definition', keys.every((k) => defs[k]), keys.filter((k) => !defs[k]).join(','));
  if (!keys.every((k) => defs[k])) continue;

  console.log('\n2. Six tasks a day, five days');
  const byDay = {};
  for (const k of keys) byDay[defs[k].day] = (byDay[defs[k].day] || 0) + 1;
  console.log('    ' + Object.entries(byDay).map(([d, n]) => `day ${d}: ${n}`).join('  |  '));
  for (let d = 1; d <= 5; d++) check(`day ${d} has six`, byDay[d] === 6, String(byDay[d]));

  console.log('\n3. The day is not six of the same thing');
  for (let d = 1; d <= 5; d++) {
    const tools = keys.filter((k) => defs[k].day === d).map((k) => defs[k].tool);
    check(`day ${d} mixes at least three kinds of work`, new Set(tools).size >= 3, tools.join(','));
  }

  console.log('\n4. Every reference query runs, and returns something worth looking at');
  let multi = 0, ran = 0;
  for (const k of keys) {
    const d = defs[k];
    if (d.tool !== 'sql' || !d.sql) continue;
    let rows = null, err = null;
    try { rows = runQuery(d.sql, p.dataset).rows; } catch (e) { err = e.message; }
    if (d.expectEmpty) {
      check(`${k} runs and is deliberately empty`, rows && rows.length === 0, err || `${rows ? rows.length : 0} rows`);
      continue;
    }
    check(`${k} runs and returns rows`, rows && rows.length >= 1, err || `${rows ? rows.length : 0} rows`);
    multi += (rows && rows.length > 1) ? 1 : 0;
    ran++;
  }
  check('and almost all of them return a table, not a single figure', multi >= ran - 1, `${multi} of ${ran}`);

  console.log('\n5. The naive wrong answer differs from the correct one');
  // Dropping the current-staff filter is THE mistake these projects are about — in the
  // first because forgetting it is wrong, in the second because applying it where it does
  // not belong is. Either way, if a query gives the same answer with and without it, the
  // task is not testing anything.
  // Two different things, and only one of them is a defect. A task where dropping the
  // population filter changes the answer TEACHES the population rule. A task where it does
  // not is still correct code — the filter belongs there — it just is not what that task
  // is testing. The gate cares that the project contains enough of the first kind, not
  // that every filtered query is one, because the alternative is deleting correct filters
  // to satisfy a test.
  let checked = 0;
  const defensive = [];
  for (const k of keys) {
    const d = defs[k];
    if (d.expectEmpty) continue; // empty either way, so the comparison says nothing
    // Each dataset has its own characteristic population mistake: on hr_core it is
    // forgetting that leavers are not current staff, on saas_ops it is forgetting that one
    // client has already churned. Same check, different filter.
    const filt = p.dataset === 'hr_core'
      ? /WHERE [^)]*exit_year IS NULL/
      : p.dataset === 'product_events'
        ? /WHERE [^)]*email_domain <> 'meridiansystems.com'/
        : p.dataset === 'retail_sales'
          // retail_sales has two characteristic population mistakes, and which one applies
          // depends on the question. Treating the estate as fixed when two stores opened
          // inside the window and one closed; or inner-joining sales to products, which
          // silently deletes every line that never sold. A project is held to whichever it
          // uses, and must exercise it in at least three tasks either way.
          ? /(WHERE [^)]*opened_on <= '2025-07-01' AND st\.closed_on IS NULL)|(LEFT JOIN sales s ON s\.product_id = p\.id)/
          : p.dataset === 'analytics_ops'
            // analytics_ops has three characteristic mistakes and which applies depends on
            // the question. Leaving the manager in a delivery denominator she contributes
            // nothing to; counting somebody who left in January as staff, which they
            // remain in every table that was never told they had gone; or timing work to
            // its first delivery rather than its final close, which flatters by eighteen
            // days exactly the requests that had to be done twice. A project is held to
            // whichever it uses, and must exercise it in at least three tasks.
            ? /((WHERE|AND) [^)]*level <> 'manager')|((WHERE|WHEN) [^)]*left_on IS NULL)|(julianday\(closed_on\))/
            : /WHERE [^)]*status = 'active'/;
    if (d.tool !== 'sql' || !d.sql || !filt.test(d.sql)) continue;
    const naive = d.sql
      .replace(/\s*WHERE e\.exit_year IS NULL AND/, ' WHERE')
      .replace(/\s*WHERE exit_year IS NULL AND/, ' WHERE')
      .replace(/\s*WHERE e\.exit_year IS NULL/, '')
      .replace(/\s*WHERE exit_year IS NULL/, '')
      .replace(/\s*WHERE c\.status = 'active' AND/, ' WHERE')
      .replace(/\s*WHERE i\.resolved_at IS NULL AND c\.status = 'active'/, " WHERE i.resolved_at IS NULL")
      .replace(/\s*WHERE c\.status = 'active'/, '')
      .replace(/\s*WHERE status = 'active'/, '')
      // product_events: the characteristic mistake is leaving Meridian's own staff in a
      // customer metric. They are 5% of users and a quarter of the sessions.
      .replace(/\s*WHERE u\.email_domain <> 'meridiansystems\.com' AND/, ' WHERE')
      .replace(/\s*WHERE u\.email_domain <> 'meridiansystems\.com'/, '')
      .replace(/\s*WHERE st\.opened_on <= '2025-07-01' AND st\.closed_on IS NULL AND/, ' WHERE')
      .replace(/\s*WHERE st\.opened_on <= '2025-07-01' AND st\.closed_on IS NULL/, '')
      // The naive form of a range query is the inner join, which drops the never-sold rows.
      .replace(/LEFT JOIN sales s ON s\.product_id = p\.id/g, 'JOIN sales s ON s.product_id = p.id')
      // analytics_ops: the manager back in the population. Ordered so a WHERE that carries
      // other conditions keeps them, and a WHERE that carries only this one disappears.
      .replace(/\s*WHERE a\.level <> 'manager' AND/g, ' WHERE')
      .replace(/\s*AND a\.level <> 'manager'/g, '')
      .replace(/\s*WHERE a\.level <> 'manager'/g, '')
      .replace(/\s*WHERE level <> 'manager'/g, '')
      // analytics_ops, second form: the January leaver back in the population. She is
      // still in every one of these tables, which is the whole reason the filter exists.
      .replace(/CASE WHEN a\.left_on IS NULL AND /g, 'CASE WHEN ')
      .replace(/CASE WHEN a\.left_on IS NULL THEN 1 ELSE 0 END/g, '1')
      .replace(/\s*WHERE a\.left_on IS NULL AND/g, ' WHERE')
      .replace(/\s*WHERE a\.left_on IS NULL/g, '')
      // analytics_ops, third form: lead time to the first delivery instead of to the
      // final close. Narrow on purpose — retail_sales has a closed_on on stores that this
      // must not touch.
      .replace(/julianday\(closed_on\)/g, 'julianday(delivered_on)');
    let same = null;
    try {
      const a = JSON.stringify(runQuery(d.sql, p.dataset).rows);
      const b = JSON.stringify(runQuery(naive, p.dataset).rows);
      same = a === b;
    } catch (e) { same = 'error: ' + e.message; }
    if (same === false) checked += 1;
    else defensive.push(k);
  }
  if (defensive.length) console.log(`    filter present but not exercised: ${defensive.join(', ')}`);
  check('enough tasks actually depend on the population filter', checked >= 3,
    `${checked} exercised, ${defensive.length} defensive`);

  console.log('\n6. Authoring hygiene');
  check('every task carries a hint', keys.every((k) => defs[k].hasHint || defs[k].tool === 'python'),
    keys.filter((k) => !defs[k].hasHint).join(','));
  check('at least one task is flagged for rework', keys.some((k) => defs[k].rework),
    keys.filter((k) => defs[k].rework).join(','));
  check('Friday has a full six', keys.filter((k) => defs[k].day === 5).length === 6);

  console.log('\n7. The other three currencies');
  const acts = items.activitiesFor(p.key);
  const sits = items.situationsFor(p.key);
  const quiz = items.quizFor(p.key);
  check('ten activities', acts.length === 10, String(acts.length));
  check('ten situations', sits.length === 10, String(sits.length));
  check('one quiz of ten questions', quiz && quiz.questions.length === 10, quiz ? String(quiz.questions.length) : 'none');
  for (let d = 1; d <= 5; d++) {
    check(`day ${d}: two of each`,
      acts.filter((a) => a.day === d).length === 2 && sits.filter((x) => x.day === d).length === 2,
      `${acts.filter((a) => a.day === d).length} activities, ${sits.filter((x) => x.day === d).length} situations`);
  }
  check('some of the mail deserves no reply at all', sits.filter((x) => !x.needsReply).length >= 3,
    String(sits.filter((x) => !x.needsReply).length));
  check('and most of it does', sits.filter((x) => x.needsReply).length >= 5,
    String(sits.filter((x) => x.needsReply).length));
  check('every quiz question has exactly one right answer',
    quiz.questions.every((q) => q.options.filter((o) => o.correct).length === 1));
  check('and explains itself', quiz.questions.every((q) => (q.why || '').length > 40));
  check('every activity closes off somehow', acts.every((a) => a.check && a.check.kind));
  check('every situation that needs a reply says how it is marked',
    sits.filter((x) => x.needsReply).every((x) => Array.isArray(x.markers) && x.markers.length >= 1));
}

console.log(fails ? `\n${fails} FAILURE(S)` : '\nAll content checks passed.');
process.exit(fails ? 1 : 0);
