// fplgg/ingest/supabase/functions/tabs/index.ts — the W3 read endpoint.
//
//   GET /functions/v1/tabs/league/{fplDraftLeagueId}/tab/{Tab Name}   →  { header: [...], rows: [[...]] }
//
// Exactly the body tab_server.js serves locally and demo.html's readTab() consumes when
// LEAGUE_CONFIG.datasource.apiBase is set (apiBase = 'https://<ref>.supabase.co/functions/v1/tabs').
// The app appends '/league/' + fplDraftLeagueId + '/tab/' + name itself — so the URL shape above is
// the contract, not a choice.
//
// Two storage backends, picked by TABS_SOURCE (default 'snapshots'):
//   snapshots — schema-ingest.sql `tab_snapshots`: per-league rows first; if the tab has none, the
//               global copy (league_id null). Per-GW blocks concatenate in numeric block order, which
//               is exactly how the sheet laid GW Stats / Predictions out.
//   v2        — db/schema-v2.sql `tab_rows(league uuid, tab text)` RPC: returns an array of
//               {header: value} objects; we rebuild header/rows from it so the wire shape is identical.
//
// STATUS (25 Aug 2026): written, not yet run against a real project (needs Parker's Supabase account —
// NEXT.md #2). Read-only; anon key is fine until W4 puts membership behind RLS.
// Deploy: supabase functions deploy tabs --no-verify-jwt   (public read; W4 adds auth)

import { createClient } from 'npm:@supabase/supabase-js@2';

const SEASON = Deno.env.get('FPL_SEASON') ?? '2026/27';
const SOURCE = (Deno.env.get('TABS_SOURCE') ?? 'snapshots').toLowerCase();
const CACHE_S = Number(Deno.env.get('TABS_CACHE_SECONDS') ?? '60');

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY')!);

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'authorization, content-type' };
const json = (code: number, body: unknown, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status: code, headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS, ...extra } });

type Row = unknown[];

/** fpl league id → leagues.id (uuid) for the current season; null if unknown. */
async function leagueUuid(fplId: number): Promise<string | null> {
  const { data, error } = await sb.from('leagues').select('id').eq('fpl_league_id', fplId).eq('season', SEASON).maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

/** snapshots backend: rows for one (league|global) scope, blocks concatenated in numeric order. */
async function snapshotTab(leagueId: string | null, tab: string): Promise<{ header: string[] | null; rows: Row[] } | null> {
  let q = sb.from('tab_snapshots').select('header, rows, block').eq('season', SEASON).eq('tab', tab);
  q = leagueId ? q.eq('league_id', leagueId) : q.is('league_id', null);
  const { data, error } = await q;
  if (error) throw error;
  if (!data || !data.length) return null;
  const num = (b: string) => (/^\d+$/.test(b) ? Number(b) : -1);          // 'all' sorts first, then GW blocks 1..38
  data.sort((a, b) => num(a.block as string) - num(b.block as string));
  const rows: Row[] = []; let header: string[] | null = null;
  for (const b of data) { header = header ?? (b.header as string[] | null); rows.push(...(b.rows as Row[])); }
  return { header, rows };
}

/** v2 backend: tab_rows() gives [{col: val}, ...]; rebuild header/rows in first-object key order. */
async function v2Tab(leagueId: string, tab: string): Promise<{ header: string[] | null; rows: Row[] } | null> {
  const { data, error } = await sb.rpc('tab_rows', { p_league: leagueId, p_tab: tab });
  if (error) { if (/unknown tab/.test(error.message)) return null; throw error; }
  const objs = (data ?? []) as Record<string, unknown>[];
  if (!objs.length) return { header: null, rows: [] };
  const header = Object.keys(objs[0]);
  return { header, rows: objs.map(o => header.map(h => o[h] ?? '')) };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'GET') return json(405, { error: 'GET only' });
  const path = new URL(req.url).pathname;

  // /league/{id}/config — the app shell's boot call (added 31 Aug for the per-league URL)
  const mc = path.match(/\/league\/(\d+)\/config\/?$/);
  if (mc) {
    try {
      const { data, error } = await sb.from('leagues').select('name, fpl_league_id, config, status').eq('fpl_league_id', Number(mc[1])).eq('season', SEASON).maybeSingle();
      if (error) throw error;
      if (!data || data.status !== 'active') return json(404, { error: `no league ${mc[1]} for ${SEASON}` });
      return json(200, { name: data.name, fplLeagueId: data.fpl_league_id, config: data.config }, { 'Cache-Control': 'public, max-age=300' });
    } catch (e) { return json(500, { error: String((e as Error).message ?? e) }); }
  }

  // /health — ingest freshness for the status page (last runs + per-league staleness)
  if (/\/health\/?$/.test(path)) {
    try {
      const { data: runs } = await sb.from('ingest_runs').select('started_at, finished_at, ok, error').order('id', { ascending: false }).limit(10);
      const { data: lgs } = await sb.from('leagues').select('id, name, fpl_league_id').eq('season', SEASON).eq('status', 'active');
      const leagues = [];
      for (const lg of lgs ?? []) {
        const { data: t } = await sb.from('tab_snapshots').select('updated_at').eq('league_id', lg.id).eq('tab', 'Standings').maybeSingle();
        leagues.push({ league: lg.fpl_league_id, name: lg.name, standingsUpdated: t?.updated_at ?? null });
      }
      return json(200, { now: new Date().toISOString(), runs: runs ?? [], leagues }, { 'Cache-Control': 'no-store' });
    } catch (e) { return json(500, { error: String((e as Error).message ?? e) }); }
  }

  const m = path.match(/\/league\/(\d+)\/tab\/([^/]+)\/?$/);
  if (!m) return json(404, { error: 'expected /league/{fplDraftLeagueId}/tab/{name}, /league/{id}/config, or /health' });
  const fplId = Number(m[1]), tab = decodeURIComponent(m[2]);
  try {
    const uuid = await leagueUuid(fplId);
    if (!uuid) return json(404, { error: `no league ${fplId} for ${SEASON}` });
    let t: { header: string[] | null; rows: Row[] } | null;
    if (SOURCE === 'v2') t = await v2Tab(uuid, tab);
    else t = (await snapshotTab(uuid, tab)) ?? (await snapshotTab(null, tab));
    if (!t) return json(404, { error: `no such tab \"${tab}\"` });          // a real 404 — gviz's 'first sheet' trap (bug list #5) does not exist here
    return json(200, t, { 'Cache-Control': `public, max-age=${CACHE_S}` });
  } catch (e) {
    return json(500, { error: String((e as Error).message ?? e) });
  }
});
