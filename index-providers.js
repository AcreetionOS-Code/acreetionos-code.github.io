async function loadHostingProviders() {
  const c = document.getElementById('hosting-providers-container');
  try {
    const [countRes, provRes] = await Promise.all([
      fetch('/api/hosting/count'),
      fetch('/api/hosting/providers')
    ]);
    const countData = await countRes.json();
    const provData = await provRes.json();
    const active = (provData.providers || []).filter(p => p.status === 'active');
    if (active.length === 0) { c.style.display = 'none'; return; }
    let html = '<h3 style="color:var(--acreetion-green);margin:2rem 0 0.5rem">ISO Mirror Providers</h3>';
    html += '<div style="background:rgba(46,204,113,0.05);border:1px solid var(--acreetion-box-border);border-radius:12px;padding:1.25rem">';
    if (active.length >= 5) {
      html += '<label for="fastest-mirror" style="display:block;margin-bottom:0.5rem;font-weight:600;color:var(--acreetion-text-bright)">Fastest Provider</label>';
      html += '<select id="fastest-mirror" style="width:100%;padding:0.6rem;background:var(--acreetion-panel-bg,#1a1a1a);color:var(--acreetion-text-bright);border:1px solid var(--acreetion-box-border);border-radius:8px;font-size:0.9rem;margin-bottom:0.75rem" >';
      html += '<option value="">Select a mirror...</option>';
      active.forEach(p => { html += '<option value="' + safeUrl(p.mirror_url) + '">' + escAttr(p.org) + ' — ' + escAttr(p.location) + '</option>'; });
      html += '</select>';
    } else {
      html += '<div style="display:flex;flex-direction:column;gap:0.5rem">';
      active.forEach(p => {
        html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:0.5rem 0;border-bottom:1px solid var(--acreetion-box-border)">';
        html += '<span><strong>' + escAttr(p.org) + '</strong> <span style="color:#888;font-size:0.85rem">' + escAttr(p.location) + '</span></span>';
        html += '<a href="' + safeUrl(p.mirror_url) + '" target="_blank" rel="noopener" class="btn" style="background:#2ecc71;color:#000;padding:0.3rem 0.8rem;font-size:0.8rem;border-radius:6px">ISO</a>';
        html += '</div>';
      });
      html += '</div>';
    }
    html += '<a href="hosting.html" class="btn" style="margin-top:0.75rem;display:inline-block;background:transparent;color:var(--acreetion-green);border:1px solid var(--acreetion-green);padding:0.4rem 1rem;font-size:0.85rem;border-radius:8px">View All Providers</a>';
    html += '</div>';
    c.innerHTML = html;
    var sel = document.getElementById('fastest-mirror');
    if (sel) {
      sel.addEventListener('change', function() {
        if (this.value && this.value.indexOf('https://') === 0) {
          window.location.href = this.value;
        }
      });
    }
  } catch(e) { c.style.display = 'none'; }
}
function escAttr(s) { return (s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function safeUrl(s) { if (!s||typeof s!=='string'||s.indexOf('javascript:')===0||s.indexOf('data:')===0||s.indexOf('vbscript:')===0) return ''; return s; }
window.addEventListener('DOMContentLoaded', loadHostingProviders);
