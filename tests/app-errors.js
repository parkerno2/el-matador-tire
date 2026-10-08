// App error reporter tests (fplgg/tools/matchweek/src/errors.js): the limits, the classification, what a report
// carries and what it never carries. Plain Node: the module is loaded in a vm with a small fake browser.
//   node tests/app-errors.js
const fs = require('fs'), vm = require('vm');
let fails = 0;
const check = (label, cond, info) => { if (!cond) fails++; console.log((cond ? 'PASS ' : 'FAIL ') + label + (info ? '  ' + info : '')); };
const src = fs.readFileSync(__dirname + '/../fplgg/tools/matchweek/src/errors.js', 'utf8').replace(/^export (function|const|let)/gm, '$1');
function load(opts) {
  const posts = [], listeners = {}, timers = [];
  const ctx = {
    console, JSON, String, Date, Math, Number, Object, Array, RegExp, Error, TypeError,
    D: opts && 'D' in opts ? opts.D : { api: 'https://script.google.com/macros/s/X/exec' },
    navigator: { onLine: true }, location: { hash: '#/matchday/live' },
    document: { querySelector: () => ({ getAttribute: () => 'app.js?v=20261008112958' }) },
    fetch: (url, o) => { posts.push({ url, body: JSON.parse(o.body), o }); return Promise.resolve({ ok: true }); },
    addEventListener: (t, f) => { listeners[t] = f; },
    setTimeout: (f, ms) => { timers.push({ f, ms }); return timers.length; }, clearTimeout: () => {},
  };
  vm.createContext(ctx);
  vm.runInContext(src + '\n;this.__x = { buildStamp, classify, describe, makeReporter, report, installErrorReporting, flushErrors };', ctx);
  return { x: ctx.__x, posts, listeners, timers, ctx };
}
let L = load();
const now = Date.parse('2026-10-08T12:00:00Z'), MIN = 60e3;
check('buildStamp reads the app.js query string', L.x.buildStamp() === '20261008112958');
check('classify: connection failures are network, the rest keep their kind', L.x.classify('rejection', 'TypeError: Failed to fetch') === 'network' && L.x.classify('rejection', 'TypeError: Load failed') === 'network' && L.x.classify('error', 'TypeError: x is undefined') === 'error' && L.x.classify('rejection', 'boom') === 'rejection');
let d = L.x.describe({ error: Object.assign(new Error('x is undefined'), { name: 'TypeError' }), message: 'Uncaught TypeError: x is undefined' });
check('describe an ErrorEvent: name and message, the stack', d.msg === 'TypeError: x is undefined' && /x is undefined/.test(d.stack));
d = L.x.describe({ reason: new Error('nope') });
check('describe a rejection with an Error reason', d.msg === 'Error: nope' && /nope/.test(d.stack));
d = L.x.describe({ reason: 'just a string' });
check('describe a rejection with a string reason', d.msg === 'just a string' && d.stack === '');
d = L.x.describe({ reason: { ok: false, error: 'auth' } });
check('describe a rejection with a plain object: JSON, no throw', d.msg === '{"ok":false,"error":"auth"}');
check('describe nothing', L.x.describe(null).msg === '' && L.x.describe(undefined).msg === '');

const R = L.x.makeReporter('20261008112958');
let p = R.consider('error', 'TypeError: x is undefined', 'at a\nat b', '#/matchday/live', now);
check('a report: action clienterror, build, route, kind, msg, stack, online; nothing else', p && p.action === 'clienterror' && p.build === '20261008112958' && p.route === '#/matchday/live' && p.kind === 'error' && p.msg === 'TypeError: x is undefined' && p.stack === 'at a\nat b' && p.online === true &&
  Object.keys(p).sort().join() === 'action,build,kind,msg,online,route,stack', JSON.stringify(p));
check('the same error again within 10 minutes: not sent', R.consider('error', 'TypeError: x is undefined', '', '#/matchday/live', now + 5 * MIN) === null);
check('another error 10 seconds later: not sent (30 seconds between reports)', R.consider('error', 'ReferenceError: y', '', '#/x', now + 10e3) === null);
check('another error 31 seconds later: sent', !!R.consider('error', 'ReferenceError: y', '', '#/x', now + 31e3));
check('the same error after 10 minutes on the same route: sent again', !!R.consider('error', 'TypeError: x is undefined', '', '#/matchday/live', now + 11 * MIN));
check('"Script error." (no detail) is never sent', R.consider('error', 'Script error.', '', '#/x', now + 20 * MIN) === null && R.consider('error', '', '', '#/x', now + 21 * MIN) === null);
R.consider('error', 'e4', '', '#/x', now + 30 * MIN); R.consider('error', 'e5', '', '#/x', now + 31 * MIN);
check('at most 5 reports a page load', R.state.sent === 5 && R.consider('error', 'e6', '', '#/x', now + 40 * MIN) === null);
p = L.x.makeReporter('').consider('rejection', 'TypeError: Failed to fetch', 'x'.repeat(5000), '#/' + 'r'.repeat(200), now);
check('a network failure is kind network; the stack is cut at 1,500, the route at 80, an unknown build is empty', p.kind === 'network' && p.stack.length === 1500 && p.route.length === 80 && p.build === '');
p = L.x.makeReporter('1').consider('error', '   TypeError:  spaced\n\nout  ' + 'm'.repeat(400), '', '#/x', now);
check('the message is squeezed and cut at 300', p.msg.length === 300 && /^TypeError: spaced out m+$/.test(p.msg));

/* report() + install(): a real post through fetch to D.api */
L = load(); L.x.installErrorReporting();
check('install listens to error and unhandledrejection', typeof L.listeners.error === 'function' && typeof L.listeners.unhandledrejection === 'function');
L.listeners.error({ error: new TypeError('boom'), message: 'Uncaught TypeError: boom' });
check('an error event posts to D.api as JSON with action clienterror and the route', L.posts.length === 1 && L.posts[0].url === 'https://script.google.com/macros/s/X/exec' && L.posts[0].body.action === 'clienterror' && L.posts[0].body.msg === 'TypeError: boom' && L.posts[0].body.route === '#/matchday/live' && L.posts[0].o.method === 'POST', JSON.stringify(L.posts[0]));
const sent = JSON.stringify(L.posts[0].body);
check('nothing personal in it: no team, token, pin, user agent or query string', !/team|token|pin|userAgent|\?/.test(sent));
L.listeners.error({ message: 'Script error.' });
L.listeners.error({});
check('"Script error." and an empty error event post nothing', L.posts.length === 1);

/* the queue before D.api is known */
L = load({ D: {} }); L.x.installErrorReporting();
L.listeners.unhandledrejection({ reason: new Error('early') });
check('before the backend address is known: queued, not posted, a 5-second timer armed', L.posts.length === 0 && L.timers.length === 1 && L.timers[0].ms === 5000);
L.ctx.D.api = 'https://script.google.com/macros/s/Y/exec';
const n = L.x.flushErrors();
check('flushErrors once D.api is known: the queued report goes', n === 1 && L.posts.length === 1 && L.posts[0].body.msg === 'Error: early' && L.posts[0].url.includes('/Y/'));
check('flushErrors with nothing queued: 0', L.x.flushErrors() === 0);

console.log(fails ? fails + ' FAILED' : 'ALL PASS');
process.exit(fails ? 1 : 0);
