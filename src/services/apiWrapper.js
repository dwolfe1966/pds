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
    const wrapper = await this.getWrapper();
    return await wrapper.api.auth.login(body);
  }

  async logout() {
    const wrapper = await this.getWrapper();
    return await wrapper.api.auth.logout();
  }

  /**
   * ID Lookup (Teaser Search)
   */
  async searchTeaser(query) {
    const wrapper = await this.getWrapper();
    return await wrapper.api.idLookup.searchTeaser(query);
  }

  /**
   * Report endpoints
   */
  async createReport(params) {
    const wrapper = await this.getWrapper();
    return await wrapper.api.idLookup.createReport(params);
  }

  async getReportList(params) {
    const wrapper = await this.getWrapper();
    return await wrapper.api.idLookup.getReportList(params);
  }

  async getReportDetail(id) {
    const wrapper = await this.getWrapper();
    return await wrapper.api.idLookup.getReportDetail(id);
  }

  /**
   * Opt-Out endpoints
   */
  async requestOptOut(body) {
    const wrapper = await this.getWrapper();
    return await wrapper.api.optOut.request(body);
  }

  async confirmOptOut(params) {
    const wrapper = await this.getWrapper();
    return await wrapper.api.optOut.confirmation(params);
  }
}

// Export singleton instance
export default new ApiWrapperService();
