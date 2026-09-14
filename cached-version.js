// cached-version.js — Discloses when AcreetionOS is being viewed from the
// service-worker cache (offline or fallback). An honest little "i" info bubble
// sits bottom-right; clicking it expands the cached-version notice with the
// force-refresh shortcuts. No bubble is shown when the page is served live.
// Maintainers: AcreetionOS

(function () {
  "use strict";
  if (!("serviceWorker" in navigator)) return;

  var created = false;

  function showBubble() {
    if (created) return;
    created = true;

    var wrap = document.createElement("div");
    // Outer "i" button — small circular info icon, site green-on-dark.
    wrap.innerHTML =
      '<button aria-label="Cached version info" title="This page is a cached copy" style="' +
        'all:initial;cursor:pointer;position:fixed;right:16px;bottom:16px;z-index:2147483647;' +
        'width:36px;height:36px;border-radius:50%;border:2px solid #2ecc71;' +
        'background:#1a1a1a;color:#2ecc71;font:700 20px/1 -apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;' +
        'font-style:italic;display:flex;align-items:center;justify-content:center;' +
        'box-shadow:0 4px 14px rgba(0,0,0,0.55);user-select:none;' +
      '">i</button>' +
      '<div class="acc-cached-note" style="' +
        'position:fixed;right:16px;bottom:64px;z-index:2147483647;display:none;max-width:310px;' +
        'font:13px/1.5 -apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Oxygen,Ubuntu,Cantarell,sans-serif;' +
        'color:#e5e5e5;background:#1a1a1a;border:1px solid #2ecc71;border-left:4px solid #2ecc71;' +
        'border-radius:10px;padding:12px 14px;box-shadow:0 6px 18px rgba(0,0,0,0.55);' +
      '">' +
        '<div style="font-weight:700;color:#2ecc71;margin-bottom:4px;">Cached version</div>' +
        '<div style="color:#b2b2b2;">You are looking at a locally cached copy of this page ' +
          'because the network version could not be loaded right now. To force-load the live page, ' +
          'press <b style="color:#e5e5e5;">Ctrl + Shift + R</b> (Windows/Linux) ' +
          'or <b style="color:#e5e5e5;">Cmd + Shift + R</b> (macOS). ' +
          '<a href="' + location.pathname + '" style="color:#2ecc71;font-weight:600;text-decoration:none;">Reload live →</a>' +
        '</div>' +
      '</div>';

    var btn = wrap.firstElementChild;
    var note = wrap.lastElementChild;

    function toggle(force) {
      note.style.display = typeof force === "boolean" ? (force ? "block" : "none") : (note.style.display === "block" ? "none" : "block");
    }

    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      toggle();
    });
    // Hover also reveals it (discoverable), click finishes interaction.
    btn.addEventListener("mouseenter", function () { toggle(true); });
    btn.addEventListener("mouseleave", function () { toggle(false); });
    // Dismiss when clicking outside.
    document.addEventListener("click", function (e) {
      if (!wrap.contains(e.target)) toggle(false);
    });

    (document.body || document.documentElement).appendChild(wrap);
  }

  navigator.serviceWorker.addEventListener("message", function (e) {
    if (e.data && e.data.type === "SERVED_FROM_CACHE") showBubble();
  });
})();
