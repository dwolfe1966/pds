// PDL usage report — calls + billable matches + estimated cost. Run:
//   node --env-file=.env.local scripts/pdl-usage.mjs
import { pdlUsageSummary } from '../lib/pdlBudget.mjs';

const s = await pdlUsageSummary();
if (!s) { console.log('No usage data (no DB or empty).'); process.exit(0); }
console.log(`PDL usage  (est $${s.costPerMatch}/match)`);
console.log(`  today  : ${s.today.calls} calls · ${s.today.matched} matched · ${s.today.estCost}`);
console.log(`  last30 : ${s.last30.calls} calls · ${s.last30.matched} matched · ${s.last30.estCost}`);
console.log('  recent :');
for (const d of s.recent) console.log(`    ${d.day}  ${d.calls} calls · ${d.matched} matched`);
