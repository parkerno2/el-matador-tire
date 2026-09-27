/* Headless unit tests for Code.gs v3.6 (liveTick window + shared refresh gate, Transactions result labels,
   Clubs strength columns). Loads the real Code.gs into a vm context with Apps Script services stubbed.
   Run: node fplgg/tools/v12/test-code-gs.js   (from /home/claude/work) */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '../../..');
const SRC = fs.readFileSync(path.join(ROOT, 'Code.gs'), 'utf8');
const MOCK = JSON.parse(fs.readFileSync(path.join(ROOT, 'fplgg/tools/mock/sheet-2026-09-27.json'), 'utf8'));

/* ---------- fake clock ---------- */
let NOW = Date.parse('2026-09-19T12:00:00Z');
const RealDate = Date;
class FakeDate extends RealDate {
  constructor(...a) { if (a.length === 0) super(NOW); else super(...a); }
  static now() { return NOW; }
}

/* ---------- fake spreadsheet ---------- */
class Sheet {
  constructor(name, rows) { this.name = name; this.d = rows ? rows.map(r => r.slice()) : []; this.hidden = false; }
  getLastRow() { for (let i = this.d.length - 1; i >= 0; i--) if ((this.d[i] || []).some(v => v !== '' && v != null)) return i + 1; return 0; }
  getLastColumn() { let m = 0; this.d.forEach(r => { for (let j = (r || []).length - 1; j >= 0; j--) if (r[j] !== '' && r[j] != null) { m = Math.max(m, j + 1); break; } }); return m; }
  getRange(r, c, nr, nc) {
    if (typeof r === 'string') { const m = /^([A-Z])(\d+)$/.exec(r); c = m[1].charCodeAt(0) - 64; r = +m[2]; }
    nr = nr || 1; nc = nc || 1; const sh = this;
    return {
      getValues() { const out = []; for (let i = 0; i < nr; i++) { const row = []; for (let j = 0; j < nc; j++) { const v = (sh.d[r - 1 + i] || [])[c - 1 + j]; row.push(v == null ? '' : v); } out.push(row); } return out; },
      getValue() { return this.getValues()[0][0]; },
      setValues(v) { if (v.length !== nr || v.some(x => x.length !== nc)) throw new Error('setValues shape mismatch on ' + sh.name); v.forEach((row, i) => row.forEach((x, j) => sh.put(r + i, c + j, x))); },
      setValue(x) { sh.put(r, c, x); },
      clearContent() { for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) sh.put(r + i, c + j, ''); }
    };
  }
  getDataRange() { return this.getRange(1, 1, Math.max(1, this.getLastRow()), Math.max(1, this.getLastColumn())); }
  /* Sheets stores "'text" as text without the quote prefix; keep that behaviour */
  put(r, c, x) { while (this.d.length < r) this.d.push([]); const row = this.d[r - 1]; while (row.length < c) row.push(''); row[c - 1] = (typeof x === 'string' && x[0] === "'") ? x.slice(1) : x; }
  clearContents() { this.d = []; }
  hideSheet() { this.hidden = true; }
}
class Book {
  constructor() { this.sheets = {}; }
  getSheetByName(n) { return this.sheets[n] || null; }
  insertSheet(n) { return (this.sheets[n] = new Sheet(n)); }
  set(n, rows) { this.sheets[n] = new Sheet(n, rows); }
}

/* ---------- service stubs ---------- */
function makeContext() {
  const ss = new Book();
  const props = {};
  const log = [];
  const lockState = { held: false, tries: [] };
  const triggers = [];
  const fetches = [];
  let fetchImpl = url => { throw new Error('unexpected UrlFetchApp.fetch ' + url); };
  const ctx = {
    Date: FakeDate, Math, JSON, String, Number, Object, Array, isNaN, parseFloat, parseInt, Error, RegExp,
    console: { log: (...a) => log.push(a.join(' ')), error: (...a) => log.push('ERROR ' + a.join(' ')) },
    Logger: { log: m => log.push(String(m)) },
    SpreadsheetApp: { getActive: () => ss, getUi: () => ({ createMenu: () => { const m = { items: [], addItem(a, b) { m.items.push([a, b]); return m; }, addToUi() { ctx.__menu = m.items; } }; return m; } }) },
    PropertiesService: { getScriptProperties: () => ({
      getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); },
      deleteProperty: k => { delete props[k]; }, getProperties: () => Object.assign({}, props) }) },
    LockService: { getScriptLock: () => { let mine = false; return {
      tryLock: ms => { lockState.tries.push(ms); if (lockState.held) return false; lockState.held = true; mine = true; return true; },
      waitLock: ms => { if (lockState.held) throw new Error('Lock timeout'); lockState.held = true; mine = true; },
      releaseLock: () => { if (mine) { lockState.held = false; mine = false; } } }; } },
    ScriptApp: {
      getProjectTriggers: () => triggers.slice(),
      deleteTrigger: t => { const i = triggers.indexOf(t); if (i > -1) triggers.splice(i, 1); },
      newTrigger: fn => { const spec = { fn }; const b = { timeBased: () => b, everyMinutes: n => { spec.every = n + 'min'; return b; }, everyHours: n => { spec.every = n + 'h'; return b; },
        create: () => { const t = { getHandlerFunction: () => fn, spec }; triggers.push(t); return t; } }; return b; }
    },
    UrlFetchApp: { fetch: (url, opts) => { fetches.push(url); return fetchImpl(url, opts); } },
    Utilities: { getUuid: () => 'uuid', computeDigest: () => [], DigestAlgorithm: {}, Charset: {} },
    ContentService: { createTextOutput: s => ({ setMimeType: () => s }), MimeType: {} }
  };
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx, { filename: 'Code.gs' });
  return { ctx, ss, props, log, lockState, triggers, fetches, setFetch: f => { fetchImpl = f; } };
}

/* Club Fixtures + Meta from the frozen 27 Sep sheet; kickoff strings carry the leading apostrophe as in the brief */
function clubFixturesRows(opts = {}) {
  const cf = MOCK['Club Fixtures'];
  const head = cf.cols.map(c => c.label);
  const rows = cf.rows.map(r => r.c.map(c => (c && c.v != null) ? c.v : ''));
  return [head].concat(rows.map(r => { const o = r.slice(); o[3] = (opts.noQuote ? '' : "'") + o[3]; return o; }));
}
function seed(h, curGw, rows) {
  // rows written through put(): the apostrophe is kept only when noQuote is false AND we bypass put; store raw to mimic the brief
  h.ss.sheets['Club Fixtures'] = new Sheet('Club Fixtures'); h.ss.sheets['Club Fixtures'].d = rows || clubFixturesRows();
  h.ss.set('Meta', [['League', 'El Matador Tire'], ['Updated', '2026-09-27T02:01:09.194Z'], ['Pot', '$1200'], ['Current GW', curGw]]);
}

/* ---------- tiny test runner ---------- */
let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log('PASS  ' + name + (detail ? '  [' + detail + ']' : '')); }
  else { fail++; console.log('FAIL  ' + name + (detail ? '  [' + detail + ']' : '')); }
}
function tickAt(h, iso) {
  NOW = Date.parse(iso);
  let runs = 0;
  h.ctx.refreshCore = () => { runs++; };
  const r = h.ctx.liveTick({ triggerUid: 'x' }); // Apps Script passes an event object
  return { r, runs };
}

console.log('--- 1. liveTick window (Club Fixtures from the frozen sheet, GW5: Fri 18 Sep 19:00Z; Sat 19 Sep 11:30Z, 14:00Z x3, 16:30Z; Sun 20 Sep 13:00Z x3, 15:30Z) ---');
{
  const cases = [
    ['5 h before the 12:30 (UK) kickoff, Sat 06:30Z', '2026-09-19T06:30:00Z', 5, false],
    ['6 min before kickoff, Sat 11:24Z (outside the 5 min lead)', '2026-09-19T11:24:00Z', 5, false],
    ['3 min before kickoff, Sat 11:27Z', '2026-09-19T11:27:00Z', 5, true],
    ['mid-match, Sat 12:15Z', '2026-09-19T12:15:00Z', 5, true],
    ['mid-match, 3pm games, Sat 15:05Z', '2026-09-19T15:05:00Z', 5, true],
    ['2 h after the last Saturday kickoff (16:30Z), 18:30Z', '2026-09-19T18:30:00Z', 5, true],
    ['2h55 after the last Saturday kickoff, 19:25Z', '2026-09-19T19:25:00Z', 5, true],
    ['4 h after the last Saturday kickoff, 20:30Z', '2026-09-19T20:30:00Z', 5, false],
    ['Friday 19:00Z game, 2h40 later (last of Friday), 21:40Z', '2026-09-18T21:40:00Z', 5, true],
    ['international break, Sun 27 Sep 14:00Z (next kickoff 10 Oct)', '2026-09-27T14:00:00Z', 6, false],
    ['international break, Sat 3 Oct 15:00Z', '2026-10-03T15:00:00Z', 6, false],
    ['after the break, GW6 opener Sat 10 Oct 11:40Z', '2026-10-10T11:40:00Z', 6, true]
  ];
  for (const [name, iso, gw, want] of cases) {
    const h = makeContext(); seed(h, gw);
    const { r, runs } = tickAt(h, iso);
    const reason = h.ctx.liveWindowReason(NOW);
    check(name + ' → ' + (want ? 'run' : 'no run'), (runs === 1) === want && h.fetches.length === 0,
      'refreshCore calls=' + runs + ', reason=' + (reason || '-') + ', fetches=' + h.fetches.length);
  }
  // the whole break, every 10 minutes: zero refreshes
  const h = makeContext(); seed(h, 6);
  let hits = 0, n = 0;
  for (let t = Date.parse('2026-09-20T18:40:00Z'); t < Date.parse('2026-10-10T11:25:00Z'); t += 600000) { n++; if (h.ctx.liveWindowReason(t)) hits++; }
  check('international break: no window at any of ' + n + ' ten-minute ticks from Sun 20 Sep 18:40Z to Sat 10 Oct 11:25Z', hits === 0, 'hits=' + hits);
  // Meta missing → all fixtures considered, same answer
  const h2 = makeContext(); seed(h2, 5); delete h2.ss.sheets['Meta'];
  check('no Meta tab: still decides from kickoffs (Sat 12:15Z → run)', !!h2.ctx.liveWindowReason(Date.parse('2026-09-19T12:15:00Z')));
  // kickoff stored without the apostrophe, or as a Date object
  const h3 = makeContext(); seed(h3, 5, clubFixturesRows({ noQuote: true }));
  check('kickoff text without apostrophe parses', !!h3.ctx.liveWindowReason(Date.parse('2026-09-19T12:15:00Z')));
  const rowsD = clubFixturesRows({ noQuote: true }).map((r, i) => i ? (r[3] = new FakeDate(r[3]), r) : r);
  const h4 = makeContext(); seed(h4, 5, rowsD);
  check('kickoff as a Date object parses', !!h4.ctx.liveWindowReason(Date.parse('2026-09-19T12:15:00Z')));
  // GW filter: with Meta at GW 12 the GW5 fixtures are ignored
  const h5 = makeContext(); seed(h5, 12);
  check('fixtures more than one GW from Meta Current GW are ignored', !h5.ctx.liveWindowReason(Date.parse('2026-09-19T12:15:00Z')));
}

console.log('\n--- 2. shared gate: throttle + lock across liveTick, hourly refreshAll and the app button ---');
{
  const h = makeContext(); seed(h, 5);
  let runs = 0; h.ctx.refreshCore = () => { runs++; };
  NOW = Date.parse('2026-09-19T12:15:00Z');
  const a = h.ctx.liveTick();
  NOW += 60 * 1000;
  const b = h.ctx.liveTick();
  check('second liveTick 60 s later does not refresh again', runs === 1 && a.ran === true && b.ran === false && b.ageSec === 60,
    'refreshCore calls=' + runs + ', 2nd result=' + JSON.stringify(b));
  NOW += 20 * 1000;
  const c = h.ctx.refreshAll();
  check('hourly refreshAll 80 s after a live tick is skipped', runs === 1 && c.ran === false, JSON.stringify(c));
  const d = h.ctx.emtRefresh();
  check('app refresh 80 s after is skipped with ageSec (app contract)', runs === 1 && d.ok === true && d.ran === false && d.ageSec === 80, JSON.stringify(d));
  NOW += 11 * 1000;
  const e = h.ctx.emtRefresh();
  check('app refresh 91 s after runs', runs === 2 && e.ran === true, JSON.stringify(e));
  NOW += 10 * 60 * 1000;
  h.lockState.held = true; // another execution is mid-refresh
  const f = h.ctx.liveTick();
  const g = h.ctx.refreshAll();
  const k = h.ctx.emtRefresh();
  check('while another refresh holds the lock: liveTick, refreshAll and the app button all skip (busy)',
    runs === 2 && f.busy === true && g.busy === true && k.busy === true, 'waits=' + JSON.stringify(h.lockState.tries.slice(-3)));
  h.lockState.held = false;
  const m = h.ctx.liveTick();
  check('lock released afterwards: next liveTick refreshes', runs === 3 && m.ran === true && h.lockState.held === false);
  // failure path
  NOW += 10 * 60 * 1000;
  h.ctx.refreshCore = () => { throw new Error('bootstrap-static → HTTP 503'); };
  const fl = h.ctx.liveTick();
  check('liveTick: refresh failure is returned + logged, lock released', fl.ok === false && /503/.test(fl.error) && !h.lockState.held && h.log.some(l => /^ERROR liveTick refresh failed/.test(l)));
  NOW += 10 * 60 * 1000;
  let threw = false; try { h.ctx.refreshAll(); } catch (err) { threw = /503/.test(err.message); }
  check('refreshAll (hourly trigger): failure still throws so Executions shows it', threw && !h.lockState.held);
  // idle tick touches nothing
  const h2 = makeContext(); seed(h2, 6);
  let r2 = 0; h2.ctx.refreshCore = () => { r2++; };
  NOW = Date.parse('2026-09-27T14:00:00Z');
  const idle = h2.ctx.liveTick();
  check('idle tick: no lock taken, no property written, no fetch', idle.idle === true && r2 === 0 && h2.lockState.tries.length === 0 && !('EMT_LAST_REFRESH' in h2.props) && h2.fetches.length === 0);
}

console.log('\n--- 3. installLiveTrigger / setup / menu ---');
{
  const h = makeContext(); seed(h, 5);
  h.ctx.ScriptApp.newTrigger('refreshAll').timeBased().everyHours(1).create();
  h.ctx.ScriptApp.newTrigger('liveTick').timeBased().everyMinutes(5).create();
  h.ctx.ScriptApp.newTrigger('liveTick').timeBased().everyMinutes(10).create();
  h.ctx.installLiveTrigger();
  const sum = h.triggers.map(t => t.spec.fn + '/' + t.spec.every).sort().join(', ');
  check('installLiveTrigger replaces every liveTick trigger with one every 10 min, keeps hourly refreshAll', sum === 'liveTick/10min, refreshAll/1h', sum);
  NOW = Date.parse('2026-09-27T14:00:00Z');
  h.ctx.refreshCore = () => {};
  h.ctx.setup();
  const sum2 = h.triggers.map(t => t.spec.fn + '/' + t.spec.every).sort().join(', ');
  check('setup() leaves exactly hourly refreshAll + 10-min liveTick', sum2 === 'liveTick/10min, refreshAll/1h', sum2);
  h.ctx.onOpen();
  check('onOpen menu has the install item', JSON.stringify(h.ctx.__menu).includes('installLiveTrigger'), JSON.stringify(h.ctx.__menu));
}

console.log('\n--- 4. Transactions result labels ---');
{
  const h = makeContext();
  const want = { a: 'Accepted', di: 'Denied (invalid)', dp: 'Denied (priority)', do: 'Denied (drop gone)', zz: 'Denied', pd: 'Pending', '': '', null: '' };
  for (const code of Object.keys(want)) {
    const got = h.ctx.txResultLabel(code === 'null' ? null : code);
    check("txResultLabel('" + code + "') = '" + got + "'", got === want[code] && !/—/.test(got));
  }
  check('unmapped code is logged', h.log.some(l => /unmapped result code "zz"/.test(l)));
  // the app's own tests on Result (index-PREVIEW.html) still classify rows the same way
  const ok = s => /accept/i.test(s), pend = s => /pending/i.test(s);
  check('app /accept/i and /pending/i: Accepted→ok, Pending→pending, every Denied label→dimmed',
    ok('Accepted') && pend('Pending') && ['Denied (invalid)', 'Denied (priority)', 'Denied (drop gone)', 'Denied'].every(s => !ok(s) && !pend(s)));
}

console.log('\n--- 5. writeSheets end to end: Clubs strength columns + Transactions Result column ---');
{
  const h = makeContext();
  h.setFetch(url => {
    if (/fantasy\.premierleague\.com\/api\/fixtures/.test(url)) return { getContentText: () => '[]', getResponseCode: () => 200 };
    if (/transactions/.test(url)) return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ transactions: [
      { entry: 1, element_in: 10, element_out: 11, kind: 'w', result: 'a', event: 5, added: '2026-09-17T10:00:00Z' },
      { entry: 1, element_in: 10, element_out: 12, kind: 'w', result: 'do', event: 5, added: '2026-09-17T10:00:01Z' },
      { entry: 1, element_in: 10, element_out: 11, kind: 'w', result: 'di', event: 5, added: '2026-09-17T10:00:02Z' },
      { entry: 1, element_in: 10, element_out: 11, kind: 'w', result: 'zz', event: 5, added: '2026-09-17T10:00:03Z' }] }) };
    throw new Error('unexpected fetch ' + url);
  });
  h.ctx.getNationMap = () => ({}); // pulselive not under test
  const boot = { teams: [{ id: 1, short_name: 'ARS', name: 'Arsenal', code: 3 }, { id: 2, short_name: 'AVL', name: 'Aston Villa', code: 7 }],
    elements: [10, 11, 12].map(id => ({ id, web_name: 'P' + id, element_type: 3, team: 1, code: 1000 + id })), events: [] };
  const classicTeams = { ARS: { short_name: 'ARS', code: 3, strength_attack_home: 1340, strength_attack_away: 1370, strength_defence_home: 1300, strength_defence_away: 1330, strength_overall_home: 1320, strength_overall_away: 1350 } };
  const details = { league: { name: 'El Matador Tire' }, league_entries: [], matches: [], standings: [] };
  const teams = { 1: { entry: 1, name: 'Cold Palmers', manager: 'Parker Nolan', leagueEntry: 11 } };
  h.ctx.writeSheets(boot, details, teams, [], [], {}, { element_status: [] }, null, {}, { ARS: 3, AVL: 7 }, {}, 5, classicTeams);
  const cl = h.ss.getSheetByName('Clubs').d;
  check('Clubs header keeps the first four columns and appends six', JSON.stringify(cl[0]) === JSON.stringify(['Short', 'Name', 'Badge code', 'Badge URL', 'Str att H', 'Str att A', 'Str def H', 'Str def A', 'Str H', 'Str A']), JSON.stringify(cl[0]));
  check('ARS row carries classic strengths in order', JSON.stringify(cl[1]) === JSON.stringify(['ARS', 'Arsenal', 3, 'https://resources.premierleague.com/premierleague/badges/50/t3.png', 1340, 1370, 1300, 1330, 1320, 1350]), JSON.stringify(cl[1]));
  check('club with no strength data gets blanks, not errors', JSON.stringify(cl[2].slice(4)) === JSON.stringify(['', '', '', '', '', '']), JSON.stringify(cl[2]));
  const tx = h.ss.getSheetByName('Transactions').d;
  const res = tx.slice(1).map(r => r[6]);
  check('Transactions Result column (newest first): ' + JSON.stringify(res), JSON.stringify(res) === JSON.stringify(['Denied', 'Denied (invalid)', 'Denied (drop gone)', 'Accepted']));
  check('EMT_LAST_REFRESH stamped by writeSheets', !!h.props.EMT_LAST_REFRESH);
}

console.log('\n--- 6. quota: ten-minute ticks inside the live window over a whole UTC day ---');
{
  const day = (kos, label) => {
    const rows = [['GW', 'Home', 'Away', 'Kickoff (UTC)', 'Finished', 'Home goals', 'Away goals', 'Started', 'Mins']]
      .concat(kos.map((k, i) => [9, 'H' + i, 'A' + i, "'" + k, false, '', '', false, 0]));
    const h = makeContext(); seed(h, 9, rows);
    const d0 = Date.parse(kos[0].slice(0, 10) + 'T00:00:00Z');
    let best = 0, worst = 1e9;
    for (let off = 0; off < 10; off++) { // trigger phase within the 10-minute period
      let n = 0; for (let t = d0 + off * 60000; t < d0 + 86400000; t += 600000) if (h.ctx.liveWindowReason(t)) n++;
      best = Math.max(best, n); worst = Math.min(worst, n);
    }
    const idle = 144 - best, mins = (best * 30 + 24 * 30 + idle * 2) / 60, mins45 = (best * 45 + 24 * 45 + idle * 2) / 60;
    console.log('INFO  ' + label + ': ' + worst + '-' + best + ' refreshing ticks; worst case ' + best + 'x30 s + 24 hourly x30 s + ' + idle + ' idle x2 s = ' + mins.toFixed(1) + ' min (' + mins45.toFixed(1) + ' min at 45 s per refresh)');
    return mins45;
  };
  const sat = MOCK['Club Fixtures'].rows.map(r => r.c[3] && r.c[3].v).filter(k => k && k.startsWith('2026-09-19'));
  day(sat, 'GW5 Saturday 19 Sep (real: 11:30, 14:00 x3, 16:30 UTC)');
  day(['2026-12-26T12:30:00Z', '2026-12-26T15:00:00Z', '2026-12-26T15:00:00Z', '2026-12-26T17:30:00Z', '2026-12-26T20:00:00Z'], 'Boxing Day style (12:30, 15:00 x2, 17:30, 20:00 UTC)');
  const w = day(['2026-11-07T11:30:00Z', '2026-11-07T13:45:00Z', '2026-11-07T16:00:00Z', '2026-11-07T18:15:00Z', '2026-11-07T20:00:00Z'], 'stress case, no gaps (11:30, 13:45, 16:00, 18:15, 20:00 UTC)');
  check('stress case fits the 90 min/day trigger quota even at 45 s per refresh', w < 90, w.toFixed(1) + ' min');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
