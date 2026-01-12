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
      return await wrapper.api.idLookup.searchTeaser(query);
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
      return await wrapper.api.idLookup.getReportList(params);
    } catch (error) {
      const enhancedError = new Error(error.message || 'Get report list failed');
      enhancedError.originalError = error;
      enhancedError.isCorsError = this._isCorsError(error);
      throw enhancedError;
    }
  }

  async getReportDetail(id) {
    try {
      const wrapper = await this.getWrapper();
      return await wrapper.api.idLookup.getReportDetail(id);
    } catch (error) {
      const enhancedError = new Error(error.message || 'Get report detail failed');
      enhancedError.originalError = error;
      enhancedError.isCorsError = this._isCorsError(error);
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
