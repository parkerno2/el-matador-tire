/* fplgg/tools/contrast/lib.js — the pure rules of the contrast audit (Parker, 10 Oct 2026: "a contrast pass on the
   entire app"). No browser here: colour parsing, WCAG luminance and contrast, compositing a translucent colour over a
   background, which rule a piece of text falls under, whether a colour is the app's purple, and the grouping of a run's
   offenders into a readable list. audit.js injects `PAGE_FNS` into the page as source (toString), so the functions it
   lists use nothing outside themselves. The thresholds are DESIGN.md's: a number 7:1, other text 4.5:1, display type
   of 24 px and up 3:1. */
'use strict';

/* ---------- colours ---------- */
const NAMED = { white: [255, 255, 255, 1], black: [0, 0, 0, 1], transparent: [0, 0, 0, 0] };
/* "#RGB", "#RRGGBB", "#RRGGBBAA", "rgb(r, g, b)", "rgba(r, g, b, a)", "rgb(r g b / a)", white, black, transparent → [r, g, b, a]; null when unreadable */
function parseColor(s) {
  s = String(s || '').trim().toLowerCase();
  if (NAMED[s]) return NAMED[s].slice();
  let m = /^#([0-9a-f]{3,8})$/.exec(s);
  if (m) {
    const h = m[1];
    if (h.length === 3 || h.length === 4) { const v = h.split('').map(c => parseInt(c + c, 16)); return [v[0], v[1], v[2], h.length === 4 ? v[3] / 255 : 1]; }
    if (h.length === 6 || h.length === 8) { const v = [0, 2, 4, 6].map(i => parseInt(h.slice(i, i + 2), 16)); return [v[0], v[1], v[2], h.length === 8 ? v[3] / 255 : 1]; }
    return null;
  }
  m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/.exec(s);
  if (m) { let a = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]); return [+m[1], +m[2], +m[3], Math.max(0, Math.min(1, a))]; }
  return null;
}
const hex2 = v => ('0' + Math.round(Math.max(0, Math.min(255, v))).toString(16)).slice(-2).toUpperCase();
const hex = rgb => '#' + hex2(rgb[0]) + hex2(rgb[1]) + hex2(rgb[2]);
/* WCAG relative luminance of an opaque [r, g, b] */
function luminance(rgb) {
  const c = [0, 1, 2].map(i => { const v = rgb[i] / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
/* the WCAG contrast ratio of two opaque colours, 1 to 21 */
function contrast(a, b) { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
/* [r, g, b, a] composited over an opaque [r, g, b] */
function over(fg, bg) { const a = fg.length > 3 ? fg[3] : 1; return [0, 1, 2].map(i => fg[i] * a + bg[i] * (1 - a)); }
/* hue (0 to 360), saturation and lightness (0 to 1) of an opaque [r, g, b] */
function hsl(rgb) {
  const r = rgb[0] / 255, g = rgb[1] / 255, b = rgb[2] / 255, max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s, l };
}
/* the app's purple (the brand tokens --p900 to --p100 and the fills the engine draws): a hue from 255 to 305 with real
   saturation and chroma. The dark surfaces (#17121D, #1E122D: a touch of violet in the tint) are not purple: their
   chroma is under 12%. */
function isPurple(rgb) {
  const { h, s, l } = hsl(rgb);
  const chroma = (Math.max(rgb[0], rgb[1], rgb[2]) - Math.min(rgb[0], rgb[1], rgb[2])) / 255;
  return h >= 255 && h <= 305 && s >= 0.25 && chroma >= 0.12 && l >= 0.07;
}

/* ---------- which rule ---------- */
/* a stat or a number: digits with the marks numbers carry (a decimal point, a thousands comma, a sign, a percent, a
   dash between two scores, a minute mark, a times sign) and at most a short unit or ordinal suffix (pts, xP, st, m, k, x,
   W-D-L records are letters and dashes and are not numbers). The numeric font (class n) is a number whatever it says:
   it is what the app uses for a stat. */
const NUM_RE = /^[\s(+\-−–—$]*\d[\d.,:%+\-−–—\s'’′″xX\/]*(?:\s?(?:st|nd|rd|th|pts?|pt|xp|xg|xa|m|k|g|a|cs|mins?|min|h|d|x|%))?[\s)]*$/i;
function isNumeric(text) { return NUM_RE.test(String(text || '').trim()) && /\d/.test(text); }
/* the rule for a piece of text: { kind, min } — 'number' 7, 'large' 3 (24 px and up, the display type), 'text' 4.5.
   cls is the element's class attribute, so class "n" (the numeric font) counts as a number. */
function ruleFor(text, cls, fontSize) {
  const classes = String(cls || '').split(/\s+/);
  if (classes.includes('n') || isNumeric(text)) return { kind: 'number', min: 7 };
  if (fontSize >= 24) return { kind: 'large', min: 3 };
  return { kind: 'text', min: 4.5 };
}

/* ---------- a text's reading ---------- */
/* the contrast of a text colour (translucent allowed, alpha already multiplied by the element's opacity) against the
   darkest and the lightest opaque colour sampled behind it: the lower of the two is what counts. Returns
   { fg: hex of the colour as painted over the median background, dark, light, ratio, ratioDark, ratioLight } */
function reading(color, dark, light, median) {
  const fgD = over(color, dark), fgL = over(color, light), fgM = over(color, median || dark);
  const rd = contrast(fgD, dark), rl = contrast(fgL, light);
  return { fg: hex(fgM), dark: hex(dark), light: hex(light), ratio: Math.min(rd, rl), ratioDark: rd, ratioLight: rl };
}
/* what a sampled text rect says: the offending rule names, or none */
function verdict(rule, read, opt) {
  const out = [];
  if (read.ratio < rule.min) out.push(rule.kind + ' needs ' + rule.min + ':1');
  if (rule.kind === 'number' && opt && !opt.plate) {
    if (isPurple(opt.medianRGB)) out.push('a number on purple');
    if (isPurple(opt.fgRGB)) out.push('a number in purple');
  }
  return out;
}

/* ---------- the list ---------- */
const r1 = x => Math.round(x * 10) / 10;
/* offenders grouped by screen, selector signature, colours and rule, worst first inside a screen; each group carries its
   count, its worst ratio and one example text */
function group(offenders) {
  const g = {};
  offenders.forEach(o => {
    const k = [o.screen, o.sel, o.fg, o.why.join('; ')].join('|');
    if (!g[k]) g[k] = { screen: o.screen, sel: o.sel, fg: o.fg, dark: o.dark, light: o.light, rule: o.rule, why: o.why, ratio: o.ratio, text: o.text, size: o.size, n: 0 };
    const x = g[k]; x.n++;
    if (o.ratio < x.ratio) { x.ratio = o.ratio; x.dark = o.dark; x.light = o.light; x.text = o.text; }
  });
  return Object.values(g).sort((a, b) => a.screen.localeCompare(b.screen) || a.ratio - b.ratio);
}
function line(x) {
  return x.screen + '  ' + x.sel + '  "' + String(x.text).slice(0, 40) + '"  ' + x.fg + ' on ' + x.dark + (x.light !== x.dark ? '..' + x.light : '') + '  ' + r1(x.ratio) + ':1  ' + x.why.join('; ') + (x.n > 1 ? '  (x' + x.n + ')' : '') + (x.size ? '  ' + x.size + 'px' : '');
}
function report(offenders, screens) {
  const groups = group(offenders);
  const lines = groups.map(line);
  const head = offenders.length + ' offender' + (offenders.length === 1 ? '' : 's') + ' in ' + groups.length + ' group' + (groups.length === 1 ? '' : 's') + ' across ' + screens + ' screen' + (screens === 1 ? '' : 's');
  return { groups, lines, head };
}

/* the functions audit.js injects into the page (self-contained: they call only each other) */
const PAGE_FNS = { NAMED, NUM_RE, parseColor, luminance, contrast, over, hex2, hex, isNumeric, ruleFor };

module.exports = { parseColor, hex, luminance, contrast, over, hsl, isPurple, isNumeric, ruleFor, reading, verdict, group, line, report, PAGE_FNS, NUM_RE, NAMED };
