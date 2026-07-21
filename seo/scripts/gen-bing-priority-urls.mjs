// Generate the ~100 highest-value URLs to submit to Bing's URL Submission API (100/day, guaranteed
// processing — distinct from IndexNow, which Bing processes at its discretion). Weighted toward our
// DIFFERENTIATED first-party pages (county hubs + name-in-state with real incarceration records), which are
// what actually rank + carry the moat, plus the top state/city hubs. Writes seo/bing-priority-urls.txt.
import { neon } from '@neondatabase/serverless';
import { countiesByState, rosterTopNamesByState } from '../lib/incarceration.mjs';

const SITE = 'https://idlookup.me';
const sql = neon(process.env.LEADS_DATABASE_URL || process.env.DATABASE_URL);
const urls = [];
const add = (u) => { if (u && !urls.includes(u)) urls.push(u); };

// 1) Root + top state hubs (population order) — the taxonomy anchors, all now carry incarceration data.
add(`${SITE}/people`);
const STATES = ['ca', 'tx', 'fl', 'ny', 'pa', 'il', 'oh', 'ga', 'nc', 'mi', 'nj', 'va', 'wa', 'az', 'ma', 'tn', 'in', 'mo', 'md', 'wi'];
for (const s of STATES) add(`${SITE}/people/${s}`);

// 2) Top county hubs (differentiated — unique incarceration content, no cross-city dup).
for (const st of ['FL', 'PA', 'CA', 'GA', 'IL']) {
  const cs = await countiesByState({ state: st, limit: 10 });
  for (const c of cs) add(`${SITE}/people/${st.toLowerCase()}/county/${c.slug}`);
}

// 3) Top name-in-state pages WITH records (differentiated leaves) from the deepest-coverage states.
for (const st of ['FL', 'NC', 'IL', 'PA', 'CA', 'TX']) {
  const names = await rosterTopNamesByState({ state: st, limit: 6 });
  for (const n of names) add(`${SITE}/people/${st.toLowerCase()}/${n.slug}`);
}

const out = urls.slice(0, 100);
process.stdout.write(out.join('\n') + '\n');
console.error(`\n[gen] ${out.length} URLs (${STATES.length + 1} hubs + county + name-in-state)`);
