// v3.24 tests: the Gameweek Show serves only the takes of the current script, captions follow the voice, and the
// last render's outcome is in ?health=1 (Parker's request of 8 Oct 2026 after the GW6 show).   node tests/codegs/v324.js
const T = require(__dirname + '/harness.js').make();
const { ctx, check, src, sheets, props, cache, logs } = T;
const crypto = require('crypto');
const md5 = s => crypto.createHash('md5').update(s, 'utf8').digest('hex');
const VOICE = 'e2v8SRwGUU8TdMFPuDlV', MODEL = 'eleven_v4_turbo';   // v3.26: the default model (the script's own model field is a label)
const hashOf = (t, speed) => md5(t + '|' + VOICE + '|' + MODEL + '|' + speed);

/* the ElevenLabs mock: with-timestamps answers JSON with the audio and an alignment built from the text; MODE
 * switches it to a refusal, to an answer without an alignment, or to an endpoint that is not there */
let SHOW = {}, MODE = 'ok', tts = [], gh = [];
const b64of = t => Buffer.from('mp3:' + t).toString('base64');
const alignOf = (t, step) => { const chars = t.split(''); return { characters: chars, character_start_times_seconds: chars.map((_, i) => Math.round(i * step * 1000) / 1000), character_end_times_seconds: chars.map((_, i) => Math.round((i + 1) * step * 1000) / 1000) }; };
const realFetch = ctx.UrlFetchApp.fetch;
ctx.UrlFetchApp.fetch = (url, o) => {
  o = o || {};
  if (/github\.io/.test(url)) {
    gh.push(url);
    const gw = Number((url.match(/show\/gw(\d+)\.json/) || [])[1]);
    return SHOW[gw] ? T.resp(200, SHOW[gw]) : T.resp(404, '<h1>404</h1>');
  }
  if (/api\.elevenlabs\.io/.test(url)) {
    if (/\/v1\/user\/subscription/.test(url)) return T.resp(200, { character_count: 120, character_limit: 1000000, next_character_count_reset_unix: Math.floor(Date.now() / 1000) + 20 * 86400, tier: 'test' });   // v3.25: the balance, read before a render
    const body = JSON.parse(o.payload), timed = /\/with-timestamps\?/.test(url);
    tts.push({ url, o, body, timed });
    if (MODE === 'quota') return T.resp(401, { detail: { status: 'quota_exceeded', message: 'This request exceeds your quota of 10000. You have 12 credits remaining.' } });
    if (MODE === '402') return T.resp(402, { detail: 'Payment required' });
    if (MODE === 'noendpoint' && timed) return T.resp(404, { detail: 'Not Found' });
    if (MODE === 'notjson' && timed) return { getResponseCode: () => 200, getContentText: () => 'ID3\u0000\u0000binary', getContent: () => [1, 2, 3] };
    if (!timed) { const bytes = Array.from(Buffer.from('mp3:' + body.text)).map(b => (b > 127 ? b - 256 : b)); return { getResponseCode: () => 200, getContent: () => bytes, getContentText: () => '' }; }
    const j = { audio_base64: b64of(body.text), alignment: MODE === 'noalign' ? null : alignOf(body.text, 0.05), normalized_alignment: null };
    if (MODE === 'badalign') j.alignment = { characters: ['a', 'b'], character_start_times_seconds: [0, 0.1], character_end_times_seconds: [0.1, 0.2] };
    return T.resp(200, j);
  }
  return realFetch(url, o);
};
const reset = () => { tts.length = 0; gh.length = 0; logs.length = 0; };
const script = () => ({ gw: 6, voice: 'Malcolm Tyre — El Matador Booth', model: MODEL, speed: 1.1,
  open: 'Gameweek six. Two derbies and a leader under investigation.',
  chapters: [
    { home: 'Cold Palmers', away: 'Devils U21s', star: { h: '1', a: '2' }, beats: ['Cold Palmers. Fifth, on nine points.', 'Palmer carries a knock.', 'Devils U21s. Five defeats from five.', 'Bruno is the hope.', 'Parker leads the series.'] },
    { home: 'Kobbie Mainoo Fan', away: 'Trophy Hunters', star: { h: '3', a: '4' }, beats: ['Top of the table.', 'Hall scored thirteen.', 'Trophy Hunters. Three straight wins.', 'Semenyo carries a knock.', 'Baha leads five to two.'] },
  ],
  close: 'That is the gameweek. Malcolm Tyre, El Matador booth.' });
const keys = ['open', 'c1b0', 'c1b1', 'c1b2', 'c1b3', 'c1b4', 'c2b0', 'c2b1', 'c2b2', 'c2b3', 'c2b4', 'close'];
const rowsOf = k => (sheets.ShowAudio ? sheets.ShowAudio.rows.slice(1) : []).filter(r => Number(r[0]) === 6 && r[1] === k);
const get = p => JSON.parse(ctx.doGet({ parameter: p }).t);

console.log('--- V the release');
check('V1 EMT_VERSION is v3.24 or later and the CHANGELOG has the entry', ctx.emtSelfVersion(src) === ctx.EMT_VERSION && ctx.emtSelfCmp(ctx.EMT_VERSION, 'v3.24') >= 0 && /\* v3\.24 · 8 Oct 2026\n \*   The Gameweek Show plays only the takes of the script as it is now/.test(src));
check('V2 the ShowAudio header gains Words as column 9; the call goes to with-timestamps', ctx.EMT_SHOW_HEAD.join('|') === 'GW|Clip|Hash|Part|Parts|Secs|Data|Rendered (UTC)|Words' && ctx.EMT_SHOW_WORDS_COL === 9 && ctx.EMT_SHOW_TTS_TIMED === '/with-timestamps');

console.log('--- W word times from the alignment');
const wt = (t, al) => JSON.stringify(ctx.emtShowWordTimes(t, al));
check('W1 one start time per word, from the first character of each word, 2 decimals', wt('Hall scored thirteen.', alignOf('Hall scored thirteen.', 0.1)) === '[0,0.5,1.2]');
check('W2 several spaces and a leading space still give one time per word', wt('  a  bb c', { characters: [' ', ' ', 'a', ' ', ' ', 'b', 'b', ' ', 'c'], character_start_times_seconds: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8] }) === '[0.2,0.5,0.8]');
check('W3 an alignment that does not line up with the text (wrong word count) is null', ctx.emtShowWordTimes('Hall scored thirteen.', alignOf('Hall scored', 0.1)) === null);
check('W4 missing or ragged arrays are null, never a throw', ctx.emtShowWordTimes('a b', null) === null && ctx.emtShowWordTimes('a b', {}) === null && ctx.emtShowWordTimes('a b', { characters: ['a', ' ', 'b'], character_start_times_seconds: [0] }) === null && ctx.emtShowWordTimes('', alignOf('', 0.1)) === null);
check('W5 a non-numeric start time is null; a negative one is clamped to 0', ctx.emtShowWordTimes('a b', { characters: ['a', ' ', 'b'], character_start_times_seconds: [0, 'x', 'y'] }) === null && wt('a b', { characters: ['a', ' ', 'b'], character_start_times_seconds: [-0.02, 0.1, 0.3] }) === '[0,0.3]');
check('W6 a Words cell parses back; junk, a formula-looking cell or a negative time does not', JSON.stringify(ctx.emtShowWordsParse("'[0,0.42,0.81]")) === '[0,0.42,0.81]' && ctx.emtShowWordsParse('') === null && ctx.emtShowWordsParse('=1+1') === null && ctx.emtShowWordsParse('[0,"a"]') === null && ctx.emtShowWordsParse('[0,-1]') === null && ctx.emtShowWordsParse('[]') === null);
check('W7 base64 byte count', ctx.emtB64Bytes(Buffer.from('abcd').toString('base64')) === 4 && ctx.emtB64Bytes(Buffer.from('abcde').toString('base64')) === 5 && ctx.emtB64Bytes(Buffer.from('abcdef').toString('base64')) === 6 && ctx.emtB64Bytes('') === 0);

console.log('--- R the render with timestamps');
props.ELEVENLABS_API_KEY = 'el-test'; props.EMT_SHOW_GW_CAP_6 = '1000000'; SHOW[6] = script(); reset();   // v3.25: this suite re-voices GW6 many times over; the cap has its own suite (v325.js)
const r1 = ctx.renderShow(6);
check('R1 12 clips rendered through with-timestamps, Accept json, audio stored from audio_base64', r1.ok && r1.rendered.length === 12 && tts.length === 12 && tts.every(c => c.timed && c.o.headers.Accept === 'application/json') && rowsOf('open')[0][6] === 'b64:' + b64of(SHOW[6].open), ctx.emtShowSummary(r1));
const openRow = rowsOf('open')[0], wOpen = ctx.emtShowWordTimes(SHOW[6].open, alignOf(SHOW[6].open, 0.05));
check('R2 the Words column holds the word start times on the first row, one per word', openRow[8] === JSON.stringify(wOpen) && wOpen.length === SHOW[6].open.split(/\s+/).length && openRow.length === 9, openRow[8]);
check('R3 secs comes from the alignment\'s last end time', openRow[5] === Math.round(SHOW[6].open.length * 0.05 * 100) / 100, String(openRow[5]));
check('R4 hash unchanged in form: md5(text|voice|model|speed)', String(openRow[2]).replace(/^'/, '') === hashOf(SHOW[6].open, '1.1'));
check('R5 the outcome is kept for health: ok, 12 rendered, 0 left', (() => { const l = ctx.emtShowLast(); return l && l.ok === true && l.gw === 6 && l.rendered === 12 && l.kept === 0 && l.left === 0 && l.stopped === '' && /^\d{4}-/.test(l.at); })(), props.EMT_SHOW_LAST);
check('R6 the render refreshed the 5-minute script cache with the json it voiced', JSON.parse(cache.EMT_SHOW_REPO_6).json.open === SHOW[6].open);

console.log('--- G serving: fresh only');
let g = get({ show: '6' });
check('G1 all 12 fresh: served with b64 and w, complete, nothing stale or missing', g.ok && g.complete === true && Object.keys(g.clips).join() === keys.join() && g.stale.length === 0 && g.missing.length === 0 && keys.every(k => g.clips[k].b64 && Array.isArray(g.clips[k].w) && g.clips[k].w.length === g.clips[k].w.filter(x => typeof x === 'number').length), JSON.stringify({ stale: g.stale, missing: g.missing }));
check('G2 w matches the text\'s word count for every clip', keys.every(k => { const t = ctx.emtShowClips(SHOW[6]).find(c => c.key === k).text; return g.clips[k].w.length === t.split(/\s+/).length; }));
let gm = get({ show: '6', meta: '1' });
check('G3 &meta=1 keeps w, secs, hash and complete without b64', gm.complete === true && keys.every(k => !('b64' in gm.clips[k]) && gm.clips[k].w.length > 0 && gm.clips[k].secs > 0 && gm.clips[k].hash));
/* the script changes on the site (two lines) and the render has not run yet: ?show judges against the new text */
SHOW[6].open = 'Gameweek six. Take two.'; SHOW[6].chapters[1].beats[1] = 'Hall scored thirteen last week.';
delete cache.EMT_SHOW_REPO_6; reset();
g = get({ show: '6' });
check('G4 two lines rewritten, not re-voiced: the 10 current takes are served, 2 are stale, not complete', g.complete === false && g.stale.join() === 'open,c2b1' && Object.keys(g.clips).length === 10 && !g.clips.open && !g.clips.c2b1 && g.missing.length === 0, JSON.stringify({ stale: g.stale, n: Object.keys(g.clips).length }));
check('G5 the stale takes are still in the sheet (nothing deleted by a read)', rowsOf('open').length === 1 && rowsOf('c2b1').length === 1);
let h = get({ health: '1' });
check('G6 ?health=1 show: clips 10 of 12, stale 2, source repo, render ok', h.show.clips === 10 && h.show.expected === 12 && h.show.stale === 2 && h.show.source === 'repo' && h.show.render && h.show.render.ok === true && h.show.render.rendered === 12, JSON.stringify(h.show));
/* the render catches up: 2 calls, and everything is fresh again */
const r2 = ctx.renderShow(6);
g = get({ show: '6' });
check('G7 the next render re-voices exactly the 2 changed lines; served complete again', r2.rendered.join() === 'open,c2b1' && r2.kept === 10 && tts.length === 2 && g.complete === true && g.stale.length === 0 && Object.keys(g.clips).length === 12 && g.clips.open.b64 === b64of(SHOW[6].open), ctx.emtShowSummary(r2));
h = get({ health: '1' });
check('G8 health: 12 of 12, 0 stale', h.show.clips === 12 && h.show.stale === 0 && h.show.expected === 12);
/* a change of speed changes every hash */
SHOW[6].speed = 1; delete cache.EMT_SHOW_REPO_6;
g = get({ show: '6' });
check('G9 a new speed makes every take stale', g.stale.length === 12 && Object.keys(g.clips).length === 0 && g.complete === false);
SHOW[6].speed = 1.1; delete cache.EMT_SHOW_REPO_6;
/* a line added to the script */
SHOW[6].chapters[0].beats.push('One more.'); delete cache.EMT_SHOW_REPO_6;
g = get({ show: '6' });
check('G10 a new line is missing (not stale), not complete, the rest served', g.missing.join() === 'c1b5' && g.stale.length === 0 && Object.keys(g.clips).length === 12 && g.complete === false);
SHOW[6].chapters[0].beats.pop(); delete cache.EMT_SHOW_REPO_6;
/* no script anywhere: nothing is served */
const saved = SHOW[6]; delete SHOW[6]; delete cache.EMT_SHOW_REPO_6;
g = get({ show: '6' });
check('G11 no script at all: no take can be judged, so none is served; script null, not complete', g.ok && Object.keys(g.clips).length === 0 && g.complete === false && g.script === null && g.stale.length === 0);
h = get({ health: '1' });
check('G12 health without a script: clips 0, source null, expected the stored key list', h.show.clips === 0 && h.show.source === null && h.show.stale === 0 && h.show.expected === 12, JSON.stringify(h.show));
SHOW[6] = saved; delete cache.EMT_SHOW_REPO_6;
check('G13 showStatus counts current takes and names stale ones', (() => { SHOW[6].close = 'Changed close.'; delete cache.EMT_SHOW_REPO_6; logs.length = 0; const st = ctx.showStatus(6); return st.rendered === 11 && st.stale === 1 && st.expected === 12 && /11 of 12 clips rendered and current/.test(logs[0]) && /close: stale/.test(logs[0]) && /Last render/.test(logs[0]); })(), (logs[0] || '').split('\n')[0]);
ctx.renderShow(6);

console.log('--- F refusals and fallbacks');
MODE = 'quota'; SHOW[6].open = 'Gameweek six. Take three.'; delete cache.EMT_SHOW_REPO_6; reset();
const rq = ctx.renderShow(6);
check('F1 a quota refusal stops the run after one call and keeps the old take', tts.length === 1 && rq.ok === false && rq.stopped === 'http 401' && /out of credits/.test(rq.error) && rowsOf('open').length === 1, rq.error);
h = get({ health: '1' });
check('F2 health carries the refusal: render.ok false, the error text, stale 1, clips 11 of 12', h.show.render.ok === false && /out of credits/.test(h.show.render.error) && h.show.render.stopped === 'http 401' && h.show.render.rendered === 0 && h.show.render.kept === 11 && h.show.render.left === 1 && h.show.stale === 1 && h.show.clips === 11, JSON.stringify(h.show.render));
g = get({ show: '6' });
check('F3 the old open is never served after the rewrite', !g.clips.open && g.stale.join() === 'open' && g.complete === false);
MODE = '402'; reset(); const r402 = ctx.renderShow(6);
check('F4 402 reads as out of credits too', r402.stopped === 'http 402' && /out of credits/.test(r402.error));
MODE = 'noendpoint'; reset(); const rn = ctx.renderShow(6);
check('F5 with-timestamps 404: the plain call is made once, the take stored without word times, marked in the summary', rn.ok && rn.rendered.join() === 'open' && tts.length === 2 && tts[0].timed && !tts[1].timed && tts[1].o.headers.Accept === 'audio/mpeg' && rowsOf('open')[0][8] === '' && rowsOf('open')[0][6] === 'b64:' + b64of(SHOW[6].open) && /1 without word times/.test(ctx.emtShowSummary(rn)), ctx.emtShowSummary(rn));
g = get({ show: '6' });
check('F6 a take without word times is served without w (the app keeps its estimate), still fresh and complete', g.complete === true && !('w' in g.clips.open) && g.clips.open.secs === Math.round(('mp3:' + SHOW[6].open).length / 80) / 100 && g.clips.c1b0.w.length > 0);
MODE = 'noalign'; SHOW[6].close = 'The close, take two.'; delete cache.EMT_SHOW_REPO_6; reset(); const ra = ctx.renderShow(6);
check('F7 an answer without an alignment: audio stored, secs from the byte count, no w', ra.ok && ra.rendered.join() === 'close' && rowsOf('close')[0][8] === '' && rowsOf('close')[0][5] === Math.round(('mp3:' + SHOW[6].close).length / 80) / 100 && ra.untimed === 1);
MODE = 'badalign'; SHOW[6].close = 'The close, take three.'; delete cache.EMT_SHOW_REPO_6; reset(); const rb = ctx.renderShow(6);
check('F8 an alignment that does not line up: audio stored, no w, never a throw', rb.ok && rb.rendered.join() === 'close' && rowsOf('close')[0][8] === '');
MODE = 'notjson'; SHOW[6].close = 'The close, take four.'; delete cache.EMT_SHOW_REPO_6; reset(); const rj = ctx.renderShow(6);
check('F9 a 200 that is not the JSON shape: treated as no audio, the run stops, the old take kept', rj.ok === false && rj.stopped === 'http 200' && /sent no audio/.test(rj.error) && rowsOf('close')[0][6] === 'b64:' + b64of('The close, take three.'));
MODE = 'ok'; reset(); ctx.renderShow(6);
check('F10 a busy run is not recorded over the last real outcome', (() => { const before = props.EMT_SHOW_LAST; props.EMT_SHOW_BUSY = String(Date.now()); const rbz = ctx.renderShow(6); delete props.EMT_SHOW_BUSY; return rbz.stopped === 'busy' && props.EMT_SHOW_LAST === before; })());

console.log('--- H an older tab');
/* a ShowAudio tab made by v3.11 (8 columns) gets its Words header and its old takes keep working */
const old = sheets.ShowAudio; sheets.ShowAudio = new T.Sheet('ShowAudio', [['GW', 'Clip', 'Hash', 'Part', 'Parts', 'Secs', 'Data', 'Rendered (UTC)']].concat(old.rows.slice(1).map(r => r.slice(0, 8))));
delete cache.EMT_SHOW_REPO_6; reset();
g = get({ show: '6' });
check('H1 8-column rows: every take still judged fresh and served, without w', g.complete === true && Object.keys(g.clips).length === 12 && keys.every(k => !('w' in g.clips[k])));
SHOW[6].open = 'Gameweek six. Take five.'; delete cache.EMT_SHOW_REPO_6;
const rh = ctx.renderShow(6);
check('H2 the first render on it adds the Words header cell and stores word times for the new take only', sheets.ShowAudio.rows[0].join('|') === ctx.EMT_SHOW_HEAD.join('|') && rh.rendered.join() === 'open' && rowsOf('open')[0][8].startsWith('[') && rowsOf('c1b0')[0].length === 8);
g = get({ show: '6' });
check('H3 served: the new take with w, the old ones without, complete', g.complete === true && g.clips.open.w.length === SHOW[6].open.split(/\s+/).length && !('w' in g.clips.c1b0));

console.log('--- S the written script');
/* the repo has no json: the ShowScripts one (source ai) is judged the same way; health source is sheet */
delete SHOW[6]; delete cache.EMT_SHOW_REPO_6; reset();
const js = Object.assign(script(), { source: 'ai', written: '2026-10-09' });
sheets.ShowScripts = new T.Sheet('ShowScripts', [['GW', 'Written (UTC)', 'Model', 'Facts (UTC)', 'Script'], [6, "'2026-10-09T10:00:00Z", 'claude-sonnet-5-5', "'2026-10-09T09:00:00Z", 'j:' + JSON.stringify(js)]]);
g = get({ show: '6' });
check('S1 the written script: its lines judged against the stored takes (open, c2b1 and close differ)', g.script && g.script.source === 'ai' && g.stale.join() === 'open,c2b1,close' && Object.keys(g.clips).length === 9 && g.complete === false, JSON.stringify(g.stale));
const rs = ctx.renderShow(6);
h = get({ health: '1' });
check('S2 rendered from the sheet: 3 re-voiced, health source sheet, 12 of 12', rs.source === 'sheet' && rs.rendered.join() === 'open,c2b1,close' && h.show.source === 'sheet' && h.show.clips === 12 && h.show.stale === 0 && h.show.render.source === 'sheet', JSON.stringify(h.show));

T.done();
