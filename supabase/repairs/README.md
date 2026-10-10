# supabase/repairs/

One-off data fixes to the project, one file per repair, dated: the SQL or the script that made it and what it changed.
Each is applied through the Management API's query endpoint by the session that commits it, after a backup under
`../backups/`, and noted in BUGS.md. A repair only adds or rewrites what the Sheet (the reference) holds; the test
`tests/supabase.js` refuses a drop, a delete, a truncate or row-level security turned off in any `.sql` here.
