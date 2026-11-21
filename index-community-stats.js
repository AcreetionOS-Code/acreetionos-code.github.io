  (function(){
    var loadStats = function(){
      fetch('/api/community/stats').then(function(r){return r.json()}).then(function(d){
        var t = d.totals || {};
        document.getElementById('stat-repos').textContent = t.repos || 0;
        document.getElementById('stat-stars').textContent = t.stars || 0;
        document.getElementById('stat-issues').textContent = t.open_issues || 0;
        document.getElementById('stat-contrib').textContent = t.members || 0;
      }).catch(function(){});
    };
    if ('requestIdleCallback' in window) { requestIdleCallback(loadStats, { timeout: 4000 }); }
    else { setTimeout(loadStats, 200); }
  })();
