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
export function maskName(name) {
  if (!name) return '***';
  return name
    .split(' ')
    .map((part) => {
      if (part.length <= 1) return part + '***';
      return part[0] + '*'.repeat(Math.max(3, part.length - 1));
    })
    .join(' ');
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
// The full broker directory (84 brokers in the real product). Short codes are
// used as "logo" stand-ins on the dashboard tracker.
export const DATA_BROKERS = [
  { name: 'WhitePages', code: 'WP' },
  { name: 'Spokeo', code: 'SP' },
  { name: 'BeenVerified', code: 'BV' },
  { name: 'TruePeopleSearch', code: 'TP' },
  { name: 'Intelius', code: 'IN' },
  { name: 'PeopleFinders', code: 'PF' },
  { name: 'Radaris', code: 'RS' },
  { name: 'FastPeopleSearch', code: 'FP' },
  { name: 'MyLife', code: 'ML' },
  { name: 'PeopleSearchNow', code: 'PS' },
  { name: 'CheckPeople', code: 'CP' },
  { name: 'InfoTracer', code: 'IT' },
  { name: 'PublicRecords360', code: 'PR' },
  { name: 'USSearch', code: 'US' },
  { name: 'ZabaSearch', code: 'ZB' },
  { name: 'AnyWho', code: 'AW' },
  { name: 'BackgroundAlert', code: 'BA' },
  { name: 'InstantCheckmate', code: 'IC' },
  { name: 'Nuwber', code: 'NW' },
  { name: 'PeekYou', code: 'PY' },
  { name: 'ClustrMaps', code: 'CM' },
  { name: 'Addresses', code: 'AD' },
  { name: 'FamilyTreeNow', code: 'FT' },
  { name: 'SmartBackgroundChecks', code: 'SB' },
];

export const TOTAL_BROKER_COUNT = 84;

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
