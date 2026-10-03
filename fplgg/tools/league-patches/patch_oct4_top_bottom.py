"""4 Oct (2): the iPhone fog under the status bar survived the root-background fix. It is iOS 26's Liquid Glass
scroll-edge blur, which iOS draws over home-screen apps that use apple-mobile-web-app-status-bar-style
black-translucent (content under the clock); no CSS turns it off. Verified fix elsewhere (iOS 27 device test):
the default status-bar style, so the app starts below an opaque status bar tinted by theme-color. iOS reads that
meta when the app is ADDED, so the home-screen icon must be re-added once.
For installs that keep the old setting: the header content moves down below the blur band, a fixed ink strip
covers the status-bar area, and the bottom nav sits lower (less dead space over the home indicator)."""
import pathlib
R = pathlib.Path(__file__).resolve().parents[3]
base = R / 'index-PREVIEW.html'; look = R / 'fplgg/tools/v12/v12-look.css'
b = base.read_text(encoding='utf-8')
old = '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">'
assert b.count(old) == 1, 'meta'
b = b.replace(old, '<meta name="apple-mobile-web-app-status-bar-style" content="default">', 1)
old = '</style></head><body>'
assert b.count(old) == 1, 'body'
b = b.replace(old, '</style></head><body><div id="sbfill" aria-hidden="true"></div>', 1)
base.write_text(b, encoding='utf-8', newline='\n')
c = look.read_text(encoding='utf-8')
old = '.top{padding:calc(7px + env(safe-area-inset-top)) 14px 7px !important}\n'
assert c.count(old) == 1, 'top'
c = c.replace(old, '/* header and nav positions on iPhone (4 Oct): the header row clears the status-bar blur band; the nav sits lower */\n'
  '.top{padding:calc(16px + env(safe-area-inset-top)) 14px 10px !important}\n'
  '#sbfill{position:fixed;top:0;left:0;right:0;height:env(safe-area-inset-top);background:#17121D;z-index:31;pointer-events:none}\n'
  'nav{padding-bottom:max(6px,calc(env(safe-area-inset-bottom) - 14px)) !important}\n', 1)
look.write_text(c, encoding='utf-8', newline='\n')
print('patched')
