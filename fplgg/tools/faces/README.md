# Faces fetcher (retired 8 Oct 2026)

**Retired.** Parker, 8 Oct 2026: "only use the FPL images from now on other than the fc ones we already have". The
daily workflow (`.github/workflows/faces.yml`) is gone and nothing fetches new FC renders. The app shows the FC cutouts
already in `faces/` (the frozen list `FC_FACES` in `fplgg/tools/matchweek/core.gen.js`; the build fails if a listed file
is missing), otherwise FPL's own photo (`https://resources.premierleague.com/premierleague25/photos/players/110x140/{code}.png`,
what fantasy.premierleague.com itself uses), otherwise initials. The old `premierleague/photos/players/.../p{code}.png`
path stopped updating (last season's kits, nothing for new signings) and must not come back. Four files that were not FC
renders (three PL photos in old kits, one silhouette) were removed from `faces/` the same day. The script and the notes
below are kept for history only.


Player cards show `faces/{fpl_code}.png`: a transparent 160x160 head-and-shoulders cutout, bottom-aligned,
hair top about 15 px down. When the file is missing the app falls back to the Premier League CDN photo, then
initials. This tool fills the gaps automatically so no one has to run the old `fetch_faces.py` on a PC.

## What it does

`fetch_faces.py` reads the league sheet (Rosters tab for who is rostered, EA Map tab for FPL code -> EA player id),
finds every rostered code with no `faces/{code}.png` that is not in `skip.txt`, and tries these sources in order,
keeping the first one that survives the checks:

1. futwiz FC27 render by EA id, then FC26, then host/futbin variants (`RENDER_URLS` at the top of the script).
   These come on an opaque grey square and are keyed: the backdrop is modelled as a flat or gently graded colour
   from the border and flood-filled with hysteresis (a pixel keys when it matches the model closely, or continues
   the backdrop smoothly in a vignette; the fill never chains through a real edge), the largest blob plus any
   collar piece on the bottom edge is kept, edge pixels are un-mixed (no grey fringe) and feathered 1 px.
2. EA ratings-site portrait by EA id, FC27 then FC26 (`PORTRAIT_URLS`).
3. Premier League 250x250 photo by FPL code (`PL_URLS`), already transparent.

A player with no EA id in the map is looked up on EA's ratings API (`search=` on drop-api.ea.com); the id is used
only when exactly one result matches both the name and the club.

Every candidate is rejected when it is a tiny file, has under 15% or over 85% foreground (placeholder or a failed
key that would show as a grey square), has a backdrop that is not flat enough to key, or is a one-colour
silhouette. Survivors are normalised: renders keep their native framing (scaled to 160), photos are framed from the
alpha profile (top of head to neck = 112 px, head centred, hair top at 15 px, chest cropped at the bottom).

The run prints a markdown report (fetched with source, failed with every reason) and appends it to the GitHub
Actions step summary. Exit code is 0 even when some players fail.

## Running

- GitHub Actions: `.github/workflows/faces.yml` runs daily at 09:17 UTC and on demand (Actions -> Fetch faces ->
  Run workflow, optionally with a comma-separated list of codes). New files are committed as `el-matador-build`
  with the players' names in the message. Only `faces/*.png` is ever added.
- Locally: `pip install pillow requests`, then `python3 fplgg/tools/faces/fetch_faces.py` (`--dry-run` lists the
  missing players, `--only 575476,606702` restricts, `--offline DIR` reads gviz JSON copies of the two tabs).
- Tests (no network): `python3 fplgg/tools/faces/test_faces.py` keys existing faces composited onto grey, light
  grey, a gradient and a vignette and checks the recovered mask (IoU >= 0.95), checks the rejection rules and the framing,
  and runs an offline dry run plus a fake-network end-to-end pass. It writes a contact sheet to
  `--out DIR/contact.png`.

## If the first real run fails on a source

The URL templates are plain lists at the top of `fetch_faces.py`. Read the step summary: an `HTTP 404` on every
futwiz pattern means the path changed (open any futwiz player page, copy the face image URL, fix the template);
`got an HTML page` or `HTTP 403` means the host is blocking the runner (drop that source or add headers);
`foreground 9x%` means the backdrop was not keyed (new background style, look at the image); `placeholder`
means the host served its generic silhouette, which is correct behaviour.

## Skip list

`skip.txt`: one FPL code per line, `#` comments allowed. Put players there when every source keeps failing
(youth players with no render or photo yet), so the daily run stops asking for them. Remove the line later to
retry. Deleting `faces/{code}.png` makes the next run fetch that player again.

## Rights

EA/futwiz renders are EA's copyrighted assets. Redistributing keyed copies in this public repo is tolerated-grey
for a private fan league with a handful of players and a graceful fallback if anything is ever taken down.
They must never ship in anything sold or offered commercially (Matchweek included); commercial builds use the
Premier League photo chain only.
