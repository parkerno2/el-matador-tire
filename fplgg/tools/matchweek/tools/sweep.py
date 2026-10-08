"""Full sweep: every route and sheet, pre and live, at the given widths. Errors, overflow, timings, screenshots.
usage: python3 sweep.py OUTDIR [widths=390] [states=pre,live] [site]"""
import sys, json, time, pathlib
sys.path.insert(0, '/home/claude/next-build/tools')
from mw import MW
out = pathlib.Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=True)
widths = [int(x) for x in (sys.argv[2] if len(sys.argv) > 2 else '390').split(',')]
states = (sys.argv[3] if len(sys.argv) > 3 else 'pre,live').split(',')
site = sys.argv[4] if len(sys.argv) > 4 else '/home/claude/next-build/dist/site'
ROUTES = ['#/matchday/overview', '#/matchday/matchup', '#/matchday/all', '#/matchday/pl', '#/matchday/week',
          '#/team/overview', '#/team/lineup', '#/team/squad', '#/team/transfers', '#/team/fixtures', '#/team/season',
          '#/league/overview', '#/league/results', '#/league/money', '#/league/derbies', '#/league/stats',
          '#/feed/foryou', '#/feed/league', '#/feed/articles', '#/feed/messages', '#/feed/messages/jive', '#/feed/messages/archizio']
SHEETS = [('player', '244851'), ('player', '224117'), ('player', '154561'), ('manager', 'Devils U21s'), ('identity', ''), ('search', ''), ('menu', '')]
OVER = """() => { const W = document.documentElement.clientWidth; const bad = [];
  document.querySelectorAll('#app *, .sheet *').forEach(e => { const r = e.getBoundingClientRect(); if (r.width && r.right > W + 1 && !e.closest('.pills,.rail,[data-scroll],.lg-grid,.md-strip,.fd-rail,.fd-stories,.tm-scroll,.scroll,.hscroll') ) { const cs = getComputedStyle(e); if (cs.position !== 'fixed') bad.push((e.className && e.className.baseVal === undefined ? e.className : e.tagName) + ':' + (e.textContent || '').trim().slice(0, 24)); } });
  return { sw: document.documentElement.scrollWidth, W, bad: bad.slice(0, 6) }; }"""
report = []
for st in states:
    for w in widths:
        with MW(st, site=site, width=w) as m:
            m.ctx.add_init_script("localStorage.setItem('emt-myteam','Cold Palmers')")
            p = m.open('#/matchday/overview')
            p.add_style_tag(content='.nav{position:absolute!important;bottom:auto!important;top:-200px!important}')
            for r in ROUTES:
                e0 = len(m.errors); t = time.time()
                p.evaluate("h => { location.hash = h }", r); p.wait_for_timeout(900)
                ms = p.evaluate("() => { const t = performance.now(); MW.render({keepScroll:true}); return performance.now() - t }")
                o = p.evaluate(OVER)
                name = f"{st}-{w}-{r.strip('#/').replace('/', '_')}"
                p.screenshot(path=str(out / (name + '.png')), full_page=True)
                report.append({'k': name, 'render_ms': round(ms, 1), 'errors': m.errors[e0:], 'scrollW': o['sw'], 'W': o['W'], 'over': o['bad']})
            p.evaluate("h => { location.hash = h }", '#/matchday/overview'); p.wait_for_timeout(500)
            for k, a in SHEETS:
                e0 = len(m.errors)
                p.evaluate("([k,a]) => MW.openSheet(k,a)", [k, a]); p.wait_for_timeout(1300)
                o = p.evaluate(OVER)
                name = f"{st}-{w}-sheet-{k}-{a.replace(' ', '')}"
                h = p.evaluate("() => { const s = [...document.querySelectorAll('.sheet')].pop(); return s ? s.scrollHeight : 0 }")
                p.set_viewport_size({'width': w, 'height': max(844, min(h + 60, 6000))}); p.wait_for_timeout(250)
                p.screenshot(path=str(out / (name + '.png')))
                p.set_viewport_size({'width': w, 'height': 844})
                report.append({'k': name, 'errors': m.errors[e0:], 'scrollW': o['sw'], 'W': o['W'], 'over': o['bad']})
                p.evaluate("() => MW.closeSheet()"); p.wait_for_timeout(450)
json.dump(report, open(out / 'report.json', 'w'), indent=1)
for r in report:
    flag = ('ERR ' if r['errors'] else '') + ('OVER ' if r['scrollW'] > r['W'] or r['over'] else '') + ('SLOW ' if r.get('render_ms', 0) > 60 else '')
    if flag: print(flag, r['k'], r.get('render_ms'), r['errors'][:2], r['over'][:3])
print('done', len(report))
