/* fplgg/tools/gallery/lib.js — the pure rules of the screenshot gallery and its invariant checks (Parker's Q4, 10 Oct
   2026: "the scheduled agents seem sloppy, we need a better way to oversee them"). No browser here: the text rules (NaN,
   undefined and null shown as words; em and en dashes), the duplicate rule for a team view, the readable list of
   findings, and the gallery's index page. gallery.js injects `PAGE_FNS` into the page as source (toString), so the
   functions it lists use nothing outside themselves. Unit-tested in tests/app-gallery.js. */
'use strict';

/* ---------- text rules ---------- */
/* a value that was never computed, shown as a word: NaN, undefined, null (whole words; "nullify" or "Nancy" are not) */
const BAD_WORD_RE = /(^|[^A-Za-z])(NaN|undefined|null)(?![A-Za-z])/;
function badWords(text) { const m = BAD_WORD_RE.exec(String(text || '')); return m ? m[2] : ''; }

/* the dash rule (DESIGN.md: no em or en dashes in generated text; the review invariants of 10 Oct 2026: none in UI text).
   An em dash anywhere, or an en dash in prose (a word on either side of it), is a failure. An en dash that is part of a
   figure is a typographic dash and BUGS.md #43, which waits for Parker's word (hyphens everywhere, or the en dash kept in
   scores), so it is noted, never a failure: tight between two figures or letters ("14–29", "W–D–L", "46.2–48.1"), a
   score with spaces ("37.8 – 45.2"), a minus before a figure ("–1"), or standing alone as the blank value. Word joiners
   (U+2060) around a dash are ignored. */
function dashKind(text) {
  const t = String(text || '').replace(/\u2060/g, '');
  if (/\u2014/.test(t)) return 'fail';
  if (!/\u2013/.test(t)) return '';
  if (t.trim() === '\u2013') return 'noted';
  const rest = t
    .replace(/[0-9.%]+\s*\u2013\s*(?=[0-9])/g, '0')          /* a score or a range, spaced or not */
    .replace(/[A-Za-z0-9.%]\u2013(?=[A-Za-z0-9])/g, 'x')      /* a record, tight: W–D–L */
    .replace(/(^|[\s(])\u2013(?=[0-9])/g, '$1');            /* a minus */
  return /\u2013/.test(rest) ? 'fail' : 'noted';
}

/* ---------- the duplicate rule ---------- */
/* the surfaces that show a team's XI and bench: the Matchup pitch, list and bench, My team > Lineup's pitch, bench and
   list, the manager sheet's pitch and bench. A highlight strip (the Matchup's decisive players, the manager sheet's top
   scorer) may repeat a player and is not one of them. Within one screen a player code appears at most once across them
   (BUGS.md #37: Tzolis in the XI and on the bench at once). */
const TEAM_VIEW_SEL = '.md-pitch, .md-bench, .md-list, .tm-pitch, .tm-bench, .tm-list, .ms-pitch, .ms-bench';
/* codes: [{ code, where }] as collected on a screen → [{ code, where: [..] }] for each code seen more than once */
function duplicates(codes) {
  const seen = new Map();
  (codes || []).forEach(c => { const k = String(c.code); if (!seen.has(k)) seen.set(k, []); seen.get(k).push(c.where); });
  const out = [];
  seen.forEach((where, code) => { if (where.length > 1) out.push({ code, where }); });
  return out;
}

/* ---------- the findings ---------- */
/* a finding: { kind, screen, browser, state, detail }; kinds: duplicate, text, dash, overflow, clipped, broken, console, ea, sheet, screen */
const KIND_WORDS = {
  duplicate: 'a player twice in one team view', text: 'NaN, undefined or null shown', dash: 'an em or en dash in UI text',
  overflow: 'horizontal overflow', clipped: 'clipped text', broken: 'a word broken across lines', console: 'a console error', ea: 'an EA asset requested',
  sheet: 'a sheet that did not render', screen: 'a screen that did not render',
};
/* the readable list: one line per finding, grouped by kind, the kinds in a fixed order */
function lines(findings) {
  const out = [];
  Object.keys(KIND_WORDS).forEach(k => {
    const mine = (findings || []).filter(f => f.kind === k);
    if (!mine.length) return;
    out.push(KIND_WORDS[k] + ' (' + mine.length + ')');
    mine.forEach(f => out.push('  ' + f.screen + ' [' + f.browser + ', ' + f.state + ']: ' + f.detail));
  });
  return out;
}

/* ---------- the index page ---------- */
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/* shots: [{ state, stateLabel, browser, screen, file }] in walk order; meta: { build, from, branch, at, snapshot, width, browsers, states, findings, noted }.
   One page: a header with the build and the verdict, then per state every screen in order, the browsers side by side,
   so a change is reviewed by scrolling one page. No external script or font. */
function indexHtml(shots, meta) {
  const m = meta || {};
  const states = m.states || [];
  const browsers = m.browsers || [];
  const findings = m.findings || [];
  const screensOf = st => { const seen = []; shots.filter(s => s.state === st).forEach(s => { if (!seen.includes(s.screen)) seen.push(s.screen); }); return seen; };
  const fileOf = (st, br, sc) => { const s = shots.find(x => x.state === st && x.browser === br && x.screen === sc); return s ? s.file : ''; };
  const verdict = findings.length ? findings.length + ' finding' + (findings.length === 1 ? '' : 's') : 'every check passed';
  const findingsHtml = findings.length ? '<ol class="f">' + lines(findings).map(l => '<li' + (l.startsWith('  ') ? '' : ' class="k"') + '>' + esc(l.trim()) + '</li>').join('') + '</ol>' : '';
  const notedHtml = m.noted && m.noted.length ? '<details><summary>Noted, not failed: ' + m.noted.length + ' (en dashes in figures, BUGS.md #43, Parker\'s call; secondary lines that give way)</summary><ul class="f">' + m.noted.slice(0, 40).map(n => '<li>' + esc(n.screen) + ': ' + esc(n.detail) + '</li>').join('') + '</ul></details>' : '';
  const sections = states.map(st => {
    const sl = (m.stateLabels || {})[st] || st;
    const rows = screensOf(st).map((sc, i) => '<section class="s"><h3>' + String(i + 1).padStart(2, '0') + ' ' + esc(sc) + '</h3><div class="row">'
      + browsers.map(br => { const f = fileOf(st, br, sc); return '<figure><figcaption>' + esc(br) + '</figcaption>' + (f ? '<a href="' + esc(f) + '"><img loading="lazy" src="' + esc(f) + '" alt="' + esc(sc + ', ' + br + ', ' + sl) + '" width="' + (m.width || 390) + '"></a>' : '<p class="miss">no screenshot</p>') + '</figure>'; }).join('')
      + '</div></section>').join('');
    return '<h2 id="' + esc(st) + '">' + esc(sl) + '</h2>' + rows;
  }).join('');
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Matchweek gallery</title>'
    + '<meta name="robots" content="noindex"><style>'
    + 'body{margin:0;background:#0E0A13;color:#EDE7F3;font:15px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}'
    + 'header{padding:20px 16px 8px;border-bottom:1px solid #2A2236}h1{font-size:20px;margin:0 0 6px}h2{font-size:17px;margin:28px 16px 8px;padding-top:12px;border-top:1px solid #2A2236}'
    + 'h3{font-size:14px;margin:18px 16px 6px;color:#C4BBD2;font-weight:600}.meta{color:#A398B2;font-size:13px}.ok{color:#40D085}.bad{color:#FF9598}'
    + '.row{display:flex;gap:12px;padding:0 16px;overflow-x:auto}figure{margin:0}figcaption{font-size:12px;color:#A398B2;margin-bottom:4px}img{display:block;width:' + (m.width || 390) + 'px;max-width:85vw;height:auto;border:1px solid #2A2236;border-radius:8px;background:#17121D}'
    + '.miss{color:#FF9598;font-size:13px}.f{margin:8px 16px;padding-left:20px;font-size:13px}.f .k{color:#FF9598;list-style:none;margin-left:-20px;margin-top:6px}details{margin:8px 16px;font-size:13px;color:#A398B2}'
    + 'nav{padding:8px 16px;font-size:13px}nav a{color:#9AB0FF;margin-right:14px}'
    + '</style></head><body><header><h1>Matchweek gallery</h1><div class="meta">'
    + 'build ' + esc(m.build || '') + (m.from ? ' from ' + esc(m.from) : '') + (m.branch ? ' (' + esc(m.branch) + ')' : '') + ' · snapshot ' + esc(m.snapshot || '') + ' · ' + esc(m.width || 390) + ' px · ' + browsers.map(esc).join(' and ')
    + '</div><div class="meta">Checks: <b class="' + (findings.length ? 'bad' : 'ok') + '">' + esc(verdict) + '</b></div></header>'
    + (m.alt ? '<p class="alt"><a href="' + esc(m.alt) + '">The same screens at another width</a></p>' : '')
    + findingsHtml + notedHtml
    + '<nav>' + states.map(st => '<a href="#' + esc(st) + '">' + esc((m.stateLabels || {})[st] || st) + '</a>').join('') + '</nav>'
    + sections + '</body></html>\n';
}

/* ---------- in the page ---------- */
/* the functions injected into the page by gallery.js (as source): they use only each other */
const PAGE_FNS = { BAD_WORD_RE, badWords, dashKind, TEAM_VIEW_SEL };

module.exports = { BAD_WORD_RE, badWords, dashKind, TEAM_VIEW_SEL, duplicates, KIND_WORDS, lines, indexHtml, esc, PAGE_FNS };
