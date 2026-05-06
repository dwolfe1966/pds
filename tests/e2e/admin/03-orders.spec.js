/**
 * Admin /csr/orders — global recent list, filters, navigate to purchase detail.
 *
 * Default view (no ?userId=) calls api.adminListOrdersGlobal → apiRouter
 * 'admin-purchases-global' which first attempts apiWrapper.csrFindOrders
 * (POST /database/search { collectionName: 'commerceOrder' }). When that
 * returns data, the page renders it directly without falling back to the
 * fan-out path. Mocks here use that fast-path collectionName to keep the
 * test scenario deterministic.
 *
 * Filter behavior (Order ID / Status / Type) is client-side over the
 * already-loaded list and is exercised without re-fetching.
 */
import { test, expect } from '@playwright/test';
import { mockDatabaseSearch, setAuthInLocalStorage } from '../helpers/adminAuth.js';

const SAMPLE_ORDERS = [
  {
    _id: 'order-active-sale-1',
    status: 'active',
    type: 'sale',
    amount: 29.99,
    createdAt: '2026-04-15T10:00:00Z',
    payerId: 'u1',
  },
  {
    _id: 'order-canceled-sale-2',
    status: 'canceled',
    type: 'sale',
    amount: 19.99,
    createdAt: '2026-04-10T10:00:00Z',
    payerId: 'u2',
  },
  {
    _id: 'order-active-refund-3',
    status: 'active',
    type: 'refund',
    amount: 5.00,
    createdAt: '2026-04-05T10:00:00Z',
    payerId: 'u3',
  },
];

test.describe('Admin Orders page', () => {
  test.beforeEach(async ({ page }) => {
    await setAuthInLocalStorage(page);
  });

  test('shows empty state when no global orders returned', async ({ page }) => {
    await mockDatabaseSearch(page, { collectionName: 'commerceOrder', docs: [] });
    // Fan-out fallback also queries users; return empty so the page settles
    // on "fanout-empty" (recentCustomers === []) and the simple empty title.
    await mockDatabaseSearch(page, { collectionName: 'users', docs: [] });
    await page.goto('/csr/orders');

    await expect(page.locator('h1')).toContainText('Order Management');
    await expect(page.locator('body')).toContainText(/no recent orders available|unable to load the global order list/i);
  });

  test('renders order rows when global orders are returned', async ({ page }) => {
    await mockDatabaseSearch(page, { collectionName: 'commerceOrder', docs: SAMPLE_ORDERS });
    await page.goto('/csr/orders');

    await expect(page.locator('h1')).toContainText('Order Management');
    await expect(page.locator('body')).toContainText(/Showing 3 most recent orders/i);

    const rows = page.locator('tbody tr');
    await expect(rows).toHaveCount(3);
    // The page truncates IDs longer than 14 chars to `slice(0,14) + '…'`
    // (see shortId() in OrdersPage.js), so assert the truncated 14-char forms.
    await expect(page.locator('tbody')).toContainText('order-active-s');
    await expect(page.locator('tbody')).toContainText('order-canceled');
    await expect(page.locator('tbody')).toContainText('order-active-r');
  });

  test('status filter narrows the list client-side without refetching', async ({ page }) => {
    await mockDatabaseSearch(page, { collectionName: 'commerceOrder', docs: SAMPLE_ORDERS });
    await page.goto('/csr/orders');

    await expect(page.locator('tbody tr')).toHaveCount(3);

    // Apply Canceled filter — only the one canceled order should remain.
    await page.locator('aside select').first().selectOption('canceled');
    await page.getByRole('button', { name: 'Filter', exact: true }).click();

    await expect(page.locator('tbody tr')).toHaveCount(1);
    await expect(page.locator('tbody')).toContainText('order-canceled');
    await expect(page.locator('tbody')).not.toContainText('order-active-s');
  });

  test('View link navigates to /csr/purchases/:id', async ({ page }) => {
    await mockDatabaseSearch(page, { collectionName: 'commerceOrder', docs: SAMPLE_ORDERS });
    // PurchaseDetailPage will fire its own API calls — stub permissive responses
    // so we don't get an error overlay before assertions run.
    await page.route(/\/commerceMgmt\/(getUserOrder|orderPayments|orderHistories)($|\?)/, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ order: SAMPLE_ORDERS[0] }) }),
    );

    await page.goto('/csr/orders');
    const firstView = page.locator('a:has-text("View")').first();
    await expect(firstView).toHaveAttribute('href', /\/csr\/purchases\/order-active-sale-1/);
    await firstView.click();
    await page.waitForURL(/\/csr\/purchases\/order-active-sale-1/, { timeout: 10_000 });
  });
});
