/* byes.js: a league with an odd number of teams has one team with no matchup each gameweek, a bye. The fixtures list
   simply leaves the team out, so a bye is read from it: a gameweek that has fixtures and does not have the team. */
import * as UI from '../ui.js';

const esc = UI.esc;

/* the teams with no matchup in gameweek g (this gameweek by default); none while the gameweek has no fixtures at all */
export function byes(g = D.gw) {
  const fx = (D.fx || []).filter(f => num(f.GW) === g);
  if (!fx.length) return [];
  const on = new Set(); fx.forEach(f => { on.add(f.Home); on.add(f.Away); });
  return Object.keys(TEAMS).filter(t => !on.has(t));
}
/* a team's next matchup after gameweek g: { g, opp } or null */
export function nextMatch(team, g = D.gw) {
  const f = (D.fx || []).filter(x => num(x.GW) > g && (x.Home === team || x.Away === team)).sort((a, b) => num(a.GW) - num(b.GW))[0];
  return f ? { g: num(f.GW), opp: f.Home === team ? f.Away : f.Home } : null;
}
/* the line under a list of matchups: "Bye" and the teams that sit this gameweek out; '' when there are none */
export function byeRow(g = D.gw) {
  const ts = byes(g);
  if (!ts.length) return '';
  return '<div class="md-bye"><span class="k">Bye</span>' + ts.map(t => '<span class="t" data-open="manager:' + esc(t) + '" role="button" tabindex="0">' + UI.crest(t, 18) + esc(UI.short(t)) + '</span>').join('') + '</div>';
}
/* your own bye, as the card at the top of Matchday: the gameweek and who is next */
export function byeCard(team) {
  const nx = nextMatch(team);
  return '<section class="card md-byec" aria-label="Bye this gameweek">' + UI.crest(team, 40)
    + '<div><b class="wide">Bye</b><span class="sub">Gameweek ' + D.gw + (nx ? ' · next ' + esc(UI.short(nx.opp)) + ' in GW' + nx.g : '') + '</span></div></section>';
}
