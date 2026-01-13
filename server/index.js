const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const cookieParser = require('cookie-parser');
const { seedData } = require('./seed');
const { authenticateToken, requireRole } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key-change-in-production';

// In-memory data store
let dataStore = {
  users: [],
  people: [],
  searches: [],
  alerts: [],
  notifications: [],
  subscriptions: [],
  invoices: [],
  sessions: [],
  dataRemovalRequests: [],
  csReps: [],
  refreshTokens: new Map(), // Map of refreshToken -> userId
};

// Seed data on startup
try {
  console.log('Loading seed data...');
  const seededData = seedData();
  // Preserve the refreshTokens Map
  dataStore = {
    ...seededData,
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
  origin: ['http://localhost:3000', 'http://localhost:3001'],
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
  if (origin && (origin.includes('localhost:3000') || origin.includes('localhost:3001'))) {
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
    
    // Combine all cookie sources
    let allCookies = [];
    
    if (cookieHeader) {
      // Parse browser cookies
      cookieHeader.split(';').forEach(c => {
        const trimmed = c.trim();
        if (trimmed) allCookies.push(trimmed);
      });
    }
    
    // Add stored cookies from API responses
    storedCookies.forEach(cookie => {
      // Extract cookie name=value from stored cookie string
      const match = cookie.match(/^([^=]+)=([^;]+)/);
      if (match) {
        allCookies.push(`${match[1]}=${match[2]}`);
      }
    });
    
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
    
    // Add dev captcha pass if configured (for development API)
    // The API might require this as a header or query parameter
    const captchaPass = process.env.CAPTCHA_PASS || 'bcEdgeApiPass';
    // Try adding as a custom header (API might check for this)
    if (!headers['X-Captcha-Pass'] && !headers['x-captcha-pass']) {
      headers['X-Captcha-Pass'] = captchaPass;
    }
    
    // Also try adding captcha pass as query parameter (some APIs expect it there)
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
      
      // Check if we have captcha data stored for this session
      const sessionKey = getSessionKey(req);
      const storedCaptchaData = captchaData.get(sessionKey);
      
      // Log captcha-related headers from the request
      // HTTP headers are case-insensitive, but JavaScript object keys are case-sensitive
      // So we need to check multiple case variations
      const getHeaderCaseInsensitive = (headerName) => {
        const lower = headerName.toLowerCase();
        // Check in headers object (already processed)
        for (const key in headers) {
          if (key.toLowerCase() === lower) return headers[key];
        }
        // Check in original request headers
        for (const key in req.headers) {
          if (key.toLowerCase() === lower) return req.headers[key];
        }
        return null;
      };
      
      const requestCaptchaId = getHeaderCaseInsensitive('x-captcha-id');
      console.log('[Proxy] Captcha ID in request:', requestCaptchaId || 'NOT FOUND');
      console.log('[Proxy] All captcha-related headers:', {
        'x-captcha-id': getHeaderCaseInsensitive('x-captcha-id') || 'NOT FOUND',
        'X-Captcha-Pass': getHeaderCaseInsensitive('x-captcha-pass') || 'NOT FOUND'
      });
      
      // Helper to generate a placeholder commerceContentId (must be >= 24 characters)
      const generateCommerceContentId = () => {
        // Generate a 24+ character ID that looks like a MongoDB ObjectId
        // Format: 24 hex characters (MongoDB ObjectId format)
        const chars = '0123456789abcdef';
        let id = '';
        for (let i = 0; i < 24; i++) {
          id += chars[Math.floor(Math.random() * chars.length)];
        }
        return id;
      };
      
      // Helper to generate a placeholder searchContextKey (must be >= 1 character)
      const generateSearchContextKey = () => {
        // Generate a unique key based on timestamp and random
        return `search_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      };
      
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
      
      // Only add commerceContentId and searchContextKey if we have real values from captcha verification
      // The API might reject placeholder values, so we'll only include them if we got them from the captcha response
      // If the library sends them in the request body, we'll use those; otherwise, only use stored values
      if (!requestBody.commerceContentId || requestBody.commerceContentId === '' || requestBody.commerceContentId.length < 24) {
        // Don't generate placeholder - only use if we have a real value from captcha
        if (storedCaptchaData?.commerceContentId && storedCaptchaData.commerceContentId.length >= 24) {
          requestBody.commerceContentId = storedCaptchaData.commerceContentId;
          console.log(`[Proxy] Using commerceContentId from captcha data: ${storedCaptchaData.commerceContentId.substring(0, 20)}...`);
        } else {
          // Remove the field entirely if we don't have a valid value
          delete requestBody.commerceContentId;
          console.log('[Proxy] No valid commerceContentId available - removing from request (API may not require it)');
        }
      }
      
      // Same for searchContextKey - only include if we have a real value
      if (!requestBody.searchContextKey || requestBody.searchContextKey === '') {
        if (storedCaptchaData?.searchContextKey && storedCaptchaData.searchContextKey.length >= 1) {
          requestBody.searchContextKey = storedCaptchaData.searchContextKey;
          console.log(`[Proxy] Using searchContextKey from captcha data: ${storedCaptchaData.searchContextKey}`);
        } else {
          // Remove the field entirely if we don't have a valid value
          delete requestBody.searchContextKey;
          console.log('[Proxy] No valid searchContextKey available - removing from request (API may not require it)');
        }
      }
      
      // Remove any other empty/null/undefined fields that might cause validation errors
      const cleanedBody = { ...requestBody };
      Object.keys(cleanedBody).forEach(key => {
        const value = cleanedBody[key];
        // Don't remove commerceContentId or searchContextKey - we just set them
        if (key !== 'commerceContentId' && key !== 'searchContextKey') {
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
        const captchaInfo = {
          captchaId: captchaId, // Store the captchaId that was verified
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
          captchaId: captchaInfo.captchaId || 'NOT FOUND',
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
    
    // For 412 responses with captcha challenge, store the captchaId for later verification
    if (response.status === 412 && response.data?.captchaId) {
      const sessionKey = getSessionKey(req);
      const captchaId = response.data.captchaId;
      console.log(`[Proxy] Storing captchaId from 412 response: ${captchaId} for session: ${sessionKey}`);
      
      // Update or create captcha data entry
      const existing = captchaData.get(sessionKey) || {};
      captchaData.set(sessionKey, {
        ...existing,
        pendingCaptchaId: captchaId, // Store the captchaId that needs to be verified
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
    } else if (response.status >= 400) {
      // Log other errors (400, 500, etc.) with details
      console.error('='.repeat(80));
      console.error(`[Proxy] ${response.status} Error from API`);
      console.error('[Proxy] Request URL:', url.toString());
      console.error('[Proxy] Request method:', req.method);
      console.error('[Proxy] Request headers sent:', JSON.stringify(headers, null, 2));
      console.error('[Proxy] Request body:', JSON.stringify(req.body).substring(0, 500));
      console.error('[Proxy] Response status:', response.status);
      console.error('[Proxy] Response data:', JSON.stringify(response.data));
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
    if (response.headers['set-cookie']) {
      const cookies = Array.isArray(response.headers['set-cookie']) 
        ? response.headers['set-cookie'] 
        : [response.headers['set-cookie']];
      
      // Get stable session key (based on origin, not clientId/apiId which change)
      const sessionKey = getSessionKey(req);
      
      // Store cookies server-side for this session
      // Merge with existing cookies (don't overwrite, in case there are multiple)
      const existingCookies = apiCookies.get(sessionKey) || [];
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
    if (origin && (origin.includes('localhost:3000') || origin.includes('localhost:3001'))) {
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
  const { fullName, zip, email, password, socialProvider } = req.body;

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

  // Create user
  const newUser = {
    id: `user-${Date.now()}`,
    email,
    fullName,
    zip: zip || '',
    password, // In production, hash this
    emailVerified: false,
    role: 'member',
    createdAt: new Date().toISOString()
  };

  dataStore.users.push(newUser);
  const { accessToken, refreshToken } = generateTokens(newUser);

  res.status(201).json({
    user: {
      id: newUser.id,
      email: newUser.email,
      fullName: newUser.fullName,
      emailVerified: false,
      role: newUser.role
    },
    accessToken,
    refreshToken,
    message: 'Please verify your email'
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

// GET /api/v1/search
app.get('/api/v1/search', (req, res) => {
  let { firstName, lastName, name, state, zip, page = 1, limit = 20 } = req.query;

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

  // Normalize filters - only use if they're non-empty strings
  const stateFilter = state && state.trim() ? state.trim().toUpperCase() : null;
  const zipFilter = zip && zip.trim() ? zip.trim() : null;

  // More flexible search - match if full name contains both first and last name
  let results = dataStore.people.filter(p => {
    const fullNameLower = p.fullName.toLowerCase();
    const searchFirst = firstName.toLowerCase().trim();
    const searchLast = lastName.toLowerCase().trim();
    const searchFull = `${searchFirst} ${searchLast}`.toLowerCase();
    
    // Match if full name contains the complete search string (first + last)
    // This ensures "John Smith" matches "John Smith" but not just "John" or "Smith"
    const nameMatch = fullNameLower.includes(searchFull);
    
    // Filter by state if provided (check addresses)
    const stateMatch = !stateFilter || (p.addresses && p.addresses.some(a => a.state === stateFilter));
    
    // Filter by ZIP if provided (for backward compatibility, but state is preferred)
    const zipMatch = !zipFilter || (p.addresses && p.addresses.some(a => a.zip === zipFilter));
    
    return nameMatch && stateMatch && zipMatch;
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
    s.targetUserId === userId && new Date(s.timestamp) >= startOfMonth
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

  const subscription = dataStore.subscriptions.find(s => s.userId === userId);

  res.json({
    searchesThisMonth,
    activeAlerts,
    recentSearches,
    subscription: subscription ? {
      plan: subscription.plan,
      status: subscription.status,
      renewalDate: subscription.renewalDate
    } : null
  });
});

// GET /api/v1/searches/me
app.get('/api/v1/searches/me', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  const { limit = 20, cursor, filter } = req.query;

  let searches = dataStore.searches.filter(s => s.targetUserId === userId);

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

// PUT /api/v1/subscription
app.put('/api/v1/subscription', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  let subscription = dataStore.subscriptions.find(s => s.userId === userId);

  const { plan, paymentToken } = req.body;

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
  console.log(`- Member: member@test.com / password123`);
  console.log(`- Admin: admin@test.com / admin123`);
});

