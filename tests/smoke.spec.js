// @ts-check
const { test, expect } = require('@playwright/test');

// Every public page that must load. Keep in sync with sitemap.xml.
const PAGES = [
  '/',
  '/about.html',
  '/beginner.html',
  '/changelog.html',
  '/community-reviews.html',
  '/compare.html',
  '/contact.html',
  '/contributors.html',
  '/docs.html',
  '/faq.html',
  '/features.html',
  '/flash.html',
  '/governance.html',
  '/hosting.html',
  '/immutable.html',
  '/lightweight.html',
  '/newsletter.html',
  '/privacy.html',
  '/reader.html',
  '/requirements.html',
  '/status.html',
  '/translator.html',
  '/unofficial.html',
  '/wiki.html',
];

test('homepage loads with a title', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/AcreetionOS/i);
});

test('homepage has no console errors on load', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  await page.goto('/');
  // Allow client-side JS to run before asserting.
  await page.waitForTimeout(1500);
  expect(errors.filter((e) => !e.includes('Failed to fetch'))).toEqual([]);
});

for (const path of PAGES) {
  test(`page ${path} returns 200 with a non-empty title`, async ({ page }) => {
    const res = await page.goto(path);
    expect(res.status()).toBe(200);
    // page.title() returns document.title; avoids toHaveText's whitespace
    // normalization edge cases with multi-line <title> tags.
    const title = (await page.title()).trim();
    expect(title.length).toBeGreaterThan(0);
  });
}

test('reader renders an ingested document without its chrome', async ({ page }) => {
  await page.goto('/reader.html?src=wiki-guides/wifi.html&source=Test%20Wiki');
  await expect(page.locator('#reader-article')).toBeVisible();
  await expect(page.locator('#reader-title')).not.toBeEmpty();
  await expect(page.locator('#reader-source')).toContainText('Test Wiki');
  await expect(page.locator('#reader-content script')).toHaveCount(0);
});

test('reader refuses an off-site document', async ({ page }) => {
  await page.goto('/reader.html?src=https://example.com/page.html');
  await expect(page.locator('#reader-status')).toBeVisible();
  await expect(page.locator('#reader-status')).toContainText(/license/i);
  await expect(page.locator('#reader-article')).toBeHidden();
});

test('reader explains itself with no document given', async ({ page }) => {
  await page.goto('/reader.html');
  await expect(page.locator('#reader-intro')).toBeVisible();
});
