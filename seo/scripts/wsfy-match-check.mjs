// WSFY match verification probe. Answers "does this account match historical searches?" without
// hand-writing SQL — the thing we couldn't see before (owner 2026-07-16).
//
// Two modes:
//   New-account simulation (name + optional state), with a fresh never-seen selfUserId:
//     node --env-file=.env.local scripts/wsfy-match-check.mjs "David Wolfe" CA
//   Existing member (resolves via the confirmed self-identify record, member_enrichment.self_person):
//     node --env-file=.env.local scripts/wsfy-match-check.mjs --user <user_id>
//
// Prints the match count, HOW it matched (self_identify vs account_name), and the free-tier tease.
import { buildWsfySummary } from '../lib/wsfy.mjs';

const args = process.argv.slice(2);
let identity;
if (args[0] === '--user') {
  const userId = args[1];
  if (!userId) { console.error('usage: --user <user_id>'); process.exit(1); }
  // name/state left blank on purpose — the server resolves them from self_person for this user.
  identity = { name: '', selfUserId: userId };
  console.log(`\nEXISTING MEMBER — user ${userId} (resolves via confirmed self-identify record)`);
} else {
  const name = args[0];
  const state = args[1] || '';
  if (!name) {
    console.error('usage: wsfy-match-check.mjs "<First Last>" [ST]   |   --user <user_id>');
    process.exit(1);
  }
  // Fresh selfUserId that has never existed → true brand-new-account simulation.
  identity = { name, state, selfUserId: `probe-new-acct-${name.replace(/\s+/g, '-').toLowerCase()}` };
  console.log(`\nNEW-ACCOUNT SIMULATION — "${name}"${state ? `, ${state}` : ''} (fresh selfUserId, no prior history)`);
}

const summary = await buildWsfySummary(identity, { tier: 'free' });
console.log('─'.repeat(56));
console.log('matched via   :', summary.matchedVia);
console.log('match count   :', summary.count);
console.log('headline      :', summary.teaseSummary.headline);
console.log('tease lines   :', summary.teaseSummary.lines.length ? summary.teaseSummary.lines.map((l) => `\n                - ${l}`).join('') : '(none)');
console.log('sample events :', summary.events.slice(0, 3).map((e) => `${e.searchType}/${e.tier}${e.affinities?.length ? ` [${e.affinities.join(',')}]` : ''}`).join('  ·  ') || '(none)');
console.log('─'.repeat(56));
console.log(summary.count > 0
  ? `✓ This account WOULD see ${summary.count} searcher(s) in WSFY.`
  : '✗ No historical matches — check the name, or the corpus may not contain searches for this person yet.');
