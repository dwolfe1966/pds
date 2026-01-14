# CORS Proxy Solution Implementation

## Overview

This document describes the proxy solution implemented to bypass CORS (Cross-Origin Resource Sharing) restrictions when using the ByteCrtrs JavaScript library.

## Problem

The ByteCrtrs JavaScript library makes direct requests from the browser to `https://dev1.dev.www.bytecrtrs.com/api`. When running the React app from `http://localhost:3000`, these requests are blocked by the browser's CORS policy because:

1. The API server doesn't allow requests from `localhost:3000`
2. The library developer cannot modify the library to accommodate CORS

## Solution: Server-Side Proxy

We've implemented a proxy solution that routes requests through our Express server:

```
Browser (localhost:3000) 
  → Express Server (localhost:3001/api/proxy/*) 
    → External API (dev1.dev.www.bytecrtrs.com/api)
```

### How It Works

1. **API Wrapper Configuration**: The `ApiWrapperService` is configured to point the JavaScript library to our proxy URL (`http://localhost:3001/api/proxy`) instead of the external API URL.

2. **Library Requests**: When the library makes a request (e.g., `searchTeaser`), it constructs URLs like:
   - `http://localhost:3001/api/proxy/idLookup/teaser/search?clientId=...&apiId=...`

3. **Proxy Endpoint**: Our Express server has a generic proxy endpoint `/api/proxy/*` that:
   - Receives the request from the browser (same origin, no CORS issues)
   - Extracts the path after `/api/proxy/`
   - Forwards the request to the external API
   - Returns the response to the browser

4. **No CORS Issues**: Since the browser makes requests to `localhost:3001` (same origin as our server), there are no CORS restrictions.

## Implementation Details

### Server-Side (Express)

**File**: `server/index.js`

```javascript
// Generic proxy endpoint
app.all('/api/proxy/*', async (req, res) => {
  // Extract path: /api/proxy/idLookup/teaser/search -> /idLookup/teaser/search
  const proxyPath = req.path.replace('/api/proxy', '');
  const targetUrl = `${EXTERNAL_API_URL}${proxyPath}`;
  
  // Forward request to external API
  const response = await axios({
    method: req.method,
    url: targetUrl,
    headers: { ... },
    data: req.body,
  });
  
  // Return response to browser
  res.send(response.data);
});
```

**Features**:
- Handles all HTTP methods (GET, POST, PUT, DELETE, etc.)
- Forwards query parameters
- Forwards request body
- Forwards response headers (with CORS headers added)
- Handles errors gracefully

### Client-Side (React)

**File**: `src/services/apiWrapper.js`

```javascript
class ApiWrapperService {
  constructor() {
    this.useProxy = process.env.REACT_APP_USE_API_PROXY !== 'false'; // Default: true
    this.proxyUrl = process.env.REACT_APP_PROXY_URL || 'http://localhost:3001/api/proxy';
  }
  
  async initialize() {
    // Point library to proxy URL instead of external API
    const endpointUrl = this.useProxy ? this.proxyUrl : this.endpointUrl;
    this.wrapper = window.ApiWrapper.getInstance({ endpointUrl });
  }
}
```

**Features**:
- Proxy mode enabled by default
- Automatically configures library to use proxy
- Falls back to direct API calls if proxy is disabled
- Handles CORS errors gracefully

## Configuration

### Environment Variables

**Client-Side (.env)**:
```env
# Enable/disable proxy mode (default: true)
REACT_APP_USE_API_PROXY=true

# Proxy server URL (default: http://localhost:3001/api/proxy)
REACT_APP_PROXY_URL=http://localhost:3001/api/proxy

# External API URL (used when proxy is disabled)
REACT_APP_NEW_API_URL=https://dev1.dev.www.bytecrtrs.com/api
```

**Server-Side (server/.env or process.env)**:
```env
# External API URL to proxy to
EXTERNAL_API_URL=https://dev1.dev.www.bytecrtrs.com/api
```

## Usage

### Default Behavior (Proxy Enabled)

No configuration needed! The proxy is enabled by default:

1. Start the Express server: `npm run server`
2. Start the React app: `npm start`
3. Make API calls - they'll automatically go through the proxy

### Disable Proxy Mode

If you want to use the library directly (e.g., in production where CORS is configured):

```env
REACT_APP_USE_API_PROXY=false
```

## Benefits

1. **No CORS Issues**: All requests go through same-origin server
2. **No Library Modifications**: Works with the existing JavaScript library
3. **Transparent**: The library doesn't know it's using a proxy
4. **Flexible**: Can be enabled/disabled via environment variables
5. **Production Ready**: Can be used in production or development

## Testing

### Verify Proxy is Working

1. **Check Server Logs**:
   ```
   [Proxy] POST /api/proxy/idLookup/teaser/search -> https://dev1.dev.www.bytecrtrs.com/api/idLookup/teaser/search
   ```

2. **Check Browser Network Tab**:
   - Request to: `localhost:3001/api/proxy/idLookup/teaser/search`
   - Status: 200 OK
   - No CORS errors in console

3. **Check Browser Console**:
   - No CORS error messages
   - API responses are received normally

### Test Without Proxy

To test the fallback behavior:

```env
REACT_APP_USE_API_PROXY=false
```

You should see CORS errors, and the router will fall back to the mock API.

## Production Considerations

### Option 1: Continue Using Proxy

- Deploy the Express server alongside your React app
- Update `REACT_APP_PROXY_URL` to point to your production server
- All requests continue to go through the proxy

### Option 2: Configure CORS on API Server

- Work with the API team to allow CORS from your production domain
- Set `REACT_APP_USE_API_PROXY=false`
- Point library directly to external API

### Option 3: Use Both

- Use proxy for development
- Use direct API calls in production (if CORS is configured)

## Troubleshooting

See `CORS_TROUBLESHOOTING.md` for detailed troubleshooting steps.

## Files Modified

1. `server/index.js` - Added proxy endpoints
2. `src/services/apiWrapper.js` - Added proxy mode configuration
3. `server/package.json` - Added axios dependency
4. `docs/CORS_TROUBLESHOOTING.md` - Updated with proxy solution
5. `docs/PROXY_SOLUTION.md` - This document

## Summary

The proxy solution provides a clean, transparent way to bypass CORS restrictions without modifying the external JavaScript library. It's enabled by default and works seamlessly with the existing codebase.
