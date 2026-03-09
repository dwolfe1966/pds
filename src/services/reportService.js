/**
 * Report Service
 * 
 * Provides a clean interface for report operations:
 * - Creating reports from search results
 * - Fetching report details
 * - Listing user's reports
 */

import api from '../api';
import { getSearchContext, getIdentityContext } from './searchContext';

/**
 * Create a report for a given identity
 * @param {string} extId - The external ID from search results
 * @param {Object} options - Additional options
 * @param {string} options.type - Report type: 'extId' or 'reversePhone' (default: 'extId')
 * @param {string} options.phone - Phone number (required for reversePhone type)
 * @param {Object} options.searchContext - Search context (if not provided, will try to get from storage)
 * @returns {Promise<Object>} Report data with commerceContentId
 */
export async function createReport(extId, options = {}) {
  const { type = 'extId', phone, searchContext } = options;
  
  // Get search context if not provided
  const context = searchContext || getSearchContext();
  
  // Build report creation parameters
  const params = {
    type,
    ...(type === 'extId' ? { extId } : { phone })
  };
  
  // Add search context if available
  // For report creation, use .report key (sale.name.report, member.name.report) not .teaser
  if (context) {
    let contextKey = context.searchContextKey || context.teaserInput?.searchContextKey;
    if (contextKey && contextKey.includes('.teaser')) {
      contextKey = contextKey.replace('.teaser', '.report');
    }
    if (contextKey) {
      params.searchContextKey = contextKey;
    }
    if (context.teaserInput) {
      params.teaserInput = context.teaserInput;
    }
    if (context.commerceContentId) {
      params.commerceContentId = context.commerceContentId;
    }
  }
  
  try {
    const response = await api.createReport(params);

    // adaptReportDetailResponse (via apiRouter) now populates these fields directly
    const commerceContentId =
      response.commerceContentId ||
      response.reportId ||
      response.reportData?.commerceContents?.[0]?._id ||
      response.commerceContents?.[0]?._id ||
      null;

    // Store commerceContentId in search context for later use
    if (commerceContentId && context) {
      const identityContext = getIdentityContext();
      if (identityContext && identityContext.extId === extId) {
        const updatedContext = {
          ...context,
          identity: {
            ...identityContext,
            commerceContentId,
            reportCreated: true
          }
        };
        try {
          sessionStorage.setItem('searchContext', JSON.stringify(updatedContext));
        } catch (error) {
          console.error('Failed to update search context:', error);
        }
      }
    }

    return {
      success: true,
      commerceContentId,
      identities: response.identities || [],
      fullContact: response.fullContact || null,
      familyWatchdog: response.familyWatchdog || null,
      raws: response.raws || [],
      reportData: response.reportData || response,
      fullResponse: response
    };
  } catch (error) {
    console.error('Failed to create report:', error);
    throw error;
  }
}

/**
 * Get report details by commerceContentId
 * @param {string} commerceContentId - The commerce content ID from createReport response
 * @returns {Promise<Object>} Full report data
 */
export async function getReportDetail(commerceContentId) {
  try {
    if (!commerceContentId || commerceContentId === 'undefined' || commerceContentId === 'null') {
      throw new Error('Report ID is required');
    }
    const response = await api.getReportDetail(commerceContentId);
    return {
      success: true,
      commerceContentId: response.commerceContentId || commerceContentId,
      identities: response.identities || [],
      fullContact: response.fullContact || null,
      familyWatchdog: response.familyWatchdog || null,
      raws: response.raws || [],
      reportData: response.reportData || response,
      fullResponse: response
    };
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('Failed to get report detail:', error);
    }
    throw error;
  }
}

/**
 * Get list of user's reports with pagination
 * @param {Object} options - Pagination options
 * @param {string} options.lastId - Last commerceContentId for pagination (cursor-based)
 * @param {string} options.token - Authentication token (optional, will use token getter if not provided)
 * @returns {Promise<Object>} Report list with pagination info
 */
export async function getReportList(options = {}) {
  const { lastId, token } = options;
  
  try {
    const params = {};
    if (lastId) {
      params.lastId = lastId;
    }
    if (token) {
      params.token = token;
    } else {
      console.warn('[reportService] getReportList called without token');
    }
    
    if (process.env.NODE_ENV === 'development') {
      console.log('[reportService] Calling api.getReportList with params:', { ...params, token: token ? 'present' : 'missing' });
    }
    
    const response = await api.getReportList(params);
    
    if (process.env.NODE_ENV === 'development') {
      console.log('[reportService] Received response:', response);
    }
    
    return {
      success: true,
      reports: response.data || [],
      pagination: response.pagination || {},
      fullResponse: response
    };
  } catch (error) {
    console.error('[reportService] Failed to get report list:', error);
    console.error('[reportService] Error details:', {
      message: error?.message,
      status: error?.status,
      statusText: error?.statusText,
      data: error?.data
    });
    throw error;
  }
}

/**
 * Create report for an identity from search results
 * This is a convenience function that combines identity context and report creation
 * @param {string} extId - The external ID
 * @param {Object} identity - The identity object from search results
 * @returns {Promise<Object>} Report data
 */
export async function createReportForIdentity(extId, identity = null) {
  // Get identity context if identity is provided
  const identityContext = identity ? {
    extId: identity.extId || extId,
    provider: identity.provider || identity.meta?.provider,
    fullName: identity.fullName || identity.nameList?.[0]?.data
  } : getIdentityContext();
  
  // Get search context
  const searchContext = getSearchContext();
  
  // If we have identity context, merge it with search context
  const context = identityContext ? {
    ...searchContext,
    identity: identityContext
  } : searchContext;
  
  return await createReport(extId, { searchContext: context });
}

/**
 * Create a full report directly from a phone number (member use-case).
 * Uses report/create with type: 'reversePhone' — bypasses teaser search entirely
 * and returns full identity + fullContact + familyWatchdog data in one call.
 * @param {string} phone - 10-digit phone number (digits only)
 * @returns {Promise<{success: boolean, commerceContentId: string|null, reportData: Object}>}
 */
export async function createReportForPhone(phone) {
  // Resolve member.phone.report searchContextKey from the library enum
  let searchContextKey;
  try {
    if (typeof window !== 'undefined' && window.ApiWrapper?.searchContextKey) {
      searchContextKey = window.ApiWrapper.searchContextKey?.member?.phone?.report;
    }
  } catch (e) {
    // Library not yet initialised; proceed without it
  }

  const params = { type: 'reversePhone', phone };
  if (searchContextKey) {
    params.searchContextKey = searchContextKey;
  }

  try {
    const response = await api.createReport(params);

    // Extract commerceContentId — mirrors the same pattern used in createReport()
    let commerceContentId = null;
    if (response.commerceContentId) {
      commerceContentId = response.commerceContentId;
    } else if (response.reportId) {
      commerceContentId = response.reportId;
    } else if (response.reportData?.commerceContents?.[0]?._id) {
      commerceContentId = response.reportData.commerceContents[0]._id;
    } else if (response.commerceContents?.[0]?._id) {
      commerceContentId = response.commerceContents[0]._id;
    }

    return {
      success: true,
      commerceContentId,
      identities: response.identities || [],
      fullContact: response.fullContact || null,
      familyWatchdog: response.familyWatchdog || null,
      raws: response.raws || [],
      reportData: response.reportData || response,
      fullResponse: response,
    };
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[reportService] createReportForPhone failed:', error);
    }
    throw error;
  }
}

/**
 * Check if a report has already been created for an identity
 * @param {string} extId - The external ID
 * @returns {Object|null} CommerceContentId if report exists, null otherwise
 */
export function getExistingReportId(extId) {
  const context = getSearchContext();
  const identityContext = getIdentityContext();
  
  if (identityContext && identityContext.extId === extId && identityContext.commerceContentId) {
    return identityContext.commerceContentId;
  }
  
  return null;
}
