"""4 Oct: on iPhone (iOS 26, installed app) a light frosted "fog" sat under the status bar with dark clock text over
the ink header. Cause: the 27 Sep D2 look set html AND body to the light ground, and iOS colours the status bar area
from the page's root background when the header isn't stuck (scroll at the top). Before D2 the root was dark plum.
Fix: root (html) background is ink #17121D, body keeps the light ground and always fills the screen. Same for articles."""
import pathlib
R = pathlib.Path(__file__).resolve().parents[3]
look = R / 'fplgg/tools/v12/v12-look.css'; art = R / 'fplgg/tools/articles/article.css'
s = look.read_text(encoding='utf-8')
old = "html,body{background:#F5F3F8 !important}\n"
assert s.count(old) == 1, 'v12-look anchor'
s = s.replace(old, "/* root stays ink so iPhone tints the status bar dark (4 Oct); the body carries the light ground */\n"
                   "html{background:#17121D !important}\nbody{background:#F5F3F8 !important;min-height:100vh;min-height:100dvh}\n", 1)
look.write_text(s, encoding='utf-8', newline='\n')
a = art.read_text(encoding='utf-8')
old = "html,body{background:var(--ground)}\n"
assert a.count(old) == 1, 'article anchor'
a = a.replace(old, "/* root stays ink so iPhone tints the status bar dark under the ink header; the body carries the ground */\n"
                   "html{background:var(--ink);overscroll-behavior-y:none}\nbody{background:var(--ground);min-height:100vh;min-height:100dvh}\n", 1)
art.write_text(a, encoding='utf-8', newline='\n')
print('patched')
