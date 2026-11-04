/* fplgg/tools/preview/check-claim.js: the browser half of tests/app-claim.js (Parker, 4 Nov 2026: CJ's claim stalled). Opens
   a built preview (fplgg/tools/preview/build-preview.js) in headless Chromium on the live league data, with the web app
   simulated (no real PIN is touched): the commissioner's Team PINs block (every claimed team but his own, a first tap arms,
   a second sends resetpin and the row goes), no block for another manager, and a claim that signs the phone in.
       NODE_PATH=/opt/node22/lib/node_modules node fplgg/tools/preview/check-claim.js <folder holding preview/> <shot prefix>
       W=360 for a 360 px phone. Exits 1 on any failure. Not part of the CI gate (it needs a browser and the live Sheet). */
const { chromium } = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path');
const DIR = path.resolve(process.argv[2]), OUT = process.argv[3];
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg' };
const srv = http.createServer((q, s) => { let f = path.join(DIR, decodeURIComponent(q.url.split('?')[0])); if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html'); if (!fs.existsSync(f)) { s.writeHead(404); return s.end(); } s.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(s); });
let fails = 0; const check = (l, c, i) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + l + (!c && i !== undefined ? '  ' + JSON.stringify(i) : '')); };
(async () => {
  await new Promise(r => srv.listen(0, r)); const origin = 'http://127.0.0.1:' + srv.address().port;
  const b = await chromium.launch();
  const run = async (as, claimed) => {
    const ctx = await b.newContext({ viewport: { width: +(process.env.W || 390), height: 844 } }); const page = await ctx.newPage();
    const posts = []; let C = claimed.slice();
    await page.route(u => /script\.google(usercontent)?\.com\/macros/.test(u.href), async route => {
      const req = route.request();
      if (req.method() !== 'POST') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, claimed: C }) });
      const body = JSON.parse(req.postData() || '{}'); posts.push(body);
      let out = { ok: false, error: 'unknown action' };
      if (body.action === 'status') out = { ok: true, claimed: C, commish: 'Cold Palmers' };
      if (body.action === 'claim') { if (C.includes(body.team)) out = { ok: false, error: 'claimed' }; else { C.push(body.team); out = { ok: true, token: 'tok-' + body.team }; } }
      if (body.action === 'resetpin') { if (body.team !== 'Cold Palmers') out = { ok: false, error: 'commish' }; else { C = C.filter(t => t !== body.target); out = { ok: true, claimed: C }; } }
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(out) });
    });
    await page.addInitScript(a => { if (a) localStorage.setItem('emt-auth', JSON.stringify({ team: a, token: 'tok-' + a })); }, as);
    await page.goto(origin + '/preview/#/matchday'); await page.waitForSelector('.nav', { timeout: 30000 }); await page.waitForTimeout(2500);
    await page.evaluate(() => window.MW.openSheet('identity')); await page.waitForTimeout(2500);
    return { page, ctx, posts, C: () => C };
  };
  console.log('--- the commissioner, signed in as Cold Palmers');
  { const { page, ctx, posts, C } = await run('Cold Palmers', ['Cold Palmers', 'The Soaring Gulls', 'Trophy Hunters']);
    const rows = await page.evaluate(() => [...document.querySelectorAll('.sheet .id-pinr')].map(r => ({ t: r.querySelector('b').textContent, btn: r.querySelector('button').textContent })));
    check('P1 Team PINs lists every claimed team but his own, each with Reset PIN', JSON.stringify(rows.map(r => r.t).sort()) === JSON.stringify(['The Soaring Gulls', 'Trophy Hunters']) && rows.every(r => r.btn === 'Reset PIN'), rows);
    await page.locator('.sheet [data-pinreset="The Soaring Gulls"]').scrollIntoViewIfNeeded(); await page.screenshot({ path: OUT + '-pins.png' });
    await page.click('.sheet [data-pinreset="The Soaring Gulls"]'); await page.waitForTimeout(300);
    const armed = await page.evaluate(() => document.querySelector('.sheet [data-pinreset="The Soaring Gulls"]').textContent);
    check('P2 a first tap arms the row and sends nothing', armed === 'Tap again to reset' && !posts.some(p => p.action === 'resetpin'), { armed, posts });
    await page.screenshot({ path: OUT + '-armed.png' });
    await page.click('.sheet [data-pinreset="The Soaring Gulls"]'); await page.waitForTimeout(800);
    const sent = posts.find(p => p.action === 'resetpin');
    check('P3 the second tap resets it: resetpin with his team, token and the target', !!sent && sent.team === 'Cold Palmers' && sent.token === 'tok-Cold Palmers' && sent.target === 'The Soaring Gulls', sent);
    const after = await page.evaluate(() => ({ rows: [...document.querySelectorAll('.sheet .id-pinr b')].map(b => b.textContent), toast: (document.querySelector('.toast') || {}).textContent || '' }));
    check('P4 the row is gone and a toast says so', after.rows.join() === 'Trophy Hunters' && /PIN reset for The Soaring Gulls/.test(after.toast), after);
    await ctx.close(); }
  console.log('--- another manager, signed in as Trophy Hunters');
  { const { page, ctx } = await run('Trophy Hunters', ['Cold Palmers', 'The Soaring Gulls', 'Trophy Hunters']);
    check('M1 no Team PINs block for anyone but the commissioner', await page.evaluate(() => !document.querySelector('.sheet .id-pins') && !!document.querySelector('.sheet [data-save]')));
    await ctx.close(); }
  console.log('--- a claim, signed out');
  { const { page, ctx, posts } = await run(null, ['Cold Palmers']);
    await page.click('.sheet [data-tm="The Soaring Gulls"]'); await page.waitForTimeout(300);
    await page.fill('.sheet #id-pin', '2468'); await page.click('.sheet .id-go'); await page.waitForTimeout(1500);
    const c = posts.find(p => p.action === 'claim'), auth = await page.evaluate(() => localStorage.getItem('emt-auth'));
    check('C1 Claim team sends the claim and signs the phone in', !!c && c.team === 'The Soaring Gulls' && c.pin === '2468' && /The Soaring Gulls/.test(auth || ''), { c, auth });
    await ctx.close(); }
  await b.close(); srv.close(); console.log(fails ? fails + ' FAILED' : 'ALL PASS'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
