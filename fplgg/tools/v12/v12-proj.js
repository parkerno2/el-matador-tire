/* ===== v12 · projection engine v2: a minutes-aware house model =====
   Why: FPL's ep_this is a 30-day form average times a chance-of-playing flag. It does not know who is
   rotated, who gets hooked at 60, or who plays whom, and the app used to snap every player to his actual
   points at kickoff, so proj final nosedived the moment a match started.
   What: per player per gameweek
     start probability  = recency-weighted starts (decay .6/GW) shrunk to a draft-rank prior, lifted when a
                          manager has him in an XI (managers know team news: submitted XIs start 87% vs 76%
                          modelled, GW2-5), times FPL's availability flag
     expected minutes   = P(start) x his mins per start + P(sub) x 20
     XI factor          = x1.09 for players in an XI (picks beat the model by 8-10% on GW2-5 after the lift)
     per-90 rates       = xG, xA, bonus, cards, saves shrunk to his position's league rate (270-min prior)
     fixture            = opponent attack/defence from team xG (shrunk to FPL's strength), home 1.08
     points             = appearance + goals + assists + clean sheet (negative binomial, k=3) + goals-conceded
                          penalty + saves + defcon hit-rate + bonus rate + cards
   Backtest (GW2-5, 2,587 player-weeks, each week projected only from the weeks before it):
     MAE 1.14 vs FPL 1.32 · RMSE 2.12 vs 2.36 · rank corr .71 vs .64. Rostered players: RMSE 3.29 vs 3.74.
   Live: once his match kicks off, projection = points so far + what the remaining minutes are worth for a
   player still on the pitch (0 once subbed off, a small cameo chance if he did not start).
   Reference implementation + backtest: fplgg/model/proj.py (JS must match it, see fplgg/model/check_js.py). */
const HPP={decay:.6,priorStart:.35,priorW:.5,priorMin:270,teamK:5,home:1.08,subPrior:.3,nbK:3,q60Prior:.75,fdrSlope:.25,
  liftSub:.45,liftProj:.18,xiFactor:1.09,eMinSub:20,eMinStart:78,leagueXg:1.35};
let HPC={}; /* memo, cleared whenever the sheet is re-read */
function hpReset(){HPC={}}
function hpMemo(k,f){if(HPC.__g!==D.gwsByGw||HPC.__r!==D.ro||HPC.__c!==D.cf){HPC={__g:D.gwsByGw,__r:D.ro,__c:D.cf}}return k in HPC?HPC[k]:(HPC[k]=f())}
const hpP0=l=>Math.pow(1+l/HPP.nbK,-HPP.nbK); /* P(clean sheet) under a gamma-Poisson mix: xG is overdispersed per match */
function hpNfx(gw,club){return hpMemo('nfx|'+gw+'|'+club,()=>(D.cf||[]).filter(x=>num(x.GW)===gw&&(x.Home===club||x.Away===club)).length)}
function hpFixtures(gw,club){return (D.cf||[]).filter(x=>num(x.GW)===gw&&(x.Home===club||x.Away===club))}
function hpDrank(code){const m=hpMemo('drank',()=>{const o={};(D.plr||[]).forEach(r=>{o[String(r.Code)]=num(r['Draft rank'])||999});return o});return m[String(code)]||999}
function hpStrengthPrior(c){const s=STRENGTH[c];return s?(s[0]+s[1])/2:3}

/* team attack / defence multipliers from every finished-or-started fixture before `upto` */
function hpCtx(upto){return hpMemo('ctx|'+upto,()=>{
  const txg={};Object.keys(D.gwsByGw||{}).forEach(g=>{g=num(g);if(g>=upto)return;const m=D.gwsByGw[g];
    Object.keys(m).forEach(k=>{const r=m[k];const key=g+'|'+r.Club;txg[key]=(txg[key]||0)+r.xG})});
  const games={};
  (D.cf||[]).forEach(f=>{const g=num(f.GW);if(g>=upto)return;if(!fin(f.Finished)&&!fin(f.Started))return;
    const xh=txg[g+'|'+f.Home]||0,xa=txg[g+'|'+f.Away]||0;
    (games[f.Home]=games[f.Home]||[]).push([xh,xa]);(games[f.Away]=games[f.Away]||[]).push([xa,xh]);});
  let n=0,s=0;Object.values(games).forEach(a=>a.forEach(x=>{n++;s+=x[0]}));
  const lg=n?s/n:HPP.leagueXg;
  const att={},dfn={};
  Object.keys(games).forEach(c=>{const a=games[c],k=HPP.teamK,st=hpStrengthPrior(c);
    const pa=1+HPP.fdrSlope*(st-3),pd=1-HPP.fdrSlope*(st-3);
    att[c]=(a.reduce((t,x)=>t+x[0],0)+k*lg*pa)/(a.length+k)/lg;
    dfn[c]=(a.reduce((t,x)=>t+x[1],0)+k*lg*pd)/(a.length+k)/lg;});
  /* position priors: league rates per 90 */
  const acc={};Object.keys(D.gwsByGw||{}).forEach(g=>{g=num(g);if(g>=upto)return;const m=D.gwsByGw[g];
    Object.keys(m).forEach(k=>{const r=m[k];if(!(r.Mins>0))return;const a=acc[r.Pos]=acc[r.Pos]||{m:0,xg:0,xa:0,bon:0,yc:0,sv:0,n60:0,dc:0};
      a.m+=r.Mins;a.xg+=r.xG;a.xa+=r.xA;a.bon+=r.Bonus;a.yc+=r.YC;a.sv+=r.Saves;if(r.Mins>=60){a.n60++;if(r.DefCon>=DCTH[r.Pos])a.dc++;}})});
  const pri={};Object.keys(acc).forEach(p=>{const a=acc[p],m=a.m/90||1;pri[p]={xg:a.xg/m,xa:a.xa/m,bon:a.bon/m,yc:a.yc/m,sv:a.sv/m,dc:a.dc/Math.max(1,a.n60)}});
  return {att,dfn,lg,pri};});}

/* availability for gameweek gw from FPL's status/news (injury flags are games missed, not season-long haircuts) */
const HP_MON={jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};
function hpBackDate(news){const m=/(?:back|until)\s+(\d{1,2})\s+([A-Za-z]{3})/i.exec(String(news||''));if(!m)return null;
  const mo=HP_MON[m[2].toLowerCase()];if(mo===undefined)return null;const now=new Date();let y=now.getFullYear();
  let d=new Date(Date.UTC(y,mo,+m[1]));if(d.getTime()<now.getTime()-180*864e5)d=new Date(Date.UTC(y+1,mo,+m[1]));return d}
function hpAvail(p,gw){
  const st=String(p.Status||'a'),news=String(p.News||'');
  if(st==='a')return 1;
  if(st==='u'||st==='n')return 0;                                   /* left the club / not eligible */
  const back=hpBackDate(news),dl=gwDeadline(gw);
  if(back&&dl)return back.getTime()<=dl.getTime()+36e5*36?1:0;      /* a return date settles it */
  if(gw>D.gw)return 1;                                              /* no date: out this week only */
  if(st==='d'){const m=/(\d+)\s*%/.exec(news);return m?num(m[1])/100:.5}
  return 0;
}
/* does a manager have him in an XI? submitted (FPL picks) → strong lift; carried-forward guess → weak lift */
function hpSel(p,gw){
  if(!p.Team||!TEAMS[p.Team])return 0;
  if(gw>D.gw){const xi=hpMemo('xi|'+p.Team,()=>{const s={};xiOf(p.Team).forEach(x=>{s[String(x.Code)]=1});return s});return xi[String(p.Code)]?HPP.liftSub:0;}
  if(gw!==D.gw)return 0;
  if(typeof lineupsLocked==='function'&&lineupsLocked())return p['GW XI']==='XI'?HPP.liftSub:0;
  const was=hpMemo('was|'+D.gwsDone,()=>{const s={};(D.gl||[]).forEach(r=>{if(num(r.GW)===D.gwsDone&&r.Started==='XI')s[String(r.Code)+'|'+r.Team]=1});return s});
  return was[String(p.Code)+'|'+p.Team]?HPP.liftProj:0;
}
/* history summary for one player before `upto` (only gameweeks his current club played) */
function hpHist(code,club,upto){return hpMemo('h|'+code+'|'+club+'|'+upto,()=>{
  let wSum=0,ws=0,wSubN=0,wSub=0,mst=0,mstW=0,q=0,qW=0,M=0,xg=0,xa=0,bon=0,yc=0,sv=0,n60=0,dc=0;
  Object.keys(D.gwsByGw||{}).map(Number).filter(g=>g<upto).sort((a,b)=>a-b).forEach(g=>{
    const r=(D.gwsByGw[g]||{})[String(code)];if(!r)return;
    M+=r.Mins;xg+=r.xG;xa+=r.xA;bon+=r.Bonus;yc+=r.YC;sv+=r.Saves;
    if(r.Mins>=60){n60++;if(r.DefCon>=DCTH[r.Pos])dc++;}
    const nfx=hpNfx(g,club);if(!nfx)return;
    const w=Math.pow(HPP.decay,upto-1-g),starts=r.Starts||0;
    wSum+=w;ws+=w*Math.min(1,starts/nfx);
    if(starts>0){const m=r.Mins/starts;mst+=w*m;mstW+=w;q+=w*(m>=60?1:0);qW+=w;}
    else{wSubN+=w;wSub+=w*(r.Mins>0?1:0);}
  });
  return {wSum,ws,wSubN,wSub,mst,mstW,q,qW,M,xg,xa,bon,yc,sv,n60,dc};});}

/* the projection for one player in one gameweek → {pts, parts, pStart, eMin, avail, rates} */
function hpPlayer(p,gw,opt){
  opt=opt||{};gw=gw||D.gw;const code=String(p.Code),club=p.Club,pos=p.Pos;
  const key='p|'+code+'|'+club+'|'+gw+'|'+(opt.noSel?0:1);
  return hpMemo(key,()=>{
  const fx=hpFixtures(gw,club);const out={pts:0,parts:{app:0,goals:0,assists:0,cs:0,gc:0,saves:0,defcon:0,bonus:0,cards:0},pStart:0,eMin:0,avail:1,nfx:fx.length};
  if(!fx.length||!GOALPTS[pos])return out;
  const C=hpCtx(Math.min(gw,D.gw)),h=hpHist(code,club,Math.min(gw,D.gw));
  const rk=hpDrank(code),ps0=rk<=150?.6:rk<=300?.43:.2,pw=HPP.priorW;
  let pS=(h.ws+pw*ps0)/(h.wSum+pw);
  const lift=opt.noSel?0:hpSel(p,gw);pS=pS+(1-pS)*lift;
  const eSt=(h.mst+HPP.eMinStart)/(h.mstW+1);
  const q60=(h.q+pw*HPP.q60Prior)/(h.qW+pw);
  const pSub=(h.wSub+HPP.subPrior)/(h.wSubN+1);
  const pp=C.pri[pos]||C.pri.MID||{xg:.1,xa:.08,bon:.1,yc:.1,sv:0,dc:.1},pm=HPP.priorMin,den=(h.M+pm)/90;
  const r={xg:(h.xg+pp.xg*pm/90)/den,xa:(h.xa+pp.xa*pm/90)/den,bon:(h.bon+pp.bon*pm/90)/den,yc:(h.yc+pp.yc*pm/90)/den,
    sv:pos==='GKP'?(h.sv+pp.sv*pm/90)/den:0,dc:pos==='GKP'?0:(h.dc+2*pp.dc)/(h.n60+2)};
  const av=hpAvail(p,gw);out.avail=av;
  fx.forEach(f=>{
    const home=f.Home===club,opp=home?f.Away:f.Home,ha=home?HPP.home:1/HPP.home;
    const aF=(C.dfn[opp]||1)*ha;
    const cLam=C.lg*(C.dfn[club]||1)*(C.att[opp]||1)/ha;
    const ps=pS*av,psub=(1-pS)*av*pSub;
    const emin=ps*eSt+psub*HPP.eMinSub;
    const frac=Math.min(1,eSt/90),lam=cLam*frac;
    const P=out.parts;
    P.app+=ps*(1+q60)+psub;
    P.goals+=r.xg*aF*emin/90*GOALPTS[pos];
    P.assists+=r.xa*aF*emin/90*3;
    P.cs+=ps*q60*hpP0(lam)*CSPTS[pos];
    if(pos==='GKP'||pos==='DEF')P.gc-=ps*gcPen(lam);
    if(pos==='GKP')P.saves+=ps*r.sv*frac/3;
    P.defcon+=2*r.dc*ps*q60;
    P.bonus+=r.bon*emin/90;
    P.cards-=r.yc*emin/90;
    out.eMin+=emin;out.pStart=ps;
  });
  /* managers' picks outscore the raw numbers: XIs beat the model by 8-10% on GW2-5 even after the start lift
     (they pick form, not just minutes). Selected players carry that factor so the bubbles add up to the team line. */
  if(lift>0)Object.keys(out.parts).forEach(k=>{out.parts[k]*=HPP.xiFactor});
  out.sel=lift>0;
  out.pts=Object.values(out.parts).reduce((a,b)=>a+b,0);
  out.r=r;out.eSt=eSt;out.q60=q60;out.pSub=pSub;out.pS=pS;
  return out;});
}
/* live: points so far + what's left, fixture by fixture */
function hpLive(p){
  const code=String(p.Code),club=p.Club,pos=p.Pos;
  const fx=hpFixtures(D.gw,club);const pre=hpPlayer(p,D.gw);
  const row=(D.gwsCur||{})[code]||{};
  const pb=(D.pbonus||{})[code]||0;
  const so=num(p['GW pts'])+pb;
  if(!fx.length)return {pts:so,rem:0,state:'blank'};
  if(fx.every(f=>fin(f.Finished)))return {pts:so,rem:0,state:'done'};
  const C=hpCtx(D.gw),mins=num(row.Mins!==undefined?row.Mins:p['GW mins']),starts=num(row.Starts);
  let rem=0,state='pre';
  fx.forEach(f=>{
    if(fin(f.Finished))return;
    if(!fin(f.Started)){rem+=pre.pts/Math.max(1,fx.length);return;}   /* second leg of a double not started yet */
    const m=Math.min(90,Math.max(0,num(f.Mins))),left=Math.max(0,90-m)/90;
    const home=f.Home===club,opp=home?f.Away:f.Home,ha=home?HPP.home:1/HPP.home;
    const aF=(C.dfn[opp]||1)*ha,cLam=C.lg*(C.dfn[club]||1)*(C.att[opp]||1)/ha;
    const conc=num(home?f['Away goals']:f['Home goals']);
    const R=pre.r||{xg:0,xa:0,bon:0,yc:0,sv:0,dc:0};
    if(mins<=0){
      if(m<3){rem+=pre.pts/Math.max(1,fx.length);state='pre';return;}  /* kickoff flagged but no minutes logged yet */
      /* did not start: a cameo is still possible */
      const pc=(pre.pSub||.3)*(pre.avail===undefined?1:pre.avail)*left*.8,cm=Math.min(25,(90-m)*.5);
      rem+=pc*(1+(R.xg*aF*GOALPTS[pos]+R.xa*aF*3+R.bon)*cm/90);state='bench';return;}
    const on=starts>0?mins>=m-2:true;               /* a starter whose minutes stopped is off; a sub who came on stays on */
    if(!on){state='off';return;}
    state='live';
    const eSt=pre.eSt||80,rm=starts>0?Math.max(0,90-m)*Math.max(.5,Math.min(1,eSt/90)):Math.max(0,90-m);
    const w=rm/90;
    let g=R.xg*aF*w*GOALPTS[pos]+R.xa*aF*w*3+R.bon*w-R.yc*w;
    if(pos==='GKP')g+=R.sv*w/3;
    if(pos!=='GKP'&&num(row.DefCon)<DCTH[pos])g+=2*R.dc*Math.min(1,w*1.4)*Math.min(1,num(row.DefCon)/DCTH[pos]+.3);
    if(mins<60)g+=(mins+rm>=60?.9:.25);             /* the second appearance point */
    const lamR=cLam*w;
    if(CSPTS[pos]){
      if(conc===0){
        if(mins>=60)g-=CSPTS[pos]*(1-hpP0(lamR));   /* CS already in his total: expected loss */
        else g+=CSPTS[pos]*(mins+rm>=60?.9:.25)*hpP0(lamR);}
    }
    if(pos==='GKP'||pos==='DEF'){                    /* extra -1 per two more conceded */
      let e=0;for(let k=1;k<8;k++){const pk=Math.exp(-lamR)*Math.pow(lamR,k)/hpFact(k);e+=pk*(Math.floor((conc+k)/2)-Math.floor(conc/2));}
      g-=e;}
    rem+=g;
  });
  return {pts:so+rem,rem,state};
}
function hpFact(k){let f=1;for(let i=2;i<=k;i++)f*=i;return f}
function hpSd(mu){return mu<=0?0:Math.min(3.8,1.41+.49*mu)*Math.min(1,mu/.6)} /* per-player spread vs projection, GW2-5 */

/* ---- wire it in: every PROJ in the app now reads the house model ---- */
const __epOfFpl=epOf;
function fplEpOf(code){return __epOfFpl(code)}
epOf=function(code){
  if(!D||!D.gwsByGw)return __epOfFpl(code);
  const p=(D.ro||[]).find(r=>String(r.Code)===String(code))||(D.plr||[]).find(r=>String(r.Code)===String(code));
  if(!p)return __epOfFpl(code);
  return Math.round(hpPlayer(p,D.gw).pts*10)/10;
};
projOf=function(p){ /* one player's contribution to proj final */
  if(!fxStarted(p.Club)){const e=epOf(p.Code);return e===null?0:e}
  return hpLive(p).pts;
};
/* team projection for any gameweek: this week = the live-aware effective XI, later weeks = today's XI */
function hpTeam(team,gw){gw=gw||D.gw;
  if(gw===D.gw)return teamProj(team);
  return xiOf(team).reduce((s,p)=>s+hpPlayer(p,gw).pts,0);}
function hpTeamSd(team,gw){gw=gw||D.gw;const xi=gw===D.gw?effXiOf(team,true):xiOf(team);
  let v=0;xi.forEach(p=>{let mu,left=1;
    if(gw===D.gw&&fxStarted(p.Club)){const L=hpLive(p);mu=Math.max(0,L.rem);left=L.state==='done'||L.state==='off'?0:1;}
    else mu=hpPlayer(p,gw).pts;
    const s=hpSd(mu)*left;v+=s*s;});
  return Math.sqrt(v)*1.2;} /* same-club stacking: observed team spread runs ~20% above independent players */
/* win / draw / loss for a matchup (normal approximation on integer scores) */
function hpNorm(z){const t=1/(1+.2316419*Math.abs(z)),d=.3989423*Math.exp(-z*z/2);let p=d*t*(.3193815+t*(-.3565638+t*(1.781478+t*(-1.821256+t*1.330274))));return z>0?1-p:p}
function hpWin(f){
  const gw=num(f.GW),s=mscore(f);
  if(s.done)return {h:s.hs>s.as2?1:0,d:s.hs===s.as2?1:0,a:s.as2>s.hs?1:0,muH:s.hs,muA:s.as2,sd:0,done:1};
  const muH=hpTeam(f.Home,gw),muA=hpTeam(f.Away,gw);
  const sd=Math.sqrt(Math.pow(hpTeamSd(f.Home,gw),2)+Math.pow(hpTeamSd(f.Away,gw),2))||1;
  const diff=muH-muA,pd=Math.max(0,hpNorm((.5-diff)/sd)-hpNorm((-.5-diff)/sd));
  const ph=1-hpNorm((.5-diff)/sd),pa=hpNorm((-.5-diff)/sd);
  return {h:ph,d:pd,a:pa,muH,muA,sd};
}

/* ---- title / relegation odds: simulate every remaining gameweek from the actual rosters and schedule ---- */
simulate=function(){
  const names=Object.keys(TEAMS);
  const pts={},pf={};names.forEach(n=>{pts[n]=0;pf[n]=0});
  const remain=[];
  D.fx.forEach(f=>{
    if(fin(f.Finished)){const hp=num(f['Home pts']),ap=num(f['Away pts']);pf[f.Home]+=hp;pf[f.Away]+=ap;
      if(hp>ap)pts[f.Home]+=3;else if(ap>hp)pts[f.Away]+=3;else{pts[f.Home]++;pts[f.Away]++;}}
    else remain.push(f);});
  /* each team's weekly mean = its XI's projection for that gameweek's fixtures, shrunk 30% toward its
     season scoring rate (squads change, form regresses); weekly spread from the per-player model */
  const obs={};names.forEach(n=>{const a=[];D.fx.forEach(f=>{if(!fin(f.Finished))return;if(f.Home===n)a.push(num(f['Home pts']));if(f.Away===n)a.push(num(f['Away pts']));});obs[n]=a;});
  const lgAvg=(()=>{const a=[].concat(...Object.values(obs));return a.length?a.reduce((x,y)=>x+y,0)/a.length:40})();
  const M={};
  remain.forEach(f=>{const g=num(f.GW);[f.Home,f.Away].forEach(t=>{const k=t+'|'+g;if(M[k]||!TEAMS[t])return;
    const proj=g===D.gw?teamProj(t):hpTeam(t,g);const o=obs[t]||[],om=o.length?o.reduce((x,y)=>x+y,0)/o.length:lgAvg;
    const w=o.length/(o.length+6);
    const mean=.7*proj+.3*(w*om+(1-w)*lgAvg);
    M[k]={mean,sd:Math.max(9,hpTeamSd(t,g))};});});
  const N=5000,title={},last={};names.forEach(n=>{title[n]=0;last[n]=0});
  for(let s=0;s<N;s++){
    const p={...pts},q={...pf};
    for(const f of remain){const h=f.Home,a=f.Away,mh=M[h+'|'+num(f.GW)],ma=M[a+'|'+num(f.GW)];if(!mh||!ma)continue;
      const hs=Math.max(0,Math.round(mh.mean+mh.sd*gauss())),as_=Math.max(0,Math.round(ma.mean+ma.sd*gauss()));
      q[h]+=hs;q[a]+=as_;if(hs>as_)p[h]+=3;else if(as_>hs)p[a]+=3;else{p[h]++;p[a]++;}}
    const order=names.slice().sort((x,y)=>(p[y]-p[x])||(q[y]-q[x]));
    title[order[0]]++;last[order[order.length-1]]++;
  }
  names.forEach(n=>{title[n]/=N/100;last[n]/=N/100});
  return {title,last};
};

/* recompute on every data load */
const __laHp=loadAll;loadAll=function(q){hpReset();return __laHp(q).then(r=>{hpReset();return r})};
hpReset();
