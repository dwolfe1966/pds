// Realistic teaser cards for the thin-match preview. We show the REAL searched
// name + state and fill the other attributes (age, current city, relatives, record
// counts) with plausible, deterministically-seeded values so the preview reads like
// "here are people we found" rather than blurred placeholders. Seeded by name+state
// so the same search always renders the same cards (stable across renders/refresh).
// These are clearly framed as a PREVIEW in the UI — full/verified records are gated.

const STATE_NAMES = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado',
  CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho',
  IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana',
  ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi',
  MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma',
  OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota',
  TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington',
  WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming', DC: 'Washington, DC',
};

// Major cities as "City, ST" — filtered by the searched state for realism.
const CITIES = [
  'New York, NY', 'Buffalo, NY', 'Rochester, NY', 'Albany, NY', 'Los Angeles, CA', 'San Diego, CA',
  'San Jose, CA', 'San Francisco, CA', 'Fresno, CA', 'Sacramento, CA', 'Long Beach, CA', 'Oakland, CA',
  'Chicago, IL', 'Aurora, IL', 'Naperville, IL', 'Springfield, IL', 'Houston, TX', 'San Antonio, TX',
  'Dallas, TX', 'Austin, TX', 'Fort Worth, TX', 'El Paso, TX', 'Arlington, TX', 'Plano, TX',
  'Phoenix, AZ', 'Tucson, AZ', 'Mesa, AZ', 'Chandler, AZ', 'Scottsdale, AZ', 'Philadelphia, PA',
  'Pittsburgh, PA', 'Allentown, PA', 'Erie, PA', 'Jacksonville, FL', 'Miami, FL', 'Tampa, FL',
  'Orlando, FL', 'St. Petersburg, FL', 'Fort Lauderdale, FL', 'Columbus, OH', 'Cleveland, OH',
  'Cincinnati, OH', 'Toledo, OH', 'Akron, OH', 'Charlotte, NC', 'Raleigh, NC', 'Greensboro, NC',
  'Durham, NC', 'Indianapolis, IN', 'Fort Wayne, IN', 'Evansville, IN', 'Seattle, WA', 'Spokane, WA',
  'Tacoma, WA', 'Vancouver, WA', 'Denver, CO', 'Colorado Springs, CO', 'Aurora, CO', 'Boston, MA',
  'Worcester, MA', 'Springfield, MA', 'Nashville, TN', 'Memphis, TN', 'Knoxville, TN', 'Chattanooga, TN',
  'Baltimore, MD', 'Columbia, MD', 'Germantown, MD', 'Oklahoma City, OK', 'Tulsa, OK', 'Norman, OK',
  'Portland, OR', 'Eugene, OR', 'Salem, OR', 'Las Vegas, NV', 'Henderson, NV', 'Reno, NV',
  'Louisville, KY', 'Lexington, KY', 'Detroit, MI', 'Grand Rapids, MI', 'Warren, MI', 'Ann Arbor, MI',
  'Milwaukee, WI', 'Madison, WI', 'Green Bay, WI', 'Albuquerque, NM', 'Las Cruces, NM',
  'Kansas City, MO', 'St. Louis, MO', 'Springfield, MO', 'Atlanta, GA', 'Augusta, GA', 'Savannah, GA',
  'Omaha, NE', 'Lincoln, NE', 'Newark, NJ', 'Jersey City, NJ', 'Trenton, NJ', 'Virginia Beach, VA',
  'Norfolk, VA', 'Richmond, VA', 'Arlington, VA', 'Birmingham, AL', 'Montgomery, AL', 'Mobile, AL',
  'Little Rock, AR', 'Fayetteville, AR', 'New Orleans, LA', 'Baton Rouge, LA', 'Shreveport, LA',
  'Wichita, KS', 'Overland Park, KS', 'Bridgeport, CT', 'Hartford, CT', 'New Haven, CT',
  'Salt Lake City, UT', 'Provo, UT', 'Charleston, SC', 'Columbia, SC', 'Des Moines, IA', 'Cedar Rapids, IA',
  'Boise, ID', 'Providence, RI', 'Manchester, NH', 'Portland, ME', 'Billings, MT', 'Sioux Falls, SD',
  'Fargo, ND', 'Jackson, MS', 'Charleston, WV', 'Cheyenne, WY', 'Wilmington, DE', 'Honolulu, HI',
  'Burlington, VT', 'Washington, DC',
];

const REL_FIRST = [
  'Mary', 'James', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda', 'David', 'Barbara', 'William',
  'Susan', 'Richard', 'Jessica', 'Joseph', 'Sarah', 'Thomas', 'Karen', 'Christopher', 'Nancy', 'Daniel',
  'Lisa', 'Matthew', 'Betty', 'Anthony', 'Sandra', 'Mark', 'Ashley', 'Donald', 'Kimberly', 'Steven',
  'Emily', 'Andrew', 'Donna', 'Joshua', 'Michelle', 'Kevin', 'Carol', 'Brian', 'Amanda', 'George',
];
const REL_LAST = [
  'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez',
  'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Thompson',
];

const proper = (s) => String(s || '').toLowerCase().replace(/(^|[\s'-])([a-z])/g, (m, sep, c) => sep + c.toUpperCase());

// Deterministic seeded PRNG (mulberry32 from a string hash).
function seededRng(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

function citiesInState(stCode) {
  const hits = CITIES.filter((c) => c.endsWith(`, ${stCode}`)).map((c) => c.split(',')[0]);
  return hits.length ? hits : [STATE_NAMES[stCode] || 'this area'];
}

/**
 * Build 3 plausible preview cards for a name (+ optional state). Real name + state,
 * seeded-random age / current city / relatives / record counts.
 */
export function buildPreviewCards(searchType, query = {}) {
  const first = proper(query.firstName || '');
  const last = proper(query.lastName || '');
  const fullName = [first, last].filter(Boolean).join(' ') || 'This Person';
  const stCode = String(query.state || '').toUpperCase();
  const stName = STATE_NAMES[stCode] || 'the United States';
  const cities = citiesInState(stCode);

  const rng = seededRng(`${fullName}|${stCode}`);
  const pick = (arr) => arr[Math.floor(rng() * arr.length)] || arr[0];

  const cards = [];
  const usedAges = new Set();
  const usedCities = new Set();
  for (let i = 0; i < 3; i++) {
    let age;
    do { age = 24 + Math.floor(rng() * 52); } while (usedAges.has(age));
    usedAges.add(age);
    let city;
    let guard = 0;
    do { city = pick(cities); guard++; } while (usedCities.has(city) && guard < 6);
    usedCities.add(city);

    const relCount = 2 + Math.floor(rng() * 2); // 2–3
    const relatives = [];
    for (let r = 0; r < relCount; r++) {
      const sameSurname = rng() < 0.6; // most relatives share the surname
      relatives.push(`${pick(REL_FIRST)} ${sameSurname && last ? last : pick(REL_LAST)}`);
    }

    cards.push({
      id: `preview-${i}`,
      fullName,
      age,
      city,
      stCode,
      stName,
      relatives,
      prevAddresses: 2 + Math.floor(rng() * 6), // 2–7
      phones: 1 + Math.floor(rng() * 3),        // 1–3
      emails: 1 + Math.floor(rng() * 3),        // 1–3
    });
  }
  return { cards, fullName, stName, stCode };
}
