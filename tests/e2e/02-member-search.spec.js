/**
 * Member name search flow tests.
 */
import { test, expect } from '@playwright/test';
import { loginViaAPI, USERS } from './helpers/auth.js';

test.beforeEach(async ({ page }) => {
  await loginViaAPI(page, USERS.paid.email, USERS.paid.password);
});

test.describe('Member name search', () => {
  test('search form is visible on /people-search', async ({ page }) => {
    await page.goto('/people-search');
    await expect(page.locator('input[placeholder="First Name"]')).toBeVisible();
    await expect(page.locator('input[placeholder="Last Name"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('submit with empty fields shows validation error', async ({ page }) => {
    await page.goto('/people-search');
    // Click submit without filling in fields
    await page.click('button[type="submit"]');
    // Should stay on the same page (button is disabled or shows error)
    await expect(page).toHaveURL(/\/people-search/);
  });

  test('search navigates to results page with URL params', async ({ page }) => {
    await page.goto('/people-search');
    await page.fill('input[placeholder="First Name"]', 'Tim');
    await page.fill('input[placeholder="Last Name"]', 'Chin');
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

    // Filter controls should be visible
    await expect(page.locator('select')).toHaveCount.greaterThan(0);
  });

  test('search with state filter includes state in URL', async ({ page }) => {
    await page.goto('/people-search');
    await page.fill('input[placeholder="First Name"]', 'John');
    await page.fill('input[placeholder="Last Name"]', 'Smith');
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
