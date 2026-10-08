/* My team · the club picker shown until this phone knows who you are. */
import * as UI from '../../ui.js';
import { esc, mgrName, record, ord, rgba } from './bits.js';

export function pickerPage() {
  const order = (D.st || []).map(s => s.Team).filter(t => TEAMS[t]);
  const teams = order.length === Object.keys(TEAMS).length ? order : Object.keys(TEAMS);
  const tiles = teams.map(t => {
    const r = record(t), c = UI.teamColors(t);
    return '<button class="tm-pk" data-pick="' + esc(t) + '" style="--pkg:' + rgba(c.accent, .42) + ';--pkl:' + rgba(c.light, .22) + '">'
      + '<span class="tm-pkc">' + UI.crest(t, 56) + '</span>'
      + '<b class="tm-pkn">' + esc(t) + '</b><span class="tm-pkm">' + esc(mgrName(t)) + '</span>'
      + (D.started && r.pos ? '<span class="tm-pkr"><span class="n">' + ord(r.pos) + '</span> · <span class="n">' + num(((D.st || []).find(x => x.Team === t) || {})['League Pts']) + '</span> pts</span>' : '')
      + '</button>';
  }).join('');
  return UI.pageHead('My team')
    + '<section class="tm-pick">'
    + '<h2 class="wide">Which club is yours?</h2>'
    + '<p class="sub">Pick once and My team opens on your club, in your colours. This phone remembers it.</p>'
    + '<div class="tm-pkg">' + tiles + '</div>'
    + '<div class="card tm-pkn2"><span class="tm-pkni" aria-hidden="true">' + UI.icon('lock', 18, 'var(--p300)', 2) + '</span>'
    + '<span><b>Sign in to edit your club</b><span class="sub">Managers who sign in from the menu can change their club’s colours, crest and name. Everyone in the league sees it straight away.</span></span>'
    + '<button class="btn ghost tm-pkmenu" data-open="menu">Menu</button></div>'
    + '</section>';
}
