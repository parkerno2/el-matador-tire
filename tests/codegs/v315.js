// v3.15 tests: the facts from the repo (the Facts bot). Code.gs reads facts/index.json and facts/<kind>-gw<N>.json
// from the repo's facts branch whenever a phone's facts are missing or older, after the checks a phone's post passes.
//   cd /home/claude/emt && node tests/codegs/v315.js
// Harness as in v314.js (vm, a mock Sheet, PropertiesService, CacheService, LockService, UrlFetchApp), plus a mock of
// raw.githubusercontent.com (REPO: name -> { code, text }, RAW_THROW) and a Batches API that never finishes.
const fs = require('fs'), crypto = require('crypto'), vm = require('vm');
const CODE = __dirname + '/../../Code.gs';
const src = fs.readFileSync(CODE, 'utf8');
const F = require(__dirname + '/v313-fixtures.js');
const RECAP = F.RECAP, PREV = F.previewFacts();

function Sheet(name, rows) { this.name = name; this.rows = rows || []; this.hidden = false; this.frozen = 0; this.tight = false; }
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
Sheet.prototype.deleteRows = function (r, n) { if (r < 2) throw new Error('deleteRows hit the header'); this.rows.splice(r - 1, n); };
Sheet.prototype.insertRowAfter = function () { this.tight = false; };

const H = 3600e3, D = 24 * H, iso = ms => new Date(ms).toISOString();
let sheets;
function freshSheets() {
  const h2h = F.tab('H2H Fixtures'), cf = F.tab('Club Fixtures'), st = F.tab('Standings');
  // GW5 is final (real); its last games were 2 to 3 days ago; GW6's deadline is 20 hours away
  const cfx = [cf[0]].concat(cf.slice(1).filter(r => Number(r[0]) <= 6).map(r => {
    const row = r.slice(); if (Number(row[0]) === 5) row[3] = iso(Date.now() - 3 * D + (Date.parse(r[3]) - Date.parse('2026-09-18T19:00:00Z')) / 4); return row; }));
  sheets = {
    Standings: new Sheet('Standings', st.map(r => r.slice())),
    'H2H Fixtures': new Sheet('H2H Fixtures', h2h.map(r => r.slice()).map((r, i) => i ? [Number(r[0]), r[1], Number(r[2]), r[3], Number(r[4]), r[5] === 'TRUE' || r[5] === true] : r)),
    'Club Fixtures': new Sheet('Club Fixtures', cfx),
    Matchweeks: new Sheet('Matchweeks', [['GW', 'Deadline (UTC)', 'MOTM period', 'Finished', 'Notes'], [4, "'2026-09-11T17:30:00Z", 'Aug & Sep', 'TRUE', ''], [5, "'" + iso(Date.now() - 4 * D), 'Aug & Sep', 'TRUE', ''],
      [6, "'" + iso(Date.now() + 20 * H), 'October', 'FALSE', ''], [7, "'" + iso(Date.now() + 7 * D), 'October', 'FALSE', '']]),
    Social: new Sheet('Social', [['When (UTC)', 'Team', 'Kind', 'Target', 'Value', 'Extra']]),
    Posts: new Sheet('Posts', [['When (UTC)', 'Id', 'Voice', 'Kind', 'Event', 'Teams', 'Players', 'Text', 'Facts', 'Media']]),
    Specials: new Sheet('Specials', [['Setting', 'Value']]),
  };
}
freshSheets();
let props = {}, cache = {};
const logs = [], creates = [], raw = [], other = [];
let REPO = {}, RAW_THROW = false, BSEQ = 0;
const resp = (code, body) => ({ getResponseCode: () => code, getContentText: () => typeof body === 'string' ? body : JSON.stringify(body), getContent: () => [] });
const BURL = 'https://api.anthropic.com/v1/messages/batches';
function anthropic(url, o) {
  const method = String(o.method || 'get').toLowerCase();
  if (url === BURL && method === 'post') {
    const body = JSON.parse(o.payload), req = body.requests[0];
    creates.push({ req, o }); const id = 'msgbatch_' + String(++BSEQ).padStart(4, '0');
    return resp(200, { id, type: 'message_batch', processing_status: 'in_progress', results_url: null });
  }
  if (/^https:\/\/api\.anthropic\.com\/v1\/messages\/batches\/[^/]+$/.test(url)) return resp(200, { id: 'x', processing_status: 'in_progress', results_url: null });
  throw new Error('no Claude reply queued for ' + method + ' ' + url);
}
const ctx = {
  console, JSON, Date, Math, Number, String, Object, Array, isNaN, isFinite, parseInt, encodeURIComponent, RegExp,
  SpreadsheetApp: { getActive: () => ({ getSheetByName: n => sheets[n] || null, insertSheet: n => (sheets[n] = new Sheet(n)) }), getUi: () => { throw new Error('no UI'); } },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); }, deleteProperty: k => { delete props[k]; }, getProperties: () => ({ ...props }) }) },
  CacheService: { getScriptCache: () => ({ get: k => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = String(v); }, remove: k => { delete cache[k]; } }) },
  LockService: { getScriptLock: () => ({ waitLock() {}, tryLock() { return true; }, releaseLock() {} }) },
  Utilities: { DigestAlgorithm: { SHA_256: 1, MD5: 2 }, Charset: { UTF_8: 1 }, getUuid: () => crypto.randomUUID(),
    computeDigest: (a, s) => Array.from(crypto.createHash(a === 2 ? 'md5' : 'sha256').update(s, 'utf8').digest()).map(b => b > 127 ? b - 256 : b),
    base64Encode: bytes => Buffer.from(Array.from(bytes).map(b => (b + 256) % 256)).toString('base64'),
    base64Decode: s => Array.from(Buffer.from(String(s), 'base64')).map(b => (b > 127 ? b - 256 : b)),
    computeHmacSha256Signature: (v, k) => Array.from(crypto.createHmac('sha256', Buffer.from(String(k), 'utf8')).update(String(v), 'utf8').digest()).map(b => (b > 127 ? b - 256 : b)),
    newBlob: d => { const buf = typeof d === 'string' ? Buffer.from(d, 'utf8') : Buffer.from(Array.from(d).map(b => (b + 256) % 256));
      return { getBytes: () => Array.from(buf).map(b => (b > 127 ? b - 256 : b)), getDataAsString: () => buf.toString('utf8') }; } },
  ContentService: { createTextOutput: t => ({ t, setMimeType() { return this; } }), MimeType: { JSON: 1 } },
  ScriptApp: { getScriptId: () => 'SCRIPT1', getOAuthToken: () => 'oauth', getProjectTriggers: () => [], newTrigger: () => ({ timeBased: () => ({ everyMinutes: () => ({ create() {} }), everyHours: () => ({ create() {} }) }) }) },
  Logger: { log: m => logs.push(String(m)) },
  UrlFetchApp: { fetch: (url, o) => {
    o = o || {};
    if (/^https:\/\/api\.anthropic\.com\//.test(url)) return anthropic(url, o);
    if (/^https:\/\/raw\.githubusercontent\.com\/parkerno2\/el-matador-tire\/facts\/facts\//.test(url)) {
      raw.push(url);
      if (RAW_THROW) throw new Error('Address unavailable: raw.githubusercontent.com');
      const name = url.replace(/^.*\/facts\/facts\//, '').replace(/\?.*$/, ''), f = REPO[name];
      return f ? resp(f.code || 200, f.text) : resp(404, '404: Not Found');
    }
    other.push(url);
    if (/github\.io/.test(url)) return resp(404, '<h1>404</h1>');
    if (/raw\.githubusercontent\.com/.test(url)) return resp(404, '404: Not Found');
    throw new Error('unexpected fetch ' + url);
  } },
};
vm.createContext(ctx); vm.runInContext(src, ctx);

let fails = 0;
const check = (label, cond, info) => { if (!cond) fails++; console.log((cond ? 'PASS ' : 'FAIL ') + label + (info ? '  ' + info : '')); };
const reset = () => { [logs, creates, raw, other].forEach(a => { a.length = 0; }); };
const fresh = () => { ctx.emtRepoReset(); reset(); };          // a new execution (the memo goes; the 4-minute cache stays)
const nocache = () => { cache = {}; fresh(); };
const Hd = r => ctx.emtHandle(r);
const get = p => JSON.parse(ctx.doGet({ parameter: p }).t);
const art = () => (sheets.Articles ? sheets.Articles.rows.slice(1) : []);
const row = id => art().find(r => r[0] === id);
const col = (r, name) => r[ctx.EMT_ART_HEAD.indexOf(name)];
const unq = v => String(v == null ? '' : v).replace(/^'/, '');
const job = () => (props.EMT_ART_JOB ? JSON.parse(props.EMT_ART_JOB) : null);
const tick = (force) => ctx.articleTick(Date.now(), force);
const clearArticles = () => { delete sheets.Articles; delete sheets.ArticleWork; ['EMT_ART_JOB', 'EMT_ART_QUEUE', 'EMT_ART_BUSY', 'EMT_MODEL_GONE'].forEach(k => delete props[k]); };
const md5 = s => crypto.createHash('md5').update(s, 'utf8').digest('hex');
const repoSet = (name, obj, code) => { const text = typeof obj === 'string' ? obj : JSON.stringify(obj); REPO[name] = { code: code || 200, text }; return text; };
const repoIndex = (files, extra) => repoSet('index.json', Object.assign({ files, updated: iso(Date.now() - H), app: '20261008112958', bot: 'Facts bot 1.0' }, extra || {}));
const entry = (kind, gw, at, text) => ({ kind, gw, at, chars: text.length, md5: md5(text), app: '20261008112958' });
props.ANTHROPIC_API_KEY = 'sk-test';
const tokTJ = Hd({ action: 'claim', team: 'Team Jacob', pin: '5555' }).token;
const spost = f => Hd({ action: 'showfacts', team: 'Team Jacob', token: tokTJ, gw: 6, facts: typeof f === 'string' ? f : JSON.stringify(f) });
const rpost = f => Hd({ action: 'artfacts', team: 'Team Jacob', token: tokTJ, gw: 5, kind: 'recap', facts: typeof f === 'string' ? f : JSON.stringify(f) });
const PREV_T = JSON.stringify(PREV), RECAP_T = JSON.stringify(RECAP);

/* ===================== V · the release ===================== */
console.log('--- V the release');
check('V1 the CHANGELOG\'s first version is v3.15 or later (what the self-update reads), EMT_VERSION follows it, and the v3.15 entry is there', ctx.emtSelfVersion(src) === ctx.EMT_VERSION && ctx.emtSelfCmp(ctx.EMT_VERSION, 'v3.15') >= 0 &&
  /\* v3\.15 · 8 Oct 2026\n \*   The facts without anyone's phone: the Facts bot\./.test(src));
check('V2 the facts come from the repo\'s facts branch over HTTPS, the bot is named, the index is cached 4 minutes', ctx.EMT_FACTS_SRC === 'https://raw.githubusercontent.com/parkerno2/el-matador-tire/facts/facts/' && ctx.EMT_FACTS_BOT === 'Facts bot' && ctx.EMT_FACTS_INDEX_S === 240);
const wf = fs.readFileSync(__dirname + '/../../.github/workflows/facts.yml', 'utf8');
check('V3 the Facts bot workflow runs every 3 hours and on dispatch, runs the bot, commits to the facts branch and never force-pushes', /cron: '23 \*\/3 \* \* \*'/.test(wf) && /workflow_dispatch/.test(wf) && /factsbot\.js --out facts-wt\/facts/.test(wf) &&
  /git push origin HEAD:refs\/heads\/facts/.test(wf) && !/push[^\n]*(--force|-f |force-with-lease)/.test(wf) && /node tests\/factsbot\.js/.test(wf));

/* ===================== A · no facts branch yet ===================== */
console.log('--- A no facts branch');
nocache(); let b = ctx.emtFactsBest('ShowFacts', 6, false), b2 = ctx.emtFactsBest('RecapFacts', 5, false), b3 = ctx.emtFactsBest('ShowFacts', 6, true);
check('A1 index 404, no phone facts: nothing, and GitHub read once in the run (the memo)', b === null && b2 === null && b3 === null && raw.length === 1 && /\/facts\/facts\/index\.json\?cb=\d+$/.test(raw[0]));
fresh(); b = ctx.emtFactsBest('ShowFacts', 6, false);
check('A2 the next run within 4 minutes reads nothing from GitHub (the 404 is cached as "0")', b === null && raw.length === 0 && cache.EMT_FACTS_INDEX === '0');
nocache(); b = ctx.emtFactsBest('ShowFacts', 6, false);
check('A2 ... after the cache: read again', raw.length === 1);
nocache(); let h = get({ health: '1' });
check('A3 ?health=1: version v3.15, facts {preview null, recap null, repo null}, show.facts null, show.factsFrom null', h.version === ctx.EMT_VERSION && JSON.stringify(h.facts) === '{"preview":null,"recap":null,"repo":null}' && h.show.facts === null && h.show.factsFrom === null, JSON.stringify(h.facts));
nocache(); clearArticles(); let S = tick();
check('A4 articleTick with no facts anywhere: idle, and the reasons name the phones and the Facts bot', S.stopped === 'idle' && creates.length === 0 && S.why.some(w => /recap of GW5 waits for recap facts from the app .* or from the Facts bot/.test(w)) &&
  S.why.some(w => /preview of GW6 waits for preview facts from the app or from the Facts bot/.test(w)), S.why.join(' | '));
props.EMT_SHOW_TRIES_6 = '3'; nocache(); let sw = ctx.showWriterTick(Date.now());
check('A5 showWriterTick with no facts anywhere: nofacts, the log names the Facts bot', sw.stopped === 'nofacts' && logs.some(l => /no facts from the app yet .*Facts bot/.test(l)), sw.stopped);

/* ===================== B · the repo's preview facts ===================== */
console.log('--- B repo preview facts');
const at1 = iso(Date.now() - H);
repoIndex({ 'preview-gw6.json': entry('preview', 6, at1, PREV_T) }); repoSet('preview-gw6.json', PREV_T);
nocache(); b = ctx.emtFactsBest('ShowFacts', 6, false);
check('B1 metadata: source repo, team Facts bot, the index\'s at', b && b.source === 'repo' && b.team === 'Facts bot' && b.iso === at1 && b.at === Date.parse(at1) && b.parts === 1 && !b.data && raw.length === 1, JSON.stringify(b));
b = ctx.emtFactsBest('ShowFacts', 6, true);
check('B1 with data: the file, read once, kind preview, the 4 fixtures, collisions', b && b.source === 'repo' && b.data && b.data.kind === 'preview' && b.data.fixtures.length === 4 && Array.isArray(b.data.collisions) && raw.length === 2 && /preview-gw6\.json\?cb=/.test(raw[1]));
b = ctx.emtFactsBest('ShowFacts', 6, true);
check('B1 the same run again: nothing more from GitHub (the memo)', b && b.data && raw.length === 2);
fresh(); h = get({ health: '1' });
check('B2 ?health=1: facts.preview {gw 6, at, from repo}, show.facts the same time, show.factsFrom repo, facts.repo lists the file', h.facts.preview && h.facts.preview.gw === 6 && h.facts.preview.at === at1 && h.facts.preview.from === 'repo' && h.facts.recap === null &&
  h.show.facts === at1 && h.show.factsFrom === 'repo' && h.facts.repo && h.facts.repo.files.join() === 'preview-gw6.json' && h.facts.repo.app === '20261008112958' && raw.length === 0, JSON.stringify(h.facts));
fresh(); sw = ctx.showWriterTick(Date.now());
check('B3 showWriterTick finds the repo facts (20 h to the deadline, 1 h old): it gets past the facts to the tries guard', sw.stopped === 'tries', sw.stopped);
delete props.EMT_SHOW_TRIES_6;
nocache(); clearArticles(); S = tick();
let id = S.id, R = row(id);
check('B4 articleTick: the GW6 preview job starts from the repo facts (the recap still waits for its own)', S.stopped === 'submitted' && S.kind === 'preview' && S.gw === 6 && creates.length === 1 && creates[0].req.custom_id === id + '-r' && job() && job().phase === 'research', JSON.stringify({ S: S.stopped, why: S.why }));
check('B4 ... the Articles row: Facts received = the index\'s at, the Log says sent by Facts bot, ArticleWork keeps the file\'s facts', R && unq(col(R, 'Facts received (UTC)')) === at1 && /sent by Facts bot/.test(unq(col(R, 'Log'))) && JSON.stringify(ctx.emtWorkJson(id, 'facts')) === PREV_T, R && unq(col(R, 'Log')));
const user0 = creates[0].req.params.messages[0].content;
check('B5 ... the research request is built from them (the slate and the rostered names)', typeof user0 === 'string' && user0.includes(PREV.slate[0].home) && user0.includes(PREV.fixtures[0].H.xi[0].name), String(user0).slice(0, 120));
check('B6 ... GitHub was read twice in that run (the index, the file), the cache then holds the index', raw.length === 2 && cache.EMT_FACTS_INDEX && JSON.parse(cache.EMT_FACTS_INDEX).files['preview-gw6.json']);

/* ===================== C · a phone's facts against the repo's ===================== */
console.log('--- C phone v repo');
clearArticles(); delete cache['EMT_SF_Team Jacob']; let sp = spost(PREV);
check('C0 a phone posts the same preview facts now', sp.ok === true, JSON.stringify(sp));
fresh(); b = ctx.emtFactsBest('ShowFacts', 6, false); let bd = ctx.emtFactsBest('ShowFacts', 6, true);
check('C1 the phone\'s post (now) beats the repo\'s file (an hour ago): source phone, team Team Jacob; with data too; nothing read from GitHub (the index is cached, the file is not wanted)', b.source === 'phone' && b.team === 'Team Jacob' && bd.source === 'phone' && bd.data.kind === 'preview' && raw.length === 0, JSON.stringify([b, bd && bd.source, raw]));
const at2 = iso(Date.now() + 60e3);
repoIndex({ 'preview-gw6.json': entry('preview', 6, at2, PREV_T) });
nocache(); b = ctx.emtFactsBest('ShowFacts', 6, false); bd = ctx.emtFactsBest('ShowFacts', 6, true);
check('C2 a newer repo file beats the phone\'s post: source repo, with data from the file', b.source === 'repo' && b.iso === at2 && bd.source === 'repo' && bd.team === 'Facts bot' && raw.length === 2);
const phoneAt = unq(sheets.ShowFacts.rows[1][1]);
repoIndex({ 'preview-gw6.json': entry('preview', 6, phoneAt, PREV_T) });
nocache(); b = ctx.emtFactsBest('ShowFacts', 6, false);
check('C3 the same second: the phone wins the tie', b.source === 'phone' && b.iso === phoneAt);
fresh(); h = get({ health: '1' });
check('C4 ?health=1 says phone', h.facts.preview.from === 'phone' && h.show.factsFrom === 'phone');

/* ===================== D · repo files that fail the checks ===================== */
console.log('--- D invalid repo files');
const badPrev = JSON.parse(PREV_T); const sw0 = badPrev.fixtures[0].home; badPrev.fixtures[0].home = badPrev.fixtures[0].away; badPrev.fixtures[0].away = sw0;
repoIndex({ 'preview-gw6.json': entry('preview', 6, at2, JSON.stringify(badPrev)) }); repoSet('preview-gw6.json', badPrev);
nocache(); b = ctx.emtFactsBest('ShowFacts', 6, false); bd = ctx.emtFactsBest('ShowFacts', 6, true);
check('D1 a newer repo file whose fixtures are not the sheet\'s: the metadata still says repo, the data falls back to the phone\'s, the log says why once', b.source === 'repo' && bd.source === 'phone' && bd.data.fixtures[0].home === sw0 &&
  logs.filter(l => /facts\/preview-gw6\.json is ignored: it fails a check a phone's facts must pass \(badfacts\)/.test(l)).length === 1, logs.join(' | '));
bd = ctx.emtFactsBest('ShowFacts', 6, true);
check('D1 ... asked again in the run: not logged twice, not read twice', logs.filter(l => /is ignored/.test(l)).length === 1 && raw.length === 2);
delete sheets.ShowFacts;
nocache(); bd = ctx.emtFactsBest('ShowFacts', 6, true); clearArticles(); S = tick();
check('D2 ... with no phone facts at all: no data, and articleTick starts nothing, saying the facts failed the checks', bd === null && S.stopped === 'idle' && creates.length === 0 && S.why.some(w => /preview of GW6 waits for facts from the new app .*failed the checks/.test(w)), S.why.join(' | '));
repoIndex({ 'preview-gw6.json': entry('preview', 6, at2, PREV_T) }); delete REPO['preview-gw6.json'];
nocache(); bd = ctx.emtFactsBest('ShowFacts', 6, true);
check('D3 listed in the index but 404: ignored, said so', bd === null && logs.some(l => /preview-gw6\.json is ignored: the index lists it but it is not in the facts branch/.test(l)));
repoSet('preview-gw6.json', '{"kind":"preview",'); nocache(); bd = ctx.emtFactsBest('ShowFacts', 6, true);
check('D4 a file that does not parse: ignored', bd === null && logs.some(l => /preview-gw6\.json is ignored: it does not parse/.test(l)));
repoSet('preview-gw6.json', PREV_T.slice(0, -1) + ',"pad":"' + 'x'.repeat(60000) + '"}'); nocache(); bd = ctx.emtFactsBest('ShowFacts', 6, true);
check('D5 a file over 60,000 characters: ignored', bd === null && logs.some(l => /preview-gw6\.json is ignored: over 60000 characters/.test(l)));
repoSet('preview-gw6.json', JSON.stringify(Object.assign(JSON.parse(PREV_T), { kind: 'recap' }))); nocache(); bd = ctx.emtFactsBest('ShowFacts', 6, true);
check('D5 a preview file of kind recap: ignored (badfacts, as emtShowFacts would)', bd === null && logs.some(l => /\(badfacts\)/.test(l)));
repoSet('preview-gw6.json', PREV_T);
repoIndex({ 'preview-gw6.json': { kind: 'preview', gw: 7, at: at2 } }); nocache(); b = ctx.emtFactsBest('ShowFacts', 6, false);
check('D6 an index entry whose gw is another gameweek: nothing', b === null);
repoIndex({ 'preview-gw6.json': { kind: 'preview', gw: 6 } }); nocache(); b = ctx.emtFactsBest('ShowFacts', 6, false);
check('D6 an index entry without at: nothing', b === null);
repoIndex({ 'preview-gw6.json': { kind: 'recap', gw: 6, at: at2 } }); nocache(); b = ctx.emtFactsBest('ShowFacts', 6, false);
check('D6 an index entry of the other kind under a preview name: nothing', b === null);
repoSet('index.json', '{"files":'); nocache(); b = ctx.emtFactsBest('ShowFacts', 6, false); h = get({ health: '1' });
check('D7 an index that does not parse: nothing, logged, health repo null, not cached (read again next run)', b === null && logs.some(l => /index\.json is ignored: it does not parse/.test(l)) && h.facts.repo === null && !('EMT_FACTS_INDEX' in cache) || cache.EMT_FACTS_INDEX === '0', JSON.stringify([b, cache.EMT_FACTS_INDEX]));
repoSet('index.json', '{"updated":"x"}'); nocache(); b = ctx.emtFactsBest('ShowFacts', 6, false);
check('D7 an index without files: nothing, logged', b === null && logs.some(l => /index\.json is ignored: it lists no files/.test(l)));

/* ===================== E · the recap ===================== */
console.log('--- E recap facts');
const h2h = ctx.emtRows('H2H Fixtures');
let tamper = JSON.parse(RECAP_T); tamper.fixtures[0].hs = tamper.fixtures[0].hs + 1;
let missing = JSON.parse(RECAP_T); missing.fixtures.pop();
check('E1 emtFactsCheck recap: the GW5 facts pass; a changed score -> scores; a fixture missing -> fixtures; GW6 -> notdone; kind preview -> badkind; an array -> badfacts',
  ctx.emtFactsCheck('recap', RECAP, 5) === '' && ctx.emtFactsCheck('recap', tamper, 5) === 'scores' && ctx.emtFactsCheck('recap', missing, 5) === 'fixtures' &&
  ctx.emtFactsCheck('recap', Object.assign(JSON.parse(RECAP_T), { gw: 6 }), 6) === 'notdone' && ctx.emtFactsCheck('recap', Object.assign(JSON.parse(RECAP_T), { kind: 'preview' }), 5) === 'badkind' &&
  ctx.emtFactsCheck('recap', [], 5) === 'badfacts' && ctx.emtFactsCheck('other', RECAP, 5) === 'badkind' && ctx.emtArtFactsCheck(RECAP, 5, h2h) === '');
check('E1 emtFactsCheck preview: the GW6 facts pass; GW7 under a GW6 name -> badfacts', ctx.emtFactsCheck('preview', PREV, 6) === '' && ctx.emtFactsCheck('preview', Object.assign(JSON.parse(PREV_T), { gw: 7 }), 6) === 'badfacts');
delete cache['EMT_RF_Team Jacob']; let rp = rpost(tamper);
check('E2 the phone path (artfacts) answers as before: a changed score -> scores', rp.error === 'scores' && !sheets.RecapFacts);
rp = rpost(RECAP); check('E2 ... the real facts are accepted', rp.ok === true && sheets.RecapFacts.rows.length > 1);
delete sheets.RecapFacts; delete sheets.ShowFacts;
const at3 = iso(Date.now() - 2 * H);
repoIndex({ 'recap-gw5.json': entry('recap', 5, at3, RECAP_T), 'preview-gw6.json': entry('preview', 6, at1, PREV_T) }); repoSet('recap-gw5.json', RECAP_T); repoSet('preview-gw6.json', PREV_T);
nocache(); clearArticles(); S = tick(); id = S.id; R = row(id);
check('E3 both in the repo, no phone: the GW5 recap starts first, from the repo\'s file', S.stopped === 'submitted' && S.kind === 'recap' && S.gw === 5 && creates[0].req.custom_id === id + '-r' &&
  R && unq(col(R, 'Facts received (UTC)')) === at3 && /sent by Facts bot/.test(unq(col(R, 'Log'))) && JSON.stringify(ctx.emtWorkJson(id, 'facts')) === RECAP_T, JSON.stringify({ S: S.stopped, why: S.why }));
fresh(); h = get({ health: '1' });
check('E3 ?health=1: facts.recap {gw 5, from repo} and facts.preview {gw 6, from repo}', h.facts.recap && h.facts.recap.gw === 5 && h.facts.recap.at === at3 && h.facts.recap.from === 'repo' && h.facts.preview.from === 'repo' && h.facts.repo.files.join() === 'preview-gw6.json,recap-gw5.json', JSON.stringify(h.facts));
repoIndex({ 'recap-gw5.json': entry('recap', 5, iso(Date.now() - 25 * H), RECAP_T) });
nocache(); clearArticles(); S = tick();
check('E4 repo recap facts 25 hours old: waits for fresher ones, as a phone\'s would', S.why.some(w => /recap of GW5 waits for fresher facts \(the latest are 25 hours old/.test(w)), S.why.join(' | '));
repoSet('recap-gw5.json', tamper); repoIndex({ 'recap-gw5.json': entry('recap', 5, at3, JSON.stringify(tamper)) });
nocache(); clearArticles(); S = tick();
check('E5 a repo recap whose scores are not the sheet\'s: the job starts on the metadata, then waits (not counted) and says the facts were replaced or failed the checks', S.stopped === 'wait' && /being replaced/.test(S.error) && job() && (job().tries || 0) === 0 &&
  creates.length === 0 && logs.some(l => /recap-gw5\.json is ignored: .*\(scores\)/.test(l)), JSON.stringify(S));
repoSet('recap-gw5.json', RECAP_T); repoIndex({ 'recap-gw5.json': entry('recap', 5, iso(Date.now()), RECAP_T) });
nocache(); S = tick();
check('E5 ... the bot\'s next file is right: the same job carries on and sends the research', S.stopped === 'submitted' && S.id === job().id && creates.length === 1 && creates[0].req.custom_id === job().id + '-r' && JSON.stringify(ctx.emtWorkJson(job().id, 'facts')) === RECAP_T, JSON.stringify(S));

/* ===================== F · GitHub not answering ===================== */
console.log('--- F GitHub down');
clearArticles(); delete cache['EMT_SF_Team Jacob']; spost(PREV); props.EMT_SHOW_TRIES_6 = '3';   /* the show writer stops before its Claude call */
RAW_THROW = true; nocache(); let threw = null;
const rxDown = /facts\/index\.json could not be read \(Address unavailable/; let nDown = -1;
try { b = ctx.emtFactsBest('ShowFacts', 6, false); bd = ctx.emtFactsBest('ShowFacts', 6, true); sw = ctx.showWriterTick(Date.now()); S = tick(); nDown = logs.filter(l => rxDown.test(l)).length; h = get({ health: '1' }); } catch (e) { threw = e; }
check('F1 UrlFetchApp throwing on GitHub: nothing throws, the phone\'s facts count, logged once a run (the health request is its own run), health says so, not cached', threw === null && b.source === 'phone' && bd.source === 'phone' && nDown === 1 && logs.filter(l => rxDown.test(l)).length === 2 &&
  h.facts.preview.from === 'phone' && h.facts.repo && /Address unavailable/.test(h.facts.repo.error) && !('EMT_FACTS_INDEX' in cache), threw ? String(threw.stack) : JSON.stringify(h.facts));
check('F1 ... the preview job still started from the phone\'s facts', S.stopped === 'submitted' && S.kind === 'preview' && job() && job().kind === 'preview');
RAW_THROW = false; repoSet('index.json', 'Internal Server Error', 500); nocache(); b = ctx.emtFactsBest('ShowFacts', 6, false); h = get({ health: '1' });
check('F2 HTTP 500 on the index: the phone\'s facts count, health repo.error HTTP 500, not cached', b.source === 'phone' && h.facts.repo.error === 'HTTP 500' && !('EMT_FACTS_INDEX' in cache) && logs.some(l => /could not be read \(HTTP 500\)/.test(l)));
delete sheets.ShowFacts; clearArticles(); RAW_THROW = true; nocache(); threw = null;
try { ctx.aiTick(); } catch (e) { threw = e; }
check('F3 aiTick with GitHub unreachable and no facts: runs through, nothing thrown out of it', threw === null, threw ? String(threw.stack) : '');
RAW_THROW = false;

/* ===================== G · v3.16: the self-update reads the tested release branch ===================== */
console.log('--- G v3.16 release branch');
check('G1 EMT_SELF_SRC is the release branch\'s Code.gs, the CHANGELOG says so and EMT_VERSION is v3.16 or later', ctx.EMT_SELF_SRC === 'https://raw.githubusercontent.com/parkerno2/el-matador-tire/release/Code.gs' &&
  /\* v3\.16 · 8 Oct 2026\n \*   The self-update reads Code\.gs from the repo's `release` branch/.test(src) && ctx.emtSelfCmp(ctx.EMT_VERSION, 'v3.16') >= 0);
const ci = fs.readFileSync(__dirname + '/../../.github/workflows/codegs.yml', 'utf8');
check('G2 the CI gate runs on pushes to main touching Code.gs or the tests, node --check, and fast-forwards release without ever forcing', /branches: \[main\]/.test(ci) && /paths: \['Code\.gs', 'tests\/\*\*'/.test(ci) &&
  /node --check/.test(ci) && /merge-base --is-ancestor origin\/release HEAD/.test(ci) && /git push origin HEAD:refs\/heads\/release/.test(ci) && !/push[^\n]*(--force|-f |force-with-lease)/.test(ci));
/* v3.25 (Parker, 8 Oct 2026: the gate went red three times in a day because this check pinned the list of suites, so every new
 * tests/*.js broke it until someone edited the pin). The gate's loop is pattern based: it must pick up every tests/*.js and
 * tests/codegs/*.js suite on disk, skip the helpers, require ALL PASS, and never name a suite. */
const loopLine = (ci.match(/for f in ([^;\n]+); do/) || [])[1] || '';
const globs = loopLine.trim().split(/\s+/);
const expand = g => { const m = /^(.*\/)\*(\.js)$/.exec(g); if (!m) return []; const dir = __dirname + '/../../' + m[1]; return fs.readdirSync(dir).filter(x => x.endsWith(m[2])).map(x => m[1] + x); };
const skip = f => /fixtures|harness/.test(f);
const picked = globs.map(expand).flat().filter(f => !skip(f)).sort();
const onDisk = ['tests/', 'tests/codegs/'].map(d => fs.readdirSync(__dirname + '/../../' + d).filter(x => x.endsWith('.js')).map(x => d + x)).flat().filter(f => !skip(f)).sort();
check('G2a the loop runs every suite on disk by pattern (tests/codegs/*.js and tests/*.js, helpers skipped), and lists none by name', globs.join(' ') === 'tests/codegs/*.js tests/*.js' && JSON.stringify(picked) === JSON.stringify(onDisk) && picked.length >= 20 &&
  /case "\$f" in \*fixtures\*\|\*harness\*\) continue ;; esac/.test(ci) && !/tests\/(app-[a-z-]+|factsbot|monitor|parity|worker|status)\.js/.test(ci) && !/tests\/codegs\/(v\d+|show|test)\.js/.test(ci), loopLine + ' | ' + picked.length + ' of ' + onDisk.length);
check('G2b every suite but test.js must print ALL PASS, and a suite that is not on disk yet is no concern of the gate (no names, so nothing to edit)', /grep -q '\^ALL PASS\$'/.test(ci) && /\*\/test\.js\) echo "\$out" \| tail -3/.test(ci) && /suites ran/.test(ci));
check('G3 the fetched copy still has to pass the v3.12 sanity checks (size, markers, version, loads)', ctx.emtSelfSane(src) === '' && ctx.emtSelfSane(src.slice(0, 1000)) !== '');

console.log(fails ? fails + ' FAILED' : 'ALL PASS');
process.exit(fails ? 1 : 0);
