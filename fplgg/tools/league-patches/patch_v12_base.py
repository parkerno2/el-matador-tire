"""v12 base edits on index-PREVIEW.html (asserted, idempotent):
   1. GW Stats normalizer keeps the Starts column (the projection engine's minutes model needs it)."""
import sys,pathlib
p=pathlib.Path(sys.argv[1] if len(sys.argv)>1 else 'index-PREVIEW.html');s=p.read_text(encoding='utf-8')
MARK='Starts:num(r.Starts)'
if MARK in s: print('already patched'); sys.exit(0)
def rep(old,new,label):
    global s
    n=s.count(old); assert n==1,f'{label}: expected 1 match, found {n}'; s=s.replace(old,new)
rep("xG:num(r.xG),xA:num(r.xA),xGC:num(r.xGC),Final:fin(r.Final)};});",
    "xG:num(r.xG),xA:num(r.xA),xGC:num(r.xGC),Starts:num(r.Starts),Final:fin(r.Final)};});",'gws normalizer Starts')
p.write_text(s,encoding='utf-8',newline='\n'); print('patched',p)
