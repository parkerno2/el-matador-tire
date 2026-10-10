/* fplgg/tools/contrast/audit.js — the contrast audit of the whole app (Parker, 10 Oct 2026: "a contrast pass on the
   entire app to make sure that it's following the rules that we've outlined"; the rules are docs/DESIGN.md).
   Opens the built demo league (site/public/demo: the current app on the frozen, anonymised snapshot) in headless
   Chromium at phone width, with the page's clock fixed at the snapshot's own time so the gameweek is in the state the
   snapshot caught (before kick-off, live, full time), walks every page and sub-tab (Matchday's overview, every matchup
   with its Formation, List, Stats and History tabs, All matchups, Premier League, Week; My team's six pages, the Lineup
   as pitch and as list; the League's five pages; the Feed's four tabs) and opens the sheets (a player who is owned, a
   free agent and a doubt, with the Matches and Ratings tabs, a manager, the menu and How it works, search, club
   identity, a Feed post), and on every screen measures each visible piece of text against what is really painted
   behind it: the text is made transparent, the screen is photographed, and the pixels under each text box are read,
   so gradients, photos, hairlines, scrims, overlapping layers and opacity are all accounted for. A number (the numeric
   font, class n, or numeric text) needs 7:1 against both the darkest and the lightest pixel behind it, other text
   4.5:1, display type of 24 px and up 3:1; a number never sits on purple and is never purple (the Plate tiers excepted).
       NODE_PATH=/opt/node22/lib/node_modules node fplgg/tools/contrast/audit.js [--dir DIR] [--shots DIR] [--report FILE] [--width 390] [--list N] [--at ISO]
   --shots writes one screenshot per screen, --crops a close-up of each offending text (one per selector and colour,
   the first 80), --report the JSON of every offender with its rect. DIR holds the demo as demo/ (default: site/public). Exits 1 with the list of offenders (screen, selector, text,
   colours, ratio, rule) when any text fails, 0 and "CONTRAST OK" when none does. The CI steps in preview.yml and
   matchweek.yml run it; README.md says how to run it locally. The Gameweek Show's screens need a voiced show, which the
   demo does not carry, so they are checked by tests/app-contrast.js from the stylesheet's own colours instead. */
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const L = require('./lib.js');
const ROOT = path.resolve(__dirname, '..', '..', '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.mp3': 'audio/mpeg' };
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d; };
const dbg = m => { if (process.env.MWA_DEBUG) console.error('  [' + new Date().toISOString().slice(11, 19) + '] ' + m); };
const MAX_VIEWS = 10;   /* viewports scanned per screen: the Feed can be far longer, and its later posts repeat the same styles */

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

/* in the page: every visible text box in the viewport, with what the audit needs to judge it. Scroller: 'window' or a
   selector for the open sheet. A text box counts when the element under its centre is the text's own element, a
   descendant or an ancestor (a scrim, another sheet or a fixed bar on top means the text is covered, not read). */
function collectSrc() {
  return PAGE_SRC + `
  const vw = innerWidth, vh = innerHeight, out = [];
  const sig = el => { const parts = []; let a = el, n = 0; while (a && a !== document.body && n < 3) { const c = String(a.className && a.className.baseVal !== undefined ? a.className.baseVal : a.className || '').trim().split(/\\s+/).filter(x => x && !/^(on|in|open|live|lv|dim|th|r|t|b|last|prov|long)$/.test(x)).slice(0, 3); if (c.length || n === 0) { parts.unshift(a.tagName.toLowerCase() + (c.length ? '.' + c.join('.') : '')); n++; } a = a.parentElement; } return parts.join(' '); };
  const SC = new Map(), OP = new Map(), DIS = new Map();
  const style = e => { let s = SC.get(e); if (!s) { s = getComputedStyle(e); SC.set(e, s); } return s; };
  const opOf = e => { if (!e || e === document.documentElement) return 1; if (OP.has(e)) return OP.get(e); const s = style(e); const v = (s.display === 'none' ? 0 : parseFloat(s.opacity)) * opOf(e.parentElement); OP.set(e, v); return v; };
  const disabledIn = e => { if (!e || e === document.documentElement) return false; if (DIS.has(e)) return DIS.get(e); const v = e.hasAttribute('disabled') || e.getAttribute('aria-disabled') === 'true' || disabledIn(e.parentElement); DIS.set(e, v); return v; };
  /* what floats over the page: fixed and sticky boxes (the section pills, a compact header, the nav bar, a sheet's tab
     bar). Text under one of them is covered, whatever the hit test says (a bar that passes taps through is still
     painted), so a text box is clipped away from a cover it does not belong to, and dropped when mostly under it */
  const covers = [];
  const union = e => { let r = e.getBoundingClientRect(); let L = r.left, T = r.top, R = r.right, B = r.bottom; e.querySelectorAll('*').forEach(d => { if (style(d).display === 'none') return; const q = d.getBoundingClientRect(); if (!q.width || !q.height) return; L = Math.min(L, q.left); T = Math.min(T, q.top); R = Math.max(R, q.right); B = Math.max(B, q.bottom); }); return { left: L, top: T, right: R, bottom: B, width: R - L, height: B - T }; };
  document.querySelectorAll('body *').forEach(e => { const ps = style(e).position; if (ps !== 'fixed' && ps !== 'sticky') return; if (e.closest('.sheet') && !e.classList.contains('sheet')) { /* inside a sheet: a sticky tab bar, measured as any other */ } const r = union(e); /* a zero-height sticky anchor carries its bar as a positioned child */ if (r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < vh) covers.push({ e, r }); });
  const uncover = (el, L, T, R, B) => {
    for (const c of covers) {
      if (c.e.contains(el)) continue;
      const ol = Math.max(0, Math.min(R, c.r.right) - Math.max(L, c.r.left)) * Math.max(0, Math.min(B, c.r.bottom) - Math.max(T, c.r.top));
      if (!ol) continue;
      if (ol > 0.4 * (R - L) * (B - T)) return null;
      if (c.r.bottom > T && c.r.top <= T) T = c.r.bottom; else if (c.r.top < B && c.r.bottom >= B) B = c.r.top; else return null;
    }
    return [L, T, R, B];
  };
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const t = node.nodeValue; if (!t || !t.trim()) continue;
    const el = node.parentElement; if (!el) continue;
    if (el.closest('script,style,noscript,template,svg,.sr,[data-mwa-skip]')) continue;
    const cs = style(el);
    if (cs.display === 'none' || cs.visibility !== 'visible' || parseFloat(cs.fontSize) < 1) continue;
    const op = opOf(el);
    if (op < 0.05 || disabledIn(el)) continue;
    const fill = cs.webkitTextFillColor && cs.webkitTextFillColor !== cs.color ? cs.webkitTextFillColor : cs.color;
    let col = parseColor(fill), clipText = '';
    if (!col || col[3] * op < 0.05) {
      if ((cs.webkitBackgroundClip === 'text' || cs.backgroundClip === 'text') && cs.backgroundImage !== 'none') { clipText = cs.backgroundImage; el.setAttribute('data-mwa-clip', '1'); col = [255, 255, 255, 1]; }
      else continue;
    }
    const range = document.createRange(); range.selectNodeContents(node);
    const rects = [...range.getClientRects()].filter(r => r.width >= 2 && r.height >= 4 && r.bottom > 1 && r.top < vh - 1 && r.right > 1 && r.left < vw - 1);
    /* an ancestor that clips (overflow other than visible, an ellipsis) bounds what is painted: the hidden tail of an
       ellipsised run lies under whatever is drawn beside it and is not read */
    const clips = [];
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) { const s = style(a); if (s.overflowX !== 'visible' || s.overflowY !== 'visible') clips.push(a.getBoundingClientRect()); }
    for (const r0 of rects) {
      let L = r0.left, T = r0.top, R = r0.right, B = r0.bottom;
      clips.forEach(c => { L = Math.max(L, c.left); T = Math.max(T, c.top); R = Math.min(R, c.right); B = Math.min(B, c.bottom); });
      if (R - L < 2 || B - T < 4) continue;
      const u = uncover(el, L, T, R, B); if (!u) continue; [L, T, R, B] = u;
      if (R - L < 2 || B - T < 4) continue;
      const x = Math.min(vw - 1, Math.max(0, (L + R) / 2)), y = Math.min(vh - 1, Math.max(0, (T + B) / 2));
      const hit = document.elementFromPoint(x, y);
      if (!hit || !(el.contains(hit) || hit.contains(el))) continue;
      /* the glyphs sit in the middle of the line box; its top and bottom 15% are leading, where a border or a neighbour's edge can lie */
      const lead = (B - T) * 0.15;
      const x0 = Math.max(0, Math.floor(L) + 1), y0 = Math.max(0, Math.round(T + lead)), x1 = Math.min(vw, Math.ceil(R) - 1), y1 = Math.min(vh, Math.round(B - lead));
      if (x1 - x0 < 1 || y1 - y0 < 2) continue;
      const sw = parseFloat(cs.webkitTextStrokeWidth) || 0, sc = sw >= 1 ? parseColor(cs.webkitTextStrokeColor) : null;
      out.push({ sel: sig(el), text: t.trim().replace(/\\s+/g, ' ').slice(0, 60), color: col, opacity: op, size: parseFloat(cs.fontSize), cls: String(el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className || ''), plate: !!el.closest('.fc'), clipText, stroke: sc && sc[3] > 0 ? sc : null, rect: [x0, y0, x1 - x0, y1 - y0] });
    }
  }
  return out;`;
}
/* in the page: the darkest, lightest and median pixel of each rect in the given PNG of the viewport */
const SAMPLE_SRC = `async ([png, rects, dpr]) => {
  const img = new Image(); img.src = 'data:image/png;base64,' + png; await img.decode();
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
  const lum = (r, gg, b) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(gg) + 0.0722 * f(b); };
  return rects.map(([x, y, w, h]) => {
    const d = g.getImageData(Math.round(x * dpr), Math.round(y * dpr), Math.max(1, Math.round(w * dpr)), Math.max(1, Math.round(h * dpr))).data;
    const px = [];
    for (let i = 0; i < d.length; i += 4) px.push([lum(d[i], d[i + 1], d[i + 2]), d[i], d[i + 1], d[i + 2]]);
    px.sort((a, b) => a[0] - b[0]);
    const at = q => px[Math.min(px.length - 1, Math.floor(q * px.length))];
    const dk = at(0.02), lt = at(0.98), md = at(0.5);
    return { dark: [dk[1], dk[2], dk[3]], light: [lt[1], lt[2], lt[3]], median: [md[1], md[2], md[3]] };
  });
}`;
/* in the page: a crop of a PNG, scaled up 3 times, as base64 */
const CROP_SRC = `async ([png, [x, y, w, h]]) => {
  const img = new Image(); img.src = 'data:image/png;base64,' + png; await img.decode();
  const c = document.createElement('canvas'); c.width = w * 3; c.height = h * 3; const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  g.drawImage(img, x, y, w, h, 0, 0, w * 3, h * 3); return c.toDataURL('image/png').split(',')[1];
}`;
const OUTLINE_SRC = `async ([png, rects]) => {
  const img = new Image(); img.src = 'data:image/png;base64,' + png; await img.decode();
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  g.strokeStyle = '#FF00FF'; g.lineWidth = 1; rects.forEach(([x, y, w, h]) => g.strokeRect(x + .5, y + .5, w, h)); return c.toDataURL('image/png').split(',')[1];
}`;
const HIDE = '*{color:transparent!important;-webkit-text-fill-color:transparent!important;-webkit-text-stroke:0!important;text-shadow:none!important;caret-color:transparent!important}[data-mwa-clip]{background-image:none!important}';
const gradientColors = s => (String(s).match(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g) || []).map(L.parseColor).filter(Boolean);

(async () => {
  const dir = path.resolve(arg('--dir', path.join(ROOT, 'site', 'public'))), shots = arg('--shots', ''), crops = arg('--crops', ''), report = arg('--report', ''), width = +arg('--width', 390), listN = +arg('--list', 400);
  if (shots) fs.mkdirSync(shots, { recursive: true });
  if (crops) fs.mkdirSync(crops, { recursive: true });
  let cropN = 0;
  const demo = path.join(dir, 'demo');
  if (!fs.existsSync(path.join(demo, 'index.html'))) { console.error('no demo at ' + demo + ' (build it: node fplgg/tools/demo/build-demo.js --data site/public/demo/data --out ' + demo + ')'); process.exit(2); }
  let index = {}; try { index = JSON.parse(fs.readFileSync(path.join(demo, 'data', 'index.json'), 'utf8')); } catch (e) { }
  const at = arg('--at', '') || index.taken || new Date().toISOString();
  const { chromium } = require('playwright');
  const { srv, port } = await serve(dir);
  const base = 'http://127.0.0.1:' + port + '/demo/';
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width, height: 844 }, deviceScaleFactor: 1 });
  const errors = [], offsite = [];
  page.on('console', m => { if (m.type() !== 'error') return; const loc = (m.location() || {}).url || ''; if (/\/show\/gw\d+\.json$/.test(loc)) return; if (/^https?:/.test(loc) && !loc.startsWith(base) && /Failed to load resource/.test(m.text())) { offsite.push(loc.slice(0, 80)); return; } errors.push((loc ? loc.slice(-50) + ': ' : '') + m.text().slice(0, 160)); });
  page.on('pageerror', e => errors.push('pageerror: ' + String(e && e.message || e).slice(0, 160)));
  await page.clock.setFixedTime(new Date(at));
  const settled = async () => { await page.waitForSelector('.nav', { timeout: 60000 }); await page.waitForFunction(() => !document.querySelector('.boot'), null, { timeout: 60000 }); await page.waitForTimeout(350); };
  const sheetOpen = async () => { await page.waitForSelector('.sheet.in', { timeout: 8000 }); await page.waitForTimeout(500); };
  const closeSheets = async () => { dbg('close sheets'); for (let k = 0; k < 4 && await page.$('.sheet'); k++) { await page.evaluate(() => window.MW.closeSheet()); await page.waitForTimeout(400); } };
  const go = async h => { dbg('go ' + h); await page.evaluate(h => { location.hash = h; }, h); await page.waitForTimeout(700); };
  const only = arg('--only', '');   /* 'sheets': skip the pages (for debugging the sheet steps) */
  const tap = async sel => { const el = await page.$(sel); if (!el) return false; await el.click(); await page.waitForTimeout(500); return true; };

  const offenders = [], screensDone = [], checks = []; let texts = 0;
  const check = (label, ok, info) => { checks.push({ label, ok, info }); console.log((ok ? 'PASS ' : 'FAIL ') + label + (info ? '  ' + info : '')); };
  /* one screen: scroll the window (or the open sheet) a viewport at a time, collect the visible text, photograph the
     viewport with the text hidden, read the pixels under each text box */
  async function scan(name, opt = {}) {
    dbg('scan ' + name);
    const scroller = opt.sheet ? '.sheet.in' : 'window';
    const total = await page.evaluate(s => s === 'window' ? document.documentElement.scrollHeight : (document.querySelector(s) || {}).scrollHeight || 0, scroller);
    const vh = 844, views = Math.min(MAX_VIEWS, Math.max(1, Math.ceil(total / vh)));
    let n = 0;
    for (let v = 0; v < views; v++) {
      await page.evaluate(([s, y]) => { if (s === 'window') scrollTo(0, y); else { const e = document.querySelector(s); if (e) e.scrollTop = y; } }, [scroller, v * vh]);
      await page.waitForTimeout(v ? 120 : 40);
      dbg('  view ' + v + ' collect');
      const items = await page.evaluate('(() => {' + collectSrc() + '\n})()');
      dbg('  ' + items.length + ' items, shot');
      if (!items.length) continue;
      const hide = await page.addStyleTag({ content: HIDE });
      const png = (await page.screenshot({ type: 'png' })).toString('base64');
      await hide.evaluate(e => e.remove());
      const samples = await page.evaluate(new Function('a', 'return (' + SAMPLE_SRC + ')(a)'), [png, items.map(i => i.rect), 1]);
      dbg('  sampled');
      items.forEach((it, i) => {
        const s = samples[i]; if (!s) return;
        n++;
        const rule = L.ruleFor(it.text, it.cls, it.size);
        const fgs = it.clipText ? gradientColors(it.clipText) : [it.color];
        if (!fgs.length) return;
        let worst = null;
        /* outlined display type (a text-stroke of 1 px or more in another colour: the tabloid cards' headlines): the
           glyph sits on its own outline, so the fill is read against the outline, which surrounds every stroke */
        const outline = it.stroke && (it.stroke[0] !== it.color[0] || it.stroke[1] !== it.color[1] || it.stroke[2] !== it.color[2]) ? L.over([it.stroke[0], it.stroke[1], it.stroke[2], it.stroke[3] * it.opacity], s.median) : null;
        fgs.forEach(c => { const col = [c[0], c[1], c[2], (c.length > 3 ? c[3] : 1) * it.opacity]; const rd = outline ? L.reading(col, outline, outline, outline) : L.reading(col, s.dark, s.light, s.median); const why = L.verdict(rule, rd, { plate: it.plate, medianRGB: outline || s.median, fgRGB: L.over(col, outline || s.median) }); if (why.length && (!worst || rd.ratio < worst.rd.ratio)) worst = { rd, why }; });
        if (worst) offenders.push({ screen: name, sel: it.sel, text: it.text, fg: worst.rd.fg, dark: worst.rd.dark, light: worst.rd.light, ratio: Math.round(worst.rd.ratio * 100) / 100, rule: rule.kind + ' ' + rule.min + ':1', why: worst.why, size: it.size, view: v, rect: it.rect });
      });
      if (process.env.MWA_DUMP && name.includes(process.env.MWA_DUMP_SCREEN || '')) {   /* debugging: the view with every offending rect outlined */
        const plain = (await page.screenshot({ type: 'png' })).toString('base64');
        const rs = offenders.filter(o => o.screen === name && o.view === v).map(o => o.rect);
        const b64 = await page.evaluate(new Function('a', 'return (' + OUTLINE_SRC + ')(a)'), [plain, rs]);
        fs.writeFileSync(path.join(process.env.MWA_DUMP, name.replace(/[^a-z0-9]+/gi, '-') + '-v' + v + '.png'), Buffer.from(b64, 'base64'));
        const b64h = await page.evaluate(new Function('a', 'return (' + OUTLINE_SRC + ')(a)'), [png, rs]);
        fs.writeFileSync(path.join(process.env.MWA_DUMP, name.replace(/[^a-z0-9]+/gi, '-') + '-v' + v + '-hidden.png'), Buffer.from(b64h, 'base64'));
      }
      if (crops) {   /* close-ups cut from a plain screenshot of this view, for the eye */
        const plain = (await page.screenshot({ type: 'png' })).toString('base64'); const seen = new Set();
        for (const o of offenders.filter(o => o.screen === name && o.view === v)) {
          const k = o.sel + '|' + o.fg; if (seen.has(k) || cropN >= 80) continue; seen.add(k); cropN++;
          const [x, y, w, h] = o.rect; const cx = Math.max(0, x - 12), cy = Math.max(0, y - 12), cw = Math.min(width - cx, w + 24), ch = Math.min(844 - cy, h + 24);
          const b64 = await page.evaluate(new Function('a', 'return (' + CROP_SRC + ')(a)'), [plain, [cx, cy, cw, ch]]);
          fs.writeFileSync(path.join(crops, String(cropN).padStart(2, '0') + '-' + o.sel.replace(/[^a-z0-9]+/gi, '-').slice(0, 50) + '.png'), Buffer.from(b64, 'base64'));
        }
      }
      if (shots && v === 0) await page.screenshot({ path: path.join(shots, String(screensDone.length + 1).padStart(2, '0') + '-' + name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '.png') });
    }
    texts += n;
    screensDone.push(name);
    const mine = offenders.filter(o => o.screen === name).length;
    console.log('  ' + name + ': ' + n + ' text boxes over ' + views + ' view' + (views === 1 ? '' : 's') + (mine ? ', ' + mine + ' offender' + (mine === 1 ? '' : 's') : ''));
    await page.evaluate(([s]) => { if (s === 'window') scrollTo(0, 0); else { const e = document.querySelector(s); if (e) e.scrollTop = 0; } }, [scroller]);
  }

  /* boot: follow the first team in the table, so My team and the Matchup open on a team */
  await page.goto(base, { waitUntil: 'domcontentloaded' }); await settled();
  const team = await page.evaluate(() => (D.st && D.st[0] && D.st[0].Team) || Object.keys(TEAMS)[0]);
  await page.evaluate(t => { try { localStorage.setItem('emt-myteam', t); localStorage.setItem('emt-tm-lview', 'pitch'); } catch (e) { } }, team);
  await page.goto(base + '#/matchday/overview', { waitUntil: 'domcontentloaded' }); await settled();
  const now = await page.evaluate(() => new Date().toISOString());
  const state = await page.evaluate(() => ({ gw: D.gw, phase: (window.MW && window.MW.UI && window.MW.UI.statePill && window.MW.UI.statePill().replace(/<[^>]+>/g, '')) || '' }));
  console.log('demo ' + base + ' at ' + now + ' (snapshot ' + (index.taken || 'unknown') + '), GW' + state.gw + ' ' + state.phase + ', following ' + team + ', ' + width + ' px');

  /* Matchday */
  if (only !== 'sheets') {
  await scan('matchday overview');
  const fx = await page.evaluate(() => (D.fx || []).filter(f => +f.GW === D.gw).map(f => f.Home + ' v ' + f.Away));
  for (let i = 0; i < fx.length; i++) {
    await go('#/matchday/matchup/' + i); await page.evaluate(() => { const b = document.querySelector('[data-md-tab="formation"]'); b && b.click(); }); await page.waitForTimeout(300);
    const bar = await page.evaluate(() => [...document.querySelectorAll('.md-tb')].map(b => ({ team: (b.querySelector('b') || {}).textContent, sub: (b.querySelector('.sub') || {}).textContent })));
    check('matchup ' + (i + 1) + ' (' + fx[i] + '): the team bars carry a manager line under the team name, never the team name twice', bar.length === 2 && bar.every(b => b.team && b.sub && !b.sub.startsWith(b.team)), JSON.stringify(bar));
    await scan('matchup ' + (i + 1) + ' formation (' + fx[i] + ')');
    if (i === 0) { for (const t of ['list', 'stats', 'history']) { await tap('[data-md-tab="' + t + '"]'); await scan('matchup 1 ' + t); } await tap('[data-md-tab="formation"]'); }
  }
  for (const s of ['all', 'pl', 'week']) { await go('#/matchday/' + s); await scan('matchday ' + s); }

  /* My team */
  await go('#/team/overview');
  if (await page.$('[data-pick]')) { await tap('[data-pick="' + team + '"]') || await tap('[data-pick]'); }
  const head = await page.evaluate(() => ({ team: (document.querySelector('.tm-head h1') || {}).textContent, mgr: (document.querySelector('.tm-mgr') || {}).textContent }));
  check('My team: the header shows the manager\'s name under the team name', !!head.team && !!head.mgr && head.mgr.trim() !== head.team.trim(), JSON.stringify(head));
  await scan('team overview');
  await go('#/team/lineup'); await tap('[data-lview="pitch"]'); await scan('team lineup pitch');
  await tap('[data-lview="list"]'); await scan('team lineup list'); await tap('[data-lview="pitch"]');
  for (const s of ['squad', 'transfers', 'fixtures', 'season']) { await go('#/team/' + s); await scan('team ' + s); }

  /* League */
  for (const s of ['overview', 'results', 'money', 'derbies', 'stats']) { await go('#/league/' + s); await scan('league ' + s); }

  /* Feed */
  for (const s of ['league', 'foryou', 'articles', 'messages']) { await go('#/feed/' + s); await scan('feed ' + s); }
  }

  /* the sheets: a player who is owned and starts, a free agent, a doubt; a manager; the menu; How it works; search; club
     identity; a Feed post */
  await go('#/team/lineup');
  const codes = await page.evaluate(t => { const ro = D.ro || [], plr = D.plr || []; const mine = ro.filter(p => p.Team === t); const owned = ro.find(p => p.Team === t && (p.Status === 'a' || !p.Status)) || mine[0] || ro[0]; const doubt = ro.find(p => p.Status === 'd') || ro.find(p => p.Status === 'i' || p.Status === 's') || null; const ownedCodes = new Set(ro.map(p => String(p.Code))); const fa = plr.find(p => !ownedCodes.has(String(p.Code)) && +(p['Total points'] || p.Pts || 0) > 10) || plr.find(p => !ownedCodes.has(String(p.Code))); return { owned: owned && String(owned.Code), ownedTeam: owned && owned.Team, doubt: doubt && String(doubt.Code), fa: fa && String(fa.Code) }; }, team);
  if (codes.owned) {
    await page.evaluate(c => window.MW.openSheet('player', c), codes.owned); await sheetOpen();
    const own = await page.evaluate(() => ({ pill: (document.querySelector('.sk-player .ps-own') || {}).textContent || '', fa: !!document.querySelector('.sk-player .ps-own.fa'), name: (document.querySelector('.sk-player .ps-name') || {}).textContent || '', web: (document.querySelector('.sk-player .ps-web') || {}).textContent || '' }));
    check('player sheet (owned): the owner pill names his team, not Free agent', !own.fa && own.pill.includes(codes.ownedTeam), JSON.stringify(own));
    check('player sheet: no second name line that is part of the full name', !own.web || !own.name.toLowerCase().includes(own.web.toLowerCase()), JSON.stringify({ name: own.name, web: own.web }));
    await scan('player sheet, owned', { sheet: true });
    for (const t of ['matches', 'ratings']) { if (await tap('.sk-player [data-tab="' + t + '"]')) await scan('player sheet, ' + t, { sheet: true }); }
    await closeSheets();
  }
  if (codes.fa) { await page.evaluate(c => window.MW.openSheet('player', c), codes.fa); await sheetOpen(); await scan('player sheet, free agent', { sheet: true }); await closeSheets(); }
  if (codes.doubt) { await page.evaluate(c => window.MW.openSheet('player', c), codes.doubt); await sheetOpen(); await scan('player sheet, a doubt', { sheet: true }); await closeSheets(); }
  await page.evaluate(t => window.MW.openSheet('manager', t), team); await sheetOpen(); await scan('manager sheet', { sheet: true });
  for (const t of ['season', 'squad']) { if (await tap('.sk-manager [data-tab="' + t + '"]')) await scan('manager sheet, ' + t, { sheet: true }); }
  await closeSheets();
  await page.evaluate(() => window.MW.openSheet('menu')); await sheetOpen(); await scan('menu', { sheet: true }); await closeSheets();
  await page.evaluate(() => window.MW.openSheet('menu', 'how')); await sheetOpen(); await scan('menu, how it works', { sheet: true }); await closeSheets();
  await page.evaluate(() => window.MW.openSheet('search')); await sheetOpen(); await page.evaluate(() => { const i = document.querySelector('.sk-search input'); if (i) { i.value = 'sa'; i.dispatchEvent(new Event('input', { bubbles: true })); } }); await page.waitForTimeout(500); await scan('search', { sheet: true }); await closeSheets();
  await page.evaluate(() => window.MW.openSheet('identity')); await page.waitForTimeout(300); if (await page.$('.sheet')) { await sheetOpen(); await scan('club identity', { sheet: true }); await closeSheets(); }
  await go('#/feed/league');
  const postId = await page.evaluate(() => { const a = document.querySelector('[data-open^="post:"]'); return a ? a.getAttribute('data-open').slice(5) : ''; });
  if (postId) { await page.evaluate(id => window.MW.openSheet('post', id), postId); await page.waitForTimeout(300); if (await page.$('.sheet')) { await sheetOpen(); await scan('feed post', { sheet: true }); await closeSheets(); } }

  check('no console errors during the walk', errors.length === 0, errors.slice(0, 4).join(' || '));
  if (offsite.length) console.log('  note: ' + offsite.length + ' third-party image or font requests failed on this network (a crest, flag or font host): ' + [...new Set(offsite.map(u => u.replace(/^https?:\/\/([^/]+).*/, '$1')))].join(', '));
  await browser.close(); srv.close();

  const R = L.report(offenders, screensDone.length);
  console.log('');
  R.lines.slice(0, listN).forEach(l => console.log('  ' + l));
  if (R.lines.length > listN) console.log('  ... and ' + (R.lines.length - listN) + ' more groups');
  if (report) fs.writeFileSync(report, JSON.stringify({ at, snapshot: index.taken || null, width, screens: screensDone, texts, offenders, groups: R.groups, checks }, null, 1));
  const failedChecks = checks.filter(c => !c.ok).length;
  console.log((offenders.length ? 'CONTRAST FAIL: ' : 'CONTRAST OK: ') + R.head + ', ' + texts + ' text boxes read' + (failedChecks ? '; ' + failedChecks + ' check' + (failedChecks === 1 ? '' : 's') + ' failed' : ''));
  process.exit(offenders.length || failedChecks ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
