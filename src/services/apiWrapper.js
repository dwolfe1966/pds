/**
 * API Wrapper Service
 *
 * Wraps the ByteCrtrs ApiWrapper library and provides a clean interface
 * for making API calls to the new external API.
 */

import { dbg, dbgWarn, dbgError } from './_debug';

/**
 * Unwrap a BC IIFE response. Both the consumer ApiWrapper and CSR IIFE wrap
 * results in an `ApiResponseHelperGeneral` (or similar) with a `.getData()`
 * method or a `.params.response.data` chain. Direct-POST fallbacks already
 * return the raw body. This helper accepts either shape.
 *
 * Returns the wrapper's data if it looks like a wrapper, otherwise returns the
 * input as-is — callers see the same shape regardless of which path served the
 * call.
 */
export function _unwrapBcResponse(value) {
  if (value == null || typeof value !== 'object') return value;
  // BC IIFEs catch their own axios errors and return a wrapper with
  // .params.error rather than throwing. Surface that as a real exception so
  // callers (and the UI) see a failed call, not a silently-empty success.
  const inner = value.params?.error;
  if (inner) {
    const responseData = inner.response?.data;
    let msg =
      responseData?.message ||
      responseData?.error ||
      inner.message ||
      'BC request failed';
    if (Array.isArray(msg)) msg = msg.join(', ');
    const e = new Error(msg);
    e.status = inner.response?.status;
    e.data = responseData;
    throw e;
  }
  if (typeof value.getData === 'function') {
    try {
      const data = value.getData();
      if (data !== undefined && data !== null) return data;
    } catch { /* fall through */ }
  }
  const nested = value.params?.response?.data;
  if (nested !== undefined && nested !== null) return nested;
  return value;
}

class ApiWrapperService {
  constructor() {
    this.wrapper = null;
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
      // Pass attribution context (shn/shl) at IIFE init so BC resolves the
      // ShapeCompiled cascade for the right partner/page combo. Values
      // captured at app boot by CampaignContext and persisted to
      // sessionStorage; first-touch wins.
      const initialShParams = this._readShParamsFromSession();
      const baseConfig = { endpointUrl };
      try {
        const config = initialShParams ? { ...baseConfig, initialShParams } : baseConfig;
        this.wrapper = window.ApiWrapper.getInstance(config);
      } catch (shErr) {
        // BC's IIFE may reject unknown shn/shl with a hard throw. Retry
        // without initialShParams so the app continues with BC's default
        // cascade — campaign UX overrides are still applied client-side.
        dbgWarn('[ApiWrapper] getInstance rejected initialShParams; retrying without:', shErr?.message);
        this.wrapper = window.ApiWrapper.getInstance(baseConfig);
      }
      this._installCaptchaHandler();
      this.initialized = true;
      return this.wrapper;
    } catch (error) {
      dbgError('Failed to initialize ApiWrapper:', error);
      throw error;
    }
  }

  /** Read shn/shl from sessionStorage (first-touch attribution) and shape
   *  into the `initialShParams` form BC expects. Returns null when neither
   *  value is set so we don't pass an empty `initialShParams` to BC.
   *
   *  Only forwards values that look like real BC identifiers (24-character
   *  hex / MongoDB ObjectId). Placeholder strings like "demo" or "v5" break
   *  BC's IIFE (the cascade resolver can't find them and the IIFE throws on
   *  every subsequent API call, with no HTTP request ever leaving the
   *  browser). Skipping invalid values lets BC fall back to its own
   *  defaults — the campaign config still works because our registry uses
   *  the raw string as the lookup key regardless of BC's opinion. */
  _readShParamsFromSession() {
    if (typeof sessionStorage === 'undefined') return null;
    try {
      const isBcObjectId = (v) => typeof v === 'string' && /^[0-9a-fA-F]{24}$/.test(v);
      const rawShn = sessionStorage.getItem('attribution.shn');
      const rawShl = sessionStorage.getItem('attribution.shl');
      const shn = isBcObjectId(rawShn) ? rawShn : null;
      const shl = isBcObjectId(rawShl) ? rawShl : null;
      if (!shn && !shl) return null;
      const params = { cascade: true };
      if (shn) params.shn = shn;
      if (shl) params.shl = shl;
      return params;
    } catch { return null; }
  }

  /**
   * Override BC's password.v0 captcha hook.
   *
   * BC's IIFE's default `executePasswordCaptcha` constructs a stray
   * `<input type="password">` modal directly in the DOM, waits for the user
   * to type, and forwards whatever they enter to `/captcha/verify` as the
   * token. That UI is unusable for public visitors (no instructions, no
   * known password, no real captcha) — it just sits on the page as a
   * mystery prompt.
   *
   * Two modes here:
   *
   *  - **Autofill (dev):** when `REACT_APP_NEW_API_CAPTCHA` is set, override
   *    the hook to return that token immediately. Skips the modal, lets
   *    captcha-protected endpoints succeed in local/staging testing. This
   *    env var is intentionally empty in committed `.env.production` —
   *    `.env.local` carries it for the developer. Postbuild secret scan
   *    refuses to ship a bundle that contains the password.
   *
   *  - **Suppress (prod):** when the env var is empty (default for public
   *    bundles), override the hook to **throw immediately** without
   *    rendering anything. The IIFE's internal retry then fails cleanly,
   *    the original 412 surfaces to our caller, and our error UX takes
   *    over instead of stranding the user on a password prompt. No secret
   *    is required for this — we're rejecting, not verifying.
   *
   * The IIFE's modal is the most visible defensive hole we have today, so
   * the suppress branch is the production behavior even though BC will
   * eventually remove `password.v0` from user-facing endpoints.
   */
  /**
   * Optional dev autofill for BC's password.v0 captcha modal.
   *
   * When `REACT_APP_NEW_API_CAPTCHA` is set in a local `.env.local`,
   * override the IIFE's `executePasswordCaptcha` to return that token
   * immediately — no modal, captcha verify succeeds, dev/staging flows
   * complete without manual interaction.
   *
   * When the env var is **not** set (committed production behavior), we
   * leave the IIFE's default in place: the password modal renders, the
   * tester/dev types the captcha password manually, and the IIFE's normal
   * captcha-verify→retry flow runs. This is the expected pre-launch
   * behavior — once BC removes `password.v0` from user-facing endpoints
   * at launch, no modal will fire and this code is inert.
   *
   * Postbuild secret scan blocks any bundle that contains the captcha
   * password — `.env.production` ships with an empty value by design.
   */
  _installCaptchaHandler() {
    if (!this.wrapper?.captcha) return;
    const captchaPass = process.env.REACT_APP_NEW_API_CAPTCHA;
    if (!captchaPass) return; // leave IIFE default behavior intact
    if (typeof this.wrapper.captcha.executePasswordCaptcha !== 'function') return;
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
        dbg('[ByteCrtrs API] searchTeaser called with params:', JSON.stringify(query, null, 2));
        const perPageKeys = ['perPage', 'per_page', 'pageSize'];
        const hasPerPage = perPageKeys.some(k => query[k] != null);
        dbg('[ByteCrtrs API] Results-per-page:', hasPerPage ? perPageKeys.map(k => `${k}=${query[k]}`).filter(Boolean).join(', ') : 'NOT SET');
        dbg('[ByteCrtrs API] Is pagination (getMore):', !!(query.commerceContentId && query.page != null));
      }
      // When using proxy mode, the wrapper is configured to point to our proxy server
      // So we can use the library normally - it will make requests to our proxy (no CORS)
      // and our proxy will forward to the external API
      const wrapper = await this.getWrapper();
      const response = await wrapper.api.idLookup.searchTeaser(query);
      
      // Log the response structure for debugging
      if (process.env.NODE_ENV === 'development') {
        dbg('[API Wrapper] searchTeaser response type:', typeof response);
        dbg('[API Wrapper] response has getIdentities?', typeof response?.getIdentities === 'function');
        dbg('[API Wrapper] response has getCommerceContent?', typeof response?.getCommerceContent === 'function');
        dbg('[API Wrapper] response has getTeaserInput?', typeof response?.getTeaserInput === 'function');
        dbg('[API Wrapper] response has hasMore?', typeof response?.hasMore === 'function');
        dbg('[API Wrapper] response object keys:', Object.keys(response || {}));
        
        if (typeof response?.getIdentities === 'function') {
          const identities = response.getIdentities();
          dbg('[API Wrapper] getIdentities() returned:', identities?.length || 0, 'items');
          if (identities && identities.length > 0) {
            dbg('[API Wrapper] First identity sample:', JSON.stringify(identities[0]).substring(0, 200));
          }
        }
        if (typeof response?.getCommerceContent === 'function') {
          const commerceContent = response.getCommerceContent();
          dbg('[API Wrapper] getCommerceContent() returned:', commerceContent ? JSON.stringify(commerceContent).substring(0, 200) : 'null/undefined');
        }
        if (typeof response?.getTeaserInput === 'function') {
          const teaserInput = response.getTeaserInput();
          dbg('[API Wrapper] getTeaserInput() returned:', teaserInput ? JSON.stringify(teaserInput).substring(0, 200) : 'null/undefined');
        }
        if (typeof response?.hasMore === 'function') {
          const hasMore = response.hasMore();
          dbg('[API Wrapper] hasMore() returned:', hasMore);
        }
        // Check the wrapper's internal structure
        if (response && typeof response === 'object') {
          // The library wrapper might store data in params or other properties
          if (response.params) {
            dbg('[API Wrapper] response.params:', JSON.stringify(response.params).substring(0, 500));
            // Check the actual response data structure
            if (response.params.response) {
              const apiResponse = response.params.response;
              dbg('[API Wrapper] API Response status:', apiResponse.status);
              dbg('[API Wrapper] API Response data keys:', Object.keys(apiResponse.data || {}));
              dbg('[API Wrapper] API Response data:', JSON.stringify(apiResponse.data).substring(0, 500));
              
              // Check if it has raws structure (expected format)
              if (apiResponse.data?.raws) {
                dbg('[API Wrapper] ✓ Found raws array with', apiResponse.data.raws.length, 'items');
                if (apiResponse.data.raws[0]?.transient?.identities) {
                  dbg('[API Wrapper] ✓ Found', apiResponse.data.raws[0].transient.identities.length, 'identities in raws[0].transient.identities');
                } else {
                  dbg('[API Wrapper] ✗ No identities found in raws[0].transient');
                }
              } else if (apiResponse.data?.commerceContent === null) {
                dbg('[API Wrapper] ✗ Response has commerceContent: null - API returned empty result');
              } else {
                dbg('[API Wrapper] ⚠ Unexpected response structure');
              }
            }
          }
          if (response.options) {
            dbg('[API Wrapper] response.options:', JSON.stringify(response.options).substring(0, 300));
          }
          if (response.currentPage !== undefined) {
            dbg('[API Wrapper] response.currentPage:', response.currentPage);
          }
          
          // Try to access any data property
          const dataKeys = Object.keys(response).filter(key => 
            !['getIdentities', 'getCommerceContent', 'getTeaserInput', 'hasMore', 'getMore', 'params', 'options', 'currentPage'].includes(key)
          );
          if (dataKeys.length > 0) {
            dbg('[API Wrapper] Other response keys:', dataKeys);
            dataKeys.forEach(key => {
              try {
                const value = response[key];
                if (typeof value === 'object' && value !== null) {
                  dbg(`[API Wrapper] response.${key}:`, JSON.stringify(value).substring(0, 200));
                } else {
                  dbg(`[API Wrapper] response.${key}:`, value);
                }
              } catch (e) {
                dbg(`[API Wrapper] Could not access response.${key}:`, e.message);
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
          dbgError('[ByteCrtrs] Search failed. Full API response:', apiData || err.response);
        }
        throw e;
      }
      
      return response;
    } catch (error) {
      // If we get a CORS error (shouldn't happen in proxy mode, but handle it anyway)
      if (this._isCorsError(error)) {
        dbgWarn('[API Wrapper] CORS error detected, this shouldn\'t happen in proxy mode');
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
   * Opt-out confirmation — hit when BC's confirmation email lands the
   * user on /opt-out?awqh[type]=confirmationRequestOptOut&awqh[optOutRequestId]=X.
   * The full search/request flow lives on BC's hosted page (goPage('optOut')).
   */
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
        dbg('[BC Billing] Available billing methods:', Object.keys(wrapper.api?.billing || {}));
      }
      // BC library may expose this as getUserOrders or getOrders
      const fn = wrapper.api?.billing?.getUserOrders ?? wrapper.api?.billing?.getOrders;
      if (typeof fn === 'function') {
        return await fn.call(wrapper.api.billing);
      }
      // IIFE is outdated and missing this method — fall back to direct proxy fetch.
      if (process.env.NODE_ENV === 'development') {
        dbgWarn('[BC Billing] getUserOrders/getOrders not found in IIFE; falling back to proxy fetch.');
      }
      return await this._getUserOrdersViaProxy();
    } catch (error) {
      const enhancedError = new Error(error.message || 'Get orders failed');
      enhancedError.originalError = error;
      enhancedError.isCorsError = this._isCorsError(error);
      // Preserve HTTP status so AuthContext can distinguish 403 (no orders → unpaid)
      // from a 5xx / unreachable BC (outage → don't render the member as wiped).
      enhancedError.status = error?.status ?? error?.response?.status ?? null;
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
      const err = new Error(errorData.error?.message || errorData.message || `HTTP ${response.status}`);
      err.status = response.status; // preserve so callers can tell 403 (no orders) from 5xx (outage)
      throw err;
    }

    return await response.json();
  }

  // ---------------------------------------------------------------------------
  // CSR (admin) API — calls BC csrWrapper endpoints directly via proxy or direct
  // ---------------------------------------------------------------------------

  /**
   * POST to a csrWrapper endpoint. Respects useProxy/endpointUrl so it works
   * in both dev (Express proxy) and production (direct BC with CORS).
   *
   * Captcha handling: BC returns 412 with `{ type, captchaId, step }` on
   * captcha-protected endpoints (notably `/contactMessage/create`). We mirror
   * the IIFE's auto-retry — call `/captcha/verify` with the configured
   * password (REACT_APP_NEW_API_CAPTCHA) as the token, then retry the
   * original POST with the `x-captcha-id` header. Bounded by a single retry.
   */
  async _csrPost(path, body = {}, { _captchaRetried = false, _captchaId = null, billingSeriesType = null } = {}) {
    const baseUrl = this.useProxy
      ? `${this.proxyUrl}${path}`
      : `${this.endpointUrl}${path}`;
    const clientId = this.wrapper?.clientId || this._generateRandomId();
    const apiId = this._generateRandomId();
    const sep = path.includes('?') ? '&' : '?';
    const url = `${baseUrl}${sep}clientId=${clientId}&apiId=${apiId}`;
    // Billing endpoints (e.g. /commerceBilling/correct refunds) require a billingSeriesId
    // that the IIFE normally injects. When a caller routes a billing op through this
    // direct path it passes billingSeriesType so we mirror the IIFE — built from the SAME
    // clientId/apiId used for this request, so they match.
    const finalBody = billingSeriesType
      ? { ...body, billingSeriesId: this._makeBillingSeriesId(billingSeriesType, clientId, apiId) }
      : body;
    const headers = { 'Content-Type': 'application/json' };
    if (_captchaId) headers['x-captcha-id'] = _captchaId;
    const response = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers,
      body: JSON.stringify(finalBody),
    });
    if (response.status === 412 && !_captchaRetried) {
      const captcha = await response.json().catch(() => null);
      if (captcha?.captchaId && captcha?.type) {
        const verified = await this._verifyCaptcha(captcha);
        if (verified) {
          return this._csrPost(path, body, { _captchaRetried: true, _captchaId: captcha.captchaId, billingSeriesType });
        }
      }
    }
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      const err = new Error(errorData.error?.message || errorData.message || `HTTP ${response.status}`);
      err.status = response.status;
      err.data = errorData;
      throw err;
    }
    return await response.json();
  }

  /**
   * Same as _csrPost but uses multipart/form-data. Some BC contact endpoints
   * (notably /contactMessage/admin/csrReply and /contactMessage/admin/create)
   * expect FormData rather than JSON.
   */
  async _csrPostFormData(path, body = {}) {
    const baseUrl = this.useProxy ? `${this.proxyUrl}${path}` : `${this.endpointUrl}${path}`;
    const clientId = this.wrapper?.clientId || this._generateRandomId();
    const apiId = this._generateRandomId();
    const sep = path.includes('?') ? '&' : '?';
    const url = `${baseUrl}${sep}clientId=${clientId}&apiId=${apiId}`;
    const fd = new FormData();
    Object.entries(body).forEach(([k, v]) => {
      if (v === null || v === undefined || v === '') return;
      if (Array.isArray(v) && v.every(item => item instanceof File)) {
        v.forEach(f => fd.append(k, f));
      } else {
        fd.append(k, v);
      }
    });
    const response = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      // Don't set Content-Type — the browser auto-sets it with boundary for FormData.
      body: fd,
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      const err = new Error(errorData.error?.message || errorData.message || `HTTP ${response.status}`);
      err.status = response.status;
      err.data = errorData;
      throw err;
    }
    return await response.json();
  }

  /**
   * Verify a captcha challenge using the env-configured password. Returns true
   * on success. Mirrors the IIFE's verifyCaptcha (GET /captcha/verify).
   */
  async _verifyCaptcha(captcha) {
    const token = process.env.REACT_APP_NEW_API_CAPTCHA;
    if (!token || captcha?.type !== 'password.v0') return false;
    const baseUrl = this.useProxy ? this.proxyUrl : this.endpointUrl;
    // BC's bare-axios captcha instance still has a request interceptor that
    // adds clientId+apiId — match that or BC rejects the verify with 400.
    const clientId = this.wrapper?.clientId || this._generateRandomId();
    const apiId = this._generateRandomId();
    const params = new URLSearchParams({
      token,
      type: captcha.type,
      step: captcha.step || '',
      clientId,
      apiId,
    });
    try {
      const res = await fetch(`${baseUrl}/captcha/verify?${params.toString()}`, {
        method: 'GET',
        credentials: 'include',
        headers: { 'x-captcha-id': captcha.captchaId },
      });
      return res.ok;
    } catch {
      return false;
    }
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

  // CONSUMER (public + member) email unsubscribe.
  // apiWrapper.api.managedContact.unsubscribeMail({ value: email }) → POST
  // /managedContact/unsubscribe/mail. Used by the public /unsubscribe page and the
  // member Communications tab. NOTE: there is NO consumer text/SMS unsubscribe endpoint
  // (BC exposes only unsubscribe/mail) — texts are stopped by replying STOP; a BC ask is
  // filed for a web text-unsubscribe.
  async unsubscribeManagedContactMail(email) {
    const value = (email || '').trim();
    if (!value) throw new Error('Email is required');
    try {
      const wrapper = await this.getWrapper();
      if (typeof wrapper?.api?.managedContact?.unsubscribeMail === 'function') {
        return await wrapper.api.managedContact.unsubscribeMail({ value });
      }
    } catch (err) {
      if (err?.status && err.status !== 404 && err.status !== 405) throw err;
    }
    return await this._csrPost('/managedContact/unsubscribe/mail', { value });
  }

  /** Generate a random 32-char alphanumeric string matching the IIFE's format. */
  _generateRandomId() {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const arr = new Uint32Array(32);
    crypto.getRandomValues(arr);
    return Array.from(arr, v => charset[v % charset.length]).join('');
  }

  /**
   * Enumerate the logged-in user's contactMessage threads.
   * BC: apiWrapper.api.message.contact.getUserContacts({ lastId })
   *     → GET /api/contactMessage/getUserContacts
   * Added 2026-05-28 (Api.csv). Returns threads where the user is the
   * targetUserId — covers both user-submitted threads and CSR-initiated
   * threads (e.g. F8 billing-action). Each doc includes `hash` inline so
   * the consumer can immediately call histories(id, hash) without a
   * separate round-trip.
   */
  async getUserContacts(lastId) {
    const params = lastId ? { lastId } : {};
    const wrapper = await this.getWrapper().catch(() => null);
    if (wrapper?.api?.message?.contact?.getUserContacts) {
      try {
        const raw = await wrapper.api.message.contact.getUserContacts(params);
        const data = _unwrapBcResponse(raw) ?? {};
        const docs = data.docs || (Array.isArray(data) ? data : []);
        const noMoreDocs = data.noMoreDocs ?? (docs.length === 0);
        return { docs, messages: docs, noMoreDocs };
      } catch (err) {
        if (process.env.NODE_ENV === 'development') {
          dbgWarn('[getUserContacts] IIFE returned error, falling back to direct GET:', err?.message);
        }
      }
    }
    try {
      const qs = new URLSearchParams();
      if (lastId) qs.set('lastId', lastId);
      const path = `/contactMessage/getUserContacts${qs.toString() ? `?${qs.toString()}` : ''}`;
      const raw = await this._csrGet(path);
      const data = raw?.getData?.() ?? raw ?? {};
      const docs = data.docs || (Array.isArray(data) ? data : []);
      const noMoreDocs = data.noMoreDocs ?? (docs.length === 0);
      return { docs, messages: docs, noMoreDocs };
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        dbgWarn('[getUserContacts] failed:', err?.message);
      }
      return { docs: [], messages: [], noMoreDocs: true, _error: err?.message };
    }
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
    // Click handlers should call window.ApiWrapper.instance.goPage(...) directly
    // (synchronous, preserves the user-gesture so popup blockers don't fire).
    // This helper exists for non-click code paths (deep links, programmatic
    // redirects). `goPage` is an instance method, not static — call on .instance.
    try {
      await this.getWrapper();
      const inst = typeof window !== 'undefined' ? window.ApiWrapper?.instance : null;
      if (inst && typeof inst.goPage === 'function') {
        inst.goPage('optOut', { newPage });
        return { success: true };
      }
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        dbgWarn('[ApiWrapper] goToOptOutPage failed via IIFE:', err?.message);
      }
    }
    return { success: false, reason: 'iife-unavailable' };
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
        dbgWarn('[Tracking] createTracking failed:', error?.message);
      }
      return null;
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
    if (!this.useProxy) {
      try {
        const wrapper = await this.getWrapper();
        if (typeof wrapper.api?.message?.contact?.create === 'function') {
          return _unwrapBcResponse(await wrapper.api.message.contact.create(params));
        }
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          dbgWarn('[BC message.contact.create] IIFE path threw; falling back to direct POST:', error?.message);
        }
      }
    }
    try {
      // BC expects this body wrapped as { input: <payload> } with empty values
      // dropped (matching the IIFE's createContactMessage shaping). A flat
      // payload causes 500.
      const payload = Object.fromEntries(
        Object.entries(params || {}).filter(([, v]) => v !== '' && v !== null && v !== undefined)
      );
      return await this._csrPost('/contactMessage/create', { input: payload });
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
   *
   * The dev IIFE on dev.www.idlookup.ai doesn't expose `user.update`, so we try
   * the IIFE method first and fall back to a direct POST via _csrPost (which
   * routes through the proxy in dev and to the relative /api endpoint in prod).
   */
  async userUpdate({ firstName, lastName, phone } = {}) {
    const body = {};
    if (firstName !== undefined) body.firstName = firstName;
    if (lastName !== undefined) body.lastName = lastName;
    if (phone !== undefined) body.phone = phone;
    try {
      const wrapper = await this.getWrapper();
      if (typeof wrapper.api?.user?.update === 'function') {
        return _unwrapBcResponse(await wrapper.api.user.update(body));
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        dbgWarn('[BC user.update] IIFE path threw; falling back to direct POST:', error?.message);
      }
      // If the IIFE returned a wrapper with .params.error, _unwrapBcResponse
      // already converted it to a thrown Error — propagate to the caller as a
      // genuine failure rather than silently falling back.
      if (error?.status || error?.data) throw error;
    }
    try {
      return await this._csrPost('/user/update', body);
    } catch (error) {
      const enhancedError = new Error(error.message || 'Profile update failed');
      enhancedError.originalError = error;
      enhancedError.isCorsError = this._isCorsError(error);
      throw enhancedError;
    }
  }

  /**
   * Cancel (or reactivate) the logged-in user's subscription order.
   * POST /api/commerceBilling/cancelOrUncancelOrder via
   * apiWrapper.api.commerceBilling.cancelOrUncancelOrder(flag, orderId).
   *
   *   flag === true  → cancel (sets transient.canceled, schedules end-of-period termination)
   *   flag === false → reactivate (uncancel before period end)
   *
   * Callers must pass the BC orderId (e.g., active order from getOrders()).
   */
  async cancelOrder({ orderId, flag = true } = {}) {
    if (!orderId) throw new Error('orderId is required');
    try {
      const wrapper = await this.getWrapper();
      if (typeof wrapper.api?.commerceBilling?.cancelOrUncancelOrder === 'function') {
        return _unwrapBcResponse(await wrapper.api.commerceBilling.cancelOrUncancelOrder(flag, orderId));
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        dbgWarn('[BC commerceBilling.cancelOrUncancelOrder] IIFE path threw; falling back to direct POST:', error?.message);
      }
      if (error?.status || error?.data) throw error;
    }
    try {
      return await this._csrPost('/commerceBilling/cancelOrUncancelOrder', { flag, orderId });
    } catch (error) {
      const enhancedError = new Error(error.message || 'Cancel order failed');
      enhancedError.originalError = error;
      enhancedError.isCorsError = this._isCorsError(error);
      throw enhancedError;
    }
  }

  /**
   * Change the logged-in user's password.
   * POST /api/user/changePassword
   * apiWrapper.api.user.changePassword(password) — takes the new password
   * as a positional string arg and posts { password } to the endpoint.
   *
   * NOTE: BC's endpoint does NOT require the current password; it just sets
   * a new one. The AccountPage UI still collects currentPassword for UX
   * (user expectation), but we only forward newPassword to BC. If a future
   * BC version adds current-password verification, update the call shape.
   */
  async changePassword({ newPassword } = {}) {
    if (!newPassword) throw new Error('newPassword is required');
    try {
      const wrapper = await this.getWrapper();
      if (typeof wrapper.api?.user?.changePassword === 'function') {
        return _unwrapBcResponse(await wrapper.api.user.changePassword(newPassword));
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        dbgWarn('[BC user.changePassword] IIFE path threw; falling back to direct POST:', error?.message);
      }
      if (error?.status || error?.data) throw error;
    }
    try {
      return await this._csrPost('/user/changePassword', { password: newPassword });
    } catch (error) {
      const enhancedError = new Error(error.message || 'Password change failed');
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
