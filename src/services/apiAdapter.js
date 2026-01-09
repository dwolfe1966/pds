/**
 * API Response Adapter
 * 
 * Transforms responses from the new API to match the format expected by the application.
 * This allows components to work with a consistent data structure regardless of which API is used.
 */

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

  // Try to get identities using the getIdentities method if available
  if (response && typeof response.getIdentities === 'function') {
    identities = response.getIdentities() || [];
    total = response.getTotal?.() || 0;
    perPage = response.getPerPage?.() || 20;
    searchContextKey = response.getSearchContextKey?.() || null;
    teaserInput = response.getTeaserInput?.() || null;
    provider = response.getProvider?.() || null;
  } else if (response?.raws?.[0]?.transient) {
    // Fallback to direct property access
    const transient = response.raws[0].transient;
    identities = transient.identities || [];
    total = transient.total || 0;
    perPage = transient.perPage || 20;
    searchContextKey = response.searchContextKey || null;
    teaserInput = response.teaserInput || null;
    provider = response.meta?.provider || response.raws[0]?.meta?.provider || null;
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
      searchContextKey,
      teaserInput,
      provider
    }
  };
}

/**
 * Transform a single identity from new API format to application format
 */
function adaptIdentity(identity) {
  // Extract name from nameList
  const nameList = identity.nameList || [];
  const fullName = nameList.length > 0 ? nameList[0].data : 'Unknown';
  
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

  // Extract age range if available
  const ageRange = identity.ageRange || '';

  return {
    id: identity.extId,
    extId: identity.extId,
    fullName,
    location,
    ageRange,
    provider: identity.meta?.provider,
    // Store full identity for later use (e.g., report creation)
    _rawIdentity: identity
  };
}

/**
 * Transform report response from new API
 */
export function adaptReportResponse(response) {
  // The report response structure may vary
  // This is a basic adapter - may need to be extended based on actual response
  if (response?.commerceContents?.[0]) {
    const commerceContent = response.commerceContents[0];
    return {
      reportId: commerceContent._id,
      reportData: response,
      commerceContentId: commerceContent._id,
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
  // Handle report list pagination
  const reports = response.data || response.reports || [];
  return {
    data: reports.map(report => ({
      id: report._id || report.id,
      reportId: report._id || report.id,
      createdAt: report.createdAt || report.created_at,
      // Add other fields as needed
      ...report
    })),
    pagination: {
      hasMore: response.hasMore || false,
      lastId: response.lastId || null
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
