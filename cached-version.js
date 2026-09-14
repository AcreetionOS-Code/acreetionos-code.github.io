// cached-version.js — Discloses when AcreetionOS is being viewed from the
// service-worker cache (offline or fallback). Honest transparency: a fixed
// bottom-right bubble in site branding links to the live site. No bubble is
// shown when the page is served live from the network.
// Maintainers: AcreetionOS

(function () {
  "use strict";
  if (!("serviceWorker" in navigator)) return;

  var shown = false;

  function showBubble() {
    if (shown) return;
    shown = true;

    var b = document.createElement("div");
    b.style.cssText =
      "all:initial;position:fixed;right:16px;bottom:16px;z-index:2147483647;" +
      "font:13px/1.45,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,Cantarell,sans-serif;" +
      "color:#e5e5e5;background:#1a1a1a;border:1px solid #2ecc71;border-left:4px solid #2ecc71;" +
      "border-radius:10px;padding:12px 14px;max-width:300px;" +
      "box-shadow:0 6px 18px rgba(0,0,0,0.55);";

    b.innerHTML =
      '<div style="font-weight:700;color:#2ecc71;margin-bottom:4px;">Cached version</div>' +
      '<div style="color:#b2b2b2;">You are looking at a locally cached copy' +
      ' of this page because the network version could not be loaded right now.' +
      ' To force-load the live page, press <b style="color:#e5e5e5;">Ctrl + Shift + R</b>' +
      ' (Windows/Linux) or <b style="color:#e5e5e5;">Cmd + Shift + R</b> (macOS).' +
      ' <a href="' + location.pathname + '" style="color:#2ecc71;font-weight:600;text-decoration:none;">Reload live →</a></div>';

    // Clicking anywhere except the link dismisses the notice.
    b.addEventListener("click", function (e) {
      if (e.target.tagName !== "A") b.style.display = "none";
    });

    (document.body || document.documentElement).appendChild(b);
  }

  navigator.serviceWorker.addEventListener("message", function (e) {
    if (e.data && e.data.type === "SERVED_FROM_CACHE") showBubble();
  });
})();
