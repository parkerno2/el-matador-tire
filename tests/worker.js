// matchweek.gg Worker tests (site/worker.mjs): the cron ticks start the right GitHub workflow with the token, do
// nothing without it, and requests go to the static assets. Plain Node.   node tests/worker.js
let fails = 0;
const check = (label, cond, info) => { if (!cond) fails++; console.log((cond ? 'PASS ' : 'FAIL ') + label + (info ? '  ' + info : '')); };
(async () => {
  const W = await import('../site/worker.mjs');
  const calls = [], logs = [], origLog = console.log;
  const fetchFn = async (url, o) => { calls.push({ url, o }); return { status: 204 }; };
  let r = await W.dispatch({ GITHUB_TOKEN: 'ghp_test' }, 'monitor.yml', fetchFn);
  const c = calls[0];
  check('dispatch posts workflow_dispatch for the workflow on main with the token, the API version and a user agent', r.ok && r.status === 204 && c.url === 'https://api.github.com/repos/parkerno2/el-matador-tire/actions/workflows/monitor.yml/dispatches' && c.o.method === 'POST' &&
    c.o.headers.authorization === 'Bearer ghp_test' && c.o.headers.accept === 'application/vnd.github+json' && c.o.headers['x-github-api-version'] === '2022-11-28' && /matchweek/.test(c.o.headers['user-agent']) && c.o.body === '{"ref":"main"}', JSON.stringify(c));
  r = await W.dispatch({}, 'monitor.yml', fetchFn);
  check('no token: skipped, nothing called', r.ok === false && /no GITHUB_TOKEN/.test(r.skipped) && calls.length === 1);
  r = await W.dispatch({ GITHUB_TOKEN: 't' }, 'facts.yml', async () => ({ status: 401 }));
  check('a refused token: ok false with the status, nothing thrown', r.ok === false && r.status === 401 && r.workflow === 'facts.yml');
  r = await W.dispatch({ GITHUB_TOKEN: 't' }, 'facts.yml', async () => { throw new Error('network down'); });
  check('fetch throwing: caught', r.ok === false && /network down/.test(r.error));
  /* the scheduled handler picks the workflow by cron */
  console.log = m => logs.push(String(m));
  globalThis.fetch = fetchFn;
  await W.default.scheduled({ cron: '*/15 * * * *' }, { GITHUB_TOKEN: 't' }, {});
  await W.default.scheduled({ cron: '23 */3 * * *' }, { GITHUB_TOKEN: 't' }, {});
  await W.default.scheduled({ cron: '0 0 1 1 *' }, { GITHUB_TOKEN: 't' }, {});
  await W.default.scheduled({ cron: '*/15 * * * *' }, {}, {});
  console.log = origLog;
  check('every 15 minutes: the Monitor; minute 23 every 3 hours: the Facts bot; an unknown cron: nothing; no token: a logged no-op', calls.length === 3 && /monitor\.yml/.test(calls[1].url) && /facts\.yml/.test(calls[2].url) &&
    logs.length === 4 && /no workflow for this cron/.test(logs[2]) && /no GITHUB_TOKEN/.test(logs[3]) && !/ghp_|Bearer/.test(logs.join(' ')), logs.join(' | '));
  check('the crons in wrangler.jsonc are the ones the Worker knows', (() => { const j = require('fs').readFileSync(__dirname + '/../site/wrangler.jsonc', 'utf8'); return Object.keys(W.JOBS).every(cr => j.includes('"' + cr + '"')) && /"main": "worker\.mjs"/.test(j) && /"binding": "ASSETS"/.test(j); })());
  /* requests: straight to the assets */
  let served = null;
  const res = await W.default.fetch({ url: 'https://matchweek.gg/status' }, { ASSETS: { fetch: async req => { served = req; return { status: 200 }; } } });
  check('a request is served by the ASSETS binding untouched', res.status === 200 && served && served.url === 'https://matchweek.gg/status');
  const diag = await W.default.fetch({ url: 'https://matchweek.gg/__worker' }, { GITHUB_TOKEN: 'secret-value', ASSETS: { fetch: async () => ({ status: 404 }) } });
  const dj = JSON.parse(await diag.text());
  check('/__worker says the script is deployed, its crons, and whether the token is set, never the token', diag.status === 200 && dj.worker === 'matchweek' && dj.crons.length === 2 && dj.token === true && !/secret-value/.test(JSON.stringify(dj)) && diag.headers.get('cache-control') === 'no-store');
  const diag2 = JSON.parse(await (await W.default.fetch({ url: 'https://matchweek.gg/__worker' }, { ASSETS: { fetch: async () => ({ status: 404 }) } })).text());
  check('/__worker without the secret: token false', diag2.token === false);
  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('FAILED', e); process.exit(1); });
