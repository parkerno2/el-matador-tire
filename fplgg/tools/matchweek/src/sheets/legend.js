/* Legend sheet: data-open="legend:<topic>" or MW.openSheet('legend', topic). What a rating, a Proj figure, a win chance
   or odds figure, or a luck figure means, in one place. Four sections in a fixed order (rating, proj, odds, luck); the
   tapped topic is marked and scrolled to, and an unknown topic simply shows the four from the top. The words are the
   product's one vocabulary (docs/plans/M2.md, K2): Proj for every forecast of points, Proj final for a team's forecast final,
   xP only as the expected points a finished performance deserved. Labels and rows only, no subtitle under a heading. */
import * as UI from '../ui.js';
import { HOUSE } from '../data/tabs.js';   /* El Matador's cards carry the commissioner's ratings, a house-rated league (the demo) Matchweek's own */
import { PAY, words } from '../pages/league/data.js';
import * as LG from '../pages/league/data.js';   /* hasMotm(), read by name (see motmOn) */
const LGX = Object.assign({}, LG);
/* a league with no Manager of the Month prize shows no prize word here (hasMotm() is part A's; PAY.motm > 0 is its whole definition) */
const motmOn = () => (typeof LGX.hasMotm === 'function' ? LGX.hasMotm() : PAY.motm > 0);

export const TOPICS = ['rating', 'proj', 'odds', 'luck'];
/* each topic: its heading and its rows [label, meaning]; a meaning may be a function, read when the sheet is drawn (Worth names the
   league's own count of other scores, apRivals()); a row marked 'motm' always shows (the league overview's month race carries odds in
   every league) and names the prize only in a league that has one */
export const LEGEND = {
  rating: ['Rating', [
    ['Rating', () => HOUSE ? 'The number on a card. Matchweek\u2019s own: FPL\u2019s season Proj for him, ranked among his position, the best at 94.' : 'The number on a card: his base rating, curated by the commissioner from his career profile and the projection model. FC 27\u2019s attributes sit on his Ratings tab.'],
    ['Form', 'His last four finished games move the rating between \u22123 and +5. A green arrow up means he is outplaying it, a red arrow down means he is coasting.'],
    ['Silver', 'Rated under 78.'],
    ['Gold', 'Rated 78 to 84.'],
    ['Elite', 'Rated 85 and up.'],
  ]],
  proj: ['Proj', [
    ['Proj', 'The forecast of a player\u2019s points before his match: start chance, expected minutes, his xG and xA per 90 and the opponent.'],
    ['Proj final', 'A team\u2019s forecast final score for the gameweek: points already scored plus the Proj of each player still to play.'],
    ['Live', 'Points scored so far while his match is on. They replace his Proj.'],
    ['Pts', 'His banked points once his match is over.'],
    ['xP', 'Only after a match: the points a finished performance deserved. Goals as xG, assists as xA, clean sheets as the odds of one. Bonus is left out.'],
  ]],
  odds: ['Odds', [
    ['Win chance', 'The chance each side wins a matchup, from the two Proj scores and how far each could swing. It is never 0% or 100% until the result cannot change.'],
    ['Draw', 'The chance the two scores finish level. It goes once the result cannot change.'],
    ['Title odds', 'The share of simulated seasons in which a team finishes first, played out from the same Proj figures. They move at full time, not mid-game.'],
    ['Month odds', 'The share of simulated runs in which a team scores the most points in the period', 'motm'],
    ['Bonus provisional', 'A matchup where only bonus points can still change: the score may move by those.'],
  ]],
  luck: ['Luck', [
    ['Performance', 'Points actually scored by your XI, bonus out, against their xP. Above zero means you scored more than the play deserved.'],
    ['Results', 'League points banked against an all-play schedule: your score against every other score of the week.'],
    ['All-play', 'Each week your score is compared with every other team\u2019s, a win for each team you beat and a draw for each tie.'],
    ['Worth', () => 'What an all-play schedule would have paid your scores: 3 for each other score beaten, 1 for each tie, averaged over the other ' + words(apRivals()) + ' scores, summed over the weeks you had a fixture. Luck is banked minus worth.'],
    ['xP', 'What a finished performance deserved. It is a measure of the play, never a forecast.'],
  ]],
};
const sec = (t, on) => '<section class="lgn-sec' + (on ? ' on' : '') + '" id="lgn-' + t + '" data-topic="' + t + '">' + UI.sh(LEGEND[t][0])
  + '<div class="card lgn-card">' + LEGEND[t][1].map(r => '<div class="lgn-row"><b>' + UI.esc(r[0]) + '</b><span>' + UI.esc((typeof r[1] === 'function' ? r[1]() : r[1]) + (r[2] === 'motm' ? (motmOn() ? ', for the Manager of the Month prize.' : '.') : '')) + '</span></div>').join('') + '</div></section>';

export default {
  cls: 'sk-legend',
  render(topic) {
    const t = TOPICS.includes(topic) ? topic : '';
    return '<div class="lgn"><h2 class="lgn-t">Legend</h2>' + TOPICS.map(x => sec(x, x === t)).join('') + '</div>';
  },
  mount(el, topic) {
    if (!TOPICS.includes(topic)) return;
    const s = el.querySelector('#lgn-' + topic);
    /* the sheet is the scroller: move it, never the page behind it */
    if (s) requestAnimationFrame(() => { el.scrollTop += s.getBoundingClientRect().top - el.getBoundingClientRect().top - 8; });
  },
};
