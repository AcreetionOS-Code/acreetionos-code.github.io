(function(){'use strict';
if(document.getElementById('hamburger'))return;
var isOpen=false,sidebar,overlay,hamburger;
function init(){
  var header=document.querySelector('.header-content');
  if(!header)return;
  if(document.getElementById('hamburger'))return;
  hamburger=document.createElement('button');
  hamburger.id='hamburger';
  hamburger.setAttribute('aria-label','Menu');
  hamburger.setAttribute('aria-expanded','false');
  hamburger.innerHTML='<span></span><span></span><span></span>';
  hamburger.addEventListener('click',toggle);
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
      var h=items[i].getAttribute('href')||'';
      var t=items[i].textContent||'';
      links+='<li><a href="'+h.replace(/&/g,'&amp;').replace(/"/g,'&quot;')+'">'+t+'</a></li>';
    }
  }
  sidebar.innerHTML='<div class="sidebar-body"><ul>'+links+'</ul></div><div class="sidebar-footer"><a href="https://discord.gg/VHqQkJASw7" target="_blank" rel="noopener">Discord</a><a href="contact.html">Contact</a></div>';
  document.body.appendChild(sidebar);
}
function toggle(){isOpen?close():open();}
function open(){isOpen=true;if(hamburger)hamburger.classList.add('active');if(hamburger)hamburger.setAttribute('aria-expanded','true');if(sidebar)sidebar.classList.add('open');document.body.classList.add('sidebar-open');}
function close(){isOpen=false;if(hamburger)hamburger.classList.remove('active');if(hamburger)hamburger.setAttribute('aria-expanded','false');if(sidebar)sidebar.classList.remove('open');document.body.classList.remove('sidebar-open');}
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&isOpen)close();});
if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',init);}else{init();}
})();