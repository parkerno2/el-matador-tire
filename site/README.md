# matchweek.gg

The public Matchweek site: landing page, demo, setup, status, sample recaps, Privacy and Terms.

- **Source of truth:** `site/public/` in this repo. The old `matchweek-site` folder on Parker's computer is retired.
- **Deploys:** Cloudflare Workers Builds is connected to this repo (Worker `matchweek`, root directory `site`, watch path `site/*`). Every push to `main` that changes `site/` redeploys matchweek.gg and www.matchweek.gg within a minute or two. No computer, folder pick or API token is involved.
- **Config:** `site/wrangler.jsonc`. It holds static assets only, with custom domains matchweek.gg and www.matchweek.gg.
- `/privacy` and `/terms` resolve to `privacy.html` and `terms.html` (default `html_handling`).
- The demo variant must stay anonymised. Grep for every real team, manager and first name before pushing anything to `site/public/`.
