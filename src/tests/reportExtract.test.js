const { extractAll, formatDateRange, dedup, fmtPhone, residenceDuration } = require('../utils/reportExtract');

// ─── formatDateRange ──────────────────────────────────────────────────────

describe('formatDateRange', () => {
  test('returns dash when both values are null/undefined', () => {
    expect(formatDateRange(null, null)).toBe('—');
    expect(formatDateRange(undefined, undefined)).toBe('—');
  });

  test('returns "Since ..." when only first date is provided', () => {
    expect(formatDateRange('2020', null)).toBe('Since 2020');
  });

  test('returns "Until ..." when only last date is provided', () => {
    expect(formatDateRange(null, '2023')).toBe('Until 2023');
  });

  test('returns range when both dates differ', () => {
    expect(formatDateRange('2018', '2023')).toBe('2018 – 2023');
  });

  test('returns "Since ..." when both dates are the same', () => {
    expect(formatDateRange('2020', '2020')).toBe('Since 2020');
  });

  test('handles YYYYMMDD format', () => {
    expect(formatDateRange('20190315', '20230801')).toBe('Mar 2019 – Aug 2023');
  });

  test('handles YYYYMMDD with only first date', () => {
    expect(formatDateRange('20210601', null)).toBe('Since Jun 2021');
  });

  test('handles YYYYMMDD with only last date', () => {
    expect(formatDateRange(null, '20221215')).toBe('Until Dec 2022');
  });

  test('handles YYYYMMDD with invalid month (>12) — falls back to year only', () => {
    expect(formatDateRange('20201300', null)).toBe('Since 2020');
  });

  test('handles YYYYMMDD with month 0 — falls back to year only', () => {
    expect(formatDateRange('20200000', null)).toBe('Since 2020');
  });

  test('handles YYYY format', () => {
    expect(formatDateRange('2015', '2020')).toBe('2015 – 2020');
  });

  test('handles ISO date strings', () => {
    const result = formatDateRange('2021-06-15T12:00:00Z', '2023-11-15T12:00:00Z');
    expect(result).toBe('Jun 2021 – Nov 2023');
  });

  test('handles mixed formats (YYYY + YYYYMMDD)', () => {
    expect(formatDateRange('2018', '20230615')).toBe('2018 – Jun 2023');
  });

  test('returns dash for unparseable strings', () => {
    expect(formatDateRange('not-a-date', null)).toBe('—');
  });

  test('handles numeric input (not string)', () => {
    expect(formatDateRange(2020, null)).toBe('Since 2020');
  });
});

// ─── fmtPhone ─────────────────────────────────────────────────────────────

describe('fmtPhone', () => {
  test('formats 10-digit number', () => {
    expect(fmtPhone('5551234567')).toBe('(555) 123-4567');
  });

  test('formats 11-digit number starting with 1', () => {
    expect(fmtPhone('15551234567')).toBe('+1 (555) 123-4567');
  });

  test('returns raw value for other lengths', () => {
    expect(fmtPhone('12345')).toBe('12345');
  });

  test('strips non-digit characters before formatting', () => {
    expect(fmtPhone('(555) 123-4567')).toBe('(555) 123-4567');
  });

  test('returns empty string for falsy input', () => {
    expect(fmtPhone(null)).toBe('');
    expect(fmtPhone(undefined)).toBe('');
    expect(fmtPhone('')).toBe('');
  });

  test('handles numeric input', () => {
    expect(fmtPhone(5551234567)).toBe('(555) 123-4567');
  });
});

// ─── dedup ────────────────────────────────────────────────────────────────

describe('dedup', () => {
  test('removes duplicates based on key function', () => {
    const items = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
      { id: 1, name: 'Alice Duplicate' },
    ];
    const result = dedup(items, item => item.id);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Alice');
    expect(result[1].name).toBe('Bob');
  });

  test('keeps first occurrence', () => {
    const items = [
      { val: 'first' },
      { val: 'second' },
    ];
    const result = dedup(items, () => 'same-key');
    expect(result).toHaveLength(1);
    expect(result[0].val).toBe('first');
  });

  test('returns empty array for empty input', () => {
    expect(dedup([], x => x)).toEqual([]);
  });
});

// ─── extractAll ───────────────────────────────────────────────────────────

describe('extractAll', () => {
  // Helper to build a minimal report
  const makeReport = (overrides = {}) => ({
    identities: [],
    fullContact: null,
    familyWatchdog: null,
    ...overrides,
  });

  const makePrimaryIdentity = (overrides = {}) => ({
    nameList: [],
    dobList: [],
    addressList: [],
    phoneList: [],
    emailList: [],
    relationList: [],
    jobList: [],
    educationList: [],
    socialList: [],
    ...overrides,
  });

  // ── Name / alias extraction ──

  describe('name and alias extraction', () => {
    test('extracts fullName from first nameList entry', () => {
      const report = makeReport({
        identities: [makePrimaryIdentity({
          nameList: [{ data: 'John Smith' }],
        })],
      });
      const data = extractAll(report);
      expect(data.fullName).toBe('John Smith');
      expect(data.aliases).toEqual([]);
    });

    test('extracts aliases from nameList entries beyond first', () => {
      const report = makeReport({
        identities: [makePrimaryIdentity({
          nameList: [
            { data: 'John Smith' },
            { data: 'Johnny S' },
            { data: 'J. Smith' },
          ],
        })],
      });
      const data = extractAll(report);
      expect(data.fullName).toBe('John Smith');
      expect(data.aliases).toEqual(['Johnny S', 'J. Smith']);
    });

    test('returns "Unknown" when nameList is empty', () => {
      const report = makeReport({ identities: [makePrimaryIdentity()] });
      const data = extractAll(report);
      expect(data.fullName).toBe('Unknown');
    });

    test('filters out falsy alias entries', () => {
      const report = makeReport({
        identities: [makePrimaryIdentity({
          nameList: [
            { data: 'John Smith' },
            { data: '' },
            { data: null },
            { data: 'Valid Alias' },
          ],
        })],
      });
      const data = extractAll(report);
      expect(data.aliases).toEqual(['Valid Alias']);
    });
  });

  // ── DOB / age ──

  describe('dob and age extraction', () => {
    test('extracts dob from dobList', () => {
      const report = makeReport({
        identities: [makePrimaryIdentity({
          dobList: [{ date: { data: '01/15/1985' }, age: '39' }],
        })],
      });
      const data = extractAll(report);
      expect(data.dob).toBe('01/15/1985');
      expect(data.age).toBe('39');
    });

    test('ignores XX/XX/XXXX placeholder dob', () => {
      const report = makeReport({
        identities: [makePrimaryIdentity({
          dobList: [{ date: { data: 'XX/XX/XXXX' }, age: '35' }],
        })],
      });
      const data = extractAll(report);
      expect(data.dob).toBe('');
      expect(data.age).toBe('35');
    });

    test('uses ageRange over dobList age when both exist', () => {
      const report = makeReport({
        identities: [makePrimaryIdentity({
          ageRange: '35-40',
          dobList: [{ date: { data: '03/22/1987' }, age: '37' }],
        })],
      });
      const data = extractAll(report);
      expect(data.age).toBe('35-40');
    });

    test('falls back to dobList age when no ageRange', () => {
      const report = makeReport({
        identities: [makePrimaryIdentity({
          dobList: [{ age: '42' }],
        })],
      });
      const data = extractAll(report);
      expect(data.age).toBe('42');
    });

    test('returns empty age and dob when dobList is empty', () => {
      const report = makeReport({ identities: [makePrimaryIdentity()] });
      const data = extractAll(report);
      expect(data.dob).toBe('');
      expect(data.age).toBe('');
    });
  });

  // ── Address dedup ──

  describe('address extraction and dedup', () => {
    test('extracts addresses from primary identity', () => {
      const report = makeReport({
        identities: [makePrimaryIdentity({
          addressList: [
            { street: '123 Main St', city: 'Denver', state: 'CO', zip: '80202' },
          ],
        })],
      });
      const data = extractAll(report);
      expect(data.addresses).toHaveLength(1);
      expect(data.addresses[0].street).toBe('123 Main St');
      expect(data.currentLocation).toBe('Denver, CO');
    });

    test('merges addresses from identity and fullContact', () => {
      const report = makeReport({
        identities: [makePrimaryIdentity({
          addressList: [
            { street: '123 Main St', city: 'Denver', state: 'CO', zip: '80202' },
          ],
        })],
        fullContact: {
          addresses: [
            { street: '456 Oak Ave', city: 'Boulder', state: 'CO', zip: '80301' },
          ],
        },
      });
      const data = extractAll(report);
      expect(data.addresses).toHaveLength(2);
    });

    test('deduplicates addresses by city|state|zip|street', () => {
      const report = makeReport({
        identities: [makePrimaryIdentity({
          addressList: [
            { street: '123 Main St', city: 'Denver', state: 'CO', zip: '80202' },
          ],
        })],
        fullContact: {
          addresses: [
            { street: '123 Main St', city: 'Denver', state: 'CO', zip: '80202' },
          ],
        },
      });
      const data = extractAll(report);
      expect(data.addresses).toHaveLength(1);
    });

    test('uses "address" field as fallback for "street"', () => {
      const report = makeReport({
        identities: [makePrimaryIdentity({
          addressList: [
            { address: '789 Elm Rd', city: 'Austin', state: 'TX', zip: '73301' },
          ],
        })],
      });
      const data = extractAll(report);
      expect(data.addresses[0].street).toBe('789 Elm Rd');
    });

    test('extracts firstSeen/lastSeen from meta or direct fields', () => {
      const report = makeReport({
        identities: [makePrimaryIdentity({
          addressList: [
            {
              street: '123 Main St', city: 'Denver', state: 'CO', zip: '80202',
              meta: { firstSeen: '20180101' },
              lastSeen: '20230601',
            },
          ],
        })],
      });
      const data = extractAll(report);
      expect(data.addresses[0].firstSeen).toBe('20180101');
      expect(data.addresses[0].lastSeen).toBe('20230601');
    });

    test('returns empty currentLocation when no addresses', () => {
      const report = makeReport({ identities: [makePrimaryIdentity()] });
      const data = extractAll(report);
      expect(data.currentLocation).toBe('');
      expect(data.addresses).toEqual([]);
    });
  });

  // ── Phone dedup ──

  describe('phone extraction and dedup', () => {
    test('extracts phones from identity phoneList', () => {
      const report = makeReport({
        identities: [makePrimaryIdentity({
          phoneList: [
            { number: '5551234567', type: 'mobile', carrier: 'Verizon' },
          ],
        })],
      });
      const data = extractAll(report);
      expect(data.phones).toHaveLength(1);
      expect(data.phones[0].number).toBe('5551234567');
      expect(data.phones[0].type).toBe('mobile');
    });

    test('merges phones from identity and fullContact', () => {
      const report = makeReport({
        identities: [makePrimaryIdentity({
          phoneList: [{ number: '5551234567' }],
        })],
        fullContact: {
          phones: [{ number: '5559876543' }],
        },
      });
      const data = extractAll(report);
      expect(data.phones).toHaveLength(2);
    });

    test('deduplicates phones by digits only', () => {
      const report = makeReport({
        identities: [makePrimaryIdentity({
          phoneList: [{ number: '555-123-4567' }],
        })],
        fullContact: {
          phones: [{ number: '(555) 123-4567' }],
        },
      });
      const data = extractAll(report);
      expect(data.phones).toHaveLength(1);
    });

    test('uses "value" as fallback for "number"', () => {
      const report = makeReport({
        identities: [makePrimaryIdentity({
          phoneList: [{ value: '5551112222' }],
        })],
      });
      const data = extractAll(report);
      expect(data.phones[0].number).toBe('5551112222');
    });

    test('uses phoneType as fallback for type', () => {
      const report = makeReport({
        identities: [makePrimaryIdentity({
          phoneList: [{ number: '5551234567', phoneType: 'landline' }],
        })],
      });
      const data = extractAll(report);
      expect(data.phones[0].type).toBe('landline');
    });

    test('filters out entries with no number', () => {
      const report = makeReport({
        identities: [makePrimaryIdentity({
          phoneList: [{ type: 'mobile' }, { number: '5551234567' }],
        })],
      });
      const data = extractAll(report);
      expect(data.phones).toHaveLength(1);
    });

    test('reads fullContact.phoneNumbers as alternate key', () => {
      const report = makeReport({
        identities: [makePrimaryIdentity()],
        fullContact: {
          phoneNumbers: [{ number: '5559998888' }],
        },
      });
      const data = extractAll(report);
      expect(data.phones).toHaveLength(1);
      expect(data.phones[0].number).toBe('5559998888');
    });
  });

  // ── Email dedup ──

  describe('email extraction and dedup', () => {
    test('extracts emails from identity emailList', () => {
      const report = makeReport({
        identities: [makePrimaryIdentity({
          emailList: [{ address: 'john@example.com', type: 'personal' }],
        })],
      });
      const data = extractAll(report);
      expect(data.emails).toHaveLength(1);
      expect(data.emails[0].address).toBe('john@example.com');
    });

    test('deduplicates emails case-insensitively', () => {
      const report = makeReport({
        identities: [makePrimaryIdentity({
          emailList: [{ address: 'John@Example.com' }],
        })],
        fullContact: {
          emails: [{ address: 'john@example.com' }],
        },
      });
      const data = extractAll(report);
      expect(data.emails).toHaveLength(1);
    });

    test('uses "email" or "value" as fallback for "address"', () => {
      const report = makeReport({
        identities: [makePrimaryIdentity({
          emailList: [
            { email: 'a@b.com' },
            { value: 'c@d.com' },
          ],
        })],
      });
      const data = extractAll(report);
      expect(data.emails).toHaveLength(2);
      expect(data.emails[0].address).toBe('a@b.com');
      expect(data.emails[1].address).toBe('c@d.com');
    });

    test('reads fullContact.emailAddresses as alternate key', () => {
      const report = makeReport({
        identities: [makePrimaryIdentity()],
        fullContact: {
          emailAddresses: [{ address: 'alt@example.com' }],
        },
      });
      const data = extractAll(report);
      expect(data.emails).toHaveLength(1);
    });

    test('filters out entries with no address', () => {
      const report = makeReport({
        identities: [makePrimaryIdentity({
          emailList: [{ type: 'work' }, { address: 'valid@email.com' }],
        })],
      });
      const data = extractAll(report);
      expect(data.emails).toHaveLength(1);
    });
  });

  // ── Secondary identities ──

  describe('secondary identities', () => {
    test('returns identities beyond the first as secondaryIdentities', () => {
      const report = makeReport({
        identities: [
          makePrimaryIdentity({ nameList: [{ data: 'Primary Person' }] }),
          { nameList: [{ data: 'Secondary Person' }] },
          { nameList: [{ data: 'Tertiary Person' }] },
        ],
      });
      const data = extractAll(report);
      expect(data.secondaryIdentities).toHaveLength(2);
      expect(data.secondaryIdentities[0].nameList[0].data).toBe('Secondary Person');
    });

    test('returns empty array when only one identity', () => {
      const report = makeReport({
        identities: [makePrimaryIdentity()],
      });
      const data = extractAll(report);
      expect(data.secondaryIdentities).toEqual([]);
    });
  });

  // ── Offenders / Family Watchdog ──

  describe('offenders extraction', () => {
    test('extracts offenders from familyWatchdog.offenders', () => {
      const report = makeReport({
        familyWatchdog: {
          offenders: [
            { name: 'Offender One', distance: '0.5 mi' },
          ],
        },
      });
      const data = extractAll(report);
      expect(data.offenders).toHaveLength(1);
      expect(data.offenders[0].name).toBe('Offender One');
    });

    test('handles familyWatchdog as array directly', () => {
      const report = makeReport({
        familyWatchdog: [
          { name: 'Offender A' },
          { name: 'Offender B' },
        ],
      });
      const data = extractAll(report);
      expect(data.offenders).toHaveLength(2);
    });

    test('returns empty array when no familyWatchdog data', () => {
      const report = makeReport();
      const data = extractAll(report);
      expect(data.offenders).toEqual([]);
    });
  });

  // ── Employment ──

  describe('employment extraction', () => {
    test('extracts jobs from identity jobList', () => {
      const report = makeReport({
        identities: [makePrimaryIdentity({
          jobList: [
            { employer: 'Acme Corp', title: 'Engineer', city: 'Denver', state: 'CO' },
          ],
        })],
      });
      const data = extractAll(report);
      expect(data.jobs).toHaveLength(1);
      expect(data.jobs[0].employer).toBe('Acme Corp');
      expect(data.jobs[0].title).toBe('Engineer');
    });

    test('falls back to fullContact.employments when no jobList', () => {
      const identity = makePrimaryIdentity();
      delete identity.jobList;
      const report = makeReport({
        identities: [identity],
        fullContact: {
          employments: [
            { company: 'BigCo', position: 'Manager' },
          ],
        },
      });
      const data = extractAll(report);
      expect(data.jobs).toHaveLength(1);
      expect(data.jobs[0].employer).toBe('BigCo');
      expect(data.jobs[0].title).toBe('Manager');
    });

    test('filters out entries with no employer', () => {
      const report = makeReport({
        identities: [makePrimaryIdentity({
          jobList: [
            { title: 'No Employer' },
            { employer: 'Valid Co' },
          ],
        })],
      });
      const data = extractAll(report);
      expect(data.jobs).toHaveLength(1);
    });

    test('maps startDate/endDate alternatives', () => {
      const report = makeReport({
        identities: [makePrimaryIdentity({
          jobList: [
            { employer: 'X', startDate: '2020', endDate: '2023' },
          ],
        })],
      });
      const data = extractAll(report);
      expect(data.jobs[0].start).toBe('2020');
      expect(data.jobs[0].end).toBe('2023');
    });
  });

  // ── Education ──

  describe('education extraction', () => {
    test('extracts education from identity educationList', () => {
      const report = makeReport({
        identities: [makePrimaryIdentity({
          educationList: [
            { school: 'MIT', degree: 'BS Computer Science' },
          ],
        })],
      });
      const data = extractAll(report);
      expect(data.education).toHaveLength(1);
      expect(data.education[0].school).toBe('MIT');
    });

    test('falls back to fullContact.educations', () => {
      const identity = makePrimaryIdentity();
      delete identity.educationList;
      const report = makeReport({
        identities: [identity],
        fullContact: {
          educations: [
            { organization: 'Stanford', major: 'Physics' },
          ],
        },
      });
      const data = extractAll(report);
      expect(data.education).toHaveLength(1);
      expect(data.education[0].school).toBe('Stanford');
      expect(data.education[0].degree).toBe('Physics');
    });
  });

  // ── Social ──

  describe('social extraction', () => {
    test('extracts social profiles from identity', () => {
      const report = makeReport({
        identities: [makePrimaryIdentity({
          socialList: [
            { network: 'LinkedIn', url: 'https://linkedin.com/in/jsmith', username: 'jsmith' },
          ],
        })],
      });
      const data = extractAll(report);
      expect(data.social).toHaveLength(1);
      expect(data.social[0].network).toBe('LinkedIn');
    });

    test('merges social from fullContact.socialProfiles', () => {
      const report = makeReport({
        identities: [makePrimaryIdentity({
          socialList: [{ network: 'LinkedIn', url: 'https://linkedin.com/in/jsmith' }],
        })],
        fullContact: {
          socialProfiles: [{ network: 'Twitter', url: 'https://twitter.com/jsmith' }],
        },
      });
      const data = extractAll(report);
      expect(data.social).toHaveLength(2);
    });

    test('deduplicates social by url (case-insensitive)', () => {
      const report = makeReport({
        identities: [makePrimaryIdentity({
          socialList: [{ network: 'LinkedIn', url: 'https://LinkedIn.com/in/jsmith' }],
        })],
        fullContact: {
          socialProfiles: [{ network: 'LinkedIn', url: 'https://linkedin.com/in/jsmith' }],
        },
      });
      const data = extractAll(report);
      expect(data.social).toHaveLength(1);
    });
  });

  // ── Relatives ──

  describe('relatives extraction', () => {
    test('extracts relatives from identity relationList', () => {
      const report = makeReport({
        identities: [makePrimaryIdentity({
          relationList: [
            { name: 'Jane Smith', relation: 'spouse', age: '38', city: 'Denver', state: 'CO' },
          ],
        })],
      });
      const data = extractAll(report);
      expect(data.relatives).toHaveLength(1);
      expect(data.relatives[0].name).toBe('Jane Smith');
      expect(data.relatives[0].relationship).toBe('spouse');
      expect(data.relatives[0].location).toBe('Denver, CO');
    });

    test('deduplicates relatives by name case-insensitively', () => {
      const report = makeReport({
        identities: [makePrimaryIdentity({
          relationList: [{ name: 'Jane Smith', relation: 'spouse' }],
        })],
        fullContact: {
          relatives: [{ name: 'jane smith', relationship: 'wife' }],
        },
      });
      const data = extractAll(report);
      expect(data.relatives).toHaveLength(1);
    });

    test('reads fullContact.associates as alternate key', () => {
      const report = makeReport({
        identities: [makePrimaryIdentity()],
        fullContact: {
          associates: [{ name: 'Bob Jones', type: 'neighbor' }],
        },
      });
      const data = extractAll(report);
      expect(data.relatives).toHaveLength(1);
      expect(data.relatives[0].relationship).toBe('neighbor');
    });
  });

  // ── Gender / Provider ──

  describe('gender and provider', () => {
    test('extracts gender from primary identity', () => {
      const report = makeReport({
        identities: [makePrimaryIdentity({ gender: 'Male' })],
      });
      expect(extractAll(report).gender).toBe('Male');
    });

    test('extracts provider from meta', () => {
      const report = makeReport({
        identities: [makePrimaryIdentity({ meta: { provider: 'DataSource' } })],
      });
      expect(extractAll(report).provider).toBe('DataSource');
    });

    test('returns empty strings when not present', () => {
      const report = makeReport({ identities: [makePrimaryIdentity()] });
      const data = extractAll(report);
      expect(data.gender).toBe('');
      expect(data.provider).toBe('');
    });
  });

  // ── Empty / minimal report ──

  describe('edge cases', () => {
    test('handles completely empty report', () => {
      const data = extractAll({});
      expect(data.fullName).toBe('Unknown');
      expect(data.aliases).toEqual([]);
      expect(data.dob).toBe('');
      expect(data.age).toBe('');
      expect(data.addresses).toEqual([]);
      expect(data.phones).toEqual([]);
      expect(data.emails).toEqual([]);
      expect(data.relatives).toEqual([]);
      expect(data.jobs).toEqual([]);
      expect(data.education).toEqual([]);
      expect(data.social).toEqual([]);
      expect(data.offenders).toEqual([]);
      expect(data.secondaryIdentities).toEqual([]);
    });

    test('handles report with empty identities array', () => {
      const data = extractAll({ identities: [] });
      expect(data.fullName).toBe('Unknown');
    });
  });

  // ── Expanded fields (2026-06-07 gap fix): per-address county/zip4, criminal
  //    incarceration detail + mugshot, nested property shape, financial extras ──
  describe('expanded report fields', () => {
    test('address keeps county, zip4, apt', () => {
      const report = makeReport({ identities: [makePrimaryIdentity({
        addressList: [{ complete: '1 MAIN ST', city: 'DENVER', state: 'CO', zip: '80014', zip4: '3437', county: 'DENVER', aptName: 'APT', aptNum: '4B' }],
      })] });
      const a = extractAll(report).addresses[0];
      expect(a.county).toBe('DENVER');
      expect(a.zip4).toBe('3437');
      expect(a.apt).toBe('APT 4B');
    });

    test('residenceDuration approximates years/months from YYYYMMDD', () => {
      expect(residenceDuration(20230101, 20260101)).toBe('~3.0 yrs');
      expect(residenceDuration(20251101, 20260518)).toBe('~7 mo');
      expect(residenceDuration(20000101, 20260101)).toBe('~26 yrs');
      expect(residenceDuration(null, 20260101)).toBe('');
      expect(residenceDuration(20260101, 20250101)).toBe('');
    });

    test('criminal record extracts incarceration detail + guards mugshot', () => {
      const report = makeReport({ identities: [makePrimaryIdentity({
        criminalList: [{
          name: [{ data: 'JOHN DOE' }],
          photo: 'https://img.example/mug.jpg',
          bodyMark: [{ description: 'TATTOO L ARM' }],
          vehicle: [{ year: '2010', make: 'FORD', model: 'F150' }],
          offense: [{
            date: { data: '01/02/2010' },
            commitment: { date: { data: '03/04/2010' } },
            releaseDate: { data: '05/06/2012' },
            sentence: { data: '24 MONTHS' },
            description: 'BURGLARY',
          }],
        }],
      })] });
      const c = extractAll(report).criminalRecords[0];
      expect(c.name).toBe('JOHN DOE');
      expect(c.photo).toBe('https://img.example/mug.jpg');
      expect(c.commitmentDate).toBe('03/04/2010');
      expect(c.releaseDate).toBe('05/06/2012');
      expect(c.sentence).toBe('24 MONTHS');
      expect(c.marks).toEqual(['TATTOO L ARM']);
      expect(c.vehicles).toEqual(['2010 FORD F150']);
    });

    test('non-url photo is dropped (no broken img src)', () => {
      const report = makeReport({ identities: [makePrimaryIdentity({
        criminalList: [{ photo: 'not-a-url', offense: [{ description: 'X' }] }],
      })] });
      expect(extractAll(report).criminalRecords[0].photo).toBe('');
    });

    test('property reads the nested BC shape (assessment/detail/owner/history)', () => {
      const report = makeReport({ identities: [makePrimaryIdentity({
        propertyList: [{
          address: { data: '8 THERESA AVE', city: 'BURLINGTON', state: 'MA', zip: '01803' },
          assessment: { assessedValue: 1046200, marketValue: 1326000, taxYear: '2025', totalTax: 9060 },
          detail: { county: 'MIDDLESEX', parcelNumber: 'BURL-65', ownershipStatus: 'TRUST', bedrooms: 4, bathrooms: 2.5, yearBuilt: '1993' },
          owner: [{ personName: [{ first: 'TIM', last: 'CHIN' }] }],
          history: [{ detail: { transferDate: { data: '09/18/2019' }, deedType: 'QUIT CLAIM DEED' }, buyer: [{ name: 'CHIN FT' }] }],
          foreclosure: {},
        }],
      })] });
      const p = extractAll(report).properties[0];
      expect(p.assessedValue).toBe(1046200);
      expect(p.bedCount).toBe(4);
      expect(p.ownershipStatus).toBe('TRUST');
      expect(p.owner).toBe('TIM CHIN');
      expect(p.lastSale.date).toBe('09/18/2019');
      expect(p.lastSale.deedType).toBe('QUIT CLAIM DEED');
      expect(p.foreclosure).toBe(false);
    });

    test('financial record keeps lienType, courtCaseNumber, taxPeriod', () => {
      const report = makeReport({ identities: [makePrimaryIdentity({
        lienList: [{
          record: [{ caseDescription: 'STATE TAX LIEN', taxPeriodMin: { data: '01/01/2014' }, taxPeriodMax: { data: '12/31/2014' } }],
          lienType: ['TAX'],
          courtCaseNumber: ['CV-123'],
        }],
      })] });
      const l = extractAll(report).liens[0];
      expect(l.lienType).toBe('TAX');
      expect(l.courtCaseNumber).toBe('CV-123');
      expect(l.taxPeriod).toBe('01/01/2014 – 12/31/2014');
    });
  });
});
