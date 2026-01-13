# Deployment Guide - New API Architecture

## Overview: What Changed

### Before (Mock API)
- **React App**: Deployed as static files to any static hosting (Netlify, Vercel, S3, etc.)
- **Mock API**: Only used for development, not needed in production
- **Deployment**: Single static site deployment

### Now (ByteCrtrs API)
- **React App**: Still deployed as static files
- **Proxy Server**: **REQUIRED** - Express.js server that must be deployed
- **Deployment**: **Two-part deployment** (static site + Node.js server)

## Why the Proxy Server is Required

The proxy server (`server/index.js`) is essential because it:

1. **Bypasses CORS**: The ByteCrtrs API doesn't allow direct browser requests from your domain
2. **Manages Cookies**: Stores API cookies server-side (browser can't store cross-origin cookies)
3. **Handles Captcha Flow**: Manages the captcha verification process
4. **Forwards Requests**: Acts as a middleman between your React app and ByteCrtrs API

**Without the proxy server, the app will not work in production.**

## Architecture

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│   React App     │  ──────> │  Proxy Server   │  ──────> │ ByteCrtrs API  │
│  (Static Site) │         │  (Express.js)    │         │  (External)    │
│                 │         │                  │         │                 │
│ - Netlify       │         │ - Heroku         │         │ - dev1.dev...  │
│ - Vercel        │         │ - Railway        │         │                 │
│ - S3/CloudFront │         │ - AWS EC2       │         │                 │
│ - etc.          │         │ - DigitalOcean   │         │                 │
└─────────────────┘         └──────────────────┘         └─────────────────┘
```

## Deployment Steps

### Step 1: Deploy the Proxy Server

The proxy server must be deployed to a Node.js hosting service. Choose one:

#### Option A: Heroku (Recommended for Simplicity)

1. **Install Heroku CLI:**
   ```bash
   npm install -g heroku
   heroku login
   ```

2. **Create Heroku App:**
   ```bash
   cd server
   heroku create idlookup-proxy
   ```

3. **Set Environment Variables:**
   ```bash
   heroku config:set EXTERNAL_API_URL=https://dev1.dev.www.bytecrtrs.com/api
   heroku config:set PORT=3001
   heroku config:set NODE_ENV=production
   ```

4. **Deploy:**
   ```bash
   git subtree push --prefix server heroku main
   # OR
   heroku git:remote -a idlookup-proxy
   git push heroku main
   ```

5. **Verify:**
   ```bash
   heroku logs --tail
   # Should see: "Server running on port 3001"
   ```

#### Option B: Railway

1. **Connect Repository:**
   - Go to [railway.app](https://railway.app)
   - New Project → Deploy from GitHub
   - Select your repository

2. **Configure:**
   - Root Directory: `server`
   - Build Command: `npm install`
   - Start Command: `npm start`

3. **Set Environment Variables:**
   ```
   EXTERNAL_API_URL=https://dev1.dev.www.bytecrtrs.com/api
   PORT=3001
   NODE_ENV=production
   ```

4. **Deploy:**
   - Railway auto-deploys on git push
   - Get the deployment URL (e.g., `https://idlookup-proxy.railway.app`)

#### Option C: AWS EC2 / Elastic Beanstalk

1. **Create EC2 Instance:**
   - Choose Node.js AMI or Ubuntu with Node.js
   - Security Group: Allow HTTP (80) and HTTPS (443)

2. **Deploy Code:**
   ```bash
   # On EC2 instance
   git clone your-repo
   cd server
   npm install
   npm start
   ```

3. **Use PM2 for Process Management:**
   ```bash
   npm install -g pm2
   pm2 start index.js --name proxy-server
   pm2 save
   pm2 startup
   ```

#### Option D: DigitalOcean App Platform

1. **Create App:**
   - New App → GitHub → Select repository
   - Type: Web Service
   - Root Directory: `server`

2. **Configure:**
   - Build Command: `npm install`
   - Run Command: `npm start`
   - Environment Variables: Set `EXTERNAL_API_URL`, `PORT`, `NODE_ENV`

### Step 2: Update React App Environment Variables

After deploying the proxy server, update your React app's environment variables:

**Create `.env.production` in the root directory:**

```env
# Enable proxy mode (REQUIRED)
REACT_APP_USE_API_PROXY=true

# Proxy server URL (your deployed proxy server)
REACT_APP_PROXY_URL=https://idlookup-proxy.herokuapp.com/api/proxy

# External API URL (used if proxy is disabled - not recommended)
REACT_APP_NEW_API_URL=https://dev1.dev.www.bytecrtrs.com/api

# Enable new API
REACT_APP_NEW_API_ENABLED=true

# Feature flags
REACT_APP_USE_NEW_API_SEARCH=true
REACT_APP_USE_NEW_API_REPORTS=false
REACT_APP_USE_NEW_API_OPTOUT=false
REACT_APP_USE_NEW_API_AUTH=false
```

**Or set in your hosting platform:**

- **Netlify**: Site Settings → Environment Variables
- **Vercel**: Project Settings → Environment Variables
- **AWS**: CloudFront/Amplify → Environment Variables

### Step 3: Update Proxy Server CORS Configuration

Update `server/index.js` to allow your production domain:

```javascript
app.use(cors({
  origin: [
    'http://localhost:3000',  // Development
    'http://localhost:3001',   // Development
    'https://idlookup.ai',     // Production
    'https://www.idlookup.ai'  // Production
  ],
  credentials: true,
  exposedHeaders: ['Set-Cookie']
}));
```

Also update the OPTIONS handler:

```javascript
app.options('/api/proxy/*', (req, res) => {
  const origin = req.headers.origin;
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://idlookup.ai',
    'https://www.idlookup.ai'
  ];
  
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    // ... rest of headers
  }
});
```

### Step 4: Build and Deploy React App

Build the React app with production environment variables:

```bash
npm install
npm run build
```

Deploy the `build/` directory to your static hosting:

- **Netlify**: `netlify deploy --prod --dir=build`
- **Vercel**: `vercel --prod`
- **S3**: `aws s3 sync build/ s3://your-bucket --delete`

## Production Considerations

### 1. Cookie Storage (IMPORTANT)

**Current Implementation:** Cookies are stored in an in-memory `Map`:
```javascript
const apiCookies = new Map();
const captchaData = new Map();
```

**Problem:** 
- Cookies are lost on server restart
- Won't work with multiple server instances (load balancing)
- Not shared across server instances

**Solutions:**

#### Option A: Use Redis (Recommended for Production)

```bash
npm install redis
```

```javascript
const redis = require('redis');
const client = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

// Replace Map with Redis
async function getCookies(sessionKey) {
  const data = await client.get(`cookies:${sessionKey}`);
  return data ? JSON.parse(data) : [];
}

async function setCookies(sessionKey, cookies) {
  await client.setEx(`cookies:${sessionKey}`, 3600, JSON.stringify(cookies));
}
```

#### Option B: Use Database

Store cookies in your database (PostgreSQL, MongoDB, etc.) with session management.

#### Option C: Single Server Instance

For small deployments, ensure only one server instance runs (no load balancing).

### 2. Session Management

**Current:** Sessions are based on origin:
```javascript
function getSessionKey(req) {
  const origin = req.headers.origin || 'http://localhost:3000';
  return `origin:${origin}`;
}
```

**Production Consideration:** 
- All users from the same origin share cookies (not ideal)
- Consider adding user identification if you have authentication

### 3. Error Handling and Logging

Add production logging:

```javascript
// Use a logging service (Winston, Pino, etc.)
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

// In proxy handler
catch (error) {
  logger.error('Proxy error', { error, url: req.url });
  // ...
}
```

### 4. Rate Limiting

Add rate limiting to prevent abuse:

```bash
npm install express-rate-limit
```

```javascript
const rateLimit = require('express-rate-limit');

const proxyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/proxy/*', proxyLimiter);
```

### 5. Security Headers

Add security headers:

```javascript
const helmet = require('helmet');
app.use(helmet());
```

### 6. Monitoring

Set up monitoring for the proxy server:
- **Uptime**: Pingdom, UptimeRobot
- **Logs**: Papertrail, Loggly, or hosting platform logs
- **Errors**: Sentry, Rollbar

## Environment Variables Reference

### Proxy Server (server/.env or hosting platform)

```env
# External API URL
EXTERNAL_API_URL=https://dev1.dev.www.bytecrtrs.com/api

# Server Port
PORT=3001

# Node Environment
NODE_ENV=production

# Redis (if using Redis for cookie storage)
REDIS_URL=redis://localhost:6379

# JWT Secrets (if using authentication endpoints)
JWT_SECRET=your-production-secret
JWT_REFRESH_SECRET=your-production-refresh-secret
```

### React App (.env.production or hosting platform)

```env
# Proxy Configuration
REACT_APP_USE_API_PROXY=true
REACT_APP_PROXY_URL=https://your-proxy-server.com/api/proxy

# API Configuration
REACT_APP_NEW_API_ENABLED=true
REACT_APP_NEW_API_URL=https://dev1.dev.www.bytecrtrs.com/api

# Feature Flags
REACT_APP_USE_NEW_API_SEARCH=true
REACT_APP_USE_NEW_API_REPORTS=false
REACT_APP_USE_NEW_API_OPTOUT=false
REACT_APP_USE_NEW_API_AUTH=false
```

## Testing Production Deployment

1. **Test Proxy Server:**
   ```bash
   curl https://your-proxy-server.com/api/proxy/captcha/verify?clientId=test&apiId=test
   ```

2. **Test React App:**
   - Visit your production site
   - Open browser DevTools → Network tab
   - Perform a search
   - Verify requests go to your proxy server (not directly to ByteCrtrs API)
   - Check for CORS errors in console

3. **Verify Cookies:**
   - Check that cookies are being set and forwarded
   - Verify captcha flow works

## Troubleshooting

### Proxy Server Not Responding

- Check server logs: `heroku logs --tail` (or equivalent)
- Verify environment variables are set
- Check server is running: `curl https://your-proxy-server.com/health`

### CORS Errors in Production

- Verify proxy server CORS allows your production domain
- Check `REACT_APP_PROXY_URL` is correct
- Verify proxy server is accessible from browser

### Cookies Not Working

- Check Redis/database connection (if using)
- Verify cookie forwarding logic in proxy
- Check browser console for cookie-related errors

### API Calls Failing

- Verify `EXTERNAL_API_URL` is correct
- Check proxy server logs for errors
- Verify ByteCrtrs API is accessible from proxy server

## Cost Considerations

### Static Hosting (React App)
- **Netlify**: Free tier (100GB bandwidth)
- **Vercel**: Free tier (100GB bandwidth)
- **S3 + CloudFront**: ~$0.50/month for small sites

### Proxy Server (Node.js)
- **Heroku**: $7/month (Hobby dyno)
- **Railway**: $5/month (Starter plan)
- **AWS EC2**: ~$5-10/month (t2.micro)
- **DigitalOcean**: $5/month (Basic droplet)

**Total Estimated Cost**: $10-15/month for small to medium traffic

## Summary

**Key Changes:**
1. ✅ React app still deploys as static files
2. ⚠️ **NEW**: Proxy server must be deployed separately
3. ⚠️ **NEW**: Two-part deployment (static site + Node.js server)
4. ⚠️ **NEW**: Environment variables must be configured for both
5. ⚠️ **NEW**: Cookie storage needs production solution (Redis recommended)

**Minimum Deployment:**
- React app → Static hosting (Netlify/Vercel/S3)
- Proxy server → Node.js hosting (Heroku/Railway/EC2)

**Recommended Production Setup:**
- React app → Netlify or Vercel
- Proxy server → Heroku or Railway
- Cookie storage → Redis (via Redis Cloud or Upstash)
