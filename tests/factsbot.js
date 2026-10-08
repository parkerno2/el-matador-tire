// Facts bot tests (fplgg/tools/factsbot/factsbot.js): the windows, the shape checks, the in-page trimming and the
// file writing. Plain Node, no browser.   node tests/factsbot.js
const fs = require('fs'), os = require('os'), path = require('path'), vm = require('vm');
const B = require(__dirname + '/../fplgg/tools/factsbot/factsbot.js');
let fails = 0;
const check = (label, cond, info) => { if (!cond) fails++; console.log((cond ? 'PASS ' : 'FAIL ') + label + (info ? '  ' + info : '')); };
const H = 3600e3, D = 24 * H, now = Date.parse('2026-10-08T12:00:00Z'), iso = ms => new Date(ms).toISOString();

/* ---------- due(): the phones' windows ---------- */
let d = B.due({ gw: 6, dlPassed: false, deadline: iso(now + 46 * H) }, { gw: 5, lastKick: iso(now - 16 * D) }, now, false);
check('preview due 46 h before the deadline', d.preview.due && /46 hours/.test(d.preview.why), d.preview.why);
check('recap not due 16 days after the last kick-off', !d.recap.due && /16 days/.test(d.recap.why), d.recap.why);
d = B.due({ gw: 6, dlPassed: false, deadline: iso(now + 55 * H) }, { gw: 5, lastKick: iso(now - 2 * D) }, now, false);
check('preview not due 55 h before (window 54)', !d.preview.due && /window opens at 54/.test(d.preview.why), d.preview.why);
check('recap due 2 days after the last kick-off', d.recap.due && /48 hours ago/.test(d.recap.why), d.recap.why);
d = B.due({ gw: 6, dlPassed: true, deadline: iso(now - H) }, { gw: 0 }, now, false);
check('after the deadline: no preview; no finished gameweek: no recap', !d.preview.due && /passed/.test(d.preview.why) && !d.recap.due && /no finished/.test(d.recap.why));
d = B.due({ gw: 6, dlPassed: false, deadline: null }, { gw: 5, lastKick: null }, now, false);
check('no deadline / no kick-offs: neither due, said plainly', !d.preview.due && /no deadline/.test(d.preview.why) && !d.recap.due && /no kick-off/.test(d.recap.why));
d = B.due({ gw: 6, dlPassed: false, deadline: iso(now + 2 * H) }, { gw: 5, lastKick: iso(now + H) }, now, false);
check('a recap whose last game has not kicked off is not due', !d.recap.due && /not kicked off/.test(d.recap.why));
d = B.due({ gw: 6, dlPassed: true, deadline: iso(now - H) }, { gw: 5, lastKick: iso(now - 20 * D) }, now, true);
check('forced: both due whatever the windows', d.preview.due && d.recap.due && d.preview.why === 'forced');
check('a 5-day window is exactly 5 days', B.RECAP_WINDOW === 5 * D && B.PREVIEW_WINDOW === 54 * H && B.CAP === 60000);

/* ---------- shapeError(): what the server would reject before comparing with the sheet ---------- */
const side = () => ({ team: 'A', mgr: 'a', xi: [{ code: '1', name: 'X', pos: 'MID', club: 'ARS', pts: 2 }], bench: [] });
const prev = () => ({ kind: 'preview', gw: 6, fixtures: [{ home: 'A', away: 'B', H: side(), A: side() }], collisions: [], slate: [] });
const rec = () => ({ kind: 'recap', gw: 5, fixtures: [{ home: 'A', away: 'B', hs: 33, as: 34, H: side(), A: side() }], pl: [] });
check('a good preview passes', B.shapeError('preview', JSON.stringify(prev())) === '');
check('a good recap passes', B.shapeError('recap', JSON.stringify(rec())) === '');
let f = prev(); delete f.collisions;
check('a preview without collisions (old app) is refused', /collisions/.test(B.shapeError('preview', JSON.stringify(f))));
f = rec(); delete f.fixtures[0].hs;
check('a recap fixture without scores is refused', /no scores/.test(B.shapeError('recap', JSON.stringify(f))));
f = prev(); f.fixtures.push({ home: 'A', away: 'B', H: side(), A: side() });
check('a fixture twice is refused', /twice/.test(B.shapeError('preview', JSON.stringify(f))));
f = prev(); f.kind = 'recap';
check('the wrong kind is refused', /kind is/.test(B.shapeError('preview', JSON.stringify(f))));
check('junk is refused', B.shapeError('preview', '{') === 'does not parse' && B.shapeError('preview', '') === 'empty' && B.shapeError('preview', '[]') === 'not an object');
check('over the cap is refused', /over 60000/.test(B.shapeError('preview', JSON.stringify(Object.assign(prev(), { pad: 'x'.repeat(60000) })))));
f = prev(); f.fixtures = [];
check('no fixtures is refused', /fixtures: 0/.test(B.shapeError('preview', JSON.stringify(f))));

/* ---------- PAGE.*: the in-page functions, run here with stub globals ---------- */
const run = (fn, stubs, arg) => { const ctx = Object.assign({ JSON, Number, Array, Date, isNaN, document: { querySelector: () => ({ src: 'https://x/app.js?v=20261008112958' }) } }, stubs); vm.createContext(ctx); return vm.runInContext('(' + fn.toString() + ')(' + JSON.stringify(arg) + ')', ctx); };
const big = n => Array.from({ length: n }, (_, i) => 'Player Name Number ' + i + ' (CLUB)');
let st = run(B.PAGE.state, { D: { gw: 6, dlPassed: false, gwsDone: 5, ro: [1] }, gwDeadline: () => new Date('2026-10-10T10:00:00Z') });
check('state: gw, deadline iso, done, build stamp', st.gw === 6 && st.deadline === '2026-10-10T10:00:00.000Z' && st.gwsDone === 5 && st.build === '20261008112958' && st.dlPassed === false, JSON.stringify(st));
check('ready needs MW.facts and loaded rosters', run(B.PAGE.ready, { window: { MW: { facts: {} } }, D: { ro: [1] } }) === true && run(B.PAGE.ready, { window: { MW: { facts: {} } }, D: { ro: [] } }) === false && run(B.PAGE.ready, { window: {}, D: { ro: [1] } }) === false);
let r = run(B.PAGE.preview, { MW: { facts: { preview: () => Object.assign(prev(), { rosters: { A: big(2000) } }) } } }, 60000);
check('preview over the cap: rosters dropped, as the phone does', r.body && r.body.length < 60000 && !JSON.parse(r.body).rosters && r.gw === 6, r.none || r.body.length);
r = run(B.PAGE.preview, { MW: { facts: { preview: () => prev() } } }, 60000);
check('preview under the cap: exactly JSON.stringify of the engine output', r.body === JSON.stringify(prev()));
r = run(B.PAGE.preview, { MW: { facts: { preview: () => ({ kind: 'preview', gw: 7, fixtures: [] }) } } }, 60000);
check('preview with no fixtures: none, with the gameweek', r.none === 'no fixtures for GW7');
const bigRec = () => { const x = rec(); x.fixtures[0].H.bench = Array.from({ length: 4 }, (_, i) => ({ code: String(i), name: 'B' + i, pos: 'DEF', club: 'ARS', pts: 1, mins: 90, used: false })); x.rosters = { A: big(2000) }; x.pl = [{ home: 'Arsenal', away: 'Chelsea', ko: '2026-09-20T15:00:00Z' }, { home: 'Leeds', away: 'Spurs', ko: '2026-09-21T19:00:00Z' }]; return x; };
r = run(B.PAGE.recap, { MW: { facts: { recap: bigRec } } }, 60000);
let rj = r.body && JSON.parse(r.body);
check('recap over the cap: bench club/mins and rosters dropped, as the phone does; last kick-off found', rj && !rj.rosters && rj.fixtures[0].H.bench.every(b => b.club === undefined && b.mins === undefined && b.pts === 1) && r.lastKick === '2026-09-21T19:00:00Z', r.none);
r = run(B.PAGE.recap, { MW: { facts: { recap: () => ({ kind: 'recap', gw: 0, fixtures: [] }) } } }, 60000);
check('recap with no finished gameweek: none', r.none === 'no finished gameweek yet');
r = run(B.PAGE.recap, { MW: { facts: { recap: () => Object.assign(rec(), { pad: 'x'.repeat(61000) }) } } }, 60000);
check('recap still over the cap after trimming: none', /over 60000/.test(r.none));

/* ---------- writeFiles(): change detection and the index ---------- */
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'factsbot-')), state = { build: '20261008112958', deadline: '2026-10-10T10:00:00Z' };
let w = B.writeFiles(dir, { preview: { body: JSON.stringify(prev()), gw: 6 } }, state, '2026-10-08T12:00:00Z');
let idx = JSON.parse(fs.readFileSync(dir + '/index.json', 'utf8'));
check('first write: file and index', w.changed.join() === 'preview-gw6.json' && fs.readFileSync(dir + '/preview-gw6.json', 'utf8') === JSON.stringify(prev()) &&
  idx.updated === '2026-10-08T12:00:00Z' && idx.app === '20261008112958' && idx.files['preview-gw6.json'].at === '2026-10-08T12:00:00Z' && idx.files['preview-gw6.json'].gw === 6 &&
  idx.files['preview-gw6.json'].kind === 'preview' && idx.files['preview-gw6.json'].chars === JSON.stringify(prev()).length && /^[0-9a-f]{32}$/.test(idx.files['preview-gw6.json'].md5) && idx.files['preview-gw6.json'].deadline === state.deadline, JSON.stringify(idx));
w = B.writeFiles(dir, { preview: { body: JSON.stringify(prev()), gw: 6 } }, state, '2026-10-08T15:00:00Z');
idx = JSON.parse(fs.readFileSync(dir + '/index.json', 'utf8'));
check('same content: nothing written, at and updated untouched', w.changed.length === 0 && w.same.join() === 'preview-gw6.json' && idx.updated === '2026-10-08T12:00:00Z' && idx.files['preview-gw6.json'].at === '2026-10-08T12:00:00Z');
const p2 = prev(); p2.fixtures[0].H.xi[0].pts = 3;
w = B.writeFiles(dir, { preview: { body: JSON.stringify(p2), gw: 6 }, recap: { body: JSON.stringify(rec()), gw: 5, lastKick: '2026-09-21T19:00:00Z' } }, state, '2026-10-08T18:00:00Z');
idx = JSON.parse(fs.readFileSync(dir + '/index.json', 'utf8'));
check('changed preview and a new recap: both written, at moves, recap carries lastKick, files sorted', w.changed.join() === 'preview-gw6.json,recap-gw5.json' && idx.updated === '2026-10-08T18:00:00Z' &&
  idx.files['preview-gw6.json'].at === '2026-10-08T18:00:00Z' && idx.files['recap-gw5.json'].at === '2026-10-08T18:00:00Z' && idx.files['recap-gw5.json'].lastKick === '2026-09-21T19:00:00Z' && Object.keys(idx.files).join() === 'preview-gw6.json,recap-gw5.json');
w = B.writeFiles(dir, {}, state, '2026-10-08T21:00:00Z');
check('nothing computed: nothing changes', w.changed.length === 0 && JSON.parse(fs.readFileSync(dir + '/index.json', 'utf8')).updated === '2026-10-08T18:00:00Z');
fs.writeFileSync(dir + '/index.json', 'junk');
w = B.writeFiles(dir, { recap: { body: JSON.stringify(rec()), gw: 5 } }, state, '2026-10-09T00:00:00Z');
idx = JSON.parse(fs.readFileSync(dir + '/index.json', 'utf8'));
check('a broken index is rebuilt from what is written', w.changed.join() === 'recap-gw5.json' && Object.keys(idx.files).join() === 'recap-gw5.json');
fs.rmSync(dir, { recursive: true, force: true });

console.log(fails ? fails + ' FAILED' : 'ALL PASS');
process.exit(fails ? 1 : 0);
