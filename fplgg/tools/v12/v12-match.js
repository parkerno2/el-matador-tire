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
