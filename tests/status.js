// matchweek.gg status page tests (site/public/status.html): the page's own script runs in a vm against a crafted
// ?health=1 answer, and the cards say the ElevenLabs balance, the hold and the cap in plain words (Code.gs v3.25), list
// an article's older failed attempts only as history when a live one exists, and say what the feed writer's last run
// saw. Plain Node.   node tests/status.js
const fs = require('fs'), vm = require('vm');
let fails = 0;
const check = (label, cond, info) => { if (!cond) fails++; console.log((cond ? 'PASS ' : 'FAIL ') + label + (info ? '  ' + info : '')); };
const html = fs.readFileSync(__dirname + '/../site/public/status.html', 'utf8');
const code = (html.match(/<script>([\s\S]*?)<\/script>/) || [])[1];
const H = 3600e3, iso = ms => new Date(ms).toISOString();
let HEALTH = null, INDEX = { files: { 'preview-gw6.json': { at: iso(Date.now() - 4 * H) } }, updated: iso(Date.now() - 4 * H), app: '20261008175702' }, ISSUES = [];
const els = {}; const el = id => els[id] || (els[id] = { id, textContent: '', innerHTML: '', className: '' });
const ctx = { console, JSON, Date, Math, Number, String, Array, Object, Promise, Error, isNaN, encodeURIComponent, setTimeout, clearTimeout, setInterval: () => 0,
  document: { getElementById: el, createElement: () => ({ src: '', remove() {} }), head: { appendChild(s) {
    const cb = decodeURIComponent(s.src).match(/responseHandler:([A-Za-z0-9_]+)/)[1];
    ctx[cb]({ table: { cols: [{ label: 'Setting' }, { label: 'Value' }], rows: [{ c: [{ v: 'API URL' }, { v: 'https://script.google.com/macros/s/TEST/exec' }] }] } }); } } },
  fetch: url => Promise.resolve({ ok: true, status: 200, json: async () => (/health=1/.test(url) ? HEALTH : /index\.json/.test(url) ? INDEX : ISSUES) }) };
ctx.window = ctx;
vm.createContext(ctx); vm.runInContext(code, ctx);
const text = s => String(s).replace(/<[^>]+>/g, '');
const cards = () => els.cards.innerHTML.split('<div class="card">').slice(1);
const cardOf = title => cards().find(c => c.includes(esc(title)));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const dot = c => (c.match(/<span class="dot (\w+)"/) || [])[1];
const base = () => ({ ok: true, version: 'v3.25', self: 'current: v3.25 (checked ' + iso(Date.now() - 20 * 60e3) + ')',
  show: { gw: 6, on: true, paused: false, facts: iso(Date.now() - H), factsFrom: 'phone', script: false, tries: 0, source: 'repo', clips: 1, stale: 21, expected: 22,
    render: { at: iso(Date.now() - 14 * 60e3), gw: 6, ok: false, stopped: 'http 401', error: 'out of credits: top up at elevenlabs.io or wait for the monthly reset', rendered: 0, kept: 1, left: 21, source: 'repo', need: 2950, hold: '2026-11-14T03:12:00.000Z' },
    credits: { left: 0, limit: 10000, resets: '2026-11-14T03:12:00.000Z', at: iso(Date.now() - 14 * 60e3), from: 'elevenlabs' }, need: 2950, cap: { used: 0, cap: 3900 }, capped: false,
    hold: { until: '2026-11-14T03:12:00.000Z', why: 'credits', since: iso(Date.now() - 14 * 60e3) }, punch: { off: false, last: null } },
  facts: { preview: { gw: 6, at: iso(Date.now() - H), from: 'phone' }, recap: null, repo: null },
  data: { updated: iso(Date.now() - 30 * 60e3), source: 'refreshAll', ageMin: 30, attempted: iso(Date.now() - 30 * 60e3), live: false, liveWhy: '', liveSince: null },
  errors: { h24: 0, net24: 0, rows: 0, last: null },
  articles: { mode: 'auto', job: null, queue: 0, paused: false, punch: { off: false, last: null }, last: [
    { id: 'preview-gw6-05576b', gw: 6, kind: 'preview', status: 'live', written: iso(Date.now() - (3 * 60 + 33) * 60e3), model: 'claude-sonnet-5-5 + claude-haiku-5-5', approved: iso(Date.now() - (3 * 60 + 33) * 60e3), since: iso(Date.now() - (3 * 60 + 33) * 60e3) },
    { id: 'preview-gw6-90c43d', gw: 6, kind: 'preview', status: 'failed', written: '', model: '', approved: '', since: iso(Date.now() - 7 * H) }] },
  ai: { day: new Date().toISOString().slice(0, 10), count: 0, on: true, last: { at: iso(Date.now() - 20 * 60e3), events: 0, kinds: '', made: 0, error: '' } } });

(async () => {
  console.log('--- the show card');
  HEALTH = base(); await ctx.run();
  let c = cardOf('The Gameweek Show'), t = text(c);
  check('S1 the balance in plain words, exactly as asked', t.includes('ElevenLabs: 0 of 10,000 characters left this month, resets 14 Nov.'), t);
  check('S2 the hold: not calling ElevenLabs until the reset, a top-up noticed within the hour; the card is amber', t.includes('Not calling ElevenLabs until 14 Nov (out of credits, since 14 min ago). The balance is read again every hour, so a top-up is noticed within the hour.') && dot(c) === 'warn', t);
  check('S3 the last render and the older takes', t.includes('Last render 14 min ago: stopped, out of credits: top up at elevenlabs.io or wait for the monthly reset.') && t.includes('clips 1 of 22, 21 older takes waiting to be re-voiced.'), t);
  check('S4 the page says the checked time and the summary is "worth a look", not red', /^checked \d\d:\d\d UTC$/.test(els.checked.textContent) && /worth a look/.test(els.sum.innerHTML) && els.sum.className === 'sum warn', els.sum.innerHTML);
  HEALTH = base(); HEALTH.show.credits = { left: 7050, limit: 10000, resets: '2026-11-01T00:00:00.000Z', at: iso(Date.now() - 2 * H), from: 'count' }; HEALTH.show.hold = null; HEALTH.show.render = { at: iso(Date.now() - 2 * H), gw: 6, ok: true, stopped: '', error: '', rendered: 21, kept: 1, left: 0, source: 'repo', need: 2950, hold: null };
  await ctx.run(); c = cardOf('The Gameweek Show'); t = text(c);
  check('S5 the count fallback says so; a good render; the card is green', t.includes('ElevenLabs: 7,050 of 10,000 characters left this month, resets 1 Nov (counted by Code.gs: the key cannot read the account\'s balance). Read 2 h 0 min ago.') && t.includes('Last render 2 h 0 min ago: 21 lines voiced, 1 kept.') && dot(c) === 'ok', t);
  HEALTH = base(); HEALTH.show.hold = null; HEALTH.show.capped = true; HEALTH.show.cap = { used: 3312, cap: 3900 }; HEALTH.show.need = 2950; HEALTH.show.render.ok = true; HEALTH.show.render = { at: iso(Date.now() - 14 * 60e3), ok: false, stopped: 'capped', error: 'GW6 has voiced 3312 of its 3900-character cap', rendered: 0, kept: 1, left: 21 };
  await ctx.run(); c = cardOf('The Gameweek Show'); t = text(c);
  check('S6 the cap in plain words, naming the Script Property; amber', t.includes('Gameweek 6 is at its voicing cap: 3,312 of 3,900 characters, and the lines still to voice need 2,950 more. The Script Property EMT_SHOW_GW_CAP_6 raises it.') && dot(c) === 'warn', t);
  HEALTH = base(); HEALTH.show.credits = null; HEALTH.show.hold = null; HEALTH.show.render = null; HEALTH.show.capped = false;
  await ctx.run(); c = cardOf('The Gameweek Show'); t = text(c);
  check('S7 no balance read yet (an older Code.gs, or before the first render): said, green', t.includes('ElevenLabs: the balance has not been read yet') && dot(c) === 'ok', t);
  HEALTH = base(); delete HEALTH.show.credits; delete HEALTH.show.hold; delete HEALTH.show.capped; delete HEALTH.show.cap; delete HEALTH.show.need; HEALTH.show.render = null;
  await ctx.run(); c = cardOf('The Gameweek Show');
  check('S8 a v3.24 health answer without the new fields still renders a card', !!c && dot(c) === 'ok');

  console.log('--- the articles card');
  HEALTH = base(); await ctx.run(); c = cardOf('Recaps and previews'); t = text(c);
  const items = (c.match(/<li>[\s\S]*?<\/li>/g) || []).map(text);
  check('A1 the live GW6 preview is listed once, its failed earlier attempt only as history, and the card is green', items.length === 2 && items[0].startsWith('GW6 preview: live, written 3 h 33 min ago.') && items[1] === 'Earlier attempts: GW6 preview failed 7 h 0 min ago.' && !/GW6 preview: failed/.test(t) && dot(c) === 'ok', JSON.stringify(items));
  HEALTH = base(); HEALTH.articles.last = [{ id: 'recap-gw5-aaaaaa', gw: 5, kind: 'recap', status: 'failed', written: '', model: '', approved: '', since: iso(Date.now() - 2 * H) }, HEALTH.articles.last[0]];
  await ctx.run(); c = cardOf('Recaps and previews'); t = text(c);
  check('A2 a failed article with no live version is current: listed and amber', /GW5 recap: failed\./.test(t) && /GW6 preview: live/.test(t) && !/Earlier attempts/.test(t) && dot(c) === 'warn', t);
  HEALTH = base(); HEALTH.articles.last = [HEALTH.articles.last[0], { id: 'preview-gw6-bbbbbb', gw: 6, kind: 'preview', status: 'dropped', written: '', model: '', approved: '', since: iso(Date.now() - 9 * H) }, HEALTH.articles.last[1]];
  await ctx.run(); c = cardOf('Recaps and previews'); t = text(c);
  check('A3 a dropped and a failed attempt behind one live article: one history line with both', /Earlier attempts: GW6 preview dropped 9 h 0 min ago; GW6 preview failed 7 h 0 min ago\./.test(t) && dot(c) === 'ok', t);
  HEALTH = base(); HEALTH.articles.last = [{ id: 'preview-gw7-cccccc', gw: 7, kind: 'preview', status: 'failed', since: iso(Date.now() - H) }, HEALTH.articles.last[0]];
  await ctx.run(); c = cardOf('Recaps and previews'); t = text(c);
  check('A4 a failed GW7 preview is not hidden by the live GW6 one (another gameweek)', /GW7 preview: failed\./.test(t) && dot(c) === 'warn', t);

  console.log('--- the feed writer card');
  HEALTH = base(); await ctx.run(); c = cardOf('The feed writer'); t = text(c);
  check('W1 a quiet day: nothing was due, green', t.includes('Last run 20 min ago: nothing was due (no new quote, result, build-up or rumour).') && dot(c) === 'ok', t);
  HEALTH = base(); HEALTH.ai.last = { at: iso(Date.now() - 20 * 60e3), events: 1, kinds: 'build', made: 0, error: 'HTTP 529 overloaded' };
  await ctx.run(); c = cardOf('The feed writer'); t = text(c);
  check('W2 a broken writer: the event, no post, the error; amber', t.includes('Last run 20 min ago: 1 event due (build), 0 posts written; stopped: HTTP 529 overloaded.') && dot(c) === 'warn', t);
  HEALTH = base(); HEALTH.ai.last = { at: iso(Date.now() - 5 * 60e3), events: 2, kinds: 'quotes,build', made: 2, error: '' }; HEALTH.ai.count = 2;
  await ctx.run(); c = cardOf('The feed writer'); t = text(c);
  check('W3 posts written', t.includes('Posts today (UTC): 2 of 6.') && t.includes('Last run 5 min ago: 2 events due (quotes,build), 2 posts written.') && dot(c) === 'ok', t);
  HEALTH = base(); HEALTH.ai.last = null; await ctx.run(); c = cardOf('The feed writer'); t = text(c);
  check('W4 no last run yet (an older Code.gs): the card still reads', t.includes('Posts today (UTC): 0 of 6.') && !/Last run/.test(t) && dot(c) === 'ok', t);

  console.log('--- the page as a whole');
  HEALTH = base(); HEALTH.show.hold = null; HEALTH.show.render.ok = true; HEALTH.show.credits.left = 6900; await ctx.run();
  check('P1 everything green reads "Everything is working."', els.sum.className === 'sum ok' && /Everything is working\./.test(els.sum.innerHTML), els.sum.innerHTML);
  check('P2 no emoji and no em or en dashes on the page', !/[\u2014\u2013]/.test(els.cards.innerHTML) && !/[\u{1F300}-\u{1FAFF}]/u.test(els.cards.innerHTML) && !/[\u2014\u2013]/.test(html));
  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('FAIL the page threw: ' + (e && e.stack || e)); console.log('1 FAILED'); process.exit(1); });
