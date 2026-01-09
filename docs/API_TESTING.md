# API Integration Testing Guide

This guide explains how to test the Phase 1 API integration locally.

## Prerequisites

1. **Start the mock API server:**
   ```bash
   npm run server
   ```
   The server should start on `http://localhost:3001`

2. **Start the React development server:**
   ```bash
   npm start
   ```
   The app should start on `http://localhost:3000`

## Testing the API Integration

### Option 1: Use the Test Page (Recommended)

1. Navigate to `http://localhost:3000/api-test` in your browser
2. Click the "Run All Tests" button
3. Review the test results and logs

The test page will verify:
- ✓ API wrapper library is loaded from CDN
- ✓ Wrapper can be initialized
- ✓ Mock API calls work
- ✓ New API calls work (if enabled)
- ✓ Hybrid router correctly routes requests

### Option 2: Browser Console Testing

Open the browser console (F12) and run:

```javascript
// Check if API wrapper is loaded
console.log('ApiWrapper loaded:', typeof window.ApiWrapper !== 'undefined');

// Test wrapper initialization
if (window.ApiWrapper) {
  const wrapper = window.ApiWrapper.getInstance({
    endpointUrl: 'https://dev1.dev.www.bytecrtrs.com/api'
  });
  console.log('Wrapper initialized:', wrapper);
}

// Test API service
import('./services/apiWrapper.js').then(module => {
  const apiWrapper = module.default;
  console.log('API Wrapper available:', apiWrapper.isAvailable());
});
```

### Option 3: Test via Existing Pages

1. **Test Search (Mock API):**
   - Navigate to `/name/landing`
   - Enter a name search (e.g., "John Doe")
   - Verify results appear (should use mock API by default)

2. **Test Login (Mock API):**
   - Navigate to `/login`
   - Try logging in with test credentials:
     - Email: `member@test.com`
     - Password: `password123`

## Expected Results

### With Mock API (Default Configuration)

- ✅ Library loaded: Should be `true` (script loads from CDN)
- ✅ Wrapper available: Should be `true`
- ✅ Wrapper initialized: Should be `true`
- ✅ Mock API: Should be `true` (calls to localhost:3001)
- ⚠️ New API: May be `false` (if new API not enabled or unavailable)
- ✅ Hybrid Router: Should be `true`

### Environment Variables

By default, the following environment variables are set (or use defaults):
- `REACT_APP_NEW_API_ENABLED=false` - New API disabled
- `REACT_APP_USE_MOCK_API=true` - Mock API enabled
- `REACT_APP_USE_NEW_API_SEARCH=false` - Use mock API for search

To enable the new API for testing, create a `.env` file in the root directory:

```env
REACT_APP_NEW_API_ENABLED=true
REACT_APP_USE_NEW_API_SEARCH=true
REACT_APP_NEW_API_URL=https://dev1.dev.www.bytecrtrs.com/api
```

## Troubleshooting

### API Wrapper Library Not Loading

**Symptoms:**
- Test shows "Library Loaded: ✗"
- Console errors about `window.ApiWrapper` being undefined

**Solutions:**
1. Check browser console for script loading errors
2. Verify the script tag in `public/index.html`:
   ```html
   <script src="https://dev1.dev.www.bytecrtrs.com/libs/api-wrapper/index.iife.js"></script>
   ```
3. Check network tab to see if the script is loading
4. Try accessing the script URL directly in browser

### Mock API Not Working

**Symptoms:**
- Mock API test fails
- Network errors in console

**Solutions:**
1. Verify mock API server is running: `http://localhost:3001/api/v1/health`
2. Check CORS settings in `server/index.js`
3. Verify the API URL in environment: `REACT_APP_API_URL=http://localhost:3001/api/v1`

### New API Not Working

**Symptoms:**
- New API test fails
- Authentication errors

**Solutions:**
1. Verify new API is enabled: `REACT_APP_NEW_API_ENABLED=true`
2. Check if the endpoint URL is correct
3. Verify network connectivity to the new API
4. Check browser console for detailed error messages

### Hybrid Router Issues

**Symptoms:**
- Router test fails
- Wrong API being called

**Solutions:**
1. Check environment variables are set correctly
2. Verify endpoint registry in `src/services/apiEndpointRegistry.js`
3. Check browser console for router logs (in development mode)

## Next Steps

Once all tests pass:
1. ✅ Phase 1 is complete
2. Ready to proceed with Phase 2 (Search Integration)
3. Can gradually enable new API endpoints as needed

## Removing the Test Page

After testing is complete, you can remove the test page:
1. Delete `src/pages/ApiTestPage.js`
2. Remove the import and route from `src/App.js`

Or keep it for ongoing development and testing.
