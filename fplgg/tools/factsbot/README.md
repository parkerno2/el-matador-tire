# The Facts bot (ROADMAP A0)

The Gameweek Show, the preview article and the recap article are written in the cloud from "facts" the app computes
with its own engine. Until 8 Oct 2026 only a signed-in manager's phone could send them (`showfacts`, `artfacts` in
`src/feed/showfacts.js`), so nothing was written until someone opened the app. The Facts bot sends them from the cloud.

## What it does

`.github/workflows/facts.yml` runs `factsbot.js` every 3 hours (minute 23) and on Actions tab → Facts bot → Run
workflow (`force: yes` writes both kinds whatever the windows). The script:

1. loads the live app (https://parkerno2.github.io/el-matador-tire/) headless in Chromium (Playwright 1.56.1) and
   waits for its data;
2. has the app compute `MW.facts.preview()` and `MW.facts.recap()`, serialised and trimmed exactly as a phone would
   send them (rosters dropped over 60,000 characters; for a recap, bench club and minutes first);
3. applies the phones' windows: preview facts in the last 54 hours before the deadline, recap facts for 5 days after
   the finished gameweek's last kick-off;
4. writes `facts/preview-gw<N>.json` and `facts/recap-gw<N>.json` when the content changed, and `facts/index.json`
   (`files`: for each file its `kind`, `gw`, `at` (when the content last changed), `chars`, `md5`, the app build);
5. the workflow commits them to the repo's **`facts` branch** (orphan; main stays clean and no deploy is triggered).

Code.gs v3.15 (`emtFactsBest`) reads the index from `raw.githubusercontent.com/parkerno2/el-matador-tire/facts/facts/`
whenever a writer wants facts, takes whichever is newer (a phone's post or the repo's file), and checks a repo file
exactly as it checks a phone's post (the gameweek's fixtures; for a recap a finished gameweek with its exact scores).
The repo is the trust anchor: only the Action and the commissioner can write to it, so no secret is involved.

## Run it by hand

```bash
cd fplgg/tools/factsbot && npm ci && npx playwright install chromium
node factsbot.js --out /tmp/facts            # MW_APP_URL=<url> loads another build; MW_FORCE=yes ignores the windows
node ../../../tests/factsbot.js              # the unit tests (windows, shapes, trimming, the index)
```

Exit 1 only when the app cannot be loaded at all. A kind that could not be computed is named in the `failed` output
and the workflow fails after committing what it could.
