/* fplgg/tools/demo/snapshot.js — reads every tab the engine reads from the league's Sheet over gviz, exactly as the
   app does (out:json, headers=1, the formatted value f over the raw v, null as '', the GW Stats trimmed query), so the
   demo's frozen tabs are the rows a phone would have loaded. Plain Node 18+ (global fetch). */
'use strict';
const SHEET = '1rIj4A3-lkSfg1rTuAh3yJL-K7LP4EOYkwWZiItZaoHk';
/* the tabs the engine reads (core.js __loadBase and loadProfilesData), in the order they are read */
const TABS = ['Rosters', 'Standings', 'H2H Fixtures', 'Matchweeks', 'Club Fixtures', 'Clubs', 'Specials', 'EA Map', 'FC27', 'Transactions',
  'Predictions', 'GW Stats', 'Players', 'GW Log', 'Fixture BPS', 'Managers', 'Social', 'Posts'];
/* the same trimmed read the app uses for GW Stats (src/data/tabs.js QUERIES), with its header check */
const QUERIES = { 'GW Stats': { tq: 'select * where G > 0 or F is not null', at: { F: 'Owner', G: 'Mins' } } };
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const gvizUrl = (name, tq) => 'https://docs.google.com/spreadsheets/d/' + SHEET + '/gviz/tq?tqx=out:json&headers=1&sheet=' + encodeURIComponent(name) + (tq ? '&tq=' + encodeURIComponent(tq) : '');
/* { cols, rows } from gviz's JSONP text, shaped as the app's readRaw shapes it (canonTeam is not applied: the names are
   replaced wholesale by the anonymiser, and an alias row is just another cell to it) */
function parseGviz(text, name) {
  const a = text.indexOf('('), b = text.lastIndexOf(')');
  if (a < 0 || b < a) throw new Error(name + ': not a gviz reply');
  const j = JSON.parse(text.slice(a + 1, b));
  if (!j || !j.table) throw new Error(name + ': no table (' + (j && j.status) + ' ' + ((j && j.errors || []).map(e => e.message).join('; ')) + ')');
  const cols = j.table.cols.map(c => c.label || c.id);
  const rows = (j.table.rows || []).map(row => { const o = {}; (row.c || []).forEach((c, i) => { if (!cols[i]) return; let v = c ? ((c.f !== undefined && c.f !== null) ? c.f : c.v) : ''; o[cols[i]] = v === null || v === undefined ? '' : (typeof v === 'string' ? v : String(v)); }); return o; });
  return { cols, rows };
}
async function fetchText(url, fetchFn) {
  const r = await (fetchFn || fetch)(url, { headers: { accept: 'text/plain,*/*' } });
  if (!r.ok) throw new Error('HTTP ' + r.status + ' for ' + url);
  return r.text();
}
/* one tab, trimmed where the app trims; a trimmed read whose header is not where the query expects falls back to the whole tab */
async function readTab(name, fetchFn) {
  const q = QUERIES[name];
  if (!q) return parseGviz(await fetchText(gvizUrl(name), fetchFn), name);
  const t = parseGviz(await fetchText(gvizUrl(name, q.tq), fetchFn), name);
  const bad = Object.keys(q.at).filter(L => t.cols[LETTERS.indexOf(L)] !== q.at[L]);
  if (!bad.length) return t;
  return parseGviz(await fetchText(gvizUrl(name), fetchFn), name);
}
/* gviz answers an unknown tab with the first sheet (the draft grades); a tab whose header lacks what the engine needs is
   reported, not written: an optional tab is left out (empty in the demo), a required one fails the snapshot */
const NEED = {
  Rosters: ['Team', 'Player', 'Pos', 'Club', 'Code'], Standings: ['Team', 'W', 'D', 'L', 'League Pts'], 'H2H Fixtures': ['GW', 'Home', 'Away', 'Finished'],
  Matchweeks: ['GW', 'Deadline (UTC)'], 'Club Fixtures': ['GW', 'Home', 'Away', 'Kickoff (UTC)'], Clubs: ['Short', 'Badge code'], Specials: ['Setting', 'Value'],
  'EA Map': ['ea_player_id|EA ID'], FC27: ['fpl_code'], Transactions: ['GW', 'Team', 'In', 'Out'], Predictions: ['GW', 'Code', 'EP'], 'GW Stats': ['GW', 'Code', 'Mins', 'Pts'],
  Players: ['Code', 'Player', 'Pos', 'Club', 'Owner'], 'GW Log': ['GW', 'Team', 'Code'], Managers: ['Team', 'Color', 'Shape'], Social: ['When (UTC)', 'Team', 'Kind', 'Target', 'Value'],
  Posts: ['When (UTC)', 'Id', 'Voice', 'Kind', 'Text'], 'Fixture BPS': ['GW', 'Home', 'Away', 'Code', 'BPS', 'Bonus'],
};
const REQUIRED = ['Rosters', 'Standings', 'H2H Fixtures', 'Matchweeks', 'Players'];
function headerProblem(name, cols) {
  const need = NEED[name] || [], have = new Set(cols.map(String));
  const miss = need.filter(c => !c.split('|').some(x => have.has(x)));
  return miss.length ? 'missing ' + miss.join(', ') : '';
}
/* every tab: { tabs: { name: { cols, rows } }, skipped: { name: why }, taken: ISO }. skip: tab names not to read at all
   (the demo build leaves the EA tabs out, Parker, 9 Oct 2026) */
async function snapshot(fetchFn, log, skip) {
  const tabs = {}, skipped = {}, left = new Set(skip || []);
  for (const name of TABS) {
    if (left.has(name)) continue;
    let t;
    try { t = await readTab(name, fetchFn); } catch (e) { if (REQUIRED.includes(name)) throw e; skipped[name] = String(e && e.message || e); continue; }
    const why = headerProblem(name, t.cols);
    if (why) { if (REQUIRED.includes(name)) throw new Error(name + ': ' + why); skipped[name] = why; continue; }
    tabs[name] = t;
    if (log) log(name + ': ' + t.rows.length + ' rows');
  }
  return { tabs, skipped, taken: new Date().toISOString() };
}
module.exports = { SHEET, TABS, QUERIES, NEED, REQUIRED, gvizUrl, parseGviz, readTab, headerProblem, snapshot };
