(function () {
  "use strict";

  try {
    var menuItems = [
      { href: "index.html", label: "Home", icon: "bi-house" },
      { href: "flash.html", label: "Downloads", icon: "bi-download" },
      { href: "https://wiki.acreetionos.org/", label: "Wiki", icon: "bi-book" },
      { href: "about.html", label: "About", icon: "bi-info-circle" },
      { href: "beginner.html", label: "Beginner Guide", icon: "bi-mortarboard" },
      { href: "lightweight.html", label: "Lightweight Edition", icon: "bi-feather" },
      { href: "immutable.html", label: "Immutable Edition", icon: "bi-shield-lock" },
      { href: "status.html", label: "Status", icon: "bi-activity" },
      { href: "contact.html", label: "Contact", icon: "bi-envelope-paper" },
      { href: "hosting.html", label: "ISO Hosting", icon: "bi-hdd-stack" },
      { href: "unofficial.html", label: "Community Editions", icon: "bi-grid" },
      { href: "changelog.html", label: "Changelog", icon: "bi-journal-text" },
      { href: "https://github.com/AcreetionOS-Code", label: "GitHub", icon: "bi-github" },
      { href: "https://gitlab.acreetionos.org", label: "GitLab", icon: "bi-gitlab" },
      { href: "https://matrix.acreetionos.org", label: "Matrix Chat", icon: "bi-chat-dots" },
      { href: "https://irc.acreetionos.org", label: "IRC Web Chat", icon: "bi-hash" },
      { href: "https://xmpp.acreetionos.org", label: "XMPP Chat", icon: "bi-chat-left-text" },
      {
        href: "https://github.com/AcreetionOS-Code/acreetionos-code.github.io/issues",
        label: "Issues",
        icon: "bi-bug",
      },
      { href: "https://security.archlinux.org", label: "Security", icon: "bi-shield-check" },
    ];

    var initializeSidebar = function () {
      var header = document.querySelector(".header-content");
      if (!header || document.getElementById("hamburger")) {
        return;
      }

      var hamburger = document.createElement("button");
      hamburger.id = "hamburger";
      hamburger.type = "button";
      hamburger.setAttribute("aria-label", "Open navigation");
      hamburger.setAttribute("aria-controls", "sidebar");
      hamburger.setAttribute("aria-expanded", "false");
      hamburger.innerHTML = "<span></span><span></span><span></span>";
      header.appendChild(hamburger);

      var overlay = document.createElement("div");
      overlay.id = "sidebar-overlay";
      overlay.setAttribute("aria-hidden", "true");
      document.body.appendChild(overlay);

      var sidebar = document.createElement("nav");
      sidebar.id = "sidebar";
      sidebar.setAttribute("aria-label", "Site navigation");
      sidebar.setAttribute("aria-hidden", "true");

      var links = menuItems.map(function (item) {
        var href = item.href.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
        return (
          '<li><a href="' +
          href +
          '"><i class="bi ' +
          item.icon +
          '" aria-hidden="true"></i><span>' +
          item.label +
          "</span></a></li>"
        );
      });

      sidebar.innerHTML =
        '<div class="sidebar-header"><span class="sidebar-title">Navigation</span>' +
        '<button class="sidebar-close" type="button" aria-label="Close navigation">&times;</button></div>' +
        '<div class="sidebar-body"><ul>' +
        links.join("") +
        "</ul></div>" +
        '<div class="sidebar-authors">' +
        '<a href="https://darren.acreetionos.org" target="_blank" rel="noopener" class="sidebar-author-link">' +
        '<img src="https://acreetionos.org/darren_avatar_new.webp" alt="" width="22" height="22" class="sidebar-author-avatar"> Darren</a>' +
        '<a href="https://natalie.acreetionos.org" target="_blank" rel="noopener" class="sidebar-author-link">' +
        '<img src="https://acreetionos.org/natalie_avatar_new.webp" alt="" width="22" height="22" class="sidebar-author-avatar"> Natalie</a>' +
        "</div>" +
        '<div class="sidebar-footer"><a href="https://discord.gg/VHqQkJASw7" target="_blank" rel="noopener">Discord</a>' +
        '<a href="contact.html">Contact</a></div>';

      document.body.appendChild(sidebar);

      var closeButton = sidebar.querySelector(".sidebar-close");
      var isOpen = false;

      var closeSidebar = function () {
        if (!isOpen) {
          return;
        }

        isOpen = false;
        document.body.classList.remove("sidebar-open");
        hamburger.classList.remove("active");
        hamburger.setAttribute("aria-expanded", "false");
        hamburger.setAttribute("aria-label", "Open navigation");
        overlay.classList.remove("open");
        sidebar.classList.remove("open");
        overlay.setAttribute("aria-hidden", "true");
        sidebar.setAttribute("aria-hidden", "true");
      };

      var openSidebar = function () {
        isOpen = true;
        document.body.classList.add("sidebar-open");
        hamburger.classList.add("active");
        hamburger.setAttribute("aria-expanded", "true");
        hamburger.setAttribute("aria-label", "Close navigation");
        overlay.classList.add("open");
        sidebar.classList.add("open");
        overlay.setAttribute("aria-hidden", "false");
        sidebar.setAttribute("aria-hidden", "false");
      };

      hamburger.addEventListener("click", function () {
        if (isOpen) {
          closeSidebar();
        } else {
          openSidebar();
        }
      });
      closeButton.addEventListener("click", closeSidebar);
      overlay.addEventListener("click", closeSidebar);
      document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
          closeSidebar();
        }
      });
      window.addEventListener("pageshow", function () {
        closeSidebar();
      });
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initializeSidebar);
    } else {
      initializeSidebar();
    }
  } catch (error) {
    console.error("Sidebar init error:", error);
  }
})();
