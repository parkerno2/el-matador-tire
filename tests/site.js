// matchweek.gg's setup wizard and landing page (site/public/setup.html, index.html): until a second league can really
// be served (ROADMAP C2 and B3) the wizard claims nothing is live and sends nobody to the app, and the landing page's
// promises match what happens (S1, 11 Oct 2026, from the release-readiness review). Plain Node, no network.
//   node tests/site.js
const fs = require('fs');
let fails = 0;
const check = (label, cond, info) => { if (!cond) fails++; console.log((cond ? 'PASS ' : 'FAIL ') + label + (!cond && info ? '  ' + info : '')); };
const read = p => fs.readFileSync(__dirname + '/../' + p, 'utf8');
/* the page without its comments (an HTML comment, a block comment, a line comment), so a dash in a comment is not UI text */
const copy = html => html.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/[^\n]*$/gm, '');

const setup = read('site/public/setup.html'), setupCopy = copy(setup);
check('setup.html: nothing is called live, and nobody is sent to app.html', !/is live|goes live|clubhouse goes live|puts it live|live at its own/i.test(setupCopy) && !/app\.html|APP_HOME/.test(setup));
check('setup.html: Create saves the league to the beta list and says we email when it is ready, with the demo as the thing to look at meanwhile', /is on the list\.<\/b> We will email you when your league is ready\./.test(setup) && /href="demo\/"/.test(setup) && /Leagues are switched on by hand, one at a time, and we email you when yours is ready\. Nothing is switched on from this page\./.test(setup));
check('setup.html: the register call stays (the list is the leagues table), the note from the server is not shown as a promise', /REG_BASE \+ '\/register-league'/.test(setup) && !/esc\(j\.note/.test(setup));
check('setup.html: no em or en dash in the page\'s copy or strings (comments aside)', !/[–—]/.test(setupCopy), (setupCopy.match(/[^\n]{0,40}[–—][^\n]{0,40}/g) || []).join(' | '));
check('setup.html: the placeholder names no real league id', !/45380/.test(setup));

const index = read('site/public/index.html'), indexCopy = copy(index);
check('index.html: the two-minute and sorted-before-the-season claims are gone, and the hero does not say pasting an id gets the app', !/Two minutes|Sorted before the season starts|Paste your league ID and every manager gets/.test(index));
check('index.html: the beta card says leagues are switched on by hand and we email when ready', /Leagues are switched on by hand, one at a time\. We email you when yours is ready\./.test(index) && /once your league is set up, every manager gets the app/.test(index));
check('index.html: no em or en dash in the copy (comments aside)', !/[–—]/.test(indexCopy), (indexCopy.match(/[^\n]{0,40}[–—][^\n]{0,40}/g) || []).join(' | '));
check('app.html still forwards to the demo, so an old link lands somewhere honest', /url=demo\//.test(read('site/public/app.html')));
check('CLAUDE.md and the tests README name this suite', /tests\/site\.js/.test(read('CLAUDE.md')) && /site\.js/.test(read('tests/README.md')));

console.log(fails ? fails + ' FAILED' : 'ALL PASS');
process.exit(fails ? 1 : 0);
