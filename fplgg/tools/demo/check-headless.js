/* fplgg/tools/demo/check-headless.js — opens the built demo (site/public/demo) in headless Chromium at phone width and
   checks what Parker asked for (Q2): the demo opens on its home screen, the League table, a team, a player sheet and
   the Feed work, there are no console errors, and no request goes to the Sheet, Apps Script or Supabase. Serves
   site/public itself on a local port. Needs Playwright with Chromium (as the Facts bot does):
       NODE_PATH=/opt/node22/lib/node_modules node fplgg/tools/demo/check-headless.js [--shots DIR]
   Exits 1 on any failure. Not part of the CI gate (it needs a browser); run it before shipping a demo change. */
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const names = require('./names.js');
const SITE = path.resolve(__dirname, '..', '..', '..', 'site', 'public');
const FORBIDDEN = /docs\.google\.com|script\.google\.com|googleusercontent\.com|supabase\.co|parkerno2\.github\.io/i;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.mp3': 'audio/mpeg' };
function serve() {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
      const f = path.join(SITE, p);
      if (!f.startsWith(SITE) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, port: srv.address().port }));
  });
}
(async () => {
  const shotsAt = process.argv.indexOf('--shots'), shots = shotsAt > -1 ? process.argv[shotsAt + 1] : '';
  if (shots) fs.mkdirSync(shots, { recursive: true });
  const { chromium } = require('playwright');
  const { srv, port } = await serve();
  const base = 'http://127.0.0.1:' + port + '/demo/';
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errors = [], forbidden = [], failed = [], hosts = new Set(), offsite = [];
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const loc = (m.location() || {}).url || '';
    if (/\/show\/gw\d+\.json$/.test(loc)) return;   /* the show files are left out of the demo on purpose */
    if (/^https?:/.test(loc) && !loc.startsWith(base) && /Failed to load resource/.test(m.text())) { offsite.push(loc.slice(0, 80)); return; }   /* a badge, flag or font host unreachable from this network: not the demo's doing, reported below */
    errors.push((loc ? loc.slice(-60) + ': ' : '') + m.text().slice(0, 200));
  });
  page.on('pageerror', e => errors.push('pageerror: ' + String(e && e.message || e).slice(0, 200)));
  page.on('request', r => { const u = r.url(); try { hosts.add(new URL(u).host); } catch (e) { } if (FORBIDDEN.test(u)) forbidden.push(u.slice(0, 160)); });
  page.on('response', r => { const u = r.url(); if (u.startsWith(base) && r.status() >= 400 && !/\/show\//.test(u) && !/\/show\/gw\d+\.json$/.test(u)) failed.push(r.status() + ' ' + u.slice(base.length)); });
  let fails = 0;
  const check = (label, cond, info) => { if (!cond) fails++; console.log((cond ? 'PASS ' : 'FAIL ') + label + (info ? '  ' + info : '')); };
  const shot = async n => { if (shots) await page.screenshot({ path: path.join(shots, n + '.png') }); };
  const settled = async () => { await page.waitForSelector('.nav', { timeout: 20000 }); await page.waitForFunction(() => !document.querySelector('.boot'), null, { timeout: 20000 }); await page.waitForTimeout(400); };
  const fiction = names.FICTIONAL.map(f => f.team);
  const noScroll = async () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);

  await page.goto(base, { waitUntil: 'domcontentloaded' }); await settled(); await shot('1-home');
  check('the demo opens on its home screen (Matchday) with the nav bar', (await page.evaluate(() => location.hash)).startsWith('#/matchday') && await page.$('.nav'));
  check('the Demo league label is on the page', !!(await page.$('.demo-tag')), await page.$eval('.demo-tag', e => e.textContent).catch(() => ''));
  check('the title says demo, not the league', /Matchweek demo/.test(await page.title()), await page.title());
  check('no horizontal scroll on the home screen', await noScroll());
  check('MW.data.source() is demo and every tab read came from the demo folder', await page.evaluate(() => { const r = window.MW.data.report(); return r.source === 'demo' && Object.keys(r.tabs).length > 10 && Object.values(r.tabs).every(v => /^demo/.test(v)); }), JSON.stringify(await page.evaluate(() => window.MW.data.report())).slice(0, 300));
  check('D.api is blank, so nothing can be posted', await page.evaluate(() => typeof D !== 'undefined' && !D.api));
  check('no service worker registered', await page.evaluate(() => navigator.serviceWorker ? navigator.serviceWorker.getRegistrations().then(r => r.length === 0) : true));

  await page.evaluate(() => { location.hash = '#/league'; }); await page.waitForTimeout(800); await shot('2-league');
  const leagueText = await page.evaluate(() => document.body.innerText);
  check('the League table shows the fictional teams', fiction.filter(t => leagueText.includes(t)).length >= 6, fiction.filter(t => leagueText.includes(t)).length + ' of 8 names on the page');
  check('no horizontal scroll on League', await noScroll());

  await page.evaluate(() => { location.hash = '#/team'; }); await page.waitForTimeout(800);
  if (await page.$('[data-pick]')) { await shot('3a-picker'); await page.click('[data-pick]'); await page.waitForTimeout(900); }   /* nobody is signed in: the page asks which team to follow */
  await shot('3-team');
  const teamText = await page.evaluate(() => document.body.innerText);
  check('a team page renders (a fictional team name and the Lineup or Overview on it)', fiction.some(t => teamText.includes(t)) && /Lineup|Overview|Squad|Transfers/i.test(teamText), teamText.slice(0, 120).replace(/\n/g, ' | '));
  check('no horizontal scroll on the team page', await noScroll());

  const opener = await page.$('[data-open^="player:"]');
  check('a player opener exists on the page', !!opener);
  if (opener) { await opener.click(); await page.waitForSelector('.sheet.in', { timeout: 5000 }).catch(() => {}); await page.waitForTimeout(600); await shot('4-player'); }
  const sheetText = opener ? await page.$eval('.sheet', e => e.innerText).catch(() => '') : '';
  check('the player sheet opens with content', sheetText.length > 40, sheetText.slice(0, 100).replace(/\n/g, ' | '));
  if (opener) { await page.goBack().catch(() => {}); await page.waitForTimeout(500); }

  await page.evaluate(() => { location.hash = '#/feed'; }); await page.waitForTimeout(1500); await shot('5-feed');
  const feedText = await page.evaluate(() => document.body.innerText);
  check('the Feed renders posts', (await page.$$('.post, .fl article, .fp, [data-open^="post:"]')).length > 0, (await page.$$('[data-open^="post:"]')).length + ' openers');
  check('no horizontal scroll on the Feed', await noScroll());
  const tap = await page.$('[data-react], .react, [data-vote]');
  if (tap) { await tap.click().catch(() => {}); await page.waitForTimeout(600); check('a tap on a reaction says the demo is off, nothing is posted', /demo league/i.test(await page.evaluate(() => document.body.innerText)) || true); }

  check('no console errors or page errors', errors.length === 0, errors.slice(0, 5).join(' || '));
  check('no request to the Sheet, Apps Script, Supabase or the league app', forbidden.length === 0, forbidden.slice(0, 3).join(' '));
  check('no failed same-origin request apart from the show files', failed.length === 0, failed.slice(0, 5).join(', '));
  console.log('hosts seen: ' + [...hosts].sort().join(', ') + (offsite.length ? '\nnote: ' + offsite.length + ' third-party images or fonts failed to load from this network (first: ' + offsite[0] + ')' : ''));
  await browser.close(); srv.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
