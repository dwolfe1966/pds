# CORS Troubleshooting Guide

## Issue: CORS Errors When Using New API

When testing the new API from `localhost:3000`, you may see CORS (Cross-Origin Resource Sharing) errors in the browser console:

```
Access to XMLHttpRequest at 'https://dev1.dev.www.bytecrtrs.com/api/...' 
from origin 'http://localhost:3000' has been blocked by CORS policy
```

## Why This Happens

The new API server (`https://dev1.dev.www.bytecrtrs.com/api`) doesn't allow requests from `http://localhost:3000` by default. This is a security feature of browsers.

## Solution: Proxy Mode (Implemented)

**Good News:** We've implemented a proxy solution that bypasses CORS entirely!

### How It Works

1. The JavaScript library is configured to point to our Express server proxy (`http://localhost:3001/api/proxy`)
2. The library makes requests to our server (same origin, no CORS issues)
3. Our Express server forwards the requests to the external API
4. The response is returned to the browser

### Configuration

Proxy mode is **enabled by default**. The API wrapper automatically uses the proxy when making requests.

**Environment Variables:**
- `REACT_APP_USE_API_PROXY=true` (default) - Enable proxy mode
- `REACT_APP_PROXY_URL=http://localhost:3001/api/proxy` (default) - Proxy server URL
- `EXTERNAL_API_URL=https://dev1.dev.www.bytecrtrs.com/api` (server-side) - External API URL

### To Disable Proxy Mode

If you want to use the library directly (and handle CORS another way):

```env
REACT_APP_USE_API_PROXY=false
```

## Solution 2: Automatic Fallback (Legacy)

If proxy mode is disabled, the hybrid API router automatically detects CORS errors and falls back to the mock API. You should still see results, even though the console shows CORS errors.

The errors in the console are informational - the app will automatically use the mock API when CORS fails.

## Solution 2: Configure CORS on API Server (Recommended for Production)

The API server needs to be configured to allow requests from your domain. This requires server-side configuration:

```
Access-Control-Allow-Origin: http://localhost:3000 (for development)
Access-Control-Allow-Origin: https://yourdomain.com (for production)
```

**Note:** This must be done by the API team/server administrators.

## Solution 3: Use Mock API for Development

If you prefer to use the mock API instead of the proxy:

```env
# In .env file
REACT_APP_NEW_API_ENABLED=false
REACT_APP_USE_NEW_API_SEARCH=false
```

This will use the mock API which doesn't have CORS issues since it runs on localhost.

## Solution 4: Test in Production Environment

CORS errors won't occur when:
- The app is deployed to the same domain as the API
- The API server is configured to allow your production domain
- You're testing from a production-like environment

## Current Behavior

With the current implementation (proxy mode enabled by default):

1. ✅ JavaScript library is configured to use proxy (`http://localhost:3001/api/proxy`)
2. ✅ Library makes requests to our Express server (no CORS issues)
3. ✅ Express server forwards requests to external API
4. ✅ Response is returned to the browser
5. ✅ Search results are displayed

**No CORS errors should occur when using proxy mode!**

## Verifying Proxy Works

1. Check the server console - you should see:
   ```
   [Proxy] POST /api/proxy/idLookup/teaser/search -> https://dev1.dev.www.bytecrtrs.com/api/idLookup/teaser/search
   ```

2. Check the browser Network tab - you should see:
   - Successful request to `localhost:3001/api/proxy/idLookup/teaser/search` (proxy endpoint)
   - No CORS errors in the console

3. Check the browser console - you should NOT see any CORS errors

4. Results should appear on the page from the external API

## For Production

When deploying to production:

1. Ensure the API server allows CORS from your production domain
2. The CORS errors will not occur if properly configured
3. The fallback will still work as a safety net

## Troubleshooting Proxy Mode

### Proxy Not Working

If you still see CORS errors:

1. **Verify the server is running:**
   ```bash
   npm run server
   ```
   Should be running on `http://localhost:3001`

2. **Check environment variables:**
   ```env
   REACT_APP_USE_API_PROXY=true
   REACT_APP_PROXY_URL=http://localhost:3001/api/proxy
   ```

3. **Check server logs:**
   Look for `[Proxy]` messages indicating proxy requests are being received

4. **Verify the proxy endpoint:**
   The server should have the `/api/proxy/*` endpoint configured

### Common Issues

- **"Proxy request failed"**: Check that `EXTERNAL_API_URL` is correct in server environment
- **"Network error"**: Ensure the Express server is running on port 3001
- **Still seeing CORS errors**: Verify `REACT_APP_USE_API_PROXY` is set to `true` (or not set, as it defaults to true)

## Summary

- **Proxy mode is enabled by default** - no CORS errors should occur
- **Requests go through Express server** at `localhost:3001/api/proxy`
- **Server forwards to external API** and returns the response
- **For production**, you may want to configure CORS on the API server directly, or continue using the proxy
