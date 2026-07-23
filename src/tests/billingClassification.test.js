import { classifyBilling, settledSales, cardProfile, billingTimeline, billingEvents, getCustomerStatus } from '../pages/admin/billingClassification';

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

  test('dunning: first bill failing, retry 2 → still S0, retrySeq S1.2', () => {
    const o = { status: 'active', commercePayments: [sale(1.01)], schedule: schedule(1, 2) };
    const c = classifyBilling(o);
    expect(c.sCode).toBe('S0');            // membership — rolling to subscription
    expect(c.retrySeq).toBe('S1.2');       // P&L retry code
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

  test('S0-cluster: never captured but actively retrying S1 → S1-unpaid (rule: begun S1 retry → assume S1)', () => {
    // Owner rule 2026-07-22: once the S1 retry process begins (and isn't paused), assume S1 — unpaid.
    const o = {
      status: 'active',
      commercePayments: [{ type: 'sale', status: 'declined', sequence: 1 }], // attempted S1, never fulfilled
      schedule: { dueTimestamp: Date.now() + 3 * 864e5, data: { sequence: 1, retry: 2, totalPrice: { amount: 49.98 } } },
    };
    const c = classifyBilling(o);
    expect(c.stateCode).toBe('D1.2 of 5'); // in the S1 retry process, not-yet-paid
    expect(c.phase).toBe('dunning');
    expect(c.hasAccess).toBe(true);
    expect(c.access).toBe('grace');
    expect(c.nextEvent.maxAttempts).toBe(5);     // "of N" now shown (owner)
  });

  test('LIVE godwill S1 dunning: captured trial, S1 failed twice (ISF), on retry 2 → S1-unpaid.2', () => {
    const o = {
      status: 'active',
      commercePayments: [
        { type: 'sale', status: 'rejected', sequence: 1, retry: 1, totalPrice: { amount: 49.98 } },
        { type: 'sale', status: 'rejected', sequence: 1, retry: 0, totalPrice: { amount: 49.98 } },
        { type: 'sale', status: 'fulfilled', sequence: 0, retry: 0, totalPrice: { amount: 1 } },
      ],
      transient: { sequenced: { sequence: 0, retry: 0 } }, // NOT the retry count (reads 0)
      schedule: { dueTimestamp: 1784899800139, data: { sequence: 1, retry: 2, totalPrice: { amount: 49.98 } } },
    };
    const c = classifyBilling(o);
    expect(c.stateCode).toBe('D1.2 of 5');  // in the S1 retry process, not-yet-paid
    expect(c.stateName).toBe('Retrying payment capture');
    expect(c.phase).toBe('dunning');
    expect(c.access).toBe('grace');
    expect(c.phaseLabel).toMatch(/retrying payment capture/i);
    expect(c.nextEvent.isRetry).toBe(true);
    expect(c.nextEvent.retry).toBe(2);
    expect(c.nextEvent.cycle).toBe(1);
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

  test('LIVE christenbury: S1 rejected 59:Suspected Fraud → order suspended, no access, reason shown', () => {
    const o = {
      status: 'inactive', subStatus: 'suspended',
      commercePayments: [
        { type: 'sale', status: 'rejected', sequence: 1, retry: 0, totalPrice: { amount: 49.98 }, requestResult: { primaryCodeMessage: '59:Suspected Fraud' }, paymentTimestamp: 2 },
        { type: 'sale', status: 'fulfilled', sequence: 0, retry: 0, totalPrice: { amount: 1 }, paymentTimestamp: 1 },
      ],
      transient: { sequenced: { sequence: 0, retry: 0 } },
      schedule: null,
    };
    const c = classifyBilling(o);
    expect(c.phase).toBe('order_suspended');
    expect(c.access).toBe('no');
    expect(c.fraudStop).toBe(true);
    expect(c.phaseLabel).toMatch(/fraud/i);
    expect(c.stateName).toBe('Fraud stop');
    expect(c.nextEvent).toBeNull();              // no forecast — stopped (no retry on fraud)
  });

  test('LIVE estevenjnordby/kingasyus: fraud stop + suspend BUT status active with a lingering schedule.retry → terminal, NOT a yellow D1.1', () => {
    // The regression: BC left status='active' and a stale schedule.data.retry=1 @ a future date after it had
    // already fraud-declined the first bill (Jul 7) and suspended the order (Jul 21). The dunning branch was
    // firing first → mis-showing "Trial-D1.1 / Has access (at risk) / Medium / Retry $49.98 @ Jul 24".
    const jun30 = Date.parse('2026-06-30T14:22:00Z');
    const jul7 = Date.parse('2026-07-07T06:30:00Z');
    const o = {
      status: 'active', subStatus: 'suspended', orderTimestamp: jun30,
      commercePayments: [
        { type: 'sale', status: 'fulfilled', sequence: 0, retry: 0, totalPrice: { amount: 1.0 }, paymentTimestamp: jun30 },
        { type: 'sale', status: 'rejected', sequence: 1, retry: 0, totalPrice: { amount: 49.98 }, requestResult: { primaryCodeMessage: '59:Suspected Fraud' }, paymentTimestamp: jul7 },
      ],
      orderHistories: [{ subStatus: 'suspended', createdAt: '2026-07-21T18:14:00Z' }],
      schedule: { dueTimestamp: Date.parse('2026-07-24T06:30:00Z'), data: { sequence: 1, retry: 1, totalPrice: { amount: 49.98 } } },
    };
    const c = classifyBilling(o, { now: Date.parse('2026-07-23T00:00:00Z') });
    expect(c.phase).toBe('order_suspended');
    expect(c.access).toBe('no');            // NOT 'grace'
    expect(c.hasAccess).toBe(false);
    expect(c.dunning).toBeFalsy();          // must not read as dunning
    expect(c.fraudStop).toBe(true);
    expect(c.risk.tone).toBe('red');        // NOT yellow
    expect(c.stateName).toBe('Fraud stop');
    expect(c.stateCode).toBe('Fraud-stop'); // NOT 'D1.1 of 5'
    expect(c.classification).toBe('inactive');
    expect(c.nextEvent).toBeNull();         // NO phantom "Retry $49.98 @ Jul 24"
    expect(c.nextEventShort).toBe('None');
  });

  test('fraud stop is keyed on the LATEST sale: an old fraud decline followed by a successful renewal is NOT terminal', () => {
    const o = {
      status: 'active',
      commercePayments: [
        { type: 'sale', status: 'rejected', sequence: 1, retry: 0, totalPrice: { amount: 49.98 }, requestResult: { primaryCodeMessage: '59:Suspected Fraud' }, paymentTimestamp: 1 },
        { type: 'sale', status: 'fulfilled', sequence: 1, retry: 0, totalPrice: { amount: 49.98 }, paymentTimestamp: 2 },
      ],
      schedule: schedule(2, 0),
    };
    const c = classifyBilling(o);
    expect(c.phase).not.toBe('order_suspended'); // later success clears the stop
    expect(c.access).toBe('yes');
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

describe('stateCode — definitive S{n}-paid / S{n}-unpaid[.retry] taxonomy (owner 2026-07-22)', () => {
  const fsale = (seq, amt = 49.98) => ({ type: 'sale', status: 'fulfilled', sequence: seq, totalPrice: { amount: amt } });
  const code = (o) => classifyBilling(o).stateCode;
  test('trial captured, S1 not yet attempted → S0-paid', () => {
    expect(code({ status: 'active', commercePayments: [fsale(0, 1)], schedule: schedule(1, 0) })).toBe('S0-paid');
  });
  test('never captured (validate only) → S0-unpaid (no retry on S0)', () => {
    expect(code({ status: 'active', commercePayments: [{ type: 'validate', status: 'fulfilled', totalPrice: { amount: 0 } }], schedule: schedule(1, 0) })).toBe('S0-unpaid');
  });
  test('trial captured, S1 charge failing retry 2 → S1-unpaid.2 of 10 (godwill/lacanda12)', () => {
    expect(code({ status: 'active', commercePayments: [fsale(0, 1), { type: 'sale', status: 'rejected', sequence: 1 }], schedule: schedule(1, 2) })).toBe('D1.2 of 5');
  });
  test('never captured but actively retrying S1 → S1-unpaid.2 of 10 (rule: begun S1 retry → assume S1)', () => {
    expect(code({ status: 'active', commercePayments: [{ type: 'validate', status: 'fulfilled', totalPrice: { amount: 0 } }, { type: 'sale', status: 'rejected', sequence: 1 }], schedule: schedule(1, 2) })).toBe('D1.2 of 5');
  });
  test('cleared trial + S1 → S1-paid (subscriber, cleared S1)', () => {
    expect(code({ status: 'active', commercePayments: [fsale(0, 1), fsale(1)], schedule: schedule(2, 0) })).toBe('S1-paid');
  });
  test('subscriber, S2 renewal failing retry 1 → S2-unpaid.1 of 10', () => {
    expect(code({ status: 'active', commercePayments: [fsale(0, 1), fsale(1), { type: 'sale', status: 'rejected', sequence: 2 }], schedule: schedule(2, 1) })).toBe('D2.1 of 5');
  });
  test('never-captured S1-unpaid → High risk + neverCaptured; happy-path S1-unpaid → Medium', () => {
    const never = classifyBilling({ status: 'active', commercePayments: [{ type: 'validate', status: 'fulfilled', totalPrice: { amount: 0 } }, { type: 'sale', status: 'rejected', sequence: 1 }], schedule: schedule(1, 2) });
    expect(never.stateCode).toBe('D1.2 of 5');
    expect(never.neverCaptured).toBe(true);
    expect(never.risk).toEqual({ level: 'High', tone: 'red' });
    const happy = classifyBilling({ status: 'active', commercePayments: [fsale(0, 1), { type: 'sale', status: 'rejected', sequence: 1 }], schedule: schedule(1, 2) });
    expect(happy.stateCode).toBe('D1.2 of 5');
    expect(happy.neverCaptured).toBe(false);
    expect(happy.risk).toEqual({ level: 'Medium', tone: 'yellow' });
  });
});

describe('classification — high-level bucket (owner 2026-07-22)', () => {
  const fsale = (seq, amt = 49.98) => ({ type: 'sale', status: 'fulfilled', sequence: seq, totalPrice: { amount: amt } });
  const cls = (o, now) => classifyBilling(o, now ? { now } : undefined).classification;
  test('trial captured → trial-S0-paid', () => {
    expect(cls({ status: 'active', commercePayments: [fsale(0, 1)], schedule: schedule(1, 0) })).toBe('trial-S0-paid');
  });
  test('never captured, not retrying → trial-S0-unpaid', () => {
    expect(cls({ status: 'active', commercePayments: [{ type: 'validate', status: 'fulfilled', totalPrice: { amount: 0 } }], schedule: schedule(1, 0) })).toBe('trial-S0-unpaid');
  });
  test('cancelled trial, access remains → trial-S0-norenewal', () => {
    expect(cls({ status: 'active', subStatus: 'canceled', commercePayments: [fsale(0, 1)], schedule: { dueTimestamp: Date.now() + 5 * 864e5, data: { sequence: 1, retry: 0 } } })).toBe('trial-S0-norenewal');
  });
  test('S1 charge failing retry 2 → subscriber-S1.2-unpaid', () => {
    expect(cls({ status: 'active', commercePayments: [fsale(0, 1), { type: 'sale', status: 'rejected', sequence: 1 }], schedule: schedule(1, 2) })).toBe('trial-D1.2');
  });
  test('cleared trial + S1 → subscriber-S1-paid', () => {
    expect(cls({ status: 'active', commercePayments: [fsale(0, 1), fsale(1)], schedule: schedule(2, 0) })).toBe('subscriber-S1-paid');
  });
  test('subscriber cancelled → subscriber-S1-norenewal', () => {
    expect(cls({ status: 'active', subStatus: 'canceled', commercePayments: [fsale(0, 1), fsale(1)], schedule: { dueTimestamp: Date.now() + 5 * 864e5, data: { sequence: 2, retry: 0 } } })).toBe('subscriber-S1-norenewal');
  });
  test('expired → inactive', () => {
    expect(cls({ status: 'inactive', subStatus: 'expired', commercePayments: [fsale(0, 1)] })).toBe('inactive');
  });
});

describe('money + expectation summary', () => {
  test('captured $1 trial → money.collected 1, expectation says converts', () => {
    const o = { status: 'active', orderTimestamp: Date.now() - 3 * 864e5, commercePayments: [{ type: 'sale', status: 'fulfilled', sequence: 0, totalPrice: { amount: 1 } }], schedule: schedule(1, 0) };
    const c = classifyBilling(o);
    expect(c.money.collected).toBe(1);
    expect(c.money.capturedAny).toBe(true);
    expect(c.memberDays).toBe(3);
    expect(c.expectation).toMatch(/converts to subscriber/i);
  });
  test('no capture (validate only) → money.capturedAny false, expectation flags not captured', () => {
    const o = { status: 'active', commercePayments: [{ type: 'validate', status: 'fulfilled', totalPrice: { amount: 0 } }], schedule: schedule(1, 0) };
    const c = classifyBilling(o);
    expect(c.money.capturedAny).toBe(false);
    expect(c.expectation).toMatch(/not captured/i);
  });
  test('dunning expectation names the decline reason', () => {
    const o = { status: 'active', commercePayments: [{ type: 'sale', status: 'fulfilled', sequence: 0, totalPrice: { amount: 1 } }, { type: 'sale', status: 'rejected', sequence: 1, retry: 0, requestResult: { primaryCodeMessage: '51:Insufficient Funds' } }], schedule: { dueTimestamp: Date.now() + 864e5, data: { sequence: 1, retry: 2, totalPrice: { amount: 49.98 } } } };
    const c = classifyBilling(o);
    expect(c.declineReason).toMatch(/insufficient/i);
    expect(c.expectation).toMatch(/failing.*insufficient/i);
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
  test('billingEvents: charge/outcome/notes newest-first (godwill-like)', () => {
    const o = { commercePayments: [
      { type: 'sale', status: 'rejected', sequence: 1, retry: 1, totalPrice: { amount: 49.98 }, requestResult: { primaryCodeMessage: '51:Insufficient Funds' }, paymentTimestamp: 3 },
      { type: 'sale', status: 'fulfilled', sequence: 0, totalPrice: { amount: 1 }, paymentTimestamp: 1 },
    ] };
    const ev = billingEvents(o);
    expect(ev).toHaveLength(2);
    expect(ev[0].ts).toBeGreaterThan(ev[1].ts);          // newest first
    expect(ev[0].outcome).toBe('Declined');
    expect(ev[0].charge).toMatch(/First bill.*retry 1/);
    expect(ev[0].notes).toMatch(/insufficient/i);
    expect(ev[0].notes).toMatch(/attempt 2/);        // retry 1 → attempt 2
    expect(ev[0].notes).toMatch(/balance recovers/); // advisory gloss
    expect(ev[1].outcome).toBe('Captured');
    expect(ev[1].charge).toMatch(/Trial/);
  });
  test('billingEvents: surfaces a fraud suspend transition', () => {
    const o = { subStatus: 'suspended', updatedTimestamp: 9, commercePayments: [{ type: 'sale', status: 'rejected', sequence: 1, requestResult: { primaryCodeMessage: '59:Suspected Fraud' }, paymentTimestamp: 5 }] };
    const ev = billingEvents(o);
    expect(ev.some((r) => r.outcome === 'Order suspended')).toBe(true);
  });
});
