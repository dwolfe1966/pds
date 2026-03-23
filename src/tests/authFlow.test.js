/**
 * Tests for login role normalization in apiRouter.callNewAPI('login').
 *
 * The BC API returns roles as an array (e.g. ['csr'] for admin users, [] for
 * regular members).  callNewAPI normalizes this to a single role string so the
 * rest of the app (ProtectedRoute, AdminRoute) can do a simple equality check.
 *
 * Contract:
 *   - rawUser.roles: ['csr']  → normalized user.role === 'admin'
 *   - rawUser.roles: []       → normalized user.role === 'member'
 *   - rawUser.role: 'admin'   → preserved as-is (already normalized)
 *   - rawUser.role: 'member'  → preserved as-is
 */

// ─── Mock react-router-dom (AuthContext imports useNavigate) ─────────────────
jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
}));

// ─── Mock apiWrapper ─────────────────────────────────────────────────────────
// We control what apiWrapper.login() returns so we can test the normalization
// logic in callNewAPI without a real BC server.
const mockApiWrapperLogin = jest.fn();
const mockApiWrapperBillingSignup = jest.fn();
const mockApiWrapperGetWrapper = jest.fn();

jest.mock('../services/apiWrapper', () => ({
  __esModule: true,
  default: {
    isAvailable: () => true,
    login: mockApiWrapperLogin,
    logout: jest.fn().mockResolvedValue({ success: true }),
    billingSignup: mockApiWrapperBillingSignup,
    searchTeaser: jest.fn(),
    createReport: jest.fn(),
    getReportDetail: jest.fn(),
    getReportList: jest.fn(),
    sale: jest.fn(),
    requestOptOut: jest.fn(),
    confirmOptOut: jest.fn(),
    searchOptOut: jest.fn(),
    downloadPdfReport: jest.fn(),
    getWrapper: mockApiWrapperGetWrapper,
  },
}));

// ─── Mock AuthContext ─────────────────────────────────────────────────────────
jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    token: null,
    loading: false,
    isPaid: false,
    subscription: null,
    logout: jest.fn(),
  }),
}));

// ─── Module under test ────────────────────────────────────────────────────────
// We test routeApiRequest('login', ...) directly which internally calls callNewAPI.
// Reset modules between tests so the FORCE_NEW_API_ENDPOINTS set is fresh.
let routeApiRequest;

beforeEach(() => {
  jest.resetModules();

  // Re-apply mocks after resetModules so the freshly required modules get them
  jest.mock('../services/apiWrapper', () => ({
    __esModule: true,
    default: {
      isAvailable: () => true,
      login: mockApiWrapperLogin,
      logout: jest.fn().mockResolvedValue({ success: true }),
      billingSignup: mockApiWrapperBillingSignup,
      searchTeaser: jest.fn(),
      createReport: jest.fn(),
      getReportDetail: jest.fn(),
      getReportList: jest.fn(),
      sale: jest.fn(),
      requestOptOut: jest.fn(),
      confirmOptOut: jest.fn(),
      searchOptOut: jest.fn(),
      downloadPdfReport: jest.fn(),
      getWrapper: mockApiWrapperGetWrapper,
    },
  }));

  jest.mock('react-router-dom', () => ({
    useNavigate: () => jest.fn(),
  }));

  jest.mock('../context/AuthContext', () => ({
    useAuth: () => ({
      user: null, token: null, loading: false, isPaid: false,
      subscription: null, logout: jest.fn(),
    }),
  }));

  const routerModule = require('../services/apiRouter');
  routeApiRequest = routerModule.routeApiRequest;

  mockApiWrapperLogin.mockReset();
  mockApiWrapperBillingSignup.mockReset();
  mockApiWrapperGetWrapper.mockReset();

  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

// ─────────────────────────────────────────────────────────────────────────────
// Helper: build the raw response shape that apiWrapper.login() returns
// ─────────────────────────────────────────────────────────────────────────────
function makeBcLoginResponse(rawUser, opts = {}) {
  const d = {
    user: rawUser,
    ...(opts.accessToken && { accessToken: opts.accessToken }),
  };
  // Simulate getData() style (BC library wraps responses)
  return {
    getData: () => d,
    data: d,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. roles: ['csr'] → role: 'admin'
// ─────────────────────────────────────────────────────────────────────────────

describe("login role normalization — roles: ['csr'] → role: 'admin'", () => {
  test("normalized user has role 'admin' when BC returns roles: ['csr']", async () => {
    mockApiWrapperLogin.mockResolvedValue(
      makeBcLoginResponse(
        { id: 'u1', email: 'csr@example.com', roles: ['csr'] },
        { accessToken: 'tok-csr' }
      )
    );

    const result = await routeApiRequest('login', {
      body: { email: 'csr@example.com', password: 'pw123' },
    });

    expect(result.user.role).toBe('admin');
  });

  test("normalized user does NOT have role 'member' when BC returns roles: ['csr']", async () => {
    mockApiWrapperLogin.mockResolvedValue(
      makeBcLoginResponse(
        { id: 'u1', email: 'csr@example.com', roles: ['csr'] },
        { accessToken: 'tok-csr' }
      )
    );

    const result = await routeApiRequest('login', {
      body: { email: 'csr@example.com', password: 'pw123' },
    });

    expect(result.user.role).not.toBe('member');
  });

  test("result has accessToken when roles: ['csr']", async () => {
    mockApiWrapperLogin.mockResolvedValue(
      makeBcLoginResponse(
        { id: 'u1', email: 'csr@example.com', roles: ['csr'] },
        { accessToken: 'tok-csr-jwt' }
      )
    );

    const result = await routeApiRequest('login', {
      body: { email: 'csr@example.com', password: 'pw123' },
    });

    expect(result.accessToken).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. roles: [] → role: 'member'
// ─────────────────────────────────────────────────────────────────────────────

describe("login role normalization — roles: [] → role: 'member'", () => {
  test("normalized user has role 'member' when BC returns roles: []", async () => {
    mockApiWrapperLogin.mockResolvedValue(
      makeBcLoginResponse(
        { id: 'u2', email: 'jane@example.com', roles: [] },
        { accessToken: 'tok-member' }
      )
    );

    const result = await routeApiRequest('login', {
      body: { email: 'jane@example.com', password: 'secret' },
    });

    expect(result.user.role).toBe('member');
  });

  test("normalized user does NOT have role 'admin' when BC returns roles: []", async () => {
    mockApiWrapperLogin.mockResolvedValue(
      makeBcLoginResponse(
        { id: 'u2', email: 'jane@example.com', roles: [] },
        { accessToken: 'tok-member' }
      )
    );

    const result = await routeApiRequest('login', {
      body: { email: 'jane@example.com', password: 'secret' },
    });

    expect(result.user.role).not.toBe('admin');
  });

  test("normalized user has role 'member' when rawUser has no role or roles fields at all", async () => {
    mockApiWrapperLogin.mockResolvedValue(
      makeBcLoginResponse(
        { id: 'u3', email: 'nofield@example.com' /* no role/roles */ },
        { accessToken: 'tok-nofield' }
      )
    );

    const result = await routeApiRequest('login', {
      body: { email: 'nofield@example.com', password: 'pw' },
    });

    expect(result.user.role).toBe('member');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. rawUser already has role: 'admin' → preserved as-is
// ─────────────────────────────────────────────────────────────────────────────

describe("login role normalization — existing role field is preserved", () => {
  test("role: 'admin' already on rawUser is preserved, not overwritten", async () => {
    mockApiWrapperLogin.mockResolvedValue(
      makeBcLoginResponse(
        { id: 'u4', email: 'admin@example.com', role: 'admin' },
        { accessToken: 'tok-admin' }
      )
    );

    const result = await routeApiRequest('login', {
      body: { email: 'admin@example.com', password: 'admin-pw' },
    });

    expect(result.user.role).toBe('admin');
  });

  test("role: 'member' already on rawUser is preserved", async () => {
    mockApiWrapperLogin.mockResolvedValue(
      makeBcLoginResponse(
        { id: 'u5', email: 'member@example.com', role: 'member' },
        { accessToken: 'tok-mem' }
      )
    );

    const result = await routeApiRequest('login', {
      body: { email: 'member@example.com', password: 'mem-pw' },
    });

    expect(result.user.role).toBe('member');
  });

  test("role: 'admin' is preserved even when roles array is also present (role takes precedence)", async () => {
    // rawUser has both role (explicit) and roles array — role field wins per spread order
    mockApiWrapperLogin.mockResolvedValue(
      makeBcLoginResponse(
        { id: 'u6', email: 'both@example.com', role: 'admin', roles: [] },
        { accessToken: 'tok-both' }
      )
    );

    const result = await routeApiRequest('login', {
      body: { email: 'both@example.com', password: 'pw' },
    });

    // role field takes precedence over roles array in the normalization expression:
    // role: rawUser.role || (Array.isArray(rawUser.roles) && rawUser.roles.includes('csr') ? 'admin' : 'member')
    expect(result.user.role).toBe('admin');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Cookie-session path — BC returns no JWT but session established
// ─────────────────────────────────────────────────────────────────────────────

describe('login normalization — cookie-session (no JWT from BC)', () => {
  test('returns a synthetic accessToken when BC does not issue a JWT', async () => {
    // BC establishes cookie session but returns no accessToken in the payload
    mockApiWrapperLogin.mockResolvedValue(
      makeBcLoginResponse(
        { id: 'u7', email: 'cookie@example.com', roles: [] }
        // no accessToken
      )
    );

    const result = await routeApiRequest('login', {
      body: { email: 'cookie@example.com', password: 'pw' },
    });

    // Should still produce an accessToken (the BC synthetic session token)
    expect(result.accessToken).toBeTruthy();
    expect(result.user.role).toBe('member');
  });

  test('synthetic token for csr user (cookie session) has role admin', async () => {
    mockApiWrapperLogin.mockResolvedValue(
      makeBcLoginResponse(
        { id: 'u8', email: 'csr-cookie@example.com', roles: ['csr'] }
        // no accessToken — cookie session path
      )
    );

    const result = await routeApiRequest('login', {
      body: { email: 'csr-cookie@example.com', password: 'pw' },
    });

    expect(result.accessToken).toBeTruthy();
    expect(result.user.role).toBe('admin');
  });
});
