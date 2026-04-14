# Deployment Guide

## Overview

AcreetionOS website is deployed to two platforms for redundancy and performance.

## GitHub Pages (Primary)

### Setup
1. Repository: `AcreetionOS-Code/acreetionos-code.github.io`
2. Branch: `main`
3. Folder: `/ (root)`

### Deployment Process
1. Push changes to `main` branch
2. GitHub Actions workflow triggers (`.github/workflows/`)
3. Static files served at `https://acreetionos.org`

### Custom Domain
- Domain: `acreetionos.org`
- Configured in GitHub repository settings
- CNAME file in repository root

## Cloudflare Pages (Secondary)

### Setup
```bash
# Install Wrangler CLI
npm install -g wrangler

# Preview deployment
wrangler pages deploy

# Production deployment
wrangler pages deploy --prod
```

### Configuration
See `wrangler.jsonc` for project settings.

## CDN & Mirrors

### Static Assets
- Images served via GitHub Pages CDN
- Large ISOs mirrored by partners:
  - OSUOSL (Oregon State University)
  - RWTH Aachen University
  - Community mirrors (France)
  <!-- Romania mirror removed due to excessive downtime -->

### External Services
- Qwant: `https://www.qwant.com/` (search)
- Nextcloud: `nextcloud.acreetionos.org` (file hosting)

## DNS Configuration

```
acreetionos.org          A       [Cloudflare IP]
www.acreetionos.org      CNAME   acreetionos.org
iso.acreetionos.org      CNAME   [ISO server]
# searx.acreetionos.org    CNAME   [SearX instance] (deprecated, replaced by Qwant)
```

## Maintenance

### SSL/TLS
- Managed by Cloudflare (Universal SSL)
- Automatic HTTPS redirects

### Cache Headers
- HTML: no-cache (always fresh)
- CSS/JS: max-age=31536000 (1 year, via GitHub Pages)
- Images: max-age=604800 (1 week)

## Backup

### What to Back Up
- Git repository (already versioned)
- DNS configuration
- Cloudflare settings

### Recovery Procedure
1. Restore DNS from Cloudflare dashboard
2. Push latest commit to GitHub
3. Verify SSL certificates
4. Test all mirrors are accessible
