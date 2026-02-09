const graphContainer = document.getElementById("graph-container");
const loadingStatus = document.getElementById("loading-status");
let gitgraph = null;
if (typeof GitgraphJS !== 'undefined' && graphContainer) {
    try {
        gitgraph = GitgraphJS.createGitgraph(graphContainer);
    } catch (err) {
        console.warn('GitgraphJS initialization failed:', err);
    }
}

const repoList = document.getElementById('repo-list');
const repoSearch = document.getElementById('repo-search');
const modal = document.getElementById('modal');

// Use the GitHub organization name (lowercase is conventional)
const ORG = 'acreetionos-linux';
const API_URL = `https://api.github.com/orgs/${ORG}/repos`;

let allRepos = [];
let allEvents = [];

function createRepoCard(repo) {
    return `<div class="repo-card" data-repo="${repo.name}">
        <div class="repo-title">${repo.name}</div>
        <div class="repo-desc">${repo.description ? repo.description : 'No description provided.'}</div>
        <div class="repo-meta">
            <span title="Stars">⭐ ${repo.stargazers_count}</span>
            <span title="Forks">🍴 ${repo.forks_count}</span>
            <span title="Open Issues">🐞 ${repo.open_issues_count}</span>
            <span title="Language">💻 ${repo.language ? repo.language : 'N/A'}</span>
        </div>
        <a class="repo-link" href="${repo.html_url}" target="_blank">View on GitHub</a>
    </div>`;
}

function createEventCard(event) {
    const repoName = event.repo.name.split('/')[1];
    const timeAgo = getTimeAgo(new Date(event.created_at));
    
    let action = '';
    let details = '';
    let icon = '';
    
    switch (event.type) {
        case 'PushEvent':
            icon = '🚀';
            action = `Pushed ${event.payload.commits ? event.payload.commits.length : 0} commits to`;
            details = event.payload.commits ? event.payload.commits[0].message.split('\n')[0] : '';
            break;
        case 'CreateEvent':
            if (event.payload.ref_type === 'repository') {
                icon = '📁';
                action = 'Created repository';
            } else {
                icon = '🌿';
                action = `Created ${event.payload.ref_type} ${event.payload.ref}`;
            }
            break;
        case 'IssuesEvent':
            icon = event.payload.action === 'opened' ? '🐛' : '✅';
            action = `${event.payload.action.charAt(0).toUpperCase() + event.payload.action.slice(1)} issue`;
            details = event.payload.issue.title;
            break;
        case 'PullRequestEvent':
            icon = event.payload.action === 'opened' ? '🔄' : '✅';
            action = `${event.payload.action.charAt(0).toUpperCase() + event.payload.action.slice(1)} pull request`;
            details = event.payload.pull_request.title;
            break;
        case 'ForkEvent':
            icon = '🍴';
            action = 'Forked repository';
            break;
        case 'WatchEvent':
            icon = '⭐';
            action = 'Starred repository';
            break;
        default:
            icon = '📝';
            action = event.type.replace('Event', '').toLowerCase();
    }
    
    return `<div class="event-card">
        <div class="event-icon">${icon}</div>
        <div class="event-content">
            <div class="event-header">
                <span class="event-actor">${event.actor.login}</span>
                <span class="event-action">${action}</span>
                <a href="https://github.com/${event.repo.name}" target="_blank" class="event-repo">${repoName}</a>
            </div>
            ${details ? `<div class="event-details">${details}</div>` : ''}
            <div class="event-time">${timeAgo}</div>
        </div>
    </div>`;
}

function getTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    
    if (diffSec < 60) return `${diffSec} seconds ago`;
    if (diffMin < 60) return `${diffMin} minutes ago`;
    if (diffHour < 24) return `${diffHour} hours ago`;
    return `${diffDay} days ago`;
}

function renderRepos(repos) {
    if (repos.length === 0) {
        repoList.innerHTML = '<div class="loading-status">No repositories found.</div>';
        return;
    }
    repoList.innerHTML = repos.map(createRepoCard).join('');
    document.querySelectorAll('.repo-card').forEach(card => {
        card.addEventListener('click', () => showRepoDetails(card.getAttribute('data-repo')));
    });
}

function renderEvents(events) {
    if (events.length === 0) {
        repoList.innerHTML = '<div class="loading-status">No recent activity found.</div>';
        return;
    }
    repoList.innerHTML = events.map(createEventCard).join('');
}

function filterRepos() {
    const query = repoSearch.value.toLowerCase();
    const filtered = allRepos.filter(repo =>
        repo.name.toLowerCase().includes(query) ||
        (repo.description && repo.description.toLowerCase().includes(query))
    );
    renderRepos(filtered);
}

async function fetchRepos() {
    loadingStatus.textContent = 'Loading organization repositories...';
    try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        allRepos = await response.json();
        renderRepos(allRepos);
        loadingStatus.textContent = `Showing ${allRepos.length} repositories.`;
    } catch (error) {
        loadingStatus.textContent = `Error: ${error.message}`;
    }
}

async function fetchEvents() {
    loadingStatus.textContent = 'Loading recent activity...';
    try {
        const response = await fetch(`https://api.github.com/orgs/${ORG}/events?per_page=30`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        allEvents = await response.json();
        renderEvents(allEvents);
        loadingStatus.textContent = `Showing recent activity (${allEvents.length} events).`;
    } catch (error) {
        loadingStatus.textContent = `Error: ${error.message}`;
    }
}

repoSearch.addEventListener('input', filterRepos);

fetchRepos();
setActiveButton(showAllBtn);

// Modal logic for repo details
async function showRepoDetails(repoName) {
    modal.style.display = 'flex';
    modal.innerHTML = `<div class="modal-content"><button class="modal-close" title="Close">×</button><div class="loading-status">Loading details...</div></div>`;
    const modalClose = modal.querySelector('.modal-close');
    if (modalClose) modalClose.addEventListener('click', () => { modal.style.display = 'none'; });
    try {
        // Fetch contributors, commits, issues, PRs in parallel
        const [contributors, commits, issues, prs] = await Promise.all([
            fetch(`https://api.github.com/repos/${ORG}/${repoName}/contributors`).then(r => r.json()),
            fetch(`https://api.github.com/repos/${ORG}/${repoName}/commits?per_page=5`).then(r => r.json()),
            fetch(`https://api.github.com/repos/${ORG}/${repoName}/issues?state=open&per_page=5`).then(r => r.json()),
            fetch(`https://api.github.com/repos/${ORG}/${repoName}/pulls?state=open&per_page=5`).then(r => r.json()),
        ]);
        modal.querySelector('.loading-status').remove();
        modal.querySelector('.modal-content').insertAdjacentHTML('beforeend', `
            <div class="modal-section">
                <h3>Top Contributors</h3>
                <ul>${contributors.map(c => `<li><a href="${c.html_url}" target="_blank">${c.login}</a> (${c.contributions} commits)</li>`).join('') || '<li>No contributors found.</li>'}</ul>
            </div>
            <div class="modal-section">
                <h3>Latest Commits</h3>
                <ul>${commits.map(cm => `<li><a href="${cm.html_url}" target="_blank">${cm.commit.message.split('\n')[0]}</a> by ${cm.commit.author.name}</li>`).join('') || '<li>No commits found.</li>'}</ul>
            </div>
            <div class="modal-section">
                <h3>Open Issues</h3>
                <ul>${issues.filter(i => !i.pull_request).map(i => `<li><a href="${i.html_url}" target="_blank">${i.title}</a></li>`).join('') || '<li>No open issues.</li>'}</ul>
            </div>
            <div class="modal-section">
                <h3>Open Pull Requests</h3>
                <ul>${prs.map(pr => `<li><a href="${pr.html_url}" target="_blank">${pr.title}</a></li>`).join('') || '<li>No open PRs.</li>'}</ul>
            </div>
        `);
    } catch (error) {
        modal.querySelector('.modal-content').insertAdjacentHTML('beforeend', `<div class="loading-status">Error loading details: ${error.message}</div>`);
    }
}

// Action buttons: show active work (sorted by pushed_at) and show all
const showActiveBtn = document.getElementById('show-active');
const showAllBtn = document.getElementById('show-all');

function setActiveButton(activeBtn) {
    [showActiveBtn, showAllBtn].forEach(btn => {
        if (btn === activeBtn) {
            btn.style.backgroundColor = '#2ecc71';
            btn.style.color = '#232526';
        } else {
            btn.style.backgroundColor = '#444';
            btn.style.color = 'white';
        }
    });
}

if (showActiveBtn) {
    showActiveBtn.addEventListener('click', () => {
        fetchEvents();
        setActiveButton(showActiveBtn);
    });
}
if (showAllBtn) {
    showAllBtn.addEventListener('click', () => {
        renderRepos(allRepos);
        loadingStatus.textContent = `Showing ${allRepos.length} repositories.`;
        setActiveButton(showAllBtn);
    });
}
