const SOURCES = [
  {type:'gitlab', host:'gitlab.acreetionos.org', user:'darren'},
  {type:'gitlab', host:'gitlab.acreetionos.org', user:'natalie'},
  {type:'github', user:'spivanatalie64'},
  {type:'github', user:'cobra3282000'},
  {type:'github', org:'AcreetionOS-Code'}
];
const CACHE_KEY = 'acreetion_repo_v4';
const CACHE_TIME = 1000 * 60 * 15;
const repoListEl = document.getElementById('repo-list');
const loadingEl = document.getElementById('loading-status');
const modalEl = document.getElementById('modal');
const searchInput = document.getElementById('repo-search');
const statTotal = document.getElementById('stat-total');
const statActive = document.getElementById('stat-active');
const statGitHub = document.getElementById('stat-github');
const statGitLab = document.getElementById('stat-gitlab');
let allRepos = [];

async function fetchGitHub(url) {
  const res = await fetch(url + '?per_page=100');
  if (!res.ok) throw new Error('GitHub API error: ' + res.status);
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  const repos = data.map(r => ({
    name: r.name,
    description: r.description,
    html_url: r.html_url,
    pushed_at: r.pushed_at,
    stargazers_count: r.stargazers_count,
    forks_count: r.forks_count,
    language: r.language || 'N/A',
    source_type: 'github',
    owner: r.owner.login,
    owner_api: r.owner.url,
    owner_html: r.owner.html_url,
    owner_name: r.owner.login,
    full_name: r.full_name
  }));
  const ownerUrls = Array.from(new Set(repos.map(r => r.owner_api).filter(Boolean)));
  const ownerMap = {};
  for (const u of ownerUrls) {
    try {
      const ores = await fetch(u);
      if (!ores.ok) continue;
      const odata = await ores.json();
      ownerMap[odata.login] = odata.name || odata.login;
    } catch (e) {
      console.warn('Failed to fetch owner info', u, e);
    }
  }
  for (const repo of repos) {
    if (repo.owner && ownerMap[repo.owner]) repo.owner_name = ownerMap[repo.owner];
  }
  return repos;
}

async function fetchGitLab(host, user) {
  const url = 'https://' + host + '/api/v4/users/' + user + '/projects?per_page=100';
  const res = await fetch(url);
  if (!res.ok) throw new Error('GitLab API error: ' + res.status);
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data.map(r => ({
    name: r.name,
    description: r.description,
    html_url: r.web_url,
    pushed_at: r.last_activity_at,
    stargazers_count: r.star_count || 0,
    forks_count: r.forks_count || 0,
    language: r.language || 'N/A',
    source_type: 'gitlab',
    gitlab_host: host,
    owner: r.namespace ? (r.namespace.name || r.namespace.path) : user,
    full_name: r.path_with_namespace,
    project_id: r.id
  }));
}

async function fetchAllSources() {
  const all = [];
  const seen = new Set();
  for (const s of SOURCES) {
    try {
      let repos;
      if (s.type === 'github') {
        const url = s.org
          ? 'https://api.github.com/orgs/' + s.org + '/repos'
          : 'https://api.github.com/users/' + s.user + '/repos';
        repos = await fetchGitHub(url);
      } else {
        repos = await fetchGitLab(s.host, s.user);
      }
      if (repos) {
        for (const r of repos) {
          const key = r.source_type + '/' + r.full_name;
          if (!seen.has(key)) {
            seen.add(key);
            all.push(r);
          }
        }
      }
    } catch (e) {
      console.warn('Failed fetching', s.type, s.user || s.org, e);
    }
  }
  return all;
}

async function initTracker() {
  const cached = localStorage.getItem(CACHE_KEY);
  let repos = null;
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (Date.now() - parsed.timestamp < CACHE_TIME) {
        console.log('Loaded from Cache');
        repos = parsed.data;
      }
    } catch (e) {
      localStorage.removeItem(CACHE_KEY);
    }
  }
  if (!repos) {
    loadingEl.innerHTML = 'Scanning: gitlab.acreetionos.org/darren, gitlab.acreetionos.org/natalie, github.com/spivanatalie64, github.com/cobra3282000, github.com/AcreetionOS-Code...';
    try {
      repos = await fetchAllSources();
      localStorage.setItem(CACHE_KEY, JSON.stringify({timestamp: Date.now(), data: repos}));
    } catch (err) {
      loadingEl.innerHTML = 'Unable to fetch data. Please try again later.';
      if (cached) repos = JSON.parse(cached).data;
      else return;
    }
  }
  allRepos = repos;
  loadingEl.style.display = 'none';
  renderRepos(allRepos);
  updateStats(allRepos);
  searchInput.addEventListener('input', function(e) {
    const term = e.target.value.toLowerCase();
    const filtered = allRepos.filter(function(r) {
      return r.name.toLowerCase().indexOf(term) !== -1 || (r.description && r.description.toLowerCase().indexOf(term) !== -1);
    });
    renderRepos(filtered);
  });
}

function updateStats(repos) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const active = repos.filter(function(r) { return new Date(r.pushed_at) > cutoff; });
  const gh = repos.filter(function(r) { return r.source_type === 'github'; });
  const gl = repos.filter(function(r) { return r.source_type === 'gitlab'; });
  statTotal.textContent = repos.length;
  statActive.textContent = active.length;
  statGitHub.textContent = gh.length;
  statGitLab.textContent = gl.length;
}

function renderRepos(repos) {
  repoListEl.innerHTML = '';
  if (repos.length === 0) {
    repoListEl.innerHTML = '<p style="text-align:center;color:#777;grid-column:1/-1;padding:2rem 0;">No matching repositories found.</p>';
    return;
  }
  repos.forEach(function(repo) {
    const daysAgo = Math.floor((new Date() - new Date(repo.pushed_at)) / (1000 * 60 * 60 * 24));
    const isRecent = daysAgo < 30;
    const sourceBadge = repo.source_type === 'gitlab'
      ? '<span class="tag tag-gitlab">GitLab</span>'
      : '<span class="tag tag-github">GitHub</span>';
    const card = document.createElement('div');
    card.className = 'repo-card';
    card.onclick = function() { openModal(repo); };
    const ownerDisplay = repo.owner_name ? (escHtml(repo.owner_name) + ' (' + escHtml(repo.owner) + ')') : escHtml(repo.owner);
    const ownerLink = safeUrl(repo.owner_html) ? ('<a href="' + safeUrl(repo.owner_html) + '" target="_blank" rel="noopener noreferrer" style="color:#8a8a8a">' + ownerDisplay + '</a>') : ownerDisplay;
    card.innerHTML =
      '<div class="repo-card-header">' +
      '<div class="repo-card-title">' + escHtml(repo.name) + '</div>' +
      '<div class="repo-card-tags">' + (isRecent ? '<span class="tag tag-active">Active</span>' : '') + sourceBadge + '</div>' +
      '</div>' +
      '<div class="repo-card-desc">' + escHtml(repo.description || 'No description available.') + '</div>' +
      '<div class="repo-card-meta">' +
      '<span><span class="repo-stats-icon">&#9733;</span> ' + repo.stargazers_count + '</span>' +
      '<span><span class="repo-stats-icon">&#9829;</span> ' + repo.forks_count + '</span>' +
      '<span><span class="repo-stats-icon">&#9881;</span> ' + escHtml(repo.language || 'N/A') + '</span>' +
      '</div>' +
      '<div class="repo-card-footer">' +
      '<span>Updated ' + new Date(repo.pushed_at).toLocaleDateString() + '</span>' +
      '<span>' + ownerLink + '</span>' +
      '</div>';
    repoListEl.appendChild(card);
  });
}

async function openModal(repo) {
  const body = document.getElementById('modal-body');
  modalEl.style.display = 'flex';
  const sourceLabel = repo.source_type === 'gitlab' ? 'View on GitLab' : 'View on GitHub';
  const issuesUrl = repo.source_type === 'gitlab' ? (repo.html_url + '/-/issues') : (repo.html_url + '/issues');
  body.innerHTML =
    '<h2>' + escHtml(repo.name) + '</h2>' +
    '<p class="repo-desc">' + escHtml(repo.description || 'No description.') + '</p>' +
    '<div class="modal-actions">' +
    '<a href="' + safeUrl(repo.html_url) + '" target="_blank" rel="noopener noreferrer" class="repo-link-btn">' + sourceLabel + '</a>' +
    '<a href="' + safeUrl(issuesUrl) + '" target="_blank" rel="noopener noreferrer" class="repo-link-btn secondary">Issues</a>' +
    '</div><h3>Recent Commits</h3>' +
    '<div class="modal-loading" id="modal-loading">Loading commits...</div>' +
    '<ul class="modal-commit-list" id="modal-commits"></ul>';
  try {
    let commitsUrl;
    if (repo.source_type === 'gitlab') {
      commitsUrl = 'https://' + repo.gitlab_host + '/api/v4/projects/' + repo.project_id + '/repository/commits?per_page=10';
    } else {
      commitsUrl = 'https://api.github.com/repos/' + repo.full_name + '/commits?per_page=10';
    }
    const res = await fetch(commitsUrl);
    const commits = await res.json();
    document.getElementById('modal-loading').style.display = 'none';
    const list = document.getElementById('modal-commits');
    if (Array.isArray(commits)) {
      list.innerHTML = commits.map(function(c) {
        var author, message, date;
        if (repo.source_type === 'gitlab') {
          author = c.author_name || 'Unknown';
          message = (c.title || '').substring(0, 50);
          date = c.created_at;
        } else {
          author = c.commit.author.name;
          message = c.commit.message.split('\n')[0].substring(0, 50);
          date = c.commit.author.date;
        }
        return '<li><span class="commit-author">' + escapeHtml(author) + '</span><span class="commit-msg">' + escapeHtml(message) + '...</span><span class="commit-date">' + new Date(date).toLocaleDateString() + '</span></li>';
      }).join('');
    } else {
      list.innerHTML = '<li style="color:red">API Limit Reached for Details</li>';
    }
  } catch (e) {
    document.getElementById('modal-loading').innerText = 'Could not load details.';
  }
}

function escHtml(s) { return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function safeUrl(url) { if (!url || typeof url !== 'string') return ''; if (!url.startsWith('https://')) return ''; return url; }
function escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

const showActiveBtn = document.getElementById('show-active');
const showAllBtn = document.getElementById('show-all');

function setActiveFilter(activeBtn) {
  showAllBtn.classList.toggle('active', activeBtn === showAllBtn);
  showActiveBtn.classList.toggle('active', activeBtn === showActiveBtn);
}

showActiveBtn.addEventListener('click', function() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const active = allRepos.filter(function(r) { return new Date(r.pushed_at) > cutoff; });
  searchInput.value = '';
  renderRepos(active);
  setActiveFilter(showActiveBtn);
});
showAllBtn.addEventListener('click', function() {
  searchInput.value = '';
  renderRepos(allRepos);
  setActiveFilter(showAllBtn);
});
modalEl.addEventListener('click', function(e) {
  if (e.target === modalEl) modalEl.style.display = 'none';
});
document.getElementById('git-modal-close').addEventListener('click', function() {
  modalEl.style.display = 'none';
});
initTracker();
setActiveFilter(showAllBtn);
