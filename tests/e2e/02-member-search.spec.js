/**
 * Member name search flow tests.
 */
import { test, expect } from '@playwright/test';
import { loginViaAPI, USERS } from './helpers/auth.js';

/**
 * Minimal window.ApiWrapper mock injected before each page load.
 * Prevents the ByteCrtrs "Input Password" auth dialog from blocking the UI
 * and returns predictable fixture data for teaser searches.
 * createReport is also mocked because it is in FORCE_NEW_API_ENDPOINTS and
 * has no mock-API fallback.
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
  // The init script below installs our mock before the page's own scripts run,
  // but the IIFE is a remote <script> that would otherwise overwrite that mock.
  await page.route('**/api-wrapper/index.iife.js', (route) => route.abort());
  await page.route('**bytecrtrs.com/libs/**', (route) => route.abort());

  // Inject the ApiWrapper mock before any page script runs
  await page.addInitScript({ content: MOCK_API_WRAPPER_SCRIPT });
  await loginViaAPI(page, USERS.paid.email, USERS.paid.password);
});

test.describe('Member name search', () => {
  test('search form is visible on /people-search', async ({ page }) => {
    await page.goto('/people-search');
    // Placeholders are lowercase 'n' — matches the component's placeholder text
    await expect(page.locator('input[placeholder="First name"]')).toBeVisible();
    await expect(page.locator('input[placeholder="Last name"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('submit with empty fields shows validation error', async ({ page }) => {
    await page.goto('/people-search');
    // The submit button is disabled when required fields are empty — verify that
    // directly rather than trying to click a disabled element.
    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeDisabled();
    // URL should remain on people-search (nothing submitted)
    await expect(page).toHaveURL(/\/people-search/);
  });

  test('search navigates to results page with URL params', async ({ page }) => {
    await page.goto('/people-search');
    await page.fill('input[placeholder="First name"]', 'Tim');
    await page.fill('input[placeholder="Last name"]', 'Chin');
    await page.click('button[type="submit"]');

    // Should navigate to /people-results with query params
    await page.waitForURL('**/people-results**', { timeout: 10_000 });
    expect(page.url()).toContain('firstName=Tim');
    expect(page.url()).toContain('lastName=Chin');
  });

  test('results page shows at least one result card for Tim Chin', async ({ page }) => {
    await page.goto('/people-results?firstName=Tim&lastName=Chin');

    // Wait for loading to finish
    await page.waitForSelector('.result-card, [class*="card"]', { timeout: 20_000 });

    const cards = page.locator('[class*="card"]');
    await expect(cards.first()).toBeVisible();

    // At least one result should contain "Chin" or "Tim"
    const cardText = await cards.first().textContent();
    expect(cardText?.toUpperCase()).toMatch(/CHIN|TIM/);
  });

  test('results page shows filter controls', async ({ page }) => {
    await page.goto('/people-results?firstName=John&lastName=Smith');
    await page.waitForLoadState('networkidle');

    // Filter controls (State and Sort-by selects) should be present
    // toHaveCount().greaterThan() is not valid Playwright API — use count() instead
    expect(await page.locator('select').count()).toBeGreaterThan(0);
  });

  test('search with state filter includes state in URL', async ({ page }) => {
    await page.goto('/people-search');
    await page.fill('input[placeholder="First name"]', 'John');
    await page.fill('input[placeholder="Last name"]', 'Smith');
    // Select California
    await page.selectOption('select', 'CA');
    await page.click('button[type="submit"]');

    await page.waitForURL('**/people-results**', { timeout: 10_000 });
    expect(page.url()).toContain('state=CA');
  });
});

test.describe('Member phone search', () => {
  test('phone tab is visible and clickable', async ({ page }) => {
    await page.goto('/people-search');
    await page.click('text=Phone Search');
    await expect(page.locator('input[type="tel"]')).toBeVisible();
  });

  test('phone search requires 10 digits', async ({ page }) => {
    await page.goto('/people-search');
    await page.click('text=Phone Search');
    // Enter short number
    await page.fill('input[type="tel"]', '555');
    const submitBtn = page.locator('button[type="submit"]');
    // Submit button should be disabled
    await expect(submitBtn).toBeDisabled();
  });
});
