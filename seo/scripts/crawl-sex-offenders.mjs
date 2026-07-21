// Crawl the NSOPW national registry into the first-party `sex_offenders` table (the moat asset).
//
// Sweeps by surname (broadest first), scoped to one state jurisdiction, through lib/sexOffender.mjs and
// write-through-upserts via lib/sexOffenderDb.mjs. NSOPW is Cloudflare-gated, so this REQUIRES a working
// BROWSER_SERVICE_URL (a paid browser tier + residential proxy); it will 401/exhaust on a free plan.
//
// Usage:
//   node --env-file=.env.local scripts/crawl-sex-offenders.mjs                 # nationwide seed (all states)
//   node --env-file=.env.local scripts/crawl-sex-offenders.mjs --state=FL      # scope to one jurisdiction
//   node --env-file=.env.local scripts/crawl-sex-offenders.mjs --firsts=john,james --lasts=smith,garcia
//
// NSOPW name search REQUIRES a first name (surname-only → statusCode 103, no results), so this sweeps the
// first×last CROSS-PRODUCT. An UNSCOPED call searches all 56 jurisdictions at once, so the nationwide seed
// (no --state) populates every state's rows per call — most efficient. Each call is ~9s via the browser
// service, so this is a long background job; it's a top-name SEED, not exhaustive.
import { sexOffender } from '../lib/sexOffender.mjs';
import { upsertSexOffenders, hasSoDb } from '../lib/sexOffenderDb.mjs';

const TOP_SURNAMES = ['smith', 'johnson', 'williams', 'brown', 'jones', 'garcia', 'miller', 'davis',
  'rodriguez', 'martinez', 'hernandez', 'lopez', 'gonzalez', 'wilson', 'anderson', 'thomas', 'taylor',
  'moore', 'jackson', 'martin', 'lee', 'perez', 'thompson', 'white', 'harris', 'sanchez', 'clark',
  'ramirez', 'lewis', 'robinson', 'walker', 'young', 'allen', 'king', 'wright', 'scott', 'torres',
  'nguyen', 'hill', 'flores', 'green', 'adams', 'nelson', 'baker', 'hall', 'rivera', 'campbell',
  'mitchell', 'carter', 'roberts'];
const TOP_FIRSTNAMES = ['james', 'john', 'robert', 'michael', 'david', 'william', 'jose', 'juan',
  'richard', 'thomas', 'christopher', 'daniel', 'anthony', 'mark', 'carlos', 'kevin', 'brian', 'jason',
  'jesus', 'steven'];

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const state = String(args.state || '').toUpperCase();
const delay = parseInt(args.delay, 10) || 1500;
const surnames = args.lasts ? String(args.lasts).split(',').map((s) => s.trim()).filter(Boolean) : TOP_SURNAMES;
const firstNames = args.firsts ? String(args.firsts).split(',').map((s) => s.trim()).filter(Boolean) : TOP_FIRSTNAMES;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  if (!hasSoDb) { console.error('No DB configured (LEADS_DATABASE_URL / DATABASE_URL).'); process.exit(1); }
  const queries = firstNames.flatMap((fn) => surnames.map((ln) => ({ firstName: fn, lastName: ln })));
  console.log(`Crawling NSOPW ${state || 'NATIONWIDE'} — ${firstNames.length}×${surnames.length}=${queries.length} name combos, delay=${delay}ms`);
  let totalFound = 0, totalWritten = 0, errors = 0, consecutiveErrors = 0;
  for (let i = 0; i < queries.length; i++) {
    const q = queries[i];
    try {
      const out = await sexOffender(state ? { ...q, state } : q);
      const recs = out.records || [];
      const wrote = recs.length ? await upsertSexOffenders(recs) : 0;
      totalFound += recs.length; totalWritten += wrote; consecutiveErrors = 0;
      process.stdout.write(`\r  [${i + 1}/${queries.length}] ${q.firstName} ${q.lastName}: +${wrote} · ${totalWritten} written${out.partial ? ' (partial)' : ''}          `);
    } catch (e) {
      errors++; consecutiveErrors++;
      process.stdout.write(`\r  [${i + 1}/${queries.length}] ${q.firstName} ${q.lastName}: ERROR ${String(e.message).slice(0, 70)}          \n`);
      // Bail if the browser service is exhausted/misconfigured — don't hammer it hundreds of times.
      if (/usage limit|401|BROWSER_SERVICE_URL/i.test(e.message) || consecutiveErrors >= 5) {
        console.error(`\nAborting: ${consecutiveErrors} consecutive failures (browser service down/exhausted?).`);
        break;
      }
    }
    await sleep(delay);
  }
  console.log(`\n✓ ${state || 'NATIONWIDE'} done — ${totalFound} records found, ${totalWritten} upserted, ${errors} query errors.`);
  process.exit(0);
})();
