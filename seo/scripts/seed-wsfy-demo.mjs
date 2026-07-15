// Seed a realistic WSFY scenario so you can SEE actual "Who's Searching For You" data — both in the
// buildWsfySummary output (printed here) and in the live UI (log in as the subject account).
//
//   cd seo && node --env-file=.env.local scripts/seed-wsfy-demo.mjs \
//     --name "David Davis" --userId <BC_userId_of_test_account> --state CA --city "Los Angeles"
//   ... then log in as that account and open "Who's Searching" / the payment WSFY teaser.
//   cleanup:  node --env-file=.env.local scripts/seed-wsfy-demo.mjs --clean
//
// It (1) enriches the SUBJECT (high school / college / employer, so overlap affinities fire),
// (2) inserts several member searchers who searched for the subject — some sharing the subject's
// school/employer, some local, some frequent — each enriched so occupation/affinity descriptors
// show, and (3) prints the free + paid WSFY summary. All rows tagged source='wsfy-demo' for cleanup.
import { insertSearchActivity, upsertMemberEnrichment } from '../lib/search-activity-db.mjs';
import { buildWsfySummary } from '../lib/wsfy.mjs';
import { neon } from '@neondatabase/serverless';

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > -1 ? process.argv[i + 1] : d; };
const CLEAN = process.argv.includes('--clean');
const TAG = 'wsfy-demo';
const sql = neon(process.env.DATABASE_URL || process.env.LEADS_DATABASE_URL);

if (CLEAN) {
  await sql`DELETE FROM search_activity WHERE source = ${TAG}`;
  await sql`DELETE FROM member_enrichment WHERE user_id LIKE ${'wsfy-demo-%'}`;
  console.log('✅ cleaned wsfy-demo rows');
  process.exit(0);
}

const NAME = arg('name', 'David Davis');
const [first, ...rest] = NAME.split(' ');
const last = rest.join(' ');
const STATE = arg('state', 'CA');
const CITY = arg('city', 'Los Angeles');
const SUBJECT_ID = arg('userId', 'wsfy-demo-subject'); // pass the real BC userId to see it in the UI

// 1) Subject enrichment (their own school/employer → enables "went to your high school" etc.)
await upsertMemberEnrichment({
  userId: SUBJECT_ID, city: CITY, state: STATE,
  highSchool: 'Lincoln High School', college: 'Reed College', employer: 'Google',
  relatives: ['Jane Wolfe', 'Tom Wolfe'],
  selfPerson: { name: NAME, city: CITY, state: STATE, age: 42 }, reportId: 'wsfy-demo-report',
  source: 'wsfy-demo-subject',
});

// 2) Searchers who searched for the subject. Each = a member enrichment + one search for NAME/STATE.
const searchers = [
  { id: 'wsfy-demo-1', name: 'Robert Davis',  city: CITY,        highSchool: 'Lincoln High School', relatives: ['Jane Wolfe'] }, // HS + local + shares a relative
  { id: 'wsfy-demo-2', name: 'Carol King',    city: CITY,        occupation: 'healthcare' },           // local + occupation proof
  { id: 'wsfy-demo-3', name: 'Sara Chen',     city: 'Portland',  college: 'Reed College' },            // college overlap
  { id: 'wsfy-demo-4', name: 'Mike Alvarez',  city: 'San Jose',  employer: 'Google', searchType: 'phone' }, // colleague + has your phone
  { id: 'wsfy-demo-5', name: 'Ana Ruiz',      city: 'San Diego', occupation: 'education', pastLocations: [`${CITY}, ${STATE}`] }, // once lived in your area
  { id: 'wsfy-demo-6', name: 'Anon',          anon: true },                                             // anonymous visitor
];

for (const s of searchers) {
  const searcher = s.anon
    ? { type: 'anon', sessionId: s.id }
    : { type: 'member', userId: s.id, name: s.name, firstName: s.name.split(' ')[0], city: s.city, state: STATE };
  if (!s.anon) {
    await upsertMemberEnrichment({
      userId: s.id, city: s.city, state: STATE,
      highSchool: s.highSchool, college: s.college, employer: s.employer, occupation: s.occupation,
      pastLocations: s.pastLocations, relatives: s.relatives,
      source: 'wsfy-demo',
    });
  }
  const times = s.id === 'wsfy-demo-2' ? 3 : 1; // Carol searched 3× → "frequent"
  for (let i = 0; i < times; i++) {
    await insertSearchActivity({
      searcherType: searcher.type, searcherUserId: searcher.userId, sessionId: searcher.sessionId, searcher,
      searchType: s.searchType || 'name', source: TAG, terms: { firstName: first, lastName: last, state: STATE },
      results: [], ts: new Date().toISOString(),
    });
  }
}

console.log(`Seeded ${searchers.length} searchers for "${NAME}" / ${STATE} (subject userId=${SUBJECT_ID}).\n`);
for (const tier of ['free', 'paid']) {
  const r = await buildWsfySummary({ name: NAME, city: CITY, state: STATE, selfUserId: SUBJECT_ID }, { tier });
  console.log(`===== ${tier.toUpperCase()} =====`);
  console.log('headline:', r.teaseSummary.headline);
  r.teaseSummary.lines.forEach((l) => console.log('  •', l));
  if (tier === 'paid') console.log('events:', r.events.map((e) => `${e.name} [${(e.affinities || []).join(',')}]${e.occupation ? ' occ=' + e.occupation : ''}`));
  console.log('');
}
console.log('To see it in the UI: log in as the account whose BC userId you passed as --userId, then open the "Who is Searching" page.');
console.log('Cleanup: node --env-file=.env.local scripts/seed-wsfy-demo.mjs --clean');
