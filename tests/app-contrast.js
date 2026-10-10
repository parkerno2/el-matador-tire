// The stats surfaces' contrast (Parker, 10 Oct 2026: "Stats need to be clear to read. High contrast."): the neutral
// scheme in fplgg/tools/matchweek/src/css/65-stats.css gives the player sheet, the Matchup Stats tab and League > Stats
// near-black cards, white numbers and light grey labels. This reads the tokens from the CSS and computes WCAG contrast:
// a number needs 7:1, a label 4.5:1, on the dark cards and on the light pills and chips alike. Plain Node.
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
check('W4 the season card carries the rating badge in its colour (ps-rb ok, wn, no) and the arrow (ps-rating em)', player.includes('ps-rb') && player.includes('ps-rating') && /\.ps-rb\.no\{background:var\(--loss\);color:#fff\}/.test(fs.readFileSync(MW + 'src/css/60-sheets.css', 'utf8')));
check('W5 the kit colours the next five green, amber, red', kit.includes("return n <= 2 ? 'var(--win)' : n === 3 ? 'var(--doubt)' : 'var(--loss)';"));
check('W6 League > Stats renders inside main.lgx-stats', league.includes('<main class="lgx lgx-\' + sub + \'">') && /case 'stats'/.test(league));
check('W7 the Matchup Stats tab\'s cards are .md-stats, .md-rks and the tiles .md-tiles2', /class="card md-stats/.test(matchup) && /class="card md-rks"/.test(matchup) && /class="md-tiles2"/.test(matchup));
check('W8 the kit\'s points tiers are the UI pass\'s (p3 from 6, p2 from 3, else p1, z for no minutes)', kit.includes("return dnp ? 'z' : v >= 6 ? 'p3' : v >= 3 ? 'p2' : 'p1';"));
check('W9 the sheet\'s red chip is white on red outside the scope (what the override fixes)', /\.sk-pc\.p1\{background:var\(--loss\);color:#fff\}/.test(fs.readFileSync(MW + 'src/css/60-sheets.css', 'utf8')));

console.log(fails ? fails + ' FAILED' : 'ALL PASS');
process.exit(fails ? 1 : 0);
