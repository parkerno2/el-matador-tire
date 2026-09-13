/* ===== v10 · Matchday sub-tabs: This week | Derbies =====
   The Derbies tab lists every named rivalry (MATCH map) with the all-time series, the last result and the next
   meeting, plus the still-unnamed pairings. Tap a derby that plays this week to open the matchup. ===== */
let GWTAB='week';
function derbyRows(){
  const teams=Object.keys(TEAMS);const out=[];
  for(let i=0;i<teams.length;i++)for(let j=i+1;j<teams.length;j++){
    const a=teams[i],b=teams[j];const nm=derbyName(a,b);
    const fx=D.fx.filter(f=>(f.Home===a&&f.Away===b)||(f.Home===b&&f.Away===a)).sort((p,q)=>num(p.GW)-num(q.GW));
    const played=fx.filter(f=>fin(f.Finished));const last=played[played.length-1]||null;
    const thisGw=fx.find(f=>num(f.GW)===D.gw)||null;
    const next=fx.find(f=>num(f.GW)>D.gw)||null;
    out.push({a,b,nm,last,thisGw,next,sr:series(a,b),n:fx.length,played:played.length});
  }
  const rank=r=>r.thisGw?0:r.next?1:2;
  out.sort((p,q)=>(p.nm?0:1)-(q.nm?0:1)||rank(p)-rank(q)||(p.next?num(p.next.GW):99)-(q.next?num(q.next.GW):99)||p.a.localeCompare(q.a));
  return out;
}
function derbyMeta(r){
  const bits=[];
  if(r.thisGw){const {st,nums,lab}=mxScore(r.thisGw);const h=r.thisGw.Home,a=r.thisGw.Away;
    bits.push('<b class="now">This week</b> · '+esc(FIRSTOF(h))+' <span class="num">'+nums[0]+'</span> – <span class="num">'+nums[1]+'</span> '+esc(FIRSTOF(a))+' <i>'+esc(lab)+'</i>');}
  else if(r.next){const d=gwDeadline(num(r.next.GW));bits.push('<b>Next</b> · GW'+num(r.next.GW)+(d?' · '+esc(d.toLocaleDateString([], {weekday:'short',month:'short',day:'numeric'})):''));}
  else bits.push('<b>Next</b> · not scheduled this season');
  if(r.last&&!(r.thisGw&&r.last===r.thisGw)){const hp=num(r.last['Home pts']),ap=num(r.last['Away pts']);const w=hp===ap?'draw':(hp>ap?FIRSTOF(r.last.Home):FIRSTOF(r.last.Away))+' won';
    bits.push('<b>Last</b> · GW'+num(r.last.GW)+' · <span class="num">'+hp+'–'+ap+'</span> '+esc(w));}
  return bits.join('<span class="dot">·</span>');
}
function derbyCard(r,idx){
  const rowsGw=D.fx.filter(x=>num(x.GW)===D.gw);const mi=r.thisGw?rowsGw.indexOf(r.thisGw):-1;
  const A=(TEAMS[r.a]||{}).col||'#5B1A66',B=(TEAMS[r.b]||{}).col||'#5B1A66';
  const side=(t,cls)=>'<div class="ds '+cls+'"><span class="cr">'+crestOf(t,40)+'</span><b>'+esc(t)+'</b><i>'+esc(FIRSTOF(t))+'</i></div>';
  return '<div class="dcard'+(r.thisGw?' live':'')+(r.nm?'':' unnamed')+'"'+(mi>=0?' data-mi="'+mi+'" role="button" tabindex="0"':'')+' style="--a:'+A+';--b:'+B+'">'
   +'<div class="dk">'+(r.nm?esc(r.nm):'Unnamed pairing')+(mi>=0?'<span class="go">Open '+CHEV+'</span>':'')+'</div>'
   +'<div class="dvs">'+side(r.a,'l')+'<div class="dsr"><span class="k">All-time</span><b>'+esc(r.sr||'First ever meeting')+'</b><i>'+(r.played?r.played+(r.played===1?' meeting':' meetings')+' this season':'')+'</i></div>'+side(r.b,'r')+'</div>'
   +'<div class="dm">'+derbyMeta(r)+'</div></div>';
}
function derbiesHTML(){
  const rows=derbyRows();const named=rows.filter(r=>r.nm),un=rows.filter(r=>!r.nm);
  const thisWeek=named.filter(r=>r.thisGw).length;
  return '<h2 class="v10">The derbies<span class="lnk hst">'+named.length+' named'+(thisWeek?' · '+thisWeek+' this week':'')+'</span></h2>'
   +'<div class="stack derbies">'+named.map(derbyCard).join('')+'</div>'
   +(un.length?'<details class="acc dun"><summary>Still unnamed · '+un.length+' pairings — the naming committee has work to do</summary><div class="stack derbies">'+un.map(derbyCard).join('')+'</div></details>':'');
}
function gwTabsHTML(){
  return '<div class="gwtabs"><button class="'+(GWTAB==='week'?'on':'')+'" data-gwtab="week">Gameweek '+D.gw+'</button><button class="'+(GWTAB==='derbies'?'on':'')+'" data-gwtab="derbies">Derbies</button></div>';
}
(function(){
  const __rs=renderScoreboard;
  renderScoreboard=function(rows,dl){
    __rs.apply(this,arguments);
    const body=document.getElementById('gwbody');if(!body)return;
    if(GWTAB==='derbies'){body.innerHTML=gwTabsHTML()+derbiesHTML();
      body.onclick=e=>{const t=e.target.closest('[data-gwtab]');if(t){GWTAB=t.dataset.gwtab;renderGW();return}
        const c=e.target.closest('.dcard[data-mi]');if(c){location.hash='gw/'+c.dataset.mi;}};
      v10clock&&v10clock();return;}
    body.insertAdjacentHTML('afterbegin',gwTabsHTML());
    const prev=body.onclick;
    body.onclick=e=>{const t=e.target.closest('[data-gwtab]');if(t){GWTAB=t.dataset.gwtab;renderGW();return}if(prev)return prev.call(body,e);};
  };
})();
