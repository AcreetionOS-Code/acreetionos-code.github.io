(function () {
  'use strict';
  var siteKey = '6Lf-EoAtAAAAAI8dwkXHkdisu4eoz1KaZlFMK47w';
  var loadPromise = null;

  function enterprise() {
    return window.grecaptcha && window.grecaptcha.enterprise ? window.grecaptcha.enterprise : null;
  }

  function isReady() {
    var api = enterprise();
    return !!(api && typeof api.execute === 'function');
  }

  // Google's enterprise.js sets window.grecaptcha.enterprise ASYNCHRONOUSLY after
  // the script element fires load. Resolving on onload alone therefore races it:
  // measured in Chromium, onload resolved with enterprise.execute undefined, and
  // the same property was a function ~3s later. The old code resolved `null` on
  // that first miss, so getRecaptchaToken returned null intermittently and
  // callers fell back to raw content.
  //
  // Poll instead. 10s covers the observed gap with room to spare, and on timeout
  // resolve null exactly as before so callers keep their existing fallback.
  function waitForEnterprise(timeoutMs) {
    return new Promise(function (resolve) {
      var deadline = Date.now() + (timeoutMs || 10000);
      (function poll() {
        if (isReady()) { resolve(enterprise()); return; }
        if (Date.now() > deadline) { resolve(null); return; }
        setTimeout(poll, 100);
      })();
    });
  }

  function loadRecaptcha() {
    if (isReady()) return Promise.resolve(enterprise());
    if (loadPromise) return loadPromise;
    loadPromise = new Promise(function (resolve) {
      var script = document.createElement('script');
      script.src = 'https://www.google.com/recaptcha/enterprise.js?render=' + encodeURIComponent(siteKey);
      script.async = true;
      script.defer = true;
      script.onload = function () { waitForEnterprise(10000).then(resolve); };
      script.onerror = function () { resolve(null); };
      document.head.appendChild(script);
    });
    // A failed load must not poison every later call.
    loadPromise = loadPromise.then(function (api) {
      if (!api) loadPromise = null;
      return api;
    });
    return loadPromise;
  }

  window.getRecaptchaToken = function (action) {
    return loadRecaptcha().then(function (api) {
      if (!api) return null;
      return new Promise(function (resolve) {
        var settled = false;
        var timeout = setTimeout(function () { if (!settled) { settled = true; resolve(null); } }, 8000);
        function execute() {
          if (settled || typeof api.execute !== 'function') return;
          Promise.resolve(api.execute(siteKey, { action: action || 'submit' })).then(function (token) {
            if (!settled) { settled = true; clearTimeout(timeout); resolve(token); }
          }).catch(function () { if (!settled) { settled = true; clearTimeout(timeout); resolve(null); } });
        }
        // ready() is the documented gate, but guard on execute too: some builds
        // resolve ready() before execute is attached.
        if (typeof api.ready === 'function') {
          var readyCalled = false;
          api.ready(function () { if (!readyCalled) { readyCalled = true; execute(); } });
          // If ready() never fires or fires too early, poll rather than stall.
          setTimeout(function () { if (!readyCalled) { readyCalled = true; execute(); } }, 1500);
        } else {
          execute();
        }
      });
    });
  };
})();
