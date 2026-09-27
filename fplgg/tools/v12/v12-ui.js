/* ===== v12-ui · the anti-slop fixes a stylesheet can't reach (26 Sep 2026). Loaded last; every top-level name
   starts with uix.
   1. Score bugs: bugHTML writes its ground as an inline style with !important (two radial team-colour orbs over the
      plum gradient), which no stylesheet can override. The ground becomes flat plum; the team-colour flanks, the
      crests and everything else in the bug are untouched. Wraps whatever bugHTML is current (v12-match's included).
   2. The Lab: the manager filter shows each club's crest instead of an initials circle (the acronym-circle look),
      and Reset only appears once a Managers view has been changed.
   3. Players: the owner chip on a player row shows the owner's crest instead of a rainbow initials pill. The chip keeps
      its data-own tap (opens the manager sheet). ===== */
const uixBugHTML=bugHTML;
bugHTML=function(f,i,o){
  return uixBugHTML(f,i,o).replace(/style="background:radial-gradient\([^"]*?!important"/,'style="background:#34104E !important"');
};
const uixRenderLab=renderLab;
renderLab=function(){
  uixRenderLab();
  const ctl=document.getElementById('labctl');if(!ctl)return;
  ctl.querySelectorAll('.labmono[data-t]').forEach(b=>{const t=b.dataset.t;if(!TEAMS[t])return;
    b.innerHTML=crestOf(t,26);b.setAttribute('aria-label',t);b.title=t;});
  const atDefault=LAB.scope==='mgr'&&!LAB.sel.length&&LAB.metric==='pts'&&LAB.view==='bars';
  /* in League scope the Managers tab is the way back, so Reset would only take a row of its own */
  const r=ctl.querySelector('[data-reset]');if(r)r.style.display=(atDefault||LAB.scope!=='mgr')?'none':'';
};
const uixRenderXIs=renderXIs;
renderXIs=function(){
  uixRenderXIs.apply(this,arguments);
  const body=document.getElementById('xisbody');if(!body)return;
  body.querySelectorAll('.ownp[data-own]').forEach(c=>{const t=c.dataset.own;if(!TEAMS[t]||c.classList.contains('uix-own'))return;
    c.classList.add('uix-own');c.style.background='';c.innerHTML=crestOf(t,22);c.setAttribute('aria-label',t);c.title=t;});
};

/* integration: the header pill is the league clock on every screen, not only after the Matchday scoreboard renders
   (a direct load into #gw/N used to keep the base's "GW5 · FINAL" until the 30-second tick) */
const uix__rg=renderGW;renderGW=function(){const r=uix__rg.apply(this,arguments);try{v10clock()}catch(e){}return r};
