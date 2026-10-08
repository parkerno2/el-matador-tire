// Sheet reader guard and stale banner tests (fplgg/tools/matchweek/src/data/tabs.js). Plain Node: the module runs in
// a vm with a fake document, so the JSONP read and the header check are exercised end to end.
//   node tests/app-tabs.js
const fs = require('fs'), vm = require('vm');
let fails = 0;
const check = (label, cond, info) => { if (!cond) fails++; console.log((cond ? 'PASS ' : 'FAIL ') + label + (info ? '  ' + info : '')); };
const src = fs.readFileSync(__dirname + '/../fplgg/tools/matchweek/src/data/tabs.js', 'utf8').replace(/^export (function|const|let)/gm, '$1');
/* the live headers of 8 Oct 2026 (gviz CSV); the guard must accept each tab as it is today */
const LIVE = {
  Rosters: 'Team,Manager,Player,Pos,Club,FPL rank,Proj pts,Best XI,Status,News,Drafted,Season pts,GW pts,GW mins,Code,Nation,OVR,TOTW,GW XI,Slot',
  Standings: 'Team,Manager,W,D,L,Pts For,Pts Against,League Pts', 'H2H Fixtures': 'GW,Home,Home pts,Away,Away pts,Finished', Matchweeks: 'GW,Deadline (UTC),MOTM period,Finished,Notes',
  'Club Fixtures': 'GW,Home,Away,Kickoff (UTC),Finished,Home goals,Away goals,Started,Mins', Clubs: 'Short,Name,Badge code,Badge URL,Str att H,Str att A,Str def H,Str def A,Str H,Str A', Specials: 'Setting,Value',
  'EA Map': 'fpl_code,fpl_id_2627,fpl_web_name,fpl_full,fpl_pos,fpl_team_id,ea_player_id,ea_name,ea_club_fc26,ea_ovr_fc26,match_conf,review_flag',
  FC27: 'fpl_code,fpl_id_2627,fpl_web_name,fpl_pos,ea_player_id,ea_name,ea_ovr_fc27,ea_pos,ea_club,ea_league,skill_moves,weak_foot,ea_pac,ea_sho,ea_pas,ea_dri,ea_def,ea_phy',
  Transactions: 'GW,Team,Manager,In,Out,Type,Result,When (UTC)', Predictions: 'GW,Code,Player,Pos,Club,EP,Proj,Captured (UTC)',
  'GW Stats': 'GW,Code,Player,Pos,Club,Owner,Mins,Pts,G,A,CS,GC,OG,PS,PM,YC,RC,Saves,Bonus,BPS,DefCon,xG,xA,xGC,Starts,Final',
  Players: 'Code,Player,Pos,Club,Owner,Status,News,Draft rank,Season pts,Mins,Form,xGI,EP next,Proj,Nation,Full name', 'GW Log': 'GW,Team,Player,Code,Pos,Club,GW pts,GW mins,Started,TOTW,Logged (UTC)',
  Managers: 'Team,Color,Shape,Photo,Manager,Updated,Emblem,Pattern', Social: 'When (UTC),Team,Kind,Target,Value,Extra', Posts: 'When (UTC),Id,Voice,Kind,Event,Teams,Players,Text,Facts,Media',
  'Fixture BPS': 'GW,Fixture,Home,Away,Kickoff (UTC),Started,Finished,Code,Player,Club,BPS,Bonus',   /* Code.gs v3.21 */
};
const FIRST_SHEET = 'Rank,Team,Manager,Grade,Note'.split(',');   /* what gviz returns for a tab that does not exist (bug #5) */
function load() {
  const scripts = [];
  const ctx = { console: { warn: () => {}, log: () => {} }, JSON, String, Date, Math, Number, Object, Array, Set, Error, RegExp, isNaN, encodeURIComponent, SHEET: 'SHEET_ID',
    canonTeam: v => (v === 'Cold Palmer' ? 'Cold Palmers' : v), window: {}, setTimeout: (f, ms) => 1, clearTimeout: () => {},
    document: { createElement: () => { const s = { remove() { s.removed = true; } }; scripts.push(s); return s; }, head: { appendChild: () => {} } } };
  ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(src + '\n;this.__x = { TABS, QUERIES, queryProblem, tabProblem, readRaw, guardedReadTab, installReadTab, metaUpdated, readMeta, matchOn, staleInfo };', ctx);
  return { x: ctx.__x, ctx, scripts };
}
/* answer the last JSONP request as gviz would: cols from labels, rows of cells */
const answer = (L, cols, rows) => { const s = L.scripts[L.scripts.length - 1], cb = decodeURIComponent(s.src).replace(/^.*responseHandler:/, '').replace(/&.*$/, ''); L.ctx.window[cb]({ table: { cols: cols.map(c => ({ label: c })), rows: rows.map(r => ({ c: r.map(v => ({ v })) })) } }); };

let L = load();
Object.keys(L.x.TABS).forEach(t => check('the live ' + t + ' header passes the guard', LIVE[t] && L.x.tabProblem(t, LIVE[t].split(',')) === '', L.x.tabProblem(t, (LIVE[t] || '').split(','))));
Object.keys(L.x.TABS).forEach(t => check('the first sheet (bug #5) is refused for ' + t, /^missing /.test(L.x.tabProblem(t, FIRST_SHEET))));
check('a tab the guard does not know is read as before', L.x.tabProblem('Something New', FIRST_SHEET) === '');
check('EA Map accepts the legacy schema too', L.x.tabProblem('EA Map', ['Player', 'EA ID']) === '' && /missing ea_player_id\|EA ID/.test(L.x.tabProblem('EA Map', ['Player'])));
check('an empty tab with its header passes', L.x.tabProblem('Social', LIVE.Social.split(',')) === '');

/* the read itself */
L = load();
let got = null, err = null;
L.x.guardedReadTab('Standings').then(r => { got = r; }, e => { err = e; });
check('the request goes to gviz with headers=1 and the tab name', /gviz\/tq\?tqx=out%3Ajson%3BresponseHandler%3A__mwgv\d+&headers=1&sheet=Standings$/.test(L.scripts[0].src), L.scripts[0].src);
answer(L, LIVE.Standings.split(','), [['Cold Palmer', 'Parker', 4, 0, 2, 300, 250, 12]]);
setImmediate(() => {
  check('rows come keyed by label, every value through canonTeam, the script tag removed', got && got.length === 1 && got[0].Team === 'Cold Palmers' && got[0]['League Pts'] === 12 && L.scripts[0].removed, JSON.stringify(got));
  L = load(); got = null; err = null;
  L.x.guardedReadTab('Rosters').then(r => { got = r; }, e => { err = e; });
  answer(L, FIRST_SHEET, [[1, 'Cold Palmers', 'Parker', 'A', '']]);
  setImmediate(() => {
    check('a missing tab (the first sheet came back) rejects instead of handing over the wrong rows', got === null && err && /Rosters tab is missing or has the wrong columns: missing Player/.test(err.message), err && err.message);
    L = load(); got = null; err = null;
    L.x.guardedReadTab('Meta').then(r => { got = r; }, e => { err = e; });
    answer(L, ['League Updated Pot', 'El Matador Tire 2026-10-08T12:13:18.508Z $1200'], [['Current GW', 6]]);
    setImmediate(() => {
      check('a tab without a guard (Meta) still reads', got && got[0]['League Updated Pot'] === 'Current GW');
      check('installReadTab puts the guarded reader on window', L.x.installReadTab() === true && L.ctx.window.readTab === L.x.guardedReadTab && L.ctx.window.readTab.guarded === true);
      /* bug #3: GW Stats is read with a query, checked against the header, with the whole tab as the fallback */
      const GWS = LIVE['GW Stats'].split(',');
      check('queryProblem: the live GW Stats header has Owner in F and Mins in G; a moved column is named', L.x.queryProblem('GW Stats', GWS) === '' && /column F is "Mins", not Owner/.test(L.x.queryProblem('GW Stats', GWS.filter(c => c !== 'Owner'))) && L.x.queryProblem('Rosters', ['x']) === '');
      L = load(); got = null; err = null;
      L.x.guardedReadTab('GW Stats').then(r => { got = r; }, e => { err = e; });
      check('the GW Stats request carries the query (owned or played rows) after the sheet name', /&sheet=GW%20Stats&tq=select%20\*%20where%20G%20%3E%200%20or%20F%20is%20not%20null$/.test(L.scripts[0].src) && L.scripts.length === 1, L.scripts[0].src);
      answer(L, GWS, [[5, 1, 'A', 'MID', 'ARS', 'Cold Palmers', 0, 0], [5, 2, 'B', 'FWD', 'CHE', null, 90, 9]]);
      setImmediate(() => {
        check('a trimmed read whose header is right is used as is: one request, the rows', got && got.length === 2 && got[0].Owner === 'Cold Palmers' && L.scripts.length === 1 && !err, err && err.message);
        L = load(); got = null; err = null;
        L.x.guardedReadTab('GW Stats').then(r => { got = r; }, e => { err = e; });
        answer(L, ['GW', 'Code', 'Player', 'Pos', 'Club', 'Mins', 'Owner', 'Pts'], [[5, 2, 'B', 'FWD', 'CHE', 90, null, 9]]);
        setImmediate(() => {
          check('Owner and Mins swapped in the sheet: the trimmed answer is dropped and the whole tab is requested without a query', got === null && !err && L.scripts.length === 2 && !/tq=/.test(L.scripts[1].src) && /sheet=GW%20Stats$/.test(L.scripts[1].src), L.scripts.map(s => s.src).join(' | '));
          answer(L, ['GW', 'Code', 'Player', 'Pos', 'Club', 'Mins', 'Owner', 'Pts', 'Bonus'], [[5, 2, 'B', 'FWD', 'CHE', 90, null, 9, 0], [5, 3, 'C', 'DEF', 'LIV', 0, null, 0, 0]]);
          setImmediate(() => {
            check('... and the whole tab (header still valid for the engine) comes back', got && got.length === 2 && !err, err && err.message);
            check('only GW Stats has a query', Object.keys(L.x.QUERIES).join() === 'GW Stats');
            afterQueries();
          });
        });
      });
      function afterQueries() {
      /* the Meta time and the banner */
      const t = L.x.metaUpdated(['League Updated Pot', 'El Matador Tire 2026-10-08T12:13:18.508Z $1200'], [{ 'League Updated Pot': 'Current GW' }]);
      check('metaUpdated finds the refresh time in the header cell', t === Date.parse('2026-10-08T12:13:18.508Z'));
      check('metaUpdated with nothing: 0', L.x.metaUpdated([], []) === 0 && L.x.metaUpdated(['x'], [{ x: 'no time here' }]) === 0);
      const now = Date.parse('2026-10-08T15:00:00Z'), MIN = 60e3;
      check('fresh data: no banner', L.x.staleInfo(now - 119 * MIN, now, false) === null && L.x.staleInfo(0, now, false) === null);
      let st = L.x.staleInfo(now - 121 * MIN, now, false);
      check('2 h 1 min old, no match: the banner, with the age', st && st.min === 121 && /last refreshed 2 h 1 min ago/.test(st.text) && /may be out of date/.test(st.text), st && st.text);
      check('25 min old while a match is on: the banner; 15 min: none', L.x.staleInfo(now - 25 * MIN, now, true) !== null && L.x.staleInfo(now - 15 * MIN, now, true) === null);
      check('3 days old: said in days', /3 days ago/.test(L.x.staleInfo(now - 3 * 1440 * MIN, now, false).text));
      const cf = [{ 'Kickoff (UTC)': '2026-10-08T14:50:00Z' }, { 'Kickoff (UTC)': '2026-10-08T20:00:00Z' }];
      check('matchOn: a game 10 minutes in counts; one 5 hours away does not; 3 minutes before kick-off counts', L.x.matchOn(cf, now) === true && L.x.matchOn([cf[1]], now) === false && L.x.matchOn([{ 'Kickoff (UTC)': '2026-10-08T15:03:00Z' }], now) === true && L.x.matchOn([], now) === false);
      check('no em or en dashes in the banner text', !/[–—]/.test(L.x.staleInfo(now - 200 * MIN, now, false).text));
      console.log(fails ? fails + ' FAILED' : 'ALL PASS');
      process.exit(fails ? 1 : 0);
      }
    });
  });
});
