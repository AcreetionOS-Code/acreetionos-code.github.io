function flash(msg, type) {
  const c = document.getElementById('flash-container');
  const el = document.createElement('div');
  el.className = 'flash flash-' + type;
  el.textContent = msg;
  c.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 0.3s'; setTimeout(() => el.remove(), 300); }, 5000);
}

function switchTab(name) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + name).classList.remove('hidden');
  document.querySelector('.tab-btn[onclick*="' + name + '"]').classList.add('active');
  if (name === 'providers') loadProviders();
}

async function loadProviders() {
  const list = document.getElementById('provider-list');
  list.innerHTML = '<p style="color:var(--text)">Loading providers...</p>';
  try {
    const res = await fetch('/api/hosting/providers');
    const data = await res.json();
    if (!data.providers || data.providers.length === 0) {
      list.innerHTML = '<p style="color:var(--text)">No providers registered yet.</p>';
      return;
    }
    list.innerHTML = data.providers.filter(p => p.status === 'active').map(p => `
      <div class="provider-item">
        <div class="info">
          <div class="name">${esc(p.org)} <span class="tag tag-active">Active</span></div>
          <div class="url"><a href="${safeUrl(p.mirror_url)}" target="_blank" rel="noopener">${esc(p.mirror_url)}</a></div>
          <div class="provider-detail">${esc(p.location)} ${p.bandwidth ? '· ' + esc(p.bandwidth) : ''}</div>
        </div>
      </div>
    `).join('');
  } catch (e) {
    list.innerHTML = '<p style="color:#e74c3c">Failed to load providers.</p>';
  }
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}
function safeUrl(s) {
  if (!s || typeof s !== 'string') return '';
  if (s.indexOf('javascript:') === 0 || s.indexOf('data:') === 0 || s.indexOf('vbscript:') === 0) return '';
  return s;
}

async function registerProvider(e) {
  e.preventDefault();
  const btn = document.getElementById('register-btn');
  btn.disabled = true;
  btn.textContent = 'Submitting...';
  // Validate organization email unless personal checkbox is checked
  const email = document.getElementById('email').value;
  const isPersonal = document.getElementById('personal-email').checked;
  const emailDomain = email.split('@')[1];
  const freeDomains = ['gmail.com','yahoo.com','hotmail.com','outlook.com','aol.com','icloud.com','protonmail.com','proton.me','mail.com','zoho.com','yandex.com','gmx.com','tutanota.com','fastmail.com','hey.com','inbox.com','rediffmail.com','live.com','msn.com','ymail.com'];
  if (!isPersonal && emailDomain && freeDomains.includes(emailDomain.toLowerCase())) {
    flash('Please use an organization email or check "I don\'t have an organization email"', 'error');
    btn.disabled = false; btn.textContent = 'Submit Registration'; return;
  }

  const body = {
    org: document.getElementById('org').value,
    email: email,
    personal_email: isPersonal,
    website: document.getElementById('website').value,
    password: document.getElementById('password').value,
    mirror_url: document.getElementById('mirror-url').value,
    location: document.getElementById('location').value,
    bandwidth: document.getElementById('bandwidth').value,
    notes: document.getElementById('notes').value,
    discord_user_id: document.getElementById('discord-user-id').value,
    subscribe: document.getElementById('subscribe').checked,
  };
  try {
    if (window.getRecaptchaToken) body.recaptchaToken = await window.getRecaptchaToken('hosting_register');
    const res = await fetch('/api/hosting/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
    if (res.ok) {
      flash('Registration submitted! We will review and add you shortly.', 'success');
      document.getElementById('register-form').reset();
    } else {
      flash(data.error || 'Registration failed', 'error');
    }
  } catch (e) {
    flash('Network error. Please try again.', 'error');
  }
  btn.disabled = false;
  btn.textContent = 'Submit Registration';
}

async function manageListing(e) {
  e.preventDefault();
  const action = document.getElementById('manage-action').value;
  const body = { email: document.getElementById('manage-email').value, password: document.getElementById('manage-password').value, notes: document.getElementById('manage-notes').value };
  try {
    if (window.getRecaptchaToken) body.recaptchaToken = await window.getRecaptchaToken('hosting_manage');
    const res = await fetch('/api/hosting/' + (action === 'remove' ? 'remove-request' : 'update-request'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
    if (res.ok) {
      flash(data.message || 'Request submitted for admin approval.', 'success');
      document.getElementById('manage-form').reset();
    } else {
      flash(data.error || 'Request failed', 'error');
    }
  } catch (e) {
    flash('Network error.', 'error');
  }
}

window.addEventListener('DOMContentLoaded', () => {
  // Check for action param to pre-select tab
  const params = new URLSearchParams(window.location.search);
  if (params.get('action') === 'providers') loadProviders();
});
