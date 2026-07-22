import { classifyBilling, settledSales, cardProfile, billingTimeline, getCustomerStatus } from '../pages/admin/billingClassification';

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
    expect(c.nextEvent.type).toBe('first-bill'); // S0→S1 first charge (converts to subscriber)
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

  test('LIVE Cassie Happy Path S0: captured $1 trial, next is the first bill (converts), not a renewal', () => {
    const o = {
      status: 'active',
      commercePayments: [{ type: 'sale', status: 'fulfilled', sequence: 0, retry: 0, totalPrice: { amount: 1 }, createdTimestamp: Date.parse('2026-07-21T09:43:13Z') }],
      commerceTokens: [{ lastDigits: '3797', transient: { bin: { brand: 'VISA', type: 'DEBIT', level: 'CLASSIC', extra: { cpd: 'debit' } } } }],
      transient: { sequenced: { sequence: 0, retry: 0 }, amount: { collected: 1 } },
      schedule: { dueTimestamp: 1785245413404, data: { sequence: 1, retry: 0, totalPrice: { amount: 49.98 } } },
      orderHistories: [{ status: 'active', statusReason: 'SuccessfulTx', createdAt: '2026-07-21T09:43:15Z' }],
    };
    const c = classifyBilling(o);
    expect(c.sCode).toBe('S0');
    expect(c.phase).toBe('trial');
    expect(c.access).toBe('yes');
    expect(c.card.cpd).toBe('D');                 // Green Dot debit
    expect(c.nextEvent.type).toBe('first-bill');  // NOT 'renewal'
    expect(c.nextEvent.cycle).toBe(1);
    expect(c.nextEvent.amount).toBe(49.98);
  });

  test('LIVE rakim S0-failed: validate-only ($0), no capture, BC scheduled $49.98 → S0 at-risk, first-bill', () => {
    const o = {
      status: 'active',
      commercePayments: [{ type: 'validate', status: 'fulfilled', sequence: 0, retry: 0, totalPrice: { amount: 0 } }],
      transient: { sequenced: { sequence: 0, retry: 0 } },
      schedule: { dueTimestamp: 1785159000479, data: { sequence: 1, retry: 0, totalPrice: { amount: 49.98 } } },
      orderHistories: [{ status: 'active', statusReason: 'SuccessfulTx' }],
    };
    const c = classifyBilling(o);
    expect(c.sCode).toBe('S0');
    expect(c.phase).toBe('trial');
    expect(c.access).toBe('grace');            // at-risk: initial charge never captured
    expect(c.phaseLabel).toMatch(/not captured/i);
    expect(c.nextEvent.type).toBe('first-bill'); // BC scheduled the $49.98 S1 charge
    expect(c.nextEvent.amount).toBe(49.98);
  });

  test('S0-cluster: initial trial payment failed, no capture, actively retrying → S0.2 (not S1)', () => {
    // rakim/amyjo/moninoso cluster: schedule.sequence ran ahead to 1, but NOTHING captured → still S0.
    const o = {
      status: 'active',
      commercePayments: [{ type: 'sale', status: 'declined' }], // attempted, never fulfilled
      schedule: { dueTimestamp: Date.now() + 3 * 864e5, data: { sequence: 1, retry: 2, totalPrice: { amount: 49.98 } } },
    };
    const c = classifyBilling(o);
    expect(c.sCode).toBe('S0.2');                 // NOT S1.2
    expect(c.phase).toBe('dunning');
    expect(c.hasAccess).toBe(true);
    expect(c.access).toBe('grace');
    expect(c.nextEvent.cycle).toBe(0);            // retry of the INITIAL/trial charge, not a full S1
    expect(c.nextEvent.maxAttempts).toBeNull();   // "of N" gated until RETRY_RULES.confirmed (no live retry≥2 seen)
  });

  test('godwill: trial overstayed — captured S0 but S1 charge date passed, still S0 → at-risk, not green', () => {
    const o = {
      status: 'active',
      commercePayments: [{ type: 'sale', status: 'fulfilled', sequence: 0, totalPrice: { amount: 1 } }],
      transient: { sequenced: { sequence: 0, retry: 0 } },
      schedule: { dueTimestamp: Date.parse('2026-07-14T00:00:00Z'), data: { sequence: 1, retry: 0, totalPrice: { amount: 49.98 } } },
    };
    const c = classifyBilling(o, { now: Date.parse('2026-07-22T00:00:00Z') }); // 8 days later, still S0
    expect(c.sCode).toBe('S0');
    expect(c.trialOverstayed).toBe(true);
    expect(c.access).toBe('grace');                 // NOT green
    expect(c.phaseLabel).toMatch(/overdue|not succeeding/i);
  });

  test('access field: healthy trial = yes, expired = no', () => {
    expect(classifyBilling({ status: 'active', commercePayments: [sale(1.01)], schedule: schedule(1, 0) }).access).toBe('yes');
    expect(classifyBilling({ status: 'inactive', subStatus: 'expired', commercePayments: [sale(1.01), sale()] }).access).toBe('no');
  });

  test('cancelled-at-period-end: active + subStatus canceled, keeps access', () => {
    const due = Date.now() + 5 * 864e5;
    const o = { status: 'active', subStatus: 'canceled', commercePayments: [sale(1.01), sale()], schedule: { dueTimestamp: due, data: { sequence: 2, retry: 0 } } };
    const c = classifyBilling(o);
    expect(c.phase).toBe('cancelled_active');
    expect(c.hasAccess).toBe(true);
  });

  test('LIVE Tera shape: cancelled trial → S0, C1, access-ends (no phantom renewal)', () => {
    const signup = Date.parse('2026-07-20T09:58:47Z');
    const cancel = Date.parse('2026-07-22T09:08:43Z');
    const o = {
      status: 'active', subStatus: 'canceled', orderTimestamp: signup,
      commercePayments: [{ type: 'sale', status: 'fulfilled', createdTimestamp: signup }],
      commerceTokens: [debitToken()],
      schedule: { dueTimestamp: 1785159047120, data: { sequence: 1, retry: 0, totalPrice: { amount: 49.98 } } },
      orderHistories: [
        { status: 'active', subStatus: 'canceled', statusReason: 'SuccessfulTx', createdAt: new Date(cancel).toISOString() },
        { status: 'active', statusReason: 'SuccessfulTx', createdAt: new Date(signup + 22 * 60 * 1000).toISOString() },
      ],
    };
    const c = classifyBilling(o, { now: Date.parse('2026-07-23T00:00:00Z') });
    expect(c.sCode).toBe('S0');
    expect(c.phase).toBe('cancelled_active');
    expect(c.hasAccess).toBe(true);
    expect(c.earlyCancel).toBe('C1');          // cancelled 2 days in, before first monthly charge
    expect(c.card.cpd).toBe('P');              // prepaid
    expect(c.nextEvent.type).toBe('access-ends'); // NOT a renewal
    expect(c.nextEvent.amount).toBeNull();     // no charge amount shown
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

describe('getCustomerStatus — single access-first status', () => {
  const trialOrder = { status: 'active', commercePayments: [sale(1)], schedule: schedule(1, 0) };
  test('suspended account overrides billing → no access', () => {
    const s = getCustomerStatus({ status: 'blocked' }, [trialOrder]);
    expect(s.access).toBe('no');
    expect(s.reason).toMatch(/suspend|block/i);
  });
  test('active trial → has access', () => {
    const s = getCustomerStatus({ status: 'active' }, [trialOrder]);
    expect(s.access).toBe('yes');
    expect(s.sCode).toBe('S0');
  });
  test('no orders → no access, signup only', () => {
    const s = getCustomerStatus({ status: 'active' }, []);
    expect(s.access).toBe('no');
    expect(s.reason).toMatch(/signup|no orders/i);
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
