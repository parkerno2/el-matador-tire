/* worker.mjs — matchweek.gg's Worker. Requests are served from site/public exactly as before (the ASSETS binding).
   The cron triggers (wrangler.jsonc) exist because GitHub runs this repo's scheduled workflows hours late (observed 5
   to 9 hours on the daily faces workflow, and no 15-minute Monitor run in 90 minutes), while Cloudflare's cron fires
   on time. Each tick starts the matching GitHub workflow through the workflow_dispatch API: the Monitor every 15
   minutes and the Facts bot every 3 hours. That call needs a GitHub token with Actions: write on the repo, stored as
   the Worker secret GITHUB_TOKEN (Cloudflare dashboard, Workers & Pages, matchweek, Settings, Variables and Secrets).
   Without the secret every tick is a no-op, so the site is never affected by this file. Nothing here is logged beyond
   one line a tick; the token never leaves the request header. */
export const REPO = 'parkerno2/el-matador-tire';
export const JOBS = { '*/15 * * * *': 'monitor.yml', '23 */3 * * *': 'facts.yml' };

/* starts one workflow on main; { ok, status, workflow } or { ok: false, skipped } */
export async function dispatch(env, workflow, fetchFn) {
  const token = env && env.GITHUB_TOKEN;
  if (!token) return { ok: false, skipped: 'no GITHUB_TOKEN secret on the Worker', workflow };
  const f = fetchFn || fetch;
  try {
    const r = await f('https://api.github.com/repos/' + REPO + '/actions/workflows/' + workflow + '/dispatches', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + token, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', 'content-type': 'application/json', 'user-agent': 'matchweek-worker' },
      body: JSON.stringify({ ref: 'main' }),
    });
    return { ok: r.status === 204, status: r.status, workflow };
  } catch (e) { return { ok: false, status: 0, workflow, error: String(e && e.message || e).slice(0, 120) }; }
}

export default {
  async scheduled(event, env, ctx) {
    const workflow = JOBS[event && event.cron];
    if (!workflow) { console.log(JSON.stringify({ cron: event && event.cron, skipped: 'no workflow for this cron' })); return; }
    const r = await dispatch(env, workflow);
    console.log(JSON.stringify(Object.assign({ cron: event.cron }, r)));
  },
  async fetch(request, env) { return env.ASSETS.fetch(request); },
};
