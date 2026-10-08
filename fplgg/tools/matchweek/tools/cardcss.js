const postcss=require('postcss'),fs=require('fs');
let out='/* plate.css — GENERATED from production CSS (rules for the Plate card .fc). Do not edit by hand. */\n';
const keep=new Set();const usedAnims=new Set();
for(const i of [0,1,2]){
  const root=postcss.parse(fs.readFileSync('../src-prod/css'+i+'.css','utf8'));
  root.walkRules(r=>{
    if(r.parent.type==='atrule'&&/keyframes/.test(r.parent.name))return;
    const sels=r.selectors.filter(s=>/\.fc\b/.test(s));
    if(!sels.length)return;
    // skip selectors scoped to old page containers (#v-..., .duel, .pitch etc.) — keep plain card rules and state classes
    const plain=sels.filter(s=>/^\s*(\.fc|button\.fc|\.fc[\w.:\-\[\]=" ]*)/.test(s.trim())&&!/#|\.duel|\.stage|\.pitch|\.xi|\.bench|\.row|\.mpx|\.tsx|\.psx|\.sheet|\.gal|\.demo|\.faq/.test(s));
    if(!plain.length)return;
    let css=plain.join(',')+'{'+r.nodes.map(n=>n.toString()).join(';')+'}';
    let p=r.parent,wrap=[];
    while(p&&p.type==='atrule'){wrap.unshift('@'+p.name+' '+p.params);p=p.parent}
    for(const w of wrap.reverse())css=w+'{'+css+'}';
    out+=css+'\n';
    r.walkDecls(/animation/,d=>d.value.split(/[ ,]+/).forEach(v=>usedAnims.add(v)));
  });
  root.walkAtRules(/keyframes/,a=>{if(usedAnims.has(a.params))out+=a.toString()+'\n'});
}
fs.writeFileSync('../plate.gen.css',out);
console.log(out.length, out.split('\n').length);
