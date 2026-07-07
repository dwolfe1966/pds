const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const cookieParser = require('cookie-parser');
const { seedData } = require('./seed');
const { authenticateToken, requireRole } = require('./middleware/auth');
const emailService = require('./emailService');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key-change-in-production';

// In-memory data store
let dataStore = {
  users: [],
  people: [],
  searches: [],
  profileViews: [],
  alerts: [],
  notifications: [],
  subscriptions: [],
  invoices: [],
  sessions: [],
  dataRemovalRequests: [],
  csReps: [],
  refreshTokens: new Map(), // Map of refreshToken -> userId
};

// In-memory event log for analytics tracking
let eventLog = [];

// In-memory contact/support thread stores
const contactThreads = new Map(); // threadId -> thread object
const userThreads = new Map();    // userId -> Set of threadIds

// Seed data on startup
try {
  console.log('Loading seed data...');
  const seededData = seedData();
  // Preserve the refreshTokens Map
  dataStore = {
    ...seededData,
    profileViews: seededData.profileViews || [],
    refreshTokens: new Map() // Re-initialize the Map
  };
  console.log('Seed data loaded successfully');
  console.log(`- Users: ${dataStore.users.length}`);
  console.log(`- People: ${dataStore.people.length}`);
} catch (error) {
  console.error('Error seeding data:', error);
  console.error(error.stack);
  process.exit(1);
}

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3003', 'http://localhost:3010'],
  credentials: true, // CRITICAL: Allow cookies to be sent
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'Cookie', 
    'X-Captcha-Pass',
    'x-captcha-id',        // Custom header used by ByteCrtrs library
    'X-Captcha-Id',        // Case variations
    'x-captcha-token',     // May be used by library
    'X-Captcha-Token',     // Case variations
    'x-requested-with',    // Common header
    'X-Requested-With',    // Case variations
    // Allow all custom headers that start with x- (common pattern)
  ],
  exposedHeaders: ['Set-Cookie'] // Expose Set-Cookie header to browser
}));
app.use(express.json());
app.use(cookieParser()); // Parse cookies from requests

// Health check endpoint
app.get('/api/v1/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Debug endpoint to check seed data (remove in production)
app.get('/api/v1/debug/people', (req, res) => {
  const { name } = req.query;
  let people = dataStore.people;
  
  if (name) {
    const nameLower = name.toLowerCase();
    people = people.filter(p => p.fullName.toLowerCase().includes(nameLower));
  }
  
  res.json({
    total: dataStore.people.length,
    matching: people.length,
    sample: people.slice(0, 20).map(p => ({
      fullName: p.fullName,
      location: p.location,
      zip: p.addresses?.[0]?.zip
    }))
  });
});

// Request logging middleware (for debugging)
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// ==================== PROXY ENDPOINTS FOR CORS BYPASS ====================
// These endpoints proxy requests to the external API to bypass CORS restrictions

const EXTERNAL_API_URL = process.env.EXTERNAL_API_URL || 'https://dev1.dev.www.bytecrtrs.com/api';

// Store cookies from API responses so we can forward them with subsequent requests
// Since clientId and apiId change between requests, we'll use origin + a stable identifier
// Key: origin-based session identifier, Value: array of cookies
const apiCookies = new Map();

// Store captcha verification data (commerceContentId, searchContextKey) from captcha responses
// Key: origin-based session identifier, Value: object with captcha data
const captchaData = new Map();

// Helper to get a stable session key (since clientId/apiId change)
function getSessionKey(req) {
  // Use origin as the base, since all requests from same browser should share cookies
  const origin = req.headers.origin || 'http://localhost:3000';
  // For now, use origin as the key (all requests from same origin share cookies)
  // In the future, we could add user identification if needed
  return `origin:${origin}`;
}

/**
 * Handle CORS preflight requests for proxy endpoints
 */
app.options('/api/proxy/*', (req, res) => {
  const origin = req.headers.origin;
  if (origin && (origin.includes('localhost:3000') || origin.includes('localhost:3001') || origin.includes('localhost:3003') || origin.includes('localhost:3010'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', [
    'Content-Type',
    'Authorization',
    'Cookie',
    'X-Captcha-Pass',
    'x-captcha-id',
    'X-Captcha-Id',
    'x-captcha-token',
    'X-Captcha-Token',
    'x-requested-with',
    'X-Requested-With'
  ].join(', '));
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Expose-Headers', 'Set-Cookie');
  res.status(204).send();
});

/**
 * Generic proxy endpoint that forwards requests to the external API
 * This bypasses CORS by making the request from the server instead of the browser
 * 
 * The JS library will make requests like: /api/proxy/idLookup/teaser/search
 * This endpoint forwards them to: https://dev1.dev.www.bytecrtrs.com/api/idLookup/teaser/search
 */
app.all('/api/proxy/*', async (req, res) => {
  try {
    // Extract the path after /api/proxy/
    // e.g., /api/proxy/idLookup/teaser/search -> /idLookup/teaser/search
    const proxyPath = req.path.replace('/api/proxy', '');
    const targetUrl = `${EXTERNAL_API_URL}${proxyPath}`;
    
    // Forward query parameters
    const url = new URL(targetUrl);
    Object.keys(req.query).forEach(key => {
      url.searchParams.append(key, req.query[key]);
    });
    
    // Helper: get header value case-insensitively from one or more sources
    const getHeaderCaseInsensitive = (headerName, primaryHeaders = headers, secondaryHeaders = req.headers) => {
      const lower = headerName.toLowerCase();
      const sources = [primaryHeaders, secondaryHeaders].filter(Boolean);
      for (const source of sources) {
        for (const key in source) {
          if (key.toLowerCase() === lower) return source[key];
        }
      }
      return null;
    };

    // Prepare headers - forward all headers from the browser request
    // This is important because the API library may set security headers
    // that the API server expects to see
    const headers = {};
    
    // Forward all headers from the original request (except those that would break)
    const headersToSkip = [
      'host',           // Server hostname - must be the target API
      'connection',     // Connection header
      'content-length', // Will be recalculated by axios
      'x-powered-by',   // Express header, not needed
      'set-cookie',     // This is a response header, not a request header
    ];
    
    Object.keys(req.headers).forEach(key => {
      const lowerKey = key.toLowerCase();
      if (!headersToSkip.includes(lowerKey)) {
        // Preserve original header name casing
        headers[key] = req.headers[key];
      }
    });
    
    // Ensure Content-Type is set (critical for POST requests)
    if (!headers['Content-Type'] && !headers['content-type']) {
      headers['Content-Type'] = 'application/json';
    }
    
    // The API might check User-Agent to verify it's a real browser request
    // Make sure we forward the browser's User-Agent
    if (!headers['User-Agent'] && !headers['user-agent']) {
      headers['User-Agent'] = req.headers['user-agent'] || 'Mozilla/5.0 (compatible; IDLookup-Proxy/1.0)';
    }
    
    // Forward cookies - CRITICAL: The API uses cookies for captcha verification
    // The captcha/verify endpoint sets a cookie that must be sent with subsequent requests
    
    // Get stable session key (based on origin, not clientId/apiId which change)
    const sessionKey = getSessionKey(req);
    
    // Try to get cookies from multiple sources:
    // 1. Browser request (if sent)
    const cookieHeader = req.headers.cookie || req.headers.Cookie;
    
    // 2. Parsed cookies from cookie-parser
    const parsedCookies = req.cookies || {};
    
    // 3. Server-side stored cookies (from previous API responses)
    let storedCookies = [];
    if (apiCookies.has(sessionKey)) {
      storedCookies = apiCookies.get(sessionKey);
      console.log(`[Proxy] Found ${storedCookies.length} stored cookie(s) for session: ${sessionKey}`);
    } else {
      console.log(`[Proxy] No stored cookies found for session: ${sessionKey}`);
    }

    // Add dev captcha pass if configured (for development API)
    // The API might require this as a header or query parameter
    const captchaPass = process.env.CAPTCHA_PASS || 'bcEdgeApiPass';

    // For password.v0 captcha verify calls in development, auto-substitute the token.
    // The library shows an "Input Password" modal; the developer can click Confirm
    // with any input and the proxy substitutes the correct dev password automatically.
    if (req.path.includes('/captcha/verify') && req.query.type === 'password.v0') {
      url.searchParams.set('token', captchaPass);
      console.log('[Proxy] [Dev] Auto-substituting password.v0 captcha token for development');
    }

    // If we have no cookies for teaser search, warm up captcha cookies
    const hasAnyCookiesInitial = cookieHeader || Object.keys(parsedCookies).length > 0 || storedCookies.length > 0;
    if (!hasAnyCookiesInitial && req.path.includes('/idLookup/teaser/search') && req.method === 'POST') {
      const clientId = req.query.clientId;
      const apiId = req.query.apiId;
      if (clientId && apiId) {
        try {
          const verifyUrl = new URL(`${EXTERNAL_API_URL}/captcha/verify`);
          verifyUrl.searchParams.append('token', captchaPass);
          verifyUrl.searchParams.append('type', 'password.v0');
          verifyUrl.searchParams.append('step', '0-0');
          verifyUrl.searchParams.append('clientId', clientId);
          verifyUrl.searchParams.append('apiId', apiId);

          const verifyResponse = await axios({
            method: 'GET',
            url: verifyUrl.toString(),
            headers
          });

          const verifyCookies = verifyResponse.headers['set-cookie'];
          if (verifyCookies) {
            const cookies = Array.isArray(verifyCookies) ? verifyCookies : [verifyCookies];
            const existingCookies = apiCookies.get(sessionKey) || [];
            const allCookies = [...existingCookies];

            cookies.forEach(newCookie => {
              const newCookieName = newCookie.match(/^([^=]+)=/)?.[1];
              if (newCookieName) {
                const filtered = allCookies.filter(c => {
                  const oldCookieName = c.match(/^([^=]+)=/)?.[1];
                  return oldCookieName !== newCookieName;
                });
                allCookies.length = 0;
                allCookies.push(...filtered, newCookie);
              } else {
                allCookies.push(newCookie);
              }
            });

            apiCookies.set(sessionKey, allCookies);
            storedCookies = allCookies;
            console.log(`[Proxy] Captcha verify stored ${cookies.length} cookie(s) for session: ${sessionKey}`);
          } else {
            console.warn('[Proxy] Captcha verify returned no Set-Cookie headers');
          }
        } catch (error) {
          console.warn('[Proxy] Captcha verify warm-up failed:', error.message || error);
        }
      } else {
        console.warn('[Proxy] Captcha verify warm-up skipped: missing clientId/apiId');
      }
    }
    
    // Combine all cookie sources
    let allCookies = [];
    
    if (cookieHeader) {
      // Parse browser cookies
      cookieHeader.split(';').forEach(c => {
        const trimmed = c.trim();
        if (trimmed) allCookies.push(trimmed);
      });
    }
    
    // Add stored cookies from API responses, replacing any browser cookie with the same name.
    // This prevents duplicate session cookies (e.g. two connect.sid values) when the browser
    // has cached an old cookie but the server has a fresher one from a more recent BC login.
    //
    // EXCEPTION: Do NOT forward stored session cookies on login requests.
    // Sending an existing session cookie alongside new credentials confuses BC and causes 401.
    // Login must always create a fresh BC session.
    const isLoginRequest = proxyPath === '/auth/login';
    if (!isLoginRequest) {
      storedCookies.forEach(cookie => {
        // Extract cookie name=value from stored cookie string
        const match = cookie.match(/^([^=]+)=([^;]+)/);
        if (match) {
          const cookieName = match[1].trim();
          // Remove any existing entry with the same name before adding the stored (authoritative) one
          const existingIdx = allCookies.findIndex(c => c.split('=')[0].trim() === cookieName);
          if (existingIdx !== -1) {
            allCookies.splice(existingIdx, 1);
          }
          allCookies.push(`${match[1]}=${match[2]}`);
        }
      });
    }
    
    if (allCookies.length > 0) {
      headers['Cookie'] = allCookies.join('; ');
      console.log(`[Proxy] Forwarding cookies (${allCookies.length} total): ${headers['Cookie'].substring(0, 150)}...`);
    } else {
      // Log if cookies are missing - this is likely the issue
      console.warn('[Proxy] WARNING: No cookies found in request. Captcha verification cookie may be missing.');
      console.warn('[Proxy] Request headers:', Object.keys(req.headers).filter(k => k.toLowerCase().includes('cookie')));
      console.warn('[Proxy] Parsed cookies:', parsedCookies);
      console.warn('[Proxy] Stored cookies for session:', sessionKey ? (apiCookies.has(sessionKey) ? 'found' : 'not found') : 'no session key');
    }
    
    // captchaPass is required on ALL proxy requests including teaser search.
    // ByteCrtrs needs captchaPass on the retry request (after captcha verify) to return real results.
    // Without it, the retry gets 201 but commerceContent is null.
    if (!headers['X-Captcha-Pass'] && !headers['x-captcha-pass']) {
      headers['X-Captcha-Pass'] = captchaPass;
    }
    if (captchaPass && !url.searchParams.has('captcha') && !url.searchParams.has('captchaPass')) {
      url.searchParams.append('captchaPass', captchaPass);
    }
    
    // Prepare request body
    let requestBody = req.body || {};
    
    // For teaser search requests, handle missing required fields
    // The API requires commerceContentId and searchContextKey
    // These might come from the captcha verification response, or we need to generate placeholders
    if (req.path.includes('/idLookup/teaser/search') && req.method === 'POST') {
      // Log the original request body from the library
      console.log('[Proxy] ========== TEASER SEARCH REQUEST ==========');
      console.log('[Proxy] Original request body from library:', JSON.stringify(requestBody, null, 2));
      console.log('[Proxy] Request body keys:', Object.keys(requestBody || {}));
      console.log('[Proxy] Library sent commerceContentId?', !!requestBody.commerceContentId, requestBody.commerceContentId ? `(${requestBody.commerceContentId.length} chars)` : '');
      console.log('[Proxy] Library sent searchContextKey?', !!requestBody.searchContextKey, requestBody.searchContextKey ? `(${requestBody.searchContextKey.length} chars)` : '');
      // Pagination / results-per-page validation
      const perPageVal = requestBody.perPage ?? requestBody.per_page ?? requestBody.pageSize;
      const isGetMore = !!(requestBody.commerceContentId && requestBody.page != null);
      console.log('[Proxy] Results-per-page param:', perPageVal != null ? `perPage/per_page/pageSize=${perPageVal}` : 'NOT SET');
      console.log('[Proxy] Is pagination (getMore) request:', isGetMore, isGetMore ? `(page=${requestBody.page})` : '');
      
      // Check if we have captcha data stored for this session
      const sessionKey = getSessionKey(req);
      const storedCaptchaData = captchaData.get(sessionKey);
      
      // Log captcha-related headers from the request
      // HTTP headers are case-insensitive, but JavaScript object keys are case-sensitive
      // So we need to check multiple case variations
      const requestCaptchaId = getHeaderCaseInsensitive('x-captcha-id');
      console.log('[Proxy] Captcha ID in request:', requestCaptchaId || 'NOT FOUND');
      console.log('[Proxy] All captcha-related headers:', {
        'x-captcha-id': getHeaderCaseInsensitive('x-captcha-id') || 'NOT FOUND',
        'X-Captcha-Pass': getHeaderCaseInsensitive('x-captcha-pass') || 'NOT FOUND'
      });
      
      // Try to get values from stored captcha data first
      if (storedCaptchaData) {
        console.log('[Proxy] Found stored captcha data:', {
          hasCommerceContentId: !!storedCaptchaData.commerceContentId,
          hasSearchContextKey: !!storedCaptchaData.searchContextKey
        });
        
        // Add missing required fields from stored captcha data
        if (!requestBody.commerceContentId && storedCaptchaData.commerceContentId) {
          requestBody.commerceContentId = storedCaptchaData.commerceContentId;
          console.log('[Proxy] Added commerceContentId from stored captcha data');
        }
        if (!requestBody.contextKey && storedCaptchaData.contextKey) {
          requestBody.contextKey = storedCaptchaData.contextKey;
          console.log('[Proxy] Added contextKey from stored captcha data');
        }
        if (!requestBody.searchContextKey && storedCaptchaData.searchContextKey) {
          requestBody.searchContextKey = storedCaptchaData.searchContextKey;
          console.log('[Proxy] Added searchContextKey from stored captcha data');
        }
      }
      
      // Check if captcha was verified for this session
      const captchaVerified = storedCaptchaData?.verified === true;
      const verifiedCaptchaId = storedCaptchaData?.captchaId;
      
      // If we have a captchaId in the request header, check if it matches verified one
      if (requestCaptchaId) {
        // If captcha is verified and the request captchaId matches, we're good
        if (captchaVerified && verifiedCaptchaId === requestCaptchaId) {
          console.log(`[Proxy] ✓ Captcha verified and matches request (captchaId: ${requestCaptchaId})`);
        } else if (captchaVerified && verifiedCaptchaId !== requestCaptchaId) {
          console.warn(`[Proxy] WARNING: Request captchaId (${requestCaptchaId}) doesn't match verified captchaId (${verifiedCaptchaId})`);
        } else if (!captchaVerified) {
          console.warn('[Proxy] WARNING: Captcha not verified yet. Search request may fail with 412.');
          console.warn('[Proxy] The API requires captcha verification before search requests.');
          console.warn('[Proxy] Flow: Search → 412 (captcha challenge) → Verify captcha → Retry search');
          console.warn(`[Proxy] Request has captchaId: ${requestCaptchaId}, but it hasn't been verified yet.`);
        }
      } else {
        // No captchaId in request - this might be the first request that triggers the challenge
        if (!captchaVerified) {
          console.log('[Proxy] No captchaId in request - this may trigger a 412 captcha challenge');
        } else {
          console.warn('[Proxy] WARNING: Captcha verified but no captchaId in request header');
        }
      }
      
      // commerceContentId: ALWAYS remove for non-pagination teaser searches.
      // ByteCrtrs generates its own commerce session — a client-supplied ID (even valid 24-char)
      // causes ByteCrtrs to look up a non-existent session and return {"commerceContent": null}.
      // Only keep for pagination (getMore) requests where it came from a prior search response.
      if (!isGetMore) {
        delete requestBody.commerceContentId;
        console.log('[Proxy] Removed commerceContentId from non-pagination teaser search');
      }

      // perPage: ByteCrtrs teaser search only supports 5 results per page.
      // Remove any override to let the API use its default.
      delete requestBody.perPage;
      delete requestBody.per_page;
      delete requestBody.pageSize;
      if (!requestBody.contextKey || requestBody.contextKey === '') {
        delete requestBody.contextKey;
      }

      // searchContextKey: keep as-is if present; fall back to stored value
      if (!requestBody.searchContextKey || requestBody.searchContextKey === '') {
        if (storedCaptchaData?.searchContextKey && storedCaptchaData.searchContextKey.length >= 1) {
          requestBody.searchContextKey = storedCaptchaData.searchContextKey;
          console.log(`[Proxy] Using searchContextKey from captcha data: ${storedCaptchaData.searchContextKey}`);
        } else {
          delete requestBody.searchContextKey;
          console.log('[Proxy] No valid searchContextKey available - removing from request');
        }
      }

      // Remove any other empty/null/undefined fields that might cause validation errors
      const cleanedBody = { ...requestBody };
      Object.keys(cleanedBody).forEach(key => {
        const value = cleanedBody[key];
        // Don't remove these fields - we just set them
        if (key !== 'commerceContentId' && key !== 'searchContextKey' && key !== 'contextKey') {
          if (value === '' || value === null || value === undefined) {
            delete cleanedBody[key];
            console.log(`[Proxy] Removed empty field from request: ${key}`);
          }
        }
      });
      
      requestBody = cleanedBody;
      
      // Log the final body with full details
      console.log('[Proxy] Final teaser search request body:', JSON.stringify(requestBody, null, 2));
      console.log('[Proxy] Request body field check:', {
        hasType: !!requestBody.type,
        type: requestBody.type,
        hasFName: !!requestBody.fName,
        fName: requestBody.fName,
        hasLName: !!requestBody.lName,
        lName: requestBody.lName,
        hasState: !!requestBody.state,
        state: requestBody.state,
        hasSearchContextKey: !!requestBody.searchContextKey,
        searchContextKey: requestBody.searchContextKey,
        hasCommerceContentId: !!requestBody.commerceContentId,
        commerceContentIdLength: requestBody.commerceContentId?.length || 0,
        allKeys: Object.keys(requestBody)
      });
    }

    // For report detail, short-circuit invalid IDs to avoid proxying bad requests
    if (req.path.includes('/idLookup/report/detail/') && req.method === 'GET') {
      const idPart = req.path.split('/idLookup/report/detail/')[1];
      if (!idPart || idPart === 'undefined' || idPart === 'null') {
        console.warn('[Proxy] Blocking report detail request with invalid id:', idPart);
        res.status(400).json({ message: 'Report detail requires a valid commerceContentId' });
        return;
      }
    }

    // For report creation, inject captcha/session context if available
    if (req.path.includes('/idLookup/report/create') && req.method === 'POST') {
      const sessionKey = getSessionKey(req);
      const storedCaptchaData = captchaData.get(sessionKey);

      if (storedCaptchaData) {
        // Ensure captcha id header is present if we have one
        const captchaIdToUse = storedCaptchaData.captchaId || storedCaptchaData.pendingCaptchaId;
        if (captchaIdToUse) {
          const hasCaptchaHeader = Object.keys(headers).some(key => key.toLowerCase() === 'x-captcha-id');
          if (!hasCaptchaHeader) {
            headers['x-captcha-id'] = captchaIdToUse;
          }
          // Also set canonical casing for APIs that check specific header casing
          headers['X-Captcha-Id'] = headers['X-Captcha-Id'] || captchaIdToUse;
        }
        // Ensure captcha token header is present if we have one
        if (storedCaptchaData.captchaToken) {
          const hasCaptchaTokenHeader = Object.keys(headers).some(key => key.toLowerCase() === 'x-captcha-token');
          if (!hasCaptchaTokenHeader) {
            headers['x-captcha-token'] = storedCaptchaData.captchaToken;
          }
          // Also set canonical casing for APIs that check specific header casing
          headers['X-Captcha-Token'] = headers['X-Captcha-Token'] || storedCaptchaData.captchaToken;
        }

        // Add missing context fields to body
        if (!requestBody.searchContextKey && storedCaptchaData.searchContextKey) {
          requestBody.searchContextKey = storedCaptchaData.searchContextKey;
        }
        if (!requestBody.commerceContentId && storedCaptchaData.commerceContentId) {
          requestBody.commerceContentId = storedCaptchaData.commerceContentId;
        }
        // Some API variants expect captcha identifiers in the body
        if (!requestBody.captchaId && captchaIdToUse) {
          requestBody.captchaId = captchaIdToUse;
        }
        if (!requestBody.captchaToken && storedCaptchaData.captchaToken) {
          requestBody.captchaToken = storedCaptchaData.captchaToken;
        }
      }

      // Dev fallback: if captchaToken is still missing, inject the dev bypass pass.
      // The ByteCrtrs dev API accepts the bcEdgeApiPass value as a captchaToken.
      if (!requestBody.captchaToken) {
        requestBody.captchaToken = captchaPass;
        console.log('[Proxy] [Dev] Injecting captchaPass as captchaToken fallback for report/create');
      }

        console.log('[Proxy] ══════ REPORT CREATE REQUEST ══════');
      console.log('[Proxy] Endpoint: POST /idLookup/report/create');
      console.log('[Proxy] Request body:', JSON.stringify(requestBody, null, 2));
      console.log('[Proxy] Auth/captcha fields present:', {
        captchaId: requestBody.captchaId || getHeaderCaseInsensitive('x-captcha-id') || 'MISSING',
        captchaToken: requestBody.captchaToken ? 'PRESENT' : (getHeaderCaseInsensitive('x-captcha-token') ? 'PRESENT (header)' : 'MISSING'),
        searchContextKey: requestBody.searchContextKey || 'MISSING',
        commerceContentId: requestBody.commerceContentId || 'MISSING',
        extId: requestBody.extId || 'MISSING',
        type: requestBody.type || 'MISSING',
      });
      if (!requestBody.captchaToken && !getHeaderCaseInsensitive('x-captcha-token')) {
        console.warn('[Proxy] ⚠ captchaToken missing from report/create request — this often causes 403');
      }
      console.log('[Proxy] ══════════════════════════════════');
    }
    
    // Forward the request
    const config = {
      method: req.method,
      url: url.toString(),
      headers,
      data: requestBody,
      validateStatus: () => true, // Don't throw on any status code
      // Important: Forward cookies from the browser request
      // The API uses cookies to track captcha verification
      maxRedirects: 0, // Don't follow redirects
    };
    
    console.log(`[Proxy] ${req.method} ${req.path} -> ${targetUrl}`);
    if (req.query.clientId) {
      console.log(`[Proxy] Query params: clientId=${req.query.clientId.substring(0, 10)}..., apiId=${req.query.apiId ? req.query.apiId.substring(0, 10) + '...' : 'none'}`);
    }
    
    // Log headers being sent (for debugging - always log in development, or when we get errors)
    const headerLog = { ...headers };
    if (headerLog['Authorization']) {
      headerLog['Authorization'] = 'Bearer ***';
    }
    if (headerLog['Cookie']) {
      // Show first 50 chars of cookie for debugging
      const cookieStr = String(headerLog['Cookie']);
      headerLog['Cookie'] = cookieStr.length > 50 ? cookieStr.substring(0, 50) + '...' : cookieStr;
    }
    if (process.env.NODE_ENV === 'development' || process.env.LOG_PROXY_HEADERS === 'true') {
      console.log(`[Proxy] Headers being sent:`, JSON.stringify(headerLog, null, 2));
    }
    
    // Log if cookies are missing (critical for captcha)
    // Check if we have cookies from ANY source (browser, parsed, or stored)
    const hasAnyCookies = cookieHeader || Object.keys(parsedCookies).length > 0 || storedCookies.length > 0;
    
    if (!hasAnyCookies && req.path.includes('/idLookup/teaser/search')) {
      console.error('[Proxy] ========== CRITICAL: No cookies in search request ==========');
      console.error('[Proxy] This will cause 412 errors. The captcha verification cookie is missing.');
      console.error('[Proxy] Check browser DevTools -> Application -> Cookies to see if cookies are being stored.');
      console.error('[Proxy] The captcha/verify endpoint should set a cookie that gets sent here.');
      console.error('[Proxy] ============================================================');
    } else if (req.path.includes('/idLookup/teaser/search')) {
      console.log(`[Proxy] ✓ Cookies available for search: browser=${!!cookieHeader}, parsed=${Object.keys(parsedCookies).length}, stored=${storedCookies.length}`);
    }
    
    // Always log cookie status for captcha-related requests
    if (req.path.includes('/captcha/') || req.path.includes('/idLookup/')) {
      console.log(`[Proxy] Cookie status for ${req.path}:`, {
        hasCookieHeader: !!cookieHeader,
        cookieHeaderLength: cookieHeader ? cookieHeader.length : 0,
        parsedCookiesCount: Object.keys(parsedCookies).length,
        parsedCookieKeys: Object.keys(parsedCookies)
      });
    }
    
    const response = await axios(config);
    
    // Store captcha verification data if this is a captcha/verify response
    if (req.path.includes('/captcha/verify') && response.status === 200) {
      const sessionKey = getSessionKey(req);
      try {
        // Log the full captcha response to see what it contains
        const responseData = response.data;
        console.log('[Proxy] Captcha verify response headers:', Object.keys(response.headers || {}));
        console.log('[Proxy] ========== Captcha Verify Response ==========');
        console.log('[Proxy] Full response data:', JSON.stringify(responseData, null, 2));
        console.log('[Proxy] Response keys:', Object.keys(responseData || {}));
        console.log('[Proxy] Request query params:', JSON.stringify(req.query));
        
        // Get captchaId from multiple sources:
        // 1. Query params (if the JS library sends it)
        // 2. Pending captchaId from previous 412 response
        // 3. From the search request's x-captcha-id header (if available)
        const sessionKey = getSessionKey(req);
        const existingCaptchaData = captchaData.get(sessionKey) || {};
        const captchaId = req.query.captchaId || 
                         req.query.id || 
                         existingCaptchaData.pendingCaptchaId ||
                         null;
        
        console.log('[Proxy] CaptchaId sources:', {
          fromQuery: req.query.captchaId || req.query.id || 'NOT FOUND',
          fromPending: existingCaptchaData.pendingCaptchaId || 'NOT FOUND',
          final: captchaId || 'NOT FOUND'
        });
        
        // Try to extract commerceContentId and searchContextKey from response
        // Check multiple possible locations
        const requestCaptchaToken =
          getHeaderCaseInsensitive('x-captcha-token') ||
          req.body?.captchaToken ||
          req.body?.captcha_token ||
          req.body?.token ||
          null;

        const captchaIdFromHeaders =
          getHeaderCaseInsensitive('x-captcha-id', response.headers, req.headers) ||
          getHeaderCaseInsensitive('x-captcha-id');
        const captchaTokenFromHeaders =
          getHeaderCaseInsensitive('x-captcha-token', response.headers, req.headers) ||
          getHeaderCaseInsensitive('x-captcha-token');

        // Some APIs may set captchaToken in cookies; attempt to parse it
        let captchaTokenFromCookies = null;
        const setCookieHeader = response.headers['set-cookie'];
        const cookieList = Array.isArray(setCookieHeader) ? setCookieHeader : (setCookieHeader ? [setCookieHeader] : []);
        cookieList.forEach((cookie) => {
          const match = cookie.match(/captchaToken=([^;]+)/i) || cookie.match(/captcha_token=([^;]+)/i);
          if (match && match[1]) {
            captchaTokenFromCookies = match[1];
          }
        });

        const captchaInfo = {
          captchaId: captchaId || captchaIdFromHeaders || null, // Store the captchaId that was verified
          captchaToken: responseData.captchaToken ||
                       responseData.captcha_token ||
                       responseData.token ||
                       responseData.data?.captchaToken ||
                       responseData.data?.captcha_token ||
                       responseData.data?.token ||
                       captchaTokenFromHeaders ||
                       captchaTokenFromCookies ||
                       requestCaptchaToken ||
                       null,
          commerceContentId: responseData.commerceContentId || 
                            responseData.commerceContent?._id || 
                            responseData.commerceContentId ||
                            responseData.data?.commerceContentId ||
                            null,
          searchContextKey: responseData.searchContextKey || 
                           responseData.searchContext?.key || 
                           responseData.searchContextKey ||
                           responseData.data?.searchContextKey ||
                           null,
          verified: true, // Mark that captcha was verified
          verifiedAt: new Date().toISOString(),
          // Store the full response for debugging
          _rawResponse: responseData
        };
        
        console.log('[Proxy] Extracted captcha data:', {
          captchaId: captchaInfo.captchaId || captchaIdFromHeaders || 'NOT FOUND',
          captchaToken: captchaInfo.captchaToken ? 'FOUND' : 'NOT FOUND',
          commerceContentId: captchaInfo.commerceContentId || 'NOT FOUND',
          searchContextKey: captchaInfo.searchContextKey || 'NOT FOUND',
          verified: captchaInfo.verified
        });
        
        // Store even if empty - we'll log what we found
        captchaData.set(sessionKey, captchaInfo);
        console.log(`[Proxy] Stored captcha data for session: ${sessionKey}`);
        console.log('[Proxy] ============================================');
      } catch (error) {
        console.error('[Proxy] Error storing captcha data:', error.message);
        console.error('[Proxy] Error stack:', error.stack);
      }
    }
    
    // For 412 responses with captcha challenge, store ALL fields ByteCrtrs returns.
    // The library's retry will need commerceContentId and contextKey in the request body.
    if (response.status === 412) {
      const sessionKey = getSessionKey(req);
      const challengeBody = response.data || {};
      const captchaId = challengeBody.captchaId;
      console.log(`[Proxy] 412 challenge body keys: ${Object.keys(challengeBody).join(', ')}`);
      console.log(`[Proxy] 412 commerceContentId: ${challengeBody.commerceContentId || 'NOT PRESENT'}`);
      console.log(`[Proxy] 412 contextKey: ${challengeBody.contextKey || 'NOT PRESENT'}`);
      if (captchaId) {
        console.log(`[Proxy] Storing 412 challenge data for session: ${sessionKey}`);
      }
      const existing = captchaData.get(sessionKey) || {};
      captchaData.set(sessionKey, {
        ...existing,
        pendingCaptchaId: captchaId || existing.pendingCaptchaId,
        commerceContentId: challengeBody.commerceContentId || existing.commerceContentId,
        contextKey: challengeBody.contextKey || existing.contextKey,
        challengeReceivedAt: new Date().toISOString()
      });
    }
    
    // Log response for search requests (success or failure)
    if (req.path.includes('/idLookup/teaser/search')) {
      console.log('='.repeat(80));
      console.log(`[Proxy] Search Response Status: ${response.status}`);
      // 200 (OK) and 201 (Created) are both success status codes
      if (response.status === 200 || response.status === 201) {
        console.log('[Proxy] ✓ Search request SUCCEEDED');
        console.log('[Proxy] Response data keys:', Object.keys(response.data || {}));
        
        // Check response structure based on API documentation
        if (response.data?.raws) {
          console.log('[Proxy] Response contains raws array with', response.data.raws?.length || 0, 'items');
          if (response.data.raws[0]?.transient?.identities) {
            const identities = response.data.raws[0].transient.identities;
            console.log('[Proxy] Found', identities.length, 'identities in results');
          }
        } else if (response.data?.commerceContent) {
          console.log('[Proxy] Response contains commerceContent');
        } else if (response.data?.commerceContent === null) {
          console.log('[Proxy] ⚠ Response has commerceContent: null - This might mean no results found, or API returned empty response');
          console.log('[Proxy] Full response structure:', JSON.stringify(response.data, null, 2));
          console.log('[Proxy] Note: API docs say response should have raws.0.transient.identities, but we got commerceContent: null');
          console.log('[Proxy] This could mean: (1) No results found, (2) Different response format, or (3) API needs different parameters');
        } else {
          console.log('[Proxy] ⚠ Unexpected response structure. Full response:', JSON.stringify(response.data, null, 2).substring(0, 1000));
        }
      } else {
        console.log('[Proxy] ✗ Search request FAILED');
      }
      console.log('[Proxy] Response status:', response.status);
      console.log('[Proxy] Response data:', JSON.stringify(response.data).substring(0, 500));
      console.log('='.repeat(80));
    }
    
    // Check for errors and log details
    if (response.status === 412) {
      console.error('='.repeat(80));
      console.error('[Proxy] 412 Precondition Failed - API security check failed');
      console.error('[Proxy] Request URL:', url.toString());
      console.error('[Proxy] Request method:', req.method);
      console.error('[Proxy] Request headers sent:', JSON.stringify(headers, null, 2));
      console.error('[Proxy] Request body:', JSON.stringify(req.body).substring(0, 500));
      console.error('[Proxy] Response status:', response.status);
      console.error('[Proxy] Response headers:', JSON.stringify(response.headers, null, 2));
      console.error('[Proxy] Response data:', JSON.stringify(response.data));
      console.error('[Proxy] Possible causes:');
      console.error('  - Missing security headers (check what the JS library sets)');
      console.error('  - Missing cookies/session tokens');
      console.error('  - Origin/Referer header mismatch');
      console.error('  - Missing captcha verification token');
      console.error('  - API expects request from specific domain');
      console.error('  - Missing X-Captcha-Pass header or incorrect value');
      console.error('='.repeat(80));
    } else if (proxyPath === '/auth/login') {
      // Always dump the full login response so we can see exactly what BC returns
      console.log('[Proxy] ===== BC LOGIN RESPONSE DUMP =====');
      console.log('[Proxy] Status:', response.status);
      console.log('[Proxy] Response headers (set-cookie):', response.headers['set-cookie']);
      console.log('[Proxy] Response body (full):', JSON.stringify(response.data, null, 2));
      console.log('[Proxy] ===== END LOGIN RESPONSE =====');
    } else if (response.status >= 400) {
      const isReportCreate = req.path.includes('/idLookup/report/create');
      const isReportDetail = req.path.includes('/idLookup/report/detail');
      console.error('='.repeat(80));
      console.error(`[Proxy] ✗ HTTP ${response.status} from ByteCrtrs — ${req.method} ${req.path}`);

      if (response.status === 403 && (isReportCreate || isReportDetail)) {
        console.error('[Proxy] ══════ BYTECRTRS 403 DIAGNOSTIC (share this with ByteCrtrs support) ══════');
        console.error('[Proxy] Endpoint called:', `${req.method} ${EXTERNAL_API_URL}${proxyPath}`);
        console.error('[Proxy] clientId:', req.query.clientId || 'NOT IN QUERY');
        console.error('[Proxy] apiId:', req.query.apiId || 'NOT IN QUERY');
        console.error('[Proxy] Request body sent to ByteCrtrs:', JSON.stringify(requestBody, null, 2));
        console.error('[Proxy] ByteCrtrs response status:', response.status);
        console.error('[Proxy] ByteCrtrs response body:', JSON.stringify(response.data, null, 2));
        console.error('[Proxy] ByteCrtrs response headers:', JSON.stringify(response.headers, null, 2));
        console.error('[Proxy] Likely causes:');
        console.error('  1. API account does not have idLookup.report.create permission enabled');
        console.error('  2. Missing or invalid captchaToken (see captchaToken field above)');
        console.error('  3. searchContextKey not configured for this account');
        console.error('  4. commerceContentId from teaser search not accepted for report creation');
        console.error('[Proxy] ════════════════════════════════════════════════════════════════════');
      } else {
        console.error('[Proxy] Request URL:', url.toString());
        console.error('[Proxy] Request body:', JSON.stringify(requestBody, null, 2));
        console.error('[Proxy] Response data (full):', JSON.stringify(response.data, null, 2));
        if (response.status === 500) {
          console.error('[Proxy] 500 = ByteCrtrs server error. Check: API availability, request format, captcha/session.');
        }
      }
      console.error('='.repeat(80));
    }
    
    // Forward the response
    res.status(response.status);
    
    // Forward response headers (except those that shouldn't be forwarded)
    Object.keys(response.headers).forEach(key => {
      const lowerKey = key.toLowerCase();
      if (!['content-encoding', 'content-length', 'transfer-encoding', 'connection', 'host'].includes(lowerKey)) {
        res.setHeader(key, response.headers[key]);
      }
    });
    
    // CRITICAL: Store and forward Set-Cookie headers from the API response
    // The captcha verification sets cookies that must be sent with subsequent requests
    // Since cookies can't be shared across origins (localhost:3000 vs localhost:3001),
    // we store them server-side and automatically include them in requests
    //
    // IMPORTANT: Skip storing cookies from auth failures (401/403).
    // A failed login still returns a connect.sid for an anonymous session.
    // If we store it, it overwrites the real authenticated session cookie and
    // poisons all subsequent BC requests with a 403 Forbidden.
    const isAuthFailure = response.status === 401 || response.status === 403;
    if (response.headers['set-cookie'] && !isAuthFailure) {
      const cookies = Array.isArray(response.headers['set-cookie']) 
        ? response.headers['set-cookie'] 
        : [response.headers['set-cookie']];
      
      // Get stable session key (based on origin, not clientId/apiId which change)
      const sessionKey = getSessionKey(req);
      
      // Store cookies server-side for this session.
      // For login, always start fresh — clear any stale session cookies so subsequent
      // requests only carry the newly authenticated session, not old ones.
      const isLoginPath = proxyPath === '/auth/login';
      const existingCookies = isLoginPath ? [] : (apiCookies.get(sessionKey) || []);
      const allCookies = [...existingCookies];
      
      // Add new cookies, avoiding duplicates
      cookies.forEach(newCookie => {
        const newCookieName = newCookie.match(/^([^=]+)=/)?.[1];
        if (newCookieName) {
          // Remove old cookie with same name
          const filtered = allCookies.filter(c => {
            const oldCookieName = c.match(/^([^=]+)=/)?.[1];
            return oldCookieName !== newCookieName;
          });
          allCookies.length = 0;
          allCookies.push(...filtered, newCookie);
        } else {
          allCookies.push(newCookie);
        }
      });
      
      apiCookies.set(sessionKey, allCookies);
      console.log(`[Proxy] Stored ${cookies.length} new cookie(s) server-side for session: ${sessionKey} (${allCookies.length} total)`);
      console.log(`[Proxy] Cookie names: ${allCookies.map(c => {
        const match = c.match(/^([^=]+)=/);
        return match ? match[1] : 'unknown';
      }).join(', ')}`);
      
      // Also try to forward to browser (though it may not work due to cross-origin)
      // Get the browser's origin
      const browserOrigin = req.headers.origin || 'http://localhost:3000';
      const isLocalhost = browserOrigin.includes('localhost');
      
      cookies.forEach(cookie => {
        // Modify cookie to work with browser's origin (localhost:3000)
        let modifiedCookie = cookie;
        
        // Remove domain restrictions
        modifiedCookie = modifiedCookie.replace(/;\s*Domain=[^;]+/gi, '');
        
        // Remove Secure flag (allows cookie to work with http://localhost)
        modifiedCookie = modifiedCookie.replace(/;\s*Secure/gi, '');
        
        // Ensure Path is set to /
        if (!modifiedCookie.match(/;\s*Path=/i)) {
          modifiedCookie += '; Path=/';
        }
        
        // Remove existing SameSite attribute
        modifiedCookie = modifiedCookie.replace(/;\s*SameSite=[^;]+/gi, '');
        
        // For localhost cross-origin, try SameSite=None (some browsers allow without Secure)
        if (isLocalhost) {
          modifiedCookie += '; SameSite=None';
        } else {
          modifiedCookie += '; SameSite=Lax';
        }
        
        res.appendHeader('Set-Cookie', modifiedCookie);
        console.log(`[Proxy] Also forwarding Set-Cookie to browser: ${modifiedCookie.substring(0, 150)}...`);
      });
    }
    
    // Set CORS headers to allow the frontend to receive the response
    const origin = req.headers.origin;
    if (origin && (origin.includes('localhost:3000') || origin.includes('localhost:3001') || origin.includes('localhost:3003') || origin.includes('localhost:3010'))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', [
      'Content-Type',
      'Authorization',
      'Cookie',
      'X-Captcha-Pass',
      'x-captcha-id',
      'X-Captcha-Id',
      'x-captcha-token',
      'X-Captcha-Token',
      'x-requested-with',
      'X-Requested-With'
    ].join(', '));
    res.setHeader('Access-Control-Allow-Credentials', 'true'); // Allow cookies to be sent
    res.setHeader('Access-Control-Expose-Headers', 'Set-Cookie');
    
    res.send(response.data);
  } catch (error) {
    console.error('[Proxy] Error:', error.message);
    if (error.response) {
      console.error('[Proxy] Response status:', error.response.status);
      console.error('[Proxy] Response headers:', JSON.stringify(error.response.headers, null, 2));
      console.error('[Proxy] Response data:', JSON.stringify(error.response.data).substring(0, 500));
      
      // If we get a 412, log more details about what might be wrong
      if (error.response.status === 412) {
        console.error('[Proxy] 412 Precondition Failed - API security check failed');
        console.error('[Proxy] Request URL:', url.toString());
        console.error('[Proxy] Request method:', req.method);
        console.error('[Proxy] Request headers sent:', JSON.stringify(headers, null, 2));
        console.error('[Proxy] Request body:', JSON.stringify(req.body).substring(0, 200));
        console.error('[Proxy] Response data:', JSON.stringify(error.response.data));
        console.error('[Proxy] Possible causes:');
        console.error('  - Missing security headers (check what the JS library sets)');
        console.error('  - Missing cookies/session tokens');
        console.error('  - Origin/Referer header mismatch');
        console.error('  - Missing captcha verification token');
        console.error('  - API expects request from specific domain');
      }
    }
    res.status(error.response?.status || 500).json({
      error: {
        code: 'PROXY_ERROR',
        message: error.message || 'Proxy request failed',
        details: error.response?.data || []
      }
    });
  }
});

// Note: The generic /api/proxy/* endpoint above handles all proxy requests
// including /api/proxy/idLookup/teaser/search, so we don't need a specific endpoint

// Helper functions
const generateTokens = (user) => {
  try {
    if (!user || !user.id || !user.email || !user.role) {
      throw new Error('Invalid user object for token generation');
    }
    const accessToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '30m' }
    );
    const refreshToken = jwt.sign(
      { userId: user.id },
      JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );
    dataStore.refreshTokens.set(refreshToken, user.id);
    return { accessToken, refreshToken };
  } catch (error) {
    console.error('Error generating tokens:', error);
    throw error;
  }
};

// ==================== AUTHENTICATION ENDPOINTS ====================

// POST /api/v1/signup
app.post('/api/v1/signup', (req, res) => {
  const { fullName, zip, email, password, socialProvider, optin } = req.body;

  // Validation
  if (!fullName || !email || !password) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'fullName, email, and password are required',
        details: []
      }
    });
  }

  // Check if email exists
  if (dataStore.users.find(u => u.email === email)) {
    return res.status(409).json({
      error: {
        code: 'EMAIL_EXISTS',
        message: 'Email already registered',
        details: []
      }
    });
  }

  // Create user (optin: marketing emails for unpaid prospects)
  const newUser = {
    id: `user-${Date.now()}`,
    email,
    fullName,
    zip: zip || '',
    password, // In production, hash this
    optin: optin !== false,
    emailVerified: true, // Auto-verified: no email infra in mock server
    role: 'member',
    createdAt: new Date().toISOString()
  };

  dataStore.users.push(newUser);
  // Send welcome email (fire-and-forget)
  emailService.sendWelcome(newUser).catch(() => {});
  const { accessToken, refreshToken } = generateTokens(newUser);

  res.status(201).json({
    user: {
      id: newUser.id,
      email: newUser.email,
      fullName: newUser.fullName,
      optin: newUser.optin,
      emailVerified: true,
      role: newUser.role
    },
    accessToken,
    refreshToken,
    message: 'Account created successfully'
  });
});

// GET /api/v1/verify-email
app.get('/api/v1/verify-email', (req, res) => {
  const { token } = req.query;
  
  // Simple verification (in production, use proper token validation)
  const user = dataStore.users.find(u => u.email === token || u.id === token);
  if (!user) {
    return res.status(404).json({
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired verification token',
        details: []
      }
    });
  }

  user.emailVerified = true;
  res.json({
    message: 'Email verified successfully',
    user: {
      id: user.id,
      emailVerified: true
    }
  });
});

// POST /api/v1/login
app.post('/api/v1/login', (req, res) => {
  try {
    console.log('Login attempt:', { email: req.body.email });
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Email and password are required',
          details: []
        }
      });
    }

    console.log('Looking for user with email:', email);
    console.log('Total users in dataStore:', dataStore.users.length);
    const user = dataStore.users.find(u => u.email === email && u.password === password);
    
    if (!user) {
      console.log('User not found or password mismatch');
      return res.status(401).json({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
          details: []
        }
      });
    }

    console.log('User found:', user.email, 'Verified:', user.emailVerified);

    if (!user.emailVerified) {
      return res.status(403).json({
        error: {
          code: 'EMAIL_NOT_VERIFIED',
          message: 'Please verify your email before logging in',
          details: []
        }
      });
    }

    console.log('Generating tokens for user:', user.id);
    const { accessToken, refreshToken } = generateTokens(user);
    console.log('Tokens generated successfully');

    // Create session
    const session = {
      id: `session-${Date.now()}`,
      userId: user.id,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent') || 'unknown',
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      active: true
    };
    dataStore.sessions.push(session);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        emailVerified: user.emailVerified
      },
      accessToken,
      refreshToken
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred during login',
        details: []
      }
    });
  }
});

// POST /api/v1/refresh-token
app.post('/api/v1/refresh-token', (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'refreshToken is required',
        details: []
      }
    });
  }

  try {
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
    const userId = dataStore.refreshTokens.get(refreshToken);
    
    if (!userId || userId !== decoded.userId) {
      return res.status(401).json({
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid or expired refresh token',
          details: []
        }
      });
    }

    const user = dataStore.users.find(u => u.id === userId);
    if (!user) {
      return res.status(401).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
          details: []
        }
      });
    }

    const accessToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '30m' }
    );

    res.json({ accessToken });
  } catch (error) {
    res.status(401).json({
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired refresh token',
        details: []
      }
    });
  }
});

// POST /api/v1/logout
app.post('/api/v1/logout', authenticateToken, (req, res) => {
  const refreshToken = req.body.refreshToken;
  if (refreshToken) {
    dataStore.refreshTokens.delete(refreshToken);
  }
  res.status(204).send();
});

// ==================== PUBLIC SEARCH ENDPOINTS ====================

// GET /api/v1/search/by-address — search people by city, state, and/or ZIP
app.get('/api/v1/search/by-address', (req, res) => {
  const { city, state, zip, page = 1, limit = 20 } = req.query;

  if (!city && !state && !zip) {
    return res.status(400).json({
      error: { code: 'VALIDATION_FAILED', message: 'Provide at least one of: city, state, or zip', details: [] }
    });
  }

  const cityFilter = city && city.trim() ? city.trim().toLowerCase() : null;
  const stateFilter = state && state.trim() ? state.trim().toUpperCase() : null;
  const zipFilter = zip && zip.trim() ? zip.trim() : null;

  let results = dataStore.people.filter(p => {
    if (!p.addresses || p.addresses.length === 0) return false;
    return p.addresses.some(a => {
      const cityMatch = !cityFilter || (a.city || '').toLowerCase().includes(cityFilter);
      const stateMatch = !stateFilter || a.state === stateFilter;
      const zipMatch = !zipFilter || a.zip === zipFilter;
      return cityMatch && stateMatch && zipMatch;
    });
  });

  const pageNum = parseInt(page);
  const limitNum = Math.min(parseInt(limit), 100);
  const start = (pageNum - 1) * limitNum;
  const end = start + limitNum;
  const paginatedResults = results.slice(start, end);

  res.json({
    data: paginatedResults.map(p => ({
      id: p.id,
      fullName: p.fullName,
      ageRange: p.ageRange,
      location: p.location
    })),
    pagination: { limit: limitNum, page: pageNum, hasMore: end < results.length }
  });
});

// GET /api/v1/search
// Dev-only: fabricate a realistic, RICH result set for any name search, so the
// sales funnel (SERP → SUP → Payment) can be reviewed locally with close-to-real
// data. Deterministic per name (same search → same people). Mirrors the BC teaser-
// adapted shape the SUP/Payment consume (records/flags/relatives/onRecordSince).
function mockSearchResults(firstName, lastName, stateFilter, cityFilter) {
  const STATE_CITIES = {
    AL: ['Birmingham', 'Montgomery', 'Mobile'], AK: ['Anchorage', 'Juneau', 'Fairbanks'], AZ: ['Phoenix', 'Tucson', 'Mesa'], AR: ['Little Rock', 'Fayetteville', 'Fort Smith'],
    CA: ['Los Angeles', 'San Diego', 'San Jose', 'Sacramento', 'Fresno'], CO: ['Denver', 'Colorado Springs', 'Aurora', 'Boulder'], CT: ['Bridgeport', 'Hartford', 'New Haven'],
    DE: ['Wilmington', 'Dover', 'Newark'], FL: ['Miami', 'Orlando', 'Tampa', 'Jacksonville'], GA: ['Atlanta', 'Augusta', 'Savannah', 'Macon'], HI: ['Honolulu', 'Hilo', 'Kailua'],
    ID: ['Boise', 'Nampa', 'Meridian'], IL: ['Chicago', 'Aurora', 'Springfield', 'Peoria'], IN: ['Indianapolis', 'Fort Wayne', 'Evansville'], IA: ['Des Moines', 'Cedar Rapids', 'Davenport'],
    KS: ['Wichita', 'Overland Park', 'Topeka'], KY: ['Louisville', 'Lexington', 'Bowling Green'], LA: ['New Orleans', 'Baton Rouge', 'Shreveport'], ME: ['Portland', 'Lewiston', 'Bangor'],
    MD: ['Baltimore', 'Rockville', 'Annapolis'], MA: ['Boston', 'Worcester', 'Springfield'], MI: ['Detroit', 'Grand Rapids', 'Ann Arbor'], MN: ['Minneapolis', 'Saint Paul', 'Rochester'],
    MS: ['Jackson', 'Gulfport', 'Biloxi'], MO: ['Kansas City', 'St. Louis', 'Springfield'], MT: ['Billings', 'Missoula', 'Bozeman'], NE: ['Omaha', 'Lincoln', 'Bellevue'],
    NV: ['Las Vegas', 'Reno', 'Henderson'], NH: ['Manchester', 'Nashua', 'Concord'], NJ: ['Newark', 'Jersey City', 'Trenton'], NM: ['Albuquerque', 'Santa Fe', 'Las Cruces'],
    NY: ['New York', 'Buffalo', 'Rochester', 'Albany'], NC: ['Charlotte', 'Raleigh', 'Greensboro', 'Durham'], ND: ['Fargo', 'Bismarck', 'Grand Forks'], OH: ['Columbus', 'Cleveland', 'Cincinnati'],
    OK: ['Oklahoma City', 'Tulsa', 'Norman'], OR: ['Portland', 'Salem', 'Eugene'], PA: ['Philadelphia', 'Pittsburgh', 'Allentown'], RI: ['Providence', 'Warwick', 'Cranston'],
    SC: ['Columbia', 'Charleston', 'Greenville'], SD: ['Sioux Falls', 'Rapid City', 'Pierre'], TN: ['Nashville', 'Memphis', 'Knoxville'], TX: ['Houston', 'Dallas', 'Austin', 'San Antonio'],
    UT: ['Salt Lake City', 'Provo', 'Ogden'], VT: ['Burlington', 'Montpelier', 'Rutland'], VA: ['Virginia Beach', 'Richmond', 'Norfolk'], WA: ['Seattle', 'Spokane', 'Tacoma'],
    WV: ['Charleston', 'Huntington', 'Morgantown'], WI: ['Milwaukee', 'Madison', 'Green Bay'], WY: ['Cheyenne', 'Casper', 'Laramie'], DC: ['Washington'],
  };
  const STATES = Object.keys(STATE_CITIES);
  const FALLBACK_CITIES = ['Springfield', 'Franklin', 'Clinton', 'Salem', 'Madison', 'Georgetown'];
  const MIDDLES = ['A', 'J', 'M', 'R', 'L', 'D', 'E', 'T', 'W', 'C'];
  const REL_FIRST = ['Sarah', 'Michael', 'Linda', 'James', 'Patricia', 'Robert', 'Mary', 'David', 'Angela', 'Thomas'];
  const REL_LAST = [lastName, 'Johnson', 'Brown', 'Davis', 'Miller', 'Wilson', 'Garcia'];
  let seed = 0;
  for (const c of `${firstName}${lastName}`.toLowerCase()) seed = (seed * 31 + c.charCodeAt(0)) >>> 0;
  const rnd = (i, mod) => ((seed + (i + 1) * 2654435761) >>> 0) % mod;
  const count = 5 + (seed % 4); // 5–8 matches
  const out = [];
  for (let i = 0; i < count; i++) {
    const state = stateFilter || STATES[rnd(i * 7, STATES.length)];
    const cityPool = STATE_CITIES[state] || FALLBACK_CITIES;
    const dcity = cityPool[rnd(i * 5 + 1, cityPool.length)];
    const city = (cityFilter && i < 2) ? cityFilter.replace(/\b\w/g, (m) => m.toUpperCase()) : dcity;
    const age = 22 + rnd(i * 3 + 1, 55);
    const hasMiddle = rnd(i, 3) > 0;
    const middle = hasMiddle ? MIDDLES[rnd(i + 1, MIDDLES.length)] : '';
    const fullName = [firstName, middle, lastName].filter(Boolean).join(' ');
    const phoneCount = 1 + rnd(i + 2, 4);
    const emailCount = rnd(i + 4, 3);
    const addrCount = 1 + rnd(i + 1, 4);
    const relCount = rnd(i + 5, 4);
    const isCriminal = rnd(i * 2 + 1, 4) === 0;
    const criminalCount = isCriminal ? 1 + rnd(i, 3) : 0;
    const isProp = rnd(i + 3, 3) === 0;
    const propCount = isProp ? 1 + rnd(i, 2) : 0;
    const relatives = [];
    for (let r = 0; r < Math.min(relCount, 3); r++) {
      relatives.push({ name: `${REL_FIRST[rnd(i * 3 + r, REL_FIRST.length)]} ${REL_LAST[rnd(i + r + 1, REL_LAST.length)]}` });
    }
    const ageBase = Math.floor(age / 5) * 5;
    out.push({
      id: `mock-${firstName}-${lastName}-${i}`.toLowerCase().replace(/[^a-z0-9-]/g, ''),
      extId: `mockext-${firstName}${lastName}${i}`.replace(/[^A-Za-z0-9]/g, ''),
      firstName, lastName, middleName: middle,
      fullName,
      aliases: hasMiddle ? [`${firstName} ${lastName}`] : [],
      age, ageRange: `${ageBase}-${ageBase + 4}`,
      city, state, location: `${city}, ${state}`,
      address: '••••• ••••••',
      phone: '(•••) •••-••••', phones: phoneCount,
      records: {
        address: addrCount, phone: phoneCount, residentialPhone: phoneCount, mobilePhone: 0,
        email: emailCount, criminal: criminalCount, property: propCount, relatives: relCount,
        employment: rnd(i, 3) === 0 ? 1 + rnd(i, 2) : 0, professionalLicense: rnd(i + 2, 4) === 0 ? 1 : 0,
        bankruptcy: 0, lien: rnd(i + 1, 8) === 0 ? 1 : 0, judgment: rnd(i, 6) === 0 ? 1 : 0,
        foreclosure: 0, business: rnd(i + 1, 5) === 0 ? 1 : 0,
      },
      flags: {
        isCriminal, isPropertyOwner: isProp, hasEmployment: rnd(i, 3) === 0,
        hasProfessionalLicense: rnd(i + 2, 4) === 0, hasVehicle: rnd(i, 2) === 0,
      },
      relatives,
      onRecordSince: 1998 + rnd(i * 2, 26),
      provider: 'mock',
    });
  }
  return out;
}

app.get('/api/v1/search', (req, res) => {
  let { firstName, lastName, name, state, city, page = 1, limit = 20 } = req.query;

  // Support both formats: firstName/lastName or single "name" parameter
  if (name && !firstName && !lastName) {
    const nameParts = name.trim().split(/\s+/);
    firstName = nameParts[0] || '';
    lastName = nameParts.slice(1).join(' ') || '';
  }

  if (!firstName || !lastName) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'firstName and lastName (or name) are required',
        details: []
      }
    });
  }

  const stateFilter = state && state.trim() ? state.trim().toUpperCase() : null;
  const cityFilter = city && city.trim() ? city.trim() : null;

  const results = mockSearchResults(firstName.trim(), lastName.trim(), stateFilter, cityFilter);
  const pageNum = parseInt(page);
  const limitNum = Math.min(parseInt(limit), 100);
  const start = (pageNum - 1) * limitNum;
  const end = start + limitNum;

  res.json({
    data: results.slice(start, end),
    pagination: {
      limit: limitNum,
      page: pageNum,
      hasMore: end < results.length
    }
  });
});

// ==================== MEMBER ENDPOINTS ====================

// GET /api/v1/me
app.get('/api/v1/me', authenticateToken, (req, res) => {
  const user = dataStore.users.find(u => u.id === req.user.userId);
  if (!user) {
    return res.status(404).json({
      error: {
        code: 'USER_NOT_FOUND',
        message: 'User not found',
        details: []
      }
    });
  }

  const subscription = dataStore.subscriptions.find(s => s.userId === user.id);

  res.json({
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    zip: user.zip,
    phone: user.phone || '',
    emailVerified: user.emailVerified,
    role: user.role,
    subscription: subscription ? {
      plan: subscription.plan,
      status: subscription.status,
      renewalDate: subscription.renewalDate
    } : null
  });
});

// PUT /api/v1/me
app.put('/api/v1/me', authenticateToken, (req, res) => {
  const user = dataStore.users.find(u => u.id === req.user.userId);
  if (!user) {
    return res.status(404).json({
      error: {
        code: 'USER_NOT_FOUND',
        message: 'User not found',
        details: []
      }
    });
  }

  const { fullName, zip, email } = req.body;
  if (fullName) user.fullName = fullName;
  if (zip) user.zip = zip;
  if (email) user.email = email;

  res.json({
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    zip: user.zip
  });
});

// GET /api/v1/people/:id
app.get('/api/v1/people/:id', authenticateToken, (req, res) => {
  const person = dataStore.people.find(p => p.id === req.params.id);
  if (!person) {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Person not found',
        details: []
      }
    });
  }

  res.json(person);
});

// GET /api/v1/dashboard
app.get('/api/v1/dashboard', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const searchesThisMonth = dataStore.searches.filter(s => 
    s.userId === userId && new Date(s.timestamp) >= startOfMonth
  ).length;

  const activeAlerts = dataStore.alerts.filter(a => 
    a.userId === userId && a.status === 'active'
  ).length;

  const recentSearches = dataStore.searches
    .filter(s => s.userId === userId)
    .slice(-5)
    .map(s => ({
      id: s.id,
      query: s.query,
      timestamp: s.timestamp
    }));

  const profileViewsThisMonth = dataStore.profileViews.filter(v =>
    v.viewerUserId === userId && new Date(v.timestamp) >= startOfMonth
  ).length;

  const subscription = dataStore.subscriptions.find(s => s.userId === userId);

  res.json({
    searchesThisMonth,
    activeAlerts,
    recentSearches,
    profileViewsThisMonth,
    subscription: subscription ? {
      plan: subscription.plan,
      status: subscription.status,
      renewalDate: subscription.renewalDate
    } : null
  });
});

// POST /api/v1/searches (record search history)
app.post('/api/v1/searches', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const { type, query, resultCount = 0, source = 'member' } = req.body || {};

  if (!type || !query) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'type and query are required',
        details: []
      }
    });
  }

  const user = dataStore.users.find(u => u.id === userId);
  const searchRecord = {
    id: `search-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
    userId,
    type,
    query,
    resultCount,
    source,
    searcherId: user?.id || userId,
    searcherMembershipLevel: user?.membershipLevel || user?.plan || 'member',
    timestamp: new Date().toISOString()
  };

  dataStore.searches.unshift(searchRecord);

  res.status(201).json({
    data: searchRecord
  });
});

// POST /api/v1/searches/import — bulk replay of visitor search log on signup.
// Mirrors POST /api/v1/searches per item but accepts an array. Skips invalid
// rows silently so a single bad entry doesn't blow up the whole import.
app.post('/api/v1/searches/import', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const { items } = req.body || {};

  if (!Array.isArray(items)) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'items array is required', details: [] }
    });
  }

  const user = dataStore.users.find(u => u.id === userId);
  const imported = [];

  for (const item of items) {
    if (!item || !item.type || !item.query) continue;
    const record = {
      id: `search-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      userId,
      type: item.type,
      query: item.query,
      resultCount: item.resultCount || 0,
      source: 'visitor-import',
      searcherId: user?.id || userId,
      searcherMembershipLevel: user?.membershipLevel || user?.plan || 'member',
      timestamp: item.ts || new Date().toISOString(),
    };
    dataStore.searches.unshift(record);
    imported.push(record);
  }

  res.status(201).json({ data: imported, importedCount: imported.length });
});

// GET /api/v1/searches/me
app.get('/api/v1/searches/me', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const { limit = 20, cursor, filter } = req.query;

  let searches = dataStore.searches.filter(s => s.userId === userId);

  // Apply time filter
  if (filter) {
    const now = new Date();
    let cutoffDate;
    switch (filter) {
      case '24h':
        cutoffDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        cutoffDate = null;
    }
    if (cutoffDate) {
      searches = searches.filter(s => new Date(s.timestamp) >= cutoffDate);
    }
  }

  const limitNum = Math.min(parseInt(limit), 100);
  const results = searches.slice(0, limitNum);

  res.json({
    data: results.map(s => ({
      id: s.id,
      timestamp: s.timestamp,
      type: s.type,
      resultCount: s.resultCount || 0,
      searcherLocation: s.searcherLocation,
      searcherId: s.searcherId,
      searcherMembershipLevel: s.searcherMembershipLevel,
      query: s.query
    })),
    pagination: {
      limit: limitNum,
      cursor: results.length === limitNum ? `cursor-${results.length}` : null,
      hasMore: searches.length > limitNum
    }
  });
});

// GET /api/v1/searches/lookups-of-me
// Returns searches where the current user was the TARGET (someone searched for them)
app.get('/api/v1/searches/lookups-of-me', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const { limit = 20 } = req.query;
  const limitNum = Math.min(parseInt(limit), 100);

  const results = dataStore.searches
    .filter(s => s.targetUserId === userId)
    .slice(0, limitNum)
    .map(s => ({
      id: s.id,
      timestamp: s.timestamp,
      searcherLocation: s.searcherLocation || 'Unknown location',
      searcherMembershipLevel: s.searcherMembershipLevel || 'member',
      searcherId: 'anonymous'
    }));

  res.json({ data: results, total: results.length });
});

// DELETE /api/v1/searches/:id
app.delete('/api/v1/searches/:id', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const index = dataStore.searches.findIndex(
    s => s.id === req.params.id && s.userId === userId
  );
  if (index === -1) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Search record not found', details: [] }
    });
  }
  dataStore.searches.splice(index, 1);
  res.status(204).send();
});

// POST /api/v1/profile-views (record profile view)
app.post('/api/v1/profile-views', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const { targetId, targetType = 'person', source = 'member' } = req.body || {};

  if (!targetId) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'targetId is required',
        details: []
      }
    });
  }

  const viewRecord = {
    id: `view-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
    viewerUserId: userId,
    targetId,
    targetType,
    source,
    timestamp: new Date().toISOString()
  };

  dataStore.profileViews.unshift(viewRecord);

  res.status(201).json({
    data: viewRecord
  });
});

// GET /api/v1/profile-views/me
app.get('/api/v1/profile-views/me', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const { limit = 20 } = req.query;

  const views = dataStore.profileViews.filter(v => v.viewerUserId === userId);
  const limitNum = Math.min(parseInt(limit), 100);
  const results = views.slice(0, limitNum);

  res.json({
    data: results,
    total: views.length
  });
});

// GET /api/v1/alerts
app.get('/api/v1/alerts', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const alerts = dataStore.alerts.filter(a => a.userId === userId);

  res.json({
    data: alerts
  });
});

// POST /api/v1/alerts
app.post('/api/v1/alerts', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const { criteria, frequency, channels } = req.body;

  const newAlert = {
    id: `alert-${Date.now()}`,
    userId,
    criteria,
    frequency: frequency || 'daily',
    channels: channels || ['email'],
    status: 'active',
    createdAt: new Date().toISOString(),
    lastTriggered: null
  };

  dataStore.alerts.push(newAlert);
  res.status(201).json(newAlert);
});

// PUT /api/v1/alerts/:id
app.put('/api/v1/alerts/:id', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const alert = dataStore.alerts.find(a => a.id === req.params.id && a.userId === userId);

  if (!alert) {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Alert not found',
        details: []
      }
    });
  }

  const { criteria, frequency, channels, status } = req.body;
  if (criteria) alert.criteria = { ...alert.criteria, ...criteria };
  if (frequency) alert.frequency = frequency;
  if (channels) alert.channels = channels;
  if (status !== undefined) alert.status = status;

  res.json(alert);
});

// DELETE /api/v1/alerts/:id
app.delete('/api/v1/alerts/:id', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const index = dataStore.alerts.findIndex(a => a.id === req.params.id && a.userId === userId);

  if (index === -1) {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Alert not found',
        details: []
      }
    });
  }

  dataStore.alerts.splice(index, 1);
  res.status(204).send();
});

// GET /api/v1/subscription
app.get('/api/v1/subscription', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const subscription = dataStore.subscriptions.find(s => s.userId === userId);

  if (!subscription) {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'No subscription found',
        details: []
      }
    });
  }

  res.json({
    plan: subscription.plan,
    status: subscription.status,
    renewalDate: subscription.renewalDate,
    paymentMethod: subscription.paymentMethod,
    billingAddress: subscription.billingAddress
  });
});

// PUT /api/v1/subscription (proxy: supports simulate=success|failure for testing)
app.put('/api/v1/subscription', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const { plan, paymentToken, simulate } = req.body;

  // Proxy: simulate failed payment for testing next-page (error) experience
  if (simulate === 'failure' || simulate === 'decline') {
    return res.status(402).json({
      error: {
        code: 'PAYMENT_DECLINED',
        message: 'Your card was declined. Please try a different payment method.',
        details: []
      }
    });
  }
  if (simulate === 'insufficient_funds') {
    return res.status(402).json({
      error: {
        code: 'INSUFFICIENT_FUNDS',
        message: 'Insufficient funds. Please use another card.',
        details: []
      }
    });
  }
  if (simulate === 'expired_card') {
    return res.status(400).json({
      error: {
        code: 'EXPIRED_CARD',
        message: 'Your card has expired. Please use a different card.',
        details: []
      }
    });
  }

  let subscription = dataStore.subscriptions.find(s => s.userId === userId);

  if (!subscription) {
    subscription = {
      id: `sub-${Date.now()}`,
      userId,
      plan: plan || 'basic',
      status: 'active',
      renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      paymentMethod: { type: 'card', last4: '1234', brand: 'visa' },
      billingAddress: null
    };
    dataStore.subscriptions.push(subscription);
  } else {
    if (plan) subscription.plan = plan;
    if (paymentToken) {
      subscription.paymentMethod = { type: 'card', last4: '1234', brand: 'visa' };
    }
  }

  // Send payment confirmation email (fire-and-forget)
  const subUser = dataStore.users.find(u => u.id === userId);
  if (subUser && subscription.status === 'active') {
    emailService.sendPaymentConfirmation(subUser, subscription.plan).catch(() => {});
  }

  res.json({
    plan: subscription.plan,
    status: subscription.status,
    renewalDate: subscription.renewalDate
  });
});

// GET /api/v1/reports (report list)
app.get('/api/v1/reports', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const { lastId } = req.query;
  
  // Get all reports for this user (in a real app, these would be stored per user)
  // For now, return empty array or mock data
  const reports = [];
  
  // If we had report storage, we'd filter by userId and paginate
  // For now, return empty array with pagination info
  res.json({
    data: reports,
    pagination: {
      hasMore: false,
      lastId: null
    }
  });
});

// GET /api/v1/reports/:id (report detail)
app.get('/api/v1/reports/:id', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const { id } = req.params;
  
  // In a real app, fetch report by id and userId
  // For now, return 404
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'Report not found',
      details: []
    }
  });
});

// POST /api/v1/reports (create report)
app.post('/api/v1/reports', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const { type, extId, phone, searchContextKey, teaserInput } = req.body;
  
  // In a real app, create a report and store it
  // For now, return a mock report
  const mockReport = {
    _id: `report-${Date.now()}`,
    userId,
    type,
    extId: extId || null,
    phone: phone || null,
    createdAt: new Date().toISOString(),
    data: {
      teaserInput
    }
  };
  
  res.status(201).json({
    commerceContents: [{
      _id: mockReport._id
    }],
    data: mockReport
  });
});

// DELETE /api/v1/subscription
app.delete('/api/v1/subscription', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const subscription = dataStore.subscriptions.find(s => s.userId === userId);

  if (!subscription) {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'No subscription found',
        details: []
      }
    });
  }

  subscription.status = 'cancelled';
  res.json({
    message: 'Subscription cancelled',
    effectiveDate: subscription.renewalDate
  });
});

// GET /api/v1/invoices
app.get('/api/v1/invoices', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const invoices = dataStore.invoices.filter(i => i.userId === userId);

  res.json({
    data: invoices.map(i => ({
      id: i.id,
      amount: i.amount,
      currency: i.currency,
      status: i.status,
      date: i.date,
      downloadUrl: `/api/v1/invoices/${i.id}/download`
    })),
    pagination: {
      limit: 20,
      hasMore: false
    }
  });
});

// GET /api/v1/notifications
app.get('/api/v1/notifications', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const { unreadOnly } = req.query;
  let notifications = dataStore.notifications.filter(n => n.userId === userId);

  if (unreadOnly === 'true') {
    notifications = notifications.filter(n => !n.read);
  }

  res.json({
    data: notifications
  });
});

// GET /api/v1/notifications/preferences
app.get('/api/v1/notifications/preferences', authenticateToken, (req, res) => {
  const user = dataStore.users.find(u => u.id === req.user.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const prefs = user.notificationPreferences || {
    emailAlerts: true,
    weeklyDigest: false,
    marketingEmails: false
  };
  res.json({ preferences: prefs });
});

// POST /api/v1/notifications (save notification preferences)
app.post('/api/v1/notifications', authenticateToken, (req, res) => {
  const userId = req.user.userId || req.user.id;
  const { emailAlerts, weeklyDigest, marketingEmails } = req.body;
  const user = dataStore.users.find(u => u.id === userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  user.notificationPreferences = { emailAlerts, weeklyDigest, marketingEmails };
  res.json({ success: true, preferences: user.notificationPreferences });
});

// PUT /api/v1/notifications/:id/read
app.put('/api/v1/notifications/:id/read', authenticateToken, (req, res) => {
  const notification = dataStore.notifications.find(n => 
    n.id === req.params.id && n.userId === req.user.userId
  );

  if (!notification) {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Notification not found',
        details: []
      }
    });
  }

  notification.read = true;
  res.json({
    id: notification.id,
    read: true
  });
});

// DELETE /api/v1/notifications/:id
app.delete('/api/v1/notifications/:id', authenticateToken, (req, res) => {
  const index = dataStore.notifications.findIndex(n => 
    n.id === req.params.id && n.userId === req.user.userId
  );

  if (index === -1) {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Notification not found',
        details: []
      }
    });
  }

  dataStore.notifications.splice(index, 1);
  res.status(204).send();
});

// PUT /api/v1/privacy
app.put('/api/v1/privacy', authenticateToken, (req, res) => {
  const user = dataStore.users.find(u => u.id === req.user.userId);
  if (!user) {
    return res.status(404).json({
      error: {
        code: 'USER_NOT_FOUND',
        message: 'User not found',
        details: []
      }
    });
  }

  const { searchable } = req.body;
  user.searchable = searchable !== undefined ? searchable : true;

  res.json({
    searchable: user.searchable
  });
});

// POST /api/v1/auth/change-password
app.post('/api/v1/auth/change-password', authenticateToken, (req, res) => {
  const user = dataStore.users.find(u => u.id === req.user.userId);
  const { currentPassword, newPassword } = req.body;

  if (!user || user.password !== currentPassword) {
    return res.status(401).json({
      error: {
        code: 'INVALID_PASSWORD',
        message: 'Current password is incorrect',
        details: []
      }
    });
  }

  user.password = newPassword;
  res.json({
    message: 'Password changed successfully'
  });
});

// POST /api/v1/auth/mfa/enable
app.post('/api/v1/auth/mfa/enable', authenticateToken, (req, res) => {
  res.json({
    message: 'MFA enabled',
    qrCode: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
  });
});

// POST /api/v1/auth/mfa/disable
app.post('/api/v1/auth/mfa/disable', authenticateToken, (req, res) => {
  res.json({
    message: 'MFA disabled'
  });
});

// ==================== ADMIN ENDPOINTS ====================

// GET /api/v1/admin/users
app.get('/api/v1/admin/users', authenticateToken, requireRole('admin'), (req, res) => {
  const { limit = 20, cursor, search, role, status } = req.query;
  let users = [...dataStore.users];

  if (search) {
    const searchLower = search.toLowerCase();
    users = users.filter(u => 
      u.email.toLowerCase().includes(searchLower) ||
      u.fullName.toLowerCase().includes(searchLower)
    );
  }

  if (role) {
    users = users.filter(u => u.role === role);
  }

  if (status) {
    users = users.filter(u => (u.status || 'active') === status);
  }

  const limitNum = Math.min(parseInt(limit), 100);
  const results = users.slice(0, limitNum);

  res.json({
    data: results.map(u => ({
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      role: u.role,
      status: u.status || 'active',
      createdAt: u.createdAt,
      lastLogin: u.lastLogin || null
    })),
    pagination: {
      limit: limitNum,
      cursor: results.length === limitNum ? `cursor-${results.length}` : null,
      hasMore: users.length > limitNum
    }
  });
});

// GET /api/v1/admin/users/:id
app.get('/api/v1/admin/users/:id', authenticateToken, requireRole('admin'), (req, res) => {
  const user = dataStore.users.find(u => u.id === req.params.id);
  if (!user) {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'User not found',
        details: []
      }
    });
  }

  const subscription = dataStore.subscriptions.find(s => s.userId === user.id);
  const searchHistory = dataStore.searches.filter(s => s.userId === user.id);
  const alerts = dataStore.alerts.filter(a => a.userId === user.id);
  const sessions = dataStore.sessions.filter(s => s.userId === user.id);

  res.json({
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    status: user.status || 'active',
    profile: {
      zip: user.zip,
      phone: user.phone || ''
    },
    subscription: subscription ? {
      plan: subscription.plan,
      status: subscription.status
    } : null,
    searchHistory: searchHistory.map(s => ({
      id: s.id,
      query: s.query,
      timestamp: s.timestamp
    })),
    alerts,
    sessions: sessions.map(s => ({
      id: s.id,
      ipAddress: s.ipAddress,
      userAgent: s.userAgent,
      createdAt: s.createdAt,
      lastActivity: s.lastActivity
    }))
  });
});

// POST /api/v1/admin/users/:id/suspend
app.post('/api/v1/admin/users/:id/suspend', authenticateToken, requireRole('admin'), (req, res) => {
  const user = dataStore.users.find(u => u.id === req.params.id);
  if (!user) {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'User not found',
        details: []
      }
    });
  }

  const { status } = req.body;
  user.status = status;

  res.json({
    id: user.id,
    status: user.status
  });
});

// GET /api/v1/admin/sessions
app.get('/api/v1/admin/sessions', authenticateToken, requireRole('admin'), (req, res) => {
  const { limit = 20, userId, dateFrom, dateTo } = req.query;
  let sessions = [...dataStore.sessions];

  if (userId) {
    sessions = sessions.filter(s => s.userId === userId);
  }

  if (dateFrom) {
    sessions = sessions.filter(s => new Date(s.createdAt) >= new Date(dateFrom));
  }

  if (dateTo) {
    sessions = sessions.filter(s => new Date(s.createdAt) <= new Date(dateTo));
  }

  const limitNum = Math.min(parseInt(limit), 100);
  const results = sessions.slice(0, limitNum);

  res.json({
    data: results.map(s => {
      const user = dataStore.users.find(u => u.id === s.userId);
      return {
        id: s.id,
        userId: s.userId,
        userEmail: user?.email || 'unknown',
        ipAddress: s.ipAddress,
        userAgent: s.userAgent,
        createdAt: s.createdAt,
        lastActivity: s.lastActivity,
        active: s.active
      };
    }),
    pagination: {
      limit: limitNum,
      hasMore: sessions.length > limitNum
    }
  });
});

// GET /api/v1/admin/purchases
app.get('/api/v1/admin/purchases', authenticateToken, requireRole('admin'), (req, res) => {
  const { limit = 20, status, userId } = req.query;
  let purchases = [...dataStore.subscriptions];

  if (status) {
    purchases = purchases.filter(p => p.status === status);
  }

  if (userId) {
    purchases = purchases.filter(p => p.userId === userId);
  }

  const limitNum = Math.min(parseInt(limit), 100);
  const results = purchases.slice(0, limitNum);

  res.json({
    data: results.map(p => {
      const user = dataStore.users.find(u => u.id === p.userId);
      return {
        id: p.id,
        userId: p.userId,
        userEmail: user?.email || 'unknown',
        plan: p.plan,
        amount: p.amount || 29.99,
        currency: p.currency || 'USD',
        status: p.status,
        createdAt: p.createdAt || new Date().toISOString(),
        renewalDate: p.renewalDate
      };
    }),
    pagination: {
      limit: limitNum,
      hasMore: purchases.length > limitNum
    }
  });
});

// GET /api/v1/admin/purchases/:id
app.get('/api/v1/admin/purchases/:id', authenticateToken, requireRole('admin'), (req, res) => {
  const purchase = dataStore.subscriptions.find(p => p.id === req.params.id);
  if (!purchase) {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Purchase not found',
        details: []
      }
    });
  }

  const user = dataStore.users.find(u => u.id === purchase.userId);
  const invoices = dataStore.invoices.filter(i => i.userId === purchase.userId);

  res.json({
    id: purchase.id,
    userId: purchase.userId,
    userEmail: user?.email || 'unknown',
    plan: purchase.plan,
    amount: purchase.amount || 29.99,
    currency: purchase.currency || 'USD',
    status: purchase.status,
    paymentMethod: purchase.paymentMethod,
    createdAt: purchase.createdAt || new Date().toISOString(),
    renewalDate: purchase.renewalDate,
    invoices: invoices.map(i => ({
      id: i.id,
      amount: i.amount,
      status: i.status,
      date: i.date
    }))
  });
});

// POST /api/v1/admin/purchases/:id/refund
app.post('/api/v1/admin/purchases/:id/refund', authenticateToken, requireRole('admin'), (req, res) => {
  const purchase = dataStore.subscriptions.find(p => p.id === req.params.id);
  if (!purchase) {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Purchase not found',
        details: []
      }
    });
  }

  purchase.status = 'refunded';
  res.json({
    id: purchase.id,
    status: 'refunded',
    refundAmount: purchase.amount || 29.99
  });
});

// GET /api/v1/admin/data-removal
app.get('/api/v1/admin/data-removal', authenticateToken, requireRole('admin'), (req, res) => {
  const { limit = 20, status } = req.query;
  let requests = [...dataStore.dataRemovalRequests];

  if (status) {
    requests = requests.filter(r => r.status === status);
  }

  const limitNum = Math.min(parseInt(limit), 100);
  const results = requests.slice(0, limitNum);

  res.json({
    data: results.map(r => {
      const user = dataStore.users.find(u => u.id === r.userId);
      return {
        id: r.id,
        userId: r.userId,
        userEmail: user?.email || 'unknown',
        status: r.status,
        requestedAt: r.requestedAt,
        reason: r.reason
      };
    }),
    pagination: {
      limit: limitNum,
      hasMore: requests.length > limitNum
    }
  });
});

// POST /api/v1/admin/data-removal/:id/approve
app.post('/api/v1/admin/data-removal/:id/approve', authenticateToken, requireRole('admin'), (req, res) => {
  const request = dataStore.dataRemovalRequests.find(r => r.id === req.params.id);
  if (!request) {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Request not found',
        details: []
      }
    });
  }

  request.status = 'approved';
  res.json({
    id: request.id,
    status: 'approved',
    message: 'Data removal approved and scheduled'
  });
});

// POST /api/v1/admin/data-removal/:id/reject
app.post('/api/v1/admin/data-removal/:id/reject', authenticateToken, requireRole('admin'), (req, res) => {
  const request = dataStore.dataRemovalRequests.find(r => r.id === req.params.id);
  if (!request) {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Request not found',
        details: []
      }
    });
  }

  const { reason } = req.body;
  request.status = 'rejected';
  request.rejectionReason = reason;

  res.json({
    id: request.id,
    status: 'rejected',
    reason: reason
  });
});

// GET /api/v1/admin/analytics
app.get('/api/v1/admin/analytics', authenticateToken, requireRole('admin'), (req, res) => {
  const { dateFrom, dateTo } = req.query;
  
  const totalUsers = dataStore.users.length;
  const activeUsers = dataStore.users.filter(u => (u.status || 'active') === 'active').length;
  const totalSearches = dataStore.searches.length;
  const conversions = dataStore.subscriptions.filter(s => s.status === 'active').length;
  const revenue = dataStore.subscriptions
    .filter(s => s.status === 'active')
    .reduce((sum, s) => sum + (s.amount || 29.99), 0);
  const churn = dataStore.subscriptions.filter(s => s.status === 'cancelled').length;
  const newUsers = dataStore.users.filter(u => {
    const created = new Date(u.createdAt);
    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    return created >= monthAgo;
  }).length;

  res.json({
    totalUsers,
    activeUsers,
    totalSearches,
    conversions,
    revenue,
    churn,
    newUsers,
    period: {
      from: dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      to: dateTo || new Date().toISOString().split('T')[0]
    }
  });
});

// GET /api/v1/admin/cs-reps
app.get('/api/v1/admin/cs-reps', authenticateToken, requireRole('admin'), (req, res) => {
  res.json({
    data: dataStore.csReps.map(rep => ({
      id: rep.id,
      name: rep.name,
      email: rep.email,
      role: rep.role,
      status: rep.status,
      createdAt: rep.createdAt
    }))
  });
});

// POST /api/v1/admin/cs-reps
app.post('/api/v1/admin/cs-reps', authenticateToken, requireRole('admin'), (req, res) => {
  const { name, email, role } = req.body;

  const newRep = {
    id: `cs-rep-${Date.now()}`,
    name,
    email,
    role: role || 'cs-rep',
    status: 'active',
    createdAt: new Date().toISOString()
  };

  dataStore.csReps.push(newRep);
  res.status(201).json(newRep);
});

// PUT /api/v1/admin/cs-reps/:id
app.put('/api/v1/admin/cs-reps/:id', authenticateToken, requireRole('admin'), (req, res) => {
  const rep = dataStore.csReps.find(r => r.id === req.params.id);
  if (!rep) {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'CS representative not found',
        details: []
      }
    });
  }

  const { role, status } = req.body;
  if (role) rep.role = role;
  if (status) rep.status = status;

  res.json(rep);
});

// POST /api/v1/admin/events — receive a tracking event
app.post('/api/v1/admin/events', (req, res) => {
  const event = {
    id: eventLog.length + 1,
    ...req.body,
    receivedAt: new Date().toISOString(),
  };
  eventLog.push(event);
  res.status(201).json({ ok: true });
});

// GET /api/v1/admin/events — list all events (admin only, no auth for dev simplicity)
app.get('/api/v1/admin/events', (req, res) => {
  const limit = parseInt(req.query.limit) || 500;
  res.json({ data: eventLog.slice(-limit), total: eventLog.length });
});

// GET /api/v1/admin/events/summary — aggregated counts for analytics dashboard
app.get('/api/v1/admin/events/summary', (req, res) => {
  const counts = {};
  const byDay = {};
  const bySessionId = new Set();

  eventLog.forEach(ev => {
    counts[ev.event] = (counts[ev.event] || 0) + 1;
    if (ev.sessionId) bySessionId.add(ev.sessionId);
    const day = (ev.timestamp || ev.receivedAt || '').slice(0, 10);
    if (day) {
      if (!byDay[day]) byDay[day] = {};
      byDay[day][ev.event] = (byDay[day][ev.event] || 0) + 1;
    }
  });

  // Funnel counts
  const funnel = [
    { step: 'Search', count: counts['search_submit'] || 0 },
    { step: 'Results', count: counts['result_click'] || 0 },
    { step: 'Teaser', count: counts['teaser_view'] || 0 },
    { step: 'Signup', count: counts['signup_complete'] || 0 },
    { step: 'Payment', count: counts['payment_complete'] || 0 },
  ];

  // Daily totals (last 14 days)
  const daily = Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14)
    .map(([date, events]) => ({
      date,
      total: Object.values(events).reduce((s, n) => s + n, 0),
      ...events,
    }));

  res.json({
    totalEvents: eventLog.length,
    uniqueSessions: bySessionId.size,
    counts,
    funnel,
    daily,
  });
});

// GET /api/v1/admin/email-log (admin)
app.get('/api/v1/admin/email-log', authenticateToken, requireRole('admin'), (req, res) => {
  const log = [...emailService.emailLog].reverse(); // newest first
  res.json({ data: log, total: log.length });
});

// POST /api/v1/admin/email-broadcast (admin)
app.post('/api/v1/admin/email-broadcast', authenticateToken, requireRole('admin'), async (req, res) => {
  const { subject, html, audience } = req.body;
  if (!subject || !html) return res.status(400).json({ error: 'subject and html are required' });

  let recipients = [...dataStore.users];
  if (audience === 'paid') {
    const paidIds = new Set(dataStore.subscriptions.filter(s => s.status === 'active').map(s => s.userId));
    recipients = dataStore.users.filter(u => paidIds.has(u.id));
  } else if (audience === 'unpaid') {
    const paidIds = new Set(dataStore.subscriptions.filter(s => s.status === 'active').map(s => s.userId));
    recipients = dataStore.users.filter(u => !paidIds.has(u.id));
  } else if (audience === 'optin') {
    recipients = dataStore.users.filter(u => u.notificationPreferences?.marketingEmails !== false && u.optin !== false);
  }

  const results = await emailService.sendBroadcast(recipients, subject, html).catch(e => {
    return res.status(500).json({ error: e.message });
  });
  if (!res.headersSent) {
    res.json({ sent: results.length, results });
  }
});

// ==================== CONTACT / SUPPORT TICKET ENDPOINTS ====================

// Helper: optionally extract userId from JWT (does NOT reject unauthenticated requests)
function optionalAuth(req) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded.userId || null;
  } catch {
    return null;
  }
}

// POST /api/v1/contact — create a new support ticket / thread
app.post('/api/v1/contact', (req, res) => {
  const { name, email, phone, subject, message, source, marketingOptIn } = req.body;

  if (!name || !email || !subject || !message) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'name, email, subject, and message are required',
        details: []
      }
    });
  }

  const userId = optionalAuth(req);
  const threadId = `thread_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const now = new Date().toISOString();

  const thread = {
    threadId,
    userId: userId || null,
    email,
    name,
    phone: phone || null,
    subject,
    source: source || 'general',
    marketingOptIn: !!marketingOptIn,
    createdAt: now,
    messages: [{
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      sender: 'user',
      name,
      email,
      message,
      createdAt: now
    }]
  };

  contactThreads.set(threadId, thread);

  // Cross-reference by userId
  if (userId) {
    if (!userThreads.has(userId)) {
      userThreads.set(userId, new Set());
    }
    userThreads.get(userId).add(threadId);
  }

  console.log(`[Contact] New thread ${threadId} from ${email} (userId: ${userId || 'visitor'})`);

  res.status(201).json({
    threadId,
    threadUrl: `/contact/thread/${threadId}`
  });
});

// GET /api/v1/contact/thread/:threadId — get all messages in a thread
app.get('/api/v1/contact/thread/:threadId', (req, res) => {
  const thread = contactThreads.get(req.params.threadId);
  if (!thread) {
    return res.status(404).json({
      error: {
        code: 'THREAD_NOT_FOUND',
        message: 'Support thread not found',
        details: []
      }
    });
  }

  res.json({
    threadId: thread.threadId,
    subject: thread.subject,
    name: thread.name,
    email: thread.email,
    createdAt: thread.createdAt,
    messages: thread.messages
  });
});

// POST /api/v1/contact/thread/:threadId/reply — reply to a thread
app.post('/api/v1/contact/thread/:threadId/reply', (req, res) => {
  const thread = contactThreads.get(req.params.threadId);
  if (!thread) {
    return res.status(404).json({
      error: {
        code: 'THREAD_NOT_FOUND',
        message: 'Support thread not found',
        details: []
      }
    });
  }

  const { message, name, email } = req.body;
  if (!message) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'message is required',
        details: []
      }
    });
  }

  const userId = optionalAuth(req);
  const sender = userId ? 'support' : 'user';
  const now = new Date().toISOString();

  const newMessage = {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    sender,
    name: name || (sender === 'support' ? 'CS Agent' : thread.name),
    email: email || (sender === 'support' ? undefined : thread.email),
    message,
    createdAt: now
  };

  thread.messages.push(newMessage);

  console.log(`[Contact] Reply on ${thread.threadId} by ${sender}`);

  res.status(201).json(newMessage);
});

// GET /api/v1/contact/threads — list threads for authenticated user
app.get('/api/v1/contact/threads', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const threadIds = userThreads.get(userId);

  if (!threadIds || threadIds.size === 0) {
    return res.json({ threads: [] });
  }

  const threads = Array.from(threadIds)
    .map(id => contactThreads.get(id))
    .filter(Boolean)
    .map(t => ({
      threadId: t.threadId,
      subject: t.subject,
      name: t.name,
      email: t.email,
      source: t.source,
      createdAt: t.createdAt,
      lastMessage: t.messages[t.messages.length - 1],
      messageCount: t.messages.length
    }))
    .sort((a, b) => new Date(b.lastMessage.createdAt) - new Date(a.lastMessage.createdAt));

  res.json({ threads });
});

// Error handling middleware (must be last, before app.listen)
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: err.message || 'An internal error occurred',
      details: []
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Mock API server running on http://localhost:${PORT}`);
  console.log(`API base URL: http://localhost:${PORT}/api/v1`);
  console.log(`\nSeed data loaded:`);
  console.log(`- Users: ${dataStore.users.length}`);
  console.log(`- People: ${dataStore.people.length}`);
  console.log(`- Searches: ${dataStore.searches.length}`);
  console.log(`- Alerts: ${dataStore.alerts.length}`);
  console.log(`\nTest credentials:`);
  console.log(`- Member: member@test.com / password123 (with active subscription)`);
  console.log(`- Paid Member: paid@test.com / password123 (with active subscription)`);
  console.log(`- Admin: admin@test.com / admin123`);
});

