/**
 * Seed script — populates realistic demo data for testing.
 * Run: node seed.js
 */

require('dotenv').config({ path: '../.env' });
const crypto = require('crypto');
const db = require('./db');

const SEED_USER_ID = 'seed-user-001';
const SEED_EMAIL = 'demo@idlookup.ai';

// ── Helpers ──────────────────────────────────────────────────────────────────

function randomDate(daysAgo, daysAgoEnd = 0) {
  const start = Date.now() - daysAgo * 24 * 60 * 60 * 1000;
  const end = Date.now() - daysAgoEnd * 24 * 60 * 60 * 1000;
  return new Date(start + Math.random() * (end - start)).toISOString();
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

const FIRST_NAMES = ['James', 'Maria', 'Robert', 'Sarah', 'Michael', 'Jennifer', 'David', 'Lisa', 'Chris', 'Amanda', 'Daniel', 'Emily', 'Kevin', 'Ashley', 'Brian', 'Nicole', 'Alex', 'Rachel', 'Tyler', 'Megan'];
const LAST_INITIALS = ['A', 'B', 'C', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'P', 'R', 'S', 'T', 'W'];
const CITIES = ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'Austin', 'Portland', 'Seattle', 'Denver', 'Miami', 'Atlanta'];
const STATES = ['NY', 'CA', 'IL', 'TX', 'AZ', 'PA', 'TX', 'CA', 'TX', 'TX', 'OR', 'WA', 'CO', 'FL', 'GA'];
const TIERS = ['basic', 'basic', 'basic', 'premium', 'premium', 'unlimited'];
const SEARCH_TYPES = ['name', 'name', 'name', 'phone', 'email', 'address'];
const SECTIONS = ['overview', 'contact', 'addresses', 'associates', 'criminal', 'court', 'social', 'assets', 'licenses'];
const SOURCES = ['search_results', 'direct_link', 'watchlist', 'email_alert'];

const BROKERS = [
  { id: 'whitepages', name: 'WhitePages', code: 'WP' },
  { id: 'spokeo', name: 'Spokeo', code: 'SPK' },
  { id: 'beenverified', name: 'BeenVerified', code: 'BV' },
  { id: 'truepeoplesearch', name: 'TruePeopleSearch', code: 'TPS' },
  { id: 'fastpeoplesearch', name: 'FastPeopleSearch', code: 'FPS' },
  { id: 'intelius', name: 'Intelius', code: 'INT' },
  { id: 'instantcheckmate', name: 'Instant Checkmate', code: 'ICM' },
  { id: 'ussearch', name: 'US Search', code: 'USS' },
  { id: 'peoplefinder', name: 'PeopleFinder', code: 'PF' },
  { id: 'radaris', name: 'Radaris', code: 'RAD' },
  { id: 'mylife', name: 'MyLife', code: 'ML' },
  { id: 'publicrecordsnow', name: 'PublicRecordsNow', code: 'PRN' },
  { id: 'peekyou', name: 'PeekYou', code: 'PY' },
  { id: 'thatsthem', name: 'ThatsThem', code: 'TT' },
  { id: 'zabasearch', name: 'ZabaSearch', code: 'ZS' },
  { id: 'pipl', name: 'Pipl', code: 'PPL' },
  { id: 'familytreenow', name: 'FamilyTreeNow', code: 'FTN' },
  { id: 'addresses', name: 'Addresses.com', code: 'ADR' },
  { id: 'cyberbackground', name: 'CyberBackgroundChecks', code: 'CBC' },
  { id: 'neighbor', name: 'Neighbor.Report', code: 'NR' },
  { id: 'peoplelooker', name: 'PeopleLooker', code: 'PL' },
  { id: 'socialcatfish', name: 'Social Catfish', code: 'SC' },
  { id: 'searchpeoplefree', name: 'SearchPeopleFree', code: 'SPF' },
  { id: 'truecaller', name: 'TrueCaller', code: 'TC' },
];

const BROKER_STATUSES = ['found', 'found', 'found', 'removing', 'removing', 'removed', 'removed', 'removed', 'not_found', 'not_found'];

// ── Clear existing seed data ─────────────────────────────────────────────────

console.log('Clearing existing seed data...');

const userIdTables = ['broker_exposure', 'exposure_scores', 'watchlist', 'records_feed', 'login_history', 'search_history'];
const targetIdTables = ['profile_searches', 'profile_views'];
const clearAll = db.transaction(() => {
  for (const table of userIdTables) {
    db.prepare(`DELETE FROM ${table} WHERE user_id = ?`).run(SEED_USER_ID);
  }
  for (const table of targetIdTables) {
    db.prepare(`DELETE FROM ${table} WHERE target_user_id = ?`).run(SEED_USER_ID);
  }
});
clearAll();

// ── Seed profile_searches (50) ───────────────────────────────────────────────

console.log('Seeding profile_searches (50)...');
const insertSearch = db.prepare(`
  INSERT INTO profile_searches (id, target_user_id, searcher_first_name, searcher_last_initial,
    searcher_city, searcher_state, searcher_tier, search_type, matched, created_at)
  VALUES (@id, @target_user_id, @searcher_first_name, @searcher_last_initial,
    @searcher_city, @searcher_state, @searcher_tier, @search_type, @matched, @created_at)
`);

const seedSearches = db.transaction(() => {
  for (let i = 0; i < 50; i++) {
    const ci = Math.floor(Math.random() * CITIES.length);
    // Weight toward recent: 60% in last 30 days, 40% in 30-90 days
    const daysAgo = Math.random() < 0.6 ? Math.random() * 30 : 30 + Math.random() * 60;
    insertSearch.run({
      id: crypto.randomUUID(),
      target_user_id: SEED_USER_ID,
      searcher_first_name: pick(FIRST_NAMES),
      searcher_last_initial: pick(LAST_INITIALS),
      searcher_city: CITIES[ci],
      searcher_state: STATES[ci],
      searcher_tier: pick(TIERS),
      search_type: pick(SEARCH_TYPES),
      matched: 1,
      created_at: randomDate(daysAgo, Math.max(0, daysAgo - 1)),
    });
  }
});
seedSearches();

// ── Seed profile_views (30) ──────────────────────────────────────────────────

console.log('Seeding profile_views (30)...');
const insertView = db.prepare(`
  INSERT INTO profile_views (id, target_user_id, viewer_first_name, viewer_last_initial,
    viewer_city, viewer_state, viewer_tier, sections_viewed, sections_count,
    duration_seconds, source, created_at)
  VALUES (@id, @target_user_id, @viewer_first_name, @viewer_last_initial,
    @viewer_city, @viewer_state, @viewer_tier, @sections_viewed, @sections_count,
    @duration_seconds, @source, @created_at)
`);

const seedViews = db.transaction(() => {
  for (let i = 0; i < 30; i++) {
    const ci = Math.floor(Math.random() * CITIES.length);
    const viewedSections = SECTIONS.filter(() => Math.random() > 0.5);
    const daysAgo = Math.random() < 0.6 ? Math.random() * 30 : 30 + Math.random() * 60;
    insertView.run({
      id: crypto.randomUUID(),
      target_user_id: SEED_USER_ID,
      viewer_first_name: pick(FIRST_NAMES),
      viewer_last_initial: pick(LAST_INITIALS),
      viewer_city: CITIES[ci],
      viewer_state: STATES[ci],
      viewer_tier: pick(TIERS),
      sections_viewed: JSON.stringify(viewedSections),
      sections_count: viewedSections.length,
      duration_seconds: Math.floor(Math.random() * 300) + 10,
      source: pick(SOURCES),
      created_at: randomDate(daysAgo, Math.max(0, daysAgo - 1)),
    });
  }
});
seedViews();

// ── Seed broker_exposure (24) ────────────────────────────────────────────────

console.log('Seeding broker_exposure (24)...');
const insertBroker = db.prepare(`
  INSERT INTO broker_exposure (id, user_id, broker_id, broker_name, broker_code, status,
    profile_url, found_at, requested_at, removed_at, last_checked_at)
  VALUES (@id, @user_id, @broker_id, @broker_name, @broker_code, @status,
    @profile_url, @found_at, @requested_at, @removed_at, @last_checked_at)
`);

const seedBrokers = db.transaction(() => {
  for (let i = 0; i < 24; i++) {
    const broker = BROKERS[i];
    const status = pick(BROKER_STATUSES);
    const foundAt = status !== 'not_found' ? randomDate(90, 30) : null;
    const requestedAt = (status === 'removing' || status === 'removed') ? randomDate(30, 7) : null;
    const removedAt = status === 'removed' ? randomDate(7, 0) : null;

    insertBroker.run({
      id: crypto.randomUUID(),
      user_id: SEED_USER_ID,
      broker_id: broker.id,
      broker_name: broker.name,
      broker_code: broker.code,
      status,
      profile_url: status !== 'not_found' ? `https://${broker.id}.com/profile/demo-user` : null,
      found_at: foundAt,
      requested_at: requestedAt,
      removed_at: removedAt,
      last_checked_at: randomDate(3, 0),
    });
  }
});
seedBrokers();

// ── Seed exposure_scores (5 monthly snapshots) ──────────────────────────────

console.log('Seeding exposure_scores (5)...');
const insertScore = db.prepare(`
  INSERT INTO exposure_scores (id, user_id, score, grade, factors, created_at)
  VALUES (@id, @user_id, @score, @grade, @factors, @created_at)
`);

const seedScores = db.transaction(() => {
  const baseScores = [42, 48, 55, 62, 68]; // improving trend
  for (let i = 0; i < 5; i++) {
    const score = baseScores[i];
    const grade = score >= 80 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : score >= 20 ? 'D' : 'F';
    insertScore.run({
      id: crypto.randomUUID(),
      user_id: SEED_USER_ID,
      score,
      grade,
      factors: JSON.stringify([
        { factor: 'data_brokers_found', impact: -(100 - score) * 0.6, detail: `Found on ${Math.round((100 - score) / 4)} broker sites` },
        { factor: 'removals_in_progress', impact: -5, detail: 'Removal requests pending' },
      ]),
      created_at: randomDate(150 - i * 30, 120 - i * 30),
    });
  }
});
seedScores();

// ── Seed watchlist (6) ───────────────────────────────────────────────────────

console.log('Seeding watchlist (6)...');
const insertWatch = db.prepare(`
  INSERT INTO watchlist (id, user_id, target_type, commerce_content_id, ext_id,
    display_name, location, notes, has_new_info, changes, added_at, last_checked_at)
  VALUES (@id, @user_id, @target_type, @commerce_content_id, @ext_id,
    @display_name, @location, @notes, @has_new_info, @changes, @added_at, @last_checked_at)
`);

const watchlistItems = [
  { name: 'John Smith', location: 'New York, NY', notes: 'Former roommate', hasNew: 1, changes: [{ field: 'address', date: randomDate(3, 0) }] },
  { name: 'Sarah Johnson', location: 'Los Angeles, CA', notes: 'Business contact', hasNew: 0, changes: [] },
  { name: 'Michael Williams', location: 'Chicago, IL', notes: null, hasNew: 1, changes: [{ field: 'phone', date: randomDate(5, 0) }, { field: 'email', date: randomDate(2, 0) }] },
  { name: 'Emily Davis', location: 'Houston, TX', notes: 'Family member', hasNew: 0, changes: [] },
  { name: 'Robert Brown', location: 'Phoenix, AZ', notes: 'Background check needed', hasNew: 1, changes: [{ field: 'criminal_record', date: randomDate(1, 0) }] },
  { name: 'Jessica Miller', location: 'Seattle, WA', notes: null, hasNew: 0, changes: [] },
];

const seedWatchlist = db.transaction(() => {
  for (const item of watchlistItems) {
    insertWatch.run({
      id: crypto.randomUUID(),
      user_id: SEED_USER_ID,
      target_type: 'person',
      commerce_content_id: `cc-${crypto.randomUUID().slice(0, 8)}`,
      ext_id: `ext-${crypto.randomUUID().slice(0, 8)}`,
      display_name: item.name,
      location: item.location,
      notes: item.notes,
      has_new_info: item.hasNew,
      changes: JSON.stringify(item.changes),
      added_at: randomDate(60, 5),
      last_checked_at: randomDate(3, 0),
    });
  }
});
seedWatchlist();

// ── Seed records_feed (15) ───────────────────────────────────────────────────

console.log('Seeding records_feed (15)...');
const insertFeed = db.prepare(`
  INSERT INTO records_feed (id, user_id, kind, subkind, source, source_label, summary, details, created_at)
  VALUES (@id, @user_id, @kind, @subkind, @source, @source_label, @summary, @details, @created_at)
`);

const feedKinds = [
  { kind: 'removal_requested', summary: 'Removal requested from {broker}' },
  { kind: 'removal_completed', summary: 'Successfully removed from {broker}' },
  { kind: 'broker_scan', summary: 'Broker scan completed' },
  { kind: 'new_exposure', summary: 'New listing found on {broker}' },
  { kind: 'watchlist_change', summary: 'Change detected for watched person' },
  { kind: 'search_performed', summary: 'You searched for a person' },
  { kind: 'report_generated', summary: 'Background report generated' },
];

const seedFeed = db.transaction(() => {
  for (let i = 0; i < 15; i++) {
    const item = pick(feedKinds);
    const broker = pick(BROKERS);
    insertFeed.run({
      id: crypto.randomUUID(),
      user_id: SEED_USER_ID,
      kind: item.kind,
      subkind: null,
      source: broker.code,
      source_label: broker.name,
      summary: item.summary.replace('{broker}', broker.name),
      details: JSON.stringify({ brokerId: broker.id, brokerName: broker.name }),
      created_at: randomDate(60, 0),
    });
  }
});
seedFeed();

// ── Seed login_history (20) ──────────────────────────────────────────────────

console.log('Seeding login_history (20)...');
const insertLogin = db.prepare(`
  INSERT INTO login_history (id, user_id, ip, user_agent, device, location, status, created_at)
  VALUES (@id, @user_id, @ip, @user_agent, @device, @location, @status, @created_at)
`);

const devices = ['Desktop - Chrome', 'Desktop - Firefox', 'Desktop - Safari', 'iPhone - Safari', 'Android - Chrome', 'iPad - Safari'];
const ips = ['192.168.1.42', '10.0.0.15', '172.16.0.100', '203.0.113.50', '198.51.100.23', '100.64.0.1'];

const seedLogins = db.transaction(() => {
  for (let i = 0; i < 20; i++) {
    const ci = Math.floor(Math.random() * CITIES.length);
    insertLogin.run({
      id: crypto.randomUUID(),
      user_id: SEED_USER_ID,
      ip: pick(ips),
      user_agent: 'Mozilla/5.0 (compatible; seed)',
      device: pick(devices),
      location: `${CITIES[ci]}, ${STATES[ci]}`,
      status: Math.random() > 0.1 ? 'success' : 'failed',
      created_at: randomDate(60, 0),
    });
  }
});
seedLogins();

// ── Seed search_history (10) ─────────────────────────────────────────────────

console.log('Seeding search_history (10)...');
const insertSearchHist = db.prepare(`
  INSERT INTO search_history (id, user_id, search_type, query, results_count, report_generated, commerce_content_id, created_at)
  VALUES (@id, @user_id, @search_type, @query, @results_count, @report_generated, @commerce_content_id, @created_at)
`);

const searchQueries = [
  { type: 'name', query: { firstName: 'John', lastName: 'Smith', state: 'NY' } },
  { type: 'name', query: { firstName: 'Sarah', lastName: 'Johnson', city: 'Los Angeles', state: 'CA' } },
  { type: 'phone', query: { phone: '555-0123' } },
  { type: 'email', query: { email: 'jsmith@email.com' } },
  { type: 'name', query: { firstName: 'Michael', lastName: 'Williams' } },
  { type: 'address', query: { street: '123 Main St', city: 'Chicago', state: 'IL' } },
  { type: 'name', query: { firstName: 'Emily', lastName: 'Davis', state: 'TX' } },
  { type: 'phone', query: { phone: '555-0456' } },
  { type: 'name', query: { firstName: 'Robert', lastName: 'Brown', city: 'Phoenix', state: 'AZ' } },
  { type: 'email', query: { email: 'sjohnson@email.com' } },
];

const seedSearchHist = db.transaction(() => {
  for (const sq of searchQueries) {
    insertSearchHist.run({
      id: crypto.randomUUID(),
      user_id: SEED_USER_ID,
      search_type: sq.type,
      query: JSON.stringify(sq.query),
      results_count: Math.floor(Math.random() * 15) + 1,
      report_generated: Math.random() > 0.5 ? 1 : 0,
      commerce_content_id: Math.random() > 0.5 ? `cc-${crypto.randomUUID().slice(0, 8)}` : null,
      created_at: randomDate(30, 0),
    });
  }
});
seedSearchHist();

console.log('Seed complete!');
console.log(`  User ID: ${SEED_USER_ID}`);
console.log(`  Email:   ${SEED_EMAIL}`);

// Print summary counts
for (const table of userIdTables) {
  const cnt = db.prepare(`SELECT COUNT(*) as cnt FROM ${table} WHERE user_id = ?`).get(SEED_USER_ID).cnt;
  console.log(`  ${table}: ${cnt} rows`);
}
// Also count target-based
const psCnt = db.prepare('SELECT COUNT(*) as cnt FROM profile_searches WHERE target_user_id = ?').get(SEED_USER_ID).cnt;
const pvCnt = db.prepare('SELECT COUNT(*) as cnt FROM profile_views WHERE target_user_id = ?').get(SEED_USER_ID).cnt;
console.log(`  profile_searches (as target): ${psCnt}`);
console.log(`  profile_views (as target): ${pvCnt}`);
