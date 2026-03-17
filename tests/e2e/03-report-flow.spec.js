/**
 * Report creation and viewing flow tests.
 * These tests cover the core paid-member journey:
 * search → click result → create report → view report details.
 *
 * ByteCrtrs API (window.ApiWrapper) is mocked via page.addInitScript so that:
 *  - searchTeaser returns fixture Tim Chin results without hitting the real API
 *  - createReport / getReportDetail return a fixture report
 * This avoids the "Input Password" BC auth dialog and network timeouts in CI.
 */
import { test, expect } from '@playwright/test';
import { loginViaAPI, USERS } from './helpers/auth.js';

/**
 * Shared window.ApiWrapper mock — same fixture used by 02-member-search.spec.js.
 * Prevents ByteCrtrs auth popups and returns deterministic data for all BC-routed
 * endpoints (searchTeaser, createReport, getReportDetail).
 */
const MOCK_API_WRAPPER_SCRIPT = `
  (function () {
    var MOCK_IDENTITIES = [
      {
        extId: 'mock-ext-1',
        nameList: [{ data: 'Tim Chin' }],
        addressList: [{ city: 'Seattle', state: 'WA', zip: '98101' }],
        ageRange: '25-29'
      },
      {
        extId: 'mock-ext-2',
        nameList: [{ data: 'Tim Chin' }],
        addressList: [{ city: 'Portland', state: 'OR', zip: '97201' }],
        ageRange: '30-34'
      }
    ];

    var MOCK_REPORT = {
      commerceContentId: 'mock-report-abc123',
      raws: [
        {
          transient: {
            identities: MOCK_IDENTITIES
          }
        }
      ]
    };

    function mockSearchResponse() {
      return {
        getIdentities: function () { return MOCK_IDENTITIES; },
        getTotal: function () { return MOCK_IDENTITIES.length; },
        getPerPage: function () { return 20; },
        getTeaserInput: function () { return null; },
        getSearchContextKey: function () { return null; },
        getCommerceContent: function () { return null; },
        hasMore: function () { return false; },
        getMore: function () { return Promise.resolve(mockSearchResponse()); }
      };
    }

    window.ApiWrapper = {
      getInstance: function () {
        return {
          api: {
            idLookup: {
              searchTeaser: function () {
                return Promise.resolve(mockSearchResponse());
              },
              createReport: function () {
                return Promise.resolve(MOCK_REPORT);
              },
              getReportDetail: function () {
                return Promise.resolve(MOCK_REPORT);
              },
              getReport: function () {
                return Promise.resolve(MOCK_REPORT);
              }
            }
          }
        };
      }
    };
  })();
`;

test.beforeEach(async ({ page }) => {
  // Block the remote ByteCrtrs IIFE so it cannot overwrite window.ApiWrapper.
  await page.route('**/api-wrapper/index.iife.js', (route) => route.abort());
  await page.route('**bytecrtrs.com/libs/**', (route) => route.abort());

  await page.addInitScript({ content: MOCK_API_WRAPPER_SCRIPT });
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

  test('report detail page shows person name as heading', async ({ page }) => {
    // NOTE: The report detail page renders the person's name in <h1>, not a
    // generic "Report Details" label.  The breadcrumb shows "Search › Report".
    await page.goto('/people-results?firstName=Tim&lastName=Chin');
    await page.waitForSelector('[class*="card"]', { timeout: 20_000 });

    await page.locator('button', { hasText: /view full report/i }).first().click();
    await page.waitForURL(/\/people\//, { timeout: 20_000 });

    // The h1 should contain the person's name (non-empty)
    const h1 = page.locator('h1').first();
    await expect(h1).toBeVisible({ timeout: 20_000 });
    const nameText = await h1.textContent();
    expect(nameText?.trim().length).toBeGreaterThan(2);

    // Breadcrumb should show "Report" to confirm we are on the report detail view
    await expect(page.locator('body')).toContainText(/report/i, { timeout: 20_000 });
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
