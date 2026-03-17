/**
 * Tests for the Notification Preferences section of
 * src/pages/member/SettingsPage.js
 *
 * Covers:
 *  1. Renders Notification Preferences section with three toggles
 *  2. Toggles can be checked/unchecked
 *  3. "Save Preferences" calls api.post with the correct payload
 *  4. Shows success message after save
 *  5. Shows error message if save fails
 */

import React, { act } from 'react';
import ReactDOM from 'react-dom/client';

// ── Mock api module ──────────────────────────────────────────────────────────

const mockApi = {
  get: jest.fn().mockResolvedValue({ data: {} }),
  post: jest.fn().mockResolvedValue({ success: true }),
  put: jest.fn().mockResolvedValue({ success: true }),
};

jest.mock('../api', () => ({
  __esModule: true,
  default: mockApi,
}));

jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: '1', role: 'member' }, token: 'member-token' }),
}));

jest.mock('react-router-dom', () => {
  const mockReact = require('react');
  return {
    useNavigate: () => jest.fn(),
    useParams: () => ({}),
    Link: ({ children, to }) => mockReact.createElement('a', { href: to }, children),
  };
});

// ── Helpers ───────────────────────────────────────────────────────────────────

let container;
let root;

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
});

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  mockApi.post.mockClear();
  mockApi.put.mockClear();
  mockApi.get.mockClear();
  mockApi.post.mockResolvedValue({ success: true });
});

afterEach(() => {
  if (root) {
    act(() => root.unmount());
    root = null;
  }
  document.body.removeChild(container);
  container = null;
  jest.clearAllMocks();
});

async function renderSettingsPage() {
  const SettingsPage = require('../pages/member/SettingsPage').default;
  await act(async () => {
    root = ReactDOM.createRoot(container);
    root.render(React.createElement(SettingsPage));
  });
}

function getCheckbox(id) {
  return container.querySelector(`#${id}`);
}

function getSavePrefsButton() {
  return Array.from(container.querySelectorAll('button')).find((b) =>
    b.textContent.includes('Save Preferences')
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SettingsPage — Notification Preferences', () => {
  // 1. Section and three toggles are present
  test('renders Notification Preferences section with emailAlerts, weeklyDigest, and marketingEmails toggles', async () => {
    await renderSettingsPage();

    // Section heading
    expect(container.textContent).toContain('Notification Preferences');

    // Three checkbox toggles by id
    expect(getCheckbox('emailAlerts')).not.toBeNull();
    expect(getCheckbox('weeklyDigest')).not.toBeNull();
    expect(getCheckbox('marketingEmails')).not.toBeNull();

    // Human-readable labels
    expect(container.textContent).toMatch(/Email me when an alert is triggered/i);
    expect(container.textContent).toMatch(/Weekly activity digest/i);
    expect(container.textContent).toMatch(/Promotional emails/i);
  });

  // 2. Toggles can be changed
  test('toggling emailAlerts checkbox changes its checked state', async () => {
    await renderSettingsPage();

    const emailAlertsBox = getCheckbox('emailAlerts');
    // Default from SettingsPage initial state: emailAlerts = true
    expect(emailAlertsBox.checked).toBe(true);

    await act(async () => {
      emailAlertsBox.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      emailAlertsBox.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(getCheckbox('emailAlerts').checked).toBe(false);
  });

  test('toggling weeklyDigest checkbox changes its checked state', async () => {
    await renderSettingsPage();

    const weeklyDigestBox = getCheckbox('weeklyDigest');
    // Default: weeklyDigest = false
    expect(weeklyDigestBox.checked).toBe(false);

    await act(async () => {
      weeklyDigestBox.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      weeklyDigestBox.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(getCheckbox('weeklyDigest').checked).toBe(true);
  });

  test('toggling marketingEmails checkbox changes its checked state', async () => {
    await renderSettingsPage();

    const marketingBox = getCheckbox('marketingEmails');
    // Default: marketingEmails = false
    expect(marketingBox.checked).toBe(false);

    await act(async () => {
      marketingBox.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      marketingBox.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(getCheckbox('marketingEmails').checked).toBe(true);
  });

  // 3. "Save Preferences" calls api.post with correct payload
  test('clicking Save Preferences calls api.post("/notifications", { body: notifPrefs, token })', async () => {
    await renderSettingsPage();

    // Toggle weeklyDigest on so we have a non-default state to assert
    await act(async () => {
      const box = getCheckbox('weeklyDigest');
      box.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      box.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const saveBtn = getSavePrefsButton();
    expect(saveBtn).not.toBeNull();

    await act(async () => {
      saveBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(mockApi.post).toHaveBeenCalledTimes(1);

    const [path, options] = mockApi.post.mock.calls[0];
    expect(path).toBe('/notifications');
    expect(options).toHaveProperty('token', 'member-token');
    expect(options).toHaveProperty('body');
    expect(options.body).toHaveProperty('emailAlerts');
    expect(options.body).toHaveProperty('weeklyDigest');
    expect(options.body).toHaveProperty('marketingEmails');
    // weeklyDigest was toggled to true
    expect(options.body.weeklyDigest).toBe(true);
  });

  test('Save Preferences passes current toggle values in body', async () => {
    await renderSettingsPage();

    // Toggle all three: emailAlerts off, weeklyDigest on, marketingEmails on
    await act(async () => {
      const emailBox = getCheckbox('emailAlerts');
      emailBox.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      emailBox.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await act(async () => {
      const weeklyBox = getCheckbox('weeklyDigest');
      weeklyBox.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      weeklyBox.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await act(async () => {
      const mktBox = getCheckbox('marketingEmails');
      mktBox.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      mktBox.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await act(async () => {
      getSavePrefsButton().dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const [, options] = mockApi.post.mock.calls[0];
    expect(options.body.emailAlerts).toBe(false);
    expect(options.body.weeklyDigest).toBe(true);
    expect(options.body.marketingEmails).toBe(true);
  });

  // 4. Shows success message after save
  test('shows "Preferences saved successfully" after a successful save', async () => {
    mockApi.post.mockResolvedValue({ success: true });

    await renderSettingsPage();

    await act(async () => {
      getSavePrefsButton().dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    await act(async () => {});

    expect(container.textContent).toContain('Preferences saved successfully');
  });

  // 5. Shows error message when save fails
  test('shows error message when api.post rejects', async () => {
    mockApi.post.mockRejectedValue(new Error('Network failure'));

    await renderSettingsPage();

    await act(async () => {
      getSavePrefsButton().dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    await act(async () => {});

    expect(container.textContent).toMatch(/Network failure|Failed to save preferences/i);
  });

  test('shows fallback error "Failed to save preferences" when rejection has no message', async () => {
    mockApi.post.mockRejectedValue({});

    await renderSettingsPage();

    await act(async () => {
      getSavePrefsButton().dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    await act(async () => {});

    expect(container.textContent).toContain('Failed to save preferences');
  });
});
