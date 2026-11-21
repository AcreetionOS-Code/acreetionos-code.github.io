(function(){'use strict';
var DOCS_BASE='docs/';
var DOC_MAP={
'README.md':'Getting Started',
'maintenance.md':'System Maintenance',
'network.md':'Network Setup',
'software.md':'Software Management',
'troubleshooting.md':'Troubleshooting',
'contributing.md':'Contributing',
'governance.md':'Governance'
};
var currentDoc=null;
var titleEl=document.getElementById('doc-title');
var bodyEl=document.getElementById('doc-body');
var loadingEl=document.getElementById('doc-loading');
var navLinks=document.querySelectorAll('#docs-nav a');
var searchInput=document.getElementById('docs-search');

function setActiveLink(docFile){
navLinks.forEach(function(link){
link.classList.toggle('active',link.getAttribute('data-doc')===docFile);
});
}

function escH(s){return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function showPlaceholder(docFile){
var name=docFile.replace('.md','').replace(/[-_]/g,' ');
name=name.charAt(0).toUpperCase()+name.slice(1);
titleEl.textContent=DOC_MAP[docFile]||name;
bodyEl.innerHTML='<div class="doc-placeholder"><i class="bi bi-file-earmark"></i><h3>'+escH(name)+'</h3><p>This documentation page has not been written yet. Check back soon.</p></div>';
}

function loadDoc(docFile,skipPush){
if(currentDoc===docFile)return;
currentDoc=docFile;
setActiveLink(docFile);
var title=DOC_MAP[docFile]||docFile.replace('.md','').replace(/[-_]/g,' ').replace(/\b\w/g,function(c){return c.toUpperCase();});
titleEl.textContent=title;
bodyEl.innerHTML='<div class="doc-loading" id="doc-loading"><div class="spin"></div><br>Loading documentation...</div>';
fetch(DOCS_BASE+docFile).then(function(r){
if(!r.ok)throw new Error('Not found');
return r.text();
}).then(function(md){
      var html=marked.parse(md);
      bodyEl.innerHTML=html;
if(!skipPush&&window.location.hash!=='#doc-'+docFile){
try{history.pushState({doc:docFile},'',window.location.pathname+'#doc-'+docFile);}catch(e){}
}
}).catch(function(){
showPlaceholder(docFile);
if(!skipPush&&window.location.hash!=='#doc-'+docFile){
try{history.pushState({doc:docFile},'',window.location.pathname+'#doc-'+docFile);}catch(e){}
}
});
}

function getDocFromHash(){
var m=window.location.hash.match(/^#doc-(.+)$/);
return m?m[1]:null;
}

navLinks.forEach(function(link){
link.addEventListener('click',function(e){
e.preventDefault();
var doc=link.getAttribute('data-doc');
if(doc)loadDoc(doc);
});
});

searchInput.addEventListener('input',function(){
var q=searchInput.value.toLowerCase().trim();
navLinks.forEach(function(link){
var text=link.textContent.toLowerCase();
var li=link.parentElement;
if(!q||text.indexOf(q)!==-1){
li.style.display='';
}else{
li.style.display='none';
}
});
});

window.addEventListener('popstate',function(e){
var doc=e.state&&e.state.doc?e.state.doc:getDocFromHash();
if(doc)loadDoc(doc,true);
});

var initialDoc=getDocFromHash()||'getting-started.md';
loadDoc(initialDoc,true);
})();
