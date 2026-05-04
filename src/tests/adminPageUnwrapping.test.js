/**
 * Regression tests: admin list pages must correctly unwrap { data: [...] }
 * responses and render list items.
 *
 * Pages call typed admin* methods (adminListUsers / adminListCsReps /
 * adminListPurchases / adminListOrdersGlobal / adminListDataRemoval /
 * adminListPhoneOptOuts). All return a `{ data: [...], noMoreDocs? }` shape;
 * tests assert the page unwraps and renders rows from `data`.
 *
 * SessionsPage was rewritten to consume the tracking API directly via fetch()
 * rather than the admin api, so its old unwrap regression no longer applies
 * and is not covered here.
 */

import React, { act } from 'react';
import ReactDOM from 'react-dom/client';

// ── Mock api module ──────────────────────────────────────────────────────

const mockApi = {
  adminListUsers:        jest.fn().mockResolvedValue({ data: [], noMoreDocs: true }),
  adminListCsReps:       jest.fn().mockResolvedValue({ data: [], noMoreDocs: true }),
  adminListPurchases:    jest.fn().mockResolvedValue({ data: [] }),
  adminListOrdersGlobal: jest.fn().mockResolvedValue({ data: [] }),
  adminListDataRemoval:  jest.fn().mockResolvedValue({ data: [], noMoreDocs: true }),
  adminListPhoneOptOuts: jest.fn().mockResolvedValue({ data: [], noMoreDocs: true }),
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
    useSearchParams: () => [new URLSearchParams(), jest.fn()],
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
  Object.values(mockApi).forEach((fn) => fn.mockClear());
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
    mockApi.adminListUsers.mockResolvedValue({
      data: [
        { id: 'u1', fullName: 'Alice Smith', email: 'alice@example.com' },
        { id: 'u2', fullName: 'Bob Jones', email: 'bob@example.com' },
      ],
      noMoreDocs: true,
    });

    const UsersPage = require('../pages/admin/UsersPage').default;
    await act(async () => {
      root = ReactDOM.createRoot(container);
      root.render(React.createElement(UsersPage));
    });

    const rows = getTableRows();
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('alice@example.com');
    expect(rows[0].textContent).toContain('Alice Smith');
    expect(rows[1].textContent).toContain('bob@example.com');
    expect(rows[1].textContent).toContain('Bob Jones');
  });

  test('shows "No users found" when API returns empty data array', async () => {
    mockApi.adminListUsers.mockResolvedValue({ data: [], noMoreDocs: true });

    const UsersPage = require('../pages/admin/UsersPage').default;
    await act(async () => {
      root = ReactDOM.createRoot(container);
      root.render(React.createElement(UsersPage));
    });

    expect(container.textContent).toContain('No customers found');
  });
});

// ── PurchasesPage ────────────────────────────────────────────────────────
//
// PurchasesPage's default mode (no userId in URL) loads global recent orders
// via api.adminListOrdersGlobal. It does not render an empty-state string for
// the "no purchases" case — only the rows list is asserted here.

describe('PurchasesPage response unwrapping', () => {
  test('renders purchase rows when API returns { data: [...] }', async () => {
    mockApi.adminListOrdersGlobal.mockResolvedValue({
      data: [
        { _id: 'p1', userId: 'u1', amount: 9.99, createdAt: '2024-02-01' },
        { _id: 'p2', userId: 'u2', amount: 19.99, createdAt: '2024-02-02' },
      ],
    });

    const PurchasesPage = require('../pages/admin/PurchasesPage').default;
    await act(async () => {
      root = ReactDOM.createRoot(container);
      root.render(React.createElement(PurchasesPage));
    });

    expect(container.textContent).toContain('p1');
    expect(container.textContent).toContain('$9.99');
    expect(container.textContent).toContain('p2');
  });
});

// ── CsRepManagementPage ─────────────────────────────────────────────────

describe('CsRepManagementPage response unwrapping', () => {
  test('renders rep rows when API returns { data: [...] }', async () => {
    mockApi.adminListCsReps.mockResolvedValue({
      data: [
        { id: 'r1', firstName: 'Alice', lastName: 'Rep', email: 'rep@example.com', roles: ['csr'] },
      ],
      noMoreDocs: true,
    });

    const CsRepManagementPage = require('../pages/admin/CsRepManagementPage').default;
    await act(async () => {
      root = ReactDOM.createRoot(container);
      root.render(React.createElement(CsRepManagementPage));
    });

    expect(container.textContent).toContain('Alice Rep');
    expect(container.textContent).toContain('rep@example.com');
  });

  test('renders empty list without crashing when data is empty', async () => {
    mockApi.adminListCsReps.mockResolvedValue({ data: [], noMoreDocs: true });

    const CsRepManagementPage = require('../pages/admin/CsRepManagementPage').default;
    await act(async () => {
      root = ReactDOM.createRoot(container);
      root.render(React.createElement(CsRepManagementPage));
    });

    expect(mockApi.adminListCsReps).toHaveBeenCalled();
    expect(getTableRows()).toHaveLength(0);
  });
});

// ── DataRemovalPage ──────────────────────────────────────────────────────

describe('DataRemovalPage response unwrapping', () => {
  test('renders removal request rows when API returns { data: [...] }', async () => {
    mockApi.adminListDataRemoval.mockResolvedValue({
      data: [
        { _id: 'dr1', userId: 'u1', email: 'remove@test.com', createdAt: '2024-01-20' },
      ],
      noMoreDocs: true,
    });

    const DataRemovalPage = require('../pages/admin/DataRemovalPage').default;
    await act(async () => {
      root = ReactDOM.createRoot(container);
      root.render(React.createElement(DataRemovalPage));
    });

    expect(container.textContent).toContain('remove@test.com');
  });

  test('does not crash when data is empty', async () => {
    mockApi.adminListDataRemoval.mockResolvedValue({ data: [], noMoreDocs: true });

    const DataRemovalPage = require('../pages/admin/DataRemovalPage').default;
    await act(async () => {
      root = ReactDOM.createRoot(container);
      root.render(React.createElement(DataRemovalPage));
    });

    expect(mockApi.adminListDataRemoval).toHaveBeenCalled();
  });
});
