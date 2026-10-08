// v3.21 tests: per-fixture BPS (ROADMAP A6, BUGS #8). Every refresh rewrites the hidden Fixture BPS tab for the current
// gameweek from the draft live feed's fixtures, with the classic fixtures feed per fixture when it is fresher, so the
// app can rank one match's BPS in a double gameweek.   node tests/codegs/v321.js
const T = require(__dirname + '/harness.js').make();
const { ctx, sheets, check, src } = T;
const resp = T.resp;

/* a small league: 4 clubs, 7 players; GW6 is a double for MCI (fixtures 61 and 63) */
const boot = {
  teams: [{ id: 1, short_name: 'MCI' }, { id: 2, short_name: 'ARS' }, { id: 3, short_name: 'LIV' }, { id: 4, short_name: 'CHE' }],
  elements: [
    { id: 11, code: 1001, web_name: 'Haaland', team: 1 }, { id: 12, code: 1002, web_name: 'Foden', team: 1 }, { id: 13, code: 1003, web_name: 'Dias', team: 1 },
    { id: 21, code: 2001, web_name: 'Saka', team: 2 }, { id: 22, code: 2002, web_name: 'Rice', team: 2 },
    { id: 31, code: 3001, web_name: 'Salah', team: 3 }, { id: 41, code: 4001, web_name: 'Palmer', team: 4 },
  ],
};
/* the classic feed has other element ids for the same players */
const classicIdToCode = { 111: 1001, 112: 1002, 113: 1003, 121: 2001, 122: 2002, 131: 3001, 141: 4001 };
const dStat = (s, h, a) => ({ s, h: h.map(([element, value]) => ({ element, value })), a: a.map(([element, value]) => ({ element, value })) });
const cStat = (identifier, h, a) => ({ identifier, h: h.map(([element, value]) => ({ element, value })), a: a.map(([element, value]) => ({ element, value })) });
/* draft live fixtures: 61 MCI v ARS (finished, bonus confirmed), 62 LIV v CHE (finished, bonus pending), 63 MCI v LIV (started, not over) */
const draftFixtures = () => [
  { id: 61, code: 9061, event: 6, team_h: 1, team_a: 2, kickoff_time: '2026-10-10T11:30:00Z', started: true, finished: true, finished_provisional: true,
    stats: [dStat('goals_scored', [[11, 2]], []), dStat('bps', [[11, 48], [12, 30], [13, 20]], [[21, 25], [22, 12]]), dStat('bonus', [[11, 3], [12, 2]], [[21, 1]])] },
  { id: 62, code: 9062, event: 6, team_h: 3, team_a: 4, kickoff_time: '2026-10-10T14:00:00Z', started: true, finished: false, finished_provisional: true,
    stats: [dStat('bps', [[31, 33]], [[41, 33]]), dStat('bonus', [], [])] },
  { id: 63, code: 9063, event: 6, team_h: 1, team_a: 3, kickoff_time: '2026-10-11T15:30:00Z', started: true, finished: false, finished_provisional: false,
    stats: [dStat('bps', [[12, 9], [11, -2]], [[31, 14]]), dStat('bonus', [], [])] },
  { id: 70, code: 9070, event: 7, team_h: 2, team_a: 3, kickoff_time: '2026-10-17T14:00:00Z', started: false, finished: false, stats: [dStat('bps', [[21, 99]], [])] },
];
let CLASSIC = null, classicCalls = [];
const base = ctx.UrlFetchApp.fetch;
ctx.UrlFetchApp.fetch = (url, o) => {
  if (/^https:\/\/fantasy\.premierleague\.com\/api\/fixtures\/\?event=\d+$/.test(url)) { classicCalls.push(url); if (CLASSIC instanceof Error) throw CLASSIC; return resp(200, CLASSIC || []); }
  return base(url, o);
};
const rowsOf = () => (sheets['Fixture BPS'] ? sheets['Fixture BPS'].rows.slice(1) : []);
const byFix = id => rowsOf().filter(r => r[1] === id);
const cell = (id, code, col) => { const r = byFix(id).find(r => r[7] === String(code)); return r ? r[ctx.FIXBPS_HEAD.indexOf(col)] : undefined; };

console.log('--- V the release');
check('V1 EMT_VERSION is v3.21 or later and the CHANGELOG has the entry', ctx.emtSelfVersion(src) === ctx.EMT_VERSION && ctx.emtSelfCmp(ctx.EMT_VERSION, 'v3.21') >= 0 && /\* v3\.21 · 8 Oct 2026\n \*   Per-fixture BPS, so a double gameweek's second match gets a provisional bonus/.test(src));
check('V2 refreshCore writes Fixture BPS right after GW Stats, in its own try/catch', /writeGwStats\(ss, boot, ownerByEl, gwLive, curEv\); \} catch \(e\) \{[^\n]*\n  try \{ writeFixtureBps\(ss, boot, gwLive, curEv, classicIdToCode\); \} catch \(e\) \{ Logger\.log\('Fixture BPS failed: ' \+ e\); \}/.test(src));
check('V3 the header: GW, Fixture, Home, Away, Kickoff (UTC), Started, Finished, Code, Player, Club, BPS, Bonus', ctx.FIXBPS_TAB === 'Fixture BPS' && ctx.FIXBPS_HEAD.join('|') === 'GW|Fixture|Home|Away|Kickoff (UTC)|Started|Finished|Code|Player|Club|BPS|Bonus');

console.log('--- F one feed');
const dId = {}; boot.elements.forEach(e => { dId[e.id] = e.code; });
let F = ctx.fixBpsFromFeed(draftFixtures(), 6, dId);
check('F1 the draft shape (stats s): the gameweek\'s 3 fixtures keyed by FPL\'s fixture code, GW7\'s left out', Object.keys(F).sort().join(',') === '9061,9062,9063');
check('F2 element ids become player codes; bps and bonus per fixture; other stats ignored', F[9061].bps['1001'] === 48 && F[9061].bps['2002'] === 12 && F[9061].bonus['1001'] === 3 && F[9061].bonus['2001'] === 1 && Object.keys(F[9061].bps).length === 5 && Object.keys(F[9061].bonus).length === 3 && !('goals_scored' in F[9061]));
check('F3 finished is finished or finished_provisional; started, kickoff and the clubs carried', F[9061].finished === true && F[9062].finished === true && F[9063].finished === false && F[9063].started === true && F[9062].kickoff === '2026-10-10T14:00:00Z' && F[9063].h === 1 && F[9063].a === 3);
F = ctx.fixBpsFromFeed([{ id: 61, code: 9061, event: 6, team_h: 1, team_a: 2, stats: [cStat('bps', [[111, 48]], [[121, 25]]), cStat('bonus', [[111, 3]], [])] }], 6, classicIdToCode);
check('F4 the classic shape (stats identifier, classic ids): the same result through classicIdToCode', F[9061].bps['1001'] === 48 && F[9061].bps['2001'] === 25 && F[9061].bonus['1001'] === 3);
check('F5 an unknown element id, a missing stats list or junk is skipped, never thrown', Object.keys(ctx.fixBpsFromFeed([{ id: 1, code: 5, event: 6, stats: [cStat('bps', [[999, 10]], [])] }, { id: 2, code: 6, event: 6 }, null, 'x'], 6, classicIdToCode)).join(',') === '5,6' && ctx.fixBpsFromFeed(null, 6, {}) && Object.keys(ctx.fixBpsFromFeed(undefined, 6, {})).length === 0);
check('F6 a feed without event numbers (fixtures/?event= already filtered) is taken as the gameweek\'s', Object.keys(ctx.fixBpsFromFeed([{ id: 61, code: 9061, stats: [] }], 6, {})).join(',') === '9061');

console.log('--- W the tab');
T.reset(); classicCalls.length = 0; CLASSIC = [];
let R = ctx.writeFixtureBps(ctx.SpreadsheetApp.getActive(), boot, { elements: {}, fixtures: draftFixtures() }, 6, classicIdToCode);
check('W1 the tab is created hidden with the header and one row per player per fixture (5 + 2 + 3)', R.ok && R.fixtures === 3 && R.rows === 10 && sheets['Fixture BPS'].hidden && sheets['Fixture BPS'].rows[0].join('|') === ctx.FIXBPS_HEAD.join('|') && rowsOf().length === 10, JSON.stringify(R));
check('W2 the classic feed was asked once, for this gameweek only', classicCalls.length === 1 && /\?event=6$/.test(classicCalls[0]));
check('W3 MCI\'s double: Haaland has a row in each MCI fixture with that fixture\'s own BPS (48 in 61, -2 in 63)', cell(61, 1001, 'BPS') === 48 && cell(63, 1001, 'BPS') === -2 && byFix(61).length === 5 && byFix(63).length === 3);
check('W4 the confirmed fixture carries its bonus, the pending ones 0', cell(61, 1001, 'Bonus') === 3 && cell(61, 1002, 'Bonus') === 2 && cell(61, 2001, 'Bonus') === 1 && cell(61, 1003, 'Bonus') === 0 && cell(62, 3001, 'Bonus') === 0 && cell(63, 1002, 'Bonus') === 0);
check('W5 every row: GW 6, the clubs by short name, the kickoff as text, Started and Finished as booleans, the player\'s name and club', rowsOf().every(r => r[0] === 6 && typeof r[2] === 'string' && typeof r[3] === 'string' && /^'2026-10-1\dT/.test(r[4]) && typeof r[5] === 'boolean' && typeof r[6] === 'boolean' && r[8] && r[9]) &&
  byFix(63)[0].slice(2, 4).join('|') === 'MCI|LIV' && cell(63, 3001, 'Player') === 'Salah' && cell(63, 3001, 'Club') === 'LIV' && cell(62, 3001, 'Finished') === true && cell(63, 3001, 'Finished') === false, JSON.stringify(rowsOf()[0]));
check('W6 rows in kickoff order, then BPS high to low within a fixture', rowsOf().map(r => r[1]).join(',') === '61,61,61,61,61,62,62,63,63,63' && byFix(61).map(r => r[10]).join(',') === '48,30,25,20,12');
check('W7 GW7\'s fixture is not in the tab', rowsOf().every(r => r[1] !== 70));
check('W8 a line in the log', T.logs.some(l => /^Fixture BPS GW6: 3 fixtures, 10 player lines$/.test(l)), T.logs.join(' | '));

console.log('--- C the classic overlay');
/* the draft feed froze fixture 63 at 2 players; the classic feed has 3 and, for 62, the bonus the draft feed lacks */
CLASSIC = [
  { id: 62, code: 9062, event: 6, team_h: 3, team_a: 4, kickoff_time: '2026-10-10T14:00:00Z', started: true, finished: false, finished_provisional: true, stats: [cStat('bps', [[131, 33]], [[141, 33]]), cStat('bonus', [[131, 3]], [[141, 3]])] },
  { id: 63, code: 9063, event: 6, team_h: 1, team_a: 3, kickoff_time: '2026-10-11T15:30:00Z', started: true, finished: false, finished_provisional: false, stats: [cStat('bps', [[112, 15], [111, 4], [113, 2]], [[131, 20]]), cStat('bonus', [], [])] },
  { id: 61, code: 9061, event: 6, team_h: 1, team_a: 2, kickoff_time: '2026-10-10T11:30:00Z', started: true, finished: true, stats: [cStat('bps', [[111, 48]], [[121, 25]]), cStat('bonus', [[111, 3]], [])] },
];
T.reset();
R = ctx.writeFixtureBps(ctx.SpreadsheetApp.getActive(), boot, { elements: {}, fixtures: draftFixtures() }, 6, classicIdToCode);
check('C1 fixture 63 comes from the classic feed (more players), 62 too (its bonus landed there first), 61 stays draft (5 players to 2)', R.ok && R.classic === 2 && R.rows === 5 + 2 + 4 && byFix(63).length === 4 && cell(63, 1002, 'BPS') === 15 && cell(63, 1003, 'BPS') === 2 && cell(62, 3001, 'Bonus') === 3 && byFix(61).length === 5 && cell(61, 1002, 'BPS') === 30, JSON.stringify(R));
check('C2 the log says so', T.logs.some(l => /^Fixture BPS GW6: 3 fixtures, 11 player lines, 2 fixtures from the classic feed$/.test(l)), T.logs.join(' | '));
CLASSIC = new Error('Address unavailable'); T.reset();
R = ctx.writeFixtureBps(ctx.SpreadsheetApp.getActive(), boot, { elements: {}, fixtures: draftFixtures() }, 6, classicIdToCode);
check('C3 the classic feed failing: the draft rows alone, the failure logged, nothing thrown', R.ok && R.classic === 0 && R.rows === 10 && T.logs.some(l => /classic fixtures feed failed: Error: Address unavailable/.test(l)));
CLASSIC = []; T.reset();
R = ctx.writeFixtureBps(ctx.SpreadsheetApp.getActive(), boot, { elements: {} }, 6, classicIdToCode);
check('C4 neither feed lists the fixtures: the tab is left as it was and the log says why', R.ok === false && R.why === 'no fixtures' && rowsOf().length === 10 && T.logs.some(l => /neither feed lists the fixtures; the tab is left as it was/.test(l)));
R = ctx.writeFixtureBps(ctx.SpreadsheetApp.getActive(), boot, null, null, classicIdToCode);
check('C5 no current gameweek (the season over): nothing written', R.ok === false && R.why === 'no current gameweek' && rowsOf().length === 10);
CLASSIC = [{ id: 61, code: 9061, event: 6, team_h: 1, team_a: 2, kickoff_time: '2026-10-10T11:30:00Z', started: true, finished: true, stats: [cStat('bps', [[111, 48]], [[121, 25]])] }]; T.reset(); classicCalls.length = 0;
R = ctx.writeFixtureBps(ctx.SpreadsheetApp.getActive(), boot, null, 6, classicIdToCode);
check('C6 no draft live feed at all (gwLive null): the classic feed alone', R.ok && R.classic === 1 && R.rows === 2 && rowsOf().length === 2 && cell(61, 2001, 'BPS') === 25);
R = ctx.writeFixtureBps(ctx.SpreadsheetApp.getActive(), boot, { elements: {}, fixtures: draftFixtures() }, 6, {});
check('C7 no classic id map (the classic bootstrap failed): the draft feed alone, no classic call', R.ok && R.classic === 0 && R.rows === 10 && classicCalls.length === 1);

T.done();
