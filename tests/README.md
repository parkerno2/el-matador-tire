# Phone-size test harness (3 Oct 2026)

Restore in a fresh cloud session:
    cd /home/claude && git clone https://github.com/parkerno2/el-matador-tire emt
    mkdir -p harness && tar xzf emt/tests/harness-2026-10-03.tar.gz -C harness
    mkdir -p harness/fonts && cd harness/fonts && npm pack @fontsource/archivo @fontsource/archivo-black @fontsource/manrope @fontsource/saira-condensed @fontsource/barlow-condensed --silent && for f in *.tgz; do mkdir -p "${f%.tgz}" && tar xzf "$f" -C "${f%.tgz}"; done
Then: `python3 harness.py v12.html` (smoke), or `from harness import App` (see BRIEF.md).
Fresh sheet data: download the sheet as xlsx (Drive connector download_file_content, exportMimeType xlsx) to /home/claude/sheet.xlsx, then `python3 xlsx2gviz.py`.
Live-gameweek replay fixture: fix-d/tabs-live (rebuild with fix-d/make_tabs_live.py; see fix-d/README.md).
Contents: harness.py, xlsx2gviz.py, tabs/ (real sheet 3 Oct), BRIEF.md + FIXBRIEF.md (agent briefs), findings/ (feature sweep, ~90 issues), fix-a..d check scripts (regression checks for the 3 Oct bugfix build), tests/ (Rice photo, sheet animation).

## The app's own suites (plain Node, part of the CI gate)
`tests/app-*.js` run the app's modules in a vm (see each file's header). `tests/app-demo.js` (8 Oct 2026, Parker's Q2) covers the demo league on matchweek.gg: the demo data source in `src/data/tabs.js` (`__MW_DEMO__`), the anonymiser and the leak check in `fplgg/tools/demo/names.js`, the demo index page and the workflow step; every name in it is made up. The headless check of the built demo is `fplgg/tools/demo/check-headless.js` (needs Playwright, not in the gate). `tests/app-docs.js` (10 Oct 2026, ROADMAP C4) checks the operator docs (`fplgg/tools/matchweek/docs/ARCHITECTURE.md`, `RUNBOOK.md`, the root README) against the code: every path they name exists, every Script Property, key, Code.gs function, POST action, engine tab, workflow and menu item they name is real, no dash or emoji.
