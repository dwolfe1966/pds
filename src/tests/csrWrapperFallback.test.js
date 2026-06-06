/**
 * CSR wrapper envelope-unwrapping + fallback-chain contract.
 *
 * This file pins the exact seam that produced our two most expensive admin
 * regressions this week:
 *
 *   1. f156c11 — routing csrFindUserContactMessages through BC's IIFE
 *      `findUserContacts` first. BC's contact-message IIFE returns a
 *      non-standard envelope (truthy object, no docs[]), which short-circuited
 *      the working fallbacks and rendered an empty Messages list. Fixed in
 *      a025577 by NOT consulting the IIFE for messages.
 *   2. The "client-filter wipes every row" class (see feedback memory
 *      `no_clientside_filter_on_bc_database_search`).
 *
 * The asymmetry is the crux and is easy to lose: NOTES read IIFE-first
 * (csrFindUserAdminNotes), MESSAGES do NOT (csrFindUserContactMessages goes
 * direct REST → inbox-wide GET + client filter). These tests lock both.
 */

import apiWrapper, { _unwrapBcResponse } from '../services/apiWrapper';

const err = (status, message = 'err') => Object.assign(new Error(message), { status });

afterEach(() => {
  jest.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
describe('_unwrapBcResponse — BC envelope shapes', () => {
  test('passes through null and primitives untouched', () => {
    expect(_unwrapBcResponse(null)).toBeNull();
    expect(_unwrapBcResponse(undefined)).toBeUndefined();
    expect(_unwrapBcResponse('hello')).toBe('hello');
    expect(_unwrapBcResponse(42)).toBe(42);
  });

  test('already-unwrapped { docs } object passes through unchanged', () => {
    const body = { docs: [{ _id: 'a' }], noMoreDocs: true };
    expect(_unwrapBcResponse(body)).toBe(body);
  });

  test('unwraps a getData() wrapper', () => {
    const data = { docs: [{ _id: 'x' }] };
    const wrapper = { getData: () => data };
    expect(_unwrapBcResponse(wrapper)).toBe(data);
  });

  test('unwraps the params.response.data chain', () => {
    const data = { docs: [{ _id: 'y' }] };
    const wrapper = { params: { response: { data } } };
    expect(_unwrapBcResponse(wrapper)).toBe(data);
  });

  test('params.error is surfaced as a thrown Error (not a silently-empty success)', () => {
    const wrapper = {
      params: { error: { response: { status: 400, data: { message: 'bad request' } } } },
    };
    expect(() => _unwrapBcResponse(wrapper)).toThrow('bad request');
    try {
      _unwrapBcResponse(wrapper);
    } catch (e) {
      expect(e.status).toBe(400);
    }
  });

  test('params.error with an array message is joined', () => {
    const wrapper = {
      params: { error: { response: { status: 422, data: { message: ['a', 'b'] } } } },
    };
    expect(() => _unwrapBcResponse(wrapper)).toThrow('a, b');
  });

  test('getData() returning null falls through to the wrapper itself (no crash)', () => {
    const wrapper = { getData: () => null, docs: [{ _id: 'z' }] };
    // getData yielded nothing usable; nested chain absent → returns input as-is.
    expect(_unwrapBcResponse(wrapper)).toBe(wrapper);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('csrFindUserContactMessages — MESSAGES go direct, never IIFE', () => {
  test('direct POST success returns the body verbatim', async () => {
    const body = { docs: [{ _id: 'm1' }], noMoreDocs: true };
    jest.spyOn(apiWrapper, '_csrPost').mockResolvedValue(body);
    const filterSpy = jest.spyOn(apiWrapper, 'csrFindContactMessages');

    const res = await apiWrapper.csrFindUserContactMessages({ userId: 'u1' });

    expect(res).toBe(body);
    expect(apiWrapper._csrPost).toHaveBeenCalledWith(
      '/contactMessage/admin/find/u1',
      {},
    );
    expect(filterSpy).not.toHaveBeenCalled(); // no fallback needed
  });

  test('REGRESSION LOCK: a malicious BC IIFE findUserContacts cannot short-circuit the result', async () => {
    // Even if the CSR IIFE exposes a findUserContacts that returns a truthy,
    // docs-less envelope (the f156c11 failure mode), MESSAGES must ignore it
    // and serve from the direct/REST path.
    jest.spyOn(apiWrapper, 'getCsrWrapper').mockResolvedValue({
      api: { user: { findUserContacts: jest.fn().mockResolvedValue({ junk: true }) } },
    });
    const body = { docs: [{ _id: 'm1' }] };
    jest.spyOn(apiWrapper, '_csrPost').mockResolvedValue(body);

    const res = await apiWrapper.csrFindUserContactMessages({ userId: 'u1' });

    expect(res).toBe(body);
  });

  test('direct POST 404 → inbox-wide scan + filter by targetUserId', async () => {
    jest.spyOn(apiWrapper, '_csrPost').mockRejectedValue(err(404));
    jest.spyOn(apiWrapper, 'csrFindContactMessages').mockResolvedValue({
      docs: [
        { _id: 'keep', content: { targetUserId: 'u1' } },
        { _id: 'drop', content: { targetUserId: 'other' } },
      ],
      noMoreDocs: true,
    });

    const res = await apiWrapper.csrFindUserContactMessages({ userId: 'u1' });

    expect(res._fallback).toBe('inbox-filter');
    expect(res.docs.map((d) => d._id)).toEqual(['keep']);
  });

  test('inbox filter matches by sender email when no targetUserId is set', async () => {
    jest.spyOn(apiWrapper, '_csrPost').mockRejectedValue(err(404));
    jest.spyOn(apiWrapper, 'csrFindContactMessages').mockResolvedValue({
      docs: [
        { _id: 'keep', content: { input: { email: 'Test1@Gmail.com' } } },
        { _id: 'drop', content: { input: { email: 'nope@x.com' } } },
      ],
    });

    const res = await apiWrapper.csrFindUserContactMessages({
      userId: 'u1',
      userEmail: 'test1@gmail.com', // case-insensitive match
    });

    expect(res.docs.map((d) => d._id)).toEqual(['keep']);
  });

  test('non-404 direct error rethrows — failures must surface, not silently empty', async () => {
    jest.spyOn(apiWrapper, '_csrPost').mockRejectedValue(err(500, 'boom'));
    const filterSpy = jest.spyOn(apiWrapper, 'csrFindContactMessages');

    await expect(
      apiWrapper.csrFindUserContactMessages({ userId: 'u1' }),
    ).rejects.toThrow('boom');
    expect(filterSpy).not.toHaveBeenCalled();
  });

  test('throws when neither userId nor userEmail is provided', async () => {
    await expect(apiWrapper.csrFindUserContactMessages({})).rejects.toThrow(
      /userId or userEmail/,
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('csrFindUserAdminNotes — NOTES go IIFE-first', () => {
  test('uses the CSR IIFE findUserAdminNotes when present, and unwraps it', async () => {
    const data = { docs: [{ _id: 'n1' }] };
    const findUserAdminNotes = jest.fn().mockResolvedValue({ getData: () => data });
    jest.spyOn(apiWrapper, 'getCsrWrapper').mockResolvedValue({
      api: { user: { findUserAdminNotes } },
    });
    const getSpy = jest.spyOn(apiWrapper, '_csrGet');

    const res = await apiWrapper.csrFindUserAdminNotes({ userId: 'u1' });

    expect(res).toBe(data);
    expect(findUserAdminNotes).toHaveBeenCalledWith({ userId: 'u1' });
    expect(getSpy).not.toHaveBeenCalled(); // IIFE served it; no REST fallback
  });

  test('falls back to direct GET when the IIFE is unavailable', async () => {
    jest.spyOn(apiWrapper, 'getCsrWrapper').mockResolvedValue(null);
    const body = { docs: [{ _id: 'n2' }] };
    jest.spyOn(apiWrapper, '_csrGet').mockResolvedValue(body);

    const res = await apiWrapper.csrFindUserAdminNotes({ userId: 'u1' });

    expect(res).toBe(body);
    expect(apiWrapper._csrGet).toHaveBeenCalledWith(
      expect.stringContaining('/message/admin/findNotes?userId=u1'),
    );
  });

  test('falls back to direct GET when the IIFE method throws', async () => {
    jest.spyOn(apiWrapper, 'getCsrWrapper').mockResolvedValue({
      api: { user: { findUserAdminNotes: jest.fn().mockRejectedValue(err(500)) } },
    });
    const body = { docs: [{ _id: 'n3' }] };
    jest.spyOn(apiWrapper, '_csrGet').mockResolvedValue(body);

    const res = await apiWrapper.csrFindUserAdminNotes({ userId: 'u1' });

    expect(res).toBe(body);
    expect(apiWrapper._csrGet).toHaveBeenCalled();
  });

  test('requires userId', async () => {
    await expect(apiWrapper.csrFindUserAdminNotes({})).rejects.toThrow(/userId is required/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tracking tab (Searches / Reports / Logins). History: 2026-05-31 a client
// `docs.filter(d => d.updaterId === id)` wiped rows (updaterId was thought
// absent). 2026-06-05 we VERIFIED live that BC IGNORES query.updaterId on the
// `trackings` collection (returns events across all users) AND updaterId IS
// present per-doc — so the page DOES client-filter again (privacy), and the
// wrapper requests a large `perPage` so that filter has the user's events to
// find. This block tests the WRAPPER's request shape (the client filter lives
// in UserDetailPage). The wrapper returns docs verbatim.
// REGRESSION LOCK: BC's /database/search honors user filters ONLY under `query`.
// A top-level phone/email/etc. is ignored and BC returns the default list — which
// rendered "users with empty phones" as fake matches (2026-06-05).
describe('csrFindUsers — filters MUST be nested under query (not top-level)', () => {
  test('email/phone/zip/panLast4 go under query; lastId/perPage stay top-level', async () => {
    jest.spyOn(apiWrapper, '_csrPost').mockResolvedValue({ docs: [] });

    await apiWrapper.csrFindUsers({ phone: '3106134575', lastId: 'c1', perPage: 50 });

    expect(apiWrapper._csrPost).toHaveBeenCalledWith('/database/search', {
      brandId: 'idlookup',
      collectionName: 'users',
      query: { phone: '3106134575' },
      lastId: 'c1',
      perPage: 50,
    });
  });

  test('no filters → empty query (browse default list)', async () => {
    jest.spyOn(apiWrapper, '_csrPost').mockResolvedValue({ docs: [] });

    await apiWrapper.csrFindUsers({});

    expect(apiWrapper._csrPost).toHaveBeenCalledWith('/database/search', {
      brandId: 'idlookup',
      collectionName: 'users',
      query: {},
    });
  });
});

describe('csrFindUserTracking — query shape (updaterId + perPage), returns verbatim', () => {
  test('sends updaterId in the query AND requests a large perPage page', async () => {
    jest.spyOn(apiWrapper, '_csrPost').mockResolvedValue({ docs: [] });

    await apiWrapper.csrFindUserTracking({ updaterId: 'u1', type: 'USER:login' });

    // We still send updaterId (BC IGNORES it — verified live 2026-06-05 — so the
    // caller client-filters; sending it remains correct intent + future-proofs a
    // BC server-side fix). perPage:100 lifts BC's 10-doc default so the per-user
    // filter actually has the user's events to find.
    expect(apiWrapper._csrPost).toHaveBeenCalledWith('/database/search', {
      collectionName: 'trackings',
      query: { 'data.type': 'USER:login', updaterId: 'u1' },
      perPage: 100,
      displayFields: ['_id', 'createdAt', 'data', 'updaterId', 'trackingIds'],
    });
  });

  test('returns BC docs VERBATIM (no filtering at the wrapper layer)', async () => {
    // The wrapper never filters — the per-user client filter lives in
    // UserDetailPage. The wrapper must return whatever BC sends, untouched.
    const body = {
      docs: [
        { _id: 't1', data: { type: 'USER:login' } }, // note: no updaterId field
        { _id: 't2', data: { type: 'USER:login' } },
      ],
      noMoreDocs: true,
    };
    jest.spyOn(apiWrapper, '_csrPost').mockResolvedValue(body);

    const res = await apiWrapper.csrFindUserTracking({ updaterId: 'u1', type: 'USER:login' });

    expect(res).toBe(body);
    expect(res.docs).toHaveLength(2);
  });

  test('forwards lastId for pagination and omits empty query keys', async () => {
    jest.spyOn(apiWrapper, '_csrPost').mockResolvedValue({ docs: [] });

    await apiWrapper.csrFindUserTracking({ lastId: 'cursor9' });

    expect(apiWrapper._csrPost).toHaveBeenCalledWith('/database/search', {
      collectionName: 'trackings',
      query: {},
      perPage: 100,
      displayFields: ['_id', 'createdAt', 'data', 'updaterId', 'trackingIds'],
      lastId: 'cursor9',
    });
  });
});
