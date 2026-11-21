// Mirror steering: the worker reports which mirrors actually hold the files
// (/api/mirror-health); this script then probes the live ones from the
// visitor's own connection and points the ISO buttons at the fastest.
// R2 wins ties (its egress is free). If anything fails, the buttons keep
// their origin URLs -- exactly the pre-steering behavior.
(function () {
  var POOL = [
    { name: 'Cloudflare R2', base: 'https://pub-6f2e9495adfd40eb84a9b137eb384073.r2.dev/' },
    { name: 'Linode (Chicago)', base: 'https://isoimages.us-ord-10.linodeobjects.com/' },
    { name: 'OSUOSL', base: 'https://ftp2.osuosl.org/pub/acreetionos/' },
    { name: 'RWTH Aachen (Germany)', base: 'https://ftp.halifax.rwth-aachen.de/acreetionos/' },
    { name: 'ACC (Sweden)', base: 'https://mirror.accum.se/mirror/acreetionos.org/' },
    { name: 'NLUUG (Netherlands)', base: 'https://ftp.nluug.nl/pub/os/Linux/distr/AcreetionOS/iso_images/' },
    { name: 'Masaryk University (Czech Republic)', base: 'https://ftp.fi.muni.cz/pub/linux/acreetion/' },
    { name: 'AWS (US East)', base: 'https://acreetionos-398861427116-us-east-1-an.s3.us-east-1.amazonaws.com/' },
    { name: 'Origin (US)', base: 'https://iso.acreetionos.org/acreetion/' }
  ];
  var FILES = ['AcreetionOS-1.0-x86_64.iso', 'AcreetionOS_XL-1.0-x86_64.iso', 'AcreetionOS_Wayland-Experimental-1.0-x86_64.iso'];
  function probe(base, file) {
    return new Promise(function (res) {
      var t0 = performance.now();
      fetch(base + file, { method: 'HEAD', mode: 'no-cors', cache: 'no-store' })
        .then(function () { res({ base: base, ms: performance.now() - t0, up: true }); })
        .catch(function () { res({ base: base, ms: Infinity, up: false }); });
    });
  }
  fetch('/api/mirror-health', { cache: 'no-store' })
    .then(function (r) { return r.json(); })
    .then(function (health) {
      var live = {};
      (health.endpoints || []).forEach(function (e) { if (e.ok) live[e.base] = e.name; });
      var bases = Object.keys(live);
      if (!bases.length) return;
      document.querySelectorAll('[data-mirror-base]').forEach(function (a) {
        if (live[a.getAttribute('data-mirror-base')]) a.style.display = '';
      });
      return Promise.all(bases.map(function (b) { return probe(b, FILES[0]); })).then(function (rs) {
        var up = rs.filter(function (r) { return r.up; });
        if (!up.length) return;
        up.sort(function (a, b) { return a.ms - b.ms; });
        var best = up[0];
        var r2 = up.filter(function (r) { return r.base === POOL[0].base; })[0];
        if (r2 && r2.ms <= best.ms + 200) best = r2;
        document.querySelectorAll('a[href]').forEach(function (a) {
          if (a.hasAttribute('data-static')) return;
          var href = a.getAttribute('href');
          if (!href) return;
          for (var i = 0; i < POOL.length; i++) {
            if (href.indexOf(POOL[i].base) === 0) {
              a.href = best.base + href.slice(POOL[i].base.length);
              break;
            }
          }
        });
        var el = document.getElementById('mirror-status');
        if (el) el.innerHTML = '<i class="bi bi-hdd-network"></i> Mirror: ' + live[best.base] + ' -- picked automatically, fastest live mirror for your connection. Same files on every mirror; verify with SHA256SUMS.';
      });
    })
    .catch(function () { /* leave the origin links untouched */ });
})();
