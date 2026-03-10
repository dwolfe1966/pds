/**
 * Auth flow tests — login, logout, redirect behaviour.
 */
import { test, expect } from '@playwright/test';
import { USERS } from './helpers/auth.js';

test.describe('Login', () => {
  test('shows login form', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('shows error for wrong credentials', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'nobody@test.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    // Should stay on login page and show an error
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('body')).toContainText(/invalid|incorrect|wrong|not found/i);
  });

  test('paid member logs in and lands on dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', USERS.paid.email);
    await page.fill('input[name="password"]', USERS.paid.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 10_000 });
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('logged-in user is redirected away from /login to dashboard', async ({ page }) => {
    // Log in first
    await page.goto('/login');
    await page.fill('input[name="email"]', USERS.paid.email);
    await page.fill('input[name="password"]', USERS.paid.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');

    // Revisiting /login should redirect to dashboard
    await page.goto('/login');
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('unauthenticated user is redirected to login when accessing protected route', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('Logout', () => {
  test('logout clears session and redirects to home', async ({ page }) => {
    // Log in
    await page.goto('/login');
    await page.fill('input[name="email"]', USERS.paid.email);
    await page.fill('input[name="password"]', USERS.paid.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');

    // Log out
    await page.goto('/logout');
    // Should end up on home or login, not dashboard
    await expect(page).not.toHaveURL(/\/dashboard/);

    // Token should be gone
    const token = await page.evaluate(() => localStorage.getItem('accessToken'));
    expect(token).toBeNull();
  });
});
