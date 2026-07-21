// PDL (People Data Labs) usage tracking + optional daily cap. Owner 2026-07-21: "track PDL calls; I don't
// mind spending but want to control it." So we ALWAYS record usage (calls + matches — PDL bills on MATCHED
// records) for full visibility, and expose an OPTIONAL daily cap (PDL_DAILY_CAP) as a control lever. Unset /
// ≤0 → no cap (track only). Fail-OPEN on DB error (tracking must never break the enrichment).
import { neon } from '@neondatabase/serverless';

const URL = process.env.LEADS_DATABASE_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
const sql = URL ? neon(URL) : null;

// Est. cost per MATCHED record (PDL Pro ~$0.20–0.28; free tier = first 100/mo). Tune via PDL_COST_PER_MATCH.
const COST_PER_MATCH = parseFloat(process.env.PDL_COST_PER_MATCH || '0.28');

let _ensured = false;
async function ensureTable() {
  if (_ensured || !sql) return;
  try {
    await sql`CREATE TABLE IF NOT EXISTS pdl_usage (day date PRIMARY KEY, calls int NOT NULL DEFAULT 0, matched int NOT NULL DEFAULT 0)`;
    _ensured = true;
  } catch { /* leave unensured — tryConsume fails open */ }
}

/**
 * Atomically consume one PDL call for today. Returns true if allowed. With no cap set, always increments +
 * allows (tracking only). With a cap, the conditional upsert only increments while calls < cap → a denied
 * call is NOT counted. Fail-open.
 */
export async function tryConsumePdl(env = process.env) {
  if (!sql) return true;
  await ensureTable();
  const cap = parseInt(env.PDL_DAILY_CAP || '', 10);
  try {
    if (!Number.isFinite(cap) || cap <= 0) {
      // No cap → track every call.
      await sql`INSERT INTO pdl_usage (day, calls) VALUES (CURRENT_DATE, 1)
                ON CONFLICT (day) DO UPDATE SET calls = pdl_usage.calls + 1`;
      return true;
    }
    const rows = await sql`
      INSERT INTO pdl_usage (day, calls) VALUES (CURRENT_DATE, 1)
      ON CONFLICT (day) DO UPDATE SET calls = pdl_usage.calls + 1
      WHERE pdl_usage.calls < ${cap}
      RETURNING calls`;
    return rows.length > 0;
  } catch { return true; }
}

/** Record that a call MATCHED (the billable event). Fire-and-forget. */
export async function recordPdlMatch() {
  if (!sql) return;
  await ensureTable();
  try {
    await sql`INSERT INTO pdl_usage (day, matched) VALUES (CURRENT_DATE, 1)
              ON CONFLICT (day) DO UPDATE SET matched = pdl_usage.matched + 1`;
  } catch { /* best-effort */ }
}

/** Usage summary for observability: today + trailing 30 days + est. cost. */
export async function pdlUsageSummary() {
  if (!sql) return null;
  await ensureTable();
  try {
    const [today] = await sql`SELECT calls, matched FROM pdl_usage WHERE day = CURRENT_DATE`;
    const [month] = await sql`SELECT COALESCE(sum(calls),0)::int calls, COALESCE(sum(matched),0)::int matched FROM pdl_usage WHERE day > CURRENT_DATE - INTERVAL '30 days'`;
    const days = await sql`SELECT day, calls, matched FROM pdl_usage ORDER BY day DESC LIMIT 14`;
    const estCost = (n) => `$${(Math.max(0, n) * COST_PER_MATCH).toFixed(2)}`;
    return {
      today: { calls: today?.calls || 0, matched: today?.matched || 0, estCost: estCost(today?.matched || 0) },
      last30: { calls: month?.calls || 0, matched: month?.matched || 0, estCost: estCost(month?.matched || 0) },
      costPerMatch: COST_PER_MATCH,
      recent: days.map((d) => ({ day: String(d.day).slice(0, 10), calls: d.calls, matched: d.matched })),
    };
  } catch { return null; }
}
