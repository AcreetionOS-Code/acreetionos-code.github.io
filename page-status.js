(function() {
  'use strict';

  var services = [
    {
      name: 'Website',
      url: 'https://acreetionos.org',
      icon: 'bi-globe',
      status: 'checking',
      statusText: 'Checking...',
      lastChecked: null,
      responseTime: null
    },
    {
      name: 'ISO Mirror',
      url: 'https://iso.acreetionos.org:8448',
      icon: 'bi-hdd-stack',
      status: 'checking',
      statusText: 'Checking...',
      lastChecked: null,
      responseTime: null
    },
    {
      name: 'GitLab',
      url: 'https://gitlab.acreetionos.org',
      icon: 'bi-gitlab',
      status: 'checking',
      statusText: 'Checking...',
      lastChecked: null,
      responseTime: null
    },
    {
      name: 'GitLab (ISO Build & Publish)',
      url: 'https://gitlab.acreetionos.org',
      icon: 'bi-gear',
      status: 'checking',
      statusText: 'Checking...',
      lastChecked: null,
      responseTime: null
    }
  ];

  function renderCards() {
    var grid = document.getElementById('services-grid');
    var html = '';
    for (var i = 0; i < services.length; i++) {
      var s = services[i];
      var dotClass, txtClass;
      switch (s.status) {
        case 'operational': dotClass = 'green'; txtClass = 'green'; break;
        case 'down': dotClass = 'red'; txtClass = 'red'; break;
        case 'degraded': dotClass = 'yellow'; txtClass = 'yellow'; break;
        default: dotClass = 'grey'; txtClass = 'grey';
      }
      var metaHtml = '';
      if (s.responseTime !== null) {
        metaHtml = '<div class="service-meta"><div><span class="label">Response</span><div class="value">' + s.responseTime + 'ms</div></div></div>';
      } else if (s.status === 'operational' || s.status === 'down') {
        metaHtml = '<div class="service-meta"><div><span class="label">Status</span><div class="value">' + (s.httpStatus || '—') + '</div></div></div>';
      }
      html += '<div class="service-card" id="card-' + i + '">' +
        '<div class="service-icon"><i class="bi ' + s.icon + '"></i></div>' +
        '<div class="service-info">' +
          '<div class="service-name">' + s.name + '</div>' +
          '<div class="service-url">' + s.url + '</div>' +
        '</div>' +
        '<div class="service-status">' +
          '<span class="status-dot ' + dotClass + '"></span>' +
          '<span class="status-text ' + txtClass + '">' + s.statusText + '</span>' +
        '</div>' +
        metaHtml +
      '</div>';
    }
    grid.innerHTML = html;
  }

  function updateSummary() {
    var summary = document.getElementById('summary-text');
    var dotEl = document.querySelector('#status-summary .dot');
    var operational = 0, down = 0, checking = 0;
    for (var i = 0; i < services.length; i++) {
      if (services[i].status === 'operational') operational++;
      else if (services[i].status === 'down') down++;
      else checking++;
    }
    if (checking === services.length) {
      dotEl.className = 'dot yellow';
      summary.textContent = 'Checking services...';
    } else if (down > 0) {
      dotEl.className = 'dot red';
      summary.textContent = operational + ' operational, ' + down + ' down';
    } else if (checking > 0) {
      dotEl.className = 'dot yellow';
      summary.textContent = operational + ' operational, ' + checking + ' checking';
    } else {
      dotEl.className = 'dot green';
      summary.textContent = 'All ' + services.length + ' services operational';
    }
  }

  function updateLastChecked() {
    var now = new Date();
    var time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    var date = now.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    document.getElementById('last-checked').textContent = date + ' at ' + time;
  }

  function checkService(idx) {
    var s = services[idx];
    s.status = 'checking';
    s.statusText = 'Checking...';
    s.responseTime = null;
    s.httpStatus = null;
    renderCards();

    var card = document.getElementById('card-' + idx);
    if (card) {
      var dot = card.querySelector('.status-dot');
      var txt = card.querySelector('.status-text');
      dot.className = 'status-dot yellow';
      txt.className = 'status-text yellow';
      txt.textContent = 'Checking...';
    }

    var startTime = performance.now();

    fetch(s.url, { method: 'HEAD', mode: 'no-cors', cache: 'no-store' })
      .then(function(response) {
        // no-cors gives opaque response — we can't read the status, but if it resolves, it's reachable
        var elapsed = Math.round(performance.now() - startTime);
        s.status = 'operational';
        s.statusText = 'Operational';
        s.responseTime = elapsed;
        s.httpStatus = response.type === 'opaque' ? '—' : response.status;
        updateCard(idx);
      })
      .catch(function() {
        // retry with GET fallback if HEAD fails
        return fetch(s.url, { method: 'GET', mode: 'no-cors', cache: 'no-store' })
          .then(function(response) {
            var elapsed = Math.round(performance.now() - startTime);
            s.status = 'operational';
            s.statusText = 'Operational';
            s.responseTime = elapsed;
            s.httpStatus = response.type === 'opaque' ? '—' : response.status;
            updateCard(idx);
          })
          .catch(function() {
            var elapsed = Math.round(performance.now() - startTime);
            s.status = 'down';
            s.statusText = 'Down';
            s.responseTime = elapsed;
            s.httpStatus = 'ERR';
            updateCard(idx);
          });
      });
  }

  function updateCard(idx) {
    var s = services[idx];
    var card = document.getElementById('card-' + idx);
    if (!card) return;

    var dot = card.querySelector('.status-dot');
    var txt = card.querySelector('.status-text');
    var metaDiv = card.querySelector('.service-meta');

    var dotClass, txtClass;
    if (s.status === 'operational') { dotClass = 'green'; txtClass = 'green'; }
    else if (s.status === 'down') { dotClass = 'red'; txtClass = 'red'; }
    else { dotClass = 'yellow'; txtClass = 'yellow'; }

    dot.className = 'status-dot ' + dotClass;
    txt.className = 'status-text ' + txtClass;
    txt.textContent = s.statusText;

    if (s.responseTime !== null) {
      if (metaDiv) {
        var valueEl = metaDiv.querySelector('.value');
        if (valueEl) {
          valueEl.textContent = s.responseTime + 'ms';
        }
      } else {
        var newMeta = document.createElement('div');
        newMeta.className = 'service-meta';
        newMeta.innerHTML = '<div><span class="label">Response</span><div class="value">' + s.responseTime + 'ms</div></div>';
        card.appendChild(newMeta);
      }
    }

    updateSummary();
    updateLastChecked();
  }

  function checkAllServices() {
    var btn = document.getElementById('refresh-btn');
    btn.disabled = true;
    btn.classList.add('spin');
    for (var i = 0; i < services.length; i++) {
      checkService(i);
    }
    setTimeout(function() {
      btn.disabled = false;
      btn.classList.remove('spin');
    }, 5000);
  }

  // init
  renderCards();
  updateSummary();
  updateLastChecked();
  // start checking after a short delay so the page renders first
  setTimeout(checkAllServices, 300);
  var refreshBtn = document.getElementById('refresh-btn');
  if (refreshBtn) { refreshBtn.addEventListener('click', checkAllServices); }
})();
