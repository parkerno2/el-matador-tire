/* data/tabs.js — the sheet reader with a guard (ROADMAP A5, bug #5), and the stale-data banner.
   gviz answers a request for a tab that does not exist with the FIRST sheet and HTTP 200 (the draft grades: Rank, Team,
   Manager, Grade...). The engine's readTab (core.js) takes whatever comes back, so a renamed or missing tab would show
   wrong numbers. This module replaces readTab (installReadTab: a classic-script function is a window property, so the
   engine's calls resolve to this one) with the same JSONP read, the same canonTeam() on every value, plus a check of the
   header row against the columns the engine needs (TABS): a mismatch rejects, so a required tab shows the "could not
   reach the league data" screen and an optional one falls back to empty, never to another sheet's rows.
   readMeta() reads the Meta tab for the time of the last refresh from FPL (written by Code.gs on every refresh), for the
   banner: data older than 2 hours, or 20 minutes while a match is on, is said so at the top of every page.
   The GW Stats tab (bug #3) is read with a gviz query that leaves out the rows nothing uses: Code.gs writes every player
   in FPL's live feed each gameweek, and the engine ignores a player who was neither owned nor on the pitch (every
   aggregate skips a missing row and a zero-minute row alike; no row has points without minutes). Owned players keep
   their zero-minute rows, so ownership and "did not play" history are intact. Measured 8 Oct 2026: 1,636 of 3,216 rows,
   219 KB instead of 410 KB. The query names the Owner and Mins columns by letter, so the read checks the header puts them
   where Code.gs writes them (F and G) and otherwise reads the whole tab, as before, and says so.
   The data source (ROADMAP B3, first slice): the Sheet is the default; ?data=supabase in the app's URL turns on the
   Supabase project's public, read-only `tabs` function (the same tab names and columns, the pipeline the parity report
   compares with the Sheet) for this phone and keeps the choice in localStorage; ?data=sheet turns it off. Supabase's
   rows are shaped like gviz's (every value a string, TRUE and FALSE, the leading apostrophe before a date dropped,
   canonTeam on every value, the same header guard, the same GW Stats trim). The tabs the web app writes itself
   (Managers, Social, Posts, Specials with the web app's own URL) stay on the Sheet whatever the source, and a tab
   Supabase lacks or fails to serve is read from the Sheet instead, said in the console; MW.data.report() lists where
   each tab came from. The stale banner then follows Supabase's own refresh time (its Meta tab).
   The demo (Parker's Q2, 8 Oct 2026: matchweek.gg's demo league runs the current app): the demo build sets __MW_DEMO__
   (esbuild --define), which fixes the source to the frozen, anonymised JSON tabs shipped beside the page (data/<tab>.json,
   { cols, rows } exactly as gviz hands them over, written by fplgg/tools/demo). A demo page never reads the Sheet, the web
   app or Supabase: the URL flag and localStorage are ignored, a tab without a file is empty (an optional tab stays
   optional, a required one shows its empty state), Specials has no API URL so D.api is blank and every write is off, and
   readMeta answers 0 so frozen data never shows the stale banner. */
const TIMEOUT_MS = 15000, STALE_MIN = 120, STALE_LIVE_MIN = 20, MATCH_PRE_MS = 5 * 60e3, MATCH_MS = (2 * 60 + 15) * 60e3;
/* the columns each tab must have (a name with | means any one of them). A tab not listed here is read as before. */
export const TABS = {
  Rosters: ['Team', 'Player', 'Pos', 'Club', 'Code'],
  Standings: ['Team', 'W', 'D', 'L', 'League Pts', 'Pts For', 'Pts Against'],
  'H2H Fixtures': ['GW', 'Home', 'Home pts', 'Away', 'Away pts', 'Finished'],
  Matchweeks: ['GW', 'Deadline (UTC)', 'Finished'],
  'Club Fixtures': ['GW', 'Home', 'Away', 'Kickoff (UTC)'],
  Clubs: ['Short', 'Badge code'],
  Specials: ['Setting', 'Value'],
  'EA Map': ['ea_player_id|EA ID'],
  FC27: ['fpl_code', 'ea_ovr_fc27'],
  Transactions: ['GW', 'Team', 'In', 'Out', 'Type', 'Result', 'When (UTC)'],
  Predictions: ['GW', 'Code', 'EP'],
  'GW Stats': ['GW', 'Code', 'Mins', 'Pts', 'Bonus'],
  Players: ['Code', 'Player', 'Pos', 'Club', 'Owner'],
  'GW Log': ['GW', 'Team', 'Code', 'Pos', 'GW pts', 'GW mins', 'Started'],
  Managers: ['Team', 'Color', 'Shape'],
  Social: ['When (UTC)', 'Team', 'Kind', 'Target', 'Value'],
  Posts: ['When (UTC)', 'Id', 'Voice', 'Kind', 'Text'],
  'Fixture BPS': ['GW', 'Home', 'Away', 'Code', 'BPS', 'Bonus'],
};
/* '' when the header has what the tab needs, else what is missing */
export function tabProblem(name, cols) {
  const need = TABS[name]; if (!need) return '';
  const have = new Set((cols || []).map(c => String(c)));
  const miss = need.filter(c => !c.split('|').some(alt => have.has(alt)));
  return miss.length ? 'missing ' + miss.join(', ') + ' (header: ' + (cols || []).slice(0, 6).join(', ') + ')' : '';
}
/* a tab read with a gviz query: { tq, at: { column letter: the label it must have }, keep: the same trim on rows read whole } */
export const QUERIES = {
  'GW Stats': { tq: 'select * where G > 0 or F is not null', at: { F: 'Owner', G: 'Mins' }, keep: r => Number(r.Mins) > 0 || String(r.Owner || '') !== '' },
};
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
/* '' when the header has the queried columns where the query expects them, else why not */
export function queryProblem(name, cols) {
  const q = QUERIES[name]; if (!q) return '';
  const bad = Object.keys(q.at).filter(L => (cols || [])[LETTERS.indexOf(L)] !== q.at[L]);
  return bad.length ? 'column ' + bad.map(L => L + ' is ' + JSON.stringify((cols || [])[LETTERS.indexOf(L)] || '') + ', not ' + q.at[L]).join('; ') : '';
}
let N = 0;
const gv = name => (typeof SHEET === 'string' ? SHEET : '');
const canon = v => { try { return typeof canonTeam === 'function' ? canonTeam(v) : v; } catch (e) { return v; } };
/* the JSONP read: { cols, rows } (rows keyed by column label, every value through canonTeam, as the engine's readTab did) */
export function readRaw(name, tq) {
  return new Promise((resolve, reject) => {
    const cb = '__mwgv' + (++N), s = document.createElement('script');
    const to = setTimeout(() => { cleanup(); reject(new Error(name + ' timed out')); }, TIMEOUT_MS);
    function cleanup() { clearTimeout(to); try { delete window[cb]; } catch (e) { window[cb] = undefined; } s.remove(); }
    window[cb] = j => {
      cleanup();
      try {
        if (!j || !j.table) throw new Error(name + ': no table');
        const cols = j.table.cols.map(c => c.label || c.id);
        const rows = (j.table.rows || []).map(row => { const o = {}; (row.c || []).forEach((c, i) => { if (!cols[i]) return; let v = c ? ((c.f !== undefined && c.f !== null) ? c.f : c.v) : ''; o[cols[i]] = canon(v === null ? '' : v); }); return o; });
        resolve({ cols, rows });
      } catch (e) { reject(e); }
    };
    s.src = 'https://docs.google.com/spreadsheets/d/' + gv(name) + '/gviz/tq?tqx=' + encodeURIComponent('out:json;responseHandler:' + cb) + '&headers=1&sheet=' + encodeURIComponent(name) + (tq ? '&tq=' + encodeURIComponent(tq) : '');
    s.onerror = () => { cleanup(); reject(new Error(name + ' failed to load')); };
    document.head.appendChild(s);
  });
}
/* a tab from the Sheet: the trimmed read where there is one, checked against the header, else the whole tab */
function readSheet(name) {
  const q = QUERIES[name];
  if (!q) return readRaw(name);
  return readRaw(name, q.tq).then(r => {
    const qp = queryProblem(name, r.cols);
    if (!qp) return r;
    console.warn('tab "' + name + '": the trimmed read cannot be trusted (' + qp + '); reading the whole tab');
    return readRaw(name);
  });
}

/* ---------- the demo (Q2): frozen JSON tabs beside the page, set at build time ---------- */
export const DEMO = typeof __MW_DEMO__ !== 'undefined' && !!__MW_DEMO__;
export const DEMO_DATA = 'data/';
/* the file a tab is read from in the demo (fplgg/tools/demo/names.js writes the same name) */
export const demoFile = name => DEMO_DATA + String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.json';
const demoEmpty = name => ({ cols: (TABS[name] || []).map(c => c.split('|')[0]), rows: [] });
/* a tab from the demo's data folder: { cols, rows } as written, the GW Stats trim applied; no file is an empty tab */
export function readDemo(name) {
  const ac = typeof AbortController === 'function' ? new AbortController() : null;
  const to = setTimeout(() => { if (ac) ac.abort(); }, TIMEOUT_MS);
  return fetch(demoFile(name), Object.assign({ cache: 'no-cache' }, ac ? { signal: ac.signal } : {})).then(r => {
    if (r.status === 404) { REPORT[name] = 'demo (no file, empty)'; return demoEmpty(name); }
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json().then(j => {
      if (!j || !Array.isArray(j.cols) || !Array.isArray(j.rows)) throw new Error(name + ': not a demo tab');
      REPORT[name] = 'demo';
      const q = QUERIES[name]; if (q && q.keep) j.rows = j.rows.filter(q.keep);
      return { cols: j.cols.map(String), rows: j.rows };
    });
  }).finally(() => clearTimeout(to));
}

/* ---------- the data source (ROADMAP B3): the Sheet, or Supabase behind the flag ---------- */
export const SUPABASE = { base: 'https://vcokquhzqpqvwrybndnr.supabase.co/functions/v1/tabs', league: 45380 };
/* the tabs the web app (Code.gs) writes itself, which the Supabase ingest never has: logins and profiles, the social
   log, the voices' posts, and Specials, which carries the web app's own URL (API URL). The Sheet keeps them. */
export const SHEET_ONLY = ['Managers', 'Social', 'Posts', 'Specials'];
const SOURCE_KEY = 'mw-data';
let SOURCE = '';
const REPORT = {};
/* the source for this phone: ?data=supabase in the URL turns Supabase on and keeps it (keep: true says to), ?data=sheet
   turns it off; with neither, what was kept, else the Sheet */
export function pickSource(search, kept) {
  const m = /[?&]data=(sheet|supabase)(?:[&#]|$)/.exec(search || '');
  return { source: m ? m[1] : (kept === 'supabase' ? 'supabase' : 'sheet'), keep: !!m };
}
export function dataSource() {
  if (SOURCE) return SOURCE;
  if (DEMO) { SOURCE = 'demo'; return SOURCE; }
  let kept = ''; try { kept = localStorage.getItem(SOURCE_KEY) || ''; } catch (e) { }
  const p = pickSource(typeof location === 'object' && location ? location.search : '', kept);
  if (p.keep) try { if (p.source === 'sheet') localStorage.removeItem(SOURCE_KEY); else localStorage.setItem(SOURCE_KEY, p.source); } catch (e) { }
  SOURCE = p.source;
  if (SOURCE === 'supabase') console.info('Matchweek data: Supabase (' + SUPABASE.base + '); add ?data=sheet to the URL to go back to the Sheet');
  return SOURCE;
}
/* { source, tabs: { name: 'sheet' | 'supabase' | 'demo' | 'sheet (why)' } } for the tabs read so far */
export function dataReport() { return { source: dataSource(), tabs: Object.assign({}, REPORT) }; }
export const sbUrl = name => SUPABASE.base + '/league/' + SUPABASE.league + '/tab/' + encodeURIComponent(name);
/* a Supabase value as gviz hands the same cell over: a string, TRUE or FALSE, a date without the apostrophe the ingest
   writes before it, then canonTeam */
export const sbCell = v => canon(v === null || v === undefined ? '' : typeof v === 'boolean' ? (v ? 'TRUE' : 'FALSE') : typeof v === 'number' ? String(v) : String(v).replace(/^'/, ''));
/* { cols, rows } from the tabs function's { header, rows }; a tab without a header (Meta) is keyed Column 1, 2... */
export function parseSupabase(j) {
  if (!j || !Array.isArray(j.rows)) throw new Error('not a tabs reply');
  let cols = (j.header || []).map(c => String(c === null || c === undefined ? '' : c).trim());
  if (!cols.length && j.rows.length && Array.isArray(j.rows[0])) cols = j.rows[0].map((_, i) => 'Column ' + (i + 1));
  const rows = j.rows.map(r => { const o = {}; cols.forEach((c, i) => { if (c) o[c] = sbCell(Array.isArray(r) ? r[i] : ''); }); return o; });
  return { cols: cols.filter(Boolean), rows };
}
/* a tab from Supabase: null when it has no such tab (404), rejects on any other failure; the GW Stats trim applied */
export function readSupabase(name) {
  const ac = typeof AbortController === 'function' ? new AbortController() : null;
  const to = setTimeout(() => { if (ac) ac.abort(); }, TIMEOUT_MS);
  return fetch(sbUrl(name), ac ? { signal: ac.signal } : undefined).then(r => {
    if (r.status === 404) return null;
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json().then(parseSupabase);
  }).then(r => { const q = QUERIES[name]; if (r && q && q.keep) r.rows = r.rows.filter(q.keep); return r; })
    .finally(() => clearTimeout(to));
}
function fromSheet(name, why, say) {
  REPORT[name] = why ? 'sheet (' + why + ')' : 'sheet';
  if (say) console.warn('tab "' + name + '": ' + why + '; read from the Sheet');
  return readSheet(name);
}
/* { cols, rows } from the source this phone uses */
function readFrom(name) {
  if (dataSource() === 'demo') return readDemo(name);
  if (dataSource() !== 'supabase') return fromSheet(name, '');
  if (SHEET_ONLY.includes(name)) return fromSheet(name, 'the web app writes it');
  return Promise.resolve().then(() => readSupabase(name)).then(r => { if (!r) return fromSheet(name, 'not on Supabase', true); REPORT[name] = 'supabase'; return r; }, e => fromSheet(name, String(e && e.message || e).slice(0, 80), true));
}
export function guardedReadTab(name) {
  return readFrom(name).then(({ cols, rows }) => {
    const why = tabProblem(name, cols);
    if (why) { console.warn('tab "' + name + '" refused: ' + why); throw new Error(name + ' tab is missing or has the wrong columns: ' + why); }
    return rows;
  });
}
export function installReadTab() { try { guardedReadTab.guarded = true; window.readTab = guardedReadTab; return true; } catch (e) { return false; } }

/* ---------- the time of the last refresh from FPL, from the Meta tab ---------- */
const ISO = /\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z/;
export function metaUpdated(cols, rows) {
  const cells = (cols || []).map(String).concat((rows || []).flatMap(r => Object.values(r || {}).map(String)));
  for (const c of cells) { const m = ISO.exec(c); if (m) { const t = Date.parse(m[0]); if (!isNaN(t)) return t; } }
  return 0;
}
const sheetMeta = () => readRaw('Meta').then(({ cols, rows }) => metaUpdated(cols, rows)).catch(() => 0);
/* the Sheet's Meta tab, or Supabase's when that is the source (its Updated row is the ingest's last run) */
export function readMeta() {
  if (DEMO) return Promise.resolve(0);   /* frozen data is never "stale": the demo has no refresh to be late */
  if (dataSource() !== 'supabase') return sheetMeta();
  return readSupabase('Meta').then(r => (r ? metaUpdated(r.cols, r.rows) : sheetMeta()), () => sheetMeta()).then(t => t || sheetMeta());
}
/* a Premier League match is on now (kick-off less 5 minutes to kick-off plus 2 h 15), from the Club Fixtures rows */
export function matchOn(cf, now) {
  return (cf || []).some(f => { const k = Date.parse(String(f['Kickoff (UTC)'] || '').replace(/^'/, '')); return !isNaN(k) && now >= k - MATCH_PRE_MS && now <= k + MATCH_MS; });
}
const agoText = min => min < 60 ? min + ' min ago' : min < 48 * 60 ? Math.floor(min / 60) + ' h ' + (min % 60) + ' min ago' : Math.round(min / 1440) + ' days ago';
/* null when the data is fresh enough, else { min, limit, text } for the banner */
export function staleInfo(updated, now, live) {
  if (!updated) return null;
  const min = Math.round((now - updated) / 60000), limit = live ? STALE_LIVE_MIN : STALE_MIN;
  if (min <= limit) return null;
  return { min, limit, text: 'The league data was last refreshed ' + agoText(min) + '. The refresh looks stuck, so scores, projections and the table may be out of date.' };
}
