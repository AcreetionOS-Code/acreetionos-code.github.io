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

  var sidebarLinks=[
    {href:'index.html',label:'Home',icon:'bi-house'},
    {href:'flash.html',label:'Downloads',icon:'bi-download'},
    {href:'wiki.html',label:'Wiki',icon:'bi-book'},
    {href:'about.html',label:'About',icon:'bi-info-circle'},
    {href:'beginner.html',label:'Beginner Guide',icon:'bi-mortarboard'},
    {href:'lightweight.html',label:'Lightweight Edition',icon:'bi-feather'},
    {href:'immutable.html',label:'Immutable Edition',icon:'bi-shield-lock'},
    {href:'status.html',label:'Status',icon:'bi-activity'},
    {href:'contact.html',label:'Contact',icon:'bi-envelope-paper'},
    {href:'hosting.html',label:'ISO Hosting',icon:'bi-hdd-stack'},
    {href:'unofficial.html',label:'Community Editions',icon:'bi-grid'},
    {href:'git-tracker.html',label:'Git Tracker',icon:'bi-git'},
    {href:'https://github.com/AcreetionOS-Code',label:'GitHub',icon:'bi-github'},
    {href:'https://gitlab.acreetionos.org',label:'GitLab',icon:'bi-gitlab'},
    {href:'https://github.com/AcreetionOS-Code/acreetionos-code.github.io/issues',label:'Issues',icon:'bi-bug'},
    {href:'https://security.archlinux.org',label:'Security',icon:'bi-shield-check'},
  ];

  var links='';
  for(var i=0;i<sidebarLinks.length;i++){
    var l=sidebarLinks[i];
    links+='<li><a href="'+l.href.replace(/&/g,'&amp;').replace(/"/g,'&quot;')+'"><i class="bi '+l.icon+'" style="width:1.3rem;text-align:center"></i> '+l.label+'</a></li>';
  }

  var externalSection='';

  sidebar.innerHTML='<div class="sidebar-body"><ul>'+links+'</ul>'+externalSection+'</div><div class="sidebar-authors"><a href="https://darren.acreetionos.org" target="_blank" rel="noopener" class="sidebar-author-link"><img src="darren_avatar_new.webp" alt="Darren Clift" class="sidebar-author-avatar"> Darren</a><a href="https://natalie.acreetionos.org" target="_blank" rel="noopener" class="sidebar-author-link"><img src="natalie_avatar_new.webp" alt="Natalie Cole-Clift Spiva" class="sidebar-author-avatar"> Natalie</a></div><div class="sidebar-footer"><a href="https://discord.gg/VHqQkJASw7" target="_blank" rel="noopener">Discord</a><a href="contact.html">Contact</a></div>';
  document.body.appendChild(sidebar);
}
function toggle(){if(isOpen){close();}else{open();}}
function open(){isOpen=true;document.body.classList.add('sidebar-open');if(hamburger){hamburger.classList.add('active');hamburger.setAttribute('aria-expanded','true');}if(sidebar){sidebar.classList.add('open');}}
function close(){isOpen=false;document.body.classList.remove('sidebar-open');if(hamburger){hamburger.classList.remove('active');hamburger.setAttribute('aria-expanded','false');}if(sidebar){sidebar.classList.remove('open');}}
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&isOpen)close();});
window.addEventListener('pageshow',function(){document.body.classList.remove('sidebar-open');});
if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',init);}else{init();}
}catch(e){console.error('Sidebar init error:',e);}})();
