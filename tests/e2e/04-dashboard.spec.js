/**
 * Dashboard and member area tests.
 */
import { test, expect } from '@playwright/test';
import { loginViaAPI, USERS } from './helpers/auth.js';

test.beforeEach(async ({ page }) => {
  await loginViaAPI(page, USERS.paid.email, USERS.paid.password);
});

test.describe('Dashboard', () => {
  test('dashboard loads and shows member content', async ({ page }) => {
    await page.goto('/dashboard');
    // Should not be redirected to login
    await expect(page).toHaveURL(/\/dashboard/);
    // Should have meaningful content
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('dashboard has navigation to people search', async ({ page }) => {
    await page.goto('/dashboard');
    // Find a link to people search
    const searchLink = page.locator('a[href*="people-search"], a[href*="search"]').first();
    await expect(searchLink).toBeVisible();
  });

  test('profile page is accessible', async ({ page }) => {
    await page.goto('/profile');
    await expect(page).toHaveURL(/\/profile/);
    await expect(page.locator('body')).not.toContainText(/please log in/i);
  });

  test('search history page loads', async ({ page }) => {
    await page.goto('/search-history');
    await expect(page).toHaveURL(/\/search-history/);
    // Should show something — either history entries or "no history" message
    await page.waitForLoadState('networkidle');
    const bodyText = await page.locator('body').textContent();
    expect(bodyText?.trim().length).toBeGreaterThan(10);
  });

  test('account page is accessible', async ({ page }) => {
    await page.goto('/account');
    await expect(page).toHaveURL(/\/account/);
    await expect(page.locator('body')).not.toContainText(/please log in/i);
  });
});

test.describe('Report list', () => {
  test('/who-is-searching page loads without error', async ({ page }) => {
    await page.goto('/who-is-searching');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/who-is-searching/);
    // Should not show a fatal error
    await expect(page.locator('body')).not.toContainText(/500|internal server error/i);
  });
});
