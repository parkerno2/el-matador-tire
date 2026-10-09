/* Menu: data-open="menu" — your club, switch team, how it works (data-open="menu:how"), data freshness, the classic app. */
import * as UI from '../ui.js';
import * as K from './kit.js';
import { DEMO } from '../data/tabs.js';   /* the demo league (Q2): no classic app, the legal pages one folder up */
import { PAY, POT, money } from '../pages/league/data.js';   /* the pot from league.json (ROADMAP C1) */

const esc = UI.esc;

function ago() {
  if (!LOADED_AT) return 'not loaded yet';
  const s = Math.max(0, Math.round((Date.now() - LOADED_AT) / 1000));
  if (s < 50) return 'just now';
  const m = Math.round(s / 60);
  return m < 60 ? m + ' min ago' : Math.floor(m / 60) + ' h ' + (m % 60) + ' min ago';
}
function clubCard() {
  const me = UI.you(), signed = UI.signedIn();
  if (!me) return '<div class="card mn-club none"><div class="mn-cl"><span class="mn-q">' + UI.leagueCrest(40) + '</span><div><b>Pick your team</b><span class="sub">The app opens on your matchup, your lineup and your club’s colours.</span></div></div></div>';
  const s = K.standOf(me);
  return '<div class="card mn-club"><i class="mn-band" style="background:' + UI.teamColors(me).accent + '"></i><div class="mn-cl"><span class="ms-cr">' + UI.glow(me, 'left', .45, 140) + UI.crest(me, 48) + '</span>'
    + '<div><b>' + esc(me) + '</b><span class="sub">' + esc(K.nameOf(me)) + (s.has ? ' · ' + K.ord(s.pos) + ' · ' + K.recL(s) : '') + '</span>'
    + '<span class="mn-st' + (signed ? ' on' : '') + '">' + (signed ? 'Signed in on this phone' : 'Following, not signed in') + '</span></div></div>'
    + '<div class="mn-acts">' + (signed
      ? '<button type="button" class="btn" data-open="identity">' + UI.icon('edit', 16, '#fff') + 'Edit club identity</button><button type="button" class="btn ghost" data-signout>Sign out</button>'
      : '<button type="button" class="btn" data-open="identity">' + UI.icon('lock', 16, '#fff') + 'Sign in to edit your club</button>') + '</div></div>';
}
function switcher() {
  const me = UI.you(), signed = UI.signedIn();
  const grid = '<div class="mn-teams' + (signed ? ' dim' : '') + '">' + Object.keys(TEAMS).map(t => '<button type="button" data-team="' + esc(t) + '"' + (t === me ? ' class="on" aria-pressed="true"' : ' aria-pressed="false"') + (signed ? ' disabled' : '') + '>'
    + UI.crest(t, 34) + '<span>' + esc(UI.short(t)) + '</span></button>').join('') + '</div>';
  return UI.sh(me ? 'Switch team' : 'Your team') + '<div class="card mn-sw">' + grid
    + (signed ? '<p class="sub mn-swn">You’re signed in as ' + esc(me) + '. Sign out to follow another team.</p>' : '') + '</div>';
}
function rowLink(attr, icon, title, sub) {
  return '<button type="button" class="row tap mn-row" ' + attr + '><span class="mn-ic">' + UI.icon(icon, 18, 'var(--p300)') + '</span><span class="mn-rt"><b>' + title + '</b>' + (sub ? '<span class="sub">' + sub + '</span>' : '') + '</span>' + UI.icon('chev', 16, 'var(--tx3)') + '</button>';
}
function mainView() {
  const live = D && D.liveNow;
  return '<div class="mn-wrap"><div class="mn-top">' + UI.leagueCrest(28) + '<div><b>El Matador Tire</b><span class="sub">FPL Draft · 8 managers · 38 gameweeks</span></div></div>'
    + clubCard() + switcher()
    + UI.sh('The app') + '<div class="card">'
    + rowLink('data-open="menu:how"', 'info', 'How it works', 'Cards, ratings, projections, auto-subs, luck and the money')
    + rowLink('data-open="search"', 'search', 'Search', 'Any Premier League player, or a team')
    + '</div>'
    + UI.sh('Data') + '<div class="card mn-data"><div class="mn-fr"><div><b data-ago>Updated ' + ago() + '</b><span class="sub">Refreshes every ' + (live ? '90 seconds while games are on' : '5 minutes, and every 90 seconds while games are on') + '. Live scores can trail the TV by a few minutes.</span></div>'
    + '<button type="button" class="btn ghost mn-rf" data-refresh>' + UI.icon('refresh', 16, 'var(--tx)') + 'Refresh now</button></div></div>'
    + (DEMO ? '' : '<div class="card mn-classic"><a class="row tap mn-row" href="classic.html" target="_blank" rel="noopener"><span class="mn-ic">' + UI.icon('share', 18, 'var(--p300)') + '</span><span class="mn-rt"><b>Open the classic app</b><span class="sub">The previous version, everything still in place</span></span>' + UI.icon('chev', 16, 'var(--tx3)') + '</a></div>')
    + '<p class="mn-foot">' + (DEMO ? 'The Matchweek demo league. No ads, no analytics.' : 'Matchweek for El Matador Tire. No ads, no analytics.') + '</p>'
    + '<nav class="mn-legal" aria-label="Legal"><a href="' + (DEMO ? '../' : '') + 'privacy.html" target="_blank" rel="noopener">Privacy</a><i aria-hidden="true"></i><a href="' + (DEMO ? '../' : '') + 'terms.html" target="_blank" rel="noopener">Terms</a></nav></div>';
}

/* ---------- how it works ---------- */
const TIER_CAP = {
  silver: ['Silver', 'Rated under 78 on current form.'], gold: ['Gold', 'Rated 78 to 84.'], elite: ['Elite', 'Rated 85 and up.'],
  spec: ['Draft special', 'Round 1 and 2 picks wear the league colours all season, with an R1 or R2 tag.'],
  totw: ['Team of the Week', 'A 10-point haul turns the card black and gold until his next match finishes.'],
  potm: ['Player of the Month', 'The Premier League award. Lasts until the next one.'],
};
function gallery() {
  const best = {};
  (D.ro || []).forEach(p => { const t = tierOf(p), o = dynOvr(p); if (!best[t] || o > best[t].o) best[t] = { p, o }; });
  const order = ['silver', 'gold', 'elite', 'spec', 'totw', 'potm'];
  return '<div class="mn-gal">' + order.map(t => '<figure>' + (best[t] ? UI.plate(best[t].p, 104) : '<span class="mn-ph" aria-hidden="true"></span>')
    + '<figcaption><b>' + TIER_CAP[t][0] + '</b>' + TIER_CAP[t][1] + (best[t] ? '' : ' None this week.') + '</figcaption></figure>').join('') + '</div>';
}
function para(title, html) { return '<div class="mn-p"><h3>' + title + '</h3>' + html + '</div>'; }
function moneyRows() {
  const r = (l, v) => '<div class="mn-mr"><span>' + l + '</span><b class="n gold-c">' + v + '</b></div>';
  const months = (typeof PERIODS !== 'undefined' ? PERIODS : []).map(p => String(p[0]).replace(' & ', '–') + ' (GW' + p[1] + (p[2] !== p[1] ? '–' + p[2] : '') + ')').join(', ');
  const n = (typeof PERIODS !== 'undefined' ? PERIODS : []).length, teams = Object.keys(TEAMS).length;
  return '<div class="mn-money">' + r('1st place', money(PAY.first)) + r('2nd place', money(PAY.second)) + r('3rd place', money(PAY.third)) + r('Leader after GW19', money(PAY.half)) + r('Manager of the Month, ' + n + ' × ' + money(PAY.motm), money(PAY.motm * n)) + '<div class="mn-mr tot"><span>The pot, ' + teams + ' × ' + money(PAY.buyin) + ' buy-in</span><b class="n gold-c">' + money(POT) + '</b></div></div>'
    + '<p>Manager of the Month goes to the most points scored in each period: ' + esc(months) + '.</p>';
}
function howView() {
  return '<div class="mn-wrap how"><div class="mn-ht"><span class="k">Menu</span><h2>How it works</h2></div>'
    + UI.sh('The cards', { aside: 'real cards from this league' }) + gallery()
    + '<div class="card mn-ps">'
    + para('Ratings and form', '<p>Every player carries a base rating, curated by the commissioner from his career profile and the projection model. On top of it the card breathes with form: his last four finished games move it between −3 and +5. A green ▲ means he’s outplaying his rating, a red ▼ means he’s coasting. Form can lift a Silver into Gold art, or drop a Gold. FC 27’s attributes sit on each player’s Ratings tab.</p>')
    + para('PROJ, live, PTS and xP', '<p><b>PROJ</b> is the forecast before his match: start chance, expected minutes, his xG and xA per 90 and the opponent. FPL’s own figure sits beside it. While his match is on the card shows <b>live</b> points; afterwards the banked <b>PTS</b>. <b>xP</b> is what a finished performance deserved: goals as xG, assists as xA, clean sheets as the odds of one. Bonus is left out of xP.</p><p>A matchup reads the same way: predicted before the deadline, a projected final while games are on, the xP scoreline once the gameweek closes.</p>')
    + para('Auto-subs', '<p>As in FPL: a starter who plays no minutes once his club’s games are over is replaced by the first bench player, in bench order, who did play and keeps the formation legal (one keeper, at least three defenders, two midfielders and one forward). Before that, a starter flagged 25% or less is marked as a likely sub.</p>')
    + para('Win chance and title odds', '<p>Win chance compares the two projected scores and how much each could swing. Title odds play out the rest of the season 5,000 times from the same projections; they move at full time, not mid-game.</p>')
    + para('Luck', '<p>Two parts, never added together. <b>Performance</b>: points actually scored by your XI, bonus out, against their xP. <b>Results</b>: league points banked against an all-play schedule, your score against all seven rivals every week (win 3, draw 1).</p>')
    + '</div>'
    + UI.sh('The money', { aside: money(POT) }) + '<div class="card mn-ps">' + para('Prizes', moneyRows()) + '</div>'
    + UI.sh('League rules') + '<div class="card mn-ps">'
    + para('Format', '<p>Head to head over 38 gameweeks: 3 points for a win, 1 for a draw. Points for breaks ties. Waivers are open all season, with no transfer or injury restrictions.</p>')
    + para('The data', '<p>Scores and lineups come from the FPL Draft API on a rolling refresh. The app re-reads them whenever you open it, every 5 minutes, and every 90 seconds during games.</p>')
    + para('Privacy', '<p>No ads, no analytics. This phone remembers the team you follow and, if you signed in, your sign-in. A claimed team’s colours, crest, photo and display name are saved to the league’s Google Sheet, which anyone with the link can view. PINs are kept only as hashes on the league’s server.</p>')
    + '</div></div>';
}

export default {
  cls: 'sk-menu',
  render(arg) { return arg === 'how' ? howView() : mainView(); },
  mount(el, arg) {
    const root = el.querySelector('.mn-wrap'); if (!root || arg === 'how') return;
    root.addEventListener('click', e => {
      const t = e.target.closest('[data-team]');
      if (t && !t.disabled) {
        const team = t.dataset.team; UI.setYou(team); window.MW.render({ keepScroll: true });
        root.outerHTML = mainView(); this.mount(el, arg); UI.toast('Following ' + team); return;
      }
      if (e.target.closest('[data-signout]')) {
        const me = UI.you(); AUTH.logout(); window.MW.render({ keepScroll: true });
        root.outerHTML = mainView(); this.mount(el, arg); UI.toast('Signed out. This phone still follows ' + me + '.'); return;
      }
      const r = e.target.closest('[data-refresh]');
      if (r) {
        r.disabled = true; r.lastChild.textContent = 'Refreshing…';
        Promise.resolve(window.MW.reload(true)).then(ok => { UI.toast(ok ? 'Up to date' : 'Couldn’t reach the league data. Showing the last update.'); const a = el.querySelector('[data-ago]'); if (a) a.textContent = 'Updated ' + ago(); })
          .catch(() => UI.toast('Couldn’t reach the league data. Showing the last update.'))
          .finally(() => { const b = el.querySelector('[data-refresh]'); if (b) { b.disabled = false; b.lastChild.textContent = 'Refresh now'; } });
      }
    });
  },
};
