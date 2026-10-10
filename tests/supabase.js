// The Supabase side of the repo (ROADMAP B1, Q8): the functions under supabase/functions/ are the ones the deploy
// workflow ships, the folder carries no key, the migrations only add, and the ingest's pure transform builds the
// tabs the Sheet has, column for column (BUGS.md #29). Plain Node, no network.
//   node tests/supabase.js
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
let fails = 0;
const check = (label, cond, info) => { if (!cond) fails++; console.log((cond ? 'PASS ' : 'FAIL ') + label + (!cond && info ? '  ' + info : '')); };
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const exists = p => fs.existsSync(path.join(ROOT, p));

/* ---------- the folder ---------- */
const FN = fs.readdirSync(path.join(ROOT, 'supabase/functions')).filter(f => fs.statSync(path.join(ROOT, 'supabase/functions', f)).isDirectory()).sort();
check('five functions, each with an index.ts', FN.join() === 'ingest,league-lookup,register-league,seed-statics,tabs' && FN.every(f => exists('supabase/functions/' + f + '/index.ts')), FN.join());
const cfg = read('supabase/config.toml');
const cfgFns = (cfg.match(/^\[functions\.([a-z-]+)\]/gm) || []).map(l => l.replace(/^\[functions\.|\]$/g, '')).sort();
check('config.toml names exactly those functions', cfgFns.join() === FN.join(), cfgFns.join());
check('every function is public in config.toml (verify_jwt = false), as deployed', (cfg.match(/verify_jwt = false/g) || []).length === FN.length && !/verify_jwt = true/.test(cfg));
check('the ingest imports its transform from the same folder', /from '\.\/transform\.esm\.js'/.test(read('supabase/functions/ingest/index.ts')) && exists('supabase/functions/ingest/transform.esm.js'));

/* ---------- no key anywhere under supabase/ or in the workflow ---------- */
const walk = d => fs.readdirSync(path.join(ROOT, d)).flatMap(f => { const p = d + '/' + f; return fs.statSync(path.join(ROOT, p)).isDirectory() ? walk(p) : [p]; });
const files = walk('supabase').concat(['.github/workflows/supabase.yml']);
const leaks = files.filter(f => { const t = read(f); return /sbp_[A-Za-z0-9]{20,}/.test(t) || /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/.test(t) || /sb_secret_|sb_publishable_/.test(t) || /postgres(ql)?:\/\/[^\s'"]*:[^\s'"]*@/.test(t); });
check('no access token, API key, JWT or connection string in supabase/ or the workflow (' + files.length + ' files)', leaks.length === 0, leaks.join(', '));
const envOnly = FN.every(f => { const t = read('supabase/functions/' + f + '/index.ts'); return !/SERVICE_ROLE_KEY\s*=|SUPABASE_URL\s*=\s*['"]/.test(t); });
check('the functions read their keys from Deno.env only', envOnly);

/* ---------- migrations and repairs only add ---------- */
const mig = fs.readdirSync(path.join(ROOT, 'supabase/migrations')).filter(f => /\.sql$/.test(f)).sort();
check('the baseline migration is first', mig[0] === '20260830201232_baseline.sql', mig.join());
const sqlFiles = mig.map(f => 'supabase/migrations/' + f).concat(exists('supabase/repairs') ? walk('supabase/repairs').filter(f => /\.sql$/.test(f)) : []);
const destructive = sqlFiles.filter(f => /\b(drop\s+(table|column|policy|trigger|function|schema|index)|delete\s+from|truncate|disable\s+row\s+level\s+security|alter\s+table\s+\S+\s+drop)\b/i.test(read(f).replace(/--[^\n]*/g, '')));
check('no migration or repair drops, deletes, truncates or turns row-level security off (' + sqlFiles.length + ' files)', destructive.length === 0, destructive.join(', '));
const base = read('supabase/migrations/20260830201232_baseline.sql');
const tables = ['leagues', 'league_members', 'invites', 'tab_snapshots', 'ingest_runs', 'nation_cache', 'players', 'gw_stats', 'predictions', 'club_fixtures', 'events', 'rosters', 'h2h_fixtures', 'standings', 'transactions', 'gw_log', 'specials'];
check('the baseline creates the 17 tables and turns row-level security on for each', tables.every(t => base.includes('create table if not exists public.' + t + ' (') && base.includes('alter table public.' + t + ' enable row level security;')));
check('the baseline carries the freeze trigger and the two cron jobs, guarded', /tab_snapshots_freeze\(\)/.test(base) && /ingest-hourly/.test(base) && /ingest-live/.test(base) && /if not exists \(select 1 from cron\.job/.test(base));

/* ---------- the workflow ---------- */
const wf = read('.github/workflows/supabase.yml');
check('the workflow runs on a push to main touching the functions, and on dispatch', /branches: \[main\]/.test(wf) && /supabase\/functions\/\*\*/.test(wf) && /workflow_dispatch/.test(wf));
check('the test step runs before the deploy', wf.indexOf('run: node tests/supabase.js') > 0 && wf.indexOf('run: node tests/supabase.js') < wf.indexOf('supabase@2.120.0 functions deploy'));
check('the deploy uses the repository secret and the project ref, bundled without Docker', /secrets\.SUPABASE_ACCESS_TOKEN/.test(wf) && /--project-ref vcokquhzqpqvwrybndnr/.test(wf) && /--use-api/.test(wf));
check('the workflow never echoes the token', !/echo[^\n]*\$\{?\{?\s*(SUPABASE_ACCESS_TOKEN|secrets\.)/.test(wf) && !/::debug|set -x|--debug/.test(wf));

/* ---------- the transform: the ingest's pure pipeline on a small league ---------- */
const far = new Date(Date.now() + 7 * 864e5).toISOString().replace(/\.\d{3}Z$/, 'Z');
const el = (id, code, name, type, team, extra) => Object.assign({ id, code, web_name: name, first_name: name, second_name: 'X', element_type: type, team, draft_rank: id * 10, total_points: 50, minutes: 900, status: 'a', news: '', form: '3.0', expected_goal_involvements: '1.0', ep_this: '4.5', ep_next: '5.1' }, extra || {});
const boot = {
  events: [{ id: 1, deadline_time: '2026-08-21T17:30:00Z', finished: true, waivers_time: '2026-08-20T17:30:00Z' }, { id: 2, deadline_time: far, finished: false, waivers_time: '2026-08-27T17:30:00Z' }],
  teams: [{ id: 1, short_name: 'ARS', name: 'Arsenal', code: 3, strength_overall_home: 4, strength_overall_away: 5 }, { id: 2, short_name: 'AVL', name: 'Aston Villa', code: 7, strength_overall_home: 0, strength_overall_away: 0 }],
  elements: [el(1, 1001, 'Raya', 1, 1), el(2, 1002, 'Saka', 3, 1), el(3, 1003, 'Watkins', 4, 2), el(4, 1004, 'Rogers', 3, 2)]
};
const details = {
  league: { id: 1, name: 'Test League', scoring: 'h' },
  league_entries: [{ id: 11, entry_id: 101, entry_name: 'Alpha', player_first_name: 'Al', player_last_name: 'Pha', waiver_pick: 2 }, { id: 12, entry_id: 102, entry_name: 'Beta', player_first_name: 'Be', player_last_name: 'Ta', waiver_pick: 1 }],
  matches: [{ event: 1, league_entry_1: 11, league_entry_2: 12, league_entry_1_points: 40, league_entry_2_points: 30, started: true, finished: true }, { event: 2, league_entry_1: 12, league_entry_2: 11, league_entry_1_points: 0, league_entry_2_points: 0, started: false, finished: false }],
  standings: [{ league_entry: 11, matches_won: 1, matches_drawn: 0, matches_lost: 0, points_for: 40, points_against: 30, total: 3, rank: 1 }, { league_entry: 12, matches_won: 0, matches_drawn: 0, matches_lost: 1, points_for: 30, points_against: 40, total: 0, rank: 2 }]
};
const choices = { choices: [{ index: 1, round: 1, pick: 1, entry: 101, entry_name: 'Alpha', element: 2 }, { index: 2, round: 1, pick: 2, entry: 102, entry_name: 'Beta', element: 3 }, { index: 3, round: 2, pick: 1, entry: 102, entry_name: 'Beta', element: 4 }, { index: 4, round: 2, pick: 2, entry: 101, entry_name: 'Alpha', element: 1 }] };
const estat = { element_status: [{ element: 1, owner: 101 }, { element: 2, owner: 101 }, { element: 3, owner: 102 }, { element: 4, owner: 102 }] };
const tx = { transactions: [
  { event: 2, entry: 101, element_in: 3, element_out: 1, kind: 'w', result: 'di', added: '2026-08-25T10:00:00Z' },
  { event: 2, entry: 101, element_in: 4, element_out: 1, kind: 'w', result: 'do', added: '2026-08-25T10:01:00Z' },
  { event: 2, entry: 102, element_in: 2, element_out: 3, kind: 'f', result: 'dp', added: '2026-08-25T10:02:00Z' },
  { event: 2, entry: 102, element_in: 1, element_out: 4, kind: 'f', result: 'zz', added: '2026-08-25T10:03:00Z' },
  { event: 2, entry: 102, element_in: 1, element_out: 4, kind: 'w', result: 'a', added: '2026-08-25T10:04:00Z' }] };
const fixtures = [{ id: 1, code: 9001, event: 1, team_h: 1, team_a: 2, kickoff_time: '2026-08-22T14:00:00Z', started: true, finished: true, team_h_score: 2, team_a_score: 1, minutes: 90 }, { id: 2, code: 9002, event: 2, team_h: 2, team_a: 1, kickoff_time: far, started: false, finished: false, team_h_score: null, team_a_score: null, minutes: 0 }];
const classic = { boot: { elements: boot.elements.map(e => Object.assign({}, e, { id: e.id + 500 })), teams: boot.teams }, fixtures, dream: null, live: null };
const raw = { boot, details, choices, estat, transactions: tx, fixtures, lineups: {}, finishedLive: {}, finishedLineups: {}, classic, gwLive: null };
const statics = { fc27: {}, fc26: {}, existingRatings: {}, ratingsVersion: null, natMap: { 1001: 'ES' }, gwStatsFinal: { 1: true }, gwLogLogged: { 1: true } };

(async () => {
  const Ingest = (await import(path.join(ROOT, 'supabase/functions/ingest/transform.esm.js'))).default;
  check('the transform exports build, fetchPlan and assemble', typeof Ingest.build === 'function' && typeof Ingest.fetchPlan === 'function' && typeof Ingest.assemble === 'function');
  const T = Ingest.build(raw, statics, { now: new Date(), config: {} });
  const col = (tab, name, row) => { const i = T[tab].header.indexOf(name); return i < 0 ? undefined : T[tab].rows[row][i]; };
  check('the tabs the Sheet has are built', ['Grades', 'Draft Board', 'Rosters', 'Clubs', 'H2H Fixtures', 'Club Fixtures', 'Transactions', 'Standings', 'Matchweeks', 'MOTM', 'Meta', 'Predictions', 'Players', 'GW Stats', 'GW Log', 'Ratings'].every(t => T[t]));
  check('Standings: the Sheet\'s nine columns (Waiver pick from the entry\'s waiver_pick, Code.gs v3.19)', T.Standings.header.join() === 'Team,Manager,W,D,L,Pts For,Pts Against,League Pts,Waiver pick' && col('Standings', 'Team', 0) === 'Alpha' && col('Standings', 'League Pts', 0) === 3 && col('Standings', 'Waiver pick', 0) === 2 && col('Standings', 'Waiver pick', 1) === 1);
  check('Matchweeks: the Sheet\'s six columns, the deadline and the waivers time kept as text (v3.19)', T.Matchweeks.header.join() === 'GW,Deadline (UTC),MOTM period,Finished,Notes,Waivers (UTC)' && col('Matchweeks', 'Deadline (UTC)', 0) === "'2026-08-21T17:30:00Z" && col('Matchweeks', 'Waivers (UTC)', 1) === "'2026-08-27T17:30:00Z");
  check('Clubs: the Sheet\'s six columns, Str H and Str A from the classic team, blank outside 1 to 5 (v3.22)', T.Clubs.header.join() === 'Short,Name,Badge code,Badge URL,Str H,Str A' && col('Clubs', 'Badge URL', 0) === 'https://resources.premierleague.com/premierleague/badges/50/t3.png' && col('Clubs', 'Str H', 0) === 4 && col('Clubs', 'Str A', 0) === 5 && col('Clubs', 'Str H', 1) === '' && col('Clubs', 'Str A', 1) === '');
  check('clubStrengthRow: the classic team first, the draft team per field, 0 or a missing figure blank', Ingest.clubStrengthRow({ strength_overall_home: 3 }, { strength_overall_home: 1, strength_overall_away: 2 }).join() === '3,2' && Ingest.clubStrengthRow(null, { strength_overall_home: 0, strength_overall_away: 6 }).join() === ',' && Ingest.clubStrengthRow(undefined, undefined).join() === ',');
  const results = T.Transactions.rows.map(r => r[T.Transactions.header.indexOf('Result')]);
  check('Transactions: the Sheet\'s eight columns, newest first, Code.gs\'s labels without an em dash, do mapped, an unknown code Denied', T.Transactions.header.join() === 'GW,Team,Manager,In,Out,Type,Result,When (UTC)' && results.join('|') === 'Accepted|Denied|Denied (priority)|Denied (drop gone)|Denied (invalid)' && col('Transactions', 'Type', 0) === 'Waiver' && !/[\u2013\u2014]/.test(JSON.stringify(T.Transactions.rows)));
  check('txResultLabel: every Code.gs code, blank for blank', ['a', 'di', 'dp', 'do', 'pd', 'r', 'o'].map(c => Ingest.txResultLabel(c)).join('|') === 'Accepted|Denied (invalid)|Denied (priority)|Denied (drop gone)|Pending|Rejected|Out-prioritised' && Ingest.txResultLabel('') === '' && Ingest.txResultLabel(null) === '' && Ingest.txResultLabel('x') === 'Denied');
  check('Players: the Sheet\'s 16 columns, the nation from the map', T.Players.header.join() === 'Code,Player,Pos,Club,Owner,Status,News,Draft rank,Season pts,Mins,Form,xGI,EP next,Proj,Nation,Full name' && col('Players', 'Nation', 0) === 'ES' && col('Players', 'Owner', 0) === 'Alpha');
  check('Rosters: the Sheet\'s 20 columns', T.Rosters.header.join() === 'Team,Manager,Player,Pos,Club,FPL rank,Proj pts,Best XI,Status,News,Drafted,Season pts,GW pts,GW mins,Code,Nation,OVR,TOTW,GW XI,Slot' && T.Rosters.rows.length === 4);
  check('Predictions: the block for the next deadline, every player', T.Predictions.gw === 2 && T.Predictions.rows.length === 4 && T.Predictions.header.join() === 'GW,Code,Player,Pos,Club,EP,Proj,Captured (UTC)');
  check('H2H Fixtures and Club Fixtures as the Sheet has them', T['H2H Fixtures'].header.join() === 'GW,Home,Home pts,Away,Away pts,Finished' && T['H2H Fixtures'].rows[0].join() === '1,Alpha,40,Beta,30,true' && T['Club Fixtures'].rows[0].slice(0, 3).join() === '1,ARS,AVL');
  check('a finished gameweek already final and logged is neither rebuilt nor relogged', (T['GW Stats'].blocks || []).length === 0 && T['GW Log'].rows === null);
  check('Fixture BPS: the fixtures listed but no BPS yet (before kick-off): an empty tab, as the Sheet has', T['Fixture BPS'].header.join() === 'GW,Fixture,Home,Away,Kickoff (UTC),Started,Finished,Code,Player,Club,BPS,Bonus' && Array.isArray(T['Fixture BPS'].rows) && T['Fixture BPS'].rows.length === 0 && T['Fixture BPS'].gw === 2);
  check('Fixture BPS: neither feed lists the gameweek: rows null, so the tab is left as it was', Ingest.fixtureBps(boot, null, 2, {}, []).rows === null && Ingest.fixtureBps(boot, null, null, {}, []).rows === null);
  /* the live feed's fixtures (draft ids, stats as s) and the classic fixtures feed (classic ids, stats as identifier) */
  const gwLive = { elements: {}, fixtures: [{ id: 2, code: 9002, event: 2, team_h: 2, team_a: 1, kickoff_time: far, started: true, finished: false, stats: [{ s: 'bps', h: [{ element: 3, value: 30 }, { element: 4, value: 25 }], a: [{ element: 2, value: 28 }] }, { s: 'bonus', h: [], a: [] }] }] };
  const cfx = [{ id: 2, code: 9002, event: 2, team_h: 2, team_a: 1, kickoff_time: far, started: true, finished: false, stats: [{ identifier: 'bps', h: [{ element: 503, value: 31 }, { element: 504, value: 25 }], a: [{ element: 502, value: 28 }, { element: 501, value: 10 }] }, { identifier: 'bonus', h: [{ element: 503, value: 3 }], a: [{ element: 502, value: 2 }] }] }];
  const T2 = Ingest.build(Object.assign({}, raw, { gwLive, classic: Object.assign({}, classic, { fixtures: cfx }) }), statics, { now: new Date(), config: {} });
  const fb = T2['Fixture BPS'];
  check('Fixture BPS: the classic feed wins when it lists more players or has the bonus; rows by BPS, the fixture\'s official bonus beside each', fb.rows.length === 4 && fb.rows[0].join() === "2,2,AVL,ARS,'" + far + ",true,false,1003,Watkins,AVL,31,3" && fb.rows[1].slice(7).join() === '1002,Saka,ARS,28,2' && fb.rows[3].slice(7).join() === '1001,Raya,ARS,10,0');
  const T3 = Ingest.build(Object.assign({}, raw, { gwLive, classic: Object.assign({}, classic, { fixtures: [] }) }), statics, { now: new Date(), config: {} });
  check('Fixture BPS: the draft feed alone, bonus 0 until FPL confirms it', T3['Fixture BPS'].rows.length === 3 && T3['Fixture BPS'].rows[0].slice(7).join() === '1003,Watkins,AVL,30,0' && T3['Fixture BPS'].rows.every(r => r[0] === 2 && r[1] === 2));
  check('Fixture BPS: a fixture of another gameweek is skipped', Ingest.fixtureBps(boot, { fixtures: [Object.assign({}, gwLive.fixtures[0], { event: 1 })] }, 2, {}, []).rows === null);
  const gwLiveWithStats = Object.assign({}, gwLive, { elements: { 3: { stats: { minutes: 90, total_points: 9 } } } });
  const T4 = Ingest.build(Object.assign({}, raw, { gwLive: gwLiveWithStats }), statics, { now: new Date(), config: {} });
  check('the live GW Stats block carries the gameweek\'s stats as before', T4['GW Stats'].blocks.length === 1 && T4['GW Stats'].blocks[0].gw === 2 && T4['GW Stats'].blocks[0].rows[0].slice(0, 3).join() === '2,1003,Watkins');

  /* nations: pulselive's season players list */
  check('pulsePlayersUrl is the list Code.gs pages', Ingest.pulsePlayersUrl('841', 3) === 'https://footballapi.pulselive.com/football/players?pageSize=100&compSeasons=841&altIds=true&type=player&id=-1&page=3');
  const pn = Ingest.pulseNations({ pageInfo: { numEntries: 1126 }, content: [{ altIds: { opta: 'p244719' }, nationalTeam: { isoCode: 'GB-ENG' } }, { altIds: { opta: 'p1' } }, { nationalTeam: { isoCode: 'FR' } }, { altIds: { opta: 'px' }, nationalTeam: { isoCode: 'FR' } }] });
  check('pulseNations: the opta id without its p is the FPL code, a player without one or the other is skipped, the total is the list\'s', pn.total === 1126 && pn.rows.length === 1 && pn.rows[0].code === 244719 && pn.rows[0].iso === 'GB-ENG');
  check('pulseNations: an empty or missing page gives nothing', Ingest.pulseNations(null).rows.length === 0 && Ingest.pulseNations({}).total === 0);

  /* Specials: the POTM rows follow potm.json, everything else is kept */
  const players = [[1002, 'Saka', 'MID'], [1003, 'Watkins', 'FWD']];
  let sp = Ingest.specialsRows([['POTM player', ''], ['POTM month', ''], ['API URL', 'https://x/exec']], { month: 'September 2026', code: '1003', player: 'O. Watkins' }, players);
  check('specialsRows: blank rows and a file: the Players tab\'s own name for the code, the month, the API URL kept', sp.rows.map(r => r.join('=')).join('|') === 'POTM player=Watkins|POTM month=September 2026|API URL=https://x/exec' && sp.wrote.player === 'Watkins');
  sp = Ingest.specialsRows([['POTM player', 'Someone'], ['POTM month', 'September 2026']], { month: 'September 2026', code: '1003', player: 'Watkins' }, players);
  check('specialsRows: a hand edit for the same month is kept', sp.wrote === null && sp.rows[0][1] === 'Someone');
  sp = Ingest.specialsRows([['POTM player', 'Someone'], ['POTM month', 'September']], { month: 'September 2026', code: '1003', player: 'Watkins' }, players);
  check('specialsRows: the month name alone counts as the same month', sp.wrote === null);
  sp = Ingest.specialsRows([['POTM player', 'Someone'], ['POTM month', 'August 2026']], { month: 'September 2026', code: '1003', player: 'Watkins' }, players);
  check('specialsRows: a new month replaces both rows', sp.wrote !== null && sp.rows[0][1] === 'Watkins' && sp.rows[1][1] === 'September 2026');
  sp = Ingest.specialsRows([['API URL', 'u']], null, players);
  check('specialsRows: no file: the two POTM rows are appended blank and nothing is written', sp.wrote === null && sp.rows.map(r => r[0]).join() === 'API URL,POTM month,POTM player' && sp.rows[1][1] === '');
  sp = Ingest.specialsRows([], { month: 'September 2026', code: '9', player: 'Nobody' }, players);
  check('specialsRows: a code not in the Players tab falls back to the file\'s player', sp.rows.find(r => r[0] === 'POTM player')[1] === 'Nobody');
  sp = Ingest.specialsRows([], { month: 'September 2026', code: '', player: '' }, players);
  check('specialsRows: no name at all: nothing written', sp.wrote === null && sp.rows.find(r => r[0] === 'POTM player')[1] === '');
  check('potmFile: the file\'s shape as Code.gs checks it', JSON.stringify(Ingest.potmFile({ month: ' September  2026 ', code: 1003.0, player: 'Watkins', club: 'AVL' })) === JSON.stringify({ month: 'September 2026', code: '1003', player: 'Watkins' }) && Ingest.potmFile(null) === null && Ingest.potmFile([]) === null && Ingest.potmFile({ month: '' }) === null && Ingest.potmFile({ month: 'X' }) === null && Ingest.potmFile({ month: 'X', player: 'P' }).code === '');
  const idx = read('supabase/functions/ingest/index.ts');
  check('the ingest writes Fixture BPS as a global block, syncs Specials per league and reads potm.json from the release branch', /writeBlock\(null, 'Fixture BPS', 'all'/.test(idx) && /syncSpecials\(league\.id/.test(idx) && idx.includes("raw.githubusercontent.com/parkerno2/el-matador-tire/release/fplgg/tools/matchweek/data/potm.json") && /Ingest\.pulsePlayersUrl\(season, page\)/.test(idx));

  const plan = Ingest.fetchPlan(45380, boot, details, statics);
  check('the fetch plan asks for the choices, the element status, the transactions, every gameweek\'s fixtures and the live feed', plan.curEv === 2 && plan.plan.some(p => p.key === 'choices') && plan.plan.some(p => p.key === 'estat') && plan.plan.some(p => p.key === 'transactions') && plan.plan.filter(p => p.key === 'fixtures').length === 2 && plan.plan.some(p => p.key === 'gwLive'));

  console.log(fails ? fails + ' FAILED' : 'ALL PASS');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
