/**
 * Shared auth helpers for Playwright tests.
 */

export const BASE_URL = 'http://localhost:3000';

/**
 * Log in via the UI and wait for redirect to dashboard.
 * Returns the accessToken that was stored in localStorage.
 */
export async function loginAs(page, email, password = 'password123') {
  await page.goto('/login');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  // Wait for redirect away from /login
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10_000 });
}

/**
 * Log in programmatically (via API) and inject token into localStorage.
 * Faster than UI login — use when the test itself doesn't test the login flow.
 */
export async function loginViaAPI(page, email, password = 'password123') {
  const response = await page.request.post('http://localhost:3001/api/v1/login', {
    data: { email, password },
  });
  const body = await response.json();
  const { accessToken, user } = body;

  // Inject into localStorage so the app's AuthContext picks it up
  await page.goto('/');
  await page.evaluate(({ token, userData }) => {
    localStorage.setItem('accessToken', token);
    localStorage.setItem('user', JSON.stringify(userData));
  }, { token: accessToken, userData: user });

  return { accessToken, user };
}

export const USERS = {
  paid: { email: 'paid@test.com', password: 'password123' },
  member: { email: 'member@test.com', password: 'password123' },
  admin: { email: 'admin@test.com', password: 'admin123' },
};
