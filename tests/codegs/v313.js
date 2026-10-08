// v3.13 tests: articles write themselves (artfacts, articleTick on the Message Batches API, the check, the
// commissioner's approve / redo / drop, ?articles, ?article, ?health) and the model chains.
//   cd /home/claude && node <scratchpad>/gs/v313.js
// Harness as in v312.js: vm, a mock Sheet, PropertiesService, CacheService, LockService, UrlFetchApp, with the
// Batches API (create, poll, results JSONL, cancel) and the Messages API mocked.
// Tone pass: the recap (C2), the preview (C4) and the rewrite (C5) go through the punch phase; C6 to C16 are about other
// things and run with EMT_PUNCH_OFF = yes; C17 tests the tone prompts and the punch-up (articles and the show).
// v3.14: articles publish themselves by default, so the flows end live. The commissioner's approval (C3), his drafts
// (C5, C6) and sealed drafts (C16 R1) run in review mode (EMT_ART_REVIEW = yes). v314.js tests the new parts.
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
Sheet.prototype.deleteRows = function (r, n) {
  if (r < 2) throw new Error('deleteRows hit the header');
  if (n >= this.getMaxRows() - 1) throw new Error('Sorry, it is not possible to delete all non-frozen rows.');
  this.rows.splice(r - 1, n); };
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
let props = {}, cache = {}, UI = null;
const logs = [], creates = [], polls = [], cancels = [], msgs = [], other = [];
let PLAN = [], MSG = [], BSEQ = 0;
const BATCHES = {};
const resp = (code, body) => ({ getResponseCode: () => code, getContentText: () => typeof body === 'string' ? body : JSON.stringify(body), getContent: () => [] });
const BURL = 'https://api.anthropic.com/v1/messages/batches';

function anthropic(url, o) {
  const method = String(o.method || 'get').toLowerCase(), hdr = o.headers || {};
  if (hdr['x-api-key'] !== 'sk-test' || hdr['anthropic-version'] !== '2023-06-01') throw new Error('bad headers ' + JSON.stringify(hdr));
  if (url === 'https://api.anthropic.com/v1/messages') {                    // the synchronous writers (AI writer, show writer)
    const body = JSON.parse(o.payload); msgs.push(body);
    const next = MSG.shift(); if (!next) throw new Error('no Messages reply queued');
    if (next.after) next.after();                                           // tone pass: e.g. move the clock on
    if (next.code) return resp(next.code, next.body);
    return resp(200, { content: [{ type: 'text', text: next.text }], stop_reason: 'end_turn' });
  }
  if (url === BURL && method === 'post') {
    const body = JSON.parse(o.payload), req = body.requests[0];
    creates.push({ req, o, at: Date.now() });
    const next = PLAN.shift(); if (!next) throw new Error('no batch outcome queued for ' + req.custom_id);
    if (next.create) return resp(next.create.code, next.create.body);
    const id = 'msgbatch_' + String(++BSEQ).padStart(4, '0');
    BATCHES[id] = { req, out: next, polls: 0 };
    return resp(200, { id, type: 'message_batch', processing_status: 'in_progress', results_url: null, request_counts: { processing: 1 } });
  }
  let m = /^https:\/\/api\.anthropic\.com\/v1\/messages\/batches\/([^/]+)(\/results|\/cancel)?$/.exec(url);
  if (m) {
    const b = BATCHES[m[1]];
    if (m[2] === '/cancel') { cancels.push(m[1]); return resp(200, { id: m[1], processing_status: 'canceling' }); }
    if (!b) return resp(404, { type: 'error', error: { type: 'not_found_error', message: 'batch not found' } });
    if (m[2] === '/results') {
      const line = { custom_id: b.req.custom_id, result: b.out.result };
      return resp(200, JSON.stringify({ custom_id: 'someone-else', result: { type: 'succeeded', message: { content: [] } } }) + '\n' + JSON.stringify(line) + '\n');
    }
    b.polls++; polls.push(m[1]);
    const ended = b.polls >= (b.out.after || 1);
    return resp(200, { id: m[1], processing_status: ended ? 'ended' : 'in_progress', results_url: ended ? BURL + '/' + m[1] + '/results' : null });
  }
  throw new Error('unexpected anthropic ' + method + ' ' + url);
}
const ctx = {
  console, JSON, Date, Math, Number, String, Object, Array, isNaN, isFinite, parseInt, encodeURIComponent, RegExp,
  SpreadsheetApp: { getActive: () => ({ getSheetByName: n => sheets[n] || null, insertSheet: n => (sheets[n] = new Sheet(n)) }),
    getUi: () => { if (!UI) throw new Error('Cannot call SpreadsheetApp.getUi() from this context.'); return UI; } },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); }, deleteProperty: k => { delete props[k]; }, getProperties: () => ({ ...props }) }) },
  CacheService: { getScriptCache: () => ({ get: k => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = String(v); }, remove: k => { delete cache[k]; } }) },
  LockService: { getScriptLock: () => ({ waitLock() {}, tryLock() { return true; }, releaseLock() {} }) },
  Utilities: { DigestAlgorithm: { SHA_256: 1, MD5: 2 }, Charset: { UTF_8: 1 }, getUuid: () => crypto.randomUUID(),
    computeDigest: (a, s) => Array.from(crypto.createHash(a === 2 ? 'md5' : 'sha256').update(s, 'utf8').digest()).map(b => b > 127 ? b - 256 : b),
    base64Encode: bytes => Buffer.from(Array.from(bytes).map(b => (b + 256) % 256)).toString('base64'),
    // review: what sealing needs, with Apps Script's signed bytes
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
    other.push(url);
    if (/github\.io/.test(url)) return resp(404, '<h1>404</h1>');
    if (/raw\.githubusercontent\.com/.test(url)) return resp(404, '404: Not Found');
    throw new Error('unexpected fetch ' + url);
  } },
};
vm.createContext(ctx); vm.runInContext(src, ctx);

let fails = 0;
const check = (label, cond, info) => { if (!cond) fails++; console.log((cond ? 'PASS ' : 'FAIL ') + label + (info ? '  ' + info : '')); };
const reset = () => { [logs, creates, polls, cancels, msgs, other].forEach(a => { a.length = 0; }); };
const Hd = r => ctx.emtHandle(r);
const get = p => JSON.parse(ctx.doGet({ parameter: p }).t);
const art = () => (sheets.Articles ? sheets.Articles.rows.slice(1) : []);
const row = id => art().find(r => r[0] === id);
const col = (r, name) => r[ctx.EMT_ART_HEAD.indexOf(name)];
const unq = v => String(v == null ? '' : v).replace(/^'/, '');
const job = () => (props.EMT_ART_JOB ? JSON.parse(props.EMT_ART_JOB) : null);
const tick = (force) => ctx.articleTick(Date.now(), force);
const ok = (content, stop) => ({ result: { type: 'succeeded', message: { id: 'msg_' + BSEQ, type: 'message', role: 'assistant', model: 'x', content, stop_reason: stop || 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } } } });
const errd = (type, message) => ({ result: { type: 'errored', error: { type: 'error', error: { type, message } } } });
const say = s => [{ type: 'text', text: s }];
const asReply = a => say('Here is the article.\n' + JSON.stringify(a, null, 1) + '\nDone.');
const artOf = R => ctx.emtArtArticle(col(R, 'Article'));      // review: drafts are sealed ('s:'), live ones 'j:'
const noteOf = R => ctx.emtArtNote(col(R, 'Note'));
const workRows = () => (sheets.ArticleWork ? sheets.ArticleWork.rows.length - 1 : 0);
const clearArticles = () => { delete sheets.Articles; delete sheets.ArticleWork; ['EMT_ART_JOB', 'EMT_ART_QUEUE', 'EMT_ART_BUSY', 'EMT_MODEL_GONE'].forEach(k => delete props[k]); cache = {}; };

props.ANTHROPIC_API_KEY = 'sk-test';
props.EMT_SELF_UPDATE = 'off';

/* ===================== C1 · artfacts ===================== */
console.log('--- C1 artfacts');
const tokCP = Hd({ action: 'claim', team: 'Cold Palmers', pin: '1234' }).token;
const tokDU = Hd({ action: 'claim', team: 'Devils U21s', pin: '4321' }).token;
const tokTJ = Hd({ action: 'claim', team: 'Team Jacob', pin: '5555' }).token;
const rStr = JSON.stringify(RECAP);
const rpost = (team, tok, extra) => Hd(Object.assign({ action: 'artfacts', team, token: tok, gw: 5, kind: 'recap', facts: rStr }, extra || {}));
check('no token / a wrong token -> auth', Hd({ action: 'artfacts', team: 'Cold Palmers', gw: 5, kind: 'recap', facts: rStr }).error === 'auth' && rpost('Cold Palmers', 'nope').error === 'auth' && !sheets.RecapFacts);
check('kind other than recap -> badkind', rpost('Cold Palmers', tokCP, { kind: 'preview' }).error === 'badkind' && rpost('Cold Palmers', tokCP, { facts: JSON.stringify(Object.assign({}, RECAP, { kind: 'preview' })) }).error === 'badkind');
check('GW6 (H2H rows not Finished) -> notdone', rpost('Cold Palmers', tokCP, { gw: 6, facts: JSON.stringify(Object.assign({}, RECAP, { gw: 6 })) }).error === 'notdone' && rpost('Cold Palmers', tokCP, { gw: 9 }).error === 'notdone');
check('an older finished gameweek (GW4) -> closed', rpost('Cold Palmers', tokCP, { gw: 4, facts: JSON.stringify(Object.assign({}, RECAP, { gw: 4 })) }).error === 'closed');
sheets['H2H Fixtures'].rows.find(r => Number(r[0]) === 5 && r[1] === 'Devils U21s')[5] = 'FALSE';
check('one GW5 row not Finished yet -> notdone', rpost('Cold Palmers', tokCP).error === 'notdone');
sheets['H2H Fixtures'].rows.find(r => Number(r[0]) === 5 && r[1] === 'Devils U21s')[5] = true;
const bad = (f) => rpost('Cold Palmers', tokCP, { facts: typeof f === 'string' ? f : JSON.stringify(f) }).error;
const fx3 = Object.assign({}, RECAP, { fixtures: RECAP.fixtures.slice(0, 3) });
const fxSwap = JSON.parse(rStr); { const x = fxSwap.fixtures[0]; [x.home, x.away] = [x.away, x.home]; }
const fxDup = JSON.parse(rStr); fxDup.fixtures[1] = fxDup.fixtures[0];
check('fixtures not exactly GW5\'s (3 of 4, home/away swapped, one twice) -> fixtures', bad(fx3) === 'fixtures' && bad(fxSwap) === 'fixtures' && bad(fxDup) === 'fixtures', [bad(fx3), bad(fxSwap), bad(fxDup)].join());
const sc1 = JSON.parse(rStr); sc1.fixtures[2].as = 48;
const sc2 = JSON.parse(rStr); delete sc2.fixtures[0].hs;
const sc3 = JSON.parse(rStr); sc3.fixtures[3].hs = '32';
check('a score that is not the sheet\'s (49 sent as 48, a missing hs) -> scores; "32" as text is fine', bad(sc1) === 'scores' && bad(sc2) === 'scores' && bad(sc3) !== 'scores', bad(sc3));
delete cache['EMT_RF_Cold Palmers']; if (sheets.RecapFacts) sheets.RecapFacts.rows.length = 1;
check('not JSON / an array / over 60,000 characters -> badfacts', bad('{nope') === 'badfacts' && bad('[1]') === 'badfacts' && bad(JSON.stringify(Object.assign({}, RECAP, { pad: 'x'.repeat(60000) }))) === 'badfacts');
delete cache['EMT_RF_Cold Palmers']; if (sheets.RecapFacts) sheets.RecapFacts.rows.length = 1;
const a1 = rpost('Cold Palmers', tokCP);
const rf = () => (sheets.RecapFacts ? sheets.RecapFacts.rows.slice(1) : []);
check('accepted: one RecapFacts row, j: marker, same head as ShowFacts, hidden, frozen', a1.ok === true && a1.parts === 1 && rf().length === 1 && rf()[0][0] === 5 && rf()[0][2] === 'Cold Palmers' &&
  String(rf()[0][5]).startsWith('j:') && JSON.stringify(JSON.parse(String(rf()[0][5]).slice(2))) === rStr && sheets.RecapFacts.rows[0].join('|') === 'GW|Received (UTC)|Team|Part|Parts|Data' && sheets.RecapFacts.hidden && sheets.RecapFacts.frozen === 1, JSON.stringify(a1));
check('rate limit: the same manager within 20 minutes -> slow, nothing stored', rpost('Cold Palmers', tokCP).error === 'slow' && rf().length === 1 && cache['EMT_RF_Cold Palmers'] === '1');
check('its own counter: showfacts is not slowed by a recap post', !cache['EMT_SF_Cold Palmers']);
const a2 = rpost('Devils U21s', tokDU, { facts: RECAP });
check('another manager (facts as an object) replaces it: one set left', a2.ok && rf().length === 1 && rf()[0][2] === 'Devils U21s');
const lat = ctx.emtFactsLatest('RecapFacts', 5, true);
check('emtFactsLatest(RecapFacts) reads it back; emtShowFactsLatest still reads ShowFacts', lat && lat.team === 'Devils U21s' && lat.data.fixtures.length === 4 && ctx.emtShowFactsLatest(5, false) === null);
const setDeadline = h => { sheets.Matchweeks.rows[3][1] = "'" + iso(Date.now() + h * H); };
const sp = (team, tok, f) => Hd({ action: 'showfacts', team, token: tok, gw: 6, facts: typeof f === 'string' ? f : JSON.stringify(f) });
check('showfacts refuses kind "recap"', sp('Team Jacob', tokTJ, Object.assign({}, PREV, { kind: 'recap' })).error === 'badfacts');
setDeadline(53);
check('showfacts takes preview facts 53 hours before the deadline (the server sets no earliest time)', sp('Team Jacob', tokTJ, PREV).ok === true);
setDeadline(20);

/* ===================== C2 · a recap end to end ===================== */
console.log('--- C2 recap job end to end');
reset(); delete props.EMT_SHOW_TRIES_6;
// the preview is not due yet: make its ShowFacts old so only the recap starts
sheets.ShowFacts.rows.slice(1).forEach(r => { r[1] = "'" + iso(Date.now() - 13 * H); });
PLAN = [{ result: ok(F.recapResearch()).result, after: 2 }];
let S = tick();
let J = job(), id = J && J.id, R = id && row(id);
check('tick 1: the recap of GW5 starts (row: research, facts time, log) and one research batch goes out', S.stopped === 'submitted' && /^recap-gw5-[0-9a-f]{6}$/.test(id) && R && col(R, 'Status') === 'research' && col(R, 'GW') === 5 && col(R, 'Kind') === 'recap' &&
  /^'\d{4}-/.test(col(R, 'Facts received (UTC)')) && /research: started/.test(col(R, 'Log')) && creates.length === 1 && sheets.Articles.hidden && sheets.Articles.rows[0].join('|') === ctx.EMT_ART_HEAD.join('|'), JSON.stringify(S));
const rq = creates[0].req, ro = creates[0].o;
check('research request: custom_id <id>-r, web_search_20250305 with max_uses 10, max_tokens 3000, model claude-sonnet-5-5, headers and json', rq.custom_id === id + '-r' && rq.params.tools.length === 1 && rq.params.tools[0].type === 'web_search_20250305' &&
  rq.params.tools[0].name === 'web_search' && rq.params.tools[0].max_uses === 10 && rq.params.max_tokens === 3000 && rq.params.model === 'claude-sonnet-5-5' && ro.headers['x-api-key'] === 'sk-test' &&
  ro.headers['anthropic-version'] === '2023-06-01' && ro.contentType === 'application/json' && ro.muteHttpExceptions === true && J.phase === 'research' && J.batch === 'msgbatch_0001');
const ru = rq.params.messages[0].content;
check('research prompt: every PL result, key players, players to check, dates; the trimmed facts, not the whole json', ru.includes('Brentford 3-0 Chelsea') && ru.includes('Man City 5-3 Sunderland') && ru.includes('Brobbey (SUN): 17 points, 3 goals') &&
  ru.includes('Saliba (ARS): did not play') && /Today is \d{4}-\d{2}-\d{2}/.test(ru) && ru.length < rStr.length / 3 && /SOURCES:/.test(rq.params.system) && /Date-check everything/i.test(rq.params.system) && !/[—–]/.test(rq.params.system), ru.length + ' chars');
reset(); S = tick();
check('tick 2: the batch is still processing -> waiting, nothing sent', S.stopped === 'waiting' && creates.length === 0 && polls.length === 1 && col(row(id), 'Status') === 'research');
const recapA = F.recapArticle(), recapP = F.recapPunched();
PLAN = [{ result: ok(asReply(recapA)).result }, { result: ok(asReply(recapP)).result }];   // the writing, then the punch-up
reset(); S = tick();
R = row(id);
const research = unq(col(R, 'Research'));
check('tick 3: research collected (t: marker, notes plus SOURCES), status writing, the writing batch goes out', S.stopped === 'submitted' && col(R, 'Status') === 'writing' && research.startsWith('t:') && research.includes('Brobbey scored in the 12th, 44th and 81st minutes') &&
  /SOURCES:\nBBC Sport \| https:\/\/www\.bbc\.co\.uk/.test(research) && creates.length === 1 && job().phase === 'write' && /research done: \d+ characters, 3 sources/.test(col(R, 'Log')), S.stopped);
check('a url that web search never returned (made-up.example.com) is dropped from SOURCES', !research.includes('made-up.example.com') && research.includes('theguardian.com'));
const wq = creates[0].req;
check('writing request: custom_id <id>-w, no tools, max_tokens 6000, the house style as system', wq.custom_id === id + '-w' && !wq.params.tools && wq.params.max_tokens === 6000 && wq.params.system === ctx.EMT_ART_SYSTEM &&
  /objective third-person narrator/.test(wq.params.system) && /who has who/.test(wq.params.system) && !/[—–]/.test(wq.params.system) && wq.params.messages.length === 1);
const wu = wq.params.messages[0].content;
check('writing prompt: the full facts json, the research notes, the contract, the foot', wu.includes(ctx.emtArtSent(RECAP)) && wu.includes('Brobbey scored in the 12th') && wu.includes('THE CONTRACT') && wu.includes('"Star of the match"') &&
  wu.includes('Scores are provisional until FPL confirms bonus and stat corrections.') && /WRITE the recap of gameweek 5\. JSON only\.$/.test(wu) && !wu.includes('A REWRITE'));
reset(); S = tick();
R = row(id);
const pq0 = creates[0] && creates[0].req, pu0 = pq0 ? pq0.params.messages[0].content : '';
const sheetText0 = Object.keys(sheets).map(k => JSON.stringify(sheets[k].rows)).join('\n');
check('tick 4: the article passes the checks -> not a draft yet: the base kept sealed in ArticleWork, status still writing, the punch-up batch goes out (not a try)', S.stopped === 'submitted' && col(R, 'Status') === 'writing' &&
  job().phase === 'punch' && job().writer === 'claude-sonnet-5-5' && job().model === 'claude-haiku-5-5' && (job().tries || 0) === 0 && sheets.ArticleWork.rows.slice(1).some(r => r[1] === 'base' && String(r[4]).startsWith('j:s:')) &&
  !sheetText0.includes(recapA.lede.slice(0, 40)) && /passed the checks; the punch-up is next/.test(col(R, 'Log')) && creates.length === 1, JSON.stringify(S));
check('punch-up request: custom_id <id>-p, claude-haiku-5-5, no tools, max_tokens 6000, EMT_PUNCH_ART_SYSTEM, "THE ARTICLE:" then the checked json, no note', pq0 && pq0.custom_id === id + '-p' && pq0.params.model === 'claude-haiku-5-5' && !pq0.params.tools &&
  pq0.params.max_tokens === 6000 && pq0.params.system === ctx.EMT_PUNCH_ART_SYSTEM && pq0.params.messages.length === 1 && pu0.startsWith('THE ARTICLE:\n') && JSON.parse(pu0.slice(13)).title === recapA.title &&
  JSON.parse(pu0.slice(13)).matchups[3].story === recapA.matchups[3].story && !pu0.includes('NOTE'));
check('?articles=1 and POST articles while the punch-up runs: status writing, no text', get({ articles: '1' }).waiting[0].status === 'writing' && Hd({ action: 'articles', team: 'Cold Palmers', token: tokCP }).drafts[0].a === null);
reset(); S = tick();
R = row(id);
const stored = artOf(R);
check('tick 5: the punch-up passes the checks -> v3.14: the punched-up version is published at once (live, plain j: json, Approved set, Log "Published automatically"); Model "writer + punch model"', S.stopped === 'live' && col(R, 'Status') === 'live' && /^'\d{4}-/.test(col(R, 'Written (UTC)')) &&
  /^'\d{4}-/.test(col(R, 'Approved (UTC)')) && col(R, 'Model') === 'claude-sonnet-5-5 + claude-haiku-5-5' && String(col(R, 'Article')).startsWith('j:') && JSON.parse(String(col(R, 'Article')).slice(2)).title === recapA.title && stored.title === recapA.title && stored.matchups[3].story === recapP.matchups[3].story &&
  stored.matchups[3].bullets[0] === recapP.matchups[3].bullets[0] && stored.matchups.length === 4 && stored.sources.length === 3 && /written by claude-sonnet-5-5, punched up by claude-haiku-5-5, \d+ words\. Published automatically; every manager can read it now\./.test(col(R, 'Log')) &&
  polls.length === 1 && creates.length === 0 && logs.some(l => /published automatically, written by claude-sonnet-5-5, punched up by claude-haiku-5-5/.test(l)), JSON.stringify(S));
check('the job is over: EMT_ART_JOB cleared, ArticleWork emptied, busy flag released', !props.EMT_ART_JOB && workRows() === 0 && !props.EMT_ART_BUSY);
reset(); S = tick();
check('the next tick: nothing to start (the recap row exists; the preview facts are 13 hours old)', S.stopped === 'idle' && creates.length === 0 && S.why.some(w => /recap of GW5 is already/.test(w)) && S.why.some(w => /preview of GW6 waits for fresher facts/.test(w)), S.why.join(' | '));
const recapAuto = id;
const LA = get({ articles: '1' }), GA = get({ article: recapAuto });
check('v3.14: the published recap is served at once: ?articles=1 lists it (review false, its written time), ?article=<id> returns it with auto true, nothing waiting', LA.review === false && LA.live.length === 1 && LA.live[0].id === recapAuto &&
  LA.live[0].title === recapA.title && LA.live[0].written === unq(col(row(recapAuto), 'Written (UTC)')) && LA.waiting.length === 0 && GA.ok && GA.auto === true && GA.a.matchups[3].story === recapP.matchups[3].story, JSON.stringify(LA).slice(0, 300));

/* ===================== C3 · serving: only live, never draft content ===================== */
console.log('--- C3 serving and the commissioner (review mode: EMT_ART_REVIEW = yes)');
props.EMT_ART_REVIEW = 'yes';                                         // C3 is about the approval step: v3.13's flow, brought back by the property
clearArticles();
PLAN = [{ result: ok(F.recapResearch()).result }, { result: ok(asReply(recapA)).result }, { result: ok(asReply(recapP)).result }];
reset(); tick(); id = job().id; tick(); tick(); S = tick(); R = row(id);
check('review mode: the same recap ends as a sealed draft that waits for the commissioner (status draft, s:, no Approved, Log "Waiting for the commissioner.")', S.stopped === 'draft' && col(R, 'Status') === 'draft' &&
  String(col(R, 'Article')).startsWith('s:') && !R.join('|').includes(recapA.title) && unq(col(R, 'Approved (UTC)')) === '' && /Waiting for the commissioner\.$/.test(col(R, 'Log')) && artOf(R).matchups[3].story === recapP.matchups[3].story &&
  logs.some(l => /It waits for Cold Palmers to read it in the app/.test(l)), JSON.stringify(S));
const recapId = id;
let L1 = get({ articles: '1' });
check('?articles=1 while it is a draft: no live, waiting has metadata only (no title, no text); review true', L1.ok && L1.live.length === 0 && L1.waiting.length === 1 && L1.waiting[0].gw === 5 && L1.waiting[0].kind === 'recap' && L1.waiting[0].status === 'draft' &&
  /^\d{4}-/.test(L1.waiting[0].since) && Object.keys(L1.waiting[0]).sort().join() === 'gw,kind,since,status' && !JSON.stringify(L1).includes('Brobbey') && L1.commish === 'Cold Palmers' && L1.review === true, JSON.stringify(L1));
check('?article=<draft id> -> notfound; unknown id -> notfound', JSON.stringify(get({ article: recapId })) === '{"ok":false,"error":"notfound"}' && get({ article: 'recap-gw5-zzzzzz' }).error === 'notfound');
const nd = Hd({ action: 'articles', team: 'Devils U21s', token: tokDU });
check('POST articles, not the commissioner -> commish false, no drafts', nd.ok === true && nd.commish === false && nd.drafts.length === 0 && JSON.stringify(nd) === '{"ok":true,"commish":false,"drafts":[]}');
check('POST articles without a token -> auth', Hd({ action: 'articles', team: 'Cold Palmers' }).error === 'auth');
const cd = Hd({ action: 'articles', team: 'Cold Palmers', token: tokCP });
check('POST articles, the commissioner -> the draft with its article', cd.ok && cd.commish === true && cd.drafts.length === 1 && cd.drafts[0].id === recapId && cd.drafts[0].status === 'draft' && cd.drafts[0].a.title === recapA.title &&
  cd.drafts[0].model === 'claude-sonnet-5-5 + claude-haiku-5-5' && cd.drafts[0].redos === 0 && cd.drafts[0].note === '' && /^\d{4}-/.test(cd.drafts[0].written), JSON.stringify(cd).slice(0, 200));
check('articlemod from a manager who is not the commissioner -> commish (nothing changes)', Hd({ action: 'articlemod', team: 'Devils U21s', token: tokDU, id: recapId, op: 'approve' }).error === 'commish' && col(row(recapId), 'Status') === 'draft');
check('articlemod: a bad op -> badop; an unknown id -> notfound', Hd({ action: 'articlemod', team: 'Cold Palmers', token: tokCP, id: recapId, op: 'publish' }).error === 'badop' && Hd({ action: 'articlemod', team: 'Cold Palmers', token: tokCP, id: 'nope', op: 'approve' }).error === 'notfound');
props.EMT_COMMISH = 'Team Jacob';
check('EMT_COMMISH moves the commissioner (Cold Palmers then gets no drafts)', Hd({ action: 'articles', team: 'Cold Palmers', token: tokCP }).drafts.length === 0 && Hd({ action: 'articles', team: 'Team Jacob', token: tokTJ }).drafts.length === 1);
delete props.EMT_COMMISH;
get({ articles: '1' });                                             // cached now
const ap = Hd({ action: 'articlemod', team: 'Cold Palmers', token: tokCP, id: recapId, op: 'approve' });
R = row(recapId);
check('approve -> live, Approved (UTC) set, logged', ap.ok && ap.status === 'live' && col(R, 'Status') === 'live' && /^'\d{4}-/.test(col(R, 'Approved (UTC)')) && /approved by Cold Palmers/.test(col(R, 'Log')), JSON.stringify(ap));
L1 = get({ articles: '1' });
check('?articles=1 after approval (the cache was cleared): live has id, gw, kind, title, sub, approved (v3.14: and written); waiting empty', L1.live.length === 1 && L1.live[0].id === recapId && L1.live[0].title === recapA.title && L1.live[0].sub === recapA.sub &&
  /^\d{4}-/.test(L1.live[0].approved) && Object.keys(L1.live[0]).sort().join() === 'approved,gw,id,kind,sub,title,written' && L1.waiting.length === 0, JSON.stringify(L1).slice(0, 200));
const g1 = get({ article: recapId });
check('?article=<live id> -> the article (v3.14: auto false, approved by hand)', g1.ok && g1.id === recapId && g1.gw === 5 && g1.kind === 'recap' && g1.a.matchups.length === 4 && /^\d{4}-/.test(g1.approved) && /^\d{4}-/.test(g1.written) && g1.a.foot === recapA.foot && g1.auto === false);
check('approve again -> live (not a draft)', Hd({ action: 'articlemod', team: 'Cold Palmers', token: tokCP, id: recapId, op: 'approve' }).error === 'live');
check('redo a live article in review mode -> live (refused, as in v3.13)', Hd({ action: 'articlemod', team: 'Cold Palmers', token: tokCP, id: recapId, op: 'redo', note: 'x' }).error === 'live');
check('drafts no longer list it once live', Hd({ action: 'articles', team: 'Cold Palmers', token: tokCP }).drafts.length === 0);

/* ===================== C4 · a preview from ShowFacts ===================== */
console.log('--- C4 preview job from ShowFacts');
delete props.EMT_ART_REVIEW;                                          // back to the default: published once it passes the checks
const oldApp = JSON.parse(JSON.stringify(F.SHOWF));                 // the facts an older app sends: no kind, no collisions
delete cache['EMT_SF_Team Jacob']; sp('Team Jacob', tokTJ, oldApp);
reset(); S = tick();
check('preview facts from an older app (no kind "preview") -> no preview job, the reason given', S.stopped === 'idle' && creates.length === 0 && S.why.some(w => /facts from the new app/.test(w)), S.why.join(' | '));
delete cache['EMT_SF_Team Jacob']; sp('Team Jacob', tokTJ, PREV);
setDeadline(55);
reset(); S = tick();
check('deadline 55 hours away -> not yet (the preview starts in the last 50)', S.stopped === 'idle' && creates.length === 0 && S.why.some(w => /last 50 hours/.test(w)));
setDeadline(40);
const prevA = F.previewArticle();
const prevP = F.previewPunched();
PLAN = [{ result: ok(F.previewResearch()).result }, { result: ok(asReply(prevA)).result }, { result: ok(asReply(prevP)).result }];
reset(); S = tick(); id = job().id;
const pq = creates[0].req.params.messages[0].content;
check('40 hours out with fresh kind-preview facts -> the preview of GW6 starts; research asks for the slate, the flags and the rosters', S.stopped === 'submitted' && /^preview-gw6-/.test(id) && pq.includes('Arsenal v Leeds (kick-off 2026-10-10T11:30:00Z)') &&
  pq.includes('Palmer (CHE): Muscular injury - 75% chance of playing') && pq.includes('ARS: ') && /The deadline is \d{4}-/.test(pq), pq.slice(0, 200));
reset(); tick(); tick(); const pcr = creates.find(c => c.req.custom_id === id + '-p'); reset(); S = tick();
R = row(id);
const pv = artOf(R);
check('research, then writing, then the punch-up, then published (v3.14; the punched-up one; labels Player to watch / The limbo, the preview foot)', S.stopped === 'live' && col(R, 'Status') === 'live' && String(col(R, 'Article')).startsWith('j:') && pv.kind === 'preview' && pv.matchups.some(m => m.star.label === 'The limbo') &&
  pv.foot === prevA.foot && pv.sources.length === 2 && pv.matchups[3].story === prevP.matchups[3].story && col(R, 'Model') === 'claude-sonnet-5-5 + claude-haiku-5-5' && pcr && pcr.req.params.model === 'claude-haiku-5-5', JSON.stringify(S));
const L2 = get({ articles: '1' });
check('?articles=1: the recap and the preview live, nothing waiting', L2.live.length === 2 && L2.waiting.length === 0 && L2.live.some(l => l.id === id && l.kind === 'preview' && l.title === prevA.title) && L2.live[0].id === id && L2.live[1].kind === 'recap');   // newest gameweek first

/* the commissioner's drafts (C5, C6) need review mode: the preview again, as a draft */
props.EMT_ART_REVIEW = 'yes';
sheets.Articles.rows = sheets.Articles.rows.filter(r => r[0] !== id); delete cache.EMT_ART_LIST;
PLAN = [{ result: ok(F.previewResearch()).result }, { result: ok(asReply(prevA)).result }, { result: ok(asReply(prevP)).result }];
reset(); tick(); id = job().id; tick(); tick(); S = tick(); R = row(id);
const pvd = artOf(R);
check('review mode: the preview again, as a sealed draft; ?articles=1: the recap live, the preview waiting (metadata only)', S.stopped === 'draft' && col(R, 'Status') === 'draft' && String(col(R, 'Article')).startsWith('s:') && pvd.matchups[3].story === prevP.matchups[3].story &&
  get({ articles: '1' }).live.length === 1 && get({ articles: '1' }).waiting.length === 1 && get({ articles: '1' }).waiting[0].kind === 'preview' && !JSON.stringify(get({ articles: '1' })).includes(prevA.title));
const previewId = id;

/* ===================== C5 · redo with a note ===================== */
console.log('--- C5 redo with a note');
const longNote = '  Make the <b>Nolan Derby</b> lead the piece.   Less on Saka.  ' + 'x'.repeat(500);
const rd = Hd({ action: 'articlemod', team: 'Cold Palmers', token: tokCP, id: previewId, op: 'redo', note: longNote });
R = row(previewId);
const note = noteOf(R);
check('redo -> writing; the note cleaned (no < >, spaces, 400 characters) and stored with redos 1; a write-phase job queued', rd.ok && rd.status === 'writing' && col(R, 'Status') === 'writing' && note.redos === 1 && note.text.length === 400 &&
  note.text.startsWith('Make the bNolan Derby/b lead the piece. Less on Saka.') && job().id === previewId && job().phase === 'write' && job().redos === 1 && job().note === note.text, JSON.stringify(rd));
const L3 = get({ articles: '1' });
check('while rewriting: waiting shows status writing', L3.waiting.length === 1 && L3.waiting[0].status === 'writing');
const cdw = Hd({ action: 'articles', team: 'Cold Palmers', token: tokCP }).drafts[0];
check('drafts: a is null while it is being written, note and redos shown', cdw.status === 'writing' && cdw.a === null && cdw.redos === 1 && cdw.note === note.text);
check('redo again while it is being written -> busy', Hd({ action: 'articlemod', team: 'Cold Palmers', token: tokCP, id: previewId, op: 'redo', note: 'again' }).error === 'busy');
const prev2 = F.previewArticle(); prev2.title = 'The Nolan Derby leads a gameweek that runs through Anfield';
const prev2P = F.previewPunched(JSON.parse(JSON.stringify(prev2)));
PLAN = [{ result: ok(asReply(prev2)).result }, { result: ok(asReply(prev2P)).result }];
reset(); S = tick();
const rwq = creates[0] && creates[0].req;
check('the rewrite skips the research: one writing batch, from the stored research, with the note and the last draft', creates.length === 1 && rwq.custom_id === previewId + '-w' && !rwq.params.tools &&
  rwq.params.messages[0].content.includes('A REWRITE') && rwq.params.messages[0].content.includes('His note: "' + note.text + '"') && rwq.params.messages[0].content.includes('THE LAST DRAFT:') &&
  rwq.params.messages[0].content.includes(JSON.stringify(pvd.title)) && rwq.params.messages[0].content.includes('Arteta said Saka trained fully'), S.stopped);
reset(); S = tick();
const rpq = creates[0] && creates[0].req, rpu = rpq ? rpq.params.messages[0].content : '';
check('the rewrite passes the checks and goes to the punch-up too, with the commissioner\'s note', S.stopped === 'submitted' && rpq && rpq.custom_id === previewId + '-p' && rpu.startsWith('THE ARTICLE:\n') &&
  rpu.includes('THE COMMISSIONER\'S NOTE') && rpu.includes('"' + note.text + '"') && JSON.parse(rpu.slice(13, rpu.indexOf('\n\nTHE COMMISSIONER'))).title === prev2.title && job().phase === 'punch' && job().redos === 1, rpu.slice(-200));
reset(); S = tick();
R = row(previewId);
check('the rewrite becomes the draft (new title, punched up), redos stays 1, logged as rewrite 1 of 3', S.stopped === 'draft' && col(R, 'Status') === 'draft' && artOf(R).title === prev2.title && artOf(R).matchups[3].story === prev2P.matchups[3].story &&
  /punched up by claude-haiku-5-5, \d+ words, rewrite 1 of 3/.test(col(R, 'Log')) && Hd({ action: 'articles', team: 'Cold Palmers', token: tokCP }).drafts[0].redos === 1);
// the 3-rewrite cap
note.redos = 3; R[ctx.EMT_ART_HEAD.indexOf('Note')] = 'j:' + JSON.stringify(note);
check('a 4th rewrite -> redos (refused)', Hd({ action: 'articlemod', team: 'Cold Palmers', token: tokCP, id: previewId, op: 'redo', note: 'one more' }).error === 'redos' && col(row(previewId), 'Status') === 'draft');
note.redos = 1; R[ctx.EMT_ART_HEAD.indexOf('Note')] = 'j:' + JSON.stringify(note);

/* ===================== C6 · drop, and a redo that waits its turn ===================== */
console.log('--- C6 drop, queue');
props.EMT_PUNCH_OFF = 'yes';                                          // C6 to C16 are about other things; C17 tests the punch-up
const dp = Hd({ action: 'articlemod', team: 'Cold Palmers', token: tokCP, id: previewId, op: 'drop' });
check('drop a draft -> dropped, logged, gone from waiting and from ?article', dp.ok && dp.status === 'dropped' && col(row(previewId), 'Status') === 'dropped' && /dropped by Cold Palmers/.test(col(row(previewId), 'Log')) &&
  get({ articles: '1' }).waiting.length === 0 && get({ article: previewId }).error === 'notfound');
check('drop again -> ok (already dropped); approve a dropped one -> notdraft', Hd({ action: 'articlemod', team: 'Cold Palmers', token: tokCP, id: previewId, op: 'drop' }).ok === true &&
  Hd({ action: 'articlemod', team: 'Cold Palmers', token: tokCP, id: previewId, op: 'approve' }).error === 'notdraft');
reset(); S = tick();
check('a dropped preview is not written again automatically', S.stopped === 'idle' && creates.length === 0 && S.why.some(w => /preview of GW6 is already/.test(w)));
// a running job is dropped mid-research: its batch is cancelled and the job forgotten
PLAN = [{ result: ok(F.previewResearch()).result, after: 5 }];
reset(); S = tick(true);                                             // 'write now' starts a new preview (failed/dropped rows do not block it)
const id3 = job().id;
check('Articles: write now starts a new preview of GW6 although one was dropped', S.stopped === 'submitted' && /^preview-gw6-/.test(id3) && id3 !== previewId && art().filter(r => r[2] === 'preview').length === 2);
// meanwhile the commissioner asks for a rewrite of the dropped one: it waits its turn
const rq2 = Hd({ action: 'articlemod', team: 'Cold Palmers', token: tokCP, id: previewId, op: 'redo', note: 'Bring it back, shorter.' });
check('redo while another job runs -> queued in EMT_ART_QUEUE, the running job untouched', rq2.ok && rq2.status === 'writing' && JSON.parse(props.EMT_ART_QUEUE).join() === previewId && job().id === id3);
reset(); const dr = Hd({ action: 'articlemod', team: 'Cold Palmers', token: tokCP, id: id3, op: 'drop' });
check('drop the running one -> dropped, its batch cancelled, the job cleared', dr.ok && col(row(id3), 'Status') === 'dropped' && cancels.length === 1 && cancels[0] === 'msgbatch_' + String(BSEQ).padStart(4, '0') && !props.EMT_ART_JOB);
PLAN = [{ result: ok(asReply(prev2)).result }];
reset(); S = tick();
check('next tick: the queued rewrite starts (phase write, redos 2, its note)', S.stopped === 'submitted' && job().id === previewId && job().redos === 2 && job().note === 'Bring it back, shorter.' && !props.EMT_ART_QUEUE && creates[0].req.custom_id === previewId + '-w');
reset(); S = tick();
check('... and lands as a draft again', S.stopped === 'draft' && col(row(previewId), 'Status') === 'draft');

/* ===================== C7 · pause_turn ===================== */
console.log('--- C7 pause_turn continuation');
delete props.EMT_ART_REVIEW;                                          // from here on the default again (C16 R1 turns review mode on for itself)
sheets.ShowFacts.rows.slice(1).forEach(r => { r[1] = "'" + iso(Date.now() - 13 * H); });   // from here on only recaps are due
clearArticles(); delete cache['EMT_RF_Team Jacob']; rpost('Team Jacob', tokTJ);
const part1 = [{ type: 'text', text: 'Brentford v Chelsea\n- Schade set up both of Thiago\'s goals in a 3-0 win (BBC Sport)\n' }].concat([{ type: 'server_tool_use', id: 'srvtoolu_p1', name: 'web_search', input: { query: 'Man City Sunderland' } }]);
const part2 = [{ type: 'web_search_tool_result', tool_use_id: 'srvtoolu_p1', content: [{ type: 'web_search_result', url: F.U.sky, title: 'City 5-3', encrypted_content: 'e1' }] }, { type: 'text', text: '\nMan City v Sunderland\n- Brobbey scored in the 12th, 44th and 81st minutes (Sky Sports)\n' }];
const part3 = F.recapResearch();
PLAN = [{ result: ok(part1, 'pause_turn').result }, { result: ok(part2, 'pause_turn').result }, { result: ok(part3).result }, { result: ok(asReply(recapA)).result }];
reset(); tick(); id = job().id;
reset(); S = tick();
const c1 = creates[0] && creates[0].req.params.messages;
check('pause_turn: a continuation batch with the paused assistant content appended unchanged', creates.length === 1 && c1.length === 2 && c1[0].role === 'user' && c1[1].role === 'assistant' && JSON.stringify(c1[1].content) === JSON.stringify(part1) && creates[0].req.custom_id === id + '-r' && creates[0].req.params.tools.length === 1, JSON.stringify(c1 && c1.map(m => m.role)));
check('the paused turn is kept in ArticleWork (j:), the job counts the continuation', job().cont === 1 && sheets.ArticleWork.rows.slice(1).some(r => r[1] === 'cont' && String(r[4]).startsWith('j:')) && job().phase === 'research');
reset(); S = tick();
const c2 = creates[0] && creates[0].req.params.messages;
check('a second pause: the next continuation carries both parts, in order', c2 && c2.length === 2 && JSON.stringify(c2[1].content) === JSON.stringify(part1.concat(part2)) && job().cont === 2);
reset(); S = tick();
R = row(id);
const res7 = unq(col(R, 'Research'));
check('then it ends: the research joins all three parts (text blocks from every turn), and the writing goes out', col(R, 'Status') === 'writing' && res7.includes('Schade set up both of Thiago') && res7.includes('Brobbey scored in the 12th') && res7.includes('Isak scored the only goal') &&
  creates.length === 1 && creates[0].req.custom_id === id + '-w' && !sheets.ArticleWork.rows.slice(1).some(r => r[1] === 'cont'));
reset(); S = tick();
check('... and it is published', S.stopped === 'live' && col(row(id), 'Status') === 'live');
// a third pause is not continued: what it has is kept
clearArticles(); delete cache['EMT_RF_Team Jacob']; rpost('Team Jacob', tokTJ);
PLAN = [{ result: ok(part1, 'pause_turn').result }, { result: ok(part2, 'pause_turn').result }, { result: ok(F.recapResearch(), 'pause_turn').result }, { result: ok(asReply(recapA)).result }];
reset(); tick(); id = job().id; tick(); tick(); reset(); tick();
check('still paused after 2 continuations -> kept what it had, logged, on to the writing', col(row(id), 'Status') === 'writing' && /still paused after 2 continuations/.test(col(row(id), 'Log')) && creates.length === 1 && creates[0].req.custom_id === id + '-w');

/* ===================== C8 · web search unavailable ===================== */
console.log('--- C8 research errored: web search disabled');
clearArticles(); delete cache['EMT_RF_Team Jacob']; rpost('Team Jacob', tokTJ);
const noSrc = F.recapArticle(); noSrc.sources = [];                 // written from the facts alone: no minute marks from the research
noSrc.matchups[1].story = noSrc.matchups[1].story.replace('scored in the 12th, 44th and 81st minutes of', 'scored a hat-trick in');
noSrc.matchups[2].story = noSrc.matchups[2].story.replace(' after 63 minutes', '');
check('the facts-only article passes the check with empty research; the research one does not', ctx.emtArticleCheck(JSON.stringify(noSrc), RECAP, '', 'recap', 5).problems.length === 0 &&
  ctx.emtArticleCheck(JSON.stringify(F.recapArticle()), RECAP, '', 'recap', 5).problems.some(p => /The number 44 /.test(p)), ctx.emtArticleCheck(JSON.stringify(noSrc), RECAP, '', 'recap', 5).problems.join(' | '));
PLAN = [errd('invalid_request_error', 'Web search is not enabled for this organization. Enable it in the Console.'), { result: ok(asReply(noSrc)).result }];
reset(); tick(); id = job().id; reset(); S = tick();
R = row(id);
const nsw = creates[0] && creates[0].req.params.messages[0].content;
check('errored with web search not enabled -> research unavailable (logged), empty research, the writing goes out at once', col(R, 'Status') === 'writing' && /research unavailable: Web search is not enabled/.test(col(R, 'Log')) && unq(col(R, 'Research')) === 't:' &&
  creates.length === 1 && nsw.includes('(none: the research came back empty') && logs.some(l => /research unavailable/.test(l)) && (job().tries || 0) === 0);
reset(); S = tick();
check('written from the league data alone, sources empty -> published', S.stopped === 'live' && artOf(row(id)).sources.length === 0);
// the same at creation time (a 400 about web search when the batch is made)
clearArticles(); delete cache['EMT_RF_Team Jacob']; rpost('Team Jacob', tokTJ);
PLAN = [{ create: { code: 400, body: { type: 'error', error: { type: 'invalid_request_error', message: 'web_search tool is not available for your organization' } } } }, { result: ok(asReply(noSrc)).result }];
reset(); S = tick(); id = job().id;
check('a 400 about web search when the research batch is created -> straight to the writing, same run', col(row(id), 'Status') === 'writing' && creates.length === 2 && creates[1].req.custom_id === id + '-w' && S.stopped === 'submitted');

/* ===================== C9 · an invalid article: retried, then failed after 3 tries ===================== */
console.log('--- C9 invalid article');
clearArticles(); delete cache['EMT_RF_Team Jacob']; rpost('Team Jacob', tokTJ);
const absent = (text, facts) => { const okn = ctx.emtArtAllowed(text, facts); return [19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 91, 97, 103].find(n => !okn[String(n)]); };
const INV = absent(ctx.emtArtSent(RECAP) + '\n' + ctx.emtArtResearch(F.recapResearch()).text, RECAP);
const badA = F.recapArticle();
badA.matchups[0].story = badA.matchups[0].story.replace('Cold Palmers won 34 to 33 at Team Jacob,', 'Cold Palmers won 34 to 33 at Team Jacob —');   // an em dash
badA.matchups[1].star.code = '17761x';                                                                   // a star not in the XI
badA.matchups[2].story = badA.matchups[2].story.replace('collected 13 points', 'collected ' + INV + ' points');     // a number in neither facts nor research
const badCheck = ctx.emtArticleCheck(JSON.stringify(badA), RECAP, ctx.emtArtResearch(F.recapResearch()).text, 'recap', 5);
check('emtArticleCheck finds all three: the dash, the wrong star, the invented ' + INV, badCheck.article === null && badCheck.problems.some(p => /em dash or en dash/.test(p)) && badCheck.problems.some(p => /star\.code "17761x"/.test(p)) &&
  badCheck.problems.some(p => p.indexOf('The number ' + INV + ' ') === 0), badCheck.problems.join(' | '));
PLAN = [{ result: ok(F.recapResearch()).result }].concat(Array.from({ length: 6 }, () => ({ result: ok(asReply(badA)).result })));
reset(); tick(); id = job().id; tick();                               // research out, then in; the 1st writing batch out
reset(); S = tick();
const fixMsgs = creates[0] && creates[0].req.params.messages;
check('1st reply rejected -> sent back once in the same try: the reply as the assistant turn, then the problems', fixMsgs && fixMsgs.length === 3 && fixMsgs[1].role === 'assistant' && fixMsgs[1].content.includes('"title"') &&
  /rejected by the checks/.test(fixMsgs[2].content) && /em dash/.test(fixMsgs[2].content) && /17761x/.test(fixMsgs[2].content) && fixMsgs[2].content.includes('The number ' + INV + ' ') && (job().tries || 0) === 0 && job().fix === true, S.stopped);
reset(); S = tick();
check('rejected again -> try 1 of 3 counted, a fresh writing batch (no fix turn)', job().tries === 1 && creates.length === 1 && creates[0].req.params.messages.length === 1 && /try 1 of 3 failed: the article failed the checks twice/.test(col(row(id), 'Log')));
reset(); tick(); tick(); tick(); S = tick();
R = row(id);
check('after 3 tries (6 replies) -> failed, the reasons in Log, the job and its files cleared, no more batches', col(R, 'Status') === 'failed' && S.stopped === 'failed' && /try 3 of 3 failed, no more/.test(col(R, 'Log')) && /star\.code "17761x"/.test(col(R, 'Log')) &&
  !props.EMT_ART_JOB && workRows() === 0 && PLAN.length === 0 && creates.length === 3, JSON.stringify({ s: S.stopped, plan: PLAN.length, c: creates.length }));
const fd = Hd({ action: 'articles', team: 'Cold Palmers', token: tokCP }).drafts.find(d => d.id === id);
check('the commissioner sees it as failed, with the reason; nothing is served', fd && fd.status === 'failed' && fd.a === null && /try 3 of 3/.test(fd.error) && get({ articles: '1' }).waiting.length === 0);
reset(); S = tick();
check('a failed recap is not restarted automatically', S.stopped === 'idle' && creates.length === 0);

/* ===================== C10 · batches that fail ===================== */
console.log('--- C10 errored, expired, a 5xx, 6 hours');
clearArticles(); delete cache['EMT_RF_Team Jacob']; rpost('Team Jacob', tokTJ);
PLAN = [{ create: { code: 529, body: { type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } } } }];
reset(); S = tick(); id = job().id;
check('the Batches API overloaded (529) -> not counted, the job waits for the next run', S.stopped === 'wait' && (job().tries || 0) === 0 && !job().batch && col(row(id), 'Status') === 'research' && logs.some(l => /answered 529/.test(l) && /not counted/.test(l)));
PLAN = [errd('api_error', 'Internal server error'), { result: { type: 'expired' } }, { result: ok(F.recapResearch()).result }];
reset(); tick(); reset(); S = tick();
check('an errored request (api_error) -> try 1, resubmitted at once', job().tries === 1 && creates.length === 1 && /try 1 of 3 failed: the research request errored/.test(col(row(id), 'Log')));
reset(); S = tick();
check('an expired request -> try 2, resubmitted', job().tries === 2 && creates.length === 1);
const j6 = job(); j6.batchAt = Date.now() - 6.5 * H; props.EMT_ART_JOB = JSON.stringify(j6); BATCHES[j6.batch].out.after = 99;
PLAN = [];
reset(); S = tick();
check('a batch still unfinished after 6 hours -> cancelled, try 3 of 3 -> failed', cancels.length === 1 && col(row(id), 'Status') === 'failed' && /unfinished after 6 hours/.test(col(row(id), 'Log')) && !props.EMT_ART_JOB);
clearArticles(); delete cache['EMT_RF_Team Jacob']; rpost('Team Jacob', tokTJ);
PLAN = [{ result: ok(F.recapResearch()).result, after: 99 }];
reset(); tick(); const j36 = job(); j36.startedAt = Date.now() - 37 * H; props.EMT_ART_JOB = JSON.stringify(j36);
reset(); S = tick();
check('a job still open 36 hours after it started -> given up (failed)', S.stopped === 'failed' && col(row(j36.id), 'Status') === 'failed' && /36 hours/.test(col(row(j36.id), 'Log')));

/* ===================== C11 · model chains ===================== */
console.log('--- C11 model chains');
check('emtModelChain: the property first, then the defaults, no repeats', JSON.stringify(ctx.emtModelChain('EMT_ARTICLE_MODEL', ctx.EMT_ART_MODELS)) === '["claude-sonnet-5-5","claude-opus-5-5","claude-sonnet-4-5"]' &&
  (props.EMT_ARTICLE_MODEL = 'claude-opus-5-5', JSON.stringify(ctx.emtModelChain('EMT_ARTICLE_MODEL', ctx.EMT_ART_MODELS)) === '["claude-opus-5-5","claude-sonnet-5-5","claude-sonnet-4-5"]') &&
  JSON.stringify(ctx.EMT_SHOW_MODELS) === '["claude-sonnet-5-5","claude-sonnet-4-5"]' && JSON.stringify(ctx.EMT_AI_MODELS) === '["claude-haiku-5-5","claude-haiku-4-5"]' && ctx.EMT_SHOW_WRITER_DEFAULT === 'claude-sonnet-5-5');
delete props.EMT_ARTICLE_MODEL;
clearArticles(); delete cache['EMT_RF_Team Jacob']; rpost('Team Jacob', tokTJ);
const gone404 = { create: { code: 404, body: { type: 'error', error: { type: 'not_found_error', message: 'model: claude-sonnet-5-5' } } } };
PLAN = [gone404, { result: ok(F.recapResearch()).result }];
reset(); S = tick(); id = job().id;
check('articles: a 404 not_found_error for claude-sonnet-5-5 -> claude-opus-5-5 at once, not counted; the gone model is noted', creates.length === 2 && creates[0].req.params.model === 'claude-sonnet-5-5' && creates[1].req.params.model === 'claude-opus-5-5' &&
  job().model === 'claude-opus-5-5' && (job().tries || 0) === 0 && JSON.parse(props.EMT_MODEL_GONE)['claude-sonnet-5-5'] > 0 && logs.some(l => /Model claude-sonnet-5-5 is not available/.test(l)));
PLAN = [errd('not_found_error', 'model: claude-opus-5-5'), { result: ok(asReply(recapA)).result }];
reset(); tick();                                                     // research in; the writing goes to claude-opus-5-5
check('the writing goes to the same model (claude-opus-5-5)', creates.length === 1 && creates[0].req.params.model === 'claude-opus-5-5');
reset(); S = tick();
check('a batch result errored with not_found_error -> the next model (claude-sonnet-4-5), not a try', creates.length === 1 && creates[0].req.params.model === 'claude-sonnet-4-5' && job().model === 'claude-sonnet-4-5' && (job().tries || 0) === 0);
reset(); S = tick();
check('... and the published article records the model that wrote it', S.stopped === 'live' && col(row(id), 'Model') === 'claude-sonnet-4-5', S.stopped + ' ' + col(row(id), 'Model'));
check('the next job skips the gone models (3 days)', JSON.stringify(ctx.emtModelsLive(ctx.emtModelChain('EMT_ARTICLE_MODEL', ctx.EMT_ART_MODELS))) === '["claude-sonnet-4-5"]');
check('every model gone -> the whole chain is tried again', (props.EMT_MODEL_GONE = JSON.stringify({ 'claude-sonnet-5-5': Date.now(), 'claude-opus-5-5': Date.now(), 'claude-sonnet-4-5': Date.now() }), ctx.emtModelsLive(ctx.emtModelChain('EMT_ARTICLE_MODEL', ctx.EMT_ART_MODELS)).length === 3));
check('a 400 that mentions the model counts as gone; one about web search or something else does not', ctx.emtModelMissing(400, 'invalid_request_error', 'model: claude-x is deprecated') && !ctx.emtModelMissing(400, 'invalid_request_error', 'web_search is not supported for this model') &&
  !ctx.emtModelMissing(400, 'invalid_request_error', 'messages: field required') && !ctx.emtModelMissing(529, 'overloaded_error', 'Overloaded') && ctx.emtModelMissing(404, '', ''));
delete props.EMT_MODEL_GONE;
// the show writer: 404 on claude-sonnet-5-5 -> claude-sonnet-4-5
{
  const chapters = PREV.fixtures.map(x => ({ home: x.home, away: x.away, star: { h: x.H.xi[0].code, a: x.A.xi[0].code }, beats: ['The model has this one on a knife edge, 2 to 1.', 'The eleven is settled and ready for gameweek 6.', 'The visitors arrive with plenty to prove this week.', 'Their eleven has a familiar look to it again.', 'The series is close and so is the model.'] }));
  const show = { open: 'Gameweek 6. Two derbies and plenty of flags. Here\'s how it lines up.', chapters, close: 'That\'s the gameweek. Lineups in before the deadline, and get on the record in the press room.' };
  const W = (MSG = [{ code: 404, body: JSON.stringify({ type: 'error', error: { type: 'not_found_error', message: 'model: claude-sonnet-5-5' } }) }, { text: JSON.stringify(show) }], reset(), ctx.emtShowWrite(6, PREV, Date.now() + 20 * H));
  check('show writer: 404 on claude-sonnet-5-5 -> claude-sonnet-4-5 in the same run, the script kept with that model', msgs.length === 2 && msgs[0].model === 'claude-sonnet-5-5' && msgs[1].model === 'claude-sonnet-4-5' && W.script && W.model === 'claude-sonnet-4-5', JSON.stringify(W.problems || W.error));
  check('show writer: the preview keys (kind, collisions, slate, rosters, moves) stay out of its prompt', !msgs[1].messages[0].content.includes('"collisions"') && !msgs[1].messages[0].content.includes('"slate"') && msgs[1].messages[0].content.includes('"fixtures"'));
  delete props.EMT_MODEL_GONE;
  MSG = [{ code: 500, body: '{"type":"error","error":{"type":"api_error","message":"boom"}}' }]; reset();
  const W2 = ctx.emtShowWrite(6, PREV, Date.now() + 20 * H);
  check('show writer: a 500 is not a missing model -> no fallthrough, the error kept', msgs.length === 1 && W2.error && /Claude API 500/.test(W2.error) && !props.EMT_MODEL_GONE);
}
// the AI writer: 404 on claude-haiku-5-5 -> claude-haiku-4-5
MSG = [{ code: 404, body: JSON.stringify({ type: 'error', error: { type: 'not_found_error', message: 'model: claude-haiku-5-5' } }) }, { text: JSON.stringify({ posts: [{ voice: 'malcolm', text: 'Derby week. Kobbie Mainoo Fan sit top and The Nolan Derby awaits.', teams: ['Cold Palmers'] }] }) }];
reset(); const posts = ctx.aiWrite({ desc: 'x', ask: 'One malcolm post.', facts: { table: [] }, teams: ['Cold Palmers'], n: 1 });
check('AI writer: 404 on claude-haiku-5-5 -> claude-haiku-4-5, the post kept', msgs.length === 2 && msgs[0].model === 'claude-haiku-5-5' && msgs[1].model === 'claude-haiku-4-5' && posts.length === 1);
delete props.EMT_MODEL_GONE;
MSG = [{ code: 429, body: '{"type":"error","error":{"type":"rate_limit_error","message":"slow down"}}' }]; reset(); let thrown = null;
try { ctx.aiWrite({ desc: 'x', ask: 'y', facts: {}, teams: [], n: 1 }); } catch (e) { thrown = e; }
check('AI writer: a 429 still throws as before (no fallthrough)', thrown && /Claude API 429/.test(thrown.message) && msgs.length === 1);
props.EMT_AI_MODEL = 'claude-custom-1'; MSG = [{ text: '{"posts":[]}' }]; reset(); ctx.aiWrite({ desc: 'x', ask: 'y', facts: {}, teams: [], n: 1 }); delete props.EMT_AI_MODEL;
check('AI writer: EMT_AI_MODEL is tried first', msgs[0].model === 'claude-custom-1');

/* ===================== C12 · the check, case by case ===================== */
console.log('--- C12 emtArticleCheck');
const RS = ctx.emtArtResearch(F.recapResearch()).text, PS = ctx.emtArtResearch(F.previewResearch()).text;
const ck = (mut, kind) => { const a = kind === 'preview' ? F.previewArticle() : F.recapArticle(); mut(a); return ctx.emtArticleCheck(JSON.stringify(a), kind === 'preview' ? PREV : RECAP, kind === 'preview' ? PS : RS, kind || 'recap', kind === 'preview' ? 6 : 5).problems; };
check('the shipped recap and preview pass', ck(() => {}).length === 0 && ck(() => {}, 'preview').length === 0, ck(() => {}).concat(ck(() => {}, 'preview')).join(' | '));
const cases = [
  ['an en dash', a => { a.lede = a.lede.replace('Gameweek 5 was', 'Gameweek 5 – was'); }, /em dash or en dash/],
  ['an emoji', a => { a.title += ' \u{1F525}'; }, /emoji/],
  ['a hashtag', a => { a.sub += ' #FPL'; }, /hashtag/],
  ['markdown', a => { a.lede = '**' + a.lede; }, /Markdown/],
  ['first person (we)', a => { a.matchups[0].story += ' We thought it was over.'; }, /First person/],
  ['first person (I)', a => { a.around[0].body += ' I think so.'; }, /First person/],
  ['an invented quote', a => { a.matchups[0].story += ' Jacob said: "That bench will haunt me for weeks."'; }, /is not in the quotes in FACTS or in RESEARCH/],
  ['a missing matchup', a => { a.matchups.pop(); }, /Missing matchup: Devils U21s v I Am a Baleba/],
  ['a misspelt team', a => { a.matchups[0].home = 'Team jacob'; }, /not a fixture in FACTS/],
  ['a label from the preview', a => { a.matchups[0].star.label = 'Player to watch'; }, /must be one of: Star of the match, The zero/],
  ['a bench star as Star of the match', a => { a.matchups[0].star.code = '647850'; }, /bench player only with the label The zero/],
  ['4 bullets', a => { a.matchups[1].bullets.push('One more.'); }, /exactly 3 bullets/],
  ['number.value not in the facts (research only)', a => { a.matchups[1].number.value = '81'; }, /number\.value "81" is not a number in FACTS/],
  ['a heading not allowed', a => { a.around[0].h = 'The slate'; }, /must be one of: Around the league/],
  ['a heading twice', a => { a.around[1].h = 'Around the league'; }, /used twice/],
  ['a source not in the research', a => { a.sources[0].url = 'https://www.bbc.co.uk/sport/other'; }, /not in the SOURCES list/],
  ['one source when the research has 3', a => { a.sources = a.sources.slice(0, 1); }, /needs 2 to 12/],
  ['a wrong foot', a => { a.foot = 'Scores are final.'; }, /"foot" must start with/],
  ['too short', a => { a.around = a.around.slice(0, 1); a.matchups.forEach(m => { m.story = m.story.split('. ')[0] + ' and that was the story of the game for everyone.'; }); a.lede = 'A short week of football with four results and not a lot more to say about them.'; }, /words; it needs 600 to 1,400/],
  ['a rostered player called a free agent', a => { a.around[1].body += ' Saka is a free agent worth a claim.'; }, /Saka is on the Team Jacob roster/],
  ['gw wrong', a => { a.gw = 6; }, /"gw" must be 5/],
  ['not JSON', a => { a.__raw = true; }, null]];
const cres = cases.map(([n, f, re]) => {
  if (!re) { const p = ctx.emtArticleCheck('Sorry, here is my article: no json', RECAP, RS, 'recap', 5).problems; return [n, /not one JSON object/.test(p[0]), p.join(' | ')]; }
  const p = ck(f); return [n, p.some(x => re.test(x)), p.join(' | ')]; });
check('emtArticleCheck catches ' + cases.length + ' faults', cres.every(c => c[1]), cres.filter(c => !c[1]).map(c => c[0] + ': ' + c[2]).join(' || '));
const fine = [
  ['"I Am a Baleba" (a team name with I)', a => { a.matchups[3].story += ' I Am a Baleba move up to 4th.'; }],
  ['a manager quote with "We" and a 3, word for word from the facts', a => { a.around[0].body += ' Parker had said: "We go to Jacob and we take all 3 points." He did.'; }],
  ['a real manager quote from the research', a => { a.matchups[1].story += ' Guardiola said: "We were careless at the back, but the boys kept going."'; }],
  ['a margin (won by 26), a count (11), a year (2026), a rounded decimal (42.5 -> 43? no: 42.5 itself)', a => { a.matchups[0].bullets[0] = 'Team Jacob had 11 starters and an xP of 42.5 in 2026.'; }],
  ['a scare quote of 2 words', a => { a.lede += ' Call it "smallest margin".'; }]];
const fres = fine.map(([n, f]) => { const p = ck(f); return [n, p.length === 0, p.join(' | ')]; });
check('and lets ' + fine.length + ' honest things through', fres.every(c => c[1]), fres.filter(c => !c[1]).map(c => c[0] + ': ' + c[2]).join(' || '));
const PINV = absent(ctx.emtArtSent(PREV) + '\n' + PS, PREV);
const pcases = [
  ['The limbo on a player with no flag', a => { a.matchups[1].star = { code: '223094', label: 'The limbo' }; }, /carries no flag/],
  ['a derby kicker without the derby name', a => { a.matchups[0].kicker = 'Brothers at war'; }, /must start with the derby name, The Nolan Derby/],
  ['a recap label in a preview', a => { a.matchups[1].star.label = 'Star of the match'; }, /must be one of: Player to watch, The limbo, The zero/],
  ['a predicted score not from the projections', a => { a.matchups[1].story = a.matchups[1].story.replace('43 to 46', PINV + ' to 46'); }, new RegExp('The number ' + PINV + ' ')],
  ['curly apostrophes in the foot are fine (no problem expected)', a => { a.foot = a.foot.replace(/'/g, '\u2019'); }, null]];
const pres = pcases.map(([n, f, re]) => { const p = ck(f, 'preview'); return [n, re ? p.some(x => re.test(x)) : p.length === 0, p.join(' | ')]; });
check('preview rules: ' + pcases.length + ' faults caught', pres.every(c => c[1]), pres.filter(c => !c[1]).map(c => c[0] + ': ' + c[2]).join(' || '));

/* ===================== C13 · health, status, menu, guards ===================== */
console.log('--- C13 ?health, status, guards');
props.EMT_SELF_STATE = 'current: v3.13 (checked x)'; props.ELEVENLABS_API_KEY = 'el-secret-key'; props.EMT_SECRET = 'pin-secret';
props.EMT_AI_STATE = JSON.stringify({ day: '2026-10-08', count: 3, socialAt: 1 });
clearArticles(); delete cache['EMT_RF_Team Jacob']; rpost('Team Jacob', tokTJ);
PLAN = [{ result: ok(F.recapResearch()).result, after: 9 }]; reset(); tick();
const hz = get({ health: '1' }), hzs = JSON.stringify(hz);
check('?health=1: ok, version, self, show, articles {job, last}, ai {day, count}', hz.ok === true && hz.version === ctx.emtSelfVersion(src) && ctx.emtSelfCmp(hz.version, 'v3.14') >= 0 && hz.self === 'current: v3.13 (checked x)' &&
  hz.show && hz.show.gw === 6 && 'facts' in hz.show && 'clips' in hz.show && hz.articles.job && hz.articles.job.kind === 'recap' && hz.articles.job.phase === 'research' && hz.articles.last.length === 1 &&
  hz.articles.last[0].status === 'research' && hz.ai.day === '2026-10-08' && hz.ai.count === 3 && Object.keys(hz).sort().join() === 'ai,articles,facts,ok,self,show,version', hzs.slice(0, 300));
check('?health=1 carries no secrets (keys, PIN hashes, tokens, the batch id, article text)', !/sk-test|el-secret-key|pin-secret|msgbatch|EMT_PIN|Brobbey/.test(hzs) && !Object.values(props).filter(v => /^[0-9a-f]{64}$/.test(v)).some(v => hzs.includes(v)));
reset(); const st = ctx.articlesStatus();
check('articlesStatus logs the job and the latest rows', /Job: the recap of GW5 \(recap-gw5-/.test(st) && /researching, batch sent 0 minutes ago to claude-sonnet-5-5/.test(st) && /recap-gw5-[0-9a-f]{6}: research/.test(st) && logs.some(l => l === st), st);
UI = { alerts: [], alert(m) { this.alerts.push(m); } };
props.EMT_ARTICLES_PAUSED = 'yes'; reset();
check('EMT_ARTICLES_PAUSED = yes -> articleTick does nothing', tick().stopped === 'paused' && polls.length === 0 && creates.length === 0);
const wn = ctx.articlesWriteNow();
check('menu Articles: write now works while paused (polls the running job) and alerts a summary', polls.length === 1 && UI.alerts.length === 1 && /Claude is still on it/.test(UI.alerts[0]), UI.alerts[0]);
delete props.EMT_ARTICLES_PAUSED; UI = null;
reset(); check('a run already 200+ seconds old -> no article work', ctx.articleTick(Date.now() - 201e3).stopped === 'time' && polls.length === 0);
props.EMT_ART_BUSY = String(Date.now()); reset();
check('another article run holds the flag -> busy', tick().stopped === 'busy' && polls.length === 0); delete props.EMT_ART_BUSY;
delete props.ANTHROPIC_API_KEY; reset();
check('no ANTHROPIC_API_KEY -> off, nothing fetched', tick().stopped === 'off' && polls.length === 0 && other.length === 0);
props.ANTHROPIC_API_KEY = 'sk-test'; props.EMT_AI_PAUSED = 'yes';
check('EMT_AI_PAUSED = yes pauses the articles too (emtAiOn)', tick().stopped === 'off'); delete props.EMT_AI_PAUSED;
// recap window: more than 5 days after the last game -> no new recap
clearArticles(); sheets['Club Fixtures'].rows.forEach((r, i) => { if (i && Number(r[0]) === 5) r[3] = iso(Date.now() - 6 * D); });
reset(); S = tick();
check('a recap more than 5 days after the last game -> not started (window), but write now still starts it', S.stopped === 'idle' && S.why.some(w => /over 5 days ago/.test(w)) && creates.length === 0 &&
  (PLAN = [{ result: ok(F.recapResearch()).result, after: 9 }], tick(true).stopped === 'submitted') && /^recap-gw5-/.test(job().id));
clearArticles(); sheets.RecapFacts.rows.slice(1).forEach(r => { r[1] = "'" + iso(Date.now() - 25 * H); }); sheets.ShowFacts.rows.slice(1).forEach(r => { r[1] = "'" + iso(Date.now() - 13 * H); }); sheets['Club Fixtures'].rows.forEach((r, i) => { if (i && Number(r[0]) === 5) r[3] = iso(Date.now() - 2 * D); });
reset(); S = tick();
check('recap facts older than 24 hours -> waits for fresher ones', S.stopped === 'idle' && S.why.some(w => /latest are 25 hours old/.test(w)), S.why.join(' | '));

/* ===================== C15 · big paused turns, lost job state, a start race ===================== */
console.log('--- C15 robustness');
clearArticles(); sheets.RecapFacts.rows.slice(1).forEach(r => { r[1] = "'" + iso(Date.now() - 1 * H); });
const bigPart = [{ type: 'server_tool_use', id: 'srvtoolu_big', name: 'web_search', input: { query: 'x' } },
  { type: 'web_search_tool_result', tool_use_id: 'srvtoolu_big', content: [{ type: 'web_search_result', url: F.U.bbc, title: 'Big', encrypted_content: 'E'.repeat(100000) }] }];
PLAN = [{ result: ok(bigPart, 'pause_turn').result }, { result: ok(F.recapResearch()).result }];
reset(); tick(); id = job().id; reset(); tick();
const contRows = sheets.ArticleWork.rows.slice(1).filter(r => r[1] === 'cont');
check('a 100,000-character paused turn: kept in 3 ArticleWork chunks (each <= 45,000 + j:) and sent back byte for byte', contRows.length === 3 && contRows.every(r => String(r[4]).startsWith('j:') && String(r[4]).length <= 45002) &&
  creates.length === 1 && JSON.stringify(creates[0].req.params.messages[1].content) === JSON.stringify(bigPart), contRows.map(r => String(r[4]).length).join(','));
delete props.EMT_ART_JOB;                                            // the job state is lost (a property deleted by hand)
PLAN = [{ result: ok(F.recapResearch()).result }];
reset(); S = tick();
check('an article left in research with no job behind it -> resumed at the next run (logged), not started again', S.id === id && S.stopped === 'submitted' && creates.length === 1 && creates[0].req.custom_id === id + '-r' &&
  art().length === 1 && logs.some(l => /resumed: its article was still researching/.test(l)), JSON.stringify(S));
clearArticles();
const origDue = ctx.emtArtDue;
ctx.emtArtDue = (f, n) => { const d = origDue(f, n); props.EMT_ART_JOB = JSON.stringify({ id: 'recap-gw5-redo00', gw: 5, kind: 'recap', phase: 'write', batch: '', tries: 0, redos: 1, startedAt: Date.now(), note: '' }); return d; };
reset(); S = tick(); ctx.emtArtDue = origDue;
check('a rewrite queued while a new job was being started -> the start backs off (no row, no batch)', S.stopped === 'idle' && S.why.join() === 'another job started meanwhile' && art().length === 0 && creates.length === 0 && job().id === 'recap-gw5-redo00');
reset(); S = tick();
check('a job whose article is not in the tab -> dropped quietly at the next run', S.stopped === 'gone' && !props.EMT_ART_JOB && creates.length === 0);
delete props.EMT_ART_JOB;

/* ===================== C16 · review fixes ===================== */
console.log('--- C16 review fixes');
['Cold Palmers', 'Team Jacob'].forEach(t => { delete props['EMT_PIN_' + t]; delete props['EMT_FAIL_' + t]; });   // C13 changed EMT_SECRET: claim again
const cp16 = Hd({ action: 'claim', team: 'Cold Palmers', pin: '1234' }).token, tj16 = Hd({ action: 'claim', team: 'Team Jacob', pin: '5555' }).token;
check('R0 fresh sign-ins for the review tests', !!cp16 && !!tj16);
// R1 · drafts are sealed at rest: the sheet is link-viewable and the app's public code names it, so a hidden tab is
// readable by anyone who asks for it by name (gviz &sheet=Articles). Nothing of a draft may be readable there.
const sheetText = () => Object.keys(sheets).map(k => JSON.stringify(sheets[k].rows)).join('\n');
const odd = 'Ødegaard’s “late” winner, 3–2, \u{1F410}';
const seal1 = ctx.emtArtSeal(odd, ctx.emtArtSecret(true));
check('R1 seal/open: non-ASCII round trip, a new nonce each time, a key made on first use, garbage -> null', ctx.emtArtOpen(seal1) === odd && seal1 !== ctx.emtArtSeal(odd, ctx.emtArtSecret(true)) &&
  /^s:[0-9a-f]{16}:[A-Za-z0-9+/=]+$/.test(seal1) && /^[0-9a-f]{64}$/.test(props.EMT_ART_SEAL) && ctx.emtArtOpen('s:zz:abc') === null && ctx.emtArtOpen('j:{}') === null && ctx.emtArtOpen('') === null);
props.EMT_ART_REVIEW = 'yes';                                         // R1 is about sealed drafts: review mode
clearArticles(); delete cache['EMT_RF_Team Jacob']; rpost('Team Jacob', tj16);
const leakA = F.recapArticle(); leakA.matchups[0].story += ' Jacob said: "This sentence is a secret draft line that must never leak."';
const goodA = F.recapArticle();
PLAN = [{ result: ok(F.recapResearch()).result }, { result: ok(asReply(leakA)).result }, { result: ok(asReply(goodA)).result }];
reset(); tick(); id = job().id; tick(); reset(); S = tick();
const fixRow = sheets.ArticleWork.rows.slice(1).find(r => r[1] === 'fix');
check('R1 a rejected reply: kept sealed in ArticleWork (j:s:), sent back intact, and its text is nowhere in the sheet (Log redacted)', fixRow && String(fixRow[4]).startsWith('j:s:') && creates.length === 1 &&
  creates[0].req.params.messages[1].content.includes('secret draft line') && !sheetText().includes('secret draft line') && /failed the checks/.test(col(row(id), 'Log')) && /"\.\.\."/.test(col(row(id), 'Log')), String(col(row(id), 'Log')).slice(-300));
reset(); S = tick(); R = row(id);
check('R1 the draft: Article sealed, title and lede nowhere in the sheet; the commissioner still gets it whole', S.stopped === 'draft' && String(col(R, 'Article')).startsWith('s:') && !sheetText().includes(goodA.title) && !sheetText().includes(goodA.lede.slice(0, 40)) &&
  Hd({ action: 'articles', team: 'Cold Palmers', token: cp16 }).drafts.find(d => d.id === id).a.title === goodA.title && get({ article: id }).error === 'notfound');
const k0 = props.EMT_ART_SEAL; delete props.EMT_ART_SEAL;
check('R1 without EMT_ART_SEAL a sealed draft cannot be read: a is null, approve -> noarticle (documented: ask for a rewrite)', Hd({ action: 'articles', team: 'Cold Palmers', token: cp16 }).drafts.find(d => d.id === id).a === null &&
  Hd({ action: 'articlemod', team: 'Cold Palmers', token: cp16, id, op: 'approve' }).error === 'noarticle' && col(row(id), 'Status') === 'draft');
props.EMT_ART_SEAL = k0;
const ap16 = Hd({ action: 'articlemod', team: 'Cold Palmers', token: cp16, id, op: 'approve' }); R = row(id);
check('R1 approved: the Article is plain j: json from now on; ?articles and ?article serve it', ap16.ok && String(col(R, 'Article')).startsWith('j:') && get({ article: id }).a.title === goodA.title && get({ articles: '1' }).live.some(l => l.id === id && l.title === goodA.title));
const dl16 = Hd({ action: 'articlemod', team: 'Cold Palmers', token: cp16, id, op: 'drop' }); R = row(id);
check('R1 a live article dropped (taken down): sealed again, gone from ?article and ?articles, not readable in the sheet', dl16.ok && String(col(R, 'Article')).startsWith('s:') && get({ article: id }).error === 'notfound' &&
  !get({ articles: '1' }).live.some(l => l.id === id) && !sheetText().includes(goodA.title));
const secretNote = 'Lead with the Gamer Derby and say nothing about the Saka benching please';
const rd16 = Hd({ action: 'articlemod', team: 'Cold Palmers', token: cp16, id, op: 'redo', note: secretNote }); R = row(id);
check('R1 a rewrite note: sealed in the Note cell, not in the Log; the commissioner and the job still have it', rd16.ok && !sheetText().includes('Gamer Derby and say') && noteOf(R).text === secretNote && noteOf(R).redos === 1 &&
  /rewrite 1 of 3 asked by Cold Palmers, with a note/.test(col(R, 'Log')) && Hd({ action: 'articles', team: 'Cold Palmers', token: cp16 }).drafts.find(d => d.id === id).note === secretNote && job().note === secretNote);
check('R1 ?health=1 never carries the sealing key', !JSON.stringify(get({ health: '1' })).includes(props.EMT_ART_SEAL));
Hd({ action: 'articlemod', team: 'Cold Palmers', token: cp16, id, op: 'drop' });
delete props.EMT_ART_REVIEW;

// R2 · web search off can come back as a 403 permission_error when the batch is made
clearArticles(); delete cache['EMT_RF_Team Jacob']; rpost('Team Jacob', tj16);
PLAN = [{ create: { code: 403, body: { type: 'error', error: { type: 'permission_error', message: 'Web search is not enabled for this organization.' } } } }, { result: ok(asReply(noSrc)).result }];
reset(); S = tick(); id = job().id;
check('R2 a 403 about web search when the research batch is made -> research unavailable, the writing goes out in the same run (was: a 36-hour wait, then failed)', col(row(id), 'Status') === 'writing' &&
  /research unavailable: Web search is not enabled/.test(col(row(id), 'Log')) && creates.length === 2 && creates[1].req.custom_id === id + '-w' && S.stopped === 'submitted', JSON.stringify(S));
clearArticles(); delete cache['EMT_RF_Team Jacob']; rpost('Team Jacob', tj16);
PLAN = [{ create: { code: 403, body: { type: 'error', error: { type: 'permission_error', message: 'Your API key does not have permission to use the specified resource.' } } } }];
reset(); S = tick();
check('R2 ... a 403 that is not about web search still waits (not counted)', S.stopped === 'wait' && col(row(S.id), 'Status') === 'research' && (job().tries || 0) === 0);
PLAN = [];

// R3 · a Premier League game with no result in the facts (postponed) in the research prompt
const pp16 = JSON.parse(JSON.stringify(RECAP)); delete pp16.pl[0].hs; delete pp16.pl[0].as;
const ru16 = ctx.emtArtResearchUser({ kind: 'recap', gw: 5 }, pp16);
check('R3 a PL game without a result is named as such in the research prompt, never "undefined-undefined"', !/undefined/.test(ru16) && /- Brentford v Chelsea \(no result in the league data: postponed or not played; check\) \(kick-off /.test(ru16) && ru16.includes('Man City 5-3 Sunderland'),
  ru16.split('\n').find(l => /Brentford/.test(l)));

// R4 · dropped and then rewritten while a run was working on it: the stale run must not overwrite the rewrite
clearArticles(); delete cache['EMT_RF_Team Jacob']; rpost('Team Jacob', tj16);
PLAN = [{ result: ok(F.recapResearch()).result }];
reset(); tick(); id = job().id; const run0 = job().run;
const realFetch16 = ctx.UrlFetchApp.fetch; let fired16 = false;
ctx.UrlFetchApp.fetch = (url, o) => {
  if (!fired16 && /\/batches\/msgbatch_\d+$/.test(url) && String((o && o.method) || 'get') === 'get') {
    fired16 = true;
    Hd({ action: 'articlemod', team: 'Cold Palmers', token: cp16, id, op: 'drop' });
    Hd({ action: 'articlemod', team: 'Cold Palmers', token: cp16, id, op: 'redo', note: 'More on the derby' });
  }
  return realFetch16(url, o); };
reset(); S = tick(); ctx.UrlFetchApp.fetch = realFetch16;
check('R4 drop then rewrite during a run: the old run stops (no batch, no research written), the rewrite\'s job (its note, redos 1) is kept', fired16 && S.stopped === 'gone' && creates.length === 0 && job() && job().id === id &&
  job().run && job().run !== run0 && job().redos === 1 && job().note === 'More on the derby' && job().phase === 'write' && col(row(id), 'Status') === 'writing' && unq(col(row(id), 'Research')) === '', JSON.stringify({ S: S.stopped, job: job() }));
PLAN = [{ result: ok(asReply(noSrc)).result }];
reset(); S = tick();
check('R4 ... the next run sends the rewrite, with the note', S.stopped === 'submitted' && creates.length === 1 && creates[0].req.custom_id === id + '-w' && creates[0].req.params.messages[0].content.includes('His note: "More on the derby"'));
PLAN = [];

// R5 · the facts were being replaced by a new post as the job read them
clearArticles(); delete cache['EMT_RF_Team Jacob']; rpost('Team Jacob', tj16);
const origFL16 = ctx.emtFactsLatest; let fl16 = 0;
ctx.emtFactsLatest = (tab, gw, withData) => (withData && tab === 'RecapFacts' && fl16++ === 0 ? null : origFL16(tab, gw, withData));
reset(); S = tick(); id = S.id; ctx.emtFactsLatest = origFL16;
check('R5 facts that moved under the read -> wait (not counted, not failed: a failed recap is never restarted)', S.stopped === 'wait' && /being replaced/.test(S.error) && col(row(id), 'Status') === 'research' && job() && (job().tries || 0) === 0 && creates.length === 0, JSON.stringify(S));
PLAN = [{ result: ok(F.recapResearch()).result }];
reset(); S = tick();
check('R5 ... the next run reads them and sends the research', S.stopped === 'submitted' && creates.length === 1 && creates[0].req.custom_id === id + '-r');
PLAN = [];

// R6 · research that came back without a single web search result: notes from memory are not a source
clearArticles(); delete cache['EMT_RF_Team Jacob']; rpost('Team Jacob', tj16);
PLAN = [{ result: ok(say('From memory: Haaland scored in the 77th minute.\n\nSOURCES:\nBBC Sport | https://www.bbc.co.uk/sport/made-up')).result }, { result: ok(asReply(noSrc)).result }];
reset(); tick(); id = job().id; reset(); S = tick();
const w16 = creates[0] && creates[0].req.params.messages[0].content;
check('R6 no search results at all -> the notes are not kept, logged, written from the league data alone (same run)', col(row(id), 'Status') === 'writing' && unq(col(row(id), 'Research')) === 't:' &&
  /web search returned no results/.test(col(row(id), 'Log')) && creates.length === 1 && w16.includes('(none: the research came back empty') && !w16.includes('77th'), String(col(row(id), 'Log')).slice(-200));
PLAN = [];

// R7 · the check: case variants and initials are not faults; real first person still is
const RS16 = ctx.emtArtResearch(F.recapResearch()).text;
const ck16 = mut => { const a = F.recapArticle(); mut(a); return ctx.emtArticleCheck(JSON.stringify(a), RECAP, RS16, 'recap', 5); };
const c16 = ck16(a => { a.matchups[0].star.label = 'star of the Match'; a.around[0].h = 'AROUND THE LEAGUE'; a.matchups[3].story += ' I AM A BALEBA move up. I. Sarr was quiet.'; });
check('R7 a label, a heading and a team name in another case, and an initial (I. Sarr), pass; label and heading come out as the app expects', c16.problems.length === 0 && c16.article.matchups[0].star.label === 'Star of the match' &&
  c16.article.around[0].h === 'Around the league', c16.problems.join(' | '));
check('R7 ... real first person is still caught', ck16(a => { a.matchups[3].story += ' I think so.'; }).problems.some(p => /First person/.test(p)) && ck16(a => { a.lede += ' Our pick is Saka.'; }).problems.some(p => /First person/.test(p)));
// R8 · the biggest article the check lets through, sealed, still fits one cell (50,000 characters); long urls are refused
const big16 = F.recapArticle(), word = 'Gyokeres';
big16.lede = Array(100).fill(word).join(' '); big16.matchups.forEach(m => { m.story = Array(110).fill(word).join(' '); m.bullets = [0, 1, 2].map(() => Array(30).fill(word).join(' ')); });
big16.around = ['Around the league', 'Waiver watch', 'Next up'].map(h => ({ h, body: Array(200).fill(word).join(' '), bullets: Array(6).fill(Array(30).fill(word).join(' ')) }));
big16.sources = Array.from({ length: 12 }, (_, i) => ({ name: 'N'.repeat(80), url: 'https://www.example.com/' + 'p'.repeat(376 - String(i).length) + i }));
const bigSeal = ctx.emtArtSeal(JSON.stringify(big16), ctx.emtArtSecret(true));
check('R8 an outsized article (over 2,000 words, the check allows 1,400; 12 sources of 400-character urls) sealed is ' + bigSeal.length + ' characters: under the 50,000 cell limit', bigSeal.length < 50000 && big16.sources.every(x => x.url.length === 400));
const longUrl = ck16(a => { a.sources[0].url = 'https://www.bbc.co.uk/sport/' + 'x'.repeat(380); });
check('R8 a source url over 400 characters is refused by the check (and left out of the research SOURCES)', longUrl.problems.some(p => /400 characters at most/.test(p)) &&
  !/x{300}/.test(ctx.emtArtResearch([{ type: 'web_search_tool_result', content: [{ url: 'https://www.bbc.co.uk/sport/' + 'x'.repeat(380) }] }, { type: 'text', text: 'Notes.\nSOURCES:\nBBC | https://www.bbc.co.uk/sport/' + 'x'.repeat(380) }]).text));
clearArticles();

/* ===================== C17 · the tone and the punch-up ===================== */
console.log('--- C17 tone prompts and the punch-up');
delete props.EMT_PUNCH_OFF;
// T · the prompts
const TONE = ctx.EMT_TONE_LINES.join('\n');
const P5 = { EMT_AI_SYSTEM: ctx.EMT_AI_SYSTEM, EMT_SHOW_SYSTEM: ctx.EMT_SHOW_SYSTEM, EMT_ART_SYSTEM: ctx.EMT_ART_SYSTEM, EMT_PUNCH_ART_SYSTEM: ctx.EMT_PUNCH_ART_SYSTEM, EMT_PUNCH_SHOW_SYSTEM: ctx.EMT_PUNCH_SHOW_SYSTEM };
check('T1 the tone block (THE READERS, with its hard limits) is in all five prompts; none says "No swearing"; no em or en dashes', Object.values(P5).every(x => x.includes(TONE)) && Object.values(P5).every(x => !/no swearing/i.test(x)) &&
  Object.values(P5).every(x => !/[–—]/.test(x)) && TONE.startsWith('THE READERS. Eight lads in their early twenties') && TONE.includes('- Hard limits, whatever else this prompt says:') && TONE.includes('  - nothing sexual.') &&
  TONE.includes('there are at most two in a whole piece.') && TONE.endsWith('  Everything about football and this fantasy league is fair game.'), Object.keys(P5).filter(k => !P5[k].includes(TONE) || /no swearing/i.test(P5[k])).join());
const before = (x, a, b) => x.indexOf(a) > -1 && x.indexOf(b) > -1 && x.indexOf(a) < x.indexOf(b);
check('T2 where it goes: after the rules in the AI writer; after STYLE and before REPLY in the show and article writers; after the brief in both punch-ups', ctx.EMT_AI_SYSTEM.endsWith(TONE) && before(ctx.EMT_AI_SYSTEM, '9. Rumours come from', TONE) &&
  before(ctx.EMT_SHOW_SYSTEM, 'STYLE.', TONE) && before(ctx.EMT_SHOW_SYSTEM, TONE, 'REPLY with JSON only') && before(ctx.EMT_ART_SYSTEM, 'STYLE.', TONE) && before(ctx.EMT_ART_SYSTEM, TONE, 'REPLY with one JSON object only') &&
  ctx.EMT_PUNCH_ART_SYSTEM.endsWith(TONE) && ctx.EMT_PUNCH_SHOW_SYSTEM.endsWith(TONE) && ctx.EMT_PUNCH_ART_SYSTEM.startsWith('You are the punch-up writer for Matchweek, the app of El Matador Tire') &&
  ctx.EMT_PUNCH_ART_SYSTEM.includes('Keep each field within about 15 percent of its length.') && ctx.EMT_PUNCH_SHOW_SYSTEM.startsWith('You are the punch-up writer for the Gameweek Show') && ctx.EMT_PUNCH_SHOW_SYSTEM.includes('Each beat stays 10 to 22 words.'));
check('T3 the new lines: the three personas, rule 3, the booth voice, 10 to 22 words, three style beats (the old one gone), the article voice and banter', ctx.EMT_AI_SYSTEM.includes('His comedy is world-exclusive gravity for trivial fantasy news, told in insider jargon.') &&
  ctx.EMT_AI_SYSTEM.includes('The meltdown: furious, theatrical, calls for sackings, keeps receipts. The comedy is an overreaction to one real, specific decision.') && ctx.EMT_AI_SYSTEM.includes('"thumb": {"t1": big caps line, max 18 characters, "t2": second caps line, max 22, "lo": caps strap, max 22}') &&
  ctx.EMT_AI_SYSTEM.includes('Commentary-box calm with a knife in it: grave delivery and a deadpan undercut at the end.') && ctx.EMT_AI_SYSTEM.includes('3. Banter is about this fantasy league only: picks, benchings, results, quotes, form, the table. THE READERS below sets what is funny and the hard limits.') &&
  ctx.EMT_SHOW_SYSTEM.includes('the show should make the group chat laugh at least five times.') && ctx.EMT_SHOW_SYSTEM.includes('\n- 10 to 22 words per beat.\n') && !ctx.EMT_SHOW_SYSTEM.includes('10 to 16') &&
  ctx.EMT_SHOW_SYSTEM.includes('"Gibbs-White tops the eleven. Not a single flag among PJ\'s starters. Fully fit. Just shite."') && ctx.EMT_SHOW_SYSTEM.includes('"Palmer, Mainoo, Rice and Jacquet all carry knocks. Bad week to have named your club after one of them."') &&
  ctx.EMT_SHOW_SYSTEM.includes('"Haaland goes to Anfield. Ethan\'s plan is Haaland. Ethan\'s backup plan is also Haaland."') && !ctx.EMT_SHOW_SYSTEM.includes('The model says 9%') &&
  ctx.EMT_SHOW_SYSTEM.includes('- Banter only about the league: picks, form, the table, quotes, and the running jokes in NOTES. THE READERS below sets what is funny and the hard limits.') &&
  ctx.EMT_ART_SYSTEM.includes('THE VOICE. An objective third-person narrator who reports straight and is funny on top') && ctx.EMT_ART_SYSTEM.includes('Every matchup gets at least one real joke, built the way THE READERS describes.') &&
  !/minimal and dry/.test(ctx.EMT_ART_SYSTEM) && ctx.EMT_ART_SYSTEM.includes('THE READERS below sets what is funny and the hard limits. Quote a manager only word for word'));
// the show's check follows the new beat length
const showFx17 = PREV.fixtures.map(x => ({ home: x.home, away: x.away, star: { h: x.H.xi[0].code, a: x.A.xi[0].code }, beats: ['The model has this one on a knife edge, 2 to 1.', 'The eleven is settled and ready for gameweek 6.', 'The visitors arrive with plenty to prove this week.', 'Their eleven has a familiar look to it again.', 'The series is close and so is the model.'] }));
const SHOW0 = () => ({ open: 'Gameweek 6. Two derbies and plenty of flags. Here\'s how it lines up.', chapters: JSON.parse(JSON.stringify(showFx17)), close: 'That\'s the gameweek. Lineups in before the deadline, and get on the record in the press room.' });
const sAllowed = ctx.emtShowPrompt(6, PREV, Date.now() + 20 * H).allowed;
const beatN = n => Array.from({ length: n }, (_, i) => (i % 2 ? 'the' : 'eleven')).join(' ') + '.';
const scN = n => { const s = SHOW0(); s.chapters[0].beats[1] = beatN(n); return ctx.emtShowCheck(JSON.stringify(s), PREV, sAllowed, 'end_turn').problems; };
check('T4 emtShowCheck follows the new beat length: 22 and 32 words pass (the old slack of 10), 33 and 4 do not, and it says 10 to 22', scN(22).length === 0 && scN(32).length === 0 && scN(33).some(p => /33 words; keep every beat to 10 to 22\./.test(p)) &&
  scN(4).some(p => /4 words/.test(p)) && /keep every beat to 10 to 22 words/.test(ctx.emtShowCheck('{"open":"Gamew', PREV, sAllowed, 'max_tokens').problems[0]), scN(33).join(' | '));

// P · articles: the punch phase
let pS;
const toPunch = (...punch) => {     // a recap through research and writing, its checked article sent to the punch-up (punch: its batch outcomes)
  clearArticles(); delete cache['EMT_RF_Team Jacob']; rpost('Team Jacob', tj16);
  PLAN = [{ result: ok(F.recapResearch()).result }, { result: ok(asReply(F.recapArticle())).result }].concat(punch);
  reset(); tick(); id = job().id; tick(); reset(); pS = tick();
  return id;
};
const baseA = F.recapArticle(), baseStory = baseA.matchups[3].story, punchStory = F.recapPunched().matchups[3].story;
const drafted = () => artOf(row(id)), logOf = () => String(col(row(id), 'Log')), lastLog = () => logOf().split('\n').pop();
const RS17 = ctx.emtArtResearch(F.recapResearch()).text;
const P17 = () => JSON.parse(props.EMT_PUNCH_LAST || '{}');
// P1 · an em dash
const dashP = F.recapPunched(); dashP.matchups[3].story = dashP.matchups[3].story.replace(', and still the loudest', ' — and still the loudest');
toPunch({ result: ok(asReply(dashP)).result });
check('P1 setup: the punch-up batch is out, the job in its punch phase', pS.stopped === 'submitted' && job().phase === 'punch' && creates.some(c => c.req.custom_id === id + '-p') && dashP.matchups[3].story.includes('—'));
reset(); pS = tick();
check('P1 a punch-up with an em dash fails the check -> the checked base is published; Model the writer only; Log "punch-up not used" with the problem; not a try', pS.stopped === 'live' && col(row(id), 'Status') === 'live' &&
  drafted().matchups[3].story === baseStory && col(row(id), 'Model') === 'claude-sonnet-5-5' && /written by claude-sonnet-5-5, \d+ words; punch-up not used: the check found 1 problem: An em dash or en dash in Devils U21s v I Am a Baleba, the story: use a comma, a colon or a full stop\. Published automatically; every manager can read it now\.$/.test(lastLog()) &&
  !/try 1/.test(logOf()) && !props.EMT_ART_JOB && workRows() === 0 && pS.punch === 'punch-up not used' && P17().article.used === false && P17().article.why === 'the check found 1 problem' &&
  logs.some(l => /punch-up not used: the check found 1 problem: An em dash/.test(l)) && /the punch-up was not used/.test(ctx.emtArtSummary(pS)), lastLog());
// P2 · a new number: one from the facts (the check lets it through, the punch-up guard does not), and an invented one
const baseNums = new Set([].concat(...ctx.emtArtTextsOf(baseA).map(t => ctx.emtShowNums(t))));
const okF17 = ctx.emtArtAllowed(ctx.emtArtSent(RECAP), RECAP), FN = Array.from({ length: 300 }, (_, i) => i + 12).find(n => okF17[String(n)] && !baseNums.has(String(n)));
const numP = F.recapPunched(); numP.lede += ' Somewhere, ' + FN + ' was a number that mattered.';
check('P2 setup: ' + FN + ' is in the facts but not in the checked article, so emtArticleCheck alone passes it', FN > 11 && ctx.emtArticleCheck(JSON.stringify(numP), RECAP, RS17, 'recap', 5).problems.length === 0);
toPunch({ result: ok(asReply(numP)).result }); reset(); pS = tick();
check('P2 a punch-up that adds a number (' + FN + ', from the facts) -> the punch-up guard refuses it, the checked base is the draft', pS.stopped === 'live' && drafted().lede === baseA.lede &&
  new RegExp('punch-up not used: the check found 1 problem: The punch-up added the number ' + FN + ', which the checked version does not have').test(lastLog()) && col(row(id), 'Model') === 'claude-sonnet-5-5', lastLog());
const invP = F.recapPunched(); invP.matchups[0].bullets[0] = 'Mitchell led Team Jacob with 7 points, and ' + INV + ' minutes of nothing.';
toPunch({ result: ok(asReply(invP)).result }); reset(); pS = tick();
check('P2 a punch-up that invents a number (' + INV + ') -> emtArticleCheck refuses it, the checked base (the quoted text redacted in the Log)', pS.stopped === 'live' && drafted().matchups[0].bullets[0] === baseA.matchups[0].bullets[0] &&
  new RegExp('punch-up not used: the check found 1 problem: The number ' + INV + ' \\(Team Jacob v Cold Palmers, bullet 1: "\\.\\.\\."\\) is not in FACTS or RESEARCH').test(lastLog()), lastLog());
// P3 · a star swapped for another valid one
const fx17 = RECAP.fixtures.find(x => x.home === 'Team Jacob'), otherStar = fx17.H.xi.concat(fx17.A.xi).map(p => String(p.code)).find(c => c !== '513418');
const starP = F.recapPunched(); starP.matchups[0].star.code = otherStar;
toPunch({ result: ok(asReply(starP)).result }); reset(); pS = tick();
check('P3 a punch-up that swaps the star for another player of that eleven -> refused (the star must stay), the checked base', pS.stopped === 'live' && drafted().matchups[0].star.code === '513418' &&
  /the check found 1 problem: Team Jacob v Cold Palmers: the star must stay 513418, Star of the match\./.test(lastLog()), lastLog());
// P4 · errored, expired, lost
toPunch(errd('api_error', 'Internal server error')); reset(); pS = tick();
check('P4 a punch-up batch that errored -> the checked base at once, not a try, nothing resubmitted', pS.stopped === 'live' && drafted().matchups[3].story === baseStory && creates.length === 0 &&
  /punch-up not used: the punch-up request errored: api_error: Internal server error/.test(lastLog()) && !/try 1/.test(logOf()), lastLog());
toPunch({ result: { type: 'expired' } }); reset(); pS = tick();
check('P4 ... expired -> the checked base', pS.stopped === 'live' && drafted().matchups[3].story === baseStory && /punch-up not used: the punch-up request expired/.test(lastLog()));
toPunch({ result: ok(asReply(F.recapPunched())).result }); delete BATCHES[job().batch]; reset(); pS = tick();
check('P4 ... a punch-up batch that is gone (404) -> the checked base', pS.stopped === 'live' && drafted().matchups[3].story === baseStory && /punch-up not used: the punch-up batch was lost: the batch msgbatch_\d+ is gone/.test(lastLog()), lastLog());
// P5 · the punch model chain
const punch404 = m => ({ create: { code: 404, body: { type: 'error', error: { type: 'not_found_error', message: 'model: ' + m } } } });
toPunch(punch404('claude-haiku-5-5'), { result: ok(asReply(F.recapPunched())).result });
check('P5 the punch model answers 404 -> claude-haiku-4-5 at once (noted gone), not a try; the writer\'s chain is untouched', pS.stopped === 'submitted' && creates.filter(c => /-p$/.test(c.req.custom_id)).map(c => c.req.params.model).join() === 'claude-haiku-5-5,claude-haiku-4-5' &&
  job().model === 'claude-haiku-4-5' && job().writer === 'claude-sonnet-5-5' && JSON.parse(props.EMT_MODEL_GONE)['claude-haiku-5-5'] > 0 && (job().tries || 0) === 0 && JSON.stringify(ctx.emtModelsLive(ctx.emtModelChain('EMT_ARTICLE_MODEL', ctx.EMT_ART_MODELS))) === '["claude-sonnet-5-5","claude-opus-5-5","claude-sonnet-4-5"]');
reset(); pS = tick();
check('P5 ... the draft is the punched-up one and records both models: claude-sonnet-5-5 + claude-haiku-4-5', pS.stopped === 'live' && col(row(id), 'Model') === 'claude-sonnet-5-5 + claude-haiku-4-5' && drafted().matchups[3].story === punchStory && /punched up by claude-haiku-4-5/.test(lastLog()));
toPunch(punch404('claude-haiku-5-5'), punch404('claude-haiku-4-5'));
check('P5 every punch model answers 404 -> the checked base in the same run (all gone)', pS.stopped === 'live' && drafted().matchups[3].story === baseStory && col(row(id), 'Model') === 'claude-sonnet-5-5' && /punch-up not used: no punch-up model is available: tried \(claude-haiku-5-5, claude-haiku-4-5\)\. Published automatically/.test(lastLog()), lastLog());
toPunch(errd('not_found_error', 'model: claude-haiku-5-5'), errd('not_found_error', 'model: claude-haiku-4-5'));
reset(); pS = tick();
check('P5 a punch-up result errored with not_found_error -> the next punch model, same run', pS.stopped === 'submitted' && creates.length === 1 && creates[0].req.custom_id === id + '-p' && creates[0].req.params.model === 'claude-haiku-4-5');
reset(); pS = tick();
check('P5 ... the last one too -> the checked base, never failed', pS.stopped === 'live' && col(row(id), 'Status') === 'live' && drafted().matchups[3].story === baseStory &&
  /punch-up not used: no punch-up model is available: the last, claude-haiku-4-5, answered: model: claude-haiku-4-5/.test(lastLog()), lastLog());
// P6 · 2 hours
toPunch({ result: ok(asReply(F.recapPunched())).result, after: 99 });
const j17 = job(); j17.punchAt = Date.now() - 1.9 * H; j17.batchAt = j17.punchAt; props.EMT_ART_JOB = JSON.stringify(j17);
reset(); pS = tick();
const hzP = get({ health: '1' });
check('P6 a punch-up still running after 1.9 hours -> still waiting (?health shows the punch phase and the writer)', pS.stopped === 'waiting' && col(row(id), 'Status') === 'writing' && cancels.length === 0 &&
  hzP.articles.job.phase === 'punch' && hzP.articles.job.writer === 'claude-sonnet-5-5' && hzP.articles.job.model === 'claude-haiku-5-5' && /punching up what claude-sonnet-5-5 wrote, batch sent 114 minutes ago to claude-haiku-5-5/.test(ctx.articlesStatus()));
const j18 = job(); j18.punchAt = Date.now() - 2.1 * H; props.EMT_ART_JOB = JSON.stringify(j18);
reset(); pS = tick();
check('P6 ... still running 2 hours after the punch-up started -> cancelled, the checked base is the draft (not a try, not failed)', pS.stopped === 'live' && cancels.length === 1 && drafted().matchups[3].story === baseStory &&
  /punch-up not used: the punch-up was still unfinished after 2 hours/.test(lastLog()) && !props.EMT_ART_JOB && workRows() === 0, lastLog());
// P7 · the job's 36 hours run out during the punch-up
toPunch({ result: ok(asReply(F.recapPunched())).result, after: 99 });
const j36p = job(); j36p.startedAt = Date.now() - 37 * H; props.EMT_ART_JOB = JSON.stringify(j36p);
reset(); pS = tick();
check('P7 the job\'s 36 hours run out during the punch-up -> the checked base is published, not failed', pS.stopped === 'live' && col(row(id), 'Status') === 'live' && cancels.length === 1 && /punch-up not used: the job reached its 36-hour limit/.test(lastLog()));
// P8 · EMT_PUNCH_OFF
props.EMT_PUNCH_OFF = 'yes';
clearArticles(); delete cache['EMT_RF_Team Jacob']; rpost('Team Jacob', tj16);
PLAN = [{ result: ok(F.recapResearch()).result }, { result: ok(asReply(F.recapArticle())).result }];
reset(); tick(); id = job().id; tick(); reset(); pS = tick();
check('P8 EMT_PUNCH_OFF = yes -> the checked article is the draft at once: no punch-up batch, no base kept, Model the writer only', pS.stopped === 'live' && creates.length === 0 && polls.length === 1 && col(row(id), 'Model') === 'claude-sonnet-5-5' &&
  /punch-up off \(EMT_PUNCH_OFF = yes\)/.test(lastLog()) && drafted().matchups[3].story === baseStory && workRows() === 0, lastLog());
delete props.EMT_PUNCH_OFF;
toPunch({ result: ok(asReply(F.recapPunched())).result, after: 99 });
props.EMT_PUNCH_OFF = 'yes'; reset(); pS = tick(); delete props.EMT_PUNCH_OFF;
check('P8 ... turned off while a punch-up runs -> its batch cancelled, the checked base', pS.stopped === 'live' && cancels.length === 1 && drafted().matchups[3].story === baseStory && /punch-up not used: turned off \(EMT_PUNCH_OFF = yes\)/.test(lastLog()));
// P9 · the base lost from ArticleWork
toPunch({ result: ok(asReply(F.recapPunched())).result });
sheets.ArticleWork.rows = sheets.ArticleWork.rows.filter((r, i) => !i || r[1] !== 'base');
PLAN = [{ result: ok(asReply(F.recapArticle())).result }, { result: ok(asReply(F.recapPunched())).result }];
reset(); pS = tick();
check('P9 the checked base lost from ArticleWork -> written again with the writer (not a try); nothing unchecked becomes a draft', pS.stopped === 'submitted' && job().phase === 'write' && (job().tries || 0) === 0 && creates.length === 1 &&
  creates[0].req.custom_id === id + '-w' && creates[0].req.params.model === 'claude-sonnet-5-5' && col(row(id), 'Status') === 'writing' && /could not be read back for the punch-up/.test(logOf()), JSON.stringify(pS));
reset(); tick(); reset(); pS = tick();
check('P9 ... then through the punch-up to the draft as usual', pS.stopped === 'live' && col(row(id), 'Model') === 'claude-sonnet-5-5 + claude-haiku-5-5' && drafted().matchups[3].story === punchStory);
const st17 = ctx.articlesStatus();
check('P10 articlesStatus has a punch-up line with the last outcome', /Punch-up: on, models claude-haiku-5-5, claude-haiku-4-5\. Last article: recap-gw5-[0-9a-f]{6}, punched up by claude-haiku-5-5, \d{4}-/.test(st17), st17.split('\n').find(l => /Punch-up/.test(l)));

// S · the show: one punch-up call after a checked script
const sfAge = h => sheets.ShowFacts.rows.slice(1).forEach(r => { r[1] = "'" + iso(Date.now() - h * H); });
const showRows = () => (sheets.ShowScripts ? sheets.ShowScripts.rows.slice(1).filter(r => Number(r[0]) === 6) : []);
const showReset = () => { if (sheets.ShowScripts) sheets.ShowScripts.rows.length = 1; ['EMT_SHOW_TRIES_6', 'EMT_SHOW_WRITING', 'EMT_MODEL_GONE'].forEach(k => delete props[k]); };
const stored17 = () => JSON.parse(String(showRows()[0][4]).slice(2));
setDeadline(20); sfAge(1);
const sw0 = SHOW0(), swP = SHOW0();
swP.chapters[0].beats[1] = 'The eleven is settled and ready for gameweek 6. Fully fit, and still nobody fancies them.';
showReset(); MSG = [{ text: JSON.stringify(sw0) }, { text: 'Here it is:\n' + JSON.stringify(swP) }]; reset();
let sw = ctx.showWriterTick(Date.now());
const pu17 = msgs[1] ? msgs[1].messages[0].content : '';
check('S1 show: one punch-up call (claude-haiku-5-5, EMT_PUNCH_SHOW_SYSTEM, "THE SCRIPT:" + the checked json); it passes -> stored, Model "writer + punch model", voiced as words', sw.written === true && msgs.length === 2 &&
  msgs[0].model === 'claude-sonnet-5-5' && msgs[0].system === ctx.EMT_SHOW_SYSTEM && msgs[1].model === 'claude-haiku-5-5' && msgs[1].system === ctx.EMT_PUNCH_SHOW_SYSTEM && msgs[1].max_tokens === 2000 &&
  pu17.startsWith('THE SCRIPT:\n') && JSON.parse(pu17.slice(12)).chapters[0].beats[1] === sw0.chapters[0].beats[1] && showRows().length === 1 && showRows()[0][2] === 'claude-sonnet-5-5 + claude-haiku-5-5' &&
  /nobody fancies them/.test(stored17().chapters[0].beats[1]) && /gameweek six/.test(stored17().chapters[0].beats[1]) && sw.punch.used === true && sw.calls === 2 && props.EMT_SHOW_TRIES_6 === '1' &&
  logs.some(l => /^Show writer GW6: written by claude-sonnet-5-5, punched up by claude-haiku-5-5 \(1 call, 4 chapters\)/.test(l)) && !props.EMT_SHOW_WRITING, JSON.stringify(sw.punch || sw.problems));
const swStar = SHOW0(); swStar.chapters[0].star.h = PREV.fixtures[0].H.xi[1].code;
showReset(); MSG = [{ text: JSON.stringify(sw0) }, { text: JSON.stringify(swStar) }]; reset(); sw = ctx.showWriterTick(Date.now());
check('S2 show: a punch-up that swaps a star (still a code in that eleven) -> refused, the checked script stored, Model the writer only, logged', sw.written && msgs.length === 2 && showRows()[0][2] === 'claude-sonnet-5-5' &&
  stored17().chapters[0].star.h === sw0.chapters[0].star.h && sw.punch.used === false && sw.punch.why === 'the check found 1 problem' && logs.some(l => /Punch-up not used: the check found 1 problem: .*the stars must stay/.test(l)), JSON.stringify(sw.punch));
const sOk17 = ctx.emtShowAllowed(sAllowed), SINV = [77, 83, 89, 97, 101, 103, 107, 109, 113, 127].find(n => !sOk17[String(n)]);
const swNum = SHOW0(); swNum.chapters[1].beats[1] = 'The eleven is settled, with ' + SINV + ' reasons to fear the weekend.';
showReset(); MSG = [{ text: JSON.stringify(sw0) }, { text: JSON.stringify(swNum) }]; reset(); sw = ctx.showWriterTick(Date.now());
check('S2 show: a punch-up with an invented number (' + SINV + ') fails emtShowCheck -> the checked script stands', sw.written && showRows()[0][2] === 'claude-sonnet-5-5' && sw.punch.used === false &&
  logs.some(l => new RegExp('Punch-up not used: the check found 1 problem: The number ' + SINV + ' ').test(l)) && !JSON.stringify(stored17()).includes('fear the weekend'));
const swLong = SHOW0(); swLong.chapters[2].beats[0] = beatN(26);
showReset(); MSG = [{ text: JSON.stringify(sw0) }, { text: JSON.stringify(swLong) }]; reset(); sw = ctx.showWriterTick(Date.now());
check('S2 show: a punch-up that grows a beat past 22 words (26: the check alone would let it through) -> refused', sw.written && showRows()[0][2] === 'claude-sonnet-5-5' && /, beat 0: 26 words; 22 at most; the checked script stands/.test(logs.join('\n')));
const realNow = Date.now;
showReset(); MSG = [{ text: JSON.stringify(sw0), after: () => { Date.now = () => realNow() + 160e3; } }]; reset();
try { sw = ctx.showWriterTick(realNow()); } finally { Date.now = realNow; }
check('S3 show: the run is already past 150 seconds once the script is checked -> no punch-up call, the checked script stored', sw.written && msgs.length === 1 && showRows()[0][2] === 'claude-sonnet-5-5' && sw.punch.used === false &&
  /^skipped, the run was already 1[56]\d seconds old$/.test(sw.punch.why) && logs.some(l => /Punch-up not used: skipped, the run was already/.test(l)), JSON.stringify(sw.punch));
props.EMT_PUNCH_OFF = 'yes'; showReset(); MSG = [{ text: JSON.stringify(sw0) }]; reset(); sw = ctx.showWriterTick(Date.now()); delete props.EMT_PUNCH_OFF;
check('S4 show: EMT_PUNCH_OFF = yes -> no punch-up call, nothing logged about it', sw.written && msgs.length === 1 && sw.punch.off === true && showRows()[0][2] === 'claude-sonnet-5-5' && !logs.some(l => /[Pp]unch/.test(l)));
showReset(); MSG = [{ text: JSON.stringify(sw0) }, { code: 404, body: JSON.stringify({ type: 'error', error: { type: 'not_found_error', message: 'model: claude-haiku-5-5' } }) }, { text: JSON.stringify(swP) }]; reset(); sw = ctx.showWriterTick(Date.now());
check('S5 show: the punch model answers 404 -> claude-haiku-4-5 in the same call, Model "claude-sonnet-5-5 + claude-haiku-4-5"', sw.written && msgs.length === 3 && msgs[1].model === 'claude-haiku-5-5' && msgs[2].model === 'claude-haiku-4-5' && showRows()[0][2] === 'claude-sonnet-5-5 + claude-haiku-4-5' && sw.calls === 3);
showReset(); MSG = [{ text: JSON.stringify(sw0) }]; reset(); sw = ctx.showWriterTick(Date.now());     // nothing queued: the punch-up call throws, as UrlFetchApp does without a network
check('S5 show: a punch-up call that throws -> caught, the checked script stored', sw.written && msgs.length === 2 && showRows()[0][2] === 'claude-sonnet-5-5' && sw.punch.why === 'the call failed');
const hz17 = get({ health: '1' }), hz17s = JSON.stringify(hz17);
check('P10 ?health=1 shows the punch-up: articles.punch and show.punch with the last outcome (a short reason, no draft or script text)', hz17.articles.punch.off === false && hz17.articles.punch.last.used === true &&
  hz17.articles.punch.last.model === 'claude-haiku-5-5' && /^recap-gw5-/.test(hz17.articles.punch.last.id) && hz17.show.punch.off === false && hz17.show.punch.last.gw === 6 && hz17.show.punch.last.used === false &&
  hz17.show.punch.last.why === 'the call failed' && !/loudest side|nobody fancies|sk-test|msgbatch/.test(hz17s) && Object.keys(hz17).sort().join() === 'ai,articles,facts,ok,self,show,version', JSON.stringify(hz17.articles.punch) + JSON.stringify(hz17.show.punch));
sfAge(13); showReset(); setDeadline(20); MSG = []; clearArticles();

/* ===================== C14 · aiTick ===================== */
console.log('--- C14 aiTick');
const real = { aiWriterTick: ctx.aiWriterTick, showWriterTick: ctx.showWriterTick, showTick: ctx.showTick, articleTick: ctx.articleTick, selfUpdateTick: ctx.selfUpdateTick }, order = [];
Object.keys(real).forEach(k => { ctx[k] = (t0) => { order.push(k + (typeof t0 === 'number' ? '(t0)' : '')); }; });
ctx.aiTick();
check('aiTick runs articleTick after showTick and before selfUpdateTick, with the run\'s start time', order.join(',') === 'aiWriterTick,showWriterTick(t0),showTick(t0),articleTick(t0),selfUpdateTick(t0)', order.join(','));
order.length = 0; reset();
Object.keys(real).forEach(k => { ctx[k] = () => { order.push(k); throw new Error(k + ' down'); }; });
let threw = null; try { ctx.aiTick(); } catch (e) { threw = e; }
check('every part throwing: all five still run; articleTick\'s error is logged, never thrown; the AI writer\'s surfaces', order.join(',') === 'aiWriterTick,showWriterTick,showTick,articleTick,selfUpdateTick' && threw && threw.message === 'aiWriterTick down' &&
  logs.some(l => l === 'Articles failed: articleTick down'));
order.length = 0; ctx.aiWriterTick = () => { order.push('ai'); }; ctx.showWriterTick = () => { order.push('sw'); }; ctx.showTick = () => { order.push('st'); }; ctx.selfUpdateTick = () => { order.push('su'); };
ctx.articleTick = real.articleTick;
clearArticles(); sheets.RecapFacts.rows.slice(1).forEach(r => { r[1] = "'" + iso(Date.now() - 1 * H); });
PLAN = [{ result: ok(F.recapResearch()).result }];
threw = null; reset(); try { ctx.aiTick(); } catch (e) { threw = e; }
check('the real articleTick inside aiTick: the recap starts, the others still run', threw === null && order.join(',') === 'ai,sw,st,su' && creates.length === 1 && /^recap-gw5-/.test(job().id));
ctx.UrlFetchApp.fetch = () => { throw new Error('Address unavailable: api.anthropic.com'); };
order.length = 0; threw = null; reset(); try { ctx.aiTick(); } catch (e) { threw = e; }
check('UrlFetchApp throwing inside articleTick (no network): caught, the job waits, the others run, the busy flag is released', threw === null && order.join(',') === 'ai,sw,st,su' && job() && !props.EMT_ART_BUSY && logs.some(l => /trying again next run/.test(l)));
Object.keys(real).forEach(k => { ctx[k] = real[k]; });

console.log(fails ? fails + ' FAILED' : 'ALL PASS');
