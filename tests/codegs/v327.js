// v3.27 tests: the Gameweek Show's voicing cap counts per script version (Parker, 9 Oct 2026: a hand-written
// show/gw<N>.json that replaces a script already voiced gets its own allowance, its length plus a quarter; at most 3
// versions a gameweek get one of their own, later rewrites share the last; the balance read, the hold, the monthly
// count and EMT_SHOW_GW_CAP_<gw> are unchanged; nothing loops).   node tests/codegs/v327.js
const T = require(__dirname + '/harness.js').make();
const { ctx, check, src, props, logs } = T;
const crypto = require('crypto');
const md5 = s => crypto.createHash('md5').update(s, 'utf8').digest('hex');
const H = 3600e3, iso = ms => new Date(ms).toISOString();

/* the ElevenLabs mock, as v325: the balance (SUB) then text to speech; SEQ records the order of the calls */
let SHOW = {}, MODE = 'ok', SUB = { count: 1000, limit: 100000, reset: Math.floor(Date.now() / 1000) + 20 * 86400 }, tts = [], subs = [], SEQ = [];
const b64of = t => Buffer.from('mp3:' + t).toString('base64');
const alignOf = t => { const chars = t.split(''); return { characters: chars, character_start_times_seconds: chars.map((_, i) => i * 0.05), character_end_times_seconds: chars.map((_, i) => (i + 1) * 0.05) }; };
const realFetch = ctx.UrlFetchApp.fetch;
ctx.UrlFetchApp.fetch = (url, o) => {
  o = o || {};
  if (/github\.io/.test(url)) { const gw = Number((url.match(/show\/gw(\d+)\.json/) || [])[1]); return SHOW[gw] ? T.resp(200, SHOW[gw]) : T.resp(404, '<h1>404</h1>'); }
  if (/^https:\/\/api\.elevenlabs\.io\/v1\/user\/subscription$/.test(url)) { subs.push(url); SEQ.push('sub'); return T.resp(200, { tier: 'creator', character_count: SUB.count, character_limit: SUB.limit, next_character_count_reset_unix: SUB.reset, status: 'active' }); }
  if (/api\.elevenlabs\.io/.test(url)) {
    const body = JSON.parse(o.payload); tts.push({ url, o, body }); SEQ.push('tts');
    if (MODE === 'quota') return T.resp(401, { detail: { status: 'quota_exceeded', message: 'This request exceeds your quota of 10000. You have 12 credits remaining.' } });
    return T.resp(200, { audio_base64: b64of(body.text), alignment: alignOf(body.text), normalized_alignment: null });
  }
  return realFetch(url, o);
};
const reset = () => { tts.length = 0; subs.length = 0; SEQ.length = 0; logs.length = 0; };
const newScript = gw => { delete T.cache['EMT_SHOW_REPO_' + (gw || 6)]; };
/* script A: the 8 Oct GW6 kind of script; script B: a full rewrite, every line new and shorter */
const scriptA = () => ({ gw: 6, voice: 'Malcolm Tyre', model: 'eleven_v4_turbo', speed: 1.1,
  open: 'Gameweek six. Two derbies, a leader unbeaten in four, and a man on zero points who still leads his derby. Here is how it lines up.',
  chapters: [
    { home: 'Cold Palmers', away: 'Devils U21s', beats: ['Cold Palmers. Fifth on nine points, and on the record: the thirty dollars for October has Parker\'s name on it.', 'Palmer, Mainoo, Rice and Jacquet all carry flags, four doubts in one eleven. Bad week to have named the club after one of them.', 'Devils U21s. Five games, five defeats, zero points, and PJ still leads this derby four to three.', 'Gibbs-White tops the eleven. Not a single flag among PJ\'s starters. Fully fit. [deadpan] Just shite.', 'Parker is the favourite, but only narrowly, against a side with nothing on the board.'] },
    { home: 'Kobbie Mainoo Fan', away: 'Trophy Hunters', beats: ['Kobbie Mainoo Fan. Top of the table, unbeaten in four, and the finances still under investigation.', 'Hall scored thirteen last week, a goal and all three bonus. Isak scored as well and now carries a thigh flag.', 'Trophy Hunters. Third, on three straight wins, the only winning run in the league.', 'Semenyo and Brobbey hit seventeen each last week, Tarkowski fourteen. The purple patch has a hamstring.', 'Baha leads the series five to two and the model backs him again.'] },
  ],
  close: 'That is the gameweek. Lineups in before Saturday\'s deadline, and get yourself on the record. Monday needs names.' });
const scriptB = () => ({ gw: 6, voice: 'Malcolm Tyre', model: 'eleven_v4_turbo', speed: 1.1,
  open: 'Gameweek six. The leaders are under investigation, the bottom side has yet to win, and Jacob\'s best striker is on the bench. Again.',
  chapters: [
    { home: 'Cold Palmers', away: 'Devils U21s', beats: ['Cold Palmers. Parker built this app. It has been very honest with him.', 'Palmer, Rice, Mainoo and Jacquet all doubts. Less a team sheet, more a waiting room.', 'Devils U21s. Still no points. The youth project is taking its time.', 'Not a flag among PJ\'s starters. Fully fit. Just shite.', 'Brother against brother. PJ hasn\'t won all season, and leads the Nolan derby four to three.'] },
    { home: 'Kobbie Mainoo Fan', away: 'Trophy Hunters', beats: ['Kobbie Mainoo Fan. Top of the league, pending an independent commission.', 'Named after Kobbie Mainoo, who plays for Parker. Nobody\'s had the heart to tell Baha.', 'Trophy Hunters. Bryant has stopped experimenting and started winning. It\'s ugly. It works.', 'Five at the back and one up front. Somewhere, Tony Pulis is welling up.', 'The Sacred Heart derby. Bryant brings the bus. Baha brings his lawyers.'] },
  ],
  close: 'That\'s your lot. Lineups in by Saturday morning. And Jacob, the lads on the bench are allowed to play.' });
const charsOf = j => ctx.emtShowClips(j).reduce((n, c) => n + c.text.length, 0);
const idOf = j => md5(ctx.emtShowClips(j).map(c => c.text).join('\n')).slice(0, 12);
const get = p => JSON.parse(ctx.doGet({ parameter: p }).t);
const ver = gw => JSON.parse(props['EMT_SHOW_GW_VER_' + (gw || 6)] || 'null');
const monthKey = 'EMT_SHOW_CHARS_' + new Date().toISOString().slice(0, 7);
const cap = n => Math.ceil(n * 1.25);

console.log('--- V the release');
check('V1 EMT_VERSION is v3.27 or later and the CHANGELOG has the entry', ctx.emtSelfVersion(src) === ctx.EMT_VERSION && ctx.emtSelfCmp(ctx.EMT_VERSION, 'v3.27') >= 0 && /\* v3\.27 · 9 Oct 2026\n \*   The Gameweek Show's voicing cap counts per script version/.test(src));
check('V2 three versions a gameweek, the ratio and the hold constants untouched', ctx.EMT_SHOW_GW_VERSIONS === 3 && ctx.EMT_SHOW_GW_CAP_RATIO === 1.25 && ctx.EMT_SHOW_HOLD_MS === 24 * H && ctx.EMT_SHOW_HOLD_CHECK_MS === H && ctx.EMT_SHOW_MONTHLY_DEFAULT === 10000);
check('V3 a script version is the md5 of its lines\' texts, 12 hex characters; the voice, model and speed are not part of it', ctx.emtShowVersionId(ctx.emtShowClips(scriptA())) === idOf(scriptA()) && (() => { const a = scriptA(); a.speed = 1; a.model = 'eleven_multilingual_v2'; a.voice = 'other'; return ctx.emtShowVersionId(ctx.emtShowClips(a)) === idOf(scriptA()); })() && idOf(scriptA()) !== idOf(scriptB()));

console.log('--- A the first script, then a hand-written rewrite');
props.ELEVENLABS_API_KEY = 'el-test'; SHOW[6] = scriptA(); const A = charsOf(SHOW[6]), B = charsOf(scriptB()); reset();
let r = ctx.renderShow(6), h = get({ health: '1' });
check('A1 the first render voices script A, registers it as version 1 and counts its characters against it; the gameweek and month totals as before; the balance read once, first', r.ok && r.rendered.length === 12 && SEQ[0] === 'sub' && subs.length === 1 && tts.length === 12 &&
  ver() && ver().list.join() === idOf(scriptA()) && ver().used[idOf(scriptA())] === A && Number(props.EMT_SHOW_GW_CHARS_6) === A && Number(props[monthKey]) === A &&
  r.cap && r.cap.used === 0 && r.cap.cap === cap(A) && r.cap.version === idOf(scriptA()) && r.cap.versions === 1 && r.cap.own === true, JSON.stringify([ver(), r.cap]));
check('A2 health: cap { used A, cap, version, versions 1, own }, capped false, need 0', h.show.cap && h.show.cap.used === A && h.show.cap.cap === cap(A) && h.show.cap.version === idOf(scriptA()) && h.show.cap.versions === 1 && h.show.cap.own === true && h.show.capped === false && h.show.need === 0, JSON.stringify(h.show.cap));
SHOW[6] = scriptB(); newScript(); reset(); h = get({ health: '1' });
check('A3 the rewrite lands (every line new) and nothing has rendered yet: health says the new version would be version 2 of 3 with 0 used of its own allowance, not capped; health registers nothing', h.show.cap.used === 0 && h.show.cap.cap === cap(B) && h.show.cap.version === idOf(scriptB()) && h.show.cap.versions === 2 && h.show.cap.own === true && h.show.capped === false && h.show.need === B && ver().list.length === 1, JSON.stringify(h.show.cap));
check('A4 the old cap would have blocked it: A + B is over A\'s length plus a quarter', A + B > cap(A) && B < A);
r = ctx.renderShow(6); h = get({ health: '1' });
check('A5 the render voices the whole rewrite: 12 lines, version 2 registered with its own count, version 1\'s spend untouched, the gameweek and month totals carry both', r.ok && r.rendered.length === 12 && tts.length === 12 && r.cap.used === 0 && r.cap.cap === cap(B) && r.cap.versions === 2 &&
  ver().list.join() === idOf(scriptA()) + ',' + idOf(scriptB()) && ver().used[idOf(scriptA())] === A && ver().used[idOf(scriptB())] === B && Number(props.EMT_SHOW_GW_CHARS_6) === A + B && Number(props[monthKey]) === A + B && h.show.clips === 12 && h.show.cap.used === B, JSON.stringify(ver()));
reset(); r = ctx.renderShow(6); const r2 = ctx.renderShow(6);
check('A6 no loop: the next renders of the same script voice nothing, call nothing, count nothing', r.ok && r.kept === 12 && r2.kept === 12 && tts.length === 0 && subs.length === 0 && ver().used[idOf(scriptB())] === B && Number(props.EMT_SHOW_GW_CHARS_6) === A + B);

console.log('--- B the same version again, a small edit, and the bound');
SHOW[6].speed = 1; newScript(); reset(); r = ctx.renderShow(6); h = get({ health: '1' });
check('B1 a new speed on the same texts is the same version: every line stale, B of its cap used, so capped before any call, the error names the version', r.ok === false && r.stopped === 'capped' && tts.length === 0 && subs.length === 0 && r.cap.version === idOf(scriptB()) &&
  new RegExp('GW6 has voiced ' + B + ' of its ' + cap(B) + '-character cap for this script version \\(version 2 of 3\\) and the 12 lines still to voice need ' + B).test(r.error) && /EMT_SHOW_GW_CAP_6/.test(r.error) && h.show.capped === true && h.show.cap.versions === 2, r.error);
SHOW[6].speed = 1.1; SHOW[6].chapters[0].beats[2] = 'Devils U21s. Still no points. The youth project is taking its time, as youth projects do.'; const C = charsOf(SHOW[6]); newScript(); reset(); r = ctx.renderShow(6);
check('B2 one line edited is a new version (3 of 3) with its own allowance: the one line is voiced and counted against it', r.ok && r.rendered.join() === 'c1b2' && tts.length === 1 && r.cap.versions === 3 && r.cap.own === true && r.cap.used === 0 && r.cap.cap === cap(C) && ver().list.length === 3 && ver().used[idOf(SHOW[6])] === SHOW[6].chapters[0].beats[2].length, JSON.stringify(r.cap));
const id3 = idOf(SHOW[6]), used3 = ver().used[id3];
SHOW[6].chapters[1].beats[3] = 'Five at the back and one up front. Somewhere, Tony Pulis is welling up, quietly.'; newScript(); reset(); r = ctx.renderShow(6);
check('B3 a fourth version gets no place of its own: counted against version 3, which still has room for one line (own false)', r.ok && r.rendered.join() === 'c2b3' && tts.length === 1 && r.cap.version === id3 && r.cap.own === false && r.cap.versions === 3 && r.cap.used === used3 && ver().list.length === 3 && ver().used[id3] === used3 + SHOW[6].chapters[1].beats[3].length, JSON.stringify(r.cap));
SHOW[6] = scriptA(); SHOW[6].open = 'Gameweek six, once more.'; newScript(); reset(); r = ctx.renderShow(6);
check('B4 a fifth, full rewrite: against version 3\'s allowance it does not fit, so nothing is called and the error says the bound', r.ok === false && r.stopped === 'capped' && tts.length === 0 && subs.length === 0 && r.cap.version === id3 && r.cap.own === false &&
  /for this script version \(a rewrite beyond the 3 versions a gameweek may voice, counted against the last\)/.test(r.error) && ver().list.length === 3, r.error);
check('B5 the whole gameweek voiced at most three scripts and a quarter each', Number(props.EMT_SHOW_GW_CHARS_6) <= cap(A) + cap(B) + cap(C) && Number(props.EMT_SHOW_GW_CHARS_6) === A + B + ver().used[id3]);

console.log('--- C a gameweek that spent characters before v3.27');
SHOW[7] = scriptB(); SHOW[7].gw = 7; props.EMT_SHOW_GW_CHARS_7 = '3189'; reset(); h = get({ health: '1' });
let V7 = ctx.emtShowVersions(7);
check('C1 EMT_SHOW_GW_CHARS_7 with no version record is carried as the version "before" with its spend as its length, taking one of the three places', V7.list.join() === 'before' && V7.used.before === 3189 && V7.len.before === 3189 && !props.EMT_SHOW_GW_VER_7);
r = ctx.renderShow(7);
check('C2 the new script is voiced in full as version 2 with 0 used of its own, although the gameweek had voiced 3,189 characters; the record is written with both', r.ok && r.rendered.length === 12 && r.cap.used === 0 && r.cap.versions === 2 && r.cap.own === true && ver(7).list.join() === 'before,' + idOf(SHOW[7]) && ver(7).used.before === 3189 && ver(7).used[idOf(SHOW[7])] === B && Number(props.EMT_SHOW_GW_CHARS_7) === 3189 + B, JSON.stringify([r.cap, ver(7)]));

console.log('--- D EMT_SHOW_GW_CAP_<gw> still caps the gameweek as a whole');
props.EMT_SHOW_GW_CAP_7 = String(3189 + B + 10); SHOW[7].speed = 1; delete T.cache.EMT_SHOW_REPO_7; reset(); r = ctx.renderShow(7); h = get({ health: '1' });
check('D1 with the Script Property set: used is the gameweek total, the cap the set value, and a rewrite over it is capped with the old wording', r.stopped === 'capped' && r.cap.used === 3189 + B && r.cap.cap === 3189 + B + 10 && /GW7 has voiced \d+ of its \d+-character cap and the 12 lines/.test(r.error) && !/script version/.test(r.error), r.error);
props.EMT_SHOW_GW_CAP_7 = String(10 * (3189 + B)); reset(); r = ctx.renderShow(7);
check('D2 raised far enough: the rewrite is voiced', r.ok && r.rendered.length === 12);
delete props.EMT_SHOW_GW_CAP_7;

console.log('--- E the balance read and the hold are unchanged');
SHOW[6] = scriptB(); SHOW[6].open = 'Gameweek six. Take two.'; newScript(); SUB.count = SUB.limit - 5; reset(); r = ctx.renderShow(6);
check('E1 the version has room but the balance read says 5 characters left: skipped before any ElevenLabs call, the hold is set until the reset', r.stopped === 'credits' && tts.length === 0 && subs.length === 1 && props.EMT_SHOW_HOLD && JSON.parse(props.EMT_SHOW_HOLD).until === iso(SUB.reset * 1000), r.error);
reset(); const st = ctx.showTick(Date.now());
check('E2 showTick while holding calls nothing', st.stopped === 'hold' && tts.length === 0 && subs.length === 0);
delete props.EMT_SHOW_HOLD; SUB.count = 1000; MODE = 'quota'; reset(); r = ctx.renderShow(6);
check('E3 a credit refusal in the middle still holds, and the version count only grows by what was sent (nothing: the call was refused)', r.stopped === 'http 401' && /out of credits/.test(r.error) && !!props.EMT_SHOW_HOLD && ver().used[id3] === used3 + 'Five at the back and one up front. Somewhere, Tony Pulis is welling up, quietly.'.length, JSON.stringify(ver()));
MODE = 'ok'; delete props.EMT_SHOW_HOLD;

console.log('--- F the pinned gameweek keeps its extra script\'s worth, per version');
props.EMT_SHOW_MODEL_GW_8 = JSON.stringify({ model: 'eleven_multilingual_v2', from: 'eleven_v4_turbo', at: iso(Date.now()), code: 422, why: 'test' });
SHOW[8] = scriptB(); SHOW[8].gw = 8; const c8 = ctx.emtShowCap(8, ctx.emtShowClips(SHOW[8]));
check('F1 a pinned gameweek\'s version cap is its length plus a quarter plus one more script\'s worth', c8.cap === cap(B) + B && c8.pinned === true && c8.used === 0 && c8.own === true);
delete props.EMT_SHOW_MODEL_GW_8;

T.done();
