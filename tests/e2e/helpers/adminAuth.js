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
 * Intercept POST .../auth/login and return a canned admin login response.
 * Call this BEFORE navigating, so the route is in place when the form submits.
 *
 * Matches both prod and dev-proxy URL shapes the IIFE may use:
 *   - prod: /api/auth/login                (REACT_APP_NEW_API_URL=/api)
 *   - dev:  /api/proxy/auth/login          (server/index.js proxy)
 *   - dev:  https://...bytecrtrs.com/api/auth/login
 * Also stubs /shape/compiled which the IIFE calls during init — left
 * unmocked it 502s in CI and the form renders "Bad Gateway" before
 * the test can submit.
 *
 * @param {object} opts
 * @param {boolean} [opts.success=true] - return success vs 401
 * @param {string}  [opts.role='admin'] - role on the returned user
 */
export async function mockAdminLogin(page, { success = true, role = 'admin' } = {}) {
  // IIFE init probe — return empty shape so init proceeds.
  await page.route(/\/shape\/compiled($|\?)/, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  );

  await page.route(/\/auth\/login($|\?)/, async (route) => {
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

/**
 * Mock POST /database/search responses scoped to a single collectionName.
 *
 * BC's csrFindUsers/csrFindCsReps/csrFindOptOuts/etc. all hit
 * /database/search; the request body's `collectionName` discriminates.
 * Tests pass collectionName + the docs/total/noMoreDocs to fulfill.
 *
 * Calls with a different collectionName fall through to the next route
 * handler (or hit the network if none is registered).
 *
 * @param {object} opts
 * @param {string}  opts.collectionName - 'users', 'optOutRequest', 'userContact', etc.
 * @param {Array}   opts.docs           - documents returned in the BC envelope
 * @param {boolean} [opts.noMoreDocs]   - paging signal, default true
 * @param {(body: any) => boolean} [opts.bodyMatch] - additional predicate on the request body
 */
export async function mockDatabaseSearch(page, { collectionName, docs, noMoreDocs = true, bodyMatch } = {}) {
  await page.route(/\/database\/search($|\?)/, async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    let body = {};
    try { body = JSON.parse(route.request().postData() || '{}'); } catch {}
    if (body.collectionName !== collectionName) return route.continue();
    if (bodyMatch && !bodyMatch(body)) return route.continue();
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ docs, total: docs.length, noMoreDocs }),
    });
  });
}
