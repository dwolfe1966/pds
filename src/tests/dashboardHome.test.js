/**
 * Tests for DashboardHome metrics, rendering, and navigation.
 */

import React, { act } from 'react';
import ReactDOM from 'react-dom/client';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => {
  const mockReact = require('react');
  return {
    useNavigate: () => mockNavigate,
    Link: ({ children, to }) => mockReact.createElement('a', { href: to }, children),
  };
});

jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', email: 'member@example.com', fullName: 'Test Member', role: 'member' },
    token: 'member-token',
  }),
}));

const mockApi = {
  getAlerts: jest.fn(),
  get: jest.fn(),
};

jest.mock('../api', () => ({ __esModule: true, default: mockApi }));

jest.mock('../services/reportService', () => ({
  getReportList: jest.fn(),
}));

jest.mock('../components/DevBCSession', () => {
  return function MockDevBCSession() { return null; };
});

const { getReportList } = require('../services/reportService');

let DashboardHome;

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  DashboardHome = require('../pages/member/DashboardHome').default;
});

let container, root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  mockNavigate.mockClear();
  mockApi.getAlerts.mockClear();
  mockApi.get.mockClear();
  getReportList.mockClear();
  // Default: all empty
  getReportList.mockResolvedValue({ success: true, reports: [] });
  mockApi.getAlerts.mockResolvedValue({ data: [] });
  mockApi.get.mockResolvedValue({ data: [] });
});

afterEach(() => {
  if (root) { act(() => root.unmount()); root = null; }
  document.body.removeChild(container);
  container = null;
});

async function render() {
  await act(async () => {
    root = ReactDOM.createRoot(container);
    root.render(React.createElement(DashboardHome));
  });
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

describe('DashboardHome — rendering', () => {
  test('renders all four metric card labels', async () => {
    await render();
    expect(container.textContent).toContain('Searches This Month');
    expect(container.textContent).toContain('Active Alerts');
    expect(container.textContent).toContain('Profile Views');
    expect(container.textContent).toContain('Reports Generated');
  });

  test('displays welcome message with user name', async () => {
    await render();
    expect(container.textContent).toContain('Welcome back');
    expect(container.textContent).toContain('Test Member');
  });

  test('renders all three quick action buttons', async () => {
    await render();
    expect(container.textContent).toContain('Advanced Search');
    expect(container.textContent).toContain('Manage Alerts');
    expect(container.textContent).toContain('Account & Billing');
  });

  test('renders feature highlight cards', async () => {
    await render();
    expect(container.textContent).toContain('Unlimited Searches');
    expect(container.textContent).toContain('Priority Support');
  });
});

// ---------------------------------------------------------------------------
// Loading state
// ---------------------------------------------------------------------------

describe('DashboardHome — loading state', () => {
  test('shows "..." placeholders while metrics are loading', () => {
    getReportList.mockReturnValue(new Promise(() => {}));
    mockApi.getAlerts.mockReturnValue(new Promise(() => {}));
    mockApi.get.mockReturnValue(new Promise(() => {}));

    act(() => {
      root = ReactDOM.createRoot(container);
      root.render(React.createElement(DashboardHome));
    });

    expect(container.textContent).toContain('...');
  });
});

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

describe('DashboardHome — empty state', () => {
  test('shows empty-state message when no activity exists', async () => {
    getReportList.mockResolvedValue({ success: true, reports: [] });
    mockApi.getAlerts.mockResolvedValue({ data: [] });
    mockApi.get.mockResolvedValue({ data: [] });

    await render();
    expect(container.textContent).toContain('No activity yet');
  });
});

// ---------------------------------------------------------------------------
// Quick action navigation
// ---------------------------------------------------------------------------

describe('DashboardHome — quick action navigation', () => {
  test('Advanced Search button navigates to /people-search', async () => {
    await render();
    const btn = Array.from(container.querySelectorAll('button')).find(b =>
      b.textContent.includes('Advanced Search')
    );
    expect(btn).not.toBeUndefined();
    act(() => { btn.click(); });
    expect(mockNavigate).toHaveBeenCalledWith('/people-search');
  });

  test('Manage Alerts button navigates to /alerts', async () => {
    await render();
    const btn = Array.from(container.querySelectorAll('button')).find(b =>
      b.textContent.includes('Manage Alerts')
    );
    expect(btn).not.toBeUndefined();
    act(() => { btn.click(); });
    expect(mockNavigate).toHaveBeenCalledWith('/alerts');
  });

  test('Account & Billing button navigates to /account', async () => {
    await render();
    const btn = Array.from(container.querySelectorAll('button')).find(b =>
      b.textContent.includes('Account & Billing')
    );
    expect(btn).not.toBeUndefined();
    act(() => { btn.click(); });
    expect(mockNavigate).toHaveBeenCalledWith('/account');
  });
});

// ---------------------------------------------------------------------------
// Metric values from API responses
// ---------------------------------------------------------------------------

describe('DashboardHome — metric values', () => {
  test('shows correct alerts count from API', async () => {
    mockApi.getAlerts.mockResolvedValue({
      data: [
        { id: 'a1', criteria: 'John Smith', frequency: 'daily' },
        { id: 'a2', criteria: 'Jane Doe', frequency: 'weekly' },
        { id: 'a3', criteria: 'Bob Jones', frequency: 'instant' },
      ],
    });

    await render();

    const metricValues = container.querySelectorAll('[class*="metricValue"]');
    const values = Array.from(metricValues).map(el => el.textContent.trim());
    expect(values).toContain('3');
  });

  test('shows correct reports count from API', async () => {
    getReportList.mockResolvedValue({
      success: true,
      reports: [
        { id: 'r1', fullName: 'John Smith', createdAt: '2025-01-01' },
        { id: 'r2', fullName: 'Jane Doe', createdAt: '2025-01-02' },
      ],
    });

    await render();

    const metricValues = container.querySelectorAll('[class*="metricValue"]');
    const values = Array.from(metricValues).map(el => el.textContent.trim());
    expect(values).toContain('2');
  });

  test('shows 0 metrics when all APIs return empty', async () => {
    await render();
    const metricValues = container.querySelectorAll('[class*="metricValue"]');
    const values = Array.from(metricValues).map(el => el.textContent.trim());
    // All four metrics should be 0
    expect(values.filter(v => v === '0').length).toBe(4);
  });
});
