# AcreetionOS: The User-Friendly Arch Linux Experience

**AcreetionOS** is a modern, privacy-focused Linux distribution built on the powerful **Arch Linux** foundation. Designed for stability and ease of use, it bridges the gap between the bleeding-edge performance of Arch and the reliability required for daily driving.

![AcreetionOS Logo](https://acreetionos.org/logo.webp)

## Why AcreetionOS?

AcreetionOS is engineered for users who want the power of Arch without the hassle. We prioritize **System Sovereignty** and a "human-first" approach to open source.

- **🔰 Beginner Friendly:** A pre-configured **Cinnamon Desktop** environment that feels familiar and intuitive immediately after installation.
- **🚀 High Performance:** Optimized specifically for modern hardware with low-latency kernels and the **Pipewire** audio subsystem.
- **🛡️ Privacy & Stability:** We utilize **XLibre (X11)** for maximum compatibility and stability, avoiding the teething issues of early Wayland adoption.
- **📦 Rolling Release:** Install once, update forever. Always have the latest software without needing to reinstall your OS every six months.

## Technical Highlights

| Feature | Specification |
|---------|--------------|
| **Base** | Arch Linux (Rolling) |
| **Desktop** | Cinnamon (Customized) |
| **Display Server** | XLibre / X11 (Reliability Focus) |
| **Audio** | Pipewire |
| **Filesystem** | EXT4 (Proven Stability) |
| **Bootloader** | GRUB + Systemd-boot |

---

## Development & Contributing

This website is the central hub for the AcreetionOS community, hosted via GitHub Pages.

### Tech Stack

- **Frontend:** Pure HTML5, CSS3, JavaScript (No heavy frameworks)
- **Testing:** Playwright for Firefox-specific validation
- **Deployment:** Automated via GitHub Actions

### Project Structure

The site is plain static files -- there is no build step for the pages themselves, and everything is served as-is (custom domain in `CNAME`).

- **Pages** -- every page is a single `.html` file in the repo root: `index.html` (the homepage), `flash.html` (downloads), `immutable.html`, `lightweight.html`, `beginner.html`, `status.html`, `changelog.html`, and so on. `404.html` is the error page.
- **Shared CSS** -- `styles.css` holds the site's global styles and design variables; `sidebar.css` styles the header, sidebar, and navigation. Page-specific styles live in their own files next to the pages that use them (for example `contact.css`).
- **Shared JavaScript** -- `sidebar.js` builds the header and sidebar navigation on every page; `footer.js`, `social-icons.js`, and `back-to-top.js` are shared components, and `sw.js` is the service worker. Page-specific behavior lives in `<page>-page.js` files (for example `flash-page.js`) or in a file named after its page (for example `faq.js`).
- **`vendor/`** -- third-party code we ship but don't maintain; currently the Instantpage prefetch library.
- **`docs/`** -- project documentation in Markdown: architecture, contributing, deployment, governance, security, and troubleshooting guides.
- **`wiki-guides/`** -- the wiki's guide pages, served as static HTML.
- **`Reviews/`** -- one page per community review video, plus an index page.
- **`newsletters/` and `newsletter-archive/`** -- newsletter issues are stored as JSON data in `newsletters/` (with `list.json` and `status.json` as indexes) and rendered into static pages in `newsletter-archive/` by the generator scripts.
- **`scripts/`** -- maintenance and deployment utilities: the sitemap, feed, and robots generators, the newsletter generators, ISO scanning and upload helpers, and search-engine submission scripts.
- **`tests/`** -- the Playwright smoke test suite; see "Running Tests" below.
- **`frontend/`** -- a small Vite sub-project, separate from the static pages.
- **Site metadata** -- `robots.txt`, `sitemap.xml`, `feed.xml`, `llms.txt`, `.well-known/` (including `security.txt`), and `_headers` / `_redirects` for the hosting edge rules.

### Local Development

To run the website locally for testing or development:

```bash
# Clone the repository
git clone https://github.com/AcreetionOS-Code/acreetionos-code.github.io.git
cd acreetionos-code.github.io

# Start a local server
python3 -m http.server 8000
# Access at http://localhost:8000
```

### Running Tests

We prioritize Firefox compatibility. To run the smoke test suite:

```bash
# Install dependencies (includes @playwright/test + wrangler for worker deploys)
npm install

# Install the Firefox browser runtime (once)
npm run install:browsers

# Run the tests
npm test
```

The suite serves the repo with `python3 -m http.server` and verifies every
public page returns 200 with a title, and that the homepage loads without
console errors. Test files live in `tests/`.

## Community

AcreetionOS is a community-driven project. We believe in transparency and the separation of identity from technical merit.

- **[Discord Community](https://discord.acreetionos.org)**
- **[Wiki Documentation](wiki.html)**
- **[Source Code](https://github.com/AcreetionOS-Code)**

## License

AcreetionOS is open-source software. See [LICENSE](LICENSE) for details.
