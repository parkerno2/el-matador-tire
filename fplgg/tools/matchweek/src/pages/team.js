/* My team: your club. Overview (club header, To do from Jive, this gameweek), Lineup, Squad, Transfers, Fixtures, Season. */
import * as UI from '../ui.js';
import { frame, plateDefs, simCached, simRun, safe } from './team/bits.js';
import { clubHead, compactHead } from './team/head.js';
import { todoBlock, gwBlock, switchLine } from './team/overview.js';
import { lineupPage, VIEW } from './team/lineup.js';
import { squadPage, SORT } from './team/squad.js';
import { transfersPage, faListHTML, FA, saveFA } from './team/transfers.js';
import { fixturesPage, FIX } from './team/fixtures.js';
import { seasonPage, SEL } from './team/season.js';
import { pickerPage } from './team/picker.js';

const SUBS = [{ id: 'overview', label: 'Overview' }, { id: 'lineup', label: 'Lineup' }, { id: 'squad', label: 'Squad' }, { id: 'transfers', label: 'Transfers' }, { id: 'fixtures', label: 'Fixtures' }, { id: 'season', label: 'Season' }];
const PAGES = {
  overview: t => todoBlock(t) + gwBlock(t) + switchLine(t),
  lineup: lineupPage, squad: squadPage, transfers: transfersPage, fixtures: fixturesPage, season: seasonPage,
};
const save = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { } };
const rerender = () => window.MW && window.MW.render({ keepScroll: true });

/* title odds take ~0.5 s to simulate, so the header draws first and the number lands a moment later */
let SIMQ = false;
function fillSim() {
  if (SIMQ || simCached()) return;
  SIMQ = true;
  UI.warmOdds(() => { SIMQ = false; });
}

function bind(root) {
  if (root.__tmBound) return; root.__tmBound = true;
  const on = () => document.body.dataset.page === 'team';
  root.addEventListener('click', e => {
    if (!on()) return;
    const t = e.target;
    let b;
    if ((b = t.closest('[data-pick]'))) { UI.setYou(b.getAttribute('data-pick')); window.MW.render(); return; }
    if ((b = t.closest('[data-unpick]'))) { try { localStorage.removeItem('emt-myteam'); } catch (er) { } window.MW.render(); return; }
    if ((b = t.closest('[data-lview]'))) { VIEW.lineup = b.getAttribute('data-lview'); save('emt-tm-lview', VIEW.lineup); rerender(); return; }
    if ((b = t.closest('[data-ssort]'))) { SORT.squad = b.getAttribute('data-ssort'); save('emt-tm-ssort', SORT.squad); rerender(); return; }
    if ((b = t.closest('[data-fapos]'))) { FA.pos = b.getAttribute('data-fapos'); FA.n = 20; saveFA(); rerender(); return; }
    if ((b = t.closest('[data-fasort]'))) { FA.sort = b.getAttribute('data-fasort'); FA.n = 20; saveFA(); rerender(); return; }
    if ((b = t.closest('[data-famore]'))) { FA.n += 20; const l = document.getElementById('tm-fal'); if (l) l.innerHTML = faListHTML(); return; }
    if ((b = t.closest('[data-tx]'))) { FA.tx = b.getAttribute('data-tx'); FA.txAll = false; rerender(); return; }
    if ((b = t.closest('[data-txall]'))) { FA.txAll = true; rerender(); return; }
    if ((b = t.closest('[data-fsort]'))) { FIX.sort = b.getAttribute('data-fsort'); save('emt-tm-fsort', FIX.sort); rerender(); return; }
    if ((b = t.closest('[data-xgw]'))) {
      SEL.gw = +b.getAttribute('data-xgw');
      const ch = b.closest('.tm-xch'); if (!ch) return;
      ch.querySelectorAll('.tm-xc').forEach(x => x.classList.toggle('on', x === b));
      const a = +b.getAttribute('data-a'), x = +b.getAttribute('data-x'), d = Math.round((a - x) * 10) / 10;
      const rd = ch.querySelector('.tm-xread');
      if (rd) rd.innerHTML = '<b>GW' + SEL.gw + (b.classList.contains('live') ? ' (live)' : '') + '</b> <span class="n">' + a + '</span> scored, <span class="n">' + x.toFixed(1) + '</span> expected, <span class="' + (d >= 0 ? 'win-c' : 'loss-c') + ' n">' + (d > 0 ? '+' : d < 0 ? '−' : '') + Math.abs(d).toFixed(1) + '</span>';
    }
  });
  root.addEventListener('input', e => {
    if (!on() || e.target.id !== 'tm-faq') return;
    FA.q = e.target.value; FA.n = 20;
    const l = document.getElementById('tm-fal'); if (l) l.innerHTML = faListHTML();
  });
  root.addEventListener('focusin', e => { if (e.target.id === 'tm-faq') FA.focus = true; });
  /* a re-render detaches the focused box (a data refresh mid-typing): keep the flag so mount puts the caret back */
  root.addEventListener('focusout', e => { if (e.target.id !== 'tm-faq') return; const t = e.target; queueMicrotask(() => { if (t.isConnected) FA.focus = false; }); });
  root.addEventListener('keydown', e => {
    if (!on() || (e.key !== 'Enter' && e.key !== ' ')) return;
    const r = e.target.closest('[data-open][tabindex]');
    if (r && r === e.target) { e.preventDefault(); r.click(); }
  });
}

export default {
  title: 'My team',
  subs: SUBS,
  render(sub, args) {
    const team = UI.you();
    if (!team) return pickerPage();
    const page = PAGES[sub] ? sub : 'overview';
    const head = page === 'overview' ? clubHead(team) : compactHead(team);
    const pills = UI.pills(SUBS.map(s => ({ label: s.label, href: '#/team/' + s.id, on: s.id === page })));
    return '<div class="tm tm-' + page + '" style="' + frame(team).vars + '">' + head + pills
      + '<div class="tm-body">' + PAGES[page](team, args || []) + '</div>' + plateDefs() + '</div>';
  },
  mount(root, sub) {
    UI.showOn(root);
    bind(root);
    if (UI.you() && (sub === 'overview' || !sub)) fillSim();
    if (sub === 'transfers' && FA.focus) {
      const i = document.getElementById('tm-faq');
      if (i) { i.focus({ preventScroll: true }); const n = i.value.length; try { i.setSelectionRange(n, n); } catch (e) { } }
    }
  },
};
