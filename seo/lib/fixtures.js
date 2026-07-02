// Fixture person records, shaped like the consumer app's BC teaser-adapter output
// (adaptTeaserResponse) plus the report-tier fields the template will render once
// BC supplies them live (SEO ASK 0). Names/addresses are synthetic.
//
// Keyed by OUR public id (lib/ids.js) — never a raw BC extId.

export const PEOPLE = {
  p0000000001: {
    id: 'p0000000001',
    firstName: 'David',
    lastName: 'Aab',
    fullName: 'David J Aab',
    aliases: ['David James Aab', 'Dave J Aab'],
    age: 68,
    city: 'Cumming',
    state: 'GA',
    priorCities: [
      { city: 'Stone Mountain', state: 'GA' },
      { city: 'Brookhaven', state: 'GA' },
    ],
    // Full street address — indexed in Person JSON-LD, obfuscated in the visible
    // teaser (locked decision §0.2: aggressive Spokeo model, owner-validated).
    streetAddress: '2700 Fleetwood Dr',
    postalCode: '30041',
    counts: { addresses: 3, phones: 10, emails: 16 },
    relatives: [
      { id: 'p0000000002', fullName: 'Linda Aab' },
      { id: 'p0000000003', fullName: 'Susan Aab' },
    ],
    employers: ['Aab Plumbing'],
    nameStats: { total: 3, states: ['GA', 'NY'] },
  },
  p0000000002: {
    id: 'p0000000002',
    firstName: 'Linda',
    lastName: 'Aab',
    fullName: 'Linda M Aab',
    aliases: ['Linda Marie Aab'],
    age: 64,
    city: 'Cumming',
    state: 'GA',
    priorCities: [{ city: 'Atlanta', state: 'GA' }],
    streetAddress: '2700 Fleetwood Dr',
    postalCode: '30041',
    counts: { addresses: 2, phones: 6, emails: 9 },
    relatives: [{ id: 'p0000000001', fullName: 'David J Aab' }],
    employers: [],
    nameStats: { total: 2, states: ['GA'] },
  },
  p0000000003: {
    id: 'p0000000003',
    firstName: 'Susan',
    lastName: 'Aab',
    fullName: 'Susan Aab',
    aliases: [],
    age: 41,
    city: 'Roswell',
    state: 'GA',
    priorCities: [],
    streetAddress: '11 Maple Ct',
    postalCode: '30075',
    counts: { addresses: 1, phones: 3, emails: 4 },
    relatives: [{ id: 'p0000000001', fullName: 'David J Aab' }],
    employers: [],
    nameStats: { total: 2, states: ['GA'] },
  },
};
