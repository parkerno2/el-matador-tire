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
  rows.push(tsxRow('Close games',C.n?tsxRec(C):'0',C.n?'Matchups decided by '+C.margin+' or fewer':'No matchup decided by '+C.margin+' or fewer yet'));
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
