/**
 * Regression tests: admin list pages must correctly unwrap { data: [...] }
 * responses and render list items.
 *
 * The original bug had pages checking for data.results, data.users, etc.
 * instead of data.data, causing empty lists even when the API returned data.
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
});

afterEach(() => {
  if (root) {
    act(() => root.unmount());
    root = null;
  }
  document.body.removeChild(container);
  container = null;
});

function getTableRows() {
  const tbody = container.querySelector('tbody');
  if (!tbody) return [];
  return Array.from(tbody.querySelectorAll('tr'));
}

function getCellTexts(row) {
  return Array.from(row.querySelectorAll('td')).map(td => td.textContent);
}

// ── UsersPage ────────────────────────────────────────────────────────────

describe('UsersPage response unwrapping', () => {
  test('renders user rows when API returns { data: [...] }', async () => {
    mockApi.get.mockResolvedValue({
      data: [
        { id: 'u1', fullName: 'Alice Smith', email: 'alice@example.com' },
        { id: 'u2', fullName: 'Bob Jones', email: 'bob@example.com' },
      ],
      pagination: { page: 1, total: 2 },
    });

    const UsersPage = require('../pages/admin/UsersPage').default;
    await act(async () => {
      root = ReactDOM.createRoot(container);
      root.render(React.createElement(UsersPage));
    });

    const rows = getTableRows();
    expect(rows).toHaveLength(2);
    expect(getCellTexts(rows[0])).toEqual(expect.arrayContaining(['u1', 'alice@example.com']));
    expect(rows[0].textContent).toContain('Alice Smith');
    expect(getCellTexts(rows[1])).toEqual(expect.arrayContaining(['u2', 'bob@example.com']));
  });

  test('shows "No users found" when API returns empty data array', async () => {
    mockApi.get.mockResolvedValue({ data: [] });

    const UsersPage = require('../pages/admin/UsersPage').default;
    await act(async () => {
      root = ReactDOM.createRoot(container);
      root.render(React.createElement(UsersPage));
    });

    expect(container.textContent).toContain('No users found');
  });
});

// ── SessionsPage ─────────────────────────────────────────────────────────

describe('SessionsPage response unwrapping', () => {
  test('renders session rows when API returns { data: [...] }', async () => {
    mockApi.get.mockResolvedValue({
      data: [
        { userId: 'u1', ipAddress: '192.168.1.1', createdAt: '2024-01-15T10:00:00Z' },
        { userId: 'u2', ipAddress: '10.0.0.1', createdAt: '2024-01-16T12:00:00Z' },
      ],
    });

    const SessionsPage = require('../pages/admin/SessionsPage').default;
    await act(async () => {
      root = ReactDOM.createRoot(container);
      root.render(React.createElement(SessionsPage));
    });

    const rows = getTableRows();
    expect(rows).toHaveLength(2);
    expect(getCellTexts(rows[0])).toContain('u1');
    expect(getCellTexts(rows[0])).toContain('192.168.1.1');
  });

  test('uses createdAt for session date display', async () => {
    mockApi.get.mockResolvedValue({
      data: [
        { userId: 'u1', ipAddress: '1.2.3.4', createdAt: '2024-03-01' },
      ],
    });

    const SessionsPage = require('../pages/admin/SessionsPage').default;
    await act(async () => {
      root = ReactDOM.createRoot(container);
      root.render(React.createElement(SessionsPage));
    });

    const rows = getTableRows();
    expect(rows).toHaveLength(1);
    const cells = getCellTexts(rows[0]);
    expect(cells).toContain('2024-03-01');
  });

  test('falls back to startedAt when createdAt is missing', async () => {
    mockApi.get.mockResolvedValue({
      data: [
        { userId: 'u1', ipAddress: '1.2.3.4', startedAt: '2024-02-15' },
      ],
    });

    const SessionsPage = require('../pages/admin/SessionsPage').default;
    await act(async () => {
      root = ReactDOM.createRoot(container);
      root.render(React.createElement(SessionsPage));
    });

    const rows = getTableRows();
    const cells = getCellTexts(rows[0]);
    expect(cells).toContain('2024-02-15');
  });
});

// ── PurchasesPage ────────────────────────────────────────────────────────

describe('PurchasesPage response unwrapping', () => {
  test('renders purchase rows when API returns { data: [...] }', async () => {
    mockApi.get.mockResolvedValue({
      data: [
        { id: 'p1', userId: 'u1', amount: '$9.99' },
        { id: 'p2', userId: 'u2', amount: '$19.99' },
      ],
    });

    const PurchasesPage = require('../pages/admin/PurchasesPage').default;
    await act(async () => {
      root = ReactDOM.createRoot(container);
      root.render(React.createElement(PurchasesPage));
    });

    const rows = getTableRows();
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('p1');
    expect(rows[0].textContent).toContain('$9.99');
  });

  test('shows "No purchases found" when data is empty', async () => {
    mockApi.get.mockResolvedValue({ data: [] });

    const PurchasesPage = require('../pages/admin/PurchasesPage').default;
    await act(async () => {
      root = ReactDOM.createRoot(container);
      root.render(React.createElement(PurchasesPage));
    });

    expect(container.textContent).toContain('No purchases found');
  });
});

// ── CsRepManagementPage ─────────────────────────────────────────────────

describe('CsRepManagementPage response unwrapping', () => {
  test('renders rep rows when API returns { data: [...] }', async () => {
    mockApi.get.mockResolvedValue({
      data: [
        { id: 'r1', name: 'Rep Alice', email: 'rep@example.com', role: 'senior' },
      ],
    });

    const CsRepManagementPage = require('../pages/admin/CsRepManagementPage').default;
    await act(async () => {
      root = ReactDOM.createRoot(container);
      root.render(React.createElement(CsRepManagementPage));
    });

    const rows = getTableRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain('Rep Alice');
    expect(rows[0].textContent).toContain('rep@example.com');
    expect(rows[0].textContent).toContain('senior');
  });

  test('shows "No representatives found" when data is empty', async () => {
    mockApi.get.mockResolvedValue({ data: [] });

    const CsRepManagementPage = require('../pages/admin/CsRepManagementPage').default;
    await act(async () => {
      root = ReactDOM.createRoot(container);
      root.render(React.createElement(CsRepManagementPage));
    });

    expect(container.textContent).toContain('No representatives found');
  });
});

// ── DataRemovalPage ──────────────────────────────────────────────────────

describe('DataRemovalPage response unwrapping', () => {
  test('renders removal request rows when API returns { data: [...] }', async () => {
    mockApi.get.mockResolvedValue({
      data: [
        { id: 'dr1', userId: 'u1', email: 'remove@test.com', createdAt: '2024-01-20' },
      ],
    });

    const DataRemovalPage = require('../pages/admin/DataRemovalPage').default;
    await act(async () => {
      root = ReactDOM.createRoot(container);
      root.render(React.createElement(DataRemovalPage));
    });

    const rows = getTableRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain('dr1');
  });

  test('shows empty state when data is empty', async () => {
    mockApi.get.mockResolvedValue({ data: [] });

    const DataRemovalPage = require('../pages/admin/DataRemovalPage').default;
    await act(async () => {
      root = ReactDOM.createRoot(container);
      root.render(React.createElement(DataRemovalPage));
    });

    expect(container.textContent).toContain('No requests');
  });
});
