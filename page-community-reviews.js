    function copyShareText() {
      var text = document.getElementById('copy-text').textContent;
      navigator.clipboard.writeText(text).then(function() {
        var btn = document.getElementById('copy-btn');
        btn.textContent = 'Copied!';
        setTimeout(function() { btn.textContent = 'Copy'; }, 2000);
      });
    }
  

document.addEventListener('DOMContentLoaded', function () {
  var copyBtn = document.getElementById('copy-btn');
  if (copyBtn) { copyBtn.addEventListener('click', copyShareText); }
});
