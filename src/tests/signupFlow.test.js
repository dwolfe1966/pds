/**
 * SignupPage UI tests.
 *
 * Form is now email + password + optin only — fullName and zip moved to
 * PaymentPage billing form (collected only when the user actually pays).
 * SignupPage delegates submit/state to the shared `useSignup` hook.
 *
 * Heavy mocks for useSignup's side-effecting deps (gtm, loginHistory,
 * visitorSearchLog, trackingService, api.post) so the page assertions stay
 * focused on the form contract.
 */

import React, { act } from 'react';
import ReactDOM from 'react-dom/client';

const mockNavigate = jest.fn();
const mockSetToken = jest.fn();
const mockSetUser = jest.fn();

let mockLocationSearch = '';

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ search: mockLocationSearch }),
  Link: ({ children, to }) => require('react').createElement('a', { href: to }, children),
}));

jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({ setToken: mockSetToken, setUser: mockSetUser }),
}));

const mockApi = {
  signup: jest.fn(),
  createTracking: jest.fn().mockResolvedValue({}),
  post: jest.fn().mockResolvedValue({}),
};

jest.mock('../api', () => ({ __esModule: true, default: mockApi }));

jest.mock('../services/trackingService', () => ({ track: jest.fn() }));
jest.mock('../services/gtm', () => ({
  gtmEvent: jest.fn(),
  gtmSignUp: jest.fn(),
  gtmLogin: jest.fn(),
}));
jest.mock('../services/gtmContext', () => ({ setUser: jest.fn() }));
jest.mock('../services/loginHistory', () => ({ recordLogin: jest.fn() }));
jest.mock('../services/visitorSearchLog', () => ({
  readLog: () => ({ items: [] }),
  clearLog: jest.fn(),
}));

let SignupPage;

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  SignupPage = require('../pages/sales/SignupPage').default;
});

let container, root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  mockLocationSearch = '';
  mockNavigate.mockClear();
  mockSetToken.mockClear();
  mockSetUser.mockClear();
  mockApi.signup.mockReset();
  mockApi.createTracking.mockClear();
  mockApi.post.mockClear();
  sessionStorage.clear();
  localStorage.clear();
  jest.useFakeTimers();
});

afterEach(() => {
  if (root) { act(() => root.unmount()); root = null; }
  document.body.removeChild(container);
  container = null;
  jest.useRealTimers();
});

function render() {
  act(() => {
    root = ReactDOM.createRoot(container);
    root.render(React.createElement(SignupPage));
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

function fillValidForm({ email = 'jane@example.com', password = 'secret123' } = {}) {
  setInputByName('email', email);
  setInputByName('password', password);
}

// ---------------------------------------------------------------------------
// Form rendering
// ---------------------------------------------------------------------------

describe('SignupPage — form rendering', () => {
  test('renders email, password, and optin inputs (no fullName / no zip)', () => {
    render();
    expect(container.querySelector('input[name="email"]')).not.toBeNull();
    expect(container.querySelector('input[name="password"]')).not.toBeNull();
    expect(container.querySelector('input[name="optin"]')).not.toBeNull();
    expect(container.querySelector('input[name="fullName"]')).toBeNull();
    expect(container.querySelector('input[name="zip"]')).toBeNull();
  });

  test('submit button label is "Create My Account"', () => {
    render();
    const btn = container.querySelector('button[type="submit"]');
    expect(btn).not.toBeNull();
    expect(btn.textContent).toContain('Create My Account');
  });

  test('email + password inputs are required', () => {
    render();
    expect(container.querySelector('input[name="email"]').required).toBe(true);
    expect(container.querySelector('input[name="password"]').required).toBe(true);
  });

  test('optin checkbox starts unchecked (opt-in, not opt-out)', () => {
    render();
    expect(container.querySelector('input[name="optin"]').checked).toBe(false);
  });

  test('no teaser banner shown when there is no ?selected= param', () => {
    render();
    expect(container.textContent).not.toContain('unlock');
  });
});

// ---------------------------------------------------------------------------
// Form submission — happy path
// ---------------------------------------------------------------------------

describe('SignupPage — successful signup', () => {
  beforeEach(() => {
    mockApi.signup.mockResolvedValue({
      accessToken: 'tok-abc',
      user: { id: 'u1', email: 'jane@example.com', role: 'member' },
    });
  });

  test('calls api.signup with email, password, optin: false (default)', async () => {
    render();
    fillValidForm();
    await act(async () => { submitForm(); });
    expect(mockApi.signup).toHaveBeenCalledTimes(1);
    expect(mockApi.signup).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'jane@example.com',
        password: 'secret123',
        optin: false,
      })
    );
  });

  test('setToken + setUser called with values from api.signup response', async () => {
    render();
    fillValidForm();
    await act(async () => { submitForm(); });
    expect(mockSetToken).toHaveBeenCalledWith('tok-abc');
    expect(mockSetUser).toHaveBeenCalledTimes(1);
    expect(mockSetUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'jane@example.com', role: 'member' })
    );
  });

  test('renders success panel ("Account Created!") after submit resolves', async () => {
    render();
    fillValidForm();
    await act(async () => { submitForm(); });
    expect(container.textContent).toContain('Account Created!');
    expect(container.querySelector('form')).toBeNull();
  });

  test('writes _pendingPw + _signupOptin to sessionStorage for PaymentPage to consume', async () => {
    render();
    fillValidForm();
    await act(async () => { submitForm(); });
    expect(sessionStorage.getItem('_pendingPw')).toBeTruthy();
    expect(sessionStorage.getItem('_signupOptin')).toBe('0');
  });

  test('no ?selected= → navigates to /dashboard after the success delay', async () => {
    render();
    fillValidForm();
    await act(async () => { submitForm(); });
    act(() => { jest.runAllTimers(); });
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });

  test('?selected=person-abc → stores selectedPersonId and navigates to /payment', async () => {
    mockLocationSearch = '?selected=person-abc';
    render();
    fillValidForm();
    await act(async () => { submitForm(); });
    act(() => { jest.runAllTimers(); });
    expect(sessionStorage.getItem('selectedPersonId')).toBe('person-abc');
    expect(mockNavigate).toHaveBeenCalledWith('/payment');
  });
});

// ---------------------------------------------------------------------------
// Validation + error handling
// ---------------------------------------------------------------------------

describe('SignupPage — validation and errors', () => {
  test('invalid email (no @) blocks submit and shows inline error', async () => {
    render();
    fillValidForm({ email: 'not-an-email' });
    await act(async () => { submitForm(); });
    expect(container.textContent).toContain('Please enter a valid email address');
    expect(mockApi.signup).not.toHaveBeenCalled();
  });

  test('password < 8 chars shows hook error, api.signup not called', async () => {
    render();
    fillValidForm({ password: 'short' });
    await act(async () => { submitForm(); });
    expect(container.textContent).toContain('8 characters');
    expect(mockApi.signup).not.toHaveBeenCalled();
  });

  test('api.signup rejection surfaces the error message', async () => {
    mockApi.signup.mockRejectedValue(new Error('Email already taken on BC side'));
    render();
    fillValidForm();
    await act(async () => { submitForm(); });
    expect(container.textContent).toContain('Email already taken on BC side');
    expect(mockSetToken).not.toHaveBeenCalled();
  });

  test('USER_ALREADY_EXISTS code shows "account ... already exists" with login link', async () => {
    const err = new Error('User already exists');
    err.code = 'USER_ALREADY_EXISTS';
    mockApi.signup.mockRejectedValue(err);
    render();
    fillValidForm();
    await act(async () => { submitForm(); });
    expect(container.textContent).toContain('already exists');
    expect(container.querySelector('a[href="/login"]')).not.toBeNull();
  });

  test('submit button is disabled while signup is in flight', async () => {
    let resolveFn;
    mockApi.signup.mockReturnValue(new Promise((r) => { resolveFn = r; }));
    render();
    fillValidForm();
    act(() => { submitForm(); });
    expect(container.querySelector('button[type="submit"]').disabled).toBe(true);
    expect(container.querySelector('button[type="submit"]').textContent).toContain('Creating account…');
    await act(async () => { resolveFn({ accessToken: 'tok', user: { email: 'jane@example.com', role: 'member' } }); });
  });
});

// ---------------------------------------------------------------------------
// Teaser banner (preserves the selected-person upgrade path)
// ---------------------------------------------------------------------------

describe('SignupPage — selected-person teaser banner', () => {
  test('renders the teaser banner with the person name when ?selected= matches sessionStorage', () => {
    sessionStorage.setItem('result_person-123', JSON.stringify({
      fullName: 'John Smith',
      location: 'New York, NY',
      ageRange: '35-40',
    }));
    mockLocationSearch = '?selected=person-123';
    render();
    expect(container.textContent).toContain('John Smith');
    expect(container.textContent).toContain("unlock");
  });

  test('reads person info from URL params when sessionStorage is empty', () => {
    mockLocationSearch = '?selected=person-456&personName=Alice%20Wonder&personLocation=Denver%2C%20CO';
    render();
    expect(container.textContent).toContain('Alice Wonder');
  });
});
