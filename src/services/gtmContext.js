/**
 * GTM dataLayer context — single source of truth for the 27 canonical fields
 * that the GTM container (variables `Variable - X`) reads.
 *
 * Naming: dataLayer keys are camelCase derived from the GTM variable label
 * minus the "Variable - " prefix. e.g. "Variable - Target Ext ID" → `targetExtId`.
 *
 * Population responsibility:
 *   - User identity (email/firstName/lastName/phone/zip) → AuthContext after login
 *   - Search input (searchFirstName/...) → search-submit handlers
 *   - Selected identity (targetFirstName/...) → result-card click handlers
 *   - Transaction (orderId/transactionAmount/transactionCurrency) → PaymentPage after billing.sale
 *   - Partner channel/name → App boot from URL `?c=` (or `?utm_source=`/`utm_campaign=`)
 *   - SHN/SHL/SHN Name → apiRouter response interceptor, from BC's `shConId`/`shColId`/`brandId`
 *   - Session ID → generated client-side on first visit, persisted to sessionStorage
 *
 * Push semantics: setters only update internal state. `push(eventName, props)`
 * is what actually writes to `window.dataLayer` — it merges the full context
 * with the event-specific props so every event carries all 27 fields known
 * at that moment. Missing fields are `undefined` (GTM treats as not-set).
 */

const STATE_KEY = 'gtmDataLayerState';

const KEYS = [
  // authenticated user
  'email', 'firstName', 'lastName', 'phone', 'zip',
  // search input
  'searchFirstName', 'searchLastName', 'searchMiddleName', 'searchCity', 'searchState',
  // selected identity
  'targetFirstName', 'targetLastName', 'targetMiddleName', 'targetCity', 'targetState',
  'targetAge', 'targetPhone', 'targetExtId',
  // transaction
  'orderId', 'transactionAmount', 'transactionCurrency',
  // partner
  'partnerChannel', 'partnerName',
  // BC attribution
  'shn', 'shl', 'shnName',
  // session
  'sessionId',
];

const initial = KEYS.reduce((acc, k) => ({ ...acc, [k]: undefined }), {});
let state = { ...initial };

function persist() {
  if (typeof window === 'undefined') return;
  try { sessionStorage.setItem(STATE_KEY, JSON.stringify(state)); } catch {}
}

function hydrate() {
  if (typeof window === 'undefined') return;
  try {
    const stored = sessionStorage.getItem(STATE_KEY);
    if (stored) state = { ...initial, ...JSON.parse(stored) };
  } catch {}
  if (!state.sessionId) {
    state.sessionId =
      (window.crypto && typeof window.crypto.randomUUID === 'function')
        ? window.crypto.randomUUID()
        : `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    persist();
  }
}
hydrate();

function merge(patch) {
  // Only copy keys we know about — guards against accidental field pollution.
  const next = { ...state };
  for (const k of KEYS) {
    if (k in patch) next[k] = patch[k];
  }
  state = next;
  persist();
}

// ─── Setters ──────────────────────────────────────────────────────────────────

export function setUser({ email, firstName, lastName, phone, zip } = {}) {
  const patch = {};
  if (email !== undefined) patch.email = email || undefined;
  if (firstName !== undefined) patch.firstName = firstName || undefined;
  if (lastName !== undefined) patch.lastName = lastName || undefined;
  if (phone !== undefined) patch.phone = phone || undefined;
  if (zip !== undefined) patch.zip = zip || undefined;
  merge(patch);
}

export function clearUser() {
  merge({ email: undefined, firstName: undefined, lastName: undefined, phone: undefined, zip: undefined });
}

export function setSearchInput({ firstName, lastName, middleName, city, state: searchState } = {}) {
  merge({
    searchFirstName: firstName || undefined,
    searchLastName: lastName || undefined,
    searchMiddleName: middleName || undefined,
    searchCity: city || undefined,
    searchState: searchState || undefined,
  });
}

export function clearSearchTarget() {
  merge({
    targetFirstName: undefined, targetLastName: undefined, targetMiddleName: undefined,
    targetCity: undefined, targetState: undefined, targetAge: undefined,
    targetPhone: undefined, targetExtId: undefined,
  });
}

/**
 * Populated from a BC identity row (search result) when the user clicks it.
 * Identity shape varies; we accept any of the common field names.
 */
export function setSearchTarget(identity = {}) {
  if (!identity) return;
  const get = (...keys) => {
    for (const k of keys) {
      const v = identity[k];
      if (v !== undefined && v !== null && v !== '') return v;
    }
    return undefined;
  };
  merge({
    targetFirstName: get('firstName', 'fName', 'first_name'),
    targetLastName: get('lastName', 'lName', 'last_name'),
    targetMiddleName: get('middleName', 'mName', 'middle_name'),
    targetCity: get('city'),
    targetState: get('state'),
    targetAge: get('age'),
    targetPhone: get('phone'),
    targetExtId: get('extId', 'ext_id', 'externalId'),
  });
}

export function setTransaction({ orderId, amount, currency = 'USD' } = {}) {
  merge({
    orderId: orderId || undefined,
    transactionAmount: (amount === undefined || amount === null) ? undefined : Number(amount),
    transactionCurrency: currency || 'USD',
  });
}

export function setCampaign({ channel, name } = {}) {
  merge({
    partnerChannel: channel || undefined,
    partnerName: name || undefined,
  });
}

/**
 * Recursive extractor for BC's shared-host fields. BC responses nest these
 * inconsistently (sometimes at top-level, sometimes inside `commerceContent`
 * or `messageResult`). Walk up to a small depth and capture the first match.
 */
export function setBcAttributionFromResponse(resp) {
  if (resp == null || typeof resp !== 'object') return;
  const visit = (obj, depth = 0) => {
    if (depth > 5 || !obj || typeof obj !== 'object') return null;
    if ('shConId' in obj || 'shColId' in obj || 'brandId' in obj) {
      return {
        shn: obj.shConId,
        shl: obj.shColId,
        shnName: obj.brandId,
      };
    }
    for (const key of Object.keys(obj)) {
      const v = obj[key];
      if (v && typeof v === 'object') {
        const found = visit(v, depth + 1);
        if (found) return found;
      }
    }
    return null;
  };
  const found = visit(resp);
  if (!found) return;
  const patch = {};
  if (found.shn !== undefined) patch.shn = found.shn || undefined;
  if (found.shl !== undefined) patch.shl = found.shl || undefined;
  if (found.shnName !== undefined) patch.shnName = found.shnName || undefined;
  merge(patch);
}

// ─── Push ─────────────────────────────────────────────────────────────────────

/**
 * Push a GTM event with the full context attached. Pass `additional` for
 * event-specific keys not in the canonical set (e.g. funnel_step, search_type).
 */
export function push(eventName, additional = {}) {
  if (typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: eventName, ...state, ...additional });
}

/** For tests / debugging. */
export function getContextSnapshot() { return { ...state }; }
