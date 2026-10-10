// Monitor tests (fplgg/tools/monitor/monitor.js): the checks, the two-probe rule, the issue plan. Plain Node.
//   node tests/monitor.js
const M = require(__dirname + '/../fplgg/tools/monitor/monitor.js');
let fails = 0;
const check = (label, cond, info) => { if (!cond) fails++; console.log((cond ? 'PASS ' : 'FAIL ') + label + (info ? '  ' + info : '')); };
const now = Date.parse('2026-10-08T12:30:00Z'), iso = ms => new Date(ms).toISOString(), MIN = 60e3, H = 60 * MIN;
const API = 'https://script.google.com/macros/s/AKfycbTEST/exec';
const goodHealth = (data, more) => ({ ok: true, version: 'v3.17', self: 'current: v3.17 (checked x)', data: Object.assign({ updated: iso(now - 30 * MIN), source: 'refreshAll', ageMin: 30, attempted: iso(now - 30 * MIN), live: false, liveWhy: '', liveSince: null }, data || {}) , ...(more || {}) });
const raw = o => Object.assign({
  app: { status: 200, text: '<html><script src="core.js?v=20261008112958"></script><script src="app.js?v=20261008112958"></script>' },
  specials: { status: 200, text: '"Setting","Value"\n"POTM player","Joao Pedro"\n"API URL","' + API + '"\n' },
  fpl: { status: 200, text: JSON.stringify({ current_event: 6, current_event_finished: false, next_event: 7 }) },
  health: { status: 200, text: JSON.stringify(goodHealth()) } }, o || {});
const by = (r, k) => r.checks.find(c => c.key === k);

/* ---------- the Specials read ---------- */
check('the Specials tab is read with headers=1, as the app reads every tab (a date-typed Value column made gviz take two header rows: Code.gs v3.31)', /\/gviz\/tq\?tqx=out:csv&headers=1&sheet=Specials$/.test(M.SPECIALS_URL) && M.SPECIALS_URL.indexOf('https://docs.google.com/spreadsheets/d/1rIj4A3-lkSfg1rTuAh3yJL-K7LP4EOYkwWZiItZaoHk/') === 0, M.SPECIALS_URL);

/* ---------- assess ---------- */
let r = M.assess(raw(), now);
check('all good: app, sheet, health, data, fpl, selfupdate ok; errors skipped (no count yet)', ['app', 'sheet', 'health', 'data', 'fpl', 'selfupdate'].every(k => by(r, k).ok === true) && by(r, 'errors').ok === null && by(r, 'app').detail === 'build 20261008112958' && r.apiUrl === API, JSON.stringify(r.checks));
check('the order of the checks is fixed', r.checks.map(c => c.key).join() === M.ORDER.join());
r = M.assess(raw({ app: { status: 404, text: 'nope' } }), now);
check('app 404 -> app fails', by(r, 'app').ok === false && /HTTP 404/.test(by(r, 'app').detail));
r = M.assess(raw({ app: { status: 200, text: '<html>classic</html>' } }), now);
check('app 200 without a build stamp -> fails (not the Matchweek app)', by(r, 'app').ok === false && /no build stamp/.test(by(r, 'app').detail));
r = M.assess(raw({ app: { status: 0, error: 'fetch failed: ENOTFOUND' } }), now);
check('app unreachable -> fails with the error', by(r, 'app').ok === false && /ENOTFOUND/.test(by(r, 'app').detail));
r = M.assess(raw({ specials: { status: 200, text: '"Rank","Team","Manager","Grade"\n"1","x","y","A"\n' }, health: null }), now);
check('gviz returning the first sheet (bug #5) -> sheet fails naming the header; health, data, selfupdate, errors skipped', by(r, 'sheet').ok === false && /wrong sheet/.test(by(r, 'sheet').detail) && by(r, 'health').ok === null && by(r, 'data').ok === null && by(r, 'selfupdate').ok === null && by(r, 'errors').ok === null);
r = M.assess(raw({ specials: { status: 200, text: '"Setting","Value"\n"POTM month","August"\n' }, health: null }), now);
check('Specials without an API URL row -> sheet fails', by(r, 'sheet').ok === false && /no API URL/.test(by(r, 'sheet').detail));
r = M.assess(raw({ health: { status: 500, text: 'boom' } }), now);
check('health 500 -> health fails, data and selfupdate skipped', by(r, 'health').ok === false && by(r, 'data').ok === null && by(r, 'selfupdate').ok === null);
r = M.assess(raw({ health: { status: 200, text: '{"ok":false,"error":"x"}' } }), now);
check('health ok:false -> fails', by(r, 'health').ok === false && /not ok/.test(by(r, 'health').detail));
r = M.assess(raw({ health: { status: 200, text: JSON.stringify({ ok: true, version: 'v3.16', self: 'current: v3.16' }) } }), now);
check('a Code.gs without data (before v3.17): data skipped with the version named, selfupdate ok', by(r, 'data').ok === null && /v3\.16/.test(by(r, 'data').detail) && by(r, 'selfupdate').ok === true);
r = M.assess(raw({ health: { status: 200, text: JSON.stringify(goodHealth({ updated: iso(now - 121 * MIN), ageMin: 121 })) } }), now);
check('data 121 minutes old, no match: fails (limit 2 h)', by(r, 'data').ok === false && /2 h 1 min ago \(limit 2 h 0 min; no match live\)/.test(by(r, 'data').detail), by(r, 'data').detail);
r = M.assess(raw({ health: { status: 200, text: JSON.stringify(goodHealth({ updated: iso(now - 119 * MIN) })) } }), now);
check('data 119 minutes old, no match: ok', by(r, 'data').ok === true);
r = M.assess(raw({ health: { status: 200, text: JSON.stringify(goodHealth({ updated: iso(now - 25 * MIN), live: true, liveWhy: 'ARS-CHE 12:30Z', liveSince: iso(now - 40 * MIN) })) } }), now);
check('a match live for 40 minutes, data 25 minutes old: fails (limit 20 min)', by(r, 'data').ok === false && /limit 20 min; a match is live: ARS-CHE/.test(by(r, 'data').detail), by(r, 'data').detail);
r = M.assess(raw({ health: { status: 200, text: JSON.stringify(goodHealth({ updated: iso(now - 25 * MIN), live: true, liveWhy: 'ARS-CHE 12:30Z', liveSince: iso(now - 10 * MIN) })) } }), now);
check('a match live for 10 minutes, data 25 minutes old: ok (the 20-minute rule starts 20 minutes in)', by(r, 'data').ok === true && /just started/.test(by(r, 'data').detail), by(r, 'data').detail);
r = M.assess(raw({ health: { status: 200, text: JSON.stringify(goodHealth({ updated: iso(now - 15 * MIN), live: true, liveWhy: 'ARS-CHE 12:30Z', liveSince: iso(now - 40 * MIN) })) } }), now);
check('a match live for 40 minutes, data 15 minutes old: ok', by(r, 'data').ok === true);
r = M.assess(raw({ health: { status: 200, text: JSON.stringify(goodHealth({ updated: null, source: '', ageMin: null, attempted: iso(now - 50 * MIN) })) } }), now);
check('no successful refresh yet, an attempt 50 minutes ago: skipped (just went live, waiting)', by(r, 'data').ok === null && /waiting/.test(by(r, 'data').detail));
r = M.assess(raw({ health: { status: 200, text: JSON.stringify(goodHealth({ updated: null, source: '', ageMin: null, attempted: iso(now - 3 * H) })) } }), now);
check('no successful refresh, last attempt 3 hours ago: fails', by(r, 'data').ok === false && /no successful refresh recorded; last attempt/.test(by(r, 'data').detail));
r = M.assess(raw({ health: { status: 200, text: JSON.stringify(goodHealth({ updated: null, source: '', ageMin: null, attempted: null })) } }), now);
check('no refresh ever recorded: fails', by(r, 'data').ok === false);
r = M.assess(raw({ fpl: { status: 503, text: '' } }), now);
check('FPL 503 -> fpl fails', by(r, 'fpl').ok === false && /HTTP 503/.test(by(r, 'fpl').detail));
r = M.assess(raw({ fpl: { status: 200, text: '<html>maintenance</html>' } }), now);
check('FPL 200 but not JSON -> fails', by(r, 'fpl').ok === false && /not the game JSON/.test(by(r, 'fpl').detail));
r = M.assess(raw({ health: { status: 200, text: JSON.stringify(goodHealth({}, { self: 'refused: the repo copy has a syntax error: x. Nothing changed.' })) } }), now);
check('self-update refused -> selfupdate fails with the state', by(r, 'selfupdate').ok === false && /refused: the repo copy/.test(by(r, 'selfupdate').detail));
r = M.assess(raw({ health: { status: 200, text: JSON.stringify(goodHealth({}, { self: 'error: writing the new code failed, HTTP 500' })) } }), now);
check('self-update error -> fails', by(r, 'selfupdate').ok === false);
['current: v3.17 (checked x)', 'updated to v3.17 v12 at x', 'drift: edited by hand', 'half: the code is in', 'off: the Apps Script API is not turned on', 'no check yet'].forEach(st => {
  r = M.assess(raw({ health: { status: 200, text: JSON.stringify(goodHealth({}, { self: st })) } }), now);
  check('self-update "' + st.slice(0, 12) + '..." -> not an outage', by(r, 'selfupdate').ok === true);
});
r = M.assess(raw({ health: { status: 200, text: JSON.stringify(goodHealth({}, { errors: { h24: 20, last: { msg: 'TypeError: x is undefined', route: '#/matchday', build: '20261008' } } })) } }), now);
check('20 errors in 24 hours -> errors fails, the latest named', by(r, 'errors').ok === false && /20 errors/.test(by(r, 'errors').detail) && /TypeError/.test(by(r, 'errors').detail));
r = M.assess(raw({ health: { status: 200, text: JSON.stringify(goodHealth({}, { errors: { h24: 3 } })) } }), now);
check('3 errors in 24 hours -> ok', by(r, 'errors').ok === true);

/* ---------- the issue plan ---------- */
let plan = M.diffIssues([], [{ key: 'data', detail: 'stale' }], [{ key: 'app', detail: 'build 1' }], now);
check('no open issues, data confirmed: one create, nothing else', plan.create.length === 1 && plan.create[0].title === 'Outage: the data is stale' && /matchweek-monitor:data -->/.test(plan.create[0].body) && /first seen 2026-10-08T12:30:00Z \(1 check\)/.test(plan.create[0].body) && plan.update.length === 0 && plan.close.length === 0);
const open = [{ number: 7, title: 'Outage: the data is stale', body: plan.create[0].body }, { number: 8, title: 'Outage: the FPL API does not answer', body: M.issueBody('fpl', 'HTTP 503', now - 30 * MIN, null) }, { number: 9, title: 'Unrelated issue by a human', body: 'hello' }];
plan = M.diffIssues(open, [{ key: 'data', detail: 'still stale' }], [{ key: 'fpl', detail: 'current_event 6' }, { key: 'app', detail: 'build 1' }], now + 15 * MIN);
check('an open data issue + data still failing: refreshed (2 checks, first seen kept); fpl recovered: closed with a comment; the human issue untouched', plan.create.length === 0 && plan.update.length === 1 && plan.update[0].number === 7 && /first seen 2026-10-08T12:30:00Z; still failing at 2026-10-08T12:45:00Z \(2 checks\)/.test(plan.update[0].body) &&
  plan.close.length === 1 && plan.close[0].number === 8 && /Recovered at 2026-10-08T12:45:00Z: current_event 6/.test(plan.close[0].comment), JSON.stringify(plan).slice(0, 300));
check('issueKey reads the marker, not the title', M.issueKey(open[1]) === 'fpl' && M.issueKey(open[2]) === '');
const allBodies = Object.keys(M.CHECKS).map(k => M.issueBody(k, 'detail', now, null)).join('\n');
check('issue text: no em or en dashes, no emoji', !/[–—]/.test(allBodies) && !/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(allBodies));

/* ---------- main: the two-probe rule, through injected probes and gh ---------- */
async function run(sequence, openIssues, opts) {
  let i = 0; const calls = [], sleeps = [];
  const fetchText = async url => { const s = sequence[Math.min(i, sequence.length - 1)]; return /app\.js|github\.io|el-matador-tire\/\?/.test(url) ? s.app : /gviz/.test(url) ? s.specials : /premierleague/.test(url) ? s.fpl : s.health; };
  const gh = args => { calls.push(args); if (args[0] === 'issue' && args[1] === 'list') return JSON.stringify(openIssues || []); if (args[1] === 'create') return 'https://github.com/x/y/issues/42\n'; return ''; };
  const res = await M.main(Object.assign({ fetchText, gh, sleep: async ms => { sleeps.push(ms); i++; }, now: () => now, log: () => {} }, opts || {}));
  return { res, calls, sleeps };
}
(async () => {
  let o = await run([raw()], []);
  check('all ok, no open issues: no sleep, the list, the label ensured, nothing else; exit 0', o.res.code === 0 && o.sleeps.length === 0 && o.calls.length === 2 && o.calls[0][1] === 'list' && o.calls[1][0] === 'label' && o.calls[1][2] === 'outage' && !o.calls.some(a => a[0] === 'issue' && a[1] !== 'list'), JSON.stringify(o.calls));
  o = await run([raw({ fpl: { status: 503, text: '' } }), raw()], []);
  check('fpl fails once then passes: a 4-minute second look, no issue (a flap)', o.res.code === 0 && o.sleeps[0] === 4 * MIN && o.res.confirmed.length === 0 && !o.calls.some(a => a[0] === 'issue' && a[1] === 'create'));
  o = await run([raw({ fpl: { status: 503, text: '' } }), raw({ fpl: { status: 0, error: 'timeout' } })], [], { assignee: 'parkerno2' });
  const cr = o.calls.find(a => a[0] === 'issue' && a[1] === 'create');
  check('fpl fails twice: confirmed, one issue created with the label and the assignee', o.res.code === 0 && o.res.confirmed.map(c => c.key).join() === 'fpl' && cr && cr.includes('--label') && cr.includes('outage') && cr.includes('--assignee') && cr.includes('parkerno2') && cr[cr.indexOf('--title') + 1] === 'Outage: the FPL API does not answer', JSON.stringify(cr));
  o = await run([raw({ fpl: { status: 503, text: '' } }), raw({ fpl: { status: 503, text: '' } })], [{ number: 5, title: 'Outage: the FPL API does not answer', body: M.issueBody('fpl', 'HTTP 503', now - H, null) }]);
  const ed = o.calls.find(a => a[0] === 'issue' && a[1] === 'edit');
  check('still failing with its issue open: the issue is refreshed, not duplicated', ed && ed[2] === '5' && !o.calls.some(a => a[1] === 'create' && a[0] === 'issue') && /2 checks/.test(ed[ed.indexOf('--body') + 1]));
  o = await run([raw()], [{ number: 5, title: 'Outage: the FPL API does not answer', body: M.issueBody('fpl', 'HTTP 503', now - H, null) }]);
  const cl = o.calls.find(a => a[0] === 'issue' && a[1] === 'close');
  check('recovered with its issue open: closed with a comment', cl && cl[2] === '5' && /Recovered at/.test(cl[cl.indexOf('--comment') + 1]));
  o = await run([raw({ app: { status: 0, error: 'x' }, specials: { status: 0, error: 'x' }, fpl: { status: 0, error: 'x' }, health: null })], []);
  check('nothing reachable at all: the monitor does not judge (exit 1, no issues)', o.res.code === 1 && !o.calls.some(a => a[0] === 'issue'));
  o = await run([raw({ fpl: { status: 503, text: '' } })], [], { dry: true });
  check('dry run: no gh calls at all', o.calls.length === 0 && o.res.code === 0);
  o = await run([raw({ fpl: { status: 503, text: '' } })], [], { once: true });
  check('--once: a failure counts without the second look', o.sleeps.length === 0 && o.res.confirmed.length === 1);
  o = await run([raw()], [], { gh: () => { throw new Error('gh: HTTP 401'); } });
  check('gh failing: exit 1', o.res.code === 1);
  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})();
