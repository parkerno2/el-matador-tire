"""13 Sep 2026 — base changes behind the v11 header:
  1. Matchup page: the Actual | Expected toggle is gone (it clipped the derby name; XPMODE stays false for good).
  2. Pull-to-refresh gesture removed — the header ↻ button (v10-refresh.js) is the refresh; #ptr stays as the toast.
Applies to index-PREVIEW.html only; index.html is rebuilt by build_v10.py --prod."""
import sys, pathlib
p = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else 'index-PREVIEW.html')
s = p.read_text(encoding='utf-8')
MARK = '/* v11: refresh is the header button (v10-refresh.js); the pull gesture retired 13 Sep */'
assert MARK not in s, 'already patched'

def rep(old, new, label):
    global s
    n = s.count(old)
    assert n == 1, f'{label}: expected 1 match, found {n}'
    s = s.replace(old, new)

rep("""   +(D.hasXP?'<div class="axtog"><div class="in3">'
     +'<button class="'+(XPMODE?'':'on')+'" data-xt="0">Actual</button>'
     +'<button class="'+(XPMODE?'on':'')+'" data-xt="1">Expected</button></div></div>'+xnote:'')
""", "", 'axtog block')
rep("""  document.querySelectorAll('[data-xt]').forEach(b=>b.onclick=()=>{XPMODE=b.dataset.xt==='1';renderGW()});
""", "", 'axtog binding')

start = s.index("/* pull-to-refresh: drag down from the very top of any tab to re-pull the sheet.")
end = s.index("/* iOS resumes the app frozen", start)
block = s[start:end]
assert "document.addEventListener('touchstart'" in block and "loadAll(true).finally" in block and block.count('})();') == 1, 'ptr block shape'
s = s[:start] + MARK + '\n' + s[end:]

p.write_text(s, encoding='utf-8')
print('patched', p, len(s))
