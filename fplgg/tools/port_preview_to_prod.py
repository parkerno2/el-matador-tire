#!/usr/bin/env python3
"""port_preview_to_prod.py — the documented preview → production port for the El Matador league app.

    python3 port_preview_to_prod.py [index-PREVIEW.html] [index.html]
    (defaults: the two files in the handoff folder root, two levels up from fplgg/tools/)

Every replacement is asserted (an assert that fires beats a silent no-op edit). Reverts the
preview-only differences documented in HANDOFF.md §9 and the el-matador-app skill:
  1. <title> + preview header comment → production title + manifest link
  2. striped PREVIEW banner CSS + body padding, and the banner div
  3. November-simulator button CSS, the button element, and the whole simulator script block
  4. absolute https://parkerno2.github.io/el-matador-tire/faces/ URLs → relative 'faces/' (3 sites incl. FACE_SWAP)
  5. service-worker registration un-commented
  6. PREVIEW-flavoured code comments → production wording
Then verifies no 'PREVIEW' marker remains and runs `node --check` on the extracted <script> block.
Checked 25 Aug 2026: reproduces the shipped index.html byte-for-byte from index-PREVIEW.html.
Re-created 30 Aug 2026 (file was clobbered by a bad edit) and re-verified: diff vs the shipped
v5.5a index.html contains only the v5.6 changes.
Remember: bump sw.js VERSION only when CSS/asset behaviour changed (index.html itself is network-first).
"""
import os, re, subprocess, sys, tempfile

here = os.path.dirname(os.path.abspath(__file__))
root = os.path.abspath(os.path.join(here, '..', '..'))
src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(root, 'index-PREVIEW.html')
dst = sys.argv[2] if len(sys.argv) > 2 else os.path.join(root, 'index.html')

s = open(src, encoding='utf-8').read()
n_ops = 0

def rep(old, new, count=1, label=''):
    """Replace exactly `count` occurrences or die."""
    global s, n_ops
    c = s.count(old)
    assert c == count, f'[{label}] expected {count} occurrence(s), found {c}: {old[:70]!r}'
    s = s.replace(old, new)
    n_ops += 1

def rep_re(pattern, new, label=''):
    global s, n_ops
    s, c = re.subn(pattern, new, s, flags=re.S)
    assert c == 1, f'[{label}] expected 1 regex match, found {c}: {pattern[:70]!r}'
    n_ops += 1

# 1. title + header comment → production title + manifest
rep_re(r'<title>⚠ PREVIEW · FPL Companion</title>\n<!-- =+\n.*?=+ -->\n',
       '<title>FPL Companion · El Matador Tire</title>\n<link rel="manifest" href="manifest.webmanifest">\n', 'title/manifest')

# 2. banner CSS + div
rep_re(r'/\* -+ PREVIEW-ONLY banner -+ \*/\n\.pvban\{[^\n]*\n(body\{padding-top:14px\}\n)', '', 'banner css')
rep('<div class="pvban">PREVIEW BUILD · NOT DEPLOYED</div>\n', '', 1, 'banner div')

# 3. November simulator: css, button, script block
rep_re(r'/\* PREVIEW-ONLY: November simulator button \*/\n\.novbtn\{[^\n]*\n\.novbtn\.on\{[^\n]*\n', '', 'novbtn css')
rep('<button class="novbtn" id="novsim">🧪 Simulate November</button>\n', '', 1, 'novbtn element')
rep_re(r'/\* =+ PREVIEW-DEMO ONLY: November simulator — NEVER PORT =+\n.*?document\.getElementById\(\'novsim\'\)\.onclick=novToggle;\n', '', 'simulator block')

# 4. absolute faces URLs → relative
rep(" /* PREVIEW: absolute faces URL so the local file shows deployed faces. Port as 'faces/' */\n", '', 1, 'faces comment')
rep("'https://parkerno2.github.io/el-matador-tire/faces/'+p.Code+'.png'", "'faces/'+p.Code+'.png'", 2, 'faces urls')
rep("'https://parkerno2.github.io/el-matador-tire/faces/'+fs.src", "'faces/'+fs.src", 1, 'face-swap url (v5.5a)')

# 5. service worker registration
rep("/* PREVIEW: no service worker — restore this line when porting to index.html:\n"
    "if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('sw.js').catch(()=>{}); */",
    "if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('sw.js').catch(()=>{});", 1, 'sw register')

# 6. comment wording
rep("/* PREVIEW: was #1B7F79 — too close to CJ's teal. Pick any colour you like */",
    "// colour changed from #1B7F79 (clashed with CJ's teal)", 1, 'jacob comment')
rep("function renderXIs_legacy(){ /* PREVIEW: retired Manager XIs screen, kept for reference — do not port */",
    "function renderXIs_legacy(){ /* retired Manager XIs screen (v2) — dead code, kept for reference */", 1, 'legacy comment')

_m = re.search(r'PREVIEW(?!S\b)', s)  # PREVIEWS = the GW-preview content cards (v5.4), not a sandbox marker
assert not _m, 'a PREVIEW marker survived the port: ' + s[_m.start() - 80:_m.start() + 80]
assert 'novsim' not in s and 'novToggle' not in s, 'simulator residue'
assert 'parkerno2.github.io' not in s, 'absolute URL residue'

# syntax-check the inline script(s)
scripts = re.findall(r'<script>(.*?)</script>', s, flags=re.S)
assert scripts, 'no <script> block found'
with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False, encoding='utf-8') as f:
    f.write('\n'.join(scripts)); tmp = f.name
try:
    subprocess.run(['node', '--check', tmp], check=True)
finally:
    os.unlink(tmp)

open(dst, 'w', encoding='utf-8', newline='\n').write(s)
print(f'ported {os.path.basename(src)} → {os.path.basename(dst)}: {n_ops} edits, node --check clean, {len(s):,} bytes')
