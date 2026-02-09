// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('AcreetionOS Website', () => {
  test('homepage loads successfully', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/AcreetionOS/);
  });

  test('logo and branding visible', async ({ page }) => {
    await page.goto('/');
    const logo = page.locator('.logo-img');
    await expect(logo).toBeVisible();
    
    const logoText = page.locator('.logo-text');
    await expect(logoText).toContainText('AcreetionOS');
  });

  test('navigation links are functional', async ({ page }) => {
    await page.goto('/');
    
    // Check main nav links exist
    await expect(page.locator('a[href="#about"]')).toBeVisible();
    await expect(page.locator('a[href="#manual-downloads"]')).toBeVisible();
  });

  test('download buttons render', async ({ page }) => {
    await page.goto('/');
    
    const downloadButtons = page.locator('.btn-cinnamon');
    await expect(downloadButtons.first()).toBeVisible();
  });

  test('contact page loads', async ({ page }) => {
    await page.goto('/contact.html');
    await expect(page).toHaveTitle(/Contact/);
    
    const form = page.locator('.contact-form');
    await expect(form).toBeVisible();
  });

  test('modals can be opened and closed', async ({ page }) => {
    await page.goto('/');
    
    // Open donate modal
    await page.locator('[data-modal-target="#donate-modal"]').click();
    const modal = page.locator('#donate-modal');
    await expect(modal).toHaveClass(/visible/);
    
    // Close modal
    await page.locator('#donate-modal .modal-close-btn').click();
    await expect(modal).not.toHaveClass(/visible/);
  });

  test('external links have proper attributes', async ({ page }) => {
    await page.goto('/');
    
    const externalLinks = page.locator('a[target="_blank"]');
    const count = await externalLinks.count();
    expect(count).toBeGreaterThan(0);
    
    // Verify first external link has rel attribute for security
    const firstLink = externalLinks.first();
    const rel = await firstLink.getAttribute('rel');
    expect(rel).toContain('noopener');
  });
});
