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
      if(a!==null&&b!==null&&isFinite(a)&&isFinite(b))mid='<span class="fbx-sc fbx-pj"><span class="fbx-n"><b>'+fmt1(a)+'</b><i>–</i><b>'+fmt1(b)+'</b></span><small>Projected</small></span>';}
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
    return '<div class="fbx-pl'+(bn?' fbx-bn':'')+(tp?' fbx-top':'')+'" data-fbxpc="'+esc(r.Code)+'" role="button" tabindex="0">'
     +'<span class="fbx-ps">'+esc(r.Pos)+'</span>'+badgeImg(r.Club,14)+'<span class="fbx-pn">'+esc(r.Player)+'</span>'
     +(tp?'<span class="fbx-tp">Top</span>':'')+'<b class="fbx-pt">'+p+'</b></div>';};
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
