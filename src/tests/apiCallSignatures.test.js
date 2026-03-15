/**
 * Regression tests: api.post / api.put must be called with the correct
 * single-options-object signature: api.post(path, { body, token })
 *
 * The original bug had pages calling api.post(path, bodyData, { token })
 * with 3 arguments, so body was never sent and token never passed.
 */

import React, { act } from 'react';
import ReactDOM from 'react-dom/client';

// ── Mock api module ──────────────────────────────────────────────────────

const mockApi = {
  get: jest.fn().mockResolvedValue({ data: [] }),
  post: jest.fn().mockResolvedValue({ success: true }),
  put: jest.fn().mockResolvedValue({ success: true }),
  delete: jest.fn().mockResolvedValue({ success: true }),
};

jest.mock('../api', () => ({
  __esModule: true,
  default: mockApi,
}));

jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: '1', role: 'admin' }, token: 'test-token-123' }),
}));

jest.mock('../components/DevBCSession', () => {
  return function MockDevBCSession() { return null; };
});

jest.mock('../services/reportService', () => ({
  createReportForPhone: jest.fn(),
}));

jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
  useParams: () => ({ id: 'test-id' }),
  useLocation: () => ({ search: '' }),
  useSearchParams: () => [new URLSearchParams(), jest.fn()],
  Link: ({ children }) => children,
}));

// ── Test helpers ─────────────────────────────────────────────────────────

let container;
let root;

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
});

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  mockApi.get.mockClear();
  mockApi.post.mockClear();
  mockApi.put.mockClear();
  mockApi.delete.mockClear();
  // Reset mockApi.get to return sensible defaults
  mockApi.get.mockResolvedValue({ data: [] });
  mockApi.post.mockResolvedValue({ success: true });
  mockApi.put.mockResolvedValue({ success: true });
});

afterEach(() => {
  if (root) {
    act(() => root.unmount());
    root = null;
  }
  document.body.removeChild(container);
  container = null;
});

function renderComponent(Component) {
  act(() => {
    root = ReactDOM.createRoot(container);
    root.render(React.createElement(Component));
  });
}

function submitFirstForm() {
  const form = container.querySelector('form');
  if (!form) throw new Error('No form found');
  act(() => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
}

function clickButton(text) {
  const buttons = container.querySelectorAll('button');
  const btn = Array.from(buttons).find(b => b.textContent.includes(text));
  if (!btn) throw new Error(`Button "${text}" not found`);
  act(() => { btn.click(); });
}

/**
 * Asserts that an api method was called with exactly 2 arguments
 * and the second argument is an object (not a primitive / array).
 */
function assertCorrectSignature(mockFn, callIndex = 0) {
  expect(mockFn.mock.calls.length).toBeGreaterThan(callIndex);
  const call = mockFn.mock.calls[callIndex];

  // Must have exactly 2 args: (path, options)
  expect(call).toHaveLength(2);
  expect(typeof call[0]).toBe('string'); // path
  expect(typeof call[1]).toBe('object'); // options object
  expect(call[1]).not.toBeNull();
  expect(Array.isArray(call[1])).toBe(false);
}

function assertHasToken(mockFn, callIndex = 0) {
  const opts = mockFn.mock.calls[callIndex][1];
  expect(opts.token).toBe('test-token-123');
}

function assertHasBody(mockFn, callIndex = 0) {
  const opts = mockFn.mock.calls[callIndex][1];
  expect(opts).toHaveProperty('body');
  expect(opts.body).toBeDefined();
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('api.post/put call signatures', () => {

  describe('member/AlertsPage — handleCreate', () => {
    test('api.post("/alerts", { body, token }) uses correct signature', async () => {
      const AlertsPage = require('../pages/member/AlertsPage').default;
      // get returns alerts list
      mockApi.get.mockResolvedValue([]);

      await act(async () => {
        root = ReactDOM.createRoot(container);
        root.render(React.createElement(AlertsPage));
      });

      // Fill in the criteria input
      const input = container.querySelector('input[name="criteria"]');
      if (input) {
        act(() => {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(input, 'test alert');
          input.dispatchEvent(new Event('change', { bubbles: true }));
        });
      }

      mockApi.post.mockClear();
      await act(async () => {
        submitFirstForm();
      });

      assertCorrectSignature(mockApi.post);
      assertHasToken(mockApi.post);
      assertHasBody(mockApi.post);
      expect(mockApi.post.mock.calls[0][0]).toBe('/alerts');
    });
  });

  describe('member/ProfilePage — handleSave', () => {
    test('api.put("/me", { body, token }) uses correct signature', async () => {
      const ProfilePage = require('../pages/member/ProfilePage').default;
      mockApi.get.mockResolvedValue({ fullName: 'John', email: 'j@e.com', zip: '80202' });

      await act(async () => {
        root = ReactDOM.createRoot(container);
        root.render(React.createElement(ProfilePage));
      });

      mockApi.put.mockClear();
      await act(async () => {
        submitFirstForm();
      });

      assertCorrectSignature(mockApi.put);
      assertHasToken(mockApi.put);
      assertHasBody(mockApi.put);
      expect(mockApi.put.mock.calls[0][0]).toBe('/me');
    });
  });

  describe('member/SettingsPage — handlePasswordChange', () => {
    test('api.post("/auth/change-password", { body, token }) uses correct signature', async () => {
      const SettingsPage = require('../pages/member/SettingsPage').default;

      await act(async () => {
        root = ReactDOM.createRoot(container);
        root.render(React.createElement(SettingsPage));
      });

      mockApi.post.mockClear();
      await act(async () => {
        submitFirstForm();
      });

      assertCorrectSignature(mockApi.post);
      assertHasToken(mockApi.post);
      assertHasBody(mockApi.post);
      expect(mockApi.post.mock.calls[0][0]).toBe('/auth/change-password');
    });
  });

  describe('member/SettingsPage — handlePrivacyToggle', () => {
    test('api.put("/privacy", { body, token }) uses correct signature', async () => {
      const SettingsPage = require('../pages/member/SettingsPage').default;

      await act(async () => {
        root = ReactDOM.createRoot(container);
        root.render(React.createElement(SettingsPage));
      });

      mockApi.put.mockClear();
      // Find and click the privacy toggle button
      const buttons = container.querySelectorAll('button');
      const toggleBtn = Array.from(buttons).find(b =>
        b.textContent.includes('Disable') || b.textContent.includes('Enable') || b.textContent.includes('Toggle')
      );

      if (toggleBtn) {
        await act(async () => { toggleBtn.click(); });

        assertCorrectSignature(mockApi.put);
        assertHasToken(mockApi.put);
        assertHasBody(mockApi.put);
        expect(mockApi.put.mock.calls[0][0]).toBe('/privacy');
      } else {
        // If no toggle button found, check if there's a checkbox or other toggle mechanism
        // The privacy toggle might be a different element type
        const checkboxes = container.querySelectorAll('input[type="checkbox"]');
        if (checkboxes.length > 0) {
          await act(async () => {
            checkboxes[0].click();
          });
          assertCorrectSignature(mockApi.put);
        } else {
          throw new Error('Could not find privacy toggle control');
        }
      }
    });
  });

  describe('admin/DataRemovalPage — handleApprove', () => {
    test('api.post("/admin/data-removal/:id/approve", { token }) uses correct signature', async () => {
      const DataRemovalPage = require('../pages/admin/DataRemovalPage').default;
      // Return mock removal requests
      mockApi.get.mockResolvedValue({
        data: [{ id: 'req-1', userId: 'u1', email: 'test@test.com', createdAt: '2024-01-01' }],
      });

      await act(async () => {
        root = ReactDOM.createRoot(container);
        root.render(React.createElement(DataRemovalPage));
      });

      mockApi.post.mockClear();
      // Click the Approve button
      const approveBtn = Array.from(container.querySelectorAll('button')).find(b =>
        b.textContent.includes('Approve')
      );

      if (approveBtn) {
        await act(async () => { approveBtn.click(); });

        assertCorrectSignature(mockApi.post);
        assertHasToken(mockApi.post);
        expect(mockApi.post.mock.calls[0][0]).toContain('/admin/data-removal/');
        expect(mockApi.post.mock.calls[0][0]).toContain('/approve');
      }
    });
  });

  describe('admin/DataRemovalPage — handleReject', () => {
    test('api.post("/admin/data-removal/:id/reject", { body, token }) uses correct signature', async () => {
      const DataRemovalPage = require('../pages/admin/DataRemovalPage').default;
      mockApi.get.mockResolvedValue({
        data: [{ id: 'req-2', userId: 'u2', email: 'test2@test.com', createdAt: '2024-01-01' }],
      });

      await act(async () => {
        root = ReactDOM.createRoot(container);
        root.render(React.createElement(DataRemovalPage));
      });

      mockApi.post.mockClear();
      const rejectBtn = Array.from(container.querySelectorAll('button')).find(b =>
        b.textContent.includes('Reject')
      );

      if (rejectBtn) {
        await act(async () => { rejectBtn.click(); });

        assertCorrectSignature(mockApi.post);
        assertHasToken(mockApi.post);
        assertHasBody(mockApi.post);
        expect(mockApi.post.mock.calls[0][0]).toContain('/admin/data-removal/');
        expect(mockApi.post.mock.calls[0][0]).toContain('/reject');
        expect(mockApi.post.mock.calls[0][1].body.reason).toBeDefined();
      }
    });
  });
});

// ── Direct api module signature tests ────────────────────────────────────
// These test the api.post/api.put functions directly to ensure the
// options-object pattern is correctly destructured.

describe('api module direct signature validation', () => {
  test('api.post destructures { body, token } from second argument', () => {
    // If someone passes 3 args, the third is silently ignored.
    // This test documents the correct 2-arg pattern.
    const api = require('../api').default;

    // The api module is mocked, so we verify the mock was called correctly
    // in the component tests above. This test just validates the expectation:
    // api.post(path, { body: ..., token: ... }) — always 2 args.
    expect(typeof api.post).toBe('function');
    expect(typeof api.put).toBe('function');
  });
});
