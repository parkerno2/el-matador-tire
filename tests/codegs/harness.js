// The shared Code.gs test harness (v3.17 onwards): vm, a mock Sheet, PropertiesService, CacheService, LockService,
// Utilities, ContentService, ScriptApp, Logger and UrlFetchApp (the Anthropic Batches API queued forever, the Facts
// bot's files from REPO, github.io 404). Not a test file itself: the CI loop skips *harness* and *fixtures*.
//   const H = require('./harness.js'); const T = H.make();   // T.ctx, T.sheets, T.props, T.cache, T.logs, T.raw, T.REPO ...
const fs = require('fs'), crypto = require('crypto'), vm = require('vm');
const F = require(__dirname + '/v313-fixtures.js');

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
/* the standard sheets: GW5 final (real data), its last games 2 to 3 days ago, GW6's deadline 20 hours away, Meta GW6 */
function standardSheets() {
  const h2h = F.tab('H2H Fixtures'), cf = F.tab('Club Fixtures'), st = F.tab('Standings');
  const cfx = [cf[0]].concat(cf.slice(1).filter(r => Number(r[0]) <= 6).map(r => {
    const row = r.slice(); if (Number(row[0]) === 5) row[3] = iso(Date.now() - 3 * D + (Date.parse(r[3]) - Date.parse('2026-09-18T19:00:00Z')) / 4); return row; }));
  return {
    Standings: new Sheet('Standings', st.map(r => r.slice())),
    'H2H Fixtures': new Sheet('H2H Fixtures', h2h.map(r => r.slice()).map((r, i) => i ? [Number(r[0]), r[1], Number(r[2]), r[3], Number(r[4]), r[5] === 'TRUE' || r[5] === true] : r)),
    'Club Fixtures': new Sheet('Club Fixtures', cfx),
    Matchweeks: new Sheet('Matchweeks', [['GW', 'Deadline (UTC)', 'MOTM period', 'Finished', 'Notes'], [4, "'2026-09-11T17:30:00Z", 'Aug & Sep', 'TRUE', ''], [5, "'" + iso(Date.now() - 4 * D), 'Aug & Sep', 'TRUE', ''],
      [6, "'" + iso(Date.now() + 20 * H), 'October', 'FALSE', ''], [7, "'" + iso(Date.now() + 7 * D), 'October', 'FALSE', '']]),
    Meta: new Sheet('Meta', [['League Updated Pot', 'El Matador Tire ' + iso(Date.now()) + ' $1200'], ['Current GW', 6]]),
    Social: new Sheet('Social', [['When (UTC)', 'Team', 'Kind', 'Target', 'Value', 'Extra']]),
    Posts: new Sheet('Posts', [['When (UTC)', 'Id', 'Voice', 'Kind', 'Event', 'Teams', 'Players', 'Text', 'Facts', 'Media']]),
    Specials: new Sheet('Specials', [['Setting', 'Value']]),
  };
}

function make(opts) {
  opts = opts || {};
  const src = fs.readFileSync(__dirname + '/../../Code.gs', 'utf8');
  const T = { src, Sheet, F, H, D, iso, sheets: opts.sheets || standardSheets(), props: {}, cache: {}, logs: [], creates: [], raw: [], other: [], REPO: {}, RAW_THROW: false, BSEQ: 0 };
  const resp = (code, body) => ({ getResponseCode: () => code, getContentText: () => typeof body === 'string' ? body : JSON.stringify(body), getContent: () => [] });
  T.resp = resp;
  const BURL = 'https://api.anthropic.com/v1/messages/batches';
  function anthropic(url, o) {
    const method = String(o.method || 'get').toLowerCase();
    if (url === BURL && method === 'post') {
      const body = JSON.parse(o.payload), req = body.requests[0];
      T.creates.push({ req, o }); const id = 'msgbatch_' + String(++T.BSEQ).padStart(4, '0');
      return resp(200, { id, type: 'message_batch', processing_status: 'in_progress', results_url: null });
    }
    if (/^https:\/\/api\.anthropic\.com\/v1\/messages\/batches\/[^/]+$/.test(url)) return resp(200, { id: 'x', processing_status: 'in_progress', results_url: null });
    throw new Error('no Claude reply queued for ' + method + ' ' + url);
  }
  T.ctx = {
    console, JSON, Date, Math, Number, String, Object, Array, isNaN, isFinite, parseInt, encodeURIComponent, RegExp,
    SpreadsheetApp: { getActive: () => ({ getSheetByName: n => T.sheets[n] || null, insertSheet: n => (T.sheets[n] = new Sheet(n)) }), getUi: () => { throw new Error('no UI'); } },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in T.props ? T.props[k] : null), setProperty: (k, v) => { T.props[k] = String(v); }, deleteProperty: k => { delete T.props[k]; }, getProperties: () => ({ ...T.props }) }) },
    CacheService: { getScriptCache: () => ({ get: k => (k in T.cache ? T.cache[k] : null), put: (k, v) => { T.cache[k] = String(v); }, remove: k => { delete T.cache[k]; } }) },
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
    Logger: { log: m => T.logs.push(String(m)) },
    UrlFetchApp: { fetch: (url, o) => {
      o = o || {};
      if (/^https:\/\/api\.anthropic\.com\//.test(url)) return anthropic(url, o);
      if (/^https:\/\/raw\.githubusercontent\.com\/parkerno2\/el-matador-tire\/facts\/facts\//.test(url)) {
        T.raw.push(url);
        if (T.RAW_THROW) throw new Error('Address unavailable: raw.githubusercontent.com');
        const name = url.replace(/^.*\/facts\/facts\//, '').replace(/\?.*$/, ''), f = T.REPO[name];
        return f ? resp(f.code || 200, f.text) : resp(404, '404: Not Found');
      }
      T.other.push(url);
      if (/github\.io/.test(url)) return resp(404, '<h1>404</h1>');
      if (/raw\.githubusercontent\.com/.test(url)) return resp(404, '404: Not Found');
      throw new Error('unexpected fetch ' + url);
    } },
  };
  vm.createContext(T.ctx); vm.runInContext(src, T.ctx);
  let fails = 0;
  T.check = (label, cond, info) => { if (!cond) fails++; console.log((cond ? 'PASS ' : 'FAIL ') + label + (info ? '  ' + info : '')); };
  T.done = () => { console.log(fails ? fails + ' FAILED' : 'ALL PASS'); process.exit(fails ? 1 : 0); };
  T.reset = () => { [T.logs, T.creates, T.raw, T.other].forEach(a => { a.length = 0; }); };
  T.get = p => JSON.parse(T.ctx.doGet({ parameter: p }).t);
  T.Hd = r => T.ctx.emtHandle(r);
  return T;
}
module.exports = { make, Sheet, standardSheets, iso, H, D };
