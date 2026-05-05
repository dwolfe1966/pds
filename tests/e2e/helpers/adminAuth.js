/**
 * Shared admin-app helpers for Playwright tests.
 *
 * Admin pages call BC's API directly (apiRouter.js routes all `admin-*`
 * endpoints via FORCE_NEW_API_ENDPOINTS — there's no mock-server path).
 * Tests mock at the network layer with page.route(), so the admin app
 * doesn't need a real backend to drive UI assertions.
 */

export const ADMIN_BASE_URL = 'http://localhost:3003/csr';

export const ADMIN_USER = {
  email: 'admin@test.com',
  password: 'admin123',
  role: 'admin',
  fullName: 'Admin Tester',
  id: 'user-admin',
};

/**
 * Intercept POST /api/auth/login and return a canned admin login response.
 * Call this BEFORE navigating, so the route is in place when the form submits.
 *
 * @param {object} opts
 * @param {boolean} [opts.success=true] - return success vs 401
 * @param {string}  [opts.role='admin'] - role on the returned user
 */
export async function mockAdminLogin(page, { success = true, role = 'admin' } = {}) {
  await page.route('**/api/auth/login**', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    if (!success) {
      return route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Invalid email or password' }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        accessToken: 'test-admin-token',
        refreshToken: 'test-admin-refresh',
        user: { ...ADMIN_USER, role },
      }),
    });
  });
}

/**
 * Inject auth state into localStorage so the admin app boots authenticated.
 * Use when the test isn't asserting login itself.
 */
export async function setAuthInLocalStorage(page, role = 'admin') {
  await page.goto('/csr/login');
  await page.evaluate(({ user }) => {
    localStorage.setItem('accessToken', 'test-admin-token');
    localStorage.setItem('refreshToken', 'test-admin-refresh');
    localStorage.setItem('user', JSON.stringify(user));
  }, { user: { ...ADMIN_USER, role } });
}
