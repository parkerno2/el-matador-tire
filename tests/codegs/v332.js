// v3.32 tests: the feed posts are checked before they are kept (P1, the polish pass; Parker, 11 Oct 2026: "Still agreed
// on the feed too"). The demo's Feed had shown a post cut off mid-word ("Expect movemen"), "Five free agents" over six
// names, Malcolm's "Neither has won this series yet" against a 4-3 series, and "put $30 on October with a 9% model".
// A post must end a sentence, a count must match its list, a head-to-head claim must agree with the series it was given,
// and no post carries a percentage, odds, money or betting language; a reply the token budget cut keeps nothing; a
// dropped post is logged and counted in ?health=1 ai.last.   node tests/codegs/v332.js
const T = require(__dirname + '/harness.js').make();
const { ctx, check, src, sheets, props, logs } = T;
const Sheet = T.Sheet;
const H = 3600e3, D = 24 * H, iso = ms => new Date(ms).toISOString();

/* the clock: Wednesday 14 Oct 2026, 15:00 in Chicago (20:00 UTC), a quiet day before GW6 */
const FIXED = Date.parse('2026-10-14T20:00:00Z');
let NOW = FIXED;
class FakeDate extends Date { constructor(...a) { if (a.length) super(...a); else super(NOW); } static now() { return NOW; } }
ctx.Date = FakeDate;
const q = s => "'" + s;
sheets.Matchweeks = new Sheet('Matchweeks', [['GW', 'Deadline (UTC)', 'MOTM period', 'Finished', 'Notes', 'Waivers (UTC)'],
  [4, q('2026-09-11T17:30:00Z'), 'Aug & Sep', 'TRUE', '', q('2026-09-10T17:30:00Z')], [5, q(iso(FIXED - 5 * D)), 'Aug & Sep', 'TRUE', '', q(iso(FIXED - 5 * D - D))],
  [6, q(iso(FIXED + 44 * H)), 'October', 'FALSE', '', q(iso(FIXED + 15 * H))], [7, q(iso(FIXED + 7 * D)), 'October', 'FALSE', '', q(iso(FIXED + 6 * D))]]);
sheets['Club Fixtures'] = new Sheet('Club Fixtures', [['GW', 'Home', 'Away', 'Kickoff (UTC)', 'Finished', 'Home goals', 'Away goals', 'Started', 'Mins'],
  [5, 'ARS', 'CHE', q(iso(FIXED - 4 * D)), 'TRUE', 2, 1, 'TRUE', 90], [6, 'MCI', 'LIV', q(iso(FIXED + 2 * D)), 'FALSE', '', '', 'FALSE', 0]]);
sheets.Standings.rows[0].push('Waiver pick'); sheets.Standings.rows.slice(1).forEach((r, i) => r.push(8 - i));
sheets.Transactions = new Sheet('Transactions', [['GW', 'Team', 'Manager', 'In', 'Out', 'Type', 'Result', 'When (UTC)'],
  [6, 'Trophy Hunters', 'Jacob Taylor', 'Kudus', 'Semenyo', 'Waiver', 'Accepted', q(iso(FIXED - 2 * D))]]);
sheets.Players = new Sheet('Players', [['Code', 'Player', 'Pos', 'Club', 'Owner', 'Status', 'News', 'Draft rank', 'Season pts', 'Mins', 'Form', 'xGI', 'EP next', 'Proj', 'Nation', 'Full name'],
  [223094, 'Haaland', 'FWD', 'MCI', 'Cold Palmers', 'a', '', 1, 61, 450, 9.1, 0.9, 8.4, 210, 'NO', 'Erling Haaland'],
  [501234, 'Wharton', 'MID', 'CRY', 'FREE', 'a', '', 140, 22, 380, 5.3, 0.4, 3.9, 110, 'EN', 'Adam Wharton'],
  [509876, 'Welbeck', 'FWD', 'BHA', 'FREE', 'a', '', 150, 27, 400, 6.2, 0.6, 4.6, 120, 'EN', 'Danny Welbeck'],
  [509877, 'Mateta', 'FWD', 'CRY', 'FREE', 'a', '', 151, 26, 390, 6.0, 0.6, 4.5, 118, 'FR', 'Jean-Philippe Mateta'],
  [509878, 'Elanga', 'MID', 'NEW', 'FREE', 'a', '', 152, 25, 380, 5.9, 0.5, 4.4, 116, 'SE', 'Anthony Elanga'],
  [509879, 'Wissa', 'FWD', 'NEW', 'FREE', 'a', '', 153, 24, 370, 5.8, 0.5, 4.3, 114, 'CD', 'Yoane Wissa'],
  [509880, 'Kluivert', 'MID', 'BOU', 'FREE', 'a', '', 154, 23, 360, 5.7, 0.5, 4.2, 112, 'NL', 'Justin Kluivert']]);
sheets.Rosters = new Sheet('Rosters', [['Team', 'Manager', 'Player', 'Pos', 'Club', 'FPL rank', 'Proj pts', 'Best XI', 'Status', 'News', 'Drafted', 'Season pts', 'GW pts', 'GW mins', 'Code', 'Nation', 'OVR', 'TOTW', 'GW XI', 'GW mins'],
  ['Cold Palmers', 'Parker Nolan', 'Haaland', 'FWD', 'MCI', 1, 210, 'XI', 'a', '', 'R1.1', 61, 0, 0, 223094, 'NO', 91, '', '', 0]]);
props.ANTHROPIC_API_KEY = 'sk-test';

/* the Claude mock: REPLY picks the text (or the whole body) per voice; STOP the stop_reason */
let REPLY = {}, STOP = 'end_turn', calls = [];
const realFetch = ctx.UrlFetchApp.fetch;
ctx.UrlFetchApp.fetch = (url, o) => {
  o = o || {};
  if (url === 'https://api.anthropic.com/v1/messages') {
    const body = JSON.parse(o.payload), user = body.messages[0].content, voice = (user.match(/WRITE: One (\w+) post/) || [])[1] || '';
    calls.push({ body, user, voice });
    const r = REPLY[voice];
    const posts = r == null ? [] : [{ voice, text: r, teams: ['Cold Palmers'] }];
    return T.resp(200, { stop_reason: STOP, content: [{ type: 'text', text: typeof r === 'object' && r && r.raw != null ? r.raw : JSON.stringify({ posts }) }] });
  }
  return realFetch(url, o);
};
const state = () => JSON.parse(props.EMT_AI_STATE || '{}');
const setState = f => { const S = state(); f(S); props.EMT_AI_STATE = JSON.stringify(S); };
const aiRows = () => sheets.Posts.rows.slice(1).filter(r => r[3] === 'ai');
const get = p => JSON.parse(ctx.doGet({ parameter: p }).t);
const run = () => { calls.length = 0; logs.length = 0; ctx.aiWriterTick(); return state(); };
const L = ctx.aiLeague(), first = t => L.first(t);   /* the table before the row W0 adds */
const TEAMS = L.table.map(t => t.team);
const A = TEAMS[0], B = TEAMS[1], fa = first(A), fb = first(B);

console.log('--- V the release');
check('V1 EMT_VERSION is v3.32 or later and the CHANGELOG has the entry', ctx.emtSelfVersion(src) === ctx.EMT_VERSION && ctx.emtSelfCmp(ctx.EMT_VERSION, 'v3.32') >= 0 && /\* v3\.32 · 11 Oct 2026\n \*   The feed posts are checked before they are kept/.test(src));
check('V2 the system prompt: the voices, the tone block and rules 1 to 9 as they were, rule 10 the numbers-are-facts rule', /^You write short posts for the Feed of Matchweek/.test(ctx.EMT_AI_SYSTEM) && /THE READERS\. Eight lads/.test(ctx.EMT_AI_SYSTEM) && /- archizio: Archizio Poblano, the insider/.test(ctx.EMT_AI_SYSTEM) && /- clark: Clark Moldridge of The Terrace/.test(ctx.EMT_AI_SYSTEM) && /- malcolm: Malcolm Tyre in the booth/.test(ctx.EMT_AI_SYSTEM) &&
  /\n9\. Rumours come from the rumour mill/.test(ctx.EMT_AI_SYSTEM) && /\n10\. Numbers are facts, never jokes: no joke built on a model percentage, odds, a score or a margin/.test(ctx.EMT_AI_SYSTEM) && /A count you write \("five free agents"\) must match the list that follows it/.test(ctx.EMT_AI_SYSTEM) && /Every post ends as a complete sentence\./.test(ctx.EMT_AI_SYSTEM) && ctx.EMT_AI_VOICES.join() === 'archizio,clark,malcolm');
check('V3 the floor ask, the lanes and the caps are unchanged', /real, specific and new/.test(ctx.EMT_AI_FLOOR_ASK) && ctx.EMT_AI_FLOOR_LANES.join() === 'archizio,clark,malcolm' && ctx.EMT_AI_PER_RUN === 2 && ctx.EMT_AI_PER_DAY === 6 && ctx.EMT_AI_FLOOR === 2);

console.log('--- S a post ends a sentence');
check('S1 "Expect movemen" (cut mid-word) is not a sentence end', !ctx.aiSentenceOk('UNDERSTAND. Waivers close in 15 hours. Expect movemen'));
check('S2 a full stop, a question mark, an exclamation mark, a closing quote or bracket after one', ['Expect movement.', 'Who benched him?', 'Sacked in the morning!', 'He said "no comment."', 'Correctly, but still.)', 'Fully fit. Just shite.'].every(ctx.aiSentenceOk));
check('S3 a trailing word, a comma, a colon or a dash is not', ['Expect movement', 'Expect movement,', 'Five names:', 'Expect movement -', 'and then'].every(t => !ctx.aiSentenceOk(t)));
check('S4 aiPostProblem names it', ctx.aiPostProblem('UNDERSTAND. Waivers close in 15 hours. Expect movemen', { facts: {} }, []) === 'does not end a sentence');

console.log('--- C a count matches its list');
const FREE = { best_free_agents: ['Welbeck', 'Wharton', 'Mateta', 'Elanga', 'Wissa', 'Kluivert'].map(p => ({ player: p, pos: 'FWD', club: 'X' })), moves: [{ team: A, manager: fa, in: 'Kudus', out: 'Semenyo' }], table: L.table };
const names = ctx.aiFactNames(FREE);
check('C1 the names in FACTS: the six free agents, the move\'s players, the teams and managers of the table', ['Welbeck', 'Kluivert', 'Kudus', 'Semenyo', A, fa, B].every(n => names.indexOf(n) > -1) && names.indexOf('FWD') < 0 && names.indexOf('X') < 0, names.join('|'));
check('C2 "Five free agents" over six names is dropped, with the reason', /^says Five free agents and names 6 \(/.test(ctx.aiCountProblem('UNDERSTAND. Five free agents worth a look before the window: Welbeck, Wharton, Mateta, Elanga, Wissa and Kluivert. Nobody has moved.', names)), ctx.aiCountProblem('UNDERSTAND. Five free agents worth a look before the window: Welbeck, Wharton, Mateta, Elanga, Wissa and Kluivert. Nobody has moved.', names));
check('C3 five names after "five free agents" pass; "six free agents" over six names pass; a digit count too', ctx.aiCountProblem('Five free agents worth a look: Welbeck, Wharton, Mateta, Elanga and Wissa. Nobody has moved.', names) === '' && ctx.aiCountProblem('Six free agents sit there: Welbeck, Wharton, Mateta, Elanga, Wissa, Kluivert.', names) === '' && ctx.aiCountProblem('3 players nobody wants. Welbeck, Wharton, Mateta.', names) === '');
check('C4 the list in the next sentence counts ("Three free agents are sitting there. Welbeck, Wharton, Mateta, Elanga.")', /^says Three free agents and names 4/.test(ctx.aiCountProblem('UNDERSTAND. Three free agents are sitting there. Welbeck, Wharton, Mateta, Elanga. Nobody has moved.', names)));
check('C5 a count with no list is not judged ("Three managers moved this week, and ' + fa + ' led the way"; "five defeats"; "two points clear")', ctx.aiCountProblem('Three managers moved this week, and ' + fa + ' led the way.', names) === '' && ctx.aiCountProblem('Five defeats, zero points, and still leading the derby.', names) === '' && ctx.aiCountProblem(fa + ' is two points clear of ' + fb + '.', names) === '');
check('C6 a count word for a noun that is not a list ("in 15 hours", "2 points") is not judged', ctx.aiCountProblem('Waivers close in 15 hours. Welbeck and Wharton are there for nothing.', names) === '' && ctx.aiCountProblem('Two points separate ' + fa + ', ' + fb + ' and the rest.', names) === '');

console.log('--- H a post agrees with the head-to-head');
const SER = { fixtures_with_history: [{ home: A, home_table_pos: 1, away: B, away_table_pos: 2, series_wins: { [A]: 4, [B]: 3 }, series_draws: 0, last_meeting: 'GW5 ' + A + ' 44-40 ' + B },
  { home: TEAMS[2], away: TEAMS[3], series_wins: { [TEAMS[2]]: 0, [TEAMS[3]]: 0 }, series_draws: 0 }], table: L.table };
const sp = t => ctx.aiSeriesProblem(t, SER);
check('H1 "Neither has won this series yet" about a 4-3 series is dropped, with the series in the reason', sp(A + ' against ' + B + ' on Saturday. Neither has won this series yet. The booth expects a classic.') === 'says nobody has won; the series is ' + A + ' 4-3 ' + B, sp(A + ' against ' + B + ' on Saturday. Neither has won this series yet. The booth expects a classic.'));
check('H2 the manager\'s first names: "Neither ' + fa + ' nor ' + fb + ' has won" is dropped', /^says nobody has won/.test(sp('Neither ' + fa + ' nor ' + fb + ' has won a meeting between them.')));
check('H3 "first meeting" and "never met" against a played series are dropped', /first meeting/.test(sp(fa + ' meets ' + fb + ' for the first ever meeting of the sides.')) && /first meeting/.test(sp(A + ' and ' + B + ' have never met. Somebody has to lose.')));
check('H4 the side with fewer wins put in front is dropped ("' + fb + ' leads the series", "' + B + ' has the edge")', /^puts /.test(sp(fb + ' leads the series and ' + fa + ' knows it.')) && /^puts /.test(sp(B + ' has the edge in this one, and it shows.')));
check('H5 the series called level when it is not is dropped', /level/.test(sp('Honours even in the series between ' + A + ' and ' + B + ', and that is how the booth likes it.')) && /level/.test(sp(A + ' and ' + B + '. The head-to-head is all square. Someone blinks.')));
check('H6 a wrong series score is dropped ("' + fa + ' leads 4-2"), the right one in either order passes, a match score is not a series', /gives the series as 4-2/.test(sp(fa + ' leads the series 4-2 and ' + fb + ' has heard enough about it.')) && sp(fa + ' leads the series 4-3 and ' + fb + ' has heard enough about it.') === '' && sp(fb + ' trails the series 3-4, and knows it.') === '' && sp('Last time ' + A + ' took it 44-40 and ' + fb + ' has not forgotten.') === '');
check('H7 the true line passes, with the leader, the record and the last meeting', sp(A + ' against ' + B + '. ' + fa + ' leads the series 4-3, and the last meeting went 44-40 his way. Calm, then the knife.') === '');
check('H8 a true line about the other fixture passes ("' + first(TEAMS[2]) + ' and ' + first(TEAMS[3]) + ' have never met"), and a post naming no side is judged against every fixture', sp(first(TEAMS[2]) + ' and ' + first(TEAMS[3]) + ' have never met. Somebody has to lose.') === '' && sp(TEAMS[2] + ' host ' + TEAMS[3] + '. Neither has won a meeting yet.') === '' && /^says nobody has won/.test(sp(A + ' and ' + B + '. Neither has won a meeting yet.')));
check('H9 facts without a series are never judged', ctx.aiSeriesProblem('Neither has won this series yet.', { table: L.table }) === '' && ctx.aiPostProblem('Neither has won this series yet.', { facts: { fixtures: [{ home: A, away: B }] } }, []) === '');

console.log('--- O no number jokes');
const oddsBad = ['MALCOLM here. Put $30 on October with a 9% model and tell me how it ends.', 'The model gives him 9% and the booth gives him less.', 'Nine per cent, says the model.', 'Odds on a sacking by Tuesday.', 'I would bet the house on it.', 'A fiver says he benches him again.', 'Stake your season on Haaland.', '£20 on Parker finishing fourth.', 'The bookies have stopped taking money.', 'An acca of benchings.'];
check('O1 "put $30 on October with a 9% model" and every other percentage, odds, money or betting line is dropped', oddsBad.every(t => /^odds, money or a percentage/.test(ctx.aiOddsProblem(t))), oddsBad.map(t => ctx.aiOddsProblem(t) || 'PASSED: ' + t).join(' | '));
check('O2 a number as a plain fact passes: a score, a margin, a record, points, a gameweek, hours', ['Lost 44-40 and benched the man who scored 12.', 'Six points clear with 3 games gone.', 'Waivers close in 15 hours.', 'The best bench in GW5 scored 31.', 'Form is temporary. Owning Parker is permanent.'].every(t => ctx.aiOddsProblem(t) === ''));
check('O3 the reason, through aiPostProblem', ctx.aiPostProblem('Put $30 on October with a 9% model and tell me how it ends.', { facts: {} }, []) === 'odds, money or a percentage ($30)');

console.log('--- W the writer keeps only what passes (the floor path, three lanes)');
const lanesToday = (() => { const n = ctx.EMT_AI_FLOOR_LANES.length, s = Math.floor(FIXED / 864e5) % n; return [0, 1, 2].map(i => ctx.EMT_AI_FLOOR_LANES[(s + i) % n]); })();
let S = run();   /* the first run after the update: no call, the day marked */
setState(S => { S.floor = { day: '2026-10-13', made: 0, why: 'wrote 2' }; });
/* Archizio cut off mid-word (15 is in his FACTS: hours_to_waivers), Clark fine, Malcolm's series lie about the first fixture with a series */
/* a finished meeting of GW6's first pair, so Malcolm's lane carries a series with a winner (the harness's GW6 pairs are all first meetings) */
const gw6 = ctx.aiNextFixtures(L, 6, false)[0];
sheets['H2H Fixtures'].rows.push([0, gw6.home, 46, gw6.away, 40, true]);
const mal = ctx.aiFloorEvents(state(), ctx.aiLeague(), NOW, '2026-10-14').find(e => e.voice === 'malcolm');
const played = mal.facts.fixtures_with_history.find(f => (f.series_wins[f.home] || 0) !== (f.series_wins[f.away] || 0));
check('W0 Malcolm\'s facts carry that series (1-0) and its last meeting', played && played.series_wins[gw6.home] === 1 && played.series_wins[gw6.away] === 0 && /46-40/.test(played.last_meeting), JSON.stringify(mal.facts.fixtures_with_history[0]));
REPLY = { archizio: 'UNDERSTAND. Waivers close in 15 hours. Expect movemen', clark: 'PARKER IS PROJECTED TO WIN AGAIN AND I AM NOT OK WITH IT. Sack the lot of them.', malcolm: played.home + ' against ' + played.away + '. Neither has won this series yet. The booth expects a classic.' };
S = run();
check('W1 three calls (every lane was asked, because two answers were refused), one post kept: Clark\'s', calls.length === 3 && aiRows().length === 1 && aiRows()[0][2] === 'clark', JSON.stringify({ calls: calls.length, rows: aiRows().map(r => r[2]) }));
check('W2 the two drops are logged with their reasons and the text', logs.some(l => /^AI post dropped \(does not end a sentence\): UNDERSTAND\. Waivers close in 15 hours\. Expect movemen$/.test(l)) && logs.some(l => /^AI post dropped \(says nobody has won; the series is /.test(l)), logs.filter(l => /dropped/.test(l)).join(' | '));
check('W3 ai.last counts them: dropped 2, the reasons by voice; made 1', S.last.dropped === 2 && S.last.drops.length === 2 && S.last.drops.some(d => /^archizio: does not end a sentence$/.test(d)) && S.last.drops.some(d => /^malcolm: says nobody has won; the series is /.test(d)) && S.last.made === 1, JSON.stringify(S.last));
let h = get({ health: '1' });
check('W4 ?health=1 ai.last.dropped and ai.last.drops; no new top-level key', h.ai.last.dropped === 2 && h.ai.last.drops.length === 2 && Object.keys(h).sort().join() === Object.keys(get({ health: '1' })).sort().join() && !('drops' in h.ai));

console.log('--- M a reply the token budget cut keeps nothing');
sheets.Posts.rows = sheets.Posts.rows.filter(r => !/^ai:fl:/.test(String(r[1])));
sheets.Matchweeks.rows[3][1] = q(iso(FIXED + 5 * D));   /* GW6's deadline out of the build-up window and not passed on the days that follow */
NOW = FIXED + D; setState(S => { S.floor = { day: '2026-10-14', made: 0, why: 'x' }; S.count = 0; });
STOP = 'max_tokens';
REPLY = { archizio: 'UNDERSTAND. Waivers close in 15 hours. Expect movement.', clark: 'A complete take. Sack them all.', malcolm: 'A complete line. Calm, then the knife.' };
S = run();
check('M1 every reply cut by the budget: three calls, nothing written, three drops saying so', calls.length === 3 && aiRows().length === 0 && S.last.dropped === 3 && S.last.drops.every(d => /the reply was cut off by the token budget/.test(d)) && logs.filter(l => /^AI post dropped \(the reply was cut off by the token budget\)/.test(l)).length === 3, JSON.stringify(S.last));
STOP = 'end_turn';
NOW = FIXED + 2 * D; setState(S => { S.floor = { day: '2026-10-15', made: 0, why: 'x' }; S.count = 0; });
S = run();
check('M2 the same three replies with a normal stop: two posts kept (the floor\'s two), nothing dropped', aiRows().length === 2 && S.last.dropped === 0 && S.last.drops.length === 0 && S.last.made === 2, JSON.stringify(S.last));
check('M3 an en dash in a kept post reads as a comma, like the em dash', (() => { sheets.Posts.rows = sheets.Posts.rows.filter(r => !/^ai:fl:/.test(String(r[1]))); NOW = FIXED + 3 * D; setState(S => { S.floor = { day: '2026-10-16', made: 0, why: 'x' }; S.count = 0; });
  REPLY = { archizio: 'UNDERSTAND. Waivers close in 15 hours – expect movement — or not.', clark: null, malcolm: null }; run(); const r = aiRows()[0]; return r && r[7] === 'UNDERSTAND. Waivers close in 15 hours , expect movement , or not.'; })(), JSON.stringify(aiRows().map(r => r[7])));

T.done();
