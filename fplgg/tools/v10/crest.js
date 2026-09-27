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
module.exports={CREST,crestSVG,PALETTE,SHAPES};
