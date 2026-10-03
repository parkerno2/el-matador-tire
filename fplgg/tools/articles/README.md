# Articles: gameweek previews and recaps

The articles (`recap-gwN.html`, `preview-gwN.html` in the repo root) are standalone pages the app opens from
Matchday ("Previews and recaps", "All articles"). They use the app's own look (D2 / Arena, see
`fplgg/tools/v12/v12-look.css`) through one shared template, so every article matches the app and a design change
is one edit plus one build.

| File | What it is |
| --- | --- |
| `article.css` | The article stylesheet. Source of truth; the build copies it into every page. |
| `article.js` | The headshot cascade (committed face, then PL 250x250, then PL 110x140, else initials). |
| `build_articles.py` | Writes the shared parts into each page between markers and fills the team badges. Checks the rules. |
| `crests.json` | The app's team badges (snapshot), drawn the way the app draws them. |
| `dump_crests.py` | Refreshes `crests.json` from the running app (phone-size harness). |
| `template.html` | Annotated starting point with a recap card, a preview card and Around the League. |

Each page keeps its own content. The build owns everything between these markers, so never edit inside them:

```
<!-- article:head -->    theme colour, link-preview tags (og:title from <title>, og:description from the standfirst), icons, fonts
<!-- article:css -->     article.css, inlined
<!-- article:header -->  the ink header bar: Matchweek plate, league name, close (x)
<!-- article:sprite -->  the badges used on the page
<!-- article:script -->  article.js
```

The CSS stays inline on purpose: the service worker caches same-origin assets (a `.css` file) forever until a
`VERSION` bump in `sw.js`, while pages are fetched network-first, so an inline style ships the moment the page does.

## Making the next preview or recap

1. **Start from the last page of the same kind** (or `template.html`): copy it to the repo root as
   `recap-gwN.html` or `preview-gwN.html`.
2. **Fill it in.** In order: `<title>` (`El Matador Tire · GWN Recap`), the kicker in `.mk` (`GWN · RECAP` or
   `GWN · PREVIEW`), the standfirst `.stand` (open with a `<b>` phrase; it is also the link-preview text), the section
   head `<h2>Matchweek N · Mon D–D</h2>`, one `.card` per matchup, then `Around the League` and the `.foot`.
3. **Badges:** every team gets `<i class="cr lg" data-team="Full Team Name"></i>` inside its `.tm` in the score
   block (large Mono badge on the ink header) and `<i class="cr" data-team="..."></i>` in the table and fixture rows
   (small badge in the team colour). Full names, or the app's short names (Palmers, Gulls, McGinn...); old names
   go in `ALIASES` in `build_articles.py`. Leave the `<i>` empty: the build draws it.
4. **Photos:** `<div class="ph" data-code="CODE">AB</div>` with the FPL player code from the Players tab (column A).
   Never match by name (there are two Palmers). The initials show until a photo loads.
5. **No em dashes** in the copy. Use the comma, colon or full stop the sentence needs. The build refuses em dashes.
6. **Build:** `python3 fplgg/tools/articles/build_articles.py recap-gwN.html` (no argument = every article).
   It fails, and writes nothing, on an em dash, an unknown team, a missing marker, or a matchup card that lost the
   markup the app reads. `--check` writes nothing and exits 1 if any page is out of date (use it before committing).
7. **App card:** add the line to `RECAPS` or `PREVIEWS` in `index-PREVIEW.html` and `index.html`
   (`{gw:N, href:'recap-gwN.html', title:'...', sub:'...'}`); `v12.html` is rebuilt from `index-PREVIEW.html` by
   `fplgg/tools/v12/build_v12.py`.
8. **Look at it** in the harness at 320, 390 and 1280 px (below), and open it from the app's All articles sheet and
   tap the close to check it lands back on the same screen.

The anonymised demo copy (matchweek.gg) is made from the built page, as before.

### Card anatomy (recap)

```html
<div class="card">
 <div class="mhead"><div class="kick">The Nolan Derby · Series 4–3</div>
  <div class="srow">
   <div class="tm win"><i class="cr lg" data-team="Cold Palmers"></i><div class="tn">Cold Palmers</div><div class="mg">Parker</div></div>
   <div class="sc"><span class="w">52</span><span class="d">–</span>41</div>
   <div class="tm away"><i class="cr lg" data-team="Devils U21s"></i><div class="tn">Devils U21s</div><div class="mg">PJ</div></div>
  </div></div>
 <div class="pstrip"><div class="ph" data-code="244851">CP</div>
  <div class="pinfo"><div class="pk">Star of the match</div><div class="pname">COLE PALMER <span>· MID · CHE</span></div>
   <div class="pline">...</div></div>
  <div class="ppts">13<small>PTS</small></div></div>
 <div class="mbody">
  <div class="story">...</div>
  <ul class="hits"><li><b>Bold lead-in</b>, the rest.</li></ul>
  <div class="chips"><span class="chip"><span class="ck">xP</span> <span class="cv"><b>44.1 – 38.0</b></span></span>...</div>
  <div class="notm"><div class="n">11</div><div class="c">...</div></div>
 </div>
</div>
```

- The winner's side gets `win` and its score `<span class="w">`; the other side greys out. A draw has neither.
- A memorable failure: add `low` to `.ph`, `.pk` and `.ppts` (red), kicker "The zero".
- Preview: the score is `<div><div class="sc pred">44.6<span class="d">–</span>38.2</div><div class="predlab">PREDICTED</div></div>`,
  the kicker on the player strip is "Player to watch", and there is no `.ppts`.
- Numbers row: each `.chip` is a label (`.ck`) over a value (`.cv`, numbers in `<b>`). A cell with no label is
  just `<span class="cv">text</span>`. Three cells fit a 320 px phone.
- Fixtures: `<div class="fx"><span class="tag">GW5 · Derby name</span><br><b class="ft"><i class="cr" data-team="Home"></i>Home</b> v <span class="ft a"><i class="cr" data-team="Away"></i>Away</span></div>`.

### What the app reads from a page (do not rename)

- **The close.** `.sh-x` in the header calls `history.back()` when the app opened the page (same-origin referrer and
  history), so the app comes back on the screen it was on; opened from a shared link it falls back to `index.html`.
  The narrated show (`v10-show.js`) embeds the current preview in an iframe and hides `.sh-x` by that class.
- **The current preview.** `v10-graphic.js` `loadArticle()` parses the preview page into the lineup graphic and the
  show: per `.card`, the two `.tm .tn` team names (exact team names, they are the lookup key), `.kick`, `.story`,
  `.hits li` with their `<b>`, `.pstrip .ph[data-code]`, `.pname`, `.pline`, `.notm .n` and `.notm .c`.
  The build checks each matchup card still has them.

## Changing the design

Edit `article.css` (or `HEADER`/`WORDMARK` in `build_articles.py`), run
`python3 fplgg/tools/articles/build_articles.py`, look at the pages, commit `article.css` and the rebuilt pages
together. Tokens follow the app: ink `#17121D`, ground `#F5F3F8`, hairline `#E7E2EE`, purple `#5B2D8E` for kickers,
links and focus only, light purple `#CDBDF0` on ink, green `#1F8A55` / red `#C23A3A` / grey `#8C8496` for results only,
Archivo 500 to 800 for words, Barlow Condensed 600/700 for every number. No gold (the Plate player cards only), no
decorative gradients. The only gold and gradient on the page is the Matchweek plate, copied from the app header.

The build also wraps scorelines and ranges (`2–0`, `4–3–1`, `Sep 4–6`) in `<span class="nw">` so a line never
breaks after the en dash. That is markup only; the text is unchanged.

## Badges changed in the app

When a manager changes colour, crest shape or emblem in the app, refresh the snapshot and rebuild:

```
python3 fplgg/tools/articles/dump_crests.py      # needs the harness at /home/claude/harness (EMT_HARNESS to override)
python3 fplgg/tools/articles/build_articles.py
```

## Testing with the harness

```python
import os, sys; os.environ['EMT_ROOT'] = '/path/to/repo'; sys.path.insert(0, '/home/claude/harness')
from harness import App
for w, h in [(320, 640), (390, 844), (1280, 800)]:
    with App(width=w, height=h) as app:
        p = app.open('recap-gw6.html', wait_ready=False); p.wait_for_timeout(800)
        p.screenshot(path=f'recap6-{w}.png', full_page=True)
        assert p.evaluate('document.documentElement.scrollWidth') <= w and not app.errors
```

The close: `p = app.open('v12.html')`, click `#allart`, click the article in `#sheet .artl`, click `.sh-x`, and
the app should be back with the sheet open. The show: the GW4 show plays from `show/gw4.json` and `show/gw4/*.mp3`
when GW4 is the current week (mark GW4 and GW5 unfinished in a copy of the harness `tabs/Matchweeks.json`, pass it
as `App(tabs=...)`, then click the `[data-mxall]` Play row).
