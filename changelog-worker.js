// Changelog Worker for AcreetionOS
// Pulls from self-hosted GitLab at gitlab.acreetionos.org

const GITLAB_API = 'https://gitlab.acreetionos.org/api/v4';
const GITLAB_USERS = ['cobra3282000', 'natalie'];

function categorizeCommit(message) {
  const lower = message.toLowerCase();
  if (lower.includes('cve') || lower.includes('security') || lower.includes('patch')) return 'security';
  if (lower.includes('kernel')) return 'kernel';
  if (lower.includes('desktop') || lower.includes('gnome') || lower.includes('kde')) return 'desktop';
  if (lower.includes('package') || lower.includes('pacman')) return 'package';
  if (lower.includes('edition')) return 'edition';
  if (lower.includes('system')) return 'system';
  return 'other';
}

async function handleChangelog(env) {
  try {
    const entries = [];

    // Fetch all projects from specified users
    for (const username of GITLAB_USERS) {
      const userUrl = `${GITLAB_API}/users?username=${username}`;
      const userRes = await fetch(userUrl);
      if (!userRes.ok) continue;

      const users = await userRes.json();
      if (!users || users.length === 0) continue;

      const userId = users[0].id;
      const projectsUrl = `${GITLAB_API}/users/${userId}/projects?per_page=100&order_by=last_activity_at&sort=desc`;
      const projectsRes = await fetch(projectsUrl);
      if (!projectsRes.ok) continue;

      const projects = await projectsRes.json();

      // Get commits from each project
      for (const project of projects) {
        const commitsUrl = `${GITLAB_API}/projects/${project.id}/repository/commits?per_page=10`;
        const commitsRes = await fetch(commitsUrl);
        if (!commitsRes.ok) continue;

        const commits = await commitsRes.json();
        for (const commit of commits) {
          entries.push({
            id: commit.id.substring(0, 8),
            title: commit.title,
            message: commit.message,
            author: commit.author_name,
            date: new Date(commit.committed_date).toISOString(),
            repo: project.name,
            url: commit.web_url,
            category: categorizeCommit(commit.title)
          });
        }
      }
    }

    // Sort by date descending
    entries.sort((a, b) => new Date(b.date) - new Date(a.date));

    return new Response(JSON.stringify({
      entries,
      count: entries.length,
      updated: new Date().toISOString()
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
    }

    const url = new URL(request.url);
    
    if (url.pathname === '/api/changelog' || url.pathname.includes('changelog')) {
      return handleChangelog(env);
    }

    return new Response('Changelog Worker', {
      headers: { 'Content-Type': 'text/plain' }
    });
  }
};
