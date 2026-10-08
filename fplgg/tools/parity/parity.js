#!/usr/bin/env node
/* parity.js — the Supabase parity report (ROADMAP B2), no AI and no PC. .github/workflows/parity.yml runs it every
   3 hours and on demand, through one live gameweek and after.
   The league's data has two pipelines: the Google Sheet that the app reads today (Code.gs writes it from FPL every
   hour and every few minutes while a match is on), and the Supabase project's own ingest (hourly, at :07), served by
   its public read-only `tabs` function as /league/<fpl league id>/tab/<name>: { header: [...], rows: [[...]] }, the
   same tab names and columns the Sheet has. Before the app can switch to Supabase (B3) the two must agree, tab for
   tab, through a live gameweek. This script reads every tab the app's engine reads from both sides, compares them and
   writes a report: columns one side lacks, rows one side lacks, and cells that differ in the columns both have.
   The Sheet is the reference: "sheet only" means Supabase lacks it.
   Values are compared after one normalisation on both sides: numbers as numbers (3, "3" and 3.0 are the same), TRUE
   and FALSE as booleans, strings trimmed, and the leading apostrophe Code.gs and the ingest write before a date so a
   sheet keeps it as text dropped. Rows are matched by a key per tab (KEYS), never by position.
     node parity.js                              compare and print the report
     node parity.js --out report.json --md report.md   also write the JSON and the Markdown
   Exit 0 whenever at least one tab could be compared (differences are the report, not a red run), 1 when nothing
   could be compared (neither side reachable). Nothing here uses a secret: both sources are public, read only. */
'use strict';
const fs = require('fs');

const SHEET = process.env.MW_SHEET || '1rIj4A3-lkSfg1rTuAh3yJL-K7LP4EOYkwWZiItZaoHk';
const LEAGUE = Number(process.env.MW_LEAGUE || 45380);
const SB_BASE = (process.env.MW_SUPABASE_BASE || 'https://vcokquhzqpqvwrybndnr.supabase.co/functions/v1/tabs').replace(/\/$/, '');
const TIMEOUT_MS = 60e3, EXAMPLES = 3, LIST = 8;
/* the tabs the app's engine reads (readTab calls in core.gen.js; the same list as TABS in src/data/tabs.js, which
   tests/parity.js checks), with the columns that identify a row. A key column is normalised like any value. */
const KEYS = {
  Rosters: ['Team', 'Code'],
  Standings: ['Team'],
  'H2H Fixtures': ['GW', 'Home', 'Away'],
  Matchweeks: ['GW'],
  'Club Fixtures': ['GW', 'Home', 'Away'],
  Clubs: ['Short'],
  Specials: ['Setting'],
  'EA Map': ['fpl_code'],
  FC27: ['fpl_code'],
  Transactions: ['When (UTC)', 'Team', 'In', 'Out'],
  Predictions: ['GW', 'Code'],
  'GW Stats': ['GW', 'Code'],
  Players: ['Code'],
  'GW Log': ['GW', 'Team', 'Code'],
  Managers: ['Team'],
  Social: ['When (UTC)', 'Team', 'Kind', 'Target'],
  Posts: ['Id'],
  'Fixture BPS': ['GW', 'Fixture', 'Code'],
};
const TABS = Object.keys(KEYS);
/* the engine's TEAM_ALIAS (core.gen.js): the app maps every value through it, so both sides are compared as the app
   sees them (tests/parity.js keeps this in step with the engine) */
const ALIAS = { 'Maize ‘n’ Mount': 'I Am a Baleba' };
/* each pipeline's own write time: compared and listed, but never a data difference */
const CLOCK = ['Captured (UTC)', 'Logged (UTC)'];
const STATUS = { same: 'same', columns: 'same data, columns differ', differs: 'differs', missing: 'not on Supabase', empty: 'empty on both', error: 'could not compare' };
const stamp = ms => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');

/* ---------- normalisation ---------- */
function norm(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (typeof v === 'number') return isFinite(v) ? String(+v.toFixed(6)) : String(v);
  let s = String(v).trim();
  if (s.charAt(0) === "'") s = s.slice(1).trim();
  if (/^(true|false)$/i.test(s)) return s.toUpperCase();
  if (/^-?\d+(\.\d+)?$/.test(s)) return String(+(+s).toFixed(6));
  return ALIAS[s] || s;
}
/* a table as { cols: [...], rows: [{col: value}] } from gviz JSON (the Sheet) */
function parseGviz(text) {
  const m = /setResponse\(([\s\S]*)\);?\s*$/.exec(String(text || ''));
  if (!m) throw new Error('not a gviz reply');
  const j = JSON.parse(m[1]);
  if (!j || j.status !== 'ok' || !j.table) throw new Error('gviz status ' + (j && j.status) + (j && j.errors ? ': ' + JSON.stringify(j.errors).slice(0, 120) : ''));
  const cols = (j.table.cols || []).map(c => String(c.label || '').trim());
  const rows = (j.table.rows || []).map(r => { const o = {}; (r.c || []).forEach((c, i) => { if (!cols[i]) return; o[cols[i]] = c ? (c.v !== null && c.v !== undefined ? c.v : (c.f !== undefined && c.f !== null ? c.f : '')) : ''; }); return o; });
  return { cols: cols.filter(Boolean), rows };
}
/* the same from the tabs function's { header, rows } */
function parseSupabase(j) {
  if (!j || !Array.isArray(j.rows)) throw new Error('not a tabs reply');
  const cols = (j.header || []).map(c => String(c === null || c === undefined ? '' : c).trim());
  const rows = j.rows.map(r => { const o = {}; cols.forEach((c, i) => { if (c) o[c] = Array.isArray(r) ? (r[i] === undefined ? '' : r[i]) : ''; }); return o; });
  return { cols: cols.filter(Boolean), rows };
}
/* rows by key; a repeated key gets #2, #3... so duplicates still pair up */
function keyed(name, rows) {
  const kc = KEYS[name] || [], out = new Map(), seen = {};
  rows.forEach((r, i) => {
    let k = kc.length ? kc.map(c => norm(r[c])).join('|') : '#' + (i + 1);
    const n = (seen[k] = (seen[k] || 0) + 1); if (n > 1) k += '#' + n;
    out.set(k, r);
  });
  return out;
}
/* a row set that is empty of content (a header-only tab) */
const blank = t => !t.rows.length;

/* ---------- one tab ---------- */
function compareTab(name, sheet, sb) {
  const r = { name, status: 'same', columns: { shared: [], sheetOnly: [], supabaseOnly: [] }, rows: { sheet: 0, supabase: 0, matched: 0, sheetOnly: 0, supabaseOnly: 0, sheetOnlyKeys: [], supabaseOnlyKeys: [], differing: 0 }, cells: {}, clock: {} };
  if (sheet && sheet.error) { r.status = 'error'; r.error = 'the Sheet: ' + sheet.error; return r; }
  if (sb && sb.error) { r.status = 'error'; r.error = 'Supabase: ' + sb.error; return r; }
  if (!sb) { r.status = 'missing'; r.rows.sheet = sheet.rows.length; r.columns.sheetOnly = sheet.cols.slice(); return r; }
  const sc = sheet.cols, bc = sb.cols;
  r.columns.shared = sc.filter(c => bc.includes(c));
  r.columns.sheetOnly = sc.filter(c => !bc.includes(c));
  r.columns.supabaseOnly = bc.filter(c => !sc.includes(c));
  r.rows.sheet = sheet.rows.length; r.rows.supabase = sb.rows.length;
  const A = keyed(name, sheet.rows), B = keyed(name, sb.rows);
  for (const [k, a] of A) {
    const b = B.get(k);
    if (!b) { r.rows.sheetOnly++; r.rows.sheetOnlyKeys.push(k); continue; }
    r.rows.matched++;
    let diff = false;
    r.columns.shared.forEach(c => {
      const x = norm(a[c]), y = norm(b[c]);
      if (x === y) return;
      const into = CLOCK.includes(c) ? r.clock : r.cells;
      if (into === r.cells) diff = true;
      const cell = into[c] || (into[c] = { n: 0, examples: [] });
      cell.n++; if (cell.examples.length < EXAMPLES) cell.examples.push({ key: k, sheet: x, supabase: y });
    });
    if (diff) r.rows.differing++;
  }
  for (const k of B.keys()) if (!A.has(k)) { r.rows.supabaseOnly++; r.rows.supabaseOnlyKeys.push(k); }
  const dataDiff = r.rows.sheetOnly || r.rows.supabaseOnly || r.rows.differing;
  const colDiff = r.columns.sheetOnly.length || r.columns.supabaseOnly.length;
  r.status = dataDiff ? 'differs' : colDiff ? 'columns' : (blank(sheet) && blank(sb)) ? 'empty' : 'same';
  return r;
}
/* "GW 3: 619, GW 4: 2" for keys whose first part groups them, else the first few keys */
function groupKeys(name, keys) {
  if (!keys.length) return '';
  const kc = KEYS[name] || [];
  if (kc.length > 1) {
    const g = {}; keys.forEach(k => { const p = k.split('|')[0]; g[p] = (g[p] || 0) + 1; });
    const parts = Object.keys(g).map(p => kc[0] + ' ' + p + ': ' + g[p]);
    return parts.slice(0, LIST).join(', ') + (parts.length > LIST ? ', and ' + (parts.length - LIST) + ' more' : '');
  }
  return keys.slice(0, LIST).join(', ') + (keys.length > LIST ? ', and ' + (keys.length - LIST) + ' more' : '');
}

/* ---------- the report ---------- */
function summarise(tabs) {
  const s = { same: 0, columns: 0, differs: 0, missing: 0, empty: 0, error: 0 };
  tabs.forEach(t => { s[t.status] = (s[t.status] || 0) + 1; });
  return s;
}
const q = s => '`' + String(s === '' ? '(blank)' : s).replace(/`/g, "'") + '`';
function markdown(rep) {
  const L = [];
  const s = rep.summary, agree = s.same + s.columns + s.empty;
  L.push('## Supabase parity: league ' + rep.league + ', ' + rep.at);
  L.push('');
  L.push(agree === rep.tabs.length ? 'Every tab agrees with the Sheet.' : (s.differs + ' of ' + rep.tabs.length + ' tabs differ' + (s.missing ? ', ' + s.missing + ' not on Supabase' : '') + (s.error ? ', ' + s.error + ' could not be compared' : '') + '; ' + agree + ' agree.'));
  L.push('');
  L.push('Freshness: the Sheet was refreshed from FPL at ' + (rep.fresh.sheet || 'unknown') + ', Supabase at ' + (rep.fresh.supabase || 'unknown') + (rep.fresh.gapMin !== null ? ' (' + rep.fresh.gapMin + ' minutes apart)' : '') + '. ' + (rep.fresh.live ? 'A match is on, so live columns can differ by timing alone.' : 'No match is on.'));
  L.push('');
  L.push('| Tab | Status | Rows (Sheet / Supabase) | Columns | Differences |');
  L.push('|---|---|---|---|---|');
  rep.tabs.forEach(t => {
    const rows = t.status === 'error' ? '' : t.status === 'missing' ? t.rows.sheet + ' / none' : t.rows.sheet + ' / ' + t.rows.supabase;
    const cols = t.status === 'error' ? '' : t.status === 'missing' ? 'Supabase answers 404' : (t.columns.shared.length + ' shared' + (t.columns.sheetOnly.length ? ', Sheet only: ' + t.columns.sheetOnly.join(', ') : '') + (t.columns.supabaseOnly.length ? ', Supabase only: ' + t.columns.supabaseOnly.join(', ') : ''));
    const d = [];
    if (t.status === 'error') d.push(t.error);
    else if (t.status !== 'missing') {
      if (t.rows.sheetOnly) d.push(t.rows.sheetOnly + ' rows only in the Sheet');
      if (t.rows.supabaseOnly) d.push(t.rows.supabaseOnly + ' rows only on Supabase');
      if (t.rows.differing) d.push(t.rows.differing + ' of ' + t.rows.matched + ' matched rows differ in ' + Object.keys(t.cells).length + ' columns');
      Object.keys(t.clock).forEach(c => d.push(c + ' differs in ' + t.clock[c].n + ' rows (each pipeline\'s own clock, not counted)'));
    }
    L.push('| ' + t.name + ' | ' + STATUS[t.status] + ' | ' + rows + ' | ' + cols + ' | ' + (d.join('; ') || 'none') + ' |');
  });
  rep.tabs.filter(t => t.status === 'differs').forEach(t => {
    L.push(''); L.push('### ' + t.name);
    if (t.rows.sheetOnly) L.push('- Only in the Sheet (' + t.rows.sheetOnly + '): ' + groupKeys(t.name, t.rows.sheetOnlyKeys));
    if (t.rows.supabaseOnly) L.push('- Only on Supabase (' + t.rows.supabaseOnly + '): ' + groupKeys(t.name, t.rows.supabaseOnlyKeys));
    Object.keys(t.cells).forEach(c => { const cell = t.cells[c]; L.push('- ' + c + ': ' + cell.n + ' cells differ, e.g. ' + cell.examples.map(e => e.key + ' is ' + q(e.sheet) + ' in the Sheet and ' + q(e.supabase) + ' on Supabase').join('; ')); });
  });
  rep.tabs.filter(t => t.status !== 'differs' && Object.keys(t.clock).length).forEach(t => {
    L.push(''); L.push('### ' + t.name + ' (clock columns only)');
    Object.keys(t.clock).forEach(c => { const cell = t.clock[c]; L.push('- ' + c + ': ' + cell.n + ' cells differ, e.g. ' + cell.examples.map(e => e.key + ' is ' + q(e.sheet) + ' in the Sheet and ' + q(e.supabase) + ' on Supabase').join('; ')); });
  });
  L.push('');
  L.push('Keys: ' + TABS.map(t => t + ' by ' + KEYS[t].join(' + ')).join('; ') + '. Clock columns (compared, never counted): ' + CLOCK.join(', ') + '. The Sheet is the reference. Run by .github/workflows/parity.yml (fplgg/tools/parity/parity.js).');
  return L.join('\n') + '\n';
}

/* ---------- freshness: the Sheet's Meta tab and Supabase's /health ---------- */
const ISO = /\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:?\d\d)/;
/* the first time in the cells, as a UTC stamp (Supabase writes +00:00 offsets, the Sheet Z) */
function firstIso(cells) { for (const c of cells) { const m = ISO.exec(String(c === null || c === undefined ? '' : c)); if (m && !isNaN(Date.parse(m[0]))) return stamp(Date.parse(m[0])); } return ''; }
function freshness(meta, health, clubFixtures, now) {
  const sheet = meta && !meta.error ? firstIso(meta.cols.concat(meta.rows.flatMap(r => Object.values(r)))) : '';
  let supabase = '';
  if (health && !health.error) { const lg = (health.leagues || []).find(l => Number(l.league) === LEAGUE) || (health.leagues || [])[0]; supabase = lg && lg.standingsUpdated ? firstIso([lg.standingsUpdated]) : firstIso((health.runs || []).map(r => r.finished_at)); }
  const a = Date.parse(sheet), b = Date.parse(supabase);
  const gapMin = !isNaN(a) && !isNaN(b) ? Math.round(Math.abs(a - b) / 60e3) : null;
  const live = (clubFixtures && !clubFixtures.error ? clubFixtures.rows : []).some(f => { const k = Date.parse(norm(f['Kickoff (UTC)'])); return !isNaN(k) && now >= k - 5 * 60e3 && now <= k + 135 * 60e3; });
  return { sheet, supabase, gapMin, live };
}

/* ---------- the fetches ---------- */
async function fetchText(url) {
  const ac = new AbortController(), t = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try { const r = await fetch(url, { signal: ac.signal, redirect: 'follow', headers: { 'user-agent': 'matchweek-parity' } }); return { status: r.status, text: await r.text() }; }
  catch (e) { return { status: 0, error: String(e && e.message || e).split('\n')[0].slice(0, 120) }; }
  finally { clearTimeout(t); }
}
const gvizUrl = name => 'https://docs.google.com/spreadsheets/d/' + SHEET + '/gviz/tq?tqx=out:json&headers=1&sheet=' + encodeURIComponent(name);
const sbUrl = name => SB_BASE + '/league/' + LEAGUE + '/tab/' + encodeURIComponent(name);
const bad = r => !r ? 'no answer' : r.error ? r.error : 'HTTP ' + r.status;
async function readSheet(ft, name) {
  const r = await ft(gvizUrl(name));
  if (!r || r.status !== 200) return { error: bad(r) };
  try { return parseGviz(r.text); } catch (e) { return { error: String(e.message).slice(0, 120) }; }
}
/* null when the tab does not exist on Supabase (404) */
async function readSupabase(ft, name) {
  const r = await ft(sbUrl(name));
  if (r && r.status === 404) return null;
  if (!r || r.status !== 200) return { error: bad(r) };
  try { return parseSupabase(JSON.parse(r.text)); } catch (e) { return { error: String(e.message).slice(0, 120) }; }
}
async function readHealth(ft) {
  const r = await ft(SB_BASE + '/health');
  if (!r || r.status !== 200) return { error: bad(r) };
  try { return JSON.parse(r.text); } catch (e) { return { error: 'not JSON' }; }
}

/* ---------- main ---------- */
async function main(deps) {
  deps = Object.assign({ fetchText, now: () => Date.now(), log: m => console.log(m) }, deps || {});
  const ft = deps.fetchText, now = deps.now();
  const [meta, health] = await Promise.all([readSheet(ft, 'Meta'), readHealth(ft)]);
  const tabs = [];
  let clubFixtures = null;
  for (const name of TABS) {
    const [sheet, sb] = await Promise.all([readSheet(ft, name), readSupabase(ft, name)]);
    if (name === 'Club Fixtures') clubFixtures = sheet;
    const t = compareTab(name, sheet, sb);
    tabs.push(t);
    deps.log((t.status === 'same' || t.status === 'empty' || t.status === 'columns' ? 'ok      ' : t.status === 'differs' ? 'DIFFERS ' : t.status === 'missing' ? 'missing ' : 'ERROR   ') + name + (t.status === 'error' ? ': ' + t.error : t.status === 'missing' ? ': Supabase answers 404 (' + t.rows.sheet + ' rows in the Sheet)' : ': ' + t.rows.sheet + ' / ' + t.rows.supabase + ' rows' + (t.rows.differing ? ', ' + t.rows.differing + ' differ' : '') + (t.rows.sheetOnly ? ', ' + t.rows.sheetOnly + ' only in the Sheet' : '') + (t.rows.supabaseOnly ? ', ' + t.rows.supabaseOnly + ' only on Supabase' : '') + (t.columns.sheetOnly.length ? ', Sheet only: ' + t.columns.sheetOnly.join(', ') : '')));
  }
  const rep = { at: stamp(now), league: LEAGUE, sheet: SHEET, supabase: SB_BASE, fresh: freshness(meta, health, clubFixtures, now), summary: summarise(tabs), tabs };
  rep.md = markdown(rep);
  const compared = tabs.some(t => t.status !== 'error');
  deps.log(compared ? ('compared ' + tabs.filter(t => t.status !== 'error').length + ' tabs: ' + rep.summary.differs + ' differ, ' + rep.summary.missing + ' not on Supabase, ' + (rep.summary.same + rep.summary.columns + rep.summary.empty) + ' agree') : 'nothing could be compared');
  return { code: compared ? 0 : 1, report: rep };
}
module.exports = { norm, parseGviz, parseSupabase, keyed, compareTab, groupKeys, summarise, markdown, freshness, main, KEYS, TABS, ALIAS, CLOCK, STATUS, gvizUrl, sbUrl, SB_BASE, LEAGUE };
if (require.main === module) {
  const a = process.argv.slice(2), arg = k => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : ''; };
  main().then(r => {
    const rep = r.report, md = rep.md; delete rep.md;
    if (arg('--out')) { fs.mkdirSync(require('path').dirname(arg('--out')), { recursive: true }); fs.writeFileSync(arg('--out'), JSON.stringify(rep, null, 1)); }
    if (arg('--md')) { fs.mkdirSync(require('path').dirname(arg('--md')), { recursive: true }); fs.writeFileSync(arg('--md'), md); }
    if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
    if (!arg('--md')) process.stdout.write('\n' + md);
    process.exit(r.code);
  }).catch(e => { console.error('Parity failed: ' + (e && e.stack || e)); process.exit(1); });
}
