/* Reader view for aggregated documents.
 *
 * Usage: reader.html?src=<ingested document on this site>
 *        &source=<display name of the source> (optional)
 *        &credit=<credit line> (optional)
 *
 * Boundary, per the site's licensing policy (see README, "External content
 * and licensing"): the reader only opens documents that live on this site --
 * documents we were allowed to copy and ingest. A document whose license
 * does not allow copying is never pulled in here; it stays embedded on its
 * own page, with its reason shown there.
 */
(function () {
  "use strict";

  var params = new URLSearchParams(window.location.search);
  var src = params.get("src");

  var introEl = document.getElementById("reader-intro");
  var statusEl = document.getElementById("reader-status");
  var articleEl = document.getElementById("reader-article");
  var titleEl = document.getElementById("reader-title");
  var sourceEl = document.getElementById("reader-source");
  var contentEl = document.getElementById("reader-content");

  function fail(message) {
    statusEl.textContent = message;
    statusEl.hidden = false;
    articleEl.hidden = true;
  }

  if (!src) {
    introEl.hidden = false;
    return;
  }

  var url;
  try {
    url = new URL(src, window.location.href);
  } catch (e) {
    fail("That document address is not valid.");
    return;
  }

  if (url.origin !== window.location.origin) {
    fail(
      "The reader only opens documents that have been ingested into this " +
        "site. A document whose license does not allow copying stays " +
        "embedded on its own page, with its reason shown there -- it is " +
        "never pulled in here."
    );
    return;
  }

  statusEl.textContent = "Loading...";
  statusEl.hidden = false;

  fetch(url.href)
    .then(function (resp) {
      if (!resp.ok) {
        throw new Error("HTTP " + resp.status);
      }
      return resp.text();
    })
    .then(function (html) {
      render(html, url);
    })
    .catch(function () {
      fail("That document could not be loaded.");
    });

  function render(html, docUrl) {
    var doc = new DOMParser().parseFromString(html, "text/html");
    var root =
      doc.querySelector("main") ||
      doc.querySelector("article") ||
      doc.querySelector(".content") ||
      doc.querySelector("#content") ||
      doc.body;

    var holder = document.createElement("div");
    holder.innerHTML = root.innerHTML;

    // Strip site chrome and anything executable or interactive.
    var strip = holder.querySelectorAll(
      "script, style, nav, header, footer, aside, form, button, iframe, " +
        "noscript, .sidebar, #sidebar, .page-header, .page-footer"
    );
    for (var i = 0; i < strip.length; i++) {
      strip[i].remove();
    }

    // Neutralize event handlers and javascript: URLs; make links and
    // images resolve against the document's own location.
    var all = holder.querySelectorAll("*");
    for (var j = 0; j < all.length; j++) {
      var el = all[j];
      var attrs = el.attributes;
      for (var k = attrs.length - 1; k >= 0; k--) {
        if (attrs[k].name.indexOf("on") === 0) {
          el.removeAttribute(attrs[k].name);
        }
      }
      if (el.tagName === "A" && el.getAttribute("href")) {
        var href = el.getAttribute("href");
        if (/^\s*javascript:/i.test(href)) {
          el.removeAttribute("href");
        } else {
          el.setAttribute("href", new URL(href, docUrl).href);
        }
      }
      if (el.tagName === "IMG" && el.getAttribute("src")) {
        el.setAttribute("src", new URL(el.getAttribute("src"), docUrl).href);
      }
    }

    var heading = holder.querySelector("h1");
    var title =
      (heading && heading.textContent.trim()) ||
      doc.title ||
      "Untitled document";
    titleEl.textContent = title;
    document.title = title + " -- Reader -- AcreetionOS";

    var sourceName = params.get("source") || docUrl.pathname;
    var credit = params.get("credit");
    sourceEl.textContent =
      "Source: " + sourceName + (credit ? " -- " + credit : "");

    contentEl.innerHTML = "";
    while (holder.firstChild) {
      contentEl.appendChild(holder.firstChild);
    }

    statusEl.hidden = true;
    articleEl.hidden = false;
  }
})();
