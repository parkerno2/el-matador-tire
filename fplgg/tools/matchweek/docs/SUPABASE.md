# The Supabase project (ROADMAP B, Q8)

The second data pipeline: the project `vcokquhzqpqvwrybndnr` ("matchweek", region ca-central-1, Postgres 17.6, created
30 Aug 2026) ingests the league from FPL on its own and serves it through a public `tabs` function, the same tab names
and columns the Sheet has. The app reads it behind `?data=supabase` (B3); the Sheet stays the default until the parity
report says every tab agrees (B2). Since 10 Oct 2026 (Parker's decision D-2, the manager's item Q8) the code and the
schema live in this repo under `supabase/` and the functions deploy from `main`.

## The inventory (B1, read on 10 Oct 2026, 19:25 to 19:35 UTC)

Read through the Management API (`GET /v1/projects`, `/functions`, `/health`, read-only SQL through
`POST /v1/projects/{ref}/database/query`). Nothing was changed by the reading.

**Project:** `ACTIVE_HEALTHY`; db, rest, auth (GoTrue v2.197.0) and storage all healthy.

**Edge functions** (all five `ACTIVE`, all public, `verify_jwt` off, last deployed 31 Aug 2026 by hand from a folder
that was never in this repo):

| Function | Version | Does |
|---|---|---|
| `ingest` | 2 | the Code.gs `refreshAll` as a Deno function: fetches FPL (draft and classic), runs the pure transform (`transform.esm.js`) and upserts every tab into `tab_snapshots`; writes a row to `ingest_runs` |
| `tabs` | 2 | `GET /league/{fpl id}/tab/{name}` as `{ header, rows }` from `tab_snapshots` (per-league rows first, then the global copy), `/league/{id}/config`, `/health`; cached 60 s |
| `seed-statics` | 2 | one-shot loader of FC27, EA Map, Ratings and Specials from the Sheet into `tab_snapshots` |
| `league-lookup` | 4 | the setup wizard's read of an FPL Draft league (the FPL API has no CORS) |
| `register-league` | 1 | the wizard's create call, gated by the `invites` table; inserts a league and kicks the first ingest |

The function secrets are only Supabase's own (`SUPABASE_URL`, the keys, `SUPABASE_DB_URL`, `SUPABASE_JWKS`); no
`FPL_SEASON`, `TABS_SOURCE` or `PULSE_SEASON` is set, so the defaults in the code apply (2026/27, `snapshots`, 841).

**Tables** (17 in `public`, row-level security on for every one, no policies, so only the service role the functions
use can read or write; the anon key sees nothing):

| Table | Rows | Newest row | Holds |
|---|---|---|---|
| `tab_snapshots` | 32 | 2026-10-10 19:10 UTC | the data: one row per (league, season, tab, block), `header` and `rows` as JSON, `final` for a frozen block (a trigger refuses to unfreeze it), `meta` (the Ratings version) |
| `ingest_runs` | 1,312 | 2026-10-10 19:10 UTC | the ingest's log: 1,308 ok, 4 failed (4 to 11 Sep 2026) |
| `leagues` | 1 | 2026-08-31 | El Matador Tire (45380, 2026/27), status active, its config JSON (teams, derbies, pot, periods, seeded series, ratings) |
| `invites` | 1 | | one beta invite code |
| `club_fixtures`, `events`, `gw_log`, `gw_stats`, `h2h_fixtures`, `league_members`, `nation_cache`, `players`, `predictions`, `rosters`, `specials`, `standings`, `transactions` | 0 | | the normalised "v2" schema the ingest never writes (`TABS_SOURCE` stays `snapshots`); `nation_cache` is empty because the ingest's nation top-up called pulselive endpoints that answer empty since September (BUGS.md #29) |

The 32 blocks of `tab_snapshots`: Club Fixtures, Clubs, Draft Board, Grades, H2H Fixtures, Matchweeks, Meta, MOTM,
Players, Ratings, Rosters, Standings, Transactions (one block each, refreshed every run), GW Log 1 to 5 (final), GW
Stats 1 to 5 (final) and 6 (live), Predictions 3 to 7, EA Map, FC27 and Specials (from the seed on 31 Aug 2026,
never refreshed since). The per-league rows carry `league_id`; the global ones (Clubs, Club Fixtures, Matchweeks,
Players, Predictions, GW Stats, EA Map, FC27) carry null and `league_key = 'global'`.

**pg_cron** (jobs active, every run `succeeded`): `ingest-hourly` at :07 calls the ingest; `ingest-live` every 10
minutes calls it with `?mode=live`, and the function exits at once unless a Premier League match is inside its live
window (kick-off minus 15 minutes to plus 2 h 45). pg_net's reply log shows the function answering 200 with
`{ ok: true, leagues: [{ league: 45380, curEv: 6, tabs: 17 }] }` on every call that ran.

**Is the ingest alive?** Yes. The last run finished at 19:10:04 UTC on 10 Oct 2026, 3 to 5 seconds a run, every
run of the day ok, Standings and the live GW Stats block refreshed within the hour, and `tabs/health` says the same.

**What the inventory also found:** the Management API's `logs.all` analytics endpoint has been removed and the
replacement answered that the function log tables do not exist for this project, so the function console logs
were not read; the ingest's own log is `ingest_runs` plus pg_net's reply bodies, which say what each run did.

## Working on the project from a session (no PC)

- **Read anything:** the Management API with the environment's network secret for `api.supabase.com` (the proxy
  adds the token; never print it). Read-only SQL: `POST /v1/projects/vcokquhzqpqvwrybndnr/database/query` with
  `{ "query": "select ..." }`.
- **Change the code:** edit `supabase/functions/<name>/`, run `node tests/supabase.js`, push to `main`. The workflow
  `.github/workflows/supabase.yml` (Actions: Supabase functions) tests the folder and deploys every function with the
  CLI (`supabase functions deploy --use-api`, the settings in `supabase/config.toml`) using the repository secret
  `SUPABASE_ACCESS_TOKEN`. The run's last step lists each function's new version. A function is live the moment the
  run is green; the next cron call runs it. Never deploy by hand from a laptop again: the repo is the source of truth.
- **Change the schema:** write `supabase/migrations/<timestamp>_<name>.sql` (additive only: the test refuses a drop,
  a delete, a truncate or row-level security turned off), apply it through the query endpoint, and commit the file.
  The workflow does not apply migrations (that needs the database password, which no session holds).
- **Repair data:** a one-off fix (a block rewritten from the Sheet, a row added) is a file under `supabase/repairs/`
  with the SQL or the script that made it, dated, applied through the query endpoint by the session, and noted in
  BUGS.md. Take a backup first: `select * from public.<table>` as JSON under `supabase/backups/<date>/`.
- **Check the result:** `node fplgg/tools/parity/parity.js` compares every tab with the Sheet now; the workflow
  Supabase parity does the same every 3 hours.
- **Run the ingest now:** `GET https://vcokquhzqpqvwrybndnr.supabase.co/functions/v1/ingest` (what the cron calls).

## Where the ingest and the Sheet differ (BUGS.md #29) and what fixes each

| Gap | Fix |
|---|---|
| Standings `Waiver pick`, Matchweeks `Waivers (UTC)`, Clubs `Str H` and `Str A` | the transform writes the columns Code.gs v3.19 and v3.22 added |
| Transactions `Result` with an em dash, `do` unmapped | the transform carries Code.gs's `TX_RESULT` labels |
| Players and Rosters `Nation` blank for 510 players | the nation top-up reads pulselive's season players list, as Code.gs does since September |
| Fixture BPS missing | the transform builds the tab from the live feed's fixtures (Code.gs v3.21) |
| Specials: no `API URL` row, POTM rows blank | the ingest keeps the rows it has, syncs POTM from `potm.json` on `release` as Code.gs v3.30 does, and the API URL row is a one-off repair |
| Predictions GW2 missing, GW Stats and GW Log GW1 differing (written on 31 Aug from the then-current feed) | one-off repairs from the Sheet's rows (`supabase/repairs/`) |
| Managers, Social, Posts | not the ingest's: the web app writes them (logins, social); they move with Code.gs's jobs later (B3) |

## What was done on 10 Oct 2026 (Q8) and what is left

- 19:38 UTC: the five functions redeployed from the repo unchanged (Supabase functions run 1, every function one
  version up). 19:42: the ingest fixes deployed (run 2). 19:44 and 19:46: the ingest run by hand (`GET .../ingest`,
  what the cron calls): 18 tabs, Fixture BPS 186 rows, the POTM rows written (Groß, September 2026), 944 nations
  cached. Repairs through the query endpoint: the `API URL` row appended to Specials (19:42), Predictions GW2 inserted
  from the Sheet (19:45, `supabase/repairs/sheet-block.js`). The parity report: 7 of 18 agreeing at 19:28, 11 at the
  end (the two Nation cells left were players pulselive's list lacks; the fallback table carries them since the third
  commit, so the next hourly run closes them).
- Left: the frozen GW1 blocks of GW Stats (22 cells) and GW Log (6 rows each way, 17 cells), both written by the
  ingest on 31 Aug 2026 from the then-current feed. The repair is one command each, generated from the Sheet:
  `node supabase/repairs/sheet-block.js --tab "GW Stats" --gw 1 --block 1 --final --apply` and
  `node supabase/repairs/sheet-block.js --tab "GW Log" --gw 1 --block 1 --final --league-key dfb6f97f-9dbf-419e-ac49-2f725cdf4423 --apply`;
  the builder's permission check refused a rewrite of existing rows in this run, so the manager or Parker runs them
  (without `--apply` the script prints the SQL). Managers, Social and Posts are the web app's tabs (B3).
