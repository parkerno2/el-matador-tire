/* supabase/functions/ingest/transform.esm.js: the ingest's pure pipeline (no I/O), the Code.gs refresh as one
   function build(raw, statics, opts) that returns every tab the Sheet has. Was generated from a transform.js that is
   not in the repo; since 10 Oct 2026 (Q8) this file is the source and tests/supabase.js runs it. Keep every tab's
   header exactly as Code.gs writes it: the parity report (fplgg/tools/parity) compares them column for column. */
export default (function () {
  'use strict';

  var POS = { 1: 'GKP', 2: 'DEF', 3: 'MID', 4: 'FWD' };

  /* ---------- league defaults (El Matador). Product: these come from league config. ---------- */
  var DEFAULTS = {
    leagueId: 45380,
    midseasonGw: 19,
    prizes: { first: 600, second: 180, third: 60, mid: 90, motm: 30, buyIn: 150, pot: 1200 },
    motmPeriods: [
      { name: 'Aug & Sep', from: 1, to: 5 }, { name: 'October', from: 6, to: 9 },
      { name: 'November', from: 10, to: 12 }, { name: 'December', from: 13, to: 18 },
      { name: 'January', from: 19, to: 23 }, { name: 'February', from: 24, to: 27 },
      { name: 'March', from: 28, to: 30 }, { name: 'April', from: 31, to: 33 },
      { name: 'May', from: 34, to: 38 }
    ],
    ratings: { version: 'v3.1', cap: 95, boostTiers: [[3, 4], [8, 3], [14, 2], [20, 1]], overrides: { 'bfernandes': 93 } },
    clubMult: { ARS: 1.07, LIV: 1.05, MCI: 1.05, CHE: 1.04, AVL: 1.01, NEW: 1.01,
      TOT: 0.99, MUN: 0.99, BHA: 0.99, CRY: 0.98, BOU: 0.98, BRE: 0.97, FUL: 0.96,
      EVE: 0.96, WHU: 0.95, WOL: 0.93, LEE: 0.93, SUN: 0.92, BUR: 0.90, COV: 0.88 }
  };

  /* Same fallback table Code.gs carries (opta code → ISO nation). */
  var NATFALLBACK = {154561:'ES',85633:'BE',472769:'GB-ENG',437499:'FR',491279:'NL',227444:'RS',462424:'FR',204480:'GB-ENG',244851:'GB-ENG',215379:'GB-ENG',513418:'DE',195546:'AR',224117:'SE',482973:'BR',463067:'FR',215059:'ES',485055:'CZ',17761:'GB-ENG',169528:'US',221820:'AR',445087:'UY',610799:'HR',439509:'GR',437730:'GH',208706:'BR',244850:'GB-ENG',231747:'FR',470313:'DE',441264:'NL',200720:'IE',172649:'GB-ENG',226597:'BR',209036:'GB-ENG',221466:'AR',106611:'GB-ENG',231416:'TR',435997:'CH',215413:'GB-ENG',484420:'FR',466525:'DE',60307:'DE',475168:'BR',50175:'GB-ENG',177815:'GB-ENG',204936:'IT',109745:'ES',97032:'NL',216051:'PT',448104:'EC',477424:'HR',198869:'GB-ENG',209244:'GB-ENG',222531:'GB-ENG',232413:'GB-ENG',247632:'PT',114283:'GB-ENG',517052:'SN',178301:'GB-ENG',60689:'NZ',111234:'GB-ENG',432720:'GB-ENG',494521:'FR',427623:'US',215136:'GB-WLS',200834:'FR',78916:'GB-ENG',499604:'BR',424876:'HU',533463:'BF',153682:'GB-WLS',430871:'BR',223094:'NO',485711:'SI',690838:'GB-ENG',465247:'BE',80201:'DE',466075:'IT',225796:'GB-ENG',487838:'GB-ENG',445122:'NL',480455:'GB-ENG',172780:'GB-ENG',448047:'AR',184029:'NO',494595:'DE',503139:'GB-ENG',219168:'SE',486385:'GW',216646:'CD',98980:'AR',116535:'BR',441164:'ES',465351:'PT',544877:'HU',216094:'NL',500040:'ES',141746:'PT',176297:'GB-ENG',466052:'FR',248857:'GB-ENG',460842:'GH',438234:'EG',502500:'BR',444102:'BR',498016:'NL',98747:'GB-ENG',247348:'CO',469142:'NL',432830:'IE',171314:'PT',223827:'GB-NIR',223340:'GB-ENG',446008:'CM',243298:'NL',248875:'BE',232185:'SN',219847:'DE',212319:'BR',538207:'DK',560262:'FR'};

  function normName(n) {
    return String(n || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');
  }

  /* ---------- projection model v2 (verbatim) ---------- */
  function projPoints(p, clubShort, clubMult) {
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
    var club = clubMult[clubShort] || 0.96;
    var mult = { a: 1, d: 0.85, i: 0.55, s: 0.75, u: 0.05, n: 1 }[p.status] || 1;
    return Math.round(base * club * mult);
  }

  /* ---------- per-pick grades (verbatim) ---------- */
  function gradePicks(picks) {
    var sorted = picks.slice().sort(function (a, b) { return b.proj - a.proj; }).map(function (p) { return p.proj; });
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
      if (p.minutes >= 1500) ex += 'Rate-based: ' + p.lastPts + ' pts in ' + p.minutes + ' mins last season (' + p90 + '/90, xGI ' + p.xgi.toFixed(1) + ').';
      else if (p.minutes > 0) ex += 'Small sample — ' + p.lastPts + ' pts in only ' + p.minutes + ' mins (' + p90 + '/90), so this leans on FPL rank ' + p.rank + '.';
      else ex += 'No PL minutes last season — projection rests entirely on FPL rank ' + p.rank + '.';
      if (p.news) ex += ' ⚠ ' + p.news + '.';
      p.explain = ex;
    });
  }

  /* ---------- best legal XI (verbatim) ---------- */
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

  /* ---------- team grading (verbatim) ---------- */
  function gradeTeams(teams, picks) {
    var rows = Object.keys(teams).map(function (entry) {
      var t = teams[entry];
      var squad = picks.filter(function (p) { return p.entry == entry; });
      var xi = bestXI(squad);
      var xiIds = {}; xi.forEach(function (p) { xiIds[p.el] = true; });
      var xiPts = xi.reduce(function (s, p) { return s + p.proj; }, 0);
      var benchPts = squad.filter(function (p) { return !xiIds[p.el]; }).reduce(function (s, p) { return s + p.proj; }, 0);
      var value = squad.reduce(function (s, p) { return s + p.value; }, 0);
      var risks = squad.filter(function (p) { return 'isud'.indexOf(p.status) > -1; });
      var risk = risks.reduce(function (s, p) { return s + (16 - p.round); }, 0);
      var best = squad.slice().sort(function (a, b) { return b.value - a.value; })[0];
      var reach = squad.slice().sort(function (a, b) { return a.value - b.value; })[0];
      var top3 = squad.slice().sort(function (a, b) { return b.proj - a.proj; }).slice(0, 3);
      return { team: t.name, manager: t.manager, entry: t.entry, waiver: t.waiver,
        strength: xiPts + 0.2 * benchPts, xiPts: xiPts, benchPts: benchPts, value: value, risk: risk, top3: top3,
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
    var ord = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th', '13th', '14th', '15th', '16th'];
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

  /* ---------- ratings (verbatim semantics; sheet reads replaced by `statics`) ----------
   * statics.existingRatings = { 'normname|POS': ovr } read from the current Ratings tab
   * statics.ratingsVersion  = the version string in Ratings!H1 (sameVersion check)
   * statics.fc27 / statics.fc26 = { code: ovr }  */
  function computeRatings(rosterPlayers, statics, cfgR) {
    var sameVersion = statics.ratingsVersion === cfgR.version;
    var existing = sameVersion ? (statics.existingRatings || {}) : {};
    var fc27 = statics.fc27 || {}, fc26 = statics.fc26 || {};
    var ranked = rosterPlayers.slice().sort(function (a, b) { return b.proj - a.proj; });
    var boost = {};
    ranked.forEach(function (p, i) {
      var b = 0;
      for (var t = 0; t < cfgR.boostTiers.length; t++) if (i < cfgR.boostTiers[t][0]) { b = cfgR.boostTiers[t][1]; break; }
      boost[p.el] = b;
    });
    var curveNew = rosterPlayers.filter(function (p) {
      return !(normName(p.player) + '|' + p.pos in existing) && !fc27[String(p.code)] && !fc26[String(p.code)];
    }).sort(function (a, b) { return b.proj - a.proj; });
    var n = curveNew.length;
    var rows = [];
    rosterPlayers.forEach(function (p) {
      var key = normName(p.player) + '|' + p.pos;
      var ov = cfgR.overrides[key] || cfgR.overrides[normName(p.player)];
      var ovr;
      if (ov) ovr = ov;
      else if (key in existing) ovr = existing[key];
      else {
        var base = fc27[String(p.code)] || fc26[String(p.code)];
        var spec = /^R[12]\./.test(p.drafted || '');
        if (base) {
          var b = boost[p.el] || 0;
          if (spec) b = Math.max(b, 2);
          ovr = Math.min(cfgR.cap, base + (sameVersion ? 0 : b));
          if (!sameVersion && spec && ovr < 83) ovr = 83;
        } else {
          var i = curveNew.indexOf(p);
          ovr = n > 1 ? Math.round(64 + 20 * (1 - Math.pow(i / (n - 1), 1.6))) : 76;
        }
      }
      p.ovr = ovr;
      rows.push([p.player, p.pos, p.club, p.team, ovr, ovr >= 85 ? 'elite' : (ovr >= 78 ? 'gold' : 'silver')]);
    });
    return { header: ['Player', 'Pos', 'Club', 'Owner', 'OVR', 'Band'], rows: rows, version: cfgR.version };
  }

  /* ---------- classic live overlay (Code.gs v3.2 port, 31 Aug 2026) ----------
   * The draft event/{gw}/live feed can freeze mid-match (30 Aug incident: MUN lines stuck at 0'
   * with the game at 82'); the classic feed runs on a separate pipeline with the same stat schema.
   * Per player, joined on code: take the classic line when it reports MORE minutes, or the same
   * minutes with bonus already landed; otherwise keep the draft line (the league's scoring source).
   * Stale never overwrites fresh, so when the draft feed catches up nothing needs undoing.
   * Pure: classicLive is fetched by the caller (classic event/{gw}/live/). */
  function mergeClassicLive(gwLive, boot, classicIdToCode, classicLive) {
    var out = { used: 0, seen: 0 };
    if (!classicIdToCode || !Object.keys(classicIdToCode).length) return { gwLive: gwLive, stats: out };
    var cl = classicLive;
    if (!cl || !cl.elements || !cl.elements.length) return { gwLive: gwLive, stats: out };
    var byCode = {};
    cl.elements.forEach(function (e) { var c = classicIdToCode[e.id]; if (c) byCode[c] = e.stats || null; });
    if (!gwLive || !gwLive.elements) gwLive = { elements: {} };
    boot.elements.forEach(function (p) {
      var cs = byCode[p.code]; if (!cs) return;
      out.seen++;
      var d = gwLive.elements[p.id], ds = (d && d.stats) || {};
      var dm = ds.minutes || 0, cm = cs.minutes || 0;
      var fresher = cm > dm || (cm === dm && cm > 0 && (cs.bonus || 0) > (ds.bonus || 0));
      if (!fresher) return;
      if (!d) gwLive.elements[p.id] = { stats: cs, explain: [] };
      else d.stats = cs;
      out.used++;
    });
    return { gwLive: gwLive, stats: out };
  }

  /* ---------- Code.gs v3.6: waiver and free-agent result codes, the Transactions 'Result' column ---------- */
  var TX_RESULT = { 'a': 'Accepted', 'di': 'Denied (invalid)', 'dp': 'Denied (priority)', 'do': 'Denied (drop gone)',
    'pd': 'Pending', 'r': 'Rejected', 'o': 'Out-prioritised' };
  function txResultLabel(code, map) {
    var c = String(code == null ? '' : code).trim(), m = map || TX_RESULT;
    if (!c) return '';
    return Object.prototype.hasOwnProperty.call(m, c) ? m[c] : 'Denied';
  }

  /* ---------- Code.gs v3.22: a club's Str H and Str A (FPL's 1 to 5 fixture difficulty), classic team first ---------- */
  var CLUB_STR_FIELDS = ['strength_overall_home', 'strength_overall_away'];
  function clubStrengthRow(classicTeam, draftTeam) {
    return CLUB_STR_FIELDS.map(function (k) {
      var v = (classicTeam && classicTeam[k] != null && classicTeam[k] !== '') ? classicTeam[k] : (draftTeam && draftTeam[k]);
      var n = Number(v);
      return (v == null || v === '' || isNaN(n) || n < 1 || n > 5) ? '' : n;
    });
  }

  /* ---------- Code.gs v3.21 (BUGS #8): the current gameweek's BPS and bonus per fixture ----------
   * A GW Stats row sums a player's whole gameweek, so in a double gameweek the app cannot rank one match's BPS. FPL
   * publishes the lists per fixture: the draft live feed's fixtures (stats s/identifier bps and bonus with draft ids)
   * and the classic fixtures feed (the same with classic ids). Per fixture the fresher feed wins (the classic one
   * when it lists more players, or has the bonus the draft one lacks). The tab is the current gameweek only. */
  var FIXBPS_HEAD = ['GW', 'Fixture', 'Home', 'Away', 'Kickoff (UTC)', 'Started', 'Finished', 'Code', 'Player', 'Club', 'BPS', 'Bonus'];
  function fixBpsFromFeed(fixtures, gw, idToCode) {
    var out = {};
    (Array.isArray(fixtures) ? fixtures : []).forEach(function (f) {
      if (!f || f.id == null || (f.event != null && Number(f.event) !== Number(gw))) return;
      var o = { id: f.id, h: f.team_h, a: f.team_a, kickoff: f.kickoff_time || '', started: !!f.started, finished: !!(f.finished || f.finished_provisional), bps: {}, bonus: {} };
      (f.stats || []).forEach(function (st) {
        var key = st.identifier || st.s;
        if (key !== 'bps' && key !== 'bonus') return;
        ['h', 'a'].forEach(function (side) {
          (st[side] || []).forEach(function (e) {
            var code = idToCode[e.element];
            if (code != null && e.value != null) o[key][String(code)] = Number(e.value) || 0;
          });
        });
      });
      out[String(f.code != null ? f.code : f.id)] = o;
    });
    return out;
  }
  /* { header, rows, gw } ; rows is null when neither feed lists the gameweek's fixtures (the tab is then left as it was) */
  function fixtureBps(boot, gwLive, curEv, classicIdToCode, classicFixtures) {
    if (!curEv) return { header: FIXBPS_HEAD, rows: null, gw: null };
    var dId = {}, names = {}, clubs = {};
    boot.elements.forEach(function (e) { dId[e.id] = e.code; names[String(e.code)] = e; });
    boot.teams.forEach(function (t) { clubs[t.id] = t.short_name; });
    var draft = fixBpsFromFeed(gwLive && gwLive.fixtures, curEv, dId);
    var classic = (classicIdToCode && Object.keys(classicIdToCode).length) ? fixBpsFromFeed(classicFixtures, curEv, classicIdToCode) : {};
    var keys = {};
    Object.keys(draft).forEach(function (k) { keys[k] = 1; });
    Object.keys(classic).forEach(function (k) { keys[k] = 1; });
    var list = Object.keys(keys);
    if (!list.length) return { header: FIXBPS_HEAD, rows: null, gw: curEv };
    var rows = [], n = function (o) { return Object.keys(o).length; };
    list.map(function (k) {
      var d = draft[k], c = classic[k];
      var fresher = !!(c && (!d || n(c.bps) > n(d.bps) || (n(c.bonus) && !n(d.bonus))));
      return fresher ? c : d;
    }).sort(function (x, y) { return (x.kickoff < y.kickoff ? -1 : x.kickoff > y.kickoff ? 1 : 0) || x.id - y.id; }).forEach(function (f) {
      Object.keys(f.bps).sort(function (x, y) { return f.bps[y] - f.bps[x] || (x < y ? -1 : 1); }).forEach(function (code) {
        var p = names[code] || {};
        rows.push([curEv, f.id, clubs[f.h] || f.h, clubs[f.a] || f.a, "'" + f.kickoff, f.started, f.finished,
          code, p.web_name || '', clubs[p.team] || '', f.bps[code], f.bonus[code] || 0]);
      });
    });
    return { header: FIXBPS_HEAD, rows: rows, gw: curEv };
  }

  /* ---------- nations: pulselive's season players list (Code.gs getNationMap since September 2026) ----------
   * The compseasons/{id}/teams and staff endpoints the first ingest called answer empty since September; the
   * season-wide players list still carries every registered player with the opta id (= FPL code) and the nation. */
  var PULSE = 'https://footballapi.pulselive.com/football/';
  function pulsePlayersUrl(season, page) { return PULSE + 'players?pageSize=100&compSeasons=' + season + '&altIds=true&type=player&id=-1&page=' + page; }
  /* one page's rows as [{ code, iso }], and how many entries the list has in all */
  function pulseNations(json) {
    var rows = [];
    ((json && json.content) || []).forEach(function (p) {
      var opta = p.altIds && p.altIds.opta ? String(p.altIds.opta).replace(/^p/, '') : null;
      var iso = p.nationalTeam && p.nationalTeam.isoCode;
      if (opta && /^\d+$/.test(opta) && iso) rows.push({ code: Number(opta), iso: String(iso) });
    });
    return { rows: rows, total: (json && json.pageInfo && json.pageInfo.numEntries) || 0 };
  }

  /* ---------- Specials: the POTM rows from the repo's potm.json (Code.gs v3.30) ----------
   * rows is the tab as it stands ([[Setting, Value], ...] without the header); file is { month, code, player } or
   * null (no file, or one that could not be used); players is the Players tab's rows (Code first, Player second).
   * The two POTM rows exist afterwards (appended blank when missing, as Code.gs does); a hand edit for the same
   * month is kept; the player written is the Players tab's own string for the file's code, else the file's name.
   * Every other row (the API URL) is kept as it is. Returns { rows, wrote: { month, player } | null }. */
  function specialsRows(rows, file, players) {
    var out = (rows || []).map(function (r) { return [r[0], r.length > 1 ? r[1] : '']; });
    var at = function (setting) {
      for (var i = 0; i < out.length; i++) if (String(out[i][0]).trim() === setting) return i;
      out.push([setting, '']); return out.length - 1;
    };
    var mi = at('POTM month'), pi = at('POTM player');
    var norm = function (v) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().toLowerCase(); };
    if (!file || !file.month) return { rows: out, wrote: null };
    var was = norm(out[mi][1]), m = norm(file.month);
    if (was && (was === m || was === m.split(' ')[0])) return { rows: out, wrote: null };
    var name = '';
    if (file.code) (players || []).some(function (r) { if (String(r[0]).replace(/\.0$/, '') === String(file.code) && String(r[1] || '').trim()) { name = String(r[1]).trim(); return true; } return false; });
    if (!name) name = String(file.player || '').trim();
    if (!name) return { rows: out, wrote: null };
    out[pi][1] = name; out[mi][1] = String(file.month).replace(/\s+/g, ' ').trim();
    return { rows: out, wrote: { month: out[mi][1], player: name } };
  }
  /* the file's contents checked as Code.gs checks them: { month, code, player } or null */
  function potmFile(j) {
    if (!j || typeof j !== 'object' || Array.isArray(j)) return null;
    var month = String(j.month == null ? '' : j.month).replace(/\s+/g, ' ').trim(), player = String(j.player == null ? '' : j.player).replace(/\s+/g, ' ').trim(), c = Number(j.code);
    if (!month || month.length > 40) return null;
    if (!(c > 0) && !player) return null;
    return { month: month, code: c > 0 ? String(Math.floor(c)) : '', player: player.slice(0, 60) };
  }

  /* ---------- the pipeline ----------
   * raw = {
   *   boot         /api/bootstrap-static
   *   details      /api/league/{id}/details
   *   choices      /api/draft/{id}/choices
   *   estat        /api/league/{id}/element-status   (may be null)
   *   gwLive       /api/event/{curGw}/live            (may be null)
   *   lineups      { entryId: { elementId: slot } }    from /api/entry/{e}/event/{gw} (post-deadline only)
   *   fixtures     concat of /api/event/{gw}/fixtures for gw 1..38
   *   transactions /api/draft/league/{id}/transactions (may be null)
   *   finishedLive { gw: /api/event/{gw}/live }        for finished GWs needing GW Stats backfill / GW Log
   *   finishedLineups { gw: { entryId: { el: slot } } } for the GW Log's last finished GW
   *   classic      { boot: classic /bootstrap-static/, fixtures: classic /fixtures/, dream: classic /dream-team/{lastDone}/ } (optional supplement)
   * }
   * statics = { fc27, fc26, existingRatings, ratingsVersion, natMap, gwStatsFinal:{gw:true}, gwLogLogged:{gw:true} }
   * opts    = { now: Date, config: overrides of DEFAULTS }
   */
  function build(raw, statics, opts) {
    opts = opts || {}; statics = statics || {};
    var cfg = Object.assign({}, DEFAULTS, opts.config || {});
    var now = opts.now || new Date();
    var nowIso = now.toISOString();
    var boot = raw.boot, details = raw.details, choices = raw.choices;
    var estat = raw.estat || { element_status: [] };
    var evs = boot.events.data || boot.events;

    var curEv = null;
    for (var i = 0; i < evs.length; i++) { if (!evs[i].finished) { curEv = evs[i].id; break; } }
    var gwLive = raw.gwLive || null;
    var lastDone = null; evs.forEach(function (e) { if (e.finished) lastDone = e.id; });

    var players = {}; boot.elements.forEach(function (e) { players[e.id] = e; });
    var clubs = {}; boot.teams.forEach(function (t) { clubs[t.id] = t.short_name; });
    var clubCodes = {}; boot.teams.forEach(function (t) { clubCodes[t.short_name] = t.code; });
    // classic supplement: ep_this/ep_next, badge codes, dream team of the last FINISHED GW
    var cByCode = {}, classicByCode = {}, cl = raw.classic || {}, classicIdToCode = {};
    boot.elements.forEach(function (e) { cByCode[e.code] = { dream: false }; classicByCode[e.code] = { ep_this: e.ep_this, ep_next: e.ep_next }; });
    if (cl.boot) {
      var idToCode = {};
      cl.boot.elements.forEach(function (e) { idToCode[e.id] = e.code; classicIdToCode[e.id] = e.code; classicByCode[e.code] = { ep_this: e.ep_this, ep_next: e.ep_next }; });
      (cl.boot.teams || []).forEach(function (t) { clubCodes[t.short_name] = t.code; });
      if (lastDone && cl.dream) (cl.dream.team || []).forEach(function (m) { var code = idToCode[m.element]; if (code && cByCode[code]) cByCode[code].dream = true; });
    }
    var fixtures = cl.fixtures || raw.fixtures || [];
    // classic live overlay (v3.2): repair a frozen draft live feed for the current GW
    var overlayStats = { used: 0, seen: 0 };
    if (curEv && cl.live) {
      var merged = mergeClassicLive(gwLive, boot, classicIdToCode, cl.live);
      gwLive = merged.gwLive; overlayStats = merged.stats;
    }

    var teams = {}, leToEntry = {};
    details.league_entries.forEach(function (le) {
      teams[le.entry_id] = { entry: le.entry_id, name: le.entry_name, manager: le.player_first_name + ' ' + le.player_last_name, waiver: le.waiver_pick, leagueEntry: le.id };
      leToEntry[le.id] = le.entry_id;
    });
    var lineups = raw.lineups || {};

    var picks = choices.choices.map(function (c) {
      var p = players[c.element] || {};
      return {
        overall: c.index, round: c.round, pick: c.pick, entry: c.entry, teamName: c.entry_name, el: c.element,
        player: p.web_name || ('#' + c.element), pos: POS[p.element_type] || '?', club: clubs[p.team] || '?',
        rank: p.draft_rank || 999, lastPts: p.total_points || 0, minutes: p.minutes || 0,
        xgi: parseFloat(p.expected_goal_involvements || 0), status: p.status || 'a', news: p.news || '',
        proj: projPoints(p, clubs[p.team], cfg.clubMult),
        value: c.round <= 11 ? Math.round(Math.max(c.index - (p.draft_rank || 999), -60) * (12 - c.round) / 11) : 0
      };
    });
    var grades = gradeTeams(teams, picks);
    gradePicks(picks);

    var T = {};
    T['Grades'] = { header: ['Rank', 'Team', 'Manager', 'Grade', 'Score', 'Proj XI pts', 'Draft value', 'Risk pts', 'Risk flags', 'Best pick', 'Biggest reach', 'Why'],
      rows: grades.map(function (g, i) { return [i + 1, g.team, g.manager, g.grade, Math.round(g.score * 100) / 100, Math.round(g.xiPts), g.value, g.risk, g.riskList, g.bestPick, g.reachPick, g.why]; }) };
    T['Draft Board'] = { header: ['Overall', 'Round', 'Pick', 'Team', 'Player', 'Pos', 'Club', 'FPL rank', 'Value vs rank', 'Proj pts', 'Mins', 'Pts/90', 'xGI', 'Pick grade', 'Status', 'News', 'Explanation'],
      rows: picks.map(function (p) {
        var p90 = p.minutes > 0 ? Math.round(10 * p.lastPts / (p.minutes / 90)) / 10 : 0;
        return [p.overall, p.round, p.pick, p.teamName, p.player, p.pos, p.club, p.rank, p.value, p.proj, p.minutes, p90, p.xgi, p.pickGrade, p.status, p.news, p.explain];
      }) };

    /* ----- rosters ----- */
    var byEl = {}; picks.forEach(function (p) { byEl[p.el] = p; });
    var squads = {};
    (estat.element_status || []).forEach(function (s) {
      if (s.owner == null) return;
      var entry = teams[s.owner] ? s.owner : leToEntry[s.owner];
      if (!teams[entry]) return;
      (squads[entry] = squads[entry] || []).push(s.element);
    });
    var ownerByEl = {};
    (estat.element_status || []).forEach(function (s) {
      if (s.owner == null) return;
      var entry = teams[s.owner] ? s.owner : leToEntry[s.owner];
      if (teams[entry]) ownerByEl[s.element] = teams[entry].name;
    });
    var allOwned = [], perEntry = {};
    Object.keys(teams).forEach(function (entry) {
      var els = (squads[entry] && squads[entry].length >= 10) ? squads[entry]
        : picks.filter(function (p) { return p.entry == entry; }).map(function (p) { return p.el; });
      var squad = els.map(function (el) {
        var p = players[el] || {}, d = byEl[el], lu = lineups[entry] || null;
        var lv = (gwLive && gwLive.elements && gwLive.elements[el]) ? gwLive.elements[el].stats : null;
        return { el: el, player: p.web_name || ('#' + el), pos: POS[p.element_type] || '?', club: clubs[p.team] || '?',
          rank: p.draft_rank || 999, proj: projPoints(p, clubs[p.team], cfg.clubMult), status: p.status || 'a', news: p.news || '',
          seasonPts: p.total_points || 0, code: p.code || '',
          totw: (cByCode[p.code] && cByCode[p.code].dream) ? 'TOTW' : '',
          gwPts: lv ? (lv.total_points || 0) : 0, gwMins: lv ? (lv.minutes || 0) : 0,
          slot: lu ? (lu[el] || 0) : 0, gwXI: lu ? (lu[el] && lu[el] <= 11 ? 'XI' : 'BEN') : '',
          team: teams[entry].name, drafted: (d && d.entry == entry) ? ('R' + d.round + '.' + d.pick) : 'WV' };
      });
      perEntry[entry] = squad; allOwned = allOwned.concat(squad);
    });
    T['Ratings'] = computeRatings(allOwned, statics, cfg.ratings);
    var natMap = Object.assign({}, NATFALLBACK, statics.natMap || {});
    var rosterRows = [];
    Object.keys(teams).forEach(function (entry) {
      var squad = perEntry[entry], xiIds = {};
      bestXI(squad).forEach(function (p) { xiIds[p.el] = true; });
      squad.sort(function (a, b) { return ('GKP DEF MID FWD'.indexOf(a.pos) - 'GKP DEF MID FWD'.indexOf(b.pos)) || (b.proj - a.proj); })
        .forEach(function (p) {
          rosterRows.push([teams[entry].name, teams[entry].manager, p.player, p.pos, p.club, p.rank, p.proj,
            xiIds[p.el] ? 'XI' : 'Bench', p.status, p.news, p.drafted, p.seasonPts, p.gwPts, p.gwMins,
            p.code, natMap[String(p.code)] || '', p.ovr, p.totw, p.gwXI, p.slot]);
        });
    });
    T['Rosters'] = { header: ['Team', 'Manager', 'Player', 'Pos', 'Club', 'FPL rank', 'Proj pts', 'Best XI', 'Status', 'News', 'Drafted', 'Season pts', 'GW pts', 'GW mins', 'Code', 'Nation', 'OVR', 'TOTW', 'GW XI', 'Slot'], rows: rosterRows };

    /* Code.gs v3.22: Str H and Str A are FPL's 1 to 5 fixture difficulty (strength_overall_home and _away), the classic
       team first and the draft team as the fallback per field; a figure outside 1 to 5 is left blank */
    var cTeams = {}; ((cl.boot && cl.boot.teams) || []).forEach(function (t) { cTeams[t.short_name] = t; });
    T['Clubs'] = { header: ['Short', 'Name', 'Badge code', 'Badge URL', 'Str H', 'Str A'], rows: boot.teams.map(function (t) {
      var code = clubCodes[t.short_name] || t.code || '';
      return [t.short_name, t.name, code, code ? 'https://resources.premierleague.com/premierleague/badges/50/t' + code + '.png' : ''].concat(clubStrengthRow(cTeams[t.short_name], t));
    }) };

    T['H2H Fixtures'] = { header: ['GW', 'Home', 'Home pts', 'Away', 'Away pts', 'Finished'], rows: details.matches.map(function (m) {
      var h = teams[leToEntry[m.league_entry_1]], a = teams[leToEntry[m.league_entry_2]];
      return [m.event, h ? h.name : m.league_entry_1, m.league_entry_1_points, a ? a.name : m.league_entry_2, m.league_entry_2_points, m.finished];
    }) };

    T['Club Fixtures'] = { header: ['GW', 'Home', 'Away', 'Kickoff (UTC)', 'Finished', 'Home goals', 'Away goals', 'Started', 'Mins'],
      rows: fixtures.filter(function (f) { return f.event; }).map(function (f) {
        return [f.event, clubs[f.team_h] || f.team_h, clubs[f.team_a] || f.team_a, "'" + (f.kickoff_time || ''),
          !!(f.finished || f.finished_provisional), f.team_h_score == null ? '' : f.team_h_score, f.team_a_score == null ? '' : f.team_a_score, !!f.started, f.minutes || 0];
      }) };

    var tk = { w: 'Waiver', f: 'Free agent' };
    /* Code.gs v3.6 TX_RESULT: readable, no em dash; an unmapped code reads 'Denied' (FPL only adds codes for failure reasons) */
    var tr2 = TX_RESULT;
    var trans = (raw.transactions && raw.transactions.transactions) || [];
    T['Transactions'] = { header: ['GW', 'Team', 'Manager', 'In', 'Out', 'Type', 'Result', 'When (UTC)'], rows: trans.slice().reverse().map(function (t) {
      var tm = teams[t.entry] || {}, pin = players[t.element_in] || {}, pout = players[t.element_out] || {};
      return [t.event || '', tm.name || '', tm.manager || '', pin.web_name || ('#' + t.element_in), pout.web_name || ('#' + t.element_out),
        tk[t.kind] || t.kind || '', txResultLabel(t.result, tr2), "'" + (t.added || '')];
    }) };

    /* Code.gs v3.19: Waiver pick is FPL's own waiver order (league_entries waiver_pick: 1 = first claim, the lowest team) */
    T['Standings'] = { header: ['Team', 'Manager', 'W', 'D', 'L', 'Pts For', 'Pts Against', 'League Pts', 'Waiver pick'], rows: details.standings.map(function (s) {
      var t = teams[leToEntry[s.league_entry]] || {};
      return [t.name || '', t.manager || '', s.matches_won, s.matches_drawn, s.matches_lost, s.points_for, s.points_against, s.total, t.waiver || ''];
    }) };

    var periodOf = function (gw) {
      for (var i = 0; i < cfg.motmPeriods.length; i++) if (gw >= cfg.motmPeriods[i].from && gw <= cfg.motmPeriods[i].to) return cfg.motmPeriods[i].name;
      return '';
    };
    /* Code.gs v3.19: Waivers (UTC) is FPL's own waivers_time (claims processed then, 24 hours before the deadline) */
    T['Matchweeks'] = { header: ['GW', 'Deadline (UTC)', 'MOTM period', 'Finished', 'Notes', 'Waivers (UTC)'], rows: evs.map(function (e) {
      var note = e.id === cfg.midseasonGw ? '💰 $' + cfg.prizes.mid + ' mid-season leader after this GW' : (e.id === 38 ? '🏆 Final GW' : '');
      return [e.id, "'" + e.deadline_time, periodOf(e.id), e.finished, note, e.waivers_time ? "'" + e.waivers_time : ''];
    }) };

    var motmRows = [];
    cfg.motmPeriods.forEach(function (per) {
      var totals = {};
      details.matches.forEach(function (m) {
        if (m.event < per.from || m.event > per.to || !m.started) return;
        totals[leToEntry[m.league_entry_1]] = (totals[leToEntry[m.league_entry_1]] || 0) + m.league_entry_1_points;
        totals[leToEntry[m.league_entry_2]] = (totals[leToEntry[m.league_entry_2]] || 0) + m.league_entry_2_points;
      });
      var ranked = Object.keys(totals).map(function (e) { return { name: teams[e].name, pts: totals[e] }; }).sort(function (a, b) { return b.pts - a.pts; });
      motmRows.push([per.name, 'GW' + per.from + '–' + per.to,
        ranked.length ? ranked[0].name + ' (' + ranked[0].pts + ')' : '— starts GW' + per.from,
        ranked.map(function (r) { return r.name + ' ' + r.pts; }).join(' · ')]);
    });
    T['MOTM'] = { header: ['Period', 'Gameweeks', 'Leader ($' + cfg.prizes.motm + ')', 'All totals'], rows: motmRows };

    T['Meta'] = { header: null, rows: [
      ['League', details.league.name], ['Updated', "'" + nowIso],
      ['Pot', '$' + cfg.prizes.pot + ' · 1st $' + cfg.prizes.first + ' · 2nd $' + cfg.prizes.second + ' · 3rd $' + cfg.prizes.third + ' · Mid-season $' + cfg.prizes.mid + ' · MOTM 9×$' + cfg.prizes.motm],
      ['Current GW', curEv || ''] ] };

    /* ----- Predictions: block for the next un-passed deadline ----- */
    var next = null;
    for (i = 0; i < evs.length; i++) { if (!evs[i].finished && new Date(evs[i].deadline_time) > now) { next = evs[i]; break; } }
    T['Predictions'] = { header: ['GW', 'Code', 'Player', 'Pos', 'Club', 'EP', 'Proj', 'Captured (UTC)'], gw: next ? next.id : null,
      rows: next ? boot.elements.map(function (e) {
        var c = classicByCode[e.code] || {};
        return [next.id, e.code, e.web_name, POS[e.element_type] || '?', clubs[e.team] || '?',
          c.ep_this != null ? parseFloat(c.ep_this) : '', projPoints(e, clubs[e.team], cfg.clubMult), "'" + nowIso];
      }) : [] };

    /* ----- Players: full universe ----- */
    T['Players'] = { header: ['Code', 'Player', 'Pos', 'Club', 'Owner', 'Status', 'News', 'Draft rank', 'Season pts', 'Mins', 'Form', 'xGI', 'EP next', 'Proj', 'Nation', 'Full name'],
      rows: boot.elements.map(function (e) {
        var c = classicByCode[e.code] || {};
        return [e.code, e.web_name, POS[e.element_type] || '?', clubs[e.team] || '?', ownerByEl[e.id] || 'FREE', e.status || 'a', e.news || '', e.draft_rank || '',
          e.total_points || 0, e.minutes || 0, parseFloat(e.form || 0), parseFloat(e.expected_goal_involvements || 0),
          c.ep_next != null ? parseFloat(c.ep_next) : '', projPoints(e, clubs[e.team], cfg.clubMult), natMap[String(e.code)] || '',
          ((e.first_name || '') + ' ' + (e.second_name || '')).trim()];
      }) };

    /* ----- GW Stats: blocks ----- */
    var GWSTATS_HEAD = ['GW', 'Code', 'Player', 'Pos', 'Club', 'Owner', 'Mins', 'Pts', 'G', 'A', 'CS', 'GC', 'OG', 'PS', 'PM', 'YC', 'RC', 'Saves', 'Bonus', 'BPS', 'DefCon', 'xG', 'xA', 'xGC', 'Starts', 'Final'];
    var statsBlock = function (gw, live, isFinal) {
      var rows = [];
      if (!live || !live.elements) return rows;
      Object.keys(live.elements).forEach(function (id) {
        var p = players[id]; if (!p) return;
        var st = (live.elements[id] && live.elements[id].stats) || {};
        rows.push([gw, p.code, p.web_name, POS[p.element_type] || '?', clubs[p.team] || '?', ownerByEl[id] || '',
          st.minutes || 0, st.total_points || 0, st.goals_scored || 0, st.assists || 0, st.clean_sheets || 0, st.goals_conceded || 0, st.own_goals || 0,
          st.penalties_saved || 0, st.penalties_missed || 0, st.yellow_cards || 0, st.red_cards || 0, st.saves || 0, st.bonus || 0, st.bps || 0,
          st.defensive_contribution || 0, parseFloat(st.expected_goals || 0), parseFloat(st.expected_assists || 0), parseFloat(st.expected_goals_conceded || 0), st.starts || 0, !!isFinal]);
      });
      return rows;
    };
    var blocks = [], finishedMap = {};
    evs.forEach(function (e) { if (e.finished) finishedMap[e.id] = true; });
    var gwStatsFinal = statics.gwStatsFinal || {};
    evs.forEach(function (e) {
      if (e.finished && !gwStatsFinal[String(e.id)] && raw.finishedLive && raw.finishedLive[e.id])
        blocks.push({ gw: e.id, final: true, rows: statsBlock(e.id, raw.finishedLive[e.id], true) });
    });
    if (curEv && !finishedMap[curEv] && gwLive) blocks.push({ gw: curEv, final: false, rows: statsBlock(curEv, gwLive, false) });
    T['GW Stats'] = { header: GWSTATS_HEAD, blocks: blocks };

    /* ----- GW Log: one append per finished GW ----- */
    var logRows = null;
    if (lastDone && !(statics.gwLogLogged || {})[String(lastDone)] && raw.finishedLive && raw.finishedLive[lastDone]) {
      var live = raw.finishedLive[lastDone], lus = (raw.finishedLineups || {})[lastDone] || {};
      logRows = [];
      Object.keys(teams).forEach(function (entry) {
        (perEntry[entry] || []).forEach(function (p) {
          var st = (live.elements && live.elements[p.el] && live.elements[p.el].stats) || {};
          var slot = (lus[entry] && lus[entry][p.el]) || 0;
          logRows.push([lastDone, teams[entry].name, p.player, p.code, p.pos, p.club, st.total_points || 0, st.minutes || 0,
            slot ? (slot <= 11 ? 'XI' : 'BEN') : '', p.totw, "'" + nowIso]);
        });
      });
    }
    T['GW Log'] = { header: ['GW', 'Team', 'Player', 'Code', 'Pos', 'Club', 'GW pts', 'GW mins', 'Started', 'TOTW', 'Logged (UTC)'], gw: lastDone, rows: logRows };

    /* ----- Fixture BPS (Code.gs v3.21): the current gameweek's BPS and bonus per fixture, rewritten every run ----- */
    T['Fixture BPS'] = fixtureBps(boot, gwLive, curEv, classicIdToCode, cl.fixtures);

    T._meta = { curEv: curEv, lastDone: lastDone, nextPredGw: next ? next.id : null, teams: teams, leToEntry: leToEntry, classicOverlay: overlayStats };
    return T;
  }

  /* ---------- fetch plan: which endpoints `build` needs, given bootstrap + details ----------
   * Pure: returns a list of {key, path} so any runtime (Deno, browser, node) can do the I/O. */
  function fetchPlan(leagueId, boot, details, statics) {
    var evs = boot.events.data || boot.events, curEv = null, lastDone = null;
    for (var i = 0; i < evs.length; i++) { if (!evs[i].finished) { curEv = evs[i].id; break; } }
    evs.forEach(function (e) { if (e.finished) lastDone = e.id; });
    var plan = [
      { key: 'choices', path: 'draft/' + leagueId + '/choices' },
      { key: 'estat', path: 'league/' + leagueId + '/element-status', optional: true },
      { key: 'transactions', path: 'draft/league/' + leagueId + '/transactions', optional: true }
    ];
    if (curEv) plan.push({ key: 'gwLive', path: 'event/' + curEv + '/live', optional: true });
    details.league_entries.forEach(function (le) {
      if (curEv) plan.push({ key: 'lineup', entry: le.entry_id, gw: curEv, path: 'entry/' + le.entry_id + '/event/' + curEv, optional: true });
    });
    evs.forEach(function (e) { plan.push({ key: 'fixtures', gw: e.id, path: 'event/' + e.id + '/fixtures' }); });
    var gwStatsFinal = (statics && statics.gwStatsFinal) || {}, logged = (statics && statics.gwLogLogged) || {};
    evs.forEach(function (e) {
      if (e.finished && (!gwStatsFinal[String(e.id)] || (e.id === lastDone && !logged[String(e.id)])))
        plan.push({ key: 'finishedLive', gw: e.id, path: 'event/' + e.id + '/live', optional: true });
    });
    if (lastDone && !logged[String(lastDone)]) details.league_entries.forEach(function (le) {
      plan.push({ key: 'finishedLineup', entry: le.entry_id, gw: lastDone, path: 'entry/' + le.entry_id + '/event/' + lastDone, optional: true });
    });
    // classic supplement (absolute URLs; a browser on the draft origin can't fetch these — a server can)
    var classic = [
      { key: 'classicBoot', url: 'https://fantasy.premierleague.com/api/bootstrap-static/', optional: true },
      { key: 'classicFixtures', url: 'https://fantasy.premierleague.com/api/fixtures/', optional: true }
    ];
    if (lastDone) classic.push({ key: 'classicDream', gw: lastDone, url: 'https://fantasy.premierleague.com/api/dream-team/' + lastDone + '/', optional: true });
    if (curEv) classic.push({ key: 'classicLive', gw: curEv, url: 'https://fantasy.premierleague.com/api/event/' + curEv + '/live/', optional: true });
    return { curEv: curEv, lastDone: lastDone, plan: plan, classic: classic };
  }

  /* Assemble `raw` from a plan's results: results = [{item, json|null}] */
  function assemble(boot, details, results) {
    var raw = { boot: boot, details: details, lineups: {}, fixtures: [], finishedLive: {}, finishedLineups: {} };
    var picksOf = function (j) { var m = {}; ((j && j.picks) || []).forEach(function (p) { m[p.element] = p.position; }); return m; };
    results.forEach(function (r) {
      var it = r.item, j = r.json;
      if (it.key === 'lineup') { if (j && j.picks && j.picks.length) raw.lineups[it.entry] = picksOf(j); }
      else if (it.key === 'fixtures') { if (Array.isArray(j)) raw.fixtures = raw.fixtures.concat(j); }
      else if (it.key === 'finishedLive') { if (j) raw.finishedLive[it.gw] = j; }
      else if (it.key === 'classicBoot') { raw.classic = raw.classic || {}; raw.classic.boot = j; }
      else if (it.key === 'classicFixtures') { raw.classic = raw.classic || {}; raw.classic.fixtures = j; }
      else if (it.key === 'classicDream') { raw.classic = raw.classic || {}; raw.classic.dream = j; }
      else if (it.key === 'classicLive') { raw.classic = raw.classic || {}; raw.classic.live = j; }
      else if (it.key === 'finishedLineup') { if (j && j.picks && j.picks.length) { raw.finishedLineups[it.gw] = raw.finishedLineups[it.gw] || {}; raw.finishedLineups[it.gw][it.entry] = picksOf(j); } }
      else raw[it.key] = j;
    });
    return raw;
  }

  return { build: build, fetchPlan: fetchPlan, assemble: assemble, mergeClassicLive: mergeClassicLive, projPoints: projPoints, gradePicks: gradePicks,
    gradeTeams: gradeTeams, bestXI: bestXI, computeRatings: computeRatings, normName: normName, DEFAULTS: DEFAULTS, POS: POS, NATFALLBACK: NATFALLBACK,
    TX_RESULT: TX_RESULT, txResultLabel: txResultLabel, clubStrengthRow: clubStrengthRow, fixtureBps: fixtureBps, FIXBPS_HEAD: FIXBPS_HEAD,
    pulsePlayersUrl: pulsePlayersUrl, pulseNations: pulseNations, specialsRows: specialsRows, potmFile: potmFile };
})();
