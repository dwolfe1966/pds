/**
 * Admin auth flow — login form, error path, redirect on success, role guard.
 *
 * Uses page.route() to mock BC's /api/auth/login since admin pages always go
 * through FORCE_NEW_API_ENDPOINTS (no mock-server fallback).
 */
import { test, expect } from '@playwright/test';
import { ADMIN_USER, mockAdminLogin, setAuthInLocalStorage } from '../helpers/adminAuth.js';

test.describe('Admin login', () => {
  test('shows login form', async ({ page }) => {
    await page.goto('/csr/login');
    await expect(page.locator('input[name="email"], input[type="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"], input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('blocks submit when fields are empty', async ({ page }) => {
    await page.goto('/csr/login');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/csr\/login/);
    await expect(page.locator('body')).toContainText(/please enter email|email and password/i);
  });

  test('shows error for wrong credentials', async ({ page }) => {
    await mockAdminLogin(page, { success: false });
    await page.goto('/csr/login');
    await page.fill('input[type="email"]', 'wrong@test.com');
    await page.fill('input[type="password"]', 'wrongpass');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/csr\/login/);
    await expect(page.locator('body')).toContainText(/invalid|incorrect|wrong|failed/i);
  });

  test('blocks non-admin role with "Access denied"', async ({ page }) => {
    await mockAdminLogin(page, { role: 'member' });
    await page.goto('/csr/login');
    await page.fill('input[type="email"]', 'member@test.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/csr\/login/);
    await expect(page.locator('body')).toContainText(/access denied|admin credentials/i);
  });

  test('admin login redirects to /csr/users by default', async ({ page }) => {
    await mockAdminLogin(page);
    await page.goto('/csr/login');
    await page.fill('input[type="email"]', ADMIN_USER.email);
    await page.fill('input[type="password"]', ADMIN_USER.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/csr\/users/, { timeout: 10_000 });
  });

  test('admin login honors ?redirect= parameter', async ({ page }) => {
    await mockAdminLogin(page);
    await page.goto('/csr/login?redirect=%2Fcsr%2Fcs-reps');
    await page.fill('input[type="email"]', ADMIN_USER.email);
    await page.fill('input[type="password"]', ADMIN_USER.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/csr\/cs-reps/, { timeout: 10_000 });
  });

  test('already-authed admin is redirected away from /csr/login', async ({ page }) => {
    await setAuthInLocalStorage(page);
    await page.goto('/csr/login');
    // AdminApp.js: /login redirects to /my-dashboard when isAdmin
    await page.waitForURL(/\/csr\/my-dashboard/, { timeout: 10_000 });
  });

  test('unauthenticated visit to protected route bounces to login with redirect param', async ({ page }) => {
    await page.goto('/csr/users');
    await page.waitForURL(/\/csr\/login\?redirect=/, { timeout: 10_000 });
    await expect(page.url()).toContain('redirect=');
  });
});
