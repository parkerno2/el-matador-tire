/* feed/ai-posts.js — posts the AI writer (Apps Script v3.9, Claude) put in the Posts tab. Plain text from the sheet,
   escaped here; Archizio's caps tag goes bold; Clark's come with a thumbnail. Every one says who wrote it. */
import { esc, relTime, short } from './util.js';

const TAG = /^([A-Z][A-Z’'!?\s.-]{2,40}\.)\s/;
export function aiPosts() {
  const rows = (D && D.aiPosts) || [];
  return rows.map(r => {
    const voice = String(r.Voice).toLowerCase(); if (!['archizio', 'clark', 'malcolm'].includes(voice)) return null;
    const at = typeof dt === 'function' ? dt(r['When (UTC)']) : null; if (!at) return null;
    const teams = String(r.Teams || '').split('|').filter(t => TEAMS[t]);
    let text = esc(String(r.Text)); const m = TAG.exec(String(r.Text));
    if (m) text = '<strong>' + esc(m[1]) + '</strong> ' + esc(String(r.Text).slice(m[0].length));
    let media = null;
    try { const x = r.Media ? JSON.parse(r.Media) : null; if (x && x.type === 'thumb' && x.t1) media = { type: 'thumb', t1: x.t1, t2: x.t2 || '', lo: x.lo || '', team: TEAMS[x.team] ? x.team : teams[0] || '', team2: '', chip: 'NEW', style: x.style || '', lock: !!x.lock }; if (teams.length > 1 && !x.lock) media.team2 = teams.find(t => t !== media.team) || ''; } catch (e) { }
    return {
      id: String(r.Id), voice, kind: 'ai', social: true, ts: at, time: relTime(at), gw: D.gw, teams, players: [], text, media,
      facts: 'Written by Claude for ' + ({ archizio: 'Archizio', clark: 'Clark', malcolm: 'Malcolm' }[voice]) + (r.Facts ? ' · from ' + String(r.Facts) : ''),
      detail: [], links: teams[0] ? [{ label: short(teams[0]), open: 'manager:' + teams[0] }] : [], share: String(r.Text),
    };
  }).filter(Boolean);
}
