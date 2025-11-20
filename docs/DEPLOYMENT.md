# Deployment Guide

## Overview

This React application is a **static site** that can be deployed to any static hosting service. The app makes API calls to a backend API (built by another department) - no server-side rendering or Node.js server is required for deployment.

## Pre-Deployment Checklist

- [ ] API endpoint URL is configured
- [ ] Environment variables are set
- [ ] Build is tested locally
- [ ] CORS is configured on the API server
- [ ] Production API is ready and accessible

## Build Process

### 1. Configure API URL

Create a `.env.production` file in the root directory:

```env
REACT_APP_API_URL=https://api.idlookup.ai/api/v1
```

Or set it as an environment variable:
```bash
export REACT_APP_API_URL=https://api.idlookup.ai/api/v1
```

### 2. Build the Application

```bash
npm install
npm run build
```

This creates an optimized production build in the `build/` directory.

### 3. Test the Build Locally

```bash
# Using a simple HTTP server
npx serve -s build

# Or using Python
python -m http.server 8000 -d build
```

Visit `http://localhost:8000` to verify the build works.

## Deployment Options

### Option 1: Netlify

1. **Via Netlify CLI:**
   ```bash
   npm install -g netlify-cli
   netlify login
   netlify deploy --prod --dir=build
   ```

2. **Via Netlify Dashboard:**
   - Connect your Git repository
   - Build command: `npm run build`
   - Publish directory: `build`
   - Environment variables: Add `REACT_APP_API_URL`

### Option 2: Vercel

1. **Via Vercel CLI:**
   ```bash
   npm install -g vercel
   vercel --prod
   ```

2. **Via Vercel Dashboard:**
   - Import your Git repository
   - Framework preset: Parcel
   - Build command: `npm run build`
   - Output directory: `build`
   - Environment variables: Add `REACT_APP_API_URL`

### Option 3: AWS S3 + CloudFront

1. **Build and upload:**
   ```bash
   npm run build
   aws s3 sync build/ s3://your-bucket-name --delete
   ```

2. **Configure CloudFront:**
   - Point to S3 bucket
   - Set default root object to `index.html`
   - Configure error pages (404 → `/index.html` for SPA routing)

### Option 4: GitHub Pages

1. **Install gh-pages:**
   ```bash
   npm install --save-dev gh-pages
   ```

2. **Add to package.json:**
   ```json
   "scripts": {
     "predeploy": "npm run build",
     "deploy": "gh-pages -d build"
   }
   ```

3. **Deploy:**
   ```bash
   npm run deploy
   ```

### Option 5: Any Static Hosting

Simply upload the contents of the `build/` directory to your hosting service.

**Important:** Ensure your hosting service:
- Serves `index.html` for all routes (SPA routing)
- Supports environment variables for API URL configuration
- Serves files with correct MIME types

## Environment Variables

The app uses the following environment variables:

- `REACT_APP_API_URL`: The base URL for the API (required for production)

Set these in your hosting platform's environment variable settings.

## API Configuration

### CORS Requirements

The production API server must:
- Allow requests from your frontend domain
- Include credentials in CORS headers
- Support preflight OPTIONS requests

Example CORS configuration (on API server):
```javascript
app.use(cors({
  origin: ['https://idlookup.ai', 'https://www.idlookup.ai'],
  credentials: true
}));
```

### API Endpoints

All API endpoints are documented in `API_SPECIFICATION.md`. Ensure the production API implements all required endpoints.

## Routing Configuration

Since this is a Single Page Application (SPA), configure your hosting service to:
- Serve `index.html` for all routes
- Not return 404 for routes that don't match files

**Netlify:** Create `public/_redirects`:
```
/*    /index.html   200
```

**Vercel:** Create `vercel.json`:
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

**Apache:** Create `.htaccess` in `build/`:
```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

**Nginx:** Configure:
```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

## Post-Deployment

1. **Verify API Connection:**
   - Test login functionality
   - Check browser console for CORS errors
   - Verify API calls are reaching the correct endpoint

2. **Monitor:**
   - Check error logs
   - Monitor API response times
   - Verify authentication flow

3. **Update Documentation:**
   - Update API specification if endpoints change
   - Document any deployment-specific configurations

## Troubleshooting

### Build Fails

- Check Node.js version (requires v14+)
- Clear `node_modules` and reinstall: `rm -rf node_modules && npm install`
- Check for syntax errors in code

### API Calls Fail in Production

- Verify `REACT_APP_API_URL` is set correctly
- Check CORS configuration on API server
- Verify API server is accessible from frontend domain
- Check browser console for errors

### Routing Doesn't Work

- Ensure SPA routing is configured (see Routing Configuration above)
- Verify `index.html` is served for all routes
- Check that React Router is configured correctly

### Environment Variables Not Working

- Ensure variables are prefixed with `REACT_APP_`
- Rebuild after changing environment variables
- Check that variables are set in hosting platform

## Security Considerations

1. **API Keys:** Never commit API keys or secrets to the repository
2. **Environment Variables:** Use hosting platform's environment variable system
3. **HTTPS:** Always use HTTPS in production
4. **CORS:** Configure CORS properly on API server
5. **Tokens:** JWT tokens are stored in memory (not localStorage) for security

## Support

For issues with:
- **Frontend:** Check this repository
- **API:** Contact the backend department
- **Deployment:** Check hosting platform documentation

