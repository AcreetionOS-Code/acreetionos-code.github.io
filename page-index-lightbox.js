(function(){
  var lb=document.getElementById('carousel-lightbox');
  if(!lb)return;
  var stage=document.getElementById('lightbox-stage');
  var img=document.getElementById('lightbox-img');
  var zoomLabel=document.getElementById('lightbox-zoom-level');
  var closeBtn=document.getElementById('lightbox-close');
  var zoomInBtn=document.getElementById('lightbox-zoom-in');
  var zoomOutBtn=document.getElementById('lightbox-zoom-out');
  var resetBtn=document.getElementById('lightbox-reset');
  var sources=[];
  var idx=0,scale=1,tx=0,ty=0;
  var MIN=1,MAX=6;
  var lastFocus=null,carouselWasPaused=false,moved=false;

  Array.prototype.forEach.call(document.querySelectorAll('.carousel-open'),function(btn){
    var im=btn.querySelector('img');
    if(im) sources.push({src:im.getAttribute('src'),alt:im.getAttribute('alt')||''});
  });
  if(!sources.length) return;

  function apply(){
    img.style.transform='translate('+tx+'px,'+ty+'px) scale('+scale+')';
    if(zoomLabel) zoomLabel.textContent=Math.round(scale*100)+'%';
  }
  function baseDims(){ return {w:img.offsetWidth||1,h:img.offsetHeight||1}; }
  function clamp(){
    var r=stage.getBoundingClientRect(),b=baseDims();
    var mx=Math.max(0,(b.w*scale-r.width)/2);
    var my=Math.max(0,(b.h*scale-r.height)/2);
    if(tx>mx)tx=mx; if(tx<-mx)tx=-mx;
    if(ty>my)ty=my; if(ty<-my)ty=-my;
  }
  function setScale(next,clientX,clientY){
    next=Math.min(MAX,Math.max(MIN,next));
    var r=stage.getBoundingClientRect();
    var cx=(typeof clientX==='number'?clientX:r.left+r.width/2)-(r.left+r.width/2);
    var cy=(typeof clientY==='number'?clientY:r.top+r.height/2)-(r.top+r.height/2);
    var k=next/scale;
    tx=cx*(1-k)+k*tx;
    ty=cy*(1-k)+k*ty;
    scale=next;
    if(scale<=MIN+0.001){scale=MIN;tx=0;ty=0;}
    clamp();
    apply();
  }
  function resetView(){ scale=1;tx=0;ty=0;apply(); }
  function load(i){
    idx=(i+sources.length)%sources.length;
    img.setAttribute('src',sources[idx].src);
    img.setAttribute('alt',sources[idx].alt);
    resetView();
  }
  function open(i,trigger){
    lastFocus=trigger||document.activeElement;
    load(i);
    carouselWasPaused=!!(window.acreetionCarousel&&window.acreetionCarousel.isPaused());
    if(window.acreetionCarousel) window.acreetionCarousel.setPaused(true);
    lb.classList.add('open');
    lb.setAttribute('aria-hidden','false');
    document.body.style.overflow='hidden';
    if(closeBtn) closeBtn.focus();
  }
  function close(){
    lb.classList.remove('open');
    lb.setAttribute('aria-hidden','true');
    document.body.style.overflow='';
    if(!carouselWasPaused&&window.acreetionCarousel) window.acreetionCarousel.setPaused(false);
    if(lastFocus&&lastFocus.focus) lastFocus.focus();
  }

  var pts={},dragging=null,pinch=null;
  function count(){ return Object.keys(pts).length; }
  function two(){ var k=Object.keys(pts); return [pts[k[0]],pts[k[1]]]; }

  stage.addEventListener('pointerdown',function(e){
    if(e.pointerType==='mouse'&&e.button!==0) return;
    moved=false;
    pts[e.pointerId]={x:e.clientX,y:e.clientY};
    try{ stage.setPointerCapture(e.pointerId); }catch(err){}
    if(count()===1){
      dragging={x:e.clientX,y:e.clientY,tx:tx,ty:ty};
      stage.classList.add('dragging');
    }else if(count()===2){
      dragging=null;
      var t=two(),d=Math.hypot(t[0].x-t[1].x,t[0].y-t[1].y)||1;
      pinch={dist:d,scale:scale};
    }
  });
  stage.addEventListener('pointermove',function(e){
    if(!pts[e.pointerId]) return;
    pts[e.pointerId]={x:e.clientX,y:e.clientY};
    if(count()>=2&&pinch){
      moved=true;
      var t=two(),d=Math.hypot(t[0].x-t[1].x,t[0].y-t[1].y)||1;
      setScale(pinch.scale*(d/pinch.d),(t[0].x+t[1].x)/2,(t[0].y+t[1].y)/2);
      return;
    }
    if(dragging&&scale>1){
      var dx=e.clientX-dragging.x,dy=e.clientY-dragging.y;
      if(Math.abs(dx)+Math.abs(dy)>6) moved=true;
      e.preventDefault();
      tx=dragging.tx+dx;
      ty=dragging.ty+dy;
      clamp();
      apply();
    }
  });
  function release(e){
    delete pts[e.pointerId];
    if(count()<2) pinch=null;
    if(count()===0){ dragging=null; stage.classList.remove('dragging'); }
  }
  stage.addEventListener('pointerup',release);
  stage.addEventListener('pointercancel',release);

  stage.addEventListener('wheel',function(e){
    e.preventDefault();
    var factor=Math.exp(-e.deltaY*(e.deltaMode===1?0.05:0.0015));
    setScale(scale*factor,e.clientX,e.clientY);
  },{passive:false});

  stage.addEventListener('dblclick',function(e){
    e.preventDefault();
    setScale(scale>1.2?1:2.5,e.clientX,e.clientY);
  });
  stage.addEventListener('click',function(e){
    if(e.target===stage&&!moved) close();
  });

  if(zoomInBtn) zoomInBtn.onclick=function(){ setScale(scale*1.4); };
  if(zoomOutBtn) zoomOutBtn.onclick=function(){ setScale(scale/1.4); };
  if(resetBtn) resetBtn.onclick=resetView;
  if(closeBtn) closeBtn.onclick=close;

  function focusables(){
    return Array.prototype.filter.call(lb.querySelectorAll('button'),function(b){
      return !b.disabled && b.offsetParent!==null;
    });
  }
  document.addEventListener('keydown',function(e){
    if(!lb.classList.contains('open')) return;
    if(e.key==='Escape'){ e.preventDefault(); close(); }
    else if(e.key==='ArrowRight'){ e.preventDefault(); load(idx+1); }
    else if(e.key==='ArrowLeft'){ e.preventDefault(); load(idx-1); }
    else if(e.key==='+'||e.key==='='){ e.preventDefault(); setScale(scale*1.4); }
    else if(e.key==='-'||e.key==='_'){ e.preventDefault(); setScale(scale/1.4); }
    else if(e.key==='0'){ e.preventDefault(); resetView(); }
    else if(e.key==='Tab'){
      var f=focusables();
      if(!f.length) return;
      var first=f[0],last=f[f.length-1];
      if(e.shiftKey&&document.activeElement===first){ e.preventDefault(); last.focus(); }
      else if(!e.shiftKey&&document.activeElement===last){ e.preventDefault(); first.focus(); }
    }
  });

  img.addEventListener('load',function(){ clamp(); apply(); });
  window.addEventListener('resize',function(){
    if(lb.classList.contains('open')){ clamp(); apply(); }
  });

  // Best-effort save deterrents.
  ['contextmenu','dragstart','selectstart'].forEach(function(ev){
    lb.addEventListener(ev,function(e){ e.preventDefault(); });
  });
  Array.prototype.forEach.call(document.querySelectorAll('.carousel-slide img'),function(im){
    im.addEventListener('dragstart',function(e){ e.preventDefault(); });
    im.addEventListener('contextmenu',function(e){ e.preventDefault(); });
  });

  Array.prototype.forEach.call(document.querySelectorAll('.carousel-open'),function(btn,k){
    btn.addEventListener('click',function(e){ e.preventDefault(); open(k,btn); });
  });
})();
