# Run report, 11 Oct 2026: P1 part 1, the feed posts checked before they are kept (Code.gs v3.32)

The manager's item for the 14:47 Chicago run (started 15:13 UTC): P1, the polish pass from Parker's notes of 11 Oct
after the release-readiness review. Part 1 is the backend half, on main; part 2 (the app polish, the preview branch)
has its own report. Parker: "Still agreed on the feed too." Parker allows this part to merge inside the GW6 live window
because it is backend only.

## The request
The demo's Feed showed four problems, and the fix had to cover each one:
- a voice post published cut off mid-word ("...Waivers close in 15 hours. Expect movemen"): a post must be complete,
  dropped when the model output stopped early or does not end a sentence;
- a post said "Five free agents" and listed six names: a count word must match the list it introduces;
- Malcolm said "Neither has won this series yet" while the head-to-head record said Tom leads 4-3: a post must agree
  with the facts it was given;
- Malcolm joked "put $30 on October with a 9% model": the Show's rule (TONE.md, numbers are facts, never jokes) for
  every feed voice.
Tests in `tests/codegs/v332.js` that fail before the fix; the voices' characters otherwise unchanged.

## What changed
- `Code.gs` v3.32 (header, CHANGELOG, `EMT_VERSION`):
  - `aiWrite` reads the reply's `stop_reason`: `max_tokens` keeps nothing from that reply (the JSON is cut anyway, and a
    post that happened to parse would be half-written).
  - New checks, run on every post after the existing voice, length and number guards: `aiPostProblem` returns the first
    problem or an empty string. `aiSentenceOk` (the text ends with . ! ? or an ellipsis, a closing quote or bracket
    allowed after it; a post cut by the model or by the 300-character cap fails); `aiCountProblem` (a count word two to
    twelve, or 2 to 12, within three words of a plural noun such as free agents, players, managers, teams, moves,
    picks: the names from FACTS found in the rest of that sentence, and in the next when the list follows, must add up
    to it; two or more names that do not drop the post; a count with no list, "five defeats", "two points clear", is
    not judged); `aiSeriesProblem` (for every fixture in FACTS that carries `series_wins`: no "neither has won", "first
    meeting", "never met" or "all square" when the series says otherwise, the side with fewer wins never "leads" or
    "has the edge", a series score in a sentence about the series or the head-to-head must be the series' own in either
    order, a match score FACTS carry is left alone; a post naming one side is judged against that fixture, a post naming
    none against every fixture); `aiOddsProblem` (a percentage, "per cent", a currency amount, "odds", bet, wager,
    stake, bookies, punt, acca, a fiver, a tenner).
  - `aiFactNames` collects the names worth counting from FACTS (the values under player, team, manager, in, out, home,
    away, started_by, name) plus the league's teams and first names; `aiNamesIn` counts them in a piece of text, a
    first name inside a full name once.
  - Clark's thumbnail is dropped (the post kept) when its lines carry odds, money or a percentage.
  - An en dash in a post reads as a comma, as the em dash already did.
  - A dropped post is logged with its reason and the text (`aiDrop`); the older guard keeps its "AI post dropped:" line
    (the v3.29 suite reads it). `?health=1` `ai.last` carries `dropped` (the count this run) and `drops` (up to four
    reasons by voice), so a quiet day and a writer whose every post is refused read differently.
  - One rule added to the writer's system prompt (rule 10): numbers are facts, never jokes, no bet or sum of money, a
    count must match its list, say about a head-to-head only what FACTS says, every post ends as a complete sentence.
    Rules 1 to 9, the three voices' descriptions, the tone block, the floor ask and the lanes are byte-for-byte as they
    were (`v332.js` V2 and V3 check it).
- `tests/codegs/v332.js` (new, 37 checks): the release line; the sentence rule on the demo's cut text and on complete
  endings; the count rule on the demo's "five free agents" over six names, the list in the next sentence, five over
  five, a digit count, counts with no list; the series rule on the demo's "Neither has won this series yet" against a
  4-3 series, the first names, "first meeting", the wrong leader, "honours even", a wrong and a right series score, a
  match score, the true line, the other fixture, facts without a series; the odds rule on the demo's "put $30 on October
  with a 9% model" and nine other lines, and on plain numbers that pass; the writer through the floor path (three
  lanes: a cut post and a series lie dropped, Clark's post kept, the log lines, `ai.last.dropped` 2, the health
  shape); a reply cut by the budget (three calls, nothing written, three drops), the same replies with a normal stop
  kept, the en dash.
- `tests/codegs/README.md`, `CLAUDE.md` (the test list, the pipelines paragraph).

## How it was verified
- `node tests/codegs/v332.js` on the Code.gs before the change: throws (`aiSentenceOk` is not defined), so the suite
  fails before the fix. After: ALL PASS.
- Every Code.gs suite (v312 to v332, show) ALL PASS, `tests/codegs/test.js` exit 0; every other `tests/*.js` ALL PASS
  (31 suites); `node --check` on a copy of Code.gs; `cd fplgg/tools/matchweek && bash ci-build.sh` built
  20261011152301 and the six root files were restored.
- Nothing posted, approved or taken down in the app; no web app action called; no Script Property touched.

## What is not covered, said plainly
- "No joke built on a score or a margin" cannot be told from a number used as a fact by a check that reads text; the
  prompt now says it (rule 10), and the check enforces the part a regex can see (a percentage, odds, money, betting
  words). A later run could add a reviewer pass on Haiku if the Feed still shows number jokes.
- The count rule counts the names FACTS carry. A list of things that are not names (clubs, positions) is not counted.
- The series rule covers fixtures that carry `series_wins` (Malcolm's floor lane). The build-up event does not send a
  series, so a build-up post cannot be checked against one; it has no series to misquote either.

## Proof of shipping
- The commit ab5c1ce on main, pushed 15:23:51 UTC.
- "Code.gs tests and release" run 50 for ab5c1ce, green at 15:24:11 UTC:
  https://github.com/parkerno2/el-matador-tire/actions/runs/38151097215
- The `release` branch's Code.gs reads v3.32 as its first CHANGELOG version (checked at 15:27 UTC), so the script's hourly
  self-update installs it within the hour; `?health=1` will read `version: v3.32` once it has.
