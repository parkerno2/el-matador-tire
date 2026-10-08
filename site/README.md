# matchweek.gg

The public Matchweek site: landing page, demo, setup, status, sample recaps, Privacy and Terms.

- **Source of truth:** `site/public/` in this repo. The old `matchweek-site` folder on Parker's computer is retired.
- **Deploys:** Cloudflare Workers Builds is connected to this repo (Worker `matchweek`, root directory `site`, watch path `site/*`). Every push to `main` that changes `site/` redeploys matchweek.gg and www.matchweek.gg within a minute or two. No computer, folder pick or API token is involved.
- **Config:** `site/wrangler.jsonc`: the static assets, the Worker `worker.mjs` and its cron triggers, with custom domains matchweek.gg and www.matchweek.gg.
- **The Worker (`worker.mjs`):** serves the pages untouched (the ASSETS binding). Its cron triggers start the GitHub workflows on time, because GitHub's own scheduler runs this repo's cron hours late: the Monitor every 15 minutes, the Facts bot at minute 23 every 3 hours. They need the Worker secret `GITHUB_TOKEN` (a fine-grained GitHub token with Actions: Read and write on this repo; Cloudflare dashboard, Workers & Pages, matchweek, Settings, Variables and Secrets). Without it every tick is a no-op. Tests: `node tests/worker.js` from the repo root.
- `/privacy` and `/terms` resolve to `privacy.html` and `terms.html` (default `html_handling`).
- The demo variant must stay anonymised. Grep for every real team, manager and first name before pushing anything to `site/public/`.
