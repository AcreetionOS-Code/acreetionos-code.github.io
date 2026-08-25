(function() {
  "use strict";
  if (!/\.onion$/.test(window.location.hostname)) return;

  var MAIN_ONION = "http://sz3opx2vluaqk46bxmgjzslw5v2hldmldo7cr65eqhohstldghjaujyd.onion";
  var ISO_ONION = "http://drxoopx4vxhkkdtb4pjicjopvjfl5yuqr3qivjkmakehoxlpa3pcxwid.onion";

  var css = [
    ".tor-badge{position:fixed;left:16px;bottom:16px;z-index:9999;display:flex;align-items:center;gap:10px;",
    "padding:10px 14px;border-radius:12px;background:#2c2340;color:#fff;",
    "box-shadow:0 4px 18px rgba(0,0,0,.45);font-family:system-ui,-apple-system,sans-serif;font-size:13px;line-height:1.4;max-width:min(92vw,420px)}",
    ".tor-badge__logo{flex:none;width:34px;height:34px}",
    ".tor-badge__title{display:flex;align-items:center;gap:6px;font-weight:700;margin:0 0 2px}",
    ".tor-badge__title svg{flex:none}",
    ".tor-badge__links{margin:0;padding:0;list-style:none;display:flex;flex-wrap:wrap;gap:4px 12px}",
    ".tor-badge__links a{color:#c9a7ef;text-decoration:none;word-break:break-all}",
    ".tor-badge__links a:hover,.tor-badge__links a:focus{text-decoration:underline}",
    ".tor-badge__close{position:absolute;top:6px;right:8px;background:none;border:0;color:#9b8bb4;",
    "font-size:15px;cursor:pointer;padding:2px 4px;border-radius:6px}",
    ".tor-badge__close:hover,.tor-badge__close:focus{color:#fff;background:#443560}",
    "@media(max-width:480px){.tor-badge{left:10px;right:10px;bottom:10px}}",
    "@media print{.tor-badge{display:none}}"
  ].join("");

  function esc(s) {
    return s.replace(/[&<>"']/g, function(c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  var here = MAIN_ONION + window.location.pathname;

  var style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  var badge = document.createElement("div");
  badge.className = "tor-badge";
  badge.setAttribute("role", "complementary");
  badge.setAttribute("aria-label", "Tor onion mirror notice");

  badge.innerHTML =
    '<svg class="tor-badge__logo" viewBox="0 0 50 50" role="img" aria-label="Tor logo" focusable="false">' +
    '<circle cx="25" cy="25" r="24" fill="#7d4698"/>' +
    '<circle cx="25" cy="25" r="19" fill="#59316b"/>' +
    '<path d="M25 6a19 19 0 0 1 0 38" fill="#ab7fcf"/>' +
    '<path d="M25 11a14 14 0 0 1 0 28" fill="#7d4698"/>' +
    '<path d="M25 17a8 8 0 0 1 0 16" fill="#c9a7ef"/>' +
    "</svg>" +
    '<div class="tor-badge__text">' +
    '<p class="tor-badge__title">' +
    '<svg width="14" height="14" viewBox="0 0 16 16" fill="#c9a7ef" aria-hidden="true" focusable="false">' +
    '<path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm0 2a5 5 0 0 1 0 10V3Z"/></svg>' +
    "Official Tor Onion Mirror</p>" +
    '<ul class="tor-badge__links">' +
    '<li><a href="' + esc(here) + '" rel="noopener">Main site (you are here)</a></li>' +
    '<li><a href="' + ISO_ONION + '/acreetion/" rel="noopener">ISO/repo mirror</a></li>' +
    "</ul>" +
    "</div>" +
    '<button class="tor-badge__close" type="button" aria-label="Dismiss Tor mirror notice">&times;</button>';

  badge.querySelector(".tor-badge__close").addEventListener("click", function() {
    badge.remove();
  });

  document.body.appendChild(badge);
})();
