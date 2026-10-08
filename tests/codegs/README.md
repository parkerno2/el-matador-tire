# Code.gs tests

Plain Node, no dependencies. Each file mocks the Apps Script services it needs (SpreadsheetApp, PropertiesService, UrlFetchApp, LockService, CacheService, Utilities) and loads `../../Code.gs` in a vm.

```bash
node tests/codegs/v315.js   # the facts from the repo: the Facts bot's files, newer-wins, the checks (v3.15)
node tests/codegs/v314.js   # auto-publish, review mode, rewrite of a live article, take down (v3.14)
node tests/codegs/v313.js   # articles, punch-up, model chains, health (v3.13)
node tests/codegs/v312.js   # show writer, self-update (v3.12)
node tests/codegs/show.js   # Gameweek Show voicing (v3.11)
node tests/codegs/test.js   # logins, social, rumours
```

Each one must end with `ALL PASS` (test.js prints its last stored rows instead). The Facts bot's own tests are `node tests/factsbot.js`. Run them before pushing any Code.gs change: `main` goes live within the hour through the self-update. `fixtures/` holds real GW5 and GW6 data from 7 Oct 2026 and the v3.11 Code.gs that the self-update tests use as "the old copy".
