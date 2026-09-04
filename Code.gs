/*******************************************************
 * EL MATADOR TIRE — FPL Draft League 45380 · 2026/27
 * Google Sheet + Apps Script · v3.3 (unified app backend; classic live overlay; manager logins)
 *
 * SETUP (one time):
 *   1. Extensions → Apps Script → paste into Code.gs
 *   2. Run setup() once and authorize
 *   3. Share the Sheet: Anyone with the link · Viewer
 *   4. Deploy → New deployment → Web app · Execute as Me · Anyone → paste the URL into Specials as Setting `API URL`
 *
 * v3 adds: Ratings tab (frozen FIFA-style OVRs, elite list),
 * player photo codes + nations on Rosters, Clubs tab with
 * official badge codes, actual post-deadline lineups,
 * TOTW flag (Rosters: official FPL dream team; GW Log: house rule, 10+ pt haul), Specials tab (POTM).
 *******************************************************/

var LEAGUE_ID = 45380;
var API = 'https://draft.premierleague.com/api/';
var CLASSIC = 'https://fantasy.premierleague.com/api/';
var PULSE = 'https://footballapi.pulselive.com/football/';
var PULSE_SEASON = 841; // 2026/27 — bump next August
var MIDSEASON_GW = 19;
var PRIZES = { first: 600, second: 180, third: 60, mid: 90, motm: 30, buyIn: 150, pot: 1200 };

var MOTM_PERIODS = [
  { name: 'Aug & Sep', from: 1,  to: 5  },
  { name: 'October',   from: 6,  to: 9  },
  { name: 'November',  from: 10, to: 12 },
  { name: 'December',  from: 13, to: 18 },
  { name: 'January',   from: 19, to: 23 },
  { name: 'February',  from: 24, to: 27 },
  { name: 'March',     from: 28, to: 30 },
  { name: 'April',     from: 31, to: 33 },
  { name: 'May',       from: 34, to: 38 }
];

var POS = { 1: 'GKP', 2: 'DEF', 3: 'MID', 4: 'FWD' };

/* ---------- ratings: commissioner elite list ----------
 * Anyone on this list is guaranteed 85+ (elite card).
 * Key is normalized web_name; add "|POS" when two players
 * share a web_name (the two Martinezes). Pinned = exact OVR. */
var ELITE = ['szoboszlai','cunha','pickford','haaland','semenyo','brunog','rogers','rice',
  'gyokeres','palmer','raya','gabriel','saliba','joaopedro','guehi','welbeck','saka','mbeumo',
  'sarr','munoz','watkins','gibbswhite','virgil','donnarumma','eze','rashford','bfernandes',
  'cherki','pedroporro','martinez|GKP','isak','wirtz','enzo','calafiori'];
var PINNED = { 'haaland': 96, 'bfernandes': 96 };

function normName(n) {
  return String(n || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z]/g, '');
}
function isElite(name, pos) {
  var n = normName(name);
  return ELITE.indexOf(n) > -1 || ELITE.indexOf(n + '|' + pos) > -1;
}

/* ---------- one-time setup ---------- */
function setup() {
  refreshAll();
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('refreshAll').timeBased().everyHours(1).create();
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('⚽ FPL Draft')
    .addItem('Refresh now', 'refreshAll')
    .addToUi();
}

/* ---------- fetch helpers ---------- */
function getJson(path) {
  var res = UrlFetchApp.fetch(API + path, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error(path + ' → HTTP ' + res.getResponseCode());
  return JSON.parse(res.getContentText());
}
function getUrl(url) {
  var opts = { muteHttpExceptions: true };
  if (url.indexOf('pulselive') > -1) {
    opts.headers = { 'Origin': 'https://www.premierleague.com', 'Referer': 'https://www.premierleague.com/' };
  }
  var res = UrlFetchApp.fetch(url, opts);
  if (res.getResponseCode() !== 200) throw new Error(url + ' → HTTP ' + res.getResponseCode());
  return JSON.parse(res.getContentText());
}

/* ---------- nations: pulselive, cached in script properties ----------
 * Maps FPL player code (= opta id) → ISO nation code (e.g. GB-ENG, BR).
 * Fetches the 20 club squad lists only when an owned code is missing. */
var NATFALLBACK = {154561:'ES',85633:'BE',472769:'GB-ENG',437499:'FR',491279:'NL',227444:'RS',462424:'FR',204480:'GB-ENG',244851:'GB-ENG',215379:'GB-ENG',513418:'DE',195546:'AR',224117:'SE',482973:'BR',463067:'FR',215059:'ES',485055:'CZ',17761:'GB-ENG',169528:'US',221820:'AR',445087:'UY',610799:'HR',439509:'GR',437730:'GH',208706:'BR',244850:'GB-ENG',231747:'FR',470313:'DE',441264:'NL',200720:'IE',172649:'GB-ENG',226597:'BR',209036:'GB-ENG',221466:'AR',106611:'GB-ENG',231416:'TR',435997:'CH',215413:'GB-ENG',484420:'FR',466525:'DE',60307:'DE',475168:'BR',50175:'GB-ENG',177815:'GB-ENG',204936:'IT',109745:'ES',97032:'NL',216051:'PT',448104:'EC',477424:'HR',198869:'GB-ENG',209244:'GB-ENG',222531:'GB-ENG',232413:'GB-ENG',247632:'PT',114283:'GB-ENG',517052:'SN',178301:'GB-ENG',60689:'NZ',111234:'GB-ENG',432720:'GB-ENG',494521:'FR',427623:'US',215136:'GB-WLS',200834:'FR',78916:'GB-ENG',499604:'BR',424876:'HU',533463:'BF',153682:'GB-WLS',430871:'BR',223094:'NO',485711:'SI',690838:'GB-ENG',465247:'BE',80201:'DE',466075:'IT',225796:'GB-ENG',487838:'GB-ENG',445122:'NL',480455:'GB-ENG',172780:'GB-ENG',448047:'AR',184029:'NO',494595:'DE',503139:'GB-ENG',219168:'SE',486385:'GW',216646:'CD',98980:'AR',116535:'BR',441164:'ES',465351:'PT',544877:'HU',216094:'NL',500040:'ES',141746:'PT',176297:'GB-ENG',466052:'FR',248857:'GB-ENG',460842:'GH',438234:'EG',502500:'BR',444102:'BR',498016:'NL',98747:'GB-ENG',247348:'CO',469142:'NL',432830:'IE',171314:'PT',223827:'GB-NIR',223340:'GB-ENG',446008:'CM',243298:'NL',248875:'BE',232185:'SN',219847:'DE',212319:'BR',538207:'DK',560262:'FR',551210:'NL',449434:'SE',433969:'JP',154566:'GB-ENG',465642:'DE',201658:'GB-ENG',205533:'GB-ENG',465730:'BE',607464:'IT',482616:'FR',586309:'FR',463726:'BA',551466:'ES',513545:'ML',440993:'SN',611695:'CI',638987:'SN'};

function getNationMap(codesNeeded) {
  // Cache lives in a hidden NatCache sheet (A1 = JSON) — the old NATMAP script
  // property tops out at 9KB, too small now that we map ALL ~600 PL players.
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName('NatCache');
  if (!sh) { sh = ss.insertSheet('NatCache'); sh.hideSheet(); }
  var cache = {};
  try { cache = JSON.parse(sh.getRange(1, 1).getValue() || '{}'); } catch (e) {}
  // migrate anything from the legacy script property once
  try {
    var legacy = PropertiesService.getScriptProperties().getProperty('NATMAP');
    if (legacy) { var lm = JSON.parse(legacy); Object.keys(lm).forEach(function (c) { if (!cache[c]) cache[c] = lm[c]; }); }
  } catch (e) {}
  Object.keys(NATFALLBACK).forEach(function (c) { if (!cache[c]) cache[c] = NATFALLBACK[c]; });
  var missing = codesNeeded.filter(function (c) { return c && !cache[c]; });
  if (!missing.length) return cache;
  try {
    var clubs = getUrl(PULSE + 'compseasons/' + PULSE_SEASON + '/teams').content || [];
    clubs.forEach(function (t) {
      try {
        var staff = getUrl(PULSE + 'teams/' + Math.round(t.id) + '/compseasons/' + PULSE_SEASON + '/staff?pageSize=50&altIds=true&type=player');
        (staff.players || []).forEach(function (p) {
          var opta = p.altIds && p.altIds.opta ? String(p.altIds.opta).replace(/^p/, '') : null;
          var iso = p.nationalTeam && p.nationalTeam.isoCode;
          if (opta && iso) cache[opta] = iso;
        });
      } catch (e) { /* one club failing shouldn't kill the map */ }
    });
    sh.getRange(1, 1).setValue(JSON.stringify(cache));
    sh.getRange(1, 2).setValue('updated ' + new Date().toISOString());
  } catch (e) { Logger.log('Nation fetch failed: ' + e); }
  return cache;
}

/* ---------- actual lineups (visible after each deadline) ---------- */
function getLineups(teams, curGw) {
  var out = {}; // entryId -> { elementId: slot(1-15) }
  if (!curGw) return out;
  Object.keys(teams).forEach(function (entry) {
    try {
      var r = getJson('entry/' + entry + '/event/' + curGw);
      if (r && r.picks && r.picks.length) {
        var m = {};
        r.picks.forEach(function (p) { m[p.element] = p.position; });
        out[entry] = m;
      }
    } catch (e) { /* pre-deadline: lineups private */ }
  });
  return out;
}

/* ---------- main refresh ---------- */
function refreshAll() {
  var boot    = getJson('bootstrap-static');
  var details = getJson('league/' + LEAGUE_ID + '/details');
  var choices = getJson('draft/' + LEAGUE_ID + '/choices');
  var estat;
  try { estat = getJson('league/' + LEAGUE_ID + '/element-status'); }
  catch (e) { estat = { element_status: [] }; }

  // classic API: club badge codes + TOTW from the LAST COMPLETED gameweek only
  // + ep_this/ep_next (FPL's own predicted points — classic-only fields, join on code)
  var cByCode = {}, clubCodes = {}, classicByCode = {}, classicIdToCode = {};
  try {
    var cboot = getUrl(CLASSIC + 'bootstrap-static/');
    var idToCode = {};
    cboot.elements.forEach(function (e) {
      idToCode[e.id] = e.code; classicIdToCode[e.id] = e.code; cByCode[e.code] = { dream: false };
      classicByCode[e.code] = { ep_this: e.ep_this, ep_next: e.ep_next };
    });
    cboot.teams.forEach(function (t) { clubCodes[t.short_name] = t.code; });
    var lastDone = null;
    (cboot.events || []).forEach(function (e) { if (e.finished) lastDone = e.id; });
    if (lastDone) {
      try {
        var dream = getUrl(CLASSIC + 'dream-team/' + lastDone + '/');
        (dream.team || []).forEach(function (m) {
          var code = idToCode[m.element];
          if (code && cByCode[code]) cByCode[code].dream = true;
        });
      } catch (e) { Logger.log('Dream team fetch failed: ' + e); }
    }
  } catch (e) { Logger.log('Classic bootstrap failed: ' + e); }

  // current gameweek + live per-player points
  var evs = boot.events.data || boot.events, curEv = null;
  for (var i = 0; i < evs.length; i++) { if (!evs[i].finished) { curEv = evs[i].id; break; } }
  var gwLive = null;
  try { if (curEv) gwLive = getJson('event/' + curEv + '/live'); } catch (e) { gwLive = null; }
  // The draft live feed can freeze mid-match (30 Aug 2026: every Sunday game stuck at
  // 7-9 mins all afternoon while the classic feed ran to full time). Overlay the
  // classic feed per player (join on code); the fresher line wins, never the staler.
  try { if (curEv) gwLive = mergeClassicLive(gwLive, boot, curEv, classicIdToCode); }
  catch (e) { Logger.log('Classic live overlay failed: ' + e); }

  var players = {};
  boot.elements.forEach(function (e) { players[e.id] = e; });
  var clubs = {};
  boot.teams.forEach(function (t) { clubs[t.id] = t.short_name; });

  var teams = {}, leToEntry = {};
  details.league_entries.forEach(function (le) {
    teams[le.entry_id] = { entry: le.entry_id, name: le.entry_name, manager: le.player_first_name + ' ' + le.player_last_name, waiver: le.waiver_pick, leagueEntry: le.id };
    leToEntry[le.id] = le.entry_id;
  });

  var lineups = getLineups(teams, curEv);

  var picks = choices.choices.map(function (c) {
    var p = players[c.element] || {};
    return {
      overall: c.index, round: c.round, pick: c.pick, entry: c.entry,
      teamName: c.entry_name, el: c.element,
      player: p.web_name || ('#' + c.element),
      pos: POS[p.element_type] || '?', club: clubs[p.team] || '?',
      rank: p.draft_rank || 999, lastPts: p.total_points || 0,
      minutes: p.minutes || 0, xgi: parseFloat(p.expected_goal_involvements || 0),
      status: p.status || 'a', news: p.news || '',
      proj: projPoints(p, clubs[p.team]),
      value: c.round <= 11
        ? Math.round(Math.max(c.index - (p.draft_rank || 999), -60) * (12 - c.round) / 11)
        : 0
    };
  });

  var grades = gradeTeams(teams, picks);
  gradePicks(picks);
  writeSheets(boot, details, teams, picks, grades, leToEntry, estat, gwLive, cByCode, clubCodes, lineups, curEv);

  // ownership map (element id -> team name) shared by the new tabs
  var ownerByEl = {};
  ((estat && estat.element_status) || []).forEach(function (s) {
    if (s.owner == null) return;
    var entry = teams[s.owner] ? s.owner : leToEntry[s.owner];
    if (teams[entry]) ownerByEl[s.element] = teams[entry].name;
  });

  var ss = SpreadsheetApp.getActive();
  try { writePredictions(ss, boot, classicByCode); } catch (e) { Logger.log('Predictions failed: ' + e); }
  try { writePlayers(ss, boot, ownerByEl, classicByCode); } catch (e) { Logger.log('Players failed: ' + e); }
  try { writeGwStats(ss, boot, ownerByEl, gwLive, curEv); } catch (e) { Logger.log('GW Stats failed: ' + e); }
}

/* ---------- live-feed resilience: classic overlay on the draft live feed ----------
   Both APIs publish the same per-player stat line for event/{gw}/live, but they
   are separate pipelines and the draft one has frozen mid-gameweek before. Per
   player (joined on code — ids differ between the two APIs) take the classic
   line when it reports MORE minutes, or the same minutes with bonus already
   landed; otherwise keep the draft line (the league's scoring source). Stale
   never overwrites fresh, so once the draft feed catches up nothing changes. */
function mergeClassicLive(gwLive, boot, gw, classicIdToCode) {
  if (!classicIdToCode || !Object.keys(classicIdToCode).length) return gwLive;
  var cl = getUrl(CLASSIC + 'event/' + gw + '/live/');
  if (!cl || !cl.elements || !cl.elements.length) return gwLive;
  var byCode = {};
  cl.elements.forEach(function (e) { var c = classicIdToCode[e.id]; if (c) byCode[c] = e.stats || null; });
  if (!gwLive || !gwLive.elements) gwLive = { elements: {} };
  var used = 0, seen = 0;
  boot.elements.forEach(function (p) {
    var cs = byCode[p.code]; if (!cs) return;
    seen++;
    var d = gwLive.elements[p.id], ds = (d && d.stats) || {};
    var dm = ds.minutes || 0, cm = cs.minutes || 0;
    var fresher = cm > dm || (cm === dm && cm > 0 && (cs.bonus || 0) > (ds.bonus || 0));
    if (!fresher) return;
    if (!d) gwLive.elements[p.id] = { stats: cs, explain: [] };
    else d.stats = cs;
    used++;
  });
  Logger.log('Classic live overlay GW' + gw + ': ' + used + ' of ' + seen + ' player lines taken from the classic feed');
  return gwLive;
}

/* ---------- Predictions: pre-deadline ep_this snapshot, ALL players ----------
   One block per GW. Rewritten every refresh until that GW's deadline passes,
   then frozen forever (the block simply stops being selected). ep_this is only
   a prediction BEFORE the deadline — this tab is the only durable record of it.
   Feeds: pre-GW predicted scores, mid-weekend projected-final blending. */
function writePredictions(ss, boot, classicByCode) {
  var evs = boot.events.data || boot.events, next = null;
  for (var i = 0; i < evs.length; i++) {
    if (!evs[i].finished && new Date(evs[i].deadline_time) > new Date()) { next = evs[i]; break; }
  }
  if (!next) return; // between deadline and GW finish: nothing to capture

  var HEAD = ['GW', 'Code', 'Player', 'Pos', 'Club', 'EP', 'Proj', 'Captured (UTC)'];
  var sh = ss.getSheetByName('Predictions') || ss.insertSheet('Predictions');
  if (sh.getLastRow() < 1) sh.getRange(1, 1, 1, HEAD.length).setValues([HEAD]);

  // existing block for this GW is always the tail (GWs only move forward)
  var firstRow = null, last = sh.getLastRow();
  if (last > 1) {
    var gws = sh.getRange(2, 1, last - 1, 1).getValues();
    for (var r = 0; r < gws.length; r++) if (String(gws[r][0]) === String(next.id)) { firstRow = r + 2; break; }
  }

  var clubs = {}; boot.teams.forEach(function (t) { clubs[t.id] = t.short_name; });
  var now = new Date().toISOString();
  var rows = boot.elements.map(function (e) {
    var c = classicByCode[e.code] || {};
    return [next.id, e.code, e.web_name, POS[e.element_type] || '?', clubs[e.team] || '?',
      c.ep_this != null ? parseFloat(c.ep_this) : '', projPoints(e, clubs[e.team]), "'" + now];
  });

  if (firstRow) sh.getRange(firstRow, 1, last - firstRow + 1, HEAD.length).clearContent();
  sh.getRange(firstRow || (last + 1), 1, rows.length, HEAD.length).setValues(rows);
}

/* ---------- Players: the full FPL universe with ownership (rewritten each run) ----
   Every active element, Owner = team name or FREE. Feeds club view ("who on
   Arsenal does everyone have"), player search, and the free-agent pool. App
   joins FC27 tab on Code for card ratings of unowned players. */
function writePlayers(ss, boot, ownerByEl, classicByCode) {
  var clubs = {}; boot.teams.forEach(function (t) { clubs[t.id] = t.short_name; });
  var natMap = getNationMap(boot.elements.map(function (e) { return String(e.code); }));
  var HEAD = ['Code', 'Player', 'Pos', 'Club', 'Owner', 'Status', 'News', 'Draft rank',
    'Season pts', 'Mins', 'Form', 'xGI', 'EP next', 'Proj', 'Nation', 'Full name'];
  var rows = boot.elements.map(function (e) {
    var c = classicByCode[e.code] || {};
    return [e.code, e.web_name, POS[e.element_type] || '?', clubs[e.team] || '?',
      ownerByEl[e.id] || 'FREE', e.status || 'a', e.news || '', e.draft_rank || '',
      e.total_points || 0, e.minutes || 0, parseFloat(e.form || 0),
      parseFloat(e.expected_goal_involvements || 0),
      c.ep_next != null ? parseFloat(c.ep_next) : '', projPoints(e, clubs[e.team]),
      natMap[String(e.code)] || '',
      ((e.first_name || '') + ' ' + (e.second_name || '')).trim()];
  });
  var sh = ss.getSheetByName('Players') || ss.insertSheet('Players');
  sh.clearContents();
  var data = [HEAD].concat(rows);
  sh.getRange(1, 1, data.length, HEAD.length).setValues(data);
}

/* ---------- GW Stats: per-player per-GW stat history, ALL players --------------
   One block per GW from event/{gw}/live: full stat line + xG/xA/xGC. Current GW
   is rewritten live every refresh; once a GW is finished its block is written
   with Final=TRUE and frozen. Unlike GW Log this CAN backfill — the live
   endpoint persists for finished GWs, and any finished GW missing a Final block
   is fetched automatically. Feeds: xP (post-GW expected points), player points
   breakdown, luck leaderboard, free-agent scouting. Raw ingredients only — all
   xP math (position multipliers, Poisson clean sheets) lives in the app. */
var GWSTATS_HEAD = ['GW', 'Code', 'Player', 'Pos', 'Club', 'Owner', 'Mins', 'Pts',
  'G', 'A', 'CS', 'GC', 'OG', 'PS', 'PM', 'YC', 'RC', 'Saves', 'Bonus', 'BPS',
  'DefCon', 'xG', 'xA', 'xGC', 'Starts', 'Final'];

function writeGwStats(ss, boot, ownerByEl, gwLive, curEv) {
  var sh = ss.getSheetByName('GW Stats') || ss.insertSheet('GW Stats');
  if (sh.getLastRow() < 1) sh.getRange(1, 1, 1, GWSTATS_HEAD.length).setValues([GWSTATS_HEAD]);

  var evs = boot.events.data || boot.events;
  var finished = {}; evs.forEach(function (e) { if (e.finished) finished[e.id] = true; });

  // scan existing rows: where each GW's block starts, and which are Final
  var done = {}, blockStart = {}, last = sh.getLastRow();
  if (last > 1) {
    var vals = sh.getRange(2, 1, last - 1, GWSTATS_HEAD.length).getValues();
    vals.forEach(function (r, i) {
      var gw = String(r[0]);
      if (blockStart[gw] == null) blockStart[gw] = i + 2;
      if (r[GWSTATS_HEAD.length - 1] === true || String(r[GWSTATS_HEAD.length - 1]).toUpperCase() === 'TRUE') done[gw] = true;
    });
  }

  var clubs = {}; boot.teams.forEach(function (t) { clubs[t.id] = t.short_name; });
  var els = {}; boot.elements.forEach(function (e) { els[e.id] = e; });

  var writeBlock = function (gw, live, isFinal) {
    if (!live || !live.elements) return;
    var rows = [];
    Object.keys(live.elements).forEach(function (id) {
      var p = els[id]; if (!p) return;
      var st = (live.elements[id] && live.elements[id].stats) || {};
      rows.push([gw, p.code, p.web_name, POS[p.element_type] || '?', clubs[p.team] || '?',
        ownerByEl[id] || '',
        st.minutes || 0, st.total_points || 0, st.goals_scored || 0, st.assists || 0,
        st.clean_sheets || 0, st.goals_conceded || 0, st.own_goals || 0,
        st.penalties_saved || 0, st.penalties_missed || 0, st.yellow_cards || 0, st.red_cards || 0,
        st.saves || 0, st.bonus || 0, st.bps || 0, st.defensive_contribution || 0,
        parseFloat(st.expected_goals || 0), parseFloat(st.expected_assists || 0),
        parseFloat(st.expected_goals_conceded || 0), st.starts || 0, !!isFinal]);
    });
    if (!rows.length) return;
    var start;
    if (blockStart[String(gw)]) {
      // this GW's block is the tail (only the newest GW is ever rewritten)
      var lr = sh.getLastRow();
      sh.getRange(blockStart[String(gw)], 1, lr - blockStart[String(gw)] + 1, GWSTATS_HEAD.length).clearContent();
      start = blockStart[String(gw)];
    } else start = sh.getLastRow() + 1;
    sh.getRange(start, 1, rows.length, GWSTATS_HEAD.length).setValues(rows);
  };

  // backfill / finalize: any finished GW without a Final block (ascending order)
  evs.forEach(function (e) {
    if (e.finished && !done[String(e.id)]) {
      try { writeBlock(e.id, getJson('event/' + e.id + '/live'), true); }
      catch (err) { Logger.log('GW Stats backfill GW' + e.id + ' failed: ' + err); }
    }
  });
  // live rewrite of the current in-play GW
  if (curEv && !finished[curEv] && gwLive) writeBlock(curEv, gwLive, false);
}

/* ---------- per-pick grades (draft history, unchanged) ---------- */
function gradePicks(picks) {
  var sorted = picks.slice().sort(function (a, b) { return b.proj - a.proj; })
                    .map(function (p) { return p.proj; });
  picks.forEach(function (p) {
    var i = p.overall - 1, w = [], j;
    for (j = Math.max(0, i - 3); j <= Math.min(sorted.length - 1, i + 3); j++) w.push(sorted[j]);
    var expected = Math.round(w.reduce(function (a, b) { return a + b; }, 0) / w.length);
    var s = (p.proj - expected) + 0.5 * p.value;
    p.pickGrade = s >= 40 ? 'A+' : s >= 22 ? 'A' : s >= 10 ? 'A-' : s >= 3 ? 'B+' :
                  s >= -6 ? 'B' : s >= -16 ? 'B-' : s >= -30 ? 'C+' : s >= -50 ? 'C' : 'D';
    var n90 = p.minutes / 90;
    var p90 = p.minutes > 0 ? Math.round(10 * p.lastPts / n90) / 10 : 0;
    var ex = 'Projects ' + p.proj + ' vs ~' + expected + ' expected at pick #' + p.overall + '. ';
    if (p.minutes >= 1500) {
      ex += 'Rate-based: ' + p.lastPts + ' pts in ' + p.minutes + ' mins last season (' + p90 + '/90, xGI ' + p.xgi.toFixed(1) + ').';
    } else if (p.minutes > 0) {
      ex += 'Small sample — ' + p.lastPts + ' pts in only ' + p.minutes + ' mins (' + p90 + '/90), so this leans on FPL rank ' + p.rank + '.';
    } else {
      ex += 'No PL minutes last season — projection rests entirely on FPL rank ' + p.rank + '.';
    }
    if (p.news) ex += ' ⚠ ' + p.news + '.';
    p.explain = ex;
  });
}

/* ---------- projection model v2 (feeds waiver proj + rating curve) ---------- */
var CLUB_MULT = { ARS:1.07, LIV:1.05, MCI:1.05, CHE:1.04, AVL:1.01, NEW:1.01,
  TOT:0.99, MUN:0.99, BHA:0.99, CRY:0.98, BOU:0.98, BRE:0.97, FUL:0.96,
  EVE:0.96, WHU:0.95, WOL:0.93, LEE:0.93, SUN:0.92, BUR:0.90, COV:0.88 };

function projPoints(p, clubShort) {
  if (!p.id) return 0;
  var rank = p.draft_rank || 500;
  var rankCurve = 235 * Math.exp(-(rank - 1) / 135) + 18;
  var n90 = Math.max((p.minutes || 0) / 90, 4);
  var ptsRate = (p.total_points || 0) / n90;
  var xgiRate = parseFloat(p.expected_goal_involvements || 0) / n90;
  var posBase = { 1: 3.0, 2: 2.9, 3: 2.2, 4: 2.0 }[p.element_type] || 2.2;
  var underlying = posBase + 5.2 * xgiRate;
  var quality = 0.55 * ptsRate + 0.45 * underlying;
  var sec = Math.min(1, 0.35 + 0.65 * ((p.minutes || 0) / 3000));
  if (rank <= 80) sec = Math.max(sec, 0.88);
  var perf = quality * (34 * sec);
  var trust = Math.min(1, (p.minutes || 0) / 1500);
  var base = trust * perf + (1 - trust) * rankCurve;
  var club = CLUB_MULT[clubShort] || 0.96;
  var mult = { a: 1, d: 0.85, i: 0.55, s: 0.75, u: 0.05, n: 1 }[p.status] || 1;
  return Math.round(base * club * mult);
}

/* ---------- ratings ----------
 * Frozen once written: existing OVRs are never recomputed, new
 * (waiver) players get slotted on first appearance.
 * Elite (commissioner list): 85–95 scaled on projection, pins override.
 * Everyone else: 60–84 curve on projection. */
var RATINGS_VERSION = 'v3.1'; // FC27 base + FPL top-end boost + R1/R2 spec boost
var OVR_CAP = 95;
var BOOST_TIERS = [[3, 4], [8, 3], [14, 2], [20, 1]]; // proj rank ≤ n → +boost
// Commissioner hand-set OVRs — always win, even over frozen values.
// Key = normName, or normName|POS to disambiguate. Add freely.
var OVR_OVERRIDES = { 'bfernandes': 93 };

function readOvrTable(ss, tabName, codeHeader, ovrHeader) {
  var sh = ss.getSheetByName(tabName);
  if (!sh || sh.getLastRow() < 2) return {};
  var vals = sh.getDataRange().getValues();
  var head = vals[0].map(String);
  var ci = head.indexOf(codeHeader), oi = head.indexOf(ovrHeader);
  if (ci < 0 || oi < 0) return {};
  var m = {};
  vals.slice(1).forEach(function (r) {
    var c = String(r[ci]).replace(/\.0$/, ''), o = parseFloat(r[oi]);
    if (c && o) m[c] = Math.round(o);
  });
  return m;
}

function computeRatings(ss, rosterPlayers) {
  var sh = ss.getSheetByName('Ratings');
  var existing = {};
  var sameVersion = sh && sh.getLastRow() > 0 && String(sh.getRange('H1').getValue()) === RATINGS_VERSION;
  if (sh && sh.getLastRow() > 1 && sameVersion) {
    sh.getDataRange().getValues().slice(1).forEach(function (r) {
      if (r[0]) existing[normName(r[0]) + '|' + r[1]] = r[4];
    });
  }
  var fc27 = readOvrTable(ss, 'FC27', 'fpl_code', 'ea_ovr_fc27');    // pasted ea_fc27_premier_league.csv
  var fc26 = readOvrTable(ss, 'EA Map', 'fpl_code', 'ea_ovr_fc26');  // pasted crosswalk (fallback)
  // FPL top-end boost: rank owned players by projected points
  var ranked = rosterPlayers.slice().sort(function (a, b) { return b.proj - a.proj; });
  var boost = {};
  ranked.forEach(function (p, i) {
    var b = 0;
    for (var t = 0; t < BOOST_TIERS.length; t++) if (i < BOOST_TIERS[t][0]) { b = BOOST_TIERS[t][1]; break; }
    boost[p.el] = b;
  });
  var curveNew = rosterPlayers.filter(function (p) {
    return !(normName(p.player) + '|' + p.pos in existing) && !fc27[String(p.code)] && !fc26[String(p.code)];
  }).sort(function (a, b) { return b.proj - a.proj; });
  var n = curveNew.length;
  var rows = [];
  rosterPlayers.forEach(function (p) {
    var key = normName(p.player) + '|' + p.pos;
    var ov = OVR_OVERRIDES[key] || OVR_OVERRIDES[normName(p.player)];
    var ovr;
    if (ov) ovr = ov;
    else if (key in existing) ovr = existing[key];
    else {
      var base = fc27[String(p.code)] || fc26[String(p.code)];
      var spec = /^R[12]\./.test(p.drafted || '');
      if (base) {
        var b = boost[p.el] || 0;
        if (spec) b = Math.max(b, 2); // round 1-2 picks ride a little higher (no stacking)
        ovr = Math.min(OVR_CAP, base + (sameVersion ? 0 : b));
        if (!sameVersion && spec && ovr < 83) ovr = 83; // no embarrassing draft specials
      }
      else {
        var i = curveNew.indexOf(p);
        ovr = n > 1 ? Math.round(64 + 20 * (1 - Math.pow(i / (n - 1), 1.6))) : 76;
      }
    }
    p.ovr = ovr;
    rows.push([p.player, p.pos, p.club, p.team, ovr,
      ovr >= 85 ? 'elite' : (ovr >= 78 ? 'gold' : 'silver')]);
  });
  var out = ss.getSheetByName('Ratings') || ss.insertSheet('Ratings');
  out.clearContents();
  var data = [['Player', 'Pos', 'Club', 'Owner', 'OVR', 'Band']].concat(rows);
  out.getRange(1, 1, data.length, 6).setValues(data);
  out.getRange('H1').setValue(RATINGS_VERSION);
}

/* ---------- best legal XI (projection fallback pre-deadline) ---------- */
function bestXI(squad) {
  var by = { GKP: [], DEF: [], MID: [], FWD: [] };
  squad.forEach(function (p) { (by[p.pos] || (by[p.pos] = [])).push(p); });
  Object.keys(by).forEach(function (k) { by[k].sort(function (a, b) { return b.proj - a.proj; }); });
  var xi = [];
  xi.push(by.GKP[0]);
  xi = xi.concat(by.DEF.slice(0, 3), by.MID.slice(0, 2), by.FWD.slice(0, 1));
  var pool = by.DEF.slice(3, 5).concat(by.MID.slice(2, 5), by.FWD.slice(1, 3));
  pool.sort(function (a, b) { return b.proj - a.proj; });
  xi = xi.concat(pool.slice(0, 4)).filter(Boolean);
  return xi;
}

/* ---------- team grading (draft history, unchanged) ---------- */
function gradeTeams(teams, picks) {
  var rows = Object.keys(teams).map(function (entry) {
    var t = teams[entry];
    var squad = picks.filter(function (p) { return p.entry == entry; });
    var xi = bestXI(squad);
    var xiIds = {};
    xi.forEach(function (p) { xiIds[p.el] = true; });
    var xiPts = xi.reduce(function (s, p) { return s + p.proj; }, 0);
    var benchPts = squad.filter(function (p) { return !xiIds[p.el]; })
                        .reduce(function (s, p) { return s + p.proj; }, 0);
    var value = squad.reduce(function (s, p) { return s + p.value; }, 0);
    var risks = squad.filter(function (p) { return 'isud'.indexOf(p.status) > -1; });
    var risk = risks.reduce(function (s, p) { return s + (16 - p.round); }, 0);
    var best = squad.slice().sort(function (a, b) { return b.value - a.value; })[0];
    var reach = squad.slice().sort(function (a, b) { return a.value - b.value; })[0];
    var top3 = squad.slice().sort(function (a, b) { return b.proj - a.proj; }).slice(0, 3);
    return { team: t.name, manager: t.manager, entry: t.entry, waiver: t.waiver,
             strength: xiPts + 0.2 * benchPts, xiPts: xiPts, benchPts: benchPts,
             value: value, risk: risk, top3: top3,
             riskList: risks.map(function (p) { return p.player + ' (' + p.news.split(' - ')[0] + ')'; }).join('; '),
             bestPick: best && best.value > 0 ? best.player + ' R' + best.round + ' (+' + best.value + ' vs board)' : '',
             reachPick: reach && reach.value < -15 ? reach.player + ' R' + reach.round + ' (' + reach.value + ' vs board)' : '—' };
  });

  var z = function (arr, v) {
    var m = arr.reduce(function (a, b) { return a + b; }, 0) / arr.length;
    var sd = Math.sqrt(arr.reduce(function (a, b) { return a + (b - m) * (b - m); }, 0) / arr.length) || 1;
    return (v - m) / sd;
  };
  var sArr = rows.map(function (r) { return r.strength; });
  var vArr = rows.map(function (r) { return r.value; });
  var rArr = rows.map(function (r) { return r.risk; });
  rows.forEach(function (r) {
    r.score = 0.62 * z(sArr, r.strength) + 0.23 * z(vArr, r.value) - 0.15 * z(rArr, r.risk);
    r.grade = r.score >= 1.0 ? 'A+' : r.score >= 0.65 ? 'A' : r.score >= 0.35 ? 'A-' :
              r.score >= 0.12 ? 'B+' : r.score >= -0.12 ? 'B' : r.score >= -0.4 ? 'B-' :
              r.score >= -0.75 ? 'C+' : r.score >= -1.1 ? 'C' : 'C-';
  });
  rows.sort(function (a, b) { return b.score - a.score; });
  var xiRanked = rows.slice().sort(function (a, b) { return b.xiPts - a.xiPts; });
  var bnRanked = rows.slice().sort(function (a, b) { return b.benchPts - a.benchPts; });
  var ord = ['1st','2nd','3rd','4th','5th','6th','7th','8th'];
  rows.forEach(function (r) {
    var xiR = xiRanked.indexOf(r), bnR = bnRanked.indexOf(r);
    var why = 'Built around ' + r.top3.map(function (p) { return p.player + ' (' + p.proj + ')'; }).join(', ') +
      '. Projected XI is ' + ord[xiR] + ' in the league; bench depth ' + ord[bnR] + '.';
    why += r.value > 30 ? ' Beat the board consistently — ' + r.bestPick + '.' :
           r.value < -30 ? ' Paid above board price for their guys' + (r.reachPick !== '—' ? ' (' + r.reachPick + ')' : '') + '.' :
           ' Paid roughly fair board prices.';
    if (r.riskList) why += ' Availability drag: ' + r.riskList + '.';
    r.why = why;
  });
  return rows;
}

/* ---------- sheet writer ---------- */
function writeSheets(boot, details, teams, picks, grades, leToEntry, estat, gwLive, cByCode, clubCodes, lineups, curEv) {
  var ss = SpreadsheetApp.getActive();
  var put = function (name, header, rows) {
    var sh = ss.getSheetByName(name) || ss.insertSheet(name);
    sh.clearContents();
    var data = [header].concat(rows);
    sh.getRange(1, 1, data.length, header.length).setValues(data);
  };

  put('Grades', ['Rank', 'Team', 'Manager', 'Grade', 'Score', 'Proj XI pts', 'Draft value', 'Risk pts', 'Risk flags', 'Best pick', 'Biggest reach', 'Why'],
    grades.map(function (g, i) { return [i + 1, g.team, g.manager, g.grade, Math.round(g.score * 100) / 100, Math.round(g.xiPts), g.value, g.risk, g.riskList, g.bestPick, g.reachPick, g.why]; }));

  put('Draft Board', ['Overall', 'Round', 'Pick', 'Team', 'Player', 'Pos', 'Club', 'FPL rank', 'Value vs rank', 'Proj pts', 'Mins', 'Pts/90', 'xGI', 'Pick grade', 'Status', 'News', 'Explanation'],
    picks.map(function (p) {
      var p90 = p.minutes > 0 ? Math.round(10 * p.lastPts / (p.minutes / 90)) / 10 : 0;
      return [p.overall, p.round, p.pick, p.teamName, p.player, p.pos, p.club, p.rank, p.value, p.proj, p.minutes, p90, p.xgi, p.pickGrade, p.status, p.news, p.explain];
    }));

  /* ----- rosters: live ownership + everything the app needs ----- */
  var players2 = {}; boot.elements.forEach(function (e) { players2[e.id] = e; });
  var clubs2 = {}; boot.teams.forEach(function (t) { clubs2[t.id] = t.short_name; });
  var byEl = {}; picks.forEach(function (p) { byEl[p.el] = p; });
  var squads = {};
  ((estat && estat.element_status) || []).forEach(function (s) {
    if (s.owner == null) return;
    var entry = teams[s.owner] ? s.owner : leToEntry[s.owner];
    if (!teams[entry]) return;
    (squads[entry] = squads[entry] || []).push(s.element);
  });

  // gather all owned player objects (also feeds ratings + nations)
  var allOwned = [];
  var perEntry = {};
  Object.keys(teams).forEach(function (entry) {
    var els = (squads[entry] && squads[entry].length >= 10) ? squads[entry]
      : picks.filter(function (p) { return p.entry == entry; }).map(function (p) { return p.el; });
    var squad = els.map(function (el) {
      var p = players2[el] || {};
      var d = byEl[el];
      var lu = lineups[entry] || null;
      return { el: el, player: p.web_name || ('#' + el), pos: POS[p.element_type] || '?',
        club: clubs2[p.team] || '?', rank: p.draft_rank || 999,
        proj: projPoints(p, clubs2[p.team]), status: p.status || 'a', news: p.news || '',
        seasonPts: p.total_points || 0, code: p.code || '',
        totw: (cByCode[p.code] && cByCode[p.code].dream) ? 'TOTW' : '',
        gwPts: (gwLive && gwLive.elements && gwLive.elements[el]) ? (gwLive.elements[el].stats.total_points || 0) : 0,
        gwMins: (gwLive && gwLive.elements && gwLive.elements[el]) ? (gwLive.elements[el].stats.minutes || 0) : 0,
        slot: lu ? (lu[el] || 0) : 0,
        gwXI: lu ? (lu[el] && lu[el] <= 11 ? 'XI' : 'BEN') : '',
        team: teams[entry].name,
        drafted: (d && d.entry == entry) ? ('R' + d.round + '.' + d.pick) : 'WV' };
    });
    perEntry[entry] = squad;
    allOwned = allOwned.concat(squad);
  });

  computeRatings(ss, allOwned); // sets p.ovr on every player

  var natMap = getNationMap(allOwned.map(function (p) { return String(p.code); }));

  var rosterRows = [];
  Object.keys(teams).forEach(function (entry) {
    var squad = perEntry[entry];
    var xiIds = {};
    bestXI(squad).forEach(function (p) { xiIds[p.el] = true; });
    squad.sort(function (a, b) { return ('GKP DEF MID FWD'.indexOf(a.pos) - 'GKP DEF MID FWD'.indexOf(b.pos)) || (b.proj - a.proj); })
         .forEach(function (p) {
           rosterRows.push([teams[entry].name, teams[entry].manager, p.player, p.pos, p.club, p.rank, p.proj,
             xiIds[p.el] ? 'XI' : 'Bench', p.status, p.news, p.drafted, p.seasonPts, p.gwPts, p.gwMins,
             p.code, natMap[String(p.code)] || '', p.ovr, p.totw, p.gwXI, p.slot]);
         });
  });
  put('Rosters', ['Team', 'Manager', 'Player', 'Pos', 'Club', 'FPL rank', 'Proj pts', 'Best XI', 'Status', 'News', 'Drafted', 'Season pts', 'GW pts', 'GW mins', 'Code', 'Nation', 'OVR', 'TOTW', 'GW XI', 'Slot'], rosterRows);

  /* ----- clubs: official badge codes ----- */
  var clubRows = boot.teams.map(function (t) {
    var code = clubCodes[t.short_name] || t.code || '';
    return [t.short_name, t.name, code,
      code ? 'https://resources.premierleague.com/premierleague/badges/50/t' + code + '.png' : ''];
  });
  put('Clubs', ['Short', 'Name', 'Badge code', 'Badge URL'], clubRows);

  /* ----- specials: POTM is set by hand, never overwritten ----- */
  if (!ss.getSheetByName('Specials')) {
    var sp = ss.insertSheet('Specials');
    sp.getRange(1, 1, 3, 2).setValues([
      ['Setting', 'Value'],
      ['POTM player', ''],
      ['POTM month', '']
    ]);
  }

  put('H2H Fixtures', ['GW', 'Home', 'Home pts', 'Away', 'Away pts', 'Finished'],
    details.matches.map(function (m) {
      var h = teams[leToEntry[m.league_entry_1]], a = teams[leToEntry[m.league_entry_2]];
      return [m.event, h ? h.name : m.league_entry_1, m.league_entry_1_points, a ? a.name : m.league_entry_2, m.league_entry_2_points, m.finished];
    }));

  try {
    var cmap = {};
    boot.teams.forEach(function (t) { cmap[t.id] = t.short_name; });
    var plfx = JSON.parse(UrlFetchApp.fetch('https://fantasy.premierleague.com/api/fixtures/', { muteHttpExceptions: true }).getContentText());
    // NB: FPL's `finished` lags days behind full time; `finished_provisional`
    // flips at the whistle — use it (OR'd) so 'Finished' means "match over".
    put('Club Fixtures', ['GW', 'Home', 'Away', 'Kickoff (UTC)', 'Finished', 'Home goals', 'Away goals', 'Started', 'Mins'],
      plfx.filter(function (f) { return f.event; }).map(function (f) {
        return [f.event, cmap[f.team_h] || f.team_h, cmap[f.team_a] || f.team_a, "'" + (f.kickoff_time || ''),
          !!(f.finished || f.finished_provisional),
          f.team_h_score == null ? '' : f.team_h_score, f.team_a_score == null ? '' : f.team_a_score,
          !!f.started, f.minutes || 0];
      }));
  } catch (e) {
    Logger.log('Club Fixtures failed: ' + e);
    var errSh = ss.getSheetByName('Club Fixtures') || ss.insertSheet('Club Fixtures');
    errSh.getRange(1, 1).setValue('Fixture pull failed at ' + new Date().toISOString() + ': ' + e);
  }

  /* ----- trades & waivers: league transactions feed ----- */
  try {
    var tk = { w: 'Waiver', f: 'Free agent' };
    var tr2 = { a: 'Accepted', di: 'Denied — invalid', dp: 'Denied — priority', pd: 'Pending', r: 'Rejected', o: 'Out-prioritised' };
    var trans = (getJson('draft/league/' + LEAGUE_ID + '/transactions').transactions) || [];
    put('Transactions', ['GW', 'Team', 'Manager', 'In', 'Out', 'Type', 'Result', 'When (UTC)'],
      trans.slice().reverse().map(function (t) {
        var tm = teams[t.entry] || {};
        var pin = players2[t.element_in] || {}, pout = players2[t.element_out] || {};
        return [t.event || '', tm.name || '', tm.manager || '',
          pin.web_name || ('#' + t.element_in), pout.web_name || ('#' + t.element_out),
          tk[t.kind] || t.kind || '', tr2[t.result] || t.result || '', "'" + (t.added || '')];
      }));
  } catch (e) { Logger.log('Transactions failed: ' + e); }

  put('Standings', ['Team', 'Manager', 'W', 'D', 'L', 'Pts For', 'Pts Against', 'League Pts'],
    details.standings.map(function (s) {
      var t = teams[leToEntry[s.league_entry]] || {};
      return [t.name || '', t.manager || '', s.matches_won, s.matches_drawn, s.matches_lost, s.points_for, s.points_against, s.total];
    }));

  var periodOf = function (gw) {
    for (var i = 0; i < MOTM_PERIODS.length; i++) if (gw >= MOTM_PERIODS[i].from && gw <= MOTM_PERIODS[i].to) return MOTM_PERIODS[i].name;
    return '';
  };
  put('Matchweeks', ['GW', 'Deadline (UTC)', 'MOTM period', 'Finished', 'Notes'],
    (boot.events.data || boot.events).map(function (e) {
      var note = e.id === MIDSEASON_GW ? '💰 $' + PRIZES.mid + ' mid-season leader after this GW' : (e.id === 38 ? '🏆 Final GW' : '');
      return [e.id, "'" + e.deadline_time, periodOf(e.id), e.finished, note];
    }));

  var motmRows = [];
  MOTM_PERIODS.forEach(function (per) {
    var totals = {};
    details.matches.forEach(function (m) {
      if (m.event < per.from || m.event > per.to || !m.started) return;
      totals[leToEntry[m.league_entry_1]] = (totals[leToEntry[m.league_entry_1]] || 0) + m.league_entry_1_points;
      totals[leToEntry[m.league_entry_2]] = (totals[leToEntry[m.league_entry_2]] || 0) + m.league_entry_2_points;
    });
    var ranked = Object.keys(totals).map(function (e) { return { name: teams[e].name, pts: totals[e] }; })
                       .sort(function (a, b) { return b.pts - a.pts; });
    motmRows.push([per.name, 'GW' + per.from + '–' + per.to,
      ranked.length ? ranked[0].name + ' (' + ranked[0].pts + ')' : '— starts GW' + per.from,
      ranked.map(function (r) { return r.name + ' ' + r.pts; }).join(' · ')]);
  });
  put('MOTM', ['Period', 'Gameweeks', 'Leader ($' + PRIZES.motm + ')', 'All totals'], motmRows);

  var meta = ss.getSheetByName('Meta') || ss.insertSheet('Meta');
  meta.clearContents();
  meta.getRange(1, 1, 4, 2).setValues([
    ['League', details.league.name],
    ['Updated', "'" + new Date().toISOString()],
    ['Pot', '$' + PRIZES.pot + ' · 1st $' + PRIZES.first + ' · 2nd $' + PRIZES.second + ' · 3rd $' + PRIZES.third + ' · Mid-season $' + PRIZES.mid + ' · MOTM 9×$' + PRIZES.motm],
    ['Current GW', curEv || '']
  ]);

  try { logGwHistory(ss, boot, teams, perEntry); } catch (e) { Logger.log('GW Log failed: ' + e); }
  // EA Map tab is now static — pasted from fpl_ea_crosswalk_2026_27.csv, never written by script.
}

/* ---------- GW Log: append-only per-player history, one block per finished GW ----------
   Runs every refresh but only writes once per GW (checks col A). Cannot be backfilled if
   missed, so keep this alive. Feeds form strips / sparklines / MOTM evidence in the app. */
/* One-time repair for #19: GW1 was logged with a blank TOTW column. Fills column J for
   GW=1 rows only, from the GW pts already in the row (house rule: 10+). Safe to re-run;
   touches nothing else. Run once from the editor (Run > fixGw1Totw), then forget it. */
function fixGw1Totw() {
  var sh = SpreadsheetApp.getActive().getSheetByName('GW Log');
  if (!sh || sh.getLastRow() < 2) return;
  var rng = sh.getRange(2, 1, sh.getLastRow() - 1, 10), v = rng.getValues(), n = 0;
  for (var i = 0; i < v.length; i++) {
    if (String(v[i][0]) === '1' || v[i][0] === 1) {
      var flag = (Number(v[i][6]) || 0) >= 10 ? 'TOTW' : '';
      if (v[i][9] !== flag) { v[i][9] = flag; n++; }
    }
  }
  if (n) rng.setValues(v);
  Logger.log('fixGw1Totw: ' + n + ' rows updated');
}

function logGwHistory(ss, boot, teams, perEntry) {
  var evs = boot.events.data || boot.events, lastDone = null;
  for (var i = 0; i < evs.length; i++) if (evs[i].finished) lastDone = evs[i].id;
  if (!lastDone) return;

  var HEAD = ['GW', 'Team', 'Player', 'Code', 'Pos', 'Club', 'GW pts', 'GW mins', 'Started', 'TOTW', 'Logged (UTC)'];
  var sh = ss.getSheetByName('GW Log') || ss.insertSheet('GW Log');
  if (sh.getLastRow() < 1) sh.getRange(1, 1, 1, HEAD.length).setValues([HEAD]);

  var logged = {};
  if (sh.getLastRow() > 1)
    sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().forEach(function (r) { logged[r[0]] = true; });
  if (logged[lastDone]) return;

  var live;
  try { live = getJson('event/' + lastDone + '/live'); } catch (e) { return; } // retry next run
  var lus = getLineups(teams, lastDone); // past-GW lineups stay public
  var now = new Date().toISOString();

  var rows = [];
  Object.keys(teams).forEach(function (entry) {
    (perEntry[entry] || []).forEach(function (p) {
      var st = (live.elements && live.elements[p.el] && live.elements[p.el].stats) || {};
      var slot = (lus[entry] && lus[entry][p.el]) || 0;
      rows.push([lastDone, teams[entry].name, p.player, p.code, p.pos, p.club,
        st.total_points || 0, st.minutes || 0,
        slot ? (slot <= 11 ? 'XI' : 'BEN') : '',
        (st.total_points || 0) >= 10 ? 'TOTW' : '', // #19: house rule (10+ haul) from live data — self-contained, never races the once-only write
        "'" + now]);
    });
  });
  if (rows.length) sh.getRange(sh.getLastRow() + 1, 1, rows.length, HEAD.length).setValues(rows);
}

/* ===== v3.3 · manager logins + profiles =====
 * Web app endpoint (Deploy → New deployment → Web app · Execute as Me · Anyone).
 * The app POSTs JSON as text/plain (no preflight); every reply is JSON {ok:true,…} or {ok:false,error:'…'}.
 *
 *   claim  {team,pin}                               → {ok,token}   errors: claimed · badteam · badpin
 *   login  {team,pin}                               → {ok,token}   errors: wrong · unclaimed · locked (+retryMin)
 *   save   {team,token,color,shape,photo,manager,emblem} → {ok}    errors: auth · badcolor · badshape · badphoto · bademblem
 *   reset  {team,token}                             → {ok}         clears the Managers row, keeps the PIN
 *   status {}                                       → {ok,claimed:[teams]}
 *   GET                                             → {ok,service:'emt',claimed:[teams]}   (open the URL to check the deploy)
 *
 * PIN hashes live ONLY in script properties (EMT_SECRET, EMT_PIN_<team>, EMT_FAIL_<team>) — never on the
 * (public) sheet. Profiles go to a `Managers` tab: Team | Color | Shape | Photo | Manager | Updated | Emblem ('' = crest art, 'initials').
 * 5 wrong PINs → 10-minute lockout. Changing a PIN invalidates old tokens.
 *
 * COMMISSIONER ESCAPE HATCH — a mate forgot his PIN:
 *   in the Apps Script editor run  adminResetPin('Team Jacob')  (exact team name) — deletes his PIN + lockout,
 *   his profile row stays, he re-claims from the app with a new PIN.
 */
var EMT_PALETTE = ['royal', 'sky', 'navy', 'amethyst', 'magenta', 'aurora', 'gold', 'crimson', 'tangerine', 'umber', 'forest', 'teal'];
var EMT_SHAPES = ['shield', 'heater', 'roundel', 'pennant', 'hex'];
var EMT_PHOTO_MAX = 45000;      // chars — sheet cells cap at 50k
var EMT_LOCK_TRIES = 5;
var EMT_LOCK_MIN = 10;
var EMT_MGR_HEAD = ['Team', 'Color', 'Shape', 'Photo', 'Manager', 'Updated', 'Emblem'];
var EMT_EMBLEMS = ['', 'initials'];

function emtProps() { return PropertiesService.getScriptProperties(); }

function emtSecret() {
  var p = emtProps();
  var s = p.getProperty('EMT_SECRET');
  if (!s) { s = Utilities.getUuid() + Utilities.getUuid(); p.setProperty('EMT_SECRET', s); }
  return s;
}

function sha256hex(str) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(str), Utilities.Charset.UTF_8);
  return bytes.map(function (b) { b = (b + 256) % 256; return (b < 16 ? '0' : '') + b.toString(16); }).join('');
}

function emtPinHash(team, pin) { return sha256hex(emtSecret() + '|' + team + '|' + pin); }
function emtToken(team, pinHash) { return sha256hex(emtSecret() + '|tok|' + team + '|' + pinHash); }

function emtOut(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/* team names come from the sheet (Standings, else Rosters) — never hardcoded */
function emtTeams() {
  var ss = SpreadsheetApp.getActive();
  var names = [], seen = {};
  ['Standings', 'Rosters'].forEach(function (tab) {
    if (names.length) return;
    var sh = ss.getSheetByName(tab);
    if (!sh || sh.getLastRow() < 2) return;
    var vals = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
    var col = vals[0].indexOf('Team');
    if (col < 0) return;
    vals.slice(1).forEach(function (r) {
      var t = String(r[col] || '').trim();
      if (t && !seen[t]) { seen[t] = true; names.push(t); }
    });
  });
  return names;
}

function emtClaimed() {
  var all = emtProps().getProperties();
  return Object.keys(all).filter(function (k) { return k.indexOf('EMT_PIN_') === 0; })
    .map(function (k) { return k.slice(8); }).sort();
}

function emtFail(team) {
  try { return JSON.parse(emtProps().getProperty('EMT_FAIL_' + team) || '{}'); } catch (e) { return {}; }
}
function emtLockedFor(team) {          // minutes remaining, 0 when free
  var f = emtFail(team);
  if (f.until && f.until > Date.now()) return Math.max(1, Math.ceil((f.until - Date.now()) / 60000));
  return 0;
}
function emtNoteFail(team) {
  var f = emtFail(team);
  var n = (f.until && f.until > Date.now()) ? 0 : ((f.n || 0) + 1);
  var o = { n: n };
  if (n >= EMT_LOCK_TRIES) { o.n = 0; o.until = Date.now() + EMT_LOCK_MIN * 60000; }
  emtProps().setProperty('EMT_FAIL_' + team, JSON.stringify(o));
}

function emtVerify(team, token) {      // → pin hash when the token is good, else null
  var ph = emtProps().getProperty('EMT_PIN_' + team);
  if (!ph || !token) return null;
  return emtToken(team, ph) === String(token) ? ph : null;
}

function emtManagersSheet() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName('Managers');
  if (!sh) { sh = ss.insertSheet('Managers'); sh.getRange(1, 1, 1, EMT_MGR_HEAD.length).setValues([EMT_MGR_HEAD]); }
  else if (sh.getLastRow() < 1) sh.getRange(1, 1, 1, EMT_MGR_HEAD.length).setValues([EMT_MGR_HEAD]);
  return sh;
}
function emtUpsertManager(team, color, shape, photo, manager, emblem) {
  var sh = emtManagersSheet();
  var last = sh.getLastRow();
  var row = 0;
  if (last > 1) {
    var teams = sh.getRange(2, 1, last - 1, 1).getValues();
    for (var i = 0; i < teams.length; i++) if (String(teams[i][0]) === team) { row = i + 2; break; }
  }
  if (!row) row = last + 1;
  if (sh.getLastColumn() < EMT_MGR_HEAD.length) sh.getRange(1, 1, 1, EMT_MGR_HEAD.length).setValues([EMT_MGR_HEAD]);
  sh.getRange(row, 1, 1, EMT_MGR_HEAD.length).setValues([[team, color, shape, photo, manager, "'" + new Date().toISOString(), emblem || '']]);
}

function emtHandle(req) {
  req = req || {};
  var action = String(req.action || '');
  var team = String(req.team || '').trim();
  var pin = String(req.pin || '');

  if (action === 'status') return { ok: true, claimed: emtClaimed() };

  if (action === 'claim' || action === 'login') {
    if (emtTeams().indexOf(team) < 0) return { ok: false, error: 'badteam' };
    if (!/^\d{4}$/.test(pin)) return { ok: false, error: 'badpin' };
    var lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      var key = 'EMT_PIN_' + team;
      var existing = emtProps().getProperty(key);
      if (action === 'claim') {
        if (existing) return { ok: false, error: 'claimed' };
        var ph = emtPinHash(team, pin);
        emtProps().setProperty(key, ph);
        emtProps().deleteProperty('EMT_FAIL_' + team);
        return { ok: true, token: emtToken(team, ph) };
      }
      if (!existing) return { ok: false, error: 'unclaimed' };
      var mins = emtLockedFor(team);
      if (mins) return { ok: false, error: 'locked', retryMin: mins };
      if (emtPinHash(team, pin) !== existing) {
        emtNoteFail(team);
        var m2 = emtLockedFor(team);
        return m2 ? { ok: false, error: 'locked', retryMin: m2 } : { ok: false, error: 'wrong' };
      }
      emtProps().deleteProperty('EMT_FAIL_' + team);
      return { ok: true, token: emtToken(team, existing) };
    } finally { lock.releaseLock(); }
  }

  if (action === 'save' || action === 'reset') {
    if (!emtVerify(team, req.token)) return { ok: false, error: 'auth' };
    if (action === 'reset') { emtUpsertManager(team, '', '', '', '', ''); return { ok: true }; }
    var color = String(req.color || ''), shape = String(req.shape || ''), photo = String(req.photo || '');
    if (color && EMT_PALETTE.indexOf(color) < 0) return { ok: false, error: 'badcolor' };
    if (shape && EMT_SHAPES.indexOf(shape) < 0) return { ok: false, error: 'badshape' };
    if (photo && (photo.indexOf('data:image/jpeg;base64,') !== 0 || photo.length > EMT_PHOTO_MAX)) return { ok: false, error: 'badphoto' };
    var emblem = String(req.emblem || '');
    if (EMT_EMBLEMS.indexOf(emblem) < 0) return { ok: false, error: 'bademblem' };
    var manager = String(req.manager || '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40);
    emtUpsertManager(team, color, shape, photo, manager, emblem);
    return { ok: true };
  }

  return { ok: false, error: 'unknown action' };
}

function doPost(e) {
  try {
    var body = (e && e.postData && e.postData.contents) || '';
    if (!body) return emtOut({ ok: false, error: 'empty body' });
    return emtOut(emtHandle(JSON.parse(body)));
  } catch (err) {
    return emtOut({ ok: false, error: String((err && err.message) || err) });
  }
}

function doGet(e) {
  try { return emtOut({ ok: true, service: 'emt', claimed: emtClaimed() }); }
  catch (err) { return emtOut({ ok: false, error: String((err && err.message) || err) }); }
}

/* commissioner: run from the editor with the exact team name, e.g. adminResetPin('Team Jacob') */
function adminResetPin(team) {
  var p = emtProps();
  p.deleteProperty('EMT_PIN_' + team);
  p.deleteProperty('EMT_FAIL_' + team);
  Logger.log('PIN + lockout cleared for ' + team + ' — they can re-claim from the app.');
}
