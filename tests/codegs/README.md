# Code.gs tests

Plain Node, no dependencies. Each file mocks the Apps Script services it needs (SpreadsheetApp, PropertiesService, UrlFetchApp, LockService, CacheService, Utilities) and loads `../../Code.gs` in a vm.

```bash
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

Each one must end with `ALL PASS` (test.js prints its last stored rows instead). The Facts bot's own tests are `node tests/factsbot.js`, the monitor's `node tests/monitor.js`, the app's error reporter's `node tests/app-errors.js`, the sheet reader guard's `node tests/app-tabs.js`, the engine's provisional bonus `node tests/app-bonus.js`. `harness.js` is the shared mock for v317 onwards (not a suite); `v313-fixtures.js` holds the fixtures. Run them before pushing any Code.gs change: `main` goes live within the hour through the self-update. `fixtures/` holds real GW5 and GW6 data from 7 Oct 2026 and the v3.11 Code.gs that the self-update tests use as "the old copy".
