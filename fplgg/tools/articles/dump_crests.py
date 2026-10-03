"""Snapshot the app's team badges into crests.json for the article pages.

The badges are drawn by the live app (fplgg/tools/v12/v12-look.js crestSVG, after the Managers tab's colour and
shape choices are applied), so the snapshot is taken from the running app in the phone-size harness:

    python3 fplgg/tools/articles/dump_crests.py            # repo = this checkout, harness = /home/claude/harness

Re-run it when a manager changes colour, crest shape or emblem in the app, then run build_articles.py.
Small = 32 px and under (team-colour fill), large = Mono (ink badge, team-colour line), exactly as the app draws them.
"""
import json, os, pathlib, re, sys

HERE = pathlib.Path(__file__).resolve().parent
REPO = HERE.parents[2]
HARNESS = os.environ.get('EMT_HARNESS', '/home/claude/harness')
os.environ.setdefault('EMT_ROOT', str(REPO))
sys.path.insert(0, HARNESS)
from harness import App  # noqa: E402

JS = """() => Object.keys(TEAMS).map(t => ({team: t, ini: TEAMS[t].ini, col: TEAMS[t].col,
  short: (typeof SHORTOF !== 'undefined' && SHORTOF[t]) || t, manager: (typeof FIRSTOF === 'function' ? FIRSTOF(t) : ''),
  small: crestOf(t, 24), large: crestOf(t, 52)}))"""

def inner(svg, ini, kind):
    """keep the drawing, drop the outer <svg> (the build wraps it in a <symbol>); make clip ids page-unique"""
    body = re.sub(r'^\s*<svg[^>]*>', '', svg.strip())
    body = re.sub(r'</svg>\s*$', '', body)
    body = re.sub(r'<!--.*?-->', '', body, flags=re.S)
    ids = re.findall(r'id="([^"]+)"', body)
    for n, i in enumerate(ids):
        new = 'cr%s%s%d' % (ini, kind, n)
        body = body.replace('id="%s"' % i, 'id="%s"' % new).replace('url(#%s)' % i, 'url(#%s)' % new)
    return re.sub(r'\s+', ' ', body).strip()

with App(width=390, height=844) as app:
    p = app.open('v12.html')
    rows = p.evaluate(JS)
out = {}
for r in rows:
    out[r['team']] = {'ini': r['ini'], 'col': r['col'], 'short': r['short'], 'manager': r['manager'],
                      'small': inner(r['small'], r['ini'], 's'), 'large': inner(r['large'], r['ini'], 'l')}
(HERE / 'crests.json').write_text(json.dumps(out, indent=1, ensure_ascii=False) + '\n')
print('wrote', HERE / 'crests.json', len(out), 'teams')
