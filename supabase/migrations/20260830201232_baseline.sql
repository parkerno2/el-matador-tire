-- The Supabase project vcokquhzqpqvwrybndnr (matchweek) as it stood on 10 Oct 2026, read from the catalog by the
-- builder (Q8, ROADMAP B1). The project was created on 30 Aug 2026 and its schema was never in this repo; this file
-- is the baseline every later migration builds on. Every statement is idempotent (if not exists, or guarded), so
-- applying it to the live project changes nothing. It never drops, deletes or loosens anything.
--
-- What holds the data: tab_snapshots, one row per (league, season, tab, block) with the tab's header and rows as the
-- app reads them (the same shape gviz gives it), written by the ingest function and served by the tabs function.
-- The normalised tables below (players, gw_stats, standings, ...) exist but are empty: the W2 plan's second
-- backend ("v2") was never switched on (TABS_SOURCE stays "snapshots").

create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ---------- leagues and membership ----------
create table if not exists public.leagues (
  id uuid primary key default gen_random_uuid(),
  fpl_league_id integer not null,
  season text not null,
  name text not null,
  config jsonb not null,
  status text not null default 'active',
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  unique (fpl_league_id, season)
);
create table if not exists public.league_members (
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  fpl_entry_id integer,
  joined_at timestamptz default now(),
  primary key (league_id, user_id)
);
create table if not exists public.invites (
  code text primary key,
  league_id uuid references public.leagues(id) on delete cascade,
  created_by uuid references auth.users(id),
  expires_at timestamptz,
  max_uses integer default 20,
  uses integer default 0
);

-- ---------- the snapshots the app reads ----------
create table if not exists public.tab_snapshots (
  league_id uuid references public.leagues(id) on delete cascade,
  league_key text generated always as (coalesce(league_id::text, 'global')) stored,
  season text not null,
  tab text not null,
  block text not null default 'all',
  header jsonb,
  rows jsonb not null,
  final boolean not null default false,
  meta jsonb,
  updated_at timestamptz not null default now(),
  unique (league_key, season, tab, block)
);
create index if not exists tab_snapshots_read on public.tab_snapshots (league_key, season, tab, block);

create or replace function public.tab_snapshots_freeze() returns trigger language plpgsql as $$
begin
  if old.final and not new.final then raise exception 'tab_snapshots: % block % is frozen', old.tab, old.block; end if;
  return new;
end $$;
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'tab_snapshots_freeze_trg') then
    create trigger tab_snapshots_freeze_trg before update on public.tab_snapshots for each row execute function public.tab_snapshots_freeze();
  end if;
end $$;

-- ---------- the ingest's log and its nation cache ----------
create table if not exists public.ingest_runs (
  id bigint generated always as identity primary key,
  league_id uuid,
  started_at timestamptz default now(),
  finished_at timestamptz,
  ok boolean,
  error text
);
create table if not exists public.nation_cache (
  code integer primary key,
  iso text not null
);

-- ---------- the normalised tables (the unused v2 backend; empty) ----------
create table if not exists public.players (
  code integer not null, season text not null, web_name text not null, full_name text, position text not null, club text not null,
  nation text, fpl_id integer, draft_id integer, ep_this numeric, ep_next numeric, status text,
  primary key (code, season)
);
create table if not exists public.gw_stats (
  code integer not null, season text not null, gw integer not null,
  minutes integer, goals integer, assists integer, cs boolean, goals_conceded integer, saves integer, bonus integer, yc integer, rc integer,
  pens_missed integer, pens_saved integer, own_goals integer, defcon integer, total_points integer, xg numeric, xa numeric, xgc numeric,
  final boolean not null default false, updated_at timestamptz default now(),
  primary key (code, season, gw)
);
create table if not exists public.predictions (
  code integer not null, season text not null, gw integer not null, ep_this numeric,
  captured_at timestamptz not null default now(), frozen boolean not null default false,
  primary key (code, season, gw)
);
create table if not exists public.club_fixtures (
  season text not null, gw integer not null, fixture_id integer not null, home text not null, away text not null,
  kickoff timestamptz, home_goals integer, away_goals integer, started boolean default false, finished boolean default false, minutes integer,
  primary key (season, fixture_id)
);
create table if not exists public.events (
  season text not null, gw integer not null, deadline_at timestamptz not null, finished boolean default false,
  primary key (season, gw)
);
create table if not exists public.rosters (
  league_id uuid not null references public.leagues(id) on delete cascade, code integer not null, fpl_entry_id integer not null,
  slot text, updated_at timestamptz default now(),
  primary key (league_id, code)
);
create table if not exists public.h2h_fixtures (
  league_id uuid not null references public.leagues(id) on delete cascade, gw integer not null, entry_a integer not null, entry_b integer not null,
  points_a numeric, points_b numeric, finished boolean default false,
  primary key (league_id, gw, entry_a)
);
create table if not exists public.standings (
  league_id uuid not null references public.leagues(id) on delete cascade, fpl_entry_id integer not null,
  wins integer, draws integer, losses integer, h2h_points integer, points_for numeric, rank integer, updated_at timestamptz default now(),
  primary key (league_id, fpl_entry_id)
);
create table if not exists public.transactions (
  league_id uuid not null references public.leagues(id) on delete cascade, tx_id integer not null,
  gw integer, fpl_entry_id integer, kind text, result text, player_in integer, player_out integer, occurred_at timestamptz,
  primary key (league_id, tx_id)
);
create table if not exists public.gw_log (
  league_id uuid not null references public.leagues(id) on delete cascade, gw integer not null, fpl_entry_id integer not null, code integer not null,
  slot text, points integer, in_xi boolean,
  primary key (league_id, gw, fpl_entry_id, code)
);
create table if not exists public.specials (
  league_id uuid not null references public.leagues(id) on delete cascade, key text not null, value jsonb,
  primary key (league_id, key)
);

-- ---------- row-level security: on for every table, no policies, so only the service role (the functions) reads or writes ----------
alter table public.leagues enable row level security;
alter table public.league_members enable row level security;
alter table public.invites enable row level security;
alter table public.tab_snapshots enable row level security;
alter table public.ingest_runs enable row level security;
alter table public.nation_cache enable row level security;
alter table public.players enable row level security;
alter table public.gw_stats enable row level security;
alter table public.predictions enable row level security;
alter table public.club_fixtures enable row level security;
alter table public.events enable row level security;
alter table public.rosters enable row level security;
alter table public.h2h_fixtures enable row level security;
alter table public.standings enable row level security;
alter table public.transactions enable row level security;
alter table public.gw_log enable row level security;
alter table public.specials enable row level security;

-- ---------- the ingest's schedule (pg_cron calls the function through pg_net) ----------
-- hourly at :07, and every 10 minutes in live mode (the function itself exits unless a match is in its live window)
do $$
begin
  if not exists (select 1 from cron.job where jobname = 'ingest-hourly') then
    perform cron.schedule('ingest-hourly', '7 * * * *', $job$
  select net.http_post(
    url := 'https://vcokquhzqpqvwrybndnr.supabase.co/functions/v1/ingest',
    body := '{}'::jsonb,
    timeout_milliseconds := 8000) $job$);
  end if;
  if not exists (select 1 from cron.job where jobname = 'ingest-live') then
    perform cron.schedule('ingest-live', '*/10 * * * *', $job$
  select net.http_post(
    url := 'https://vcokquhzqpqvwrybndnr.supabase.co/functions/v1/ingest?mode=live',
    body := '{}'::jsonb,
    timeout_milliseconds := 8000) $job$);
  end if;
end $$;
