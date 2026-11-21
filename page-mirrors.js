(function () {
  var slot = document.getElementById('registered-mirrors');
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function card(m) {
    var d = el('div', 'principle');
    var h = el('h3');
    h.appendChild(el('i', 'bi bi-hdd-network'));
    h.appendChild(document.createTextNode((m.name || 'Mirror') + ' -- ' + (m.location || '')));
    d.appendChild(h);
    var p = el('p');
    if (m.org) {
      p.appendChild(document.createTextNode('Run by '));
      if (m.org_url) { var a = el('a', null, m.org); a.href = m.org_url; p.appendChild(a); }
      else p.appendChild(document.createTextNode(m.org));
      p.appendChild(document.createTextNode('. '));
    }
    if (m.sync) p.appendChild(document.createTextNode('Syncs ' + m.sync + '.'));
    p.appendChild(el('br'));
    p.appendChild(document.createTextNode('HTTPS: '));
    var link = el('a', null, String(m.base || '').replace(/^https:\/\//, ''));
    link.href = m.base;
    p.appendChild(link);
    if (m.rsync) {
      p.appendChild(el('br'));
      p.appendChild(document.createTextNode('rsync: '));
      p.appendChild(el('code', null, m.rsync));
    }
    d.appendChild(p);
    return d;
  }
  function load() {
    fetch('/api/mirrors').then(function (r) { return r.json(); }).then(function (data) {
      slot.innerHTML = '';
      (data.mirrors || []).forEach(function (m) { slot.appendChild(card(m)); });
    }).catch(function () {});
  }
  if (slot) load();
  var form = document.getElementById('mirror-form');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = document.getElementById('mf-submit');
      var msg = document.getElementById('mf-msg');
      function v(id) { var n = document.getElementById(id); return n ? n.value.trim() : ''; }
      var data = { name: v('mf-name'), base_url: v('mf-url'), location: v('mf-location'), contact_email: v('mf-email'), org: v('mf-org'), org_url: v('mf-orgurl'), rsync_url: v('mf-rsync'), sync: v('mf-sync') };
      btn.disabled = true;
      msg.className = '';
      msg.textContent = 'Checking your mirror against the current release. This can take a few seconds...';
      fetch('/api/mirrors/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
        .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
        .then(function (res) {
          btn.disabled = false;
          if (res.ok) {
            msg.className = 'ok';
            msg.textContent = 'Verified -- your mirror is listed on this page now. Thank you for mirroring AcreetionOS.';
            form.reset();
            load();
          } else {
            msg.className = 'err';
            msg.textContent = res.d.error || 'Registration failed. Please check the form and try again.';
          }
        })
        .catch(function () {
          btn.disabled = false;
          msg.className = 'err';
          msg.textContent = 'Could not reach the registration service. Please try again in a few minutes.';
        });
    });
  }
})();
