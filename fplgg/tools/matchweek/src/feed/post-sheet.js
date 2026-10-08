/* feed/post-sheet.js — a post opened large, with the facts it was built from and where to go next. data-open="post:<id>" */
import * as UI from '../ui.js';
import { allArticles } from './articles.js';
import { postById, renderPost, restoreCarousels, stopSpeaking } from './index.js';
import { VOICES } from './voices.js';
import { shows, mmss } from './facts.js';
import { esc, short, firstOf } from './util.js';
import { REACTS, reactions } from './social.js';

/* the show opened from the feed: watch it all, or jump straight to one matchup */
function showPlayer(gw) {
  const s = shows().find(x => x.gw === gw); if (!s) return '';
  const prev = allArticles().find(p => p.kind === 'Preview' && p.gw === gw);
  return '<div class="show-player" data-gw="' + gw + '">'
    + '<button class="btn block gs-watch" data-fx="show:' + gw + '">' + UI.icon('play', 16) + ' Watch the show · ' + mmss(s.dur) + '</button>'
    + UI.sh('Matchups') + '<div class="card">' + s.j.chapters.map((c, i) => '<button class="row tap spl-c" data-fx="showch:' + gw + '|' + i + '">' + UI.crest(c.home, 22) + '<b>' + esc(firstOf(c.home)) + '</b><i>v</i><b>' + esc(firstOf(c.away)) + '</b>' + UI.crest(c.away, 22) + '<span class="spl-dn">' + esc(derbyName(c.home, c.away) || '') + '</span>' + UI.icon('play', 12, 'var(--p300)') + '</button>').join('') + '</div>'
    + (prev ? '<a class="cta" href="' + esc(prev.href) + '">Read the GW' + gw + ' preview <span class="ch">›</span></a>' : '')
    + '</div>';
}

export default {
  cls: 'post-sheet',
  render(id) {
    const p = postById(id);
    if (!p) return '<div class="ps"><div class="ps-gone">' + UI.empty('This post has moved on', 'The feed rebuilds from the latest data, and this one is no longer in it.') + '</div></div>';
    const V = VOICES[p.voice];
    const players = (p.players || []).map(c => UI.player(c)).filter(Boolean);
    const teams = (p.teams || []).filter(t => TEAMS[t]).slice(0, 8);
    let extra = '';
    if (p.kind === 'show') extra = showPlayer(p.media.gw);
    const nb = t => String(t).replace(/(\d+(?:\.\d+)?%?)–(\d+(?:\.\d+)?%?)/g, '<span class="nw">$1–$2</span>');
    const rows = (p.detail || []).map(d => '<div class="ps-r"><span>' + d.k + '</span><b>' + nb(d.v) + '</b></div>').join('');
    const links = (p.links || []).map(l => l.open ? '<button class="row tap ps-l" data-open="' + esc(l.open) + '"><b>' + esc(l.label) + '</b>' + UI.icon('chev', 16, 'var(--tx3)') + '</button>' : '<a class="row tap ps-l" href="' + esc(l.href) + '"><b>' + esc(l.label) + '</b>' + UI.icon('chev', 16, 'var(--tx3)') + '</a>').join('');
    return '<div class="ps">'
      + renderPost(p, { big: true, noMedia: p.kind === 'show' })
      + extra
      + (p.article && p.article.length ? UI.sh('The story') + '<div class="card ps-art">' + p.article.map(t => '<p>' + t + '</p>').join('') + '</div>' : '')
      + (rows ? UI.sh('The numbers behind it') + '<div class="card ps-facts">' + rows + (p.facts ? '<div class="foot">Source: ' + esc(p.facts) + '</div>' : '') + '</div>' : '')
      + (players.length ? UI.sh(players.length === 1 ? 'The player' : 'The players') + '<div class="card">' + players.slice(0, 8).map(q => '<button class="row tap ps-p" data-open="player:' + esc(q.Code) + '">' + UI.face(q, 36) + '<span class="ps-pt"><b>' + esc(q.Player) + '</b><span>' + esc(q.Club) + ' · ' + esc(q.Pos) + (q.Team ? ' · ' + esc(q.Team) : q.Owner && q.Owner !== 'FREE' ? ' · ' + esc(q.Owner) : ' · free agent') + '</span></span>' + UI.statusChip(q) + UI.icon('chev', 16, 'var(--tx4)') + '</button>').join('') + '</div>' : '')
      + (teams.length && teams.length <= 4 ? UI.sh(teams.length === 1 ? 'The club' : 'The clubs') + '<div class="card">' + teams.map(t => '<button class="row tap ps-p" data-open="manager:' + esc(t) + '">' + UI.crest(t, 32) + '<span class="ps-pt"><b>' + esc(t) + '</b><span>' + esc(TEAMS[t].mgr) + '</span></span>' + UI.icon('chev', 16, 'var(--tx4)') + '</button>').join('') + '</div>' : '')
      + (() => { const R = reactions(p.id); if (!R.total) return ''; return UI.sh('Reactions', { aside: R.total + (R.total === 1 ? ' reaction' : ' reactions') }) + '<div class="card ps-rx">' + REACTS.filter(x => R.who[x.k].length).map(x => '<div class="ps-r"><span>' + esc(x.label) + '</span><b class="ps-rxw">' + R.who[x.k].map(t => '<span class="ps-who">' + UI.crest(t, 16) + esc(firstOf(t)) + '</span>').join('') + '</b></div>').join('') + '</div>'; })()
      + (links ? UI.sh('Go to') + '<div class="card">' + links + '</div>' : '')
      + '<p class="ps-note">' + esc(V.name) + ' is a fictional voice. Every number in this post comes from the league data shown above.</p>'
      + '</div>';
  },
  mount(el, id) { restoreCarousels(el); },
  unmount(el) { stopSpeaking(); },
};
