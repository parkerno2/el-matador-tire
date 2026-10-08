// v3.14 tests: articles publish themselves (no approval step by default), EMT_ART_REVIEW = yes brings back the
// draft-and-approve flow, and the commissioner can have a live article rewritten (the live version stays up until the
// new one passes the checks) or taken down.
//   cd /home/claude/emt && node tests/codegs/v314.js
// The harness is v313.js's: vm, a mock Sheet, PropertiesService, CacheService, LockService, UrlFetchApp, with the
// Batches API (create, poll, results JSONL, cancel) mocked.
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

const tokCP = Hd({ action: 'claim', team: 'Cold Palmers', pin: '1234' }).token;
const tokDU = Hd({ action: 'claim', team: 'Devils U21s', pin: '4321' }).token;
const rStr = JSON.stringify(RECAP);
const rpost = (team, tok) => Hd({ action: 'artfacts', team, token: tok, gw: 5, kind: 'recap', facts: rStr });
const setDeadline = h => { sheets.Matchweeks.rows[3][1] = "'" + iso(Date.now() + h * H); };
const sp = (team, tok, f) => Hd({ action: 'showfacts', team, token: tok, gw: 6, facts: JSON.stringify(f) });
const mod = (team, tok, id, op, note) => Hd({ action: 'articlemod', team, token: tok, id, op, note });
const sheetText = () => Object.keys(sheets).map(k => JSON.stringify(sheets[k].rows)).join('\n');
const lastLog = id => String(col(row(id), 'Log')).split('\n').pop();
const pend = id => noteOf(row(id)).pend;
const liveJ = id => JSON.parse(String(col(row(id), 'Article')).slice(2));
const commish = () => Hd({ action: 'articles', team: 'Cold Palmers', token: tokCP });
const notCommish = () => JSON.stringify(Hd({ action: 'articles', team: 'Devils U21s', token: tokDU }));
const recA = F.recapArticle(), recP = F.recapPunched();
let S, R, id;

/* ===================== V · the release ===================== */
console.log('--- V the release');
check('V1 the CHANGELOG starts at v3.14 (what the self-update reads) and EMT_VERSION follows it', ctx.emtSelfVersion(src) === 'v3.14' && ctx.EMT_VERSION === 'v3.14' && /\* v3\.14 · 8 Oct 2026\n \*   Recaps and previews publish themselves\./.test(src) && /No new setup and no new permissions\. Optional Script Property: EMT_ART_REVIEW = yes\./.test(src));
check('V2 the writer\'s prompt no longer promises a read by the commissioner (true in both modes now)', ctx.EMT_ART_SYSTEM.includes('Every article is checked automatically before the league sees it.') && !/commissioner reads every draft/i.test(ctx.EMT_ART_SYSTEM));
check('V3 the default is auto: emtArtReview() false; ?articles=1 review false; ?health=1 articles.mode auto', !ctx.emtArtReview() && get({ articles: '1' }).review === false && get({ health: '1' }).articles.mode === 'auto');

/* ===================== B · review mode (EMT_ART_REVIEW = yes): the v3.13 flow, unchanged ===================== */
console.log('--- B review mode');
props.EMT_ART_REVIEW = 'yes';
check('B0 recap facts in', rpost('Cold Palmers', tokCP).ok === true);
PLAN = [{ result: ok(F.recapResearch()).result }, { result: ok(asReply(recA)).result }, { result: ok(asReply(recP)).result }];
reset(); tick(); id = job().id; tick(); tick(); reset(); S = tick(); R = row(id);
check('B1 review mode: the checked article waits as a sealed draft (status draft, s:, no Approved, Log "Waiting for the commissioner."); nothing served', S.stopped === 'draft' && col(R, 'Status') === 'draft' && String(col(R, 'Article')).startsWith('s:') &&
  !sheetText().includes(recA.title) && unq(col(R, 'Approved (UTC)')) === '' && /Waiting for the commissioner\.$/.test(lastLog(id)) && get({ article: id }).error === 'notfound' && get({ articles: '1' }).live.length === 0 &&
  get({ articles: '1' }).waiting[0].status === 'draft' && /waits for Cold Palmers in the app/.test(ctx.emtArtSummary(S)), JSON.stringify(S));
check('B2 review true in ?articles=1 and POST articles; ?health=1 mode review; articlesStatus says Mode: review', get({ articles: '1' }).review === true && commish().review === true && commish().drafts[0].id === id &&
  get({ health: '1' }).articles.mode === 'review' && /^Mode: review \(EMT_ART_REVIEW = yes\): every article waits as a draft until Cold Palmers approves it in the app\.$/m.test(ctx.articlesStatus()));
const apB = mod('Cold Palmers', tokCP, id, 'approve'); R = row(id);
check('B3 approve -> live through the same cells as the automatic publish (plain j: json, Approved set), Log "approved by"; ?article auto false', apB.ok && apB.status === 'live' && String(col(R, 'Article')).startsWith('j:') &&
  liveJ(id).title === recA.title && /^'\d{4}-/.test(col(R, 'Approved (UTC)')) && /approved by Cold Palmers/.test(lastLog(id)) && get({ article: id }).auto === false && get({ articles: '1' }).live[0].id === id);
const noteB = col(R, 'Note');
check('B4 review mode: a rewrite of a live article is refused (live), as in v3.13; nothing changes, no job', mod('Cold Palmers', tokCP, id, 'redo', 'Shorter please').error === 'live' && col(row(id), 'Note') === noteB && !props.EMT_ART_JOB && col(row(id), 'Status') === 'live');
get({ articles: '1' }); delete props.EMT_ART_REVIEW;
check('B5 the list comes from the cache, but review is read fresh: false as soon as EMT_ART_REVIEW is removed', 'EMT_ART_LIST' in cache && get({ articles: '1' }).review === false && 'EMT_ART_LIST' in cache);
check('B6 EMT_ART_REVIEW: yes, YES and " Yes " mean review; no, empty, blank or missing mean auto', ['yes', 'YES', ' Yes '].every(v => (props.EMT_ART_REVIEW = v, ctx.emtArtReview())) &&
  ['no', '', ' '].every(v => (props.EMT_ART_REVIEW = v, !ctx.emtArtReview())) && (delete props.EMT_ART_REVIEW, !ctx.emtArtReview()));

/* ===================== A · auto-publish (the default) ===================== */
console.log('--- A auto-publish');
clearArticles();
PLAN = [{ result: ok(F.recapResearch()).result }, { result: ok(asReply(recA)).result }, { result: ok(asReply(recP)).result }];
reset(); tick(); const recId = job().id; tick(); reset(); S = tick();
check('A1 setup: research, writing, then the punch-up batch out (status writing); ?articles=1 shows it being written and is cached', S.stopped === 'submitted' && job().phase === 'punch' && col(row(recId), 'Status') === 'writing' &&
  get({ articles: '1' }).waiting[0].status === 'writing' && 'EMT_ART_LIST' in cache);
reset(); S = tick(); R = row(recId);
check('A1 the punch-up passes -> published at once: status live, the punched-up article as plain j: json, Approved = Written (now), S.stopped live, Log "Published automatically", no "Waiting for the commissioner"', S.stopped === 'live' && S.written === true &&
  col(R, 'Status') === 'live' && String(col(R, 'Article')).startsWith('j:') && liveJ(recId).title === recA.title && liveJ(recId).matchups[3].story === recP.matchups[3].story && /^'\d{4}-/.test(col(R, 'Approved (UTC)')) &&
  unq(col(R, 'Approved (UTC)')) === unq(col(R, 'Written (UTC)')) && col(R, 'Model') === 'claude-sonnet-5-5 + claude-haiku-5-5' &&
  /written by claude-sonnet-5-5, punched up by claude-haiku-5-5, \d+ words\. Published automatically; every manager can read it now\.$/.test(lastLog(recId)) && !/Waiting for the commissioner/.test(col(R, 'Log')), lastLog(recId));
const LA = get({ articles: '1' });
check('A2 the publish cleared the list cache, so ?articles=1 lists it at once: live (title, sub, approved, written), nothing waiting, review false', !LA.waiting.length && LA.live.length === 1 && LA.live[0].id === recId && LA.live[0].title === recA.title &&
  LA.live[0].sub === recA.sub && LA.live[0].approved === unq(col(R, 'Approved (UTC)')) && LA.live[0].written === unq(col(R, 'Written (UTC)')) && LA.review === false, JSON.stringify(LA).slice(0, 300));
const kA = props.EMT_ART_SEAL; delete props.EMT_ART_SEAL; const GA = get({ article: recId }); props.EMT_ART_SEAL = kA;
check('A3 ?article=<id> serves it to anyone (no sealing key needed), with auto true', GA.ok && GA.auto === true && GA.a.title === recA.title && GA.a.matchups[3].story === recP.matchups[3].story);
check('A4 the job is over (no job, no working files); the execution log and the summary say published automatically', !props.EMT_ART_JOB && workRows() === 0 && logs.some(l => /published automatically, written by claude-sonnet-5-5, punched up by claude-haiku-5-5 \(\d+ words\)\. Every manager can read it now\./.test(l)) &&
  /published automatically \(\d+ words, claude-sonnet-5-5 \+ claude-haiku-5-5\): every manager can read it in the app now\./.test(ctx.emtArtSummary(S)) && JSON.parse(props.EMT_PUNCH_LAST).article.used === true);
const cA = commish();
check('A5 POST articles, the commissioner: no drafts; live lists it (rewrite "", redos 0, no note); review false. Another manager: unchanged', cA.ok && cA.commish === true && cA.review === false && cA.drafts.length === 0 && cA.live.length === 1 &&
  cA.live[0].id === recId && cA.live[0].rewrite === '' && cA.live[0].redos === 0 && cA.live[0].note === '' && notCommish() === '{"ok":true,"commish":false,"drafts":[]}', JSON.stringify(cA));
check('A6 approve on an auto-published article -> live (nothing to approve); nothing changes', mod('Cold Palmers', tokCP, recId, 'approve').error === 'live' && col(row(recId), 'Status') === 'live');
reset(); S = tick();
check('A7 the next run starts nothing new for GW5 (the live recap counts)', S.stopped === 'idle' && S.why.some(w => /recap of GW5 is already/.test(w)) && creates.length === 0);
const stA = ctx.articlesStatus();
check('A8 articlesStatus says Mode: auto', /^Mode: auto: an article is published as soon as it passes the checks \(EMT_ART_REVIEW = yes makes the commissioner approve each one first\)\.$/m.test(stA), stA.split('\n')[1]);
// a preview, with the punch-up off: published straight from the checked article
props.EMT_PUNCH_OFF = 'yes';
setDeadline(40);
check('A9 setup: preview facts in', sp('Devils U21s', tokDU, PREV).ok === true);
PLAN = [{ result: ok(F.previewResearch()).result }, { result: ok(asReply(F.previewArticle())).result }];
reset(); tick(); const prvId = job().id; tick(); reset(); S = tick();
check('A9 a preview with the punch-up off is published straight from the checked article (Log "punch-up off ... Published automatically"); two live articles', S.stopped === 'live' && /^preview-gw6-/.test(prvId) && col(row(prvId), 'Status') === 'live' &&
  /punch-up off \(EMT_PUNCH_OFF = yes\)\. Published automatically; every manager can read it now\.$/.test(lastLog(prvId)) && get({ articles: '1' }).live.length === 2 && get({ article: prvId }).a.kind === 'preview', lastLog(prvId));
delete props.EMT_PUNCH_OFF;

/* ===================== C · a rewrite of a live article ===================== */
console.log('--- C rewrite of a live article');
const earlier = "'" + iso(Date.now() - 2 * H);                        // as if published two hours ago
R = row(recId); R[ctx.EMT_ART_HEAD.indexOf('Approved (UTC)')] = earlier; R[ctx.EMT_ART_HEAD.indexOf('Written (UTC)')] = earlier; delete cache.EMT_ART_LIST;
const liveCell0 = col(row(recId), 'Article');
check('C1 a manager who is not the commissioner -> commish (redo and drop); without a token -> auth; nothing changes', mod('Devils U21s', tokDU, recId, 'redo', 'x').error === 'commish' && mod('Devils U21s', tokDU, recId, 'drop').error === 'commish' &&
  Hd({ action: 'articlemod', team: 'Cold Palmers', id: recId, op: 'redo' }).error === 'auth' && col(row(recId), 'Status') === 'live' && pend(recId) === '' && !props.EMT_ART_JOB && col(row(recId), 'Article') === liveCell0);
const note1 = 'Lead with the Brobbey hat-trick and keep the Kostoulas bench line';
get({ articles: '1' });
const rd1 = mod('Cold Palmers', tokCP, recId, 'redo', note1); R = row(recId);
check('C2 the commissioner asks for a rewrite of the live recap -> ok (status live, rewrite writing); the Article cell untouched; Note pend writing, redos 1, the note sealed; a write-phase job marked live', rd1.ok && rd1.status === 'live' && rd1.rewrite === 'writing' &&
  col(R, 'Status') === 'live' && col(R, 'Article') === liveCell0 && pend(recId) === 'writing' && noteOf(R).redos === 1 && noteOf(R).text === note1 && !sheetText().includes('Kostoulas bench line') && job().id === recId && job().phase === 'write' &&
  job().live === true && job().redos === 1 && job().note === note1 && /rewrite 1 of 3 asked by Cold Palmers, with a note; the live version stays up until the new one passes the checks\.$/.test(lastLog(recId)), JSON.stringify(rd1));
const L3 = get({ articles: '1' }), l3 = L3.live.find(l => l.id === recId);
check('C3 while it is rewritten the league sees nothing change: ?articles=1 lists the same article (title, written), nothing waiting; ?article serves the live version', l3 && l3.title === recA.title && l3.written === unq(earlier) && L3.waiting.length === 0 &&
  get({ article: recId }).a.matchups[3].story === recP.matchups[3].story && !/rewrit|pend/i.test(JSON.stringify(L3)));
const cC = commish(), cc = cC.live.find(x => x.id === recId);
check('C3 ... only the commissioner sees the rewrite under way (POST articles: live rewrite writing, his note, redos 1; still no drafts); another manager gets nothing', cC.drafts.length === 0 && cc && cc.rewrite === 'writing' && cc.note === note1 && cc.redos === 1 &&
  notCommish() === '{"ok":true,"commish":false,"drafts":[]}');
const hzC = get({ health: '1' }), stC = ctx.articlesStatus();
check('C3 ?health=1: the job is a live rewrite (live true, phase write), last shows rewrite writing, no note text; articlesStatus says so', hzC.articles.job.live === true && hzC.articles.job.phase === 'write' && hzC.articles.last.find(x => x.id === recId).rewrite === 'writing' &&
  !JSON.stringify(hzC).includes('Kostoulas') && /a new version of the live article \(the live one stays up\), writing/.test(stC) && /, 1 rewrite, a rewrite under way \(the live version stays up\)\./.test(stC), stC.split('\n').filter(l => /rewrite/.test(l)).join(' | '));
check('C4 a second rewrite while this one runs -> busy; redos stays 1', mod('Cold Palmers', tokCP, recId, 'redo', 'again').error === 'busy' && noteOf(row(recId)).redos === 1);
const rec2 = F.recapArticle(); rec2.title = 'Brobbey runs riot at the Etihad and Team Jacob lose by a single point';
const rec2P = F.recapPunched(JSON.parse(JSON.stringify(rec2)));
PLAN = [{ result: ok(asReply(rec2)).result }, { result: ok(asReply(rec2P)).result }];
reset(); S = tick();
const w1 = creates[0] && creates[0].req.params.messages[0].content;
check('C5 the rewrite skips the research: one writing batch (<id>-w) with the published version and the note; the article stays live', S.stopped === 'submitted' && creates.length === 1 && creates[0].req.custom_id === recId + '-w' && !creates[0].req.params.tools &&
  w1.includes('A REWRITE. The commissioner read the published article and asks for a rewrite. His note: "' + note1 + '"') && w1.includes('THE PUBLISHED VERSION:\n' + JSON.stringify(liveJ(recId))) && !w1.includes('THE LAST DRAFT') &&
  col(row(recId), 'Status') === 'live' && get({ article: recId }).a.title === recA.title, S.stopped);
reset(); S = tick();
check('C6 it passes the checks -> the punch-up batch (with his note); still live, the old version served, the new title nowhere readable in the sheet (the base is sealed)', S.stopped === 'submitted' && job().phase === 'punch' && creates[0].req.custom_id === recId + '-p' &&
  creates[0].req.params.messages[0].content.includes('THE COMMISSIONER\'S NOTE') && col(row(recId), 'Status') === 'live' && get({ article: recId }).a.title === recA.title && !sheetText().includes(rec2.title) &&
  sheets.ArticleWork.rows.slice(1).some(r => r[1] === 'base' && String(r[4]).startsWith('j:s:')));
get({ articles: '1' });                                               // cached with the old title
reset(); S = tick(); R = row(recId);
check('C7 the punch-up passes -> the new version replaces the live one: S rewritten; Article j: the new text; Written now, Approved kept (the first publish); pend cleared, redos kept; Model writer + punch; Log "replaced the live one"', S.stopped === 'rewritten' &&
  col(R, 'Status') === 'live' && liveJ(recId).title === rec2.title && liveJ(recId).matchups[3].story === rec2P.matchups[3].story && col(R, 'Approved (UTC)') === earlier && col(R, 'Written (UTC)') !== earlier &&
  Date.parse(unq(col(R, 'Written (UTC)'))) > Date.now() - 60e3 && pend(recId) === '' && noteOf(R).redos === 1 && noteOf(R).text === note1 && col(R, 'Model') === 'claude-sonnet-5-5 + claude-haiku-5-5' &&
  /punched up by claude-haiku-5-5, \d+ words, rewrite 1 of 3\. The new version replaced the live one; every manager reads it now\.$/.test(lastLog(recId)) && /the rewrite is done \(\d+ words, .*\) and replaced the live version\./.test(ctx.emtArtSummary(S)), lastLog(recId));
const L4 = get({ articles: '1' }), l4 = L4.live.find(l => l.id === recId), G4 = get({ article: recId });
check('C8 ... served at once (the cache was cleared): ?articles=1 has the new title and a new written time (phones refetch), approved unchanged; ?article the new text (auto true); job and files gone; rewrite "" for the commissioner', l4.title === rec2.title &&
  l4.written === unq(col(R, 'Written (UTC)')) && l4.written !== unq(earlier) && l4.approved === unq(earlier) && G4.a.title === rec2.title && G4.auto === true && !props.EMT_ART_JOB && workRows() === 0 &&
  commish().live.find(x => x.id === recId).rewrite === '' && L4.live.length === 2);

/* ===================== Q · a rewrite that waits its turn ===================== */
console.log('--- Q queued behind another job');
props.EMT_PUNCH_OFF = 'yes';
const rdP = mod('Cold Palmers', tokCP, prvId, 'redo', 'Shorter on the slate');
check('Q1 setup: a rewrite of the live preview runs (job live)', rdP.ok && rdP.rewrite === 'writing' && job().id === prvId && job().live === true);
const rd2 = mod('Cold Palmers', tokCP, recId, 'redo', 'Now say more about Hall');
check('Q1 a rewrite of the live recap while that runs -> queued (EMT_ART_QUEUE); the recap stays live and served, pend writing; the running job untouched', rd2.ok && rd2.rewrite === 'writing' && JSON.parse(props.EMT_ART_QUEUE).join() === recId &&
  job().id === prvId && pend(recId) === 'writing' && col(row(recId), 'Status') === 'live' && get({ article: recId }).a.title === rec2.title && noteOf(row(recId)).redos === 2);
const prv2 = F.previewArticle(); prv2.title = 'Two derbies and a crossroads at Anfield, told shorter';
PLAN = [{ result: ok(asReply(prv2)).result }];
reset(); tick(); reset(); S = tick();
check('Q2 the preview rewrite lands (punch-up off) and replaces its live version', S.stopped === 'rewritten' && get({ article: prvId }).a.title === prv2.title && pend(prvId) === '' &&
  /punch-up off \(EMT_PUNCH_OFF = yes\)\. The new version replaced the live one; every manager reads it now\.$/.test(lastLog(prvId)), lastLog(prvId));

/* ===================== F · a rewrite that fails: the live version stays ===================== */
console.log('--- F a failed rewrite');
const badR = F.recapArticle(); badR.matchups[1].star.code = '17761x';      // a star not in the XI: fails the check every time
PLAN = Array.from({ length: 6 }, () => ({ result: ok(asReply(badR)).result }));
reset(); S = tick();
check('F1 the next run starts the queued rewrite of the live recap (phase write, live, redos 2, its note), logged', S.stopped === 'submitted' && job().id === recId && job().live === true && job().redos === 2 && job().note === 'Now say more about Hall' &&
  !props.EMT_ART_QUEUE && creates[0].req.custom_id === recId + '-w' && logs.some(l => /rewrite 2 of 3 starts, with the note "Now say more about Hall" \(the live version stays up meanwhile\)\./.test(l)));
const cellF = col(row(recId), 'Article');
let served = true, ticks = 0;
while (job() && ticks < 8) { reset(); S = tick(); ticks++; const g = get({ article: recId }); if (!g.ok || g.a.title !== rec2.title) served = false; }
R = row(recId);
check('F2 it fails the checks 3 times -> kept: the live version stays exactly as it was (status live, the same Article cell), pend failed, the Log says so; served on every run meanwhile', S.stopped === 'kept' && S.ok === false && served && ticks === 6 &&
  col(R, 'Status') === 'live' && col(R, 'Article') === cellF && pend(recId) === 'failed' && /live: the rewrite failed, so the live version stays up as it was: try 3 of 3 failed, no more: the article failed the checks twice/.test(lastLog(recId)) &&
  !props.EMT_ART_JOB && workRows() === 0 && PLAN.length === 0 && /^Articles \(recap GW5, recap-gw5-[0-9a-f]{6}\): the rewrite failed: .*\. The live version stays up as it was\.$/.test(ctx.emtArtSummary(S)) &&
  logs.some(l => /the rewrite failed\. .* The live version stays up as it was; the commissioner can ask again or take it down\./.test(l)), lastLog(recId));
const fx = commish().live.find(x => x.id === recId);
check('F3 the league still sees it unchanged; only the commissioner sees the failed rewrite (rewrite failed, the reason, redos 2); ?health and articlesStatus show it', get({ articles: '1' }).live.find(l => l.id === recId).title === rec2.title &&
  get({ articles: '1' }).waiting.length === 0 && fx.rewrite === 'failed' && /the rewrite failed, so the live version stays up/.test(fx.error) && fx.redos === 2 && get({ health: '1' }).articles.last.find(x => x.id === recId).rewrite === 'failed' &&
  /its last rewrite failed \(the live version stayed\)/.test(ctx.articlesStatus()), JSON.stringify(fx));
reset(); S = tick();
check('F4 a failed rewrite is not picked up again (pend failed is no job), and nothing new starts', S.stopped === 'idle' && creates.length === 0 && !props.EMT_ART_JOB && col(row(recId), 'Status') === 'live');
const rd3 = mod('Cold Palmers', tokCP, recId, 'redo', 'One last go');
check('F5 he can ask again after a failed rewrite (pend writing again, redos 3)', rd3.ok && pend(recId) === 'writing' && noteOf(row(recId)).redos === 3 && job().id === recId);
PLAN = [{ result: ok(asReply(rec2)).result, after: 99 }];
reset(); tick();
const j36 = job(); j36.startedAt = Date.now() - 37 * H; props.EMT_ART_JOB = JSON.stringify(j36);
reset(); S = tick();
check('F5 a live rewrite still open 36 hours after it started -> given up, the live version stays (kept, pend failed, Log)', S.stopped === 'kept' && col(row(recId), 'Status') === 'live' && get({ article: recId }).a.title === rec2.title && pend(recId) === 'failed' &&
  /the rewrite failed, so the live version stays up as it was: given up: still unfinished 36 hours after it started\./.test(lastLog(recId)) && !props.EMT_ART_JOB, lastLog(recId));
check('F6 the cap: a 4th rewrite -> redos (refused); nothing changes', mod('Cold Palmers', tokCP, recId, 'redo', 'more').error === 'redos' && pend(recId) === 'failed' && !props.EMT_ART_JOB && noteOf(row(recId)).redos === 3);

/* ===================== L · a lost job; review mode turned on midway ===================== */
console.log('--- L lost job, mode switched midway');
mod('Cold Palmers', tokCP, prvId, 'redo', 'Lead with Haaland');
delete props.EMT_ART_JOB;                                             // the job state is lost (a property deleted by hand)
const prv3 = F.previewArticle(); prv3.title = 'Haaland goes to Anfield and two derbies follow him';
PLAN = [{ result: ok(asReply(prv3)).result }];
reset(); S = tick();
check('L1 a live article with a rewrite under way and no job behind it -> resumed at the next run as a live rewrite (phase write), logged; the live version still served', S.stopped === 'submitted' && job().id === prvId && job().live === true &&
  job().phase === 'write' && job().note === 'Lead with Haaland' && creates[0].req.custom_id === prvId + '-w' && logs.some(l => /resumed: a rewrite of its live version was still under way with no job behind it\./.test(l)) && get({ article: prvId }).a.title === prv2.title);
props.EMT_ART_REVIEW = 'yes';
reset(); S = tick();
check('L2 review mode switched on during a rewrite asked for in auto mode: the rewrite still replaces the live version when it passes (never left half done)', S.stopped === 'rewritten' && get({ article: prvId }).a.title === prv3.title && col(row(prvId), 'Status') === 'live' && pend(prvId) === '');
delete props.EMT_ART_REVIEW;

/* ===================== D · take down ===================== */
console.log('--- D take down');
mod('Cold Palmers', tokCP, prvId, 'redo', 'Make it funnier');
PLAN = [{ result: ok(asReply(prv3)).result, after: 99 }];
reset(); tick();
const bD = job().batch;
reset(); const dD = mod('Cold Palmers', tokCP, prvId, 'drop'); R = row(prvId);
check('D1 take down a live article during its rewrite -> dropped: sealed again (its text nowhere in the sheet), pend cleared, the rewrite\'s batch cancelled, the job cleared; gone from ?articles=1 and ?article; logged', dD.ok && dD.status === 'dropped' &&
  col(R, 'Status') === 'dropped' && String(col(R, 'Article')).startsWith('s:') && !sheetText().includes(prv3.title) && pend(prvId) === '' && cancels.includes(bD) && !props.EMT_ART_JOB &&
  !get({ articles: '1' }).live.some(l => l.id === prvId) && get({ article: prvId }).error === 'notfound' && /dropped by Cold Palmers \(was live, with a rewrite under way, now stopped\); it is not rewritten automatically\.$/.test(lastLog(prvId)), lastLog(prvId));
reset(); S = tick();
check('D2 the next run starts nothing and never puts it back', S.stopped === 'idle' && creates.length === 0 && col(row(prvId), 'Status') === 'dropped');
const dR = mod('Cold Palmers', tokCP, recId, 'drop'); R = row(recId);
check('D3 take down an auto-published article -> dropped, sealed again (not readable in the sheet), gone from ?articles=1 and ?article, logged; no longer in the commissioner\'s live list', dR.ok && col(R, 'Status') === 'dropped' &&
  String(col(R, 'Article')).startsWith('s:') && !sheetText().includes(rec2.title) && get({ article: recId }).error === 'notfound' && get({ articles: '1' }).live.length === 0 &&
  /dropped by Cold Palmers \(was live\); it is not rewritten automatically\.$/.test(lastLog(recId)) && commish().live.length === 0 && pend(recId) === '', lastLog(recId));
check('D4 the taken-down text is still there for the commissioner\'s records (sealed, readable with the key)', ctx.emtArtArticle(col(row(recId), 'Article')).title === rec2.title);
delete props.EMT_PUNCH_OFF;

/* ===================== W · a draft left waiting when approvals are switched off ===================== */
console.log('--- W waiting drafts');
props.EMT_ART_REVIEW = 'yes'; delete props.EMT_PUNCH_OFF;
check('W0 recap facts in', rpost('Cold Palmers', tokCP).ok === true);
const recW = F.recapArticle(); recW.title = 'A recap written while approvals were still on';
PLAN = [{ result: ok(F.recapResearch()).result }, { result: ok(asReply(recW)).result }, { result: ok(asReply(recW)).result }];
reset(); ctx.articlesWriteNow(); const wId = job() ? job().id : ''; tick(true); tick(true); reset(); S = tick(true);
check('W1 review mode: it waits as a sealed draft', wId && col(row(wId), 'Status') === 'draft' && String(col(row(wId), 'Article')).startsWith('s:'), col(row(wId), 'Status') + ' ' + lastLog(wId));
check('W2 still review mode: the next run leaves the draft alone', (reset(), tick(), col(row(wId), 'Status') === 'draft'));
delete props.EMT_ART_REVIEW;
reset(); S = tick(); R = row(wId);
check('W3 approvals switched off: the next run publishes the waiting draft (live, plain j: json, Approved set, Log "Published automatically", served at once, ?article auto true)',
  col(R, 'Status') === 'live' && String(col(R, 'Article')).startsWith('j:') && liveJ(wId).title === recW.title && /^'\d{4}-/.test(col(R, 'Approved (UTC)')) &&
  /Published automatically: it was waiting as a draft when approvals were switched off/.test(lastLog(wId)) && get({ articles: '1' }).live.some(l => l.id === wId) && get({ article: wId }).auto === true &&
  S.did.some(d => d === 'published the waiting draft ' + wId), lastLog(wId));
reset(); S = tick();
check('W4 the run after publishes nothing again', !S.did.some(d => /waiting draft/.test(d)) && col(row(wId), 'Status') === 'live');

/* ===================== U · the helpers ===================== */
console.log('--- U helpers');
check('U1 emtArtAuto: the newest publish line decides', ctx.emtArtAuto('t live: approved by Cold Palmers; every manager can read it now.') === false &&
  ctx.emtArtAuto('t live: approved by Cold Palmers; every manager can read it now.\nt live: written by x, 700 words, rewrite 1 of 3. The new version replaced the live one; every manager reads it now.') === true &&
  ctx.emtArtAuto('t live: written by x, 700 words. Published automatically; every manager can read it now.') === true && ctx.emtArtAuto('') === false && ctx.emtArtAuto('t research: started') === false);
const nS = 'j:' + JSON.stringify({ s: 's:abcd:xyz', redos: 2, at: 'T', pend: 'writing' });
check('U2 emtArtNoteSet keeps the sealed note, redos and at, and drops a key set to ""; a hand-written note becomes { text }', JSON.parse(ctx.emtArtNoteSet(nS, { pend: '' }).slice(2)).s === 's:abcd:xyz' && !('pend' in JSON.parse(ctx.emtArtNoteSet(nS, { pend: '' }).slice(2))) &&
  JSON.parse(ctx.emtArtNoteSet(nS, { pend: 'failed' }).slice(2)).redos === 2 && ctx.emtArtNote(ctx.emtArtNoteSet('Shorter', { pend: 'writing' })).text === 'Shorter' && ctx.emtArtNote(ctx.emtArtNoteSet('Shorter', { pend: 'writing' })).pend === 'writing' &&
  ctx.emtArtNote(ctx.emtArtNoteSet('', {})).text === '');
const lf = ctx.emtArtLiveFields({ title: 'x' }, '2026-10-08T00:00:00.000Z'), lf2 = ctx.emtArtLiveFields({ title: 'y' }, '', { written: 'w' });
check('U3 emtArtLiveFields: status live, j: json, Approved only when given (the swap keeps the first publish), other cells passed through', lf.status === 'live' && lf.article === 'j:{"title":"x"}' && lf.approved === "'2026-10-08T00:00:00.000Z" &&
  !('approved' in lf2) && lf2.written === 'w' && lf2.article === 'j:{"title":"y"}');
check('U4 emtArtActive / emtArtLiveRw: research and writing, or live with pend writing; not live with pend failed, draft, dropped', ctx.emtArtActive({ status: 'research' }) && ctx.emtArtActive({ status: 'writing' }) && ctx.emtArtActive({ status: 'live', pend: 'writing' }) &&
  !ctx.emtArtActive({ status: 'live', pend: 'failed' }) && !ctx.emtArtActive({ status: 'live', pend: '' }) && !ctx.emtArtActive({ status: 'draft' }) && !ctx.emtArtActive({ status: 'dropped', pend: 'writing' }) && !ctx.emtArtActive(null));

console.log(fails ? fails + ' FAILED' : 'ALL PASS');
