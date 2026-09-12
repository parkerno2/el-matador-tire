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
  if(!rows.length)return '<div class="hist tres"><h4>Results</h4><p class="hnone">No gameweeks played yet — the season’s results build here from GW1.</p></div>';
  const T={w:0,d:0,l:0,pf:0,pa:0};
  const tr=rows.map(r=>{if(!r.live){T[r.res.toLowerCase()]++;}T.pf+=r.my;T.pa+=r.their;
    const oc='<span class="oc">'+mg(r.opp,1)+esc(r.opp)+' <i>('+(r.home?'H':'A')+')</i>'+(r.nm?'<small>'+esc(r.nm)+'</small>':'')+'</span>';
    return '<tr'+(r.g===D.gw?' class="cur"':'')+'><td class="gw">'+r.g+'</td><td class="opp">'+oc+'</td>'
     +'<td class="sc"><b>'+r.my+'</b><i>–</i>'+r.their+'</td>'
     +'<td class="rs"><b class="'+(r.live?'lv':r.res)+'">'+(r.live?'LIVE':r.res)+'</b></td>'
     +'<td class="ps">'+resOrd(r.pos)+(r.live?'<i>*</i>':'')+'</td>'
     +'<td class="xp">'+(r.xp===null?'—':r.xp.toFixed(1))+'</td></tr>';}).join('');
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
    const tds=gws.map(g=>{const c=cell[t+'|'+g];if(!c)return '<td class="none">—</td>';pf+=c.p;
      return '<td class="'+c.r+(c.p===top[g]?' top':'')+(c.live?' live':'')+'">'+c.p+'</td>';}).join('');
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
