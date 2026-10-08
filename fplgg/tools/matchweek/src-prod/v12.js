
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
function hpStrengthPrior(c){const s=strengthOf(c);return s?(s[0]+s[1])/2:3}

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
/* FPL's own forecast for this gameweek; null when the Predictions block standing in is another gameweek's (BUGS #6) */
function fplEpOf(code){return D.predGw!==undefined&&D.predGw!==D.gw?null:__epOfFpl(code)}
epOf=function(code){
  if(!D||!D.gwsByGw)return fplEpOf(code);
  const p=(D.ro||[]).find(r=>String(r.Code)===String(code))||(D.plr||[]).find(r=>String(r.Code)===String(code));
  if(!p)return fplEpOf(code);
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
/* this gameweek's projection split into points already banked (certain) and the projection still to come;
   banked + rem = teamProj(team), pre = the same XI's projection before anyone kicked off */
function hpLiveSplit(team){let banked=0,rem=0,pre=0,started=0;
  effXiOf(team,true).forEach(p=>{const e=epOf(p.Code)||0;pre+=e;
    if(fxStarted(p.Club)){const L=hpLive(p);banked+=L.pts-L.rem;rem+=L.rem;started++;}
    else rem+=e;});
  return {banked,rem,pre,started};}
/* the table so far + each team's score distribution for every remaining fixture */
function hpSimModel(){
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
    const o=obs[t]||[],om=o.length?o.reduce((x,y)=>x+y,0)/o.length:lgAvg;
    const w=o.length/(o.length+6),rate=w*om+(1-w)*lgAvg;
    if(g===D.gw){
      /* the live gameweek (#24): points already scored are certain, so they enter at full weight; only the projection
         still to come is shrunk, toward the share of a week's scoring rate it stands for. Before kickoff this is the
         formula below exactly; once every match is over the mean is the banked score. hpTeamSd already counts only
         what is left, and the 9-point floor shrinks with it so it cannot re-open a decided week. */
      const S=hpLiveSplit(t),left=S.pre>0?Math.max(0,Math.min(1,S.rem/S.pre)):(S.started?0:1);
      M[k]={mean:S.banked+.7*S.rem+.3*rate*left,sd:Math.max(9*left,hpTeamSd(t,g)),banked:S.banked,rem:S.rem,left};
    }else M[k]={mean:.7*hpTeam(t,g)+.3*rate,sd:Math.max(9,hpTeamSd(t,g))};});});
  return {names,pts,pf,remain,M};
}
/* seeded draw (TP-14): the same sheet data always gives the same odds instead of jittering 1-2 points per reload.
   Seed = FNV-1a of the gameweek and every H2H fixture's scores and state; mulberry32 stream; Box-Muller normals. */
function hpSeed(){const s=D.gw+'#'+(D.fx||[]).map(f=>[num(f.GW),f.Home,f.Away,num(f['Home pts']),num(f['Away pts']),fin(f.Finished)?1:0].join('|')).join(';');
  let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
function hpRng(seed){let a=seed>>>0;return ()=>{a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return ((t^(t>>>14))>>>0)/4294967296;};}
function hpGauss(r){let u=0,v=0;while(!u)u=r();while(!v)v=r();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);}
simulate=function(){
  const {names,pts,pf,remain,M}=hpSimModel(),rnd=hpRng(hpSeed());
  const N=5000,title={},last={};names.forEach(n=>{title[n]=0;last[n]=0});
  for(let s=0;s<N;s++){
    const p={...pts},q={...pf};
    for(const f of remain){const h=f.Home,a=f.Away,mh=M[h+'|'+num(f.GW)],ma=M[a+'|'+num(f.GW)];if(!mh||!ma)continue;
      const hs=Math.max(0,Math.round(mh.mean+mh.sd*hpGauss(rnd))),as_=Math.max(0,Math.round(ma.mean+ma.sd*hpGauss(rnd)));
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

/* ===== v12 · matchup page: records on the stage, the matchup numbers, a one-line score-bug label =====
   Wraps renderMatch after both v10 wrappers (tale of the tape, form, pitch re-deal, projected-lineups note).
   Every number here comes from the sheet through the v12 engine (hpWin, hpPlayer, hpLive) or the standings:
     record      = W-D-L and position from D.st, sorted exactly like the Table (league pts, then points for);
                   D.st already carries the provisional GW once D.provOver (the base folds it in on load)
     chance to win = hpWin(f) h / d / a, shown to 100 by largest remainder; hidden once the match is final
     points left = teamProj(team) − points already banked by the effective XI (so score + left = proj final);
                   "to play" = effective-XI players whose hpLive state is still 'pre' (DGW-safe)
     minutes risk = effective-XI starters with hpPlayer pStart < .7 or avail < 1; after the deadline only
                   players whose match has not kicked off (the rest are settled)
     who plays whom = this GW's Premier League games holding starters from both effective XIs
                   (same counting as v10-graphic mxOverlap; finished games drop out once the GW is live) */
const MPX_RISK=.7;
function mpxTable(){return D.st.slice().sort((a,b)=>num(b['League Pts'])-num(a['League Pts'])||num(b['Pts For'])-num(a['Pts For']))}
function mpxRecord(team){
  const st=mpxTable(),i=st.findIndex(s=>s.Team===team);if(i<0)return null;
  const r=st[i];return {w:num(r.W),d:num(r.D),l:num(r.L),pos:i+1,played:num(r.W)+num(r.D)+num(r.L)};
}
function mpxRecHTML(team){
  const r=mpxRecord(team);if(!r||!r.played)return '';
  return '<span class="mpxrec">'+r.w+'-'+r.d+'-'+r.l+' <i>·</i> <em>'+ORD(r.pos)+'</em></span>';
}
/* percentages that add to exactly 100 */
function mpxPct(ps){
  const raw=ps.map(x=>Math.max(0,x)*100),fl=raw.map(Math.floor);let left=100-fl.reduce((s,x)=>s+x,0);
  raw.map((x,i)=>[x-fl[i],i]).sort((a,b)=>b[0]-a[0]).forEach(([,i])=>{if(left>0){fl[i]++;left--;}});
  return fl;
}
/* the one rounding of hpWin for every screen (Matchday list, matchup page, team page, schedule): h + d + a = 100 */
function mpxWinPct(w){const p=mpxPct([w.h,w.d,w.a]);return {h:p[0],d:p[1],a:p[2]}}
function mpxBanked(p){return num(p['GW pts'])+((D.pbonus||{})[String(p.Code)]||0)}
function mpxLeft(team){
  const xi=effXiOf(team,true);let so=0,n=0;
  xi.forEach(p=>{so+=mpxBanked(p);if(hpLive(p).state==='pre')n++;});
  return {left:teamProj(team)-so,n,so};
}
function mpxRisk(team){
  return effXiOf(team,true).filter(p=>{
    if(!hpFixtures(D.gw,p.Club).length)return false;
    if(D.dlPassed&&hpLive(p).state!=='pre')return false;
    const h=hpPlayer(p,D.gw);return h.pStart<MPX_RISK||h.avail<1;
  }).map(p=>{const h=hpPlayer(p,D.gw);return {p,ps:h.pStart,av:h.avail,pts:h.pts}})
    .sort((a,b)=>a.ps-b.ps||a.av-b.av||b.pts-a.pts);
}
function mpxClash(f){
  const hx=effXiOf(f.Home,true),ax=effXiOf(f.Away,true);
  const val=p=>fxStarted(p.Club)?hpLive(p).pts:hpPlayer(p,D.gw).pts;
  const ko=x=>{const d=dt(x['Kickoff (UTC)']);return d?d.getTime():0};
  return (D.cf||[]).filter(x=>num(x.GW)===D.gw&&!(D.dlPassed&&fin(x.Finished))).map(x=>{
    const inx=p=>p.Club===x.Home||p.Club===x.Away;
    return {x,h:hx.filter(inx).sort((a,b)=>val(b)-val(a)),a:ax.filter(inx).sort((a,b)=>val(b)-val(a))};
  }).filter(o=>o.h.length&&o.a.length).sort((a,b)=>(b.h.length+b.a.length)-(a.h.length+a.a.length)||ko(a.x)-ko(b.x)).slice(0,3);
}
/* everything the block shows, as plain data (the verification printout reads this too) */
function mpxData(f){
  const s=mscore(f),final=s.done||D.provOver,live=D.dlPassed&&!final;
  const out={final,live};
  if(!final){const w=hpWin(f);if(!w.done){const pc=mpxWinPct(w);out.win={h:pc.h,d:pc.d,a:pc.a,raw:w};}}
  if(live){const L=[mpxLeft(f.Home),mpxLeft(f.Away)];if(L.some(x=>x.n>0||Math.abs(x.left)>=.05))out.left=L;}
  if(!final){const R=[mpxRisk(f.Home),mpxRisk(f.Away)];if(R[0].length||R[1].length)out.risk=R;}
  if(!final){const C=mpxClash(f);if(C.length)out.clash=C;}
  return out;
}
/* up to two names per side, one when two would not fit the column (about 19 characters with the +N at 390px, 13 on a
   320px phone); the names ellipsize on their own so the +N count always stays visible */
function mpxNames(list,narrow){
  if(!list.length)return '';
  const n=list.map(p=>String(p.Player||''));
  const lim=narrow?13:19;
  const two=n.length>1&&(n[0]+', '+n[1]+(n.length>2?' +'+(n.length-2):'')).length<=lim;
  const k=two?2:1;
  return '<em>'+esc(n.slice(0,k).join(', '))+'</em>'+(n.length>k?' <i>+'+(n.length-k)+'</i>':'');
}
function mpxBlock(f){
  const D2=mpxData(f);
  const H=(TEAMS[f.Home]||{}).col||'#5B1A66',A=(TEAMS[f.Away]||{}).col||'#5B1A66';
  const rows=[];
  if(D2.win){const w=D2.win,hi=w.h>w.a?'h':w.a>w.h?'a':'';
    rows.push('<div class="mpxr mpxwin"><b class="'+(hi==='h'?'hi':'')+'">'+w.h+'%</b>'
     +'<div class="mpxm"><em>Chance to win<span> · draw '+w.d+'%</span></em><div class="mpxbar">'
     +'<i style="flex:'+w.h+';background:'+H+'"></i>'+(w.d?'<i class="d" style="flex:'+w.d+'"></i>':'')+'<i style="flex:'+w.a+';background:'+A+'"></i></div></div>'
     +'<b class="'+(hi==='a'?'hi':'')+'">'+w.a+'%</b></div>');}
  if(D2.left){const c=(x,r)=>'<span class="'+(r?'r':'')+'"><b>'+fmt1(Math.max(0,x.left))+'</b> pts <i>·</i> '+(x.n?x.n+' to play':'all played')+'</span>';
    rows.push('<div class="mpxr mpxlft"><em>Points left</em><div class="mpxg2">'+c(D2.left[0],false)+c(D2.left[1],true)+'</div></div>');}
  if(D2.risk){const side=(L,r)=>{
      if(!L.length)return '<div class="mpxl'+(r?' r':'')+'"><span class="no">None</span></div>';
      /* more than three: two show, the rest sit hidden behind a "+N more" button (tap to reveal) */
      const fold=L.length>3;
      return '<div class="mpxl'+(r?' r':'')+'">'+L.map((o,i)=>'<span'+(fold&&i>=2?' class="mpxx"':'')+'>'+esc(o.p.Player)+' <b>'+Math.round(o.ps*100)+'%</b></span>').join('')
       +(fold?'<button type="button" class="no mpxmore" aria-expanded="false">+'+(L.length-2)+' more</button>':'')+'</div>';};
    rows.push('<div class="mpxr mpxrisk"><em>Minutes risk · chance to start</em><div class="mpxg2">'+side(D2.risk[0],false)+side(D2.risk[1],true)+'</div></div>');}
  if(D2.clash){
    /* matchMedia, not innerWidth: innerWidth forces a layout of the page just rebuilt (43 ms on a laptop per matchup) */
    const narrow=typeof matchMedia==='function'&&matchMedia('(max-width:360px)').matches;
    rows.push('<div class="mpxr mpxcl"><em>Who plays whom</em>'+D2.clash.map(o=>{
      const x=o.x,inPlay=fin(x.Started)&&!fin(x.Finished);
      return '<div class="mpxg3"><span class="l">'+mpxNames(o.h,narrow)+'</span><b>'+esc(x.Home)+' <i>v</i> '+esc(x.Away)
       +(inPlay?'<u>'+Math.round(num(x.Mins))+'\'</u>':'')+'</b><span class="r">'+mpxNames(o.a,narrow)+'</span></div>';}).join('')+'</div>');}
  return rows.length?'<div class="mpxnum">'+rows.join('')+'</div>':'';
}
function mpxStage(f){
  const st=document.querySelector('#gwbody .stage');if(!st)return;
  /* records under each manager's name */
  const sides=st.querySelectorAll('.vs .side');
  [f.Home,f.Away].forEach((t,k)=>{const sd=sides[k];if(!sd||sd.querySelector('.mpxrec'))return;
    const m=sd.querySelector('.mgr'),h=mpxRecHTML(t);if(m&&h)m.insertAdjacentHTML('afterend',h);});
  /* the matchup numbers replace the two-bar tale of the tape */
  const blk=mpxBlock(f),tape=st.querySelector(':scope > .tape');
  if(tape){if(blk)tape.insertAdjacentHTML('afterend',blk);tape.remove();}
  else if(blk&&!st.querySelector('.mpxnum')){const a=st.querySelector(':scope > .series')||st.querySelector(':scope > .scsub');if(a)a.insertAdjacentHTML('afterend',blk);}
  /* "+N more" under Minutes risk reveals the rest of that side */
  const num_=st.querySelector('.mpxnum');
  if(num_)num_.addEventListener('click',e=>{const b=e.target.closest('.mpxmore');if(!b)return;e.stopPropagation();
    const l=b.closest('.mpxl');if(l)l.classList.add('mpxopen');b.remove();});
}
const __mpxRM=renderMatch;
renderMatch=function(f,dl){
  __mpxRM(f,dl);
  try{mpxStage(f)}catch(e){console.warn('mpx matchup numbers',e)}
};

/* ---- score bug: the live label fits one line at 390px ("Proj 37–38.7"), same for xP at full time ---- */
function mpxBugLab(f){
  const s=mscore(f);
  if(s.done||D.provOver)return D.hasXP?'xP '+fmt1(teamXP(f.Home))+'–'+fmt1(teamXP(f.Away)):null;
  if(s.liveNow)return D.hasEP?'Proj '+fmt1(teamProj(f.Home))+'–'+fmt1(teamProj(f.Away)):null;
  return null;
}
const __mpxBug=bugHTML;
bugHTML=function(f,i,o){
  const h=__mpxBug(f,i,o),lab=mpxBugLab(f);
  if(lab===null)return h;
  return h.replace(/<span class="lab( live)?">[^<]*<\/span>/,(m,lv)=>'<span class="lab'+(lv||'')+' mpxlab">'+esc(lab)+'</span>');
};

/* ===== v12 · stats: "Season numbers" on every team page + the engine's projection and form on the player sheet =====
   Team (My team AND every manager's profile sheet, one component): squadHealth() now returns "Season numbers",
   eight group-chat stats computed from the sheet. Lenses:
     all-play      = the luck index's lens exactly (a gameweek counts once all four matchups are final or live,
                     scored by mscore), so its W-D-L always agrees with the Lab's "beats X of Y"
     everything else = finished gameweeks only (H2H Fixtures Finished, GW Log rows of those gameweeks)
   Tiles: THIS GW (engine teamProj: "Projected" before the deadline, "Proj final" live) · BEST GW · POINTS FOR,
   the same three on My team and on the profile sheet; the sheet header gains position + record like My team.
   Player sheet: the pre-match FPL grid + "Projected gameweek" block are replaced by hpPlayer (start chance,
   expected minutes, itemized parts that add up to the PROJ shown); once his match starts, hpLive. Then a
   "Form and value" row from his GW Stats (per start, xG/xA per 90 as the model rates them, 6+ hit rate,
   floor and ceiling). Free agents get the same from their Players row. */

/* ---------- shared helpers ---------- */
let TSXC={};
function tsxMemo(k,f){
  if(TSXC.__fx!==D.fx||TSXC.__gl!==D.gl||TSXC.__ro!==D.ro||TSXC.__cf!==D.cf||TSXC.__gc!==D.gwsCur||TSXC.__pl!==D.plr||TSXC.__gw!==D.gw)
    TSXC={__fx:D.fx,__gl:D.gl,__ro:D.ro,__cf:D.cf,__gc:D.gwsCur,__pl:D.plr,__gw:D.gw};
  return k in TSXC?TSXC[k]:(TSXC[k]=f());
}
const tsxSgn=(v,d)=>{const r=Math.round(v*Math.pow(10,d||0))/Math.pow(10,d||0);return r>0?'+'+r.toFixed(d||0):r<0?'−'+Math.abs(r).toFixed(d||0):(0).toFixed(d||0)};
const tsxRec=o=>o.w+'–'+o.d+'–'+o.l;
const TSX_POS=[['GKP','GKP','goalkeeper'],['DEF','DEF','defence'],['MID','MID','midfield'],['FWD','FWD','attack']];
/* gameweeks whose four H2H matchups are all final */
function tsxFinGws(){return tsxMemo('fin',()=>{const by={};(D.fx||[]).forEach(f=>{const g=num(f.GW);(by[g]=by[g]||[]).push(f)});
  return Object.keys(by).map(Number).filter(g=>by[g].length>=4&&by[g].every(f=>fin(f.Finished))).sort((a,b)=>a-b);})}
/* rank 1 = highest value; ties share the better rank */
function tsxRank(map,t,asc){const v=map[t];return 1+Object.keys(map).filter(o=>asc?map[o]<v:map[o]>v).length}
function tsxLeagueOrd(n,of){return n===1?'Most in the league':n===of?'Fewest in the league':ORD(n)+' most in the league'}

/* ---------- the whole league's season numbers, once per data load ---------- */
function tsxCalc(){return tsxMemo('calc',()=>{
  const T=Object.keys(TEAMS),fgs=tsxFinGws(),fset=new Set(fgs);
  const out={};T.forEach(t=>out[t]={});
  /* 1 · all-play: the luck index lens (schedLuck), W/D/L kept separate */
  const byGw={};(D.fx||[]).forEach(f=>{const g=num(f.GW);(byGw[g]=byGw[g]||[]).push(f)});
  const ap={};T.forEach(t=>ap[t]={w:0,d:0,l:0,pf:0});let apLast=0,apLive=0;
  Object.keys(byGw).map(Number).sort((a,b)=>a-b).forEach(g=>{
    const fs=byGw[g];if(fs.length<4||g>D.gw)return;
    const sc={};let ready=true,live=false;
    fs.forEach(f=>{const s=mscore(f);if(!(s.done||s.liveNow)){ready=false;return}if(!s.done)live=true;sc[f.Home]=s.hs;sc[f.Away]=s.as2;});
    if(!ready||Object.keys(sc).length<8)return;
    apLast=g;if(live)apLive=g;
    Object.keys(sc).forEach(t=>{if(!ap[t])return;ap[t].pf+=sc[t];
      Object.keys(sc).forEach(o=>{if(o===t)return;if(sc[t]>sc[o])ap[t].w++;else if(sc[t]===sc[o])ap[t].d++;else ap[t].l++;});});
  });
  const apOrder=T.slice().sort((a,b)=>(ap[b].w+ap[b].d/2)-(ap[a].w+ap[a].d/2)||ap[b].pf-ap[a].pf);
  const posNow=apLast&&typeof posAfter==='function'?posAfter(apLast):null; /* the results table's Pos column, same lens */
  T.forEach(t=>{out[t].ap={...ap[t],rank:apOrder.indexOf(t)+1,pos:posNow?posNow[t]:0,live:apLive,last:apLast};});
  /* 2 · finished matchups: close games (margin <= CLOSE_MARGIN), points against, scores */
  const cm=typeof CLOSE_MARGIN==='number'?CLOSE_MARGIN:5;
  const cl={},pa={},score={};T.forEach(t=>{cl[t]={w:0,d:0,l:0};pa[t]=0;score[t]={};});
  (D.fx||[]).forEach(f=>{if(!fin(f.Finished))return;const g=num(f.GW),h=num(f['Home pts']),a=num(f['Away pts']);
    [[f.Home,h,a],[f.Away,a,h]].forEach(([t,me,op])=>{if(!cl[t])return;pa[t]+=op;score[t][g]=me;
      if(Math.abs(me-op)<=cm){if(me>op)cl[t].w++;else if(me<op)cl[t].l++;else cl[t].d++;}});});
  const nClose=T.reduce((s,t)=>s+cl[t].w+cl[t].d+cl[t].l,0)/2;
  const paAvg=T.reduce((s,t)=>s+pa[t],0)/T.length;
  T.forEach(t=>{out[t].close={...cl[t],n:cl[t].w+cl[t].d+cl[t].l,league:nClose,margin:cm};
    out[t].pa={v:pa[t],rank:tsxRank(pa,t),avg:paAvg};});
  /* 3 · GW Log (finished gameweeks): bench points left, XI points by position, waiver-wire XI points */
  const logG=(D.gl||[]).map(r=>num(r.GW));const g0=logG.length?Math.min(...logG):0;
  const squad0={};T.forEach(t=>squad0[t]=new Set());
  (D.gl||[]).forEach(r=>{if(num(r.GW)===g0&&squad0[r.Team])squad0[r.Team].add(String(r.Code));});
  const ben={},xiS={},posS={},wire={},wireBy={},nG={};
  T.forEach(t=>{ben[t]={};xiS[t]={};posS[t]={GKP:0,DEF:0,MID:0,FWD:0};wire[t]=0;wireBy[t]={};nG[t]=new Set();});
  (D.gl||[]).forEach(r=>{const g=num(r.GW),t=r.Team;if(!fset.has(g)||!ben[t])return;nG[t].add(g);
    const p=num(r['GW pts']);
    if(r.Started==='XI'){xiS[t][g]=(xiS[t][g]||0)+p;if(posS[t][r.Pos]!==undefined)posS[t][r.Pos]+=p;
      if(g0&&!squad0[t].has(String(r.Code))){wire[t]+=p;const k=String(r.Code);(wireBy[t][k]=wireBy[t][k]||{name:r.Player,v:0}).v+=p;}}
    else if(r.Started==='BEN')ben[t][g]=(ben[t][g]||0)+p;});
  const benTot={},benRaw={};
  T.forEach(t=>{let s=0,raw=0,worst=null;
    Object.keys(ben[t]).map(Number).forEach(g=>{
      /* a bench player auto-subbed in scored for the team: take back whatever the score has beyond the XI's logged points */
      const sub=Math.max(0,(score[t][g]||0)-(xiS[t][g]||0)),left=Math.max(0,ben[t][g]-sub);
      s+=left;raw+=ben[t][g];if(!worst||left>worst.v)worst={g,v:left};});
    benTot[t]=s;benRaw[t]=raw;out[t].bench={v:s,raw,worst};});
  const benAvg=T.reduce((s,t)=>s+benTot[t],0)/T.length;
  T.forEach(t=>{out[t].bench.rank=tsxRank(benTot,t);out[t].bench.avg=benAvg;});
  const wireAvg=T.reduce((s,t)=>s+wire[t],0)/T.length;
  T.forEach(t=>{const best=Object.values(wireBy[t]).sort((a,b)=>b.v-a.v)[0]||null;
    out[t].wire={v:wire[t],avg:wireAvg,rank:tsxRank(wire,t),best,n:Object.keys(wireBy[t]).length};});
  const per={};T.forEach(t=>{const n=nG[t].size||1;per[t]={};TSX_POS.forEach(([k])=>per[t][k]=posS[t][k]/n);});
  const lg={};TSX_POS.forEach(([k])=>lg[k]=T.reduce((s,t)=>s+per[t][k],0)/T.length);
  T.forEach(t=>{out[t].pos={};TSX_POS.forEach(([k])=>out[t].pos[k]={v:per[t][k],lg:lg[k],d:per[t][k]-lg[k]});out[t].pos.n=nG[t].size;});
  /* 4 · the draft: every drafted player (the first logged squads) ranked by season points; pick = (round-1)*8 + pick in round */
  const ptsOf=c=>{const r=(D.plr||[]).find(x=>String(x.Code)===c)||(D.ro||[]).find(x=>String(x.Code)===c);return r?num(r['Season pts']):0};
  const nameOf=c=>{const r=(D.ro||[]).find(x=>String(x.Code)===c)||(D.plr||[]).find(x=>String(x.Code)===c)||(D.gl||[]).find(x=>String(x.Code)===c);return r?r.Player:''};
  const drafted=[];T.forEach(t=>squad0[t].forEach(c=>drafted.push({c,t,pts:ptsOf(c)})));
  const nT=T.length,nDr=drafted.length;
  drafted.forEach(x=>{x.rank=1+drafted.filter(y=>y.pts>x.pts).length;});
  const drBy={};drafted.forEach(x=>{drBy[x.t+'|'+x.c]=x});
  T.forEach(t=>{
    const picks=[],have=new Set();let p1=0;
    (D.ro||[]).forEach(r=>{if(r.Team!==t)return;const m=/^R(\d+)\.(\d+)$/.exec(String(r.Drafted||''));if(!m)return;
      const rd=+m[1],pk=+m[2];have.add(rd);if(!p1)p1=rd%2?pk:nT+1-pk;
      const x=drBy[t+'|'+String(r.Code)];
      picks.push({c:String(r.Code),name:r.Player,round:rd,pick:(rd-1)*nT+pk,pts:x?x.pts:num(r['Season pts']),rank:x?x.rank:0,ok:!!x});});
    /* a drafted player since dropped: his slot is the one round the roster no longer holds (only when that is unambiguous) */
    const onRoster=new Set((D.ro||[]).filter(r=>r.Team===t).map(r=>String(r.Code)));
    const dropped=[...squad0[t]].filter(c=>!onRoster.has(c));
    const rounds=Math.max(15,...[...have]);const missing=[];for(let r=1;r<=rounds;r++)if(!have.has(r))missing.push(r);
    if(dropped.length===1&&missing.length===1&&p1){const rd=missing[0],pk=rd%2?p1:nT+1-p1,x=drBy[t+'|'+dropped[0]];
      picks.push({c:dropped[0],name:nameOf(dropped[0]),round:rd,pick:(rd-1)*nT+pk,pts:x.pts,rank:x.rank,ok:true,gone:true});}
    const val=x=>x.pick-x.rank;
    const pool=picks.filter(x=>x.ok);
    const hit=pool.filter(x=>!x.gone).sort((a,b)=>val(b)-val(a)||b.pts-a.pts)[0]||null;
    const miss=pool.filter(x=>x.round<=3).sort((a,b)=>val(a)-val(b)||a.pts-b.pts)[0]||null;
    out[t].draft={hit,miss,n:nDr,inferred:picks.filter(x=>x.gone).map(x=>x.name+' R'+x.round)};
  });
  out.__meta={fgs,g0,nDr,lg};
  return out;});}

/* ---------- Season numbers (replaces Squad health on My team and on every profile sheet) ---------- */
function tsxRow(lab,val,ctx,cls){return '<div class="tsx-row'+(cls?' '+cls:'')+'"><div class="tsx-l"><b>'+lab+'</b><span>'+ctx+'</span></div><b class="tsx-n num">'+val+'</b></div>'}
function tsxSeasonHTML(team){
  const fgs=tsxFinGws();if(!fgs.length||!TEAMS[team])return '';
  const S=tsxCalc()[team];if(!S)return '';
  const n8=Object.keys(TEAMS).length,rows=[];
  /* all-play */
  const A=S.ap;
  if(A.last){const same=A.rank===A.pos;
    rows.push(tsxRow('All-play record',tsxRec(A),
      'Would be '+ORD(A.rank)+' against all seven every week'+(same?', same as the table':' · actually '+ORD(A.pos))
      +(A.live?' (GW'+A.live+' live)':'')));}
  /* close games */
  const C=S.close;
  rows.push(tsxRow('Close games',tsxRec(C),C.n?'Matchups decided by '+C.margin+' or fewer':'No matchup decided by '+C.margin+' or fewer yet'));
  /* points against */
  const P=S.pa;
  rows.push(tsxRow('Points against',P.v,P.rank===1?'Most in the league: the toughest schedule':P.rank===n8?'Fewest in the league: the kindest schedule':ORD(P.rank)+' most in the league · average '+Math.round(P.avg)));
  /* by position */
  if(S.pos.n){const cells=TSX_POS.map(([k,s])=>{const d=S.pos[k].d;return '<span class="tsx-pc"><i>'+s+'</i><b class="num '+(Math.abs(d)<.05?'':d>0?'tsx-up':'tsx-dn')+'">'+tsxSgn(d,1)+'</b></span>'}).join('');
    rows.push('<div class="tsx-row tsx-wide"><div class="tsx-l"><b>Points by position</b><span>XI points a gameweek vs the league average</span></div><div class="tsx-pcs">'+cells+'</div></div>');}
  /* bench */
  const B=S.bench;
  if(B.worst)rows.push(tsxRow('Points left on the bench',B.v,tsxLeagueOrd(B.rank,n8)+' · worst: '+B.worst.v+' in GW'+B.worst.g));
  /* waiver wire */
  const W=S.wire;
  rows.push(tsxRow('Waiver pickups',W.v,'XI points · league average '+Math.round(W.avg)+(W.best&&W.best.v>0?' · best: '+esc(W.best.name)+', '+W.best.v:'')));
  /* the draft */
  const Dr=S.draft;
  if(Dr.hit)rows.push(tsxRow('Best pick: '+esc(Dr.hit.name),Dr.hit.pts,'Taken '+ORD(Dr.hit.pick)+', '+ORD(Dr.hit.rank)+' in points of the '+Dr.n+' drafted'));
  if(Dr.miss){const bad=Dr.miss.pick-Dr.miss.rank<0;
    rows.push(tsxRow((bad?'Biggest miss: ':'Weakest early pick: ')+esc(Dr.miss.name),Dr.miss.pts,'Taken '+ORD(Dr.miss.pick)+', '+ORD(Dr.miss.rank)+' in points of the '+Dr.n+' drafted'+(Dr.miss.gone?' · since dropped':'')));}
  const span=fgs.length>1?'GW'+fgs[0]+' to GW'+fgs[fgs.length-1]:'GW'+fgs[0];
  return '<h2 class="v10">Season numbers<span class="lnk tsx-k">'+span+'</span></h2><div class="tsx">'+rows.join('')+'</div>';
}
squadHealth=function(team){return tsxSeasonHTML(team)};

/* the luck index's all-play (base schedLuck) with one fix: only gameweeks up to the current one. After the deadline
   mscore() calls every unfinished matchup "live" (D.dlPassed), so during a live gameweek the base counted all 33
   future gameweeks with this week's live scores (Cold Palmers read 251-0-15 in the GW5 live scenario). Same maths
   otherwise, so the Lab and Season numbers agree in every state. */
schedLuck=function(){
  const out={},byGw={};
  D.fx.forEach(f=>{const g=num(f.GW);(byGw[g]=byGw[g]||[]).push(f)});
  Object.keys(byGw).forEach(g=>{
    const fs=byGw[g];if(fs.length<4||num(g)>D.gw)return;
    const sc={};let ready=true;
    fs.forEach(f=>{const s2=mscore(f);if(!(s2.done||s2.liveNow)){ready=false;return}sc[f.Home]=s2.hs;sc[f.Away]=s2.as2;});
    if(!ready||Object.keys(sc).length<8)return;
    fs.forEach(f=>{[f.Home,f.Away].forEach(t=>{
      const opp=f.Home===t?f.Away:f.Home,mine=sc[t],theirs=sc[opp];
      const act=mine>theirs?3:mine===theirs?1:0;
      let beat=0,tie=0;
      Object.keys(sc).forEach(o=>{if(o===t)return;if(mine>sc[o])beat++;else if(mine===sc[o])tie++;});
      const o2=out[t]=out[t]||{pts:0,ap:0,beat:0,opp:0,cw:0,cl:0,cd:0,gws:0};
      o2.pts+=act;o2.ap+=(beat+tie*0.5)/7*3;o2.beat+=beat+tie*0.5;o2.opp+=7;o2.gws++;
      if(Math.abs(mine-theirs)<=CLOSE_MARGIN){if(act===3)o2.cw++;else if(act===0)o2.cl++;else o2.cd++;}
    });});
  });
  return out;
};

/* ---------- tiles: THIS GW · BEST GW · POINTS FOR, identical on My team and the profile sheet ---------- */
function tsxThisGw(team){
  const cur=(D.fx||[]).filter(f=>num(f.GW)===D.gw).find(f=>f.Home===team||f.Away===team);
  if(!cur)return {big:'–',sub:'No match this gameweek'};
  const s=mscore(cur),home=cur.Home===team,my=home?s.hs:s.as2,op=home?s.as2:s.hs;
  if(s.done)return {big:my,sub:'GW'+D.gw+' final · '+(my>op?'won by '+(my-op):my<op?'lost by '+(op-my):'drew')};
  if(s.liveNow)return {big:my,sub:'Proj final '+fmt1(teamProj(team))};
  let sub='GW'+D.gw+' projected';
  if(typeof hpWin==='function'){const w=hpWin(cur);const p=home?w.h:w.a;if(isFinite(p))sub='Projected · '+Math.round(p*100)+'% win';}
  return {big:fmt1(teamProj(team)),sub};
}
function tsxTiles(tiles,team){
  if(!tiles||tiles.children.length<3)return;
  const st=D.st.slice().sort((a,b)=>num(b['League Pts'])-num(a['League Pts'])||num(b['Pts For'])-num(a['Pts For']));
  const pos=st.findIndex(s=>s.Team===team)+1,row=st[pos-1]||{};
  const pfRank=tsxRank(Object.fromEntries(st.map(s=>[s.Team,num(s['Pts For'])])),team);
  const g=tsxThisGw(team);
  tiles.classList.add('tsx-tiles');
  tiles.children[0].innerHTML='<b style="font-size:1.9rem;color:var(--p2)">'+g.big+'</b><span>'+esc(g.sub)+'</span>';
  tiles.children[2].innerHTML='<b style="font-size:1.9rem">'+num(row['Pts For'])+'</b><span>Points for · '+ORD(pfRank)+'</span>';
}

/* My team page mode: v10's renderTeam strips everything from "Current squad" to "Actual vs expected", which also took
   the Results table (and anything later modules hang off it). Strip only the squad list here, before that loop runs,
   so the loop finds nothing and Results stays. */
function tsxDropSquad(root){
  const sq=[...root.querySelectorAll('.posh2')].find(h=>/Current squad/.test(h.textContent));if(!sq)return;
  let n=sq;while(n&&!n.classList.contains('tres')&&!(n.classList.contains('posh2')&&/^Actual vs expected/.test(n.textContent))){const nx=n.nextElementSibling;n.remove();n=nx;}
}
/* My team: tiles from the engine; Results re-added only if something still removed it */
const tsx__rt=renderTeam;renderTeam=function(){
  tsx__rt.apply(this,arguments);
  const mine=myTeam(),page=document.getElementById('teampage');if(!mine||!page)return;
  tsxTiles(page.querySelector('.profstats'),mine);
  if(!page.querySelector('.tres')&&typeof resultsHTML==='function'){
    const anchor=[...page.querySelectorAll('.posh2')].find(h=>/^Actual vs expected/.test(h.textContent));
    if(anchor)anchor.insertAdjacentHTML('beforebegin',resultsHTML(mine));}
};
/* profile sheet: same tiles; position and record join the manager line like the My team header */
const tsx__op=openProfile;openProfile=function(team,intoEl){
  const sh0=document.getElementById('sheet');
  tsx__op.apply(this,arguments);
  if(intoEl){tsxDropSquad(intoEl);return;}
  if(!TEAMS[team])return;
  const sh=sh0&&sh0.querySelector('.sh-right');if(!sh)return;
  const tiles=sh.querySelector('.profstats');if(!tiles||tiles.dataset.tsx)return;
  const st=D.st.slice().sort((a,b)=>num(b['League Pts'])-num(a['League Pts'])||num(b['Pts For'])-num(a['Pts For']));
  const pos=st.findIndex(s=>s.Team===team)+1,row=st[pos-1]||{};
  const h3=sh.querySelector('h3'),sub=h3&&h3.nextElementSibling;
  if(sub&&sub.classList.contains('sub')&&row.W!==undefined)
    sub.innerHTML=esc((TEAMS[team]||{}).mgr||'')+' · '+ORD(pos)+' · <span class="num">'+row.W+'–'+row.D+'–'+row.L+'</span>';
  tsxTiles(tiles,team);tiles.dataset.tsx='1';
};

/* ---------- player sheet: the engine's projection, live projection, form and value ---------- */
const PSX_PARTS=[['app','Appearance'],['goals','Goals'],['assists','Assists'],['cs','Clean sheet'],['gc','Goals conceded'],['saves','Saves'],['defcon','Defensive contribution'],['bonus','Bonus'],['cards','Cards']];
/* the row the engine should read: roster row, else the Players row (true status; the sheet's free-agent pseudo flattens doubtful to 'i') */
function psxRow(p){
  if(p&&TEAMS[p.Team])return p;
  const r=(D.plr||[]).find(x=>String(x.Code)===String(p.Code));
  if(!r)return p;
  const g=(D.gwsCur||{})[String(r.Code)]||{};   /* Players rows carry no gameweek columns; hpLive reads 'GW pts' for "so far" */
  return Object.assign({},r,{Code:String(r.Code),'GW pts':num(g.Pts),'GW mins':num(g.Mins)});
}
/* one decimal per part, largest remainder, so the parts shown add up exactly to the total shown */
function psxRound(parts,total){
  const keys=Object.keys(parts),T=Math.round(total*10);
  const fl=keys.map(k=>{const x=parts[k]*10,f=Math.floor(x+1e-9);return {k,f,r:x-f}});
  let need=T-fl.reduce((s,x)=>s+x.f,0);
  fl.slice().sort((a,b)=>b.r-a.r).forEach(x=>{if(need>0){x.f++;need--;}});
  const o={};fl.forEach(x=>o[x.k]=x.f/10);return o;
}
function psxProjParts(h){
  const tot=Math.round(h.pts*10)/10,r=psxRound(h.parts,tot);
  return {tot,rows:PSX_PARTS.filter(([k])=>Math.abs(r[k])>=.05).map(([k,l])=>({k,l,v:r[k]}))};
}
function psxPreHTML(p){
  const pr=psxRow(p),h=hpPlayer(pr,D.gw);
  if(!h.nfx)return '<div class="psx"><div class="psx-top"><div class="psx-big"><span class="psx-k">Gameweek '+D.gw+'</span><b class="num">0</b></div><div class="psx-st"><span>No match this gameweek</span></div></div></div>';
  const P=psxProjParts(h),fpl=typeof fplEpOf==='function'?fplEpOf(p.Code):null;
  const list=P.rows.length?P.rows.map(x=>'<div class="psx-pr"><span>'+x.l+'</span><b class="num">'+(x.v>0?'+':'−')+Math.abs(x.v).toFixed(1)+'</b></div>').join('')
    +'<div class="psx-pr psx-tot"><span>Projected total</span><b class="num">'+P.tot.toFixed(1)+'</b></div>'
    :'<div class="psx-pr psx-none"><span>Not expected to play'+(pr.News?': '+esc(String(pr.News)):'')+'</span></div>';
  return '<div class="psx">'
    +'<div class="psx-top"><div class="psx-big"><span class="psx-k">Projected · GW'+D.gw+(h.nfx>1?' double':'')+'</span><b class="num">'+fmt1(h.pts)+'</b>'+(fpl!==null&&fpl!==undefined?'<em>FPL '+fmt1(fpl)+'</em>':'')+'</div>'
    +'<div class="psx-st"><div><b class="num">'+Math.round(h.pStart*100)+'%</b><span>Start chance</span></div><div><b class="num">'+Math.round(h.eMin)+'</b><span>Expected minutes</span></div></div></div>'
    +'<div class="psx-parts">'+list+'</div>'
    +'<p class="psx-note">Projection: start chance and minutes from his recent gameweeks, xG and xA per 90, opponent strength. Backtested GW2-5: average miss 1.1 pts, FPL’s 1.3.</p>'
    +'</div>';
}
const PSX_STATE={live:'On the pitch',bench:'On the bench, a cameo still possible',off:'Subbed off',pre:'Kicking off',done:'Full time'};
function psxLiveHTML(p){
  const pr=psxRow(p),L=hpLive(pr);
  if(L.state==='done'||L.state==='blank')return '';
  const so=L.pts-L.rem,rm=Math.round(L.rem*10)/10;
  return '<div class="psx psx-live">'
    +'<div class="psx-top"><div class="psx-big"><span class="psx-k">Proj final · GW'+D.gw+'</span><b class="num">'+fmt1(L.pts)+'</b></div>'
    +'<div class="psx-st"><div><b class="num">'+fmt1(so)+'</b><span>So far</span></div><div><b class="num">'+(rm>0?'+':rm<0?'−':'')+fmt1(Math.abs(rm))+'</b><span>Still to come</span></div></div></div>'
    +'<div class="psx-state">'+esc(L.state==='bench'&&rm<=0?'Did not start':PSX_STATE[L.state]||'')+'</div>'
    +'</div>';
}
/* completed matches only: every earlier gameweek, and this one once his club's fixtures are all final */
function psxApps(p){
  const out=[];Object.keys(D.gwsByGw||{}).map(Number).sort((a,b)=>a-b).forEach(g=>{
    if(g>D.gw||(g===D.gw&&!fxFinished(p.Club)))return;
    const r=(D.gwsByGw[g]||{})[String(p.Code)];if(r&&r.Mins>0)out.push({g,r});});
  return out;
}
function psxForm(p){
  const apps=psxApps(p);if(!apps.length)return null;
  let sp=0,sn=0;apps.forEach(({r})=>{if(r.Starts>0){sp+=r.Pts;sn+=r.Starts;}});
  const pts=apps.map(x=>x.r.Pts).sort((a,b)=>a-b),n=pts.length;
  const q=f=>pts[Math.max(0,Math.ceil(f*n)-1)];  /* nearest-rank percentile */
  const hits=pts.filter(v=>v>=6).length;
  const pr=psxRow(p);let h=hpPlayer(pr,D.gw);if(!h.r){for(let g=D.gw+1;g<=D.gw+3&&!h.r;g++)h=hpPlayer(pr,g);}
  return {n,starts:sn,perStart:sn?sp/sn:null,xg:h.r?h.r.xg:null,xa:h.r?h.r.xa:null,hits,hitRate:hits/n,floor:q(.1),ceil:q(.9)};
}
function psxFormHTML(p){
  const F=psxForm(p);if(!F)return '';
  const c=(v,l)=>'<div><b class="num">'+v+'</b><span>'+l+'</span></div>';
  return '<div class="psx-form"><h4>Form and value<span>'+F.n+' appearance'+(F.n===1?'':'s')+'</span></h4><div class="psx-fg">'
    +c(F.perStart===null?'–':fmt1(F.perStart),'Pts per start')
    +c(F.xg===null?'–':F.xg.toFixed(2),'xG per 90')
    +c(F.xa===null?'–':F.xa.toFixed(2),'xA per 90')
    +c(Math.round(F.hitRate*100)+'%','6+ pts, '+F.hits+' of '+F.n)
    +c(F.n>=3?F.floor:'–','Floor')
    +c(F.n>=3?F.ceil:'–','Ceiling')
    +'</div><p class="psx-note">xG and xA per 90 as the projection rates them. Floor and ceiling: 10th and 90th percentile of his gameweek scores'+(F.n<3?', from three appearances':'')+'.</p></div>';
}
const psx__os=openSheet;openSheet=function(p){
  psx__os.apply(this,arguments);
  if(!p||!D.gwsByGw||typeof hpPlayer!=='function')return;
  const right=document.querySelector('#sheet .sh-right');if(!right||right.querySelector('.psx,.psx-form'))return;
  const grid=right.querySelector(':scope > .xpgrid');
  const anchor=grid||right.querySelector(':scope > .chiprow');
  let html='';
  if(!fxStarted(p.Club)){
    /* pre-match: the FPL grid and the itemized "Projected gameweek" block go, the engine's projection takes their place */
    if(grid)grid.remove();
    right.querySelectorAll(':scope > .bdrow').forEach(r=>r.remove());
    right.querySelectorAll(':scope > p.sh-note').forEach(n=>{if(/^Itemized from his averages/.test(n.textContent.trim()))n.remove();});
    html=psxPreHTML(p);
    const ch=right.querySelector(':scope > .chiprow');
    if(ch)ch.insertAdjacentHTML('afterend',html);else right.insertAdjacentHTML('beforeend',html);
  } else {
    html=psxLiveHTML(p);
    if(html){if(anchor===grid&&grid)grid.insertAdjacentHTML('beforebegin',html);else if(anchor)anchor.insertAdjacentHTML('afterend',html);}
  }
  const fh=psxFormHTML(p);
  if(fh){const hist=right.querySelector(':scope > .hist');
    if(hist)hist.insertAdjacentHTML('beforebegin',fh);else{const pj=right.querySelector('.psx');(pj||anchor||right.lastElementChild).insertAdjacentHTML('afterend',fh);}}
};

/* ===== v12 · fixtures: the gameweek browser, the sheet stack, and content hygiene =====
   A. Matchday gets previous/next arrows on the "Gameweek N" tab: GW1..GW38. The current gameweek renders exactly
      as before. A past gameweek = its four results (tap one for both lineups from the GW Log); a future gameweek =
      its four fixtures with records and the all-time series, plus the house projection for the NEXT gameweek only.
      The selection lives in memory (fbxSel) so the 5-minute loadAll re-render keeps it. The "Gameweek N+1 fixtures"
      button retires (nextGwBtn returns ''). Team pages: finished rows of the Results table open the same past-matchup
      sheet, and a short "Fixtures" table lists the next five H2H meetings (tap = that gameweek on Matchday).
   B. Sheet stack: opening a sheet while one is showing keeps a re-render thunk for the one underneath, with its scroll
      position, and one extra history entry. × and the phone back button both pop one level (× goes through
      history.back(), so both take the same popstate path). Sheets opened by code outside the stack (sign-in, etc.)
      keep the old behaviour: closing them closes everything.
   C. The big show card appears only when a real preview exists for the gameweek (PREVIEWS entry or a show payload).
      Recent news lists only articles from the last two gameweeks; older ones stay in the All articles sheet, which
      stays reachable. No emojis on these cards. The lineup graphic keeps an entry point on each matchup page and on
      My team. ===== */

const FBX_CHEVL='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>';
let fbxSel=null; /* the gameweek Matchday shows; null = follow the current gameweek */

/* ---------- helpers ---------- */
function fbxMaxGw(){let m=0;(D.fx||[]).forEach(f=>{const g=num(f.GW);if(g>m)m=g});return m||38}
function fbxGw(){if(fbxSel===D.gw)fbxSel=null;const g=fbxSel==null?D.gw:fbxSel;return Math.max(1,Math.min(fbxMaxGw(),g))}
function fbxRows(g){return (D.fx||[]).filter(f=>num(f.GW)===g)}
function fbxOrder(rows){const mine=myTeam();const me=f=>mine&&(f.Home===mine||f.Away===mine)?0:1;
  return rows.map((f,i)=>({f,i})).sort((a,b)=>me(a.f)-me(b.f)||a.i-b.i)}
function fbxShort(t){return (typeof SHORTOF!=='undefined'&&SHORTOF[t])||t}
function fbxRes(a,b){return a>b?'W':a<b?'L':'D'}
function fbxRec(t){const s=(D.st||[]).find(x=>x.Team===t);return s&&s.W!==undefined&&s.W!==''?num(s.W)+'–'+num(s.D)+'–'+num(s.L):''}
function fbxKicks(g){return (D.cf||[]).filter(x=>num(x.GW)===g).map(x=>dt(x['Kickoff (UTC)'])).filter(Boolean).sort((a,b)=>a-b)}
function fbxDay(d){try{return d.toLocaleDateString(undefined,{weekday:'short',day:'numeric',month:'short'})}catch(e){return ''}}
function fbxWhen(d){try{return d.toLocaleString(undefined,{weekday:'short',day:'numeric',month:'short',hour:'numeric',minute:'2-digit'})}catch(e){return ''}}
function fbxOnMatchday(){return (document.body.getAttribute('data-view')||'gw')==='gw'}
/* one GW Log block per gameweek and team, deduplicated on player (a re-logged week must not double a score) */
function fbxLog(g,team){const seen={},out=[];
  (D.gl||[]).forEach(r=>{if(num(r.GW)!==g||r.Team!==team)return;const k=String(r.Code);if(k in seen){out[seen[k]]=r;return}seen[k]=out.length;out.push(r)});
  return out;}

/* ---------- A. the gameweek browser ---------- */
gwTabsHTML=function(){
  const g=fbxGw(),max=fbxMaxGw(),other=g!==D.gw;
  return '<div class="fbx-bar"><div class="gwtabs fbx-tabs">'
   +'<button class="fbx-ar" data-fbxstep="-1" aria-label="Previous gameweek"'+(g<=1?' disabled':'')+'>'+FBX_CHEVL+'</button>'
   +'<button class="'+(GWTAB==='week'?'on':'')+'" data-gwtab="week">Gameweek '+g+'</button>'
   +'<button class="fbx-ar" data-fbxstep="1" aria-label="Next gameweek"'+(g>=max?' disabled':'')+'>'+CHEV+'</button>'
   +'<button class="'+(GWTAB==='derbies'?'on':'')+'" data-gwtab="derbies">Derbies</button></div>'
   +(other&&GWTAB==='week'?'<button class="fbx-now" data-fbxnow="1">Back to GW'+D.gw+'</button>':'')+'</div>';
};
function fbxSide(t,cls,tail){
  return '<span class="fbx-sd'+(cls?' '+cls:'')+'"><span class="fbx-cr">'+crestOf(t,28)+'</span>'+tail+'</span>';
}
function fbxPastHTML(g,rows){
  const ko=fbxKicks(g)[0];
  let h='<h2 class="v10">Results'+(ko?'<span class="lnk hst">'+esc(fbxDay(ko))+'</span>':'')+'</h2><div class="fbx-list">';
  fbxOrder(rows).forEach(({f,i})=>{
    const s=mscore(f),hp=s.hs,ap=s.as2,nm=derbyName(f.Home,f.Away);
    const pill=(a,b)=>s.done?'<i class="fbx-r fbx-'+fbxRes(a,b)+'">'+fbxRes(a,b)+'</i>':'';
    h+='<button class="fbx-row" data-fbxpast="'+g+'|'+i+'">'
     +'<span class="fbx-k"><span class="fbx-dn">'+(nm?esc(nm):'')+'</span><span class="fbx-go">Lineups'+CHEV+'</span></span>'
     +'<span class="fbx-ln">'+fbxSide(f.Home,'','<b>'+esc(fbxShort(f.Home))+'</b>'+pill(hp,ap))
     +'<span class="fbx-sc"><b'+(hp>=ap?' class="fbx-w"':'')+'>'+hp+'</b><i>–</i><b'+(ap>=hp?' class="fbx-w"':'')+'>'+ap+'</b></span>'
     +fbxSide(f.Away,'fbx-rt','<b>'+esc(fbxShort(f.Away))+'</b>'+pill(ap,hp))+'</span></button>';
  });
  return h+'</div>';
}
function fbxFutureHTML(g,rows){
  const dl=gwDeadline(g),ko=fbxKicks(g)[0];
  const when=dl?'Deadline '+fbxWhen(dl):ko?fbxDay(ko):'';
  const proj=g===D.gw+1&&typeof hpTeam==='function';
  let h='<h2 class="v10">Fixtures'+(when?'<span class="lnk hst">'+esc(when)+'</span>':'')+'</h2><div class="fbx-list">';
  fbxOrder(rows).forEach(({f})=>{
    const nm=derbyName(f.Home,f.Away),sr=series(f.Home,f.Away)||'';
    const tail=t=>'<span class="fbx-nm"><b>'+esc(fbxShort(t))+'</b><em class="num">'+esc(fbxRec(t))+'</em></span>';
    let mid='<span class="fbx-sc fbx-v">v</span>';
    if(proj){let a=null,b=null;try{a=hpTeam(f.Home,g);b=hpTeam(f.Away,g);}catch(e){}
      if(a!==null&&b!==null&&isFinite(a)&&isFinite(b))mid='<span class="fbx-sc fbx-pj"><span class="fbx-n"><b>'+(Math.round(a*10)/10).toFixed(1)+'</b><i>–</i><b>'+(Math.round(b*10)/10).toFixed(1)+'</b></span><small>Projected</small></span>';}
    h+='<div class="fbx-row fbx-fut">'
     +'<span class="fbx-k"><span class="fbx-dn">'+(nm?esc(nm):'')+'</span><span class="fbx-sr">'+esc(sr)+'</span></span>'
     +'<span class="fbx-ln">'+fbxSide(f.Home,'',tail(f.Home))+mid+fbxSide(f.Away,'fbx-rt',tail(f.Away))+'</span></div>';
  });
  return h+'</div>';
}
function fbxWeekHTML(g){
  const rows=fbxRows(g);
  if(!rows.length)return '<p class="state">No fixtures found for Gameweek '+g+'.</p>';
  return g<D.gw?fbxPastHTML(g,rows):fbxFutureHTML(g,rows);
}
function fbxStep(d){const g=fbxGw()+d;if(g<1||g>fbxMaxGw())return;fbxSel=g===D.gw?null:g;GWTAB='week';renderGW();}
/* jump to a gameweek on Matchday from anywhere (team page Fixtures rows) */
function fbxGoGw(g){
  const go=()=>{fbxSel=g===D.gw?null:g;GWTAB='week';
    if((location.hash||'#gw')==='#gw')renderGW();else location.hash='gw';window.scrollTo(0,0);};
  if(sheet.classList.contains('on'))fbxCloseAll(go);else go();
}

/* ---------- the past-matchup sheet ---------- */
function fbxLineupCol(g,t){
  const log=fbxLog(g,t);
  if(!log.length)return {html:'<p class="fbx-none">Lineup not logged for this gameweek.</p>',tot:null};
  const PO={GKP:0,DEF:1,MID:2,FWD:3};const ord=(a,b)=>(PO[a.Pos]??9)-(PO[b.Pos]??9);
  const xi=log.filter(r=>r.Started==='XI').sort(ord),ben=log.filter(r=>r.Started!=='XI').sort(ord);
  const pts=r=>Math.round(num(r['GW pts']));
  const tot=xi.reduce((s,r)=>s+pts(r),0),bt=ben.reduce((s,r)=>s+pts(r),0);
  const top=xi.reduce((m,r)=>Math.max(m,pts(r)),0);
  const row=(r,bn)=>{const p=pts(r),tp=!bn&&top>0&&p===top;
    /* the Top tag rides inside the name span, so on a narrow phone it wraps under the name instead of cutting it */
    return '<div class="fbx-pl'+(bn?' fbx-bn':'')+(tp?' fbx-top':'')+'" data-fbxpc="'+esc(r.Code)+'" role="button" tabindex="0">'
     +'<span class="fbx-ps">'+esc(r.Pos)+'</span>'+badgeImg(r.Club,14)+'<span class="fbx-pn">'+esc(r.Player)
     +(tp?' <span class="fbx-tp">Top</span>':'')+'</span><b class="fbx-pt">'+p+'</b></div>';};
  return {tot,html:'<div class="fbx-lh">Starting XI</div>'+xi.map(r=>row(r,0)).join('')
   +'<div class="fbx-tot"><span>Total</span><b>'+tot+'</b></div>'
   +(ben.length?'<div class="fbx-lh">Bench</div>'+ben.map(r=>row(r,1)).join('')
     +'<div class="fbx-tot fbx-bn"><span>Left on the bench</span><b>'+bt+'</b></div>':'')};
}
function fbxOpenPast(g,i){
  g=+g;const f=fbxRows(g)[+i];if(!f)return;
  const s=mscore(f),nm=derbyName(f.Home,f.Away);
  const L=fbxLineupCol(g,f.Home),R=fbxLineupCol(g,f.Away);
  const sd=t=>'<div class="fbx-psd"><span class="fbx-cr">'+crestOf(t,44)+'</span><b>'+esc(fbxShort(t))+'</b><i>'+esc(FIRSTOF(t))+'</i></div>';
  sheet.innerHTML='<div class="sh-right fbx-pm"><button class="sh-x" aria-label="Close">×</button>'
   +'<div class="fbx-pk">Gameweek '+g+(nm?' · '+esc(nm):'')+'</div>'
   +'<div class="fbx-ph">'+sd(f.Home)
   +'<div class="fbx-psc"><span class="fbx-n"><b'+(s.hs>=s.as2?' class="fbx-w"':'')+'>'+s.hs+'</b><i>–</i><b'+(s.as2>=s.hs?' class="fbx-w"':'')+'>'+s.as2+'</b></span><small>'+(s.done?'Full time':'Not final')+'</small></div>'
   +sd(f.Away)+'</div>'
   +'<div class="fbx-lu"><div class="fbx-col">'+L.html+'</div><div class="fbx-col">'+R.html+'</div></div></div>';
  ov.classList.add('on');sheet.classList.add('on');pushOverlay();
  sheet.querySelector('.sh-x').onclick=()=>closeSheet();
  const lu=sheet.querySelector('.fbx-lu');
  if(lu)lu.onclick=e=>{const r=e.target.closest('[data-fbxpc]');if(r)fbxOpenPlayer(r.dataset.fbxpc);};
}
function fbxOpenPlayer(code){
  const ro=(D.ro||[]).find(r=>String(r.Code)===String(code));if(ro){openSheet(ro);return}
  const p=(D.plr||[]).find(r=>String(r.Code)===String(code));if(p&&typeof plrPseudo==='function')openSheet(plrPseudo(p));
}

/* ---------- Matchday: wire the browser in (outermost renderScoreboard wrapper at this point) ---------- */
(function(){
  const __rs=renderScoreboard;
  renderScoreboard=function(rows,dl){
    const r=__rs.apply(this,arguments);
    const body=document.getElementById('gwbody');if(!body)return r;
    const g=fbxGw();
    if(GWTAB==='week'&&g!==D.gw)body.innerHTML=gwTabsHTML()+fbxWeekHTML(g);
    else if(GWTAB==='week')fbxTidyCurrent(body);
    const prev=body.onclick;
    body.onclick=e=>{
      const st=e.target.closest('[data-fbxstep]');if(st){fbxStep(+st.dataset.fbxstep);return}
      if(e.target.closest('[data-fbxnow]')){fbxSel=null;GWTAB='week';renderGW();return}
      const p=e.target.closest('[data-fbxpast]');if(p){const q=p.dataset.fbxpast.split('|');fbxOpenPast(+q[0],+q[1]);return}
      if(prev)return prev.call(body,e);
    };
    return r;
  };
})();
nextGwBtn=function(){return ''}; /* the browser replaces the "Gameweek N+1 fixtures" button */

/* ---------- C. content hygiene on the current gameweek ---------- */
function fbxHasPreview(){
  return (typeof PREVIEWS!=='undefined'&&PREVIEWS.some(p=>p.gw===D.gw))||(typeof SHOW!=='undefined'&&!!SHOW&&SHOW.gw===D.gw);
}
function fbxArticles(){
  return RECAPS.map(r=>({x:r,k:'recap',o:0})).concat(PREVIEWS.map(p=>({x:p,k:'preview',o:1})));
}
/* Recent news = articles from the last two gameweeks (this one and the one before), newest first */
contentCardsHTML=function(){
  return fbxArticles().filter(a=>a.x.gw>=D.gw-1&&a.x.gw<=D.gw).sort((a,b)=>b.x.gw-a.x.gw||a.o-b.o)
   .map(a=>'<a class="recapcard'+(a.k==='preview'?' prev':'')+'" href="'+a.x.href+'"><div><div class="rk">Gameweek '+a.x.gw+' '+a.k+'</div>'
     +'<div class="rt">'+a.x.title+'</div><div class="rs">'+a.x.sub+'</div></div><span class="go">Read</span></a>').join('');
};
function fbxTidyCurrent(body){
  const sc=body.querySelector('.recapcard.show');
  if(sc){
    if(!fbxHasPreview())sc.remove();
    else{
      const p=PREVIEWS.find(x=>x.gw===D.gw);
      const rk=sc.querySelector('.rk');if(rk)rk.innerHTML='Gameweek '+D.gw+' preview<span class="new">Watch</span>';
      const rt=sc.querySelector('.rt');if(rt&&!p)rt.textContent='The lineups and talking points for all four matchups';
      const go=sc.querySelector('.go');if(go)go.textContent='Play';
    }
  }
  const pg=body.querySelector('.program');if(pg&&pg.children.length>2)pg.classList.add('fbx-n3');
  /* nothing recent: the archive stays one tap away */
  if(!body.querySelector('#allart')){
    const all=fbxArticles();
    if(all.length){
      const gws=all.map(a=>a.x.gw),lo=Math.min(...gws),hi=Math.max(...gws);
      const stacks=body.querySelectorAll(':scope > .stack');const last=stacks[stacks.length-1];
      const html='<button class="fbx-art" id="allart"><span><b>All articles</b><em>'+all.length+' recaps and previews, Gameweek '+lo+(hi>lo?' to '+hi:'')+'</em></span>'+CHEV+'</button>';
      if(last)last.insertAdjacentHTML('afterend',html);
    }
  }
}
/* the show payload arrives after the first render: bring the card in without waiting for the next refresh */
if(typeof showWarm==='function'){
  const __sw=showWarm;
  showWarm=function(){const r=__sw.apply(this,arguments);
    try{if(D.ro&&D.ro.length&&(!fbxOnMatchday()||SUB==null))renderGW();}catch(e){}
    return r;};
}
/* the lineup graphic keeps an entry point: matchup page (both teams) and My team (your XI) */
(function(){
  const __rm=renderMatch;
  renderMatch=function(f,dl){
    const r=__rm.apply(this,arguments);
    const body=document.getElementById('gwbody');
    if(body&&f&&!body.querySelector('[data-mx],[data-watch],[data-mxall]')){
      const mi=fbxRows(D.gw).indexOf(f);const duel=body.querySelector('.duel');
      let lab=typeof watchLabel==='function'?watchLabel(f):'Watch the matchup';
      if(lab==='Watch the preview'&&!fbxHasPreview())lab='Watch the lineups'; /* no written preview this week: it is the lineup reveal */
      if(mi>=0&&duel)duel.insertAdjacentHTML('beforebegin','<div class="watchrow fbx-wr"><button class="watch" data-mx="'+mi+'">'+esc(lab)+'</button></div>');
    }
    return r;
  };
  const __rt=renderTeam;
  renderTeam=function(){
    const r=__rt.apply(this,arguments);
    const page=document.getElementById('teampage'),mine=myTeam();
    if(page&&mine&&!page.querySelector('[data-watch],[data-mx]')){
      const btn='<button class="watch" data-watch="'+esc(mine)+'">Watch the lineup</button>';
      const wr=page.querySelector('.watchrow');
      if(wr)wr.insertAdjacentHTML('beforeend',btn);
      else{const pit=page.querySelector('.mypitch');if(pit)pit.insertAdjacentHTML('beforebegin','<div class="watchrow fbx-wr">'+btn+'</div>');}
    }
    return r;
  };
})();

/* ---------- team page: Results rows open the past matchup; the next five fixtures link into the browser ---------- */
function fbxUpcoming(team){
  return (D.fx||[]).filter(f=>(f.Home===team||f.Away===team)&&!fin(f.Finished)
    &&!(num(f.GW)===D.gw&&(D.dlPassed||effPtsOf(f,f.Home)+effPtsOf(f,f.Away)>0)))
   .sort((a,b)=>num(a.GW)-num(b.GW)).slice(0,5);
}
function fbxUpcomingHTML(team){
  const up=fbxUpcoming(team);if(!up.length)return '';
  const tr=up.map(f=>{const g=num(f.GW),home=f.Home===team,opp=home?f.Away:f.Home,nm=derbyName(f.Home,f.Away);
    const ko=fbxKicks(g)[0],dl=gwDeadline(g);const d=ko||dl;
    return '<tr class="fbx-tap" data-fbxgo="'+g+'"><td class="gw">'+g+'</td><td class="opp"><span class="oc">'+mg(opp,1)+esc(opp)+' <i>('+(home?'H':'A')+')</i>'+(nm?'<small>'+esc(nm)+'</small>':'')+'</span></td>'
     +'<td class="fbx-dt">'+(d?esc(fbxDay(d)):'')+'</td></tr>';}).join('');
  return '<div class="hist tres fbx-up"><h4>Fixtures<span>next '+up.length+'</span></h4><div class="hwrap"><table>'
   +'<thead><tr><th>GW</th><th class="l">Opponent</th><th>Date</th></tr></thead><tbody>'+tr+'</tbody></table></div></div>';
}
function fbxTeamLinks(root,team){
  const res=root&&TEAMS[team]?root.querySelector('.hist.tres:not(.fbx-up)'):null;if(!res)return;
  res.querySelectorAll('tbody tr').forEach(tr=>{
    const g=num((tr.querySelector('td.gw')||{}).textContent);const rows=fbxRows(g);
    const i=rows.findIndex(f=>f.Home===team||f.Away===team);
    if(i<0||!fin(rows[i].Finished))return;
    tr.classList.add('fbx-tap');tr.setAttribute('role','button');tr.onclick=()=>fbxOpenPast(g,i);
  });
  if(!root.querySelector('.fbx-up')){
    res.insertAdjacentHTML('afterend',fbxUpcomingHTML(team));
    const up=root.querySelector('.fbx-up');
    if(up)up.onclick=e=>{const t=e.target.closest('[data-fbxgo]');if(t)fbxGoGw(+t.dataset.fbxgo);};
  }
}
(function(){
  const __op=openProfile;
  openProfile=function(team,intoEl){
    const r=__op.apply(this,arguments);
    fbxTeamLinks(intoEl||document.getElementById('sheet'),team);
    return r;
  };
  /* My team: v10 strips the page-mode results table and v12-stats puts it back after openProfile ran */
  const __rt=renderTeam;
  renderTeam=function(){const r=__rt.apply(this,arguments);fbxTeamLinks(document.getElementById('teampage'),myTeam());return r;};
})();

/* ---------- B. the sheet stack ---------- */
const fbxStack=[];   /* sheets underneath the showing one: {key, thunk, scroll, hist} */
let fbxCur=null;     /* the showing sheet {key, thunk}; null = closed, or opened by code outside the stack */
let fbxIn=0,fbxRestoring=false,fbxSkipPop=0,fbxAfterPop=null;
function fbxStackable(name,keyOf){
  const fn=window[name];
  if(typeof fn!=='function')return;
  window[name]=function(){
    const args=Array.prototype.slice.call(arguments);
    if(name==='openProfile'&&args[1])return fn.apply(this,arguments); /* page mode (My team) is not a sheet */
    const key=keyOf(args),open=sheet.classList.contains('on');
    const same=open&&!!fbxCur&&fbxCur.key===key,y=sheet.scrollTop;
    if(!fbxRestoring){
      if(open&&fbxCur&&!same){
        const e={key:fbxCur.key,thunk:fbxCur.thunk,scroll:y,hist:false};fbxStack.push(e);
        try{history.pushState({emtOv:1,fbx:fbxStack.length},'');e.hist=true;}catch(err){}
      }else if(!open)fbxStack.length=0;
    }
    fbxIn++;let r;
    try{r=fn.apply(this,arguments);}finally{fbxIn--;}
    fbxCur={key,thunk:()=>window[name].apply(window,args)};
    if(!fbxRestoring)sheet.scrollTop=same?y:0;
    return r;
  };
}
fbxStackable('openSheet',a=>'p|'+(a[0]&&a[0].Code));
fbxStackable('openProfile',a=>'m|'+a[0]);
fbxStackable('openArticles',()=>'a');
fbxStackable('openNextGw',()=>'n');
fbxStackable('fbxOpenPast',a=>'x|'+a[0]+'|'+a[1]);
/* a sheet rendered by anyone else (sign-in, claim, …) is outside the stack */
(function(){const __po=pushOverlay;
  pushOverlay=function(){
    if(!fbxIn&&!fbxRestoring){fbxCur=null;if(!OVPUSHED)fbxStack.length=0;}
    return __po.apply(this,arguments);};})();
function fbxRestore(e){
  fbxRestoring=true;
  try{ov.classList.add('on');sheet.classList.add('on');OVPUSHED=true;e.thunk();}
  catch(err){fbxRestoring=false;fbxStack.length=0;fbxCur=null;ov.classList.remove('on');sheet.classList.remove('on');throw err;}
  fbxRestoring=false;
  sheet.scrollTop=e.scroll;requestAnimationFrame(()=>{sheet.scrollTop=e.scroll;});
}
/* close every level at once and drop their history entries; cb runs once the history has settled */
function fbxCloseAll(cb){
  const n=fbxStack.filter(e=>e.hist).length+(OVPUSHED?1:0);
  fbxStack.length=0;fbxCur=null;OVPUSHED=false;
  ov.classList.remove('on');sheet.classList.remove('on');
  if(n){fbxSkipPop++;fbxAfterPop=cb||null;try{history.go(-n);return}catch(e){fbxSkipPop--;fbxAfterPop=null;}}
  if(cb)cb();
}
(function(){
  const __cs=closeSheet;
  closeSheet=function(){
    if(sheet.classList.contains('on')&&fbxStack.length){
      if(!fbxCur)return fbxCloseAll();
      const top=fbxStack[fbxStack.length-1];
      if(top.hist){
        /* back() is async: if the caller navigates right after closing (closeSheet(); location.hash=…), going back
           would undo that navigation, so settle here without touching history instead */
        const h=location.hash;
        Promise.resolve().then(()=>{
          if(location.hash!==h){fbxStack.length=0;fbxCur=null;OVPUSHED=false;ov.classList.remove('on');sheet.classList.remove('on');return}
          try{history.back()}catch(e){}
        });
        return;
      }
      fbxStack.pop();fbxRestore(top);return;
    }
    fbxStack.length=0;fbxCur=null;
    return __cs.apply(this,arguments);
  };
})();
/* runs after the base listener (registered first), which has just hidden the sheet and cleared OVPUSHED */
window.addEventListener('popstate',()=>{
  if(fbxSkipPop){fbxSkipPop--;const cb=fbxAfterPop;fbxAfterPop=null;if(cb)cb();return}
  if(fbxStack.length){const top=fbxStack.pop();fbxRestore(top);return}
  fbxCur=null;
});
ov.onclick=()=>closeSheet(); /* the base bound the original function; route the backdrop through the stack too */

/* ===== v12-ui · the anti-slop fixes a stylesheet can't reach (26 Sep 2026). Loaded last; every top-level name
   starts with uix.
   1. Score bugs: bugHTML writes its ground as an inline style with !important (two radial team-colour orbs over the
      plum gradient), which no stylesheet can override. The ground becomes flat plum; the team-colour flanks, the
      crests and everything else in the bug are untouched. Wraps whatever bugHTML is current (v12-match's included).
   2. The Lab: the manager filter shows each club's crest instead of an initials circle (the acronym-circle look),
      and Reset only appears once a Managers view has been changed.
   3. Players: the owner chip on a player row shows the owner's crest instead of a rainbow initials pill. The chip keeps
      its data-own tap (opens the manager sheet). ===== */
const uixBugHTML=bugHTML;
bugHTML=function(f,i,o){
  return uixBugHTML(f,i,o).replace(/style="background:radial-gradient\([^"]*?!important"/,'style="background:#34104E !important"');
};
const uixRenderLab=renderLab;
renderLab=function(){
  uixRenderLab();
  const ctl=document.getElementById('labctl');if(!ctl)return;
  ctl.querySelectorAll('.labmono[data-t]').forEach(b=>{const t=b.dataset.t;if(!TEAMS[t])return;
    b.innerHTML=crestOf(t,26);b.setAttribute('aria-label',t);b.title=t;});
  const atDefault=LAB.scope==='mgr'&&!LAB.sel.length&&LAB.metric==='pts'&&LAB.view==='bars';
  /* in League scope the Managers tab is the way back, so Reset would only take a row of its own */
  const r=ctl.querySelector('[data-reset]');if(r)r.style.display=(atDefault||LAB.scope!=='mgr')?'none':'';
};
const uixRenderXIs=renderXIs;
renderXIs=function(){
  uixRenderXIs.apply(this,arguments);
  const body=document.getElementById('xisbody');if(!body)return;
  body.querySelectorAll('.ownp[data-own]').forEach(c=>{const t=c.dataset.own;if(!TEAMS[t]||c.classList.contains('uix-own'))return;
    c.classList.add('uix-own');c.style.background='';c.innerHTML=crestOf(t,22);c.setAttribute('aria-label',t);c.title=t;});
};

/* integration: the header pill is the league clock on every screen, not only after the Matchday scoreboard renders
   (a direct load into #gw/N used to keep the base's "GW5 · FINAL" until the 30-second tick) */
const uix__rg=renderGW;renderGW=function(){const r=uix__rg.apply(this,arguments);try{v10clock()}catch(e){}return r};

/* ===== v12-look: the approved D2 design (27 Sep 2026) =====
   Archivo for words, Barlow Condensed for numbers, ink + lavender ground, purple used sparingly, Mono badges.
   Layout: Matchday hero + one league list + previews and recaps; one matchup header; team page / manager sheet
   rebuilt around a next-match card and one schedule. Plate cards, pitch and the Matchweek wordmark are untouched.
   Every top-level name is inside the IIFE; the only globals replaced are crestSVG, bugHTML and the render wrappers. */
(function(){
const lkPc=x=>Math.round(x*100)+'%'; /* unused since 3 Oct: win chances go through lkWin (one rounding everywhere) */
const lk1=v=>(Math.round(v*10)/10).toFixed(1);
const lkMix=(a,b,t)=>{const p=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));const x=p(a),y=p(b);return '#'+x.map((v,i)=>Math.round(v+(y[i]-v)*t).toString(16).padStart(2,'0')).join('')};

/* ---------- badges: the 12 colourway ids managers pick from, as deep club tones; drawn Mono (ink badge, team-colour line and emblem) ---------- */
const LK_PAL={
  royal:{f:'#2A4BA8',col:'#2D51B8'}, sky:{f:'#3A7AB3',col:'#3A7CC0'}, navy:{f:'#1D2C57',col:'#4A63B0'},
  amethyst:{f:'#5A3889',col:'#6A44A0'}, magenta:{f:'#942E6D',col:'#A5357B'}, aurora:{f:'#23798C',f2:'#46337F',col:'#33628F'},
  gold:{f:'#C4952F',col:'#B98A26'}, crimson:{f:'#A3202F',col:'#B02638'}, tangerine:{f:'#C2571F',col:'#C95F24'},
  umber:{f:'#6F4E39',col:'#8A6247'}, forest:{f:'#235E45',col:'#2C7A57'}, teal:{f:'#136862',col:'#177970'}};
const LK_DEF={PN:'royal',BS:'amethyst',CT:'teal',PJ:'crimson',EG:'gold',BK:'tangerine',JS:'umber',NG:'magenta'};
/* rewrite the shared colour data once, so every consumer (win bars, charts, the lineup graphic, the show) agrees */
PALETTE.forEach(p=>{const s=LK_PAL[p.id];if(s){p.c1=s.f;p.c2=s.f2||s.f;p.col=s.col;}});
Object.entries(TEAMS).forEach(([t,tm])=>{const s=LK_PAL[LK_DEF[tm.ini]];if(!s)return;
  tm.col=s.col;TEAM_COL_DEFAULTS[t]=s.col;
  const d=CREST_DEFAULTS[tm.ini],c=CREST[tm.ini];[d,c].forEach(o=>{if(o){o.c1=s.f;o.c2=s.f2||s.f;}});});
try{applyProfiles();}catch(e){}
const lkPidOf=(c1,m)=>{const p=PALETTE.find(x=>x.c1===c1);return p?p.id:LK_DEF[m]};
let lkCid=0;
crestSVG=function(m,size,opt){
  size=size||64;const t=CREST[m];if(!t)return '';const o=opt||{};
  const s=LK_PAL[lkPidOf(o.c1||t.c1,m)]||LK_PAL.royal;const sh=SHAPE_BY[o.shape||t.shape||'shield']||SHAPES[0];
  const useIni=o.emblem!==undefined?o.emblem==='initials':t.useIni===true;
  /* small badges (lists, schedule, header, next card) wear the team colour so they stay easy to tell apart; 33 px and up stay Mono */
  if(size<=32){const id='lkc'+m+(lkCid++);
    const body=s.f2?'<defs><clipPath id="'+id+'"><path d="'+sh.d+'"/></clipPath></defs><g clip-path="url(#'+id+')"><rect width="50" height="108" fill="'+s.f+'"/><rect x="50" width="50" height="108" fill="'+s.f2+'"/></g>'
      :'<path d="'+sh.d+'" fill="'+s.f+'"/>';
    const em2=useIni?'<text x="50" y="66" text-anchor="middle" font-family="Barlow Condensed,sans-serif" font-weight="700" font-size="'+(m.length>2?34:42)+'" fill="#fff">'+m+'</text>':t.emblem;
    return '<svg width="'+size+'" height="'+size+'" viewBox="0 0 100 108" fill="none" aria-label="'+t.name+' crest">'+body+'<g transform="translate(0,6)">'+em2+'</g></svg>';}
  const ec=lkMix(s.col,'#ffffff',.28);
  const em=useIni?'<text x="50" y="66" text-anchor="middle" font-family="Barlow Condensed,sans-serif" font-weight="700" font-size="'+(m.length>2?34:42)+'" fill="'+ec+'">'+m+'</text>'
    :t.emblem.replace(/#fff\b/gi,ec).replace(/#(3B2A05|BFE0FF|CFF6EE|FFE2B8|FFD98F|F7CFF2)/gi,ec);
  return '<svg width="'+size+'" height="'+size+'" viewBox="0 0 100 108" fill="none" aria-label="'+t.name+' crest">'
   +'<path d="'+sh.d+'" fill="#221B2B"/><path d="'+sh.d+'" fill="none" stroke="'+ec+'" stroke-width="3.4" transform="translate(50 54) scale(.88) translate(-50 -54)"/>'
   +'<g transform="translate(0,6)">'+em+'</g></svg>';
};

/* ---------- shared bits ---------- */
function lkState(f){const s=mscore(f);
  if(s.done||D.provOver)return {st:s.done?'ft':'prov',l:s.hs,r:s.as2,cap:s.done?'Full time':'Provisional',sub:D.hasXP?'xP '+lk1(teamXP(f.Home))+' to '+lk1(teamXP(f.Away)):''};
  if(s.liveNow)return {st:'live',l:s.hs,r:s.as2,cap:'Live',sub:D.hasEP?'Proj '+lk1(teamProj(f.Home))+' to '+lk1(teamProj(f.Away)):''};
  return {st:'pred',l:D.hasEP?lk1(teamProj(f.Home)):'-',r:D.hasEP?lk1(teamProj(f.Away)):'-',cap:'Projected',sub:''};}
const lkRec=t=>{const r=(D.st||[]).find(s=>s.Team===t)||{};return r.W===undefined?'':num(r.W)+'-'+num(r.D)+'-'+num(r.L)};
const lkForm=t=>'<span class="lkf">'+[...formOf(t)].filter(x=>x!=='-').map(x=>'<i class="'+x+'">'+x+'</i>').join('')+'</span>';
const lkOrd=t=>{const r=(D.st||[]).slice().sort((a,b)=>num(b['League Pts'])-num(a['League Pts'])||num(b['Pts For'])-num(a['Pts For']));const i=r.findIndex(x=>x.Team===t);return i<0?'':ORD(i+1)};
const lkMgr=t=>(PROFILE[t]||{}).manager||(TEAMS[t]||{}).mgr||'';
const lkDay=d=>d?d.toLocaleDateString(undefined,{weekday:'short',day:'numeric',month:'short'}):'';
/* win chance: one rounding for every screen (v12-match's largest remainder, so home + draw + away = 100 and the list,
   the matchup page and the team page all show the same number) */
const lkWin=w=>typeof mpxWinPct==='function'?mpxWinPct(w):{h:Math.round(w.h*100),d:Math.round(w.d*100),a:Math.round(w.a*100)};
const lkWinBar=(f,w)=>{const col=t=>(TEAMS[t]||{}).col||'#7C7488';const pc=lkWin(w);
  return '<div class="lkwp"><span class="lkn">'+pc.h+'%</span><div class="lkbar"><i style="width:'+(w.h*100)+'%;background:'+col(f.Home)+'"></i><i style="width:'+(w.d*100)+'%;background:#DDD7E5"></i><i style="width:'+(w.a*100)+'%;background:'+col(f.Away)+'"></i></div><span class="lkn">'+pc.a+'%</span></div>';};
function lkGoMatch(i){const go=()=>{location.hash='gw/'+i;window.scrollTo(0,0)};if(sheet.classList.contains('on')&&typeof fbxCloseAll==='function')fbxCloseAll(go);else go();}

/* ---------- Matchday: your match + the league list ---------- */
bugHTML=function(f,i,o){o=o||{};const S=lkState(f),nm=derbyName(f.Home,f.Away),sr=series(f.Home,f.Away)||'';
  const lo=(a,b)=>(S.st==='ft'||S.st==='prov')&&+a<+b?' lklo':'';
  const w=S.st==='pred'&&typeof hpWin==='function'?hpWin(f):null;const bar=w?lkWinBar(f,w):'';
  if(o.you){const fact=typeof factFor==='function'?factFor(f):'';
    const tr=(t,v,v2)=>'<div class="lktr'+lo(v,v2)+'">'+crestOf(t,40)+'<div class="lknm"><b>'+esc(t)+'</b><span>'+esc(FIRSTOF(t))+' · '+lkRec(t)+lkForm(t)+'</span></div><div class="lkbig lkn">'+v+'</div></div>';
    return '<div class="mcard lkD" data-mi="'+i+'" role="button" tabindex="0"><div class="lkhd">'+esc(nm||'Your match')+'<span class="lkst'+(S.st==='live'?' lklive':'')+'">'+esc(S.cap)+'</span></div>'
     +tr(f.Home,S.l,S.r)+tr(f.Away,S.r,S.l)
     +bar+'<div class="lkwpl"><span>'+(w?'Chance to win':esc(S.sub||''))+'</span><span>'+esc(sr)+'</span></div>'
     +(fact?'<div class="lkfact">'+esc(fact)+'</div>':'')+'</div>';}
  const t=(x,r)=>'<div class="lkt'+(r?' lkr':'')+'">'+crestOf(x,26)+'<b>'+esc(SHORTOF[x]||x)+'</b></div>';
  return '<div class="mcard lkDrow" data-mi="'+i+'" role="button" tabindex="0">'+(nm?'<div class="lkdn">'+esc(nm)+'</div>':'')
   +'<div class="lkln">'+t(f.Home)+'<div class="lks lkn"><span class="'+lo(S.l,S.r).trim()+'">'+S.l+'</span><i>–</i><span class="'+lo(S.r,S.l).trim()+'">'+S.r+'</span></div>'+t(f.Away,1)+'</div>'
   +bar+'<div class="lksub"><span>'+esc(sr)+'</span><span>'+esc(w?'':(S.sub||''))+'</span></div></div>';};

/* ---------- previews and recaps: always on Matchday; under your match while fresh, under the league list when old ---------- */
function lkBooth(body){
  if(!body||body.querySelector('.stage,.lkBooth'))return;
  if(!body.querySelector('.lkDrow,.lkD'))return;
  if(typeof fbxGw==='function'&&fbxGw()!==D.gw)return;
  const items=[];const sc=body.querySelector('.recapcard.show');
  if(sc){const p=PREVIEWS.find(x=>x.gw===D.gw);
    items.push({gw:D.gw,o:-1,h:'<a class="lkrow" data-mxall="1" href="#"><span><span class="lkk">Gameweek '+D.gw+' preview</span><b>'+(p?p.title:'Every matchup and lineup in about a minute')+'</b><span class="lkm">The lineups and talking points, about a minute</span></span><span class="lkgo lkplay">Play</span></a>'});}
  const last=a=>a.slice().sort((x,y)=>y.gw-x.gw)[0];
  [[last(PREVIEWS),'preview',1],[last(RECAPS),'recap',0]].forEach(([a,k,o])=>{if(!a)return;
    items.push({gw:a.gw,o,h:'<a class="lkrow" href="'+a.href+'"><span><span class="lkk">Gameweek '+a.gw+' '+k+'</span><b>'+a.title+'</b><span class="lkm">'+a.sub+'</span></span><span class="lkgo">Read</span></a>'});});
  if(!items.length)return;
  items.sort((a,b)=>b.gw-a.gw||a.o-b.o);
  const fresh=items[0].gw>=D.gw-1;
  if(sc)sc.remove();
  const prog=body.querySelector('.program');if(prog){const h=prog.previousElementSibling;if(h&&h.tagName==='H2')h.remove();prog.remove();}
  const aa=body.querySelector('#allart');if(aa)(aa.closest('h2')||aa).remove();
  const html='<h2 class="v10">Previews and recaps<button type="button" class="lnk" id="allart">All articles</button></h2><div class="lkBooth'+(fresh?' lklead':'')+'">'+items.slice(0,3).map(x=>x.h).join('')+'</div>';
  const hero=body.querySelector('.lkD'),rows=body.querySelector('.lkDrow');
  const anchor=fresh&&hero?hero.closest('.stack'):(rows?rows.closest('.stack'):null);
  if(anchor)anchor.insertAdjacentHTML('afterend',html);
}
function lkMatchday(body){
  const h=[...body.querySelectorAll('h2.v10')].find(x=>/Around the league|^Gameweek/.test(x.textContent));
  const f0=D.fx.filter(f=>num(f.GW)===D.gw)[0];
  if(h&&!h.querySelector('.lnk')&&body.querySelector('.lkDrow')&&f0&&lkState(f0).st==='pred')h.insertAdjacentHTML('beforeend','<span class="lnk lkq">Projected</span>');
  if(body.querySelector('.fbx-pj')){const fh=[...body.querySelectorAll('h2.v10')].find(x=>/^Fixtures/.test(x.textContent));const l=fh&&fh.querySelector('.lnk');if(l&&!/projected/i.test(l.textContent))l.textContent+=' · scores projected';}
  const pa=document.getElementById('plall');if(pa){const t=pa.textContent.trim();if(/^[A-Z ]+$/.test(t))pa.textContent=t.charAt(0)+t.slice(1).toLowerCase();}
}

/* ---------- matchup page: one header, the number said once ---------- */
function lkToggles(root){if(!root)return;root.querySelectorAll('.axtog.om button').forEach(b=>{if(b.textContent.trim()==='Projected')b.textContent='Points'});}
function lkMatchHead(f,dl){
  const st=document.querySelector('#gwbody .stage');if(!st||st.querySelector('.lkMH')||!f)return;
  if(typeof XPMODE!=='undefined'&&XPMODE&&D.hasXP)return;
  const S=lkState(f),nm=derbyName(f.Home,f.Away),sr=series(f.Home,f.Away);
  const sides=[...st.querySelectorAll('.vs .side')];
  const side=(el,t)=>{const rec=el&&el.querySelector('.mpxrec');
    return '<div class="lkt" data-lkprof="'+esc(t)+'">'+crestOf(t,52)+'<b><span class="lkfull">'+esc(t)+'</span><span class="lkshort">'+esc(SHORTOF[t]||t)+'</span></b><span>'+esc(FIRSTOF(t))+'</span>'+(rec?'<span class="lkrec">'+rec.innerHTML.replace(/^\s*([\d-]+)/,'<span class="lknw">$1</span>')+'</span>':'')+'</div>';};
  const when=dl?dl.toLocaleString(undefined,{weekday:'short',day:'numeric',month:'short',hour:'numeric',minute:'2-digit'}):'';
  const stat=S.st==='pred'?'Projected'+(when?' · deadline '+when:''):S.st==='live'?'Live'+(S.sub?' · '+S.sub:''):S.cap+(S.sub?' · '+S.sub:'');
  const html='<div class="lkMH"><div class="lkk">Gameweek '+D.gw+(nm?' · '+esc(nm):'')+'</div><div class="lkrow">'+side(sides[0],f.Home)
   +'<div class="lkc"><div class="lkbig lkn">'+S.l+'<i>–</i>'+S.r+'</div><div class="lkst'+(S.st==='live'?' lklive':'')+'">'+esc(stat)+'</div>'+(sr?'<div class="lkal">'+esc(sr)+'</div>':'')+'</div>'
   +side(sides[1],f.Away)+'</div></div>';
  const anchor=st.querySelector(':scope > .derby')||st.querySelector(':scope > .gwlab')||st.querySelector(':scope > .vs');
  if(!anchor)return;
  anchor.insertAdjacentHTML('beforebegin',html);
  st.querySelectorAll(':scope > .derby,:scope > .gwlab,:scope > .vs,:scope > .scsub,:scope > .series').forEach(x=>x.remove());
  st.querySelector('.lkMH').addEventListener('click',e=>{const t=e.target.closest('[data-lkprof]');if(t){e.stopPropagation();openProfile(t.dataset.lkprof);}});
  const body=document.getElementById('gwbody');lkToggles(body);
  body.querySelectorAll('.teamtag').forEach(tg=>{tg.querySelectorAll('span').forEach(x=>{if(/^\s*projected\s*$/i.test(x.textContent))x.remove()});
    const n=[...tg.childNodes].reverse().find(x=>x.nodeType===3);if(n)n.textContent=n.textContent.replace(/\s*·\s*(projected)?\s*$/i,'');});
  const note=body.querySelector('.asubnote');
  if(note&&/^Projected lineups/.test(note.textContent))note.textContent='Likely lineups until the deadline'+(when?' ('+when+')':'')+'. Managers can still change them.';
}

/* ---------- team page and manager sheet: one header, one next-match card, one schedule ---------- */
function lkNextHTML(team){
  const cur=D.fx.find(x=>num(x.GW)===D.gw&&(x.Home===team||x.Away===team)&&!mscore(x).done);
  const f=cur||(typeof nextFixtureOf==='function'?nextFixtureOf(team):null);if(!f)return '';
  const g=num(f.GW),home=f.Home===team,opp=home?f.Away:f.Home,nm=derbyName(f.Home,f.Away);
  const S=g===D.gw?lkState(f):{st:'pred'};const w=S.st==='pred'&&typeof hpWin==='function'?hpWin(f):null;
  const mine=w?(home?lkWin(w).h:lkWin(w).a):null;
  const me=g===D.gw?(home?S.l:S.r):lk1(hpTeam(team,g)),them=g===D.gw?(home?S.r:S.l):lk1(hpTeam(opp,g));
  const right=S.st==='pred'?'<div class="lkp"><div class="lkn">'+(mine!=null?mine+'%':'')+'</div><span>to win · '+me+' to '+them+'</span></div>'
    :'<div class="lkp"><div class="lkn">'+me+'–'+them+'</div><span>'+esc(S.cap)+'</span></div>';
  return '<div class="lkNext" data-lknext="'+g+'|'+esc(f.Home)+'|'+esc(f.Away)+'"><div class="lkk">'+(g===D.gw&&S.st!=='pred'?'This week':'Next')+' · Gameweek '+g+(gwDeadline(g)?' · '+lkDay(gwDeadline(g)):'')+(nm?' · '+esc(nm):'')+'</div>'
   +'<div class="lkl">'+crestOf(opp,32)+'<div><b>'+(home?'vs ':'at ')+esc(opp)+'</b><span>'+esc(FIRSTOF(opp))+' · '+lkOrd(opp)+' · '+lkRec(opp)+'</span></div>'+right+'</div></div>';
}
function lkSchedHTML(team){
  const all=(D.fx||[]).filter(f=>f.Home===team||f.Away===team).sort((a,b)=>num(a.GW)-num(b.GW));
  const played=all.filter(f=>mscore(f).done&&num(f.GW)<=D.gw),next=all.filter(f=>!played.includes(f)).slice(0,5);
  const row=(f,past)=>{const g=num(f.GW),home=f.Home===team,opp=home?f.Away:f.Home,nm=derbyName(f.Home,f.Away),i=fbxRows(g).indexOf(f);
    let right,sub;
    if(past){const s=mscore(f),me=home?s.hs:s.as2,th=home?s.as2:s.hs,r=me>th?'W':me<th?'L':'D';
      right='<div class="lksc"><u class="lkres'+r+'">'+r+'</u><span class="lkn">'+me+'–'+th+'</span></div>';sub=nm||FIRSTOF(opp);}
    else{const w=typeof hpWin==='function'?hpWin(f):null;
      right='<div class="lkwhen"><span class="lkn">'+(w?(home?lkWin(w).h:lkWin(w).a)+'%':'')+'</span><br>to win</div>';
      sub=lkDay(gwDeadline(g))+(nm?' · '+nm:'');}
    /* full name, with the short name for narrow phones (CSS swaps them under 360px) */
    return '<div class="lkr'+(past?'':' lkfut')+'" data-lks="'+(past?'p':'f')+'|'+g+'|'+i+'"><span class="lkg">GW'+g+'</span>'+crestOf(opp,24)+'<div class="lko"><b>'+(home?'vs ':'at ')+'<span class="lkfull">'+esc(opp)+'</span><span class="lkshort">'+esc(SHORTOF[opp]||opp)+'</span></b><span>'+esc(sub)+'</span></div>'+right+'</div>';};
  return '<h2 class="v10">Schedule<span class="lnk lkq">'+played.length+' played</span></h2><div class="lkSched">'+played.map(f=>row(f,1)).join('')+next.map(f=>row(f,0)).join('')+'</div>';
}
function lkTeam(root,team,page){
  if(!root||!team||root.querySelector('.lkTH'))return;
  const hd=page?root.querySelector('.myhead'):root.querySelector('.sh-x+div');if(!hd)return;
  const cr=hd.querySelector('.cr');const act=hd.querySelector('.profrow');
  const th=document.createElement('div');th.className='lkTH';
  th.innerHTML='<span class="lkcr">'+(cr&&cr.querySelector('img')?cr.innerHTML:crestOf(team,56))+'</span><div><b>'+esc(team)+'</b><span class="lkm">'+esc(lkMgr(team))+' · <strong>'+lkOrd(team)+'</strong> · <span class="lknw">'+lkRec(team)+'</span></span><div class="lkfm">'+lkForm(team)+'</div></div><div class="lkact"></div>';
  if(act)th.querySelector('.lkact').appendChild(act);else th.querySelector('.lkact').remove();
  const img=th.querySelector('.lkcr img');if(img){img.className='lkav';img.removeAttribute('style');}
  hd.replaceWith(th);
  /* the three tiles: points for + best week move into Season numbers, the projection lives in the next-match card */
  const tiles=root.querySelector('.profstats');let pf=null,best=null;
  if(tiles){[...tiles.children].map(x=>({b:(x.querySelector('b')||{}).textContent,s:(x.querySelector('span')||{}).textContent||''}))
    .forEach(x=>{if(/^Points for/.test(x.s))pf=x;if(/^Best GW/.test(x.s))best=x;});tiles.remove();}
  const nl=root.querySelector('.nextline');if(nl)nl.remove();
  th.insertAdjacentHTML('afterend',lkNextHTML(team));
  const wr=root.querySelector('.watchrow');
  if(wr&&!root.querySelector('.lkLineupH'))wr.insertAdjacentHTML('beforebegin','<h2 class="v10 lkLineupH">Lineup</h2>');
  lkToggles(root);
  const tg=root.querySelector('.teamtag2 span');if(tg){const p=tg.textContent.split(' · ');if(p.length>1)tg.textContent=p[1];}
  const tsx=root.querySelector('.tsx');
  if(tsx&&pf){const rk=(pf.s.split(' · ')[1]||'');const bw=best?' · best week '+best.b+' in '+(best.s.split(' · ')[1]||''):'';
    tsx.insertAdjacentHTML('afterbegin','<div class="tsx-row"><div class="tsx-l"><b>Points for</b><span>'+esc(rk?rk+' in the league':'')+esc(bw)+'</span></div><b class="tsx-n num">'+esc(pf.b)+'</b></div>');}
  /* one schedule replaces the results table and the fixtures table */
  const res=root.querySelectorAll('.hist.tres');const fixt=root.querySelector('.card.fixt');
  if(res.length){res[0].insertAdjacentHTML('beforebegin',lkSchedHTML(team));res.forEach(x=>x.remove());}
  const sch=root.querySelector('.lkSched');
  if(fixt&&sch){sch.after(fixt);const fh=fixt.querySelector('#fixh,.fh');if(fh)fh.textContent='Your players’ clubs, next five';}
  root.querySelectorAll('.profcard').forEach(x=>x.remove()); /* the top-scorer card repeated Best pick */
  root.querySelectorAll('.posh2').forEach(x=>{const h=document.createElement('h2');h.className='v10';h.textContent=x.textContent.replace(/, week by week/,'');x.replaceWith(h);});
  root.addEventListener('click',e=>{
    const n=e.target.closest('[data-lknext]');
    if(n){const [g,h,a]=n.dataset.lknext.split('|');const G=+g;
      if(G===D.gw)lkGoMatch(D.fx.filter(f=>num(f.GW)===D.gw).findIndex(f=>f.Home===h&&f.Away===a));else fbxGoGw(G);return;}
    const s=e.target.closest('[data-lks]');
    if(s){const [k,g,i]=s.dataset.lks.split('|');if(k==='p')fbxOpenPast(+g,+i);else if(+g===D.gw)lkGoMatch(+i);else fbxGoGw(+g);}
  });
}


/* ---------- speed: auto-subs and the title odds are pure functions of the loaded data, so compute them once per data load ----------
   (the Premier League strip asked autoSubs ~2,350 times per Matchday render: ~0.5 s on a laptop, several seconds on a phone) */
let lkKeyV=null,lkAS=new Map(),lkSim=null,lkApps=null;
function lkFresh(){const k=[D.ro,D.gwsByGw,D.cf,D.fx,D.gw,D.dlPassed,D.provOver,D.pbonus];
  if(!lkKeyV||k.some((v,i)=>v!==lkKeyV[i])){lkKeyV=k;lkAS=new Map();lkSim=null;lkApps=null;}}
const lk_as=autoSubs;autoSubs=function(team,likely){lkFresh();const key=team+'|'+(likely?1:0);let c=lkAS.get(key);
  if(!c){c=lk_as.call(this,team,likely);lkAS.set(key,c);}return {xi:c.xi.slice(),subs:c.subs.slice()};};
const lk_sim=simulate;simulate=function(){lkFresh();if(!lkSim)lkSim=lk_sim.apply(this,arguments);return lkSim;};

/* ---------- Players: "Average" = points per appearance (it divided everyone by the same gameweek count, so the toggle never changed the order) ---------- */
function lkAppsOf(code){lkFresh();if(!lkApps){lkApps={};Object.values(D.gwsByGw||{}).forEach(g=>Object.entries(g||{}).forEach(([c,r])=>{if(r&&num(r.Mins)>0)lkApps[c]=(lkApps[c]||0)+1;}));}return lkApps[String(code)]||0;}
plrAvg=function(p){return num(p['Season pts'])/Math.max(1,lkAppsOf(p.Code));};
const lk_pr=plrRow;plrRow=function(p){const h=lk_pr.apply(this,arguments);
  if(typeof FATOG!=='undefined'&&FATOG==='avg'&&!(typeof PQUERY!=='undefined'&&PQUERY)){const a=plrAvg(p).toFixed(1),n=lkAppsOf(p.Code);
    return h.replace(/<span class="ptb"><b>[^<]*<\/b><span>[^<]*<\/span><\/span>/,'<span class="ptb"><b>'+a+'</b><span>'+num(p['Season pts'])+' pts · '+n+' '+(n===1?'game':'games')+'</span></span>');}
  return h.replace(/(\d+\.\d) AVG</,'$1 per game<');};

/* ---------- transactions: raw API codes and em dashes never reach the screen ---------- */
function lkFixTx(){(D.tx||[]).forEach(t=>{if(!t||t.__lk)return;let r=String(t.Result||'').trim();
  if(/^[a-z]{1,3}$/.test(r))r='Denied';t.Result=r.replace(/\s*[—–]\s*/g,', ');t.__lk=1;});}

/* ---------- player sheet: the card stays in view on the two-column (desktop) sheet; the projection is said once ---------- */
function lkSheetFix(p){const L=sheet.querySelector('.sh-left');
  sheet.querySelectorAll('.sh-left .fc img').forEach(i=>{i.decoding='sync';i.removeAttribute('loading');});
  if(L&&!L.querySelector(':scope > .lkstick')){const w=document.createElement('div');w.className='lkstick';while(L.firstChild)w.appendChild(L.firstChild);L.appendChild(w);}
  const fx=sheet.querySelector('.fxst');if(fx&&/^Projected/.test(fx.textContent.trim())&&sheet.querySelector('.psx'))fx.remove();
  /* one average: points per game played, the same label and number as the Players list ("8.3 per game").
     The owned strip divided by the gameweek count and said AVG; the free-agent row said "Average per GW". */
  if(p&&p.Code!==undefined){const avg=plrAvg(p).toFixed(1);
    sheet.querySelectorAll('.sh-right .srow').forEach(r=>{const k=r.firstElementChild,v=r.lastElementChild;
      if(k&&v&&k!==v&&/^Average/.test(k.textContent.trim())){k.textContent='Per game';v.textContent=avg;}});
    const tile=[...sheet.querySelectorAll('.sh-left .statgrid.lg .sg')].find(s=>s.firstChild&&s.firstChild.nodeType===3&&s.firstChild.textContent.trim()==='AVG');
    if(tile){const pool=D.ro.filter(r=>r.Pos===p.Pos).map(r=>plrAvg(r));const pc=typeof pctRank==='function'?pctRank(plrAvg(p),pool):null;
      tile.firstChild.textContent='PER GAME';const b=tile.querySelector('b');if(b)b.textContent=avg;
      if(pc!==null){const bar=tile.querySelector('.bar i');if(bar)bar.style.width=Math.max(2,pc)+'%';const e=tile.querySelector('.pc');if(e)e.textContent=ORD(pc)+' pct';}}}}
/* the page behind an open sheet stays put: html/body stop scrolling while the sheet shows (any opener, any closer:
   the class on #sheet is the one signal they all share); the sheet keeps its own scroll, the overlay swallows touches */
(function(){if(typeof MutationObserver==='undefined'||typeof sheet==='undefined')return;
  const sync=()=>document.documentElement.classList.toggle('lk-lock',sheet.classList.contains('on'));
  new MutationObserver(sync).observe(sheet,{attributes:true,attributeFilter:['class']});sync();})();

/* ---------- Lab: sentence-case scope tabs, short names in the luck index ---------- */
function lkLab(){const v=document.getElementById('v-ana');if(!v)return;
  v.querySelectorAll('.labseg button').forEach(b=>{const t=b.textContent.trim();if(t==='MANAGERS')b.textContent='Managers';if(t==='LEAGUE')b.textContent='League';});
  v.querySelectorAll('.lucks .lrow2[data-prof]').forEach(r=>{const m=r.querySelector('.lmid');const t=r.dataset.prof;if(m&&SHORTOF[t])m.textContent=SHORTOF[t];});}

/* ---------- sign-in wording: a claimed team is signed into, not claimed ----------
   One answer to "is this team claimed?" for the header button AND the sheet (openClaim's mode() asks authIsClaimed):
   the server's list once the status call has returned, a saved profile until then (a profile only exists after a claim). */
authIsClaimed=function(team){const cl=typeof authClaimedList==='function'?authClaimedList():null;
  return cl?cl.indexOf(team)>-1:!!(team&&PROFILE[team]);};
profileButtonHTML=function(){const mine=myTeam();
  if(mine&&AUTH.team()===mine)return '<button class="watch" data-claim="1">Edit team</button>';
  return '<button class="watch" data-claim="1">'+(mine&&authIsClaimed(mine)?'Sign in':'Claim your team')+'</button>';};

/* ---------- fixture difficulty: same five steps, no neon ---------- */
Object.assign(FDRCOL,{1:'#CFEBDA',2:'#CFEBDA',3:'#EEEBF2',4:'#F4CACD',5:'#B3303A'});
Object.assign(FDRTXT,{1:'#14532D',2:'#14532D',3:'#3B3346',4:'#7A1A20',5:'#FFFFFF'});

/* ---------- keyboard: a focused matchup card (Matchday list, your match, derby card) opens on Enter or Space ---------- */
(function(){const body=document.getElementById('gwbody');if(!body||body.__lkKey)return;body.__lkKey=1;
  body.addEventListener('keydown',e=>{if(e.key!=='Enter'&&e.key!==' ')return;const c=e.target.closest('[data-mi][tabindex]');
    if(!c||e.target.closest('a,button,input'))return;e.preventDefault();location.hash='gw/'+c.dataset.mi;});})();
/* ---------- header: the account icon is a real button (was a 28px span with an onclick: not focusable, under 40px) ---------- */
(function(){const s=document.getElementById('hav');if(!s||s.tagName==='BUTTON')return;
  const b=document.createElement('button');b.type='button';b.className='hav';b.id='hav';b.title='My team';b.setAttribute('aria-label','My team');
  b.innerHTML=s.innerHTML;s.replaceWith(b);b.onclick=()=>{location.hash='team'};})();

/* ---------- wire it in (outermost wrappers) ---------- */
const lk_uh=updateHeader;updateHeader=function(){const r=lk_uh.apply(this,arguments);const i=document.querySelector('#hav img');if(i)i.style.boxShadow='0 0 0 2px #CDBDF0';return r;};
const lk_rg=renderGW;renderGW=function(){const r=lk_rg.apply(this,arguments);try{const body=document.getElementById('gwbody');lkBooth(body);lkMatchday(body);}catch(e){console.error(e)}return r;};
const lk_rm=renderMatch;renderMatch=function(f,dl){const r=lk_rm.apply(this,arguments);try{lkMatchHead(f,dl)}catch(e){console.error(e)}return r;};
const lk_rt=renderTeam;renderTeam=function(){lkFixTx();const r=lk_rt.apply(this,arguments);try{lkTeam(document.getElementById('teampage'),myTeam(),1)}catch(e){console.error(e)}return r;};
const lk_op=openProfile;openProfile=function(team,intoEl){lkFixTx();const r=lk_op.apply(this,arguments);if(!intoEl){try{lkTeam(sheet.querySelector('.sh-right'),team,0)}catch(e){console.error(e)}}return r;};
const lk_os=openSheet;openSheet=function(){const r=lk_os.apply(this,arguments);try{lkSheetFix(arguments[0])}catch(e){console.error(e)}return r;};
const lk_rx=renderXIs;renderXIs=function(){lkFixTx();return lk_rx.apply(this,arguments);};
const lk_rtb=renderTable;renderTable=function(){const r=lk_rtb.apply(this,arguments);try{document.querySelectorAll('#tablebody details.acc').forEach(d=>{const m=d.querySelector('summary');if(m&&m.textContent.trim()==='Upcoming fixtures')d.remove();});}catch(e){}return r;}; /* the gameweek browser already shows every future week */
const lk_ra=renderAna;renderAna=function(){const r=lk_ra.apply(this,arguments);try{lkLab()}catch(e){console.error(e)}return r;};
const lk_rl=renderLab;renderLab=function(){const r=lk_rl.apply(this,arguments);try{lkLab()}catch(e){console.error(e)}return r;}; /* every Lab tap re-runs renderLab alone, which wrote the capitals back */
(function(){const p=document.getElementById('gwpill');if(!p||typeof MutationObserver==='undefined')return;
  const fix=()=>{const m=/^GW(\d+) · (\d+d \d+h|\d+h \d+m|\d+m)$/.exec(p.textContent.trim());if(m)p.textContent='Deadline '+m[2];};
  new MutationObserver(fix).observe(p,{childList:true,characterData:true,subtree:true});fix();})();
if(D.ro&&D.ro.length){try{renderGW();renderTeam();renderTable();updateHeader();}catch(e){}}
})();

/* sheet images on iPhone (4 Oct) */
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

