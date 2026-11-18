// gtm.js — single injection point for GTM-WW9RFH5B (#667)
// Why: compliance + relationship-building only, no ads, no identifiable cookies.
// Consent Mode v2 defaults to denied; tags fire only after user grants.
// This file is loaded on every page (via <script src="gtm.js"> added to each HTML or via generator scripts).
// It respects the guarantees in analytics.html: no ad_storage, no identifiable cookies.
(function () {
  // dataLayer as required by GTM - must exist before gtm.js loads
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;

  // Consent Mode v2 — default denied (GDPR/UK GDPR/ePrivacy, also honored for US GPC)
  // This ensures nothing in GTM fires until the CMP/banner grants consent.
  gtag('consent', 'default', {
    ad_storage: 'denied',
    analytics_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    functionality_storage: 'denied',
    personalization_storage: 'denied',
    security_storage: 'granted' // required for basic security, not tracking
  });
  gtag('js', new Date());

  // Load GTM container GTM-WW9RFH5B async — respects consent defaults above
  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtm.js?id=GTM-WW9RFH5B';
  s.onload = function () {
    // Container enforces no-ads / no-identifiable-cookies policy per analytics.html
  };
  var first = document.getElementsByTagName('script')[0];
  if (first && first.parentNode) first.parentNode.insertBefore(s, first);
  else document.head.appendChild(s);
})();
