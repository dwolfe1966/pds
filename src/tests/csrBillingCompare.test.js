/* Per-user comparison: OUR classifier (getCustomerStatus/classifyBilling) vs BC.admin terminal,
 * on the SAME live order data (scripts/out/csr-orders-72.json pulled by scripts/csr-billing-fetch.js).
 * Writes docs/bugs/csr-billing-peruser-2026-07-23.md. Skips cleanly if the pull hasn't run.
 */
import fs from 'fs';
import path from 'path';
import { getCustomerStatus } from '../pages/admin/billingClassification';

const ROOT = path.resolve(__dirname, '../..');
const DATA = path.join(ROOT, 'scripts/out/csr-orders-72.json');
const CSV = path.join(ROOT, 'docs/bugs/csr-admin-user-billing-state-7-23.csv');
const OUT = path.join(ROOT, 'docs/bugs/csr-billing-peruser-2026-07-23.md');

// BC.admin terminal → does the customer HAVE ACCESS?
const BC_HAS_ACCESS = {
  'active': true,
  'canceled (pending period end)': true,
  'canceled→expired (voluntary)': false,
  'expired (involuntary)': false,
  'suspended': false,
};

const bcTerminal = (traj) => (String(traj || '').match(/\[([^\]]+)\]/) || [])[1] || '?';

function csvTerminals() {
  const m = {};
  for (const line of fs.readFileSync(CSV, 'utf8').split(/\r?\n/)) {
    if (!/^\d{4}-\d{2}-\d{2},/.test(line)) continue;
    const c = line.split(',');
    m[c[5]] = { name: c[3], updated: c[8], orig: c[7] };
  }
  return m;
}

test('CSR classifier vs BC.admin terminal — per user', () => {
  if (!fs.existsSync(DATA)) { console.warn(`SKIP: ${DATA} not found — run scripts/csr-billing-fetch.js first.`); return; }
  const users = JSON.parse(fs.readFileSync(DATA, 'utf8'));
  const term = csvTerminals();

  const rows = [];
  for (const u of users) {
    const orders = Array.isArray(u.orders) ? u.orders : [];
    const meta = term[u.userId] || {};
    const bcT = bcTerminal(meta.updated || u.adminTrajectoryUpdated);
    const bcAccess = BC_HAS_ACCESS[bcT];
    const cs = orders.length ? getCustomerStatus(u.user || {}, orders) : null;
    const ourAccess = cs ? (cs.access !== 'no') : null;   // yes/grace = has access
    const accessMatch = (bcAccess === undefined || ourAccess === null) ? '?' : (bcAccess === ourAccess ? 'Y' : '**N**');
    rows.push({
      name: (meta.name || u.name || '').slice(0, 22),
      payer: u.userId,
      bcT,
       our: cs ? cs.classification : '(no orders)',
      ourAccess: ourAccess === null ? '?' : (ourAccess ? 'yes' : 'no'),
      stateName: cs ? cs.stateName : '',
      flag: cs && cs.problematicTransaction ? `⚠ ${cs.problematicTransaction.message}` : '',
      accessMatch,
    });
  }

  const mism = rows.filter((r) => r.accessMatch === '**N**');
  const flagged = rows.filter((r) => r.flag);

  const md = [];
  md.push('# CSR ↔ BC.admin — per-user comparison (live data, 2026-07-23)');
  md.push('');
  md.push(`Generated from \`scripts/out/csr-orders-72.json\` (live pull) vs BC.admin terminal. **${rows.length} users.**`);
  md.push(`**Access-bucket matches: ${rows.length - mism.length}/${rows.length}. Mismatches: ${mism.length}.**`);
  md.push(`Problematic-transaction flags raised: ${flagged.length}.`);
  md.push('');
  if (mism.length) {
    md.push('## ⚠ Access mismatches (our access ≠ BC.admin has-access)');
    md.push('| Name | payerId | BC.admin | our classification | our access | why |');
    md.push('|---|---|---|---|---|---|');
    for (const r of mism) md.push(`| ${r.name} | ${r.payer} | ${r.bcT} | ${r.our} | ${r.ourAccess} | (investigate) |`);
    md.push('');
  }
  md.push('## All 72 users');
  md.push('| Name | BC.admin | our classification | access✔ | our access | state | flag |');
  md.push('|---|---|---|---|---|---|---|');
  for (const r of rows) md.push(`| ${r.name} | ${r.bcT} | ${r.our} | ${r.accessMatch} | ${r.ourAccess} | ${r.stateName} | ${r.flag} |`);
  md.push('');
  fs.writeFileSync(OUT, md.join('\n'));

  // Console summary for immediate visibility
  console.log(`\n=== ${rows.length} users · access matches ${rows.length - mism.length}/${rows.length} · flags ${flagged.length} ===`);
  for (const r of mism) console.log(`MISMATCH: ${r.name} (${r.payer}) BC=${r.bcT} OURS=${r.our}/${r.ourAccess}`);
  console.log(`Report → ${OUT}`);
});
