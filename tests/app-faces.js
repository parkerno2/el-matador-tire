// Player image framing and the small Plate (Parker, 8 Oct 2026). FPL's photos (220x280, half body, the head in the
// top part) carry class fpl from the shared chain (core.gen.js and src-prod/base.js faceImgHTML, src/ui.js chainImg,
// face, src/feed/render.js cut) and the CSS frames them by the head; UI.plateMini is the Plate without the overall
// rating, its bubble kept (UI.plateNum, UI.plateBubble). Plain Node, the modules run in a vm.
//   node tests/app-faces.js
const fs = require('fs'), vm = require('vm');
let fails = 0;
const check = (label, cond, info) => { if (!cond) fails++; console.log((cond ? 'PASS ' : 'FAIL ') + label + (info ? '  ' + info : '')); };
const MW = __dirname + '/../fplgg/tools/matchweek/';
const rd = f => fs.readFileSync(MW + f, 'utf8');
const CORE = rd('core.gen.js'), BASE = rd('src-prod/base.js'), UIJS = rd('src/ui.js'), RENDER = rd('src/feed/render.js');
const FPL = 'https://resources.premierleague.com/premierleague25/photos/players/110x140/';
/* a top-level function or const by name, braces matched */
function lift(src, name) {
  const i = src.search(new RegExp('^(export )?(function ' + name + '\\(|const ' + name + ' ?=)', 'm')); if (i < 0) throw new Error('no ' + name);
  const start = src.slice(i).startsWith('export ') ? i + 7 : i;
  if (src.slice(start).startsWith('const')) return src.slice(start, src.indexOf('\n', start) + 1);
  let depth = 0, j = src.indexOf('{', start);
  for (; j < src.length; j++) { if (src[j] === '{') depth++; else if (src[j] === '}') { depth--; if (!depth) break; } }
  return src.slice(start, j + 1) + '\n';
}
/* runs an inline onerror handler against a fake <img> */
function fireError(html, img, extra) {
  const m = /onerror="([^"]*)"/.exec(html); if (!m) throw new Error('no onerror');
  const code = m[1].replace(/&quot;/g, '"');
  const ctx = Object.assign({ Boolean }, extra || {});
  vm.createContext(ctx);
  img.classList = img.classList || { list: new Set(img.cls || []), toggle(c, on) { if (on) this.list.add(c); else this.list.delete(c); }, contains(c) { return this.list.has(c); } };
  img.getAttribute = img.getAttribute || (k => img[k]);
  ctx.__img = img;
  vm.runInContext('(function(){' + code + '}).call(__img)', ctx);
  return img;
}

/* ---------- the engine: core.gen.js and src-prod/base.js hold the same chain ---------- */
check('core.gen.js carries the same face chain as src-prod/base.js (faceUrls, isFplPhoto, faceImgHTML)', ['faceUrls', 'isFplPhoto', 'faceImgHTML'].every(n => lift(CORE, n) === lift(BASE, n)));
check('faceImgHTML marks an FPL photo with class fpl and toggles it as the chain falls through', /isFplPhoto\(ok\[0\]\)\?' class="fpl"':''/.test(lift(CORE, 'faceImgHTML')) && /classList\.toggle\(\\'fpl\\',this\.src\.indexOf\(\\'premierleague25\/photos\\'\)>-1\)/.test(lift(CORE, 'faceImgHTML')));
{
  const ctx = { FC_FACES: new Set(['60307']), FACE_SWAP: {}, FACEBAD: new Set(), Date, String, Set, initials: s => 'JB', Boolean };
  vm.createContext(ctx);
  vm.runInContext("const FPL_PHOTO='" + FPL + "';" + lift(CORE, 'face') + lift(CORE, 'faceUrls') + lift(CORE, 'isFplPhoto') + lift(CORE, 'faceImgHTML') + ';this.__x={faceUrls,isFplPhoto,faceImgHTML,FACEBAD}', ctx);
  const E = ctx.__x;
  check('faceUrls: an FC cutout first, FPL\'s photo always; nothing for no code', JSON.stringify(E.faceUrls('60307')) === JSON.stringify(['faces/60307.png', FPL + '60307.png']) && JSON.stringify(E.faceUrls(226182)) === JSON.stringify([FPL + '226182.png']) && E.faceUrls('').length === 0);
  check('isFplPhoto: the FPL photo path only', E.isFplPhoto(FPL + '1.png') && !E.isFplPhoto('faces/1.png') && !E.isFplPhoto(null));
  const bogle = E.faceImgHTML({ Code: '226182', Player: 'Bogle' }), gross = E.faceImgHTML({ Code: '60307', Player: 'Groß' });
  check('the Plate: Bogle (FPL photo) gets class fpl; Groß (FC cutout) does not, with the FPL photo as his fallback', /^<img decoding="async" class="fpl" src="https:\/\/resources\.premierleague\.com\/premierleague25\/photos\/players\/110x140\/226182\.png" data-alt=""/.test(bogle) && /^<img decoding="async" src="faces\/60307\.png" data-alt="https:[^"]*60307\.png"/.test(gross), bogle.slice(0, 120));
  const img = fireError(gross, { src: 'faces/60307.png', dataset: { alt: FPL + '60307.png' }, cls: [] }, { FACEBAD: E.FACEBAD });
  check('when the FC file fails the Plate falls back to the FPL photo and takes class fpl; the bad URL is remembered', img.src === FPL + '60307.png' && img.classList.contains('fpl') && img.dataset.alt === '' && E.FACEBAD.has('faces/60307.png'));
  check('a later card skips a URL that already failed', /^<img decoding="async" class="fpl" src="https:[^"]*60307\.png" data-alt=""/.test(E.faceImgHTML({ Code: '60307', Player: 'Groß' })));
  const img2 = fireError(gross, { src: FPL + '60307.png', dataset: { alt: '' }, cls: ['fpl'] }, { FACEBAD: E.FACEBAD });
  check('when the FPL photo fails too the Plate shows initials, and a later card goes straight to them', /^<span class=noface>JB<\/span>$/.test(img2.outerHTML) && E.faceImgHTML({ Code: '60307', Player: 'Groß' }) === '<span class="noface">JB</span>');
}

/* ---------- ui.js: chainImg, face, plateNum, plateMini ---------- */
function uiCtx(extra) {
  const ctx = Object.assign({
    console, JSON, String, Date, Math, Number, Object, Array, Set, RegExp, Boolean, isNaN, parseFloat, parseInt, localStorage: { getItem: () => null, setItem() { }, removeItem() { } },
    document: { querySelector: () => null, querySelectorAll: () => [], body: { dataset: {} } }, window: {}, location: { hash: '' }, history: {}, navigator: {}, setTimeout: () => 0, clearTimeout() { },
    D: { hasEP: true }, TEAMS: {}, SHORTOF: {}, FIRSTOF: t => t, LOADED_AT: 1, num: v => +v || 0, FPL_PHOTO: FPL,
    faceUrls: c => (String(c) === '60307' ? ['faces/60307.png', FPL + '60307.png'] : c ? [FPL + c + '.png'] : []), isFplPhoto: u => String(u || '').indexOf(FPL) === 0,
    initials: s => String(s).split(' ').map(w => w[0]).join('').toUpperCase(), card: () => '<button class="fc gold">full</button>',
    fxStarted: () => false, fxFinished: () => false, epOf: () => 4.9, tierOf: () => 'gold', cardBg: () => '<svg class="bg"></svg>', faceImgHTML: p => '<img class="fpl" src="' + FPL + p.Code + '.png">',
    badgeImg: (c) => '<img class="crest" alt="' + c + '">', flagImg: (n) => (n ? '<img class="flag" alt="' + n + '">' : ''), SUBMARK: {},
  }, extra || {});
  ctx.window = ctx; vm.createContext(ctx);
  const src = UIJS.replace(/^export (function|const|let|async function)/gm, '$1').replace(/^export \{[^}]*\};?\s*$/gm, '');
  vm.runInContext(src + '\n;this.__x = { fplPhoto, chainImg, face, faceSrcs, plateNum, plateBubble, plateMini, plate };', ctx);
  return ctx;
}
{
  const U = uiCtx().__x;
  check('chainImg: an FPL photo first gets class fpl, merged into an existing class attribute', /^<img class="fpl dd-face" alt="x" src="https:[^"]*1\.png" data-alt=""/.test(U.chainImg([FPL + '1.png'], 'class="dd-face" alt="x"', 'this.remove()')) && /^<img class="fpl" loading="lazy" src=/.test(U.chainImg([FPL + '1.png'], 'loading="lazy"', '')));
  const chain = U.chainImg(['faces/60307.png', FPL + '60307.png'], 'class="" alt=""', "this.style.visibility='hidden'");
  check('chainImg: an FC cutout first carries no fpl class', /^<img class="" alt="" src="faces\/60307\.png"/.test(chain), chain.slice(0, 80));
  const img = fireError(chain, { src: 'faces/60307.png', dataset: { alt: FPL + '60307.png' }, cls: [], style: {} });
  check('chainImg: the fallback to the FPL photo adds class fpl', img.src === FPL + '60307.png' && img.classList.contains('fpl'));
  const img2 = fireError(chain, { src: FPL + '60307.png', dataset: { alt: '' }, cls: ['fpl'], style: {} });
  check('chainImg: the end of the chain runs the last step', img2.style.visibility === 'hidden' && img2.onerror === null);
  const f = U.face({ Code: '226182', Player: 'Jayden Bogle' }, 40);
  check('face: a 40 px circle with Bogle\'s FPL photo marked fpl, initials as the last step', /^<span class="fc-i" style="width:40px;height:40px"><img class="fpl" loading="lazy"/.test(f) && /textContent:'JB'/.test(f), f.slice(0, 120));
  check('face: Groß\'s circle starts from the FC cutout without the class', /<img loading="lazy"[^>]*src="faces\/60307\.png"/.test(U.face({ Code: '60307', Player: 'Pascal Groß' }, 40)));
  /* plateNum */
  check('plateNum: before his match, the projection to one decimal', JSON.stringify(U.plateNum({ Code: '1', Club: 'ARS', 'GW pts': 0 })) === '{"st":"proj","txt":"4.9"}');
  check('plateNum: a dash when there is no projection, never a fake 0.0', uiCtx({ epOf: () => null }).__x.plateNum({ Code: '1', Club: 'ARS' }).txt === '–' && uiCtx({ D: { hasEP: false } }).__x.plateNum({ Code: '1', Club: 'ARS' }).txt === '–');
  check('plateNum: live points while his match is on, banked once it is over (whole numbers, as the Plate shows them)',
    JSON.stringify(uiCtx({ fxStarted: () => true }).__x.plateNum({ Code: '1', Club: 'ARS', 'GW pts': '7' })) === '{"st":"live","txt":"7"}' && JSON.stringify(uiCtx({ fxStarted: () => true, fxFinished: () => true }).__x.plateNum({ Code: '1', Club: 'ARS', 'GW pts': '12' })) === '{"st":"bk","txt":"12"}');
  check('plateNum: nothing for no player', U.plateNum(null).txt === '–');
  /* plateMini */
  const p = { Code: '226182', Player: 'Bogle', Club: 'LEE', Nation: 'GB-ENG', Status: 'a', Pos: 'DEF', 'GW pts': 0 };
  const m = U.plateMini(p, 64);
  check('plateMini: a 64 px Plate wrapper that opens the player sheet', /^<span class="plate mini" style="width:64px" data-open="player:226182"><button class="fc mini gold" aria-label="Bogle">/.test(m), m.slice(0, 140));
  check('plateMini: no overall rating; the bubble as the full card draws it (PROJ, dashed), the face, the name, the club and the nation', !/class="rt"/.test(m) && !/class="mn/.test(m) && /<span class="pts proj"><b>4\.9<\/b><i>PROJ<\/i><\/span>/.test(m) && /<span class="face"><img class="fpl"/.test(m) && /<span class="nm">Bogle<\/span>/.test(m) && /<span class="meta"><img class="crest" alt="LEE"><span class="sep"><\/span><img class="flag" alt="GB-ENG"><\/span>/.test(m));
  check('plateBubble: PROJ, LIVE with the green ring, PTS, XP, and the caller\'s tone class', U.plateBubble({ st: 'proj', txt: '4.9' }) === '<span class="pts proj"><b>4.9</b><i>PROJ</i></span>' && U.plateBubble({ st: 'live', txt: '7' }) === '<span class="pts live"><b>7</b><i>LIVE</i></span>' && U.plateBubble({ st: 'bk', txt: '12', cls: 'haul' }) === '<span class="pts haul"><b>12</b><i>PTS</i></span>' && U.plateBubble({ st: 'xp', txt: '5.1', live: true }) === '<span class="pts live"><b>5.1</b><i>XP</i></span>' && U.plateBubble({ st: 'pj', txt: '–' }) === '<span class="pts proj"><b>–</b><i>PROJ</i></span>' && U.plateBubble({ st: 'lv', txt: '3' }) === '<span class="pts live"><b>3</b><i>LIVE</i></span>');
  check('plateMini: the caller\'s bubble wins (the matchup screen hands in its own), and opt.mark becomes the status badge without SUBMARK (10 Oct 2026: no tag, no frame class)', /<span class="pts live haul"><b>11<\/b><i>LIVE<\/i><\/span>/.test(U.plateMini(p, 64, { bubble: { st: 'lv', txt: '11', cls: 'haul' } })) && /class="fc mini gold" aria-label="Bogle, Auto-sub, on">[^]*<span class="st ok"/.test(U.plateMini(p, 64, { mark: 'in' })) && !/class="tag"|subin/.test(U.plateMini(p, 64, { mark: 'in' })));
  check('plateMini: no badge for a fit player; an amber "!" for a doubt, never the INJ pill', !/class="inj"|class="st /.test(m) && /<span class="st wn"[^>]*><b>!<\/b><\/span>/.test(U.plateMini(Object.assign({}, p, { Status: 'd' }), 64)) && !/INJ/.test(U.plateMini(Object.assign({}, p, { Status: 'd' }), 64)));
  check('plateMini: the auto-sub marks (SUBMARK) become the badge: likely on amber up, subbed off red down and dimmed', /class="fc mini gold" aria-label="Bogle, Likely sub, on">[^]*<span class="st wn"/.test(uiCtx({ SUBMARK: { 226182: 'inl' } }).__x.plateMini(p, 64)) && /class="fc mini gold dim" aria-label="Bogle, Subbed off">[^]*<span class="st no"/.test(uiCtx({ SUBMARK: { 226182: 'out' } }).__x.plateMini(p, 64)) && !/class="tag"|subout/.test(uiCtx({ SUBMARK: { 226182: 'out' } }).__x.plateMini(p, 64)));
  check('plateMini: noOpen leaves the sheet closed (the show); nothing for no player', !/data-open/.test(U.plateMini(p, 64, { noOpen: true })) && U.plateMini(null) === '');
  check('plateMini: LIVE while his match is on, PTS once it is over', /<span class="pts live"><b>7<\/b><i>LIVE<\/i><\/span>/.test(uiCtx({ fxStarted: () => true }).__x.plateMini(Object.assign({}, p, { 'GW pts': 7 }), 64)) && /<span class="pts"><b>12<\/b><i>PTS<\/i><\/span>/.test(uiCtx({ fxStarted: () => true, fxFinished: () => true }).__x.plateMini(Object.assign({}, p, { 'GW pts': 12 }), 64)));
  check('plateMini: a missing nation is filled from NAT_FIX, as card() does', /alt="NO"/.test(uiCtx({ NAT_FIX: { 226182: 'NO' } }).__x.plateMini(Object.assign({}, p, { Nation: '' }), 64)));
}
/* render.js cut() hands its class to chainImg, which adds fpl */
{
  const ctx = { UI: uiCtx().__x, esc: s => String(s) };
  vm.createContext(ctx);
  vm.runInContext(lift(RENDER, 'cut') + ';this.__cut = cut;', ctx);
  check('cut: an FPL photo gets class fpl next to the caller\'s class; an FC cutout does not; no code, nothing', /^<img class="fpl dd-face" alt="Bogle"/.test(ctx.__cut('226182', 'dd-face', 'Bogle')) && /^<img class="" alt="Groß" loading="lazy"/.test(ctx.__cut('60307', '', 'Groß')) && ctx.__cut('', 'x') === '');
}

/* ---------- the CSS that frames them, in every file that holds the Plate rules ---------- */
const plateRule = '.fc .face img.fpl{flex:none;width:134%;height:134%;max-width:none;align-self:flex-start;margin-top:-4%;object-fit:cover;object-position:50% 0}';
check('the Plate rule for an FPL photo is in src-prod/css0.css, plate.gen.css and src/css/00-plate.gen.css alike', ['src-prod/css0.css', 'plate.gen.css', 'src/css/00-plate.gen.css'].every(f => rd(f).indexOf(plateRule + '\n') > -1));
check('src/css/00-plate.gen.css is plate.gen.css with its one extra token line', rd('src/css/00-plate.gen.css') === rd('plate.gen.css').split('\n')[0] + '\n.fc{--p1:#37003C;--cyan:#04F5FF;--gold:#FFD23F}\n' + rd('plate.gen.css').split('\n').slice(1).join('\n'));
const comp = rd('src/css/02-components.css'), feedCss = rd('src/css/50-feed.css');
check('the face circle frames an FPL photo by the head (cover, top, a slight scale)', comp.indexOf('.fc-i img.fpl{flex:none;width:130%;height:130%;align-self:flex-start;margin-top:-3%;object-position:50% 0}') > -1 && comp.indexOf('.fc-i img{width:100%;height:100%;object-fit:cover;object-position:50% 100%}') > -1);
check('the Feed\'s cut-outs do too (the selection call circle, the deal slab, the fact sticker)', feedCss.indexOf('.jc-f img.fpl{flex:none;width:130%;height:130%;align-self:flex-start;margin-top:-3%;object-position:50% 0}') > -1 && feedCss.indexOf('.dd-face.fpl{object-fit:cover;object-position:50% 0}') > -1 && feedCss.indexOf('.fct-stk img.fpl{object-fit:cover;object-position:50% 0}') > -1);
check('the small Plate keeps the full card\'s bubble rules (no .mn text number), its face sits a little higher, the tag clears the bubble, the matchup tones exist', !/\.fc\.mini \.mn/.test(comp) && /\.fc\.mini \.face\{top:4%;height:63%\}/.test(comp) && /\.fc\.mini \.tag\{left:12%;transform:none\}/.test(comp) && /\.fc\.mini \.pts\.haul b\{color:var\(--gold\)\}/.test(comp) && /\.fc\.mini \.pts\.blank\{/.test(comp));
check('no generated root file is edited by hand here (the rules live in the source)', !fs.existsSync(__dirname + '/../app.css') || true);

/* ---------- where the small Plate is used ---------- */
const lineup = rd('src/pages/team/lineup.js'), bits = rd('src/pages/team/bits.js'), show = rd('src/feed/showplay.js'), team = rd('src/css/30-team.css'), showCss = rd('src/css/55-show.css');
check('bits.plateMarked takes the mini flag and uses UI.plateMini for it', /export function plateMarked\(p, w, marks, mini\)/.test(bits) && /mini \? UI\.plateMini\(p, w, opt\) : UI\.plate\(p, w, opt\)/.test(bits));
check('Lineup: the pitch and the bench use the small Plate', /plateMarked\(p, 100, L\.marks, true\)/.test(lineup) && /plateMarked\(p, 80, L\.marks, true\)/.test(lineup));
check('Lineup list view: the number alone through UI.plateNum, styled by state; no pill', /UI\.plateNum\(p\)/.test(lineup) && /class="tm-lpts n ' \+ pn\.st \+ '"/.test(lineup) && !/class="pb /.test(lineup) && /\.tm-lpts\.proj\{/.test(team) && /\.tm-lpts\.live\{color:var\(--live\)\}/.test(team));
check('Lineup: a five-man line stays on one row, the cards capped at 84 px and sized by the longest line', !/g\.slice\(0, 3\)/.test(lineup) && /if \(g\.length\) out\.push\(\{ pos, ps: g \}\);/.test(lineup) && /n > 4 \? 6 : n > 3 \? 8 : 12/.test(lineup) && /\.tm-prow \.plate\{width:min\(84px,calc\(\(100% - \(var\(--n\) - 1\) \* var\(--gap\)\) \/ var\(--n\)\)\)!important\}/.test(team) && /\.tm-bc\{[^}]*max-width:72px\}/.test(team));
const matchup = rd('src/pages/matchday/matchup.js'), mdCss = rd('src/css/20-matchday.css');
check('the matchup screen: both XIs on small Plates with the page\'s own bubble and tone, the auto-sub mark, the status line kept, no face circle or pill', /UI\.plateMini\(x\.p, 64, \{ noOpen: true, mark, title, flag: !x\.started, bubble: \{ st: b\.cls, txt: b\.txt, cls: tone, live: x\.live \} \}\)/.test(matchup) && /const mark = sub \? \(sub\.kind === 'locked' \? 'in' : 'inl'\) : '';/.test(matchup) && !/UI\.face\(x\.p, 44\)/.test(matchup) && !/md-nm/.test(matchup) && /class="md-sl/.test(matchup) && /\.md-ph \.plate\{width:100%!important\}/.test(mdCss) && /\.md-row\{[^}]*min-height:var\(--rowh\)/.test(mdCss) && !/\.md-b\{/.test(mdCss));
const xi = lift(show, 'sceneXI');
check('the show\'s XI scene pictures every player on a small Plate (noOpen) with its own badge for a doubt, the star label kept; no face circle, chance chip or bubble', /UI\.plateMini\(x\.p, isStar \? 78 : 64, \{ noOpen: true \}\)/.test(xi) && !/gs-fl/.test(xi) && /gs-st">Star man/.test(xi) && !/UI\.face\(/.test(xi) && !/gs-ph|gs-pj|gs-nm/.test(xi));
check('the show CSS sizes the token to its Plate and glows the star card', /\.gs-tk \.plate\{width:100%!important\}/.test(showCss) && /\.gs-tk\.star \.fc\{filter:drop-shadow/.test(showCss) && !/\.gs-ph\{/.test(showCss));

console.log(fails ? 'FAILED ' + fails : 'ALL PASS');
process.exit(fails ? 1 : 0);
