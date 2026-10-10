// The app's contrast rules (docs/DESIGN.md; Parker, 10 Oct 2026: "Stats need to be clear to read. High contrast." and
// "a contrast pass on the entire app"). Plain Node, no browser: the tokens read from the CSS and their WCAG contrast
// (a number 7:1, a label 4.5:1, display type 3:1), the stats scope of 65-stats.css, the Plate's text block, the Gameweek
// Show's stylesheet colours (its screens need a voiced show, which the demo does not carry), DESIGN.md's token names,
// the audit library (fplgg/tools/contrast/lib.js) and the CI wiring of the headless audit (fplgg/tools/contrast/audit.js).
//     node tests/app-contrast.js
const fs = require('fs');
let fails = 0;
const check = (label, cond, info) => { if (!cond) fails++; console.log((cond ? 'PASS ' : 'FAIL ') + label + (info ? '  ' + info : '')); };
const MW = __dirname + '/../fplgg/tools/matchweek/';
const TOK = fs.readFileSync(MW + 'src/css/01-tokens.css', 'utf8'), ST = fs.readFileSync(MW + 'src/css/65-stats.css', 'utf8');
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '');
/* every --name:#hex in a file */
function tokens(css) { const t = {}; strip(css).replace(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\b/g, (m, k, v) => { t[k] = v.toUpperCase(); }); return t; }
const T = Object.assign(tokens(TOK), tokens(ST));
const lum = hex => { const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (fg, bg) => { const a = lum(T[fg]), b = lum(T[bg]); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };
const r1 = x => Math.round(x * 10) / 10;

console.log('--- T the tokens');
['st-base', 'st-card', 'st-raised', 'st-top', 'st-hair', 'st-line', 'st-num', 'st-num2', 'st-lab', 'st-lab2', 'st-you', 'st-win', 'st-amber', 'st-red', 'st-redbg'].forEach(k =>
  check('T1 --' + k + ' is a hex colour in 65-stats.css', /^#[0-9A-F]{6}$/.test(T[k] || ''), T[k]));
/* near-black and neutral: the three channels within 6 of each other, and darker than the app's purple-tinted base (#0E0A13) is far from */
const neutral = hex => { const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)); return Math.max(...c) - Math.min(...c) <= 6; };
['st-base', 'st-card', 'st-raised', 'st-top', 'st-hair', 'st-line', 'st-num', 'st-num2', 'st-lab', 'st-lab2'].forEach(k =>
  check('T2 --' + k + ' is neutral (no purple tint: the channels within 6 of each other)', neutral(T[k]), T[k]));
check('T3 the cards are near black (--st-card under 10% luminance, darker than --st-raised, darker than --st-top)', lum(T['st-card']) < 0.1 && lum(T['st-base']) < lum(T['st-card']) && lum(T['st-card']) < lum(T['st-raised']) && lum(T['st-raised']) < lum(T['st-top']));
check('T4 the numbers are white', T['st-num'] === '#FFFFFF');

console.log('--- N numbers, 7:1');
const NUM = [
  ['st-num', 'st-card', 'a number on a card'], ['st-num', 'st-raised', 'a number on a tile'], ['st-num', 'st-top', 'a number on a chip'], ['st-num', 'st-base', 'a number on the sheet'],
  ['st-num2', 'st-card', 'a secondary number (xP) on a card'], ['st-num2', 'st-raised', 'a secondary number on a tile'], ['st-num2', 'st-top', 'a secondary number on a chip'],
  ['st-you', 'st-card', 'your number on a card'], ['st-you', 'st-raised', 'your number on a tile'],
  ['st-base', 'win', 'the green points chip (6 or more) and the green rating badge (78 or more)'], ['st-base', 'doubt', 'the amber points chip (3 to 5) and the amber rating badge (70 to 77)'],
  ['st-base', 'st-redbg', 'the red points chip (0 to 2) and the red rating badge (under 70)'],
  ['st-win', 'st-card', 'a green figure on a card (the rating arrow, a clean sheet tag)'], ['st-red', 'st-card', 'a red figure on a card (the rating arrow, a red event tag)'],
  ['doubt', 'st-card', 'the minutes-risk percentage'], ['st-win', 'st-card', 'a green figure on a card (the OVR up arrow)'], ['st-red', 'st-card', 'a red figure on a card (the OVR down arrow)'], ['live', 'st-card', 'a live figure on a card'],
  /* the light surfaces: the leader's pill in the Matchup Stats tab and the haul chip carry dark figures */
  ['st-base', 'st-num', 'the leader pill (white) with dark figures'], ['st-base', 'st-lab', 'the leader pill (grey) with dark figures'], ['st-base', 'st-you', 'your leader pill with dark figures'],
  ['st-base', 'opp', 'the opponent leader pill with dark figures'],
];
NUM.forEach(([fg, bg, what]) => { const r = ratio(fg, bg); check('N ' + what + ' (--' + fg + ' on --' + bg + ') is at least 7:1', r >= 7, r1(r) + ':1'); });

console.log('--- L labels, 4.5:1');
const LAB = [
  ['st-lab', 'st-card', 'a label on a card'], ['st-lab', 'st-raised', 'a label on a tile'], ['st-lab', 'st-top', 'a label on a chip'], ['st-lab', 'st-base', 'a label on the sheet'],
  ['st-lab2', 'st-card', 'a quiet label on a card'], ['st-lab2', 'st-raised', 'a quiet label on a tile'], ['st-lab2', 'st-base', 'a quiet label on the sheet'],
];
LAB.forEach(([fg, bg, what]) => { const r = ratio(fg, bg); check('L ' + what + ' (--' + fg + ' on --' + bg + ') is at least 4.5:1', r >= 4.5, r1(r) + ':1'); });

console.log('--- S the scope');
const body = strip(ST);
const scope = /\n([^{}]*?)\{\s*--base:var\(--st-base\)/.exec(body);
check('S1 one rule sets the neutral tokens on the scope', !!scope);
['.sheet.sk-player', 'main.lgx-stats', '.md-stats', '.md-rks', '.md-tiles2'].forEach(s => check('S2 the scope names ' + s, !!scope && scope[1].split(',').map(x => x.trim()).includes(s)));
['--card:var(--st-card)', '--raised:var(--st-raised)', '--top:var(--st-top)', '--tx:var(--st-num)', '--tx2:var(--st-num2)', '--tx3:var(--st-lab)', '--tx4:var(--st-lab2)', '--you:var(--st-you)', '--bar:var(--st-base)'].forEach(d =>
  check('S3 the scope maps ' + d.split(':')[0] + ' to its neutral token', body.includes(d)));
check('S4 no purple token anywhere in the stats stylesheet (purple stays on tabs and active states, which the scope does not touch)', !/--p[0-9]{3}\b|#37003C|#5B2D8E|#7B52D3|#A88BEB|#CDBDF0/i.test(body), (body.match(/--p[0-9]{3}\b/g) || []).join(' '));
check('S5 the Matchup Stats leader pills carry dark figures on both sides', /\.md-stats\{--md-lc:var\(--st-num\);--md-rc:var\(--st-lab\);--md-rt:var\(--st-base\)\}/.test(body) && /\.md-stats\.md-mine\{--md-lc:var\(--st-you\);--md-rc:var\(--opp\);--md-rt:var\(--st-base\)\}/.test(body));
check('S6 the red points chip and the red rating badge carry dark figures on the lighter red', body.includes('.sheet.sk-player .sk-pc.p1,.sheet.sk-player .ps-rb.no{background:var(--st-redbg);color:var(--st-base)}'));
check('S7 the rating arrows read the light green and red', body.includes('.sheet.sk-player .ps-rating span em.up{color:var(--st-win)} .sheet.sk-player .ps-rating span em.dn{color:var(--st-red)}'));
check('S8 white on the app\'s red is why: under 7:1', ratio('tx', 'loss') < 7, r1(ratio('tx', 'loss')) + ':1');
check('S9 purple numbers on the player sheet (xP in the breakdown and the match log) read the light grey', body.includes('.sheet.sk-player .ps-bd b.xv,.sheet.sk-player .ps-bd.hd b.xv,.sheet.sk-player .ps-ml .xp{color:var(--st-num2)}'));

console.log('--- W the wiring');
const files = fs.readdirSync(MW + 'src/css').filter(f => f.endsWith('.css')).sort();
check('W1 65-stats.css is the last stylesheet ci-build.sh concatenates (src/css/*.css in name order), so its scope wins', files[files.length - 1] === '65-stats.css', files.join(' '));
check('W2 ci-build.sh concatenates src/css/*.css', /cat src\/css\/\*\.css/.test(fs.readFileSync(MW + 'ci-build.sh', 'utf8')));
const player = fs.readFileSync(MW + 'src/sheets/player.js', 'utf8'), league = fs.readFileSync(MW + 'src/pages/league.js', 'utf8'), matchup = fs.readFileSync(MW + 'src/pages/matchday/matchup.js', 'utf8'), kit = fs.readFileSync(MW + 'src/sheets/kit.js', 'utf8');
check('W3 the player sheet is .sheet.sk-player', /cls: 'sk-player'/.test(player));
check('W4 the season card carries the rating badge in its colour (ps-rb ok, wn, no) and the arrow (ps-rating em)', player.includes('ps-rb') && player.includes('ps-rating') && /\.ps-rb\.no\{background:var\(--loss\);color:var\(--base\)\}/.test(fs.readFileSync(MW + 'src/css/60-sheets.css', 'utf8')));
check('W5 the kit colours the next five green, amber, red', kit.includes("return n <= 2 ? 'var(--win)' : n === 3 ? 'var(--doubt)' : 'var(--loss)';"));
check('W6 League > Stats renders inside main.lgx-stats', league.includes('<main class="lgx lgx-\' + sub + \'">') && /case 'stats'/.test(league));
check('W7 the Matchup Stats tab\'s cards are .md-stats, .md-rks and the tiles .md-tiles2', /class="card md-stats/.test(matchup) && /class="card md-rks"/.test(matchup) && /class="md-tiles2"/.test(matchup));
check('W8 the kit\'s points tiers are the UI pass\'s (p3 from 6, p2 from 3, else p1, z for no minutes)', kit.includes("return dnp ? 'z' : v >= 6 ? 'p3' : v >= 3 ? 'p2' : 'p1';"));
check('W9 the sheet\'s red chip carries dark figures on red everywhere (DESIGN.md: nothing is white on --loss)', /\.sk-pc\.p1\{background:var\(--loss\);color:var\(--base\)\}/.test(fs.readFileSync(MW + 'src/css/60-sheets.css', 'utf8')));


/* ===== the whole app (DESIGN.md, Parker's contrast pass of 10 Oct 2026) ===== */
console.log('--- X the app-wide tokens');
const APP = Object.assign({}, tokens(TOK));
const rx = (fg, bg) => { const a = lum(APP[fg]), b = lum(APP[bg]); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };
['num2', 'you', 'b300', 'win', 'loss', 'doubt', 'live', 'tx', 'tx2', 'tx3', 'tx4', 'base', 'card', 'raised', 'top'].forEach(k => check('X1 --' + k + ' is a hex colour in 01-tokens.css', /^#[0-9A-F]{6}$/.test(APP[k] || ''), APP[k]));
const SURF = ['base', 'card', 'raised', 'top'];
[['num2', 'the quiet number'], ['you', 'your figure'], ['b300', 'a blue figure or link'], ['win', 'a green figure'], ['loss', 'a red figure'], ['doubt', 'an amber figure'], ['live', 'a live figure'], ['tx', 'a white figure'], ['tx2', 'a light figure']].forEach(([fg, what]) =>
  SURF.forEach(bg => { const r = rx(fg, bg); check('X2 ' + what + ' (--' + fg + ') on --' + bg + ' is at least 7:1', r >= 7, r1(r) + ':1'); }));
[['tx3', 'the quiet label'], ['tx4', 'the quieter label']].forEach(([fg, what]) => ['base', 'card', 'raised'].forEach(bg => { const r = rx(fg, bg); check('X3 ' + what + ' (--' + fg + ') on --' + bg + ' is at least 4.5:1', r >= 4.5, r1(r) + ':1'); }));
check('X3 the quiet label (--tx3) on --top is at least 4.5:1', rx('tx3', 'top') >= 4.5, r1(rx('tx3', 'top')) + ':1');
['win', 'doubt', 'loss', 'live', 'gold', 'b300', 'cyan'].forEach(bg => { const r = rx('base', bg); check('X4 dark figures (--base) on a --' + bg + ' fill are at least 7:1 (the chips, the status badges, the form squares)', r >= 7, r1(r) + ':1'); });
check('X5 white on --loss is under 7:1, which is why nothing is white on red', rx('tx', 'loss') < 7, r1(rx('tx', 'loss')) + ':1');
check('X6 --you equals --b300 (your figure and the links share the blue)', APP.you === APP.b300);
const TOKCSS = strip(TOK);
check('X7 a number inside a quiet label reads --num2 (.sub .n, .k .n and the rest)', /\.sub \.n,\.n\.sub,\.muted \.n,\.n\.muted,\.k \.n,\.n\.k\{color:var\(--num2\)\}/.test(TOKCSS));
const COMP = strip(fs.readFileSync(MW + 'src/css/02-components.css', 'utf8'));
check('X8 the status badge glyph is dark (--base), and the badge arrows are dark in ui.js', /\.fc \.st b\{[^}]*color:var\(--base\)/.test(COMP) && (fs.readFileSync(MW + 'src/ui.js', 'utf8').match(/fill="#0E0A13"\/><\/svg>';/g) || []).length === 2);
check('X9 a count on the active pill sits on white with dark figures', /\.pills \.on \.ct\{background:#fff;color:var\(--base\)\}/.test(COMP) && /\.pills \.ct\{[^}]*color:#fff\}/.test(COMP));
check('X10 the chips and the form squares carry dark figures on the status colours', /\.chip\.out\{background:var\(--loss\);color:var\(--base\)\}/.test(COMP) && /\.tm-pc\.c1\{background:var\(--loss\);color:var\(--base\)\}/.test(strip(fs.readFileSync(MW + 'src/css/30-team.css', 'utf8'))));
const FEED = strip(fs.readFileSync(MW + 'src/css/50-feed.css', 'utf8')), MD = strip(fs.readFileSync(MW + 'src/css/20-matchday.css', 'utf8')), LG = strip(fs.readFileSync(MW + 'src/css/40-league.css', 'utf8'));
const purpleFill = /#37003C|#5B2D8E|#7B52D3|var\(--p900\)|var\(--p700\)|var\(--p500\)/i;
check('X11 no purple fill behind the Feed\'s match bubbles, the article kicker or Malcolm\'s cards', !purpleFill.test((FEED.match(/\.fmb\{[^}]*\}|\.fmb\.ft \.fmb-hd[^}]*\}|\.far-k\{[^}]*\}|\.fpc\.v-malcolm\{[^}]*\}/g) || []).join('')));
check('X12 the Feed\'s figures are not purple (--p100 gone from the bubble heads, the projection lines and the kicker)', !/\.fmb-hd>span\{[^}]*--p100|\.fsb-proj\{[^}]*--p100|\.fbd-pf\{[^}]*--p100|\.far-k em\{[^}]*--p100/.test(FEED));
check('X13 the Week grid\'s heat and the xP pill are blue, not purple', /\.md-gc\{[^}]*rgba\(30,61,214,var\(--a\)\)/.test(MD) && /\.pb\.xp\{background:var\(--b700\)/.test(MD));
check('X14 the League hero and the progress line carry no purple behind or in a number', !purpleFill.test((LG.match(/\.lg-tbl-hd\{[^}]*\}/) || [''])[0]) && /\.lg-prog \.n\{[^}]*color:var\(--tx2\)/.test(LG));
check('X15 dimmed rows dim their picture, never their words (no opacity on .tm-lr.off, .tm-tx.no .tm-txio, .tm-gcl .bn, .ms-tx.dim)', !/\.tm-lr\.off\{opacity|\.tm-tx\.no \.tm-txio\{opacity|\.tm-gcl \.bn\{opacity|\.ms-tx\.dim\{opacity/.test(strip(fs.readFileSync(MW + 'src/css/30-team.css', 'utf8')) + strip(fs.readFileSync(MW + 'src/css/60-sheets.css', 'utf8'))));
check('X16 the matchup token\'s line is a solid pill in a light neutral, and the live minute reads a light green', /\.md-sl\{[^}]*color:#E4EAE6[^}]*background:rgba\(7,20,12,\.84\)/.test(MD) && /\.md-sl\.lv\{color:#7CF7B8\}/.test(MD));
check('X17 the lineup list\'s status chip wraps under the club, never under the fixture column', /\.tm-lmeta\{display:flex;align-items:center;flex-wrap:wrap;/.test(strip(fs.readFileSync(MW + 'src/css/30-team.css', 'utf8'))));

console.log('--- P the Plate\'s text');
['gold', 'silver'].forEach(t => check('P1 the ' + t + ' tier sets its text, position, arrow, backing, bubble and initials tokens', new RegExp('\\.fc\\.' + t + '\\{--tx:#[0-9A-F]{6};--sub:#[0-9A-F]{6};--up:#[0-9A-F]{6};--dn:#[0-9A-F]{6};--rtb:rgba\\([^)]*\\);--bub:#[0-9A-F]{6};--bubp:#[0-9A-F]{6};--bubpl:#[0-9A-F]{6};--bubpt:#[0-9A-F]{6};--nf:rgba', 'i').test(COMP)));
check('P2 the dark tiers (spec, elite, totw, potm) share a dark backing, a solid dark projection bubble with white figures and light arrows', /\.fc\.spec,\.fc\.elite,\.fc\.totw,\.fc\.potm\{--up:#5FE09A;--dn:#FFA3A5;--rtb:rgba\(8,6,12,\.62\);--bubp:#15111D;/.test(COMP));
check('P3 the rating and position sit on the backing box, the arrows take the tier\'s colour, the projection bubble is solid', /\.fc \.rt\{background:var\(--rtb\)/.test(COMP) && /\.fc \.rt \.fdar\.up\{color:var\(--up\)\} \.fc \.rt \.fdar\.dn\{color:var\(--dn\)\}/.test(COMP) && /\.fc \.pts\.proj\{background:var\(--bubp\);border:1\.5px dashed var\(--bubpl\)/.test(COMP) && /\.fc \.pts\.proj b,\.fc \.pts\.proj i\{color:var\(--bubpt\);opacity:1/.test(COMP));
check('P4 the initials circle takes the tier\'s fill; a banked blank is quiet in colour, not opacity', /\.fc \.noface\{background:var\(--nf\)/.test(COMP) && !/\.fc\.mini \.pts\.blank\{opacity/.test(COMP));
const tier = (t, k) => { const m = new RegExp('\\.fc\\.' + t + '\\{([^}]*)\\}').exec(COMP); const v = m && new RegExp('--' + k + ':(#[0-9A-Fa-f]{6})').exec(m[1]); return v ? v[1].toUpperCase() : null; };
const lumH = h => lum(h), rr = (a, b) => (Math.max(lumH(a), lumH(b)) + 0.05) / (Math.min(lumH(a), lumH(b)) + 0.05);
[['gold', '#F4DA8C'], ['silver', '#E4E7EC']].forEach(([t, art]) => {
  check('P5 ' + t + ': the position (--sub) reads 4.5:1 on the lightest of the tier\'s art under the backing', rr(tier(t, 'sub'), art) >= 4.5, r1(rr(tier(t, 'sub'), art)) + ':1');
  check('P6 ' + t + ': the projection figure (--bubpt) reads 7:1 on its bubble (--bubp)', rr(tier(t, 'bubpt'), tier(t, 'bubp')) >= 7, r1(rr(tier(t, 'bubpt'), tier(t, 'bubp'))) + ':1');
  check('P7 ' + t + ': white reads 7:1 on the banked bubble (--bub)', rr('#FFFFFF', tier(t, 'bub')) >= 7, r1(rr('#FFFFFF', tier(t, 'bub'))) + ':1');
});
check('P8 the dark tiers: white reads 7:1 on the projection bubble', rr('#FFFFFF', '#15111D') >= 7);

console.log('--- G the Gameweek Show\'s stylesheet (no voiced show in the demo, so the audit cannot open it)');
const SHOW = strip(fs.readFileSync(MW + 'src/css/55-show.css', 'utf8'));
const showBg = ['#2A0730', '#120A18', '#0B0710'];   /* the stage gradient's stops */
const showText = {}; SHOW.replace(/\.(gs-[a-z0-9-]+(?:[ >][^{]*)?|fgs-[a-z0-9-]+)\{([^}]*?color:(#[0-9A-Fa-f]{6})[^}]*)\}/g, (m, sel, body, c) => { const bg = /(?:^|;)background:(#[0-9A-Fa-f]{3,8})\b/.exec(body); showText[sel.trim()] = { c: c.toUpperCase(), bg: bg ? require('../fplgg/tools/contrast/lib.js').hex(require('../fplgg/tools/contrast/lib.js').parseColor(bg[1])) : null }; });
check('G1 the show\'s text colours were found in 55-show.css', Object.keys(showText).length >= 6, Object.keys(showText).length + ' rules');
/* a rule with its own solid background (a chip, a button) is read on that; the rest on the stage's three stops */
Object.keys(showText).forEach(sel => { const t = showText[sel]; const worst = t.bg ? rr(t.c, t.bg) : Math.min(...showBg.map(b => rr(t.c, b))); const isNum = /#gs-n\b|gs-sc\b/.test(sel); check('G2 ' + sel + ' (' + t.c + ') reads ' + (isNum ? '7' : '4.5') + ':1 on ' + (t.bg ? 'its own ' + t.bg : 'every stop of the stage'), worst >= (isNum ? 7 : 4.5), r1(worst) + ':1'); });
check('G3 the stage is a dark gradient (the three stops)', /\.gs-bg\{[^}]*linear-gradient\(180deg,#2a0730 0%,#120a18 48%,#0B0710 100%\)/i.test(SHOW));

console.log('--- D DESIGN.md');
const DESIGN = fs.readFileSync(MW + 'docs/DESIGN.md', 'utf8');
check('D1 DESIGN.md states the three thresholds and the purple and status rules', /7:1/.test(DESIGN) && /4\.5:1/.test(DESIGN) && /3:1/.test(DESIGN) && /never the background behind a number/i.test(DESIGN) && /green, amber and red/i.test(DESIGN));
const named = [...new Set((DESIGN.match(/`--[a-z0-9-]+`/g) || []).map(x => x.slice(3, -1)))];
const allTokens = Object.assign({}, tokens(TOK), tokens(ST));
const unknown = named.filter(k => !(k in allTokens) && !/^p[0-9]{3}$|^st-/.test(k));
check('D2 every token DESIGN.md names exists in the CSS (' + named.length + ')', unknown.length === 0, unknown.join(', '));
['#C4BBD2', '#A398B2', '#40D085', '#F5B942', '#FF9598', '#19D27A', '#9AB0FF'].forEach(h => check('D3 DESIGN.md quotes the current value ' + h, DESIGN.includes(h) && Object.values(allTokens).includes(h)));
check('D4 CLAUDE.md points at DESIGN.md', /docs\/DESIGN\.md/.test(fs.readFileSync(__dirname + '/../CLAUDE.md', 'utf8')));
check('D5 no dash or emoji in DESIGN.md', !/[–—]/.test(DESIGN) && !/[\u{1F300}-\u{1FAFF}]/u.test(DESIGN));

console.log('--- A the audit library (fplgg/tools/contrast/lib.js)');
const L = require('../fplgg/tools/contrast/lib.js');
check('A1 parseColor reads hex, rgb, rgba and the named colours', JSON.stringify(L.parseColor('#17121D')) === '[23,18,29,1]' && JSON.stringify(L.parseColor('rgb(255, 0, 0)')) === '[255,0,0,1]' && JSON.stringify(L.parseColor('rgba(0, 0, 0, 0.5)')) === '[0,0,0,0.5]' && L.parseColor('transparent')[3] === 0 && L.parseColor('white')[0] === 255 && L.parseColor('nonsense') === null);
check('A2 contrast is WCAG\'s (white on black 21:1, white on --card ' + r1(rx('tx', 'card')) + ':1)', Math.abs(L.contrast([255, 255, 255], [0, 0, 0]) - 21) < 0.01 && Math.abs(L.contrast([255, 255, 255], [23, 18, 29]) - rx('tx', 'card')) < 0.01);
check('A3 over composites a translucent colour (50% white over black is mid grey)', L.hex(L.over([255, 255, 255, 0.5], [0, 0, 0])) === '#808080');
check('A4 isPurple: the brand purples yes, the dark tints and the blues no', L.isPurple(L.parseColor('#7B52D3')) && L.isPurple(L.parseColor('#37003C')) && L.isPurple(L.parseColor('#584879')) && !L.isPurple(L.parseColor('#17121D')) && !L.isPurple(L.parseColor('#1E122D')) && !L.isPurple(L.parseColor('#2E5BFF')) && !L.isPurple(L.parseColor('#C4BBD2')));
check('A5 ruleFor: a number 7, display type 3, text 4.5; class n is a number', L.ruleFor('4.4', '', 12).min === 7 && L.ruleFor('66-40', '', 12).min === 7 && L.ruleFor('3rd', '', 12).min === 7 && L.ruleFor('55%', '', 12).min === 7 && L.ruleFor('Projected', 'n', 12).min === 7 && L.ruleFor('Projected', '', 26).min === 3 && L.ruleFor('Projected', '', 12).min === 4.5 && L.ruleFor('W-D-L', '', 12).min === 4.5);
const rd = L.reading([255, 255, 255, 1], [0, 0, 0], [200, 200, 200], [100, 100, 100]);
check('A6 reading takes the lower of the two ratios (the lightest pixel behind white text)', rd.ratio < 2 && rd.ratioDark === 21 && rd.light === '#C8C8C8');
check('A7 verdict names the broken rule, and purple behind or in a number, but not on a Plate', L.verdict({ kind: 'number', min: 7 }, { ratio: 5 }, { medianRGB: [123, 82, 211], fgRGB: [255, 255, 255] }).join('; ') === 'number needs 7:1; a number on purple' && L.verdict({ kind: 'number', min: 7 }, { ratio: 9 }, { plate: true, medianRGB: [123, 82, 211], fgRGB: [255, 255, 255] }).length === 0 && L.verdict({ kind: 'text', min: 4.5 }, { ratio: 5 }, { medianRGB: [123, 82, 211], fgRGB: [255, 255, 255] }).length === 0);
const rep = L.report([{ screen: 'a', sel: 'b.n', text: '1', fg: '#FFF', dark: '#000', light: '#000', ratio: 2, rule: 'number 7:1', why: ['number needs 7:1'], size: 12 }, { screen: 'a', sel: 'b.n', text: '2', fg: '#FFF', dark: '#000', light: '#000', ratio: 3, rule: 'number 7:1', why: ['number needs 7:1'], size: 12 }], 3);
check('A8 report groups by screen, selector, colour and rule, keeps the worst and counts', rep.groups.length === 1 && rep.groups[0].n === 2 && rep.groups[0].ratio === 2 && rep.head === '2 offenders in 1 group across 3 screens');

console.log('--- C the audit in CI');
const AUD = fs.readFileSync(__dirname + '/../fplgg/tools/contrast/audit.js', 'utf8');
check('C1 the audit walks every page and sub-tab, the sheets and the menu, with the clock fixed at the snapshot', ['#/matchday/matchup/', "'all', 'pl', 'week'", "'squad', 'transfers', 'fixtures', 'season'", "'overview', 'results', 'money', 'derbies', 'stats', 'alltime'", "'league', 'foryou', 'articles', 'messages'", "openSheet('player'", "openSheet('manager'", "openSheet('menu')", "openSheet('menu', 'how')", "openSheet('search')", "openSheet('identity')", "openSheet('post'", 'clock.setFixedTime'].every(x => AUD.includes(x)));
check('C2 the audit hides the text, photographs the view and reads the pixels under every text box (darkest, lightest, median)', AUD.includes('color:transparent!important') && AUD.includes('getImageData') && /at\(0\.02\)/.test(AUD) && /at\(0\.98\)/.test(AUD));
check('C3 the audit clips a text box to its clipping ancestors and away from fixed and sticky covers', /overflowX !== 'visible'/.test(AUD) && /ps !== 'fixed' && ps !== 'sticky'/.test(AUD));
check('C4 the audit checks the manager line under the team name and the owner pill', /never the team name twice/.test(AUD) && /not Free agent/.test(AUD));
check('C5 the audit exits 1 on an offender and prints CONTRAST OK or CONTRAST FAIL', /process\.exit\(offenders\.length \|\| failedChecks \? 1 : 0\)/.test(AUD) && AUD.includes("'CONTRAST FAIL: '") && AUD.includes("'CONTRAST OK: '"));
const PREV = fs.readFileSync(__dirname + '/../.github/workflows/preview.yml', 'utf8'), BUILD = fs.readFileSync(__dirname + '/../.github/workflows/matchweek.yml', 'utf8');
check('C6 the preview workflow builds the demo from the committed snapshot and runs the audit before publishing', /build-demo\.js --data site\/public\/demo\/data --out/.test(PREV) && /contrast\/audit\.js/.test(PREV) && PREV.indexOf('contrast/audit.js') < PREV.indexOf('Publish it as preview/ on main'));
check('C7 the league build runs the audit on the demo it just built, before the commit', /contrast\/audit\.js/.test(BUILD) && BUILD.indexOf('contrast/audit.js') > BUILD.indexOf('build-demo.js') && BUILD.indexOf('contrast/audit.js') < BUILD.indexOf('Commit the build'));
check('C8 both workflows install Playwright\'s Chromium for the audit', /playwright install --with-deps chromium/.test(PREV) && /playwright install --with-deps chromium/.test(BUILD));
check('C9 the build-demo offline mode copies the committed tabs and derives the mapping from league.json\'s own teams', /function fromData\(dataDir, cfg\)/.test(fs.readFileSync(__dirname + '/../fplgg/tools/demo/build-demo.js', 'utf8')) && /Manager: cfg\.teams\[t\]\.mgr/.test(fs.readFileSync(__dirname + '/../fplgg/tools/demo/build-demo.js', 'utf8')));
check('C11 the audit reads an open sheet on its own layer (the collector scoped to .sheet.in), after its slide-in has finished, and a sheet that reads 0 text boxes is a failed check', /function collectSrc\(rootSel\)/.test(AUD) && /document\.createTreeWalker\(root, NodeFilter\.SHOW_TEXT\)/.test(AUD) && /root\.querySelectorAll\('\*'\)\.forEach\(e => \{ const ps = style\(e\)\.position;/.test(AUD) && /collectSrc\(opt\.sheet \? scroller : ''\)/.test(AUD) && /getBoundingClientRect\(\)\.bottom - innerHeight\) < 1/.test(AUD) && /if \(opt\.sheet\) check\(name \+ ': the sheet\\'s text was read \(' \+ n \+ ' boxes\)', n > 0\);/.test(AUD));
check('C12 the audit clips a text box to the element\'s own overflow too (an ellipsised run\'s hidden tail is not read against the chip beside it)', /for \(let a = el; a && a !== document\.body; a = a\.parentElement\) \{ const s = style\(a\); if \(s\.overflowX !== 'visible'/.test(AUD));
check('C13 --no-photos refuses every off-site image so the initials fallback is read', /process\.argv\.includes\('--no-photos'\)/.test(AUD) && /resourceType\(\) === 'image' \? r\.abort\(\) : r\.continue\(\)/.test(AUD));
const TEAMCSS = strip(fs.readFileSync(MW + 'src/css/30-team.css', 'utf8')), UIJS = fs.readFileSync(MW + 'src/ui.js', 'utf8');
check('C14 a played or subbed-off face dims its picture, never its initials (the fallback reads --tx3 on the circle)', /\.tm-xif \.fc-i\.done\{background:var\(--raised\)\} \.tm-xif \.fc-i\.done img\{opacity:\.38\} \.tm-xif \.fc-i\.done \.ini\{color:var\(--tx3\)\}/.test(TEAMCSS) && !/\.tm-xif \.fc-i\.done\{opacity/.test(TEAMCSS) && !/\.tm-lr\.off \.fc-i,/.test(TEAMCSS) && /\.tm-lr\.off \.fc-i \.ini\{color:var\(--tx3\)\}/.test(TEAMCSS) && rx('tx3', 'raised') >= 4.5 && rx('tx3', 'top') >= 4.5);
check('C15 the face circle sets its font-size to its width, so the initials (.36em) scale with the circle', /style="width:' \+ px \+ 'px;height:' \+ px \+ 'px;font-size:' \+ px \+ 'px'/.test(UIJS) && /\.fc-i \.ini\{[^}]*font-size:\.36em\}/.test(COMP));
check('C16 the Plate rating\'s backing reaches the top of the figure\'s glyph box (6% of the card above the line box, the margin matching)', /\.fc \.rt\{background:var\(--rtb\);border-radius:2\.6cqw;padding:6% 3\.5% 1\.6%;margin:-6% -3\.5% -1\.6%\}/.test(COMP));
check('C18 the player sheet\'s H or A marker rule is the direct child only, so the crest circle\'s letters stay dark on white when the crest fails to load', /\.ps-fc\.ps-nx > em\{/.test(strip(fs.readFileSync(MW + 'src/css/60-sheets.css', 'utf8'))) && !/\.ps-fc\.ps-nx em\{/.test(strip(fs.readFileSync(MW + 'src/css/60-sheets.css', 'utf8'))));
check('C19 the audit lets a scroll settle (a sticky bar through an observer and a transition) before it reads the covers', /waitForTimeout\(v \? 350 : 40\)/.test(AUD));
check('C17 the voice name in a post header is never cut against the voice\'s chip: the chips wrap under it', /\.fp-who b\{display:flex;align-items:center;flex-wrap:wrap;gap:2px 6px;/.test(FEED));
check('C10 the README says how to run the audit locally', /NODE_PATH=\/opt\/node22\/lib\/node_modules node fplgg\/tools\/contrast\/audit\.js/.test(fs.readFileSync(__dirname + '/../fplgg/tools/contrast/README.md', 'utf8')));

console.log(fails ? fails + ' FAILED' : 'ALL PASS');
process.exit(fails ? 1 : 0);
