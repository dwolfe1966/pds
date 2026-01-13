# CORS Elimination Plan: Static Deployment Without Proxy Server

**Date:** January 2025  
**Status:** Research & Planning  
**Goal:** Eliminate proxy server requirement while avoiding CORS issues

---

## Executive Summary

This document outlines strategies to eliminate the need for a proxy server while maintaining functionality with the ByteCrtrs API. The goal is to enable pure static deployment of the React app.

**Current Challenge:**
- ByteCrtrs API blocks direct browser requests (CORS policy)
- Proxy server was implemented to bypass CORS
- Proxy also manages cookies and captcha flow
- Proxy requires Node.js hosting (adds complexity and cost)

**Desired Outcome:**
- Deploy React app as static files only
- No proxy server required
- No CORS errors
- All functionality preserved

---

## Root Cause Analysis

### Why CORS Errors Occur

1. **Browser Same-Origin Policy**
   - Browser blocks requests from `https://yourdomain.com` to `https://dev1.dev.www.bytecrtrs.com`
   - This is a security feature, not a bug

2. **ByteCrtrs API Configuration**
   - API server doesn't include `Access-Control-Allow-Origin` header for your domain
   - API may require specific headers (`x-captcha-id`, etc.) that trigger CORS preflight
   - API uses cookies that require `credentials: true`, which has stricter CORS rules

3. **Cookie Management**
   - Cross-origin cookies don't work reliably in browsers
   - API requires cookies for session management
   - Current proxy stores cookies server-side

4. **Captcha Flow**
   - Requires multiple request/response cycles
   - Needs to track state between requests
   - Current proxy manages this state

---

## Solution Options (Ranked by Feasibility)

### Option 1: Request CORS Configuration from ByteCrtrs ⭐⭐⭐⭐⭐
**Feasibility:** High | **Effort:** Low | **Control:** Low (requires ByteCrtrs cooperation)

#### Description
Request ByteCrtrs to configure their API server to allow CORS from your production domain(s).

#### Implementation Steps

1. **Contact ByteCrtrs API Team**
   - Request CORS configuration for your production domain(s)
   - Provide list of domains:
     - `https://idlookup.ai`
     - `https://www.idlookup.ai`
     - `http://localhost:3000` (for development)
   - Request specific headers to be allowed:
     - `x-captcha-id`
     - `X-Captcha-Id`
     - `x-captcha-token`
     - `Content-Type`
     - `Cookie`
     - `X-Captcha-Pass`

2. **Required CORS Headers**
   ```
   Access-Control-Allow-Origin: https://idlookup.ai
   Access-Control-Allow-Credentials: true
   Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
   Access-Control-Allow-Headers: Content-Type, Cookie, x-captcha-id, X-Captcha-Id, x-captcha-token, X-Captcha-Pass
   Access-Control-Expose-Headers: Set-Cookie
   ```

3. **Code Changes Required**
   - Update `apiWrapper.js` to use direct API URL (no proxy)
   - Remove proxy configuration
   - Test cookie handling (may need adjustments)

#### Pros
- ✅ Simplest solution
- ✅ No infrastructure changes needed
- ✅ True static deployment
- ✅ Best performance (no proxy hop)
- ✅ No additional costs

#### Cons
- ❌ Requires ByteCrtrs cooperation
- ❌ May take time to implement
- ❌ Limited control over timeline
- ❌ May require security review from ByteCrtrs

#### Success Criteria
- ByteCrtrs API responds with proper CORS headers
- Direct API calls work from browser
- Cookies work cross-origin
- No CORS errors in console

#### Estimated Timeline
- Request: 1 day
- ByteCrtrs implementation: 1-2 weeks (depends on their process)
- Testing: 1-2 days

---

### Option 2: Serverless Functions (Netlify/Vercel Functions) ⭐⭐⭐⭐
**Feasibility:** High | **Effort:** Medium | **Control:** High

#### Description
Use serverless functions provided by static hosting platforms to proxy API requests. Functions are deployed alongside static files but don't require a separate server.

#### Implementation Steps

1. **Choose Platform**
   - **Netlify Functions** (if using Netlify)
   - **Vercel Functions** (if using Vercel)
   - **AWS Lambda@Edge** (if using CloudFront)

2. **Create Proxy Function**

   **For Netlify (`netlify/functions/proxy.js`):**
   ```javascript
   const axios = require('axios');
   
   exports.handler = async (event, context) => {
     // Only allow POST/GET
     if (!['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'].includes(event.httpMethod)) {
       return { statusCode: 405, body: 'Method not allowed' };
     }
     
     // Handle CORS preflight
     if (event.httpMethod === 'OPTIONS') {
       return {
         statusCode: 204,
         headers: {
           'Access-Control-Allow-Origin': event.headers.origin || '*',
           'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
           'Access-Control-Allow-Headers': 'Content-Type, Cookie, x-captcha-id, X-Captcha-Id',
           'Access-Control-Allow-Credentials': 'true',
         },
         body: '',
       };
     }
     
     // Extract path from query string or path
     const path = event.path.replace('/.netlify/functions/proxy', '');
     const targetUrl = `https://dev1.dev.www.bytecrtrs.com/api${path}`;
     
     // Forward headers
     const headers = {
       'Content-Type': event.headers['content-type'] || 'application/json',
       'X-Captcha-Pass': 'bcEdgeApiPass',
     };
     
     // Forward cookies if present
     if (event.headers.cookie) {
       headers['Cookie'] = event.headers.cookie;
     }
     
     // Forward custom headers
     if (event.headers['x-captcha-id']) {
       headers['x-captcha-id'] = event.headers['x-captcha-id'];
     }
     
     try {
       const response = await axios({
         method: event.httpMethod,
         url: targetUrl,
         headers,
         data: event.body ? JSON.parse(event.body) : undefined,
         params: event.queryStringParameters,
         withCredentials: false, // Server-side, no credentials needed
       });
       
       // Forward Set-Cookie headers
       const responseHeaders = {
         'Access-Control-Allow-Origin': event.headers.origin || '*',
         'Access-Control-Allow-Credentials': 'true',
         'Content-Type': response.headers['content-type'] || 'application/json',
       };
       
       if (response.headers['set-cookie']) {
         responseHeaders['Set-Cookie'] = response.headers['set-cookie'];
       }
       
       return {
         statusCode: response.status,
         headers: responseHeaders,
         body: JSON.stringify(response.data),
       };
     } catch (error) {
       return {
         statusCode: error.response?.status || 500,
         headers: {
           'Access-Control-Allow-Origin': event.headers.origin || '*',
         },
         body: JSON.stringify({ error: error.message }),
       };
     }
   };
   ```

   **For Vercel (`api/proxy/[...path].js`):**
   ```javascript
   import axios from 'axios';
   
   export default async function handler(req, res) {
     // Handle CORS
     res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
     res.setHeader('Access-Control-Allow-Credentials', 'true');
     res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
     res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cookie, x-captcha-id');
     
     if (req.method === 'OPTIONS') {
       return res.status(204).end();
     }
     
     const path = req.query.path.join('/');
     const targetUrl = `https://dev1.dev.www.bytecrtrs.com/api/${path}`;
     
     try {
       const response = await axios({
         method: req.method,
         url: targetUrl,
         headers: {
           'Content-Type': req.headers['content-type'] || 'application/json',
           'X-Captcha-Pass': 'bcEdgeApiPass',
           ...(req.headers.cookie && { Cookie: req.headers.cookie }),
           ...(req.headers['x-captcha-id'] && { 'x-captcha-id': req.headers['x-captcha-id'] }),
         },
         data: req.body,
         params: req.query,
       });
       
       // Forward Set-Cookie
       if (response.headers['set-cookie']) {
         res.setHeader('Set-Cookie', response.headers['set-cookie']);
       }
       
       return res.status(response.status).json(response.data);
     } catch (error) {
       return res.status(error.response?.status || 500).json({ error: error.message });
     }
   }
   ```

3. **Update React App Configuration**

   **Update `apiWrapper.js`:**
   ```javascript
   // Use serverless function instead of proxy server
   this.useProxy = process.env.REACT_APP_USE_API_PROXY !== 'false';
   this.proxyUrl = process.env.REACT_APP_PROXY_URL || 
     (process.env.NODE_ENV === 'production' 
       ? '/.netlify/functions/proxy'  // Netlify
       : 'http://localhost:3001/api/proxy');  // Dev proxy
   ```

4. **Cookie Storage Strategy**
   - **Option A:** Store cookies in browser (if CORS allows)
   - **Option B:** Use serverless function to manage cookies (store in function's memory/Redis)
   - **Option C:** Use sessionStorage/localStorage for client-side state

#### Pros
- ✅ Deploys with static files (same deployment)
- ✅ No separate server to manage
- ✅ Scales automatically
- ✅ Free tier available (Netlify: 125k requests/month, Vercel: 100k requests/month)
- ✅ Low latency (functions run close to users)

#### Cons
- ❌ Still requires server-side code (but simpler than full server)
- ❌ Cookie management may need Redis/external storage
- ❌ Cold start latency (first request may be slower)
- ❌ Platform-specific (tied to hosting provider)
- ❌ Function timeout limits (typically 10-30 seconds)

#### Success Criteria
- Functions deploy successfully
- API calls route through functions
- Cookies work correctly
- No CORS errors
- Performance acceptable

#### Estimated Timeline
- Implementation: 2-3 days
- Testing: 1-2 days
- Deployment: 1 day

---

### Option 3: Cloudflare Workers ⭐⭐⭐⭐
**Feasibility:** High | **Effort:** Medium | **Control:** High

#### Description
Use Cloudflare Workers (edge computing) to proxy API requests. Workers run at the edge, close to users, and can be deployed independently of your static site.

#### Implementation Steps

1. **Create Cloudflare Worker**

   **`worker.js`:**
   ```javascript
   addEventListener('fetch', event => {
     event.respondWith(handleRequest(event.request));
   });
   
   async function handleRequest(request) {
     // Handle CORS preflight
     if (request.method === 'OPTIONS') {
       return new Response(null, {
         status: 204,
         headers: {
           'Access-Control-Allow-Origin': request.headers.get('origin') || '*',
           'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
           'Access-Control-Allow-Headers': 'Content-Type, Cookie, x-captcha-id',
           'Access-Control-Allow-Credentials': 'true',
         },
       });
     }
     
     // Extract path from URL
     const url = new URL(request.url);
     const path = url.pathname.replace('/api/proxy', '');
     const targetUrl = `https://dev1.dev.www.bytecrtrs.com/api${path}${url.search}`;
     
     // Forward request
     const headers = new Headers();
     headers.set('Content-Type', request.headers.get('content-type') || 'application/json');
     headers.set('X-Captcha-Pass', 'bcEdgeApiPass');
     
     if (request.headers.get('cookie')) {
       headers.set('Cookie', request.headers.get('cookie'));
     }
     if (request.headers.get('x-captcha-id')) {
       headers.set('x-captcha-id', request.headers.get('x-captcha-id'));
     }
     
     const response = await fetch(targetUrl, {
       method: request.method,
       headers,
       body: request.method !== 'GET' && request.method !== 'HEAD' ? await request.text() : undefined,
     });
     
     // Create response with CORS headers
     const corsHeaders = {
       'Access-Control-Allow-Origin': request.headers.get('origin') || '*',
       'Access-Control-Allow-Credentials': 'true',
     };
     
     // Forward Set-Cookie
     const setCookie = response.headers.get('set-cookie');
     if (setCookie) {
       corsHeaders['Set-Cookie'] = setCookie;
     }
     
     return new Response(await response.text(), {
       status: response.status,
       headers: { ...corsHeaders, ...Object.fromEntries(response.headers) },
     });
   }
   ```

2. **Deploy Worker**
   ```bash
   # Install Wrangler CLI
   npm install -g wrangler
   
   # Login to Cloudflare
   wrangler login
   
   # Deploy worker
   wrangler publish
   ```

3. **Configure Route**
   - In Cloudflare dashboard, set route: `idlookup.ai/api/proxy/*`
   - Worker will intercept requests to this path

4. **Update React App**
   ```javascript
   // Use Cloudflare Worker URL
   this.proxyUrl = 'https://idlookup.ai/api/proxy';
   ```

#### Pros
- ✅ Runs at edge (low latency globally)
- ✅ Free tier: 100,000 requests/day
- ✅ No cold starts
- ✅ Can use Cloudflare KV for cookie storage
- ✅ Independent of static hosting provider

#### Cons
- ❌ Requires Cloudflare account
- ❌ Cookie storage needs KV (additional setup)
- ❌ Worker code must be maintained separately
- ❌ 10ms CPU time limit (may need optimization)

#### Success Criteria
- Worker deployed and routing correctly
- API calls work through worker
- Cookies managed correctly
- Performance acceptable

#### Estimated Timeline
- Implementation: 2-3 days
- Testing: 1-2 days
- Deployment: 1 day

---

### Option 4: Reverse Proxy via CDN/Edge (Cloudflare/AWS) ⭐⭐⭐
**Feasibility:** Medium | **Effort:** High | **Control:** Medium

#### Description
Configure a reverse proxy at the CDN/edge level to route API requests. This is transparent to the browser (appears same-origin).

#### Implementation Steps

1. **Cloudflare Page Rules / Workers**
   - Route `/api/*` to ByteCrtrs API
   - Add CORS headers in response

2. **AWS CloudFront + Lambda@Edge**
   - Create CloudFront distribution
   - Use Lambda@Edge to modify requests/responses
   - Route to ByteCrtrs API origin

3. **Nginx Reverse Proxy** (if self-hosting)
   - Configure Nginx to proxy `/api/*` to ByteCrtrs
   - Add CORS headers

#### Pros
- ✅ Transparent to application code
- ✅ Can cache responses
- ✅ High performance

#### Cons
- ❌ Complex setup
- ❌ May require infrastructure changes
- ❌ Cookie handling still challenging
- ❌ Cost considerations

#### Estimated Timeline
- Implementation: 1-2 weeks
- Testing: 1 week
- Deployment: 1 week

---

### Option 5: Browser Extension / Native App ⭐
**Feasibility:** Low | **Effort:** Very High | **Control:** High

#### Description
Package the React app as a browser extension or native app, which can bypass CORS restrictions.

#### Pros
- ✅ Can bypass CORS completely
- ✅ Full control

#### Cons
- ❌ Not a web app anymore
- ❌ Requires distribution through app stores
- ❌ Significant development effort
- ❌ Doesn't meet requirement (static web deployment)

#### Estimated Timeline
- Implementation: 2-3 months
- Not recommended for this use case

---

## Recommended Approach: Hybrid Strategy

### Phase 1: Request CORS from ByteCrtrs (Immediate)
1. Contact ByteCrtrs API team
2. Request CORS configuration for your domains
3. Provide specific requirements (headers, credentials, etc.)
4. **Timeline:** 1-2 weeks

### Phase 2: Implement Serverless Functions (Backup)
While waiting for ByteCrtrs response:
1. Implement Netlify/Vercel functions as backup
2. Test thoroughly
3. Keep proxy server as fallback
4. **Timeline:** 1 week

### Phase 3: Migrate Based on Outcome
- **If ByteCrtrs enables CORS:** Remove proxy, use direct API
- **If ByteCrtrs cannot/will not:** Use serverless functions
- **If serverless insufficient:** Keep proxy server

---

## Implementation Plan: Serverless Functions (Option 2)

### Step-by-Step Implementation

#### Step 1: Choose Platform
- **If using Netlify:** Use Netlify Functions
- **If using Vercel:** Use Vercel Functions
- **If using AWS:** Use Lambda@Edge or API Gateway

#### Step 2: Create Function Structure

**For Netlify:**
```
netlify/
  functions/
    proxy.js
```

**For Vercel:**
```
api/
  proxy/
    [...path].js
```

#### Step 3: Implement Cookie Storage

**Option A: Browser Storage (Preferred)**
- If CORS allows, cookies will work in browser
- No server-side storage needed

**Option B: Serverless Storage**
- Use platform's key-value store:
  - Netlify: Netlify KV (if available)
  - Vercel: Vercel KV
  - Cloudflare: Cloudflare KV
- Store cookies with session key
- Retrieve on each request

**Option C: Stateless Approach**
- Don't store cookies server-side
- Let browser handle cookies (if CORS allows)
- Forward cookies from browser to API

#### Step 4: Update React App

1. **Update `apiWrapper.js`:**
   ```javascript
   // Detect platform and set proxy URL
   const getProxyUrl = () => {
     if (process.env.NODE_ENV === 'production') {
       // Use serverless function
       if (window.location.hostname.includes('netlify.app')) {
         return '/.netlify/functions/proxy';
       } else if (window.location.hostname.includes('vercel.app')) {
         return '/api/proxy';
       } else {
         // Fallback to direct API (if CORS enabled)
         return process.env.REACT_APP_NEW_API_URL;
       }
     } else {
       // Development: use local proxy
       return 'http://localhost:3001/api/proxy';
     }
   };
   
   this.proxyUrl = getProxyUrl();
   ```

2. **Update environment variables:**
   ```env
   # Production
   REACT_APP_USE_API_PROXY=true
   REACT_APP_PROXY_URL=/.netlify/functions/proxy  # or /api/proxy for Vercel
   
   # Development
   REACT_APP_USE_API_PROXY=true
   REACT_APP_PROXY_URL=http://localhost:3001/api/proxy
   ```

#### Step 5: Handle Captcha Flow

The captcha flow requires state management. Options:

1. **Client-Side State:**
   - Store captcha data in sessionStorage
   - Include in each request
   - No server-side state needed

2. **Serverless State:**
   - Use platform's KV store
   - Store captcha data with session key
   - Retrieve on each request

3. **Stateless:**
   - Include all captcha data in request
   - API handles state internally

#### Step 6: Testing

1. **Local Testing:**
   - Test functions locally (Netlify Dev / Vercel Dev)
   - Verify CORS headers
   - Test cookie forwarding

2. **Production Testing:**
   - Deploy to staging
   - Test all API endpoints
   - Verify performance
   - Check error handling

---

## Migration Checklist

### Pre-Migration
- [ ] Choose solution (CORS request vs. serverless functions)
- [ ] Contact ByteCrtrs (if requesting CORS)
- [ ] Set up serverless function platform account
- [ ] Review current proxy implementation
- [ ] Document all API endpoints used

### Implementation
- [ ] Create serverless function(s)
- [ ] Implement cookie handling
- [ ] Implement captcha flow
- [ ] Update React app configuration
- [ ] Update environment variables
- [ ] Test locally

### Testing
- [ ] Test all API endpoints
- [ ] Test cookie persistence
- [ ] Test captcha flow
- [ ] Test error handling
- [ ] Performance testing
- [ ] Load testing

### Deployment
- [ ] Deploy serverless functions
- [ ] Update React app environment variables
- [ ] Deploy React app
- [ ] Verify production functionality
- [ ] Monitor for errors

### Post-Migration
- [ ] Remove proxy server code (if not needed)
- [ ] Update documentation
- [ ] Monitor costs
- [ ] Optimize if needed

---

## Cost Comparison

### Current (Proxy Server)
- **Heroku:** $7/month (Hobby dyno)
- **Railway:** $5/month (Starter)
- **AWS EC2:** $5-10/month (t2.micro)
- **Total:** ~$5-10/month

### Option 1 (CORS from ByteCrtrs)
- **Cost:** $0 (no infrastructure)
- **Savings:** $5-10/month

### Option 2 (Serverless Functions)
- **Netlify Functions:** Free (125k requests/month), then $25/month
- **Vercel Functions:** Free (100k requests/month), then $20/month
- **AWS Lambda:** Free (1M requests/month), then $0.20 per 1M
- **Estimated:** $0-25/month (depends on traffic)

### Option 3 (Cloudflare Workers)
- **Free tier:** 100k requests/day
- **Paid:** $5/month (10M requests/month)
- **Estimated:** $0-5/month

---

## Risk Assessment

### Option 1: CORS from ByteCrtrs
- **Risk:** Low (if ByteCrtrs agrees)
- **Mitigation:** Have backup plan (serverless functions)

### Option 2: Serverless Functions
- **Risk:** Medium
- **Concerns:**
  - Cookie management complexity
  - Cold start latency
  - Function timeout limits
- **Mitigation:**
  - Thorough testing
  - Monitor performance
  - Have proxy server as fallback

### Option 3: Cloudflare Workers
- **Risk:** Low-Medium
- **Concerns:**
  - Requires Cloudflare account
  - Cookie storage setup
- **Mitigation:**
  - Use Cloudflare KV for state
  - Test thoroughly

---

## Recommendation

### Primary Recommendation: Request CORS from ByteCrtrs (Option 1)

**Why:**
1. Simplest solution
2. Best performance
3. No additional infrastructure
4. True static deployment
5. Lowest cost

**Action Items:**
1. Contact ByteCrtrs API team immediately
2. Provide clear requirements
3. Request timeline

### Secondary Recommendation: Serverless Functions (Option 2)

**Why:**
1. Deploys with static files
2. No separate server
3. Scales automatically
4. Good free tier
5. Platform-agnostic (can switch providers)

**Action Items:**
1. Implement as backup while waiting for ByteCrtrs
2. Test thoroughly
3. Keep proxy server until migration complete

### Implementation Priority

1. **Week 1:** Contact ByteCrtrs, request CORS
2. **Week 2:** Implement serverless functions (backup)
3. **Week 3:** Test both approaches
4. **Week 4:** Migrate based on ByteCrtrs response

---

## Next Steps

1. **Immediate:**
   - [ ] Contact ByteCrtrs API team
   - [ ] Request CORS configuration
   - [ ] Provide domain list and requirements

2. **Short-term (1-2 weeks):**
   - [ ] Implement serverless function backup
   - [ ] Test cookie handling
   - [ ] Test captcha flow

3. **Medium-term (2-4 weeks):**
   - [ ] Receive ByteCrtrs response
   - [ ] Choose final solution
   - [ ] Migrate production

4. **Long-term:**
   - [ ] Remove proxy server (if not needed)
   - [ ] Update documentation
   - [ ] Monitor and optimize

---

## Questions for ByteCrtrs

When contacting ByteCrtrs, ask:

1. **CORS Configuration:**
   - Can you enable CORS for our production domains?
   - What domains should we provide?
   - What headers need to be allowed?

2. **Cookie Handling:**
   - Do cookies work cross-origin if CORS is enabled?
   - Do we need special cookie configuration?

3. **Captcha Flow:**
   - Can captcha state be managed client-side?
   - Do we need server-side state management?

4. **Timeline:**
   - How long would CORS configuration take?
   - Is there a review/approval process?

5. **Alternatives:**
   - Do you have other integration methods?
   - Is there a different API endpoint for web apps?

---

## Conclusion

The best solution is to request CORS configuration from ByteCrtrs. This provides:
- True static deployment
- Best performance
- Lowest cost
- Simplest architecture

If ByteCrtrs cannot/will not enable CORS, serverless functions provide a good alternative that still allows "static" deployment (functions deploy with the site).

**Recommended Path Forward:**
1. Contact ByteCrtrs immediately (Option 1)
2. Implement serverless functions as backup (Option 2)
3. Test both approaches
4. Migrate based on ByteCrtrs response

---

**Document Version:** 1.0  
**Last Updated:** January 2025  
**Status:** Ready for Review
