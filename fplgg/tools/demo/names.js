/* fplgg/tools/demo/names.js — the demo league's fictional names, and the pure rules that anonymise a snapshot of the
   league's tabs (Parker's Q2, 8 Oct 2026: the demo on matchweek.gg runs the current app on frozen, anonymised data).
   No real name is written anywhere in this folder: the mapping is derived from the rows themselves at run time (the
   Standings tab's Team and Manager columns, sorted by team name, each given the fictional entry at the same index), so
   the generator, the build and the leak check all compute the same mapping from the same live rows and nothing has to
   be committed. Players and clubs stay real (public Premier League data); team names, manager names and first names
   become fictional, consistently everywhere (the tabs, the engine's built-in tables in core.js, the app's copy). */
'use strict';

/* eight fictional entries: team, manager, initials (the engine keys its derby and series tables by initials, so they
   must be distinct). Original names, not lookalikes of anyone in the league. */
const FICTIONAL = [
  { team: 'Wirtz Case Scenario', mgr: 'Dec Rowley', ini: 'DR', short: 'Wirtz' },
  { team: 'Saka Potatoes', mgr: 'Tom Hazeldine', ini: 'TH', short: 'Potatoes' },
  { team: 'Palmer Violets', mgr: 'Ravi Mistry', ini: 'RM', short: 'Violets' },
  { team: 'Rice Rice Baby', mgr: 'Jonah Pike', ini: 'JP', short: 'Rice' },
  { team: 'Haaland Oates', mgr: 'Callum Ferris', ini: 'CF', short: 'Oates' },
  { team: 'The Gakpo Gang', mgr: 'Luca Brandt', ini: 'LB', short: 'Gang' },
  { team: 'Bruno Mars FC', mgr: 'Owen Whitlock', ini: 'OW', short: 'Mars' },
  { team: 'Isak Newton', mgr: 'Sam Okafor', ini: 'SO', short: 'Newton' },
];

const esc = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const words = s => String(s || '').trim().split(/\s+/).filter(Boolean);

/* the mapping from the Standings rows ({ Team, Manager } objects, or [team, manager] pairs):
   { teams: { real team: fictional team }, mgrs: { real full name: fictional }, first: { real first name: fictional },
     sur: { real surname: fictional }, ini: { real initials: fictional }, short: { real short name: fictional short },
     shorts: { real team: { from, to } }, order: [real team names, sorted] }.
   Initials are the manager's first letters (the engine's TEAMS[team].ini), passed in when known (core.js carries them),
   otherwise the first letters of the two names. Short names are the one word a team goes by on a tight line (league.json
   short: "Palmers 4 · Devils 0"), passed in when known; aliases (old name to current) map an old name to the same
   fictional team. More than eight teams: the ninth onward gets
   "Team <n>" and a numbered manager, so a bigger league still comes out fictional. */
function mapping(rows, inis, shorts, aliases) {
  const list = (rows || []).map(r => Array.isArray(r) ? { team: r[0], mgr: r[1] } : { team: r.Team, mgr: r.Manager })
    .filter(r => r.team && String(r.team).trim()).map(r => ({ team: String(r.team).trim(), mgr: String(r.mgr || '').trim() }));
  const seen = new Set(); const uniq = list.filter(r => !seen.has(r.team) && seen.add(r.team));
  uniq.sort((a, b) => a.team.localeCompare(b.team, 'en'));
  const m = { teams: {}, mgrs: {}, first: {}, sur: {}, ini: {}, short: {}, shorts: {}, order: uniq.map(r => r.team) };
  uniq.forEach((r, i) => {
    const f = FICTIONAL[i] || { team: 'Team ' + (i + 1), mgr: 'Manager ' + (i + 1) + ' Demo', ini: 'T' + (i + 1), short: 'Team' + (i + 1) };
    m.teams[r.team] = f.team;
    const sh = shorts && shorts[r.team] ? String(shorts[r.team]).trim() : '';
    if (sh && sh !== r.team) { m.shorts[r.team] = { from: sh, to: f.short }; if (!(sh in m.short)) m.short[sh] = f.short; }
    const rw = words(r.mgr), fw = words(f.mgr);
    if (rw.length) {
      m.mgrs[r.mgr] = f.mgr;
      if (!(rw[0] in m.first)) m.first[rw[0]] = fw[0];
      if (rw.length > 1) { const s = rw[rw.length - 1]; if (!(s in m.sur)) m.sur[s] = fw[fw.length - 1]; }
    }
    const ri = (inis && inis[r.team]) || (rw.length > 1 ? rw[0][0] + rw[rw.length - 1][0] : rw.length ? rw[0].slice(0, 2).toUpperCase() : '');
    if (ri) m.ini[ri] = f.ini;
  });
  /* a team's former name (league.json aliases, old name to current: FPL allows mid-season renames) maps to the same
     fictional team, so the history rows that still carry it (GW Log, GW Stats) come out fictional and the leak check
     knows it (BUGS.md #33, 9 Oct 2026) */
  Object.keys(aliases || {}).forEach(old => { const cur = String(aliases[old] || '').trim(); if (m.teams[cur] && !(old in m.teams)) m.teams[old] = m.teams[cur]; });
  return m;
}

/* one regex that matches every real name as a whole word, longest first (so a team name that contains a first name
   wins over the first name); which: an array of the keys to include (teams, mgrs, first, sur) */
function nameRegex(m, which) {
  const keys = [].concat(...(which || ['teams', 'mgrs', 'first', 'sur', 'short']).map(k => Object.keys(m[k] || {}))).filter(Boolean);
  if (!keys.length) return null;
  const uniq = [...new Set(keys)].sort((a, b) => b.length - a.length || a.localeCompare(b));
  return new RegExp('(?<![\\p{L}\\p{N}_])(?:' + uniq.map(esc).join('|') + ')(?![\\p{L}\\p{N}_])', 'gu');
}
function lookup(m, name) { return m.teams[name] || m.mgrs[name] || m.first[name] || m.sur[name] || m.short[name] || name; }
/* every real name in a text replaced as a whole word, in one pass */
function replaceNames(text, m, which) {
  const re = nameRegex(m, which); if (!re) return String(text);
  return String(text).replace(re, w => lookup(m, w));
}

/* the tabs whose rows carry a player's name in a column (Player, Full name, In, Out...): a first name there can be a
   footballer's (Ethan, Jacob, Lucas...), so the first-name rule is not applied to their cells or checked in their files */
const PLAYER_TABS = ['Players', 'Rosters', 'GW Stats', 'GW Log', 'Predictions', 'Transactions', 'Fixture BPS', 'EA Map', 'FC27'];
/* the columns that hold free text, where first names and surnames are replaced as whole words */
const TEXT_COLS = ['Text', 'Facts', 'Teams', 'Notes', 'Value', 'Extra', 'Event', 'Players', 'Note', 'Title', 'Sub'];

/* the file name a tab's snapshot is written to, under the demo's data folder (the app computes the same name) */
const slug = name => String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.json';

/* one tab anonymised: { cols, rows } in, the same shape out. A cell equal to a real team or manager name becomes the
   fictional one; team and manager names inside any string cell are replaced as whole words; first names and surnames
   only in the text columns. Tab rules: Managers lose their photo and display name (a real face, a real name); Specials
   loses the API URL row (the web app's address: with it gone the app has nothing to post to); Social keeps reactions and
   votes but no quotes (free text in a manager's own words); Posts keeps the voices' posts (Kind ai), anonymised. */
function anonymiseTab(name, tab, m) {
  const cols = (tab.cols || []).slice();
  let rows = (tab.rows || []).map(r => Object.assign({}, r));
  if (name === 'Specials') rows = rows.filter(r => String(r.Setting || '').trim() !== 'API URL');
  if (name === 'Social') rows = rows.filter(r => String(r.Kind || '') !== 'quote');
  if (name === 'Posts') rows = rows.filter(r => String(r.Kind || '') === 'ai');
  const full = ['teams', 'mgrs'], text = ['teams', 'mgrs', 'first', 'sur', 'short'];
  rows = rows.map(r => {
    const o = {};
    cols.forEach(c => {
      let v = r[c];
      if (name === 'Managers' && (c === 'Photo' || c === 'Manager')) v = '';
      if (typeof v === 'string' && v) {
        const t = v.trim();
        if (m.teams[t]) v = m.teams[t];
        else if (m.mgrs[t]) v = m.mgrs[t];
        else v = replaceNames(v, m, TEXT_COLS.includes(c) ? text : full);
      }
      o[c] = v === undefined ? '' : v;
    });
    return o;
  });
  return { cols, rows };
}
function anonymiseTabs(tabs, m) { const out = {}; Object.keys(tabs).forEach(n => { out[n] = anonymiseTab(n, tabs[n], m); }); return out; }

/* the app's code with the league's built-in names replaced. First the managers' initials where the engine keys its
   tables by them ('BS|PN' and 'PJ|CT' keys, the ini:'PN' field, the PN: key of FIRST), then team names, full names,
   first names and surnames as whole words (the engine's TEAMS and FIRST values, derby names, the Baha market copy, the
   team colour defaults...). The initials go first because a manager's first name can be his initials (PJ): the key
   PJ: and 'PJ|' are initials, the value 'PJ' is a name. Code is never minified for identifiers before this runs, so a
   two-letter word in it is an initials key or a string, never a renamed variable. */
function substituteCode(src, m) {
  let s = String(src);
  /* the engine's SHORTOF table: each 'real team':'short' pair becomes the fictional pair, before the names pass */
  Object.keys(m.shorts || {}).forEach(t => { const x = m.shorts[t]; s = s.split("'" + t + "':'" + x.from + "'").join("'" + m.teams[t] + "':'" + x.to + "'"); });
  const inis = Object.keys(m.ini || {});
  if (inis.length) {
    const alt = '(' + inis.map(esc).join('|') + ')';
    s = s.replace(new RegExp("(?<=')" + alt + "(?=\\|)", 'g'), w => m.ini[w] || w)      /* 'PN|BS' */
      .replace(new RegExp("(?<=\\|)" + alt + "(?=')", 'g'), w => m.ini[w] || w)        /* 'BS|PN' */
      .replace(new RegExp("(?<=ini:')" + alt + "(?=')", 'g'), w => m.ini[w] || w)       /* ini:'PN' */
      .replace(new RegExp('(?<=[{,\\s])' + alt + '(?=:)', 'g'), w => m.ini[w] || w);   /* FIRST={PN:'Parker',...} */
  }
  return replaceNames(s, m);
}

/* the leak check: every real name found in a text as a whole word (team names, full names, first names, surnames and
   the engine's short names); skipFirst leaves the first names and short names out (a file of player rows); exempt is a
   Set of first names a footballer in the Players tab shares (Jacob Ramsey, Ethan Nwaneri...), never checked as first
   names or short names, since the demo's player data and recaps name footballers in full. Returns [] when clean. */
function leaks(text, m, skipFirst, exempt) {
  const drop = o => Object.fromEntries(Object.entries(o || {}).filter(([k]) => !(exempt && exempt.has(k))));
  const mm = skipFirst ? Object.assign({}, m, { first: {}, short: {} }) : Object.assign({}, m, { first: drop(m.first), short: drop(m.short) });
  const re = nameRegex(mm, ['teams', 'mgrs', 'first', 'sur', 'short']);
  if (!re) return [];
  const found = new Set(); let x; while ((x = re.exec(text))) found.add(x[0]);
  return [...found].sort();
}
/* the first names of the footballers in a Players tab ({ cols, rows }: Full name, else Player), for the check's exempt set */
function playerFirstNames(players) {
  const out = new Set();
  ((players && players.rows) || []).forEach(r => { const w = words(r['Full name'] || ''); if (w.length > 1) out.add(w[0]); });
  return out;
}

/* the league's config (league.json) anonymised for the demo's LEAGUE header (ROADMAP C1): team names, managers, first
   names, initials and short names become the fictional ones; the derby and seeded-series keys follow the initials (a
   seeded pair is re-sorted and its two win counts swapped when the new order flips); a derby name's real names are
   replaced as whole words; the aliases are dropped (the demo's rows are mapped to the current fictional name already);
   the colours, the projection priors, the periods and the pot stay. */
function anonymiseLeague(cfg, m) {
  const ini = k => (m.ini && m.ini[k]) || k;
  const teams = {};
  Object.keys(cfg.teams || {}).forEach(t => {
    const x = cfg.teams[t], f = m.teams[t] || t, fm = m.mgrs[x.mgr] || replaceNames(x.mgr, m);
    teams[f] = Object.assign({}, x, {
      mgr: fm,
      first: m.first[x.first] || words(fm)[0] || x.first,
      ini: ini(x.ini),
      short: (m.shorts[t] && m.shorts[t].to) || m.short[x.short] || (words(f)[words(f).length - 1]),
    });
  });
  const derbies = {};
  Object.keys(cfg.derbies || {}).forEach(k => { derbies[k.split('|').map(ini).join('|')] = replaceNames(cfg.derbies[k], m); });
  const seeded = {};
  Object.keys(cfg.seeded || {}).forEach(k => {
    const p = k.split('|').map(ini), v = (cfg.seeded[k] || []).slice();
    const sorted = p.slice().sort();
    seeded[sorted.join('|')] = sorted[0] === p[0] ? v : [v[1], v[0], v[2]];
  });
  return Object.assign({}, cfg, { name: 'Demo league', ratings: 'house', teams, aliases: {}, derbies, seeded });   /* house ratings: no EA figure in the demo (ROADMAP C3) */
}

module.exports = { FICTIONAL, PLAYER_TABS, TEXT_COLS, mapping, nameRegex, replaceNames, anonymiseTab, anonymiseTabs, anonymiseLeague, substituteCode, leaks, playerFirstNames, slug, words };
