/**
 * Tests for apiAdapter.js — adaptReportDetailResponse and adaptReportListResponse
 */

import {
  adaptReportDetailResponse,
  adaptReportListResponse,
  adaptTeaserResponse,
  adaptIdentity,
} from '../services/apiAdapter';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const MOCK_IDENTITY = {
  extId: 'ext-123',
  nameList: [{ data: 'John Doe' }],
  addressList: [{ city: 'Denver', state: 'CO', zip: '80202' }],
  ageRange: '35-44',
  meta: { provider: 'test-provider' },
};

const MOCK_FULL_CONTACT = {
  phones: [{ number: '3035551234', type: 'mobile' }],
  emails: [{ address: 'john@example.com', type: 'personal' }],
  addresses: [{ street: '123 Main St', city: 'Denver', state: 'CO', zip: '80202' }],
  relatives: [{ name: 'Jane Doe', relationship: 'spouse' }],
};

const MOCK_FAMILY_WATCHDOG = {
  offenders: [
    {
      name: 'John Offender',
      distance: '0.5 miles',
      offenseDescription: 'Lewd conduct',
      address: { street: '456 Oak Ave', city: 'Denver', state: 'CO', zip: '80203' },
    },
  ],
};

const buildRawReportData = () => ({
  commerceContent: { _id: 'cc-abc-123' },
  raws: [
    { transient: { identities: [MOCK_IDENTITY] } },
    { transient: { fullContact: MOCK_FULL_CONTACT } },
    { transient: { familyWatchdog: MOCK_FAMILY_WATCHDOG } },
  ],
});

// ─── adaptReportDetailResponse ───────────────────────────────────────────────

describe('adaptReportDetailResponse', () => {
  test('extracts data from a raw response object with .raws', () => {
    const raw = buildRawReportData();
    const result = adaptReportDetailResponse(raw);

    expect(result.commerceContentId).toBe('cc-abc-123');
    expect(result.identities).toHaveLength(1);
    expect(result.identities[0].extId).toBe('ext-123');
    expect(result.fullContact).toEqual(MOCK_FULL_CONTACT);
    expect(result.familyWatchdog).toEqual(MOCK_FAMILY_WATCHDOG);
    expect(result.raws).toHaveLength(3);
  });

  test('extracts data via getData() library pattern', () => {
    const raw = buildRawReportData();
    const libraryResponse = {
      getData: () => ({ params: { response: { data: raw } } }),
    };

    const result = adaptReportDetailResponse(libraryResponse);

    expect(result.commerceContentId).toBe('cc-abc-123');
    expect(result.identities).toHaveLength(1);
    expect(result.fullContact).toEqual(MOCK_FULL_CONTACT);
    expect(result.familyWatchdog).toEqual(MOCK_FAMILY_WATCHDOG);
  });

  test('extracts data from response.params.response.data', () => {
    const raw = buildRawReportData();
    const wrappedResponse = { params: { response: { data: raw } } };

    const result = adaptReportDetailResponse(wrappedResponse);

    expect(result.commerceContentId).toBe('cc-abc-123');
    expect(result.identities).toHaveLength(1);
  });

  test('extracts commerceContentId from commerceContents array', () => {
    const response = {
      commerceContents: [{ _id: 'cc-from-array' }],
      raws: [],
    };
    const result = adaptReportDetailResponse(response);
    expect(result.commerceContentId).toBe('cc-from-array');
  });

  test('extracts commerceContentId from top-level field', () => {
    const response = { commerceContentId: 'cc-top-level', raws: [] };
    const result = adaptReportDetailResponse(response);
    expect(result.commerceContentId).toBe('cc-top-level');
  });

  test('returns empty identities/null contact when raws is missing', () => {
    const response = { commerceContent: { _id: 'cc-no-raws' } };
    const result = adaptReportDetailResponse(response);
    expect(result.identities).toEqual([]);
    expect(result.fullContact).toBeNull();
    expect(result.familyWatchdog).toBeNull();
  });

  test('handles null/undefined response gracefully', () => {
    const result = adaptReportDetailResponse(null);
    expect(result.commerceContentId).toBeNull();
    expect(result.identities).toEqual([]);
    expect(result.raws).toEqual([]);
  });

  test('always returns reportData and fullResponse', () => {
    const raw = buildRawReportData();
    const result = adaptReportDetailResponse(raw);
    expect(result.reportData).toBeDefined();
    expect(result.fullResponse).toBe(raw);
  });
});

// ─── adaptReportListResponse ─────────────────────────────────────────────────

describe('adaptReportListResponse', () => {
  const makeReport = (id) => ({
    _id: id,
    createdAt: '2025-01-01T00:00:00Z',
    teaserInput: { fName: 'John', lName: 'Doe' },
  });

  test('extracts reports from commerceContents array via getData()', () => {
    const reports = [makeReport('r1'), makeReport('r2')];
    // ByteCrtrs getData() returns the inner data object directly (params.response.data)
    const response = {
      getData: () => ({ commerceContents: reports, hasMore: false }),
    };

    const result = adaptReportListResponse(response);
    expect(result.data).toHaveLength(2);
    expect(result.data[0].id).toBe('r1');
    expect(result.pagination.hasMore).toBe(false);
  });

  test('extracts reports via getReports() method', () => {
    const reports = [makeReport('r1')];
    const response = {
      getReports: () => reports,
      getHasMore: () => true,
      getLastId: () => 'r1',
    };

    const result = adaptReportListResponse(response);
    expect(result.data).toHaveLength(1);
    expect(result.pagination.hasMore).toBe(true);
    expect(result.pagination.lastId).toBe('r1');
  });

  test('extracts reports from direct commerceContents key', () => {
    const reports = [makeReport('r1'), makeReport('r2'), makeReport('r3')];
    const result = adaptReportListResponse({ commerceContents: reports, hasMore: true });
    expect(result.data).toHaveLength(3);
    expect(result.pagination.hasMore).toBe(true);
  });

  test('extracts reports from data.reports', () => {
    const reports = [makeReport('r1')];
    const result = adaptReportListResponse({ data: { reports, hasMore: false } });
    expect(result.data).toHaveLength(1);
  });

  test('returns empty array for empty/null response', () => {
    const result = adaptReportListResponse(null);
    expect(result.data).toEqual([]);
    expect(result.pagination.hasMore).toBe(false);
  });

  test('normalises report id field from _id', () => {
    const result = adaptReportListResponse({ commerceContents: [makeReport('r99')] });
    expect(result.data[0].id).toBe('r99');
    expect(result.data[0].reportId).toBe('r99');
  });
});

// ─── adaptIdentity ────────────────────────────────────────────────────────────

describe('adaptIdentity', () => {
  test('maps identity fields to application format', () => {
    const result = adaptIdentity(MOCK_IDENTITY);
    expect(result.id).toBe('ext-123');
    expect(result.extId).toBe('ext-123');
    expect(result.fullName).toBe('John Doe');
    expect(result.location).toBe('Denver, CO, 80202');
    expect(result.ageRange).toBe('35-44');
    expect(result.provider).toBe('test-provider');
    expect(result._rawIdentity).toBe(MOCK_IDENTITY);
  });

  test('handles missing nameList gracefully', () => {
    const result = adaptIdentity({ extId: 'x1', nameList: [], addressList: [] });
    expect(result.fullName).toBe('Unknown');
    expect(result.location).toBe('');
  });

  test('joins multiple addresses with semicolons', () => {
    const result = adaptIdentity({
      extId: 'x1',
      nameList: [{ data: 'Test' }],
      addressList: [
        { city: 'Denver', state: 'CO', zip: '80202' },
        { city: 'Boulder', state: 'CO', zip: '80301' },
      ],
    });
    expect(result.location).toBe('Denver, CO, 80202; Boulder, CO, 80301');
  });
});
