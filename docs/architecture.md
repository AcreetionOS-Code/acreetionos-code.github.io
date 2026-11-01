# Website Architecture

AcreetionOS website is a static HTML/CSS/JS site hosted on GitHub Pages, built for simplicity, performance, and maintainability.

## Stack

| Component | Technology |
|-----------|------------|
| **HTML** | Semantic HTML5 |
| **CSS** | Vanilla CSS (no frameworks) |
| **JavaScript** | Vanilla JS (no frameworks) |
| **Hosting** | GitHub Pages |
| **Testing** | Playwright (Firefox) |
| **CDN** | jsdelivr (for marked.js) |

## Directory Structure

```
/
├── index.html           # Main landing page
├── *.html               # Public pages and root-route compatibility copies
├── pages/                # Organized copies of root HTML pages
├── assets/
│   ├── fonts/            # Web fonts
│   └── icons/            # Icon fonts
├── css/
│   ├── vendor/           # Third-party stylesheets
│   └── *.css             # Site stylesheets
├── js/
│   ├── vendor/           # Third-party scripts
│   └── *.js              # Site scripts and Cloudflare Worker entry
├── Reviews/              # Community reviews
├── newsletter-archive/   # Published newsletter pages
├── wiki-guides/          # Individual wiki guides
├── docs/                 # Project documentation
├── frontend/             # Vite development wrapper
├── tests/                # Playwright tests
├── sw.js                 # Root-scoped service worker
├── wrangler.toml         # Cloudflare Worker configuration
└── package.json          # Node dependencies
```

GitHub Pages serves the repository root directly. Root page and static-file copies remain available for existing public URLs; organized pages and assets use the directories above.

## Key Files

### Core Pages
- `index.html` - Main landing page with downloads, team info, specs
- `install.html` - Step-by-step installation guide
- `faq.html` - Frequently asked questions
- `contact.html` - Contact form and community links

### Static Assets
- `css/contact.css` - Shared stylesheet for all pages
- `sw.js` - Service worker for offline caching (PWA)
- `*.ttf`, `*.woff` - Custom fonts (FreeFont family)

## Styling

### Design System

CSS variables defined in `:root`:

```css
:root {
  --acreetion-green: #2ecc71;      /* Primary accent */
  --acreetion-body-bg: #121212;   /* Dark background */
  --acreetion-panel-bg: #1a1a1a;  /* Panel background */
  --acreetion-box-bg: #222222;     /* Content boxes */
  --acreetion-box-border: #333333; /* Borders */
  --acreetion-text-bright: #e5e5e5; /* Primary text */
  --acreetion-text: #b2b2b2;       /* Secondary text */
  --storm-color: #61afef;          /* Storm OS accent */
  --flasher-color: #f39c12;       /* Flasher tool accent */
}
```

### Responsive Breakpoints
- `1024px` - Tablet: single column layout
- `768px` - Mobile: stacked navigation

## JavaScript Features

### Service Worker (sw.js)
- Caches static assets for offline access
- Enables PWA-like experience

### Search (index.html)
- Form posts to Qwant at `https://www.qwant.com/`
- Uses `target="_blank"` for search results

### Modals
- Donation modal triggered via `data-modal-target`
- CSS-based visibility toggle

### External Dependencies
- `marked.min.js` (jsdelivr CDN) - Markdown rendering for blog

## SEO & Metadata

### Structured Data
- JSON-LD in `<head>` for Organization, SoftwareApplication, FAQPage
- Open Graph and Twitter Card meta tags

### Meta Tags
- Canonical URLs
- Description and keywords
- CSP header via meta tag

## Performance

### Optimizations
- `loading="lazy"` on below-fold images
- `fetchpriority="high"` on hero images
- Preconnect hints for Google Fonts
- Font display swap via media query

### Offline Support
- Service worker caches core pages
- Graceful fallback when offline

## Testing

### Playwright (Firefox)
```bash
npm install
bash tests/run_firefox_local.sh
```

### Local Development
```bash
python3 -m http.server 8000
# Access at http://localhost:8000
```

## Deployment

### GitHub Pages
1. Push to `main` branch
2. GitHub Actions builds and deploys
3. Available at `acreetionos.org`

### Cloudflare Pages
- Alternative deployment via `wrangler.jsonc`
- Configured in Cloudflare dashboard

## Adding New Pages

1. Copy existing HTML structure
2. Update `<title>` and meta tags
3. Link from navigation in header
4. Add to sitemap.xml

## Content Guidelines

- Use semantic HTML (article, section, nav, aside)
- Avoid inline styles; use shared CSS classes
- Test on Firefox primary
- Mobile-first responsive design
- No JavaScript frameworks
