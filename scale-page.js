(function(){'use strict';try{
var designWidth=1400;
function scalePage(){
  var wrap=document.getElementById('page-scale');
  if(!wrap)return;
  var vw=window.innerWidth;
  var s=Math.min(1,Math.max(0.15,vw/designWidth));
  wrap.style.transform='scale('+s+')';
  wrap.style.transformOrigin='top left';
  wrap.style.width=(100/s)+'%';
}
window.addEventListener('resize',scalePage);
if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',scalePage);
}else{scalePage();}
}catch(e){console.error('Scale error:',e);}})();
