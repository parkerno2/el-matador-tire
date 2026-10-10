// v3.17 tests: ?health=1 data (the last refresh that finished, the last attempt, the live window and since when), for
// the cloud monitor.   cd /home/claude/emt && node tests/codegs/v317.js
const fs = require('fs');
const T = require(__dirname + '/harness.js').make();
const { ctx, sheets, props, check, get, iso, H } = T;
const src = T.src;

console.log('--- V the release');
check('V1 EMT_VERSION is v3.17 or later and the CHANGELOG has the v3.17 entry', ctx.emtSelfVersion(src) === ctx.EMT_VERSION && ctx.emtSelfCmp(ctx.EMT_VERSION, 'v3.17') >= 0 && /\* v3\.17 · 8 Oct 2026\n \*   \?health=1 adds data, for the cloud monitor/.test(src));

console.log('--- D data in health');
/* the fixture tab carries GW6's real kick-off times, so without this the D checks read a live window whenever a real
   GW6 game is on (10 Oct 2026, 15:19 UTC: AVL-BRE live, the gate red on every push; BUGS.md #34). Every GW6 game is
   moved two days away here, before any check; the L checks below set the kick-offs they need themselves. */
{ const cf0 = sheets['Club Fixtures'], k0 = cf0.rows[0].indexOf('Kickoff (UTC)'), g0 = cf0.rows[0].indexOf('GW'); cf0.rows.slice(1).forEach(x => { if (Number(x[g0]) === 6) x[k0] = iso(Date.now() + 2 * 24 * H); }); }
let h = get({ health: '1' });
check('D1 before any refresh: updated null, source empty, ageMin null, attempted null, not live', JSON.stringify(h.data) === JSON.stringify({ updated: null, source: '', ageMin: null, attempted: null, live: false, liveWhy: '', liveSince: null }), JSON.stringify(h.data));
let ran = 0; ctx.refreshCore = () => { ran++; };
let r = ctx.emtGuardedRefresh('refreshAll', 5000);
h = get({ health: '1' });
const t1 = Date.parse(h.data.updated);
check('D2 a refresh that finished: updated now, source refreshAll, ageMin 0, attempted now', r.ok && r.ran && ran === 1 && Math.abs(t1 - Date.now()) < 5000 && h.data.source === 'refreshAll' && h.data.ageMin === 0 && Math.abs(Date.parse(h.data.attempted) - Date.now()) < 5000, JSON.stringify(h.data));
r = ctx.emtGuardedRefresh('liveTick', 5000); h = get({ health: '1' });
check('D3 a second refresh within 90 seconds is skipped and changes nothing', r.ok && !r.ran && r.ageSec >= 0 && Date.parse(h.data.updated) === t1 && ran === 1);
props.EMT_LAST_REFRESH = String(Date.now() - 10 * 60e3);
ctx.refreshCore = () => { throw new Error('FPL answered 503'); };
r = ctx.emtGuardedRefresh('liveTick', 5000); h = get({ health: '1' });
check('D4 a refresh that fails: ok false, updated unchanged, attempted moves to this attempt', r.ok === false && /503/.test(r.error) && Date.parse(h.data.updated) === t1 && Math.abs(Date.parse(h.data.attempted) - Date.now()) < 5000 && h.data.source === 'refreshAll', JSON.stringify(h.data));
props.EMT_DATA_UPDATED = JSON.stringify({ at: Date.now() - 150 * 60e3, source: 'app', ms: 1200 });
h = get({ health: '1' });
check('D5 ageMin counts the minutes since updated (150), source as recorded (app)', h.data.ageMin === 150 && h.data.source === 'app');
props.EMT_DATA_UPDATED = 'junk'; h = get({ health: '1' });
check('D6 a broken EMT_DATA_UPDATED: updated null, nothing thrown', h.ok && h.data.updated === null && h.data.ageMin === null);

console.log('--- L the live window');
const cf = sheets['Club Fixtures'], ki = cf.rows[0].indexOf('Kickoff (UTC)'), gi = cf.rows[0].indexOf('GW'), hi = cf.rows[0].indexOf('Home'), ai = cf.rows[0].indexOf('Away');
const setKo = (gw, home, away, ms) => { const row = cf.rows.slice(1).find(x => Number(x[gi]) === gw && x[hi] === home && x[ai] === away); row[ki] = iso(ms); return row; };
const g6 = cf.rows.slice(1).filter(x => Number(x[gi]) === 6);
check('L0 the fixture tab has GW6 games to play with', g6.length >= 2, String(g6.length));
cf.rows.slice(1).forEach(x => { if (Number(x[gi]) === 6) x[ki] = iso(Date.now() + 2 * 24 * H); });   // every GW6 game two days away
h = get({ health: '1' });
check('L1 no game near: live false, liveWhy empty, liveSince null', h.data.live === false && h.data.liveWhy === '' && h.data.liveSince === null, JSON.stringify(h.data));
const ko = Date.now() - 10 * 60e3; setKo(6, g6[0][hi], g6[0][ai], ko);
h = get({ health: '1' });
check('L2 a game that kicked off 10 minutes ago: live true, liveWhy names it, liveSince = kick-off minus 5 minutes', h.data.live === true && h.data.liveWhy.indexOf(g6[0][hi] + '-' + g6[0][ai]) === 0 && Date.parse(h.data.liveSince) === ko - 5 * 60e3, JSON.stringify(h.data));
check('L2 liveWindowReason still answers the same reason (liveTick is unchanged)', ctx.liveWindowReason(Date.now()) === h.data.liveWhy);
setKo(6, g6[0][hi], g6[0][ai], Date.now() - 4 * H);
h = get({ health: '1' });
check('L3 a game that ended 4 hours ago (last of its day, 3-hour tail): not live', h.data.live === false && h.data.liveSince === null, JSON.stringify(h.data));
setKo(6, g6[0][hi], g6[0][ai], Date.now() + 3 * 60e3);
h = get({ health: '1' });
check('L4 a game 3 minutes from kick-off: live (the window opens 5 minutes before), liveSince in the past', h.data.live === true && Date.parse(h.data.liveSince) < Date.now());
delete sheets['Club Fixtures']; h = get({ health: '1' });
check('L5 no Club Fixtures tab: not live, nothing thrown', h.ok && h.data.live === false);

T.done();
