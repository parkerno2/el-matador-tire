/* Matchday — How's the week going? Overview (your matchup, the others, the feed), then Matchup, All matchups,
   Premier League and Week. Numbers come from the engine through ./matchday/model.js. */
import * as UI from '../ui.js';
import * as M from './matchday/model.js';
import * as Overview from './matchday/overview.js';
import * as Matchup from './matchday/matchup.js';
import * as All from './matchday/all.js';
import * as PL from './matchday/pl.js';
import * as Week from './matchday/week.js';
import { warm as warmFeed } from '../feed/index.js';

const SUBS = [{ id: 'overview', label: 'Overview' }, { id: 'matchup', label: 'Matchup' }, { id: 'all', label: 'All matchups' }, { id: 'pl', label: 'Premier League' }, { id: 'week', label: 'Week' }];

function aside() {
  const ph = M.phase(), g = 'GW' + D.gw;
  if (ph === 'live') return new Date().toLocaleDateString(undefined, { weekday: 'long' }) + ' · ' + g;
  if (ph === 'locked') return g + ' · locked';
  if (ph === 'prov') return g + ' · full time';
  if (ph === 'ft') return g + ' · final';
  const dl = M.deadline();
  return dl ? g + ' · deadline ' + M.tWd(dl) : g;
}

let TIMER = 0, OBS = null;
function tick() {
  const els = document.querySelectorAll('[data-md-until]');
  if (!els.length) { clearInterval(TIMER); TIMER = 0; return; }
  els.forEach(el => { const t = +el.getAttribute('data-md-until'), d = new Date(t); el.textContent = t > Date.now() ? 'in ' + M.until(d) : 'now'; });
}

export default {
  title: 'Matchday',
  subs: SUBS,
  render(sub, args) {
    let body = '';
    try {
      if (sub === 'matchup') body = Matchup.render(args);
      else if (sub === 'all') body = All.render();
      else if (sub === 'pl') body = PL.render();
      else if (sub === 'week') body = Week.render();
      else body = Overview.render();
    } catch (e) {
      console.error(e);
      body = '<div class="err">Something went wrong drawing this part of Matchday. ' + UI.esc(e.message) + '</div>';
    }
    return '<div class="md">' + UI.pageHead('Matchday', { aside: UI.esc(aside()) })
      + UI.pills(SUBS.map(s => ({ label: s.label, href: '#/matchday/' + s.id, on: s.id === sub })))
      + body + '<div class="md-end"></div></div>';
  },
  mount(root, sub) {
    UI.showOn(root, '.pills, .md-fxs');
    try { warmFeed(); } catch (e) { }
    /* clicks that only change local view state */
    root.onclick = null;
    const md = root.querySelector('.md'); if (!md) return;
    md.addEventListener('click', e => {
      const t = e.target.closest('[data-md-tab]');
      if (t) { Matchup.ST.tab = t.getAttribute('data-md-tab'); window.MW.render({ keepScroll: true }); return; }
      const x = e.target.closest('[data-md-xp]');
      if (x) { e.stopPropagation(); e.preventDefault(); Matchup.ST.xp = x.getAttribute('data-md-xp') === '1'; window.MW.render({ keepScroll: true }); return; }   /* the switch sits in the team bar, which opens the manager sheet on any other tap */
      const l = e.target.closest('[data-md-line]');
      if (l) { const k = l.getAttribute('data-md-line'); Matchup.ST.lines.has(k) ? Matchup.ST.lines.delete(k) : Matchup.ST.lines.add(k); window.MW.render({ keepScroll: true }); return; }
      const a = e.target.closest('[data-md-plall]');
      if (a) { PL.PLS.all = !PL.PLS.all; if (!PL.PLS.all) PL.PLS.open.clear(); window.MW.render({ keepScroll: true }); return; }
      const p = e.target.closest('[data-md-pl]');
      if (p) { const k = p.getAttribute('data-md-pl'); if (PL.PLS.all) { PL.PLS.all = false; PL.PLS.open.clear(); } PL.PLS.open.has(k) ? PL.PLS.open.delete(k) : PL.PLS.open.add(k); window.MW.render({ keepScroll: true }); return; }
    });
    /* keyboard: role=button / role=link rows act on Enter and Space */
    md.addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const el = e.target.closest('[role="button"],[role="link"]');
      if (!el || el.tagName === 'BUTTON' || el.tagName === 'A') return;
      e.preventDefault(); el.click();
    });
    /* the pinned score bar appears once the matchup header scrolls under the switcher */
    if (OBS) { OBS.disconnect(); OBS = null; }
    const head = md.querySelector('#md-mh'), pin = md.querySelector('.md-pin'), pills = md.querySelector('.pills');
    if (head && pin && 'IntersectionObserver' in window) {
      const ph = pills ? pills.offsetHeight : 54;
      md.style.setProperty('--md-pills', ph + 'px');
      OBS = new IntersectionObserver(ents => ents.forEach(en => pin.classList.toggle('on', !en.isIntersecting && en.boundingClientRect.top < ph)), { rootMargin: '-' + (ph + 40) + 'px 0px 0px 0px', threshold: 0 });
      OBS.observe(head);
    }
    /* countdowns tick while the page is open */
    if (!TIMER && md.querySelector('[data-md-until]')) TIMER = setInterval(tick, 30e3);
  },
};
