import { classifyBilling, settledSales, cardProfile, billingTimeline } from '../pages/admin/billingClassification';

// Minimal BC-order fixtures matching the documented shapes (docs/admin/csr-billing-classification-spec.md).
const sale = (amount = 39.01, status = 'fulfilled') => ({ type: 'sale', status, transient: { amount: { total: amount } }, createdTimestamp: 1_700_000_000_000 });
const schedule = (sequence, retry = 0, dueTimestamp = Date.now() + 7 * 864e5, amount = 39.01) => ({ dueTimestamp, data: { sequence, retry, totalPrice: { amount } } });
// Real shape (Tera Callan, 2026-07-22): BC exposes cpd at transient.bin.extra.cpd.
const debitToken = () => ({ lastDigits: '9098', bin: '403163', expiration: { month: 9, year: 30 }, transient: { bin: { brand: 'VISA', type: 'DEBIT', level: 'PREPAID CLASSIC', extra: { cpd: 'prepaid' } } } });

describe('classifyBilling — S-code lifecycle', () => {
  test('S0 trial: one settled trial charge, active, next renewal pending', () => {
    const o = { status: 'active', commercePayments: [sale(1.01)], schedule: schedule(1, 0) };
    const c = classifyBilling(o);
    expect(c.sCode).toBe('S0');
    expect(c.phase).toBe('trial');
    expect(c.hasAccess).toBe(true);
    expect(c.nextEvent.type).toBe('renewal');
    expect(c.nextEvent.isRetry).toBe(false);
  });

  test('S2 subscriber: three settled charges (trial + 2 months), active', () => {
    const o = { status: 'active', commercePayments: [sale(1.01), sale(), sale()], schedule: schedule(3, 0) };
    const c = classifyBilling(o);
    expect(c.sCode).toBe('S2');
    expect(c.phase).toBe('subscriber');
    expect(c.currentCycle).toBe(2);
  });

  test('S1.2 dunning: first bill failing, retry 2', () => {
    const o = { status: 'active', commercePayments: [sale(1.01)], schedule: schedule(1, 2) };
    const c = classifyBilling(o);
    expect(c.sCode).toBe('S1.2');
    expect(c.phase).toBe('dunning');
    expect(c.dunning).toBe(true);
    expect(c.nextEvent.isRetry).toBe(true);
    expect(c.nextEvent.retry).toBe(2);
  });

  test('cancelled-at-period-end: active + subStatus canceled, keeps access', () => {
    const due = Date.now() + 5 * 864e5;
    const o = { status: 'active', subStatus: 'canceled', commercePayments: [sale(1.01), sale()], schedule: { dueTimestamp: due, data: { sequence: 2, retry: 0 } } };
    const c = classifyBilling(o);
    expect(c.phase).toBe('cancelled_active');
    expect(c.hasAccess).toBe(true);
  });

  test('expired: inactive + subStatus expired', () => {
    const o = { status: 'inactive', subStatus: 'expired', commercePayments: [sale(1.01), sale()] };
    const c = classifyBilling(o);
    expect(c.phase).toBe('expired');
    expect(c.hasAccess).toBe(false);
  });

  test('refunded: refund reason + inactive', () => {
    const o = { status: 'inactive', subStatus: 'expired', statusReason: 'correct|refund', commercePayments: [sale(1.01), sale()] };
    const c = classifyBilling(o);
    expect(c.phase).toBe('refunded');
  });

  test('payment_failed: no settled sale', () => {
    const o = { status: 'inactive', commercePayments: [{ type: 'sale', status: 'declined' }] };
    const c = classifyBilling(o);
    expect(c.phase).toBe('payment_failed');
    expect(c.sCode).toBe('—');
  });

  test('cpd card type: prepaid (transient.bin.extra.cpd) → P, low propensity', () => {
    const o = { status: 'active', commercePayments: [sale(1.01)], commerceTokens: [debitToken()], schedule: schedule(1) };
    const c = classifyBilling(o);
    expect(c.card.cpd).toBe('P'); // extra.cpd='prepaid' wins over bin.type='DEBIT'
    expect(c.card.lowPropensity).toBe(true);
    expect(c.card.brand).toBe('VISA');
  });

  test('cpd fallback: bin.type DEBIT with no extra.cpd → D', () => {
    const tok = { lastDigits: '1111', transient: { bin: { brand: 'VISA', type: 'DEBIT' } } };
    const c = classifyBilling({ status: 'active', commercePayments: [sale(1.01)], commerceTokens: [tok], schedule: schedule(1) });
    expect(c.card.cpd).toBe('D');
  });

  test('C1 early cancel: cancelled before first monthly charge (trial only)', () => {
    const orderTimestamp = Date.now() - 10 * 864e5; // 10 days ago
    const o = {
      status: 'inactive', subStatus: 'canceled', orderTimestamp,
      commercePayments: [sale(1.01)],
      orderHistories: [{ subStatus: 'canceled', createdAt: new Date(orderTimestamp + 3 * 864e5).toISOString() }],
    };
    const c = classifyBilling(o);
    expect(c.earlyCancel).toBe('C1');
  });

  test('C0 early cancel: cancelled within day 1', () => {
    const orderTimestamp = Date.now() - 10 * 864e5;
    const o = {
      status: 'inactive', subStatus: 'canceled', orderTimestamp,
      commercePayments: [sale(1.01)],
      orderHistories: [{ subStatus: 'canceled', createdAt: new Date(orderTimestamp + 6 * 36e5).toISOString() }], // +6h
    };
    const c = classifyBilling(o);
    expect(c.earlyCancel).toBe('C0');
  });
});

describe('helpers', () => {
  test('settledSales counts only fulfilled sales', () => {
    expect(settledSales({ commercePayments: [sale(), sale(39, 'declined'), { type: 'refund', status: 'fulfilled' }] })).toHaveLength(1);
  });
  test('billingTimeline merges payments + histories, newest first', () => {
    const o = {
      orderHistories: [{ status: 'active', statusReason: 'SuccessfulTx', createdAt: new Date(1_700_000_000_000).toISOString() }],
      commercePayments: [sale(1.01)],
    };
    const t = billingTimeline(o);
    expect(t.length).toBe(2);
    expect(t[0].ts).toBeGreaterThanOrEqual(t[1].ts);
  });
  test('cardProfile null when no card', () => {
    expect(cardProfile({})).toBeNull();
  });
});
