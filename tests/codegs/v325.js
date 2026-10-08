// v3.25 tests: ElevenLabs credits are never burned again (Parker's request, 8 Oct 2026; BUGS #30). The balance is read
// before a render voices anything and the render is skipped when the lines would not fit; a key without user_read falls
// back to the count kept in Script Properties; a gameweek has a character cap (the script plus a quarter, EMT_SHOW_GW_CAP_<gw>
// raises it); after a refusal showTick holds until the reset and reads the balance once an hour; ?health=1 carries it all;
// ai.last says what the feed writer's last run saw.   node tests/codegs/v325.js
const T = require(__dirname + '/harness.js').make();
const { ctx, check, src, sheets, props, cache, logs } = T;
const H = 3600e3, iso = ms => new Date(ms).toISOString();
const MODEL = 'eleven_v4_turbo';

/* the ElevenLabs mock: the balance (SUB), then text to speech as v324 mocks it; SEQ records the order of the calls */
let SHOW = {}, MODE = 'ok', SUB = { code: 200, count: 1000, limit: 10000, reset: Math.floor(Date.now() / 1000) + 20 * 86400 }, SUB_THROW = false, tts = [], subs = [], SEQ = [];
const b64of = t => Buffer.from('mp3:' + t).toString('base64');
const alignOf = t => { const chars = t.split(''); return { characters: chars, character_start_times_seconds: chars.map((_, i) => i * 0.05), character_end_times_seconds: chars.map((_, i) => (i + 1) * 0.05) }; };
const realFetch = ctx.UrlFetchApp.fetch;
ctx.UrlFetchApp.fetch = (url, o) => {
  o = o || {};
  if (/github\.io/.test(url)) { const gw = Number((url.match(/show\/gw(\d+)\.json/) || [])[1]); return SHOW[gw] ? T.resp(200, SHOW[gw]) : T.resp(404, '<h1>404</h1>'); }
  if (/^https:\/\/api\.elevenlabs\.io\/v1\/user\/subscription$/.test(url)) {
    subs.push({ url, o }); SEQ.push('sub');
    if (SUB_THROW) throw new Error('Address unavailable: api.elevenlabs.io');
    if (SUB.code === 401) return T.resp(401, { detail: { status: 'missing_permissions', message: 'The API key you used is missing the permission user_read to execute this operation.' } });
    if (SUB.code !== 200) return T.resp(SUB.code, 'Service Unavailable');
    if (SUB.nonumbers) return T.resp(200, { tier: 'free', status: 'active' });
    return T.resp(200, { tier: 'free', character_count: SUB.count, character_limit: SUB.limit, next_character_count_reset_unix: SUB.reset, status: 'active' });
  }
  if (/api\.elevenlabs\.io/.test(url)) {
    const body = JSON.parse(o.payload); tts.push({ url, o, body }); SEQ.push('tts');
    if (MODE === 'quota') return T.resp(401, { detail: { status: 'quota_exceeded', message: 'This request exceeds your quota of 10000. You have 12 credits remaining.' } });
    if (MODE === '402') return T.resp(402, { detail: 'Payment required' });
    if (MODE === 'badkey') return T.resp(401, { detail: { status: 'invalid_api_key', message: 'Invalid API key' } });
    return T.resp(200, { audio_base64: b64of(body.text), alignment: alignOf(body.text), normalized_alignment: null });
  }
  return realFetch(url, o);
};
const reset = () => { tts.length = 0; subs.length = 0; SEQ.length = 0; logs.length = 0; };
const script = () => ({ gw: 6, voice: 'Malcolm Tyre', model: MODEL, speed: 1.1,
  open: 'Gameweek six. Two derbies and a leader under investigation.',
  chapters: [
    { home: 'Cold Palmers', away: 'Devils U21s', beats: ['Cold Palmers. Fifth, on nine points.', 'Palmer carries a knock.', 'Devils U21s. Five defeats from five.', 'Bruno is the hope.', 'Parker leads the series.'] },
    { home: 'Kobbie Mainoo Fan', away: 'Trophy Hunters', beats: ['Top of the table.', 'Hall scored thirteen.', 'Trophy Hunters. Three straight wins.', 'Semenyo carries a knock.', 'Baha leads five to two.'] },
  ],
  close: 'That is the gameweek. Malcolm Tyre, El Matador booth.' });
const charsOf = j => ctx.emtShowClips(j).reduce((n, c) => n + c.text.length, 0);
const get = p => JSON.parse(ctx.doGet({ parameter: p }).t);
const monthKey = 'EMT_SHOW_CHARS_' + new Date().toISOString().slice(0, 7);
const hold = () => (props.EMT_SHOW_HOLD ? JSON.parse(props.EMT_SHOW_HOLD) : null);
const credits = () => (props.EMT_SHOW_CREDITS ? JSON.parse(props.EMT_SHOW_CREDITS) : null);
const newScript = () => { delete cache.EMT_SHOW_REPO_6; };

console.log('--- V the release');
check('V1 EMT_VERSION is v3.25 or later and the CHANGELOG has the entry', ctx.emtSelfVersion(src) === ctx.EMT_VERSION && ctx.emtSelfCmp(ctx.EMT_VERSION, 'v3.25') >= 0 && /\* v3\.25 · 8 Oct 2026\n \*   ElevenLabs credits are never burned again/.test(src));
check('V2 the constants: the subscription endpoint, 10,000 a month by default, the script plus a quarter, 24 hours when the reset is unknown, an hourly read while holding, a 6-hour refresh for health',
  ctx.EMT_SHOW_SUB_URL === 'https://api.elevenlabs.io/v1/user/subscription' && ctx.EMT_SHOW_MONTHLY_DEFAULT === 10000 && ctx.EMT_SHOW_GW_CAP_RATIO === 1.25 && ctx.EMT_SHOW_HOLD_MS === 24 * H && ctx.EMT_SHOW_HOLD_CHECK_MS === H && ctx.EMT_SHOW_CREDITS_FRESH_MS === 6 * H);

console.log('--- A the balance');
props.ELEVENLABS_API_KEY = 'el-test'; reset();
let cr = ctx.emtShowCreditsRead('el-test');
check('A1 ElevenLabs answers: left = limit - used, the reset as ISO, from elevenlabs, kept in EMT_SHOW_CREDITS; a GET with the key in xi-api-key', cr.left === 9000 && cr.limit === 10000 && cr.resets === iso(SUB.reset * 1000) && cr.from === 'elevenlabs' && /^\d{4}-/.test(cr.at) &&
  JSON.stringify(credits()) === JSON.stringify(cr) && subs.length === 1 && String(subs[0].o.method).toLowerCase() === 'get' && subs[0].o.headers['xi-api-key'] === 'el-test' && subs[0].o.muteHttpExceptions === true, JSON.stringify(cr));
SUB.code = 401; reset(); cr = ctx.emtShowCreditsRead('el-test');
const monthEnd = iso(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 1));
check('A2 a key without user_read (401 missing_permissions): the count kept here against the default 10,000, resetting on the first of next month, from count, the note says why', cr.from === 'count' && cr.left === 10000 && cr.limit === 10000 && cr.resets === monthEnd && /HTTP 401 missing_permissions/.test(cr.note), JSON.stringify(cr));
props.EMT_SHOW_MONTHLY_LIMIT = '5000'; props[monthKey] = '1200'; cr = ctx.emtShowCreditsRead('el-test');
check('A3 EMT_SHOW_MONTHLY_LIMIT and the month\'s count are honoured', cr.left === 3800 && cr.limit === 5000 && cr.from === 'count', JSON.stringify(cr));
delete props.EMT_SHOW_MONTHLY_LIMIT; delete props[monthKey];
SUB.code = 200; SUB_THROW = true; let threw = null; try { cr = ctx.emtShowCreditsRead('el-test'); } catch (e) { threw = e; }
check('A4 the fetch throwing: never thrown, the count is used, the note carries the message', threw === null && cr.from === 'count' && /Address unavailable/.test(cr.note), threw ? String(threw) : JSON.stringify(cr));
SUB_THROW = false; SUB.nonumbers = true; cr = ctx.emtShowCreditsRead('el-test');
check('A5 a 200 without the numbers: the count is used', cr.from === 'count' && /no character_limit/.test(cr.note));
SUB.nonumbers = false; SUB.code = 503; cr = ctx.emtShowCreditsRead('el-test');
check('A6 a 503: the count is used, note HTTP 503', cr.from === 'count' && cr.note === 'HTTP 503');
SUB.code = 200;

console.log('--- B the first render fits');
SHOW[6] = script(); const CHARS = charsOf(SHOW[6]); reset(); delete props.EMT_SHOW_CREDITS;
let r = ctx.renderShow(6);
check('B1 the balance is read once, before the first ElevenLabs call, and every line is voiced', r.ok && r.rendered.length === 12 && subs.length === 1 && tts.length === 12 && SEQ[0] === 'sub' && SEQ.filter(x => x === 'sub').length === 1, SEQ.join(','));
check('B2 the characters voiced are counted for the gameweek and for the month; the render carries need and the balance', Number(props.EMT_SHOW_GW_CHARS_6) === CHARS && Number(props[monthKey]) === CHARS && r.need === CHARS && r.credits === 9000 && r.cap && r.cap.used === 0 && r.cap.cap === Math.ceil(CHARS * 1.25), JSON.stringify([props.EMT_SHOW_GW_CHARS_6, props[monthKey], r.need, r.cap]));
let h = get({ health: '1' });
check('B3 ?health=1 show: credits { left, limit, resets, at, from }, need 0, cap { used, cap }, capped false, hold null, render.need', h.show.credits && h.show.credits.left === 9000 && h.show.credits.limit === 10000 && h.show.credits.from === 'elevenlabs' && h.show.credits.resets === iso(SUB.reset * 1000) &&
  h.show.need === 0 && h.show.cap && h.show.cap.used === CHARS && h.show.cap.cap === Math.ceil(CHARS * 1.25) && h.show.capped === false && h.show.hold === null && h.show.render.need === CHARS && h.show.render.hold === null, JSON.stringify(h.show));
reset(); r = ctx.renderShow(6);
check('B4 nothing to voice: no balance read, no ElevenLabs call, 12 kept', r.ok && r.kept === 12 && subs.length === 0 && tts.length === 0 && r.need === 0);

console.log('--- C the gameweek cap');
SHOW[6].speed = 1; newScript(); reset();
r = ctx.renderShow(6); h = get({ health: '1' });
check('C1 every line rewritten (a new speed) after a full render: over the cap, so nothing is called, not even the balance; the error names the Script Property', r.ok === false && r.stopped === 'capped' && subs.length === 0 && tts.length === 0 && r.kept === 0 && r.left === 12 && r.need === CHARS &&
  new RegExp('voiced ' + CHARS + ' of its ' + Math.ceil(CHARS * 1.25) + '-character cap').test(r.error) && /EMT_SHOW_GW_CAP_6/.test(r.error) && logs.some(l => /Stopped: GW6 has voiced/.test(l)), r.error);
check('C2 health says capped, with the numbers; the last render carries it', h.show.capped === true && h.show.need === CHARS && h.show.cap.used === CHARS && h.show.render.stopped === 'capped' && /EMT_SHOW_GW_CAP_6/.test(h.show.render.error), JSON.stringify(h.show.cap));
SHOW[6].speed = 1.1; SHOW[6].chapters[0].beats[1] = 'Palmer carries a knock, again.'; newScript(); reset();
r = ctx.renderShow(6);
check('C3 one line edited instead: it fits in the quarter and is voiced; the count grows', r.ok && r.rendered.join() === 'c1b1' && tts.length === 1 && subs.length === 1 && Number(props.EMT_SHOW_GW_CHARS_6) === CHARS + 'Palmer carries a knock, again.'.length, r.error || r.rendered.join());
props.EMT_SHOW_GW_CAP_6 = String(CHARS * 10); SHOW[6].speed = 1; newScript(); reset();
r = ctx.renderShow(6); h = get({ health: '1' });
check('C4 EMT_SHOW_GW_CAP_6 raised: the whole rewrite is voiced, health shows the raised cap', r.ok && r.rendered.length === 12 && tts.length === 12 && h.show.cap.cap === CHARS * 10 && h.show.capped === false, JSON.stringify(h.show.cap));

console.log('--- D a balance that does not fit');
SUB.count = 9990; SHOW[6].open = 'Gameweek six. Take two, a longer line than ten characters.'; newScript(); reset();
r = ctx.renderShow(6); h = get({ health: '1' });
const need1 = SHOW[6].open.length;
check('D1 10 characters left, a line that needs more: skipped before any call, the error says the numbers, the hold is set until the reset', r.ok === false && r.stopped === 'credits' && tts.length === 0 && subs.length === 1 && r.kept === 11 && r.left === 1 && r.need === need1 &&
  new RegExp('ElevenLabs has 10 of 10000 characters left this month, resets ' + iso(SUB.reset * 1000).replace(/\./g, '\\.') + ', and the 1 line still to voice need ' + need1).test(r.error) && hold() && hold().until === iso(SUB.reset * 1000) && hold().why === 'credits' && r.hold === hold().until, r.error);
check('D2 health: hold { until, why, since }, render.stopped credits with hold, credits.left 10', h.show.hold && h.show.hold.until === iso(SUB.reset * 1000) && h.show.hold.why === 'credits' && /^\d{4}-/.test(h.show.hold.since) && h.show.render.stopped === 'credits' && h.show.render.hold === h.show.hold.until && h.show.credits.left === 10, JSON.stringify(h.show.hold));
reset(); let st = ctx.showTick(Date.now());
check('D3 showTick while holding, checked just now: nothing called at all, stopped hold, logged', st.stopped === 'hold' && st.until === hold().until && subs.length === 0 && tts.length === 0 && logs.some(l => /no ElevenLabs render until/.test(l) && /read again once an hour/.test(l)), logs.join(' | '));
let hh = hold(); hh.checked = iso(Date.now() - 2 * H); props.EMT_SHOW_HOLD = JSON.stringify(hh); reset(); st = ctx.showTick(Date.now());
check('D4 an hour later: the balance is read once (still 10), no render, the hold stays with checked moved on', st.stopped === 'hold' && subs.length === 1 && tts.length === 0 && st.credits === 10 && st.need === need1 && hold() && Date.now() - Date.parse(hold().checked) < 5000, JSON.stringify(st));
SUB.count = 0; hh = hold(); hh.checked = iso(Date.now() - 2 * H); props.EMT_SHOW_HOLD = JSON.stringify(hh); reset(); st = ctx.showTick(Date.now());
check('D5 a top-up: the hourly read sees 10,000, lifts the hold and the line is voiced in the same tick', st.ok && st.rendered && st.rendered.join() === 'open' && hold() === null && logs.some(l => /the hold is lifted/.test(l)) && subs.length === 2 && tts.length === 1, JSON.stringify(st));
/* the count fallback: the key cannot read the balance, the month's count says nothing is left */
SUB.code = 401; props[monthKey] = '9995'; SHOW[6].open = 'Gameweek six. Take three.'; newScript(); reset();
r = ctx.renderShow(6);
check('D6 under the count: skipped with "(counted here", the hold is 24 hours, not the month end', r.stopped === 'credits' && /counted here/.test(r.error) && hold() && Math.abs(Date.parse(hold().until) - Date.now() - 24 * H) < 5000 && tts.length === 0, r.error);
delete props[monthKey]; SUB.code = 200; SUB.count = 1000; delete props.EMT_SHOW_HOLD; reset(); ctx.renderShow(6);

console.log('--- E a refusal in the middle of a render');
MODE = 'quota'; SHOW[6].close = 'The close, take two.'; newScript(); reset();
r = ctx.renderShow(6);
check('E1 ElevenLabs 401 quota_exceeded although the balance read said 9,000: the run stops, the hold is set until the reset ElevenLabs reported', r.stopped === 'http 401' && /out of credits/.test(r.error) && tts.length === 1 && hold() && hold().until === iso(SUB.reset * 1000) && r.hold === hold().until && /No ElevenLabs render until/.test(ctx.emtShowSummary(r)), ctx.emtShowSummary(r));
reset(); st = ctx.showTick(Date.now());
check('E2 the next showTick makes no call', st.stopped === 'hold' && tts.length === 0 && subs.length === 0);
reset(); const rn = ctx.renderShowNow();
check('E3 Render now in the menu lifts the hold and tries (refused again, so the hold is back), logged', logs.some(l => /lifted by the menu/.test(l)) && tts.length === 1 && rn.stopped === 'http 401' && hold() !== null, logs.join(' | '));
MODE = '402'; delete props.EMT_SHOW_HOLD; reset(); r = ctx.renderShow(6);
check('E4 a 402 holds too', r.stopped === 'http 402' && hold() !== null);
MODE = 'badkey'; delete props.EMT_SHOW_HOLD; reset(); r = ctx.renderShow(6);
check('E5 a wrong key (401 invalid_api_key) is not a credit refusal: no hold', r.stopped === 'http 401' && /wrong or lacks/.test(r.error) && hold() === null, r.error);
MODE = 'ok'; props.EMT_SHOW_HOLD = JSON.stringify({ until: iso(Date.now() - 60e3), why: 'credits', since: iso(Date.now() - 25 * H), checked: iso(Date.now() - 2 * H) }); reset(); st = ctx.showTick(Date.now());
check('E6 a hold that has run out is cleared and the tick renders', st.ok && st.rendered.join() === 'close' && hold() === null && tts.length === 1, JSON.stringify(st));
h = get({ health: '1' });
check('E7 health after it: hold null, 12 of 12', h.show.hold === null && h.show.clips === 12 && h.show.need === 0);

console.log('--- F the balance for health');
let c0 = credits(); c0.at = iso(Date.now() - 7 * H); props.EMT_SHOW_CREDITS = JSON.stringify(c0); reset(); st = ctx.showTick(Date.now());
check('F1 nothing to voice and the last read 7 hours old: showTick reads the balance once, no render', subs.length === 1 && tts.length === 0 && st.kept === 12 && Date.now() - Date.parse(credits().at) < 5000);
reset(); st = ctx.showTick(Date.now());
check('F2 read an hour ago: not read again', subs.length === 0 && tts.length === 0);
delete props.ELEVENLABS_API_KEY; reset(); st = ctx.showTick(Date.now());
check('F3 no key: nothing read', st.stopped === 'nokey' && subs.length === 0);
props.ELEVENLABS_API_KEY = 'el-test';

console.log('--- G the feed writer\'s last run in health');
props.ANTHROPIC_API_KEY = 'sk-test'; reset();
ctx.aiWriterTick(); h = get({ health: '1' });
check('G1 a build-up event due (GW6 in 20 hours) and the writer\'s call failing: ai.last says 1 event, kind build, 0 made, the error', h.ai.last && h.ai.last.events === 1 && h.ai.last.kinds === 'build' && h.ai.last.made === 0 && /no Claude reply queued/.test(h.ai.last.error) && /^\d{4}-/.test(h.ai.last.at) && h.ai.count === 0, JSON.stringify(h.ai));
const A = JSON.parse(props.EMT_AI_STATE); A.buildGw = 6; props.EMT_AI_STATE = JSON.stringify(A); ctx.aiWriterTick(); h = get({ health: '1' });
check('G2 a quiet run: 0 events, 0 made, no error (a quiet day reads differently from a broken writer)', h.ai.last.events === 0 && h.ai.last.made === 0 && h.ai.last.error === '' && h.ai.last.kinds === '', JSON.stringify(h.ai.last));
delete props.ANTHROPIC_API_KEY; props.EMT_AI_STATE = JSON.stringify({ day: '2026-10-08', count: 0 }); h = get({ health: '1' });
check('G3 no last run recorded: ai.last null', h.ai.last === null);
check('G4 health carries no key', !/el-test|sk-test/.test(JSON.stringify(h)));

T.done();
