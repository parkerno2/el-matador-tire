# supabase/

The Supabase project `vcokquhzqpqvwrybndnr` as code: `functions/` (the five edge functions the project runs, deployed
from `main` by `.github/workflows/supabase.yml`), `config.toml` (their settings), `migrations/` (the schema, additive
only), `repairs/` (one-off data fixes, dated, with what they did) and `backups/` (table dumps taken before a change).
What each piece is, the inventory and how to work on it from a session: `fplgg/tools/matchweek/docs/SUPABASE.md`.
`node tests/supabase.js` checks the folder and the ingest's transform.
