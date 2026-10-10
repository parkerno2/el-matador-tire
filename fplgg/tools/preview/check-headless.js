/* fplgg/tools/preview/check-headless.js — opens a built preview (fplgg/tools/preview/build-preview.js) in headless Chromium at
   phone width, on the LIVE league data, and checks the UI pass of 10 Oct 2026: every page draws with no console error
   and no horizontal scroll; every Plate on the Matchup pitch, the Lineup pitch and bench and in a player sheet wears at
   most one status badge and no SUB, LIKELY, OUT or INJ tag; the Matchup page has no legend and no watch button; the
   player sheet opens on the season card with the projection row closed. Writes screenshots when asked.
       NODE_PATH=/opt/node22/lib/node_modules node fplgg/tools/preview/check-headless.js [--dir DIR] [--shots DIR] [--width 390] [--team "Cold Palmers"]
   DIR is a folder that holds the built preview as preview/ (default: the repo root, after a build into <repo>/preview).
   Exits 1 on any failure. Not part of the CI gate (it needs a browser and the live Sheet). */
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const ROOT = path.resolve(__dirname, '..', '..', '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.mp3': 'audio/mpeg' };
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d; };
function serve(dir) {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
      const f = path.join(dir, p);
      if (!f.startsWith(dir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, port: srv.address().port }));
  });
}
(async () => {
  const dir = path.resolve(arg('--dir', ROOT)), shots = arg('--shots', ''), width = +arg('--width', 390), team = arg('--team', 'Cold Palmers');
  if (shots) fs.mkdirSync(shots, { recursive: true });
  const { chromium } = require('playwright');
  const { srv, port } = await serve(dir);
  const base = 'http://127.0.0.1:' + port + '/preview/';
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width, height: 844 }, deviceScaleFactor: 2, ignoreHTTPSErrors: true });
  const errors = [], offsite = [], failed = [];
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const loc = (m.location() || {}).url || '';
    if (/^https?:/.test(loc) && !loc.startsWith(base) && /Failed to load resource/.test(m.text())) { offsite.push(loc.slice(0, 80)); return; }   /* a badge, flag or font host unreachable from this network */
    errors.push((loc ? loc.slice(-60) + ': ' : '') + m.text().slice(0, 200));
  });
  page.on('pageerror', e => errors.push('pageerror: ' + String(e && e.message || e).slice(0, 200)));
  page.on('response', r => { const u = r.url(); if (u.startsWith(base) && r.status() >= 400 && !/\/show\//.test(u)) failed.push(r.status() + ' ' + u.slice(base.length)); });
  let fails = 0;
  const check = (label, cond, info) => { if (!cond) fails++; console.log((cond ? 'PASS ' : 'FAIL ') + label + (info ? '  ' + info : '')); };
  const shot = async n => { if (shots) await page.screenshot({ path: path.join(shots, width + '-' + n + '.png'), fullPage: n.endsWith('-full') }); };
  const settled = async () => { await page.waitForSelector('.nav', { timeout: 60000 }); await page.waitForFunction(() => !document.querySelector('.boot'), null, { timeout: 60000 }); await page.waitForTimeout(600); };
  const noScroll = async () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
  /* the Plates on the page: at most one badge each, no status text */
  const plates = async sel => page.evaluate(sel => [...document.querySelectorAll(sel + ' .fc')].map(c => ({ badges: c.querySelectorAll('.st').length, tag: [...c.querySelectorAll('.tag')].map(t => t.textContent).join(','), inj: !!c.querySelector('.inj'), sub: /\bsub(in|out)\b/.test(c.className), st: (c.querySelector('.st') || {}).className || '', label: c.getAttribute('aria-label') })), sel);
  const plateRule = (list, where) => {
    const bad = list.filter(c => c.badges > 1 || /SUB|LIKELY|OUT|INJ/.test(c.tag) || c.inj || c.sub);
    check(where + ': ' + list.length + ' Plates, at most one badge each, no SUB, LIKELY, OUT or INJ tag, no status frame class', list.length > 0 && bad.length === 0, JSON.stringify(bad.slice(0, 3)));
    const kinds = {}; list.forEach(c => { if (c.st) kinds[c.st] = (kinds[c.st] || 0) + 1; });
    console.log('     badges on ' + where + ': ' + (Object.keys(kinds).length ? Object.entries(kinds).map(([k, v]) => k + ' x' + v).join(', ') : 'none') + '; ' + list.filter(c => c.st).slice(0, 4).map(c => c.label).join(' | '));
  };

  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.evaluate(t => { try { localStorage.setItem('emt-myteam', t); } catch (e) { } }, team);
  await page.goto(base + '#/matchday', { waitUntil: 'domcontentloaded' }); await settled(); await shot('1-home');
  check('the preview opens on Matchday with the Preview label and title', (await page.evaluate(() => location.hash)).startsWith('#/matchday') && !!(await page.$('.demo-tag')) && /preview/.test(await page.title()), await page.title());
  check('no service worker registered by the preview', await page.evaluate(() => navigator.serviceWorker ? navigator.serviceWorker.getRegistrations().then(r => r.length === 0) : true));
  check('no horizontal scroll on Matchday', await noScroll());

  /* the Matchup page */
  const idx = await page.evaluate(() => { const fx = (D.fx || []).filter(f => +f.GW === D.gw); const me = localStorage.getItem('emt-myteam'); const i = fx.findIndex(f => f.Home === me || f.Away === me); return i >= 0 ? i : 0; });
  await page.goto(base + '#/matchday/matchup/' + idx, { waitUntil: 'domcontentloaded' }); await settled(); await shot('2-matchup'); await shot('2-matchup-full');
  check('Matchup: no legend row, no "Bubbles show" switch row, no watch button; the pitch follows the tabs', !(await page.$('.md-leg')) && !(await page.$('.md-xprow')) && !(await page.$('.md-watch')) && await page.evaluate(() => { const seg = document.querySelector('.md-seg'); const n = seg && seg.nextElementSibling; return !!n && n.classList.contains('md-tab') && n.firstElementChild.classList.contains('md-pw'); }));
  plateRule(await plates('.md-pitch'), 'the Matchup pitch');
  check('Matchup: the line under every card is a kick-off, a minute, FT or a plain state, never "likely sub"', await page.evaluate(() => [...document.querySelectorAll('.md-sl')].every(e => !/likely sub/i.test(e.textContent))));
  check('no horizontal scroll on the Matchup page', await noScroll());
  const xpt = await page.$('.md-xpt');
  if (xpt) { await xpt.click(); await page.waitForTimeout(500); check('the xP switch in the team bar flips the bubbles without opening the manager sheet', await page.evaluate(() => !document.querySelector('.sheet') && !!document.querySelector('.md-xpt.on') && !!document.querySelector('.md-pitch .pts i') && [...document.querySelectorAll('.md-pitch .pts i')].some(i => i.textContent === 'XP'))); await shot('2b-matchup-xp'); await page.click('.md-xpt'); await page.waitForTimeout(300); }
  else console.log('     (no xP switch: nobody has finished yet, or the matchup is over)');
  await page.click('[data-md-tab="list"]'); await page.waitForTimeout(500); await shot('2c-matchup-list');
  check('Matchup list: the chips are green, amber or red (no purple or grey status chip)', await page.evaluate(() => [...document.querySelectorAll('.md-list .chip, .md-bench .chip')].every(c => /\b(on|doubt|out)\b/.test(c.className) && !/mute|md-on|\bsub\b/.test(c.className))));

  /* My team: the Lineup pitch and bench, then the list */
  await page.goto(base + '#/team/lineup', { waitUntil: 'domcontentloaded' }); await settled();
  if (await page.$('[data-pick-team]')) { await page.click('[data-pick-team="' + team + '"]').catch(() => { }); await page.waitForTimeout(800); }
  await page.evaluate(() => { try { localStorage.setItem('emt-tm-lview', 'pitch'); } catch (e) { } }); await page.goto(base + '#/team/lineup', { waitUntil: 'domcontentloaded' }); await settled(); await shot('3-lineup'); await shot('3-lineup-full');
  plateRule(await plates('.tm-pitch'), 'the Lineup pitch');
  if (await page.$('.tm-bench')) plateRule(await plates('.tm-bench'), 'the Lineup bench');
  check('Lineup: no text tag over a bench card, no "Bubbles show" note', !(await page.$('.tm-bout')) && await page.evaluate(() => !/Bubbles show/.test(document.body.textContent)));
  check('no horizontal scroll on the Lineup page', await noScroll());
  const listBtn = await page.$('[data-lview="list"]');
  if (listBtn) { await listBtn.click(); await page.waitForTimeout(500); await shot('3b-lineup-list'); check('Lineup list: every status chip is green, amber or red', await page.evaluate(() => [...document.querySelectorAll('.tm-list .chip')].every(c => /\b(on|doubt|out)\b/.test(c.className)))); }

  /* a player sheet: a doubt or injured starter if there is one, else the first on the pitch */
  const code = await page.evaluate(() => { const ro = (D.ro || []); const me = localStorage.getItem('emt-myteam'); const mine = ro.filter(p => p.Team === me); const d = mine.find(p => p.Status === 'd') || ro.find(p => p.Status === 'd') || mine[0] || ro[0]; return d ? String(d.Code) : ''; });
  await page.evaluate(c => window.MW.openSheet('player', c), code); await page.waitForTimeout(1200); await shot('4-player'); await shot('4-player-full');
  check('player sheet: the header carries the next fixture chip and no OVR chip', await page.evaluate(() => !!document.querySelector('.sk-player .ps-nx') && ![...document.querySelectorAll('.sk-player .ps-fc')].some(c => /OVR/.test(c.textContent))));
  check('player sheet: the season card is first, with apps, goals, assists, points and a coloured rating', await page.evaluate(() => { const p = document.querySelector('.sk-player [data-panel="overview"]'); const h = p && p.querySelector('.sh h2'); return !!h && h.textContent === 'Season' && !!p.querySelector('.ps-season .ps-rb.ok, .ps-season .ps-rb.wn, .ps-season .ps-rb.no') && p.querySelectorAll('.ps-season .ps-cell').length === 5; }));
  check('player sheet: form chips in green, amber, red or grey only', await page.evaluate(() => { const l = [...document.querySelectorAll('.sk-player .ps-form .sk-pc')]; return l.every(c => /\b(p1|p2|p3|z|lv)\b/.test(c.className)); }));
  check('player sheet: the next five in green, amber or red', await page.evaluate(() => [...document.querySelectorAll('.sk-player .ps-n5:not(.none) i')].every(i => /var\(--(win|doubt|loss)\)/.test(i.getAttribute('style') || ''))));
  check('player sheet: the projection row (if his match is still to come) and More are closed by default', await page.evaluate(() => [...document.querySelectorAll('.sk-player .ps-fold .ps-prow')].every(b => b.getAttribute('aria-expanded') === 'false' && b.nextElementSibling.hidden) && !!document.querySelector('.sk-player .ps-more')));
  const fold = await page.$('.sk-player .ps-proj .ps-prow, .sk-player .ps-more .ps-prow');
  if (fold) { await fold.click(); await page.waitForTimeout(300); check('a tap opens the fold', await page.evaluate(() => !!document.querySelector('.sk-player .ps-fold.open .ps-fbody:not([hidden])'))); await shot('4b-player-open'); }
  plateRule(await plates('.sk-player .ps-hero'), 'the player sheet\'s Plate');
  check('player sheet: no explanatory footnote on the Overview', await page.evaluate(() => !/Floor and ceiling|bar shows difficulty|what the performance deserved/.test(document.querySelector('.sk-player').textContent)));
  check('no horizontal scroll with the sheet open', await noScroll());
  await page.evaluate(() => window.MW.closeSheet()); await page.waitForTimeout(400);

  /* the League page and the Feed, and a manager sheet (the full Plates) */
  await page.goto(base + '#/league', { waitUntil: 'domcontentloaded' }); await settled(); await shot('5-league');
  check('League: draws, no horizontal scroll', !!(await page.$('.nav')) && await noScroll());
  await page.evaluate(t => window.MW.openSheet('manager', t), team); await page.waitForTimeout(1200); await shot('6-manager');
  plateRule(await plates('.sk-manager'), 'the manager sheet\'s lineup');
  await page.evaluate(() => window.MW.closeSheet()); await page.waitForTimeout(400);
  await page.goto(base + '#/feed', { waitUntil: 'domcontentloaded' }); await settled(); await shot('7-feed');
  check('Feed: draws, no horizontal scroll', !!(await page.$('.nav')) && await noScroll());

  check('no console errors anywhere', errors.length === 0, errors.slice(0, 5).join(' || '));
  check('no failed request to the preview itself', failed.length === 0, failed.slice(0, 5).join(', '));
  if (offsite.length) console.log('     note: ' + offsite.length + ' third-party image or font requests failed on this network (not the preview\'s doing): ' + [...new Set(offsite.map(u => u.replace(/^https?:\/\/([^/]+).*/, '$1')))].join(', '));
  await browser.close(); srv.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
