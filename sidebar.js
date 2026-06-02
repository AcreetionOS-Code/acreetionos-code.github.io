(function(){'use strict';try{
if(document.getElementById('hamburger'))return;
var isOpen=false,sidebar,overlay,hamburger;
function init(){
  var header=document.querySelector('.header-content');
  if(!header||document.getElementById('hamburger'))return;
  hamburger=document.createElement('button');
  hamburger.id='hamburger';
  hamburger.setAttribute('aria-label','Menu');
  hamburger.setAttribute('aria-expanded','false');
  hamburger.innerHTML='<span></span><span></span><span></span>';
  hamburger.addEventListener('click',function(e){e.preventDefault();toggle();});
  header.appendChild(hamburger);
  overlay=document.createElement('div');
  overlay.id='sidebar-overlay';
  overlay.addEventListener('click',close);
  document.body.appendChild(overlay);
  sidebar=document.createElement('div');
  sidebar.id='sidebar';
  sidebar.setAttribute('role','dialog');
  sidebar.setAttribute('aria-label','Site navigation');
  var nav=document.querySelector('.main-nav');
  var links='';
  if(nav){
    var items=nav.querySelectorAll('a');
    for(var i=0;i<items.length;i++){
      var h=items[i].getAttribute('href')||'#';
      var t=items[i].textContent||'';
      links+='<li><a href="'+h.replace(/&/g,'&amp;').replace(/"/g,'&quot;')+'">'+t.replace(/</g,'&lt;')+'</a></li>';
    }
  }
  var externalSection='<div class="sidebar-section-title">External Projects</div><div class="sidebar-external"><a href="https://flatfree.pages.dev" target="_blank" rel="noopener" class="sidebar-external-btn"><i class="bi bi-box"></i> FlatFree</a></div>';
  var authorsSection='<div class="sidebar-section-title">Authors</div><div class="sidebar-authors"><a href="https://natalie.acreetionos.org" target="_blank" rel="noopener" class="sidebar-author-link"><img src="natalie_avatar_new.png" alt="" class="sidebar-author-avatar"> Natalie Spiva</a><a href="https://darren.acreetionos.org" target="_blank" rel="noopener" class="sidebar-author-link"><img src="darren_avatar_new.png" alt="" class="sidebar-author-avatar"> Darren Clift</a></div>';
  sidebar.innerHTML='<div class="sidebar-body"><ul>'+links+'</ul>'+externalSection+authorsSection+'</div><div class="sidebar-footer"><a href="https://discord.gg/VHqQkJASw7" target="_blank" rel="noopener">Discord</a><a href="contact.html">Contact</a></div>';
  document.body.appendChild(sidebar);
}
function toggle(){if(isOpen){close();}else{open();}}
function open(){isOpen=true;document.body.classList.add('sidebar-open');if(hamburger){hamburger.classList.add('active');hamburger.setAttribute('aria-expanded','true');}if(sidebar){sidebar.classList.add('open');}}
function close(){isOpen=false;document.body.classList.remove('sidebar-open');if(hamburger){hamburger.classList.remove('active');hamburger.setAttribute('aria-expanded','false');}if(sidebar){sidebar.classList.remove('open');}}
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&isOpen)close();});
window.addEventListener('pageshow',function(){document.body.classList.remove('sidebar-open');});
if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',init);}else{init();}
}catch(e){console.error('Sidebar init error:',e);}})();