/* league/chart.js — one clean SVG line chart for the Stats page.
   Grey for everyone not picked; picked managers in their team colour (you in you-blue), each labelled at its end.
   A readout above the plot shows the values at one gameweek (the latest by default); tap or drag to move it. */
import * as UI from '../../ui.js';

const esc = UI.esc;
function niceStep(span, n) {
  const raw = span / Math.max(1, n), p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
}
/* opts: {id, xs:[gw], series:[{key,label,color,on,vals:[{g,v,live}]}], fmt, zero, floor0, unit} */
export function lineChart(o) {
  const W = 344, H = 196, L = 30, R = 62, T = 12, B = 24;
  const xs = o.xs, n = xs.length;
  if (!n) return '';
  const all = o.series.flatMap(s => s.vals.map(v => v.v));
  let lo = Math.min(...all), hi = Math.max(...all);
  if (o.zero || o.floor0) { lo = Math.min(0, lo); hi = Math.max(0, hi); }
  if (hi - lo < 1) { hi += 1; lo -= o.floor0 ? 0 : 1; }
  const step = niceStep(hi - lo, 4);
  lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;
  if (o.floor0 && lo < 0) lo = 0;
  const px = i => n === 1 ? L + (W - L - R) / 2 : L + i * (W - L - R) / (n - 1);
  const py = v => T + (hi - v) / (hi - lo || 1) * (H - T - B);
  const xi = {}; xs.forEach((g, i) => { xi[g] = i; });
  let g = '';
  /* grid + y ticks */
  for (let v = lo, k = 0; v <= hi + 1e-9 && k < 12; k++, v = lo + k * step) {
    const y = py(v).toFixed(1), isZero = Math.abs(v) < 1e-9 && o.zero;
    g += '<line x1="' + L + '" x2="' + (W - R + 6) + '" y1="' + y + '" y2="' + y + '" class="' + (isZero ? 'z' : 'gl') + '"/>'
      + '<text x="' + (L - 6) + '" y="' + (+y + 3.5) + '" class="yt" text-anchor="end">' + (o.fmtAxis ? o.fmtAxis(v) : Math.round(v * 10) / 10) + '</text>';
  }
  /* x labels: thin them out when the season gets long */
  const every = n <= 10 ? 1 : n <= 20 ? 2 : n <= 30 ? 3 : 4;
  xs.forEach((gw, i) => { if (i % every === 0 || i === n - 1) g += '<text x="' + px(i).toFixed(1) + '" y="' + (H - 7) + '" class="xt" text-anchor="middle">' + gw + '</text>'; });
  const path = s => {
    const pts = s.vals.filter(v => xi[v.g] != null).map(v => [px(xi[v.g]), py(v.v), v]);
    return pts;
  };
  /* grey context first, then the picked lines on top */
  const order = o.series.slice().sort((a, b) => (a.on ? 1 : 0) - (b.on ? 1 : 0));
  order.forEach(s => {
    const p = path(s); if (!p.length) return;
    const d = p.map((q, i) => (i ? 'L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join('');
    if (!s.on) { g += p.length > 1 ? '<path d="' + d + '" class="ctx"/>' : '<circle cx="' + p[0][0].toFixed(1) + '" cy="' + p[0][1].toFixed(1) + '" r="2.5" class="ctxd"/>'; return; }
    if (p.length > 1) g += '<path d="' + d + '" class="on" style="stroke:' + s.color + '"/>';
    p.forEach((q, i) => { if (q[2].live || i === p.length - 1 || p.length === 1) g += '<circle cx="' + q[0].toFixed(1) + '" cy="' + q[1].toFixed(1) + '" r="4" class="' + (q[2].live ? 'lvd' : 'dot') + '" style="' + (q[2].live ? 'stroke:' : 'fill:') + s.color + '"/>'; });
  });
  /* end labels: no overlaps, leader lines when nudged */
  const ends = o.series.filter(s => s.on).map(s => { const p = path(s); const q = p[p.length - 1]; return q ? { s, x: q[0], y: q[1], ly: q[1] } : null; }).filter(Boolean).sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) if (ends[i].ly - ends[i - 1].ly < 13) ends[i].ly = ends[i - 1].ly + 13;
  const over = ends.length ? ends[ends.length - 1].ly - (H - B) : 0;
  if (over > 0) ends.forEach(e => { e.ly -= over; });
  ends.forEach(e => {
    const lx = W - R + 10;
    g += '<path d="M' + (e.x + 5).toFixed(1) + ' ' + e.y.toFixed(1) + 'L' + (lx - 3) + ' ' + e.ly.toFixed(1) + '" class="ld"/>'
      + '<text x="' + lx + '" y="' + (e.ly + 3.5).toFixed(1) + '" class="el">' + esc(e.s.label) + '</text>';
  });
  /* crosshair + hit columns */
  const last = n - 1;
  g += '<line class="cx" x1="' + px(last).toFixed(1) + '" x2="' + px(last).toFixed(1) + '" y1="' + T + '" y2="' + (H - B) + '"/>';
  /* readouts, one per gameweek (the latest shows) */
  const on = o.series.filter(s => s.on);
  const ro = xs.map((gw, i) => '<div class="ro" data-i="' + i + '"' + (i === last ? '' : ' hidden') + '><b>GW' + gw + '</b>'
    + on.map(s => ({ s, v: s.vals.find(q => q.g === gw) })).sort((a, b) => (b.v ? b.v.v : -1e9) - (a.v ? a.v.v : -1e9)).map(({ s, v }) => { return '<span><i style="background:' + s.color + '"></i>' + esc(s.label) + ' <b class="n">' + (v ? o.fmt(v.v) : '–') + '</b>' + (v && v.live ? '<em>live</em>' : '') + '</span>'; }).join('')
    + '</div>').join('');
  return '<div class="lg-chart" id="' + o.id + '" data-n="' + n + '" data-l="' + L + '" data-r="' + R + '" data-w="' + W + '">'
    + '<div class="ros" aria-live="polite">' + ro + '</div>'
    + '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="' + esc(o.label || '') + '" tabindex="0">' + g + '</svg></div>';
}
