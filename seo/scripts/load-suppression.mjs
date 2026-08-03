// One-shot: load a list of emails (e.g. PAYING MEMBERS exported from BC) into email_suppression, so EVERY
// email campaign — abandoned-checkout recovery, the lead drip, AND the WSFY alerts — skips them. The seo
// backend can't see BC payment status, so this is how we keep marketing email off active subscribers.
// Idempotent: ON CONFLICT DO NOTHING, so re-running is safe and won't clobber existing unsubscribes.
//
// Usage:
//   node scripts/load-suppression.mjs <file> [reason] [source]
//     <file>  path to a .csv or newline-separated list of emails (CSV: the first email-looking token per line)
//     reason  default 'paying_member'   (shows in the suppression list; distinguishes from 'unsubscribe'/'bounce')
//     source  default 'bc_export'
//   DRY=1 node scripts/load-suppression.mjs members.csv    # parse + report only, no writes
//
// DB URL from LEADS_DATABASE_URL | DATABASE_URL | POSTGRES_URL (same resolution as lib/leads-db.mjs).
import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'node:fs';

const DB = process.env.LEADS_DATABASE_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL || '';

const file = process.argv[2];
if (!file) { console.error('Usage: node scripts/load-suppression.mjs <file> [reason] [source]   (DRY=1 to preview)'); process.exit(1); }
const reason = process.argv[3] || 'paying_member';
const source = process.argv[4] || 'bc_export';
const dry = process.env.DRY === '1';

// One email per line; tolerant of CSV (grabs the first email-looking token). Normalized lowercase.
const EMAIL_RE = /[^\s,;"'<>]+@[^\s,;"'<>]+\.[^\s,;"'<>]+/;
const raw = readFileSync(file, 'utf8');
const emails = [...new Set(
  raw.split(/\r?\n/).map((line) => { const m = line.match(EMAIL_RE); return m ? m[0].trim().toLowerCase() : null; }).filter(Boolean),
)];

console.log(`Parsed ${emails.length} unique emails from ${file} — reason='${reason}' source='${source}'${dry ? '  [DRY RUN]' : ''}`);
if (!emails.length) { console.log('Nothing to do.'); process.exit(0); }
if (dry) { console.log('Sample:', emails.slice(0, 8)); process.exit(0); }

if (!DB) { console.error('✗ No DB URL — set LEADS_DATABASE_URL / DATABASE_URL / POSTGRES_URL'); process.exit(1); }
const sql = neon(DB);
let inserted = 0, existing = 0;
for (let i = 0; i < emails.length; i++) {
  try {
    const rows = await sql`INSERT INTO email_suppression (email, reason, source) VALUES (${emails[i]}, ${reason}, ${source})
      ON CONFLICT (email) DO NOTHING RETURNING email`;
    if (rows && rows.length) inserted += 1; else existing += 1;
  } catch (e) { console.error('  ! failed:', emails[i], String(e && e.message || e)); }
  if ((i + 1) % 250 === 0) console.log(`  … ${i + 1}/${emails.length}`);
}
console.log(`✓ Done. ${inserted} newly suppressed, ${existing} already present (unsubscribes/prior loads).`);
