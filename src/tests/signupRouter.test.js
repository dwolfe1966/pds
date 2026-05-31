/**
 * apiRouter signup routing unit tests.
 *
 * The /signup endpoint is in FORCE_NEW_API_ENDPOINTS (apiRouter.js:251), so it
 * runs against the BC IIFE branch. Critically, it does NOT call BC's
 * billingSignup or login — calling billing.signup before billing.sale would
 * register the user as a "member" first, then billing.sale would reject with
 * `status: "rejected"` because the offer has `nonMemberOnly: true`. Instead,
 * the router mints a synthetic app-level session token so the user can navigate
 * to PaymentPage; the real BC user is created inside billing.sale.
 *
 * These tests pin that contract — if anyone re-introduces a billingSignup or
 * login call on the signup path, billing.sale will start rejecting in
 * production and trial signups will silently fail.
 */

const mockApiWrapperBillingSignup = jest.fn();
const mockApiWrapperLogin = jest.fn();
const mockApiWrapperChangePassword = jest.fn();
const mockGetWrapper = jest.fn();

jest.mock('../services/apiWrapper', () => ({
  __esModule: true,
  default: {
    isAvailable: () => true,
    billingSignup: mockApiWrapperBillingSignup,
    login: mockApiWrapperLogin,
    logout: jest.fn().mockResolvedValue({ success: true }),
    searchTeaser: jest.fn(),
    createReport: jest.fn(),
    getReportDetail: jest.fn(),
    getReportList: jest.fn(),
    sale: jest.fn(),
    requestOptOut: jest.fn(),
    confirmOptOut: jest.fn(),
    searchOptOut: jest.fn(),
    downloadPdfReport: jest.fn(),
    getWrapper: mockGetWrapper,
  },
}));

const { routeApiRequest } = require('../services/apiRouter');

beforeEach(() => {
  mockApiWrapperBillingSignup.mockReset();
  mockApiWrapperLogin.mockReset();
  mockApiWrapperChangePassword.mockReset();
  mockGetWrapper.mockReset();
  localStorage.clear();
});

describe('apiRouter signup — synthetic-token contract', () => {
  test('returns { accessToken, refreshToken: null, user: { role: "member", ... } }', async () => {
    const result = await routeApiRequest('signup', {
      body: {
        fullName: 'Jane Doe',
        email: 'jane@example.com',
        password: 'secret123',
        optin: false,
      },
    });
    expect(result).toMatchObject({
      accessToken: expect.any(String),
      refreshToken: null,
      user: expect.objectContaining({ role: 'member', email: 'jane@example.com' }),
    });
  });

  test('accessToken is a non-empty string', async () => {
    const result = await routeApiRequest('signup', {
      body: { fullName: 'Alice Wonder', email: 'alice@example.com', password: 'pw123456', optin: false },
    });
    expect(typeof result.accessToken).toBe('string');
    expect(result.accessToken.length).toBeGreaterThan(0);
  });

  test('user.email mirrors the input body email', async () => {
    const result = await routeApiRequest('signup', {
      body: { fullName: 'Jane Doe', email: 'jane@example.com', password: 'secret123', optin: false },
    });
    expect(result.user.email).toBe('jane@example.com');
  });
});

describe('apiRouter signup — fullName parsing', () => {
  test('"Jane Doe" splits into firstName: "Jane", lastName: "Doe"', async () => {
    const { user } = await routeApiRequest('signup', {
      body: { fullName: 'Jane Doe', email: 'jane@example.com', password: 'pw1234567', optin: false },
    });
    expect(user.firstName).toBe('Jane');
    expect(user.lastName).toBe('Doe');
  });

  test('single-word "Mononym" → firstName: "Mononym", lastName: ""', async () => {
    const { user } = await routeApiRequest('signup', {
      body: { fullName: 'Mononym', email: 'mono@example.com', password: 'pw123456', optin: false },
    });
    expect(user.firstName).toBe('Mononym');
    expect(user.lastName).toBe('');
  });

  test('three-part "Mary Jane Watson" → firstName: "Mary", lastName: "Jane Watson"', async () => {
    const { user } = await routeApiRequest('signup', {
      body: { fullName: 'Mary Jane Watson', email: 'mj@example.com', password: 'pw1234567', optin: false },
    });
    expect(user.firstName).toBe('Mary');
    expect(user.lastName).toBe('Jane Watson');
  });

  test('explicit firstName/lastName in body override the fullName split', async () => {
    const { user } = await routeApiRequest('signup', {
      body: {
        fullName: 'Wrong Split',
        firstName: 'Real',
        lastName: 'Name',
        email: 'x@example.com',
        password: 'pw1234567',
        optin: false,
      },
    });
    expect(user.firstName).toBe('Real');
    expect(user.lastName).toBe('Name');
  });

  test('missing fullName produces empty firstName + lastName (does not throw)', async () => {
    const { user } = await routeApiRequest('signup', {
      body: { email: 'x@example.com', password: 'pw1234567', optin: false },
    });
    expect(user.firstName).toBe('');
    expect(user.lastName).toBe('');
  });
});

describe('apiRouter signup — does NOT touch BC IIFE', () => {
  test('apiWrapper.billingSignup is never called (prevents nonMemberOnly rejection on billing.sale)', async () => {
    await routeApiRequest('signup', {
      body: { fullName: 'Jane Doe', email: 'jane@example.com', password: 'secret123', optin: false },
    });
    expect(mockApiWrapperBillingSignup).not.toHaveBeenCalled();
  });

  test('apiWrapper.login is never called (no BC session at signup; billing.sale establishes it)', async () => {
    await routeApiRequest('signup', {
      body: { fullName: 'Jane Doe', email: 'jane@example.com', password: 'secret123', optin: false },
    });
    expect(mockApiWrapperLogin).not.toHaveBeenCalled();
  });
});
