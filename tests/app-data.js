// The app's data source behind a flag (ROADMAP B3, first slice; fplgg/tools/matchweek/src/data/tabs.js). Plain Node:
// the module runs in a vm with a fake document, localStorage, location and fetch, so the flag, the Supabase read, its
// fallbacks to the Sheet and the stale banner's source are exercised end to end.
//   node tests/app-data.js
const fs = require('fs'), vm = require('vm');
let fails = 0;
const check = (label, cond, info) => { if (!cond) fails++; console.log((cond ? 'PASS ' : 'FAIL ') + label + (info ? '  ' + info : '')); };
const src = fs.readFileSync(__dirname + '/../fplgg/tools/matchweek/src/data/tabs.js', 'utf8').replace(/^export (function|const|let)/gm, '$1');
const main = fs.readFileSync(__dirname + '/../fplgg/tools/matchweek/src/main.js', 'utf8');
const parity = require('../fplgg/tools/parity/parity.js');
const STANDINGS = ['Team', 'Manager', 'W', 'D', 'L', 'Pts For', 'Pts Against', 'League Pts'];
const GWS = 'GW,Code,Player,Pos,Club,Owner,Mins,Pts,G,A,CS,GC,OG,PS,PM,YC,RC,Saves,Bonus,BPS,DefCon,xG,xA,xGC,Starts,Final'.split(',');
/* a module instance: search is the page's ?query, kept what localStorage holds, answers maps a Supabase tab name to
   { status, body } (body an object) or a function; the Sheet is answered by hand through answer() */
function load(o) {
  o = o || {};
  const scripts = [], fetches = [], warns = [], store = Object.assign({}, o.kept ? { 'mw-data': o.kept } : {});
  const storage = o.noStorage ? { getItem() { throw new Error('no storage'); }, setItem() { throw new Error('no storage'); }, removeItem() { throw new Error('no storage'); } }
    : { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  const ctx = { console: { warn: m => warns.push(m), log: () => {}, info: () => {} }, JSON, String, Date, Math, Number, Object, Array, Set, Error, RegExp, isNaN, encodeURIComponent, Promise, SHEET: 'SHEET_ID',
    canonTeam: v => (v === 'Cold Palmer' ? 'Cold Palmers' : v), window: {}, setTimeout: (f, ms) => 1, clearTimeout: () => {},
    localStorage: storage, location: { search: o.search || '' }, AbortController: class { constructor() { this.signal = 'sig'; } abort() {} },
    fetch: (url, opts) => { fetches.push(url); const name = decodeURIComponent(url.replace(/^.*\/tab\//, '')); let a = (o.answers || {})[name]; if (typeof a === 'function') a = a(); if (!a) a = { status: 404, body: { error: 'no such tab' } }; if (a.reject) return Promise.reject(new Error(a.reject)); return Promise.resolve({ status: a.status, ok: a.status >= 200 && a.status < 300, json: () => Promise.resolve(a.body) }); },
    document: { createElement: () => { const s = { remove() { s.removed = true; } }; scripts.push(s); return s; }, head: { appendChild: () => {} } } };
  ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(src + '\n;this.__x = { TABS, QUERIES, SUPABASE, SHEET_ONLY, pickSource, dataSource, dataReport, sbUrl, sbCell, parseSupabase, readSupabase, guardedReadTab, readMeta, metaUpdated };', ctx);
  return { x: ctx.__x, ctx, scripts, fetches, warns, store };
}
/* answer the last JSONP request as gviz would */
const answer = (L, cols, rows) => { const s = L.scripts[L.scripts.length - 1], cb = decodeURIComponent(s.src).replace(/^.*responseHandler:/, '').replace(/&.*$/, ''); L.ctx.window[cb]({ table: { cols: cols.map(c => ({ label: c })), rows: rows.map(r => ({ c: r.map(v => ({ v })) })) } }); };
const tick = () => new Promise(r => setImmediate(r));

(async () => {
  /* the flag */
  let L = load();
  const ps = L.x.pickSource;
  check('pickSource: nothing in the URL and nothing kept is the Sheet', JSON.stringify(ps('', '')) === '{"source":"sheet","keep":false}' && ps(undefined, null).source === 'sheet');
  check('?data=supabase turns Supabase on and says to keep it', JSON.stringify(ps('?data=supabase', '')) === '{"source":"supabase","keep":true}' && ps('?x=1&data=supabase', '').source === 'supabase' && ps('?data=supabase&y=2', '').source === 'supabase');
  check('?data=sheet turns it off, even when Supabase was kept', JSON.stringify(ps('?data=sheet', 'supabase')) === '{"source":"sheet","keep":true}');
  check('with nothing in the URL, what was kept counts; anything else is the Sheet', ps('', 'supabase').source === 'supabase' && ps('', 'supabase').keep === false && ps('?data=other', 'supabase').source === 'supabase' && ps('?data=supabasex', '').source === 'sheet' && ps('', 'junk').source === 'sheet');
  check('dataSource by default: the Sheet, nothing stored', L.x.dataSource() === 'sheet' && !('mw-data' in L.store));
  L = load({ search: '?data=supabase' });
  check('dataSource with ?data=supabase: Supabase, kept in localStorage, the same answer on every call', L.x.dataSource() === 'supabase' && L.store['mw-data'] === 'supabase' && L.x.dataSource() === 'supabase');
  L = load({ kept: 'supabase' });
  check('the installed app (no query) keeps Supabase once chosen', L.x.dataSource() === 'supabase');
  L = load({ search: '?data=sheet', kept: 'supabase' });
  check('?data=sheet forgets the choice', L.x.dataSource() === 'sheet' && !('mw-data' in L.store));
  L = load({ search: '?data=supabase', noStorage: true });
  check('a phone whose storage throws still gets the source from the URL', L.x.dataSource() === 'supabase');
  check('SHEET_ONLY is the four tabs the web app writes, each one the guard knows', L.x.SHEET_ONLY.join() === 'Managers,Social,Posts,Specials' && L.x.SHEET_ONLY.every(t => L.x.TABS[t]));
  check('the tabs function is the one the parity report reads, for league 45380', L.x.SUPABASE.base === parity.SB_BASE && L.x.SUPABASE.league === parity.LEAGUE && L.x.sbUrl('GW Stats') === parity.sbUrl('GW Stats'));
  check('main.js puts the source and the report on window.MW.data', /window\.MW = \{[^\n]*data: \{ source: dataSource, report: dataReport \}/.test(main) && /import \{[^}]*dataSource, dataReport[^}]*\} from '\.\/data\/tabs\.js'/.test(main));

  /* the shape of a Supabase row: exactly what gviz hands over for the same cell */
  const c = L.x.sbCell;
  check('sbCell: numbers and booleans become the strings gviz gives, null is blank, the apostrophe before a date goes, canonTeam applies', c(12) === '12' && c(0.2) === '0.2' && c(true) === 'TRUE' && c(false) === 'FALSE' && c(null) === '' && c(undefined) === '' && c("'2026-10-08T21:07:03.815Z") === '2026-10-08T21:07:03.815Z' && c('Cold Palmer') === 'Cold Palmers' && c(' x ') === ' x ');
  let t = L.x.parseSupabase({ header: STANDINGS, rows: [['Cold Palmer', 'Parker Nolan', 3, 0, 2, 199, 201, 9]] });
  check('parseSupabase: rows keyed by the header, every value a string', t.cols.join() === STANDINGS.join() && t.rows.length === 1 && t.rows[0].Team === 'Cold Palmers' && t.rows[0]['League Pts'] === '9' && t.rows[0]['Pts For'] === '199', JSON.stringify(t.rows[0]));
  t = L.x.parseSupabase({ header: null, rows: [['League', 'El Matador Tire'], ['Updated', "'2026-10-08T21:07:03.815Z"], ['Current GW', 6]] });
  check('a tab without a header (Meta) is keyed Column 1, 2 and the time is found', t.cols.join() === 'Column 1,Column 2' && t.rows[1]['Column 2'] === '2026-10-08T21:07:03.815Z' && L.x.metaUpdated(t.cols, t.rows) === Date.parse('2026-10-08T21:07:03.815Z'));
  check('a blank or duplicate-free header: blank labels are dropped', L.x.parseSupabase({ header: ['A', '', 'C'], rows: [[1, 2, 3]] }).cols.join() === 'A,C' && L.x.parseSupabase({ header: ['A', '', 'C'], rows: [[1, 2, 3]] }).rows[0].C === '3');
  let threw = ''; try { L.x.parseSupabase({ error: 'x' }); } catch (e) { threw = e.message; }
  check('something that is not a tabs reply throws', threw === 'not a tabs reply');

  /* the GW Stats trim is the gviz query's rule (G > 0 or F is not null) applied to rows read whole */
  const keep = L.x.QUERIES['GW Stats'].keep;
  check('GW Stats keep: owned or played rows stay, an unowned zero-minute row goes', keep({ Mins: '0', Owner: 'Cold Palmers' }) === true && keep({ Mins: '90', Owner: '' }) === true && keep({ Mins: '0', Owner: '' }) === false && keep({ Mins: '', Owner: '' }) === false && keep({ Mins: '1', Owner: '' }) === true);

  /* the read under Supabase */
  const SB = {
    Standings: { status: 200, body: { header: STANDINGS, rows: [['Kobbie Mainoo Fan', 'Baha Kharoofa', 3, 1, 1, 228, 196, 10], ['Cold Palmer', 'Parker Nolan', 3, 0, 2, 199, 201, 9]] } },
    'GW Stats': { status: 200, body: { header: GWS, rows: [[1, 154561, 'Raya', 'GKP', 'ARS', 'Cold Palmers', 90, 6, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 24, 0, 0, 0, 0.2, 1, true], [1, 2, 'Nobody', 'MID', 'CHE', '', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, true], [1, 3, 'Bench', 'DEF', 'LIV', 'Team Jacob', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, true]] } },
    Rosters: { status: 200, body: { header: ['Team', 'Player', 'Pos'], rows: [['Cold Palmers', 'Haaland', 'FWD']] } },   /* no Club or Code: the guard must refuse it */
    Clubs: { status: 500, body: {} },
    Meta: { status: 200, body: { header: null, rows: [['League', 'El Matador Tire'], ['Updated', "'2026-10-08T21:07:03.815Z"], ['Current GW', 6]] } },
    Players: { reject: 'Failed to fetch' },
  };
  L = load({ search: '?data=supabase', answers: SB });
  let got = null, err = null;
  L.x.guardedReadTab('Standings').then(r => { got = r; }, e => { err = e; });
  await tick(); await tick();
  check('Standings comes from Supabase: one fetch of the tab, no gviz script, rows as the engine expects them', got && got.length === 2 && got[1].Team === 'Cold Palmers' && got[0]['League Pts'] === '10' && L.fetches.length === 1 && /\/league\/45380\/tab\/Standings$/.test(L.fetches[0]) && L.scripts.length === 0 && !err, err && err.message);
  got = null; err = null;
  L.x.guardedReadTab('GW Stats').then(r => { got = r; }, e => { err = e; });
  await tick(); await tick();
  check('GW Stats from Supabase is trimmed like the gviz query: the unowned zero-minute row goes, the owned one stays, Final is TRUE', got && got.length === 2 && got[0].Player === 'Raya' && got[0].xGC === '0.2' && got[0].Final === 'TRUE' && got[1].Player === 'Bench' && !err, err && err.message);
  got = null; err = null;
  L.x.guardedReadTab('Managers').then(r => { got = r; }, e => { err = e; });
  await tick();
  check('Managers (the web app writes it) is read from the Sheet, not Supabase, with nothing to warn about', L.scripts.length === 1 && /sheet=Managers$/.test(L.scripts[0].src) && L.fetches.length === 2 && L.warns.length === 0, L.scripts.map(s => s.src).join());
  answer(L, ['Team', 'Color', 'Shape'], [['Cold Palmers', '#2E5BFF', 'circle']]);
  await tick();
  check('... and its rows come back', got && got.length === 1 && got[0].Color === '#2E5BFF' && !err);
  got = null; err = null;
  L.x.guardedReadTab('Fixture BPS').then(r => { got = r; }, e => { err = e; });
  await tick(); await tick();
  check('a tab Supabase answers 404 for (Fixture BPS) falls back to the Sheet, and the console says so', L.scripts.length === 2 && /sheet=Fixture%20BPS$/.test(L.scripts[1].src) && L.warns.some(w => /tab "Fixture BPS": not on Supabase; read from the Sheet/.test(w)), L.warns.join(' | '));
  answer(L, ['GW', 'Home', 'Away', 'Code', 'BPS', 'Bonus'], [[6, 'ARS', 'CHE', 1, 30, 3]]);
  await tick();
  check('... with the Sheet rows', got && got.length === 1 && got[0].BPS === 30 && !err);
  got = null; err = null;
  L.x.guardedReadTab('Clubs').then(r => { got = r; }, e => { err = e; });
  await tick(); await tick();
  check('a Supabase error (HTTP 500) falls back to the Sheet with the reason', L.scripts.length === 3 && /sheet=Clubs$/.test(L.scripts[2].src) && L.warns.some(w => /tab "Clubs": HTTP 500; read from the Sheet/.test(w)), L.warns.join(' | '));
  answer(L, ['Short', 'Name', 'Badge code', 'Badge URL', 'Str H', 'Str A'], [['ARS', 'Arsenal', 3, '', 5, 4]]);
  await tick();
  check('... with the Sheet rows', got && got.length === 1 && got[0].Short === 'ARS' && !err);
  got = null; err = null;
  L.x.guardedReadTab('Players').then(r => { got = r; }, e => { err = e; });
  await tick(); await tick();
  check('a network failure falls back to the Sheet too', L.scripts.length === 4 && /sheet=Players$/.test(L.scripts[3].src) && L.warns.some(w => /tab "Players": Failed to fetch; read from the Sheet/.test(w)), L.warns.join(' | '));
  got = null; err = null;
  L.x.guardedReadTab('Rosters').then(r => { got = r; }, e => { err = e; });
  await tick(); await tick();
  check('a Supabase tab with the wrong columns is refused by the guard, never handed over and never swapped for the Sheet quietly', got === null && err && /Rosters tab is missing or has the wrong columns: missing Club, Code/.test(err.message) && L.scripts.length === 4, err && err.message);
  const rep = L.x.dataReport();
  check('the report says where each tab came from', rep.source === 'supabase' && rep.tabs.Standings === 'supabase' && rep.tabs['GW Stats'] === 'supabase' && rep.tabs.Managers === 'sheet (the web app writes it)' && rep.tabs['Fixture BPS'] === 'sheet (not on Supabase)' && rep.tabs.Clubs === 'sheet (HTTP 500)' && rep.tabs.Players === 'sheet (Failed to fetch)', JSON.stringify(rep));
  check('the GW Stats fetch carries no gviz query and the request has a timeout signal', L.fetches.every(u => !/tq=/.test(u)));
  /* a browser without fetch (or a throw inside the read) is a rejection, never a throw into the engine's load */
  L = load({ search: '?data=supabase', answers: SB }); L.ctx.fetch = undefined;
  got = null; err = null; let sync = '';
  try { L.x.guardedReadTab('Standings').then(r => { got = r; }, e => { err = e; }); } catch (e) { sync = e.message; }
  await tick(); await tick();
  check('without fetch the read falls back to the Sheet instead of throwing', sync === '' && L.scripts.length === 1 && /sheet=Standings$/.test(L.scripts[0].src) && L.warns.some(w => /tab "Standings": fetch is not a function; read from the Sheet/.test(w)), sync || L.warns.join(' | '));
  L = load({ search: '?data=supabase', answers: SB });
  /* the stale banner follows the source */
  let meta = null;
  L.x.readMeta().then(v => { meta = v; });
  await tick(); await tick(); await tick();
  check('readMeta under Supabase reads its Meta tab: the ingest\'s Updated time, no gviz request', meta === Date.parse('2026-10-08T21:07:03.815Z') && L.scripts.length === 0 && L.fetches.length === 1, String(meta));
  L = load({ search: '?data=supabase', answers: {} });
  meta = null;
  L.x.readMeta().then(v => { meta = v; });
  await tick(); await tick(); await tick();
  check('with no Meta on Supabase the Sheet\'s Meta is read', L.scripts.length === 1 && /sheet=Meta$/.test(L.scripts[0].src));
  answer(L, ['League Updated Pot', 'El Matador Tire 2026-10-08T12:13:18.508Z $1200'], [['Current GW', 6]]);
  await tick(); await tick();
  check('... and gives the Sheet\'s time', meta === Date.parse('2026-10-08T12:13:18.508Z'), String(meta));

  /* the default: nothing changes for a phone without the flag */
  L = load({ answers: SB });
  got = null; err = null;
  L.x.guardedReadTab('Standings').then(r => { got = r; }, e => { err = e; });
  await tick();
  check('without the flag Standings is read from the Sheet over gviz and Supabase is never asked', L.fetches.length === 0 && L.scripts.length === 1 && /sheet=Standings$/.test(L.scripts[0].src) && L.warns.length === 0);
  answer(L, STANDINGS, [['Cold Palmer', 'Parker', 4, 0, 2, 300, 250, 12]]);
  await tick();
  check('... rows as before', got && got[0].Team === 'Cold Palmers' && got[0]['League Pts'] === 12 && !err);
  meta = null;
  L.x.readMeta().then(v => { meta = v; });
  await tick();
  check('readMeta without the flag reads the Sheet\'s Meta', L.scripts.length === 2 && /sheet=Meta$/.test(L.scripts[1].src) && L.fetches.length === 0);
  check('the report without the flag: the Sheet', L.x.dataReport().source === 'sheet' && L.x.dataReport().tabs.Standings === 'sheet');
  check('no em or en dashes in what the console is told', !/[\u2013\u2014]/.test(L.warns.join(' ')));

  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
