(function () {
  'use strict';
  var siteKey = '6Lf-EoAtAAAAAI8dwkXHkdisu4eoz1KaZlFMK47w';
  var loadPromise = null;

  function loadRecaptcha() {
    if (window.grecaptcha && window.grecaptcha.enterprise && typeof window.grecaptcha.enterprise.execute === 'function') return Promise.resolve(window.grecaptcha.enterprise);
    if (loadPromise) return loadPromise;
    loadPromise = new Promise(function (resolve) {
      var script = document.createElement('script');
      script.src = 'https://www.google.com/recaptcha/enterprise.js?render=' + encodeURIComponent(siteKey);
      script.async = true;
      script.defer = true;
      script.onload = function () {
        var enterprise = window.grecaptcha && window.grecaptcha.enterprise;
        resolve(enterprise && typeof enterprise.execute === 'function' ? enterprise : null);
      };
      script.onerror = function () { resolve(null); };
      document.head.appendChild(script);
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
        if (typeof api.ready === 'function') api.ready(execute);
        else execute();
      });
    });
  };
})();
