/*******************************************************
 * EL MATADOR TIRE — FPL Draft League 45380 · 2026/27
 * Google Sheet + Apps Script · v3.27 (the voicing cap counts per script version) · v3.26 (the Gameweek Show on ElevenLabs v4 Turbo, with audio tags for emotion) · v3.25 (ElevenLabs credits guarded: balance, per-gameweek cap, no retries while out) · v3.24 (the Gameweek Show: only current takes, captions in sync) · v3.23 (the research gets its room and says when it ran out) · v3.22 (the Clubs tab mirrors FPL's difficulty ratings) · v3.21 (per-fixture BPS: provisional bonus in a double gameweek) · v3.20 (the writers and the Claude 5.5 models: no more cut-off replies) · v3.19 (waiver times and order in the sheet) · v3.18 (errors reported by phones) · v3.17 (?health=1 data: the last refresh, the live window) · v3.16 (self-update from the tested release branch) · v3.15 (facts without phones: the Facts bot) · v3.14 (articles publish themselves; live rewrites) · v3.13 (articles write themselves; model chains) · v3.12 (the show writes itself; Code.gs updates itself) · v3.11 (the Gameweek Show: voice clips from ElevenLabs) · v3.10 (the rumour mill; fewer, better AI posts) · v3.9 (the AI writer) · v3.8 (social: quotes, reactions, votes)
 *
 * SETUP (one time):
 *   1. Extensions → Apps Script → paste into Code.gs
 *   2. Run setup() once and authorize (installs the hourly refreshAll trigger AND the 10-minute liveTick trigger)
 *   3. Share the Sheet: Anyone with the link · Viewer
 *   4. Deploy → New deployment → Web app · Execute as Me · Anyone → paste the URL into Specials as Setting `API URL`
 *
 * CHANGELOG
 * v3.27 · 9 Oct 2026
 *   The Gameweek Show's voicing cap counts per script version (Parker, 9 Oct 2026: a hand-written show/gw<N>.json that
 *   replaces a script already voiced must be voiced before the deadline; the v3.25 cap counted the gameweek as a whole,
 *   so a re-voice of the old script would have blocked the new one).
 *   1. A script version is the md5 of its lines' texts (emtShowVersionId; the voice, model and speed do not count, so
 *      a model change re-voices the same version). A render registers the version it voices in EMT_SHOW_GW_VER_<gw>
 *      ({ list, used }) and counts the characters it sends against that version (emtShowCount), and the cap is the
 *      version's own length plus a quarter (EMT_SHOW_GW_CAP_RATIO), so a new hand-written script gets its own
 *      allowance. A pinned gameweek (v3.26) still gets exactly one more script's worth, per version.
 *   2. Bounded: at most EMT_SHOW_GW_VERSIONS (3) versions a gameweek get an allowance of their own; a fourth and
 *      every later rewrite count against the last registered version's allowance, so a script flipping between
 *      versions can never voice more than three scripts and a quarter each (a gameweek that spent characters before
 *      this version carries them as its first version). No loop: nothing here retries, re-renders or resets a count.
 *   3. Unchanged: the balance read before any ElevenLabs call, the hold after a refusal and its hourly read, the
 *      monthly count, and EMT_SHOW_GW_CAP_<gw>, which still caps the gameweek as a whole when set (EMT_SHOW_GW_CHARS_<gw>
 *      keeps the gameweek's total for it).
 *   4. ?health=1 show.cap { used, cap, version, versions, own } and the capped error name the version.
 * v3.26 · 9 Oct 2026
 *   The Gameweek Show is voiced by ElevenLabs v4 Turbo, with more emotion (Parker, 8 Oct 2026: "Give V4 Turbo a good
 *   shot. And let's try and give the voice more emotion.").
 *   1. The model: eleven_v4_turbo (EMT_SHOW_MODEL_DEFAULT). The Script Property EMT_TTS_MODEL still wins when set; the
 *      script json's "model" is a label now, never the choice (every written script carried eleven_multilingual_v2),
 *      so GW6 and every later script are voiced with the default. The take's hash stays md5(text|voice|model|speed)
 *      with the model that is actually used, so the change re-voices every line once.
 *   2. The settings a v4 model takes, and only those: voice_settings { stability, similarity_boost }, no style, speed
 *      or speaker boost (v4 has none of them and SSML is not supported). Stability 0 (ElevenLabs' "Creative": the
 *      expressive end; EMT_SHOW_STABILITY, 0 to 1, changes it), similarity 0.75. previous_text and next_text go on as
 *      before, through the with-timestamps endpoint. Any other model keeps the v3.24 body.
 *   3. Audio tags: the show writer and the punch-up may put a tag in square brackets before the words it shapes
 *      ([laughing], [whispering], [deadpan], [sighs] ...), at most two a line and never on every line (emtShowCheck
 *      refuses more; the word counts and the number guard ignore the tags). A tag goes to ElevenLabs and nowhere
 *      else: the word times are built from the caption text (emtShowCaption: the tags stripped, the alignment's tag
 *      characters skipped), so w has one time per caption word, and the app strips the tags from its captions.
 *      show/gw6.json carries tags by hand, every word kept.
 *   4. The fallback, once: when ElevenLabs refuses the model or a field (a 400 or 422; a credit refusal or a wrong key
 *      is not one) the gameweek is pinned to the previous model and settings (EMT_SHOW_MODEL_GW_<gw>:
 *      eleven_multilingual_v2 with the v3.24 body), the refusal is kept in ?health=1 show.render and show.model, and
 *      the next render voices with the fallback. The pin is read everywhere a hash is made (render, ?show, health),
 *      so takes never flip between stale and fresh and nothing re-renders every tick; v4 is tried again only when the
 *      pin is deleted. The v3.25 balance read and hold are untouched; the gameweek cap allows a pinned gameweek exactly
 *      one more script's worth (the re-voice the fallback needs; a pin can be set only once, so it stays bounded).
 *   5. ?health=1 show.model { model, from: default | property | fallback, fallback? } and render.model; the status
 *      page names the model of the last render.
 *   No new setup and no new permissions. The first render after this version re-voices GW6 in full (about 3,200
 *   characters, inside the v3.25 cap of the script plus a quarter).
 * v3.25 · 8 Oct 2026
 *   ElevenLabs credits are never burned again (Parker's request, BUGS #30: the account ran out after the GW6 show was
 *   voiced on 7 Oct, voiced again at 00:46 UTC on 8 Oct after a rewrite, and every render since was refused).
 *   1. Before a render voices anything it reads the account's balance (GET /v1/user/subscription with the same key:
 *      characters used, the limit, the next reset) and skips the render, saying so in the log and in ?health=1, when
 *      the lines still to voice would not fit. A key without the user_read permission falls back to a count kept here
 *      (EMT_SHOW_CHARS_<yyyy-mm>: characters sent this calendar month) against EMT_SHOW_MONTHLY_LIMIT (default 10,000).
 *   2. A gameweek may voice at most its script's own length plus a quarter (EMT_SHOW_GW_CHARS_<gw> counts the
 *      characters voiced; EMT_SHOW_GW_CAP_<gw>, in characters, raises the cap): the first render plus edits of up to a
 *      quarter of the script; a whole second rewrite waits for the cap to be raised. Counting starts with this version.
 *   3. After a credit refusal (402, or 401 quota_exceeded), or a balance that does not fit, showTick makes no
 *      ElevenLabs render until the reported reset time (24 hours when unknown), kept in EMT_SHOW_HOLD, instead of
 *      trying every 15 minutes. Meanwhile the balance is read once an hour (a free call), so a top-up is noticed
 *      within the hour; the menu's Render now lifts the hold at once.
 *   4. ?health=1 show gains credits { left, limit, resets, at, from } (from: elevenlabs, or count when the key cannot
 *      read the balance), need (characters still to voice), cap { used, cap }, capped and hold { until, why, since };
 *      render carries need and hold. The status page (matchweek.gg/status) says them in plain words. ai gains last
 *      (the feed writer's last run: when, events due, posts made, any error), so a quiet day and a broken writer can
 *      be told apart without the Apps Script log.
 *   No new setup and no new permissions (the balance read uses the ElevenLabs key already set; without user_read on
 *   that key the count kept here is used instead).
 * v3.24 · 8 Oct 2026
 *   The Gameweek Show plays only the takes of the script as it is now, and its captions follow the voice (Parker,
 *   8 Oct 2026, after the GW6 show: old jokes in the audio, subtitles out of step). The GW6 clips in ShowAudio were
 *   rendered at 00:46 UTC from the second of four versions of show/gw6.json; the two later rewrites (00:47, 01:02)
 *   were never voiced, because every render since stopped at its first ElevenLabs refusal and said so only in the
 *   Apps Script log, while ?show=6 served the 22 old takes as complete and ?health=1 counted them as 22 of 22.
 *   1. ?show=<gw> judges every stored take against the current script: a clip is served only when its stored hash
 *      is md5(text|voice|model|speed) of the line as it is now; older takes are listed in stale and never served,
 *      lines without a take in missing; complete means every line has a current take. With no script at all nothing
 *      is served. The app plays the clips it gets and falls back to the timed caption for a stale or missing line.
 *   2. ?health=1 show: clips counts current takes only, stale the older ones, expected the script's lines, source
 *      where the script came from (repo or sheet), render the last render's outcome (ok or the ElevenLabs refusal,
 *      with its error text), kept in EMT_SHOW_LAST. showStatus(gw) says the same.
 *   3. Clips are rendered through ElevenLabs' with-timestamps endpoint (the same voice, model and speed; the audio
 *      comes back as base64 with a character alignment). Each clip's word start times go in a new Words column of
 *      ShowAudio ("[0,0.42,...]", one number per word, on the clip's first row; the header cell is added to an
 *      existing tab) and are served as w; the app reveals each word at its time. A take without them (an older
 *      render, an alignment that does not line up) keeps the app's estimate. If the endpoint is not there (404 or
 *      405) the plain call is made instead, without word times. A refusal still stops the run (no burnt credits).
 *   No new setup and no new permissions. The next render after this version re-voices every changed line; the
 *   health field show.render says why if ElevenLabs refuses.
 * v3.23 · 8 Oct 2026
 *   The articles' research gets the room it needs and its log says when it ran out (BUGS #28). Both GW6 preview jobs
 *   ended their research with "0 characters, 0 sources": claude-sonnet-5-5 thinks before and between its web searches,
 *   and that thinking and the searches count against max_tokens, so with up to 10 searches the 8,000 tokens of v3.20
 *   were spent before any notes were written and both previews went out from the league data alone. The first writing
 *   try of each job ran out of its 16,000 tokens the same way; only the second try passed.
 *   1. The batch budgets: 32,000 tokens each for the research, the writing and the punch-up (billed only as generated;
 *      a batch request has no HTTP timeout to keep under). emtModelParams is unchanged: the quick calls keep thinking off.
 *   2. The research line in the Log (Articles tab) names the budget when the reply ended at max_tokens, says when the
 *      model searched but wrote no notes, and keeps the pause_turn note (emtArtResearchLog).
 *   No new setup and no new permissions.
 * v3.22 · 8 Oct 2026
 *   The Clubs tab mirrors what FPL publishes now (ROADMAP A7, BUGS #25). Since this season FPL's classic
 *   bootstrap-static carries 0 in strength_attack_* and strength_defence_* for every club, and its 1 to 5 fixture
 *   difficulty in strength_overall_home and strength_overall_away: a club's home figure is the difficulty of hosting
 *   it and its away figure the difficulty of visiting it (the fixture feed's team_h_difficulty and team_a_difficulty,
 *   checked on every fixture of GW6 to GW8 on 8 Oct 2026).
 *   1. The four attack and defence columns, 0 for all 20 clubs, are dropped. Str H and Str A stay (the header: Short,
 *      Name, Badge code, Badge URL, Str H, Str A), written only when FPL gives 1 to 5, else left blank.
 *   2. The app reads Str H and Str A for its fixture difficulty (the pills and the projection's strength prior) in
 *      place of its built-in table, which FPL had moved on from for 7 of the 20 clubs; the table stays as the fallback
 *      for a sheet without the columns, refreshed to FPL's values of 8 Oct 2026.
 *   No new setup and no new permissions.
 * v3.21 · 8 Oct 2026
 *   Per-fixture BPS, so a double gameweek's second match gets a provisional bonus (ROADMAP A6, BUGS #8). A GW Stats
 *   row sums a player's whole gameweek, so the app could rank one match's BPS only while it was the club's only match
 *   under way; the second match of a double showed no bonus until FPL confirmed it.
 *   1. Every refresh rewrites a hidden Fixture BPS tab for the current gameweek: GW, Fixture (FPL's id), Home, Away,
 *      Kickoff (UTC), Started, Finished, Code, Player, Club, BPS, Bonus; one row per player per fixture with a BPS
 *      entry, the fixture's official bonus beside it once FPL confirms it. Sources: the draft live feed's fixtures
 *      (stats bps and bonus) and the classic fixtures feed (fixtures/?event=); per fixture the fresher feed wins, as
 *      the live overlay does. When neither feed lists the fixtures the tab is left as it was.
 *   2. The app reads the tab (optional) and, for a club with more than one match started this gameweek, ranks each
 *      finished match's own BPS for its provisional 3-2-1; a club's only match keeps the GW Stats path, unchanged.
 *   No new setup and no new permissions.
 * v3.20 · 8 Oct 2026
 *   The writers work again on the Claude 5.5 models. Since v3.13 the feed writer, the show writer and the articles
 *   ask claude-haiku-5-5 and claude-sonnet-5-5, which think before they answer unless told otherwise, and the
 *   thinking counts against max_tokens: with 900, 2,000 and 6,000 tokens every reply was cut off before its JSON
 *   ended. The GW6 preview failed all 3 tries that way (8 Oct, 12:01 to 15:46) and no feed post went out all day.
 *   1. emtModelParams(model, mode): the quick, synchronous calls (the feed writer, the show writer and its punch-up,
 *      which must answer within UrlFetchApp's minute) turn thinking off the way each model allows (Sonnet 5.5:
 *      thinking between_tools; Haiku 5.5: thinking disabled; Opus 5.5: effort low), as the 4.5 models answered
 *      without it; the batch calls (the articles' research, writing and punch-up) keep the model's own thinking and
 *      get room for it. The 4.5 fallbacks get no extra parameter. A model that refuses a thinking or effort
 *      parameter (a 400 naming it) is asked once more without it.
 *   2. max_tokens: feed 2,000 (was 900), show 4,000 (was 2,000), research 8,000 (was 3,000), article writing and
 *      punch-up 16,000 (was 6,000).
 *   3. An article that failed under an older Code.gs is tried once more by a newer one, as long as its window is
 *      still open (the failure log now ends with the version that failed); a failure under the same version is
 *      final, as before. So the GW6 preview starts again by itself once this version is live.
 *   No new setup and no new permissions.
 * v3.19 · 8 Oct 2026
 *   The app knows the waiver window (Parker: Jive should know the waiver deadline).
 *   1. Matchweeks gains a last column, Waivers (UTC): FPL's own waivers_time for each gameweek (claims are processed
 *      then, 24 hours before the deadline; free agency runs from then until the deadline).
 *   2. Standings gains a last column, Waiver pick: FPL's own waiver order (1 = first claim, the lowest team).
 *   Both are new columns on the end, so every reader of the old columns is unchanged. No new setup or permissions.
 * v3.18 · 8 Oct 2026
 *   Phones report script errors (ROADMAP A4). The app posts `clienterror` (no login needed) with the build stamp, the
 *   route, the kind (error, rejection, or network for a flaky connection), the message and a truncated stack; nothing
 *   personal. They go to a new hidden Errors tab: the same error from the same build and route within 10 minutes
 *   counts up on one row, the tab keeps 1,000 rows, and all phones together are limited to 60 accepted posts per 10
 *   minutes. ?health=1 adds errors: h24 (occurrences in the last 24 hours, network ones aside), net24, rows and the
 *   latest one (build, route, message), cached a minute. The monitor opens an outage issue at 20 in 24 hours.
 *   No new setup and no new permissions.
 * v3.17 · 8 Oct 2026
 *   ?health=1 adds data, for the cloud monitor (.github/workflows/monitor.yml, every 15 minutes, no AI): updated (when
 *   the last refresh from FPL finished, whichever trigger or app tap ran it; EMT_DATA_UPDATED, set only when refreshCore
 *   completes), source, ageMin, attempted (the last refresh that started, finished or not), and live (a Premier League
 *   match is live or just finished, the same rule liveTick refreshes on) with liveWhy and liveSince (when that window
 *   opened, so a monitor does not expect 10-minute data in the first minutes of a match). The monitor opens a GitHub
 *   issue labelled outage when the data is older than 2 hours (20 minutes while a match is live), the app or this web
 *   app does not answer, the FPL API is down or the self-update reports refused or error, and closes it on recovery.
 *   No new setup and no new permissions.
 * v3.16 · 8 Oct 2026
 *   The self-update reads Code.gs from the repo's `release` branch instead of main. A GitHub Action
 *   (.github/workflows/codegs.yml) runs every test suite in tests/codegs on each push to main that touches Code.gs or
 *   the tests, and fast-forwards `release` to that commit only when all of them pass. A broken push to main therefore
 *   never reaches this script: release stays where it was and the Action's run is red. Nothing else changes; the
 *   version, size, marker and load checks of v3.12 still apply to what is fetched.
 *   No new setup and no new permissions. The release branch was created from main (at v3.15) before this switch.
 * v3.15 · 8 Oct 2026
 *   The facts without anyone's phone: the Facts bot.
 *   1. A GitHub Action (.github/workflows/facts.yml, every 3 hours and on demand) loads the live app headless in
 *      Chromium, has the app's own engine compute the preview facts (what a phone posts as showfacts) and the recap
 *      facts (artfacts), and commits them to the repo's `facts` branch when they change: facts/index.json (which
 *      files there are and when each last changed), facts/preview-gw<N>.json and facts/recap-gw<N>.json. The same
 *      windows as the phones (the preview in the last 54 hours before the deadline, the recap for 5 days after the
 *      gameweek's last game) and the same trimming, so a file is byte for byte what a phone would have sent.
 *   2. The show writer and the articles read whichever is newer, a phone's post or the repo's file (emtFactsBest). A
 *      repo file passes exactly the checks a phone's post passes (this gameweek's fixtures; for a recap a finished
 *      gameweek with its exact scores) or it is ignored and the log says why. The repo is the trust anchor (only the
 *      Action and the commissioner can write to it), so no secret is involved. One read of the index a run (cached
 *      4 minutes), a file only when it is the newer one and its data is wanted. A GitHub that does not answer costs
 *      nothing: the phones' facts count as before.
 *   3. ?health=1 adds facts: the newest preview and recap facts, where each came from (phone or repo) and the repo's
 *      index; show.factsFrom says the same for the show.
 *   No new setup and no new permissions (UrlFetchApp to raw.githubusercontent.com, which the self-update already
 *   uses). Tests: tests/codegs/v315.js; the bot's own in tests/factsbot.js.
 * v3.14 · 8 Oct 2026
 *   Recaps and previews publish themselves. The commissioner's call: no approval step from now on.
 *   1. An article that passes every check (after the punch-up, where the draft used to be made) goes live at once:
 *      every manager can read it in the app. It is stored as plain text exactly as an approved one is, Approved (UTC)
 *      is that moment and the Log says 'Published automatically'. Nothing waits for the commissioner any more. A draft
 *      still waiting from before (v3.13, or written while EMT_ART_REVIEW was yes) is published by the next run.
 *   2. The commissioner can still fix a live article from his phone. Ask for a rewrite with a note (the same as for a
 *      draft: 400 characters, 3 rewrites an article, queued while another article is being written): the live
 *      version stays up and readable the whole time, and the new one replaces it only once it passes the checks. If
 *      the rewrite fails, the live version stays and the Log says so. Take it down (drop) works as before. The
 *      rewrite in progress is noted in the Note cell, so if its job is lost the next run picks it up again.
 *   3. Script Property EMT_ART_REVIEW = yes brings back the v3.13 flow unchanged: every article waits, sealed, for the
 *      commissioner to approve it, and a live article can be taken down but not rewritten.
 *   4. GET ?articles=1 adds review (true in review mode) and each live article's written time (it changes when a
 *      rewrite replaces the text, so phones fetch the new one); ?article=<id> adds auto (published without a manual
 *      approval). POST articles also gives the commissioner review and his live articles (rewrites used, his last
 *      note, a rewrite in progress or failed). ?health=1 and articlesStatus() show the mode (auto or review) and any
 *      rewrite in progress.
 *   No new setup and no new permissions. Optional Script Property: EMT_ART_REVIEW = yes.
 * v3.13 · 8 Oct 2026
 *   Articles write themselves: the gameweek recap and the deadline preview, with nobody's computer on.
 *   1. The app sends the facts. Recap facts go to the new `artfacts` action: signed-in managers only, one accepted
 *      post per manager per 20 minutes, only for the latest gameweek whose head to head results are all final, and
 *      every result in them must match H2H Fixtures. They are kept in a new hidden RecapFacts tab. Preview facts ride
 *      the existing `showfacts` action (the app now sends them up to 54 hours before the deadline; the server never
 *      limited how early).
 *   2. Every 15 minutes aiTick runs articleTick, after the show and before the self-update. One article at a time:
 *      the recap once a gameweek is final and fresh recap facts are in (up to 5 days after its last game), the
 *      preview in the last 50 hours before a deadline once fresh preview facts are in; the recap goes first. Claude
 *      researches the real football with web search, then writes the article as JSON, both through the Message
 *      Batches API (no long calls). The article is checked: every fixture once with exact names, stars from the
 *      right elevens, no dashes, emoji, hashtags or first person, no number that is not in the facts or the
 *      research, 600 to 1,400 words. A failed check goes back once with the problems; 3 tries in all. The draft is
 *      kept in a new hidden Articles tab (working files in a hidden ArticleWork tab).
 *   3. The commissioner reads every draft in the app before anyone else and approves it, asks for a rewrite with a
 *      note (3 at most) or drops it (new `articles` and `articlemod` actions). Only approved articles are served:
 *      GET ?articles=1 (the list, plus what is still waiting, never its text) and ?article=<id>.
 *      GET ?health=1 reports the pipelines for cloud monitors, with no secrets.
 *      The sheet can be viewed by anyone with its link, hidden tabs included, so until an article is approved its
 *      text, a rejected reply and the commissioner's note are stored sealed (encrypted with a random key the script
 *      makes for itself in EMT_ART_SEAL; the Log keeps no draft text). Approving stores it as plain text.
 *   4. Model chains. Each writer tries its models in order and moves to the next when one is retired (404, or a 400
 *      about the model); a missing model is skipped for 3 days (EMT_MODEL_GONE). Articles: EMT_ARTICLE_MODEL, then
 *      claude-sonnet-5-5, claude-opus-5-5, claude-sonnet-4-5. Show writer: EMT_SHOW_MODEL, then claude-sonnet-5-5,
 *      claude-sonnet-4-5. AI writer: EMT_AI_MODEL, then claude-haiku-5-5, claude-haiku-4-5.
 *   5. The writers are funnier: clever, football-Twitter jokes, each built on a real fact of the week; swearing is
 *      allowed as seasoning (two at most in a piece, never the joke itself); the hard limits are unchanged (nothing
 *      about anyone's real life, no slurs, nothing about race, religion, sexuality, disability or nationality as an
 *      insult, nothing sexual). One tone block (THE READERS) goes into the AI writer, the show writer and the article
 *      writer; Archizio, Clark and Malcolm keep their mannerisms. Show beats may run 10 to 22 words (was 10 to 16).
 *   6. The punch-up pass. Once an article or a show script has passed its checks, Claude Haiku makes it funnier
 *      without touching a fact, number, name, star or source, and every check runs again. If it fails a check, errors,
 *      expires, has no model left or is still running 2 hours later, the checked version goes out as it was (the Log
 *      says why). Articles: one more batch while the status stays 'writing'; it never counts as a try and drafts stay
 *      sealed; the Model column reads '<writer> + <punch model>' when the punch-up was used. Show: one quick call,
 *      skipped when the run is already late. Script Properties: EMT_PUNCH_MODEL (tried first, then claude-haiku-5-5,
 *      claude-haiku-4-5) and EMT_PUNCH_OFF = yes (no punch-up for either). ?health=1 shows the last outcome of each.
 *   No new setup: same ANTHROPIC_API_KEY, no new permissions. Optional Script Properties: EMT_COMMISH (the
 *   commissioner's team, default Cold Palmers), EMT_ARTICLES_PAUSED = yes, EMT_ARTICLE_MODEL, EMT_PUNCH_MODEL,
 *   EMT_PUNCH_OFF = yes. If web search is off for the key's Anthropic organisation (a 400 or 403 about it), or no
 *   search result comes back at all, articles are written from the league data alone and say so in the Log. Do not
 *   delete EMT_ART_SEAL: drafts written before that can no longer be read (ask for a rewrite, or use Articles: write
 *   now).
 *   Menu: Articles: status, Articles: write now. articlesStatus() logs the same from the editor.
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
 *   2. Code.gs updates itself from GitHub. Once an hour aiTick fetches Code.gs from the repo's main branch (v3.16: the release branch), checks
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
    .addItem('Articles: status', 'articlesStatus')                // v3.13
    .addItem('Articles: write now', 'articlesWriteNow')           // v3.13
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
  try { writeFixtureBps(ss, boot, gwLive, curEv, classicIdToCode); } catch (e) { Logger.log('Fixture BPS failed: ' + e); }   /* v3.21, BUGS #8 */
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

/* ---------- Fixture BPS (v3.21, BUGS #8): the current gameweek's BPS and bonus per fixture ----------
   A GW Stats row sums a player's whole gameweek, so in a double gameweek the app cannot rank one match's BPS and the
   club's second match shows no provisional bonus. FPL publishes the lists per fixture (the draft live feed's fixtures
   carry stats bps and bonus with draft element ids; the classic fixtures feed carries the same with classic ids), so
   every refresh rewrites the hidden Fixture BPS tab for the current gameweek: one row per player per fixture with a
   BPS entry, the fixture's official bonus beside it once FPL confirms it. Per fixture the fresher feed wins (the
   classic one when it lists more players, or has the bonus the draft one lacks), as the live overlay does. The app
   ranks these rows for a club's second match of the gameweek; a club's only match keeps the GW Stats path, unchanged.
   Nothing reads older gameweeks: once FPL confirms a gameweek every bonus is in GW Stats. */
var FIXBPS_TAB = 'Fixture BPS';
var FIXBPS_HEAD = ['GW', 'Fixture', 'Home', 'Away', 'Kickoff (UTC)', 'Started', 'Finished', 'Code', 'Player', 'Club', 'BPS', 'Bonus'];

/* one feed's fixtures of gameweek gw as { key: { id, h, a, kickoff, started, finished, bps: {code: n}, bonus: {code: n} } };
   the key is FPL's fixture code (the same in both feeds), the id as a fallback; idToCode maps the feed's element ids */
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

function writeFixtureBps(ss, boot, gwLive, curEv, classicIdToCode) {
  if (!curEv) return { ok: false, why: 'no current gameweek' };
  var dId = {}, names = {}, clubs = {};
  boot.elements.forEach(function (e) { dId[e.id] = e.code; names[String(e.code)] = e; });
  boot.teams.forEach(function (t) { clubs[t.id] = t.short_name; });
  var draft = fixBpsFromFeed(gwLive && gwLive.fixtures, curEv, dId), classic = {};
  try { if (classicIdToCode && Object.keys(classicIdToCode).length) classic = fixBpsFromFeed(getUrl(CLASSIC + 'fixtures/?event=' + curEv), curEv, classicIdToCode); }
  catch (e) { Logger.log('Fixture BPS: the classic fixtures feed failed: ' + e); }
  var keys = {};
  Object.keys(draft).forEach(function (k) { keys[k] = 1; });
  Object.keys(classic).forEach(function (k) { keys[k] = 1; });
  var list = Object.keys(keys);
  if (!list.length) { Logger.log('Fixture BPS GW' + curEv + ': neither feed lists the fixtures; the tab is left as it was'); return { ok: false, why: 'no fixtures' }; }
  var rows = [], fromClassic = 0, n = function (o) { return Object.keys(o).length; };
  list.map(function (k) {
    var d = draft[k], c = classic[k];
    var fresher = !!(c && (!d || n(c.bps) > n(d.bps) || (n(c.bonus) && !n(d.bonus))));
    if (fresher) fromClassic++;
    return fresher ? c : d;
  }).sort(function (x, y) { return (x.kickoff < y.kickoff ? -1 : x.kickoff > y.kickoff ? 1 : 0) || x.id - y.id; }).forEach(function (f) {
    Object.keys(f.bps).sort(function (x, y) { return f.bps[y] - f.bps[x] || (x < y ? -1 : 1); }).forEach(function (code) {
      var p = names[code] || {};
      rows.push([curEv, f.id, clubs[f.h] || f.h, clubs[f.a] || f.a, "'" + f.kickoff, f.started, f.finished,
        code, p.web_name || '', clubs[p.team] || '', f.bps[code], f.bonus[code] || 0]);
    });
  });
  var sh = emtHiddenSheet(FIXBPS_TAB, FIXBPS_HEAD);
  sh.clearContents();
  sh.getRange(1, 1, rows.length + 1, FIXBPS_HEAD.length).setValues([FIXBPS_HEAD].concat(rows));
  Logger.log('Fixture BPS GW' + curEv + ': ' + list.length + ' fixtures, ' + rows.length + ' player lines' + (fromClassic ? ', ' + fromClassic + ' fixtures from the classic feed' : ''));
  return { ok: true, fixtures: list.length, rows: rows.length, classic: fromClassic };
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

/* ---------- v3.6 · FPL team strengths for the Clubs tab; v3.22 · the fields FPL publishes now ----------
 * Since 2026/27 the classic bootstrap-static carries FPL's 1 to 5 fixture difficulty in strength_overall_home and
 * strength_overall_away (a club's home figure is the difficulty of hosting it, its away figure the difficulty of
 * visiting it: the fixture feed's team_h_difficulty and team_a_difficulty, checked on GW6 to GW8, 8 Oct 2026) and 0
 * in the attack and defence strengths it used to publish, so those columns are dropped (ROADMAP A7, BUGS #25). The
 * app reads Str H and Str A for its fixture difficulty. Source: the classic team, falling back per field to the draft
 * team object; a figure outside 1 to 5 (FPL's 0 for a rating it no longer publishes) is left blank. */
var CLUB_STR_HEAD = ['Str H', 'Str A'];
var CLUB_STR_FIELDS = ['strength_overall_home', 'strength_overall_away'];
function clubStrengthRow(classicTeam, draftTeam) {
  return CLUB_STR_FIELDS.map(function (k) {
    var v = (classicTeam && classicTeam[k] != null && classicTeam[k] !== '') ? classicTeam[k] : (draftTeam && draftTeam[k]);
    var n = Number(v);
    return (v == null || v === '' || isNaN(n) || n < 1 || n > 5) ? '' : n;
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

  /* ----- clubs: official badge codes + FPL's own difficulty ratings (v3.6, the fields of v3.22) ----- */
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

  /* v3.19: Waiver pick is FPL's own waiver order (league_entries waiver_pick: 1 = first claim, the lowest team in the table) */
  put('Standings', ['Team', 'Manager', 'W', 'D', 'L', 'Pts For', 'Pts Against', 'League Pts', 'Waiver pick'],
    details.standings.map(function (s) {
      var t = teams[leToEntry[s.league_entry]] || {};
      return [t.name || '', t.manager || '', s.matches_won, s.matches_drawn, s.matches_lost, s.points_for, s.points_against, s.total, t.waiver || ''];
    }));

  var periodOf = function (gw) {
    for (var i = 0; i < MOTM_PERIODS.length; i++) if (gw >= MOTM_PERIODS[i].from && gw <= MOTM_PERIODS[i].to) return MOTM_PERIODS[i].name;
    return '';
  };
  /* v3.19: Waivers (UTC) is FPL's own waivers_time: claims for that gameweek are processed then (24 hours before the
     deadline), and free agency runs from then until the deadline. New columns go on the end: readers use the first two. */
  put('Matchweeks', ['GW', 'Deadline (UTC)', 'MOTM period', 'Finished', 'Notes', 'Waivers (UTC)'],
    (boot.events.data || boot.events).map(function (e) {
      var note = e.id === MIDSEASON_GW ? '💰 $' + PRIZES.mid + ' mid-season leader after this GW' : (e.id === 38 ? '🏆 Final GW' : '');
      return [e.id, "'" + e.deadline_time, periodOf(e.id), e.finished, note, e.waivers_time ? "'" + e.waivers_time : ''];
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
    p.setProperty('EMT_DATA_UPDATED', JSON.stringify({ at: Date.now(), source: String(source || ''), ms: Date.now() - now }));   /* v3.17: ?health=1 data.updated */
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
function liveWindowReason(nowMs) { return liveWindow(nowMs).why; }
/* v3.17: the same, with when that window opened: { why: '', since: 0 } | { why, since (ms) } */
function liveWindow(nowMs) {
  var none = { why: '', since: 0 };
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName('Club Fixtures');
  if (!sh || sh.getLastRow() < 2) return none;
  var vals = sh.getDataRange().getValues();
  var head = vals[0].map(String);
  var gi = head.indexOf('GW'), ki = head.indexOf('Kickoff (UTC)'), hi = head.indexOf('Home'), ai = head.indexOf('Away');
  if (ki < 0) return none;
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
        return { why: fx[j].label + ' ' + new Date(fx[j].ko).toISOString().slice(11, 16) + 'Z' + (fx[j].ko === lastKo ? ' (last of day)' : ''), since: fx[j].ko - LIVE_PRE_MS };
      }
    }
  }
  return none;
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

  if (action === 'clienterror') return emtClientError(req);   // v3.18: a phone reports a script error (no login: nothing personal in it)

  if (action === 'showfacts') {          // v3.12: the facts the Gameweek Show is written from (signed-in managers only)
    if (!emtVerify(team, req.token)) return { ok: false, error: 'auth' };
    return emtShowFacts(team, req);
  }

  /* v3.13: the articles (bottom of this file) */
  if (action === 'artfacts' || action === 'articles' || action === 'articlemod') {
    if (!emtVerify(team, req.token)) return { ok: false, error: 'auth' };
    if (action === 'artfacts') return emtArtFacts(team, req);
    if (action === 'articles') return emtArtDrafts(team);
    return emtArtMod(team, req);
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
    emtRepoReset();                                                                 /* v3.15 */
    if (e && e.parameter && e.parameter.show) return emtOut(emtShowGet(e.parameter.show, e.parameter.meta));   // v3.11 the Gameweek Show; v3.12 &meta=1
    if (e && e.parameter && e.parameter.health) return emtOut(emtHealth());                 // v3.13 pipeline health, no secrets
    if (e && e.parameter && e.parameter.articles) return emtOut(emtArtList());              // v3.13 approved articles + what is waiting
    if (e && e.parameter && e.parameter.article) return emtOut(emtArtGet(e.parameter.article));   // v3.13 one approved article
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
 *   Optional Script Properties: EMT_AI_MODEL (tried first; v3.13: then claude-haiku-5-5, then claude-haiku-4-5),
 *   EMT_AI_PAUSED = yes to pause.
 *   v3.13: the voices keep their mannerisms but aim the jokes at the league (EMT_TONE_LINES, THE READERS, below).
 * ===================================================================================================== */
var EMT_AI_HEAD = ['When (UTC)', 'Id', 'Voice', 'Kind', 'Event', 'Teams', 'Players', 'Text', 'Facts', 'Media'];
var EMT_AI_MODEL_DEFAULT = 'claude-haiku-5-5';
var EMT_AI_MODELS = [EMT_AI_MODEL_DEFAULT, 'claude-haiku-4-5'];   // v3.13: the chain after EMT_AI_MODEL (emtModelChain)
var EMT_AI_PER_RUN = 2, EMT_AI_PER_DAY = 6;   // v3.10: quality over quantity
var EMT_AI_VOICES = ['archizio', 'clark', 'malcolm'];
/* v3.13 · the house tone (Parker, 8 Oct 2026; it replaces "jokes minimal and dry" and "no swearing"). One block, THE
 * READERS, joined into every writer's system prompt: the AI writer, the show writer, the article writer and both
 * punch-up prompts (EMT_PUNCH_*). Funny means clever: each joke is built on a real fact of the week. The hard limits
 * (nothing about anyone's real life, no slurs, no identity insults, nothing sexual) hold whatever else a prompt says. */
var EMT_TONE_LINES = [
  'THE READERS. Eight lads in their early twenties who live on football Twitter and in the group chat. Write for them, not for a Sunday paper.',
  '- Funny means clever, not rude. Every joke is built on something true this week:',
  '  - the irony between two real facts (five defeats, zero points, and still leading the derby);',
  '  - a team name or a cliché turned back on itself ("Bad week to have named your club after one of them"; "Form is temporary. Owning Parker is permanent");',
  '  - a precise football-Twitter parallel ("CJ has basically become Arsenal"; "Baha has gone full Man City");',
  '  - a structure that undercuts itself ("Ethan\'s plan is Haaland. Ethan\'s backup plan is also Haaland");',
  '  - or a deadpan undercut in the last few words ("Fully fit. Just shite."; "Correctly, but still.").',
  '',
  '  These examples show the style only. Their facts are not this week\'s, so never reuse them.',
  '- An insult with no observation in it is dead. Never write lines like "dogshit", "cowards", "thoughts and prayers" or "absolute clown" on their own. A swear (shit, shite, fuck, bollocks, bottled it) is seasoning on a real joke, never the joke, and there are at most two in a whole piece.',
  '- Football Twitter is welcome when it is precise and earned: Man City\'s charges, Arsenal and set pieces, Spurs, fraud watch, "it\'s only a rivalry if you win some". Use one reference at a time. Never:',
  '  - explain a joke or stack memes;',
  '  - write "banter", "lads lads lads", "no cap", "it\'s giving" or "as the kids say";',
  '  - use emoji or hashtags, or end on an exclamation mark.',
  '- Hard limits, whatever else this prompt says:',
  '  - nothing about anyone\'s real life: looks, family, partners, jobs, money, health;',
  '  - no slurs of any kind, ableist ones included;',
  '  - nothing about race, religion, sexuality, disability or nationality used as an insult;',
  '  - nothing sexual.',
  '',
  '  Everything about football and this fantasy league is fair game.'
];
var EMT_AI_SYSTEM = [
  'You write short posts for the Feed of Matchweek, the app of El Matador Tire: a private FPL Draft (fantasy Premier League) league of eight friends. Head to head each gameweek: 3 points a win, 1 a draw.',
  'Three fictional voices write the posts. They are not real people:',
  '- archizio: Archizio Poblano, the insider. Every post opens with a caps tag such as EXCLUSIVE. / UNDERSTAND. / HERE WE GO. / DEAL DONE. Clipped transfer-insider style. His comedy is world-exclusive gravity for trivial fantasy news, told in insider jargon. Breaks news and frames beefs between managers.',
  '- clark: Clark Moldridge of The Terrace, a fan channel. The meltdown: furious, theatrical, calls for sackings, keeps receipts. The comedy is an overreaction to one real, specific decision. His posts are video thumbnails, so also give "thumb": {"t1": big caps line, max 18 characters, "t2": second caps line, max 22, "lo": caps strap, max 22}.',
  '- malcolm: Malcolm Tyre in the booth, a broadcaster. Commentary-box calm with a knife in it: grave delivery and a deadpan undercut at the end.',
  'Rules:',
  '1. Every number you write must appear in FACTS or MEMORY. Never invent a stat, score, odds, record or date.',
  '2. Only quote managers, word for word, from FACTS or MEMORY. Never invent quotes. Never quote or name real journalists, pundits or YouTubers. Real footballers only as players in someone\'s team.',
  '3. Banter is about this fantasy league only: picks, benchings, results, quotes, form, the table. THE READERS below sets what is funny and the hard limits.',
  '4. At most 240 characters per post. British spelling. No emoji, no hashtags, no em dashes.',
  '5. Call managers by the first name or team name given in FACTS. Describe a club\'s place in the table only as FACTS shows it (pos 1 is top); never guess who leads.',
  '6. If MEMORY has a related earlier post, quote or note, call back to it (a receipt, a running joke) without repeating it. Never repeat an angle MEMORY already used.',
  '7. Each post takes a different angle. Answer with JSON only: {"posts":[{"voice":"...","text":"...","teams":["exact team names"],"thumb":{...}}]}',
  '8. Fewer, better posts. The app already posts the plain facts (results, the table, deals), so only write what a sharp friend in the group chat would: a storyline, a receipt, a callback, a joke that lands. If nothing is worth it, return {"posts":[]}. Never pad.',
  '9. Rumours come from the rumour mill: managers make them up or pass them on. Always present one as a rumour (hearing, apparently, word is), never as fact, and never say who started or passed it unless FACTS names them.',
  ''
].concat(EMT_TONE_LINES).join('\n');

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

/* ---------- v3.20: what each model needs so a reply is never cut off ----------
 * The Claude 5.5 models think before answering unless told otherwise, and the thinking counts against max_tokens.
 * mode 'quick': a synchronous call that must answer inside UrlFetchApp's minute (the feed writer, the show writer and
 * its punch-up): thinking off, the way each model allows. mode 'batch': the articles through the Batches API, where
 * time does not matter: the model keeps its thinking and max_tokens leaves room for it. Older models get nothing. */
var EMT_AI_MAX_TOKENS = 2000, EMT_SHOW_MAX_TOKENS = 4000, EMT_ART_RESEARCH_MAX_TOKENS = 32000, EMT_ART_WRITE_MAX_TOKENS = 32000, EMT_ART_PUNCH_MAX_TOKENS = 32000;   /* v3.23: the batch budgets (8,000 and 16,000 in v3.20 ran out before the notes or the JSON, BUGS #28) */
function emtModelParams(model, mode) {
  var m = String(model || '');
  if (mode !== 'quick' || !/^claude-(sonnet|haiku|opus|fable)-5/.test(m)) return {};
  if (/^claude-sonnet-5/.test(m)) return { thinking: { type: 'between_tools' } };
  if (/^claude-haiku-5/.test(m)) return { thinking: { type: 'disabled' } };
  return { output_config: { effort: 'low' } };
}
/* a 400 that names a thinking or effort parameter: the model does not take it; the call is made once more without */
function emtParamRefused(code, msg) { return code === 400 && /thinking|output_config|effort/i.test(String(msg || '')); }

/* ---------- one call to Claude, checked before anything is kept ---------- */
function aiWrite(ev) {
  var mem = aiMemory(ev), facts = JSON.stringify(ev.facts);
  var user = 'EVENT: ' + ev.desc + '\nWRITE: ' + ev.ask + '\n\nFACTS (the only numbers you may use):\n' + facts + '\n\nMEMORY (earlier posts, quotes and notes):\n' + (mem || '(nothing yet)');
  /* v3.13: the model chain; a retired model (404, or a 400 about the model) passes to the next one */
  var models = emtModelsLive(emtModelChain('EMT_AI_MODEL', EMT_AI_MODELS)), code = 0, body = '';
  for (var mi = 0; mi < models.length; mi++) {
    var extra = emtModelParams(models[mi], 'quick');                            /* v3.20 */
    for (var again = 0; again < 2; again++) {
      var res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
        method: 'post', contentType: 'application/json', muteHttpExceptions: true,
        headers: { 'x-api-key': emtAiKey(), 'anthropic-version': '2023-06-01' },
        payload: JSON.stringify(Object.assign({ model: models[mi], max_tokens: EMT_AI_MAX_TOKENS, system: EMT_AI_SYSTEM, messages: [{ role: 'user', content: user }] }, extra))
      });
      code = res.getResponseCode(); body = res.getContentText();
      if (code === 200 || again || !Object.keys(extra).length || !emtParamRefused(code, emtApiErr(body).msg)) break;
      Logger.log('AI writer: ' + models[mi] + ' refused a parameter (' + emtApiErr(body).msg.slice(0, 100) + '); asking again without it.');
      extra = {};
    }
    if (code === 200) break;
    var er = emtApiErr(body);
    if (mi === models.length - 1 || !emtModelMissing(code, er.type, er.msg)) break;
    emtModelNoteGone(models[mi], er.msg);
  }
  if (code !== 200) throw new Error('Claude API ' + code + ': ' + String(body).slice(0, 200));
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
 * the show (voices it), the self-update (at most hourly). Only an AI writer error is thrown, after all four ran.
 * v3.13: five parts: the articles (articleTick) run after the show and before the self-update, in their own try/catch. */
function aiTick() {
  var t0 = Date.now(), err = null;
  emtRepoReset();                                                                   /* v3.15: this run's facts memo */
  try { aiWriterTick(); } catch (e) { err = e; Logger.log('AI writer failed: ' + ((e && e.message) || e)); }
  try { showWriterTick(t0); } catch (e) { Logger.log('Show writer failed: ' + ((e && e.message) || e)); }
  try { showTick(t0); } catch (e) { Logger.log('Gameweek Show failed: ' + ((e && e.message) || e)); }
  try { articleTick(t0); } catch (e) { Logger.log('Articles failed: ' + ((e && e.message) || e)); }
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
    var evs = aiEvents(S).sort(function (a, b) { return a.at - b.at; }), made = 0, sh = emtPostsSheet(), err = '';
    for (var i = 0; i < evs.length; i++) {
      var ev = evs[i];
      if (made + ev.n > EMT_AI_PER_RUN || S.count + ev.n > EMT_AI_PER_DAY) break;   /* the rest waits for the next run */
      var posts = [];
      try { posts = aiWrite(ev); } catch (e) { err = String((e && e.message) || e).slice(0, 200); Logger.log('AI writer: ' + e); break; }   /* try again next run */
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
    /* v3.25: the last run, for ?health=1 ai.last: a quiet day (no event due) and a broken writer read differently */
    S.last = { at: new Date().toISOString(), events: evs.length, kinds: evs.map(function (e) { return e.type; }).join(','), made: made, error: err };
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
 *   Serving: GET <web app>?show=<gw> → { ok, gw, clips: { key: { secs, hash, b64, w? } }, complete, stale, missing, script }.
 *   v3.25: the credit guard: the balance is read before a render voices anything, a gameweek has a character cap, and
 *   after a refusal no render runs until the reset (EMT_SHOW_HOLD). See the block above emtShowCreditsRead.
 *   v3.24: only takes whose hash matches the current script are served (stale lists the rest); w = word start times
 *   from ElevenLabs' with-timestamps endpoint, kept in the Words column; EMT_SHOW_LAST holds the last render's outcome.
 *   v3.12: when the repo has no show/gw<N>.json (404), the script the show writer kept in ShowScripts is voiced
 *   instead (the repo always wins). "script" is that json (repo, else ShowScripts, else null); &meta=1 drops b64.
 *   Runs: showTick() from aiTick (every 15 minutes) for the next unfinished gameweek; renderShowNow() from the menu;
 *   renderShow(gw) and showStatus(gw) from the editor.
 *   QUOTA: an idle run is one GitHub fetch plus a read of six narrow columns, about 1 s (96 a day ≈ 2 min of the
 *   90 min trigger allowance). A whole show (~22 clips) is ~22 ElevenLabs calls, a minute or two, once per gameweek;
 *   a run stops starting new clips after 4.5 minutes and the next run picks up the rest.
 * ===================================================================================================== */
var EMT_SHOW_HEAD = ['GW', 'Clip', 'Hash', 'Part', 'Parts', 'Secs', 'Data', 'Rendered (UTC)', 'Words'];   /* v3.24: + Words */
var EMT_SHOW_URL = 'https://parkerno2.github.io/el-matador-tire/show/gw';
var EMT_SHOW_TTS = 'https://api.elevenlabs.io/v1/text-to-speech/';
var EMT_SHOW_TTS_TIMED = '/with-timestamps';   /* v3.24: the same call answered as JSON, the audio plus a character alignment */
var EMT_SHOW_VOICE_DEFAULT = 'e2v8SRwGUU8TdMFPuDlV';
var EMT_SHOW_MODEL_DEFAULT = 'eleven_v4_turbo';         /* v3.26: v4 Turbo (EMT_TTS_MODEL wins; the script json's "model" is a label) */
var EMT_SHOW_MODEL_PREV = 'eleven_multilingual_v2';     /* v3.26: the fallback when ElevenLabs refuses the default (EMT_SHOW_MODEL_GW_<gw>) */
var EMT_SHOW_V4_STABILITY = 0;                           /* v3.26: v4 settings: 0 is ElevenLabs' "Creative", the expressive end (EMT_SHOW_STABILITY overrides) */
var EMT_SHOW_V4_SIMILARITY = 0.75;
var EMT_SHOW_TAG_RE = /\[[^\[\]]*\]/g;                   /* v3.26: an audio tag, [laughing]: voiced, never captioned */
var EMT_SHOW_TAGS_PER_LINE = 2;                          /* v3.26: emtShowCheck refuses more tags on one line */
var EMT_SHOW_CHUNK = 45000;            // characters per Data cell (cells cap at 50,000)
var EMT_SHOW_BUDGET_MS = 270 * 1000;   // no new clip after 4.5 min; Apps Script stops every run at 6
var EMT_SHOW_BUSY_MS = 390 * 1000;     // a render flag older than 6.5 min belongs to a run that is already dead
var EMT_SHOW_MARK = 'b64:';
var EMT_SHOW_WORDS_COL = 9;            // v3.24: the Words column (word start times, on a clip's first row)
var EMT_SHOW_SUB_URL = 'https://api.elevenlabs.io/v1/user/subscription';   // v3.25: the account's balance (needs user_read on the key)
var EMT_SHOW_MONTHLY_DEFAULT = 10000;  // v3.25: the monthly limit assumed when the key cannot read the balance (EMT_SHOW_MONTHLY_LIMIT overrides)
var EMT_SHOW_GW_CAP_RATIO = 1.25;      // v3.25: a gameweek may voice its script's length times this (EMT_SHOW_GW_CAP_<gw> overrides)
var EMT_SHOW_GW_VERSIONS = 3;          // v3.27: script versions a gameweek may voice with an allowance of their own; later ones share the last
var EMT_SHOW_HOLD_MS = 24 * 3600e3;    // v3.25: after a refusal with no reset time known, no render for this long
var EMT_SHOW_HOLD_CHECK_MS = 3600e3;   // v3.25: while holding, the balance is read again this often
var EMT_SHOW_CREDITS_FRESH_MS = 6 * 3600e3;   // v3.25: showTick refreshes the balance for ?health=1 when the last read is older

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

/* the ShowAudio tab; v3.24: a tab made before the Words column gets its header cell */
function emtShowSheet() {
  var ss = SpreadsheetApp.getActive(), sh = ss.getSheetByName('ShowAudio');
  if (!sh) {
    sh = ss.insertSheet('ShowAudio');
    sh.getRange(1, 1, 1, EMT_SHOW_HEAD.length).setValues([EMT_SHOW_HEAD]);
    sh.setFrozenRows(1);
    try { sh.hideSheet(); } catch (e) { }
  } else if (String(sh.getRange(1, EMT_SHOW_WORDS_COL, 1, 1).getValues()[0][0]) !== EMT_SHOW_HEAD[EMT_SHOW_WORDS_COL - 1]) {
    sh.getRange(1, EMT_SHOW_WORDS_COL, 1, 1).setValues([[EMT_SHOW_HEAD[EMT_SHOW_WORDS_COL - 1]]]);
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

/* v3.24: the voice a script is rendered with (the Script Properties win over the json), and the clips with the hash
 * each take must carry, md5(text|voice|model|speed). renderShow, ?show and ?health=1 all judge a stored take by it. */
function emtShowVoice(j, gw) {
  var p = emtProps(), M = emtShowModel(gw === undefined ? Number(j && j.gw) : gw);
  return { voice: p.getProperty('EMT_VOICE_ID') || EMT_SHOW_VOICE_DEFAULT, model: M.model, from: M.from, speed: Number(j && j.speed) || 1 };
}
function emtShowLines(j, gw) {
  var v = emtShowVoice(j, gw);
  return emtShowClips(j || {}).map(function (c) { c.hash = emtMd5hex(c.text + '|' + v.voice + '|' + v.model + '|' + v.speed); return c; });
}
/* v3.26: the model a gameweek is voiced with: EMT_TTS_MODEL when set, else the gameweek's fallback pin
 * (EMT_SHOW_MODEL_GW_<gw>, set once by a refusal; delete it to try the default again), else the default.
 * { model, from: 'property' | 'fallback' | 'default', fallback: { model, from, at, code, why } | null } */
function emtShowModel(gw) {
  var p = emtProps(), set = String(p.getProperty('EMT_TTS_MODEL') || '').trim(), pin = emtShowPin(gw);
  if (set) return { model: set, from: 'property', fallback: pin };
  if (pin && pin.model) return { model: pin.model, from: 'fallback', fallback: pin };
  return { model: EMT_SHOW_MODEL_DEFAULT, from: 'default', fallback: null };
}
function emtShowPin(gw) {
  if (!(Number(gw) > 0)) return null;
  try { var j = JSON.parse(emtProps().getProperty('EMT_SHOW_MODEL_GW_' + Number(gw)) || 'null'); return j && typeof j === 'object' && j.model ? j : null; } catch (e) { return null; }
}
/* v3.26: a model of the v4 family takes stability and similarity only; everything else keeps the v3.24 body */
function emtShowIsV4(model) { return /^eleven_v4/.test(String(model || '')); }
function emtShowSettings(model, speed) {
  if (emtShowIsV4(model)) {
    var st = Number(emtProps().getProperty('EMT_SHOW_STABILITY'));
    return { stability: isFinite(st) && st >= 0 && st <= 1 && String(emtProps().getProperty('EMT_SHOW_STABILITY') || '').trim() !== '' ? st : EMT_SHOW_V4_STABILITY, similarity_boost: EMT_SHOW_V4_SIMILARITY };
  }
  return { stability: 0.5, similarity_boost: 0.75, style: 0, use_speaker_boost: true, speed: speed };
}
/* v3.26: a line as the caption shows it: the audio tags out, the spaces tidied */
function emtShowCaption(text) { return String(text == null ? '' : text).replace(EMT_SHOW_TAG_RE, ' ').replace(/\s+/g, ' ').trim(); }
function emtShowTags(text) { return String(text == null ? '' : text).match(EMT_SHOW_TAG_RE) || []; }

/* v3.24: a Words cell ("[0,0.42,0.81]") → the array, or null */
function emtShowWordsParse(cell) {
  var s = String(cell == null ? '' : cell).replace(/^'/, '').trim();
  if (s.charAt(0) !== '[') return null;
  try {
    var a = JSON.parse(s);
    return Array.isArray(a) && a.length && a.every(function (x) { return typeof x === 'number' && isFinite(x) && x >= 0; }) ? a : null;
  } catch (e) { return null; }
}

/* what ShowAudio holds for one gameweek, from the narrow columns (no Data read):
 * { key: { rows: [sheet rows], part: { n: row }, hash, parts, secs, words, ok } }; ok = every part there exactly once,
 * one hash. v3.24: words = the clip's word start times when its first row has them. */
function emtShowIndex(sh, gw) {
  var idx = {}, last = sh.getLastRow();
  if (last < 2) return idx;
  var v = sh.getRange(2, 1, last - 1, 6).getValues();
  var w = sh.getLastColumn() >= EMT_SHOW_WORDS_COL ? sh.getRange(2, EMT_SHOW_WORDS_COL, last - 1, 1).getValues() : null;
  for (var i = 0; i < v.length; i++) {
    if (Number(v[i][0]) !== gw) continue;
    var k = String(v[i][1]), h = String(v[i][2]).replace(/^'/, '');
    var c = idx[k] || (idx[k] = { rows: [], part: {}, hashes: {}, hash: '', parts: 0, secs: 0, words: null, ok: false });
    c.rows.push(i + 2); c.part[Number(v[i][3])] = i + 2; c.hashes[h] = 1;
    c.hash = h; c.parts = Number(v[i][4]) || 0; c.secs = Number(v[i][5]) || 0;
    if (w && Number(v[i][3]) === 1) c.words = emtShowWordsParse(w[i][0]);
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

/* v3.24: how many bytes a base64 string decodes to */
function emtB64Bytes(b64) {
  var s = String(b64 || ''), pad = /==$/.test(s) ? 2 : /=$/.test(s) ? 1 : 0;
  return Math.max(0, Math.floor(s.length * 3 / 4) - pad);
}

/* v3.24: word start times from ElevenLabs' character alignment ({ characters, character_start_times_seconds }): one
 * number per word of the text as the app splits it (on whitespace), seconds to 2 decimals. null when the alignment
 * does not line up with the text, and the app then keeps its estimate. */
function emtShowWordTimes(text, al) {
  var ch = al && al.characters, st = al && al.character_start_times_seconds;
  if (!ch || !st || !ch.length || ch.length !== st.length) return null;
  var out = [], inWord = false, inTag = false, i;
  for (i = 0; i < ch.length; i++) {
    var c = String(ch[i] == null ? '' : ch[i]);
    if (inTag) { if (c === ']') { inTag = false; inWord = false; } continue; }   /* v3.26: an audio tag's characters are not a word */
    if (c === '[') { inTag = true; inWord = false; continue; }
    if (!c || /^\s+$/.test(c)) { inWord = false; continue; }
    if (!inWord) { var t = Number(st[i]); if (!isFinite(t)) return null; out.push(Math.round(Math.max(0, t) * 100) / 100); inWord = true; }
  }
  var n = emtShowCaption(text).split(/\s+/).filter(function (w) { return w; }).length;   /* v3.26: the caption's words */
  return n > 0 && out.length === n ? out : null;
}

/* one ElevenLabs call; prev/next are the neighbouring clips' text, for a natural join.
 * v3.24: through the with-timestamps endpoint, which answers JSON: audio_base64 and alignment (characters,
 * character_start_times_seconds, character_end_times_seconds). The word start times come from the alignment and the
 * clip's length from its last end time. An endpoint that is not there (404, 405) falls back to the plain call once,
 * without word times. { code, b64, bytes, secs, words, timed, body (the first 300 characters of a refusal) } */
function emtShowTts(key, voice, model, speed, text, prev, next) {
  var body = { text: text, model_id: model, voice_settings: emtShowSettings(model, speed) };   /* v3.26: the fields the model takes */
  if (prev) body.previous_text = prev;
  if (next) body.next_text = next;
  var base = EMT_SHOW_TTS + encodeURIComponent(voice), q = '?output_format=mp3_44100_64';
  var opt = function (accept) { return { method: 'post', contentType: 'application/json', muteHttpExceptions: true, headers: { 'xi-api-key': key, 'Accept': accept }, payload: JSON.stringify(body) }; };
  var out = { code: 0, b64: '', bytes: 0, secs: 0, words: null, timed: true, body: '' };
  var res = UrlFetchApp.fetch(base + EMT_SHOW_TTS_TIMED + q, opt('application/json'));
  out.code = res.getResponseCode();
  if (out.code === 200) {
    var j = null;
    try { j = JSON.parse(res.getContentText()); } catch (e) { j = null; }
    if (j && typeof j.audio_base64 === 'string' && j.audio_base64) {
      out.b64 = j.audio_base64.replace(/\s+/g, '');
      out.bytes = emtB64Bytes(out.b64);
      var al = j.alignment && j.alignment.characters ? j.alignment : null, ends = al && al.character_end_times_seconds;
      out.words = al ? emtShowWordTimes(text, al) : null;
      var end = ends && ends.length ? Number(ends[ends.length - 1]) : 0;
      out.secs = isFinite(end) && end > 0 ? Math.round(end * 100) / 100 : Math.round(out.bytes / 80) / 100;
      return out;
    }
    out.body = String(res.getContentText() || '').slice(0, 300);   /* 200 without audio: treated as a refusal */
    return out;
  }
  if (out.code === 404 || out.code === 405) {
    res = UrlFetchApp.fetch(base + q, opt('audio/mpeg'));
    out.code = res.getResponseCode(); out.timed = false;
    var bytes = out.code === 200 ? res.getContent() : null;
    if (out.code === 200 && bytes && bytes.length) { out.b64 = Utilities.base64Encode(bytes); out.bytes = bytes.length; out.secs = Math.round(bytes.length / 80) / 100; return out; }
  }
  out.body = String(res.getContentText() || '').slice(0, 300);
  return out;
}

/* ---------- v3.25: the credit guard ----------
 * Every render that has lines to voice first reads the account's balance (GET /v1/user/subscription with the same
 * key) and skips the render when the lines would not fit; a key without the user_read permission (or a read that
 * fails) falls back to the count kept here: EMT_SHOW_CHARS_<yyyy-mm>, the characters sent this calendar month, against
 * EMT_SHOW_MONTHLY_LIMIT (default 10,000). A script version may voice at most its own length plus a quarter
 * (v3.27: EMT_SHOW_GW_VER_<gw> counts per version, at most EMT_SHOW_GW_VERSIONS versions with an allowance of their own;
 * EMT_SHOW_GW_CHARS_<gw> keeps the gameweek's total, which EMT_SHOW_GW_CAP_<gw> in characters caps when set). After a credit refusal or a
 * balance that does not fit, showTick makes no render until the reported reset (24 hours when unknown): EMT_SHOW_HOLD,
 * { until, why, since, checked }; meanwhile the balance is read once an hour so a top-up is noticed within the hour,
 * and the menu's Render now lifts the hold. The last balance read is kept in EMT_SHOW_CREDITS for ?health=1. */
function emtShowMonthKey(d) { d = d || new Date(); return 'EMT_SHOW_CHARS_' + d.toISOString().slice(0, 7); }
function emtShowMonthEnd(d) { d = d || new Date(); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)).toISOString(); }
function emtShowMonthlyLimit() { var n = Number(emtProps().getProperty('EMT_SHOW_MONTHLY_LIMIT')); return n > 0 ? Math.floor(n) : EMT_SHOW_MONTHLY_DEFAULT; }
/* the balance: ElevenLabs' own when the key may read it, else the count kept here. Never throws; the result is kept in
 * EMT_SHOW_CREDITS. { left, limit, resets (ISO or null), at, from: 'elevenlabs' | 'count', note (why the fallback) } */
function emtShowCreditsRead(key) {
  var p = emtProps(), now = new Date(), out = null, note = '';
  try {
    var res = UrlFetchApp.fetch(EMT_SHOW_SUB_URL, { method: 'get', muteHttpExceptions: true, headers: { 'xi-api-key': key } });
    var code = res.getResponseCode(), j = null;
    try { j = JSON.parse(res.getContentText()); } catch (e) { j = null; }
    if (code === 200 && j && typeof j === 'object' && isFinite(Number(j.character_limit)) && isFinite(Number(j.character_count))) {
      var limit = Math.max(0, Math.floor(Number(j.character_limit))), used = Math.max(0, Math.floor(Number(j.character_count))), rs = Number(j.next_character_count_reset_unix);
      out = { left: Math.max(0, limit - used), limit: limit, resets: rs > 0 ? new Date(rs * 1000).toISOString() : null, at: now.toISOString(), from: 'elevenlabs' };
    } else note = code === 200 ? 'the answer had no character_limit' : 'HTTP ' + code + (j && j.detail && j.detail.status ? ' ' + j.detail.status : '');
  } catch (e) { note = String((e && e.message) || e).slice(0, 120); }
  if (!out) {
    var lim2 = emtShowMonthlyLimit(), used2 = Number(p.getProperty(emtShowMonthKey(now))) || 0;
    out = { left: Math.max(0, lim2 - used2), limit: lim2, resets: emtShowMonthEnd(now), at: now.toISOString(), from: 'count', note: note };
  }
  try { p.setProperty('EMT_SHOW_CREDITS', JSON.stringify(out)); } catch (e) { }
  return out;
}
function emtShowCreditsLast() { try { var j = JSON.parse(emtProps().getProperty('EMT_SHOW_CREDITS') || 'null'); return j && typeof j === 'object' ? j : null; } catch (e) { return null; } }
/* for ?health=1: a read older than 6 hours is refreshed (a free call, at most 4 a day) */
function emtShowCreditsFresh(key) {
  var c = emtShowCreditsLast();
  if (!c || !(Date.now() - (Date.parse(c.at) || 0) < EMT_SHOW_CREDITS_FRESH_MS)) emtShowCreditsRead(key);
}
/* characters sent to ElevenLabs, counted per gameweek, per script version (v3.27: ver, the version id the render
 * registered) and per calendar month */
function emtShowCount(gw, n, ver) {
  var p = emtProps(), mk = emtShowMonthKey();
  p.setProperty('EMT_SHOW_GW_CHARS_' + gw, String((Number(p.getProperty('EMT_SHOW_GW_CHARS_' + gw)) || 0) + n));
  p.setProperty(mk, String((Number(p.getProperty(mk)) || 0) + n));
  if (ver) { var V = emtShowVersions(gw); if (V.list.indexOf(ver) > -1) { V.used[ver] = (Number(V.used[ver]) || 0) + n; p.setProperty('EMT_SHOW_GW_VER_' + gw, JSON.stringify(V)); } }
}
/* ---------- v3.27: the cap per script version ----------
 * A script version is the md5 of its lines' texts: the voice, model and speed are not part of it, so a model change
 * (v3.26) re-voices the same version within its allowance. EMT_SHOW_GW_VER_<gw> = { list: [id, ...], len: { id: chars },
 * used: { id: n } } holds the versions a render has voiced, in order, each one's length and the characters each has had.
 * A gameweek that spent characters before v3.27 (EMT_SHOW_GW_CHARS_<gw>) carries them as its first version, 'before'
 * (its length taken as that spend), so the old script's spend never counts against a new one and still takes one of
 * the three places. */
function emtShowVersionId(lines) { return emtMd5hex((lines || []).map(function (c) { return String(c.text); }).join('\n')).slice(0, 12); }
function emtShowVersions(gw) {
  var p = emtProps(), V = null;
  try { V = JSON.parse(p.getProperty('EMT_SHOW_GW_VER_' + gw) || 'null'); } catch (e) { V = null; }
  if (!V || !Array.isArray(V.list) || !V.used || typeof V.used !== 'object') {
    V = { list: [], len: {}, used: {} };
    var before = Number(p.getProperty('EMT_SHOW_GW_CHARS_' + gw)) || 0;
    if (before > 0) { V.list.push('before'); V.len.before = before; V.used.before = before; }
  }
  if (!V.len || typeof V.len !== 'object') V.len = {};
  return V;
}
/* the version a script's lines count against: its own id when it is registered already or the gameweek has a place left
 * (at most EMT_SHOW_GW_VERSIONS), else the last registered version's (a fourth rewrite shares the third's allowance and
 * the third's length, so the bound holds whatever the rewrite's length). register (the render, never health) writes a
 * new version in. { id, own, len (the characters the allowance is built from), used, versions } */
function emtShowVersion(gw, lines, register) {
  var V = emtShowVersions(gw), id = emtShowVersionId(lines), known = V.list.indexOf(id) > -1, chars = 0;
  (lines || []).forEach(function (c) { chars += String(c.text).length; });
  if (!known && V.list.length < EMT_SHOW_GW_VERSIONS) {
    if (register) { V.list.push(id); V.len[id] = chars; V.used[id] = 0; emtProps().setProperty('EMT_SHOW_GW_VER_' + gw, JSON.stringify(V)); }
    return { id: id, own: true, len: chars, used: 0, versions: V.list.length + (register ? 0 : 1) };
  }
  var at = known ? id : V.list[V.list.length - 1];
  return { id: at, own: known, len: Number(V.len[at]) > 0 ? Number(V.len[at]) : chars, used: Number(V.used[at]) || 0, versions: V.list.length };
}
/* the cap the lines are voiced against: EMT_SHOW_GW_CAP_<gw> when set (the gameweek as a whole, against its total), else
 * the script version's length plus a quarter against what that version has voiced (v3.27; a rewrite beyond the three
 * versions is measured against the last version's length and count). { used, cap, chars, set, pinned, version,
 * versions, own }
 * v3.26: a gameweek pinned to the fallback model (EMT_SHOW_MODEL_GW_<gw>, set once by a refusal) gets exactly one more
 * script's worth, the re-voice the fallback needs; the pin can only be set once, so this is bounded. */
function emtShowCap(gw, lines) {
  var p = emtProps(), chars = 0;
  (lines || []).forEach(function (c) { chars += String(c.text).length; });
  var set = Number(p.getProperty('EMT_SHOW_GW_CAP_' + gw)), pinned = !!emtShowPin(gw), V = emtShowVersion(gw, lines, false);
  return { used: set > 0 ? Number(p.getProperty('EMT_SHOW_GW_CHARS_' + gw)) || 0 : V.used, cap: set > 0 ? Math.floor(set) : Math.ceil(V.len * EMT_SHOW_GW_CAP_RATIO) + (pinned ? V.len : 0),
    chars: chars, set: set > 0, pinned: pinned, version: V.id, versions: V.versions, own: V.own };
}
/* the characters of the lines still to voice (missing or stale), from emtShowJudge's answer */
function emtShowNeed(J) {
  var fresh = {}, n = 0;
  ((J && J.fresh) || []).forEach(function (k) { fresh[k] = 1; });
  ((J && J.lines) || []).forEach(function (c) { if (!fresh[c.key]) n += String(c.text).length; });
  return n;
}
function emtShowHold() { try { var j = JSON.parse(emtProps().getProperty('EMT_SHOW_HOLD') || 'null'); return j && j.until ? j : null; } catch (e) { return null; } }
function emtShowHoldSet(why, resets) {
  var until = resets && Date.parse(resets) > Date.now() ? new Date(Date.parse(resets)).toISOString() : new Date(Date.now() + EMT_SHOW_HOLD_MS).toISOString();
  var h = { until: until, why: why, since: new Date().toISOString(), checked: new Date().toISOString() };
  emtProps().setProperty('EMT_SHOW_HOLD', JSON.stringify(h));
  return h;
}
function emtShowHoldClear() { emtProps().deleteProperty('EMT_SHOW_HOLD'); }
/* showTick while holding: once an hour the balance is read again and the hold lifted when it covers the lines still
 * to voice; otherwise nothing is called. Returns the tick's outcome, or null when the hold was lifted. */
function emtShowHoldTick(gw, H) {
  var out = { ok: true, stopped: 'hold', gw: gw, until: H.until, why: H.why || 'credits' };
  if (!(Date.now() - (Date.parse(H.checked) || 0) < EMT_SHOW_HOLD_CHECK_MS)) {
    var cr = emtShowCreditsRead(emtShowKey()), need = emtShowNeed(emtShowJudge(gw));
    H.checked = new Date().toISOString();
    emtProps().setProperty('EMT_SHOW_HOLD', JSON.stringify(H));
    out.credits = cr.left; out.need = need;
    if (need > 0 && cr.left >= need) {
      emtShowHoldClear();
      Logger.log('Gameweek Show GW' + gw + ': ElevenLabs has ' + cr.left + ' characters again, enough for the ' + need + ' still to voice; the hold is lifted.');
      return null;
    }
  }
  Logger.log(emtShowSummary(out));
  return out;
}

/* v3.24: the last render's outcome, kept in EMT_SHOW_LAST for ?health=1 (a run that found another render busy is
 * not recorded, so the useful record stays) */
function emtShowNote(S) {
  if (!S || S.stopped === 'busy') return;
  try {
    emtProps().setProperty('EMT_SHOW_LAST', JSON.stringify({ at: new Date().toISOString(), gw: S.gw || 0, ok: !!S.ok, stopped: S.stopped || '', error: String(S.error || '').slice(0, 200),
      rendered: (S.rendered || []).length, kept: S.kept || 0, left: S.left || 0, source: S.source || (S.clips ? 'repo' : ''), need: S.need || 0, hold: S.hold || null,
      model: S.model || '', fallback: S.fallback || null }));   /* v3.26 */
  } catch (e) { }
}
function emtShowLast() {
  try { var j = JSON.parse(emtProps().getProperty('EMT_SHOW_LAST') || 'null'); return j && typeof j === 'object' ? j : null; } catch (e) { return null; }
}

/* render every clip of a gameweek's show that is missing or changed. From the editor: renderShow(7); with no
 * gameweek it takes the next unfinished one. startedAt (ms) lets aiTick count the writer's time against the budget.
 * v3.24: the outcome is kept for ?health=1 (emtShowNote). */
function renderShow(gw, startedAt) {
  var S = emtShowRender(gw, startedAt);
  emtShowNote(S);
  return S;
}
function emtShowRender(gw, startedAt) {
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
    emtShowRepoCache(gw, f);                         /* v3.24: ?show judges the takes against the script just rendered */
    var j = f.json || {}, clips = emtShowLines(j, gw), V = emtShowVoice(j, gw), p = emtProps();
    S.clips = clips.length; S.model = V.model; S.modelFrom = V.from;   /* v3.26 */
    if (!clips.length) { S.stopped = 'empty'; Logger.log(emtShowSummary(S)); return S; }
    p.setProperty('EMT_SHOW_KEYS_' + gw, JSON.stringify(clips.map(function (c) { return c.key; })));
    var live = {};
    clips.forEach(function (c) { live[c.key] = 1; });
    var sh = emtShowSheet(), idx = emtShowIndex(sh, gw);
    /* lines cut from the script lose their rows */
    var gone = [];
    Object.keys(idx).forEach(function (k) { if (!live[k]) { S.removed.push(k); gone = gone.concat(idx[k].rows); } });
    if (gone.length) { emtShowDeleteRows(sh, gone); idx = emtShowIndex(sh, gw); }
    /* v3.25: the credit guard, before any ElevenLabs call: the gameweek's cap (local), then the account's balance */
    var need = 0, toVoice = 0, ver = null;
    clips.forEach(function (c) { var h = idx[c.key]; if (!(h && h.ok && h.hash === c.hash)) { need += c.text.length; toVoice++; } });
    S.need = need;
    if (need > 0) {
      var cap = emtShowCap(gw, clips);
      S.cap = { used: cap.used, cap: cap.cap, version: cap.version, versions: cap.versions, own: cap.own };   /* v3.27 */
      if (cap.used + need > cap.cap) {
        S.ok = false; S.stopped = 'capped'; S.kept = clips.length - toVoice; S.left = toVoice;
        S.error = 'GW' + gw + ' has voiced ' + cap.used + ' of its ' + cap.cap + '-character cap' + (cap.set ? '' : ' for this script version (' + (cap.own ? 'version ' + cap.versions + ' of ' + EMT_SHOW_GW_VERSIONS : 'a rewrite beyond the ' + EMT_SHOW_GW_VERSIONS + ' versions a gameweek may voice, counted against the last') + ')') +
          ' and the ' + toVoice + ' line' + (toVoice > 1 ? 's' : '') + ' still to voice need ' + need +
          ' more, so nothing was rendered. Set the Script Property EMT_SHOW_GW_CAP_' + gw + ' (characters) higher to voice them';
        Logger.log(emtShowSummary(S)); return S;
      }
      ver = emtShowVersion(gw, clips, true).id;        /* v3.27: the version these lines count against, registered */
      var cr = emtShowCreditsRead(key);
      S.credits = cr.left;
      if (cr.left < need) {
        S.ok = false; S.stopped = 'credits'; S.kept = clips.length - toVoice; S.left = toVoice;
        var hh = emtShowHoldSet('credits', cr.from === 'elevenlabs' ? cr.resets : null);
        S.hold = hh.until;
        S.error = 'ElevenLabs has ' + cr.left + ' of ' + cr.limit + ' characters left this month' + (cr.from === 'count' ? ' (counted here: the key cannot read the balance)' : '') +
          (cr.resets ? ', resets ' + cr.resets : '') + ', and the ' + toVoice + ' line' + (toVoice > 1 ? 's' : '') + ' still to voice need ' + need + ', so nothing was rendered';
        Logger.log(emtShowSummary(S)); return S;
      }
    }
    for (var i = 0; i < clips.length; i++) {
      var c = clips[i], have = idx[c.key];
      if (have && have.ok && have.hash === c.hash) { S.kept++; continue; }
      if (S.stopped) continue;                        /* halted: the rest are only counted */
      if (Date.now() - t0 > EMT_SHOW_BUDGET_MS) { S.stopped = 'time'; continue; }
      var r = emtShowTts(key, V.voice, V.model, V.speed, c.text, i > 0 ? clips[i - 1].text : '', i < clips.length - 1 ? clips[i + 1].text : '');
      var code = r.code;
      if (code !== 200 || !r.b64) {
        var body = r.body;
        S.ok = false; S.stopped = 'http ' + code;
        S.error = code === 402 || /quota|credits/i.test(body) ? 'out of credits: top up at elevenlabs.io or wait for the monthly reset'
          : code === 401 ? 'the API key is wrong or lacks Text to Speech permission (elevenlabs.io → Developers → API keys)'
          : code === 200 ? 'ElevenLabs sent no audio' : 'ElevenLabs refused the request';
        Logger.log('Gameweek Show: ElevenLabs HTTP ' + code + ' on ' + c.key + ', ' + S.error + '. Body: ' + body);
        if (/out of credits/.test(S.error)) { var cl = emtShowCreditsLast(); S.hold = emtShowHoldSet('credits', cl && cl.from === 'elevenlabs' ? cl.resets : null).until; }   /* v3.25 */
        else if ((code === 400 || code === 422) && V.from === 'default') {   /* v3.26: the model or a field refused: the fallback, once, for this gameweek */
          var pin = { model: EMT_SHOW_MODEL_PREV, from: V.model, at: new Date().toISOString(), code: code, why: String(body || '').replace(/\s+/g, ' ').slice(0, 160) };
          p.setProperty('EMT_SHOW_MODEL_GW_' + gw, JSON.stringify(pin));
          S.fallback = pin;
          S.error = 'ElevenLabs refused ' + V.model + ' (HTTP ' + code + (pin.why ? ': ' + pin.why : '') + '); GW' + gw + ' falls back to ' + EMT_SHOW_MODEL_PREV + ' from the next render on (delete the Script Property EMT_SHOW_MODEL_GW_' + gw + ' to try ' + V.model + ' again)';
          Logger.log('Gameweek Show: ' + S.error);
        }
        continue;                                     /* no more calls this run */
      }
      var b64 = r.b64, n = Math.ceil(b64.length / EMT_SHOW_CHUNK);
      var secs = r.secs, at = "'" + new Date().toISOString();
      if (have) emtShowDeleteRows(sh, have.rows);   /* the old take goes first */
      for (var q = 0; q < n; q++) {
        sh.appendRow([gw, c.key, "'" + c.hash, q + 1, n, secs, EMT_SHOW_MARK + b64.slice(q * EMT_SHOW_CHUNK, (q + 1) * EMT_SHOW_CHUNK), at, q === 0 && r.words ? JSON.stringify(r.words) : '']);
      }
      S.rendered.push(c.key);
      emtShowCount(gw, c.text.length, ver);            /* v3.25: the gameweek's and the month's count; v3.27: the version's */
      if (!r.words) S.untimed = (S.untimed || 0) + 1;
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
  if (S.stopped === 'hold') return 'Gameweek Show GW' + S.gw + ': no ElevenLabs render until ' + S.until + ' (' + (S.why || 'credits') + ')' +
    (S.credits !== undefined ? '; the balance read just now says ' + S.credits + ' characters left against ' + (S.need || 0) + ' still to voice' : '') + '. The balance is read again once an hour; Render now in the menu lifts the hold.';
  if (S.stopped === 'noscript') return 'Gameweek Show GW' + S.gw + ': no script yet (show/gw' + S.gw + '.json is not on the site and the show writer has not written one). Nothing to do.';
  if (S.stopped === 'empty') return 'Gameweek Show GW' + S.gw + ': the script has no lines.';
  if (S.stopped === 'error' && !S.clips) return 'Gameweek Show GW' + S.gw + ': stopped, ' + S.error;
  var s = 'Gameweek Show GW' + S.gw + (S.source === 'sheet' ? ' (the written script)' : '') + ': ' + S.rendered.length + ' rendered' + (S.rendered.length ? ' (' + S.rendered.join(', ') + ')' : '') +
    ', ' + S.kept + ' unchanged' + (S.removed.length ? ', ' + S.removed.length + ' cut (' + S.removed.join(', ') + ')' : '') +
    ', ' + S.left + ' still to render, of ' + S.clips + ' clips.';
  if (S.untimed) s += ' ' + S.untimed + ' without word times (the app keeps its estimate for those).';
  if (S.stopped === 'time') s += ' Stopped at the time limit; the next run finishes it.';
  else if (S.stopped) s += ' Stopped: ' + (S.error || S.stopped) + '.';
  if (S.hold) s += ' No ElevenLabs render until ' + S.hold + ' (the balance is read again once an hour; Render now in the menu lifts the hold).';
  if (S.model) s += ' Voice model ' + S.model + (S.modelFrom === 'fallback' ? ' (the fallback for this gameweek)' : S.modelFrom === 'property' ? ' (EMT_TTS_MODEL)' : '') + '.';   /* v3.26 */
  return s;
}

/* aiTick runs this every 15 minutes: the next unfinished gameweek, if a key is set and the show is not paused */
function showTick(startedAt) {
  var t0 = typeof startedAt === 'number' ? startedAt : Date.now();
  if (!emtShowKey()) { emtShowNoKey('showTick'); return { ok: false, stopped: 'nokey' }; }
  if (emtProps().getProperty('EMT_SHOW_PAUSED') === 'yes') { Logger.log(emtShowSummary({ stopped: 'paused' })); return { ok: true, stopped: 'paused' }; }
  var gw = emtShowNextGw();
  if (!gw) { Logger.log(emtShowSummary({ stopped: 'nogw' })); return { ok: true, stopped: 'nogw' }; }
  var H = emtShowHold();                                                            /* v3.25: no render while holding */
  if (H && Date.parse(H.until) > Date.now()) { var R = emtShowHoldTick(gw, H); if (R) return R; }
  else if (H) emtShowHoldClear();
  try { emtShowCreditsFresh(emtShowKey()); } catch (e) { }                           /* v3.25: the balance for ?health=1 */
  return renderShow(gw, t0);
}

/* menu: Render the Gameweek Show now (the next unfinished gameweek; works while paused) */
function renderShowNow() {
  var S;
  if (emtShowHold()) { emtShowHoldClear(); Logger.log('Gameweek Show: the hold after the last credit refusal is lifted by the menu.'); }   /* v3.25 */
  if (emtShowKey()) S = renderShow(0);
  else { emtShowNoKey('menu'); S = { ok: false, stopped: 'nokey' }; }
  var msg = emtShowSummary(S);
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) { Logger.log(msg); }   /* no UI from a trigger or the editor */
  return S;
}

/* v3.24: the stored takes of a gameweek judged against the current script: { lines, idx, fresh: [keys], stale: [keys],
 * missing: [keys], expected: [keys] }. lines is null when no script can be found (then every stored take is unknown
 * and nothing counts as fresh). script: the json when the caller has it already. */
function emtShowJudge(gw, script) {
  if (script === undefined) script = emtShowScriptAny(gw);
  var lines = script && typeof script === 'object' ? emtShowLines(script, gw) : null;   /* v3.26: the gameweek's model */
  var sh = SpreadsheetApp.getActive().getSheetByName('ShowAudio'), idx = sh ? emtShowIndex(sh, gw) : {};
  var J = { lines: lines, idx: idx, sheet: sh, script: script || null, fresh: [], stale: [], missing: [], expected: lines ? lines.map(function (c) { return c.key; }) : (emtShowExpected(gw) || []) };
  if (!lines) return J;
  lines.forEach(function (c) {
    var x = idx[c.key];
    if (!x || !x.ok) J.missing.push(c.key);
    else if (x.hash !== c.hash) J.stale.push(c.key);
    else J.fresh.push(c.key);
  });
  return J;
}

/* log what is rendered for a gameweek (default: the next unfinished one) */
function showStatus(gw) {
  gw = Number(gw) > 0 ? Number(gw) : emtShowNextGw();
  if (!emtShowKey()) emtShowNoKey('showStatus');
  var J = emtShowJudge(gw), idx = J.idx, keys = J.expected.length ? J.expected : Object.keys(idx), done = 0, secs = 0, lines = [];
  var stale = {}; J.stale.forEach(function (k) { stale[k] = 1; });
  keys.forEach(function (k) {
    var c = idx[k];
    if (c && c.ok && !stale[k]) { done++; secs += c.secs; lines.push(k + ': ' + c.secs + ' s, ' + c.parts + ' part' + (c.parts > 1 ? 's' : '') + ', hash ' + c.hash.slice(0, 8) + (c.words ? ', ' + c.words.length + ' word times' : '')); }
    else lines.push(k + ': ' + (c && c.ok ? 'stale (an older take; the next render replaces it)' : c ? 'incomplete' : 'not rendered'));
  });
  Object.keys(idx).forEach(function (k) { if (keys.indexOf(k) < 0) lines.push(k + ': not in the script any more (the next render removes it)'); });
  secs = Math.round(secs * 100) / 100;
  var last = emtShowLast();
  Logger.log('Gameweek Show GW' + gw + ': ' + done + ' of ' + keys.length + ' clips rendered and current, ' + secs + ' s' +
    (J.lines ? '' : ' (no script found: the stored takes cannot be judged)') + (J.stale.length ? ', ' + J.stale.length + ' stale' : '') +
    (last ? '\nLast render ' + last.at + ': ' + (last.ok ? 'ok' : 'stopped, ' + (last.error || last.stopped)) : '') + '\n' + lines.join('\n'));
  return { gw: gw, expected: keys.length, rendered: done, stale: J.stale.length, secs: secs };
}

/* doGet ?show=<gw>: the clips in play order. v3.24: only the takes rendered from the current script's lines (the
 * stored hash equals md5(text|voice|model|speed) of the line as it is now); an older take is listed in stale and
 * never served, a line without one in missing. complete = every line of the current script has a fresh clip.
 * Each clip: secs, hash, b64, and w (word start times, seconds) when it was rendered with timestamps.
 * v3.12: + script (emtShowScriptAny: the repo json, cached 5 minutes, else ShowScripts, else null). With no script
 * at all nothing is served (the app has nothing to caption either).
 * meta (?show=<gw>&meta=1) leaves out every b64 and skips reading the audio: secs, hash, w and complete stay. */
function emtShowGet(gwParam, meta) {
  var gw = parseInt(gwParam, 10);
  if (!(gw > 0)) return { ok: false, error: 'badgw' };
  meta = meta === true || /^(1|true|yes)$/i.test(String(meta == null ? '' : meta));
  var script = emtShowScriptAny(gw), J = emtShowJudge(gw, script), clips = {};
  if (J.sheet && J.lines) {
    var idx = J.idx, keys = J.fresh, data = meta ? null : emtShowData(J.sheet, gw, idx, keys);
    keys.forEach(function (k) {
      if (!meta && data[k] === undefined) return;
      var c = { secs: idx[k].secs, hash: idx[k].hash };
      if (idx[k].words) c.w = idx[k].words;
      if (!meta) c.b64 = data[k];
      clips[k] = c;
    });
  }
  var complete = !!J.lines && J.expected.length > 0 && J.expected.every(function (k) { return !!clips[k]; });
  return { ok: true, gw: gw, clips: clips, complete: complete, stale: J.stale, missing: J.lines ? J.expected.filter(function (k) { return !clips[k] && J.stale.indexOf(k) < 0; }) : [], script: script };
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
 *   Model: EMT_SHOW_MODEL, then (v3.13, the model chain) claude-sonnet-5-5, then claude-sonnet-4-5. To have a show
 *   rewritten, delete its ShowScripts row.
 *   v3.13: the facts may carry the preview article's extra keys (kind 'preview', collisions, slate, rosters, moves);
 *   the show's prompt leaves them out, so the show is written exactly as before. A post with kind 'recap' is refused.
 *   v3.13: the tone (THE READERS) is in the voice bible, beats run 10 to 22 words, and a checked script gets one
 *   punch-up call (emtShowPunch: Haiku makes it funnier, emtShowCheck runs again; else the checked script stands).
 *   QUOTA: an idle run reads a few narrow columns. A written show is 1 or 2 Claude calls (~10k tokens in, ~1k out),
 *   plus the punch-up (~3k in, ~1k out, on Haiku).
 * ===================================================================================================== */
var EMT_FACTS_HEAD = ['GW', 'Received (UTC)', 'Team', 'Part', 'Parts', 'Data'];
var EMT_SCRIPTS_HEAD = ['GW', 'Written (UTC)', 'Model', 'Facts received (UTC)', 'Script'];
var EMT_FACTS_MAX = 60000;                  // characters per post
var EMT_FACTS_EVERY_S = 20 * 60;            // one accepted post per manager per 20 minutes
var EMT_JSON_MARK = 'j:';                   // every json cell starts with this, so it can never be read as a formula
var EMT_SHOW_WRITER_DEFAULT = 'claude-sonnet-5-5';                  // v3.13 (was claude-sonnet-4-5, which retires 30 Nov 2026)
var EMT_SHOW_MODELS = [EMT_SHOW_WRITER_DEFAULT, 'claude-sonnet-4-5'];   // v3.13: the chain after EMT_SHOW_MODEL
var EMT_SHOW_WINDOW_MS = 22 * 3600e3;       // write in the last 22 hours before the deadline ...
var EMT_SHOW_FRESH_MS = 6 * 3600e3;         // ... from facts received in the last 6 hours,
var EMT_SHOW_LASTCALL_MS = 4 * 3600e3;      // or in the last 4 hours from any facts
var EMT_SHOW_TRIES = 3;                     // attempts per gameweek (one attempt = one run, with its one retry)
var EMT_SHOW_WRITE_LATE_MS = 150 * 1000;    // aiTick: no new write once the run is 2.5 minutes old (v3.13: nor a punch-up)
var EMT_SHOW_BEAT_WORDS = [10, 22];         // v3.13: words per beat the prompts ask for (was 10 to 16) ...
var EMT_SHOW_BEAT_HARD = [5, 32];           // ... and outside which emtShowCheck refuses a beat (was 5 to 26: the same slack)
var EMT_SHOW_VOICE_LABEL = 'Malcolm Tyre — El Matador Booth';
var EMT_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/* the voice bible */
var EMT_SHOW_SYSTEM = [
  'You write the Gameweek Show for Matchweek, the app of El Matador Tire: a private FPL Draft (fantasy Premier League) league of eight friends. Every gameweek each club plays one head to head fixture (3 points a win, 1 a draw). The show is a spoken preview of about two minutes: a synthetic voice reads it while the screen shows each fixture.',
  '',
  'THE VOICE. Malcolm Tyre, a fictional British broadcaster in "the booth": commentary-box calm, short plain sentences, British spelling, no exclamation marks. The comedy is a deadpan undercut after a real fact, usually in the last few words of a beat. Not every beat needs a joke, but the show should make the group chat laugh at least five times.',
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
  '- 10 to 22 words per beat.',
  '- AUDIO TAGS (the voice is ElevenLabs v4: a tag in square brackets just before the words it shapes directs the delivery, e.g. [laughing], [whispering], [sighs], [deadpan], [annoyed], [ecstatic], [long pause]). Use them sparingly: one, at most two, on a line, and only where a tag lands the joke (a sigh before the undercut, a whisper for the aside); most lines carry none and never put one on every line. A tag is never a word of the script: no number, no name, nothing the listener needs is inside it.',
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
  '- Banter only about the league: picks, form, the table, quotes, and the running jokes in NOTES. THE READERS below sets what is funny and the hard limits.',
  '- Real footballers only as players in someone\'s team.',
  '',
  'STYLE. No em dashes or en dashes, no emoji, no hashtags. Three beats as a style reference only (their facts are not this week\'s; never copy them): "Gibbs-White tops the eleven. Not a single flag among PJ\'s starters. Fully fit. Just shite.", "Palmer, Mainoo, Rice and Jacquet all carry knocks. Bad week to have named your club after one of them." and "Haaland goes to Anfield. Ethan\'s plan is Haaland. Ethan\'s backup plan is also Haaland."',
  ''
].concat(EMT_TONE_LINES, [
  '',
  'REPLY with JSON only, no prose, no code fence:',
  '{"open":"...","chapters":[{"home":"<exact home team>","away":"<exact away team>","star":{"h":"<player code from H.xi>","a":"<player code from A.xi>"},"beats":["","","","",""]}],"close":"..."}'
]).join('\n');

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
  if (f.kind !== undefined && f.kind !== null && f.kind !== 'preview') return false;   /* v3.13: recap facts go to artfacts */
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
    var st = emtFactsStore('ShowFacts', gw, team, data);
    cache.put(rk, '1', EMT_FACTS_EVERY_S);
    return { ok: true, at: st.at, parts: st.parts };
  } finally { lock.releaseLock(); }
}

/* v3.13: ShowFacts and RecapFacts share one shape. Keeps a post (a JSON string) as the only facts of its gameweek:
 * 45,000-character chunks, each Data cell marked 'j:', the older rows of that gameweek deleted bottom up. The caller
 * holds the script lock. */
function emtFactsStore(tab, gw, team, data) {
  var sh = emtHiddenSheet(tab, EMT_FACTS_HEAD), last = sh.getLastRow(), old = [];
  if (last > 1) sh.getRange(2, 1, last - 1, 1).getValues().forEach(function (r, i) { if (Number(r[0]) === gw) old.push(i + 2); });
  var at = new Date().toISOString(), n = Math.ceil(data.length / EMT_SHOW_CHUNK);
  for (var q = 0; q < n; q++) sh.appendRow([gw, "'" + at, emtCell(team), q + 1, n, EMT_JSON_MARK + data.slice(q * EMT_SHOW_CHUNK, (q + 1) * EMT_SHOW_CHUNK)]);
  emtShowDeleteRows(sh, old);              /* only the latest facts per gameweek: the older rows go, bottom up */
  return { at: at, parts: n };
}

/* the newest complete facts for a gameweek: { at (ms), iso, team, parts, rows } (+ data when withData), or null.
 * Without data it reads five narrow columns only. */
function emtShowFactsLatest(gw, withData) { return emtFactsLatest('ShowFacts', gw, withData); }
/* v3.13: the same for any facts tab (ShowFacts, RecapFacts) */
function emtFactsLatest(tab, gw, withData) {
  var sh = SpreadsheetApp.getActive().getSheetByName(tab), last = sh ? sh.getLastRow() : 0;
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

/* ---------- v3.15: the facts from the repo (the Facts bot) ----------
 * .github/workflows/facts.yml loads the live app headless every 3 hours, has its engine compute the preview and the
 * recap facts (what a phone would post) and commits them to the repo's `facts` branch: facts/index.json names the
 * files and says when each last changed; facts/preview-gw<N>.json and facts/recap-gw<N>.json hold the JSON. The
 * writers read whichever is newer, a phone's facts (ShowFacts, RecapFacts) or the repo's (emtFactsBest); a repo file
 * passes exactly the checks a phone's post passes (emtFactsCheck) or is ignored. The repo is the trust anchor: only
 * the Action and the commissioner can write to it, so no secret is needed. Reads: the index once a run (cached 4
 * minutes), a file only when it is the newer one and its data is wanted. Nothing here ever throws. */
var EMT_FACTS_SRC = 'https://raw.githubusercontent.com/parkerno2/el-matador-tire/facts/facts/';
var EMT_FACTS_BOT = 'Facts bot';
var EMT_FACTS_INDEX_S = 240;
var EMT_FACTS_KIND = { ShowFacts: 'preview', RecapFacts: 'recap' };
var EMT_REPO_RUN = {};                      /* this execution's memo: the index, the files, what was already logged */
function emtRepoReset() { EMT_REPO_RUN = {}; }
/* one raw file of the facts branch: { text } | { none } | { error }, read once an execution */
function emtRepoGet(name) {
  var k = 'f:' + name;
  if (EMT_REPO_RUN[k]) return EMT_REPO_RUN[k];
  var r;
  try {
    var res = UrlFetchApp.fetch(EMT_FACTS_SRC + name + '?cb=' + Date.now(), { muteHttpExceptions: true }), code = res.getResponseCode();
    r = code === 200 ? { text: String(res.getContentText() || '') } : code === 404 ? { none: true } : { error: 'HTTP ' + code };
  } catch (e) { r = { error: String((e && e.message) || e).replace(/\s+/g, ' ').slice(0, 120) }; }
  if (r.error) Logger.log(EMT_FACTS_BOT + ': facts/' + name + ' could not be read (' + r.error + '); only the phones\' facts count this run.');
  return (EMT_REPO_RUN[k] = r);
}
function emtRepoBad(name, why) {
  var k = 'bad:' + name;
  if (!EMT_REPO_RUN[k]) { EMT_REPO_RUN[k] = why; Logger.log(EMT_FACTS_BOT + ': facts/' + name + ' is ignored: ' + why + '.'); }
}
/* facts/index.json: { files: { 'preview-gw6.json': { kind, gw, at, ... } }, updated, app } | null (none, or unreadable) */
function emtRepoIndex() {
  if (EMT_REPO_RUN.index !== undefined) return EMT_REPO_RUN.index;
  var cache = null, hit = null, j = null;
  try { cache = CacheService.getScriptCache(); hit = cache.get('EMT_FACTS_INDEX'); } catch (e) { cache = null; }
  if (hit === '0') return (EMT_REPO_RUN.index = null);
  if (hit) { try { j = JSON.parse(hit); } catch (e) { j = null; } }
  if (!j) {
    var r = emtRepoGet('index.json');
    if (r.text) { try { j = JSON.parse(r.text); } catch (e) { j = null; emtRepoBad('index.json', 'it does not parse'); } }
    if (j && (typeof j !== 'object' || !j.files || typeof j.files !== 'object')) { j = null; emtRepoBad('index.json', 'it lists no files'); }
    if (cache && !r.error) { try { cache.put('EMT_FACTS_INDEX', j ? JSON.stringify(j) : '0', EMT_FACTS_INDEX_S); } catch (e) { } }
  }
  return (EMT_REPO_RUN.index = j);
}
/* the repo's facts of a kind for a gameweek, in emtFactsLatest's shape: { at, iso, team: 'Facts bot', parts: 1, source:
 * 'repo', name } (+ data when withData, only if the file reads and passes the checks), else null */
function emtRepoFacts(kind, gw, withData) {
  var idx = emtRepoIndex(), name = kind + '-gw' + gw + '.json', e = idx && idx.files ? idx.files[name] : null;
  if (!e || typeof e !== 'object') return null;
  var at = aiTs(e.at);
  if (!(at > 0) || (e.gw !== undefined && Number(e.gw) !== gw) || (e.kind && e.kind !== kind)) return null;
  var out = { at: at, iso: new Date(at).toISOString(), team: EMT_FACTS_BOT, parts: 1, source: 'repo', name: name };
  if (!withData) return out;
  var r = emtRepoGet(name);
  if (!r.text) { if (r.none) emtRepoBad(name, 'the index lists it but it is not in the facts branch'); return null; }
  if (r.text.length > EMT_FACTS_MAX) { emtRepoBad(name, 'over ' + EMT_FACTS_MAX + ' characters'); return null; }
  var f = null;
  try { f = JSON.parse(r.text); } catch (x) { emtRepoBad(name, 'it does not parse'); return null; }
  var why = emtFactsCheck(kind, f, gw);
  if (why) { emtRepoBad(name, 'it fails a check a phone\'s facts must pass (' + why + ')'); return null; }
  out.data = f;
  return out;
}
/* '' when the facts pass what a phone's post passes (emtShowFacts / emtArtFacts): the kind and the gameweek, the
 * sheet's fixtures and, for a recap, a finished gameweek with its exact scores; else that error code */
function emtFactsCheck(kind, f, gw) {
  if (kind === 'preview') return emtShowFactsOk(f, gw) ? '' : 'badfacts';
  if (kind === 'recap') return emtArtFactsCheck(f, gw, emtRows('H2H Fixtures'));
  return 'badkind';
}
/* the newer of a phone's facts (the tab) and the repo's for a gameweek, in emtFactsLatest's shape plus source ('phone'
 * | 'repo'); a tie goes to the phone. With data: the newest whose data reads and passes the checks (a post being
 * replaced as it is read, or a repo file that fails them, lets the other one through). */
function emtFactsBest(tab, gw, withData) {
  var kind = EMT_FACTS_KIND[tab] || '', phone = emtFactsLatest(tab, gw, false), repo = kind ? emtRepoFacts(kind, gw, false) : null;
  if (phone) phone.source = 'phone';
  var order = [phone, repo].filter(Boolean).sort(function (a, b) { return (b.at - a.at) || (a.source === 'phone' ? -1 : 1); });
  if (!withData) return order[0] || null;
  for (var i = 0; i < order.length; i++) {
    var full = order[i].source === 'phone' ? emtFactsLatest(tab, gw, true) : emtRepoFacts(kind, gw, true);
    if (full && full.data) { full.source = order[i].source; return full; }
  }
  return null;
}
/* ?health=1 facts: the newest preview and recap facts and where each came from, plus the repo's index */
function emtFactsHealth() {
  var out = { preview: null, recap: null, repo: null };
  try {
    var gw = emtShowNextGw(), rg = emtArtRecapGw();
    var p = gw ? emtFactsBest('ShowFacts', gw, false) : null, r = rg ? emtFactsBest('RecapFacts', rg, false) : null;
    out.preview = p ? { gw: gw, at: p.iso, from: p.source } : null;
    out.recap = r ? { gw: rg, at: r.iso, from: r.source } : null;
    var idx = emtRepoIndex(), got = EMT_REPO_RUN['f:index.json'] || {};
    out.repo = idx ? { updated: idx.updated || null, app: idx.app || null, files: Object.keys(idx.files).sort() } : got.error ? { error: got.error } : null;
  } catch (e) { out.error = String((e && e.message) || e).slice(0, 160); }
  return out;
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

/* v3.24: the 5-minute cache of the repo's json, refreshed by a render with what it fetched (f from emtShowScript:
 * { json } from the repo, or { json, source: 'sheet' } when the repo had none) */
function emtShowRepoCache(gw, f) {
  try {
    var repo = f && f.json && f.source !== 'sheet' ? { json: f.json } : f && f.source === 'sheet' ? { none: true } : null;
    if (repo) CacheService.getScriptCache().put('EMT_SHOW_REPO_' + gw, JSON.stringify(repo), 300);
  } catch (e) { }
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
  facts = emtShowCore(facts);
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

/* v3.13: the show's facts without the preview article's extra keys, so the show is written exactly as before */
var EMT_SHOW_ART_KEYS = ['kind', 'collisions', 'slate', 'rosters', 'moves'];
function emtShowCore(facts) {
  if (!facts || typeof facts !== 'object' || Array.isArray(facts)) return facts;
  var o = {};
  Object.keys(facts).forEach(function (k) { if (EMT_SHOW_ART_KEYS.indexOf(k) < 0) o[k] = facts[k]; });
  return o;
}

/* one call to Claude, same style as aiWrite: { text, stop } or { error, missing } (no answer, nothing billed;
 * missing = the model does not exist or is retired, so the chain moves on). system: EMT_SHOW_SYSTEM unless given
 * (v3.13: the punch-up passes EMT_PUNCH_SHOW_SYSTEM) */
function emtShowAsk(model, user, system) {
  var extra = emtModelParams(model, 'quick'), res, code, body;                 /* v3.20: thinking off for a quick answer */
  for (var again = 0; again < 2; again++) {
    res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { 'x-api-key': emtAiKey(), 'anthropic-version': '2023-06-01' },
      payload: JSON.stringify(Object.assign({ model: model, max_tokens: EMT_SHOW_MAX_TOKENS, system: system || EMT_SHOW_SYSTEM, messages: [{ role: 'user', content: user }] }, extra))
    });
    code = res.getResponseCode(); body = String(res.getContentText() || '');
    if (code === 200 || again || !Object.keys(extra).length || !emtParamRefused(code, emtApiErr(body).msg)) break;
    Logger.log('Show writer: ' + model + ' refused a parameter (' + emtApiErr(body).msg.slice(0, 100) + '); asking again without it.');
    extra = {};
  }
  if (code !== 200) { var er = emtApiErr(body); return { error: 'Claude API ' + code + ': ' + body.slice(0, 200), missing: emtModelMissing(code, er.type, er.msg), msg: er.msg }; }
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
/* v3.26: the audio tags of a script: each [tag] is lowercase letters and spaces, at most EMT_SHOW_TAGS_PER_LINE on a
 * line, and fewer than half the lines carry one (sparse: only where they land the joke). The problems, as strings. */
function emtShowTagProblems(texts) {
  var P = [], tagged = 0, n = 0;
  (texts || []).forEach(function (t) {
    if (typeof t !== 'string' || !t) return;
    n++;
    var tags = emtShowTags(t);
    if (!tags.length) return;
    tagged++;
    if (tags.length > EMT_SHOW_TAGS_PER_LINE) P.push('"' + emtShowCaption(t).slice(0, 60) + '": ' + tags.length + ' audio tags; at most ' + EMT_SHOW_TAGS_PER_LINE + ' a line.');
    tags.forEach(function (g) { if (!/^\[[a-z][a-z ]{1,30}\]$/.test(g)) P.push('The audio tag ' + g + ' is not lowercase words in square brackets, like [laughing].'); });
  });
  if (n && tagged * 2 > n) P.push(tagged + ' of ' + n + ' lines carry an audio tag; tags go only where they land the joke, on fewer than half the lines.');
  return P;
}
function emtShowCheck(text, facts, allowed, stop) {
  var P = [], j = null, m = String(text || '').match(/\{[\s\S]*\}/);
  if (m) { try { j = JSON.parse(m[0]); } catch (e) { j = null; } }
  if (!j || typeof j !== 'object' || Array.isArray(j)) {
    P.push(stop === 'max_tokens' ? 'The reply was cut off before the JSON ended: keep every beat to ' + EMT_SHOW_BEAT_WORDS[0] + ' to ' + EMT_SHOW_BEAT_WORDS[1] + ' words.' : 'The reply was not one JSON object in the shape asked for.');
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
      var n = b ? emtShowCaption(b).split(/\s+/).filter(Boolean).length : 0;   /* v3.26: the audio tags are not words */
      if (b && (n < EMT_SHOW_BEAT_HARD[0] || n > EMT_SHOW_BEAT_HARD[1])) P.push(name + ', beat ' + k + ': ' + n + ' words; keep every beat to ' + EMT_SHOW_BEAT_WORDS[0] + ' to ' + EMT_SHOW_BEAT_WORDS[1] + '.');
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
  P = P.concat(emtShowTagProblems(texts));   /* v3.26: sparse audio tags only */
  texts.forEach(function (t) {
    emtShowNums(emtShowCaption(t)).forEach(function (n) {
      if (!ok[n] && !ok[String(Number(n))] && !bad[n]) { bad[n] = 1; P.push('The number ' + n + ' (in "' + String(t).slice(0, 90) + '") is not in FACTS, QUOTES or NOTES.'); }
    });
  });
  return P.length ? { problems: P, script: null } : { problems: [], script: { open: open, chapters: chapters, close: close } };
}

/* ask, check, and ask once more with the problems listed. { script, model, calls, billed, problems, error, allowed }
 * v3.13: the model chain (EMT_SHOW_MODEL, then EMT_SHOW_MODELS); a retired model passes to the next at once.
 * allowed: what the script was checked against, so the punch-up (emtShowPunch) is checked against the same */
function emtShowWrite(gw, facts, dl) {
  var P = emtShowPrompt(gw, facts, dl), models = emtModelsLive(emtModelChain('EMT_SHOW_MODEL', EMT_SHOW_MODELS)), mi = 0;
  var W = { script: null, model: models[0], calls: 0, billed: 0, problems: [], error: '', allowed: P.allowed }, ask = P.user;
  for (var round = 0; round < 2; round++) {
    var r = emtShowAsk(models[mi], ask);
    W.calls++;
    while (r.error && r.missing && mi < models.length - 1) {
      emtModelNoteGone(models[mi], r.msg);
      W.model = models[++mi];
      r = emtShowAsk(W.model, ask);
      W.calls++;
    }
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
  var left = dl - now, facts = emtFactsBest('ShowFacts', gw, false);                  /* v3.15: a phone's or the repo's */
  if (!facts) {
    S.stopped = 'nofacts';
    if (left <= EMT_SHOW_WINDOW_MS) say('no facts from the app yet (a signed-in manager opening it sends them, and so does the Facts bot).');
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
    facts = emtFactsBest('ShowFacts', gw, true);
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
    /* v3.13: the punch-up, one quick call. The checked script stays when it fails the checks, errors, or the run is
     * already late; either way the script reaches emtSpeak and ShowScripts the same way. Model: writer + punch model. */
    var PU = emtShowPunch(gw, W, facts.data, t0), model = W.model + (PU.used ? ' + ' + PU.model : '');
    S.calls += PU.calls;
    S.punch = { used: PU.used, model: PU.used ? PU.model : '', why: PU.why, off: PU.off };
    var lock = LockService.getScriptLock(), at = new Date().toISOString(), js = emtShowSpoken(gw, PU.script, at, emtShowNames(facts.data));
    lock.waitLock(10000);
    try {
      if (emtShowScriptRow(gw, false)) { S.stopped = 'written'; return S; }
      emtHiddenSheet('ShowScripts', EMT_SCRIPTS_HEAD).appendRow([gw, "'" + at, emtCell(model), "'" + facts.iso, EMT_JSON_MARK + JSON.stringify(js)]);
    } finally { lock.releaseLock(); }
    S.written = true; S.script = js;
    say('written by ' + W.model + (PU.used ? ', punched up by ' + PU.model : '') + ' (' + W.calls + ' call' + (W.calls > 1 ? 's' : '') + ', ' + js.chapters.length + ' chapters) from the facts of ' + facts.iso + ' (' + facts.team + ').' +
      (!PU.used && PU.why ? ' Punch-up not used: ' + (PU.why + (PU.detail ? ': ' + PU.detail : '')).replace(/[.\s]+$/, '') + '; the checked script stands.' : '') + ' The show voices it next.');
    return S;
  } finally { p.deleteProperty('EMT_SHOW_WRITING'); }
}

/* =====================================================================================================
 * v3.13 · MODEL CHAINS — every writer tries its models in order, so a retired model never stops a pipeline.
 *   emtModelChain(prop, defaults): the Script Property's model (when set), then the defaults, without repeats.
 *   A model that answers 404 not_found_error, or a 400 about the model, is noted in EMT_MODEL_GONE and skipped for
 *   3 days (when every model in a chain is noted, all of them are tried again).
 * ===================================================================================================== */
var EMT_MODEL_GONE_MS = 3 * 24 * 3600e3;

function emtModelChain(prop, defaults) {
  var out = [], add = function (m) { m = String(m == null ? '' : m).trim(); if (m && out.indexOf(m) < 0) out.push(m); };
  add(emtProps().getProperty(prop));
  (defaults || []).forEach(add);
  return out;
}
function emtModelGoneMap() {
  try { var g = JSON.parse(emtProps().getProperty('EMT_MODEL_GONE') || '{}'); return g && typeof g === 'object' ? g : {}; } catch (e) { return {}; }
}
function emtModelIsGone(g, m) { var t = Number(g[m] || 0), now = Date.now(); return !!t && now - t >= 0 && now - t < EMT_MODEL_GONE_MS; }
/* the chain without the models noted as gone (the whole chain when that would leave none) */
function emtModelsLive(chain) {
  var g = emtModelGoneMap(), live = chain.filter(function (m) { return !emtModelIsGone(g, m); });
  return live.length ? live : chain.slice();
}
function emtModelNoteGone(model, why) {
  if (!model) return;
  var g = emtModelGoneMap();
  Object.keys(g).forEach(function (k) { if (!emtModelIsGone(g, k)) delete g[k]; });
  g[model] = Date.now();
  emtProps().setProperty('EMT_MODEL_GONE', JSON.stringify(g));
  Logger.log('Model ' + model + ' is not available (' + String(why || '').replace(/\s+/g, ' ').slice(0, 140) + '); the next model in the chain takes over. Skipped for 3 days.');
}
/* does an API error say the model does not exist or is retired? 404 / not_found_error, or a 400 about the model */
function emtModelMissing(code, type, msg) {
  msg = String(msg || '');
  if (code === 404 || type === 'not_found_error') return true;
  return (code === 400 || type === 'invalid_request_error') && /\bmodel\b/i.test(msg) && !/web.?search/i.test(msg);
}
/* the type and message of an Anthropic error body ({ type: 'error', error: { type, message } }) */
function emtApiErr(body) {
  var j = null;
  if (body && typeof body === 'object') j = body; else { try { j = JSON.parse(String(body || '')); } catch (e) { j = null; } }
  var e = (j && (j.error && typeof j.error === 'object' ? (j.error.error && typeof j.error.error === 'object' ? j.error.error : j.error) : null)) || {};
  return { type: String(e.type || ''), msg: String(e.message || (j ? '' : body) || '').slice(0, 400) };
}

/* =====================================================================================================
 * v3.13 · ARTICLES WRITE THEMSELVES — the gameweek recap and the deadline preview, researched and written here.
 * v3.14 · ... AND PUBLISH THEMSELVES: an article that passes the checks goes live at once (no approval step; the
 *   commissioner's call, 8 Oct 2026). Script Property EMT_ART_REVIEW = yes brings back the v3.13 draft-and-approve flow.
 *   The commissioner can still ask for a rewrite of a live article (the live version stays up until the new one passes
 *   the checks) or take it down.
 *   1. Facts. Preview: the ShowFacts the app already posts (showfacts; kind 'preview', with collisions, slate,
 *      rosters and moves). Recap: POST { action: 'artfacts', team, token, gw, kind: 'recap', facts: '<json string>' }:
 *      signed-in managers only, one accepted post per manager per 20 minutes ('slow', its own counter, so a phone can
 *      send both kinds), at most 60,000 characters ('badfacts'). gw must be the latest gameweek whose H2H Fixtures
 *      rows are all Finished ('notdone' while one is not, 'closed' for an older one); the facts must hold exactly its
 *      fixtures ('fixtures') with hs/as equal to Home pts/Away pts ('scores'). Kept in the hidden RecapFacts tab, like
 *      ShowFacts (the latest post per gameweek).
 *   2. articleTick (aiTick, every 15 minutes; one job at a time, in EMT_ART_JOB) starts, when no job runs:
 *      a rewrite the commissioner asked for (EMT_ART_QUEUE) first; else the recap of that gameweek when it has no
 *      Articles row yet, its recap facts arrived in the last 24 hours and its last game kicked off at most 5 days ago;
 *      else the preview of the next gameweek whose deadline is at most 50 hours away, when it has no row yet and
 *      preview facts (kind 'preview') arrived in the last 12 hours. A dropped or failed article is not restarted;
 *      the menu's 'Articles: write now' ignores the windows and starts a new one.
 *   3. Research: one Message Batches request with web search (10 searches at most): notes grouped by fixture and a
 *      SOURCES list, of which only urls web search really returned are kept. pause_turn is continued twice at most.
 *      Web search unavailable (a 400 about it): the article is written from the league data alone ('research
 *      unavailable: ...' in the Log).
 *   4. Writing: a second batch, no tools, the house style (EMT_ART_SYSTEM). emtArticleCheck checks the reply; a failed
 *      check goes back once with the problems (the same try). 3 tries a job: an errored, expired or lost batch, one
 *      still unfinished after 6 hours, or two failed checks is a try; a call that never reached Claude is not. Then
 *      status failed, the reasons in Log. A job still open 36 hours after it started is given up.
 *      v3.13: a checked article then goes to the punch-up (a third batch, <id>-p, see THE PUNCH-UP below).
 *      v3.14: the punched-up version, or the checked one when the punch-up is not used, is then done (emtArtDone):
 *      published at once (status live, the article as plain 'j:' json, Approved (UTC) now, 'Published automatically' in
 *      the Log), or with EMT_ART_REVIEW = yes kept sealed as a draft for the commissioner.
 *   5. The Articles tab (hidden): Id · GW · Kind · Status (research, writing, draft, live, dropped, failed) · Written
 *      (UTC) · Model (v3.13: '<writer> + <punch model>' when the punch-up was used) · Facts received (UTC) · Research
 *      ('t:' + notes) · Article ('j:' + json once live; sealed 's:' before that, and again when a live one is dropped)
 *      · Note ('j:' + { s: <sealed note>, redos, at, pend }) · Approved (UTC: the first publish) · Log (one line per
 *      event, newest last; quoted draft text redacted). ArticleWork (hidden) keeps a job's working files (the facts it
 *      was given, a paused research turn, a rejected reply, sealed, and v3.13 the checked article waiting for its
 *      punch-up, sealed) until the job ends.
 *      Hidden is not private (the sheet is link-viewable), hence the sealing: see emtArtSeal.
 *      Each job carries a run token: a run left over from before a drop and a rewrite stops instead of overwriting.
 *      v3.14 · A REWRITE OF A LIVE ARTICLE. The row stays status live and its Article cell keeps the live version, so
 *      ?articles and ?article go on serving it; the Note's pend reads 'writing' (emtArtLiveRw) and the job (job.live)
 *      writes the new version in ArticleWork like any rewrite (sealed while it waits for its punch-up). When it passes
 *      the checks, emtArtDone swaps it into the Article cell (Written and Model updated, Approved kept, pend cleared).
 *      When it fails (3 tries, 36 hours, no facts, no model), emtArtFail leaves the live version as it is and sets
 *      pend to 'failed'. A drop meanwhile takes the article down and cancels the rewrite. A lost job is found again
 *      through pend (emtArtNext), like an article left in research or writing.
 *   6. Serving: GET ?articles=1 → { ok, live: [{ id, gw, kind, title, sub, approved, written }] newest first, waiting:
 *      [{ gw, kind, status, since }], commish, review } (cached 5 minutes, cleared on every change; review is read
 *      fresh). GET ?article=<id> → { ok, id, gw, kind, approved, written, auto, a } for a live article, else { ok:
 *      false, error: 'notfound' }.
 *      POST { action: 'articles', team, token } → { ok, commish, review, drafts: [{ id, gw, kind, status, written,
 *      model, note, redos, a, error? }], live: [{ id, gw, kind, redos, note, rewrite: '' | 'writing' | 'failed', error?
 *      }] }: drafts (research, writing, draft, and failed in the last 7 days) and live go to the commissioner only.
 *      POST { action: 'articlemod', team, token, id, op, note } (commissioner only): approve (a draft goes live), redo
 *      (draft, failed or dropped: rewritten with the note, 400 characters at most, from the stored research; v3.14 also
 *      a live article, except in review mode; 3 per article) or drop (a live one is taken down). → { ok, status } |
 *      { ok: false, error }.
 *      GET ?health=1 → { ok, version, self, show, articles: { mode, job, last }, ai: { day, count } }, no secrets.
 *   Commissioner: Script Property EMT_COMMISH, else Cold Palmers. EMT_ARTICLES_PAUSED = yes pauses articleTick.
 *   Model: EMT_ARTICLE_MODEL, then claude-sonnet-5-5, claude-opus-5-5, claude-sonnet-4-5.
 *   QUOTA: an idle run reads a few narrow columns. An article takes 2 to 6 batches over an hour or so (one or two
 *   URL fetches a run), about 10 web searches and some 40k tokens at batch prices; v3.13: plus the punch-up batch.
 * ===================================================================================================== */
var EMT_VERSION = 'v3.27';                  // keep in step with the first CHANGELOG entry (?health reports it)
var EMT_ART_HEAD = ['Id', 'GW', 'Kind', 'Status', 'Written (UTC)', 'Model', 'Facts received (UTC)', 'Research', 'Article', 'Note', 'Approved (UTC)', 'Log'];
var EMT_ART_COL = { id: 1, gw: 2, kind: 3, status: 4, written: 5, model: 6, factsAt: 7, research: 8, article: 9, note: 10, approved: 11, log: 12 };
var EMT_WORK_HEAD = ['Id', 'Key', 'Part', 'Parts', 'Data', 'Saved (UTC)'];
var EMT_ART_MODELS = ['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-sonnet-4-5'];
var EMT_ART_BATCHES = 'https://api.anthropic.com/v1/messages/batches';
var EMT_TEXT_MARK = 't:';                   // the Research cell: plain text behind a marker, never a formula
var EMT_ART_RESEARCH_MAX = 45000;
var EMT_ART_URL_MAX = 400;                  // a source url; keeps a sealed article well under the 50,000-character cell
var EMT_ART_LOG_MAX = 20000;
var EMT_ART_TRIES = 3;
var EMT_ART_REDOS = 3;
var EMT_ART_CONTS = 2;                      // pause_turn continuations of the research
var EMT_ART_NOTE_MAX = 400;
var EMT_ART_BATCH_MAX_MS = 6 * 3600e3;
var EMT_ART_JOB_MAX_MS = 36 * 3600e3;
var EMT_ART_RECAP_DAYS_MS = 5 * 24 * 3600e3;
var EMT_ART_RECAP_FRESH_MS = 24 * 3600e3;
var EMT_ART_PREVIEW_AHEAD_MS = 50 * 3600e3;
var EMT_ART_PREVIEW_FRESH_MS = 12 * 3600e3;
var EMT_ART_FAILED_SHOWN_MS = 7 * 24 * 3600e3;
var EMT_ART_LATE_MS = 200 * 1000;           // aiTick: no article work once the run is 200 s old
var EMT_ART_BUSY_MS = 390 * 1000;
var EMT_ART_ACTIVE = ['research', 'writing'];
var EMT_ART_WAITING = ['research', 'writing', 'draft'];
var EMT_ART_LABELS = { recap: ['Star of the match', 'The zero'], preview: ['Player to watch', 'The limbo', 'The zero'] };
var EMT_ART_AROUND = { recap: ['Around the league', 'Waiver watch', 'Next up'], preview: ['The slate', 'Transfer clock', 'Waiver wire'] };
var EMT_ART_FOOT = { recap: 'Scores are provisional until FPL confirms bonus and stat corrections.',
  preview: 'Predicted scores come from each side\'s projected XI; flags can change at Friday\'s pressers.' };
var EMT_ART_WORDS = [600, 1400];
var EMT_COMMISH_DEFAULT = 'Cold Palmers';
var EMT_EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{2300}-\u{23FF}\u{FE0F}\u{200D}\u{20E3}\u{3030}\u{303D}\u{3297}\u{3299}]/u;

/* the house style (Parker's feedback on GW1 to GW4) */
var EMT_ART_SYSTEM = [
  'You write the weekly articles for Matchweek, the app of El Matador Tire: a private FPL Draft (fantasy Premier League) league of eight friends. Each gameweek every club plays one head to head fixture: 3 points for a win, 1 for a draw. There are two kinds of article: the RECAP after a gameweek and the PREVIEW before a deadline. Every article is checked automatically before the league sees it.',
  '',
  'THE VOICE. An objective third-person narrator who reports straight and is funny on top: never first person (no I, we, our or us). Managers by first name (mgr), clubs by team name, spelt exactly as in FACTS. British spelling, plain sentences. Every matchup gets at least one real joke, built the way THE READERS describes. No pet phrase used twice, and no coinage that needs explaining.',
  '',
  'THE RECAP is the official summary of every single game: what happened and why, for someone who did not watch. It is not a stats dump. Football first, numbers as seasoning: use the real football in RESEARCH (the goals and how they came, assists, red cards, missed penalties, VAR, benchings) to explain each fantasy result. xP appears only where it answers "was this real?". Per matchup: the kicker, the star (Star of the match, or The zero for a memorable failure), a story of 2 to 3 sentences, 3 one-line bullets, and the number of the match with its caption.',
  '',
  'THE PREVIEW is built around who has who: the collisions in FACTS list, for each fixture, the real Premier League games in which both sides have players. Find the same-club stacks, the direct duels (his striker against your keeper), the split back lines. Look ahead; last week is one line of seasoning at most. The star is the Player to watch, or The limbo when the story is a doubt, or The zero. A predicted score is always labelled as predicted ("predicted 43 to 36") and never looks like a real score. Keep numbers that drift (win chances, projections) to a minimum: the screen shows the live figures.',
  '',
  'DERBIES. When a fixture has a derby name in FACTS, the kicker starts with it. Otherwise a plain kicker of a few words.',
  '',
  'NO CONTRADICTIONS. Check every player against the rosters in FACTS before you write about him: never suggest picking up a rostered player and never imply that one is a free agent. State each fact once. Keep every scoreline consistent across the article.',
  '',
  'BANTER stays inside the league: picks, form, the table, quotes, trades. Nothing about anyone\'s looks, family, health, money, work or life outside the league. THE READERS below sets what is funny and the hard limits. Quote a manager only word for word from the quotes in FACTS, in double quotes; never invent a quote. Real footballers appear only as footballers.',
  '',
  'NUMBERS. Every number you write must appear in FACTS or RESEARCH. The only exceptions: counts from 0 to 11, the years 2025 to 2027, and the margin of a scoreline in FACTS (55 to 42 is a win by 13). Never work anything else out: no sums, averages, differences or percentages of your own. Write stats as digits.',
  '',
  'STYLE. Plain text only: no markdown, no HTML, no emoji, no hashtags, no em dashes or en dashes (use a comma, a colon or a full stop; a hyphen only inside a word or a scoreline like 2-1). About 1,100 words in all, a 90-second read; never under 600 or over 1,400.',
  ''
].concat(EMT_TONE_LINES, [
  '',
  'REPLY with one JSON object only: no prose before or after it, no code fence.'
]).join('\n');

function emtCommish() { return String(emtProps().getProperty('EMT_COMMISH') || '').trim() || EMT_COMMISH_DEFAULT; }
/* v3.14: review mode (Script Property EMT_ART_REVIEW = yes): every article waits as a sealed draft for the
 * commissioner, as in v3.13. Otherwise (the default) an article is published as soon as it passes the checks. */
function emtArtReview() { return String(emtProps().getProperty('EMT_ART_REVIEW') || '').trim().toLowerCase() === 'yes'; }
function emtTrue(v) { return v === true || String(v).toUpperCase() === 'TRUE'; }
function emtUnq(v) { return v instanceof Date ? v.toISOString() : String(v == null ? '' : v).replace(/^'/, ''); }
function emtIso(ms) { return ms ? new Date(ms).toISOString() : ''; }
function emtSameNum(a, b) {
  if (a === '' || a === null || a === undefined || b === '' || b === null || b === undefined) return false;
  var x = Number(a), y = Number(b);
  return isFinite(x) && isFinite(y) && Math.abs(x - y) < 1e-9;
}
function emtArtSay(job, m) { Logger.log('Articles, ' + job.kind + ' GW' + job.gw + ' (' + job.id + '): ' + m); }
/* the cache behind ?articles=1, cleared on every change */
function emtArtTouch() { try { CacheService.getScriptCache().remove('EMT_ART_LIST'); } catch (e) { } }
/* a Log line without draft text: whitespace collapsed, quoted fragments of 24+ characters become "..." */
function emtArtRedact(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').replace(/["\u201C][^"\u201C\u201D]{24,}["\u201D]/g, '"..."'); }

/* ---------- sealed cells: drafts are unreadable in the sheet ----------
 * The sheet is shared "anyone with the link can view" and the app's public code names it, so a hidden tab can still
 * be read by anyone who asks for it by name. Until the commissioner approves an article, its text (Article cell, the
 * rejected reply in ArticleWork) and his note are kept sealed: 's:' + nonce + ':' + base64 of the UTF-8 bytes XORed
 * with an HMAC-SHA256 keystream (counter mode) under EMT_ART_SEAL, a random Script Property made on first use (no
 * setup). Approving writes the article back as plain 'j:' json. If EMT_ART_SEAL is ever deleted, sealed drafts can no
 * longer be read: ask for a rewrite or use Articles: write now. */
var EMT_SEAL_MARK = 's:';
/* the sealing key ('' when there is none and make is false). make: create it when missing (call outside the script
 * lock: it takes the lock for a moment) */
function emtArtSecret(make) {
  var p = emtProps(), k = p.getProperty('EMT_ART_SEAL') || '';
  if (k || !make) return k;
  var lock = LockService.getScriptLock(), got = false;
  try { got = lock.tryLock(10000); } catch (e) { got = false; }
  try {
    k = p.getProperty('EMT_ART_SEAL') || '';
    if (!k) { k = (String(Utilities.getUuid()) + String(Utilities.getUuid())).replace(/[^0-9a-f]/gi, '').toLowerCase(); p.setProperty('EMT_ART_SEAL', k); }
    return k;
  } finally { if (got) lock.releaseLock(); }
}
function emtArtXor(bytes, key, nonce) {
  var out = new Array(bytes.length), ks = null;
  for (var i = 0; i < bytes.length; i++) {
    if (i % 32 === 0) ks = Utilities.computeHmacSha256Signature(nonce + ':' + (i / 32), key);
    out[i] = ((bytes[i] ^ ks[i % 32]) << 24) >> 24;   /* stays a signed byte, as Apps Script's byte arrays are */
  }
  return out;
}
/* seal a string with the key (from emtArtSecret(true)) → 's:...' */
function emtArtSeal(str, key) {
  var nonce = String(Utilities.getUuid()).replace(/[^0-9a-f]/gi, '').toLowerCase().slice(0, 16);
  return EMT_SEAL_MARK + nonce + ':' + Utilities.base64Encode(emtArtXor(Utilities.newBlob(String(str)).getBytes(), key, nonce));
}
/* the string inside a sealed cell, or null (not sealed, no key, or not readable) */
function emtArtOpen(v) {
  var s = emtUnq(v), m = /^s:([0-9a-f]{8,32}):([A-Za-z0-9+\/=]*)$/.exec(s), key = m ? emtArtSecret(false) : '';
  if (!m || !key) return null;
  try { return Utilities.newBlob(emtArtXor(Utilities.base64Decode(m[2]), key, m[1])).getDataAsString(); } catch (e) { return null; }
}

/* ---------- gameweeks ---------- */
/* the latest gameweek whose H2H Fixtures rows are all Finished (0 when none) */
function emtArtRecapGw(rows) {
  var by = {}, best = 0;
  (rows || emtRows('H2H Fixtures')).forEach(function (r) {
    var g = Number(r.GW); if (!(g > 0)) return;
    var b = by[g] || (by[g] = { n: 0, done: 0 }); b.n++; if (emtTrue(r.Finished)) b.done++;
  });
  Object.keys(by).forEach(function (g) { if (by[g].n && by[g].done === by[g].n && Number(g) > best) best = Number(g); });
  return best;
}
/* when a gameweek's last real game ended (ms): its last kickoff in Club Fixtures + 2h15; 0 when unknown */
function emtArtGwEndMs(gw) {
  var best = 0;
  emtRows('Club Fixtures').forEach(function (r) { if (Number(r.GW) !== gw) return; var t = liveKickoffMs(r['Kickoff (UTC)']); if (t && t > best) best = t; });
  return best ? best + LIVE_MATCH_MS : 0;
}
/* the next gameweek whose deadline is still ahead: { gw, dl } or null */
function emtArtNextDeadline(now) {
  var best = null;
  emtRows('Matchweeks').forEach(function (w) { var g = Number(w.GW), t = aiTs(w['Deadline (UTC)']); if (g > 0 && t > now && (!best || t < best.dl)) best = { gw: g, dl: t }; });
  return best;
}

/* ---------- 1. the recap facts, from the app ---------- */
function emtArtFacts(team, req) {
  var gw = Number(req.gw);
  if (String(req.kind || '') !== 'recap') return { ok: false, error: 'badkind' };
  if (!(gw > 0)) return { ok: false, error: 'badgw' };
  var h2h = emtRows('H2H Fixtures'), real = h2h.filter(function (r) { return Number(r.GW) === gw; });
  if (!real.length || real.some(function (r) { return !emtTrue(r.Finished); })) return { ok: false, error: 'notdone' };
  if (gw !== emtArtRecapGw(h2h)) return { ok: false, error: 'closed' };    /* only the latest finished gameweek */
  var raw = req.facts;
  if (raw && typeof raw === 'object') raw = JSON.stringify(raw);
  if (typeof raw !== 'string' || !raw || raw.length > EMT_FACTS_MAX) return { ok: false, error: 'badfacts' };
  var f;
  try { f = JSON.parse(raw); } catch (e) { return { ok: false, error: 'badfacts' }; }
  var bad = emtArtFactsCheck(f, gw, h2h);                                            /* v3.15: shared with the repo's facts */
  if (bad) return { ok: false, error: bad };
  var cache = CacheService.getScriptCache(), rk = 'EMT_RF_' + team;
  if (cache.get(rk)) return { ok: false, error: 'slow' };
  var data = JSON.stringify(f);
  if (data.length > EMT_FACTS_MAX) return { ok: false, error: 'badfacts' };
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (cache.get(rk)) return { ok: false, error: 'slow' };
    var st = emtFactsStore('RecapFacts', gw, team, data);
    cache.put(rk, '1', EMT_FACTS_EVERY_S);
    return { ok: true, at: st.at, parts: st.parts };
  } finally { lock.releaseLock(); }
}

/* '' when recap facts are what the sheet says, else the error emtArtFacts answers: an object of kind recap for this
 * gameweek, every H2H row of it Finished, the latest finished gameweek, exactly its fixtures with exactly its scores */
function emtArtFactsCheck(f, gw, h2h) {
  if (!f || typeof f !== 'object' || Array.isArray(f)) return 'badfacts';
  if (f.kind !== undefined && f.kind !== 'recap') return 'badkind';
  if (f.gw !== undefined && f.gw !== null && f.gw !== '' && Number(f.gw) !== gw) return 'badfacts';
  var real = h2h.filter(function (r) { return Number(r.GW) === gw; });
  if (!real.length || real.some(function (r) { return !emtTrue(r.Finished); })) return 'notdone';
  if (gw !== emtArtRecapGw(h2h)) return 'closed';                                   /* only the latest finished gameweek */
  /* exactly the gameweek's fixtures, then exactly its scores */
  var fx = f.fixtures, seen = {}, pairs = [];
  if (!Array.isArray(fx) || fx.length !== real.length) return 'fixtures';
  for (var i = 0; i < fx.length; i++) {
    var x = fx[i];
    if (!x || typeof x !== 'object' || typeof x.home !== 'string' || typeof x.away !== 'string') return 'fixtures';
    var k = x.home + '|' + x.away, r = real.filter(function (z) { return String(z.Home) + '|' + String(z.Away) === k; })[0];
    if (!r || seen[k]) return 'fixtures';
    seen[k] = 1; pairs.push([x, r]);
  }
  for (var j = 0; j < pairs.length; j++) {
    if (!emtSameNum(pairs[j][0].hs, pairs[j][1]['Home pts']) || !emtSameNum(pairs[j][0].as, pairs[j][1]['Away pts'])) return 'scores';
  }
  return '';
}

/* ---------- the Articles tab ---------- */
/* the Note cell: 'j:' + { s: <the note, sealed>, redos, at, pend } (or { text } as written by hand). v3.14: pend is
 * 'writing' while a rewrite of the live article is under way (the live version stays up meanwhile) and 'failed' when
 * that rewrite failed (the live version stayed); '' otherwise */
function emtArtNote(v) {
  var s = emtUnq(v);
  if (s.indexOf(EMT_JSON_MARK) === 0) {
    try {
      var j = JSON.parse(s.slice(EMT_JSON_MARK.length));
      if (j && typeof j === 'object') {
        var t = String(j.text || '');
        if (j.s) { var o = emtArtOpen(j.s); try { t = o === null ? '' : String(JSON.parse(o)); } catch (e) { t = ''; } }
        return { text: t, redos: Number(j.redos) || 0, at: String(j.at || ''), pend: String(j.pend || '') };
      }
    } catch (e) { }
  }
  return { text: s, redos: 0, at: '', pend: '' };
}
/* v3.14: the Note cell with some of its keys changed (a value of '' removes the key); the sealed note, redos and at
 * are kept as they are. A note written by hand becomes { text }. → the new cell value */
function emtArtNoteSet(v, patch) {
  var s = emtUnq(v), j = null;
  if (s.indexOf(EMT_JSON_MARK) === 0) { try { j = JSON.parse(s.slice(EMT_JSON_MARK.length)); } catch (e) { j = null; } }
  if (!j || typeof j !== 'object' || Array.isArray(j)) j = s ? { text: s } : {};
  Object.keys(patch || {}).forEach(function (k) { if (patch[k] === '' || patch[k] == null) delete j[k]; else j[k] = patch[k]; });
  return EMT_JSON_MARK + JSON.stringify(j);
}
/* v3.14: a live article with a rewrite under way (m: an emtArtMeta row) */
function emtArtLiveRw(m) { return !!(m && m.status === 'live' && m.pend === 'writing'); }
/* an article a job may work on: researching, writing, or (v3.14) live with a rewrite under way */
function emtArtActive(m) { return !!(m && (EMT_ART_ACTIVE.indexOf(m.status) > -1 || emtArtLiveRw(m))); }
/* v3.14: the cells that make an article live, shared by the commissioner's approve, the automatic publish and the swap
 * after a rewrite of a live article: status live and the article as plain 'j:' json (?articles and ?article read it
 * without the key). approvedAt (ISO) sets Approved (UTC), the first publish (the swap keeps it); more: other cells */
function emtArtLiveFields(art, approvedAt, more) {
  var f = { status: 'live', article: EMT_JSON_MARK + JSON.stringify(art) };
  if (approvedAt) f.approved = "'" + approvedAt;
  Object.keys(more || {}).forEach(function (k) { f[k] = more[k]; });
  return f;
}
/* v3.14: was the version now live published without a manual approval? (the newest publish line in the Log) */
function emtArtAuto(log) {
  var l = String(log || '').split('\n').filter(function (x) { return / approved by |Published automatically|replaced the live one/.test(x); }).pop() || '';
  return !!l && !/ approved by /.test(l);
}
/* the time of the newest Log line (ms) and its text without the time */
function emtArtLogAt(log) { var l = String(log || '').split('\n').filter(Boolean), m = l.length ? /^(\S+)/.exec(l[l.length - 1]) : null; return m ? aiTs(m[1]) : 0; }
function emtArtLogLast(log) { var l = String(log || '').split('\n').filter(Boolean); return l.length ? l[l.length - 1].replace(/^\S+\s+/, '') : ''; }

/* every row's metadata, without Research and Article (two narrow reads) */
function emtArtMeta() {
  var sh = SpreadsheetApp.getActive().getSheetByName('Articles'), last = sh ? sh.getLastRow() : 0;
  if (last < 2) return [];
  var a = sh.getRange(2, 1, last - 1, 7).getValues(), b = sh.getRange(2, 10, last - 1, 3).getValues(), out = [];
  a.forEach(function (r, i) {
    var id = emtUnq(r[0]);
    if (!id) return;
    var note = emtArtNote(b[i][0]), log = emtUnq(b[i][2]);
    out.push({ row: i + 2, id: id, gw: Number(r[1]) || 0, kind: emtUnq(r[2]), status: emtUnq(r[3]), written: emtUnq(r[4]), model: emtUnq(r[5]),
      factsAt: emtUnq(r[6]), note: note.text, redos: note.redos, pend: note.pend, approved: emtUnq(b[i][1]), log: log, since: emtArtLogAt(log),
      failedBy: (/\[Code\.gs (v[\d.]+)\]\s*$/.exec(emtArtLogLast(log)) || [])[1] || '' });   /* v3.20: the version a failed article failed under ('' before v3.20) */
  });
  return out;
}
function emtArtFind(id, meta) { meta = meta || emtArtMeta(); for (var i = 0; i < meta.length; i++) if (meta[i].id === id) return meta[i]; return null; }
function emtArtCell(row, col) { var sh = SpreadsheetApp.getActive().getSheetByName('Articles'); return sh ? sh.getRange(row, col, 1, 1).getValues()[0][0] : ''; }
/* the Article cell: 'j:' + json once live, sealed ('s:') before that */
function emtArtArticle(v) {
  var s = emtUnq(v), js = null;
  if (s.indexOf(EMT_JSON_MARK) === 0) js = s.slice(EMT_JSON_MARK.length);
  else if (s.indexOf(EMT_SEAL_MARK) === 0) js = emtArtOpen(s);
  if (js === null) return null;
  try { var j = JSON.parse(js); return j && typeof j === 'object' && !Array.isArray(j) ? j : null; } catch (e) { return null; }
}
function emtArtResearchText(v) { var s = emtUnq(v); return s.indexOf(EMT_TEXT_MARK) === 0 ? s.slice(EMT_TEXT_MARK.length) : ''; }

/* change one row, found by id: fields (status, written, model, factsAt, research, article, note, approved) are cell
 * values; logLine is appended to Log. onlyIf: the statuses the row must be in, else nothing changes. run (a job's
 * run token): when given, nothing changes if another job, or a newer run of this article, is in EMT_ART_JOB.
 * The Log never keeps draft text: quoted fragments of 24 characters or more become "..." (the Articles tab is
 * hidden, not private). → { row, was } | { missing } | { skipped: status } */
function emtArtUpdate(id, fields, logLine, onlyIf, run) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try { return emtArtUpdateLocked(id, fields, logLine, onlyIf, run); } finally { lock.releaseLock(); }
}
function emtArtUpdateLocked(id, fields, logLine, onlyIf, run) {
  var sh = SpreadsheetApp.getActive().getSheetByName('Articles'), last = sh ? sh.getLastRow() : 0;
  if (last < 2) return { missing: true };
  var ids = sh.getRange(2, 1, last - 1, 1).getValues(), row = 0;
  for (var i = 0; i < ids.length; i++) if (emtUnq(ids[i][0]) === id) { row = i + 2; break; }
  if (!row) return { missing: true };
  var status = emtUnq(sh.getRange(row, EMT_ART_COL.status, 1, 1).getValues()[0][0]);
  if (onlyIf && onlyIf.indexOf(status) < 0) return { skipped: status, row: row };
  if (run !== undefined && emtArtStale({ id: id, run: run })) return { skipped: 'stale', row: row };
  Object.keys(fields || {}).forEach(function (k) { if (EMT_ART_COL[k]) sh.getRange(row, EMT_ART_COL[k], 1, 1).setValues([[fields[k]]]); });
  if (logLine) {
    var cur = emtUnq(sh.getRange(row, EMT_ART_COL.log, 1, 1).getValues()[0][0]);
    var line = new Date().toISOString() + ' ' + ((fields && fields.status) || status) + ': ' + emtArtRedact(logLine).slice(0, 1500);
    var all = (cur ? cur + '\n' : '') + line;
    if (all.length > EMT_ART_LOG_MAX) all = all.slice(all.length - EMT_ART_LOG_MAX).replace(/^[^\n]*\n/, '');
    sh.getRange(row, EMT_ART_COL.log, 1, 1).setValues([["'" + all]]);
  }
  emtArtTouch();
  return { row: row, was: status };
}

/* ---------- the job (EMT_ART_JOB) and the rewrite queue (EMT_ART_QUEUE) ---------- */
function emtArtJob() {
  try { var j = JSON.parse(emtProps().getProperty('EMT_ART_JOB') || 'null'); return j && typeof j === 'object' && j.id ? j : null; } catch (e) { return null; }
}
function emtArtQueue() {
  try { var q = JSON.parse(emtProps().getProperty('EMT_ART_QUEUE') || '[]'); return Array.isArray(q) ? q.map(String) : []; } catch (e) { return []; }
}
function emtArtSetQueue(q) { if (q.length) emtProps().setProperty('EMT_ART_QUEUE', JSON.stringify(q.slice(-10))); else emtProps().deleteProperty('EMT_ART_QUEUE'); }
/* is this job object stale: another job, or a newer run of the same article (dropped, then a rewrite asked for while
 * this run was working), is the one in EMT_ART_JOB now? No stored job at all is not stale (its state was lost). */
function emtArtStale(job) {
  var cur = emtArtJob();
  return !!(cur && (cur.id !== job.id || String(cur.run || '') !== String(job.run || '')));
}
/* save the job, unless its article stopped being worked on meanwhile (the commissioner dropped it) or a newer run took
 * over: then this run's job is forgotten → false */
function emtArtJobPut(job) {
  var lock = LockService.getScriptLock(), ok = false, mine = false;
  lock.waitLock(10000);
  try {
    var m = emtArtFind(job.id), p = emtProps(), stale = emtArtStale(job);
    mine = !stale;
    if (emtArtActive(m) && !stale) { p.setProperty('EMT_ART_JOB', JSON.stringify(job)); ok = true; }
    else if (!stale && emtArtJob()) p.deleteProperty('EMT_ART_JOB');
  } finally { lock.releaseLock(); }
  if (!ok && mine) emtWorkClear(job.id);   /* a newer run of the same article keeps its files */
  return ok;
}
/* the job is over: forget it (only this run of it) and delete its files */
function emtArtJobEnd(id, run) {
  var lock = LockService.getScriptLock(), mine = true;
  lock.waitLock(10000);
  try {
    var cur = emtArtJob();
    if (cur && cur.id === id) {
      if (run === undefined || String(cur.run || '') === String(run || '')) emtProps().deleteProperty('EMT_ART_JOB'); else mine = false;
    }
  } finally { lock.releaseLock(); }
  if (mine) emtWorkClear(id);
}

/* ---------- ArticleWork: a job's working files, 45,000-character chunks marked 'j:' ---------- */
function emtWorkPut(id, key, str) {
  var sh = emtHiddenSheet('ArticleWork', EMT_WORK_HEAD), lock = LockService.getScriptLock();
  str = String(str);
  lock.waitLock(10000);
  try {
    var last = sh.getLastRow(), old = [];
    if (last > 1) sh.getRange(2, 1, last - 1, 2).getValues().forEach(function (r, i) { if (emtUnq(r[0]) === id && String(r[1]) === key) old.push(i + 2); });
    emtShowDeleteRows(sh, old);
    var at = "'" + new Date().toISOString(), n = Math.max(1, Math.ceil(str.length / EMT_SHOW_CHUNK));
    for (var q = 0; q < n; q++) sh.appendRow([emtCell(id), key, q + 1, n, EMT_JSON_MARK + str.slice(q * EMT_SHOW_CHUNK, (q + 1) * EMT_SHOW_CHUNK), at]);
  } finally { lock.releaseLock(); }
}
/* a file's text, or null: four narrow columns find its rows, then only those Data cells are read */
function emtWorkGet(id, key) {
  var sh = SpreadsheetApp.getActive().getSheetByName('ArticleWork'), last = sh ? sh.getLastRow() : 0;
  if (last < 2) return null;
  var rows = [], n = 0, got = 0, parts = [];
  sh.getRange(2, 1, last - 1, 4).getValues().forEach(function (r, i) {
    if (emtUnq(r[0]) !== id || String(r[1]) !== key) return;
    n = Number(r[3]) || 0; rows[Number(r[2]) - 1] = i + 2; got++;
  });
  if (!n || got !== n) return null;
  for (var q = 0; q < n; q++) {
    if (!rows[q]) return null;
    var d = String(sh.getRange(rows[q], 5, 1, 1).getValues()[0][0]);
    if (d.indexOf(EMT_JSON_MARK) !== 0) return null;
    parts.push(d.slice(EMT_JSON_MARK.length));
  }
  return parts.join('');
}
function emtWorkJson(id, key) { var s = emtWorkGet(id, key); if (s === null) return null; try { return JSON.parse(s); } catch (e) { return null; } }
/* delete a job's files (keys: only those; id '': every file) */
function emtWorkClear(id, keys) {
  var sh = SpreadsheetApp.getActive().getSheetByName('ArticleWork'), last = sh ? sh.getLastRow() : 0;
  if (last < 2) return;
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    last = sh.getLastRow();
    if (last < 2) return;
    var rows = [];
    sh.getRange(2, 1, last - 1, 2).getValues().forEach(function (r, i) { if ((!id || emtUnq(r[0]) === id) && (!keys || keys.indexOf(String(r[1])) > -1)) rows.push(i + 2); });
    emtShowDeleteRows(sh, rows);
  } finally { lock.releaseLock(); }
}

/* ---------- the Message Batches API ---------- */
function emtArtApi(method, url, body) {
  var o = { method: method, contentType: 'application/json', muteHttpExceptions: true, headers: { 'x-api-key': emtAiKey(), 'anthropic-version': '2023-06-01' } };
  if (body) o.payload = JSON.stringify(body);
  var r = { code: 0, text: '', json: null };
  try {
    var res = UrlFetchApp.fetch(url, o);
    r.code = res.getResponseCode(); r.text = String(res.getContentText() || '');
  } catch (e) { r.text = String((e && e.message) || e); return r; }
  try { r.json = JSON.parse(r.text); } catch (e) { r.json = null; }
  return r;
}
function emtArtCancel(batch) { if (batch) { try { emtArtApi('post', EMT_ART_BATCHES + '/' + encodeURIComponent(batch) + '/cancel'); } catch (e) { } } }
function emtArtSearchOff(type, msg) { return /web.?search/i.test(String(msg || '')) && (!type || type === 'invalid_request_error' || type === 'permission_error'); }
/* v3.13: a phase's request id and model chain. research '-r' and write '-w' on the article chain (EMT_ARTICLE_MODEL);
 * punch '-p' on the punch-up chain (EMT_PUNCH_MODEL, then EMT_PUNCH_MODELS) */
function emtArtCid(job) { return job.id + (job.phase === 'research' ? '-r' : job.phase === 'punch' ? '-p' : '-w'); }
function emtArtChain(phase) { return phase === 'punch' ? emtModelChain('EMT_PUNCH_MODEL', EMT_PUNCH_MODELS) : emtModelChain('EMT_ARTICLE_MODEL', EMT_ART_MODELS); }
/* the next model in the phase's chain after one that turned out to be gone ('' when none is left) */
function emtArtModelAfter(cur, phase) {
  var c = emtArtChain(phase), g = emtModelGoneMap();
  return c.slice(c.indexOf(cur) + 1).filter(function (m) { return !emtModelIsGone(g, m); })[0] || '';
}
/* one batch with one request, built per model by build(model).
 * → { batch, model } | { wait } (never reached Claude: not counted) | { searchOff } | { missing } | { bad } */
function emtArtCreate(job, build) {
  var models = emtModelsLive(emtArtChain(job.phase)), i = Math.max(0, models.indexOf(job.model));
  for (; i < models.length; i++) {
    var r = emtArtApi('post', EMT_ART_BATCHES, { requests: [{ custom_id: emtArtCid(job), params: build(models[i]) }] });
    if (r.code === 200 && r.json && r.json.id) return { batch: String(r.json.id), model: models[i] };
    var er = emtApiErr(r.json || r.text);
    if (emtParamRefused(r.code, er.msg)) {                                        /* v3.20: once more without thinking or effort */
      var p2 = build(models[i]); delete p2.thinking; delete p2.output_config;
      emtArtSay(job, models[i] + ' refused a parameter (' + er.msg.slice(0, 100) + '); asking again without it.');
      r = emtArtApi('post', EMT_ART_BATCHES, { requests: [{ custom_id: emtArtCid(job), params: p2 }] });
      if (r.code === 200 && r.json && r.json.id) return { batch: String(r.json.id), model: models[i] };
      er = emtApiErr(r.json || r.text);
    }
    /* web search off for the organisation can come back as a 400 or as a 403 permission_error: either way the article
     * is written from the league data (checked before the 401/403 wait, which would otherwise hold it for 36 hours) */
    if (r.code && r.code !== 429 && r.code < 500 && job.phase === 'research' && emtArtSearchOff(er.type, er.msg)) return { searchOff: er.msg };
    if (!r.code || r.code === 429 || r.code >= 500 || r.code === 401 || r.code === 403) return { wait: 'the Batches API answered ' + (r.code || 'nothing') + (er.msg ? ': ' + er.msg.slice(0, 160) : '') };
    if (emtModelMissing(r.code, er.type, er.msg)) { emtModelNoteGone(models[i], er.msg); continue; }
    return { bad: 'the Batches API refused the request (HTTP ' + r.code + '): ' + er.msg.slice(0, 200) };
  }
  return { missing: 'no model in the chain is available (' + models.join(', ') + ')' };
}
/* → { pending } | { wait } | { lost } | { result } */
function emtArtPoll(job) {
  var r = emtArtApi('get', EMT_ART_BATCHES + '/' + encodeURIComponent(job.batch));
  if (r.code === 404) return { lost: 'the batch ' + job.batch + ' is gone (404)' };
  if (r.code !== 200 || !r.json) return { wait: 'checking the batch answered ' + (r.code || 'nothing') };
  if (r.json.processing_status !== 'ended') return { pending: String(r.json.processing_status || 'in_progress') };
  var g = emtArtApi('get', r.json.results_url || (EMT_ART_BATCHES + '/' + encodeURIComponent(job.batch) + '/results'));
  if (g.code !== 200) return { wait: 'reading the batch results answered ' + (g.code || 'nothing') };
  var want = emtArtCid(job), hit = null;
  g.text.split('\n').forEach(function (l) {
    if (hit || !l.trim()) return;
    try { var o = JSON.parse(l); if (o && o.custom_id === want) hit = o; } catch (e) { }
  });
  if (!hit || !hit.result) return { lost: 'the batch results have no line for ' + want };
  return { result: hit.result };
}
function emtArtTexts(content) {
  return (content || []).filter(function (c) { return c && c.type === 'text'; }).map(function (c) { return String(c.text || ''); }).join('');
}

/* ---------- 2. the research ---------- */
function emtArtResearchSystem(kind) {
  return [
    'You research the real football behind an article for Matchweek, the app of a private FPL Draft (fantasy Premier League) league. Search the web and write research notes in plain text. A writer will use only what is in your notes, so be complete and exact, and never guess.',
    '',
    kind === 'recap'
      ? 'WHAT TO FIND. For every game in PREMIER LEAGUE RESULTS: how it happened. Every scorer and how the goal came about, the assists, red cards, missed or saved penalties, VAR decisions, injuries during the game, and what the managers said afterwards. Then how the KEY PLAYERS earned their points, and for the PLAYERS TO CHECK why they started on the bench or did not play (injury, illness, suspension, rotation, a transfer) and when they are expected back.'
      : 'WHAT TO FIND. For every game in THE SLATE: team news and what the managers said at the pre-match press conferences. For every FLAGGED PLAYER: the latest on the injury or doubt and whether he is expected to play. Then any transfer story or manager saga that touches a ROSTERED PLAYER (a move, a contract stand-off, a manager under pressure).',
    '',
    'DATE-CHECK EVERYTHING. Use only reports about the dates given; ignore last season, other competitions and stale previews. When reports disagree or are unclear, say so.',
    '',
    'FORMAT. Notes grouped by game (Home v Away), one fact per line, each line ending with its source name in brackets, for example: Saka scored the opener from a Rice corner (BBC Sport). Numbers as digits. Quote people only word for word, in double quotes. No opinions, no padding, no markdown, no em dashes.',
    'End with a line that says SOURCES: and then one line per source you used, as: name | url (the exact url you read).'
  ].join('\n');
}
/* the trimmed facts the research needs: the real games, the players to explain or check, the flags */
function emtArtResearchUser(job, f) {
  f = f && typeof f === 'object' ? f : {};
  var L = [], today = new Date().toISOString().slice(0, 10), seen = {};
  var who = function (p) { return String((p && p.name) || '?') + (p && p.club ? ' (' + p.club + ')' : ''); };
  var once = function (arr, line) { if (!seen[line]) { seen[line] = 1; arr.push(line); } };
  var span = function (games) {
    var t = games.map(function (g) { return aiTs(g && g.ko); }).filter(Boolean).sort(function (a, b) { return a - b; });
    return t.length ? ' Its Premier League games ' + (job.kind === 'recap' ? 'were played' : 'are') + ' from ' + emtIso(t[0]).slice(0, 10) + ' to ' + emtIso(t[t.length - 1]).slice(0, 10) + '.' : '';
  };
  if (job.kind === 'recap') {
    var pl = Array.isArray(f.pl) ? f.pl : [], key = [], check = [];
    L.push('THE RECAP OF GAMEWEEK ' + job.gw + '. Today is ' + today + '.' + span(pl), '', 'PREMIER LEAGUE RESULTS:');
    pl.forEach(function (g) {
      if (!g) return;
      /* a game without a result in the league data (postponed, abandoned, not played yet) is named, never "undefined-undefined" */
      var res = emtSameNum(g.hs, Number(g.hs)) && emtSameNum(g.as, Number(g.as));
      L.push('- ' + (res ? g.home + ' ' + g.hs + '-' + g.as + ' ' + g.away : g.home + ' v ' + g.away + ' (no result in the league data: postponed or not played; check)') + (g.ko ? ' (kick-off ' + g.ko + ')' : ''));
    });
    if (!pl.length) L.push('- (none listed)');
    (Array.isArray(f.fixtures) ? f.fixtures : []).forEach(function (x) {
      ['H', 'A'].forEach(function (k) {
        var s = x && x[k]; if (!s) return;
        (s.xi || []).forEach(function (p) {
          if (!p) return;
          var mins = Number(p.mins) || 0, pts = Number(p.pts) || 0;
          if (!mins) once(check, '- ' + who(p) + ': did not play');
          else if (mins < 45) once(check, '- ' + who(p) + ': played ' + mins + ' minutes');
          if (mins && pts >= 6) key.push({ pts: pts, line: '- ' + who(p) + ': ' + pts + ' points' + (p.g ? ', ' + p.g + ' goal' + (p.g > 1 ? 's' : '') : '') + (p.a ? ', ' + p.a + ' assist' + (p.a > 1 ? 's' : '') : '') + (p.cs ? ', a clean sheet' : '') });
        });
        (s.bench || []).forEach(function (p) { if (p && !(Number(p.mins) > 0)) once(check, '- ' + who(p) + ': did not play (on a fantasy bench)'); });
      });
    });
    key.sort(function (a, b) { return b.pts - a.pts; });
    L.push('', 'KEY PLAYERS (explain how they got their points):');
    if (key.length) key.slice(0, 14).forEach(function (k) { once(L, k.line); }); else L.push('- (none)');
    L.push('', 'PLAYERS TO CHECK (rostered in the league; why did they start on the bench or not play?):');
    if (check.length) L.push.apply(L, check.slice(0, 25)); else L.push('- (none)');
  } else {
    var slate = Array.isArray(f.slate) ? f.slate : [], flags = [], byClub = {}, dl = aiTs(f.deadline);
    L.push('THE PREVIEW OF GAMEWEEK ' + job.gw + '. Today is ' + today + '.' + (dl ? ' The deadline is ' + emtIso(dl) + '.' : '') + span(slate), '', 'THE SLATE:');
    slate.forEach(function (g) { if (g) L.push('- ' + g.home + ' v ' + g.away + (g.ko ? ' (kick-off ' + g.ko + ')' : '')); });
    if (!slate.length) L.push('- (none listed)');
    (Array.isArray(f.fixtures) ? f.fixtures : []).forEach(function (x) {
      ['H', 'A'].forEach(function (k) {
        var s = x && x[k]; if (!s) return;
        (s.xi || []).concat(s.bench || []).forEach(function (p) {
          if (p && emtArtFlagged(p)) once(flags, '- ' + who(p) + ': ' + [p.chance !== '' && p.chance != null ? p.chance + '%' : '', String(p.news || '').trim() || 'status ' + p.status].filter(Boolean).join(', '));
        });
      });
    });
    L.push('', 'FLAGGED PLAYERS (rostered, with an injury or availability flag):');
    if (flags.length) L.push.apply(L, flags.slice(0, 30)); else L.push('- (none)');
    var ros = f.rosters && typeof f.rosters === 'object' ? f.rosters : {};
    Object.keys(ros).forEach(function (t) {
      (Array.isArray(ros[t]) ? ros[t] : []).forEach(function (e) {
        var m = /^(.*?)\s*\(([^)]+)\)\s*$/.exec(String(e)), nm = m ? m[1] : String(e), club = m ? m[2] : '?';
        (byClub[club] = byClub[club] || []).push(nm);
      });
    });
    L.push('', 'ROSTERED PLAYERS BY CLUB (look for transfer stories and manager sagas that touch them):');
    var clubs = Object.keys(byClub).sort();
    if (clubs.length) clubs.forEach(function (c) { L.push('- ' + c + ': ' + byClub[c].join(', ')); }); else L.push('- (none listed)');
  }
  L.push('', 'WRITE the research notes.');
  return L.join('\n');
}
function emtArtResearchParams(job, facts, model, cont) {
  var msgs = [{ role: 'user', content: emtArtResearchUser(job, facts) }];
  if (cont && cont.length) msgs.push({ role: 'assistant', content: cont });   /* pause_turn: the paused turn, unchanged */
  return { model: model, max_tokens: EMT_ART_RESEARCH_MAX_TOKENS, system: emtArtResearchSystem(job.kind),   /* v3.20: room for the model's thinking */
    tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 10 }], messages: msgs };
}
function emtArtUrlKey(u) { return String(u || '').trim().replace(/#.*$/, '').replace(/\/+$/, '').toLowerCase(); }
function emtArtSrcName(title, url) { var h = /^https?:\/\/(?:www\.)?([^\/?#]+)/i.exec(String(url || '')); return emtClean(title, 80) || (h ? h[1] : 'source'); }
/* the research notes from the model's content: every text block joined (citations split them), then the SOURCES
 * list rebuilt from the urls web search really returned (or cited). → { text, sources, searched } */
function emtArtResearch(content) {
  var text = '', real = {}, cited = [];
  (content || []).forEach(function (c) {
    if (!c) return;
    if (c.type === 'text') {
      text += String(c.text || '');
      (Array.isArray(c.citations) ? c.citations : []).forEach(function (z) { if (z && z.url) { real[emtArtUrlKey(z.url)] = 1; cited.push({ name: emtArtSrcName('', z.url), url: String(z.url) }); } });
    } else if (c.type === 'web_search_tool_result' && Array.isArray(c.content)) {
      c.content.forEach(function (z) { if (z && z.url) real[emtArtUrlKey(z.url)] = 1; });
    }
  });
  text = text.replace(/\r/g, '');
  var re = /(?:^|\n)[ \t*#]*SOURCES[ \t*]*:/gi, mm, at = -1, end = -1;
  while ((mm = re.exec(text))) { at = mm.index; end = re.lastIndex; }
  var notes = at > -1 ? text.slice(0, at) : text, list = [], keys = {};
  var add = function (name, url) {
    url = String(url || '').replace(/[.,;]+$/, '');
    var k = emtArtUrlKey(url);
    if (!url || url.length > EMT_ART_URL_MAX || keys[k] || !real[k]) return;   /* a url over 400 characters is left out */
    /* the name as the article may show it: no pipe, no dash, no emoji */
    name = emtClean(name, 80).replace(/\|/g, '/').replace(/\s*[\u2014\u2013]\s*/g, ' - ').replace(new RegExp(EMT_EMOJI.source, 'gu'), '').trim() || emtArtSrcName('', url);
    keys[k] = 1; list.push(name + ' | ' + url);
  };
  if (at > -1) text.slice(end).split('\n').forEach(function (l) {
    var u = /(https?:\/\/[^\s)\]>|]+)/.exec(l);
    if (!u) return;
    var nm = l.slice(0, u.index).replace(/^[\s\-*\d.)]+/, '').replace(/[\s|:\-]+$/, '').trim();
    add(nm || emtArtSrcName('', u[1]), u[1]);
  });
  cited.forEach(function (c) { add(c.name, c.url); });
  list = list.slice(0, 40);
  var tail = list.length ? '\n\nSOURCES:\n' + list.join('\n') : '';
  notes = notes.replace(/[\s\-*#]+$/, '').trim();
  if (notes.length + tail.length > EMT_ART_RESEARCH_MAX) notes = notes.slice(0, EMT_ART_RESEARCH_MAX - tail.length - 20).replace(/\s+\S*$/, '') + ' [cut]';
  return { text: notes ? notes + tail : tail.replace(/^\s+/, ''), sources: list.length, searched: Object.keys(real).length };
}
/* v3.23: the research step's log line (BUGS #28). R from emtArtResearch, the batch message's stop_reason and the
 * continuations allowed. A reply the token budget ended (stop_reason max_tokens) names the budget: the notes end where
 * the model stopped, and with no notes at all the article is written from the league data alone, which the log now says. */
function emtArtResearchLog(R, stop, conts) {
  var n = String((R || {}).text || '').length, k = Number((R || {}).sources) || 0;
  var s = 'research done: ' + n + ' characters, ' + k + ' source' + (k === 1 ? '' : 's');
  if (stop === 'max_tokens') s += n ? ' (cut off at the budget of ' + EMT_ART_RESEARCH_MAX_TOKENS + ' tokens, thinking included; the notes end where the model stopped)'
    : ' (the model used its whole budget of ' + EMT_ART_RESEARCH_MAX_TOKENS + ' tokens, thinking included, before writing any notes; the article is written from the league data alone)';
  else if (stop === 'pause_turn') s += ' (still paused after ' + conts + ' continuations; kept what it had)';
  else if (!n) s += ' (the model searched but wrote no notes; the article is written from the league data alone)';
  return s + '.';
}
/* the urls of the SOURCES list at the end of stored research notes (as keys) */
function emtArtSourceUrls(research) {
  var s = String(research || ''), i = s.lastIndexOf('SOURCES:\n'), out = [];
  if (i < 0 || (i > 0 && s.charAt(i - 1) !== '\n')) return out;
  s.slice(i + 9).split('\n').forEach(function (l) { var u = /\|\s*(https?:\/\/\S+)\s*$/.exec(l); if (u) { var k = emtArtUrlKey(u[1]); if (out.indexOf(k) < 0) out.push(k); } });
  return out;
}

/* ---------- 3. the writing ---------- */
/* the facts as sent: decimals to one place, as the show writer does; dashes in text as hyphens (the app writes
 * formations like 3\u20135\u20132, and the article must not copy an en dash) */
function emtArtSent(facts) {
  return JSON.stringify(facts, function (k, v) {
    if (typeof v === 'number' && isFinite(v) && v % 1 !== 0) return Math.round(v * 10) / 10;
    return typeof v === 'string' ? v.replace(/[\u2013\u2014]/g, '-') : v;
  });
}
function emtArtFlagged(p) {
  var st = String(p.status == null || p.status === '' ? 'a' : p.status).toLowerCase(), ch = p.chance;
  return st !== 'a' || !!String(p.news || '').trim() || (ch !== '' && ch !== null && ch !== undefined && isFinite(Number(ch)) && Number(ch) < 100);
}
function emtArtContract(kind, facts) {
  var rec = kind === 'recap', n = ((facts && facts.fixtures) || []).length, q = function (s) { return '"' + s + '"'; };
  var shape = { gw: Number(facts && facts.gw) || 0, kind: kind, title: '...', sub: '...', lede: '...',
    matchups: [{ home: '<exact home team>', away: '<exact away team>', kicker: '...', star: { code: '<player code>', label: EMT_ART_LABELS[kind][0] },
      story: '...', bullets: ['...', '...', '...'], number: { value: '<a number from FACTS>', caption: '...' } }],
    around: [{ h: EMT_ART_AROUND[kind][0], body: '...', bullets: ['...'] }], sources: [{ name: '...', url: 'https://...' }], foot: EMT_ART_FOOT[kind] };
  return [
    'THE CONTRACT. Reply with one JSON object of exactly this shape:',
    JSON.stringify(shape),
    'Rules:',
    '- matchups: one per fixture in FACTS (' + n + ' in all), home and away spelt exactly as in FACTS.',
    '- title: one headline line, up to 20 words. sub: one line, up to 25 words. lede: 2 or 3 sentences that set up the week.',
    '- kicker: when the fixture has a derby name in FACTS, the kicker starts with it; otherwise 2 to 6 plain words.',
    rec ? '- star.code: the code of a player in that fixture\'s H.xi or A.xi (a bench player from H.bench or A.bench only with the label "The zero"). star.label: "Star of the match", or "The zero" for a memorable failure.'
      : '- star.code: the code of a player in that fixture\'s H.xi or A.xi. star.label: "Player to watch"; "The limbo" when the story is his doubt (he must carry a flag in FACTS: a status other than a, a chance or news); or "The zero".',
    rec ? '- story: 2 or 3 sentences: what happened and why, for someone who did not watch.' : '- story: 2 or 3 sentences built on who has who (the collisions in FACTS), looking ahead.',
    '- bullets: exactly 3 strings, one line each.',
    '- number.value: one number from FACTS, written as text (like "23", "4.5" or "61%"). number.caption: one line saying what it is.',
    '- around: 1 to 3 sections, each heading used once, from: ' + EMT_ART_AROUND[kind].map(q).join(', ') + '. body: one short paragraph. bullets: optional, up to 4 short lines.',
    rec ? '  Waiver watch names only players from "free" in FACTS (nobody owns them). Next up uses "next" in FACTS.'
      : '  The slate uses "slate" in FACTS. Transfer clock covers "moves" in FACTS and real transfer news from RESEARCH. Waiver wire names only players who are in no roster.',
    '- sources: 2 to 12 entries copied from the SOURCES list at the end of RESEARCH (name and url exactly as listed); [] when RESEARCH is empty.',
    '- foot: ' + q(EMT_ART_FOOT[kind]) + (rec ? ', then one more sentence only when FACTS shows a dispute.' : '.'),
    '- 600 to 1,400 words in all; aim for about 1,100.'
  ].join('\n');
}
function emtArtWriteUser(job, facts, sent, research, prev) {
  var u = [
    'ARTICLE: the ' + job.kind + ' of gameweek ' + job.gw + '.',
    '',
    'FACTS (the league\'s own data, from the app; the only source for league numbers):',
    sent,
    '',
    'RESEARCH (notes from web research on the real football, with SOURCES at the end):',
    research || '(none: the research came back empty. Write from FACTS alone, keep real-football detail to what FACTS shows, and leave "sources" empty.)',
    '',
    emtArtContract(job.kind, facts)
  ];
  if (job.redos) {
    /* v3.14: a rewrite of a live article starts from the published version */
    u.push('', 'A REWRITE. The commissioner read the ' + (job.live ? 'published article' : 'last draft') + ' and asks for a rewrite.' + (job.note ? ' His note: "' + job.note + '"' : ' He left no note.'));
    if (prev) u.push(job.live ? 'THE PUBLISHED VERSION:' : 'THE LAST DRAFT:', JSON.stringify(prev));
    u.push('Write the whole article again: apply the note and keep everything that was right.');
  }
  u.push('', 'WRITE the ' + job.kind + ' of gameweek ' + job.gw + '. JSON only.');
  return u.join('\n');
}
/* fix: { reply, problems } after a rejected reply: the reply goes back as the assistant turn with the problems */
function emtArtWriteParams(user, fix, model) {
  var msgs = [{ role: 'user', content: user }];
  if (fix && fix.problems && fix.problems.length) {
    var ask = 'Your article was rejected by the checks. Fix every problem below and send the whole article again, JSON only:\n- ' + fix.problems.slice(0, 25).join('\n- ');
    var reply = String(fix.reply || '').replace(/\s+$/, '');
    if (reply) msgs.push({ role: 'assistant', content: reply }, { role: 'user', content: ask });
    else msgs[0].content = user + '\n\n' + ask;
  }
  return { model: model, max_tokens: EMT_ART_WRITE_MAX_TOKENS, system: EMT_ART_SYSTEM, messages: msgs };   /* v3.20: room for the model's thinking */
}

/* every number the article may use (as a set): each number in the facts as sent and in the research (emtShowAllowed:
 * also rounded and without decimals, plus 0 to 10 and the margin of every "a-b"), 11, the years 2025 to 2027, and the
 * margin of every result in the facts (fixtures hs/as, pl hs/as) */
function emtArtAllowed(text, facts) {
  var ok = emtShowAllowed(text);
  ['11', '2025', '2026', '2027'].forEach(function (n) { ok[n] = 1; });
  var margin = function (x) { if (x && emtSameNum(x.hs, Number(x.hs)) && emtSameNum(x.as, Number(x.as))) ok[String(Math.abs(Number(x.hs) - Number(x.as)))] = 1; };
  ((facts && facts.fixtures) || []).forEach(margin);
  ((facts && facts.pl) || []).forEach(margin);
  return ok;
}
function emtArtNorm(s) {
  return String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[\u2018\u2019\u201B`]/g, "'").replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();
}
function emtArtReEsc(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

/* the reply, checked against the facts and the research. → { problems: [...], article: <clean json> | null, words }
 * extra: more text whose numbers are allowed (the commissioner's note) */
function emtArticleCheck(text, facts, research, kind, gw, sent, extra) {
  var P = [], s = String(text || ''), a = s.indexOf('{'), b = s.lastIndexOf('}'), j = null;
  if (a > -1 && b > a) { try { j = JSON.parse(s.slice(a, b + 1)); } catch (e) { j = null; } }
  if (!j || typeof j !== 'object' || Array.isArray(j)) return { problems: ['The reply was not one JSON object in the shape asked for (JSON only, no prose).'], article: null, words: 0 };
  facts = facts && typeof facts === 'object' ? facts : {};
  research = String(research || '');
  sent = typeof sent === 'string' ? sent : emtArtSent(facts);
  var rec = kind === 'recap', labels = EMT_ART_LABELS[kind] || [], heads = EMT_ART_AROUND[kind] || [];
  var T = function (v) { return typeof v === 'string' ? v.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim() : ''; };
  var W = function (t) { return t ? t.split(/\s+/).length : 0; };
  /* a label or heading in another case ("Star of the Match") is the allowed one, spelt as the app expects */
  var canon = function (v, list) { var n = String(v || '').toLowerCase(); for (var c = 0; c < list.length; c++) if (list[c].toLowerCase() === n) return list[c]; return v; };
  var span = function (t, where, lo, hi) { var n = W(t); if (!t) P.push(where + ' is empty.'); else if (n < lo || n > hi) P.push(where + ' has ' + n + ' words; it needs ' + lo + ' to ' + hi + '.'); };
  var out = { gw: gw, kind: kind };
  if (j.gw !== undefined && j.gw !== null && Number(j.gw) !== gw) P.push('"gw" must be ' + gw + '.');
  if (j.kind !== undefined && j.kind !== null && String(j.kind) !== kind) P.push('"kind" must be "' + kind + '".');
  out.title = T(j.title); span(out.title, '"title"', 3, 22);
  out.sub = T(j.sub); span(out.sub, '"sub"', 3, 30);
  out.lede = T(j.lede); span(out.lede, '"lede"', 15, 110);

  /* matchups: one per fixture, exact names; the star from the right eleven */
  var fx = Array.isArray(facts.fixtures) ? facts.fixtures : [], seen = {};
  out.matchups = [];
  (Array.isArray(j.matchups) ? j.matchups : []).forEach(function (m, i) {
    m = m && typeof m === 'object' ? m : {};
    var home = typeof m.home === 'string' ? m.home : '', away = typeof m.away === 'string' ? m.away : '', name = home + ' v ' + away;
    var f = fx.filter(function (x) { return x && x.home === home && x.away === away; })[0];
    if (!f) { P.push('Matchup ' + (i + 1) + ' (' + name + ') is not a fixture in FACTS: use the exact home and away team names.'); return; }
    if (seen[name]) { P.push(name + ' has more than one matchup.'); return; }
    seen[name] = 1;
    var o = { home: home, away: away, kicker: T(m.kicker) };
    if (!o.kicker) P.push(name + ': the kicker is empty.');
    else if (W(o.kicker) > 12) P.push(name + ': the kicker has ' + W(o.kicker) + ' words; keep it to a few.');
    if (f.derby && o.kicker && emtArtNorm(o.kicker).indexOf(emtArtNorm(f.derby)) !== 0) P.push(name + ': the kicker must start with the derby name, ' + f.derby + '.');
    var st = m.star && typeof m.star === 'object' ? m.star : {};
    o.star = { code: st.code === undefined || st.code === null ? '' : String(st.code).trim(), label: canon(T(st.label), labels) };
    if (labels.indexOf(o.star.label) < 0) P.push(name + ': star.label "' + o.star.label + '" must be one of: ' + labels.join(', ') + '.');
    var xi = [], bench = [];
    ['H', 'A'].forEach(function (k) { var sd = f[k] || {}; (sd.xi || []).forEach(function (p) { if (p) xi.push(p); }); (sd.bench || []).forEach(function (p) { if (p) bench.push(p); }); });
    var pick = function (list) { return list.filter(function (p) { return String(p.code) === o.star.code; })[0] || null; };
    var px = pick(xi), pb = pick(bench);
    if (!o.star.code) P.push(name + ': star.code is empty.');
    else if (!px && !(rec && pb && o.star.label === 'The zero')) P.push(name + ': star.code "' + o.star.code + '" is not a player in this matchup\'s XI' + (rec ? (pb ? ' (a bench player only with the label The zero)' : '') : '') + '.');
    if (o.star.label === 'The limbo' && px && !emtArtFlagged(px)) P.push(name + ': The limbo is for a doubt, and ' + (px.name || o.star.code) + ' carries no flag in FACTS.');
    o.story = T(m.story); span(o.story, name + ': the story', 20, 120);
    o.bullets = (Array.isArray(m.bullets) ? m.bullets : []).map(T);
    if (o.bullets.length !== 3 || o.bullets.some(function (x) { return !x; })) P.push(name + ': needs exactly 3 bullets, none empty.');
    o.bullets.forEach(function (x, k) { if (x && W(x) > 32) P.push(name + ': bullet ' + (k + 1) + ' has ' + W(x) + ' words; one line each.'); });
    var nb = m.number && typeof m.number === 'object' ? m.number : {};
    o.number = { value: T(typeof nb.value === 'number' ? String(nb.value) : nb.value), caption: T(nb.caption) };
    if (!o.number.value || !/\d/.test(o.number.value) || o.number.value.length > 14) P.push(name + ': number.value must be one number from FACTS, as short text.');
    span(o.number.caption, name + ': number.caption', 2, 30);
    out.matchups.push(o);
  });
  fx.forEach(function (x) { if (x && !seen[x.home + ' v ' + x.away]) P.push('Missing matchup: ' + x.home + ' v ' + x.away + '.'); });

  /* around */
  var ar = Array.isArray(j.around) ? j.around : [], hs = {};
  out.around = [];
  if (ar.length < 1 || ar.length > 4) P.push('"around" needs 1 to 4 sections (it has ' + ar.length + ').');
  ar.slice(0, 4).forEach(function (x, i) {
    x = x && typeof x === 'object' ? x : {};
    var o = { h: canon(T(x.h), heads), body: T(x.body) };
    if (heads.indexOf(o.h) < 0) P.push('around ' + (i + 1) + ': the heading "' + o.h + '" must be one of: ' + heads.join(', ') + '.');
    else if (hs[o.h]) P.push('around: "' + o.h + '" is used twice.');
    hs[o.h] = 1;
    span(o.body, 'around "' + o.h + '": the body', 12, 220);
    if (x.bullets !== undefined && x.bullets !== null) {
      var bl = (Array.isArray(x.bullets) ? x.bullets : []).map(T).filter(Boolean);
      if (!Array.isArray(x.bullets) || bl.length > 6) P.push('around "' + o.h + '": bullets must be a list of up to 6 short lines.');
      bl.forEach(function (y, k) { if (W(y) > 32) P.push('around "' + o.h + '": bullet ' + (k + 1) + ' has ' + W(y) + ' words; one line each.'); });
      if (bl.length) o.bullets = bl.slice(0, 6);
    }
    out.around.push(o);
  });

  /* sources: from the research's SOURCES list only */
  var okUrls = emtArtSourceUrls(research), src = Array.isArray(j.sources) ? j.sources : (j.sources === undefined || j.sources === null ? [] : null);
  out.sources = [];
  if (!src) P.push('"sources" must be a list.');
  else {
    src.forEach(function (x, i) {
      x = x && typeof x === 'object' ? x : {};
      var nm = T(x.name), url = typeof x.url === 'string' ? x.url.trim() : '';
      if (!nm || nm.length > 80 || !/^https?:\/\/\S+$/.test(url) || url.length > EMT_ART_URL_MAX) { P.push('sources ' + (i + 1) + ' needs a name and a full url (400 characters at most).'); return; }
      if (okUrls.indexOf(emtArtUrlKey(url)) < 0) { P.push('sources ' + (i + 1) + ' (' + url.slice(0, 100) + ') is not in the SOURCES list of RESEARCH: copy name and url from it.'); return; }
      out.sources.push({ name: nm, url: url });
    });
    if (src.length > 12) P.push('"sources" has ' + src.length + ' entries; 12 at most.');
    else if (okUrls.length >= 2 && src.length < 2) P.push('"sources" needs 2 to 12 entries from the SOURCES list of RESEARCH (it has ' + src.length + ').');
  }

  /* foot */
  out.foot = T(j.foot).replace(/[\u2018\u2019]/g, "'");
  if (!out.foot) out.foot = EMT_ART_FOOT[kind];
  else if (out.foot.indexOf(EMT_ART_FOOT[kind]) !== 0) P.push('"foot" must start with: ' + EMT_ART_FOOT[kind]);

  /* every text field: dashes, emoji, hashtags, markdown, first person, invented quotes, the number guard */
  var texts = [['the title', out.title], ['the sub', out.sub], ['the lede', out.lede]];
  out.matchups.forEach(function (m) {
    var n = m.home + ' v ' + m.away;
    texts.push([n + ', the kicker', m.kicker], [n + ', star.label', m.star.label], [n + ', the story', m.story]);
    m.bullets.forEach(function (x, k) { texts.push([n + ', bullet ' + (k + 1), x]); });
    texts.push([n + ', the number', m.number.value + ' ' + m.number.caption]);
  });
  out.around.forEach(function (x) { texts.push(['around "' + x.h + '"', x.h + ' ' + x.body]); (x.bullets || []).forEach(function (y, k) { texts.push(['around "' + x.h + '", bullet ' + (k + 1), y]); }); });
  texts.push(['the foot', out.foot]);
  var allText = texts.slice();
  out.sources.forEach(function (x, k) { allText.push(['sources ' + (k + 1), x.name]); });
  var badDash = [], badEmoji = [], badTag = [], badMd = [];
  allText.forEach(function (t) {
    var v = t[1] || '';
    if (/[\u2014\u2013]/.test(v)) badDash.push(t[0]);
    if (EMT_EMOJI.test(v)) badEmoji.push(t[0]);
    if (/(^|[\s(])#[A-Za-z0-9_]/.test(v)) badTag.push(t[0]);
    if (/\*\*|__|`|^\s*#{1,6}\s/.test(v)) badMd.push(t[0]);
  });
  if (badDash.length) P.push('An em dash or en dash in ' + badDash.slice(0, 6).join('; ') + ': use a comma, a colon or a full stop.');
  if (badEmoji.length) P.push('An emoji in ' + badEmoji.slice(0, 6).join('; ') + ': no emoji.');
  if (badTag.length) P.push('A hashtag in ' + badTag.slice(0, 6).join('; ') + ': no hashtags.');
  if (badMd.length) P.push('Markdown in ' + badMd.slice(0, 6).join('; ') + ': plain text only.');

  var qLines = (Array.isArray(facts.quotes) ? facts.quotes : []).map(function (x) { return emtArtNorm(x && (x.line || x.said || x.text)); }).filter(Boolean);
  var nRes = emtArtNorm(research);
  var names = [], addName = function (v) { v = String(v == null ? '' : v).trim(); if (v && /\b(I|we|our|ours|us|ourselves)\b/i.test(v) && names.indexOf(v) < 0) names.push(v); };
  (facts.table || []).forEach(function (t) { if (t) { addName(t.team); addName(t.mgr); } });
  fx.forEach(function (x) {
    if (!x) return;
    addName(x.home); addName(x.away); addName(x.derby);
    ['H', 'A'].forEach(function (k) { var sd = x[k]; if (!sd) return; addName(sd.team); addName(sd.mgr); (sd.xi || []).concat(sd.bench || []).forEach(function (p) { if (p) addName(p.name); }); });
  });
  var ros = facts.rosters && typeof facts.rosters === 'object' ? facts.rosters : {};
  Object.keys(ros).forEach(function (t) { addName(t); (Array.isArray(ros[t]) ? ros[t] : []).forEach(function (e) { addName(String(e).replace(/\s*\([^)]*\)\s*$/, '')); }); });
  names.sort(function (x, y) { return y.length - x.length; });
  var okAll = emtArtAllowed(sent + '\n' + research + '\n' + String(extra || ''), facts), okFacts = emtArtAllowed(sent, facts), badN = {}, fp = [];
  texts.forEach(function (t) {
    var where = t[0], v = t[1] || '';
    var plain = v.replace(/["\u201C\u201D]([^"\u201C\u201D]{1,600})["\u201C\u201D]/g, function (m, qt) {
      var nq = emtArtNorm(qt), long = W(nq) >= 2;                                         /* one quoted word is not a quote */
      if (long && qLines.some(function (l) { return l.indexOf(nq) > -1; })) return ' ';   /* a manager's own line: exempt */
      if (long && nRes.indexOf(nq) > -1) return ' ';                                       /* a quote from the research */
      if (W(qt.trim()) >= 4) P.push(where + ': the quote "' + qt.trim().slice(0, 70) + '" is not in the quotes in FACTS or in RESEARCH; quote word for word or not at all.');
      return m;
    });
    var bare = plain;
    /* names with I, we, our or us in them (I Am a Baleba), in any case, and initials (I. Sarr) are not first person */
    names.forEach(function (n) { bare = bare.replace(new RegExp(emtArtReEsc(n), 'gi'), ' '); });
    bare = bare.replace(/\bI\.\s?(?=[A-Z])/g, ' ');
    if (/\bI\b/.test(bare) || /\b(we|our|ours|us|ourselves)\b/i.test(bare)) fp.push(where);
    emtShowNums(plain).forEach(function (n) {
      if (!okAll[n] && !okAll[String(Number(n))] && !badN[n]) { badN[n] = 1; P.push('The number ' + n + ' (' + where + ': "' + plain.slice(0, 90) + '") is not in FACTS or RESEARCH.'); }
    });
  });
  if (fp.length) P.push('First person in ' + fp.slice(0, 6).join('; ') + ': no I, we, our or us; write in the third person.');
  out.matchups.forEach(function (m) {
    var ns = emtShowNums(m.number.value);
    if (ns.length && ns.some(function (n) { return !okFacts[n] && !okFacts[String(Number(n))]; })) P.push(m.home + ' v ' + m.away + ': number.value "' + m.number.value + '" is not a number in FACTS.');
  });

  /* never call a rostered player free */
  var freeN = {}, rostered = [];
  (Array.isArray(facts.free) ? facts.free : []).forEach(function (p) { if (p && p.name) freeN[emtArtNorm(p.name)] = 1; });
  Object.keys(ros).forEach(function (t) {
    (Array.isArray(ros[t]) ? ros[t] : []).forEach(function (e) { var nm = String(e).replace(/\s*\([^)]*\)\s*$/, '').trim(); if (nm.length >= 4 && !freeN[emtArtNorm(nm)]) rostered.push({ name: nm, team: t }); });
  });
  if (rostered.length) texts.forEach(function (t) {
    String(t[1] || '').split(/[.!?]+\s+/).forEach(function (sn) {
      if (!/\b(free agents?|unowned|up for grabs|nobody owns|no one owns|without an owner|(?:still|sitting|available) on the (?:waiver )?wire)\b/i.test(sn)) return;
      rostered.forEach(function (r) {
        if (new RegExp('(^|[^A-Za-z])' + emtArtReEsc(r.name) + '([^A-Za-z]|$)').test(sn)) P.push(t[0] + ': ' + r.name + ' is on the ' + r.team + ' roster; never call a rostered player free or suggest picking him up.');
      });
    });
  });

  var words = 0;
  texts.forEach(function (t) { words += W(t[1]); });
  if (words < EMT_ART_WORDS[0] || words > EMT_ART_WORDS[1]) P.push('The article has ' + words + ' words; it needs 600 to 1,400 (aim for about 1,100).');
  var uniq = [];
  P.forEach(function (x) { if (uniq.indexOf(x) < 0) uniq.push(x); });
  return { problems: uniq, article: uniq.length ? null : out, words: words };
}

/* ---------- 4. the job, one step at a time ---------- */
/* what to start: the recap, else the preview. → { gw, kind, facts, why } | { gw: 0, why } */
function emtArtDue(force, now) {
  var meta = emtArtMeta(), why = [];
  /* v3.20: a row that failed under an older Code.gs does not count; this version tries once (its own failure is final) */
  var taken = function (gw, kind) {
    return meta.some(function (m) {
      if (m.gw !== gw || m.kind !== kind) return false;
      if (force) return ['research', 'writing', 'draft', 'live'].indexOf(m.status) > -1;
      if (m.status === 'failed') return emtSelfCmp(m.failedBy || 'v0', EMT_VERSION) >= 0;
      return true;
    });
  };
  var hrs = function (ms) { return Math.round(ms / 36e5 * 10) / 10; };
  var rg = emtArtRecapGw();
  if (rg) {
    if (taken(rg, 'recap')) why.push('the recap of GW' + rg + ' is already in the Articles tab');
    else {
      var end = emtArtGwEndMs(rg);
      if (!force && end && now - end > EMT_ART_RECAP_DAYS_MS) why.push('the recap of GW' + rg + ' is out of its window (its last game was over 5 days ago)');
      else {
        var f = emtFactsBest('RecapFacts', rg, false);                                   /* v3.15: a phone's or the repo's */
        if (!f) why.push('the recap of GW' + rg + ' waits for recap facts from the app (a signed-in manager opening it sends them) or from the Facts bot');
        else if (!force && now - f.at > EMT_ART_RECAP_FRESH_MS) why.push('the recap of GW' + rg + ' waits for fresher facts (the latest are ' + hrs(now - f.at) + ' hours old; 24 at most)');
        else return { gw: rg, kind: 'recap', facts: f, why: why };          /* the job reads the data (emtArtRun) */
      }
    }
  }
  var nx = emtArtNextDeadline(now);
  if (nx && (force || nx.dl - now <= EMT_ART_PREVIEW_AHEAD_MS)) {
    if (taken(nx.gw, 'preview')) why.push('the preview of GW' + nx.gw + ' is already in the Articles tab');
    else {
      var sf = emtFactsBest('ShowFacts', nx.gw, false);                                 /* v3.15: a phone's or the repo's */
      if (!sf) why.push('the preview of GW' + nx.gw + ' waits for preview facts from the app or from the Facts bot');
      else if (!force && now - sf.at > EMT_ART_PREVIEW_FRESH_MS) why.push('the preview of GW' + nx.gw + ' waits for fresher facts (the latest are ' + hrs(now - sf.at) + ' hours old; 12 at most)');
      else {
        var sd = force ? null : emtFactsBest('ShowFacts', nx.gw, true);
        if (!force && (!sd || !sd.data || sd.data.kind !== 'preview')) why.push('the preview of GW' + nx.gw + ' waits for facts from the new app (the latest have no kind "preview" and no collisions, or could not be read, or failed the checks)');
        else return { gw: nx.gw, kind: 'preview', facts: sd || sf, why: why };
      }
    }
  } else if (nx) why.push('the preview of GW' + nx.gw + ' starts in the last 50 hours before its deadline (' + hrs(nx.dl - now) + ' hours away)');
  return { gw: 0, why: why };
}
/* run: a token for this run of the article, so a run left over from before a drop and a rewrite can never overwrite
 * the newer one (emtArtStale) */
function emtArtNewJob(id, gw, kind, phase, redos, note) {
  return { id: id, gw: gw, kind: kind, phase: phase, batch: '', tries: 0, redos: redos || 0, startedAt: Date.now(), note: note || '', model: '', cont: 0, fix: false,
    run: String(Utilities.getUuid()).replace(/[^0-9a-f]/gi, '').toLowerCase().slice(0, 8) };
}
/* a new Articles row and its job (null when a job appeared meanwhile: a rewrite the commissioner just asked for) */
function emtArtStart(due) {
  var id = due.kind + '-gw' + due.gw + '-' + String(Utilities.getUuid()).replace(/[^0-9a-f]/gi, '').toLowerCase().slice(0, 6);
  var job = emtArtNewJob(id, due.gw, due.kind, 'research'), at = new Date().toISOString(), lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (emtArtJob()) return null;
    emtHiddenSheet('Articles', EMT_ART_HEAD).appendRow([id, due.gw, due.kind, 'research', '', '', "'" + due.facts.iso, '', '', '', '',
      "'" + at + ' research: started from the facts of ' + due.facts.iso + ' (sent by ' + due.facts.team + ').']);
    emtProps().setProperty('EMT_ART_JOB', JSON.stringify(job));
  } finally { lock.releaseLock(); }
  emtArtTouch();
  return job;
}
/* the next job: a queued rewrite, else what is due. → { job, how } | { why } */
function emtArtNext(force) {
  var lock = LockService.getScriptLock(), job = null;
  lock.waitLock(10000);
  try {
    job = emtArtJob();
    if (job) return { job: job, how: 'running' };
    var q = emtArtQueue(), n0 = q.length, meta = n0 ? emtArtMeta() : [];
    while (q.length && !job) {
      var m = emtArtFind(q.shift(), meta);
      if (m && (m.status === 'writing' || emtArtLiveRw(m))) {
        job = emtArtNewJob(m.id, m.gw, m.kind, 'write', m.redos, m.note);
        if (m.status === 'live') job.live = true;             /* v3.14: a new version of a live article */
      }
    }
    if (n0 !== q.length) emtArtSetQueue(q);
    if (job) { emtProps().setProperty('EMT_ART_JOB', JSON.stringify(job)); return { job: job, how: 'rewrite' }; }
    /* an article still marked research or writing, or (v3.14) live with a rewrite under way, with no job behind it (its
     * job state was lost): carry on with it */
    var lost = emtArtMeta().filter(function (m) { return emtArtActive(m); })[0];
    if (lost) {
      job = emtArtNewJob(lost.id, lost.gw, lost.kind, lost.status === 'research' ? 'research' : 'write', lost.redos, lost.note);
      if (lost.status === 'live') job.live = true;
      emtProps().setProperty('EMT_ART_JOB', JSON.stringify(job));
      return { job: job, how: 'resumed' };
    }
  } finally { lock.releaseLock(); }
  var due = emtArtDue(force, Date.now());
  if (!due.gw) return { why: due.why };
  var started = emtArtStart(due);
  return started ? { job: started, how: due.kind } : { why: ['another job started meanwhile'] };
}
/* a try failed: count it; after 3 the article fails → false when the job is over */
function emtArtTry(job, why, S) {
  job.tries = (job.tries || 0) + 1; job.batch = ''; job.fix = false; job.cont = 0;
  emtWorkClear(job.id, ['cont', 'fix']);
  S.did.push('try ' + job.tries + ' failed');
  if (job.tries >= EMT_ART_TRIES) { emtArtFail(job, 'try ' + job.tries + ' of ' + EMT_ART_TRIES + ' failed, no more: ' + why, S); return false; }
  emtArtUpdate(job.id, {}, 'try ' + job.tries + ' of ' + EMT_ART_TRIES + ' failed: ' + why + ' Trying again.', null, job.run || '');
  emtArtSay(job, 'try ' + job.tries + ' of ' + EMT_ART_TRIES + ' failed (' + String(why).slice(0, 300) + '); trying again.');
  if (!emtArtJobPut(job)) { S.stopped = 'gone'; return false; }
  return true;
}
/* the job gives up. v3.14: a rewrite of a live article that fails leaves the live version up as it is (its pend
 * becomes 'failed', the Log says so); any other article is marked failed */
function emtArtFail(job, why, S) {
  var lock = LockService.getScriptLock(), kept = false;
  lock.waitLock(10000);
  try {
    var m = emtArtFind(job.id);
    if (emtArtLiveRw(m)) {
      kept = true;
      emtArtUpdateLocked(job.id, { note: emtArtNoteSet(emtArtCell(m.row, EMT_ART_COL.note), { pend: 'failed' }) },
        'the rewrite failed, so the live version stays up as it was: ' + why, ['live'], job.run || '');
    } else emtArtUpdateLocked(job.id, { status: 'failed' }, why + ' [Code.gs ' + EMT_VERSION + ']', EMT_ART_ACTIVE, job.run || '');   /* v3.20: a newer version tries once more */
  } finally { lock.releaseLock(); }
  emtArtJobEnd(job.id, job.run || '');
  S.ok = false; S.stopped = kept ? 'kept' : 'failed'; S.error = why;
  if (kept) emtArtSay(job, 'the rewrite failed. ' + String(why).slice(0, 400) + ' The live version stays up as it was; the commissioner can ask again or take it down.');
  else emtArtSay(job, 'failed. ' + String(why).slice(0, 400) + ' Nothing goes out; the commissioner can ask for a rewrite or drop it.');
}
/* research finished (or unavailable): keep it and move to the writing → false when the job is over */
function emtArtResearchDone(job, text, logMsg, S) {
  var u = emtArtUpdate(job.id, { status: 'writing', research: EMT_TEXT_MARK + text }, logMsg, EMT_ART_ACTIVE, job.run || '');
  if (!u || u.missing || u.skipped) { emtArtJobEnd(job.id, job.run || ''); S.stopped = 'gone'; return false; }
  job.phase = 'write'; job.batch = ''; job.cont = 0; job.fix = false;
  emtWorkClear(job.id, ['cont']);
  S.did.push(logMsg);
  emtArtSay(job, logMsg);
  if (!emtArtJobPut(job)) { S.stopped = 'gone'; return false; }
  return true;
}
/* the checked article is done (v3.14; v3.13 made it the draft): the punched-up version, or the checked base when the
 * punch-up was not used.
 *   - a rewrite of a live article (emtArtLiveRw): the new version replaces the live one (emtArtLiveFields, shared with
 *     approve): Written and Model updated, Approved (the first publish) kept, pend cleared;
 *   - by default: published at once, exactly as the commissioner's approve would (emtArtLiveFields, Approved now);
 *   - review mode (EMT_ART_REVIEW = yes): kept sealed as a draft that waits for the commissioner (v3.13).
 * punch (v3.13): { model } when it is the punched-up version (the Model cell then reads 'writer + punch model'), { why }
 * when the punch-up was not used (the checked base went out), { off } */
function emtArtDone(job, C, S, punch) {
  punch = punch || {};
  var writer = job.writer || job.model, model = writer + (punch.model ? ' + ' + punch.model : '');
  var at = new Date().toISOString(), review = emtArtReview();
  var sealed = review ? emtArtSeal(JSON.stringify(C.article), emtArtSecret(true)) : '';   /* a draft is sealed until approved; the key is made outside the lock */
  var how = punch.model ? ', punched up by ' + punch.model : '';
  var why = String(punch.why || '').replace(/[.\s]+$/, ''), tail = why ? '; punch-up not used: ' + why : punch.off ? '; punch-up off (EMT_PUNCH_OFF = yes)' : '';
  var what = 'written by ' + writer + how + ', ' + C.words + ' words' + (job.redos ? ', rewrite ' + job.redos + ' of ' + EMT_ART_REDOS : '') +
    (job.tries ? ', after ' + job.tries + ' failed tr' + (job.tries > 1 ? 'ies' : 'y') : '') + tail;
  var cells = { written: "'" + at, model: emtCell(model) }, mode = '', u = null, lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var m = emtArtFind(job.id);
    if (emtArtLiveRw(m)) {
      mode = 'rewritten';
      cells.note = emtArtNoteSet(emtArtCell(m.row, EMT_ART_COL.note), { pend: '' });
      u = emtArtUpdateLocked(job.id, emtArtLiveFields(C.article, '', cells), what + '. The new version replaced the live one; every manager reads it now.', ['live'], job.run || '');
    } else if (review) {
      mode = 'draft'; cells.status = 'draft'; cells.article = sealed;
      u = emtArtUpdateLocked(job.id, cells, what + '. Waiting for the commissioner.', ['writing'], job.run || '');
    } else {
      mode = 'live';
      u = emtArtUpdateLocked(job.id, emtArtLiveFields(C.article, at, cells), what + '. Published automatically; every manager can read it now.', ['writing'], job.run || '');
    }
  } finally { lock.releaseLock(); }
  emtArtJobEnd(job.id, job.run || '');
  if (!u || u.missing || u.skipped) { S.stopped = 'gone'; emtArtSay(job, 'written, but its article was ' + (u && u.skipped ? u.skipped : 'removed') + ' meanwhile; nothing kept.'); return; }
  S.stopped = mode; S.written = true; S.words = C.words; S.model = model;
  if (punch.model || punch.why) S.punch = punch.model ? 'punched up by ' + punch.model : 'punch-up not used';
  emtArtSay(job, (mode === 'rewritten' ? 'the rewrite of the live article, written by ' : mode === 'live' ? 'published automatically, written by ' : 'draft written by ') + writer + how + ' (' + C.words + ' words)' +
    (why ? '; punch-up not used: ' + emtArtRedact(why).slice(0, 700) : '') +
    (mode === 'rewritten' ? '. It replaced the live version.' : mode === 'live' ? '. Every manager can read it now.' : '. It waits for ' + emtCommish() + ' to read it in the app.'));
}

/* one run's work on the job: at most one batch sent (the run then ends) and at most one collected.
 * v3.13: three phases, research → write → punch. An article that passes the checks is kept sealed as the base and goes
 * to the punch-up (emtArtPunchStart); whatever happens there (emtArtPunchEnd), the punched-up version or the checked
 * base is done (emtArtDone, v3.14: published, or a draft in review mode, or swapped in for a live one). The punch phase
 * never counts a try and never fails the job. */
function emtArtRun(job, S, t0, force) {
  var facts = null;
  for (var step = 0; step < 10; step++) {
    var meta = emtArtFind(job.id);
    if (!emtArtActive(meta)) {
      emtArtJobEnd(job.id, job.run || ''); S.stopped = 'gone';
      emtArtSay(job, 'its article is ' + (meta ? meta.status : 'not in the Articles tab') + '; the job stops.');
      return;
    }
    if (emtArtStale(job)) { S.stopped = 'gone'; emtArtSay(job, 'a newer job took over (dropped, then a rewrite asked for); this run stops.'); return; }
    if (Date.now() - Number(job.startedAt || 0) > EMT_ART_JOB_MAX_MS) {
      if (job.phase === 'punch') { emtArtCancel(job.batch); emtArtPunchEnd(job, null, 'the job reached its 36-hour limit', '', S); return; }
      emtArtFail(job, 'given up: still unfinished 36 hours after it started.', S); return;
    }
    if (!force && Date.now() - t0 > EMT_ART_LATE_MS + 60e3) { S.stopped = 'time'; emtArtJobPut(job); return; }
    /* the facts it is given, kept for the whole job (the research, the writing and the check see the same facts) */
    if (!facts) facts = emtWorkJson(job.id, 'facts');
    /* the punch-up is checked against the very facts the base was checked against, or not at all */
    if (!facts && job.phase === 'punch') { emtArtCancel(job.batch); emtArtPunchEnd(job, null, 'the facts it was checked against could not be read back', '', S); return; }
    if (!facts) {
      var ftab = job.kind === 'recap' ? 'RecapFacts' : 'ShowFacts', fl = emtFactsBest(ftab, job.gw, true);   /* v3.15: a phone's or the repo's */
      if (!fl || !fl.data) {
        /* facts that are there but could not be read were being replaced by a new post as they were read: next run */
        if (emtFactsBest(ftab, job.gw, false)) { S.stopped = 'wait'; S.error = 'the ' + job.kind + ' facts were being replaced as they were read'; emtArtSay(job, S.error + '; trying again next run (not counted).'); emtArtJobPut(job); return; }
        emtArtFail(job, 'no ' + job.kind + ' facts for GW' + job.gw + ' could be read.', S); return;
      }
      emtWorkPut(job.id, 'facts', JSON.stringify(fl.data));
      facts = fl.data;
      emtArtUpdate(job.id, { factsAt: "'" + fl.iso }, '', null, job.run || '');
    }
    var sent = emtArtSent(facts);
    /* the punch-up, turned off meanwhile (EMT_PUNCH_OFF = yes) or past its 2 hours: the checked base goes out */
    if (job.phase === 'punch' && emtPunchOff()) { emtArtCancel(job.batch); emtArtPunchEnd(job, null, 'turned off (EMT_PUNCH_OFF = yes)', '', S); return; }
    var late = job.phase === 'punch' && Date.now() - Number(job.punchAt || 0) > EMT_PUNCH_MAX_MS;
    if (!job.batch) {
      var sub;
      if (job.phase === 'research') {
        var cont = job.cont ? emtWorkJson(job.id, 'cont') : null;
        if (job.cont && !cont) job.cont = 0;                                   /* the paused turn is lost: start again */
        sub = emtArtCreate(job, function (model) { return emtArtResearchParams(job, facts, model, cont); });
      } else if (job.phase === 'punch') {
        var base = emtArtPunchBase(job);
        if (!base) { if (!emtArtPunchLost(job, S)) return; continue; }
        sub = emtArtCreate(job, function (model) { return emtArtPunchParams(job, base.article, model); });
      } else {
        var research = emtArtResearchText(emtArtCell(meta.row, EMT_ART_COL.research));
        var prev = job.redos ? emtArtArticle(emtArtCell(meta.row, EMT_ART_COL.article)) : null;
        var fix = null;
        if (job.fix) { var fixS = emtWorkGet(job.id, 'fix'), fixO = fixS === null ? null : emtArtOpen(fixS); try { fix = fixO === null ? null : JSON.parse(fixO); } catch (e) { fix = null; } }
        var user = emtArtWriteUser(job, facts, sent, research, prev);
        sub = emtArtCreate(job, function (model) { return emtArtWriteParams(user, fix, model); });
      }
      if (sub.batch) {
        job.batch = sub.batch; job.batchAt = Date.now(); job.model = sub.model;
        if (!emtArtJobPut(job)) { emtArtCancel(sub.batch); S.stopped = 'gone'; return; }
        S.stopped = 'submitted'; S.did.push(job.phase + ' batch sent to ' + sub.model);
        emtArtSay(job, (job.phase === 'research' ? (job.cont ? 'research continued (' + job.cont + ' of ' + EMT_ART_CONTS + ')' : 'research sent')
          : job.phase === 'punch' ? 'the checked article went to the punch-up' : (job.fix ? 'the rejected article went back with its problems' : 'writing sent')) +
          ' to ' + sub.model + ' (batch ' + sub.batch + '); the next runs collect it.');
        return;
      }
      /* the punch-up could not be sent: the checked base goes out (a busy API waits, for 2 hours at most) */
      if (job.phase === 'punch' && !(sub.wait && !late)) {
        emtArtPunchEnd(job, null, sub.missing ? 'no punch-up model is available' : sub.bad ? 'the Batches API refused it' : 'the Batches API was still refusing it after 2 hours',
          sub.missing ? String(sub.missing).replace(/^no model in the chain is available\s*/, 'tried ') : String(sub.bad || sub.wait || ''), S);
        return;
      }
      if (sub.searchOff) { if (!emtArtResearchDone(job, '', 'research unavailable: ' + String(sub.searchOff).slice(0, 300) + '. Written from the league data alone.', S)) return; continue; }
      if (sub.wait) { S.stopped = 'wait'; S.error = sub.wait; emtArtSay(job, sub.wait + '; trying again next run (not counted).'); emtArtJobPut(job); return; }
      if (sub.missing) { emtArtFail(job, sub.missing, S); return; }
      if (!emtArtTry(job, sub.bad, S)) return;
      continue;
    }
    var poll = emtArtPoll(job);
    /* a punch-up batch that is lost, or still unfinished 2 hours after the punch-up started: the checked base goes out */
    if (job.phase === 'punch' && !poll.result && (poll.lost || late)) {
      if (!poll.lost) emtArtCancel(job.batch);
      emtArtPunchEnd(job, null, poll.lost ? 'the punch-up batch was lost' : 'the punch-up was still unfinished after 2 hours', poll.lost || '', S);
      return;
    }
    if (poll.wait) { S.stopped = 'wait'; S.error = poll.wait; emtArtSay(job, poll.wait + '; trying again next run.'); return; }
    if (poll.pending) {
      if (Date.now() - Number(job.batchAt || 0) > EMT_ART_BATCH_MAX_MS) {
        emtArtCancel(job.batch);
        if (!emtArtTry(job, 'the ' + job.phase + ' batch was still unfinished after 6 hours.', S)) return;
        continue;
      }
      S.stopped = 'waiting'; S.did.push('batch ' + poll.pending);
      return;
    }
    if (poll.lost) { if (!emtArtTry(job, poll.lost + '.', S)) return; continue; }
    var res = poll.result;
    if (res.type === 'succeeded' && res.message) {
      var msg = res.message, content = Array.isArray(msg.content) ? msg.content : [];
      if (job.phase === 'research') {
        var all = (job.cont ? (emtWorkJson(job.id, 'cont') || []) : []).concat(content);
        if (msg.stop_reason === 'pause_turn' && (job.cont || 0) < EMT_ART_CONTS) {
          emtWorkPut(job.id, 'cont', JSON.stringify(all));
          job.cont = (job.cont || 0) + 1; job.batch = '';
          if (!emtArtJobPut(job)) { S.stopped = 'gone'; return; }          /* saved at once: the stored turn and the count stay in step */
          S.did.push('research paused, continuation ' + job.cont);
          continue;
        }
        var R = emtArtResearch(all);
        /* no search result came back at all (every search errored, or none was made): the notes could only come from
         * the model's memory, which no number in an article may rest on, so they are not kept */
        if (!R.searched) {
          if (!emtArtResearchDone(job, '', 'research unavailable: web search returned no results' + (R.text ? ' (' + R.text.length + ' characters of notes from memory not kept)' : '') + '. Written from the league data alone.', S)) return;
          continue;
        }
        if (!emtArtResearchDone(job, R.text, emtArtResearchLog(R, msg.stop_reason, EMT_ART_CONTS), S)) return;   /* v3.23: says when the budget ran out */
        continue;
      }
      var text = emtArtTexts(content), research2 = emtArtResearchText(emtArtCell(meta.row, EMT_ART_COL.research));
      var C = emtArticleCheck(text, facts, research2, job.kind, job.gw, sent, job.note);
      if (job.phase === 'punch') {
        /* the punched-up article: the full check again (same facts, research, note), then only the jokes may differ */
        var pb = emtArtPunchBase(job);
        if (!pb) { if (!emtArtPunchLost(job, S)) return; continue; }
        var PP = C.article ? emtArtPunchSame(pb, C) : C.problems;
        if (!C.article && msg.stop_reason === 'max_tokens') PP = ['The reply was cut off before the JSON ended.'].concat(PP);
        if (PP.length) emtArtPunchEnd(job, null, 'the check found ' + PP.length + ' problem' + (PP.length === 1 ? '' : 's'), PP.slice(0, 5).join(' | '), S, pb);
        else emtArtPunchEnd(job, C, '', '', S);
        return;
      }
      if (!C.article && msg.stop_reason === 'max_tokens') C.problems.unshift('The reply was cut off before the JSON ended: keep the article near 1,100 words.');
      if (C.article) {
        if (emtPunchOff()) { emtArtDone(job, C, S, { off: true }); return; }
        if (!emtArtPunchStart(job, C, S)) return;
        continue;
      }
      if (!job.fix) {
        emtWorkPut(job.id, 'fix', emtArtSeal(JSON.stringify({ reply: text.slice(0, 60000), problems: C.problems.slice(0, 25) }), emtArtSecret(true)));   /* a rejected draft: sealed too */
        job.fix = true; job.batch = '';
        if (!emtArtJobPut(job)) { S.stopped = 'gone'; return; }
        emtArtUpdate(job.id, {}, 'the article failed the checks (' + C.problems.length + ' problem' + (C.problems.length === 1 ? '' : 's') + '); sent back once: ' + C.problems.slice(0, 8).join(' | '), null, job.run || '');
        emtArtSay(job, 'the article failed the checks; sending it back once with the problems: ' + C.problems.slice(0, 5).join(' | '));
        S.did.push('article rejected, sent back');
        continue;
      }
      if (!emtArtTry(job, 'the article failed the checks twice: ' + C.problems.slice(0, 8).join(' | '), S)) return;
      continue;
    }
    var err = (res.error && typeof res.error === 'object' ? (res.error.error && typeof res.error.error === 'object' ? res.error.error : res.error) : {}) || {};
    var et = String(err.type || ''), em = String(err.message || '');
    if (res.type === 'errored' && emtModelMissing(0, et, em)) {
      emtModelNoteGone(job.model, em);
      var nxt = emtArtModelAfter(job.model, job.phase);
      if (!nxt) {
        if (job.phase === 'punch') { emtArtPunchEnd(job, null, 'no punch-up model is available', 'the last, ' + job.model + ', answered: ' + em.slice(0, 160), S); return; }
        emtArtFail(job, 'no model in the chain is available (the last, ' + job.model + ', answered: ' + em.slice(0, 160) + ').', S); return;
      }
      job.model = nxt; job.batch = '';
      continue;
    }
    if (job.phase === 'punch') {                 /* errored, expired or canceled: never a try, the checked base goes out */
      emtArtPunchEnd(job, null, 'the punch-up request ' + (res.type || 'failed'), em ? (et ? et + ': ' : '') + em.slice(0, 200) : '', S);
      return;
    }
    if (res.type === 'errored' && job.phase === 'research' && emtArtSearchOff(et, em)) {
      if (!emtArtResearchDone(job, '', 'research unavailable: ' + em.slice(0, 300) + '. Written from the league data alone.', S)) return;
      continue;
    }
    if (!emtArtTry(job, 'the ' + job.phase + ' request ' + (res.type || 'failed') + (em ? ' (' + (et ? et + ': ' : '') + em.slice(0, 200) + ')' : '') + '.', S)) return;
  }
  emtArtJobPut(job);
  S.stopped = S.stopped || 'steps';
}

/* aiTick runs this every 15 minutes, after the show and before the self-update. force (the menu's 'Articles: write
 * now') ignores EMT_ARTICLES_PAUSED, the late-run guard and the windows. → a summary { ok, stopped, id, ... } */
/* v3.14: in auto mode, publish every draft still waiting (written in review mode or by v3.13 before approvals were
 * switched off). Same cells as an approval; the Log line counts as an automatic publish. */
function emtArtPublishWaiting(S) {
  var drafts = emtArtMeta().filter(function (m) { return m.status === 'draft'; }), done = 0;
  drafts.forEach(function (m) {
    var art = emtArtArticle(emtArtCell(m.row, EMT_ART_COL.article));
    if (!art) return;
    var u = emtArtUpdate(m.id, emtArtLiveFields(art, new Date().toISOString()),
      'Published automatically: it was waiting as a draft when approvals were switched off; every manager can read it now.', ['draft']);
    if (!u || u.missing || u.skipped) return;
    done++; S.did.push('published the waiting draft ' + m.id);
    emtArtSay({ kind: m.kind, gw: m.gw, id: m.id }, 'it was waiting as a draft; published automatically (approvals are off).');
  });
  if (done) emtArtTouch();
  return done;
}
function articleTick(startedAt, force) {
  var t0 = typeof startedAt === 'number' ? startedAt : Date.now(), p = emtProps();
  var S = { ok: true, stopped: '', did: [], why: [] };
  if (!force && p.getProperty('EMT_ARTICLES_PAUSED') === 'yes') { S.stopped = 'paused'; return S; }
  if (!emtAiOn()) { S.stopped = 'off'; return S; }
  if (!force && Date.now() - t0 > EMT_ART_LATE_MS) { S.stopped = 'time'; return S; }
  if (!emtFlagClaim('EMT_ART_BUSY', EMT_ART_BUSY_MS)) { S.stopped = 'busy'; return S; }
  try {
    /* v3.14: approvals are off, so a draft left waiting from review mode (or from v3.13) goes out now */
    if (!emtArtReview()) { try { emtArtPublishWaiting(S); } catch (e) { Logger.log('Articles: publishing a waiting draft failed: ' + ((e && e.message) || e)); } }
    var job = emtArtJob();
    if (!job) {
      emtWorkClear('');                         /* files left by a job that ended elsewhere (a drop) */
      var nx = emtArtNext(!!force);
      if (!nx.job) { S.stopped = 'idle'; S.why = nx.why || []; return S; }
      job = nx.job;
      if (nx.how !== 'running') emtArtSay(job, nx.how === 'rewrite' ? 'rewrite ' + job.redos + ' of ' + EMT_ART_REDOS + ' starts' + (job.note ? ', with the note "' + job.note + '"' : '') + (job.live ? ' (the live version stays up meanwhile)' : '') + '.'
        : nx.how === 'resumed' ? 'resumed: ' + (job.live ? 'a rewrite of its live version was still under way' : 'its article was still ' + (job.phase === 'write' ? 'writing' : 'researching')) + ' with no job behind it.'
        : (force ? 'started from the menu.' : 'started: the facts are in and the window is open.'));
    }
    S.id = job.id; S.gw = job.gw; S.kind = job.kind;
    emtArtRun(job, S, t0, !!force);
    S.phase = job.phase;
    return S;
  } finally { p.deleteProperty('EMT_ART_BUSY'); }
}

/* ---------- 5. serving and the commissioner ---------- */
/* GET ?articles=1. v3.14: review (the mode, read fresh, never from the cache) and each live article's written time,
 * which changes when a rewrite replaces its text (phones then fetch the new version) */
function emtArtList() {
  var cache = null, review = emtArtReview();
  try { cache = CacheService.getScriptCache(); var hit = cache.get('EMT_ART_LIST'); if (hit) { var o = JSON.parse(hit); o.review = review; return o; } } catch (e) { }
  var meta = emtArtMeta(), live = [], waiting = [], rows = meta.filter(function (m) { return m.status === 'live'; });
  if (rows.length) {
    var sh = SpreadsheetApp.getActive().getSheetByName('Articles'), nums = rows.map(function (m) { return m.row; });
    var lo = Math.min.apply(null, nums), hi = Math.max.apply(null, nums), col = sh.getRange(lo, EMT_ART_COL.article, hi - lo + 1, 1).getValues();
    rows.forEach(function (m) {
      var a = emtArtArticle(col[m.row - lo][0]);
      if (a) live.push({ id: m.id, gw: m.gw, kind: m.kind, title: String(a.title || ''), sub: String(a.sub || ''), approved: m.approved, written: m.written });
    });
  }
  live.sort(function (x, y) { return y.gw - x.gw || (x.kind === y.kind ? 0 : x.kind === 'recap' ? -1 : 1) || aiTs(y.approved) - aiTs(x.approved); });
  meta.forEach(function (m) { if (EMT_ART_WAITING.indexOf(m.status) > -1) waiting.push({ gw: m.gw, kind: m.kind, status: m.status, since: emtIso(m.since) }); });
  var out = { ok: true, live: live, waiting: waiting, commish: emtCommish(), review: review };
  try { if (cache) cache.put('EMT_ART_LIST', JSON.stringify(out), 300); } catch (e) { }
  return out;
}
/* GET ?article=<id>: live articles only. v3.14: auto, published without a manual approval (the app's credit line) */
function emtArtGet(idParam) {
  var id = String(idParam == null ? '' : idParam).trim(), m = id ? emtArtFind(id) : null;
  if (!m || m.status !== 'live') return { ok: false, error: 'notfound' };
  var a = emtArtArticle(emtArtCell(m.row, EMT_ART_COL.article));
  if (!a) return { ok: false, error: 'notfound' };
  return { ok: true, id: m.id, gw: m.gw, kind: m.kind, approved: m.approved, written: m.written, auto: emtArtAuto(m.log), a: a };
}
/* POST articles: the drafts, for the commissioner only. v3.14: also review (the mode) and live, the live articles he
 * can still fix from his phone: rewrites used, his last note, rewrite 'writing' (under way, the live version stays up)
 * or 'failed' (in the last 7 days, the live version stayed; error: the Log's last line) */
function emtArtDrafts(team) {
  if (team !== emtCommish()) return { ok: true, commish: false, drafts: [] };
  var now = Date.now(), meta = emtArtMeta();
  var drafts = meta.filter(function (m) {
    return EMT_ART_WAITING.indexOf(m.status) > -1 || (m.status === 'failed' && now - m.since < EMT_ART_FAILED_SHOWN_MS);
  }).map(function (m) {
    var d = { id: m.id, gw: m.gw, kind: m.kind, status: m.status, written: m.written, model: m.model, note: m.note, redos: m.redos,
      a: m.status === 'draft' || m.status === 'failed' ? emtArtArticle(emtArtCell(m.row, EMT_ART_COL.article)) : null };
    if (m.status === 'failed') d.error = emtArtLogLast(m.log).slice(0, 400);
    return d;
  }).reverse();
  var live = meta.filter(function (m) { return m.status === 'live'; }).map(function (m) {
    var rw = m.pend === 'writing' ? 'writing' : m.pend === 'failed' && now - m.since < EMT_ART_FAILED_SHOWN_MS ? 'failed' : '';
    var o = { id: m.id, gw: m.gw, kind: m.kind, redos: m.redos, note: m.note, rewrite: rw };
    if (rw === 'failed') o.error = emtArtLogLast(m.log).slice(0, 400);
    return o;
  }).reverse();
  return { ok: true, commish: true, review: emtArtReview(), drafts: drafts, live: live };
}
/* POST articlemod: approve | redo | drop, commissioner only. v3.14: approve shares emtArtLiveFields with the automatic
 * publish; redo also takes a live article (not in review mode): it stays live and readable, its Note gets pend
 * 'writing' and a write-phase job (job.live) makes the new version, which replaces it once it passes the checks
 * (emtArtDone); drop of a live article takes it down and stops a rewrite under way */
function emtArtMod(team, req) {
  if (team !== emtCommish()) return { ok: false, error: 'commish' };
  var id = String(req.id == null ? '' : req.id).trim(), op = String(req.op || '');
  if (['approve', 'redo', 'drop'].indexOf(op) < 0) return { ok: false, error: 'badop' };
  if (!id) return { ok: false, error: 'notfound' };
  var key = op === 'approve' ? '' : emtArtSecret(true);   /* made outside the lock: a note and a taken-down article are sealed */
  var cancel = '', out = null, lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var m = emtArtFind(id), p = emtProps(), now = new Date().toISOString();
    if (!m) return { ok: false, error: 'notfound' };
    if (op === 'approve') {
      if (m.status !== 'draft') return { ok: false, error: m.status === 'live' ? 'live' : 'notdraft', status: m.status };
      var art = emtArtArticle(emtArtCell(m.row, EMT_ART_COL.article));
      if (!art) return { ok: false, error: 'noarticle', status: m.status };
      /* published: the article is kept as plain json from now on (?articles and ?article read it without the key) */
      emtArtUpdateLocked(id, emtArtLiveFields(art, now), 'approved by ' + team + '; every manager can read it now.', ['draft']);
      out = { ok: true, status: 'live' };
    } else if (op === 'drop') {
      var dropF = { status: 'dropped' };
      if (m.status === 'live') {                   /* taken down: its text is sealed again, like a draft */
        var liveA = emtArtArticle(emtArtCell(m.row, EMT_ART_COL.article));
        if (liveA && key) dropF.article = emtArtSeal(JSON.stringify(liveA), key);
        if (m.pend) dropF.note = emtArtNoteSet(emtArtCell(m.row, EMT_ART_COL.note), { pend: '' });   /* v3.14: no rewrite under way any more */
      }
      if (m.status !== 'dropped') emtArtUpdateLocked(id, dropF, 'dropped by ' + team + ' (was ' + m.status + (emtArtLiveRw(m) ? ', with a rewrite under way, now stopped' : '') + '); it is not rewritten automatically.', null);
      var cur = emtArtJob();
      if (cur && cur.id === id) { cancel = cur.batch || ''; p.deleteProperty('EMT_ART_JOB'); }
      var q = emtArtQueue(), q2 = q.filter(function (x) { return x !== id; });
      if (q2.length !== q.length) emtArtSetQueue(q2);
      out = { ok: true, status: 'dropped' };
    } else {
      if (emtArtActive(m)) return { ok: false, error: 'busy', status: m.status };
      var liveRw = m.status === 'live';
      if (liveRw && emtArtReview()) return { ok: false, error: 'live', status: m.status };   /* review mode: v3.13, a live article is only taken down */
      if (m.redos >= EMT_ART_REDOS) return { ok: false, error: 'redos', status: m.status };
      var note = emtClean(req.note, EMT_ART_NOTE_MAX), n = m.redos + 1;
      var nObj = { s: note && key ? emtArtSeal(JSON.stringify(note), key) : '', redos: n, at: now };
      if (liveRw) nObj.pend = 'writing';           /* v3.14: the status stays live and the live version stays up */
      emtArtUpdateLocked(id, liveRw ? { note: EMT_JSON_MARK + JSON.stringify(nObj) } : { status: 'writing', note: EMT_JSON_MARK + JSON.stringify(nObj) },
        'rewrite ' + n + ' of ' + EMT_ART_REDOS + ' asked by ' + team + (note ? ', with a note' : ' (no note)') + (liveRw ? '; the live version stays up until the new one passes the checks' : '') + '.', null);
      var nj = emtArtNewJob(id, m.gw, m.kind, 'write', n, note);
      if (liveRw) nj.live = true;
      if (!emtArtJob()) p.setProperty('EMT_ART_JOB', JSON.stringify(nj));
      else { var q3 = emtArtQueue(); if (q3.indexOf(id) < 0) q3.push(id); emtArtSetQueue(q3); }
      out = liveRw ? { ok: true, status: 'live', rewrite: 'writing' } : { ok: true, status: 'writing' };
    }
  } finally { lock.releaseLock(); }
  if (cancel) emtArtCancel(cancel);
  emtArtTouch();
  return out;
}

/* ---------- 6. health, status, the menu ---------- */
function emtShowHealth() {
  var p = emtProps(), gw = emtShowNextGw(), out = { gw: gw, on: !!emtShowKey(), paused: p.getProperty('EMT_SHOW_PAUSED') === 'yes' };
  try {
    var f = gw ? emtFactsBest('ShowFacts', gw, false) : null;                           /* v3.15: a phone's or the repo's */
    out.facts = f ? f.iso : null;
    out.factsFrom = f ? f.source : null;
    out.script = !!(gw && emtShowScriptRow(gw, false));
    out.tries = gw ? Number(p.getProperty('EMT_SHOW_TRIES_' + gw) || 0) : 0;
    /* v3.24: clips counts only the takes rendered from the current script's lines; stale = older takes still stored;
     * source says where the script came from; render is the last render's outcome (its ElevenLabs error, if any) */
    var J = gw ? emtShowJudge(gw) : { lines: null, idx: {}, fresh: [], stale: [], expected: [] };
    out.source = J.lines ? (J.script && J.script.source === 'ai' ? 'sheet' : 'repo') : null;
    out.clips = J.fresh.length;                        /* without a script nothing is served, so nothing counts */
    out.stale = J.stale.length;
    out.expected = J.expected.length;
    out.render = emtShowLast();
    out.model = gw ? emtShowModel(gw) : null;         /* v3.26: the voice model and where it comes from */
    /* v3.25: the credit guard: the last balance read, the characters still to voice, the gameweek's cap, the hold */
    out.credits = emtShowCreditsLast();
    var need = J.lines ? emtShowNeed(J) : 0, cap = gw && J.lines ? emtShowCap(gw, J.lines) : null, H = emtShowHold();
    out.need = need;
    out.cap = cap ? { used: cap.used, cap: cap.cap, version: cap.version, versions: cap.versions, own: cap.own } : null;   /* v3.27: per script version */
    out.capped = !!(cap && need > 0 && cap.used + need > cap.cap);
    out.hold = H && Date.parse(H.until) > Date.now() ? { until: H.until, why: H.why || 'credits', since: H.since || null } : null;
    out.punch = { off: emtPunchOff(), last: emtPunchLast().show || null };        /* v3.13: the punch-up's last outcome */
  } catch (e) { out.error = String((e && e.message) || e).slice(0, 160); }
  return out;
}
/* GET ?health=1: no keys, tokens, PIN hashes or article text. v3.14: articles.mode ('auto': published as soon as an
 * article passes the checks; 'review': EMT_ART_REVIEW = yes), job.live (a rewrite of a live article) and, in last, the
 * rewrite of a live article ('writing' or 'failed') */
function emtHealth() {
  var p = emtProps(), A = aiState(), job = emtArtJob(), meta = [];
  try { meta = emtArtMeta(); } catch (e) { meta = []; }
  return { ok: true, version: EMT_VERSION, self: p.getProperty('EMT_SELF_STATE') || 'no check yet', show: emtShowHealth(),
    facts: emtFactsHealth(),                                                        /* v3.15 */
    data: emtDataHealth(),                                                          /* v3.17 */
    errors: emtErrorsHealth(),                                                      /* v3.18 */
    articles: { mode: emtArtReview() ? 'review' : 'auto',
      job: job ? { id: job.id, gw: job.gw, kind: job.kind, phase: job.phase, tries: job.tries || 0, redos: job.redos || 0, model: job.model || '',
        writer: job.writer || '', live: !!job.live, startedAt: emtIso(Number(job.startedAt) || 0), batchAt: emtIso(Number(job.batchAt) || 0) } : null,
      queue: emtArtQueue().length, paused: p.getProperty('EMT_ARTICLES_PAUSED') === 'yes',
      punch: { off: emtPunchOff(), last: emtPunchLast().article || null },        /* v3.13: the punch-up's last outcome */
      last: meta.slice(-3).reverse().map(function (m) {
        var o = { id: m.id, gw: m.gw, kind: m.kind, status: m.status, written: m.written, model: m.model, approved: m.approved, since: emtIso(m.since) };
        if (m.status === 'live' && m.pend) o.rewrite = m.pend;
        return o;
      }) },
    ai: { day: A.day || '', count: Number(A.count) || 0, on: emtAiOn(), last: A.last && typeof A.last === 'object' ? A.last : null } };   /* v3.25: last */
}
/* ---------- v3.18: errors reported by phones (ROADMAP A4) ----------
 * The app's window.onerror and unhandledrejection post `clienterror`: build, route, kind, msg, stack, online. No login
 * (nothing personal is in it), so the limits are the guard: all phones together get 60 accepted posts per 10 minutes,
 * a message is 300 characters and a stack 1,500, the same error (build, route, kind, message) within 10 minutes counts
 * up on one row of the hidden Errors tab, and the tab keeps its last 1,000 rows. ?health=1 errors (emtErrorsHealth)
 * counts the last 24 hours for the monitor and the status page. */
var EMT_ERR_HEAD = ['When (UTC)', 'Build', 'Route', 'Kind', 'Message', 'Stack', 'Count', 'Last (UTC)'];
var EMT_ERR_KINDS = ['error', 'rejection', 'network'];
var EMT_ERR_MAX_ROWS = 1000, EMT_ERR_TRIM = 200;
var EMT_ERR_RATE = 60, EMT_ERR_RATE_S = 600;
var EMT_ERR_SAME_MS = 10 * 60e3;
var EMT_ERR_LOOK = 50;                      /* rows looked at for a repeat */
var EMT_ERR_HEALTH_ROWS = 400, EMT_ERR_HEALTH_S = 60;
function emtErrCacheClear() { try { CacheService.getScriptCache().remove('EMT_ERR_HEALTH'); } catch (e) { } }
function emtClientError(req) {
  var msg = emtClean(req.msg, 300), route = emtClean(req.route, 80), build = String(req.build || '').replace(/\D/g, '').slice(0, 16);
  var stack = String(req.stack || '').replace(/[<>]/g, '').replace(/\r/g, '').slice(0, 1500);
  var kind = EMT_ERR_KINDS.indexOf(String(req.kind)) > -1 ? String(req.kind) : 'error';
  if (!msg) return { ok: false, error: 'badmsg' };
  var cache = CacheService.getScriptCache(), n = Number(cache.get('EMT_CE_N') || 0);
  if (n >= EMT_ERR_RATE) return { ok: true, dropped: true };
  cache.put('EMT_CE_N', String(n + 1), EMT_ERR_RATE_S);
  var lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    var sh = emtHiddenSheet('Errors', EMT_ERR_HEAD), last = sh.getLastRow(), now = Date.now(), at = new Date(now).toISOString();
    if (last > 1) {
      var from = Math.max(2, last - EMT_ERR_LOOK + 1), v = sh.getRange(from, 1, last - from + 1, EMT_ERR_HEAD.length).getValues();
      for (var i = v.length - 1; i >= 0; i--) {
        var r = v[i];
        if (String(r[1]) === build && String(r[2]).replace(/^'/, '') === route && String(r[3]) === kind && String(r[4]).replace(/^'/, '') === msg && now - aiTs(r[7]) < EMT_ERR_SAME_MS) {
          var c = (Number(r[6]) || 1) + 1;
          sh.getRange(from + i, 7, 1, 2).setValues([[c, "'" + at]]);
          emtErrCacheClear();
          return { ok: true, count: c };
        }
      }
    }
    sh.appendRow(["'" + at, emtCell(build), emtCell(route), kind, emtCell(msg), emtCell(stack), 1, "'" + at]);
    if (sh.getLastRow() > EMT_ERR_MAX_ROWS + 1) sh.deleteRows(2, EMT_ERR_TRIM);
    emtErrCacheClear();
    return { ok: true };
  } finally { lock.releaseLock(); }
}
/* ?health=1 errors: { h24, net24, rows, last: { when, build, route, kind, msg } | null }, from the last 400 rows, cached a minute */
function emtErrorsHealth() {
  var cache = null, hit = null;
  try { cache = CacheService.getScriptCache(); hit = cache.get('EMT_ERR_HEALTH'); if (hit) return JSON.parse(hit); } catch (e) { }
  var out = { h24: 0, net24: 0, rows: 0, last: null };
  try {
    var sh = SpreadsheetApp.getActive().getSheetByName('Errors'), last = sh ? sh.getLastRow() : 0;
    out.rows = Math.max(0, last - 1);
    if (last > 1) {
      var from = Math.max(2, last - EMT_ERR_HEALTH_ROWS + 1), v = sh.getRange(from, 1, last - from + 1, EMT_ERR_HEAD.length).getValues(), cut = Date.now() - 24 * 3600e3;
      for (var i = 0; i < v.length; i++) {
        var r = v[i], t = aiTs(r[7]) || aiTs(r[0]), c = Number(r[6]) || 1, net = String(r[3]) === 'network';
        if (t < cut) continue;
        if (net) out.net24 += c; else out.h24 += c;
        if (!net) out.last = { when: emtIso(t), build: String(r[1]), route: String(r[2]).replace(/^'/, ''), kind: String(r[3]), msg: String(r[4]).replace(/^'/, '').slice(0, 160) };
      }
    }
  } catch (e) { out.error = String((e && e.message) || e).slice(0, 120); }
  if (cache) { try { cache.put('EMT_ERR_HEALTH', JSON.stringify(out), EMT_ERR_HEALTH_S); } catch (e) { } }
  return out;
}
/* v3.17 ?health=1 data: when the sheet's data was last refreshed from FPL (the last refreshCore that finished, from any
 * trigger or the app's Refresh), the last attempt, and whether a match is live now (liveWindow: what liveTick refreshes
 * on) and since when. Never throws. */
function emtDataHealth() {
  var out = { updated: null, source: '', ageMin: null, attempted: null, live: false, liveWhy: '', liveSince: null };
  var p = emtProps();
  try {
    var d = JSON.parse(p.getProperty('EMT_DATA_UPDATED') || 'null');
    if (d && Number(d.at) > 0) { out.updated = emtIso(Number(d.at)); out.source = String(d.source || ''); out.ageMin = Math.max(0, Math.round((Date.now() - Number(d.at)) / 60000)); }
  } catch (e) { }
  try { var a = Number(p.getProperty('EMT_LAST_REFRESH') || 0); if (a > 0) out.attempted = emtIso(a); } catch (e) { }
  try { var w = liveWindow(Date.now()); out.live = !!w.why; out.liveWhy = w.why || ''; out.liveSince = w.since ? emtIso(w.since) : null; }
  catch (e) { out.liveError = String((e && e.message) || e).slice(0, 120); }
  return out;
}
function emtArtSummary(S) {
  S = S || {};
  var head = 'Articles' + (S.id ? ' (' + S.kind + ' GW' + S.gw + ', ' + S.id + ')' : '') + ': ';
  var did = S.did && S.did.length ? ' (' + S.did.join('; ') + ')' : '';
  var m = {
    paused: 'paused (EMT_ARTICLES_PAUSED = yes).',
    off: 'off: no ANTHROPIC_API_KEY in Script Properties, or EMT_AI_PAUSED = yes.',
    time: 'this run is already busy; the next one carries on.',
    busy: 'another run is working on the articles; try again in a few minutes.',
    idle: 'nothing to write now.' + (S.why && S.why.length ? ' ' + S.why.join('; ') + '.' : ''),
    submitted: 'sent to Claude' + did + '. The runs every 15 minutes collect it.',
    waiting: 'Claude is still on it' + did + '; the next run checks again.',
    wait: 'not this run: ' + (S.error || '') + '. The next run tries again.',
    draft: 'the draft is written (' + (S.words || 0) + ' words, ' + (S.model || '') + (S.punch === 'punch-up not used' ? '; the punch-up was not used, the checked version stands' : '') +
      ') and waits for ' + emtCommish() + ' in the app.',
    live: 'published automatically (' + (S.words || 0) + ' words, ' + (S.model || '') + (S.punch === 'punch-up not used' ? '; the punch-up was not used, the checked version stands' : '') +
      '): every manager can read it in the app now.',
    rewritten: 'the rewrite is done (' + (S.words || 0) + ' words, ' + (S.model || '') + (S.punch === 'punch-up not used' ? '; the punch-up was not used, the checked version stands' : '') +
      ') and replaced the live version.',
    kept: 'the rewrite failed: ' + (S.error || '') + '. The live version stays up as it was.',
    failed: 'failed: ' + (S.error || '') + '.',
    gone: 'its article was dropped or removed; the job stopped.',
    steps: 'worked through several steps' + did + '; the next run carries on.'
  };
  return head + (m[S.stopped] || (S.stopped || 'done') + did);
}
/* menu: Articles: status (also from the editor: articlesStatus()) */
function articlesStatus() {
  var p = emtProps(), job = emtArtJob(), q = emtArtQueue(), meta = emtArtMeta(), L = [];
  L.push('Articles' + (p.getProperty('EMT_ARTICLES_PAUSED') === 'yes' ? ' (paused: EMT_ARTICLES_PAUSED = yes)' : '') + (emtAiOn() ? '' : ' (off: no ANTHROPIC_API_KEY, or EMT_AI_PAUSED = yes)') +
    '. Commissioner: ' + emtCommish() + '. Models: ' + emtModelsLive(emtModelChain('EMT_ARTICLE_MODEL', EMT_ART_MODELS)).join(', ') + '.');
  /* v3.14: the mode */
  L.push(emtArtReview() ? 'Mode: review (EMT_ART_REVIEW = yes): every article waits as a draft until ' + emtCommish() + ' approves it in the app.'
    : 'Mode: auto: an article is published as soon as it passes the checks (EMT_ART_REVIEW = yes makes the commissioner approve each one first).');
  if (job) L.push('Job: the ' + job.kind + ' of GW' + job.gw + ' (' + job.id + '), ' + (job.live ? 'a new version of the live article (the live one stays up), ' : '') + (job.phase === 'research' ? 'researching' : job.phase === 'punch' ? 'punching up what ' + (job.writer || 'the writer') + ' wrote' : 'writing') +
    (job.batch ? ', batch sent ' + Math.round((Date.now() - Number(job.batchAt || 0)) / 60000) + ' minutes ago to ' + job.model : ', its next step is at the next run') +
    ', try ' + ((job.tries || 0) + 1) + ' of ' + EMT_ART_TRIES + (job.redos ? ', rewrite ' + job.redos + ' of ' + EMT_ART_REDOS : '') + '.');
  else {
    L.push('No job running.');
    var d = emtArtDue(false, Date.now());
    if (d.gw) L.push('Next: the ' + d.kind + ' of GW' + d.gw + ' starts at the next run.');
    d.why.forEach(function (w) { L.push('Waiting: ' + w + '.'); });
  }
  if (q.length) L.push('Rewrites waiting their turn: ' + q.join(', ') + '.');
  var pl = emtPunchLast(), pa = pl.article, ps = pl.show;   /* v3.13: the punch-up */
  L.push('Punch-up: ' + (emtPunchOff() ? 'off (EMT_PUNCH_OFF = yes)' : 'on, models ' + emtModelsLive(emtModelChain('EMT_PUNCH_MODEL', EMT_PUNCH_MODELS)).join(', ')) +
    '. Last article: ' + (pa ? pa.id + ', ' + (pa.used ? 'punched up by ' + pa.model : 'not used (' + pa.why + ')') + ', ' + String(pa.at || '').slice(0, 16) : 'none yet') +
    '. Last show: ' + (ps ? 'GW' + ps.gw + ', ' + (ps.used ? 'punched up by ' + ps.model : 'not used (' + ps.why + ')') + ', ' + String(ps.at || '').slice(0, 16) : 'none yet') + '.');
  meta.slice(-6).reverse().forEach(function (m) {
    L.push(m.id + ': ' + m.status + (m.written ? ', written ' + m.written.slice(0, 16) : '') + (m.model ? ' by ' + m.model : '') + (m.approved ? ', approved ' + m.approved.slice(0, 16) : '') +
      (m.redos ? ', ' + m.redos + ' rewrite' + (m.redos > 1 ? 's' : '') : '') + (m.status === 'live' && m.pend === 'writing' ? ', a rewrite under way (the live version stays up)' : m.status === 'live' && m.pend === 'failed' ? ', its last rewrite failed (the live version stayed)' : '') +
      '. Last: ' + emtArtLogLast(m.log).slice(0, 200));
  });
  if (!meta.length) L.push('The Articles tab is empty.');
  var msg = L.join('\n');
  Logger.log(msg);
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) { }   /* no UI from the editor */
  return msg;
}
/* menu: Articles: write now (ignores the windows and EMT_ARTICLES_PAUSED; carries on a running job, else starts the
 * recap of the latest finished gameweek, else the preview of the next deadline) */
function articlesWriteNow() {
  var S;
  try { S = articleTick(Date.now(), true); }
  catch (e) { S = { ok: false, stopped: 'error', error: String((e && e.message) || e), did: [], why: [] }; }
  var msg = S.stopped === 'error' ? 'Articles: error: ' + S.error : emtArtSummary(S);
  Logger.log(msg);
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) { }
  return S;
}

/* =====================================================================================================
 * v3.13 · THE PUNCH-UP — a second, funnier pass over a checked article or show script, checked all over again.
 *   The writers (Sonnet) write the accurate version. The punch-up (Haiku: EMT_PUNCH_MODEL, then claude-haiku-5-5,
 *   claude-haiku-4-5) gets it as JSON with THE READERS (EMT_TONE_LINES) and may only rework the jokes: every fact,
 *   number, name, code, label, heading, source and the shape stay. Then the full checks run again with the same
 *   inputs (emtArticleCheck / emtShowCheck), plus what the checks alone cannot see (emtArtPunchSame /
 *   emtShowPunchSame): the same matchups or chapters in the same order with the same stars, the same number values,
 *   headings, sources and foot, no number the checked version did not have, about the same length.
 *   Articles: a third batch, custom_id <id>-p, after the writing (status stays 'writing'; the checked base waits in
 *   ArticleWork, sealed). Used when it passes: the Model cell reads '<writer> + <punch model>', Log 'punched up by
 *   ...'. Otherwise (a failed check, an errored, expired or lost batch, no punch model left, still unfinished 2 hours
 *   after the punch-up started, the job's 36 hours) the checked base goes out instead, Log 'punch-up not used: <why>'
 *   with the first 5 problems (redacted). Never a try, never a failure. On a rewrite the commissioner's note goes
 *   along. Show: one synchronous call after a checked script (emtShowPunch), skipped once the run is past
 *   EMT_SHOW_WRITE_LATE_MS; the ShowScripts Model cell reads the same way.
 *   EMT_PUNCH_OFF = yes skips both. ?health=1 shows the last outcome of each (EMT_PUNCH_LAST: no draft text).
 *   QUOTA: per article one more batch, ~5k tokens in and out on Haiku at batch prices; per show one ~4k-token call.
 * ===================================================================================================== */
var EMT_PUNCH_MODELS = ['claude-haiku-5-5', 'claude-haiku-4-5'];
var EMT_PUNCH_MAX_MS = 2 * 3600e3;          // an article's punch-up: the checked base goes out 2 hours after it started
var EMT_PUNCH_ART_SYSTEM = [
  'You are the punch-up writer for Matchweek, the app of El Matador Tire, a private FPL Draft league of eight friends. You get a finished article as JSON that has already been fact-checked. Make it funnier for the readers below and change nothing else. Rules: keep every fact, number, name, team name, scoreline, player code, label, heading, source and the JSON shape exactly as they are; never add a number, a fact, a claim or a quote; quotes stay word for word. You may rephrase a sentence, reorder a clause, sharpen a joke, replace a weak joke with a better one built only on facts already in the article, or cut a dead one. Keep each field within about 15 percent of its length. Third person only, never I, we, our or us. No em dashes or en dashes, no emoji, no hashtags. REPLY with the whole JSON object only, no prose, no code fence.',
  ''
].concat(EMT_TONE_LINES).join('\n');
var EMT_PUNCH_SHOW_SYSTEM = [
  'You are the punch-up writer for the Gameweek Show, read aloud by Malcolm Tyre, a fictional British broadcaster with commentary-box calm. You get a finished, fact-checked script as JSON. Make it funnier for the readers below and change nothing else. An audio tag in square brackets ([sighs], [laughing], [deadpan], [whispering]) directs the voice, never the reader: keep, move or drop the ones there, add one only where it lands the joke, at most two on a line and on fewer than half the lines. Keep every fact, number (as digits), name, team name, player code, chapter, beat count and the JSON shape exactly; never add a number, a fact, a claim or a quote. Each beat stays 10 to 22 words. Never say first, next, then, finally, later or last. No em dashes or en dashes, no emoji, no hashtags, no exclamation marks. REPLY with the whole JSON object only, no prose, no code fence.',
  ''
].concat(EMT_TONE_LINES).join('\n');

function emtPunchOff() { return emtProps().getProperty('EMT_PUNCH_OFF') === 'yes'; }
/* the last outcome per pipeline, for ?health and the status logs: { article: { id, used, model, why, at }, show: { gw,
 * used, model, why, at } }. why is a short reason only, never draft text (the problems go to the Log, redacted) */
function emtPunchLast() {
  try { var o = JSON.parse(emtProps().getProperty('EMT_PUNCH_LAST') || '{}'); return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; } catch (e) { return {}; }
}
function emtPunchNote(kind, o) {
  try { var L = emtPunchLast(); o.at = new Date().toISOString(); L[kind] = o; emtProps().setProperty('EMT_PUNCH_LAST', JSON.stringify(L)); } catch (e) { }
}
/* the punch-up may not add a number: every number in the new texts must be one the checked texts already have */
function emtPunchNewNums(before, after) {
  var have = {}, seen = {}, P = [];
  before.forEach(function (t) { emtShowNums(t).forEach(function (n) { have[n] = 1; have[String(Number(n))] = 1; }); });
  after.forEach(function (t) {
    emtShowNums(t).forEach(function (n) {
      if (!have[n] && !have[String(Number(n))] && !seen[n]) { seen[n] = 1; P.push('The punch-up added the number ' + n + ', which the checked version does not have.'); }
    });
  });
  return P;
}

/* ---------- articles: the punch phase of the job (emtArtRun) ---------- */
/* every text of a checked article, in order */
function emtArtTextsOf(a) {
  var t = [a.title, a.sub, a.lede];
  (a.matchups || []).forEach(function (m) {
    t.push(m.kicker, m.story, m.number && m.number.value, m.number && m.number.caption);
    (m.bullets || []).forEach(function (x) { t.push(x); });
  });
  (a.around || []).forEach(function (x) { t.push(x.h, x.body); (x.bullets || []).forEach(function (y) { t.push(y); }); });
  t.push(a.foot);
  return t.map(function (x) { return String(x == null ? '' : x); });
}
/* what the punch-up must have kept, beyond emtArticleCheck. base and C: { article, words } → problems */
function emtArtPunchSame(base, C) {
  var a = base.article, b = C.article, P = [], am = a.matchups || [], bm = b.matchups || [];
  if (bm.length !== am.length) P.push('The matchups must stay ' + am.length + '.');
  am.forEach(function (m, i) {
    var x = bm[i], n = m.home + ' v ' + m.away;
    if (!x || x.home !== m.home || x.away !== m.away) { P.push('Matchup ' + (i + 1) + ' must stay ' + n + ', in the same order.'); return; }
    if (x.star.code !== m.star.code || x.star.label !== m.star.label) P.push(n + ': the star must stay ' + m.star.code + ', ' + m.star.label + '.');
    if (x.number.value !== m.number.value) P.push(n + ': number.value must stay ' + m.number.value + '.');
  });
  var shape = function (o) { return (o.around || []).map(function (x) { return x.h + ':' + (x.bullets || []).length; }).join('|'); };
  if (shape(b) !== shape(a)) P.push('The around sections (headings, order and bullet counts) must stay as they were.');
  if (JSON.stringify(b.sources || []) !== JSON.stringify(a.sources || [])) P.push('The sources must stay exactly as they were.');
  if (b.foot !== a.foot) P.push('The foot must stay exactly as it was.');
  P = P.concat(emtPunchNewNums(emtArtTextsOf(a), emtArtTextsOf(b)));
  var bw = Number(base.words) || 0, pw = Number(C.words) || 0;
  if (bw && (pw < bw * 0.75 || pw > bw * 1.25)) P.push('The punch-up made it ' + pw + ' words from ' + bw + '; every field stays near its length.');
  return P;
}
/* the checked base, kept sealed in ArticleWork: { article, words } or null */
function emtArtPunchBase(job) {
  var s = emtWorkGet(job.id, 'base'), o = s === null ? null : emtArtOpen(s), b = null;
  try { b = o === null ? null : JSON.parse(o); } catch (e) { b = null; }
  return b && b.article && typeof b.article === 'object' && !Array.isArray(b.article) ? b : null;
}
function emtArtPunchParams(job, article, model) {
  var u = 'THE ARTICLE:\n' + JSON.stringify(article);
  if (job.redos && job.note) u += '\n\nTHE COMMISSIONER\'S NOTE (he asked for this rewrite; the punch-up keeps to it too): "' + job.note + '"';
  return { model: model, max_tokens: EMT_ART_PUNCH_MAX_TOKENS, system: EMT_PUNCH_ART_SYSTEM, messages: [{ role: 'user', content: u }] };   /* v3.20 */
}
/* the writing passed the checks: keep it sealed as the base and move to the punch phase (status stays 'writing').
 * → false when the job is over */
function emtArtPunchStart(job, C, S) {
  emtWorkPut(job.id, 'base', emtArtSeal(JSON.stringify({ article: C.article, words: C.words }), emtArtSecret(true)));
  emtWorkClear(job.id, ['fix']);
  job.writer = job.model; job.model = ''; job.phase = 'punch'; job.batch = ''; job.fix = false; job.punchAt = Date.now();
  if (!emtArtJobPut(job)) { S.stopped = 'gone'; return false; }
  emtArtUpdate(job.id, {}, 'written by ' + job.writer + ', ' + C.words + ' words, and it passed the checks; the punch-up is next.', null, job.run || '');
  S.did.push('article checked, punch-up next');
  emtArtSay(job, 'the article passed the checks (' + C.words + ' words, ' + job.writer + '); the punch-up is next.');
  return true;
}
/* the base could not be read back (ArticleWork cleared by hand, or EMT_ART_SEAL deleted): the article is written
 * again, not counted as a try. → false when the job is over */
function emtArtPunchLost(job, S) {
  job.phase = 'write'; job.model = job.writer || ''; job.writer = ''; job.batch = ''; job.fix = false; job.punchAt = 0;
  emtWorkClear(job.id, ['base', 'fix']);
  emtArtUpdate(job.id, {}, 'the checked article could not be read back for the punch-up; it is written again (not counted as a try).', null, job.run || '');
  emtArtSay(job, 'the checked article could not be read back for the punch-up; writing it again (not counted).');
  S.did.push('checked article lost, written again');
  if (!emtArtJobPut(job)) { S.stopped = 'gone'; return false; }
  return true;
}
/* the punch-up is over and the article is done (emtArtDone: v3.14 publishes it, or a draft in review mode). P: the punched-up version, checked ({ article, words });
 * null: the checked base goes out instead. reason: short, no draft text (?health keeps it); detail: the problems, for
 * the Log (redacted there) and the execution log. base: when the caller already read it. */
function emtArtPunchEnd(job, P, reason, detail, S, base) {
  if (!P) {
    base = base || emtArtPunchBase(job);
    if (!base) { emtArtPunchLost(job, S); return; }
  }
  S.did.push(P ? 'punched up by ' + job.model : 'punch-up not used: ' + reason);
  if (P) emtArtDone(job, P, S, { model: job.model });
  else emtArtDone(job, base, S, { why: reason + (detail ? ': ' + detail : '') });
  if (S.written) emtPunchNote('article', { id: job.id, used: !!P, model: P ? job.model : '', why: P ? '' : reason });
}

/* ---------- the show: one call, from showWriterTick ---------- */
/* what the punch-up must have kept, beyond emtShowCheck: the chapters in order with their stars, no beat grown past
 * 22 words, no new number. a, b: checked scripts (digits) → problems */
function emtShowPunchSame(a, b) {
  var P = [], W = function (t) { t = emtShowCaption(t); return t ? t.split(/\s+/).length : 0; };   /* v3.26: tags are not words */
  if (b.chapters.length !== a.chapters.length) P.push('The chapters must stay ' + a.chapters.length + '.');
  a.chapters.forEach(function (c, i) {
    var d = b.chapters[i], n = c.home + ' v ' + c.away;
    if (!d || d.home !== c.home || d.away !== c.away) { P.push('Chapter ' + (i + 1) + ' must stay ' + n + ', in the same order.'); return; }
    if (d.star.h !== c.star.h || d.star.a !== c.star.a) P.push(n + ': the stars must stay ' + c.star.h + ' and ' + c.star.a + '.');
    d.beats.forEach(function (t, k) { var w = W(t); if (w > EMT_SHOW_BEAT_WORDS[1] && w > W(c.beats[k])) P.push(n + ', beat ' + k + ': ' + w + ' words; ' + EMT_SHOW_BEAT_WORDS[1] + ' at most.'); });
  });
  var texts = function (s) { var t = [s.open, s.close]; s.chapters.forEach(function (c) { t = t.concat(c.beats); }); return t; };
  return P.concat(emtPunchNewNums(texts(a), texts(b)));
}
/* W: what emtShowWrite returned (a checked script, and the allowed numbers it was checked against). Never throws.
 * → { script (the punched-up one, or W.script), used, model, why, detail, calls, off } */
function emtShowPunch(gw, W, facts, t0) {
  var out = { script: W.script, used: false, model: '', why: '', detail: '', calls: 0, off: false }, age = Date.now() - (typeof t0 === 'number' ? t0 : Date.now());
  if (emtPunchOff()) { out.off = true; return out; }
  if (age > EMT_SHOW_WRITE_LATE_MS) out.why = 'skipped, the run was already ' + Math.round(age / 1000) + ' seconds old';
  else {
    try {
      var models = emtModelsLive(emtModelChain('EMT_PUNCH_MODEL', EMT_PUNCH_MODELS)), user = 'THE SCRIPT:\n' + JSON.stringify(W.script), r = null;
      for (var i = 0; i < models.length; i++) {
        out.model = models[i];
        r = emtShowAsk(models[i], user, EMT_PUNCH_SHOW_SYSTEM);
        out.calls++;
        if (!r.error || !r.missing) break;
        emtModelNoteGone(models[i], r.msg);
      }
      if (r.error) { out.why = r.missing ? 'no punch-up model is available' : 'the call failed'; out.detail = String(r.error).slice(0, 200); }
      else {
        var c = emtShowCheck(r.text, facts, W.allowed, r.stop), P = c.script ? emtShowPunchSame(W.script, c.script) : c.problems;
        if (P.length) { out.why = 'the check found ' + P.length + ' problem' + (P.length === 1 ? '' : 's'); out.detail = P.slice(0, 5).join(' | '); }
        else { out.script = c.script; out.used = true; }
      }
    } catch (e) { out.why = 'the call failed'; out.detail = String((e && e.message) || e).slice(0, 200); }
  }
  if (!out.used) out.model = '';
  emtPunchNote('show', { gw: gw, used: out.used, model: out.model, why: out.why });
  return out;
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
var EMT_SELF_SRC = 'https://raw.githubusercontent.com/parkerno2/el-matador-tire/release/Code.gs';   // v3.16: the tested release branch (codegs.yml fast-forwards it)
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
