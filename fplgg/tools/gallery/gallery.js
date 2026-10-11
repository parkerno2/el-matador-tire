/* fplgg/tools/gallery/gallery.js — the screenshot gallery and the invariant checks of the whole app (Parker's Q4, 10 Oct
   2026: "the scheduled agents seem sloppy, we need a better way to oversee them"). Opens the built demo league (the
   current app on the frozen, anonymised snapshot) at phone width in headless Chromium AND WebKit, in two states where the
   data allows (before kick-off: the page's clock set 2 hours before the gameweek's deadline; and at the snapshot's own
   time: live or full time, whatever it caught), walks the same screens as the contrast audit (every page and sub-tab,
   every matchup, the player, manager, menu, How it works, search, club identity and Feed post sheets), photographs each
   one and checks on each one:
     - no player twice in one team view (the Matchup pitch, list and bench, the Lineup pitch, bench and list, the manager
       sheet's pitch and bench; BUGS.md #37);
     - no NaN, undefined or null shown as a word;
     - no horizontal overflow of the page or the open sheet, no clipped text (a text wider than its box while the box
       hides its overflow; an overflow on a secondary line, class sub, is the design and is noted, not failed);
     - zero console errors and page errors;
     - no request for an EA asset (faces/, fc27, ea-map; the demo carries none);
     - no em dash, and no en dash in prose, in UI text (an en dash tight inside a figure is noted: BUGS.md #43).
   Writes OUT/<state>/<browser>/NN-screen.jpg, OUT/index.html (every screen in walk order, the browsers side by side, the
   findings on top) and OUT/report.json, prints the readable list of findings and exits 1 when there is one.
       NODE_PATH=... node fplgg/tools/gallery/gallery.js [--dir DIR] [--out DIR] [--width 390] [--browsers chromium,webkit] [--states pre,snap] [--quality 70] [--only sheets]
   DIR holds the demo as demo/ (default: site/public). The Preview workflow runs it on the branch's app over the committed
   snapshot and commits OUT as preview/shots/ beside the preview; the Build workflow runs it on the fresh demo and keeps OUT
   as the run's artifact; a finding makes either run red and nothing is published. The contrast rules are the contrast
   audit's business (fplgg/tools/contrast/audit.js), which runs beside this and is not repeated here. */
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const L = require('./lib.js');
const ROOT = path.resolve(__dirname, '..', '..', '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.mp3': 'audio/mpeg' };
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d; };
const dbg = m => { if (process.env.MWG_DEBUG) console.error('  [' + new Date().toISOString().slice(11, 19) + '] ' + m); };
const EA_RE = /\/faces\/|fc27|ea[-_]?map/i;
const slug = s => s.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();

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
/* the lib's functions as page source (they use only each other) */
const PAGE_SRC = Object.keys(L.PAGE_FNS).map(k => {
  const v = L.PAGE_FNS[k];
  if (typeof v === 'function') { const src = v.toString(); return /^function\b/.test(src) ? src : 'const ' + k + ' = ' + src + ';'; }
  if (v instanceof RegExp) return 'const ' + k + ' = ' + v.toString() + ';';
  return 'const ' + k + ' = ' + JSON.stringify(v) + ';';
}).join('\n');
/* in the page: what the checks need from one screen. rootSel: '' for the page, or the open sheet's selector */
function collectSrc(rootSel) {
  return PAGE_SRC + `
  const root = ${JSON.stringify(rootSel || '')} ? document.querySelector(${JSON.stringify(rootSel || '')}) : document.body;
  const out = { texts: 0, bad: [], dashes: [], codes: [], clipped: [], overflow: null };
  if (!root) return out;
  /* horizontal overflow: the page wider than the viewport, or the sheet's content wider than the sheet */
  out.overflow = root === document.body ? (document.documentElement.scrollWidth > innerWidth + 1 ? document.documentElement.scrollWidth + ' px wide in a ' + innerWidth + ' px viewport' : '') : (root.scrollWidth > root.clientWidth + 1 ? 'the sheet scrolls sideways: ' + root.scrollWidth + ' of ' + root.clientWidth + ' px' : '');
  const SC = new Map(); const style = e => { let s = SC.get(e); if (!s) { s = getComputedStyle(e); SC.set(e, s); } return s; };
  const shown = el => { if (!el.getClientRects().length) return false; const cs = style(el); return cs.visibility === 'visible' && parseFloat(cs.fontSize) >= 1; };
  const sig = el => { const parts = []; let a = el, n = 0; while (a && a !== document.body && n < 3) { const c = String(a.className && a.className.baseVal !== undefined ? a.className.baseVal : a.className || '').trim().split(/\\s+/).filter(x => x && !/^(on|in|open|live|lv|dim|th|r|t|b|last|prov|long)$/.test(x)).slice(0, 3); if (c.length || n === 0) { parts.unshift(a.tagName.toLowerCase() + (c.length ? '.' + c.join('.') : '')); n++; } a = a.parentElement; } return parts.join(' '); };
  /* every visible text: the words that mean a value was never computed, and the dashes */
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const t = node.nodeValue; if (!t || !t.trim()) continue;
    const el = node.parentElement; if (!el || el.closest('script,style,noscript,template,svg,.sr')) continue;
    if (!shown(el)) continue;
    out.texts++;
    const text = t.trim().replace(/\\s+/g, ' ').slice(0, 80);
    const w = badWords(text); if (w) out.bad.push({ sel: sig(el), text, word: w });
    const dk = dashKind(text); if (dk) out.dashes.push({ sel: sig(el), text, kind: dk });
  }
  /* the team views: every player code shown on an XI or bench surface, with where */
  const counted = new Set();
  root.querySelectorAll(TEAM_VIEW_SEL).forEach(surface => {
    const where = String(surface.className || '').trim().split(/\\s+/).filter(c => /^(md|tm|ms)-/.test(c))[0] || surface.tagName.toLowerCase();
    surface.querySelectorAll('[data-open^="player:"]').forEach(a => { if (counted.has(a) || !shown(a)) return; counted.add(a); out.codes.push({ code: a.getAttribute('data-open').slice(7), where, name: (a.getAttribute('aria-label') || a.textContent || '').trim().slice(0, 40) }); });
  });
  /* clipped text: an element with its own text that is wider than its box while the box hides its overflow (an
     ellipsis, a line clamp or a plain cut). On a primary line (a name, a team, a figure) it fails: Parker's rule for the
     League table (Q6) is that a team name may take two lines and is never cut, and a player's name is read the same
     way. On a secondary line (class sub: the meta line under a name gives way to the name) it is the design and is
     noted. A face circle's initials sit under the photo on purpose and are not read. */
  root.querySelectorAll('*').forEach(el => {
    if (el.closest('script,style,noscript,template,svg,.sr,.fc-i')) return;
    const own = [...el.childNodes].some(n => n.nodeType === 3 && n.nodeValue.trim()); if (!own) return;
    if (!shown(el)) return;
    const cs = style(el); if (cs.overflowX !== 'hidden' && cs.overflowX !== 'clip') return;
    if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) out.clipped.push({ sel: sig(el), text: el.textContent.trim().replace(/\\s+/g, ' ').slice(0, 60), by: el.scrollWidth - el.clientWidth, designed: el.classList.contains('sub') });
  });
  return out;`;
}

(async () => {
  const dir = path.resolve(arg('--dir', path.join(ROOT, 'site', 'public'))), out = path.resolve(arg('--out', path.join(ROOT, 'preview', 'shots'))), width = +arg('--width', 390), quality = +arg('--quality', 70);
  const browsers = arg('--browsers', 'chromium,webkit').split(',').map(s => s.trim()).filter(Boolean), only = arg('--only', '');
  const demo = path.join(dir, 'demo');
  if (!fs.existsSync(path.join(demo, 'index.html'))) { console.error('no demo at ' + demo + ' (build it: node fplgg/tools/demo/build-demo.js --data site/public/demo/data --out ' + demo + ')'); process.exit(2); }
  let index = {}; try { index = JSON.parse(fs.readFileSync(path.join(demo, 'data', 'index.json'), 'utf8')); } catch (e) { }
  const taken = index.taken || new Date().toISOString();
  /* the states the data allows: the snapshot's own time always; before kick-off when a deadline has passed by then */
  let mw = []; try { mw = JSON.parse(fs.readFileSync(path.join(demo, 'data', 'matchweeks.json'), 'utf8')).rows || []; } catch (e) { }
  const passed = mw.map(r => Date.parse(r['Deadline (UTC)'])).filter(d => d && d <= Date.parse(taken)).sort((a, b) => b - a);
  const deadline = passed[0] ? new Date(passed[0]).toISOString() : '';
  const STATES = { snap: { at: taken, label: 'At the snapshot (' + taken.slice(0, 16).replace('T', ' ') + ' UTC)' } };
  if (deadline) STATES.pre = { at: new Date(passed[0] - 2 * 3600e3).toISOString(), label: 'Before kick-off (2 h before the deadline of ' + deadline.slice(0, 16).replace('T', ' ') + ' UTC)' };
  const states = arg('--states', deadline ? 'pre,snap' : 'snap').split(',').map(s => s.trim()).filter(s => STATES[s]);
  if (!states.length) { console.error('no state to run'); process.exit(2); }
  const pw = require('playwright');
  const { srv, port } = await serve(dir);
  const base = 'http://127.0.0.1:' + port + '/demo/';
  fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
  const findings = [], noted = [], shots = [], screensAll = [];
  let textsAll = 0;
  const find = (kind, screen, browser, state, detail) => { findings.push({ kind, screen, browser, state, detail }); };

  for (const bname of browsers) {
    if (!pw[bname]) { find('screen', 'launch', bname, '-', 'no such Playwright browser: ' + bname); continue; }
    let browser;
    try { browser = await pw[bname].launch({ headless: true }); } catch (e) { find('screen', 'launch', bname, '-', bname + ' did not launch: ' + String(e.message || e).split('\n')[0].slice(0, 160)); continue; }
    console.log(bname + ' ' + (browser.version ? browser.version() : ''));
    for (const st of states) {
      const S = STATES[st];
      const page = await browser.newPage({ viewport: { width, height: 844 }, deviceScaleFactor: 1 });
      const errors = [], ea = [], offsite = [];
      const screenState = { name: 'boot' };
      page.on('console', m => { if (m.type() !== 'error') return; const loc = (m.location() || {}).url || ''; if (/\/show\/gw\d+\.json$/.test(loc)) return; if (/^https?:/.test(loc) && !loc.startsWith(base) && /Failed to load resource/.test(m.text())) { offsite.push(loc.slice(0, 80)); return; } errors.push({ screen: screenState.name, text: (loc ? loc.slice(-50) + ': ' : '') + m.text().slice(0, 160) }); });
      page.on('pageerror', e => errors.push({ screen: screenState.name, text: 'pageerror: ' + String(e && e.message || e).slice(0, 160) }));
      page.on('request', r => { const u = r.url(); if (EA_RE.test(u.replace(base, ''))) ea.push({ screen: screenState.name, url: u.slice(0, 120) }); });
      await page.clock.setFixedTime(new Date(S.at));
      const settled = async () => { await page.waitForSelector('.nav', { timeout: 60000 }); await page.waitForFunction(() => !document.querySelector('.boot'), null, { timeout: 60000 }); await page.waitForTimeout(350); };
      const sheetOpen = async () => { await page.waitForSelector('.sheet.in', { timeout: 8000 }); await page.waitForFunction(() => { const s = document.querySelector('.sheet.in'); return !!s && Math.abs(s.getBoundingClientRect().bottom - innerHeight) < 1; }, null, { timeout: 8000 }); await page.waitForTimeout(400); };
      const closeSheets = async () => { for (let k = 0; k < 4 && await page.$('.sheet'); k++) { await page.evaluate(() => window.MW.closeSheet()); await page.waitForTimeout(400); } };
      const go = async h => { dbg('go ' + h); await page.evaluate(h => { location.hash = h; }, h); await page.waitForTimeout(700); };
      const tap = async sel => { const el = await page.$(sel); if (!el) return false; await el.click(); await page.waitForTimeout(500); return true; };
      const seenHere = [];
      const shotDir = path.join(out, st, bname); fs.mkdirSync(shotDir, { recursive: true });
      /* one screen: photograph it, read it, judge it */
      async function scan(name, opt = {}) {
        dbg('scan ' + name + ' [' + bname + ', ' + st + ']');
        screenState.name = name;
        seenHere.push(name);
        if (!screensAll.includes(name)) screensAll.push(name);
        const file = String(seenHere.length).padStart(2, '0') + '-' + slug(name) + '.jpg';
        await page.evaluate(([s]) => { if (!s) scrollTo(0, 0); else { const e = document.querySelector(s); if (e) e.scrollTop = 0; } }, [opt.sheet ? '.sheet.in' : '']);
        await page.waitForTimeout(80);
        try { await page.screenshot({ path: path.join(shotDir, file), type: 'jpeg', quality }); shots.push({ state: st, browser: bname, screen: name, file: st + '/' + bname + '/' + file }); }
        catch (e) { find('screen', name, bname, st, 'no screenshot: ' + String(e.message || e).slice(0, 120)); }
        let r;
        try { r = await page.evaluate('(() => {' + collectSrc(opt.sheet ? '.sheet.in' : '') + '\n})()'); }
        catch (e) { find('screen', name, bname, st, 'the page could not be read: ' + String(e.message || e).slice(0, 120)); return; }
        textsAll += r.texts;
        if (opt.sheet && r.texts === 0) find('sheet', name, bname, st, 'the sheet shows no text');
        if (!opt.sheet && r.texts < 5) find('screen', name, bname, st, 'the page shows ' + r.texts + ' pieces of text');
        if (r.overflow) find('overflow', name, bname, st, r.overflow);
        r.bad.forEach(b => find('text', name, bname, st, '"' + b.word + '" in ' + b.sel + ': "' + b.text + '"'));
        r.dashes.forEach(d => { if (d.kind === 'fail') find('dash', name, bname, st, d.sel + ': "' + d.text + '"'); else noted.push({ screen: name + ' [' + bname + ', ' + st + ']', detail: d.sel + ': "' + d.text + '"' }); });
        L.duplicates(r.codes).forEach(d => { const nm = (r.codes.find(c => String(c.code) === d.code) || {}).name; find('duplicate', name, bname, st, 'code ' + d.code + (nm ? ' (' + nm + ')' : '') + ' on ' + d.where.join(' and ')); });
        r.clipped.forEach(c => { if (c.designed) noted.push({ screen: name + ' [' + bname + ', ' + st + ']', detail: 'a secondary line cut by ' + c.by + ' px, ' + c.sel + ': "' + c.text + '"' }); else find('clipped', name, bname, st, c.sel + ': "' + c.text + '" cut by ' + c.by + ' px'); });
        console.log('  ' + name + ' [' + bname + ', ' + st + ']: ' + r.texts + ' texts, ' + r.codes.length + ' players on team views');
      }

      /* boot: follow the first team in the table, so My team and the Matchup open on a team */
      try {
        await page.goto(base, { waitUntil: 'domcontentloaded' }); await settled();
        const team = await page.evaluate(() => (D.st && D.st[0] && D.st[0].Team) || Object.keys(TEAMS)[0]);
        await page.evaluate(t => { try { localStorage.setItem('emt-myteam', t); localStorage.setItem('emt-tm-lview', 'pitch'); } catch (e) { } }, team);
        await page.goto(base + '#/matchday/overview', { waitUntil: 'domcontentloaded' }); await settled();
        const state = await page.evaluate(() => ({ gw: D.gw, phase: (window.MW && window.MW.UI && window.MW.UI.statePill && window.MW.UI.statePill().replace(/<[^>]+>/g, '')) || '', now: new Date().toISOString() }));
        console.log(' state ' + st + ' (' + S.label + '): page clock ' + state.now + ', GW' + state.gw + ' ' + state.phase + ', following ' + team);
        STATES[st].phase = state.phase; STATES[st].gw = state.gw;

        if (only !== 'sheets') {
          await scan('matchday overview');
          const fx = await page.evaluate(() => (D.fx || []).filter(f => +f.GW === D.gw).map(f => f.Home + ' v ' + f.Away));
          for (let i = 0; i < fx.length; i++) {
            await go('#/matchday/matchup/' + i); await page.evaluate(() => { const b = document.querySelector('[data-md-tab="formation"]'); b && b.click(); }); await page.waitForTimeout(300);
            await scan('matchup ' + (i + 1) + ' formation (' + fx[i] + ')');
            if (i === 0) { for (const t of ['list', 'stats', 'history']) { await tap('[data-md-tab="' + t + '"]'); await scan('matchup 1 ' + t); } await tap('[data-md-tab="formation"]'); }
          }
          for (const s of ['all', 'pl', 'week']) { await go('#/matchday/' + s); await scan('matchday ' + s); }
          await go('#/team/overview');
          if (await page.$('[data-pick]')) { await tap('[data-pick="' + team + '"]') || await tap('[data-pick]'); }
          await scan('team overview');
          await go('#/team/lineup'); await tap('[data-lview="pitch"]'); await scan('team lineup pitch');
          await tap('[data-lview="list"]'); await scan('team lineup list'); await tap('[data-lview="pitch"]');
          for (const s of ['squad', 'transfers', 'fixtures', 'season']) { await go('#/team/' + s); await scan('team ' + s); }
          for (const s of ['overview', 'results', 'money', 'derbies', 'stats', 'alltime']) { await go('#/league/' + s); await scan('league ' + s); }
          for (const s of ['league', 'foryou', 'articles', 'messages']) { await go('#/feed/' + s); await scan('feed ' + s); }
        }
        /* the sheets */
        await go('#/team/lineup');
        const codes = await page.evaluate(t => { const ro = D.ro || [], plr = D.plr || []; const mine = ro.filter(p => p.Team === t); const owned = ro.find(p => p.Team === t && (p.Status === 'a' || !p.Status)) || mine[0] || ro[0]; const doubt = ro.find(p => p.Status === 'd') || ro.find(p => p.Status === 'i' || p.Status === 's') || null; const ownedCodes = new Set(ro.map(p => String(p.Code))); const fa = plr.find(p => !ownedCodes.has(String(p.Code)) && +(p['Total points'] || p.Pts || 0) > 10) || plr.find(p => !ownedCodes.has(String(p.Code))); return { owned: owned && String(owned.Code), doubt: doubt && String(doubt.Code), fa: fa && String(fa.Code) }; }, team);
        const sheet = async (name, open, tabs) => {
          screenState.name = name;
          try { await open(); await sheetOpen(); } catch (e) { find('sheet', name, bname, st, 'the sheet did not open: ' + String(e.message || e).split('\n')[0].slice(0, 100)); await closeSheets(); return; }
          await scan(name, { sheet: true });
          for (const t of tabs || []) { if (await tap('.sheet.in [data-tab="' + t.key + '"]')) await scan(name + ', ' + t.label, { sheet: true }); else find('sheet', name, bname, st, 'no ' + t.label + ' tab'); }
          await closeSheets();
        };
        if (codes.owned) await sheet('player sheet, owned', () => page.evaluate(c => window.MW.openSheet('player', c), codes.owned), [{ key: 'matches', label: 'matches' }, { key: 'ratings', label: 'ratings' }]);
        if (codes.fa) await sheet('player sheet, free agent', () => page.evaluate(c => window.MW.openSheet('player', c), codes.fa));
        if (codes.doubt) await sheet('player sheet, a doubt', () => page.evaluate(c => window.MW.openSheet('player', c), codes.doubt));
        await sheet('manager sheet', () => page.evaluate(t => window.MW.openSheet('manager', t), team), [{ key: 'season', label: 'season' }, { key: 'squad', label: 'squad' }, { key: 'alltime', label: 'all-time' }]);
        await sheet('menu', () => page.evaluate(() => window.MW.openSheet('menu')));
        await sheet('menu, how it works', () => page.evaluate(() => window.MW.openSheet('menu', 'how')));
        await sheet('search', async () => { await page.evaluate(() => window.MW.openSheet('search')); await page.waitForSelector('.sheet.in', { timeout: 8000 }); await page.evaluate(() => { const i = document.querySelector('.sk-search input'); if (i) { i.value = 'sa'; i.dispatchEvent(new Event('input', { bubbles: true })); } }); await page.waitForTimeout(500); });
        await page.evaluate(() => window.MW.openSheet('identity')); await page.waitForTimeout(300);
        if (await page.$('.sheet')) await sheet('club identity', async () => { });
        await go('#/feed/league');
        const postId = await page.evaluate(() => { const a = document.querySelector('[data-open^="post:"]'); return a ? a.getAttribute('data-open').slice(5) : ''; });
        if (postId) await sheet('feed post', () => page.evaluate(id => window.MW.openSheet('post', id), postId));
      } catch (e) {
        find('screen', screenState.name, bname, st, 'the walk stopped: ' + String(e.message || e).split('\n')[0].slice(0, 160));
      }
      errors.forEach(e => find('console', e.screen, bname, st, e.text));
      ea.forEach(e => find('ea', e.screen, bname, st, e.url));
      if (offsite.length) console.log('  note: ' + offsite.length + ' third-party image or font requests failed on this network (a crest, flag or font host): ' + [...new Set(offsite.map(u => u.replace(/^https?:\/\/([^/]+).*/, '$1')))].join(', '));
      await page.close();
    }
    await browser.close();
  }
  srv.close();

  /* the preview's own build stamp when OUT is its shots/ folder (build-preview.js writes build.json beside it); else the demo's */
  let build = {}; try { build = JSON.parse(fs.readFileSync(path.join(out, '..', 'build.json'), 'utf8')); } catch (e) { }
  const meta = { build: build.build || index.build || '', from: process.env.GITHUB_SHA ? process.env.GITHUB_SHA.slice(0, 7) : '', branch: process.env.GITHUB_REF_NAME || '', snapshot: taken, width, browsers, states, stateLabels: Object.fromEntries(states.map(s => [s, STATES[s].label + (STATES[s].gw ? ', GW' + STATES[s].gw : '')])), findings, noted };
  fs.writeFileSync(path.join(out, 'index.html'), L.indexHtml(shots, meta));
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({ at: new Date().toISOString(), snapshot: taken, width, browsers, states: meta.stateLabels, screens: screensAll, shots: shots.length, texts: textsAll, findings, noted }, null, 1));
  console.log('');
  const lines = L.lines(findings); lines.forEach(l => console.log('  ' + l));
  if (noted.length) console.log('  noted, not failed: ' + noted.length + ' (en dashes in figures, BUGS.md #43; secondary lines that give way)');
  console.log((findings.length ? 'GALLERY FAIL: ' + findings.length + ' finding' + (findings.length === 1 ? '' : 's') : 'GALLERY OK') + ': ' + shots.length + ' screenshots of ' + screensAll.length + ' screens in ' + browsers.join(' and ') + ', ' + states.length + ' state' + (states.length === 1 ? '' : 's') + ', ' + textsAll + ' texts read, written to ' + out);
  process.exit(findings.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
