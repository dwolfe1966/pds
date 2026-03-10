/**
 * Public (sales/unauthenticated) flow tests.
 * These verify that non-members can search and reach the signup/payment gate.
 */
import { test, expect } from '@playwright/test';

test.describe('Public name search flow', () => {
  test('home page loads', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
  });

  test('name search landing page is accessible', async ({ page }) => {
    await page.goto('/name/landing');
    await expect(page).toHaveURL(/\/name\/landing/);
    await expect(page.locator('body')).toBeVisible();
  });

  test('/search/all shows a search form', async ({ page }) => {
    await page.goto('/search/all');
    // Should have at least one text input
    await expect(page.locator('input[type="text"]').first()).toBeVisible();
  });

  test('searching navigates to results or loader', async ({ page }) => {
    await page.goto('/search/all');
    const firstNameInput = page.locator('input').first();
    await firstNameInput.fill('John');

    // Fill last name if there's a second input
    const inputs = page.locator('input[type="text"]');
    if (await inputs.count() > 1) {
      await inputs.nth(1).fill('Smith');
    }

    await page.locator('button[type="submit"]').first().click();

    // Should navigate somewhere (loader, results, etc.)
    await page.waitForURL(
      (url) => url.pathname !== '/search/all',
      { timeout: 15_000 }
    );
    // Should not land on /login — this is a public flow
    expect(page.url()).not.toMatch(/\/login/);
  });
});

test.describe('Signup and payment gate', () => {
  test('signup page loads', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.locator('input[name="email"], input[type="email"]').first()).toBeVisible();
  });

  test('payment page redirects unauthenticated users to login or signup', async ({ page }) => {
    await page.goto('/payment');
    await page.waitForLoadState('networkidle');
    // Payment requires auth — should redirect or show login prompt
    const url = page.url();
    const bodyText = await page.locator('body').textContent();
    const isGated = url.includes('/login') || url.includes('/signup') ||
                    bodyText?.toLowerCase().includes('log in') ||
                    bodyText?.toLowerCase().includes('sign up');
    expect(isGated).toBe(true);
  });
});

test.describe('Public informational pages', () => {
  test('/privacy page loads', async ({ page }) => {
    await page.goto('/privacy');
    await expect(page).toHaveURL(/\/privacy/);
    await expect(page.locator('body')).toBeVisible();
  });

  test('/terms page loads', async ({ page }) => {
    await page.goto('/terms');
    await expect(page).toHaveURL(/\/terms/);
    await expect(page.locator('body')).toBeVisible();
  });

  test('/opt-out page loads', async ({ page }) => {
    await page.goto('/opt-out');
    await expect(page).toHaveURL(/\/opt-out/);
    await expect(page.locator('body')).toBeVisible();
  });
});
