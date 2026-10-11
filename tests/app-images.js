// Pictures that stay put (Parker, 11 Oct 2026, on his iPhone during a live gameweek, with a screenshot of a player sheet:
// "The images are still disappearing sporadically when I click into someone and when I scroll and what's this weird
// artifact by the rating area? Also some weird text poking through under the man city and Liverpool mini bubbles").
//  1. A live refresh (every 90 s while a match is on) redrew the page and the open sheet with innerHTML and threw every
//     <img> away; src/swap.js swapHTML moves each finished picture into the matching slot of the new markup instead, and
//     main.js uses it for the page and the sheet.
//  2. The Plate photos carry no CSS filter (a filtered image is a compositing layer of its own on iOS) and the sheet's
//     big Plate decodes its photo before it paints.
//  3. The club circle (sheets/kit.js cb) shows the club code only when there is no badge or it fails to load.
//  4. The rating's backing starts inside the card's inner keyline, its top left corner cut parallel to the card's, and
//     still covers the part of the figure the contrast audit reads; the light beam behind the sheet's Plate fades out.
// Plain Node: the functions run in a vm on small fakes, the CSS is read as source. The browser half (Chromium at
// iPhone size on the built demo: a refresh keeps every picture, the codes hidden, the backing's geometry) is
// fplgg/tools/matchweek/tools/check-images.js, not in the gate.   node tests/app-images.js
const fs = require('fs'), vm = require('vm');
let fails = 0;
const check = (label, cond, info) => { if (!cond) fails++; console.log((cond ? 'PASS ' : 'FAIL ') + label + (!cond && info ? '  ' + info : '')); };
const MW = __dirname + '/../fplgg/tools/matchweek/';
const rd = f => fs.readFileSync(MW + f, 'utf8');
const SWAP = rd('src/swap.js'), MAIN = rd('src/main.js'), KIT = rd('src/sheets/kit.js'), CORE = rd('core.gen.js'), PLAYER = rd('src/sheets/player.js');
const COMP = rd('src/css/02-components.css'), SHEETS = rd('src/css/60-sheets.css');
function lift(src, name) {
  const i = src.search(new RegExp('^(export )?(function ' + name + '\\(|const ' + name + ' ?=)', 'm')); if (i < 0) throw new Error('no ' + name);
  const start = src.slice(i).startsWith('export ') ? i + 7 : i;
  let depth = 0, j = src.indexOf('{', src.indexOf(')', start));
  for (; j < src.length; j++) { if (src[j] === '{') depth++; else if (src[j] === '}') { depth--; if (!depth) break; } }
  return src.slice(start, j + 1) + '\n';
}

console.log('--- 1. a redraw keeps the pictures that had loaded');
/* a fake container: innerHTML parses <img ...> tags into fake images, querySelectorAll('img') lists them in order */
function fakeImg(attrs) {
  const a = Object.assign({}, attrs);
  const img = { complete: false, naturalWidth: 0, loads: 0,
    get attributes() { return Object.keys(a).map(name => ({ name, value: a[name] })); },
    getAttribute: k => (k in a ? a[k] : null), hasAttribute: k => k in a,
    setAttribute: (k, v) => { if (k === 'src') img.loads++; a[k] = String(v); }, removeAttribute: k => { delete a[k]; },
    replaceWith: o => { const L = img.parent.kids, i = L.indexOf(img); L[i] = o; o.parent = img.parent; }, _a: a };
  return img;
}
function box() {
  const el = { kids: [], set innerHTML(h) { el.kids = []; const re = /<img ([^>]*)>/g; let m; while ((m = re.exec(h))) { const at = {}; m[1].replace(/([\w-]+)="([^"]*)"/g, (x, k, v) => { at[k] = v; }); const i = fakeImg(at); i.parent = el; el.kids.push(i); } },
    querySelectorAll: () => el.kids.slice() };
  return el;
}
const ctx = { Map }; vm.createContext(ctx);
vm.runInContext(SWAP.replace(/^export /gm, '') + '\n;this.swapHTML = swapHTML;', ctx);
const el = box();
el.innerHTML = '<img src="a.png" class="fpl" alt="A"><img src="b.png"><img src="c.png"><img src="a.png">';
const [a1, b1, c1, a2] = el.kids;
[a1, b1, a2].forEach(i => { i.complete = true; i.naturalWidth = 220; });   /* c.png is still loading */
const kept = ctx.swapHTML(el, '<img src="a.png" alt="A2" style="x"><img src="c.png"><img src="d.png"><img src="a.png" class="fpl"><img src="b.png">');
check('every loaded picture with a matching src is moved into the new markup (3 of 5 slots)', kept === 3 && el.kids[0] === a1 && el.kids[3] === a2 && el.kids[4] === b1, 'kept ' + kept);
check('a picture still loading is drawn anew, and a new src is a new image', el.kids[1] !== c1 && el.kids[2].getAttribute('src') === 'd.png');
check('the moved picture takes the new attributes (alt, style) and drops ones the new markup no longer has (class)', a1.getAttribute('alt') === 'A2' && a1.getAttribute('style') === 'x' && !a1.hasAttribute('class'));
check('the second copy of the same src gets its own old element, with the new class', a2.getAttribute('class') === 'fpl');
check('src is never set again on a kept picture (setting it is what makes the browser fetch it)', a1.loads === 0 && a2.loads === 0 && b1.loads === 0);
const el2 = box(); el2.innerHTML = '<img src="x.png">';
check('nothing loaded: the markup is simply replaced', ctx.swapHTML(el2, '<img src="x.png">') === 0 && el2.kids.length === 1);
check('main.js redraws the page and the open sheet through swapHTML, not innerHTML',
  /import \{ swapHTML \} from '\.\/swap\.js'/.test(MAIN) && /swapHTML\(app, staleBanner\(\) \+ demoTag\(\) \+ html \+ UI\.navBar\(r\.page, unread\)\)/.test(MAIN)
  && /swapHTML\(e\.sh, CHROME\(\) \+ b\)/.test(MAIN) && !/app\.innerHTML = staleBanner/.test(MAIN) && !/e\.sh\.innerHTML = CHROME\(\) \+ b/.test(MAIN));

console.log('--- 2. no filter on the Plate photos, the sheet\'s Plate decoded before it paints');
check('the Plate photo has no CSS filter (an override after the generated plate CSS)', /\.fc \.face img\{filter:none\}/.test(COMP));
check('the player sheet\'s Plate decodes its photo synchronously', /\.replace\(\/ decoding="async"\/g, ' decoding="sync"'\)/.test(PLAYER));

console.log('--- 3. the club code only stands in for a missing badge');
const kctx = { D: { clubs: { MCI: 43, LIV: 14 } }, CLUBDOM: {}, esc: s => String(s), clubName: c => ({ MCI: 'Man City', LIV: 'Liverpool' })[c] || c, Math, String };
vm.createContext(kctx);
vm.runInContext(lift(CORE, 'badgeImg') + '\n;this.badgeImg = badgeImg; this.UI = { badge: (c, px) => badgeImg(c, px) };', kctx);
vm.runInContext(lift(KIT, 'cb') + '\n;this.cb = cb;', kctx);
const city = kctx.cb('MCI', 18), none = kctx.cb('XXX', 18);
check('a circle with a badge is marked im and still carries the code for a failed load', /class="sk-cb im"/.test(city) && /<em>MCI<\/em>/.test(city) && /<img class="crest"/.test(city), city);
check('a club with no badge has no im mark, so its code shows', /class="sk-cb"/.test(none) && !/<img/.test(none));
/* the badge's own error handler: hides the image and takes the mark off the circle */
const cls = new Set(['sk-cb', 'im']), img = { style: {}, parentNode: { classList: { remove: c => cls.delete(c) } } };
const h = /onerror="([^"]*)"/.exec(city)[1];
const ectx = { __img: img }; vm.createContext(ectx); vm.runInContext('(function(){' + h + '}).call(__img)', ectx);
check('a badge that fails to load hides itself and shows the code', img.style.display === 'none' && !cls.has('im'), h);
check('the CSS hides the code inside a circle marked im', /\.sk-cb\.im em\{visibility:hidden\}/.test(SHEETS));

console.log('--- 4. the rating backing inside the card, the beam fading out');
/* card units: width 100 cqw, height 140 cqw (150 by 210). The rating box sits at top 7% of the height (9.8 cqw), left 12% */
const rt = /\.fc \.rt\{padding:([\d.]+)% ([\d.]+)% ([\d.]+)%;margin:-([\d.]+)% -([\d.]+)% -([\d.]+)%\}/.exec(COMP);
check('the rating box keeps its padding and margin in step', !!rt && rt[1] === rt[4] && rt[2] === rt[5] && rt[3] === rt[6], rt && rt[0]);
const top = 9.8 - (rt ? +rt[1] : 0), left = 12 - (rt ? +rt[2] : 0);
const KEY_TOP = (105 - 99 * .965) / 210 * 140;   /* the inner keyline: the plate path scaled .965 about its centre */
check('the backing starts below the card\'s inner keyline (' + top.toFixed(2) + ' cqw against ' + KEY_TOP.toFixed(2) + ')', top > KEY_TOP + .5);
check('and above the band of the figure the contrast audit reads (from 8.2 cqw with the real font)', top <= 7.9);
const cut = /\.fc \.rt::before\{[^}]*background:var\(--rtb\)[^}]*clip-path:polygon\(([\d.]+)cqw 0,100% 0,100% 100%,0 100%,0 ([\d.]+)cqw\)/.exec(COMP);
check('the backing is a ::before with its top left corner cut', !!cut && cut[1] === cut[2] && !/\.fc \.rt\{background:/.test(COMP));
check('the cut keeps the corner inside the keyline\'s own cut corner', !!cut && left + top + +cut[1] > 19.7, cut && (left + top + +cut[1]).toFixed(2));
check('the light beam behind the sheet\'s Plate fades out instead of ending in a line', /\.ps-beam\{[^}]*mask-image:linear-gradient\(#000 62%,transparent\)/.test(SHEETS));

console.log(fails ? fails + ' FAILED' : 'ALL PASS');
process.exit(fails ? 1 : 0);
