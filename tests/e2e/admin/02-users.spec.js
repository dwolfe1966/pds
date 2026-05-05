/**
 * Admin /csr/users — list, empty state, server search, navigate to detail.
 *
 * api.adminListUsers → routeApiRequest('admin-users') → apiWrapper.csrFindUsers
 * → POST /database/search { collectionName: 'users', ... }
 * apiRouter normalizes the BC envelope to { data, total, noMoreDocs } before
 * the page receives it, so the mock returns BC's native { docs, total,
 * noMoreDocs } shape and lets the router unwrap it.
 */
import { test, expect } from '@playwright/test';
import { mockDatabaseSearch, setAuthInLocalStorage } from '../helpers/adminAuth.js';

const SAMPLE_USERS = [
  {
    _id: 'u1',
    email: 'alice@test.com',
    firstName: 'Alice',
    lastName: 'Anderson',
    status: 'active',
    roles: ['subscriber'],
    createdAt: '2026-01-15T00:00:00Z',
  },
  {
    _id: 'u2',
    email: 'bob@test.com',
    firstName: 'Bob',
    lastName: 'Brown',
    status: 'suspended',
    createdAt: '2026-02-20T00:00:00Z',
  },
];

test.describe('Admin Users page', () => {
  test.beforeEach(async ({ page }) => {
    await setAuthInLocalStorage(page);
  });

  test('renders empty state when no users returned', async ({ page }) => {
    await mockDatabaseSearch(page, { collectionName: 'users', docs: [] });
    await page.goto('/csr/users');
    await expect(page.locator('body')).toContainText('No customers found');
  });

  test('renders user rows when users returned', async ({ page }) => {
    await mockDatabaseSearch(page, { collectionName: 'users', docs: SAMPLE_USERS });
    await page.goto('/csr/users');

    // Title + count (default view is "list" → table rows)
    await expect(page.locator('h1')).toContainText('Customer Directory');
    await expect(page.locator('body')).toContainText(/2 customers loaded/);

    // Both emails surfaced in the table
    await expect(page.locator('tbody')).toContainText('alice@test.com');
    await expect(page.locator('tbody')).toContainText('bob@test.com');

    // Status badges resolve correctly per user
    await expect(page.locator('tbody').getByText('Active', { exact: true })).toBeVisible();
    await expect(page.locator('tbody').getByText('Suspended', { exact: true })).toBeVisible();
  });

  test('email search refetches with email param in body', async ({ page }) => {
    // Initial load: empty list
    await mockDatabaseSearch(page, { collectionName: 'users', docs: [] });
    await page.goto('/csr/users');
    await expect(page.locator('body')).toContainText('No customers found');

    // Capture the next /database/search request after Search is clicked.
    const reqPromise = page.waitForRequest((req) =>
      /\/database\/search($|\?)/.test(req.url()) && req.method() === 'POST',
    );

    await page.locator('input[aria-label="Search by email (server)"]').first().fill('alice@test.com');
    await page.getByRole('button', { name: 'Search' }).first().click();

    const req = await reqPromise;
    const body = JSON.parse(req.postData() || '{}');
    expect(body.collectionName).toBe('users');
    expect(body.email).toBe('alice@test.com');
  });

  test('clicking Details link navigates to /csr/users/:id', async ({ page }) => {
    await mockDatabaseSearch(page, { collectionName: 'users', docs: SAMPLE_USERS });
    // UserDetailPage will issue its own /database/search and detail calls;
    // stub permissive responses so it doesn't 502 on its way in.
    await page.route(/\/user\/management\/detail($|\?)/, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: SAMPLE_USERS[0] }) }),
    );

    await page.goto('/csr/users');
    // First Details link in the list view points at u1.
    const link = page.locator('a:has-text("Details")').first();
    await expect(link).toHaveAttribute('href', '/csr/users/u1');
    await link.click();
    await page.waitForURL(/\/csr\/users\/u1/, { timeout: 10_000 });
  });
});
