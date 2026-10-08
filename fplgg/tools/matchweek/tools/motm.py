import sys, json, os; sys.path.insert(0,'/home/claude/harness')
os.environ['EMT_ROOT']='/home/claude/next-build/site'
from harness import App
JS="""() => {
 const per=PERIODS.find(p=>D.gw>=p[1]&&D.gw<=p[2]);const [name,a,b]=per;
 const out={name,a,b,gw:D.gw,teams:[]};
 Object.keys(TEAMS).forEach(t=>{let banked=0,mu=0,v=0;
   for(let g=a;g<=b;g++){
     const f=D.fx.find(x=>num(x.GW)===g&&(x.Home===t||x.Away===t));
     if(f&&fin(f.Finished)){banked+=num(f.Home===t?f['Home pts']:f['Away pts']);continue}
     const m=hpTeam(t,g),s=hpTeamSd(t,g);mu+=m;v+=s*s;}
   out.teams.push({t,banked,mu,sd:Math.sqrt(v)});});
 // monte carlo
 const N=20000,wins={};out.teams.forEach(x=>wins[x.t]=0);
 let seed=7;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647};
 const g=()=>{let u=0,v=0;while(!u)u=rnd();while(!v)v=rnd();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)};
 for(let i=0;i<N;i++){let best=null,bv=-1e9;out.teams.forEach(x=>{const s=x.banked+x.mu+x.sd*g();if(s>bv){bv=s;best=x.t}});wins[best]++}
 out.teams.forEach(x=>{x.win=wins[x.t]/N;x.proj=x.banked+x.mu});
 out.teams.sort((p,q)=>q.proj-p.proj);
 out.per=PERIODS;
 return out;}"""
with App(now='2026-10-09T23:00:00Z') as app:
    p=app.open('next/probe.html',wait_ready=False); p.wait_for_function('()=>window.__ready',timeout=20000)
    r=p.evaluate(JS)
for x in r['teams']: print(f"{x['t']:22s} banked {x['banked']:4.0f} proj {x['proj']:6.1f} sd {x['sd']:5.1f} win {x['win']*100:5.1f}%")
print(r['name'],r['a'],r['b'])
