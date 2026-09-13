/* ===== v10 — Matchday frame. Overrides declared after the app script; everything else untouched. ===== */
/*CREST*/

function crestOf(team,size){const m=TEAMS[team]&&TEAMS[team].ini;return m?crestSVG(m,size||38):''}
mg=(name,sm)=>{const t=TEAMS[name];if(!t)return'';return '<span class="mg cr'+(sm?' sm':'')+'">'+crestSVG(t.ini,sm?26:38)+'</span>'};
const FIRSTOF=t=>FIRST[(TEAMS[t]||{}).ini]||((TEAMS[t]||{}).mgr||'').split(' ')[0]||t;
const SHORTOF={'Cold Palmers':'Palmers','Trophy Hunters':'Trophy','The Soaring Gulls':'Gulls','Devils U21s':'Devils','I Am a Baleba':'Baleba','Kobbie Mainoo Fan':'Mainoo','Team Jacob':'Jacob','In It to McGinn It':'McGinn'};
const LIGHTCOL=t=>{const c=(TEAMS[t]||{}).col||'#5B1A66';const n=parseInt(c.slice(1),16);const r=n>>16,g=(n>>8)&255,b=n&255;return (r*299+g*587+b*114)/1000>170};
const shadeHex=(hex,f)=>{const n=parseInt(hex.slice(1),16);const d=x=>Math.round(x*(1-f));return '#'+[d(n>>16),d((n>>8)&255),d(n&255)].map(x=>x.toString(16).padStart(2,'0')).join('')};
const rgba=(hex,a)=>{const n=parseInt(hex.slice(1),16);return 'rgba('+(n>>16)+','+((n>>8)&255)+','+(n&255)+','+a+')'};
const CHEV='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>';
const CHEVD='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';

/* ---- nav: five tabs; the manual (FAQ) moves to the header ---- */
const V10_VIEWS=[['gw','Matchday','M13 2 3 14h7l-1 8 10-12h-7l1-8z'],
['team','My team','M8 3 4 6l2 4 2-1v12h8V9l2 1 2-4-4-3-2 2h-4L8 3z'],
['table','Table','M6 3h12v4a6 6 0 0 1-12 0V3zM3 5h3M18 5h3M9 21h6M12 13v8'],
['xis','Players','M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3'],
['ana','Lab','M10 3h4M11 3v6L5 20h14l-6-11V3M7.5 15h9']];
function buildNav(){
  document.getElementById('nav').innerHTML=V10_VIEWS.map(v=>
   '<button data-v="'+v[0]+'"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="'+v[2]+'"/></svg><span>'+v[1]+'</span><span class="bar"></span></button>').join('');
  document.getElementById('nav').onclick=e=>{const b=e.target.closest('[data-v]');if(b)location.hash=b.dataset.v;};
  const top=document.querySelector('.top .in')||document.querySelector('.top');
  if(top&&!document.getElementById('hfaq')){
    top.insertAdjacentHTML('beforeend','<button class="hbtn" id="hfaq" aria-label="How it works">?</button><span class="hav" id="hav" title="My team"></span>');
    document.getElementById('hfaq').onclick=()=>{location.hash='faq'};
    document.getElementById('hav').onclick=()=>{location.hash='team'};
  }
  updateHeader();
}
function heroCopy(){const k=document.querySelector('#v-gw .hero .kick'),h=document.querySelector('#v-gw .hero h1');if(k)k.textContent='Gameweek '+(D.gw||'');if(h)h.textContent='Matchday';const a=document.querySelector('#v-ana .hero h1');if(a)a.textContent='The Lab';}
function updateHeader(){
  const hv=document.getElementById('hav');if(!hv)return;
  const mine=myTeam();
  hv.innerHTML=mine?crestOf(mine,28):'<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#C9B8D6" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21v-.5a8 8 0 0 1 16 0v.5"/></svg>';
}
/* ---- the league clock: the header pill states the present tense ---- */
function v10clock(){
  const p=document.getElementById('gwpill');if(!p||!D.mw||!D.mw.length)return;
  const dl=gwDeadline(D.gw);
  if(!D.dlPassed&&dl){const ms=dl-Date.now();
    if(ms>0){const d2=Math.floor(ms/864e5),h=Math.floor(ms%864e5/36e5),m=Math.floor(ms%36e5/6e4);
      p.textContent='GW'+D.gw+' · '+(d2>0?d2+'d '+h+'h':h>0?h+'h '+m+'m':m+'m');p.className='gwpill';}}
}
setInterval(v10clock,30000);

/* ---- form: this season's results, padded with last season's tail (2025/26 sheet) ---- */
const LAST_TAIL={'Cold Palmers':'LWL','The Soaring Gulls':'LWL','Devils U21s':'LWW','I Am a Baleba':'WLL','Trophy Hunters':'WLW','Kobbie Mainoo Fan':'WLW'};
function formOf(team){
  const res=[];
  D.fx.filter(f=>fin(f.Finished)&&(f.Home===team||f.Away===team)).sort((a,b)=>num(a.GW)-num(b.GW)).forEach(f=>{
    const me=f.Home===team?num(f['Home pts']):num(f['Away pts']),op=f.Home===team?num(f['Away pts']):num(f['Home pts']);
    res.push(me>op?'W':me<op?'L':'D')});
  let s=(LAST_TAIL[team]||'')+res.join('');s=s.slice(-5);while(s.length<5)s='-'+s;return s;
}
const formHTML=(team,cls)=>'<div class="form '+(cls||'')+'">'+[...formOf(team)].map(x=>'<span class="'+(x==='-'?'N':x)+'">'+(x==='-'?'':x)+'</span>').join('')+'</div>';

/* ---- one data-true sentence per matchup ---- */
const ORD=n=>n+(['th','st','nd','rd'][(n%100>>3^1&&n%10)||0]||'th');
function factFor(f){
  const st=D.st.slice().sort((a,b)=>num(b['League Pts'])-num(a['League Pts'])||num(b['Pts For'])-num(a['Pts For']));
  const pfRank=st.slice().sort((a,b)=>num(b['Pts For'])-num(a['Pts For']));
  const row=t=>D.st.find(s=>s.Team===t)||{};
  const rk=t=>pfRank.findIndex(s=>s.Team===t)+1;
  const played=t=>num(row(t).W)+num(row(t).D)+num(row(t).L);
  if(!played(f.Home)&&!played(f.Away))return '';
  const unb=[f.Home,f.Away].filter(t=>played(t)>0&&num(row(t).L)===0);
  if(unb.length===2)return 'Both unbeaten. Someone’s run ends this week.';
  if(unb.length===1){const o=unb[0]===f.Home?f.Away:f.Home;return FIRSTOF(unb[0])+' is unbeaten. '+FIRSTOF(o)+' has the '+ORD(rk(o))+'-best points for ('+num(row(o)['Pts For'])+').';}
  let best=null;
  D.fx.forEach(x=>{if(!fin(x.Finished))return;[[x.Home,num(x['Home pts']),num(x.GW)],[x.Away,num(x['Away pts']),num(x.GW)]].forEach(([n,p,g])=>{if((n===f.Home||n===f.Away)&&(!best||p>best.p))best={n,p,g}})});
  const a=rk(f.Home),b=rk(f.Away);
  const hi=a<b?f.Home:f.Away,lo=a<b?f.Away:f.Home;
  return FIRSTOF(hi)+' has the '+ORD(Math.min(a,b))+'-best points for; '+FIRSTOF(lo)+' the '+ORD(Math.max(a,b))+(best?'. Season best between them: '+FIRSTOF(best.n)+'’s '+best.p+' in GW'+best.g:'')+'.';
}

/* ---- the score bug ---- */
function bugState(f){const s=mscore(f);return s.done?'ft':D.provOver?'prov':s.liveNow?'live':'pred'}
function watchLabel(f){const s=mscore(f);return s.done||D.provOver?'Watch the matchup':xiOf(f.Home).concat(xiOf(f.Away)).every(p=>fxStarted(p.Club))?'Watch the matchup':'Watch the preview'}
function bugHTML(f,i,o){
  o=o||{};
  const s=mscore(f),nm=derbyName(f.Home,f.Away),sr=series(f.Home,f.Away);
  let st,nums,lab;
  if(s.done||D.provOver){st=s.done?'ft':'prov';nums=[s.hs,s.as2];lab=D.hasXP?'xP '+fmt1(teamXP(f.Home))+' – '+fmt1(teamXP(f.Away)):(s.done?'Full time':'Provisional');}
  else if(s.liveNow){st='live';nums=[s.hs,s.as2];lab=D.hasEP?'Proj final '+fmt1(teamProj(f.Home))+' – '+fmt1(teamProj(f.Away)):'Live';}
  else{st='pred';nums=D.hasEP?[fmt1(teamProj(f.Home)),fmt1(teamProj(f.Away))]:['–','–'];lab='Predicted';}
  const tag={pred:'<span class="tg">Predicted</span>',live:'<span class="tg live">● Live</span>',prov:'<span class="tg prov">Provisional</span>',ft:'<span class="tg ft">Full time</span>'}[st];
  const winL=st==='ft'&&+nums[0]>+nums[1],winR=st==='ft'&&+nums[1]>+nums[0];
  const H=(TEAMS[f.Home]||{}).col||'#5B1A66',A=(TEAMS[f.Away]||{}).col||'#5B1A66';
  const bg='radial-gradient(120% 90% at 0% 0%,'+rgba(H,.42)+',transparent 55%),radial-gradient(120% 90% at 100% 100%,'+rgba(A,.42)+',transparent 55%),linear-gradient(140deg,#4A1260 0%,#34104E 48%,#20104A 100%)';
  const flank=(t,r)=>{const c=(TEAMS[t]||{}).col||'#5B1A66';
    return '<div class="fl'+(r?' r':'')+(LIGHTCOL(t)?' dark':'')+'" style="background:linear-gradient('+(r?'270deg':'90deg')+','+c+','+shadeHex(c,.3)+')"><span class="cr">'+crestOf(t,34)+'</span>'
     +'<span class="nm"><span class="sn">'+esc(SHORTOF[t]||t)+'</span><span class="mn">'+esc(FIRSTOF(t))+'</span></span></div>';};
  const fact=factFor(f);
  return '<div class="mcard bug" data-mi="'+i+'" style="background:'+bg+' !important">'
   +'<div class="brow">'+(nm?'<span class="dname">'+esc(nm)+'</span>':'<span class="dname none">Gameweek '+D.gw+'</span>')
   +'<span class="tags">'+(o.you?'<span class="tg you">You</span>':'')+(o.noTag?'':tag)+'</span></div>'
   +'<div class="bar">'+flank(f.Home,false)
   +'<div class="mid"><div class="sc"><span class="'+(winL?'win':'')+'">'+nums[0]+'</span><i>–</i><span class="'+(winR?'win':'')+'">'+nums[1]+'</span></div><span class="lab'+(st==='live'?' live':'')+'">'+lab+'</span></div>'
   +flank(f.Away,true)+'</div>'
   +'<div class="frow">'+formHTML(f.Home)+'<span class="srs">'+esc(sr||'')+'</span>'+formHTML(f.Away,'r')+'</div>'

   +(fact?(o.open?'<div class="fact open">'+CHEVD+'<span>'+esc(fact)+'</span></div>':'<div class="fact">'+CHEV+'<span>'+esc(fact)+'</span></div>'):'')
   +'</div>';
}
function renderScoreboard(rows,dl){
  SUBMARK={};
  const mine=myTeam();
  const order=rows.map((f,i)=>i).sort((a,b)=>{const ma=mine&&(rows[a].Home===mine||rows[a].Away===mine)?0:1,mb=mine&&(rows[b].Home===mine||rows[b].Away===mine)?0:1;return ma-mb||a-b});
  const cc=contentCardsHTML();
  let html='';
  if(D.provOver)html+='<div class="provnote" style="margin-top:12px"><b>All matches finished — provisional result.</b> '+(Object.keys(D.pbonus||{}).length?'Estimated bonus (from live BPS) is counted. ':'')+'FPL usually confirms within a few hours.</div>';
  const first=order[0];
  const yours=mine&&(rows[first].Home===mine||rows[first].Away===mine);
  const sts=rows.map(f=>bugState(f));const uniform=sts.every(x=>x===sts[0]);
  const stTag={pred:'',live:'<span class="tg live">● Live</span>',prov:'<span class="tg prov">Provisional</span>',ft:'<span class="tg ft">Full time</span>'}[sts[0]]||'';
  const p3=(typeof PREVIEWS!=='undefined'?PREVIEWS:[]).find(x=>x.gw===D.gw);
  html+='<a class="recapcard show" data-mxall="1" href="#" style="margin-top:12px"><div><div class="rk">🎬 Gameweek '+D.gw+' preview<span class="new">WATCH</span></div><div class="rt">'+(p3?esc(p3.title):'Every matchup, every lineup — the week in about a minute')+'</div><div class="rs">Lineups, the players to watch and the talking points · about 90 seconds</div></div><span class="go">▶ PLAY</span></a>';
  html+='<div class="stack" style="margin-top:12px">';
  if(yours)html+=bugHTML(rows[first],first,{you:true,open:true,noTag:uniform});
  html+='</div>';
  const rest=yours?order.slice(1):order;
  html+='<h2 class="v10">'+(yours?'Around the league':'Gameweek '+D.gw)+(uniform&&stTag?'<span class="lnk hst">'+stTag+'</span>':'')+'</h2><div class="stack">'+rest.map(i=>bugHTML(rows[i],i,{noTag:uniform})).join('')+'</div>';
  if(cc)html+='<h2 class="v10">Recent news<span class="lnk" id="allart">All articles '+CHEV+'</span></h2><div class="program">'+cc+'</div>';
  html+='<div style="height:10px"></div>'+nextGwBtn()+plStrip();
  html=html.replace('<b>Gameweek '+(D.gw+1)+' preview</b><em>Predicted scores · fixtures · tap to open</em>','<b>Gameweek '+(D.gw+1)+' fixtures</b><em>Predicted scores · who plays whom · tap to open</em>');
  document.getElementById('gwbody').innerHTML=html;
  v10clock();heroCopy();
  document.getElementById('gwbody').onclick=e=>{
    if(e.target.closest('#allart')){openArticles();return}
    if(e.target.closest('#ngwbtn')){openNextGw();return}
    if(e.target.closest('#plall')){PLALL=!PLALL;if(!PLALL)PLOPEN.clear();renderGW();return}
    if(e.target.closest('.plp'))return;
    const r=e.target.closest('.plrow.tap');
    if(r){const k=r.dataset.fx;if(PLALL){PLALL=false;PLOPEN.clear();}
      if(PLOPEN.has(k))PLOPEN.delete(k);else PLOPEN.add(k);
      r.classList.toggle('open',PLOPEN.has(k));r.setAttribute('aria-expanded',PLOPEN.has(k));
      const x=r.nextElementSibling;if(x&&x.classList.contains('plx'))x.classList.toggle('on',PLOPEN.has(k));return}
    const c=e.target.closest('.mcard');if(c&&c.dataset.mi!==undefined)location.hash='gw/'+c.dataset.mi};
}
function openArticles(){
  const items=RECAPS.map(r=>({k:'Gameweek '+r.gw+' recap',t:r.title,h:r.href,g:r.gw,o:1})).concat(PREVIEWS.map(p=>({k:'Gameweek '+p.gw+' preview',t:p.title,h:p.href,g:p.gw,o:0}))).sort((a,b)=>b.g-a.g||a.o-b.o);
  sheet.innerHTML='<div class="sh-right"><button class="sh-x" onclick="closeSheet()">×</button><h3 style="margin:0 0 4px">Articles</h3><div class="artl">'
   +items.map(x=>'<a href="'+x.h+'"><span class="k">'+x.k+'</span><b>'+esc(x.t)+'</b></a>').join('')+'</div></div>';
  ov.classList.add('on');sheet.classList.add('on');pushOverlay();
}

/* ---- true to formation: five across in an arc, never 4+1 ---- */
function rowsFor(xi,mirror){
  const order=mirror?['FWD','MID','DEF','GKP']:['GKP','DEF','MID','FWD'];
  return order.map(pos=>{const g=xi.filter(p=>p.Pos===pos);if(!g.length)return'';
    return '<div class="prow'+(g.length===5?' five '+(mirror?'up':'dn'):'')+'">'+g.map(p=>card(p,D.ro.indexOf(p))).join('')+'</div>';}).join('');
}
/* ---- matchup detail: crests, form under each side, tale of the tape ---- */
function renderMatch(f,dl){
  __orig.renderMatch(f,dl);
  const st=document.querySelector('#gwbody .stage');if(!st)return;
  const bb=document.getElementById('gwback');if(bb)bb.textContent='‹ Matchday';
  const sides=st.querySelectorAll('.vs .side');
  if(sides[0])sides[0].insertAdjacentHTML('beforeend',formHTML(f.Home,'c'));
  if(sides[1])sides[1].insertAdjacentHTML('beforeend',formHTML(f.Away,'c'));
  const row=t=>D.st.find(s=>s.Team===t)||{};
  const H=(TEAMS[f.Home]||{}).col||'#5B1A66',A=(TEAMS[f.Away]||{}).col||'#5B1A66';
  const tr=(l,r,lab)=>{const tot=(l+r)||1;return '<div class="tr"><b>'+l+'</b><div class="tl"><em>'+lab+'</em><div class="tb"><i style="flex:'+(l/tot)+';background:'+H+'"></i><i style="flex:'+(r/tot)+';background:'+A+'"></i></div></div><b>'+r+'</b></div>';};
  const tape='<div class="tape">'+tr(num(row(f.Home)['Pts For']),num(row(f.Away)['Pts For']),'Points for')+tr(num(row(f.Home)['League Pts']),num(row(f.Away)['League Pts']),'League points')+'</div>';
  const anchor=st.querySelector('.series')||st.querySelector('.axtog')||st.querySelector('.scsub');
  if(anchor)anchor.insertAdjacentHTML('afterend',tape);
  /* the team on the LEFT of the stage plays at the TOP of the pitch (it read flipped before) */
  const duel=st.querySelector('.duel');const wrap=duel&&duel.querySelector(':scope > div[style*="z-index"]');
  if(wrap){const hAS=autoSubs(f.Home,true),aAS=autoSubs(f.Away,true);
    D.xpview=XPMODE&&D.hasXP; /* the base resets this after it renders — the re-dealt XI must honour the Actual | xP toggle like the benches do */
    const tag=(t,xi)=>'<div class="teamtag"><span class="md" style="background:'+((TEAMS[t]||{}).col||'#999')+'"></span>'+esc(t)+' · '+formation(xi)+(lineupsLocked()?'':' · <span style="opacity:.85">projected</span>')+'</div>';
    wrap.innerHTML=tag(f.Home,hAS.xi)+rowsFor(hAS.xi,false)+'<div style="height:8px"></div>'+tag(f.Away,aAS.xi)+rowsFor(aAS.xi,true);
    D.xpview=false;}
  const allStarted=xiOf(f.Home).concat(xiOf(f.Away)).every(p=>fxStarted(p.Club));
  if(!allStarted){const a2=st.querySelector('.tape');if(a2)a2.insertAdjacentHTML('afterend',oppToggle());}
  const mi=D.fx.filter(x=>num(x.GW)===D.gw).indexOf(f);
  const xt=st.querySelector('.axtog:not(.om) [data-xt="1"]');if(xt)xt.textContent='xP';
}

/* ---- My team: the pitch, then everything the profile already knows ---- */
function nextFixtureOf(team){return D.fx.filter(f=>(f.Home===team||f.Away===team)&&!fin(f.Finished)&&effPtsOf(f,f.Home)+effPtsOf(f,f.Away)===0).sort((a,b)=>num(a.GW)-num(b.GW))[0]}
function squadHealth(team){
  const gws=Object.keys(D.gwsByGw||{}).map(Number).filter(g=>g<D.gw||(g===D.gw&&D.dlPassed)).sort((a,b)=>a-b);
  const last=gws.slice(-3);if(!last.length)return '';
  const rows=squadOf(team).map(p=>{
    const pts=last.map(g=>((D.gwsByGw[g]||{})[String(p.Code)]||{}).Pts||0);
    const l3=pts.reduce((s,x)=>s+x,0)/last.length;
    const avg=num(p['Season pts'])/Math.max(1,D.gwsDone);
    return {p,l3,d:l3-avg};}).filter(r=>r.l3>0||r.d<0);
  const up=rows.filter(r=>r.d>0).sort((a,b)=>b.d-a.d).slice(0,3),dn=rows.filter(r=>r.d<0).sort((a,b)=>a.d-b.d).slice(0,3);
  const li=(r,c)=>'<div class="hr"><b>'+esc(r.p.Player)+'</b><span>'+fmt1(r.l3)+' / GW</span><span class="d '+c+'">'+(r.d>0?'+':'−')+fmt1(Math.abs(r.d))+'</span></div>';
  return '<h2 class="v10">Squad health<span class="lnk" style="cursor:default">last '+last.length+' GW'+(last.length>1?'s':'')+'</span></h2><div class="health">'
   +'<div class="card"><span class="hk up">▲ Trending up</span>'+(up.length?up.map(r=>li(r,'up')).join(''):'<span class="hr"><span>—</span></span>')+'</div>'
   +'<div class="card"><span class="hk dn">▼ Trending down</span>'+(dn.length?dn.map(r=>li(r,'dn')).join(''):'<span class="hr"><span>—</span></span>')+'</div></div>';
}
let FIXOPEN=true;
function nextFive(team){
  const xi=effXiOf(team,true);const clubs=[...new Set(xi.map(p=>p.Club))];
  const gws=[0,1,2,3,4].map(i=>D.gw+i);
  const cell=(c,g)=>{const fs=(D.cf||[]).filter(x=>num(x.GW)===g&&(x.Home===c||x.Away===c));if(!fs.length)return '<span class="x">—</span>';
    return '<span class="fxc'+(fs.length>1?' dbl':'')+'">'+fs.map(f=>{const h=f.Home===c,opp=h?f.Away:f.Home,n=fdrOf(c,f);
      return '<span class="fd" style="background:'+FDRCOL[n]+';color:'+FDRTXT[n]+'" title="'+esc(clubName(opp))+' ('+(h?'H':'A')+') · difficulty '+n+'">'+badgeImg(opp,16)+'<i>'+(h?'H':'A')+'</i></span>';}).join('')+'</span>';};
  return '<div class="card fixt" style="padding:0;margin:0 0 10px"><div class="fh" id="fixh">Next five · your clubs'+(FIXOPEN?CHEVD:CHEV)+'</div>'
   +(FIXOPEN?'<div class="fg"><span></span>'+gws.map(g=>'<span>GW'+g+'</span>').join('')+'</div>'+clubs.map(c=>'<div class="fr"><b title="'+esc(clubName(c))+'">'+badgeImg(c,22)+'</b>'+gws.map(g=>cell(c,g)).join('')+'</div>').join('')
     +'<div class="fleg"><span style="background:#01FC7A"></span>Easy<span style="background:#E7E7E7"></span>Medium<span style="background:#FF1751"></span>Hard<span style="background:#80072D"></span>Very hard</div>':'')+'</div>';
}
/* shared team-page parts: pitch + bench, next-fixture line — used by My team AND every manager's profile sheet */
function teamPitchHTML(team){
  const as=autoSubs(team,true);SUBMARK={};as.subs.forEach(s2=>{const l=s2.kind==='likely'?'l':'';SUBMARK[s2.inn.Code]='in'+l;SUBMARK[s2.out.Code]='out'+l;});
  const inn=new Set(as.subs.map(s2=>s2.inn.Code));
  const bench=benchOf(team).filter(b=>!inn.has(b.Code)).concat(as.subs.map(s2=>s2.out));
  const tog=as.xi.every(p=>fxStarted(p.Club))?'':'<div class="watchrow" style="margin:0 0 8px">'+oppToggle()+'</div>';
  const h=tog+'<div class="mypitch"><div class="arc"></div><div class="box"></div><div class="in"><div class="teamtag2">'+crestOf(team,18)+'<span>'+esc(team)+' · '+formation(as.xi)+(lineupsLocked()?'':' · projected')+'</span></div>'+rowsFor(as.xi,true)+'</div></div>'
   +'<div class="mybench"><span class="lb">Bench</span><div class="prow">'+bench.map(p=>card(p,D.ro.indexOf(p))).join('')+'</div></div>';
  SUBMARK={};return h;
}
function teamNext(team){
  const nxf=nextFixtureOf(team);if(!nxf)return null;
  const opp=nxf.Home===team?nxf.Away:nxf.Home,nm=derbyName(nxf.Home,nxf.Away),gw=num(nxf.GW);
  const dl=gwDeadline(gw);const ko=(D.cf||[]).filter(x=>num(x.GW)===gw).map(x=>dt(x['Kickoff (UTC)'])).filter(Boolean).sort((a,b)=>a-b)[0];
  const when=ko?ko.toLocaleString(undefined,{weekday:'short',day:'numeric',month:'short'}):dl?dl.toLocaleString(undefined,{weekday:'short',day:'numeric',month:'short'}):'';
  const idx=D.fx.filter(f=>num(f.GW)===gw).indexOf(nxf);
  return {opp,nm,gw,when,home:nxf.Home===team,go:gw===D.gw?'gw/'+idx:null,f:nxf};
}
function teamNextLine(team){const n=teamNext(team);if(!n)return '';
  return '<div class="nextline"'+(n.go?' data-go="'+n.go+'" role="button"':'')+'><span class="k">Next</span>'+crestOf(n.opp,20)+'<b>'+(n.home?'vs ':'at ')+esc(n.opp)+'</b><span class="w">GW'+n.gw+(n.when?' · '+esc(n.when):'')+(n.nm?' · '+esc(n.nm):'')+'</span>'+(n.go?CHEV:'')+'</div>';}
function renderTeam(){
  __orig.renderTeam();
  updateHeader();
  const mine=myTeam();const page=document.getElementById('teampage');if(!mine||!page)return;
  /* the profile's squad list is replaced by the pitch */
  const heads=[...page.querySelectorAll('.posh2')];
  const sq=heads.find(h=>/Current squad/.test(h.textContent));
  if(sq){let n=sq;const stop=heads.find(h=>/Actual vs expected/.test(h.textContent));while(n&&n!==stop){const nx=n.nextElementSibling;n.remove();n=nx;}}
  const st=D.st.slice().sort((a,b)=>num(b['League Pts'])-num(a['League Pts'])||num(b['Pts For'])-num(a['Pts For']));
  const pos=st.findIndex(s=>s.Team===mine)+1,row=st[pos-1]||{};
  const inner=page.querySelector('.sh-right')||page.firstElementChild;
  const tiles=inner&&inner.querySelector('.profstats');
  const avgTxt=tiles?(tiles.children[0]&&tiles.children[0].querySelector('b')||{}).textContent||'':'';
  const head='<div class="myhead"><span class="cr">'+crestOf(mine,56)+'</span><div class="t"><span class="k">Your clubhouse</span><span class="n">'+esc(mine)+'</span><span class="r">'+esc((TEAMS[mine]||{}).mgr||'')+(pos?' · '+ORD(pos):'')+(row.W!==undefined?' · <span class="num">'+row.W+'–'+row.D+'–'+row.L+'</span>':'')+(avgTxt?' · <span class="num">'+esc(avgTxt)+'</span> avg':'')+'</span></div>'+formHTML(mine,'r')+'</div>';
  if(inner&&inner.firstElementChild&&/h3/i.test(inner.firstElementChild.innerHTML))inner.firstElementChild.remove();
  if(inner){const nx=inner.querySelector('.sub');if(nx&&/^Next:/.test(nx.textContent))nx.remove();}
  page.insertAdjacentHTML('afterbegin',head);
  /* tiles: THIS GW · POINTS FOR · BEST GW (avg + W-D-L moved into the header) */
  if(tiles&&tiles.children.length>=3){
    const cur=D.fx.filter(f=>num(f.GW)===D.gw).find(f=>f.Home===mine||f.Away===mine);
    let gwTxt='—',gwSub='This gameweek';
    if(cur){const s=mscore(cur);const my=cur.Home===mine?s.hs:s.as2;const opp=cur.Home===mine?cur.Away:cur.Home;
      if(s.done||s.liveNow){gwTxt=my;gwSub='GW'+D.gw+(s.done?' · final':D.hasEP?' · proj '+fmt1(teamProj(mine)):' · live');}
      else{gwTxt=D.hasEP?fmt1(teamProj(mine)):'—';gwSub='GW'+D.gw+' projected';}}
    tiles.children[0].innerHTML='<b style="font-size:1.9rem;color:var(--p2)">'+gwTxt+'</b><span>'+esc(gwSub)+'</span>';
    tiles.children[2].innerHTML='<b style="font-size:1.9rem">'+num(row['Pts For'])+'</b><span>Points for'+(pos?' · '+ORD(pos):'')+'</span>';
    tiles.insertAdjacentHTML('beforebegin',teamNextLine(mine));
  }
  const extra=teamPitchHTML(mine)+squadHealth(mine)+nextFive(mine);
  if(tiles)tiles.insertAdjacentHTML('afterend',extra);else page.insertAdjacentHTML('beforeend',extra);
  const nl=page.querySelector('.nextline[data-go]');if(nl)nl.onclick=()=>{location.hash=nl.dataset.go};
  const fh=document.getElementById('fixh');if(fh)fh.onclick=()=>{FIXOPEN=!FIXOPEN;renderTeam()};
}
/* every manager's profile sheet gets the same treatment: cards on a pitch, form, who's hot, who they play and when */
const __op=openProfile;openProfile=function(team,intoEl){
  __op(team,intoEl);if(intoEl)return;
  const sh=document.querySelector('#sheet .sh-right');if(!sh||!TEAMS[team])return;document.getElementById('sheet').dataset.team=team;
  const heads=[...sh.querySelectorAll('.posh2')];
  const sq=heads.find(h=>/Current squad/.test(h.textContent));
  if(sq){let n=sq;const stop=heads.find(h=>/Actual vs expected/.test(h.textContent));while(n&&n!==stop){const nx=n.nextElementSibling;n.remove();n=nx;}}
  const nx=sh.querySelector('.sub+.sub, .profstats + .sub');const old=[...sh.querySelectorAll('.sub')].find(x=>/^Next:/.test(x.textContent));if(old)old.remove();
  const hdr=sh.querySelector('h3');if(hdr&&hdr.parentElement&&hdr.parentElement.parentElement){const hd=hdr.parentElement.parentElement;const cr=hd.querySelector('.mg');if(cr)cr.outerHTML='<span class="cr" style="width:44px;height:44px;flex:none">'+crestOf(team,44)+'</span>';hd.insertAdjacentHTML('beforeend','<span style="margin-left:auto">'+formHTML(team,'r')+'</span>');}
  const tiles=sh.querySelector('.profstats');
  const extra=teamNextLine(team)+teamPitchHTML(team)+squadHealth(team)+nextFive(team);
  if(tiles)tiles.insertAdjacentHTML('afterend',extra);
  const nl=sh.querySelector('.nextline[data-go]');if(nl)nl.onclick=()=>{closeSheet();location.hash=nl.dataset.go};
  const fh=sh.querySelector('#fixh');if(fh)fh.onclick=()=>{FIXOPEN=!FIXOPEN;openProfile(team)};
};

/* ---- Table: standings first, then the money ---- */
function renderTable(){
  __orig.renderTable();
  if((location.hash||'').startsWith('#team'))renderTeam();
  const body=document.getElementById('tablebody');
  const race=body.querySelector('.card.race');
  const stand=body.querySelector('h2:not(.v10)');
  if(!stand)return;
  const standCard=stand.nextElementSibling;
  const st=D.st.slice().sort((a,b)=>num(b['League Pts'])-num(a['League Pts'])||num(b['Pts For'])-num(a['Pts For']));
  const lead=st[0],sec=st[1];
  const togo=Math.max(0,19-D.gwsDone);
  const m90=lead?'<div class="card money90"><div><div class="k">Leader after GW19<span class="tg">$90</span></div><div class="who">'+mg(lead.Team,1)+'<div><b>'+esc(lead.Team)+'</b><em>'
    +(sec?(num(lead['League Pts'])===num(sec['League Pts'])?'Level with '+esc(sec.Team)+' · ahead on PF '+lead['Pts For']+'–'+sec['Pts For']:(num(lead['League Pts'])-num(sec['League Pts']))+' pts clear of '+esc(sec.Team)):'')
    +'</em></div></div></div><div class="big"><b>'+togo+'</b><span>GWs to go</span></div></div>':'';
  const money=document.createElement('div');money.innerHTML='<h2 class="v10">The money</h2>';
  standCard.insertAdjacentElement('afterend',money);
  if(race){money.appendChild(race);race.style.marginTop='0';}
  money.insertAdjacentHTML('beforeend',m90);
  stand.className='v10';stand.innerHTML='Standings'+(D.provOver?' · GW'+D.gw+' provisional':'');
  body.querySelectorAll('h2:not(.v10)').forEach(h=>{h.className='v10'});
}

/* boot: the nav already built by the app — rebuild with the five tabs */
buildNav();

/* ---- pre-deadline lineups: FPL publishes nobody's picks until the deadline (the API 404s), so the app
   used to guess a "Best XI" ranked by season projection — which is not what the manager set and even
   started injured players. FPL's own rule is that last week's lineup carries forward, so that's the guess:
   last logged XI (GW Log), departed players replaced by the best-EP legal fill, then the likely-sub pass
   handles anyone flagged out. Labelled PROJECTED everywhere until GW XI lands. ---- */
const POSCAP={GKP:1,DEF:5,MID:5,FWD:3},POSMIN={GKP:1,DEF:3,MID:2,FWD:1};
function projectedXI(team){
  const sq=squadOf(team);if(sq.length<11)return null;
  const lastGw=D.gwsDone;const log=(D.gl||[]).filter(r=>num(r.GW)===lastGw&&r.Team===team);
  const ep=p=>{const e=D.hasEP?epOf(p.Code):null;return e==null?num(p['Proj pts'])/38:e};
  let xi=[];
  if(log.length){const was=new Set(log.filter(r=>r.Started==='XI').map(r=>String(r.Code)));xi=sq.filter(p=>was.has(String(p.Code)));}
  const cnt=pos=>xi.filter(p=>p.Pos===pos).length;
  const rest=()=>sq.filter(p=>!xi.includes(p)&&!(typeof flaggedOut==='function'&&flaggedOut(p))).sort((a,b)=>ep(b)-ep(a));
  /* fill to 11 within position caps, best EP first */
  for(const p of rest()){if(xi.length>=11)break;if(cnt(p.Pos)<POSCAP[p.Pos])xi.push(p);}
  /* enforce minimums: swap the weakest surplus player for the best missing-position player */
  for(const pos of Object.keys(POSMIN)){let guard=0;while(cnt(pos)<POSMIN[pos]&&guard++<5){
    const inn=rest().find(p=>p.Pos===pos);if(!inn)break;
    const out=xi.filter(p=>p.Pos!==pos&&cnt(p.Pos)>POSMIN[p.Pos]).sort((a,b)=>ep(a)-ep(b))[0];if(!out)break;
    xi.splice(xi.indexOf(out),1,inn);}}
  if(xi.length!==11||cnt('GKP')!==1)return null;
  const order={GKP:0,DEF:1,MID:2,FWD:3};
  return xi.sort((a,b)=>order[a.Pos]-order[b.Pos]||ep(b)-ep(a));
}
function xiOf(team){
  const sq=squadOf(team);
  const real=sq.filter(r=>r['GW XI']==='XI');
  if(real.length>=11)return real.sort((a,b)=>num(a.Slot)-num(b.Slot));
  return projectedXI(team)||sq.filter(r=>r['Best XI']==='XI');
}
function benchOf(team){
  const sq=squadOf(team);
  const real=sq.filter(r=>r['GW XI']==='BEN');
  if(real.length)return real.sort((a,b)=>num(a.Slot)-num(b.Slot));
  const xi=xiOf(team);const order={GKP:0,DEF:1,MID:2,FWD:3};
  return sq.filter(p=>!xi.includes(p)).sort((a,b)=>order[a.Pos]-order[b.Pos]||num(b['Proj pts'])-num(a['Proj pts']));
}
function lineupsLocked(){return D.ro.some(r=>r['GW XI']==='XI')}
/* label the guess wherever XIs are drawn */
const __rm2=renderMatch;
renderMatch=function(f,dl){
  __rm2(f,dl);
  if(lineupsLocked())return;
  const duel=document.querySelector('#gwbody .duel');
  if(duel)duel.insertAdjacentHTML('afterend','<div class="asubnote" style="margin-top:8px">Projected lineups — FPL publishes picks at the deadline'+(dl?' ('+dl.toLocaleString(undefined,{weekday:'short',hour:'numeric',minute:'2-digit'})+')':'')+'. Until then this is each manager’s last lineup carried forward, with new signings slotted by projection and flagged players covered.</div>');
};

/* ---- fixture difficulty: FPL's own team strengths (bootstrap-static), keyed by the sheet's short codes.
   [difficulty when you host them, difficulty when you visit them] — matches FPL's team_h/a_difficulty exactly. ---- */
const STRENGTH={ARS:[4,5],AVL:[3,4],BOU:[3,3],BRE:[3,3],BHA:[2,3],CHE:[4,4],COV:[2,2],CRY:[3,3],EVE:[3,3],FUL:[2,3],HUL:[2,2],IPS:[2,2],LEE:[2,3],LIV:[4,4],MCI:[4,5],MUN:[4,4],NEW:[2,3],NFO:[3,3],TOT:[3,3],SUN:[2,3]};
const CLUBNAME={ARS:'Arsenal',AVL:'Aston Villa',BOU:'Bournemouth',BRE:'Brentford',BHA:'Brighton',CHE:'Chelsea',COV:'Coventry City',CRY:'Crystal Palace',EVE:'Everton',FUL:'Fulham',HUL:'Hull City',IPS:'Ipswich Town',LEE:'Leeds',LIV:'Liverpool',MCI:'Man City',MUN:'Man Utd',NEW:'Newcastle',NFO:'Nott’m Forest',TOT:'Spurs',SUN:'Sunderland'};
const FDRCOL={1:'#01FC7A',2:'#01FC7A',3:'#E7E7E7',4:'#FF1751',5:'#80072D'};
const FDRTXT={1:'#0B2A18',2:'#0B2A18',3:'#2A2233',4:'#FFFFFF',5:'#FFFFFF'};
const FDRLAB={1:'Easy',2:'Easy',3:'Medium',4:'Hard',5:'Very hard'};
const clubName=c=>CLUBNAME[c]||c;
function fdrOf(club,f){const opp=f.Home===club?f.Away:f.Home,s=STRENGTH[opp];if(!s)return 3;return f.Home===club?s[0]:s[1]}
function fdrPill(n){return '<span class="fdr" style="background:'+FDRCOL[n]+';color:'+FDRTXT[n]+'"><b>'+n+'</b>'+FDRLAB[n]+'</span>'}
const koFmt=ko=>ko?ko.toLocaleString(undefined,{weekday:'short',day:'numeric',month:'short',hour:'numeric',minute:'2-digit'}):'';

/* ---- who am I playing? Opponents mode paints the card bubble in the fixture's FPL difficulty colour with the opponent's badge ---- */
function nextClubFixture(club){return (D.cf||[]).find(x=>num(x.GW)===D.gw&&!fin(x.Finished)&&(x.Home===club||x.Away===club))||(D.cf||[]).find(x=>!fin(x.Finished)&&(x.Home===club||x.Away===club))}
let OPPMODE=false;
function card(p,i){
  if(p&&!p.Nation&&typeof NAT_FIX!=='undefined'&&NAT_FIX[String(p.Code)])p.Nation=NAT_FIX[String(p.Code)];
  let h=__orig.card(p,i);
  if(!OPPMODE||fxStarted(p.Club))return h;
  const nf=nextClubFixture(p.Club);if(!nf)return h;
  const home=nf.Home===p.Club,opp=home?nf.Away:nf.Home,n=fdrOf(p.Club,nf);
  return h.replace(/<span class="pts proj">.*?<\/i><\/span>/,'<span class="pts opp" style="background:'+FDRCOL[n]+';color:'+FDRTXT[n]+'" title="'+esc(clubName(opp))+' ('+(home?'H':'A')+') · difficulty '+n+'">'+badgeImg(opp,0)+'<i>'+(home?'H':'A')+'</i></span>');
}
function oppToggle(){return '<div class="axtog om"><div class="in3"><button class="'+(OPPMODE?'':'on')+'" data-om="0">Projected</button><button class="'+(OPPMODE?'on':'')+'" data-om="1">Fixture</button></div></div>'}
document.body.addEventListener('click',e=>{const b=e.target.closest('[data-om]');if(!b)return;OPPMODE=b.dataset.om==='1';const ps=b.closest('#sheet');if(ps&&ps.dataset.team){openProfile(ps.dataset.team);return}if((location.hash||'').startsWith('#team'))renderTeam();else renderGW();});
/* ---- Matchweek plate in the top bar; the league name moves into the hero kickers ---- */
function mwWordmark(w){return '<svg viewBox="0 0 564 152" style="width:'+w+'px;height:auto;display:block;filter:drop-shadow(0 2px 5px rgba(0,0,0,.4))" role="img" aria-label="Matchweek"><defs><linearGradient id="mwE" x1="0" y1="0" x2=".85" y2="1"><stop offset="0" stop-color="#04F5FF"/><stop offset=".45" stop-color="#2E5BFF"/><stop offset="1" stop-color="#8E44AD"/></linearGradient><linearGradient id="mwI" x1="0" y1="0" x2=".4" y2="1"><stop offset="0" stop-color="#101E4E"/><stop offset="1" stop-color="#060B24"/></linearGradient></defs><path d="M16 8 H498 L556 66 V136 L548 144 H16 L8 136 V16 Z" fill="url(#mwI)" stroke="url(#mwE)" stroke-width="6"/><text x="272" y="98" text-anchor="middle" font-family="\'Archivo Black\',sans-serif" font-size="62" letter-spacing="3"><tspan fill="#FFD23F">MATCH</tspan><tspan fill="#FFFFFF">WEEK</tspan></text></svg>'}
(function(){const b=document.querySelector('.top .brand');if(b){b.innerHTML=mwWordmark(74)+'<span class="lg">El Matador Tire</span>';b.style.letterSpacing='0';b.style.display='flex';b.style.alignItems='center';b.style.gap='8px';}
  document.querySelectorAll('.hero .kick').forEach(k=>{if(!/El Matador/i.test(k.textContent))k.textContent='El Matador Tire · '+k.textContent;});})();
const __hc=heroCopy;heroCopy=function(){__hc();const k=document.querySelector('#v-gw .hero .kick');if(k)k.textContent='El Matador Tire · Gameweek '+(D.gw||'');};
/* ---- Players: the club view is gone (search + free agents + the wire stay) ---- */
/* Only redirect a stale club sub-route when the Players view is the one showing. loadAll() re-renders every tab after
   each refresh (visibility return, 5-min tick, pull), so on a matchup page (#gw/N) SUB is the matchup index — the old
   unconditional replace('#xis') is what randomly threw people onto the Players tab. Off-view, render with SUB cleared. */
const __rx=renderXIs;renderXIs=function(){const onXis=(location.hash||'#gw').slice(1).split('/')[0]==='xis';
  if(onXis&&SUB&&SUB!=='all'){location.replace('#xis');return}
  if(!onXis&&SUB){const s=SUB;SUB=null;try{__rx()}finally{SUB=s}return}
  __rx();};
/* ---- player sheet: league percentiles replace the FC27 six-stat grid ---- */
function pctRank(v,arr){if(!arr.length)return 0;const below=arr.filter(x=>x<v).length,eq=arr.filter(x=>x===v).length;return Math.round(100*(below+eq*0.5)/arr.length)}
function leagueStats(p){
  const pool=D.ro.filter(r=>r.Pos===p.Pos);
  const gws=Object.keys(D.gwsByGw||{}).map(Number).filter(g=>g<D.gw||(g===D.gw&&D.dlPassed)).sort((a,b)=>a-b);
  const last3=r=>{const l=gws.slice(-3);if(!l.length)return 0;return l.reduce((s,g)=>s+(((D.gwsByGw[g]||{})[String(r.Code)]||{}).Pts||0),0)/l.length};
  const totw=r=>(D.gl||[]).filter(x=>String(x.Code)===String(r.Code)&&x.TOTW==='TOTW').length;
  const fa=(D.plr||[]).filter(x=>x.Owner==='FREE'&&x.Pos===p.Pos).map(x=>num(x['Season pts'])/Math.max(1,D.gwsDone));
  const repl=fa.length?Math.max(...fa):0;
  const m=r=>({pts:num(r['Season pts']),avg:num(r['Season pts'])/Math.max(1,D.gwsDone),l3:last3(r),totw:totw(r),par:num(r['Season pts'])/Math.max(1,D.gwsDone)-repl});
  const all=pool.map(m),me=m(p);
  const pc=k=>pctRank(me[k],all.map(a=>a[k]));
  const impactOf=x=>['pts','avg','l3','totw','par'].reduce((s,k)=>s+pctRank(x[k],all.map(a=>a[k])),0)/5;
  const imp=pctRank(impactOf(me),all.map(impactOf));
  return {pts:me.pts,avg:me.avg,totw:me.totw,imp,pc:{pts:pc('pts'),avg:pc('avg'),totw:pc('totw'),imp},n:pool.length};
}
/* ---- the fixture is the headline of the player sheet: both badges, full names, home/away, kickoff or score, FPL difficulty ---- */
function fixtureBlock(p){
  const club=p.Club;const all=(D.cf||[]).filter(x=>x.Home===club||x.Away===club);
  let cur=all.filter(x=>num(x.GW)===D.gw);
  const later=all.filter(x=>num(x.GW)>D.gw&&!fin(x.Finished)).sort((a,b)=>num(a.GW)-num(b.GW)||(dt(a['Kickoff (UTC)'])||0)-(dt(b['Kickoff (UTC)'])||0));
  if(!cur.length){if(!later.length)return '';cur=[later[0]];}
  const gwOf=f=>num(f.GW);
  const ep=epOf(p.Code);
  const side=(c,cls)=>'<div class="fxs '+cls+(c===club?' me':'')+'">'+badgeImg(c,40)+'<b>'+esc(clubName(c))+'</b><i>'+(cls==='h'?'Home':'Away')+'</i></div>';
  const row=f=>{
    const home=f.Home===club,n=fdrOf(club,f),ko=dt(f['Kickoff (UTC)']);
    const done=fin(f.Finished),started=fin(f.Started);
    const hg=f['Home goals'],hasScore=hg!==''&&hg!==undefined&&hg!==null;
    const mid=started&&hasScore?'<b class="sc num">'+num(hg)+' – '+num(f['Away goals'])+'</b><span class="st '+(done?'ft':'live')+'">'+(done?'FT':'LIVE')+'</span>'
      :'<span class="v">v</span><span class="ko">'+(ko?esc(koFmt(ko)):'TBC')+'</span>';
    const pts=Math.round(num(p['GW pts'])),mins=Math.round(num(p['GW mins']));
    const foot=gwOf(f)!==D.gw?'<span class="fxst">Gameweek '+gwOf(f)+'</span>'
      :started?'<span class="fxst"><b class="num">'+pts+'</b> pts · <b class="num">'+mins+'</b> mins'+(done?'':' so far')+'</span>'
      :(ep!==null?'<span class="fxst">Projected <b class="num">'+fmt1(ep)+'</b> pts</span>':'<span class="fxst"></span>');
    return '<div class="fxrow" style="--fd:'+FDRCOL[n]+'"><div class="fxmain">'+side(f.Home,'h')+'<div class="fxc">'+mid+'</div>'+side(f.Away,'a')+'</div>'
      +'<div class="fxfoot">'+fdrPill(n)+foot+'</div></div>';
  };
  const nextSmall=(cur.every(f=>fin(f.Finished))&&later.length)?(()=>{const f=later[0],home=f.Home===club,opp=home?f.Away:f.Home,n=fdrOf(club,f),ko=dt(f['Kickoff (UTC)']);
    return '<div class="fxnext"><span class="k">Next · GW'+gwOf(f)+'</span>'+badgeImg(opp,18)+'<b>'+(home?'v ':'@ ')+esc(clubName(opp))+'</b><span class="ko">'+esc(koFmt(ko))+'</span>'+fdrPill(n)+'</div>';})():'';
  return '<div class="fxblk"><div class="fxk">'+(gwOf(cur[0])===D.gw?'This gameweek':'Next up · Gameweek '+gwOf(cur[0]))+(cur.length>1?' · double':'')+'</div>'+cur.map(row).join('')+nextSmall+'</div>';
}
const __os=openSheet;openSheet=function(p){
  if(p&&!p.Nation&&typeof NAT_FIX!=='undefined'&&NAT_FIX[String(p.Code)])p.Nation=NAT_FIX[String(p.Code)];
  __os(p);
  const sub=document.querySelector('#sheet .sub');
  if(sub){[...sub.childNodes].forEach(n=>{if(n.nodeType===3&&n.textContent.trim().startsWith(p.Club))n.textContent=n.textContent.replace(p.Club,clubName(p.Club));});sub.insertAdjacentHTML('afterend',fixtureBlock(p));}
  /* rows the block now covers (gameweek, prediction, next fixture) go; season total / average stay only when there is no percentile grid */
  const own=D.ro.find(r=>String(r.Code)===String(p.Code));
  document.querySelectorAll('#sheet .srow').forEach(r=>{const t=(r.firstElementChild||{}).textContent||'';
    if(/^Gameweek|^Predicted|^Next fixture/.test(t)||(own&&/^Season total|^Last season|^Average/.test(t)))r.remove();});
  const g=document.querySelector('#sheet .statgrid');const left=document.querySelector('#sheet .sh-left');if(!left)return;
  if(!own){if(g)g.remove();return}
  const s=leagueStats(own);
  const col=v=>v>=75?'#19D27A':v>=40?'#F5B942':'#E5484D';
  const tile=(lab,val,pct)=>'<div class="sg">'+lab+'<b>'+val+'</b><div class="bar"><i style="width:'+Math.max(2,pct)+'%;background:'+col(pct)+'"></i></div><em class="pc">'+ORD(pct)+' pct</em></div>';
  const html='<div class="statgrid lg">'+tile('PTS',s.pts,s.pc.pts)+tile('AVG',fmt1(s.avg),s.pc.avg)+tile('TOTW',s.totw,s.pc.totw)+tile('IMPACT',s.imp,s.imp)+'</div><div class="lgnote">vs the league’s '+s.n+' rostered '+(own.Pos==='GKP'?'keepers':own.Pos==='DEF'?'defenders':own.Pos==='MID'?'midfielders':'forwards')+'</div>';
  if(g)g.outerHTML=html;else left.insertAdjacentHTML('beforeend',html);
};

/* ---- the lineup graphic: broadcast-style reveal, dealt in and flipped, GK at the bottom ---- */
document.body.addEventListener('click',e=>{const b=e.target.closest('[data-watch]');if(b){e.stopPropagation();openLineup(b.dataset.watch);}});
function openLineup(team){
  const old=document.getElementById('lgfx');if(old)old.remove();
  const saveOpp=OPPMODE;OPPMODE=false;
  const as=autoSubs(team,true);const xi=as.xi;
  SUBMARK={};
  const st=D.st.slice().sort((a,b)=>num(b['League Pts'])-num(a['League Pts'])||num(b['Pts For'])-num(a['Pts For']));
  const pos=st.findIndex(s=>s.Team===team)+1,row=st[pos-1]||{};
  const nxf=nextFixtureOf(team);const opp=nxf?(nxf.Home===team?nxf.Away:nxf.Home):'';const nm=nxf?derbyName(nxf.Home,nxf.Away):'';
  const order=['FWD','MID','DEF','GKP'];let k=0;
  const rows=order.map(p=>{const g=xi.filter(x=>x.Pos===p);if(!g.length)return'';
    return '<div class="prow'+(g.length===5?' five':'')+'">'+g.map(x=>'<div class="deal" style="animation-delay:'+(0.9+(k++)*0.26)+'s">'+card(x,D.ro.indexOf(x))+'</div>').join('')+'</div>';}).join('');
  const col=(TEAMS[team]||{}).col||'#5B1A66';
  document.body.insertAdjacentHTML('beforeend','<div id="lgfx" class="lgfx" style="--tc:'+col+'">'
   +'<button class="lgx" id="lgx" aria-label="Close">×</button>'
   +'<div class="lghead"><span class="cr">'+crestOf(team,64)+'</span><div class="t"><span class="k">Gameweek '+D.gw+(nm?' · '+esc(nm):'')+'</span><span class="n">'+esc(team)+'</span><span class="r">'+esc((TEAMS[team]||{}).mgr||'')+' · '+formation(xi)+(row.W!==undefined?' · <span class="num">'+row.W+'–'+row.D+'–'+row.L+'</span>':'')+(pos?' · '+ORD(pos):'')+'</span>'+formHTML(team,'')+'</div></div>'
   +'<div class="lgpitch"><div class="in">'+rows+'</div></div>'
   +'<div class="lgfoot">'+mwWordmark(120)+'<span class="k">'+(opp?(nxf.Home===team?'vs ':'at ')+esc(opp)+' · ':'')+'El Matador Tire</span><button class="watch" id="lgre">↻ Replay</button></div>'
   +'</div>');
  OPPMODE=saveOpp;
  setTimeout(()=>{const g=document.getElementById('lgfx');if(g)g.classList.add('done')},5200); /* guaranteed final frame (throttled/occluded tabs strand CSS animations) */
  document.getElementById('lgx').onclick=()=>{document.getElementById('lgfx').remove();};
  document.getElementById('lgre').onclick=()=>openLineup(team);
}

/* ---- the preview card stays up through the deadline until the gameweek's first Saturday kickoff (Friday games don't take it down) ---- */
function previewHideAt(gw){
  const dl=gwDeadline(gw);if(!dl)return null;
  const sat=(D.cf||[]).filter(x=>num(x.GW)===gw).map(x=>dt(x['Kickoff (UTC)'])).filter(k=>k&&k>dl&&k.getDay()===6).sort((a,b)=>a-b)[0];
  return sat||new Date(dl.getTime()+36*36e5);
}
function contentCardsHTML(){
  let out='';
  const r=RECAPS.find(r=>r.gw===D.gw&&D.provOver)||RECAPS.find(r=>r.gw===D.gwsDone);
  if(r){const ndl=gwDeadline(r.gw+1);
    if(!(ndl&&Date.now()>ndl.getTime()-RECAP_HIDE_H*36e5))
      out+='<a class="recapcard" href="'+r.href+'"><div><div class="rk">📰 Gameweek '+r.gw+' recap<span class="new">NEW</span></div><div class="rt">'+r.title+'</div><div class="rs">'+r.sub+'</div></div><span class="go">READ</span></a>';}
  const p=PREVIEWS.find(p=>p.gw===D.gw||p.gw===D.gwsDone+1);
  if(p){const hide=previewHideAt(p.gw);
    if(!(hide&&Date.now()>hide.getTime()))
      out+='<a class="recapcard prev" href="'+p.href+'"><div><div class="rk">🔭 Gameweek '+p.gw+' preview<span class="new">NEW</span></div><div class="rt">'+p.title+'</div><div class="rs">'+p.sub+'</div></div><span class="go">READ</span></a>';}
  return out;
}

/* ---- manager profiles: the Managers tab (colour · crest shape · photo · display name) restyles crests + team colours everywhere ---- */
const PROFILE={};
const CREST_DEFAULTS=Object.fromEntries(Object.entries(CREST).map(([k,v])=>[k,{c1:v.c1,c2:v.c2,shape:v.shape||'shield'}]));
const TEAM_COL_DEFAULTS=Object.fromEntries(Object.entries(TEAMS).map(([k,v])=>[k,v.col]));
function applyProfiles(rows){
  if(rows){Object.keys(PROFILE).forEach(k=>delete PROFILE[k]);
    rows.forEach(r=>{if(!r.Team||!TEAMS[r.Team])return;PROFILE[r.Team]={color:String(r.Color||'').trim(),shape:String(r.Shape||'').trim(),photo:String(r.Photo||'').trim(),manager:String(r.Manager||'').trim(),emblem:String(r.Emblem||'').trim()};});}
  Object.entries(TEAMS).forEach(([t,tm])=>{const pr=PROFILE[t]||{},ini=tm.ini,c=CREST[ini];if(!c)return;
    const pal=PALETTE_BY[pr.color],d=CREST_DEFAULTS[ini];
    c.c1=pal?pal.c1:d.c1;c.c2=pal?pal.c2:d.c2;tm.col=pal?pal.col:TEAM_COL_DEFAULTS[t];
    c.shape=SHAPE_BY[pr.shape]?pr.shape:d.shape;c.useIni=pr.emblem==='initials';});
  if(!rows)rerenderView();
}
function rerenderView(){if(!D.ro||!D.ro.length)return;const h=(location.hash||'').slice(1);
  if(h.startsWith('team'))renderTeam();else if(h.startsWith('table'))renderTable();else if(h.startsWith('gw')||h==='')renderGW();updateHeader();}
function loadProfiles(){
  return Promise.all([readTab('Managers').catch(()=>[]),readTab('Specials').catch(()=>[])]).then(([m,sp])=>{
    const r=(sp||[]).find(x=>x.Setting==='API URL');D.api=r&&r.Value?String(r.Value).trim():'';
    applyProfiles(m||[]);rerenderView();});
}
loadProfiles();
const __la=loadAll;loadAll=function(q){return __la(q).then(r=>loadProfiles().then(()=>r))};
/* header avatar + My team header show the manager photo when there is one */
const __uh=updateHeader;updateHeader=function(){__uh();const hv=document.getElementById('hav'),mine=myTeam();const pr=mine&&PROFILE[mine];
  if(hv&&pr&&pr.photo)hv.innerHTML='<img src="'+pr.photo+'" alt="" style="width:28px;height:28px;border-radius:50%;object-fit:cover;display:block;box-shadow:0 0 0 2px #FFD23F">';};
const __rt3=renderTeam;renderTeam=function(){__rt3();const mine=myTeam();const page=document.getElementById('teampage');
  if(!page){const body=document.getElementById('teambody');const grid=body&&body.querySelector('.mgrid');
    if(grid){grid.querySelectorAll('.mt').forEach(b=>{b.insertAdjacentHTML('afterbegin','<span class="mtc">'+crestOf(b.dataset.pick,34)+'</span>')});
      const note=body.querySelector('.mnote');if(note)note.textContent='Claim your team with a 4-digit PIN to set your photo, colours and crest — or just pick one to follow.';
      grid.insertAdjacentHTML('beforebegin','<div class="claimrow"><button class="watch elev" data-claim="1"><span class="pl">★</span>Claim your team</button></div>');}
    return;}
  const head=page.querySelector('.myhead');if(!head)return;
  const pr=mine&&PROFILE[mine]||{};
  if(pr.photo){const cr=head.querySelector('.cr');if(cr)cr.innerHTML='<img src="'+pr.photo+'" alt="" style="width:56px;height:56px;border-radius:50%;object-fit:cover;display:block;box-shadow:0 0 0 2px #FFD23F">';}
  if(pr.manager){const r=head.querySelector('.r');if(r)r.innerHTML=r.innerHTML.replace(esc((TEAMS[mine]||{}).mgr||''),esc(pr.manager));}
  if(typeof profileButtonHTML==='function'){const t=head.querySelector('.t');(t||head).insertAdjacentHTML('beforeend','<div class="profrow">'+profileButtonHTML()+'</div>');}};

/* nations the sheet's pulselive lookup missed (new signings) — client-side patch until Code.gs NATFALLBACK catches up */
const NAT_FIX={551210:'NL',449434:'SE',433969:'JP',154566:'GB-ENG',465642:'DE',201658:'GB-ENG',205533:'GB-ENG',465730:'BE',607464:'IT',482616:'FR',586309:'FR',463726:'BA',551466:'ES',513545:'ML',440993:'SN',611695:'CI',638987:'SN'};
function fixNations(){[D.ro,D.plr].forEach(a=>(a||[]).forEach(p=>{if(!p.Nation&&NAT_FIX[String(p.Code)])p.Nation=NAT_FIX[String(p.Code)]}))}
const __la2=loadAll;loadAll=function(q){return __la2(q).then(r=>{fixNations();rerenderView();return r})};
fixNations();
