var searchCache={};
const input=document.getElementById('search-input'),btn=document.getElementById('search-btn'),results=document.getElementById('results'),modal=document.getElementById('wiki-modal'),loading=document.getElementById('loading'),contentArea=document.getElementById('content-area');
document.getElementById('modal-close').addEventListener('click',function(){modal.classList.remove('show');document.body.style.overflow=''});

async function doSearch(q){
  if(!q)return;
  results.style.display='block';
  if(searchCache[q]){
    renderResults(searchCache[q]);
    return;
  }
  results.innerHTML='<div style="padding:2rem;color:var(--acreetion-green);font-family:var(--font-mono);font-size:.85rem">Searching...</div>';
  try{
    const res=await fetch('https://wiki.archlinux.org/api.php?action=query&list=search&srsearch='+encodeURIComponent(q)+'&format=json&origin=*');
    const data=await res.json();
    searchCache[q]=data.query.search;
    renderResults(data.query.search);
  }catch(e){results.innerHTML='<div style="padding:1.5rem;color:#e74c3c;font-size:.9rem">Failed to reach Wiki.</div>';}
}

function escHtml(s){return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function renderResults(items){
  results.innerHTML='';
  if(!items.length){results.innerHTML='<div style="padding:1.5rem;color:#e74c3c;font-size:.9rem">No results found.</div>';return;}
  items.forEach(function(item){
    var el=document.createElement('div');
    el.className='item';
    el.innerHTML='<h4>'+escHtml(item.title)+'</h4><p>'+escHtml(item.snippet)+'...</p><div class="src">wiki.archlinux.org</div>';
    el.addEventListener('click',function(){produceGuide(item.title);});
    results.appendChild(el);
  });
}

btn.addEventListener('click',function(){doSearch(input.value);});
input.addEventListener('keydown',function(e){if(e.key==='Enter')doSearch(input.value);});

document.querySelectorAll('.quick a').forEach(function(a){
  a.addEventListener('click',function(e){
    e.preventDefault();
    var q=this.getAttribute('data-q');
    input.value=q;
    results.style.display='block';
    results.innerHTML='<div style="padding:1.5rem;color:var(--acreetion-text);font-size:.85rem">Generating guide for <strong>'+escHtml(q)+'</strong>...</div>';
    produceGuide(q);
  });
});

var BAR=document.getElementById('progress-bar'),PSTEP=document.getElementById('progress-steps'),PREV=document.getElementById('preview-area');

function setStep(label,state){
  if(state==='progress'){PSTEP.innerHTML='<div style="color:var(--acreetion-green);font-size:.85rem"><span style="display:inline-block;width:16px;height:16px;border:2px solid var(--acreetion-box-border);border-top-color:var(--acreetion-green);border-radius:50%;animation:spin.7s linear infinite;vertical-align:middle;margin-right:6px"></span> '+label+'</div>';}
  else if(state==='done'){PSTEP.innerHTML='<div style="color:var(--acreetion-green);font-size:.85rem"><span style="color:var(--acreetion-green);font-weight:700;margin-right:6px">\u2713</span> '+label+'</div>';}
  else{PSTEP.innerHTML='<div style="color:#666;font-size:.85rem"><span style="margin-right:6px">\u25CB</span> '+label+'</div>';}
}

async function produceGuide(title){
  modal.classList.add('show');
  document.body.style.overflow='hidden';
  document.getElementById('progress-area').style.display='block';
  document.getElementById('content-area').style.display='none';
  PREV.style.display='none';
  BAR.style.width='0%';

  setStep('Fetching Wiki article','progress');
  BAR.style.width='20%';
  var rawText='',originalUrl='https://wiki.archlinux.org/title/'+encodeURIComponent(title.replace(/ /g,'_'));
  try{
    var wikiRes=await fetch('https://wiki.archlinux.org/api.php?action=query&prop=extracts&explaintext=true&exchars=1500&redirects=1&titles='+encodeURIComponent(title)+'&format=json&origin=*');
    var wikiData=await wikiRes.json();
    var page=Object.values(wikiData.query.pages)[0];
    rawText=page.extract||'';
  }catch(e){}
  setStep('Fetching Wiki article','done');
  BAR.style.width='40%';

  setStep('Analyzing technical content','progress');
  if(rawText){PREV.style.display='block';PREV.textContent=rawText.slice(0,500)+(rawText.length>500?'\n\n[...]':'');}
  await new Promise(function(r){setTimeout(r,100);});
  setStep('Analyzing technical content','done');
  BAR.style.width='55%';

  setStep('Generating guide (free AI models can take up to a minute)','progress');
  BAR.style.width='70%';
  var finalBody=null;
  var prompt='You are a patient Linux teacher for beginners on AcreetionOS (Cinnamon Desktop, Arch-based). Write clear step-by-step guides in plain English. GUI first, terminal as "(Advanced)".\n\n## Topic: '+title+'\n\n## Technical Context\n'+rawText+'\n\n## Format\n1. **What is this?**\n2. **What you need**\n3. **Step-by-step**\n4. **Troubleshooting**\n\nMarkdown only.';
  try{
    var recaptchaToken=null;
    try{if(window.getRecaptchaToken){recaptchaToken=await window.getRecaptchaToken('chat');}}catch(e){}
    var aiRes=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:[{role:'user',content:prompt}],max_tokens:1024,recaptchaToken:recaptchaToken})});
    var text=await aiRes.text();
    if(aiRes.ok){
      try{var j=JSON.parse(text);text=j.choices?.[0]?.message?.content||j.content||j.reasoning_content||text;}catch(e){}
      text=text.replace(/<think>[\s\S]*?<\/think>/gi,'').trim();
      if(text&&text.length>30){finalBody=text;}
    }
  }catch(e){}
  setStep('Generating guide','done');
  BAR.style.width='100%';

  await new Promise(function(r){setTimeout(r,300);});
  document.getElementById('progress-area').style.display='none';
  document.getElementById('content-area').style.display='block';

  function sanitizeHtml(html) {
    var d=document.createElement('div');
    d.innerHTML=html;
    var all=d.querySelectorAll('*');
    for(var i=0;i<all.length;i++){
      for(var j=0;j<all[i].attributes.length;j++){
        var attr=all[i].attributes[j];
        if(attr.name.indexOf('on')===0||attr.value.indexOf('javascript:')!==-1){
          all[i].removeAttribute(attr.name);
          j--;
        }
      }
    }
    return d.innerHTML;
  }
  if(finalBody){
    document.getElementById('modal-title-result').innerText=title;
    document.getElementById('modal-body').innerHTML=sanitizeHtml(marked.parse(finalBody));
    document.getElementById('modal-link').href=originalUrl;
  } else if(rawText){
    document.getElementById('modal-title-result').innerText=title+' (raw)';
    document.getElementById('modal-body').innerHTML='<p style="color:#e74c3c;margin-bottom:1rem">AI guide unavailable. Raw Arch Wiki content:</p>'+sanitizeHtml(marked.parse(rawText));
    document.getElementById('modal-link').href=originalUrl;
  } else {
    document.getElementById('modal-title-result').innerText='Error';
    document.getElementById('modal-body').innerHTML='<p style="color:#e74c3c">Failed.</p><button id="retry-btn" style="background:var(--acreetion-green);color:#000;border:none;padding:.4rem 1rem;border-radius:6px;cursor:pointer;margin-left:.5rem;font-weight:700">Try Again</button>';
    document.getElementById('modal-link').href=originalUrl;
    document.getElementById('retry-btn').addEventListener('click',function(){produceGuide(title);});
  }

  document.getElementById('show-raw-btn').addEventListener('click',function(){
    var pa=document.getElementById('preview-area');
    if(pa.style.display==='none'||!pa.style.display||pa.style.display===''){pa.style.display='block';this.textContent='Hide raw source';}
    else{pa.style.display='none';this.textContent='Show raw source';}
  });
}
