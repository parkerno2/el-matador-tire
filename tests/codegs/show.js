// v3.11 Gameweek Show tests: node scratchpad/gs/show.js   (mocks modelled on test.js / ai.js)
const fs = require('fs'), crypto = require('crypto'), vm = require('vm');
const src = fs.readFileSync(__dirname + '/../../Code.gs', 'utf8');

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
Sheet.prototype.deleteRow = function (r) { this.rows.splice(r - 1, 1); };
Sheet.prototype.deleteRows = function (r, n) {
  if (r < 2) throw new Error('deleteRows hit the header');
  if (n >= this.getMaxRows() - 1) throw new Error('Sorry, it is not possible to delete all non-frozen rows.');
  this.rows.splice(r - 1, n); };
Sheet.prototype.insertRowAfter = function () { this.inserted++; this.tight = false; };

let sheets;
function freshSheets() {
  sheets = {
    Standings: new Sheet('Standings', [['Team'], ['Cold Palmers'], ['Devils U21s']]),
    Matchweeks: new Sheet('Matchweeks', [['GW', 'Deadline (UTC)', 'Finished'], [5, "'2026-10-03T10:00:00Z", 'TRUE'], [6, "'2026-10-10T10:00:00Z", 'FALSE'], [7, "'2026-10-17T10:00:00Z", '']]),
  };
}
freshSheets();
let props = {};
const cache = {}, logs = [], calls = [], ghCalls = [];
let SHOW = {}, MODE = 'ok', GH_THROW = false, UI = null;

const unsigned = a => a.map(b => (b + 256) % 256);
function fakeBytes(text) { const n = text.length * 900; const seed = crypto.createHash('md5').update(text).digest(); return Array.from({ length: n }, (_, i) => ((seed[i % 16] + i) % 256) - 128); }
const b64of = text => Buffer.from(unsigned(fakeBytes(text))).toString('base64');

const ctx = {
  console, JSON, Date, Math, Number, String, Object, Array, isNaN, isFinite, parseInt, encodeURIComponent,
  SpreadsheetApp: { getActive: () => ({ getSheetByName: n => sheets[n] || null, insertSheet: n => (sheets[n] = new Sheet(n)) }),
    getUi: () => { if (!UI) throw new Error('Cannot call SpreadsheetApp.getUi() from this context.'); return UI; } },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); }, deleteProperty: k => { delete props[k]; }, getProperties: () => ({ ...props }) }) },
  CacheService: { getScriptCache: () => ({ get: k => cache[k] || null, put: (k, v) => { cache[k] = v; } }) },
  LockService: { getScriptLock: () => ({ waitLock() {}, tryLock() { return true; }, releaseLock() {} }) },
  Utilities: { DigestAlgorithm: { SHA_256: 1, MD5: 2 }, Charset: { UTF_8: 1 }, getUuid: () => crypto.randomUUID(),
    computeDigest: (a, s) => Array.from(crypto.createHash(a === 2 ? 'md5' : 'sha256').update(s, 'utf8').digest()).map(b => b > 127 ? b - 256 : b),
    base64Encode: bytes => Buffer.from(unsigned(Array.from(bytes))).toString('base64') },
  ContentService: { createTextOutput: t => ({ t, setMimeType() { return this; } }), MimeType: { JSON: 1 } },
  ScriptApp: { getProjectTriggers: () => [], newTrigger: () => ({ timeBased: () => ({ everyMinutes: () => ({ create() {} }), everyHours: () => ({ create() {} }) }) }) },
  Logger: { log: m => logs.push(String(m)) },
  UrlFetchApp: { fetch: (url, o) => {
    if (/github\.io/.test(url)) {
      ghCalls.push(url);
      if (GH_THROW) throw new Error('Address unavailable: ' + url);
      const gw = Number((url.match(/show\/gw(\d+)\.json/) || [])[1]);
      if (!SHOW[gw]) return { getResponseCode: () => 404, getContentText: () => '<h1>404</h1>' };
      return { getResponseCode: () => 200, getContentText: () => JSON.stringify(SHOW[gw]) };
    }
    if (/api\.elevenlabs\.io/.test(url)) {
      const body = JSON.parse(o.payload); calls.push({ url, o, body });
      const timed = /\/with-timestamps\?/.test(url);   // v3.23: the call goes to with-timestamps and is answered as JSON
      if (MODE === '401') return { getResponseCode: () => 401, getContentText: () => JSON.stringify({ detail: { status: 'invalid_api_key', message: 'Invalid API key' } }) + 'x'.repeat(500), getContent: () => [] };
      if (MODE === 'quota') return { getResponseCode: () => 401, getContentText: () => JSON.stringify({ detail: { status: 'quota_exceeded', message: 'This request exceeds your quota of 10000. You have 5 credits remaining.' } }), getContent: () => [] };
      const bytes = fakeBytes(body.text);
      if (timed) return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ audio_base64: b64of(body.text), alignment: null, normalized_alignment: null }), getContent: () => [] };
      return { getResponseCode: () => 200, getContent: () => bytes.slice(), getContentText: () => '' };
    }
    throw new Error('unexpected fetch ' + url);
  } },
};
vm.createContext(ctx); vm.runInContext(src, ctx);

const sample = () => ({ gw: 6, voice: 'Malcolm Tyre — El Matador Booth', model: 'eleven_multilingual_v2', speed: 1.1,
  open: 'Gameweek six. Two derbies, one grudge, and a manager who swore he was not ready.',
  chapters: [
    { home: 'Cold Palmers', away: 'Devils U21s', beats: ['The Nolan Derby.', 'Cold Palmers sit fourth on nine points, and they have not lost at home since the opening weekend.', 'Devils U21s arrive on a two game run.', 'PJ says Parker is not ready. Parker says nothing, which is louder.', 'The model gives the home side fifty eight percent.'] },
    { home: 'Kobbie Mainoo Fan', away: 'Team Jacob', beats: ['Top of the table.', 'Kobbie Mainoo Fan went top after gameweek five and the rumour mill has not stopped since.', 'Team Jacob need a result.', 'Word is the files are still open.', 'Short odds, long memories.'] },
  ],
  close: "That's the gameweek. Lineups lock at the deadline. Malcolm Tyre, El Matador booth." });
const playOrder = j => { const o = [['open', j.open]]; j.chapters.forEach((c, i) => c.beats.forEach((b, k) => o.push(['c' + (i + 1) + 'b' + k, b]))); o.push(['close', j.close]); return o; };
const rowsOf = (gw, key) => (sheets.ShowAudio ? sheets.ShowAudio.rows.slice(1) : []).filter(r => Number(r[0]) === gw && r[1] === key);
const strip = h => String(h).replace(/^'/, '');
const md5 = s => crypto.createHash('md5').update(s, 'utf8').digest('hex');
let fails = 0;
const check = (label, cond, info) => { if (!cond) fails++; console.log((cond ? 'PASS ' : 'FAIL ') + label + (info ? '  ' + info : '')); };
const reset = () => { calls.length = 0; ghCalls.length = 0; logs.length = 0; };

/* a) no key */
reset();
const ra = ctx.renderShow(6); ctx.showTick(); const rn = ctx.renderShowNow();
check('a) no key: no fetches, clear log', ghCalls.length === 0 && calls.length === 0 && ra.stopped === 'nokey' && rn.stopped === 'nokey' && logs.length >= 3 && logs.every(l => /ELEVENLABS_API_KEY/.test(l) && /Script Properties/.test(l)) && !sheets.ShowAudio,
  logs[0].slice(0, 120));

/* b) first render */
props.ELEVENLABS_API_KEY = 'el-test-key'; SHOW[6] = sample(); reset();
const rb = ctx.renderShow(6);
const sh = sheets.ShowAudio, order = playOrder(SHOW[6]);
let chunkOk = true, secsOk = true, multi = 0, info = [];
order.forEach(([k, t]) => {
  const rows = rowsOf(6, k), b64 = b64of(t), n = Math.ceil(b64.length / 45000), bytes = t.length * 900;
  if (n > 1) multi++;
  if (rows.length !== n) { chunkOk = false; info.push(k + ' rows ' + rows.length + '/' + n); }
  rows.forEach((r, i) => {
    if (r[3] !== i + 1 || r[4] !== n || !String(r[6]).startsWith('b64:') || String(r[6]).length > 45004 || strip(r[2]) !== md5(t + '|e2v8SRwGUU8TdMFPuDlV|eleven_multilingual_v2|1.1')) { chunkOk = false; info.push(k + ' part ' + i); }
    if (r[5] !== Math.round(bytes / 80) / 100) { secsOk = false; info.push(k + ' secs ' + r[5]); }
  });
});
check('b) first render: 12 clips, 12 calls', rb.rendered.length === 12 && calls.length === 12 && rb.ok && rb.left === 0, JSON.stringify({ rendered: rb.rendered.length, calls: calls.length }));
check('b) rows chunked (Part 1..Parts, <=45000 + b64:, hash = md5(text|voice|model|speed))', chunkOk && multi >= 3, multi + ' clips span several chunks, ' + (sh.rows.length - 1) + ' rows ' + info.join(' '));
check('b) secs = bytes/8000, 2 dp', secsOk, 'open ' + rowsOf(6, 'open')[0][5] + ' s');
check('b) tab hidden, header frozen, header row (v3.23: + Words)', sh.hidden && sh.frozen === 1 && sh.rows[0].join('|') === 'GW|Clip|Hash|Part|Parts|Secs|Data|Rendered (UTC)|Words');
check('b) keys stored in EMT_SHOW_KEYS_6', props.EMT_SHOW_KEYS_6 === JSON.stringify(order.map(o => o[0])));
check('b) json fetched with cache buster', /show\/gw6\.json\?cb=\d+$/.test(ghCalls[0]), ghCalls[0]);

/* i) previous_text / next_text, headers, url */
const byText = t => calls.find(c => c.body.text === t);
const mid = byText(SHOW[6].chapters[0].beats[2]), first = byText(SHOW[6].open), last = byText(SHOW[6].close);
check('i) middle clip c1b2 gets previous_text c1b1 and next_text c1b3', mid.body.previous_text === SHOW[6].chapters[0].beats[1] && mid.body.next_text === SHOW[6].chapters[0].beats[3]);
check('i) open has no previous_text, close has no next_text, chapter seam joins', !('previous_text' in first.body) && first.body.next_text === SHOW[6].chapters[0].beats[0] && !('next_text' in last.body) && last.body.previous_text === SHOW[6].chapters[1].beats[4]
  && byText(SHOW[6].chapters[1].beats[0]).body.previous_text === SHOW[6].chapters[0].beats[4]);
check('i) request shape (url: with-timestamps since v3.23, headers, model, voice_settings)', mid.url === 'https://api.elevenlabs.io/v1/text-to-speech/e2v8SRwGUU8TdMFPuDlV/with-timestamps?output_format=mp3_44100_64'
  && mid.o.method === 'post' && mid.o.contentType === 'application/json' && mid.o.muteHttpExceptions === true && mid.o.headers['xi-api-key'] === 'el-test-key' && mid.o.headers.Accept === 'application/json'
  && mid.body.model_id === 'eleven_multilingual_v2' && JSON.stringify(mid.body.voice_settings) === JSON.stringify({ stability: 0.5, similarity_boost: 0.75, style: 0, use_speaker_boost: true, speed: 1.1 }), JSON.stringify(mid.body.voice_settings));

/* c) second render */
reset(); const rowsBefore = JSON.stringify(sh.rows);
const rc = ctx.renderShow(6);
check('c) second render: 0 ElevenLabs calls, sheet untouched', calls.length === 0 && rc.kept === 12 && JSON.stringify(sh.rows) === rowsBefore, logs[logs.length - 1]);

/* d) edit one beat */
reset(); const oldOpenRow = JSON.stringify(rowsOf(6, 'open'));
const oldC2b3 = rowsOf(6, 'c2b3').length;
SHOW[6].chapters[1].beats[3] = 'Word is the files are still open, and now there are three of them, all marked urgent, all unread by anyone in charge.';
const rd = ctx.renderShow(6);
const newRows = rowsOf(6, 'c2b3'), wantN = Math.ceil(b64of(SHOW[6].chapters[1].beats[3]).length / 45000);
check('d) one edited beat: exactly 1 call', calls.length === 1 && calls[0].body.text === SHOW[6].chapters[1].beats[3] && rd.rendered.join() === 'c2b3' && rd.kept === 11);
check('d) old rows replaced (no leftovers, new hash, parts ' + oldC2b3 + ' -> ' + wantN + ')', newRows.length === wantN && newRows.every(r => strip(r[2]) === md5(SHOW[6].chapters[1].beats[3] + '|e2v8SRwGUU8TdMFPuDlV|eleven_multilingual_v2|1.1')) && JSON.stringify(rowsOf(6, 'open')) === oldOpenRow);

/* f) doGet show */
const g = JSON.parse(ctx.doGet({ parameter: { show: '6' } }).t);
const order2 = playOrder(SHOW[6]);
const allMatch = order2.every(([k, t]) => g.clips[k] && g.clips[k].b64 === b64of(t) && g.clips[k].secs === Math.round(t.length * 900 / 80) / 100 && g.clips[k].hash === md5(t + '|e2v8SRwGUU8TdMFPuDlV|eleven_multilingual_v2|1.1'));
check('f) doGet ?show=6: every clip, joined b64 == base64(fake bytes), complete', g.ok === true && g.gw === 6 && Object.keys(g.clips).length === 12 && allMatch && g.complete === true, 'keys ' + Object.keys(g.clips).join(','));
check('f) clips come back in play order', Object.keys(g.clips).join() === order2.map(o => o[0]).join());
const gBad = JSON.parse(ctx.doGet({ parameter: { show: 'abc' } }).t), g9 = JSON.parse(ctx.doGet({ parameter: { show: '9' } }).t);
check('f) bad gw -> error; unknown gw -> empty, not complete', gBad.ok === false && g9.ok === true && Object.keys(g9.clips).length === 0 && g9.complete === false);

/* g) doGet without show */
props.EMT_PIN_X = 'h';
const g0 = JSON.parse(ctx.doGet().t), g1 = JSON.parse(ctx.doGet({ parameter: {} }).t);
check('g) doGet() keeps the old shape', JSON.stringify(g0) === JSON.stringify({ ok: true, service: 'emt', claimed: ['X'] }) && JSON.stringify(g1) === JSON.stringify(g0), JSON.stringify(g0));
delete props.EMT_PIN_X;

/* e) remove a chapter */
reset(); SHOW[6].chapters.pop();
const re = ctx.renderShow(6);
const left = sh.rows.slice(1).map(r => r[1]);
check('e) chapter removed: its rows deleted, nothing re-rendered', calls.length === 0 && !left.some(k => /^c2/.test(k)) && re.removed.length === 5 && rowsOf(6, 'open').length > 0 && rowsOf(6, 'close').length > 0, 're.removed ' + re.removed.join(','));
const ge = JSON.parse(ctx.doGet({ parameter: { show: '6' } }).t);
check('e) keys list updated, doGet complete with 7 clips', JSON.parse(props.EMT_SHOW_KEYS_6).length === 7 && Object.keys(ge.clips).length === 7 && ge.complete === true);

/* h) 401 stops the run */
reset(); MODE = '401'; const rowsBefore401 = JSON.stringify(sh.rows);
SHOW[6].open = 'Gameweek six, take two.'; SHOW[6].close = 'That is the gameweek, take two.';
const rh = ctx.renderShow(6);
check('h) 401: stops after the first failure', calls.length === 1 && rh.ok === false && rh.stopped === 'http 401' && rh.rendered.length === 0, rh.error);
check('h) 401: log has status, key hint and first 300 chars of the body', logs.some(l => /HTTP 401/.test(l) && /wrong or lacks Text to Speech/.test(l) && /Body: \{"detail"/.test(l) && l.split('Body: ')[1].length === 300));
check('h) 401: old audio kept', JSON.stringify(sh.rows) === rowsBefore401);
check('h) busy flag released after the failure', !('EMT_SHOW_BUSY' in props));
const g401 = JSON.parse(ctx.doGet({ parameter: { show: '6' } }).t);
check('h) doGet (v3.23) serves the 5 current takes, lists the 2 old ones as stale, not complete', g401.complete === false && g401.stale.join() === 'open,close' && Object.keys(g401.clips).join() === 'c1b0,c1b1,c1b2,c1b3,c1b4' && g401.missing.length === 0, JSON.stringify({ stale: g401.stale, clips: Object.keys(g401.clips), missing: g401.missing }));
reset(); MODE = 'quota';
const rq = ctx.renderShow(6);
check('h) quota_exceeded -> out of credits', calls.length === 1 && /out of credits/.test(rq.error), rq.error);
MODE = 'ok';

/* l) time budget: a run that started 4.6 minutes ago starts no new clip */
reset();
const rl = ctx.renderShow(6, Date.now() - 276000);
check('l) time budget: no call after 4.5 min, left for the next run', calls.length === 0 && rl.stopped === 'time' && rl.left === 2, ctx.emtShowSummary(rl));

/* j) aiTick with the AI writer off still runs showTick; a showTick exception never escapes */
reset(); delete props.ANTHROPIC_API_KEY;
ctx.aiTick();
check('j) aiTick, AI off: showTick ran and rendered the 2 changed lines', ghCalls.length === 1 && calls.length === 2, logs.filter(l => /Gameweek Show/.test(l)).join(' / '));
reset(); GH_THROW = true; let threw = null;
try { ctx.aiTick(); } catch (e) { threw = e; }
check('j) exception inside showTick does not throw out of aiTick', threw === null && logs.some(l => /Gameweek Show/.test(l) && /Address unavailable/.test(l)) && !('EMT_SHOW_BUSY' in props), logs.join(' / ').slice(0, 160));
GH_THROW = false;
reset(); const realShowTick = ctx.showTick; ctx.showTick = () => { throw new Error('boom'); };
try { ctx.aiTick(); threw = null; } catch (e) { threw = e; }
ctx.showTick = realShowTick;
check('j) a thrown showTick is caught by aiTick', threw === null && logs.some(l => /Gameweek Show failed: boom/.test(l)));
reset(); props.EMT_SHOW_PAUSED = 'yes'; ctx.aiTick();
check('j) EMT_SHOW_PAUSED=yes: no fetch', ghCalls.length === 0 && calls.length === 0 && logs.some(l => /paused/.test(l)));
delete props.EMT_SHOW_PAUSED;
reset(); props.ANTHROPIC_API_KEY = 'x'; let wrote = 0; const realWriter = ctx.aiWriterTick; ctx.aiWriterTick = () => { wrote++; throw new Error('writer down'); };
try { ctx.aiTick(); threw = null; } catch (e) { threw = e; }
ctx.aiWriterTick = realWriter; delete props.ANTHROPIC_API_KEY;
check('j) writer error still surfaces, but only after the show had its turn', wrote === 1 && threw && /writer down/.test(threw.message) && ghCalls.length === 1);

/* next unfinished GW with no script (404) -> nothing */
reset(); sheets.Matchweeks.rows[2][2] = 'TRUE';   // GW6 finished, next is GW7, no json
const r7 = ctx.showTick();
check('404: next gameweek has no script -> nothing rendered', ghCalls.length === 1 && /gw7\.json/.test(ghCalls[0]) && calls.length === 0 && r7.stopped === 'noscript' && r7.ok === true, logs[logs.length - 1]);
sheets.Matchweeks.rows[2][2] = 'FALSE';

/* menu + status */
reset(); UI = { alerts: [], alert(m) { this.alerts.push(m); } }; SHOW[6].chapters[0].beats[0] = 'The Nolan Derby, again.';
const rm = ctx.renderShowNow();
check('menu renderShowNow: renders the next GW and alerts a summary', calls.length === 1 && UI.alerts.length === 1 && /GW6: 1 rendered \(c1b0\)/.test(UI.alerts[0]), UI.alerts[0]);
UI = null; reset(); const st = ctx.showStatus(6);
check('showStatus(6) logs what is rendered', st.rendered === 7 && st.expected === 7 && /7 of 7 clips rendered/.test(logs[0]), logs[0].split('\n')[0]);

/* k) Sheets refuses to delete every non-frozen row: guard adds a blank row first */
freshSheets(); props = { ELEVENLABS_API_KEY: 'el-test-key' }; SHOW = { 6: { gw: 6, speed: 1, open: 'Just the open.', chapters: [], close: '' } }; reset();
ctx.renderShow(6); sheets.ShowAudio.tight = true; SHOW[6].open = 'Just the open, edited.';
let kErr = null; try { ctx.renderShow(6); } catch (e) { kErr = e; }
const rk = rowsOf(6, 'open');
check('k) re-render when its rows are the only data rows (tight grid) works', !kErr && sheets.ShowAudio.inserted === 1 && rk.length === 1 && calls.length === 2 && JSON.parse(ctx.doGet({ parameter: { show: '6' } }).t).complete === true, 'speed 1 hash ' + strip(rk[0][2]).slice(0, 8));

console.log(fails ? fails + ' FAILED' : 'ALL PASS');
