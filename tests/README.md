# Phone-size test harness (3 Oct 2026)

Restore in a fresh cloud session:
    cd /home/claude && git clone https://github.com/parkerno2/el-matador-tire emt
    mkdir -p harness && tar xzf emt/tests/harness-2026-10-03.tar.gz -C harness
    mkdir -p harness/fonts && cd harness/fonts && npm pack @fontsource/archivo @fontsource/archivo-black @fontsource/manrope @fontsource/saira-condensed @fontsource/barlow-condensed --silent && for f in *.tgz; do mkdir -p "${f%.tgz}" && tar xzf "$f" -C "${f%.tgz}"; done
Then: `python3 harness.py v12.html` (smoke), or `from harness import App` (see BRIEF.md).
Fresh sheet data: download the sheet as xlsx (Drive connector download_file_content, exportMimeType xlsx) to /home/claude/sheet.xlsx, then `python3 xlsx2gviz.py`.
Live-gameweek replay fixture: fix-d/tabs-live (rebuild with fix-d/make_tabs_live.py; see fix-d/README.md).
Contents: harness.py, xlsx2gviz.py, tabs/ (real sheet 3 Oct), BRIEF.md + FIXBRIEF.md (agent briefs), findings/ (feature sweep, ~90 issues), fix-a..d check scripts (regression checks for the 3 Oct bugfix build), tests/ (Rice photo, sheet animation).
