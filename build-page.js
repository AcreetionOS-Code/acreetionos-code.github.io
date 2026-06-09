const EDITIONS = [
  'cinnamon', 'xl', '32bit', 'hyprland', 'mate', 'gnome',
  'plasma', 'xfce', 'sway', 'i3', 'openbox', 'immutable'
];

const EDITION_NAMES = {
  'cinnamon': 'Cinnamon', 'xl': 'XL (XLibre)', '32bit': '32-bit',
  'hyprland': 'Hyprland', 'mate': 'MATE', 'gnome': 'GNOME',
  'plasma': 'Plasma', 'xfce': 'XFCE', 'sway': 'Sway', 'i3': 'i3',
  'openbox': 'Openbox', 'immutable': 'Immutable'
};

const EDITION_MAP = {
  'Cinnamon': 'cinnamon', 'XL (XLibre)': 'xl', '32-bit': '32bit',
  'Hyprland': 'hyprland', 'MATE': 'mate', 'GNOME': 'gnome',
  'Plasma': 'plasma', 'XFCE': 'xfce', 'Sway': 'sway', 'i3': 'i3',
  'Openbox': 'openbox', 'Immutable': 'immutable'
};

let pollInterval = null;
let currentEdition = '';
let currentSlug = '';
let selectedCard = null;

function selectEdition(el) {
  if (selectedCard) selectedCard.classList.remove('selected');
  selectedCard = el;
  selectedCard.classList.add('selected');
  currentEdition = el.dataset.edition;
  currentSlug = EDITION_MAP[currentEdition];
  const btn = document.getElementById('build-btn');
  btn.disabled = false;
  btn.textContent = 'Build ' + currentEdition;
  document.getElementById('progress-section').style.display = 'none';
  if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
}

function addLog(msg) {
  const log = document.getElementById('log-area');
  log.style.display = 'block';
  log.textContent += msg + '\n';
  log.scrollTop = log.scrollHeight;
}

function triggerBuild() {
  if (!currentEdition) return;
  const btn = document.getElementById('build-btn');
  btn.disabled = true;
  btn.textContent = 'Build triggered...';
  document.getElementById('progress-section').style.display = 'block';
  document.getElementById('dl-btn').style.display = 'none';
  document.getElementById('progress-bar').style.width = '5%';
  document.getElementById('progress-bar').style.background = 'linear-gradient(90deg,var(--acreetion-green),#27ae60)';
  document.getElementById('progress-text').textContent = 'Triggering build...';
  document.getElementById('log-area').textContent = '';
  document.getElementById('log-area').style.display = 'none';
  document.getElementById('status-card').className = 'status-card building';
  document.getElementById('status-card').innerHTML = '<strong>Build triggered!</strong> Waiting for GitHub Actions to start...';
  fetch('/api/build/trigger', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ edition: currentEdition })
  }).then(r => r.json()).then(data => {
    if (data.error) {
      document.getElementById('status-card').className = 'status-card failed';
      document.getElementById('status-card').innerHTML = '<strong>Trigger failed:</strong> ' + data.error + '<br><small>' + (data.detail || '') + '</small>';
      document.getElementById('progress-text').textContent = 'Failed to trigger build';
      btn.disabled = false;
      btn.textContent = 'Try Again';
      return;
    }
    document.getElementById('progress-bar').style.width = '10%';
    document.getElementById('progress-text').textContent = 'Build triggered! Waiting for runner...';
    addLog('Build triggered for ' + currentEdition);
    addLog('Waiting for GitHub Actions runner to pick up the job...');
    pollInterval = setInterval(pollStatus, 5000);
  }).catch(err => {
    document.getElementById('status-card').className = 'status-card failed';
    document.getElementById('status-card').innerHTML = '<strong>Network error:</strong> ' + err.message;
    btn.disabled = false;
    btn.textContent = 'Try Again';
  });
}

function getSlugForEdition(edition) {
  if (edition === 'Cinnamon') return 'cinnamon';
  if (edition === 'XL (XLibre)') return 'xl';
  if (edition === '32-bit') return '32bit';
  if (edition === 'Hyprland') return 'hyprland';
  if (edition === 'MATE') return 'mate';
  if (edition === 'GNOME') return 'gnome';
  if (edition === 'Plasma') return 'plasma';
  if (edition === 'XFCE') return 'xfce';
  if (edition === 'Sway') return 'sway';
  if (edition === 'i3') return 'i3';
  if (edition === 'Openbox') return 'openbox';
  if (edition === 'Immutable') return 'immutable';
  return edition.toLowerCase().replace(/\s+/g, '-');
}

function pollStatus() {
  const slug = getSlugForEdition(currentEdition);
  if (!slug) { stopPolling(); return; }
  fetch('/api/build/status?edition=' + slug, { headers: { 'Cache-Control': 'no-cache' } })
    .then(r => r.json()).then(data => {
      if (!data || data.error) return;
      updateUI(data);
    }).catch(() => {});
}

function updateUI(data) {
  const card = document.getElementById('status-card');
  const bar = document.getElementById('progress-bar');
  const text = document.getElementById('progress-text');
  const dlBtn = document.getElementById('dl-btn');
  if (data.status === 'building') {
    card.className = 'status-card building';
    card.innerHTML = '<strong>Building...</strong><br>Started: ' + (data.started || '') +
      '<br><a href="' + (data.run_url || '#') + '" target="_blank" rel="noopener">View on GitHub</a>';
    bar.style.width = '50%';
    bar.style.background = 'linear-gradient(90deg,var(--flasher-color),#e67e22)';
    text.textContent = 'Building ISO... this takes 10-20 minutes.';
    addLog('Build is running...');
    addLog('Started at: ' + (data.started || 'unknown'));
  } else if (data.status === 'success') {
    stopPolling();
    card.className = 'status-card';
    card.innerHTML = '<strong>Build complete!</strong><br>ISO: ' + (data.iso_name || '') +
      '<br>Finished: ' + (data.finished || '');
    bar.style.width = '100%';
    bar.style.background = 'linear-gradient(90deg,var(--acreetion-green),#27ae60)';
    text.textContent = 'Build complete!';
    addLog('Build completed successfully!');
    addLog('ISO: ' + (data.iso_name || ''));
    if (data.download_url) {
      dlBtn.style.display = 'block';
      dlBtn.dataset.url = data.download_url;
      dlBtn.textContent = 'Download ' + (data.iso_name || 'ISO');
    }
    document.getElementById('build-btn').disabled = false;
    document.getElementById('build-btn').textContent = 'Build ' + currentEdition;
  } else if (data.status === 'failed') {
    stopPolling();
    card.className = 'status-card failed';
    card.innerHTML = '<strong>Build failed</strong><br><a href="' + (data.run_url || '#') + '" target="_blank" rel="noopener">View build log on GitHub</a>';
    bar.style.width = '100%';
    bar.style.background = '#e74c3c';
    text.textContent = 'Build failed. Check GitHub for details.';
    addLog('BUILD FAILED');
    addLog('See: ' + (data.run_url || '#'));
    document.getElementById('build-btn').disabled = false;
    document.getElementById('build-btn').textContent = 'Retry ' + currentEdition;
  }
}

function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

function downloadISO() {
  const btn = document.getElementById('dl-btn');
  const url = btn.dataset.url;
  if (url) window.location.href = url;
}

function loadAllStatuses() {
  fetch('/api/build/status', { headers: { 'Cache-Control': 'no-cache' } })
    .then(r => r.json()).then(data => {
      const grid = document.getElementById('status-grid');
      if (!data || !data.builds) {
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--acreetion-text)">No build status data yet.</div>';
        return;
      }
      let html = '';
      for (const [slug, status] of Object.entries(data.builds)) {
        const name = EDITION_NAMES[slug] || slug;
        let badge = '<span class="badge badge-unknown">unknown</span>';
        if (status.status === 'success') badge = '<span class="badge badge-success">success</span>';
        else if (status.status === 'building') badge = '<span class="badge badge-building">building</span>';
        else if (status.status === 'failed') badge = '<span class="badge badge-failed">failed</span>';
        html += '<div class="mini-status"><span class="edition-name">' + name + '</span> ' + badge + '</div>';
      }
      grid.innerHTML = html || '<div style="grid-column:1/-1;text-align:center;color:var(--acreetion-text)">No build status data yet.</div>';
    }).catch(() => {
      document.getElementById('status-grid').innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--acreetion-text)">Could not load statuses.</div>';
    });
}

loadAllStatuses();
setInterval(loadAllStatuses, 30000);

document.addEventListener('DOMContentLoaded', function() {
  const observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('active');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.05, rootMargin: '0px 0px -30px 0px' });
  document.querySelectorAll('.reveal').forEach(function(el) {
    observer.observe(el);
  });
});
