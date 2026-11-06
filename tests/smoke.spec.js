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
  '/private-browsing-myths.html',
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

for (const path of ['/', '/status.html', '/private-browsing-myths.html', '/immutable.html']) {
  test(`search bar fits mobile viewport on ${path}`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(path);

    const bounds = await page.locator('.search-strip').evaluate((strip) => {
      const container = strip.querySelector('.search-container').getBoundingClientRect();
      const input = strip.querySelector('.search-input').getBoundingClientRect();
      const button = strip.querySelector('.search-btn').getBoundingClientRect();
      return {
        containerRight: container.right,
        inputHeight: input.height,
        inputRight: input.right,
        buttonHeight: button.height,
        buttonLeft: button.left,
        buttonRight: button.right,
      };
    });

    expect(bounds.inputHeight).toBe(48);
    expect(bounds.buttonHeight).toBe(48);
    expect(bounds.inputRight).toBeLessThanOrEqual(bounds.buttonLeft);
    expect(bounds.buttonRight).toBeLessThanOrEqual(bounds.containerRight + 1);
  });
}

for (const path of ['/', '/private-browsing-myths.html', '/immutable.html']) {
  test(`mobile hamburger opens site navigation on ${path}`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(path);

    const hamburger = page.locator('#hamburger');
    await expect(hamburger).toBeVisible();
    const mainBounds = await page.locator('main').boundingBox();
    await hamburger.click();
    await expect(page.locator('#sidebar')).toHaveClass(/open/);
    await expect(hamburger).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#sidebar-overlay')).toHaveClass(/open/);
    expect(await page.locator('main').boundingBox()).toEqual(mainBounds);

    await page.locator('.sidebar-close').click();
    await expect(page.locator('#sidebar')).not.toHaveClass(/open/);
    await expect(hamburger).toHaveAttribute('aria-expanded', 'false');

    await hamburger.click();
    await page.keyboard.press('Escape');
    await expect(page.locator('#sidebar')).not.toHaveClass(/open/);

    await hamburger.click();
    await page.locator('#sidebar-overlay').click({ position: { x: 350, y: 400 } });
    await expect(page.locator('#sidebar')).not.toHaveClass(/open/);
  });
}

test('immutable colored header links stay out of the header', async ({ page }) => {
  await page.goto('/immutable.html');

  const coloredLinks = page.locator('.main-nav > a.btn-storm');
  await expect(coloredLinks).toHaveCount(5);
  const displays = await coloredLinks.evaluateAll((links) =>
    links.map((link) => getComputedStyle(link).display)
  );
  expect(displays).toEqual(['none', 'none', 'none', 'none', 'none']);
});
