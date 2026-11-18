# AcreetionOS: Arch Linux With a Safety Buffer

**AcreetionOS** is Arch Linux with a safety buffer -- a beginner-friendly Cinnamon desktop where every update is tested for a week before it reaches you, X11 and XLibre stay alive, and nothing about you is ever collected.

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

### External content and licensing

Parts of this site aggregate documentation from other open-source projects (for example, other distributions' wikis). We follow each source's license exactly:

- Where a source's license allows its content to be copied, we may include the content here, with credit to the source.
- Where a source's license does **not** allow copying, the content is never copied. It is embedded from the original site instead, with credit.

Every embed carries its reason in two places: a visible note next to the embedded content explaining why it is embedded rather than copied, and an HTML comment in the page source recording the same reason for developers:

```html
<!-- Embed reason: this content is embedded, not copied, because the
     source's license does not allow it to be taken. Original page,
     shown with credit: [source name] -- [original URL] -->
```

### Workflow for latest contributors (read this first)

This is the workflow we use — it matches `AGENTS.md:1-8` and keeps `main` releasable. Follow it for every change.

1. **File the issue first.** `gh issue create` (or GitHub UI). Assign to yourself. Body must state the problem, what "done" looks like, and the **approach being attempted** — posted as a comment on the issue before any code exists.
2. **Branch off `development` (or `main` if `development` doesn't exist yet).** Never commit directly to `main` or `development`. Prefixes: `features/`, `bug/`, `build/`, `automation/`.
3. **Comment the "why" in the code**, not the "what". Future readers need the reasoning.
4. **Commit with an appropriate message**, then add a **`git notes`** on the commit explaining why the change was made.
5. **Comment on the issue** with why the changes were made and link the branch.
6. **Open a PR back into `development`** (not `main`) referencing the issue. The PR is what gets reviewed. **Nothing merges to `main` until the maintainer says so** — `development` is then PR'd into `main`.
7. **Update the project board** when the repo has one (see below).
8. **One thing at a time.** Do not bundle unrelated work into the same branch.

Other rules we enforce in review:

- **Run it before you claim it works** — `npm test` (Playwright, Firefox) must pass; show real output.
- **Non-interactive shell flags** — `cp -f`, `mv -f`, `rm -f`, `rm -rf`, `scp -o BatchMode=yes`, `ssh -o BatchMode=yes` (bare `cp`/`mv`/`rm` hang on prompts).
- **Branching & testing:** `other branches → development → main`. Anything pushed to `development` is automatically built to **`https://testing-website.acreetionos.org`** — preview there. See `AGENTS.md` for the full maintainer checklist.

### Branching & deployment

All feature work goes in `features/*`, `bug/*`, `build/*`, or `automation/*` branches — never direct to `main`/`development`. The flow is:

```
other branches → development → main
```

- **`development`** is the integration branch. Every feature/bug branch is PR'd into `development` first, built and tested there, then `development` is PR'd into `main`.
- **`main`** is production (`https://acreetionos.org`, deployed via GitHub Pages + Cloudflare).
- **Testing deployments:** anything pushed to `development` is automatically built and published to **`https://testing-website.acreetionos.org`** — if you want to see a testing deployment, look there for the latest `development` build. To preview a feature, merge/PR it into `development` and check the testing site.

### Quarterly documentation & project boards

- **Milestone [`quarterly-documentation`](https://github.com/AcreetionOS-Code/acreetionos-code.github.io/milestone/3)** — the documentation database for how the website is laid out and how it works (pages, shared CSS/JS, `vendor/`, `wiki-guides/`, `newsletter-archive/`, scripts, tests, metadata, workflows). Issues labeled `quarterly-documentation` live here and are worked quarterly.
- **Sprint [`Sprint — docs workflow & testing preview`](https://github.com/AcreetionOS-Code/acreetionos-code.github.io/milestone/4)** — current sprint tracking `#667`–`#671` (GTM, disclosure, testing preview, this workflow doc).
- **Sprint [`Sprint — project boards`](https://github.com/AcreetionOS-Code/acreetionos-code.github.io/milestone/5)** — next sprint to set up GitHub Project boards (To do / In Progress / Done), link issues, and automate moves on PR close. Update the board on every PR as required by the workflow above.

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

### Building everything (sitemaps, feeds, archives)

The site is mostly static, but a few generated files must be rebuilt before pushing:

```bash
python3 scripts/gen-sitemap.py        # -> sitemap.xml (now includes analytics.html)
python3 scripts/gen-sitemap-index.py  # -> sitemap_index.xml
python3 scripts/gen-feed.py           # -> feed.xml
python3 scripts/gen-robots.py         # -> robots.txt
python3 scripts/gen-newsletter-archive.py  # -> newsletter-archive/
python3 scripts/gen-wiki-guides.py         # -> wiki-guides/
```

CI does not regenerate these — commit the result so `main` and `development` are deployable as-is.

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
