// Supabase parity report tests (fplgg/tools/parity/parity.js): the normalisation, the two parsers, the keys, one
// tab's comparison, the Markdown, the freshness line and main() through injected fetches. Plain Node.
//   node tests/parity.js
const fs = require('fs');
const P = require(__dirname + '/../fplgg/tools/parity/parity.js');
let fails = 0;
const check = (label, cond, info) => { if (!cond) fails++; console.log((cond ? 'PASS ' : 'FAIL ') + label + (!cond && info ? '  ' + info : '')); };
const now = Date.parse('2026-10-10T14:30:00Z');

/* ---------- the tab list stays in step with the app's sheet reader and the engine's alias ---------- */
const tabsSrc = fs.readFileSync(__dirname + '/../fplgg/tools/matchweek/src/data/tabs.js', 'utf8');
const appTabs = Object.keys(new Function(tabsSrc.replace(/^export (function|const|let)/gm, '$1') + '\n;return TABS;')());
check('the tabs compared are exactly the tabs the app reads (src/data/tabs.js TABS)', P.TABS.join('|') === appTabs.join('|'), P.TABS.join('|') + ' vs ' + appTabs.join('|'));
const league = JSON.parse(fs.readFileSync(__dirname + '/../fplgg/tools/matchweek/league.json', 'utf8'));
check('the alias is the league\'s aliases (league.json, the engine\'s TEAM_ALIAS)', JSON.stringify(league.aliases || {}) === JSON.stringify(P.ALIAS) && Object.keys(P.ALIAS).length >= 1, JSON.stringify(P.ALIAS));
P.TABS.forEach(t => check('keys for ' + t + ' are columns the app requires or the tab has', P.KEYS[t].length > 0));

/* ---------- norm ---------- */
check('numbers: 3, "3", 3.0, " 3 " and "\'3" are the same', ['3', 3, 3.0, ' 3 ', "'3"].every(v => P.norm(v) === '3'));
check('floats keep 6 decimals, no float noise', P.norm(0.1 + 0.2) === '0.3' && P.norm('1.10') === '1.1');
check('booleans: true, "TRUE", "true" and "\'TRUE" are TRUE', [true, 'TRUE', 'true', "'TRUE"].every(v => P.norm(v) === 'TRUE') && P.norm(false) === 'FALSE' && P.norm('False') === 'FALSE');
check('the leading apostrophe before a date is dropped', P.norm("'2026-08-21T17:30:00Z") === '2026-08-21T17:30:00Z' && P.norm('2026-08-21T17:30:00Z') === '2026-08-21T17:30:00Z');
check('null, undefined and "" are blank', P.norm(null) === '' && P.norm(undefined) === '' && P.norm('') === '' && P.norm('  ') === '');
check('the engine\'s alias maps the old team name', P.norm('Maize ‘n’ Mount') === 'I Am a Baleba' && P.norm('I Am a Baleba') === 'I Am a Baleba');
check('other strings are trimmed only', P.norm(' Cold Palmers ') === 'Cold Palmers' && P.norm('Denied (invalid)') === 'Denied (invalid)');

/* ---------- the parsers ---------- */
const gviz = (cols, rows) => '/*O_o*/\ngoogle.visualization.Query.setResponse(' + JSON.stringify({ version: '0.6', status: 'ok', table: { cols: cols.map(c => ({ label: c })), rows: rows.map(r => ({ c: r.map(v => v === null ? null : (typeof v === 'number' ? { v, f: String(v) } : { v })) })) } }) + ');';
let t = P.parseGviz(gviz(['GW', 'Deadline (UTC)', 'Finished', ''], [[1, '2026-08-21T17:30:00Z', true, 'junk'], [2, null, false, null]]));
check('parseGviz: labels become columns, empty labels dropped, v preferred, a null cell is blank', t.cols.join() === 'GW,Deadline (UTC),Finished' && t.rows.length === 2 && t.rows[0].GW === 1 && t.rows[0].Finished === true && t.rows[1]['Deadline (UTC)'] === '' && !('' in t.rows[0]), JSON.stringify(t));
let threw = ''; try { P.parseGviz('<html>sign in</html>'); } catch (e) { threw = e.message; }
check('parseGviz: not a gviz reply throws', /not a gviz reply/.test(threw));
threw = ''; try { P.parseGviz('google.visualization.Query.setResponse({"status":"error","errors":[{"reason":"invalid_query"}]});'); } catch (e) { threw = e.message; }
check('parseGviz: a gviz error throws with the reason', /gviz status error/.test(threw) && /invalid_query/.test(threw));
t = P.parseSupabase({ header: ['GW', 'Deadline (UTC)', 'Finished'], rows: [[1, "'2026-08-21T17:30:00Z", true], [2]] });
check('parseSupabase: header and rows, a short row is blank-filled', t.cols.join() === 'GW,Deadline (UTC),Finished' && t.rows[0]['Deadline (UTC)'] === "'2026-08-21T17:30:00Z" && t.rows[1].Finished === '');
t = P.parseSupabase({ header: null, rows: [['League', 'x']] });
check('parseSupabase: a tab without a header (Meta) has no columns', t.cols.length === 0 && t.rows.length === 1);
threw = ''; try { P.parseSupabase({ error: 'x' }); } catch (e) { threw = e.message; }
check('parseSupabase: not a tabs reply throws', /not a tabs reply/.test(threw));

/* ---------- keys ---------- */
let k = P.keyed('H2H Fixtures', [{ GW: 1, Home: 'A', Away: 'B' }, { GW: '1', Home: 'A', Away: 'B' }, { GW: 2, Home: 'A', Away: 'B' }]);
check('keyed: the key joins the normalised key columns; a repeated key gets #2', [...k.keys()].join(' ') === '1|A|B 1|A|B#2 2|A|B');
k = P.keyed('Something', [{ a: 1 }, { a: 2 }]);
check('keyed: a tab without keys is keyed by position', [...k.keys()].join(' ') === '#1 #2');

/* ---------- compareTab ---------- */
const T = (cols, rows) => ({ cols, rows: rows.map(r => { const o = {}; cols.forEach((c, i) => { o[c] = r[i]; }); return o; }) });
const sheet = T(['GW', 'Home', 'Home pts', 'Away', 'Away pts', 'Finished'], [[1, 'A', 36, 'B', 46, true], [1, 'C', 30, 'D', 31, true], [2, 'A', 0, 'C', 0, false]]);
let r = P.compareTab('H2H Fixtures', sheet, T(['GW', 'Home', 'Home pts', 'Away', 'Away pts', 'Finished'], [[1, 'A', '36', 'B', 46.0, 'TRUE'], [2, 'A', 0, 'C', 0, false], [1, 'C', 30, 'D', 31, true]]));
check('same rows in another order with "36", 46.0 and "TRUE": same', r.status === 'same' && r.rows.matched === 3 && r.rows.differing === 0 && r.columns.shared.length === 6, JSON.stringify(r.rows));
r = P.compareTab('H2H Fixtures', sheet, T(['GW', 'Home', 'Home pts', 'Away', 'Away pts', 'Finished'], [[1, 'A', 36, 'B', 44, true], [1, 'C', 30, 'D', 31, true]]));
check('a cell differing and a row missing: differs, the cell named with both values, the missing key listed', r.status === 'differs' && r.rows.differing === 1 && r.cells['Away pts'].n === 1 && r.cells['Away pts'].examples[0].key === '1|A|B' && r.cells['Away pts'].examples[0].sheet === '46' && r.cells['Away pts'].examples[0].supabase === '44' && r.rows.sheetOnly === 1 && r.rows.sheetOnlyKeys[0] === '2|A|C' && r.rows.supabaseOnly === 0, JSON.stringify(r));
r = P.compareTab('H2H Fixtures', sheet, T(['GW', 'Home', 'Home pts', 'Away', 'Away pts', 'Finished', 'Extra'], [[1, 'A', 36, 'B', 46, true, 'x'], [1, 'C', 30, 'D', 31, true, 'y'], [2, 'A', 0, 'C', 0, false, 'z'], [3, 'B', 0, 'D', 0, false, '']]));
check('a row only on Supabase and a column only on Supabase: differs, both named', r.status === 'differs' && r.rows.supabaseOnly === 1 && r.rows.supabaseOnlyKeys[0] === '3|B|D' && r.columns.supabaseOnly.join() === 'Extra' && r.rows.differing === 0);
r = P.compareTab('Matchweeks', T(['GW', 'Deadline (UTC)', 'Finished', 'Waivers (UTC)'], [[1, '2026-08-21T17:30:00Z', true, '2026-08-20T17:30:00Z']]), T(['GW', 'Deadline (UTC)', 'Finished'], [[1, "'2026-08-21T17:30:00Z", true]]));
check('a column the Sheet alone has, the shared data equal: "columns" status, the column named', r.status === 'columns' && r.columns.sheetOnly.join() === 'Waivers (UTC)' && r.rows.differing === 0, JSON.stringify(r));
r = P.compareTab('GW Stats', T(['GW', 'Code', 'Owner', 'Pts'], [[1, 494521, 'Maize ‘n’ Mount', 5]]), T(['GW', 'Code', 'Owner', 'Pts'], [[1, 494521, 'I Am a Baleba', 5]]));
check('the old team name in the Sheet equals the aliased name on Supabase', r.status === 'same');
r = P.compareTab('Predictions', T(['GW', 'Code', 'EP', 'Captured (UTC)'], [[3, 1, 6, '2026-09-04T17:15:58Z'], [3, 2, 5, '2026-09-04T17:15:58Z']]), T(['GW', 'Code', 'EP', 'Captured (UTC)'], [[3, 1, 6, "'2026-09-04T17:07:03Z"], [3, 2, 4, "'2026-09-04T17:07:03Z"]]));
check('a clock column differing is listed under clock, not counted; a real cell still counts', r.status === 'differs' && r.rows.differing === 1 && r.clock['Captured (UTC)'].n === 2 && !r.cells['Captured (UTC)'] && r.cells.EP.n === 1, JSON.stringify(r));
r = P.compareTab('Predictions', T(['GW', 'Code', 'EP', 'Captured (UTC)'], [[3, 1, 6, '2026-09-04T17:15:58Z']]), T(['GW', 'Code', 'EP', 'Captured (UTC)'], [[3, 1, 6, "'2026-09-04T17:07:03Z"]]));
check('only a clock column differing: same', r.status === 'same' && r.clock['Captured (UTC)'].n === 1);
r = P.compareTab('Managers', T(['Team', 'Color'], [['A', '#fff']]), null);
check('Supabase 404: missing, the Sheet\'s rows and columns kept', r.status === 'missing' && r.rows.sheet === 1 && r.columns.sheetOnly.join() === 'Team,Color');
r = P.compareTab('Fixture BPS', T(['GW', 'Fixture', 'Code'], []), T(['GW', 'Fixture', 'Code'], []));
check('both empty with the same header: empty', r.status === 'empty');
r = P.compareTab('Players', { error: 'HTTP 500' }, T(['Code'], [[1]]));
check('the Sheet failing: error naming the Sheet', r.status === 'error' && /the Sheet: HTTP 500/.test(r.error));
r = P.compareTab('Players', T(['Code'], [[1]]), { error: 'fetch failed' });
check('Supabase failing: error naming Supabase', r.status === 'error' && /Supabase: fetch failed/.test(r.error));
const big = []; for (let i = 0; i < 10; i++) big.push([1, i, i]);
r = P.compareTab('GW Stats', T(['GW', 'Code', 'Pts'], big), T(['GW', 'Code', 'Pts'], big.map(x => [x[0], x[1], x[2] + 1])));
check('examples are capped at 3 while the count is complete', r.cells.Pts.n === 10 && r.cells.Pts.examples.length === 3);
check('groupKeys groups by the first key column for multi-column keys, lists keys otherwise', P.groupKeys('Predictions', ['2|1', '2|2', '3|1']) === 'GW 2: 2, GW 3: 1' && P.groupKeys('Players', ['1', '2']) === '1, 2' && P.groupKeys('Players', []) === '');

/* ---------- freshness ---------- */
const meta = T(['League', 'Updated'], [['El Matador Tire', '2026-10-10T14:14:42.433Z']]);
const health = { leagues: [{ league: 45380, standingsUpdated: '2026-10-10T14:07:03.676+00:00' }], runs: [{ finished_at: '2026-10-10T14:07:05+00:00' }] };
const cf = T(['GW', 'Home', 'Away', 'Kickoff (UTC)'], [[6, 'ARS', 'CHE', "'2026-10-10T13:30:00Z"]]);
let f = P.freshness(meta, health, cf, now);
check('freshness: the Sheet\'s Meta time, Supabase\'s +00:00 time as UTC, the gap, a match on', f.sheet === '2026-10-10T14:14:42Z' && f.supabase === '2026-10-10T14:07:03Z' && f.gapMin === 8 && f.live === true, JSON.stringify(f));
f = P.freshness({ error: 'x' }, { error: 'y' }, null, now);
check('freshness without either source: unknown, no gap, no match', f.sheet === '' && f.supabase === '' && f.gapMin === null && f.live === false);
f = P.freshness(meta, { runs: [{ finished_at: '2026-10-10T13:07:05+00:00' }], leagues: [] }, cf, now + 3 * 3600e3);
check('freshness falls back to the last run and sees no match 3 hours after kick-off', f.supabase === '2026-10-10T13:07:05Z' && f.live === false);

/* ---------- markdown ---------- */
const rep = { at: '2026-10-10T14:30:00Z', league: 45380, fresh: { sheet: '2026-10-10T14:14:42Z', supabase: '2026-10-10T14:07:03Z', gapMin: 8, live: true }, tabs: [
  P.compareTab('H2H Fixtures', sheet, T(['GW', 'Home', 'Home pts', 'Away', 'Away pts', 'Finished'], [[1, 'A', 36, 'B', 44, true], [1, 'C', 30, 'D', 31, true]])),
  P.compareTab('Matchweeks', T(['GW', 'Deadline (UTC)', 'Waivers (UTC)'], [[1, 'x', 'y']]), T(['GW', 'Deadline (UTC)'], [[1, 'x']])),
  P.compareTab('Managers', T(['Team'], [['A']]), null),
  P.compareTab('Players', { error: 'HTTP 500' }, null),
  P.compareTab('Predictions', T(['GW', 'Code', 'Captured (UTC)'], [[3, 1, 'a']]), T(['GW', 'Code', 'Captured (UTC)'], [[3, 1, 'b']])),
] };
rep.summary = P.summarise(rep.tabs);
const md = P.markdown(rep);
check('summary counts each status', rep.summary.differs === 1 && rep.summary.columns === 1 && rep.summary.missing === 1 && rep.summary.error === 1 && rep.summary.same === 1);
check('markdown: the headline, the freshness line with the match, one table row per tab', /^## Supabase parity: league 45380, 2026-10-10T14:30:00Z/.test(md) && /1 of 5 tabs differ, 1 not on Supabase, 1 could not be compared; 2 agree\./.test(md) && /8 minutes apart\)\. A match is on/.test(md) && (md.match(/^\| (H2H Fixtures|Matchweeks|Managers|Players|Predictions) \|/gm) || []).length === 5, md);
check('markdown: the differing tab gets a section with the missing row and the cell', /### H2H Fixtures\n- Only in the Sheet \(1\): GW 2: 1\n- Away pts: 1 cells differ, e\.g\. 1\|A\|B is `46` in the Sheet and `44` on Supabase/.test(md), md);
check('markdown: the column the Sheet alone has is in the table; the 404 and the error are said', /\| Matchweeks \| same data, columns differ \| 1 \/ 1 \| 2 shared, Sheet only: Waivers \(UTC\) \| none \|/.test(md) && /\| Managers \| not on Supabase \| 1 \/ none \| Supabase answers 404 \| none \|/.test(md) && /\| Players \| could not compare \|  \|  \| the Sheet: HTTP 500 \|/.test(md), md);
check('markdown: a clock-only difference gets its own section and is not counted', /\| Predictions \| same \| 1 \/ 1 \| 3 shared \| Captured \(UTC\) differs in 1 rows \(each pipeline's own clock, not counted\) \|/.test(md) && /### Predictions \(clock columns only\)\n- Captured \(UTC\): 1 cells differ/.test(md), md);
check('markdown: no em or en dashes of its own, no emoji', !/[–—]/.test(md) && !/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(md));
const allSame = { at: 'x', league: 45380, fresh: { sheet: '', supabase: '', gapMin: null, live: false }, tabs: [P.compareTab('Standings', T(['Team'], [['A']]), T(['Team'], [['A']]))] }; allSame.summary = P.summarise(allSame.tabs);
check('markdown: every tab agreeing says so; unknown freshness is said', /Every tab agrees with the Sheet\./.test(P.markdown(allSame)) && /refreshed from FPL at unknown, Supabase at unknown\. No match is on\./.test(P.markdown(allSame)));

/* ---------- main, through injected fetches ---------- */
function world(opts) {
  opts = opts || {};
  const cols = { 'H2H Fixtures': ['GW', 'Home', 'Home pts', 'Away', 'Away pts', 'Finished'] };
  const rowsOf = n => n === 'H2H Fixtures' ? [[1, 'A', 36, 'B', 46, true]] : n === 'Meta' ? [['Updated', '2026-10-10T14:14:42.433Z']] : [];
  const urls = [];
  const fetchText = async url => {
    urls.push(url);
    const name = decodeURIComponent((/sheet=([^&]+)/.exec(url) || /\/tab\/([^?]+)$/.exec(url) || [])[1] || '');
    if (/supabase/.test(url)) {
      if (opts.sbDown) return { status: 0, error: 'fetch failed' };
      if (/\/health$/.test(url)) return { status: 200, text: JSON.stringify({ leagues: [{ league: 45380, standingsUpdated: '2026-10-10T14:07:03+00:00' }] }) };
      if (name === 'Managers' || name === 'Social' || name === 'Posts' || name === 'Fixture BPS') return { status: 404, text: '{"error":"no such tab"}' };
      const rows = rowsOf(name); if (name === 'H2H Fixtures' && opts.sbScore) rows[0][4] = opts.sbScore;
      return { status: 200, text: JSON.stringify({ header: cols[name] || ['GW'], rows }) };
    }
    if (opts.sheetDown) return { status: 0, error: 'ENOTFOUND' };
    return { status: 200, text: gviz(cols[name] || (name === 'Meta' ? ['League', 'Updated'] : ['GW']), rowsOf(name)) };
  };
  return { fetchText, urls };
}
(async () => {
  let w = world(), lines = [];
  let res = await P.main({ fetchText: w.fetchText, now: () => now, log: m => lines.push(m) });
  check('all tabs read from both sides: exit 0, 18 tabs, the 4 absent ones missing, the rest agree', res.code === 0 && res.report.tabs.length === 18 && res.report.summary.missing === 4 && res.report.summary.same + res.report.summary.empty === 14 && res.report.summary.differs === 0, JSON.stringify(res.report.summary));
  check('the report carries the time, the league, the freshness and the markdown', res.report.at === '2026-10-10T14:30:00Z' && res.report.league === 45380 && res.report.fresh.sheet === '2026-10-10T14:14:42Z' && res.report.fresh.supabase === '2026-10-10T14:07:03Z' && /^## Supabase parity/.test(res.report.md));
  check('every tab was asked of both sources, plus Meta and /health', P.TABS.every(t => w.urls.some(u => u === P.gvizUrl(t)) && w.urls.some(u => u === P.sbUrl(t))) && w.urls.some(u => /sheet=Meta/.test(u)) && w.urls.some(u => /\/health$/.test(u)));
  check('one log line per tab and a closing line', lines.filter(l => /^(ok|DIFFERS|missing|ERROR)/.test(l)).length === 18 && /^compared 18 tabs: 0 differ, 4 not on Supabase, 14 agree$/.test(lines[lines.length - 1]), lines[lines.length - 1]);
  w = world({ sbScore: 44 }); lines = [];
  res = await P.main({ fetchText: w.fetchText, now: () => now, log: m => lines.push(m) });
  check('a score differing on Supabase: exit 0 still, the tab differs, the log says so', res.code === 0 && res.report.summary.differs === 1 && lines.some(l => /^DIFFERS H2H Fixtures: 1 \/ 1 rows, 1 differ$/.test(l)), lines.join('\n'));
  w = world({ sbDown: true }); lines = [];
  res = await P.main({ fetchText: w.fetchText, now: () => now, log: m => lines.push(m) });
  check('Supabase down: every tab is an error, exit 1', res.code === 1 && res.report.summary.error === 18 && res.report.fresh.supabase === '' && /nothing could be compared/.test(lines[lines.length - 1]));
  w = world({ sheetDown: true }); lines = [];
  res = await P.main({ fetchText: w.fetchText, now: () => now, log: m => lines.push(m) });
  check('the Sheet down: every tab is an error naming the Sheet, exit 1', res.code === 1 && res.report.tabs.every(t => t.status === 'error' && /the Sheet: ENOTFOUND/.test(t.error)));
  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})();
