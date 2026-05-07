/**
 * API Wrapper Service
 * 
 * Wraps the ByteCrtrs ApiWrapper library and provides a clean interface
 * for making API calls to the new external API.
 */

// Candidate URLs for BC's CSR IIFE. We don't know which (if any) is correct —
// they're attempted in order at first-CSR-call. Whichever responds with a
// script that defines window.CsrWrapper wins, and the choice is cached.
// Confirmed by ByteCrtrs as the CSR IIFE URL on dev1. The admin.html bundle
// preloads this via a static <script> tag, so loadCsrIife() is normally a
// no-op (window.CsrWrapper is already defined). The runtime list remains as
// a fallback in case the static tag fails to load (CORS, 503, etc.).
const CSR_IIFE_CANDIDATES = [
  'https://dev1.dev.www.bytecrtrs.com/libs/csr-wrapper/index.iife.js',
  'https://dev.www.bytecrtrs.com/libs/csr-wrapper/index.iife.js',
  '/libs/csr-wrapper/index.iife.js',
];

let _csrIifePromise = null;

function _loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve(src);
    s.onerror = () => reject(new Error(`failed to load ${src}`));
    document.head.appendChild(s);
  });
}

async function loadCsrIife() {
  if (_csrIifePromise) return _csrIifePromise;
  _csrIifePromise = (async () => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return null;
    if (window.CsrWrapper) {
      console.log('[CsrWrapper] already loaded');
      return window.CsrWrapper;
    }
    for (const url of CSR_IIFE_CANDIDATES) {
      try {
        await _loadScript(url);
        if (window.CsrWrapper) {
          console.log(`[CsrWrapper] loaded from ${url}`);
          return window.CsrWrapper;
        }
        console.log(`[CsrWrapper] script at ${url} loaded but did not expose window.CsrWrapper`);
      } catch (e) {
        // 404 or other load error — silent, try next candidate.
      }
    }
    console.log('[CsrWrapper] none of the candidate URLs returned a CSR IIFE — ask ByteCrtrs for the correct path');
    return null;
  })();
  return _csrIifePromise;
}

class ApiWrapperService {
  constructor() {
    this.wrapper = null;
    this.csrWrapper = null;
    this.initialized = false;
    // BC API base URL — passed to getInstance() so the IIFE knows where to send requests.
    // In dev proxy mode this is overridden with the local proxy URL.
    // Dev fallbacks are dev-only so production bundles don't leak vendor URLs
    // or localhost ports if an env var is missing — prod always reads from
    // .env.production (relative `/api`, empty proxy).
    const _isDev = process.env.NODE_ENV === 'development';
    this.endpointUrl = process.env.REACT_APP_NEW_API_URL || (_isDev ? 'https://dev.www.bytecrtrs.com/api' : '/api');
    this.authUrl = process.env.REACT_APP_AUTH_API_URL || (_isDev ? 'https://dev1.dev.www.bytecrtrs.com/api' : '/api');
    this.proxyUrl = process.env.REACT_APP_PROXY_URL || (_isDev ? 'http://localhost:3001/api/proxy' : '');
    const explicitProxy = process.env.REACT_APP_USE_API_PROXY === 'true';
    const devProxy = process.env.NODE_ENV === 'development' &&
      (this.proxyUrl.startsWith('http://localhost') || this.proxyUrl.startsWith('http://127.0.0.1'));
    this.useProxy = explicitProxy || devProxy;
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
      // Always pass endpointUrl so the IIFE knows where to send requests.
      // In dev proxy mode: point to the local Express proxy.
      // In production: point directly to the BC API.
      const endpointUrl = this.useProxy ? this.proxyUrl : this.endpointUrl;
      this.wrapper = window.ApiWrapper.getInstance({ endpointUrl });
      this._installCaptchaAutofill();
      this.initialized = true;
      return this.wrapper;
    } catch (error) {
      console.error('Failed to initialize ApiWrapper:', error);
      throw error;
    }
  }

  /**
   * Auto-fill BC's password.v0 captcha modal so users never see the prompt.
   *
   * BC's IIFE shows a generic "Input Password" modal on every captcha challenge
   * and forwards whatever the user types as the verify token. The expected
   * password is provisioned by BC per environment (REACT_APP_NEW_API_CAPTCHA).
   * We override the instance's executePasswordCaptcha to skip the modal and
   * return the configured password directly.
   *
   * No-ops if the env var isn't set or the IIFE structure changes (so we
   * fall back to BC's modal rather than breaking silently).
   */
  _installCaptchaAutofill() {
    const captchaPass = process.env.REACT_APP_NEW_API_CAPTCHA;
    if (!captchaPass) return;
    if (!this.wrapper?.captcha || typeof this.wrapper.captcha.executePasswordCaptcha !== 'function') return;
    this.wrapper.captcha.executePasswordCaptcha = async () => ({ token: captchaPass });
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
   * Check if the consumer IIFE wrapper is available
   */
  isAvailable() {
    return typeof window !== 'undefined' && window.ApiWrapper !== undefined;
  }

  /**
   * Check if CSR (admin) API calls are possible.
   * CSR methods use direct fetch to the proxy — they don't need the IIFE.
   */
  isCsrReady() {
    return !!this.proxyUrl || !!this.endpointUrl;
  }

  /**
   * Auth endpoints
   */
  async login(body) {
    if (this.useProxy) {
      try {
        await this.getWrapper().catch(() => {});
        const result = await this._loginViaProxy(body);
        return result;
      } catch (error) {
        const enhancedError = new Error(error.message || 'Login failed');
        enhancedError.originalError = error;
        enhancedError.status = error.status;
        enhancedError.data = error.data;
        throw enhancedError;
      }
    }
    try {
      const wrapper = await this.getWrapper();
      const result = await wrapper.api.auth.login(body);
      return result;
    } catch (error) {
      const enhancedError = new Error(error.message || 'Login failed');
      enhancedError.originalError = error;
      enhancedError.isCorsError = this._isCorsError(error);
      throw enhancedError;
    }
  }

  async _loginViaProxy(body) {
    const clientId = this.wrapper?.clientId || this._generateRandomId();
    const apiId = this._generateRandomId();
    const url = `${this.proxyUrl}/auth/login?clientId=${clientId}&apiId=${apiId}`;
    const response = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      const err = new Error(errorData.message || errorData.error?.message || `HTTP ${response.status}`);
      err.status = response.status;
      err.data = errorData;
      throw err;
    }
    return await response.json();
  }

  async _loginDirectly(body) {
    const clientId = this._generateRandomId();
    const apiId = this._generateRandomId();
    const url = `${this.authUrl}/auth/login?clientId=${clientId}&apiId=${apiId}`;
    const response = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      const err = new Error(errorData.message || errorData.error?.message || `HTTP ${response.status}`);
      err.status = response.status;
      err.data = errorData;
      throw err;
    }
    return await response.json();
  }

  async logout() {
    if (this.useProxy) {
      try {
        await this.getWrapper().catch(() => {});
        const clientId = this.wrapper?.clientId || this._generateRandomId();
        const apiId = this._generateRandomId();
        const url = `${this.proxyUrl}/auth/logout?clientId=${clientId}&apiId=${apiId}`;
        await fetch(url, { method: 'POST', credentials: 'include' });
        return { success: true };
      } catch {
        return { success: true };
      }
    }
    try {
      const wrapper = await this.getWrapper();
      return await wrapper.api.auth.logout();
    } catch {
      return { success: true };
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
    // In proxy mode, bypass the IIFE and POST directly to the proxy.
    // The IIFE ignores our endpointUrl and calls BC directly, causing CORS.
    if (this.useProxy) {
      return await this._searchTeaserViaProxy(query);
    }
    try {
      if (process.env.NODE_ENV === 'development') {
        console.log('[ByteCrtrs API] searchTeaser called with params:', JSON.stringify(query, null, 2));
        const perPageKeys = ['perPage', 'per_page', 'pageSize'];
        const hasPerPage = perPageKeys.some(k => query[k] != null);
        console.log('[ByteCrtrs API] Results-per-page:', hasPerPage ? perPageKeys.map(k => `${k}=${query[k]}`).filter(Boolean).join(', ') : 'NOT SET');
        console.log('[ByteCrtrs API] Is pagination (getMore):', !!(query.commerceContentId && query.page != null));
      }
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

      // Treat API error payload (401, 412, 400, 500) as failure – include ByteCrtrs details for debugging
      if (response && response.params && response.params.error) {
        const err = response.params.error;
        const status = err.response?.status || err.status;
        const apiData = err.response?.data;
        const message = apiData?.message || apiData?.error?.message || (typeof apiData?.error === 'string' ? apiData.error : null) || err.message || 'Search failed';
        const e = new Error(message);
        e.originalError = err;
        e.status = status;
        e.apiResponse = apiData;
        if (process.env.NODE_ENV === 'development') {
          console.error('[ByteCrtrs] Search failed. Full API response:', apiData || err.response);
        }
        throw e;
      }
      
      return response;
    } catch (error) {
      // If we get a CORS error (shouldn't happen in proxy mode, but handle it anyway)
      if (this._isCorsError(error)) {
        console.warn('[API Wrapper] CORS error detected, this shouldn\'t happen in proxy mode');
        // Fallback to direct proxy call if needed
        return await this._searchTeaserViaProxy(query);
      }
      // Enhance error with ByteCrtrs response for debugging (500, etc.)
      const enhancedError = new Error(error.message || 'Search failed');
      enhancedError.originalError = error;
      enhancedError.isCorsError = this._isCorsError(error);
      enhancedError.status = error.response?.status;
      enhancedError.apiResponse = error.response?.data;
      throw enhancedError;
    }
  }

  /**
   * Teaser search via proxy — bypasses the IIFE (which ignores endpointUrl and calls BC directly).
   */
  async _searchTeaserViaProxy(query) {
    await this.getWrapper().catch(() => {});
    // Always generate fresh IDs — reusing the IIFE's cached clientId can cause
    // BC to reject requests if the ID was flagged from previous failed attempts.
    const clientId = this._generateRandomId();
    const apiId = this._generateRandomId();
    const url = `${this.proxyUrl}/idLookup/teaser/search?clientId=${clientId}&apiId=${apiId}`;
    const response = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(query),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      const err = new Error(errorData.error?.message || errorData.message || `HTTP ${response.status}`);
      err.status = response.status;
      throw err;
    }
    return await response.json();
  }

  /**
   * Report endpoints
   */
  async createReport(params) {
    if (this.useProxy) {
      await this.getWrapper().catch(() => {});
      const clientId = this.wrapper?.clientId || this._generateRandomId();
      const apiId = this._generateRandomId();
      const url = `${this.proxyUrl}/idLookup/report/create?clientId=${clientId}&apiId=${apiId}`;
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        const err = new Error(errorData.error?.message || errorData.message || `HTTP ${response.status}`);
        err.status = response.status;
        throw err;
      }
      return await response.json();
    }
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
    // In proxy mode, bypass IIFE (it calls BC directly, causing CORS + 403)
    if (this.useProxy) {
      return await this._getReportListViaProxy(params);
    }
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

      throw new Error('Report list method not available in ApiWrapper');
    } catch (error) {
      const enhancedError = new Error(error.message || 'Get report list failed');
      enhancedError.originalError = error;
      enhancedError.isCorsError = this._isCorsError(error);
      throw enhancedError;
    }
  }

  async getReportDetail(id) {
    if (!id || id === 'undefined' || id === 'null') {
      throw new Error('Report detail requires a valid commerceContentId');
    }
    if (this.useProxy) {
      await this.getWrapper().catch(() => {});
      const clientId = this.wrapper?.clientId || this._generateRandomId();
      const apiId = this._generateRandomId();
      const url = `${this.proxyUrl}/idLookup/report/detail/${id}?clientId=${clientId}&apiId=${apiId}`;
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        const err = new Error(errorData.error?.message || errorData.message || `HTTP ${response.status}`);
        err.status = response.status;
        throw err;
      }
      return await response.json();
    }
    try {
      const wrapper = await this.getWrapper();
      if (typeof wrapper.api?.idLookup?.getReportDetail === 'function') {
        return await wrapper.api.idLookup.getReportDetail(id);
      }
      if (typeof wrapper.api?.idLookup?.getReport === 'function') {
        return await wrapper.api.idLookup.getReport({ commerceContentId: id });
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
      // Ensure IIFE is initialized so we can read its clientId
      await this.getWrapper().catch(() => {});
      const clientId = this.wrapper?.clientId || this._generateRandomId();
      const apiId = this._generateRandomId();

      const queryParams = new URLSearchParams({ clientId, apiId });
      if (params.lastId) queryParams.append('lastId', params.lastId);

      const proxyPath = '/idLookup/report/list';
      const baseUrl = this.useProxy ? this.proxyUrl : this.endpointUrl;
      const url = `${baseUrl}${proxyPath}?${queryParams.toString()}`;

      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
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

  /**
   * Search opt-out status before submitting request
   * POST /optOut/search - Check if a record is already opted out
   */
  async searchOptOut(params) {
    try {
      const wrapper = await this.getWrapper();
      if (typeof wrapper.api?.optOut?.search === 'function') {
        return await wrapper.api.optOut.search(params);
      }
      throw new Error('Opt-out search not available in ApiWrapper');
    } catch (error) {
      const enhancedError = new Error(error.message || 'Opt-out search failed');
      enhancedError.originalError = error;
      enhancedError.isCorsError = this._isCorsError(error);
      throw enhancedError;
    }
  }

  /**
   * Download report as PDF — triggers a BC-managed download popup in the browser.
   * Per BC API docs: calling this opens a popup where the user clicks Confirm to download.
   * commerceContentId must be from a detail report (createReport), not a teaser.
   */
  async downloadPdfReport(commerceContentId) {
    try {
      const wrapper = await this.getWrapper();
      if (typeof wrapper.api?.idLookup?.downloadPdfReport === 'function') {
        return await wrapper.api.idLookup.downloadPdfReport({ commerceContentId });
      }
      throw new Error('downloadPdfReport not available in ApiWrapper');
    } catch (error) {
      const enhancedError = new Error(error.message || 'PDF download failed');
      enhancedError.originalError = error;
      enhancedError.isCorsError = this._isCorsError(error);
      throw enhancedError;
    }
  }

  /**
   * Register a user in ByteCrtrs without payment (pre-payment signup step)
   * POST /commerceBilling/signup
   */
  async billingSignup(params) {
    try {
      const wrapper = await this.getWrapper();
      if (typeof wrapper.api?.billing?.signup === 'function') {
        const result = await wrapper.api.billing.signup(params);
        // IIFE catches HTTP errors internally — check explicitly.
        const iifErr = result?.getError?.();
        if (iifErr) {
          const errData = iifErr?.response?.data;
          const errStatus = iifErr?.response?.status ?? iifErr?.status;
          const errMsg = errData?.message || errData?.error || iifErr?.message || 'Billing signup failed';
          const enhanced = new Error(errMsg);
          enhanced.status = errStatus;
          enhanced.data = errData;
          throw enhanced;
        }
        return result;
      }
      throw new Error('Billing signup not available in ApiWrapper');
    } catch (error) {
      const enhancedError = new Error(error.message || 'Billing signup failed');
      enhancedError.originalError = error;
      enhancedError.status = error.status;
      enhancedError.data = error.data;
      enhancedError.isCorsError = this._isCorsError(error);
      throw enhancedError;
    }
  }

  /**
   * Get all orders for the logged-in user.
   * POST /api/commerceBilling/getUserOrders
   * Returns array of orders; active subscriber = status 'active' + transient.canceled false.
   */
  async getOrders() {
    try {
      const wrapper = await this.getWrapper();
      if (process.env.NODE_ENV === 'development') {
        console.log('[BC Billing] Available billing methods:', Object.keys(wrapper.api?.billing || {}));
      }
      // BC library may expose this as getUserOrders or getOrders
      const fn = wrapper.api?.billing?.getUserOrders ?? wrapper.api?.billing?.getOrders;
      if (typeof fn === 'function') {
        return await fn.call(wrapper.api.billing);
      }
      // IIFE is outdated and missing this method — fall back to direct proxy fetch.
      if (process.env.NODE_ENV === 'development') {
        console.warn('[BC Billing] getUserOrders/getOrders not found in IIFE; falling back to proxy fetch.');
      }
      return await this._getUserOrdersViaProxy();
    } catch (error) {
      const enhancedError = new Error(error.message || 'Get orders failed');
      enhancedError.originalError = error;
      enhancedError.isCorsError = this._isCorsError(error);
      throw enhancedError;
    }
  }

  /**
   * Proxy fallback for getUserOrders (used when the IIFE billing module is missing the method).
   * POST /api/commerceBilling/getUserOrders via the Express proxy at /api/proxy/*
   * Returns the raw response body (array or wrapped object) for apiRouter to unwrap.
   */
  async _getUserOrdersViaProxy() {
    // BC requires clientId + apiId as URL query params on this endpoint.
    // clientId is the stable random ID on the IIFE instance; apiId is per-request.
    const clientId = this.wrapper?.clientId || this._generateRandomId();
    const apiId = this._generateRandomId();
    const baseUrl = this.useProxy ? this.proxyUrl : this.endpointUrl;
    const url = `${baseUrl}/commerceBilling/getUserOrders?clientId=${clientId}&apiId=${apiId}`;
    const response = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(errorData.error?.message || errorData.message || `HTTP ${response.status}`);
    }

    return await response.json();
  }

  // ---------------------------------------------------------------------------
  // CSR (admin) API — calls BC csrWrapper endpoints directly via proxy or direct
  // ---------------------------------------------------------------------------

  /**
   * POST to a csrWrapper endpoint. Respects useProxy/endpointUrl so it works
   * in both dev (Express proxy) and production (direct BC with CORS).
   */
  async _csrPost(path, body = {}) {
    const baseUrl = this.useProxy
      ? `${this.proxyUrl}${path}`
      : `${this.endpointUrl}${path}`;
    const clientId = this.wrapper?.clientId || this._generateRandomId();
    const apiId = this._generateRandomId();
    const sep = path.includes('?') ? '&' : '?';
    const url = `${baseUrl}${sep}clientId=${clientId}&apiId=${apiId}`;
    const response = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      const err = new Error(errorData.error?.message || errorData.message || `HTTP ${response.status}`);
      err.status = response.status;
      err.data = errorData;
      throw err;
    }
    const json = await response.json();
    return json;
  }

  /**
   * Load (if needed) the BC CSR IIFE and return its initialized client.
   * Returns null if BC hasn't published the CSR IIFE at any URL we know.
   * Cached across calls.
   */
  async getCsrWrapper() {
    if (this.csrWrapper) {
      return this.csrWrapper;
    }
    const Cls = await loadCsrIife();
    if (!Cls) {
      return null;
    }
    try {
      this.csrWrapper = typeof Cls.getInstance === 'function'
        ? Cls.getInstance({ endpointUrl: '/api' })
        : Cls;
      return this.csrWrapper;
    } catch (e) {
      console.log('[CsrWrapper] getInstance() failed:', e?.message);
      return null;
    }
  }

  /**
   * Prefer the CSR IIFE method for a given dot-path; fall back to the
   * supplied async function if the wrapper isn't loaded or the method
   * doesn't exist (or throws). Use this anywhere we'd otherwise call
   * _csrPost('/some/path', body) directly so BC's wrapper handles the
   * canonical URL/auth/error envelope.
   *
   * @param {string} dotPath e.g. 'api.user.findOrders'
   * @param {*} args         passed straight through to the wrapper method
   * @param {() => Promise<*>} fallback
   */
  async _viaCsr(dotPath, args, fallback) {
    try {
      const csr = await this.getCsrWrapper();
      if (csr) {
        const parts = dotPath.split('.');
        let parent = csr;
        for (let i = 0; i < parts.length - 1; i++) {
          parent = parent == null ? parent : parent[parts[i]];
        }
        const fn = parent == null ? null : parent[parts[parts.length - 1]];
        if (typeof fn === 'function') {
          return await fn.call(parent, args);
        }
      }
    } catch (err) {
      console.log(`[CsrWrapper] ${dotPath} threw, falling back: ${err?.message}`);
    }
    return await fallback();
  }

  /**
   * GET to a csrWrapper endpoint. Mirrors _csrPost for GET-only BC routes.
   */
  async _csrGet(path) {
    const baseUrl = this.useProxy
      ? `${this.proxyUrl}${path}`
      : `${this.endpointUrl}${path}`;
    const clientId = this.wrapper?.clientId || this._generateRandomId();
    const apiId = this._generateRandomId();
    const sep = path.includes('?') ? '&' : '?';
    const url = `${baseUrl}${sep}clientId=${clientId}&apiId=${apiId}`;
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      const err = new Error(errorData.error?.message || errorData.message || `HTTP ${response.status}`);
      err.status = response.status;
      err.data = errorData;
      throw err;
    }
    const json = await response.json();
    return json;
  }

  // csrWrapper.api.user.find — POST /database/search
  // Direct /database/search retained: the IIFE's api.user.find returns a
  // different envelope shape than our callers parse, so wrapper-first here
  // breaks UsersPage. Revisit once the response normalization is unified.
  async csrFindUsers(params = {}) {
    return await this._csrPost('/database/search', { brandId: 'idlookup', collectionName: 'users', ...params });
  }

  // csrWrapper.api.user.findAdmin — POST /database/search (CSR/admin users)
  async csrFindCsReps(params = {}) {
    return await this._csrPost('/database/search', { brandId: 'idlookup', collectionName: 'users', isAdmin: true, ...params });
  }

  // csrWrapper.api.user.getUserDetail — POST /user/management/detail
  async csrGetUserDetail(userId) {
    return await this._viaCsr('api.user.getUserDetail', { userId },
      () => this._csrPost('/user/management/detail', { userId }));
  }

  // csrWrapper.api.user.update — POST /user/management/update
  async csrUpdateUser(userId, body = {}) {
    return await this._viaCsr('api.user.update', { userId, ...body },
      () => this._csrPost('/user/management/update', { userId, ...body }));
  }

  // csrWrapper.api.user.create — POST /user/management/create
  async csrCreateUser(body = {}) {
    return await this._viaCsr('api.user.create', body,
      () => this._csrPost('/user/management/create', body));
  }

  // csrWrapper.api.user.findOrders — POST /commerceMgmt/userOrders
  // Returns { orders: [...], perPage: N }
  //
  // Some BC deployments don't expose /commerceMgmt/userOrders (returns 404).
  // When that happens, fall back to /database/search on the commerceOrder
  // collection filtered by payerId, then normalize the response shape so
  // callers see the same { orders, perPage } envelope either way.
  async csrFindUserOrders(params = {}) {
    // Direct POST primary — the IIFE wrapper returns a different envelope
    // shape than callers expect. With the path typo fixed (commerceMgmt vs
    // commerceMgnt), this hits the right URL directly.
    try {
      return await this._csrPost('/commerceMgmt/userOrders', params);
    } catch (err) {
      if (err?.status !== 404 && err?.status !== 405) throw err;
      const { userId, lastOrderId } = params;
      if (!userId) throw err;

      // BC's /database/search filter shape isn't documented for commerceOrder;
      // try the most likely variants in sequence and return the first hit.
      const baseBody = { collectionName: 'commerceOrder', brandId: 'idlookup' };
      const strategies = [
        { name: 'payerId',         body: { ...baseBody, payerId: userId } },
        { name: 'payerId+filter',  body: { ...baseBody, filter: { payerId: userId } } },
        { name: 'index payer',     body: { ...baseBody, index: `payer:${userId}` } },
      ];
      if (lastOrderId) strategies.forEach((s) => { s.body.lastId = lastOrderId; });

      console.log(`[csrFindUserOrders] /commerceMgmt/userOrders → 404 for userId=${userId}; trying ${strategies.length + 1} /database/search variants`);

      for (const strat of strategies) {
        try {
          const raw = await this._csrPost('/database/search', strat.body);
          const orders = raw?.docs ?? raw?.orders ?? raw?.data ?? (Array.isArray(raw) ? raw : []);
          console.log(`[csrFindUserOrders] strategy "${strat.name}": ${orders.length} order(s); response keys=${Object.keys(raw || {}).join(',')}`);
          if (orders.length > 0) {
            return {
              orders,
              perPage: orders.length,
              noMoreDocs: raw?.noMoreDocs ?? true,
              _fallback: `database-search:${strat.name}`,
            };
          }
        } catch (sErr) {
          console.log(`[csrFindUserOrders] strategy "${strat.name}" failed: ${sErr?.message}`);
        }
      }

      // Final brute-force: probe multiple collection / brandId combinations
      // since BC may store orders under a different shape than the docs imply.
      // First combination that returns >0 docs wins. Then filter by payerId
      // client-side. Each probe is a single page so this stays bounded.
      const probes = [
        { collectionName: 'commerceOrder',   brandId: 'idlookup'  },
        { collectionName: 'commerceOrder',   brandId: 'bytecrtrs' },
        { collectionName: 'commerceOrder'                          },
        { collectionName: 'commerceOrders',  brandId: 'idlookup'  },
        { collectionName: 'orders',          brandId: 'idlookup'  },
        // Diagnostic-only: if these return docs but commerceOrder doesn't,
        // /database/search has selective collection-level gating on this BC.
        { collectionName: 'commercePayment', brandId: 'idlookup'  },
        { collectionName: 'commerceToken',   brandId: 'idlookup'  },
      ];

      let workingProbe = null;
      for (const probe of probes) {
        try {
          const raw = await this._csrPost('/database/search', {
            ...probe,
            sort: { createdAt: -1 },
            sortBy: 'createdAt',
            sortOrder: 'desc',
          });
          const docs = raw?.docs ?? raw?.orders ?? raw?.data ?? (Array.isArray(raw) ? raw : []);
          // Log the first doc's keys + brandId so we can see what BC actually has.
          const firstDocKeys = docs[0] ? Object.keys(docs[0]).slice(0, 12).join(',') : 'n/a';
          const firstDocBrand = docs[0]?.brandId || 'n/a';
          const firstDocPayer = docs[0]?.payerId || 'n/a';
          console.log(`[csrFindUserOrders] probe ${JSON.stringify(probe)} → ${docs.length} doc(s); first.brandId=${firstDocBrand} first.payerId=${firstDocPayer} keys=[${firstDocKeys}]`);
          if (docs.length > 0) {
            workingProbe = { probe, firstPage: docs };
            break;
          }
        } catch (sErr) {
          console.log(`[csrFindUserOrders] probe ${JSON.stringify(probe)} failed: ${sErr?.message}`);
        }
      }

      if (!workingProbe) {
        console.log('[csrFindUserOrders] no probe returned any commerceOrder docs — BC has no orders accessible to this session, or the schema differs from what we expect');
        return { orders: [], perPage: 0, noMoreDocs: true, _fallback: 'database-search:no-data' };
      }

      // Page through using the working probe shape; client-filter each page;
      // early-exit on first match.
      try {
        const aggregated = [...workingProbe.firstPage];
        const earlyMatch0 = aggregated.find((o) => o?.payerId === userId);
        if (!earlyMatch0) {
          let cursor = aggregated[aggregated.length - 1]?._id;
          const MAX_PAGES = 10;
          for (let i = 1; i < MAX_PAGES && cursor; i++) {
            const body = {
              ...workingProbe.probe,
              sort: { createdAt: -1 },
              sortBy: 'createdAt',
              sortOrder: 'desc',
              lastId: cursor,
            };
            const raw = await this._csrPost('/database/search', body);
            const docs = raw?.docs ?? raw?.orders ?? raw?.data ?? (Array.isArray(raw) ? raw : []);
            if (docs.length === 0) break;
            aggregated.push(...docs);
            if (aggregated.some((o) => o?.payerId === userId)) break;
            cursor = docs[docs.length - 1]?._id;
            if (raw?.noMoreDocs || !cursor) break;
          }
        }
        const matched = aggregated.filter((o) => o?.payerId === userId);
        const oldestScanned = aggregated[aggregated.length - 1]?.createdAt;
        const newestScanned = aggregated[0]?.createdAt;
        console.log(`[csrFindUserOrders] working probe scan: ${matched.length} match(es) of ${aggregated.length} scanned (range: ${newestScanned || '?'} → ${oldestScanned || '?'})`);
        if (matched.length > 0) {
          return {
            orders: matched,
            perPage: matched.length,
            noMoreDocs: true,
            _fallback: `database-search:${workingProbe.probe.collectionName}`,
            _scannedCount: aggregated.length,
          };
        }
      } catch (sErr) {
        console.log(`[csrFindUserOrders] working probe scan failed: ${sErr?.message}`);
      }

      console.log(`[csrFindUserOrders] all fallback strategies returned empty for userId=${userId}`);
      return { orders: [], perPage: 0, noMoreDocs: true, _fallback: 'database-search:empty' };
    }
  }

  // Global order search via /database/search — collectionName: 'commerceOrder'.
  // Direct only: BC's IIFE has no global commerceOrder finder; api.user.findOrders
  // requires userId and 400s on bare brandId.
  async csrFindOrders(params = {}) {
    return await this._csrPost('/database/search', { brandId: 'idlookup', collectionName: 'commerceOrder', ...params });
  }

  // csrWrapper.api.user.getOrder — POST /commerceMgmt/getUserOrder
  // params: { userId, orderId, lastPaymentId? }
  //
  // Same 404 risk as csrFindUserOrders on some BC deployments — fall back to
  // /database/search filtered by order _id and normalize the response shape.
  async csrGetUserOrder(params = {}) {
    // Direct POST primary — same envelope-mismatch risk as csrFindUserOrders.
    try {
      return await this._csrPost('/commerceMgmt/getUserOrder', params);
    } catch (err) {
      if (err?.status !== 404 && err?.status !== 405) throw err;
      if (process.env.NODE_ENV === 'development') {
        console.warn('[csrGetUserOrder] /commerceMgmt/getUserOrder unavailable, falling back to /database/search by _id');
      }
      const { orderId } = params;
      if (!orderId) throw err;
      const raw = await this._csrPost('/database/search', {
        collectionName: 'commerceOrder',
        brandId: 'idlookup',
        _id: orderId,
      });
      const docs = raw?.docs ?? raw?.orders ?? raw?.data ?? (Array.isArray(raw) ? raw : []);
      return {
        orders: docs.slice(0, 1),
        _fallback: 'database-search',
      };
    }
  }

  // csrWrapper.api.user.cancelUncancelOrder — POST /commerceMgmt/cancelUncancelOrder
  // flag: true = cancel, false = uncancel
  async csrCancelUncancelOrder(orderId, flag) {
    return await this._viaCsr('api.user.cancelUncancelOrder', { orderId, flag },
      () => this._csrPost('/commerceMgmt/cancelUncancelOrder', { orderId, flag }));
  }

  // csrWrapper.api.user.refundVoidOrder — POST /commerceBilling/correct
  // params: { commercePaymentType, targetCommerceOrderId, targetCommerceOrderRevisionId,
  //           targetCommercePaymentId, targetCommercePaymentRevisionId, amount }
  async csrRefundVoidOrder(params = {}) {
    return await this._viaCsr('api.user.refundVoidOrder', params,
      () => this._csrPost('/commerceBilling/correct', params));
  }

  // csrWrapper.api.user.findOrderPayments — POST /commerceMgmt/orderPayments
  // params: { orderId, lastPaymentId? }
  async csrFindOrderPayments(orderId, lastPaymentId) {
    const body = { orderId };
    if (lastPaymentId) body.lastPaymentId = lastPaymentId;
    return await this._csrPost('/commerceMgmt/orderPayments', body);
  }

  // csrWrapper.api.user.findOrderHistories — POST /commerceMgmt/orderHistories
  // params: { orderId, lastRevisionId? }
  async csrFindOrderHistories(orderId, lastRevisionId) {
    const body = { orderId };
    if (lastRevisionId) body.lastRevisionId = lastRevisionId;
    return await this._csrPost('/commerceMgmt/orderHistories', body);
  }

  // csrWrapper.api.user.updateScheduleDueTimestamp — POST /commerceMgmt/updateScheduleDueTimestamp
  // params: { scheduleId, dueTimestamp }
  async csrUpdateScheduleDueTimestamp(scheduleId, dueTimestamp) {
    return await this._viaCsr('api.user.updateScheduleDueTimestamp', { scheduleId, dueTimestamp },
      () => this._csrPost('/commerceMgmt/updateScheduleDueTimestamp', { scheduleId, dueTimestamp }));
  }

  // POST /commerce/offer/findByShmName — added 2026-04-21
  // Returns the offer with transient.priceInfo.s0/s1 and extName.
  // params: { shmName, key? } — key defaults to 'main' on BC if omitted.
  async csrFindOfferByShmName(params = {}) {
    return await this._viaCsr('api.offer.findByShmName', params,
      () => this._csrPost('/commerce/offer/findByShmName', params));
  }

  // CSR-initiated billing sale — POST /commerceBilling/sale
  // Used by CS agents to create orders on behalf of users (retention, comp, downsell).
  // Uses the admin session (connect.sid) so BC tags it as a CSR-initiated order.
  async csrCreateOrder(params = {}) {
    return await this._viaCsr('api.billing.sale', params,
      () => this._csrPost('/commerceBilling/sale', params));
  }

  // csrWrapper.api.optOut.find — POST /database/search
  // Direct only: same envelope issue as csrFindUsers.
  async csrFindOptOuts(params = {}) {
    return await this._csrPost('/database/search', { brandId: 'idlookup', collectionName: 'optOutRequest', ...params });
  }

  // csrWrapper.api.user.findUserContacts — POST /database/search (collectionName: userContact)
  // Returns notes, csr mails, and user contacts for a given userId.
  // BC filters by targetUserId on this collection.
  async csrFindUserContacts(params = {}) {
    const { userId, ...rest } = params;
    const body = { collectionName: 'userContact', ...rest };
    if (userId) body.targetUserId = userId;
    return await this._csrPost('/database/search', body);
  }

  // csrWrapper.api.message.note.createUserAdminNote — POST /message/admin/createNote
  // params: { userId, message, contentType, attachments }
  // BC documented the new path on 2026-04-17; fall back to the old path if BC's
  // dev backend hasn't deployed the new one yet (404/405). Targeted attempts only —
  // any other error re-throws immediately so real failures surface to the user.
  async csrCreateAdminNote(params = {}) {
    const { userId, message, contentType = 'text/plain', attachments } = params;
    const body = { userId, message, contentType };
    if (attachments) body.attachments = attachments;
    // Prefer the IIFE method when available — it knows the canonical path.
    try {
      const csr = await this.getCsrWrapper();
      const fn = csr?.api?.message?.note?.createUserAdminNote;
      if (typeof fn === 'function') return await fn.call(csr.api.message.note, body);
    } catch (csrErr) {
      console.log('[csrCreateAdminNote] CsrWrapper failed, falling back:', csrErr?.message);
    }
    try {
      return await this._csrPost('/message/admin/createNote', body);
    } catch (err) {
      if (err?.status === 404 || err?.status === 405) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[csrCreateAdminNote] new path not live; falling back to legacy /message/admin/user/note/create');
        }
        const legacyBody = { targetUserId: userId, message, contentType };
        if (attachments) legacyBody.attachments = attachments;
        return await this._csrPost('/message/admin/user/note/create', legacyBody);
      }
      throw err;
    }
  }

  // csrWrapper.api.message.note.createContactAdminNote — POST /message/admin/createNote
  // params: { contactMessageId, message, contentType, attachments }
  async csrCreateContactAdminNote(params = {}) {
    const { contactMessageId, message, contentType = 'text/plain', attachments } = params;
    const body = { contactMessageId, message, contentType };
    if (attachments) body.attachments = attachments;
    return await this._viaCsr('api.message.note.createContactAdminNote', body,
      () => this._csrPost('/message/admin/createNote', body));
  }

  // csrWrapper.api.message.note.updateAdminNote — POST /message/admin/updateNote
  // params: { messageId, message }
  // Dual-stack: try new path, fall back to legacy if BC hasn't deployed yet.
  async csrUpdateAdminNote(params = {}) {
    try {
      const csr = await this.getCsrWrapper();
      const fn = csr?.api?.message?.note?.updateAdminNote;
      if (typeof fn === 'function') return await fn.call(csr.api.message.note, params);
    } catch (csrErr) {
      console.log('[csrUpdateAdminNote] CsrWrapper failed, falling back:', csrErr?.message);
    }
    try {
      return await this._csrPost('/message/admin/updateNote', params);
    } catch (err) {
      if (err?.status === 404 || err?.status === 405) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[csrUpdateAdminNote] new path not live; falling back to legacy /message/admin/user/note/update');
        }
        return await this._csrPost('/message/admin/user/note/update', params);
      }
      throw err;
    }
  }

  // csrWrapper.api.user.createCsrMail — POST /message/admin/user/csrMail/create
  // params: { targetUserId, subject, message }
  async csrCreateCsrMail(params = {}) {
    return await this._viaCsr('api.user.createCsrMail', params,
      () => this._csrPost('/message/admin/user/csrMail/create', params));
  }

  // csrWrapper.api.message.contact.find — GET /api/contactMessage/admin/find
  // Lists all contactMessages (member-linked and non-member) sorted by latest reply
  // or by contact date if no reply exists. Each record may include a latestReply.
  async csrFindContactMessages(params = {}) {
    // Direct only: IIFE's api.message.contact.find returns a different
    // envelope shape than our parsers expect, breaking the inbox + dashboard.
    const qs = new URLSearchParams();
    if (params.lastId) qs.set('lastId', params.lastId);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return await this._csrGet(`/contactMessage/admin/find${suffix}`);
  }

  // csrWrapper.api.user.findUserContacts — POST /contactMessage/admin/find/:targetUserId
  // Lists contactMessages where targetUserId matches. Used to show a user's
  // open tickets on UserDetailPage without leaving the profile.
  //
  // Falls back to the known-working /contactMessage/admin/find (no path param)
  // and filters client-side when BC's targetUserId variant is unavailable on
  // this deployment.
  async csrFindUserContactMessages({ userId, lastId } = {}) {
    if (!userId) throw new Error('userId is required');
    try {
      return await this._csrPost(`/contactMessage/admin/find/${encodeURIComponent(userId)}`, lastId ? { lastId } : {});
    } catch (err) {
      if (err?.status !== 404 && err?.status !== 405) throw err;
      console.log(`[csrFindUserContactMessages] /contactMessage/admin/find/${userId} → 404, falling back to inbox-wide GET + client-side targetUserId filter`);
      const raw = await this.csrFindContactMessages(lastId ? { lastId } : {});
      const docs = raw?.docs ?? raw?.data ?? (Array.isArray(raw) ? raw : []);
      const filtered = docs.filter((d) => {
        const t = d?.content?.targetUserId || d?.targetUserId;
        return t === userId;
      });
      console.log(`[csrFindUserContactMessages] fallback found ${filtered.length} ticket(s) of ${docs.length} scanned for userId=${userId}`);
      return {
        docs: filtered,
        noMoreDocs: raw?.noMoreDocs ?? true,
        _fallback: 'inbox-filter',
      };
    }
  }

  // csrWrapper.api.message.contact.histories — GET /api/contactMessage/admin/histories
  // Returns the full thread (contact + user/csr replies) for a contact message.
  async csrFindContactHistories(params = {}) {
    const qs = new URLSearchParams();
    if (params.contactMessageId) qs.set('contactMessageId', params.contactMessageId);
    if (params.lastId) qs.set('lastId', params.lastId);
    return await this._csrGet(`/contactMessage/admin/histories?${qs.toString()}`);
  }

  // csrWrapper.api.message.contact.createCsrReply — POST /message/admin/user/csrMail/create
  // Edited 2026-04-17: a CSR can reply to any contactMessage retrieved via Find Contact Messages.
  // params: { contactMessageId, subject, message, contentType, attachments? }
  async csrCreateCsrReply(params = {}) {
    const { contentType = 'text/html', ...rest } = params;
    const body = { contentType, ...rest };
    return await this._viaCsr('api.message.contact.createCsrReply', body,
      () => this._csrPost('/message/admin/user/csrMail/create', body));
  }

  // csrWrapper.api.message.contact.setActor — POST /contactMessage/admin/setActor
  // Assigns an admin/CSR user to the contact message. actorId defaults to the caller.
  async csrSetContactActor(params = {}) {
    return await this._viaCsr('api.message.contact.setActor', params,
      () => this._csrPost('/contactMessage/admin/setActor', params));
  }

  // csrWrapper.api.message.contact.setTargetUser — POST /contactMessage/admin/setTargetUserId
  // Links a contactMessage to a specific user so it appears in findUserContacts.
  async csrSetContactTargetUser(params = {}) {
    return await this._viaCsr('api.message.contact.setTargetUser', params,
      () => this._csrPost('/contactMessage/admin/setTargetUserId', params));
  }

  // csrWrapper.api.message.contact.setTags — POST /contactMessage/admin/setTags
  // Replaces all tags (stored in message.index) with the provided array.
  async csrSetContactTags(params = {}) {
    return await this._viaCsr('api.message.contact.setTags', params,
      () => this._csrPost('/contactMessage/admin/setTags', params));
  }

  // csrWrapper.api.message.contact.replyLinkUrl — GET /contactMessage/admin/replyUrl
  // Returns the reply link URL that the user would receive via email.
  async csrGetContactReplyLinkUrl(params = {}) {
    const qs = new URLSearchParams();
    if (params.messageId) qs.set('messageId', params.messageId);
    return await this._csrGet(`/contactMessage/admin/replyUrl?${qs.toString()}`);
  }

  // csrWrapper.api.managedContact.find — POST /database/search (collectionName: managedContact)
  // params: { type ('email'|'phone'), contactAddress?, lastId? }
  async csrFindManagedContacts(params = {}) {
    return await this._csrPost('/database/search', { collectionName: 'managedContact', ...params });
  }

  // csrWrapper.api.managedContact.unsubscribe — POST /managedContact/management/unsubscribe
  // params: { managedContactId }
  async csrUnsubscribeManagedContact(managedContactId) {
    return await this._viaCsr('api.managedContact.unsubscribe', { managedContactId },
      () => this._csrPost('/managedContact/management/unsubscribe', { managedContactId }));
  }

  // csrWrapper.api.contact.find — POST /database/search (collectionName: contact)
  // Finds visitor contact messages. Params: { status?, brandId?, email?, lastId? }
  async csrFindContacts(params = {}) {
    return await this._csrPost('/database/search', { collectionName: 'contact', ...params });
  }

  // csrWrapper.api.contact.changeContactToUserContact — POST /message/admin/user/changeContactToUserContact
  // Links a visitor contact message to a real user account.
  // Params: { messageId, targetUserId }
  async csrChangeContactToUserContact(params = {}) {
    return await this._viaCsr('api.contact.changeContactToUserContact', params,
      () => this._csrPost('/message/admin/user/changeContactToUserContact', params));
  }

  // csrWrapper.api.tracking.findUser — POST /database/search
  // BC spec (added 2026-04-07): params { type, lastId, updaterId? }
  // type supports pipe-separated values, e.g. 'USER:nameSearchTeaser|USER:phoneSearchTeaser'.
  // Supported types: USER:nameSearchTeaser, USER:phoneSearchTeaser,
  // USER:nameSearchTeaserOptOut, USER:phoneSearchTeaserOptOut,
  // USER:nameSearch, USER:phoneSearch, USER:login (2026-04-13).
  async csrFindUserTracking(params = {}) {
    const body = { collectionName: 'tracking', brandId: 'idlookup', ...params };
    return await this._csrPost('/database/search', body);
  }

  /** Generate a random 32-char alphanumeric string matching the IIFE's format. */
  _generateRandomId() {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const arr = new Uint32Array(32);
    crypto.getRandomValues(arr);
    return Array.from(arr, v => charset[v % charset.length]).join('');
  }

  /**
   * Get user's support messages (contacts/CSR mail).
   * REMOVED by BC on 2026-04-17. The new message.contact.* flow uses per-thread
   * reply links (contactMessageId + hash) instead of a user-scoped inbox.
   * Returns a synthetic empty payload so callers (DashboardHome, AccountPage)
   * degrade gracefully until a replacement aggregate endpoint is available.
   */
  async getUserContacts(_lastId) {
    return { messages: [], docs: [], noMoreDocs: true };
  }

  /**
   * Navigate the user to BC's hosted opt-out page.
   * Per BC docs: ApiWrapper.goPage('optOut', { newPage: true | false })
   *   newPage=true  → opens in a new tab
   *   newPage=false → redirects current tab
   * The IIFE must be loaded for this to work; if it isn't, fall back to the
   * built-in /opt-out route so the user still gets a functional destination.
   */
  async goToOptOutPage({ newPage = true } = {}) {
    try {
      await this.getWrapper();
      if (typeof window !== 'undefined' && window.ApiWrapper && typeof window.ApiWrapper.goPage === 'function') {
        window.ApiWrapper.goPage('optOut', { newPage });
        return { success: true };
      }
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[ApiWrapper] goToOptOutPage failed via IIFE:', err?.message);
      }
    }
    // Fallback — library not available. Partner still needs a working opt-out
    // destination, so route to our in-app custom flow instead.
    if (typeof window !== 'undefined') {
      if (newPage) window.open('/opt-out', '_blank');
      else window.location.assign('/opt-out');
    }
    return { success: true, fallback: true };
  }

  /**
   * Record a tracking event (compliance agreements, T&C acceptance, etc.).
   * POST /api/tracking/create
   * apiWrapper.api.tracking.create(data) — data is an arbitrary object.
   */
  async createTracking(data) {
    if (this.useProxy) {
      return await this._csrPost('/tracking/create', data || {});
    }
    try {
      const wrapper = await this.getWrapper();
      return await wrapper.api.tracking.create(data || {});
    } catch (error) {
      // Non-fatal — compliance tracking should never break the user's flow.
      if (process.env.NODE_ENV === 'development') {
        console.warn('[Tracking] createTracking failed:', error?.message);
      }
      return null;
    }
  }

  /**
   * Create a contact message (visitor — no login required).
   * POST /api/message/contact
   * apiWrapper.api.contact.create({ firstName, lastName, email, telephone, message, contentType })
   * LEGACY — kept for backwards compatibility; prefer createContactMessage.
   */
  async createContact(params) {
    if (this.useProxy) {
      return await this._csrPost('/message/contact', params);
    }
    try {
      const wrapper = await this.getWrapper();
      return await wrapper.api.contact.create(params);
    } catch (error) {
      const enhancedError = new Error(error.message || 'Create contact failed');
      enhancedError.originalError = error;
      enhancedError.isCorsError = this._isCorsError(error);
      throw enhancedError;
    }
  }

  /**
   * Create a contact message — NEW BC spec (edited 2026-04-17).
   * POST /api/contactMessage/create
   * apiWrapper.api.message.contact.create(param)
   *
   * billing category params:
   *   { category: 'billing', date: Date[], name, email, zip, last4, phone?, orderId? }
   * general category params:
   *   { category: 'general', topic, name, email, phone, description, orderId, zip?, last4? }
   */
  async createContactMessage(params) {
    if (this.useProxy) {
      return await this._csrPost('/contactMessage/create', params);
    }
    try {
      const wrapper = await this.getWrapper();
      return await wrapper.api.message.contact.create(params);
    } catch (error) {
      const enhancedError = new Error(error.message || 'Create contact message failed');
      enhancedError.originalError = error;
      enhancedError.isCorsError = this._isCorsError(error);
      throw enhancedError;
    }
  }

  /**
   * Reply to a contact message thread — user side.
   * POST /api/contactMessage/userReply
   * apiWrapper.api.message.contact.reply({ contactMessageId, hash, message, contentType, attachments })
   */
  async replyContactMessage(params) {
    const { contentType = 'text/plain', ...rest } = params;
    const body = { contentType, ...rest };
    if (this.useProxy) {
      return await this._csrPost('/contactMessage/userReply', body);
    }
    try {
      const wrapper = await this.getWrapper();
      return await wrapper.api.message.contact.reply(body);
    } catch (error) {
      const enhancedError = new Error(error.message || 'Reply to contact message failed');
      enhancedError.originalError = error;
      enhancedError.isCorsError = this._isCorsError(error);
      throw enhancedError;
    }
  }

  /**
   * Fetch a contact message thread history.
   * GET /api/contactMessage/histories
   * apiWrapper.api.message.contact.histories({ contactMessageId, hash, lastId? })
   */
  async getContactHistories(params) {
    if (this.useProxy) {
      const qs = new URLSearchParams();
      if (params.contactMessageId) qs.set('contactMessageId', params.contactMessageId);
      if (params.hash) qs.set('hash', params.hash);
      if (params.lastId) qs.set('lastId', params.lastId);
      const url = `${this.proxyUrl}/contactMessage/histories?${qs.toString()}`;
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        const err = new Error(errorData.error?.message || errorData.message || `HTTP ${response.status}`);
        err.status = response.status;
        throw err;
      }
      return await response.json();
    }
    try {
      const wrapper = await this.getWrapper();
      return await wrapper.api.message.contact.histories(params);
    } catch (error) {
      const enhancedError = new Error(error.message || 'Get contact histories failed');
      enhancedError.originalError = error;
      enhancedError.isCorsError = this._isCorsError(error);
      throw enhancedError;
    }
  }

  /**
   * Create a user contact message (logged-in users only).
   * POST /api/message/userContact
   * apiWrapper.api.user.createContact({ message, parentCsrMessageId?, contentType })
   * Used for member-initiated messages and replies to CSR mail.
   */
  async createUserContact(params) {
    if (this.useProxy) {
      return await this._csrPost('/message/userContact', params);
    }
    try {
      const wrapper = await this.getWrapper();
      return await wrapper.api.user.createContact(params);
    } catch (error) {
      const enhancedError = new Error(error.message || 'Create user contact failed');
      enhancedError.originalError = error;
      enhancedError.isCorsError = this._isCorsError(error);
      throw enhancedError;
    }
  }

  /**
   * Count teaser searches performed by the logged-in user.
   * GET /api/idLookup/statistic/userTeaserSearches
   * Returns: { count: 5 }
   */
  async countUserTeaserSearches() {
    try {
      const wrapper = await this.getWrapper();
      return await wrapper.api.idLookup.countUserTeaserSearches();
    } catch (error) {
      const enhancedError = new Error(error.message || 'Count teaser searches failed');
      enhancedError.originalError = error;
      enhancedError.isCorsError = this._isCorsError(error);
      throw enhancedError;
    }
  }

  /**
   * Count report creations performed by the logged-in user.
   * GET /api/idLookup/statistic/userReportCreations
   * Returns: { count: 2 }
   */
  async countUserReportCreations() {
    try {
      const wrapper = await this.getWrapper();
      return await wrapper.api.idLookup.countUserReportCreations();
    } catch (error) {
      const enhancedError = new Error(error.message || 'Count report creations failed');
      enhancedError.originalError = error;
      enhancedError.isCorsError = this._isCorsError(error);
      throw enhancedError;
    }
  }

  /**
   * Count PDF downloads performed by the logged-in user.
   * GET /api/idLookup/statistic/userPdfDownloads
   * Returns: { count: 2 }
   */
  async countUserPdfDownloads() {
    try {
      const wrapper = await this.getWrapper();
      return await wrapper.api.idLookup.countUserPdfDownloads();
    } catch (error) {
      const enhancedError = new Error(error.message || 'Count PDF downloads failed');
      enhancedError.originalError = error;
      enhancedError.isCorsError = this._isCorsError(error);
      throw enhancedError;
    }
  }

  /**
   * Get activated product types for the logged-in user.
   * POST /api/commerceBilling/getActivatedProductTypes
   * Returns: { productTypes: ["nameSearch", "phoneSearch", "pdf"] }
   */
  async getActivatedProductTypes() {
    try {
      const wrapper = await this.getWrapper();
      return await wrapper.api.billing.getActivatedProductTypes();
    } catch (error) {
      const enhancedError = new Error(error.message || 'Get activated product types failed');
      enhancedError.originalError = error;
      enhancedError.isCorsError = this._isCorsError(error);
      throw enhancedError;
    }
  }

  /**
   * Update the logged-in user's profile (firstName/lastName/phone).
   * POST /api/user/update
   * All fields optional — pass only what's changing.
   */
  async userUpdate({ firstName, lastName, phone } = {}) {
    try {
      const wrapper = await this.getWrapper();
      const body = {};
      if (firstName !== undefined) body.firstName = firstName;
      if (lastName !== undefined) body.lastName = lastName;
      if (phone !== undefined) body.phone = phone;
      if (typeof wrapper.api?.user?.update !== 'function') {
        throw new Error('user.update not available in ApiWrapper');
      }
      return await wrapper.api.user.update(body);
    } catch (error) {
      const enhancedError = new Error(error.message || 'Profile update failed');
      enhancedError.originalError = error;
      enhancedError.isCorsError = this._isCorsError(error);
      throw enhancedError;
    }
  }

  /**
   * Look up a commerce offer by its shmName (e.g. 'comp.offer.signup.main').
   * POST /commerce/offer/findByShmName
   * Returns offer with extName (human-readable) and transient.priceInfo.s0/s1.
   */
  async findOfferByShmName({ shmName, key } = {}) {
    try {
      const wrapper = await this.getWrapper();
      if (typeof wrapper.api?.offer?.findByShmName !== 'function') {
        throw new Error('offer.findByShmName not available in ApiWrapper');
      }
      return await wrapper.api.offer.findByShmName({ shmName, ...(key ? { key } : {}) });
    } catch (error) {
      const enhancedError = new Error(error.message || 'findByShmName failed');
      enhancedError.originalError = error;
      enhancedError.isCorsError = this._isCorsError(error);
      throw enhancedError;
    }
  }

  /**
   * Get account shape/configuration from ByteCrtrs.
   * GET /shape/compiled
   * Returns a ShapeCompiled object with getShComp(key) for reading config values.
   * Useful for debugging — e.g. check what commerce offers are configured.
   */
  async getShapeCompiled() {
    try {
      const wrapper = await this.getWrapper();
      if (typeof wrapper.api?.shape?.getShapeCompiled === 'function') {
        return await wrapper.api.shape.getShapeCompiled();
      }
      throw new Error('getShapeCompiled not available in ApiWrapper');
    } catch (error) {
      const enhancedError = new Error(error.message || 'getShapeCompiled failed');
      enhancedError.originalError = error;
      enhancedError.isCorsError = this._isCorsError(error);
      throw enhancedError;
    }
  }

  /**
   * Process payment/sale via ByteCrtrs billing
   * POST /commerceBilling/sale
   */
  async sale(params) {
    // In proxy mode, bypass IIFE (it calls BC directly, causing CORS)
    if (this.useProxy) {
      try {
        await this.getWrapper().catch(() => {});
        return await this._saleViaProxy(params);
      } catch (error) {
        const enhancedError = new Error(error.message || 'Payment failed');
        enhancedError.originalError = error;
        enhancedError.status = error.status;
        enhancedError.data = error.data;
        throw enhancedError;
      }
    }
    try {
      const wrapper = await this.getWrapper();
      if (typeof wrapper.api?.billing?.sale === 'function') {
        const result = await wrapper.api.billing.sale(params);
        // IIFE catches HTTP errors internally and returns them as error-state response objects
        // (response: null, error: AxiosError). We must check explicitly.
        const iifErr = result?.getError?.();
        if (iifErr) {
          const errData = iifErr?.response?.data;
          const errStatus = iifErr?.response?.status ?? iifErr?.status;
          const errMsg = errData?.message || errData?.error || iifErr?.message || 'Payment failed';
          const enhanced = new Error(errMsg);
          enhanced.status = errStatus;
          enhanced.data = errData;
          throw enhanced;
        }
        return result;
      }
      throw new Error('Billing sale not available in ApiWrapper');
    } catch (error) {
      const enhancedError = new Error(error.message || 'Payment failed');
      enhancedError.originalError = error;
      enhancedError.status = error.status;
      enhancedError.data = error.data;
      enhancedError.isCorsError = this._isCorsError(error);
      throw enhancedError;
    }
  }

  /**
   * Replicate the IIFE's billingSeriesId generation:
   * `${type}|${clientId}|${apiId}|${timestamp}|${random8}`
   */
  _makeBillingSeriesId(type, clientId, apiId) {
    const timestamp = new Date().getTime();
    const random8 = Array.from(crypto.getRandomValues(new Uint32Array(8)),
      v => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[v % 62]).join('');
    return `${type}|${clientId}|${apiId}|${timestamp}|${random8}`;
  }

  async _saleViaProxy(params) {
    const clientId = this.wrapper?.clientId || this._generateRandomId();
    const apiId = this._generateRandomId();
    const billingSeriesId = this._makeBillingSeriesId('sale', clientId, apiId);
    const url = `${this.proxyUrl}/commerceBilling/sale?clientId=${clientId}&apiId=${apiId}`;
    const response = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...params, billingSeriesId }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      const err = new Error(errorData.message || errorData.error?.message || `HTTP ${response.status}`);
      err.status = response.status;
      err.data = errorData;
      throw err;
    }
    const data = await response.json();
    // BC may return HTTP 200 with a rejected/error status in the body
    if (data?.status === 'rejected' || (data?.error && !data?.user)) {
      const errMsg = data?.message || data?.error?.message || data?.error || 'Payment declined';
      const err = new Error(typeof errMsg === 'string' ? errMsg : 'Payment declined');
      err.status = 402;
      err.data = data;
      throw err;
    }
    return data;
  }
}

// Export singleton instance
export default new ApiWrapperService();
