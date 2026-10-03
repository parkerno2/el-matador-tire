/* Headshots: codes are fixed at publish time (a name lookup once picked the wrong one of two Palmers in the Players
   tab). Same cascade as the app: committed face, then PL 250x250, then PL 110x140, else the initials stay. */
(function(){
  document.querySelectorAll('.ph[data-code]').forEach(function(el){
    var code=el.getAttribute('data-code');
    var srcs=['faces/'+code+'.png',
      'https://resources.premierleague.com/premierleague/photos/players/250x250/p'+code+'.png',
      'https://resources.premierleague.com/premierleague/photos/players/110x140/p'+code+'.png'];
    var i=0,img=new Image();
    img.alt='';
    img.onload=function(){el.textContent='';el.appendChild(img)};
    img.onerror=function(){if(++i<srcs.length)img.src=srcs[i]};
    img.src=srcs[0];
  });
})();
