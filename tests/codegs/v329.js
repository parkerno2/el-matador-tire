// v3.29 tests: the feed writer's daily floor (Parker's Q3, 8 Oct 2026: "When will it go away and not be the first
// thing? ... [Nothing] written since Wednesday."). On a day with fewer than 2 voice posts by 14:00 Chicago the writer
// finds something real and new in the data that changes daily, each voice in its own lane (Archizio the market, Clark
// form and projections, Malcolm the build-up); nothing repeats the last 7 days; a day that already has 2 posts stays as
// it is; a quiet lane answers {"posts":[]} and the day stays quiet; off while a gameweek is live; the per-run and
// per-day caps hold; ?health=1 says what the floor did.   node tests/codegs/v329.js
const T = require(__dirname + '/harness.js').make();
const { ctx, check, src, sheets, props, logs } = T;
const Sheet = T.Sheet;
const H = 3600e3, D = 24 * H, iso = ms => new Date(ms).toISOString();

/* the clock: Wednesday 14 Oct 2026, 15:00 in Chicago (20:00 UTC, daylight time); NOW moves through the tests */
const FIXED = Date.parse('2026-10-14T20:00:00Z');
let NOW = FIXED;
class FakeDate extends Date { constructor(...a) { if (a.length) super(...a); else super(NOW); } static now() { return NOW; } }
ctx.Date = FakeDate;

/* the sheets around that clock: GW5 finished 5 days ago, GW6's deadline in 44 hours, waivers in 20 hours, no match today */
const q = s => "'" + s;
sheets.Matchweeks = new Sheet('Matchweeks', [['GW', 'Deadline (UTC)', 'MOTM period', 'Finished', 'Notes', 'Waivers (UTC)'],
  [4, q('2026-09-11T17:30:00Z'), 'Aug & Sep', 'TRUE', '', q('2026-09-10T17:30:00Z')], [5, q(iso(FIXED - 5 * D)), 'Aug & Sep', 'TRUE', '', q(iso(FIXED - 5 * D - D))],
  [6, q(iso(FIXED + 44 * H)), 'October', 'FALSE', '', q(iso(FIXED + 20 * H))], [7, q(iso(FIXED + 7 * D)), 'October', 'FALSE', '', q(iso(FIXED + 6 * D))]]);
sheets['Club Fixtures'] = new Sheet('Club Fixtures', [['GW', 'Home', 'Away', 'Kickoff (UTC)', 'Finished', 'Home goals', 'Away goals', 'Started', 'Mins'],
  [5, 'ARS', 'CHE', q(iso(FIXED - 4 * D)), 'TRUE', 2, 1, 'TRUE', 90], [6, 'MCI', 'LIV', q(iso(FIXED + 2 * D)), 'FALSE', '', '', 'FALSE', 0]]);
sheets.Standings.rows[0].push('Waiver pick'); sheets.Standings.rows.slice(1).forEach((r, i) => r.push(8 - i));
sheets.Transactions = new Sheet('Transactions', [['GW', 'Team', 'Manager', 'In', 'Out', 'Type', 'Result', 'When (UTC)'],
  [5, 'Cold Palmers', 'Parker Nolan', 'Mainoo', 'Elanga', 'Waiver', 'Accepted', q(iso(FIXED - 20 * D))],
  [6, 'Trophy Hunters', 'Jacob Taylor', 'Kudus', 'Semenyo', 'Waiver', 'Accepted', q(iso(FIXED - 2 * D))],
  [6, 'Devils U21s', 'PJ Nolan', 'Wissa', 'Mateta', 'Free agent', 'Accepted', q(iso(FIXED - 6 * H))]]);
sheets.Players = new Sheet('Players', [['Code', 'Player', 'Pos', 'Club', 'Owner', 'Status', 'News', 'Draft rank', 'Season pts', 'Mins', 'Form', 'xGI', 'EP next', 'Proj', 'Nation', 'Full name'],
  [223094, 'Haaland', 'FWD', 'MCI', 'Cold Palmers', 'a', '', 1, 61, 450, 9.1, 0.9, 8.4, 210, 'NO', 'Erling Haaland'],
  [154561, 'Raya', 'GKP', 'ARS', 'Cold Palmers', 'a', '', 62, 30, 450, 7.5, 0.01, 4.1, 170, 'ES', 'David Raya'],
  [437495, 'Meslier', 'GKP', 'ARS', 'FREE', 'a', '', 359, 0, 0, 0, 0, 0, 37, 'FR', 'Illan Meslier'],
  [501234, 'Wharton', 'MID', 'CRY', 'FREE', 'a', '', 140, 22, 380, 5.3, 0.4, 3.9, 110, 'EN', 'Adam Wharton'],
  [509876, 'Welbeck', 'FWD', 'BHA', 'FREE', 'a', '', 150, 27, 400, 6.2, 0.6, 4.6, 120, 'EN', 'Danny Welbeck'],
  [445123, 'Bruno', 'MID', 'MUN', 'Devils U21s', 'd', 'Knock, 75% chance', 5, 44, 430, 6.8, 0.7, 5.5, 180, 'PT', 'Bruno Fernandes']]);
sheets.Rosters = new Sheet('Rosters', [['Team', 'Manager', 'Player', 'Pos', 'Club', 'FPL rank', 'Proj pts', 'Best XI', 'Status', 'News', 'Drafted', 'Season pts', 'GW pts', 'GW mins', 'Code', 'Nation', 'OVR', 'TOTW', 'GW XI', 'Slot'],
  ['Cold Palmers', 'Parker Nolan', 'Haaland', 'FWD', 'MCI', 1, 210, 'XI', 'a', '', 'R1.1', 61, 0, 0, 223094, 'NO', 91, '', '', 0],
  ['Cold Palmers', 'Parker Nolan', 'Raya', 'GKP', 'ARS', 62, 170, 'XI', 'a', '', 'R6.7', 30, 0, 0, 154561, 'ES', 87, '', '', 0],
  ['Devils U21s', 'PJ Nolan', 'Bruno', 'MID', 'MUN', 5, 180, 'XI', 'd', 'Knock, 75% chance', 'R1.2', 44, 0, 0, 445123, 'PT', 88, '', '', 0]]);
const post = (ms, voice, id, text) => sheets.Posts.rows.push([q(iso(ms)), id, voice, 'ai', 'x', '', '', text, '', '']);
post(FIXED - 8 * D, 'clark', 'ai:old:0', 'Eight days ago: Parker benched a striker who scored.');
post(FIXED - 3 * D, 'malcolm', 'ai:ft:5:0', 'Three days ago: Baha went top, pending the investigation.');

/* the Claude mock: answers in the voice the ask names; MODE picks the reply */
let MODE = 'ok', calls = [];
const realFetch = ctx.UrlFetchApp.fetch;
ctx.UrlFetchApp.fetch = (url, o) => {
  o = o || {};
  if (url === 'https://api.anthropic.com/v1/messages') {
    const body = JSON.parse(o.payload), user = body.messages[0].content, voice = (user.match(/WRITE: One (\w+) post/) || [])[1] || '';
    calls.push({ body, user, voice });
    if (MODE === 'throw') throw new Error('Address unavailable: api.anthropic.com');
    const text = { archizio: 'EXCLUSIVE. PJ has moved for Wissa and told nobody. Here we go.', clark: 'Parker is projected to win again and I am not ok with it.', malcolm: 'Cold Palmers against Devils U21s. The brothers, again. Someone loses the family group chat.' }[voice] || 'A post with no voice in it at all.';
    const v = MODE === 'wrongvoice' ? (voice === 'clark' ? 'malcolm' : 'clark') : voice;
    const posts = MODE === 'empty' ? [] : MODE === 'badnumber' ? [{ voice: v, text: 'Parker has 999 points and nobody can touch him.', teams: ['Cold Palmers'] }] : [{ voice: v, text, teams: ['Cold Palmers'], thumb: v === 'clark' ? { t1: 'PROJECTED', t2: 'TO WIN AGAIN', lo: 'THE TERRACE' } : undefined }];
    return T.resp(200, { content: [{ type: 'text', text: JSON.stringify({ posts }) }] });
  }
  return realFetch(url, o);
};
props.ANTHROPIC_API_KEY = 'sk-test';
const state = () => JSON.parse(props.EMT_AI_STATE || '{}');
const setState = f => { const S = state(); f(S); props.EMT_AI_STATE = JSON.stringify(S); };
const aiRows = () => sheets.Posts.rows.slice(1).filter(r => r[3] === 'ai');
const get = p => JSON.parse(ctx.doGet({ parameter: p }).t);
const reset = () => { calls.length = 0; logs.length = 0; };
/* every run of these tests is a quiet one for the four event triggers: GW5 finished before the state was made, GW6's deadline outside the 30-hour window */
const run = () => { reset(); ctx.aiWriterTick(); return state(); };
const lanesToday = (() => { const n = ctx.EMT_AI_FLOOR_LANES.length, s = Math.floor(FIXED / 864e5) % n; return [0, 1, 2].map(i => ctx.EMT_AI_FLOOR_LANES[(s + i) % n]); })();

console.log('--- V the release');
check('V1 EMT_VERSION is v3.29 or later and the CHANGELOG has the entry', ctx.emtSelfVersion(src) === ctx.EMT_VERSION && ctx.emtSelfCmp(ctx.EMT_VERSION, 'v3.29') >= 0 && /\* v3\.29 · 9 Oct 2026\n \*   The feed writer's daily floor/.test(src));
check('V2 the constants: a floor of 2 by 14:00 Chicago, 7 days of memory, the three voices as lanes, the caps unchanged', ctx.EMT_AI_FLOOR === 2 && ctx.EMT_AI_FLOOR_HOUR === 14 && ctx.EMT_AI_FLOOR_DAYS === 7 && ctx.EMT_AI_FLOOR_LANES.join() === 'archizio,clark,malcolm' && ctx.EMT_AI_PER_RUN === 2 && ctx.EMT_AI_PER_DAY === 6);
check('V3 the ask: new, real, the voice\'s lane, nothing from the last 7 days, {"posts":[]} when nothing is worth it', /real, specific and new/.test(ctx.EMT_AI_FLOOR_ASK) && /nothing MEMORY already said in its posts of the last 7 days/.test(ctx.EMT_AI_FLOOR_ASK) && /a different number on the same point is still the same point/.test(ctx.EMT_AI_FLOOR_ASK) && /answer \{"posts":\[\]\}/.test(ctx.EMT_AI_FLOOR_ASK) && /no invented quotes/.test(ctx.EMT_AI_FLOOR_ASK));
check('V4 the system prompt, the voices and the tone block are as they were', /^You write short posts for the Feed of Matchweek/.test(ctx.EMT_AI_SYSTEM) && /THE READERS\. Eight lads/.test(ctx.EMT_AI_SYSTEM) && ctx.EMT_AI_VOICES.join() === 'archizio,clark,malcolm');

console.log('--- C the Chicago clock');
const c1 = ctx.emtChicago(FIXED);
check('C1 14 Oct 2026 20:00 UTC is 15:00 on the 14th in Chicago (daylight time, UTC-5)', c1.day === '2026-10-14' && c1.hour === 15 && c1.offset === -5, JSON.stringify(c1));
check('C2 the end of daylight time: 1 Nov 2026 06:59 UTC is UTC-5, 07:00 UTC is UTC-6', ctx.emtChicago(Date.parse('2026-11-01T06:59:00Z')).offset === -5 && ctx.emtChicago(Date.parse('2026-11-01T07:00:00Z')).offset === -6);
check('C3 the start: 8 Mar 2026 07:59 UTC is UTC-6, 08:00 UTC is UTC-5', ctx.emtChicago(Date.parse('2026-03-08T07:59:00Z')).offset === -6 && ctx.emtChicago(Date.parse('2026-03-08T08:00:00Z')).offset === -5);
const c4 = ctx.emtChicago(Date.parse('2026-01-15T05:30:00Z'));
check('C4 a winter night: 15 Jan 05:30 UTC is still the 14th, 23:30, in Chicago', c4.day === '2026-01-14' && c4.hour === 23.5 && c4.offset === -6, JSON.stringify(c4));
check('C5 a Chicago day\'s voice posts are counted by that clock (a 03:00 UTC post belongs to the evening before)', ctx.aiDayPosts([{ Kind: 'ai', 'When (UTC)': '2026-10-15T03:00:00Z' }, { Kind: 'ai', 'When (UTC)': '2026-10-14T20:00:00Z' }, { Kind: 'note', 'When (UTC)': '2026-10-14T20:00:00Z' }], '2026-10-14') === 2);

console.log('--- A a quiet day writes');
let S = run();
check('A1 the first run after the update: no call, the day marked (no backfill), ai.last.floor says so', calls.length === 0 && S.floor && S.floor.day === '2026-10-14' && S.floor.why === 'first run' && S.last.floor === 'first run' && S.last.events === 0, JSON.stringify(S));
setState(S => { S.floor = { day: '2026-10-13', made: 0, why: 'wrote 2' }; });
S = run();
check('A2 the next day at 15:00 Chicago with no voice post today: two calls, two posts, in two lanes, today\'s first lane first', calls.length === 2 && calls.map(c => c.voice).join() === lanesToday.slice(0, 2).join() && aiRows().length === 4 && aiRows().slice(2).map(r => r[2]).join() === lanesToday.slice(0, 2).join(), calls.map(c => c.voice).join() + ' / ' + lanesToday.join());
const newRows = aiRows().slice(2);
check('A3 the rows: ai:fl:<day>:<voice>:0, Kind ai, the text, the facts line, Clark\'s thumbnail when he wrote', newRows.every((r, i) => r[1] === 'ai:fl:2026-10-14:' + lanesToday[i] + ':0' && r[3] === 'ai' && r[7].length > 15 && r[8].length > 5) && newRows.every(r => r[2] !== 'clark' || /"type":"thumb"/.test(r[9])), JSON.stringify(newRows));
check('A4 the state: the floor done today with 2 made, the day count 2, ai.last says wrote 2', S.floor.day === '2026-10-14' && S.floor.made === 2 && S.count === 2 && S.last.made === 2 && S.last.error === '' && /^wrote 2/.test(S.last.floor), JSON.stringify(S.floor) + ' ' + JSON.stringify(S.last));
let h = get({ health: '1' });
check('A5 ?health=1 ai.floor { day, made, why } and ai.last.floor; no new top-level key', h.ai.floor && h.ai.floor.day === '2026-10-14' && h.ai.floor.made === 2 && /^wrote 2/.test(h.ai.floor.why) && /^wrote 2/.test(h.ai.last.floor) && Object.keys(h).sort().join() === 'ai,articles,data,errors,facts,ok,self,show,version', JSON.stringify(h.ai));
const byVoice = {}; calls.forEach(c => { byVoice[c.voice] = c; });
const anyCall = calls[0];
check('A6 every call: the writer\'s system prompt, the floor ask with the lane, the model chain\'s first model, thinking off (v3.20)', calls.every(c => c.body.system === ctx.EMT_AI_SYSTEM && c.body.model === 'claude-haiku-5-5' && c.body.thinking && c.body.thinking.type === 'disabled' && /This is a quiet day between gameweeks/.test(c.user) && new RegExp('The lane for ' + c.voice + ':').test(c.user) && /EVENT: A quiet day before gameweek 6, 44 hours to the deadline\./.test(c.user)), anyCall.user.slice(0, 300));
check('A7 MEMORY carries the post of 3 days ago and not the one of 8 days ago', calls.every(c => /Baha went top, pending the investigation/.test(c.user) && !/Eight days ago/.test(c.user)));
const facts = c => JSON.parse(c.user.split('FACTS (the only numbers you may use):\n')[1].split('\n\nMEMORY')[0]);
/* the lanes' facts: each lane may or may not have been called today, so each is checked when it was, and the third lane through aiFloorEvents directly */
const L = ctx.aiLeague(), allEv = ctx.aiFloorEvents(state(), L, NOW, '2026-10-14'), evOf = v => allEv.find(e => e.voice === v);
check('A8 three lane events, each n 1, its voice, 7 days of memory, teams the whole league, the key fl:<day>:<voice>', allEv.length === 3 && allEv.every(e => e.n === 1 && e.days === 7 && e.type === 'floor' && e.teams.length === 8 && e.key === 'fl:2026-10-14:' + e.voice) && allEv.map(e => e.voice).join() === lanesToday.join());
const fa = evOf('archizio').facts;
check('A9 Archizio\'s facts: the moves since the last deadline (not the 20-day-old one), the best free agents who have played (Welbeck, Wharton; not Meslier), the waiver order, 20 hours to waivers', fa.moves_since_last_deadline.length === 2 && fa.moves_since_last_deadline.map(m => m.in).join() === 'Kudus,Wissa' && fa.moves_since_last_deadline[1].manager === 'PJ' && fa.moves_since_last_deadline[1].type === 'Free agent' &&
  fa.best_free_agents.map(p => p.player).join() === 'Welbeck,Wharton' && fa.best_free_agents[0].ep_next === 4.6 && fa.waiver_order.length === 8 && fa.waiver_order[0].pick === 1 && fa.hours_to_waivers === 20 && fa.hours_to_deadline === 44 && fa.table.length === 8, JSON.stringify(fa).slice(0, 400));
const fc = evOf('clark').facts;
check('A10 Clark\'s facts: the table with form, the fixtures with positions, each XI\'s projection from Players\' EP next (Cold Palmers 12.5, Devils U21s 5.5) with the top starters, the flagged starter, last gameweek\'s results', fc.table_with_form.length === 8 && fc.table_with_form.every(t => 'last3' in t && 'pos' in t) && fc.fixtures.length === 4 && fc.fixtures.every(f => f.home_table_pos > 0 && f.away_table_pos > 0) &&
  fc.projected_for_next_gameweek.length === 2 && fc.projected_for_next_gameweek[0].team === 'Cold Palmers' && fc.projected_for_next_gameweek[0].projected_xi_points === 12.5 && fc.projected_for_next_gameweek[0].top_projected[0].player === 'Haaland' && fc.projected_for_next_gameweek[1].projected_xi_points === 5.5 &&
  fc.flagged_starters.length === 1 && fc.flagged_starters[0].player === 'Bruno' && fc.results_last_gameweek.length === 4 && fc.hours_to_deadline === 44, JSON.stringify(fc).slice(0, 500));
const fm = evOf('malcolm').facts;
const met = (a, b) => L.fx.some(f => String(f.Finished).toUpperCase() === 'TRUE' && [f.Home, f.Away].sort().join() === [a, b].sort().join());
check('A11 Malcolm\'s facts: the coming fixtures with the all-time series (both teams) and, for a pair that has met, the last meeting from H2H Fixtures; the deadline; the quotes', fm.fixtures_with_history.length === 4 && fm.fixtures_with_history.every(f => f.series_wins && Object.keys(f.series_wins).length === 2 && typeof f.series_draws === 'number' && (met(f.home, f.away) ? /^GW\d+ .+ \d+-\d+ .+$/.test(f.last_meeting || '') : !('last_meeting' in f))) &&
  fm.deadline === iso(FIXED + 44 * H) && Array.isArray(fm.quotes_this_gameweek), JSON.stringify(fm.fixtures_with_history).slice(0, 400));
const sr = ctx.aiSeries(L, 'Kobbie Mainoo Fan', 'Cold Palmers');
check('A12 aiSeries counts the finished meetings only (GW1 Kobbie Mainoo Fan 36-46 Cold Palmers is one of them)', sr.wins['Cold Palmers'] >= 1 && /^GW\d+ /.test(sr.last) && sr.wins['Kobbie Mainoo Fan'] + sr.wins['Cold Palmers'] + sr.draws === L.fx.filter(f => String(f.Finished).toUpperCase() === 'TRUE' && [f.Home, f.Away].sort().join() === 'Cold Palmers,Kobbie Mainoo Fan').length, JSON.stringify(sr));
S = run();
check('A13 a third run the same day: no call, the floor says done today', calls.length === 0 && aiRows().length === 4 && /^done today: wrote 2/.test(S.last.floor), S.last.floor);

console.log('--- B a day that already has its posts');
sheets.Posts.rows = sheets.Posts.rows.filter(r => !/^ai:fl:/.test(String(r[1])));
sheets.Matchweeks.rows[3][1] = q(iso(FIXED + 5 * D));   /* GW6's deadline moved out of the build-up trigger's 30-hour window for the days that follow */
NOW = FIXED + D;   /* Thursday 15 Oct, 15:00 Chicago */
post(NOW - 3 * H, 'archizio', 'ai:q:x:0', 'EXCLUSIVE. A quote this morning.'); post(NOW - 2 * H, 'clark', 'ai:q:x:1', 'And a take on it.');
setState(S => { S.count = 2; });
S = run();
check('B1 two voice posts already today: no call, nothing written, the floor marked enough', calls.length === 0 && aiRows().length === 4 && S.floor.day === '2026-10-15' && S.floor.made === 0 && S.floor.why === 'enough today (2)', JSON.stringify(S.floor));
sheets.Posts.rows.pop(); setState(S => { S.floor = { day: '2026-10-14', made: 0, why: 'x' }; S.count = 1; });
S = run();
check('B2 one post today: one call, one post, the floor made 1', calls.length === 1 && calls[0].voice === ctx.EMT_AI_FLOOR_LANES[Math.floor(NOW / 864e5) % 3] && aiRows().length === 4 && S.floor.made === 1 && S.count === 2, JSON.stringify(S.floor));
sheets.Posts.rows = sheets.Posts.rows.filter(r => !/^ai:(fl|q):/.test(String(r[1])));

console.log('--- D the clock and the caps');
NOW = FIXED + 2 * D - 2 * H;   /* Friday 16 Oct, 13:00 Chicago */
setState(S => { S.floor = { day: '2026-10-15', made: 0, why: 'x' }; S.count = 0; });
S = run();
check('D1 13:00 Chicago: no call, the day not marked (it runs after 14:00)', calls.length === 0 && S.floor.day === '2026-10-15' && S.last.floor === 'before 14:00 Chicago', S.last.floor);
NOW = FIXED + 2 * D;   /* 15:00 */
setState(S => { S.count = 6; });
S = run();
check('D2 the day\'s cap of 6 reached: no call, the floor says caps, the day not marked', calls.length === 0 && S.last.floor === 'caps' && S.floor.day === '2026-10-15', S.last.floor);
setState(S => { S.count = 5; });
S = run();
check('D3 five of six today: one call, one post, the day count 6', calls.length === 1 && aiRows().length === 3 && S.count === 6 && S.floor.made === 1, JSON.stringify(S.floor));
sheets.Posts.rows = sheets.Posts.rows.filter(r => !/^ai:fl:/.test(String(r[1])));

console.log('--- E a live gameweek');
NOW = FIXED + 3 * D;   /* Saturday 17 Oct, 15:00 Chicago */
sheets.Matchweeks.rows[3][1] = q(iso(NOW - 3 * H));   /* GW6's deadline passed this morning; its H2H rows are not finished */
setState(S => { S.floor = { day: '2026-10-16', made: 0, why: 'x' }; S.count = 0; S.buildGw = 6; });
S = run();
check('E1 the deadline passed and GW6 unfinished: no call, the floor marked live gameweek (match days as they were)', calls.length === 0 && aiRows().length === 2 && S.floor.day === '2026-10-17' && S.floor.why === 'live gameweek', JSON.stringify(S.floor));
check('E2 aiLiveGw: true while a fixture of a passed deadline is unfinished, false once every row is finished or before the deadline', ctx.aiLiveGw(ctx.aiLeague(), NOW) === true && ctx.aiLiveGw(ctx.aiLeague(), NOW - D) === false &&
  (() => { const fx = sheets['H2H Fixtures'].rows; const keep = fx.map(r => r.slice()); fx.forEach((r, i) => { if (i && Number(r[0]) === 6) r[5] = true; }); const v = ctx.aiLiveGw(ctx.aiLeague(), NOW); sheets['H2H Fixtures'].rows = keep; return v === false; })());
sheets.Matchweeks.rows[3][1] = q(iso(FIXED + 5 * D)); NOW = FIXED;

console.log('--- F quiet lanes, the wrong voice, a bad number, an error');
MODE = 'empty'; setState(S => { S.floor = { day: '2026-10-13', made: 0, why: 'x' }; S.count = 0; });
S = run();
check('F1 every lane answers {"posts":[]}: three calls (each lane tried), nothing written, the day marked quiet', calls.length === 3 && aiRows().length === 2 && S.floor.day === '2026-10-14' && S.floor.made === 0 && /^quiet day, nothing worth a post \(nothing from /.test(S.floor.why) && S.last.made === 0 && S.last.error === '', JSON.stringify(S.floor));
S = run();
check('F2 and the next run that day makes no call', calls.length === 0 && /^done today: quiet day/.test(S.last.floor));
MODE = 'wrongvoice'; setState(S => { S.floor = { day: '2026-10-13', made: 0, why: 'x' }; });
S = run();
check('F3 a lane answered in another voice: dropped and logged, nothing written, the day quiet', calls.length === 3 && aiRows().length === 2 && logs.some(l => /^AI post dropped:/.test(l)) && S.floor.made === 0, logs.filter(l => /dropped/.test(l)).join(' | '));
MODE = 'badnumber'; setState(S => { S.floor = { day: '2026-10-13', made: 0, why: 'x' }; });
S = run();
check('F4 a number not in the facts or the memory: dropped by the guard, nothing written', aiRows().length === 2 && logs.some(l => /^AI post dropped:.*999/.test(l)) && S.floor.made === 0);
MODE = 'throw'; setState(S => { S.floor = { day: '2026-10-13', made: 0, why: 'x' }; });
S = run();
check('F5 the call fails: the day is not marked done, ai.last carries the error and the floor says it will try again', calls.length === 1 && S.floor.day === '2026-10-13' && /Address unavailable/.test(S.last.error) && S.last.floor === 'error, trying again next run' && aiRows().length === 2, JSON.stringify(S.last));
MODE = 'ok'; S = run();
check('F6 the next run writes', calls.length === 2 && aiRows().length === 4 && S.floor.day === '2026-10-14' && S.floor.made === 2);
sheets.Posts.rows = sheets.Posts.rows.filter(r => !/^ai:fl:/.test(String(r[1])));

console.log('--- G memory and the guards as before');
const ev = { teams: ['Cold Palmers'], days: 7 }, mem = ctx.aiMemory(ev);
check('G1 aiMemory with days: every post of the window (3 days ago in, 8 days ago out), the notes', /Baha went top/.test(mem) && !/Eight days ago/.test(mem) && /\[note\]/.test(mem));
const mem0 = ctx.aiMemory({ teams: ['Cold Palmers'] });
check('G2 aiMemory without days is as it was (the recent posts)', /Eight days ago|Baha went top/.test(mem0));
MODE = 'ok'; reset(); const ev2 = ctx.aiFloorEvents(state(), L, NOW, '2026-10-14')[0];
const w = ctx.aiWrite(ev2);
check('G3 aiWrite for a lane keeps a post in the lane\'s voice', w.length === 1 && w[0].voice === ev2.voice);
check('G4 the four event triggers unchanged: a quiet day has no event', ctx.aiEvents(state()).length === 0);
delete props.ANTHROPIC_API_KEY; reset(); ctx.aiWriterTick();
check('G5 no key: the writer does nothing', calls.length === 0);
check('G6 health carries no key', !/sk-test/.test(JSON.stringify(get({ health: '1' }))));

T.done();
