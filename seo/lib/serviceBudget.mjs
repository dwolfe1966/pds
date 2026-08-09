// Daily spend guards for the metered services that DIDN'T already have one — browser.io (Browserless),
// 2Captcha (solver), and Twilio Lookup. Same proven shape as enformionBudget / pdlBudget: an atomic
// conditional upsert per (day, service) so a denied call is never counted, and FAIL-OPEN on no-DB/error
// (a cap is a cost backstop, and cache absorbs most calls, so a DB blip must not block the feature).
//
// Unlike Enformion/PDL (uncapped until an env is set), these ship a SAFE DEFAULT cap (owner 2026-08-09) so
// we're protected the moment the service keys are switched on — before any real traffic can overrun. Every
// cap + cost estimate is env-overridable.
import { neon } from '@neondatabase/serverless';

const URL = process.env.LEADS_DATABASE_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
const sql = URL ? neon(URL) : null;

// service → { cap env, safe default, cost env, est $ per call } (est cost is for the usage view only).
export const SERVICES = {
  browser: { capEnv: 'BROWSER_DAILY_CAP', defaultCap: 200, costEnv: 'BROWSER_COST_PER_CALL', cost: 0.01, label: 'Browser.io (Browserless)' },
  captcha: { capEnv: 'CAPTCHA_DAILY_CAP', defaultCap: 200, costEnv: 'CAPTCHA_COST_PER_SOLVE', cost: 0.003, label: '2Captcha solver' },
  twilio: { capEnv: 'TWILIO_DAILY_CAP', defaultCap: 200, costEnv: 'TWILIO_COST_PER_LOOKUP', cost: 0.008, label: 'Twilio Lookup' },
};

const capFor = (service, env = process.env) => {
  const cfg = SERVICES[service]; if (!cfg) return 0;
  const v = parseInt(env[cfg.capEnv] || '', 10);
  return Number.isFinite(v) && v >= 0 ? v : cfg.defaultCap; // env 0 = explicitly uncap; unset = safe default
};
const costFor = (service, env = process.env) => {
  const cfg = SERVICES[service]; if (!cfg) return 0;
  const v = parseFloat(env[cfg.costEnv] || '');
  return Number.isFinite(v) && v >= 0 ? v : cfg.cost;
};

let _ensured = false;
async function ensure() {
  if (_ensured || !sql) return;
  try {
    await sql`CREATE TABLE IF NOT EXISTS service_usage (day date, service text, count int NOT NULL DEFAULT 0, PRIMARY KEY (day, service))`;
    _ensured = true;
  } catch { /* leave unensured — tryConsume fails open */ }
}

/**
 * Atomically consume one call of a metered service for today. Returns true if allowed (under cap, incremented),
 * false if the cap is reached. cap 0 (env override) → uncapped: track + allow. Fail-open on no-DB/error.
 */
export async function tryConsumeService(service, env = process.env) {
  if (!SERVICES[service] || !sql) return true;
  await ensure();
  const cap = capFor(service, env);
  try {
    if (cap <= 0) {
      await sql`INSERT INTO service_usage (day, service, count) VALUES (CURRENT_DATE, ${service}, 1)
                ON CONFLICT (day, service) DO UPDATE SET count = service_usage.count + 1`;
      return true;
    }
    const rows = await sql`
      INSERT INTO service_usage (day, service, count) VALUES (CURRENT_DATE, ${service}, 1)
      ON CONFLICT (day, service) DO UPDATE SET count = service_usage.count + 1
      WHERE service_usage.count < ${cap}
      RETURNING count`;
    return rows.length > 0;
  } catch { return true; } // fail-open (cost backstop, not a hard gate)
}

/** Today's count for one service (observability). Null on no-DB/error. */
export async function serviceUsageToday(service) {
  if (!sql) return null;
  await ensure();
  try {
    const rows = await sql`SELECT count FROM service_usage WHERE day = CURRENT_DATE AND service = ${service}`;
    return rows && rows[0] ? rows[0].count : 0;
  } catch { return null; }
}

/** Usage summary across the service_usage-tracked services (today + last 30d + est cost + cap). */
export async function serviceUsageSummary(env = process.env) {
  if (!sql) return null;
  await ensure();
  const out = {};
  try {
    const today = await sql`SELECT service, count FROM service_usage WHERE day = CURRENT_DATE`;
    const month = await sql`SELECT service, COALESCE(sum(count),0)::int total FROM service_usage WHERE day > CURRENT_DATE - INTERVAL '30 days' GROUP BY service`;
    const tMap = Object.fromEntries(today.map((r) => [r.service, r.count]));
    const mMap = Object.fromEntries(month.map((r) => [r.service, r.total]));
    for (const [service, cfg] of Object.entries(SERVICES)) {
      const t = tMap[service] || 0; const m = mMap[service] || 0; const cost = costFor(service, env);
      out[service] = {
        label: cfg.label, cap: capFor(service, env),
        today: { calls: t, estCost: `$${(t * cost).toFixed(2)}` },
        last30: { calls: m, estCost: `$${(m * cost).toFixed(2)}` },
        costPerCall: cost,
      };
    }
    return out;
  } catch { return out; }
}
