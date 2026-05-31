/**
 * AuthContext.refreshSubscription — operative-order selection contract.
 *
 * Multiple bugs (#59 / #56 / #49 / #50 / #57) traced back to ambiguity around
 * what counts as a "currently paying" member. The current logic in
 * src/context/AuthContext.js:96-106 defines operative as:
 *   - status === 'active' AND
 *   - NOT transient.canceled AND
 *   - subStatus !== 'canceled'  OR  (subStatus === 'canceled' AND dueTimestamp > now)
 *
 * The second clause is the critical one — cancelled-but-in-period users still
 * have paid access through dueTimestamp; we must NOT drop them to free tier
 * because PaymentPage would then try to re-subscribe them via the trial
 * offer, which BC rejects with `nonMemberOnlyCommerceOffer`.
 *
 * Tests exercise refreshSubscription through a tiny consumer component so the
 * predicate is verified end-to-end (orders array in → subscription state out)
 * rather than as an extracted helper.
 */

import React, { act, useEffect } from 'react';
import ReactDOM from 'react-dom/client';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

const mockApi = {
  getUserOrders: jest.fn(),
};

// AuthContext also calls setTokenGetter + setLogoutHandler from '../api' on mount.
jest.mock('../api', () => ({
  __esModule: true,
  default: mockApi,
  setTokenGetter: jest.fn(),
  setLogoutHandler: jest.fn(),
}));

jest.mock('../services/gtmContext', () => ({
  setUser: jest.fn(),
  clearUser: jest.fn(),
  setTransaction: jest.fn(),
}));

let AuthProvider, useAuth;

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  ({ AuthProvider, useAuth } = require('../context/AuthContext'));
});

let container, root, ctxValue;

function CaptureContext() {
  const ctx = useAuth();
  ctxValue = ctx;
  // Seed a token so refreshSubscription's `if (!t) return` doesn't short-circuit.
  useEffect(() => {
    if (!ctx.token) ctx.setToken?.('tok-test');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function render() {
  act(() => {
    root = ReactDOM.createRoot(container);
    root.render(
      React.createElement(AuthProvider, null,
        React.createElement(CaptureContext)
      )
    );
  });
}

// AuthProvider fires refreshSubscription in a useEffect on every token change.
// flushAsync awaits the in-flight getUserOrders promise so subscription state settles.
async function flushAsync() {
  await act(async () => { await Promise.resolve(); });
  await act(async () => { await Promise.resolve(); });
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  mockNavigate.mockClear();
  mockApi.getUserOrders.mockReset();
  ctxValue = null;
  localStorage.clear();
});

afterEach(() => {
  if (root) { act(() => root.unmount()); root = null; }
  document.body.removeChild(container);
  container = null;
});

describe('refreshSubscription — fully active orders are operative', () => {
  test('status:"active" with no subStatus → subscription is set (isPaid will be true)', async () => {
    mockApi.getUserOrders.mockResolvedValue([{
      _id: 'order_1',
      status: 'active',
      commerceOffers: ['comp.offer.signup.main'],
      dueTimestamp: Date.now() + 7 * 86400000,
    }]);
    render();
    await flushAsync();
    expect(ctxValue.subscription).toMatchObject({
      status: 'active',
      subStatus: null,
      plan: 'comp.offer.signup.main',
      orderId: 'order_1',
    });
    expect(ctxValue.isPaid).toBe(true);
  });
});

describe('refreshSubscription — cancelled-but-in-period is still operative (bug #59 fix)', () => {
  test('subStatus:"canceled" with dueTimestamp in the future → operative, isPaid true', async () => {
    mockApi.getUserOrders.mockResolvedValue([{
      _id: 'order_cancel_pending',
      status: 'active',
      subStatus: 'canceled',
      commerceOffers: ['comp.offer.signup.main'],
      dueTimestamp: Date.now() + 86400000, // 1 day from now
    }]);
    render();
    await flushAsync();
    expect(ctxValue.subscription).toMatchObject({
      status: 'active',
      subStatus: 'canceled',
      orderId: 'order_cancel_pending',
    });
    expect(ctxValue.isPaid).toBe(true);
  });

  test('subStatus:"canceled" with dueTimestamp in the past → NOT operative, isPaid false', async () => {
    mockApi.getUserOrders.mockResolvedValue([{
      _id: 'order_cancel_lapsed',
      status: 'active',
      subStatus: 'canceled',
      commerceOffers: ['comp.offer.signup.main'],
      dueTimestamp: Date.now() - 86400000, // 1 day ago
    }]);
    render();
    await flushAsync();
    expect(ctxValue.subscription).toBeNull();
    expect(ctxValue.isPaid).toBe(false);
  });
});

describe('refreshSubscription — defensive filters', () => {
  test('transient.canceled:true → NOT operative even if status:"active"', async () => {
    mockApi.getUserOrders.mockResolvedValue([{
      _id: 'order_hard_cancel',
      status: 'active',
      transient: { canceled: true },
      dueTimestamp: Date.now() + 86400000,
    }]);
    render();
    await flushAsync();
    expect(ctxValue.subscription).toBeNull();
    expect(ctxValue.isPaid).toBe(false);
  });

  test('non-active status (e.g. "pending") is filtered out', async () => {
    mockApi.getUserOrders.mockResolvedValue([{
      _id: 'order_pending',
      status: 'pending',
      dueTimestamp: Date.now() + 86400000,
    }]);
    render();
    await flushAsync();
    expect(ctxValue.subscription).toBeNull();
    expect(ctxValue.isPaid).toBe(false);
  });

  test('first operative order wins when multiple exist', async () => {
    mockApi.getUserOrders.mockResolvedValue([
      { _id: 'order_old', status: 'cancelled', dueTimestamp: Date.now() - 86400000 },
      { _id: 'order_current', status: 'active', dueTimestamp: Date.now() + 86400000, commerceOffers: ['comp.offer.signup.main'] },
    ]);
    render();
    await flushAsync();
    expect(ctxValue.subscription?.orderId).toBe('order_current');
  });

  test('empty orders array → subscription null, isPaid false', async () => {
    mockApi.getUserOrders.mockResolvedValue([]);
    render();
    await flushAsync();
    expect(ctxValue.subscription).toBeNull();
    expect(ctxValue.isPaid).toBe(false);
  });
});

describe('refreshSubscription — error handling', () => {
  test('getUserOrders throwing (e.g. BC 403 "no orders") → subscription null, no crash', async () => {
    const err = new Error('Forbidden');
    err.status = 403;
    mockApi.getUserOrders.mockRejectedValue(err);
    render();
    await flushAsync();
    expect(ctxValue.subscription).toBeNull();
    expect(ctxValue.isPaid).toBe(false);
  });

  test('non-array response (e.g. unexpected shape) → subscription null', async () => {
    mockApi.getUserOrders.mockResolvedValue({ message: 'not an array' });
    render();
    await flushAsync();
    expect(ctxValue.subscription).toBeNull();
  });
});
