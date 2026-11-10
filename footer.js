(function () {
  "use strict";

  const communityLinks = [
    {
      href: "https://discord.gg/VHqQkJASw7",
      label: "Discord",
      icon: '<i class="bi bi-discord" aria-hidden="true"></i>'
    },
    {
      href: "https://www.youtube.com/@acreeetionos",
      label: "YouTube",
      icon: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.5 12 3.5 12 3.5s-7.505 0-9.376.55A3.016 3.016 0 0 0 .502 6.186 31.32 31.32 0 0 0 0 12s0 3.347.502 5.814a2.994 2.994 0 0 0 2.122 2.136C4.495 20.5 12 20.5 12 20.5s7.505 0 9.376-.55a2.994 2.994 0 0 0 2.122-2.136A31.32 31.32 0 0 0 24 12s0-3.347-.502-5.814ZM9.545 15.568V8.432L15.818 12l-6.273 3.568Z"/></svg>'
    },
    {
      href: "https://github.com/AcreetionOS-Code",
      label: "GitHub",
      icon: '<i class="bi bi-github" aria-hidden="true"></i>'
    },
    {
      href: "community-reviews.html",
      label: "Reviews",
      icon: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="m12 2 2.9 6.1 6.7.9-4.9 4.7 1.2 6.7-5.9-3.2-5.9 3.2 1.2-6.7-4.9-4.7 6.7-.9L12 2Z"/></svg>'
    }
  ];

  function createCommunityLinks() {
    const nav = document.createElement("nav");
    nav.className = "community-logo-links";
    nav.setAttribute("aria-label", "Community links");

    const leftGroup = document.createElement("div");
    leftGroup.className = "community-logo-group";
    const rightGroup = document.createElement("div");
    rightGroup.className = "community-logo-group";

    communityLinks.forEach(function (item, index) {
      const link = document.createElement("a");
      link.href = item.href;
      link.className = "community-logo-link";
      link.setAttribute("aria-label", item.label);
      link.innerHTML = item.icon;

      if (item.href.startsWith("https://")) {
        link.target = "_blank";
        link.rel = "noopener noreferrer";
      }

      (index < 2 ? leftGroup : rightGroup).appendChild(link);
    });

    nav.append(leftGroup, rightGroup);
    return nav;
  }

  try {
    const stylesheet = document.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = "community-logos.css?v=20261110";
    document.head.appendChild(stylesheet);

    const footer = document.createElement("footer");
    footer.className = "page-footer";
    footer.innerHTML = '<p>AcreetionOS is an independent project based on <a href="https://archlinux.org" target="_blank" rel="noopener">Arch Linux</a> \u2014 we are not affiliated with or endorsed by Arch Linux or Judd Vinnet. The Arch Linux trademark is owned by <strong>Judd Vinnet</strong> and used with acknowledgment.</p><p>We just made a version of Arch that <strong>"just works"</strong> for normal people.</p><p class="footer-social"><a href="https://github.com/AcreetionOS-Code" target="_blank" rel="noopener" aria-label="GitHub"><i class="bi bi-github"></i> GitHub</a> &middot; <a href="https://gitlab.acreetionos.org" target="_blank" rel="noopener" aria-label="GitLab"><i class="bi bi-gitlab"></i> GitLab</a> &middot; <a href="https://discord.gg/VHqQkJASw7" target="_blank" rel="noopener" aria-label="Discord"><i class="bi bi-discord"></i> Discord</a> &middot; <a href="https://matrix.acreetionos.org" target="_blank" rel="noopener" aria-label="Matrix (Element)"><i class="bi bi-chat-dots"></i> Matrix</a> &middot; <a href="https://irc.acreetionos.org" target="_blank" rel="noopener" aria-label="IRC Web Chat"><i class="bi bi-hash"></i> IRC Web Chat</a> &middot; <a href="https://xmpp.acreetionos.org" target="_blank" rel="noopener" aria-label="XMPP (Converse)"><i class="bi bi-chat-left-text"></i> XMPP</a> &middot; <a href="https://x.com/acreetionos" target="_blank" rel="noopener" aria-label="X (Twitter)"><i class="bi bi-twitter-x"></i> X</a> &middot; <a href="https://bsky.app/profile/acreetionos.bsky.social" target="_blank" rel="noopener" aria-label="Bluesky"><svg class="bi-butterfly" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .69.378 5.65.624 6.479.815 2.736 3.713 3.66 6.383 3.364.136-.02.275-.039.415-.056-.138.022-.276.04-.415.056-3.912.58-7.387 2.005-2.83 7.078 5.013 5.19 6.87-1.113 7.823-4.308.953 3.195 2.05 9.271 7.733 4.308 4.267-4.308 1.172-6.498-2.74-7.078a8.741 8.741 0 0 1-.415-.056c.14.017.279.036.415.056 2.67.297 5.568-.628 6.383-3.364.246-.828.624-5.79.624-6.478 0-.69-.139-1.861-.902-2.206-.659-.298-1.664-.62-4.3 1.24C16.046 4.748 13.087 8.687 12 10.8Z"/></svg> Bluesky</a> &middot; <a href="https://github.com/AcreetionOS-Code/acreetionos-code.github.io/issues" target="_blank" rel="noopener" aria-label="Issue tracker"><i class="bi bi-bug"></i> Issues</a></p><p><a href="docs.html">Documentation</a> &middot; <a href="governance.html">Governance</a> &middot; <a href="beginner.html">Beginner Guide</a> &middot; <a href="lightweight.html">Lightweight</a> &middot; <a href="immutable.html">Immutable</a> &middot; <a href="https://terms.acreetionos.org">Terms of Service</a></p>';

    const footerSocial = footer.querySelector(".footer-social");
    if (footerSocial) {
      footerSocial.style.display = "flex";
      footerSocial.style.flexWrap = "wrap";
      footerSocial.style.justifyContent = "center";
      footerSocial.style.gap = "0.25rem";

      footerSocial.querySelectorAll("a").forEach(function (link) {
        const icon = link.querySelector("i, svg");
        if (!icon) return;

        link.classList.add("community-logo-link");
        icon.setAttribute("aria-hidden", "true");
        link.replaceChildren(icon);
      });
    }

    const page = document.querySelector("#page-scale") || document.body;
    page.appendChild(footer);

    const header = document.querySelector(".page-header");
    if (header) {
      const headerLinks = createCommunityLinks();
      headerLinks.classList.add("community-logo-links--header");
      header.insertAdjacentElement("afterend", headerLinks);
    }

    const footerLinks = createCommunityLinks();
    footerLinks.classList.add("community-logo-links--footer");
    footer.insertBefore(footerLinks, footer.firstChild);
  } catch (error) {
    console.error("Footer init error:", error);
  }
})();
