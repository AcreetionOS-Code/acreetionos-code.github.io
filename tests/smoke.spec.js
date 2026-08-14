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
  '/git-tracker.html',
  '/governance.html',
  '/hosting.html',
  '/immutable.html',
  '/lightweight.html',
  '/newsletter.html',
  '/privacy.html',
  '/requirements.html',
  '/status.html',
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
