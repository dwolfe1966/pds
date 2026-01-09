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
      this.wrapper = window.ApiWrapper.getInstance({
        endpointUrl: this.endpointUrl
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
      const wrapper = await this.getWrapper();
      return await wrapper.api.idLookup.searchTeaser(query);
    } catch (error) {
      // Enhance error with more context for CORS detection
      const enhancedError = new Error(error.message || 'Search failed');
      enhancedError.originalError = error;
      enhancedError.isCorsError = this._isCorsError(error);
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
