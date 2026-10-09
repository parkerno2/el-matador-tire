// Gameweek Show app tests (fplgg/tools/matchweek/src/feed/showsync.js): the audio contract with Code.gs v3.23 (only the
// clips rendered from the current lines are played; a stale or missing line plays as a timed caption), the caption clock
// (each word at its real start time when the clip carries them, the share of the clip played otherwise), where the
// show sits on Matchday and in the Feed, and the rule of 9 Oct 2026 (Parker: "I don't want a non-voice preview to be
// the first thing they see"): a show appears only when every line has a current voiced take; a member sees nothing
// until then, the commissioner one line; a rewrite that makes the takes stale hides it again. Plain Node: the module
// is loaded in a vm.   node tests/app-show.js
const fs = require('fs'), vm = require('vm');
let fails = 0;
const check = (label, cond, info) => { if (!cond) fails++; console.log((cond ? 'PASS ' : 'FAIL ') + label + (info ? '  ' + info : '')); };
const src = fs.readFileSync(__dirname + '/../fplgg/tools/matchweek/src/feed/showsync.js', 'utf8').replace(/^export (function|const|let)/gm, '$1');
const ctx = { console, JSON, Math, Number, Array, Object, isFinite };
vm.createContext(ctx);
vm.runInContext(src + '\n;this.__x = { parseShow, wordsOn, wordsByShare, showSlot, LEAD, stripTags, TAG_RE, showKeys, showVoiced, showServed, showPlayable, showNote, showNoteHTML };', ctx);
const { parseShow, wordsOn, wordsByShare, showSlot, LEAD, stripTags, TAG_RE, showKeys, showVoiced, showServed, showPlayable, showNote, showNoteHTML } = ctx.__x;

console.log('--- the server\'s answer');
const r = { ok: true, gw: 6, clips: { open: { secs: 7.55, hash: 'a', b64: 'AAAA', w: [0, 0.42, 0.81] }, c1b0: { secs: 4.58, hash: 'b', b64: 'BBBB' } }, complete: false, stale: ['c1b1'], missing: ['c1b2'] };
let P = parseShow(r);
check('only clips with audio come through, with secs and w when present', P && Object.keys(P.clips).join() === 'open,c1b0' && P.clips.open.secs === 7.55 && JSON.stringify(P.clips.open.w) === '[0,0.42,0.81]' && P.clips.c1b0.w === null && P.clips.c1b0.secs === 4.58);
check('complete, stale and missing are carried as the server said them', P.complete === false && P.stale.join() === 'c1b1' && P.missing.join() === 'c1b2');
check('a stale line has no clip at all, so the player falls back to its timed caption', !('c1b1' in P.clips) && !('c1b2' in P.clips));
check('a clip without b64, an empty b64 or a junk entry is left out', Object.keys(parseShow({ ok: true, clips: { a: { b64: 'AA' }, b: { secs: 3 }, c: { b64: '' }, d: null, e: 'x' } }).clips).join() === 'a');
check('bad w (a string, a negative time, an empty list) is dropped, the clip kept', (() => { const q = parseShow({ ok: true, clips: { a: { b64: 'AA', w: ['0', '1'] }, b: { b64: 'AA', w: [0, -1] }, c: { b64: 'AA', w: [] } } }); return q.clips.a.w === null && q.clips.b.w === null && q.clips.c.w === null; })());
check('a server with nothing to play (no fresh clip, an error, no answer) is null', parseShow({ ok: true, clips: {}, complete: false, stale: ['open'] }) === null && parseShow({ ok: false, error: 'badgw' }) === null && parseShow(null) === null && parseShow({ ok: true }) === null);
check('secs that are missing or not a number read as 0 (the player then uses its estimate)', parseShow({ ok: true, clips: { a: { b64: 'AA' }, b: { b64: 'AA', secs: 'x' } } }).clips.a.secs === 0 && parseShow({ ok: true, clips: { b: { b64: 'AA', secs: 'x' } } }).clips.b.secs === 0);
check('each clip keeps its hash (a string), so a rewrite can be told from the takes seen at load', P.clips.open.hash === 'a' && P.clips.c1b0.hash === 'b' && parseShow({ ok: true, clips: { a: { b64: 'AA', hash: 7 } } }).clips.a.hash === null);
check('complete is true only when the server says exactly true', parseShow({ ok: true, clips: { a: { b64: 'AA' } }, complete: 1 }).complete === false && parseShow({ ok: true, clips: { a: { b64: 'AA' } }, complete: true }).complete === true);

console.log('--- audio tags (Code.gs v3.26): voiced, never captioned');
check('a tag before the words it shapes is stripped and the spaces tidied', stripTags('Fully fit. [deadpan] Just shite.') === 'Fully fit. Just shite.' && stripTags('[whispering] Monday needs names.') === 'Monday needs names.');
check('two tags on a line, a tag with spaces, a tag at the end', stripTags('[sighs] One. [long pause] Two. [laughing]') === 'One. Two.');
check('a line without tags is unchanged apart from tidied spaces; empty, null and undefined are empty', stripTags('Gameweek six.  Here we go.') === 'Gameweek six. Here we go.' && stripTags('') === '' && stripTags(null) === '' && stripTags(undefined) === '');
check('the caption word count matches the Words the server builds from the caption text (one time per caption word)', stripTags('Fully fit. [deadpan] Just shite.').split(/\s+/).length === 4);
check('square brackets that are not a tag pair are left alone', stripTags('a [ b') === 'a [ b' && stripTags('a ] b') === 'a ] b');
check('TAG_RE is the same shape as Code.gs EMT_SHOW_TAG_RE', String(TAG_RE) === '/\\[[^\\[\\]]*\\]/g');

console.log('--- the caption clock');
const w = [0, 0.5, 1.2, 1.9];
check('before the clip starts: the first word is already up (the lead)', wordsOn(w, 4, 0, 0) === 1);
check('at 0.3 s: one word; at 0.5 s: two; a touch before 1.2 s (the lead): three; at 1.0 s still two', wordsOn(w, 4, 0.3, 0) === 1 && wordsOn(w, 4, 0.5, 0) === 2 && wordsOn(w, 4, 1.2 - LEAD, 0) === 3 && wordsOn(w, 4, 1.0, 0) === 2);
check('after the last word: all of them, never more', wordsOn(w, 4, 5, 1) === 4 && wordsOn(w, 4, 100, 1) === 4);
check('the lead is small (under a quarter of a second)', LEAD > 0 && LEAD < 0.25);
check('word times that do not match the word count fall back to the share played', wordsOn([0, 1], 4, 0, 0.5) === wordsByShare(0.5, 4) && wordsOn(null, 4, 0, 0.5) === wordsByShare(0.5, 4));
check('the share clock: 0 at the start, every word by the end, a little ahead in between, capped at n', wordsByShare(0, 10) === 0 && wordsByShare(1, 10) === 10 && wordsByShare(0.5, 10) === 6 && wordsByShare(2, 10) === 10 && wordsByShare(-1, 10) === 0 && wordsByShare(NaN, 10) === 0);
check('no words: 0', wordsOn(w, 0, 3, 1) === 0 && wordsByShare(1, 0) === 0);

console.log('--- where the show sits');
const s6 = { gw: 6 };
check('this gameweek, before the deadline: the card', showSlot(s6, { gw: 6, dlPassed: false, provOver: false }) === 'card');
check('after the deadline, until the gameweek is over: the replay row', showSlot(s6, { gw: 6, dlPassed: true, provOver: false }) === 'replay');
check('the gameweek over: nothing on Matchday (Feed → Articles keeps it)', showSlot(s6, { gw: 6, dlPassed: true, provOver: true }) === null);
check('another gameweek\'s show, no show, or no data: nothing', showSlot({ gw: 5 }, { gw: 6, dlPassed: false, provOver: false }) === null && showSlot(null, { gw: 6 }) === null && showSlot(s6, null) === null && showSlot(s6, { gw: 0 }) === null);

console.log('--- voiced or hidden (Parker, 9 Oct 2026)');
const J = (n = 2) => ({ gw: 6, open: 'o', close: 'c', chapters: Array.from({ length: n }, (_, i) => ({ home: 'A' + i, away: 'B' + i, beats: ['one', 'two', 'three'] })) });
const K = showKeys(J());
check('the clip keys of a script, in play order', K.join() === 'open,c1b0,c1b1,c1b2,c2b0,c2b1,c2b2,close' && showKeys(null).length === 0 && showKeys({ chapters: 'x' }).length === 0);
const metaOf = (keys, complete, extra) => ({ ok: true, gw: 6, clips: Object.fromEntries(keys.map((k, i) => [k, { secs: 3 + i, hash: 'h' + k, w: [0] }])), complete, stale: [], missing: [], ...extra });
let V = showVoiced(J(), metaOf(K, true), null);
check('a complete show (every line with a current take, complete true): ready, 8 of 8, the hashes kept', V.ready && V.voiced === 8 && V.expected === 8 && V.hashes.open === 'hopen' && Object.keys(V.hashes).length === 8);
V = showVoiced(J(), metaOf(K.slice(0, 3), false), null);
check('a partial show (3 of 8 voiced): not ready, the count for the commissioner line', !V.ready && V.voiced === 3 && V.expected === 8);
V = showVoiced(J(), metaOf(K, false), null);
check('every clip there but the server says not complete (a rewrite landing): hidden, the server is the judge', !V.ready && V.voiced === 8);
V = showVoiced(J(), metaOf(K.slice(0, 7), true), null);
check('the server says complete but a clip of this script is missing: hidden (the same test as clips equal expected)', !V.ready && V.voiced === 7);
check('no answer from the server (offline, the demo, no API URL): hidden, 0 of 8', (() => { const v = showVoiced(J(), null, null); return !v.ready && v.voiced === 0 && v.expected === 8; })());
check('an answer with an error, no clips or a clip without secs counts nothing', !showVoiced(J(), { ok: false }, null).ready && showVoiced(J(), { ok: true, clips: { open: { hash: 'x' } }, complete: true }, null).voiced === 0);
const dur = Object.fromEntries(K.map((k, i) => [k, 2 + i]));
check('a show voiced in the repo (GW4: a measured length per clip): ready without the server', showVoiced(J(), null, dur).ready && showVoiced(J(), null, dur).voiced === 8);
check('a repo show with a clip missing its length: hidden', !showVoiced(J(), null, { ...dur, close: 0 }).ready && showVoiced(J(), null, { ...dur, close: 0 }).voiced === 7);
check('a script with no lines: not ready, nothing to count', !showVoiced({ gw: 6, chapters: [] }, metaOf([], true), null).ready);
console.log('--- the stale rewrite');
const seen = V = showVoiced(J(), metaOf(K, true), null).hashes;
check('the same takes still served: the version seen at load plays on', showServed(seen, Object.fromEntries(K.map(k => [k, 'h' + k]))));
check('a rewrite changed the takes (new hashes): the old version is not played under the new audio', !showServed(seen, Object.fromEntries(K.map(k => [k, 'h' + k + 'x']))) && !showServed(seen, Object.fromEntries(K.slice(0, 7).map(k => [k, 'h' + k]))) && !showServed(seen, null));
check('nothing seen at load (a repo show) passes', showServed({}, null) && showServed(null, {}));
const S6 = { gw: 6, j: J(), clips: K, hashes: seen };
const au = (keys, from, complete, hashes) => ({ urls: Object.fromEntries(keys.map(k => [k, 'blob:' + k])), durs: {}, from, complete, hashes: hashes || Object.fromEntries(keys.map(k => [k, 'h' + k])), stale: [], missing: [] });
check('the player: a complete sheet answer with the same takes plays', showPlayable(S6, au(K, 'sheet', true)));
check('the player: a sheet answer not complete, a clip missing, or the takes rewritten does not play', !showPlayable(S6, au(K, 'sheet', false)) && !showPlayable(S6, au(K.slice(0, 7), 'sheet', true)) && !showPlayable(S6, au(K, 'sheet', true, Object.fromEntries(K.map(k => [k, 'new' + k])))));
check('the player: no answer does not play; repo clips play when every key has one', !showPlayable(S6, null) && showPlayable({ gw: 4, j: J(), clips: K, hashes: {} }, au(K, 'repo')) && !showPlayable({ gw: 4, j: J(), clips: K, hashes: {} }, au(K.slice(1), 'repo')));
console.log('--- the commissioner line');
check('the line, exactly', showNote({ gw: 6, voiced: 3, expected: 22 }) === 'Gameweek 6 show: being voiced, 3 of 22 lines');
check('its markup: one quiet paragraph with the dot, no emoji, no dash', showNoteHTML({ gw: 6, voiced: 0, expected: 22 }) === '<p class="show-note"><i></i>Gameweek 6 show: being voiced, 0 of 22 lines</p>' && !/[\u2013\u2014]/.test(showNoteHTML({ gw: 6, voiced: 0, expected: 22 })));

console.log('--- the player and the pages use it');
const play = fs.readFileSync(__dirname + '/../fplgg/tools/matchweek/src/feed/showplay.js', 'utf8');
check('showplay.js captions every line through stripTags (open, the beats, close), so a tag is never on screen', /cap: stripTags\(s\.j\.open\)/.test(play) && /cap: stripTags\(t\)/.test(play) && /cap: stripTags\(s\.j\.close\)/.test(play) && !/cap: s\.j\.open\b/.test(play) && !/cap: t \}/.test(play));
check('showplay.js takes the server\'s answer through parseShow and keeps w and the hash per clip', /import \{ parseShow, wordsOn, wordsByShare, stripTags, showPlayable, showNote \} from '\.\/showsync\.js'/.test(play) && /const P = parseShow\(r\);/.test(play) && /if \(c\.w\) words\[k\] = c\.w; if \(c\.hash\) hashes\[k\] = c\.hash;/.test(play) && /return \{ urls, durs, words, hashes, from: 'sheet', complete: P\.complete/.test(play));
check('the caption clock in tick(): word times when the clip has them, the share otherwise', /const k = wt && Q\.useAudio \? wordsOn\(wt, n, Q\.A\.currentTime, spoken\) : wordsByShare\(spoken, n\);/.test(play) && !/Math\.ceil\(spoken \* n \* 1\.08\)/.test(play));
check('the player plays only a playable answer and closes with one line otherwise: no captions-only show, no re-voice note', /if \(!showPlayable\(s, au\)\) \{ close\(true\); UI\.toast\(notReady\(s, au\)\); return; \}/.test(play) && !/Captions only for now/.test(play) && !/Some lines are being re-voiced/.test(play) && !/setTimeout\(\(\) => start\(null\), 5000\)/.test(play));
check('the line when it cannot play: the voicing count, a new version to reload for, or that it could not load', /showNote\(\{ gw: s\.gw, voiced: n, expected: exp \}\)/.test(play) && /has a new version\. Reload to watch it\./.test(play) && /could not load\. Try again\./.test(play));
const facts = fs.readFileSync(__dirname + '/../fplgg/tools/matchweek/src/feed/facts.js', 'utf8');
check('facts.js: shows() lists only the ready shows, showPending the rest, judged by showVoiced from the repo lengths or the meta answer', /export const shows = \(\) => Object\.values\(SHOWS\)\.filter\(s => s && s\.ready\)/.test(facts) && /export const showPending = gw =>/.test(facts) && /const V = showVoiced\(j, m, repoVoiced\(j\) \? j\.dur : null\);/.test(facts) && /ready: V\.ready, voiced: V\.voiced, expected: V\.expected, hashes: V\.hashes/.test(facts));
check('facts.js asks the server for every sheet-voiced script (not only this gameweek\'s), so an older show stays judged', /if \(repoVoiced\(j\)\) return \{ j, m: null \};/.test(facts) && /return meta\(g\)\.then\(m =>/.test(facts) && /show=' \+ g \+ '&meta=1'/.test(facts));
const ov = fs.readFileSync(__dirname + '/../fplgg/tools/matchweek/src/pages/matchday/overview.js', 'utf8');
const ren = ov.slice(ov.indexOf('export function render()'));
check('Matchday: the show card comes before the matchup, with Malcolm\'s picture and the replay row after the deadline', /^\s*return showCard\(\)\n\s*\+ UI\.sh\(featured/m.test(ren) && /showSlot\(s, D\)/.test(ov) && /pic\('malcolm', 44\)/.test(ov) && /md-show-re/.test(ov) && /Replay the Gameweek/.test(ov) && !/showBanner/.test(ov));
check('Matchday: without a ready show, the commissioner\'s line in its place and nothing for a member', /const p = showPending\(D\.gw\); return p && isCommishTeam\(\) && showSlot\(\{ gw: D\.gw \}, D\) \? showNoteHTML\(p\) : '';/.test(ov));
const fd = fs.readFileSync(__dirname + '/../fplgg/tools/matchweek/src/pages/feed.js', 'utf8');
check('Feed: the show pinned at the top of Everyone and For you, once (not again in the stream)', /return pin \+ \(v \? voiceHero/.test(fd) && /return pin \+ inbox \+ UI\.sh\('For ' \+ you\)/.test(fd) && /posts\.filter\(p => p\.id !== 'show:' \+ D\.gw\)/.test(fd) && /latestArticle\(!!pin\)/.test(fd));
check('Feed: the Show entry leads the voice rail, Malcolm\'s picture with a play badge, one tap opens it', /class="fst fst-show" data-fx="show:' \+ sv\.gw \+ '"/.test(fd) && /avatarInner\('malcolm'\)/.test(fd) && /fst-play/.test(fd) && /aria-label="Watch the Gameweek/.test(fd));
check('Feed: the commissioner\'s line in the pinned slot and under Articles while the show is being voiced', /function showNoteFor\(\)/.test(fd) && /return p && isCommishTeam\(\) && showSlot\(\{ gw: D\.gw \}, D\) \? showNoteHTML\(p\) : '';/.test(fd) && /if \(!g\) return showNoteFor\(\);/.test(fd) && /S\.length \|\| showNoteFor\(\) \? UI\.sh\('The Gameweek Show'\) \+ showNoteFor\(\) \+ S\.map/.test(fd));
const arts = fs.readFileSync(__dirname + '/../fplgg/tools/matchweek/src/feed/articles.js', 'utf8');
check('articles.js: isCommishTeam reads the signed-in team against the commissioner the app already knows (no round trip)', /export function isCommishTeam\(\) \{ const a = auth\(\), c = commish\(\); return !!\(a && c && a\.team === c\); \}/.test(arts));
const bld = fs.readFileSync(__dirname + '/../fplgg/tools/matchweek/src/feed/build.js', 'utf8');
check('build.js: the Feed post comes from shows(), so a show being voiced has no post', /shows\(\)\.forEach\(s => \{/.test(bld) && !/showPending/.test(bld));
const css = fs.readFileSync(__dirname + '/../fplgg/tools/matchweek/src/css/55-show.css', 'utf8');
check('the styles exist and keep to the purple and blue tokens, no emoji', /\.md-showc\{/.test(css) && /\.fst-play\{/.test(css) && /\.md-show-re\{/.test(css) && /\.show-note\{/.test(css) && /\.show-note i\{[^}]*var\(--p300\)/.test(css) && !/[\u{1F300}-\u{1FAFF}]/u.test(css));
check('no emoji in the player or the pages', ![play, ov, fd, facts].some(t => /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(t)));

console.log(fails ? fails + ' FAILED' : 'ALL PASS');
process.exit(fails ? 1 : 0);
