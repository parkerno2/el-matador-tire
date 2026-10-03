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
