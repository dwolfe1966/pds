/**
 * getPersonSignals — Phase 0 engine. Verifies the invariants the design leans on: stage gate (SO/booking),
 * post-pay corroboration (empty-and-safe), flow emphasis, augment-off parity. Mocks only the network fetchers;
 * corroboratePerson stays REAL (it's the safety-critical bit).
 */
import { getPersonSignals, _resetSignalsCache } from '../services/personSignals';
import { fetchLifeEvents } from '../services/lifeEventsService';
import { fetchBookings } from '../services/incarcerationService';

jest.mock('../services/lifeEventsService', () => ({ fetchLifeEvents: jest.fn() }));
// Partial mock: keep corroboratePerson (real logic), stub only the network call.
jest.mock('../services/incarcerationService', () => ({
  ...jest.requireActual('../services/incarcerationService'),
  fetchBookings: jest.fn(),
}));

const SUBJECT = { firstName: 'Alex', lastName: 'Morgan', state: 'CA', age: '40', gender: 'M' };

// A same-name sex-offender that MATCHES the subject (age 41 within ±1, gender M) vs one that does NOT (age 60).
const SO_MATCH = { recordType: 'sex-offender', name: 'ALEX MORGAN', age: 41, gender: 'M', state: 'CA' };
const SO_MISMATCH = { recordType: 'sex-offender', name: 'ALEX MORGAN', age: 60, gender: 'M', state: 'CA' };
const DIVORCE = { recordType: 'divorce', exSpouseName: 'Jane Doe', divorceDate: '2019', age: 40 };
const BOOKING = { recordType: 'booking', name: 'Alex Morgan', age: 40, gender: 'M' };

beforeEach(() => {
  _resetSignalsCache();
  jest.clearAllMocks();
  delete process.env.REACT_APP_SIGNALS_AUGMENT;
  delete process.env.REACT_APP_SIGNALS_BOOKING_PRESIGNUP;
  fetchLifeEvents.mockResolvedValue({ count: 0, records: [] });
  fetchBookings.mockResolvedValue({ count: 0, records: [] });
});

describe('stage gate', () => {
  test('pre-signup: sex-offender is NEVER computed or exposed', async () => {
    fetchLifeEvents.mockResolvedValue({ count: 2, records: [DIVORCE, SO_MATCH] });
    const r = await getPersonSignals({ subject: SUBJECT, stage: 'pre-signup', flow: 'dating' });
    expect(r.signals.sexOffender.count).toBe(0);
    // and pre-signup must NOT request the sex-offender lookup at all
    expect(fetchLifeEvents).toHaveBeenCalledWith(expect.objectContaining({ sexOffender: false }));
  });

  test('pre-signup: booking hidden unless display-permission flag is on', async () => {
    fetchBookings.mockResolvedValue({ count: 1, records: [BOOKING] });
    let r = await getPersonSignals({ subject: SUBJECT, stage: 'pre-signup', flow: 'inmate' });
    expect(r.signals.booking.count).toBe(0);

    _resetSignalsCache();
    process.env.REACT_APP_SIGNALS_BOOKING_PRESIGNUP = '1';
    r = await getPersonSignals({ subject: SUBJECT, stage: 'pre-signup', flow: 'inmate' });
    expect(r.signals.booking.count).toBe(1);
  });
});

describe('post-pay sex-offender corroboration (empty-and-safe)', () => {
  test('keeps an age+gender match, drops a mismatch', async () => {
    fetchLifeEvents.mockResolvedValue({ count: 2, records: [SO_MATCH, SO_MISMATCH] });
    const r = await getPersonSignals({ subject: SUBJECT, viewerRelation: 'member-other', flow: 'dating' });
    expect(r.stage).toBe('post-pay');
    expect(r.signals.sexOffender.count).toBe(1);
    expect(r.signals.sexOffender.records[0].age).toBe(41);
  });

  test('drops ALL when the subject has no age (unknown → reject)', async () => {
    fetchLifeEvents.mockResolvedValue({ count: 1, records: [SO_MATCH] });
    const r = await getPersonSignals({ subject: { ...SUBJECT, age: '' }, viewerRelation: 'member-other' });
    expect(r.signals.sexOffender.count).toBe(0);
  });
});

describe('emphasis', () => {
  test('flow picks the lead; augment-off yields lead-only (parity)', async () => {
    fetchLifeEvents.mockResolvedValue({ count: 1, records: [DIVORCE] });
    fetchBookings.mockResolvedValue({ count: 1, records: [BOOKING] });
    process.env.REACT_APP_SIGNALS_BOOKING_PRESIGNUP = '1'; // so booking is present pre-signup
    const r = await getPersonSignals({ subject: SUBJECT, stage: 'pre-signup', flow: 'divorce' });
    expect(r.lead).toBe('marriageDivorce');
    expect(r.secondary).toEqual([]); // augment off → no "also found"
  });

  test('augment-on adds capped secondary', async () => {
    process.env.REACT_APP_SIGNALS_AUGMENT = '1';
    process.env.REACT_APP_SIGNALS_BOOKING_PRESIGNUP = '1';
    fetchLifeEvents.mockResolvedValue({ count: 1, records: [DIVORCE] });
    fetchBookings.mockResolvedValue({ count: 1, records: [BOOKING] });
    const r = await getPersonSignals({ subject: SUBJECT, stage: 'pre-signup', flow: 'divorce' });
    expect(r.lead).toBe('marriageDivorce');
    expect(r.secondary).toContain('booking');
  });

  test('general flow leads with the strongest present signal', async () => {
    process.env.REACT_APP_SIGNALS_AUGMENT = '1';
    fetchLifeEvents.mockResolvedValue({ count: 1, records: [DIVORCE] }); // only marriage/divorce present
    const r = await getPersonSignals({ subject: SUBJECT, viewerRelation: 'member-other', flow: 'general' });
    expect(r.lead).toBe('marriageDivorce');
  });

  test('lead falls back to capability when the configured signal has no data', async () => {
    const r = await getPersonSignals({ subject: SUBJECT, stage: 'pre-signup', flow: 'divorce' });
    expect(r.lead).toBe('capability');
  });
});

describe('strict (specific-person surfaces: SUP / Payment)', () => {
  const BOOK_MATCH = { recordType: 'booking', name: 'Alex Morgan', age: 41 };   // within ±1 of subject age 40
  const BOOK_FAR = { recordType: 'booking', name: 'Alex Morgan', age: 70 };     // same name, different person
  test('booking is corroborated on age; a far same-name record is dropped', async () => {
    process.env.REACT_APP_SIGNALS_BOOKING_PRESIGNUP = '1';
    fetchBookings.mockResolvedValue({ count: 2, records: [BOOK_MATCH, BOOK_FAR] });
    const r = await getPersonSignals({ subject: SUBJECT, stage: 'pre-signup', flow: 'inmate', strict: true });
    expect(r.signals.booking.count).toBe(1);
    expect(r.signals.booking.records[0].age).toBe(41);
  });
  test('non-strict keeps both same-name booking records (loose SERP behavior)', async () => {
    process.env.REACT_APP_SIGNALS_BOOKING_PRESIGNUP = '1';
    fetchBookings.mockResolvedValue({ count: 2, records: [BOOK_MATCH, BOOK_FAR] });
    const r = await getPersonSignals({ subject: SUBJECT, stage: 'pre-signup', flow: 'inmate', strict: false });
    expect(r.signals.booking.count).toBe(2);
  });
});

describe('guards', () => {
  test('no name → empty, no fetches', async () => {
    const r = await getPersonSignals({ subject: { state: 'CA' } });
    expect(r.lead).toBeNull();
    expect(fetchLifeEvents).not.toHaveBeenCalled();
  });

  test('owner-self orders by exposure severity (SO first when present)', async () => {
    process.env.REACT_APP_SIGNALS_AUGMENT = '1';
    fetchLifeEvents.mockResolvedValue({ count: 2, records: [DIVORCE, SO_MATCH] });
    const r = await getPersonSignals({ subject: SUBJECT, viewerRelation: 'owner-self' });
    expect(r.lead).toBe('sexOffender');
    expect(r.secondary).toContain('marriageDivorce');
  });
});
