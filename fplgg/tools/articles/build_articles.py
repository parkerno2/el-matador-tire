#!/usr/bin/env python3
"""Build the El Matador Tire article pages (recap-gwN.html, preview-gwN.html in the repo root).

Each page carries its own content; the shared parts live here in fplgg/tools/articles/ and are written into the page
between markers, so every article looks the same and a design change is one edit plus one build:

    <!-- article:head -->    ...  theme colour, link-preview tags (from <title> and the standfirst), icons, fonts
    <!-- article:css -->     ...  article.css, inlined (pages stay self-contained: the service worker caches
                                  same-origin assets forever until a version bump, pages themselves are network-first)
    <!-- article:header -->  ...  the ink header bar with the close (x) that returns to the app
    <!-- article:sprite -->  ...  the team badges used on the page (from crests.json, the app's own badges)
    <!-- article:script -->  ...  article.js (headshot cascade)

and every badge placeholder <i class="cr" data-team="Team Name"></i> (or class="cr lg" for the Mono header badge)
gets its <svg> filled in. Running it again is a no-op when nothing changed.

    python3 fplgg/tools/articles/build_articles.py              # every recap/preview page in the repo root
    python3 fplgg/tools/articles/build_articles.py recap-gw6.html
    python3 fplgg/tools/articles/build_articles.py --check      # exit 1 if any page is out of date or breaks a rule

Rules it enforces (the build fails and writes nothing): all five markers present once, no em dashes in the copy,
every badge names a known team, and each matchup card keeps the markup the app reads (v10-graphic.js loadArticle
parses the current preview: .card > .mhead .kick, two .tm .tn team names, .story, .hits li, .pstrip .ph[data-code],
.pname, .pline, .notm .n/.c).
"""
import argparse, html, json, pathlib, re, sys
from html.parser import HTMLParser

HERE = pathlib.Path(__file__).resolve().parent
REPO = HERE.parents[2]
MARKERS = ['head', 'css', 'header', 'sprite', 'script']
FONTS = ('<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
         '<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700;800&family=Barlow+Condensed:wght@600;700&display=swap" rel="stylesheet">\n'
         '<link href="https://fonts.googleapis.com/css2?family=Archivo+Black&display=swap" rel="stylesheet">')
# the app's Matchweek plate (v10-delta.js mwWordmark), 60 px wide as in the app header
WORDMARK = ('<svg viewBox="0 0 564 152" width="60" height="16" role="img" aria-label="Matchweek" style="filter:drop-shadow(0 2px 5px rgba(0,0,0,.4))">'
            '<defs><linearGradient id="mwE" x1="0" y1="0" x2=".85" y2="1"><stop offset="0" stop-color="#04F5FF"/><stop offset=".45" stop-color="#2E5BFF"/>'
            '<stop offset="1" stop-color="#8E44AD"/></linearGradient><linearGradient id="mwI" x1="0" y1="0" x2=".4" y2="1"><stop offset="0" stop-color="#101E4E"/>'
            '<stop offset="1" stop-color="#060B24"/></linearGradient></defs><path d="M16 8 H498 L556 66 V136 L548 144 H16 L8 136 V16 Z" fill="url(#mwI)" '
            'stroke="url(#mwE)" stroke-width="6"/><text x="272" y="98" text-anchor="middle" font-family="\'Archivo Black\',sans-serif" font-size="62" '
            'letter-spacing="3"><tspan fill="#FFD23F">MATCH</tspan><tspan fill="#FFFFFF">WEEK</tspan></text></svg>')
# The close returns to the app with history.back() when the app opened the page (the app restores its own screen
# from its URL); opened from a shared link, there is no app behind it, so the plain href loads the app.
CLOSE = ('<a class="sh-x" href="index.html" aria-label="Close" onclick="if(document.referrer&amp;&amp;document.referrer.indexOf(location.origin)===0'
         '&amp;&amp;history.length&gt;1){history.back();return false}"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" '
         'stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13"/></svg></a>')
HEADER = '<header class="ah"><div class="in"><div class="brand">' + WORDMARK + '<h1>El Matador Tire</h1></div>' + CLOSE + '</div></header>'
# names the copy uses for a team besides its full name (short names come from crests.json)
ALIASES = {'Gulls': 'The Soaring Gulls', 'McGinn': 'In It to McGinn It', 'Maize': 'I Am a Baleba',
           "Maize 'n' Mount": 'I Am a Baleba', 'Maize ‘n’ Mount': 'I Am a Baleba'}


class BuildError(Exception):
    pass


def load_crests():
    crests = json.loads((HERE / 'crests.json').read_text())
    names = {}
    for team, c in crests.items():
        names[team] = team
        names[c['short']] = team
    for a, t in ALIASES.items():
        names[a] = t
    return crests, names


def block(name, inner):
    return '<!-- article:%s -->\n%s\n<!-- /article:%s -->' % (name, inner, name)


def put(page, name, inner, fname):
    pat = re.compile(r'<!-- article:%s -->.*?<!-- /article:%s -->' % (name, name), re.S)
    found = pat.findall(page)
    if len(found) != 1:
        raise BuildError('%s: marker article:%s found %d times (need exactly 1)' % (fname, name, len(found)))
    return pat.sub(lambda m: block(name, inner), page)


def text_of(fragment):
    t = re.sub(r'<[^>]+>', '', fragment)
    return re.sub(r'\s+', ' ', html.unescape(t)).strip()


def head_html(page, fname):
    t = re.search(r'<title>(.*?)</title>', page, re.S)
    s = re.search(r'<div class="stand">(.*?)</div>', page, re.S)
    if not t or not s:
        raise BuildError('%s: needs a <title> and a <div class="stand"> (the standfirst)' % fname)
    title, desc = text_of(t.group(1)), text_of(s.group(1))
    q = lambda x: html.escape(x, quote=True)
    return '\n'.join([
        '<meta name="theme-color" content="#17121D">',
        '<meta property="og:type" content="article">',
        '<meta property="og:site_name" content="El Matador Tire">',
        '<meta property="og:title" content="%s">' % q(title),
        '<meta property="og:description" content="%s">' % q(desc),
        '<meta name="twitter:card" content="summary">',
        '<link rel="icon" type="image/png" href="icons/icon-32.png">',
        '<link rel="apple-touch-icon" href="icons/icon-180.png">',
        FONTS])


def badges(page, fname, crests, names):
    used = {}

    def fill(m):
        lg, raw = m.group(1), html.unescape(m.group(2))
        team = names.get(raw)
        if not team:
            raise BuildError('%s: unknown team in data-team="%s" (known: %s; add an alias in build_articles.py ALIASES)'
                             % (fname, raw, ', '.join(sorted(crests))))
        ini = crests[team]['ini']
        kind = 'l' if lg else 's'
        used[(ini, kind)] = team
        return ('<i class="cr%s" data-team="%s"><svg viewBox="0 0 100 108" aria-hidden="true" focusable="false">'
                '<use href="#cr-%s-%s"/></svg></i>') % (lg or '', m.group(2), ini, kind)

    pat = re.compile(r'<i class="cr( lg)?" data-team="([^"]+)">(?:<svg\b.*?</svg>)?</i>', re.S)
    page = ''.join(seg if seg.startswith('<!--') else pat.sub(fill, seg) for seg in re.split(r'(<!--.*?-->)', page, flags=re.S))
    defs, syms = [], []
    for (ini, kind), team in sorted(used.items()):
        body = crests[team]['small' if kind == 's' else 'large']
        for d in re.findall(r'<defs>(.*?)</defs>', body, re.S):
            defs.append(d)
        body = re.sub(r'<defs>.*?</defs>', '', body, flags=re.S)
        syms.append('<symbol id="cr-%s-%s" viewBox="0 0 100 108">%s</symbol>' % (ini, kind, body))
    sprite = ('<svg class="sprite" width="0" height="0" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true" focusable="false">'
              + ('<defs>%s</defs>' % ''.join(defs) if defs else '') + '\n' + '\n'.join(syms) + '\n</svg>')
    return page, sprite


class Contract(HTMLParser):
    """each matchup card (a .card holding a .mhead) must keep what the app's preview parser reads"""
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack, self.cards, self.cur = [], [], None

    def handle_starttag(self, tag, attrs):
        if tag in ('br', 'img', 'meta', 'link', 'use', 'path', 'rect', 'stop', 'circle'):
            return
        cls = (dict(attrs).get('class') or '').split()
        self.stack.append((tag, cls))
        if tag == 'div' and 'card' in cls and self.cur is None:
            self.cur = {'depth': len(self.stack), 'classes': []}
        if self.cur is not None:
            self.cur['classes'].extend(cls)
            if 'ph' in cls:
                self.cur.setdefault('ph', []).append(dict(attrs).get('data-code'))

    def handle_startendtag(self, tag, attrs):
        if self.cur is not None:
            self.cur['classes'].extend((dict(attrs).get('class') or '').split())

    def handle_endtag(self, tag):
        if not self.stack:
            return
        while self.stack:
            t, _ = self.stack.pop()
            if self.cur is not None and len(self.stack) < self.cur['depth']:
                self.cards.append(self.cur)
                self.cur = None
            if t == tag:
                break


def check(page, fname):
    problems = []
    body = page[page.find('<body'):]
    copy = re.sub(r'<(script|style|svg)\b.*?</\1>', '', body, flags=re.S)
    copy = re.sub(r'<!--.*?-->', '', copy, flags=re.S)
    plain = text_of(copy)
    for m in re.finditer('—', plain):
        problems.append('%s: em dash in the copy (use a comma, colon or full stop): ...%s...'
                        % (fname, plain[max(0, m.start() - 60):m.end() + 40]))
    p = Contract()
    p.feed(body)
    for i, c in enumerate(p.cards, 1):
        cl = c['classes']
        if 'mhead' not in cl:
            continue
        need = {'kick': 1, 'tm': 2, 'tn': 2, 'story': 1}
        for k, n in need.items():
            if cl.count(k) != n:
                problems.append('%s: matchup card %d has %d .%s (the app reads exactly %d)' % (fname, i, cl.count(k), k, n))
        if 'pstrip' in cl and not all(c.get('ph') or [None]):
            problems.append('%s: matchup card %d: .ph needs data-code (the FPL player code from the Players tab)' % (fname, i))
    return problems


SCORE = re.compile(r'(?<![\w.\u2013])(\d+(?:\.\d+)?(?:\u2013\d+(?:\.\d+)?)+)(?![\w.\u2013])')


def nowrap_scores(page):
    """keep scorelines and ranges like 2\u20130, 29\u201320 or 4\u20133\u20131 on one line (a line may otherwise break after the
    en dash: "2\u2013" / "0 start"). Text only: tags, attributes, comments, script, style and svg are left alone."""
    i = page.find('<body')
    head, body = page[:i], page[i:]
    body = re.sub(r'<span class="nw">([^<]*)</span>', r'\1', body)
    out, skip = [], 0
    for tok in re.split(r'(<!--.*?-->|<[^>]+>)', body, flags=re.S):
        if tok.startswith('<'):
            t = re.match(r'</?([a-zA-Z0-9]+)', tok)
            if t and t.group(1).lower() in ('script', 'style', 'svg'):
                skip += -1 if tok.startswith('</') else (0 if tok.endswith('/>') else 1)
            out.append(tok)
        else:
            out.append(tok if skip else SCORE.sub(r'<span class="nw">\1</span>', tok))
    return head + ''.join(out)


def build(fname, page, crests, names):
    page, sprite = badges(page, fname, crests, names)
    page = nowrap_scores(page)
    page = put(page, 'head', head_html(page, fname), fname)
    page = put(page, 'css', '<style>\n' + (HERE / 'article.css').read_text().strip() + '\n</style>', fname)
    page = put(page, 'header', HEADER, fname)
    page = put(page, 'sprite', sprite, fname)
    page = put(page, 'script', '<script>\n' + (HERE / 'article.js').read_text().strip() + '\n</script>', fname)
    problems = check(page, fname)
    if problems:
        raise BuildError('\n'.join(problems))
    return page


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('pages', nargs='*', help='pages to build (default: every recap-gw*.html and preview-gw*.html in the repo root)')
    ap.add_argument('--check', action='store_true', help='write nothing; exit 1 if a page is out of date or breaks a rule')
    a = ap.parse_args()
    files = [pathlib.Path(x) if pathlib.Path(x).is_absolute() or pathlib.Path(x).exists() else REPO / x for x in a.pages] \
        or sorted(REPO.glob('recap-gw*.html')) + sorted(REPO.glob('preview-gw*.html'))
    crests, names = load_crests()
    bad, stale = False, []
    for f in files:
        src = f.read_text()
        try:
            out = build(f.name, src, crests, names)
        except BuildError as e:
            print(e, file=sys.stderr)
            bad = True
            continue
        if out != src:
            stale.append(f.name)
            if not a.check:
                f.write_text(out)
    if a.check:
        if stale:
            print('out of date (run build_articles.py): ' + ', '.join(stale), file=sys.stderr)
        print('checked %d page(s)' % len(files))
        sys.exit(1 if bad or stale else 0)
    print('built %d page(s), %d changed%s%s' % (len(files), len(stale), (': ' + ', '.join(stale)) if stale else '',
                                                '; FAILED pages above were not written' if bad else ''))
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main()
