// fplgg/ingest/supabase/functions/seed-statics/index.ts — one-shot loader of the sheet's static tabs
// into tab_snapshots: FC27 + EA Map (global) and the frozen Ratings tab (per league, meta.version).
// Replaces tools/sheet_to_snapshots.py. Re-run at the August reboot after re-pasting FC27/EA Map.
//   GET /functions/v1/seed-statics?sheet={sheetId}&league={fplLeagueId}
import { createClient } from 'npm:@supabase/supabase-js@2';
const SEASON = Deno.env.get('FPL_SEASON') ?? '2026/27';
const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

async function gviz(sheet: string, tab: string) {
  const t = await (await fetch(`https://docs.google.com/spreadsheets/d/${sheet}/gviz/tq?sheet=${encodeURIComponent(tab)}&tqx=out:json`)).text();
  const j = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1));
  const cols = (j.table.cols as { label?: string }[]).map(c => c.label ?? '');
  const rows = (j.table.rows as { c: ({ v?: unknown } | null)[] }[]).map(r => r.c.map(c => (c && c.v !== null && c.v !== undefined) ? c.v : ''));
  return { cols, rows };
}
async function put(leagueId: string | null, tab: string, header: unknown[], rows: unknown[][], meta?: unknown) {
  const { error } = await sb.from('tab_snapshots').upsert(
    { league_id: leagueId, season: SEASON, tab, block: 'all', header, rows, meta: meta ?? null, updated_at: new Date().toISOString() },
    { onConflict: 'league_key,season,tab,block' });
  if (error) throw error;
}
Deno.serve(async (req) => {
  try {
    const u = new URL(req.url);
    const sheet = u.searchParams.get('sheet'); const fplId = Number(u.searchParams.get('league'));
    if (!sheet || !fplId) return Response.json({ ok: false, error: 'need ?sheet= and ?league=' }, { status: 400 });
    const { data: lg } = await sb.from('leagues').select('id').eq('fpl_league_id', fplId).eq('season', SEASON).maybeSingle();
    if (!lg) return Response.json({ ok: false, error: 'unknown league' }, { status: 404 });
    const fc27 = await gviz(sheet, 'FC27'); const ea = await gviz(sheet, 'EA Map'); const rat = await gviz(sheet, 'Ratings');
    // Ratings: contract is 6 cols; H1 (version) may arrive as col 8 label or in a first data row
    let ver = 'v3.1'; let rows = rat.rows;
    if (rat.cols[0] !== 'Player' && rows.length && rows[0][0] === 'Player') { ver = String(rows[0][7] || rows[0][6] || ver); rows = rows.slice(1); }
    else if (rat.cols[7]) ver = String(rat.cols[7]);
    rows = rows.map(r => r.slice(0, 6));
    await put(null, 'FC27', fc27.cols, fc27.rows);
    await put(null, 'EA Map', ea.cols, ea.rows);
    await put(lg.id, 'Ratings', ['Player', 'Pos', 'Club', 'Owner', 'OVR', 'Band'], rows, { version: ver });
    // Specials (commissioner-maintained: POTM awards) — the sheet stays its source of truth; re-fire this fn after awarding POTM
    try { const sp = await gviz(sheet, 'Specials'); const sr = (sp.rows[0] && sp.rows[0][0] === 'Setting') ? sp.rows.slice(1) : sp.rows; await put(lg.id, 'Specials', ['Setting', 'Value'], sr); } catch (_e) { /* optional tab */ }
    return Response.json({ ok: true, fc27: fc27.rows.length, eaMap: ea.rows.length, ratings: rows.length, version: ver });
  } catch (e) { return Response.json({ ok: false, error: String(e) }, { status: 500 }); }
});
