/* ---------------------------------------------------------------------------
 * Shared helpers for member pages that display "Who's Watching You" style
 * mock data: seeded PRNG, masking helpers, mock generators, and data broker
 * mock data.
 *
 * Used by:
 *   - WhoIsSearchingPage.js
 *   - DashboardHome.js
 *
 * All data is deterministic per seed — pass `hashString(user.id || user.email)`
 * so the same account consistently sees the same data across refreshes.
 * Replace the generators with real BC endpoints when available.
 * -------------------------------------------------------------------------*/

// ---------- Seeded PRNG ----------
// mulberry32 — small, fast, deterministic.
export function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// ---------- Mock source pools ----------
export const FIRST_NAMES = [
  'James', 'Mary', 'Robert', 'Patricia', 'John', 'Jennifer', 'Michael', 'Linda',
  'David', 'Elizabeth', 'William', 'Barbara', 'Richard', 'Susan', 'Joseph',
  'Jessica', 'Thomas', 'Sarah', 'Christopher', 'Karen', 'Daniel', 'Nancy',
  'Matthew', 'Lisa', 'Anthony', 'Betty', 'Donald', 'Margaret', 'Mark', 'Sandra',
  'Paul', 'Ashley', 'Steven', 'Kimberly', 'Andrew', 'Emily', 'Kenneth', 'Donna',
];

export const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
  'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson',
  'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson',
];

export const CITIES = [
  { city: 'Los Angeles', state: 'CA' },
  { city: 'New York', state: 'NY' },
  { city: 'Chicago', state: 'IL' },
  { city: 'Houston', state: 'TX' },
  { city: 'Phoenix', state: 'AZ' },
  { city: 'Philadelphia', state: 'PA' },
  { city: 'San Antonio', state: 'TX' },
  { city: 'San Diego', state: 'CA' },
  { city: 'Dallas', state: 'TX' },
  { city: 'Austin', state: 'TX' },
  { city: 'Jacksonville', state: 'FL' },
  { city: 'San Francisco', state: 'CA' },
  { city: 'Seattle', state: 'WA' },
  { city: 'Denver', state: 'CO' },
  { city: 'Boston', state: 'MA' },
  { city: 'Nashville', state: 'TN' },
  { city: 'Portland', state: 'OR' },
  { city: 'Las Vegas', state: 'NV' },
  { city: 'Miami', state: 'FL' },
  { city: 'Atlanta', state: 'GA' },
];

export const SEARCH_TYPES = ['Name', 'Phone', 'Email', 'Address'];
export const VIEWED_SECTIONS = ['Contact', 'Relatives', 'Addresses', 'Criminal', 'Financial', 'Social', 'Employment'];

// Weighted picker: pairs of [value, weight]
export function pickWeighted(rand, entries) {
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let r = rand() * total;
  for (const [value, weight] of entries) {
    r -= weight;
    if (r <= 0) return value;
  }
  return entries[entries.length - 1][0];
}

// ---------- Event generator (searchers / viewers) ----------
export function generateEvents(seed, kind, count) {
  const rand = mulberry32(seed + (kind === 'viewers' ? 7919 : 104729));
  const now = Date.now();
  const ninetyDays = 90 * 24 * 60 * 60 * 1000;
  const events = [];

  for (let i = 0; i < count; i++) {
    // Exponential decay — weight recent days heavier.
    const offsetFrac = Math.pow(rand(), 2.5);
    const timestamp = now - offsetFrac * ninetyDays;

    const first = FIRST_NAMES[Math.floor(rand() * FIRST_NAMES.length)];
    const last = LAST_NAMES[Math.floor(rand() * LAST_NAMES.length)];
    const loc = CITIES[Math.floor(rand() * CITIES.length)];

    const tier = pickWeighted(rand, [
      ['Basic', 60],
      ['Visitor', 25],
      ['Pro', 15],
    ]);

    const event = {
      id: `${kind}-${i}-${Math.floor(rand() * 1e9)}`,
      name: `${first} ${last}`,
      firstName: first,
      lastName: last,
      city: loc.city,
      state: loc.state,
      tier,
      timestamp,
    };

    if (kind === 'searchers') {
      event.searchType = pickWeighted(rand, [
        ['Name', 50],
        ['Phone', 25],
        ['Email', 15],
        ['Address', 10],
      ]);
    } else {
      const numSections = 1 + Math.floor(rand() * 5);
      const shuffled = [...VIEWED_SECTIONS].sort(() => rand() - 0.5);
      event.sectionsViewed = shuffled.slice(0, numSections);
    }

    events.push(event);
  }

  // Sort newest first
  events.sort((a, b) => b.timestamp - a.timestamp);
  return events;
}

// ---------- Masking helpers ----------
// First letter visible, remaining characters replaced with `*` of matching
// length. "Tim Chin" → "T** C***". Used wherever we display another
// member's name without revealing it to the viewer.
export function maskName(name) {
  if (!name) return '***';
  return name
    .trim()
    .split(/\s+/)
    .map((part) => {
      if (part.length <= 1) return part || '*';
      return part[0] + '*'.repeat(part.length - 1);
    })
    .join(' ');
}

// "tim@gmail.com" → "t**@g****.com". Local part: first letter + asterisks
// to length. Domain: first letter of registrable name + asterisks to
// length, TLD preserved so it still reads as an email.
export function maskEmail(email) {
  if (!email || typeof email !== 'string') return '***';
  const at = email.indexOf('@');
  if (at < 1) {
    // No usable local-part; mask the whole thing.
    return email.length > 0 ? email[0] + '*'.repeat(email.length - 1) : '***';
  }
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const lastDot = domain.lastIndexOf('.');
  const dn = lastDot > 0 ? domain.slice(0, lastDot) : domain;
  const tld = lastDot > 0 ? domain.slice(lastDot) : '';
  const maskedLocal = local.length === 1
    ? local
    : local[0] + '*'.repeat(local.length - 1);
  const maskedDomain = dn.length === 0
    ? ''
    : (dn.length === 1 ? dn : dn[0] + '*'.repeat(dn.length - 1));
  return `${maskedLocal}@${maskedDomain}${tld}`;
}

// Pick the best display label for a (possibly partial) user record and
// mask it. Prefers name when available; falls back to email; finally
// returns "Anonymous". Pass any subset of { firstName, lastName,
// fullName, email }.
export function maskUserDisplay({ firstName, lastName, fullName, email } = {}) {
  const fl = [firstName, lastName].filter(Boolean).join(' ').trim();
  const name = fl || (fullName || '').trim();
  if (name) return maskName(name);
  if (email) return maskEmail(email);
  return 'Anonymous';
}

// Synthetic cross-user activity feed for the member dashboard. Generates
// plausible recent-activity events keyed off a seed (daily rotation +
// per-viewer jitter). Each event carries the ALREADY-MASKED actor so
// callers can render directly without re-masking. Real cross-user data
// would replace this once BC ships an aggregate endpoint.
//
// Returns up to `count` items, mixing searches, logins, signups, and
// report pulls. Timestamps are biased toward the recent few hours.
export function generateSyntheticActivity(seed, count = 12) {
  const rand = mulberry32(seed);
  const now = Date.now();
  // Weighted action mix — searches dominate, signups are rarer.
  const KIND_WEIGHTS = [
    ['search', 5],
    ['login', 3],
    ['report', 2],
    ['signup', 1],
  ];
  const SEARCH_TYPES_LC = ['name', 'phone', 'email', 'address'];
  const EMAIL_DOMAINS = ['gmail.com', 'yahoo.com', 'outlook.com', 'icloud.com', 'hotmail.com'];

  const events = [];
  for (let i = 0; i < count; i++) {
    const kind = pickWeighted(rand, KIND_WEIGHTS);
    // Squared random pulls timestamps toward "now" — most recent activity
    // looks freshest, with a long tail.
    const ageFrac = rand() * rand();
    const ageMs = Math.floor(ageFrac * 36 * 60 * 60 * 1000); // 36h window
    const ts = now - ageMs;

    // 30% of synthetic actors are identified by email rather than name —
    // matches the real shape where some accounts have one and not the other.
    const useEmail = rand() < 0.3;
    const fn = FIRST_NAMES[Math.floor(rand() * FIRST_NAMES.length)];
    const ln = LAST_NAMES[Math.floor(rand() * LAST_NAMES.length)];
    const domain = EMAIL_DOMAINS[Math.floor(rand() * EMAIL_DOMAINS.length)];
    const actor = useEmail
      ? maskEmail(`${fn.toLowerCase()}.${ln.toLowerCase()}@${domain}`)
      : maskName(`${fn} ${ln}`);

    let subject = null;
    let searchType = null;
    if (kind === 'search') {
      searchType = SEARCH_TYPES_LC[Math.floor(rand() * SEARCH_TYPES_LC.length)];
      const sfn = FIRST_NAMES[Math.floor(rand() * FIRST_NAMES.length)];
      const sln = LAST_NAMES[Math.floor(rand() * LAST_NAMES.length)];
      subject = `${sfn} ${sln}`;
    } else if (kind === 'report') {
      const sfn = FIRST_NAMES[Math.floor(rand() * FIRST_NAMES.length)];
      const sln = LAST_NAMES[Math.floor(rand() * LAST_NAMES.length)];
      subject = `${sfn} ${sln}`;
    }

    events.push({
      kind,
      actor,
      searchType,
      subject,
      synthetic: true,
      timestamp: new Date(ts).toISOString(),
    });
  }
  return events;
}

export function maskLocation(city, state) {
  if (!city) return `***, ${state || '??'}`;
  const masked = city[0] + '*'.repeat(Math.max(2, city.length - 1));
  return `${masked}, ${state || '??'}`;
}

export function relativeDate(date) {
  const now = Date.now();
  const ts = typeof date === 'number' ? date : new Date(date).getTime();
  if (Number.isNaN(ts)) return 'Unknown';
  const diffMs = now - ts;
  const day = 24 * 60 * 60 * 1000;
  const days = Math.floor(diffMs / day);
  if (days < 0) return 'Just now';
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 14) return 'Last week';
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 60) return 'Last month';
  return `${Math.floor(days / 30)} months ago`;
}

export function formatExactDate(date) {
  try {
    return new Date(date).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return 'Unknown';
  }
}

// ---------- Aggregations ----------
export function computeStats(events) {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const weekMs = 7 * day;
  const monthMs = 30 * day;

  const total = events.length;

  const thisWeek = events.filter((e) => now - e.timestamp < weekMs).length;
  const lastWeek = events.filter(
    (e) => now - e.timestamp >= weekMs && now - e.timestamp < 2 * weekMs,
  ).length;
  const thisMonth = events.filter((e) => now - e.timestamp < monthMs).length;
  const lastMonth = events.filter(
    (e) => now - e.timestamp >= monthMs && now - e.timestamp < 2 * monthMs,
  ).length;

  const pctChange = (curr, prev) => {
    if (prev === 0 && curr === 0) return 0;
    if (prev === 0) return 100;
    return Math.round(((curr - prev) / prev) * 100);
  };

  return {
    total,
    thisMonth,
    thisWeek,
    monthChange: pctChange(thisMonth, lastMonth),
    weekChange: pctChange(thisWeek, lastWeek),
  };
}

export function buildTrendSeries(events) {
  // 30-day bucket, count per day
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const buckets = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    buckets.push({
      key: d.getTime(),
      label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      count: 0,
    });
  }
  const cutoff = buckets[0].key;
  events.forEach((ev) => {
    if (ev.timestamp < cutoff) return;
    const d = new Date(ev.timestamp);
    d.setHours(0, 0, 0, 0);
    const idx = buckets.findIndex((b) => b.key === d.getTime());
    if (idx >= 0) buckets[idx].count++;
  });
  return buckets;
}

// ---------- Data broker mock data ----------
//
// Scoped to the only brokers we name in-product: Spokeo and PeopleFinders.
// (Other competitor brand names were removed — do not reintroduce them.)
// Short codes are used as "logo" stand-ins on the dashboard tracker.
export const DATA_BROKERS = [
  { name: 'Spokeo', code: 'SP' },
  { name: 'PeopleFinders', code: 'PF' },
];

// Kept consistent with the named-broker list above (was a placeholder 84).
export const TOTAL_BROKER_COUNT = DATA_BROKERS.length;

// Deterministic broker status list. Paid tier: ~30% removed, ~15% removing,
// rest found. Free tier should only reveal the first N entries in the UI.
export function generateBrokerStatuses(seed) {
  const rand = mulberry32(seed + 2654435);
  return DATA_BROKERS.map((broker, i) => {
    const r = rand();
    let status;
    if (r < 0.28) status = 'removed';
    else if (r < 0.43) status = 'removing';
    else status = 'found';
    const days = Math.floor(rand() * 45);
    return {
      ...broker,
      status,
      lastUpdated: Date.now() - days * 24 * 60 * 60 * 1000,
      // For progress calculation: count within the "active 24" list
      index: i,
    };
  });
}

// Aggregate cleaned count across the full 84-broker catalog. We extrapolate
// the "removed" ratio from the visible 24 to the full 84 to give a realistic
// looking total.
export function computeBrokerProgress(brokers) {
  const removed = brokers.filter((b) => b.status === 'removed').length;
  const ratio = brokers.length ? removed / brokers.length : 0;
  const totalRemoved = Math.round(ratio * TOTAL_BROKER_COUNT);
  return {
    removed: totalRemoved,
    total: TOTAL_BROKER_COUNT,
    percent: Math.round((totalRemoved / TOTAL_BROKER_COUNT) * 100),
  };
}

// ---------- Watchlist (people you're watching) ----------
export function generateWatchlist(seed, count = 5) {
  const rand = mulberry32(seed + 31337);
  const results = [];
  for (let i = 0; i < count; i++) {
    const first = FIRST_NAMES[Math.floor(rand() * FIRST_NAMES.length)];
    const last = LAST_NAMES[Math.floor(rand() * LAST_NAMES.length)];
    const loc = CITIES[Math.floor(rand() * CITIES.length)];
    const days = Math.floor(rand() * 30);
    const hasChanges = rand() < 0.4;
    results.push({
      id: `watch-${i}-${Math.floor(rand() * 1e9)}`,
      name: `${first} ${last}`,
      firstName: first,
      lastName: last,
      city: loc.city,
      state: loc.state,
      lastUpdated: Date.now() - days * 24 * 60 * 60 * 1000,
      hasChanges,
      newRecords: hasChanges ? 1 + Math.floor(rand() * 4) : 0,
    });
  }
  return results;
}

// ---------- Records found feed ----------
const RECORD_TYPES = [
  { type: 'phone', label: 'New phone number found' },
  { type: 'address', label: 'Address appeared' },
  { type: 'name', label: 'Your name found on people search' },
  { type: 'relative', label: 'Relative added' },
  { type: 'email', label: 'Email address found' },
  { type: 'employment', label: 'Employment record discovered' },
];

export function generateRecordsFeed(seed, count = 12) {
  const rand = mulberry32(seed + 90210);
  const now = Date.now();
  const sixtyDays = 60 * 24 * 60 * 60 * 1000;
  const results = [];
  for (let i = 0; i < count; i++) {
    const t = RECORD_TYPES[Math.floor(rand() * RECORD_TYPES.length)];
    const broker = DATA_BROKERS[Math.floor(rand() * DATA_BROKERS.length)];
    const offsetFrac = Math.pow(rand(), 2);
    const isRemoval = rand() < 0.15;
    const isAlert = rand() < 0.1;
    results.push({
      id: `rec-${i}-${Math.floor(rand() * 1e9)}`,
      type: isRemoval ? 'removal' : isAlert ? 'alert' : 'record',
      recordKind: t.type,
      title: isRemoval
        ? `Successfully removed from ${broker.name}`
        : isAlert
          ? `Alert: ${t.label} on ${broker.name}`
          : `${t.label} on ${broker.name}`,
      source: broker.name,
      sourceCode: broker.code,
      timestamp: now - offsetFrac * sixtyDays,
    });
  }
  results.sort((a, b) => b.timestamp - a.timestamp);
  return results;
}

// ---------- Real-data adapters (no PRNG) ----------
// These are used by DashboardHome when live data is available; they return
// the same shape the mock generators produce so widgets don't need to change.

function extractReportName(report) {
  if (!report) return null;
  // Try every shape BC is known to use, then fall back to a stub so the
  // report still lands in the watchlist even if we can't parse the name.
  const name =
    report.fullName ||
    report.name ||
    report.title ||
    report.targetName ||
    report.data?.fullName ||
    report.data?.teaserInput?.fullName ||
    (report.data?.teaserInput?.fName && report.data?.teaserInput?.lName
      ? `${report.data.teaserInput.fName} ${report.data.teaserInput.lName}`
      : null);
  if (name) return name;
  const id = report.commerceContentId || report.id || report.reportId;
  return id ? `Report ${String(id).slice(0, 8)}` : null;
}

function extractReportLocation(report) {
  if (!report) return { city: '', state: '' };
  const raw =
    report.location ||
    report.data?.teaserInput?.location ||
    report.data?.location ||
    '';
  if (typeof raw === 'string' && raw.includes(',')) {
    const [city, state] = raw.split(',').map((s) => s.trim());
    return { city: city || '', state: state || '' };
  }
  return {
    city: report.city || report.data?.teaserInput?.city || '',
    state: report.state || report.data?.teaserInput?.state || '',
  };
}

// Turn real BC reports the user has pulled into a "People you're watching" list.
// Reports the user creates are the people they're actively monitoring.
export function buildWatchlistFromReports(reports, limit = 5) {
  if (!Array.isArray(reports)) return [];
  const now = Date.now();
  const seen = new Set();
  const items = [];
  for (const r of reports) {
    const name = extractReportName(r);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue; // dedupe if user pulled same person twice
    seen.add(key);
    const { city, state } = extractReportLocation(r);
    const createdMs = r.createdAt ? new Date(r.createdAt).getTime() : now;
    const nameParts = name.trim().split(/\s+/);
    items.push({
      id: r.commerceContentId || r.id || r.reportId || `watch-${key}`,
      name,
      firstName: nameParts[0] || name,
      lastName: nameParts.slice(1).join(' ') || '',
      city,
      state,
      lastUpdated: createdMs,
      // hasChanges/newRecords come from alerts tied to this person; see
      // mergeAlertsIntoWatchlist below. Default to false here.
      hasChanges: false,
      newRecords: 0,
      commerceContentId: r.commerceContentId || r.id || r.reportId,
    });
    if (items.length >= limit) break;
  }
  return items;
}

// Turn real BC alerts into records-feed rows the feed widget already understands.
// alert shape varies; we pull title/createdAt and surface it as a 'record' entry.
export function buildRecordsFeedFromAlerts(alerts, limit = 12) {
  if (!Array.isArray(alerts)) return [];
  return alerts.slice(0, limit).map((a, i) => {
    const title =
      a.title ||
      a.subject ||
      a.message ||
      a.body ||
      a.data?.title ||
      'New activity on your profile';
    const ts = a.createdAt ? new Date(a.createdAt).getTime() : Date.now() - i * 60 * 1000;
    const kind = String(a.type || a.category || '').toLowerCase();
    const feedType = kind.includes('removal')
      ? 'removal'
      : kind.includes('alert')
      ? 'alert'
      : 'record';
    return {
      id: a._id || a.id || `alert-${i}`,
      type: feedType,
      recordKind: a.recordKind || 'record',
      title,
      source: a.source || a.sourceName || 'IDLookup',
      sourceCode: a.sourceCode || '',
      timestamp: ts,
    };
  });
}

// Exposure score derived from real BC data. Counts populated fields across the
// user's reports — more data found in public records = lower score.
// Returns null when we have no signal (no reports yet); caller should show the
// "Run a search for yourself" prompt instead.
export function computeExposureFromReports(reports) {
  if (!Array.isArray(reports) || reports.length === 0) return null;
  // Aggregate field counts across all reports the user has pulled.
  let addresses = 0;
  let phones = 0;
  let emails = 0;
  let relatives = 0;
  let sources = 0;
  for (const r of reports) {
    const identity = r.data?.identities?.[0] || r.identity || r;
    const contact = r.data?.fullContact || r.fullContact || {};
    if (Array.isArray(identity?.addressList)) addresses += identity.addressList.length;
    if (Array.isArray(contact?.phones)) phones += contact.phones.length;
    if (Array.isArray(contact?.emails)) emails += contact.emails.length;
    if (Array.isArray(contact?.relatives)) relatives += contact.relatives.length;
    sources += 1; // one source per pulled report
  }
  // If all aggregates are 0 we still have no real signal.
  const total = addresses + phones + emails + relatives;
  if (total === 0) return null;

  const raw = 100 - addresses * 3 - phones * 4 - emails * 2 - relatives * 1;
  const score = Math.max(35, Math.min(95, raw));
  return {
    score,
    lastMonth: score, // no history yet — held flat
    delta: 0,
    letter: score >= 80 ? 'A' : score >= 70 ? 'B' : score >= 60 ? 'C' : score >= 50 ? 'D' : 'F',
    factors: { addresses, phones, emails, relatives },
    totalRecords: total,
    sources,
    isReal: true,
  };
}

// ---------- Privacy exposure score ----------
// Produces a deterministic mock score 40-78, plus factor breakdown. Real
// implementation would derive from records.length / sources.length.
export function computeExposureScore(seed) {
  const rand = mulberry32(seed + 555555);
  const addresses = 3 + Math.floor(rand() * 8);
  const phones = 2 + Math.floor(rand() * 5);
  const emails = 1 + Math.floor(rand() * 4);
  const relatives = 4 + Math.floor(rand() * 9);
  const sources = 6 + Math.floor(rand() * 10);

  // Base 100, subtract weighted exposure factors
  const raw = 100 - addresses * 3 - phones * 4 - emails * 2 - relatives * 1;
  const score = Math.max(35, Math.min(88, raw + Math.floor(rand() * 10) - 5));

  // Month-over-month delta (-8 to +8)
  const lastMonth = Math.max(30, Math.min(92, score + Math.floor(rand() * 17) - 8));
  const delta = score - lastMonth;

  const totalRecords = addresses + phones + emails + relatives;

  return {
    score,
    lastMonth,
    delta,
    letter: score >= 80 ? 'A' : score >= 70 ? 'B' : score >= 60 ? 'C' : score >= 50 ? 'D' : 'F',
    factors: {
      addresses,
      phones,
      emails,
      relatives,
    },
    totalRecords,
    sources,
  };
}
