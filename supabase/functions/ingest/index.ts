// supabase/functions/ingest/index.ts — the Code.gs `refreshAll` trigger, as a Supabase Edge Function (Deno).
// Scheduled by pg_cron through net.http_post (hourly at :07, and every 10 minutes with ?mode=live), or called by
// hand. Deployed from this repo by .github/workflows/supabase.yml (docs/SUPABASE.md). The pure pipeline is
// ./transform.esm.js (tests/supabase.js runs it); everything Supabase-specific is in this file.
//
// 10 Oct 2026 (Q8, BUGS.md #29): the nation top-up reads pulselive's season players list (the endpoints the first
// version called answer empty since September, so nation_cache stayed empty); the Fixture BPS tab is written every
// run; the Specials tab keeps its rows and syncs the Player of the Month from the repo's potm.json on the release
// branch, as Code.gs v3.30 does.
//
// Freeze discipline, unchanged from the sheet:
//   Predictions — build() only ever emits the block for the next un-passed deadline; we upsert that
//                 block and never touch older ones → frozen forever after the deadline.
//   GW Stats    — final blocks written once (we pass the set of already-final GWs into build());
//                 the live block for the current GW is upserted every run.
//   GW Log      — appended once per finished GW (set of logged GWs passed in), never rewritten.
//   Ratings     — existing frozen OVRs are read back and passed in; same RATINGS_VERSION semantics.

import Ingest from './transform.esm.js';
import { createClient } from 'npm:@supabase/supabase-js@2';

const DRAFT = 'https://draft.premierleague.com/api/';
const CLASSIC = 'https://fantasy.premierleague.com/api/';
const SEASON = Deno.env.get('FPL_SEASON') ?? '2026/27';

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

async function getJson(url: string, optional = false) {
  const r = await fetch(url, { headers: { 'User-Agent': 'matchweek-ingest/0.1' } });
  if (!r.ok) { if (optional) return null; throw new Error(`${url} → ${r.status}`); }
  return r.json();
}

type Row = unknown[];
interface Tab { header: string[] | null; rows: Row[]; blocks?: { gw: number; final: boolean; rows: Row[] }[]; gw?: number | null; version?: string }

/** Read a whole tab back as rows (all blocks concatenated) — same shape gviz gave the app. */
async function readTab(leagueId: string | null, tab: string): Promise<{ header: string[] | null; rows: Row[] }> {
  let q = sb.from('tab_snapshots').select('header, rows, block').eq('tab', tab).order('block');
  q = leagueId ? q.eq('league_id', leagueId) : q.is('league_id', null);
  const { data, error } = await q;
  if (error) throw error;
  const rows: Row[] = [];
  let header: string[] | null = null;
  for (const b of data ?? []) { header = header ?? (b.header as string[] | null); rows.push(...(b.rows as Row[])); }
  return { header, rows };
}

async function writeBlock(leagueId: string | null, tab: string, block: string, header: string[] | null, rows: Row[], extra: Record<string, unknown> = {}) {
  const { error } = await sb.from('tab_snapshots').upsert(
    { league_id: leagueId, season: SEASON, tab, block, header, rows, updated_at: new Date().toISOString(), ...extra },
    { onConflict: 'league_key,season,tab,block' });
  if (error) throw error;
}

/** Statics = what Code.gs read back from the sheet before computing. Here: from our own tables. */
async function loadStatics(leagueId: string, cfg: Record<string, unknown>) {
  const st: Record<string, unknown> = {};
  const ratings = await readTab(leagueId, 'Ratings');
  const existing: Record<string, number> = {};
  for (const r of ratings.rows) if (r[0]) existing[Ingest.normName(r[0]) + '|' + r[1]] = r[4] as number;
  st.existingRatings = existing;
  const { data: meta } = await sb.from('tab_snapshots').select('meta').eq('league_id', leagueId).eq('tab', 'Ratings').maybeSingle();
  st.ratingsVersion = meta?.meta?.version ?? null;
  // FC27 / EA Map: static uploads live in global tab_snapshots (league_id null) until house OVR replaces them (W6)
  const tbl = async (tab: string, codeH: string, ovrH: string) => {
    const t = await readTab(null, tab); const m: Record<string, number> = {};
    if (!t.header) return m;
    const ci = t.header.indexOf(codeH), oi = t.header.indexOf(ovrH);
    if (ci < 0 || oi < 0) return m;
    for (const r of t.rows) { const c = String(r[ci]).replace(/\.0$/, ''), o = parseFloat(String(r[oi])); if (c && o) m[c] = Math.round(o); }
    return m;
  };
  st.fc27 = await tbl('FC27', 'fpl_code', 'ea_ovr_fc27');
  st.fc26 = await tbl('EA Map', 'fpl_code', 'ea_ovr_fc26');
  const { data: nat } = await sb.from('nation_cache').select('code, iso');
  st.natMap = Object.fromEntries((nat ?? []).map((n: { code: number; iso: string }) => [String(n.code), n.iso]));
  const { data: gs } = await sb.from('tab_snapshots').select('block, final').eq('tab', 'GW Stats').is('league_id', null);
  st.gwStatsFinal = Object.fromEntries((gs ?? []).filter((b: { final: boolean }) => b.final).map((b: { block: string }) => [b.block, true]));
  const { data: gl } = await sb.from('tab_snapshots').select('block').eq('tab', 'GW Log').eq('league_id', leagueId);
  st.gwLogLogged = Object.fromEntries((gl ?? []).map((b: { block: string }) => [b.block, true]));
  void cfg;
  return st;
}

/** Nation map top-up (pulselive's season players list, as Code.gs getNationMap reads it since September 2026), only
 *  when a needed code is missing from nation_cache and the fallback table. Pages of 100, at most 20 pages, every
 *  (code, iso) pair upserted into nation_cache, so the next run's Players and Rosters carry the nation. */
async function topUpNations(codes: string[], have: Record<string, string>): Promise<{ missing: number; added: number; error?: string }> {
  const missing = codes.filter((c) => c && !have[c] && !(Ingest.NATFALLBACK as Record<string, string>)[c]);
  if (!missing.length) return { missing: 0, added: 0 };
  const season = Deno.env.get('PULSE_SEASON') ?? '841';
  const hdr = { Origin: 'https://www.premierleague.com', Referer: 'https://www.premierleague.com/' };
  const rows: { code: number; iso: string }[] = [];
  try {
    let page = 0, total = 1;
    while (page * 100 < total && page < 20) {
      const r = await fetch(Ingest.pulsePlayersUrl(season, page), { headers: hdr });
      if (!r.ok) throw new Error(`pulselive players page ${page} → ${r.status}`);
      const got = Ingest.pulseNations(await r.json()) as { rows: { code: number; iso: string }[]; total: number };
      total = got.total; rows.push(...got.rows); page++;
    }
    const seen = new Set<number>();
    const fresh = rows.filter((x) => !seen.has(x.code) && seen.add(x.code));
    if (fresh.length) { const { error } = await sb.from('nation_cache').upsert(fresh, { onConflict: 'code' }); if (error) throw error; }
    return { missing: missing.length, added: fresh.length };
  } catch (e) { console.warn('nation top-up failed', e); return { missing: missing.length, added: 0, error: String(e) }; }
}

/** The Player of the Month file on the release branch (Code.gs v3.30 EMT_POTM_SRC): { month, code, player } or null. */
const POTM_SRC = 'https://raw.githubusercontent.com/parkerno2/el-matador-tire/release/fplgg/tools/matchweek/data/potm.json';
async function readPotm(): Promise<{ month: string; code: string; player: string } | null> {
  try {
    const r = await fetch(`${POTM_SRC}?cb=${Date.now()}`);
    if (!r.ok) return null;
    const text = await r.text();
    if (text.length > 4000) return null;
    return Ingest.potmFile(JSON.parse(text)) as { month: string; code: string; player: string } | null;
  } catch { return null; }
}

/** Specials: the tab keeps every row it has (the API URL, hand edits) and the two POTM rows follow potm.json. */
async function syncSpecials(leagueId: string, players: Row[]): Promise<{ wrote: unknown; rows: number }> {
  const have = await readTab(leagueId, 'Specials');
  const file = await readPotm();
  const out = Ingest.specialsRows(have.rows, file, players) as { rows: Row[]; wrote: { month: string; player: string } | null };
  const changed = JSON.stringify(out.rows) !== JSON.stringify(have.rows) || have.header === null;
  if (changed) await writeBlock(leagueId, 'Specials', 'all', ['Setting', 'Value'], out.rows);
  return { wrote: out.wrote, rows: out.rows.length };
}

async function ingestLeague(league: { id: string; fpl_league_id: number; config: Record<string, unknown> }, global: { boot: unknown; classic: unknown }) {
  const L = league.fpl_league_id;
  const details = await getJson(`${DRAFT}league/${L}/details`);
  const statics = await loadStatics(league.id, league.config);
  const plan = Ingest.fetchPlan(L, global.boot, details, statics);
  const results = [];
  for (let i = 0; i < plan.plan.length; i += 6) {
    const batch = plan.plan.slice(i, i + 6);
    results.push(...await Promise.all(batch.map(async (it: { path: string; optional?: boolean }) => ({ item: it, json: await getJson(DRAFT + it.path, !!it.optional) }))));
  }
  const raw = Ingest.assemble(global.boot, details, results);
  raw.classic = global.classic;
  const cfgOverrides = (league.config as { ingest?: Record<string, unknown> }).ingest ?? {}; // prizes / motmPeriods / ratings / midseasonGw
  const T = Ingest.build(raw, statics, { now: new Date(), config: cfgOverrides }) as Record<string, Tab>;

  // ---- per-league tabs (one block each) ----
  for (const tab of ['Grades', 'Draft Board', 'Rosters', 'H2H Fixtures', 'Transactions', 'Standings', 'MOTM', 'Meta'])
    await writeBlock(league.id, tab, 'all', T[tab].header, T[tab].rows);
  await writeBlock(league.id, 'Ratings', 'all', T.Ratings.header, T.Ratings.rows, { meta: { version: T.Ratings.version } });
  if (T['GW Log'].rows) await writeBlock(league.id, 'GW Log', String(T['GW Log'].gw), T['GW Log'].header, T['GW Log'].rows, { final: true });
  const specials = await syncSpecials(league.id, T.Players.rows as Row[]);

  // ---- global tabs (same for every league; written by the first league of the cycle, cheap to repeat) ----
  for (const tab of ['Clubs', 'Club Fixtures', 'Matchweeks', 'Players'])
    await writeBlock(null, tab, 'all', T[tab].header, T[tab].rows);
  if (T.Predictions.gw) await writeBlock(null, 'Predictions', String(T.Predictions.gw), T.Predictions.header, T.Predictions.rows);
  for (const b of T['GW Stats'].blocks ?? []) await writeBlock(null, 'GW Stats', String(b.gw), T['GW Stats'].header, b.rows, { final: b.final });
  // Fixture BPS (Code.gs v3.21): the current gameweek only, rewritten every run; left as it was when no feed lists the fixtures
  if (T['Fixture BPS'].rows) await writeBlock(null, 'Fixture BPS', 'all', T['Fixture BPS'].header, T['Fixture BPS'].rows);

  const nations = await topUpNations((T.Players.rows as Row[]).map((r) => String(r[0])), statics.natMap as Record<string, string>);
  const meta = T._meta as { curEv: number; classicOverlay?: { used: number; seen: number } };
  return { league: L, curEv: meta.curEv, tabs: Object.keys(T).length, classicOverlay: meta.classicOverlay ?? null, fixtureBps: T['Fixture BPS'].rows ? T['Fixture BPS'].rows.length : null, specials, nations };
}

Deno.serve(async (req) => {
  const started = new Date().toISOString();
  const out: unknown[] = [];
  try {
    const url = new URL(req.url);
    const only = url.searchParams.get('league'); // optional: ingest one league by fpl id
    let q = sb.from('leagues').select('id, fpl_league_id, config').eq('status', 'active').eq('season', SEASON);
    if (only) q = q.eq('fpl_league_id', Number(only));
    const { data: leagues, error } = await q;
    if (error) throw error;
    // live-cadence gate: a ?mode=live call (the 10-minute cron) only proceeds while a PL fixture is
    // in its live window (kickoff −15 min … +2 h 45 min); otherwise it exits after one cheap fetch.
    // The hourly cron never passes mode=live, so deadline captures and freezes are unaffected.
    const mode = url.searchParams.get('mode');
    if (mode === 'live') {
      const fx = await getJson(`${CLASSIC}fixtures/`, true) ?? [];
      const now = Date.now();
      const live = (fx as { kickoff_time?: string; finished?: boolean; finished_provisional?: boolean }[]).some((f) =>
        f.kickoff_time && !f.finished &&
        now >= Date.parse(f.kickoff_time) - 15 * 60e3 && now <= Date.parse(f.kickoff_time) + 165 * 60e3);
      if (!live) return Response.json({ ok: true, mode: 'live', skipped: 'no fixtures in a live window' });
    }
    // global fetches ONCE per cycle, shared by every league
    const boot = await getJson(`${DRAFT}bootstrap-static`);
    const cboot = await getJson(`${CLASSIC}bootstrap-static/`, true);
    const cfx = await getJson(`${CLASSIC}fixtures/`, true);
    const evs = boot.events.data ?? boot.events;
    const lastDone = evs.filter((e: { finished: boolean }) => e.finished).map((e: { id: number }) => e.id).pop();
    const dream = lastDone ? await getJson(`${CLASSIC}dream-team/${lastDone}/`, true) : null;
    // classic live overlay (v3.2 port): the classic event/{gw}/live feed repairs a frozen draft feed
    const curEvG = (evs.find((e: { finished: boolean }) => !e.finished) ?? {}).id ?? null;
    const clive = curEvG ? await getJson(`${CLASSIC}event/${curEvG}/live/`, true) : null;
    const global = { boot, classic: { boot: cboot, fixtures: cfx, dream, live: clive } };
    for (const lg of leagues ?? []) {
      try { out.push(await ingestLeague(lg, global)); }
      catch (e) { out.push({ league: lg.fpl_league_id, error: String(e) }); }
    }
    await sb.from('ingest_runs').insert({ started_at: started, finished_at: new Date().toISOString(), ok: true, error: null });
    return Response.json({ ok: true, started, leagues: out });
  } catch (e) {
    await sb.from('ingest_runs').insert({ started_at: started, finished_at: new Date().toISOString(), ok: false, error: String(e) });
    return Response.json({ ok: false, error: String(e), leagues: out }, { status: 500 });
  }
});
