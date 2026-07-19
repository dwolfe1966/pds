// Crawl a state DOC roster into the first-party `inmates` table (the moat asset).
//
// Sweeps by surname (broadest names first) through the live adapters (lib/stateInmates.mjs) and
// write-through-upserts each result via lib/inmatesDb.mjs. Polite: one request at a time + a delay.
//
// Usage (run where Node fetch reaches the gov sites — Vercel cron or a non-blocked host; NOT a
// datacenter IP for TX-class states):
//   node --env-file=.env.local scripts/crawl-state-inmates.mjs --state=CA
//   node --env-file=.env.local scripts/crawl-state-inmates.mjs --state=PA --photos --delay=1500
//   node --env-file=.env.local scripts/crawl-state-inmates.mjs --state=IL --surnames=smith,garcia,nguyen
//
// This is a NAME-SWEEP seed (top surnames). Full A–Z / DOC-number-range enumeration is a follow-up.
import { STATE_ADAPTERS } from '../lib/stateInmates.mjs';
import { upsertInmates, hasInmatesDb } from '../lib/inmatesDb.mjs';

// Top US surnames — a name-sweep seed that covers a large share of the roster fast.
const TOP_SURNAMES = ['smith', 'johnson', 'williams', 'brown', 'jones', 'garcia', 'miller', 'davis',
  'rodriguez', 'martinez', 'hernandez', 'lopez', 'gonzalez', 'wilson', 'anderson', 'thomas', 'taylor',
  'moore', 'jackson', 'martin', 'lee', 'perez', 'thompson', 'white', 'harris', 'sanchez', 'clark',
  'ramirez', 'lewis', 'robinson', 'walker', 'young', 'allen', 'king', 'wright', 'scott', 'torres',
  'nguyen', 'hill', 'flores', 'green', 'adams', 'nelson', 'baker', 'hall', 'rivera', 'campbell',
  'mitchell', 'carter', 'roberts'];

// Top US first names — needed for locators that REQUIRE a first name (TX/TDCJ, MD, OR, …): a
// surname-only query trips their "too many results" guard and returns nothing. When --firstnames is
// given (or a state is in NEEDS_FIRST), we sweep the first×last cross-product instead of surname-only.
const TOP_FIRSTNAMES = ['james', 'john', 'robert', 'michael', 'david', 'william', 'jose', 'juan',
  'richard', 'thomas', 'christopher', 'daniel', 'anthony', 'mark', 'maria', 'carlos', 'kevin', 'brian',
  'jason', 'jesus'];
const NEEDS_FIRST = new Set(['TX', 'MD', 'OR']); // locators that reject surname-only

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const state = String(args.state || '').toUpperCase();
const delay = parseInt(args.delay, 10) || 1200;
const photos = !!args.photos;
const surnames = args.surnames ? String(args.surnames).split(',').map((s) => s.trim()).filter(Boolean) : TOP_SURNAMES;
const firstNames = args.firstnames ? String(args.firstnames).split(',').map((s) => s.trim()).filter(Boolean)
  : (NEEDS_FIRST.has(state) ? TOP_FIRSTNAMES : null);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  if (!hasInmatesDb) { console.error('No DB configured (LEADS_DATABASE_URL / DATABASE_URL).'); process.exit(1); }
  const adapter = STATE_ADAPTERS[state];
  if (!adapter) { console.error(`No adapter for state "${state}". Have: ${Object.keys(STATE_ADAPTERS).join(', ')}`); process.exit(1); }
  // Build the query list: surname-only, or first×last cross-product for NEEDS_FIRST locators.
  const queries = firstNames
    ? firstNames.flatMap((fn) => surnames.map((ln) => ({ firstName: fn, lastName: ln, label: `${fn} ${ln}` })))
    : surnames.map((ln) => ({ lastName: ln, label: ln }));
  console.log(`Crawling ${state} — ${queries.length} queries${firstNames ? ` (${firstNames.length} first × ${surnames.length} last)` : ` surnames`}, photos=${photos}, delay=${delay}ms`);
  let totalFound = 0, totalWritten = 0, errors = 0;
  for (let i = 0; i < queries.length; i++) {
    const q = queries[i];
    try {
      const recs = await adapter({ firstName: q.firstName, lastName: q.lastName, state }, { includePhotos: photos });
      const wrote = recs.length ? await upsertInmates(recs) : 0;
      totalFound += recs.length; totalWritten += wrote;
      process.stdout.write(`\r  [${i + 1}/${queries.length}] ${q.label}: +${recs.length} · ${totalWritten} written total        `);
    } catch (e) { errors++; console.warn(`\n  ${q.label} failed: ${e.message}`); }
    if (i < queries.length - 1) await sleep(delay);
  }
  console.log(`\n✓ ${state} done — ${totalFound} records found, ${totalWritten} upserted, ${errors} query errors.`);
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
