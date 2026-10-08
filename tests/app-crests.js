// The Lineup list view's club crests (Parker, 8 Oct 2026: "the lineup list screen should have the badge of the player
// or of the club that they're playing"). My team > Lineup, List (listRow in src/pages/team/lineup.js, the XI and the
// bench) shows the player's club crest before the club's short name and the opponent's crest inside the fixture chip in
// all three states (the difficulty chip from oppChip, the live score, the final score); both come from the engine's
// badgeImg (the PL badge the Plates wear, through UI.badge), which hides itself when the image fails so the text stays.
// Plain Node, the modules run in a vm.
//   node tests/app-crests.js
const fs = require('fs'), vm = require('vm');
let fails = 0;
const check = (label, cond, info) => { if (!cond) fails++; console.log((cond ? 'PASS ' : 'FAIL ') + label + (!cond && info ? '  ' + info : '')); };
const MW = __dirname + '/../fplgg/tools/matchweek/';
const rd = f => fs.readFileSync(MW + f, 'utf8');
const CORE = rd('core.gen.js'), UIJS = rd('src/ui.js'), LINEUP = rd('src/pages/team/lineup.js'), BITS = rd('src/pages/team/bits.js'), TEAMCSS = rd('src/css/30-team.css');
const PL = 'https://resources.premierleague.com/premierleague/badges/50/t';
/* a top-level function or const by name, braces matched */
function lift(src, name) {
  const i = src.search(new RegExp('^(export )?(function ' + name + '\\(|const ' + name + ' ?=)', 'm')); if (i < 0) throw new Error('no ' + name);
  const start = src.slice(i).startsWith('export ') ? i + 7 : i;
  const line = src.slice(start, src.indexOf('\n', start) + 1);
  if (src.slice(start).startsWith('const') && !/=>\s*\{\s*$/.test(line)) return line;
  let depth = 0, j = src.indexOf('{', src.indexOf(')', start)); /* the body's brace, past a default parameter's */
  for (; j < src.length; j++) { if (src[j] === '{') depth++; else if (src[j] === '}') { depth--; if (!depth) break; } }
  return src.slice(start, j + 1) + '\n';
}
/* runs an inline onerror handler against a fake <img> */
function fireError(html, img) {
  const m = /onerror="([^"]*)"/.exec(html); if (!m) throw new Error('no onerror');
  const ctx = { __img: img }; vm.createContext(ctx);
  vm.runInContext('(function(){' + m[1].replace(/&quot;/g, '"') + '}).call(__img)', ctx);
  return img;
}
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* ---------- the engine's badgeImg: the PL badge by the Clubs tab's code, hidden when it fails ---------- */
const CLUBS = { ARS: '3', LEE: '2', NFO: '17', CRY: '31', MCI: '43' };
function engine() {
  const ctx = { D: { clubs: CLUBS }, CLUBDOM: {}, esc }; vm.createContext(ctx);
  vm.runInContext(lift(CORE, 'badgeImg') + ';this.__badge = badgeImg;', ctx);
  return ctx.__badge;
}
const badgeImg = engine();
{
  const b = badgeImg('ARS', 16);
  check('badgeImg: the PL badge from the Clubs tab\'s code, at the size asked, and it hides itself on error', b === '<img class="crest" style="height:16px" decoding="async" src="' + PL + '3.png" alt="ARS" onerror="this.style.display=\'none\'">', b);
  check('badgeImg: nothing for a club the Clubs tab does not know (and no favicon without a domain)', badgeImg('XYZ', 16) === '');
  const img = fireError(b, { style: {} });
  check('when the crest fails to load it disappears (display none); the markup around it stays', img.style.display === 'none');
  check('UI.badge is the engine\'s badgeImg', /^export const badge = \(c, px = 18\) => badgeImg \? badgeImg\(c, px\) : '';$/m.test(UIJS));
}

/* ---------- oppChip (bits.js): the crest only when asked, so the Transfers page keeps its chip ---------- */
function bitsCtx() {
  const ctx = { esc, UI: { badge: badgeImg }, clubName: c => ({ ARS: 'Arsenal', LEE: 'Leeds', CRY: 'Crystal Palace', MCI: 'Man City' }[c] || c), fdrOf: () => 3, FDRLAB: { 3: 'Average' } };
  vm.createContext(ctx);
  vm.runInContext(lift(BITS, 'fdK') + lift(BITS, 'oppChip') + ';this.__x = { oppChip };', ctx);
  return ctx.__x;
}
const B = bitsCtx();
const fx = { GW: 6, Home: 'ARS', Away: 'LEE' };
{
  const plain = B.oppChip('ARS', fx), crest = B.oppChip('ARS', fx, { crest: 14 });
  check('oppChip without the option is exactly as before: no image in the chip', plain === '<span class="tm-fd fd-n" title="Leeds (H), average"><b>LEE</b><i>H</i></span>', plain);
  check('oppChip with crest: the opponent\'s crest at that size just before the short name, the difficulty class and title kept', crest === '<span class="tm-fd fd-n" title="Leeds (H), average"><img class="crest" style="height:14px" decoding="async" src="' + PL + '2.png" alt="LEE" onerror="this.style.display=\'none\'"><b>LEE</b><i>H</i></span>', crest);
  check('oppChip with crest, away: the home side\'s crest', /src="[^"]*t3\.png" alt="ARS"[^>]*><b>ARS<\/b><i>A<\/i>/.test(B.oppChip('LEE', fx, { crest: 14 })));
  check('the Transfers page still calls oppChip without a crest (unchanged)', /oppChip\(p\.Club, nf\)/.test(rd('src/pages/team/transfers.js')));
}

/* ---------- listRow (lineup.js): the XI and the bench rows ---------- */
function rowCtx(g) {
  const ctx = {
    esc, UI: { badge: badgeImg, face: () => '<span class="fc-i"></span>', plateNum: () => ({ st: 'proj', txt: '4.9' }), statusChip: () => '' },
    POSN: { GKP: 'GK', DEF: 'DEF', MID: 'MID', FWD: 'FWD' }, flaggedOut: () => false, gwFix: () => g, oppChip: B.oppChip,
  };
  vm.createContext(ctx);
  vm.runInContext(lift(LINEUP, 'CREST') + lift(LINEUP, 'listRow') + ';this.__row = listRow;', ctx);
  return ctx.__row;
}
const raya = { Code: '1', Player: 'Raya', Pos: 'GKP', Club: 'ARS', Status: 'a' }, L = { marks: {} };
const crests = html => [...html.matchAll(/<img class="crest" style="height:(\d+)px"[^>]*src="[^"]*\/t(\d+)\.png" alt="([A-Z]+)"[^>]*onerror="this\.style\.display='none'">/g)].map(m => m[3] + ':' + m[2] + '@' + m[1]);
{
  check('listRow sizes the crests at 16 px (the club) and 14 px (the opponent)', /^const CREST = 16, OPP_CREST = 14;$/m.test(LINEUP));
  const up = rowCtx({ f: fx, home: true, opp: 'LEE', started: false, done: false, sc: '', min: 0, dbl: false })(raya, L);
  check('upcoming: the club\'s crest before its short name in the meta line ("GK · [crest] ARS") and the opponent\'s inside the difficulty chip', crests(up).join(' ') === 'ARS:3@16 LEE:2@14' && /<span class="sub tm-lmeta">GK · <img class="crest" style="height:16px"[^>]*alt="ARS"[^>]*>ARS<\/span>/.test(up) && /<span class="tm-lopp"><span class="tm-fd fd-n"[^>]*><img class="crest" style="height:14px"[^>]*alt="LEE"[^>]*><b>LEE<\/b><i>H<\/i><\/span><\/span>/.test(up), up);
  const live = rowCtx({ f: fx, home: true, opp: 'LEE', started: true, done: false, sc: '2–1', min: 67, dbl: false })(raya, L);
  check('live: the opponent\'s crest before its name in the live score, the minute kept', crests(live).join(' ') === 'ARS:3@16 LEE:2@14' && /<span class="tm-lsc on"><img class="crest" style="height:14px"[^>]*alt="LEE"[^>]*><b>LEE<\/b> H <span class="n">2–1<\/span> <span class="live-c n">67′<\/span><\/span>/.test(live), live);
  const ft = rowCtx({ f: fx, home: false, opp: 'LEE', started: true, done: true, sc: '1–2', min: 90, dbl: false })(raya, L);
  check('full time: the same crest before the final score', crests(ft).join(' ') === 'ARS:3@16 LEE:2@14' && /<span class="tm-lsc"><img class="crest" style="height:14px"[^>]*alt="LEE"[^>]*><b>LEE<\/b> A <span class="n">1–2<\/span><\/span>/.test(ft), ft);
  const blank = rowCtx({ blank: true })(raya, L);
  check('a blank gameweek: the club\'s crest only, the BLANK chip as it was', crests(blank).join(' ') === 'ARS:3@16' && /<span class="tm-lopp"><span class="tm-fd blank">BLANK<\/span><\/span>/.test(blank), blank);
  const dgw = rowCtx({ f: fx, home: true, opp: 'LEE', started: false, done: false, sc: '', min: 0, dbl: true })(raya, L);
  check('a double gameweek keeps its DGW tag after the chip', /<\/span><span class="tm-dgw">DGW<\/span><\/span>/.test(dgw));
  const bench = rowCtx({ f: fx, home: true, opp: 'LEE', started: false, done: false, sc: '', min: 0, dbl: false })(raya, L, '1st', false);
  check('a bench row (slot label) carries the same two crests; the slot, the face, the number alone and no pill are as before', crests(bench).join(' ') === 'ARS:3@16 LEE:2@14' && /^<div class="row tap tm-lr" data-open="player:1" role="button" tabindex="0"><span class="tm-lslot n">1st<\/span><span class="fc-i"><\/span><span class="tm-lm">/.test(bench) && /<span class="tm-lpts n proj" title="Projected points">4\.9<\/span><\/div>$/.test(bench) && !/class="pb /.test(bench), bench);
  const unknown = rowCtx({ f: { GW: 6, Home: 'XYZ', Away: 'QQQ' }, home: true, opp: 'QQQ', started: false, done: false, sc: '', min: 0, dbl: false })(Object.assign({}, raya, { Club: 'XYZ' }), L);
  check('a club without a code shows its short names with no image at all, never a broken one', crests(unknown).length === 0 && !/<img/.test(unknown) && /GK · XYZ<\/span>/.test(unknown) && /<b>QQQ<\/b><i>H<\/i>/.test(unknown), unknown);
}

/* ---------- the CSS: the crest sits in the meta line without growing it, and inline in the score ---------- */
check('the meta line\'s crest keeps the row at its height (negative vertical margin); the score\'s crest is aligned to the text', TEAMCSS.indexOf('.tm-lmeta img.crest{margin:-2px 0}\n') > -1 && TEAMCSS.indexOf('.tm-lsc img.crest{vertical-align:-3px;margin-right:3px}\n') > -1);
check('the meta line and the chip lay their crest out as flex items, centred', /\.tm-lmeta\{display:flex;align-items:center;gap:5px;white-space:nowrap\}/.test(TEAMCSS) && /\.tm-fd\{display:inline-flex;align-items:center;justify-content:center;gap:3px;/.test(TEAMCSS));

console.log(fails ? 'FAILED ' + fails : 'ALL PASS');
process.exit(fails ? 1 : 0);
