// League > Overview (Parker, 10 Oct 2026, Q6: "Manager of the month race should update live still shows projections
// that feels intuitive this looks too jumbled I'd cut the money stuff and have PF there too probably and form for sure
// keep that"): the table without money, PF as its own column, the manager and his form dots under the name; the
// Manager of the Month race led by real points (the month so far, the live gameweek as it stands), ranked by them with
// the projection breaking ties, the projection the small secondary figure, Projected the main number only before the
// month has a point; and the refresh path (heavy, settleHeavy in src/pages/league/data.js, the League page's mount)
// that puts new live points on screen without a page load. Plain Node: data.js and overview.js run in a vm on a stub
// engine with eight teams from league.json.   node tests/app-overview.js
const fs = require('fs'), vm = require('vm');
let fails = 0;
const check = (label, cond, info) => { if (!cond) fails++; console.log((cond ? 'PASS ' : 'FAIL ') + label + (info ? '  ' + info : '')); };
const ROOT = __dirname + '/../', MW = ROOT + 'fplgg/tools/matchweek/';
const rd = f => fs.readFileSync(MW + f, 'utf8');
const DATA = rd('src/pages/league/data.js'), OVER = rd('src/pages/league/overview.js'), LEAGUE_JS = rd('src/pages/league.js'), CSS = rd('src/css/40-league.css');
const cfg = require(MW + 'tools/league.js').load();
const TEAMS = {}; Object.keys(cfg.teams).forEach(t => { TEAMS[t] = { mgr: cfg.teams[t].mgr, ini: cfg.teams[t].ini, col: cfg.teams[t].col }; });
const FIRST = {}; Object.keys(cfg.teams).forEach(t => { FIRST[t] = cfg.teams[t].first; });
const SHORTOF = {}; Object.keys(cfg.teams).forEach(t => { SHORTOF[t] = cfg.teams[t].short; });
const names = Object.keys(TEAMS);
const strip = src => src.replace(/^import [^\n]*\n/gm, '').replace(/^export (function|const|let|async function)/gm, '$1').replace(/^export \{[^}]*\};?\s*$/gm, '');
const count = (h, re) => (h.match(re) || []).length;

/* ---------- a season: GW1 to GW5 finished, GW6 live (the October period is GW6 to GW9) ---------- */
function fixtures(live) {
  const fx = [];
  for (let g = 1; g <= 9; g++) {
    for (let i = 0; i < 4; i++) {
      const h = names[(i + g) % 8], a = names[(7 - i + g) % 8];
      const done = g <= 5;
      fx.push({ GW: String(g), Home: h, 'Home pts': done ? String(30 + ((g * 7 + i * 3) % 40)) : '0', Away: a, 'Away pts': done ? String(30 + ((g * 5 + i * 11) % 40)) : '0', Finished: done ? 'TRUE' : 'FALSE' });
    }
  }
  return fx;
}
function standings(fx) {
  const t = {}; names.forEach(n => { t[n] = { W: 0, D: 0, L: 0, pf: 0, pa: 0, pts: 0 }; });
  fx.filter(f => f.Finished === 'TRUE').forEach(f => { const h = +f['Home pts'], a = +f['Away pts']; t[f.Home].pf += h; t[f.Home].pa += a; t[f.Away].pf += a; t[f.Away].pa += h;
    if (h > a) { t[f.Home].W++; t[f.Home].pts += 3; t[f.Away].L++; } else if (a > h) { t[f.Away].W++; t[f.Away].pts += 3; t[f.Home].L++; } else { t[f.Home].D++; t[f.Away].D++; t[f.Home].pts++; t[f.Away].pts++; } });
  return names.map(n => ({ Team: n, Manager: TEAMS[n].mgr, W: String(t[n].W), D: String(t[n].D), L: String(t[n].L), 'Pts For': String(t[n].pf), 'Pts Against': String(t[n].pa), 'League Pts': String(t[n].pts) }));
}
/* the stub engine: the live score of a team in GW6 is LIVE[team], which a test changes between "loads" */
function engine(opt = {}) {
  const fx = fixtures();
  const LIVE = {}; names.forEach((n, i) => { LIVE[n] = opt.zero ? 0 : [29, 25, 22, 21, 21, 18, 13, 7][i]; });
  const ctx = {
    console, JSON, String, Date, Math, Number, Object, Array, Set, Map, RegExp, Boolean, isNaN, parseFloat, parseInt, Intl, Error,
    LEAGUE: cfg, TEAMS, SHORTOF, FIRSTOF: t => FIRST[t] || t, PERIODS: cfg.periods.map(p => p.slice()), LOADED_AT: 1000,
    D: { gw: 6, dlPassed: !opt.zero, gwsDone: 5, provOver: false, liveNow: !opt.zero, fx, st: standings(fx), cf: [], mw: [{ GW: '6', 'Deadline (UTC)': '2026-10-10T10:00:00Z' }], ro: [{ Team: names[0] }] },
    LIVE,
    num: v => +v || 0, fin: v => String(v).toUpperCase() === 'TRUE',
    dt: s => (s ? new Date(s) : null), gwDeadline: () => new Date('2026-10-10T10:00:00Z'),
    xiOf: () => [], benchOf: () => [], effXiOf: () => [],
    hpLiveSplit: t => ({ rem: 10, banked: 0 }), hpTeamSd: () => 8, hpTeam: t => 45 + names.indexOf(t) * 4,   /* the last team projects best */
    hpRng: seed => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; },
    formOf: t => 'WLWWL', buildH2H() { }, derbyRows: () => [], SEED: {}, luckAgg: () => ({}), schedLuck: () => ({}), xiPtsMap: () => ({}), mgrSeries: () => [], benchByGw: () => ({}), squadOf: () => [], ovrOf: () => 0, hpWin: () => 0.5,
  };
  ctx.effPtsOf = (f, t) => { const raw = ctx.num(f.Home === t ? f['Home pts'] : f['Away pts']); if (ctx.num(f.GW) === ctx.D.gw && !ctx.fin(f.Finished) && ctx.D.dlPassed) return Math.max(raw, ctx.LIVE[t] || 0); return raw; };
  ctx.UI = {
    esc: s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    short: t => SHORTOF[t] || t, first: t => FIRST[t] || t, you: () => names[4], tc: () => '#7A95FF', crest: (t, px) => '<i class="cr" data-t="' + t + '"></i>', waitN: () => '..', icon: () => '', SHAPES: { shield: '' },
    week: () => ({ mode: opt.zero ? 'pre' : 'live' }), oddsReady: () => true, titleOdds: () => ({ title: Object.fromEntries(names.map((n, i) => [n, 40 - i * 4])) }), day: d => 'Sat',
  };
  vm.createContext(ctx);
  vm.runInContext(strip(DATA) + '\n' + strip(OVER) + '\n;this.X = { tableBlock, motmBlock, motm, table, heavyPending, settleHeavy };', ctx, { filename: 'league.js' });
  return ctx;
}
const row = (h, re) => h.match(re) || [];
const rows = h => row(h, /<div class="lg-tr[^]*?<\/span><\/div>/g);
const txt = h => h.replace(/<[^>]+>/g, ' ');

console.log('--- T the table');
{
  const E = engine(), h = E.X.tableBlock(), rs = rows(h), st = E.D.st;
  check('T1 eight rows and no dollar sign anywhere in the table', rs.length === 8 && !/\$/.test(h), (h.match(/\$\S*/g) || []).join(' '));
  check('T2 the column heads are #, crest, Team, W-D-L, PF, Pts, Title', /<div class="lg-th" aria-hidden="true"><span>#<\/span><span><\/span><span>Team<\/span><span>W-D-L<\/span><span>PF<\/span><span>Pts<\/span><span>Title<\/span><\/div>/.test(h));
  const pf = rs.map(r => [/<span class="tn">([^<]+)<\/span>/.exec(r)[1], +/<span class="pf n">(\d+)<\/span>/.exec(r)[1], /<span class="rec n">([^<]+)<\/span>/.exec(r)[1], +/<span class="pts n">(\d+)<\/span>/.exec(r)[1]]);
  check('T3 PF on every row equals the Standings tab\'s Pts For, the record W-D-L with hyphens, Pts the League Pts', pf.every(([t, p, rec, pts]) => { const s = st.find(x => x.Team === t); return p === +s['Pts For'] && rec === s.W + '-' + s.D + '-' + s.L && pts === +s['League Pts']; }), JSON.stringify(pf));
  const l2 = rs.map(r => /<span class="l2">([^]*?)<\/span><\/span>/.exec(r)[1]);
  check('T4 the line under the name is the first name (or You) and the form dots, nothing else', l2.every(x => /^(<b class="me">You<\/b>|<span class="mg">[A-Za-z]+<\/span>)<span class="fdots"/.test(x) && !/\d|for|\$|pz/.test(txt(x))) && l2.filter(x => /You/.test(x)).length === 1, l2[0]);
  check('T5 form dots on every row, five each, in the w, l, d and e classes only', rs.every(r => count(r, /<span class="fdots"/g) === 1 && count(r, /<i class="[wlde]"><\/i>/g) === 5));
  check('T6 one plain line under 3rd with no text, and no prize class on any row', count(h, /<div class="lg-zone" aria-hidden="true"><\/div>/g) === 1 && rs.indexOf(rs[3]) === 3 && h.indexOf('lg-zone') > h.indexOf(rs[2]) && h.indexOf('lg-zone') < h.indexOf(rs[3]) && !/lg-tr prize| prize"/.test(h));
  check('T7 the footnote is the data state (the table moves when the live gameweek is over) and nothing else', /<p>The table moves when GW6 is over\.<\/p>/.test(h) && count(h, /<p>/g) === 1);
  check('T8 no em or en dash in the table, the no-change marker included', !/[–—]/.test(h));
  check('T9 the row\'s label carries the points for', rs.every(r => /aria-label="[^"]*\d+ points for/.test(r)));
}

console.log('--- R the race with the live gameweek');
{
  const E = engine(), m = E.X.motm(), h = E.X.motmBlock();
  const order = m.rows.map(r => r.t), banked = m.rows.map(r => r.banked);
  check('R1 ranked by the month\'s points, the live gameweek included, descending', banked.every((b, i) => i === 0 || banked[i - 1] >= b) && banked[0] === 29 && banked[7] === 7, banked.join(','));
  check('R2 the leader is the team with the most live points, not the best projection', order[0] === names[0] && m.rows[0].proj < Math.max(...m.rows.map(r => r.proj)));
  const mains = row(h, /<b class="n pr">(\d+)<\/b>/g).map(x => +/\d+/.exec(x)[0]);
  check('R3 the big number of each row is those points', mains.join(',') === banked.map(Math.round).join(','), mains.join(','));
  check('R4 the column head is Points with the live tag', /<span class="ph">Points <em class="live-c">LIVE<\/em><\/span>/.test(h));
  const sm = row(h, /<small class="n sm">(\d+) proj<\/small>/g).map(x => +/\d+/.exec(x)[0]);
  check('R5 the projection is the small secondary figure on every row, and the marker on the bar', sm.join(',') === m.rows.map(r => Math.round(r.proj)).join(',') && count(h, /<span class="mk" style="left:/g) === 8);
  check('R6 win chance on every row, the favourite marked', count(h, /<b class="n wn[^"]*">[<>]?\d+%<\/b>/g) === 8 && count(h, / fav">/g) === 1);
  check('R7 no dollar sign, no em or en dash in the race', !/\$/.test(h) && !/[–—]/.test(h), (h.match(/[^\s]*[\$–—][^\s]*/g) || []).join(' '));
  check('R8 the state line names the live leader by points', /GW6 live · [A-Za-z]+ lead on 29/.test(h), /lg-pipnote"><span>([^<]*)/.exec(h)[1]);
  check('R9 the key reads points, projected, likely range', /<i class="k-bk"><\/i>points<\/span><span><i class="k-mk"><\/i>projected<\/span><span><i class="k-rg"><\/i>likely range/.test(h));
  check('R10 no explanatory note under the race (the method is on How it works)', !/simulations|bars fill|20,000/.test(h));
}
{
  const E = engine(); E.LIVE[names[1]] = 29;   /* a tie on points: the projection breaks it */
  const m = E.X.motm(), top = m.rows.slice(0, 2);
  check('R11 a tie on points is broken by the projection', top[0].banked === 29 && top[1].banked === 29 && top[0].proj >= top[1].proj);
}

console.log('--- Z before the month has a point');
{
  const E = engine({ zero: true }), m = E.X.motm(), h = E.X.motmBlock();
  check('Z1 nothing banked: ranked by the projection', !m.anyBanked && m.rows.every((r, i) => i === 0 || m.rows[i - 1].proj >= r.proj));
  const mains = row(h, /<b class="n pr">(\d+)<\/b>/g).map(x => +/\d+/.exec(x)[0]);
  check('Z2 the main number is the projection, headed Projected, with no secondary figure', /<span class="ph">Projected<\/span>/.test(h) && mains.join(',') === m.rows.map(r => Math.round(r.proj)).join(',') && !/class="n sm"/.test(h));
  check('Z3 the state line says no points yet', /0 of 4 played · no points yet/.test(h));
}

console.log('--- F a live refresh');
{
  const E = engine();
  const before = E.X.motm().rows.map(r => r.t + ':' + r.banked).join(',');
  check('F1 the first load computes the race and nothing is pending', !E.X.heavyPending());
  /* the refresh: new live points for the last team, a new LOADED_AT, as loadData sets it */
  E.LIVE[names[7]] += 30; E.LOADED_AT = 2000;
  const stale = E.X.motm().rows.map(r => r.t + ':' + r.banked).join(',');
  check('F2 the render after the refresh gets the previous value at once and marks the recompute pending', stale === before && E.X.heavyPending());
  E.X.settleHeavy();
  const m2 = E.X.motm(), after = m2.rows.map(r => r.t + ':' + r.banked).join(',');
  check('F3 settleHeavy recomputes it: the numbers and the order change', !E.X.heavyPending() && after !== before && m2.rows[0].t === names[7] && m2.rows[0].banked === 37, after);
  const h = E.X.motmBlock(), mains = row(h, /<b class="n pr">(\d+)<\/b>/g).map(x => +/\d+/.exec(x)[0]);
  check('F4 the block drawn after the settle shows the new numbers in the new order', mains[0] === 37 && new RegExp('<span class="tn">' + names[7] + '</span>').test(rows(h.replace(/lg-mr/g, 'lg-tr'))[0] || h.slice(h.indexOf('lg-mr'), h.indexOf('lg-mr') + 400)));
  check('F5 the same load again: the fresh value, nothing pending', E.X.motm().rows.map(r => r.t + ':' + r.banked).join(',') === after && !E.X.heavyPending());
  /* the League page's mount is what settles it and redraws, on every render, so a live refresh needs no page load */
  const mount = LEAGUE_JS.slice(LEAGUE_JS.indexOf('mount(root, sub)'));
  check('F6 the League page\'s mount settles the pending recompute and redraws the page (MW.render, keepScroll)', /if \(\(NEEDS_ODDS\[sub\] && !oddsReady\(\)\) \|\| heavyPending\(\)\) \{/.test(mount) && /settleHeavy\(\);/.test(mount) && /window\.MW\.render\(\{ keepScroll: true \}\)/.test(mount));
  check('F7 the app\'s refresh renders the page after loading the data (main.js reload)', /return loadData\(quiet\)\.then\(\(\) => \{ BUSY = false; flushErrors\(\); render\(\{ keepScroll: true \}\);/.test(rd('src/main.js')));
}

console.log('--- C the code');
check('C1 data.js ranks the race by points with the projection breaking ties, and by the projection before any point', /if \(rows\.some\(r => r\.banked > 0\)\) rows\.sort\(\(p, q\) => q\.banked - p\.banked \|\| q\.proj - p\.proj\);\n\s+else rows\.sort\(\(p, q\) => q\.proj - p\.proj \|\| q\.banked - p\.banked\);/.test(DATA));
check('C2 overview.js has no prize amount, no prize band text and no cash tag', !/PRIZE|lg-cash|Prize places above|money\(FINAL\) \+ ' at GW38'/.test(OVER.slice(0, OVER.indexOf('block 3'))));
check('C3 the CSS lays the table out in seven columns at every width, the zone a line with no text, no prize bar', count(CSS, /\.lg-th,\.lg-tr\{[^}]*grid-template-columns:\d+px \d+px minmax\(0,1fr\) \d+px \d+px \d+px \d+px/g) === 2 && /\.lg-zone\{height:0;border-top:1px solid/.test(CSS) && !/\.lg-tr\.prize/.test(CSS) && !/\.lg-cash\{/.test(CSS));
check('C4 the CSS keeps a team name whole: two lines allowed, no ellipsis', /\.lg-tr \.tn\{display:-webkit-box;-webkit-line-clamp:2/.test(CSS) && !/\.lg-tr \.tn\{[^}]*text-overflow:ellipsis/.test(CSS));
check('C5 the form dots use the status colours (win, loss) and the neutral draw', /\.fdots \.w\{background:var\(--win\)\} \.fdots \.d\{background:var\(--tx3\)\} \.fdots \.l\{background:var\(--loss\)\}/.test(rd('src/css/02-components.css')));
check('C6 the browser check exists (fplgg/tools/preview/check-overview.js) and is not a suite the gate runs', fs.existsSync(ROOT + 'fplgg/tools/preview/check-overview.js') && !fs.existsSync(ROOT + 'tests/check-overview.js'));

console.log(fails ? fails + ' FAILED' : 'ALL PASS');
process.exit(fails ? 1 : 0);
