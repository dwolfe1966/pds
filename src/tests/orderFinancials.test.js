/**
 * Order financial helpers — getOrderCollected / getOrderRefunded.
 *
 * Pins the contract behind the CSR-tool fix for order 6a1bb9d068c31e075cae9b12
 * (test1@gmail.com, 2026-05-31): BC's `transient.amount.collected` summed
 * rejected payment attempts ($100.96) when only one $49.98 sale actually
 * fulfilled. Computing from commercePayments[].status is the only safe path.
 */

import { getOrderCollected, getOrderRefunded } from '../utils/orderFinancials';

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
