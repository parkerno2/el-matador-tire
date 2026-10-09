
/* ================= config ================= */
const SHEET='1rIj4A3-lkSfg1rTuAh3yJL-K7LP4EOYkwWZiItZaoHk';
/* FPL allows mid-season team renames (Ethan, 25 Aug: Maize 'n' Mount -> I Am a Baleba).
   Canonicalize every sheet cell to the CURRENT name so static config, GW Log history, series
   and standings all agree. One line per rename, old -> current. */
/* the league's config (league.json, ROADMAP C1, 9 Oct 2026): ci-build.sh and the demo build put `const LEAGUE={...}` in front of this file */
if(typeof LEAGUE==='undefined')throw new Error('core.js needs LEAGUE (league.json): build with ci-build.sh');
const TEAM_ALIAS=Object.assign({},LEAGUE.aliases||{});
const canonTeam=v=>(typeof v==='string'&&TEAM_ALIAS[v])?TEAM_ALIAS[v]:v;
const TEAMS={};Object.keys(LEAGUE.teams).forEach(t=>{const x=LEAGUE.teams[t];TEAMS[t]={mgr:x.mgr,ini:x.ini,col:x.col,xi:x.xi,lo:x.lo,hi:x.hi}});
const MATCH=Object.assign({},LEAGUE.derbies||{});
const SEED=Object.assign({},LEAGUE.seeded||{});
const FIRST={};Object.keys(LEAGUE.teams).forEach(t=>{FIRST[LEAGUE.teams[t].ini]=LEAGUE.teams[t].first});
const NAT={ES:'Spain',FR:'France','GB-ENG':'England','GB-SCT':'Scotland','GB-WLS':'Wales','GB-NIR':'Northern Ireland',NL:'Netherlands',
RS:'Serbia',DE:'Germany',AR:'Argentina',SE:'Sweden',BR:'Brazil',IT:'Italy',NO:'Norway',BE:'Belgium',
GW:'Guinea-Bissau',CD:'DR Congo',PT:'Portugal',EC:'Ecuador',UA:'Ukraine',HR:'Croatia',TR:'Türkiye',
CH:'Switzerland',DK:'Denmark',IE:'Ireland',SN:'Senegal',GH:'Ghana',NG:'Nigeria',CI:'Ivory Coast',
US:'United States',JM:'Jamaica',ML:'Mali',DZ:'Algeria',EG:'Egypt',CO:'Colombia',UY:'Uruguay',
PY:'Paraguay',HU:'Hungary',CZ:'Czechia',PL:'Poland',AT:'Austria',SI:'Slovenia',SK:'Slovakia',
GR:'Greece',AL:'Albania',XK:'Kosovo',CM:'Cameroon',ZW:'Zimbabwe',GA:'Gabon',BF:'Burkina Faso',
MA:'Morocco',TN:'Tunisia',AU:'Australia',NZ:'New Zealand',JP:'Japan',KR:'South Korea',MX:'Mexico',CA:'Canada'};
const CLUBDOM={ARS:'arsenal.com',AVL:'avfc.co.uk',BOU:'afcb.co.uk',BRE:'brentfordfc.com',
BHA:'brightonandhovealbion.com',BUR:'burnleyfootballclub.com',CHE:'chelseafc.com',COV:'ccfc.co.uk',
CRY:'cpfc.co.uk',EVE:'evertonfc.com',FUL:'fulhamfc.com',LEE:'leedsunited.com',LIV:'liverpoolfc.com',
MCI:'mancity.com',MUN:'manutd.com',NEW:'newcastleunited.com',NFO:'nottinghamforest.co.uk',
SUN:'safc.com',TOT:'tottenhamhotspur.com',WHU:'whufc.com',WOL:'wolves.co.uk'};
const PERIODS=LEAGUE.periods.map(p=>p.slice());

/* ================= data layer ================= */
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fin=v=>v===true||v==='TRUE';
const normN=n=>String(n||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase()
 .replace(/ø/g,'o').replace(/æ/g,'ae').replace(/ð/g,'d').replace(/þ/g,'th')
 .replace(/đ/g,'d').replace(/ł/g,'l').replace(/ß/g,'ss').replace(/[^a-z]/g,'');
/* full-name search: every word the user types must appear somewhere in the
   player's web name + full name (accents/hyphens ignored) — so
   "morgan gibbs white" finds Gibbs-White even though FPL shows only the surname */
const nameMatch=(p,q)=>{const hay=normN(String(p.Player)+' '+String(p['Full name']||''));
  return String(q).split(/\s+/).map(w=>normN(w)).filter(Boolean).every(w=>hay.includes(w))};
/* Players search ranks by words, never across them ("Saka" must not hit "iSAK Alexander"). Accents fold
   (João = Joao); dots and hyphens split words, apostrophes join them. Display name before full name;
   exact, then word start, then inside a word. Infinity = no match. */
const normW=n=>String(n||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
 .replace(/ø/g,'o').replace(/æ/g,'ae').replace(/ð/g,'d').replace(/þ/g,'th').replace(/đ/g,'d').replace(/ł/g,'l').replace(/ß/g,'ss')
 .replace(/['’]/g,'').replace(/[^a-z]+/g,' ').trim();
function nameRank(p,q){
  const qw=normW(q).split(' ').filter(Boolean);if(!qw.length)return Infinity;
  const dn=normW(p.Player),fn=normW(p['Full name']),dw=dn.split(' '),all=dw.concat(fn.split(' ')),qs=qw.join(' ');
  if(dn===qs)return 0;
  if(fn===qs)return 1;
  if(qw.every(w=>dw.some(x=>x.startsWith(w))))return 2;
  if(qw.every(w=>all.some(x=>x.startsWith(w))))return 3;
  if(qw.every(w=>all.some(x=>x.includes(w))))return 4;
  return Infinity;
}
function searchPlayers(q,n){
  let rk=(D.plr||[]).map(p=>({p,r:nameRank(p,q)})).filter(o=>o.r<Infinity);
  if(!rk.length){const cq=normN(q); /* last resort only: a glued query like "vandijk" */
    if(cq)rk=(D.plr||[]).filter(p=>normN(String(p.Player)+' '+String(p['Full name']||'')).includes(cq)).map(p=>({p,r:5}));}
  return rk.sort((a,b)=>a.r-b.r||num(b.p['Season pts'])-num(a.p['Season pts'])).slice(0,n||15).map(o=>o.p);
}
let __gvn=0;
function readTab(name){
  return new Promise((resolve,reject)=>{
    const cb='__gv'+(++__gvn);
    const s=document.createElement('script');
    const to=setTimeout(()=>{cleanup();reject(new Error(name+' timed out'))},15000);
    function cleanup(){clearTimeout(to);delete window[cb];s.remove()}
    window[cb]=j=>{
      cleanup();
      try{
        if(!j.table)throw new Error('no table');
        const cols=j.table.cols.map(c=>c.label||c.id);
        resolve(j.table.rows.map(row=>{const o={};row.c.forEach((c,i)=>{if(!cols[i])return;
          let v=c?((c.f!==undefined&&c.f!==null)?c.f:c.v):'';o[cols[i]]=canonTeam(v===null?'':v)});return o}));
      }catch(e){reject(e)}
    };
    s.src='https://docs.google.com/spreadsheets/d/'+SHEET+'/gviz/tq?'
      +'tqx='+encodeURIComponent('out:json;responseHandler:'+cb)
      +'&headers=1&sheet='+encodeURIComponent(name);
    s.onerror=()=>{cleanup();reject(new Error(name+' failed to load'))};
    document.head.appendChild(s);
  });
}
let D={ro:[],st:[],fx:[],mw:[],cf:[],clubs:{},potm:'',gw:1,started:false,gwsDone:0};

const badgeImg=(club,px)=>{
  const code=D.clubs[club];
  const src=code?('https://resources.premierleague.com/premierleague/badges/50/t'+code+'.png')
    :(CLUBDOM[club]?('https://www.google.com/s2/favicons?domain='+CLUBDOM[club]+'&sz=64'):'');
  return src?'<img class="crest"'+(px?' style="height:'+px+'px"':'')+' decoding="async" src="'+src+'" alt="'+esc(club)+'" onerror="this.style.display=\'none\'">':'';
};
/* Player photos (Parker, 8 Oct 2026): the FC cutouts already in faces/ (FC_FACES, frozen: no new ones are fetched),
   otherwise FPL's own photo, otherwise initials. FPL's site reads premierleague25/.../110x140/{code}.png; the old
   premierleague/.../p{code}.png path stopped updating (last season's kits, nothing for new signings), so it is never used. */
const FPL_PHOTO='https://resources.premierleague.com/premierleague25/photos/players/110x140/';
const face=c=>FPL_PHOTO+c+'.png';
const FC_FACES=new Set('17761 50175 60307 60689 78916 80201 85633 97032 98747 98980 106611 108416 109745 111234 114283 116535 141746 153682 154561 154566 169432 169528 171314 172649 172780 176297 177815 178301 184029 195546 198869 200720 200834 201658 204480 204936 205533 208706 209036 209244 212319 215059 215136 215379 215413 216051 216094 216646 219168 219847 221466 221820 222531 223094 223340 223827 224117 225796 226597 227444 231416 231747 232185 232413 243298 244723 244850 244851 247348 247632 248857 248875 424876 427623 430871 432720 432830 433969 435997 437499 437730 438234 439509 440993 441164 441264 444102 445087 445122 446008 448047 448104 449434 460842 462424 463067 463726 465247 465351 465642 466052 466075 466525 469142 470313 472769 473284 475168 477424 480455 482616 482973 484420 485055 485711 486385 487838 491279 492777 493105 494521 494595 498016 499604 500040 502500 503139 513418 513545 516895 517052 522047 533463 538207 543968 544877 551210 560262 575476 577725 606702 607464 610799 611695 638987 647850'.split(' '));
/* the image chain for one player code: [FC cutout,] FPL photo. Empty for no code */
const faceUrls=c=>{c=String(c==null?'':c).replace(/\.0$/,'');return c?(FC_FACES.has(c)?['faces/'+c+'.png']:[]).concat([face(c)]):[]};
/* an FPL photo (220x280, half body, the head in the top part) is framed by the head (class fpl); an FC cutout is head and shoulders already */
const isFplPhoto=u=>String(u==null?'':u).indexOf(FPL_PHOTO)===0;
const flagImg=(n,px)=>n?'<img decoding="async" class="flag" style="'+(px?'height:'+px+'px;':'')+'border-radius:2px" src="https://flagcdn.com/w80/'+String(n).toLowerCase()+'.png" alt="'+esc(NAT[n]||n)+'" onerror="this.style.display=\'none\'">':'';
let mg=(name,sm)=>{const t=TEAMS[name];return t?'<span class="mg'+(sm?' sm':'')+'" style="background:'+t.col+'">'+t.ini+'</span>':''};
const initials=n=>String(n).split(/\s+/).map(w=>w[0]).join('').slice(0,2).toUpperCase();
const dt=s=>{const d=s?new Date(String(s).replace(/^'/,'')):null;return(d&&!isNaN(d))?d:null};
const num=v=>{const n=parseFloat(typeof v==='string'?v.replace(/,/g,''):v);return isNaN(n)?0:n};

/* ================= expected points (xP) math — validated vs API GW1 ================= */
const GOALPTS={GKP:6,DEF:6,MID:5,FWD:4},CSPTS={GKP:4,DEF:4,MID:1,FWD:0},DCTH={DEF:10,MID:12,FWD:12,GKP:99};
const gcPen=l=>(l-(1-Math.exp(-2*l))/2)/2; // E[floor(goals conceded/2)] under Poisson(xGC)
function defconExp(code,gw,pos){
  /* expected DefCon pts = 2 × hit-rate over all PRIOR 60-min appearances.
     null = no prior sample (falls back to actual). */
  const th=DCTH[pos];let n=0,h=0;
  Object.keys(D.gwsByGw||{}).forEach(g=>{
    if(num(g)>=gw)return;
    const r=D.gwsByGw[g][String(code)];
    if(!r||r.Mins<60)return;
    n++;if(r.DefCon>=th)h++;});
  return n?2*h/n:null;
}
function bdOf(r){ // r = normalized GW Stats row → [{lbl,pts,x}]
  const pos=r.Pos,rows=[],add=(lbl,pts,x)=>rows.push({lbl,pts,x});
  if(r.Mins>0)add('Appearance ('+r.Mins+'’)',r.Mins>=60?2:1,r.Mins>=60?2:1);
  if(r.G||r.xG>0.005)add('Goals '+r.G+' (xG '+r.xG.toFixed(2)+')',r.G*GOALPTS[pos],r.xG*GOALPTS[pos]);
  if(r.A||r.xA>0.005)add('Assists '+r.A+' (xA '+r.xA.toFixed(2)+')',r.A*3,r.xA*3);
  if(CSPTS[pos]&&r.Mins>=60)add((r.CS?'Clean sheet':'No clean sheet')+' (xGC '+r.xGC.toFixed(2)+')',r.CS?CSPTS[pos]:0,Math.exp(-r.xGC)*CSPTS[pos]);
  if((pos==='GKP'||pos==='DEF')&&r.Mins>0&&(r.GC>=2||r.xGC>0.3))add('Goals conceded '+r.GC,-Math.floor(r.GC/2),-gcPen(r.xGC));
  if(r.Saves)add('Saves '+r.Saves,Math.floor(r.Saves/3),Math.floor(r.Saves/3));
  if(r.PS)add('Penalty saves',r.PS*5,r.PS*5);
  if(r.PM)add('Penalty misses',-r.PM*2,-r.PM*2);
  {const dAct=r.DefCon>=DCTH[pos]?2:0;
   const dx=r.Code!==undefined?defconExp(r.Code,r.GW,pos):null;
   const dExp=dx===null?dAct:dx;
   if(dAct||dExp>0.02)add('Defensive contribution ('+r.DefCon+')',dAct,dExp);}
  if(r.OG)add('Own goals',-r.OG*2,-r.OG*2);
  if(r.YC)add('Yellow card',-r.YC,-r.YC);
  if(r.RC)add('Red card',-r.RC*3,-r.RC*3);
  if(r.Bonus)add('Bonus (not in xP)',r.Bonus,null);
  return rows;
}
const xpOf=r=>r?bdOf(r).reduce((s,b)=>s+(b.x||0),0):0;
function histRow(code,pos){
  /* player's season-average underlying numbers → a pseudo stat row the xP
     engine can price. Powers the itemized PROJECTION for unplayed players. */
  let n=0,mins=0,xg=0,xa=0,xgc=0,sv=0,dc=0;
  Object.keys(D.gwsByGw||{}).forEach(g=>{
    const r=D.gwsByGw[g][String(code)];
    if(!r||!r.Mins)return;
    n++;mins+=r.Mins;xg+=r.xG;xa+=r.xA;xgc+=r.xGC;sv+=r.Saves;dc+=r.DefCon;});
  if(!n)return null;
  return {Code:String(code),GW:D.gw,Pos:pos,n:n,
    Mins:Math.round(mins/n),Pts:0,G:0,A:0,CS:0,GC:0,OG:0,PS:0,PM:0,YC:0,RC:0,
    Saves:Math.round(sv/n),Bonus:0,BPS:0,DefCon:Math.round(dc/n),
    xG:xg/n,xA:xa/n,xGC:xgc/n};
}
const projLbl=s=>s.replace(/^(Goals|Assists) \d+ /,'$1 ').replace('No clean sheet ','Clean sheet ');
const fmt1=n=>(Math.round(n*10)/10).toFixed(1).replace(/\.0$/,'');
function gwsRow(code,gw){ // normalized GW Stats row for a player+GW
  const m=(gw===undefined||gw===D.gw)?D.gwsCur:(D.gwsByGw[gw]||{});
  return m[String(code)]||null;
}
function epOf(code){ // pre-deadline prediction for the current GW (falls back to nearest block)
  const m=D.predCur||{};return m[String(code)]!==undefined?m[String(code)]:null;
}
function fxStarted(club){return (D.cf||[]).some(x=>num(x.GW)===D.gw&&(x.Home===club||x.Away===club)&&fin(x.Started))} // DGW-safe: any fixture
function projOf(p){ // one player's contribution to the projected final
  if(fxStarted(p.Club))return num(p['GW pts']);
  const e=epOf(p.Code);return e===null?0:e;
}
function xpBlendOf(p){ // Expected view: played → xP (deserved), not yet played → projection
  if(fxStarted(p.Club))return xpOf(gwsRow(p.Code));
  const e=epOf(p.Code);return e===null?0:e;
}
function fxFinished(club){const fs=(D.cf||[]).filter(x=>num(x.GW)===D.gw&&(x.Home===club||x.Away===club));return fs.length>0&&fs.every(x=>fin(x.Finished))} // DGW-safe: all fixtures

/* ---- predicted auto-subs: a starter whose fixture is FINISHED with 0 minutes
   gets replaced by the first viable bench player (bench slot order) that keeps
   the formation legal (exactly 1 GKP, ≥3 DEF, ≥2 MID, ≥1 FWD; GK only for GK).
   FPL confirms these at gameweek end — we forecast them the moment they lock. ---- */
/* ---- likely auto-subs (projection tier): a starter FPL flags as out before his
   match kicks off is treated as a 0-minute starter for PROJ FINAL only — his bench
   replacement's prediction counts instead. Status 'i'/'s'/'u'/'n' = out; 'd'
   (doubtful) only at ≤OUT_CHANCE% in the news line. Pure forecast: the moment he
   logs a minute the starter is back and the sub vanishes; at full time with 0
   minutes it becomes a locked sub like any other. Never touches the live score. ---- */
const OUT_CHANCE=25;
function flaggedOut(p){
  const st=String(p.Status||'a');
  if('isun'.indexOf(st)>-1)return true;
  if(st==='d'){const m=/(\d+)\s*%/.exec(String(p.News||''));return !!m&&num(m[1])<=OUT_CHANCE;}
  return false;
}
function likelyOut(p){
  if(fxFinished(p.Club)||!flaggedOut(p))return false;
  const r=gwsRow(p.Code);return !r||!num(r.Mins);
}
function autoSubs(team,likely){ // likely=true adds the projection tier; default = locked subs only (live score, Analysis)
  const xi=xiOf(team).slice(),bench=benchOf(team);
  /* blank gameweek: no fixture for his club is a certain 0. Locked once the gameweek is under way (deadline passed or a
     fixture kicked off: the XI is fixed and FPL subs him at the end); before that, projection tier like a flagged player.
     No fixtures listed for the GW at all (tab missing) means nobody is blank. */
  const gwFx=(D.cf||[]).filter(x=>num(x.GW)===D.gw),gwOn=D.dlPassed||gwFx.some(x=>fin(x.Started));
  const blank=p=>gwFx.length>0&&!gwFx.some(x=>x.Home===p.Club||x.Away===p.Club);
  const zeroed=p=>{if(blank(p))return gwOn;const r=gwsRow(p.Code);return fxFinished(p.Club)&&(!r||!num(r.Mins));};
  const outKind=p=>zeroed(p)?'locked':(likely&&(likelyOut(p)||blank(p)))?'likely':'';
  const cnt=(l,pos)=>l.reduce((s,x)=>s+(x.Pos===pos?1:0),0);
  const legal=l=>cnt(l,'GKP')===1&&cnt(l,'DEF')>=3&&cnt(l,'MID')>=2&&cnt(l,'FWD')>=1;
  const subs=[],used=new Set(),replaced=new Set();
  bench.forEach(b=>{
    if(outKind(b)||used.has(b.Code))return; // a bench player who's out himself (finished 0-min, or flagged out in likely mode) can't come in
    for(let i=0;i<xi.length;i++){
      const p=xi[i];
      const kind=outKind(p);if(replaced.has(p.Code)||!kind)continue;
      if((p.Pos==='GKP')!==(b.Pos==='GKP'))continue;
      const trial=xi.slice();trial[i]=b;
      if(!legal(trial))continue;
      xi[i]=b;used.add(b.Code);replaced.add(p.Code);subs.push({out:p,inn:b,kind:kind==='locked'?'locked':'likely'});
      break;
    }
  });
  if(likely&&subs.length){ // report the NET effect: what's already certain (confirmed-facts pass) + who additionally comes in / goes out on the flagged assumption.
    // A flagged starter early in the XI reshuffles which bench player covers which slot, but a starter who finished on 0 mins is out either way.
    const base=autoSubs(team,false).subs;
    const bi=new Set(base.map(x=>x.inn.Code)),bo=new Set(base.map(x=>x.out.Code));
    const addIn=subs.filter(x=>!bi.has(x.inn.Code)).map(x=>x.inn),addOut=subs.filter(x=>!bo.has(x.out.Code)).map(x=>x.out);
    const net=base.map(x=>({out:x.out,inn:x.inn,kind:'locked'}));
    addIn.forEach((b,i)=>{if(addOut[i])net.push({out:addOut[i],inn:b,kind:'likely'});});
    return{xi:xi,subs:net};
  }
  return{xi:xi,subs:subs};
}
function effXiOf(team,likely){return autoSubs(team,likely).xi}

/* ---- house TOTW: a 10+ point haul, live at full time (bonus counts when it lands),
   worn until the player's NEXT match finishes — i.e., it lasts one week ---- */
const TOTW_HAUL=10;
function haulTOTW(p){
  const cur=gwsRow(p.Code);
  if(cur&&cur.Pts>=TOTW_HAUL&&fxFinished(p.Club))return true;
  if(!fxFinished(p.Club)){
    const pr=(D.gwsByGw[D.gw-1]||{})[String(p.Code)];
    if(pr&&pr.Pts>=TOTW_HAUL)return true;
  }
  return false;
}

/* ---- dynamic form rating: base OVR ± form, from ACTUAL points over the last
   4 completed performances vs what the base rating implies. Real points, not xP —
   consistent overperformance of xG is skill (Haaland finishing low-xG chances),
   and the base curve was calibrated on actual points anyway. Shrunk hard on
   small samples (needs 2+ games), clamped to −3…+5 so the base economy holds. ---- */
function formDelta(p){
  const base=ovrOf(p);
  const xs=[];
  for(let g=D.gw;g>=1&&xs.length<4;g--){
    const r=(D.gwsByGw[g]||{})[String(p.Code)];
    if(!r||!r.Mins)continue;
    if(g===D.gw&&!fxFinished(p.Club))continue; // only finished performances count
    xs.push(r.Pts);
  }
  if(xs.length<2)return 0;
  const formPts=xs.reduce((a,b)=>a+b,0)/xs.length;
  const basePts=(base-62)*170/22/38;          // invert the base rating curve → implied pts/GW
  const w=xs.length/(xs.length+2);            // shrink toward 0 on thin samples
  return Math.max(-3,Math.min(5,Math.round(2*w*(formPts-basePts))));
}
const dynOvr=p=>ovrOf(p)+formDelta(p);

function teamProj(team){return effXiOf(team,true).reduce((s,p)=>s+projOf(p),0)} // effective XI: locked + likely auto-subs
function teamXP(team){return xiOf(team).reduce((s,p)=>s+xpOf(gwsRow(p.Code)),0)}
function teamXPBlend(team){return effXiOf(team,true).reduce((s,p)=>s+xpBlendOf(p),0)}
function teamEP(team,epMap){return xiOf(team).reduce((s,p)=>{const e=epMap[String(p.Code)];return s+(e||0)},0)}

/* ================= cards ================= */
function ovrOf(p){
  if(p.OVR!==''&&p.OVR!==undefined&&p.OVR!==null&&p.OVR!=0)return Math.round(num(p.OVR));
  return Math.max(62,Math.min(96,Math.round(62+22*num(p['Proj pts'])/170)));
}
function tierOf(p){
  if(D.potm&&normN(p.Player)===D.potm)return'potm';
  if(haulTOTW(p))return'totw'; // house rule: 10+ pt haul, live at FT, lasts one week
  if(/^R[12]\./.test(p.Drafted||''))return'spec';
  const o=dynOvr(p); // form moves tiers — a Silver can play his way into Gold art
  return o>=85?'elite':o>=78?'gold':'silver';
}
const FILL={gold:'url(#gGold)',silver:'url(#gSilver)',spec:'url(#gSpec)',elite:'url(#gElite)',totw:'url(#gTotw)',potm:'url(#gPotm)'};
const EDGE={gold:'#8A6A1D',silver:'#767D8E',spec:'#FFD23F',elite:'#04F5FF',totw:'#FFD23F',potm:'#FFD23F'};
const ACC={gold:'#6E4F0E',silver:'#454C5C',spec:'#FFD23F',elite:'#04F5FF',totw:'#FFD23F',potm:'#FFD23F'};
const TIER_DROP={silver:'wave',gold:'wave',spec:'wave',elite:'splash',potm:'splash',totw:'cape'};
const PLATE='M18 6 H106 L142 42 V196 L136 202 H14 L8 196 V16 Z';
function bdWave(t,u){
 const g='<defs><linearGradient id="wv'+u+'" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="'+ACC[t]+'" stop-opacity=".46"/><stop offset=".55" stop-color="'+ACC[t]+'" stop-opacity=".14"/><stop offset="1" stop-color="'+ACC[t]+'" stop-opacity="0"/></linearGradient></defs>';
 return g
  +'<path d="M-12 118 C36 102 70 58 152 12 L152 30 C76 72 34 108 -12 132 Z" fill="url(#wv'+u+')" opacity=".75"/>'
  +'<path d="M-12 138 C30 118 52 74 152 34 L152 66 C72 98 40 132 -12 158 Z" fill="url(#wv'+u+')"/>'
  +'<path d="M-12 156 C44 140 84 108 152 84 L152 100 C90 122 44 148 -12 170 Z" fill="url(#wv'+u+')" opacity=".55"/>'
  +'<path d="M-12 128 C40 110 66 66 152 22" fill="none" stroke="'+ACC[t]+'" stroke-width="1" opacity=".3"/>';
}
function bdSplash(t,u){
 const drops=[[34,84,2.6],[52,62,2],[74,44,2.8],[98,30,2],[118,20,2.6],[60,100,1.6],[88,58,1.5],[110,42,1.8],[128,12,1.4]];
 return '<path d="M-8 148 C30 128 62 92 148 26" fill="none" stroke="'+ACC[t]+'" stroke-width="16" opacity=".12" stroke-linecap="round"/>'
  +'<path d="M-8 132 C36 112 74 74 150 14" fill="none" stroke="'+ACC[t]+'" stroke-width="7" opacity=".2" stroke-linecap="round"/>'
  +'<path d="M-8 162 C48 142 92 106 152 62" fill="none" stroke="'+ACC[t]+'" stroke-width="4" opacity=".14" stroke-linecap="round"/>'
  +drops.map(d=>'<circle cx="'+d[0]+'" cy="'+d[1]+'" r="'+d[2]+'" fill="'+ACC[t]+'" opacity=".38"/>').join('');
}
function bdCape(t,u){
 const g='<defs><linearGradient id="cp'+u+'" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="'+ACC[t]+'" stop-opacity="0"/><stop offset=".5" stop-color="'+ACC[t]+'" stop-opacity=".42"/><stop offset="1" stop-color="'+ACC[t]+'" stop-opacity=".06"/></linearGradient></defs>';
 return g
  +'<path d="M-24 128 C8 62 96 24 158 64" fill="none" stroke="url(#cp'+u+')" stroke-width="24" stroke-linecap="round"/>'
  +'<path d="M-18 142 C24 88 108 52 160 84" fill="none" stroke="url(#cp'+u+')" stroke-width="10" opacity=".8" stroke-linecap="round"/>'
  +'<path d="M-12 110 C22 58 92 22 150 42" fill="none" stroke="rgba(255,255,255,.16)" stroke-width="4" stroke-linecap="round"/>'
  +[[38,52],[104,26],[128,58],[62,32]].map(p=>'<path d="M'+p[0]+' '+(p[1]-4)+' L'+(p[0]+2.6)+' '+p[1]+' L'+p[0]+' '+(p[1]+4)+' L'+(p[0]-2.6)+' '+p[1]+' Z" fill="'+ACC[t]+'" opacity=".55"/>').join('');
}
const DROPS={wave:bdWave,splash:bdSplash,cape:bdCape};
let CARDUID=0;
function cardBg(t){
 const u=++CARDUID,art=DROPS[TIER_DROP[t]];
 return '<svg class="bg" viewBox="0 0 150 210" aria-hidden="true">'
  +'<defs><clipPath id="cs'+u+'"><path d="'+PLATE+'"/></clipPath>'
  +'<clipPath id="ct'+u+'"><rect x="0" y="0" width="150" height="134"/></clipPath></defs>'
  +'<path d="'+PLATE+'" transform="translate(0 8)" fill="rgba(20,10,25,.16)"/>'
  +'<path d="'+PLATE+'" transform="translate(0 3.5)" fill="rgba(20,10,25,.22)"/>'
  +'<path d="'+PLATE+'" fill="'+FILL[t]+'"/>'
  +'<g clip-path="url(#cs'+u+')"><g clip-path="url(#ct'+u+')">'+(art?art(t,u):'')+'</g>'
  +'<path d="M-30 0 L64 0 L14 210 L-80 210 Z" fill="rgba(255,255,255,.07)"/></g>'
  +'<path d="'+PLATE+'" fill="none" stroke="rgba(255,255,255,.35)" stroke-width=".7" transform="translate(75 105) scale(.965) translate(-75 -105)"/>'
  +'<path d="'+PLATE+'" fill="none" stroke="'+EDGE[t]+'" stroke-width="1.6" vector-effect="non-scaling-stroke"/></svg>';
}
const FACE_SWAP={'444102':{src:'hasbulla.png',until:'2026-08-30T16:30:00Z'}};
const FACEBAD=new Set(); /* face URLs that already failed this session: later cards skip straight past them (no repeat 404s) */
function faceImgHTML(p){
 /* Cards need TRANSPARENT images: the keyed FC cutouts in faces/ and FPL's photos both are. */
 const urls=[];
 /* FACE_SWAP: time-boxed gag faces — {code:{src,until}}; expired entries are ignored, the real cascade follows. Parker, 29 Aug: Hasbulla on Evanilson for 24h. */
 const fs=FACE_SWAP[String(p.Code)];if(fs&&Date.now()<Date.parse(fs.until))urls.push('faces/'+fs.src);
 urls.push(...faceUrls(p.Code));
 const ok=urls.filter(u=>!FACEBAD.has(u));
 if(!ok.length)return'<span class="noface">'+initials(p.Player)+'</span>';
 return '<img decoding="async"'+(isFplPhoto(ok[0])?' class="fpl"':'')+' src="'+ok[0]+'" data-alt="'+ok.slice(1).join('|')+'" alt="" onerror="FACEBAD.add(this.getAttribute(\'src\'));var a=(this.dataset.alt||\'\').split(\'|\').filter(Boolean);if(a.length){this.src=a.shift();this.dataset.alt=a.join(\'|\');this.classList.toggle(\'fpl\',this.src.indexOf(\'premierleague25/photos\')>-1)}else{this.outerHTML=\'<span class=noface>'+initials(p.Player)+'</span>\'}">';
}
function projBubble(p){ // pre-match bubble text: the prediction if one exists, otherwise a dash (never a fake 0.0)
  const e=D.hasEP?epOf(p.Code):null;return e===null?'–':fmt1(e);
}
function card(p,i){
  const t=tierOf(p),o=dynOvr(p),fd=formDelta(p);
  const sm=SUBMARK[p.Code]||''; // predicted auto-sub marker: 'in' | 'out' (set by renderMatch only)
  const tag=sm==='in'?'SUB':sm==='inl'?'LIKELY':sm.startsWith('out')?'OUT':(t==='potm'?'POTM':t==='totw'?'TOTW':t==='spec'?(p.Drafted||'').split('.')[0]:'');
  const smc=sm?(' sub'+(sm.startsWith('in')?'in':'out')+(sm.endsWith('l')?' likely':'')):'';
  return '<button class="fc '+t+smc+'" data-i="'+i+'" aria-label="'+esc(p.Player)+'">'
   +cardBg(t)
   +(tag?'<span class="tag">'+tag+'</span>':'')
   +('isud'.indexOf(p.Status)>-1?'<span class="inj">INJ</span>':'')
   +'<span class="rt"><b>'+o+'</b><span>'+String(p.Pos).slice(0,3)+'</span>'
   +(fd?'<span class="fdar '+(fd>0?'up':'dn')+'">'+(fd>0?'▲':'▼')+Math.abs(fd)+'</span>':'')+'</span>'
   +(D.xpview
     ?(fxStarted(p.Club)
       ?'<span class="pts'+(fxFinished(p.Club)?'':' live')+'"><b>'+fmt1(xpOf(gwsRow(p.Code)))+'</b><i>XP</i></span>'
       :'<span class="pts proj"><b>'+projBubble(p)+'</b><i>PROJ</i></span>')
     :(fxStarted(p.Club)
       /* v5.5: LIVE (green ring + LIVE label) while his match is on, solid PTS once it's finished */
       ?'<span class="pts'+(fxFinished(p.Club)?'':' live')+'"><b>'+Math.round(num(p['GW pts']))+'</b><i>'+(fxFinished(p.Club)?'PTS':'LIVE')+'</i></span>'
       /* pre-match: the player's own prediction, labeled PROJ — hollow dashed bubble so it can't be mistaken for banked points (v5.5) */
       :'<span class="pts proj"><b>'+projBubble(p)+'</b><i>PROJ</i></span>'))
   +'<span class="face">'+faceImgHTML(p)+'</span>'
   +'<span class="nm">'+esc(p.Player)+'</span>'
   +'<span class="meta">'+badgeImg(p.Club,0)+'<span class="sep"></span>'+flagImg(p.Nation,0)+'</span>'
   +'</button>';
}

/* ================= routing ================= */
const VIEWS=[['gw','Gameweek','M13 2 3 14h7l-1 8 10-12h-7l1-8z'],
['team','My team','M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21v-.5a8 8 0 0 1 16 0v.5'],
['table','Table','M6 3h12v4a6 6 0 0 1-12 0V3zM3 5h3M18 5h3M9 21h6M12 13v8'],
['xis','Players','M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3'],
['ana','Analysis','M3 3v18h18M7 15l4-5 3 3 5-7'],
['faq','FAQ','M9 9a3 3 0 1 1 5.2 2c-.9.8-2.2 1.3-2.2 2.5M12 17.5h.01M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z']];
function buildNav(){
  document.getElementById('nav').innerHTML=VIEWS.map(v=>
   '<button data-v="'+v[0]+'"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="'+v[2]+'"/></svg><span>'+v[1]+'</span><span class="bar"></span></button>').join('');
  document.getElementById('nav').onclick=e=>{
    const b=e.target.closest('[data-v]');if(b)location.hash=b.dataset.v;
  };
}
let SUB=null;
/* Scroll memory: every history entry keeps its own scroll (stamped into history.state), so back and forward land
   where you left; a tab you come back to from the nav opens where you left it; re-tapping the active tab scrolls
   to the top. emtFrom = the screen an entry was opened from, so back buttons pop history instead of pushing. */
let CURHASH=null,SCRT=0,NAVTAP=null;
const TABPOS={},GWOPEN=new Set();
const hashNow=()=>location.hash||'#gw';
const overlayUp=()=>!!(document.querySelector('#sheet.on')||document.getElementById('lgfx'));
function stampScroll(){clearTimeout(SCRT);SCRT=0;
  if(CURHASH===null||hashNow()!==CURHASH||overlayUp())return;
  const s=history.state;if(s&&s.emtOv)return;
  try{history.replaceState(Object.assign({},s,{emtY:Math.round(scrollY)}),'')}catch(e){}}
addEventListener('scroll',()=>{
  if(CURHASH===null||hashNow()!==CURHASH||overlayUp())return;
  if(CURHASH.indexOf('/')<0)TABPOS[CURHASH]=scrollY;
  clearTimeout(SCRT);SCRT=setTimeout(stampScroll,150);
},{passive:true});
document.addEventListener('click',stampScroll,true); /* a tap that navigates keeps the last scroll */
function routeBack(target){ /* back to the opener when it is the previous entry, else replace this entry with target */
  const s=history.state,from=s&&s.emtFrom;
  if(from&&(!target||from===target)){history.back();return}
  location.replace(target||'#gw');
}
function route(){
  const hash=hashNow(),parts=hash.slice(1).split('/');
  const h=parts[0];
  if(!document.getElementById('v-'+h)){location.replace('#gw');return;} // unknown view: never a blank page
  const prev=CURHASH;
  if(prev==='#gw'&&hash!=='#gw'){GWOPEN.clear();document.querySelectorAll('#gwbody details[open]>summary').forEach(x=>GWOPEN.add(x.textContent.trim()));}
  if(h!=='gw')SUBMARK={}; // predicted-sub tags only live inside a matchup detail
  SUB=parts.length>1?parts[1]:null;
  document.body.setAttribute('data-view',h);
  document.querySelectorAll('.view').forEach(v=>v.classList.toggle('on','v-'+h===v.id));
  document.querySelectorAll('nav [data-v]').forEach(b=>b.classList.toggle('on',b.dataset.v===h));
  if(h==='gw'&&D.ro&&D.ro.length)renderGW();
  if(h==='team'&&D.ro&&D.ro.length)renderTeam();
  if(h==='xis'&&D.plr&&D.plr.length)renderXIs();
  CURHASH=hash;
  let st=history.state;
  if(!st||!('emtFrom' in st)){st=Object.assign({},st,{emtFrom:prev});try{history.replaceState(st,'')}catch(e){}}
  if(hash==='#gw'&&GWOPEN.size)document.querySelectorAll('#gwbody details>summary').forEach(x=>{if(GWOPEN.has(x.textContent.trim()))x.parentElement.open=true});
  if(prev===null)return; /* first paint: the browser restores a reloaded page itself (and loadAll backs it up) */
  const y=st.emtY!=null?st.emtY:(NAVTAP===hash?(TABPOS[hash]||0):0);NAVTAP=null; /* other fresh screens open at the top */
  window.scrollTo(0,y);
  if(y)requestAnimationFrame(()=>{if(hashNow()===hash&&Math.abs(scrollY-y)>2)window.scrollTo(0,y)});
}
addEventListener('hashchange',route);
document.getElementById('nav').addEventListener('click',e=>{ /* re-tap the active tab = back to the top */
  const b=e.target.closest('[data-v]');if(!b)return;
  if('#'+b.dataset.v!==hashNow()){NAVTAP='#'+b.dataset.v;return} /* a tab you come back to opens where you left it */
  TABPOS[hashNow()]=0;window.scrollTo({top:0,behavior:'smooth'});
});

/* ================= helpers ================= */
function pairKey(a,b){return[a,b].sort().join('|')}
function derbyName(h,a){const x=TEAMS[h]?.ini,y=TEAMS[a]?.ini;return x&&y?(MATCH[x+'|'+y]||MATCH[y+'|'+x]||null):null}
let LIVEH2H={};
function buildH2H(){LIVEH2H={};
  D.fx.filter(f=>fin(f.Finished)).forEach(f=>{
    const x=TEAMS[f.Home]?.ini,y=TEAMS[f.Away]?.ini;if(!x||!y)return;
    const k=pairKey(x,y),first=k.split('|')[0];
    const r=LIVEH2H[k]||(LIVEH2H[k]=[0,0,0]);
    const hp=num(f['Home pts']),ap=num(f['Away pts']);
    if(hp===ap)r[2]++;else{const w=hp>ap?x:y;r[w===first?0:1]++;}
  });}
function series(h,a){const x=TEAMS[h]?.ini,y=TEAMS[a]?.ini;if(!x||!y)return null;
  const k=pairKey(x,y),[f1]=k.split('|');
  const sd=SEED[k]||[0,0,0],lv=LIVEH2H[k]||[0,0,0];
  const w1=sd[0]+lv[0],w2=sd[1]+lv[1],dr=sd[2]+lv[2];
  if(w1+w2+dr===0)return'First ever meeting';
  const rec=(a1,b1)=>a1+'–'+b1+(dr?' ('+dr+' drawn)':'');
  const[wa,wb]=(x===f1)?[w1,w2]:[w2,w1];
  if(wa>wb)return FIRST[x]+' leads '+rec(wa,wb);
  if(wb>wa)return FIRST[y]+' leads '+rec(wb,wa);
  return'Series level '+rec(wa,wb)}
function squadOf(team){return D.ro.filter(r=>r.Team===team)}
function xiOf(team){
  const sq=squadOf(team);
  const real=sq.filter(r=>r['GW XI']==='XI');
  if(real.length>=11)return real.sort((a,b)=>num(a.Slot)-num(b.Slot));
  return sq.filter(r=>r['Best XI']==='XI');
}
function benchOf(team){
  const sq=squadOf(team);
  const real=sq.filter(r=>r['GW XI']==='BEN');
  if(real.length)return real.sort((a,b)=>num(a.Slot)-num(b.Slot));
  return sq.filter(r=>r['Best XI']!=='XI');
}
function formation(xi){
  const c=p=>xi.filter(x=>x.Pos===p).length;
  return c('DEF')+'–'+c('MID')+'–'+c('FWD');
}
function rowsFor(xi,mirror){
  const order=mirror?['FWD','MID','DEF','GKP']:['GKP','DEF','MID','FWD'];
  return order.map(pos=>{
    const g=xi.filter(p=>p.Pos===pos);
    if(!g.length)return'';
    let chunks=[g];
    if(g.length>4){
      /* 5 in a line → 4 + 1, the best of them advanced (the CAM) toward the attack */
      const best=g.slice().sort((a,b)=>ovrOf(b)-ovrOf(a)||num(b['Proj pts'])-num(a['Proj pts']))[0];
      const rest=g.filter(p=>p!==best);
      chunks=mirror?[[best],rest]:[rest,[best]];
    }
    return chunks.map((c,ci)=>'<div class="prow'+(chunks.length>1&&ci===0?' split':'')+'">'
      +c.map(p=>card(p,D.ro.indexOf(p))).join('')+'</div>').join('');
  }).join('');
}
/* Provisional bonus: FPL shows BPS live but folds bonus into totals later. For any finished
   fixture whose players all still show Bonus 0, rank BPS and award 3/2/1 with FPL's tie rules
   (ties share the tier and consume the places below). Cleared automatically per fixture the
   moment official bonus lands, and entirely when the GW is confirmed.
   Per fixture (BUGS #8): a GW Stats row sums a player's whole gameweek, so in a double it belongs to one fixture only
   while that is the club's only fixture under way. Once both legs have kicked off the rows can't be split: leg 1's
   official bonus is in by then, and leg 2 waits for FPL's (no estimate from BPS summed across two matches). */
function provTiers(rows,pb){ /* 3/2/1 by BPS with FPL's tie rules, added to pb (a double can earn in both legs) */
  const vals=[...new Set(rows.map(r=>r.BPS))].sort((a,b)=>b-a);
  let pos=0;
  for(const v of vals){
    if(pos>=3)break;
    const tier=[3,2,1][pos];
    const winners=rows.filter(r=>r.BPS===v);
    winners.forEach(r=>{pb[String(r.Code)]=(pb[String(r.Code)]||0)+tier});
    pos+=winners.length;
  }
}
function computeProvBonus(curFx){
  const pb={};
  const own=(club,f)=>(curFx||[]).every(x=>x===f||(x.Home!==club&&x.Away!==club)||(!fin(x.Started)&&!fin(x.Finished)));
  (curFx||[]).forEach(f=>{
    if(!fin(f.Finished))return;
    if(own(f.Home,f)&&own(f.Away,f)){
      const rows=Object.values(D.gwsCur||{}).filter(r=>(r.Club===f.Home||r.Club===f.Away)&&r.Mins>0);
      if(!rows.length||rows.some(r=>r.Bonus>0))return;
      provTiers(rows,pb);return;
    }
    /* a club's second match (BUGS #8): the Fixture BPS tab (Code.gs v3.21) lists this match's own BPS and, once FPL
       confirms it, its bonus. Skip the match when its bonus is in: in the tab, or in GW Stats for a player whose club
       has no other match under way (that bonus can only be this match's). An old sheet without the tab changes nothing. */
    const per=(D.fbps||{})[f.Home+'|'+f.Away]||[];
    if(!per.length||per.some(r=>r.Bonus>0||(own(r.Club,f)&&(((D.gwsCur||{})[r.Code]||{}).Bonus>0))))return;
    provTiers(per,pb);
  });
  return pb;
}
function liveScoreOf(team){return effXiOf(team).reduce((s,p)=>s+num(p['GW pts'])+((D.pbonus||{})[String(p.Code)]||0),0)} // predicted auto-subs count once locked; FPL's own total is the floor via mscore's max()
function effPtsOf(f,team){ // a fixture's score for one team, live-corrected exactly like the scoreboard (analysis must agree with it)
  const raw=f.Home===team?num(f['Home pts']):num(f['Away pts']);
  if(num(f.GW)===D.gw&&!fin(f.Finished)&&(D.dlPassed||raw>0))return Math.max(raw,liveScoreOf(team));
  return raw;
}
function inEffXi(team,code){return effXiOf(team).some(p=>String(p.Code)===String(code))} // live-GW membership incl. predicted auto-subs
function seasonTot(p){
  // during GW1 the API's season totals can still hold last season's numbers
  return D.gwsDone===0?Math.round(num(p['GW pts'])):Math.round(num(p['Season pts']));
}
function gwsPlayed(p){ // finished GWs + the live one once this player's club has kicked off (Season pts already includes it)
  return D.gwsDone+(fxStarted(p.Club)?1:0);
}
function avgOf(p){
  if(!D.started)return'–';
  return(seasonTot(p)/Math.max(1,gwsPlayed(p))).toFixed(1);
}
function nextFixture(club){
  const f=D.cf.filter(x=>!fin(x.Finished)&&!fin(x.Started)&&(x.Home===club||x.Away===club))
    .sort((a,b)=>num(a.GW)-num(b.GW)||String(a['Kickoff (UTC)']).localeCompare(String(b['Kickoff (UTC)'])))[0];
  if(!f)return'–';
  return f.Home===club?(f.Away+' (H)'):(f.Home+' (A)');
}

/* ================= gameweek ================= */
let BENCHOPEN=false,XPMODE=false,SUBMARK={};
/* Weekly recap cards. One entry per published recap page. A card shows from the moment its GW
   is over (provisional included) until RECAP_HIDE_H hours before the NEXT GW's deadline — by
   then the league's attention belongs to the coming week. Next deadline comes from D.mw; if the
   sheet doesn't have it yet, the card simply stays up. */
const RECAPS=[
  {gw:1,href:'recap-gw1.html',title:'El Clásico flips on Monday night, a 66 lands, and a penalty hits the post',
   sub:'Four matches, the numbers behind them, and the first waiver watch'},
  {gw:2,href:'recap-gw2.html',title:'Bruno drops 23 in the Hasbulla Derby, Watkins starts from Saudi Arabia, and Baha matches the 66',
   sub:'Four matches, the numbers behind them, and the waiver watch'},
  {gw:3,href:'recap-gw3.html',title:'The league’s first draw lands at 51 apiece, Richarlison starts from exile, and Thiaw scores at the wrong end',
   sub:'Four matches, the numbers behind them, and the waiver watch'}
];
const PREVIEWS=[
  {gw:2,href:'preview-gw2.html',title:'The Mr. Marks Bowl, seven City players in the Hasbulla Derby, and Isak at Anfield',
   sub:'Who owns whom in every real game, predicted scores, and the transfer clock'},
  {gw:3,href:'preview-gw3.html',title:'El Jl\u00e1sico\u2019s 26-point gap, 22 starters in Arsenal\u2013Chelsea, and the Fortnite Derby\u2019s first meeting',
   sub:'Who owns whom in every real game, predicted scores, and the last transfer clock of the window'},
  {gw:4,href:'preview-gw4.html',title:'A 17-shirt Manchester derby, Gakpo\u2019s 9.3 as the whole margin, and Hull\u2019s zero',
   sub:'Who owns whom in every real game, predicted scores, and the injury clock, now with Malcolm Tyre in the booth'}
];
const RECAP_HIDE_H=30;
function gwDeadline(g){const w=D.mw.find(x=>num(x.GW)===g);return w?dt(w['Deadline (UTC)']):null}
function contentCardsHTML(){
  let out='';
  const r=RECAPS.find(r=>r.gw===D.gw&&D.provOver)||RECAPS.find(r=>r.gw===D.gwsDone);
  if(r){
    const ndl=gwDeadline(r.gw+1);
    if(!(ndl&&Date.now()>ndl.getTime()-RECAP_HIDE_H*36e5))
      out+='<a class="recapcard" href="'+r.href+'"><div><div class="rk">Gameweek '+r.gw+' recap<span class="new">NEW</span></div>'
        +'<div class="rt">'+r.title+'</div><div class="rs">'+r.sub+'</div></div><span class="go">READ</span></a>';
  }
  /* a preview lives until its own deadline passes — kickoff weekend switches the app to live mode anyway */
  const p=PREVIEWS.find(p=>p.gw===D.gw||p.gw===D.gwsDone+1);
  if(p){
    const dl=gwDeadline(p.gw);
    if(!(dl&&Date.now()>dl.getTime()))
      out+='<a class="recapcard prev" href="'+p.href+'"><div><div class="rk">Gameweek '+p.gw+' preview<span class="new">NEW</span></div>'
        +'<div class="rt">'+p.title+'</div><div class="rs">'+p.sub+'</div></div><span class="go">READ</span></a>';
  }
  return out;
}
function renderGW(){
  buildH2H();
  const rows=D.fx.filter(f=>num(f.GW)===D.gw);
  if(!rows.length){document.getElementById('gwbody').innerHTML='<p class="state">No fixtures found for this gameweek.</p>';return}
  const w=D.mw.find(x=>num(x.GW)===D.gw)||{};
  const dl=dt(w['Deadline (UTC)']);
  const mi=SUB==null?NaN:parseInt(SUB,10);
  if(mi>=0&&mi<rows.length)renderMatch(rows[mi],dl);
  else renderScoreboard(rows,dl);
}
function mscore(f){
  const hp=num(f['Home pts']),ap=num(f['Away pts']);
  const done=fin(f.Finished),liveNow=!done&&(hp+ap>0||D.dlPassed);
  const hs=done?hp:Math.max(hp,liveScoreOf(f.Home)),as2=done?ap:Math.max(ap,liveScoreOf(f.Away));
  return{done,liveNow,hs,as2,score:(done||liveNow)?(hs+' – '+as2):'vs'};
}
function dlChipText(dl){ /* v5.7: the deadline is the app's most time-critical fact — audit found the old
   pale-gray label at ~1.2:1 contrast. Gold chip + live countdown. */
  const ms=dl-Date.now();let rel='';
  if(ms>0){const d2=Math.floor(ms/864e5),h=Math.floor(ms%864e5/36e5),m=Math.floor(ms%36e5/6e4);
    rel=' · '+(d2>0?d2+'d '+h+'h':h>0?h+'h '+m+'m':m+'m')+' left';}
  return 'DEADLINE '+dl.toLocaleString(undefined,{weekday:'short',hour:'numeric',minute:'2-digit'}).toUpperCase()+rel;
}
function renderScoreboard(rows,dl){
  SUBMARK={}; // sub treatments only live inside a matchup detail
  document.getElementById('gwbody').innerHTML=
   contentCardsHTML()
   +'<div class="gwlab" style="margin-top:14px">Gameweek '+D.gw
   +(dl?' <span class="dlchip">'+dlChipText(dl)+'</span>':'')+'</div>'
   +(D.provOver?'<div class="provnote"><b>All matches finished. Provisional result.</b> '
     +(Object.keys(D.pbonus||{}).length?'Estimated bonus (from live BPS) is counted. ':'')
     +'FPL usually confirms within a few hours; bonus and late stat amendments can still move points.</div>':'')
   +rows.map((f,i)=>{
     const s=mscore(f);
     const nm=derbyName(f.Home,f.Away),sr=series(f.Home,f.Away);
     /* xP once the GW is done; projected final while it runs; pure prediction pre-deadline */
     let xline='';
     if((s.done||D.provOver)&&D.hasXP)
       xline='<div class="xline"><span class="xlab xp">XP</span><b>'+fmt1(teamXP(f.Home))+'</b>–<b>'+fmt1(teamXP(f.Away))+'</b></div>';
     else if(D.dlPassed&&D.hasEP)
       xline='<div class="xline"><span class="xlab proj">PROJ FINAL</span><b>'+fmt1(teamProj(f.Home))+'</b>–<b>'+fmt1(teamProj(f.Away))+'</b></div>';
     else if(!D.dlPassed&&D.hasEP)
       xline='<div class="xline"><span class="xlab pred">PREDICTED</span><b>'+fmt1(teamProj(f.Home))+'</b>–<b>'+fmt1(teamProj(f.Away))+'</b></div>';
     return '<div class="mcard gx g'+((i%4)+1)+'" data-mi="'+i+'">'
      +(nm?'<div class="mname">'+esc(nm)+'</div>':'')
      +'<div class="mrow">'+mg(f.Home)+'<span class="tn2">'+esc(f.Home)+'<em>'+esc(TEAMS[f.Home]?.mgr||'')+'</em></span>'
      +'<span class="sc">'+s.score+'</span>'
      +'<span class="tn2 a">'+esc(f.Away)+'<em>'+esc(TEAMS[f.Away]?.mgr||'')+'</em></span>'+mg(f.Away)+'</div>'
      +'<div class="st'+(s.liveNow&&!D.provOver?' live':'')+'">'+(s.done?'FULL TIME':s.liveNow?(D.provOver?'FULL TIME · PROVISIONAL':'LIVE'):'TAP FOR LINEUPS')+'</div>'
      +(sr?'<div class="msr">All-time: '+esc(sr)+'</div>':'')
      +xline
      +'</div>';
   }).join('')+nextGwBtn()+plStrip();
  document.getElementById('gwbody').onclick=e=>{
    if(e.target.closest('#ngwbtn')){openNextGw();return}
    if(e.target.closest('#plall')){PLALL=!PLALL;if(!PLALL)PLOPEN.clear();renderGW();return}
    if(e.target.closest('.plp'))return; // player row → sheet via the body [data-i] handler
    const r=e.target.closest('.plrow.tap');
    if(r){const k=r.dataset.fx;if(PLALL){PLALL=false;PLOPEN.clear();}
      if(PLOPEN.has(k))PLOPEN.delete(k);else PLOPEN.add(k);
      r.classList.toggle('open',PLOPEN.has(k));r.setAttribute('aria-expanded',PLOPEN.has(k));
      const x=r.nextElementSibling;if(x&&x.classList.contains('plx'))x.classList.toggle('on',PLOPEN.has(k));return}
    const c=e.target.closest('.mcard');if(c&&c.dataset.mi!==undefined)location.hash='gw/'+c.dataset.mi};
}
function renderMatch(f,dl){
  const s=mscore(f);
  const nm=derbyName(f.Home,f.Away),sr=series(f.Home,f.Away);
  const hXI=xiOf(f.Home),aXI=xiOf(f.Away);
  const hAS=autoSubs(f.Home,true),aAS=autoSubs(f.Away,true);
  /* effective XI on the pitch: predicted sub-ins wear the SUB treatment; the
     replaced starters drop to the bench row, dimmed. TBD until FPL finalizes. */
  SUBMARK={};[hAS,aAS].forEach(as=>as.subs.forEach(s2=>{const l=s2.kind==='likely'?'l':'';SUBMARK[s2.inn.Code]='in'+l;SUBMARK[s2.out.Code]='out'+l;}));
  const hEff=hAS.xi,aEff=aAS.xi;
  const benchEff=(t,as)=>{const inn=new Set(as.subs.map(s2=>s2.inn.Code));
    return benchOf(t).filter(b=>!inn.has(b.Code)).concat(as.subs.map(s2=>s2.out));};
  const reason=(t,p)=>{if(flaggedOut(p)){const n=String(p.News||'').split(' - ')[0];return n?' ('+esc(n)+')':'';}
    const fl=xiOf(t).filter(likelyOut).map(q=>q.Player);return fl.length?' (if '+esc(fl.join(', '))+' misses out)':'';};
  const asubStrip=(t,as,kind)=>{const L=as.subs.filter(s2=>s2.kind===kind);return L.length?'<div class="asub'+(kind==='likely'?' lk':'')+'"><span class="md2" style="background:'+(TEAMS[t]?.col||'#999')+'"></span>'
    +'<b>'+(kind==='likely'?'Likely auto-subs':'Projected auto-subs')+'</b> '+L.map(s2=>'<span class="inn">▲ '+esc(s2.inn.Player)+'</span> for '+esc(s2.out.Player)+(kind==='likely'?reason(t,s2.out):'')).join(' · ')+'</div>':'';};
  const anyK=k=>hAS.subs.concat(aAS.subs).some(s2=>s2.kind===k);
  const asubs=asubStrip(f.Away,aAS,'locked')+asubStrip(f.Home,hAS,'locked')
    +(anyK('locked')?'<div class="asubnote">Already counted in proj final. FPL makes auto-subs official when the gameweek ends.</div>':'')
    +asubStrip(f.Away,aAS,'likely')+asubStrip(f.Home,hAS,'likely')
    +(anyK('likely')?'<div class="asubnote">Assumes starters FPL has flagged out don\'t play. Counted in proj final only; if a flagged player logs a minute, the bench order re-settles.</div>':'');
  const sub=s.done?'FULL TIME':s.liveNow?(D.provOver?'FULL TIME · PROVISIONAL':'LIVE'):(dl?('DEADLINE '+dl.toLocaleString(undefined,{weekday:'short',hour:'numeric',minute:'2-digit'}).toUpperCase()):'');
  D.xpview=XPMODE&&D.hasXP; // cards render xP/PROJ bubbles in expected mode
  const allPlayed=s.done||xiOf(f.Home).concat(xiOf(f.Away)).every(p=>fxStarted(p.Club));
  const scoreTxt=D.xpview?(fmt1(teamXPBlend(f.Home))+' – '+fmt1(teamXPBlend(f.Away))):s.score;
  const subTxt=D.xpview?(allPlayed?'EXPECTED POINTS':'EXPECTED + PROJECTED'):sub;
  /* the other number stays visible either way */
  /* one companion number, same trajectory as the scoreboard card:
     PREDICTED (pre-deadline) → PROJ FINAL (mid-GW) → xP (finished). */
  let scsub='';
  if(!D.xpview){
    if((s.done||D.provOver)&&D.hasXP)scsub='<div class="scsub">xP <b>'+fmt1(teamXP(f.Home))+'</b> – <b>'+fmt1(teamXP(f.Away))+'</b></div>';
    else if(D.dlPassed&&D.hasEP)scsub='<div class="scsub">proj final <b>'+fmt1(teamProj(f.Home))+'</b> – <b>'+fmt1(teamProj(f.Away))+'</b></div>';
    else if(D.hasEP)scsub='<div class="scsub">predicted <b>'+fmt1(teamProj(f.Home))+'</b> – <b>'+fmt1(teamProj(f.Away))+'</b></div>';
  }
  if(D.xpview)scsub='<div class="scsub">actual <b>'+s.hs+'</b> – <b>'+s.as2+'</b></div>';
  const xnote=D.xpview?'<div class="scsub" style="opacity:.8;font-weight:500">Played: what the performance deserved (xP). Yet to play: projected (PROJ). All xP once the gameweek ends.</div>':'';
  document.getElementById('gwbody').innerHTML=
   '<button class="backbtn" id="gwback">‹ All matchups</button>'
   +'<div class="stage" style="margin-top:2px">'
   +(nm?'<div class="derby">'+esc(nm)+'</div>':'')
   +'<div class="gwlab">Gameweek '+D.gw+'</div>'
   +'<div class="vs"><div class="side">'+mg(f.Home)+'<span class="tn">'+esc(f.Home)+'</span><span class="mgr">'+esc(TEAMS[f.Home]?.mgr||'')+'</span></div>'
   +'<div class="score">'+scoreTxt+'<em class="'+(s.liveNow&&!D.xpview?'live':'')+'">'+subTxt+'</em></div>'
   +'<div class="side">'+mg(f.Away)+'<span class="tn">'+esc(f.Away)+'</span><span class="mgr">'+esc(TEAMS[f.Away]?.mgr||'')+'</span></div></div>'
   +scsub
   +(sr?'<div class="series">All-time: <b>'+esc(sr)+'</b></div>':'')
   +'<div class="duel"><div class="half"></div><div class="cc"></div>'
   +'<div class="pbx t"></div><div class="pbx b"></div><div class="six t"></div><div class="six b"></div>'
   +'<div class="goal t"></div><div class="goal b"></div>'
   +'<div style="position:relative;z-index:2">'
   +'<div class="teamtag"><span class="md" style="background:'+(TEAMS[f.Away]?.col||'#999')+'"></span>'+esc(f.Away)+' · '+formation(aEff)+'</div>'
   +rowsFor(aEff,false)
   +'<div class="teamtag" style="margin:8px 0 8px"><span class="md" style="background:'+(TEAMS[f.Home]?.col||'#999')+'"></span>'+esc(f.Home)+' · '+formation(hEff)+'</div>'
   +rowsFor(hEff,true)
   +'</div></div>'
   +asubs
   +'<button class="btoggle" id="btog">'+(BENCHOPEN?'Hide benches':'Show benches')+'</button>'
   +(BENCHOPEN?
     '<div class="subs"><h4>Benches</h4>'
     +'<div class="teamtag" style="margin:0 0 8px"><span class="md" style="background:'+(TEAMS[f.Away]?.col||'#999')+'"></span>'+esc(f.Away)+' bench</div>'
     +'<div class="prow">'+benchEff(f.Away,aAS).map(p=>card(p,D.ro.indexOf(p))).join('')+'</div>'
     +'<div class="teamtag" style="margin:14px 0 8px"><span class="md" style="background:'+(TEAMS[f.Home]?.col||'#999')+'"></span>'+esc(f.Home)+' bench</div>'
     +'<div class="prow">'+benchEff(f.Home,hAS).map(p=>card(p,D.ro.indexOf(p))).join('')+'</div>'
     +'</div>':'')
   +'</div>';
  document.getElementById('gwbody').onclick=null;
  document.getElementById('gwback').onclick=()=>routeBack('#gw'); /* pops back to the list (scroll + accordions kept) */
  document.getElementById('btog').onclick=()=>{BENCHOPEN=!BENCHOPEN;renderGW()};
  D.xpview=false; // never leak expected mode into other views
}

/* ================= luck + manager profiles ================= */
function luckAgg(){ /* per owner: per-GW actual (excl. bonus) vs xP, from GW Stats history */
  const out={};
  /* started-only, same lens as the scoreboard: live GW = effective XI (predicted
     auto-subs applied); finished GWs = GW Log Started==='XI' (skip the filter for
     any GW the log missed rather than zero it out) */
  const logXI={},logGws=new Set();
  (D.gl||[]).forEach(r=>{const g2=num(r.GW);logGws.add(g2);
    if(r.Started==='XI')logXI[g2+'|'+String(r.Code)+'|'+r.Team]=1;});
  Object.keys(D.gwsByGw||{}).forEach(g=>{
    const isCur=num(g)===D.gw;
    Object.keys(D.gwsByGw[g]).forEach(code=>{
      const r=D.gwsByGw[g][code];if(!r.Owner)return;
      if(isCur){if(!inEffXi(r.Owner,code))return;}
      else if(logGws.has(num(g))&&!logXI[num(g)+'|'+String(code)+'|'+r.Owner])return;
      const t=out[r.Owner]=out[r.Owner]||{act:0,x:0,gws:{}};
      const a=r.Pts-r.Bonus,x=xpOf(r);
      t.act+=a;t.x+=x;t.bon=(t.bon||0)+num(r.Bonus); // excluded bonus, kept so the profile can reconcile vs the full score
      const gg=t.gws[g]=t.gws[g]||{act:0,x:0};gg.act+=a;gg.x+=x;});});
  return out;
}
let LUCKMODE='perf';
const CLOSE_MARGIN=5;
function schedLuck(){
  /* v5.7 Results luck: league points banked vs an ALL-PLAY schedule — each week your score is
     compared against all seven rivals (win 3 / draw 1 / loss 0, all-play prorated to /7).
     + = the fixture list has been kind (wins banked with scores that beat few rivals; the
     close-game record shows how much could have swung). Sums week over week, so schedule
     luck compounds. Scores via mscore (scoreboard-identical, incl. live + provisional). */
  const out={},byGw={};
  D.fx.forEach(f=>{const g=num(f.GW);(byGw[g]=byGw[g]||[]).push(f)});
  Object.keys(byGw).forEach(g=>{
    const fs=byGw[g];if(fs.length<4)return;
    const sc={};let ready=true;
    fs.forEach(f=>{const s2=mscore(f);if(!(s2.done||s2.liveNow)){ready=false;return}
      sc[f.Home]=s2.hs;sc[f.Away]=s2.as2;});
    if(!ready||Object.keys(sc).length<8)return;
    fs.forEach(f=>{[f.Home,f.Away].forEach(t=>{
      const opp=f.Home===t?f.Away:f.Home;
      const mine=sc[t],theirs=sc[opp];
      const act=mine>theirs?3:mine===theirs?1:0;
      let beat=0,tie=0;
      Object.keys(sc).forEach(o=>{if(o===t)return;if(mine>sc[o])beat++;else if(mine===sc[o])tie++;});
      const o2=out[t]=out[t]||{pts:0,ap:0,beat:0,opp:0,cw:0,cl:0,cd:0,gws:0};
      o2.pts+=act;o2.ap+=(beat+tie*0.5)/7*3;o2.beat+=beat+tie*0.5;o2.opp+=7;o2.gws++;
      if(Math.abs(mine-theirs)<=CLOSE_MARGIN){if(act===3)o2.cw++;else if(act===0)o2.cl++;else o2.cd++;}
    });});
  });
  return out;
}
function luckCard(){
  /* v5.7: two honest components, never blended (different units). PERFORMANCE = act vs xP
     (points). RESULTS = league pts vs all-play (league points). Green = lucky side up,
     red = unlucky — matches the app's green-good/red-bad grammar everywhere else. */
  const perf=luckAgg(),sched=schedLuck();
  const anyP=Object.keys(perf).length,anyS=Object.keys(sched).length;
  if(!anyP&&!anyS)return'';
  const tog='<span class="fatog"><button data-lm="perf" class="'+(LUCKMODE==='perf'?'on':'')+'">Performance</button>'
   +'<button data-lm="sched" class="'+(LUCKMODE==='sched'?'on':'')+'">Results</button></span>';
  let rowsH='',cap='';
  if(LUCKMODE==='perf'){
    const rows=Object.keys(perf).map(t=>({t,...perf[t],d:perf[t].act-perf[t].x})).sort((a,b)=>b.d-a.d);
    const mx=Math.max(...rows.map(r=>Math.abs(r.d)),1);
    rowsH=rows.map(r=>{
      const w=Math.abs(r.d)/mx*48;
      const bar=r.d>=0?'<i style="left:50%;width:'+w+'%;background:var(--good)"></i>':'<i style="right:50%;width:'+w+'%;background:var(--bad)"></i>';
      return '<div class="lrow2" data-prof="'+esc(r.t)+'">'+mg(r.t,1)
      +'<span class="lcol"><span class="lmid">'+esc(labShort(r.t))+'</span><span class="lnum">'+fmt1(r.act)+' · xP '+fmt1(r.x)+'</span></span>'
      +'<span class="lbar">'+bar+'</span>'
      +'<span class="ld" style="color:'+(r.d>=0?'var(--good)':'var(--bad)')+'">'+(r.d>=0?'+':'')+fmt1(r.d)+'</span></div>';}).join('');
    cap='<p class="mnote">Actual vs expected points, season to date, bonus excluded. <b style="color:var(--good)">+</b> running hot, <b style="color:var(--bad)">−</b> deserved more. Tap a manager for the full profile.</p>';
  } else {
    const rows=Object.keys(sched).map(t=>({t,...sched[t],d:sched[t].pts-sched[t].ap})).sort((a,b)=>b.d-a.d);
    const mx=Math.max(...rows.map(r=>Math.abs(r.d)),1);
    rowsH=rows.map(r=>{
      const w=Math.abs(r.d)/mx*48;
      const close=(r.cw+r.cl+r.cd)?' · close '+r.cw+'–'+r.cl:'';
      const bar=r.d>=0?'<i style="left:50%;width:'+w+'%;background:var(--good)"></i>':'<i style="right:50%;width:'+w+'%;background:var(--bad)"></i>';
      return '<div class="lrow2" data-prof="'+esc(r.t)+'">'+mg(r.t,1)
      +'<span class="lcol"><span class="lmid">'+esc(labShort(r.t))+'</span><span class="lnum">beats '+fmt1(r.beat)+' of '+r.opp+close+'</span></span>'
      +'<span class="lbar">'+bar+'</span>'
      +'<span class="ld" style="color:'+(r.d>=0?'var(--good)':'var(--bad)')+'">'+(r.d>=0?'+':'')+fmt1(r.d)+'</span></div>';}).join('');
    cap='<p class="mnote">League points banked vs an <b>all-play</b> schedule: your score against all seven rivals every week (win 3 · draw 1 · loss 0). <b style="color:var(--good)">+</b> means the fixture list has been kind. “Close” counts matches decided by ≤'+CLOSE_MARGIN+'. Tap a manager for the full profile.</p>';
  }
  return '<div class="fahead" style="margin:16px 2px 6px"><h2 style="margin:0">Luck index</h2>'+tog+'</div><div class="card lucks">'+rowsH+cap+'</div>';
}
function openProfile(team,intoEl){
  const st=D.st.find(s=>s.Team===team)||{};
  const agg=luckAgg()[team]||{act:0,x:0,bon:0,gws:{}};
  const gws=Object.keys(agg.gws).map(Number).sort((a,b)=>a-b);
  let best=null;
  D.fx.forEach(f=>{
    if(f.Home!==team&&f.Away!==team)return;
    const pt=effPtsOf(f,team);
    if((fin(f.Finished)||pt>0)&&(!best||pt>best.p))best={p:pt,g:num(f.GW),fin:fin(f.Finished)};});
  const col='#17121D',colX='#5B2D8E'; // ink = actual, purple = expected (v12 look)
  /* line chart: actual (solid blue) vs xP (dashed purple) */
  const W=440,PX=30,PY=26,n=gws.length,H=n<2?112:150;
  const maxv=Math.max(...gws.map(g=>Math.max(agg.gws[g].act,agg.gws[g].x)),10);
  const px=i=>n<2?W/2:PX+i*((W-PX*2)/(n-1)),py=v=>H-PY-(v/maxv)*(H-PY*2);
  const line=key=>gws.map((g,i)=>px(i)+','+py(agg.gws[g][key])).join(' ');
  const dots=key=>gws.map((g,i)=>{const v=agg.gws[g][key],ov=agg.gws[g][key==='act'?'x':'act'],c=key==='act'?col:colX;
    /* the higher value labels ABOVE its dot, the lower BELOW its own — labels can
       never meet between the dots (the GW1 Raya-profile collision) */
    const up=v>ov||(v===ov&&key==='act');
    return '<circle cx="'+px(i)+'" cy="'+py(v)+'" r="4" fill="'+c+'"/>'
     +'<text x="'+px(i)+'" y="'+(py(v)+(up?-9:16))+'" font-size="10.5" text-anchor="middle" fill="'+c+'" font-weight="700">'+fmt1(v)+'</text>';}).join('');
  const axis=gws.map((g,i)=>'<text x="'+px(i)+'" y="'+(H-5)+'" font-size="8.5" text-anchor="middle" fill="#6B6076" font-weight="700">GW'+g+'</text>').join('');
  const chart=n?'<svg viewBox="0 0 '+W+' '+H+'" width="100%" style="min-width:260px">'
   +[0.5,1].map(f2=>'<line x1="'+PX+'" y1="'+py(maxv*f2)+'" x2="'+(W-PX)+'" y2="'+py(maxv*f2)+'" stroke="#EEE8F2" stroke-dasharray="3 4"/>').join('')
   +(n>1?'<polyline points="'+line('act')+'" fill="none" stroke="'+col+'" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>'
     +'<polyline points="'+line('x')+'" fill="none" stroke="'+colX+'" stroke-width="2.4" stroke-dasharray="5 4" opacity=".85" stroke-linecap="round" stroke-linejoin="round"/>':'')
   +dots('act')+dots('x')+axis+'</svg>':'<p class="mnote">The graph draws itself once gameweek stats accrue.</p>';
  /* hero = the squad's top scorer counting ONLY weeks he was started (benched hauls don't count) */
  const xm=xiPtsMap();
  const xiOfP=p=>((xm[String(p.Code)]||{}).xi||0);
  const sq=squadOf(team).slice().sort((a,b)=>xiOfP(b)-xiOfP(a)||ovrOf(b)-ovrOf(a));
  const hero=sq[0];
  /* average points per gameweek actually played (live GW counts once scores exist) */
  let g=0,pf=0;
  D.fx.forEach(f=>{if(f.Home!==team&&f.Away!==team)return;
    const pt=effPtsOf(f,team);
    if(fin(f.Finished)||pt>0){g++;pf+=pt}});
  const avg=g?(pf/g):0;
  /* ---- v5.7 team page: the roster is the point (Parker: "see everyone's current team
     between matchweeks"). XI order from Rosters Slot; bench (Slot 12-15) faded. ---- */
  const slotOf={};squadOf(team).forEach(r=>{slotOf[String(r.Code)]=num(r.Slot)||99});
  const mine=(D.plr||[]).filter(p=>p.Owner===team)
    .sort((a,b)=>(slotOf[String(a.Code)]||99)-(slotOf[String(b.Code)]||99));
  const posName2={GKP:'Goalkeepers',DEF:'Defenders',MID:'Midfielders',FWD:'Forwards'};
  const rosterHtml=mine.length?'<div class="posh2" style="margin-top:16px">Current squad · '+mine.length+' players</div>'
   +['GKP','DEF','MID','FWD'].map(pos=>{
     const rows=mine.filter(p=>p.Pos===pos);
     return rows.length?'<div class="posh2" style="font-size:.52rem;margin:8px 2px 2px">'+posName2[pos]+'</div>'
      +rows.map(p=>{const bench=(slotOf[String(p.Code)]||99)>11;
        return bench?'<div style="opacity:.6">'+plrRow(p)+'</div>':plrRow(p);}).join(''):'';
   }).join('')
   +'<p class="mnote">Faded rows are on the bench right now. Tap any player for his full sheet.</p>':'';
  const nxf=D.fx.filter(f=>(f.Home===team||f.Away===team)&&!fin(f.Finished)&&effPtsOf(f,f.Home)+effPtsOf(f,f.Away)===0)
    .sort((a,b)=>num(a.GW)-num(b.GW))[0];
  const nxNm=nxf?derbyName(nxf.Home,nxf.Away):'';
  const nxHtml=nxf?'<div class="sub" style="margin:2px 0 10px">Next: GW'+num(nxf.GW)+' '
   +(nxf.Home===team?'vs ':'at ')+esc(nxf.Home===team?nxf.Away:nxf.Home)+(nxNm?' · '+esc(nxNm):'')+'</div>':'';
  const mytx=(D.tx||[]).filter(t2=>t2.Team===team).slice(0,6);
  const txHtml=mytx.length?'<div class="posh2" style="margin-top:14px">Recent moves</div>'
   +mytx.map(t2=>{const ok=/accept/i.test(t2.Result||''),pend=/pending/i.test(t2.Result||'');
     return '<div class="txrow'+((ok||pend)?'':' dim')+'" style="box-shadow:none;border-top:1px solid #F1EEF7;border-radius:0;margin:0">'+mg(t2.Team,1)
      +'<span class="txmain"><b>'+(t2.GW?('GW'+t2.GW):'')+'</b><em>'+esc(t2.Type||'')+' · '+esc(t2.Result||'')+'</em></span>'
      +'<span class="txmove"><span class="in">↑ '+esc(t2.In||'')+'</span><span class="out">↓ '+esc(t2.Out||'')+'</span></span></div>';}).join(''):'';
  const inner='<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">'+mg(team)+'<div><h3 style="margin:0">'+esc(team)+'</h3>'
   +'<div class="sub" style="margin:0">'+esc(TEAMS[team]?.mgr||'')+'</div></div></div>'
   +'<div class="profstats" style="grid-template-columns:repeat(3,1fr);margin:0 0 12px;gap:8px">'
   +'<div><b style="font-size:1.9rem;color:var(--p2)">'+avg.toFixed(1)+'</b><span>Avg pts / GW</span></div>'
   +'<div><b style="font-size:1.9rem">'+(best?best.p:'–')+'</b><span>Best GW'+(best?(' · GW'+best.g+(best.fin?'':' live')):'')+'</span></div>'
   +'<div><b style="font-size:1.45rem;line-height:1.5">'+(st.W!==undefined?st.W+'–'+st.D+'–'+st.L:'–')+'</b><span>W – D – L</span></div>'
   +'</div>'
   +nxHtml
   +rosterHtml
   +'<div class="posh2" style="margin-top:16px">Actual vs expected, week by week'+(gws.length<2?' · one gameweek so far':'')+'</div>'
   +'<div style="overflow-x:auto">'+chart+'</div>'
   +'<p class="sh-note"><span style="display:inline-block;width:14px;border-top:2.5px solid '+col+';vertical-align:middle;margin-right:3px"></span>actual (excl. bonus) · <span style="display:inline-block;width:14px;border-top:2.5px dashed '+colX+';vertical-align:middle;margin-right:3px"></span>expected (xP). Season luck: <b>'+((agg.act-agg.x)>=0?'+':'')+fmt1(agg.act-agg.x)+'</b>.'
   +(agg.bon?' Bonus points (+'+Math.round(agg.bon)+') sit outside both lines; with them, actual is '+fmt1(agg.act+agg.bon)+', matching the score up top.':'')+'</p>'
   +(hero?'<div class="profcard" style="max-width:200px;margin:14px auto 0"><div style="text-align:center;font-size:.56rem;font-weight:700;letter-spacing:.18em;color:var(--goldd);margin-bottom:6px">TOP SCORER · '+xiOfP(hero)+' PTS STARTED</div>'+card(hero,D.ro.indexOf(hero))+'</div>':'')
   +txHtml;
  const bindRows=el=>el.querySelectorAll('[data-pc]').forEach(r=>r.onclick=()=>{
    const p=(D.plr||[]).find(x=>String(x.Code)===String(r.dataset.pc));
    if(p)openSheet(plrPseudo(p));
  });
  if(intoEl){ /* v9.1 page mode — the My team tab renders the full team page in place */
    intoEl.innerHTML='<div class="card" style="padding:16px 18px">'+inner+'</div>';
    bindRows(intoEl);return;
  }
  sheet.innerHTML='<div class="sh-right" style="padding:16px 18px"><button class="sh-x" aria-label="Close">×</button>'+inner+'</div>';
  ov.classList.add('on');sheet.classList.add('on');pushOverlay();
  sheet.querySelector('.sh-x').onclick=closeSheet;
  bindRows(sheet);
}
/* ================= My team tab (v9.1) — pick once, then the app opens on YOU ================= */
function myTeam(){let t=null;try{t=localStorage.getItem('emt-myteam')}catch(e){}return (t&&TEAMS[t])?t:null}
function renderTeam(){
  const body=document.getElementById('teambody');if(!body)return;
  const mine=myTeam();
  if(!mine){
    body.innerHTML='<h2 style="margin-top:14px">Who are you?</h2>'
     +'<p class="mnote" style="padding:0 2px 10px;margin:0">Pick your team once. This phone remembers it.</p>'
     +'<div class="mgrid">'+((D.st||[]).map(s=>s.Team).filter(t=>TEAMS[t]).length?(D.st||[]).map(s=>s.Team).filter(t=>TEAMS[t]):Object.keys(TEAMS)).map(t=>
       '<button class="mt" data-pick="'+esc(t)+'" style="--tc:'+(TEAMS[t].col||'#5B1A66')+'"><span class="mtn">'+esc(t)+'</span><em class="mtm">'+esc(TEAMS[t].mgr)+'</em></button>').join('')+'</div>';
    body.querySelectorAll('[data-pick]').forEach(b=>b.onclick=e=>{e.stopPropagation();
      try{localStorage.setItem('emt-myteam',b.dataset.pick)}catch(err){}
      renderTeam();});
    return;
  }
  body.innerHTML='<div id="teampage" style="margin-top:12px"></div>'
   +'<p class="mnote" style="text-align:center;padding-bottom:4px"><button id="swteam" style="background:none;border:none;color:var(--p2);font-family:inherit;font-weight:700;cursor:pointer;font-size:.68rem;min-height:40px;padding:10px 12px">Not '+esc((TEAMS[mine].mgr||'').split(' ')[0])+'? Switch team</button></p>';
  openProfile(mine,document.getElementById('teampage'));
  document.getElementById('swteam').onclick=()=>{try{localStorage.removeItem('emt-myteam')}catch(e){}renderTeam()};
}
document.body.addEventListener('click',e=>{
  const lm=e.target.closest('[data-lm]');
  if(lm){LUCKMODE=lm.dataset.lm;renderAna();return}
  const pr=e.target.closest('[data-prof]');
  if(pr){e.stopPropagation();openProfile(pr.dataset.prof)}
});

/* ================= analysis tab — THE LAB ================= */
/* Data-first explorer: WHO (scope) · WHAT (metric) · HOW (view). Cards live on
   other tabs; here the chart is the hero. All series derive from data already
   in memory — zero new fetches. */
let LAB={scope:'mgr',sel:[],metric:'pts',view:'bars'};
const LABMETS={
 mgr:[['pts','Points'],['luck','Luck'],['margin','Win margin'],['pa','Points against'],['bench','Bench waste']],
 league:[['wins','Wins race'],['spread','Spread']],
 plr:[['pts','Points']] /* players scope retired — player stats live in the player sheet */
};
function anaOrder(){
  const o=D.st.slice().sort((a,b)=>num(b['League Pts'])-num(a['League Pts'])||num(b['Pts For'])-num(a['Pts For'])).map(t=>t.Team).filter(t=>TEAMS[t]);
  return o.length===8?o:Object.keys(TEAMS);
}
/* ---- assemblers ---- */
function mgrSeries(team){
  const out=[];
  D.fx.forEach(fx2=>{
    if(fx2.Home!==team&&fx2.Away!==team)return;
    const opp=fx2.Home===team?fx2.Away:fx2.Home;
    const me=effPtsOf(fx2,team),pa=effPtsOf(fx2,opp); // scoreboard-identical numbers, not the API's laggy totals
    if(!(fin(fx2.Finished)||me+pa>0))return;
    out.push({gw:num(fx2.GW),pts:me,pa:pa,margin:me-pa,live:!fin(fx2.Finished)});
  });
  return out.sort((a,b)=>a.gw-b.gw);
}
function benchByGw(team){
  const m={};
  (D.gl||[]).forEach(r=>{if(r.Team!==team||r.Started!=='BEN')return;
    const g=num(r.GW);m[g]=(m[g]||0)+num(r['GW pts']);});
  let live=0;
  D.ro.forEach(p=>{if(p.Team!==team)return;
    if(!inEffXi(team,p.Code))live+=num(p['GW pts']);}); // a predicted sub-in is no longer bench waste
  if(live&&!m[D.gw])m[D.gw]=live;
  return m;
}
function xiPtsMap(){
  /* XI attribution: points count for a manager only from weeks the player was
     actually started (GW Log for finished GWs, Rosters slot for the live one). */
  const m={};
  (D.gl||[]).forEach(r=>{
    if(num(r.GW)>=D.gw&&!D.demo)return;
    const k=String(r.Code);
    const o=m[k]=m[k]||{xi:0,bench:0,name:r.Player,owner:r.Team,pos:r.Pos,club:r.Club,byGw:{}};
    const p2=num(r['GW pts']);
    if(r.Started==='XI'){o.xi+=p2;o.byGw[num(r.GW)]=p2;}else o.bench+=p2;
  });
  D.ro.forEach(p=>{
    const k=String(p.Code);
    const o=m[k]=m[k]||{xi:0,bench:0,name:p.Player,owner:p.Team,pos:p.Pos,club:p.Club,byGw:{}};
    o.owner=p.Team;
    const inXI=inEffXi(p.Team,p.Code); // predicted auto-subs credit the sub-in, not the 0-min starter
    const pts=num(p['GW pts']);
    if(inXI){o.xi+=pts;o.byGw[D.gw]=(o.byGw[D.gw]||0)+pts;}else o.bench+=pts;
  });
  return m;
}
function plrSeriesOf(code,fn){
  const out=[];
  for(let g=1;g<=D.gw;g++){
    const r=(D.gwsByGw[g]||{})[String(code)];
    if(!r){out.push({gw:g,v:0,hollow:true});continue;}
    if(g===D.gw&&!fxStarted(r.Club))continue;
    out.push({gw:g,v:fn(r),hollow:!r.Mins,live:g===D.gw&&!fxFinished(r.Club)});
  }
  return out;
}
const cumulate=vals=>{let s=0;return vals.map(v=>({...v,v:(s+=v.v)}))};
/* ---- renderers ---- */
/* Lab charts draw in a 320-unit viewBox that scales with the card, so nothing hides behind a sideways scroll at
   320 px; type is sized for that scale and axis text is 6:1 on white. Axis steps are 1-2-5 'nice' for the data,
   end labels are short team names pushed apart so they never stack, and a live point wears a green ring. */
const LABAX='#5E566B';
const labShort=t=>(typeof SHORTOF!=='undefined'&&SHORTOF[t])||t;
const labInk=c=>{const n=parseInt(String(c).slice(1),16);if(String(c).length!==7||isNaN(n))return c; /* team colour darkened for text on white */
  return '#'+[n>>16,(n>>8)&255,n&255].map(v=>Math.round(v*.72).toString(16).padStart(2,'0')).join('')};
function labStep(range,n,ints){const raw=range/(n||4);if(!(raw>0))return 1;const e=Math.pow(10,Math.floor(Math.log10(raw))),f=raw/e;
  let st=(f<=1?1:f<=2?2:f<=2.5?2.5:f<=5?5:10)*e;if(ints&&st%1)st=Math.floor(st)||1;return st}
function svgLine(series,opts){
  opts=opts||{};
  series=series.filter(s=>s.vals.length);
  const gws=[...new Set(series.flatMap(s=>s.vals.map(v=>v.gw)))].sort((a,b)=>a-b);
  if(!gws.length)return'<p class="state">Draws itself once the data lands.</p>';
  const vl=series.length<=2; /* one or two lines: every point carries its value (the end label carries the last one) */
  const W=320,H=opts.h||200,PL=30,PT=16,PB=24,PR=opts.endLabels?(vl?82:66):18,X0=PL+10;
  const allv=series.flatMap(s=>s.vals.map(v=>v.v));
  let mx=Math.max(...allv,1),mn=Math.min(...allv,0);
  const st=labStep(mx-mn,4,allv.every(v=>Number.isInteger(v)));
  mx=Math.ceil(mx/st-1e-9)*st;mn=mn<0?Math.floor(mn/st+1e-9)*st:0;if(mx<=mn)mx=mn+st;
  const px=g=>{const i=gws.indexOf(g);return gws.length<2?X0+(W-X0-PR)/2:X0+i*((W-X0-PR)/(gws.length-1))};
  const py=v=>H-PB-((v-mn)/(mx-mn))*(H-PT-PB);
  const fv=v=>String(Math.round(v*10)/10);
  let out='';
  for(let k=0,v=mn;v<=mx+1e-9&&k<12;k++,v=mn+k*st){const zero=mn<0&&Math.abs(v)<1e-9;
    out+='<line x1="'+PL+'" y1="'+py(v)+'" x2="'+(W-PR)+'" y2="'+py(v)+'" stroke="'+(zero?'#D9CFE2':'#EEE8F2')+'"'+(zero?'':' stroke-dasharray="3 4"')+'/>'
     +'<text x="'+(PL-5)+'" y="'+(py(v)+3.5)+'" font-size="10.5" text-anchor="end" fill="'+LABAX+'">'+fv(v)+'</text>';}
  const step=Math.max(1,Math.ceil(gws.length/7));
  gws.forEach((g,i)=>{if(i%step)return;
    out+='<text x="'+px(g)+'" y="'+(H-7)+'" font-size="10.5" font-weight="700" text-anchor="middle" fill="'+LABAX+'">GW'+g+'</text>';});
  const thin=series.length>4,labs=[];
  series.forEach((s,si)=>{
    const solid=s.vals.filter(v=>!v.hollow);
    if(solid.length>1)out+='<polyline points="'+solid.map(v=>px(v.gw)+','+py(v.v)).join(' ')+'" fill="none" stroke="'+s.color+'" stroke-width="'+(thin?1.8:2.4)+'"'+(s.dash?' stroke-dasharray="5 4" opacity=".85"':'')+(thin&&!s.top?' opacity=".4"':'')+' stroke-linecap="round" stroke-linejoin="round"/>';
    const last=solid[solid.length-1];
    if(!thin||s.top)s.vals.forEach(v=>{
      out+='<circle cx="'+px(v.gw)+'" cy="'+py(v.v)+'" r="'+(v.hollow?3:thin?2.6:3.4)+'" fill="'+(v.hollow?'#F4F1F6':s.color)+'"'+(v.hollow?' stroke="'+s.color+'"':'')+'/>'
       +(v.live?'<circle cx="'+px(v.gw)+'" cy="'+py(v.v)+'" r="6.2" fill="none" stroke="#0E8A5F" stroke-width="1.4"/>':'');
      /* first series labels above its dots, second below — no collisions when lines cross */
      if(vl&&!v.hollow&&!(opts.endLabels&&v===last))out+='<text x="'+px(v.gw)+'" y="'+(py(v.v)+(si===0?-8:16))+'" font-size="10.5" font-weight="700" text-anchor="middle" fill="'+labInk(s.color)+'">'+fv(v.v)+'</text>';
    });
    if(opts.endLabels&&last&&(!thin||s.top))labs.push({x:px(last.gw),y:py(last.v),t:s.name+(vl?' '+fv(last.v):''),c:s.color});
  });
  if(labs.length){ /* one column right of the last point; labels pushed apart (one line each) and kept inside the plot */
    const gap=14,lo=PT-4,hi=H-PB;
    labs.sort((a,b)=>a.y-b.y||String(a.t).localeCompare(String(b.t)));labs.forEach(l=>{l.ly=Math.min(hi,Math.max(lo,l.y))});
    for(let i=1;i<labs.length;i++)labs[i].ly=Math.max(labs[i].ly,labs[i-1].ly+gap);
    if(labs[labs.length-1].ly>hi){labs[labs.length-1].ly=hi;for(let i=labs.length-2;i>=0;i--)labs[i].ly=Math.min(labs[i].ly,labs[i+1].ly-gap);}
    labs.forEach(l=>{const lx=l.x+8;
      if(Math.abs(l.ly-l.y)>2)out+='<polyline points="'+(l.x+4)+','+l.y+' '+(lx-2)+','+l.ly+'" fill="none" stroke="'+l.c+'" stroke-width="1" opacity=".6"/>';
      out+='<text x="'+lx+'" y="'+(l.ly+4)+'" font-size="11.5" font-weight="700" fill="'+labInk(l.c)+'">'+esc(l.t)+'</text>';});
  }
  return '<div class="labsvg"><svg viewBox="0 0 '+W+' '+H+'" width="100%" style="display:block;width:100%;height:auto;max-width:480px;margin:0 auto" role="img">'+out+'</svg></div>';
}
function rankBars(rows,opts){
  opts=opts||{};
  const mx=Math.max(...rows.map(r=>Math.abs(r.v)),0.001);
  return rows.map(r=>'<div class="lbrow"'+(r.tap?' data-lab="'+esc(r.tap)+'"':'')+'>'
    +(r.team?mg(r.team,1):(r.thumb||''))
    +'<span class="lbl2">'+esc(r.label)+(r.sub?'<em>'+r.sub+'</em>':'')+'</span>'
    +'<span class="lbtrack"><i style="width:'+Math.max(2,Math.abs(r.v)/mx*100)+'%;background:'+(r.barColor||'var(--p2)')+'"></i></span>'
    +'<b class="lbv"'+(r.vColor?' style="color:'+r.vColor+'"':'')+'>'+(opts.fmt?opts.fmt(r.v):Math.round(r.v*10)/10)+'</b></div>').join('');
}
/* ---- the lab ---- */
function labValidViews(){
  const multiGw=Object.keys(D.gwsByGw||{}).length>=2;
  if(LAB.scope==='league')return LAB.metric==='wins'?['race']:['spread'];
  if(LAB.scope==='plr')return multiGw?['trend','race']:['trend'];
  if(!LAB.sel.length)return multiGw?['bars','race']:['bars'];
  return multiGw?['trend','bars','race']:['bars','trend'];
}
function labSet(patch){
  Object.assign(LAB,patch);
  const mets=LABMETS[LAB.scope].map(m=>m[0]);
  if(!mets.includes(LAB.metric))LAB.metric=mets[0];
  const vv=labValidViews();
  if(!vv.includes(LAB.view))LAB.view=vv[0];
  renderLab();
}
function labChart(){
  const S=LAB,agg=luckAgg();
  const foot=t2=>'<div class="labfoot">'+t2+'</div>';
  if(S.scope==='mgr'){
    const teams=S.sel.length?S.sel:anaOrder();
    const serOf=t=>{
      const ms=mgrSeries(t),a=(agg[t]||{gws:{}}).gws;
      switch(S.metric){
        case'pts':return ms.map(m=>({gw:m.gw,v:m.pts,live:m.live}));
        case'pa':return ms.map(m=>({gw:m.gw,v:m.pa,live:m.live}));
        case'margin':return ms.map(m=>({gw:m.gw,v:m.margin,live:m.live}));
        case'vsx':return Object.keys(a).map(g=>({gw:num(g),v:a[g].act})).sort((x,y)=>x.gw-y.gw);
        case'luck':return Object.keys(a).map(g=>({gw:num(g),v:a[g].act-a[g].x})).sort((x,y)=>x.gw-y.gw);
        case'bench':{const b=benchByGw(t);return Object.keys(b).map(g=>({gw:num(g),v:b[g]})).sort((x,y)=>x.gw-y.gw);}
      }return[];
    };
    if(S.view==='bars'){
      const perGw=S.metric==='pts'||S.metric==='pa';
      /* luck reads like the Luck index below it: green = running hot, red = deserved more */
      const lc=v=>v>=0?'var(--good)':'var(--bad)';
      const rows=teams.map(t=>{
        const vals=serOf(t),sum=vals.reduce((s2,v)=>s2+v.v,0);
        const v=perGw&&vals.length?sum/vals.length:sum;
        return{label:labShort(t),team:t,v,tap:t,
          barColor:S.metric==='luck'?lc(v):S.metric==='bench'?'var(--bad)':TEAMS[t].col,
          vColor:S.metric==='luck'?lc(v):'',
          sub:perGw?'avg / GW':''};
      }).sort((a2,b2)=>b2.v-a2.v);
      return rankBars(rows,{fmt:v=>((S.metric==='luck'||S.metric==='margin')&&v>0?'+':'')+(Math.round(v*10)/10)})
        +foot(S.metric==='luck'?'Actual − expected, bonus excluded both sides. Green = running hot, red = deserved more.':S.metric==='bench'?'Points scored by benched players.':S.metric==='margin'?'Season sum of winning and losing margins. Positive means you won by more than you lost by.':'Tap a bar to focus that manager.');
    }
    /* every picked manager, and all eight in the race when nobody is picked */
    const series=teams.map(t=>({name:labShort(t),color:TEAMS[t].col,vals:S.view==='race'?cumulate(serOf(t)):serOf(t),top:true}));
    const one=S.metric==='pts'&&teams.length===1;
    if(one){
      /* one manager's actual vs expected: both lines without bonus, the same basis as the Luck index and the profile chart */
      const a=(agg[teams[0]]||{gws:{}}).gws,live={};mgrSeries(teams[0]).forEach(m=>{live[m.gw]=m.live});
      const av=Object.keys(a).map(g=>({gw:num(g),v:a[g].act,live:!!live[num(g)]})).sort((x,y)=>x.gw-y.gw);
      const xv=Object.keys(a).map(g=>({gw:num(g),v:a[g].x})).sort((x,y)=>x.gw-y.gw);
      series[0].color='#17121D';series[0].vals=S.view==='race'?cumulate(av):av;
      series.push({name:'xP',color:'#5B1A66',dash:true,vals:S.view==='race'?cumulate(xv):xv,top:true});
    }
    const anyLive=series.some(s=>s.vals.some(v=>v.live));
    return svgLine(series,{endLabels:series.length>1||S.view==='race'})
      +foot(one?'<span style="display:inline-block;width:14px;border-top:2.5px solid #17121D;vertical-align:middle;margin-right:3px"></span>actual · <span style="display:inline-block;width:14px;border-top:2.5px dashed #5B1A66;vertical-align:middle;margin-right:3px"></span>expected (xP). Bonus is left out of both, as in the Luck index.'+(anyLive?' Ringed dot = live.':'')
        :(S.view==='race'?'Cumulative season totals.':'Per-gameweek.')+(anyLive?' Ringed dot = live.':''));
  }
  if(S.scope==='league'){
    if(S.metric==='wins'){
      const series=anaOrder().map(t=>({name:labShort(t),color:TEAMS[t].col,top:true,
        vals:cumulate(mgrSeries(t).filter(m=>!m.live).map(m=>({gw:m.gw,v:m.pts>m.pa?1:0})))}));
      return svgLine(series,{endLabels:true,h:210})+foot('Cumulative wins, one line per manager. Draws move nobody.');
    }
    const gws=Object.keys(D.gwsByGw).map(Number).sort((a2,b2)=>a2-b2);
    const rows=gws.map(g=>{
      const pts=anaOrder().map(t=>{const m=mgrSeries(t).find(x=>x.gw===g);return m?{t,v:m.pts}:null}).filter(Boolean);
      return{g,pts};
    }).filter(r=>r.pts.length);
    if(!rows.length)return'<p class="state">Draws itself once scores land.</p>';
    /* a score axis, the week's lowest and highest labelled, every dot named on hover, and a colour key */
    const vals=rows.flatMap(r=>r.pts.map(p2=>p2.v));
    const st=labStep(Math.max(...vals)-Math.min(...vals),4,true);
    const lo=Math.floor(Math.min(...vals)/st)*st,hi=Math.max(lo+st,Math.ceil(Math.max(...vals)/st)*st);
    const W=320,X0=58,X1=W-26,rh=30,top=16,H=top+rows.length*rh+12;
    const sx=v=>X0+((v-lo)/(hi-lo))*(X1-X0);
    let out='';
    for(let k=0,v=lo;v<=hi+1e-9&&k<12;k++,v=lo+k*st)out+='<line x1="'+sx(v)+'" y1="'+(top-8)+'" x2="'+sx(v)+'" y2="'+(H-22)+'" stroke="#EEE8F2" stroke-dasharray="3 4"/>'
      +'<text x="'+sx(v)+'" y="'+(H-7)+'" font-size="10.5" text-anchor="middle" fill="'+LABAX+'">'+v+'</text>';
    rows.forEach((r,i)=>{
      const y=top+i*rh;
      const xs=r.pts.map(p2=>sx(p2.v));
      const lo2=r.pts.reduce((a2,b2)=>b2.v<a2.v?b2:a2),hi2=r.pts.reduce((a2,b2)=>b2.v>a2.v?b2:a2);
      out+='<text x="2" y="'+(y+4)+'" font-size="10.5" font-weight="700" fill="'+LABAX+'">GW'+r.g+'</text>'
       +'<line x1="'+Math.min(...xs)+'" y1="'+y+'" x2="'+Math.max(...xs)+'" y2="'+y+'" stroke="#D9CFE2" stroke-width="2"/>'
       +r.pts.map((p2,j)=>'<circle cx="'+xs[j]+'" cy="'+y+'" r="5" fill="'+TEAMS[p2.t].col+'" stroke="#fff" stroke-width="1"><title>'+esc(labShort(p2.t))+' · '+p2.v+'</title></circle>').join('')
       +'<text x="'+(sx(lo2.v)-8)+'" y="'+(y+4)+'" font-size="10.5" font-weight="700" text-anchor="end" fill="'+labInk(TEAMS[lo2.t].col)+'">'+lo2.v+'</text>'
       +'<text x="'+(sx(hi2.v)+8)+'" y="'+(y+4)+'" font-size="10.5" font-weight="700" fill="'+labInk(TEAMS[hi2.t].col)+'">'+hi2.v+'</text>';
    });
    return '<div class="labsvg"><svg viewBox="0 0 '+W+' '+H+'" width="100%" style="display:block;width:100%;height:auto;max-width:480px;margin:0 auto" role="img">'+out+'</svg></div>'
      +'<div class="labkey">'+anaOrder().map(t=>'<span><i style="background:'+TEAMS[t].col+'"></i>'+esc(labShort(t))+'</span>').join('')+'</div>'
      +foot('Every manager’s score, one row per gameweek; the lowest and highest are labelled.');
  }
  const picks=S.sel.slice(0,2);
  if(!picks.length)return'<p class="state">Search a player above to draw his season.</p>';
  const FNS={pts:[r=>r.Pts,null],vsx:[r=>r.Pts,r=>xpOf(r)],mins:[r=>r.Mins,null],gxg:[r=>r.G,r=>r.xG],axa:[r=>r.A,r=>r.xA]};
  const pair=FNS[S.metric]||FNS.pts,fa=pair[0],fb=pair[1];
  const series=[];
  picks.forEach(code=>{
    const pl=D.plr.find(p2=>String(p2.Code)===String(code));if(!pl)return;
    const col=pl.Owner&&pl.Owner!=='FREE'?(TEAMS[pl.Owner]||{}).col||'#999':'#6B6076';
    let va=plrSeriesOf(code,fa);if(S.view==='race')va=cumulate(va);
    series.push({name:pl.Player,color:col,vals:va,top:true});
    if(fb&&picks.length===1){let vb=plrSeriesOf(code,fb);if(S.view==='race')vb=cumulate(vb);
      series.push({name:S.metric==='vsx'?'xP':'expected',color:'#0E8A5F',dash:true,vals:vb,top:true});}
  });
  return svgLine(series,{endLabels:S.view==='race'})
    +foot((fb?'Dashed green = the expected version of the stat. ':'')+'Hollow dots = didn’t play.');
}
function renderLab(){
  const ctl=document.getElementById('labctl'),viz=document.getElementById('labviz');
  if(!ctl)return;
  const segs=[['mgr','Managers'],['league','League']];
  let sub='';
  if(LAB.scope==='mgr'){
    sub='<div class="labsub">'+anaOrder().map(t=>'<button class="labmono'+(LAB.sel.includes(t)?' on':'')+'" data-t="'+esc(t)+'" style="--tc:'+TEAMS[t].col+'">'+TEAMS[t].ini+'</button>').join('')
      +(LAB.sel.length?'<button class="labclear" data-clear>All</button>':'')+'</div>';
  }else if(LAB.scope==='plr'){
    sub='<div class="labsub"><input id="labq" type="search" placeholder="Search a player… (up to 2)">'
      +LAB.sel.map(c=>{const p2=D.plr.find(x=>String(x.Code)===String(c));return p2?'<button class="labpill" data-rm="'+c+'">'+esc(p2.Player)+' ×</button>':''}).join('')+'</div>'
      +'<div id="labres"></div>';
  }
  const mets='<div class="labmets">'+LABMETS[LAB.scope].map(m=>'<button class="labmet'+(LAB.metric===m[0]?' on':'')+'" data-m="'+m[0]+'">'+m[1]+'</button>').join('')+'</div>';
  const vv=labValidViews();
  const VN={trend:'Trend',bars:'Bars',race:'Race',spread:'Spread'};
  const views='<div class="labviews">'+(vv.length>1?vv.map(v=>'<button class="labview'+(LAB.view===v?' on':'')+'" data-v="'+v+'">'+VN[v]+'</button>').join(''):'')
    +'<button class="labview" data-reset style="margin-left:auto">Reset</button></div>';
  ctl.innerHTML='<div class="labseg">'+segs.map(s2=>'<button class="'+(LAB.scope===s2[0]?'on':'')+'" data-s="'+s2[0]+'">'+s2[1]+'</button>').join('')+'</div>'+sub+mets+views;
  viz.innerHTML=labChart();
  ctl.querySelectorAll('[data-s]').forEach(b=>b.onclick=()=>labSet({scope:b.dataset.s,sel:[]}));
  ctl.querySelectorAll('[data-t]').forEach(b=>b.onclick=()=>{
    const t=b.dataset.t,i=LAB.sel.indexOf(t),was=LAB.sel.length;
    if(i>=0)LAB.sel.splice(i,1);
    else{if(LAB.sel.length>=4)LAB.sel.shift();LAB.sel.push(t);} /* a 5th pick replaces the earliest one */
    labSet(!was&&LAB.sel.length&&LAB.view==='bars'?{view:'trend'}:{});}); /* picking from the bars opens the trend */
  ctl.querySelectorAll('[data-clear]').forEach(b=>b.onclick=()=>labSet({sel:[]}));
  ctl.querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>labSet({metric:b.dataset.m}));
  ctl.querySelectorAll('[data-v]').forEach(b=>b.onclick=()=>labSet({view:b.dataset.v}));
  ctl.querySelectorAll('[data-reset]').forEach(b=>b.onclick=()=>{LAB={scope:'mgr',sel:[],metric:'pts',view:'bars'};labSet({});});
  ctl.querySelectorAll('[data-rm]').forEach(b=>b.onclick=()=>{LAB.sel=LAB.sel.filter(c=>String(c)!==String(b.dataset.rm));labSet({});});
  const q=document.getElementById('labq');
  if(q)q.oninput=()=>{
    const res=document.getElementById('labres'),s2=q.value.toLowerCase();
    if(!s2){res.innerHTML='';return}
    res.innerHTML=D.plr.filter(p2=>String(p2.Player).toLowerCase().includes(s2)).sort((a2,b2)=>num(b2['Season pts'])-num(a2['Season pts'])).slice(0,5)
      .map(p2=>'<button class="labhit" data-add="'+p2.Code+'">'+esc(p2.Player)+' <span>'+esc(p2.Pos)+' · '+esc(p2.Club)+'</span></button>').join('');
    res.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>{
      if(LAB.sel.length<2&&!LAB.sel.includes(b.dataset.add))LAB.sel.push(b.dataset.add);
      labSet({});});
  };
  viz.querySelectorAll('[data-lab]').forEach(r=>r.onclick=()=>labSet({scope:'mgr',sel:[r.dataset.lab],view:Object.keys(D.gwsByGw).length>=2?'trend':'bars'})); /* the metric stays */
}
function goldenBoot(){
  const xm=xiPtsMap();
  const rows=Object.keys(xm).map(k=>({k,...xm[k]})).filter(p2=>p2.owner&&p2.xi>0)
    .sort((a2,b2)=>b2.xi-a2.xi).slice(0,8);
  if(!rows.length)return'';
  return '<h2>Golden Boot <small>started points only</small></h2><div class="card lucks">'
    +rankBars(rows.map(p2=>({label:p2.name,team:p2.owner,v:p2.xi,tap:p2.owner,
      barColor:TEAMS[p2.owner]?TEAMS[p2.owner].col:'#999',
      sub:p2.bench?('+'+p2.bench+' rotting on the bench'):''})),{fmt:v=>Math.round(v)})
    +'<p class="mnote">Only weeks a player was actually started count — a benched haul is a crime, not a credit.</p></div>';
}
const PRESETS=[
 ['Who’s running hot?',{scope:'mgr',sel:[],metric:'luck',view:'bars'}],
 ['Jacob’s trend',{scope:'mgr',sel:['Team Jacob'],metric:'vsx',view:'trend'}],
 ['Best value picks',{scope:'league',sel:[],metric:'value',view:'bars'}],
 ['Title race',{scope:'mgr',sel:[],metric:'pts',view:'race'}],
 ['Bench crimes',{scope:'mgr',sel:[],metric:'bench',view:'bars'}]];
function mgrTiles(){
  /* gradient identity tiles — no cards, no ambiguity: the whole tile opens the
     profile. Team-color gradient with a card-style sheen, stats up front. */
  const xm=xiPtsMap();
  return '<div class="mgrid">'+anaOrder().map(t=>{
    const xiOfP=p2=>((xm[String(p2.Code)]||{}).xi||0);
    const sq=squadOf(t).slice().sort((a2,b2)=>xiOfP(b2)-xiOfP(a2)||ovrOf(b2)-ovrOf(a2));
    const star=sq[0];
    let g=0,pf=0,best=0;
    D.fx.forEach(fx2=>{if(fx2.Home!==t&&fx2.Away!==t)return;
      const pt=effPtsOf(fx2,t);
      if(fin(fx2.Finished)||pt>0){g++;pf+=pt}
      if(fin(fx2.Finished)&&pt>best)best=pt;});  /* best = finished weeks, the same as Table · Season records */
    const st=D.st.find(s2=>s2.Team===t)||{};
    return '<button class="mt" data-prof="'+esc(t)+'" style="--tc:'+TEAMS[t].col+'">'
     +'<b class="mtn">'+esc(t)+'</b><em class="mtm">'+esc(TEAMS[t].mgr||'')+'</em>'
     +'<span class="mtrow">'
     +'<span><b>'+(g?(pf/g).toFixed(1):'–')+'</b><i>pts / gw</i></span>'
     +'<span><b>'+(best||'–')+'</b><i>best gw</i></span>'
     +'<span><b>'+(st.W!==undefined?st.W+'–'+st.D+'–'+st.L:'–')+'</b><i>w · d · l</i></span></span>'
     +(star?'<span class="mtstar"><i>STAR MAN</i>'+esc(star.Player)+' · '+xiOfP(star)+' pts</span>':'')
     +'</button>';
  }).join('')+'</div>';
}
function renderAna(){
  const body=document.getElementById('anabody');if(!body)return;
  body.innerHTML=
   '<div class="card labcard"><div class="labhead"><b>THE LAB</b></div>'
   +'<div id="labctl"></div><div id="labviz"></div></div>'
   +'<h2>The managers</h2>'
   +mgrTiles()
   +(luckCard()||'')
   +'<div class="faqsec" style="margin-top:14px"><h3>How to read this</h3>'
   +'<p><b>Projected</b>: the forecast before a match. <b>Expected (xP)</b>: what a performance deserved once played, from xG, xA and clean-sheet odds (e<sup>−xGC</sup>). '
   +'Actual − xP is the luck index: positive means the ball keeps bouncing your way (bonus excluded from both sides). '
   +'Manager scoring here counts <b>started players only</b>.</p></div>';
  renderLab();
}

/* ================= table (+ odds & honours) ================= */
function gauss(){let u=0,v=0;while(!u)u=Math.random();while(!v)v=Math.random();
  return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)}
function simulate(){
  const names=Object.keys(TEAMS);
  const M={};
  names.forEach(n=>{
    const t=TEAMS[n];
    const pMean=t.xi/38,pSd=((t.hi-t.lo)/2/1.28)/Math.sqrt(38)*1.9;
    const obs=[];
    D.fx.forEach(f=>{if(!fin(f.Finished))return;
      if(f.Home===n)obs.push(num(f['Home pts']));
      if(f.Away===n)obs.push(num(f['Away pts']));});
    const w=obs.length/(obs.length+8);
    const oMean=obs.length?obs.reduce((a,b)=>a+b,0)/obs.length:pMean;
    const oSd=obs.length>3?Math.sqrt(obs.reduce((a,b)=>a+(b-oMean)*(b-oMean),0)/obs.length):pSd;
    M[n]={mean:w*oMean+(1-w)*pMean,sd:Math.max(6,w*oSd+(1-w)*pSd)};
  });
  const pts={},pf={};names.forEach(n=>{pts[n]=0;pf[n]=0});
  const remain=[];
  D.fx.forEach(f=>{
    if(fin(f.Finished)){
      const hp=num(f['Home pts']),ap=num(f['Away pts']);
      pf[f.Home]+=hp;pf[f.Away]+=ap;
      if(hp>ap)pts[f.Home]+=3;else if(ap>hp)pts[f.Away]+=3;else{pts[f.Home]++;pts[f.Away]++;}
    }else remain.push([f.Home,f.Away]);
  });
  const N=10000,title={},last={};names.forEach(n=>{title[n]=0;last[n]=0});
  for(let s=0;s<N;s++){
    const p={...pts},q={...pf};
    for(const[h,a]of remain){
      if(!M[h]||!M[a])continue; /* unaliased rename — degrade, don't crash */
      const hs=Math.max(0,Math.round(M[h].mean+M[h].sd*gauss()));
      const as_=Math.max(0,Math.round(M[a].mean+M[a].sd*gauss()));
      q[h]+=hs;q[a]+=as_;
      if(hs>as_)p[h]+=3;else if(as_>hs)p[a]+=3;else{p[h]++;p[a]++;}
    }
    const order=names.slice().sort((x,y)=>(p[y]-p[x])||(q[y]-q[x]));
    title[order[0]]++;last[order[7]]++;
  }
  names.forEach(n=>{title[n]/=N/100;last[n]/=N/100});
  return{title,last};
}
const pctTxt=v=>v<1?'<1%':(v>99?'>99%':Math.round(v)+'%');
const heat=v=>v>=25?'#B3303A':'#17121D'; /* ink, status red once the risk is real (the old HSL ramp went neon green) */
function renderTable(){
  const st=D.st.slice().sort((a,b)=>num(b['League Pts'])-num(a['League Pts'])||num(b['Pts For'])-num(a['Pts For']));
  const lead=st[0];
  document.getElementById('spot').hidden=true;
  const sim=simulate();
  let recs='';
  let hi=null,lo=null; /* a record shared by several managers lists every one of them (the Lab tiles show each one's best) */
  const recOf=(cur,n,p,g,better)=>{if(!cur||better(p,cur.p))return{p,who:[[n,num(g)]]};if(p===cur.p)cur.who.push([n,num(g)]);return cur};
  D.fx.forEach(f=>{if(!fin(f.Finished))return;
    [[f.Home,num(f['Home pts']),f.GW],[f.Away,num(f['Away pts']),f.GW]].forEach(([n,p,g])=>{
      hi=recOf(hi,n,p,g,(a,b)=>a>b);lo=recOf(lo,n,p,g,(a,b)=>a<b);});});
  const recWho=r=>{const by={};r.who.slice().sort((a,b)=>a[1]-b[1]).forEach(w=>(by[w[0]]=by[w[0]]||[]).push('GW'+w[1]));
    const ks=Object.keys(by);return ks.length===1?esc(ks[0])+' · '+by[ks[0]].join(', '):ks.map(k=>esc(labShort(k))+' '+by[k].join(', ')).join(' · ');};
  if(hi&&lo)recs='<h2>Season records</h2><div class="minirecs">'
   +'<div><b class="hi">'+hi.p+'</b><div class="lb"><span>Highest GW</span><em>'+recWho(hi)+'</em></div></div>'
   +'<div><b class="lo">'+lo.p+'</b><div class="lb"><span>Lowest GW</span><em>'+recWho(lo)+'</em></div></div></div>';
  const bv=sim.last['Kobbie Mainoo Fan'],col=heat(bv);
  const done={};D.mw.forEach(w=>{done[num(w.GW)]=fin(w.Finished)});
  // MOTM totals: finished fixtures + the live gameweek once its deadline has passed, scored exactly like the
  // scoreboard (effPtsOf = max(API, effective-XI live sum) → includes locked auto-subs + provisional bonus). #12
  const motmLive=D.dlPassed&&!done[D.gw];
  const tot=per=>{const t={};D.fx.forEach(f=>{const g=num(f.GW);if(g<per[1]||g>per[2])return;
    if(!fin(f.Finished)&&!(motmLive&&g===D.gw))return;
    t[f.Home]=(t[f.Home]||0)+effPtsOf(f,f.Home);t[f.Away]=(t[f.Away]||0)+effPtsOf(f,f.Away);});return t};
  const curPer=PERIODS.find(p=>D.gw>=p[1]&&D.gw<=p[2]);
  let race='';
  if(curPer){
    const rt=tot(curPer);
    const ent=Object.entries(rt).sort((a,b)=>b[1]-a[1]);
    const mx=Math.max(1,ent.length?ent[0][1]:1);
    const liveTag=motmLive?' <span class="livetag">GW'+D.gw+' '+(D.provOver?'PROVISIONAL':'LIVE')+'</span>':'';
    race='<div class="card race"><span class="lb2">Manager of the Month</span><h3>'+curPer[0]+' · GW'+curPer[1]+'–'+curPer[2]+' · $30'+liveTag+'</h3>'
     +(ent.length?ent.map(([n,v],i)=>'<div class="rrow'+(i===0?' lead':'')+'">'+mg(n,1)
       +'<span class="rn">'+esc(n)+'</span><span class="rbar"><i style="width:'+Math.max(2,100*v/mx)+'%;background:'+(TEAMS[n]?.col||'#5B1A66')+'"></i></span><b>'+v+'</b>'+(i===0?'<span class="money">$30</span>':'')+'</div>').join('')
       :'<p class="mnote" style="margin:4px 0 2px">Race starts when the first scores land.</p>')
     +(motmLive?'<p class="mnote" style="margin:6px 0 0">Includes this gameweek\'s live scores, same as the scoreboard. Settles when FPL confirms the gameweek.</p>':'')
     +'</div>';
  }
  document.getElementById('tablebody').innerHTML=
   race+'<h2>Standings'+(D.provOver?'<span class="provtag">GW'+D.gw+' provisional included</span>':'')+'</h2><div class="card" style="padding:6px 8px">'
   +'<div class="trow thead"><span></span><span></span><span style="text-align:left">TEAM</span>'
   +'<span>W</span><span>D</span><span>L</span><span class="lp2">PTS</span></div>'
   +st.map((s,i)=>{const v=sim.title[s.Team]||0,tc=TEAMS[s.Team]?.col||'#5B1A66';
    return'<div class="trow'+(i===0&&D.started?' lead':'')+'" data-prof="'+esc(s.Team)+'" style="cursor:pointer">'
    +'<span class="rk">'+(i+1)+'</span><span>'+mg(s.Team)+'</span>'
    +'<span class="nm2">'+esc(s.Team)+'<em><span class="nw">'+esc(s.Manager)+' ·</span> <span class="nw">PF '+s['Pts For']+' · PA '+s['Pts Against']+'</span></em></span>'
    +'<span class="wdl w">'+s.W+'</span><span class="wdl">'+s.D+'</span><span class="wdl">'+s.L+'</span>'
    +'<span class="lp">'+s['League Pts']+'</span>'
    +'<span class="odds"><span class="olab">Title</span><span class="obar"><i style="width:'+Math.max(1.5,v)+'%;background:'+tc+'"></i></span><b class="opct2">'+pctTxt(v)+'</b></span>'
    +'</div>'}).join('')
   +'<p class="mnote" style="padding:6px 8px 8px;margin:0">Title odds from 5,000 simulated seasons · '+(D.started?'blends results so far with pre-season projections':'pre-season projections only until real scores arrive')+'.</p></div>'
   +recs
   +'<h2>The market</h2><div class="stage"><div class="sh2">Will Baha finish 8th?</div><div class="card"><div class="mkt">'
   +'<div class="dial" style="background:conic-gradient('+col+' '+(bv*3.6)+'deg,#F1EEF7 0)"><div class="in2"><b style="color:'+col+'">'+pctTxt(bv)+'</b><span>chance</span></div></div>'
   +'<div><p>Probability Kobbie Mainoo Fan takes last place, priced from 5,000 simulated seasons. Resolves GW38.</p>'
   +'<span style="font-size:.7rem;font-weight:700;color:'+col+'">'+(bv>=50?'Trending wooden spoon':bv>=25?'Genuinely in danger':'Safe… for now')+'</span></div></div></div></div>'
   +'<details class="acc"><summary>MOTM history</summary><div>'
   +PERIODS.filter(per=>per[1]<=D.gw).map(per=>{
     const complete=(()=>{for(let g=per[1];g<=per[2];g++)if(!done[g])return false;return true})();
     const t=tot(per);
     const ld=Object.entries(t).sort((a,b)=>b[1]-a[1])[0];
     let who='<span class="who"><em>–</em></span>',tag='<span class="tag wait">Upcoming</span>',money='';
     if(ld){who='<span class="who">'+mg(ld[0],1)+'<span class="nm4">'+esc(ld[0])+' <em class="num">'+ld[1]+' pts</em></span></span>';
       if(complete){tag='<span class="tag won">Winner</span>';money='<span class="money">$30</span>';}
       else tag='<span class="tag lead">Leading</span>';}
     return'<div class="mrow"><span class="per2">'+per[0]+'<em>GW'+per[1]+'–'+per[2]+'</em></span>'
      +who+'<span class="mtg">'+tag+money+'</span></div>';
   }).join('')+'</div></details>'+upAcc();
}

/* ================= players (replaces manager XIs — the pitch lives in matchup detail) ================= */
const BIGCLUBS=['ARS','LIV','MCI','CHE','MUN','TOT','AVL','BHA'];
let ALLCLUBS=false,PQUERY='',FATOG='tot';
function plrPseudo(p){ /* Players-tab row → openSheet-compatible object */
  const fc=D.fc27[String(p.Code)]||{};
  const ros=D.ro.find(r=>String(r.Code)===String(p.Code));
  if(ros)return ros;
  return {Player:p.Player,Pos:p.Pos,Club:p.Club,Code:p.Code,Nation:p.Nation||'',
    Status:p.Status==='a'?'a':'i',News:p.News||'',Team:'Free agent',Drafted:'FA',
    OVR:fc.ovr||'', 'GW pts':(gwsRow(p.Code)||{}).Pts||0,'GW mins':(gwsRow(p.Code)||{}).Mins||0,
    'Season pts':num(p['Season pts']),'Proj pts':num(p.Proj)};
}
function plrAvg(p){return (num(p['Season pts'])/Math.max(1,gwsPlayed(p)))}
function plrRow(p){
  const owned=p.Owner&&p.Owner!=='FREE';
  const own=owned
    ?'<span class="ownp" data-own="'+esc(p.Owner)+'" style="background:'+(TEAMS[p.Owner]?.col||'#999')+'">'+(TEAMS[p.Owner]?.ini||esc(p.Owner))+'</span>'
    :'<span class="ownp free">FREE</span>';
  /* the FC cutout when there is one, else FPL's photo (faceUrls) */
  const chain=faceUrls(p.Code);
  const ok=chain.filter(u=>!FACEBAD.has(u));
  const img=!ok.length?'<span class="noface3">'+initials(p.Player)+'</span>':'<img class="pf" loading="lazy" src="'+ok[0]+'" data-alt="'+ok.slice(1).join('|')
   +'" onerror="FACEBAD.add(this.getAttribute(\'src\'));var a=(this.dataset.alt||\'\').split(\'|\').filter(Boolean);if(a.length){this.src=a.shift();this.dataset.alt=a.join(\'|\')}else{this.outerHTML=\'<span class=noface3>'+initials(p.Player)+'</span>\'}">';
  return '<div class="prw" data-pc="'+p.Code+'">'+img
   +'<span class="pw"><b>'+esc(p.Player)+'</b><em>'+flagImg(p.Nation,11)+esc(p.Pos)+' · '+esc(p.Club)
   +' · OVR '+dynOvr(plrPseudo(p))+(p.News?' · <b style="color:#C62828;font-weight:700">Flagged</b>':'')+'</em></span>'
   +'<span class="ptb"><b>'+num(p['Season pts'])+'</b><span>'+(D.gwsDone>1?plrAvg(p).toFixed(1)+' AVG':'PTS')+'</span></span>'+own+'</div>';
}
function renderXIs(){
  SUBMARK={}; // sub treatments only live inside a matchup detail
  const body=document.getElementById('xisbody');
  if(!D.plr||!D.plr.length){body.innerHTML='<p class="state">The Players tab hasn’t landed in the sheet yet. Repaste Code.gs and run refreshAll.</p>';return}
  const club=SUB&&SUB!=='all'?SUB.toUpperCase():null;
  if(club){ /* drill-in: one club's full squad */
    const squad=D.plr.filter(p=>p.Club===club);
    const owned=squad.filter(p=>p.Owner&&p.Owner!=='FREE').length;
    const sect=pos=>{
      const rows=squad.filter(p=>p.Pos===pos)
        .sort((a,b)=>dynOvr(plrPseudo(b))-dynOvr(plrPseudo(a)));
      return rows.length?'<div class="posh2">'+({GKP:'Goalkeepers',DEF:'Defenders',MID:'Midfielders',FWD:'Forwards'})[pos]+'</div>'+rows.map(plrRow).join(''):'';};
    body.innerHTML='<button class="backbtn" id="pback">‹ All clubs</button>'
     +'<div class="card" style="display:flex;align-items:center;gap:12px">'+badgeImg(club,34)
     +'<div><b style="font-size:.95rem">'+esc(club)+'</b><div style="font-size:.68rem;color:var(--mid)">'+squad.length+' players · '+owned+' owned in the league</div></div></div>'
     +sect('GKP')+sect('DEF')+sect('MID')+sect('FWD');
    document.getElementById('pback').onclick=()=>{location.hash='xis'};
  } else {
    const clubs=Object.keys(D.clubs).length?Object.keys(D.clubs):[...new Set(D.plr.map(p=>p.Club))];
    const list=(ALLCLUBS?clubs.sort((a,b)=>(BIGCLUBS.indexOf(a)+1||99)-(BIGCLUBS.indexOf(b)+1||99)||a.localeCompare(b)):BIGCLUBS);
    let res='';
    if(PQUERY){
      const rows=searchPlayers(PQUERY,15);
      res=rows.length?rows.map(plrRow).join(''):'<p class="state">No player matches “'+esc(PQUERY)+'”.</p>';
    }
    /* activity accordion (folded in from the old Trades & Waivers tab) */
    const tx=D.tx||[];
    const actHtml='<details class="acc"><summary>Trades &amp; waivers'+(tx.length?' · '+tx.length:'')+'</summary>'
     +(tx.length?tx.map(t=>{
        const ok=/accept/i.test(t.Result||''),pend=/pending/i.test(t.Result||'');
        return '<div class="txrow'+((ok||pend)?'':' dim')+'" style="box-shadow:none;border-top:1px solid #F1EEF7;border-radius:0;margin:0">'+mg(t.Team,1)
         +'<span class="txmain"><b>'+esc(t.Team||'')+'</b><em>'+(t.GW?('GW'+t.GW+' · '):'')+esc(t.Type||'')+' · '+esc(t.Result||'')+'</em></span>'
         +'<span class="txmove"><span class="in">↑ '+esc(t.In||'')+'</span><span class="out">↓ '+esc(t.Out||'')+'</span></span></div>';
       }).join('')
       :'<p class="mnote" style="padding-bottom:10px">No moves yet. Pickups, drops and denied claims land here.</p>')
     +'</details>';
    /* top free agents, toggle total / average */
    const fas=D.plr.filter(p=>(!p.Owner||p.Owner==='FREE')&&num(p['Season pts'])>0)
      .sort((a,b)=>FATOG==='avg'?plrAvg(b)-plrAvg(a):num(b['Season pts'])-num(a['Season pts'])).slice(0,10);
    const faHtml=fas.length?'<div class="fahead"><h2 style="margin:0">Top free agents</h2>'
     +'<span class="fatog"><button data-ft="tot" class="'+(FATOG==='tot'?'on':'')+'">Total</button>'
     +'<button data-ft="avg" class="'+(FATOG==='avg'?'on':'')+'">Average</button></span></div>'
     +fas.map(plrRow).join(''):'';
    const rest='<div id="pres">'+res+'</div>'
     +(PQUERY?'':'<div class="clubgrid">'+list.map(c=>'<button data-club="'+c+'">'+badgeImg(c,32)+'<span>'+c+'</span></button>').join('')+'</div>'
       +'<button class="allclubs" id="allc">'+(ALLCLUBS?'Big 8 only ▴':'All 20 clubs ▾')+'</button>'
       +actHtml+faHtml);
    /* the search box is never replaced while it exists: replacing it on every keystroke threw the caret to the
       end (mid-word edits impossible) and bounced the iOS keyboard. Only what follows it is rebuilt. */
    const keep=document.getElementById('pfind');
    if(keep&&keep.parentNode===body){
      while(keep.previousSibling)keep.previousSibling.remove();
      while(keep.nextSibling)keep.nextSibling.remove();
      keep.insertAdjacentHTML('afterend',rest);
      if(document.activeElement!==keep&&keep.value!==PQUERY)keep.value=PQUERY;
    }else body.innerHTML='<input class="pfind" id="pfind" type="search" placeholder="Search any player" value="'+esc(PQUERY)+'">'+rest;
    const inp=document.getElementById('pfind');
    inp.oninput=()=>{PQUERY=inp.value;renderXIs();};
    const ac=document.getElementById('allc');if(ac)ac.onclick=()=>{ALLCLUBS=!ALLCLUBS;renderXIs()};
    body.querySelectorAll('[data-club]').forEach(b=>b.onclick=()=>{location.hash='xis/'+b.dataset.club});
    body.querySelectorAll('[data-ft]').forEach(b=>b.onclick=()=>{FATOG=b.dataset.ft;renderXIs()});
  }
  body.querySelectorAll('[data-pc]').forEach(r=>r.onclick=()=>{
    const p=D.plr.find(x=>String(x.Code)===String(r.dataset.pc));
    if(p)openSheet(plrPseudo(p));
  });
  /* owner chip → manager profile (doesn't open the player sheet) */
  body.querySelectorAll('[data-own]').forEach(c=>c.onclick=e=>{e.stopPropagation();openProfile(c.dataset.own)});
}
let TEAMSEL=null,BENCH2=false;
function grassSVG(){
  // half pitch: goal at the top, halfway line along the bottom
  return '<svg class="grass" viewBox="0 0 700 400" preserveAspectRatio="none" aria-hidden="true">'
   +'<defs><clipPath id="tz"><path d="M180 8 L520 8 L640 392 L60 392 Z"/></clipPath></defs>'
   +'<g clip-path="url(#tz)">'
   +'<rect x="0" y="0" width="700" height="400" fill="#2E7D46"/>'
   +[0,2,4].map(i=>'<rect x="0" y="'+(i*80)+'" width="700" height="80" fill="#37945A"/>').join('')
   +'<path d="M180 8 L520 8 L640 392 L60 392 Z" fill="none" stroke="rgba(255,255,255,.7)" stroke-width="3"/>'
   +'<path d="M288 8 L412 8 L432 104 L268 104 Z" fill="none" stroke="rgba(255,255,255,.65)" stroke-width="2.5"/>'
   +'<path d="M320 8 L380 8 L386 46 L314 46 Z" fill="none" stroke="rgba(255,255,255,.65)" stroke-width="2.5"/>'
   +'<line x1="60" y1="392" x2="640" y2="392" stroke="rgba(255,255,255,.65)" stroke-width="3"/>'
   +'<path d="M266 392 A 84 40 0 0 1 434 392" fill="none" stroke="rgba(255,255,255,.6)" stroke-width="2.5"/>'
   +'</g>'
   +'<rect x="302" y="0" width="96" height="8" fill="none" stroke="rgba(255,255,255,.9)" stroke-width="3"/>'
   +'</svg>';
}
function renderXIs_legacy(){ /* retired Manager XIs screen (v2) — dead code, kept for reference */
  const order=D.st.slice().sort((a,b)=>num(b['League Pts'])-num(a['League Pts'])||num(b['Pts For'])-num(a['Pts For'])).map(s=>s.Team).filter(t=>t);
  const names=order.length===8?order:Object.keys(TEAMS);
  if(!TEAMSEL)TEAMSEL=names[0];
  const sq=squadOf(TEAMSEL).slice().sort((a,b)=>ovrOf(b)-ovrOf(a));
  const st=D.st.find(s=>s.Team===TEAMSEL)||{};
  const xi=xiOf(TEAMSEL);
  const bench=benchOf(TEAMSEL).slice().sort((a,b)=>ovrOf(b)-ovrOf(a));
  let bestGW=null;
  D.fx.forEach(f=>{if(!fin(f.Finished))return;
    if(f.Home===TEAMSEL&&(!bestGW||num(f['Home pts'])>bestGW))bestGW=num(f['Home pts']);
    if(f.Away===TEAMSEL&&(!bestGW||num(f['Away pts'])>bestGW))bestGW=num(f['Away pts']);});
  const hero=sq[0];
  document.getElementById('xisbody').innerHTML=
   '<div class="xhead">'+mg(TEAMSEL)
   +'<select class="mx" id="teamsel" style="background-color:'+(TEAMS[TEAMSEL]?.col||'#5B1A66')+'">'
   +names.map(n=>'<option'+(n===TEAMSEL?' selected':'')+'>'+esc(n)+' — '+esc(TEAMS[n]?.mgr||'')+'</option>').join('')
   +'</select></div>'
   +'<div class="xhero">'
   +(hero?'<div class="hcard"><span class="hlab">Squad leader</span>'+card(hero,D.ro.indexOf(hero))+'</div>':'')
   +'<div class="xstats">'
   +'<div><span>Record</span><b>'+(D.started&&st.W!==undefined?st.W+'–'+st.D+'–'+st.L:'—')+'</b></div>'
   +'<div><span>Points for</span><b>'+(D.started?(st['Pts For']||0):'—')+'</b></div>'
   +'<div><span>Best gameweek</span><b>'+(bestGW!==null?bestGW:'—')+'</b></div>'
   +'<div><span>Squad OVR avg</span><b>'+(sq.length?Math.round(sq.reduce((a,p)=>a+ovrOf(p),0)/sq.length):'—')+'</b></div>'
   +'</div></div>'
   +'<div class="stage">'
   +'<div class="teamtag"><span class="md" style="background:'+(TEAMS[TEAMSEL]?.col||'#999')+'"></span>'+esc(TEAMSEL)+' · '+formation(xi)+'</div>'
   +'<div class="duel"><div class="half"></div><div class="cc"></div>'
   +'<div class="pbx t"></div><div class="pbx b"></div><div class="six t"></div><div class="six b"></div>'
   +'<div class="goal t"></div><div class="goal b"></div>'
   +'<div style="position:relative;z-index:2">'+rowsFor(xi,true)+'</div></div>'
   +'<button class="btoggle" id="btog2">'+(BENCH2?'Hide substitutes':'Show substitutes')+'</button>'
   +(BENCH2?'<div class="subs"><h4>Substitutes</h4><div class="prow">'+bench.map(p=>card(p,D.ro.indexOf(p))).join('')+'</div></div>':'')
   +'</div>';
  document.getElementById('teamsel').onchange=function(){TEAMSEL=names[this.selectedIndex];renderXIs()};
  document.getElementById('btog2').onclick=()=>{BENCH2=!BENCH2;renderXIs()};
}

/* ================= activity (trades & waivers) ================= */
function renderAct(){
  const tx=D.tx||[];
  if(!tx.length){document.getElementById('actbody').innerHTML=
    '<p class="state">No trades or waivers yet. Every pickup, drop and denied claim shows up here.</p>';return}
  document.getElementById('actbody').innerHTML='<h2>League activity</h2>'
   +tx.map(t=>{
     const ok=/accept/i.test(t.Result||'');
     const pend=/pending/i.test(t.Result||'');
     return '<div class="txrow'+((ok||pend)?'':' dim')+'">'+mg(t.Team)
      +'<span class="txmain"><b>'+esc(t.Team||'')+'</b><em>'+(t.GW?('GW'+t.GW+' · '):'')+esc(t.Type||'')+' · '+esc(t.Result||'')+'</em></span>'
      +'<span class="txmove"><span class="in">↑ '+esc(t.In||'')+'</span><span class="out">↓ '+esc(t.Out||'')+'</span></span></div>';
   }).join('');
}
/* next-GW preview: card-sized button after the matchups, popup with predicted scores + PL fixtures */
function nextGwBtn(){
  const g=D.gw+1,ep=D.predByGw[g];
  if(!ep||!D.fx.some(f=>num(f.GW)===g))return'';
  return '<button class="mcard gx g5 ngwcard" id="ngwbtn"><div class="mrow">'
   +'<span class="tn2"><b>Gameweek '+g+' preview</b><em>Predicted scores · fixtures · tap to open</em></span>'
   +'<span class="arr2">›</span></div></button>';
}
function openNextGw(){
  const g=D.gw+1,ep=D.predByGw[g]||{};
  const mus=D.fx.filter(f=>num(f.GW)===g);
  const w=D.mw.find(x=>num(x.GW)===g)||{};const d=dt(w['Deadline (UTC)']);
  const fxs=(D.cf||[]).filter(f=>num(f.GW)===g)
    .sort((a,b)=>String(a['Kickoff (UTC)']).localeCompare(String(b['Kickoff (UTC)'])));
  sheet.innerHTML='<div style="background:linear-gradient(115deg,#07304F 0%,#12557E 55%,#5B1A66 170%);color:#fff;border-radius:18px 18px 0 0;padding:14px 18px 12px;position:relative">'
   +'<button class="sh-x" aria-label="Close" style="background:rgba(255,255,255,.16);color:#fff">×</button>'
   +'<h3 style="margin:0;font-size:1.05rem">Gameweek '+g+'</h3>'
   +'<div style="font-size:.66rem;color:#B9D4E8;margin-top:2px">Predicted scores · current best XIs'+(d?' · deadline '+d.toLocaleString(undefined,{weekday:'short',hour:'numeric',minute:'2-digit'}).toUpperCase():'')+'</div></div>'
   +'<div style="padding:12px 16px 18px">'
   +mus.map(f=>{
     const nm=derbyName(f.Home,f.Away);
     return '<div class="mcard gx g5" style="cursor:default">'
      +(nm?'<div class="mname">'+esc(nm)+'</div>':'')
      +'<div class="mrow">'+mg(f.Home)+'<span class="tn2">'+esc(f.Home)+'<em>'+esc(TEAMS[f.Home]?.mgr||'')+'</em></span>'
      +'<span class="sc">'+fmt1(teamEP(f.Home,ep))+' – '+fmt1(teamEP(f.Away,ep))+'</span>'
      +'<span class="tn2 a">'+esc(f.Away)+'<em>'+esc(TEAMS[f.Away]?.mgr||'')+'</em></span>'+mg(f.Away)+'</div>'
      +'<div class="st">PREDICTED</div>'
      +(series(f.Home,f.Away)?'<div class="msr">All-time: '+esc(series(f.Home,f.Away))+'</div>':'')
      +'</div>';
   }).join('')
   +(fxs.length?'<div class="posh2">Premier League · GW'+g+'</div>'
     +fxs.map(f=>{const ko=dt(f['Kickoff (UTC)']);
       return '<div class="plrow">'+badgeImg(f.Home,16)+'<span class="cl">'+esc(f.Home)+'</span>'
        +'<span class="mid2" style="font-size:.72rem;color:var(--mid)">'+(ko?ko.toLocaleString(undefined,{weekday:'short',hour:'numeric',minute:'2-digit'}):'')+'</span>'
        +'<span class="cl a">'+esc(f.Away)+'</span>'+badgeImg(f.Away,16)+'<span class="pst"></span></div>';}).join(''):'')
   +'<p class="sh-note">Predictions are FPL’s pre-deadline expected points, frozen at the GW'+g+' deadline, summed over each manager’s current best XI.</p></div>';
  ov.classList.add('on');sheet.classList.add('on');pushOverlay();
  sheet.querySelector('.sh-x').onclick=closeSheet;
}
/* premier league scores strip (gameweek page) — v5.5: each fixture opens a "your players" panel */
const PLOPEN=new Set(); // fixture keys expanded by the user; survives the 5-min refetch re-render
let PLALL=false;
function fxKey(f){return f.Home+'|'+f.Away}
function fxPlayers(club){ // every rostered player at this club, XI first, then bench; within a group by owner then points
  const rows=D.ro.map((p,i)=>({p,i})).filter(o=>o.p.Club===club);
  const xi=o=>inEffXi(o.p.Team,o.p.Code)?0:1;
  return rows.sort((a,b)=>xi(a)-xi(b)||String(a.p.Team).localeCompare(String(b.p.Team))||num(b.p['GW pts'])-num(a.p['GW pts']));
}
function plPlayerRow(o,started,done,dgw){
  const p=o.p,bench=!inEffXi(p.Team,p.Code);
  /* double gameweek: the sheet only holds his gameweek total, so it is shown (labelled GW) under both fixtures
     with the gameweek's status, never as if it were this one fixture's points */
  if(dgw){started=fxStarted(p.Club);done=fxFinished(p.Club);}
  const val=started?'<span class="pv'+(done?'':' live')+'"'+(dgw?' title="Gameweek total, both fixtures"':'')+'><b>'+Math.round(num(p['GW pts']))+'</b><i>'+(dgw?'GW':done?'PTS':'LIVE')+'</i></span>'
                   :'<span class="pv proj"><b>'+projBubble(p)+'</b><i>PROJ</i></span>';
  return '<div class="plp'+(bench?' bench':'')+'" data-i="'+o.i+'">'+mg(p.Team,1)
   +'<span class="pn">'+esc(p.Player)+'<em>'+String(p.Pos).slice(0,3)+(bench?' · BENCH':'')+(dgw?' · DGW':'')+'</em></span>'+val+'</div>';
}
function plSnapshot(rows){ // who has men on the pitch right now
  const live=rows.filter(f=>fin(f.Started)&&!fin(f.Finished));
  if(!live.length)return'';
  const clubs=new Set(live.flatMap(f=>[f.Home,f.Away]));
  const per={};let tot=0;
  D.ro.forEach(p=>{if(clubs.has(p.Club)&&inEffXi(p.Team,p.Code)){per[p.Team]=(per[p.Team]||0)+1;tot++}});
  const chips=Object.keys(TEAMS).filter(t=>per[t]).sort((a,b)=>per[b]-per[a]).map(t=>'<span class="ch">'+mg(t,1)+per[t]+'</span>').join('');
  return '<div class="plsnap"><span class="lv">ON THE PITCH</span><span>'+tot+' XI player'+(tot===1?'':'s')+' in '+live.length+' live match'+(live.length===1?'':'es')+'</span>'+chips+'</div>';
}
function plStrip(){
  const rows=(D.cf||[]).filter(f=>num(f.GW)===D.gw);
  if(!rows.length)return'';
  const item=f=>{
    const done=fin(f.Finished),started=fin(f.Started);
    const hg=f['Home goals'];
    const hasScore=hg!==''&&hg!==undefined&&hg!==null;
    const ko=dt(f['Kickoff (UTC)']);
    const mid=hasScore?('<b>'+num(hg)+' – '+num(f['Away goals'])+'</b>'):(ko?ko.toLocaleString(undefined,{weekday:'short',hour:'numeric',minute:'2-digit'}):'');
    const st=done?'FT':(started&&hasScore?'LIVE':'');
    const k=fxKey(f),open=PLALL||PLOPEN.has(k);
    const hp=fxPlayers(f.Home),ap=fxPlayers(f.Away);
    const cnt=hp.filter(o=>inEffXi(o.p.Team,o.p.Code)).length+ap.filter(o=>inEffXi(o.p.Team,o.p.Code)).length;
    const dgw=c=>rows.filter(x=>x.Home===c||x.Away===c).length>1;
    const side=(ps,cls,c)=>'<div class="side'+cls+'"><div class="plsh">'+esc(c)+'</div>'+(ps.length?ps.map(o=>plPlayerRow(o,started,done,dgw(c))).join(''):'<div class="none">No league players</div>')+'</div>';
    /* the league-XI count sits apart from both clubs (it counts the whole match), with a player glyph */
    return '<div class="plrow tap'+(open?' open':'')+'" data-fx="'+esc(k)+'" role="button" aria-expanded="'+open+'">'
     +'<span class="chev">›</span>'+badgeImg(f.Home,16)+'<span class="cl">'+esc(f.Home)+'</span>'
     +'<span class="mid2 num">'+mid+'</span>'
     +'<span class="cl a">'+esc(f.Away)+'</span>'+badgeImg(f.Away,16)
     +'<span class="cnt" title="League starters in this match" aria-label="'+cnt+' league starters in this match"><svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="7" r="5"/><path d="M2 23c0-6 4.5-9 10-9s10 3 10 9z"/></svg>'+cnt+'</span>'
     +'<span class="pst'+(st==='LIVE'?' live':'')+'">'+st+'</span></div>'
     +'<div class="plx'+(open?' on':'')+'">'+side(hp,'',f.Home)+side(ap,' a',f.Away)+'</div>';
  };
  const sorted=rows.slice().sort((a,b)=>String(a['Kickoff (UTC)']).localeCompare(String(b['Kickoff (UTC)'])));
  return '<div class="plhead"><h2>Premier League</h2><button id="plall" type="button">'+(PLALL?'HIDE ALL':'SHOW ALL')+'</button></div><div class="card" style="padding:8px 12px">'
   +plSnapshot(sorted)+sorted.map(item).join('')+'</div>';
}
/* upcoming fixtures accordion (table page) */
function upAcc(){
  let out='';
  for(let g=D.gw+1;g<=Math.min(D.gw+6,38);g++){
    const fs=D.fx.filter(f=>num(f.GW)===g);
    if(!fs.length)continue;
    const w=D.mw.find(x=>num(x.GW)===g)||{};
    const d=dt(w['Deadline (UTC)']);
    out+='<div class="gwblk2"><b>GW'+g+'</b>'+(d?'<em>'+d.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})+'</em>':'')
     +fs.map(f=>'<span class="upfx">'+esc(f.Home)+' v '+esc(f.Away)+'</span>').join('')+'</div>';
  }
  return out?'<details class="acc"><summary>Upcoming fixtures</summary>'+out+'</details>':'';
}

/* ================= FAQ (with card gallery) ================= *//* ================= FAQ (with card gallery) ================= */
function demoCard(tier,ovr,pos,name,tag,desc,file,pts){
  const bust='<svg viewBox="0 0 100 100" style="width:100%;height:100%;border-radius:9cqw;background:rgba(0,0,0,.14);box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.35)" aria-hidden="true">'
   +'<circle cx="50" cy="38" r="17" fill="rgba(255,255,255,.55)"/>'
   +'<path d="M18 92 Q24 60 50 64 Q76 60 82 92 Z" fill="rgba(255,255,255,.55)"/></svg>';
  const fakeflag='<svg viewBox="0 0 18 12" style="width:12%;border-radius:2px" aria-hidden="true"><rect width="18" height="12" fill="#2E5BFF"/><rect x="6" width="6" height="12" fill="#F4F1F6"/></svg>';
  const fakeclub='<svg viewBox="0 0 18 19" style="width:12%" aria-hidden="true"><path d="M9 0 L18 3 L18 10 Q18 16 9 19 Q0 16 0 10 L0 3 Z" fill="#37003C"/><path d="M9 3 L15 5 L15 10 Q15 13.5 9 16 Q3 13.5 3 10 L3 5 Z" fill="#FFD23F"/></svg>';
  const face=file?'<img src="faces/'+file+'" alt="" onerror="this.style.display=\'none\'">':bust;
  return'<div class="gitem"><div class="fc '+tier+'" style="display:block;width:100%">'
   +cardBg(tier)
   +(tag?'<span class="tag">'+tag+'</span>':'')
   +'<span class="rt"><b>'+ovr+'</b><span>'+pos+'</span></span>'
   +'<span class="pts"><b>'+(pts||0)+'</b><i>PTS</i></span>'
   +'<span class="face">'+face+'</span>'
   +'<span class="nm">'+name+'</span>'
   +'<span class="meta">'+fakeclub+'<span class="sep"></span>'+fakeflag+'</span>'
   +'</div><p>'+desc+'</p></div>';
}
/* v12-clean copy pass (patch_v12_clean.py, 26 Sep 2026) */
function renderFAQ(){
  document.getElementById('faqbody').innerHTML=
   '<div class="faqtop"><button class="backbtn" id="faqback" type="button">‹ Back</button><h1>How it works</h1></div>'
   +'<h2>The cards</h2><div class="gallery">'
   +demoCard('silver',74,'MID','GRAHN','','<b>Silver</b>: rated under 78','487838.png',2)
   +demoCard('gold',81,'DEF','TAUNT','','<b>Gold</b>: rated 78–84','492777.png',6)
   +demoCard('elite',88,'GKP','GOULD','','<b>Elite</b>: rated 85+','111234.png',7)
   +demoCard('spec',90,'FWD','NOLAN','R1','<b>Draft special</b>: round 1–2 picks, league colours all season','mgr-nolan.png',8)
   +demoCard('spec',91,'MID','SCANTLEBURY','R2','<b>Round 2 pick</b>: same colours, R2 tag','215413.png',5)
   +demoCard('totw',84,'FWD','KHAROOFA','TOTW','<b>Team of the Week</b>: a 10+ point haul, lasts one week','mgr-baha.png',13)
   +demoCard('potm',89,'MID','SODINI','POTM','<b>Player of the Month</b>: the Premier League award','231416.png',9)
   +demoCard('gold',82,'MID','PJ NOLAN','','<b>Gold</b>: the most common tier','493105.png',3)
   +'</div>'
   +'<h2>The pot: $1,200</h2><div class="card"><div class="pot">'
   +'<div><b>$600</b><span>1st place</span></div><div><b>$180</b><span>2nd place</span></div>'
   +'<div><b>$60</b><span>3rd place</span></div><div><b>$90</b><span>Leader after GW19</span></div>'
   +'<div><b>9 × $30</b><span>Manager of the Month</span></div><div><b>$150</b><span>Buy-in × 8</span></div>'
   +'</div></div>'
   +'<h2>The details</h2>'
   +'<div class="faqsec"><h3>Ratings</h3><p>Every owned player carries a <b>base OVR</b>: career profile blended with the projection model, curated by the commissioner. On top of that, ratings now <b>breathe with form</b>: the last four performances, measured on real points scored, move the card by up to −3 or +5. A green ▲ means he’s outplaying his rating; a red ▼ means he’s coasting on reputation. Form can promote a Silver into Gold art, or relegate a Gold. The base never moves without the commissioner. Complaints are welcome and will be enjoyed.</p></div>'
   +'<div class="faqsec"><h3>Points on cards</h3><p>Cards show live gameweek points from kickoff. Before the deadline you see each manager’s last lineup carried forward; once the deadline passes, the real submitted lineup takes over.</p></div>'
   +'<div class="faqsec"><h3>Special cards</h3><p><b>Team of the Week:</b> haul 10+ points in a gameweek and the black &amp; gold appears the moment your match goes full time (bonus counts when it lands). It lasts one week, until your next match finishes: keep it with another haul or hand it back. The claret Player of the Month card follows the real Premier League award. If a player qualifies for more than one card, POTM beats TOTW beats the draft special.</p></div>'
   +'<div class="faqsec"><h3>The money: $1,200</h3><p>$600 for first, $180 for second, $60 for third. The leader after GW19 banks $90. Nine Manager of the Month prizes at $30 each: most points in the period, with August folded into September. Buy-in was $150.</p></div>'
   +'<div class="faqsec"><h3>League rules</h3><p>Head-to-head, 3/1/0 scoring across 38 gameweeks. Waivers open all season, no transfer or injury restrictions. Points-for is the tiebreaker.</p></div>'
   +'<div class="faqsec"><h3>Projected vs expected</h3><p><b>Projected</b> points are the app’s forecast before a player’s match: his expected minutes, his underlying numbers and the fixture. <b>Expected (xP)</b> is what a finished performance deserved: goals scored as xG, assists as xA, clean sheets as the odds of one given the chances faced. The matchup scoreline follows the same path: a projected final while games are in play, then the xP scoreline when the gameweek closes, so “won 41–38 but deserved to lose 33–45” is something your rivals can prove. Bonus is left out of xP.</p></div>'
   +'<div class="faqsec"><h3>The data</h3><p>Scores and lineups flow from the FPL Draft API on a rolling refresh: the app re-pulls whenever you open it and every few minutes while it’s on screen. During live matches it can trail the TV by a few minutes; if you got a red card thirty seconds ago, the card doesn’t know yet.</p></div>'
   +'<div class="faqsec"><h3>Privacy</h3><p>No ads, no analytics. This phone remembers which team you follow and, if you claimed a team, your sign-in. A claimed team’s photo, colours, crest and display name are saved to the league’s Google Sheet, which anyone with the link can view. PINs are kept only as hashes on the league’s server, never in the sheet.</p></div>';
  /* back to wherever the manual was opened from; a cold #faq load goes to Matchday */
  document.getElementById('faqback').onclick=()=>routeBack('');
}

/* ================= player sheet ================= */
const ov=document.getElementById('ov'),sheet=document.getElementById('sheet');
function tierExplain(t,p){
  switch(t){
    case'potm':return esc(p.Player)+' holds the Premier League Player of the Month award. This card lasts until the next one is announced.';
    case'totw':return esc(p.Player)+' hauled 10+ points this gameweek. The black &amp; gold lasts until his next match finishes.';
    case'spec':return'A round 1–2 draft pick carries the league colours all season.';
    case'elite':return'Elite tier: rated 85+ on current form.';
    case'gold':return'Gold tier: rated 78–84.';
    default:return'Silver tier: rated under 78.';
  }
}
function openSheet(p){
  const t=tierOf(p),o=dynOvr(p),fd=formDelta(p);
  const st=D.fc27&&D.fc27[String(p.Code)];
  const gk=p.Pos==='GKP';
  const labs=gk?['DIV','HAN','KIC','REF','SPD','POS']:['PAC','SHO','PAS','DRI','DEF','PHY'];
  const keys=['pac','sho','pas','dri','def','phy'];
  const statHtml=(st&&keys.some(k=>st[k]))?'<div class="statgrid">'+keys.map((k,i)=>{
    const v=Math.round(st[k]||0);
    const col=v>=80?'#0E8A5F':v>=65?'#C98A0B':'#B04A5A';
    return '<div class="sg">'+labs[i]+'<b>'+v+'</b><div class="bar"><i style="width:'+Math.min(99,v)+'%;background:'+col+'"></i></div></div>';
  }).join('')+'</div>':'';
  /* expected numbers + points breakdown from GW Stats (raw xG data, math client-side) */
  const gr=gwsRow(p.Code);
  const notPlayed=!fxStarted(p.Club);
  let xpHtml='',bdHtml='';
  if(notPlayed){
    /* hasn't kicked off yet → itemized PROJECTION from his season averages */
    const ep2=epOf(p.Code),hr=histRow(p.Code,p.Pos);
    xpHtml='<div class="xpgrid">'
     +'<div><b style="color:#5B2D8E">'+(ep2!==null?fmt1(ep2):'–')+'</b><span>PROJ (FPL)</span></div>'
     +'<div><b>'+(hr?hr.xG.toFixed(2):'–')+'</b><span>AVG xG</span></div>'
     +'<div><b>'+(hr?hr.xA.toFixed(2):'–')+'</b><span>AVG xA</span></div>'
     +'<div><b>'+(hr&&hr.Mins>=60&&p.Pos!=='FWD'?Math.round(Math.exp(-hr.xGC)*100)+'%':'–')+'</b><span>CS ODDS</span></div></div>';
    if(hr){
      const rows=bdOf(hr).filter(b=>b.x!=null&&Math.abs(b.x)>0.01);
      const tot=rows.reduce((s,b)=>s+b.x,0);
      if(rows.length)bdHtml='<div class="bdrow" style="border-bottom:2px solid #E7DEF0"><span style="font-weight:700">Projected gameweek</span><span class="a2"></span><span class="x2" style="font-size:.58rem;color:#5B2D8E">PROJ</span></div>'
       +rows.map(b=>'<div class="bdrow"><span>'+projLbl(b.lbl)+'</span><span class="a2"></span><span class="x2" style="color:#5B2D8E">'+(b.x>=0?'+':'')+b.x.toFixed(2)+'</span></div>').join('')
       +'<div class="bdrow"><span style="font-weight:700">Itemized total · FPL says</span><span class="a2"></span><span class="x2" style="color:#5B2D8E">'+fmt1(tot)+' · '+(ep2!==null?fmt1(ep2):'–')+'</span></div>'
       +'<p class="sh-note" style="margin-top:6px">Itemized from his averages over '+hr.n+' appearance'+(hr.n>1?'s':'')+' this season, priced with the same math as xP. FPL’s own forecast shown alongside. Flips to the real breakdown at kickoff.</p>';
    }
  }
  else if(gr){
    const csP=(p.Pos!=='FWD'&&gr.Mins>=60)?Math.round(Math.exp(-gr.xGC)*100)+'%':'–';
    xpHtml='<div class="xpgrid">'
     +'<div><b>'+fmt1(xpOf(gr))+'</b><span>GW xP</span></div>'
     +'<div><b>'+gr.xG.toFixed(2)+'</b><span>xG</span></div>'
     +'<div><b>'+gr.xA.toFixed(2)+'</b><span>xA</span></div>'
     +'<div><b>'+csP+'</b><span>CS ODDS</span></div></div>';
    const rows=bdOf(gr);
    if(rows.length)bdHtml='<div class="bdrow" style="border-bottom:2px solid #E7DEF0"><span style="font-weight:700">Gameweek '+D.gw+' breakdown</span><span class="a2" style="color:var(--mid);font-size:.58rem">PTS</span><span class="x2" style="font-size:.58rem">EXPECTED</span></div>'
     +rows.map(b=>'<div class="bdrow"><span>'+b.lbl+'</span><span class="a2">'+(b.pts>0?'+':'')+b.pts+'</span><span class="x2">'+(b.x==null?'–':(b.x>=0?'+':'')+b.x.toFixed(2))+'</span></div>').join('');
  }
  const ep=epOf(p.Code);
  sheet.innerHTML='<div class="sh-grid">'
   +'<div class="sh-left" style="flex-direction:column">'+card(p,D.ro.indexOf(p))+statHtml+'</div>'
   +'<div class="sh-right"><button class="sh-x" aria-label="Close">×</button>'
   +'<h3>'+esc(p.Player)+'</h3>'
   +'<div class="sub">'+badgeImg(p.Club,14)+esc(p.Club)+' · '+flagImg(p.Nation,13)+esc(NAT[p.Nation]||p.Nation||'')+' · '+esc(p.Team)+'</div>'
   +'<div class="chiprow"><span class="chip gold">OVR '+o+(fd?' <span style="color:'+(fd>0?'#0E8A5F':'#C62828')+'">('+(fd>0?'▲+':'▼−')+Math.abs(fd)+' form, base '+ovrOf(p)+')</span>':'')+'</span><span class="chip">'+esc(p.Pos)+'</span>'
   +'<span class="chip">'+(p.Drafted==='FA'?'Free agent':p.Drafted==='WV'?'Waiver add':'Drafted '+esc(p.Drafted))+'</span>'
   +(t==='totw'?'<span class="chip dark">TOTW</span>':'')
   +(t==='potm'?'<span class="chip rose">POTM</span>':'')
   +(t==='elite'?'<span class="chip blue">Elite</span>':'')
   +('isud'.indexOf(p.Status)>-1?'<span class="chip red">'+(p.News?esc(String(p.News).split(' - ')[0]):'Unavailable')+'</span>':'<span class="chip grn">Fit</span>')
   +'</div>'
   +xpHtml
   +(D.started?'<div class="srow"><span>Gameweek '+D.gw+'</span><b>'+Math.round(num(p['GW pts']))+' pts · '+Math.round(num(p['GW mins']))+' mins</b></div>':'')
   +(ep!==null&&!D.dlPassed?'<div class="srow"><span>Predicted this GW</span><b>'+fmt1(ep)+'</b></div>':'')
   +'<div class="srow"><span>'+(D.started?'Season total':'Last season')+'</span><b>'+seasonTot(p)+'</b></div>'
   +'<div class="srow"><span>Average per GW</span><b>'+avgOf(p)+'</b></div>'
   +'<div class="srow"><span>Next fixture</span><b>'+esc(nextFixture(p.Club))+'</b></div>'
   +bdHtml
   +'<p class="sh-note">'+tierExplain(t,p)+(gr?' Expected numbers use underlying stats: xG for goals, xA for assists, e<sup>−xGC</sup> for clean sheets, his prior hit-rate for defensive contribution. Bonus is left out of xP.':'')+'</p>'
   +'</div></div>';
  ov.classList.add('on');sheet.classList.add('on');pushOverlay();
  sheet.querySelector('.sh-x').onclick=closeSheet;
}
let OVPUSHED=false;
function pushOverlay(){ /* v5.7: one history entry per overlay stack, so the phone back
   button dismisses the sheet instead of navigating the app underneath it */
  if(!OVPUSHED){try{history.pushState({emtOv:1},'')}catch(e){}OVPUSHED=true}}
function closeSheet(){ov.classList.remove('on');sheet.classList.remove('on');
  if(OVPUSHED){OVPUSHED=false;try{history.back()}catch(e){}}}
window.addEventListener('popstate',()=>{
  if(OVPUSHED){OVPUSHED=false;ov.classList.remove('on');sheet.classList.remove('on')}
});
ov.onclick=closeSheet;
addEventListener('keydown',e=>{if(e.key==='Escape')closeSheet()});
/* an article opened from the All articles sheet comes back to that sheet: the tap marks the sheet's history entry,
   and when the app loads at that entry again (the article's × is history.back) the sheet reopens on it */
document.addEventListener('click',e=>{
  const a=e.target.closest('#sheet .artl a[href]'),s=history.state;
  if(a&&s&&s.emtOv){try{history.replaceState(Object.assign({},s,{emtArt:1}),'')}catch(err){}}
},true);
function reopenArticles(){
  const s=history.state;
  if(!s||!s.emtOv||!s.emtArt||typeof openArticles!=='function'||sheet.classList.contains('on'))return;
  OVPUSHED=true; /* this entry already is the sheet's: reopen on it without pushing another */
  openArticles();
}
document.body.addEventListener('click',e=>{
  const b=e.target.closest('[data-i]');
  if(b&&D.ro[+b.dataset.i])openSheet(D.ro[+b.dataset.i]);
});


/* ================= boot ================= */
if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('sw.js').catch(()=>{});
buildNav();route();renderFAQ();
let LOADED=0;
function loadAll(quiet){
  return Promise.all([
    readTab('Rosters'),readTab('Standings'),readTab('H2H Fixtures'),readTab('Matchweeks'),
    readTab('Club Fixtures').catch(()=>[]),readTab('Clubs').catch(()=>[]),readTab('Specials').catch(()=>[]),readTab('EA Map').catch(()=>[]),readTab('FC27').catch(()=>[]),readTab('Transactions').catch(()=>[]),
    readTab('Predictions').catch(()=>[]),readTab('GW Stats').catch(()=>[]),readTab('Players').catch(()=>[]),
    readTab('GW Log').catch(()=>[]),readTab('Fixture BPS').catch(()=>[])
  ]).then(([ro,st,fx,mw,cf,clubs,sp,ea,f27,tx,pred,gws,plr,gl,fb])=>{
    D.gl=gl||[];
    D.tx=tx||[];
    /* --- Predictions: GW → {code: EP} --- */
    D.predByGw={};(pred||[]).forEach(r=>{
      const g=num(r.GW);(D.predByGw[g]=D.predByGw[g]||{})[String(r.Code)]=r.EP===''?null:num(r.EP);});
    /* --- GW Stats: normalized rows keyed by code, per GW --- */
    D.gwsByGw={};(gws||[]).forEach(r=>{
      const g=num(r.GW);
      (D.gwsByGw[g]=D.gwsByGw[g]||{})[String(r.Code)]={
        Code:String(r.Code),GW:g,
        Player:r.Player,Pos:r.Pos,Club:r.Club,Owner:r.Owner||'',
        Mins:num(r.Mins),Pts:num(r.Pts),G:num(r.G),A:num(r.A),CS:num(r.CS),GC:num(r.GC),
        OG:num(r.OG),PS:num(r.PS),PM:num(r.PM),YC:num(r.YC),RC:num(r.RC),
        Saves:num(r.Saves),Bonus:num(r.Bonus),BPS:num(r.BPS),DefCon:num(r.DefCon),
        xG:num(r.xG),xA:num(r.xA),xGC:num(r.xGC),Starts:num(r.Starts),Final:fin(r.Final)};});
    D.plr=plr||[];
    D.ro=ro;D.st=st;D.fx=fx;D.mw=mw;D.cf=cf;D.clubs={};
    clubs.forEach(c=>{if(c.Short&&c['Badge code'])D.clubs[c.Short]=c['Badge code']});
    /* Clubs: FPL's 1 to 5 difficulty per club from Str H and Str A (Code.gs v3.22); strengthOf falls back to the built-in table */
    D.str={};clubs.forEach(c=>{const h=num(c['Str H']),a=num(c['Str A']);if(c.Short&&h>=1&&h<=5&&a>=1&&a<=5)D.str[c.Short]=[h,a]});
    const potmRow=sp.find(r=>r.Setting==='POTM player');
    D.potm=potmRow&&potmRow.Value?normN(potmRow.Value):'';
    /* EA Map tab = static paste of fpl_ea_crosswalk_2026_27.csv (keyed on fpl_code).
       Also accepts the legacy Player|EA ID schema. */
    D.ea={};ea.forEach(r=>{
      const id=String(r.ea_player_id||r['EA ID']||'').replace(/\D/g,'');if(!id)return;
      if(r.fpl_code)D.ea[String(r.fpl_code)]=id;
      if(r.fpl_web_name)D.ea['n:'+normN(r.fpl_web_name)]=id;
      if(r.Player)D.ea['n:'+normN(r.Player)]=id;
    });
    D.fc27={};f27.forEach(r=>{const c=String(r.fpl_code||'').replace(/\.0$/,'');
      if(c)D.fc27[c]={ovr:num(r.ea_ovr_fc27),pac:num(r.ea_pac),sho:num(r.ea_sho),pas:num(r.ea_pas),dri:num(r.ea_dri),def:num(r.ea_def),phy:num(r.ea_phy)}});
    mw.sort((a,b)=>num(a.GW)-num(b.GW));
    const cur=mw.find(w=>!fin(w.Finished))||mw[mw.length-1];
    D.gw=cur?num(cur.GW):1;
    D.gwsDone=mw.filter(w=>fin(w.Finished)).length;
    /* current-GW slices for xP / projections (EP falls back to the nearest captured block) */
    D.gwsCur=D.gwsByGw[D.gw]||{};
    /* D.predGw = the gameweek the block in D.predCur really forecasts: a stand-in block (this GW's capture missed) is
       never shown as this GW's FPL forecast (BUGS #6; fplEpOf reads null for it) */
    {const later=Object.keys(D.predByGw).map(Number).filter(g=>g>D.gw);
     D.predGw=D.predByGw[D.gw]?D.gw:later.length?Math.min.apply(null,later):null;}
    D.predCur=D.predGw!==null?D.predByGw[D.predGw]:{};
    D.hasXP=Object.keys(D.gwsCur).length>0;
    D.hasEP=Object.keys(D.predCur).length>0;
    const curDl=cur?dt(cur['Deadline (UTC)']):null;
    const anyLivePts=ro.some(r=>num(r['GW pts'])>0||num(r['GW mins'])>0);
    D.dlPassed=!!(curDl&&Date.now()>curDl.getTime());
    /* provisional full time: every current-GW fixture at the whistle, FPL yet to close the GW */
    const curFx=cf.filter(f=>num(f.GW)===D.gw);
    D.provOver=!!(D.dlPassed&&curFx.length&&curFx.every(f=>fin(f.Finished))&&cur&&!fin(cur.Finished));
    /* Fixture BPS (Code.gs v3.21, BUGS #8): this gameweek's BPS and bonus per match, keyed home|away, for a double */
    D.fbps={};(fb||[]).forEach(r=>{if(num(r.GW)!==D.gw||!r.Home||!r.Away)return;const k=r.Home+'|'+r.Away;(D.fbps[k]=D.fbps[k]||[]).push({Code:String(r.Code),Club:r.Club,BPS:num(r.BPS),Bonus:num(r.Bonus)});});
    D.pbonus=D.dlPassed?computeProvBonus(curFx):{};
    if(D.provOver){
      const eff={};st.forEach(s=>{eff[s.Team]={...s}});
      fx.filter(f=>num(f.GW)===D.gw&&!fin(f.Finished)).forEach(f=>{
        const hs=Math.max(num(f['Home pts']),liveScoreOf(f.Home)),as2=Math.max(num(f['Away pts']),liveScoreOf(f.Away));
        const H=eff[f.Home],A=eff[f.Away];if(!H||!A)return;
        H['Pts For']=num(H['Pts For'])+hs;H['Pts Against']=num(H['Pts Against'])+as2;
        A['Pts For']=num(A['Pts For'])+as2;A['Pts Against']=num(A['Pts Against'])+hs;
        if(hs>as2){H.W=num(H.W)+1;H['League Pts']=num(H['League Pts'])+3;A.L=num(A.L)+1;}
        else if(as2>hs){A.W=num(A.W)+1;A['League Pts']=num(A['League Pts'])+3;H.L=num(H.L)+1;}
        else{H.D=num(H.D)+1;A.D=num(A.D)+1;H['League Pts']=num(H['League Pts'])+1;A['League Pts']=num(A['League Pts'])+1;}
      });
      D.stOfficial=D.st;D.st=D.st.map(s=>eff[s.Team]||s);
    }
    D.started=D.gwsDone>0||fx.some(f=>fin(f.Finished))||anyLivePts||D.dlPassed;
    const liveNow=fx.some(f=>num(f.GW)===D.gw&&!fin(f.Finished))&&(D.dlPassed||anyLivePts);
    const pill=document.getElementById('gwpill');
    const finalMode=!D.dlPassed&&D.gwsDone>0&&!liveNow&&!D.provOver;
    pill.textContent=finalMode?('GW'+D.gwsDone+' · FINAL'):('GW'+D.gw+(D.provOver?' · PROVISIONAL':liveNow?' · LIVE':''));
    pill.classList.toggle('live',liveNow&&!D.provOver);
    pill.classList.toggle('prov',D.provOver);
    pill.classList.toggle('final',finalMode);
    LOADED=Date.now();
    renderGW();renderTable();renderXIs();renderAct();renderAna();
    if(!quiet){setTimeout(reopenArticles,0);
      const hs=history.state;if(hs&&hs.emtY&&!scrollY)window.scrollTo(0,hs.emtY);} /* back from an article: the page is tall again */
  }).catch(e=>{
    if(quiet&&D.ro.length)return; // background refresh failed: keep showing what we have
    document.querySelectorAll('.view>div[id]').forEach(d=>d.innerHTML='<p class="state">Couldn’t reach the sheet ('+esc(e.message)+'). Check link-sharing: Anyone with the link · Viewer.</p>');
  });
}
loadAll();
/* v11: refresh is the header button (v10-refresh.js); the pull gesture retired 13 Sep */
/* iOS resumes the app frozen — refetch when it comes back into view, and every few minutes while open */
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible'&&Date.now()-LOADED>120000)loadAll(true);
});
setInterval(()=>{
  if(document.visibilityState==='visible'&&Date.now()-LOADED>300000)loadAll(true);
},60000);
