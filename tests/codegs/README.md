# Code.gs tests

Plain Node, no dependencies. Each file mocks the Apps Script services it needs (SpreadsheetApp, PropertiesService, UrlFetchApp, LockService, CacheService, Utilities) and loads `../../Code.gs` in a vm.

```bash
node tests/codegs/v330.js   # the Player of the Month card fills itself: potm.json from the release branch to the Specials rows, a hand edit for the same month kept, bad files and 404s ignored, the Players name with the ß intact, Specials created when missing, ?health=1 potm, the repo's own file checked (v3.30)
node tests/codegs/v329.js   # the feed writer's daily floor: two voice posts by 14:00 Chicago on a quiet day, each voice in its lane, nothing repeated from the last 7 days, off while a gameweek is live (v3.29)
node tests/codegs/v328.js   # the Gameweek Show in dry British commentary: the voice bible and the punch-up brief, 6 to 18 words a beat, at most two subtle tags a show, the approved GW6 script passes (v3.28)
node tests/codegs/v327.js   # the voicing cap per script version: a hand-written rewrite gets its own allowance, at most 3 versions a gameweek, the balance read and the hold unchanged (v3.27)
node tests/codegs/v326.js   # the Gameweek Show on ElevenLabs v4 Turbo: the model and its two settings, audio tags voiced but never captioned, the fallback once with a stable hash (v3.26)
node tests/codegs/v325.js   # the ElevenLabs credit guard: the balance read before a render, the count fallback, the gameweek cap, the hold after a refusal, health, ai.last (v3.25)
node tests/codegs/v324.js   # the Gameweek Show: only current takes served (hash against the script), word times from ElevenLabs' with-timestamps, the last render in health (v3.24)
node tests/codegs/v323.js   # the research budget and its log: 32,000 tokens for the batch calls, the Log says when the budget ran out (v3.23)
node tests/codegs/v322.js   # the Clubs tab mirrors FPL's difficulty ratings: Str H and Str A, the zeroed attack and defence columns dropped (v3.22)
node tests/codegs/v321.js   # per-fixture BPS: the Fixture BPS tab from the draft and classic fixture feeds, for a double gameweek's bonus (v3.21)
node tests/codegs/v320.js   # the writers on the Claude 5.5 models: thinking off for quick calls, room for it in batch calls, old failures retried (v3.20)
node tests/codegs/v319.js   # waiver times (Matchweeks) and waiver order (Standings) in the sheet (v3.19)
node tests/codegs/v318.js   # errors reported by phones: clienterror, the Errors tab, ?health=1 errors (v3.18)
node tests/codegs/v317.js   # ?health=1 data: the last refresh, the live window (v3.17); uses harness.js
node tests/codegs/v315.js   # the facts from the repo: the Facts bot's files, newer-wins, the checks (v3.15)
node tests/codegs/v314.js   # auto-publish, review mode, rewrite of a live article, take down (v3.14)
node tests/codegs/v313.js   # articles, punch-up, model chains, health (v3.13)
node tests/codegs/v312.js   # show writer, self-update (v3.12)
node tests/codegs/show.js   # Gameweek Show voicing (v3.11)
node tests/codegs/test.js   # logins, social, rumours
```

Each one must end with `ALL PASS` (test.js prints its last stored rows instead). The Facts bot's own tests are `node tests/factsbot.js`, the monitor's `node tests/monitor.js`, the app's error reporter's `node tests/app-errors.js`, the sheet reader guard's `node tests/app-tabs.js`, the data source behind the flag `node tests/app-data.js`, the engine's provisional bonus `node tests/app-bonus.js`, the engine's fixture difficulty from the Clubs tab `node tests/app-fdr.js`, the player image framing and the small Plate `node tests/app-faces.js`, the Lineup list view's club crests `node tests/app-crests.js`, the league's config and the engine's tables from it `node tests/app-league.js`, the Feed's Manager of the Month rules and an article leading only while fresh `node tests/app-feed.js`, the Gameweek Show's audio contract, caption clock and the hidden-until-voiced rule `node tests/app-show.js`, the Supabase parity report's `node tests/parity.js`, the status page's `node tests/status.js`, the operator docs' `node tests/app-docs.js`. The CI gate (`.github/workflows/codegs.yml`) runs every `tests/codegs/*.js` and `tests/*.js` by pattern (helpers `*harness*` and `*fixtures*` skipped), so a new suite needs no registration; v315.js checks that pattern. `harness.js` is the shared mock for v317 onwards (not a suite); `v313-fixtures.js` holds the fixtures. Run them before pushing any Code.gs change: `main` goes live within the hour through the self-update. `fixtures/` holds real GW5 and GW6 data from 7 Oct 2026 and the v3.11 Code.gs that the self-update tests use as "the old copy".
