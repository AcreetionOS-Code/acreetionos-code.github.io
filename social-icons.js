// Social Media Icons — injected into footer on all pages
// Uses Bootstrap Icons (CDN), matches dark theme
(function () {
  'use strict';

  var SOCIALS = [
    { href: 'https://discord.acreetionos.org',     icon: 'bi-discord',      label: 'Discord',      title: 'Join our Discord' },
    { href: 'https://x.com/acreetionos',            icon: 'bi-twitter-x',    label: 'X / Twitter',  title: 'Follow on X' },
    { href: 'https://mastodon.acreetionos.org',     icon: 'bi-mastodon',     label: 'Mastodon',     title: 'Follow on Mastodon' },
    { href: 'https://bsky.acreetionos.org',          icon: 'bi-cloud-sun',    label: 'Bluesky',      title: 'Join on Bluesky' },
    { href: 'https://www.facebook.com/groups/574717645277790', icon: 'bi-facebook', label: 'Facebook', title: 'Join our Facebook Group' },
    { href: 'https://github.com/AcreetionOS-Code',   icon: 'bi-github',       label: 'GitHub',       title: 'View on GitHub' },
    { href: 'https://gitlab.acreetionos.org',        icon: 'bi-gitlab',       label: 'GitLab',       title: 'Self-hosted GitLab' },
    { href: 'https://xmpp.acreetionos.org',          icon: 'bi-chat-text',    label: 'XMPP',         title: 'Connect on XMPP' },
    { href: 'https://matrix.acreetionos.org',        icon: 'bi-boxes',        label: 'Matrix',       title: 'Join our Matrix Space' }
  ];

  function createSocialBar() {
    var bar = document.createElement('div');
    bar.className = 'acreetion-social-bar';
    bar.setAttribute('aria-label', 'Social media links');

    SOCIALS.forEach(function (s) {
      var a = document.createElement('a');
      a.href = s.href;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.className = 'acreetion-social-link';
      a.title = s.title;
      a.setAttribute('aria-label', s.label);

      var icon = document.createElement('i');
      icon.className = 'bi ' + s.icon;
      a.appendChild(icon);

      bar.appendChild(a);
    });

    return bar;
  }

  function inject() {
    // Find the last .page-footer on the page
    var footers = document.querySelectorAll('.page-footer');
    if (footers.length === 0) return;

    var footer = footers[footers.length - 1];
    var bar = createSocialBar();

    // Insert before the first <p> in the footer, or at the top
    var firstP = footer.querySelector('p');
    if (firstP) {
      footer.insertBefore(bar, firstP);
    } else {
      footer.insertBefore(bar, footer.firstChild);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();
