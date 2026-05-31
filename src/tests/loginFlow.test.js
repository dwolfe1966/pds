/**
 * LoginPage UI tests.
 *
 * LoginPage delegates auth to AuthContext.login(email, password) and reads
 * a ?redirect= query param to choose the post-login destination. Already-
 * authenticated users are bounced away by the auth-redirect effect.
 *
 * Extracted from the old signupTransitions T3 block (which was skipped after
 * SignupPage drift). The login surface is independent of useSignup, so it
 * stays in its own file.
 */

import React, { act } from 'react';
import ReactDOM from 'react-dom/client';

const mockNavigate = jest.fn();
const mockSetToken = jest.fn();
const mockSetUser = jest.fn();
const mockLogin = jest.fn();

let mockAuthState = {
  token: null,
  user: null,
  loading: false,
  setToken: mockSetToken,
  setUser: mockSetUser,
  login: mockLogin,
};

let mockSearchParamsStr = '';

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useSearchParams: () => [new URLSearchParams(mockSearchParamsStr)],
  Link: ({ children, to }) => require('react').createElement('a', { href: to }, children),
}));

jest.mock('../context/AuthContext', () => ({
  useAuth: () => mockAuthState,
}));

jest.mock('../services/trackingService', () => ({ track: jest.fn() }));
jest.mock('../services/gtm', () => ({
  gtmLogin: jest.fn(),
  gtmEvent: jest.fn(),
  gtmSignUp: jest.fn(),
}));
jest.mock('../services/loginHistory', () => ({ recordLogin: jest.fn() }));

let LoginPage;

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  LoginPage = require('../pages/sales/LoginPage').default;
});

let container, root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  mockSearchParamsStr = '';
  mockNavigate.mockClear();
  mockSetToken.mockClear();
  mockSetUser.mockClear();
  mockLogin.mockReset();
  mockLogin.mockResolvedValue({ id: 'u1', email: 'jane@example.com', role: 'member' });
  mockAuthState = {
    token: null,
    user: null,
    loading: false,
    setToken: mockSetToken,
    setUser: mockSetUser,
    login: mockLogin,
  };
});

afterEach(() => {
  if (root) { act(() => root.unmount()); root = null; }
  document.body.removeChild(container);
  container = null;
});

function render() {
  act(() => {
    root = ReactDOM.createRoot(container);
    root.render(React.createElement(LoginPage));
  });
}

function submitForm() {
  const form = container.querySelector('form');
  act(() => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
}

function setInputByName(name, value) {
  const input = container.querySelector(`input[name="${name}"]`);
  if (!input) throw new Error(`Input[name="${name}"] not found`);
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

describe('LoginPage — submit + auth call', () => {
  test('AuthContext.login() is called with email and password from the form', async () => {
    render();
    setInputByName('email', 'jane@example.com');
    setInputByName('password', 'secret123');
    await act(async () => { submitForm(); });
    expect(mockLogin).toHaveBeenCalledTimes(1);
    expect(mockLogin).toHaveBeenCalledWith('jane@example.com', 'secret123');
  });

  test('on success: navigates to /dashboard by default', async () => {
    render();
    setInputByName('email', 'jane@example.com');
    setInputByName('password', 'secret123');
    await act(async () => { submitForm(); });
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });

  test('on success with ?redirect=/some/path: navigates to that path (decoded)', async () => {
    mockSearchParamsStr = 'redirect=%2Fsome%2Fpath';
    render();
    setInputByName('email', 'jane@example.com');
    setInputByName('password', 'secret123');
    await act(async () => { submitForm(); });
    expect(mockNavigate).toHaveBeenCalledWith('/some/path');
  });
});

describe('LoginPage — error + loading states', () => {
  test('wrong credentials: surfaces error message, setToken not called', async () => {
    mockLogin.mockRejectedValue(new Error('Invalid email or password'));
    render();
    setInputByName('email', 'jane@example.com');
    setInputByName('password', 'wrongpass');
    await act(async () => { submitForm(); });
    expect(container.textContent).toContain('Invalid email or password');
    expect(mockSetToken).not.toHaveBeenCalled();
  });

  test('submit button shows "Logging in…" while request is in flight', async () => {
    let resolveFn;
    mockLogin.mockReturnValue(new Promise((r) => { resolveFn = r; }));
    render();
    setInputByName('email', 'jane@example.com');
    setInputByName('password', 'secret123');
    act(() => { submitForm(); });
    const btn = container.querySelector('button[type="submit"]');
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toContain('Logging in');
    await act(async () => { resolveFn({ id: 'u1', email: 'jane@example.com', role: 'member' }); });
  });
});

describe('LoginPage — already-authenticated redirect', () => {
  test('user with token is bounced to /dashboard with { replace: true } on mount', () => {
    mockAuthState = {
      ...mockAuthState,
      token: 'existing-token',
      user: { id: 'u1', email: 'jane@example.com' },
      loading: false,
    };
    render();
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
  });

  test('auth still loading: no redirect fires (waits for auth resolution)', () => {
    mockAuthState = { ...mockAuthState, token: null, user: null, loading: true };
    render();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
