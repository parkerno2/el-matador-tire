/* v12-clean copy pass (patch_v12_clean.py) */
/* ===== v10 · the gameweek show: the written preview and the graphic as ONE narrated object =====
   Payload: show/gw{N}.json  {gw, open, chapters:[{home,away,star:{h,a},beats:[5 lines]}], close, dur:{clip:seconds}}
   Clips:   show/gw{N}/open.mp3, c{i}b{j}.mp3, close.mp3  (Malcolm Tyre, ElevenLabs)
   The narration drives the picture: every beat is one clip; its scene is dealt when the clip starts and held until
   it ends. No payload for the gameweek = the classic graphic plays as before. ===== */
let SHOW=null,SHOW_TRIED=0,SHOWA=null;
function showBase(){return 'show/gw'+D.gw+'/'}
function loadShow(){
  if(SHOW_TRIED===D.gw||!D.gw)return;SHOW_TRIED=D.gw;SHOW=null;
  /* a show is published together with its written preview (PREVIEWS entry), so only ask for the payload when one exists:
     every other load logged a 404 for show/gwN.json */
  if(!(typeof PREVIEWS!=='undefined'&&PREVIEWS.some(p=>p.gw===D.gw)))return;
  fetch('show/gw'+D.gw+'.json',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(j=>{if(j&&j.gw===D.gw&&j.chapters){SHOW=j;showWarm();}}).catch(()=>{});
}
function showWarm(){ /* warm the HTTP cache so clips start without a gap */
  showClips().forEach(u=>{fetch(u).catch(()=>{});});
}
function showClips(){const b=showBase();const out=[b+'open.mp3',b+'close.mp3'];SHOW.chapters.forEach((c,i)=>c.beats.forEach((_,j)=>out.push(b+'c'+(i+1)+'b'+j+'.mp3')));return out}
function showChapterFor(f){if(!SHOW)return -1;return SHOW.chapters.findIndex(c=>(c.home===f.Home&&c.away===f.Away)||(c.home===f.Away&&c.away===f.Home))}
function showFixture(c){const rows=D.fx.filter(x=>num(x.GW)===D.gw);return rows.find(f=>(f.Home===c.home&&f.Away===c.away)||(f.Home===c.away&&f.Away===c.home))||null}
/* unlock audio inside the tap that started the show — iOS only honours play() from a user gesture */
function showUnlock(firstClip){
  showAudioOff();
  SHOWA=new Audio();SHOWA.preload='auto';SHOWA.src=firstClip;
  const p=SHOWA.play();if(p&&p.catch)p.catch(()=>{});
  /* the lock-screen "Now Playing" card: name it properly while the show runs, and make its buttons drive the show */
  try{if(navigator.mediaSession){navigator.mediaSession.metadata=new MediaMetadata({title:'Gameweek '+D.gw+' preview',artist:'Malcolm Tyre · El Matador Tire',album:'Matchweek',artwork:[{src:'icons/icon-512.png',sizes:'512x512',type:'image/png'},{src:'icons/icon-180.png',sizes:'180x180',type:'image/png'}]});
    navigator.mediaSession.setActionHandler('pause',showPause);navigator.mediaSession.setActionHandler('play',showResume);
    ['seekbackward','seekforward','previoustrack','nexttrack','seekto'].forEach(a=>{try{navigator.mediaSession.setActionHandler(a,null);}catch(e){}});}}catch(e){}
}
/* tear the element down completely — a paused <audio> keeps iOS's lock-screen card alive; an unloaded one does not */
function showAudioOff(){
  if(SHOWA){try{SHOWA.onended=null;SHOWA.onerror=null;SHOWA.pause();SHOWA.removeAttribute('src');SHOWA.load();}catch(e){}SHOWA=null;}
  try{if(navigator.mediaSession){navigator.mediaSession.metadata=null;navigator.mediaSession.playbackState='none';['play','pause'].forEach(a=>navigator.mediaSession.setActionHandler(a,null));}}catch(e){}
}
let SHOWPAUSED=false;
function showPause(){const q=SHOWQ;if(!q)return;SHOWPAUSED=true;clearTimeout(q.g._t);if(SHOWA){try{SHOWA.pause();}catch(e){}}try{navigator.mediaSession.playbackState='paused';}catch(e){}}
function showResume(){const q=SHOWQ;if(!q)return;SHOWPAUSED=false;try{navigator.mediaSession.playbackState='playing';}catch(e){}
  if(SHOWA&&!SHOWA.ended&&SHOWA.src){const p=SHOWA.play();if(p&&p.catch)p.catch(()=>showTimer());}else showEnded();}
/* ---- the cold open and the close card ---- */
function showOpenHTML(){
  const rows=SHOW.chapters.map(c=>{const f=showFixture(c);if(!f)return '';const {nums}=mxScore(f);const nm=derbyName(f.Home,f.Away);
    return '<div class="sofx"><span class="cr">'+crestOf(f.Home,34)+'</span><span class="tn">'+esc(f.Home)+'</span><span class="sc"><b class="num">'+nums[0]+'</b><i>–</i><b class="num">'+nums[1]+'</b></span><span class="tn r">'+esc(f.Away)+'</span><span class="cr">'+crestOf(f.Away,34)+'</span>'+(nm?'<em>'+esc(nm)+'</em>':'')+'</div>';}).join('');
  const dl=gwDeadline(D.gw);
  return '<div class="sopen"><div class="wm">'+mwWordmark(190)+'</div><div class="k">Gameweek '+D.gw+' · The preview</div><div class="ttl">The lineups, the collisions,<br>and the numbers to watch</div>'
   +'<div class="sofxs">'+rows+'</div>'+(dl?'<div class="dl">Deadline '+esc(fmtDL(dl))+'</div>':'')+'</div>';
}
function showCloseHTML(){
  const rows=SHOW.chapters.map(c=>{const f=showFixture(c);if(!f)return '';const {nums}=mxScore(f);
    return '<div class="sofx"><span class="cr">'+crestOf(f.Home,34)+'</span><span class="tn">'+esc(f.Home)+'</span><span class="sc"><b class="num">'+nums[0]+'</b><i>–</i><b class="num">'+nums[1]+'</b></span><span class="tn r">'+esc(f.Away)+'</span><span class="cr">'+crestOf(f.Away,34)+'</span></div>';}).join('');
  return '<div class="sopen close"><div class="k">Gameweek '+D.gw+'</div><div class="ttl">That’s the gameweek</div><div class="sofxs">'+rows+'</div><button class="watch elev" id="shread">Read the full preview</button></div>';
}
function fmtDL(d){try{return d.toLocaleString([], {weekday:'short',hour:'numeric',minute:'2-digit'})}catch(e){return ''}}
/* ---- the show ---- */
let SHOWQ=null; /* {items:[{kind,ch,b,clip,html,cap}], i, only} */
function openShow(only){
  const b=showBase();
  const rows=D.fx.filter(x=>num(x.GW)===D.gw);const mine=myTeam();
  let order=SHOW.chapters.map((c,i)=>i);
  if(only!==undefined&&only>=0)order=[only];
  else order.sort((a,b2)=>{const fa=showFixture(SHOW.chapters[a]),fb=showFixture(SHOW.chapters[b2]);const ma=mine&&fa&&(fa.Home===mine||fa.Away===mine)?0:1,mb=mine&&fb&&(fb.Home===mine||fb.Away===mine)?0:1;return ma-mb||a-b2});
  const items=[];
  if(only===undefined||only<0)items.push({kind:'open',clip:b+'open.mp3',cap:SHOW.open});
  order.forEach((ci,n)=>{const c=SHOW.chapters[ci];const f=showFixture(c);if(!f)return;
    c.beats.forEach((t,j)=>items.push({kind:'beat',ch:ci,n,f,j,clip:b+'c'+(ci+1)+'b'+j+'.mp3',cap:t}));});
  if(only===undefined||only<0){items.push({kind:'close',clip:b+'close.mp3',cap:SHOW.close});items.push({kind:'article'});}
  else items.push({kind:'end'});
  if(!items.length)return;
  showUnlock(items[0].clip);
  const old=document.getElementById('lgfx');if(old){clearTimeout(old._t);clearTimeout(old._n);old.remove();}
  document.body.insertAdjacentHTML('beforeend','<div id="lgfx" class="lgfx mx show" style="--hc:#5B1A66;--ac:#5B1A66">'
   +'<button class="lgx" id="lgx" aria-label="Close">×</button>'
   +'<div class="mxhdr"><span class="g">Gameweek '+D.gw+' · The preview</span><span class="d" id="shd">Malcolm Tyre in the booth</span></div>'
   +'<div class="mxbody" id="shbody"></div>'
   +'<div class="lgfoot">'+mwWordmark(110)+'<span class="k" id="shk"></span>'
   +'<button class="watch" id="shmute" aria-label="Mute">Mute</button><button class="watch" id="shnx">Skip</button><button class="watch" id="lgcl">Close</button></div>'
   +'</div>');
  const g=document.getElementById('lgfx');
  SHOWQ={items,i:-1,only,g};
  const close=()=>{clearTimeout(g._t);showAudioOff();g.remove();SHOWQ=null;lgfxGone();};
  document.getElementById('lgx').onclick=close;document.getElementById('lgcl').onclick=close;
  lgfxArm(close); /* Esc and the phone back button close it like a sheet */
  document.getElementById('shmute').onclick=e=>{if(!SHOWA)return;SHOWA.muted=!SHOWA.muted;e.currentTarget.textContent=SHOWA.muted?'Unmute':'Mute';};
  document.getElementById('shnx').onclick=()=>showSkipChapter();
  g.querySelector('.mxbody').onclick=e=>{if(e.target.closest('button,a,iframe'))return;showNext();};
  if(SHOWA){SHOWA.onended=()=>{if(SHOWQ&&SHOWQ.g===g)showEnded();};SHOWA.onerror=()=>{if(SHOWQ&&SHOWQ.g===g)showTimer();};}
  showNext();
  loadArticle().catch(()=>{});
}
function showEstimate(it){const d=SHOW.dur&&SHOW.dur[(it.clip||'').split('/').pop().replace('.mp3','')];if(d)return d*1000+300;return ((it.cap||'').split(/\s+/).length/2.8+0.8)*1000}
/* every scene holds long enough for its picture: the XI needs the deal (2.7 s) plus the star man's flip and return */
function showHold(it){if(!it)return 0;if(it.kind==='beat')return [3200,5600,3200,5600,5200][it.j]||3000;if(it.kind==='open')return 9000;if(it.kind==='close')return 4500;return 0}
function showEnded(){const q=SHOWQ;if(!q)return;const it=q.items[q.i];const rem=showHold(it)-(Date.now()-(q.t0||0));clearTimeout(q.g._t);if(rem>50)q.g._t=setTimeout(showNext,rem);else showNext();}
function showTimer(){const q=SHOWQ;if(!q)return;const it=q.items[q.i];if(!it)return;clearTimeout(q.g._t);q.g._t=setTimeout(showNext,Math.max(showEstimate(it),showHold(it)));}
function showSkipChapter(){const q=SHOWQ;if(!q)return;const cur=q.items[q.i];let j=q.i+1;while(j<q.items.length&&cur&&q.items[j].kind==='beat'&&cur.kind==='beat'&&q.items[j].ch===cur.ch)j++;q.i=j-1;showNext();}
function showNext(){
  const q=SHOWQ;if(!q)return;q.i++;const it=q.items[q.i];clearTimeout(q.g._t);q.t0=Date.now();
  if(!it){return;}
  const body=document.getElementById('shbody');if(!body)return;
  /* a single chapter ends on its pinned faceoff: keep the last scene, stop the audio, offer Replay */
  if(it.kind==='end'){showAudioOff();q.g.classList.add('done');const nx=document.getElementById('shnx');if(nx){nx.textContent='Replay';nx.onclick=()=>openShow(q.only);}return;}
  /* the outgoing scene fades; the new one is dealt fresh so its animations run from now */
  [...body.querySelectorAll('.scene')].forEach(s=>{s.classList.add('out');setTimeout(()=>s.remove(),520);});
  const saveOpp=OPPMODE;OPPMODE=false;SUBMARK={};
  let html='',cls='';const art=it.f?articleFor(it.f):null;
  const hdr=document.getElementById('shd');
  if(it.kind==='open'){cls='s0';html=showOpenHTML()+lowerThird('Malcolm Tyre',it.cap,0.6,'hi');if(hdr)hdr.textContent='Malcolm Tyre in the booth';}
  else if(it.kind==='close'){cls='s0';html=showCloseHTML()+lowerThird('Malcolm Tyre',it.cap,0.6,'hi');if(hdr)hdr.textContent='That’s the gameweek';}
  else if(it.kind==='article'){cls='s0 art';const p=(typeof PREVIEWS!=='undefined'?PREVIEWS:[]).find(x=>x.gw===D.gw);
    html=p?'<iframe class="shart" src="'+p.href+'" title="Gameweek '+D.gw+' preview"></iframe>':'<div class="sopen"><div class="ttl">The written preview is on the way.</div></div>';
    if(hdr)hdr.textContent='The written preview';const k=document.getElementById('shk');if(k)k.textContent='';const mu=document.getElementById('shmute');if(mu)mu.style.display='none';
    const nx=document.getElementById('shnx');if(nx){nx.textContent='Replay';nx.onclick=()=>openShow(q.only);}}
  else{
    const f=it.f,c=SHOW.chapters[it.ch];const homeFirst=f.Home===c.home;
    const H=(TEAMS[f.Home]||{}).col||'#5B1A66',A=(TEAMS[f.Away]||{}).col||'#5B1A66';q.g.style.setProperty('--hc',H);q.g.style.setProperty('--ac',A);
    if(hdr)hdr.textContent=derbyName(f.Home,f.Away)||(f.Home+' v '+f.Away);
    const k=document.getElementById('shk');if(k)k.innerHTML='<b class="num">'+(it.n+1)+' / '+(q.only>=0?1:SHOW.chapters.length)+'</b>';
    const nx=document.getElementById('shnx');if(nx){nx.textContent='Skip';nx.onclick=()=>showSkipChapter();}
    const side=[c.home,c.home,c.away,c.away][it.j];const sd=side===f.Home?'h':'a';
    const star=it.j===1?c.star&&c.star.h:it.j===3?c.star&&c.star.a:null;
    if(it.j===0||it.j===2){cls='s'+(it.j+1)+' '+sd;html=mxIntro(side,sd,{k:FIRSTOF(side)+'’s week',t:it.cap},0);}
    else if(it.j===1||it.j===3){cls='s'+(it.j+1)+' '+sd;SHOWSTAR=star||null;SHOWCAP=it.cap;html=mxXI(side,sd,0,art,{k:'The eleven',t:it.cap});SHOWSTAR=null;SHOWCAP=null;}
    else{cls='s5';html=mxFinal(f,art,0,{k:'Projected',t:it.cap});}
  }
  OPPMODE=saveOpp;
  body.insertAdjacentHTML('beforeend','<div class="scene '+cls+'" style="--t0:0s;--t1:999s">'+html+'</div>');
  const rd=document.getElementById('shread');if(rd)rd.onclick=()=>showNext();
  if(it.kind==='article'||it.kind==='end')showAudioOff();
  if(it.kind==='article'){const fr=body.querySelector('iframe.shart');if(fr)fr.onload=()=>{try{const d=fr.contentDocument;const x=d&&d.querySelector('.sh-x');if(x)x.style.display='none';}catch(e){}};return;}
  /* the clip */
  if(SHOWA&&it.clip){
    const abs=new URL(it.clip,location.href).href;
    if(SHOWA.src!==abs){SHOWA.src=abs;}
    if(SHOWA.paused||SHOWA.ended||SHOWA.src!==abs){const p=SHOWA.play();if(p&&p.catch)p.catch(()=>showTimer());}
    /* belt and braces: if the clip never ends (stalled load), move on after the estimate + 4 s */
    q.g._t=setTimeout(showNext,Math.max(showEstimate(it),showHold(it))+4000);
  }else showTimer();
}
/* the star man in show mode = the payload's pick; the caption is what is being said */
let SHOWSTAR=null,SHOWCAP=null;
const __mxFeature=mxFeature;
mxFeature=function(team,xi,art){
  if(SHOWSTAR){const p=xi.find(x=>String(x.Code)===String(SHOWSTAR));if(p)return {p,k:'Star man · '+p.Player,t:SHOWCAP||''};}
  const r=__mxFeature(team,xi,art);if(r&&SHOWCAP)r.t=SHOWCAP;return r;
};
/* final scene: one caption instead of the article's talking points when the show narrates */
const __mxFinal=mxFinal;
mxFinal=function(f,art,t0,cap){
  if(!cap)return __mxFinal(f,art,t0);
  const h=__mxFinal(f,null,t0);return h+lowerThird(cap.k,cap.t,(t0||0)+0.9,'hi');
};
/* routing: the show takes the ▶ taps when a payload exists; otherwise the classic graphic */
document.addEventListener('click',e=>{
  const all=e.target.closest('[data-mxall]'),one=e.target.closest('[data-mx]');if(!all&&!one)return;
  if(!SHOW||SHOW.gw!==D.gw)return; /* classic path (body listeners) */
  e.stopImmediatePropagation();e.stopPropagation();e.preventDefault();
  if(all){openShow();return;}
  const f=D.fx.filter(x=>num(x.GW)===D.gw)[+one.dataset.mx];const ci=f?showChapterFor(f):-1;
  if(ci<0){loadArticle().then(()=>openMatchGraphic(f));return;}
  openShow(ci);
},true);
/* leaving the app (home screen, lock) ends the show — no orphaned lock-screen card; ▶ PLAY restarts it */
document.addEventListener('visibilitychange',()=>{if(document.hidden&&SHOWQ){const g=SHOWQ.g;clearTimeout(g._t);showAudioOff();g.remove();SHOWQ=null;lgfxGone();}});
/* fetch the payload once the gameweek is known */
(function(){const __rs=renderScoreboard;renderScoreboard=function(){try{loadShow();}catch(e){}return __rs.apply(this,arguments);};})();
