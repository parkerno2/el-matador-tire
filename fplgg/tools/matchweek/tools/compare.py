import sys, json; sys.path.insert(0,'/home/claude/harness')
import os
os.environ['EMT_ROOT']='/home/claude/next-build/site'
import importlib, harness; importlib.reload(harness)
from harness import App
JS = """() => {
  const out={gw:D.gw,gwsDone:D.gwsDone,dl:D.dlPassed,live:!!D.liveNow};
  const cur=D.fx.filter(f=>num(f.GW)===D.gw);
  out.win=cur.map(f=>{const w=hpWin(f);return [f.Home,f.Away,w&&+w.h.toFixed(4),w&&+w.a.toFixed(4)]});
  out.xi=Object.keys(TEAMS).map(t=>[t,xiOf(t).map(p=>p.Player).join('|'),benchOf(t).map(p=>p.Player).join('|')]);
  out.proj=Object.keys(TEAMS).map(t=>[t,+teamProj(t).toFixed(3)]);
  try{const s=simulate(2000);out.sim=JSON.stringify(s).slice(0,400)}catch(e){out.sim='ERR '+e}
  try{out.luck=JSON.stringify(luckAgg()).slice(0,300)}catch(e){out.luck='ERR '+e}
  out.card=card(D.ro.find(r=>r.Player==='Palmer'),0).length;
  out.crest=crestOf('Cold Palmers',40).length;
  return out;}"""
def run(page, now=None, tabs=None):
    kw={}
    if now: kw['now']=now
    if tabs: kw['tabs']=tabs
    with App(**kw) as app:
        p=app.open(page)
        if page.startswith('next/'):
            p.wait_for_function('()=>window.__ready||window.__err',timeout=20000)
            print('err', p.evaluate('()=>window.__err||null'))
        r=p.evaluate(JS); return r, app.errors
for label,kw in [('real',{'now':'2026-10-09T23:00:00Z'}),('live',{'now':'2026-10-10T15:00:00Z','tabs':'/home/claude/harness/fix-d/tabs-live'})]:
    a,ea=run('v12.html',**kw); b,eb=run('next/probe.html',**kw)
    print(label,'prod errors',ea[:3],'next errors',eb[:3])
    for k in a:
        same = a[k]==b.get(k)
        print(' ',k,'OK' if same else 'DIFF', '' if same else (str(a[k])[:200],'||',str(b.get(k))[:200]))
