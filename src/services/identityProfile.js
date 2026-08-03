/**
 * First-party identity profile — the user's OWN self-declared identity.
 *
 * Owner directive (2026-08-03): "capture ALL the data and assume it is part of the user's identity."
 * The self flow (/my-exposure) collects first/middle/last/city/state (+ age) — that is the user telling us
 * who they are. Persist it durably here so it survives the session and populates /my-identity, whether or not
 * they pay.
 *
 * This is DECLARED identity (what the user typed about themselves) — distinct from BC RECORD data (their public
 * records, for which BC is source of truth). Self-declared profile input is legitimately first-party, so we
 * store it on-device (localStorage). Cross-device sync can move to a server/BC store later; v1 is single-device.
 */

const KEY = 'myIdentityProfile';
const FIELDS = ['firstName', 'middleName', 'lastName', 'age', 'city', 'state'];

/** Read the durable declared identity. Returns null if none. */
export function getDeclaredIdentity() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    return (obj && typeof obj === 'object') ? obj : null;
  } catch { return null; }
}

/**
 * Merge a partial declared identity into the durable store. Only non-empty values overwrite (so a later,
 * sparser capture never wipes fields from an earlier, richer one). Returns the merged object.
 */
export function saveDeclaredIdentity(partial) {
  if (!partial || typeof partial !== 'object') return getDeclaredIdentity();
  try {
    const prev = getDeclaredIdentity() || {};
    const next = { ...prev };
    for (const f of FIELDS) {
      const v = partial[f];
      if (v != null && String(v).trim() !== '') next[f] = String(v).trim();
    }
    next.updatedAt = new Date().toISOString();
    localStorage.setItem(KEY, JSON.stringify(next));
    return next;
  } catch { return getDeclaredIdentity(); }
}

/** True if we have at least a first + last name on file. */
export function hasDeclaredIdentity() {
  const id = getDeclaredIdentity();
  return !!(id && id.firstName && id.lastName);
}
