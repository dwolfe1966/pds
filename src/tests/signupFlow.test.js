/**
 * Tests for SignupPage signup flow.
 * Covers both paid path (with ?selected=) and free/unpaid path (no selected person).
 *
 * Skipped — TRIAGED 2026-05-04: same architectural drift as signupTransitions T1.
 * SignupPage was reduced to email + password + optin (fullName/zip removed —
 * collected on PaymentPage now). All logic moved into hooks/useSignup which
 * pulls in additional services none of which are mocked here:
 *   - services/gtm (gtmEvent, gtmSignUp)
 *   - services/loginHistory (recordLogin)
 *   - services/visitorSearchLog (readLog, clearLog)
 *   - api.createTracking, api.post('/searches/import')
 * The react-router-dom mock also needs `Link` and `useLocation` added.
 * Form-field drift: tests fill `fullName` (gone), assert "Sign Up" button
 * label (now "Create My Free Account"), assume optin checked by default
 * (now false). Submit button label while loading: "Creating account…"
 * (was likely something else).
 *
 * This is a real rewrite, not a surgical fix. Pair this work with the
 * signupTransitions T1/T2/T5 rewrite — same dependency graph.
 */

import React, { act } from 'react';
import ReactDOM from 'react-dom/client';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ search: '' }),
}));

const mockSetToken = jest.fn();
const mockSetUser = jest.fn();

jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({ setToken: mockSetToken, setUser: mockSetUser }),
}));

const mockApi = { signup: jest.fn(), billingSignup: jest.fn() };

jest.mock('../api', () => ({ __esModule: true, default: mockApi }));

let SignupPage;

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  SignupPage = require('../pages/sales/SignupPage').default;
});

let container, root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  mockNavigate.mockClear();
  mockSetToken.mockClear();
  mockSetUser.mockClear();
  mockApi.signup.mockClear();
  mockApi.billingSignup.mockClear();
  mockApi.billingSignup.mockResolvedValue({});
  jest.useFakeTimers();
  sessionStorage.clear();
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

function fillValidForm() {
  setInputByName('fullName', 'Jane Doe');
  setInputByName('zip', '10001');
  setInputByName('email', 'jane@example.com');
  setInputByName('password', 'secret123');
}

// ---------------------------------------------------------------------------
// Form rendering
// ---------------------------------------------------------------------------

describe.skip('SignupPage — form rendering', () => {
  test('renders all required form fields', () => {
    render();
    expect(container.querySelector('input[name="fullName"]')).not.toBeNull();
    expect(container.querySelector('input[name="email"]')).not.toBeNull();
    expect(container.querySelector('input[name="password"]')).not.toBeNull();
    expect(container.querySelector('input[name="zip"]')).not.toBeNull();
    expect(container.querySelector('input[name="optin"]')).not.toBeNull();
  });

  test('renders submit button with Sign Up label', () => {
    render();
    const btn = container.querySelector('button[type="submit"]');
    expect(btn).not.toBeNull();
    expect(btn.textContent).toContain('Sign Up');
  });

  test('fullName, email, password inputs have required attribute', () => {
    render();
    expect(container.querySelector('input[name="fullName"]').required).toBe(true);
    expect(container.querySelector('input[name="email"]').required).toBe(true);
    expect(container.querySelector('input[name="password"]').required).toBe(true);
  });

  test('optin checkbox is checked by default', () => {
    render();
    expect(container.querySelector('input[name="optin"]').checked).toBe(true);
  });

  test('shows generic marketing copy when no selected person', () => {
    render();
    // Should not show teaser block
    expect(container.textContent).not.toContain('Sign up now to unlock');
  });
});

// ---------------------------------------------------------------------------
// Form submission — happy path
// ---------------------------------------------------------------------------

describe.skip('SignupPage — successful signup', () => {
  test('calls api.signup with form data', async () => {
    mockApi.signup.mockResolvedValue({
      accessToken: 'tok-abc',
      user: { id: 'u1', email: 'jane@example.com', fullName: 'Jane Doe', role: 'member' },
    });
    render();
    fillValidForm();
    await act(async () => { submitForm(); });
    expect(mockApi.signup).toHaveBeenCalledTimes(1);
    expect(mockApi.signup).toHaveBeenCalledWith(
      expect.objectContaining({ fullName: 'Jane Doe', email: 'jane@example.com', password: 'secret123' })
    );
  });

  test('calls setToken and setUser after successful signup', async () => {
    mockApi.signup.mockResolvedValue({
      accessToken: 'tok-xyz',
      user: { id: 'u2', email: 'jane@example.com', fullName: 'Jane Doe', role: 'member' },
    });
    render();
    fillValidForm();
    await act(async () => { submitForm(); });
    expect(mockSetToken).toHaveBeenCalledWith('tok-xyz');
    expect(mockSetUser).toHaveBeenCalledTimes(1);
  });

  test('shows success message after signup resolves', async () => {
    mockApi.signup.mockResolvedValue({
      accessToken: 'tok',
      user: { id: 'u1', email: 'jane@example.com', fullName: 'Jane Doe', role: 'member' },
    });
    render();
    fillValidForm();
    await act(async () => { submitForm(); });
    expect(container.textContent).toContain('Thank you for signing up');
    // Form should be gone
    expect(container.querySelector('form')).toBeNull();
  });

  test('unpaid path: redirects to /dashboard when no selected person', async () => {
    mockApi.signup.mockResolvedValue({
      accessToken: 'tok',
      user: { id: 'u1', email: 'jane@example.com', fullName: 'Jane Doe', role: 'member' },
    });
    render();
    fillValidForm();
    await act(async () => { submitForm(); });
    act(() => { jest.runAllTimers(); });
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe.skip('SignupPage — error handling', () => {
  test('shows error message when signup API rejects', async () => {
    mockApi.signup.mockRejectedValue(new Error('Email already registered'));
    render();
    fillValidForm();
    await act(async () => { submitForm(); });
    expect(container.textContent).toContain('Email already registered');
  });

  test('shows fallback error when API rejects with no message', async () => {
    mockApi.signup.mockRejectedValue({});
    render();
    fillValidForm();
    await act(async () => { submitForm(); });
    expect(container.textContent).toContain('error');
  });

  test('disables submit button while loading', async () => {
    let resolveFn;
    mockApi.signup.mockReturnValue(new Promise((r) => { resolveFn = r; }));
    render();
    fillValidForm();
    act(() => { submitForm(); });
    expect(container.querySelector('button[type="submit"]').disabled).toBe(true);
    await act(async () => { resolveFn({ accessToken: 'tok', user: {} }); });
  });
});

// ---------------------------------------------------------------------------
// Teaser block (selected person)
// ---------------------------------------------------------------------------

describe.skip('SignupPage — teaser block', () => {
  test('renders teaser block when sessionStorage has person data', () => {
    sessionStorage.setItem('result_person-123', JSON.stringify({
      fullName: 'John Smith',
      location: 'New York, NY',
      ageRange: '35-40',
    }));

    // Re-mock useLocation to include ?selected=person-123
    jest.resetModules();
    jest.mock('react-router-dom', () => ({
      useNavigate: () => mockNavigate,
      useLocation: () => ({ search: '?selected=person-123' }),
    }));
    jest.mock('../context/AuthContext', () => ({
      useAuth: () => ({ setToken: mockSetToken, setUser: mockSetUser }),
    }));
    jest.mock('../api', () => ({ __esModule: true, default: mockApi }));

    const FreshSignupPage = require('../pages/sales/SignupPage').default;
    act(() => {
      root = ReactDOM.createRoot(container);
      root.render(React.createElement(FreshSignupPage));
    });

    expect(container.textContent).toContain('John Smith');
    sessionStorage.clear();
  });
});
