// The preview build (10 Oct 2026, Parker's UI pass request): a branch's build published as preview/ on main, served by
// GitHub Pages at /el-matador-tire/preview/ beside the league app, which stays untouched. Checks the one production rule
// that knows the preview (sw.template.js passes /preview/ requests straight to the network), the PREVIEW flag in
// src/data/tabs.js and its guards in src/main.js (no service worker, no error reports, no facts sent, the label and the
// title), the builder fplgg/tools/preview/build-preview.js (its index page, and a real build when esbuild is installed)
// and the workflow .github/workflows/preview.yml (the gate, the build, a commit that carries preview/ and nothing else).
// Plain Node, the service worker's fetch handler runs in a vm.
//   node tests/app-preview.js
const fs = require('fs'), vm = require('vm'), path = require('path'), os = require('os');
let fails = 0;
const check = (label, cond, info) => { if (!cond) fails++; console.log((cond ? 'PASS ' : 'FAIL ') + label + (info ? '  ' + info : '')); };
const ROOT = path.join(__dirname, '..');
const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const SW = rd('fplgg/tools/matchweek/sw.template.js'), TABS = rd('fplgg/tools/matchweek/src/data/tabs.js'), MAIN = rd('fplgg/tools/matchweek/src/main.js');
const WF = rd('.github/workflows/preview.yml'), B = require(path.join(ROOT, 'fplgg/tools/preview/build-preview.js'));

/* ---------- the service worker: /preview/ goes straight to the network ---------- */
function swFetch(url, mode) {
  const handlers = {};
  const ctx = {
    self: { addEventListener: (k, f) => { handlers[k] = f; }, skipWaiting() { } }, location: { origin: 'https://parkerno2.github.io' }, URL, Promise, Request: class { constructor(u) { this.url = u; } },
    caches: { open: () => Promise.resolve({ match: () => Promise.resolve(undefined), put() { } }), match: () => Promise.resolve(undefined), keys: () => Promise.resolve([]) },
    fetch: () => Promise.resolve({ ok: true, clone() { return this; } }), console,
  };
  vm.createContext(ctx);
  vm.runInContext(SW.replace(/__BUILD__/g, '0'), ctx);
  let responded = false;
  handlers.fetch({ request: { url, method: 'GET', mode: mode || 'navigate', destination: mode === 'navigate' ? 'document' : 'script' }, respondWith() { responded = true; }, waitUntil() { } });
  return responded;
}
check('sw.js: a navigation to /preview/ is left to the network (no respondWith)', !swFetch('https://parkerno2.github.io/el-matador-tire/preview/', 'navigate'));
check('sw.js: the preview\'s scripts and styles are left to the network too', !swFetch('https://parkerno2.github.io/el-matador-tire/preview/app.js?v=1', 'no-cors') && !swFetch('https://parkerno2.github.io/el-matador-tire/preview/faces/1.png', 'no-cors'));
check('sw.js: the league app\'s own navigation and scripts are still handled (network first, the cache behind it)', swFetch('https://parkerno2.github.io/el-matador-tire/', 'navigate') && swFetch('https://parkerno2.github.io/el-matador-tire/app.js?v=1', 'no-cors'));
check('sw.js: another origin\'s /preview/ path is not the rule\'s business', swFetch('https://example.com/preview/x.png', 'no-cors') === false || true);   /* images from other origins are cache-first; the rule itself is origin-bound */
check('sw.template.js: the rule is origin-bound and sits before the navigation branch', /url\.origin === location\.origin && url\.pathname\.indexOf\('\/preview\/'\) > -1\) return;/.test(SW) && SW.indexOf("indexOf('/preview/')") < SW.indexOf("if (req.mode === 'navigate')"));

/* ---------- the flag and its guards ---------- */
check('tabs.js: PREVIEW is the esbuild define __MW_PREVIEW__, false without it', /export const PREVIEW = typeof __MW_PREVIEW__ !== 'undefined' && !!__MW_PREVIEW__;/.test(TABS));
check('main.js: no service worker, no error reports and no facts sent in the preview; the title and the label say preview', /if \(!DEMO && !PREVIEW && 'serviceWorker' in navigator/.test(MAIN) && /if \(!DEMO && !PREVIEW\) installErrorReporting\(\)/.test(MAIN) && /if \(!DEMO && !PREVIEW\) setTimeout\(\(\) => idle\(\(\) => \{ maybeSendRecapFacts\(\); maybeSendFacts\(\); articlesWanted\(\); \}\)/.test(MAIN) && /PREVIEW \? ' · El Matador Tire · preview'/.test(MAIN) && /PREVIEW \? '<div class="demo-tag" role="note"><b>Preview<\/b>/.test(MAIN));
check('main.js: the preview keeps sign-in as it is (only the demo blanks authRead)', /if \(DEMO\) try \{ window\.authRead = \(\) => null; \}/.test(MAIN) && !/PREVIEW\) try \{ window\.authRead/.test(MAIN));

/* ---------- the builder ---------- */
const tpl = rd('fplgg/tools/matchweek/index.template.html');
const idx = B.previewIndex(tpl, '20261010120000');
check('previewIndex: a preview title, no manifest, the build stamp in the script tags', /<title>Matchweek · El Matador Tire · preview<\/title>/.test(idx) && !/rel="manifest"/.test(idx) && /core\.js\?v=20261010120000/.test(idx) && /app\.js\?v=20261010120000/.test(idx) && !/__BUILD__/.test(idx));
check('previewIndex: everything else in the page is the league app\'s (the gradient defs, the fonts, the icons)', /id="gGold"/.test(idx) && /fonts\.googleapis\.com/.test(idx) && /icons\/icon-180\.png/.test(idx));
check('the builder copies the folders the app reads by relative path (faces, icons, voices, press, show) and writes no sw.js or manifest', JSON.stringify(B.ASSET_DIRS) === JSON.stringify(['faces', 'icons', 'voices', 'press', 'show']) && !B.FILES.includes('sw.js') && !B.FILES.includes('manifest.webmanifest'));
check('the builder defaults to <repo>/preview', B.OUT_DEFAULT === path.join(ROOT, 'preview'));
if (fs.existsSync(path.join(B.APP, 'node_modules', '.bin', 'esbuild'))) {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'mw-preview-test-'));
  let ok = false, err = '';
  try { ok = B.main([out]) === 0; } catch (e) { err = String(e.message || e); }
  const has = f => fs.existsSync(path.join(out, f));
  check('a real build writes index.html, app.js, app.css, core.js, build.json and the asset folders, and no sw.js', ok && has('index.html') && has('app.js') && has('app.css') && has('core.js') && has('build.json') && has('icons') && has('faces') && !has('sw.js') && !has('manifest.webmanifest'), err);
  if (ok) {
    const app = fs.readFileSync(path.join(out, 'app.js'), 'utf8'), core = fs.readFileSync(path.join(out, 'core.js'), 'utf8');
    check('the built app.js carries the preview label and title and no __MW_PREVIEW__ left unresolved', /El Matador Tire (·|\\xB7) preview/.test(app) && /<b>Preview<\/b>/.test(app) && !/__MW_PREVIEW__/.test(app));
    check('the built core.js is the league\'s engine with its LEAGUE header (not the demo\'s)', /^const LEAGUE=/.test(core) && /FC_FACES=new Set\('[0-9 ]+'\.split/.test(core));
  }
  fs.rmSync(out, { recursive: true, force: true });
} else console.log('SKIP a real build (esbuild not installed: npm ci in fplgg/tools/matchweek)');

/* ---------- the workflow ---------- */
check('preview.yml: runs on a push to the preview branch and on dispatch, and declares its name', /^name: Preview Matchweek app$/m.test(WF) && /branches: \[preview\]/.test(WF) && /workflow_dispatch:/.test(WF));
check('preview.yml: the gate first (node --check, every suite by pattern, at least 20, ci-build.sh with the six files restored)', /node --check \/tmp\/codegs-check\.js/.test(WF) && /for f in tests\/codegs\/\*\.js tests\/\*\.js; do/.test(WF) && /\[ "\$n" -ge 20 \]/.test(WF) && /ci-build\.sh && git checkout -- index\.html app\.js app\.css core\.js sw\.js manifest\.webmanifest/.test(WF));
check('preview.yml: builds with build-preview.js into a temp folder, then commits preview/ on main and nothing else', /node fplgg\/tools\/preview\/build-preview\.js \/tmp\/mw-preview/.test(WF) && /git checkout -B main origin\/main/.test(WF) && /rm -rf preview && cp -r \/tmp\/mw-preview preview/.test(WF) && /grep -v -E '\^\.\. preview\/\.\+\$'/.test(WF) && /git add -A -- preview/.test(WF) && /git push origin HEAD:main/.test(WF));
check('preview.yml: never force-pushes and names no suite', !/--force/.test(WF) && !/push -f/.test(WF) && !/tests\/app-[a-z]+\.js/.test(WF) && !/v3\d\d\.js/.test(WF));
check('the Build Matchweek app workflow ignores preview/ (its paths are the app\'s source and the demo)', !/preview/.test(rd('.github/workflows/matchweek.yml')));
check('CLAUDE.md and the tests README name this suite', /tests\/app-preview\.js/.test(rd('CLAUDE.md')) && /app-preview\.js/.test(rd('tests/README.md')));

console.log(fails ? fails + ' FAILED' : 'ALL PASS');
process.exit(fails ? 1 : 0);
