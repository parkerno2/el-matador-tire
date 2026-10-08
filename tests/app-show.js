// Gameweek Show app tests (fplgg/tools/matchweek/src/feed/showsync.js): the audio contract with Code.gs v3.23 (only the
// clips rendered from the current lines are played; a stale or missing line plays as a timed caption), the caption clock
// (each word at its real start time when the clip carries them, the share of the clip played otherwise) and where the
// show sits on Matchday and in the Feed. Plain Node: the module is loaded in a vm.   node tests/app-show.js
const fs = require('fs'), vm = require('vm');
let fails = 0;
const check = (label, cond, info) => { if (!cond) fails++; console.log((cond ? 'PASS ' : 'FAIL ') + label + (info ? '  ' + info : '')); };
const src = fs.readFileSync(__dirname + '/../fplgg/tools/matchweek/src/feed/showsync.js', 'utf8').replace(/^export (function|const|let)/gm, '$1');
const ctx = { console, JSON, Math, Number, Array, Object, isFinite };
vm.createContext(ctx);
vm.runInContext(src + '\n;this.__x = { parseShow, wordsOn, wordsByShare, showSlot, LEAD };', ctx);
const { parseShow, wordsOn, wordsByShare, showSlot, LEAD } = ctx.__x;

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
check('complete is true only when the server says exactly true', parseShow({ ok: true, clips: { a: { b64: 'AA' } }, complete: 1 }).complete === false && parseShow({ ok: true, clips: { a: { b64: 'AA' } }, complete: true }).complete === true);

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

console.log('--- the player and the pages use it');
const play = fs.readFileSync(__dirname + '/../fplgg/tools/matchweek/src/feed/showplay.js', 'utf8');
check('showplay.js takes the server\'s answer through parseShow and keeps w per clip', /import \{ parseShow, wordsOn, wordsByShare \} from '\.\/showsync\.js'/.test(play) && /const P = parseShow\(r\);/.test(play) && /if \(c\.w\) words\[k\] = c\.w;/.test(play) && /return \{ urls, durs, words, from: 'sheet', complete: P\.complete/.test(play));
check('the caption clock in tick(): word times when the clip has them, the share otherwise', /const k = wt && Q\.useAudio \? wordsOn\(wt, n, Q\.A\.currentTime, spoken\) : wordsByShare\(spoken, n\);/.test(play) && !/Math\.ceil\(spoken \* n \* 1\.08\)/.test(play));
check('a clip the server did not send plays as a timed caption (useAudio follows the url)', /Q\.useAudio = !!url;/.test(play) && /const d = \(Q\.au && Q\.au\.durs && Q\.au\.durs\[it\.clip\]\) \? Q\.au\.durs\[it\.clip\] \* 1000 : est\(it\);/.test(play));
check('a partly re-voiced show says so in the foot', /Some lines are being re-voiced/.test(play));
const ov = fs.readFileSync(__dirname + '/../fplgg/tools/matchweek/src/pages/matchday/overview.js', 'utf8');
const ren = ov.slice(ov.indexOf('export function render()'));
check('Matchday: the show card comes before the matchup, with Malcolm\'s picture and the replay row after the deadline', /^\s*return showCard\(\)\n\s*\+ UI\.sh\(featured/m.test(ren) && /showSlot\(s, D\)/.test(ov) && /pic\('malcolm', 44\)/.test(ov) && /md-show-re/.test(ov) && /Replay the Gameweek/.test(ov) && !/showBanner/.test(ov));
const fd = fs.readFileSync(__dirname + '/../fplgg/tools/matchweek/src/pages/feed.js', 'utf8');
check('Feed: the show pinned at the top of Everyone and For you, once (not again in the stream)', /return pin \+ \(v \? voiceHero/.test(fd) && /return pin \+ inbox \+ UI\.sh\('For ' \+ you\)/.test(fd) && /posts\.filter\(p => p\.id !== 'show:' \+ D\.gw\)/.test(fd) && /latestArticle\(!!pin\)/.test(fd));
check('Feed: the Show entry leads the voice rail, Malcolm\'s picture with a play badge, one tap opens it', /class="fst fst-show" data-fx="show:' \+ sv\.gw \+ '"/.test(fd) && /avatarInner\('malcolm'\)/.test(fd) && /fst-play/.test(fd) && /aria-label="Watch the Gameweek/.test(fd));
const css = fs.readFileSync(__dirname + '/../fplgg/tools/matchweek/src/css/55-show.css', 'utf8');
check('the styles exist and keep to the purple and blue tokens, no emoji', /\.md-showc\{/.test(css) && /\.fst-play\{/.test(css) && /\.md-show-re\{/.test(css) && !/[\u{1F300}-\u{1FAFF}]/u.test(css));
const plate = fs.readFileSync(__dirname + '/../fplgg/tools/matchweek/src/feed/showplay.js', 'utf8');
check('no emoji in the player or the pages', ![plate, ov, fd].some(t => /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(t)));

console.log(fails ? fails + ' FAILED' : 'ALL PASS');
process.exit(fails ? 1 : 0);
