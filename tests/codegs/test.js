const fs = require('fs'), crypto = require('crypto'), vm = require('vm');
const src = fs.readFileSync(__dirname + '/../../Code.gs', 'utf8');
function Sheet(name, rows) { this.name = name; this.rows = rows || []; }
Sheet.prototype.getLastRow = function () { return this.rows.length; };
Sheet.prototype.getLastColumn = function () { return Math.max(0, ...this.rows.map(r => r.length)); };
Sheet.prototype.getRange = function (r, c, nr, nc) { const sh = this; nr = nr || 1; nc = nc || 1; return {
  getValues() { const out = []; for (let i = 0; i < nr; i++) { const row = sh.rows[r - 1 + i] || []; out.push(Array.from({ length: nc }, (_, j) => row[c - 1 + j] === undefined ? '' : row[c - 1 + j])); } return out; },
  setValues(v) { v.forEach((row, i) => { const idx = r - 1 + i; while (sh.rows.length <= idx) sh.rows.push([]); row.forEach((x, j) => { sh.rows[idx][c - 1 + j] = x; }); }); } }; };
Sheet.prototype.appendRow = function (row) { this.rows.push(row.slice()); };
Sheet.prototype.setFrozenRows = function () {};
const sheets = { Standings: new Sheet('Standings', [['Team'], ['Cold Palmers'], ['Devils U21s']]),
  Matchweeks: new Sheet('Matchweeks', [['GW', 'Deadline (UTC)'], [5, "'2026-10-03T10:00:00Z"], [6, "'2030-10-10T10:00:00Z"]]) };
const props = {}, cache = {};
const ctx = {
  console, JSON, Date, Math, Number, String, Object, Array, isNaN, isFinite,
  SpreadsheetApp: { getActive: () => ({ getSheetByName: n => sheets[n] || null, insertSheet: n => (sheets[n] = new Sheet(n)) }) },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] || null, setProperty: (k, v) => { props[k] = v; }, deleteProperty: k => { delete props[k]; }, getProperties: () => ({ ...props }) }) },
  CacheService: { getScriptCache: () => ({ get: k => cache[k] || null, put: (k, v) => { cache[k] = v; } }) },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  Utilities: { DigestAlgorithm: { SHA_256: 1 }, Charset: { UTF_8: 1 }, getUuid: () => crypto.randomUUID(),
    computeDigest: (a, s) => Array.from(crypto.createHash('sha256').update(s).digest()).map(b => b > 127 ? b - 256 : b) },
  ContentService: { createTextOutput: t => ({ t, setMimeType() { return this; } }), MimeType: { JSON: 1 } },
  Logger: { log() {} },
};
vm.createContext(ctx); vm.runInContext(src, ctx);
const H = r => ctx.emtHandle(r);
const tok = H({ action: 'claim', team: 'Cold Palmers', pin: '1234' }).token;
const ok = (label, r, want) => console.log((JSON.stringify(r).includes(want) ? 'PASS ' : 'FAIL ') + label, JSON.stringify(r));
ok('no auth', H({ action: 'social', team: 'Cold Palmers', token: 'x', kind: 'react', target: 'ft:5:a|b', value: 'fire' }), 'auth');
ok('quote', H({ action: 'social', team: 'Cold Palmers', token: tok, kind: 'quote', target: 'q:6', extra: JSON.stringify({ line: '  We <b>win</b> this one.  ', claim: { type: 'win', gw: 6, opp: 'Devils U21s' }, p: 0.5621, src: 'own' }) }), '"ok":true');
ok('dup quote', H({ action: 'social', team: 'Cold Palmers', token: tok, kind: 'quote', target: 'q:6', extra: JSON.stringify({ line: 'again' }) }), 'already');
ok('closed quote', H({ action: 'social', team: 'Cold Palmers', token: tok, kind: 'quote', target: 'q:5', extra: JSON.stringify({ line: 'late' }) }), 'closed');
ok('empty quote', H({ action: 'social', team: 'Cold Palmers', token: tok, kind: 'quote', target: 'qr:6:Devils U21s', extra: JSON.stringify({ line: '   ' }) }), 'empty');
ok('react', H({ action: 'social', team: 'Cold Palmers', token: tok, kind: 'react', target: '=HYPERLINK("x")', value: 'clown' }), '"ok":true');
ok('bad react', H({ action: 'social', team: 'Cold Palmers', token: tok, kind: 'react', target: 'p1', value: 'heart' }), 'badvalue');
ok('vote', H({ action: 'social', team: 'Cold Palmers', token: tok, kind: 'vote', target: 'poll:6:Cold Palmers|Devils U21s', value: 'h' }), '"ok":true');
ok('late vote', H({ action: 'social', team: 'Cold Palmers', token: tok, kind: 'vote', target: 'poll:5:a|b', value: 'h' }), 'closed');
ok('bad kind', H({ action: 'social', team: 'Cold Palmers', token: tok, kind: 'delete', target: 'x' }), 'badkind');
console.log(JSON.stringify(sheets.Social.rows, null, 0));
let last; for (let i = 0; i < 45; i++) last = H({ action: 'social', team: 'Cold Palmers', token: tok, kind: 'react', target: 'p' + i, value: 'fire' });
ok('rate limit', last, 'slow');

console.log('--- v3.10 rumour + pass'); Object.keys(cache).forEach(k => delete cache[k]);
ok('rumour', H({ action: 'social', team: 'Cold Palmers', token: tok, kind: 'rumour', target: 'r:abc123', extra: JSON.stringify({ text: 'Baha is cheating and FPL should investigate', about: 'Devils U21s', anon: true }) }), '"ok":true');
ok('own pass refused', (cache['EMT_RL_Cold Palmers'] = '0', H({ action: 'social', team: 'Cold Palmers', token: tok, kind: 'pass', target: 'r:abc123', value: 'confirm' })), 'yours');
const tok2 = H({ action: 'claim', team: 'Devils U21s', pin: '4321' }).token;
ok('pass twist', H({ action: 'social', team: 'Devils U21s', token: tok2, kind: 'pass', target: 'r:abc123', value: 'twist', extra: JSON.stringify({ text: 'FPL took points off him' }) }), '"ok":true');
ok('second pass refused', H({ action: 'social', team: 'Devils U21s', token: tok2, kind: 'pass', target: 'r:abc123', value: 'deny' }), 'already');
ok('pass on nothing', H({ action: 'social', team: 'Devils U21s', token: tok2, kind: 'pass', target: 'r:zzz999', value: 'deny' }), 'norumour');
ok('future kind stored', H({ action: 'social', team: 'Devils U21s', token: tok2, kind: 'cheer', target: 'x:1', value: 'y', extra: '<b>hi</b>' }), '"ok":true');
console.log(JSON.stringify(sheets.Social.rows.slice(-3)));
