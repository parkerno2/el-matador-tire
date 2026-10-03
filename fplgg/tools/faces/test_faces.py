#!/usr/bin/env python3
"""
Offline tests for fetch_faces.py. Plain asserts, no network, no test framework:

    python3 fplgg/tools/faces/test_faces.py [--out DIR] [--tabs DIR]

  1. Keyer: existing faces/*.png composited onto flat mid grey, flat light grey, a grey gradient and a
     radial vignette; the recovered alpha mask must match the original (IoU >= 0.95).
  2. Rejection: a flat grey square, a one-colour silhouette on grey and a face on a busy backdrop are
     all refused (an un-keyed grey square must never reach faces/).
  3. Normalisation: 160x160 RGBA, bottom-aligned, head centred, hair top near the house headroom.
  4. --offline --dry-run against the sheet snapshot lists exactly the rostered players with no face
     file, with their EA ids, and makes no network call at all.
Writes a contact sheet of the keyed results to DIR/contact.png (default: /home/claude/harness/faces-test
when that exists, else the system temp dir).
"""
from __future__ import annotations

import argparse
import contextlib
import io
import os
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import fetch_faces as ff  # noqa: E402

REPO = HERE.parents[2]
FACES = REPO / "faces"

# Deterministic sample: a spread of skin tones, hair (incl. bleached and long), kits (incl. white).
SAMPLE = ["106611", "109745", "17761", "212319", "154561", "178301", "219168", "466075", "503139", "513545"]
# Players with no face file in the 3 Oct 2026 sheet snapshot (code -> EA id).
EXPECTED_MISSING = {
    "575476": "278016", "606702": "278903", "577725": "185422", "516895": "269136", "522047": "262027",
    "108416": "204936", "543968": "76803", "473284": "252552", "244723": "240947", "647850": "73885",
    "169432": "220031",
}


# --- helpers -------------------------------------------------------------------------------------
def flat(size, col):
    return Image.new("RGB", size, col)


def gradient(size, c0, c1):
    w, h = size
    im = Image.new("RGB", size)
    px = im.load()
    for y in range(h):
        for x in range(w):
            t = (x + y) / (w + h - 2)
            px[x, y] = tuple(round(c0[i] + (c1[i] - c0[i]) * t) for i in range(3))
    return im


def vignette(size, centre=168, corner=118):
    """A studio-style backdrop: lighter behind the head, darker towards the corners (not a plane)."""
    import math
    w, h = size
    im = Image.new("RGB", size)
    px = im.load()
    cx, cy = w / 2, h * 0.45
    R = math.hypot(cx, cy)
    for y in range(h):
        for x in range(w):
            t = min(1.0, math.hypot(x - cx, y - cy) / R)
            v = round(centre + (corner - centre) * t * t)
            px[x, y] = (v, v, v)
    return im


def busy(size):
    """A backdrop that is not a flat colour: thick dark/light stripes."""
    im = flat(size, (120, 120, 120))
    d = ImageDraw.Draw(im)
    for x in range(0, size[0], 16):
        d.rectangle([x, 0, x + 7, size[1]], fill=(40, 40, 40) if (x // 16) % 2 else (210, 210, 210))
    return im


def composite(face: Image.Image, backdrop: Image.Image) -> Image.Image:
    out = backdrop.convert("RGB").copy()
    out.paste(face, (0, 0), face)
    return out


def png_bytes(im: Image.Image) -> bytes:
    b = io.BytesIO()
    im.save(b, "PNG")
    return b.getvalue()


def iou(a: Image.Image, b: Image.Image) -> float:
    pa, pb = a.tobytes(), b.tobytes()
    inter = sum(1 for u, v in zip(pa, pb) if u >= 128 and v >= 128)
    union = sum(1 for u, v in zip(pa, pb) if u >= 128 or v >= 128)
    return inter / union if union else 0.0


def alpha_bbox(im: Image.Image, thr=32):
    a = im.split()[3]
    px = a.load()
    w, h = a.size
    ys = [y for y in range(h) if any(px[x, y] > thr for x in range(w))]
    xs = [x for x in range(w) if any(px[x, y] > thr for y in range(h))]
    return (xs[0], ys[0], xs[-1], ys[-1]) if xs else None


class NoNetwork(ff.Fetcher):
    """Any attempt to touch the network fails the test."""
    def _sess(self):
        raise AssertionError("network session requested during an offline test")

    def get(self, url, accept="", headers=None):
        raise AssertionError(f"network request during an offline test: {url}")


# --- 1. keyer --------------------------------------------------------------------------------------
def test_keyer(out_dir: Path):
    backdrops = {
        "grey #8a8a8a": lambda s: flat(s, (138, 138, 138)),
        "light #d9d9d9": lambda s: flat(s, (217, 217, 217)),
        "gradient": lambda s: gradient(s, (110, 110, 110), (190, 190, 190)),
        "vignette": vignette,
    }
    tiles, scores = [], []
    for code in SAMPLE:
        face = Image.open(FACES / f"{code}.png").convert("RGBA")
        truth = face.split()[3]
        row = [face]
        for name, mk in backdrops.items():
            comp = composite(face, mk(face.size))
            keyed, info = ff.cutout(comp)
            assert info["keyed"], f"{code} on {name}: composite should have been keyed"
            score = iou(keyed.split()[3], truth)
            scores.append((score, code, name))
            assert score >= 0.95, f"{code} on {name}: IoU {score:.3f} < 0.95"
            # the keyed cutout must also pass validation and come out of the full pipeline
            out, reason, _ = ff.process(png_bytes(comp), native=True)
            assert out is not None, f"{code} on {name}: pipeline rejected a good render: {reason}"
            assert out.size == (ff.OUT, ff.OUT) and out.mode == "RGBA"
            row += [comp, out]
        tiles.append(row)
    worst = min(scores)
    print(f"  keyer: {len(scores)} composites, worst IoU {worst[0]:.3f} ({worst[1]} on {worst[2]}), "
          f"median {sorted(s[0] for s in scores)[len(scores) // 2]:.3f}")
    return tiles


# --- 2. rejection ----------------------------------------------------------------------------------
def test_rejection():
    size = (160, 160)
    out, reason, _ = ff.process(png_bytes(flat(size, (138, 138, 138))), native=True)
    assert out is None and ("tiny" in reason or "foreground" in reason), f"flat grey square: {reason!r}"
    import random
    rnd = random.Random(7)
    noisy = flat(size, (138, 138, 138))                     # same, with sensor-like noise so it is not tiny
    px = noisy.load()
    for y in range(size[1]):
        for x in range(size[0]):
            n = rnd.randint(-4, 4)
            px[x, y] = (138 + n, 138 + n, 138 + n)
    out, reason, _ = ff.process(png_bytes(noisy), native=True)
    assert out is None and "foreground" in reason, f"noisy grey square must be rejected, got {reason!r}"

    sil = flat(size, (138, 138, 138))                       # generic one-colour silhouette on grey
    d = ImageDraw.Draw(sil)
    d.ellipse([50, 20, 110, 85], fill=(70, 80, 85))
    d.rectangle([70, 80, 90, 100], fill=(70, 80, 85))
    d.ellipse([20, 95, 140, 200], fill=(70, 80, 85))
    out, reason, _ = ff.process(png_bytes(sil), native=True)
    assert out is None, "silhouette must be rejected"
    rgba, info = ff.cutout(sil)                             # and specifically by the placeholder rule
    reason = ff.validate(rgba, info, nbytes=10_000)
    assert reason and "placeholder" in reason, f"silhouette should trip the placeholder rule, got {reason!r}"

    real = Image.open(FACES / "690838.png")                 # the one placeholder already in faces/
    out, reason, _ = ff.process(png_bytes(real), native=True)
    assert out is None, "the 690838 silhouette must be rejected"
    rgba, info = ff.cutout(real)
    reason = ff.validate(rgba, info, nbytes=10_000)
    assert reason and "placeholder" in reason, f"690838 should trip the placeholder rule, got {reason!r}"

    face = Image.open(FACES / "106611.png").convert("RGBA")
    out, reason, _ = ff.process(png_bytes(composite(face, busy(face.size))), native=True)
    assert out is None, "a face on a busy backdrop must be rejected rather than saved un-keyed"

    out, reason, _ = ff.process(b"<html>not found</html>", native=True)
    assert out is None and "not an image" in reason
    out, reason, _ = ff.process(png_bytes(flat((16, 16), (138, 138, 138))), native=True)
    assert out is None and "tiny" in reason
    print("  rejection: flat square, silhouettes, busy backdrop, html, tiny file all refused")


# --- 3. normalisation ------------------------------------------------------------------------------
def test_normalise():
    tiles = []
    # PL-style photo (head + chest, transparent): head-based framing
    for code in ("465730", "551466", "586309"):
        src = Image.open(FACES / f"{code}.png").convert("RGBA")
        out = ff.normalise(src, native=False)
        assert out.size == (ff.OUT, ff.OUT) and out.mode == "RGBA"
        bb = alpha_bbox(out)
        assert bb[3] == ff.OUT - 1, f"{code}: not bottom-aligned (bottom row {bb[3]})"
        assert abs(bb[1] - ff.HEADROOM) <= 4, f"{code}: hair top at {bb[1]}, expected ~{ff.HEADROOM}"
        g = ff.head_geometry(out.split()[3])
        assert abs(g["cx"] - ff.OUT / 2) <= 8, f"{code}: head centre x {g['cx']:.0f}, expected ~80"
        tiles.append((src, out))
    # small native render: scaled up, framing untouched
    src = Image.open(FACES / "482616.png").convert("RGBA")
    out = ff.normalise(src, native=True)
    assert out.size == (ff.OUT, ff.OUT)
    bb = alpha_bbox(out)
    assert bb[3] == ff.OUT - 1 and bb[1] <= 24
    tiles.append((src, out))
    # already-160 render passes through unchanged
    src = Image.open(FACES / "106611.png").convert("RGBA")
    assert ff.normalise(src, native=True).tobytes() == src.tobytes()
    # pipeline: a 220x280 photo on grey -> keyed -> framed 160x160
    comp = composite(Image.open(FACES / "465730.png").convert("RGBA"), flat((220, 280), (138, 138, 138)))
    out, reason, info = ff.process(png_bytes(comp), native=False)
    assert out is not None, reason
    assert out.size == (ff.OUT, ff.OUT) and alpha_bbox(out)[3] == ff.OUT - 1
    print("  normalise: 160x160 RGBA, bottom-aligned, head centred, headroom ok")
    return tiles


# --- 4. offline dry run ----------------------------------------------------------------------------
def test_dry_run(tabs: Path):
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        rc = ff.main(["--offline", str(tabs), "--dry-run", "--faces", str(FACES)], fetcher=NoNetwork())
    report = buf.getvalue()
    assert rc == 0
    rows = [ln for ln in report.splitlines() if ln.startswith("| ") and ln.split("|")[1].strip().isdigit()]
    got = {ln.split("|")[1].strip(): ln.split("|")[4].strip() for ln in rows}
    assert got == EXPECTED_MISSING, f"dry run listed {got}, expected {EXPECTED_MISSING}"
    assert "to fetch 11" in report and "fetched 0" in report
    print(f"  dry run: exactly {len(got)} missing players listed with EA ids, no network touched")

    # skip list honoured
    with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False) as f:
        f.write("# test\n575476  # Murillo\n")
    try:
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            ff.main(["--offline", str(tabs), "--dry-run", "--faces", str(FACES), "--skip", f.name], fetcher=NoNetwork())
        assert "575476" not in buf.getvalue() and "to fetch 10" in buf.getvalue()
    finally:
        os.unlink(f.name)

    # GITHUB_STEP_SUMMARY / GITHUB_OUTPUT are written when set
    with tempfile.TemporaryDirectory() as td:
        env = {"GITHUB_STEP_SUMMARY": f"{td}/summary.md", "GITHUB_OUTPUT": f"{td}/out.txt"}
        old = {k: os.environ.get(k) for k in env}
        os.environ.update(env)
        try:
            with contextlib.redirect_stdout(io.StringIO()):
                ff.main(["--offline", str(tabs), "--dry-run", "--faces", str(FACES)], fetcher=NoNetwork())
        finally:
            for k, v in old.items():
                os.environ.pop(k) if v is None else os.environ.__setitem__(k, v)
        assert "Faces run" in Path(env["GITHUB_STEP_SUMMARY"]).read_text()
        assert "fetched=\n" in Path(env["GITHUB_OUTPUT"]).read_text()
    print("  dry run: skip list and GitHub summary/output files honoured")


# --- 5. end to end with a fake network ---------------------------------------------------------------
class FakeNetwork(ff.Fetcher):
    """Serves canned responses per URL so the whole fetch_player flow runs without the internet."""
    def __init__(self, routes):
        super().__init__(delay=0)
        self.routes, self.log = routes, []

    def _sess(self):
        raise AssertionError("real session requested")

    def get(self, url, accept="", headers=None):
        self.log.append(url)
        for key, resp in self.routes.items():
            if key in url:
                return resp
        return 404, b"", "text/html"


def test_end_to_end(tabs: Path):
    grey = (138, 138, 138)
    render = composite(Image.open(FACES / "106611.png").convert("RGBA"), flat((160, 160), grey))
    small = composite(Image.open(FACES / "482616.png").convert("RGBA"), flat((120, 120), grey))
    photo = Image.open(FACES / "465730.png").convert("RGBA")                 # transparent PL-style photo
    sil = flat((160, 160), grey)
    ImageDraw.Draw(sil).ellipse([40, 20, 120, 100], fill=(70, 80, 85))
    ImageDraw.Draw(sil).rectangle([20, 95, 140, 160], fill=(70, 80, 85))
    import random
    rnd, px = random.Random(3), sil.load()                  # a little noise so it is not a "tiny file"
    for y in range(160):
        for x in range(160):
            r, g, b = px[x, y]
            n = rnd.randint(-3, 3)
            px[x, y] = (r + n, g + n, b + n)
    routes = {
        "fc27/faces/278016.png": (200, png_bytes(render), "image/png"),        # Murillo: fc27 render
        "fc27/faces/278903.png": (404, b"", "text/html"),                      # Jacquet: fc27 missing,
        "fc26/faces/278903.png": (200, png_bytes(small), "image/png"),         #   fc26 120px render
        "fc27/faces/185422.png": (200, png_bytes(sil), "image/png"),           # King: futwiz silhouette,
        "fc26/faces/185422.png": (200, b"<html>soft 404</html>", "text/html"),  #   html with 200,
        "250x250/p577725.png": (200, png_bytes(photo), "image/png"),           #   PL photo wins
        "250x250/p516895.png": (200, png_bytes(flat((250, 250), grey)), "image/png"),  # Mainoo: nothing usable
    }
    net = FakeNetwork(routes)
    with tempfile.TemporaryDirectory() as td:
        faces = Path(td) / "faces"
        faces.mkdir()
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            rc = ff.main(["--offline", str(tabs), "--faces", str(faces), "--delay", "0",
                          "--only", "575476,606702,577725,516895"], fetcher=net)
        report = buf.getvalue()
        assert rc == 0
        got = sorted(p.name for p in faces.glob("*.png"))
        assert got == ["575476.png", "577725.png", "606702.png"], (got, report)
        for name in got:
            im = Image.open(faces / name)
            assert im.size == (160, 160) and im.mode == "RGBA", name
            bb = alpha_bbox(im)
            assert bb and bb[3] == 159, f"{name} not bottom-aligned"
            # never an opaque square: corners must be transparent
            assert im.getpixel((0, 0))[3] == 0 and im.getpixel((159, 0))[3] == 0, name
        assert "| 575476 | Murillo | NFO | futwiz fc27 |" in report, report
        assert "| 606702 | Jacquet | LIV | futwiz fc26 |" in report, report
        assert "| 577725 | King | FUL | premier league 250 |" in report, report
        assert "516895" in report and "fetched 3" in report and "failed 1" in report, report
        assert "placeholder" in report and "HTML page" in report, report
        # order of sources: fc27 first, and nothing hit the network for already-present faces
        murillo = [u for u in net.log if "278016" in u]
        assert murillo[0].endswith("fc27/faces/278016.png") and len(murillo) == 1
        # a rerun fetches nothing for the three now present
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            ff.main(["--offline", str(tabs), "--faces", str(faces), "--delay", "0",
                     "--only", "575476,606702,577725"], fetcher=net)
        assert "to fetch 0" in buf.getvalue()
    print("  end to end: fc27 render, fc26 fallback, silhouette/html rejected -> PL photo, hard failure reported")


# --- contact sheet ---------------------------------------------------------------------------------
def contact_sheet(key_tiles, norm_tiles, path: Path):
    T = 160
    cols = max(len(r) for r in key_tiles)
    rows = len(key_tiles) + 1
    sheet = Image.new("RGB", (cols * T, rows * T), (255, 0, 255))
    for r, row in enumerate(key_tiles):
        for c, im in enumerate(row):
            tile = im.convert("RGBA").resize((T, T)) if im.size != (T, T) else im.convert("RGBA")
            sheet.paste(tile, (c * T, r * T), tile)
    x = 0
    for src, out in norm_tiles:
        s = src.copy()
        s.thumbnail((T, T))
        sheet.paste(s, (x, (rows - 1) * T), s)
        sheet.paste(out, (x + T, (rows - 1) * T), out)
        x += 2 * T
        if x + 2 * T > sheet.width:
            break
    path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(path)
    print(f"  contact sheet: {path}  (rows: original | grey -> keyed | light -> keyed | gradient -> keyed | "
          f"vignette -> keyed; last row: source -> normalised)")


def main():
    ap = argparse.ArgumentParser()
    default_out = Path("/home/claude/harness/faces-test")
    ap.add_argument("--out", default=str(default_out if default_out.parent.exists() else Path(tempfile.gettempdir()) / "faces-test"))
    ap.add_argument("--tabs", default=os.environ.get("FACES_TABS_DIR", "/home/claude/harness/tabs"))
    args = ap.parse_args()
    print("test_faces")
    key_tiles = test_keyer(Path(args.out))
    test_rejection()
    norm_tiles = test_normalise()
    tabs = Path(args.tabs)
    if (tabs / "Rosters.json").exists() and (tabs / "EA Map.json").exists():
        test_dry_run(tabs)
        test_end_to_end(tabs)
    else:
        print(f"  dry run: SKIPPED (no sheet snapshot at {tabs}; pass --tabs DIR)")
    contact_sheet(key_tiles, norm_tiles, Path(args.out) / "contact.png")
    print("all tests passed")


if __name__ == "__main__":
    main()
