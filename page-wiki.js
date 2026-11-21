(function(){
  var votes = JSON.parse(localStorage.getItem('wikiVotes') || '{"yes":0,"no":0}');
  function updateResults() {
    var total = votes.yes + votes.no;
    var el = document.getElementById('vote-results');
    if (total === 0) { el.style.display = 'none'; return; }
    el.style.display = 'block';
    el.innerHTML = '<strong style="color:var(--acreetion-green)">' + votes.yes + '</strong> Yes &middot; <strong style="color:var(--acreetion-text)">' + votes.no + '</strong> No &middot; <span style="color:#9a9a9a">(' + total + ' total votes)</span>';
  }
  function hasVoted() {
    return localStorage.getItem('wikiVoted') === 'true';
  }
  if (hasVoted()) {
    document.getElementById('vote-buttons').innerHTML = '<span style="color:var(--acreetion-text);font-size:0.9rem">Thanks for your feedback!</span>';
    updateResults();
  }
  (function(){
  var notice = document.getElementById('ai-status-notice');
  if (notice && !localStorage.getItem('aiNoticeDismissed')) {
    notice.style.display = 'block';
  }
  document.getElementById('dismiss-notice').addEventListener('click', function() {
    notice.style.display = 'none';
    localStorage.setItem('aiNoticeDismissed', 'true');
  });
})();
document.querySelectorAll('.vote-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      if (hasVoted()) return;
      var v = btn.getAttribute('data-vote');
      votes[v]++;
      localStorage.setItem('wikiVotes', JSON.stringify(votes));
      localStorage.setItem('wikiVoted', 'true');
      document.getElementById('vote-buttons').innerHTML = '<span style="color:var(--acreetion-green);font-size:0.9rem;font-weight:600">Thanks for your feedback!</span>';
      updateResults();
    });
  });
})();
