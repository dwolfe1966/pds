// Crawl the NSOPW national registry into the first-party `sex_offenders` table (the moat asset).
//
// Sweeps by surname (broadest first), scoped to one state jurisdiction, through lib/sexOffender.mjs and
// write-through-upserts via lib/sexOffenderDb.mjs. NSOPW is Cloudflare-gated, so this REQUIRES a working
// BROWSER_SERVICE_URL (a paid browser tier + residential proxy); it will 401/exhaust on a free plan.
//
// Usage:
//   node --env-file=.env.local scripts/crawl-sex-offenders.mjs --state=FL
//   node --env-file=.env.local scripts/crawl-sex-offenders.mjs --state=TX --surnames=smith,garcia --delay=2500
//
// NAME-SWEEP seed (top surnames). NSOPW name search needs first+last ≥3 chars total, so surname-only is
// fine. Politeness matters more here (browser service + gov Cloudflare): default delay is higher.
import { sexOffender } from '../lib/sexOffender.mjs';
import { upsertSexOffenders, hasSoDb } from '../lib/sexOffenderDb.mjs';

const TOP_SURNAMES = ['smith', 'johnson', 'williams', 'brown', 'jones', 'garcia', 'miller', 'davis',
  'rodriguez', 'martinez', 'hernandez', 'lopez', 'gonzalez', 'wilson', 'anderson', 'thomas', 'taylor',
  'moore', 'jackson', 'martin', 'lee', 'perez', 'thompson', 'white', 'harris', 'sanchez', 'clark',
  'ramirez', 'lewis', 'robinson', 'walker', 'young', 'allen', 'king', 'wright', 'scott', 'torres',
  'nguyen', 'hill', 'flores', 'green', 'adams', 'nelson', 'baker', 'hall', 'rivera', 'campbell',
  'mitchell', 'carter', 'roberts'];

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const state = String(args.state || '').toUpperCase();
const delay = parseInt(args.delay, 10) || 2500;
const surnames = args.surnames ? String(args.surnames).split(',').map((s) => s.trim()).filter(Boolean) : TOP_SURNAMES;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  if (!hasSoDb) { console.error('No DB configured (LEADS_DATABASE_URL / DATABASE_URL).'); process.exit(1); }
  if (!state) { console.error('Pass --state=XX'); process.exit(1); }
  console.log(`Crawling NSOPW ${state} — ${surnames.length} surnames, delay=${delay}ms`);
  let totalFound = 0, totalWritten = 0, errors = 0, consecutiveErrors = 0;
  for (let i = 0; i < surnames.length; i++) {
    const ln = surnames[i];
    try {
      const out = await sexOffender({ lastName: ln, state });
      const recs = out.records || [];
      const wrote = recs.length ? await upsertSexOffenders(recs) : 0;
      totalFound += recs.length; totalWritten += wrote; consecutiveErrors = 0;
      process.stdout.write(`\r  [${i + 1}/${surnames.length}] ${ln}: +${wrote} · ${totalWritten} written total${out.partial ? ' (partial)' : ''}          `);
    } catch (e) {
      errors++; consecutiveErrors++;
      process.stdout.write(`\r  [${i + 1}/${surnames.length}] ${ln}: ERROR ${String(e.message).slice(0, 80)}          \n`);
      // Bail early if the browser service is exhausted/misconfigured — don't hammer it 50×.
      if (/usage limit|401|BROWSER_SERVICE_URL/i.test(e.message) || consecutiveErrors >= 4) {
        console.error(`\nAborting ${state}: ${consecutiveErrors} consecutive failures (browser service down/exhausted?).`);
        break;
      }
    }
    await sleep(delay);
  }
  console.log(`\n✓ ${state} done — ${totalFound} records found, ${totalWritten} upserted, ${errors} query errors.`);
  process.exit(0);
})();
