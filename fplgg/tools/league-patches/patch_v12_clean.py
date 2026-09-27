#!/usr/bin/env python3
"""v12 anti-slop copy pass (26 Sep 2026): user-visible strings in the base app and the v10 frame.

    python3 fplgg/tools/league-patches/patch_v12_clean.py [ROOT] [--check]

ROOT = the folder that holds index-PREVIEW.html and fplgg/ (default: the current directory).
--check verifies every anchor and writes nothing.

What changes (copy only, plus one markup block):
  * emojis and decorative glyphs out of UI strings (📰 🔭 🎬 ▶ ● ★ ✎ ✕ ▸ ↻ ↺ 〰 ▮ ⛰ ⣿ 🔊 🔇 ⚠ ✓ ✗), and the
    "→" notation in the matchup Expected-view note
  * em dashes out of prose (a period, colon, comma or "to"); "—" as an empty-value placeholder becomes "–",
    the placeholder the Players list already uses
  * "not X, it's Y" lines rewritten ("earned, not imported", "earned not given")
  * filler captions shortened or cut (Lab tagline, the free-agents caption, the naming-committee aside, the long
    projected-lineups note); FAQ lines that described the pre-v12 projection ("FPL's forecast, frozen at the
    deadline", "projected best XI", "updating hourly") now say what the app does
  * chart legends: the "—" / "- -" glyph swatches become drawn line swatches (inline style, no new CSS)
  * "1 pts clear" on the Table leader line reads "1 pt clear"
  * matchup graphic score box: the state tag is dropped when it repeats the label under the score
  * FAQ gains a short Privacy section (what the phone keeps, what the public sheet holds, where PIN hashes live;
    facts from Code.gs v3.5 auth block and v10-auth.js)
  * Matchday first paint: the "Loading the gameweek…" line becomes a static skeleton (styled by v12-ui.css;
    without that stylesheet the empty <i> blocks render nothing)
Untouched on purpose: code comments, the PREVIEW-only November simulator and the other anchors that
port_preview_to_prod.py / build_v10.py assert on, the dead renderXIs_legacy / goldenBoot, hidden hero <p> lines,
card renderer output, crest SVGs, article titles (editorial), the PIN field's •••• placeholder, the ▲ ▼ form arrows.

Every replacement asserts exactly one match. Each file carries a marker once patched, so a re-run is a no-op.
All files are checked in memory first; nothing is written unless every anchor matches. File modes are kept
(several v10 files are read-only)."""
import sys, pathlib, os

ARGS = [a for a in sys.argv[1:] if not a.startswith('--')]
CHECK = '--check' in sys.argv
ROOT = pathlib.Path(ARGS[0] if ARGS else '.').resolve()
MARK = 'v12-clean copy pass'
V10 = 'fplgg/tools/v10/'

# a drawn legend swatch (solid = actual, dashed = expected) replacing the "—" and "- -" glyphs
SW = '<span style="display:inline-block;width:14px;border-top:2.5px {k} {c};vertical-align:middle;margin-right:3px"></span>'

EDITS = {}

EDITS['index-PREVIEW.html'] = [
 # ---- marker (a JS comment in the base script)
 ("function renderFAQ(){",
  "/* " + MARK + " (patch_v12_clean.py, 26 Sep 2026) */\nfunction renderFAQ(){", 'marker'),
 # ---- Matchday first paint: skeleton instead of a loading line
 ('<div id="gwbody"><p class="state">Loading the gameweek…</p></div>',
  '<div id="gwbody"><div class="uix-skel" role="status" aria-label="Loading the gameweek"><i class="k"></i><i class="c"></i>'
  '<div class="b"><i></i><i></i><i></i></div><div class="b"><i></i><i></i><i></i></div><div class="b"><i></i><i></i><i></i></div></div></div>',
  'gwbody skeleton'),
 # ---- points breakdown: ✓ / ✗ out of the clean-sheet label
 ("add('Clean sheet '+(r.CS?'✓':'✗')+' (xGC '", "add((r.CS?'Clean sheet':'No clean sheet')+' (xGC '", 'bdOf clean sheet'),
 (".replace('Clean sheet ✗ ','Clean sheet ').replace('Clean sheet ✓ ','Clean sheet ')", ".replace('No clean sheet ','Clean sheet ')", 'projLbl'),
 # ---- empty-value placeholders
 ("  if(!D.started)return'—';\n  return(seasonTot(p)", "  if(!D.started)return'–';\n  return(seasonTot(p)", 'avgOf placeholder'),
 ("  if(!f)return'—';\n  return f.Home===club", "  if(!f)return'–';\n  return f.Home===club", 'nextFixture placeholder'),
 ("+'<div><b style=\"font-size:1.9rem\">'+(best?best.p:'—')+'</b>", "+'<div><b style=\"font-size:1.9rem\">'+(best?best.p:'–')+'</b>", 'profile best placeholder'),
 ("st.W+'–'+st.D+'–'+st.L:'—')+'</b><span>W – D – L</span>", "st.W+'–'+st.D+'–'+st.L:'–')+'</b><span>W – D – L</span>", 'profile record placeholder'),
 ("+'<span><b>'+(g?(pf/g).toFixed(1):'—')+'</b><i>pts / gw</i></span>'", "+'<span><b>'+(g?(pf/g).toFixed(1):'–')+'</b><i>pts / gw</i></span>'", 'mgr tile avg placeholder'),
 ("+'<span><b>'+(best||'—')+'</b><i>best gw</i></span>'", "+'<span><b>'+(best||'–')+'</b><i>best gw</i></span>'", 'mgr tile best placeholder'),
 ("st.W+'–'+st.D+'–'+st.L:'—')+'</b><i>w · d · l</i>", "st.W+'–'+st.D+'–'+st.L:'–')+'</b><i>w · d · l</i>", 'mgr tile record placeholder'),
 ("let who='<span class=\"who\"><em>—</em></span>'", "let who='<span class=\"who\"><em>–</em></span>'", 'MOTM history placeholder'),
 ("+'<div><b style=\"color:#0B3E9E\">'+(ep2!==null?fmt1(ep2):'—')+'</b><span>PROJ (FPL)</span></div>'", "+'<div><b style=\"color:#0B3E9E\">'+(ep2!==null?fmt1(ep2):'–')+'</b><span>PROJ (FPL)</span></div>'", 'xpgrid proj placeholder'),
 ("+'<div><b>'+(hr?hr.xG.toFixed(2):'—')+'</b><span>AVG xG</span></div>'", "+'<div><b>'+(hr?hr.xG.toFixed(2):'–')+'</b><span>AVG xG</span></div>'", 'xpgrid xG placeholder'),
 ("+'<div><b>'+(hr?hr.xA.toFixed(2):'—')+'</b><span>AVG xA</span></div>'", "+'<div><b>'+(hr?hr.xA.toFixed(2):'–')+'</b><span>AVG xA</span></div>'", 'xpgrid xA placeholder'),
 ("Math.round(Math.exp(-hr.xGC)*100)+'%':'—')+'</b><span>CS ODDS</span>", "Math.round(Math.exp(-hr.xGC)*100)+'%':'–')+'</b><span>CS ODDS</span>", 'xpgrid cs placeholder'),
 ("+fmt1(tot)+' · '+(ep2!==null?fmt1(ep2):'—')+'</span></div>'", "+fmt1(tot)+' · '+(ep2!==null?fmt1(ep2):'–')+'</span></div>'", 'itemized total placeholder'),
 ("Math.round(Math.exp(-gr.xGC)*100)+'%':'—';", "Math.round(Math.exp(-gr.xGC)*100)+'%':'–';", 'played cs placeholder'),
 ("+'</span><span class=\"x2\">'+(b.x==null?'—':", "+'</span><span class=\"x2\">'+(b.x==null?'–':", 'breakdown x placeholder'),
 # ---- recap / preview cards (base versions; v10 and v12 redefine them) and the article list
 ("<div class=\"rk\">📰 Gameweek '+r.gw+' recap<span class=\"new\">NEW</span></div>'\n", "<div class=\"rk\">Gameweek '+r.gw+' recap<span class=\"new\">NEW</span></div>'\n", 'base recap emoji'),
 ("<div class=\"rk\">🔭 Gameweek '+p.gw+' preview<span class=\"new\">NEW</span></div>'\n", "<div class=\"rk\">Gameweek '+p.gw+' preview<span class=\"new\">NEW</span></div>'\n", 'base preview emoji'),
 ("and the injury clock \\u2014 now with Malcolm Tyre in the booth'", "and the injury clock, now with Malcolm Tyre in the booth'", 'preview gw4 sub'),
 # ---- scoreboard / matchup status lines
 ("+(D.provOver?'<div class=\"provnote\"><b>All matches finished — provisional result.</b> '", "+(D.provOver?'<div class=\"provnote\"><b>All matches finished. Provisional result.</b> '", 'base provnote'),
 ("(D.provOver?'FULL TIME · PROVISIONAL':'● LIVE'):'TAP FOR LINEUPS')", "(D.provOver?'FULL TIME · PROVISIONAL':'LIVE'):'TAP FOR LINEUPS')", 'base scoreboard live'),
 ("(D.provOver?'FULL TIME · PROVISIONAL':'● LIVE'):(dl?", "(D.provOver?'FULL TIME · PROVISIONAL':'LIVE'):(dl?", 'matchup live'),
 ("<div class=\"asubnote\">Already counted in proj final — FPL makes auto-subs official when the gameweek ends.</div>",
  "<div class=\"asubnote\">Already counted in proj final. FPL makes auto-subs official when the gameweek ends.</div>", 'asubnote locked'),
 (r"""<div class="asubnote">Assumes starters FPL has flagged out don\'t play — counted in proj final only. If the flagged player logs a minute, he\'s back and the bench order re-settles.</div>""",
  r"""<div class="asubnote">Assumes starters FPL has flagged out don\'t play. Counted in proj final only; if a flagged player logs a minute, the bench order re-settles.</div>""", 'asubnote likely'),
 # ---- matchup Expected view note: arrow notation out
 ("font-weight:500\">Played → what the performance deserved (xP) · yet to play → projected (PROJ). Converges to pure xP when the gameweek ends.</div>",
  "font-weight:500\">Played: what the performance deserved (xP). Yet to play: projected (PROJ). All xP once the gameweek ends.</div>", 'xnote arrows'),
 # ---- luck index + profile chart legend
 ("League points banked vs an <b>all-play</b> schedule — your score against all seven rivals every week (win 3 · draw 1 · loss 0). <b style=\"color:var(--good)\">+</b> = the fixture list has been kind: results better than the score earned. “Close” counts matches decided by ≤'+CLOSE_MARGIN+' — the ones that could have swung. Compounds week over week. Tap a manager for the full profile.",
  "League points banked vs an <b>all-play</b> schedule: your score against all seven rivals every week (win 3 · draw 1 · loss 0). <b style=\"color:var(--good)\">+</b> means the fixture list has been kind. “Close” counts matches decided by ≤'+CLOSE_MARGIN+'. Tap a manager for the full profile.", 'luck results caption'),
 ("Actual points vs expected points, season to date. <b style=\"color:var(--good)\">+</b> = performances running hot, <b style=\"color:var(--bad)\">−</b> = deserving more. Bonus excluded from both sides. Tap a manager for the full profile.",
  "Actual vs expected points, season to date, bonus excluded. <b style=\"color:var(--good)\">+</b> running hot, <b style=\"color:var(--bad)\">−</b> deserved more. Tap a manager for the full profile.", 'luck perf caption'),
 ("+'<p class=\"sh-note\"><span style=\"color:'+col+';font-weight:700\">—</span> actual (excl. bonus) · <span style=\"color:'+colX+';font-weight:700\">- -</span> expected (xP).",
  "+'<p class=\"sh-note\">" + SW.format(k='solid', c="'+col+'") + "actual (excl. bonus) · " + SW.format(k='dashed', c="'+colX+'") + "expected (xP).", 'profile legend'),
 ("') sit outside both lines — with them, actual is '", "') sit outside both lines; with them, actual is '", 'profile bonus note'),
 # ---- My team picker (v10 replaces this note, kept consistent)
 ("Pick your team once — this phone remembers, and My team opens straight onto your squad. Switch any time.", "Pick your team once. This phone remembers it.", 'picker note'),
 # ---- the Lab
 ("'Season sum of winning/losing margins — positive = won by more than you lost by.'", "'Season sum of winning and losing margins. Positive means you won by more than you lost by.'", 'lab margin foot'),
 ("'<span style=\"color:#2E5BFF;font-weight:700\">—</span> actual score · <span style=\"color:#5B1A66;font-weight:700\">- -</span> what the performances deserved (expected, bonus excluded).'",
  "'" + SW.format(k='solid', c='#2E5BFF') + "actual score · " + SW.format(k='dashed', c='#5B1A66') + "what the performances deserved (expected, bonus excluded).'", 'lab legend'),
 ("foot('Every manager’s score, one row per gameweek — how bunched is the league?')", "foot('Every manager’s score, one row per gameweek.')", 'lab spread foot'),
 ("const VN={trend:'〰 Trend',bars:'▮ Bars',race:'⛰ Race',spread:'⣿ Spread'};", "const VN={trend:'Trend',bars:'Bars',race:'Race',spread:'Spread'};", 'lab view labels'),
 ("data-reset style=\"margin-left:auto\">↺ Reset</button>", "data-reset style=\"margin-left:auto\">Reset</button>", 'lab reset'),
 ("<div class=\"labhead\"><b>THE LAB</b><span>pick who · pick what · the chart answers</span></div>", "<div class=\"labhead\"><b>THE LAB</b></div>", 'lab tagline'),
 ("+'<h2>The managers <small>tap a name for the full profile</small></h2>'", "+'<h2>The managers</h2>'", 'lab managers hint'),
 ("+'<p><b>Projected</b> = forecast before a match, frozen at the deadline. <b>Expected (xP)</b> = what a performance deserved once played — goals→xG, assists→xA, clean sheets→e<sup>−xGC</sup>. '",
  "+'<p><b>Projected</b>: the forecast before a match. <b>Expected (xP)</b>: what a performance deserved once played, from xG, xA and clean-sheet odds (e<sup>−xGC</sup>). '", 'lab how-to'),
 # ---- Table
 (r"""Includes this gameweek\'s live scores — same numbers as the scoreboard. Settles when FPL confirms the gameweek.""",
  r"""Includes this gameweek\'s live scores, same as the scoreboard. Settles when FPL confirms the gameweek.""", 'motm live note'),
 ("'pre-season projections only — odds sharpen once real scores arrive'", "'pre-season projections only until real scores arrive'", 'odds note'),
 # ---- Players
 ("+(p.News?' · ⚠':'')+'</em></span>'", "+(p.News?' · <b style=\"color:#C62828;font-weight:700\">Flagged</b>':'')+'</em></span>'", 'players news flag'),
 ("<p class=\"state\">The Players tab hasn’t landed in the sheet yet — repaste Code.gs and run refreshAll.</p>", "<p class=\"state\">The Players tab hasn’t landed in the sheet yet. Repaste Code.gs and run refreshAll.</p>", 'players missing tab'),
 ("No moves yet — pickups, drops and denied claims land here.", "No moves yet. Pickups, drops and denied claims land here.", 'players no moves'),
 ("+fas.map(plrRow).join('')\n     +'<p class=\"mnote\">The ten best unowned players this season — waiver ammunition.</p>':'';",
  "+fas.map(plrRow).join(''):'';", 'free agents caption (cut: the header and Total | Average say it)'),
 ("placeholder=\"Search any player — who owns him?\"", "placeholder=\"Search any player\"", 'players search placeholder'),
 ("No trades or waivers yet — once the first moves process, every pickup, drop and denied claim shows up here.", "No trades or waivers yet. Every pickup, drop and denied claim shows up here.", 'activity empty (#act)'),
 ("<span class=\"lv\">● ON THE PITCH</span>", "<span class=\"lv\">ON THE PITCH</span>", 'pl snapshot'),
 # ---- FAQ
 ("'<b>Silver</b> — rated under 78'", "'<b>Silver</b>: rated under 78'", 'faq silver'),
 ("'<b>Gold</b> — rated 78–84'", "'<b>Gold</b>: rated 78–84'", 'faq gold'),
 ("'<b>Elite</b> — rated 85+, earned not given'", "'<b>Elite</b>: rated 85+'", 'faq elite'),
 ("'<b>Draft special</b> — round 1–2 picks, league colours all season'", "'<b>Draft special</b>: round 1–2 picks, league colours all season'", 'faq spec'),
 ("'<b>Round 2 vintage</b> — same colours, later letter'", "'<b>Round 2 pick</b>: same colours, R2 tag'", 'faq r2'),
 ("'<b>Team of the Week</b> — a 10+ point haul, lasts one week'", "'<b>Team of the Week</b>: a 10+ point haul, lasts one week'", 'faq totw'),
 ("'<b>Player of the Month</b> — the league’s monthly pick'", "'<b>Player of the Month</b>: the Premier League award'", 'faq potm'),
 ("'<b>Gold</b> — the league’s broad middle class'", "'<b>Gold</b>: the most common tier'", 'faq gold 2'),
 ("+'<h2>The pot — $1,200</h2>", "+'<h2>The pot: $1,200</h2>", 'faq pot head'),
 ("carries a <b>base OVR</b> — career profile blended", "carries a <b>base OVR</b>: career profile blended", 'faq ratings 1'),
 ("Form can promote a Silver into Gold art — or relegate a Gold.", "Form can promote a Silver into Gold art, or relegate a Gold.", 'faq ratings 2'),
 ("<p>Cards show live gameweek points from kickoff, updating hourly. Before the deadline you see each manager’s projected best XI; once the deadline passes, the real submitted lineup takes over.</p>",
  "<p>Cards show live gameweek points from kickoff. Before the deadline you see each manager’s last lineup carried forward; once the deadline passes, the real submitted lineup takes over.</p>", 'faq points on cards'),
 ("<b>Team of the Week is earned, not imported:</b> haul 10+ points", "<b>Team of the Week:</b> haul 10+ points", 'faq special 1'),
 ("It lasts one week — until your next match finishes, where you keep it with another haul or hand it back.", "It lasts one week, until your next match finishes: keep it with another haul or hand it back.", 'faq special 2'),
 ("<h3>The money — $1,200</h3>", "<h3>The money: $1,200</h3>", 'faq money head'),
 ("at $30 each — most points in the period, August folds into September.", "at $30 each: most points in the period, with August folded into September.", 'faq money body'),
 ("<p>Before a player’s match kicks off you see his <b>projected</b> points — FPL’s forecast, frozen at the deadline. Once he’s played, that flips to <b>expected (xP)</b> — what his performance deserved: goals are scored as xG, assists as xA, clean sheets as the odds of one given the chances faced. The matchup scoreline does the same: a projected final while games are in play, then the xP scoreline when the gameweek closes — so “won 41–38 but deserved to lose 33–45” is now a thing your rivals can prove. Bonus points are left out of xP, on purpose.</p>",
  "<p><b>Projected</b> points are the app’s forecast before a player’s match: his expected minutes, his underlying numbers and the fixture. <b>Expected (xP)</b> is what a finished performance deserved: goals scored as xG, assists as xA, clean sheets as the odds of one given the chances faced. The matchup scoreline follows the same path: a projected final while games are in play, then the xP scoreline when the gameweek closes, so “won 41–38 but deserved to lose 33–45” is something your rivals can prove. Bonus is left out of xP.</p>", 'faq projected vs expected'),
 ("from the FPL Draft API on a rolling refresh — the app re-pulls", "from the FPL Draft API on a rolling refresh: the app re-pulls", 'faq data'),
 ("the card doesn’t know yet.</p></div>';\n}",
  "the card doesn’t know yet.</p></div>'\n"
  "   +'<div class=\"faqsec\"><h3>Privacy</h3><p>No ads, no analytics. This phone remembers which team you follow and, if you claimed a team, your sign-in. "
  "A claimed team’s photo, colours, crest and display name are saved to the league’s Google Sheet, which anyone with the link can view. "
  "PINs are kept only as hashes on the league’s server, never in the sheet.</p></div>';\n}", 'faq privacy'),
 # ---- player sheet notes
 ("' holds the Premier League Player of the Month award — this card lasts until the next one is announced.'", "' holds the Premier League Player of the Month award. This card lasts until the next one is announced.'", 'tier potm'),
 ("' hauled 10+ points this gameweek — the black &amp; gold lasts until his next match finishes.'", "' hauled 10+ points this gameweek. The black &amp; gold lasts until his next match finishes.'", 'tier totw'),
 ("return'Elite tier — rated 85+ on current form. Earned, not given.';", "return'Elite tier: rated 85+ on current form.';", 'tier elite'),
 ("return'Gold tier — rated 78–84.';", "return'Gold tier: rated 78–84.';", 'tier gold'),
 ("return'Silver tier — rated under 78.';", "return'Silver tier: rated under 78.';", 'tier silver'),
 ("' Expected numbers swap luck for underlying stats — goals→xG, assists→xA, clean sheets→e<sup>−xGC</sup>, defensive contribution→his hit-rate in prior games. Bonus is left out of xP.'",
  "' Expected numbers use underlying stats: xG for goals, xA for assists, e<sup>−xGC</sup> for clean sheets, his prior hit-rate for defensive contribution. Bonus is left out of xP.'", 'sheet xp note'),
]

EDITS[V10 + 'v10-delta.js'] = [
 # ---- Table leader line: "1 pts clear" reads "1 pt clear"
 ("(num(lead['League Pts'])-num(sec['League Pts']))+' pts clear of '",
  "((d=>d+(d===1?' pt':' pts'))(num(lead['League Pts'])-num(sec['League Pts'])))+' clear of '", 'leader margin plural'),
 ("/* ===== v10 — Matchday frame.", "/* " + MARK + " (patch_v12_clean.py) */\n/* ===== v10 — Matchday frame.", 'marker'),
 ("const tag={pred:'<span class=\"tg\">Predicted</span>',live:'<span class=\"tg live\">● Live</span>'", "const tag={pred:'<span class=\"tg\">Predicted</span>',live:'<span class=\"tg live\">Live</span>'", 'bug live tag'),
 ("<div class=\"provnote\" style=\"margin-top:12px\"><b>All matches finished — provisional result.</b> ", "<div class=\"provnote\" style=\"margin-top:12px\"><b>All matches finished. Provisional result.</b> ", 'provnote'),
 ("const stTag={pred:'',live:'<span class=\"tg live\">● Live</span>'", "const stTag={pred:'',live:'<span class=\"tg live\">Live</span>'", 'section live tag'),
 ("<div class=\"rk\">🎬 Gameweek '+D.gw+' preview<span class=\"new\">WATCH</span></div>", "<div class=\"rk\">Gameweek '+D.gw+' preview<span class=\"new\">WATCH</span></div>", 'show card emoji'),
 ("'Every matchup, every lineup — the week in about a minute'", "'Every matchup and lineup in about a minute'", 'show card title'),
 ("<span class=\"go\">▶ PLAY</span></a>';", "<span class=\"go\">PLAY</span></a>';", 'show card play'),
 ("'<span class=\"hr\"><span>—</span></span>')+'</div>'\n   +'<div class=\"card\"><span class=\"hk dn\">", "'<span class=\"hr\"><span>–</span></span>')+'</div>'\n   +'<div class=\"card\"><span class=\"hk dn\">", 'health up placeholder'),
 ("'<span class=\"hr\"><span>—</span></span>')+'</div></div>';", "'<span class=\"hr\"><span>–</span></span>')+'</div></div>';", 'health down placeholder'),
 ("if(!fs.length)return '<span class=\"x\">—</span>';", "if(!fs.length)return '<span class=\"x\">–</span>';", 'next five blank'),
 ("let gwTxt='—',gwSub='This gameweek';", "let gwTxt='–',gwSub='This gameweek';", 'team tile placeholder'),
 ("else{gwTxt=D.hasEP?fmt1(teamProj(mine)):'—';", "else{gwTxt=D.hasEP?fmt1(teamProj(mine)):'–';", 'team tile proj placeholder'),
 ("'<div class=\"asubnote\" style=\"margin-top:8px\">Projected lineups — FPL publishes picks at the deadline'", "'<div class=\"asubnote\" style=\"margin-top:8px\">Projected lineups. FPL publishes picks at the deadline'", 'projected note 1'),
 ("+'. Until then this is each manager’s last lineup carried forward, with new signings slotted by projection and flagged players covered.</div>'",
  "+'; until then each manager’s last lineup carries forward, with new signings and flagged players covered by projection.</div>'", 'projected note 2'),
 ("El Matador Tire</span><button class=\"watch\" id=\"lgre\">↻ Replay</button></div>'", "El Matador Tire</span><button class=\"watch\" id=\"lgre\">Replay</button></div>'", 'lineup replay'),
 ("<div class=\"rk\">📰 Gameweek '+r.gw+' recap<span class=\"new\">NEW</span></div>", "<div class=\"rk\">Gameweek '+r.gw+' recap<span class=\"new\">NEW</span></div>", 'recap emoji'),
 ("<div class=\"rk\">🔭 Gameweek '+p.gw+' preview<span class=\"new\">NEW</span></div>", "<div class=\"rk\">Gameweek '+p.gw+' preview<span class=\"new\">NEW</span></div>", 'preview emoji'),
 ("'Claim your team with a 4-digit PIN to set your photo, colours and crest — or just pick one to follow.'", "'Claim your team with a 4-digit PIN to set your photo, colours and crest, or pick one to follow.'", 'claim note'),
 ("<button class=\"watch elev\" data-claim=\"1\"><span class=\"pl\">★</span>Claim your team</button>", "<button class=\"watch elev\" data-claim=\"1\">Claim your team</button>", 'claim star'),
]

EDITS[V10 + 'v10-graphic.js'] = [
 # ---- score box: the state tag only shows when it says something the label under the score doesn't
 #      ("PREDICTED 39.9-35.8 PREDICTED" before; "Live" over "Proj final ..." stays)
 ("'<div class=\"vsbug\"><span class=\"tg'+(st==='live'?' live':'')+'\">'+tag+'</span>",
  "'<div class=\"vsbug\">'+(tag===lab?'':'<span class=\"tg'+(st==='live'?' live':'')+'\">'+tag+'</span>')+'", 'vsbug duplicate tag'),
 ("/* ===== v10 · the matchup graphic:", "/* " + MARK + " (patch_v12_clean.py) */\n/* ===== v10 · the matchup graphic:", 'marker'),
 ("if(p)return {p,k:'★ Star man · '+p.Player,t:clip(art.ptw.line,170)};", "if(p)return {p,k:'Star man · '+p.Player,t:clip(art.ptw.line,170)};", 'star man article'),
 ("(pts+' points from '+mins+' minutes so far — '+FIRSTOF(team)", "(pts+' points from '+mins+' minutes so far, '+FIRSTOF(team)", 'star man line'),
 ("return {p,k:'★ Star man · '+p.Player,t:line};", "return {p,k:'Star man · '+p.Player,t:line};", 'star man key'),
 ("const tag={pred:'Predicted',live:'● Live',prov:'Provisional',ft:'Full time'}[st];", "const tag={pred:'Predicted',live:'Live',prov:'Provisional',ft:'Full time'}[st];", 'final live tag'),
 ("'<button class=\"watch\" id=\"lgnx\">Skip ▸</button>':'<button class=\"watch\" id=\"lgre\">↻ Replay</button>'", "'<button class=\"watch\" id=\"lgnx\">Skip</button>':'<button class=\"watch\" id=\"lgre\">Replay</button>'", 'graphic skip/replay'),
 ("+'<button class=\"watch\" id=\"lgcl\">✕ Close</button></div>'", "+'<button class=\"watch\" id=\"lgcl\">Close</button></div>'", 'graphic close'),
]

EDITS[V10 + 'v10-show.js'] = [
 ("/* ===== v10 · the gameweek show:", "/* " + MARK + " (patch_v12_clean.py) */\n/* ===== v10 · the gameweek show:", 'marker'),
 ("<button class=\"watch elev\" id=\"shread\"><span class=\"pl\">▶</span>Read the full preview</button>", "<button class=\"watch elev\" id=\"shread\">Read the full preview</button>", 'show read'),
 ("<button class=\"watch\" id=\"shmute\" aria-label=\"Mute\">🔊</button><button class=\"watch\" id=\"shnx\">Skip ▸</button><button class=\"watch\" id=\"lgcl\">✕ Close</button>",
  "<button class=\"watch\" id=\"shmute\" aria-label=\"Mute\">Mute</button><button class=\"watch\" id=\"shnx\">Skip</button><button class=\"watch\" id=\"lgcl\">Close</button>", 'show footer'),
 ("e.currentTarget.textContent=SHOWA.muted?'🔇':'🔊';", "e.currentTarget.textContent=SHOWA.muted?'Unmute':'Mute';", 'show mute toggle'),
 ("q.g.classList.add('done');const nx=document.getElementById('shnx');if(nx){nx.textContent='↻ Replay';", "q.g.classList.add('done');const nx=document.getElementById('shnx');if(nx){nx.textContent='Replay';", 'show end replay'),
 ("const nx=document.getElementById('shnx');if(nx){nx.textContent='↻ Replay';nx.onclick=()=>openShow(q.only);}}", "const nx=document.getElementById('shnx');if(nx){nx.textContent='Replay';nx.onclick=()=>openShow(q.only);}}", 'show article replay'),
 ("if(nx){nx.textContent='Skip ▸';nx.onclick=()=>showSkipChapter();}", "if(nx){nx.textContent='Skip';nx.onclick=()=>showSkipChapter();}", 'show skip'),
 ("if(p)return {p,k:'★ Star man · '+p.Player,t:SHOWCAP||''};", "if(p)return {p,k:'Star man · '+p.Player,t:SHOWCAP||''};", 'show star man'),
]

EDITS[V10 + 'v10-auth.js'] = [
 ("/* ===== v10-auth —", "/* " + MARK + " (patch_v12_clean.py) */\n/* ===== v10-auth —", 'marker'),
 ("'Timed out — check your signal and try again.'", "'Timed out. Check your signal and try again.'", 'auth timeout'),
 ("'Couldn’t reach the server — try again.'", "'Couldn’t reach the server. Try again.'", 'auth unreachable'),
 ("<button class=\"watch\" data-claim=\"1\">✎ Edit team</button>", "<button class=\"watch\" data-claim=\"1\">Edit team</button>", 'auth edit'),
 ("err('Wrong PIN — try again.')", "err('Wrong PIN. Try again.')", 'auth wrong'),
 ("err('Too many tries — locked for '", "err('Too many tries. Locked for '", 'auth locked'),
 ("err('Already claimed — sign in with your PIN, or ask Parker to reset it.')", "err('Already claimed. Sign in with your PIN, or ask Parker to reset it.')", 'auth claimed'),
 ("err('Not claimed yet — set a new PIN to claim it.')", "err('Not claimed yet. Set a new PIN to claim it.')", 'auth unclaimed'),
 ("'That photo won’t shrink enough — try a simpler one.'", "'That photo won’t shrink enough. Try a simpler one.'", 'auth photo shrink'),
 ("err('Your sign-in expired — sign in again.')", "err('Your sign-in expired. Sign in again.')", 'auth expired'),
 ("err('That photo is too large — choose another.')", "err('That photo is too large. Choose another.')", 'auth photo large'),
]

EDITS[V10 + 'v10-history.js'] = [
 ("/* ===== v10 · player score history", "/* " + MARK + " (patch_v12_clean.py) */\n/* ===== v10 · player score history", 'marker'),
 ("<p class=\"hnone\">No gameweeks played yet — his history builds here from the first kickoff.</p>", "<p class=\"hnone\">No gameweeks played yet.</p>", 'history empty'),
 (":'<span class=\"oc\">—</span>';", ":'<span class=\"oc\">–</span>';", 'history blank opp'),
 ("xP is what the performance deserved — bonus left out, as everywhere in the app.", "xP is what the performance deserved, with bonus left out.", 'history note'),
]

EDITS[V10 + 'v10-refresh.js'] = [
 ("/* ===== v10 · the header ↻ button", "/* " + MARK + " (patch_v12_clean.py) */\n/* ===== v10 · the header ↻ button", 'marker'),
 ("say('Couldn’t reach the sheet — showing what it has')", "say('Couldn’t reach the sheet. Showing the last update')", 'refresh offline'),
 ("say('Sheet updated — loading…')", "say('Sheet updated. Loading…')", 'refresh ran'),
 ("say('Already updating — try again in a moment')", "say('Already updating. Try again in a moment')", 'refresh busy'),
 ("say('Fresh — updated '+", "say('Updated '+", 'refresh fresh'),
 ("say('Couldn’t update the sheet — showing what it has')", "say('Couldn’t update the sheet. Showing the last update')", 'refresh failed'),
 ("say('Couldn’t reach the sheet updater — showing what it has')", "say('Couldn’t reach the sheet updater. Showing the last update')", 'refresh unreachable'),
]

EDITS[V10 + 'v10-derbies.js'] = [
 ("/* ===== v10 · Matchday sub-tabs", "/* " + MARK + " (patch_v12_clean.py) */\n/* ===== v10 · Matchday sub-tabs", 'marker'),
 ("+' pairings — the naming committee has work to do</summary>", "+' pairings</summary>", 'unnamed summary'),
]

EDITS[V10 + 'v10-results.js'] = [
 ("/* ===== v10 · team results history", "/* " + MARK + " (patch_v12_clean.py) */\n/* ===== v10 · team results history", 'marker'),
 ("<p class=\"hnone\">No gameweeks played yet — the season’s results build here from GW1.</p>", "<p class=\"hnone\">No gameweeks played yet.</p>", 'results empty'),
 ("+'<td class=\"xp\">'+(r.xp===null?'—':", "+'<td class=\"xp\">'+(r.xp===null?'–':", 'results xp blank'),
 ("if(!c)return '<td class=\"none\">—</td>';", "if(!c)return '<td class=\"none\">–</td>';", 'grid blank'),
]


def main():
    plan = []
    for rel, reps in EDITS.items():
        p = ROOT / rel
        assert p.exists(), f'missing {p}'
        s = p.read_text(encoding='utf-8')
        if MARK in s:
            print(f'  = {rel}: already patched')
            continue
        n0 = 0
        for old, new, label in reps:
            c = s.count(old)
            assert c == 1, f'{rel} [{label}]: expected 1 match, found {c}'
            s = s.replace(old, new)
            n0 += 1
        assert MARK in s, f'{rel}: marker edit missing'
        plan.append((p, s, n0, rel))
    if CHECK:
        for _, _, n, rel in plan:
            print(f'  ok {rel}: {n} edits would apply')
        print('check only, nothing written')
        return
    for p, s, n, rel in plan:
        mode = os.stat(p).st_mode
        if not os.access(p, os.W_OK):
            os.chmod(p, mode | 0o200)
        try:
            p.write_text(s, encoding='utf-8', newline='\n')
        finally:
            os.chmod(p, mode)
        print(f'  + {rel}: {n} edits (incl. marker)')
    print('patched' if plan else 'nothing to do (every file already carries the marker)')


if __name__ == '__main__':
    main()
