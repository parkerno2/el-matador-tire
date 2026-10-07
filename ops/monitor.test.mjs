// node ops/monitor.test.mjs: alert, dedupe, reminder and all-clear logic against a fake network.
import assert from 'node:assert/strict';
const sent = [];
let sheetAgeMin = 10, clock = Date.parse('2026-10-08T12:00:00Z');
const fresh = (min) => new Date(clock - min * 60e3).toISOString();
Date.now = () => clock;
globalThis.fetch = async (url, opt = {}) => {
  const u = String(url);
  const res = (status, body) => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
  if (u.startsWith('https://ntfy.sh/')) {
    if (opt.method === 'POST') { sent.push({ time: clock / 1000, event: 'message', title: opt.headers.Title, message: opt.body, tags: opt.headers.Tags.split(',') }); return res(200, '{}'); }
    return res(200, sent.map((m) => JSON.stringify(m)).join('\n'));
  }
  if (u.endsWith('/el-matador-tire/')) return res(200, '<script src="core.js?v=1"></script><link rel="stylesheet" href="app.css?v=1">');
  if (u.includes('/el-matador-tire/')) return res(200, 'x');
  if (u.includes('sheet=Meta')) return res(200, `"Updated","${fresh(sheetAgeMin)}"`);
  if (u.includes('sheet=Specials')) return res(200, '"API URL","https://script.google.com/macros/s/AKfyc_test/exec"');
  if (u.includes('script.google.com')) return res(200, '{"ok":true}');
  if (u.includes('/tabs/health')) return res(200, { runs: [{ finished_at: fresh(20), ok: true }], leagues: [{ league: 45380, standingsUpdated: fresh(20) }] });
  if (u.includes('/api/fixtures/')) return res(200, []);
  if (u.includes('bootstrap-static')) return res(200, '{}');
  throw new Error('unexpected fetch ' + u);
};
process.env.NTFY_TOPIC = 'test-topic'; process.env.RETRY_MS = '0';
let n = 0;
const run = async () => (await import(`./monitor.mjs?run=${++n}`)).done;

await run(); assert.equal(sent.length, 0, 'healthy: nothing sent');
sheetAgeMin = 300; await run(); assert.equal(sent.length, 1, 'stale: alert'); assert.match(sent[0].title, /1 problem/); assert.ok(sent[0].tags.includes('alert'));
clock += 10 * 60e3; await run(); assert.equal(sent.length, 1, 'still stale: no repeat');
clock += 3 * 3600e3; await run(); assert.equal(sent.length, 2, 'after 3 h: reminder');
sheetAgeMin = 10; clock += 10 * 60e3; await run(); assert.equal(sent.length, 3, 'fixed: all clear'); assert.match(sent[2].title, /all clear/);
clock += 10 * 60e3; await run(); assert.equal(sent.length, 3, 'healthy again: quiet');
console.log('monitor tests pass (6 scenarios)');
