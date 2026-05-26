/**
 * Client-side search history (localStorage ring buffer).
 *
 * BC does not currently expose a user-facing "search history" read endpoint.
 * The May-14 IIFE only surfaces COUNT statistics (countUserTeaserSearches /
 * userNameSearches / userReportCreations / userPdfDownloads) — none return
 * the actual list of past queries with timestamps and result counts.
 *
 * This module records every search the user performs to localStorage,
 * scoped per-user via a key derived from the JWT subject. The data is
 * per-device (no cross-device sync), bounded to the most recent N entries
 * to keep storage small, and entirely client-owned (no server round-trip).
 *
 * If/when BC ships a real history endpoint, swap the reader in
 * SearchHistoryPage to call the API and treat the localStorage buffer as
 * a cache / offline fallback. The shape returned here intentionally
 * matches what a future server endpoint would return so the page-level
 * code doesn't change.
 */

const STORAGE_KEY_PREFIX = 'searchHistory.';
const MAX_ENTRIES = 50;

/**
 * Decode the JWT subject from a token so we can scope history per-user.
 * Multiple users on the same device shouldn't see each other's history.
 * If we can't decode, fall back to a shared 'anon' bucket — better than
 * losing the data, and the page only loads when authenticated anyway.
 */
function userKeyFromToken() {
  if (typeof window === 'undefined') return null;
  try {
    const token = window.localStorage?.getItem('accessToken');
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const padded = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(padded));
    return payload.sub || payload.userId || payload.id || payload.email || null;
  } catch {
    return null;
  }
}

function storageKey() {
  const userKey = userKeyFromToken() || 'anon';
  return `${STORAGE_KEY_PREFIX}${userKey}`;
}

function read() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage?.getItem(storageKey());
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(entries) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage?.setItem(storageKey(), JSON.stringify(entries));
  } catch {
    // Storage quota exceeded or disabled — non-fatal.
  }
}

/**
 * Append a new search to the history.
 *
 * @param {Object} entry
 * @param {string} entry.type - 'name' | 'phone' | 'email'
 * @param {Object} entry.query - { firstName, lastName, state, phone, email, ... }
 * @param {number} [entry.resultCount] - number of results returned by BC
 * @param {string} [entry.source] - origin of the search (page name, optional)
 */
export function recordSearch(entry) {
  if (!entry || typeof entry !== 'object') return;
  const history = read();
  const record = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    timestamp: Date.now(),
    type: entry.type || 'name',
    query: entry.query || {},
    resultCount: typeof entry.resultCount === 'number' ? entry.resultCount : 0,
    source: entry.source || null,
  };
  const next = [record, ...history].slice(0, MAX_ENTRIES);
  write(next);
}

/**
 * Return all stored history entries, newest first.
 * Shape mirrors what a future BC endpoint should return.
 */
export function getSearchHistory() {
  return read();
}

/**
 * Remove a single entry by id.
 */
export function deleteSearchHistoryItem(id) {
  if (!id) return;
  const history = read();
  write(history.filter((item) => item.id !== id));
}

/**
 * Wipe all history for the current user.
 */
export function clearSearchHistory() {
  write([]);
}
