(function(){
  var c=document.getElementById('hero-carousel');
  if(!c)return;
  var s=c.querySelectorAll('.carousel-slide');
  var i=c.querySelectorAll('.carousel-indicator');
  var p=document.getElementById('carousel-prev');
  var n=document.getElementById('carousel-next');
  var pauseBtn=document.getElementById('carousel-pause');
  var cur=0,t,paused=false;
  var DELAY=6000;
  function go(x){
    s[cur].classList.remove('active');
    i[cur].classList.remove('active');
    cur=(x+s.length)%s.length;
    s[cur].classList.add('active');
    i[cur].classList.add('active');
    syncOpenLabels();
  }
  function syncOpenLabels(){
    for(var k=0;k<s.length;k++){
      var b=s[k].querySelector('.carousel-open');
      if(b){b.setAttribute('aria-label','Enlarge screenshot '+(k+1));}
    }
  }
  function clear(){if(t){clearInterval(t);t=null;}}
  function start(){clear();if(paused)return;t=setInterval(function(){go(cur+1);},DELAY);}
  function reset(){clear();start();}
  function setPaused(v){
    paused=!!v;
    if(pauseBtn){
      pauseBtn.textContent=paused?'\u25B6 Play':'\u23F8 Pause';
      pauseBtn.setAttribute('aria-label',paused?'Play carousel':'Pause carousel');
    }
    if(paused){clear();}else{start();}
  }
  if(p) p.onclick=function(){go(cur-1);reset();};
  if(n) n.onclick=function(){go(cur+1);reset();};
  for(var j=0;j<i.length;j++){(function(idx){i[idx].onclick=function(){go(idx);reset();};})(j);}
  if(pauseBtn) pauseBtn.onclick=function(){setPaused(!paused);};
  function onEnter(){clear();}
  function onLeave(){start();}
  if(window.matchMedia && window.matchMedia('(hover:hover)').matches){
    c.addEventListener('mouseenter',onEnter);
    c.addEventListener('mouseleave',onLeave);
  }
  c.addEventListener('focusin',onEnter);
  c.addEventListener('focusout',onLeave);

  // Small public API so the lightbox can hold the slideshow while it is open.
  window.acreetionCarousel={
    setPaused:setPaused,
    isPaused:function(){return paused;},
    index:function(){return cur;},
    go:function(x){go(x);reset();}
  };

  syncOpenLabels();
  start();
})();
