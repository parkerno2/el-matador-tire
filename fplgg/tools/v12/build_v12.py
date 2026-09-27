#!/usr/bin/env python3
"""v12 build = the v10 build (base + v10 frame) + the v12 modules, appended in order after v10's script/style.

    python3 build_v12.py <index-PREVIEW.html>               → v12.html next to the source (hidden phone preview)
    python3 build_v12.py <index-PREVIEW.html> --prod <out>  → production index.html

Every v12 module is an override/extension declared after everything else. Before adding a top-level name,
grep the base + v10 + v12 sources for it (a re-declared const/let is a SyntaxError that kills the whole module)."""
import sys, pathlib, subprocess, tempfile, os, re
HERE = pathlib.Path(__file__).parent
V10 = HERE.parent / 'v10'
args = [a for a in sys.argv[1:] if not a.startswith('--')]
PROD = '--prod' in sys.argv
SRC = pathlib.Path(args[0]).resolve()
OUT = pathlib.Path(args[1]).resolve() if PROD and len(args) > 1 else SRC.parent / 'v12.html'
JS = ['v12-proj.js', 'v12-match.js', 'v12-stats.js', 'v12-fixtures.js', 'v12-ui.js']
CSS = ['v12-match.css', 'v12-stats.css', 'v12-fixtures.css', 'v12-ui.css']
tmp = tempfile.NamedTemporaryFile(suffix='.html', delete=False).name
cmd = [sys.executable, str(V10 / 'build_v10.py'), str(SRC)] + (['--prod', tmp] if PROD else [])
subprocess.run(cmd, check=True)
built = pathlib.Path(tmp) if PROD else V10 / 'v10.html'
s = built.read_text(encoding='utf-8')
if PROD: os.unlink(tmp)
else: built.unlink()
js = '\n'.join((HERE / f).read_text(encoding='utf-8') for f in JS if (HERE / f).exists())
css = '\n'.join((HERE / f).read_text(encoding='utf-8') for f in CSS if (HERE / f).exists())
assert '</script>' not in js and '</style>' not in css
with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False, encoding='utf-8') as f:
    f.write(js); t2 = f.name
try: subprocess.run(['node', '--check', t2], check=True)
finally: os.unlink(t2)
tail = '\n<!-- v12 -->\n<style id="v12css">\n' + css + '\n</style>\n<script id="v12js">\n' + js + '\n</script>\n'
i = s.rindex('</body>'); s = s[:i] + tail + s[i:]
if not PROD:
    s = s.replace('<title>El Matador Tire · v10 preview</title>', '<title>El Matador Tire · v12 preview</title>')
else:
    assert 'parkerno2.github.io/el-matador-tire/faces' not in s
    assert not re.search(r'PREVIEW(?!S\b)', s)
OUT.write_text(s, encoding='utf-8', newline='\n')
print('wrote', OUT, len(s.encode()), 'bytes', 'PROD' if PROD else 'preview', '· v12 modules:', [f for f in JS if (HERE / f).exists()])
