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

  test('Root link appears in index.html sidebar', async ({ page }) => {
    await page.goto('/');
    
    // Verify Root link exists in sidebar
    const rootLink = page.locator('a[href="https://root.acreetionos.org"]');
    await expect(rootLink).toBeVisible();
    
    // Verify link text
    await expect(rootLink).toContainText('Root');
    
    // Verify link has proper security attributes
    const rel = await rootLink.getAttribute('rel');
    expect(rel).toContain('noopener noreferrer');
    const target = await rootLink.getAttribute('target');
    expect(target).toBe('_blank');
  });

  test('Root links appear in contact.html', async ({ page }) => {
    await page.goto('/contact.html');
    
    // Verify Root link exists in sidebar
    const rootLinks = page.locator('a[href="https://root.acreetionos.org"]');
    const count = await rootLinks.count();
    expect(count).toBeGreaterThanOrEqual(2); // Should have at least 2: button and sidebar link
    
    // Verify "Create a Ticket on Root" button exists
    const rootTicketButton = page.locator('a[href="https://root.acreetionos.org"]:has-text("Create a Ticket on Root")');
    await expect(rootTicketButton).toBeVisible();
    
    // Verify sidebar link exists
    const sidebarRootLink = page.locator('aside a[href="https://root.acreetionos.org"]');
    await expect(sidebarRootLink).toBeVisible();
  });
});

test.describe('Mobile Responsiveness', () => {
  test('mobile viewport renders correctly on small screen', async ({ page }) => {
    // Set mobile viewport (iPhone SE size)
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    // Verify page is still accessible
    await expect(page).toHaveTitle(/AcreetionOS/);
    
    // Verify logo is visible on mobile
    const logo = page.locator('.logo-img');
    await expect(logo).toBeVisible();
    
    // Verify navigation is visible
    const nav = page.locator('.main-nav');
    await expect(nav).toBeVisible();
  });

  test('tablet viewport renders correctly', async ({ page }) => {
    // Set tablet viewport (iPad size)
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    
    // Verify page layout adapts
    await expect(page).toHaveTitle(/AcreetionOS/);
    
    // Verify content boxes are visible
    const contentBox = page.locator('.content-box').first();
    await expect(contentBox).toBeVisible();
  });

  test('extra small mobile viewport (320px) renders correctly', async ({ page }) => {
    // Set very small mobile viewport (iPhone 5/SE)
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/');
    
    // Verify critical elements are still visible
    await expect(page).toHaveTitle(/AcreetionOS/);
    const logo = page.locator('.logo-img');
    await expect(logo).toBeVisible();
  });

  test('contact form is accessible on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/contact.html');
    
    // Verify form is visible and accessible
    const form = page.locator('.contact-form');
    await expect(form).toBeVisible();
    
    // Verify input fields are accessible
    const nameInput = page.locator('input[name="name"]');
    await expect(nameInput).toBeVisible();
  });

  test('compare page tables are scrollable on mobile', async ({ page }) => {
    // Set mobile viewport (iPhone SE size)
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/compare.html');
    
    // Verify page loads
    await expect(page).toHaveTitle(/Compare/);
    
    // Verify all comparison tables have overflow wrappers
    const overflowWrappers = page.locator('div[style*="overflow-x: auto"]');
    const count = await overflowWrappers.count();
    expect(count).toBeGreaterThanOrEqual(5); // Should have 5 tables with overflow wrappers (1 quick comparison + 4 detailed)
    
    // Verify tables are visible
    const tables = page.locator('.comparison-table');
    const tableCount = await tables.count();
    expect(tableCount).toBeGreaterThan(0);
    
    // Verify first table is visible
    await expect(tables.first()).toBeVisible();
  });

  test('compare page feature cards stack on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/compare.html');
    
    // Verify feature cards are visible
    const featureCards = page.locator('.feature-card');
    const cardCount = await featureCards.count();
    expect(cardCount).toBeGreaterThan(0);
    
    // Verify first card is visible
    await expect(featureCards.first()).toBeVisible();
  });
});
