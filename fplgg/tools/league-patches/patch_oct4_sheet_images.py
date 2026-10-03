"""4 Oct: on iPhone the club badge and nation flag on the player-sheet card also vanished after scrolling away
and back (Parker, after the 3 Oct photo fix). Extend the photo treatment to every image in the sheet card (own
compositing layer, sync decode), and add a safety net for every image in the sheet: an image that re-enters view
after leaving it is swapped for a fresh copy (cached, decoded sync), which forces WebKit to paint it again."""
import pathlib
T = pathlib.Path(__file__).resolve().parents[1] / 'v12'
css = T / 'v12-look.css'; js = T / 'v12-look.js'
c = css.read_text(encoding='utf-8'); j = js.read_text(encoding='utf-8')
MARK = '/* sheet images on iPhone (4 Oct) */'
assert MARK not in c, 'already applied'
old = ".sheet .fc .face img{filter:none !important;-webkit-transform:translateZ(0);transform:translateZ(0)}\n"
assert c.count(old) == 1
c = c.replace(old, old + MARK + "\n.sheet .fc img,.sheet .fxblk img{-webkit-transform:translateZ(0);transform:translateZ(0);-webkit-backface-visibility:hidden;backface-visibility:hidden}\n", 1)
JMARK = '/* sheet images on iPhone (4 Oct) */'
assert JMARK not in j
j = j.rstrip('\n') + '\n\n' + JMARK + r'''
/* iPhone dropped images inside the scrolling sheet (card photo, club badge, flag) after they were scrolled away and
   back. Every sheet image decodes synchronously, and one that re-enters view after leaving is replaced by a fresh copy
   (same src, already cached), so WebKit paints it again. Harmless elsewhere. */
(function(){
  const sh=document.getElementById('sheet');if(!sh||!('IntersectionObserver' in window)||!('MutationObserver' in window))return;
  const gone=new WeakSet();
  const io=new IntersectionObserver(es=>{es.forEach(e=>{const im=e.target;
    if(!e.isIntersecting){gone.add(im);return;}
    if(!gone.has(im)||!im.isConnected||!im.complete||!im.naturalWidth)return;
    const c=im.cloneNode(true);c.decoding='sync';io.unobserve(im);im.replaceWith(c);});},{root:sh});
  const arm=root=>{if(!root||!root.querySelectorAll)return;(root.tagName==='IMG'?[root]:root.querySelectorAll('img')).forEach(im=>{
    if(im.__lkio)return;im.__lkio=1;if(im.getAttribute('decoding')!=='sync')im.decoding='sync';im.removeAttribute('loading');io.observe(im);});};
  new MutationObserver(ms=>{for(const m of ms)for(const n of m.addedNodes)if(n.nodeType===1)arm(n);}).observe(sh,{childList:true,subtree:true});
  arm(sh);
})();
'''
css.write_text(c, encoding='utf-8', newline='\n'); js.write_text(j, encoding='utf-8', newline='\n')
print('patched')
