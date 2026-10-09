// The Feed's Manager of the Month rules (Parker, 8 Oct 2026: "the feed leaves a bad first impression because it's sort
// of just talking about my manager of the month thing way too much"): fplgg/tools/matchweek/src/feed/curate.js, pure,
// and the wiring in build.js, social-posts.js and pages/feed.js; and an article leads only while it is fresh (Parker's
// Q3, 8 Oct 2026: the preview or recap card first on the Matchday rail and in For you's slot for its first 24 hours, then
// after the newest voice posts; the Feed by time, never pinned). Plain Node.   node tests/app-feed.js
const fs = require('fs'), vm = require('vm');
let fails = 0;
const check = (label, cond, info) => { if (!cond) fails++; console.log((cond ? 'PASS ' : 'FAIL ') + label + (info ? '  ' + info : '')); };
const MW = __dirname + '/../fplgg/tools/matchweek/';
const rd = f => fs.readFileSync(MW + f, 'utf8');
const ctx = { Object, Array, Boolean }; vm.createContext(ctx);
vm.runInContext(rd('src/feed/curate.js').replace(/^export (function|const|let)/gm, '$1') + '\n;this.__x = { isMotm, pickMotm, oneMotm, demote, artLeads, railOrder, ART_LEAD_H };', ctx);
const C = ctx.__x;

check('isMotm: Archizio\'s own post (kind motm) and any post built on a Manager of the Month claim (topic motm); nothing else', C.isMotm({ kind: 'motm' }) && C.isMotm({ kind: 'bold', topic: 'motm' }) && C.isMotm({ kind: 'presser', topic: 'motm' }) && !C.isMotm({ kind: 'presser' }) && !C.isMotm({ kind: 'bold', topic: undefined }) && !C.isMotm(null));

const W1 = { win: true, per: ['Aug & Sep', 1, 5], post: { id: 'motm:Aug & Sep', kind: 'motm' } };
const R2 = { win: false, per: ['October', 6, 9], post: { id: 'motmrace:October:6', kind: 'motm' } };
const W2 = { win: true, per: ['October', 6, 9], post: { id: 'motm:October', kind: 'motm' } };
check('pickMotm: nothing without candidates', C.pickMotm([], 5) === null && C.pickMotm(null, 5) === null);
check('pickMotm: a period\'s winner holds the slot while its last gameweek is the latest finished one (GW5 done, nothing of October played)', C.pickMotm([W1], 5) === W1.post);
check('pickMotm: the winner still holds it while the next gameweek is live (gwsDone 5, a live October race on offer)', C.pickMotm([W1, R2], 5) === W1.post);
check('pickMotm: once the next gameweek has finished the current race takes over', C.pickMotm([W1, R2], 6) === R2.post);
check('pickMotm: with no race on, the newest winner', C.pickMotm([W1], 7) === W1.post && C.pickMotm([W1, W2], 9) === W2.post && C.pickMotm([W1, W2], 12) === W2.post);
check('pickMotm: one post, never two', [C.pickMotm([W1, R2], 5), C.pickMotm([W1, R2], 6), C.pickMotm([W1, W2, R2], 9)].every(p => p && typeof p === 'object'));

const posts = [{ id: 'a', kind: 'ft' }, { id: 'b', kind: 'bold', topic: 'motm' }, { id: 'c', kind: 'presser', topic: 'motm' }, { id: 'd', kind: 'motm' }, { id: 'e', kind: 'remember', topic: 'motm' }, { id: 'f', kind: 'table' }];
check('oneMotm: one voice post on the subject (the first in list order), every quote and everything else kept', C.oneMotm(posts).map(p => p.id).join('') === 'abcf');
check('oneMotm: an empty or missing list is fine', C.oneMotm([]).length === 0 && C.oneMotm(null).length === 0);

const list = 'abcdefghijkl'.split('').map((id, i) => ({ id, kind: i === 2 || i === 5 ? 'motm' : 'x' }));
const d = C.demote(list, C.isMotm, 8).map(p => p.id).join('');
check('demote: the posts that match leave the first 8, which are topped up from the tail, then the moved ones, then the rest', d === 'abdeghijcfkl', d);
check('demote: nothing to move, the list as it was', C.demote(list.slice(6), C.isMotm, 8) === list.slice(6) || C.demote(list.slice(6), C.isMotm, 8).map(p => p.id).join('') === 'ghijkl');
check('demote: a match beyond the first screen stays where it is', C.demote([{ id: 'a', kind: 'x' }, { id: 'b', kind: 'motm' }], 1).map(p => p.id).join('') === 'ab');
check('demote: more matches than the tail can replace still keeps them after the head', C.demote([{ id: 'a', kind: 'motm' }, { id: 'b', kind: 'motm' }, { id: 'c', kind: 'x' }], C.isMotm, 8).map(p => p.id).join('') === 'cab');

/* ---------- the wiring ---------- */
const build = rd('src/feed/build.js'), social = rd('src/feed/social-posts.js'), feed = rd('src/pages/feed.js');
check('build.js collects every Manager of the Month candidate and pushes pickMotm\'s one post, with the topic', /import \{ pickMotm \} from '\.\/curate\.js'/.test(build) && (build.match(/motmCands\.push\(\{ win: (true|false), per, post: \{/g) || []).length === 2 && /const motmOne = pickMotm\(motmCands, D\.gwsDone\); if \(motmOne\) out\.push\(motmOne\);/.test(build) && (build.match(/kind: 'motm', topic: 'motm'/g) || []).length === 2 && !/out\.push\(\{\s*id: 'motm/.test(build));
check('social-posts.js: the quote, the bold call, the receipt, the pile-on and the running post carry topic motm when the claim is Manager of the Month', /const topicOf = q => \(q && q\.claim && q\.claim\.type === 'motm' \? 'motm' : undefined\);/.test(social) && (social.match(/topic: topicOf\(q\)/g) || []).length === 6);
check('feed.js: motm is out of ALWAYS and last in RANK', /const ALWAYS = new Set\(\[[^\]]*\]\)/.test(feed) && !/const ALWAYS = new Set\(\[[^\]]*'motm'[^\]]*\]\)/.test(feed) && /const RANK = \[[^\]]*'sheets', 'motm'\];/.test(feed));
check('feed.js: Everyone keeps one voice post on the subject and, on a first visit, none in the first screenful; For you keeps one too', /import \{ isMotm, oneMotm, demote, artLeads \} from '\.\.\/feed\/curate\.js'/.test(feed) && /return oneMotm\(posts\.filter\(p => keep\.has\(p\.id\)\)\);/.test(feed) && /if \(!v && VISIT && VISIT\.first\) posts = demote\(posts, isMotm, FIRST_SCREEN\);/.test(feed) && /const FIRST_SCREEN = 8;/.test(feed) && /const mine = oneMotm\(posts\.filter\(/.test(feed));

/* ---------- an article leads only while it is fresh (Q3) ---------- */
const now = Date.parse('2026-10-09T18:00:00Z'), ago = h => new Date(now - h * 3600e3).toISOString();
check('ART_LEAD_H is 24 hours', C.ART_LEAD_H === 24);
check('artLeads: an article published 23 hours ago leads; one published 25 hours ago does not', C.artLeads({ approved: ago(23) }, now) === true && C.artLeads({ approved: ago(25) }, now) === false);
check('artLeads: the edge (24 hours exactly does not lead, 23:59 does), a publish time in the future counts as fresh', C.artLeads({ approved: ago(24) }, now) === false && C.artLeads({ approved: ago(23.99) }, now) === true && C.artLeads({ approved: ago(-1) }, now) === true);
check('artLeads: no publish time (a built-in page), a bad one, or no article never leads', C.artLeads({ approved: '' }, now) === false && C.artLeads({ approved: 'soon' }, now) === false && C.artLeads({}, now) === false && C.artLeads(null, now) === false);
check('artLeads: the window can be set', C.artLeads({ approved: ago(30) }, now, 48) === true && C.artLeads({ approved: ago(30) }, now, 12) === false);
check('railOrder: the article first while it leads, after the posts once it does not, the posts alone without one', C.railOrder('A', ['p1', 'p2', 'p3'], true).join() === 'A,p1,p2,p3' && C.railOrder('A', ['p1', 'p2', 'p3'], false).join() === 'p1,p2,p3,A' && C.railOrder('', ['p1', 'p2'], true).join() === 'p1,p2' && C.railOrder('A', [], false).join() === 'A');
const ov = rd('src/pages/matchday/overview.js');
check('overview.js: the rail picks the article (articleFor), renders it (articleCard) and orders the cards with railOrder by artLeads at the time of rendering', /import \{ artLeads, railOrder \} from '\.\.\/\.\.\/feed\/curate\.js'/.test(ov) && /function articleFor\(\)/.test(ov) && /return \{ a, k: pv \? 'preview' : 'recap' \};/.test(ov) &&
  /const x = articleFor\(\), art = articleCard\(x\);/.test(ov) && /const cards = railOrder\(art, posts\.map\(p => \{/.test(ov) && /\}\)\.filter\(Boolean\), x && artLeads\(x\.a, Date\.now\(\)\)\);/.test(ov) && !/if \(art\) cards\.push\(art\);/.test(ov));
check('overview.js: the rail still carries the preview until the deadline and the recap until the next gameweek (what it carries is unchanged, only its place)', /const rc = R\.find\(r => r\.gw === D\.gw && D\.provOver\) \|\| R\.find\(r => r\.gw === D\.gwsDone\);/.test(ov) && /const pv = P\.find\(p => p\.gw === D\.gw && !D\.dlPassed\);/.test(ov) && /const posts = railPosts\(art \? 3 : 4\);/.test(ov));
check('feed.js: For you\'s article slot takes the newest article only while it leads; the article posts in Everyone keep their place by time (no pin, no hot)', /import \{ isMotm, oneMotm, demote, artLeads \} from '\.\.\/feed\/curate\.js'/.test(feed) && /const a0 = allArticles\(\)\[0\], a = a0 && artLeads\(a0, Date\.now\(\)\) \? a0 : null;/.test(feed) &&
  !/kind: 'article'[^\n]*pin: true/.test(build) && !/kind: 'article'[^\n]*hot: true/.test(build) && /out\.sort\(\(a, b\) => \(b\.hot \? 1 : 0\) - \(a\.hot \? 1 : 0\) \|\| b\.ts - a\.ts/.test(build));
check('build.js: a live article\'s post is timed by its publish time', /const at = dt\(a\.approved\) \|\| \(rec \? T\(gwDoneTime\(g\), 40\) : T\(buildUpTime\(g\), 60\)\)/.test(build) && /kind: 'article', ts: at, time: 'GW' \+ g \+ ' ' \+ lc/.test(build));

console.log(fails ? 'FAILED ' + fails : 'ALL PASS');
process.exit(fails ? 1 : 0);
