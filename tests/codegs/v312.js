// v3.12 tests: the show writes itself; Code.gs updates itself.   node scratchpad/gs/v312.js
const fs = require('fs'), crypto = require('crypto'), vm = require('vm');
const CODE = __dirname + '/../../Code.gs';
const src = fs.readFileSync(CODE, 'utf8');
const OLD = fs.readFileSync(__dirname + '/fixtures/Code.v311.gs', 'utf8');
const FACTS = JSON.parse(fs.readFileSync(__dirname + '/fixtures/facts.json', 'utf8'));

function Sheet(name, rows) { this.name = name; this.rows = rows || []; this.hidden = false; this.frozen = 0; this.inserted = 0; this.tight = false; }
Sheet.prototype.getLastRow = function () { return this.rows.length; };
Sheet.prototype.getLastColumn = function () { return Math.max(0, ...this.rows.map(r => r.length)); };
Sheet.prototype.getMaxRows = function () { return this.tight ? this.rows.length : this.rows.length + 100; };
Sheet.prototype.getRange = function (r, c, nr, nc) { const sh = this; nr = nr || 1; nc = nc || 1; return {
  getValues() { const o = []; for (let i = 0; i < nr; i++) { const row = sh.rows[r - 1 + i] || []; o.push(Array.from({ length: nc }, (_, j) => row[c - 1 + j] == null ? '' : row[c - 1 + j])); } return o; },
  getValue() { return this.getValues()[0][0]; },
  setValues(v) { v.forEach((row, i) => { const idx = r - 1 + i; while (sh.rows.length <= idx) sh.rows.push([]); row.forEach((x, j) => { sh.rows[idx][c - 1 + j] = x; }); }); },
  setValue(x) { this.setValues([[x]]); } }; };
Sheet.prototype.getDataRange = function () { return this.getRange(1, 1, this.getLastRow(), this.getLastColumn()); };
Sheet.prototype.appendRow = function (row) { this.rows.push(row.slice()); };
Sheet.prototype.setFrozenRows = function (n) { this.frozen = n; };
Sheet.prototype.hideSheet = function () { this.hidden = true; };
Sheet.prototype.deleteRows = function (r, n) {
  if (r < 2) throw new Error('deleteRows hit the header');
  if (n >= this.getMaxRows() - 1) throw new Error('Sorry, it is not possible to delete all non-frozen rows.');
  this.rows.splice(r - 1, n); };
Sheet.prototype.insertRowAfter = function () { this.inserted++; this.tight = false; };

const API_URL = 'https://script.google.com/macros/s/AKfycbwLIVE123/exec';
const iso = ms => new Date(ms).toISOString();
const H = 3600e3;
let sheets;
function freshSheets() {
  sheets = {
    Standings: new Sheet('Standings', [['Team']].concat(FACTS.table.map(t => [t.team]))),
    Matchweeks: new Sheet('Matchweeks', [['GW', 'Deadline (UTC)', 'MOTM period', 'Finished', 'Notes'], [5, "'2026-09-18T17:30:00Z", 'Aug & Sep', 'TRUE', ''],
      [6, "'" + iso(Date.now() + 20 * H), 'October', 'FALSE', ''], [7, "'" + iso(Date.now() + 7 * 24 * H), 'October', 'FALSE', '']]),
    'H2H Fixtures': new Sheet('H2H Fixtures', [['GW', 'Home', 'Home pts', 'Away', 'Away pts', 'Finished']].concat(FACTS.fixtures.map(f => [6, f.home, 0, f.away, 0, false]))),
    Social: new Sheet('Social', [['When (UTC)', 'Team', 'Kind', 'Target', 'Value', 'Extra'],
      ["'" + iso(Date.now() - 2 * H), 'Cold Palmers', 'quote', 'q:6', '', JSON.stringify({ line: "I'm winning Manager of the Month.", claim: { type: 'motm', team: 'Cold Palmers' }, p: 0.09, src: 'own' })],
      ["'" + iso(Date.now() - 3 * 24 * H), 'Team Jacob', 'quote', 'q:5', '', JSON.stringify({ line: 'Old news from gameweek five.', claim: null, p: null })]]),
    Posts: new Sheet('Posts', [['When (UTC)', 'Id', 'Voice', 'Kind', 'Event', 'Teams', 'Players', 'Text', 'Facts', 'Media'],
      ["'" + iso(Date.now() - 24 * H), 'note:baha-files', 'archizio', 'note', 'storyline', 'Kobbie Mainoo Fan', '', 'Running joke: The Baha Files, the league investigation into Kobbie Mainoo Fan.', 'Commissioner note', '']]),
    Specials: new Sheet('Specials', [['Setting', 'Value'], ['POTM player', 'Joao Pedro'], ['API URL', API_URL]]),
  };
}
freshSheets();
let props = {};
let cache = {};
const logs = [], tts = [], gh = [], claude = [], raw = [], api = [];
let SHOW = {}, CLAUDE = [], RAW = { code: 200, text: src }, UI = null, TRIGGERS = [];
let PROJ;
function freshProject(codeSrc) {
  PROJ = { versions: 12, mode: {},
    files: [{ name: 'appsscript', type: 'JSON', source: '{\n  "timeZone": "Europe/London",\n  "runtimeVersion": "V8",\n  "webapp": { "executeAs": "USER_DEPLOYING", "access": "ANYONE_ANONYMOUS" }\n}' },
      { name: 'Code', type: 'SERVER_JS', source: codeSrc, functionSet: { values: [{ name: 'doGet' }] }, updateTime: '2026-10-01T00:00:00Z' },
      { name: 'Helpers', type: 'SERVER_JS', source: 'function helper() { return 1; }\n' }],
    deployments: [
      { deploymentId: 'AKfycbHEAD', deploymentConfig: { scriptId: 'SCRIPT1', manifestFileName: 'appsscript', description: 'Head deployment' }, entryPoints: [{ entryPointType: 'WEB_APP', webApp: { url: 'https://script.google.com/macros/s/AKfycbHEAD/dev' } }] },
      { deploymentId: 'AKfycbOTHER', deploymentConfig: { scriptId: 'SCRIPT1', versionNumber: 3, manifestFileName: 'appsscript', description: 'old test' }, entryPoints: [{ entryPointType: 'WEB_APP', webApp: { url: 'https://script.google.com/macros/s/AKfycbOTHER/exec' } }] },
      { deploymentId: 'AKfycbwLIVE123', deploymentConfig: { scriptId: 'SCRIPT1', versionNumber: 12, manifestFileName: 'appsscript', description: 'v3.11' }, entryPoints: [{ entryPointType: 'WEB_APP', webApp: { url: API_URL } }] }] };
  PROJ.snap = { 3: [{ name: 'appsscript', type: 'JSON', source: '{}' }, { name: 'Code', type: 'SERVER_JS', source: 'function old() {}' }], 12: JSON.parse(JSON.stringify(PROJ.files)) };   // review: what each version holds
}
freshProject(OLD);

const unsigned = a => a.map(b => (b + 256) % 256);
function fakeBytes(text) { const n = text.length * 20; const seed = crypto.createHash('md5').update(text).digest(); return Array.from({ length: n }, (_, i) => ((seed[i % 16] + i) % 256) - 128); }
const resp = (code, body) => ({ getResponseCode: () => code, getContentText: () => typeof body === 'string' ? body : JSON.stringify(body), getContent: () => [] });

function apiFetch(url, o) {
  const path = url.replace('https://script.googleapis.com/v1/projects/SCRIPT1', ''), method = String(o.method || 'get').toLowerCase();
  const body = o.payload ? JSON.parse(o.payload) : null;
  api.push({ method, path, body, auth: o.headers && o.headers.Authorization, mute: o.muteHttpExceptions });
  const M = PROJ.mode;
  const vm1 = /^\/content\?versionNumber=(\d+)$/.exec(path);
  if (vm1 && method === 'get') {
    const snap = PROJ.snap && PROJ.snap[Number(vm1[1])];
    return snap ? resp(200, { scriptId: 'SCRIPT1', files: JSON.parse(JSON.stringify(snap)) }) : resp(404, { error: { message: 'version not found' } });
  }
  if (path === '/content' && method === 'get') {
    if (M.content403) return resp(403, { error: { code: 403, message: 'User has not enabled the Apps Script API. Enable it by visiting https://script.google.com/home/usersettings then retry.', status: 'PERMISSION_DENIED' } });
    return resp(200, { scriptId: 'SCRIPT1', files: JSON.parse(JSON.stringify(PROJ.files)) });
  }
  if (path === '/content' && method === 'put') {
    if (M.putFail) return resp(500, { error: { message: 'backend error' } });
    PROJ.files = body.files.map(f => ({ ...f })); return resp(200, { scriptId: 'SCRIPT1', files: body.files });
  }
  if (path === '/versions' && method === 'post') {
    if (M.versionFail) return resp(500, { error: { message: 'version limit' } });
    PROJ.versions++; if (PROJ.snap) PROJ.snap[PROJ.versions] = JSON.parse(JSON.stringify(PROJ.files));
    return resp(200, { scriptId: 'SCRIPT1', versionNumber: PROJ.versions, description: body.description });
  }
  if (/^\/deployments\?/.test(path) && method === 'get') {
    if (M.depl403) return resp(403, { error: { message: 'Request had insufficient authentication scopes.' } });
    return resp(200, { deployments: JSON.parse(JSON.stringify(PROJ.deployments)) });
  }
  const dm = /^\/deployments\/([^/?]+)$/.exec(path);
  if (dm && method === 'put') {
    if (M.depFail) return resp(500, { error: { message: 'deployment backend error' } });
    const d = PROJ.deployments.find(x => x.deploymentId === decodeURIComponent(dm[1]));
    if (!d) return resp(404, { error: { message: 'not found' } });
    d.deploymentConfig = body.deploymentConfig; return resp(200, d);
  }
  return resp(400, { error: { message: 'unexpected ' + method + ' ' + path } });
}

const ctx = {
  console, JSON, Date, Math, Number, String, Object, Array, isNaN, isFinite, parseInt, encodeURIComponent,
  SpreadsheetApp: { getActive: () => ({ getSheetByName: n => sheets[n] || null, insertSheet: n => (sheets[n] = new Sheet(n)) }),
    getUi: () => { if (!UI) throw new Error('Cannot call SpreadsheetApp.getUi() from this context.'); return UI; } },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); }, deleteProperty: k => { delete props[k]; }, getProperties: () => ({ ...props }) }) },
  CacheService: { getScriptCache: () => ({ get: k => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = String(v); } }) },
  LockService: { getScriptLock: () => ({ waitLock() {}, tryLock() { return true; }, releaseLock() {} }) },
  Utilities: { DigestAlgorithm: { SHA_256: 1, MD5: 2 }, Charset: { UTF_8: 1 }, getUuid: () => crypto.randomUUID(),
    computeDigest: (a, s) => Array.from(crypto.createHash(a === 2 ? 'md5' : 'sha256').update(s, 'utf8').digest()).map(b => b > 127 ? b - 256 : b),
    base64Encode: bytes => Buffer.from(unsigned(Array.from(bytes))).toString('base64') },
  ContentService: { createTextOutput: t => ({ t, setMimeType() { return this; } }), MimeType: { JSON: 1 } },
  ScriptApp: { getScriptId: () => 'SCRIPT1', getOAuthToken: () => 'oauth-token',
    getProjectTriggers: () => TRIGGERS.map(fn => ({ getHandlerFunction: () => fn })),
    deleteTrigger: t => { const i = TRIGGERS.indexOf(t.getHandlerFunction()); if (i > -1) TRIGGERS.splice(i, 1); },
    newTrigger: fn => ({ timeBased: () => ({ everyMinutes: () => ({ create() { TRIGGERS.push(fn); } }), everyHours: () => ({ create() { TRIGGERS.push(fn); } }) }) }) },
  Logger: { log: m => logs.push(String(m)) },
  UrlFetchApp: { fetch: (url, o) => {
    o = o || {};
    if (/github\.io/.test(url)) {
      gh.push(url);
      const gw = Number((url.match(/show\/gw(\d+)\.json/) || [])[1]);
      return SHOW[gw] ? resp(200, SHOW[gw]) : resp(404, '<h1>404</h1>');
    }
    if (/api\.anthropic\.com/.test(url)) {
      const body = JSON.parse(o.payload); claude.push({ url, o, body });
      const next = CLAUDE.shift();
      if (!next) throw new Error('no Claude reply queued');
      if (next.code) return resp(next.code, next.body || 'overloaded');
      return resp(200, { content: [{ type: 'text', text: next.text }], stop_reason: next.stop || 'end_turn' });
    }
    if (/api\.elevenlabs\.io/.test(url)) {
      const body = JSON.parse(o.payload); tts.push(body.text);
      const bytes = fakeBytes(body.text);
      return { getResponseCode: () => 200, getContent: () => bytes.slice(), getContentText: () => '' };
    }
    if (/raw\.githubusercontent\.com/.test(url)) { raw.push(url); return resp(RAW.code, RAW.text); }
    if (/script\.googleapis\.com/.test(url)) return apiFetch(url, o);
    throw new Error('unexpected fetch ' + url);
  } },
};
vm.createContext(ctx); vm.runInContext(src, ctx);
// v3.13: the self-update checks follow the version at the top of the CHANGELOG instead of a literal v3.12
const VER = ctx.emtSelfVersion(src), VRE = VER.replace(/\./g, '\\.');
const vx = re => new RegExp(re.source.split('v3\\.12').join(VRE), re.flags);

let fails = 0;
const check = (label, cond, info) => { if (!cond) fails++; console.log((cond ? 'PASS ' : 'FAIL ') + label + (info ? '  ' + info : '')); };
const reset = () => { logs.length = 0; tts.length = 0; gh.length = 0; claude.length = 0; raw.length = 0; api.length = 0; };
const Hd = r => ctx.emtHandle(r);
const setDeadline = hours => { sheets.Matchweeks.rows[2][1] = "'" + iso(Date.now() + hours * H); };
const factsRows = gw => (sheets.ShowFacts ? sheets.ShowFacts.rows.slice(1) : []).filter(r => Number(r[0]) === gw);
const scriptRows = gw => (sheets.ShowScripts ? sheets.ShowScripts.rows.slice(1) : []).filter(r => Number(r[0]) === gw);
const ageFacts = hours => { sheets.ShowFacts.rows.slice(1).forEach(r => { r[1] = "'" + iso(Date.now() - hours * H); }); };
const clearScripts = () => { if (sheets.ShowScripts) sheets.ShowScripts.rows.length = 1; Object.keys(props).filter(k => /^EMT_SHOW_TRIES_/.test(k)).forEach(k => delete props[k]); };

/* ===================== A1 · showfacts ===================== */
console.log('--- A1 showfacts');
const tokCP = Hd({ action: 'claim', team: 'Cold Palmers', pin: '1234' }).token;
const tokDU = Hd({ action: 'claim', team: 'Devils U21s', pin: '4321' }).token;
const tokTJ = Hd({ action: 'claim', team: 'Team Jacob', pin: '5555' }).token;
const factsStr = JSON.stringify(FACTS);
const post = (team, tok, extra) => Hd(Object.assign({ action: 'showfacts', team, token: tok, gw: 6, facts: factsStr }, extra || {}));
check('no auth -> auth', post('Cold Palmers', 'nope').error === 'auth' && Hd({ action: 'showfacts', team: 'Cold Palmers', gw: 6, facts: factsStr }).error === 'auth' && !sheets.ShowFacts);
check('wrong gw (7, not the next unfinished) -> closed', post('Cold Palmers', tokCP, { gw: 7 }).error === 'closed' && post('Cold Palmers', tokCP, { gw: 5 }).error === 'closed' && post('Cold Palmers', tokCP, { gw: 'x' }).error === 'closed');
setDeadline(-1);
check('deadline passed -> closed', post('Cold Palmers', tokCP).error === 'closed');
sheets.Matchweeks.rows[2][1] = '';
check('no deadline known -> closed', post('Cold Palmers', tokCP).error === 'closed');
setDeadline(20);
const badCases = [
  ['not JSON', '{nope'], ['no fixtures', JSON.stringify({ gw: 6, table: [] })], ['empty fixtures', JSON.stringify({ fixtures: [] })],
  ['11 fixtures', JSON.stringify({ fixtures: Array.from({ length: 11 }, (_, i) => ({ home: 'a' + i, away: 'b' + i })) })],
  ['fixture without away', JSON.stringify({ fixtures: [{ home: 'Cold Palmers' }] })], ['away not a string', JSON.stringify({ fixtures: [{ home: 'Cold Palmers', away: 5 }] })],
  ['fixtures not this gameweek in H2H Fixtures', JSON.stringify({ fixtures: [{ home: 'Cold Palmers', away: 'Team Jacob' }] })],
  ['facts.gw is another gameweek', JSON.stringify(Object.assign({}, FACTS, { gw: 7 }))], ['an array', '[1,2]'], ['empty', ''],
  ['duplicate fixture', JSON.stringify({ fixtures: [FACTS.fixtures[0], FACTS.fixtures[0]] })]];
const badRes = badCases.map(([n, f]) => [n, post('Cold Palmers', tokCP, { facts: f }).error]);
check('bad facts -> badfacts (' + badCases.length + ' cases)', badRes.every(x => x[1] === 'badfacts'), JSON.stringify(badRes.filter(x => x[1] !== 'badfacts')));
const pad = n => { const base = JSON.stringify(Object.assign({}, FACTS, { pad: '' })); return JSON.stringify(Object.assign({}, FACTS, { pad: 'x'.repeat(n - base.length) })); };
const tooBig = pad(60001), justFits = pad(60000);
check('size limit: 60001 chars -> badfacts', tooBig.length === 60001 && post('Cold Palmers', tokCP, { facts: tooBig }).error === 'badfacts' && !sheets.ShowFacts);
sheets.ShowFacts = new Sheet('ShowFacts', [['GW', 'Received (UTC)', 'Team', 'Part', 'Parts', 'Data'], [5, "'2026-09-17T10:00:00.000Z", 'Team Jacob', 1, 1, 'j:{"fixtures":[]}']]);
sheets.ShowFacts.hidden = true;
delete sheets.ShowFacts; // let the code create it
const r1 = post('Cold Palmers', tokCP);
const fr1 = factsRows(6);
check('accepted: ok, one row, j: marker, header, hidden, frozen', r1.ok === true && fr1.length === 1 && fr1[0][2] === 'Cold Palmers' && fr1[0][3] === 1 && fr1[0][4] === 1 &&
  String(fr1[0][5]).startsWith('j:') && JSON.stringify(JSON.parse(String(fr1[0][5]).slice(2))) === factsStr && /^'\d{4}-/.test(fr1[0][1]) &&
  sheets.ShowFacts.rows[0].join('|') === 'GW|Received (UTC)|Team|Part|Parts|Data' && sheets.ShowFacts.hidden && sheets.ShowFacts.frozen === 1, JSON.stringify(r1));
check('rate limit: same manager again within 20 minutes -> slow (nothing stored)', post('Cold Palmers', tokCP).error === 'slow' && factsRows(6).length === 1 && cache['EMT_SF_Cold Palmers'] === '1');
sheets.ShowFacts.rows.splice(1, 0, [5, "'2026-09-17T10:00:00.000Z", 'Team Jacob', 1, 1, 'j:{"fixtures":[]}']);   // another gameweek's facts stay
const r2 = post('Devils U21s', tokDU, { facts: justFits });
const fr2 = factsRows(6);
const joined = fr2.map(r => String(r[5]).slice(2)).join('');
check('chunked: 60000 chars -> 2 parts of <= 45000, each marked j:', r2.ok && r2.parts === 2 && fr2.length === 2 && fr2[0][3] === 1 && fr2[1][3] === 2 && fr2.every(r => r[4] === 2 && String(r[5]).startsWith('j:') && String(r[5]).length <= 45002) && joined === JSON.stringify(JSON.parse(justFits)),
  fr2.map(r => String(r[5]).length).join(','));
check('second post replaces the first (older GW6 rows deleted, GW5 kept)', !fr2.some(r => r[2] === 'Cold Palmers') && sheets.ShowFacts.rows.slice(1).filter(r => Number(r[0]) === 5).length === 1);
const lt = ctx.emtShowFactsLatest(6, true);
check('emtShowFactsLatest reassembles the newest complete set', lt && lt.team === 'Devils U21s' && lt.parts === 2 && lt.data.pad.length > 1000 && Math.abs(lt.at - Date.now()) < 60e3);
const r3 = post('Team Jacob', tokTJ, { facts: factsStr });
check('a third post (another manager) replaces again: one set left', r3.ok && factsRows(6).length === 1 && factsRows(6)[0][2] === 'Team Jacob');
check('object facts accepted too (stringified)', (delete cache['EMT_SF_Team Jacob'], post('Team Jacob', tokTJ, { facts: FACTS }).ok === true) && factsRows(6).length === 1);

/* ===================== emtSpeak ===================== */
console.log('--- emtSpeak');
const speakCases = [
  ['39', 'thirty-nine'], ['240', 'two hundred and forty'], ['2026', 'two thousand and twenty-six'], ['0', 'zero'], ['7', 'seven'], ['10', 'ten'], ['13', 'thirteen'],
  ['20', 'twenty'], ['100', 'one hundred'], ['101', 'one hundred and one'], ['1000', 'one thousand'], ['1005', 'one thousand and five'], ['1100', 'one thousand one hundred'],
  ['9999', 'nine thousand nine hundred and ninety-nine'], ['1,200', 'one thousand two hundred'],
  ['35.8', 'thirty-five point eight'], ['39.0', 'thirty-nine point zero'], ['6.15', 'six point one five'], ['0.5', 'zero point five'],
  ['56%', 'fifty-six percent'], ['9%', 'nine percent'], ['35.8%', 'thirty-five point eight percent'], ['100 %', 'one hundred percent'],
  ['5th', 'fifth'], ['1st', 'first'], ['2nd', 'second'], ['3rd', 'third'], ['8th', 'eighth'], ['9th', 'ninth'], ['12th', 'twelfth'], ['20th', 'twentieth'], ['21st', 'twenty-first'], ['100th', 'one hundredth'],
  ['4-3', 'four to three'], ['4 - 3', 'four to three'], ['39–35.8', 'thirty-nine to thirty-five point eight'], ['56%-60%', 'fifty-six percent to sixty percent'],
  ['3-5-2', 'three-five-two'], ['4–2–3–1', 'four-two-three-one'], ['GW6', 'gameweek six'], ['GW 12', 'gameweek twelve'],
  ['10:00', 'ten'], ['9:05', 'nine oh five'], ['17:30', 'seventeen thirty'], ['-3', 'minus three'], ['W46-36', 'W forty-six to thirty-six'],
  ['Gibbs-White', 'Gibbs-White'], ["That's the gameweek.", "That's the gameweek."], ['Gameweek 6.', 'Gameweek six.'],
  ['Predicted 39 to 35.8. The model has Parker at 56%.', 'Predicted thirty-nine to thirty-five point eight. The model has Parker at fifty-six percent.'],
  ['Baha leads the series 5 to 2. The model makes it 62%.', 'Baha leads the series five to two. The model makes it sixty-two percent.'],
  ['CJ has scored 240, the most in the league, and sits 2nd.', 'CJ has scored two hundred and forty, the most in the league, and sits second.']];
const speakBad = speakCases.filter(([i, o]) => ctx.emtSpeak(i) !== o).map(([i, o]) => i + ' -> ' + ctx.emtSpeak(i) + ' (want ' + o + ')');
check('emtSpeak: ' + speakCases.length + ' cases', speakBad.length === 0, speakBad.join(' | '));
check('emtSpeak keeps names with digits: glued (U21s) and from the keep list', ctx.emtSpeak('Devils U21s are 5th on 9 points.') === 'Devils U21s are fifth on nine points.' &&
  ctx.emtSpeak('Team 7 lead Devils U21s 4 to 3, 56%.', ['Team 7', 'Devils U21s']) === 'Team 7 lead Devils U21s four to three, fifty-six percent.' &&
  JSON.stringify(ctx.emtShowNames({ table: [{ team: 'Devils U21s', mgr: 'PJ' }], fixtures: [{ home: 'Team 7', away: 'Cold Palmers', H: { team: 'Team 7', mgr: 'R2', xi: [{ name: 'Player 99' }] } }] })) === JSON.stringify(['Devils U21s', 'Team 7', 'R2', 'Player 99']),
  ctx.emtSpeak('Team 7 lead Devils U21s 4 to 3, 56%.', ['Team 7', 'Devils U21s']));
check('emtSpeak full sentence', ctx.emtSpeak('Predicted 39 to 35.8. The model has Parker at 56%.') === 'Predicted thirty-nine to thirty-five point eight. The model has Parker at fifty-six percent.');

/* ===================== the mock replies ===================== */
const BEATS = {
  'Kobbie Mainoo Fan': { star: { h: '487838', a: '17761' }, beats: [
    'Kobbie Mainoo Fan. Top of the table on 10 points, and the files are still open.',
    'Hall leads the eleven on 5.3. Isak is a 75% doubt for the trip.',
    'Trophy Hunters. Bryant has won 3 straight, by 19, by 10 and by 26.',
    'Tarkowski projects 5.5, highest in the eleven. Semenyo, Tzolis and Brobbey carry flags.',
    'Baha leads the series 5 to 2. The model makes it 62%.'] },
  'Cold Palmers': { star: { h: '154561', a: '222531' }, beats: [
    "Cold Palmers. Parker says he's winning Manager of the Month. The model says 9%.",
    'Four starters on 75% flags, Palmer among them. Raya projects highest, on 5.',
    'Devils U21s. Five games, five defeats — and PJ still leads this derby 4 to 3.',
    "Gibbs-White tops the eleven on 5.3. Not a single flag among PJ's starters.",
    'Predicted 39 to 35.8. The model has Parker at 56%.'] },
  'I Am a Baleba': { star: { h: '223094', a: '226597' }, beats: [
    'I Am a Baleba. Ethan put 54 on PJ last week, his best of the season.',
    "Haaland goes to Anfield as the eleven's top projection, 5.5 points.",
    'The Soaring Gulls. CJ has scored 240, the most in the league.',
    'Gabriel heads the eleven on 5.3, at home to Leeds. Tavernier close behind.',
    'Ethan leads the series 4 to 3. The model still prefers CJ, 55%.'] },
  'In It to McGinn It': { star: { h: '141746', a: '223340' }, beats: [
    'In It to McGinn It. Nate has lost 2 straight, by 1 and by 26.',
    'Fernandes leads the eleven on 5.7, at home to Spurs. Porro and Rashford are doubts.',
    'Team Jacob. Two straight defeats as well, by 4 and by 1.',
    'Saka projects 6.1 at home to Leeds, the highest in the league.',
    'First ever meeting. Predicted 33.6 to 39.9. Jacob, 63%.'] } };
const ORDER = ['Kobbie Mainoo Fan', 'Cold Palmers', 'I Am a Baleba', 'In It to McGinn It'];
function goodReply() {
  return { open: "Gameweek 6. Two derbies, a leader under investigation, and a manager still waiting for a point. Here's how it lines up.",
    chapters: ORDER.map(h => { const f = FACTS.fixtures.find(x => x.home === h); return { home: f.home, away: f.away, star: Object.assign({}, BEATS[h].star), beats: BEATS[h].beats.slice() }; }),
    close: "That's the gameweek. Lineups in before Saturday's deadline, and get yourself on the record in the press room." };
}
function badReply() {
  const r = goodReply();
  r.chapters[1].star.h = '999999';                                              // not in Cold Palmers' H.xi
  r.chapters[0].beats[0] = 'Kobbie Mainoo Fan. Top of the table with 8123 points, apparently.';   // invented number
  r.chapters.pop();                                                             // a fixture missing
  return r;
}
const asText = r => 'Here you go:\n' + JSON.stringify(r);

/* ===================== A2 · writer timing ===================== */
console.log('--- A2 writer timing');
props.ANTHROPIC_API_KEY = 'sk-test';
props.EMT_PUNCH_OFF = 'yes';   // v3.13 tone pass: the show's punch-up has its own tests (v313.js C17); these count the writer's calls
// fresh facts (Team Jacob just posted the real facts)
reset(); setDeadline(30); CLAUDE = [{ text: asText(goodReply()) }];
let w = ctx.showWriterTick();
check('>22h before the deadline -> no call', claude.length === 0 && w.stopped === 'wait' && gh.length === 0, w.stopped);
reset(); setDeadline(10); ageFacts(7);
w = ctx.showWriterTick();
check('stale facts (7h old) at 10h -> no call', claude.length === 0 && w.stopped === 'wait' && logs.some(l => /7 hours old/.test(l)), logs.join(' / '));
reset(); setDeadline(3.5);
w = ctx.showWriterTick();
check('<=4h with stale facts -> one call, written', claude.length === 1 && w.written === true && scriptRows(6).length === 1, w.stopped);
reset(); CLAUDE = [{ text: asText(goodReply()) }];
w = ctx.showWriterTick();
check('existing ShowScripts row -> no call', claude.length === 0 && w.stopped === 'written' && gh.length === 0);
clearScripts(); ageFacts(0); setDeadline(20); SHOW[6] = JSON.parse(fs.readFileSync(__dirname + '/fixtures/gw6.backup.json', 'utf8'));
reset(); w = ctx.showWriterTick();
check('repo show/gw6.json returns 200 -> no call (hand-written wins)', claude.length === 0 && w.stopped === 'repo' && gh.length === 1 && /gw6\.json\?cb=/.test(gh[0]) && !props.EMT_SHOW_TRIES_6);
delete SHOW[6];
reset(); setDeadline(-0.1); w = ctx.showWriterTick();
check('deadline passed -> no call', claude.length === 0 && w.stopped === 'closed'); setDeadline(20);
reset(); props.EMT_SHOW_PAUSED = 'yes'; w = ctx.showWriterTick(); delete props.EMT_SHOW_PAUSED;
check('EMT_SHOW_PAUSED = yes -> no call', claude.length === 0 && w.stopped === 'paused');
reset(); delete props.ANTHROPIC_API_KEY; w = ctx.showWriterTick(); const w2 = ctx.showWriterTick();
check('no ANTHROPIC_API_KEY -> no call, logged once', claude.length === 0 && w.stopped === 'nokey' && w2.stopped === 'nokey' && logs.filter(l => /ANTHROPIC_API_KEY/.test(l)).length === 1);
props.ANTHROPIC_API_KEY = 'sk-test';

/* <=22h with fresh facts -> one Claude call: the main valid path */
console.log('--- A2 the valid reply');
clearScripts(); reset(); setDeadline(20); CLAUDE = [{ text: asText(goodReply()) }];
w = ctx.showWriterTick();
const req = claude[0], user = req && req.body.messages[0].content;
check('<=22h with fresh facts -> exactly one Claude call, written', claude.length === 1 && w.written === true && w.calls === 1 && props.EMT_SHOW_TRIES_6 === '1', JSON.stringify({ stopped: w.stopped, problems: w.problems }));
check('request: same style as aiWrite (url, headers, model default, max_tokens 2000, muteHttpExceptions)', req.url === 'https://api.anthropic.com/v1/messages' && req.o.method === 'post' && req.o.muteHttpExceptions === true &&
  req.o.headers['x-api-key'] === 'sk-test' && req.o.headers['anthropic-version'] === '2023-06-01' && req.body.model === 'claude-sonnet-5-5' && req.body.max_tokens === 2000);
check('system prompt: the voice bible with its style beats (v3.13: the three new ones, the old Manager of the Month one gone) and THE READERS', /Malcolm Tyre/.test(req.body.system) && !req.body.system.includes("Parker says he's winning Manager of the Month") &&
  req.body.system.includes("Gibbs-White tops the eleven. Not a single flag among PJ's starters. Fully fit. Just shite.") && req.body.system.includes('Bad week to have named your club after one of them.') &&
  req.body.system.includes("Ethan's backup plan is also Haaland.") && req.body.system.includes('THE READERS.') && /five beats/.test(req.body.system) && !/[—–]/.test(req.body.system));
check('user message: FACTS (decimals rounded), QUOTES with line and call, NOTES, WRITE line', user.includes('"proj":43.2') && !user.includes('43.199999') && user.includes("I'm winning Manager of the Month.") &&
  user.includes('Their call: {"type":"motm","team":"Cold Palmers"}') && user.includes('The model gives that call 9%') && !user.includes('Old news from gameweek five') &&
  user.includes('The Baha Files') && /The deadline is on [A-Z][a-z]+day\./.test(user) && /WRITE the Gameweek 6 show\.$/.test(user));
const srow = scriptRows(6)[0], sj = srow && JSON.parse(String(srow[4]).slice(2));
check('ShowScripts row: GW, Written, Model, Facts received, Script marked j:; tab hidden', srow && /^'\d{4}-/.test(srow[1]) && srow[2] === 'claude-sonnet-5-5' && /^'\d{4}-/.test(srow[3]) && String(srow[4]).startsWith('j:') &&
  sheets.ShowScripts.rows[0].join('|') === 'GW|Written (UTC)|Model|Facts received (UTC)|Script' && sheets.ShowScripts.hidden);
check('script shape matches the hand-written ones', sj.gw === 6 && sj.voice === 'Malcolm Tyre — El Matador Booth' && sj.model === 'eleven_multilingual_v2' && sj.speed === 1.1 && sj.audio === 'sheet' && sj.source === 'ai' &&
  /^\d{4}-\d{2}-\d{2}$/.test(sj.written) && sj.chapters.length === 4 && sj.chapters.every(c => c.beats.length === 5 && c.star.h && c.star.a) && sj.chapters[0].home === 'Kobbie Mainoo Fan' && sj.chapters[1].star.a === '222531');
const allText = [sj.open, sj.close].concat(...sj.chapters.map(c => c.beats));
check('converted to words: no digits left (club names with digits kept), the faceoff line reads right', allText.every(t => !/\d/.test(t.split('Devils U21s').join(''))) && allText.some(t => t.includes('Devils U21s')) && sj.chapters[1].beats[4] === 'Predicted thirty-nine to thirty-five point eight. The model has Parker at fifty-six percent.' &&
  sj.open.startsWith('Gameweek six.') && sj.chapters[3].beats[4] === 'First ever meeting. Predicted thirty-three point six to thirty-nine point nine. Jacob, sixty-three percent.');
check('em dash replaced by a comma', sj.chapters[1].beats[2] === 'Devils U21s. Five games, five defeats, and PJ still leads this derby four to three.', sj.chapters[1].beats[2]);

/* A3 · the renderer voices the written script when the repo says 404 */
console.log('--- A3 renderer fallback');
props.ELEVENLABS_API_KEY = 'el-test'; reset();
const rs = ctx.showTick();
check('showTick renders the written script (repo 404): 22 clips', rs.rendered.length === 22 && tts.length === 22 && rs.source === 'sheet' && gh.length === 1 && logs.some(l => /the written script/.test(l)), ctx.emtShowSummary(rs));
check('the voice gets words, never digits (bar the club name Devils U21s)', tts.every(t => !/\d/.test(t.split('Devils U21s').join(''))) && tts.includes(sj.chapters[1].beats[4]) && tts[0] === sj.open && tts[21] === sj.close);
check('keys stored for doGet (open, c1b0..c4b4, close)', JSON.parse(props.EMT_SHOW_KEYS_6).length === 22);

/* A4 · doGet ?show=6 */
console.log('--- A4 doGet');
reset(); cache = {};
const g = JSON.parse(ctx.doGet({ parameter: { show: '6' } }).t);
check('doGet ?show=6 includes script (from ShowScripts) and the old fields', g.ok === true && g.gw === 6 && g.complete === true && Object.keys(g.clips).length === 22 && g.script && g.script.source === 'ai' &&
  g.script.chapters.length === 4 && Object.values(g.clips).every(c => c.b64 && c.secs > 0 && c.hash), Object.keys(g).join(','));
const gm = JSON.parse(ctx.doGet({ parameter: { show: '6', meta: '1' } }).t);
check('&meta=1 omits b64, keeps secs/hash/complete/script', gm.ok === true && gm.complete === true && Object.keys(gm.clips).length === 22 && Object.values(gm.clips).every(c => !('b64' in c) && c.secs > 0 && c.hash) && gm.script && gm.script.source === 'ai' &&
  JSON.stringify(gm).length < JSON.stringify(g).length / 5, JSON.stringify(gm).length + ' vs ' + JSON.stringify(g).length);
check('repo lookup cached: two doGets, one GitHub fetch', gh.length === 1, gh.length + ' fetches');
SHOW[6] = JSON.parse(fs.readFileSync(__dirname + '/fixtures/gw6.backup.json', 'utf8')); cache = {};
const gr = JSON.parse(ctx.doGet({ parameter: { show: '6', meta: 'true' } }).t);
check('repo json exists -> script is the repo json (precedence)', gr.script && !gr.script.source && gr.script.written === '2026-10-07' && gr.script.chapters[0].beats[0].startsWith('Kobbie Mainoo Fan. Top of the table'));
reset(); const rr = ctx.renderShow(6);
check('renderer: the repo json wins over ShowScripts', !rr.source && rr.rendered.length > 0 && tts.includes(SHOW[6].chapters[0].beats[0]) && !tts.some(t => t === sj.chapters[0].beats[0]), ctx.emtShowSummary(rr));
delete SHOW[6]; cache = {};
const g9 = JSON.parse(ctx.doGet({ parameter: { show: '9' } }).t);
check('unknown gameweek: script null', g9.ok === true && g9.script === null && Object.keys(g9.clips).length === 0 && g9.complete === false);
props.EMT_PIN_X = 'h'; const g0 = JSON.parse(ctx.doGet().t); delete props.EMT_PIN_X;
check('doGet() without show unchanged', JSON.stringify(Object.keys(g0)) === JSON.stringify(['ok', 'service', 'claimed']) && g0.service === 'emt');
delete props.ELEVENLABS_API_KEY;

/* ===================== validation and the retry ===================== */
console.log('--- A2 validation');
const prompt = ctx.emtShowPrompt(6, FACTS, Date.now() + 20 * H);
const cg = ctx.emtShowCheck(asText(goodReply()), FACTS, prompt.allowed, 'end_turn');
check('emtShowCheck: the good reply has no problems', cg.problems.length === 0, cg.problems.join(' | '));
check('the invented number is really not in the prompt', !prompt.allowed.includes('8123'));
const cb = ctx.emtShowCheck(asText(badReply()), FACTS, prompt.allowed, 'end_turn');
check('emtShowCheck: wrong star, invented number, missing fixture all found', cb.problems.some(p => /star\.h "999999"/.test(p)) && cb.problems.some(p => /8123/.test(p)) && cb.problems.some(p => /Missing chapter: In It to McGinn It v Team Jacob/.test(p)), cb.problems.join(' | '));
const variants = [
  ['4 beats', r => { r.chapters[0].beats.pop(); }, /needs exactly 5 beats/],
  ['an empty beat', r => { r.chapters[0].beats[2] = '  '; }, /needs exactly 5 beats/],
  ['a 34-word beat', r => { r.chapters[0].beats[1] = Array(35).join('word '); }, /34 words/],   // v3.13: beats are 10 to 22 words, refused over 32 (was 16 and 26)
  ['a 3-word beat', r => { r.chapters[0].beats[1] = 'Hall. Leads. Eleven.'; }, /3 words/],
  ['a fixture twice', r => { r.chapters.push(JSON.parse(JSON.stringify(r.chapters[0]))); }, /more than one chapter/],
  ['a home/away swap', r => { const c = r.chapters[0]; const t = c.home; c.home = c.away; c.away = t; }, /is not a fixture in FACTS/],
  ['star.a from the home side', r => { r.chapters[0].star.a = '487838'; }, /star\.a "487838"/],
  ['empty open', r => { r.open = ''; }, /"open" is empty/],
  ['empty close', r => { r.close = ' '; }, /"close" is empty/],
  ['an invented decimal', r => { r.chapters[2].beats[1] = 'Haaland goes to Anfield on 7.7 points, the top projection.'; }, /7\.7/]];
const vres = variants.map(([n, f, re]) => { const r = goodReply(); f(r); const c = ctx.emtShowCheck(JSON.stringify(r), FACTS, prompt.allowed, 'end_turn'); return [n, c.problems.some(p => re.test(p)), c.problems.join(' | ')]; });
check('emtShowCheck catches ' + variants.length + ' more faults', vres.every(v => v[1]), vres.filter(v => !v[1]).map(v => v[0] + ': ' + v[2]).join(' || '));
check('not JSON / cut off -> clear problem', /not one JSON object/.test(ctx.emtShowCheck('Sorry, no.', FACTS, prompt.allowed, 'end_turn').problems[0]) && /cut off/.test(ctx.emtShowCheck('{"open":"Gamew', FACTS, prompt.allowed, 'max_tokens').problems[0]));

clearScripts(); reset(); setDeadline(20); ageFacts(0); CLAUDE = [{ text: asText(badReply()) }, { text: asText(goodReply()) }];
w = ctx.showWriterTick();
const retryUser = claude[1] && claude[1].body.messages[0].content;
check('bad reply -> retried once in the same run with the problems listed, then stored', claude.length === 2 && w.written === true && scriptRows(6).length === 1 && props.EMT_SHOW_TRIES_6 === '1' &&
  retryUser.startsWith(claude[0].body.messages[0].content) && /YOUR LAST REPLY WAS REJECTED/.test(retryUser) && /star\.h "999999"/.test(retryUser) && /8123/.test(retryUser) && /Missing chapter/.test(retryUser),
  JSON.stringify({ calls: claude.length, stopped: w.stopped }));
clearScripts(); reset(); CLAUDE = [{ text: asText(badReply()) }, { text: asText(badReply()) }];
w = ctx.showWriterTick();
check('bad twice -> nothing stored, logged, attempt counted', claude.length === 2 && !w.written && w.stopped === 'invalid' && scriptRows(6).length === 0 && props.EMT_SHOW_TRIES_6 === '1' &&
  logs.some(l => /attempt 1 of 3 failed, nothing kept/.test(l)) && !('EMT_SHOW_WRITING' in props));
reset(); CLAUDE = [{ code: 529, body: '{"type":"error","error":{"type":"overloaded_error"}}' }];
w = ctx.showWriterTick();
check('Claude API 529 -> not counted, stops this run', claude.length === 1 && w.stopped === 'http' && props.EMT_SHOW_TRIES_6 === '1' && logs.some(l => /Claude API 529/.test(l) && /not counted/.test(l)));
reset(); CLAUDE = [{ text: asText(badReply()) }, { text: asText(badReply()) }, { text: asText(badReply()) }, { text: asText(badReply()) }];
const t2 = ctx.showWriterTick(), t3 = ctx.showWriterTick(); const callsAfter3 = claude.length;
const t4 = ctx.showWriterTick();
check('3-attempt cap: attempts 2 and 3 run (2 calls each), the 4th tick makes no call', callsAfter3 === 4 && claude.length === 4 && props.EMT_SHOW_TRIES_6 === '3' && t2.stopped === 'invalid' && t3.stopped === 'invalid' && t4.stopped === 'tries' && scriptRows(6).length === 0);
clearScripts(); reset(); props.EMT_SHOW_MODEL = 'claude-opus-4-1'; CLAUDE = [{ text: asText(goodReply()) }];
w = ctx.showWriterTick(); delete props.EMT_SHOW_MODEL;
check('EMT_SHOW_MODEL overrides the model (and is stored in the Model column)', claude[0].body.model === 'claude-opus-4-1' && scriptRows(6)[0][2] === 'claude-opus-4-1');
reset(); props.EMT_SHOW_WRITING = String(Date.now()); clearScripts(); CLAUDE = [{ text: asText(goodReply()) }];
w = ctx.showWriterTick(); delete props.EMT_SHOW_WRITING; CLAUDE = [];
check('another write in progress -> busy, no call', w.stopped === 'busy' && claude.length === 0);
reset(); w = ctx.showWriterTick(Date.now() - 200e3);
check('aiTick run already 200 s old -> leaves it for the next run', w.stopped === 'time' && claude.length === 0);

/* ===================== A5 · aiTick ===================== */
console.log('--- A5 aiTick');
const real = { aiWriterTick: ctx.aiWriterTick, showWriterTick: ctx.showWriterTick, showTick: ctx.showTick, selfUpdateTick: ctx.selfUpdateTick }, order = [];
Object.keys(real).forEach(k => { ctx[k] = () => { order.push(k); throw new Error(k + ' down'); }; });
reset(); let threw = null;
try { ctx.aiTick(); } catch (e) { threw = e; }
Object.keys(real).forEach(k => { ctx[k] = real[k]; });
check('every part throwing: all four still run, in order; the AI writer error surfaces last', order.join(',') === 'aiWriterTick,showWriterTick,showTick,selfUpdateTick' && threw && threw.message === 'aiWriterTick down' &&
  logs.some(l => /Show writer failed: showWriterTick down/.test(l)) && logs.some(l => /Gameweek Show failed: showTick down/.test(l)) && logs.some(l => /Self-update failed: selfUpdateTick down/.test(l)), order.join(','));
order.length = 0; ctx.aiWriterTick = () => { order.push('ai'); }; ctx.showWriterTick = () => { order.push('sw'); throw new Error('x'); };
threw = null; try { ctx.aiTick(); } catch (e) { threw = e; }
Object.keys(real).forEach(k => { ctx[k] = real[k]; });
check('a show writer error is logged, never thrown', threw === null && order.join(',') === 'ai,sw');

/* ===================== B · self-update ===================== */
console.log('--- B self-update');
const NEW = src.replace(/\r\n/g, '\n');
Object.keys(props).filter(k => /^EMT_SELF_/.test(k)).forEach(k => { delete props[k]; });   // the A5 aiTick above ran a real self-update
const state = () => props.EMT_SELF_STATE || '';
const puts = () => api.filter(a => a.method === 'put');
const ungate = () => { delete props.EMT_SELF_CHECKED; };
freshProject(OLD); RAW = { code: 200, text: NEW };
reset(); props.EMT_SELF_UPDATE = 'off';
let s = ctx.selfUpdateTick();
check('EMT_SELF_UPDATE = off -> nothing at all', s.stopped === 'disabled' && raw.length === 0 && api.length === 0 && !props.EMT_SELF_CHECKED);
delete props.EMT_SELF_UPDATE;
reset(); PROJ.mode.content403 = true;
s = ctx.selfUpdateTick();
check('Apps Script API 403 -> off: state, no PUT, logged', /^off: the Apps Script API is not turned on/.test(state()) && puts().length === 0 && raw.length === 1 && /\?cb=\d+$/.test(raw[0]) && api.length === 1 && api[0].auth === 'Bearer oauth-token' && api[0].mute === true &&
  logs.filter(l => /Self-update: off:/.test(l)).length === 1, state());
reset(); s = ctx.selfUpdateTick();
check('60-minute gate: a second tick within the hour fetches nothing', s.stopped === 'gate' && raw.length === 0 && api.length === 0);
reset(); ungate(); s = ctx.selfUpdateTick();
check('still off later the same day: state kept, not logged again', /^off:/.test(state()) && logs.filter(l => /Self-update: off:/.test(l)).length === 0);
props.EMT_SELF_CHECKED = String(Date.now() - 61 * 60e3); reset(); PROJ.mode.content403 = false; PROJ.mode.depl403 = false;
const refusals = [
  ['missing selfUpdateTick marker', NEW.replace(/function selfUpdateTick/g, 'function selfUpdateTock'), /^refused: .*missing "function selfUpdateTick"/],
  ['missing EL MATADOR TIRE', NEW.replace(/EL MATADOR TIRE/g, 'EL MATADOR TYRE'), /^refused: .*missing "EL MATADOR TIRE"/],
  ['syntax error', NEW + '\nfunction broken( {\n', /^refused: .*syntax error/],
  ['too short', NEW.slice(0, 40000), /^refused: .*too short/]];
const refRes = refusals.map(([n, text, re]) => { reset(); ungate(); RAW = { code: 200, text }; ctx.selfUpdateTick(); return [n, re.test(state()) && api.length === 0, state()]; });
check('fetched source refused (marker, marker, syntax, size): no API call, no PUT', refRes.every(r => r[1]), refRes.filter(r => !r[1]).map(r => r[0] + ': ' + r[2]).join(' | '));
reset(); ungate(); RAW = { code: 404, text: '404: Not Found' }; s = ctx.selfUpdateTick();
check('GitHub 404 -> logged, stop, nothing else', s.stopped === 'fetch' && api.length === 0 && logs.some(l => /GitHub answered HTTP 404/.test(l)));
RAW = { code: 200, text: NEW };
// the update
reset(); ungate(); const manifestBefore = PROJ.files[0].source, helperBefore = PROJ.files[2].source;
s = ctx.selfUpdateTick();
const pc = puts().find(a => a.path === '/content'), pv = api.find(a => a.method === 'post' && a.path === '/versions'), pd = puts().find(a => /^\/deployments\//.test(a.path));
check('new source: PUT content with all 3 files, manifest and Helpers untouched, Code replaced', pc && pc.body.files.length === 3 && pc.body.files[0].name === 'appsscript' && pc.body.files[0].type === 'JSON' && pc.body.files[0].source === manifestBefore &&
  pc.body.files[2].source === helperBefore && pc.body.files[1].name === 'Code' && pc.body.files[1].source.replace(/\n$/, '') === NEW.replace(/\s+$/, '') && !('functionSet' in pc.body.files[1]), state());
check('version created with "auto v3.12"', pv && pv.body.description === 'auto ' + VER && PROJ.versions === 13);
check('the API URL deployment is updated (not HEAD, not the other one)', pd && pd.path === '/deployments/AKfycbwLIVE123' && pd.body.deploymentConfig.versionNumber === 13 && pd.body.deploymentConfig.scriptId === 'SCRIPT1' &&
  pd.body.deploymentConfig.manifestFileName === 'appsscript' && pd.body.deploymentConfig.description === 'auto ' + VER && PROJ.deployments[1].deploymentConfig.versionNumber === 3 && puts().length === 2);
check('order: read, list deployments, then write (deployment chosen before anything is written)', api.map(a => a.method + ' ' + a.path.replace(/\?.*/, '')).join(', ') === 'get /content, get /deployments, put /content, post /versions, put /deployments/AKfycbwLIVE123', api.map(a => a.method + ' ' + a.path.replace(/\?.*/, '')).join(', '));
check('state: updated to v3.12 v13 at <ISO>', vx(/^updated to v3\.12 v13 at \d{4}-\d{2}-\d{2}T/).test(state()) && s.ok === true && !props.EMT_SELF_PENDING && !!props.EMT_SELF_LAST_HASH && /found by the API URL in Specials/.test(props.EMT_SELF_UPDATED), state());
reset(); ungate(); s = ctx.selfUpdateTick();
check('same source -> current, no PUT', vx(/^current: v3\.12/).test(state()) && puts().length === 0 && api.length === 1, state());
// drift
PROJ.files[1].source = NEW + '\n// hotfix typed in the editor\n';
reset(); ungate(); s = ctx.selfUpdateTick();
check('edited by hand after the update -> drift, left alone', /^drift:/.test(state()) && puts().length === 0, state());
reset(); UI = { alerts: [], alert(m) { this.alerts.push(m); } }; TRIGGERS = [];
s = ctx.selfUpdateNow();
check('selfUpdateNow overwrites the hand edit, alerts the result, installs the missing aiTick trigger', vx(/^updated to v3\.12 v14/).test(state()) && puts().length === 2 && UI.alerts.length === 1 && vx(/Code\.gs self-update: updated to v3\.12 v14/).test(UI.alerts[0]) &&
  /trigger was missing/.test(UI.alerts[0]) && TRIGGERS.join() === 'aiTick', UI.alerts[0]);
UI = null; reset(); s = ctx.selfUpdateNow();
check('selfUpdateNow from the editor (no UI): logs instead; trigger not duplicated', /^current/.test(state()) && logs.some(l => /^Code\.gs self-update: current/.test(l)) && TRIGGERS.length === 1);
reset(); ctx.selfUpdateStatus();
check('selfUpdateStatus logs the state', logs.length === 1 && vx(/Self-update: current: v3\.12/).test(logs[0]) && vx(/Last update: updated to v3\.12 v14/).test(logs[0]), logs[0]);
// downgrade
freshProject(NEW.replace(' * ' + VER + ' · ', ' * v99.0 · ')); reset(); ungate();
s = ctx.selfUpdateTick();
check('repo older than the project (' + VER + ' < v99.0) -> refused, no PUT', vx(/^refused: the repo has v3\.12 but this project runs v99\.0/).test(state()) && puts().length === 0, state());
// deployment choice
freshProject(OLD); props.EMT_SELF_DEPLOYMENT = 'AKfycbOTHER'; delete props.EMT_SELF_LAST_HASH; reset(); ungate();
s = ctx.selfUpdateTick(); delete props.EMT_SELF_DEPLOYMENT;
check('EMT_SELF_DEPLOYMENT wins', puts().some(a => a.path === '/deployments/AKfycbOTHER') && !puts().some(a => a.path === '/deployments/AKfycbwLIVE123'));
freshProject(OLD); PROJ.deployments = PROJ.deployments.filter(d => d.deploymentId !== 'AKfycbwLIVE123'); delete props.EMT_SELF_LAST_HASH; reset(); ungate();
s = ctx.selfUpdateTick();
check('no API URL match, one versioned web app -> that one', puts().some(a => a.path === '/deployments/AKfycbOTHER') && /found by the only web app deployment/.test(props.EMT_SELF_UPDATED));
freshProject(OLD); PROJ.deployments[2].entryPoints[0].webApp.url = 'https://script.google.com/macros/s/AKfycbwLIVE123-moved/exec'; PROJ.deployments[2].deploymentId = 'AKfycbMOVED'; delete props.EMT_SELF_LAST_HASH; reset(); ungate();
s = ctx.selfUpdateTick();
check('two web apps, neither at the API URL -> refused before any write', /^refused: 2 web app deployments/.test(state()) && puts().length === 0 && PROJ.files[1].source === OLD, state());
freshProject(OLD); PROJ.files[1].name = 'Main'; PROJ.files.push({ name: 'Code', type: 'SERVER_JS', source: 'function notIt() {}' }); delete props.EMT_SELF_LAST_HASH; reset(); ungate();
s = ctx.selfUpdateTick();
const pc2 = puts().find(a => a.path === '/content');
check('several SERVER_JS files: the one with doPost is replaced, the rest untouched', pc2 && pc2.body.files.find(f => f.name === 'Main').source.startsWith('/*') && pc2.body.files.find(f => f.name === 'Main').source.includes('function selfUpdateTick') && pc2.body.files.find(f => f.name === 'Code').source === 'function notIt() {}');
// half state, then resumed
freshProject(OLD); delete props.EMT_SELF_LAST_HASH; PROJ.mode.depFail = true; reset(); ungate();
s = ctx.selfUpdateTick();
check('content PUT ok but the deployment update fails -> half state recorded clearly, pending kept', vx(/^half: the code is v3\.12 \(the triggers already run it\) but the web app still runs the old version/).test(state()) && JSON.parse(props.EMT_SELF_PENDING).version === 13 && !props.EMT_SELF_LAST_HASH, state());
PROJ.mode.depFail = false; reset(); ungate();
s = ctx.selfUpdateTick();
check('next check finishes it: no second content PUT, no new version, deployment switched', vx(/^updated to v3\.12 v13/).test(state()) && !api.some(a => a.method === 'put' && a.path === '/content') && !api.some(a => a.path === '/versions') && puts().length === 1 && !props.EMT_SELF_PENDING, state());
freshProject(OLD); delete props.EMT_SELF_LAST_HASH; PROJ.mode.versionFail = true; reset(); ungate();
s = ctx.selfUpdateTick(); PROJ.mode.versionFail = false;
check('version save fails -> half, resumed next check', /^half: .*saving a version failed/.test(state()) && (reset(), ungate(), ctx.selfUpdateTick(), vx(/^updated to v3\.12 v13/).test(state())), state());
freshProject(OLD); delete props.EMT_SELF_LAST_HASH; PROJ.mode.depl403 = true; reset(); ungate();
s = ctx.selfUpdateTick(); PROJ.mode.depl403 = false;
check('deployments scope missing -> off:, no PUT', /^off: appsscript\.json lacks/.test(state()) && puts().length === 0, state());
freshProject(OLD); delete props.EMT_SELF_LAST_HASH; PROJ.mode.putFail = true; reset(); ungate();
s = ctx.selfUpdateTick(); PROJ.mode.putFail = false;
check('content PUT fails -> error, nothing pending, no version', /^error: writing the new code failed, HTTP 500/.test(state()) && !props.EMT_SELF_PENDING && !api.some(a => a.path === '/versions'), state());
reset(); props.EMT_SELF_CHECKED = String(Date.now() - 61 * 60e3); s = ctx.selfUpdateTick(Date.now() - 301e3);
check('aiTick run already 5 minutes old -> skipped, gate untouched', s.stopped === 'late' && raw.length === 0 && Number(props.EMT_SELF_CHECKED) < Date.now() - 60 * 60e3);
reset(); props.EMT_SELF_BUSY = String(Date.now()); ungate(); s = ctx.selfUpdateTick(); delete props.EMT_SELF_BUSY;
check('another update running -> busy, nothing fetched', s.stopped === 'busy' && raw.length === 0);


/* ===================== review fixes (independent review of v3.12) ===================== */
console.log('--- review fixes');
// R1 · showfacts must carry every fixture of the gameweek when H2H Fixtures has it (a partial post would replace the full one)
cache = {}; setDeadline(20);
const partial = JSON.stringify(Object.assign({}, FACTS, { fixtures: FACTS.fixtures.slice(0, 3) }));
const before = factsRows(6).map(r => r.join('|')).join('/');
check('R1 partial fixtures (3 of 4) -> badfacts, stored facts untouched', post('Cold Palmers', tokCP, { facts: partial }).error === 'badfacts' && factsRows(6).map(r => r.join('|')).join('/') === before);
// R2 · the size limit also holds after re-serialising (1e20 is 4 characters in, 21 out)
const inflate = (() => { const base = JSON.stringify(Object.assign({}, FACTS, { pad: [] })); const n = Math.floor((59990 - base.length) / 5); return base.slice(0, -2) + Array(n).fill('1e20').join(',') + ']}'; })();
check('R2 facts under 60,000 characters that re-serialise past it -> badfacts', inflate.length <= 60000 && JSON.stringify(JSON.parse(inflate)).length > 60000 && post('Cold Palmers', tokCP, { facts: inflate }).error === 'badfacts' && factsRows(6).map(r => r.join('|')).join('/') === before);
// R3 · emtShowFactsLatest: rows replaced between its two reads (same GW and part numbers, another post) -> null, never a mix
{
  const sh = sheets.ShowFacts, orig = sh.getRange.bind(sh); let calls = 0;
  sh.getRange = function (r, c, nr, nc) { calls++; if (calls === 2) sh.rows.forEach((row, i) => { if (i && Number(row[0]) === 6) { row[1] = "'2099-01-01T00:00:00.000Z"; row[2] = 'Devils U21s'; } }); return orig(r, c, nr, nc); };
  const got = ctx.emtShowFactsLatest(6, true); sh.getRange = orig;
  check('R3 facts replaced under the reader (same row numbers, another post) -> null', got === null, JSON.stringify(got && got.iso));
  sh.rows.forEach((row, i) => { if (i && Number(row[0]) === 6) { row[1] = "'" + iso(Date.now()); row[2] = 'Team Jacob'; } });
}
// R4 · emtSpeak: money, clock times with am/pm, decimals glued to a letter, names kept
const speak2 = [['£5.5m', 'five point five million pounds'], ['£10m', 'ten million pounds'], ['£1', 'one pound'], ['£4.5 million', 'four point five million pounds'], ['£5 more', 'five pounds more'],
  ['10:30am', 'ten thirty am'], ['10.30am', 'ten thirty am'], ['9:05 pm', 'nine oh five pm'], ['11am', 'eleven am'], ['10:00', 'ten'], ['1.5x', 'one point five x'],
  ['Devils U21s 4-3', 'Devils U21s four to three'], ['U23s', 'U23s'], ['H2H', 'H2H'], ['105', 'one hundred and five'], ['999', 'nine hundred and ninety-nine'], ['99', 'ninety-nine'], ['21', 'twenty-one'],
  ["Deadline 10.30am Saturday, Devils U21s 5th on 9.", 'Deadline ten thirty am Saturday, Devils U21s fifth on nine.']];
const sp2 = speak2.filter(([i, o]) => ctx.emtSpeak(i, ['Devils U21s']) !== o).map(([i, o]) => i + ' -> ' + ctx.emtSpeak(i, ['Devils U21s']) + ' (want ' + o + ')');
check('R4 emtSpeak: ' + speak2.length + ' more cases (money, am/pm, glued decimals)', sp2.length === 0, sp2.join(' | '));
check('R4 no invisible characters left in Code.gs (the tag markers are \\uE000 escapes)', !/[-]/.test(src));
// R5 · the number guard counts whole numbers, not substrings
const P5 = ctx.emtShowPrompt(6, FACTS, Date.now() + 20 * H);
const guard = beat => { const r = goodReply(); r.chapters[2].beats[0] = beat; return ctx.emtShowCheck(JSON.stringify(r), FACTS, P5.allowed, 'end_turn').problems.filter(p => /The number/.test(p)); };
check('R5 77 is only inside other numbers in the prompt (a player code), so it is invented', P5.allowed.includes('77') && !/(^|[^\d.])77(?![\d])/.test(P5.allowed));
check('R5 invented whole number (77) -> flagged (the substring check let it through)', guard('I Am a Baleba. Ethan put 77 on PJ last week, his best of the season.').some(p => /The number 77 /.test(p)));
check('R5 a real total (240), a real decimal (5.3), a percent (55%), U21s, a count (3) -> fine', guard('I Am a Baleba. CJ has 240, Haaland 5.3, the model 55%, Devils U21s won 3.').length === 0, guard('I Am a Baleba. CJ has 240, Haaland 5.3, the model 55%, Devils U21s won 3.').join(' | '));
check('R5 a result margin (W54-32 is by 22) is allowed; a sum (36 between them) is not', guard('I Am a Baleba. Ethan beat PJ by 22 last week, his best of the season.').length === 0 && guard('I Am a Baleba. Ethan and PJ scored 86 between them last week.').some(p => /86/.test(p)));
check('R5 the integer part of a sent decimal (39.9 -> 39) is allowed; 1,200 reads as 1200', guard('I Am a Baleba. The model has them on 39, a long way short of 1,200.').some(p => /1200/.test(p)) && !guard('I Am a Baleba. The model has them on 39, roughly.').length);
check('R5 the allowed set reads a JSON array [5,240] as 5 and 240 (and 5240), and 1,200 as 1200', (a => a['5'] && a['240'] && a['5240'] && a['1200'])(ctx.emtShowAllowed('{"x":[5,240],"t":"1,200"}')));
check('R5 the shipped good reply still passes', ctx.emtShowCheck(asText(goodReply()), FACTS, P5.allowed, 'end_turn').problems.length === 0);
// R6 · a non-text open/beat is empty, never "[object Object]"
{ const r = goodReply(); r.open = { text: 'Gameweek 6.' }; r.chapters[0].beats[1] = 42; const c = ctx.emtShowCheck(JSON.stringify(r), FACTS, P5.allowed, 'end_turn');
  check('R6 open as an object / a beat as a number -> problems, not "[object Object]"', c.problems.some(p => /"open" is empty/.test(p)) && c.problems.some(p => /needs exactly 5 beats/.test(p)), c.problems.join(' | ')); }
// R7 · self-update: a repo copy that throws as it loads is refused (it would break every trigger and the web app)
Object.keys(props).filter(k => /^EMT_SELF_/.test(k)).forEach(k => { delete props[k]; });
freshProject(OLD); reset(); ungate();
RAW = { code: 200, text: NEW.replace('var EMT_SELF_MIN_CHARS = 50000;', 'var EMT_SELF_MIN_CHARS = EMT_NOT_DEFINED.x;') };
s = ctx.selfUpdateTick();
check('R7 throws as it loads -> refused, no API call', /^refused: .*an error as it loads/.test(state()) && api.length === 0, state());
reset(); ungate(); RAW = { code: 200, text: NEW.replace(/function doGet\(/g, 'function doGot(').replace(/function doGet /g, 'function doGot ') + '\n// function doGet\n' };
s = ctx.selfUpdateTick();
check('R7 no doGet function of its own (only the word; the running code has one) -> refused', /^refused: .*no doGet function of its own/.test(state()) && api.length === 0, state());
RAW = { code: 200, text: NEW };
// R8 · the manifest must keep "webapp", or the new version would not be a web app
freshProject(OLD); PROJ.files[0].source = '{\n  "timeZone": "Europe/London",\n  "runtimeVersion": "V8"\n}'; reset(); ungate();
s = ctx.selfUpdateTick();
check('R8 appsscript.json without "webapp" -> refused before any write', /^refused: appsscript\.json has no "webapp" section/.test(state()) && puts().length === 0 && !api.some(a => a.path === '/versions'), state());
// R9 · pasted by hand (editor = repo) but never deployed: the next check deploys it (no content write)
freshProject(NEW); PROJ.snap[12][1].source = OLD; delete props.EMT_SELF_LAST_HASH; delete props.EMT_SELF_PENDING; reset(); ungate();   // the web app (v12) still runs v3.11
s = ctx.selfUpdateTick();
check('R9 editor current, web app on the old version -> version saved and the web app switched, no content PUT', vx(/^updated to v3\.12 v13/).test(state()) && !api.some(a => a.method === 'put' && a.path === '/content') &&
  api.map(a => a.method + ' ' + a.path.replace(/\?.*/, '')).join(', ') === 'get /content, get /deployments, get /content, post /versions, put /deployments/AKfycbwLIVE123' && PROJ.deployments[2].deploymentConfig.versionNumber === 13 && !props.EMT_SELF_PENDING && !!props.EMT_SELF_LAST_HASH,
  state() + ' :: ' + api.map(a => a.method + ' ' + a.path).join(', '));
reset(); ungate(); s = ctx.selfUpdateTick();
check('R9 next check: current, one API read only', vx(/^current: v3\.12/).test(state()) && api.length === 1, state());
freshProject(NEW); PROJ.snap[12] = JSON.parse(JSON.stringify(PROJ.files)); delete props.EMT_SELF_LAST_HASH; reset(); ungate();
s = ctx.selfUpdateTick();
check('R9 pasted by hand and deployed by hand -> current, no version saved', vx(/^current: v3\.12/).test(state()) && !api.some(a => a.path === '/versions') && puts().length === 0 && PROJ.versions === 12 && !!props.EMT_SELF_LAST_HASH, state());
reset(); UI = null; s = ctx.selfUpdateNow();
check('R9 selfUpdateNow when current checks the web app too (and leaves it when it matches)', vx(/^current: v3\.12/).test(state()) && api.some(a => /versionNumber=12/.test(a.path)) && puts().length === 0, state());
freshProject(NEW); PROJ.deployments[1].deploymentId = 'AKfycbX'; PROJ.deployments[2].entryPoints[0].webApp.url = 'https://script.google.com/macros/s/AKfycbY/exec'; PROJ.deployments[2].deploymentId = 'AKfycbY'; delete props.EMT_SELF_LAST_HASH; reset(); ungate();
s = ctx.selfUpdateTick();
check('R9 web app cannot be picked -> current with the reason, checked again next time', vx(/^current: v3\.12 in the editor, but the web app could not be checked/).test(state()) && puts().length === 0 && !props.EMT_SELF_LAST_HASH, state());
// R10 · a Cloud project with the API off is reported as such
freshProject(OLD); reset(); ungate();
const apiOrig = ctx.UrlFetchApp.fetch;
ctx.UrlFetchApp.fetch = (u, o) => /script\.googleapis\.com/.test(u) ? resp(403, { error: { code: 403, message: 'Apps Script API has not been used in project 123456 before or it is disabled. Enable it by visiting https://console.developers.google.com/apis/api/script.googleapis.com/overview?project=123456 then retry.', status: 'PERMISSION_DENIED' } }) : apiOrig(u, o);
s = ctx.selfUpdateTick(); ctx.UrlFetchApp.fetch = apiOrig;
check('R10 API off in the Cloud project -> off: names the Cloud project, not usersettings', /^off: the Apps Script API is off in this script's Google Cloud project/.test(state()), state());
// R11 · setup() installs aiTick even with no keys (the self-update rides it)
{ const keep = { a: props.ANTHROPIC_API_KEY, e: props.ELEVENLABS_API_KEY }, ra = ctx.refreshAll; delete props.ANTHROPIC_API_KEY; delete props.ELEVENLABS_API_KEY;
  ctx.refreshAll = () => {}; TRIGGERS = ['refreshAll', 'liveTick']; ctx.setup(); ctx.refreshAll = ra;
  if (keep.a) props.ANTHROPIC_API_KEY = keep.a; if (keep.e) props.ELEVENLABS_API_KEY = keep.e;
  check('R11 setup() with no keys still installs aiTick', TRIGGERS.slice().sort().join() === 'aiTick,liveTick,refreshAll', TRIGGERS.join()); }

console.log(fails ? fails + ' FAILED' : 'ALL PASS');
