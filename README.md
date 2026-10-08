# Facts branch

Written by the Facts bot (.github/workflows/facts.yml on main): the gameweek facts the Matchweek writers use when no phone has sent them.
- facts/index.json: which files exist and when each last changed.
- facts/preview-gw<N>.json: what a phone posts as showfacts (MW.facts.preview()).
- facts/recap-gw<N>.json: what a phone posts as artfacts (MW.facts.recap()).

Code.gs (v3.15+) reads them from raw.githubusercontent.com. Do not edit by hand; the next run overwrites them.
