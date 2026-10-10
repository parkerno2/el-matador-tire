/* fplgg/tools/matchweek/tools/check-subs.js — a player appears exactly once per team view, in the browser (BUGS #37,
   Parker, 10 Oct 2026: Tzolis in Trophy Hunters' XI and on their bench at once). Serves the repo root (the six built
   files, so run ci-build.sh first) on a local port, opens the app in Chromium at 390 px on the live Sheet data, and on
   every matchup of the current gameweek reads the names on the pitch and in the Bench card for both teams: no name
   twice, fifteen names a team, every sub line's replacement on the pitch and its starter in the Bench card; then the same
   on the All matchups page's auto-sub lines and, for one team, My team > Lineup (pitch and bench).
       NODE_PATH=/opt/node22/lib/node_modules node fplgg/tools/matchweek/tools/check-subs.js [--shots DIR] [--team "Trophy Hunters"]
   Exits 1 on any failure. Not part of the CI gate (it needs a browser and the network); tests/app-subs.js is the gate's half. */
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
  const argv = process.argv, shotsAt = argv.indexOf('--shots'), shots = shotsAt > -1 ? argv[shotsAt + 1] : '', teamAt = argv.indexOf('--team'), TEAM = teamAt > -1 ? argv[teamAt + 1] : '';
  if (shots) fs.mkdirSync(shots, { recursive: true });
  const { chromium } = require('playwright');
  const { srv, port } = await serve();
  const base = 'http://127.0.0.1:' + port + '/';
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() !== 'error') return; const loc = (m.location() || {}).url || ''; if (/^https?:/.test(loc) && !loc.startsWith(base) && /Failed to load resource/.test(m.text())) return; errors.push((loc ? loc.slice(-50) + ': ' : '') + m.text().slice(0, 160)); });
  page.on('pageerror', e => errors.push('pageerror: ' + String(e && e.message || e).slice(0, 160)));
  let fails = 0;
  const check = (label, cond, info) => { if (!cond) fails++; console.log((cond ? 'PASS ' : 'FAIL ') + label + (info ? '  ' + info : '')); };
  const shot = async n => { if (shots) await page.screenshot({ path: path.join(shots, n + '.png'), fullPage: true }); };
  const settled = async () => { await page.waitForSelector('.nav', { timeout: 60000 }); await page.waitForFunction(() => !document.querySelector('.boot'), null, { timeout: 60000 }); await page.waitForTimeout(500); };
  const dups = l => l.filter((x, i) => l.indexOf(x) !== i);

  await page.goto(base + '#/matchday', { waitUntil: 'domcontentloaded' }); await settled();
  const n = await page.evaluate(() => (D.fx || []).filter(f => num(f.GW) === D.gw).length);
  check('the app opens on Matchday with this gameweek\'s matchups', n > 0, n + ' matchups, GW' + (await page.evaluate(() => D.gw)));
  for (let i = 0; i < n; i++) {
    await page.goto(base + '#/matchday/matchup/' + i, { waitUntil: 'domcontentloaded' }); await settled();
    await page.evaluate(() => { const b = document.querySelector('[data-md-tab="formation"]'); if (b && !b.classList.contains('on')) b.click(); }); await page.waitForTimeout(300);
    /* the two halves of the pitch (top = the right-hand team, bottom = the left), the two bench columns (left, right) */
    const v = await page.evaluate(() => {
      const nm = el => (el.getAttribute('aria-label') || el.textContent).split(',')[0].trim();
      const code = el => (el.getAttribute('data-open') || '').replace('player:', '');
      const half = sel => [...document.querySelectorAll(sel + ' .md-tk')].map(el => ({ n: nm(el), c: code(el), line: (el.querySelector('.md-sl') || {}).textContent || '' }));
      const bench = sel => [...document.querySelectorAll(sel + ' .md-bp')].map(el => ({ n: (el.querySelector('b') || {}).textContent || '', c: code(el), tag: (el.querySelector('.chip') || {}).textContent || '' }));
      const bars = [...document.querySelectorAll('.md-tb .ell b')].map(b => b.textContent);
      const subLines = [...document.querySelectorAll('.md-asr')].map(el => el.textContent.trim());
      return { top: half('.md-half.t'), bot: half('.md-half.b'), benchL: bench('.md-bc:not(.r)'), benchR: bench('.md-bc.r'), teams: { top: bars[0], bot: bars[1] }, subLines };
    });
    const sides = [{ t: v.teams.bot, pitch: v.bot, bench: v.benchL }, { t: v.teams.top, pitch: v.top, bench: v.benchR }];
    for (const s of sides) {
      const codes = s.pitch.map(x => x.c).concat(s.bench.map(x => x.c)), d = dups(codes);
      const squad = await page.evaluate(t => squadOf(t).length, s.t);
      check('matchup ' + i + ', ' + s.t + ': ' + codes.length + ' players, each once (pitch ' + s.pitch.length + ', bench ' + s.bench.length + ')', !d.length && codes.length === squad && s.pitch.length === 11,
        (d.length ? 'twice: ' + s.pitch.concat(s.bench).filter(x => d.includes(x.c)).map(x => x.n).join(', ') + ' | ' : '') + 'pitch ' + s.pitch.map(x => x.n).join(', ') + ' | bench ' + s.bench.map(x => x.n + (x.tag ? ' [' + x.tag + ']' : '')).join(', '));
      /* a bench row tagged as going off is a starter not on the pitch; a sub line's replacement is on the pitch */
      const off = s.bench.filter(x => /OFF/.test(x.tag)), pc = new Set(s.pitch.map(x => x.c));
      check('matchup ' + i + ', ' + s.t + ': every bench row marked off is a starter who is not on the pitch', off.every(x => !pc.has(x.c)), off.map(x => x.n).join(', ') || 'none off');
      if (TEAM && s.t === TEAM) await shot('matchup-' + TEAM.replace(/\W+/g, '-').toLowerCase());
    }
    const names = sides.flatMap(s => s.pitch.map(x => x.n));
    check('matchup ' + i + ': every sub line names a replacement on the pitch', v.subLines.every(l => names.some(nm => l.includes(nm))), v.subLines.join(' | ') || 'no subs');
  }
  /* My team > Lineup for one team (the picker stores the choice) */
  if (TEAM) {
    await page.evaluate(t => { try { localStorage.setItem('emt-myteam', t); localStorage.setItem('emt-tm-lview', 'pitch'); } catch (e) { } }, TEAM);
    await page.goto(base + '#/team/lineup', { waitUntil: 'domcontentloaded' }); await settled();
    const L = await page.evaluate(() => {
      const code = el => (el.getAttribute('data-open') || '').replace('player:', '');
      const pitch = [...document.querySelectorAll('.tm-pitch [data-open^="player:"]')].map(code), bench = [...document.querySelectorAll('.tm-bench [data-open^="player:"]')].map(code);
      const nm = c => { const p = (D.ro || []).find(r => String(r.Code) === c); return p ? p.Player : c; };
      return { pitch, bench, pn: pitch.map(nm), bn: bench.map(nm), team: document.querySelector('.tm-pwm') ? 'ok' : '' };
    });
    if (L.pitch.length) {
      const d = dups(L.pitch.concat(L.bench));
      check('Lineup, ' + TEAM + ': fifteen once (pitch ' + L.pitch.length + ', bench ' + L.bench.length + ')', !d.length && L.pitch.length === 11 && L.pitch.length + L.bench.length === 15, 'pitch ' + L.pn.join(', ') + ' | bench ' + L.bn.join(', '));
      await shot('lineup-' + TEAM.replace(/\W+/g, '-').toLowerCase());
    } else console.log('note: My team > Lineup needs a chosen team on this phone; skipped (' + (await page.evaluate(() => location.hash)) + ')');
  }
  check('no console or script errors', !errors.length, errors.slice(0, 3).join(' | '));
  await browser.close(); srv.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('check-subs: ' + (e && e.stack || e)); process.exit(1); });
