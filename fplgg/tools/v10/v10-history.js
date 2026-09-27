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
