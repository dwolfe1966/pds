/**
 * Tests for the four signup/auth transition flows.
 *
 * T1: Visitor → Free Member (SignupPage)
 * T2: Visitor → Free Member → Paid (PaymentPage after signup)
 * T3: Visitor → Free Member via Login (LoginPage)
 * T4: Free Member → Paid (authenticated user subscribes from PaymentPage)
 * ByteCrtrs API contract assertions (cross-cutting)
 */

import React, { act } from 'react';
import ReactDOM from 'react-dom/client';

// ─── shared navigate mock ───────────────────────────────────────────────────
const mockNavigate = jest.fn();

// ─── shared auth mock pieces ─────────────────────────────────────────────────
const mockSetToken = jest.fn();
const mockSetUser = jest.fn();
const mockRefreshSubscription = jest.fn();
const mockLogin = jest.fn();

// Mutable auth state — individual suites override this in beforeEach
let mockAuthState = {
  token: null,
  user: null,
  loading: false,
  setToken: mockSetToken,
  setUser: mockSetUser,
  refreshSubscription: mockRefreshSubscription,
  login: mockLogin,
  isPaid: false,
};

// ─── router mock ─────────────────────────────────────────────────────────────
// Mutable search strings — tests set these before rendering to simulate URL params.
// Must be prefixed with 'mock' so Jest's hoisting allows them in factory closures.
let mockLocationSearch = '';
let mockSearchParamsStr = '';

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ search: mockLocationSearch }),
  useSearchParams: () => [new URLSearchParams(mockSearchParamsStr)],
  Link: ({ children, to }) => require('react').createElement('a', { href: to }, children),
}));

// ─── auth context mock ────────────────────────────────────────────────────────
jest.mock('../context/AuthContext', () => ({
  useAuth: () => mockAuthState,
}));

// ─── api mock ─────────────────────────────────────────────────────────────────
const mockApi = {
  signup: jest.fn(),
  billingSignup: jest.fn(),
  billingSale: jest.fn(),
  updateSubscription: jest.fn(),
  login: jest.fn(),
};

jest.mock('../api', () => ({ __esModule: true, default: mockApi }));

// ─── reportService mock (used by PaymentPage) ─────────────────────────────────
jest.mock('../services/reportService', () => ({
  createReportForIdentity: jest.fn().mockResolvedValue({ success: false }),
}));

// ─── trackingService mock ─────────────────────────────────────────────────────
jest.mock('../services/trackingService', () => ({
  track: jest.fn(),
}));

// ─── helpers ─────────────────────────────────────────────────────────────────
let container, root;

function setInputByName(name, value) {
  const input = container.querySelector(`input[name="${name}"]`);
  if (!input) throw new Error(`Input[name="${name}"] not found`);
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

function submitForm() {
  const form = container.querySelector('form');
  act(() => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
}

// Fills the SignupPage with a valid 8+ char password by default
function fillSignupForm({ password = 'secret123' } = {}) {
  setInputByName('fullName', 'Jane Doe');
  setInputByName('zip', '10001');
  setInputByName('email', 'jane@example.com');
  setInputByName('password', password);
}

function fillPaymentForm() {
  setInputByName('cardNumber', '4111111111111111');
  setInputByName('expiry', '12/30');
  setInputByName('cvv', '123');
}

// Default happy-path return values (reset in each suite's beforeEach)
function resetApiMocks() {
  mockApi.signup.mockResolvedValue({
    accessToken: 'tok-abc',
    refreshToken: 'ref-abc',
    user: { id: 'u1', email: 'jane@example.com', fullName: 'Jane Doe', role: 'member' },
  });
  mockApi.billingSignup.mockResolvedValue({ success: true });
  mockApi.billingSale.mockResolvedValue({ success: true, transactionId: 'tx_123' });
  mockApi.updateSubscription.mockResolvedValue({ status: 'active' });
  mockApi.login.mockResolvedValue({
    accessToken: 'tok-login',
    refreshToken: 'ref-login',
    user: { id: 'u1', email: 'jane@example.com', role: 'member' },
  });
  mockRefreshSubscription.mockResolvedValue(undefined);
}

// ─────────────────────────────────────────────────────────────────────────────
// Module handles — loaded once in beforeAll per suite
// ─────────────────────────────────────────────────────────────────────────────

let SignupPage, LoginPage, PaymentPage;

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  SignupPage = require('../pages/sales/SignupPage').default;
  LoginPage = require('../pages/sales/LoginPage').default;
  PaymentPage = require('../pages/sales/PaymentPage').default;
});

// ═════════════════════════════════════════════════════════════════════════════
// T1: Visitor → Free Member (SignupPage)
// ═════════════════════════════════════════════════════════════════════════════

describe.skip('T1: Visitor → Free Member (signup)', () => {
  beforeEach(() => {
    mockLocationSearch = '';
    mockSearchParamsStr = '';
    container = document.createElement('div');
    document.body.appendChild(container);
    jest.useFakeTimers();
    sessionStorage.clear();
    mockNavigate.mockClear();
    mockSetToken.mockClear();
    mockSetUser.mockClear();
    Object.values(mockApi).forEach(fn => fn.mockClear());
    mockAuthState = {
      token: null,
      user: null,
      loading: false,
      setToken: mockSetToken,
      setUser: mockSetUser,
      refreshSubscription: mockRefreshSubscription,
      login: mockLogin,
      isPaid: false,
    };
    resetApiMocks();
    act(() => {
      root = ReactDOM.createRoot(container);
      root.render(React.createElement(SignupPage));
    });
  });

  afterEach(() => {
    if (root) { act(() => root.unmount()); root = null; }
    document.body.removeChild(container);
    container = null;
    jest.useRealTimers();
  });

  test('api.signup() called with correct body including fullName, zip, email, password, optin', async () => {
    fillSignupForm();
    await act(async () => { submitForm(); });
    expect(mockApi.signup).toHaveBeenCalledTimes(1);
    expect(mockApi.signup).toHaveBeenCalledWith(
      expect.objectContaining({
        fullName: 'Jane Doe',
        zip: '10001',
        email: 'jane@example.com',
        password: 'secret123',
        optin: false, // checkbox starts unchecked
      })
    );
  });

  test('api.billingSignup() called with userInfo containing email, firstName, lastName, optin', async () => {
    fillSignupForm();
    await act(async () => { submitForm(); });
    expect(mockApi.billingSignup).toHaveBeenCalledTimes(1);
    expect(mockApi.billingSignup).toHaveBeenCalledWith(
      expect.objectContaining({
        userInfo: expect.objectContaining({
          email: 'jane@example.com',
          firstName: 'Jane',
          lastName: 'Doe',
          optin: false,
        }),
      })
    );
  });

  test('both api.signup() and api.billingSignup() are called on every signup', async () => {
    fillSignupForm();
    await act(async () => { submitForm(); });
    expect(mockApi.signup).toHaveBeenCalledTimes(1);
    expect(mockApi.billingSignup).toHaveBeenCalledTimes(1);
  });

  test('on success: setToken() called with accessToken from api.signup() response', async () => {
    fillSignupForm();
    await act(async () => { submitForm(); });
    expect(mockSetToken).toHaveBeenCalledWith('tok-abc');
  });

  test('on success: setUser() called with user data', async () => {
    fillSignupForm();
    await act(async () => { submitForm(); });
    expect(mockSetUser).toHaveBeenCalledTimes(1);
    // setUser receives the user object from the response
    expect(mockSetUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'jane@example.com' })
    );
  });

  test('on success: navigates to /dashboard when no ?selected= param', async () => {
    fillSignupForm();
    await act(async () => { submitForm(); });
    act(() => { jest.runAllTimers(); });
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });

  test('on success: navigates to /payment when ?selected= param is present', async () => {
    // Set URL params via mutable variables — no resetModules needed
    mockLocationSearch = '?selected=person-abc';
    mockSearchParamsStr = 'selected=person-abc';
    act(() => {
      root.unmount();
      root = ReactDOM.createRoot(container);
      root.render(React.createElement(SignupPage));
    });

    fillSignupForm();
    await act(async () => { submitForm(); });
    act(() => { jest.runAllTimers(); });
    expect(mockNavigate).toHaveBeenCalledWith('/payment');
  });

  test('if password < 8 chars: shows error, neither API called', async () => {
    fillSignupForm({ password: 'short' });
    await act(async () => { submitForm(); });
    expect(container.textContent).toContain('8 characters');
    expect(mockApi.signup).not.toHaveBeenCalled();
    expect(mockApi.billingSignup).not.toHaveBeenCalled();
  });

  test('api.billingSignup() failure does NOT block signup (non-fatal — .catch swallows it)', async () => {
    mockApi.billingSignup.mockRejectedValue(new Error('ByteCrtrs down'));
    fillSignupForm();
    await act(async () => { submitForm(); });
    // signup still succeeds — setToken called, no error shown
    expect(mockSetToken).toHaveBeenCalledWith('tok-abc');
    expect(container.textContent).not.toContain('ByteCrtrs down');
  });

  test('api.signup() failure shows error message', async () => {
    mockApi.signup.mockRejectedValue(new Error('Email already registered'));
    fillSignupForm();
    await act(async () => { submitForm(); });
    expect(container.textContent).toContain('Email already registered');
    expect(mockSetToken).not.toHaveBeenCalled();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// T2: Visitor → Free Member → Paid (PaymentPage after signup)
// ═════════════════════════════════════════════════════════════════════════════

describe.skip('T2: Visitor → Free Member → Paid (PaymentPage)', () => {
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    jest.useFakeTimers();
    sessionStorage.clear();
    mockNavigate.mockClear();
    mockSetToken.mockClear();
    mockSetUser.mockClear();
    mockRefreshSubscription.mockClear();
    Object.values(mockApi).forEach(fn => fn.mockClear());
    mockAuthState = {
      token: 'tok-abc',
      user: { email: 'jane@example.com', fullName: 'Jane Doe', optin: true },
      loading: false,
      setToken: mockSetToken,
      setUser: mockSetUser,
      refreshSubscription: mockRefreshSubscription,
      login: mockLogin,
      isPaid: false,
    };
    resetApiMocks();
    act(() => {
      root = ReactDOM.createRoot(container);
      root.render(React.createElement(PaymentPage));
    });
  });

  afterEach(() => {
    if (root) { act(() => root.unmount()); root = null; }
    document.body.removeChild(container);
    container = null;
    jest.useRealTimers();
  });

  test('api.billingSale() called with card data when form submitted', async () => {
    fillPaymentForm();
    await act(async () => { submitForm(); });
    expect(mockApi.billingSale).toHaveBeenCalledTimes(1);
    expect(mockApi.billingSale).toHaveBeenCalledWith(
      expect.objectContaining({
        billings: expect.arrayContaining([
          expect.objectContaining({
            billingType: 'creditCard',
            creditCard: expect.objectContaining({ pan: expect.any(String) }),
          }),
        ]),
      })
    );
  });

  test('api.billingSale() payload includes cardNumber (pan), expiry fields, cvv', async () => {
    fillPaymentForm();
    await act(async () => { submitForm(); });
    const call = mockApi.billingSale.mock.calls[0][0];
    const creditCard = call.billings[0].creditCard;
    expect(creditCard).toMatchObject({
      pan: expect.stringMatching(/^\d+$/),
      expMonth: expect.stringMatching(/^\d{2}$/),
      expYear: expect.stringMatching(/^\d{2}$/),
      cvv: expect.any(String),
    });
  });

  test('refreshSubscription() called after successful billingSale()', async () => {
    fillPaymentForm();
    await act(async () => { submitForm(); });
    expect(mockRefreshSubscription).toHaveBeenCalled();
  });

  test('on success without selectedPerson: navigates to /dashboard', async () => {
    fillPaymentForm();
    await act(async () => { submitForm(); });
    act(() => { jest.runAllTimers(); });
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });

  test('on success with selectedPersonId in sessionStorage: navigates to /people/:id', async () => {
    sessionStorage.setItem('selectedPersonId', 'pers-999');
    // Re-render so the useEffect picks up the sessionStorage value
    act(() => {
      root.unmount();
      root = ReactDOM.createRoot(container);
      root.render(React.createElement(PaymentPage));
    });
    fillPaymentForm();
    await act(async () => { submitForm(); });
    act(() => { jest.runAllTimers(); });
    expect(mockNavigate).toHaveBeenCalledWith('/people/pers-999');
  });

  test('api.billingSale() failure shows error, does NOT call updateSubscription()', async () => {
    mockApi.billingSale.mockRejectedValue(new Error('Card declined'));
    fillPaymentForm();
    await act(async () => { submitForm(); });
    expect(container.textContent).toContain('Card declined');
    expect(mockApi.updateSubscription).not.toHaveBeenCalled();
  });

  test('api.billingSale() is the ByteCrtrs-forced call — called regardless of feature flags', async () => {
    // PaymentPage always calls api.billingSale (never falls back to mock).
    // This test documents that it is called directly on the api object
    // (not behind any feature-flag guard) and is always invoked on submit.
    fillPaymentForm();
    await act(async () => { submitForm(); });
    expect(mockApi.billingSale).toHaveBeenCalledTimes(1);
    // updateSubscription is NOT called in the normal (non-simulate) success path
    expect(mockApi.updateSubscription).not.toHaveBeenCalled();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// T3: Visitor → Free Member (LoginPage)
// ═════════════════════════════════════════════════════════════════════════════

describe.skip('T3: Visitor → Free Member (login)', () => {
  beforeEach(() => {
    mockLocationSearch = '';
    mockSearchParamsStr = '';
    container = document.createElement('div');
    document.body.appendChild(container);
    jest.useFakeTimers();
    mockNavigate.mockClear();
    mockLogin.mockClear();
    Object.values(mockApi).forEach(fn => fn.mockClear());
    mockAuthState = {
      token: null,
      user: null,
      loading: false,
      setToken: mockSetToken,
      setUser: mockSetUser,
      refreshSubscription: mockRefreshSubscription,
      login: mockLogin,
      isPaid: false,
    };
    resetApiMocks();
    // Default: login succeeds
    mockLogin.mockResolvedValue(undefined);
    act(() => {
      root = ReactDOM.createRoot(container);
      root.render(React.createElement(LoginPage));
    });
  });

  afterEach(() => {
    if (root) { act(() => root.unmount()); root = null; }
    document.body.removeChild(container);
    container = null;
    jest.useRealTimers();
  });

  test('authContext.login() called with email and password from form', async () => {
    setInputByName('email', 'jane@example.com');
    setInputByName('password', 'secret123');
    await act(async () => { submitForm(); });
    expect(mockLogin).toHaveBeenCalledTimes(1);
    expect(mockLogin).toHaveBeenCalledWith('jane@example.com', 'secret123');
  });

  test('on success: navigates to /dashboard', async () => {
    setInputByName('email', 'jane@example.com');
    setInputByName('password', 'secret123');
    await act(async () => { submitForm(); });
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });

  test('on success with ?redirect=/some/path: navigates to that redirect path', async () => {
    mockLocationSearch = '?redirect=%2Fsome%2Fpath';
    mockSearchParamsStr = 'redirect=%2Fsome%2Fpath';
    act(() => {
      root.unmount();
      root = ReactDOM.createRoot(container);
      root.render(React.createElement(LoginPage));
    });

    setInputByName('email', 'jane@example.com');
    setInputByName('password', 'secret123');
    await act(async () => { submitForm(); });
    expect(mockNavigate).toHaveBeenCalledWith('/some/path');
  });

  test('wrong credentials: shows error message, setToken not called', async () => {
    mockLogin.mockRejectedValue(new Error('Invalid email or password'));
    setInputByName('email', 'jane@example.com');
    setInputByName('password', 'wrongpass');
    await act(async () => { submitForm(); });
    expect(container.textContent).toContain('Invalid email or password');
    expect(mockSetToken).not.toHaveBeenCalled();
  });

  test('already authenticated user: redirected away from login page to /dashboard', () => {
    // When token is present, the useEffect fires on mount and navigates away
    if (root) { act(() => root.unmount()); root = null; }
    mockAuthState = {
      ...mockAuthState,
      token: 'existing-token',
      user: { id: 'u1', email: 'jane@example.com' },
      loading: false,
    };
    act(() => {
      root = ReactDOM.createRoot(container);
      root.render(React.createElement(LoginPage));
    });
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
  });

  test('login button shows "Logging in…" while request is in flight', async () => {
    let resolveFn;
    mockLogin.mockReturnValue(new Promise((r) => { resolveFn = r; }));
    setInputByName('email', 'jane@example.com');
    setInputByName('password', 'secret123');
    act(() => { submitForm(); });
    expect(container.querySelector('button[type="submit"]').textContent).toContain('Logging in');
    await act(async () => { resolveFn(undefined); });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// T4: Free Member → Paid (authenticated user subscribes from PaymentPage)
// ═════════════════════════════════════════════════════════════════════════════

describe.skip('T4: Free Member → Paid (authenticated user subscribes)', () => {
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    jest.useFakeTimers();
    sessionStorage.clear();
    mockNavigate.mockClear();
    mockSetToken.mockClear();
    mockSetUser.mockClear();
    mockRefreshSubscription.mockClear();
    Object.values(mockApi).forEach(fn => fn.mockClear());
    mockAuthState = {
      token: 'member-token',
      user: { email: 'jane@example.com', fullName: 'Jane Doe', optin: false },
      loading: false,
      setToken: mockSetToken,
      setUser: mockSetUser,
      refreshSubscription: mockRefreshSubscription,
      login: mockLogin,
      isPaid: false,  // free member, not yet paid
    };
    resetApiMocks();
    act(() => {
      root = ReactDOM.createRoot(container);
      root.render(React.createElement(PaymentPage));
    });
  });

  afterEach(() => {
    if (root) { act(() => root.unmount()); root = null; }
    document.body.removeChild(container);
    container = null;
    jest.useRealTimers();
  });

  test('PaymentPage is accessible when user is authenticated (isPaid=false)', () => {
    // No redirect fired — the form should be rendered
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(container.querySelector('form')).not.toBeNull();
  });

  test('api.billingSale() called (ByteCrtrs — forced regardless of feature flags)', async () => {
    fillPaymentForm();
    await act(async () => { submitForm(); });
    expect(mockApi.billingSale).toHaveBeenCalledTimes(1);
  });

  test('after successful payment: refreshSubscription() called to update isPaid state', async () => {
    fillPaymentForm();
    await act(async () => { submitForm(); });
    expect(mockRefreshSubscription).toHaveBeenCalled();
  });

  test('after successful payment: subscription context can become active (isPaid → true)', async () => {
    // Simulate refreshSubscription updating the context to active
    mockRefreshSubscription.mockImplementationOnce(() => {
      mockAuthState.isPaid = true;
      mockAuthState.subscription = { status: 'active', plan: 'basic' };
      return Promise.resolve();
    });
    fillPaymentForm();
    await act(async () => { submitForm(); });
    // After refresh, the mock state reflects isPaid=true
    expect(mockAuthState.isPaid).toBe(true);
    expect(mockAuthState.subscription).toMatchObject({ status: 'active' });
  });

  test('after successful payment navigates away (confirming PaymentPage no longer blocks)', async () => {
    fillPaymentForm();
    await act(async () => { submitForm(); });
    act(() => { jest.runAllTimers(); });
    // Page navigates, meaning a paid route (/people/:id or /dashboard) becomes accessible
    expect(mockNavigate).toHaveBeenCalled();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// T5: apiRouter callNewAPI('signup') — new signup flow unit tests
//
// These tests exercise the callNewAPI('signup') behaviour directly through the
// api.signup() surface by mocking apiWrapper (ByteCrtrs IIFE) instead of
// mocking api.js.  This lets us verify:
//   - billingSignup called with userInfo (no password)
//   - auth.login({}) called after billingSignup
//   - changePassword called when session is established
//   - graceful degradation when BC session check fails
//   - returned shape: { accessToken, refreshToken: null, user: { role: 'member' } }
// ═════════════════════════════════════════════════════════════════════════════

describe.skip('T5: callNewAPI signup flow (apiRouter unit)', () => {
  // ── Module-level mocks for the apiWrapper ──────────────────────────────────
  const mockWrapperBillingSignup = jest.fn();
  const mockWrapperLogin = jest.fn();
  const mockChangePassword = jest.fn();
  const mockGetWrapper = jest.fn();

  let routeApiRequest;

  beforeEach(() => {
    jest.resetModules();

    // Provide apiWrapper mock with isAvailable() = true so callNewAPI is used
    jest.mock('../services/apiWrapper', () => ({
      __esModule: true,
      default: {
        isAvailable: () => true,
        billingSignup: mockWrapperBillingSignup,
        login: mockWrapperLogin,
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

    jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn() }));
    jest.mock('../context/AuthContext', () => ({
      useAuth: () => ({ user: null, token: null, loading: false, isPaid: false, subscription: null, logout: jest.fn() }),
    }));

    routeApiRequest = require('../services/apiRouter').routeApiRequest;

    // Default happy-path: billingSignup succeeds, login returns a session user
    mockWrapperBillingSignup.mockReset();
    mockWrapperLogin.mockReset();
    mockChangePassword.mockReset();
    mockGetWrapper.mockReset();

    mockWrapperBillingSignup.mockResolvedValue({ success: true });
    mockWrapperLogin.mockResolvedValue({
      getData: () => ({ user: { id: 'bc-u1', email: 'jane@example.com' } }),
      data: { user: { id: 'bc-u1', email: 'jane@example.com' } },
    });
    mockGetWrapper.mockResolvedValue({
      api: { user: { changePassword: mockChangePassword } },
    });
    mockChangePassword.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    localStorage.clear();
  });

  // ── 1. billingSignup called with userInfo containing email/firstName/lastName/optin — NO password ──

  test('billingSignup is called with userInfo: { email, firstName, lastName, optin } and no password field', async () => {
    await routeApiRequest('signup', {
      body: {
        fullName: 'Jane Doe',
        email: 'jane@example.com',
        password: 'secret123',
        optin: false,
      },
    });

    expect(mockWrapperBillingSignup).toHaveBeenCalledTimes(1);
    const callArg = mockWrapperBillingSignup.mock.calls[0][0];
    expect(callArg).toEqual(
      expect.objectContaining({
        userInfo: expect.objectContaining({
          email: 'jane@example.com',
          firstName: 'Jane',
          lastName: 'Doe',
          optin: false,
        }),
      })
    );
    // password must NOT be inside userInfo
    expect(callArg.userInfo).not.toHaveProperty('password');
  });

  test('billingSignup userInfo.optin is true when optin=true is passed', async () => {
    await routeApiRequest('signup', {
      body: {
        fullName: 'Bob Smith',
        email: 'bob@example.com',
        password: 'pass1234',
        optin: true,
      },
    });

    const callArg = mockWrapperBillingSignup.mock.calls[0][0];
    expect(callArg.userInfo.optin).toBe(true);
  });

  // ── 2. auth.login({}) called after billingSignup ──────────────────────────

  test('apiWrapper.login is called with an empty object after billingSignup', async () => {
    await routeApiRequest('signup', {
      body: {
        fullName: 'Jane Doe',
        email: 'jane@example.com',
        password: 'secret123',
        optin: false,
      },
    });

    expect(mockWrapperLogin).toHaveBeenCalledTimes(1);
    expect(mockWrapperLogin).toHaveBeenCalledWith({});
  });

  // ── 3. changePassword called when session is established ─────────────────

  test('wrapper.api.user.changePassword is called with the user password when session is established', async () => {
    await routeApiRequest('signup', {
      body: {
        fullName: 'Jane Doe',
        email: 'jane@example.com',
        password: 'secret123',
        optin: false,
      },
    });

    expect(mockGetWrapper).toHaveBeenCalled();
    expect(mockChangePassword).toHaveBeenCalledTimes(1);
    expect(mockChangePassword).toHaveBeenCalledWith('secret123');
  });

  // ── 4. Graceful degradation when BC session check fails ───────────────────

  test('returns a synthetic token even when auth.login({}) throws (graceful degradation)', async () => {
    mockWrapperLogin.mockRejectedValue(new Error('BC session check unavailable'));

    const result = await routeApiRequest('signup', {
      body: {
        fullName: 'Jane Doe',
        email: 'jane@example.com',
        password: 'secret123',
        optin: false,
      },
    });

    // Should not throw — synthetic token always returned
    expect(result.accessToken).toBeTruthy();
  });

  test('changePassword is NOT called when auth.login({}) fails (no session to attach to)', async () => {
    mockWrapperLogin.mockRejectedValue(new Error('Session check failed'));

    await routeApiRequest('signup', {
      body: {
        fullName: 'Jane Doe',
        email: 'jane@example.com',
        password: 'secret123',
        optin: false,
      },
    });

    expect(mockChangePassword).not.toHaveBeenCalled();
  });

  // ── 5. Returned shape ─────────────────────────────────────────────────────

  test("returned object has shape { accessToken, refreshToken: null, user: { role: 'member', ... } }", async () => {
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
      user: expect.objectContaining({ role: 'member' }),
    });
  });

  test('accessToken in the returned object is a truthy string', async () => {
    const result = await routeApiRequest('signup', {
      body: {
        fullName: 'Alice Wonder',
        email: 'alice@example.com',
        password: 'alicepw1',
        optin: false,
      },
    });

    expect(typeof result.accessToken).toBe('string');
    expect(result.accessToken.length).toBeGreaterThan(0);
  });

  test('user in returned object contains email from signup body', async () => {
    const result = await routeApiRequest('signup', {
      body: {
        fullName: 'Jane Doe',
        email: 'jane@example.com',
        password: 'secret123',
        optin: false,
      },
    });

    expect(result.user.email).toBe('jane@example.com');
  });

  // ── 6. fullName splitting ─────────────────────────────────────────────────

  test('single-word fullName is mapped to firstName with empty lastName', async () => {
    await routeApiRequest('signup', {
      body: {
        fullName: 'Mononym',
        email: 'mono@example.com',
        password: 'pw123456',
        optin: false,
      },
    });

    const callArg = mockWrapperBillingSignup.mock.calls[0][0];
    expect(callArg.userInfo.firstName).toBe('Mononym');
    expect(callArg.userInfo.lastName).toBe('');
  });

  test('three-part fullName has firstName and last two parts joined as lastName', async () => {
    await routeApiRequest('signup', {
      body: {
        fullName: 'Mary Jane Watson',
        email: 'mj@example.com',
        password: 'pw1234567',
        optin: false,
      },
    });

    const callArg = mockWrapperBillingSignup.mock.calls[0][0];
    expect(callArg.userInfo.firstName).toBe('Mary');
    expect(callArg.userInfo.lastName).toBe('Jane Watson');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// ByteCrtrs API contract assertions (cross-cutting)
// ═════════════════════════════════════════════════════════════════════════════

describe.skip('ByteCrtrs API contract', () => {
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    jest.useFakeTimers();
    sessionStorage.clear();
    mockNavigate.mockClear();
    mockSetToken.mockClear();
    mockSetUser.mockClear();
    Object.values(mockApi).forEach(fn => fn.mockClear());
    resetApiMocks();
  });

  afterEach(() => {
    if (root) { act(() => root.unmount()); root = null; }
    document.body.removeChild(container);
    container = null;
    jest.useRealTimers();
  });

  test('billingSignup is called on every signup regardless of REACT_APP_USE_NEW_API_* flags', async () => {
    // billingSignup is in FORCE_NEW_API_ENDPOINTS in apiRouter.js — it bypasses
    // all feature-flag checks and is always routed to ByteCrtrs.
    // This test documents the contract: no env flag can disable it.
    mockAuthState = {
      token: null, user: null, loading: false,
      setToken: mockSetToken, setUser: mockSetUser,
      refreshSubscription: mockRefreshSubscription, login: mockLogin, isPaid: false,
    };
    act(() => {
      root = ReactDOM.createRoot(container);
      root.render(React.createElement(SignupPage));
    });
    fillSignupForm();
    await act(async () => { submitForm(); });
    expect(mockApi.billingSignup).toHaveBeenCalledTimes(1);
  });

  test('billingSale is called on every payment regardless of feature flags', async () => {
    mockAuthState = {
      token: 'tok', user: { email: 'jane@example.com', fullName: 'Jane Doe', optin: false },
      loading: false, setToken: mockSetToken, setUser: mockSetUser,
      refreshSubscription: mockRefreshSubscription, login: mockLogin, isPaid: false,
    };
    act(() => {
      root = ReactDOM.createRoot(container);
      root.render(React.createElement(PaymentPage));
    });
    fillPaymentForm();
    await act(async () => { submitForm(); });
    expect(mockApi.billingSale).toHaveBeenCalledTimes(1);
  });

  test('signup JWT comes from mock api.signup() — billingSignup return value is ignored for auth', async () => {
    // billingSignup registers the user in ByteCrtrs billing system but does NOT
    // provide the JWT. The accessToken for the session comes from mock api.signup().
    // login() however now goes directly to ByteCrtrs (REACT_APP_USE_NEW_API_AUTH=true).
    mockAuthState = {
      token: null, user: null, loading: false,
      setToken: mockSetToken, setUser: mockSetUser,
      refreshSubscription: mockRefreshSubscription, login: mockLogin, isPaid: false,
    };
    mockApi.signup.mockResolvedValue({
      accessToken: 'jwt-from-mock',
      user: { id: 'u1', email: 'jane@example.com' },
    });
    // billingSignup returns something different — it is NOT the source of the JWT
    mockApi.billingSignup.mockResolvedValue({ accessToken: 'jwt-from-bytecrtrs', success: true });

    act(() => {
      root = ReactDOM.createRoot(container);
      root.render(React.createElement(SignupPage));
    });
    fillSignupForm();
    await act(async () => { submitForm(); });

    // The token stored is the one from api.signup(), NOT from billingSignup
    expect(mockApi.signup).toHaveBeenCalledTimes(1);
    expect(mockSetToken).toHaveBeenCalledWith('jwt-from-mock');
    expect(mockSetToken).not.toHaveBeenCalledWith('jwt-from-bytecrtrs');
  });
});
