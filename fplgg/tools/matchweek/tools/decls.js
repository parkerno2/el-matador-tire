const acorn=require('acorn');const fs=require('fs');
const files=['base','v10','v12'];
const all=[];
for(const f of files){
  const src=fs.readFileSync('../src-prod/'+f+'.js','utf8');
  let ast;
  try{ast=acorn.parse(src,{ecmaVersion:'latest',sourceType:'script'});}catch(e){console.log('PARSE FAIL',f,e.message);continue}
  for(const n of ast.body){
    let names=[];
    if(n.type==='FunctionDeclaration')names=[n.id.name];
    else if(n.type==='VariableDeclaration')names=n.declarations.map(d=>d.id.name||'(pattern)');
    else if(n.type==='ExpressionStatement'){ // assignments like window.x= or IIFE
      const e=n.expression;
      if(e.type==='AssignmentExpression'){let l=e.left;names=['=' + src.slice(l.start,l.end)];}
      else if(e.type==='CallExpression'){names=['(call) '+src.slice(n.start,Math.min(n.end,n.start+60)).replace(/\n/g,' ')];}
      else names=['(expr '+e.type+')'];
    } else names=['('+n.type+')'];
    for(const nm of names) all.push({f,nm,start:n.start,end:n.end,len:n.end-n.start,kind:n.type});
  }
}
fs.writeFileSync('decls.json',JSON.stringify(all));
const by={};for(const d of all){(by[d.nm]=by[d.nm]||[]).push(d.f)}
console.log('total',all.length);
for(const f of files){const ds=all.filter(d=>d.f===f);console.log(f,ds.length,ds.reduce((a,d)=>a+d.len,0));}
console.log('redefined:',Object.entries(by).filter(([k,v])=>v.length>1).map(([k,v])=>k+':'+v.join('/')).join(', '));
