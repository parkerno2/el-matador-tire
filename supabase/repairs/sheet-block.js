#!/usr/bin/env node
/* sheet-block.js: one tab's rows for one gameweek (or the whole tab) read from the league's Google Sheet over gviz,
   shaped into a tab_snapshots block (the Supabase side's header order), as SQL or applied through the Management
   API. The Sheet is the reference (BUGS.md #29): a block the ingest wrote from a later feed (GW1 on 31 Aug 2026)
   or never wrote (Predictions GW2, before the ingest existed) is set to what the Sheet holds.
     node supabase/repairs/sheet-block.js --tab "Predictions" --gw 2 --block 2 [--league-key global] [--final]
     ... --apply        posts the statement to https://api.supabase.com (the environment's network secret or
                        SUPABASE_ACCESS_TOKEN adds the token; nothing here prints it)
   Without --apply it prints the SQL (an upsert on (league_key, season, tab, block) that only sets header and rows;
   a frozen block keeps final = true, the trigger forbids anything else). The values are gviz's typed values, as the
   app and the parity report read them. */
'use strict';
const P = require('../../fplgg/tools/parity/parity.js');
const a = process.argv.slice(2), arg = (k, d) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : d; }, has = k => a.includes(k);
const TAB = arg('--tab', ''), GW = arg('--gw', ''), BLOCK = arg('--block', GW || 'all'), KEY = arg('--league-key', 'global'), SEASON = arg('--season', '2026/27');
const REF = arg('--ref', 'vcokquhzqpqvwrybndnr');
if (!TAB) { console.error('need --tab'); process.exit(2); }
async function main() {
  const r = await fetch(P.gvizUrl(TAB) + (GW ? '&tq=' + encodeURIComponent('select * where A = ' + Number(GW)) : ''), { headers: { 'user-agent': 'matchweek-repair' } });
  if (r.status !== 200) throw new Error('the Sheet answered HTTP ' + r.status);
  const t = P.parseGviz(await r.text());
  if (!t.cols.length || (GW && t.cols[0] !== 'GW')) throw new Error('unexpected header: ' + t.cols.join(', '));
  const rows = t.rows.map(o => t.cols.map(c => o[c] === undefined ? '' : o[c]));
  if (!rows.length) throw new Error('no rows for ' + TAB + (GW ? ' GW ' + GW : ''));
  const lit = v => "'" + JSON.stringify(v).replace(/'/g, "''") + "'::jsonb";
  const leagueId = KEY === 'global' ? 'null' : "'" + KEY.replace(/'/g, "''") + "'::uuid";
  const q = (KEY === 'global' ? 'null' : "'" + KEY.replace(/'/g, "''") + "'");
  const sql = `insert into public.tab_snapshots (league_id, season, tab, block, header, rows, final, updated_at)
values (${leagueId}, '${SEASON}', '${TAB.replace(/'/g, "''")}', '${BLOCK}', ${lit(t.cols)}, ${lit(rows)}, ${has('--final') ? 'true' : 'false'}, now())
on conflict (league_key, season, tab, block) do update set header = excluded.header, rows = excluded.rows, updated_at = now();`;
  console.error(TAB + (GW ? ' GW ' + GW : '') + ': ' + rows.length + ' rows, ' + t.cols.length + ' columns, block ' + BLOCK + ' (' + KEY + ')');
  if (!has('--apply')) { process.stdout.write(sql + '\n'); return; }
  const headers = { 'content-type': 'application/json' };
  if (process.env.SUPABASE_ACCESS_TOKEN) headers.authorization = 'Bearer ' + process.env.SUPABASE_ACCESS_TOKEN;
  const res = await fetch('https://api.supabase.com/v1/projects/' + REF + '/database/query', { method: 'POST', headers, body: JSON.stringify({ query: sql }) });
  const text = await res.text();
  if (res.status !== 200 && res.status !== 201) throw new Error('the Management API answered HTTP ' + res.status + ': ' + text.slice(0, 300));
  console.error('applied: ' + text.slice(0, 200));
  void q;
}
main().catch(e => { console.error('repair failed: ' + (e && e.message || e)); process.exit(1); });
