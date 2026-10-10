/* fplgg/tools/preview/check-overview.js — League > Overview in headless Chromium at phone width, on the LIVE league data
   (Parker, 10 Oct 2026, Q6: the table without money and with PF, the Manager of the Month race led by real points).
       NODE_PATH=/opt/node22/lib/node_modules node fplgg/tools/preview/check-overview.js [--dir DIR] [--shots DIR] [--width 390] [--team "Cold Palmers"] [--no-refresh] [--small] [--tag before|after]
   DIR holds the built preview as preview/ (fplgg/tools/preview/build-preview.js). Checks: the table has no dollar sign,
   its columns are #, crest, Team, W-D-L, PF, Pts, Title, every team name is whole (no clipped or cut line) and every row
   has form dots; the race's main numbers are the month's points as the engine scores them, in rank order; no horizontal
   scroll; no console error. Then the live refresh: the GW Stats answer is rewritten on the way in so one team's XI scores
   3 more a player, MW.reload(true) runs the app's own refresh, and the race's numbers and order must change without a page load.
   Writes element screenshots of the table and the race when --shots is given. Exits 1 on any failure. Not in the CI gate
   (it needs a browser and the live Sheet). */
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const ROOT = path.resolve(__dirname, '..', '..', '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.mp3': 'audio/mpeg' };
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d; };
const has = k => process.argv.includes(k);
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
  const dir = path.resolve(arg('--dir', ROOT)), shots = arg('--shots', ''), width = +arg('--width', 390), team = arg('--team', 'Cold Palmers'), tagS = arg('--tag', '');
  if (shots) fs.mkdirSync(shots, { recursive: true });
  const { chromium } = require('playwright');
  const { srv, port } = await serve(dir);
  const base = 'http://127.0.0.1:' + port + '/preview/';
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width, height: 844 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('console', m => { if (m.type() !== 'error') return; const loc = (m.location() || {}).url || ''; if (/^https?:/.test(loc) && !loc.startsWith(base) && /Failed to load resource/.test(m.text())) return; errors.push(m.text().slice(0, 200)); });
  page.on('pageerror', e => errors.push('pageerror: ' + String(e && e.message || e).slice(0, 200)));
  let fails = 0;
  const check = (label, cond, info) => { if (!cond) fails++; console.log((cond ? 'PASS ' : 'FAIL ') + label + (info ? '  ' + info : '')); };
  const shot = async (sel, n) => { if (!shots) return; const el = await page.$(sel); if (el) await el.screenshot({ path: path.join(shots, width + (tagS ? '-' + tagS : '') + '-' + n + '.png'), scale: has('--small') ? 'css' : 'device' }); };   /* --small: 1x pixels, for the repo */
  const settled = async () => { await page.waitForSelector('.nav', { timeout: 60000 }); await page.waitForFunction(() => !document.querySelector('.boot'), null, { timeout: 60000 }); await page.waitForTimeout(600); };
  const noScroll = async () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
  /* the race as drawn: team, main number, small projection, win, in row order */
  const race = async () => page.evaluate(() => [...document.querySelectorAll('.lg-motm .lg-mr')].map(r => ({ t: r.querySelector('.tn').textContent, main: +r.querySelector('.pr').textContent, proj: (r.querySelector('.sm') || {}).textContent || '', win: r.querySelector('.wn').textContent })));
  /* the race as the engine scores it: the month's finished fixtures plus the live gameweek as it stands (effPtsOf) */
  const scored = async () => page.evaluate(() => {
    const per = PERIODS.find(p => D.gw >= p[1] && D.gw <= p[2]) || PERIODS[PERIODS.length - 1], t = {};
    Object.keys(TEAMS).forEach(n => { t[n] = 0; });
    D.fx.forEach(f => { const g = num(f.GW); if (g < per[1] || g > per[2]) return;
      if (fin(f.Finished)) { t[f.Home] += num(f['Home pts']); t[f.Away] += num(f['Away pts']); } else if (g === D.gw && D.dlPassed) { t[f.Home] += effPtsOf(f, f.Home); t[f.Away] += effPtsOf(f, f.Away); } });
    return t;
  });

  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.evaluate(t => { try { localStorage.setItem('emt-myteam', t); } catch (e) { } }, team);
  await page.goto(base + '#/league', { waitUntil: 'domcontentloaded' }); await settled();
  /* the title odds and the month's projections fill in after the first paint */
  await page.waitForFunction(() => !document.querySelector('.lg-tbl .tb.wait'), null, { timeout: 30000 }).catch(() => { });
  await page.waitForTimeout(800);
  await shot('.lg-tbl', '1-table'); await shot('.lg-motm', '2-race');

  console.log('--- the table at ' + width + ' px');
  const T = await page.evaluate(() => {
    const tbl = document.querySelector('.lg-tbl');
    const heads = [...tbl.querySelectorAll('.lg-th span')].map(s => s.textContent);
    const rows = [...tbl.querySelectorAll('.lg-tr')].map(r => {
      const tn = r.querySelector('.tn'), rect = r.getBoundingClientRect();
      const kids = [...r.children].map(c => c.getBoundingClientRect());
      return { team: tn.textContent, pf: +r.querySelector('.pf').textContent, pts: +r.querySelector('.pts').textContent, rec: r.querySelector('.rec').textContent,
        dots: r.querySelectorAll('.fdots').length, l2: r.querySelector('.l2').textContent,
        whole: tn.scrollHeight <= tn.clientHeight + 1 && tn.scrollWidth <= tn.clientWidth + 1, lines: Math.round(tn.clientHeight / parseFloat(getComputedStyle(tn).lineHeight)),
        inRow: kids.every(k => k.left >= rect.left - 0.5 && k.right <= rect.right + 0.5), overlap: kids.some((k, i) => i > 0 && k.left < kids[i - 1].right - 0.5) };
    });
    const st = {}; (D.st || []).forEach(s => { st[s.Team] = { pf: num(s['Pts For']), pts: num(s['League Pts']), rec: num(s.W) + '-' + num(s.D) + '-' + num(s.L) }; });
    return { heads, rows, st, text: tbl.textContent, zone: tbl.querySelectorAll('.lg-zone').length, zoneText: [...tbl.querySelectorAll('.lg-zone')].map(z => z.textContent).join(''), foot: (tbl.querySelector('.lg-foot p') || {}).textContent || '' };
  });
  check('no dollar sign anywhere in the table', !/\$/.test(T.text), T.text.match(/\$\S*/g) ? T.text.match(/\$\S*/g).join(' ') : '');
  check('the columns are #, crest, Team, W-D-L, PF, Pts, Title', T.heads.join('|') === '#||Team|W-D-L|PF|Pts|Title', T.heads.join('|'));
  check('8 rows, each with PF equal to the Standings tab and the record and points too', T.rows.length === 8 && T.rows.every(r => T.st[r.team] && r.pf === T.st[r.team].pf && r.pts === T.st[r.team].pts && r.rec === T.st[r.team].rec), JSON.stringify(T.rows.map(r => [r.team, r.pf, r.rec, r.pts])));
  check('form dots on every row, and the line under the name is only the manager (or You) and the dots', T.rows.every(r => r.dots === 1 && !/\d/.test(r.l2)), T.rows.map(r => r.l2).join(' | '));
  check('every team name is whole: no clipped line, no cut text, at most two lines', T.rows.every(r => r.whole && r.lines <= 2), T.rows.filter(r => !r.whole || r.lines > 2).map(r => r.team + ' ' + r.lines + ' lines').join(', ') || T.rows.map(r => r.lines).join(''));
  check('every cell inside its row, no two cells overlapping', T.rows.every(r => r.inRow && !r.overlap));
  check('one plain line under 3rd, with no text', T.zone === 1 && T.zoneText === '');
  check('the footnote is a data state or nothing', !T.foot || /moves when GW\d+ is over|provisional/.test(T.foot), T.foot);
  check('no em or en dash in the table', !/[–—]/.test(T.text));

  console.log('--- the race at ' + width + ' px');
  const R = await race(), S = await scored();
  const headTxt = await page.evaluate(() => [...document.querySelectorAll('.lg-motm .lg-mh span')].map(s => s.textContent.trim()));
  const anyPts = Object.values(S).some(v => v > 0);
  console.log('     head: ' + headTxt.join(' | ') + '; rows: ' + R.map(r => r.t + ' ' + r.main + (r.proj ? ' (' + r.proj + ')' : '') + ' ' + r.win).join(', '));
  if (anyPts) {
    check('the main number of each row is the month\'s points as the engine scores them (the live gameweek included)', R.every(r => r.main === Math.round(S[r.t])), R.map(r => r.t + ': shown ' + r.main + ', scored ' + Math.round(S[r.t])).join('; '));
    check('ranked by those points, descending', R.every((r, i) => i === 0 || R[i - 1].main >= r.main));
    check('the column head is Points' + (await page.evaluate(() => !!D.liveNow) ? ' with the live tag' : ''), /^Points/.test(headTxt[2]) && (!(await page.evaluate(() => !!D.liveNow)) || /LIVE/.test(headTxt[2])), headTxt[2]);
    check('the projection shows as the small secondary figure on every row', R.every(r => /^\d+ proj$/.test(r.proj)));
  } else {
    check('no points yet: the main number is the projection, headed Projected, no secondary figure', headTxt[2] === 'Projected' && R.every(r => !r.proj));
  }
  check('win chance on every row', R.every(r => /%$/.test(r.win)));
  check('no dollar sign in the race', !(await page.evaluate(() => /\$/.test(document.querySelector('.lg-motm').textContent))));
  check('no em or en dash in the race', !(await page.evaluate(() => /[–—]/.test(document.querySelector('.lg-motm').textContent))));
  check('no horizontal scroll on League > Overview', await noScroll());

  if (!has('--no-refresh') && anyPts && await page.evaluate(() => !!D.liveNow)) {
    console.log('--- the live refresh (the Rosters answer rewritten on the way in: every player of the last team\'s XI scores 3 more GW pts, where the engine reads the live score)');
    const victim = R[R.length - 1].t;
    const codes = await page.evaluate(t => (D.ro || []).filter(p => p.Team === t && p['GW XI'] === 'XI').map(p => String(p.Code)), victim);
    const D_GW = await page.evaluate(() => D.gw);
    await page.evaluate(() => { window.__mwProbe = 1; });
    const isRosters = u => /gviz\/tq/.test(u.href) && /sheet=Rosters/.test(u.href);
    await page.route(isRosters, async route => {
      const res = await route.fetch(); let body = await res.text();
      const m = /^([\s\S]*?\()([\s\S]*)(\);?\s*)$/.exec(body);
      if (m) {
        const j = JSON.parse(m[2]); const cols = j.table.cols.map(c => c.label);
        const iCode = cols.indexOf('Code'), iPts = cols.indexOf('GW pts');
        let hit = 0;
        j.table.rows.forEach(r => { const c = r.c; if (!c[iCode] || !c[iPts]) return; if (codes.includes(String(c[iCode].v))) { c[iPts].v = (+c[iPts].v || 0) + 3; c[iPts].f = String(c[iPts].v); hit++; } });
        body = m[1] + JSON.stringify(j) + m[3]; console.log('     rewrote ' + hit + ' Rosters rows of ' + victim + ' (GW' + D_GW + ')');
      }
      await route.fulfill({ response: res, body, headers: Object.assign({}, res.headers(), { 'content-length': String(Buffer.byteLength(body)) }) });
    });
    const before = R.map(r => r.t + ':' + r.main).join(',');
    await page.evaluate(() => window.MW.reload(true));
    await page.waitForFunction(b => [...document.querySelectorAll('.lg-motm .lg-mr')].map(r => r.querySelector('.tn').textContent + ':' + r.querySelector('.pr').textContent).join(',') !== b, before, { timeout: 30000 }).catch(() => { });
    await page.waitForTimeout(1500);
    const after = await race(), S2 = await scored();
    console.log('     before: ' + before); console.log('     after:  ' + after.map(r => r.t + ':' + r.main).join(','));
    check('no page load: a marker set on the window before the refresh is still there', await page.evaluate(() => window.__mwProbe === 1));
    check('the victim\'s points rose by 3 a player in the engine', Math.round(S2[victim]) === Math.round(S[victim]) + 3 * codes.length, victim + ' ' + Math.round(S[victim]) + ' -> ' + Math.round(S2[victim]) + ' (' + codes.length + ' in the XI)');
    check('the race shows the new numbers without a page load', after.every(r => r.main === Math.round(S2[r.t])), after.map(r => r.t + ': shown ' + r.main + ', scored ' + Math.round(S2[r.t])).join('; '));
    check('and the order changed with them', after.map(r => r.t).join(',') !== R.map(r => r.t).join(',') && after.every((r, i) => i === 0 || after[i - 1].main >= r.main), after.map(r => r.t).join(' > '));
    await shot('.lg-motm', '3-race-after-refresh');
    await page.unroute(isRosters);
  } else console.log('     (refresh proof skipped: ' + (has('--no-refresh') ? 'asked' : anyPts ? 'no gameweek is live' : 'the month has no points') + ')');

  check('no console errors', errors.length === 0, errors.slice(0, 5).join(' || '));
  await browser.close(); srv.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
