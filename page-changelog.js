    var changelogData = [];
    var currentFilter = 'all';

    async function loadChangelog() {
      try {
        document.getElementById('loading-indicator').style.display = 'block';
        var res = await fetch('/api/changelog');
        var data = await res.json();
        document.getElementById('loading-indicator').style.display = 'none';
        if (data.error) throw new Error(data.error);
        if (!data.entries || data.entries.length === 0) {
          document.getElementById('timeline').innerHTML = '<p style="text-align:center;padding:2rem;color:#777">No commits yet. Check back after the next push.</p>';
          return;
        }
        changelogData = data.entries;
        render();
      } catch (e) {
        document.getElementById('loading-indicator').style.display = 'none';
        document.getElementById('timeline').innerHTML = '<p style="text-align:center;padding:2rem;color:#e74c3c">Changelog is coming soon!. Head to our Github or Gitlab!</p>'
      }
    }

    function render() {
      var q = document.getElementById('search-input').value.toLowerCase().trim();
      var entries = changelogData.filter(function(e) {
        if (currentFilter !== 'all' && e.category !== currentFilter) return false;
        if (q) {
          if (e.message.toLowerCase().indexOf(q) === -1 && e.repo.toLowerCase().indexOf(q) === -1 && (e.author || '').toLowerCase().indexOf(q) === -1) return false;
        }
        return true;
      });

      var html = '';
      entries.forEach(function(e) {
        var sourceBadge = e.source === 'GitLab' ? '<span style="font-size:.7rem;padding:.1rem .4rem;border-radius:4px;background:rgba(155,89,182,.15);color:#9b59b6;margin-left:.4rem">GitLab</span>' : '<span style="font-size:.7rem;padding:.1rem .4rem;border-radius:4px;background:rgba(97,175,239,.15);color:#61afef;margin-left:.4rem">GitHub</span>';
        html += '<div class="release">' +
          '<div class="release-dot"></div>' +
          '<div class="release-card">' +
          '<div class="release-header">' +
          '<span class="tag">' + esc(e.repo || '') + sourceBadge + '</span>' +
          '<div style="display:flex;gap:.4rem;align-items:center">' +
          '<span class="category cat-' + e.category + '">' + e.category + '</span>' +
          '<span class="date">' + (e.date || '') + '</span>' +
          '</div></div>' +
          '<div class="release-body">' +
          '<p style="margin-bottom:.25rem">' + esc(e.message || '') + '</p>' +
          (e.author ? '<p style="font-size:.75rem;color:#777;margin:0">by ' + esc(e.author) + '</p>' : '') +
          (e.url ? '<a href="' + esc(e.url) + '" target="_blank" rel="noopener" style="font-size:.75rem;color:var(--green);text-decoration:none;display:inline-block;margin-top:.25rem">View commit →</a>' : '') +
          '</div></div></div>';
      });

      document.getElementById('timeline').innerHTML = html || '<p style="text-align:center;padding:2rem;color:#777">No entries match your filter.</p>';
    }

    function esc(s) { return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

    document.querySelectorAll('.filter-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        document.querySelectorAll('.filter-btn').forEach(function(b) { b.classList.remove('active'); });
        this.classList.add('active');
        currentFilter = this.getAttribute('data-filter');
        render();
      });
    });

    document.getElementById('search-input').addEventListener('input', render);

    loadChangelog();
  
