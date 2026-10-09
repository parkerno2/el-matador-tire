
/* v12-clean copy pass (patch_v12_clean.py) */
/* ===== v10 — Matchday frame. Overrides declared after the app script; everything else untouched. ===== */
const CREST = {
  PN:{c1:'#3D6BFF',c2:'#1E3FBF',name:'Cold Palmers',emblem:`
    <!-- frozen palm: trunk + 5 fronds + snowflake -->
    <g stroke="#fff" stroke-width="4.6" stroke-linecap="round" fill="none">
      <path d="M50 74 L50 46"/>
      <path d="M50 46 C 42 38, 32 36, 24 40"/>
      <path d="M50 46 C 44 34, 36 28, 26 28"/>
      <path d="M50 46 C 50 32, 46 24, 40 20"/>
      <path d="M50 46 C 56 32, 64 26, 74 26"/>
      <path d="M50 46 C 58 38, 68 36, 76 41"/>
    </g>
    <g stroke="#BFE0FF" stroke-width="3" stroke-linecap="round">
      <path d="M63 60 v12 M57 66 h12 M58.8 61.8 l8.4 8.4 M67.2 61.8 l-8.4 8.4"/>
    </g>`},
  BS:{c1:'#9B59C9',c2:'#5B1A66',name:'Trophy Hunters',emblem:`
    <!-- trophy in a crosshair -->
    <circle cx="50" cy="47" r="26" fill="none" stroke="#fff" stroke-width="3" opacity=".55"/>
    <g stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".55">
      <path d="M50 15 v9 M50 70 v9 M18 47 h9 M73 47 h9"/>
    </g>
    <g fill="#fff">
      <path d="M40 34 h20 v8 a10 10 0 0 1 -20 0 z"/>
      <path d="M38 36 a6 6 0 0 1 -6 6 M62 36 a6 6 0 0 0 6 6" stroke="#fff" stroke-width="3.4" fill="none" stroke-linecap="round"/>
      <rect x="47" y="50" width="6" height="7" rx="1"/>
      <rect x="42" y="57" width="16" height="4.5" rx="2"/>
    </g>`},
  CT:{c1:'#12BFA0',c2:'#03705F',name:'The Soaring Gulls',emblem:`
    <!-- gull over waves -->
    <g stroke="#fff" stroke-width="5" stroke-linecap="round" fill="none">
      <path d="M26 40 C 34 30, 44 30, 50 38 C 56 30, 66 30, 74 40"/>
    </g>
    <g stroke="#CFF6EE" stroke-width="3.6" stroke-linecap="round" fill="none">
      <path d="M28 60 q6 -6 12 0 t12 0 t12 0 t12 0" opacity=".9"/>
      <path d="M33 69 q6 -6 12 0 t12 0 t12 0" opacity=".55"/>
    </g>`},
  PJ:{c1:'#EF3B4A',c2:'#9E0716',name:'Devils U21s',emblem:`
    <!-- trident + horns -->
    <g stroke="#fff" stroke-width="4.4" stroke-linecap="round" fill="none">
      <path d="M50 76 V38"/>
      <path d="M38 34 v8 a12 12 0 0 0 24 0 v-8"/>
      <path d="M38 34 l-3 -7 M62 34 l3 -7"/>
      <path d="M50 38 l-6 -9 M50 38 l6 -9"/>
    </g>
    <path d="M44 29 l6 -11 6 11" stroke="#fff" stroke-width="4.4" stroke-linejoin="round" fill="none"/>`},
  EG:{c1:'#FFCB47',c2:'#C98A0A',name:'I Am a Baleba',emblem:`
    <!-- bolt through a ring — the engine-room badge -->
    <circle cx="50" cy="47" r="24" fill="none" stroke="#3B2A05" stroke-width="4" opacity=".85"/>
    <path d="M55 20 L38 50 h10 L45 74 L64 42 h-11 z" fill="#3B2A05"/>`},
  BK:{c1:'#FF8A2A',c2:'#C24E00',name:'Kobbie Mainoo Fan',emblem:`
    <!-- devotion flame + star -->
    <path d="M50 22 C 60 32, 64 40, 64 50 a14 14 0 0 1 -28 0 c0 -7 3 -11 7 -16 c0 6 2 9 6 11 c-1 -8 0 -16 11 -23z" fill="#fff" opacity=".95"/>
    <path d="M50 56 l2.7 5.6 6.2.8 -4.5 4.3 1.1 6.1 -5.5 -2.9 -5.5 2.9 1.1 -6.1 -4.5 -4.3 6.2 -.8z" fill="#FFE2B8"/>`},
  JS:{c1:'#A97B63',c2:'#5E4033',name:'Team Jacob',emblem:`
    <!-- Jacob's ladder to a star -->
    <g stroke="#fff" stroke-width="4.4" stroke-linecap="round">
      <path d="M38 78 L46 26 M62 78 L54 26"/>
      <path d="M40.5 66 h19 M43 52 h16.5 M45.5 38 h13"/>
    </g>
    <path d="M50 14 l2.4 5 5.6.7 -4 3.9 1 5.5 -5 -2.6 -5 2.6 1 -5.5 -4 -3.9 5.6 -.7z" fill="#FFD98F"/>`},
  NG:{c1:'#D643C0',c2:'#8A1279',name:'In It to McGinn It',emblem:`
    <!-- thistle (the McGinn) -->
    <g fill="#fff">
      <path d="M50 30 c9 0 14 6 14 13 c0 8 -6 13 -14 13 c-8 0 -14 -5 -14 -13 c0 -7 5 -13 14 -13z" opacity=".95"/>
      <path d="M50 24 l3 7 h-6z"/>
    </g>
    <g stroke="#F7CFF2" stroke-width="2.6" stroke-linecap="round">
      <path d="M42 38 v14 M50 36 v18 M58 38 v14"/>
    </g>
    <g stroke="#fff" stroke-width="4" stroke-linecap="round" fill="none">
      <path d="M50 56 V76 M50 66 C 44 64, 40 60, 39 56 M50 70 C 56 68, 60 64, 61 60"/>
    </g>`},
};
/* ---- customisation: 12 colourways + 5 crest shapes (each team keeps its own emblem) ---- */
const PALETTE=[
  {id:'royal',name:'Royal',c1:'#3D6BFF',c2:'#1E3FBF',col:'#2E5BFF'},
  {id:'sky',name:'Sky',c1:'#2EC4FF',c2:'#0B7FC9',col:'#1AA7E8'},
  {id:'navy',name:'Navy',c1:'#2A3A8C',c2:'#0E1440',col:'#1F2A6B'},
  {id:'amethyst',name:'Amethyst',c1:'#9B59C9',c2:'#5B1A66',col:'#8E44AD'},
  {id:'magenta',name:'Magenta',c1:'#D12BB8',c2:'#7A0F6B',col:'#B5179E'},
  {id:'aurora',name:'Aurora',c1:'#04F5FF',c2:'#8E44AD',col:'#2E5BFF'},
  {id:'gold',name:'Gold',c1:'#FFCB47',c2:'#C98A0A',col:'#F0B323'},
  {id:'crimson',name:'Crimson',c1:'#EF3B4A',c2:'#9E0716',col:'#D6001C'},
  {id:'tangerine',name:'Tangerine',c1:'#FF8A2A',c2:'#C24E00',col:'#E8710A'},
  {id:'umber',name:'Umber',c1:'#A97B63',c2:'#5E4033',col:'#795548'},
  {id:'forest',name:'Forest',c1:'#1DA86F',c2:'#065A3C',col:'#0E8A5F'},
  {id:'teal',name:'Teal',c1:'#12BFA0',c2:'#03705F',col:'#00A88F'}];
const SHAPES=[
  {id:'shield',name:'Shield',d:'M50 4 L88 12 C90 46 84 78 50 104 C16 78 10 46 12 12 Z',gloss:'M50 4 L88 12 C89 27 88 30 87 38 C60 46 30 40 13 30 C12.5 24 12.4 17 12 12 Z'},
  {id:'heater',name:'Heater',d:'M14 8 H86 V50 C86 80 66 98 50 105 C34 98 14 80 14 50 Z',gloss:'M14 8 H86 V34 C60 44 30 40 14 30 Z'},
  {id:'roundel',name:'Roundel',d:'M50 8 A46 46 0 1 1 49.9 8 Z',gloss:'M12 40 C20 18 40 8 50 8 C60 8 80 18 88 40 C60 50 30 46 12 40 Z'},
  {id:'pennant',name:'Pennant',d:'M14 8 H86 V60 L50 105 L14 60 Z',gloss:'M14 8 H86 V32 C60 42 30 38 14 28 Z'},
  {id:'hex',name:'Badge',d:'M50 5 L89 24 V74 L50 105 L11 74 V24 Z',gloss:'M50 5 L89 24 V36 C60 46 30 42 11 34 V24 Z'}];
const PALETTE_BY=Object.fromEntries(PALETTE.map(p=>[p.id,p]));
const SHAPE_BY=Object.fromEntries(SHAPES.map(s=>[s.id,s]));
let __cid=0;
function crestSVG(m, size=64, opt){
  const t=CREST[m]; if(!t) return '';
  const o=opt||{};
  const c1=o.c1||t.c1,c2=o.c2||t.c2,sh=SHAPE_BY[o.shape||t.shape||'shield']||SHAPES[0];
  const useIni=o.emblem!==undefined?o.emblem==='initials':t.useIni===true;
  const emblem=useIni?'<text x="50" y="66" text-anchor="middle" font-family="\'Saira Condensed\',sans-serif" font-weight="700" font-size="'+(m.length>2?34:44)+'" letter-spacing="1" fill="#fff" style="paint-order:stroke" stroke="rgba(0,0,0,.25)" stroke-width="1.5">'+m+'</text>':t.emblem;
  const id='cg'+m+(__cid++);
  return `<svg width="${size}" height="${size}" viewBox="0 0 100 108" fill="none" aria-label="${t.name} crest">
  <defs>
    <linearGradient id="${id}" x1="20" y1="6" x2="80" y2="100" gradientUnits="userSpaceOnUse">
      <stop stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/>
    </linearGradient>
    <linearGradient id="${id}s" x1="50" y1="4" x2="50" y2="60" gradientUnits="userSpaceOnUse">
      <stop stop-color="#fff" stop-opacity=".34"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <path d="${sh.d}" fill="url(#${id})" stroke="#140A18" stroke-width="4.5" stroke-linejoin="round"/>
  <path d="${sh.d}" transform="translate(50 54) scale(.86) translate(-50 -54)" fill="none" stroke="#fff" stroke-opacity=".38" stroke-width="2.2"/>
  <g transform="translate(0,6)">${emblem}</g>
  <path d="${sh.gloss}" fill="url(#${id}s)" style="mix-blend-mode:soft-light"/>
</svg>`;
}



function crestOf(team,size){const m=TEAMS[team]&&TEAMS[team].ini;return m?crestSVG(m,size||38):''}
mg=(name,sm)=>{const t=TEAMS[name];if(!t)return'';return '<span class="mg cr'+(sm?' sm':'')+'">'+crestSVG(t.ini,sm?26:38)+'</span>'};
const FIRSTOF=t=>FIRST[(TEAMS[t]||{}).ini]||((TEAMS[t]||{}).mgr||'').split(' ')[0]||t;
const SHORTOF={};Object.keys(LEAGUE.teams).forEach(t=>{SHORTOF[t]=LEAGUE.teams[t].short});
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
  /* the base route() marked the current tab before this rebuild; mark it again (cold load and deep links showed five idle tabs) */
  const curV=(location.hash||'#gw').slice(1).split('/')[0];
  document.querySelectorAll('nav [data-v]').forEach(b=>b.classList.toggle('on',b.dataset.v===curV));
  const top=document.querySelector('.top .in')||document.querySelector('.top');
  if(top&&!document.getElementById('hright')){
    /* v11 header: brand · GW pill centred · ↻ refresh + avatar. The "?" moved to the page foot (help link). */
    top.insertAdjacentHTML('beforeend','<span class="hright" id="hright"><button class="hbtn" id="hrefresh" aria-label="Refresh scores" title="Refresh"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v5h-5"/></svg></button><span class="hav" id="hav" title="My team"></span></span>');
    document.getElementById('hav').onclick=()=>{location.hash='team'};
    const ft=document.querySelector('.wrap > .foot');
    if(ft&&!document.getElementById('hfaq'))ft.insertAdjacentHTML('beforebegin','<p class="helpfoot"><button id="hfaq" type="button"><b>?</b> How it works</button></p>');
    const hq=document.getElementById('hfaq');if(hq)hq.onclick=()=>{FAQ_FROM=(location.hash||'#gw').slice(1).split('/')[0];location.hash='faq'};
  }
  updateHeader();
}
/* ---- How it works: the FAQ left the nav, so the page itself carries the way back (‹ Table, ‹ Matchday …) ---- */
let FAQ_FROM=null;
const FAQ_NAMES={gw:'Matchday',team:'My team',table:'Table',xis:'Players',ana:'Lab'};
function faqBack(){
  const v=document.getElementById('v-faq');if(!v)return;
  let b=document.getElementById('faqback');
  if(!b){v.insertAdjacentHTML('afterbegin','<div class="faqtop"><button class="backbtn" id="faqback" type="button"></button></div>');b=document.getElementById('faqback');
    b.onclick=()=>{if(FAQ_FROM){FAQ_FROM=null;history.back();}else location.hash='gw';};}
  b.textContent='‹ '+(FAQ_NAMES[FAQ_FROM]||'Matchday');
}
addEventListener('hashchange',()=>{if((location.hash||'').slice(1).split('/')[0]==='faq')faqBack();});
if((location.hash||'').slice(1).split('/')[0]==='faq')faqBack();
/* ---- full-screen overlays (#lgfx: lineup graphic, matchup graphic, the show): Esc and the phone back button close
   them the way they close sheets. One history entry per open; the overlay's own × goes through the same path. ---- */
let LGFX_PUSHED=false;
function lgfxArm(close){
  const g=document.getElementById('lgfx');if(!g)return;g._close=close;
  if(!LGFX_PUSHED){try{history.pushState({emtLg:1},'');LGFX_PUSHED=true;}catch(e){}}
}
function lgfxGone(){if(LGFX_PUSHED){LGFX_PUSHED=false;try{history.back()}catch(e){}}}
window.addEventListener('popstate',()=>{
  if(!LGFX_PUSHED)return;LGFX_PUSHED=false;
  const g=document.getElementById('lgfx');if(g){if(g._close)g._close();else g.remove();}
});
addEventListener('keydown',e=>{
  if(e.key!=='Escape')return;const g=document.getElementById('lgfx');if(!g)return;
  if(g._close)g._close();else{g.remove();lgfxGone();}
});
function heroCopy(){const k=document.querySelector('#v-gw .hero .kick'),h=document.querySelector('#v-gw .hero h1');if(k)k.textContent='Gameweek '+(D.gw||'');if(h)h.textContent='Matchday';const a=document.querySelector('#v-ana .hero h1');if(a)a.textContent='The Lab';}
function updateHeader(){
  const hv=document.getElementById('hav');if(!hv)return;
  const mine=myTeam();
  hv.innerHTML=mine?crestOf(mine,28):'<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#C9B8D6" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21v-.5a8 8 0 0 1 16 0v.5"/></svg>';
}
/* ---- the league clock: the header pill states the present tense ---- */
let V10_DLT=0,V10_DLKICK=0;
function v10clock(){
  const p=document.getElementById('gwpill');if(!p||!D.mw||!D.mw.length)return;
  const dl=gwDeadline(D.gw);
  if(!D.dlPassed&&dl){const ms=dl-Date.now();
    if(ms>0){const d2=Math.floor(ms/864e5),h=Math.floor(ms%864e5/36e5),m=Math.floor(ms%36e5/6e4);
      p.textContent='GW'+D.gw+' · '+(d2>0?d2+'d '+h+'h':h>0?h+'h '+m+'m':Math.max(1,m)+'m');p.className='gwpill';
      /* the last half-minute: tick again right at the deadline instead of waiting for the 30-second interval */
      if(ms<35000){clearTimeout(V10_DLT);V10_DLT=setTimeout(v10clock,ms+300);}}
    /* the deadline passed while the app was open: re-read the sheet now (the same re-render a reload does), once per deadline */
    else if(V10_DLKICK!==dl.getTime()){V10_DLKICK=dl.getTime();loadAll(true);}}
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
  const tag={pred:'<span class="tg">Predicted</span>',live:'<span class="tg live">Live</span>',prov:'<span class="tg prov">Provisional</span>',ft:'<span class="tg ft">Full time</span>'}[st];
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
  if(D.provOver)html+='<div class="provnote" style="margin-top:12px"><b>All matches finished. Provisional result.</b> '+(Object.keys(D.pbonus||{}).length?'Estimated bonus (from live BPS) is counted. ':'')+'FPL usually confirms within a few hours.</div>';
  const first=order[0];
  const yours=mine&&(rows[first].Home===mine||rows[first].Away===mine);
  const sts=rows.map(f=>bugState(f));const uniform=sts.every(x=>x===sts[0]);
  const stTag={pred:'',live:'<span class="tg live">Live</span>',prov:'<span class="tg prov">Provisional</span>',ft:'<span class="tg ft">Full time</span>'}[sts[0]]||'';
  const p3=(typeof PREVIEWS!=='undefined'?PREVIEWS:[]).find(x=>x.gw===D.gw);
  html+='<a class="recapcard show" data-mxall="1" href="#" style="margin-top:12px"><div><div class="rk">Gameweek '+D.gw+' preview<span class="new">WATCH</span></div><div class="rt">'+(p3?esc(p3.title):'Every matchup and lineup in about a minute')+'</div><div class="rs">Lineups, the players to watch and the talking points · about 90 seconds</div></div><span class="go">PLAY</span></a>';
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
  const bb=document.getElementById('gwback');if(bb){bb.textContent='‹ Matchday';st.insertAdjacentElement('afterbegin',bb);} /* v11: the back button rides inside the stage (no light bar between header and stage) */
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
  /* 13 Sep fix: form and season average now come from the SAME source (GW Stats per GW). The old avg was
     Season pts / gwsDone — Season pts already includes the live gameweek, so mid-GW every player read
     below average and "Trending up" was always empty. The live GW counts for a player only once his club
     has kicked off; the window is his last 3 counted gameweeks against his mean over all of them. */
  const all=Object.keys(D.gwsByGw||{}).map(Number).filter(g=>g<D.gw||(g===D.gw&&D.dlPassed)).sort((a,b)=>a-b);
  if(!all.length)return '';
  const last=all.slice(-3);
  const rows=squadOf(team).map(p=>{
    const mine=all.filter(g=>g<D.gw||fxStarted(p.Club));if(mine.length<2)return null;
    const at=g=>((D.gwsByGw[g]||{})[String(p.Code)]||{}).Pts||0;
    const win=mine.slice(-3);
    const l3=win.reduce((s,g)=>s+at(g),0)/win.length;
    const avg=mine.reduce((s,g)=>s+at(g),0)/mine.length;
    return {p,l3,d:l3-avg};}).filter(r=>r&&Math.abs(r.d)>=0.5&&(r.l3>0||r.d<0));
  const up=rows.filter(r=>r.d>0).sort((a,b)=>b.d-a.d).slice(0,3),dn=rows.filter(r=>r.d<0).sort((a,b)=>a.d-b.d).slice(0,3);
  const li=(r,c)=>'<div class="hr"><b>'+esc(r.p.Player)+'</b><span>'+fmt1(r.l3)+' / GW</span><span class="d '+c+'">'+(r.d>0?'+':'−')+fmt1(Math.abs(r.d))+'</span></div>';
  return '<h2 class="v10">Squad health<span class="lnk" style="cursor:default">last '+last.length+' GW'+(last.length>1?'s':'')+'</span></h2><div class="health">'
   +'<div class="card"><span class="hk up">▲ Trending up</span>'+(up.length?up.map(r=>li(r,'up')).join(''):'<span class="hr"><span>–</span></span>')+'</div>'
   +'<div class="card"><span class="hk dn">▼ Trending down</span>'+(dn.length?dn.map(r=>li(r,'dn')).join(''):'<span class="hr"><span>–</span></span>')+'</div></div>';
}
let FIXOPEN=true; /* the grid no longer collapses (the heading is a heading); kept so nothing that reads it breaks */
function nextFive(team){
  /* every club in the 15-man squad, XI slots first (the label promises your players' clubs, not your XI's) */
  const sq=squadOf(team).slice().sort((a,b)=>(num(a.Slot)||99)-(num(b.Slot)||99));const clubs=[...new Set(sq.map(p=>p.Club))];
  const gws=[0,1,2,3,4].map(i=>D.gw+i);
  const cell=(c,g)=>{const fs=(D.cf||[]).filter(x=>num(x.GW)===g&&(x.Home===c||x.Away===c));if(!fs.length)return '<span class="x">–</span>';
    return '<span class="fxc'+(fs.length>1?' dbl':'')+'">'+fs.map(f=>{const h=f.Home===c,opp=h?f.Away:f.Home,n=fdrOf(c,f);
      return '<span class="fd" style="background:'+FDRCOL[n]+';color:'+FDRTXT[n]+'" title="'+esc(clubName(opp))+' ('+(h?'H':'A')+') · difficulty '+n+'">'+badgeImg(opp,16)+'<i>'+(h?'H':'A')+'</i></span>';}).join('')+'</span>';};
  return '<div class="card fixt" style="padding:0;margin:0 0 10px"><div class="fh" id="fixh">Next five · your clubs</div>'
   +'<div class="fg"><span></span>'+gws.map(g=>'<span>GW'+g+'</span>').join('')+'</div>'+clubs.map(c=>'<div class="fr"><b title="'+esc(clubName(c))+'">'+badgeImg(c,22)+'</b>'+gws.map(g=>cell(c,g)).join('')+'</div>').join('')
   +'<div class="fleg">'+[[2,'Easy'],[3,'Medium'],[4,'Hard'],[5,'Very hard']].map(([n,l])=>'<span style="background:'+FDRCOL[n]+'"></span>'+l).join('')+'</div></div>';
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
    let gwTxt='–',gwSub='This gameweek';
    if(cur){const s=mscore(cur);const my=cur.Home===mine?s.hs:s.as2;const opp=cur.Home===mine?cur.Away:cur.Home;
      if(s.done||s.liveNow){gwTxt=my;gwSub='GW'+D.gw+(s.done?' · final':D.hasEP?' · proj '+fmt1(teamProj(mine)):' · live');}
      else{gwTxt=D.hasEP?fmt1(teamProj(mine)):'–';gwSub='GW'+D.gw+' projected';}}
    tiles.children[0].innerHTML='<b style="font-size:1.9rem;color:var(--p2)">'+gwTxt+'</b><span>'+esc(gwSub)+'</span>';
    tiles.children[2].innerHTML='<b style="font-size:1.9rem">'+num(row['Pts For'])+'</b><span>Points for'+(pos?' · '+ORD(pos):'')+'</span>';
    tiles.insertAdjacentHTML('beforebegin',teamNextLine(mine));
  }
  const extra=teamPitchHTML(mine)+squadHealth(mine)+nextFive(mine);
  if(tiles)tiles.insertAdjacentHTML('afterend',extra);else page.insertAdjacentHTML('beforeend',extra);
  const nl=page.querySelector('.nextline[data-go]');if(nl)nl.onclick=()=>{location.hash=nl.dataset.go};
}
/* every manager's profile sheet gets the same treatment: cards on a pitch, form, who's hot, who they play and when */
const __op=openProfile;openProfile=function(team,intoEl){
  __op(team,intoEl);if(intoEl)return;
  const sh=document.querySelector('#sheet .sh-right');if(!sh||!TEAMS[team])return;document.getElementById('sheet').dataset.team=team;
  const heads=[...sh.querySelectorAll('.posh2')];
  const sq=heads.find(h=>/Current squad/.test(h.textContent));
  if(sq){let n=sq;const stop=heads.find(h=>/Actual vs expected/.test(h.textContent));while(n&&n!==stop){const nx=n.nextElementSibling;n.remove();n=nx;}}
  const nx=sh.querySelector('.sub+.sub, .profstats + .sub');const old=[...sh.querySelectorAll('.sub')].find(x=>/^Next:/.test(x.textContent));if(old)old.remove();
  const hdr=sh.querySelector('h3');if(hdr&&hdr.parentElement&&hdr.parentElement.parentElement){const hd=hdr.parentElement.parentElement;const cr=hd.querySelector('.mg');
    /* the manager photo when there is one (My team already shows it); the crest otherwise */
    const ph=(typeof PROFILE!=='undefined'&&PROFILE[team]||{}).photo;
    if(cr)cr.outerHTML='<span class="cr" style="width:44px;height:44px;flex:none">'+(ph?'<img src="'+ph+'" alt="" style="width:44px;height:44px;border-radius:50%;object-fit:cover;display:block">':crestOf(team,44))+'</span>';hd.insertAdjacentHTML('beforeend','<span style="margin-left:auto">'+formHTML(team,'r')+'</span>');}
  const tiles=sh.querySelector('.profstats');
  const extra=teamNextLine(team)+teamPitchHTML(team)+squadHealth(team)+nextFive(team);
  if(tiles)tiles.insertAdjacentHTML('afterend',extra);
  const nl=sh.querySelector('.nextline[data-go]');if(nl)nl.onclick=()=>{closeSheet();location.hash=nl.dataset.go};
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
    +(sec?(num(lead['League Pts'])===num(sec['League Pts'])?'Level with '+esc(sec.Team)+' · ahead on PF '+lead['Pts For']+'–'+sec['Pts For']:((d=>d+(d===1?' pt':' pts'))(num(lead['League Pts'])-num(sec['League Pts'])))+' clear of '+esc(sec.Team)):'')
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
  if(duel)duel.insertAdjacentHTML('afterend','<div class="asubnote" style="margin-top:8px">Projected lineups. FPL publishes picks at the deadline'+(dl?' ('+dl.toLocaleString(undefined,{weekday:'short',hour:'numeric',minute:'2-digit'})+')':'')+'; until then each manager’s last lineup carries forward, with new signings and flagged players covered by projection.</div>');
};

/* ---- fixture difficulty: FPL's own ratings, 1 to 5, keyed by the sheet's short codes.
   [difficulty when you host them, difficulty when you visit them], which is FPL's team_h/a_difficulty exactly.
   Read from the Clubs tab's Str H and Str A (Code.gs v3.22, from FPL every refresh); this copy is the fallback for a
   sheet without them: FPL's values of 8 Oct 2026 (ROADMAP A7). ---- */
const STRENGTH={ARS:[4,5],AVL:[3,3],BOU:[3,3],BRE:[3,3],BHA:[3,4],CHE:[4,4],COV:[2,2],CRY:[2,3],EVE:[3,3],FUL:[2,3],HUL:[2,2],IPS:[2,2],LEE:[3,3],LIV:[4,4],MCI:[4,5],MUN:[4,4],NEW:[3,3],NFO:[3,3],TOT:[2,3],SUN:[3,3]};
const strengthOf=c=>(D.str&&D.str[c])||STRENGTH[c];
const CLUBNAME={ARS:'Arsenal',AVL:'Aston Villa',BOU:'Bournemouth',BRE:'Brentford',BHA:'Brighton',CHE:'Chelsea',COV:'Coventry City',CRY:'Crystal Palace',EVE:'Everton',FUL:'Fulham',HUL:'Hull City',IPS:'Ipswich Town',LEE:'Leeds',LIV:'Liverpool',MCI:'Man City',MUN:'Man Utd',NEW:'Newcastle',NFO:'Nott’m Forest',TOT:'Spurs',SUN:'Sunderland'};
const FDRCOL={1:'#01FC7A',2:'#01FC7A',3:'#E7E7E7',4:'#FF1751',5:'#80072D'};
const FDRTXT={1:'#0B2A18',2:'#0B2A18',3:'#2A2233',4:'#FFFFFF',5:'#FFFFFF'};
const FDRLAB={1:'Easy',2:'Easy',3:'Medium',4:'Hard',5:'Very hard'};
const clubName=c=>CLUBNAME[c]||c;
function fdrOf(club,f){const opp=f.Home===club?f.Away:f.Home,s=strengthOf(opp);if(!s)return 3;return f.Home===club?s[0]:s[1]}
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
/* team page / manager sheet: the toggle only changes the card bubbles, so re-deal the pitch and bench in place
   (the full renderTeam/openProfile rebuilt the whole page and nudged the sheet's scroll) */
function repaintPitch(root,team){
  const pin=root&&root.querySelector('.mypitch .in'),ben=root&&root.querySelector('.mybench');if(!pin||!ben)return false;
  const tmp=document.createElement('div');tmp.innerHTML=teamPitchHTML(team);
  const rows=tmp.querySelectorAll('.mypitch .in > .prow'),nb=tmp.querySelector('.mybench .prow'),ob=ben.querySelector('.prow');
  if(!rows.length||!nb||!ob)return false;
  pin.querySelectorAll(':scope > .prow').forEach(x=>x.remove());rows.forEach(r=>pin.appendChild(r));ob.replaceWith(nb);
  root.querySelectorAll('.axtog.om button').forEach(x=>x.classList.toggle('on',(x.dataset.om==='1')===OPPMODE));
  return true;
}
document.body.addEventListener('click',e=>{const b=e.target.closest('[data-om]');if(!b)return;OPPMODE=b.dataset.om==='1';const ps=b.closest('#sheet');
  if(ps&&ps.dataset.team){if(!repaintPitch(ps,ps.dataset.team))openProfile(ps.dataset.team);return}
  if((location.hash||'').startsWith('#team')){const mine=myTeam();if(!(mine&&repaintPitch(document.getElementById('teampage'),mine)))renderTeam();}
  else renderGW();});
/* ---- Matchweek plate in the top bar; the league name moves into the hero kickers ---- */
function mwWordmark(w){return '<svg viewBox="0 0 564 152" style="width:'+w+'px;height:auto;display:block;filter:drop-shadow(0 2px 5px rgba(0,0,0,.4))" role="img" aria-label="Matchweek"><defs><linearGradient id="mwE" x1="0" y1="0" x2=".85" y2="1"><stop offset="0" stop-color="#04F5FF"/><stop offset=".45" stop-color="#2E5BFF"/><stop offset="1" stop-color="#8E44AD"/></linearGradient><linearGradient id="mwI" x1="0" y1="0" x2=".4" y2="1"><stop offset="0" stop-color="#101E4E"/><stop offset="1" stop-color="#060B24"/></linearGradient></defs><path d="M16 8 H498 L556 66 V136 L548 144 H16 L8 136 V16 Z" fill="url(#mwI)" stroke="url(#mwE)" stroke-width="6"/><text x="272" y="98" text-anchor="middle" font-family="\'Archivo Black\',sans-serif" font-size="62" letter-spacing="3"><tspan fill="#FFD23F">MATCH</tspan><tspan fill="#FFFFFF">WEEK</tspan></text></svg>'}
(function(){const b=document.querySelector('.top .brand');if(b){b.innerHTML=mwWordmark(60)+'<span class="lg">El Matador<br>Tire</span>';b.style.letterSpacing='0';b.style.display='flex';b.style.alignItems='center';b.style.gap='8px';}
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
  const col=v=>v>=75?'#CDBDF0':v>=40?'#A98DDA':'#7D5FB5'; /* one purple scale on the ink card, lighter = higher percentile */
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
   +'<div class="lgfoot">'+mwWordmark(120)+'<span class="k">'+(opp?(nxf.Home===team?'vs ':'at ')+esc(opp)+' · ':'')+'El Matador Tire</span><button class="watch" id="lgre">Replay</button></div>'
   +'</div>');
  OPPMODE=saveOpp;
  setTimeout(()=>{const g=document.getElementById('lgfx');if(g)g.classList.add('done')},5200); /* guaranteed final frame (throttled/occluded tabs strand CSS animations) */
  const close=()=>{const g=document.getElementById('lgfx');if(g)g.remove();lgfxGone();};
  document.getElementById('lgx').onclick=close;
  document.getElementById('lgre').onclick=()=>openLineup(team);
  lgfxArm(close); /* Esc and the phone back button close it like a sheet */
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
      out+='<a class="recapcard" href="'+r.href+'"><div><div class="rk">Gameweek '+r.gw+' recap<span class="new">NEW</span></div><div class="rt">'+r.title+'</div><div class="rs">'+r.sub+'</div></div><span class="go">READ</span></a>';}
  const p=PREVIEWS.find(p=>p.gw===D.gw||p.gw===D.gwsDone+1);
  if(p){const hide=previewHideAt(p.gw);
    if(!(hide&&Date.now()>hide.getTime()))
      out+='<a class="recapcard prev" href="'+p.href+'"><div><div class="rk">Gameweek '+p.gw+' preview<span class="new">NEW</span></div><div class="rt">'+p.title+'</div><div class="rs">'+p.sub+'</div></div><span class="go">READ</span></a>';}
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
      const note=body.querySelector('.mnote');if(note)note.textContent='Claim your team with a 4-digit PIN to set your photo, colours and crest, or pick one to follow.';
      /* a phone that is still signed in says so, and its button opens what it names (the editor, with Sign out) */
      const at=typeof AUTH!=='undefined'&&AUTH.team&&AUTH.team();const signed=at&&TEAMS[at]?at:null;
      grid.insertAdjacentHTML('beforebegin','<div class="claimrow">'+(signed?'<span class="claimnote">Signed in as '+esc(signed)+'</span>':'')+'<button class="watch elev" data-claim="1">'+(signed?'Edit team':'Claim your team')+'</button></div>');}
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
  else{st='pred';nums=D.hasEP?[teamProj(f.Home).toFixed(1),teamProj(f.Away).toFixed(1)]:['–','–'];lab='Projected';}
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
  const tag={pred:'Projected',live:'Live',prov:'Provisional',ft:'Full time'}[st];
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
  const close=()=>{clearTimeout(g._t);clearTimeout(g._n);g.remove();MXQ=null;lgfxGone();};
  document.getElementById('lgx').onclick=close;document.getElementById('lgcl').onclick=close;
  const re=document.getElementById('lgre');if(re)re.onclick=()=>openMatchGraphic(f,MXQ);
  const nx=document.getElementById('lgnx');if(nx)nx.onclick=()=>{clearTimeout(g._t);clearTimeout(g._n);next();};
  /* tap the body to skip to the end of this matchup */
  g.querySelector('.mxbody').onclick=finish;
  lgfxArm(close); /* Esc and the phone back button close it like a sheet */
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

/* v12-clean copy pass (patch_v12_clean.py) */
/* ===== v10-auth — claim-your-team logins + team profiles. Runs after the app script and v10-delta.js. =====
   Storage: localStorage 'emt-auth' = {team,token} (signed in) · 'emt-myteam' (the app's existing "my team").
   Network: POST JSON as text/plain to D.api only (Apps Script web app), 15s timeout. */
const AUTH_TIMEOUT=15000,AUTH_PHOTO_MAX=45000,AUTH_PHOTO_PX=256;
function authRead(){try{const j=JSON.parse(localStorage.getItem('emt-auth')||'null');return j&&j.team&&j.token?j:null}catch(e){return null}}
const AUTH={
  team(){const a=authRead();return a?a.team:null},
  token(){const a=authRead();return a?a.token:null},
  logout(){try{localStorage.removeItem('emt-auth')}catch(e){}}
};
const authPinOk=pin=>/^\d{4}$/.test(String(pin||''));
const authFirst=t=>typeof FIRSTOF==='function'?FIRSTOF(t):(((TEAMS[t]||{}).mgr||'').split(' ')[0]||t);
function authTeams(){const st=(D.st||[]).map(s=>s.Team).filter(t=>TEAMS[t]);return st.length?st:Object.keys(TEAMS)}
function authClaimedList(){return Array.isArray(D.claimed)?D.claimed:null}
function authIsClaimed(team){const c=authClaimedList();return !!(c&&c.indexOf(team)>-1)}
function authMarkClaimed(team){if(!Array.isArray(D.claimed))D.claimed=[];if(D.claimed.indexOf(team)<0)D.claimed.push(team)}
function authBuildReq(action,fields){return Object.assign({action},fields||{})}
/* the one network path: D.api, POST, text/plain body, 15s abort */
function authPost(req){
  if(!D.api)return Promise.reject(new Error('off'));
  const ac=new AbortController();const t=setTimeout(()=>ac.abort(),AUTH_TIMEOUT);
  return fetch(D.api,{method:'POST',body:JSON.stringify(req),signal:ac.signal}).then(r=>r.json()).finally(()=>clearTimeout(t));
}
function authErrText(e){
  if(!e)return 'Something went wrong.';
  if(e.name==='AbortError')return 'Timed out. Check your signal and try again.';
  return e.message==='off'?'Logins aren’t switched on yet.':'Couldn’t reach the server. Try again.';
}
function authCrestOpts(team,color,shape,emblem){
  const ini=(TEAMS[team]||{}).ini,base=CREST[ini]||{};
  const p=color&&PALETTE.find(x=>x.id===color);
  return {c1:p?p.c1:base.c1,c2:p?p.c2:base.c2,shape:shape||base.shape||'shield',emblem:emblem===undefined?(base.useIni?'initials':''):emblem};
}
function authCrest(team,size,color,shape,emblem){const ini=(TEAMS[team]||{}).ini;return ini?crestSVG(ini,size,authCrestOpts(team,color,shape,emblem)):''}

/* ---- the header/clubhouse button v10-delta places ---- */
function profileButtonHTML(){
  const mine=myTeam();
  return mine&&AUTH.team()===mine?'<button class="watch" data-claim="1">Edit team</button>':'<button class="watch" data-claim="1">Claim your team</button>';
}
document.body.addEventListener('click',e=>{
  const b=e.target.closest('[data-claim]');if(!b)return;e.stopPropagation();
  const mine=myTeam();
  if(AUTH.team()&&(!mine||AUTH.team()===mine))openTeamEditor();else openClaim();
});
function authAfterSignIn(team){
  try{localStorage.setItem('emt-myteam',team)}catch(e){}
  closeSheet();renderTeam();renderGW();
}

/* ---- claim / sign in sheet ---- */
function authTeamGrid(sel){
  return '<div class="au-grid">'+authTeams().map(t=>'<button type="button" class="au-tm'+(t===sel?' on':'')+'" data-tm="'+esc(t)+'"><span class="cr">'+authCrest(t,44)+'</span><b>'+esc(t)+'</b><i>'+esc(authFirst(t))+'</i></button>').join('')+'</div>';
}
function openClaim(){
  let sel=myTeam();if(sel&&!TEAMS[sel])sel=null;
  const off=!D.api;
  sheet.innerHTML='<div class="sh-right au"><button class="sh-x" onclick="closeSheet()">×</button>'
   +'<span class="au-k">Your team</span><h3 id="au-title">'+(off?'Your team':'Claim your team')+'</h3>'
   +(off?'<div class="au-off"><b>Logins aren’t switched on yet</b><span>Parker still has to deploy the web app. You can still pick a team to follow.</span></div>':'<p class="au-sub" id="au-sub">Pick your team and set a 4-digit PIN. Nobody else can claim it after that.</p>')
   +authTeamGrid(sel)
   +(off?'':'<label class="au-pinlab" for="au-pin">PIN</label><input id="au-pin" class="au-pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off" placeholder="••••">'
     +'<div class="au-err" id="au-err" hidden></div><button type="button" class="au-btn" id="au-go">Claim team</button>')
   +'<button type="button" class="au-link" id="au-browse">'+(off?'Pick this team without a PIN':'Just browsing? Pick a team without a PIN')+'</button>'
   +'</div>';
  ov.classList.add('on');sheet.classList.add('on');pushOverlay();
  const $=id=>document.getElementById(id);
  const err=(m)=>{const e=$('au-err');if(!e)return;e.hidden=!m;e.textContent=m||''};
  const mode=()=>sel&&authIsClaimed(sel)?'login':'claim';
  const sync=()=>{
    sheet.querySelectorAll('.au-tm').forEach(b=>b.classList.toggle('on',b.dataset.tm===sel));
    if(off||!$('au-title'))return;
    const m=mode();
    $('au-title').textContent=m==='login'?'Sign in':'Claim your team';
    $('au-sub').textContent=m==='login'?'This team is claimed. Enter its PIN to sign in.':'Pick your team and set a 4-digit PIN. Nobody else can claim it after that.';
    $('au-go').textContent=m==='login'?'Sign in':'Claim team';
  };
  sheet.querySelectorAll('.au-tm').forEach(b=>b.onclick=()=>{sel=b.dataset.tm;err('');sync();if(!off)$('au-pin').focus()});
  $('au-browse').onclick=()=>{if(!sel){err('Pick a team first.');return}authAfterSignIn(sel)};
  sync();
  if(off)return;
  if(!authClaimedList())authPost(authBuildReq('status')).then(r=>{if(r&&r.ok&&Array.isArray(r.claimed)){D.claimed=r.claimed;sync()}}).catch(()=>{});
  const pin=$('au-pin');
  pin.oninput=()=>{pin.value=pin.value.replace(/\D/g,'').slice(0,4);err('')};
  pin.onkeydown=e=>{if(e.key==='Enter')$('au-go').click()};
  $('au-go').onclick=()=>{
    if(!sel){err('Pick your team first.');return}
    if(!authPinOk(pin.value)){err('PIN must be exactly 4 digits.');return}
    const m=mode(),btn=$('au-go');btn.disabled=true;btn.textContent=m==='login'?'Signing in…':'Claiming…';
    authPost(authBuildReq(m,{team:sel,pin:pin.value})).then(r=>{
      if(r&&r.ok&&r.token){try{localStorage.setItem('emt-auth',JSON.stringify({team:sel,token:r.token}))}catch(e){}authMarkClaimed(sel);authAfterSignIn(sel);return}
      const code=(r&&r.error)||'';
      if(code==='wrong')err('Wrong PIN. Try again.');
      else if(code==='locked')err('Too many tries. Locked for '+(r.retryMin||10)+' min.');
      else if(code==='claimed'){authMarkClaimed(sel);err('Already claimed. Sign in with your PIN, or ask Parker to reset it.')}
      else if(code==='unclaimed'){if(Array.isArray(D.claimed))D.claimed=D.claimed.filter(t=>t!==sel);err('Not claimed yet. Set a new PIN to claim it.')}
      else if(code==='badpin')err('PIN must be exactly 4 digits.');
      else err(code?'Server said: '+code:'Something went wrong.');
    }).catch(e=>err(authErrText(e))).finally(()=>{btn.disabled=false;sync()});
  };
}

/* ---- photo: cover-crop to 256×256 JPEG, shrink quality until the data URL fits the sheet cell ---- */
function authCropToCanvas(img,size){
  const c=document.createElement('canvas');c.width=c.height=size;
  const w=img.naturalWidth||img.width,h=img.naturalHeight||img.height,s=Math.min(w,h);
  c.getContext('2d').drawImage(img,(w-s)/2,(h-s)/2,s,s,0,0,size,size);return c;
}
function authShrink(canvas,max,q0,step){
  let q=q0==null?.82:q0;const st=step||.08;let out=canvas.toDataURL('image/jpeg',q);
  while(out.length>max&&q-st>=.2){q=Math.round((q-st)*100)/100;out=canvas.toDataURL('image/jpeg',q)}
  return out.length<=max?out:null;
}
function authResizePhoto(file,size,max){
  size=size||AUTH_PHOTO_PX;max=max||AUTH_PHOTO_MAX;
  return new Promise((res,rej)=>{
    const url=URL.createObjectURL(file);const img=new Image();
    img.onload=()=>{URL.revokeObjectURL(url);try{const out=authShrink(authCropToCanvas(img,size),max);out?res(out):rej(new Error('too big'))}catch(e){rej(e)}};
    img.onerror=()=>{URL.revokeObjectURL(url);rej(new Error('bad image'))};
    img.src=url;
  });
}

/* ---- profile sheet ---- */
function openTeamEditor(){
  const team=AUTH.team();if(!team||!TEAMS[team]){openClaim();return}
  const cur=PROFILE[team]||{};
  const p={color:cur.color||'',shape:cur.shape||'',photo:cur.photo||'',manager:cur.manager||(TEAMS[team].mgr||''),emblem:cur.emblem||''};
  const sw=PALETTE.map(c=>'<button type="button" class="au-sw'+(c.id===p.color?' on':'')+'" data-col="'+c.id+'" title="'+esc(c.name)+'" style="background:linear-gradient(135deg,'+c.c1+','+c.c2+')"></button>').join('');
  sheet.innerHTML='<div class="sh-right au"><button class="sh-x" onclick="closeSheet()">×</button>'
   +'<span class="au-k">Your team</span><h3>Edit team</h3><p class="au-sub">'+esc(team)+'</p>'
   +'<div class="au-hero"><span class="au-big" id="au-big">'+authCrest(team,96,p.color,p.shape)+'</span>'
   +'<div class="au-photo"><span class="au-ph" id="au-ph"></span><div class="au-phb"><button type="button" class="watch" id="au-pick">Choose photo</button><button type="button" class="au-link" id="au-rm">Remove photo</button></div>'
   +'<input type="file" accept="image/*" id="au-file" hidden></div></div>'
   +'<span class="au-k">Colour</span><div class="au-swr">'+sw+'</div>'
   +'<span class="au-k">Crest</span><div class="au-shr" id="au-shr"></div>'
   +'<span class="au-k">Emblem</span><div class="au-shr au-em" id="au-em"></div>'
   +'<label class="au-k" for="au-name">Display name</label><input id="au-name" class="au-in" type="text" maxlength="40" autocomplete="off" placeholder="'+esc(TEAMS[team].mgr||'')+'" value="'+esc(p.manager)+'">'
   +'<div class="au-err" id="au-err" hidden></div>'
   +'<div class="au-actions"><button type="button" class="au-btn" id="au-save">Save</button><button type="button" class="au-link" id="au-out">Sign out</button></div>'
   +'</div>';
  ov.classList.add('on');sheet.classList.add('on');pushOverlay();
  const $=id=>document.getElementById(id);
  const err=m=>{const e=$('au-err');e.hidden=!m;e.textContent=m||''};
  const paint=()=>{
    $('au-big').innerHTML=authCrest(team,96,p.color,p.shape,p.emblem);
    $('au-ph').innerHTML=p.photo?'<img src="'+p.photo+'" alt="">':authCrest(team,56,p.color,p.shape,p.emblem);
    $('au-ph').classList.toggle('has',!!p.photo);$('au-rm').hidden=!p.photo;
    $('au-shr').innerHTML=SHAPES.map(s=>'<button type="button" class="au-shp'+((p.shape||'shield')===s.id?' on':'')+'" data-shp="'+s.id+'" title="'+esc(s.name)+'">'+authCrest(team,40,p.color,s.id,p.emblem)+'</button>').join('');
    $('au-em').innerHTML=[['','Crest art'],['initials','Initials']].map(e=>'<button type="button" class="au-shp au-emb'+((p.emblem||'')===e[0]?' on':'')+'" data-emb="'+e[0]+'">'+authCrest(team,40,p.color,p.shape,e[0])+'<i>'+e[1]+'</i></button>').join('');
    sheet.querySelectorAll('.au-emb').forEach(b=>b.onclick=()=>{p.emblem=b.dataset.emb;paint()});
    sheet.querySelectorAll('.au-sw').forEach(b=>b.classList.toggle('on',b.dataset.col===p.color));
    sheet.querySelectorAll('.au-shp').forEach(b=>b.onclick=()=>{p.shape=b.dataset.shp;paint()});
  };
  sheet.querySelectorAll('.au-sw').forEach(b=>b.onclick=()=>{p.color=b.dataset.col===p.color?'':b.dataset.col;paint()});
  $('au-pick').onclick=()=>$('au-file').click();
  $('au-file').onchange=()=>{const f=$('au-file').files[0];if(!f)return;err('');
    authResizePhoto(f).then(d=>{p.photo=d;paint()}).catch(e=>err(e.message==='too big'?'That photo won’t shrink enough. Try a simpler one.':'Couldn’t read that image.'));$('au-file').value='';};
  $('au-rm').onclick=()=>{p.photo='';paint()};
  $('au-out').onclick=()=>{AUTH.logout();closeSheet();renderTeam()};
  $('au-save').onclick=()=>{
    p.manager=$('au-name').value.replace(/\s+/g,' ').trim().slice(0,40);
    const btn=$('au-save');btn.disabled=true;btn.textContent='Saving…';err('');
    authPost(authBuildReq('save',{team,token:AUTH.token(),color:p.color,shape:p.shape,photo:p.photo,manager:p.manager,emblem:p.emblem})).then(r=>{
      if(r&&r.ok){PROFILE[team]={color:p.color,shape:p.shape,photo:p.photo,manager:p.manager,emblem:p.emblem};applyProfiles();closeSheet();renderTeam();return}
      const code=(r&&r.error)||'';
      if(code==='auth'){AUTH.logout();err('Your sign-in expired. Sign in again.')}
      else if(code==='badphoto')err('That photo is too large. Choose another.');
      else err(code?'Server said: '+code:'Something went wrong.');
    }).catch(e=>err(authErrText(e))).finally(()=>{btn.disabled=false;btn.textContent='Save'});
  };
  paint();
}

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

/* v12-clean copy pass (patch_v12_clean.py) */
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
  /* scores read in the card's column order (r.a left, r.b right), whichever side was at home that week */
  const bits=[];
  if(r.thisGw){const {st,nums,lab}=mxScore(r.thisGw);const flip=r.thisGw.Home!==r.a;const l=flip?nums[1]:nums[0],rt=flip?nums[0]:nums[1];
    bits.push('<b class="now">This week</b> · '+esc(FIRSTOF(r.a))+' <span class="num">'+l+'</span> – <span class="num">'+rt+'</span> '+esc(FIRSTOF(r.b))+' <i>'+esc(lab)+'</i>');}
  else if(r.next){const d=gwDeadline(num(r.next.GW));bits.push('<b>Next</b> · GW'+num(r.next.GW)+(d?' · '+esc(d.toLocaleDateString([], {weekday:'short',month:'short',day:'numeric'})):''));}
  else bits.push('<b>Next</b> · not scheduled this season');
  if(r.last&&!(r.thisGw&&r.last===r.thisGw)){const hp=num(r.last['Home pts']),ap=num(r.last['Away pts']);const w=hp===ap?'draw':(hp>ap?FIRSTOF(r.last.Home):FIRSTOF(r.last.Away))+' won';
    const flip=r.last.Home!==r.a;
    bits.push('<b>Last</b> · GW'+num(r.last.GW)+' · <span class="num">'+(flip?ap+'–'+hp:hp+'–'+ap)+'</span> '+esc(w));}
  return bits.join('<span class="dot">·</span>');
}
function derbyCard(r,idx){
  const rowsGw=D.fx.filter(x=>num(x.GW)===D.gw);const mi=r.thisGw?rowsGw.indexOf(r.thisGw):-1;
  const A=(TEAMS[r.a]||{}).col||'#5B1A66',B=(TEAMS[r.b]||{}).col||'#5B1A66';
  const side=(t,cls)=>'<div class="ds '+cls+'"><span class="cr">'+crestOf(t,40)+'</span><b>'+esc(t)+'</b><i>'+esc(FIRSTOF(t))+'</i></div>';
  return '<div class="dcard'+(r.thisGw?' live':'')+(r.nm?'':' unnamed')+'"'+(mi>=0?' data-mi="'+mi+'" role="button" tabindex="0"':'')+' style="--a:'+A+';--b:'+B+'">'
   +'<div class="dk">'+(r.nm?esc(r.nm):'Unnamed pairing')+(mi>=0?'<span class="go">Open '+CHEV+'</span>':'')+'</div>'
   +'<div class="dvs">'+side(r.a,'l')+'<div class="dsr"><span class="k">All-time</span><b>'+esc(r.sr||'First ever meeting').replace(/ (\([^)]*\))$/,' <span class="nw">$1</span>')+'</b><i>'+(r.played?r.played+(r.played===1?' meeting':' meetings')+' this season':'')+'</i></div>'+side(r.b,'r')+'</div>'
   +'<div class="dm">'+derbyMeta(r)+'</div></div>';
}
function derbiesHTML(){
  const rows=derbyRows();const named=rows.filter(r=>r.nm),un=rows.filter(r=>!r.nm);
  const thisWeek=named.filter(r=>r.thisGw).length;
  return '<h2 class="v10">The derbies<span class="lnk hst">'+named.length+' named'+(thisWeek?' · '+thisWeek+' this week':'')+'</span></h2>'
   +'<div class="stack derbies">'+named.map(derbyCard).join('')+'</div>'
   +(un.length?'<details class="acc dun"><summary>Still unnamed · '+un.length+' pairings</summary><div class="stack derbies">'+un.map(derbyCard).join('')+'</div></details>':'');
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
      /* the cards are role=button tabindex=0: Enter and Space open them too */
      body.onkeydown=e=>{if(e.key!=='Enter'&&e.key!==' ')return;const c=e.target.closest&&e.target.closest('.dcard[data-mi]');if(c){e.preventDefault();location.hash='gw/'+c.dataset.mi;}};
      v10clock&&v10clock();return;}
    body.onkeydown=null;
    body.insertAdjacentHTML('afterbegin',gwTabsHTML());
    const prev=body.onclick;
    body.onclick=e=>{const t=e.target.closest('[data-gwtab]');if(t){GWTAB=t.dataset.gwtab;renderGW();return}if(prev)return prev.call(body,e);};
  };
})();

/* v12-clean copy pass (patch_v12_clean.py) */
/* ===== v10 · player score history: every gameweek so far, FPL-app style, on the player sheet =====
   Source: GW Stats rows (D.gwsByGw / D.gwsCur — all players, per GW) + Club Fixtures for the opponent and result.
   Columns: GW · opponent (H/A, own goals first) · PTS · xP · MIN · G · A · CS · GC, with a totals row. ===== */
function histRows(code){
  const out=[];const gws=Object.keys(D.gwsByGw||{}).map(Number).filter(g=>g>0&&g<=D.gw).sort((a,b)=>a-b);
  if(D.gw&&!gws.includes(D.gw))gws.push(D.gw);
  gws.forEach(g=>{
    const r=(g===D.gw?(D.gwsCur||{}):(D.gwsByGw[g]||{}))[String(code)]||(D.gwsByGw[g]||{})[String(code)];
    if(!r)return;
    if(g===D.gw&&!fxStarted(r.Club)&&!r.Mins&&!r.Pts)return; /* this week hasn't kicked off for him yet */
    const fx=(D.cf||[]).filter(x=>num(x.GW)===g&&(x.Home===r.Club||x.Away===r.Club));
    const opp=fx.map(x=>{const home=x.Home===r.Club;const o=home?x.Away:x.Home;const hg=x['Home goals'],ag=x['Away goals'];
      const has=hg!==''&&hg!==undefined&&hg!==null&&(fin(x.Started)||fin(x.Finished));
      const sc=has?(home?num(hg)+'–'+num(ag):num(ag)+'–'+num(hg)):'';
      return {o,home,sc,live:fin(x.Started)&&!fin(x.Finished)};});
    out.push({g,r,opp,xp:xpOf(r)});
  });
  return out;
}
function histHTML(p){
  const rows=histRows(p.Code);
  if(!rows.length)return '<div class="hist"><h4>This season</h4><p class="hnone">No gameweeks played yet.</p></div>';
  const T={pts:0,xp:0,min:0,g:0,a:0,cs:0,gc:0};
  const tr=rows.map(({g,r,opp,xp})=>{T.pts+=r.Pts;T.xp+=xp;T.min+=r.Mins;T.g+=r.G;T.a+=r.A;T.cs+=r.CS;T.gc+=r.GC;
    const o=opp.length?opp.map(x=>badgeImg(x.o,14)+'<span class="oc">'+esc(x.o)+' <i>('+(x.home?'H':'A')+')</i>'+(x.sc?' <em>'+x.sc+'</em>':'')+(x.live?' <u>live</u>':'')+'</span>').join('<br>'):'<span class="oc">–</span>';
    const cls=r.Pts>=10?'p10':r.Pts>=6?'p6':r.Pts<=1?'p1':'';
    return '<tr'+(g===D.gw?' class="cur"':'')+'><td class="gw">'+g+'</td><td class="opp">'+o+'</td><td class="pts"><b class="'+cls+'">'+r.Pts+'</b></td><td class="xp">'+xp.toFixed(1)+'</td><td>'+r.Mins+'</td><td>'+r.G+'</td><td>'+r.A+'</td><td>'+r.CS+'</td><td>'+r.GC+'</td></tr>';}).join('');
  return '<div class="hist"><h4>This season<span>'+rows.length+' gameweek'+(rows.length===1?'':'s')+'</span></h4><div class="hwrap"><table>'
   +'<thead><tr><th>GW</th><th class="l">Opp</th><th>Pts</th><th>xP</th><th>Min</th><th>G</th><th>A</th><th>CS</th><th>GC</th></tr></thead>'
   +'<tbody>'+tr+'</tbody>'
   +'<tfoot><tr><td></td><td class="l">Totals</td><td class="pts"><b>'+T.pts+'</b></td><td class="xp">'+T.xp.toFixed(1)+'</td><td>'+T.min+'</td><td>'+T.g+'</td><td>'+T.a+'</td><td>'+T.cs+'</td><td>'+T.gc+'</td></tr></tfoot>'
   +'</table></div><p class="hnote">Points as FPL scored them (bonus included). xP is what the performance deserved, with bonus left out.</p></div>';
}
(function(){
  const __os2=openSheet;
  openSheet=function(p){
    __os2(p);
    const right=document.querySelector('#sheet .sh-right');if(!right||!p)return;
    const notes=right.querySelectorAll(':scope > p.sh-note');const last=notes[notes.length-1];
    const html=histHTML(p);
    if(last)last.insertAdjacentHTML('beforebegin',html);else right.insertAdjacentHTML('beforeend',html);
  };
})();

/* v12-clean copy pass (patch_v12_clean.py) */
/* ===== v10 · the header ↻ button refreshes the SHEET: POST {action:'refresh'} to the web app, which re-runs refreshAll
   (≈10–30 s, throttled server-side to once per 90 s for everyone), then the app re-reads the sheet. Without an API URL
   (or if the call fails) the button just re-reads the sheet. Status shows in the #ptr toast under the header.
   v11 (13 Sep): the pull-to-refresh gesture is gone — this button is the refresh. ===== */
let KICKING=false;
function kickRefresh(el){
  if(KICKING)return;KICKING=true;
  const btn=document.getElementById('hrefresh');if(btn)btn.classList.add('busy');
  const say=t=>{el.textContent=t;el.classList.add('show','spin');};
  const done=()=>{KICKING=false;clearInterval(keep);if(btn)btn.classList.remove('busy');setTimeout(()=>el.classList.remove('show','spin'),1600);};
  const keep=setInterval(()=>{if(KICKING)el.classList.add('show','spin');},400);
  if(!D.api){say('Refreshing…');loadAll(true).then(()=>say('Up to date')).catch(()=>say('Couldn’t reach the sheet. Showing the last update')).finally(done);return;}
  say('Updating live scores… up to 30 s');
  const ac=new AbortController();const to=setTimeout(()=>ac.abort(),75000);
  fetch(D.api,{method:'POST',body:JSON.stringify({action:'refresh'}),signal:ac.signal}).then(r=>r.json())
   .then(r=>{
     if(r&&r.ran){say('Sheet updated. Loading…');return loadAll(true).then(()=>say('Up to date'));}
     if(r&&r.busy){say('Already updating. Try again in a moment');return loadAll(true);}
     if(r&&r.ageSec!==undefined){say('Updated '+(r.ageSec<60?r.ageSec+' s':Math.round(r.ageSec/60)+' min')+' ago');return loadAll(true);}
     /* answered, but not usefully ({ok:false}, an unknown action …): still re-read the sheet before saying so */
     return loadAll(true).catch(()=>{}).then(()=>say('Couldn’t update the sheet. Showing the last update'));
   })
   .catch(()=>{say('Couldn’t reach the sheet updater. Showing the last update');return loadAll(true).catch(()=>{});})
   .finally(()=>{clearTimeout(to);done();});
}
document.addEventListener('click',e=>{
  const b=e.target.closest('#hrefresh');if(!b)return;
  const el=document.getElementById('ptr');if(!el)return;
  if(KICKING){el.textContent='Still updating…';el.classList.add('show','spin');return;}
  kickRefresh(el);
});

/* v12-clean copy pass (patch_v12_clean.py) */
/* ===== v10 · team results history: every gameweek's score for a manager, FPL-app style =====
   1) Team page (openProfile, sheet + My team page mode): "Results" table — GW · opponent (derby name, H/A) ·
      score · W/D/L · league position after that week · xP — with a season totals row and a form strip.
   2) Table tab: "Scores by gameweek" grid — every team × every gameweek, tinted by result, weekly top in gold.
   Both derive from D.fx via effPtsOf (live-corrected exactly like the scoreboard) — zero new fetches. ===== */
function resFixtures(team){
  return D.fx.filter(f=>(f.Home===team||f.Away===team)&&num(f.GW)<=D.gw)
   .filter(f=>fin(f.Finished)||(num(f.GW)===D.gw&&(D.dlPassed||effPtsOf(f,f.Home)+effPtsOf(f,f.Away)>0)))
   .sort((a,b)=>num(a.GW)-num(b.GW));
}
/* league table after gameweek g, counting finished fixtures plus the live one (same lens as the standings) */
function posAfter(g){
  const t={};Object.keys(TEAMS).forEach(n=>t[n]={lp:0,pf:0});
  D.fx.forEach(f=>{const gw=num(f.GW);if(gw>g)return;
    if(!fin(f.Finished)&&!(gw===D.gw&&(D.dlPassed||effPtsOf(f,f.Home)+effPtsOf(f,f.Away)>0)))return;
    const h=effPtsOf(f,f.Home),a=effPtsOf(f,f.Away);if(!t[f.Home]||!t[f.Away])return;
    t[f.Home].pf+=h;t[f.Away].pf+=a;
    if(h>a)t[f.Home].lp+=3;else if(a>h)t[f.Away].lp+=3;else{t[f.Home].lp++;t[f.Away].lp++;}});
  const order=Object.keys(t).sort((p,q)=>t[q].lp-t[p].lp||t[q].pf-t[p].pf);
  const pos={};order.forEach((n,i)=>pos[n]=i+1);return pos;
}
function teamResults(team){
  const agg=(luckAgg()[team]||{gws:{}}).gws||{};const cache={};
  return resFixtures(team).map(f=>{
    const g=num(f.GW),home=f.Home===team,opp=home?f.Away:f.Home;
    const my=effPtsOf(f,team),their=effPtsOf(f,opp),live=!fin(f.Finished);
    const res=my>their?'W':my<their?'L':'D';
    const pos=(cache[g]=cache[g]||posAfter(g))[team];
    return {g,f,home,opp,my,their,live,res,pos,nm:derbyName(f.Home,f.Away),xp:agg[g]?agg[g].x:null};
  });
}
const resOrd=n=>n+(n%10===1&&n!==11?'st':n%10===2&&n!==12?'nd':n%10===3&&n!==13?'rd':'th');
function resultsHTML(team){
  const rows=teamResults(team);
  if(!rows.length)return '<div class="hist tres"><h4>Results</h4><p class="hnone">No gameweeks played yet.</p></div>';
  const T={w:0,d:0,l:0,pf:0,pa:0};
  const tr=rows.map(r=>{if(!r.live){T[r.res.toLowerCase()]++;}T.pf+=r.my;T.pa+=r.their;
    const oc='<span class="oc">'+mg(r.opp,1)+esc(r.opp)+' <i>('+(r.home?'H':'A')+')</i>'+(r.nm?'<small>'+esc(r.nm)+'</small>':'')+'</span>';
    return '<tr'+(r.g===D.gw?' class="cur"':'')+'><td class="gw">'+r.g+'</td><td class="opp">'+oc+'</td>'
     +'<td class="sc"><b>'+r.my+'</b><i>–</i>'+r.their+'</td>'
     +'<td class="rs"><b class="'+(r.live?'lv':r.res)+'">'+(r.live?'LIVE':r.res)+'</b></td>'
     +'<td class="ps">'+resOrd(r.pos)+(r.live?'<i>*</i>':'')+'</td>'
     +'<td class="xp">'+(r.xp===null?'–':r.xp.toFixed(1))+'</td></tr>';}).join('');
  const form=rows.filter(r=>!r.live).slice(-5).map(r=>'<i class="'+r.res+'">'+r.res+'</i>').join('');
  const anyLive=rows.some(r=>r.live);
  return '<div class="hist tres"><h4>Results<span class="form">'+form+'</span></h4><div class="hwrap"><table>'
   +'<thead><tr><th>GW</th><th class="l">Opponent</th><th>Score</th><th></th><th>Pos</th><th>xP</th></tr></thead>'
   +'<tbody>'+tr+'</tbody>'
   +'<tfoot><tr><td></td><td class="l">'+T.w+'–'+T.d+'–'+T.l+'</td><td class="sc"><b>'+T.pf+'</b><i>–</i>'+T.pa+'</td><td></td><td></td><td></td></tr></tfoot>'
   +'</table></div><p class="hnote">Score is this team first. Pos is the league position after that gameweek'+(anyLive?' (* live, moves until FPL confirms)':'')+'. xP is what the XI deserved, bonus left out.</p></div>';
}
(function(){
  const __op=openProfile;
  openProfile=function(team,intoEl){
    __op.apply(this,arguments);
    const root=intoEl||document.getElementById('sheet');if(!root||!TEAMS[team])return;
    const anchor=[...root.querySelectorAll('.posh2')].find(h=>/^Actual vs expected/.test(h.textContent));
    const html=resultsHTML(team);
    if(anchor)anchor.insertAdjacentHTML('beforebegin',html);else root.querySelector('.sh-right, .card')?.insertAdjacentHTML('beforeend',html);
  };
})();
/* ---- Table tab: scores by gameweek, every team ---- */
function gridHTML(){
  const gws=[];for(let g=1;g<=D.gw;g++)if(D.fx.some(f=>num(f.GW)===g&&(fin(f.Finished)||(g===D.gw&&(D.dlPassed||effPtsOf(f,f.Home)+effPtsOf(f,f.Away)>0)))))gws.push(g);
  if(!gws.length)return '';
  const st=D.st.slice().sort((a,b)=>num(b['League Pts'])-num(a['League Pts'])||num(b['Pts For'])-num(a['Pts For'])).map(s=>s.Team).filter(t=>TEAMS[t]);
  const cell={};const top={};
  gws.forEach(g=>{D.fx.filter(f=>num(f.GW)===g).forEach(f=>{
    if(!fin(f.Finished)&&!(g===D.gw&&(D.dlPassed||effPtsOf(f,f.Home)+effPtsOf(f,f.Away)>0)))return;
    const h=effPtsOf(f,f.Home),a=effPtsOf(f,f.Away),live=!fin(f.Finished);
    cell[f.Home+'|'+g]={p:h,r:h>a?'W':h<a?'L':'D',live};cell[f.Away+'|'+g]={p:a,r:a>h?'W':a<h?'L':'D',live};
    top[g]=Math.max(top[g]||0,h,a);});});
  const head='<tr><th class="tm">Team</th>'+gws.map(g=>'<th'+(g===D.gw&&cell[st[0]+'|'+g]?.live?' class="lv"':'')+'>'+g+'</th>').join('')+'<th class="tot">PF</th></tr>';
  const body=st.map(t=>{let pf=0;
    const tds=gws.map(g=>{const c=cell[t+'|'+g];if(!c)return '<td class="none">–</td>';pf+=c.p;
      return '<td class="'+c.r+(c.p===top[g]?' wk':'')+(c.live?' live':'')+'">'+c.p+'</td>';}).join('');
    return '<tr><td class="tm" data-prof="'+esc(t)+'">'+mg(t,1)+'<span>'+esc(TEAMS[t].mgr.split(' ')[0])+'</span></td>'+tds+'<td class="tot">'+pf+'</td></tr>';}).join('');
  return '<h2>Scores by gameweek</h2><div class="card sgrid"><div class="gwrap"><table><thead>'+head+'</thead><tbody>'+body+'</tbody></table></div>'
   +'<p class="mnote" style="padding:6px 8px 8px;margin:0">Green won, red lost, grey drew · gold outline = the week’s top score · tap a name for the full team page.</p></div>';
}
(function(){
  const __rt=renderTable;
  renderTable=function(){
    __rt.apply(this,arguments);
    const body=document.getElementById('tablebody');if(!body)return;
    const h2=[...body.querySelectorAll('h2')].find(h=>/^Standings/.test(h.textContent));
    const card=h2&&h2.nextElementSibling;if(!card)return;
    card.insertAdjacentHTML('afterend',gridHTML());
  };
})();

