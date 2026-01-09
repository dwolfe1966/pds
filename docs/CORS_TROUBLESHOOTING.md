# CORS Troubleshooting Guide

## Issue: CORS Errors When Using New API

When testing the new API from `localhost:3000`, you may see CORS (Cross-Origin Resource Sharing) errors in the browser console:

```
Access to XMLHttpRequest at 'https://dev1.dev.www.bytecrtrs.com/api/...' 
from origin 'http://localhost:3000' has been blocked by CORS policy
```

## Why This Happens

The new API server (`https://dev1.dev.www.bytecrtrs.com/api`) doesn't allow requests from `http://localhost:3000` by default. This is a security feature of browsers.

## Solution 1: Automatic Fallback (Current Behavior)

**Good News:** The hybrid API router automatically detects CORS errors and falls back to the mock API. You should still see results, even though the console shows CORS errors.

The errors in the console are informational - the app will automatically use the mock API when CORS fails.

## Solution 2: Configure CORS on API Server (Recommended for Production)

The API server needs to be configured to allow requests from your domain. This requires server-side configuration:

```
Access-Control-Allow-Origin: http://localhost:3000 (for development)
Access-Control-Allow-Origin: https://yourdomain.com (for production)
```

**Note:** This must be done by the API team/server administrators.

## Solution 3: Use a Proxy (Development Only)

For local development, you can set up a proxy to avoid CORS issues. However, since we're using Parcel, this requires additional configuration.

### Option A: Parcel Proxy (if supported)

Create a `package.json` proxy configuration (Parcel 2 may not support this directly).

### Option B: Use Mock API for Development

The simplest solution for development is to use the mock API:

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

With the current implementation:

1. ✅ New API is attempted first (if enabled)
2. ⚠️ CORS error occurs (expected in development)
3. ✅ Automatic fallback to mock API
4. ✅ Search results are displayed (from mock API)

**The CORS errors in the console are expected and don't prevent the app from working.**

## Verifying Fallback Works

1. Check the browser console - you should see:
   ```
   [API Router] CORS error detected for teaser-search. 
   This is expected in development. Falling back to mock API.
   ```

2. Check the Network tab - you should see:
   - Failed request to `dev1.dev.www.bytecrtrs.com` (CORS error)
   - Successful request to `localhost:3001/api/v1/search` (mock API)

3. Results should still appear on the page

## For Production

When deploying to production:

1. Ensure the API server allows CORS from your production domain
2. The CORS errors will not occur if properly configured
3. The fallback will still work as a safety net

## Summary

- **CORS errors are expected in development** when testing the new API from localhost
- **The app automatically falls back to mock API** when CORS fails
- **Results will still appear** - the errors are just console warnings
- **For production**, ensure CORS is configured on the API server
