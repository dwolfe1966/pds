/**
 * API Wrapper Service
 *
 * Wraps the ByteCrtrs ApiWrapper library and provides a clean interface
 * for making API calls to the new external API.
 */

import { dbg, dbgWarn, dbgError } from './_debug';

// CSR IIFE is loaded by admin.html via a static <script> tag at runtime.
// loadCsrIife() is normally a no-op (window.CsrWrapper is already defined).
// This list is the runtime fallback if the static tag fails to load.
// Same-origin only — absolute upstream URLs are stripped to keep them out
// of the production bundle (they were broken anyway: cert mismatch on
// dev.www.bytecrtrs.com, 502 on dev1.dev.www.bytecrtrs.com).
const CSR_IIFE_CANDIDATES = [
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
      dbg('[CsrWrapper] already loaded');
      return window.CsrWrapper;
    }
    for (const url of CSR_IIFE_CANDIDATES) {
      try {
        await _loadScript(url);
        if (window.CsrWrapper) {
          dbg(`[CsrWrapper] loaded from ${url}`);
          return window.CsrWrapper;
        }
        dbg(`[CsrWrapper] script at ${url} loaded but did not expose window.CsrWrapper`);
      } catch (e) {
        // 404 or other load error — silent, try next candidate.
      }
    }
    dbg('[CsrWrapper] none of the candidate URLs returned a CSR IIFE — ask ByteCrtrs for the correct path');
    return null;
  })();
  return _csrIifePromise;
}

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
function _unwrapBcResponse(value) {
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
   *
   * Captcha handling: BC returns 412 with `{ type, captchaId, step }` on
   * captcha-protected endpoints (notably `/contactMessage/create`). We mirror
   * the IIFE's auto-retry — call `/captcha/verify` with the configured
   * password (REACT_APP_NEW_API_CAPTCHA) as the token, then retry the
   * original POST with the `x-captcha-id` header. Bounded by a single retry.
   */
  async _csrPost(path, body = {}, { _captchaRetried = false, _captchaId = null } = {}) {
    const baseUrl = this.useProxy
      ? `${this.proxyUrl}${path}`
      : `${this.endpointUrl}${path}`;
    const clientId = this.wrapper?.clientId || this._generateRandomId();
    const apiId = this._generateRandomId();
    const sep = path.includes('?') ? '&' : '?';
    const url = `${baseUrl}${sep}clientId=${clientId}&apiId=${apiId}`;
    const headers = { 'Content-Type': 'application/json' };
    if (_captchaId) headers['x-captcha-id'] = _captchaId;
    const response = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers,
      body: JSON.stringify(body),
    });
    if (response.status === 412 && !_captchaRetried) {
      const captcha = await response.json().catch(() => null);
      if (captcha?.captchaId && captcha?.type) {
        const verified = await this._verifyCaptcha(captcha);
        if (verified) {
          return this._csrPost(path, body, { _captchaRetried: true, _captchaId: captcha.captchaId });
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
      dbg('[CsrWrapper] getInstance() failed:', e?.message);
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
          return _unwrapBcResponse(await fn.call(parent, args));
        }
      }
    } catch (err) {
      dbg(`[CsrWrapper] ${dotPath} threw, falling back: ${err?.message}`);
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

      dbg(`[csrFindUserOrders] /commerceMgmt/userOrders → 404 for userId=${userId}; trying ${strategies.length + 1} /database/search variants`);

      for (const strat of strategies) {
        try {
          const raw = await this._csrPost('/database/search', strat.body);
          const orders = raw?.docs ?? raw?.orders ?? raw?.data ?? (Array.isArray(raw) ? raw : []);
          dbg(`[csrFindUserOrders] strategy "${strat.name}": ${orders.length} order(s); response keys=${Object.keys(raw || {}).join(',')}`);
          if (orders.length > 0) {
            return {
              orders,
              perPage: orders.length,
              noMoreDocs: raw?.noMoreDocs ?? true,
              _fallback: `database-search:${strat.name}`,
            };
          }
        } catch (sErr) {
          dbg(`[csrFindUserOrders] strategy "${strat.name}" failed: ${sErr?.message}`);
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
          dbg(`[csrFindUserOrders] probe ${JSON.stringify(probe)} → ${docs.length} doc(s); first.brandId=${firstDocBrand} first.payerId=${firstDocPayer} keys=[${firstDocKeys}]`);
          if (docs.length > 0) {
            workingProbe = { probe, firstPage: docs };
            break;
          }
        } catch (sErr) {
          dbg(`[csrFindUserOrders] probe ${JSON.stringify(probe)} failed: ${sErr?.message}`);
        }
      }

      if (!workingProbe) {
        dbg('[csrFindUserOrders] no probe returned any commerceOrder docs — BC has no orders accessible to this session, or the schema differs from what we expect');
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
        dbg(`[csrFindUserOrders] working probe scan: ${matched.length} match(es) of ${aggregated.length} scanned (range: ${newestScanned || '?'} → ${oldestScanned || '?'})`);
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
        dbg(`[csrFindUserOrders] working probe scan failed: ${sErr?.message}`);
      }

      dbg(`[csrFindUserOrders] all fallback strategies returned empty for userId=${userId}`);
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
        dbgWarn('[csrGetUserOrder] /commerceMgmt/getUserOrder unavailable, falling back to /database/search by _id');
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

  // POST /database/search with collectionName=userContact and no targetUserId
  // filter — returns ALL userContact docs (member-initiated messages, CSR
  // outbound mail, internal notes). Used to populate the unified admin inbox
  // alongside contactMessage docs. Pagination via lastId.
  async csrFindAllUserContacts(params = {}) {
    const body = { collectionName: 'userContact', ...params };
    return await this._csrPost('/database/search', body);
  }

  // csrWrapper.api.user.findUserAdminNotes — GET /message/admin/findNotes
  // BC's dedicated read endpoint for admin notes. Replaces the older
  // /database/search collectionName=userContact path which queries the wrong
  // collection after BC restructured admin notes 2026-04-17.
  // Returns { docs: [...], noMoreDocs } per BC convention.
  async csrFindUserAdminNotes({ userId, lastId } = {}) {
    if (!userId) throw new Error('userId is required');
    const qs = new URLSearchParams({ userId });
    if (lastId) qs.set('lastId', lastId);
    return await this._csrGet(`/message/admin/findNotes?${qs.toString()}`);
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
      dbg('[csrCreateAdminNote] CsrWrapper failed, falling back:', csrErr?.message);
    }
    try {
      return await this._csrPost('/message/admin/createNote', body);
    } catch (err) {
      if (err?.status === 404 || err?.status === 405) {
        if (process.env.NODE_ENV === 'development') {
          dbgWarn('[csrCreateAdminNote] new path not live; falling back to legacy /message/admin/user/note/create');
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
      dbg('[csrUpdateAdminNote] CsrWrapper failed, falling back:', csrErr?.message);
    }
    try {
      return await this._csrPost('/message/admin/updateNote', params);
    } catch (err) {
      if (err?.status === 404 || err?.status === 405) {
        if (process.env.NODE_ENV === 'development') {
          dbgWarn('[csrUpdateAdminNote] new path not live; falling back to legacy /message/admin/user/note/update');
        }
        return await this._csrPost('/message/admin/user/note/update', params);
      }
      throw err;
    }
  }

  // csrWrapper.api.message.contact.create — POST /api/contactMessage/admin/create
  // CSR-composed contactMessage (creates a thread as if the user submitted it).
  // params: { topic, name, email, phone, description, orderId, zip?, last4?, actorId?, attachments? }
  // Returns the created thread with { _id, hash, ... } so callers can reply via
  // csrCreateCsrReply or share the replyLinkUrl with the user.
  async csrCreateContactMessage(params = {}) {
    return await this._viaCsr('api.message.contact.create', params,
      () => this._csrPost('/contactMessage/admin/create', params));
  }

  // csrWrapper.api.user.createCsrMail — DEPRECATED 2026-04-17
  //
  // BC's old `/api/message/admin/user/csrMail/create` route returns 404
  // ("Cannot POST") on `dev.www.bytecrtrs.com`. The replacement is the
  // contact.createCsrReply path (`/contactMessage/admin/csrReply`), but
  // that endpoint requires an existing `contactMessageId` to reply to —
  // it's a thread-reply, not a standalone outbound mail.
  //
  // To preserve the "Request billing action" UX (CSR-initiated outbound
  // mail to finance with no prior user thread), we do a two-step flow:
  //
  //   1. csrCreateContactMessage — creates a new contactMessage thread on
  //      the user's behalf (BC stores it as if the user had submitted).
  //   2. csrCreateCsrReply — replies to that thread with the actual
  //      billing-action content. BC then handles the email + thread.
  //
  // The final thread is visible in /csr/tickets for follow-up. Callers
  // must pass enough user context (name, email, phone, orderId) to
  // satisfy the create endpoint's validators (same as the consumer-side
  // contactMessage/create body — phone must be a valid number; orderId
  // must match /^[a-zA-Z0-9]{8,24}$/).
  //
  // params:
  //   { targetUserId, subject, message, contentType?, attachments?,
  //     // additional fields required to bootstrap the new thread:
  //     userName, userEmail, userPhone, orderId }
  async csrCreateCsrMail(params = {}) {
    const {
      targetUserId, subject, message,
      contentType = 'text/plain', attachments,
      userName, userEmail, userPhone, orderId,
    } = params;

    if (!userEmail) throw new Error('userEmail is required to seed the contactMessage thread');

    // Step 1: create the contactMessage on the user's behalf. Use the
    // CSR subject as the thread topic so the new thread is recognizable.
    const phoneDigits = String(userPhone || '').replace(/\D/g, '');
    const phone = phoneDigits.length >= 10 ? phoneDigits : '2125550100'; // same sentinel consumer uses
    const created = await this.csrCreateContactMessage({
      topic: subject || 'Billing action requested by CSR',
      name: userName || 'Member',
      email: userEmail,
      phone,
      description: subject || 'Billing action requested by CSR',
      orderId: orderId && /^[a-zA-Z0-9]{8,24}$/.test(orderId) ? orderId : 'NOORDERID0000',
    });

    // BC returns the new contactMessage as { success, messageResult: { _id, id, ... }, mailResult }.
    // Extract the new thread id from messageResult (primary), falling back
    // to other shapes the IIFE may emit for older deployments.
    const data = created?.getData?.() ?? created;
    const newThread = data?.messageResult || data?.contactMessage || data?.doc || data?.docs?.[0] || data;
    const contactMessageId = newThread?._id || newThread?.id;
    if (!contactMessageId) {
      const err = new Error('CSR contact-message create returned no id; cannot reply.');
      err.createResponse = created;
      throw err;
    }

    // Step 2: post the actual billing-action body as a CSR reply.
    return await this.csrCreateCsrReply({
      contactMessageId,
      subject,
      message,
      contentType,
      ...(attachments ? { attachments } : {}),
    });
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
  async csrFindUserContactMessages({ userId, userEmail, lastId } = {}) {
    if (!userId && !userEmail) throw new Error('userId or userEmail is required');
    // Try the targetUserId-keyed path first when we have an id. Most consumer
    // contactMessage docs created via /contactMessage/create have no
    // targetUserId set (BC doesn't auto-link from authed sessions on this
    // deployment), so the fallback below is the primary discovery path.
    if (userId) {
      try {
        return await this._csrPost(`/contactMessage/admin/find/${encodeURIComponent(userId)}`, lastId ? { lastId } : {});
      } catch (err) {
        if (err?.status !== 404 && err?.status !== 405) throw err;
        dbg(`[csrFindUserContactMessages] /contactMessage/admin/find/${userId} → 404, falling back to inbox-wide GET + client-side filter`);
      }
    }
    // Fallback: scan recent contactMessages and filter client-side. Match
    // either targetUserId === userId (BC's intended link) OR sender email
    // === userEmail (covers messages with no targetUserId set).
    const raw = await this.csrFindContactMessages(lastId ? { lastId } : {});
    const docs = raw?.docs ?? raw?.data ?? (Array.isArray(raw) ? raw : []);
    const wantEmail = (userEmail || '').toLowerCase().trim();
    const filtered = docs.filter((d) => {
      const t = d?.content?.targetUserId || d?.targetUserId;
      if (userId && t === userId) return true;
      if (!wantEmail) return false;
      const senderEmail = (d?.content?.input?.email || d?.content?.email || '').toLowerCase().trim();
      return senderEmail === wantEmail;
    });
    dbg(`[csrFindUserContactMessages] filter matched ${filtered.length}/${docs.length} (userId=${userId || '∅'}, email=${wantEmail || '∅'})`);
    return {
      docs: filtered,
      noMoreDocs: raw?.noMoreDocs ?? true,
      _fallback: 'inbox-filter',
    };
  }

  // csrWrapper.api.message.contact.histories — GET /api/contactMessage/admin/histories
  // Returns the full thread (contact + user/csr replies) for a contact message.
  async csrFindContactHistories(params = {}) {
    const qs = new URLSearchParams();
    if (params.contactMessageId) qs.set('contactMessageId', params.contactMessageId);
    if (params.lastId) qs.set('lastId', params.lastId);
    return await this._csrGet(`/contactMessage/admin/histories?${qs.toString()}`);
  }

  // csrWrapper.api.message.contact.createCsrReply — POST /contactMessage/admin/csrReply
  // The deployed CSR IIFE uses /contactMessage/admin/csrReply (not the older
  // /message/admin/user/csrMail/create from earlier BC docs) and posts
  // FormData rather than JSON. Direct fallback follows the same shape.
  // params: { contactMessageId, subject, message, contentType, attachments? }
  async csrCreateCsrReply(params = {}) {
    const { contentType = 'text/html', ...rest } = params;
    const body = { contentType, ...rest };
    return await this._viaCsr('api.message.contact.createCsrReply', body,
      () => this._csrPostFormData('/contactMessage/admin/csrReply', body));
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
  // BC's IIFE shapes the body as { collectionName: 'trackings' (plural),
  // query: { 'data.type': type } } — confirmed against the deployed CSR
  // wrapper at dev.admin.www.bytecrtrs.com/libs/csr-wrapper/index.iife.js.
  // We extend with `updaterId` so the search filters server-side to a specific
  // user; without it BC returns events for everyone of that type and we'd have
  // to paginate through the whole system to find one user's events.
  // type supports pipe-separated values, e.g.
  //   'USER:nameSearchTeaser|USER:phoneSearchTeaser'.
  // Supported types: USER:nameSearchTeaser, USER:phoneSearchTeaser,
  //   USER:nameSearchTeaserOptOut, USER:phoneSearchTeaserOptOut,
  //   USER:nameSearch, USER:phoneSearch, USER:login (2026-04-13).
  async csrFindUserTracking(params = {}) {
    const { type, lastId, updaterId } = params;
    const query = {};
    if (type) query['data.type'] = type;
    if (updaterId) query['updaterId'] = updaterId;
    const body = { collectionName: 'trackings', query };
    if (lastId) body.lastId = lastId;
    // Always direct-POST: the IIFE's tracking.findUser doesn't accept an
    // updaterId filter, so going through it returns events for every user
    // and we'd page forever to find this one's. The direct path filters
    // server-side via query.updaterId.
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
   * Create a user contact message (logged-in users only).
   * POST /api/message/userContact
   * apiWrapper.api.user.createContact({ message, parentCsrMessageId?, contentType })
   * Used for member-initiated messages and replies to CSR mail.
   *
   * The dev IIFE may not expose `user.createContact` — try it first, fall back
   * to direct POST. Same pattern as userUpdate.
   */
  async createUserContact(params) {
    if (!this.useProxy) {
      try {
        const wrapper = await this.getWrapper();
        if (typeof wrapper.api?.user?.createContact === 'function') {
          return _unwrapBcResponse(await wrapper.api.user.createContact(params));
        }
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          dbgWarn('[BC user.createContact] IIFE path threw; falling back to direct POST:', error?.message);
        }
        if (error?.status || error?.data) throw error;
      }
    }
    try {
      return await this._csrPost('/message/userContact', params);
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
