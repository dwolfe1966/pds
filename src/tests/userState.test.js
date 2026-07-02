/**
 * getPlanState — the CSR-side subscription-state ladder
 * (docs/design/customer-state-model.md). Fixtures mirror live BC order shapes:
 * the refund order 6a44100827aa861231e1f584 (type='refund',
 * statusReason='correct|refund', refund payment fulfilled) and the
 * blocked-sale orders from userId 6a45…3c22 (4× status 'blocked').
 */

jest.mock('../api', () => ({ adminListPurchases: jest.fn() }));

import { getPlanState, orderIsRefunded, PLAN_STATES } from '../pages/admin/userState';

const sale = (status = 'fulfilled') => ({ type: 'sale', status });
const refundPmt = () => ({ type: 'refund', status: 'fulfilled' });

describe('getPlanState', () => {
  test('no orders at all → free', () => {
    expect(getPlanState([]).key).toBe('free');
    expect(getPlanState(null).key).toBe('free');
  });

  test('orders exist but nothing ever settled → payment_failed (owner split 2026-07-02)', () => {
    const orders = [
      { status: 'failed', commercePayments: [sale('blocked')], transient: { amount: { collected: 0 } } },
      { status: 'failed', commercePayments: [sale('blocked')], transient: { amount: { collected: 0 } } },
    ];
    expect(getPlanState(orders).key).toBe('payment_failed');
  });

  test('active order still inside trial → trial', () => {
    const orders = [{
      status: 'active',
      commercePayments: [sale()],
      transient: { amount: { collected: 1 } },
      schedule: { data: { totalPrice: { amount: 49.98 } } },
    }];
    expect(getPlanState(orders).key).toBe('trial');
  });

  test('active order with a full cycle billed → subscriber', () => {
    const orders = [{
      status: 'active',
      commercePayments: [sale(), sale()],
      transient: { amount: { collected: 50.98 } },
      schedule: { data: { totalPrice: { amount: 49.98 } } },
    }];
    expect(getPlanState(orders).key).toBe('subscriber');
  });

  test('cancel-at-period-end (subStatus=canceled, status active) → cancelled', () => {
    const orders = [{
      status: 'active',
      subStatus: 'canceled',
      commercePayments: [sale()],
      transient: { amount: { collected: 1 } },
    }];
    expect(getPlanState(orders).key).toBe('cancelled');
  });

  test('refunded order (live shape: type=refund + refund payment) → refunded, beats expired', () => {
    const orders = [{
      status: 'inactive',
      subStatus: 'expired',
      type: 'refund',
      statusReason: 'correct|refund',
      commercePayments: [sale(), refundPmt()],
      transient: { amount: { collected: 1, refunded: 1 } },
    }];
    expect(getPlanState(orders).key).toBe('refunded');
  });

  test('expired without refund → expired', () => {
    const orders = [{
      status: 'inactive',
      subStatus: 'expired',
      commercePayments: [sale()],
      transient: { amount: { collected: 1 } },
    }];
    expect(getPlanState(orders).key).toBe('expired');
  });

  test('every state key has a label + colors (directory filter renders from this map)', () => {
    for (const s of Object.values(PLAN_STATES)) {
      expect(s.label).toBeTruthy();
      expect(s.color).toBeTruthy();
      expect(s.bg).toBeTruthy();
    }
  });
});

describe('orderIsRefunded', () => {
  test('detects via transient.amount.refunded', () => {
    expect(orderIsRefunded({ transient: { amount: { refunded: 1 } } })).toBe(true);
  });
  test('detects via order type / statusReason', () => {
    expect(orderIsRefunded({ type: 'refund' })).toBe(true);
    expect(orderIsRefunded({ statusReason: 'correct|refund' })).toBe(true);
  });
  test('detects via a fulfilled refund payment; ignores pending ones', () => {
    expect(orderIsRefunded({ commercePayments: [{ type: 'refund', status: 'fulfilled' }] })).toBe(true);
    expect(orderIsRefunded({ commercePayments: [{ type: 'refund', status: 'pending' }] })).toBe(false);
  });
  test('plain paid order → false', () => {
    expect(orderIsRefunded({ status: 'active', commercePayments: [{ type: 'sale', status: 'fulfilled' }] })).toBe(false);
  });
});
