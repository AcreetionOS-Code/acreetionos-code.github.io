// reCAPTCHA Enterprise frontend helper for AcreetionOS.
// Site key: 6Lf-EoAtAAAAAI8dwkXHkdisu4eoz1KaZlFMK47w (project clean-502708)
//
// Usage:
//   const token = await window.getRecaptchaToken('newsletter_subscribe');
//   // token is a string, or null if reCAPTCHA is blocked/unavailable.
//   // Send it in your POST body as `recaptchaToken` — the worker decides
//   // whether verification is enforced (only when a secret is configured).
//
// The enterprise.js script is loaded LAZILY on first use, so pages that
// never submit a form pay zero cost.
(function () {
  var SITE_KEY = '6Lf-EoAtAAAAAI8dwkXHkdisu4eoz1KaZlFMK47w';
  var loaded = false;
  var loadPromise = null;

  function loadScript() {
    if (loaded) return Promise.resolve();
    if (loadPromise) return loadPromise;
    loadPromise = new Promise(function (resolve) {
      var s = document.createElement('script');
      s.src = 'https://www.google.com/recaptcha/enterprise.js?render=' + SITE_KEY;
      s.async = true;
      s.defer = true;
      s.onload = function () { loaded = true; resolve(); };
      // If Google is blocked (adblocker/offline), fail open with null —
      // the worker decides the policy based on whether secrets are configured.
      s.onerror = function () { resolve(); };
      document.head.appendChild(s);
    });
    return loadPromise;
  }

  // Resolves to a token string, or null if reCAPTCHA cannot run.
  window.getRecaptchaToken = function (action) {
    return loadScript().then(function () {
      return new Promise(function (resolve) {
        if (!window.grecaptcha || !window.grecaptcha.enterprise) { resolve(null); return; }
        var settled = false;
        var timer = setTimeout(function () {
          if (!settled) { settled = true; resolve(null); }
        }, 8000);
        window.grecaptcha.enterprise.execute(SITE_KEY, { action: action || 'submit' }).then(
          function (token) {
            if (!settled) { settled = true; clearTimeout(timer); resolve(token); }
          },
          function () {
            if (!settled) { settled = true; clearTimeout(timer); resolve(null); }
          }
        );
      });
    });
  };
})();
