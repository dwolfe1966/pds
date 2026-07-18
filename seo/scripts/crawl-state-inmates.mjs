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

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const state = String(args.state || '').toUpperCase();
const delay = parseInt(args.delay, 10) || 1200;
const photos = !!args.photos;
const surnames = args.surnames ? String(args.surnames).split(',').map((s) => s.trim()).filter(Boolean) : TOP_SURNAMES;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  if (!hasInmatesDb) { console.error('No DB configured (LEADS_DATABASE_URL / DATABASE_URL).'); process.exit(1); }
  const adapter = STATE_ADAPTERS[state];
  if (!adapter) { console.error(`No adapter for state "${state}". Have: ${Object.keys(STATE_ADAPTERS).join(', ')}`); process.exit(1); }
  console.log(`Crawling ${state} — ${surnames.length} surnames, photos=${photos}, delay=${delay}ms`);
  let totalFound = 0, totalWritten = 0, errors = 0;
  for (let i = 0; i < surnames.length; i++) {
    const ln = surnames[i];
    try {
      const recs = await adapter({ lastName: ln, state }, { includePhotos: photos });
      const wrote = recs.length ? await upsertInmates(recs) : 0;
      totalFound += recs.length; totalWritten += wrote;
      process.stdout.write(`\r  [${i + 1}/${surnames.length}] ${ln}: +${recs.length} found · ${totalWritten} written total   `);
    } catch (e) { errors++; console.warn(`\n  ${ln} failed: ${e.message}`); }
    if (i < surnames.length - 1) await sleep(delay);
  }
  console.log(`\n✓ ${state} done — ${totalFound} records found, ${totalWritten} upserted, ${errors} surname errors.`);
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
