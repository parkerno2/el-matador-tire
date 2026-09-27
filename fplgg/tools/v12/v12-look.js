/* ===== v12-look: the approved D2 design (27 Sep 2026) =====
   Archivo for words, Barlow Condensed for numbers, ink + lavender ground, purple used sparingly, Mono badges.
   Layout: Matchday hero + one league list + previews and recaps; one matchup header; team page / manager sheet
   rebuilt around a next-match card and one schedule. Plate cards, pitch and the Matchweek wordmark are untouched.
   Every top-level name is inside the IIFE; the only globals replaced are crestSVG, bugHTML and the render wrappers. */
(function(){
const lkPc=x=>Math.round(x*100)+'%';
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
crestSVG=function(m,size,opt){
  size=size||64;const t=CREST[m];if(!t)return '';const o=opt||{};
  const s=LK_PAL[lkPidOf(o.c1||t.c1,m)]||LK_PAL.royal;const sh=SHAPE_BY[o.shape||t.shape||'shield']||SHAPES[0];
  const useIni=o.emblem!==undefined?o.emblem==='initials':t.useIni===true;
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
const lkWinBar=(f,w)=>{const col=t=>(TEAMS[t]||{}).col||'#7C7488';
  return '<div class="lkwp"><span class="lkn">'+lkPc(w.h)+'</span><div class="lkbar"><i style="width:'+(w.h*100)+'%;background:'+col(f.Home)+'"></i><i style="width:'+(w.d*100)+'%;background:#DDD7E5"></i><i style="width:'+(w.a*100)+'%;background:'+col(f.Away)+'"></i></div><span class="lkn">'+lkPc(w.a)+'</span></div>';};
function lkGoMatch(i){const go=()=>{location.hash='gw/'+i;window.scrollTo(0,0)};if(sheet.classList.contains('on')&&typeof fbxCloseAll==='function')fbxCloseAll(go);else go();}

/* ---------- Matchday: your match + the league list ---------- */
bugHTML=function(f,i,o){o=o||{};const S=lkState(f),nm=derbyName(f.Home,f.Away),sr=series(f.Home,f.Away)||'';
  const lo=(a,b)=>(S.st==='ft'||S.st==='prov')&&+a<+b?' lklo':'';
  const w=S.st==='pred'&&typeof hpWin==='function'?hpWin(f):null;const bar=w?lkWinBar(f,w):'';
  if(o.you){const fact=typeof factFor==='function'?factFor(f):'';
    const tr=(t,v,v2)=>'<div class="lktr'+lo(v,v2)+'">'+crestOf(t,40)+'<div class="lknm"><b>'+esc(t)+'</b><span>'+esc(FIRSTOF(t))+' · '+lkRec(t)+lkForm(t)+'</span></div><div class="lkbig lkn">'+v+'</div></div>';
    return '<div class="mcard lkD" data-mi="'+i+'"><div class="lkhd">'+esc(nm||'Your match')+'<span class="lkst'+(S.st==='live'?' lklive':'')+'">'+esc(S.cap)+'</span></div>'
     +tr(f.Home,S.l,S.r)+tr(f.Away,S.r,S.l)
     +bar+'<div class="lkwpl"><span>'+(w?'Chance to win':esc(S.sub||''))+'</span><span>'+esc(sr)+'</span></div>'
     +(fact?'<div class="lkfact">'+esc(fact)+'</div>':'')+'</div>';}
  const t=(x,r)=>'<div class="lkt'+(r?' lkr':'')+'">'+crestOf(x,26)+'<b>'+esc(SHORTOF[x]||x)+'</b></div>';
  return '<div class="mcard lkDrow" data-mi="'+i+'">'+(nm?'<div class="lkdn">'+esc(nm)+'</div>':'')
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
  const html='<h2 class="v10">Previews and recaps<span class="lnk" id="allart">All articles</span></h2><div class="lkBooth'+(fresh?' lklead':'')+'">'+items.slice(0,3).map(x=>x.h).join('')+'</div>';
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
  const mine=w?(home?w.h:w.a):null;
  const me=g===D.gw?(home?S.l:S.r):lk1(hpTeam(team,g)),them=g===D.gw?(home?S.r:S.l):lk1(hpTeam(opp,g));
  const right=S.st==='pred'?'<div class="lkp"><div class="lkn">'+(mine!=null?lkPc(mine):'')+'</div><span>to win · '+me+' to '+them+'</span></div>'
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
      right='<div class="lkwhen"><span class="lkn">'+(w?lkPc(home?w.h:w.a):'')+'</span><br>to win</div>';
      sub=lkDay(gwDeadline(g))+(nm?' · '+nm:'');}
    return '<div class="lkr'+(past?'':' lkfut')+'" data-lks="'+(past?'p':'f')+'|'+g+'|'+i+'"><span class="lkg">GW'+g+'</span>'+crestOf(opp,24)+'<div class="lko"><b>'+(home?'vs ':'at ')+esc(opp)+'</b><span>'+esc(sub)+'</span></div>'+right+'</div>';};
  return '<h2 class="v10">Schedule<span class="lnk lkq">'+played.length+' played</span></h2><div class="lkSched">'+played.map(f=>row(f,1)).join('')+next.map(f=>row(f,0)).join('')+'</div>';
}
function lkTeam(root,team,page){
  if(!root||!team||root.querySelector('.lkTH'))return;
  const hd=page?root.querySelector('.myhead'):root.querySelector('.sh-x+div');if(!hd)return;
  const cr=hd.querySelector('.cr');const act=hd.querySelector('.profrow');
  const th=document.createElement('div');th.className='lkTH';
  th.innerHTML='<span class="lkcr">'+(cr&&cr.querySelector('img')?cr.innerHTML:crestOf(team,56))+'</span><div><b>'+esc(team)+'</b><span class="lkm">'+esc(lkMgr(team))+' · <strong>'+lkOrd(team)+'</strong> · '+lkRec(team)+'</span><div class="lkfm">'+lkForm(team)+'</div></div><div class="lkact"></div>';
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
function lkSheetFix(){const L=sheet.querySelector('.sh-left');
  if(L&&!L.querySelector(':scope > .lkstick')){const w=document.createElement('div');w.className='lkstick';while(L.firstChild)w.appendChild(L.firstChild);L.appendChild(w);}
  const fx=sheet.querySelector('.fxst');if(fx&&/^Projected/.test(fx.textContent.trim())&&sheet.querySelector('.psx'))fx.remove();}

/* ---------- Lab: sentence-case scope tabs, short names in the luck index ---------- */
function lkLab(){const v=document.getElementById('v-ana');if(!v)return;
  v.querySelectorAll('.labseg button').forEach(b=>{const t=b.textContent.trim();if(t==='MANAGERS')b.textContent='Managers';if(t==='LEAGUE')b.textContent='League';});
  v.querySelectorAll('.lucks .lrow2[data-prof]').forEach(r=>{const m=r.querySelector('.lmid');const t=r.dataset.prof;if(m&&SHORTOF[t])m.textContent=SHORTOF[t];});}

/* ---------- sign-in wording: a claimed team is signed into, not claimed ---------- */
profileButtonHTML=function(){const mine=myTeam();
  if(mine&&AUTH.team()===mine)return '<button class="watch" data-claim="1">Edit team</button>';
  const cl=typeof authClaimedList==='function'?authClaimedList():null;
  const claimed=mine&&((cl&&cl.indexOf(mine)>-1)||!!PROFILE[mine]);
  return '<button class="watch" data-claim="1">'+(claimed?'Sign in':'Claim your team')+'</button>';};

/* ---------- fixture difficulty: same five steps, no neon ---------- */
Object.assign(FDRCOL,{1:'#CFEBDA',2:'#CFEBDA',3:'#EEEBF2',4:'#F4CACD',5:'#B3303A'});
Object.assign(FDRTXT,{1:'#14532D',2:'#14532D',3:'#3B3346',4:'#7A1A20',5:'#FFFFFF'});

/* ---------- wire it in (outermost wrappers) ---------- */
const lk_uh=updateHeader;updateHeader=function(){const r=lk_uh.apply(this,arguments);const i=document.querySelector('#hav img');if(i)i.style.boxShadow='0 0 0 2px #CDBDF0';return r;};
const lk_rg=renderGW;renderGW=function(){const r=lk_rg.apply(this,arguments);try{const body=document.getElementById('gwbody');lkBooth(body);lkMatchday(body);}catch(e){console.error(e)}return r;};
const lk_rm=renderMatch;renderMatch=function(f,dl){const r=lk_rm.apply(this,arguments);try{lkMatchHead(f,dl)}catch(e){console.error(e)}return r;};
const lk_rt=renderTeam;renderTeam=function(){lkFixTx();const r=lk_rt.apply(this,arguments);try{lkTeam(document.getElementById('teampage'),myTeam(),1)}catch(e){console.error(e)}return r;};
const lk_op=openProfile;openProfile=function(team,intoEl){lkFixTx();const r=lk_op.apply(this,arguments);if(!intoEl){try{lkTeam(sheet.querySelector('.sh-right'),team,0)}catch(e){console.error(e)}}return r;};
const lk_os=openSheet;openSheet=function(){const r=lk_os.apply(this,arguments);try{lkSheetFix()}catch(e){console.error(e)}return r;};
const lk_rx=renderXIs;renderXIs=function(){lkFixTx();return lk_rx.apply(this,arguments);};
const lk_rtb=renderTable;renderTable=function(){const r=lk_rtb.apply(this,arguments);try{document.querySelectorAll('#tablebody details.acc').forEach(d=>{const m=d.querySelector('summary');if(m&&m.textContent.trim()==='Upcoming fixtures')d.remove();});}catch(e){}return r;}; /* the gameweek browser already shows every future week */
const lk_ra=renderAna;renderAna=function(){const r=lk_ra.apply(this,arguments);try{lkLab()}catch(e){console.error(e)}return r;};
(function(){const p=document.getElementById('gwpill');if(!p||typeof MutationObserver==='undefined')return;
  const fix=()=>{const m=/^GW(\d+) · (\d+d \d+h|\d+h \d+m|\d+m)$/.exec(p.textContent.trim());if(m)p.textContent='Deadline '+m[2];};
  new MutationObserver(fix).observe(p,{childList:true,characterData:true,subtree:true});fix();})();
if(D.ro&&D.ro.length){try{renderGW();renderTeam();renderTable();updateHeader();}catch(e){}}
})();
