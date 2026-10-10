/* fplgg/tools/matchweek/tools/check-sheets.js — the bottom sheets on a phone, headless (Parker, 10 Oct 2026: the page
   behind a sheet moved and a player sheet painted half). Serves the repo root (the six built files, so run
   ci-build.sh first) on a local port, opens the app in Chromium with iPhone emulation (390 x 844, touch, the live
   Sheet data), scrolls Matchday well down, opens a player sheet from the matchup, scrolls inside it, closes it, and checks
   that the page never moved and comes back at exactly the same position, that the sheet covers its whole box with an
   opaque background, and that the page cannot be scrolled while the sheet is open. WebKit is the engine that misbehaved;
   when Playwright's WebKit is installed it runs there too (--webkit).
       NODE_PATH=/opt/node22/lib/node_modules node fplgg/tools/matchweek/tools/check-sheets.js [--shots DIR] [--webkit]
   Exits 1 on any failure. Not part of the CI gate (it needs a browser and the network); tests/app-sheets.js is the gate's half. */
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
function serve() {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
      const f = path.join(ROOT, p);
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, port: srv.address().port }));
  });
}
(async () => {
  const argv = process.argv, shotsAt = argv.indexOf('--shots'), shots = shotsAt > -1 ? argv[shotsAt + 1] : '';
  if (shots) fs.mkdirSync(shots, { recursive: true });
  const pw = require('playwright');
  const engine = argv.includes('--webkit') ? pw.webkit : pw.chromium;
  const { srv, port } = await serve();
  const base = 'http://127.0.0.1:' + port + '/';
  const browser = await engine.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1', serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() !== 'error') return; const loc = (m.location() || {}).url || ''; if (/^https?:/.test(loc) && !loc.startsWith(base) && /Failed to load resource/.test(m.text())) return; errors.push((loc ? loc.slice(-50) + ': ' : '') + m.text().slice(0, 160)); });
  page.on('pageerror', e => errors.push('pageerror: ' + String(e && e.message || e).slice(0, 160)));
  let fails = 0;
  const check = (label, cond, info) => { if (!cond) fails++; console.log((cond ? 'PASS ' : 'FAIL ') + label + (info ? '  ' + info : '')); };
  const shot = async n => { if (shots) await page.screenshot({ path: path.join(shots, n + '.png') }); };
  const settled = async () => { await page.waitForSelector('.nav', { timeout: 60000 }); await page.waitForFunction(() => !document.querySelector('.boot'), null, { timeout: 60000 }); await page.waitForTimeout(500); };
  const state = () => page.evaluate(() => {
    const sh = document.querySelector('.sheet'), r = sh && sh.getBoundingClientRect();
    return { y: scrollY, bodyTop: document.body.scrollTop, lockedHtml: document.documentElement.style.overflow, bodyPos: getComputedStyle(document.body).position,
      sheet: sh ? { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right), in: sh.classList.contains('in'), bg: getComputedStyle(sh).backgroundColor, tf: getComputedStyle(sh).transform, scrollTop: sh.scrollTop, scrollH: sh.scrollHeight, h: sh.clientHeight } : null,
      vh: innerHeight, vw: innerWidth, docH: document.documentElement.scrollHeight };
  });
  /* which element is painted at a point: the sheet (or something in it) or the page behind */
  const under = (x, y) => page.evaluate(([x, y]) => { const el = document.elementFromPoint(x, y); return el ? (el.closest('.sheet') ? 'sheet' : el.closest('.scrim') ? 'scrim' : (el.tagName + '.' + el.className).slice(0, 40)) : 'none'; }, [x, y]);

  await page.goto(base + '#/matchday', { waitUntil: 'domcontentloaded' }); await settled();
  check('the app opens on Matchday', (await page.evaluate(() => location.hash)).startsWith('#/matchday'));
  /* a tap target on the matchup (the pitch, a head to head, a bench row); the page is first scrolled past it so the sheet opens from a scrolled page */
  const pick = await page.evaluate(() => { const el = [...document.querySelectorAll('#app [data-open^="player:"]')].find(e => e.getBoundingClientRect().top > 300); if (!el) return null; el.scrollIntoView({ block: 'center' }); return el.getAttribute('data-open'); });
  check('a player tap target is on the Matchday page', !!pick, pick);
  await page.evaluate(() => scrollTo(0, Math.max(scrollY, 400)));
  await page.waitForTimeout(300);
  const before = await state();
  check('the page is scrolled well down before the sheet opens', before.y >= 300, 'scrollY ' + before.y + ' of ' + before.docH);
  await shot('1-scrolled');
  /* open the sheet by a real tap on a target that is on screen */
  const target = await page.evaluateHandle(() => [...document.querySelectorAll('#app [data-open^="player:"]')].find(e => { const r = e.getBoundingClientRect(); return r.top > 60 && r.bottom < innerHeight - 80; }));
  await target.tap();
  await page.waitForSelector('.sheet.in', { timeout: 5000 });
  await page.waitForTimeout(450);   /* the slide-in */
  const open = await state();
  await shot('2-sheet-open');
  check('the sheet is open and in place (its bottom at the viewport bottom)', open.sheet && open.sheet.in && Math.abs(open.sheet.bottom - open.vh) <= 1 && open.sheet.left === 0 && open.sheet.right === open.vw, JSON.stringify(open.sheet));
  check('the sheet has an opaque background', open.sheet && /^rgb\(\d+, \d+, \d+\)$/.test(open.sheet.bg), open.sheet && open.sheet.bg);
  check('the page behind did not move when the sheet opened', open.y === before.y || (open.bodyPos === 'fixed' && open.bodyTop === before.y), 'before ' + before.y + ' open ' + open.y + ' body.scrollTop ' + open.bodyTop + ' body ' + open.bodyPos);
  /* every point down the sheet's own box is the sheet, not the page behind it */
  const probes = []; for (let y = open.sheet.top + 20; y < open.vh - 10; y += 60) probes.push([200, y]);
  const painted = []; for (const [x, y] of probes) painted.push(await under(x, y));
  check('the sheet covers its whole box (elementFromPoint down the middle is the sheet everywhere)', painted.every(p => p === 'sheet'), painted.join(','));
  /* the page cannot be scrolled while the sheet is open: a wheel over the scrim and a programmatic scroll change nothing */
  await page.mouse.move(200, 10); await page.mouse.wheel(0, 300); await page.waitForTimeout(200);
  await page.evaluate(() => { scrollTo(0, 0); window.scrollBy(0, 500); });
  await page.waitForTimeout(200);
  const held = await state();
  check('the page is locked while the sheet is open (scrollTo and wheel over the scrim move nothing)', held.y === open.y && held.bodyTop === open.bodyTop, 'y ' + held.y + ' body.scrollTop ' + held.bodyTop);
  /* scroll inside the sheet to its end: no chaining into the page */
  await page.evaluate(() => { const sh = document.querySelector('.sheet'); sh.scrollTop = sh.scrollHeight; });
  await page.mouse.move(200, open.vh - 100); await page.mouse.wheel(0, 800); await page.waitForTimeout(250);
  const scrolled = await state();
  check('the sheet scrolls inside itself (scrollTop moved) and the page behind stays', scrolled.sheet.scrollTop > 0 && scrolled.y === open.y && scrolled.bodyTop === open.bodyTop, 'sheet.scrollTop ' + scrolled.sheet.scrollTop + ' y ' + scrolled.y);
  await shot('3-sheet-scrolled');
  const paintedEnd = []; for (const [x, y] of probes) paintedEnd.push(await under(x, y));
  check('scrolled to its end the sheet still covers its whole box', paintedEnd.every(p => p === 'sheet'), paintedEnd.join(','));
  /* close with the X */
  await page.tap('.sheet .sheet-x'); await page.waitForTimeout(450);
  const after = await state();
  await shot('4-closed');
  check('the sheet is gone after the close', !after.sheet || !after.sheet.in);
  check('the page comes back at exactly the position it had before the sheet', after.y === before.y, 'before ' + before.y + ' after ' + after.y);
  check('the scroll lock is released (html overflow, body position back to normal)', after.lockedHtml === '' && after.bodyPos !== 'fixed', after.lockedHtml + ' ' + after.bodyPos);
  /* open again and close with Back (the swipe and the scrim share this path) */
  await (await page.evaluateHandle(() => [...document.querySelectorAll('#app [data-open^="player:"]')].find(e => { const r = e.getBoundingClientRect(); return r.top > 60 && r.bottom < innerHeight - 80; }))).tap();
  await page.waitForSelector('.sheet.in', { timeout: 5000 }); await page.waitForTimeout(400);
  await page.goBack(); await page.waitForTimeout(450);
  const after2 = await state();
  check('closed with Back the page is still exactly where it was', after2.y === before.y && (!after2.sheet || !after2.sheet.in), 'after ' + after2.y);
  check('the page scrolls again after the sheets close', await page.evaluate(() => { const a = scrollY; scrollBy(0, 40); const b = scrollY; scrollTo(0, a); return b === a + 40; }));
  check('no console or script errors', !errors.length, errors.slice(0, 3).join(' | '));
  await browser.close(); srv.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('check-sheets: ' + (e && e.stack || e)); process.exit(1); });
