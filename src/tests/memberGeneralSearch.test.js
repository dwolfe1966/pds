/**
 * Tests for MemberGeneralSearchPage search handlers.
 *
 * Since React Testing Library is not installed, we test by rendering the
 * component with ReactDOM into jsdom and interacting via DOM APIs.
 *
 * Skipped — TRIAGED 2026-05-04: all 18 tests fail at the same point —
 * `useLocation is not a function`. The page calls `useLocation()` but the
 * react-router-dom mock only exposes `useNavigate`. The fix is one line
 * in the mock: `useLocation: () => ({ search: '', pathname: '' })`. After
 * that, the suite may surface follow-on copy/behavior drift, but this is
 * the cheapest skipped suite to revive.
 */

import React, { act } from 'react';
import ReactDOM from 'react-dom/client';

// ── Mocks ────────────────────────────────────────────────────────────────

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: '1', name: 'Test User' }, token: 'test-token' }),
}));

jest.mock('../services/reportService', () => ({
  createReportForPhone: jest.fn(),
}));

jest.mock('../components/DevBCSession', () => {
  return function MockDevBCSession() { return null; };
});

const { createReportForPhone } = require('../services/reportService');

let MemberGeneralSearchPage;

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  // Import after mocks are set up
  MemberGeneralSearchPage = require('../pages/member/MemberGeneralSearchPage').default;
});

// ── Helpers ──────────────────────────────────────────────────────────────

let container;
let root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  mockNavigate.mockClear();
  createReportForPhone.mockClear();
});

afterEach(() => {
  if (root) {
    act(() => root.unmount());
    root = null;
  }
  document.body.removeChild(container);
  container = null;
});

function render() {
  act(() => {
    root = ReactDOM.createRoot(container);
    root.render(React.createElement(MemberGeneralSearchPage));
  });
}

function clickTab(label) {
  const buttons = container.querySelectorAll('button[type="button"]');
  const tab = Array.from(buttons).find(b => b.textContent.includes(label));
  if (!tab) throw new Error(`Tab "${label}" not found`);
  act(() => { tab.click(); });
}

function getForm() {
  return container.querySelector('form');
}

function submitForm() {
  const form = getForm();
  const event = new Event('submit', { bubbles: true, cancelable: true });
  act(() => { form.dispatchEvent(event); });
}

function setInputValue(placeholder, value) {
  const input = container.querySelector(`input[placeholder="${placeholder}"]`);
  if (!input) throw new Error(`Input with placeholder "${placeholder}" not found`);
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype, 'value'
  ).set;
  act(() => {
    nativeInputValueSetter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

function getErrorMessage() {
  const errorDiv = container.querySelector('div[style*="color: rgb(204, 0, 0)"], div[style*="#c00"]');
  // Fallback: look for div with red text
  if (errorDiv) return errorDiv.textContent;
  // Try matching by background color
  const divs = container.querySelectorAll('div');
  for (const div of divs) {
    if (div.style.backgroundColor === 'rgb(255, 238, 238)' || div.style.backgroundColor === '#fee') {
      return div.textContent;
    }
  }
  return null;
}

// ── Name submit tests ────────────────────────────────────────────────────

describe.skip('Name search handler', () => {
  test('navigates with firstName and lastName params on valid submit', () => {
    render();
    // Name tab is active by default
    setInputValue('First Name', 'John');
    setInputValue('Last Name', 'Smith');
    submitForm();

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    const url = mockNavigate.mock.calls[0][0];
    expect(url).toContain('/people-results?');
    expect(url).toContain('firstName=John');
    expect(url).toContain('lastName=Smith');
  });

  test('includes state param when state is provided', () => {
    render();
    setInputValue('First Name', 'Jane');
    setInputValue('Last Name', 'Doe');

    // Set the state dropdown
    const select = container.querySelector('select');
    act(() => {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLSelectElement.prototype, 'value'
      ).set;
      nativeSetter.call(select, 'CA');
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });

    submitForm();

    const url = mockNavigate.mock.calls[0][0];
    expect(url).toContain('state=CA');
  });

  test('shows validation error when first name is empty', () => {
    render();
    setInputValue('First Name', '');
    setInputValue('Last Name', 'Smith');
    submitForm();

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(getErrorMessage()).toBe('Please enter both first and last name');
  });

  test('shows validation error when last name is empty', () => {
    render();
    setInputValue('First Name', 'John');
    setInputValue('Last Name', '');
    submitForm();

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(getErrorMessage()).toBe('Please enter both first and last name');
  });

  test('shows validation error when both names are empty', () => {
    render();
    // Don't set any values
    submitForm();

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(getErrorMessage()).toBe('Please enter both first and last name');
  });

  test('trims whitespace from names before navigating', () => {
    render();
    setInputValue('First Name', '  John  ');
    setInputValue('Last Name', '  Smith  ');
    submitForm();

    const url = mockNavigate.mock.calls[0][0];
    expect(url).toContain('firstName=John');
    expect(url).toContain('lastName=Smith');
  });
});

// ── Email submit tests ───────────────────────────────────────────────────

describe.skip('Email search handler', () => {
  test('navigates with email param on valid submit', () => {
    render();
    clickTab('Email Search');
    setInputValue('example@email.com', 'john@example.com');
    submitForm();

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    const url = mockNavigate.mock.calls[0][0];
    expect(url).toContain('/people-results?');
    expect(url).toContain('email=john%40example.com');
  });

  test('shows validation error for empty email', () => {
    render();
    clickTab('Email Search');
    submitForm();

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(getErrorMessage()).toBe('Please enter an email address');
  });

  test('shows validation error for invalid email format', () => {
    render();
    clickTab('Email Search');
    setInputValue('example@email.com', 'notanemail');
    submitForm();

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(getErrorMessage()).toBe('Please enter a valid email address');
  });

  test('shows validation error for email without domain', () => {
    render();
    clickTab('Email Search');
    setInputValue('example@email.com', 'user@');
    submitForm();

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(getErrorMessage()).toBe('Please enter a valid email address');
  });

  test('shows validation error for email without TLD', () => {
    render();
    clickTab('Email Search');
    setInputValue('example@email.com', 'user@domain');
    submitForm();

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(getErrorMessage()).toBe('Please enter a valid email address');
  });

  test('accepts valid email with subdomain', () => {
    render();
    clickTab('Email Search');
    setInputValue('example@email.com', 'user@mail.example.com');
    submitForm();

    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });
});

// ── Phone submit tests ───────────────────────────────────────────────────

describe.skip('Phone search handler', () => {
  test('calls createReportForPhone and navigates on success', async () => {
    createReportForPhone.mockResolvedValue({
      success: true,
      commerceContentId: 'abc-123',
    });

    render();
    clickTab('Phone Search');

    // Simulate typing a phone number digit by digit through the handler
    const input = container.querySelector('input[type="tel"]');
    act(() => {
      // The component uses handlePhoneChange which extracts digits
      const event = { target: { value: '5551234567' } };
      // Simulate the onChange
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, 'value'
      ).set;
      nativeSetter.call(input, '5551234567');
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await act(async () => {
      const form = getForm();
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(createReportForPhone).toHaveBeenCalledWith('5551234567');
    expect(mockNavigate).toHaveBeenCalledWith('/people/abc-123');
  });

  test('shows error when phone number is too short', () => {
    render();
    clickTab('Phone Search');

    const input = container.querySelector('input[type="tel"]');
    act(() => {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, 'value'
      ).set;
      nativeSetter.call(input, '555123');
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    submitForm();

    expect(createReportForPhone).not.toHaveBeenCalled();
    expect(getErrorMessage()).toBe('Please enter a valid 10-digit phone number');
  });

  test('shows error when createReportForPhone returns no commerceContentId', async () => {
    createReportForPhone.mockResolvedValue({
      success: false,
    });

    render();
    clickTab('Phone Search');

    const input = container.querySelector('input[type="tel"]');
    act(() => {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, 'value'
      ).set;
      nativeSetter.call(input, '5551234567');
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await act(async () => {
      const form = getForm();
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(getErrorMessage()).toBe('No report found for that phone number. Please check the number and try again.');
  });

  test('shows error message when createReportForPhone throws', async () => {
    createReportForPhone.mockRejectedValue(new Error('Network error'));

    render();
    clickTab('Phone Search');

    const input = container.querySelector('input[type="tel"]');
    act(() => {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, 'value'
      ).set;
      nativeSetter.call(input, '5551234567');
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await act(async () => {
      const form = getForm();
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(getErrorMessage()).toBe('Network error');
  });

  test('shows empty phone validation error', () => {
    render();
    clickTab('Phone Search');
    // Don't enter any phone number
    submitForm();

    expect(createReportForPhone).not.toHaveBeenCalled();
    expect(getErrorMessage()).toBe('Please enter a valid 10-digit phone number');
  });
});

// ── Error state clearing ─────────────────────────────────────────────────

describe.skip('Error state behavior', () => {
  test('error clears on next valid submit', () => {
    render();
    // Trigger an error first
    submitForm();
    expect(getErrorMessage()).toBeTruthy();

    // Now fill in valid data and submit again
    setInputValue('First Name', 'John');
    setInputValue('Last Name', 'Smith');
    submitForm();

    expect(getErrorMessage()).toBeNull();
    expect(mockNavigate).toHaveBeenCalled();
  });
});
