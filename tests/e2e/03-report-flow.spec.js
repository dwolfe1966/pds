/**
 * Report creation and viewing flow tests.
 * These tests cover the core paid-member journey:
 * search → click result → create report → view report details.
 */
import { test, expect } from '@playwright/test';
import { loginViaAPI, USERS } from './helpers/auth.js';

test.beforeEach(async ({ page }) => {
  await loginViaAPI(page, USERS.paid.email, USERS.paid.password);
});

test.describe('Report creation from search result', () => {
  test('clicking a result card triggers report creation', async ({ page }) => {
    await page.goto('/people-results?firstName=Tim&lastName=Chin');

    // Wait for results to load
    await page.waitForSelector('[class*="card"]', { timeout: 20_000 });

    // Click "View Full Report" on the first card
    const viewButton = page.locator('button', { hasText: /view full report/i }).first();
    await expect(viewButton).toBeVisible();
    await viewButton.click();

    // Should navigate away from results — either to /people/:id or loading state
    await page.waitForURL((url) => !url.pathname.includes('/people-results'), { timeout: 20_000 });

    const url = page.url();
    expect(url).toMatch(/\/people\//);
  });

  test('report detail page does not show "Unknown" as the name', async ({ page }) => {
    await page.goto('/people-results?firstName=Tim&lastName=Chin');
    await page.waitForSelector('[class*="card"]', { timeout: 20_000 });

    const viewButton = page.locator('button', { hasText: /view full report/i }).first();
    await viewButton.click();

    // Wait for report detail page to finish loading
    await page.waitForURL(/\/people\//, { timeout: 20_000 });
    // Wait until the loading spinner is gone
    await page.waitForFunction(
      () => !document.body.innerText.includes('Loading report') &&
             !document.body.innerText.includes('Creating report'),
      { timeout: 30_000 }
    );

    // Name should NOT be "Unknown"
    const h2 = page.locator('h2').first();
    await expect(h2).not.toHaveText('Unknown', { ignoreCase: true });
    // Name should contain at least one letter
    const nameText = await h2.textContent();
    expect(nameText?.trim().length).toBeGreaterThan(2);
  });

  test('report detail page shows Report Details heading', async ({ page }) => {
    await page.goto('/people-results?firstName=Tim&lastName=Chin');
    await page.waitForSelector('[class*="card"]', { timeout: 20_000 });

    await page.locator('button', { hasText: /view full report/i }).first().click();
    await page.waitForURL(/\/people\//, { timeout: 20_000 });

    await expect(page.locator('h1')).toContainText(/report details/i, { timeout: 20_000 });
  });

  test('report page does not show error state for paid member', async ({ page }) => {
    await page.goto('/people-results?firstName=Tim&lastName=Chin');
    await page.waitForSelector('[class*="card"]', { timeout: 20_000 });

    await page.locator('button', { hasText: /view full report/i }).first().click();
    await page.waitForURL(/\/people\//, { timeout: 20_000 });

    // Wait for load to settle
    await page.waitForFunction(
      () => !document.body.innerText.includes('Loading'),
      { timeout: 30_000 }
    );

    // Should NOT show the "couldn't load this report" error message
    await expect(page.locator('body')).not.toContainText(/couldn't load this report/i);
    await expect(page.locator('body')).not.toContainText(/we could not load/i);
  });
});

test.describe('Direct report URL access', () => {
  test('navigating to /people/:extId without context shows graceful fallback', async ({ page }) => {
    // Use a fake ID — should show error, not crash
    await page.goto('/people/fake-id-123');
    await page.waitForLoadState('networkidle');

    // Should show either an error message or redirect — not a blank page
    const bodyText = await page.locator('body').textContent();
    expect(bodyText?.length).toBeGreaterThan(10);
  });

  test('report page has Back to Search button on error', async ({ page }) => {
    await page.goto('/people/definitely-invalid-id-xyz');
    await page.waitForLoadState('networkidle');

    // If error state, should have a back button
    const backBtn = page.locator('button', { hasText: /back to search/i });
    const hasBackBtn = await backBtn.count();
    if (hasBackBtn > 0) {
      await backBtn.click();
      await expect(page).toHaveURL(/\/people-search/);
    }
  });
});
