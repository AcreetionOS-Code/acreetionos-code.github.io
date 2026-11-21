    async function loadStats() {
      try {
        // Use the live API origin when this page isn't on acreetionos.org
        // (e.g. served from the local cached copy / file://), so stats still load.
        const onSite = location.protocol.startsWith('http') && /(^|\.)acreetionos\.org$/.test(location.hostname);
        const API = onSite ? '' : 'https://acreetionos.org';
        const res = await fetch(API + '/api/community/stats');
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        const t = data.totals || {};
        const statsHtml = '<div class="stats-grid">' +
          '<div class="stat-card"><div class="num">' + (t.repos || 0) + '</div><div class="label">Repositories</div></div>' +
          '<div class="stat-card"><div class="num">' + (t.stars || 0) + '</div><div class="label">GitHub Stars</div></div>' +
          '<div class="stat-card"><div class="num">' + (t.forks || 0) + '</div><div class="label">Forks</div></div>' +
          '<div class="stat-card"><div class="num">' + (t.open_issues || 0) + '</div><div class="label">Issues</div></div>' +
          '<div class="stat-card"><div class="num">' + (t.members || 0) + '</div><div class="label">Team Members</div></div>' +
          '<div class="stat-card"><div class="num">' + (t.recent_commits || 0) + '</div><div class="label">Recent Commits</div></div>' +
          '</div>';

        let milestoneHtml = '';
        if (data.latest_release) {
          const rel = data.latest_release;
          milestoneHtml = '<div class="milestone">' +
            '<h2><i class="bi bi-trophy"></i> Latest Release: ' + esc(rel.tag) + '</h2>' +
            '<p style="color:var(--text);font-size:.9rem;margin-bottom:.5rem">' + esc(rel.name || '') + '</p>' +
            '<div class="sub"><span>Released: ' + (rel.date ? new Date(rel.date).toLocaleDateString() : 'N/A') + '</span><a href="' + esc(rel.url) + '" style="color:var(--green)">View Release →</a></div>' +
            '</div>';
        }

        const r = data.repos || [];
        const reposHtml = r.sort((a,b) => b.stars - a.stars).slice(0, 12).map(function(repo) {
          const langTag = repo.language ? '<span style="margin-left:.5rem;padding:.1rem .35rem;background:rgba(46,204,113,.1);border-radius:4px;font-size:.7rem;color:var(--green)">' + repo.language + '</span>' : '';
          return '<a href="' + esc(repo.url) + '" class="repo-card" target="_blank" rel="noopener">' +
            '<div class="name">' + esc(repo.name) + langTag + '</div>' +
            '<div class="desc">' + esc(repo.description || 'No description') + '</div>' +
            '<div class="meta"><span><i class="bi bi-star"></i> ' + repo.stars + '</span><span><i class="bi bi-diagram-2"></i> ' + repo.forks + '</span><span><i class="bi bi-exclamation-circle"></i> ' + repo.issues + '</span></div>' +
            '</a>';
        }).join('');

        const membersHtml = (data.members || []).map(function(mem) {
          return '<a href="' + esc(mem.url) + '" class="contributor" target="_blank" rel="noopener">' +
            '<img src="' + esc(mem.avatar) + '" alt="' + esc(mem.login) + '" width="36" height="36" loading="lazy">' +
            '<span class="login">' + esc(mem.login) + '</span>' +
            '</a>';
        }).join('');

        document.getElementById('stats-container').innerHTML = statsHtml + milestoneHtml;
        document.getElementById('repos-container').innerHTML = '<div class="section"><h2><i class="bi bi-folder"></i> Active Repositories</h2><div class="repo-grid">' + reposHtml + '</div></div>';
        document.getElementById('team-container').innerHTML = '<div class="section"><h2><i class="bi bi-person"></i> Core Team</h2><div class="contributor-list">' + membersHtml + '</div></div>';
      } catch (e) {
        document.getElementById('stats-container').innerHTML = '<p style="text-align:center;color:var(--text, #b2b2b2);padding:2rem">Live community stats are unavailable right now. This is a cached page — switch to live mode or open <a href="https://acreetionos.org/contributors.html" style="color:#2ecc71">acreetionos.org</a> for live stats.</p>';
      }
    }
    function esc(s){return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
    loadStats();
  
