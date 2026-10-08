#!/usr/bin/env node
/* monitor.js — the cloud monitor (ROADMAP A2), no AI. .github/workflows/monitor.yml runs it every 15 minutes.
   Checks: the app loads (HTTP 200 and a build stamp); the league sheet answers (the Specials tab, where the web app's
   URL is); the web app's ?health=1 is ok; the data is fresh (?health=1 data.updated, Code.gs v3.17+: 2 hours, or 20
   minutes while a match is live and has been for 20 minutes); the FPL API answers; the Code.gs self-update is not
   refused or in error; and, once the app reports errors (A4), no spike in the last 24 hours.
   A check that fails is probed again 4 minutes later and counts only when it fails both times. Each confirmed problem
   gets one GitHub issue labelled `outage` (created once, its body refreshed on later runs, assigned to the repo owner
   so he is notified), closed by the monitor when the check passes again. Nothing here uses a secret: the workflow's
   own GITHUB_TOKEN writes the issues.
     node monitor.js                 the real thing (needs gh and GH_TOKEN; GH_REPO names the repo)
     node monitor.js --dry-run       probe and assess, print what would be done, touch nothing
     node monitor.js --once          one probe, no 4-minute second look (for a quick local check)
   Exit 0 whenever the monitor itself ran (confirmed problems are reported through issues, not through a red run), 1
   when it could not do its job (gh failing, nothing reachable at all). */
'use strict';
const { execFileSync } = require('child_process');

const APP_URL = process.env.MW_APP_URL || 'https://parkerno2.github.io/el-matador-tire/';
const SHEET = '1rIj4A3-lkSfg1rTuAh3yJL-K7LP4EOYkwWZiItZaoHk';
const SPECIALS_URL = 'https://docs.google.com/spreadsheets/d/' + SHEET + '/gviz/tq?tqx=out:csv&sheet=Specials';
const FPL_URL = 'https://draft.premierleague.com/api/game';
const LIMITS = { dataMin: 120, liveMin: 20, liveSettleMin: 20, errors24h: 20, retryMs: 4 * 60e3, timeoutMs: 25e3 };
const LABEL = 'outage';
const MARK = '<!-- matchweek-monitor:';
const CHECKS = {
  app: { title: 'the app does not load', help: 'GitHub Pages or the last build. Look at the latest "Build Matchweek app" run in the Actions tab and at githubstatus.com. The six root files are rebuilt by that workflow; rerunning it republishes them.' },
  sheet: { title: 'the league sheet does not answer', help: 'Google Sheets itself, or the sheet\'s sharing changed. It must be shared as Anyone with the link, Viewer, and the Specials tab must keep its Setting and Value columns with the API URL row.' },
  health: { title: 'the web app (Apps Script) does not answer', help: 'The Apps Script web app. In the script editor open Executions for the error. If a self-update broke it: Deploy, Manage deployments, edit, pick the previous version. The release branch of the repo holds the last Code.gs that passed every test.' },
  data: { title: 'the data is stale', help: 'The hourly refreshAll trigger or liveTick is not finishing, or FPL is not answering (see the FPL check). In the script editor open Executions and look for refreshAll and liveTick failures; Triggers shows whether they are still installed (run setup() once if not). The app keeps showing the last data it got.' },
  fpl: { title: 'the FPL API does not answer', help: 'FPL\'s own API is down or slow. Nothing on our side fixes it; the app keeps the last data and the refresh catches up when FPL is back. Check draft.premierleague.com in a browser.' },
  selfupdate: { title: 'the Code.gs self-update is refused or in error', help: 'The state text below says why. A refused copy means the release branch has something the script will not install (a lower version, a missing marker, a syntax error, or the manifest lost its webapp section); an error means the Apps Script API call failed. Fix Code.gs on main (the CI gate moves release) or run selfUpdateStatus() in the editor.' },
  errors: { title: 'the app is reporting errors', help: 'Phones are sending errors (window.onerror and unhandled rejections). Read the Errors tab in the sheet, or ?health=1 errors, for the build, route and message; a bad build is undone by reverting the source change (the Build Matchweek app workflow rebuilds).' },
};
const ORDER = Object.keys(CHECKS);
const fmtAge = min => (min >= 120 ? Math.floor(min / 60) + ' h ' + (min % 60) + ' min' : min + ' min');
const stamp = ms => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');

/* ---------- assess: raw probe results -> one line per check { key, ok: true | false | null (skipped), detail } ---------- */
function assess(raw, now) {
  now = now || Date.now();
  const out = [], say = (key, ok, detail) => out.push({ key, ok, detail });
  const bad = r => !r ? 'no answer' : r.error ? r.error : 'HTTP ' + r.status;
  /* app */
  const app = raw.app, build = app && app.status === 200 ? (/app\.js\?v=(\d{14})/.exec(app.text || '') || [])[1] : '';
  if (!app || app.status !== 200) say('app', false, 'the app page: ' + bad(app));
  else if (!build) say('app', false, 'the app page answered 200 but has no build stamp (app.js?v=...); not the Matchweek app');
  else say('app', true, 'build ' + build);
  /* sheet (Specials) */
  const sp = raw.specials, lines = sp && sp.status === 200 ? String(sp.text || '').split(/\r?\n/) : [];
  const head = (lines[0] || '').replace(/\s+$/, '');
  let apiUrl = '';
  if (!sp || sp.status !== 200) say('sheet', false, 'the Specials tab over gviz: ' + bad(sp));
  else if (!/^"Setting","Value"/.test(head)) say('sheet', false, 'gviz returned the wrong sheet for Specials (header ' + JSON.stringify(head.slice(0, 60)) + '); the tab is missing or renamed');
  else {
    const row = lines.find(l => /^"API URL",/.test(l));
    apiUrl = row ? row.replace(/^"API URL",/, '').replace(/^"|"$/g, '').replace(/""/g, '"').trim() : '';
    if (!/^https:\/\/script\.google\.com\//.test(apiUrl)) say('sheet', false, 'the Specials tab has no API URL row pointing at script.google.com');
    else say('sheet', true, 'Specials ok, API URL present');
  }
  /* health */
  const he = raw.health;
  let H = null;
  if (!he) say('health', null, 'not probed: no API URL (the sheet check failed)');
  else if (he.status !== 200) say('health', false, '?health=1: ' + bad(he));
  else {
    try { H = JSON.parse(he.text); } catch (e) { H = null; }
    if (!H || H.ok !== true) say('health', false, '?health=1 answered 200 but not ok: ' + String(he.text || '').slice(0, 120));
    else say('health', true, 'version ' + (H.version || '?') + ', self: ' + String(H.self || '').slice(0, 60));
  }
  /* data */
  if (!H) say('data', null, 'not checked: no health');
  else if (!H.data) say('data', null, 'not checked: this Code.gs (' + (H.version || '?') + ') reports no data block (v3.17 adds it)');
  else {
    const d = H.data, live = !!d.live, since = d.liveSince ? Date.parse(d.liveSince) : NaN;
    const settled = live && !isNaN(since) && now - since >= LIMITS.liveSettleMin * 60e3;
    const limit = settled ? LIMITS.liveMin : LIMITS.dataMin, why = settled ? 'a match is live: ' + d.liveWhy : live ? 'a match just started (' + d.liveWhy + '), the 20-minute rule starts ' + LIMITS.liveSettleMin + ' minutes in' : 'no match live';
    if (d.updated) {
      const age = Math.round((now - Date.parse(d.updated)) / 60e3);
      if (!(age <= limit)) say('data', false, 'last successful refresh ' + d.updated + ', ' + fmtAge(age) + ' ago (limit ' + fmtAge(limit) + '; ' + why + '); last attempt ' + (d.attempted || 'none'));
      else say('data', true, 'refreshed ' + fmtAge(age) + ' ago by ' + (d.source || '?') + ' (limit ' + fmtAge(limit) + '; ' + why + ')');
    } else {
      const att = d.attempted ? Math.round((now - Date.parse(d.attempted)) / 60e3) : null;
      if (att === null || att > LIMITS.dataMin) say('data', false, 'no successful refresh recorded; last attempt ' + (d.attempted ? d.attempted + ', ' + fmtAge(att) + ' ago' : 'none') + ' (limit ' + fmtAge(LIMITS.dataMin) + ')');
      else say('data', null, 'no successful refresh recorded yet since this Code.gs went live; last attempt ' + fmtAge(att) + ' ago, waiting');
    }
  }
  /* fpl */
  const fp = raw.fpl;
  let G = null; if (fp && fp.status === 200) { try { G = JSON.parse(fp.text); } catch (e) { G = null; } }
  if (!fp || fp.status !== 200) say('fpl', false, FPL_URL + ': ' + bad(fp));
  else if (!G || typeof G.current_event !== 'number') say('fpl', false, FPL_URL + ' answered 200 but not the game JSON');
  else say('fpl', true, 'current_event ' + G.current_event + (G.current_event_finished ? ' (finished)' : ''));
  /* self-update */
  if (!H) say('selfupdate', null, 'not checked: no health');
  else { const st = String(H.self || ''); if (/^(refused|error):/.test(st)) say('selfupdate', false, 'self-update state: ' + st.slice(0, 300)); else say('selfupdate', true, st.slice(0, 80) || 'no check yet'); }
  /* errors (A4) */
  if (!H) say('errors', null, 'not checked: no health');
  else if (!H.errors || typeof H.errors.h24 !== 'number') say('errors', null, 'not checked: this Code.gs reports no error count');
  else if (H.errors.h24 >= LIMITS.errors24h) say('errors', false, H.errors.h24 + ' errors from phones in the last 24 hours (limit ' + LIMITS.errors24h + ')' + (H.errors.last ? '; latest: ' + String(H.errors.last.msg || '').slice(0, 160) + ' (' + (H.errors.last.route || '') + ', build ' + (H.errors.last.build || '') + ')' : ''));
  else say('errors', true, H.errors.h24 + ' in the last 24 hours');
  return { checks: out, apiUrl, health: H };
}

/* ---------- issues: what to create, refresh or close ---------- */
function issueKey(issue) { const m = new RegExp(MARK + '([a-z]+) -->').exec(String(issue.body || '')); return m ? m[1] : ''; }
function issueBody(key, detail, now, prev) {
  const first = prev && /first seen (\S+)/.exec(prev.body || ''), n = prev ? Number((/\((\d+) checks?\)/.exec(prev.body || '') || [])[1] || 1) + 1 : 1;
  const firstSeen = first ? first[1] : stamp(now);
  return [MARK + key + ' -->',
    '**What is wrong:** ' + CHECKS[key].title + ': ' + detail + '.',
    '**Checked:** ' + stamp(now) + ', and again 4 minutes earlier; it failed both times.',
    '**History:** first seen ' + firstSeen + (n > 1 ? '; still failing at ' + stamp(now) + ' (' + n + ' checks)' : ' (1 check)') + '.',
    '**What usually helps:** ' + CHECKS[key].help,
    '',
    'This issue is kept by the Monitor workflow (.github/workflows/monitor.yml, every 15 minutes). It closes itself when the check passes again.'].join('\n');
}
function diffIssues(open, confirmed, okKeys, now) {
  const plan = { create: [], update: [], close: [] };
  const byKey = {}; open.forEach(i => { const k = issueKey(i); if (k && !byKey[k]) byKey[k] = i; });
  confirmed.forEach(c => {
    const prev = byKey[c.key];
    if (prev) plan.update.push({ number: prev.number, key: c.key, body: issueBody(c.key, c.detail, now, prev) });
    else plan.create.push({ key: c.key, title: 'Outage: ' + CHECKS[c.key].title, body: issueBody(c.key, c.detail, now, null) });
  });
  okKeys.forEach(o => { const prev = byKey[o.key]; if (prev) plan.close.push({ number: prev.number, key: o.key, comment: 'Recovered at ' + stamp(now) + ': ' + o.detail + '. Closed by the Monitor workflow.' }); });
  return plan;
}

/* ---------- the probes ---------- */
async function fetchText(url, timeoutMs) {
  const ac = new AbortController(), t = setTimeout(() => ac.abort(), timeoutMs || LIMITS.timeoutMs);
  try { const r = await fetch(url, { signal: ac.signal, redirect: 'follow', headers: { 'user-agent': 'matchweek-monitor' } }); return { status: r.status, text: await r.text() }; }
  catch (e) { return { status: 0, error: String(e && e.message || e).split('\n')[0].slice(0, 120) }; }
  finally { clearTimeout(t); }
}
async function probe(deps) {
  const ft = deps.fetchText, cb = '?cb=' + Date.now();
  const [app, specials, fpl] = await Promise.all([ft(APP_URL + cb), ft(SPECIALS_URL), ft(FPL_URL)]);
  let apiUrl = process.env.MW_API_URL || '';
  if (specials && specials.status === 200) { const row = String(specials.text || '').split(/\r?\n/).find(l => /^"API URL",/.test(l)); if (row) apiUrl = row.replace(/^"API URL",/, '').replace(/^"|"$/g, '').replace(/""/g, '"').trim(); }
  const health = apiUrl ? await ft(apiUrl + (apiUrl.includes('?') ? '&' : '?') + 'health=1') : null;
  return { app, specials, fpl, health };
}

/* ---------- gh ---------- */
function ghReal(args, opts) {
  try { return execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
  catch (e) { if (opts && opts.soft) return ''; throw new Error('gh ' + args.slice(0, 3).join(' ') + ' failed: ' + String(e.stderr || e.message).slice(0, 300)); }
}
function applyPlan(plan, gh, assignee, log) {
  gh(['label', 'create', LABEL, '--color', 'B60205', '--description', 'Opened by the Monitor workflow when a check fails twice in a row; closed by it on recovery', '--force'], { soft: true });
  plan.create.forEach(c => { const args = ['issue', 'create', '--title', c.title, '--body', c.body, '--label', LABEL]; if (assignee) args.push('--assignee', assignee); const url = gh(args); log('opened ' + c.key + ': ' + String(url || '').trim()); });
  plan.update.forEach(u => { gh(['issue', 'edit', String(u.number), '--body', u.body]); log('refreshed #' + u.number + ' (' + u.key + ')'); });
  plan.close.forEach(c => { gh(['issue', 'close', String(c.number), '--comment', c.comment]); log('closed #' + c.number + ' (' + c.key + ')'); });
}

/* ---------- main ---------- */
async function main(deps) {
  deps = Object.assign({ fetchText, sleep: ms => new Promise(r => setTimeout(r, ms)), gh: ghReal, now: () => Date.now(), log: m => console.log(m), once: false, dry: false, assignee: process.env.MW_ASSIGNEE || '' }, deps || {});
  const lines = [], log = m => { lines.push(m); deps.log(m); };
  const first = assess(await probe(deps), deps.now());
  first.checks.forEach(c => log((c.ok === true ? 'ok      ' : c.ok === false ? 'FAIL    ' : 'skipped ') + c.key + ': ' + c.detail));
  let final = first.checks;
  const failing = first.checks.filter(c => c.ok === false);
  if (failing.length && !deps.once) {
    log('second look in 4 minutes for: ' + failing.map(c => c.key).join(', '));
    await deps.sleep(LIMITS.retryMs);
    const second = assess(await probe(deps), deps.now());
    final = first.checks.map(c => c.ok === false ? (second.checks.find(s => s.key === c.key) || c) : c);
    final.filter(c => failing.some(f => f.key === c.key)).forEach(c => log('again:  ' + (c.ok === false ? 'FAIL ' : c.ok === true ? 'ok   ' : 'skip ') + c.key + ': ' + c.detail));
  }
  const confirmed = final.filter(c => c.ok === false), okKeys = final.filter(c => c.ok === true);
  if (!first.checks.some(c => c.ok === true)) { log('nothing at all could be reached; the monitor itself cannot judge (network?)'); return { code: 1, confirmed, lines }; }
  let open = [];
  if (!deps.dry) { try { open = JSON.parse(deps.gh(['issue', 'list', '--label', LABEL, '--state', 'open', '--json', 'number,title,body', '--limit', '50']) || '[]'); } catch (e) { log(String(e.message)); return { code: 1, confirmed, lines }; } }
  const plan = diffIssues(open, confirmed, okKeys, deps.now());
  if (deps.dry) { log('dry run: would open ' + plan.create.map(c => c.key).join(', ') + ' | refresh ' + plan.update.map(u => '#' + u.number).join(', ') + ' | close ' + plan.close.map(c => '#' + c.number).join(', ')); }
  else { try { applyPlan(plan, deps.gh, deps.assignee, log); } catch (e) { log(String(e.message)); return { code: 1, confirmed, lines, plan }; } }
  log(confirmed.length ? 'confirmed problems: ' + confirmed.map(c => c.key).join(', ') : 'all checks pass');
  return { code: 0, confirmed, lines, plan };
}
module.exports = { assess, diffIssues, issueBody, issueKey, probe, main, LIMITS, CHECKS, ORDER, APP_URL, SPECIALS_URL, FPL_URL, LABEL };
if (require.main === module) {
  const a = process.argv.slice(2);
  main({ once: a.includes('--once'), dry: a.includes('--dry-run') }).then(r => {
    const fs = require('fs');
    if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, '## Monitor\n\n' + (r.confirmed.length ? 'Confirmed: ' + r.confirmed.map(c => c.key + ' (' + c.detail + ')').join('; ') : 'All checks pass.') + '\n\n```\n' + r.lines.join('\n') + '\n```\n');
    process.exit(r.code);
  }).catch(e => { console.error('Monitor failed: ' + (e && e.stack || e)); process.exit(1); });
}
