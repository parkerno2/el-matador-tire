-- 11 Oct 2026 (S1): the ingest requires a shared secret, so nobody can run it in a loop or poison the tabs through
-- seed-statics. The value lives in two places only: the function secret INGEST_SECRET (set through the Management API
-- by the session, never in this repo) and Vault, as the secret named ingest_secret (vault.create_secret, run by the
-- same session), which the two pg_cron jobs read on every call. This file holds no secret: it only teaches the jobs to
-- send the header. Additive: the jobs keep their ids and schedules (cron.alter_job), nothing is dropped.
do $$
declare
  v_hourly int := (select jobid from cron.job where jobname = 'ingest-hourly');
  v_live int := (select jobid from cron.job where jobname = 'ingest-live');
begin
  if v_hourly is not null then
    perform cron.alter_job(v_hourly, command := $job$
  select net.http_post(
    url := 'https://vcokquhzqpqvwrybndnr.supabase.co/functions/v1/ingest',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-ingest-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'ingest_secret' limit 1)),
    body := '{}'::jsonb,
    timeout_milliseconds := 8000) $job$);
  end if;
  if v_live is not null then
    perform cron.alter_job(v_live, command := $job$
  select net.http_post(
    url := 'https://vcokquhzqpqvwrybndnr.supabase.co/functions/v1/ingest?mode=live',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-ingest-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'ingest_secret' limit 1)),
    body := '{}'::jsonb,
    timeout_milliseconds := 8000) $job$);
  end if;
end $$;
