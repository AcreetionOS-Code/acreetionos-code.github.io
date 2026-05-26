// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const pages = [
  '/compare.html',
  '/contact.html',
  '/faq.html',
  '/blog.html',
  '/install.html',
  '/governance.html',
  '/contributing.html',
  '/', // index.html
  '/mastodon.html',
  '/wiki.html',
  '/selfhelp.html',
  '/migrated.html',
  '/requirements.html',
  '/gitlab.html',
  '/git-tracker.html',
  '/docs.html',
  '/ermin.html',
  '/developers.html',
  '/bsky.html',

  '/404.html'
];

test.describe('Comprehensive Page Loading Test', () => {
  for (const pagePath of pages) {
    test(`page ${pagePath} should load without errors`, async ({ page }) => {
      const response = await page.goto(pagePath);
      
      // Check for 200 OK (or 404 if it's the 404 page)
      if (pagePath === '/404.html') {
          // Note: when navigating directly to 404.html, the server might still return 200.
          // But we just want to see if it renders.
          expect(response?.status()).toBe(200);
      } else {
          expect(response?.status()).toBe(200);
      }

      // Check for common branding elements to ensure layout rendered
      const logo = page.locator('.logo-img');
      const logoText = page.locator('.logo-text');
      
      // Some pages might have a different structure, but most AcreetionOS pages share this
      if (await logo.count() > 0) {
        await expect(logo).toBeVisible();
      }
      
      // Check for console errors
      page.on('console', msg => {
        if (msg.type() === 'error') {
          console.log(`PAGE ERROR [${pagePath}]: "${msg.text()}"`);
        }
      });
    });
  }
});

test.describe('Broken Link Checker', () => {
  test('check for broken internal links on homepage', async ({ page }) => {
    await page.goto('/');
    const links = await page.locator('a').all();
    for (const link of links) {
      const href = await link.getAttribute('href');
      if (href && !href.startsWith('http') && !href.startsWith('#') && !href.startsWith('mailto:')) {
        const response = await page.request.get(href);
        expect(response.status(), `Link ${href} is broken`).toBe(200);
      }
    }
  });
});
