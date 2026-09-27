/* v12-clean copy pass (patch_v12_clean.py) */
/* ===== v10 · the matchup graphic: ~22 s broadcast-style preview of one H2H matchup =====
   Scenes: left team intro → left XI dealt from the GK upward → right team intro → right XI → the matchup
   (crests facing, score bug, tale of the tape, key men, the fact). CSS timing on --t0/--t1 per scene; a
   .done guard at the end pins the final frame for throttled tabs. Reuses the Plate cards verbatim. ===== */
const MX_LEN=22.6;
function mxScore(f){
  const s=mscore(f);let st,nums,lab;
  if(s.done||D.provOver){st=s.done?'ft':'prov';nums=[s.hs,s.as2];lab=s.done?'Full time':'Provisional';}
  else if(s.liveNow){st='live';nums=[s.hs,s.as2];lab=D.hasEP?'Proj final '+fmt1(teamProj(f.Home))+' – '+fmt1(teamProj(f.Away)):'Live';}
  else{st='pred';nums=D.hasEP?[fmt1(teamProj(f.Home)),fmt1(teamProj(f.Away))]:['–','–'];lab='Predicted';}
  return {st,nums,lab,s};
}
function mxKeyMan(team,xi){
  const started=xi.every(p=>fxStarted(p.Club));
  const val=p=>started||fxStarted(p.Club)?num(p['GW pts']):(epOf(p.Code)||0);
  const best=xi.slice().sort((a,b)=>val(b)-val(a))[0];if(!best)return null;
  return {p:best,v:val(best),lab:fxStarted(best.Club)?'pts':'proj'};
}
function mxOverlapText(f){
  const hxi=effXiOf(f.Home,true),axi=effXiOf(f.Away,true);const all=hxi.concat(axi);
  const fx=(D.cf||[]).filter(x=>num(x.GW)===D.gw).map(x=>({x,h:hxi.filter(p=>p.Club===x.Home||p.Club===x.Away).length,a:axi.filter(p=>p.Club===x.Home||p.Club===x.Away).length})).filter(o=>o.h+o.a>=2).sort((a,b)=>(b.h+b.a)-(a.h+a.a)).slice(0,3);
  if(!fx.length)return '';
  return fx.map(o=>clubName(o.x.Home)+'–'+clubName(o.x.Away)+': '+(o.h?FIRSTOF(f.Home)+' '+o.h:'')+(o.h&&o.a?', ':'')+(o.a?FIRSTOF(f.Away)+' '+o.a:'')).join(' · ')+'.';
}
function mxOverlap(hxi,axi){
  const all=hxi.concat(axi);const by={};
  (D.cf||[]).filter(x=>num(x.GW)===D.gw).forEach(x=>{const n=all.filter(p=>p.Club===x.Home||p.Club===x.Away).length;if(n>=3)by[x.Home+'–'+x.Away]=n;});
  const top=Object.entries(by).sort((a,b)=>b[1]-a[1])[0];if(!top)return '';
  const [k,n]=top;const [h,a]=k.split('–');
  return '<div class="mxov">'+badgeImg(h,18)+'<b>'+n+'</b> of the '+all.length+' starters are in '+esc(clubName(h))+' – '+esc(clubName(a))+badgeImg(a,18)+'</div>';
}
function lowerThird(k,t,delay,cls,out){if(!t)return '';return '<div class="lt '+(cls||'')+'" style="--in:'+(delay||0).toFixed(2)+'s;--out:'+(out===undefined?'999s':out.toFixed(2)+'s')+'">'+(k?'<span class="k">'+esc(k)+'</span>':'')+'<span class="t">'+esc(t)+'</span></div>'}
const sentences=t=>{const out=[];let cur='';const str=String(t||'').replace(/\s+/g,' ').trim();for(let i=0;i<str.length;i++){cur+=str[i];if(/[.!?]/.test(str[i])&&str[i+1]===' '&&/[A-Z“"(]/.test(str[i+2]||'')){out.push(cur.trim());cur='';i++;}}if(cur.trim())out.push(cur.trim());return out;};
function mxIntro(team,side,cap,t0){
  const st=D.st.slice().sort((a,b)=>num(b['League Pts'])-num(a['League Pts'])||num(b['Pts For'])-num(a['Pts For']));
  const pos=st.findIndex(s=>s.Team===team)+1,row=st[pos-1]||{};
  const pr=(window.PROFILE||{})[team]||{};
  const face=pr.photo?'<span class="ph"><img src="'+pr.photo+'" alt=""></span>':'';
  return '<div class="intro '+side+'">'+(face||'<span class="cr big">'+crestOf(team,150)+'</span>')
   +(face?'<span class="cr sm">'+crestOf(team,64)+'</span>':'')
   +'<span class="k">'+(side==='h'?'Home':'Away')+'</span><span class="n">'+esc(team)+'</span><span class="mg2">'+esc(pr.manager||(TEAMS[team]||{}).mgr||'')+'</span>'
   +'<span class="r">'+(pos?ORD(pos)+' · ':'')+(row.W!==undefined?'<span class="num">'+num(row.W)+'–'+num(row.D)+'–'+num(row.L)+'</span> · ':'')+'<span class="num">'+num(row['Pts For'])+'</span> points for</span>'
   +formHTML(team,'')+'</div>'+(cap?lowerThird(cap.k,cap.t,(t0||0)+0.9):'');
}
/* the featured player of an XI scene: the article's player to watch when he is in this XI, else the key man */
function mxFeature(team,xi,art){
  if(art&&art.ptw&&art.ptw.code){const p=xi.find(x=>String(x.Code)===String(art.ptw.code));if(p)return {p,k:'Star man · '+p.Player,t:clip(art.ptw.line,170)};}
  const km=mxKeyMan(team,xi);if(!km)return null;
  const p=km.p,ep=epOf(p.Code),pts=num(p['GW pts']),mins=num(p['GW mins']);
  const nf=nextClubFixture(p.Club);const fx=nf?(nf.Home===p.Club?'v ':'at ')+clubName(nf.Home===p.Club?nf.Away:nf.Home):'';
  const line=km.lab==='pts'?(pts+' points from '+mins+' minutes so far, '+FIRSTOF(team)+'’s top scorer this week.')
    :(fmt1(km.v)+' projected, the highest in '+FIRSTOF(team)+'’s XI'+(fx?', '+fx:'')+'.');
  return {p,k:'Star man · '+p.Player,t:line};
}
function mxXI(team,side,t0,art,carry){
  const as=autoSubs(team,true);const xi=as.xi;
  const order=['FWD','MID','DEF','GKP'];
  /* deal from the keeper upward: delays run GK → DEF → MID → FWD, DOM order stays top-down */
  const seq=['GKP','DEF','MID','FWD'].flatMap(p=>xi.filter(x=>x.Pos===p));
  const fast=!!(typeof SHOWCAP!=='undefined'&&SHOWCAP); /* the narrated show deals faster and flips sooner */
  const delayOf=p=>t0+0.5+seq.indexOf(p)*(fast?0.15:0.2);
  const feat=mxFeature(team,xi,art);const fAt=t0+(fast?2.4:3.6);
  const rows=order.map(p=>{const g=xi.filter(x=>x.Pos===p);if(!g.length)return'';
    return '<div class="prow'+(g.length===5?' five':'')+'">'+g.map(x=>{const isF=feat&&x===feat.p;return '<div class="deal'+(isF?' focus':(feat?' other':''))+'" style="--d:'+delayOf(x).toFixed(2)+'s;--f0:'+fAt.toFixed(2)+'s'+(fast?';--fh:2.6s':'')+'">'+card(x,D.ro.indexOf(x))+'</div>';}).join('')+'</div>';}).join('');
  const km=mxKeyMan(team,xi);
  const started=xi.every(p=>fxStarted(p.Club));
  const tot=started?xi.reduce((s,p)=>s+num(p['GW pts']),0):teamProj(team);
  return '<div class="lgtag"><span class="cr">'+crestOf(team,26)+'</span><b>'+esc(team)+'</b><span>'+formation(xi)+(lineupsLocked()?'':' · projected')+'</span></div>'
   +'<div class="lgpitch"><div class="in">'+rows+'</div></div>'
   +'<div class="strip" style="animation-delay:'+(t0+2.9).toFixed(2)+'s"><span><i>'+(started?'Points':'Projected')+'</i><b class="num">'+(started?Math.round(tot):fmt1(tot))+'</b></span>'
   +'<span class="mid"><i>'+esc(team)+'</i><b>'+formation(xi)+'</b></span>'
   +'<span><i>Form</i>'+formHTML(team,'')+'</span></div>'
   +(carry?lowerThird(carry.k,carry.t,t0+0.3,'carry',feat?fAt:undefined):'')
   +(feat?lowerThird(feat.k,feat.t,fAt,'star'):'');
}
function mxFinal(f,art,t0){
  const {st,nums,lab}=mxScore(f);
  const row=t=>D.st.find(s=>s.Team===t)||{};
  const H=(TEAMS[f.Home]||{}).col||'#5B1A66',A=(TEAMS[f.Away]||{}).col||'#5B1A66';
  const tr=(l,r,k)=>{const tot=(l+r)||1;return '<div class="tr"><b class="num">'+l+'</b><div class="tl"><em>'+k+'</em><div class="tb"><i style="flex:'+(l/tot)+';background:'+H+'"></i><i style="flex:'+(r/tot)+';background:'+A+'"></i></div></div><b class="num">'+r+'</b></div>';};
  const hxi=effXiOf(f.Home,true),axi=effXiOf(f.Away,true);
  const kh=mxKeyMan(f.Home,hxi),ka=mxKeyMan(f.Away,axi);
  const fact=factFor(f),sr=series(f.Home,f.Away);
  const tag={pred:'Predicted',live:'Live',prov:'Provisional',ft:'Full time'}[st];
  const side=(t,cls)=>'<div class="fs '+cls+'"><span class="cr">'+crestOf(t,92)+'</span><b>'+esc(t)+'</b><i>'+esc(FIRSTOF(t))+'</i></div>';
  return '<div class="faceoff">'+side(f.Home,'h')+'<div class="vsbug">'+(tag===lab?'':'<span class="tg'+(st==='live'?' live':'')+'">'+tag+'</span>')+'<div class="sc"><span class="num">'+nums[0]+'</span><i>–</i><span class="num">'+nums[1]+'</span></div><span class="lab">'+esc(lab)+'</span></div>'+side(f.Away,'a')+'</div>'
   +'<div class="frow">'+formHTML(f.Home)+'<span class="srs">'+esc(sr||'First meeting')+'</span>'+formHTML(f.Away,'r')+'</div>'
   +'<div class="tape">'+tr(num(row(f.Home)['Pts For']),num(row(f.Away)['Pts For']),'Points for')+tr(num(row(f.Home)['League Pts']),num(row(f.Away)['League Pts']),'League points')+'</div>'
   +'<div class="keymen">'+(kh?'<div class="km h"><span class="k">Key man</span><b>'+esc(kh.p.Player)+'</b><em class="num">'+(kh.lab==='pts'?Math.round(kh.v):fmt1(kh.v))+' <small>'+kh.lab+'</small></em></div>':'<div></div>')
   +(ka?'<div class="km a"><span class="k">Key man</span><b>'+esc(ka.p.Player)+'</b><em class="num">'+(ka.lab==='pts'?Math.round(ka.v):fmt1(ka.v))+' <small>'+ka.lab+'</small></em></div>':'<div></div>')+'</div>'
   +mxOverlap(hxi,axi)
   +(fact?'<div class="mxfact">'+esc(fact)+'</div>':'')
   +(art&&art.hits&&art.hits[0]?lowerThird(art.hits[0].b?clip(art.hits[0].b,70):'The talking point',clip(art.hits[0].t||art.hits[0].b,170),(t0||0)+1.0,'',art.hits[1]?(t0||0)+4.6:undefined):'')
   +(art&&art.hits&&art.hits[1]?lowerThird(art.hits[1].b?clip(art.hits[1].b,70):'Also',clip(art.hits[1].t||art.hits[1].b,170),(t0||0)+4.9):'');
}
/* ---- the written preview rides along: per-matchup story, player to watch and the first talking point, parsed from the preview page ---- */
let ARTICLE=null;
function loadArticle(){
  if(ARTICLE)return Promise.resolve(ARTICLE);
  const p=(typeof PREVIEWS!=='undefined'?PREVIEWS:[]).find(x=>x.gw===D.gw);
  if(!p)return Promise.resolve(ARTICLE={});
  return fetch(p.href,{cache:'no-store'}).then(r=>r.text()).then(html=>{
    const doc=new DOMParser().parseFromString(html,'text/html');const out={};
    doc.querySelectorAll('.card').forEach(c=>{
      const tn=[...c.querySelectorAll('.tm .tn')].map(x=>x.textContent.trim());if(tn.length<2)return;
      const ph=c.querySelector('.pstrip .ph');
      out[tn[0]+'|'+tn[1]]={kick:(c.querySelector('.kick')||{}).textContent||'',story:(c.querySelector('.story')||{}).textContent||'',
        hits:[...c.querySelectorAll('.hits li')].map(li=>({b:(li.querySelector('b')||{}).textContent||'',t:li.textContent.replace((li.querySelector('b')||{}).textContent||'','').trim()})),
        ptw:ph?{code:ph.dataset.code||'',name:(c.querySelector('.pname')||{}).textContent||'',line:(c.querySelector('.pline')||{}).textContent||''}:null,
        notm:c.querySelector('.notm')?{n:(c.querySelector('.notm .n')||{}).textContent||'',c:(c.querySelector('.notm .c')||{}).textContent||''}:null};});
    return ARTICLE=out;}).catch(()=>ARTICLE={});
}
function articleFor(f){if(!ARTICLE)return null;return ARTICLE[f.Home+'|'+f.Away]||ARTICLE[f.Away+'|'+f.Home]||null}
const clip=(t,n)=>{t=String(t||'').replace(/\s+/g,' ').trim();if(t.length<=n)return t;const cut=t.slice(0,n);const i=Math.max(cut.lastIndexOf('. '),cut.lastIndexOf('! '),cut.lastIndexOf('? '));return (i>n*0.45?cut.slice(0,i+1):cut.replace(/\s\S*$/,'')+'…')};
function mxStory(f,art){
  const {nums,lab}=mxScore(f);
  const face=art.ptw&&art.ptw.code?'<span class="ph"><img src="faces/'+art.ptw.code+'.png" alt="" onerror="this.parentNode.style.display=\'none\'"></span>':'';
  const hit=art.hits&&art.hits[0];
  return '<div class="story"><div class="sk">'+esc(clip(art.kick||'',60))+'</div>'
   +'<div class="sface"><span class="cr">'+crestOf(f.Home,64)+'</span><div class="sv"><div class="nn"><b class="num">'+nums[0]+'</b><i>–</i><b class="num">'+nums[1]+'</b></div><span>'+esc(lab)+'</span></div><span class="cr">'+crestOf(f.Away,64)+'</span></div>'
   +'<p class="st">'+esc(clip(art.story,300))+'</p>'
   +(art.ptw?'<div class="ptw">'+face+'<div class="pt"><span class="k">Player to watch</span><b>'+esc(art.ptw.name)+'</b><span class="l">'+esc(clip(art.ptw.line,150))+'</span></div></div>':'')
   +(hit?'<div class="hit"><b>'+esc(hit.b)+'</b> '+esc(clip(hit.t,140))+'</div>':'')
   +'</div>';
}
let MXQ=null; /* playlist: {list:[fixture indices], i} when watching every matchup back to back */
function openMatchGraphic(f,q){
  MXQ=q||null;
  const old=document.getElementById('lgfx');if(old){clearTimeout(old._t);clearTimeout(old._n);old.remove();}
  const saveOpp=OPPMODE;OPPMODE=false;SUBMARK={};
  const nm=derbyName(f.Home,f.Away);
  const H=(TEAMS[f.Home]||{}).col||'#5B1A66',A=(TEAMS[f.Away]||{}).col||'#5B1A66';
  const art=articleFor(f);
  const T=[0,3.0,10.6,13.6,21.2];const LEN=MXQ?28.4:27;
  const sen=art?sentences(art.story):[];
  const capH=art?{k:art.kick||'',t:clip(sen[0]||'',170)}:null;
  const carryH=art?{k:'The matchup',t:clip(sen[1]||sen[0]||'',190)}:null;
  const capA=art?{k:art.notm&&art.notm.n?art.notm.n+' · '+clip(art.notm.c,90):'The matchup',t:clip(sen.slice(2,4).join(' ')||sen[1]||sen[0]||'',200)}:null;
  const carryA=art?{k:'Who plays whom',t:clip(mxOverlapText(f)||(sen[4]||''),190)}:null;
  const scene=(cls,t0,t1,inner)=>'<div class="scene '+cls+'" style="--t0:'+t0+'s;--t1:'+(t1===null?'999s':t1+'s')+'">'+inner+'</div>';
  const scenes=scene('s1 h',T[0],T[1],mxIntro(f.Home,'h',capH,T[0]))+scene('s2 h',T[1],T[2],mxXI(f.Home,'h',T[1],art,carryH))+scene('s3 a',T[2],T[3],mxIntro(f.Away,'a',capA,T[2]))+scene('s4 a',T[3],T[4],mxXI(f.Away,'a',T[3],art,carryA))+scene('s5',T[4],null,mxFinal(f,art,T[4]));
  document.body.insertAdjacentHTML('beforeend','<div id="lgfx" class="lgfx mx" style="--hc:'+H+';--ac:'+A+'">'
   +'<button class="lgx" id="lgx" aria-label="Close">×</button>'
   +'<div class="mxhdr"><span class="g">Gameweek '+D.gw+'</span><span class="d">'+esc(nm||(f.Home+' v '+f.Away))+'</span></div>'
   +'<div class="mxbody">'+scenes+'</div>'
   +'<div class="lgfoot">'+mwWordmark(110)+'<span class="k">'+(MXQ?'<b class="num">'+(MXQ.i+1)+' / '+MXQ.list.length+'</b> · ':'')+'El Matador Tire</span>'
   +(MXQ&&MXQ.i<MXQ.list.length-1?'<button class="watch" id="lgnx">Skip</button>':'<button class="watch" id="lgre">Replay</button>')
   +'<button class="watch" id="lgcl">Close</button></div>'
   +'</div>');
  OPPMODE=saveOpp;
  const g=document.getElementById('lgfx');
  const rows=D.fx.filter(x=>num(x.GW)===D.gw);
  const next=()=>{if(MXQ&&MXQ.i<MXQ.list.length-1){const q={list:MXQ.list,i:MXQ.i+1};const nf=rows[q.list[q.i]];if(nf){openMatchGraphic(nf,q);return true;}}return false;};
  const finish=()=>{clearTimeout(g._t);g.classList.add('done');if(MXQ&&MXQ.i<MXQ.list.length-1){clearTimeout(g._n);g._n=setTimeout(next,1200);}};
  g._t=setTimeout(finish,LEN*1000);
  const close=()=>{clearTimeout(g._t);clearTimeout(g._n);g.remove();MXQ=null;};
  document.getElementById('lgx').onclick=close;document.getElementById('lgcl').onclick=close;
  const re=document.getElementById('lgre');if(re)re.onclick=()=>openMatchGraphic(f,MXQ);
  const nx=document.getElementById('lgnx');if(nx)nx.onclick=()=>{clearTimeout(g._t);clearTimeout(g._n);next();};
  /* tap the body to skip to the end of this matchup */
  g.querySelector('.mxbody').onclick=finish;
}
/* watch every matchup back to back — yours first */
function openAllGraphics(){
  const rows=D.fx.filter(x=>num(x.GW)===D.gw);const mine=myTeam();
  const list=rows.map((f,i)=>i).sort((a,b)=>{const ma=mine&&(rows[a].Home===mine||rows[a].Away===mine)?0:1,mb=mine&&(rows[b].Home===mine||rows[b].Away===mine)?0:1;return ma-mb||a-b});
  if(!list.length)return;
  loadArticle().then(()=>openMatchGraphic(rows[list[0]],{list,i:0}));
}
document.body.addEventListener('click',e=>{const b=e.target.closest('[data-mxall]');if(!b)return;e.stopPropagation();e.preventDefault();openAllGraphics();},true);
document.body.addEventListener('click',e=>{const b=e.target.closest('[data-mx]');if(!b)return;e.stopPropagation();e.preventDefault();
  const f=D.fx.filter(x=>num(x.GW)===D.gw)[+b.dataset.mx];if(f)loadArticle().then(()=>openMatchGraphic(f));},true);
