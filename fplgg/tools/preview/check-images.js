/* fplgg/tools/preview/check-images.js — the browser half of tests/app-images.js (Parker, 11 Oct 2026, iPhone, live
   gameweek: photos disappearing on refresh and scroll, the rating backing's corner, the club code poking out beside the
   badge). Opens a built app (the demo at /tmp/mw-demo by default, as the contrast audit builds it) in headless Chromium
   at iPhone size, opens a player sheet and checks: every club circle with a loaded badge hides its code; the sheet's
   Plate photo decodes synchronously and carries no filter; the rating backing starts inside the card's inner keyline
   (6.31 cqw); a data refresh (MW.reload) keeps every loaded picture on the page and in the sheet as the same element,
   so nothing is fetched or decoded again; no page error. --stub-images serves a stand-in PNG for the PL, flag and
   favicon hosts (for a network that cannot reach them).
       NODE_PATH=/opt/node22/lib/node_modules node fplgg/tools/preview/check-images.js [--dir /tmp/mw-demo] [--path /demo/] [--width 402] [--stub-images] [--shot FILE]
   Exits 1 on any failure. Not part of the CI gate (it needs a browser). */
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d; };
const DIR = path.resolve(arg('--dir', '/tmp/mw-demo')), APP = arg('--path', '/demo/'), width = +arg('--width', 402), shot = arg('--shot', ''), stub = process.argv.includes('--stub-images');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webmanifest': 'application/manifest+json' };
/* a 40 x 50 PNG, opaque, so a stand-in badge or photo has a natural size */
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAACgAAAAyCAIAAACh0Q7HAAAANklEQVR42u3NQQEAQAQAMC6vZjLpcjF4bAWW1RMbXiwRi8VisVgsFovFYrFYLBaLxWKx+EL8AdxDAljiFAjCAAAAAElFTkSuQmCC', 'base64');
function serve() {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
      const f = path.join(DIR, p);
      if (!f.startsWith(DIR) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
      res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, port: srv.address().port }));
  });
}
(async () => {
  const { chromium } = require('playwright');
  const { srv, port } = await serve();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width, height: 874 }, deviceScaleFactor: 3 });
  if (stub) await page.route(/resources\.premierleague\.com|flagcdn\.com|google\.com\/s2\/favicons/, r => r.fulfill({ status: 200, contentType: 'image/png', body: PNG, headers: { 'cache-control': 'max-age=3600' } }));
  const errors = []; page.on('pageerror', e => errors.push(String(e && e.message || e).slice(0, 200)));
  let fails = 0;
  const check = (label, cond, info) => { if (!cond) fails++; console.log((cond ? 'PASS ' : 'FAIL ') + label + (info ? '  ' + info : '')); };
  const base = 'http://127.0.0.1:' + port + APP;
  await page.goto(base + '#/matchday', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.MW && !document.querySelector('.boot') && document.querySelector('.nav'), null, { timeout: 60000 });
  await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(1500);
  const code = await page.evaluate(() => { const p = document.querySelector('[data-open^="player:"]'); return p && p.dataset.open.split(':')[1]; });
  check('a player to open', !!code);
  await page.evaluate(c => MW.openSheet('player', c), code); await page.waitForTimeout(1500);
  const s = await page.evaluate(() => {
    window.__app = [...document.querySelectorAll('#app img')].filter(i => i.complete && i.naturalWidth);
    const sh = document.querySelector('.sheet'); window.__sheet = [...sh.querySelectorAll('img')].filter(i => i.complete && i.naturalWidth);
    const circles = [...sh.querySelectorAll('.sk-cb')].map(c => { const i = c.querySelector('img'); return { code: c.querySelector('em').textContent, loaded: !!(i && i.complete && i.naturalWidth && i.style.display !== 'none'), shown: getComputedStyle(c.querySelector('em')).visibility === 'visible' }; });
    const face = sh.querySelector('.ps-plate .face img'), fc = sh.querySelector('.ps-plate .fc'), R = fc.getBoundingClientRect(), q = fc.querySelector('.rt').getBoundingClientRect();
    return { circles, decoding: face && face.getAttribute('decoding'), filter: face && getComputedStyle(face).filter, rtTop: (q.top - R.top) / (R.width / 100), app: window.__app.length, sheet: window.__sheet.length };
  });
  const bad = s.circles.filter(c => c.loaded === c.shown);
  check(s.circles.length + ' club circles: the code hidden behind a loaded badge and shown without one', s.circles.length > 0 && !bad.length, JSON.stringify(bad.slice(0, 3)));
  check('the sheet\'s Plate photo decodes synchronously, with no filter', s.decoding === 'sync' && s.filter === 'none', s.decoding + ' ' + s.filter);
  check('the rating backing starts inside the card\'s inner keyline (' + s.rtTop.toFixed(2) + ' cqw, keyline 6.31)', s.rtTop > 6.81 && s.rtTop <= 7.9);
  if (shot) await page.screenshot({ path: shot });
  await page.evaluate(() => MW.reload(true)); await page.waitForTimeout(3000);
  const r = await page.evaluate(() => {
    const now = [...document.querySelectorAll('#app img')], sh = [...document.querySelector('.sheet').querySelectorAll('img')];
    return { app: window.__app.filter(i => now.includes(i)).length, sheet: window.__sheet.filter(i => sh.includes(i)).length };
  });
  check('a refresh keeps every loaded picture as the same element: page ' + r.app + ' of ' + s.app + ', sheet ' + r.sheet + ' of ' + s.sheet, s.app + s.sheet > 0 && r.app === s.app && r.sheet === s.sheet);
  check('no page error', !errors.length, errors.join(' | '));
  await browser.close(); srv.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
