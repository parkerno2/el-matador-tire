// ops/monitor.mjs: is El Matador up and is its data fresh? Plain checks, no AI, no dependencies.
// Run by .github/workflows/monitor.yml every 10 minutes. Alerts go to the phone through ntfy
// (NTFY_TOPIC), once per problem, a reminder every 3 hours while it lasts, and an all-clear when
// it is fixed. Without NTFY_TOPIC the run fails instead, so GitHub's own notification fires.
//   node ops/monitor.mjs            check and alert
//   DRY_RUN=1 node ops/monitor.mjs  check and print, never alert

const APP = 'https://parkerno2.github.io/el-matador-tire/';
const SHEET = '1rIj4A3-lkSfg1rTuAh3yJL-K7LP4EOYkwWZiItZaoHk';
const HEALTH = 'https://vcokquhzqpqvwrybndnr.supabase.co/functions/v1/tabs/health';
const FPL_DRAFT = 'https://draft.premierleague.com/api/bootstrap-static';
const FPL_FIXTURES = 'https://fantasy.premierleague.com/api/fixtures/';
const NTFY = 'https://ntfy.sh/';
const TAG = 'emt-monitor';

const MIN = 60e3;
const STALE_NORMAL = 130 * MIN;   // hourly refresh: one missed run plus slack
const STALE_LIVE = 35 * MIN;      // liveTick every 10 min during matches
const REMIND_EVERY = 3 * 60 * MIN;

const DRY = !!process.env.DRY_RUN;
const RETRY_MS = Number(process.env.RETRY_MS ?? 30e3);
const TOPIC = process.env.NTFY_TOPIC || '';

async function get(url, { timeout = 20e3, text = true } = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeout);
  try {
    const r = await fetch(url, { signal: ctl.signal, redirect: 'follow', headers: { 'User-Agent': 'el-matador-monitor/1.0' } });
    return { status: r.status, body: text ? await r.text() : '' };
  } finally { clearTimeout(t); }
}

const gviz = (tab) => `https://docs.google.com/spreadsheets/d/${SHEET}/gviz/tq?sheet=${encodeURIComponent(tab)}&tqx=out:csv`;
const ago = (ms) => (ms < 90 * MIN ? `${Math.round(ms / MIN)} min` : `${(ms / 3600e3).toFixed(1)} h`);

/** Mirrors Code.gs liveWindowReason: kickoff -5 min to +135 min, plus a 3 h tail after the day's last game. */
async function liveWindow(now) {
  try {
    const fx = JSON.parse((await get(FPL_FIXTURES)).body);
    const byDay = {};
    for (const f of fx) {
      if (!f.kickoff_time) continue;
      const ko = Date.parse(f.kickoff_time);
      (byDay[f.kickoff_time.slice(0, 10)] ??= []).push(ko);
    }
    for (const kos of Object.values(byDay)) {
      const last = Math.max(...kos);
      if (kos.some((ko) => now >= ko - 5 * MIN && now <= ko + 135 * MIN)) return true;
      if (now > last && now <= last + 135 * MIN + 180 * MIN) return true;
    }
  } catch { /* unknown: use the normal threshold */ }
  return false;
}

// Each check returns null when fine, or a one-line problem.
const checks = {
  async app() {
    const r = await get(APP);
    if (r.status !== 200) return `App returned HTTP ${r.status}`;
    // index.html is a shell since 7 Oct: every script and stylesheet it names must load too,
    // which catches a half-finished upload.
    const assets = [...r.body.matchAll(/(?:src|href)="([^"]+\.(?:js|css)(?:\?[^"]*)?)"/g)].map((m) => m[1]).filter((u) => !/^https?:/.test(u));
    if (!assets.length) return 'App page loaded but names no scripts';
    for (const a of assets) {
      const s = await get(new URL(a, APP).href, { text: false });
      if (s.status !== 200) return `App file ${a.split('?')[0]} returned HTTP ${s.status}`;
    }
    return null;
  },
  async sheet(ctx) {
    const r = await get(gviz('Meta'));
    if (r.status !== 200) return `Sheet unreadable (HTTP ${r.status}); check link sharing`;
    const iso = r.body.match(/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z/);
    if (!iso) return 'Sheet Meta tab has no Updated time';
    const age = ctx.now - Date.parse(iso[0]);
    const limit = ctx.live ? STALE_LIVE : STALE_NORMAL;
    if (age > limit) return `Sheet data is ${ago(age)} old (limit ${ago(limit)}${ctx.live ? ', matches on' : ''}); Apps Script refresh may have stopped`;
    return null;
  },
  async appsScript() {
    const sp = await get(gviz('Specials'));
    const url = (sp.body.match(/https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec/) || [])[0];
    if (!url) return 'Apps Script URL missing from the Specials tab';
    const r = await get(url);
    if (r.status !== 200) return `Apps Script (logins, refresh button) returned HTTP ${r.status}`;
    try { JSON.parse(r.body); } catch { return 'Apps Script answered with a non-JSON page (authorisation may have expired)'; }
    return null;
  },
  async supabase(ctx) {
    const r = await get(HEALTH);
    if (r.status !== 200) return `Matchweek ingest health returned HTTP ${r.status}`;
    const h = JSON.parse(r.body);
    const run = (h.runs || [])[0];
    if (!run) return 'Matchweek ingest has no recorded runs';
    const age = ctx.now - Date.parse(run.finished_at || run.started_at);
    if (age > STALE_NORMAL) return `Matchweek ingest last ran ${ago(age)} ago`;
    if (run.ok === false) return `Matchweek ingest failing: ${String(run.error || '').slice(0, 140)}`;
    for (const l of h.leagues || []) {
      const la = ctx.now - Date.parse(l.standingsUpdated || 0);
      if (la > STALE_NORMAL) return `Matchweek league ${l.league} data is ${ago(la)} old`;
    }
    return null;
  },
};

async function runChecks(ctx, names) {
  const out = {};
  await Promise.all(names.map(async (n) => {
    try { out[n] = await checks[n](ctx); } catch (e) { out[n] = `${n} check failed: ${e.name === 'AbortError' ? 'timed out' : e.message}`; }
  }));
  return out;
}

async function lastMessage() {
  const r = await get(`${NTFY}${TOPIC}/json?poll=1&since=24h`);
  const msgs = r.body.split('\n').filter(Boolean).map((l) => JSON.parse(l))
    .filter((m) => m.event === 'message' && (m.tags || []).includes(TAG));
  return msgs.at(-1) || null;
}

async function notify({ title, message, priority, tags }) {
  const r = await fetch(NTFY + TOPIC, {
    method: 'POST', body: message,
    headers: { Title: title, Priority: String(priority), Tags: [TAG, ...tags].join(','), Click: APP },
  });
  if (!r.ok) throw new Error(`ntfy answered ${r.status}`);
}

async function main() {
  const now = Date.now();
  const ctx = { now, live: await liveWindow(now) };
  let res = await runChecks(ctx, Object.keys(checks));
  const failing = Object.keys(res).filter((k) => res[k]);
  if (failing.length) {                       // one retry after 30 s so a single blip never pages
    await new Promise((r) => setTimeout(r, RETRY_MS));
    res = { ...res, ...(await runChecks({ ...ctx, now: Date.now() }, failing)) };
  }
  const problems = Object.entries(res).filter(([, v]) => v);
  let fplDown = false;
  if (problems.length) {
    try { fplDown = (await get(FPL_DRAFT, { text: false })).status !== 200; } catch { fplDown = true; }
  }

  console.log(`live window: ${ctx.live}`);
  for (const [k, v] of Object.entries(res)) console.log(`${v ? 'FAIL' : 'ok  '} ${k}${v ? ': ' + v : ''}`);
  const summary = `## Monitor\nLive window: ${ctx.live ? 'yes' : 'no'}\n\n` +
    Object.entries(res).map(([k, v]) => `- ${v ? '**FAIL**' : 'ok'} ${k}${v ? ': ' + v : ''}`).join('\n') + '\n';
  if (process.env.GITHUB_STEP_SUMMARY) (await import('node:fs')).appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);

  if (DRY) return;
  if (!TOPIC) { if (problems.length) process.exit(1); return; }

  const ref = 'ref: ' + problems.map(([k]) => k).sort().join(',');
  const last = await lastMessage();
  const lastWasAlert = !!last && (last.tags || []).includes('alert');
  if (problems.length) {
    const same = lastWasAlert && String(last.message).endsWith(ref);
    if (same && now - last.time * 1000 < REMIND_EVERY) return console.log('already alerted');
    const lines = problems.map(([, v]) => v);
    if (fplDown) lines.push('Note: the FPL API is not answering either, so FPL may be the cause.');
    await notify({ title: `El Matador: ${problems.length} problem${problems.length > 1 ? 's' : ''}`, message: lines.join('\n') + '\n' + ref, priority: 4, tags: ['alert'] });
    console.log('alert sent');
  } else if (lastWasAlert) {
    await notify({ title: 'El Matador: all clear', message: 'Every check passes again.', priority: 3, tags: ['clear'] });
    console.log('all-clear sent');
  }
}

export const done = main().catch((e) => { console.error(e); process.exit(1); });
