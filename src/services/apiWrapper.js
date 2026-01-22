/**
 * API Wrapper Service
 * 
 * Wraps the ByteCrtrs ApiWrapper library and provides a clean interface
 * for making API calls to the new external API.
 */

class ApiWrapperService {
  constructor() {
    this.wrapper = null;
    this.initialized = false;
    this.endpointUrl = process.env.REACT_APP_NEW_API_URL || 'https://dev1.dev.www.bytecrtrs.com/api';
    // Use proxy mode to bypass CORS - proxy requests through our Express server
    this.useProxy = process.env.REACT_APP_USE_API_PROXY !== 'false'; // Default to true
    this.proxyUrl = process.env.REACT_APP_PROXY_URL || 'http://localhost:3001/api/proxy';
  }

  /**
   * Initialize the API wrapper
   */
  async initialize() {
    if (this.initialized && this.wrapper) {
      return this.wrapper;
    }
    
    if (typeof window === 'undefined') {
      throw new Error('ApiWrapper can only be initialized in browser environment');
    }

    if (!window.ApiWrapper) {
      throw new Error('API Wrapper library not loaded. Make sure the script is included in index.html');
    }

    try {
      // If using proxy mode, point the wrapper to our proxy URL instead of the external API
      // This way the library makes requests to our server (no CORS), and our server forwards to the external API
      // The library will construct URLs like: {endpointUrl}/idLookup/teaser/search
      // So we set endpointUrl to our proxy base URL
      const endpointUrl = this.useProxy ? this.proxyUrl : this.endpointUrl;
      
      this.wrapper = window.ApiWrapper.getInstance({
        endpointUrl: endpointUrl
      });
      this.initialized = true;
      return this.wrapper;
    } catch (error) {
      console.error('Failed to initialize ApiWrapper:', error);
      throw error;
    }
  }

  /**
   * Get the wrapper instance (initializes if needed)
   */
  async getWrapper() {
    if (!this.initialized) {
      await this.initialize();
    }
    return this.wrapper;
  }

  /**
   * Check if the wrapper is available
   */
  isAvailable() {
    return typeof window !== 'undefined' && window.ApiWrapper !== undefined;
  }

  /**
   * Auth endpoints
   */
  async login(body) {
    try {
      const wrapper = await this.getWrapper();
      return await wrapper.api.auth.login(body);
    } catch (error) {
      const enhancedError = new Error(error.message || 'Login failed');
      enhancedError.originalError = error;
      enhancedError.isCorsError = this._isCorsError(error);
      throw enhancedError;
    }
  }

  async logout() {
    try {
      const wrapper = await this.getWrapper();
      return await wrapper.api.auth.logout();
    } catch (error) {
      const enhancedError = new Error(error.message || 'Logout failed');
      enhancedError.originalError = error;
      enhancedError.isCorsError = this._isCorsError(error);
      throw enhancedError;
    }
  }

  /**
   * Check if an error is a CORS error
   */
  _isCorsError(error) {
    const message = error.message || '';
    const name = error.name || '';
    return message.includes('CORS') || 
           message.includes('Access-Control-Allow-Origin') ||
           message.includes('Failed to fetch') ||
           message.includes('NetworkError') ||
           name === 'NetworkError' ||
           (error.code === 'ERR_FAILED' && !error.response);
  }

  /**
   * ID Lookup (Teaser Search)
   */
  async searchTeaser(query) {
    try {
      // When using proxy mode, the wrapper is configured to point to our proxy server
      // So we can use the library normally - it will make requests to our proxy (no CORS)
      // and our proxy will forward to the external API
      const wrapper = await this.getWrapper();
      const response = await wrapper.api.idLookup.searchTeaser(query);
      
      // Log the response structure for debugging
      if (process.env.NODE_ENV === 'development') {
        console.log('[API Wrapper] searchTeaser response type:', typeof response);
        console.log('[API Wrapper] response has getIdentities?', typeof response?.getIdentities === 'function');
        console.log('[API Wrapper] response has getCommerceContent?', typeof response?.getCommerceContent === 'function');
        console.log('[API Wrapper] response has getTeaserInput?', typeof response?.getTeaserInput === 'function');
        console.log('[API Wrapper] response has hasMore?', typeof response?.hasMore === 'function');
        console.log('[API Wrapper] response object keys:', Object.keys(response || {}));
        
        if (typeof response?.getIdentities === 'function') {
          const identities = response.getIdentities();
          console.log('[API Wrapper] getIdentities() returned:', identities?.length || 0, 'items');
          if (identities && identities.length > 0) {
            console.log('[API Wrapper] First identity sample:', JSON.stringify(identities[0]).substring(0, 200));
          }
        }
        if (typeof response?.getCommerceContent === 'function') {
          const commerceContent = response.getCommerceContent();
          console.log('[API Wrapper] getCommerceContent() returned:', commerceContent ? JSON.stringify(commerceContent).substring(0, 200) : 'null/undefined');
        }
        if (typeof response?.getTeaserInput === 'function') {
          const teaserInput = response.getTeaserInput();
          console.log('[API Wrapper] getTeaserInput() returned:', teaserInput ? JSON.stringify(teaserInput).substring(0, 200) : 'null/undefined');
        }
        if (typeof response?.hasMore === 'function') {
          const hasMore = response.hasMore();
          console.log('[API Wrapper] hasMore() returned:', hasMore);
        }
        // Check the wrapper's internal structure
        if (response && typeof response === 'object') {
          // The library wrapper might store data in params or other properties
          if (response.params) {
            console.log('[API Wrapper] response.params:', JSON.stringify(response.params).substring(0, 500));
            // Check the actual response data structure
            if (response.params.response) {
              const apiResponse = response.params.response;
              console.log('[API Wrapper] API Response status:', apiResponse.status);
              console.log('[API Wrapper] API Response data keys:', Object.keys(apiResponse.data || {}));
              console.log('[API Wrapper] API Response data:', JSON.stringify(apiResponse.data).substring(0, 500));
              
              // Check if it has raws structure (expected format)
              if (apiResponse.data?.raws) {
                console.log('[API Wrapper] ✓ Found raws array with', apiResponse.data.raws.length, 'items');
                if (apiResponse.data.raws[0]?.transient?.identities) {
                  console.log('[API Wrapper] ✓ Found', apiResponse.data.raws[0].transient.identities.length, 'identities in raws[0].transient.identities');
                } else {
                  console.log('[API Wrapper] ✗ No identities found in raws[0].transient');
                }
              } else if (apiResponse.data?.commerceContent === null) {
                console.log('[API Wrapper] ✗ Response has commerceContent: null - API returned empty result');
              } else {
                console.log('[API Wrapper] ⚠ Unexpected response structure');
              }
            }
          }
          if (response.options) {
            console.log('[API Wrapper] response.options:', JSON.stringify(response.options).substring(0, 300));
          }
          if (response.currentPage !== undefined) {
            console.log('[API Wrapper] response.currentPage:', response.currentPage);
          }
          
          // Try to access any data property
          const dataKeys = Object.keys(response).filter(key => 
            !['getIdentities', 'getCommerceContent', 'getTeaserInput', 'hasMore', 'getMore', 'params', 'options', 'currentPage'].includes(key)
          );
          if (dataKeys.length > 0) {
            console.log('[API Wrapper] Other response keys:', dataKeys);
            dataKeys.forEach(key => {
              try {
                const value = response[key];
                if (typeof value === 'object' && value !== null) {
                  console.log(`[API Wrapper] response.${key}:`, JSON.stringify(value).substring(0, 200));
                } else {
                  console.log(`[API Wrapper] response.${key}:`, value);
                }
              } catch (e) {
                console.log(`[API Wrapper] Could not access response.${key}:`, e.message);
              }
            });
          }
        }
      }
      
      return response;
    } catch (error) {
      // If we get a CORS error (shouldn't happen in proxy mode, but handle it anyway)
      if (this._isCorsError(error)) {
        console.warn('[API Wrapper] CORS error detected, this shouldn\'t happen in proxy mode');
        // Fallback to direct proxy call if needed
        return await this._searchTeaserViaProxy(query);
      }
      // Enhance error with more context for CORS detection
      const enhancedError = new Error(error.message || 'Search failed');
      enhancedError.originalError = error;
      enhancedError.isCorsError = this._isCorsError(error);
      throw enhancedError;
    }
  }

  /**
   * Search teaser via proxy (bypasses CORS)
   */
  async _searchTeaserViaProxy(query) {
    try {
      // Try to get clientId and apiId from the wrapper if it's initialized
      // Otherwise, they should be in the query object or environment variables
      let clientId = query.clientId || process.env.REACT_APP_CLIENT_ID;
      let apiId = query.apiId || process.env.REACT_APP_API_ID;
      
      // If wrapper is initialized, try to extract credentials from it
      if (!clientId || !apiId) {
        try {
          const wrapper = await this.getWrapper();
          // The wrapper might have these stored internally
          // Try to access them if the library exposes them
          if (wrapper && wrapper._config) {
            clientId = clientId || wrapper._config.clientId;
            apiId = apiId || wrapper._config.apiId;
          }
        } catch (e) {
          // Wrapper not available, continue with query/env vars
        }
      }
      
      // Extract query parameters for URL
      const queryParams = new URLSearchParams();
      if (clientId) queryParams.append('clientId', clientId);
      if (apiId) queryParams.append('apiId', apiId);
      
      // Build the proxy URL
      const proxyPath = '/idLookup/teaser/search';
      const url = `${this.proxyUrl}${proxyPath}${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
      
      // Prepare request body (exclude query params that go in URL)
      const body = { ...query };
      delete body.clientId;
      delete body.apiId;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(errorData.error?.message || errorData.message || `HTTP ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      const enhancedError = new Error(error.message || 'Proxy search failed');
      enhancedError.originalError = error;
      throw enhancedError;
    }
  }

  /**
   * Report endpoints
   */
  async createReport(params) {
    try {
      const wrapper = await this.getWrapper();
      return await wrapper.api.idLookup.createReport(params);
    } catch (error) {
      const enhancedError = new Error(error.message || 'Create report failed');
      enhancedError.originalError = error;
      enhancedError.isCorsError = this._isCorsError(error);
      throw enhancedError;
    }
  }

  async getReportList(params) {
    try {
      const wrapper = await this.getWrapper();
      const idLookup = wrapper.api?.idLookup;
      const candidateMethods = [
        idLookup?.getReportList,
        idLookup?.reportList,
        idLookup?.getReports,
        idLookup?.listReports,
        idLookup?.getReportListV2,
      ].filter((method) => typeof method === 'function');

      if (candidateMethods.length > 0) {
        return await candidateMethods[0](params);
      }

      // Fallback to direct proxy call if wrapper method is unavailable
      if (this.useProxy) {
        return await this._getReportListViaProxy(params);
      }

      throw new Error('Report list method not available in ApiWrapper');
    } catch (error) {
      const enhancedError = new Error(error.message || 'Get report list failed');
      enhancedError.originalError = error;
      enhancedError.isCorsError = this._isCorsError(error);
      throw enhancedError;
    }
  }

  async getReportDetail(id) {
    try {
      if (!id || id === 'undefined' || id === 'null') {
        throw new Error('Report detail requires a valid commerceContentId');
      }
      const wrapper = await this.getWrapper();
      if (typeof wrapper.api?.idLookup?.getReportDetail === 'function') {
        return await wrapper.api.idLookup.getReportDetail(id);
      }
      if (typeof wrapper.api?.idLookup?.getReport === 'function') {
        return await wrapper.api.idLookup.getReport(id);
      }
      throw new Error('Report detail method not available in ApiWrapper');
    } catch (error) {
      const enhancedError = new Error(error.message || 'Get report detail failed');
      enhancedError.originalError = error;
      enhancedError.isCorsError = this._isCorsError(error);
      throw enhancedError;
    }
  }

  /**
   * Report list via proxy (bypasses wrapper when method is missing)
   */
  async _getReportListViaProxy(params = {}) {
    try {
      let clientId = params.clientId || process.env.REACT_APP_CLIENT_ID;
      let apiId = params.apiId || process.env.REACT_APP_API_ID;

      if (!clientId || !apiId) {
        try {
          const wrapper = await this.getWrapper();
          if (wrapper && wrapper._config) {
            clientId = clientId || wrapper._config.clientId;
            apiId = apiId || wrapper._config.apiId;
          }
        } catch (e) {
          // Wrapper not available, continue with params/env vars
        }
      }

      const queryParams = new URLSearchParams();
      if (clientId) queryParams.append('clientId', clientId);
      if (apiId) queryParams.append('apiId', apiId);
      if (params.lastId) queryParams.append('lastId', params.lastId);

      const proxyPath = '/idLookup/report/list';
      const url = `${this.proxyUrl}${proxyPath}${queryParams.toString() ? '?' + queryParams.toString() : ''}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(errorData.error?.message || errorData.message || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      const enhancedError = new Error(error.message || 'Proxy report list failed');
      enhancedError.originalError = error;
      throw enhancedError;
    }
  }

  /**
   * Opt-Out endpoints
   */
  async requestOptOut(body) {
    try {
      const wrapper = await this.getWrapper();
      return await wrapper.api.optOut.request(body);
    } catch (error) {
      const enhancedError = new Error(error.message || 'Opt-out request failed');
      enhancedError.originalError = error;
      enhancedError.isCorsError = this._isCorsError(error);
      throw enhancedError;
    }
  }

  async confirmOptOut(params) {
    try {
      const wrapper = await this.getWrapper();
      return await wrapper.api.optOut.confirmation(params);
    } catch (error) {
      const enhancedError = new Error(error.message || 'Opt-out confirmation failed');
      enhancedError.originalError = error;
      enhancedError.isCorsError = this._isCorsError(error);
      throw enhancedError;
    }
  }
}

// Export singleton instance
export default new ApiWrapperService();
