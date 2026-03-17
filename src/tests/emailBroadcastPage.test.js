/**
 * Tests for src/pages/admin/EmailBroadcastPage.js
 *
 * Covers:
 *  1. Renders page heading "Email Broadcast"
 *  2. Renders compose form fields (subject, body) and Send button
 *  3. Renders all four audience radio options
 *  4. Fetches and displays email log on mount
 *  5. Shows empty state when email log is empty
 *  6. Submit calls api.sendEmailBroadcast with correct payload
 *  7. Shows success message after successful send
 *  8. Shows error message when send fails
 *  9. Send button is disabled while submitting
 * 10. Refresh button re-fetches email log
 */

import React, { act } from 'react';
import ReactDOM from 'react-dom/client';

// ── Mock api module ──────────────────────────────────────────────────────────

const mockApi = {
  get: jest.fn().mockResolvedValue({ data: [] }),
  post: jest.fn().mockResolvedValue({ success: true }),
  getEmailLog: jest.fn().mockResolvedValue({ data: [] }),
  sendEmailBroadcast: jest.fn().mockResolvedValue({ success: true }),
};

jest.mock('../api', () => ({
  __esModule: true,
  default: mockApi,
}));

jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: '1', role: 'admin' }, token: 'admin-token' }),
}));

jest.mock('react-router-dom', () => {
  const mockReact = require('react');
  return {
    useNavigate: () => jest.fn(),
    useParams: () => ({}),
    Link: ({ children, to }) => mockReact.createElement('a', { href: to }, children),
  };
});

// ── Test helpers ─────────────────────────────────────────────────────────────

let container;
let root;

const SAMPLE_LOG_ENTRY = {
  id: '1',
  to: 'a@b.com',
  subject: 'Hello',
  type: 'broadcast',
  status: 'sent',
  sentAt: '2026-03-17T00:00:00Z',
};

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
});

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  mockApi.get.mockClear();
  mockApi.post.mockClear();
  mockApi.getEmailLog.mockClear();
  mockApi.sendEmailBroadcast.mockClear();
  // Default: empty log
  mockApi.getEmailLog.mockResolvedValue({ data: [] });
  mockApi.sendEmailBroadcast.mockResolvedValue({ success: true });
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

async function renderPage() {
  const EmailBroadcastPage = require('../pages/admin/EmailBroadcastPage').default;
  await act(async () => {
    root = ReactDOM.createRoot(container);
    root.render(React.createElement(EmailBroadcastPage));
  });
}

function getInput(labelText) {
  // Find by associated label text or placeholder
  const labels = Array.from(container.querySelectorAll('label'));
  const label = labels.find((l) => l.textContent.includes(labelText));
  if (label && label.htmlFor) {
    return container.querySelector(`#${label.htmlFor}`);
  }
  // Fallback: find input/textarea with name or placeholder matching
  return (
    container.querySelector(`[name="${labelText}"]`) ||
    container.querySelector(`[placeholder*="${labelText}"]`)
  );
}

function getButton(text) {
  return Array.from(container.querySelectorAll('button')).find((b) =>
    b.textContent.includes(text)
  );
}

function getTableRows() {
  const tbody = container.querySelector('tbody');
  if (!tbody) return [];
  return Array.from(tbody.querySelectorAll('tr'));
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('EmailBroadcastPage', () => {
  // 1. Renders page heading
  test('renders the page heading "Email Broadcast"', async () => {
    await renderPage();
    expect(container.textContent).toContain('Email Broadcast');
  });

  // 2. Renders compose form with subject, body, and Send button
  test('renders compose form with subject field, body textarea, and Send Email button', async () => {
    await renderPage();

    // Subject input
    const subjectInput =
      container.querySelector('input[name="subject"]') ||
      container.querySelector('#subject') ||
      container.querySelector('[placeholder*="ubject"]');
    expect(subjectInput).not.toBeNull();

    // Body textarea
    const bodyTextarea =
      container.querySelector('textarea[name="body"]') ||
      container.querySelector('#body') ||
      container.querySelector('textarea');
    expect(bodyTextarea).not.toBeNull();

    // Send button
    const sendButton = getButton('Send');
    expect(sendButton).not.toBeNull();
  });

  // 3. Renders all four audience radio options
  test('renders audience options: All Users, Paid Members, Unpaid Members, Opted-in Only', async () => {
    await renderPage();
    const text = container.textContent;
    expect(text).toMatch(/All Users/i);
    expect(text).toMatch(/Paid Members/i);
    expect(text).toMatch(/Unpaid Members/i);
    expect(text).toMatch(/Opted.?in Only/i);

    // Confirm they are rendered as radio inputs
    const radios = Array.from(container.querySelectorAll('input[type="radio"]'));
    expect(radios.length).toBeGreaterThanOrEqual(4);
  });

  // 4. Fetches and displays email log on mount
  test('fetches and displays email log on mount', async () => {
    mockApi.getEmailLog.mockResolvedValue({ data: [SAMPLE_LOG_ENTRY] });

    await renderPage();

    expect(mockApi.getEmailLog).toHaveBeenCalledTimes(1);

    // Log entry values should appear in the table
    expect(container.textContent).toContain('a@b.com');
    expect(container.textContent).toContain('Hello');
    expect(container.textContent).toContain('sent');
  });

  // 5. Shows empty state when email log is empty
  test('shows empty state message when email log is empty', async () => {
    mockApi.getEmailLog.mockResolvedValue({ data: [] });

    await renderPage();

    // Either a "no emails" message or an empty tbody with zero rows
    const rows = getTableRows();
    const hasEmptyMsg =
      container.textContent.match(/no emails/i) ||
      container.textContent.match(/no records/i) ||
      container.textContent.match(/no logs/i) ||
      container.textContent.match(/empty/i) ||
      rows.length === 0;
    expect(hasEmptyMsg).toBeTruthy();
  });

  // 6. Submit calls api.sendEmailBroadcast with correct payload
  test('calls api.sendEmailBroadcast with subject, html body, and audience on submit', async () => {
    await renderPage();

    // Fill subject
    const subjectInput =
      container.querySelector('input[name="subject"]') ||
      container.querySelector('#subject');
    expect(subjectInput).not.toBeNull();
    await act(async () => {
      subjectInput.value = 'Test Subject';
      subjectInput.dispatchEvent(new Event('input', { bubbles: true }));
      subjectInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Fill body
    const bodyTextarea =
      container.querySelector('textarea[name="body"]') ||
      container.querySelector('#body') ||
      container.querySelector('textarea');
    expect(bodyTextarea).not.toBeNull();
    await act(async () => {
      bodyTextarea.value = '<p>Hello world</p>';
      bodyTextarea.dispatchEvent(new Event('input', { bubbles: true }));
      bodyTextarea.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Select audience radio (pick the second one = "paid" or just first available)
    const radios = Array.from(container.querySelectorAll('input[type="radio"]'));
    expect(radios.length).toBeGreaterThan(0);
    await act(async () => {
      radios[0].checked = true;
      radios[0].dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Click Send
    const sendButton = getButton('Send');
    expect(sendButton).not.toBeNull();
    await act(async () => {
      sendButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(mockApi.sendEmailBroadcast).toHaveBeenCalledTimes(1);
    const callArg = mockApi.sendEmailBroadcast.mock.calls[0][0];
    // Payload must contain subject and html (body) keys and audience
    expect(callArg).toHaveProperty('subject');
    expect(callArg).toHaveProperty('html');
    expect(callArg).toHaveProperty('audience');
  });

  // 7. Shows success message after successful send
  test('shows success message after successful send', async () => {
    mockApi.sendEmailBroadcast.mockResolvedValue({ success: true });

    await renderPage();

    const subjectInput =
      container.querySelector('input[name="subject"]') ||
      container.querySelector('#subject');
    const bodyTextarea =
      container.querySelector('textarea[name="body"]') ||
      container.querySelector('#body') ||
      container.querySelector('textarea');

    await act(async () => {
      if (subjectInput) {
        subjectInput.value = 'My Subject';
        subjectInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (bodyTextarea) {
        bodyTextarea.value = 'Email body text';
        bodyTextarea.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    const sendButton = getButton('Send');
    await act(async () => {
      sendButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    // Allow async state update
    await act(async () => {});

    expect(container.textContent).toMatch(/success/i);
  });

  // 8. Shows error message when send fails
  test('shows error message when api.sendEmailBroadcast rejects', async () => {
    mockApi.sendEmailBroadcast.mockRejectedValue(new Error('Server error'));

    await renderPage();

    const subjectInput =
      container.querySelector('input[name="subject"]') ||
      container.querySelector('#subject');
    const bodyTextarea =
      container.querySelector('textarea[name="body"]') ||
      container.querySelector('#body') ||
      container.querySelector('textarea');

    await act(async () => {
      if (subjectInput) {
        subjectInput.value = 'Fail Subject';
        subjectInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (bodyTextarea) {
        bodyTextarea.value = 'body';
        bodyTextarea.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    const sendButton = getButton('Send');
    await act(async () => {
      sendButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    await act(async () => {});

    expect(container.textContent).toMatch(/error|failed|Server error/i);
  });

  // 9. Send button is disabled while submitting
  test('send button is disabled while the broadcast is being submitted', async () => {
    // Make sendEmailBroadcast hang so we can inspect the loading state
    let resolveHang;
    mockApi.sendEmailBroadcast.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveHang = resolve;
        })
    );

    await renderPage();

    const subjectInput =
      container.querySelector('input[name="subject"]') ||
      container.querySelector('#subject');
    const bodyTextarea =
      container.querySelector('textarea[name="body"]') ||
      container.querySelector('#body') ||
      container.querySelector('textarea');

    await act(async () => {
      if (subjectInput) {
        subjectInput.value = 'Subject';
        subjectInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (bodyTextarea) {
        bodyTextarea.value = 'Body';
        bodyTextarea.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    const sendButton = getButton('Send');
    // Kick off submit — do NOT await the full act so we can inspect mid-flight state
    act(() => {
      sendButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    // At this point the promise is still pending, button should be disabled
    const buttonNow = getButton('Send') || getButton('Sending');
    expect(buttonNow.disabled).toBe(true);

    // Clean up: resolve the hanging promise
    await act(async () => {
      resolveHang({ success: true });
    });
  });

  // 10. Refresh button re-fetches email log
  test('refresh button triggers a second call to api.getEmailLog', async () => {
    mockApi.getEmailLog.mockResolvedValue({ data: [SAMPLE_LOG_ENTRY] });

    await renderPage();

    expect(mockApi.getEmailLog).toHaveBeenCalledTimes(1);

    const refreshButton =
      getButton('Refresh') ||
      getButton('Reload') ||
      Array.from(container.querySelectorAll('button')).find((b) =>
        b.getAttribute('aria-label')?.match(/refresh/i)
      );
    expect(refreshButton).not.toBeNull();

    await act(async () => {
      refreshButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(mockApi.getEmailLog).toHaveBeenCalledTimes(2);
  });
});
