/**
 * Tests for PaidRoute — subscription paywall guard.
 *
 * PaidRoute reads { isPaid, loading } from AuthContext:
 *   - loading=true  → renders null (does NOT redirect)
 *   - isPaid=true   → renders <Outlet /> content
 *   - isPaid=false  → <Navigate to="/payment?upgrade=1" replace />
 *
 * PaidRoute must be nested INSIDE ProtectedRoute so that unauthenticated
 * users are caught by the auth guard before reaching PaidRoute.
 */

import React, { act } from 'react';
import ReactDOM from 'react-dom/client';

// ─── Mock react-router-dom ───────────────────────────────────────────────────
// We track Navigate calls. PaidRoute uses children prop (not <Outlet />).
const mockNavigateComponent = jest.fn();
let capturedNavigateTo = null;
let capturedNavigateReplace = null;

jest.mock('react-router-dom', () => {
  const mockReact = require('react');
  return {
    Navigate: ({ to, replace }) => {
      capturedNavigateTo = to;
      capturedNavigateReplace = replace;
      mockNavigateComponent(to, replace);
      return null;
    },
    useNavigate: () => jest.fn(),
    useLocation: () => ({ pathname: '/people/abc123', search: '' }),
    MemoryRouter: ({ children }) => mockReact.createElement(mockReact.Fragment, null, children),
  };
});

// ─── Mock AuthContext ────────────────────────────────────────────────────────
let mockAuthState = { isPaid: false, loading: false, token: null, user: null, subscription: null };

jest.mock('../context/AuthContext', () => ({
  useAuth: () => mockAuthState,
}));

let PaidRoute;
let ProtectedRoute;

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  PaidRoute = require('../pages/PaidRoute').default;
  ProtectedRoute = require('../pages/ProtectedRoute').default;
});

let container, root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  mockNavigateComponent.mockClear();
  capturedNavigateTo = null;
  capturedNavigateReplace = null;
  // Reset to a sensible default (unauthenticated, not paid)
  mockAuthState = { isPaid: false, loading: false, token: null, user: null, subscription: null };
});

afterEach(() => {
  if (root) { act(() => root.unmount()); root = null; }
  document.body.removeChild(container);
  container = null;
});

/**
 * Render PaidRoute with a sentinel child element so we can verify
 * whether children are rendered (paid) or suppressed (unpaid/loading).
 */
function renderPaidRoute() {
  const sentinel = React.createElement('div', { 'data-testid': 'outlet-content' }, 'OUTLET');
  act(() => {
    root = ReactDOM.createRoot(container);
    root.render(React.createElement(PaidRoute, {}, sentinel));
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Loading state
// ─────────────────────────────────────────────────────────────────────────────

describe('PaidRoute — loading state', () => {
  test('renders nothing (null) while loading is true', () => {
    mockAuthState = { isPaid: false, loading: true, token: 'tok', user: {}, subscription: null };
    renderPaidRoute();
    // Container should be empty — no outlet, no redirect sentinel
    expect(container.children.length).toBe(0);
    expect(container.textContent).toBe('');
  });

  test('does NOT call Navigate while loading is true', () => {
    mockAuthState = { isPaid: false, loading: true, token: 'tok', user: {}, subscription: null };
    renderPaidRoute();
    expect(mockNavigateComponent).not.toHaveBeenCalled();
  });

  test('renders nothing even when isPaid would be false during load', () => {
    mockAuthState = { isPaid: false, loading: true, token: null, user: null, subscription: null };
    renderPaidRoute();
    expect(container.textContent).toBe('');
    expect(capturedNavigateTo).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Paid user
// ─────────────────────────────────────────────────────────────────────────────

describe('PaidRoute — paid user', () => {
  test('renders Outlet content when isPaid=true and loading=false', () => {
    mockAuthState = {
      isPaid: true,
      loading: false,
      token: 'tok-paid',
      user: { id: 'u1', role: 'member' },
      subscription: { plan: 'basic', status: 'active' },
    };
    renderPaidRoute();
    expect(container.querySelector('[data-testid="outlet-content"]')).not.toBeNull();
    expect(container.textContent).toContain('OUTLET');
  });

  test('does NOT call Navigate when isPaid=true', () => {
    mockAuthState = {
      isPaid: true,
      loading: false,
      token: 'tok-paid',
      user: { id: 'u1', role: 'member' },
      subscription: { plan: 'pro', status: 'active' },
    };
    renderPaidRoute();
    expect(mockNavigateComponent).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Unpaid authenticated user
// ─────────────────────────────────────────────────────────────────────────────

describe('PaidRoute — unpaid authenticated user', () => {
  test('calls Navigate to /payment?upgrade=1 when isPaid=false', () => {
    mockAuthState = {
      isPaid: false,
      loading: false,
      token: 'tok-free',
      user: { id: 'u2', role: 'member' },
      subscription: null,
    };
    renderPaidRoute();
    expect(mockNavigateComponent).toHaveBeenCalledTimes(1);
    expect(capturedNavigateTo).toBe('/payment?upgrade=1');
  });

  test('passes replace=true to Navigate when redirecting unpaid user', () => {
    mockAuthState = {
      isPaid: false,
      loading: false,
      token: 'tok-free',
      user: { id: 'u2', role: 'member' },
      subscription: { plan: null, status: 'inactive' },
    };
    renderPaidRoute();
    expect(capturedNavigateReplace).toBe(true);
  });

  test('does NOT render Outlet content when isPaid=false', () => {
    mockAuthState = {
      isPaid: false,
      loading: false,
      token: 'tok-free',
      user: { id: 'u2', role: 'member' },
      subscription: null,
    };
    renderPaidRoute();
    expect(container.querySelector('[data-testid="outlet-content"]')).toBeNull();
    expect(container.textContent).not.toContain('OUTLET');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Subscription pending (isPaid=false, subscription=null, loading=true)
// ─────────────────────────────────────────────────────────────────────────────

describe('PaidRoute — subscription pending', () => {
  test('does NOT redirect when subscription is null and loading=true', () => {
    mockAuthState = {
      isPaid: false,
      loading: true,
      token: 'tok-pending',
      user: { id: 'u3', role: 'member' },
      subscription: null, // not yet fetched
    };
    renderPaidRoute();
    expect(mockNavigateComponent).not.toHaveBeenCalled();
    expect(capturedNavigateTo).toBeNull();
  });

  test('renders nothing (waits) when subscription is not yet fetched', () => {
    mockAuthState = {
      isPaid: false,
      loading: true,
      token: 'tok-pending',
      user: { id: 'u3', role: 'member' },
      subscription: null,
    };
    renderPaidRoute();
    expect(container.textContent).toBe('');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Route integration — PaidRoute is layered INSIDE ProtectedRoute
// ─────────────────────────────────────────────────────────────────────────────

describe('PaidRoute — route integration with ProtectedRoute', () => {
  /**
   * When an unauthenticated user (token=null) hits a route that is guarded by
   * both ProtectedRoute and PaidRoute (layered inside), ProtectedRoute should
   * fire first and redirect to /login.
   *
   * We simulate this by rendering ProtectedRoute (which calls useAuth for token)
   * with a child that is PaidRoute. Since ProtectedRoute short-circuits on
   * token=null, PaidRoute's Navigate is never called.
   */
  test('unauthenticated user hits ProtectedRoute redirect — PaidRoute Navigate is never called', () => {
    // Set up: no token (unauthenticated), not paid
    mockAuthState = {
      isPaid: false,
      loading: false,
      token: null,   // triggers ProtectedRoute redirect
      user: null,
      subscription: null,
    };

    // We need a separate Navigate tracker for ProtectedRoute's Navigate call
    // (it renders <Navigate to="/login" replace />). Our mock captures the LAST
    // call, so we reset and track call count.
    mockNavigateComponent.mockClear();
    capturedNavigateTo = null;

    act(() => {
      root = ReactDOM.createRoot(container);
      root.render(
        React.createElement(
          ProtectedRoute,
          {},
          // Child is PaidRoute — should never be reached
          React.createElement(PaidRoute)
        )
      );
    });

    // ProtectedRoute calls Navigate toward /login (1 call), PaidRoute never runs
    expect(mockNavigateComponent).toHaveBeenCalledTimes(1);
    // ProtectedRoute now redirects to /login?redirect=... (includes the path)
    expect(capturedNavigateTo).toMatch(/^\/login/);
  });

  test('authenticated unpaid user: ProtectedRoute passes through, PaidRoute redirects to /payment?upgrade=1', () => {
    mockAuthState = {
      isPaid: false,
      loading: false,
      token: 'tok-free',    // authenticated — ProtectedRoute lets through
      user: { id: 'u4', role: 'member' },
      subscription: null,
    };

    mockNavigateComponent.mockClear();
    capturedNavigateTo = null;

    act(() => {
      root = ReactDOM.createRoot(container);
      root.render(
        React.createElement(
          ProtectedRoute,
          {},
          React.createElement(PaidRoute)
        )
      );
    });

    // ProtectedRoute renders children (token present), PaidRoute fires Navigate
    expect(mockNavigateComponent).toHaveBeenCalledTimes(1);
    expect(capturedNavigateTo).toBe('/payment?upgrade=1');
  });
});
