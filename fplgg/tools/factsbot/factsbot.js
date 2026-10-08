#!/usr/bin/env node
/* factsbot.js — the Facts bot (ROADMAP A0): the gameweek facts without anyone's phone.
   Loads the live Matchweek app headless in Chromium, has the app's own engine compute the preview facts
   (MW.facts.preview, what a phone posts as `showfacts`) and the recap facts (MW.facts.recap, what a phone posts as
   `artfacts`), and writes them to facts/preview-gw<N>.json and facts/recap-gw<N>.json when they change, plus
   facts/index.json (which files exist, when each last changed). The workflow .github/workflows/facts.yml runs it every
   3 hours and commits the files to the repo's `facts` branch; Code.gs (v3.15+) reads them from there whenever a
   phone's facts are missing or older, after the same checks a phone's facts pass.
   The windows are the phones' (src/feed/showfacts.js): preview facts in the last 54 hours before the deadline, recap
   facts for 5 days after the finished gameweek's last kick-off. The file content is byte for byte the JSON a phone
   would send (same engine, same trimming to 60,000 characters).
     node factsbot.js --out <dir>        write into <dir> (default ./facts)
     MW_APP_URL=<url>                    the app to load (default the live app)
     MW_FORCE=yes | --force              write both kinds even outside their windows (a dispatch input)
   Exit 0 when every due kind was written or unchanged, 1 when the app could not be loaded at all. A kind that could
   not be computed is reported in the step summary and in the `failed` output; the workflow fails after committing. */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');

const APP_URL = process.env.MW_APP_URL || 'https://parkerno2.github.io/el-matador-tire/';
const PREVIEW_WINDOW = 54 * 3600e3, RECAP_WINDOW = 5 * 864e5, CAP = 60000;   /* as src/feed/showfacts.js */
const BOT = 'Facts bot', VERSION = '1.0';
const KINDS = ['preview', 'recap'];

/* ---------- what runs inside the page (serialised by Playwright, so no closures over this file) ---------- */
const PAGE = {
  ready: () => !!(window.MW && window.MW.facts && typeof D !== 'undefined' && D.ro && D.ro.length > 0),
  state: () => {
    const dl = typeof gwDeadline === 'function' ? gwDeadline(D.gw) : null;
    const src = ((document.querySelector('script[src*="app.js?v="]') || {}).src || '');
    return { gw: Number(D.gw) || 0, dlPassed: !!D.dlPassed, deadline: dl && !isNaN(dl) ? dl.toISOString() : null,
      gwsDone: Number(D.gwsDone) || 0, build: (/v=(\d+)/.exec(src) || [])[1] || '' };
  },
  /* the preview facts as the phone sends them: JSON, rosters dropped when over the cap */
  preview: (CAP) => {
    const f = MW.facts.preview();
    if (!f || !Array.isArray(f.fixtures) || !f.fixtures.length) return { none: 'no fixtures for GW' + (f && f.gw) };
    let body = JSON.stringify(f);
    if (body.length > CAP) { delete f.rosters; body = JSON.stringify(f); }
    return body.length > CAP ? { none: 'over ' + CAP + ' characters' } : { body, gw: Number(f.gw) || 0 };
  },
  /* the recap facts as the phone sends them: bench club and minutes, then rosters, dropped when over the cap */
  recap: (CAP) => {
    const f = MW.facts.recap();
    if (!f || !f.gw) return { none: 'no finished gameweek yet' };
    if (!Array.isArray(f.fixtures) || !f.fixtures.length) return { none: 'no fixtures for GW' + f.gw };
    const kos = (f.pl || []).map(p => p && p.ko).filter(Boolean).sort();
    let body = JSON.stringify(f);
    if (body.length > CAP) {
      f.fixtures.forEach(x => [x.H, x.A].forEach(s => (s && s.bench || []).forEach(b => { delete b.club; delete b.mins; })));
      delete f.rosters; body = JSON.stringify(f);
    }
    return body.length > CAP ? { none: 'over ' + CAP + ' characters' } : { body, gw: Number(f.gw) || 0, lastKick: kos.length ? kos[kos.length - 1] : null };
  },
};

/* ---------- the pure parts (tests/factsbot.js) ---------- */
/* the phones' windows: which kinds are due now. state: { dlPassed, deadline }, recap: { gw, lastKick } */
function due(state, recap, now, force) {
  const out = {};
  const dl = state && state.deadline ? Date.parse(state.deadline) : NaN;
  if (force) out.preview = { due: true, why: 'forced' };
  else if (!state || state.dlPassed) out.preview = { due: false, why: 'the deadline has passed' };
  else if (isNaN(dl)) out.preview = { due: false, why: 'no deadline for GW' + (state.gw || '?') };
  else if (dl <= now) out.preview = { due: false, why: 'the deadline has passed' };
  else if (dl - now > PREVIEW_WINDOW) out.preview = { due: false, why: 'the deadline is ' + hrs(dl - now) + ' hours away (the window opens at 54)' };
  else out.preview = { due: true, why: 'the deadline is ' + hrs(dl - now) + ' hours away' };
  const g = recap && recap.gw, lk = recap && recap.lastKick ? Date.parse(recap.lastKick) : NaN;
  if (force) out.recap = { due: true, why: 'forced' };
  else if (!g) out.recap = { due: false, why: 'no finished gameweek' };
  else if (isNaN(lk)) out.recap = { due: false, why: 'GW' + g + ' has no kick-off times' };
  else if (now < lk) out.recap = { due: false, why: 'GW' + g + '\'s last game has not kicked off' };
  else if (now - lk > RECAP_WINDOW) out.recap = { due: false, why: 'GW' + g + '\'s last game was ' + Math.floor((now - lk) / 864e5) + ' days ago (the window is 5)' };
  else out.recap = { due: true, why: 'GW' + g + ' finished ' + hrs(now - lk) + ' hours ago' };
  return out;
}
const hrs = ms => Math.round(ms / 36e5 * 10) / 10;

/* '' when the JSON has the shape the server checks before the sheet comparison, else why not */
function shapeError(kind, body) {
  if (typeof body !== 'string' || !body) return 'empty';
  if (body.length > CAP) return 'over ' + CAP + ' characters';
  let f; try { f = JSON.parse(body); } catch (e) { return 'does not parse'; }
  if (!f || typeof f !== 'object' || Array.isArray(f)) return 'not an object';
  if (f.kind !== kind) return 'kind is ' + JSON.stringify(f.kind) + ', not ' + kind;
  if (!(Number(f.gw) > 0)) return 'no gw';
  if (!Array.isArray(f.fixtures) || f.fixtures.length < 1 || f.fixtures.length > 10) return 'fixtures: ' + (Array.isArray(f.fixtures) ? f.fixtures.length : 'missing');
  const seen = {};
  for (const x of f.fixtures) {
    if (!x || typeof x.home !== 'string' || typeof x.away !== 'string' || !x.home.trim() || !x.away.trim()) return 'a fixture without home and away names';
    if (seen[x.home + '|' + x.away]) return 'a fixture twice'; seen[x.home + '|' + x.away] = 1;
    if (kind === 'recap' && (typeof x.hs !== 'number' || typeof x.as !== 'number')) return x.home + ' v ' + x.away + ' has no scores';
    if (!x.H || !x.A || !Array.isArray(x.H.xi) || !Array.isArray(x.A.xi)) return x.home + ' v ' + x.away + ' has no sides';
  }
  if (kind === 'preview' && (!Array.isArray(f.collisions) || !Array.isArray(f.slate))) return 'no collisions or slate (an old app?)';
  return '';
}
const md5 = s => crypto.createHash('md5').update(s, 'utf8').digest('hex');

function readIndex(dir) {
  try { const j = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8')); if (j && typeof j === 'object' && j.files && typeof j.files === 'object') return j; } catch (e) { }
  return { files: {} };
}
/* writes each computed kind when its content changed; returns what happened. computed: { preview: { body, gw, ... } } */
function writeFiles(dir, computed, state, nowIso) {
  fs.mkdirSync(dir, { recursive: true });
  const index = readIndex(dir), res = { changed: [], same: [], index };
  for (const kind of KINDS) {
    const c = computed[kind]; if (!c || !c.body) continue;
    const name = kind + '-gw' + c.gw + '.json', file = path.join(dir, name);
    let old = null; try { old = fs.readFileSync(file, 'utf8'); } catch (e) { }
    const entry = index.files[name] || {};
    if (old === c.body && entry.at) { res.same.push(name); continue; }
    fs.writeFileSync(file, c.body);
    index.files[name] = { kind, gw: c.gw, at: nowIso, chars: c.body.length, md5: md5(c.body), app: state.build || '' };
    if (kind === 'preview' && state.deadline) index.files[name].deadline = state.deadline;
    if (kind === 'recap' && c.lastKick) index.files[name].lastKick = c.lastKick;
    res.changed.push(name);
  }
  if (res.changed.length) {
    index.updated = nowIso; index.app = state.build || index.app || ''; index.bot = BOT + ' ' + VERSION;
    const sorted = {}; Object.keys(index.files).sort().forEach(k => { sorted[k] = index.files[k]; }); index.files = sorted;
    fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify(index, null, 1) + '\n');
  }
  return res;
}

/* ---------- the browser part ---------- */
async function loadApp(url, log) {
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', e => errors.push('page error: ' + String(e && e.message || e).slice(0, 300)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 300)); });
  const t0 = Date.now();
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      await page.goto(url + (url.includes('?') ? '&' : '?') + 'factsbot=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForFunction(PAGE.ready, null, { timeout: 75000 });
      log('app loaded in ' + (Date.now() - t0) + ' ms' + (attempt > 1 ? ' (attempt ' + attempt + ')' : ''));
      return { browser, page, errors };
    } catch (e) {
      log('attempt ' + attempt + ': the app did not load (' + String(e && e.message || e).split('\n')[0].slice(0, 200) + ')');
      if (attempt === 2) { await browser.close(); throw new Error('the app did not load from ' + url); }
    }
  }
}

async function main(argv) {
  const args = argv.slice(2), outDir = args.includes('--out') ? args[args.indexOf('--out') + 1] : 'facts';
  const force = args.includes('--force') || /^yes$/i.test(String(process.env.MW_FORCE || ''));
  const lines = [], log = m => { lines.push(m); console.log(m); };
  const now = Date.now(), nowIso = new Date(now).toISOString().replace(/\.\d{3}Z$/, 'Z');
  const { browser, page, errors } = await loadApp(APP_URL, log);
  const computed = {}, failed = [], skipped = [];
  try {
    const state = await page.evaluate(PAGE.state);
    log('app build ' + (state.build || '?') + ', GW' + state.gw + (state.deadline ? ', deadline ' + state.deadline : '') + (state.dlPassed ? ' (passed)' : '') + ', ' + state.gwsDone + ' gameweeks done');
    for (const kind of KINDS) {
      let r;
      try { r = await page.evaluate(PAGE[kind], CAP); }
      catch (e) { failed.push(kind); log(kind + ': the engine threw: ' + String(e && e.message || e).split('\n')[0].slice(0, 200)); continue; }
      if (r.none) { skipped.push(kind); log(kind + ': nothing to write (' + r.none + ')'); continue; }
      const why = shapeError(kind, r.body);
      if (why) { failed.push(kind); log(kind + ' GW' + r.gw + ': not written, ' + why); continue; }
      computed[kind] = r;
    }
    const d = due(state, computed.recap || { gw: 0 }, now, force);
    for (const kind of KINDS) {
      if (!computed[kind]) continue;
      if (!d[kind].due) { log(kind + ' GW' + computed[kind].gw + ': computed but not due (' + d[kind].why + ')'); delete computed[kind]; skipped.push(kind); }
      else log(kind + ' GW' + computed[kind].gw + ': ' + computed[kind].body.length + ' characters (' + d[kind].why + ')');
    }
    const res = writeFiles(outDir, computed, state, nowIso);
    res.changed.forEach(n => log('wrote ' + n));
    res.same.forEach(n => log(n + ' unchanged'));
    if (errors.length) log('the page reported ' + errors.length + ' error' + (errors.length > 1 ? 's' : '') + ':\n  ' + errors.slice(0, 8).join('\n  '));
    const summary = (res.changed.length ? res.changed.map(n => n.replace(/\.json$/, '').replace(/-gw(\d+)/, ' GW$1')).join(', ') : 'nothing changed') +
      (failed.length ? '; could not compute ' + failed.join(', ') : '');
    out('changed', String(res.changed.length)); out('failed', failed.join(',')); out('summary', summary);
    stepSummary('## Facts bot\n\n' + summary + '\n\n```\n' + lines.join('\n') + '\n```\n');
    return 0;
  } finally { await browser.close(); }
}
function out(k, v) { if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, k + '=' + String(v).replace(/\r?\n/g, ' ') + '\n'); }
function stepSummary(md) { if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md); }

module.exports = { PAGE, due, shapeError, writeFiles, readIndex, PREVIEW_WINDOW, RECAP_WINDOW, CAP, BOT, VERSION };
if (require.main === module) {
  main(process.argv).then(code => process.exit(code)).catch(e => { console.error('Facts bot failed: ' + (e && e.message || e)); process.exit(1); });
}
