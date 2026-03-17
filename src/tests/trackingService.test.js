/**
 * Tests for src/services/trackingService.js
 *
 * Contract under test:
 *   export function track(eventName, properties = {})
 *   - POSTs to http://localhost:3001/api/v1/admin/events
 *   - Fire-and-forget: never throws, errors silently swallowed
 *   - Uses sessionStorage for a stable trackingSessionId within a session
 */

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Returns the parsed JSON body from the most recent fetch call.
 */
function getLastFetchBody() {
  const calls = global.fetch.mock.calls;
  if (!calls.length) return null;
  const [, options] = calls[calls.length - 1];
  try {
    return JSON.parse(options?.body);
  } catch {
    return null;
  }
}

/**
 * Returns all parsed JSON bodies from all fetch calls.
 */
function getAllFetchBodies() {
  return global.fetch.mock.calls.map(([, options]) => {
    try {
      return JSON.parse(options?.body);
    } catch {
      return null;
    }
  });
}

// ─── Module under test ───────────────────────────────────────────────────────

// Import after setting up mocks (hoisted by Babel/Jest transform).
// We import at the top level; beforeEach resets sessionStorage and the fetch
// mock so each test starts clean without re-requiring the module.
import { track } from '../services/trackingService';

// ─── Setup / teardown ────────────────────────────────────────────────────────

beforeEach(() => {
  sessionStorage.clear();

  // Replace global.fetch with a jest.fn() that always resolves successfully
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ ok: true }),
  });
});

afterEach(() => {
  jest.restoreAllMocks();
  delete global.fetch;
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('trackingService.track()', () => {
  // 1. Fires a fetch POST to the correct URL
  test('fires a fetch POST to http://localhost:3001/api/v1/admin/events', () => {
    track('test_event');

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe('http://localhost:3001/api/v1/admin/events');
    expect(options.method).toBe('POST');
  });

  // 2. Payload shape — body includes { event, timestamp, sessionId, properties }
  test('sends payload with event, timestamp, sessionId, and properties in the request body', () => {
    track('page_view', { page: '/home' });

    const body = getLastFetchBody();
    expect(body).not.toBeNull();
    expect(body).toHaveProperty('event');
    expect(body).toHaveProperty('timestamp');
    expect(body).toHaveProperty('sessionId');
    expect(body).toHaveProperty('properties');
  });

  // 3. sessionId is stable within a session — two calls use the same sessionId
  test('uses the same sessionId across multiple track() calls in a session', () => {
    track('first_event');
    track('second_event');

    const bodies = getAllFetchBodies();
    expect(bodies).toHaveLength(2);
    expect(bodies[0].sessionId).toBe(bodies[1].sessionId);
  });

  // 4. sessionId is a non-empty string
  test('sessionId is a non-empty string', () => {
    track('some_event');

    const body = getLastFetchBody();
    expect(typeof body.sessionId).toBe('string');
    expect(body.sessionId.length).toBeGreaterThan(0);
  });

  // 5. Does NOT throw on fetch failure — errors are silently swallowed
  test('does not throw when fetch rejects', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

    // Must not throw synchronously
    expect(() => track('test_event')).not.toThrow();

    // Also must not cause an unhandled rejection — allow microtasks to flush
    await Promise.resolve();
    await Promise.resolve();
  });

  // 6. Returns synchronously (fire-and-forget) — does not await the network call
  test('returns without waiting for fetch to complete (fire-and-forget)', () => {
    let fetchResolved = false;
    global.fetch = jest.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          // Delay resolution to verify track() returns before fetch settles
          setTimeout(() => {
            fetchResolved = true;
            resolve({ ok: true, status: 200, json: () => Promise.resolve({}) });
          }, 10000);
        })
    );

    // track() must return synchronously (or at least not await the delayed fetch)
    const result = track('any_event');

    // The fetch must NOT have resolved yet at this point
    expect(fetchResolved).toBe(false);

    // The return value should be either undefined or a Promise that resolves quickly,
    // but the key point is fetchResolved is still false (we did not block on it).
    // Accept undefined or a Promise (both are fire-and-forget patterns).
    expect(result === undefined || result instanceof Promise).toBe(true);
  });

  // 7. properties are forwarded in the body
  test('includes the provided properties object in the request body', () => {
    track('page_view', { page: '/dashboard', referrer: '/home' });

    const body = getLastFetchBody();
    expect(body.properties).toEqual({ page: '/dashboard', referrer: '/home' });
  });

  // 8. event name is in the body
  test('includes the event name in the request body', () => {
    track('page_view');

    const body = getLastFetchBody();
    expect(body.event).toBe('page_view');
  });

  // Additional: default properties is an empty object when omitted
  test('defaults properties to an empty object when not provided', () => {
    track('login');

    const body = getLastFetchBody();
    expect(body.properties).toEqual({});
  });

  // Additional: timestamp is an ISO string or a number (valid date value)
  test('timestamp is a valid date representation', () => {
    track('any_event');

    const body = getLastFetchBody();
    const ts = body.timestamp;
    // Accept ISO string or numeric timestamp
    const parsed = typeof ts === 'string' ? new Date(ts) : new Date(ts);
    expect(isNaN(parsed.getTime())).toBe(false);
  });

  // Additional: sessionId is persisted in sessionStorage so it survives re-calls
  test('persists sessionId in sessionStorage under the key "trackingSessionId"', () => {
    track('init_event');

    const stored = sessionStorage.getItem('trackingSessionId');
    expect(stored).not.toBeNull();
    expect(typeof stored).toBe('string');
    expect(stored.length).toBeGreaterThan(0);
  });

  // Additional: sessionId read from sessionStorage when already present
  test('reads an existing trackingSessionId from sessionStorage instead of generating a new one', () => {
    // Pre-seed sessionStorage with a known value
    sessionStorage.setItem('trackingSessionId', 'preset-session-abc');

    track('click_event');

    const body = getLastFetchBody();
    expect(body.sessionId).toBe('preset-session-abc');
  });
});
