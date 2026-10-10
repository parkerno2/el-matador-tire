// v3.30 tests: the Player of the Month card fills itself (Parker's Q7, 10 Oct 2026: "Oh pascal groß won potm", then "go
// ahead and do that now"). Every refresh reads fplgg/tools/matchweek/data/potm.json from the release branch and writes
// the Specials rows 'POTM player' (the Players tab's own Player string for the file's Code) and 'POTM month' when the
// file's month differs from the cell's; a hand edit for the same month is kept; a 404, a failed fetch or a bad file
// changes nothing and is logged; the Specials tab is created when missing; ?health=1 potm says what the cells hold and
// where it came from. The repo's own potm.json is checked too, so a copying slip fails the gate.   node tests/codegs/v330.js
const fs = require('fs');
const T = require(__dirname + '/harness.js').make();
const { ctx, check, src, sheets, props, logs } = T;
const Sheet = T.Sheet;

/* the mock: the potm file on the release branch, by MODE */
const FILE = { month: 'September 2026', code: 60307, player: 'Groß', club: 'BHA', sources: ['https://www.si.com/x', 'https://www.ysscores.com/y'] };
let MODE = 'ok', fetches = 0, file = FILE;
const realFetch = ctx.UrlFetchApp.fetch;
ctx.UrlFetchApp.fetch = (url, o) => {
  if (url.indexOf(ctx.EMT_POTM_SRC) === 0) {
    fetches++;
    if (MODE === 'throw') throw new Error('Address unavailable: raw.githubusercontent.com');
    if (MODE === '404') return T.resp(404, '404: Not Found');
    if (MODE === '500') return T.resp(500, 'Internal Server Error');
    if (MODE === 'bad') return T.resp(200, '{"month": "September 2026", "code": 60307');
    if (MODE === 'array') return T.resp(200, '[{"month":"September 2026","code":60307}]');
    if (MODE === 'nomonth') return T.resp(200, JSON.stringify({ code: 60307, player: 'Groß' }));
    if (MODE === 'nobody') return T.resp(200, JSON.stringify({ month: 'September 2026' }));
    if (MODE === 'long') return T.resp(200, JSON.stringify({ month: 'September 2026', code: 60307, pad: 'x'.repeat(5000) }));
    return T.resp(200, JSON.stringify(file));
  }
  return realFetch(url, o);
};
const players = () => new Sheet('Players', [['Code', 'Player', 'Pos', 'Club', 'Owner', 'Status', 'News', 'Draft rank', 'Season pts', 'Mins', 'Form', 'xGI', 'EP next', 'Proj', 'Nation', 'Full name'],
  [223094, 'Haaland', 'FWD', 'MCI', 'Cold Palmers', 'a', '', 1, 61, 450, 9.1, 0.9, 8.4, 210, 'NO', 'Erling Haaland'],
  [60307, 'Groß', 'MID', 'BHA', 'Devils U21s', 'a', '', 165, 53, 540, 12.3, 2.83, 12.3, 95, 'DE', 'Pascal Groß'],
  [128295, 'Nørgaard', 'MID', 'EVE', 'FREE', 'd', 'Groin injury', 346, 0, 0, 0, 0, 0, 30, 'DK', 'Christian Nørgaard']]);
const specials = (player, month) => new Sheet('Specials', [['Setting', 'Value'], ['POTM player', player], ['POTM month', month], ['API URL', 'https://script.google.com/macros/s/X/exec']]);
const cell = setting => { const r = sheets.Specials.rows.find(r => r[0] === setting); return r ? r[1] : undefined; };
const state = () => JSON.parse(props.EMT_POTM || '{}');
const reset = () => { fetches = 0; logs.length = 0; delete props.EMT_POTM; MODE = 'ok'; file = FILE; };
const health = () => T.get({ health: '1' }).potm;
sheets.Players = players();

console.log('--- V the release');
check('V1 EMT_VERSION is v3.30 or later and the CHANGELOG has the entry', ctx.emtSelfVersion(src) === ctx.EMT_VERSION && ctx.emtSelfCmp(ctx.EMT_VERSION, 'v3.30') >= 0 && /\* v3\.30 · 10 Oct 2026\n \*   The Player of the Month card fills itself/.test(src));
check('V2 the file is read from the release branch, the path the repo keeps it at, at most once an hour', ctx.EMT_POTM_SRC === 'https://raw.githubusercontent.com/parkerno2/el-matador-tire/release/fplgg/tools/matchweek/data/potm.json' && ctx.EMT_POTM_EVERY_MS === 50 * 60 * 1000);
check('V3 writeSheets creates Specials as before and runs the sync inside its own try, so a refresh never fails on it', /emtSpecialsSheet\(\);\n  try \{ emtPotmSync\(\); \} catch \(e\) \{ Logger\.log\('POTM: the sync threw/.test(src) && !/sp\.getRange\(1, 1, 3, 2\)\.setValues/.test(src));
check('V4 the Specials tab is still made with Setting, Value and the two POTM rows', JSON.stringify(ctx.EMT_SPECIALS_ROWS) === '[["Setting","Value"],["POTM player",""],["POTM month",""]]');
check('V5 the host is the one the self-update already reads (no new permission)', ctx.EMT_POTM_SRC.indexOf('https://raw.githubusercontent.com/parkerno2/el-matador-tire/') === 0 && ctx.EMT_SELF_SRC.indexOf('https://raw.githubusercontent.com/parkerno2/el-matador-tire/') === 0);

console.log('--- F the repo\'s own potm.json');
const raw = fs.readFileSync(__dirname + '/../../fplgg/tools/matchweek/data/potm.json', 'utf8');
let repoFile = null; try { repoFile = JSON.parse(raw); } catch (e) { }
check('F1 it parses to one object (the newest month only, never a list)', !!repoFile && typeof repoFile === 'object' && !Array.isArray(repoFile));
check('F2 month is "<Month> <YYYY>", code a positive integer, player and club set', !!repoFile && /^(January|February|March|April|May|June|July|August|September|October|November|December) 20\d\d$/.test(repoFile.month) && Number.isInteger(repoFile.code) && repoFile.code > 0 && typeof repoFile.player === 'string' && repoFile.player.trim().length > 0 && /^[A-Z]{3}$/.test(repoFile.club || ''));
check('F3 at least two https sources confirm it', !!repoFile && Array.isArray(repoFile.sources) && repoFile.sources.length >= 2 && repoFile.sources.every(s => /^https:\/\//.test(s)));
check('F4 September 2026 is Groß, 60307, BHA, with the ß intact in UTF-8', !!repoFile && repoFile.month === 'September 2026' && repoFile.code === 60307 && repoFile.player === 'Groß' && repoFile.club === 'BHA' && Buffer.from(repoFile.player, 'utf8').toString('hex') === '47726fc39f');
check('F5 one line, no dash the house style forbids', raw.trim().split('\n').length === 1 && !/[\u2013\u2014]/.test(raw));

console.log('--- W writes');
reset(); sheets.Specials = specials('João Pedro', 'August');
let r = ctx.emtPotmSync();
check('W1 a new month: the player and the month are written (the tab said João Pedro, August)', r.ok && r.wrote && cell('POTM player') === 'Groß' && cell('POTM month') === 'September 2026', JSON.stringify([r, cell('POTM player'), cell('POTM month')]));
check('W2 the name is the Players tab\'s own string for the code, with the ß intact', Buffer.from(cell('POTM player'), 'utf8').toString('hex') === '47726fc39f');
check('W3 the API URL row and the header are untouched', sheets.Specials.rows[0].join('|') === 'Setting|Value' && cell('API URL') === 'https://script.google.com/macros/s/X/exec' && sheets.Specials.rows.length === 4);
check('W4 the log says what was written and what it replaced', logs.some(l => /^POTM: Specials now says Groß, September 2026 \(from potm\.json, code 60307; was "August"\)\.$/.test(l)), logs.join(' / '));
check('W5 the state keeps what was written and when it was checked', state().wrote && state().wrote.month === 'September 2026' && state().wrote.player === 'Groß' && Number(state().checked) > 0 && !state().error);
let h = health();
check('W6 ?health=1 potm: September 2026, Groß, from file', h.month === 'September 2026' && h.player === 'Groß' && h.from === 'file' && /^\d{4}-\d\d-\d\dT/.test(h.checked) && !('error' in h), JSON.stringify(h));
props.EMT_POTM = JSON.stringify(Object.assign(state(), { checked: Date.now() - 2 * 3600e3 }));
r = ctx.emtPotmSync();
check('W7 the next hour\'s read finds the same month and writes nothing', r.ok && r.kept && cell('POTM player') === 'Groß' && cell('POTM month') === 'September 2026' && health().from === 'file');
file = { month: 'October 2026', code: 223094 };
props.EMT_POTM = JSON.stringify(Object.assign(state(), { checked: Date.now() - 2 * 3600e3 }));
r = ctx.emtPotmSync();
check('W8 the month after: the file moves on, so do the cells (a file without a player string still maps its code)', r.wrote && cell('POTM player') === 'Haaland' && cell('POTM month') === 'October 2026' && health().from === 'file');

console.log('--- K a hand edit for the same month is kept');
reset(); sheets.Specials = specials('Pascal Gross', 'September 2026');
r = ctx.emtPotmSync();
check('K1 the cell already names September 2026 by hand: nothing is written', r.ok && r.kept && cell('POTM player') === 'Pascal Gross' && cell('POTM month') === 'September 2026');
check('K2 ?health=1 potm says it is from hand', health().from === 'hand' && health().player === 'Pascal Gross');
reset(); sheets.Specials = specials('Groß', ' september ');
r = ctx.emtPotmSync();
check('K3 the month name alone, as the tab was kept until now, counts as the same month', r.kept && cell('POTM month') === ' september ' && cell('POTM player') === 'Groß');
reset(); sheets.Specials = specials('Pascal Gross', 'September 2026');
ctx.emtPotmSync(); sheets.Specials.rows.find(r => r[0] === 'POTM player')[1] = 'Groß (by hand)';
check('K4 a later hand edit of the player shows as hand even though the month is the file\'s', health().from === 'hand' && health().player === 'Groß (by hand)');

console.log('--- B a bad file, a 404, a failed fetch: nothing changes, it is logged');
const unchanged = (label, mode, errRe) => {
  reset(); MODE = mode; sheets.Specials = specials('João Pedro', 'August');
  const r = ctx.emtPotmSync(), h = health();
  const same = cell('POTM player') === 'João Pedro' && cell('POTM month') === 'August' && sheets.Specials.rows.length === 4;
  const logged = errRe ? logs.some(l => /^POTM: potm\.json could not be used \(/.test(l) && errRe.test(l) && /the Specials tab is unchanged\.$/.test(l)) : logs.length === 0;
  check(label, same && logged && h.month === 'August' && h.player === 'João Pedro' && h.from === 'hand' && (errRe ? r.ok === false && errRe.test(h.error) : r.ok && r.none && !('error' in h)), JSON.stringify([r, h, logs]));
};
unchanged('B1 a file that does not parse', 'bad', /does not parse/);
unchanged('B2 a list instead of one object', 'array', /not one object/);
unchanged('B3 a file without a month', 'nomonth', /no month/);
unchanged('B4 a file with neither code nor player', 'nobody', /no code and no player/);
unchanged('B5 a file over 4,000 characters', 'long', /over 4000 characters/);
unchanged('B6 an HTTP 500', '500', /HTTP 500/);
unchanged('B7 a fetch that throws', 'throw', /Address unavailable/);
unchanged('B8 a 404 (no file yet): nothing written, nothing logged, no error in health', '404', null);
reset(); MODE = 'bad'; sheets.Specials = specials('', '');
ctx.emtPotmSync();
check('B9 blank cells stay blank on a bad file and health says none, with the error', cell('POTM player') === '' && cell('POTM month') === '' && health().from === 'none' && /does not parse/.test(health().error));
reset(); MODE = 'bad'; sheets.Specials = specials('João Pedro', 'August'); ctx.emtPotmSync();
props.EMT_POTM = JSON.stringify(Object.assign(state(), { checked: Date.now() - 2 * 3600e3 })); MODE = 'ok'; logs.length = 0;
r = ctx.emtPotmSync();
check('B10 the error clears on the next good read, which writes', r.wrote && !('error' in health()) && cell('POTM player') === 'Groß');

console.log('--- N the name');
reset(); sheets.Specials = specials('', ''); file = { month: 'September 2026', code: 999999, player: 'Groß' };
r = ctx.emtPotmSync();
check('N1 a code the Players tab lacks: the file\'s player string is written', r.wrote && cell('POTM player') === 'Groß' && cell('POTM month') === 'September 2026' && health().from === 'file');
reset(); sheets.Specials = specials('', ''); file = { month: 'September 2026', code: 999999 };
r = ctx.emtPotmSync();
check('N2 a code the tab lacks and no player string: nothing written, logged, health says none with the error', r.ok === false && /no player name/.test(r.error) && cell('POTM player') === '' && cell('POTM month') === '' && health().from === 'none' && logs.some(l => /^POTM: no player name for September 2026; the Specials tab is unchanged\.$/.test(l)));
reset(); sheets.Specials = specials('', ''); file = { month: 'September 2026', code: '60307.0' };
r = ctx.emtPotmSync();
check('N3 a code as a string maps too', r.wrote && cell('POTM player') === 'Groß');
check('N4 emtPotmName reads the tab (ß intact), falls back to the file', ctx.emtPotmName({ code: '60307', player: 'x' }) === 'Groß' && ctx.emtPotmName({ code: '1', player: 'Someone' }) === 'Someone' && ctx.emtPotmName({ code: '', player: '' }) === '');

console.log('--- S the Specials tab is created when missing');
reset(); delete sheets.Specials;
r = ctx.emtPotmSync();
check('S1 created with the header and the two rows, then filled', !!sheets.Specials && sheets.Specials.rows[0].join('|') === 'Setting|Value' && sheets.Specials.rows[1].join('|') === 'POTM player|Groß' && sheets.Specials.rows[2].join('|') === 'POTM month|September 2026' && sheets.Specials.rows.length === 3 && r.wrote);
reset(); delete sheets.Specials; MODE = '404';
ctx.emtSpecialsSheet(); r = ctx.emtPotmSync();
check('S2 emtSpecialsSheet alone makes the tab as before (blank rows), and a 404 leaves it so', sheets.Specials.rows.length === 3 && sheets.Specials.rows[1].join('|') === 'POTM player|' && sheets.Specials.rows[2].join('|') === 'POTM month|' && r.none && health().from === 'none');
reset(); sheets.Specials = new Sheet('Specials', [['Setting', 'Value'], ['API URL', 'https://script.google.com/macros/s/X/exec']]);
r = ctx.emtPotmSync();
check('S3 a tab without the POTM rows gets them appended, the API URL row kept', r.wrote && cell('API URL') === 'https://script.google.com/macros/s/X/exec' && cell('POTM month') === 'September 2026' && cell('POTM player') === 'Groß' && sheets.Specials.rows.length === 4);

console.log('--- G one read an hour');
reset(); sheets.Specials = specials('João Pedro', 'August');
ctx.emtPotmSync(); ctx.emtPotmSync(); ctx.emtPotmSync();
check('G1 three refreshes in a row read the file once', fetches === 1);
props.EMT_POTM = JSON.stringify(Object.assign(state(), { checked: Date.now() - 51 * 60e3 }));
ctx.emtPotmSync();
check('G2 after 50 minutes it reads again', fetches === 2);
ctx.emtPotmSync(true);
check('G3 force reads whatever the age', fetches === 3);
reset(); MODE = 'throw'; sheets.Specials = specials('João Pedro', 'August');
ctx.emtPotmSync(); ctx.emtPotmSync();
check('G4 a failed read waits the same hour before the next try', fetches === 1 && /Address unavailable/.test(health().error));

console.log('--- H health');
reset(); sheets.Specials = specials('', '');
h = health();
check('H1 blank cells and no read yet: { month: "", player: "", from: "none", checked: "" }', JSON.stringify(h) === '{"month":"","player":"","from":"none","checked":""}', JSON.stringify(h));
delete sheets.Specials;
check('H2 no Specials tab: none, no throw', health().from === 'none');
check('H3 the rest of health is as it was', (() => { const g = T.get({ health: '1' }); return g.ok && g.version === ctx.EMT_VERSION && 'show' in g && 'facts' in g && 'data' in g && 'errors' in g && 'articles' in g && 'ai' in g; })());

T.done();
