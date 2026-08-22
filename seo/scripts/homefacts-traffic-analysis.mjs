// Deep HomeFacts traffic analysis from web_events — for the CEO / partnership conversation.
// Prints the breakdown and writes CSVs (raw per-session + country + hourly) to docs/homefacts/traffic/.
//   cd seo && node --env-file=.env.local scripts/homefacts-traffic-analysis.mjs
import { neon } from '@neondatabase/serverless';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const sql = neon(process.env.DATABASE_URL || process.env.POSTGRES_URL);
const OUTDIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'docs', 'homefacts', 'traffic');
mkdirSync(OUTDIR, { recursive: true });
const isUS = (c) => c === 'US';
const csv = (header, rows) => [header, ...rows].map((r) => r.map((c) => {
  const s = c == null ? '' : String(c);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}).join(',')).join('\n') + '\n';

// ── period ──
const per = await sql`SELECT min(ts) a, max(ts) b, count(*)::int ev FROM web_events`;
const hrs = (new Date(per[0].b) - new Date(per[0].a)) / 36e5;
console.log(`Period: ${per[0].a}  →  ${per[0].b}  (~${hrs.toFixed(1)}h)  ·  ${per[0].ev} events`);

// ── one row per HomeFacts session ──
const sessions = await sql`
  SELECT session_id,
    COALESCE(min(country),'?') country, min(variant) arm, min(ts) landed,
    count(*)::int n_events, bool_or(event <> 'landing_view') engaged,
    max(user_agent) ua,
    max(CASE event WHEN 'landing_view' THEN 1 WHEN 'search_step' THEN 2 WHEN 'search_submit' THEN 3
      WHEN 'results_view' THEN 4 WHEN 'teaser_view' THEN 5 WHEN 'serp_result_onboarding' THEN 6
      WHEN 'payment_start' THEN 7 WHEN 'payment_submit' THEN 8
      WHEN 'payment_complete' THEN 9 WHEN 'purchase' THEN 9 ELSE 1 END) depth
  FROM web_events WHERE variant LIKE 'homefacts-%' GROUP BY session_id`;

const DEPTH = ['-', 'landing', 'search', 'search_submit', 'results', 'teaser', 'unlock_tap', 'payment_start', 'payment_submit', 'CONFIRMED'];
const total = sessions.length;
const us = sessions.filter((s) => isUS(s.country));
const bot = sessions.filter((s) => !isUS(s.country));
const engaged = (arr) => arr.filter((s) => s.engaged).length;
const pct = (n, d) => d ? `${(100 * n / d).toFixed(1)}%` : '-';

console.log(`\n=== COHORTS (sessions) ===`);
console.log(`  TOTAL          ${total}`);
console.log(`  CLEAN (US)     ${us.length}  (${pct(us.length, total)})   engaged past landing: ${engaged(us)} (${pct(engaged(us), us.length)})`);
console.log(`  DIRTY (non-US) ${bot.length}  (${pct(bot.length, total)})   engaged past landing: ${engaged(bot)} (${pct(engaged(bot), bot.length)})`);

console.log(`\n=== NON-US engagement (bot signature) ===`);
const botLandingOnly = bot.filter((s) => s.depth <= 1).length;
console.log(`  landing-only (never fired a 2nd event): ${botLandingOnly} of ${bot.length}  (${pct(botLandingOnly, bot.length)})`);
console.log(`  events/session — non-US: avg ${(bot.reduce((a, s) => a + s.n_events, 0) / (bot.length || 1)).toFixed(2)}   US: avg ${(us.reduce((a, s) => a + s.n_events, 0) / (us.length || 1)).toFixed(2)}`);

// ── country table ──
const byC = {};
for (const s of sessions) { (byC[s.country] ??= { n: 0, eng: 0 }); byC[s.country].n++; if (s.engaged) byC[s.country].eng++; }
const countryRows = Object.entries(byC).sort((a, b) => b[1].n - a[1].n);
console.log(`\n=== BY COUNTRY ===`);
countryRows.forEach(([c, v]) => console.log(`  ${(c || '?').padEnd(4)} sessions=${String(v.n).padStart(5)}  (${pct(v.n, total).padStart(6)})  engaged=${v.eng}`));

// ── depth histogram per cohort ──
const hist = (arr) => { const h = {}; for (const s of arr) h[s.depth] = (h[s.depth] || 0) + 1; return h; };
const hb = hist(bot), hu = hist(us);
console.log(`\n=== DEEPEST STEP REACHED (non-US vs US) ===`);
for (let d = 1; d <= 9; d++) if ((hb[d] || 0) + (hu[d] || 0) > 0) console.log(`  ${DEPTH[d].padEnd(14)} non-US=${String(hb[d] || 0).padStart(5)}   US=${hu[d] || 0}`);

// ── user agents (top) ──
const byUA = {};
for (const s of bot) { const k = (s.ua || '(none)').slice(0, 70); byUA[k] = (byUA[k] || 0) + 1; }
console.log(`\n=== NON-US user agents (top 10) ===`);
Object.entries(byUA).sort((a, b) => b[1] - a[1]).slice(0, 10).forEach(([ua, n]) => console.log(`  ${String(n).padStart(5)}  ${ua}`));

// ── per-arm split ──
const byArm = {};
for (const s of sessions) { (byArm[s.arm] ??= { n: 0, us: 0 }); byArm[s.arm].n++; if (isUS(s.country)) byArm[s.arm].us++; }
console.log(`\n=== BY ARM (all vs US) ===`);
Object.entries(byArm).sort().forEach(([a, v]) => console.log(`  ${a.padEnd(14)} total=${String(v.n).padStart(5)}  US=${v.us}`));

// ── hourly (SQL) ──
const hourly = await sql`
  SELECT to_char(date_trunc('hour', ts),'MM-DD HH24:00') hr,
    count(DISTINCT session_id) FILTER (WHERE country='US') us,
    count(DISTINCT session_id) FILTER (WHERE country IS NULL OR country<>'US') nonus
  FROM web_events WHERE variant LIKE 'homefacts-%' AND event='landing_view'
  GROUP BY 1 ORDER BY 1`;
console.log(`\n=== HOURLY landings (US | non-US) ===`);
hourly.forEach((r) => console.log(`  ${r.hr}   US=${String(r.us).padStart(3)}  non-US=${r.nonus}`));

// ── write CSVs ──
writeFileSync(path.join(OUTDIR, 'homefacts-sessions.csv'),
  csv(['session_id', 'landed_at', 'country', 'cohort', 'arm', 'events', 'engaged', 'deepest_step', 'user_agent'],
    sessions.sort((a, b) => new Date(a.landed) - new Date(b.landed)).map((s) => [
      s.session_id, new Date(s.landed).toISOString(), s.country, isUS(s.country) ? 'clean_us' : 'dirty_nonus',
      s.arm, s.n_events, s.engaged ? 1 : 0, DEPTH[s.depth], s.ua])));
writeFileSync(path.join(OUTDIR, 'homefacts-country-summary.csv'),
  csv(['country', 'sessions', 'pct_of_total', 'engaged_sessions', 'engaged_pct'],
    countryRows.map(([c, v]) => [c, v.n, pct(v.n, total), v.eng, pct(v.eng, v.n)])));
writeFileSync(path.join(OUTDIR, 'homefacts-hourly.csv'),
  csv(['hour', 'us_landings', 'nonus_landings'], hourly.map((r) => [r.hr, r.us, r.nonus])));

console.log(`\n✅ CSVs written to ${OUTDIR}/`);
console.log('   homefacts-sessions.csv · homefacts-country-summary.csv · homefacts-hourly.csv');
