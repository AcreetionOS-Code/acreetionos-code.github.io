/* Community Editions live status (issue #612).
 *
 * Augments each .card[data-repo] on unofficial.html with live GitHub data:
 *   - a status badge: Live / Idle / Inactive / Archived
 *   - a freshness line: last release or last repo push
 *   - the Download ISO button only stays a real link when the latest release
 *     actually has an .iso asset; otherwise it becomes a muted, inert
 *     "No ISO Available" label
 *   - when the repo has a build workflow, a "Build pipeline available" link
 *     to the GitHub Actions page where the workflow can be triggered
 *
 * Design limits (deliberate):
 *   - static-site only, no build step, CSP on the page whitelists
 *     api.github.com (connect-src) so client-side fetch is allowed
 *   - rate-limit friendly: one search call for repo metadata (archived,
 *     pushed_at) + one releases call + one workflows call per repo, all
 *     cached in localStorage for 30 minutes; a stale cache is reused as a
 *     silent fallback if the API is unreachable or rate-limited
 *   - if there is no data at all, the page keeps today's static markup
 *     (Download ISO + Build Scripts) rather than erroring
 */
(function(){
"use strict";
var LS_KEY='unofficial-status-cache-v1';
var TTL_MS=2*60*60*1000;
var API='https://api.github.com';
var ISO_RE=/\.iso(\.\w+)?$/i;

var cards=Array.prototype.slice.call(document.querySelectorAll('.card[data-repo]'));
if(!cards.length) return;
if(!window.fetch || !window.localStorage) return;

/* ---------- cache ---------- */
function cacheGet(){
  try{
    var raw=localStorage.getItem(LS_KEY);
    if(!raw) return null;
    var c=JSON.parse(raw);
    return (c && c.ts && c.data) ? c : null;
  }catch(e){ return null; }
}
function cachePut(data){
  try{ localStorage.setItem(LS_KEY, JSON.stringify({ts:Date.now(), data:data})); }catch(e){}
}

/* ---------- helpers ---------- */
function relTime(iso){
  if(!iso) return '';
  var d=Math.floor((Date.now()-new Date(iso).getTime())/86400000);
  if(d<=0) return 'today';
  if(d===1) return 'yesterday';
  if(d<14) return d+' days ago';
  if(d<60){ var w=Math.round(d/7); return w+(w===1?' week':' weeks')+' ago'; }
  if(d<365){ var m=Math.round(d/30); return m+(m===1?' month':' months')+' ago'; }
  var y=Math.round(d/365); return y+(y===1?' year':' years')+' ago';
}
function statusFor(meta, rel){
  if(meta && meta.archived) return {k:'archived', label:'Archived'};
  if(rel && rel.published_at){
    var d=Math.floor((Date.now()-new Date(rel.published_at).getTime())/86400000);
    if(d<=14)  return {k:'live',     label:'Live'};
    if(d<=90)  return {k:'idle',     label:'Idle'};
    return       {k:'inactive', label:'Inactive'};
  }
  var pushed=meta && meta.pushed_at ? Math.floor((Date.now()-new Date(meta.pushed_at).getTime())/86400000) : 9999;
  if(pushed<=30) return {k:'idle', label:'Idle'};
  return           {k:'inactive', label:'Inactive'};
}
/* latest release -> {hasISO, published_at}; null when repo has no release (404) */
function relFor(j){
  if(!j) return null;
  var has=(j.assets||[]).some(function(a){ return ISO_RE.test(a.name||''); });
  return {hasISO:has, published_at:j.published_at||null};
}
/* workflows list -> URL of the ISO/build workflow, or null */
function pipeFor(j){
  var list=(j && j.workflows || []).filter(function(w){ return w.state==='active'; });
  var pick=list.filter(function(w){ return /iso/i.test(w.name||''); })[0]
       || list.filter(function(w){ return /iso/i.test(w.path||''); })[0]
       || list.filter(function(w){ return /build/i.test(w.name||''); })[0]
       || null;
  return pick ? (pick.html_url || null) : null;
}
function getJSON(url){
  return fetch(url,{headers:{'Accept':'application/vnd.github+json'},cache:'no-store'}).then(function(r){
    if(r.status===403 || r.status===429){ var e=new Error('rate-limited'); e.rateLimited=true; throw e; }
    if(!r.ok){ if(r.status===404) return null; throw new Error('HTTP '+r.status); }
    return r.json();
  });
}

/* ---------- fetch (rate-limit friendly) ---------- */
function owners(){
  var seen={};
  cards.forEach(function(c){ seen[(c.getAttribute('data-repo').split('/')[0]||'').toLowerCase()]=true; });
  return Object.keys(seen);
}
function fetchAll(){
  var repos=cards.map(function(c){ return c.getAttribute('data-repo'); });
  var ownersList=owners();
  var meta={};
  var data={meta:meta, releases:{}, pipelines:{}};
  var hardFail=false;

  var metaP=Promise.all(ownersList.map(function(o){
    return getJSON(API+'/search/repositories?q=user%3A'+encodeURIComponent(o)+'&per_page=100')
      .then(function(j){ (j&&j.items||[]).forEach(function(it){
          if(repos.indexOf(it.full_name)>=0) meta[it.full_name]={archived:!!it.archived, pushed_at:it.pushed_at||null};
        }); })
      .catch(function(){ /* metadata is optional: statuses degrade, never block */ });
  }));

  var relP=Promise.all(repos.map(function(r){
    return getJSON(API+'/repos/'+r+'/releases/latest')
      .then(function(j){ data.releases[r]=relFor(j); })
      .catch(function(e){ if(e&&e.rateLimited) hardFail=true; data.releases[r]=null; });
  }));

  var wfP=Promise.all(repos.map(function(r){
    return getJSON(API+'/repos/'+r+'/actions/workflows')
      .then(function(j){ var u=pipeFor(j); if(u) data.pipelines[r]=u; })
      .catch(function(e){ if(e&&e.rateLimited) hardFail=true; });
  }));

  return Promise.all([metaP, relP, wfP]).then(function(){
    if(hardFail) throw new Error('rate-limited: keep whatever is on screen');
    return data;
  });
}

/* ---------- apply to the DOM ---------- */
function applyCard(card, repo, data){
  var meta=(data.meta||{})[repo]||{};
  var rel=(data.releases||{})[repo]||null;
  var pipe=(data.pipelines||{})[repo]||null;
  var st=statusFor(meta, rel);

  /* status badge in the card title */
  var h2=card.querySelector('h2');
  if(h2){
    var old=h2.querySelector('.badge-status');
    if(old) old.remove();
    var badge=document.createElement('span');
    badge.className='badge badge-status status-'+st.k;
    badge.textContent=st.label;
    h2.appendChild(badge);
  }
  /* freshness line under the buttons */
  var links=card.querySelector('.links');
  if(links){
    var mine=card.querySelector('.status-meta');
    if(mine) mine.remove();
    var msg = (rel && rel.published_at)
      ? 'Last release: '+relTime(rel.published_at)
      : 'No release yet'+(meta.pushed_at?' · last repo push: '+relTime(meta.pushed_at):'');
    var metaEl=document.createElement('div');
    metaEl.className='status-meta';
    metaEl.textContent=msg;
    links.insertAdjacentElement('afterend', metaEl);
    /* no-ISO / pipeline info */
    var oldNote=card.querySelector('.pipe-note');
    if(oldNote) oldNote.remove();
    if(pipe){
      var note=document.createElement('div');
      note.className='pipe-note';
      var a=document.createElement('a');
      a.href=pipe; a.target='_blank'; a.rel='noopener';
      a.className='pipe-link';
      a.textContent='Build pipeline available';
      a.title='Open the GitHub Actions build workflow for this edition';
      note.appendChild(a);
      note.appendChild(document.createTextNode(' \u2014 build it yourself \u2192'));
      metaEl.insertAdjacentElement('afterend', note);
    }
  }
  /* Download ISO only when the latest release really has an ISO */
  var prim=card.querySelector('.links .primary');
  if(!prim) return;
  var hasIso=!!(rel && rel.hasISO);
  var isSpan=prim.tagName==='SPAN';
  if(hasIso && isSpan){
    var a=document.createElement('a');
    a.className='primary';
    a.href='https://github.com/'+repo+'/releases/latest';
    a.innerHTML='<i class="bi bi-download"></i> Download ISO';
    prim.replaceWith(a);
  } else if(!hasIso && !isSpan){
    var span=document.createElement('span');
    span.className='primary status-no-iso';
    span.setAttribute('aria-disabled','true');
    span.title='The latest release does not include an ISO download';
    span.textContent='No ISO Available';
    span.setAttribute('data-href', prim.href);
    prim.replaceWith(span);
  }
}

function applyAll(data){
  cards.forEach(function(c){ try{ applyCard(c, c.getAttribute('data-repo'), data); }catch(e){} });
}

/* ---------- flow ---------- */
var cached=cacheGet();
if(cached && (Date.now()-cached.ts)<TTL_MS){
  applyAll(cached.data);
} else {
  /* serve stale data immediately (if any), refresh in the background */
  if(cached) applyAll(cached.data);
  fetchAll().then(function(data){
    cachePut(data);
    applyAll(data);
  }).catch(function(){
    /* API unreachable/rate-limited: keep whatever is on screen (cached
       already applied, or the original static markup). Do nothing. */
  });
}
})();
