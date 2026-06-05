/**
 * Tests for reportService.js
 *
 * All external dependencies (api, searchContext) are mocked so these
 * tests run in pure Node without a browser or real API.
 */

// ─── Mock dependencies before importing the module under test ────────────────

jest.mock('../api', () => ({
  __esModule: true,
  default: {
    createReport: jest.fn(),
    getReportDetail: jest.fn(),
    getReportList: jest.fn(),
    searchPeople: jest.fn(),
  },
}));

jest.mock('../services/searchContext', () => ({
  getSearchContext: jest.fn(),
  getIdentityContext: jest.fn(),
  setSearchContext: jest.fn(),
}));

// ─── Imports ─────────────────────────────────────────────────────────────────

import api from '../api';
import { getSearchContext, getIdentityContext } from '../services/searchContext';
import {
  createReport,
  getReportDetail,
  getReportList,
  createReportForIdentity,
  createReportForPhone,
  getExistingReportId,
} from '../services/reportService';

// ─── Shared fixtures ─────────────────────────────────────────────────────────

const RICH_ADAPTER_RESPONSE = {
  commerceContentId: 'cc-test-123',
  reportId: 'cc-test-123',
  identities: [
    {
      extId: 'ext-abc',
      nameList: [{ data: 'Jane Smith' }],
      addressList: [{ city: 'Austin', state: 'TX', zip: '78701' }],
    },
  ],
  fullContact: {
    phones: [{ number: '5125551234', type: 'mobile' }],
    emails: [{ address: 'jane@example.com' }],
  },
  familyWatchdog: { offenders: [] },
  raws: [
    { transient: { identities: [] } },
    { transient: { fullContact: {} } },
  ],
  reportData: { rawApiData: true },
};

// ─── createReport ─────────────────────────────────────────────────────────────

describe('createReport', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getSearchContext.mockReturnValue(null);
    getIdentityContext.mockReturnValue(null);
  });

  test('returns rich structured data on success', async () => {
    api.createReport.mockResolvedValue(RICH_ADAPTER_RESPONSE);

    const result = await createReport('ext-abc');

    expect(result.success).toBe(true);
    expect(result.commerceContentId).toBe('cc-test-123');
    expect(result.identities).toHaveLength(1);
    expect(result.fullContact.phones).toHaveLength(1);
    expect(result.familyWatchdog.offenders).toHaveLength(0);
    expect(result.raws).toHaveLength(2);
  });

  test('passes extId to api.createReport', async () => {
    api.createReport.mockResolvedValue(RICH_ADAPTER_RESPONSE);

    await createReport('ext-xyz', { type: 'extId' });

    expect(api.createReport).toHaveBeenCalledWith(
      expect.objectContaining({ extId: 'ext-xyz', type: 'extId' })
    );
  });

  test('passes phone to api.createReport when type is reversePhone', async () => {
    api.createReport.mockResolvedValue(RICH_ADAPTER_RESPONSE);

    await createReport(null, { type: 'reversePhone', phone: '5125551234' });

    expect(api.createReport).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'reversePhone', phone: '5125551234' })
    );
  });

  test('propagates api.createReport errors', async () => {
    api.createReport.mockRejectedValue(new Error('Network failure'));

    await expect(createReport('ext-abc')).rejects.toThrow('Network failure');
  });

  test('stores commerceContentId in sessionStorage when identity context matches', async () => {
    const mockContext = { searchContextKey: 'member.name.report', teaserInput: {} };
    getSearchContext.mockReturnValue(mockContext);
    getIdentityContext.mockReturnValue({ extId: 'ext-abc', fullName: 'Jane Smith' });
    api.createReport.mockResolvedValue(RICH_ADAPTER_RESPONSE);

    // Mock sessionStorage
    const setItemSpy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {});

    await createReport('ext-abc');

    expect(setItemSpy).toHaveBeenCalledWith(
      'searchContext',
      expect.stringContaining('cc-test-123')
    );

    setItemSpy.mockRestore();
  });
});

// ─── getReportDetail ──────────────────────────────────────────────────────────

describe('getReportDetail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns rich structured data on success', async () => {
    api.getReportDetail.mockResolvedValue(RICH_ADAPTER_RESPONSE);

    const result = await getReportDetail('cc-test-123');

    expect(result.success).toBe(true);
    expect(result.commerceContentId).toBe('cc-test-123');
    expect(result.identities).toHaveLength(1);
    expect(result.fullContact).toBeDefined();
    expect(result.familyWatchdog).toBeDefined();
    expect(result.raws).toHaveLength(2);
  });

  test('throws when commerceContentId is missing', async () => {
    await expect(getReportDetail(null)).rejects.toThrow('Report ID is required');
    await expect(getReportDetail('undefined')).rejects.toThrow('Report ID is required');
    await expect(getReportDetail('null')).rejects.toThrow('Report ID is required');
  });

  test('propagates api.getReportDetail errors', async () => {
    api.getReportDetail.mockRejectedValue(new Error('Not found'));

    await expect(getReportDetail('cc-unknown')).rejects.toThrow('Not found');
  });

  test('falls back commerceContentId to provided id when response omits it', async () => {
    api.getReportDetail.mockResolvedValue({
      identities: [],
      raws: [],
      reportData: {},
    });

    const result = await getReportDetail('cc-fallback-id');
    expect(result.commerceContentId).toBe('cc-fallback-id');
  });
});

// ─── getReportList ────────────────────────────────────────────────────────────

describe('getReportList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns normalised report list on success', async () => {
    api.getReportList.mockResolvedValue({
      data: [{ _id: 'r1' }, { _id: 'r2' }],
      pagination: { hasMore: false, lastId: 'r2' },
    });

    const result = await getReportList({ token: 'tok-abc' });

    expect(result.success).toBe(true);
    expect(result.reports).toHaveLength(2);
    expect(result.pagination).toEqual({ hasMore: false, lastId: 'r2' });
  });

  test('returns empty list when api returns no data', async () => {
    api.getReportList.mockResolvedValue({});

    const result = await getReportList({ token: 'tok-abc' });

    expect(result.reports).toEqual([]);
    expect(result.pagination).toEqual({});
  });

  test('passes lastId for pagination', async () => {
    api.getReportList.mockResolvedValue({ data: [], pagination: {} });

    await getReportList({ token: 'tok', lastId: 'r-cursor' });

    expect(api.getReportList).toHaveBeenCalledWith(
      expect.objectContaining({ lastId: 'r-cursor', token: 'tok' })
    );
  });

  test('propagates errors', async () => {
    api.getReportList.mockRejectedValue(new Error('Server error'));

    await expect(getReportList({ token: 'tok' })).rejects.toThrow('Server error');
  });
});

// ─── createReportForIdentity ──────────────────────────────────────────────────

describe('createReportForIdentity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getSearchContext.mockReturnValue(null);
    getIdentityContext.mockReturnValue(null);
  });

  test('calls createReport with extId from identity', async () => {
    api.createReport.mockResolvedValue(RICH_ADAPTER_RESPONSE);

    const identity = {
      extId: 'ext-abc',
      provider: 'test-provider',
      nameList: [{ data: 'Jane Smith' }],
    };

    const result = await createReportForIdentity('ext-abc', identity);

    expect(result.success).toBe(true);
    expect(api.createReport).toHaveBeenCalledWith(
      expect.objectContaining({ extId: 'ext-abc' })
    );
  });

  test('uses extId argument when identity.extId is absent', async () => {
    api.createReport.mockResolvedValue(RICH_ADAPTER_RESPONSE);

    await createReportForIdentity('ext-fallback', {});

    expect(api.createReport).toHaveBeenCalledWith(
      expect.objectContaining({ extId: 'ext-fallback' })
    );
  });
});

// ─── createReportForPhone ─────────────────────────────────────────────────────

describe('createReportForPhone', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // BC requires a teaserInput on report/create, so createReportForPhone now runs
  // the phone teaser FIRST and creates the report with that context.
  const PHONE_TEASER = {
    data: [{ extId: 'ext-abc' }],
    searchContext: { contextKey: 'sale.phone.teaser', teaserInput: { type: 'phone', phone: '5125551234', contextKey: 'sale.phone.teaser' } },
  };

  test('runs the phone teaser then creates the report WITH teaserInput', async () => {
    api.searchPeople.mockResolvedValue(PHONE_TEASER);
    api.createReport.mockResolvedValue(RICH_ADAPTER_RESPONSE);

    const result = await createReportForPhone('5125551234');

    expect(result.success).toBe(true);
    expect(api.searchPeople).toHaveBeenCalledWith({ phone: '5125551234', type: 'phone' });
    expect(api.createReport).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'reversePhone',
        phone: '5125551234',
        contextKey: 'sale.phone.report',
        teaserInput: PHONE_TEASER.searchContext.teaserInput,
      })
    );
  });

  test('returns { success:false } (no report) when the teaser finds nothing', async () => {
    api.searchPeople.mockResolvedValue({ data: [], searchContext: {} });

    const result = await createReportForPhone('0000000000');

    expect(result.success).toBe(false);
    expect(result.commerceContentId).toBeNull();
    expect(api.createReport).not.toHaveBeenCalled();
  });

  test('returns rich structured data', async () => {
    api.searchPeople.mockResolvedValue(PHONE_TEASER);
    api.createReport.mockResolvedValue(RICH_ADAPTER_RESPONSE);

    const result = await createReportForPhone('5125551234');

    expect(result.commerceContentId).toBe('cc-test-123');
    expect(result.identities).toHaveLength(1);
    expect(result.fullContact).toBeDefined();
    expect(result.familyWatchdog).toBeDefined();
  });

  test('propagates errors', async () => {
    api.searchPeople.mockResolvedValue(PHONE_TEASER);
    api.createReport.mockRejectedValue(new Error('Phone not found'));

    await expect(createReportForPhone('0000000000')).rejects.toThrow('Phone not found');
  });
});

// ─── getExistingReportId ──────────────────────────────────────────────────────

describe('getExistingReportId', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns commerceContentId when identity context has it', () => {
    getSearchContext.mockReturnValue({});
    getIdentityContext.mockReturnValue({
      extId: 'ext-abc',
      commerceContentId: 'cc-existing-456',
    });

    const result = getExistingReportId('ext-abc');
    expect(result).toBe('cc-existing-456');
  });

  test('returns null when extId does not match', () => {
    getSearchContext.mockReturnValue({});
    getIdentityContext.mockReturnValue({
      extId: 'ext-other',
      commerceContentId: 'cc-other',
    });

    const result = getExistingReportId('ext-abc');
    expect(result).toBeNull();
  });

  test('returns null when no identity context', () => {
    getSearchContext.mockReturnValue({});
    getIdentityContext.mockReturnValue(null);

    const result = getExistingReportId('ext-abc');
    expect(result).toBeNull();
  });
});
