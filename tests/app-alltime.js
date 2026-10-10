// All-time manager stats (Parker's Q5, 10 Oct 2026: "We should also have all time stats for managers somewhere too").
// The history file fplgg/tools/matchweek/history/2025-26.json (tools/history.js: each manager's 38 weekly scores sum to
// his PF, the 114 fixtures reproduce every W, D, L, PF and PA, the head-to-heads equal league.json "seeded"); the model
// src/alltime.js keyed by manager code (the history plus this season's finished matches: seasons, titles, finishes,
// P W D L, points, per match, win %, for and against, the average, the highest and lowest scores, the biggest win and
// heaviest defeat, the runs, the all-play record, the record against every other manager, which equals the Derbies
// series); the League's All-time sub-tab (one sortable table, the records) and the manager sheet's All-time tab; the
// builds' HISTORY header and the demo's anonymised one. Plain Node: the modules run in a vm on a stub engine.
//   node tests/app-alltime.js
const fs = require('fs'), vm = require('vm');
let fails = 0;
const check = (label, cond, info) => { if (!cond) fails++; console.log((cond ? 'PASS ' : 'FAIL ') + label + (info ? '  ' + info : '')); };
const ROOT = __dirname + '/../', MW = ROOT + 'fplgg/tools/matchweek/';
const rd = f => fs.readFileSync(MW + f, 'utf8');
const HT = require(MW + 'tools/history.js'), LG = require(MW + 'tools/league.js');
const cfg = LG.load(), SEED = cfg.seeded;
const clone = o => JSON.parse(JSON.stringify(o));
const strip = src => src.replace(/^import [^\n]*\n/gm, '').replace(/^export (function|const|let|async function)/gm, '$1').replace(/^export \{[^}]*\};?\s*$/gm, '');
const bad = re => s => re.test(s);
const DASH = /[–—]/, HOLE = /NaN|undefined|null/;

/* ---------- F the file ---------- */
console.log('--- F the history file');
const raw = fs.readFileSync(MW + 'history/2025-26.json', 'utf8');
let H = null; try { H = JSON.parse(raw); } catch (e) { }
check('F1 history/2025-26.json is one line of UTF-8 JSON, one object', raw.trim().split('\n').length === 1 && !!H && typeof H === 'object' && !Array.isArray(H) && Buffer.from(H.allstar.PN.player, 'utf8').toString('hex') === '4775c3a96869');
check('F2 the season, the league, six managers by code, 38 weekly scores each, 114 fixtures', H.season === '2025/26' && H.league_id === 47320 && Object.keys(H.teams).sort().join() === 'BK,BS,CT,EG,PJ,PN' && Object.keys(H.weekly).every(c => H.weekly[c].length === 38) && H.fixtures.length === 114 && H.teams.EG === "Maize 'n' Mount" && H.teams.PN === 'Cold Palmers');
const sumOf = a => a.reduce((p, q) => p + q, 0);
check('F3 check 1: each manager\'s 38 weekly scores sum to his PF', H.standings.every(s => sumOf(H.weekly[s.mgr]) === s.PF), H.standings.map(s => s.mgr + ' ' + sumOf(H.weekly[s.mgr]) + '/' + s.PF).join(' '));
const T = {}; Object.keys(H.teams).forEach(c => { T[c] = { W: 0, D: 0, L: 0, PF: 0, PA: 0 }; });
const h2h = {};
H.fixtures.forEach(([g, a, as, bs, b]) => { T[a].PF += as; T[a].PA += bs; T[b].PF += bs; T[b].PA += as; const k = [a, b].sort().join('|'), first = k.split('|')[0]; h2h[k] = h2h[k] || [0, 0, 0];
  if (as > bs) { T[a].W++; T[b].L++; h2h[k][first === a ? 0 : 1]++; } else if (bs > as) { T[b].W++; T[a].L++; h2h[k][first === b ? 0 : 1]++; } else { T[a].D++; T[b].D++; h2h[k][2]++; } });
check('F4 check 2: the fixtures reproduce every W, D, L, PF and PA in the standings, and Pts is 3 W + D', H.standings.every(s => ['W', 'D', 'L', 'PF', 'PA'].every(k => T[s.mgr][k] === s[k]) && 3 * s.W + s.D === s.Pts && s.W + s.D + s.L === s.P && s.P === 38));
check('F5 check 3: the head-to-heads equal league.json seeded, every pair', Object.keys(SEED).length === 15 && Object.keys(SEED).every(k => JSON.stringify(SEED[k]) === JSON.stringify(h2h[k])) && Object.keys(h2h).length === 15);
check('F6 the fixtures agree with the weekly scores gameweek by gameweek, three a gameweek, every manager once', H.fixtures.every(([g, a, as, bs, b]) => H.weekly[a][g - 1] === as && H.weekly[b][g - 1] === bs) && Array.from({ length: 38 }, (_, i) => H.fixtures.filter(f => f[0] === i + 1)).every(fs => fs.length === 3 && new Set(fs.flatMap(f => [f[1], f[4]])).size === 6));
check('F7 tools/history.js loads the file and finds no problem against league.json', HT.load().length === 1 && HT.load()[0].season === '2025/26' && HT.problems(HT.load(), SEED).length === 0, HT.problems(HT.load(), SEED).join('; '));
const slip = fn => { const c = clone(H); fn(c); return HT.problems([c], SEED); };
check('F8 a copying slip fails: one weekly score off, one fixture score off, a standings W off, a seeded record off, a fixture dropped', slip(c => { c.weekly.PN[0]++; }).length > 0 && slip(c => { c.fixtures[0][2]++; }).length > 0 && slip(c => { c.standings[0].W++; }).length > 0 && slip(c => { c.fixtures.pop(); }).length > 0 && HT.problems([H], Object.assign(clone(SEED), { 'BK|BS': [4, 3, 0] })).length > 0 && HT.problems([H], Object.assign(clone(SEED), { 'BK|BS': [4, 3, 0] })).some(p => /seeded BK\|BS/.test(p)));
check('F9 the all-play record in the file adds up to 38 weeks against five', Object.keys(H.allplay).every(c => H.allplay[c].apW + H.allplay[c].apL + H.allplay[c].apT === 190));
/* the file's all-play, recomputed from the weekly scores */
const apOf = c => { let w = 0, l = 0, t = 0; for (let g = 0; g < 38; g++) Object.keys(H.weekly).forEach(o => { if (o === c) return; if (H.weekly[c][g] > H.weekly[o][g]) w++; else if (H.weekly[c][g] < H.weekly[o][g]) l++; else t++; }); return { apW: w, apL: l, apT: t }; };
check('F10 the all-play record in the file equals the one the weekly scores give', Object.keys(H.allplay).every(c => JSON.stringify(apOf(c)) === JSON.stringify(H.allplay[c])), Object.keys(H.allplay).map(c => c + ' ' + JSON.stringify(apOf(c))).join(' '));
check('F11 the header line is the HISTORY global, and the anonymiser maps codes and teams and drops the source and the league id', HT.header([H]).startsWith('const HISTORY=[{"season":"2025/26"') && (() => { const m = { ini: { PN: 'AA', CT: 'BB', PJ: 'CC', EG: 'DD', BS: 'EE', BK: 'FF' }, teams: { 'Cold Palmers': 'Team A', 'I Am a Baleba': 'Team D' } };
  const a = HT.anonymise([H], m, cfg)[0]; return a.teams.AA === 'Team A' && a.teams.DD === 'Team D' && !('league_id' in a) && !/Parker|Drive/.test(a.source) && a.weekly.AA.length === 38 && !('PN' in a.weekly) && a.fixtures[0][1] === 'DD' && a.fixtures[0][4] === 'AA' && a.standings[0].mgr === 'AA' && a.standings[0].team === 'Team A' && a.draft.AA[0] === 'Palmer' && a.allstar.FF.player === 'Gabriel' && a.teams.BB === 'Team BB' && HT.problems([a]).length === 0; })());

/* ---------- the stub engine ---------- */
const TEAMS = {}; Object.keys(cfg.teams).forEach(t => { TEAMS[t] = { mgr: cfg.teams[t].mgr, ini: cfg.teams[t].ini, col: cfg.teams[t].col }; });
const FIRST = {}; Object.keys(cfg.teams).forEach(t => { FIRST[t] = cfg.teams[t].first; });
const SHORTOF = {}; Object.keys(cfg.teams).forEach(t => { SHORTOF[t] = cfg.teams[t].short; });
const names = Object.keys(TEAMS), byIni = {}; names.forEach(t => { byIni[TEAMS[t].ini] = t; });
/* the GW6 fixture: GW1 to GW5 finished, GW6 live, 4 matches a gameweek */
function fixtures() {
  const fx = [];
  for (let g = 1; g <= 9; g++) for (let i = 0; i < 4; i++) {
    const h = names[(i + g) % 8], a = names[(7 - i + g) % 8], done = g <= 5;
    fx.push({ GW: String(g), Home: h, 'Home pts': done ? String(30 + ((g * 7 + i * 3) % 40)) : '12', Away: a, 'Away pts': done ? String(30 + ((g * 5 + i * 11) % 40)) : '9', Finished: done ? 'TRUE' : 'FALSE' });
  }
  return fx;
}
function engine(opt = {}) {
  const ctx = {
    console, JSON, String, Date, Math, Number, Object, Array, Set, Map, RegExp, Boolean, isNaN, parseFloat, parseInt, Error,
    LEAGUE: cfg, TEAMS, SHORTOF, FIRSTOF: t => FIRST[t] || t, SEED: clone(SEED), LOADED_AT: opt.at || 1000, HISTORY: opt.history === undefined ? [clone(H)] : opt.history,
    D: { gw: 6, dlPassed: true, gwsDone: 5, provOver: false, liveNow: true, fx: opt.fx || fixtures(), st: [], mw: [{ GW: '1', 'Deadline (UTC)': '2026-08-14T17:30:00Z' }] },
    num: v => +v || 0, fin: v => String(v).toUpperCase() === 'TRUE', dt: s => (s ? new Date(s) : null), gwDeadline: g => (g === 1 ? new Date('2026-08-14T17:30:00Z') : null),
    document: { body: { dataset: { page: 'league', sub: 'alltime' } } },
  };
  ctx.window = ctx; ctx.UI = {
    esc: s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    short: t => SHORTOF[t] || t, first: t => FIRST[t] || t, you: () => names[0], crest: (t, px) => '<i class="cr" data-t="' + t + '" data-px="' + px + '"></i>',
    icon: (n, px) => '<svg data-icon="' + n + '" width="' + px + '"></svg>', sh: (t, o = {}) => '<div class="sh"><h2>' + t + '</h2>' + (o.aside ? '<span class="aside">' + o.aside + '</span>' : '') + '</div>', empty: (t, s) => '<div class="empty"><b>' + t + '</b>' + (s || '') + '</div>',
  };
  vm.createContext(ctx);
  vm.runInContext(strip(rd('src/alltime.js')), ctx);
  const tap = "const tap = (team, label) => ' data-open=\"manager:' + UI.esc(team) + '\" role=\"button\" tabindex=\"0\" aria-label=\"' + UI.esc(label) + '\"';\n";
  vm.runInContext(tap + strip(rd('src/pages/league/alltime.js')), ctx);
  /* the manager sheet's panel, cut from manager.js, with the kit it uses */
  const mg = rd('src/sheets/manager.js'), from = mg.indexOf('/* ---------- all-time'), to = mg.indexOf('/* ---------- the sheet');
  vm.runInContext("const K = { ord: n => n + (n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th'), note: t => '<p class=\"note\">' + t + '</p>' };\n" + strip(mg.slice(from, to)), ctx);
  vm.runInContext('Object.assign(globalThis, { nameOf, managerOf, f1, f2, pct, sortState, setSort, alltimePage, tableBlock, mark, COLS, alltimePanel, allTime, thisSeason })', ctx);   /* the modules' const exports, reachable from the test */
  return ctx;
}
const count = (h, re) => (h.match(re) || []).length;

/* ---------- M the model reproduces 2025/26 when this season has no finished match ---------- */
console.log('--- M the model, this season not started');
let E = engine({ fx: fixtures().map(f => Object.assign({}, f, { Finished: 'FALSE', 'Home pts': '0', 'Away pts': '0' })) });
let A = E.allTime();
check('M1 eight managers: the six of 2025/26 with 38 played and the two new ones with 0', Object.keys(A.managers).length === 8 && A.rows.length === 8 && ['PN', 'CT', 'PJ', 'EG', 'BS', 'BK'].every(c => A.managers[c].P === 38) && ['JS', 'NG'].every(c => A.managers[c].P === 0 && A.managers[c].played === 1 && A.managers[c].current));
check('M2 every 2025/26 line is the file\'s standings row exactly: W, D, L, PF, PA, Pts, the finish, the team that season', H.standings.every(s => { const m = A.managers[s.mgr], y = m.seasons.find(x => x.season === '2025/26'); return m.W === s.W && m.D === s.D && m.L === s.L && m.PF === s.PF && m.PA === s.PA && m.Pts === s.Pts && y.rank === s.rank && y.team === s.team && y.complete && y.title === (s.rank === 1); }));
check('M3 titles: PN one, nobody else; seasons played 2 for the six (2025/26 and this one), 1 for the new two', A.managers.PN.titles === 1 && Object.keys(A.managers).filter(c => A.managers[c].titles).join() === 'PN' && ['PN', 'CT', 'PJ', 'EG', 'BS', 'BK'].every(c => A.managers[c].played === 2) && A.managers.JS.played === 1);
check('M4 points per match, win %, the average for and against, from the file', Math.abs(A.managers.PN.ppm - 69 / 38) < 1e-9 && Math.abs(A.managers.PN.winPct - 23 / 38) < 1e-9 && Math.abs(A.managers.CT.avg - 1694 / 38) < 1e-9 && Math.abs(A.managers.BK.avgAgainst - 1634 / 38) < 1e-9 && A.managers.JS.ppm === 0 && A.managers.JS.avg === 0);
check('M5 the rows rank by league points: PN, CT, PJ, EG, BS, BK, then the new two', A.rows.map(r => r.code).join() === 'PN,CT,PJ,EG,BS,BK,JS,NG' || A.rows.map(r => r.code).join() === 'PN,CT,PJ,EG,BS,BK,NG,JS', A.rows.map(r => r.code).join());
/* the records, worked out here from the weekly scores and the fixtures */
const mine = c => H.fixtures.map(([g, a, as, bs, b]) => a === c ? { g, opp: b, my: as, their: bs } : b === c ? { g, opp: a, my: bs, their: as } : null).filter(Boolean);
const hiOf = c => mine(c).reduce((b, m) => (!b || m.my > b.my ? m : b), null), loOf = c => mine(c).reduce((b, m) => (!b || m.my < b.my ? m : b), null);
const bigOf = (c, sign) => mine(c).reduce((b, m) => { const d = sign * (m.my - m.their); return d > 0 && (!b || d > sign * (b.my - b.their)) ? m : b; }, null);
const runOf = (c, res) => { let best = 0, cur = 0; mine(c).forEach(m => { const r = m.my > m.their ? 'W' : m.my < m.their ? 'L' : 'D'; if (r === res) { cur++; best = Math.max(best, cur); } else cur = 0; }); return best; };
check('M6 the highest and lowest gameweek scores with their season, gameweek and opponent', Object.keys(H.teams).every(c => { const m = A.managers[c], h = hiOf(c), l = loOf(c); return m.hi.v === h.my && m.hi.gw === h.g && m.hi.season === '2025/26' && m.hi.opp === h.opp && m.lo.v === l.my && m.lo.gw === l.g && m.lo.opp === l.opp; }) && A.managers.BS.hi.v === 84 && A.managers.BS.hi.gw === 7 && A.managers.BS.hi.opp === 'PN' && A.managers.BS.lo.v === 15);
check('M7 the biggest win and heaviest defeat with the margin, season, gameweek and opponent', Object.keys(H.teams).every(c => { const m = A.managers[c], w = bigOf(c, 1), l = bigOf(c, -1); return m.bigWin.m === w.my - w.their && m.bigWin.gw === w.g && m.bigWin.opp === w.opp && m.bigWin.my === w.my && m.bigLoss.m === l.their - l.my && m.bigLoss.gw === l.g && m.bigLoss.opp === l.opp; }) && A.managers.CT.bigWin.m === 46 && A.managers.CT.bigWin.gw === 31 && A.managers.CT.bigWin.opp === 'BS' && A.managers.BS.bigLoss.m === 46);
check('M8 the longest winning and losing runs, with where they ran', Object.keys(H.teams).every(c => { const m = A.managers[c]; return (m.winRun ? m.winRun.n : 0) === runOf(c, 'W') && (m.lossRun ? m.lossRun.n : 0) === runOf(c, 'L'); }) && A.managers.PN.winRun.n === 7 && A.managers.PN.winRun.from.gw === 22 && A.managers.PN.winRun.to.gw === 28 && A.managers.PN.winRun.from.season === '2025/26' && A.managers.BK.lossRun.n === 8);
check('M9 the all-play record is the file\'s', Object.keys(H.teams).every(c => { const a = A.managers[c].allplay, f = H.allplay[c]; return a.w === f.apW && a.l === f.apL && a.t === f.apT; }) && A.managers.JS.allplay.w === 0);
check('M10 the record against each other manager equals league.json seeded, every pair, with points for and against', Object.keys(SEED).every(k => { const [x, y] = k.split('|'), r = A.managers[x].h2h[y], s = A.managers[y].h2h[x]; return r.w === SEED[k][0] && r.l === SEED[k][1] && r.d === SEED[k][2] && s.w === SEED[k][1] && s.l === SEED[k][0] && s.d === SEED[k][2] && r.pf === s.pa && r.pa === s.pf; }) && A.managers.PN.h2h.BK.w === 7 && A.managers.PN.h2h.BK.l === 1 && !('JS' in A.managers.PN.h2h));
check('M11 the 2025/26 first pick and best player', A.managers.PN.drafts.length === 1 && A.managers.PN.drafts[0].season === '2025/26' && A.managers.PN.drafts[0].pick === 'Palmer' && A.managers.PN.drafts[0].star.player === 'Guéhi' && A.managers.PN.drafts[0].star.pts === 179 && A.managers.EG.drafts[0].pick === 'Haaland' && A.managers.JS.drafts.length === 0);
check('M12 this season\'s label, the current team and name of every code, the alias season\'s team kept', E.thisSeason() === '2026/27' && A.managers.EG.team === 'I Am a Baleba' && A.managers.EG.seasons[0].team === "Maize 'n' Mount" && E.nameOf('PN') === 'Parker' && E.managerOf('Cold Palmers') === A.managers.PN && A.seasons.length === 2 && A.seasons[1].current && !A.seasons[1].complete && A.managers.PN.seasons[1].P === 0);
check('M13 the league records: the highest score, the biggest win, the runs, with who', A.records.hi.code === 'BS' && A.records.hi.v.v === 84 && A.records.bigWin.code === 'CT' && A.records.bigWin.v.m === 46 && A.records.winRun.v.n === 7 && A.records.lossRun.v.n === 8);
check('M14 memoised per data load: the same object until LOADED_AT changes', E.allTime() === A && (() => { E.LOADED_AT = 2000; return E.allTime() !== A && E.allTime().rows.length === 8; })());
check('M15 without a HISTORY global the model is this season alone', (() => { const e = engine({ history: undefined, fx: [] }); e.HISTORY = undefined; const a = e.allTime(); return a.rows.length === 8 && a.rows.every(r => r.P === 0 && r.played === 1) && a.records.hi === null; })());

/* ---------- G this season's finished matches added ---------- */
console.log('--- G the GW6 fixture: GW1 to GW5 finished, GW6 live');
E = engine(); A = E.allTime();
const fx = fixtures(), done = fx.filter(f => f.Finished === 'TRUE');
const now = {}; names.forEach(t => { now[TEAMS[t].ini] = { W: 0, D: 0, L: 0, PF: 0, PA: 0, P: 0 }; });
done.forEach(f => { const a = TEAMS[f.Home].ini, b = TEAMS[f.Away].ini, as = +f['Home pts'], bs = +f['Away pts']; now[a].PF += as; now[a].PA += bs; now[b].PF += bs; now[b].PA += as; now[a].P++; now[b].P++; if (as > bs) { now[a].W++; now[b].L++; } else if (bs > as) { now[b].W++; now[a].L++; } else { now[a].D++; now[b].D++; } });
const past = c => H.standings.find(s => s.mgr === c) || { W: 0, D: 0, L: 0, PF: 0, PA: 0, P: 0, Pts: 0 };
check('G1 every manager\'s totals are 2025/26 plus this season\'s finished matches only (GW6 live is left out)', Object.keys(now).every(c => { const m = A.managers[c], p = past(c), n = now[c]; return m.P === p.P + n.P && m.W === p.W + n.W && m.D === p.D + n.D && m.L === p.L + n.L && m.PF === p.PF + n.PF && m.PA === p.PA + n.PA && m.Pts === p.Pts + 3 * n.W + n.D; }) && A.managers.PN.P === 43 && A.managers.JS.P === 5);
const order = Object.keys(now).sort((p, q) => (3 * now[q].W + now[q].D) - (3 * now[p].W + now[p].D) || now[q].PF - now[p].PF);
check('G2 this season\'s finish so far comes from the finished fixtures (3 a win, 1 a draw, points for breaks ties), not complete, no title', order.every((c, i) => { const y = A.managers[c].seasons.find(s => s.current); return y.rank === i + 1 && !y.complete && !y.title && y.P === 5 && y.team === byIni[c]; }));
const nowH2H = {}; done.forEach(f => { const a = TEAMS[f.Home].ini, b = TEAMS[f.Away].ini, as = +f['Home pts'], bs = +f['Away pts']; const k = [a, b].sort().join('|'), first = k.split('|')[0], r = nowH2H[k] || (nowH2H[k] = [0, 0, 0]); if (as === bs) r[2]++; else r[(as > bs ? a : b) === first ? 0 : 1]++; });
const pairs = []; for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) pairs.push([TEAMS[names[i]].ini, TEAMS[names[j]].ini].sort().join('|'));
check('G3 the Derbies agreement: for every pair the record is SEED plus this season\'s finished meetings (the series the Derbies page shows)', pairs.every(k => { const [x, y] = k.split('|'), s = SEED[k] || [0, 0, 0], n = nowH2H[k] || [0, 0, 0], r = (A.managers[x].h2h[y] || { w: 0, d: 0, l: 0 }); return r.w === s[0] + n[0] && r.l === s[1] + n[1] && r.d === s[2] + n[2]; }) && pairs.some(k => (nowH2H[k] || [0, 0, 0]).some(v => v > 0)));
check('G4 the engine and the Derbies page add this season the same way (finished fixtures onto SEED)', /function buildH2H\(\)\{LIVEH2H=\{\};\n  D\.fx\.filter\(f=>fin\(f\.Finished\)\)/.test(rd('core.gen.js')) && /const sd=SEED\[k\]\|\|\[0,0,0\],lv=LIVEH2H\[k\]\|\|\[0,0,0\]/.test(rd('core.gen.js')) && /sd = SEED\[k\] \|\| \[0, 0, 0\]/.test(rd('src/pages/league/data.js')) && /played\.forEach\(f => \{ const h = num\(f\['Home pts'\]\), a = num\(f\['Away pts'\]\); if \(h === a\) dr\+\+;/.test(rd('src/pages/league/data.js')));
const apNow = c => { let w = 0, l = 0, t = 0; for (let g = 1; g <= 5; g++) { const sc = {}; done.filter(f => +f.GW === g).forEach(f => { sc[TEAMS[f.Home].ini] = +f['Home pts']; sc[TEAMS[f.Away].ini] = +f['Away pts']; }); Object.keys(sc).forEach(o => { if (o === c) return; if (sc[c] > sc[o]) w++; else if (sc[c] < sc[o]) l++; else t++; }); } return { w, l, t }; };
check('G5 the all-play record adds this season\'s finished gameweeks (seven opponents a week)', Object.keys(now).every(c => { const a = A.managers[c].allplay, f = H.allplay[c] || { apW: 0, apL: 0, apT: 0 }, n = apNow(c); return a.w === f.apW + n.w && a.l === f.apL + n.l && a.t === f.apT + n.t && n.w + n.l + n.t === 35; }));
check('G6 a new manager\'s one season: his line is this season alone and he has no 2025/26 head-to-head', A.managers.JS.seasons.length === 1 && A.managers.JS.seasons[0].current && A.managers.JS.played === 1 && A.managers.JS.titles === 0 && Object.keys(A.managers.JS.h2h).every(o => (A.managers.JS.h2h[o].w + A.managers.JS.h2h[o].d + A.managers.JS.h2h[o].l) <= 5));
check('G7 a record this season beats the file: the highest score moves to this season when it is higher', (() => { const f2 = fixtures(); f2[0]['Home pts'] = '99'; const e = engine({ fx: f2 }); const a = e.allTime(); const c = TEAMS[f2[0].Home].ini; return a.managers[c].hi.v === 99 && a.managers[c].hi.season === '2026/27' && a.managers[c].hi.gw === 1 && a.records.hi.code === c; })());

/* ---------- U the League sub-tab ---------- */
console.log('--- U League > All-time');
let page = E.alltimePage();
const PN = A.managers.PN, ff1 = v => (Math.round(v * 10) / 10).toFixed(1), ff2 = v => (Math.round(v * 100) / 100).toFixed(2);
check('U1 the sub-tab is registered: SUBS, the render case, the mount', (() => { const l = rd('src/pages/league.js'); return /\{ id: 'alltime', label: 'All-time' \}/.test(l) && /case 'alltime': body = alltimePage\(\); break;/.test(l) && /if \(sub === 'alltime'\) mountAlltime\(root\);/.test(l) && /import \{ alltimePage, mountAlltime \} from '\.\/league\/alltime\.js';/.test(l); })());
check('U2 one table with eight rows, the header #, Manager and the five sort buttons, Pts sorted descending by default', count(page, /<div class="at-tr/g) === 8 && count(page, /<section class="card at-tbl"/g) === 1 && /<div class="at-th"><span>#<\/span><span><\/span><span>Manager<\/span>/.test(page) && ['p', 'w', 'pts', 'ppm', 'avg'].every(id => page.includes('data-sort="' + id + '"')) && /data-sort="pts" class="on" aria-sort="descending"/.test(page));
const rowsOf = h => h.split('<div class="at-tr').slice(1);
let rs = rowsOf(page);
check('U3 the rows in the model\'s order, each with the rank, the crest, the first name, the seasons line, P, W-D-L, Pts, PPM and Avg', rs.length === 8 && rs[0].includes('data-t="Cold Palmers"') && rs[0].includes('<b class="ell">Parker') &&  rs[0].includes('<span class="n v">' + PN.P + '</span><span class="n v rec">' + PN.W + '-' + PN.D + '-' + PN.L + '</span><b class="n v pts on">' + PN.Pts + '</b><span class="n v">' + ff2(PN.ppm) + '</span><span class="n v">' + ff1(PN.avg) + '</span>') && PN.P === 43 && PN.Pts === 69 + 3 * PN.seasons[1].W + PN.seasons[1].D && rs[6].includes('1 season') && rs.every(r => /data-open="manager:/.test(r)));
check('U4 you are marked, every row opens the manager sheet with a label that reads the numbers', count(page, /<div class="at-tr you"/g) === 1 && rs[0].includes('<span class="l2 ell">2 seasons</span>') && /<i class="tt" role="img" aria-label="1 title"><svg/.test(rs[0]) && !/class="tt"/.test(rs[1]) && !/class="me"/.test(page) && page.includes('aria-label="1, Parker (you), Cold Palmers, 43 played, ' + PN.W + ' won ' + PN.D + ' drawn ' + PN.L + ' lost, ' + PN.Pts + ' points, ' + ff2(PN.ppm) + ' a match, ' + ff1(PN.avg) + ' a gameweek"'));
E.setSort('ppm'); page = E.alltimePage(); rs = rowsOf(page);
const byPpm = A.rows.slice().sort((p, q) => q.ppm - p.ppm || q.Pts - p.Pts).map(r => r.code);
check('U5 a tap on PPM sorts by points per match, the column lit', rs.map(r => /data-t="([^"]+)"/.exec(r)[1]).map(t => TEAMS[t].ini).join() === byPpm.join() && /data-sort="ppm" class="on" aria-sort="descending"/.test(page) && !/data-sort="pts" class="on"/.test(page) && E.sortState().sort === 'ppm');
E.setSort('ppm'); page = E.alltimePage(); rs = rowsOf(page);
check('U6 the same tap again flips the direction', rs.map(r => /data-t="([^"]+)"/.exec(r)[1]).map(t => TEAMS[t].ini).join() === byPpm.slice().reverse().join() && /aria-sort="ascending"/.test(page) && E.sortState().dir === 1);
E.setSort('w'); page = E.alltimePage(); rs = rowsOf(page);
check('U7 W-D-L sorts by wins; an unknown column is ignored', rs.map(r => /data-t="([^"]+)"/.exec(r)[1]).map(t => A.managers[TEAMS[t].ini].W).every((w, i, a) => i === 0 || a[i - 1] >= w) && (E.setSort('nope'), E.sortState().sort === 'w'));
E.setSort('pts'); page = E.alltimePage();
check('U8 the records: four tiles with the holder and where, and the data-state line', count(page, /<div class="tile at-rec">/g) === 4 && /Highest score<\/span><b class="n">84<\/b><span class="w"><i class="cr" data-t="Trophy Hunters"[^>]*><\/i><span>Bryant<\/span><\/span><span class="sub">2025\/26 GW7 v Parker<\/span>/.test(page) && /Biggest win<\/span><b class="n">61-15<\/b>/.test(page) && /Longest winning run<\/span><b class="n">7<\/b>/.test(page) && /2025\/26 GW22 to 2025\/26 GW28/.test(page) && /<p class="lg-cap">Finished gameweeks only\.<\/p>/.test(page) && /<span class="aside">2025\/26 and 2026\/27 so far<\/span>/.test(page));
check('U9 no en or em dash, no NaN, undefined or null anywhere on the page', !DASH.test(page) && !HOLE.test(page.replace(/[^\w]null/g, '')), (page.match(/.{20}(NaN|undefined|null|[–—]).{20}/) || [''])[0]);
check('U10 the sort state is kept in localStorage under its own key, and the page without a history still renders eight rows', /localStorage\.setItem\(KEY/.test(rd('src/pages/league/alltime.js')) && rd('src/pages/league/alltime.js').includes("const KEY = 'emt-lg-at'") && (() => { const e = engine({ history: [], fx: [] }); const p = e.alltimePage(); return count(p, /<div class="at-tr/g) === 8 && !/at-rec/.test(p) && /<span class="aside">2026\/27 so far<\/span>/.test(p); })());

/* ---------- S the manager sheet ---------- */
console.log('--- S the manager sheet\'s All-time tab');
const mg = rd('src/sheets/manager.js');
check('S1 the sheet has the All-time tab, its panel and the lazy draw', /\['season', 'Season'\], \['alltime', 'All-time'\]\]/.test(mg) && /K\.panel\('alltime', null\)/.test(mg) && /alltime: \(\) => alltimePanel\(team\)/.test(mg) && /import \{ allTime, managerOf, nameOf, f1, f2, pct \} from '\.\.\/alltime\.js';/.test(mg));
let sheet = E.alltimePanel('Cold Palmers');
check('S2 his line: played, W-D-L, points, per match, for, against, a gameweek, won', sheet.includes('<div class="card at-line"><div><b class="n">' + PN.P + '</b><span>played</span></div><div><b class="n">' + PN.W + '-' + PN.D + '-' + PN.L + '</b><span>W-D-L</span></div><div><b class="n">' + PN.Pts + '</b><span>points</span></div><div><b class="n">' + ff2(PN.ppm) + '</b><span>per match</span></div><div><b class="n">' + PN.PF + '</b><span>for</span></div><div><b class="n">' + PN.PA + '</b><span>against</span></div><div><b class="n">' + ff1(PN.avg) + '</b><span>a gameweek</span></div><div><b class="n">' + Math.round(PN.winPct * 100) + '%</b><span>won</span></div></div>') && /<span class="aside">2 seasons · 1 title<\/span>/.test(sheet));
check('S3 his records: the seven rows with where they happened', ['Highest score', 'Lowest score', 'Biggest win', 'Heaviest defeat', 'Longest winning run', 'Longest losing run', 'All-play record'].every(l => sheet.includes('<b>' + l + '</b>')) && /Longest winning run<\/b><span class="sub">2025\/26 GW22 to 2025\/26 GW28<\/span><\/div><span class="ms-snv"><b class="n">7<\/b>/.test(sheet) && /All-play record<\/b><span class="sub">W-L-T against every manager every gameweek<\/span><\/div><span class="ms-snv"><b class="n">\d+-\d+-\d+<\/b>/.test(sheet) && /Lowest score<\/b><span class="sub">2025\/26 GW29 v Bryant<\/span>/.test(sheet) === false || /Lowest score<\/b><span class="sub">2025\/26 GW\d+ v \w+<\/span><\/div><span class="ms-snv"><b class="n">18<\/b>/.test(sheet));
check('S4 his finishes by season, newest first: this season so far with its star, 2025/26 1st with the title mark', count(sheet, /<div class="at-sr(?: ttl)?">/g) === 2 && /<div class="at-sr"><span class="n">2026\/27<\/span><span class="tm">Cold Palmers<\/span><span class="n">\d+(st|nd|rd|th)\*<\/span><span class="n">\d-\d-\d<\/span><b class="n">\d+<\/b><\/div><div class="at-sr ttl"><span class="n">2025\/26<\/span><span class="tm">Cold Palmers<\/span><span class="n">1st<i>title<\/i><\/span><span class="n">23-0-15<\/span><b class="n">69<\/b><\/div>/.test(sheet) && sheet.includes('* so far, finished gameweeks only.'));
check('S5 his 2025/26 draft: the first pick and the best player with position, club and points', /<h2>2025\/26 draft<\/h2>/.test(sheet) && /First pick<\/b><\/div><span class="ms-snv"><b>Palmer<\/b>/.test(sheet) && /Best player<\/b><span class="sub">DEF \/ MCI<\/span><\/div><span class="ms-snv"><b>Guéhi<\/b><span class="sub"><span class="n">179<\/span> pts<\/span>/.test(sheet));
check('S6 head to head: a row per manager he has met, in all-time order, W-D-L and for-against, each opening his sheet', count(sheet, /<div class="at-hr"/g) === Object.keys(PN.h2h).length && Object.keys(PN.h2h).length >= 6 && /<div class="at-hr" data-open="manager:Kobbie Mainoo Fan"[^>]*><i class="cr" data-t="Kobbie Mainoo Fan"[^>]*><\/i><span class="nm ell">Baha<\/span><b class="n">\d+-\d+-\d+<\/b><span class="n pf">\d+-\d+<\/span><\/div>/.test(sheet) && sheet.indexOf('manager:' + A.rows[1].team + '"') < sheet.indexOf('manager:' + A.rows[7].team + '"') && new RegExp('Baha<\\/span><b class="n">' + PN.h2h.BK.w + '-' + PN.h2h.BK.d + '-' + PN.h2h.BK.l + '<').test(sheet) && (() => { const c = Object.keys(PN.h2h).find(x => !(x in H.teams)); return !!c && new RegExp('<span class="nm ell">' + FIRST[byIni[c]] + '</span><b class="n">[0-5]-[0-5]-[0-5]<').test(sheet); })());
check('S7 no en or em dash, no NaN, undefined or null in the panel', !DASH.test(sheet) && !HOLE.test(sheet), (sheet.match(/.{20}(NaN|undefined|null|[–—]).{20}/) || [''])[0]);
check('S8 the alias season reads the team\'s name that season; a new manager has one season and no draft card', E.alltimePanel('I Am a Baleba').includes("<span class=\"tm\">Maize &#39;n&#39; Mount</span>") && count(E.alltimePanel('Team Jacob'), /<div class="at-sr(?: ttl)?">/g) === 1 && !/draft<\/h2>/.test(E.alltimePanel('Team Jacob')) && E.alltimePanel('Team Jacob').includes('<span>played</span>'));
check('S9 a manager with no finished match yet gets the empty state', (() => { const e = engine({ history: [], fx: [] }); return /<div class="empty"><b>No finished match yet<\/b>/.test(e.alltimePanel('Team Jacob')); })());

/* ---------- B the builds, the audit, the stylesheet ---------- */
console.log('--- B the builds and the audit');
check('B1 ci-build.sh checks the history against league.json and writes the HISTORY header after LEAGUE', /H=require\("\.\/tools\/history\.js"\).*H\.problems\(h,c\.seeded\).*process\.stdout\.write\(L\.header\(c\)\+H\.header\(h\)\)/.test(rd('ci-build.sh')));
check('B2 the preview build and the demo build do the same (the demo with the anonymised seasons)', /history\.header\(hist\)/.test(fs.readFileSync(ROOT + 'fplgg/tools/preview/build-preview.js', 'utf8')) && /history\.problems\(hist, cfg\.seeded\)/.test(fs.readFileSync(ROOT + 'fplgg/tools/preview/build-preview.js', 'utf8')) && /history\.header\(history\.anonymise\(history\.load\(\), m, cfg\)\)/.test(fs.readFileSync(ROOT + 'fplgg/tools/demo/build-demo.js', 'utf8')));
check('B3 the contrast audit walks League > All-time and the sheet\'s All-time tab', (() => { const a = fs.readFileSync(ROOT + 'fplgg/tools/contrast/audit.js', 'utf8'); return a.includes("'overview', 'results', 'money', 'derbies', 'stats', 'alltime'") && a.includes("['season', 'squad', 'alltime']"); })());
check('B4 the stylesheet: the table grid, the sort button\'s active state in the accent, the sheet\'s line, season and head-to-head rows', (() => { const c = rd('src/css/45-alltime.css'); return /\.at-th,\.at-tr\{display:grid;grid-template-columns:/.test(c) && /\.at-th button\.on\{color:var\(--p100\);border-bottom-color:var\(--p300\)\}/.test(c) && /\.at-line\{display:grid;grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/.test(c) && /\.at-sr\{display:grid/.test(c) && /\.at-hr\{display:grid/.test(c); })());
check('B5 the test lists are in step: CLAUDE.md and tests/README.md name this suite', fs.readFileSync(ROOT + 'CLAUDE.md', 'utf8').includes('node tests/app-alltime.js') && fs.readFileSync(ROOT + 'tests/README.md', 'utf8').includes('app-alltime'));
check('B6 the Seasons table\'s team name takes two lines and is never cut (the Q5 review, 10 Oct 2026): no ell on the cell, the two-line clamp with wrapping in the stylesheet, the balanced split', !/<span class="tm ell">/.test(mg) && /<span class="tm">' \+ esc\(s\.team\)/.test(mg) && (() => { const c = rd('src/css/45-alltime.css'); const m = c.match(/^\.at-sr \.tm\{([^}]*)\}/m); return !!m && /-webkit-line-clamp:2/.test(m[1]) && /overflow-wrap:anywhere/.test(m[1]) && !/nowrap|text-overflow/.test(m[1]); })() && /\.at-sr \.tm\{text-wrap-style:balance\}/.test(rd('src/css/02-components.css')));

console.log(fails ? fails + ' FAILED' : 'ALL PASS');
process.exit(fails ? 1 : 0);
