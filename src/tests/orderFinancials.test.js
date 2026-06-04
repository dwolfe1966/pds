/**
 * Order financial helpers — getOrderCollected / getOrderRefunded.
 *
 * Pins the contract behind the CSR-tool fix for order 6a1bb9d068c31e075cae9b12
 * (test1@gmail.com, 2026-05-31): BC's `transient.amount.collected` summed
 * rejected payment attempts ($100.96) when only one $49.98 sale actually
 * fulfilled. Computing from commercePayments[].status is the only safe path.
 */

import {
  getOrderCollected,
  getOrderRefunded,
  paymentEpoch,
  getLatestPaymentDeviceInfo,
  getLatestBillingZip,
} from '../utils/orderFinancials';

describe('getOrderCollected — rejected-attempts bug', () => {
  test('regression: order 6a1bb9d (1 fulfilled $49.98 + 4 rejected) returns 49.98, not 100.96', () => {
    const order = {
      _id: '6a1bb9d068c31e075cae9b12',
      transient: { amount: { collected: 100.96 } }, // BC's wrong sum
      commercePayments: [
        { _id: 'p1', type: 'sale', status: 'rejected',  totalPrice: { amount: 1.01 } },
        { _id: 'p2', type: 'sale', status: 'fulfilled', totalPrice: { amount: 49.98 } },
        { _id: 'p3', type: 'sale', status: 'rejected',  totalPrice: { amount: 49.98 } },
        { _id: 'p4', type: 'sale', status: 'rejected',  totalPrice: { amount: 1.01 } },
        { _id: 'p5', type: 'sale', status: 'rejected',  totalPrice: { amount: 49.98 } },
      ],
    };
    expect(getOrderCollected(order)).toBeCloseTo(49.98, 2);
  });
});

describe('getOrderCollected — basic shapes', () => {
  test('single fulfilled sale returns that amount', () => {
    expect(getOrderCollected({
      commercePayments: [{ type: 'sale', status: 'fulfilled', totalPrice: { amount: 29.99 } }],
    })).toBeCloseTo(29.99, 2);
  });

  test('sums all fulfilled sale payments (e.g. trial + renewal)', () => {
    expect(getOrderCollected({
      commercePayments: [
        { type: 'sale', status: 'fulfilled', totalPrice: { amount: 1.00 } },
        { type: 'sale', status: 'fulfilled', totalPrice: { amount: 49.98 } },
      ],
    })).toBeCloseTo(50.98, 2);
  });

  test('refund payments are excluded (refunded shown separately on UI)', () => {
    expect(getOrderCollected({
      commercePayments: [
        { type: 'sale',   status: 'fulfilled', totalPrice: { amount: 49.98 } },
        { type: 'refund', status: 'fulfilled', totalPrice: { amount: 49.98 } },
      ],
    })).toBeCloseTo(49.98, 2);
  });

  test('empty commercePayments array returns 0 (not BC fallback)', () => {
    expect(getOrderCollected({
      commercePayments: [],
      transient: { amount: { collected: 999 } },
    })).toBe(0);
  });
});

describe('getOrderCollected — fallback only when commercePayments is absent', () => {
  test('no commercePayments key at all → falls back to transient.amount.collected', () => {
    expect(getOrderCollected({
      transient: { amount: { collected: 12.50 } },
    })).toBe(12.50);
  });

  test('no commercePayments AND no transient → returns 0 (no crash)', () => {
    expect(getOrderCollected({})).toBe(0);
    expect(getOrderCollected(null)).toBe(0);
    expect(getOrderCollected(undefined)).toBe(0);
  });
});

describe('getOrderRefunded — symmetric contract', () => {
  test('sums fulfilled refund payments only', () => {
    expect(getOrderRefunded({
      commercePayments: [
        { type: 'sale',   status: 'fulfilled', totalPrice: { amount: 49.98 } },
        { type: 'refund', status: 'fulfilled', totalPrice: { amount: 20.00 } },
        { type: 'refund', status: 'rejected',  totalPrice: { amount: 10.00 } },
      ],
    })).toBeCloseTo(20.00, 2);
  });

  test('empty commercePayments → 0', () => {
    expect(getOrderRefunded({ commercePayments: [] })).toBe(0);
  });

  test('no commercePayments → falls back to transient.amount.refunded', () => {
    expect(getOrderRefunded({
      transient: { amount: { refunded: 5.55 } },
    })).toBe(5.55);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Regression guard for the UserDetailPage white-screen crash (2026-05-31):
// BC's `paymentTimestamp` is numeric Unix-ms, `createdAt` is an ISO string.
// The old sort did `(a.paymentTimestamp || a.createdAt).localeCompare(...)`,
// which calls a String method on a Number → TypeError → React unmount.
describe('paymentEpoch — numeric/string timestamp normalization', () => {
  test('numeric paymentTimestamp (Unix-ms) is returned as-is', () => {
    expect(paymentEpoch({ paymentTimestamp: 1717200000000 })).toBe(1717200000000);
  });

  test('ISO createdAt string is converted to epoch ms', () => {
    const iso = '2026-05-31T10:00:00.000Z';
    expect(paymentEpoch({ createdAt: iso })).toBe(new Date(iso).getTime());
  });

  test('paymentTimestamp wins over createdAt when both present', () => {
    expect(paymentEpoch({ paymentTimestamp: 5, createdAt: '2026-01-01T00:00:00Z' })).toBe(5);
  });

  test('missing/garbage timestamps coerce to 0 (never throw)', () => {
    expect(paymentEpoch({})).toBe(0);
    expect(paymentEpoch(null)).toBe(0);
    expect(paymentEpoch({ createdAt: 'not-a-date' })).toBe(0);
  });

  test('a numeric and a string timestamp are mutually comparable (no localeCompare crash)', () => {
    const numeric = { paymentTimestamp: 1717200000000 };
    const isoString = { createdAt: '2020-01-01T00:00:00.000Z' };
    // The crash was calling .localeCompare across these two shapes. Subtraction
    // on paymentEpoch must just work and order them correctly.
    expect(() => [numeric, isoString].sort((a, b) => paymentEpoch(b) - paymentEpoch(a))).not.toThrow();
    const sorted = [isoString, numeric].sort((a, b) => paymentEpoch(b) - paymentEpoch(a));
    expect(sorted[0]).toBe(numeric); // 2024 epoch newer than 2020
  });
});

describe('getLatestPaymentDeviceInfo — most-recent device/IP across orders', () => {
  test('returns {device:null, ip:null} for empty/missing orders', () => {
    expect(getLatestPaymentDeviceInfo([])).toEqual({ device: null, ip: null });
    expect(getLatestPaymentDeviceInfo(null)).toEqual({ device: null, ip: null });
    expect(getLatestPaymentDeviceInfo(undefined)).toEqual({ device: null, ip: null });
  });

  test('picks device/IP from the newest payment (mixed numeric + ISO timestamps)', () => {
    const orders = [{
      commercePayments: [
        { paymentTimestamp: 1000, device: 'old-phone', ipAddress: '1.1.1.1' },
        { createdAt: '2026-05-31T10:00:00.000Z', device: 'new-laptop', ipAddress: '2.2.2.2' },
      ],
    }];
    expect(getLatestPaymentDeviceInfo(orders)).toEqual({ device: 'new-laptop', ip: '2.2.2.2' });
  });

  test('skips payments with no device/IP and falls to the next', () => {
    const orders = [{
      commercePayments: [
        { paymentTimestamp: 3000 },                          // newest, but no device/ip
        { paymentTimestamp: 2000, device: 'd2', ipAddress: '9.9.9.9' },
      ],
    }];
    expect(getLatestPaymentDeviceInfo(orders)).toEqual({ device: 'd2', ip: '9.9.9.9' });
  });

  test('handles orders lacking a commercePayments array without throwing', () => {
    expect(getLatestPaymentDeviceInfo([{ _id: 'o1' }, { commercePayments: null }]))
      .toEqual({ device: null, ip: null });
  });
});

describe('getLatestBillingZip — ZIP from order billing address (not on user object)', () => {
  test('returns null for empty/missing orders', () => {
    expect(getLatestBillingZip([])).toBeNull();
    expect(getLatestBillingZip(null)).toBeNull();
    expect(getLatestBillingZip(undefined)).toBeNull();
  });

  test('reads zip from the newest payment commerceToken.billingAddress (real BC shape, 2026-06-04)', () => {
    // Mirrors the live order on user 6a2060a7…: zip lives at
    // commercePayments[].commerceToken.billingAddress.zip
    const orders = [{
      commercePayments: [
        { paymentTimestamp: 1000, commerceToken: { billingAddress: { zip: '10001' } } },
        { paymentTimestamp: 5000, commerceToken: { billingAddress: { zip: '91362' } } },
      ],
    }];
    expect(getLatestBillingZip(orders)).toBe('91362');
  });

  test('falls back to order.commerceTokens[].billingAddress.zip when payments carry none', () => {
    const orders = [{
      commercePayments: [{ paymentTimestamp: 3000 }],
      commerceTokens: [{ billingAddress: { zip: '94107' } }],
    }];
    expect(getLatestBillingZip(orders)).toBe('94107');
  });

  test('coerces a numeric zip to string', () => {
    const orders = [{ commerceTokens: [{ billingAddress: { zip: 91362 } }] }];
    expect(getLatestBillingZip(orders)).toBe('91362');
  });

  test('returns null when no billing address carries a zip', () => {
    expect(getLatestBillingZip([{ commercePayments: [{ device: 'x' }], commerceTokens: [{}] }]))
      .toBeNull();
  });
});
