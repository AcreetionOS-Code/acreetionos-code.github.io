(function () {
  'use strict';
  // The site key is NOT hardcoded here. It is read at runtime from
  // GET /api/config/public, which serves it from the Worker's RECAPTCHA_API_KEY
  // secret. A literal in this file looked harmless — site keys are public by
  // design — but it silently outlives a console-side rotation: the key gets
  // disabled, this file keeps asking Google for a token, and every form fails
  // with "Invalid site key" while nothing in the repo hints at the cause.
  // Rotating the key is now a secret change, not a code change.
  //
  // The same value is used server-side, so there is one source of truth.
  var CONFIG_URL = '/api/config/public';
  var siteKey = null;
  var keyPromise = null;
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

  // Fetch the key once per page load. A missing key is a configuration fault,
  // not something to paper over, so it warns loudly instead of failing silently
  // the way the old hardcoded-but-invalid key did.
  function fetchSiteKey() {
    if (keyPromise) return keyPromise;
    keyPromise = fetch(CONFIG_URL, { headers: { 'Accept': 'application/json' } })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (cfg) {
        if (!cfg || !cfg.recaptchaSiteKey) {
          throw new Error('no recaptchaSiteKey in ' + CONFIG_URL + ' — is RECAPTCHA_API_KEY set on the Worker?');
        }
        siteKey = cfg.recaptchaSiteKey;
        return siteKey;
      })
      .catch(function (e) {
        console.error('[recaptcha] could not load the site key: ' + (e && e.message ? e.message : e));
        return null;
      });
    return keyPromise;
  }

  function loadRecaptcha() {
    if (isReady()) return Promise.resolve(enterprise());
    if (loadPromise) return loadPromise;
    loadPromise = fetchSiteKey().then(function (key) {
      if (!key) return null;
      return new Promise(function (resolve) {
        var script = document.createElement('script');
        script.src = 'https://www.google.com/recaptcha/enterprise.js?render=' + encodeURIComponent(key);
        script.async = true;
        script.defer = true;
        script.onload = function () { waitForEnterprise(10000).then(resolve); };
        script.onerror = function () { resolve(null); };
        document.head.appendChild(script);
      });
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
