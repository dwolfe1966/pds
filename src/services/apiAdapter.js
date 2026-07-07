/**
 * API Response Adapter
 * 
 * Transforms responses from the new API to match the format expected by the application.
 * This allows components to work with a consistent data structure regardless of which API is used.
 */
import { inferGender } from '../utils/inferGender';

/**
 * Transform teaser search response from new API to application format
 */
export function adaptTeaserResponse(response) {
  // Handle both direct response and response with getIdentities method
  let identities = [];
  let total = 0;
  let perPage = 20;
  let searchContextKey = null;
  let teaserInput = null;
  let provider = null;
  let commerceContentId = null;

  // Log response structure for debugging
  if (process.env.NODE_ENV === 'development') {
    console.log('[API Adapter] adaptTeaserResponse called with:', {
      type: typeof response,
      hasGetIdentities: typeof response?.getIdentities === 'function',
      hasRaws: !!response?.raws,
      hasCommerceContent: 'commerceContent' in (response || {}),
      keys: response ? Object.keys(response) : []
    });
    
    // Try to inspect the underlying response data if the library exposes it
    // Some libraries store the raw response in a private property
    if (response && typeof response === 'object') {
      // Check for common property names where libraries might store raw data
      const possibleDataProps = ['_data', '_response', 'data', '_raw', '__data'];
      for (const prop of possibleDataProps) {
        if (prop in response) {
          console.log(`[API Adapter] Found ${prop} property:`, JSON.stringify(response[prop]).substring(0, 300));
        }
      }
      
      // Also try to see if we can access the raw response through getCommerceContent
      if (typeof response.getCommerceContent === 'function') {
        const commerceContent = response.getCommerceContent();
        if (commerceContent) {
          console.log('[API Adapter] getCommerceContent() returned data:', JSON.stringify(commerceContent).substring(0, 300));
        } else {
          console.log('[API Adapter] getCommerceContent() returned null/undefined - this might indicate no results or incomplete response');
        }
      }
    }
  }

  // Try to get identities using the getIdentities method if available
  if (response && typeof response.getIdentities === 'function') {
    identities = response.getIdentities() || [];
    total = response.getTotal?.() || 0;
    perPage = response.getPerPage?.() || 20;
    teaserInput = response.getTeaserInput?.() || null;
    searchContextKey = response.getSearchContextKey?.() || teaserInput?.contextKey || teaserInput?.searchContextKey || null;
    const commerceContent = response.getCommerceContent?.();
    commerceContentId = commerceContent?._id || commerceContent?.id || null;
    provider = response.getProvider?.() || null;
    
    if (process.env.NODE_ENV === 'development') {
      console.log('[API Adapter] Used getIdentities() method, found', identities.length, 'identities');
    }
  } else if (response?.raws?.[0]?.transient) {
    // Fallback to direct property access
    const transient = response.raws[0].transient;
    identities = transient.identities || [];
    total = transient.total || 0;
    perPage = transient.perPage || 20;
    teaserInput = response.teaserInput || null;
    searchContextKey = response.searchContextKey || teaserInput?.searchContextKey || null;
    commerceContentId = response.commerceContent?._id || response.commerceContent?.id || null;
    provider = response.meta?.provider || response.raws[0]?.meta?.provider || null;
    
    if (process.env.NODE_ENV === 'development') {
      console.log('[API Adapter] Used raws[0].transient, found', identities.length, 'identities');
    }
  } else if (response?.commerceContent === null) {
    // Handle case where API returns {commerceContent: null} - this might mean no results
    // But we should still check if there's data elsewhere
    if (process.env.NODE_ENV === 'development') {
      console.warn('[API Adapter] Response has commerceContent: null. This might mean no results found.');
      console.log('[API Adapter] Full response structure:', JSON.stringify(response, null, 2));
    }
    // Return empty results
    identities = [];
  } else if (response && typeof response === 'object') {
    // The library wrapper might have transformed the response
    // Try to access underlying data through various methods
    if (process.env.NODE_ENV === 'development') {
      console.log('[API Adapter] Response is an object but no standard structure found. Checking for alternative data sources...');
      
      // Check if response has a method to get raw data
      if (typeof response.getData === 'function') {
        const rawData = response.getData();
        console.log('[API Adapter] getData() returned:', JSON.stringify(rawData).substring(0, 500));
        if (rawData?.raws?.[0]?.transient?.identities) {
          identities = rawData.raws[0].transient.identities;
          total = rawData.raws[0].transient.total || 0;
          perPage = rawData.raws[0].transient.perPage || 20;
          console.log('[API Adapter] Found identities in getData():', identities.length);
        }
      }
    }
    
    // If still no identities, return empty
    if (identities.length === 0) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[API Adapter] No identities found in response. Returning empty results.');
      }
    }
  } else {
    // Unknown response structure
    if (process.env.NODE_ENV === 'development') {
      console.warn('[API Adapter] Unknown response structure:', response);
    }
    identities = [];
  }

  // Robust fallback — covers the PHONE teaser shape (verified live 2026-06-05):
  // identities are nested under `commerceContent.raws[0].transient`, which neither
  // getIdentities() nor the `raws[0].transient` branch surfaces, so the phone SRP
  // showed "no results" even though BC returned matches. Mirror the report-detail
  // resolver: dig the raw data out of the IIFE wrapper and search raws (by key, not
  // index) for the transient carrying identities. Runs in PRODUCTION too — the old
  // getData() path was gated behind `if (development)`.
  if (identities.length === 0) {
    let rawData = null;
    if (response && typeof response.getData === 'function') {
      const d = response.getData();
      rawData = d?.params?.response?.data ?? d?.data ?? d;
    }
    rawData = rawData || response?.params?.response?.data || response?.data || response;
    const raws =
      rawData?.raws ??
      rawData?.commerceContent?.raws ??
      response?.commerceContent?.raws ??
      response?.raws ??
      [];
    const t = (Array.isArray(raws) ? raws.find((r) => r?.transient?.identities) : null)?.transient;
    if (t) {
      identities = t.identities || [];
      total = t.total || total;
      perPage = t.perPage || perPage;
    }
    // teaserInput + commerceContentId are needed for the downstream report-create.
    const cc = rawData?.commerceContent || response?.commerceContent || rawData || {};
    teaserInput = teaserInput || cc?.data?.teaserInput || rawData?.teaserInput || null;
    searchContextKey = searchContextKey || teaserInput?.contextKey || teaserInput?.searchContextKey || cc?.data?.contextKey || null;
    commerceContentId = commerceContentId || cc?._id || cc?.id || null;
    if (process.env.NODE_ENV === 'development' && identities.length) {
      console.log('[API Adapter] commerceContent.raws fallback found', identities.length, 'identities');
    }
  }

  return {
    data: identities.map(adaptIdentity),
    pagination: {
      total,
      perPage,
      hasMore: identities.length >= perPage,
      // Store cursor for pagination if available
      cursor: identities.length > 0 ? identities[identities.length - 1].extId : null
    },
    searchContext: {
      contextKey: searchContextKey,  // BC API spec uses contextKey
      searchContextKey,              // kept for backwards compatibility
      teaserInput,
      provider,
      commerceContentId
    }
  };
}

/**
 * Transform a single identity from new API format to application format
 */
export function adaptIdentity(identity) {
  // Extract name from nameList
  const nameList = identity.nameList || [];
  const fullName = nameList.length > 0 ? nameList[0].data : 'Unknown';
  // Aliases / AKAs — any names past the primary. Dedupe against the primary
  // (case-insensitive) so we don't echo it back. Empty when BC returns one name.
  const aliases = nameList
    .slice(1)
    .map((n) => (n && n.data ? String(n.data).trim() : ''))
    .filter((a) => a && a.toLowerCase() !== String(fullName).toLowerCase());
  
  // Extract location from addressList
  const addressList = identity.addressList || [];
  const location = addressList
    .map(addr => {
      const parts = [];
      if (addr.city) parts.push(addr.city);
      if (addr.state) parts.push(addr.state);
      if (addr.zip) parts.push(addr.zip);
      return parts.join(', ');
    })
    .filter(Boolean)
    .join('; ') || '';

  // Distinct "City, ST" list for the SRP card (array form; the `location` string
  // above is kept for back-compat). BC's addressList carries multiple addresses.
  const locations = [...new Set(addressList
    .map((a) => [a.city, a.state].filter(Boolean).join(', '))
    .filter(Boolean))];
  // Gender if BC supplies it (maps M/F) — else undefined → the card shows a neutral avatar.
  const rawSex = String(identity.sex || identity.gender || '').trim().toLowerCase();
  const gender = rawSex.startsWith('m') ? 'male' : rawSex.startsWith('f') ? 'female'
    : inferGender(identity.nameList && identity.nameList[0] && identity.nameList[0].first);

  // Extract age. BC identities carry age either as a flat `ageRange` OR via
  // `dobList[0].age` — the paid report reads it the same robust way
  // (utils/reportExtract.js). Reading only `ageRange` missed the dobList case,
  // so age went blank on the SRP rows even though BC returned it.
  const dobList = identity.dobList || [];
  const ageRange = identity.ageRange
    || (dobList[0] && dobList[0].age != null ? String(dobList[0].age) : '')
    || '';

  // BC's teaser (sourced from IDI) returns a REAL per-identity data footprint —
  // scalar *Count fields + has*/is* flags. Live-confirmed payload 2026-07-04.
  // Surface these HONESTLY on the SUP (real numbers, never fabricated). Missing
  // fields coerce to 0/false so pre-count teasers degrade gracefully.
  const num = (v) => (Number.isFinite(+v) ? +v : 0);
  const records = {
    phone: num(identity.phoneCount),
    mobilePhone: num(identity.mobilePhoneCount),
    residentialPhone: num(identity.residentialPhoneCount),
    email: num(identity.emailCount),
    address: num(identity.addressCount),
    property: num(identity.propertyCount),
    criminal: num(identity.criminalCount),
    relatives: num(identity.relativeCount),
    employment: num(identity.employmentCount),
    professionalLicense: num(identity.professionalLicenseCount),
    bankruptcy: num(identity.bankruptcyCount),
    lien: num(identity.lienCount),
    judgment: num(identity.judgmentCount),
    foreclosure: num(identity.foreclosureCount),
    business: num(identity.associatedBusinessCount),
    ip: num(identity.ipCount),
  };
  const flags = {
    isCriminal: !!identity.isCriminal,
    isPropertyOwner: !!identity.isPropertyOwner,
    hasEmail: !!identity.hasEmail,
    hasPhone: !!identity.hasPhone,
    hasRelatives: !!identity.hasRelatives,
    hasEmployment: !!identity.hasEmployment,
    hasVehicle: !!identity.hasVehicle,
    hasAddress: !!identity.hasAddress,
    hasBankruptcy: !!identity.hasBankruptcy,
    hasLien: !!identity.hasLien,
    hasJudgment: !!identity.hasJudgment,
    hasForeclosure: !!identity.hasForeclosure,
    hasProfessionalLicense: !!identity.hasProfessionalLicense,
  };
  // Earliest year this identity appears on record (nameList meta.firstSeen is a
  // YYYYMMDD int) — an honest "on record since" tenure signal.
  const seenYears = nameList
    .map((n) => n && n.meta && n.meta.firstSeen)
    .filter(Boolean)
    .map((d) => Math.floor(d / 10000))
    .filter((y) => y > 1900 && y <= new Date().getFullYear());
  const onRecordSince = seenYears.length ? Math.min(...seenYears) : null;
  // Real relative names from relationshipList (not fabricated).
  const relatives = (identity.relationshipList || [])
    .map((r) => ({
      name: [r && r.name && r.name.first, r && r.name && r.name.last].filter(Boolean).join(' ').trim(),
      relation: (r && r.relationshipName) || null,
    }))
    .filter((r) => r.name);

  return {
    id: identity.extId,
    extId: identity.extId,
    fullName,
    aliases,
    location,
    locations,
    gender,
    ageRange,
    provider: identity.meta?.provider,
    // Real teaser data footprint (honest value signals for the SUP/SRP).
    records,
    flags,
    onRecordSince,
    relatives,
    // Store full identity for later use (e.g., report creation)
    _rawIdentity: identity
  };
}

/**
 * Transform a full report (create or detail) response from ByteCrtrs.
 * Extracts: commerceContentId, raws, identities, fullContact, familyWatchdog.
 * Handles multiple response shapes: library object (getData()), params.response.data, direct .raws.
 */
export function adaptReportDetailResponse(response) {
  // Resolve raw API data — ByteCrtrs library wraps responses; getData() exposes params.response.data
  let rawData = null;
  if (response && typeof response.getData === 'function') {
    const d = response.getData();
    rawData = d?.params?.response?.data ?? d?.data ?? d;
  }
  if (!rawData && response?.params?.response?.data) {
    rawData = response.params.response.data;
  }
  if (!rawData && response?.data) {
    rawData = response.data;
  }
  if (!rawData) {
    rawData = response;
  }

  // Extract commerceContentId from multiple locations
  const commerceContentId =
    rawData?.commerceContent?._id ||
    rawData?.commerceContents?.[0]?._id ||
    rawData?.commerceContentId ||
    response?.commerceContentId ||
    null;

  // Per API docs, report/create response has raws at the top level:
  //   raws[0].transient.identities
  //   raws[1].transient.fullContact
  //   raws[2].transient.familyWatchdog
  // Fall back to commerceContent.raws in case the library wraps it differently.
  const raws =
    rawData?.raws ??
    rawData?.commerceContent?.raws ??
    response?.raws ??
    [];

  // Extract structured data from raws (search by transient key, not array index, for resilience)
  const identities =
    raws.find((r) => r.transient?.identities)?.transient?.identities ?? [];
  const fullContact =
    raws.find((r) => r.transient?.fullContact)?.transient?.fullContact ?? null;
  const familyWatchdog =
    raws.find((r) => r.transient?.familyWatchdog)?.transient?.familyWatchdog ?? null;

  if (process.env.NODE_ENV === 'development') {
    console.log('[API Adapter] adaptReportDetailResponse:', {
      commerceContentId,
      rawsCount: raws.length,
      identitiesCount: identities.length,
      hasFullContact: !!fullContact,
      hasFamilyWatchdog: !!familyWatchdog,
    });
  }

  return {
    reportId: commerceContentId,
    commerceContentId,
    raws,
    identities,
    fullContact,
    familyWatchdog,
    reportData: rawData,
    fullResponse: response,
  };
}

/**
 * Transform report response from new API
 */
export function adaptReportResponse(response) {
  // The report response structure may vary
  // This is a basic adapter - may need to be extended based on actual response
  let commerceContent = null;

  if (response?.commerceContents?.[0]) {
    commerceContent = response.commerceContents[0];
  } else if (response?.commerceContent) {
    commerceContent = response.commerceContent;
  } else if (typeof response?.getCommerceContent === 'function') {
    commerceContent = response.getCommerceContent();
  } else if (response?.params?.response?.data?.commerceContent) {
    commerceContent = response.params.response.data.commerceContent;
  }

  if (commerceContent) {
    return {
      reportId: commerceContent._id || commerceContent.id,
      reportData: response,
      commerceContentId: commerceContent._id || commerceContent.id,
      // Extract other relevant fields as needed
    };
  }
  return {
    reportId: response._id || response.id,
    reportData: response
  };
}

/**
 * Transform report list response
 */
export function adaptReportListResponse(response) {
  // Handle report list pagination from multiple response shapes
  let reports = [];
  let hasMore = false;
  let lastId = null;

  // ByteCrtrs library: getData() returns params.response?.data
  const rawData = response?.getData?.() ?? response?.params?.response?.data ?? response?.data;

  if (response && typeof response.getReports === 'function') {
    reports = response.getReports() || [];
    hasMore = response.getHasMore?.() || false;
    lastId = response.getLastId?.() || null;
  } else if (rawData?.commerceContents) {
    reports = rawData.commerceContents || [];
    hasMore = !!rawData.hasMore;
    lastId = rawData.lastId ?? (reports.length ? reports[reports.length - 1]?._id : null);
  } else if (rawData?.reports) {
    reports = rawData.reports || [];
    hasMore = !!rawData.hasMore;
    lastId = rawData.lastId ?? null;
  } else if (response?.data?.reports || response?.data?.commerceContents) {
    reports = response.data.reports || response.data.commerceContents || [];
    hasMore = response.data.hasMore || false;
    lastId = response.data.lastId || null;
  } else if (response?.reports || response?.commerceContents) {
    reports = response.reports || response.commerceContents || [];
    hasMore = response.hasMore || false;
    lastId = response.lastId || null;
  } else if (Array.isArray(response?.data)) {
    reports = response.data;
  }

  return {
    data: reports.map(report => ({
      id: report._id || report.id,
      reportId: report._id || report.id,
      createdAt: report.createdAt || report.created_at,
      // Add other fields as needed
      ...report
    })),
    pagination: {
      hasMore,
      lastId
    }
  };
}

/**
 * Extract pagination info from response
 */
function extractPagination(response) {
  if (response?.raws?.[0]?.transient) {
    const transient = response.raws[0].transient;
    return {
      total: transient.total || 0,
      perPage: transient.perPage || 20,
      hasMore: (transient.identities?.length || 0) >= (transient.perPage || 20)
    };
  }
  return {
    total: 0,
    perPage: 20,
    hasMore: false
  };
}

/**
 * Extract search context from response
 */
function extractSearchContext(response) {
  return {
    searchContextKey: response.searchContextKey || null,
    teaserInput: response.teaserInput || null,
    provider: response.meta?.provider || response.raws?.[0]?.meta?.provider || null
  };
}
