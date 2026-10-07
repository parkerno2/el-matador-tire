# ops/

Plain scheduled checks that run on GitHub, not on anyone's computer and not through an AI.

## Monitor (`monitor.mjs`, workflow `Monitor`, every 10 minutes)

| Check | Fails when |
|---|---|
| app | the app page or any script or stylesheet it names doesn't load |
| sheet | the Meta tab's Updated time is older than 130 min (35 min while a PL match is on, same window as `liveTick`) |
| appsScript | the web app in Specials → API URL doesn't answer with JSON (logins, profiles, the refresh button) |
| supabase | the Matchweek ingest hasn't run in 130 min, its last run failed, or a league's data is old |

A failing check is retried once after 30 s. When anything still fails it also checks the FPL API, and says so if FPL is down too.

**Set up the phone alerts (5 minutes):**
1. Install the ntfy app (iOS or Android) and subscribe to a topic with a long random name, for example `emt-` plus 20 random letters. Anyone who knows the name can read it, so don't share it.
2. In this repo: Settings → Secrets and variables → Actions → New repository secret, name `NTFY_TOPIC`, value the topic name.
3. Actions → Monitor → Run workflow, to see it go green.
4. Optional: make a free check at healthchecks.io (period 10 min, grace 30 min), add its ping URL as the secret `HEALTHCHECK_URL`, and point its alerts at the ntfy app too. That tells you if GitHub stops running the monitor.

Test locally without alerting: `DRY_RUN=1 node ops/monitor.mjs`. Alert logic tests: `node ops/monitor.test.mjs`.

GitHub turns off scheduled workflows in a public repo after 60 days with no commits. When that happens the healthchecks.io check is what notices.
