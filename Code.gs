/*******************************************************
 * EL MATADOR TIRE — FPL Draft League 45380 · 2026/27
 * Google Sheet + Apps Script · v3.12 (the show writes itself; Code.gs updates itself) · v3.11 (the Gameweek Show: voice clips from ElevenLabs) · v3.10 (the rumour mill; fewer, better AI posts) · v3.9 (the AI writer) · v3.8 (social: quotes, reactions, votes)
 *
 * SETUP (one time):
 *   1. Extensions → Apps Script → paste into Code.gs
 *   2. Run setup() once and authorize (installs the hourly refreshAll trigger AND the 10-minute liveTick trigger)
 *   3. Share the Sheet: Anyone with the link · Viewer
 *   4. Deploy → New deployment → Web app · Execute as Me · Anyone → paste the URL into Specials as Setting `API URL`
 *
 * CHANGELOG
 * v3.12 · 7 Oct 2026
 *   Everything runs from Google's servers now; nothing waits on anyone's computer.
 *   1. The show writes itself (bottom of this file). The app posts the gameweek's facts (fixtures, form, elevens,
 *      the model's odds) to the new `showfacts` action: signed-in managers only, one accepted post per manager per
 *      20 minutes, only for the next unfinished gameweek and only before its deadline. They go to a new hidden
 *      ShowFacts tab (latest post per gameweek). In the last 22 hours before the deadline, once facts arrived in the
 *      last 6 hours (or in the last 4 hours, with any facts), aiTick asks Claude for the script in Malcolm Tyre's
 *      voice, checks it (every fixture once, 5 beats each, stars from the elevens, no number that is not in what it
 *      was sent, bar counts up to 10 and result margins; one retry with the problems listed), turns the digits into
 *      words for the voice and keeps it in a new hidden ShowScripts tab. The voicing (v3.11) then renders it like a
 *      hand-written one. A hand-written show/gw<N>.json in the repo always wins. Uses ANTHROPIC_API_KEY. Optional
 *      Script Properties: EMT_SHOW_MODEL (default claude-sonnet-4-5); EMT_SHOW_TRIES_<gw> counts attempts (3 per
 *      gameweek; delete it to allow more); EMT_SHOW_PAUSED = yes pauses the writer and the voicing. To have a show
 *      rewritten, delete its ShowScripts row.
 *      GET <API URL>?show=<gw> also returns "script" (the repo json, else ShowScripts, else null); add &meta=1 to
 *      leave out the audio (secs, hash and complete stay).
 *   2. Code.gs updates itself from GitHub. Once an hour aiTick fetches Code.gs from the repo's main branch, checks
 *      it (size, markers, syntax, that it loads, not older than the running version), and when it differs it
 *      replaces this file, saves a version and points the web app at it (same URL). Off with EMT_SELF_UPDATE = off.
 *      Menu: Update Code.gs from GitHub now. selfUpdateStatus() logs the state. It stays dormant (state 'off: ...') until this SETUP:
 *        (1) turn on "Google Apps Script API" at https://script.google.com/home/usersettings
 *        (2) Project Settings → tick "Show appsscript.json manifest file in editor", open appsscript.json and add
 *            this key (keep everything else, the "webapp" section above all: without it a new version is not a web
 *            app, so the self-update refuses to run; if it is missing add "webapp": {"executeAs": "USER_DEPLOYING",
 *            "access": "ANYONE_ANONYMOUS"}):
 *            "oauthScopes": ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/script.external_request", "https://www.googleapis.com/auth/script.scriptapp", "https://www.googleapis.com/auth/script.container.ui", "https://www.googleapis.com/auth/script.projects", "https://www.googleapis.com/auth/script.deployments"]
 *        (3) run selfUpdateNow once from the editor and approve the permissions (it also installs the 15-minute
 *            aiTick trigger if it is missing).
 *      After that, every Code.gs pushed to the repo goes live within an hour. A copy edited by hand in the editor is
 *      left alone until the repo changes again (or selfUpdateNow is run). A copy pasted by hand that matches the repo
 *      but was never deployed is deployed by the next check. A repo copy that throws as it loads is refused.
 *   After pasting this one by hand: Deploy → Manage deployments → edit → Version: New version → Deploy.
 * v3.11 · 7 Oct 2026
 *   The Gameweek Show is voiced here now, not by hand (bottom of this file). The script stays in the app repo as
 *   show/gw<N>.json; this renders every line with ElevenLabs and serves the clips to the app.
 *   1. Add ELEVENLABS_API_KEY in Project Settings → Script Properties. Create the key at elevenlabs.io →
 *      Developers → API keys, with Text to Speech access. Optional: EMT_VOICE_ID (default Malcolm's voice),
 *      EMT_TTS_MODEL (default: the json's "model"), EMT_SHOW_PAUSED = yes to pause the automatic runs.
 *   2. Automatic: every 15 minutes, once show/gw<N>.json exists for the next unfinished gameweek, it renders the
 *      lines that are missing or changed (editing one line re-renders only that line). It rides the AI writer's
 *      15-minute trigger: aiTick() now runs the writer and then the show, each on its own, and the show runs even
 *      with the writer off. setup() installs that trigger when either key is set; otherwise run installAiTrigger().
 *   3. Clips are mp3s (64 kbps) kept as base64 in a new hidden ShowAudio tab. The app gets them from the web app:
 *      GET <API URL>?show=<gw>. Menu: Render the Gameweek Show now. showStatus(gw) logs what is rendered.
 *   No new permissions (only UrlFetchApp and this sheet). Menu 'Run the AI writer now' runs the writer only.
 *   After pasting: Deploy → Manage deployments → edit → Version: New version → Deploy.
 * v3.10 · 7 Oct 2026
 *   The rumour mill. Two new `social` kinds:
 *     rumour · Target r:<id> · Extra {text, about, anon} · 3 a day per manager
 *     pass   · Target r:<id> · Value confirm|deny|twist · Extra {text} (a twist needs text) · one per manager per
 *              rumour, never your own, and the rumour has to exist
 *   Any other short lower-case kind is stored as cleaned text, so new features don't need a new Code.gs.
 *   The AI writer writes less and better: 2 posts a run, 6 a day. New quotes are batched into one post (only quotes
 *   with a call, in the manager's own words, or answering someone). Full time is 2 posts. The build-up is one post
 *   per gameweek, in the last 30 hours. A rumour that gets passed on with a twist gets one retelling.
 *   After pasting: Deploy → Manage deployments → edit → Version: New version → Deploy.
 * v3.9 · 7 Oct 2026
 *   The AI writer (bottom of this file). Off until ANTHROPIC_API_KEY is set in Script Properties; then run
 *   installAiTrigger() once. Posts land in a new Posts tab the app reads; the tab doubles as the writer's memory.
 *   setup() keeps the AI trigger when a key is present. Menu: Install AI writer.
 * v3.8 · 7 Oct 2026
 *   The Feed goes social. New `social` action (signed-in managers only) appends to a new Social tab
 *   (When (UTC) · Team · Kind · Target · Value · Extra), which every phone reads like the other tabs:
 *     quote  · Target q:<gw> (your press conference) or qr:<gw>:<team> (your answer to <team>) · Extra {line, claim, p}
 *              one per manager per target, first one stands, refused after that gameweek's deadline
 *     react  · Target <post id> · Value fire|laugh|clown|eyes|bin · Extra on or off, latest row wins
 *     vote   · Target poll:<gw>:<home>|<away> · Value h|d|a, latest row wins, refused after the deadline
 *   40 writes a minute per manager. Text is cleaned (no < >, 140 characters) and nothing can start a formula.
 *   Includes everything in v3.7. After pasting: Deploy → Manage deployments → edit → Version: New version → Deploy.
 * v3.7 · 7 Oct 2026
 *   Club identity for the new app: `save` accepts the new colour presets (steel, olive, orange, red, orchid, lime,
 *   cream, rose, brown, mono) and any custom #rrggbb, plus a `pattern` ('' | stripes | hoops | halves | sash) written
 *   to a new Managers column, Pattern. Old palette names still work for the classic app. Errors add 'badpattern'.
 *   After pasting: Deploy → Manage deployments → edit the web app → Version: New version → Deploy (same URL).
 * v3.6 · 26 Sep 2026
 *   1. Live cadence. New liveTick() on a 10-minute trigger (install once: run installLiveTrigger(), or the
 *      menu item). It reads the sheet's own Club Fixtures tab (no URL fetch) and only refreshes while a PL
 *      match is live: kickoff - 5 min to kickoff + 2h15, and up to 3 h after the last kickoff of each UTC
 *      matchday so provisional bonus and finished_provisional land. refreshAll() (hourly trigger, menu,
 *      setup) and the app's refresh button now share ONE script lock + the EMT_LAST_REFRESH 90 s throttle
 *      (emtGuardedRefresh), so no two refreshes ever overlap or repeat within 90 s. The old refreshAll
 *      body is now refreshCore(). Quota maths next to liveTick(). setup() now re-creates both triggers.
 *   2. Transactions: result code 'do' mapped ('Denied (drop gone)'); labels lose their em dashes
 *      ('Denied (invalid)', 'Denied (priority)'); any unmapped code reads 'Denied' (and is logged),
 *      never the raw letters.
 *   3. Clubs tab gains FPL's own team strengths: Str att H, Str att A, Str def H, Str def A, Str H, Str A
 *      (classic bootstrap-static teams, joined on short name like the badge codes). Appended after the
 *      existing four columns; the app reads tabs by header name.
 * v3.5 · unified app backend; classic live overlay; manager logins; season-wide nations; on-demand refresh
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
  ScriptApp.newTrigger('liveTick').timeBased().everyMinutes(10).create(); // v3.6: re-running setup() keeps live refresh
  ScriptApp.newTrigger('aiTick').timeBased().everyMinutes(15).create();   // v3.9; v3.11 the show rides it too; v3.12 always: the Code.gs self-update rides it as well
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('⚽ FPL Draft')
    .addItem('Refresh now', 'refreshAll')
    .addItem('Install live refresh (every 10 min)', 'installLiveTrigger')
    .addItem('Install AI writer (every 15 min)', 'installAiTrigger')
    .addItem('Run the AI writer now', 'aiWriterTick')
    .addItem('Render the Gameweek Show now', 'renderShowNow')
    .addItem('Update Code.gs from GitHub now', 'selfUpdateNow')   // v3.12
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
 * Pages the season-wide pulselive players list only when a needed code is missing. */
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
  // Sep 2026: pulselive's compseasons/{id}/teams + staff endpoints now return empty; the season-wide
  // players list still works and carries EVERY registered player (~1,100 incl. new signings) with opta id + nation.
  try {
    var added = 0, page = 0, total = 1;
    while (page * 100 < total && page < 20) {
      var res = getUrl(PULSE + 'players?pageSize=100&compSeasons=' + PULSE_SEASON + '&altIds=true&type=player&id=-1&page=' + page);
      total = (res.pageInfo && res.pageInfo.numEntries) || 0;
      (res.content || []).forEach(function (p) {
        var opta = p.altIds && p.altIds.opta ? String(p.altIds.opta).replace(/^p/, '') : null;
        var iso = p.nationalTeam && p.nationalTeam.isoCode;
        if (opta && iso && cache[opta] !== iso) { cache[opta] = iso; added++; }
      });
      page++;
    }
    sh.getRange(1, 1).setValue(JSON.stringify(cache));
    sh.getRange(1, 2).setValue('updated ' + new Date().toISOString() + ' · ' + Object.keys(cache).length + ' players · +' + added);
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

/* ---------- main refresh ----------
 * refreshAll() is what the hourly trigger, the menu and setup() call. v3.6: it runs through
 * emtGuardedRefresh (one script lock + the 90 s EMT_LAST_REFRESH throttle, shared with liveTick and the
 * app's refresh button), so two refreshes never overlap or repeat within 90 s. The work is refreshCore(). */
function refreshAll() {
  var r = emtGuardedRefresh('refreshAll', EMT_TRIGGER_LOCK_MS);
  if (r.ok === false) throw new Error(r.error); // failures stay visible in Executions, as before v3.6
  if (!r.ran) Logger.log('refreshAll skipped: ' + (r.busy ? 'another refresh is running' : 'sheet refreshed ' + r.ageSec + ' s ago'));
  return r;
}

function refreshCore() {
  var boot    = getJson('bootstrap-static');
  var details = getJson('league/' + LEAGUE_ID + '/details');
  var choices = getJson('draft/' + LEAGUE_ID + '/choices');
  var estat;
  try { estat = getJson('league/' + LEAGUE_ID + '/element-status'); }
  catch (e) { estat = { element_status: [] }; }

  // classic API: club badge codes + TOTW from the LAST COMPLETED gameweek only
  // + ep_this/ep_next (FPL's own predicted points — classic-only fields, join on code)
  var cByCode = {}, clubCodes = {}, classicByCode = {}, classicIdToCode = {}, classicTeams = {};
  try {
    var cboot = getUrl(CLASSIC + 'bootstrap-static/');
    var idToCode = {};
    cboot.elements.forEach(function (e) {
      idToCode[e.id] = e.code; classicIdToCode[e.id] = e.code; cByCode[e.code] = { dream: false };
      classicByCode[e.code] = { ep_this: e.ep_this, ep_next: e.ep_next };
    });
    cboot.teams.forEach(function (t) { clubCodes[t.short_name] = t.code; classicTeams[t.short_name] = t; }); // v3.6: t carries strength_*
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
  writeSheets(boot, details, teams, picks, grades, leToEntry, estat, gwLive, cByCode, clubCodes, lineups, curEv, classicTeams);

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

/* ---------- v3.6 · waiver / free-agent result codes → the Transactions 'Result' column ----------
 * The app shows these strings as written and only tests them with /accept/i and /pending/i (row dimming),
 * so labels stay readable and em-dash free. An unmapped code reads 'Denied' (FPL only adds new codes for
 * failure reasons) and is logged so it can be named here. */
var TX_RESULT = { 'a': 'Accepted', 'di': 'Denied (invalid)', 'dp': 'Denied (priority)', 'do': 'Denied (drop gone)',
  'pd': 'Pending', 'r': 'Rejected', 'o': 'Out-prioritised' };
function txResultLabel(code) {
  var c = String(code == null ? '' : code).trim();
  if (!c) return '';
  if (Object.prototype.hasOwnProperty.call(TX_RESULT, c)) return TX_RESULT[c];
  Logger.log('Transactions: unmapped result code "' + c + '", shown as Denied');
  return 'Denied';
}

/* ---------- v3.6 · FPL team strengths for the Clubs tab ----------
 * FPL's own ratings (roughly 1000 to 1400). Source: classic bootstrap-static teams (the draft
 * bootstrap's teams may not carry them), falling back per field to the draft team object. */
var CLUB_STR_HEAD = ['Str att H', 'Str att A', 'Str def H', 'Str def A', 'Str H', 'Str A'];
var CLUB_STR_FIELDS = ['strength_attack_home', 'strength_attack_away', 'strength_defence_home',
  'strength_defence_away', 'strength_overall_home', 'strength_overall_away'];
function clubStrengthRow(classicTeam, draftTeam) {
  return CLUB_STR_FIELDS.map(function (k) {
    var v = (classicTeam && classicTeam[k] != null && classicTeam[k] !== '') ? classicTeam[k] : (draftTeam && draftTeam[k]);
    var n = Number(v);
    return (v == null || v === '' || isNaN(n)) ? '' : n;
  });
}

/* ---------- sheet writer ---------- */
function writeSheets(boot, details, teams, picks, grades, leToEntry, estat, gwLive, cByCode, clubCodes, lineups, curEv, classicTeams) {
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

  /* ----- clubs: official badge codes + (v3.6) FPL's own team strengths ----- */
  var clubRows = boot.teams.map(function (t) {
    var code = clubCodes[t.short_name] || t.code || '';
    return [t.short_name, t.name, code,
      code ? 'https://resources.premierleague.com/premierleague/badges/50/t' + code + '.png' : '']
      .concat(clubStrengthRow((classicTeams || {})[t.short_name], t));
  });
  put('Clubs', ['Short', 'Name', 'Badge code', 'Badge URL'].concat(CLUB_STR_HEAD), clubRows);

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
    var trans = (getJson('draft/league/' + LEAGUE_ID + '/transactions').transactions) || [];
    put('Transactions', ['GW', 'Team', 'Manager', 'In', 'Out', 'Type', 'Result', 'When (UTC)'],
      trans.slice().reverse().map(function (t) {
        var tm = teams[t.entry] || {};
        var pin = players2[t.element_in] || {}, pout = players2[t.element_out] || {};
        return [t.event || '', tm.name || '', tm.manager || '',
          pin.web_name || ('#' + t.element_in), pout.web_name || ('#' + t.element_out),
          tk[t.kind] || t.kind || '', txResultLabel(t.result), "'" + (t.added || '')];
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
  try { PropertiesService.getScriptProperties().setProperty('EMT_LAST_REFRESH', String(Date.now())); } catch (e) {}
}

/* ---------- one gate for every refresh: app button, hourly trigger, live tick ----------
 * The app's refresh button POSTs {action:'refresh'} → emtRefresh(); the hourly trigger and the menu call
 * refreshAll(); the 10-minute trigger calls liveTick(). All three go through emtGuardedRefresh: one script
 * lock (never two refreshes at once) and the EMT_LAST_REFRESH stamp (never twice within 90 s). Eight managers
 * tapping at once cost one run; the rest get {ran:false, ageSec} or {ran:false, busy:true} and re-read the sheet.
 * EMT_LAST_REFRESH is stamped when a run starts (and again by writeSheets near the end). */
var EMT_REFRESH_MIN_MS = 90 * 1000;
var EMT_TRIGGER_LOCK_MS = 5000; // triggers wait 5 s for the lock; if a refresh holds it, that run's data is fresh enough
function emtGuardedRefresh(source, waitMs) {
  var p = emtProps();
  var last = Number(p.getProperty('EMT_LAST_REFRESH') || 0), now = Date.now();
  if (now - last >= 0 && now - last < EMT_REFRESH_MIN_MS) return { ok: true, ran: false, ageSec: Math.round((now - last) / 1000) };
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(waitMs)) return { ok: true, ran: false, busy: true };
  try {
    last = Number(p.getProperty('EMT_LAST_REFRESH') || 0); now = Date.now();
    if (now - last >= 0 && now - last < EMT_REFRESH_MIN_MS) return { ok: true, ran: false, ageSec: Math.round((now - last) / 1000) };
    p.setProperty('EMT_LAST_REFRESH', String(now));
    refreshCore();
    Logger.log('Refresh (' + source + ') took ' + (Date.now() - now) + ' ms');
    return { ok: true, ran: true, ms: Date.now() - now };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  } finally { lock.releaseLock(); }
}
function emtRefresh() { return emtGuardedRefresh('app', 4000); }

/* ---------- v3.6 · live cadence: liveTick() on a 10-minute trigger ----------
 * Decides from the sheet's own Club Fixtures tab (no URL fetch, ~1 s) whether a PL match is live or just
 * finished, and only then refreshes. A fixture's window is kickoff - 5 min to kickoff + 2h15; the last
 * kickoff of each UTC matchday keeps refreshing to kickoff + 3h so provisional bonus and
 * finished_provisional land. Only fixtures within one GW of Meta 'Current GW' count (all of them if Meta
 * has no GW). Kickoffs move with TV picks; the hourly refresh keeps the tab current.
 *
 * QUOTA (consumer account: 90 min/day of trigger runtime; app-button refreshes run in the web app and do
 * not count). Worst realistic day: kickoffs from 11:30 to 20:00 UTC with no gap over 2h15 (a packed
 * Saturday or Boxing Day) keeps the window open 11:25 to 23:00, at most 70 refreshing ticks.
 *     70 live ticks x 30 s (slow end of refreshCore)         = 35.0 min
 *     24 hourly runs x 30 s                                   = 12.0 min
 *     74 idle ticks x ~2 s (open sheet, read two tabs)        =  2.5 min
 *     total                                                   ≈ 49.5 min  (73 min even if every refresh took 45 s)
 * GW5's real Saturday (11:30, 14:00 x3, 16:30 UTC) gives 46 to 49 refreshing ticks ≈ 40 min all in.
 * Hourly runs and app taps inside the 90 s throttle are skipped, which only lowers these numbers.
 * URL fetches: ~20 per refresh plus ~11 pulselive pages (a few dozen FPL codes never map to a nation, so
 * getNationMap pages every run) ≈ 30 x 95 refreshes ≈ 3,000 of the 20,000/day allowance. */
var LIVE_PRE_MS = 5 * 60 * 1000;
var LIVE_MATCH_MS = (2 * 60 + 15) * 60 * 1000;
var LIVE_TAIL_MS = 3 * 60 * 60 * 1000;

function liveTick() {
  var why = liveWindowReason(Date.now());
  if (!why) return { ok: true, ran: false, idle: true };
  var r = emtGuardedRefresh('liveTick', EMT_TRIGGER_LOCK_MS);
  if (r.ok === false) console.error('liveTick refresh failed (' + why + '): ' + r.error);
  else Logger.log('liveTick (' + why + '): ' + (r.ran ? 'refreshed in ' + r.ms + ' ms' : r.busy ? 'skipped, refresh already running' : 'skipped, refreshed ' + r.ageSec + ' s ago'));
  return r;
}

/* '' when no PL match is live or just finished at nowMs, else a short reason for the log */
function liveWindowReason(nowMs) {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName('Club Fixtures');
  if (!sh || sh.getLastRow() < 2) return '';
  var vals = sh.getDataRange().getValues();
  var head = vals[0].map(String);
  var gi = head.indexOf('GW'), ki = head.indexOf('Kickoff (UTC)'), hi = head.indexOf('Home'), ai = head.indexOf('Away');
  if (ki < 0) return '';
  var cur = liveCurrentGw(ss);
  var byDay = {}; // UTC date → [{ko, label}]
  for (var i = 1; i < vals.length; i++) {
    var gw = gi > -1 ? Number(vals[i][gi]) : NaN;
    if (cur && !isNaN(gw) && Math.abs(gw - cur) > 1) continue;
    var ko = liveKickoffMs(vals[i][ki]);
    if (ko == null) continue;
    var day = new Date(ko).toISOString().slice(0, 10);
    (byDay[day] = byDay[day] || []).push({ ko: ko, label: (hi > -1 ? vals[i][hi] : '') + '-' + (ai > -1 ? vals[i][ai] : '') });
  }
  var days = Object.keys(byDay);
  for (var d = 0; d < days.length; d++) {
    var fx = byDay[days[d]], lastKo = 0;
    fx.forEach(function (f) { if (f.ko > lastKo) lastKo = f.ko; });
    for (var j = 0; j < fx.length; j++) {
      var end = fx[j].ko === lastKo ? fx[j].ko + LIVE_TAIL_MS : fx[j].ko + LIVE_MATCH_MS;
      if (nowMs >= fx[j].ko - LIVE_PRE_MS && nowMs <= end) {
        return fx[j].label + ' ' + new Date(fx[j].ko).toISOString().slice(11, 16) + 'Z' + (fx[j].ko === lastKo ? ' (last of day)' : '');
      }
    }
  }
  return '';
}

/* Kickoff (UTC) holds text like '2026-09-19T14:00:00Z (written with a leading apostrophe; tolerate it, a Date, or blank) */
function liveKickoffMs(v) {
  if (v == null || v === '') return null;
  if (Object.prototype.toString.call(v) === '[object Date]') return isNaN(v.getTime()) ? null : v.getTime();
  var s = String(v).replace(/^'/, '').trim();
  if (!s) return null;
  var t = new Date(s).getTime();
  return isNaN(t) ? null : t;
}

/* Meta 'Current GW' (col A label, col B value); 0 when missing */
function liveCurrentGw(ss) {
  var meta = ss.getSheetByName('Meta');
  if (!meta || meta.getLastRow() < 1) return 0;
  var mv = meta.getRange(1, 1, meta.getLastRow(), 2).getValues();
  for (var i = 0; i < mv.length; i++) if (String(mv[i][0]) === 'Current GW') return Number(mv[i][1]) || 0;
  return 0;
}

/* run once from the editor (or the FPL Draft menu): replaces any liveTick trigger with one every 10 minutes */
function installLiveTrigger() {
  var removed = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'liveTick') { ScriptApp.deleteTrigger(t); removed++; }
  });
  ScriptApp.newTrigger('liveTick').timeBased().everyMinutes(10).create();
  Logger.log('installLiveTrigger: removed ' + removed + ' old liveTick trigger(s), created one every 10 min');
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
var EMT_PALETTE = ['royal', 'sky', 'navy', 'amethyst', 'magenta', 'aurora', 'gold', 'crimson', 'tangerine', 'umber', 'forest', 'teal',
  /* v3.6 · Matchweek identity presets (any #rrggbb is accepted too) */
  'steel', 'olive', 'orange', 'red', 'orchid', 'lime', 'cream', 'rose', 'brown', 'mono'];
var EMT_PATTERNS = ['', 'stripes', 'hoops', 'halves', 'sash'];
var EMT_SHAPES = ['shield', 'heater', 'roundel', 'pennant', 'hex'];
var EMT_PHOTO_MAX = 45000;      // chars — sheet cells cap at 50k
var EMT_LOCK_TRIES = 5;
var EMT_LOCK_MIN = 10;
var EMT_MGR_HEAD = ['Team', 'Color', 'Shape', 'Photo', 'Manager', 'Updated', 'Emblem', 'Pattern'];
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
function emtUpsertManager(team, color, shape, photo, manager, emblem, pattern) {
  var sh = emtManagersSheet();
  var last = sh.getLastRow();
  var row = 0;
  if (last > 1) {
    var teams = sh.getRange(2, 1, last - 1, 1).getValues();
    for (var i = 0; i < teams.length; i++) if (String(teams[i][0]) === team) { row = i + 2; break; }
  }
  if (!row) row = last + 1;
  if (sh.getLastColumn() < EMT_MGR_HEAD.length) sh.getRange(1, 1, 1, EMT_MGR_HEAD.length).setValues([EMT_MGR_HEAD]);
  sh.getRange(row, 1, 1, EMT_MGR_HEAD.length).setValues([[team, color, shape, photo, manager, "'" + new Date().toISOString(), emblem || '', pattern || '']]);
}

function emtHandle(req) {
  req = req || {};
  var action = String(req.action || '');
  var team = String(req.team || '').trim();
  var pin = String(req.pin || '');

  if (action === 'status') return { ok: true, claimed: emtClaimed() };
  if (action === 'refresh') return emtRefresh();

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
    if (action === 'reset') { emtUpsertManager(team, '', '', '', '', '', ''); return { ok: true }; }
    var color = String(req.color || ''), shape = String(req.shape || ''), photo = String(req.photo || '');
    if (color && EMT_PALETTE.indexOf(color) < 0 && !/^#[0-9a-fA-F]{6}$/.test(color)) return { ok: false, error: 'badcolor' };
    var pattern = String(req.pattern || '');
    if (EMT_PATTERNS.indexOf(pattern) < 0) return { ok: false, error: 'badpattern' };
    if (shape && EMT_SHAPES.indexOf(shape) < 0) return { ok: false, error: 'badshape' };
    if (photo && (photo.indexOf('data:image/jpeg;base64,') !== 0 || photo.length > EMT_PHOTO_MAX)) return { ok: false, error: 'badphoto' };
    var emblem = String(req.emblem || '');
    if (EMT_EMBLEMS.indexOf(emblem) < 0) return { ok: false, error: 'bademblem' };
    var manager = String(req.manager || '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40);
    emtUpsertManager(team, color, shape, photo, manager, emblem, pattern);
    return { ok: true };
  }

  if (action === 'social') {
    if (!emtVerify(team, req.token)) return { ok: false, error: 'auth' };
    return emtSocial(team, req);
  }

  if (action === 'showfacts') {          // v3.12: the facts the Gameweek Show is written from (signed-in managers only)
    if (!emtVerify(team, req.token)) return { ok: false, error: 'auth' };
    return emtShowFacts(team, req);
  }

  return { ok: false, error: 'unknown action' };
}

/* ---------- v3.8 · the social log: quotes, reactions, poll votes ---------- */
var EMT_SOCIAL_HEAD = ['When (UTC)', 'Team', 'Kind', 'Target', 'Value', 'Extra'];
var EMT_REACTIONS = ['fire', 'laugh', 'clown', 'eyes', 'bin'];
var EMT_SOCIAL_RATE = 40;              // writes per manager per minute

function emtSocialSheet() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName('Social');
  if (!sh) { sh = ss.insertSheet('Social'); sh.getRange(1, 1, 1, EMT_SOCIAL_HEAD.length).setValues([EMT_SOCIAL_HEAD]); sh.setFrozenRows(1); }
  else if (sh.getLastRow() < 1) sh.getRange(1, 1, 1, EMT_SOCIAL_HEAD.length).setValues([EMT_SOCIAL_HEAD]);
  return sh;
}
/* nothing a manager sends can become a formula */
function emtCell(v) { v = String(v == null ? '' : v); return /^[=+\-@]/.test(v) ? "'" + v : v; }
function emtClean(t, max) { return String(t || '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max); }
/* the gameweek's deadline from the Matchweeks tab, as ms (0 when unknown) */
function emtDeadlineMs(gw) {
  var sh = SpreadsheetApp.getActive().getSheetByName('Matchweeks');
  if (!sh || sh.getLastRow() < 2) return 0;
  var v = sh.getRange(1, 1, sh.getLastRow(), 2).getValues();
  for (var i = 1; i < v.length; i++) if (Number(v[i][0]) === gw) { var t = Date.parse(String(v[i][1]).replace(/^'/, '')); return isNaN(t) ? 0 : t; }
  return 0;
}
var EMT_RESERVED_KINDS = ['delete', 'remove', 'admin', 'auth', 'claim', 'reset', 'note', 'ai'];
var EMT_RUMOURS_PER_DAY = 3;
function emtSocial(team, req) {
  var kind = String(req.kind || ''), target = emtClean(req.target, 160), value = emtClean(req.value, 40);
  if (!/^[a-z]{3,12}$/.test(kind) || EMT_RESERVED_KINDS.indexOf(kind) > -1) return { ok: false, error: 'badkind' };
  if (!target) return { ok: false, error: 'badtarget' };
  if ((kind === 'rumour' || kind === 'pass') && !/^r:[a-z0-9]{4,20}$/.test(target)) return { ok: false, error: 'badtarget' };
  var cache = CacheService.getScriptCache(), rk = 'EMT_RL_' + team, n = Number(cache.get(rk) || 0);
  if (n >= EMT_SOCIAL_RATE) return { ok: false, error: 'slow' };
  cache.put(rk, String(n + 1), 60);
  var extra = '';
  var gwm = /^(?:q|qr|poll):(\d+)/.exec(target), gw = gwm ? Number(gwm[1]) : 0;
  if (kind === 'quote' || kind === 'vote') {
    if (!gw) return { ok: false, error: 'badtarget' };
    var dl = emtDeadlineMs(gw);
    if (dl && Date.now() > dl) return { ok: false, error: 'closed' };
  }
  if (kind === 'react') {
    if (EMT_REACTIONS.indexOf(value) < 0) return { ok: false, error: 'badvalue' };
    extra = (String(req.extra) === '0' || String(req.extra) === 'off') ? 'off' : 'on';   // words, not 1/0: a mixed number/text column reads back empty
  } else if (kind === 'vote') {
    if (['h', 'd', 'a'].indexOf(value) < 0) return { ok: false, error: 'badvalue' };
  } else if (kind === 'rumour' || kind === 'pass') {
    var rx;
    try { rx = JSON.parse(String(req.extra || '{}')) || {}; } catch (e) { return { ok: false, error: 'badextra' }; }
    if (kind === 'rumour') {
      var rt = emtClean(rx.text, 160);
      if (!rt) return { ok: false, error: 'empty' };
      value = '';
      extra = JSON.stringify({ text: rt, about: emtClean(rx.about, 60), anon: rx.anon !== false });
    } else {
      if (['confirm', 'deny', 'twist'].indexOf(value) < 0) return { ok: false, error: 'badvalue' };
      var pt = emtClean(rx.text, 140);
      if (value === 'twist' && !pt) return { ok: false, error: 'empty' };
      extra = JSON.stringify({ text: value === 'twist' ? pt : '' });
    }
  } else if (kind !== 'quote') {
    /* a kind this version doesn't know yet: kept as plain cleaned text */
    extra = emtClean(req.extra, 300);
  } else {
    var q;
    try { q = JSON.parse(String(req.extra || '{}')); } catch (e) { return { ok: false, error: 'badextra' }; }
    var line = emtClean(q.line, 140);
    if (!line) return { ok: false, error: 'empty' };
    var claim = q.claim && typeof q.claim === 'object' ? q.claim : null;
    if (claim) { var c = {}; Object.keys(claim).slice(0, 8).forEach(function (k) { c[emtClean(k, 12)] = typeof claim[k] === 'number' ? claim[k] : emtClean(claim[k], 60); }); claim = c; }
    var pr = Number(q.p); pr = isFinite(pr) ? Math.max(0, Math.min(1, Math.round(pr * 1000) / 1000)) : null;
    extra = JSON.stringify({ line: line, claim: claim, p: pr, src: q.src === 'own' ? 'own' : 'pick' });
  }
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sh = emtSocialSheet();
    if (kind === 'quote' || kind === 'rumour' || kind === 'pass') {
      var last = sh.getLastRow(), rows = last > 1 ? sh.getRange(2, 1, last - 1, 4).getValues() : [];
      var tm = function (r) { return String(r[1]); }, kd = function (r) { return String(r[2]); }, tg = function (r) { return String(r[3]).replace(/^'/, ''); };
      if (kind === 'quote') {           // one quote per manager per target: the first one stands
        for (var i = 0; i < rows.length; i++) if (tm(rows[i]) === team && kd(rows[i]) === 'quote' && tg(rows[i]) === target) return { ok: false, error: 'already' };
      } else if (kind === 'rumour') {   // three a day, and an id can only be used once
        var today = new Date().toISOString().slice(0, 10), mine = 0;
        for (var j = 0; j < rows.length; j++) {
          if (kd(rows[j]) !== 'rumour') continue;
          if (tg(rows[j]) === target) return { ok: false, error: 'already' };
          if (tm(rows[j]) === team && String(rows[j][0]).replace(/^'/, '').slice(0, 10) === today) mine++;
        }
        if (mine >= EMT_RUMOURS_PER_DAY) return { ok: false, error: 'toomany' };
      } else {                          // pass: the rumour exists, it isn't yours, and you only pass it once
        var by = null;
        for (var k = 0; k < rows.length; k++) if (kd(rows[k]) === 'rumour' && tg(rows[k]) === target) { by = tm(rows[k]); break; }
        if (!by) return { ok: false, error: 'norumour' };
        if (by === team) return { ok: false, error: 'yours' };
        for (var m = 0; m < rows.length; m++) if (kd(rows[m]) === 'pass' && tm(rows[m]) === team && tg(rows[m]) === target) return { ok: false, error: 'already' };
      }
    }
    var at = new Date().toISOString();
    sh.appendRow(["'" + at, emtCell(team), kind, emtCell(target), emtCell(value), emtCell(extra)]);
    return { ok: true, at: at };
  } finally { lock.releaseLock(); }
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
  try {
    if (e && e.parameter && e.parameter.show) return emtOut(emtShowGet(e.parameter.show, e.parameter.meta));   // v3.11 the Gameweek Show; v3.12 &meta=1
    return emtOut({ ok: true, service: 'emt', claimed: emtClaimed() });
  }
  catch (err) { return emtOut({ ok: false, error: String((err && err.message) || err) }); }
}

/* commissioner: run from the editor with the exact team name, e.g. adminResetPin('Team Jacob') */
function adminResetPin(team) {
  var p = emtProps();
  p.deleteProperty('EMT_PIN_' + team);
  p.deleteProperty('EMT_FAIL_' + team);
  Logger.log('PIN + lockout cleared for ' + team + ' — they can re-claim from the app.');
}

/* =====================================================================================================
 * v3.9 · THE AI WRITER — Claude writes posts for the Feed when something happens, and remembers.
 *   Off until you add an Anthropic API key (Project Settings → Script Properties → ANTHROPIC_API_KEY),
 *   then run installAiTrigger() once (or the menu item). Every 15 minutes aiTick() looks for:
 *     · new press-conference quotes worth a reaction       → one post for the lot (v3.10)
 *     · a gameweek that has just finished                  → two posts: the booth and the terrace
 *     · the build-up (the last 30 hours before a deadline) → one post per gameweek, voices take turns
 *     · a rumour passed on with a twist (the rumour mill)  → one retelling
 *   Each post goes into the Posts tab, which the app shows in the Feed and which is the writer's memory:
 *   the next prompt includes earlier posts and quotes about the same clubs, plus any 'note' rows (running jokes,
 *   storylines), so the voices can call back. Guardrails: every number in a post must appear in the facts or the
 *   memory it was given, otherwise the post is dropped. At most 2 posts a run and 6 a day: fewer, better posts.
 *   Optional Script Properties: EMT_AI_MODEL (default claude-haiku-4-5), EMT_AI_PAUSED = yes to pause.
 * ===================================================================================================== */
var EMT_AI_HEAD = ['When (UTC)', 'Id', 'Voice', 'Kind', 'Event', 'Teams', 'Players', 'Text', 'Facts', 'Media'];
var EMT_AI_MODEL_DEFAULT = 'claude-haiku-4-5';
var EMT_AI_PER_RUN = 2, EMT_AI_PER_DAY = 6;   // v3.10: quality over quantity
var EMT_AI_VOICES = ['archizio', 'clark', 'malcolm'];
var EMT_AI_SYSTEM = [
  'You write short posts for the Feed of Matchweek, the app of El Matador Tire: a private FPL Draft (fantasy Premier League) league of eight friends. Head to head each gameweek: 3 points a win, 1 a draw.',
  'Three fictional voices write the posts. They are not real people:',
  '- archizio: Archizio Poblano, the insider. Every post opens with a caps tag such as EXCLUSIVE. / UNDERSTAND. / HERE WE GO. / DEAL DONE. Dry, clipped, transfer-insider style. Breaks news, frames beefs between managers.',
  '- clark: Clark Moldridge of The Terrace, a loud fan channel. Punchy, exasperated, funny. Roasts managers for bad calls, loves receipts. His posts are video thumbnails, so also give "thumb": {"t1": big caps line, max 18 characters, "t2": second caps line, max 22, "lo": caps strap, max 22}.',
  '- malcolm: Malcolm Tyre in the booth, a broadcaster. Measured, wry, sets the scene.',
  'Rules:',
  '1. Every number you write must appear in FACTS or MEMORY. Never invent a stat, score, odds, record or date.',
  '2. Only quote managers, word for word, from FACTS or MEMORY. Never invent quotes. Never quote or name real journalists, pundits or YouTubers. Real footballers only as players in someone\'s team.',
  '3. Banter is about this fantasy league only: picks, benchings, results, quotes, form, the table. Nothing about anyone\'s looks, family, health, money, job, relationships or life outside the league. No slurs, no swearing.',
  '4. At most 240 characters per post. British spelling. No emoji, no hashtags, no em dashes.',
  '5. Call managers by the first name or team name given in FACTS. Describe a club\'s place in the table only as FACTS shows it (pos 1 is top); never guess who leads.',
  '6. If MEMORY has a related earlier post, quote or note, call back to it (a receipt, a running joke) without repeating it. Never repeat an angle MEMORY already used.',
  '7. Each post takes a different angle. Answer with JSON only: {"posts":[{"voice":"...","text":"...","teams":["exact team names"],"thumb":{...}}]}',
  '8. Fewer, better posts. The app already posts the plain facts (results, the table, deals), so only write what a sharp friend in the group chat would: a storyline, a receipt, a callback, a joke that lands. If nothing is worth it, return {"posts":[]}. Never pad.',
  '9. Rumours come from the rumour mill: managers make them up or pass them on. Always present one as a rumour (hearing, apparently, word is), never as fact, and never say who started or passed it unless FACTS names them.'
].join('\n');

function emtAiKey() { return emtProps().getProperty('ANTHROPIC_API_KEY') || ''; }
function emtAiOn() { return !!emtAiKey() && emtProps().getProperty('EMT_AI_PAUSED') !== 'yes'; }
function installAiTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'aiTick') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('aiTick').timeBased().everyMinutes(15).create();
  Logger.log(emtAiKey() ? 'AI writer on: aiTick every 15 minutes.' : 'Trigger installed, but add ANTHROPIC_API_KEY in Script Properties before it writes anything.');
  Logger.log(emtShowKey() ? 'Gameweek Show on: same trigger.' : 'Gameweek Show off until ELEVENLABS_API_KEY is set in Script Properties.');   // v3.11
  Logger.log('The show writer and the hourly Code.gs self-update ride the same trigger.');   // v3.12
}
function aiPause() { emtProps().setProperty('EMT_AI_PAUSED', 'yes'); }
function aiResume() { emtProps().deleteProperty('EMT_AI_PAUSED'); }

/* a tab as objects keyed by its header row */
function emtRows(name) {
  var sh = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sh || sh.getLastRow() < 2) return [];
  var v = sh.getDataRange().getValues(), h = v[0].map(String);
  return v.slice(1).map(function (r) { var o = {}; h.forEach(function (k, i) { var x = r[i]; o[k] = x instanceof Date ? x.toISOString() : (x === null || x === undefined ? '' : x); }); return o; });
}
function emtPostsSheet() {
  var ss = SpreadsheetApp.getActive(), sh = ss.getSheetByName('Posts');
  if (!sh) { sh = ss.insertSheet('Posts'); sh.getRange(1, 1, 1, EMT_AI_HEAD.length).setValues([EMT_AI_HEAD]); sh.setFrozenRows(1); }
  return sh;
}
function aiState() { try { return JSON.parse(emtProps().getProperty('EMT_AI_STATE') || '{}'); } catch (e) { return {}; } }
function aiSaveState(s) { emtProps().setProperty('EMT_AI_STATE', JSON.stringify(s)); }
var aiTs = function (v) { var t = Date.parse(String(v || '').replace(/^'/, '')); return isNaN(t) ? 0 : t; };

/* ---------- the league, as facts ---------- */
function aiLeague() {
  var st = emtRows('Standings'), fx = emtRows('H2H Fixtures'), mw = emtRows('Matchweeks');
  var mgr = {}; st.forEach(function (s) { mgr[s.Team] = String(s.Manager || ''); });
  var first = function (t) { return String(mgr[t] || t).split(' ')[0]; };
  var table = st.slice().sort(function (a, b) { return Number(b['League Pts']) - Number(a['League Pts']) || Number(b['Pts For']) - Number(a['Pts For']); })
    .map(function (s, i) { return { pos: i + 1, team: s.Team, manager: first(s.Team), w: Number(s.W), d: Number(s.D), l: Number(s.L), pts: Number(s['League Pts']), pf: Number(s['Pts For']), pa: Number(s['Pts Against']) }; });
  var done = mw.filter(function (w) { return String(w.Finished).toUpperCase() === 'TRUE'; }).map(function (w) { return Number(w.GW); });
  var lastDone = done.length ? Math.max.apply(null, done) : 0;
  var form = {}; table.forEach(function (t) { form[t.team] = []; });
  fx.filter(function (f) { return String(f.Finished).toUpperCase() === 'TRUE'; }).sort(function (a, b) { return Number(a.GW) - Number(b.GW); }).forEach(function (f) {
    var h = Number(f['Home pts']), a = Number(f['Away pts']);
    if (form[f.Home]) form[f.Home].push(h > a ? 'W' : h < a ? 'L' : 'D');
    if (form[f.Away]) form[f.Away].push(a > h ? 'W' : a < h ? 'L' : 'D');
  });
  table.forEach(function (t) { t.last3 = (form[t.team] || []).slice(-3).join(''); });
  return { table: table, fx: fx, mw: mw, lastDone: lastDone, first: first };
}
function aiResults(L, gw) {
  return L.fx.filter(function (f) { return Number(f.GW) === gw && String(f.Finished).toUpperCase() === 'TRUE'; })
    .map(function (f) { return { home: f.Home, away: f.Away, score: Number(f['Home pts']) + '-' + Number(f['Away pts']) }; });
}
function aiStars(gw, n, started) {
  return emtRows('GW Log').filter(function (r) { return Number(r.GW) === gw && String(r.Started) === started; })
    .sort(function (a, b) { return Number(b['GW pts']) - Number(a['GW pts']); }).slice(0, n)
    .map(function (r) { return { player: r.Player, team: r.Team, pts: Number(r['GW pts']) }; });
}
function aiQuotes(teams, sinceGw) {
  return emtRows('Social').filter(function (r) { return r.Kind === 'quote' && (!teams || teams.indexOf(r.Team) > -1); }).map(function (r) {
    var x = {}; try { x = JSON.parse(r.Extra || '{}'); } catch (e) { }
    var m = /^(q|qr):(\d+)(?::(.+))?$/.exec(String(r.Target)) || [];
    return { team: r.Team, gw: Number(m[2] || 0), answering: m[3] || null, said: x.line || '', calling: x.claim ? x.claim : null, model: x.p != null ? Math.round(x.p * 100) + '%' : null };
  }).filter(function (q) { return q.said && (!sinceGw || q.gw >= sinceGw); });
}

/* ---------- what happened since last time ---------- */
/* the latest deadline that has passed (ms), or 0 */
function aiPrevDeadline(L, now) {
  var best = 0;
  L.mw.forEach(function (w) { var t = aiTs(w['Deadline (UTC)']); if (t && t <= now && t > best) best = t; });
  return best;
}
function aiEvents(S) {
  var L = aiLeague(), out = [], now = Date.now(), soc = emtRows('Social');
  var parse = function (r) { try { return JSON.parse(r.Extra || '{}') || {}; } catch (e) { return {}; } };
  /* 1. new quotes worth a reaction, batched into one post: a call, the manager's own words, or an answer to someone */
  if (S.socialAt === undefined) S.socialAt = aiPrevDeadline(L, now) || now;   /* first run: this gameweek's quotes */
  var fresh = soc.filter(function (r) { return r.Kind === 'quote' && aiTs(r['When (UTC)']) > S.socialAt; });
  var worth = fresh.map(function (r) {
    var x = parse(r), m = /^(q|qr):(\d+)(?::(.+))?$/.exec(String(r.Target)) || [], gw = Number(m[2] || 0);
    var f = L.fx.filter(function (z) { return Number(z.GW) === gw && (z.Home === r.Team || z.Away === r.Team); })[0];
    return { at: aiTs(r['When (UTC)']), team: r.Team, manager: L.first(r.Team), said: emtClean(x.line, 140), calling: x.claim || null, own_words: x.src === 'own',
      model_chance: x.p != null ? Math.round(x.p * 100) + '%' : null, gameweek: gw, answering: m[3] || null, opponent: f ? (f.Home === r.Team ? f.Away : f.Home) : null };
  }).filter(function (q) { return q.said && (q.calling || q.own_words || q.answering); });
  if (worth.length) {
    var qt = []; worth.forEach(function (q) { [q.team, q.opponent, q.answering].forEach(function (t) { if (t && qt.indexOf(t) < 0) qt.push(t); }); });
    var lastAt = Math.max.apply(null, worth.map(function (q) { return q.at; }));
    out.push({ type: 'quotes', key: 'q:' + lastAt.toString(36), at: lastAt, last: lastAt, teams: qt, n: 1,
      ask: worth.length === 1 ? 'One post about this quote. Use clark if the call is bold (the model gave it under 40%) or it is trash talk, otherwise archizio or malcolm.'
        : 'One post about these quotes, together: pick the best beef or the boldest call and build the post around it. clark for trash talk, archizio for a beef, malcolm for the scene.',
      desc: worth.length === 1 ? worth[0].manager + ' went on the record before GW' + worth[0].gameweek + '.' : worth.length + ' managers went on the record.',
      facts: { quotes: worth.map(function (q) { var o = {}; Object.keys(q).forEach(function (k) { if (k !== 'at' && q[k] !== null && q[k] !== false) o[k] = q[k]; }); return o; }), table: L.table },
      line: 'The quotes, the table' });
  } else if (fresh.length) {
    S.socialAt = Math.max.apply(null, fresh.map(function (r) { return aiTs(r['When (UTC)']); }));   /* nothing worth a post; move on */
  }
  /* 2. a gameweek just finished */
  if (S.doneGw === undefined) S.doneGw = L.lastDone;         /* first run: no backfill */
  if (L.lastDone > S.doneGw) {
    var g = L.lastDone;
    out.push({ type: 'ft', key: 'ft:' + g, gw: g, at: now, teams: L.table.map(function (t) { return t.team; }), n: 2,
      ask: 'Two posts about gameweek ' + g + ' at full time: one malcolm (the story of the week, not a list of scores), one clark (the take everyone will argue about).',
      desc: 'Gameweek ' + g + ' has finished.',
      facts: { gameweek: g, results: aiResults(L, g), top_scorers_started: aiStars(g, 4, 'XI'), best_on_benches: aiStars(g, 2, 'BEN'), table_now: L.table, quotes_before_this_gameweek: aiQuotes(null, g) },
      line: 'H2H Fixtures, GW Log and the table after GW' + g });
  }
  /* 3. the build-up: one post per gameweek, in the last 30 hours before the deadline */
  var next = L.mw.filter(function (w) { return String(w.Finished).toUpperCase() !== 'TRUE'; }).sort(function (a, b) { return Number(a.GW) - Number(b.GW); })[0];
  if (next) {
    var dl = aiTs(next['Deadline (UTC)']), gwN = Number(next.GW);
    if (S.buildGw !== gwN && emtRows('Posts').some(function (r) { return String(r.Id).indexOf('ai:bu:' + gwN + ':') === 0; })) S.buildGw = gwN;   /* v3.9 already wrote it */
    if (dl > now && dl - now < 30 * 3600e3 && S.buildGw !== gwN) {
      var pos = {}; L.table.forEach(function (t) { pos[t.team] = t.pos; });
      var fxs = L.fx.filter(function (z) { return Number(z.GW) === gwN; }).map(function (z) { return { home: z.Home, home_table_pos: pos[z.Home], away: z.Away, away_table_pos: pos[z.Away] }; });
      var v = EMT_AI_VOICES[gwN % 3];
      var flags = emtRows('Rosters').filter(function (p) { return (p.Status === 'd' || p.Status === 'i') && String(p['GW XI'] || p['Best XI']) === 'XI'; })
        .slice(0, 8).map(function (p) { return { player: p.Player, team: p.Team, news: String(p.News || '') }; });
      out.push({ type: 'build', key: 'bu:' + gwN, gw: gwN, at: now, teams: L.table.map(function (t) { return t.team; }), n: 1,
        ask: 'One ' + v + ' post for the build-up to gameweek ' + gwN + '. Pick the single best storyline in the facts and memory.',
        desc: 'Gameweek ' + gwN + ' deadline is coming.',
        facts: { gameweek: gwN, fixtures: fxs, table: L.table, flagged_starters: flags, quotes_this_gameweek: aiQuotes(null, gwN) },
        line: 'Fixtures, the table, injury news' });
    }
  }
  /* 4. the rumour mill: a rumour passed on with a twist gets retold (the starter stays anonymous unless they signed it) */
  if (S.rumourAt === undefined) S.rumourAt = now;            /* first run: no backfill */
  var R = {};
  soc.forEach(function (r) {
    var id = String(r.Target);
    if (r.Kind === 'rumour' && !R[id]) { var x = parse(r); if (x.text) R[id] = { id: id, by: r.Team, text: emtClean(x.text, 160), about: x.about || null, anon: x.anon !== false, tw: [], c: 0, d: 0, seen: {} }; }
  });
  soc.forEach(function (r) {
    var g2 = R[String(r.Target)]; if (r.Kind !== 'pass' || !g2 || r.Team === g2.by || g2.seen[r.Team]) return;
    g2.seen[r.Team] = 1;
    var x = parse(r), at = aiTs(r['When (UTC)']);
    if (r.Value === 'confirm') g2.c++; else if (r.Value === 'deny') g2.d++;
    else if (r.Value === 'twist' && x.text) g2.tw.push({ text: emtClean(x.text, 140), at: at });
  });
  Object.keys(R).forEach(function (id) {
    var g3 = R[id], tw = g3.tw.filter(function (t) { return t.at > S.rumourAt; });
    if (!tw.length) return;
    var at = Math.max.apply(null, tw.map(function (t) { return t.at; }));
    var facts = { rumour: { about: g3.about, first_heard: g3.text, versions_since: g3.tw.map(function (t) { return t.text; }), now_hearing: g3.tw[g3.tw.length - 1].text, times_passed_on: g3.tw.length, confirms: g3.c, denies: g3.d }, table: L.table };
    if (!g3.anon) facts.rumour.started_by = L.first(g3.by);
    out.push({ type: 'rumour', key: 'rm:' + id.slice(2) + ':' + g3.tw.length, at: at, teams: g3.about ? [g3.about] : [], n: 1,
      ask: 'One clark post: the rumour mill is a game of telephone. Retell how this rumour changed as it was passed on, from what was first heard to what people are saying now. It is a rumour, not a fact.',
      desc: 'A rumour is going round El Matador Tire and it just changed again.',
      facts: facts, line: 'The rumour mill' });
  });
  return out;
}

/* ---------- memory: earlier posts and quotes about the same clubs, and the notes ---------- */
function aiMemory(ev) {
  var rows = emtRows('Posts'), notes = rows.filter(function (r) { return r.Kind === 'note'; }).slice(-8);
  var posts = rows.filter(function (r) { return r.Kind === 'ai'; });
  var rel = posts.filter(function (r) { var t = String(r.Teams || '').split('|'); return ev.teams.some(function (x) { return t.indexOf(x) > -1; }); }).slice(-10);
  var recent = posts.slice(-4).filter(function (r) { return rel.indexOf(r) < 0; });
  var lines = [];
  notes.forEach(function (r) { lines.push('[note] ' + r.Text); });
  rel.concat(recent).forEach(function (r) { lines.push('[' + String(r['When (UTC)']).slice(0, 10) + ' ' + r.Voice + '] ' + r.Text); });
  aiQuotes(ev.teams.length <= 3 ? ev.teams : null, 0).slice(-8).forEach(function (q) { lines.push('[quote GW' + q.gw + '] ' + q.team + ': "' + q.said + '"' + (q.calling ? ' (calling ' + JSON.stringify(q.calling) + (q.model ? ', model ' + q.model : '') + ')' : '')); });
  return lines.join('\n');
}

/* ---------- one call to Claude, checked before anything is kept ---------- */
function aiWrite(ev) {
  var mem = aiMemory(ev), facts = JSON.stringify(ev.facts);
  var user = 'EVENT: ' + ev.desc + '\nWRITE: ' + ev.ask + '\n\nFACTS (the only numbers you may use):\n' + facts + '\n\nMEMORY (earlier posts, quotes and notes):\n' + (mem || '(nothing yet)');
  var res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { 'x-api-key': emtAiKey(), 'anthropic-version': '2023-06-01' },
    payload: JSON.stringify({ model: emtProps().getProperty('EMT_AI_MODEL') || EMT_AI_MODEL_DEFAULT, max_tokens: 900, system: EMT_AI_SYSTEM, messages: [{ role: 'user', content: user }] })
  });
  var code = res.getResponseCode(), body = res.getContentText();
  if (code !== 200) throw new Error('Claude API ' + code + ': ' + body.slice(0, 200));
  var j = JSON.parse(body), txt = ((j.content || []).filter(function (c) { return c.type === 'text'; })[0] || {}).text || '';
  var m = txt.match(/\{[\s\S]*\}/); if (!m) return [];
  var out = (JSON.parse(m[0]).posts || []).slice(0, ev.n);
  var allowed = facts + '\n' + mem, teams = aiLeague().table.map(function (t) { return t.team; });
  var numsOk = function (s) { return (String(s).match(/\d+(?:\.\d+)?/g) || []).every(function (n) { return allowed.indexOf(n) > -1; }); };
  return out.map(function (p) {
    var voice = String(p.voice || '').toLowerCase(), text = emtClean(p.text, 300).replace(/—/g, ',');
    if (EMT_AI_VOICES.indexOf(voice) < 0 || text.length < 15 || !numsOk(text)) { Logger.log('AI post dropped: ' + JSON.stringify(p)); return null; }
    var th = null;
    if (voice === 'clark' && p.thumb && p.thumb.t1) {
      th = { t1: emtClean(p.thumb.t1, 22).toUpperCase(), t2: emtClean(p.thumb.t2, 26).toUpperCase(), lo: emtClean(p.thumb.lo, 26).toUpperCase() };
      if (!numsOk(th.t1 + ' ' + th.t2 + ' ' + th.lo)) th = null;
    }
    return { voice: voice, text: text, teams: (p.teams || []).filter(function (t) { return teams.indexOf(t) > -1; }).slice(0, 4), thumb: th };
  }).filter(Boolean);
}

/* v3.11: the 15-minute trigger runs the AI writer, then the Gameweek Show. Each runs on its own: the show runs even
 * when the writer is off, and a show failure is logged, never thrown. A writer error is still thrown (after the show
 * has had its turn) so failed runs keep showing up as before. The writer holds the script lock only while it writes;
 * the show takes its own flag (emtShowClaim) and never holds the script lock while it renders.
 * v3.12: four parts, in this order, each in its own try/catch: the AI writer, the show writer (writes the script),
 * the show (voices it), the self-update (at most hourly). Only an AI writer error is thrown, after all four ran. */
function aiTick() {
  var t0 = Date.now(), err = null;
  try { aiWriterTick(); } catch (e) { err = e; Logger.log('AI writer failed: ' + ((e && e.message) || e)); }
  try { showWriterTick(t0); } catch (e) { Logger.log('Show writer failed: ' + ((e && e.message) || e)); }
  try { showTick(t0); } catch (e) { Logger.log('Gameweek Show failed: ' + ((e && e.message) || e)); }
  try { selfUpdateTick(t0); } catch (e) { Logger.log('Self-update failed: ' + ((e && e.message) || e)); }
  if (err) throw err;
}

function aiWriterTick() {
  if (!emtAiOn()) return;
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;
  try {
    var S = aiState(), day = new Date().toISOString().slice(0, 10);
    if (S.day !== day) { S.day = day; S.count = 0; }
    aiSeedNotes();
    var evs = aiEvents(S).sort(function (a, b) { return a.at - b.at; }), made = 0, sh = emtPostsSheet();
    for (var i = 0; i < evs.length; i++) {
      var ev = evs[i];
      if (made + ev.n > EMT_AI_PER_RUN || S.count + ev.n > EMT_AI_PER_DAY) break;   /* the rest waits for the next run */
      var posts = [];
      try { posts = aiWrite(ev); } catch (e) { Logger.log('AI writer: ' + e); break; }   /* try again next run */
      posts.forEach(function (p, k) {
        var media = p.thumb ? JSON.stringify({ type: 'thumb', t1: p.thumb.t1, t2: p.thumb.t2, lo: p.thumb.lo, team: p.teams[0] || '' }) : '';
        sh.appendRow(["'" + new Date().toISOString(), emtCell('ai:' + ev.key + ':' + k), p.voice, 'ai', emtCell(ev.key), emtCell(p.teams.join('|')), '', emtCell(p.text), emtCell(ev.line), emtCell(media)]);
      });
      made += posts.length; S.count += posts.length;
      if (ev.type === 'quotes') S.socialAt = Math.max(S.socialAt || 0, ev.last);
      if (ev.type === 'ft') S.doneGw = ev.gw;
      if (ev.type === 'build') S.buildGw = ev.gw;
      if (ev.type === 'rumour') S.rumourAt = Math.max(S.rumourAt || 0, ev.at);
    }
    aiSaveState(S);
  } finally { lock.releaseLock(); }
}
/* running jokes and storylines the writer should know about (rows with Kind 'note' are memory only, never shown) */
function aiSeedNotes() {
  var sh = emtPostsSheet(), rows = emtRows('Posts');
  if (rows.some(function (r) { return r.Id === 'note:baha-files'; })) return;
  sh.appendRow(["'" + new Date().toISOString(), 'note:baha-files', 'archizio', 'note', 'storyline', 'Kobbie Mainoo Fan', '',
    'Running joke since 7 Oct: Archizio broke a satirical story that UEFA and FPL are investigating Kobbie Mainoo Fan\'s finances (Manchester City comparisons), and Clark ran a video called The Baha Files. The league has a market named after Baha finishing last, yet his team went top after GW5.', 'Commissioner note', '']);
}

/* =====================================================================================================
 * v3.11 · THE GAMEWEEK SHOW — the ~2 minute narrated preview, voiced by ElevenLabs from here.
 *   The script lives in the app repo as show/gw<N>.json:
 *     { gw, voice, model, speed, open, chapters: [{ home, away, beats: [...] }], close }
 *   Clips, in play order: 'open', then 'c<i>b<j>' (i = chapter from 1, j = beat from 0), then 'close'.
 *   Off until ELEVENLABS_API_KEY is set (Project Settings → Script Properties; create the key at elevenlabs.io →
 *   Developers → API keys, with Text to Speech access). Optional Script Properties: EMT_VOICE_ID, EMT_TTS_MODEL,
 *   EMT_SHOW_PAUSED = yes (pauses the automatic runs; the menu item still works).
 *   Each clip carries an MD5 of text|voice|model|speed, so editing one line re-renders that line only, and a line
 *   cut from the script loses its rows. A failed call keeps the old audio and stops the run (no burnt credits).
 *   Storage: hidden ShowAudio tab, one row per 45,000-character chunk of base64 mp3 (44.1 kHz, 64 kbps), every
 *   Data cell marked 'b64:' so it can never start a formula. Secs = bytes / 8000.
 *   Serving: GET <web app>?show=<gw> → { ok, gw, clips: { key: { secs, hash, b64 } }, complete, script }.
 *   v3.12: when the repo has no show/gw<N>.json (404), the script the show writer kept in ShowScripts is voiced
 *   instead (the repo always wins). "script" is that json (repo, else ShowScripts, else null); &meta=1 drops b64.
 *   Runs: showTick() from aiTick (every 15 minutes) for the next unfinished gameweek; renderShowNow() from the menu;
 *   renderShow(gw) and showStatus(gw) from the editor.
 *   QUOTA: an idle run is one GitHub fetch plus a read of six narrow columns, about 1 s (96 a day ≈ 2 min of the
 *   90 min trigger allowance). A whole show (~22 clips) is ~22 ElevenLabs calls, a minute or two, once per gameweek;
 *   a run stops starting new clips after 4.5 minutes and the next run picks up the rest.
 * ===================================================================================================== */
var EMT_SHOW_HEAD = ['GW', 'Clip', 'Hash', 'Part', 'Parts', 'Secs', 'Data', 'Rendered (UTC)'];
var EMT_SHOW_URL = 'https://parkerno2.github.io/el-matador-tire/show/gw';
var EMT_SHOW_TTS = 'https://api.elevenlabs.io/v1/text-to-speech/';
var EMT_SHOW_VOICE_DEFAULT = 'e2v8SRwGUU8TdMFPuDlV';
var EMT_SHOW_MODEL_DEFAULT = 'eleven_multilingual_v2';
var EMT_SHOW_CHUNK = 45000;            // characters per Data cell (cells cap at 50,000)
var EMT_SHOW_BUDGET_MS = 270 * 1000;   // no new clip after 4.5 min; Apps Script stops every run at 6
var EMT_SHOW_BUSY_MS = 390 * 1000;     // a render flag older than 6.5 min belongs to a run that is already dead
var EMT_SHOW_MARK = 'b64:';

function emtShowKey() { return emtProps().getProperty('ELEVENLABS_API_KEY') || ''; }
function emtShowNoKey(where) {
  Logger.log('Gameweek Show (' + where + '): no ELEVENLABS_API_KEY yet. Add it in Project Settings → Script Properties ' +
    '(create it at elevenlabs.io → Developers → API keys, with Text to Speech access). Nothing rendered.');
}
function emtMd5hex(str) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, String(str), Utilities.Charset.UTF_8);
  return bytes.map(function (b) { b = (b + 256) % 256; return (b < 16 ? '0' : '') + b.toString(16); }).join('');
}
function emtShowExpected(gw) {
  try { var k = JSON.parse(emtProps().getProperty('EMT_SHOW_KEYS_' + gw) || 'null'); return k && k.length ? k : null; } catch (e) { return null; }
}

/* the next unfinished gameweek in Matchweeks (lowest GW whose Finished is not TRUE), or 0 */
function emtShowNextGw() {
  var next = emtRows('Matchweeks').filter(function (w) { return Number(w.GW) > 0 && String(w.Finished).toUpperCase() !== 'TRUE'; })
    .sort(function (a, b) { return Number(a.GW) - Number(b.GW); })[0];
  return next ? Number(next.GW) : 0;
}

function emtShowSheet() {
  var ss = SpreadsheetApp.getActive(), sh = ss.getSheetByName('ShowAudio');
  if (!sh) {
    sh = ss.insertSheet('ShowAudio');
    sh.getRange(1, 1, 1, EMT_SHOW_HEAD.length).setValues([EMT_SHOW_HEAD]);
    sh.setFrozenRows(1);
    try { sh.hideSheet(); } catch (e) { }
  }
  return sh;
}

/* one render at a time, without holding the script lock while it renders (app writes and refreshes need that lock) */
function emtShowClaim() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return false;
  try {
    var p = emtProps(), t = Number(p.getProperty('EMT_SHOW_BUSY') || 0), now = Date.now();
    if (t && now - t >= 0 && now - t < EMT_SHOW_BUSY_MS) return false;
    p.setProperty('EMT_SHOW_BUSY', String(now));
    return true;
  } finally { lock.releaseLock(); }
}
function emtShowRelease() { emtProps().deleteProperty('EMT_SHOW_BUSY'); }

/* the show's clips in play order, [{ key, text }]; blank lines are left out */
function emtShowClips(j) {
  var out = [];
  var add = function (key, t) { if (t !== null && t !== undefined && String(t).trim()) out.push({ key: key, text: String(t) }); };
  add('open', j.open);
  (j.chapters || []).forEach(function (c, i) {
    ((c && c.beats) || []).forEach(function (b, k) { add('c' + (i + 1) + 'b' + k, b); });
  });
  add('close', j.close);
  return out;
}

/* what ShowAudio holds for one gameweek, from the six narrow columns (no Data read):
 * { key: { rows: [sheet rows], part: { n: row }, hash, parts, secs, ok } }; ok = every part there exactly once, one hash */
function emtShowIndex(sh, gw) {
  var idx = {}, last = sh.getLastRow();
  if (last < 2) return idx;
  var v = sh.getRange(2, 1, last - 1, 6).getValues();
  for (var i = 0; i < v.length; i++) {
    if (Number(v[i][0]) !== gw) continue;
    var k = String(v[i][1]), h = String(v[i][2]).replace(/^'/, '');
    var c = idx[k] || (idx[k] = { rows: [], part: {}, hashes: {}, hash: '', parts: 0, secs: 0, ok: false });
    c.rows.push(i + 2); c.part[Number(v[i][3])] = i + 2; c.hashes[h] = 1;
    c.hash = h; c.parts = Number(v[i][4]) || 0; c.secs = Number(v[i][5]) || 0;
  }
  Object.keys(idx).forEach(function (k) {
    var c = idx[k], ok = c.parts > 0 && c.rows.length === c.parts && Object.keys(c.hashes).length === 1;
    for (var p = 1; ok && p <= c.parts; p++) if (!c.part[p]) ok = false;
    c.ok = ok;
  });
  return idx;
}

/* contiguous runs of row numbers, ascending: [[start, count], ...] */
function emtShowRuns(rows) {
  rows = rows.slice().sort(function (a, b) { return a - b; });
  var out = [];
  rows.forEach(function (r) { var l = out[out.length - 1]; if (l && r === l[0] + l[1]) l[1]++; else if (!l || r >= l[0] + l[1]) out.push([r, 1]); });
  return out;
}

/* delete sheet rows from the bottom up, one call per run. Sheets refuses to delete every non-frozen row, so when
 * that would happen a blank row goes in at the end first. */
function emtShowDeleteRows(sh, rows) {
  if (!rows.length) return 0;
  try { if (rows.length >= sh.getMaxRows() - 1) sh.insertRowAfter(sh.getMaxRows()); } catch (e) { }
  var runs = emtShowRuns(rows).reverse(), n = 0;
  runs.forEach(function (r) { sh.deleteRows(r[0], r[1]); n += r[1]; });
  return n;
}

/* the base64 of the given clips, chunks joined in Part order, marker stripped. A clip whose rows moved under us
 * (a render running at the same moment) is left out rather than served wrong. */
function emtShowData(sh, gw, idx, keys) {
  var want = {}, parts = {}, bad = {};
  keys.forEach(function (k) { Object.keys(idx[k].part).forEach(function (p) { want[idx[k].part[p]] = [k, Number(p)]; }); });
  emtShowRuns(Object.keys(want).map(Number)).forEach(function (run) {
    sh.getRange(run[0], 1, run[1], 7).getValues().forEach(function (r, d) {
      var w = want[run[0] + d], data = String(r[6]), c = idx[w[0]];
      if (Number(r[0]) !== gw || String(r[1]) !== w[0] || Number(r[3]) !== w[1] || data.indexOf(EMT_SHOW_MARK) !== 0 ||
          String(r[2]).replace(/^'/, '') !== c.hash || Number(r[4]) !== c.parts) { bad[w[0]] = 1; return; }   /* a new take landed on these rows */
      (parts[w[0]] = parts[w[0]] || [])[w[1] - 1] = data.slice(EMT_SHOW_MARK.length);
    });
  });
  var out = {};
  keys.forEach(function (k) { if (!bad[k] && parts[k]) out[k] = parts[k].join(''); });
  return out;
}

/* the show script for a gameweek: { json } | { none: true } on a 404 | { error } */
function emtShowFetch(gw) {
  var res = UrlFetchApp.fetch(EMT_SHOW_URL + gw + '.json?cb=' + Date.now(), { muteHttpExceptions: true });
  var code = res.getResponseCode();
  if (code === 404) return { none: true };
  if (code !== 200) return { error: 'show/gw' + gw + '.json HTTP ' + code };
  try { return { json: JSON.parse(res.getContentText()) }; } catch (e) { return { error: 'show/gw' + gw + '.json does not parse: ' + e }; }
}

/* one ElevenLabs call; prev/next are the neighbouring clips' text, for a natural join */
function emtShowTts(key, voice, model, speed, text, prev, next) {
  var body = { text: text, model_id: model,
    voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0, use_speaker_boost: true, speed: speed } };
  if (prev) body.previous_text = prev;
  if (next) body.next_text = next;
  return UrlFetchApp.fetch(EMT_SHOW_TTS + encodeURIComponent(voice) + '?output_format=mp3_44100_64', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { 'xi-api-key': key, 'Accept': 'audio/mpeg' },
    payload: JSON.stringify(body)
  });
}

/* render every clip of a gameweek's show that is missing or changed. From the editor: renderShow(7); with no
 * gameweek it takes the next unfinished one. startedAt (ms) lets aiTick count the writer's time against the budget. */
function renderShow(gw, startedAt) {
  var t0 = typeof startedAt === 'number' ? startedAt : Date.now();
  gw = Number(gw) > 0 ? Number(gw) : 0;
  var S = { ok: true, gw: gw, clips: 0, rendered: [], kept: 0, removed: [], left: 0, stopped: '' };
  var key = emtShowKey();
  if (!key) { emtShowNoKey('renderShow'); S.ok = false; S.stopped = 'nokey'; return S; }
  if (!gw) gw = S.gw = emtShowNextGw();
  if (!gw) { Logger.log('Gameweek Show: no unfinished gameweek in Matchweeks.'); S.stopped = 'nogw'; return S; }
  if (!emtShowClaim()) { Logger.log('Gameweek Show: another render is running; this run leaves it alone.'); S.stopped = 'busy'; return S; }
  try {
    var f = emtShowScript(gw);                       /* v3.12: the repo's json, else the written one in ShowScripts */
    if (f.none) { S.stopped = 'noscript'; Logger.log(emtShowSummary(S)); return S; }
    if (f.source) S.source = f.source;
    if (f.error) { S.ok = false; S.stopped = 'error'; S.error = f.error; Logger.log(emtShowSummary(S)); return S; }
    var j = f.json || {}, clips = emtShowClips(j), p = emtProps();
    var voice = p.getProperty('EMT_VOICE_ID') || EMT_SHOW_VOICE_DEFAULT;
    var model = p.getProperty('EMT_TTS_MODEL') || j.model || EMT_SHOW_MODEL_DEFAULT;
    var speed = Number(j.speed) || 1;
    S.clips = clips.length;
    if (!clips.length) { S.stopped = 'empty'; Logger.log(emtShowSummary(S)); return S; }
    p.setProperty('EMT_SHOW_KEYS_' + gw, JSON.stringify(clips.map(function (c) { return c.key; })));
    var live = {};
    clips.forEach(function (c) { c.hash = emtMd5hex(c.text + '|' + voice + '|' + model + '|' + speed); live[c.key] = 1; });
    var sh = emtShowSheet(), idx = emtShowIndex(sh, gw);
    /* lines cut from the script lose their rows */
    var gone = [];
    Object.keys(idx).forEach(function (k) { if (!live[k]) { S.removed.push(k); gone = gone.concat(idx[k].rows); } });
    if (gone.length) { emtShowDeleteRows(sh, gone); idx = emtShowIndex(sh, gw); }
    for (var i = 0; i < clips.length; i++) {
      var c = clips[i], have = idx[c.key];
      if (have && have.ok && have.hash === c.hash) { S.kept++; continue; }
      if (S.stopped) continue;                        /* halted: the rest are only counted */
      if (Date.now() - t0 > EMT_SHOW_BUDGET_MS) { S.stopped = 'time'; continue; }
      var res = emtShowTts(key, voice, model, speed, c.text, i > 0 ? clips[i - 1].text : '', i < clips.length - 1 ? clips[i + 1].text : '');
      var code = res.getResponseCode(), bytes = code === 200 ? res.getContent() : null;
      if (code !== 200 || !bytes || !bytes.length) {
        var body = String(res.getContentText() || '').slice(0, 300);
        S.ok = false; S.stopped = 'http ' + code;
        S.error = code === 402 || /quota|credits/i.test(body) ? 'out of credits: top up at elevenlabs.io or wait for the monthly reset'
          : code === 401 ? 'the API key is wrong or lacks Text to Speech permission (elevenlabs.io → Developers → API keys)'
          : code === 200 ? 'ElevenLabs sent no audio' : 'ElevenLabs refused the request';
        Logger.log('Gameweek Show: ElevenLabs HTTP ' + code + ' on ' + c.key + ', ' + S.error + '. Body: ' + body);
        continue;                                     /* no more calls this run */
      }
      var b64 = Utilities.base64Encode(bytes), n = Math.ceil(b64.length / EMT_SHOW_CHUNK);
      var secs = Math.round(bytes.length / 80) / 100, at = "'" + new Date().toISOString();
      if (have) emtShowDeleteRows(sh, have.rows);   /* the old take goes first */
      for (var q = 0; q < n; q++) {
        sh.appendRow([gw, c.key, "'" + c.hash, q + 1, n, secs, EMT_SHOW_MARK + b64.slice(q * EMT_SHOW_CHUNK, (q + 1) * EMT_SHOW_CHUNK), at]);
      }
      S.rendered.push(c.key);
      if (have) idx = emtShowIndex(sh, gw);           /* rows moved up */
    }
    S.left = S.clips - S.kept - S.rendered.length;
    Logger.log(emtShowSummary(S));
    return S;
  } catch (e) {
    S.ok = false; S.stopped = 'error'; S.error = String((e && e.message) || e);
    S.left = Math.max(0, S.clips - S.kept - S.rendered.length);
    Logger.log(emtShowSummary(S));
    return S;
  } finally { emtShowRelease(); }
}

function emtShowSummary(S) {
  if (!S) return 'Gameweek Show: nothing ran.';
  if (S.stopped === 'nokey') return 'Gameweek Show: no ELEVENLABS_API_KEY yet. Add it in Project Settings → Script Properties (elevenlabs.io → Developers → API keys, with Text to Speech access).';
  if (S.stopped === 'nogw') return 'Gameweek Show: no unfinished gameweek in Matchweeks.';
  if (S.stopped === 'busy') return 'Gameweek Show: another render is running. Try again in a few minutes.';
  if (S.stopped === 'paused') return 'Gameweek Show: paused (EMT_SHOW_PAUSED = yes).';
  if (S.stopped === 'noscript') return 'Gameweek Show GW' + S.gw + ': no script yet (show/gw' + S.gw + '.json is not on the site and the show writer has not written one). Nothing to do.';
  if (S.stopped === 'empty') return 'Gameweek Show GW' + S.gw + ': the script has no lines.';
  if (S.stopped === 'error' && !S.clips) return 'Gameweek Show GW' + S.gw + ': stopped, ' + S.error;
  var s = 'Gameweek Show GW' + S.gw + (S.source === 'sheet' ? ' (the written script)' : '') + ': ' + S.rendered.length + ' rendered' + (S.rendered.length ? ' (' + S.rendered.join(', ') + ')' : '') +
    ', ' + S.kept + ' unchanged' + (S.removed.length ? ', ' + S.removed.length + ' cut (' + S.removed.join(', ') + ')' : '') +
    ', ' + S.left + ' still to render, of ' + S.clips + ' clips.';
  if (S.stopped === 'time') s += ' Stopped at the time limit; the next run finishes it.';
  else if (S.stopped) s += ' Stopped: ' + (S.error || S.stopped) + '.';
  return s;
}

/* aiTick runs this every 15 minutes: the next unfinished gameweek, if a key is set and the show is not paused */
function showTick(startedAt) {
  var t0 = typeof startedAt === 'number' ? startedAt : Date.now();
  if (!emtShowKey()) { emtShowNoKey('showTick'); return { ok: false, stopped: 'nokey' }; }
  if (emtProps().getProperty('EMT_SHOW_PAUSED') === 'yes') { Logger.log(emtShowSummary({ stopped: 'paused' })); return { ok: true, stopped: 'paused' }; }
  var gw = emtShowNextGw();
  if (!gw) { Logger.log(emtShowSummary({ stopped: 'nogw' })); return { ok: true, stopped: 'nogw' }; }
  return renderShow(gw, t0);
}

/* menu: Render the Gameweek Show now (the next unfinished gameweek; works while paused) */
function renderShowNow() {
  var S;
  if (emtShowKey()) S = renderShow(0);
  else { emtShowNoKey('menu'); S = { ok: false, stopped: 'nokey' }; }
  var msg = emtShowSummary(S);
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) { Logger.log(msg); }   /* no UI from a trigger or the editor */
  return S;
}

/* log what is rendered for a gameweek (default: the next unfinished one) */
function showStatus(gw) {
  gw = Number(gw) > 0 ? Number(gw) : emtShowNextGw();
  if (!emtShowKey()) emtShowNoKey('showStatus');
  var sh = SpreadsheetApp.getActive().getSheetByName('ShowAudio'), idx = sh && gw ? emtShowIndex(sh, gw) : {};
  var expected = emtShowExpected(gw), keys = expected || Object.keys(idx), done = 0, secs = 0, lines = [];
  keys.forEach(function (k) {
    var c = idx[k];
    if (c && c.ok) { done++; secs += c.secs; lines.push(k + ': ' + c.secs + ' s, ' + c.parts + ' part' + (c.parts > 1 ? 's' : '') + ', hash ' + c.hash.slice(0, 8)); }
    else lines.push(k + ': ' + (c ? 'incomplete' : 'not rendered'));
  });
  Object.keys(idx).forEach(function (k) { if (keys.indexOf(k) < 0) lines.push(k + ': not in the script any more (the next render removes it)'); });
  secs = Math.round(secs * 100) / 100;
  Logger.log('Gameweek Show GW' + gw + ': ' + done + ' of ' + keys.length + ' clips rendered, ' + secs + ' s' +
    (expected ? '' : ' (no render has run for this gameweek yet)') + '\n' + lines.join('\n'));
  return { gw: gw, expected: keys.length, rendered: done, secs: secs };
}

/* doGet ?show=<gw>: the clips in play order. complete = every clip of the script as of the last render is here.
 * The clips come from the stored key list (EMT_SHOW_KEYS_<gw>) and ShowAudio, two sheet reads.
 * v3.12: + script (emtShowScriptAny: the repo json, cached 5 minutes, else ShowScripts, else null).
 * meta (?show=<gw>&meta=1) leaves out every b64 and skips reading the audio: secs, hash and complete stay. */
function emtShowGet(gwParam, meta) {
  var gw = parseInt(gwParam, 10);
  if (!(gw > 0)) return { ok: false, error: 'badgw' };
  meta = meta === true || /^(1|true|yes)$/i.test(String(meta == null ? '' : meta));
  var sh = SpreadsheetApp.getActive().getSheetByName('ShowAudio'), expected = emtShowExpected(gw), clips = {};
  if (sh) {
    var idx = emtShowIndex(sh, gw);
    var keys = (expected || Object.keys(idx)).filter(function (k) { return idx[k] && idx[k].ok; });
    if (meta) keys.forEach(function (k) { clips[k] = { secs: idx[k].secs, hash: idx[k].hash }; });
    else {
      var data = emtShowData(sh, gw, idx, keys);
      keys.forEach(function (k) { if (data[k] !== undefined) clips[k] = { secs: idx[k].secs, hash: idx[k].hash, b64: data[k] }; });
    }
  }
  var complete = !!expected && expected.every(function (k) { return !!clips[k]; });
  return { ok: true, gw: gw, clips: clips, complete: complete, script: emtShowScriptAny(gw) };
}

/* =====================================================================================================
 * v3.12 · THE SHOW WRITES ITSELF — Malcolm's script, written by Claude from the app's own facts.
 *   1. The app posts the facts: POST { action: 'showfacts', team, token, gw, facts: '<json string>' }.
 *      gw must be the next unfinished gameweek and its deadline still ahead ('closed'); facts at most 60,000
 *      characters of JSON with fixtures: 1 to 10 of { home, away } ('badfacts'; when H2H Fixtures has the gameweek,
 *      they must be its fixtures); one accepted post per manager per 20 minutes ('slow'). Kept in the hidden ShowFacts
 *      tab in 45,000-character chunks, every Data cell marked 'j:'; a new post replaces that gameweek's older rows.
 *   2. showWriterTick (from aiTick, every 15 minutes) writes the script for the next unfinished gameweek when the
 *      deadline is at most 22 hours away and the facts are at most 6 hours old, or at most 4 hours away with any
 *      facts. Never when show/gw<N>.json is in the repo (hand-written wins), when ShowScripts already has that
 *      gameweek, after the deadline, without ANTHROPIC_API_KEY, or with EMT_SHOW_PAUSED = yes. 3 attempts per
 *      gameweek (EMT_SHOW_TRIES_<gw>; an API call that fails before Claude answers is not counted).
 *   3. The reply is checked (emtShowCheck) and, if wrong, retried once with the problems listed. Digits become words
 *      for the voice (emtSpeak), and the script goes to the hidden ShowScripts tab (Script cell marked 'j:'), where
 *      renderShow and doGet ?show=<gw> find it when the repo has no json.
 *   Model: EMT_SHOW_MODEL (default claude-sonnet-4-5). To have a show rewritten, delete its ShowScripts row.
 *   QUOTA: an idle run reads a few narrow columns. A written show is 1 or 2 Claude calls (~10k tokens in, ~1k out).
 * ===================================================================================================== */
var EMT_FACTS_HEAD = ['GW', 'Received (UTC)', 'Team', 'Part', 'Parts', 'Data'];
var EMT_SCRIPTS_HEAD = ['GW', 'Written (UTC)', 'Model', 'Facts received (UTC)', 'Script'];
var EMT_FACTS_MAX = 60000;                  // characters per post
var EMT_FACTS_EVERY_S = 20 * 60;            // one accepted post per manager per 20 minutes
var EMT_JSON_MARK = 'j:';                   // every json cell starts with this, so it can never be read as a formula
var EMT_SHOW_WRITER_DEFAULT = 'claude-sonnet-4-5';
var EMT_SHOW_WINDOW_MS = 22 * 3600e3;       // write in the last 22 hours before the deadline ...
var EMT_SHOW_FRESH_MS = 6 * 3600e3;         // ... from facts received in the last 6 hours,
var EMT_SHOW_LASTCALL_MS = 4 * 3600e3;      // or in the last 4 hours from any facts
var EMT_SHOW_TRIES = 3;                     // attempts per gameweek (one attempt = one run, with its one retry)
var EMT_SHOW_WRITE_LATE_MS = 150 * 1000;    // aiTick: no new write once the run is 2.5 minutes old
var EMT_SHOW_VOICE_LABEL = 'Malcolm Tyre — El Matador Booth';
var EMT_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/* the voice bible */
var EMT_SHOW_SYSTEM = [
  'You write the Gameweek Show for Matchweek, the app of El Matador Tire: a private FPL Draft (fantasy Premier League) league of eight friends. Every gameweek each club plays one head to head fixture (3 points a win, 1 a draw). The show is a spoken preview of about two minutes: a synthetic voice reads it while the screen shows each fixture.',
  '',
  'THE VOICE. Malcolm Tyre, a fictional British broadcaster in "the booth". Dry, brisk, wry. He understates and never tries to be funny: the wit is in what he picks and what he leaves out. Short plain sentences, British spelling, no exclamation marks.',
  '',
  'THE SHAPE. It must match what the screen shows.',
  '- open: about 20 words. "Gameweek <n>." then one hook for the whole week, then "Here\'s how it lines up."',
  '- One chapter per fixture in FACTS, each exactly five beats, in this order:',
  '  [0] the home club: name the club, then one storyline only (their form, a run, their place in the table, or a quote and the model\'s odds on it).',
  '  [1] the home eleven: talk about the star, by default the highest ep in that xi; mention the flags if there are any (status d is doubtful; i, s, u and n are out; news says why).',
  '  [2] the away club, as [0].',
  '  [3] the away eleven, as [1].',
  '  [4] the faceoff: the series (rec) and/or the model\'s win chance (win) or the predicted score (H.proj to A.proj).',
  '- close: "That\'s the gameweek." then the deadline and lineups, then a nudge to go on the record in the press room.',
  '- 10 to 16 words per beat.',
  '- The app plays the chapters in its own order, so never say first, next, then, finally, later or last, and never refer to another chapter.',
  '- star.h is the code of the home player beat [1] is about and star.a the code of the away player beat [3] is about, copied from that fixture\'s H.xi and A.xi.',
  '',
  'READING FACTS. table: pos 1 is top; pts are league points; pf and pa are fantasy points for and against. Each fixture: home and away (exact team names); derby (its name, when it is a derby); win (the model\'s chances in percent: h home win, d draw, a away win); rec (the all-time series: home wins, away wins, d draws; all three 0 means the first ever meeting); H and A (the two sides). A side: team; mgr (the manager\'s first name); proj (the model\'s projected score); formation; results (oldest first, like "W46-36 v Baha GW1": won 46 to 36 against Baha\'s club in gameweek 1); xi (the starting eleven: code, name, pos, club, status, news, ep = the model\'s projected points, opp = the real fixture). quotes, when present, are lines from the press room.',
  '',
  'NUMBERS.',
  '- Write every number as digits (56%, 39 to 35.8, 4 to 3, 5th): the app turns them into words for the voice. Formations in words (a back three), never 3-5-2.',
  '- Never write a number that is not in FACTS, QUOTES or NOTES; the only exceptions are counts up to 10 (won 3 straight) and the margin of a result in results (W46-36 is a win by 10). Scores and predictions as "X to Y". No hyphen or dash between numbers.',
  '- Say gameweek, never GW. Say "the model" for win chances and projections.',
  '',
  'FACTS ONLY.',
  '- Every claim must be checkable in FACTS, QUOTES or NOTES. Count streaks from results, newest last. Superlatives (best, most, only, highest) only when FACTS makes it certain. When in doubt, leave it out.',
  '- Managers by first name (mgr), clubs by team name, spelt exactly as in FACTS.',
  '- Never invent a quote. Quote a manager only word for word from QUOTES or FACTS.',
  '- Banter only about the league: picks, form, the table, quotes, and the running jokes in NOTES. Nothing about anyone\'s looks, family, health, money, job or life outside the league. No swearing.',
  '- Real footballers only as players in someone\'s team.',
  '',
  'STYLE. No em dashes or en dashes, no emoji, no hashtags. Two beats as a style reference only (their facts are not this week\'s; never copy them): "Cold Palmers. Parker says he\'s winning Manager of the Month. The model says 9%." and "Gibbs-White tops the eleven. Not a single flag among PJ\'s starters."',
  '',
  'REPLY with JSON only, no prose, no code fence:',
  '{"open":"...","chapters":[{"home":"<exact home team>","away":"<exact away team>","star":{"h":"<player code from H.xi>","a":"<player code from A.xi>"},"beats":["","","","",""]}],"close":"..."}'
].join('\n');

/* a hidden tab with a frozen header row, created when missing */
function emtHiddenSheet(name, head) {
  var ss = SpreadsheetApp.getActive(), sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, head.length).setValues([head]);
    sh.setFrozenRows(1);
    try { sh.hideSheet(); } catch (e) { }
  } else if (sh.getLastRow() < 1) sh.getRange(1, 1, 1, head.length).setValues([head]);
  return sh;
}

/* one run at a time: a timestamp in a Script Property, taken under the script lock for a moment only */
function emtFlagClaim(prop, ms) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return false;
  try {
    var p = emtProps(), t = Number(p.getProperty(prop) || 0), now = Date.now();
    if (t && now - t >= 0 && now - t < ms) return false;
    p.setProperty(prop, String(now));
    return true;
  } finally { lock.releaseLock(); }
}

/* ---------- 1. the facts, from the app ---------- */
function emtShowFactsOk(f, gw) {
  if (!f || typeof f !== 'object' || Array.isArray(f)) return false;
  if (f.gw !== undefined && f.gw !== null && f.gw !== '' && Number(f.gw) !== gw) return false;
  var fx = f.fixtures, seen = {};
  if (!Array.isArray(fx) || fx.length < 1 || fx.length > 10) return false;
  for (var i = 0; i < fx.length; i++) {
    var x = fx[i];
    if (!x || typeof x !== 'object' || typeof x.home !== 'string' || typeof x.away !== 'string' || !x.home.trim() || !x.away.trim()) return false;
    if (seen[x.home + '|' + x.away]) return false;
    seen[x.home + '|' + x.away] = 1;
  }
  /* when the sheet already has this gameweek's fixtures, the facts must be exactly those, every one of them (a partial
   * post would otherwise replace the full one and the show would skip fixtures) */
  var real = emtRows('H2H Fixtures').filter(function (r) { return Number(r.GW) === gw; }).map(function (r) { return String(r.Home) + '|' + String(r.Away); });
  if (real.length && fx.length !== real.length) return false;
  if (real.length) for (var j = 0; j < fx.length; j++) if (real.indexOf(fx[j].home + '|' + fx[j].away) < 0) return false;
  return true;
}

function emtShowFacts(team, req) {
  var gw = Number(req.gw);
  if (!(gw > 0) || gw !== emtShowNextGw()) return { ok: false, error: 'closed' };
  var dl = emtDeadlineMs(gw);
  if (!dl || Date.now() >= dl) return { ok: false, error: 'closed' };
  var raw = req.facts;
  if (raw && typeof raw === 'object') raw = JSON.stringify(raw);        /* an object is taken too */
  if (typeof raw !== 'string' || !raw || raw.length > EMT_FACTS_MAX) return { ok: false, error: 'badfacts' };
  var f;
  try { f = JSON.parse(raw); } catch (e) { return { ok: false, error: 'badfacts' }; }
  if (!emtShowFactsOk(f, gw)) return { ok: false, error: 'badfacts' };
  var cache = CacheService.getScriptCache(), rk = 'EMT_SF_' + team;
  if (cache.get(rk)) return { ok: false, error: 'slow' };
  var data = JSON.stringify(f), lock = LockService.getScriptLock();
  if (data.length > EMT_FACTS_MAX) return { ok: false, error: 'badfacts' };   /* re-serialised can be longer (1e20 → 100000000000000000000) */
  lock.waitLock(10000);
  try {
    if (cache.get(rk)) return { ok: false, error: 'slow' };
    var sh = emtHiddenSheet('ShowFacts', EMT_FACTS_HEAD), last = sh.getLastRow(), old = [];
    if (last > 1) sh.getRange(2, 1, last - 1, 1).getValues().forEach(function (r, i) { if (Number(r[0]) === gw) old.push(i + 2); });
    var at = new Date().toISOString(), n = Math.ceil(data.length / EMT_SHOW_CHUNK);
    for (var q = 0; q < n; q++) sh.appendRow([gw, "'" + at, emtCell(team), q + 1, n, EMT_JSON_MARK + data.slice(q * EMT_SHOW_CHUNK, (q + 1) * EMT_SHOW_CHUNK)]);
    emtShowDeleteRows(sh, old);              /* only the latest facts per gameweek: the older rows go, bottom up */
    cache.put(rk, '1', EMT_FACTS_EVERY_S);
    return { ok: true, at: at, parts: n };
  } finally { lock.releaseLock(); }
}

/* the newest complete facts for a gameweek: { at (ms), iso, team, parts, rows } (+ data when withData), or null.
 * Without data it reads five narrow columns only. */
function emtShowFactsLatest(gw, withData) {
  var sh = SpreadsheetApp.getActive().getSheetByName('ShowFacts'), last = sh ? sh.getLastRow() : 0;
  if (last < 2) return null;
  var v = sh.getRange(2, 1, last - 1, 5).getValues(), sets = {}, best = null;
  for (var i = 0; i < v.length; i++) {
    if (Number(v[i][0]) !== gw) continue;
    var iso = String(v[i][1]).replace(/^'/, ''), k = iso + '|' + v[i][2];
    var s = sets[k] || (sets[k] = { at: aiTs(iso), iso: iso, team: String(v[i][2]).replace(/^'/, ''), parts: Number(v[i][4]) || 0, rows: {}, n: 0 });
    s.rows[Number(v[i][3])] = i + 2; s.n++;
  }
  Object.keys(sets).forEach(function (k) {
    var s = sets[k], ok = s.parts > 0 && s.n === s.parts && s.at > 0;
    for (var p = 1; ok && p <= s.parts; p++) if (!s.rows[p]) ok = false;
    if (ok && (!best || s.at > best.at)) best = s;
  });
  if (!best || !withData) return best;
  var parts = [];
  for (var q = 1; q <= best.parts; q++) {
    var r = sh.getRange(best.rows[q], 1, 1, 6).getValues()[0], d = String(r[5]);
    if (Number(r[0]) !== gw || Number(r[3]) !== q || Number(r[4]) !== best.parts || String(r[1]).replace(/^'/, '') !== best.iso ||
        d.indexOf(EMT_JSON_MARK) !== 0) return null;   /* moved under us (a new post replaced these rows): the next run reads again */
    parts.push(d.slice(EMT_JSON_MARK.length));
  }
  try { best.data = JSON.parse(parts.join('')); } catch (e) { return null; }
  return best;
}

/* ---------- the written scripts ---------- */
/* the ShowScripts row for a gameweek (the newest): { row } or, withScript, { row, json }; null when none */
function emtShowScriptRow(gw, withScript) {
  var sh = SpreadsheetApp.getActive().getSheetByName('ShowScripts'), last = sh ? sh.getLastRow() : 0;
  if (last < 2) return null;
  var v = sh.getRange(2, 1, last - 1, 1).getValues(), row = 0;
  for (var i = v.length - 1; i >= 0; i--) if (Number(v[i][0]) === gw) { row = i + 2; break; }
  if (!row) return null;
  if (!withScript) return { row: row };
  var s = String(sh.getRange(row, 5, 1, 1).getValues()[0][0]);
  if (s.indexOf(EMT_JSON_MARK) !== 0) return null;
  try { var j = JSON.parse(s.slice(EMT_JSON_MARK.length)); return j && typeof j === 'object' ? { row: row, json: j } : null; } catch (e) { return null; }
}

/* the script renderShow voices: the repo's json, else (on a 404 only) the written one. { json, source? } | { none } | { error } */
function emtShowScript(gw) {
  var f = emtShowFetch(gw);
  if (!f.none) return f;
  var s = emtShowScriptRow(gw, true);
  return s ? { json: s.json, source: 'sheet' } : { none: true };
}

/* doGet's "script": the repo json (cached 5 minutes), else ShowScripts, else null. Never throws. */
function emtShowScriptAny(gw) {
  var cache = null, ck = 'EMT_SHOW_REPO_' + gw, repo = null;
  try { cache = CacheService.getScriptCache(); var hit = cache.get(ck); if (hit) repo = JSON.parse(hit); } catch (e) { repo = null; }
  if (!repo) {
    try {
      var f = emtShowFetch(gw);
      repo = f.json ? { json: f.json } : f.none ? { none: true } : null;
      if (repo && cache) { try { cache.put(ck, JSON.stringify(repo), 300); } catch (e) { } }
    } catch (e) { repo = null; }
  }
  if (repo && repo.json) return repo.json;
  var s = null;
  try { s = emtShowScriptRow(gw, true); } catch (e) { s = null; }
  return s ? s.json : null;
}

/* ---------- digits → words, for the voice ---------- */
var EMT_ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
  'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
var EMT_TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

/* 0..999999 in British words ("two hundred and forty", "two thousand and twenty-six"); a leading zero or anything
 * longer is read digit by digit */
function emtWords(n) {
  var s = String(n);
  if (!/^\d+$/.test(s) || s.length > 6 || (s.length > 1 && s.charAt(0) === '0')) {
    return s.split('').map(function (c) { return /\d/.test(c) ? EMT_ONES[Number(c)] : c; }).join(' ');
  }
  n = Number(s);
  var u100 = function (x) { return x < 20 ? EMT_ONES[x] : EMT_TENS[Math.floor(x / 10)] + (x % 10 ? '-' + EMT_ONES[x % 10] : ''); };
  var u1000 = function (x) { var h = Math.floor(x / 100), r = x % 100; return h ? EMT_ONES[h] + ' hundred' + (r ? ' and ' + u100(r) : '') : u100(r); };
  if (n < 1000) return u1000(n);
  var t = Math.floor(n / 1000), r = n % 1000;
  return u1000(t) + ' thousand' + (r ? (r < 100 ? ' and ' : ' ') + u1000(r) : '');
}
function emtOrdinal(n) {
  var w = emtWords(n), m = /([a-z]+)$/.exec(w);
  if (!m) return w;
  var last = m[1], irr = { one: 'first', two: 'second', three: 'third', five: 'fifth', eight: 'eighth', nine: 'ninth', twelve: 'twelfth' };
  return w.slice(0, w.length - last.length) + (irr[last] || (/y$/.test(last) ? last.slice(0, -1) + 'ieth' : last + 'th'));
}
function emtDecimal(d) {
  var p = String(d).split('.');
  return emtWords(p[0]) + (p.length > 1 && p[1] !== '' ? ' point ' + p[1].split('').map(function (c) { return EMT_ONES[Number(c)]; }).join(' ') : '');
}

/* what the voice reads: "Predicted 39 to 35.8. The model has Parker at 56%." →
 * "Predicted thirty-nine to thirty-five point eight. The model has Parker at fifty-six percent."
 * keep: names to leave exactly as written (a club like Devils U21s); digits glued inside a word (U21s) stay too */
function emtSpeak(text, keep) {
  var s = String(text == null ? '' : text), held = [];
  var tag = function (i) { var t = ''; do { t = String.fromCharCode(97 + i % 26) + t; i = Math.floor(i / 26) - 1; } while (i >= 0); return '\uE000' + t + '\uE001'; };
  var clock = function (h, mm, ap) {
    return emtWords(String(Number(h))) + (mm === '00' ? '' : mm.charAt(0) === '0' ? ' oh ' + EMT_ONES[Number(mm.charAt(1))] : ' ' + emtWords(mm)) + (ap ? ' ' + ap.toLowerCase() + 'm' : '');
  };
  (keep || []).map(String).filter(function (k) { return /\d/.test(k); }).sort(function (a, b) { return b.length - a.length; }).forEach(function (k) {
    if (s.indexOf(k) < 0) return;
    s = s.split(k).join(tag(held.length));
    held.push(k);
  });
  s = s.replace(/\bGW ?(\d+)/g, 'gameweek $1');
  s = s.replace(/\b\d{1,3}(?:,\d{3})+\b/g, function (m) { return m.replace(/,/g, ''); });            /* 1,200 */
  s = s.replace(/\b([3-5])[-–]([1-6])[-–]([1-6])(?:[-–]([1-6]))?\b/g, function (m, a, b, c, d) {       /* a formation */
    var x = d ? [a, b, c, d] : [a, b, c], sum = 0;
    x.forEach(function (v) { sum += Number(v); });
    return sum === 10 ? x.map(function (v) { return EMT_ONES[Number(v)]; }).join('-') : m;
  });
  s = s.replace(/(\d%?)[ \t]*[-–][ \t]*(?=\d)/g, '$1 to ');                                          /* 4-3, 39–35.8 */
  s = s.replace(/(^|[\s(])[-−](?=\d)/g, '$1minus ');
  s = s.replace(/([£$€])(\d+(?:\.\d+)?)(?:[ \t]?(m|k|bn|million|thousand|billion)(?![A-Za-z]))?/gi, function (m, c, d, x) {   /* £5.5m */
    var big = x ? ({ m: 'million', k: 'thousand', bn: 'billion' }[x.toLowerCase()] || x.toLowerCase()) : '';
    return emtDecimal(d) + (big ? ' ' + big : '') + ' ' + (c === '£' ? 'pound' : c === '€' ? 'euro' : 'dollar') + (d === '1' && !big ? '' : 's');
  });
  s = s.replace(/\b(\d{1,2})[.:](\d{2})[ \t]?([ap])\.?m\.?(?![A-Za-z])/gi, function (m, h, mm, ap) { return clock(h, mm, ap); });   /* 10.30am, 9:05 pm */
  s = s.replace(/\b(\d{1,2}):(\d{2})(?!\d)/g, function (m, h, mm) { return clock(h, mm, ''); });     /* 10:00, 17:30 */
  s = s.replace(/(\d+(?:\.\d+)?)[ \t]?%/g, function (m, d) { return emtDecimal(d) + ' percent'; });
  s = s.replace(/\b(\d+)(?:st|nd|rd|th)\b/gi, function (m, d) { return emtOrdinal(d); });
  s = s.replace(/\d+(?:\.\d+)?/g, function (m, off, all) {
    var b = all.charAt(off - 1), a = all.charAt(off + m.length);
    if (/[A-Za-z]/.test(b) && /[A-Za-z]/.test(a)) return m;                                          /* U21s */
    return (/[A-Za-z]/.test(b) ? ' ' : '') + (m.indexOf('.') > -1 ? emtDecimal(m) : emtWords(m)) + (/[A-Za-z]/.test(a) ? ' ' : '');
  });
  held.forEach(function (k, i) { s = s.split(tag(i)).join(k); });
  return s;
}

/* the names in the facts that carry digits (clubs, managers, players), for emtSpeak's keep */
function emtShowNames(facts) {
  var out = [], add = function (v) { v = String(v == null ? '' : v); if (v && /\d/.test(v) && out.indexOf(v) < 0) out.push(v); };
  ((facts && facts.table) || []).forEach(function (t) { if (t) { add(t.team); add(t.mgr); } });
  ((facts && facts.fixtures) || []).forEach(function (f) {
    if (!f) return;
    add(f.home); add(f.away); add(f.derby);
    ['H', 'A'].forEach(function (k) { var x = f[k]; if (!x) return; add(x.team); add(x.mgr); (x.xi || []).forEach(function (p) { if (p) add(p.name); }); });
  });
  return out;
}

/* ---------- 2. the writer ---------- */
/* one line of the written script, tidied: no em dash (a comma), no en dash except between numbers, no GW */
function emtShowTidy(t) {
  return emtClean(typeof t === 'string' ? t : '', 400)                 /* anything but text (an object, a number) is empty */
    .replace(/(\d)[ \t]*–[ \t]*(?=\d)/g, '$1-')
    .replace(/[ \t]*[—–][ \t]*/g, ', ')
    .replace(/\bGW ?(\d+)/g, 'gameweek $1')
    .replace(/\s+,/g, ',').replace(/,(\s*[,.;:!?])/g, '$1').replace(/^[,\s]+|[,\s]+$/g, '');
}

/* the prompt: FACTS (decimals to one place), the gameweek's QUOTES from Social, the NOTES from Posts */
function emtShowPrompt(gw, facts, dl) {
  var sent = JSON.stringify(facts, function (k, v) { return typeof v === 'number' && isFinite(v) && v % 1 !== 0 ? Math.round(v * 10) / 10 : v; });
  var mgr = {};
  (facts.table || []).forEach(function (t) { if (t && t.team && t.mgr) mgr[t.team] = t.mgr; });
  (facts.fixtures || []).forEach(function (f) { ['H', 'A'].forEach(function (s) { if (f && f[s] && f[s].team && f[s].mgr) mgr[f[s].team] = f[s].mgr; }); });
  var quotes = aiQuotes(null, gw).filter(function (q) { return q.gw === gw; }).slice(-16).map(function (q) {
    return '- ' + q.team + (mgr[q.team] ? ' (' + mgr[q.team] + ')' : '') + (q.answering ? ', answering ' + q.answering : '') + ': "' + emtClean(q.said, 140) + '"' +
      (q.calling ? ' Their call: ' + JSON.stringify(q.calling) + '.' : '') + (q.model ? ' The model gives that call ' + q.model + '.' : '');
  });
  var notes = emtRows('Posts').filter(function (r) { return r.Kind === 'note'; }).slice(-8).map(function (r) { return '- ' + emtClean(r.Text, 600); });
  var user = 'FACTS (gameweek ' + gw + '):\n' + sent +
    '\n\nQUOTES this gameweek (from the press room; quote them word for word or not at all):\n' + (quotes.join('\n') || '(none yet)') +
    '\n\nNOTES (running jokes and storylines):\n' + (notes.join('\n') || '(none)') +
    '\n\nThe deadline is on ' + EMT_DAYS[new Date(dl).getUTCDay()] + '.\nWRITE the Gameweek ' + gw + ' show.';
  return { user: user, allowed: user };
}

/* one call to Claude, same style as aiWrite: { text, stop } or { error } (no answer, nothing billed) */
function emtShowAsk(model, user) {
  var res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { 'x-api-key': emtAiKey(), 'anthropic-version': '2023-06-01' },
    payload: JSON.stringify({ model: model, max_tokens: 2000, system: EMT_SHOW_SYSTEM, messages: [{ role: 'user', content: user }] })
  });
  var code = res.getResponseCode(), body = String(res.getContentText() || '');
  if (code !== 200) return { error: 'Claude API ' + code + ': ' + body.slice(0, 200) };
  var j = null;
  try { j = JSON.parse(body); } catch (e) { return { text: '', stop: '' }; }
  var txt = ((j.content || []).filter(function (c) { return c && c.type === 'text'; })[0] || {}).text || '';
  return { text: txt, stop: j.stop_reason || '' };
}

/* the numbers a line says, for the number guard. Digits stuck to a letter in front are part of a name (Devils U21s,
 * W46, R2) and are skipped; thousands commas are dropped (1,200 is 1200). */
function emtShowNums(t) {
  var out = [], re = /\d+(?:\.\d+)?/g, m, s = String(t == null ? '' : t).replace(/(\d),(?=\d{3}(?!\d))/g, '$1');
  while ((m = re.exec(s))) if (!/[A-Za-z]/.test(s.charAt(m.index - 1))) out.push(m[0]);
  return out;
}
/* every number the writer may use, as a set: each number in what it was sent (also rounded and without its
 * decimals), the margin of every "a-b" result in it, and 0 to 10 (counts: "won 3 straight") */
function emtShowAllowed(text) {
  var ok = {}, raw = String(text == null ? '' : text), i;
  var s = raw + '\n' + raw.replace(/(\d),(?=\d{3}(?!\d))/g, '$1');   /* both readings: a JSON array [5,240] and a total 1,200 */
  (s.match(/\d+(?:\.\d+)?/g) || []).forEach(function (n) {
    var x = Number(n);
    ok[n] = 1; ok[String(x)] = 1;
    if (n.indexOf('.') > -1) { ok[String(Math.round(x))] = 1; ok[String(Math.floor(x))] = 1; }
  });
  s.replace(/(\d+)[ \t]*[-–][ \t]*(\d+)/g, function (m, a, b) { ok[String(Math.abs(Number(a) - Number(b)))] = 1; return m; });
  for (i = 0; i <= 10; i++) ok[String(i)] = 1;
  return ok;
}

/* the reply, checked against the facts. { problems: [...], script: { open, chapters, close } | null } */
function emtShowCheck(text, facts, allowed, stop) {
  var P = [], j = null, m = String(text || '').match(/\{[\s\S]*\}/);
  if (m) { try { j = JSON.parse(m[0]); } catch (e) { j = null; } }
  if (!j || typeof j !== 'object' || Array.isArray(j)) {
    P.push(stop === 'max_tokens' ? 'The reply was cut off before the JSON ended: keep every beat to 10 to 16 words.' : 'The reply was not one JSON object in the shape asked for.');
    return { problems: P, script: null };
  }
  var fx = (facts && facts.fixtures) || [], seen = {}, chapters = [];
  var open = emtShowTidy(j.open), close = emtShowTidy(j.close);
  if (!open) P.push('"open" is empty.');
  if (!close) P.push('"close" is empty.');
  (Array.isArray(j.chapters) ? j.chapters : []).forEach(function (c, i) {
    c = c && typeof c === 'object' ? c : {};
    var home = String(c.home == null ? '' : c.home), away = String(c.away == null ? '' : c.away), name = home + ' v ' + away;
    var f = fx.filter(function (x) { return x && x.home === home && x.away === away; })[0];
    if (!f) { P.push('Chapter ' + (i + 1) + ' (' + name + ') is not a fixture in FACTS: use the exact home and away team names.'); return; }
    if (seen[name]) { P.push(name + ' has more than one chapter.'); return; }
    seen[name] = 1;
    var beats = (Array.isArray(c.beats) ? c.beats : []).map(emtShowTidy);
    if (beats.length !== 5 || beats.some(function (b) { return !b; })) P.push(name + ': needs exactly 5 beats, none empty (it has ' + beats.filter(Boolean).length + ').');
    beats.forEach(function (b, k) {
      var n = b ? b.split(/\s+/).length : 0;
      if (b && (n < 5 || n > 26)) P.push(name + ', beat ' + k + ': ' + n + ' words; keep every beat to 10 to 16.');
    });
    var star = c.star && typeof c.star === 'object' ? c.star : {};
    var st = { h: String(star.h == null ? '' : star.h), a: String(star.a == null ? '' : star.a) };
    [['h', 'H'], ['a', 'A']].forEach(function (s) {
      var codes = ((f[s[1]] && f[s[1]].xi) || []).map(function (x) { return String(x && x.code); });
      if (codes.length && codes.indexOf(st[s[0]]) < 0) P.push(name + ': star.' + s[0] + ' "' + st[s[0]] + '" is not a code in ' + s[1] + '.xi.');
    });
    chapters.push({ home: home, away: away, star: st, beats: beats });
  });
  fx.forEach(function (x) { if (x && !seen[x.home + ' v ' + x.away]) P.push('Missing chapter: ' + x.home + ' v ' + x.away + '.'); });
  /* the number guard: every number written must be one of the numbers that were sent (whole numbers, not a substring:
   * "54" is not allowed just because a player code like 154561 contains it), a count up to 10, or a result's margin */
  var texts = [open, close], bad = {}, ok = emtShowAllowed(allowed);
  chapters.forEach(function (c) { texts = texts.concat(c.beats); });
  texts.forEach(function (t) {
    emtShowNums(t).forEach(function (n) {
      if (!ok[n] && !ok[String(Number(n))] && !bad[n]) { bad[n] = 1; P.push('The number ' + n + ' (in "' + String(t).slice(0, 90) + '") is not in FACTS, QUOTES or NOTES.'); }
    });
  });
  return P.length ? { problems: P, script: null } : { problems: [], script: { open: open, chapters: chapters, close: close } };
}

/* ask, check, and ask once more with the problems listed. { script, model, calls, billed, problems, error } */
function emtShowWrite(gw, facts, dl) {
  var P = emtShowPrompt(gw, facts, dl), model = emtProps().getProperty('EMT_SHOW_MODEL') || EMT_SHOW_WRITER_DEFAULT;
  var W = { script: null, model: model, calls: 0, billed: 0, problems: [], error: '' }, ask = P.user;
  for (var round = 0; round < 2; round++) {
    var r = emtShowAsk(model, ask);
    W.calls++;
    if (r.error) { W.error = r.error; return W; }
    W.billed++;
    var c = emtShowCheck(r.text, facts, P.allowed, r.stop);
    if (!c.problems.length) { W.script = c.script; W.problems = []; return W; }
    W.problems = c.problems;
    Logger.log('Show writer GW' + gw + ': reply ' + (round + 1) + ' rejected: ' + c.problems.join(' | '));
    ask = P.user + '\n\nYOUR LAST REPLY WAS REJECTED. Fix every problem below and send the whole show again, JSON only:\n- ' + c.problems.slice(0, 25).join('\n- ');
  }
  return W;
}

/* the checked script (digits) → the stored script (words), in the same shape as a hand-written show/gw<N>.json.
 * keep: names with digits in them, read as written (emtShowNames) */
function emtShowSpoken(gw, s, at, keep) {
  var say = function (t) { return emtSpeak(t, keep); };
  return { gw: gw, voice: EMT_SHOW_VOICE_LABEL, model: EMT_SHOW_MODEL_DEFAULT, speed: 1.1, audio: 'sheet', source: 'ai', written: at.slice(0, 10),
    open: say(s.open),
    chapters: s.chapters.map(function (c) { return { home: c.home, away: c.away, star: { h: c.star.h, a: c.star.a }, beats: c.beats.map(say) }; }),
    close: say(s.close) };
}

/* aiTick runs this every 15 minutes, before showTick, so a script written here is voiced in the same run */
function showWriterTick(startedAt) {
  var t0 = typeof startedAt === 'number' ? startedAt : Date.now(), p = emtProps();
  var S = { ok: true, gw: 0, stopped: '', calls: 0 };
  var say = function (m) { Logger.log('Show writer' + (S.gw ? ' GW' + S.gw : '') + ': ' + m); };
  if (p.getProperty('EMT_SHOW_PAUSED') === 'yes') { S.stopped = 'paused'; return S; }
  if (!emtAiKey()) {
    if (!p.getProperty('EMT_SHOW_WRITER_NOKEY')) {
      say('no ANTHROPIC_API_KEY in Script Properties, so the show is not written here (a hand-written show/gw<N>.json still works). Logged once.');
      p.setProperty('EMT_SHOW_WRITER_NOKEY', '1');
    }
    S.stopped = 'nokey'; return S;
  }
  if (p.getProperty('EMT_SHOW_WRITER_NOKEY')) p.deleteProperty('EMT_SHOW_WRITER_NOKEY');
  var gw = S.gw = emtShowNextGw();
  if (!gw) { S.stopped = 'nogw'; return S; }
  var now = Date.now(), dl = emtDeadlineMs(gw);
  if (!dl || dl <= now) { S.stopped = 'closed'; return S; }
  if (emtShowScriptRow(gw, false)) { S.stopped = 'written'; return S; }
  var left = dl - now, facts = emtShowFactsLatest(gw, false);
  if (!facts) {
    S.stopped = 'nofacts';
    if (left <= EMT_SHOW_WINDOW_MS) say('no facts from the app yet (the app sends them when a manager opens it).');
    return S;
  }
  var age = now - facts.at;
  if (!((left <= EMT_SHOW_WINDOW_MS && age <= EMT_SHOW_FRESH_MS) || left <= EMT_SHOW_LASTCALL_MS)) {
    S.stopped = 'wait';
    if (left <= EMT_SHOW_WINDOW_MS) say('the latest facts are ' + Math.round(age / 36e5 * 10) / 10 + ' hours old; writing when fresher ones arrive, or in the last 4 hours.');
    return S;
  }
  var tries = Number(p.getProperty('EMT_SHOW_TRIES_' + gw) || 0);
  if (tries >= EMT_SHOW_TRIES) { S.stopped = 'tries'; say('3 attempts failed; no more this gameweek (delete EMT_SHOW_TRIES_' + gw + ' to allow more).'); return S; }
  if (Date.now() - t0 > EMT_SHOW_WRITE_LATE_MS) { S.stopped = 'time'; say('this run is already busy; the next one writes it.'); return S; }
  var repo = emtShowFetch(gw);
  if (repo.json) { S.stopped = 'repo'; return S; }                      /* hand-written: it wins */
  if (repo.error) { S.ok = false; S.stopped = 'error'; S.error = repo.error; say('could not check the repo (' + repo.error + '); trying again next run.'); return S; }
  if (!emtFlagClaim('EMT_SHOW_WRITING', EMT_SHOW_BUSY_MS)) { S.stopped = 'busy'; return S; }
  try {
    tries = Number(p.getProperty('EMT_SHOW_TRIES_' + gw) || 0);
    if (tries >= EMT_SHOW_TRIES) { S.stopped = 'tries'; return S; }
    if (emtShowScriptRow(gw, false)) { S.stopped = 'written'; return S; }
    p.setProperty('EMT_SHOW_TRIES_' + gw, String(tries + 1));          /* counted first: a run that dies mid-call still counts */
    facts = emtShowFactsLatest(gw, true);
    if (!facts || !facts.data) {
      p.setProperty('EMT_SHOW_TRIES_' + gw, String(tries));
      S.ok = false; S.stopped = 'badfacts'; say('the stored facts could not be read; waiting for the next post from the app.'); return S;
    }
    var W = emtShowWrite(gw, facts.data, dl);
    S.calls = W.calls; S.model = W.model;
    if (W.error && !W.billed) {
      p.setProperty('EMT_SHOW_TRIES_' + gw, String(tries));            /* Claude never answered: not an attempt */
      S.ok = false; S.stopped = 'http'; S.error = W.error; say(W.error + ' (not counted; trying again next run).'); return S;
    }
    if (!W.script) {
      S.ok = false; S.stopped = 'invalid'; S.problems = W.problems; S.error = W.error;
      say('attempt ' + (tries + 1) + ' of ' + EMT_SHOW_TRIES + ' failed, nothing kept: ' + (W.error || W.problems.join(' | ')));
      return S;
    }
    var lock = LockService.getScriptLock(), at = new Date().toISOString(), js = emtShowSpoken(gw, W.script, at, emtShowNames(facts.data));
    lock.waitLock(10000);
    try {
      if (emtShowScriptRow(gw, false)) { S.stopped = 'written'; return S; }
      emtHiddenSheet('ShowScripts', EMT_SCRIPTS_HEAD).appendRow([gw, "'" + at, emtCell(W.model), "'" + facts.iso, EMT_JSON_MARK + JSON.stringify(js)]);
    } finally { lock.releaseLock(); }
    S.written = true; S.script = js;
    say('written by ' + W.model + ' (' + W.calls + ' call' + (W.calls > 1 ? 's' : '') + ', ' + js.chapters.length + ' chapters) from the facts of ' + facts.iso + '. The show voices it next.');
    return S;
  } finally { p.deleteProperty('EMT_SHOW_WRITING'); }
}

/* =====================================================================================================
 * v3.12 · CODE.GS UPDATES ITSELF FROM GITHUB — the repo's Code.gs is the release.
 *   selfUpdateTick (from aiTick, at most once an hour: EMT_SELF_CHECKED) fetches
 *   raw.githubusercontent.com/parkerno2/el-matador-tire/main/Code.gs and refuses it unless it is over 50,000
 *   characters, carries the markers (EL MATADOR TIRE, doPost, aiTick, selfUpdateTick) and a CHANGELOG version,
 *   parses (V8), loads (its top level runs inside a function and defines doGet, doPost, aiTick and selfUpdateTick),
 *   and is not older than the version running here; appsscript.json must keep its "webapp" section. Then, through the Apps Script API with this
 *   script's own token: it reads the project; if the Code file differs it picks the web app deployment
 *   (EMT_SELF_DEPLOYMENT, else the one at the Specials 'API URL', else the only versioned web app), writes the new
 *   code (every other file, the manifest included, goes back untouched), saves a version and points that deployment
 *   at it (the URL stays the same). When the editor already matches the repo but this never deployed it (pasted by
 *   hand), it reads the web app's version and, if that is older, saves a version and points the web app at it.
 *   EMT_SELF_STATE: 'current: ...' · 'updated to ...' · 'refused: ...' (nothing changed) · 'off: ...' (not set up:
 *   see SETUP in the CHANGELOG) · 'half: ...' (the code is in but the web app was not switched yet; the next check
 *   finishes it) · 'drift: ...' (edited by hand since the last update; left alone until the repo changes or
 *   selfUpdateNow) · 'error: ...'.
 *   EMT_SELF_UPDATE = off turns the hourly check off. Menu: Update Code.gs from GitHub now. selfUpdateStatus().
 *   QUOTA: one GitHub fetch an hour, plus one API read once set up; an update is five API calls.
 * ===================================================================================================== */
var EMT_SELF_SRC = 'https://raw.githubusercontent.com/parkerno2/el-matador-tire/main/Code.gs';
var EMT_SELF_API = 'https://script.googleapis.com/v1/projects/';
var EMT_SELF_EVERY_MS = 60 * 60 * 1000;
var EMT_SELF_LATE_MS = 300 * 1000;          // aiTick: not when the run is already 5 minutes old (Apps Script stops at 6)
var EMT_SELF_BUSY_MS = 3 * 60 * 1000;
var EMT_SELF_MIN_CHARS = 50000;
var EMT_SELF_MARKS = ['EL MATADOR TIRE', 'function doPost', 'function aiTick', 'function selfUpdateTick'];

function emtSelfNorm(s) { return String(s == null ? '' : s).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').replace(/\s+$/, ''); }
/* the first version in the CHANGELOG, e.g. 'v3.12' ('' when none) */
function emtSelfVersion(src) { var m = /CHANGELOG[\s\S]*?\n[ \t]*\*[ \t]*(v\d+(?:\.\d+)+)/.exec(String(src || '')); return m ? m[1] : ''; }
function emtSelfCmp(a, b) {
  var x = String(a).replace(/^v/, '').split('.'), y = String(b).replace(/^v/, '').split('.');
  for (var i = 0; i < Math.max(x.length, y.length); i++) { var d = (Number(x[i]) || 0) - (Number(y[i]) || 0); if (d) return d < 0 ? -1 : 1; }
  return 0;
}
/* '' when the fetched source looks like a real release, else why not */
function emtSelfSane(src) {
  if (src.length <= EMT_SELF_MIN_CHARS) return 'too short (' + src.length + ' characters)';
  for (var i = 0; i < EMT_SELF_MARKS.length; i++) if (src.indexOf(EMT_SELF_MARKS[i]) < 0) return 'missing "' + EMT_SELF_MARKS[i] + '"';
  if (!emtSelfVersion(src)) return 'no version in the CHANGELOG';
  try { new Function(src); }                 /* parses only; nothing runs */
  catch (e) {
    if (e && e.name === 'SyntaxError') return 'syntax error: ' + String(e.message || e).slice(0, 140);
    Logger.log('Self-update: the syntax check could not run here (' + e + ')');
    return '';
  }
  /* loads: its top level (constants only) runs inside a function, so nothing here is replaced, and it defines its own
   * entry points (not the ones of the code running now, which a bare typeof would also see). A file that throws as it
   * loads would break every trigger and the web app, the self-update included. */
  var probe = '\n;var G__ = typeof globalThis !== "undefined" ? globalThis : (function () { return this; })();\nreturn [' +
    ['doGet', 'doPost', 'aiTick', 'selfUpdateTick'].map(function (n) { return '(typeof ' + n + ' === "function" && ' + n + ' !== G__.' + n + ' ? "" : "' + n + '")'; }).join(', ') +
    '].filter(String).join(", ");';
  try {
    var missing = new Function(src + probe)();
    if (missing) return 'no ' + missing + ' function of its own';
  } catch (e) { return 'an error as it loads: ' + String((e && e.message) || e).slice(0, 140); }
  return '';
}
/* '' when appsscript.json keeps the web app settings, else why not: a version made from a manifest without "webapp"
 * is not a web app, and pointing the deployment at it would take the app's backend down */
function emtSelfManifest(files) {
  var m = (files || []).filter(function (f) { return f && f.type === 'JSON' && f.name === 'appsscript'; })[0], j = null;
  try { j = JSON.parse(m ? m.source : ''); } catch (e) { j = null; }
  if (!j || typeof j !== 'object') return 'appsscript.json could not be read';
  if (!j.webapp) return 'appsscript.json has no "webapp" section, so a new version would not be a web app; add "webapp": {"executeAs": "USER_DEPLOYING", "access": "ANYONE_ANONYMOUS"} to it (keep the rest)';
  return '';
}
function emtSelfSet(state, kind) {
  emtProps().setProperty('EMT_SELF_STATE', state);
  Logger.log('Self-update: ' + state);
  return { ok: kind === 'current' || kind === 'updated', stopped: kind, state: state };
}
/* not set up (or not allowed): recorded every time, logged at most once a day */
function emtSelfOff(reason) {
  var p = emtProps(), state = 'off: ' + reason, day = new Date().toISOString().slice(0, 10);
  p.setProperty('EMT_SELF_STATE', state);
  if (p.getProperty('EMT_SELF_OFF_DAY') !== day) { p.setProperty('EMT_SELF_OFF_DAY', day); Logger.log('Self-update: ' + state + ' (logged once a day)'); }
  return { ok: false, stopped: 'off', state: state };
}
function emtSelfApi(method, path, body) {
  var o = { method: method, muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() } };
  if (body) { o.contentType = 'application/json'; o.payload = JSON.stringify(body); }
  var res = UrlFetchApp.fetch(EMT_SELF_API + encodeURIComponent(ScriptApp.getScriptId()) + path, o);
  var r = { code: res.getResponseCode(), text: String(res.getContentText() || ''), json: null };
  try { r.json = JSON.parse(r.text); } catch (e) { }
  return r;
}
function emtSelfErr(r) { var m = r.json && r.json.error && r.json.error.message; return String(m || r.text || '').replace(/\s+/g, ' ').slice(0, 160); }
function emtSelfOffReason(r) {
  var m = emtSelfErr(r);
  if (/usersettings|User has not enabled/i.test(m)) return 'the Apps Script API is not turned on (script.google.com/home/usersettings)';
  if (/has not been used|is disabled|SERVICE_DISABLED|accessNotConfigured/i.test(m)) return 'the Apps Script API is off in this script\'s Google Cloud project (' + m.slice(0, 120) + ')';
  if (/scope/i.test(m)) return 'appsscript.json lacks the script.projects and script.deployments scopes';
  return 'HTTP ' + r.code + (m ? ', ' + m.slice(0, 100) : '');
}
function emtSelfApiUrl() {
  var r = emtRows('Specials').filter(function (x) { return String(x.Setting).trim() === 'API URL'; })[0];
  return r ? String(r.Value || '').trim() : '';
}
/* the web app deployment to point at the new version: { d, how } | { error } | { off } */
function emtSelfDeployment() {
  var list = [], token = '', pages = 0;
  do {
    var r = emtSelfApi('get', '/deployments?pageSize=50' + (token ? '&pageToken=' + encodeURIComponent(token) : ''));
    if (r.code === 401 || r.code === 403) return { off: emtSelfOffReason(r) };
    if (r.code !== 200) return { error: 'listing the deployments failed, HTTP ' + r.code + ' ' + emtSelfErr(r) };
    list = list.concat((r.json && r.json.deployments) || []);
    token = (r.json && r.json.nextPageToken) || '';
  } while (token && ++pages < 5);
  var versioned = function (d) { return !!(d && d.deploymentConfig && d.deploymentConfig.versionNumber); };   /* HEAD has none */
  var webs = function (d) { return ((d && d.entryPoints) || []).filter(function (e) { return e && e.webApp; }).map(function (e) { return String(e.webApp.url || ''); }); };
  var want = emtProps().getProperty('EMT_SELF_DEPLOYMENT');
  if (want) {
    var w = list.filter(function (d) { return d && d.deploymentId === want; })[0];
    return w ? { d: w, how: 'EMT_SELF_DEPLOYMENT' } : { error: 'EMT_SELF_DEPLOYMENT (' + want + ') is not a deployment of this project' };
  }
  var api = emtSelfApiUrl();
  var key = function (u) { return String(u || '').trim().replace(/[?#].*$/, '').replace(/\/+$/, ''); };
  var sid = function (u) { var m = /\/s\/([^\/?#]+)/.exec(String(u || '')); return m ? m[1] : ''; };
  if (api) {
    var hit = list.filter(function (d) { return versioned(d) && (sid(api) === d.deploymentId || webs(d).some(function (u) { return key(u) === key(api); })); });
    if (hit.length === 1) return { d: hit[0], how: 'the API URL in Specials' };
  }
  var cands = list.filter(function (d) { return versioned(d) && webs(d).length; });
  if (cands.length === 1) return { d: cands[0], how: 'the only web app deployment' };
  return { error: cands.length ? cands.length + ' web app deployments and none is the API URL in Specials; set EMT_SELF_DEPLOYMENT to the right deployment ID'
    : 'no versioned web app deployment to update' };
}

/* does the web app deployment run this source? { dep, same } | { dep, stale } | { off } | { error } */
function emtSelfLive(name, src) {
  var dep = emtSelfDeployment();
  if (dep.off) return { off: dep.off };
  if (dep.error) return { error: dep.error };
  var v = dep.d.deploymentConfig.versionNumber, r = emtSelfApi('get', '/content?versionNumber=' + encodeURIComponent(v));
  if (r.code === 401 || r.code === 403) return { off: emtSelfOffReason(r) };
  var files = r.code === 200 && r.json && r.json.files;
  if (!files) return { error: 'reading version ' + v + ' failed, HTTP ' + r.code + ' ' + emtSelfErr(r) };
  var js = files.filter(function (f) { return f && f.type === 'SERVER_JS'; });
  var f = js.filter(function (x) { return x.name === name; })[0] || (js.length === 1 ? js[0] : null);
  return f && emtSelfNorm(f.source) === emtSelfNorm(src) ? { dep: dep, same: true } : { dep: dep, stale: true };
}

/* the code is in: save a version (unless saved already) and point the web app at it */
function emtSelfFinish(pend, dep) {
  var p = emtProps(), ver = pend.ver || '?';
  var half = function (what) {
    return emtSelfSet('half: the code is ' + ver + ' (the triggers already run it) but the web app still runs the old version: ' + what +
      '. The next check tries again (or Deploy → Manage deployments → edit → New version).', 'half');
  };
  if (!dep) dep = emtSelfDeployment();
  if (dep.off) return half('listing the deployments was refused (' + dep.off + ')');
  if (dep.error) return half(dep.error);
  if (!pend.version) {
    var v = emtSelfApi('post', '/versions', { description: 'auto ' + ver });
    if (v.code !== 200 || !v.json || !v.json.versionNumber) return half('saving a version failed, HTTP ' + v.code + ' ' + emtSelfErr(v));
    pend.version = v.json.versionNumber;
    p.setProperty('EMT_SELF_PENDING', JSON.stringify(pend));
  }
  var d = dep.d, u = emtSelfApi('put', '/deployments/' + encodeURIComponent(d.deploymentId),
    { deploymentConfig: { scriptId: ScriptApp.getScriptId(), versionNumber: pend.version, manifestFileName: 'appsscript', description: 'auto ' + ver } });
  if (u.code !== 200) return half('version ' + pend.version + ' is saved, but pointing the web app at it failed, HTTP ' + u.code + ' ' + emtSelfErr(u));
  p.deleteProperty('EMT_SELF_PENDING');
  p.setProperty('EMT_SELF_LAST_HASH', pend.hash);
  var state = 'updated to ' + ver + ' v' + pend.version + ' at ' + new Date().toISOString() +
    (pend.version >= 180 ? ' (version ' + pend.version + ': Apps Script keeps at most 200; delete old ones under Project History)' : '');
  p.setProperty('EMT_SELF_UPDATED', state + ' (web app ' + d.deploymentId + ', found by ' + dep.how + ')');
  return emtSelfSet(state, 'updated');
}

/* one check. force (selfUpdateNow) overwrites a hand-edited project too */
function emtSelfUpdate(force) {
  var p = emtProps(), res = UrlFetchApp.fetch(EMT_SELF_SRC + '?cb=' + Date.now(), { muteHttpExceptions: true }), code = res.getResponseCode();
  if (code !== 200) {
    var m = 'GitHub answered HTTP ' + code + ' for Code.gs; nothing changed.';
    Logger.log('Self-update: ' + m);
    return { ok: false, stopped: 'fetch', state: m };
  }
  var src = emtSelfNorm(res.getContentText()) + '\n', why = emtSelfSane(src);
  if (why) return emtSelfSet('refused: the repo copy has ' + why + '. Nothing changed.', 'refused');
  var ver = emtSelfVersion(src), hash = emtMd5hex(src);
  var g = emtSelfApi('get', '/content');
  if (g.code === 401 || g.code === 403) return emtSelfOff(emtSelfOffReason(g));
  var files = g.code === 200 && g.json && g.json.files;
  if (!files || !files.length) return emtSelfSet('error: reading this project failed, HTTP ' + g.code + ' ' + emtSelfErr(g), 'error');
  var js = files.filter(function (f) { return f && f.type === 'SERVER_JS'; });
  var target = js.length === 1 ? js[0] : (js.filter(function (f) { return String(f.source || '').indexOf('function doPost') > -1; })[0] || js.filter(function (f) { return f.name === 'Code'; })[0]);
  if (!target) return emtSelfSet('error: this project has no Code file', 'error');
  var cur = emtSelfVersion(target.source);
  if (cur && emtSelfCmp(ver, cur) < 0) return emtSelfSet('refused: the repo has ' + ver + ' but this project runs ' + cur + ', which is newer. Nothing changed.', 'refused');
  var pend = null;
  try { pend = JSON.parse(p.getProperty('EMT_SELF_PENDING') || 'null'); } catch (e) { pend = null; }
  if (emtSelfNorm(target.source) === emtSelfNorm(src)) {
    if (pend && pend.hash === hash) return emtSelfFinish(pend, null);    /* the code went in last time; switch the web app */
    if (pend) p.deleteProperty('EMT_SELF_PENDING');
    if (force || p.getProperty('EMT_SELF_LAST_HASH') !== hash) {
      /* the editor has it but this never switched the web app to it (pasted by hand without a new deployment, or a
       * write whose answer was lost): make sure the web app runs it too */
      var live = emtSelfLive(target.name, src);
      if (live.off) return emtSelfOff(live.off);
      if (live.error) return emtSelfSet('current: ' + ver + ' in the editor, but the web app could not be checked (' + live.error + '); the next check tries again', 'current');
      if (live.stale) {
        var man0 = emtSelfManifest(files);
        if (man0) return emtSelfSet('refused: the web app runs an older version than the editor, but ' + man0 + '. Nothing changed.', 'refused');
        pend = { hash: hash, ver: ver, at: new Date().toISOString() };
        p.setProperty('EMT_SELF_PENDING', JSON.stringify(pend));
        return emtSelfFinish(pend, live.dep);
      }
    }
    p.setProperty('EMT_SELF_LAST_HASH', hash);
    return emtSelfSet('current: ' + ver + ' (checked ' + new Date().toISOString() + ')', 'current');
  }
  if (!force && p.getProperty('EMT_SELF_LAST_HASH') === hash) {
    return emtSelfSet('drift: this project was changed by hand after ' + ver + ' came from the repo. Left alone until the repo changes; run selfUpdateNow to overwrite it.', 'drift');
  }
  var man = emtSelfManifest(files);
  if (man) return emtSelfSet('refused: ' + man + '. Nothing changed.', 'refused');
  var dep = emtSelfDeployment();                                            /* chosen before anything is written */
  if (dep.off) return emtSelfOff(dep.off);
  if (dep.error) return emtSelfSet('refused: ' + dep.error + '. Nothing changed.', 'refused');
  var put = emtSelfApi('put', '/content', { files: files.map(function (f) { return { name: f.name, type: f.type, source: f === target ? src : f.source }; }) });
  if (put.code !== 200) return emtSelfSet('error: writing the new code failed, HTTP ' + put.code + ' ' + emtSelfErr(put) + '. Nothing changed.', 'error');
  pend = { hash: hash, ver: ver, at: new Date().toISOString() };
  p.setProperty('EMT_SELF_PENDING', JSON.stringify(pend));
  return emtSelfFinish(pend, dep);
}

function emtSelfRun(force) {
  if (!emtFlagClaim('EMT_SELF_BUSY', EMT_SELF_BUSY_MS)) return { ok: false, stopped: 'busy', state: 'another update is running; try again in a few minutes' };
  try { return emtSelfUpdate(force); }
  catch (e) { return emtSelfSet('error: ' + String((e && e.message) || e).slice(0, 200), 'error'); }
  finally { emtProps().deleteProperty('EMT_SELF_BUSY'); }
}

/* aiTick: at most once an hour, unless EMT_SELF_UPDATE = off */
function selfUpdateTick(startedAt) {
  var p = emtProps();
  if (String(p.getProperty('EMT_SELF_UPDATE') || '').toLowerCase() === 'off') return { ok: true, stopped: 'disabled' };
  var now = Date.now(), last = Number(p.getProperty('EMT_SELF_CHECKED') || 0);
  if (last && now - last >= 0 && now - last < EMT_SELF_EVERY_MS) return { ok: true, stopped: 'gate' };
  if (typeof startedAt === 'number' && now - startedAt > EMT_SELF_LATE_MS) return { ok: true, stopped: 'late' };
  p.setProperty('EMT_SELF_CHECKED', String(now));
  return emtSelfRun(false);
}

/* menu: Update Code.gs from GitHub now (no hourly gate; overwrites hand edits; also installs the aiTick trigger if
 * it is missing, so the hourly checks run) */
function selfUpdateNow() {
  emtProps().setProperty('EMT_SELF_CHECKED', String(Date.now()));
  var r = emtSelfRun(true), trig = '';
  try {
    if (!ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'aiTick'; })) {
      ScriptApp.newTrigger('aiTick').timeBased().everyMinutes(15).create();
      trig = ' The 15-minute aiTick trigger was missing; it is installed now.';
    }
  } catch (e) { trig = ' (The triggers could not be checked: ' + ((e && e.message) || e) + ')'; }
  var msg = 'Code.gs self-update: ' + (r.state || r.stopped) + trig;
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) { Logger.log(msg); }   /* no UI from the editor */
  return r;
}

function selfUpdateStatus() {
  var p = emtProps(), last = Number(p.getProperty('EMT_SELF_CHECKED') || 0), state = p.getProperty('EMT_SELF_STATE') || 'no check yet';
  Logger.log('Self-update' + (String(p.getProperty('EMT_SELF_UPDATE') || '').toLowerCase() === 'off' ? ' (turned off: EMT_SELF_UPDATE = off)' : '') + ': ' + state +
    '. Last check: ' + (last ? new Date(last).toISOString() : 'never') + '. Last update: ' + (p.getProperty('EMT_SELF_UPDATED') || 'none') +
    (p.getProperty('EMT_SELF_PENDING') ? '. Unfinished: ' + p.getProperty('EMT_SELF_PENDING') : '') + '.');
  return state;
}
