/* coi-serviceworker v0.1.7 - https://github.com/gzuidhof/coi-serviceworker */
(function(){'use strict';
if(typeof window==='undefined'){
  self.addEventListener('install',function(){self.skipWaiting()});
  self.addEventListener('activate',function(e){e.waitUntil(self.clients.claim())});
  self.addEventListener('message',function(e){
    if(e.data&&e.data.type==='COI_SETUP'){
      e.waitUntil(self.clients.matchAll().then(function(clients){
        clients.forEach(function(c){c.postMessage({type:'COI_SETUP_COMPLETE'})});
      }));
    }
  });
  self.addEventListener('fetch',function(e){
    var req=e.request;
    if(req.cache==='only-if-cached'&&req.mode!=='same-origin')return;
    // Clone once so fallback fetch can safely retry without reusing a consumed body.
    var retryReq=req.clone();
    e.respondWith(fetch(req).then(function(r){
      var h=new Headers(r.headers);
      h.set('Cross-Origin-Embedder-Policy','require-corp');
      h.set('Cross-Origin-Opener-Policy','same-origin');
      return new Response(r.body,{status:r.status,statusText:r.statusText,headers:h});
    }).catch(function(){return fetch(retryReq)}));
  });
}else{
  var coiQueued=[],coiCallback=[];
  navigator.serviceWorker?
    navigator.serviceWorker.register('/coi-serviceworker.js')
      .then(function(r){
        r.addEventListener('updatefound',function(){
          var i=r.installing;
          i&&i.addEventListener('statechange',function(){
            if(i.state==='installed')coiServiceWorker();
          });
        });
        if(r.active)coiServiceWorker();
      })
      .catch(function(e){console.error('COI SW registration failed:',e)})
  : console.error('ServiceWorker not supported');
  function coiServiceWorker(){
    if(navigator.serviceWorker.controller)
      navigator.serviceWorker.controller.postMessage({type:'COI_SETUP'});
  }
  navigator.serviceWorker.addEventListener('message',function(e){
    if(e.data&&e.data.type==='COI_SETUP_COMPLETE'){
      var q=coiQueued;coiQueued=[];
      for(var i=0;i<q.length;i++)q[i]();
      for(var i=0;i<coiCallback.length;i++)coiCallback[i]();
    }
  });
  window.coi={coiQueued:coiQueued,coiCallback:coiCallback};
}
})();