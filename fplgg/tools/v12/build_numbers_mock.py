#!/usr/bin/env python3
"""Hidden study page numbers.html = the v12 preview + v13-numbers.css + a 4-way toggle (Now / Every number /
Headlines / Headlines + glow). Run after build_v12.py:  python3 fplgg/tools/v12/build_numbers_mock.py"""
import pathlib
R = pathlib.Path(__file__).resolve().parents[3]; HERE = pathlib.Path(__file__).parent
s = (R / 'v12.html').read_text(encoding='utf-8')
css = (HERE / 'v13-numbers.css').read_text(encoding='utf-8')
js = r"""(function(){var K='emt-nv',L={now:'Now',a:'Every number',b:'Headlines',c:'+ glow'};
var q=new URLSearchParams(location.search).get('nv'),v=q;if(!v){try{v=localStorage.getItem(K)}catch(e){}}if(!L[v])v='a';
var t=document.createElement('div');t.id='nvtog';t.innerHTML=Object.keys(L).map(function(x){return '<button data-v="'+x+'">'+L[x]+'</button>'}).join('');
function set(x){var h=document.documentElement;h.classList.remove('nv-a','nv-b','nv-c');if(x!=='now')h.classList.add('nv-'+x);
 try{localStorage.setItem(K,x)}catch(e){}[].forEach.call(t.children,function(b){b.classList.toggle('on',b.getAttribute('data-v')===x)})}
t.addEventListener('click',function(e){var b=e.target.closest('button');if(b)set(b.getAttribute('data-v'))});
document.body.appendChild(t);set(v);})();"""
assert '</style>' not in css and '</script>' not in js
i = s.rindex('</body>')
s = s[:i] + '<style id="nvcss">\n' + css + '\n</style>\n<script id="nvjs">\n' + js + '\n</script>\n' + s[i:]
s = s.replace('<title>El Matador Tire · v12 preview</title>', '<title>El Matador Tire · number colours</title>')
(R / 'numbers.html').write_text(s, encoding='utf-8', newline='\n')
print('wrote numbers.html', len(s.encode()))
