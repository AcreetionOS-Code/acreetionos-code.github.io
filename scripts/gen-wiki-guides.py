#!/usr/bin/env python3
"""
Pre-generate static, crawlable wiki guide pages for popular topics.

Why: Static pages allow Google, Bing, and AI crawlers to discover and index
actual high-value Linux troubleshooting and configuration tutorials, eliminating 404s
and driving organic search traffic directly to AcreetionOS.

Includes complete SEO meta tags, BreadcrumbList, TechArticle JSON-LD schema,
OpenGraph, and Twitter Cards.

Usage:
    python3 scripts/gen-wiki-guides.py
"""

import json
import os
import re
import sys

OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "wiki-guides")
BASE_URL = "https://acreetionos.org"

GUIDES_DATA = [
    {
        "slug": "system-maintenance",
        "title": "System Maintenance Guide – AcreetionOS Arch Linux",
        "headline": "AcreetionOS System Maintenance Guide: Keeping Arch Clean & Stable",
        "description": "Learn essential system maintenance for AcreetionOS: updating packages with pacman, cleaning package caches, managing journal logs, and checking systemd services.",
        "keywords": "AcreetionOS maintenance, Arch Linux update guide, pacman maintenance, systemd troubleshooting, Arch Linux clean cache",
        "content_html": """
    <h2>1. What is System Maintenance on AcreetionOS?</h2>
    <p>AcreetionOS is built on a rolling-release Arch Linux base. Unlike fixed-release distributions that require major OS upgrades every six months to two years, AcreetionOS receives continuous updates. Regular, proactive maintenance keeps your desktop fast, responsive, secure, and rock-solid.</p>

    <h2>2. Recommended Maintenance Schedule</h2>
    <ul>
      <li><strong>Weekly:</strong> Run system updates and review release notes.</li>
      <li><strong>Monthly:</strong> Clean the pacman cache and remove orphaned packages.</li>
      <li><strong>Quarterly:</strong> Vacuum systemd logs and inspect failed background services.</li>
    </ul>

    <h2>3. Step-by-Step Maintenance Instructions</h2>
    <h3>A. Updating Your System</h3>
    <p>You can update AcreetionOS using the Software Center GUI or through the terminal:</p>
    <pre><code># Full system synchronization and upgrade
sudo pacman -Syu

# If using AUR packages via yay:
yay -Syu</code></pre>

    <h3>B. Cleaning the Package Cache</h3>
    <p>Pacman stores downloaded package archives in <code>/var/cache/pacman/pkg/</code>. To free disk space while keeping current versions for safety:</p>
    <pre><code># Remove old versions, keeping only installed packages
sudo paccache -r

# Remove all uninstalled package archives
sudo paccache -ruk0</code></pre>

    <h3>C. Removing Orphaned (Unused) Dependencies</h3>
    <p>When you uninstall software, unused dependencies might stay behind. Safely clean them up:</p>
    <pre><code># Check and remove orphans
sudo pacman -Rns $(pacman -Qdtq)</code></pre>

    <h3>D. Managing System Logs</h3>
    <p>Prevent systemd journal logs from consuming excessive disk space:</p>
    <pre><code># Limit systemd journal size to 200MB
sudo journalctl --vacuum-size=200M</code></pre>

    <h2>4. Troubleshooting Common Maintenance Issues</h2>
    <h3>Database Lock Error (<code>db.lck</code>)</h3>
    <p>If a previous update was interrupted, pacman may report a locked database. Verify no update process is running, then remove the lock:</p>
    <pre><code>sudo rm /var/lib/pacman/db.lck</code></pre>

    <h3>Keyring Verification Errors</h3>
    <p>If you encounter GPG signature errors during updates, refresh the Arch Linux and AcreetionOS keyrings:</p>
    <pre><code>sudo pacman -Sy archlinux-keyring
sudo pacman -Syu</code></pre>
"""
    },
    {
        "slug": "installing-software",
        "title": "Installing Software Guide – AcreetionOS Package Management",
        "headline": "How to Install Software on AcreetionOS: GUI, Pacman, Flatpak & AUR",
        "description": "Comprehensive guide to installing software on AcreetionOS. Use the Software Center GUI, Pacman package manager, Flatpak, and the Arch User Repository (AUR).",
        "keywords": "AcreetionOS install software, Arch Linux GUI package manager, pacman install, Flatpak AcreetionOS, AUR yay guide",
        "content_html": """
    <h2>1. Software Management Options in AcreetionOS</h2>
    <p>AcreetionOS provides access to the vast Linux software ecosystem through multiple channels: the graphical Software Center, the native <code>pacman</code> package manager, containerized Flatpaks, and community packages from the Arch User Repository (AUR).</p>

    <h2>2. Installing via Graphical Software Center</h2>
    <p>For a beginner-friendly point-and-click experience:</p>
    <ol>
      <li>Open the AcreetionOS Application Menu (bottom-left corner).</li>
      <li>Click <strong>Software Center</strong> (or <strong>Add/Remove Software</strong>).</li>
      <li>Search for your desired application (e.g., VLC, OBS Studio, GIMP, Steam).</li>
      <li>Click <strong>Install</strong> and enter your password when prompted.</li>
    </ol>

    <h2>3. Installing via Pacman (Terminal)</h2>
    <p>The native package manager is fast, efficient, and direct:</p>
    <pre><code># Search for packages
pacman -Ss package_name

# Install a package
sudo pacman -S package_name

# Remove a package and its unused dependencies
sudo pacman -Rns package_name</code></pre>

    <h2>4. Installing from the Arch User Repository (AUR)</h2>
    <p>The AUR contains tens of thousands of community-maintained software packages:</p>
    <pre><code># Search the AUR
yay -Ss software_name

# Install an AUR package
yay -S software_name</code></pre>

    <h2>5. Flatpak Integration</h2>
    <p>AcreetionOS includes pre-configured Flatpak support with Flathub enabled out of the box:</p>
    <pre><code># Install from Flathub
flatpak install flathub org.mozilla.firefox
flatpak run org.mozilla.firefox</code></pre>

    <h2>6. Troubleshooting Software Installation</h2>
    <p>If packages fail to download due to slow mirrors, update your mirrorlist using Reflector:</p>
    <pre><code>sudo reflector --latest 10 --protocol https --sort rate --save /etc/pacman.d/mirrorlist
sudo pacman -Syu</code></pre>
"""
    },
    {
        "slug": "wifi",
        "title": "WiFi Setup & Troubleshooting Guide – AcreetionOS Linux",
        "headline": "AcreetionOS WiFi Configuration & Wireless Troubleshooting Guide",
        "description": "Step-by-step guide to connecting to WiFi on AcreetionOS. Covers NetworkManager GUI setup, nmcli terminal commands, and driver troubleshooting.",
        "keywords": "AcreetionOS WiFi setup, Arch Linux WiFi troubleshooting, NetworkManager nmcli, Linux wireless drivers, Cinnamon WiFi",
        "content_html": """
    <h2>1. Connecting to WiFi on AcreetionOS</h2>
    <p>AcreetionOS uses <strong>NetworkManager</strong> with the Cinnamon network applet for seamless plug-and-play wireless connectivity across Intel, Realtek, Broadcom, and MediaTek chipsets.</p>

    <h2>2. Step-by-Step Connection via GUI</h2>
    <ol>
      <li>Look at the system tray in the bottom-right corner of your desktop.</li>
      <li>Click the <strong>Network / WiFi icon</strong>.</li>
      <li>Select your wireless network (SSID) from the list.</li>
      <li>Enter your WiFi security password and click <strong>Connect</strong>.</li>
    </ol>

    <h2>3. Connecting via Terminal (<code>nmcli</code>)</h2>
    <p>If you are configuring a headless server or prefer the command line:</p>
    <pre><code># List available WiFi access points
nmcli device wifi list

# Connect to a WiFi network
nmcli device wifi connect "Your_SSID_Name" password "Your_Password"

# Check connection status
nmcli connection show --active</code></pre>

    <h2>4. Troubleshooting Common WiFi Issues</h2>
    <h3>WiFi Device Not Showing Up</h3>
    <p>Check if your wireless card is detected by the Linux kernel:</p>
    <pre><code># Check wireless hardware
lspci -k | grep -iA 3 net
lsusb

# Check if radio is soft-blocked by rfkill
rfkill list
rfkill unblock wifi</code></pre>

    <h3>Restarting NetworkManager</h3>
    <p>If the network manager stops responding or loses connection after suspend:</p>
    <pre><code>sudo systemctl restart NetworkManager</code></pre>

    <h3>Broadcom Wireless Drivers</h3>
    <p>Certain Broadcom wireless cards (BCM43xx) require proprietary firmware:</p>
    <pre><code>sudo pacman -S broadcom-wl-dkms linux-headers</code></pre>
"""
    },
    {
        "slug": "bluetooth",
        "title": "Bluetooth Setup & Pairing Guide – AcreetionOS Linux",
        "headline": "AcreetionOS Bluetooth Pairing & Audio Configuration Guide",
        "description": "Learn how to connect Bluetooth headphones, mice, keyboards, and game controllers on AcreetionOS. Includes Bluez and Blueman troubleshooting.",
        "keywords": "AcreetionOS Bluetooth setup, Arch Linux Bluetooth headphones, Blueman Linux, bluetoothctl pairing, Cinnamon Bluetooth",
        "content_html": """
    <h2>1. Bluetooth on AcreetionOS</h2>
    <p>AcreetionOS includes the complete <code>bluez</code> stack, PipeWire audio routing, and the Blueman GUI management suite for low-latency audio, controllers, and peripherals.</p>

    <h2>2. Pairing Devices via the Graphical Interface</h2>
    <ol>
      <li>Open the Application Menu and launch <strong>Bluetooth Settings</strong> (or click the Bluetooth icon in the tray).</li>
      <li>Ensure Bluetooth is toggled <strong>ON</strong>.</li>
      <li>Put your Bluetooth device into pairing mode.</li>
      <li>Select your device from the discovered list and click <strong>Pair</strong> (or <strong>Connect</strong>).</li>
    </ol>

    <h2>3. Pairing via Command Line (<code>bluetoothctl</code>)</h2>
    <pre><code>bluetoothctl
[bluetooth]# power on
[bluetooth]# agent on
[bluetooth]# default-agent
[bluetooth]# scan on
[bluetooth]# pair XX:XX:XX:XX:XX:XX
[bluetooth]# trust XX:XX:XX:XX:XX:XX
[bluetooth]# connect XX:XX:XX:XX:XX:XX
[bluetooth]# exit</code></pre>

    <h2>4. Troubleshooting Bluetooth Audio &amp; Peripherals</h2>
    <h3>Bluetooth Service Inactive</h3>
    <p>Verify that the Bluetooth system service is active and enabled to start on boot:</p>
    <pre><code>sudo systemctl enable --now bluetooth.service
sudo systemctl status bluetooth.service</code></pre>

    <h3>Headset Audio Quality (A2DP vs HSP/HFP)</h3>
    <p>AcreetionOS uses PipeWire with LDAC, AAC, and aptX support. If your microphone switches the audio profile to mono telephone quality, open <strong>Sound Settings</strong> and set the profile to <strong>High Fidelity Playback (A2DP Sink)</strong>.</p>
"""
    },
    {
        "slug": "printer-setup",
        "title": "Printer Setup Guide – AcreetionOS CUPS & Network Printing",
        "headline": "How to Configure Printers & Scanners on AcreetionOS (CUPS)",
        "description": "Configure USB and network printers on AcreetionOS using CUPS, IPP Everywhere (driverless printing), and system-config-printer.",
        "keywords": "AcreetionOS printer setup, Arch Linux CUPS, IPP Everywhere driverless, HP printer Linux, system-config-printer",
        "content_html": """
    <h2>1. Modern Printing on AcreetionOS</h2>
    <p>AcreetionOS leverages <strong>CUPS</strong> (Common Unix Printing System) and <strong>IPP Everywhere / Apple AirPrint</strong> protocols, allowing most modern network and USB printers to work instantly without vendor-specific drivers.</p>

    <h2>2. Automated Driverless Printer Discovery</h2>
    <p>Most modern Wi-Fi printers (HP, Brother, Epson, Canon) are discovered automatically:</p>
    <ol>
      <li>Connect your printer to the same local Wi-Fi or Ethernet network.</li>
      <li>Open <strong>Printers</strong> from the Application Menu.</li>
      <li>Click <strong>Add</strong> — the system will automatically probe and configure the driverless IPP profile.</li>
      <li>Print a test page to verify connectivity.</li>
    </ol>

    <h2>3. Enabling CUPS Service in Terminal</h2>
    <pre><code>sudo systemctl enable --now cups.service
sudo pacman -S --needed cups cups-pdf system-config-printer</code></pre>

    <h2>4. HP &amp; Brother Specific Drivers</h2>
    <p>For older printers requiring proprietary drivers:</p>
    <pre><code># HP Printers & All-in-Ones:
sudo pacman -S hplip
hp-setup

# Brother Printers (available via AUR):
yay -S brother-cups-wrapper-common</code></pre>

    <h2>5. Web Management Interface</h2>
    <p>You can also manage printers directly through the CUPS web administration console by navigating to <code>http://localhost:631</code> in your web browser.</p>
"""
    },
    {
        "slug": "nvidia-drivers",
        "title": "NVIDIA Drivers Guide – AcreetionOS Graphics Configuration",
        "headline": "NVIDIA GPU Driver Installation & Configuration for AcreetionOS",
        "description": "Install and configure NVIDIA graphics drivers on AcreetionOS. Covers Turing, Ampere, Ada Lovelace, and legacy GPUs, Prime render offload, and Wayland/X11 setup.",
        "keywords": "AcreetionOS NVIDIA drivers, Arch Linux NVIDIA install, prime-run NVIDIA, nvidia-dkms, Linux gaming GPU",
        "content_html": """
    <h2>1. NVIDIA Graphics on AcreetionOS</h2>
    <p>AcreetionOS provides automated GPU detection during installation. If you need to reinstall or configure NVIDIA proprietary drivers for gaming, 3D rendering, or CUDA compute, follow this guide.</p>

    <h2>2. Identifying Your GPU Architecture</h2>
    <pre><code>lspci -k | grep -A 2 -E "(VGA|3D)"</code></pre>

    <h2>3. Installing Proprietary NVIDIA Drivers</h2>
    <p>For modern NVIDIA GPUs (GTX 16xx, RTX 20xx, 30xx, 40xx, and newer):</p>
    <pre><code># Install driver, DKMS module, and 32-bit gaming libraries
sudo pacman -S nvidia-dkms nvidia-utils lib32-nvidia-utils linux-headers nvidia-settings

# Enable NVIDIA DRM kernel mode setting
sudo sed -i 's/GRUB_CMDLINE_LINUX_DEFAULT="/&nvidia-drm.modeset=1 /' /etc/default/grub
sudo grub-mkconfig -o /boot/grub/grub.cfg</code></pre>

    <h2>4. Optimus Laptop Hybrid Graphics (Intel/AMD + NVIDIA)</h2>
    <p>On laptops with dual GPUs, AcreetionOS uses NVIDIA PRIME Render Offload to save battery. The integrated GPU powers your desktop display, while heavy 3D apps run on the dedicated NVIDIA card:</p>
    <pre><code># Run any application on the dedicated NVIDIA GPU
prime-run steam
prime-run blender</code></pre>

    <h2>5. Verifying NVIDIA Installation</h2>
    <pre><code>nvidia-smi</code></pre>
    <p>This command displays your driver version, GPU temperature, VRAM usage, and active GPU processes.</p>
"""
    },
    {
        "slug": "firewall",
        "title": "Firewall Configuration Guide – AcreetionOS Security",
        "headline": "How to Configure UFW & GUFW Firewall on AcreetionOS Linux",
        "description": "Secure your AcreetionOS system by enabling and configuring the UFW (Uncomplicated Firewall) and GUFW graphical interface. Manage ports, SSH, and gaming rules.",
        "keywords": "AcreetionOS firewall guide, Arch Linux UFW, GUFW graphical firewall, Linux port security, UFW allow SSH",
        "content_html": """
    <h2>1. Security &amp; Firewall Overview</h2>
    <p>AcreetionOS puts user privacy and security first. By default, incoming connections can be restricted with <strong>UFW</strong> (Uncomplicated Firewall) while allowing standard outgoing web browsing and downloads.</p>

    <h2>2. Enabling UFW via Command Line</h2>
    <pre><code># Install UFW if not already present
sudo pacman -S ufw

# Set secure defaults: deny incoming, allow outgoing
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Enable the firewall service on boot
sudo systemctl enable --now ufw.service
sudo ufw enable</code></pre>

    <h2>3. Allowing Specific Services &amp; Ports</h2>
    <pre><code># Allow SSH (Port 22)
sudo ufw allow ssh

# Allow Local Web Server (HTTP/HTTPS)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow KDE Connect / Phone Bridge
sudo ufw allow 1714:1764/udp
sudo ufw allow 1714:1764/tcp

# Allow Syncthing
sudo ufw allow 22000/tcp</code></pre>

    <h2>4. Graphical Firewall (GUFW)</h2>
    <p>If you prefer a visual interface, launch <strong>Firewall Configuration (GUFW)</strong> from the system menu. You can switch between Home, Office, and Public profiles with a single click.</p>

    <h2>5. Checking Firewall Status</h2>
    <pre><code>sudo ufw status verbose</code></pre>
"""
    }
]


def render_guide_html(guide):
    slug = guide["slug"]
    title = guide["title"]
    headline = guide["headline"]
    description = guide["description"]
    keywords = guide["keywords"]
    content_html = guide["content_html"]

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="msvalidate.01" content="8738943710B70112309DBE6476B55A91">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1">
  <title>{title}</title>
  <meta name="description" content="{description}">
  <meta name="keywords" content="{keywords}">
  <link rel="canonical" href="{BASE_URL}/wiki-guides/{slug}.html">
  <link rel="alternate" type="application/atom+xml" title="AcreetionOS News" href="{BASE_URL}/feed.xml">

  <!-- OpenGraph Meta Tags -->
  <meta property="og:type" content="article">
  <meta property="og:url" content="{BASE_URL}/wiki-guides/{slug}.html">
  <meta property="og:title" content="{title}">
  <meta property="og:description" content="{description}">
  <meta property="og:image" content="{BASE_URL}/og-image.png">
  <meta property="og:site_name" content="AcreetionOS">

  <!-- Twitter Cards -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="@acreetionos">
  <meta name="twitter:title" content="{title}">
  <meta name="twitter:description" content="{description}">
  <meta name="twitter:image" content="{BASE_URL}/og-image.png">

  <link rel="icon" type="image/webp" href="../acreetionoslogo.webp">
  <link rel="stylesheet" href="../fonts.css">

  <script type="application/ld+json">
  {{
    "@context": "https://schema.org",
    "@graph": [
      {{
        "@type": "TechArticle",
        "@id": "{BASE_URL}/wiki-guides/{slug}.html#article",
        "headline": "{headline}",
        "description": "{description}",
        "url": "{BASE_URL}/wiki-guides/{slug}.html",
        "inLanguage": "en",
        "datePublished": "2026-08-14T00:00:00+00:00",
        "dateModified": "2026-08-16T00:00:00+00:00",
        "publisher": {{
          "@type": "Organization",
          "name": "AcreetionOS",
          "url": "{BASE_URL}",
          "logo": {{
            "@type": "ImageObject",
            "url": "{BASE_URL}/logo.webp"
          }}
        }},
        "mainEntityOfPage": "{BASE_URL}/wiki-guides/{slug}.html",
        "articleSection": "Linux Guides & Documentation"
      }},
      {{
        "@type": "BreadcrumbList",
        "@id": "{BASE_URL}/wiki-guides/{slug}.html#breadcrumb",
        "itemListElement": [
          {{
            "@type": "ListItem",
            "position": 1,
            "name": "Home",
            "item": "{BASE_URL}/"
          }},
          {{
            "@type": "ListItem",
            "position": 2,
            "name": "Wiki",
            "item": "{BASE_URL}/wiki.html"
          }},
          {{
            "@type": "ListItem",
            "position": 3,
            "name": "Guides",
            "item": "{BASE_URL}/wiki-guides/index.html"
          }},
          {{
            "@type": "ListItem",
            "position": 4,
            "name": "{slug.replace('-', ' ').title()}",
            "item": "{BASE_URL}/wiki-guides/{slug}.html"
          }}
        ]
      }}
    ]
  }}
  </script>

  <style>
    :root {{
      --green: #2ecc71;
      --bg: #121212;
      --panel: #1a1a1a;
      --border: #333;
      --text: #ddd;
      --muted: #888;
      --font-sans: 'Roboto', system-ui, sans-serif;
      --font-mono: 'Fira Code', monospace;
    }}
    * {{ box-sizing: border-box; }}
    body {{
      font-family: var(--font-sans);
      max-width: 820px;
      margin: 2rem auto;
      padding: 0 1.25rem 3rem;
      line-height: 1.7;
      color: var(--text);
      background: var(--bg);
    }}
    h1 {{ color: var(--green); font-size: 1.85rem; margin-bottom: 0.5rem; }}
    h2 {{ color: var(--green); font-size: 1.35rem; margin-top: 2rem; margin-bottom: 0.75rem; border-bottom: 1px solid var(--border); padding-bottom: 0.4rem; }}
    h3 {{ color: #a3e635; font-size: 1.1rem; margin-top: 1.4rem; margin-bottom: 0.5rem; }}
    p {{ margin: 0.8rem 0; }}
    ul, ol {{ margin: 0.8rem 0 1rem 1.75rem; }}
    li {{ margin-bottom: 0.4rem; }}
    pre {{
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1rem;
      overflow-x: auto;
      font-family: var(--font-mono);
      font-size: 0.92rem;
      margin: 1rem 0;
    }}
    code {{
      background: var(--panel);
      border: 1px solid #292929;
      padding: 0.15rem 0.4rem;
      border-radius: 4px;
      font-family: var(--font-mono);
      font-size: 0.9em;
      color: #7ee787;
    }}
    pre code {{ border: none; padding: 0; background: transparent; color: inherit; }}
    a {{ color: var(--green); text-decoration: none; }}
    a:hover {{ text-decoration: underline; }}
    .back {{ display: inline-flex; align-items: center; gap: 0.4rem; margin-bottom: 1.5rem; font-weight: 500; }}
    .breadcrumbs {{ font-size: 0.85rem; color: var(--muted); margin-bottom: 1.5rem; }}
    .breadcrumbs a {{ color: var(--muted); }}
    .breadcrumbs a:hover {{ color: var(--green); }}
    .note {{
      background: rgba(46, 204, 113, 0.08);
      border-left: 4px solid var(--green);
      padding: 1rem 1.2rem;
      border-radius: 4px;
      margin: 2rem 0;
      font-size: 0.95rem;
    }}
    footer {{
      margin-top: 3rem;
      padding-top: 1.5rem;
      border-top: 1px solid var(--border);
      color: var(--muted);
      font-size: 0.88rem;
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 1rem;
    }}
  </style>
</head>
<body>
  <div class="breadcrumbs">
    <a href="../index.html">Home</a> &gt; <a href="../wiki.html">Wiki</a> &gt; <a href="index.html">Guides</a> &gt; <span>{slug.replace('-', ' ').title()}</span>
  </div>

  <a class="back" href="index.html">← Back to Wiki Guides Index</a>

  <article>
    <h1>{headline}</h1>
    <p style="color: var(--muted); font-size: 0.95rem; margin-bottom: 1.5rem;">Official AcreetionOS Documentation &amp; Step-by-Step Tutorial</p>
    {content_html}
  </article>

  <div class="note">
    <strong>Need additional help?</strong> Search the <a href="../wiki.html">Interactive AI Wiki</a> or connect with our community on the <a href="https://discord.gg/VHqQkJASw7" target="_blank" rel="noopener noreferrer">AcreetionOS Discord Server</a>.
  </div>

  <footer>
    <div>&copy; 2026 AcreetionOS Project. Open Source under GPLv3.</div>
    <div>
      <a href="../docs.html">All Documentation</a> · <a href="../faq.html">FAQ</a> · <a href="../index.html">Official Website</a>
    </div>
  </footer>
</body>
</html>"""


def render_index_html(guides):
    list_items = []
    for g in guides:
        slug = g["slug"]
        title = g["headline"]
        desc = g["description"]
        list_items.append(f"""    <li class="guide-card">
      <a href="{slug}.html">
        <h2>{title}</h2>
      </a>
      <p>{desc}</p>
      <a class="read-btn" href="{slug}.html">Read Step-by-Step Guide →</a>
    </li>""")

    items_html = "\n".join(list_items)

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="msvalidate.01" content="8738943710B70112309DBE6476B55A91">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1">
  <title>AcreetionOS Wiki Guides – Arch Linux Step-by-Step Tutorials</title>
  <meta name="description" content="Explore essential step-by-step guides for AcreetionOS: WiFi setup, software installation, NVIDIA GPU drivers, system maintenance, Bluetooth, and firewall configuration.">
  <meta name="keywords" content="AcreetionOS guides, Arch Linux tutorials, Linux beginners guide, Cinnamon desktop guides, AcreetionOS troubleshooting">
  <link rel="canonical" href="{BASE_URL}/wiki-guides/index.html">
  <link rel="alternate" type="application/atom+xml" title="AcreetionOS News" href="{BASE_URL}/feed.xml">

  <!-- OpenGraph -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="{BASE_URL}/wiki-guides/index.html">
  <meta property="og:title" content="AcreetionOS Wiki Guides – Step-by-Step Arch Linux Tutorials">
  <meta property="og:description" content="Explore essential guides for AcreetionOS: WiFi, software installation, NVIDIA drivers, maintenance, and security.">
  <meta property="og:image" content="{BASE_URL}/og-image.png">
  <meta property="og:site_name" content="AcreetionOS">

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="@acreetionos">
  <meta name="twitter:title" content="AcreetionOS Wiki Guides">
  <meta name="twitter:description" content="Step-by-step tutorials and configuration guides for AcreetionOS Linux.">
  <meta name="twitter:image" content="{BASE_URL}/og-image.png">

  <link rel="icon" type="image/webp" href="../acreetionoslogo.webp">
  <link rel="stylesheet" href="../fonts.css">

  <script type="application/ld+json">
  {{
    "@context": "https://schema.org",
    "@graph": [
      {{
        "@type": "CollectionPage",
        "@id": "{BASE_URL}/wiki-guides/index.html#collection",
        "name": "AcreetionOS Wiki Guides",
        "description": "Collection of official step-by-step configuration and maintenance guides for AcreetionOS Linux.",
        "url": "{BASE_URL}/wiki-guides/index.html",
        "isPartOf": {{
          "@id": "{BASE_URL}/#website"
        }}
      }},
      {{
        "@type": "BreadcrumbList",
        "@id": "{BASE_URL}/wiki-guides/index.html#breadcrumb",
        "itemListElement": [
          {{
            "@type": "ListItem",
            "position": 1,
            "name": "Home",
            "item": "{BASE_URL}/"
          }},
          {{
            "@type": "ListItem",
            "position": 2,
            "name": "Wiki",
            "item": "{BASE_URL}/wiki.html"
          }},
          {{
            "@type": "ListItem",
            "position": 3,
            "name": "Guides",
            "item": "{BASE_URL}/wiki-guides/index.html"
          }}
        ]
      }}
    ]
  }}
  </script>

  <style>
    :root {{
      --green: #2ecc71;
      --bg: #121212;
      --panel: #1a1a1a;
      --border: #333;
      --text: #ddd;
      --muted: #888;
      --font-sans: 'Roboto', system-ui, sans-serif;
    }}
    * {{ box-sizing: border-box; }}
    body {{
      font-family: var(--font-sans);
      max-width: 860px;
      margin: 2rem auto;
      padding: 0 1.25rem 3rem;
      line-height: 1.6;
      color: var(--text);
      background: var(--bg);
    }}
    h1 {{ color: var(--green); font-size: 2rem; margin-bottom: 0.5rem; }}
    p.lead {{ color: var(--muted); font-size: 1.05rem; margin-bottom: 2rem; }}
    .breadcrumbs {{ font-size: 0.85rem; color: var(--muted); margin-bottom: 1.5rem; }}
    .breadcrumbs a {{ color: var(--muted); text-decoration: none; }}
    .breadcrumbs a:hover {{ color: var(--green); }}
    ul.guide-list {{ list-style: none; padding: 0; display: grid; grid-template-columns: 1fr; gap: 1.25rem; }}
    .guide-card {{
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.5rem;
      transition: transform 0.2s ease, border-color 0.2s ease;
    }}
    .guide-card:hover {{
      transform: translateY(-2px);
      border-color: var(--green);
    }}
    .guide-card h2 {{
      color: var(--green);
      font-size: 1.25rem;
      margin: 0 0 0.5rem 0;
    }}
    .guide-card p {{
      color: #bbb;
      margin: 0 0 1rem 0;
      font-size: 0.95rem;
    }}
    .read-btn {{
      color: var(--green);
      font-weight: bold;
      text-decoration: none;
      font-size: 0.95rem;
      display: inline-block;
    }}
    .read-btn:hover {{ text-decoration: underline; }}
    footer {{
      margin-top: 3.5rem;
      padding-top: 1.5rem;
      border-top: 1px solid var(--border);
      color: var(--muted);
      font-size: 0.88rem;
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 1rem;
    }}
    footer a {{ color: var(--green); text-decoration: none; }}
  </style>
</head>
<body>
  <div class="breadcrumbs">
    <a href="../index.html">Home</a> &gt; <a href="../wiki.html">Wiki</a> &gt; <span>Guides</span>
  </div>

  <h1>AcreetionOS Wiki Guides</h1>
  <p class="lead">Step-by-step tutorials and official documentation for AcreetionOS (Arch Linux &amp; Cinnamon Desktop).</p>

  <ul class="guide-list">
{items_html}
  </ul>

  <div style="margin-top: 2.5rem; text-align: center;">
    <a href="../wiki.html" style="color: var(--green); text-decoration: none; font-size: 1.05rem;">
      🔍 Looking for something else? Try the <strong>Interactive AI Wiki Search →</strong>
    </a>
  </div>

  <footer>
    <div>&copy; 2026 AcreetionOS Project. Open Source under GPLv3.</div>
    <div>
      <a href="../docs.html">Documentation</a> · <a href="../faq.html">FAQ</a> · <a href="../index.html">Home</a>
    </div>
  </footer>
</body>
</html>"""


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    print(f"Generating {len(GUIDES_DATA)} static wiki guides in '{OUT_DIR}'...")

    for guide in GUIDES_DATA:
        slug = guide["slug"]
        filepath = os.path.join(OUT_DIR, f"{slug}.html")
        content = render_guide_html(guide)
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"  + Generated: wiki-guides/{slug}.html")

    index_path = os.path.join(OUT_DIR, "index.html")
    with open(index_path, "w", encoding="utf-8") as f:
        f.write(render_index_html(GUIDES_DATA))
    print(f"  + Generated: wiki-guides/index.html")
    print("All wiki guides generated successfully.")


if __name__ == "__main__":
    main()
