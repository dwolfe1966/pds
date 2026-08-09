// Daily usage cap for PAID Enformion calls (divorce/marriage). Owner decision 2026-07-19 (signals plan Q2):
// instead of gating the universal rollout on confirming Enformion's per-search-vs-per-match billing, bound
// cost with a hard per-day call cap. When the day's cap is reached we skip the live call and serve cache-only
// (still free) — so a cost blowup on anonymous long-tail-name traffic is impossible regardless of billing model.
//
// Cap = ENFORMION_DAILY_CAP (integer). Unset / ≤0 → no cap (allow all), preserving today's behavior until the
// owner sets a number. Counts only BILLABLE live calls (checked after the person-keyed cache miss), never cache
// hits. Fail-OPEN on missing DB / error: the cap is a cost backstop and the cache absorbs most calls, so
// blocking every lookup on a transient DB blip is worse than a small overrun.
import { neon } from '@neondatabase/serverless';

const URL = process.env.LEADS_DATABASE_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
const sql = URL ? neon(URL) : null;

let _ensured = false;
async function ensureTable() {
  if (_ensured || !sql) return;
  try {
    await sql`CREATE TABLE IF NOT EXISTS enformion_usage (day date PRIMARY KEY, count int NOT NULL DEFAULT 0)`;
    _ensured = true;
  } catch { /* leave unensured — tryConsume fails open */ }
}

/**
 * Atomically consume one Enformion call for today. Returns true if allowed (day's count was under the cap and
 * has been incremented), false if the cap is reached. Atomic via a single conditional upsert (no check-then-inc
 * race): the ON CONFLICT update only fires while count < cap, so a denied call is NOT counted.
 * @returns {Promise<boolean>}
 */
export async function tryConsumeEnformion(env = process.env) {
  const cap = parseInt(env.ENFORMION_DAILY_CAP || '', 10);
  if (!sql || !Number.isFinite(cap) || cap <= 0) return true; // no cap configured → allow (today's behavior)
  await ensureTable();
  try {
    const rows = await sql`
      INSERT INTO enformion_usage (day, count) VALUES (CURRENT_DATE, 1)
      ON CONFLICT (day) DO UPDATE SET count = enformion_usage.count + 1
      WHERE enformion_usage.count < ${cap}
      RETURNING count`;
    return rows.length > 0;
  } catch { return true; } // fail-open (cost backstop, not a hard security gate)
}

/** Today's consumed count (for observability / right-sizing the cap). Null on no-DB/error. */
export async function enformionUsageToday(env = process.env) {
  if (!sql) return null;
  await ensureTable();
  try {
    const rows = await sql`SELECT count FROM enformion_usage WHERE day = CURRENT_DATE`;
    return rows && rows[0] ? rows[0].count : 0;
  } catch { return null; }
}

/** Usage summary (today + trailing 30 days + cap) for the service-usage dashboard. Null on no-DB/error. */
export async function enformionUsageSummary(env = process.env) {
  if (!sql) return null;
  await ensureTable();
  const cap = parseInt(env.ENFORMION_DAILY_CAP || '', 10);
  try {
    const [today] = await sql`SELECT count FROM enformion_usage WHERE day = CURRENT_DATE`;
    const [month] = await sql`SELECT COALESCE(sum(count),0)::int total FROM enformion_usage WHERE day > CURRENT_DATE - INTERVAL '30 days'`;
    return {
      label: 'Enformion', cap: Number.isFinite(cap) && cap > 0 ? cap : null,
      today: { calls: today?.count || 0 }, last30: { calls: month?.total || 0 },
    };
  } catch { return null; }
}

// ── Per-channel lanes ────────────────────────────────────────────────────────
// A SEPARATE daily counter per named channel (its own table row), so one feature's usage can't starve
// another's. Used to isolate 'who lives here' (address→resident teaser) from the shared divorce/marriage cap —
// a burst of one can never blank the demo of the other. Own counter, own cap. Fail-OPEN (cost backstop, not a
// hard gate), same as the shared cap.
let _laneEnsured = false;
async function ensureLaneTable() {
  if (_laneEnsured || !sql) return;
  try {
    await sql`CREATE TABLE IF NOT EXISTS enformion_usage_lane (day date, channel text, count int NOT NULL DEFAULT 0, PRIMARY KEY (day, channel))`;
    _laneEnsured = true;
  } catch { /* leave unensured — tryConsume fails open */ }
}

/**
 * Atomically consume one call for a named lane today. `cap` ≤ 0 / non-finite → no cap (allow all).
 * @returns {Promise<boolean>} true if allowed (under cap and incremented), false if the lane's cap is reached.
 */
export async function tryConsumeEnformionLane(channel, cap) {
  if (!sql || !Number.isFinite(cap) || cap <= 0) return true;
  await ensureLaneTable();
  try {
    const rows = await sql`
      INSERT INTO enformion_usage_lane (day, channel, count) VALUES (CURRENT_DATE, ${channel}, 1)
      ON CONFLICT (day, channel) DO UPDATE SET count = enformion_usage_lane.count + 1
      WHERE enformion_usage_lane.count < ${cap}
      RETURNING count`;
    return rows.length > 0;
  } catch { return true; } // fail-open
}
