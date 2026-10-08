/* League: the table, the money, the results, the derbies and the stats. */
import * as UI from '../ui.js';
import { oddsReady, odds, money, POT, heavyPending, settleHeavy } from './league/data.js';
import { overview } from './league/overview.js';
import { results, mountResults } from './league/results.js';
import { moneyPage } from './league/money.js';
import { derbiesPage } from './league/derbies.js';
import { statsPage, mountStats } from './league/stats.js';

const SUBS = [{ id: 'overview', label: 'Overview' }, { id: 'results', label: 'Results' }, { id: 'money', label: 'Money' }, { id: 'derbies', label: 'Derbies' }, { id: 'stats', label: 'Stats' }];
const NEEDS_ODDS = { overview: 1, money: 1 };

function season() {
  const d = gwDeadline(1) || dt((D.mw[0] || {})['Deadline (UTC)']) || new Date();
  const y = d.getUTCFullYear();
  return y + '/' + String((y + 1) % 100).padStart(2, '0');
}
/* sub-pages use the compact title row, like My team's: the league identity is the Overview's alone */
function compactHead() {
  const live = !!D.liveNow, prov = !!D.provOver, cur = live || prov;
  const aside = 'GW' + (cur ? D.gw : D.gwsDone) + ' of 38' + (live ? ' · live' : prov ? ' · full time' : '');
  return UI.pageHead('League', { bg: 'linear-gradient(180deg,var(--p900) 0%,#1A0B24 70%,var(--base) 100%)', body: '<div class="ttl lg-ttl">' + UI.leagueCrest(32) + '<h1>League</h1><span class="aside">' + UI.esc(aside) + '</span></div>' });
}
function head() {
  const md = UI.week().mode, done = D.gwsDone, live = md === 'live', prov = md === 'prov', cur = live || prov;
  const label = 'GW' + (cur ? D.gw : done) + ' of 38';
  const bar = '<div class="lg-prog"><div class="bar" role="img" aria-label="' + done + ' of 38 gameweeks played' + (cur ? ', gameweek ' + D.gw + (live ? ' live' : ' at full time') : '') + '"><i style="width:' + (done / 38 * 100).toFixed(2) + '%"></i>'
    + (cur ? '<i class="cur' + (live ? ' live' : '') + '" style="left:' + (done / 38 * 100).toFixed(2) + '%;width:' + (100 / 38).toFixed(2) + '%"></i>' : '') + '</div>'
    + '<span class="n">' + label + (live ? ' <em class="live-c">LIVE</em>' : prov ? ' <em>FT</em>' : '') + '</span></div>';
  const body = '<div class="lg-id">' + UI.leagueCrest(54) + '<div class="tx"><span class="k">League</span><h1 class="wide">El Matador Tire</h1>'
    + '<span class="meta">' + season() + ' · ' + Object.keys(TEAMS).length + ' managers · ' + money(POT) + ' pool</span></div></div>' + bar;
  const wm = '<i class="lg-wm" aria-hidden="true">' + UI.leagueCrest(220) + '</i>';
  return UI.pageHead('League', { body, under: wm, bg: 'linear-gradient(180deg,var(--p900) 0%,#1A0B24 60%,var(--base) 100%)' });
}

let PENDING = 0;
export default {
  title: 'League',
  subs: SUBS,
  render(sub, args) {
    let body;
    switch (sub) {
      case 'results': body = results(); break;
      case 'money': body = moneyPage(); break;
      case 'derbies': body = derbiesPage(); break;
      case 'stats': body = statsPage(); break;
      default: body = overview();
    }
    return (sub === 'overview' ? head() : compactHead()) + UI.pills(SUBS.map(s => ({ label: s.label, href: '#/league/' + s.id, on: s.id === sub })))
      + '<main class="lgx lgx-' + sub + '">' + body + '</main>';
  },
  mount(root, sub) {
    UI.showOn(root);
    /* rows that open a manager sheet are role=button: Enter and Space open them too */
    if (!root.__lgKeys) {
      root.__lgKeys = 1;
      root.addEventListener('keydown', e => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const el = e.target.closest && e.target.closest('.lgx [role="button"][data-open], .lgx [role="button"][data-go]');
        if (!el || e.target.closest('a,button,input,summary')) return;
        e.preventDefault(); el.click();
      });
    }
    if (sub === 'results') mountResults(root);
    if (sub === 'stats') mountStats(root);
    /* title odds take ~0.5 s and the month's projections ~50 ms: draw the page first, then fill them in */
    if ((NEEDS_ODDS[sub] && !oddsReady()) || heavyPending()) {
      const tok = ++PENDING;
      setTimeout(() => {
        if (tok !== PENDING) return;
        const b = document.body.dataset;
        if (b.page !== 'league') return;
        settleHeavy();
        if (NEEDS_ODDS[b.sub] && !oddsReady()) { UI.warmOdds(); return; }
        if (window.MW) window.MW.render({ keepScroll: true });
      }, 60);
    }
  },
};
