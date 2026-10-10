// Bottom sheet tests (fplgg/tools/matchweek/src/sheets/lock.js, src/main.js, the sheet CSS): Parker, 10 Oct 2026, on his
// iPhone: "the Home Screen was up high and I clicked on a player and it half rendered". The page behind a sheet is locked
// in place and comes back at exactly the position it had (even when the browser moved it meanwhile, as iOS does), the
// sheet is opaque and stays on its own layer once open, nothing inside a sheet blurs its backdrop, and the open sequence
// lays the sheet out before it slides in. Plain Node: lock.js runs in a vm with a small fake browser; main.js and the CSS
// are read as source. The browser half (a real scrolled page, a real sheet, Chromium at iPhone size) is
// fplgg/tools/matchweek/tools/check-sheets.js, not in the gate.   node tests/app-sheets.js
const fs = require('fs'), vm = require('vm');
let fails = 0;
const check = (label, cond, info) => { if (!cond) fails++; console.log((cond ? 'PASS ' : 'FAIL ') + label + (info ? '  ' + info : '')); };
const APP = __dirname + '/../fplgg/tools/matchweek/';
const src = fs.readFileSync(APP + 'src/sheets/lock.js', 'utf8').replace(/^export (function|const|let)/gm, '$1');
/* a fake browser: a window that scrolls, a body and an html element with inline styles, body.scrollTop that holds a value */
function browser(y) {
  const el = () => { const st = {}; const e = { style: st, attrs: {}, scrollTop: 0,
    getAttribute: k => (k === 'style' ? (e.attrs.style === undefined ? styleText(st) || null : e.attrs.style) : e.attrs[k] === undefined ? null : e.attrs[k]),
    setAttribute: (k, v) => { e.attrs[k] = v; if (k === 'style') { Object.keys(st).forEach(x => delete st[x]); v.split(';').forEach(d => { const i = d.indexOf(':'); if (i > 0) st[d.slice(0, i).trim()] = d.slice(i + 1).trim(); }); } },
    removeAttribute: k => { delete e.attrs[k]; if (k === 'style') Object.keys(st).forEach(x => delete st[x]); } }; return e; };
  const styleText = st => Object.keys(st).filter(k => st[k] !== '').map(k => k + ': ' + st[k]).join('; ');
  const w = { scrollY: y, calls: [] };
  const ctx = { console, Math, Object, window: w, document: { body: el(), documentElement: el() }, scrollTo: (x, yy) => { w.calls.push(yy); w.scrollY = yy; } };
  vm.createContext(ctx);
  vm.runInContext(src + '\n;this.__x = { locked, pageY, setPageY, lockPage, unlockPage };', ctx);
  return Object.assign({ w, ctx, body: ctx.document.body, html: ctx.document.documentElement }, ctx.__x);
}

console.log('--- the lock');
let B = browser(412);
check('nothing is locked at first; pageY reads the window', !B.locked() && B.pageY() === 412);
check('lockPage returns the position it saved and reports locked', B.lockPage() === 412 && B.locked());
check('the body becomes a fixed, non-scrolling box the size of the viewport, parked at the saved offset', B.body.style.position === 'fixed' && B.body.style.top === '0' && B.body.style.bottom === '0' && B.body.style.left === '0' && B.body.style.right === '0' && B.body.style.width === '100%' && B.body.style.overflow === 'hidden' && B.body.scrollTop === 412, JSON.stringify(B.body.style));
check('the root is overflow hidden too (desktop keeps its lock)', B.html.style.overflow === 'hidden');
check('the lock scrolls nothing itself (the window is not moved to make room)', B.w.calls.length === 0);
B.w.scrollY = 0;   /* a fixed body: the window reads 0 from here on, as a browser would */
check('pageY reads the saved position while locked, not the window', B.pageY() === 412);
check('a second lockPage (a second sheet on the stack) is a no-op that returns the same position', B.lockPage() === 412 && B.body.scrollTop === 412);
B.w.scrollY = 77;   /* what iOS did on Parker's phone: the page moved under the sheet */
B.unlockPage();
check('unlock restores the body and root styles', !B.locked() && !B.body.getAttribute('style') && B.body.style.position === undefined && B.html.style.overflow === '', JSON.stringify(B.body.attrs) + ' ' + JSON.stringify(B.body.style));
check('unlock scrolls the window to exactly the saved position, whatever it read meanwhile', B.w.calls.length === 1 && B.w.calls[0] === 412 && B.w.scrollY === 412);
check('a second unlock does nothing', (B.unlockPage(), B.w.calls.length === 1));
check('unlocked, pageY reads the window again', (B.w.scrollY = 5, B.pageY() === 5));

console.log('--- setPageY, what render() uses instead of scrollTo');
B = browser(0);
B.setPageY(300);
check('unlocked: setPageY scrolls the window', B.w.calls.join() === '300' && B.w.scrollY === 300);
B.lockPage(); B.w.scrollY = 0;
B.setPageY(250);
check('locked: setPageY moves the parked page (body.scrollTop) and what the unlock will restore, not the window', B.body.scrollTop === 250 && B.pageY() === 250 && B.w.calls.join() === '300');
B.unlockPage();
check('the unlock then restores the moved position', B.w.scrollY === 250);
B.setPageY(-20); check('a negative or missing position reads as 0', B.w.scrollY === 0 && (B.setPageY(undefined), B.w.scrollY === 0));
B = browser(10); B.body.setAttribute('style', 'color: red'); B.html.style.overflow = 'auto';
B.lockPage(); B.unlockPage();
check('inline styles the body and root had before the lock come back as they were', B.body.getAttribute('style') === 'color: red' && B.html.style.overflow === 'auto', B.body.getAttribute('style') + ' | ' + B.html.style.overflow);

console.log('--- main.js: the sheets use the lock');
const main = fs.readFileSync(APP + 'src/main.js', 'utf8');
check('main.js imports the lock', /import \{[^}]*lockPage[^}]*unlockPage[^}]*pageY[^}]*setPageY[^}]*locked[^}]*\} from '\.\/sheets\/lock\.js'/.test(main));
check('nothing in main.js touches documentElement.style.overflow any more (the lock owns it)', !/documentElement\.style\.overflow/.test(main));
const open = main.slice(main.indexOf('export function openSheet'), main.indexOf('function dropTop'));
const at = s => open.indexOf(s);
check('openSheet: the sheet is appended, the history entry pushed while the page still reads its true position, then the lock', at('document.body.append(scrim, sh)') > -1 && at('history.pushState') > at('document.body.append(scrim, sh)') && at('lockPage()') > at('history.pushState'));
check('openSheet: the sheet is laid out (getBoundingClientRect) after the lock and before the frame that slides it in', at('sh.getBoundingClientRect()') > at('lockPage()') && at("requestAnimationFrame(() => { scrim.classList.add('in'); sh.classList.add('in'); })") > at('sh.getBoundingClientRect()'));
const drop = main.slice(main.indexOf('function dropTop'), main.indexOf('export function closeSheet'));
check('dropTop unlocks the page only when the last sheet closes', /if \(!STACK\.length\) \{ unlockPage\(\);/.test(drop) && !/unlockPage/.test(drop.replace(/if \(!STACK\.length\) \{ unlockPage\(\);/, '')));
const render = main.slice(main.indexOf('export function render'), main.indexOf('/* ---------- sheets'));
check('render reads the page position through pageY and writes it through setPageY, never scrollY or scrollTo', /same \? pageY\(\) : 0/.test(render) && /setPageY\(SCROLLS\[location\.hash\]\)/.test(render) && !/scrollTo\(/.test(render) && !/[^.]scrollY/.test(render.replace(/pageY/g, '')));
check('the scroll listener records a position only while the page is not locked', /ST = setTimeout\(\(\) => \{ if \(!locked\(\)\) SCROLLS\[location\.hash\] = scrollY; \}, 120\)/.test(main));

console.log('--- the CSS: an opaque sheet on its own layer, no blur inside it');
const comp = fs.readFileSync(APP + 'src/css/02-components.css', 'utf8'), sheets = fs.readFileSync(APP + 'src/css/60-sheets.css', 'utf8'), tokens = fs.readFileSync(APP + 'src/css/01-tokens.css', 'utf8');
const sheetRule = (comp.match(/\n\.sheet\{[^]*?\}\n/) || [''])[0];
check('the sheet rule exists and its background is the base token', /background:var\(--base\)/.test(sheetRule), sheetRule.slice(0, 120));
const base = (tokens.match(/--base:\s*(#[0-9A-Fa-f]{6})\b/) || [])[1];
check('the base token is an opaque six-digit colour', !!base, base);
check('the sheet starts off screen and ends on its own layer: a 3D transform in both states, never transform:none', /transform:translate3d\(0,100%,0\)/.test(sheetRule) && /\.sheet\.in\{transform:translate3d\(0,0,0\)\}/.test(comp) && !/\.sheet\.in\{transform:none\}/.test(comp));
check('the sheet keeps its layer (will-change) and scrolls itself with momentum, containing its overscroll', /will-change:transform/.test(sheetRule) && /overflow-y:auto/.test(sheetRule) && /overscroll-behavior:contain/.test(sheetRule) && /-webkit-overflow-scrolling:touch/.test(sheetRule));
check('the sheet height uses dvh with a vh fallback (the iPhone toolbar)', /max-height:calc\(100vh - 28px - var\(--safe-t\)\);max-height:calc\(100dvh - 28px - var\(--safe-t\)\)/.test(sheetRule));
check('the search sheet min-height has the same dvh line', /\.sheet\.sk-search\{min-height:calc\(100vh[^}]*;min-height:calc\(100dvh/.test(sheets));
/* every rule scoped to a sheet (02-components .sheet rules, all of 60-sheets.css) is free of backdrop-filter */
const sheetRules = comp.slice(comp.indexOf('/* sheets (bottom sheet overlays) */'), comp.indexOf('/* toast */'));
check('no backdrop-filter in the sheet rules of 02-components.css (the close button is a plain translucent circle)', !/backdrop-filter/.test(sheetRules.replace(/\/\*[^]*?\*\//g, '')) && /\.sheet \.sheet-x\{[^}]*background:rgba\(14,10,19,\.72\)/.test(sheetRules));
check('no backdrop-filter anywhere in 60-sheets.css (the owner pill and the search bar are plain)', !/backdrop-filter/.test(sheets.replace(/\/\*[^]*?\*\//g, '')) && /\.sr-bar\{[^}]*background:var\(--base\)\}/.test(sheets) && /\.ps-own\{[^}]*background:rgba\(14,10,19,\.68\)/.test(sheets));
check('the fixed bars outside the sheets keep their blur (the top bar, the nav, the status strip)', (comp.match(/backdrop-filter:blur/g) || []).length >= 3);
check('the scrim is fixed, full screen, under the sheet', /\.scrim\{position:fixed;inset:0;z-index:60/.test(comp) && /\.sheet\{position:fixed;left:0;right:0;bottom:0;z-index:61/.test(comp));

console.log('--- the browser check is there and documented');
const chk = APP + 'tools/check-sheets.js';
check('fplgg/tools/matchweek/tools/check-sheets.js exists and prints ALL PASS on a clean run', fs.existsSync(chk) && /ALL PASS/.test(fs.readFileSync(chk, 'utf8')));
check('it checks the position before and after, the lock, the sheet covering its box, and the close by Back', (s => /before the sheet/.test(s) && /locked while the sheet is open/.test(s) && /covers its whole box/.test(s) && /closed with Back/.test(s))(fs.readFileSync(chk, 'utf8')));
check('CLAUDE.md names tests/app-sheets.js', /tests\/app-sheets\.js/.test(fs.readFileSync(__dirname + '/../CLAUDE.md', 'utf8')));

console.log(fails ? fails + ' FAILED' : 'ALL PASS');
process.exit(fails ? 1 : 0);
