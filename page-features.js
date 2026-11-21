        function copyFastFetchCmd() {
          var text = 'curl -sL https://acreetionos.org/acreetionos-fastfetch.jsonc -o ~/.config/fastfetch/config.jsonc && sudo pacman -S --noconfirm fastfetch && fastfetch';
          navigator.clipboard.writeText(text).then(function() {
            var btn = document.querySelector('.copy-cmd-btn');
            btn.innerHTML = '<i class="bi bi-check"></i> Copied!';
            setTimeout(function() { btn.innerHTML = '<i class="bi bi-clipboard"></i> Copy Install Command'; }, 2500);
          });
        }
      

document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('.copy-cmd-btn').forEach(function (b) { b.addEventListener('click', copyFastFetchCmd); });
});
