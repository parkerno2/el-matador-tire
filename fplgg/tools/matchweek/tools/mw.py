"""Harness for the new Matchweek front end.

    import sys; sys.path.insert(0, '/home/claude/next-build/tools')
    from mw import MW, STATES
    with MW(state='pre') as m:                 # 'pre' (real data, Fri 9 Oct 6 pm CT), 'live' (made-up GW6 Saturday), 'ft' (GW5 just finished)
        p = m.open('#/matchday')               # Playwright page at 390x844, data loaded and rendered
        p.screenshot(path='/tmp/x.png', full_page=True)
        print(m.errors)

MW(site=...) serves a build's site dir (default: /home/claude/next-build/dist/site). Build first: /home/claude/next-build/build.sh [outdir].
"""
import sys, os, json, re, pathlib, urllib.parse
sys.path.insert(0, '/home/claude/harness')
import harness
from harness import App, FONTS

STATES = {
    'pre': {'now': '2026-10-09T23:00:00Z', 'tabs': '/home/claude/harness/tabs'},
    'live': {'now': '2026-10-10T15:00:00Z', 'tabs': '/home/claude/harness/fix-d/tabs-live'},
    'ft': {'now': '2026-10-06T15:00:00Z', 'tabs': '/home/claude/harness/tabs'},
    'now': {'now': None, 'tabs': '/home/claude/harness/tabs-oct7'},
}
VF = next(FONTS.glob('fontsource-variable-archivo-*/package/files'))
STATIC = {'Barlow Condensed': 'barlow-condensed', 'Saira Condensed': 'saira-condensed', 'Anton': 'anton', 'Caveat': 'caveat',
          'JetBrains Mono': 'jetbrains-mono', 'Manrope': 'manrope', 'Archivo Black': 'archivo-black'}


def font_css(url):
    q = urllib.parse.parse_qs(urllib.parse.urlparse(url).query)
    out = []
    for fam in q.get('family', []):
        name, _, spec = fam.partition(':')
        if name == 'Archivo' and 'wdth' in spec:
            for sub in ('latin', 'latin-ext'):
                f = VF / f'archivo-{sub}-wdth-normal.woff2'
                out.append("@font-face{font-family:'Archivo';font-style:normal;font-weight:100 900;font-stretch:62%% 125%%;font-display:swap;src:url(https://fonts.gstatic.com/local/%s) format('woff2');}" % f.relative_to(FONTS))
            continue
        pkg = STATIC.get(name) or ('archivo' if name == 'Archivo' else None)
        if not pkg: continue
        d = next(FONTS.glob(f'fontsource-{pkg}-[0-9]*/package/files'), None)
        if not d: continue
        weights = re.findall(r'(?<![\d.])(\d{3})(?![\d.])', spec.split('@')[-1]) or ['400']
        for w in weights:
            for sub in ('latin', 'latin-ext'):
                f = d / f'{pkg}-{sub}-{w}-normal.woff2'
                if f.exists():
                    out.append("@font-face{font-family:'%s';font-style:normal;font-weight:%s;font-display:swap;src:url(https://fonts.gstatic.com/local/%s) format('woff2');}" % (name, w, f.relative_to(FONTS)))
    return '\n'.join(out)


harness.font_css = font_css


class MW(App):
    def __init__(self, state='pre', site='/home/claude/next-build/dist/site', width=390, height=844, now=None, tabs=None, **kw):
        s = STATES[state]
        harness.ROOT = pathlib.Path(site)
        super().__init__(width=width, height=height, now=now or s['now'], tabs=tabs or s['tabs'], **kw)

    def open(self, hash='#/matchday', wait=True):
        p = self.ctx.new_page()
        p.on('pageerror', lambda e: self.errors.append('pageerror: ' + str(e)))
        p.on('console', lambda m: self.console.append((m.type, m.text)) or (m.type == 'error' and 'Failed to load resource' not in m.text and self.errors.append('console: ' + m.text)))
        p.goto(harness.BASE + 'index.html' + hash, wait_until='load')
        if wait:
            p.wait_for_function("() => typeof D !== 'undefined' && D.ro && D.ro.length > 0 && document.querySelector('.nav')", timeout=25000)
            p.evaluate("document.fonts.ready")
            p.wait_for_timeout(500)
        return p

    def go(self, p, hash):
        p.evaluate("h => { location.hash = h }", hash)
        p.wait_for_timeout(350)
        return p
