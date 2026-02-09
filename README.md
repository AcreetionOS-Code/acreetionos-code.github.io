# AcreetionOS Website

Official website for AcreetionOS Linux, hosted via GitHub Pages.

## Tech Stack

- Plain HTML5, CSS3, JavaScript (no framework)
- GitHub Pages deployment
- Playwright for local Firefox testing

## Development

### Local Preview

```bash
python3 -m http.server 8000
# Visit http://localhost:8000
```

### Local Firefox Testing

**Prerequisites:** Node.js, npm, Firefox

```bash
cd /drive1/Projects/acreetionos-linux.github.io
bash tests/run_firefox_local.sh
```

Or manually:
```bash
npm install
npm run test:firefox
```

### CI/CD

Automated checks on push/PR:
- Link checking (Lychee)
- HTML5 validation
- Accessibility audits (pa11y-ci)

**Note:** Firefox browser tests are local-only and do NOT run in CI.

## Structure

```
.
├── index.html          # Main landing page
├── contact.html        # Contact & support page
├── contact.js          # Contact form logic
├── contact.css         # Contact page styles
├── selfhelp.html       # Self-help tool
├── wiki/               # Wiki content (if any)
└── tests/              # Playwright tests (local Firefox)
```

## Deployment

Automatic deployment to GitHub Pages from `main` branch.

**Custom domain:** acreetionos.org (configured via CNAME)

## Contributing

1. Create a feature branch from `natalie` or `main`
2. Make changes
3. Test locally with Firefox: `bash tests/run_firefox_local.sh`
4. Open PR

## License

See [LICENSE](LICENSE)
