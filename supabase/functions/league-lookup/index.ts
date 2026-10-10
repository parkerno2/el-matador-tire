// fplgg/ingest/supabase/functions/league-lookup/index.ts — the create-league wizard's one server call.
//
//   GET /functions/v1/league-lookup?id={fplDraftLeagueId}
//   → { ok:true, league:{id,name,draftStatus,scoring,size}, teams:[{fplEntryId, name, manager, firstName}], warnings:[...] }
//   → { ok:false, error:'...' }  (404 unknown id, 422 not usable yet)
//
// Why it exists: the FPL Draft API sends no CORS headers, so a browser page can't validate a league id
// itself. This proxies exactly one read-only endpoint (/api/league/{id}/details), trims it to what the
// wizard needs, and applies the beta rules in one place (draft must be complete; 4–16 entries).
// The wizard (web/wizard/index.html) also accepts pasted JSON and a demo league, so it works without this.
//
// Deploy: supabase functions deploy league-lookup --no-verify-jwt
// STATUS (25 Aug 2026): written, untested against a project (same blocker as ingest/tabs).

const DRAFT = 'https://draft.premierleague.com/api/';
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'authorization, content-type' };
const json = (code: number, body: unknown) => new Response(JSON.stringify(body), { status: code, headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  const id = Number(new URL(req.url).searchParams.get('id'));
  if (!Number.isInteger(id) || id <= 0) return json(400, { ok: false, error: 'id must be a positive integer (the number in draft.premierleague.com/league/{id}/…)' });
  const r = await fetch(`${DRAFT}league/${id}/details?_cb=${Date.now()}`, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) matchweek-wizard/0.1', 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' } });
  if (r.status === 404) return json(404, { ok: false, error: `No FPL Draft league with id ${id}.` });
  if (!r.ok) return json(502, { ok: false, error: `FPL API answered ${r.status}; try again in a minute.` });
  const body = await r.text();
  let d: Record<string, any>;
  try { d = JSON.parse(body); } catch { return json(502, { ok: false, error: 'FPL answered non-JSON (status ' + r.status + '): ' + body.slice(0, 160) }); }
  const entries = (d.league_entries ?? []) as Record<string, unknown>[];
  const warnings: string[] = [];
  // Drafted-league gate. NOTE (31 Aug 2026): FPL regressed draft_status — it now reads 'pre' for
  // every drafted league (verified against El Matador + random leagues; it read 'post' on 25 Aug).
  // So: drafted = status 'post' OR league closed OR any H2H match already started.
  const drafted = d.league?.draft_status === 'post' || d.league?.closed === true || (d.matches ?? []).some((x: { started?: boolean }) => x.started);
  if (!drafted) return json(422, { ok: false, error: 'This league has not drafted yet — come back once the draft is complete.' });
  if (entries.length < 4 || entries.length > 16) return json(422, { ok: false, error: `Matchweek supports 4–16 teams; this league has ${entries.length}.` });
  if (entries.length % 2) warnings.push(`${entries.length} teams is an odd number — one team sits out each gameweek (FPL handles the byes; Matchweek shows the bye).`);
  if (d.league?.scoring !== 'h') warnings.push('This league uses points scoring, not head-to-head; matchup features will be hidden.');
  return json(200, {
    ok: true,
    league: { id: d.league.id, name: d.league.name, draftStatus: d.league.draft_status, scoring: d.league.scoring, size: entries.length, transactionMode: d.league.transaction_mode },
    teams: entries.map(e => ({ fplEntryId: e.entry_id, name: e.entry_name, manager: `${e.player_first_name ?? ''} ${e.player_last_name ?? ''}`.trim(), firstName: e.player_first_name ?? '' })),
    warnings,
  });
});
