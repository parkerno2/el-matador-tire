// v3.18 tests: phones report script errors (clienterror), the hidden Errors tab, ?health=1 errors.
//   cd /home/claude/emt && node tests/codegs/v318.js
const T = require(__dirname + '/harness.js').make();
const { ctx, sheets, props, check, get, Hd, iso } = T;
const src = T.src;
const rows = () => (sheets.Errors ? sheets.Errors.rows.slice(1) : []);
const unq = v => String(v == null ? '' : v).replace(/^'/, '');
const post = o => Hd(Object.assign({ action: 'clienterror', build: '20261008112958', route: '#/matchday', kind: 'error', msg: 'TypeError: x is undefined', stack: 'TypeError: x is undefined\n    at render (app.js?v=20261008112958:1:2345)' }, o || {}));

console.log('--- V the release');
check('V1 EMT_VERSION is v3.18 or later and the CHANGELOG has the entry', ctx.emtSelfVersion(src) === ctx.EMT_VERSION && ctx.emtSelfCmp(ctx.EMT_VERSION, 'v3.18') >= 0 && /\* v3\.18 · 8 Oct 2026\n \*   Phones report script errors/.test(src));

console.log('--- E clienterror');
let h = get({ health: '1' });
check('E0 health before any error: errors {h24 0, net24 0, rows 0, last null}', JSON.stringify(h.errors) === '{"h24":0,"net24":0,"rows":0,"last":null}', JSON.stringify(h.errors));
let r = post();
check('E1 a report is accepted without a login and stored: When, Build, Route, Kind, Message, Stack, Count 1, Last; the tab is hidden', r.ok === true && rows().length === 1 && unq(rows()[0][0]).length > 10 && rows()[0][1] === '20261008112958' && rows()[0][2] === '#/matchday' && rows()[0][3] === 'error' &&
  rows()[0][4] === 'TypeError: x is undefined' && /at render/.test(rows()[0][5]) && rows()[0][6] === 1 && sheets.Errors.hidden === true, JSON.stringify(rows()[0]));
r = post();
check('E2 the same error again within 10 minutes: one row, Count 2, Last moved', r.ok === true && r.count === 2 && rows().length === 1 && rows()[0][6] === 2 && unq(rows()[0][7]) >= unq(rows()[0][0]));
r = post({ route: '#/league' });
check('E3 the same message on another route: a new row', r.ok === true && rows().length === 2);
sheets.Errors.rows[1][7] = "'" + iso(Date.now() - 11 * 60e3);
r = post();
check('E4 the same error after 10 minutes: a new row', r.ok === true && rows().length === 3);
r = post({ msg: '' });
check('E5 no message: badmsg, nothing stored', r.ok === false && r.error === 'badmsg' && rows().length === 3);
r = post({ msg: 'x'.repeat(1000) + '<b>', stack: 'y'.repeat(5000), route: '#/' + 'r'.repeat(200), build: 'v2026abc', kind: 'weird' });
let R = rows()[rows().length - 1];
check('E6 truncated and cleaned: message 300, stack 1,500, route 80, build digits only, kind error', R[4].length === 300 && !/</.test(R[4]) && R[5].length === 1500 && R[2].length === 80 && R[1] === '2026' && R[3] === 'error', JSON.stringify([R[4].length, R[5].length, R[2].length, R[1], R[3]]));
r = post({ kind: 'network', msg: 'TypeError: Failed to fetch' });
check('E7 kind network is kept', r.ok && rows()[rows().length - 1][3] === 'network');
r = post({ msg: '=HYPERLINK("x")', build: '1' });
check('E8 a message that looks like a formula is stored as text', rows()[rows().length - 1][4] === "'=HYPERLINK(\"x\")");

console.log('--- H health');
h = get({ health: '1' });
check('H1 errors: h24 counts occurrences (not rows) without the network ones, net24 the network ones, rows all, last the newest non-network', h.errors.h24 === 6 && h.errors.net24 === 1 && h.errors.rows === 6 && h.errors.last && h.errors.last.msg === '=HYPERLINK("x")' && h.errors.last.build === '1' && h.errors.last.kind === 'error' && /^\d{4}-/.test(h.errors.last.when), JSON.stringify(h.errors));
check('H2 the health keys', Object.keys(h).sort().join() === 'ai,articles,data,errors,facts,ok,self,show,version');
sheets.Errors.rows.slice(1).forEach(x => { x[7] = "'" + iso(Date.now() - 25 * 3600e3); x[0] = "'" + iso(Date.now() - 25 * 3600e3); });
h = get({ health: '1' });
check('H3 cached a minute: the old counts still show', h.errors.h24 === 6);
T.cache = {}; h = get({ health: '1' });
check('H3 ... after the cache: rows older than 24 hours do not count; rows still counts them', h.errors.h24 === 0 && h.errors.net24 === 0 && h.errors.rows === 6 && h.errors.last === null, JSON.stringify(h.errors));
post({ msg: 'fresh one' }); h = get({ health: '1' });
check('H4 a new report clears the cache: counted at once', h.errors.h24 === 1 && h.errors.last.msg === 'fresh one');

console.log('--- R the limits');
T.cache = {}; delete sheets.Errors;
let acc = 0, dropped = 0;
for (let i = 0; i < 65; i++) { const x = post({ msg: 'err ' + i }); if (x.dropped) dropped++; else if (x.ok) acc++; }
check('R1 all phones together: 60 accepted per 10 minutes, the rest answered ok but dropped, no row', acc === 60 && dropped === 5 && rows().length === 60);
T.cache = {}; delete sheets.Errors;
for (let i = 0; i < 1001; i++) { if (i % 60 === 0) delete T.cache.EMT_CE_N; post({ msg: 'e' + i }); }
check('R2 the tab keeps 1,000 rows: the 1,001st trims the oldest 200', rows().length === 801 && rows()[0][4] === 'e200', String(rows().length));
delete T.cache.EMT_CE_N; T.cache = {}; h = get({ health: '1' });
check('R3 health reads the last 400 rows only (h24 400 of 801, rows 801)', h.errors.h24 === 400 && h.errors.rows === 801, JSON.stringify([h.errors.h24, h.errors.rows]));

console.log('--- M the monitor contract');
const M = require(__dirname + '/../../fplgg/tools/monitor/monitor.js');
const raw = { app: { status: 200, text: 'app.js?v=20261008112958' }, specials: { status: 200, text: '"Setting","Value"\n"API URL","https://script.google.com/x"\n' }, fpl: { status: 200, text: '{"current_event":6}' }, health: { status: 200, text: JSON.stringify(h) } };
const a = M.assess(raw, Date.now()).checks.find(c => c.key === 'errors');
check('M1 the monitor reads this health: 400 errors in 24 hours is a spike', a.ok === false && /400 errors/.test(a.detail));

T.done();
