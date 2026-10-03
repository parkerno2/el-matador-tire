"""3 Oct: the player photo in the sheet vanished on iPhone after scrolling away and back (Parker: Rice).
WebKit drops a filtered <img> layer inside a transformed, scrolling fixed sheet and doesn't repaint it.
Fix: phone sheet rests with no transform (slides with translateY only), the photo gets its own layer,
the drop-shadow filter leaves the sheet photo (a floor shadow replaces it), and the photo decodes sync."""
import pathlib
T = pathlib.Path(__file__).resolve().parents[1] / 'v12'
css = T / 'v12-look.css'; js = T / 'v12-look.js'
c = css.read_text(encoding='utf-8'); j = js.read_text(encoding='utf-8')
MARK = '/* sheet photo on iPhone (3 Oct) */'
assert MARK not in c, 'already applied'
c = c.rstrip('\n') + '\n' + MARK + r'''
@media(max-width:699px){
  .sheet{left:0 !important;right:0;margin:0 auto;transform:translateY(105%) !important}
  .sheet.on{transform:none !important}
}
.sheet .fc .face{-webkit-transform:translateZ(0);transform:translateZ(0);-webkit-backface-visibility:hidden;backface-visibility:hidden;
  background:radial-gradient(58% 10% at 50% 99%,rgba(0,0,0,.30),transparent 72%)}
.sheet .fc .face img{filter:none !important;-webkit-transform:translateZ(0);transform:translateZ(0)}
'''
old = "function lkSheetFix(){const L=sheet.querySelector('.sh-left');"
assert j.count(old) == 1
j = j.replace(old, old + "\n  sheet.querySelectorAll('.sh-left .fc img').forEach(i=>{i.decoding='sync';i.removeAttribute('loading');});", 1)
css.write_text(c, encoding='utf-8', newline='\n'); js.write_text(j, encoding='utf-8', newline='\n')
print('patched', css.name, js.name)
