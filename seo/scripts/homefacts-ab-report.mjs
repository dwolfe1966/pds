// HomeFacts A/B funnel report from web_events. Separates CLEAN (US) from DIRTY (non-US — HomeFacts runs
// heavily bot/proxy, mostly Singapore datacenter) so the arm comparison isn't muddied by bots.
//   cd seo && node --env-file=.env.local scripts/homefacts-ab-report.mjs
import { neon } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!url) { console.error('Set DATABASE_URL'); process.exit(1); }
const sql = neon(url);
const pad = (v, n) => String(v).padEnd(n);
const rpad = (v, n) => String(v).padStart(n);

const tot = await sql`SELECT count(*)::int n, min(ts) first, max(ts) last FROM web_events`;
console.log(`web_events: ${tot[0].n} rows` + (tot[0].n ? `  |  ${tot[0].first}  →  ${tot[0].last}` : ' (empty)'));
if (!tot[0].n) process.exit(0);

// ── cohorts (distinct landing sessions on the HomeFacts arms) ──
const co = await sql`
  SELECT
    count(DISTINCT session_id)                                              AS total,
    count(DISTINCT session_id) FILTER (WHERE country = 'US')                AS clean_us,
    count(DISTINCT session_id) FILTER (WHERE country IS NULL OR country <> 'US') AS dirty
  FROM web_events WHERE variant LIKE 'homefacts-%' AND event = 'landing_view'`;
const c = co[0];
const pct = (x) => c.total > 0 ? `${(100 * x / c.total).toFixed(0)}%` : '-';
console.log(`\n=== HomeFacts landing cohorts ===`);
console.log(`  TOTAL landings : ${c.total}`);
console.log(`  CLEAN (US)     : ${c.clean_us}  (${pct(c.clean_us)})`);
console.log(`  DIRTY (non-US) : ${c.dirty}  (${pct(c.dirty)})   ← bot/proxy noise`);

// ── country split ──
const cc = await sql`
  SELECT COALESCE(country,'?') country, count(DISTINCT session_id)::int sessions
  FROM web_events WHERE variant LIKE 'homefacts-%' AND event='landing_view'
  GROUP BY country ORDER BY sessions DESC LIMIT 10`;
console.log(`\n=== by country (landing sessions) ===`);
cc.forEach((r) => console.log(`  ${pad(r.country, 4)} ${r.sessions}`));

// ── CLEAN (US-only) funnel by arm ──
const rows = await sql`
  WITH clean AS (
    SELECT DISTINCT session_id FROM web_events
    WHERE variant LIKE 'homefacts-%' AND event='landing_view' AND country='US')
  SELECT variant,
    count(DISTINCT session_id) FILTER (WHERE event='landing_view')                       AS landing,
    count(DISTINCT session_id) FILTER (WHERE event IN ('results_view','teaser_view'))     AS profile,
    count(DISTINCT session_id) FILTER (WHERE event='serp_result_onboarding')              AS unlock,
    count(DISTINCT session_id) FILTER (WHERE event='payment_start')                       AS pay_start,
    count(DISTINCT session_id) FILTER (WHERE event IN ('payment_complete','purchase'))    AS confirmed
  FROM web_events
  WHERE variant LIKE 'homefacts-%' AND session_id IN (SELECT session_id FROM clean)
  GROUP BY variant ORDER BY variant`;
console.log(`\n=== CLEAN (US) funnel by arm ===`);
console.log(`  arm            land  profile  unlock  pay  CONF   land→prof  land→conf`);
rows.forEach((r) => {
  const p = r.landing > 0 ? `${(100 * r.profile / r.landing).toFixed(0)}%` : '-';
  const cf = r.landing > 0 ? `${(100 * r.confirmed / r.landing).toFixed(1)}%` : '-';
  console.log(`  ${pad(r.variant, 14)} ${rpad(r.landing, 4)}  ${rpad(r.profile, 7)}  ${rpad(r.unlock, 6)}  ${rpad(r.pay_start, 3)}  ${rpad(r.confirmed, 4)}  ${rpad(p, 9)}  ${rpad(cf, 9)}`);
});
if (!rows.length) console.log('  (no US traffic on the arms yet)');

// ── confirmations everywhere ──
const conf = await sql`SELECT variant, country, count(*)::int n FROM web_events WHERE event IN ('payment_complete','purchase') GROUP BY variant, country ORDER BY n DESC`;
console.log(`\n=== payment confirmations (all funnels) ===`);
if (!conf.length) console.log('  (none yet)');
else conf.forEach((r) => console.log(`  ${pad(r.variant || '-', 16)} ${pad(r.country || '?', 4)} ${r.n}`));
