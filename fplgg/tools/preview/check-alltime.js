/* fplgg/tools/preview/check-alltime.js — the browser half of tests/app-alltime.js (the Q5 review of 10 Oct 2026: a team
   name in the manager sheet's Seasons table takes two lines and is never cut). Opens a built app (the demo at
   /tmp/mw-demo by default, as the contrast audit builds it) in headless Chromium at phone width, League > All-time, then
   every manager's sheet on its All-time tab, and checks the Seasons table: every team name fully shown (no clamp, no
   ellipsis), the sheet and the page not scrolling sideways, no console error. Screenshots the longest name's sheet.
       NODE_PATH=/opt/node22/lib/node_modules node fplgg/tools/preview/check-alltime.js [--dir /tmp/mw-demo] [--path /demo/] [--width 360] [--shot FILE]
   Exits 1 on any failure. Not part of the CI gate (it needs a browser); run it at 360 and 390 px before pushing. */
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d; };
const DIR = path.resolve(arg('--dir', '/tmp/mw-demo')), APP = arg('--path', '/demo/'), width = +arg('--width', 360), shot = arg('--shot', '');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
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
  const page = await browser.newPage({ viewport: { width, height: 844 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 160)); });
  page.on('pageerror', e => errors.push('pageerror: ' + String(e).slice(0, 160)));
  await page.goto('http://127.0.0.1:' + port + APP + '#/league/alltime', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const teams = await page.evaluate(() => [...document.querySelectorAll('.at-tr[data-open^="manager:"]')].map(r => r.getAttribute('data-open').slice(8)));
  let fails = 0;
  const results = [];
  for (const team of teams) {
    await page.evaluate(t => window.MW.openSheet('manager', t), team);
    await page.waitForTimeout(900);
    const ok = await page.$('.sk-manager [data-tab="alltime"]');
    if (!ok) { console.log('FAIL no All-time tab for ' + team); fails++; continue; }
    await ok.click(); await page.waitForTimeout(700);
    const r = await page.evaluate(() => {
      const sheet = document.querySelector('.sk-manager');
      const cells = [...document.querySelectorAll('.sk-manager .at-sr .tm')];
      return {
        sideways: sheet ? sheet.scrollWidth > sheet.clientWidth : null,
        docSideways: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        cells: cells.map(c => ({ text: c.textContent, cut: c.scrollHeight > c.clientHeight + 1 || c.scrollWidth > c.clientWidth + 1, lines: Math.round(c.getBoundingClientRect().height / (parseFloat(getComputedStyle(c).fontSize) * 1.2)), w: Math.round(c.getBoundingClientRect().width) }))
      };
    });
    const bad = r.cells.filter(c => c.cut);
    results.push({ team, ...r });
    if (bad.length || r.sideways || r.docSideways) { fails++; console.log('FAIL ' + team + ' ' + JSON.stringify({ bad, sideways: r.sideways, docSideways: r.docSideways })); }
    else console.log('PASS ' + team + ': ' + r.cells.map(c => '"' + c.text + '" ' + c.lines + ' line(s) in ' + c.w + 'px').join(', '));
    if (shot && team.length === Math.max(...teams.map(t => t.length))) {
      const card = await page.$('.sk-manager .at-sr.hd');
      if (card) { await card.scrollIntoViewIfNeeded(); await page.waitForTimeout(300); }
      await page.screenshot({ path: shot });
      console.log('shot ' + shot + ' (' + team + ')');
    }
    for (let k = 0; k < 4 && await page.$('.sheet'); k++) { await page.evaluate(() => window.MW.closeSheet()); await page.waitForTimeout(400); }
    await page.evaluate(() => { location.hash = '#/league/alltime'; }); await page.waitForTimeout(400);
  }
  if (errors.length) { fails++; console.log('FAIL console errors: ' + errors.join(' | ')); } else console.log('PASS no console errors');
  console.log((fails ? fails + ' FAILED' : 'ALL PASS') + ' at ' + width + 'px over ' + teams.length + ' sheets');
  await browser.close(); srv.close();
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
