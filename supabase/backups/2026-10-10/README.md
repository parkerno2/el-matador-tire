# Backup of the Supabase project, 10 Oct 2026, 19:31 UTC

Taken by the builder (Q8) through the Management API's query endpoint before the first change to the project, as the
manager's item asked. Each file is `select * from public.<table>` as JSON: `tab_snapshots.json` (the 32 blocks the
`tabs` function serves, 990 kB), `leagues.json` (the one league and its config) and `ingest_runs.json` (the ingest's
log, 1,312 rows). The other 14 tables were empty (`club_fixtures`, `events`, `gw_log`, `gw_stats`, `h2h_fixtures`,
`league_members`, `nation_cache`, `players`, `predictions`, `rosters`, `specials`, `standings`, `transactions`) or
hold a beta invite code (`invites`, 1 row, not committed). The schema as it stood is `../../migrations/20260830201232_baseline.sql`.

To restore a block: `update tab_snapshots set rows = <rows>, header = <header> where league_key = ... and season = ...
and tab = ... and block = ...` through the same query endpoint (`docs/SUPABASE.md` says how).
