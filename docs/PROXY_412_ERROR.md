# Troubleshooting 412 Precondition Failed Error

## Issue

When using the proxy, you may encounter a `412 (Precondition Failed)` error from the API. This indicates that the API's security checks are failing.

## What is 412 Precondition Failed?

HTTP 412 means the server is rejecting the request because a precondition (security check) failed. The API is likely checking:

1. **Security Headers**: Specific headers that must be present or match expected values
2. **Request Signature**: The request must match what the JavaScript library would normally send
3. **Session/Cookies**: Tokens or session data from previous requests (like captcha verification)
4. **Origin/Referer**: The request must appear to come from an allowed domain

## Current Implementation

The proxy now:
- ✅ Forwards all headers from the browser request (except `host`, `connection`, `content-length`)
- ✅ Forwards cookies if present
- ✅ Forwards Origin and Referer headers
- ✅ Logs detailed information when 412 errors occur

## Debugging Steps

### 1. Check Server Logs

When a 412 error occurs, the server will log detailed information:

```
[Proxy] 412 Precondition Failed - API security check failed
[Proxy] Request URL: https://dev1.dev.www.bytecrtrs.com/api/idLookup/teaser/search?...
[Proxy] Request method: POST
[Proxy] Request headers sent: {...}
[Proxy] Request body: {...}
[Proxy] Response data: {...}
```

### 2. Compare Headers

Compare the headers being sent through the proxy with what the JavaScript library would send directly:

**In Browser DevTools:**
1. Open Network tab
2. Find the request to `localhost:3001/api/proxy/idLookup/teaser/search`
3. Check the Request Headers section
4. Note all headers being sent

**What to Look For:**
- Custom headers the library might set
- Security tokens
- Session identifiers
- Any headers that might be API-specific

### 3. Check API Response

The API's 412 response might include details about what's missing:

```json
{
  "error": {
    "code": "SECURITY_CHECK_FAILED",
    "message": "Missing required header: X-Security-Token"
  }
}
```

### 4. Test Direct API Call

To understand what the API expects, you can test a direct call (if CORS allows):

```javascript
// In browser console (if CORS allows)
fetch('https://dev1.dev.www.bytecrtrs.com/api/idLookup/teaser/search?clientId=...&apiId=...', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    // Add headers the library normally sets
  },
  body: JSON.stringify({ fName: 'John', lName: 'Doe' })
})
```

## Common Causes

### 1. Missing Security Headers

The JavaScript library might set custom headers that the API checks:

**Solution:** Ensure all headers from the browser request are forwarded. Check server logs to see what headers are being sent.

### 2. Captcha Token Not Forwarded

The API might require a token from the captcha verification:

**Solution:** The library should handle this internally. Check if cookies are being forwarded (they are now).

### 3. Origin/Referer Mismatch

The API might check that requests come from specific domains:

**Solution Options:**
- Forward Origin/Referer as-is (current implementation)
- Set Origin to the API's domain
- Remove Origin header entirely

### 4. Request Signature Mismatch

The API might verify that the request signature matches what the library would send:

**Solution:** This is harder to fix. You may need to:
- Contact the API team about proxy usage
- Check if there's a way to whitelist your proxy server
- Use a different authentication method

## Solutions to Try

### Solution 1: Forward All Headers (Already Implemented)

The proxy now forwards all headers except those that would break the request. This should include any custom headers the library sets.

### Solution 2: Check for Missing Headers

1. Check server logs for the exact headers being sent
2. Compare with what the library sends in a direct call (if possible)
3. Add any missing headers to the proxy

### Solution 3: Set Origin to API Domain

If the API checks Origin, try setting it to the API's domain:

```javascript
// In server/index.js proxy endpoint
headers['Origin'] = 'https://dev1.dev.www.bytecrtrs.com';
```

### Solution 4: Contact API Team

If the security checks are too strict, you may need to:
- Request whitelisting of your proxy server IP/domain
- Ask for documentation on required security headers
- Request a different authentication method for server-to-server calls

## Next Steps

1. **Check Server Logs**: Look for the detailed 412 error logs
2. **Compare Headers**: See what headers are being sent vs. what the API expects
3. **Check API Response**: Look for error details in the 412 response
4. **Test Direct Call**: If possible, test what headers work in a direct call
5. **Contact Support**: If needed, contact the API team with the error details

## Example: Adding Custom Headers

If you discover the API requires a specific header, you can add it:

```javascript
// In server/index.js proxy endpoint
if (req.path.includes('/idLookup/teaser/search')) {
  headers['X-Custom-Header'] = 'required-value';
}
```

## Summary

The 412 error indicates the API's security checks are failing. The proxy now forwards all headers and cookies, which should resolve most issues. If problems persist:

1. Check server logs for detailed error information
2. Compare headers being sent with what the API expects
3. Consider contacting the API team for support
