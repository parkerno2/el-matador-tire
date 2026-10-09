// v3.28 tests: the Gameweek Show's writer in dry British commentary (Parker, 9 Oct 2026: "British dry humour", "clever and
// stupid but witty", no jokes built on numbers, no whispering, about half the length). The voice bible and the punch-up's
// brief, the style lines from the approved GW6 script, beats of 6 to 18 words (hard 5 to 24), at most two subtle delivery
// tags in a whole show and never a whispered or raised voice, TONE.md's section, and the approved show/gw6.json passing
// the same rules.   node tests/codegs/v328.js
const T = require(__dirname + '/harness.js').make();
const { ctx, check, src } = T;
const fs = require('fs');
const SYS = ctx.EMT_SHOW_SYSTEM, PUNCH = ctx.EMT_PUNCH_SHOW_SYSTEM, TONE = ctx.EMT_TONE_LINES.join('\n');
const before = (x, a, b) => x.indexOf(a) > -1 && x.indexOf(b) > -1 && x.indexOf(a) < x.indexOf(b);

console.log('--- V the release');
check('V1 EMT_VERSION is v3.28 or later and the CHANGELOG has the entry', ctx.emtSelfVersion(src) === ctx.EMT_VERSION && ctx.emtSelfCmp(ctx.EMT_VERSION, 'v3.28') >= 0 && /\* v3\.28 · 9 Oct 2026\n \*   The Gameweek Show's writer in dry British commentary/.test(src));
check('V2 the limits: 6 to 18 words a beat, hard 5 to 24; at most 2 tags in a show, 2 a line; the ban covers whispering, shouting, yelling and screaming, not a pause or a sigh',
  ctx.EMT_SHOW_BEAT_WORDS.join() === '6,18' && ctx.EMT_SHOW_BEAT_HARD.join() === '5,24' && ctx.EMT_SHOW_TAGS_PER_SHOW === 2 && ctx.EMT_SHOW_TAGS_PER_LINE === 2 &&
  ['[whispering]', '[shouting]', '[yells]', '[screaming]', '[whispers]'].every(t => ctx.EMT_SHOW_TAG_BAN.test(t)) && ['[long pause]', '[sighs]', '[deadpan]', '[laughing]'].every(t => !ctx.EMT_SHOW_TAG_BAN.test(t)));

console.log('--- P the prompts');
check('P1 THE VOICE: dry British commentary, understatement and deadpan, the pundit cliche turned, real football references, setup then turn, never trying too hard; the five laughs stay', /THE VOICE\. Malcolm Tyre, a fictional British broadcaster in "the booth": dry British commentary\./.test(SYS) && /understatement, deadpan, a pundit's cliche turned on its owner, real football references \(managers, clubs, what the pundits say about them\)/.test(SYS) &&
  /Every beat is a setup, then the turn, in the last few words\./.test(SYS) && /Never try too hard: one turn a beat, no stacked gags, no explaining\./.test(SYS) && /make the group chat laugh at least five times\./.test(SYS));
check('P2 WHAT IS FUNNY: the season\'s storylines and the league\'s running jokes from FACTS, QUOTES and NOTES (the bench, the name, the investigation, the brothers\' derby); never a joke on a score, a margin, a form run, the table maths or a percentage, or how much someone lost by; a number never the punchline',
  /WHAT IS FUNNY\. The season's storylines and the league's own running jokes, taken from FACTS \(the names, the elevens, the flags, the fixtures\), QUOTES and NOTES/.test(SYS) && /a striker left on the bench while he makes team of the week; a club named after a player its manager does not own; an investigation into the leaders; the brothers' derby/.test(SYS) &&
  /Never build a joke on a score, a margin, a points total, a form run, the table maths or the model's percentages, and never on how much someone lost by: a number may appear in a beat as plain fact, never as the punchline\./.test(SYS));
check('P3 THE SHAPE keeps the five beats and the star codes; the open and close in the voice; 6 to 18 words a beat, a setup then the turn', /each exactly five beats, in this order/.test(SYS) && /star\.h is the code of the home player beat \[1\] is about/.test(SYS) &&
  SYS.includes('- open: 15 to 25 words. "Gameweek <n>." then one hook for the whole week, built on the storylines, not the numbers.') && SYS.includes('- close: a sign-off ("That\'s your lot." or "That\'s the gameweek."), the deadline day and lineups, then one last dry dig or a nudge to go on the record in the press room.') &&
  SYS.includes('\n- 6 to 18 words per beat: a setup, then the turn.\n') && !/10 to 22/.test(SYS) && /\[4\] the faceoff: the derby or the first meeting, the series \(rec\) said plainly, who the model favours in words; never the percentages or the predicted score as the joke\./.test(SYS));
check('P4 AUDIO TAGS: at most one or two in the whole show, subtle ones, never whispering or shouting, never on every line', /AUDIO TAGS .*Use at most one or two in the whole show, subtle ones only \(\[long pause\] before the turn, \[sighs\]\); never \[whispering\], \[shouting\] or any raised or lowered voice, and never one on every line: most lines carry none\./.test(SYS) && !/\[annoyed\], \[ecstatic\]/.test(SYS));
const LINES = ['"Kobbie Mainoo Fan. Top of the league, pending an independent commission."', '"Named after Kobbie Mainoo, who plays for Parker. Nobody\'s had the heart to tell Baha."', '"Not a flag among PJ\'s starters. Fully fit. Just shite."',
  '"Team Jacob. Kostoulas has made team of the week twice. From the bench. Twice."', '"Bruno Fernandes at home to Spurs. Arms already out."', '"I Am a Baleba. There is no Baleba. There has never been a Baleba."', '"Ethan, meanwhile, starts Leeds\' goalkeeper at the Emirates. Bold. Possibly a cry for help."'];
const STYLE = (SYS.match(/STYLE\.[^\n]*/) || [''])[0];   /* the tone block below it keeps its own examples (TONE.md, "What clever means") */
check('P5 STYLE: the seven lines from the approved GW6 show as the reference, the old three gone from the style line, still "never copy them"', LINES.every(l => STYLE.includes(l)) && /Lines from an approved show as a style reference only \(their facts are not this week's; never copy them\)/.test(STYLE) &&
  !/Gibbs-White tops the eleven/.test(STYLE) && !/Bad week to have named your club/.test(STYLE) && !/backup plan is also Haaland/.test(STYLE));
check('P6 the tone block stays after STYLE and before REPLY; no em or en dash anywhere in the prompt; the JSON shape unchanged', before(SYS, 'STYLE.', TONE) && before(SYS, TONE, 'REPLY with JSON only') && !/[—–]/.test(SYS) && /"beats":\["","","","",""\]/.test(SYS));
check('P7 the punch-up\'s brief: the dry voice, no joke built on a number, each beat 6 to 18 words, at most two tags in the whole show and never whispering or shouting; the tone block at the end', /dry British commentary, understatement and deadpan, a setup then the turn/.test(PUNCH) && /no joke built on a score, a margin, a form run, the table maths or a percentage \(a number may stay as plain fact, never as the punchline\), nothing that tries too hard/.test(PUNCH) &&
  PUNCH.includes('Each beat stays 6 to 18 words.') && /at most two in the whole show and never a whispering or shouting tag/.test(PUNCH) && PUNCH.endsWith(TONE) && !/[—–]/.test(PUNCH) && PUNCH.includes('Keep every fact, number (as digits), name, team name, player code, chapter, beat count and the JSON shape exactly'));

console.log('--- C the checks');
const facts = { gw: 6, fixtures: [{ home: 'Cold Palmers', away: 'Devils U21s', H: { xi: [{ code: '1' }] }, A: { xi: [{ code: '2' }] } }] };
const allowed = 'four 4 three 3';
const base = ['Cold Palmers. Parker built this app. It has been very honest with him.', 'Palmer, Rice, Mainoo and Jacquet all doubts. Less a team sheet, more a waiting room.', 'Devils U21s. Still no points. The youth project is taking its time.', 'Not a flag among the starters. Fully fit. Just shite.', 'Brother against brother. PJ leads the Nolan derby 4 to 3. Christmas should be fun.'];
const reply = (beats, open, close) => JSON.stringify({ open: open || 'Gameweek six. The leaders are under investigation and the bottom side has yet to win.', chapters: [{ home: 'Cold Palmers', away: 'Devils U21s', star: { h: '1', a: '2' }, beats }], close: close || 'That\'s your lot. Lineups in by Saturday morning.' });
const problems = (beats, open, close) => ctx.emtShowCheck(reply(beats, open, close), facts, allowed, 'end_turn').problems;
const wordsN = n => Array.from({ length: n }, (_, i) => (i % 2 ? 'the' : 'eleven')).join(' ') + '.';
const withBeat = b => [b].concat(base.slice(1));
check('C1 the approved kind of script passes', problems(base).length === 0, problems(base).join(' | '));
check('C2 beats of 5 and 24 words pass (the hard limits), 4 and 25 are refused and asked to keep to 6 to 18', problems(withBeat(wordsN(5))).length === 0 && problems(withBeat(wordsN(24))).length === 0 &&
  problems(withBeat(wordsN(25))).some(p => /25 words; keep every beat to 6 to 18\./.test(p)) && problems(withBeat(wordsN(4))).some(p => /4 words; keep every beat to 6 to 18\./.test(p)), problems(withBeat(wordsN(25))).join(' | '));
check('C3 a cut-off reply is asked for 6 to 18 words', /keep every beat to 6 to 18 words/.test(ctx.emtShowCheck('{"open":"Gamew', facts, allowed, 'max_tokens').problems[0]));
check('C4 two subtle tags in a show pass', problems(['[long pause] ' + base[0], base[1], '[sighs] ' + base[2], base[3], base[4]]).length === 0, problems(['[long pause] ' + base[0], base[1], '[sighs] ' + base[2], base[3], base[4]]).join(' | '));
check('C5 three tags in a show are refused, naming the count', problems(['[long pause] ' + base[0], '[sighs] ' + base[1], '[deadpan] ' + base[2], base[3], base[4]]).some(p => p === '3 audio tags in the show; at most 2 in a whole show, subtle ones only.'));
check('C6 a whispering or shouting tag is refused even on its own', problems(withBeat('[whispering] ' + base[0])).some(p => /The audio tag \[whispering\] is a whispered or raised voice; the show never whispers or shouts/.test(p)) && problems(withBeat('[shouting] ' + base[0])).some(p => /\[shouting\] is a whispered or raised voice/.test(p)) &&
  problems(withBeat('[yelling] ' + base[0])).some(p => /\[yelling\] is a whispered or raised voice/.test(p)), problems(withBeat('[whispering] ' + base[0])).join(' | '));
check('C7 the v3.26 rules stay: three tags on one line and a tag that is not lowercase words are refused', ctx.emtShowTagProblems(['[a] [b] [c] one line']).some(p => /3 audio tags; at most 2 a line/.test(p)) && ctx.emtShowTagProblems(['[Sighs 2] one line']).some(p => /\[Sighs 2\] is not lowercase words/.test(p)));
const checked = ctx.emtShowCheck(reply(base), facts, allowed, 'end_turn').script;
const grown = n => { const b = JSON.parse(JSON.stringify(checked)); b.chapters[0].beats[0] = wordsN(n); return ctx.emtShowPunchSame(checked, b); };
check('C8 the punch-up may not grow a beat past 18 words (19 refused, 18 allowed)', grown(19).some(p => /beat 0: 19 words; 18 at most\./.test(p)) && grown(18).length === 0, grown(19).join(' | '));

console.log('--- G the approved GW6 script obeys the same rules');
const gw6 = JSON.parse(fs.readFileSync(__dirname + '/../../show/gw6.json', 'utf8'));
const clips = ctx.emtShowClips(gw6), texts = clips.map(c => c.text), beats = clips.filter(c => /^c\d+b\d$/.test(c.key)).map(c => c.text);
const W = t => ctx.emtShowCaption(t).split(/\s+/).filter(Boolean).length;
check('G1 show/gw6.json: 4 chapters of 5 beats, 22 lines, every beat within the hard limits and most within 6 to 18', gw6.gw === 6 && gw6.chapters.length === 4 && gw6.chapters.every(c => c.beats.length === 5) && clips.length === 22 &&
  beats.every(b => W(b) >= ctx.EMT_SHOW_BEAT_HARD[0] && W(b) <= ctx.EMT_SHOW_BEAT_HARD[1]) && beats.filter(b => W(b) >= 6 && W(b) <= 18).length >= 18, beats.map(W).join(','));
check('G2 show/gw6.json: one subtle tag, no whispering, the tag rules pass; no em or en dash', ctx.emtShowTagProblems(texts).length === 0 && texts.join(' ').match(ctx.EMT_SHOW_TAG_RE).join() === '[long pause]' && !/[—–]/.test(texts.join(' ')), ctx.emtShowTagProblems(texts).join(' | '));
check('G3 show/gw6.json: the open is 15 to 25 words, the close signs off with "That\'s your lot."', W(gw6.open) >= 15 && W(gw6.open) <= 25 && /^That's your lot\./.test(gw6.close));
check('G4 show/gw6.json: every star code is in the chapter\'s star, every fixture of GW6 once', gw6.chapters.every(c => /^\d+$/.test(c.star.h) && /^\d+$/.test(c.star.a)) && new Set(gw6.chapters.map(c => c.home + '|' + c.away)).size === 4);

console.log('--- T TONE.md');
const tone = fs.readFileSync(__dirname + '/../../fplgg/tools/matchweek/docs/TONE.md', 'utf8');
check('T1 TONE.md carries the Gameweek Show section with Parker\'s words of 9 Oct, the number rule, the tag rule and the length', /## The Gameweek Show \(Parker, 9 Oct 2026\)/.test(tone) && /British dry humour/.test(tone) && /clever and stupid but witty/.test(tone) && /trying too hard/.test(tone) &&
  /never as the punchline/.test(tone) && /never whispering or shouting/i.test(tone) && /6 to 18 words/.test(tone) && !/[—–]/.test(tone));

T.done();
