// v3.26 tests: the Gameweek Show on ElevenLabs v4 Turbo with more emotion (Parker's request, 8 Oct 2026). The model is
// eleven_v4_turbo (EMT_TTS_MODEL wins, the script json's model is a label); a v4 model gets voice_settings { stability,
// similarity_boost } and nothing else; audio tags in square brackets go to ElevenLabs but never to the Words column or a
// caption; a 400 or 422 pins the gameweek to the previous model once, with a stable hash, so nothing re-renders every
// tick; emtShowCheck keeps the tags sparse; ?health=1 and the summary name the model.   node tests/codegs/v326.js
const T = require(__dirname + '/harness.js').make();
const { ctx, check, src, sheets, props, cache, logs } = T;
const crypto = require('crypto');
const md5 = s => crypto.createHash('md5').update(s, 'utf8').digest('hex');
const VOICE = 'e2v8SRwGUU8TdMFPuDlV', V4 = 'eleven_v4_turbo', PREV = 'eleven_multilingual_v2';
const hashOf = (t, model) => md5(t + '|' + VOICE + '|' + model + '|1.1');
const V4_SETTINGS = JSON.stringify({ stability: 0, similarity_boost: 0.75 });
const OLD_SETTINGS = JSON.stringify({ stability: 0.5, similarity_boost: 0.75, style: 0, use_speaker_boost: true, speed: 1.1 });

/* the ElevenLabs mock: the balance always fine; text to speech answers per MODE, with an alignment over every character
   sent (tags included, as the real endpoint aligns the text it was given) */
let SHOW = {}, MODE = 'ok', tts = [];
const b64of = t => Buffer.from('mp3:' + t).toString('base64');
const alignOf = t => { const chars = t.split(''); return { characters: chars, character_start_times_seconds: chars.map((_, i) => i * 0.05), character_end_times_seconds: chars.map((_, i) => (i + 1) * 0.05) }; };
const realFetch = ctx.UrlFetchApp.fetch;
ctx.UrlFetchApp.fetch = (url, o) => {
  o = o || {};
  if (/github\.io/.test(url)) { const gw = Number((url.match(/show\/gw(\d+)\.json/) || [])[1]); return SHOW[gw] ? T.resp(200, SHOW[gw]) : T.resp(404, '<h1>404</h1>'); }
  if (/^https:\/\/api\.elevenlabs\.io\/v1\/user\/subscription$/.test(url)) return T.resp(200, { tier: 'creator', character_count: 1000, character_limit: 100000, next_character_count_reset_unix: Math.floor(Date.now() / 1000) + 20 * 86400, status: 'active' });
  if (/api\.elevenlabs\.io/.test(url)) {
    const body = JSON.parse(o.payload); tts.push({ url, o, body });
    if (MODE === '422') return T.resp(422, { detail: [{ loc: ['body', 'voice_settings', 'style'], msg: 'extra fields not permitted', type: 'value_error.extra' }] });
    if (MODE === '400') return T.resp(400, { detail: { status: 'model_not_found', message: 'The model eleven_v4_turbo does not exist or you do not have access to it.' } });
    if (MODE === 'quota') return T.resp(401, { detail: { status: 'quota_exceeded', message: 'This request exceeds your quota of 10000. You have 12 credits remaining.' } });
    if (MODE === 'badkey') return T.resp(401, { detail: { status: 'invalid_api_key', message: 'Invalid API key' } });
    return T.resp(200, { audio_base64: b64of(body.text), alignment: alignOf(body.text), normalized_alignment: null });
  }
  return realFetch(url, o);
};
const reset = () => { tts.length = 0; logs.length = 0; };
const newScript = () => { delete cache.EMT_SHOW_REPO_6; };
const script = () => ({ gw: 6, voice: 'Malcolm Tyre', model: PREV, speed: 1.1,   /* the json still says the old model: a label, not the choice */
  open: 'Gameweek six. Two derbies and a leader who [deadpan] still leads his derby.',
  chapters: [
    { home: 'Cold Palmers', away: 'Devils U21s', beats: ['Cold Palmers. Fifth, on nine points.', 'Palmer carries a knock. [sighs] Four doubts in one eleven.', 'Devils U21s. Five defeats from five.', 'Gibbs-White tops the eleven. Fully fit. [deadpan] Just shite.', 'Parker leads the series four to three.'] },
  ],
  close: 'That is the gameweek. [whispering] Monday needs names.' });
const words = t => ctx.emtShowCaption(t).split(/\s+/).filter(Boolean).length;
const get = p => JSON.parse(ctx.doGet({ parameter: p }).t);
const rowsOf = k => (sheets.ShowAudio ? sheets.ShowAudio.rows.slice(1) : []).filter(r => r[0] === 6 && r[1] === k);
const strip = s => String(s).replace(/^'/, '');
const pin = () => (props.EMT_SHOW_MODEL_GW_6 ? JSON.parse(props.EMT_SHOW_MODEL_GW_6) : null);

console.log('--- V the release');
check('V1 EMT_VERSION is v3.26 or later and the CHANGELOG has the entry', ctx.emtSelfVersion(src) === ctx.EMT_VERSION && ctx.emtSelfCmp(ctx.EMT_VERSION, 'v3.26') >= 0 && /\* v3\.26 · 9 Oct 2026\n \*   The Gameweek Show is voiced by ElevenLabs v4 Turbo/.test(src));
check('V2 the constants: eleven_v4_turbo by default, eleven_multilingual_v2 as the fallback, stability 0 and similarity 0.75 for v4, two tags a line', ctx.EMT_SHOW_MODEL_DEFAULT === V4 && ctx.EMT_SHOW_MODEL_PREV === PREV && ctx.EMT_SHOW_V4_STABILITY === 0 && ctx.EMT_SHOW_V4_SIMILARITY === 0.75 && ctx.EMT_SHOW_TAGS_PER_LINE === 2);

console.log('--- M which model');
let M = ctx.emtShowModel(6);
check('M1 nothing set: the default, from default, no fallback', M.model === V4 && M.from === 'default' && M.fallback === null);
props.EMT_TTS_MODEL = 'eleven_v3'; M = ctx.emtShowModel(6);
check('M2 EMT_TTS_MODEL wins, from property', M.model === 'eleven_v3' && M.from === 'property');
props.EMT_SHOW_MODEL_GW_6 = JSON.stringify({ model: PREV, from: V4, at: '2026-10-09T00:00:00.000Z', code: 422, why: 'x' }); M = ctx.emtShowModel(6);
check('M3 the property still wins over a pin, and the pin is reported', M.model === 'eleven_v3' && M.from === 'property' && M.fallback && M.fallback.model === PREV);
delete props.EMT_TTS_MODEL; M = ctx.emtShowModel(6);
check('M4 without the property the pin decides: the previous model, from fallback', M.model === PREV && M.from === 'fallback' && M.fallback.code === 422);
check('M5 another gameweek is not pinned; a junk pin is ignored', ctx.emtShowModel(7).model === V4 && (() => { props.EMT_SHOW_MODEL_GW_6 = '{bad'; const r = ctx.emtShowModel(6); return r.model === V4 && r.from === 'default'; })());
delete props.EMT_SHOW_MODEL_GW_6;
check('M6 emtShowVoice carries the model and where it came from; the json\'s model is a label only', (() => { const v = ctx.emtShowVoice(script(), 6); return v.model === V4 && v.from === 'default' && v.voice === VOICE && v.speed === 1.1 && ctx.emtShowVoice(script()).model === V4; })());

console.log('--- S the settings a model takes');
check('S1 a v4 model: stability and similarity_boost, nothing else (no style, speed or speaker boost)', JSON.stringify(ctx.emtShowSettings(V4, 1.1)) === V4_SETTINGS && JSON.stringify(ctx.emtShowSettings('eleven_v4', 1.1)) === V4_SETTINGS);
check('S2 any other model keeps the v3.24 body with the speed', JSON.stringify(ctx.emtShowSettings(PREV, 1.1)) === OLD_SETTINGS && JSON.stringify(ctx.emtShowSettings('eleven_flash_v2_5', 1.1)) === OLD_SETTINGS);
props.EMT_SHOW_STABILITY = '0.5';
check('S3 EMT_SHOW_STABILITY changes a v4 model\'s stability (0 to 1); junk or out of range keeps the default', ctx.emtShowSettings(V4, 1).stability === 0.5 && (() => { props.EMT_SHOW_STABILITY = '2'; const a = ctx.emtShowSettings(V4, 1).stability; props.EMT_SHOW_STABILITY = 'high'; const b = ctx.emtShowSettings(V4, 1).stability; props.EMT_SHOW_STABILITY = ''; const c = ctx.emtShowSettings(V4, 1).stability; return a === 0 && b === 0 && c === 0; })());
delete props.EMT_SHOW_STABILITY;

console.log('--- C captions and tags');
check('C1 emtShowCaption strips the tags and tidies the spaces', ctx.emtShowCaption('Fully fit. [deadpan] Just shite.') === 'Fully fit. Just shite.' && ctx.emtShowCaption('[whispering] Monday needs names.') === 'Monday needs names.' && ctx.emtShowCaption('[sighs] One. [long pause] Two. [laughing]') === 'One. Two.' && ctx.emtShowCaption(null) === '' && ctx.emtShowCaption('a [ b') === 'a [ b');
check('C2 emtShowTags lists them in order', ctx.emtShowTags('[sighs] One. [long pause] Two.').join() === '[sighs],[long pause]' && ctx.emtShowTags('none').length === 0);
const tagged = 'Fully fit. [deadpan] Just shite.', al = alignOf(tagged), wt = ctx.emtShowWordTimes(tagged, al);
check('W1 word times from an alignment that carries the tag characters: one time per caption word, the tag skipped, the word after it timed at its own first character', wt && wt.length === 4 && wt[0] === 0 && wt[1] === 0.3 && wt[3] === Math.round(tagged.indexOf('shite') * 0.05 * 100) / 100 && wt[2] === Math.round(tagged.indexOf('Just') * 0.05 * 100) / 100, JSON.stringify(wt));
const bare = 'Fully fit. Just shite.', wb = ctx.emtShowWordTimes(tagged, alignOf(bare));
check('W2 an alignment without the tag characters (the endpoint stripped them) lines up too', wb && wb.length === 4 && wb[2] === Math.round(bare.indexOf('Just') * 0.05 * 100) / 100);
check('W3 a line that is only a tag has no words: null', ctx.emtShowWordTimes('[sighs]', alignOf('[sighs]')) === null);

console.log('--- R the render on v4 Turbo');
props.ELEVENLABS_API_KEY = 'el-test'; SHOW[6] = script(); newScript(); reset();
const keys = ctx.emtShowClips(SHOW[6]).map(c => c.key);
const r1 = ctx.renderShow(6);
check('R1 7 clips rendered through with-timestamps with model_id eleven_v4_turbo', r1.ok && r1.rendered.length === 7 && tts.length === 7 && tts.every(c => /with-timestamps\?/.test(c.url) && c.body.model_id === V4), JSON.stringify(r1));
check('R2 every body carries exactly { stability: 0, similarity_boost: 0.75 }: no style, no speed, no use_speaker_boost', tts.every(c => JSON.stringify(c.body.voice_settings) === V4_SETTINGS && !('style' in c.body.voice_settings) && !('speed' in c.body.voice_settings) && !('use_speaker_boost' in c.body.voice_settings)), JSON.stringify(tts[0].body.voice_settings));
check('R3 previous_text and next_text go on as before (the neighbours\' text, tags included), none on the first clip\'s previous or the last clip\'s next', !('previous_text' in tts[0].body) && tts[0].body.next_text === SHOW[6].chapters[0].beats[0] && tts[1].body.previous_text === SHOW[6].open && !('next_text' in tts[6].body) && tts[6].body.previous_text === SHOW[6].chapters[0].beats[4]);
check('R4 the tags reach ElevenLabs verbatim in text', tts[0].body.text === SHOW[6].open && /\[deadpan\]/.test(tts[0].body.text) && tts[6].body.text === SHOW[6].close);
check('R5 the hash is md5(text with its tags|voice|eleven_v4_turbo|speed)', strip(rowsOf('open')[0][2]) === hashOf(SHOW[6].open, V4) && strip(rowsOf('close')[0][2]) === hashOf(SHOW[6].close, V4));
check('R6 the Words column holds one time per caption word for every clip (the tag never counted)', keys.every(k => { const t = ctx.emtShowClips(SHOW[6]).find(c => c.key === k).text; const w = JSON.parse(rowsOf(k)[0][8]); return w.length === words(t) && w.length === t.replace(/\[[^\]]*\]/g, ' ').trim().split(/\s+/).length; }), rowsOf('open')[0][8]);
check('R7 the summary and the last render name the model', /Voice model eleven_v4_turbo\./.test(ctx.emtShowSummary(r1)) && ctx.emtShowLast().model === V4 && ctx.emtShowLast().fallback === null && r1.modelFrom === 'default');
let g = get({ show: '6' });
check('R8 ?show serves all 7, complete, each w the caption\'s word count, the script with its tags (the app strips them)', g.complete === true && Object.keys(g.clips).length === 7 && keys.every(k => g.clips[k].w.length === words(ctx.emtShowClips(SHOW[6]).find(c => c.key === k).text)) && /\[deadpan\]/.test(g.script.open));
let h = get({ health: '1' });
check('R9 ?health=1 show.model { eleven_v4_turbo, default, null } and render.model', h.show.model.model === V4 && h.show.model.from === 'default' && h.show.model.fallback === null && h.show.render.model === V4 && h.show.clips === 7 && h.show.stale === 0, JSON.stringify(h.show.model));
reset(); const r1b = ctx.renderShow(6);
check('R10 the next tick has nothing to voice: no call, 7 kept (no loop)', tts.length === 0 && r1b.kept === 7 && r1b.rendered.length === 0 && r1b.ok);
/* a script written before this version carried the old model: its takes were hashed with eleven_multilingual_v2 */
check('R11 a take rendered with the old model reads as stale now (the one-time re-voice), never as fresh', (() => { const r = rowsOf('open')[0]; const save = r[2]; r[2] = "'" + hashOf(SHOW[6].open, PREV); const q = get({ show: '6' }); r[2] = save; return q.stale.join() === 'open' && !q.clips.open; })());
check('R12 the cap counts the characters sent, tags included', Number(props.EMT_SHOW_GW_CHARS_6) === ctx.emtShowClips(SHOW[6]).reduce((n, c) => n + c.text.length, 0));

console.log('--- F the fallback, once');
SHOW[6].open = 'Gameweek six. [sighs] Take two.'; newScript(); MODE = '422'; reset();
const f1 = ctx.renderShow(6);
check('F1 a 422 on v4: one call, the run stops, the gameweek is pinned to eleven_multilingual_v2 with the refusal', tts.length === 1 && f1.ok === false && f1.stopped === 'http 422' && pin() && pin().model === PREV && pin().from === V4 && pin().code === 422 && /extra fields not permitted/.test(pin().why) && /^\d{4}-/.test(pin().at), JSON.stringify(pin()));
check('F2 the outcome says so: the error names both models and the way back, render.fallback is kept, no hold (not a credit refusal)', /refused eleven_v4_turbo \(HTTP 422/.test(f1.error) && /falls back to eleven_multilingual_v2/.test(f1.error) && /EMT_SHOW_MODEL_GW_6/.test(f1.error) && f1.fallback.model === PREV && !f1.hold && !props.EMT_SHOW_HOLD && ctx.emtShowLast().fallback.model === PREV && ctx.emtShowLast().model === V4, f1.error);
h = get({ health: '1' });
check('F3 health: show.model is the fallback with its reason; every take is now judged against the fallback model (stale), none served', h.show.model.model === PREV && h.show.model.from === 'fallback' && h.show.model.fallback.code === 422 && h.show.stale === 7 && h.show.clips === 0, JSON.stringify(h.show.model));
MODE = 'ok'; reset(); const f2 = ctx.renderShow(6);
check('F4 the next render voices every line with eleven_multilingual_v2 and the v3.24 body (speed, style, speaker boost)', f2.ok && f2.rendered.length === 7 && tts.length === 7 && tts.every(c => c.body.model_id === PREV && JSON.stringify(c.body.voice_settings) === OLD_SETTINGS) && f2.modelFrom === 'fallback' && /Voice model eleven_multilingual_v2 \(the fallback for this gameweek\)/.test(ctx.emtShowSummary(f2)), JSON.stringify(tts[0] && tts[0].body.voice_settings));
check('F5 the hash now carries the fallback model and ?show serves everything, complete', strip(rowsOf('open')[0][2]) === hashOf(SHOW[6].open, PREV) && get({ show: '6' }).complete === true);
reset(); const f3 = ctx.renderShow(6); const g3 = get({ show: '6' }); h = get({ health: '1' });
check('F6 the tick after: nothing to voice, nothing stale, no call: the pin keeps the hash stable (no re-render loop)', tts.length === 0 && f3.kept === 7 && g3.complete === true && h.show.stale === 0 && h.show.clips === 7 && h.show.render.model === PREV);
props.EMT_SHOW_GW_CAP_6 = '1000000';   /* this small script has spent its quarter on the edits above; the cap has its own suite (v325.js) */
SHOW[6].open = 'Gameweek six. Take three.'; newScript(); MODE = '422'; reset(); const before = JSON.stringify(pin()); const f4 = ctx.renderShow(6);
check('F7 a 422 while already on the fallback: the run stops as before, the pin is not rewritten, v4 is not tried', f4.stopped === 'http 422' && JSON.stringify(pin()) === before && tts.length === 1 && tts[0].body.model_id === PREV && !f4.fallback && /refused the request/.test(f4.error));
MODE = 'ok'; reset(); ctx.renderShow(6);
check('F6b the cap gave the pinned gameweek one more script\'s worth, and no more', (() => { delete props.EMT_SHOW_GW_CAP_6; const L = ctx.emtShowLines(SHOW[6], 6), cap = ctx.emtShowCap(6, L); return cap.pinned && cap.cap === Math.ceil(cap.chars * 1.25) + cap.chars; })(), JSON.stringify(ctx.emtShowCap(6, ctx.emtShowLines(SHOW[6], 6))));
delete props.EMT_SHOW_MODEL_GW_6; props.EMT_SHOW_GW_CAP_6 = '1000000';   /* going back to v4 by hand is Parker's: the pin deleted and the cap raised */
newScript(); reset(); h = get({ health: '1' });
check('F8 deleting the pin is the way back: the default again, every take stale until re-voiced; the cap is the plain one again', h.show.model.from === 'default' && h.show.model.model === V4 && h.show.stale === 7 && !ctx.emtShowCap(6, ctx.emtShowLines(SHOW[6], 6)).pinned);
/* refusals that are not the model's: no pin */
MODE = 'quota'; reset(); const q1 = ctx.renderShow(6);
check('F9 a credit refusal on v4 holds (v3.25) and never pins', q1.stopped === 'http 401' && /out of credits/.test(q1.error) && !pin() && !!props.EMT_SHOW_HOLD);
delete props.EMT_SHOW_HOLD; MODE = 'badkey'; reset(); const k1 = ctx.renderShow(6);
check('F10 a wrong key (401) never pins', k1.stopped === 'http 401' && /API key/.test(k1.error) && !pin());
MODE = '400'; props.EMT_TTS_MODEL = V4; reset(); const p1 = ctx.renderShow(6);
check('F11 a 400 with EMT_TTS_MODEL set is Parker\'s choice to keep: no pin, the error as before', p1.stopped === 'http 400' && !pin() && !p1.fallback && p1.modelFrom === 'property');
delete props.EMT_TTS_MODEL; reset(); const p2 = ctx.renderShow(6);
check('F12 a 400 (model not found) on the default pins like a 422', p2.stopped === 'http 400' && pin() && pin().code === 400 && /model_not_found/.test(pin().why));
delete props.EMT_SHOW_MODEL_GW_6; MODE = 'ok'; reset(); ctx.renderShow(6);
check('F13 back on v4 after the pin is gone: every line re-voiced with eleven_v4_turbo once', tts.length === 7 && tts.every(c => c.body.model_id === V4) && get({ show: '6' }).complete === true);

console.log('--- K the checks keep the tags sparse');
const facts = { gw: 6, fixtures: [{ home: 'Cold Palmers', away: 'Devils U21s', H: { xi: [{ code: '1' }] }, A: { xi: [{ code: '2' }] } }] };
const allowed = 'nine 9 four 4 three 3 5';
const reply = (beats, open, close) => JSON.stringify({ open: open || 'Gameweek six. Two derbies and a leader who still leads his derby. Here is how it lines up.', chapters: [{ home: 'Cold Palmers', away: 'Devils U21s', star: { h: '1', a: '2' }, beats }], close: close || 'That is the gameweek. Lineups in before the deadline and get on the record.' });
const okBeats = ['Cold Palmers. Fifth, on 9 points, and the model gives them a fair chance.', 'Palmer carries a knock. [sighs] Four doubts in one eleven, and the week is young.', 'Devils U21s. Five defeats from five, zero points, and still leading this derby.', 'Gibbs-White tops the eleven. Not a flag among the starters. Fully fit. [deadpan] Just shite.', 'Parker leads the series 4 to 3 and the model backs him again this week.'];
let c = ctx.emtShowCheck(reply(okBeats), facts, allowed, 'end_turn');
check('K1 two tagged lines of seven pass; the tags are kept in the script', c.problems.length === 0 && /\[sighs\]/.test(c.script.chapters[0].beats[1]) && /\[deadpan\]/.test(c.script.chapters[0].beats[3]), c.problems.join(' | '));
c = ctx.emtShowCheck(reply(['[sighs] Cold Palmers. [laughing] Fifth, on 9 points, [deadpan] and the model likes them.'].concat(okBeats.slice(1))), facts, allowed, 'end_turn');
check('K2 three tags on one line is refused, naming the line', c.problems.some(p => /3 audio tags; at most 2 a line/.test(p)), c.problems.join(' | '));
c = ctx.emtShowCheck(reply(okBeats.map(b => '[sighs] ' + b.replace(/\[[^\]]*\] /g, '')), '[deadpan] Gameweek six. Two derbies and a leader who still leads his derby.'), facts, allowed, 'end_turn');
check('K3 tags on more than half the lines is refused', c.problems.some(p => /6 of 7 lines carry an audio tag/.test(p)), c.problems.join(' | '));
c = ctx.emtShowCheck(reply(['[Sighs 2] Cold Palmers. Fifth, on 9 points, and the model gives them a fair chance.'].concat(okBeats.slice(1))), facts, allowed, 'end_turn');
check('K4 a tag that is not lowercase words is refused, and a number inside it is not a fact', c.problems.some(p => /\[Sighs 2\] is not lowercase words/.test(p)) && !c.problems.some(p => /The number 2/.test(p)), c.problems.join(' | '));
const plain = okBeats.slice(1).map(b => b.replace(/\[[^\]]*\] /g, ''));   /* v3.28: at most two tags in a whole show, so the rest of the lines carry none here */
c = ctx.emtShowCheck(reply(['[sighs] Cold Palmers lose again badly.'].concat(plain)), facts, allowed, 'end_turn');
check('K5 a tag is not a word: five words plus a tag is five words (the floor), so it passes; four would not', c.problems.length === 0 && ctx.emtShowCheck(reply(['[sighs] Cold Palmers lose again.'].concat(plain)), facts, allowed, 'end_turn').problems.some(p => /4 words/.test(p)), c.problems.join(' | '));
const same = ctx.emtShowPunchSame(c.script, JSON.parse(JSON.stringify(c.script)));
check('K6 the punch-up may add a tag without changing the word count', same.length === 0 && (() => { const b = JSON.parse(JSON.stringify(c.script)); b.chapters[0].beats[4] = '[laughing] ' + b.chapters[0].beats[4]; return ctx.emtShowPunchSame(c.script, b).length === 0; })());
check('K7 the prompts tell the writers about the tags: sparse, where they land the joke (v3.28: one or two in a whole show)', /AUDIO TAGS/.test(ctx.EMT_SHOW_SYSTEM) && /at most one or two in the whole show/.test(ctx.EMT_SHOW_SYSTEM) && /never one on every line/.test(ctx.EMT_SHOW_SYSTEM) && /audio tag in square brackets/.test(ctx.EMT_PUNCH_SHOW_SYSTEM) && /at most two in the whole show/.test(ctx.EMT_PUNCH_SHOW_SYSTEM));
check('K8 a written script stores the default model as its label', ctx.emtShowSpoken(6, c.script, '2026-10-09T00:00:00Z', []).model === V4);

T.done();
