// Identity-events stream (Neon) — the backbone that feeds My Activity + the My Identity monitoring card +
// (later) the notification bell. Breach alerts write here now; new-record / WSFY-search events can ride the
// same stream later. Keyed by user_key = SHA-256 of the member's email (stable, no plaintext stored here).
// Never throws — degrades to no-op / empty so a DB blip never breaks the identity view.
import { neon } from '@neondatabase/serverless';
import { createHash } from 'node:crypto';

const URL = process.env.LEADS_DATABASE_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
export const hasIdentityEvents = !!URL;
const sql = hasIdentityEvents ? neon(URL) : null;

export const userKey = (email) => createHash('sha256').update(String(email || '').trim().toLowerCase()).digest('hex');

let _ensured = false;
async function ensureTable() {
  if (_ensured || !sql) return;
  try {
    await sql`CREATE TABLE IF NOT EXISTS identity_events (
      id text PRIMARY KEY,
      user_key text NOT NULL,
      dedup_key text,
      type text NOT NULL,
      title text NOT NULL,
      detail text,
      data jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    )`;
    await sql`CREATE INDEX IF NOT EXISTS identity_events_user_idx ON identity_events (user_key, created_at DESC)`;
    // One event per (user, dedup_key) — e.g. a given breach for a given member is logged once, ever.
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS identity_events_dedup_idx ON identity_events (user_key, dedup_key) WHERE dedup_key IS NOT NULL`;
    _ensured = true;
  } catch { /* leave unensured — add/get will just no-op/miss */ }
}

/**
 * Append an event. dedupKey makes it idempotent (repeat writes for the same finding are ignored), so
 * calling this on every identity-view load never spams the feed. Returns true if a NEW row was inserted.
 * `nowIso` is passed in by the caller (scripts can't call Date.now()); defaults to server now() when omitted.
 */
export async function addIdentityEvent(email, { type, title, detail, data, dedupKey, nowIso } = {}) {
  if (!sql || !email || !type || !title) return false;
  await ensureTable();
  const id = `ie_${userKey(email).slice(0, 12)}_${(dedupKey || Math.random().toString(36).slice(2)).slice(0, 40)}`;
  try {
    const rows = await sql`INSERT INTO identity_events (id, user_key, dedup_key, type, title, detail, data, created_at)
      VALUES (${id}, ${userKey(email)}, ${dedupKey || null}, ${type}, ${title}, ${detail || null},
        ${JSON.stringify(data || {})}::jsonb, COALESCE(${nowIso || null}::timestamptz, now()))
      ON CONFLICT DO NOTHING
      RETURNING id`;
    return Array.isArray(rows) && rows.length > 0;
  } catch { return false; }
}

/**
 * Append an event addressed by the member's user_key (sha256 email) directly — for callers that hold the
 * hash but not the plaintext email (e.g. the exposure re-check cron, where the graph stores only the hash).
 * Same idempotency contract as addIdentityEvent. Returns true if a NEW row was inserted.
 */
export async function addIdentityEventByUserKey(uk, { type, title, detail, data, dedupKey, nowIso } = {}) {
  if (!sql || !uk || !type || !title) return false;
  await ensureTable();
  const id = `ie_${String(uk).slice(0, 12)}_${(dedupKey || Math.random().toString(36).slice(2)).slice(0, 40)}`;
  try {
    const rows = await sql`INSERT INTO identity_events (id, user_key, dedup_key, type, title, detail, data, created_at)
      VALUES (${id}, ${uk}, ${dedupKey || null}, ${type}, ${title}, ${detail || null},
        ${JSON.stringify(data || {})}::jsonb, COALESCE(${nowIso || null}::timestamptz, now()))
      ON CONFLICT DO NOTHING
      RETURNING id`;
    return Array.isArray(rows) && rows.length > 0;
  } catch { return false; }
}

/** Recent events for a member (newest first), or [] on miss/error. */
export async function getIdentityEvents(email, limit = 50) {
  if (!sql || !email) return [];
  await ensureTable();
  try {
    const rows = await sql`SELECT id, type, title, detail, data, created_at FROM identity_events
      WHERE user_key = ${userKey(email)} ORDER BY created_at DESC LIMIT ${Math.min(200, Math.max(1, limit))}`;
    return Array.isArray(rows) ? rows : [];
  } catch { return []; }
}
