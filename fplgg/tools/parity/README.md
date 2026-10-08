# The Supabase parity report (ROADMAP B2)

The league's data has two pipelines. The Google Sheet is what the app reads today: `Code.gs` writes it from FPL every
hour and every few minutes while a match is on. The Supabase project (`vcokquhzqpqvwrybndnr`) has its own ingest
(hourly, at :07) and a public, read-only `tabs` function that serves the same tab names and columns:
`https://vcokquhzqpqvwrybndnr.supabase.co/functions/v1/tabs/league/45380/tab/<name>` answers
`{ header: [...], rows: [[...]] }`, `/league/45380/config` the league config and `/health` the ingest runs. Before the
app can switch to Supabase (B3) the two must agree, tab for tab, through a live gameweek. This tool is that check.

## What it does

`.github/workflows/parity.yml` runs `parity.js` every 3 hours (minute 41) and on Actions tab → Supabase parity → Run
workflow. The script:

1. reads every tab the app's engine reads (the `TABS` list of `src/data/tabs.js`; `tests/parity.js` keeps the two in
   step) from both sides: the Sheet over gviz (`out:json`, as the app reads it) and the tabs function;
2. normalises every value the same way on both sides: numbers as numbers (3, "3" and 3.0 are equal), TRUE and FALSE
   as booleans, strings trimmed, the leading apostrophe that both pipelines write before a date dropped, and the
   engine's `TEAM_ALIAS` applied (the app maps every value through it);
3. pairs rows by a key per tab (`KEYS`: GW + Code for GW Stats, GW + Home + Away for the fixtures, Team + Code for
   Rosters, and so on), never by position, and compares the columns both sides have;
4. reports, per tab: the columns one side lacks, the rows one side lacks (grouped by gameweek), and the cells that
   differ with three examples per column. `Captured (UTC)` and `Logged (UTC)` are each pipeline's own write time, so
   they are compared and listed but never counted as a difference. The Sheet is the reference: "Sheet only" means
   Supabase lacks it;
5. says how fresh each side was (the Sheet's Meta tab, Supabase's `/health`) and whether a match was on, since live
   columns can then differ by timing alone.

The report is the run's summary (the Summary tab of the run in the Actions tab) and the artifact
`parity-report-<run number>` (`report.json`, `report.md`, kept 90 days). A run is green whenever the comparison could
be made: differences are the report, not a failure. It fails only when nothing could be compared (neither side
reachable). Nothing here uses a secret: both sources are public and read only.

## See Supabase in the app

The app reads the same tabs function when `?data=supabase` is in its URL (ROADMAP B3, `src/data/tabs.js`): the choice
sticks on that phone until `?data=sheet`. The tabs the web app writes (Managers, Social, Posts, Specials) and any tab
Supabase answers 404 for come from the Sheet; `MW.data.report()` in the browser console lists where each tab came from.
Everybody else keeps the Sheet until a report says every tab agrees.

## Run it by hand

```bash
node fplgg/tools/parity/parity.js                                   # prints the log and the Markdown report
node fplgg/tools/parity/parity.js --out /tmp/report.json --md /tmp/report.md
node tests/parity.js                                                # the unit tests
```

`MW_SHEET`, `MW_LEAGUE` and `MW_SUPABASE_BASE` point it at another sheet, league or tabs function.

## Statuses

| Status | Meaning |
|---|---|
| same | the same rows and the same values in every column both sides have, and the same columns |
| same data, columns differ | the shared data agrees, but one side has columns the other lacks |
| differs | rows one side lacks, or cells that differ |
| not on Supabase | the tabs function answers 404 for the tab |
| empty on both | header only on both sides |
| could not compare | one side did not answer |
