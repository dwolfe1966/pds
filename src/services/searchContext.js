/**
 * Search Context Manager
 * 
 * Manages search context throughout the application flow.
 * Search context includes information needed for report creation and opt-out requests.
 */

const STORAGE_KEY = 'searchContext';

/**
 * Set search context in session storage
 */
export function setSearchContext(context) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(context));
  } catch (error) {
    console.error('Failed to save search context:', error);
  }
}

/**
 * Get search context from session storage
 */
export function getSearchContext() {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.error('Failed to retrieve search context:', error);
    return null;
  }
}

/**
 * Clear search context from session storage
 */
export function clearSearchContext() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear search context:', error);
  }
}

/**
 * Update search context with additional data
 */
export function updateSearchContext(updates) {
  const current = getSearchContext() || {};
  const updated = { ...current, ...updates };
  setSearchContext(updated);
  return updated;
}

/**
 * Get specific value from search context
 */
export function getSearchContextValue(key) {
  const context = getSearchContext();
  return context ? context[key] : null;
}

/**
 * Store identity context for a specific result
 * This is used when user clicks on a result to view details
 */
export function setIdentityContext(identity, searchContext) {
  const context = {
    ...searchContext,
    identity: {
      extId: identity.extId,
      provider: identity.provider || identity.meta?.provider,
      fullName: identity.fullName || identity.nameList?.[0]?.data,
      // Store raw identity for report creation
      _rawIdentity: identity._rawIdentity || identity
    }
  };
  setSearchContext(context);
  return context;
}

/**
 * Get identity context for report creation
 */
export function getIdentityContext() {
  const context = getSearchContext();
  return context?.identity || null;
}
