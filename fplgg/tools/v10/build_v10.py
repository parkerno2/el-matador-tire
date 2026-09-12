#!/usr/bin/env python3
"""Build the v10 Matchday frame onto the complete app.

    python3 build_v10.py <index-PREVIEW.html>                 → v10.html   (hidden phone preview, reads the live sheet)
    python3 build_v10.py <index-PREVIEW.html> --prod <out>    → production index.html:
        runs fplgg/tools/port_preview_to_prod.py first (title/manifest/banner/sim/faces/sw), then appends the frame.

The base stays byte-identical except for the anchored edits below; the frame = crest.js + v10-delta + v10-graphic
+ v10-auth (css then js) appended before </body>. Every override is a redefinition after the app script;
window.__orig keeps the originals. Both outputs are node --check'ed on the appended script."""
import re, sys, pathlib, subprocess, tempfile, os
HERE = pathlib.Path(__file__).parent
args = [a for a in sys.argv[1:] if not a.startswith('--')]
PROD = '--prod' in sys.argv
SRC = pathlib.Path(args[0]) if args else HERE / 'index-PREVIEW.html'
OUT = pathlib.Path(args[1]) if PROD and len(args) > 1 else (HERE / ('index.html' if PROD else 'v10.html'))

if PROD:
    port = SRC.parent / 'fplgg' / 'tools' / 'port_preview_to_prod.py'
    assert port.exists(), port
    tmp = tempfile.NamedTemporaryFile(suffix='.html', delete=False).name
    subprocess.run([sys.executable, str(port), str(SRC), tmp], check=True)
    s = open(tmp, encoding='utf-8').read(); os.unlink(tmp)
else:
    s = SRC.read_text(encoding='utf-8')
assert 'v10-delta' not in s

def rep(old, new, label, count=1):
    global s
    n = s.count(old)
    assert n == count, f'{label}: expected {count} match(es), found {n}'
    s = s.replace(old, new)

if not PROD:
    rep('<title>⚠ PREVIEW · FPL Companion</title>', '<title>El Matador Tire · v10 preview</title>', 'title')
    rep('<div class="pvban">PREVIEW BUILD · NOT DEPLOYED</div>', '', 'banner div')
    rep('<button class="novbtn" id="novsim">🧪 Simulate November</button>', '', 'sim button')
    rep("document.getElementById('novsim').onclick=novToggle;", "", 'sim hook')
rep('const mg=(name,sm)=>', 'let mg=(name,sm)=>', 'mg reassignable')
rep('<div class="top"><div class="in">', '<div class="top"><div class="in">', 'top bar present')
rep('family=Manrope:wght@400;500;600;700;800&family=Saira+Condensed', 'family=Archivo+Black&family=Manrope:wght@400;500;600;700;800&family=Saira+Condensed', 'fonts')

crest = (HERE / 'crest.js').read_text(encoding='utf-8')
crest = crest.replace('module.exports={CREST,crestSVG,PALETTE,SHAPES};', '')
assert 'module.exports' not in crest
js = (HERE / 'v10-delta.js').read_text(encoding='utf-8').replace('/*CREST*/', crest)
js += '\n' + (HERE / 'v10-graphic.js').read_text(encoding='utf-8')
js += '\n' + (HERE / 'v10-auth.js').read_text(encoding='utf-8')
js += '\n' + (HERE / 'v10-show.js').read_text(encoding='utf-8')
js += '\n' + (HERE / 'v10-derbies.js').read_text(encoding='utf-8')
js += '\n' + (HERE / 'v10-history.js').read_text(encoding='utf-8')
js += '\n' + (HERE / 'v10-refresh.js').read_text(encoding='utf-8')
js += '\n' + (HERE / 'v10-results.js').read_text(encoding='utf-8')
css = (HERE / 'v10-delta.css').read_text(encoding='utf-8') + '\n' + (HERE / 'v10-graphic.css').read_text(encoding='utf-8') + '\n' + (HERE / 'v10-auth.css').read_text(encoding='utf-8') + '\n' + (HERE / 'v10-show.css').read_text(encoding='utf-8') + '\n' + (HERE / 'v10-derbies.css').read_text(encoding='utf-8') + '\n' + (HERE / 'v10-history.css').read_text(encoding='utf-8') + '\n' + (HERE / 'v10-results.css').read_text(encoding='utf-8')
assert '</script>' not in js and '</style>' not in css
tail = ('\n<!-- v10-delta -->\n<style id="v10css">\n' + css + '\n</style>\n'
        '<script>window.__orig={renderMatch:renderMatch,renderTeam:renderTeam,renderTable:renderTable,renderScoreboard:renderScoreboard,buildNav:buildNav,rowsFor:rowsFor,card:card};</script>\n'
        '<script id="v10js">\n' + js + '\n</script>\n')
i = s.rindex('</body>')
s = s[:i] + tail + s[i:]

with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False, encoding='utf-8') as f:
    f.write(js); tmp = f.name
try:
    subprocess.run(['node', '--check', tmp], check=True)
finally:
    os.unlink(tmp)
if PROD:
    assert 'parkerno2.github.io/el-matador-tire/faces' not in s, 'absolute faces URL in production build'
    assert not re.search(r'PREVIEW(?!S\b)', s), 'PREVIEW marker in production build'
OUT.write_text(s, encoding='utf-8', newline='\n')
print('wrote', OUT, len(s), 'PROD' if PROD else 'preview')
