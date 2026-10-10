// fplgg/ingest/supabase/functions/register-league/index.ts — the wizard's "Create league" call.
//
//   POST /functions/v1/register-league   body: { inviteCode: string, config: <league-config.md JSON> }
//   → 200 { ok:true, appUrl, note }      league inserted, first ingest kicked off in the background
//   → 4xx { ok:false, error }            bad code / bad config / league not usable / already registered
//
// Gate: the `invites` table (db/schema.sql) — a row's code with uses < max_uses and not expired.
// Mint codes with:  insert into invites (code, max_uses) values ('friendly-league-1', 3);
// Each successful registration increments uses. No auth accounts needed for the closed beta;
// W4 replaces this with real membership (created_by, claimed teams).
// STATUS (31 Aug 2026): written for the beta launch push. Deploy with JWT verification OFF (public POST,
// gated by the invite code itself).

import { createClient } from 'npm:@supabase/supabase-js@2';

const SEASON = Deno.env.get('FPL_SEASON') ?? '2026/27';
const DRAFT = 'https://draft.premierleague.com/api/';
const APP_URL = Deno.env.get('APP_URL') ?? 'https://www.matchweek.gg/app.html';
const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'authorization, content-type' };
const json = (code: number, body: unknown) => new Response(JSON.stringify(body), { status: code, headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS } });

type Cfg = { league?: { fplDraftLeagueId?: number; name?: string; size?: number }; teams?: { monogram?: string }[] };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json(405, { ok: false, error: 'POST only' });
  let body: { inviteCode?: string; config?: Cfg };
  try { body = await req.json(); } catch { return json(400, { ok: false, error: 'Body must be JSON: { inviteCode, config }' }); }
  const code = String(body.inviteCode ?? '').trim();
  const cfg = body.config;

  // ---- invite gate ----
  if (!code) return json(400, { ok: false, error: 'An invite code is required during the beta.' });
  const { data: inv } = await sb.from('invites').select('code, max_uses, uses, expires_at').eq('code', code).maybeSingle();
  if (!inv || (inv.expires_at && Date.parse(inv.expires_at) < Date.now()) || inv.uses >= inv.max_uses)
    return json(403, { ok: false, error: 'That invite code isn’t valid (or has been used up). Ask Matchweek for a fresh one.' });

  // ---- config sanity (the wizard validates deeply; this is the server backstop) ----
  const id = Number(cfg?.league?.fplDraftLeagueId);
  if (!cfg || !Number.isInteger(id) || id <= 0) return json(400, { ok: false, error: 'config.league.fplDraftLeagueId must be a positive integer.' });
  const teams = cfg.teams ?? [];
  if (teams.length < 4 || teams.length > 16) return json(400, { ok: false, error: 'config.teams must have 4–16 entries.' });
  const monos = teams.map(t => t.monogram);
  if (new Set(monos).size !== monos.length) return json(400, { ok: false, error: 'Team monograms must be unique.' });

  // ---- the league must really exist and have drafted (draft_status regressed 31 Aug: gate on closed/started) ----
  const r = await fetch(`${DRAFT}league/${id}/details?_cb=${Date.now()}`, { headers: { 'User-Agent': 'matchweek-register/0.1' } });
  if (r.status === 404) return json(404, { ok: false, error: `No FPL Draft league with id ${id}.` });
  if (!r.ok) return json(502, { ok: false, error: `FPL answered ${r.status}; try again in a minute.` });
  const d = await r.json().catch(() => null);
  const entries = d?.league_entries ?? [];
  const drafted = d?.league?.draft_status === 'post' || d?.league?.closed === true || (d?.matches ?? []).some((x: { started?: boolean }) => x.started);
  if (!drafted) return json(422, { ok: false, error: 'This league has not drafted yet — register it once the draft is complete.' });
  if (entries.length !== teams.length) return json(422, { ok: false, error: `Config has ${teams.length} teams but FPL reports ${entries.length}. Re-run the setup wizard.` });

  // ---- register ----
  const name = cfg.league?.name || d.league?.name || `League ${id}`;
  const { error } = await sb.from('leagues').insert({ fpl_league_id: id, season: SEASON, name, config: cfg });
  if (error) {
    if (/duplicate|unique/i.test(error.message)) return json(409, { ok: false, error: 'This league is already registered with Matchweek.' });
    return json(500, { ok: false, error: error.message });
  }
  await sb.from('invites').update({ uses: inv.uses + 1 }).eq('code', code);

  // ---- kick the first ingest so the clubhouse fills within ~2 minutes ----
  const ingestUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/ingest?league=${id}`;
  const kick = fetch(ingestUrl).catch(() => {});
  // deno-lint-ignore no-explicit-any
  const rt = (globalThis as any).EdgeRuntime;
  if (rt?.waitUntil) rt.waitUntil(kick);

  return json(200, { ok: true, appUrl: `${APP_URL}?league=${id}`, note: 'First data sync is running — the clubhouse fills in about two minutes.' });
});
