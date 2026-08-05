// Exposure Graph data layer (Neon) — the spine for digital-footprint management.
// Schema: seo/db/exposure-graph-schema.sql (tables also self-created lazily below). One node =
// (subject × source × url) = a specific listing on a specific provider. Never throws to the caller
// on read paths — degrades to empty. See docs/product/exposure-graph-spine.md.
import { neon } from '@neondatabase/serverless';

const URL = process.env.LEADS_DATABASE_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
export const hasExposureDb = !!URL;
const sql = hasExposureDb ? neon(URL) : null;

let _ensured = false;
async function ensureTables() {
  if (_ensured || !sql) return;
  try {
    await sql`CREATE TABLE IF NOT EXISTS exposure_node (
      id BIGSERIAL PRIMARY KEY,
      subject_key TEXT NOT NULL,
      surface_type TEXT NOT NULL,
      source_key TEXT NOT NULL,
      url TEXT NOT NULL DEFAULT '',
      found_status TEXT NOT NULL DEFAULT 'unknown',
      data_types TEXT[] NOT NULL DEFAULT '{}',
      exposure_detail JSONB,
      screenshot_url TEXT,
      sentiment TEXT,
      confidence TEXT NOT NULL DEFAULT 'medium',
      severity INT NOT NULL DEFAULT 1,
      control_status TEXT NOT NULL DEFAULT 'none',
      control_method TEXT,
      external_ref TEXT,
      first_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_checked TIMESTAMPTZ NOT NULL DEFAULT now(),
      last_changed TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (subject_key, source_key, url)
    )`;
    await sql`CREATE INDEX IF NOT EXISTS idx_expnode_subject ON exposure_node(subject_key)`;
    await sql`CREATE TABLE IF NOT EXISTS exposure_event (
      id BIGSERIAL PRIMARY KEY, node_id BIGINT, subject_key TEXT NOT NULL,
      event_type TEXT NOT NULL, method TEXT, detail JSONB, screenshot_url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
    await sql`CREATE TABLE IF NOT EXISTS source_registry (
      source_key TEXT PRIMARY KEY, surface_type TEXT NOT NULL, display_name TEXT NOT NULL,
      category TEXT, opt_out_url TEXT, removal_method TEXT, relist_days INT, weight INT NOT NULL DEFAULT 1
    )`;
    await sql`CREATE TABLE IF NOT EXISTS owner_annotation (
      id BIGSERIAL PRIMARY KEY, subject_key TEXT NOT NULL, node_id BIGINT, record_key TEXT, label TEXT,
      note TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
      subject_name_norm TEXT, subject_state TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
    await sql`ALTER TABLE owner_annotation ADD COLUMN IF NOT EXISTS record_key TEXT`;
    await sql`ALTER TABLE owner_annotation ADD COLUMN IF NOT EXISTS label TEXT`;
    await sql`ALTER TABLE owner_annotation ADD COLUMN IF NOT EXISTS subject_name_norm TEXT`;
    await sql`ALTER TABLE owner_annotation ADD COLUMN IF NOT EXISTS subject_state TEXT`;
    await sql`CREATE INDEX IF NOT EXISTS idx_ann_subject_name ON owner_annotation(subject_name_norm)`;
    _ensured = true;
  } catch { /* leave unensured — reads/writes will just miss/no-op */ }
}

// ── Provider catalog ────────────────────────────────────────────────────────
// Seeded from the brokers already curated in the consumer DigitalFootprint component + Google + our
// own surfaces + the major social nets. removal_method routes an action to the right engine later.
const SEED_SOURCES = [
  { k: 'idlookup', t: 'idlookup', n: 'IDLookup', c: 'people_search', u: null, m: 'our_suppression', r: null, w: 3 },
  { k: 'spokeo', t: 'data_broker', n: 'Spokeo', c: 'people_search', u: 'https://www.spokeo.com/optout', m: 'manual', r: 90, w: 2 },
  { k: 'beenverified', t: 'data_broker', n: 'BeenVerified', c: 'people_search', u: 'https://www.beenverified.com/app/optout/search', m: 'manual', r: 90, w: 2 },
  { k: 'peoplefinders', t: 'data_broker', n: 'PeopleFinders', c: 'people_search', u: 'https://www.peoplefinders.com/opt-out', m: 'manual', r: 90, w: 2 },
  { k: 'whitepages', t: 'data_broker', n: 'Whitepages', c: 'people_search', u: 'https://www.whitepages.com/suppression-requests', m: 'manual', r: 120, w: 2 },
  { k: 'intelius', t: 'data_broker', n: 'Intelius', c: 'people_search', u: 'https://www.intelius.com/opt-out/', m: 'manual', r: 90, w: 2 },
  { k: 'radaris', t: 'data_broker', n: 'Radaris', c: 'people_search', u: 'https://radaris.com/control/privacy', m: 'manual', r: 120, w: 2 },
  { k: 'mylife', t: 'data_broker', n: 'MyLife', c: 'people_search', u: 'https://www.mylife.com/ccpa/index.pubview', m: 'manual', r: 120, w: 2 },
  { k: 'google', t: 'search_result', n: 'Google Search results', c: 'search', u: 'https://myactivity.google.com/results-about-you', m: 'google_rar', r: null, w: 3 },
  { k: 'linkedin', t: 'social_profile', n: 'LinkedIn', c: 'social', u: null, m: 'owner', r: null, w: 1 },
  { k: 'facebook', t: 'social_profile', n: 'Facebook', c: 'social', u: null, m: 'owner', r: null, w: 1 },
  { k: 'instagram', t: 'social_profile', n: 'Instagram', c: 'social', u: null, m: 'owner', r: null, w: 1 },
  { k: 'twitter', t: 'social_profile', n: 'X / Twitter', c: 'social', u: null, m: 'owner', r: null, w: 1 },
];

export async function seedSourceRegistry() {
  if (!sql) return;
  await ensureTables();
  for (const s of SEED_SOURCES) {
    try {
      await sql`INSERT INTO source_registry (source_key, surface_type, display_name, category, opt_out_url, removal_method, relist_days, weight)
        VALUES (${s.k}, ${s.t}, ${s.n}, ${s.c}, ${s.u}, ${s.m}, ${s.r}, ${s.w})
        ON CONFLICT (source_key) DO NOTHING`;
    } catch { /* ignore */ }
  }
}

export async function getSourceRegistry() {
  if (!sql) return [];
  await ensureTables();
  try { return await sql`SELECT * FROM source_registry ORDER BY weight DESC, display_name`; }
  catch { return []; }
}

// ── Nodes ───────────────────────────────────────────────────────────────────
/** Upsert one node keyed by (subject_key, source_key, url). Merges the passed fields.
 *  By default a re-scan updates found/detail but PRESERVES control_status (never clobber a user's
 *  action). Pass syncControl:true for source-DERIVED control (e.g. the IDLookup node, whose control
 *  state IS the member's suppression flag) so it re-syncs each federation. */
export async function upsertNode(n) {
  if (!sql || !n || !n.subjectKey || !n.sourceKey || !n.surfaceType) return null;
  await ensureTables();
  const url = n.url || '';
  const dataTypes = Array.isArray(n.dataTypes) ? n.dataTypes : [];
  const detail = n.exposureDetail ? JSON.stringify(n.exposureDetail) : null;
  const common = {
    st: n.surfaceType, fs: n.foundStatus || 'unknown', dt: dataTypes, ed: detail, ss: n.screenshotUrl || null,
    se: n.sentiment || null, cf: n.confidence || 'medium', sv: n.severity ?? 1, cs: n.controlStatus || 'none',
    cm: n.controlMethod || null, xr: n.externalRef || null,
  };
  try {
    const rows = n.syncControl
      ? await sql`
        INSERT INTO exposure_node (subject_key, surface_type, source_key, url, found_status, data_types, exposure_detail, screenshot_url, sentiment, confidence, severity, control_status, control_method, external_ref, last_checked, last_changed)
        VALUES (${n.subjectKey}, ${common.st}, ${n.sourceKey}, ${url}, ${common.fs}, ${common.dt}, ${common.ed}, ${common.ss}, ${common.se}, ${common.cf}, ${common.sv}, ${common.cs}, ${common.cm}, ${common.xr}, now(), now())
        ON CONFLICT (subject_key, source_key, url) DO UPDATE SET
          found_status = EXCLUDED.found_status, data_types = EXCLUDED.data_types,
          exposure_detail = COALESCE(EXCLUDED.exposure_detail, exposure_node.exposure_detail),
          screenshot_url = COALESCE(EXCLUDED.screenshot_url, exposure_node.screenshot_url),
          sentiment = COALESCE(EXCLUDED.sentiment, exposure_node.sentiment), confidence = EXCLUDED.confidence, severity = EXCLUDED.severity,
          control_status = EXCLUDED.control_status, control_method = EXCLUDED.control_method,
          last_checked = now(),
          last_changed = CASE WHEN exposure_node.found_status IS DISTINCT FROM EXCLUDED.found_status OR exposure_node.control_status IS DISTINCT FROM EXCLUDED.control_status THEN now() ELSE exposure_node.last_changed END
        RETURNING id`
      : await sql`
        INSERT INTO exposure_node (subject_key, surface_type, source_key, url, found_status, data_types, exposure_detail, screenshot_url, sentiment, confidence, severity, control_status, control_method, external_ref, last_checked, last_changed)
        VALUES (${n.subjectKey}, ${common.st}, ${n.sourceKey}, ${url}, ${common.fs}, ${common.dt}, ${common.ed}, ${common.ss}, ${common.se}, ${common.cf}, ${common.sv}, ${common.cs}, ${common.cm}, ${common.xr}, now(), now())
        ON CONFLICT (subject_key, source_key, url) DO UPDATE SET
          found_status = EXCLUDED.found_status, data_types = EXCLUDED.data_types,
          exposure_detail = COALESCE(EXCLUDED.exposure_detail, exposure_node.exposure_detail),
          screenshot_url = COALESCE(EXCLUDED.screenshot_url, exposure_node.screenshot_url),
          sentiment = COALESCE(EXCLUDED.sentiment, exposure_node.sentiment), confidence = EXCLUDED.confidence, severity = EXCLUDED.severity,
          last_checked = now(),
          last_changed = CASE WHEN exposure_node.found_status IS DISTINCT FROM EXCLUDED.found_status THEN now() ELSE exposure_node.last_changed END
        RETURNING id`;
    return rows && rows[0] ? rows[0].id : null;
  } catch { return null; }
}

/** Set the control status/method on a node (routes downstream later) + log the event. */
export async function setNodeControl(nodeId, { subjectKey, controlStatus, controlMethod, externalRef, eventType, detail } = {}) {
  if (!sql || !nodeId) return false;
  await ensureTables();
  try {
    await sql`UPDATE exposure_node SET control_status = ${controlStatus}, control_method = ${controlMethod || null},
      external_ref = COALESCE(${externalRef || null}, external_ref), last_changed = now() WHERE id = ${nodeId}`;
    await sql`INSERT INTO exposure_event (node_id, subject_key, event_type, method, detail)
      VALUES (${nodeId}, ${subjectKey || null}, ${eventType || 'control_changed'}, ${controlMethod || null},
        ${detail ? JSON.stringify(detail) : null})`;
    return true;
  } catch { return false; }
}

export async function getNodesForSubject(subjectKey) {
  if (!sql || !subjectKey) return [];
  await ensureTables();
  try { return await sql`SELECT * FROM exposure_node WHERE subject_key = ${subjectKey} ORDER BY severity DESC, surface_type, source_key`; }
  catch { return []; }
}

export async function logExposureEvent(e) {
  if (!sql || !e || !e.subjectKey || !e.eventType) return;
  await ensureTables();
  try {
    await sql`INSERT INTO exposure_event (node_id, subject_key, event_type, method, detail, screenshot_url)
      VALUES (${e.nodeId || null}, ${e.subjectKey}, ${e.eventType}, ${e.method || null},
        ${e.detail ? JSON.stringify(e.detail) : null}, ${e.screenshotUrl || null})`;
  } catch { /* ignore */ }
}

// ── Owner Voice (annotations) ───────────────────────────────────────────────
// The identity owner's context on a record/exposure ("DUI 1996" → "went to rehab in 1997, sober since").
// Confirmed-owner-gated at the route.

// Auto-moderation — the mechanical guardrails from the spec (no links, no third-party contact info, no
// slurs, length bounds). Hard violations are REJECTED (never stored). Clean notes pass to 'approved' so
// the owner can use them now; when we surface notes to VIEWERS we'll add human review on top of this.
const SLURS = /\b(fuck|shit|bitch|cunt|nigger|faggot|retard|whore)\w*\b/i;
export function moderateNote(note) {
  const t = String(note || '').trim();
  if (t.length < 3) return { status: 'rejected', reason: 'Too short.' };
  if (t.length > 1000) return { status: 'rejected', reason: 'Too long — keep it under 1000 characters.' };
  if (/https?:\/\/|\bwww\./i.test(t)) return { status: 'rejected', reason: 'Links aren’t allowed in notes.' };
  if (/[\w.+-]+@[\w-]+\.[\w.-]+/.test(t)) return { status: 'rejected', reason: 'Please don’t include email addresses.' };
  if (/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/.test(t)) return { status: 'rejected', reason: 'Please don’t include phone numbers.' };
  if (SLURS.test(t)) return { status: 'rejected', reason: 'Keep it civil — no slurs or profanity.' };
  return { status: 'approved', reason: null };
}

const normName = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Add an owner note. Auto-moderates first; rejected notes are NOT stored. The owner's own identity
 *  (name/state) is denormalized on the row so a VIEWER can look the note up on the public record.
 *  Returns { id, status, reason }. */
export async function addAnnotation({ subjectKey, nodeId, recordKey, label, note, name, state }) {
  if (!sql || !subjectKey || !note) return { id: null, status: 'rejected', reason: 'Empty note.' };
  const mod = moderateNote(note);
  if (mod.status === 'rejected') return { id: null, status: 'rejected', reason: mod.reason };
  await ensureTables();
  try {
    const rows = await sql`INSERT INTO owner_annotation (subject_key, node_id, record_key, label, note, status, subject_name_norm, subject_state)
      VALUES (${subjectKey}, ${nodeId || null}, ${recordKey || null}, ${label || null}, ${String(note).slice(0, 1000)}, ${mod.status}, ${normName(name) || null}, ${(state || '').toUpperCase().trim() || null})
      RETURNING id`;
    return { id: rows && rows[0] ? rows[0].id : null, status: mod.status, reason: null };
  } catch { return { id: null, status: 'error', reason: 'Could not save. Try again.' }; }
}

/** PUBLIC read: approved owner notes for a subject IDENTITY (name + optional state) — what a VIEWER sees
 *  on the person's record. Small universe: only claimed members who added (auto-approved) UGC appear. */
export async function getApprovedNotesForIdentity({ name, state }) {
  if (!sql || !name) return [];
  await ensureTables();
  const nn = normName(name);
  if (!nn) return [];
  const st = (state || '').toUpperCase().trim();
  try {
    return await sql`SELECT id, record_key, label, note, created_at FROM owner_annotation
      WHERE status = 'approved' AND subject_name_norm = ${nn}
      AND (subject_state IS NULL OR ${st} = '' OR upper(subject_state) = ${st})
      ORDER BY created_at DESC`;
  } catch { return []; }
}

export async function getAnnotationsForSubject(subjectKey) {
  if (!sql || !subjectKey) return [];
  await ensureTables();
  try { return await sql`SELECT id, node_id, record_key, label, note, status, created_at FROM owner_annotation WHERE subject_key = ${subjectKey} ORDER BY created_at DESC`; }
  catch { return []; }
}

export async function deleteAnnotation({ subjectKey, id }) {
  if (!sql || !subjectKey || !id) return false;
  await ensureTables();
  try { await sql`DELETE FROM owner_annotation WHERE id = ${id} AND subject_key = ${subjectKey}`; return true; }
  catch { return false; }
}

// ── Score ─────────────────────────────────────────────────────────────────
const CONTROLLED = new Set(['hidden', 'removed', 'optout_confirmed']);
/** Roll a node set into an exposure summary: counts + a 0-100 score (higher = more exposed). */
export function summarizeNodes(nodes) {
  let exposedW = 0, totalW = 0, found = 0, controlled = 0, inProgress = 0;
  for (const n of nodes || []) {
    const w = n.severity || 1;
    if (n.found_status === 'found') {
      found += 1; totalW += w;
      if (CONTROLLED.has(n.control_status)) controlled += 1;
      else { exposedW += w; if (n.control_status === 'optout_requested' || n.control_status === 'correction_requested') inProgress += 1; }
    }
  }
  const score = totalW ? Math.round((exposedW / totalW) * 100) : 0;
  return { score, found, controlled, inProgress, exposed: found - controlled };
}
