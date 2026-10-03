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
