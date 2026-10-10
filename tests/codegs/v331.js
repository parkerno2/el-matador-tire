// v3.31 tests: the Player of the Month month is written as text (an outage fix, 10 Oct 2026). v3.30's first write put
// 'September 2026' into the Specials tab and Sheets parsed it into a date, so gviz without headers=1 took two rows as
// the header and served the API URL as null: the Monitor opened a false outage issue (#2) and ?health=1 potm.month read
// a Date's string. Now every Value write sets the plain-text format first, a Date in the month cell is rewritten as the
// text of the same month before anything else, and health reads a Date cell as that text.   node tests/codegs/v331.js
const T = require(__dirname + '/harness.js').make();
const { ctx, check, src, sheets, props, logs } = T;
const Sheet = T.Sheet;

const FILE = { month: 'September 2026', code: 60307, player: 'Groß', club: 'BHA', sources: ['https://www.si.com/x', 'https://www.ysscores.com/y'] };
let file = FILE;
const realFetch = ctx.UrlFetchApp.fetch;
ctx.UrlFetchApp.fetch = (url, o) => url.indexOf(ctx.EMT_POTM_SRC) === 0 ? T.resp(200, JSON.stringify(file)) : realFetch(url, o);
sheets.Players = new Sheet('Players', [['Code', 'Player', 'Pos', 'Club', 'Owner', 'Status', 'News', 'Draft rank', 'Season pts', 'Mins', 'Form', 'xGI', 'EP next', 'Proj', 'Nation', 'Full name'],
  [223094, 'Haaland', 'FWD', 'MCI', 'Cold Palmers', 'a', '', 1, 61, 450, 9.1, 0.9, 8.4, 210, 'NO', 'Erling Haaland'],
  [60307, 'Groß', 'MID', 'BHA', 'Devils U21s', 'a', '', 165, 53, 540, 12.3, 2.83, 12.3, 95, 'DE', 'Pascal Groß']]);
const specials = (player, month) => new Sheet('Specials', [['Setting', 'Value'], ['POTM player', player], ['POTM month', month], ['API URL', 'https://script.google.com/macros/s/X/exec']]);
const cell = setting => { const r = sheets.Specials.rows.find(r => r[0] === setting); return r ? r[1] : undefined; };
const fmt = setting => { const i = sheets.Specials.rows.findIndex(r => r[0] === setting); return (sheets.Specials.formats || {})[(i + 1) + ',2']; };
const state = () => JSON.parse(props.EMT_POTM || '{}');
const reset = () => { logs.length = 0; delete props.EMT_POTM; file = FILE; };
const health = () => T.get({ health: '1' }).potm;
/* what Sheets made of 'September 2026': the first of the month on the script's clock */
const sept = () => new Date(2026, 8, 1), oct = () => new Date(2026, 9, 1);

console.log('--- V the release');
check('V1 EMT_VERSION is v3.31 or later and the CHANGELOG has the entry', ctx.emtSelfVersion(src) === ctx.EMT_VERSION && ctx.emtSelfCmp(ctx.EMT_VERSION, 'v3.31') >= 0 && /\* v3\.31 · 10 Oct 2026\n \*   The Player of the Month month is written as text/.test(src));
check('V2 every Value write goes through emtPotmSetText, which sets the plain-text format before the value', /function emtPotmSetText\(sh, row, text\) \{ sh\.getRange\(row, 2\)\.setNumberFormat\('@'\)\.setValue\(text\); \}/.test(src) && /emtPotmSetText\(sh, pi, name\);\n  emtPotmSetText\(sh, mi, f\.month\);/.test(src) && !/getRange\((pi|mi), 2\)\.setValue\(/.test(src));

console.log('--- T the month as text');
check('T1 a string is trimmed', ctx.emtPotmMonthText(' September 2026 ') === 'September 2026' && ctx.emtPotmMonthText('') === '' && ctx.emtPotmMonthText(null) === '' && ctx.emtPotmMonthText(undefined) === '');
check('T2 a Date reads as <Month> <YYYY>', ctx.emtPotmMonthText(sept()) === 'September 2026' && ctx.emtPotmMonthText(new Date(2026, 0, 15)) === 'January 2026' && ctx.emtPotmMonthText(new Date(2025, 11, 31)) === 'December 2025');
check('T3 an invalid Date reads as its string, never as NaN NaN', !/NaN/.test(ctx.emtPotmMonthText(new Date(NaN))));

console.log('--- W a new month is written as text');
reset(); sheets.Specials = specials('João Pedro', 'August');
let r = ctx.emtPotmSync();
check('W1 the player and the month are written, both cells formatted as plain text first', r.wrote && cell('POTM player') === 'Groß' && cell('POTM month') === 'September 2026' && fmt('POTM player') === '@' && fmt('POTM month') === '@', JSON.stringify([r, sheets.Specials.formats]));
check('W2 the format is set before the value on each cell', (() => { const log = sheets.Specials.formatLog || []; return log.length === 2 && log[0][0] === 2 && log[1][0] === 3; })(), JSON.stringify(sheets.Specials.formatLog));
check('W3 the API URL row and the header are untouched', sheets.Specials.rows[0].join('|') === 'Setting|Value' && cell('API URL') === 'https://script.google.com/macros/s/X/exec' && sheets.Specials.rows.length === 4);
check('W4 health reads September 2026 from file', health().month === 'September 2026' && health().from === 'file');

console.log('--- D a date in the month cell (what v3.30\'s write became)');
reset(); sheets.Specials = specials('Groß', sept());
props.EMT_POTM = JSON.stringify({ checked: Date.now() - 2 * 3600e3, wrote: { month: 'September 2026', player: 'Groß', at: '2026-10-10T18:51:00.000Z' }, file: { month: 'September 2026', code: '60307', player: 'Groß' } });
let h = health();
check('D1 before the sync, health reads the Date cell as September 2026, from file (it was v3.30\'s own write)', h.month === 'September 2026' && h.player === 'Groß' && h.from === 'file', JSON.stringify(h));
r = ctx.emtPotmSync();
check('D2 the sync rewrites the cell as the text "September 2026" with the plain-text format, and keeps the month (nothing else written)', r.ok && r.kept && r.month === 'September 2026' && cell('POTM month') === 'September 2026' && typeof cell('POTM month') === 'string' && fmt('POTM month') === '@' && cell('POTM player') === 'Groß' && fmt('POTM player') === undefined, JSON.stringify([r, cell('POTM month'), sheets.Specials.formats]));
check('D3 the log says what it did', logs.some(l => /^POTM: the Specials month cell held a date \(.*\); rewritten as the text "September 2026" so gviz reads the tab with one header row\.$/.test(l)), logs.join(' / '));
check('D4 health after: September 2026, Groß, from file', health().month === 'September 2026' && health().from === 'file');
props.EMT_POTM = JSON.stringify(Object.assign(state(), { checked: Date.now() - 2 * 3600e3 })); logs.length = 0;
r = ctx.emtPotmSync();
check('D5 the next hour: a text cell, nothing rewritten, no log', r.kept && logs.length === 0 && cell('POTM month') === 'September 2026');

console.log('--- H a hand edit Sheets parsed into a date is kept, as text');
reset(); sheets.Specials = specials('Haaland', oct());
r = ctx.emtPotmSync();
check('H1 the file says September, the hand edit October: the date is healed to the text "October 2026" first (logged), then the file wins as in v3.30, written as text', r.ok && r.wrote && cell('POTM month') === 'September 2026' && fmt('POTM month') === '@' && cell('POTM player') === 'Groß' && logs.some(l => /rewritten as the text "October 2026"/.test(l)) && logs.some(l => /was "October 2026"\)\.$/.test(l)), JSON.stringify([r, cell('POTM month'), logs]));
check('H2 health says file, September 2026, Groß', health().from === 'file' && health().month === 'September 2026' && health().player === 'Groß');
reset(); sheets.Specials = specials('Pascal Gross', sept());
r = ctx.emtPotmSync();
check('H3 a hand edit for the same month as a date: the month healed to text, the player untouched, kept', r.kept && cell('POTM month') === 'September 2026' && cell('POTM player') === 'Pascal Gross' && health().from === 'hand');

console.log('--- M the Monitor reads the tab the same way');
const mon = require('fs').readFileSync(__dirname + '/../../fplgg/tools/monitor/monitor.js', 'utf8');
check('M1 monitor.js sends headers=1 on the Specials read', /gviz\/tq\?tqx=out:csv&headers=1&sheet=Specials/.test(mon));

T.done();
