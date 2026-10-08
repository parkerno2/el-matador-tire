/* data/tabs.js — the sheet reader with a guard (ROADMAP A5, bug #5), and the stale-data banner.
   gviz answers a request for a tab that does not exist with the FIRST sheet and HTTP 200 (the draft grades: Rank, Team,
   Manager, Grade...). The engine's readTab (core.js) takes whatever comes back, so a renamed or missing tab would show
   wrong numbers. This module replaces readTab (installReadTab: a classic-script function is a window property, so the
   engine's calls resolve to this one) with the same JSONP read, the same canonTeam() on every value, plus a check of the
   header row against the columns the engine needs (TABS): a mismatch rejects, so a required tab shows the "could not
   reach the league data" screen and an optional one falls back to empty, never to another sheet's rows.
   readMeta() reads the Meta tab for the time of the last refresh from FPL (written by Code.gs on every refresh), for the
   banner: data older than 2 hours, or 20 minutes while a match is on, is said so at the top of every page. */
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
};
/* '' when the header has what the tab needs, else what is missing */
export function tabProblem(name, cols) {
  const need = TABS[name]; if (!need) return '';
  const have = new Set((cols || []).map(c => String(c)));
  const miss = need.filter(c => !c.split('|').some(alt => have.has(alt)));
  return miss.length ? 'missing ' + miss.join(', ') + ' (header: ' + (cols || []).slice(0, 6).join(', ') + ')' : '';
}
let N = 0;
const gv = name => (typeof SHEET === 'string' ? SHEET : '');
const canon = v => { try { return typeof canonTeam === 'function' ? canonTeam(v) : v; } catch (e) { return v; } };
/* the JSONP read: { cols, rows } (rows keyed by column label, every value through canonTeam, as the engine's readTab did) */
export function readRaw(name) {
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
    s.src = 'https://docs.google.com/spreadsheets/d/' + gv(name) + '/gviz/tq?tqx=' + encodeURIComponent('out:json;responseHandler:' + cb) + '&headers=1&sheet=' + encodeURIComponent(name);
    s.onerror = () => { cleanup(); reject(new Error(name + ' failed to load')); };
    document.head.appendChild(s);
  });
}
export function guardedReadTab(name) {
  return readRaw(name).then(({ cols, rows }) => {
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
export function readMeta() { return readRaw('Meta').then(({ cols, rows }) => metaUpdated(cols, rows)).catch(() => 0); }
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
