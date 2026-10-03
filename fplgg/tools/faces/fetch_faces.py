#!/usr/bin/env python3
"""
El Matador Tire: fetch transparent face cutouts for rostered players that have no faces/{code}.png.

Runs in GitHub Actions (.github/workflows/faces.yml) so nobody's PC is needed. For every rostered FPL
code with no face file (and not in skip.txt) it tries, in order, keeping the first valid cutout:

  a. futwiz FC27 / FC26 face render by EA player id (opaque grey square -> flood-fill keyed),
  b. EA ratings portrait by EA player id (FC27 then FC26),
  c. the Premier League 250x250 photo by FPL code (already transparent).

Every candidate goes through the same pipeline: key the background if the image has no real
transparency, keep the largest connected foreground blob, feather the edge 1 px, reject placeholders
and failed keys, then normalise to a 160x160 RGBA bottom-aligned bust framed like the existing faces.

    python3 fetch_faces.py                 # live: reads the sheet, writes faces/{code}.png
    python3 fetch_faces.py --dry-run       # list what would be fetched, touch nothing
    python3 fetch_faces.py --offline DIR   # read Rosters.json + "EA Map.json" (gviz JSON) from DIR
    python3 fetch_faces.py --only 575476   # restrict to one or more codes (comma separated)

Dependencies: Python 3.12, Pillow, requests. Nothing else (the keyer is pure Python on purpose).
Exit code is 0 even when some players fail; the markdown report says who and why.
"""
from __future__ import annotations

import argparse
import csv
import io
import json
import os
import re
import sys
import time
import unicodedata
from collections import deque
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, ImageChops, ImageFilter

# --------------------------------------------------------------------------------------------------
# Sources. URL templates are lists so the first real Actions run can fix a pattern with a one-line edit.
# {id} = EA player id, {code} = FPL code. Each entry: (label, url). Labels appear in the run report.
# --------------------------------------------------------------------------------------------------
SHEET_ID = "1rIj4A3-lkSfg1rTuAh3yJL-K7LP4EOYkwWZiItZaoHk"
SHEET_CSV = "https://docs.google.com/spreadsheets/d/{sheet}/gviz/tq?tqx=out:csv&headers=1&sheet={tab}"

RENDER_URLS = [  # (a) opaque grey renders; keyed. fc27 first, fc26 fallback, then host/path variants.
    ("futwiz fc27", "https://cdn.futwiz.com/assets/img/fc27/faces/{id}.png"),
    ("futwiz fc26", "https://cdn.futwiz.com/assets/img/fc26/faces/{id}.png"),
    ("futwiz fc27 (www)", "https://www.futwiz.com/assets/img/fc27/faces/{id}.png"),
    ("futwiz fc26 (www)", "https://www.futwiz.com/assets/img/fc26/faces/{id}.png"),
    ("futbin fc27", "https://cdn.futbin.com/content/fifa27/img/players/{id}.png"),
    ("futbin fc26", "https://cdn.futbin.com/content/fifa26/img/players/{id}.png"),
]
PORTRAIT_URLS = [  # (b) EA ratings-site portraits by EA id.
    ("ea portrait fc27", "https://ratings-images-prod.pulse.ea.com/FC27/full/player-portraits/p{id}.png"),
    ("ea portrait fc26", "https://ratings-images-prod.pulse.ea.com/FC26/full/player-portraits/p{id}.png"),
]
PL_URLS = [  # (c) Premier League photo by FPL code; transparent already.
    ("premier league 250", "https://resources.premierleague.com/premierleague/photos/players/250x250/p{code}.png"),
]
EA_SEARCH = "https://drop-api.ea.com/rating/ea-sports-fc?locale=en&limit=10&search={q}"
EA_HEADERS = {"Accept": "application/json", "Referer": "https://www.ea.com/games/ea-sports-fc/ratings"}

USER_AGENT = ("el-matador-tire-faces/1.0 (+https://github.com/parkerno2/el-matador-tire; "
              "fan-league face fetcher, a handful of images per day)")
DELAY = 1.0            # seconds between HTTP requests
TIMEOUT = (10, 30)     # connect, read
MAX_BYTES = 6_000_000

# FPL short club code -> words that identify the club in EA's team label. Used only when a player
# has no ea_player_id in the EA Map and we fall back to the EA search (match must be unambiguous).
CLUB_WORDS = {
    "ARS": ["arsenal"], "AVL": ["aston villa"], "BOU": ["bournemouth"], "BRE": ["brentford"],
    "BHA": ["brighton"], "BUR": ["burnley"], "CHE": ["chelsea"], "COV": ["coventry"],
    "CRY": ["crystal palace"], "EVE": ["everton"], "FUL": ["fulham"], "HUL": ["hull"],
    "IPS": ["ipswich"], "LEE": ["leeds"], "LEI": ["leicester"], "LIV": ["liverpool"],
    "MCI": ["manchester city"], "MUN": ["manchester utd", "manchester united"], "NEW": ["newcastle"],
    "NFO": ["nottingham", "nott'm"], "SHU": ["sheffield utd", "sheffield united"], "SOU": ["southampton"],
    "SUN": ["sunderland"], "TOT": ["spurs", "tottenham"], "WHU": ["west ham"], "WOL": ["wolves", "wolverhampton"],
}

# --------------------------------------------------------------------------------------------------
# Output framing, calibrated on the 133 existing 160x160 futwiz renders in faces/:
#   top of hair at y~15, top-of-head to neck ~112 px, head ~89 px wide, bust touches the bottom edge.
# --------------------------------------------------------------------------------------------------
OUT = 160
HEADROOM = 15
HEAD_SPAN = 112      # top of head -> narrowest neck row, in output px
HEAD_WIDTH = 89      # widest head row, in output px (fallback when no neck is found)
MAX_SHOULDER = 228   # cap: scaled bottom-row width may not exceed this (<= ~15% cropped per side)

FG_MIN, FG_MAX = 0.15, 0.85   # foreground share of the frame; outside = placeholder or failed key
MIN_BYTES = 1500              # smaller downloads are placeholders / error stubs
KEY_MAX_SIDE = 400            # downscale big sources before the pure-Python flood fill

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]
FACES_DIR = REPO / "faces"
SKIP_FILE = HERE / "skip.txt"


# ==================================================================================================
# Sheet reading
# ==================================================================================================
def _digits(v) -> str:
    """'154561', '154561.0', 154561.0, ' 154,561 ' -> '154561'. '' when there is no number."""
    if v is None:
        return ""
    s = str(v).strip()
    if re.fullmatch(r"-?\d+\.0+", s):
        s = s.split(".")[0]
    return re.sub(r"\D", "", s)


def rows_from_gviz_json(text: str) -> list[dict]:
    """gviz JSON (table.cols[].label, table.rows[].c[].v/.f) -> list of {label: value}. Prefers the
    formatted value f like the app does, so numbers read exactly as the sheet shows them."""
    text = text.strip()
    if not text.startswith("{"):                      # live wrapper: /*O_o*/ google...setResponse({...});
        text = text[text.index("{"): text.rindex("}") + 1]
    table = json.loads(text)["table"]
    cols = [c.get("label") or c.get("id") for c in table["cols"]]
    out = []
    for r in table["rows"]:
        rec = {}
        for i, c in enumerate(r.get("c") or []):
            if i >= len(cols) or not cols[i]:
                continue
            if c is None:
                rec[cols[i]] = ""
            else:
                f, v = c.get("f"), c.get("v")
                rec[cols[i]] = f if f not in (None, "") else ("" if v is None else v)
        out.append(rec)
    return out


def rows_from_csv(text: str) -> list[dict]:
    return [dict(r) for r in csv.DictReader(io.StringIO(text))]


def read_tabs(session, offline_dir: str | None) -> tuple[list[dict], list[dict]]:
    if offline_dir:
        d = Path(offline_dir)
        rosters = rows_from_gviz_json((d / "Rosters.json").read_text(encoding="utf-8"))
        eamap = rows_from_gviz_json((d / "EA Map.json").read_text(encoding="utf-8"))
        return rosters, eamap
    out = []
    for tab in ("Rosters", "EA Map"):
        url = SHEET_CSV.format(sheet=SHEET_ID, tab=tab.replace(" ", "%20"))
        r = session.get(url, timeout=TIMEOUT)
        r.raise_for_status()
        out.append(rows_from_csv(r.content.decode("utf-8-sig")))
        time.sleep(DELAY)
    return out[0], out[1]


def read_skip(path: Path = SKIP_FILE) -> set[str]:
    """skip.txt: one FPL code per line, '#' comments and 'code  # note' allowed."""
    if not path.exists():
        return set()
    out = set()
    for line in path.read_text(encoding="utf-8").splitlines():
        code = _digits(line.split("#", 1)[0])
        if code:
            out.add(code)
    return out


def plan(rosters: list[dict], eamap: list[dict], have: set[str], skip: set[str],
         only: set[str] | None = None) -> list[dict]:
    """Rostered players with no face file, deduped by code, with their EA id when the map has one."""
    ea_by_code = {}
    for r in eamap:
        code = _digits(r.get("fpl_code"))
        if code and code not in ea_by_code:
            ea_by_code[code] = {"ea_id": _digits(r.get("ea_player_id")) or None,
                                "ea_name": str(r.get("ea_name") or "").strip(),
                                "fpl_full": str(r.get("fpl_full") or "").strip()}
    todo, seen = [], set()
    for r in rosters:
        code = _digits(r.get("Code"))
        if not code or code in seen:
            continue
        seen.add(code)
        if code in have or code in skip or (only and code not in only):
            continue
        ea = ea_by_code.get(code, {})
        todo.append({"code": code, "player": str(r.get("Player") or "").strip(),
                     "club": str(r.get("Club") or "").strip(), "team": str(r.get("Team") or "").strip(),
                     "ea_id": ea.get("ea_id"), "ea_name": ea.get("ea_name", ""),
                     "fpl_full": ea.get("fpl_full", "")})
    return todo


# ==================================================================================================
# Image pipeline (pure Python + Pillow). Images are small, so plain lists are fast enough.
# ==================================================================================================
def _rgb_list(im: Image.Image) -> list[tuple[int, int, int]]:
    b = im.convert("RGB").tobytes()
    return list(zip(b[0::3], b[1::3], b[2::3]))


def _l_list(im: Image.Image) -> list[int]:
    return list(im.tobytes())


def _l_image(values, size) -> Image.Image:
    return Image.frombytes("L", size, bytes(values))


def _dist(a, b) -> int:
    return abs(a[0] - b[0]) + abs(a[1] - b[1]) + abs(a[2] - b[2])


def _chroma(p) -> int:
    return max(p[0], p[1], p[2]) - min(p[0], p[1], p[2])


def _median_colour(pixels) -> tuple[int, int, int]:
    ch = []
    for i in range(3):
        v = sorted(p[i] for p in pixels)
        ch.append(v[len(v) // 2])
    return tuple(ch)


def has_real_alpha(im: Image.Image) -> bool:
    """True when the image already carries a usable cutout: a real alpha channel whose border is
    mostly transparent (a fully opaque PNG with an alpha channel is still an opaque square)."""
    if im.mode not in ("RGBA", "LA", "P", "PA"):
        return False
    a = im.convert("RGBA").split()[3]
    w, h = a.size
    px = a.load()
    border = [px[x, 0] for x in range(w)] + [px[x, h - 1] for x in range(w)] + \
             [px[0, y] for y in range(h)] + [px[w - 1, y] for y in range(h)]
    transparent = sum(1 for v in border if v < 32)
    return transparent >= 0.5 * len(border)


def _fit_plane(samples):
    """Least-squares fit v = a + b*x + c*y for one channel. samples: [(x, y, v)]. -> (a, b, c)."""
    n = len(samples)
    sx = sum(s[0] for s in samples); sy = sum(s[1] for s in samples); sv = sum(s[2] for s in samples)
    sxx = sum(s[0] * s[0] for s in samples); syy = sum(s[1] * s[1] for s in samples)
    sxy = sum(s[0] * s[1] for s in samples)
    sxv = sum(s[0] * s[2] for s in samples); syv = sum(s[1] * s[2] for s in samples)
    # normal equations [[n,sx,sy],[sx,sxx,sxy],[sy,sxy,syy]] . (a,b,c) = (sv,sxv,syv), Cramer's rule
    m = ((n, sx, sy), (sx, sxx, sxy), (sy, sxy, syy))
    def det(a):
        return (a[0][0] * (a[1][1] * a[2][2] - a[1][2] * a[2][1])
                - a[0][1] * (a[1][0] * a[2][2] - a[1][2] * a[2][0])
                + a[0][2] * (a[1][0] * a[2][1] - a[1][1] * a[2][0]))
    d = det(m)
    if abs(d) < 1e-9:
        return (sv / n, 0.0, 0.0)
    rhs = (sv, sxv, syv)
    cols = []
    for k in range(3):
        mk = tuple(tuple(rhs[r] if c == k else m[r][c] for c in range(3)) for r in range(3))
        cols.append(det(mk) / d)
    return tuple(cols)


def background_model(data, w: int, h: int):
    """Model the backdrop as a colour plane (flat or gentle gradient) fitted robustly to the border:
    fit on every border pixel, drop the ones that disagree (the bust touching the bottom edge, shoulder
    tips on the sides), refit. -> (model(x, y) -> (r, g, b), inlier_fraction, seed_indices)."""
    border_idx = list(range(w)) + list(range((h - 1) * w, h * w)) + \
                 [y * w for y in range(1, h - 1)] + [y * w + w - 1 for y in range(1, h - 1)]
    ref = _median_colour([data[i] for i in border_idx])
    keep = [i for i in border_idx if _dist(data[i], ref) <= 60]
    if len(keep) < 8:
        keep = border_idx
    planes = None
    for _ in range(2):
        planes = [_fit_plane([(i % w, i // w, data[i][ch]) for i in keep]) for ch in range(3)]
        def at(x, y, planes=planes):
            return tuple(min(255, max(0, round(p[0] + p[1] * x + p[2] * y))) for p in planes)
        keep2 = [i for i in border_idx if _dist(data[i], at(i % w, i // w)) <= 36]
        if len(keep2) < 8:
            break
        keep = keep2

    def model(x, y, planes=planes):
        return tuple(min(255, max(0, round(p[0] + p[1] * x + p[2] * y))) for p in planes)
    return model, len(keep) / float(len(border_idx)), keep


def key_background(rgb: Image.Image, strict_tol: int = 26, edge_tol: int = 60, chroma_slack: int = 14,
                   loose_tol: int = 90, step_tol: int = 12):
    """Flood-fill the backdrop from the border, with hysteresis so the fill never chains through a soft
    hair edge into the face. A pixel is background when it is reached through other background pixels
    and either (a) lies within strict_tol (L1, three channels) of the fitted backdrop colour at that
    spot, or (b) continues the backdrop smoothly: within step_tol of the pixel it was reached from and
    within loose_tol of the model, which lets a vignette the plane fit missed key out while any real
    edge (anti-aliased steps are far bigger than step_tol) stops it. Both require the pixel to be about
    as grey as the backdrop (chroma bound, so skin and kit colours never key). Afterwards one ring of
    anti-aliased edge pixels that are mostly backdrop (within edge_tol) is removed too, but the fill
    does not continue from them. Returns (mask, info): mask is 0/255 per pixel, 255 = foreground."""
    w, h = rgb.size
    data = _rgb_list(rgb)
    model, inliers, seeds = background_model(data, w, h)
    bg = bytearray(w * h)          # 1 = background
    q = deque()
    for i in seeds:
        bg[i] = 1
        q.append(i)
    while q:
        i = q.popleft()
        x = i % w
        p = data[i]
        for j in (i - w, i + w, i - 1 if x else -1, i + 1 if x < w - 1 else -1):
            if j < 0 or j >= w * h or bg[j]:
                continue
            n = data[j]
            m = model(j % w, j // w)
            if _chroma(n) > _chroma(m) + chroma_slack:
                continue
            dm = _dist(n, m)
            if dm <= strict_tol or (dm <= loose_tol and _dist(n, p) <= step_tol):
                bg[j] = 1
                q.append(j)
    ring = []
    for i in range(w * h):
        if bg[i]:
            continue
        x, y = i % w, i // w
        near = False
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                xx, yy = x + dx, y + dy
                if 0 <= xx < w and 0 <= yy < h and bg[yy * w + xx]:
                    near = True
                    break
            if near:
                break
        if near:
            m = model(x, y)
            if _dist(data[i], m) <= edge_tol and _chroma(data[i]) <= _chroma(m) + 2 * chroma_slack:
                ring.append(i)
    for i in ring:
        bg[i] = 1
    mask = [0 if b else 255 for b in bg]
    return mask, {"ref": model(0, 0), "border_inliers": round(inliers, 3), "model": model, "bg": bg}


def edge_coverage(rgba: Image.Image, mask: list[int], model, band: int = 2, alpha_gain: float = 1.5):
    """Estimate how much of each edge pixel is really the player and how much is backdrop bleeding in
    (hair wisps, anti-aliased outlines), then un-mix the colour. For a pixel p on the edge, with
    backdrop colour m there and a 'pure' foreground colour f taken a few pixels further in,
    coverage a = <p-m, f-m> / |f-m|^2 clamped to [0, 1]; colour = m + (p-m)/a. Alpha is
    min(1, a * alpha_gain): the reference f sits inside the shading of the rim, so the raw estimate
    runs low on solid edges; the gain keeps anything at least two-thirds covered fully opaque and
    fades only the genuinely wispy pixels (tuned on the existing renders, IoU >= 0.95 everywhere).
    Only pixels within `band` px of the background are touched. Returns (alpha_list, rgb_list)."""
    w, h = rgba.size
    data = _rgb_list(rgba)
    fg = [1 if v else 0 for v in mask]
    # distance-to-background in 8-connectivity, up to `band`
    dist = [0 if not fg[i] else band + 1 for i in range(w * h)]
    frontier = [i for i in range(w * h) if not fg[i]]
    for d in range(1, band + 1):
        nxt = []
        for i in frontier:
            x, y = i % w, i // w
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    xx, yy = x + dx, y + dy
                    if 0 <= xx < w and 0 <= yy < h:
                        j = yy * w + xx
                        if fg[j] and dist[j] > d:
                            dist[j] = d
                            nxt.append(j)
        frontier = nxt
    alpha = [255 if fg[i] else 0 for i in range(w * h)]
    rgb = list(data)
    for i in range(w * h):
        if not fg[i] or dist[i] > band:
            continue
        x, y = i % w, i // w
        # direction away from the backdrop: mean offset of nearby background pixels
        sx = sy = n = 0
        for dy in (-2, -1, 0, 1, 2):
            for dx in (-2, -1, 0, 1, 2):
                xx, yy = x + dx, y + dy
                if 0 <= xx < w and 0 <= yy < h and not fg[yy * w + xx]:
                    sx += dx; sy += dy; n += 1
        if not n:
            continue
        ux = -1 if sx > 0 else (1 if sx < 0 else 0)
        uy = -1 if sy > 0 else (1 if sy < 0 else 0)
        f = None
        for step in (3, 4, 2, 5):
            xx, yy = x + ux * step, y + uy * step
            if 0 <= xx < w and 0 <= yy < h:
                j = yy * w + xx
                if fg[j] and dist[j] > band:
                    f = data[j]
                    break
        m = model(x, y)
        if f is None:
            # thin wisp with no interior behind it (a hair strand): take the most backdrop-unlike
            # solid pixel nearby (the hair mass the strand grows from), else the strand's own best pixel
            best, best_d = None, -1
            for rad, need_interior in ((6, True), (2, False)):
                for dy in range(-rad, rad + 1):
                    for dx in range(-rad, rad + 1):
                        xx, yy = x + dx, y + dy
                        if 0 <= xx < w and 0 <= yy < h:
                            j = yy * w + xx
                            if fg[j] and (dist[j] > band or not need_interior):
                                dd = _dist(data[j], model(xx, yy))
                                if dd > best_d:
                                    best, best_d = data[j], dd
                if best is not None:
                    break
            f = best
        if f is None:
            continue
        p = data[i]
        fm = (f[0] - m[0], f[1] - m[1], f[2] - m[2])
        den = fm[0] ** 2 + fm[1] ** 2 + fm[2] ** 2
        if den < 40 ** 2:          # foreground here is itself backdrop-like (grey kit): leave it alone
            continue
        pm = (p[0] - m[0], p[1] - m[1], p[2] - m[2])
        a = (pm[0] * fm[0] + pm[1] * fm[1] + pm[2] * fm[2]) / den
        a = max(0.0, min(1.0, a))
        alpha[i] = round(255 * min(1.0, a * alpha_gain))
        if a >= 0.2:
            rgb[i] = tuple(min(255, max(0, round(m[k] + pm[k] / a))) for k in range(3))
    return alpha, rgb


def largest_component(mask: list[int], w: int, h: int, keep_bottom_share: float = 0.004) -> list[int]:
    """Keep the biggest 4-connected foreground blob (drops specks, logos, stray background bits), plus
    any sizeable blob that rests on the bottom edge: a collar or shoulder piece that the key cut off
    from the bust because the kit between them was close to the backdrop colour."""
    seen = bytearray(w * h)
    comps = []
    for s in range(w * h):
        if seen[s] or not mask[s]:
            continue
        comp = [s]
        seen[s] = 1
        q = deque([s])
        while q:
            i = q.popleft()
            x = i % w
            for j in (i - w, i + w, i - 1 if x else -1, i + 1 if x < w - 1 else -1):
                if 0 <= j < w * h and not seen[j] and mask[j]:
                    seen[j] = 1
                    comp.append(j)
                    q.append(j)
        comps.append(comp)
    if not comps:
        return [0] * (w * h)
    comps.sort(key=len, reverse=True)
    out = [0] * (w * h)
    bottom = (h - 1) * w
    for n, comp in enumerate(comps):
        if n == 0 or (len(comp) >= keep_bottom_share * w * h and any(i >= bottom for i in comp)):
            for i in comp:
                out[i] = 255
    return out


def feather(alpha: Image.Image) -> Image.Image:
    """1 px inward feather: interior stays opaque, edge pixels get a soft ramp, background stays 0
    (no outward blur, so no grey halo around the cutout)."""
    return ImageChops.darker(alpha, alpha.filter(ImageFilter.BoxBlur(1)))


def cutout(im: Image.Image) -> tuple[Image.Image, dict]:
    """Any source image -> RGBA cutout + diagnostics. Keys the background when the image has no real
    transparency, then keeps the largest blob and feathers the edge."""
    info = {"src_size": im.size}
    if max(im.size) > KEY_MAX_SIDE:
        s = KEY_MAX_SIDE / max(im.size)
        im = im.resize((max(1, round(im.size[0] * s)), max(1, round(im.size[1] * s))), Image.LANCZOS)
    w, h = im.size
    if has_real_alpha(im):
        rgba = im.convert("RGBA")
        a = rgba.split()[3]
        mask = [255 if v >= 128 else 0 for v in _l_list(a)]
        info["keyed"] = False
    else:
        rgba = im.convert("RGBA")
        mask, kinfo = key_background(rgba.convert("RGB"))
        model = kinfo.pop("model")
        kinfo.pop("bg", None)
        info.update(kinfo)
        info["keyed"] = True
    mask = largest_component(mask, w, h)
    alpha = _l_image(mask, (w, h))
    if info["keyed"]:
        cov, rgb = edge_coverage(rgba, mask, model)
        est = _l_image(cov, (w, h))
        clean = Image.frombytes("RGB", (w, h), bytes(c for px in rgb for c in px))
        rgba = clean.convert("RGBA")
        alpha = ImageChops.darker(feather(alpha), est)
    else:  # keep the source's own soft edge where it had one, but never outside our blob
        alpha = ImageChops.darker(alpha, rgba.split()[3])
    rgba.putalpha(alpha)
    info["fg_share"] = sum(1 for v in _l_list(alpha) if v >= 128) / float(w * h)
    return rgba, info


def looks_like_placeholder(rgba: Image.Image) -> str | None:
    """Generic 'no photo' silhouettes are one or two flat colours. Real faces have skin, hair, kit."""
    b4 = rgba.convert("RGBA").tobytes()
    colours, lum = set(), []
    for r, g, b, a in zip(b4[0::4], b4[1::4], b4[2::4], b4[3::4]):
        if a < 128:
            continue
        colours.add((r >> 4, g >> 4, b >> 4))
        lum.append((r * 299 + g * 587 + b * 114) // 1000)
    if not lum:
        return "empty"
    mean = sum(lum) / len(lum)
    sd = (sum((v - mean) ** 2 for v in lum) / len(lum)) ** 0.5
    if len(colours) < 24 or sd < 14:
        return f"near-uniform colour ({len(colours)} tones, sd {sd:.0f}) - placeholder silhouette"
    return None


def validate(rgba: Image.Image, info: dict, nbytes: int) -> str | None:
    if nbytes < MIN_BYTES:
        return f"tiny file ({nbytes} B)"
    fg = info.get("fg_share", 0)
    if fg < FG_MIN:
        return f"foreground {fg:.0%} < {FG_MIN:.0%} (placeholder or over-keyed)"
    if fg > FG_MAX:
        return f"foreground {fg:.0%} > {FG_MAX:.0%} (key failed, would show a grey square)"
    if info.get("keyed") and info.get("border_inliers", 1) < 0.45:
        return f"border is not a flat backdrop ({info['border_inliers']:.0%} agree), refusing to key"
    return looks_like_placeholder(rgba)


# --- framing -------------------------------------------------------------------------------------
def _row_widths(alpha: Image.Image, thr: int = 64) -> list[int]:
    w, h = alpha.size
    px = alpha.load()
    return [sum(1 for x in range(w) if px[x, y] > thr) for y in range(h)]


def _smooth(v: list, k: int = 2) -> list[float]:
    n = len(v)
    return [sum(v[max(0, i - k): min(n, i + k + 1)]) / (min(n, i + k + 1) - max(0, i - k)) for i in range(n)]


def head_geometry(alpha: Image.Image) -> dict | None:
    """Find the head from the alpha width profile: first local maximum from the top (hair/ears) and the
    narrowest row below it (neck). Returns top/head/neck rows, widths and the head's centre x, or
    None when nothing is opaque. 'neck' is None when the profile never pinches (then the caller
    frames by head width or by overall height)."""
    w, h = alpha.size
    wd = _row_widths(alpha)
    sw = _smooth(wd)
    rows = [y for y in range(h) if wd[y] > 0]
    if not rows:
        return None
    top, bot = rows[0], rows[-1]
    fgh = bot - top + 1
    mx = max(sw)
    head = None
    for y in range(top + 3, bot):
        lo, hi = max(top, y - 6), min(h, y + 7)
        if sw[y] >= max(sw[lo:hi]) and sw[y] >= 0.3 * mx and y - top >= max(6, 0.05 * fgh):
            head = y
            break
    neck, nmin = None, None
    if head is not None:
        neck, nmin = head, sw[head]
        for y in range(head + 1, bot + 1):
            if sw[y] < nmin:
                nmin, neck = sw[y], y
            elif sw[y] > nmin * 1.25 and y > neck + 2:
                break
        if nmin > 0.85 * sw[head] or neck - head < 0.15 * max(1, head - top):
            neck, nmin = None, None
    # head centre: mean mid-x of the rows around the widest head row
    cx = w / 2
    if head is not None:
        px = alpha.load()
        mids = []
        for y in range(max(top, head - 8), min(h, head + 9)):
            xs = [x for x in range(w) if px[x, y] > 64]
            if xs:
                mids.append((xs[0] + xs[-1]) / 2)
        if mids:
            cx = sum(mids) / len(mids)
    return {"top": top, "bottom": bot, "head": head, "head_w": sw[head] if head is not None else None,
            "neck": neck, "neck_w": nmin, "cx": cx, "bottom_w": wd[bot], "fgh": fgh}


def normalise(rgba: Image.Image, native: bool = False) -> Image.Image:
    """-> 160x160 RGBA, bottom-aligned, centred, framed like the existing futwiz renders.
    native=True (futwiz/futbin renders, which already use this framing): just scale the square.
    Otherwise scale so top-of-head -> neck spans HEAD_SPAN px, put the hair top at HEADROOM, centre the
    head, and crop whatever falls outside the frame (chest, shoulder tips)."""
    rgba = rgba.convert("RGBA")
    w, h = rgba.size
    canvas = Image.new("RGBA", (OUT, OUT), (0, 0, 0, 0))
    g = head_geometry(rgba.split()[3])
    if g is None:
        return canvas
    if native and abs(w - h) <= 2:
        return rgba.resize((OUT, OUT), Image.LANCZOS) if (w, h) != (OUT, OUT) else rgba
    if g["neck"] is not None:
        s = HEAD_SPAN / max(1, g["neck"] - g["top"])
    elif g["head_w"]:
        s = HEAD_WIDTH / max(1.0, g["head_w"])
    else:
        s = (OUT - HEADROOM) / max(1, g["fgh"])
    if g["bottom_w"]:
        s = min(s, MAX_SHOULDER / g["bottom_w"])
    s = max(0.25, min(4.0, s))
    big = rgba.resize((max(1, round(w * s)), max(1, round(h * s))), Image.LANCZOS)
    dx = round(OUT / 2 - g["cx"] * s)
    dy = round(HEADROOM - g["top"] * s)
    if g["bottom"] * s + dy < OUT - 1:            # source ends above the frame bottom: bottom-align it
        dy = round(OUT - 1 - g["bottom"] * s)
    canvas.paste(big, (dx, dy))                   # negative offsets crop; Pillow clips to the canvas
    return canvas


def process(data: bytes, native: bool) -> tuple[Image.Image | None, str | None, dict]:
    """bytes -> (160x160 RGBA or None, reject reason or None, info)."""
    try:
        im = Image.open(io.BytesIO(data))
        im.load()
    except Exception as e:  # noqa: BLE001
        return None, f"not an image ({type(e).__name__})", {}
    try:
        rgba, info = cutout(im)
        reason = validate(rgba, info, len(data))
        if reason:
            return None, reason, info
        out = normalise(rgba, native=native)
        share = sum(1 for v in _l_list(out.split()[3]) if v >= 128) / float(OUT * OUT)
        info["out_share"] = share
        if share < FG_MIN or share > FG_MAX:
            return None, f"framed foreground {share:.0%} outside {FG_MIN:.0%}-{FG_MAX:.0%}", info
        return out, None, info
    except Exception as e:  # noqa: BLE001
        return None, f"processing error ({type(e).__name__}: {e})", {}


# ==================================================================================================
# Network
# ==================================================================================================
class Fetcher:
    def __init__(self, session=None, delay: float = DELAY):
        self.session = session
        self.delay = delay
        self.requests = 0

    def _sess(self):
        if self.session is None:
            import requests  # imported lazily so offline tests never need the network stack
            self.session = requests.Session()
            self.session.headers["User-Agent"] = USER_AGENT
        return self.session

    def get(self, url: str, accept: str = "image/png,image/*;q=0.9,*/*;q=0.5",
            headers: dict | None = None) -> tuple[int, bytes, str]:
        """-> (status, body, content_type). Never raises; network errors come back as status 0."""
        if self.requests:
            time.sleep(self.delay)
        self.requests += 1
        try:
            r = self._sess().get(url, timeout=TIMEOUT, headers={"Accept": accept, **(headers or {})}, stream=True)
            body = b""
            if r.status_code == 200:
                for chunk in r.iter_content(65536):
                    body += chunk
                    if len(body) > MAX_BYTES:
                        return 413, b"", ""
            return r.status_code, body, r.headers.get("Content-Type", "")
        except Exception as e:  # noqa: BLE001
            return 0, b"", type(e).__name__


def _norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s or "")
    return "".join(c for c in s if not unicodedata.combining(c)).lower().strip()


def ea_search(fetcher: Fetcher, player: dict) -> tuple[str | None, str]:
    """Resolve an EA id from the EA ratings API when the sheet has none. Accepts only an unambiguous
    hit: exactly one item whose name contains the FPL web name AND whose team matches the FPL club."""
    q = player["player"] or player["fpl_full"]
    if not q:
        return None, "no name to search"
    items, status = [], 0
    for query in dict.fromkeys([q, _norm(q)]):              # as written, then accent-folded
        status, body, _ = fetcher.get(EA_SEARCH.format(q=requests_quote(query)), accept="application/json",
                                      headers=EA_HEADERS)
        if status != 200:
            return None, f"ea search HTTP {status}"
        try:
            items = json.loads(body.decode("utf-8")).get("items") or []
        except Exception:  # noqa: BLE001
            return None, "ea search: bad JSON"
        if items:
            break
    want = _norm(player["player"])
    club_words = CLUB_WORDS.get(player["club"].upper(), [])
    hits = []
    for it in items:
        name = _norm(" ".join(x for x in [it.get("commonName"), it.get("firstName"), it.get("lastName")] if x))
        team = _norm((it.get("team") or {}).get("label") or "")
        if want and want in name and any(wd in team for wd in club_words):
            hits.append(it)
    if len(hits) == 1 and hits[0].get("id"):
        return str(hits[0]["id"]), f"ea search -> {hits[0]['id']}"
    return None, f"ea search: {len(items)} results, {len(hits)} unambiguous club+name matches"


def requests_quote(s: str) -> str:
    from urllib.parse import quote
    return quote(s, safe="")


def fetch_player(fetcher: Fetcher, p: dict, faces_dir: Path, dry_run: bool = False) -> dict:
    """Try every source in order for one player. Returns a result dict for the report."""
    res = {"code": p["code"], "player": p["player"], "club": p["club"], "ea_id": p.get("ea_id"),
           "ok": False, "source": None, "reasons": []}
    if dry_run:
        return res
    if not res["ea_id"]:
        ea_id, note = ea_search(fetcher, p)
        res["reasons"].append(note)
        res["ea_id"] = ea_id
    candidates = []
    if res["ea_id"]:
        candidates += [(label, url.format(id=res["ea_id"]), True) for label, url in RENDER_URLS]
        candidates += [(label, url.format(id=res["ea_id"]), False) for label, url in PORTRAIT_URLS]
    else:
        res["reasons"].append("no EA id: renders and portraits skipped")
    candidates += [(label, url.format(code=p["code"]), False) for label, url in PL_URLS]
    for label, url, native in candidates:
        status, body, ctype = fetcher.get(url)
        if status != 200 or not body:
            res["reasons"].append(f"{label}: HTTP {status}" + (f" ({ctype})" if status == 0 and ctype else ""))
            continue
        if "text/html" in ctype:
            res["reasons"].append(f"{label}: got an HTML page, not an image")
            continue
        img, reason, info = process(body, native=native)
        if img is None:
            res["reasons"].append(f"{label}: {reason}")
            continue
        faces_dir.mkdir(parents=True, exist_ok=True)
        img.save(faces_dir / f"{p['code']}.png", optimize=True)
        res["ok"], res["source"], res["url"], res["info"] = True, label, url, info
        break
    return res


# ==================================================================================================
# Report
# ==================================================================================================
def report_md(results: list[dict], counts: dict, dry_run: bool) -> str:
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    lines = [f"## Faces run {now}" + (" (dry run)" if dry_run else ""),
             f"Rostered {counts['rostered']} · have {counts['have']} · skipped {counts['skipped']} · "
             f"to fetch {counts['todo']} · fetched {counts['fetched']} · failed {counts['failed']}", ""]
    if dry_run:
        lines += ["| Code | Player | Club | EA id |", "|---|---|---|---|"]
        lines += [f"| {r['code']} | {r['player']} | {r['club']} | {r['ea_id'] or '(search)'} |" for r in results]
        return "\n".join(lines) + "\n"
    ok = [r for r in results if r["ok"]]
    bad = [r for r in results if not r["ok"]]
    if ok:
        lines += ["### Fetched", "| Code | Player | Club | Source | Keyed | Foreground | Tried first |",
                  "|---|---|---|---|---|---|---|"]
        for r in ok:
            i = r.get("info", {})
            lines.append(f"| {r['code']} | {r['player']} | {r['club']} | {r['source']} | "
                         f"{'yes' if i.get('keyed') else 'no'} | {i.get('out_share', 0):.0%} | "
                         f"{'<br>'.join(r['reasons']) or '-'} |")
        lines.append("")
    if bad:
        lines += ["### Failed", "| Code | Player | Club | EA id | Tried |", "|---|---|---|---|---|"]
        for r in bad:
            lines.append(f"| {r['code']} | {r['player']} | {r['club']} | {r['ea_id'] or '-'} | "
                         f"{'<br>'.join(r['reasons']) or '-'} |")
        lines.append("")
    if not results:
        lines.append("Nothing to do: every rostered player has a face file.")
    return "\n".join(lines) + "\n"


def write_outputs(results: list[dict], md: str) -> None:
    print(md)
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as f:
            f.write(md)
    gh_out = os.environ.get("GITHUB_OUTPUT")
    if gh_out:
        names = ", ".join(r["player"] for r in results if r["ok"])
        codes = " ".join(r["code"] for r in results if r["ok"])
        with open(gh_out, "a", encoding="utf-8") as f:
            f.write(f"fetched={names}\nfetched_codes={codes}\ncount={sum(1 for r in results if r['ok'])}\n")


# ==================================================================================================
def main(argv=None, fetcher: Fetcher | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--offline", metavar="DIR", help="read Rosters.json and 'EA Map.json' (gviz JSON) from DIR")
    ap.add_argument("--dry-run", action="store_true", help="list the missing players, fetch nothing")
    ap.add_argument("--only", help="comma separated FPL codes to restrict to")
    ap.add_argument("--faces", default=str(FACES_DIR), help="faces directory (default: repo faces/)")
    ap.add_argument("--skip", default=str(SKIP_FILE), help="skip list file")
    ap.add_argument("--delay", type=float, default=DELAY)
    args = ap.parse_args(argv)

    fetcher = fetcher or Fetcher(delay=args.delay)
    faces_dir = Path(args.faces)
    try:
        session = None if args.offline else fetcher._sess()
        rosters, eamap = read_tabs(session, args.offline)
    except Exception as e:  # noqa: BLE001
        print(f"## Faces run: could not read the sheet ({type(e).__name__}: {e})")
        return 0
    have = {p.stem for p in faces_dir.glob("*.png")} if faces_dir.exists() else set()
    skip = read_skip(Path(args.skip))
    only = {_digits(c) for c in args.only.split(",")} if args.only else None
    codes = {_digits(r.get("Code")) for r in rosters} - {""}
    todo = plan(rosters, eamap, have, skip, only)

    results = [fetch_player(fetcher, p, faces_dir, dry_run=args.dry_run) for p in todo]
    counts = {"rostered": len(codes), "have": len(codes & have), "skipped": len(codes & skip),
              "todo": len(todo), "fetched": sum(1 for r in results if r["ok"]),
              "failed": sum(1 for r in results if not r["ok"]) if not args.dry_run else 0}
    write_outputs(results, report_md(results, counts, args.dry_run))
    return 0


if __name__ == "__main__":
    sys.exit(main())
