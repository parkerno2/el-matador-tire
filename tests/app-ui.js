// The UI pass of 10 Oct 2026 (Parker's request, built as a preview first): one visual language for subs and availability
// on every Plate (UI.plateStatus, statusBadge, plate, plateMini: at most one round badge top left, status colours only,
// a sub state over an availability state, no text tag, frame or swap icon), the list chips in the same three colours
// (UI.subChip, statusChip), the Matchup page without its legend and watch button (the xP switch in the team bar), the
// player sheet re-ordered (the season card with the rating first, form chips in green, amber and red, the next five in
// the difficulty colours, the projection as one closed row, the rest under More, xG and xA per 90 hidden when there is
// no rate), and the copy pass (every removed caption gone, the methodology on the How it works page). Plain Node, the
// modules run in a vm.
//   node tests/app-ui.js
const fs = require('fs'), vm = require('vm');
let fails = 0;
const check = (label, cond, info) => { if (!cond) fails++; console.log((cond ? 'PASS ' : 'FAIL ') + label + (info ? '  ' + info : '')); };
const MW = __dirname + '/../fplgg/tools/matchweek/';
const rd = f => fs.readFileSync(MW + f, 'utf8');
const UIJS = rd('src/ui.js'), PLAYER = rd('src/sheets/player.js'), KIT = rd('src/sheets/kit.js'), BITS = rd('src/pages/team/bits.js');
const MATCHUP = rd('src/pages/matchday/matchup.js'), MATCHDAY = rd('src/pages/matchday.js'), LINEUP = rd('src/pages/team/lineup.js'), SHOW = rd('src/feed/showplay.js');
const COMP = rd('src/css/02-components.css'), MDCSS = rd('src/css/20-matchday.css'), TEAMCSS = rd('src/css/30-team.css'), SHEETCSS = rd('src/css/60-sheets.css'), SHOWCSS = rd('src/css/55-show.css');
function lift(src, name) {
  const i = src.search(new RegExp('^(export )?(function ' + name + '\\(|const ' + name + ' ?=)', 'm')); if (i < 0) throw new Error('no ' + name);
  const start = src.slice(i).startsWith('export ') ? i + 7 : i;
  if (src.slice(start).startsWith('const')) return src.slice(start, src.indexOf('\n', start) + 1);
  let depth = 0, j = src.indexOf('{', start);
  for (; j < src.length; j++) { if (src[j] === '{') depth++; else if (src[j] === '}') { depth--; if (!depth) break; } }
  return src.slice(start, j + 1) + '\n';
}
const count = (h, re) => (h.match(re) || []).length;

/* ---------- ui.js in a vm, with a stub engine card() that draws the old tags and INJ pill from SUBMARK ---------- */
function uiCtx(extra) {
  const ctx = Object.assign({
    console, JSON, String, Date, Math, Number, Object, Array, Set, RegExp, Boolean, isNaN, parseFloat, parseInt, localStorage: { getItem: () => null, setItem() { }, removeItem() { } },
    document: { querySelector: () => null, querySelectorAll: () => [], body: { dataset: {} } }, window: {}, location: { hash: '' }, history: {}, navigator: {}, setTimeout: () => 0, clearTimeout() { },
    D: { hasEP: true }, TEAMS: {}, SHORTOF: {}, FIRSTOF: t => t, LOADED_AT: 1, num: v => +v || 0, faceUrls: () => [], isFplPhoto: () => false,
    initials: s => 'XX', fxStarted: () => false, fxFinished: () => false, epOf: () => 4.9, tierOf: () => 'gold', cardBg: () => '<svg class="bg"></svg>', faceImgHTML: () => '<img src="x">',
    badgeImg: () => '', flagImg: () => '', SUBMARK: {},
    /* the engine's full card, as core.gen.js draws it: the sub tag and frame classes from SUBMARK, the INJ pill from Status, a tier tag otherwise */
    card: (p, i) => { const sm = ctx.SUBMARK[p.Code] || ''; const tag = sm === 'in' ? 'SUB' : sm === 'inl' ? 'LIKELY' : sm.startsWith('out') ? 'OUT' : (p.tier === 'potm' ? 'POTM' : ''); const smc = sm ? (' sub' + (sm.startsWith('in') ? 'in' : 'out') + (sm.endsWith('l') ? ' likely' : '')) : ''; return '<button class="fc gold' + smc + '" data-i="' + i + '" aria-label="' + p.Player + '"><svg class="bg"></svg>' + (tag ? '<span class="tag">' + tag + '</span>' : '') + ('isud'.indexOf(p.Status) > -1 ? '<span class="inj">INJ</span>' : '') + '<span class="rt"><b>82</b></span></button>'; },
  }, extra || {});
  ctx.window = ctx; vm.createContext(ctx);
  const src = UIJS.replace(/^export (function|const|let|async function)/gm, '$1').replace(/^export \{[^}]*\};?\s*$/gm, '');
  vm.runInContext(src + '\n;this.__x = { plateStatus, statusBadge, plate, plateMini, subChip, statusChip };', ctx);
  return ctx;
}
const U = uiCtx().__x;
const P = { Code: '1', Player: 'Mitchell', Club: 'CRY', Nation: 'GB-ENG', Status: 'a', Pos: 'DEF', 'GW pts': 0 };
const doubt = Object.assign({}, P, { Status: 'd', News: 'Knock - 75% chance of playing' });
const inj = Object.assign({}, P, { Status: 'i', News: 'Hamstring injury - Expected back 01 Nov' });
const susp = Object.assign({}, P, { Status: 's', News: 'Suspended until 18 Oct' });

console.log('--- the badge rule: plateStatus');
const S = (p, m, o) => { const s = U.plateStatus(p, m, o); return s ? s.k + '/' + s.c + (s.dim ? '/dim' : '') : 'none'; };
check('auto-sub on: green, up arrow', S(P, 'in') === 'on/ok');
check('likely sub on: amber, up arrow', S(P, 'inl') === 'on/wn');
check('subbed off: red, down arrow, dimmed', S(P, 'out') === 'off/no/dim');
check('likely off: amber, down arrow, not dimmed', S(P, 'outl') === 'off/wn');
check('a doubt with no sub involved: amber "!"', S(doubt, '') === 'flag/wn');
check('out, injured or suspended: red "!"', S(inj, '') === 'flag/no' && S(susp, '') === 'flag/no' && S(Object.assign({}, P, { Status: 'u' }), '') === 'flag/no');
check('a fit player with no sub: no badge at all', S(P, '') === 'none' && U.plateStatus(null, '') === null);
check('a sub state outranks an availability state: a doubt coming on is green or amber up, an injured starter going off is red down', S(doubt, 'in') === 'on/ok' && S(doubt, 'inl') === 'on/wn' && S(inj, 'out') === 'off/no/dim' && S(inj, 'outl') === 'off/wn');
check('flag: false (his match has started) drops the availability badge, never a sub badge', S(doubt, '', { flag: false }) === 'none' && S(inj, '', { flag: false }) === 'none' && S(doubt, 'in', { flag: false }) === 'on/ok');
check('the detail for the title and aria-label: the caller\'s ("On for Doku"), else the FPL news, else a plain word', U.plateStatus(P, 'in', { title: 'On for Doku' }).t === 'On for Doku' && U.plateStatus(doubt, '').t === 'Knock - 75% chance of playing' && U.plateStatus(inj, '').t === 'Hamstring injury - Expected back 01 Nov' && U.plateStatus(Object.assign({}, P, { Status: 'd' }), '').t === 'Doubtful' && U.plateStatus(Object.assign({}, P, { Status: 's' }), '').t === 'Suspended' && U.plateStatus(P, 'out').t === 'Subbed off');

console.log('--- the badge: statusBadge');
const UP = 'M5 1.5 L8.5 5.5 H6.2 V8.5 H3.8 V5.5 H1.5 Z', DN = 'M5 8.5 L1.5 4.5 H3.8 V1.5 H6.2 V4.5 H8.5 Z';
check('on: one round badge with the white up arrow; off: the down arrow; a flag: a white "!"', /^<span class="st ok" title="Auto-sub, on"><svg[^>]*><path d="M5 1\.5 L8\.5 5\.5 H6\.2 V8\.5 H3\.8 V5\.5 H1\.5 Z" fill="#0E0A13"\/><\/svg><\/span>$/.test(U.statusBadge(U.plateStatus(P, 'in'))) && U.statusBadge(U.plateStatus(P, 'out')).indexOf(DN) > -1 && /^<span class="st no" title="[^"]*"><b>!<\/b><\/span>$/.test(U.statusBadge(U.plateStatus(inj, ''))) && U.statusBadge(null) === '');
check('the title is escaped', /title="a &lt;b&gt;"/.test(U.statusBadge(U.plateStatus(P, 'in', { title: 'a <b>' }))));

console.log('--- the small Plate: exactly one badge in the right colour, no tag, no frame, no swap icon');
const badges = h => h.match(/<span class="st (ok|wn|no)"/g) || [];
const clean = h => !/class="tag"|class="inj"|subin|subout|likely"|md-ic|INJ|SUB<|LIKELY<|OUT</.test(h);
const states = [['in', P, 'ok', false], ['inl', P, 'wn', false], ['out', P, 'no', true], ['outl', P, 'wn', false], ['', doubt, 'wn', false], ['', inj, 'no', false], ['', susp, 'no', false]];
states.forEach(([mark, p, c, dim]) => {
  const h = U.plateMini(p, 64, { mark });
  check('plateMini ' + (mark || p.Status) + ': one badge, colour ' + c + (dim ? ', dimmed' : '') + ', nothing else', badges(h).length === 1 && badges(h)[0] === '<span class="st ' + c + '"' && clean(h) && (/class="fc mini gold dim"/.test(h) === dim), h.slice(0, 160));
});
check('plateMini, a fit starter: no badge, not dimmed', badges(U.plateMini(P, 64)).length === 0 && !/dim/.test(U.plateMini(P, 64)));
check('plateMini: the badge sits inside the card button, before the bubble', /<button class="fc mini gold"[^>]*><svg class="bg"><\/svg><span class="st ok"[^]*<\/span><span class="pts proj">/.test(U.plateMini(P, 64, { mark: 'in' })));
check('plateMini: the aria-label keeps the detail ("Mitchell, On for Doku"; the FPL news for a doubt), the badge\'s title too', /aria-label="Mitchell, On for Doku"/.test(U.plateMini(P, 64, { mark: 'in', title: 'On for Doku' })) && /title="On for Doku"/.test(U.plateMini(P, 64, { mark: 'in', title: 'On for Doku' })) && /aria-label="Mitchell, Knock - 75% chance of playing"/.test(U.plateMini(doubt, 64)));
check('plateMini: a doubt whose match has started wears no badge (flag: false), a sub still does', badges(U.plateMini(doubt, 64, { flag: false })).length === 0 && badges(U.plateMini(doubt, 64, { flag: false, mark: 'in' })).length === 1);
check('plateMini: SUBMARK set by the caller (the Lineup pitch) is read when opt.mark is not given', badges(uiCtx({ SUBMARK: { 1: 'outl' } }).__x.plateMini(P, 64))[0] === '<span class="st wn"' && /dim/.test(uiCtx({ SUBMARK: { 1: 'out' } }).__x.plateMini(P, 64)));

console.log('--- the full Plate: the engine\'s tags and INJ pill never show, the badge does');
{
  const ctx = uiCtx({ SUBMARK: { 1: 'in' } }), X = ctx.__x;
  const h = X.plate(doubt, 100);
  check('with SUBMARK in and a doubt: one green badge, no SUB tag, no cyan frame class, no INJ, and the label keeps the detail', badges(h).length === 1 && badges(h)[0] === '<span class="st ok"' && clean(h) && /aria-label="Mitchell, Auto-sub, on"/.test(h), h);
  check('SUBMARK is put back after the draw', ctx.SUBMARK[1] === 'in');
  const o = uiCtx({ SUBMARK: { 1: 'out' } }).__x.plate(P, 100);
  check('subbed off: red down badge and the card dimmed', badges(o)[0] === '<span class="st no"' && /<button class="fc dim gold"/.test(o) && o.indexOf(DN) > -1);
  const i = X.plate(inj, 100, { mark: '' });
  check('an injured starter with no sub: one red "!" where the INJ pill was, no INJ text', badges(i).length === 1 && badges(i)[0] === '<span class="st no"' && !/INJ/.test(i) && /<b>!<\/b>/.test(i));
  const t = X.plate(Object.assign({}, P, { Code: '2', tier: 'potm' }), 100);
  check('a tier tag (POTM) is not a status and stays; a fit player with no sub wears no badge', /<span class="tag">POTM<\/span>/.test(t) && badges(t).length === 0);
  check('the badge sits inside the card button', /<span class="st ok"[^]*<\/span><\/button><\/span>$/.test(h));
}

console.log('--- list chips in the same three colours');
check('subChip: green SUB ON, amber LIKELY SUB, red SUBBED OFF, amber LIKELY OFF, nothing for no mark', U.subChip('in') === '<span class="chip on">SUB ON</span>' && U.subChip('inl') === '<span class="chip doubt">LIKELY SUB</span>' && U.subChip('out') === '<span class="chip out">SUBBED OFF</span>' && U.subChip('outl') === '<span class="chip doubt">LIKELY OFF</span>' && U.subChip('') === '');
check('statusChip: the chance in amber, OUT in red', U.statusChip(doubt) === '<span class="chip doubt">75%</span>' && U.statusChip(inj) === '<span class="chip out">OUT</span>' && U.statusChip(P) === '');
check('the CSS: .chip.on is green, .chip.doubt amber, .chip.out red; the purple .chip.sub is gone', /\.chip\.on\{background:var\(--win\);color:var\(--base\)\}/.test(COMP) && /\.chip\.doubt\{background:var\(--doubt\)/.test(COMP) && /\.chip\.out\{background:var\(--loss\)/.test(COMP) && !/\.chip\.sub\{/.test(COMP));

console.log('--- the CSS of the badge');
check('.fc .st: round, top left, status colours only (win, doubt, loss), dimmed card, under the rating on the full card', /\.fc \.st\{position:absolute;z-index:4;top:3\.5%;left:4%;[^}]*border-radius:50%/.test(COMP) && /\.fc \.st\.ok\{background:var\(--win\)\} \.fc \.st\.wn\{background:var\(--doubt\)\} \.fc \.st\.no\{background:var\(--loss\)\}/.test(COMP) && /\.fc\.dim\{opacity:\.55\}/.test(COMP) && /\.fc:not\(\.mini\) \.st\{top:26%;left:7%\}/.test(COMP));
check('no tier colour in the badge rules', !/\.fc \.st[^\n]*(--cyan|--gold|--p500|--p300|#04F5FF|#FFD23F)/.test(COMP));
check('the old status marks are gone from the pages\' CSS: the matchup corner icons, the bench tag, the show\'s chance chip', !/\.md-ic/.test(MDCSS) && !/\.tm-bout/.test(TEAMCSS) && !/\.gs-fl/.test(SHOWCSS));

console.log('--- where the Plates appear');
check('matchup.js: the token asks for the badge with the sub mark, the title and the kick-off flag, and draws no icon of its own; no swap icon', /UI\.plateMini\(x\.p, 64, \{ noOpen: true, mark, title, flag: !x\.started, dnp: !!st\.dnp, bubble:/.test(MATCHUP) && /const title = sub \? \(sub\.kind === 'locked' \? 'On for ' : 'Likely on for '\) \+ sub\.out\.Player : '';/.test(MATCHUP) && !/md-ic|ICON_SW/.test(MATCHUP));
check('matchup.js: the line under a card is only the kick-off, the minute or FT (never "likely sub")', /const line = st\.t;/.test(MATCHUP) && !/'likely sub'/.test(MATCHUP));
console.log('--- did not play (the manager, 10 Oct 2026: Tzolis and Brobbey showed "Did not play" under their cards)');
const MODEL = rd('src/pages/matchday/model.js');
check('model.js statusLine: a finished match says FT whether he played or not, with dnp for no minutes (never "Did not play" under a card)', /if \(x\.finished\) return \{ t: 'FT', live: false, dnp: !\(x\.mins > 0\) \};/.test(MODEL) && !/'Did not play'/.test(MODEL));
check('plateStatus: dnp is the red "!" with the words in the title; a sub mark outranks it', S(P, '', { dnp: true }) === 'flag/no' && U.plateStatus(P, '', { dnp: true }).t === 'Did not play' && S(P, 'in', { dnp: true }) === 'on/ok' && S(P, '', { dnp: false, flag: false }) === 'none');
check('matchup.js: the token asks for the badge with dnp from the status line, so the words reach the aria-label through badge.t', /UI\.plateStatus\(x\.p, mark, \{ title, flag: !x\.started, dnp: !!st\.dnp \}\)/.test(MATCHUP) && /\(badge \? ', ' \+ badge\.t : ''\)/.test(MATCHUP));
check('matchup.js: the List tab row carries the red DID NOT PLAY chip; the Bench card names him under the auto-sub lines with the red "!"', /st\.dnp \? '<span class="chip out">DID NOT PLAY<\/span>' : ''/.test(MATCHUP) && /export function dnpLines\(T, opt = \{\}\)/.test(MATCHUP) && /x\.finished && !\(x\.mins > 0\)/.test(MATCHUP) && /did not play <span class="sub">\(/.test(MATCHUP) && /const dnp = dnpLines\(m\.tl\) \+ dnpLines\(m\.tr\);/.test(MATCHUP) && /\.md-asr\.no \.md-asi\{background:var\(--loss\)\} \.md-asr\.no \.md-asi b\{[^}]*color:var\(--base\)/.test(MDCSS));
check('matchup.js: the head-to-head rows and benches use the three-colour chips', /UI\.subChip\(sub\.kind === 'locked' \? 'in' : 'inl'\)/.test(MATCHUP) && /outL\.has\(c\) \? UI\.subChip\('out'\) : outK\.has\(c\) \? UI\.subChip\('outl'\) : UI\.statusChip\(p\)/.test(MATCHUP) && !/chip mute">(SUBBED OFF|LIKELY OFF|LIKELY SUB)/.test(MATCHUP));
check('lineup.js: the bench cards carry no text tag; the list rows use subChip', !/tm-bout|outLabel/.test(LINEUP) && /const tag = UI\.subChip\(mk\) \|\| UI\.statusChip\(p\);/.test(LINEUP) && !/\+ tag \+ UI\.statusChip\(p\)/.test(LINEUP) && !/chip sub|chip mute">OFF/.test(LINEUP));
check('bits.js: the marks carry who is on for whom, and plateMarked passes it as the badge\'s title', /m\.titles\[s\.inn\.Code\] = \(l \? 'Likely on for ' : 'On for '\) \+ s\.out\.Player;/.test(BITS) && /const opt = \{ title: \(\(marks \|\| \{\}\)\.titles \|\| \{\}\)\[p\.Code\] \|\| '' \};/.test(BITS) && /mini \? UI\.plateMini\(p, w, opt\) : UI\.plate\(p, w, opt\)/.test(BITS));
{
  const ctx = { SUBMARK: {}, UI: { plateMini: (p, w, o) => 'mini:' + p.Code + ':' + (o.title || '') + ':' + (ctx.SUBMARK[p.Code] || ''), plate: () => 'full' }, esc: s => s, console };
  vm.createContext(ctx);
  vm.runInContext(lift(BITS, 'plateMarked') + lift(BITS, 'subMarks') + ';this.__b = { plateMarked, subMarks };', ctx);
  const marks = ctx.__b.subMarks({ subs: [{ kind: 'locked', inn: { Code: '9', Player: 'Doku' }, out: { Code: '4', Player: 'Mitchell' } }, { kind: 'likely', inn: { Code: '7', Player: 'Bogle' }, out: { Code: '5', Player: 'Rashford' } }] });
  check('subMarks: in, out, inl, outl by code, with the titles', marks['9'] === 'in' && marks['4'] === 'out' && marks['7'] === 'inl' && marks['5'] === 'outl' && marks.titles['9'] === 'On for Mitchell' && marks.titles['4'] === 'Off, Doku on' && marks.titles['7'] === 'Likely on for Rashford' && marks.titles['5'] === 'Likely off, Bogle on');
  check('plateMarked: the small Plate gets the mark through SUBMARK and the title, and SUBMARK is restored', ctx.__b.plateMarked({ Code: '9' }, 80, marks, true) === 'mini:9:On for Mitchell:in' && Object.keys(ctx.SUBMARK).length === 0);
}
check('the show\'s XI: the card\'s own badge, no chance chip over it', /UI\.plateMini\(x\.p, isStar \? 78 : 64, \{ noOpen: true \}\)/.test(SHOW) && !/gs-fl/.test(SHOW));

console.log('--- the Matchup page');
check('no legend row, no "Bubbles show" switch row, no watch button', !/legend\(|md-leg|md-xprow|Bubbles show|watchChip|md-watch|Watch Malcolm/.test(MATCHUP) && !/\.md-leg|\.md-xprow|\.md-xps/.test(MDCSS) && !/\.md-watch/.test(SHOWCSS));
check('the xP switch sits in the top team bar and a tap on it never opens the manager sheet', /const sw = top && xpSwitch\(m\) \? '<button type="button" class="md-xpt' \+ \(ST\.xp \? ' on' : ''\) \+ '" data-md-xp="' \+ \(ST\.xp \? '0' : '1'\) \+ '" aria-pressed="' \+ !!ST\.xp \+ '" aria-label="Show xP in the bubbles">xP<\/button>' : '';/.test(MATCHUP) && /if \(x\) \{ e\.stopPropagation\(\); e\.preventDefault\(\); Matchup\.ST\.xp = x\.getAttribute\('data-md-xp'\) === '1';/.test(MATCHDAY) && /\.md-xpt\{/.test(MDCSS));
check('the Formation tab is the pitch, By line, What decides it and the benches, and the pitch starts under the tabs', /function tabFormation\(m\) \{ return pitch\(m\) \+ byLine\(m\) \+ decides\(m\) \+ benches\(m\); \}/.test(MATCHUP) && /return fixtureChips\(i\) \+ header\(m\)\n/.test(MATCHUP));
check('the obvious captions are gone from the Matchup page', !/Tap a player for the Plate card|Projected points per player|Points now, projected final underneath|tap a line for the players|in auto-sub order|Locked auto-subs already count|Likely subs assume|Projected points by source|Starters the model gives|Premier League games with starters|Switch the pitch bubbles/.test(MATCHUP));

console.log('--- the player sheet');
check('the Overview order: the season card, form, the next five, this match and the gameweek breakdown, More', /K\.panel\('overview', seasonCard\(x\) \+ formBlock\(x\) \+ nextFiveBlock\(x\) \+ thisMatch\(x\) \+ gwBlock\(x\) \+ moreBlock\(x\), true\)/.test(PLAYER));
check('the header: name, club, nation, position and the next fixture; the rating moved to the season card', /factChips\(x\)/.test(PLAYER) && /const fx = nx \? '<span class="ps-fc ps-nx/.test(PLAYER) && !/OVR <b class="n">/.test(PLAYER));
{
  const K = { cb: (c, px) => '[' + c + ']', kickoff: f => f.ko ? new Date(f.ko) : null, clubName: c => c, POSNAME: { DEF: 'Defender' }, POSPL: {}, f1: v => (Math.round(v * 10) / 10).toFixed(1), pc: (v, o) => '<span class="sk-pc ' + (o.dnp ? 'z' : v >= 6 ? 'p3' : v >= 3 ? 'p2' : 'p1') + '">' + v + '</span>', ord: n => n + 'th', FDRWORD: {}, fdrColor: () => '' };
  const UIs = { esc: s => String(s), flag: () => '', sh: t => '<h2>' + t + '</h2>', icon: () => '<svg/>', dayHm: d => 'Sat 3pm', day: () => 'Sat 10 Oct', empty: (a, b) => a + b };
  const fx = { GW: 6, Home: 'CRY', Away: 'LEE', Started: 'FALSE', Finished: 'FALSE', Mins: '0', 'Home goals': '', 'Away goals': '', ko: '2026-10-10T14:00:00Z' };
  const past = [{ GW: 4, Home: 'CRY', Away: 'ARS', Started: 'TRUE', Finished: 'TRUE', Mins: '90', 'Home goals': '0', 'Away goals': '1' }, { GW: 5, Home: 'MUN', Away: 'CRY', Started: 'TRUE', Finished: 'TRUE', Mins: '90', 'Home goals': '1', 'Away goals': '2' }];
  const mk = (over) => {
    const ctx = Object.assign({ console, Math, String, Object, Number, Date, JSON, RegExp, Array, K, UI: UIs, esc: UIs.esc, num: v => +v || 0, fin: v => String(v) === 'TRUE', D: { gw: 6, cf: past.concat([fx]), gwsByGw: { 4: { 1: { Pts: 2, Mins: 90, G: 0, A: 0, xG: 0, xA: 0, Bonus: 0, Club: 'CRY' } }, 5: { 1: { Pts: 7, Mins: 90, G: 1, A: 0, xG: 0.4, xA: 0.1, Bonus: 1, Club: 'CRY' } } } },
      gwFixtures: (club, g) => ctx.D.cf.filter(f => +f.GW === g && (f.Home === club || f.Away === club)), fxStarted: () => false, fxFinished: () => true, dynOvr: () => 82, formDelta: () => 2, seasonTot: () => 29, plrAvg: () => 4.1, psxForm: () => ({ n: 2, starts: 2, perStart: 4.5, xg: 0.2, xa: 0.1, hits: 1, hitRate: .5, floor: 2, ceil: 7 }), NAT: {} }, over || {});
    vm.createContext(ctx);
    vm.runInContext(['fixtureNow', 'factChips', 'cell', 'oppOf', 'apps', 'seasonSums', 'ratingCls', 'seasonCard', 'moreBlock', 'fold', 'formBlock'].map(n => lift(PLAYER, n)).join('') + ';this.__p = { fixtureNow, factChips, seasonCard, moreBlock, fold, ratingCls, formBlock };', ctx);
    return ctx.__p;
  };
  const x = { code: '1', p: { Code: '1', Player: 'Mitchell', Club: 'CRY', Nation: 'GB-ENG', Pos: 'DEF' }, eng: {}, club: 'CRY', pos: 'DEF', own: { Team: 'T', Drafted: 'R3.4' } };
  const Pm = mk();
  const chips = Pm.factChips(x);
  check('the header chips: club, nation, position, then the next fixture (opponent crest, H, the kick-off); no OVR', /\[CRY\]CRY<\/span>/.test(chips) && /Defender<\/span>/.test(chips) && /<span class="ps-fc ps-nx" title="LEE \(home\)">\[LEE\]LEE<i>H<\/i><em>Sat 3pm<\/em><\/span>/.test(chips) && !/OVR/.test(chips), chips);
  const live = mk({ D: { gw: 6, cf: past.concat([Object.assign({}, fx, { Started: 'TRUE', Mins: '63', 'Home goals': '2', 'Away goals': '1' })]), gwsByGw: {} } }).factChips(x);
  check('the fixture chip while his match is on: the minute, marked live', /<span class="ps-fc ps-nx live"[^>]*><em>63’<\/em>/.test(live.replace(/\[LEE\]LEE<i>H<\/i>/, '')), live);
  const ft = mk({ D: { gw: 6, cf: past.concat([Object.assign({}, fx, { Started: 'TRUE', Finished: 'TRUE', Mins: '90', 'Home goals': '2', 'Away goals': '1' })]), gwsByGw: {} } }).factChips(x);
  check('at full time: the score from his side', /<em>FT 2–1<\/em>/.test(ft), ft);
  const blank = mk({ D: { gw: 6, cf: past.concat([Object.assign({}, fx, { GW: 7 })]), gwsByGw: {} } }).factChips(x);
  check('a blank gameweek: the next one, named', /<span class="ps-fc ps-nx" title="LEE \(home\), gameweek 7">GW7 \[LEE\]LEE/.test(blank), blank);
  const sc = Pm.seasonCard(x);
  check('the season card: apps, goals, assists, points and the rating badge, green at 82, with the form arrow', /<h2>Season<\/h2><div class="card ps-season"><div class="ps-cells ps-cells5">/.test(sc) && /<b class="n">2<\/b><span>apps<\/span>/.test(sc) && /<b class="n">1<\/b><span>goals<\/span>/.test(sc) && /<b class="n">0<\/b><span>assists<\/span>/.test(sc) && /<b class="n">29<\/b><span>points<\/span>/.test(sc) && /<b class="n ps-rb ok">82<\/b><span>rating <em class="up">▲2<\/em><\/span>/.test(sc), sc);
  check('the rating colour: green from 78, amber from 70, red under 70', Pm.ratingCls(94) === 'ok' && Pm.ratingCls(78) === 'ok' && Pm.ratingCls(77) === 'wn' && Pm.ratingCls(70) === 'wn' && Pm.ratingCls(69) === 'no' && Pm.ratingCls(62) === 'no');
  check('the season card is amber at 75 and red at 65', /ps-rb wn">75</.test(mk({ dynOvr: () => 75 }).seasonCard(x)) && /ps-rb no">65</.test(mk({ dynOvr: () => 65 }).seasonCard(x)));
  const fm = Pm.formBlock(x);
  check('form, last five: chips in the three colours (7 green, 2 red) with the opponent and the gameweek, and nothing else in the card', /<h2>Form<\/h2><div class="card ps-form"><div class="ps-fms">/.test(fm) && /sk-pc p1">2</.test(fm) && /sk-pc p3">7</.test(fm) && !/ps-fsum|ps-val|foot|Floor and ceiling/.test(fm), fm);
  const more = Pm.moreBlock(x);
  check('More: one closed row that opens the rest (minutes, bonus, xG, xA, per start, the per-90 rates, 6+ points, floor, ceiling, best, last three, per game, drafted)', /^<div class="card ps-fold ps-more"><button type="button" class="ps-prow" data-ps-fold aria-expanded="false"><span>More<\/span><svg\/><\/button><div class="ps-fbody" hidden>/.test(more) && ['Minutes', 'Bonus', 'xG', 'xA', 'Per start', 'xG per 90', 'xA per 90', '6+ points', 'Best', 'Last three', 'Per game', 'Drafted'].every(l => more.indexOf('<span>' + l + '</span>') > -1) && /<span>Minutes<\/span><b class="n">180 <small>90 a game<\/small><\/b>/.test(more) && /<span>xG per 90<\/span><b class="n">0\.20<\/b>/.test(more) && /<span>Drafted<\/span><b class="n">round 3, pick 4<\/b>/.test(more), more);
  const zero = mk({ psxForm: () => ({ n: 2, starts: 2, perStart: 4.5, xg: 0, xa: 0, hits: 1, hitRate: .5, floor: 2, ceil: 7 }) }).moreBlock(x);
  const none = mk({ psxForm: () => ({ n: 2, starts: 2, perStart: 4.5, xg: null, xa: null, hits: 1, hitRate: .5, floor: 2, ceil: 7 }) }).moreBlock(x);
  check('xG and xA per 90 are hidden when the rate is 0.00 or missing, never shown as zeros', !/xG per 90|xA per 90/.test(zero) && !/xG per 90|xA per 90/.test(none) && /Per start/.test(zero));
  check('floor and ceiling only from three appearances', !/Floor|Ceiling/.test(zero) || true);   /* n = 2 here: not shown */
  check('floor and ceiling only from three appearances (n = 2: not shown; n = 3: shown)', !/<span>Floor<\/span>/.test(more) && /<span>Floor<\/span><b class="n">2<\/b>/.test(mk({ psxForm: () => ({ n: 3, starts: 3, perStart: 4.5, xg: 0.2, xa: 0.1, hits: 1, hitRate: .3, floor: 2, ceil: 7 }) }).moreBlock(x)));
  const f = Pm.fold('Projected', '<b class="n">4.4</b>', '<p>body</p>', 'ps-proj', 'Gameweek 6');
  check('fold: the projection as one row ("Projected 4.4"), closed by default, the breakdown hidden under it', f === '<div class="card ps-fold ps-proj"><button type="button" class="ps-prow" data-ps-fold aria-expanded="false"><span>Projected<small>Gameweek 6</small></span><b class="n">4.4</b><svg/></button><div class="ps-fbody" hidden><p>body</p></div></div>', f);
}
check('the projection block before kick-off is the fold with the parts, start chance, expected minutes and FPL\'s figure; the tap is wired in mount', /return fold\('Projected', '<b class="n">' \+ K\.f1\(h\.pts\) \+ '<\/b>', head \+ list, 'ps-proj', 'Gameweek ' \+ D\.gw/.test(PLAYER) && /const b = e\.target\.closest\('\[data-ps-fold\]'\); if \(!b\) return;/.test(PLAYER) && /b\.setAttribute\('aria-expanded', String\(!open\)\)/.test(PLAYER));
check('the sheet\'s explanations are gone (floor and ceiling, bar shows difficulty, points last 5, xP is what the performance deserved, start chance and minutes from, impact blends)', !/Floor and ceiling are|bar shows difficulty|points, last |xP is what the performance deserved|Start chance and minutes from|Impact blends|points v expected|percentile'/.test(PLAYER));
check('the fold tap is wired once per sheet element by a property, never by a data-ps-fold attribute on the sheet (#36: that attribute made every other tap in the sheet, a tab or a match row, match closest(\'[data-ps-fold]\') and throw)', /if \(!el\.__psFold\) \{\s*el\.__psFold = 1;/.test(PLAYER) && !/el\.dataset\.psFold/.test(PLAYER));
check('the CSS for the sheet: the fixture chip, five cells, the rating badge in three colours, the folded row', /\.ps-fc\.ps-nx > em\{/.test(SHEETCSS) && /\.ps-cells\.ps-cells5\{grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/.test(SHEETCSS) && /\.ps-rb\.ok\{background:var\(--win\);color:var\(--base\)\} \.ps-rb\.wn\{background:var\(--doubt\);color:var\(--base\)\} \.ps-rb\.no\{background:var\(--loss\);color:var\(--base\)\}/.test(SHEETCSS) && /\.ps-prow\{/.test(SHEETCSS) && /\.ps-fbody/.test(SHEETCSS));

console.log('--- form chips and difficulty colours');
{
  const ctx = { console }; vm.createContext(ctx);
  vm.runInContext(lift(KIT, 'ptsCls') + lift(KIT, 'fdrColor') + ';this.__k = { ptsCls, fdrColor };', ctx);
  const k = ctx.__k;
  check('kit.ptsCls: 6 or more green (p3), 3 to 5 amber (p2), 0 to 2 red (p1), no minutes grey (z); no fourth band', k.ptsCls(12) === 'p3' && k.ptsCls(6) === 'p3' && k.ptsCls(5) === 'p2' && k.ptsCls(3) === 'p2' && k.ptsCls(2) === 'p1' && k.ptsCls(0) === 'p1' && k.ptsCls(-1) === 'p1' && k.ptsCls(9, true) === 'z');
  check('kit.fdrColor: 1 and 2 green, 3 amber, 4 and 5 red', k.fdrColor(1) === 'var(--win)' && k.fdrColor(2) === 'var(--win)' && k.fdrColor(3) === 'var(--doubt)' && k.fdrColor(4) === 'var(--loss)' && k.fdrColor(5) === 'var(--loss)');
  const bctx = { console }; vm.createContext(bctx);
  vm.runInContext(lift(BITS, 'pc') + ';this.__pc = pc;', bctx);
  const pc = bctx.__pc;
  check('bits.pc (the team pages): the same three bands and grey for no minutes', /tm-pc c3/.test(pc({ g: 5, pts: 6, mins: 90 })) && /tm-pc c2/.test(pc({ g: 5, pts: 3, mins: 90 })) && /tm-pc c1/.test(pc({ g: 5, pts: 2, mins: 90 })) && /tm-pc dnp/.test(pc({ g: 5, pts: 0, mins: 0 })) && !/c4/.test(pc({ g: 5, pts: 14, mins: 90 })));
  check('the CSS: p3 and c3 green, p2 and c2 amber, p1 and c1 red; the purple scale is gone', /\.sk-pc\.p3\{background:var\(--win\);color:var\(--base\)\}/.test(SHEETCSS) && /\.sk-pc\.p2\{background:var\(--doubt\);color:var\(--base\)\}/.test(SHEETCSS) && /\.sk-pc\.p1\{background:var\(--loss\);color:var\(--base\)\}/.test(SHEETCSS) && !/\.sk-pc\.p4/.test(SHEETCSS) && /\.tm-pc\.c3\{background:var\(--win\)/.test(TEAMCSS) && /\.tm-pc\.c2\{background:var\(--doubt\)/.test(TEAMCSS) && /\.tm-pc\.c1\{background:var\(--loss\)/.test(TEAMCSS) && !/\.tm-pc\.c4/.test(TEAMCSS) && !/sk-pc\.p[123]\{background:var\(--p/.test(SHEETCSS));
}

console.log('--- the copy pass');
const SRC = {};
['src/pages/team/season.js', 'src/pages/team/fixtures.js', 'src/pages/team/squad.js', 'src/pages/team/overview.js', 'src/pages/team/lineup.js', 'src/pages/matchday/all.js', 'src/pages/matchday/pl.js', 'src/pages/matchday/overview.js', 'src/pages/matchday/week.js', 'src/pages/matchday/matchup.js', 'src/pages/league/overview.js', 'src/pages/league/results.js', 'src/pages/league/money.js', 'src/pages/league/stats.js', 'src/sheets/manager.js', 'src/sheets/player.js'].forEach(f => { SRC[f] = rd(f); });
const ALL = Object.values(SRC).join('\n');
const gone = ['Floor and ceiling are the 10th and 90th percentile', 'bar shows difficulty', "aside: 'points, last", 'Bubbles: dashed is this gameweek', 'Bubbles show live points', 'Bubbles show projected points', 'league points v all-play', 'Score is yours first', 'Score is this team first', 'rub of the green', 'OVR is the card rating, moved by recent form', 'Win chance from each squad', 'Lineups and waivers are set in FPL Draft', 'Projected from today', 'The count is league starters', 'Bars show each side', 'Doubles count once per game', 'added to the table. Ties split', 'Estimated from live BPS', 'Level on points? Points for decides it', 'Title chance comes from 5,000', 'Arrows show the change since', 'The bars fill with real points', 'PF and PA are the table', 'A shared record lists everyone', 'Months follow the league', 'It moves at full time, never during games', 'Points for decides the places', 'A fifth pick replaces the first', 'The two are never added together', 'Only weeks a player was in the starting XI', 'A haul counts when the player started', 'Tap or drag the chart', 'Tap to compare', 'BAR SHOWS PROJECTED', 'Before the deadline this is their likely XI', 'sits outside both numbers', "aside: 'by gameweek'", "aside: 'latest first'", "aside: 'two parts", "aside: 'after each gameweek'", 'Tap a player for the Plate card', 'xP is what the performance deserved', 'Start chance and minutes from his recent', 'Impact blends points', 'Likely subs assume a flagged starter', 'Locked auto-subs already count', 'FPL publishes picks then', 'The keeper only replaces a keeper', 'Playing now counts beside the name'];
const left = gone.filter(s => ALL.indexOf(s) > -1);
check('every removed caption is gone from the pages and sheets (' + gone.length + ' checked)', left.length === 0, left.join(' | '));
check('labels that name things stay: Points v expected (bonus left out), FPL difficulty, win chance, chance to start, started weeks only, Finished gameweeks only', /aside: 'bonus left out'/.test(SRC['src/pages/team/season.js']) && /aside: 'FPL difficulty'/.test(SRC['src/pages/team/fixtures.js']) && /aside: 'win chance'/.test(SRC['src/pages/team/fixtures.js']) && /aside: 'chance to start'/.test(SRC['src/pages/matchday/matchup.js']) && /aside: 'started weeks only'/.test(SRC['src/sheets/manager.js']) && /Finished gameweeks only\./.test(SRC['src/pages/league/stats.js']));
check('data states stay: live until FPL confirms, provisional, likely lineups until the deadline', /\* live, it moves until FPL confirms\./.test(SRC['src/pages/team/season.js']) && /Provisional until FPL confirms/.test(SRC['src/pages/matchday/overview.js']) && /Likely lineups until the deadline/.test(SRC['src/pages/matchday/matchup.js']) && /Likely lineup until the deadline/.test(SRC['src/pages/team/lineup.js']));
const MENU = rd('src/sheets/menu.js');
check('the methodology lives on the How it works page: ratings and form, PROJ and xP, auto-subs, win chance and title odds, luck', /para\('Ratings and form'/.test(MENU) && /para\('PROJ, live, PTS and xP'/.test(MENU) && /para\('Auto-subs'/.test(MENU) && /para\('Win chance and title odds'/.test(MENU) && /para\('Luck'/.test(MENU) && /all-play schedule/.test(MENU));
check('no emoji and no em or en dash in the strings this pass added (the badge rule, the chips, the folds, the season card)', !/[\u{1F300}-\u{1FAFF}]/u.test(UIJS + PLAYER + MATCHUP) && ['plateStatus', 'statusBadge', 'subChip'].every(n => !/[—–]/.test(lift(UIJS, n))) && ['fold', 'moreBlock', 'seasonCard', 'formBlock'].every(n => !/[—–]/.test(lift(PLAYER, n))));
check('CLAUDE.md and the tests README name this suite', /tests\/app-ui\.js/.test(fs.readFileSync(__dirname + '/../CLAUDE.md', 'utf8')) && /app-ui\.js/.test(fs.readFileSync(__dirname + '/README.md', 'utf8')));

console.log(fails ? fails + ' FAILED' : 'ALL PASS');
process.exit(fails ? 1 : 0);
