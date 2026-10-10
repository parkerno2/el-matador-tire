// The operator docs stay honest (ROADMAP C4): ARCHITECTURE.md, RUNBOOK.md and the root README name only files,
// workflows, Script Properties, functions, actions, tabs and menu items that exist in the repo, and carry no dash
// or emoji the house style forbids. Plain Node, no network.
//   node tests/app-docs.js
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
let fails = 0;
const check = (label, cond, info) => { if (!cond) fails++; console.log((cond ? 'PASS ' : 'FAIL ') + label + (info ? '  ' + info : '')); };
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const exists = p => fs.existsSync(path.join(ROOT, p));

const DOCS = ['fplgg/tools/matchweek/docs/ARCHITECTURE.md', 'fplgg/tools/matchweek/docs/RUNBOOK.md', 'README.md'];
const text = {}; DOCS.forEach(d => { text[d] = read(d); });
const all = DOCS.map(d => text[d]).join('\n');
const codegs = read('Code.gs');
const spans = s => { const out = []; const re = /`([^`\n]+)`/g; let m; while ((m = re.exec(s))) out.push(m[1]); return out; };

// 1. every path in backticks exists (placeholders, globs, URLs, query strings and the facts branch are skipped)
// a relative path resolves against the repo root, the app folder the docs live in, the site's pages, the Code.gs tests
// and the workflows folder; a path starting with / is a URL path (the Worker's /__worker), not a file
const BASES = ['', 'fplgg/tools/matchweek/', 'site/public/', 'tests/codegs/', '.github/workflows/'];
const looksLikePath = t => !/^https?:/.test(t) && !/^\//.test(t) && !/[<>*?=&{}]/.test(t) && !/\s/.test(t) && (t.includes('/') || /\.(md|js|gs|json|yml|html|sh|css|webmanifest|mjs|jsonc)$/.test(t));
DOCS.forEach(d => {
  const missing = [];
  spans(text[d]).forEach(span => span.split(/\s+/).forEach(t => {
    if (!looksLikePath(t) || /^facts\//.test(t)) return;
    const p = t.replace(/\/$/, '');
    if (!BASES.some(b => exists(b + p))) missing.push(t);
  }));
  check(path.basename(d) + ': every path named exists in the repo', missing.length === 0, missing.join(', '));
});

// 2. every Script Property and key named exists in Code.gs; the Worker's secret in worker.mjs
const props = Array.from(new Set((all.match(/EMT_[A-Z0-9_]+(?:<[a-z\-]+>)?/g) || []).map(p => p.replace(/<[a-z\-]+>$/, ''))));
const missingProps = props.filter(p => !codegs.includes(p));
check('every EMT_ Script Property named is in Code.gs (' + props.length + ')', missingProps.length === 0, missingProps.join(', '));
check('the two API keys are named as Code.gs names them', codegs.includes("'ANTHROPIC_API_KEY'") && codegs.includes("'ELEVENLABS_API_KEY'") && all.includes('`ANTHROPIC_API_KEY`') && all.includes('`ELEVENLABS_API_KEY`'));
check('the Worker secret is named as worker.mjs names it', read('site/worker.mjs').includes('GITHUB_TOKEN') && all.includes('`GITHUB_TOKEN`'));

// 3. the workflows: every file under .github/workflows is in ARCHITECTURE.md with the name its yml declares
const arch = text['fplgg/tools/matchweek/docs/ARCHITECTURE.md'];
const wfFiles = fs.readdirSync(path.join(ROOT, '.github/workflows')).filter(f => /\.ya?ml$/.test(f));
const wfMissing = wfFiles.filter(f => {
  const name = (read('.github/workflows/' + f).match(/^name:\s*(.+)$/m) || [])[1];
  return !name || !arch.includes('`.github/workflows/' + f + '`') || !arch.includes('| ' + name.trim() + ' |');
});
check('every workflow file is in ARCHITECTURE.md with its declared name (' + wfFiles.length + ')', wfMissing.length === 0, wfMissing.join(', '));

// 4. the Code.gs functions the docs name exist
const fns = ['setup', 'refreshAll', 'liveTick', 'aiTick', 'aiWriterTick', 'showWriterTick', 'showTick', 'articleTick', 'selfUpdateTick', 'emtHandle', 'liveWindow'];
const fnMissing = fns.filter(f => !new RegExp('^function ' + f + '\\(', 'm').test(codegs));
check('the Code.gs functions named exist (' + fns.length + ')', fnMissing.length === 0, fnMissing.join(', '));
const fnUnnamed = fns.filter(f => !all.includes('`' + f + '`') && !all.includes('`' + f + '()`'));
check('and each of them is named in the docs', fnUnnamed.length === 0, fnUnnamed.join(', '));

// 5. the POST actions: the set in ARCHITECTURE.md equals the set emtHandle switches on
const actions = Array.from(new Set((codegs.match(/action === '([a-z]+)'/g) || []).map(m => m.match(/'([a-z]+)'/)[1]))).sort();
const docActions = actions.filter(a => arch.includes('`' + a + '`'));
check('every POST action of emtHandle is named in ARCHITECTURE.md (' + actions.length + ')', docActions.length === actions.length && actions.length >= 10, actions.filter(a => !docActions.includes(a)).join(', '));

// 6. the tabs: every key of the app's TABS list is named in ARCHITECTURE.md
const tabsSrc = read('fplgg/tools/matchweek/src/data/tabs.js');
const tabsBlock = tabsSrc.slice(tabsSrc.indexOf('export const TABS = {'), tabsSrc.indexOf('};', tabsSrc.indexOf('export const TABS = {')));
const tabs = (tabsBlock.match(/^\s*('[^']+'|[A-Za-z0-9]+):\s*\[/gm) || []).map(l => l.trim().replace(/:\s*\[$/, '').replace(/^'|'$/g, ''));
const tabsMissing = tabs.filter(t => !arch.includes(t));
check('every tab the engine reads is named in ARCHITECTURE.md (' + tabs.length + ')', tabs.length >= 18 && tabsMissing.length === 0, tabsMissing.join(', '));

// 7. the menu items RUNBOOK.md names exist in Code.gs's onOpen
const menu = (codegs.match(/addItem\('([^']+)'/g) || []).map(m => m.match(/'([^']+)'/)[1]);
const run = text['fplgg/tools/matchweek/docs/RUNBOOK.md'];
const menuNamed = spans(run).filter(s => menu.includes(s));
const menuWrong = spans(run).filter(s => /^(Refresh|Run the|Render|Update Code|Articles:|Install)/.test(s) && !menu.includes(s));
check('the menu items RUNBOOK.md names are in Code.gs (' + menuNamed.length + ' named)', menuNamed.length >= 5 && menuWrong.length === 0, menuWrong.join(' | '));

// 8. the house style: no em or en dash, no emoji
DOCS.forEach(d => {
  check(path.basename(d) + ': no em or en dash', !/[–—]/.test(text[d]));
  check(path.basename(d) + ': no emoji', !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(text[d]));
});

// 9. the root README names every file in docs/
const docFiles = fs.readdirSync(path.join(ROOT, 'fplgg/tools/matchweek/docs')).filter(f => /\.md$/.test(f));
const readmeMissing = docFiles.filter(f => !text['README.md'].includes('fplgg/tools/matchweek/docs/' + f));
check('the root README names every doc (' + docFiles.length + ')', readmeMissing.length === 0, readmeMissing.join(', '));
check('the root README names the three branches', ['`main`', '`release`', '`facts`'].every(b => text['README.md'].includes(b)));

// 10. the app README points at the two new docs
check('the app README points at ARCHITECTURE.md and RUNBOOK.md', /docs\/ARCHITECTURE\.md/.test(read('fplgg/tools/matchweek/README.md')) && /docs\/RUNBOOK\.md/.test(read('fplgg/tools/matchweek/README.md')));

console.log(fails ? fails + ' FAILED' : 'ALL PASS');
process.exit(fails ? 1 : 0);
