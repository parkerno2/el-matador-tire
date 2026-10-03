/* Headless engine tests for the built v12 page: title odds (live-GW split #24, seeded draw TP-14), auto-subs in blank
   and double gameweeks (#8), provisional bonus per fixture (#8), and the Predictions fallback label (#6).
   Loads every inline script of the built page into a vm context with a stub DOM and a fake clock, and serves the sheet
   tabs from synthetic leagues built below (gviz JSON through the page's own readTab), so it needs no browser.

   Run:  python3 fplgg/tools/v12/build_v12.py index-PREVIEW.html && node fplgg/tools/v12/test-engines.js   (the fresh v12.html)
         node fplgg/tools/v12/test-engines.js path/to/page.html     (any build, e.g. an older one to see the bugs)
   Real-data mode (optional): --tabs DIR [--now ISO] [--compare OLD.html]
         loads a folder of exported gviz tabs (one <Tab>.json per tab), prints the odds, checks the draw is
         reproducible across fresh loads, and with --compare checks that nothing but the odds moved against OLD.html. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '../../..');
const argv = process.argv.slice(2);
const opt = k => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const PAGE = path.resolve(argv.find((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--'))) || path.join(ROOT, 'v12.html'));

/* ---------------------------------------------------------------- stub browser ---------------------------------------------------------------- */
function stub() {
  const store = new Map();
  const p = new Proxy(function () {}, {
    get(t, k) {
      if (store.has(k)) return store.get(k);
      if (k === Symbol.toPrimitive) return () => '';
      if (k === Symbol.iterator) return function* () {};
      if (typeof k === 'symbol') return undefined;
      if (k === 'length') return 0;
      if (k === 'toString' || k === 'valueOf') return () => '';
      const c = stub(); store.set(k, c); return c;
    },
    set(t, k, v) { store.set(k, v); return true; },
    apply() { return stub(); },
    construct() { return stub(); },
    deleteProperty(t, k) { store.delete(k); return true; }
  });
  return p;
}
function gviz(rows) {
  const cols = []; rows.forEach(r => Object.keys(r).forEach(k => { if (!cols.includes(k)) cols.push(k); }));
  return { version: '0.6', status: 'ok', table: { cols: cols.map(l => ({ id: l, label: l, type: 'string' })),
    rows: rows.map(r => ({ c: cols.map(k => (r[k] === undefined || r[k] === null || r[k] === '') ? null : { v: r[k] }) })) } };
}
function makeEnv(nowIso) {
  let NOW = Date.parse(nowIso);
  const RealDate = Date;
  class FakeDate extends RealDate {
    constructor(...a) { if (a.length === 0) super(NOW); else super(...a); }
    static now() { return NOW; }
  }
  const env = { errors: [], tabs: () => ({}) };
  const els = new Map();
  const head = stub();
  head.appendChild = el => {
    const src = String(el.src || '');
    if (src.includes('/gviz/tq')) {
      const u = new URL(src), tqx = u.searchParams.get('tqx') || '', cb = (/responseHandler:([\w$]+)/.exec(tqx) || [])[1];
      const name = u.searchParams.get('sheet'), tabs = env.tabs(), t = tabs[name];
      const body = t === undefined ? gviz([]) : (typeof t === 'string' ? JSON.parse(t) : gviz(t));
      Promise.resolve().then(() => { if (typeof ctx[cb] === 'function') ctx[cb](body); });
    }
    return el;
  };
  const document = stub();
  Object.assign(document, {
    head, body: stub(), documentElement: stub(),
    createElement: () => stub(), createElementNS: () => stub(), createTextNode: () => stub(),
    getElementById: id => { if (!els.has(id)) els.set(id, stub()); return els.get(id); },
    querySelector: () => stub(), querySelectorAll: () => [], getElementsByClassName: () => [], getElementsByTagName: () => [],
    addEventListener() {}, removeEventListener() {}, visibilityState: 'visible', readyState: 'complete', hidden: false
  });
  const mem = new Map();
  let ctx = {
    Date: FakeDate, console: { log() {}, info() {}, warn() {}, debug() {}, error: (...a) => env.errors.push(a.map(x => (x && x.stack) || String(x)).join(' ')) },
    document, navigator: { userAgent: 'node', onLine: true, standalone: false, maxTouchPoints: 0, clipboard: stub(), vibrate() {} },
    location: { hash: '', href: 'https://parkerno2.github.io/el-matador-tire/v12.html', protocol: 'https:', host: 'parkerno2.github.io',
      hostname: 'parkerno2.github.io', origin: 'https://parkerno2.github.io', pathname: '/el-matador-tire/v12.html', search: '', replace() {}, reload() {}, assign() {} },
    history: { replaceState() {}, pushState() {}, back() {}, state: null, length: 1 },
    localStorage: { getItem: k => mem.has(k) ? mem.get(k) : null, setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k), clear: () => mem.clear(), key: () => null, length: 0 },
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {}, clear() {} },
    setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {}, requestAnimationFrame: () => 0, cancelAnimationFrame() {},
    requestIdleCallback: () => 0, queueMicrotask, structuredClone, performance: { now: () => performance.now(), mark() {}, measure() {} },
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
    getComputedStyle: () => stub(), scrollTo() {}, scrollBy() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() {},
    innerWidth: 390, innerHeight: 844, devicePixelRatio: 2, scrollY: 0, pageYOffset: 0,
    fetch: () => new Promise(() => {}), Image: function () { return stub(); }, CSS: { escape: s => String(s), supports: () => false },
    IntersectionObserver: function () { return stub(); }, MutationObserver: function () { return stub(); }, ResizeObserver: function () { return stub(); },
    URL, URLSearchParams, TextEncoder, TextDecoder, crypto: globalThis.crypto, atob, btoa, Blob: function () { return stub(); },
    HTMLElement: function () {}, Element: function () {}, Node: function () {}, Event: function () { return stub(); }, CustomEvent: function () { return stub(); },
    alert() {}, confirm: () => false, prompt: () => null, open: () => null
  };
  /* an ordinary global object (no contextify interceptors): global function calls run at full speed */
  const g = vm.createContext(vm.constants.DONT_CONTEXTIFY);
  Object.assign(g, ctx); g.window = g; g.self = g; g.top = g; g.parent = g;
  ctx = g; env.ctx = g;
  env.setNow = iso => { NOW = Date.parse(iso); };
  env.ev = code => vm.runInContext(code, ctx);
  return env;
}
const flush = async () => { for (let i = 0; i < 20; i++) await new Promise(r => setImmediate(r)); };
async function openPage(page, tabs, nowIso) {
  const env = makeEnv(nowIso);
  env.tabs = () => tabs;
  const html = fs.readFileSync(page, 'utf8');
  const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  scripts.forEach((code, i) => {
    try { vm.runInContext(code, env.ctx, { filename: path.basename(page) + '#script' + i }); }
    catch (e) { env.errors.push('script ' + i + ' did not load: ' + ((e && e.stack) || e)); }
  });
  await flush();
  env.load = async (t, nowIso2) => { if (t) env.tabs = () => t; if (nowIso2) env.setNow(nowIso2); await env.ev('loadAll()'); await flush(); };
  await env.load();
  return env;
}

/* ---------------------------------------------------------------- synthetic league ---------------------------------------------------------------- */
const CLUBS = ['ARS', 'AVL', 'BOU', 'BRE', 'BHA', 'CHE', 'CRY', 'EVE', 'FUL', 'LEE', 'LIV', 'MCI', 'MUN', 'NEW', 'NFO', 'SUN', 'TOT', 'WHU', 'WOL', 'BUR'];
const SLOTPOS = [null, 'GKP', 'DEF', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'MID', 'FWD', 'FWD', 'GKP', 'DEF', 'MID', 'FWD'];
const DAY = 864e5, GW1_DL = Date.UTC(2026, 8, 5, 10);   /* GW6 deadline = Sat 10 Oct 10:00 UTC, as in the real sheet */
const iso = ms => new Date(ms).toISOString().replace('.000Z', 'Z');
function roundRobin(list) {           /* circle method: rounds of [home, away] pairs */
  const a = list.slice(), n = a.length, out = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs = [];
    for (let i = 0; i < n / 2; i++) { const x = a[i], y = a[n - 1 - i]; pairs.push(r % 2 ? [y, x] : [x, y]); }
    out.push(pairs); a.splice(1, 0, a.pop());
  }
  return out;
}
const hash01 = (...k) => { let h = 2166136261; const s = k.join('|'); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 1000) / 1000; };
/* teams: the page's own TEAMS keys. o: {gws, done, cur, locked, predGws, clubOf(t,s), h2h(g,home,away)->[hp,ap], cf(rows)->rows, live:{code:{...}}} */
function league(teams, o) {
  o = Object.assign({ gws: 38, done: 5, cur: 6, locked: false, predGws: [2, 3, 4, 5, 6], live: {} }, o);
  const players = [];
  teams.forEach((t, ti) => { for (let s = 1; s <= 15; s++) {
    const code = 100000 + ti * 100 + s, club = (o.clubOf && o.clubOf(t, s, ti)) || CLUBS[(ti * 3 + s * 7) % 20];
    players.push({ t, ti, s, code, Pos: SLOTPOS[s], Club: club, Player: 'P' + ti + '-' + s, xi: s <= 11 });
  } });
  const byCode = {}; players.forEach(p => { byCode[p.code] = p; });
  /* Club Fixtures: one round robin per half, kickoffs from deadline + 1.5 h */
  const rr = roundRobin(CLUBS);
  let cf = [];
  for (let g = 1; g <= o.gws; g++) {
    const pairs = rr[(g - 1) % 19].map(([h, a]) => g > 19 ? [a, h] : [h, a]), dl = GW1_DL + (g - 1) * 7 * DAY;
    pairs.forEach(([h, a], i) => { const done = g <= o.done;
      cf.push({ GW: g, Home: h, Away: a, 'Kickoff (UTC)': iso(dl + 1.5 * 36e5 + Math.floor(i / 3) * 3 * 36e5), Finished: done, Started: done,
        'Home goals': done ? 1 : '', 'Away goals': done ? 1 : '', Mins: done ? 90 : 0 }); });
  }
  if (o.cf) cf = o.cf(cf);
  /* GW Stats: finished GWs from a deterministic generator, the live GW from o.live */
  const gws = [];
  const nfx = (g, c) => cf.filter(f => f.GW === g && (f.Home === c || f.Away === c)).length;
  for (let g = 1; g <= o.done; g++) players.forEach(p => {
    if (!nfx(g, p.Club)) return;
    const mins = p.xi ? 90 : (hash01('b', g, p.code) < .3 ? 20 : 0), pts = mins ? Math.round(1 + 8 * hash01('p', g, p.code)) : 0;
    gws.push({ GW: g, Code: p.code, Player: p.Player, Pos: p.Pos, Club: p.Club, Owner: p.t, Mins: mins, Pts: pts, G: 0, A: 0, CS: 0, GC: 1, OG: 0, PS: 0, PM: 0,
      YC: 0, RC: 0, Saves: 0, Bonus: 0, BPS: mins ? 10 + Math.round(20 * hash01('x', g, p.code)) : 0, DefCon: 0,
      xG: p.Pos === 'FWD' ? .35 : p.Pos === 'MID' ? .15 : .03, xA: .08, xGC: 1.2, Starts: p.xi ? 1 : 0, Final: true });
  });
  Object.keys(o.live).forEach(code => { const p = byCode[code], L = o.live[code];
    gws.push(Object.assign({ GW: o.cur, Code: +code, Player: p.Player, Pos: p.Pos, Club: p.Club, Owner: p.t, Mins: 0, Pts: 0, G: 0, A: 0, CS: 0, GC: 0, OG: 0,
      PS: 0, PM: 0, YC: 0, RC: 0, Saves: 0, Bonus: 0, BPS: 0, DefCon: 0, xG: 0, xA: 0, xGC: 0, Starts: 0, Final: false }, L)); });
  (o.extraStats || []).forEach(r => gws.push(Object.assign({ GW: o.cur, Owner: '', G: 0, A: 0, CS: 0, GC: 0, OG: 0, PS: 0, PM: 0, YC: 0, RC: 0, Saves: 0,
    Bonus: 0, BPS: 0, DefCon: 0, xG: 0, xA: 0, xGC: 0, Starts: 1, Final: false }, r)));
  /* H2H: 8-team round robin, results = XI points unless o.h2h says otherwise */
  const trr = roundRobin(teams), fx = [];
  const xiPts = (g, t) => players.filter(p => p.t === t && p.xi).reduce((s, p) => { const r = gws.find(x => x.GW === g && x.Code === p.code); return s + (r ? r.Pts : 0); }, 0);
  for (let g = 1; g <= o.gws; g++) trr[(g - 1) % 7].forEach(([h, a]) => {
    const done = g <= o.done, r = done ? (o.h2h ? o.h2h(g, h, a) : [xiPts(g, h), xiPts(g, a)]) : (g === o.cur && o.h2hLive ? o.h2hLive(h, a) : [0, 0]);
    fx.push({ GW: g, Home: h, 'Home pts': r[0], Away: a, 'Away pts': r[1], Finished: done });
  });
  const st = teams.map(t => { const s = { Team: t, Manager: 'M ' + t, W: 0, D: 0, L: 0, 'Pts For': 0, 'Pts Against': 0, 'League Pts': 0 };
    fx.filter(f => f.Finished && (f.Home === t || f.Away === t)).forEach(f => { const m = f.Home === t ? f['Home pts'] : f['Away pts'], y = f.Home === t ? f['Away pts'] : f['Home pts'];
      s['Pts For'] += m; s['Pts Against'] += y; if (m > y) { s.W++; s['League Pts'] += 3; } else if (m < y) s.L++; else { s.D++; s['League Pts']++; } });
    return s; });
  const mw = []; for (let g = 1; g <= o.gws; g++) mw.push({ GW: g, 'Deadline (UTC)': iso(GW1_DL + (g - 1) * 7 * DAY), 'MOTM period': 'X', Finished: g <= o.done, Notes: '' });
  const curRow = code => gws.find(r => r.GW === o.cur && r.Code === code);
  const ro = players.map(p => ({ Team: p.t, Manager: 'M ' + p.t, Player: p.Player, Pos: p.Pos, Club: p.Club, 'FPL rank': 50 + p.s * 10, 'Proj pts': 120 - p.s * 4,
    'Best XI': p.xi ? 'XI' : 'Bench', Status: (o.status && o.status[p.code]) || 'a', News: (o.news && o.news[p.code]) || '', Drafted: 'R' + (p.s + 2) + '.' + (p.ti + 1),
    'Season pts': 30, 'GW pts': curRow(p.code) ? curRow(p.code).Pts : 0, 'GW mins': curRow(p.code) ? curRow(p.code).Mins : 0, Code: p.code, Nation: 'GB-ENG', OVR: 80,
    TOTW: '', 'GW XI': o.locked ? (p.xi ? 'XI' : 'BEN') : '', Slot: o.locked ? p.s : 0 }));
  const plr = players.map(p => ({ Code: p.code, Player: p.Player, Pos: p.Pos, Club: p.Club, Owner: p.t, Status: (o.status && o.status[p.code]) || 'a',
    News: (o.news && o.news[p.code]) || '', 'Draft rank': 40 + p.ti * 15 + p.s, 'Season pts': 30, Mins: 450, Form: 4, xGI: .3, 'EP next': 3, Proj: 100, Nation: 'GB-ENG', 'Full name': p.Player }));
  const pred = []; o.predGws.forEach(g => players.forEach(p => pred.push({ GW: g, Code: p.code, Player: p.Player, Pos: p.Pos, Club: p.Club,
    EP: Math.round((2 + 4 * hash01('ep', g, p.code)) * 10) / 10, Proj: 100, 'Captured (UTC)': iso(GW1_DL + (g - 1) * 7 * DAY - 36e5) })));
  return { players, byCode, tabs: { Rosters: ro, Standings: st, 'H2H Fixtures': fx, Matchweeks: mw, 'Club Fixtures': cf, Predictions: pred, 'GW Stats': gws, Players: plr,
    Specials: [{ Setting: 'POTM player', Value: '' }], Clubs: CLUBS.map(c => ({ Short: c, Name: c, 'Badge code': '1' })) } };
}

/* ---------------------------------------------------------------- tiny test runner ---------------------------------------------------------------- */
let pass = 0, fail = 0;
const results = [];
function check(name, ok, detail) { (ok ? pass++ : fail++); results.push((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  [' + detail + ']' : '')); console.log((ok ? '  PASS ' : '  FAIL ') + name + (detail ? '  [' + detail + ']' : '')); }
const has = (env, name) => env.ev('typeof ' + name) === 'function';
/* simulate() is memoized per data load (v12-look); a new D.pbonus object busts the memo so this draws again */
const SIM = '(()=>{D.pbonus=Object.assign({},D.pbonus);return simulate()})()';
const r1 = x => Math.round(x * 10) / 10;

async function main() {
  console.log('page: ' + PAGE);
  if (opt('--tabs')) return realData();
  const T0 = await openPage(PAGE, {}, '2026-10-03T21:00:00Z');
  const TEAMS = T0.ev('Object.keys(TEAMS)');
  const A = TEAMS[0];
  const cfOf = (tabs, g) => tabs['Club Fixtures'].filter(f => f.GW === g);

  /* ===== 1. #24 live-GW split: banked points are not shrunk ===== */
  console.log('\n#24 title odds, live gameweek');
  {
    /* GW6 at 15:00 on Saturday: the 11:30 and 14:00 games are over, the rest not started. Team A has nine starters
       from finished games on 82 points and two still to play: proj final about 90. */
    const base = league(TEAMS, { locked: true });
    const g6 = cfOf(base.tabs, 6), doneClubs = [], waitClubs = [];
    g6.forEach((f, i) => (i < 5 ? doneClubs : waitClubs).push(f.Home, f.Away));
    const clubOf = (t, s, ti) => ti === 0 ? (s <= 9 ? doneClubs[s - 1] : s <= 11 ? waitClubs[s - 10] : doneClubs[s % 10]) : null;
    const pre = league(TEAMS, { locked: true, clubOf });
    const live = {}; const ptsA = [12, 2, 9, 8, 6, 14, 11, 10, 10];
    pre.players.filter(p => p.ti === 0 && p.s <= 9).forEach((p, i) => { live[p.code] = { Mins: 90, Starts: 1, Pts: ptsA[i], BPS: 20 + i, Bonus: 1 }; /* official bonus in: no provisional on top */ });
    const L = league(TEAMS, { locked: true, clubOf, live,
      cf: rows => rows.map(f => (f.GW === 6 && doneClubs.includes(f.Home)) ? Object.assign({}, f, { Started: true, Finished: true, Mins: 90, 'Home goals': 2, 'Away goals': 1 }) : f),
      h2hLive: (h, a) => [h === A ? 82 : 0, a === A ? 82 : 0] });
    const E = await openPage(PAGE, L.tabs, '2026-10-10T15:00:00Z');
    const proj = E.ev('teamProj(' + JSON.stringify(A) + ')');
    check('synthetic GW6 is live (deadline passed, GW6 current)', E.ev('D.gw') === 6 && E.ev('D.dlPassed') === true, 'gw ' + E.ev('D.gw'));
    check('team A proj final is about 90 (82 banked + two to play)', proj > 86 && proj < 94, 'proj ' + r1(proj));
    if (!has(E, 'hpSimModel')) check('simulate exposes its weekly model (hpSimModel)', false, 'missing in this build: the live GW mean is .7 x proj + .3 x season rate');
    else {
      const m = E.ev('hpSimModel().M[' + JSON.stringify(A + '|6') + ']');
      check('live GW mean keeps the banked 82 at full weight (mean within 3 of proj final)', Math.abs(m.mean - proj) < 3 && m.mean >= m.banked, 'mean ' + r1(m.mean) + ', banked ' + r1(m.banked) + ', still to come ' + r1(m.rem) + ', proj ' + r1(proj));
      check('banked = the nine finished starters\' points', Math.abs(m.banked - 82) < .01, 'banked ' + r1(m.banked));
      const fut = E.ev('(()=>{const M=hpSimModel().M,k=' + JSON.stringify(A + '|7') + ';return {m:M[k].mean,sd:M[k].sd}})()');
      const exp7 = E.ev('(()=>{const t=' + JSON.stringify(A) + ';const o=[];D.fx.forEach(f=>{if(!fin(f.Finished))return;if(f.Home===t)o.push(num(f["Home pts"]));if(f.Away===t)o.push(num(f["Away pts"]))});' +
        'const all=[];D.fx.forEach(f=>{if(fin(f.Finished))all.push(num(f["Home pts"]),num(f["Away pts"]))});const lg=all.reduce((a,b)=>a+b,0)/all.length,om=o.reduce((a,b)=>a+b,0)/o.length,w=o.length/(o.length+6);' +
        'return .7*hpTeam(t,7)+.3*(w*om+(1-w)*lg)})()');
      check('future gameweeks unchanged (.7 x projection + .3 x season rate, sd floor 9)', Math.abs(fut.m - exp7) < 1e-9 && fut.sd >= 9, 'GW7 mean ' + r1(fut.m) + ' vs ' + r1(exp7));
    }
    /* behaviour, any build: a gameweek whose result is already in must decide the odds. Six-GW season, A and B level
       on points and points-for after GW5, A beat B 60-52 in GW6 with every match over (H2H not yet confirmed). */
    const B = (f => f.Home === A ? f.Away : f.Home)(league(TEAMS, { gws: 6 }).tabs['H2H Fixtures'].find(f => f.GW === 6 && (f.Home === A || f.Away === A)));
    const shortT = (g, h, a) => { const ab = [A, B]; if (ab.includes(h) && ab.includes(a)) return [50, 50]; if (ab.includes(h)) return [60, 40]; if (ab.includes(a)) return [40, 60]; return [45, 45]; };
    const S0 = league(TEAMS, { gws: 6, locked: true, h2h: shortT });
    const g6s = cfOf(S0.tabs, 6), mm = S0.tabs['H2H Fixtures'].find(f => f.GW === 6 && [f.Home, f.Away].includes(A));
    const abMeet = [mm.Home, mm.Away].includes(B);
    const live2 = {}; const xiPts = { [A]: [6, 6, 6, 6, 6, 6, 6, 6, 4, 4, 4], [B]: [5, 5, 5, 5, 5, 5, 5, 5, 4, 4, 4] };
    S0.players.filter(p => p.xi).forEach(p => { live2[p.code] = { Mins: 90, Starts: 1, Pts: xiPts[p.t] ? xiPts[p.t][p.s - 1] : 3, BPS: 15, Bonus: 1 }; });
    const S = league(TEAMS, { gws: 6, locked: true, h2h: shortT, live: live2,
      cf: rows => rows.map(f => f.GW === 6 ? Object.assign({}, f, { Started: true, Finished: true, Mins: 90, 'Home goals': 0, 'Away goals': 0 }) : f),
      h2hLive: (h, a) => [h === A ? 60 : h === B ? 52 : 33, a === A ? 60 : a === B ? 52 : 33] });
    const E2 = await openPage(PAGE, S.tabs, '2026-10-12T23:00:00Z');
    const st = E2.ev('(()=>{const s={};D.fx.filter(f=>fin(f.Finished)).forEach(f=>{[[f.Home,f["Home pts"],f["Away pts"]],[f.Away,f["Away pts"],f["Home pts"]]].forEach(([t,m,y])=>{s[t]=s[t]||[0,0];s[t][1]+=num(m);s[t][0]+=num(m)>num(y)?3:num(m)===num(y)?1:0})});return s})()');
    check('decided-week setup: A and B level after GW5 and meet in GW6', abMeet && st[A][0] === st[B][0] && st[A][1] === st[B][1], 'A ' + st[A] + ' B ' + st[B]);
    const odds = E2.ev(SIM);
    check('A beat B 60-52 with every match over: A title odds 100%', odds.title[A] > 99.9, 'A ' + r1(odds.title[A]) + '%, B ' + r1(odds.title[B]) + '%');
  }

  /* ===== 2. TP-14 seeded draw ===== */
  console.log('\nTP-14 seeded odds');
  {
    const L = league(TEAMS, {});
    const E1 = await openPage(PAGE, L.tabs, '2026-10-03T21:00:00Z'), E2 = await openPage(PAGE, L.tabs, '2026-10-03T21:00:00Z');
    const a = E1.ev(SIM), b = E1.ev(SIM), c = E2.ev(SIM);
    const same = (x, y) => TEAMS.every(t => x.title[t] === y.title[t] && x.last[t] === y.last[t]);
    check('same data, same page: two draws identical', same(a, b), TEAMS.map(t => r1(a.title[t]) + '/' + r1(b.title[t])).join(' '));
    check('same data, fresh reload: identical odds', same(a, c), TEAMS.map(t => r1(a.title[t]) + '/' + r1(c.title[t])).join(' '));
    check('N stays 5000 (every share is a multiple of 1/5000)', TEAMS.every(t => Math.abs(a.title[t] * 50 - Math.round(a.title[t] * 50)) < 1e-6 && Math.abs(a.last[t] * 50 - Math.round(a.last[t] * 50)) < 1e-6));
    if (has(E1, 'hpSeed')) {
      const s1 = E1.ev('hpSeed()');
      const fx2 = L.tabs['H2H Fixtures'].map((f, i) => i === 0 ? Object.assign({}, f, { 'Home pts': f['Home pts'] + 1 }) : f);
      await E1.load(Object.assign({}, L.tabs, { 'H2H Fixtures': fx2 }));
      check('a changed H2H score changes the seed', E1.ev('hpSeed()') !== s1);
    } else check('seed keyed to the data (hpSeed)', false, 'missing in this build: simulate draws from Math.random');
  }

  /* ===== 3. #8 autoSubs: blank and double gameweeks ===== */
  console.log('\n#8 auto-subs');
  {
    /* team A's MID in slot 6 plays for a club with no GW6 fixture */
    const base = league(TEAMS, { locked: true });
    const blankFx = cfOf(base.tabs, 6)[9], X = blankFx.Home;
    const clubOf = (t, s, ti) => (ti === 0 && s === 6) ? X : (ti === 0 ? CLUBS.filter(c => c !== blankFx.Home && c !== blankFx.Away)[s % 18] : null);
    const mk = (extra) => league(TEAMS, Object.assign({ locked: true, clubOf, cf: rows => rows.filter(f => f !== undefined && !(f.GW === 6 && f.Home === blankFx.Home && f.Away === blankFx.Away)) }, extra));
    const L0 = mk({});
    const code6 = L0.players.find(p => p.ti === 0 && p.s === 6).code, code13 = L0.players.find(p => p.ti === 0 && p.s === 13).code;
    /* (a) live: deadline passed, first games under way */
    const kicked = rows => rows.filter(f => !(f.GW === 6 && f.Home === blankFx.Home && f.Away === blankFx.Away)).map((f, i) => (f.GW === 6 && f.Home === cfOf(base.tabs, 6)[0].Home) ? Object.assign({}, f, { Started: true, Mins: 30 }) : f);
    const La = mk({ cf: kicked, live: { [code13]: { Mins: 0 } } });
    const E = await openPage(PAGE, La.tabs, '2026-10-10T12:00:00Z');
    check('blank setup: club ' + X + ' has no GW6 fixture', E.ev('D.cf.filter(f=>num(f.GW)===6&&(f.Home===' + JSON.stringify(X) + '||f.Away===' + JSON.stringify(X) + ')).length') === 0);
    const sa = E.ev('autoSubs(' + JSON.stringify(A) + ',false).subs.map(s=>({out:String(s.out.Code),inn:String(s.inn.Code),kind:s.kind}))');
    check('live GW: blank-GW starter is subbed (locked) by the first legal bench player', sa.length === 1 && sa[0].out === String(code6) && sa[0].inn === String(code13) && sa[0].kind === 'locked', JSON.stringify(sa));
    const inXi = E.ev('effXiOf(' + JSON.stringify(A) + ').some(p=>String(p.Code)===' + JSON.stringify(String(code13)) + ')');
    check('live score XI counts the bench player instead', inXi);
    /* (b) before the deadline: projection tier only */
    const Lb = mk({});
    const Eb = await openPage(PAGE, Lb.tabs, '2026-10-08T12:00:00Z');
    const sb0 = Eb.ev('autoSubs(' + JSON.stringify(A) + ',false).subs.length'), sb1 = Eb.ev('autoSubs(' + JSON.stringify(A) + ',true).subs.map(s=>({out:String(s.out.Code),kind:s.kind}))');
    check('before the deadline: no locked sub for the blank starter', sb0 === 0, 'locked subs ' + sb0);
    check('before the deadline: blank starter is a likely sub in the projection', sb1.length === 1 && sb1[0].out === String(code6) && sb1[0].kind === 'likely', JSON.stringify(sb1));
    /* (c) no Club Fixtures for the gameweek at all (tab failed to load): nobody is treated as blank */
    const Lc = mk({ cf: rows => rows.filter(f => f.GW !== 6) });
    const Ec = await openPage(PAGE, Lc.tabs, '2026-10-10T12:00:00Z');
    check('missing GW fixtures never sub a whole XI', Ec.ev('autoSubs(' + JSON.stringify(A) + ',true).subs.length') === 0);

    /* double gameweek: team A's MID in slot 7 plays for C, which has an extra GW6 fixture (C v Y, kicking off first) */
    const g6 = cfOf(base.tabs, 6), C = g6[0].Home, Y = g6[1].Home;
    const clubD = (t, s, ti) => (ti === 0 && s === 7) ? C : (ti === 0 ? CLUBS.filter(c => ![C, Y, g6[0].Away, g6[1].Away].includes(c))[s % 16] : null);
    const dgw = (s1, s2) => rows => { const out = rows.map(f => (f.GW === 6 && f.Home === C) ? Object.assign({}, f, s2, { 'Kickoff (UTC)': '2026-10-13T19:00:00Z' }) : f);
      out.push(Object.assign({ GW: 6, Home: C, Away: Y, 'Kickoff (UTC)': '2026-10-10T11:30:00Z', Finished: false, Started: false, 'Home goals': '', 'Away goals': '', Mins: 0 }, s1)); return out; };
    const FT = { Started: true, Finished: true, Mins: 90, 'Home goals': 1, 'Away goals': 0 }, NS = { Started: false, Finished: false, Mins: 0 };
    const codeC = league(TEAMS, { locked: true, clubOf: clubD }).players.find(p => p.ti === 0 && p.s === 7).code;
    const run = async (s1, s2, mins, when) => { const Ld = league(TEAMS, { locked: true, clubOf: clubD, cf: dgw(s1, s2), live: { [codeC]: { Mins: mins, Starts: mins ? 1 : 0, Pts: mins ? 2 : 0 } } });
      const Ed = await openPage(PAGE, Ld.tabs, when); return { E: Ed, subs: Ed.ev('autoSubs(' + JSON.stringify(A) + ',false).subs.map(s=>String(s.out.Code))'), nfx: Ed.ev('hpNfx(6,' + JSON.stringify(C) + ')') }; };
    const d1 = await run(FT, NS, 0, '2026-10-11T12:00:00Z');
    check('DGW setup: ' + C + ' has two GW6 fixtures', d1.nfx === 2);
    check('DGW: 0 minutes after leg 1, leg 2 still to play: not subbed', !d1.subs.includes(String(codeC)), JSON.stringify(d1.subs));
    const d2 = await run(FT, FT, 0, '2026-10-14T12:00:00Z');
    check('DGW: 0 minutes after both legs: subbed', d2.subs.includes(String(codeC)), JSON.stringify(d2.subs));
    const d3 = await run(FT, FT, 25, '2026-10-14T12:00:00Z');
    check('DGW: played in either leg: not subbed', !d3.subs.includes(String(codeC)), JSON.stringify(d3.subs));
  }

  /* ===== 4. #8 provisional bonus per fixture ===== */
  console.log('\n#8 provisional bonus');
  {
    const base = league(TEAMS, { locked: true });
    const g6 = cfOf(base.tabs, 6);
    const C = g6[0].Home, Z = g6[0].Away, Y = g6[1].Home, W = g6[1].Away, P = g6[2].Home, Q = g6[2].Away;
    /* C plays twice: leg 1 v Y (Sat 11:30), leg 2 v Z (its regular fixture, Tue). Y's own regular game is Wed (not started).
       P v Q is an ordinary single fixture, finished, official bonus not in yet. */
    const legs = (leg1, leg2) => rows => { const out = rows.map(f => {
      if (f.GW !== 6) return f;
      if (f.Home === C) return Object.assign({}, f, { 'Kickoff (UTC)': '2026-10-13T19:00:00Z' }, leg2);
      if (f.Home === Y) return Object.assign({}, f, { 'Kickoff (UTC)': '2026-10-14T19:00:00Z' });
      if (f.Home === P) return Object.assign({}, f, { 'Kickoff (UTC)': '2026-10-10T14:00:00Z', Started: true, Finished: true, Mins: 90, 'Home goals': 2, 'Away goals': 2 });
      return f; });
      out.push(Object.assign({ GW: 6, Home: C, Away: Y, 'Kickoff (UTC)': '2026-10-10T11:30:00Z', Started: true, Finished: true, Mins: 90, 'Home goals': 1, 'Away goals': 0 }, leg1)); return out; };
    const row = (code, club, Mins, BPS, Bonus) => ({ Code: code, Player: 'S' + code, Pos: 'MID', Club: club, Mins, Pts: 2 + Bonus, BPS, Bonus, Starts: 1 });
    /* leg 1 BPS: c1 10, c2 26, y1 35, y2 30, y3 5. In leg 2 (live, 60') c1 has added 30 → GW total 40. */
    const stats = (leg1Official, leg2Bps) => [
      row(900001, C, leg2Bps ? 150 : 90, 10 + (leg2Bps ? 30 : 0), leg1Official ? 0 : 0), row(900002, C, leg2Bps ? 150 : 90, 26 + (leg2Bps ? 2 : 0), leg1Official ? 1 : 0),
      row(900011, Y, 90, 35, leg1Official ? 3 : 0), row(900012, Y, 90, 30, leg1Official ? 2 : 0), row(900013, Y, 90, 5, 0),
      row(900021, Z, leg2Bps ? 60 : 0, leg2Bps ? 12 : 0, 0),
      row(900031, P, 90, 30, 0), row(900032, P, 90, 25, 0), row(900041, Q, 90, 25, 0), row(900042, Q, 90, 20, 0)];
    const run = async (leg1Official, leg2, leg2Bps, when) => { const L = league(TEAMS, { locked: true, cf: legs({}, leg2), extraStats: stats(leg1Official, leg2Bps) });
      const E = await openPage(PAGE, L.tabs, when); return E.ev('D.pbonus'); };
    const LIVE = { Started: true, Finished: false, Mins: 60, 'Home goals': 0, 'Away goals': 0 }, FT2 = { Started: true, Finished: true, Mins: 90, 'Home goals': 0, 'Away goals': 0 };
    const pq = pb => pb['900031'] === 3 && pb['900032'] === 2 && pb['900041'] === 2 && pb['900042'] === undefined;
    const none = (pb, codes) => codes.every(c => pb[c] === undefined);
    const CY = ['900001', '900002', '900011', '900012', '900013', '900021'];
    const a = await run(true, LIVE, true, '2026-10-13T20:00:00Z');
    check('leg 1 official, leg 2 live: no provisional bonus for either leg', none(a, CY), JSON.stringify(a));
    check('same GW, ordinary fixture: 3/2/1 with FPL tie rules (30, 25, 25 -> 3, 2, 2)', pq(a), JSON.stringify(a));
    const b = await run(false, LIVE, true, '2026-10-13T20:00:00Z');
    check('leg 1 not official yet, leg 2 live: leg-2 BPS never ranks leg 1 (c1 10+30 must not take 3)', b['900001'] === undefined && none(b, CY), JSON.stringify(b));
    const c = await run(false, { Started: false, Finished: false, Mins: 0 }, false, '2026-10-10T13:30:00Z');
    check('leg 1 finished, leg 2 not started: leg 1 gets provisional bonus from its own BPS (y1 3, y2 2, c2 1)', c['900011'] === 3 && c['900012'] === 2 && c['900002'] === 1 && c['900001'] === undefined, JSON.stringify(c));
    const d = await run(true, FT2, true, '2026-10-13T21:30:00Z');
    check('leg 1 official, leg 2 finished: no bonus estimated from summed BPS', none(d, CY) && pq(d), JSON.stringify(d));
  }

  /* ===== 5. #6 Predictions fallback ===== */
  console.log('\n#6 prediction fallback');
  {
    const L = league(TEAMS, { predGws: [2, 3, 4, 5, 7] });
    const E = await openPage(PAGE, L.tabs, '2026-10-03T21:00:00Z');
    const p = L.players.find(x => x.ti === 0 && x.s === 10);
    const ep7 = L.tabs.Predictions.find(r => r.GW === 7 && r.Code === p.code).EP;
    check('GW6 block missing: the GW7 block stands in', E.ev('D.predCur[' + JSON.stringify(String(p.code)) + ']') === ep7);
    if (E.ev('D.predGw') !== undefined) check('the stand-in block is labelled with its own gameweek (D.predGw 7)', E.ev('D.predGw') === 7, 'predGw ' + E.ev('D.predGw'));
    const fpl = E.ev('fplEpOf(' + p.code + ')');
    check('FPL forecast for GW6 reads null, not GW7\'s number', fpl === null, 'fplEpOf ' + fpl + ' (GW7 EP ' + ep7 + ')');
    const html = E.ev('psxPreHTML(D.ro.find(r=>String(r.Code)===' + JSON.stringify(String(p.code)) + '))');
    check('player sheet "Projected · GW6" box shows no FPL number from GW7', !/<em>FPL /.test(html), (/<em>[^<]*<\/em>/.exec(html) || ['no em'])[0]);
    check('house projection still shown (D.hasEP true, projections intact)', E.ev('D.hasEP') === true && E.ev('teamProj(' + JSON.stringify(A) + ')') > 10);
    const L2 = league(TEAMS, {});
    const E2 = await openPage(PAGE, L2.tabs, '2026-10-03T21:00:00Z');
    const ep6 = L2.tabs.Predictions.find(r => r.GW === 6 && r.Code === p.code).EP;
    check('GW6 block present: FPL forecast is GW6\'s', E2.ev('fplEpOf(' + p.code + ')') === ep6);
    const html2 = E2.ev('psxPreHTML(D.ro.find(r=>String(r.Code)===' + JSON.stringify(String(p.code)) + '))');
    check('player sheet shows "FPL ' + ep6 + '" under GW6', html2.includes('<em>FPL ' + ep6 + '</em>') || html2.includes('<em>FPL ' + String(ep6).replace(/\.0$/, '') + '</em>'));
  }

  const errs = T0.errors.filter(e => !/did not load/.test(e));
  check('every page script loaded in the stub environment', !T0.errors.some(e => /did not load/.test(e)), T0.errors.filter(e => /did not load/.test(e)).join(' | ').slice(0, 300));
  if (errs.length) console.log('  (console.error from render code under the stub DOM: ' + errs.length + ')');
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exitCode = fail ? 1 : 0;
}

/* ---------------------------------------------------------------- real-data mode ---------------------------------------------------------------- */
async function realData() {
  const dir = opt('--tabs'), now = opt('--now') || '2026-10-03T21:00:00Z';
  const tabs = {}; fs.readdirSync(dir).filter(f => f.endsWith('.json')).forEach(f => { tabs[f.slice(0, -5)] = fs.readFileSync(path.join(dir, f), 'utf8'); });
  const E1 = await openPage(PAGE, tabs, now), E2 = await openPage(PAGE, tabs, now);
  const TEAMS = E1.ev('Object.keys(TEAMS)');
  const a = E1.ev(SIM), b = E2.ev(SIM);
  const order = o => TEAMS.slice().sort((x, y) => o.title[y] - o.title[x] || o.last[x] - o.last[y]);
  console.log('gw ' + E1.ev('D.gw') + ', dlPassed ' + E1.ev('D.dlPassed') + ', provOver ' + E1.ev('D.provOver') + ', predGw ' + E1.ev('D.predGw'));
  console.log('title % ' + order(a).map(t => t + ' ' + r1(a.title[t])).join(' | '));
  console.log('last  % ' + order(a).map(t => t + ' ' + r1(a.last[t])).join(' | '));
  check('fresh reloads give identical odds', TEAMS.every(t => a.title[t] === b.title[t] && a.last[t] === b.last[t]));
  if (has(E1, 'hpSimModel')) {
    const M = E1.ev('(()=>{const m=hpSimModel().M,o={};Object.keys(m).filter(k=>+k.split("|")[1]===D.gw).forEach(k=>o[k]=m[k]);return o})()');
    console.log('live GW model: ' + Object.keys(M).map(k => k.split('|')[0] + ' mean ' + r1(M[k].mean) + ' (banked ' + r1(M[k].banked) + ', to come ' + r1(M[k].rem) + ', left ' + r1(M[k].left) + ') sd ' + r1(M[k].sd)).join('\n                '));
    /* the old formula, recomputed independently: .7 x projection + .3 x season rate, sd max(9, hpTeamSd) */
    const dev = E1.ev('(()=>{const M=hpSimModel().M,obs={},all=[];D.fx.forEach(f=>{if(!fin(f.Finished))return;[[f.Home,f["Home pts"]],[f.Away,f["Away pts"]]].forEach(([t,v])=>{(obs[t]=obs[t]||[]).push(num(v));all.push(num(v))})});'
      + 'const lg=all.length?all.reduce((a,b)=>a+b,0)/all.length:40;let mx=0,live=0;Object.keys(M).forEach(k=>{const [t,g]=[k.split("|")[0],+k.split("|")[1]],o=obs[t]||[],om=o.length?o.reduce((a,b)=>a+b,0)/o.length:lg,w=o.length/(o.length+6);'
      + 'const old=.7*(g===D.gw?teamProj(t):hpTeam(t,g))+.3*(w*om+(1-w)*lg),sd=Math.max(9,hpTeamSd(t,g));if(g===D.gw&&D.cf.some(f=>num(f.GW)===g&&fin(f.Started)))live=1;else mx=Math.max(mx,Math.abs(M[k].mean-old),Math.abs(M[k].sd-sd))});return {mx,live}})()');
    check('every weekly mean/sd with nothing banked equals the old formula' + (dev.live ? ' (live GW excluded: it has started)' : ', live GW included'), dev.mx < 1e-9, 'max deviation ' + dev.mx);
  }
  const old = opt('--compare');
  if (old) {
    const O = await openPage(path.resolve(old), tabs, now);
    /* the old draw is unseeded: average a few runs (each N=5000) */
    const K = 8, avg = { title: {}, last: {} }; TEAMS.forEach(t => { avg.title[t] = 0; avg.last[t] = 0; });
    for (let k = 0; k < K; k++) { const o = O.ev(SIM); TEAMS.forEach(t => { avg.title[t] += o.title[t] / K; avg.last[t] += o.last[t] / K; }); }
    console.log('old avg ' + order(avg).map(t => t + ' ' + r1(avg.title[t])).join(' | '));
    const maxd = Math.max(...TEAMS.map(t => Math.max(Math.abs(a.title[t] - avg.title[t]), Math.abs(a.last[t] - avg.last[t]))));
    check('odds within ~1 point of the old (unseeded) average', maxd <= 1.5, 'max diff ' + r1(maxd));
    const ordA = order(a).join(), ordO = order(avg).join();
    check('same order of teams', ordA === ordO, ordA === ordO ? '' : ordA + ' vs ' + ordO);
    /* nothing else moves: every engine number the screens read */
    const probe = 'JSON.stringify((()=>{const T=Object.keys(TEAMS),o={};T.forEach(t=>{o[t]={proj:teamProj(t),live:liveScoreOf(t),sd:hpTeamSd(t),xi:effXiOf(t,true).map(p=>p.Code),subs:autoSubs(t,true).subs.map(s=>[s.out.Code,s.inn.Code,s.kind]),'
      + 'lsubs:autoSubs(t,false).subs.map(s=>[s.out.Code,s.inn.Code]),fut:[7,8,9,10].map(g=>hpTeam(t,g))}});'
      + 'o.win=D.fx.filter(f=>num(f.GW)===D.gw).map(f=>hpWin(f));o.pb=D.pbonus;o.ep=D.ro.map(r=>[r.Code,epOf(r.Code),projOf(r)]);o.fpl=D.ro.map(r=>fplEpOf(r.Code));o.hasEP=D.hasEP;o.predCur=Object.keys(D.predCur).length;return o})())';
    const pn = E1.ev(probe), po = O.ev(probe);
    check('engine numbers identical to the old build (projections, live scores, subs, win %, bonus, EP)', pn === po, pn === po ? '' : firstDiff(pn, po));
  }
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exitCode = fail ? 1 : 0;
}
function firstDiff(a, b) { let i = 0; while (i < a.length && a[i] === b[i]) i++; return 'at ' + i + ': new ' + a.slice(Math.max(0, i - 60), i + 60) + ' | old ' + b.slice(Math.max(0, i - 60), i + 60); }

main().catch(e => { console.error(e); process.exitCode = 2; });
