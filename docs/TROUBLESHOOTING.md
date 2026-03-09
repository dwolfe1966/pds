# Troubleshooting Guide

## Server Not Starting

### Check if server is running
```bash
# Windows
netstat -ano | findstr :3001

# Mac/Linux
lsof -i :3001
```

### Start the server
```bash
cd server
npm install  # if not already done
node index.js
```

You should see:
```
Mock API server running on http://localhost:3001
API base URL: http://localhost:3001/api/v1

Seed data loaded:
- Users: 22
- People: 100
...
```

## Login Not Working (500 Error)

### Check server logs
Look for error messages in the server console when you try to login.

### Verify test credentials
- **Member**: `member@test.com` / `password123`
- **Admin**: `admin@test.com` / `admin123`

### Common issues:
1. **Server not running** - Start the server first
2. **Port conflict** - Check if port 3001 is available
3. **Seed data not loaded** - Check server startup logs
4. **CORS error** - Verify CORS is configured for `http://localhost:3000`

### Test the login endpoint directly:
```bash
# Using PowerShell (escape quotes properly)
curl -Method POST -Uri "http://localhost:3001/api/v1/login" -ContentType "application/json" -Body '{"email":"member@test.com","password":"password123"}'
```

## ByteCrtrs Search 500 Error

Search uses ByteCrtrs API (no mock fallback). When you get a 500:

### 1. Check server terminal
The proxy logs the full ByteCrtrs response. Look for:
```
[Proxy] 500 Error from ByteCrtrs API
[Proxy] Response data (full): {...}
```

### 2. Common causes
- **Captcha/session** – ByteCrtrs may require captcha verification. Proxy warms up cookies for teaser search; ensure `CAPTCHA_PASS=bcEdgeApiPass` (or your dev pass) is set.
- **API availability** – ByteCrtrs dev API may be down or rate-limited.
- **Request format** – Verify `searchContextKey`, `fName`, `lName`, `state`, etc. match the API spec.

### 3. Browser console
Errors include `apiResponse` with the ByteCrtrs error body. Inspect `err.apiResponse` in the console.

### 4. Test ByteCrtrs directly
```bash
# Via proxy (from project root)
curl -X POST "http://localhost:3001/api/proxy/idLookup/teaser/search?clientId=test123&apiId=test456" \
  -H "Content-Type: application/json" \
  -H "X-Captcha-Pass: bcEdgeApiPass" \
  -d '{"type":"name","fName":"John","lName":"Doe","state":"CA","searchContextKey":"sale.name.teaser","perPage":20}'
```

---

## Search Not Returning Results (Mock API)

### Check the search endpoint
```bash
# Test search endpoint
curl "http://localhost:3001/api/v1/search?firstName=John&lastName=Doe"
```

### Verify seed data
The server should have 100 people records. Check server startup logs.

### Check browser console
- Look for CORS errors
- Check network tab for API calls
- Verify API URL is correct (`http://localhost:3001/api/v1`)

## Port Already in Use

### Frontend (port 3000)
```bash
# Kill process on port 3000
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Or use a different port
npm start -- --port 3002
```

### Backend (port 3001)
```bash
# Kill process on port 3001
# Windows
netstat -ano | findstr :3001
taskkill /PID <PID> /F

# Or use a different port
PORT=3002 node server/index.js
```

## CORS Errors

If you see CORS errors in the browser console:

1. **Verify server CORS config** - Should allow `http://localhost:3000`
2. **Check API URL** - Should be `http://localhost:3001/api/v1`
3. **Restart both servers** - Frontend and backend

## API Connection Issues

### Verify API is accessible
```bash
# Health check
curl http://localhost:3001/api/v1/health
```

Should return:
```json
{"status":"ok","timestamp":"..."}
```

### Check API URL in frontend
In `src/api.js`, the BASE_URL should be:
```javascript
const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api/v1';
```

### Network tab debugging
1. Open browser DevTools → Network tab
2. Try to login or search
3. Check the request:
   - URL should be `http://localhost:3001/api/v1/...`
   - Status should be 200 (not 500 or CORS error)
   - Check Response tab for error details

## Common Error Messages

### "Request failed"
- Server might not be running
- Check server console for errors
- Verify API URL is correct

### "Invalid email or password"
- Use test credentials: `member@test.com` / `password123`
- Check server logs to see if user exists

### "Email not verified"
- Test users should be pre-verified in seed data
- If you created a new user, verify email first

### 500 Internal Server Error
- Check server console for error stack trace
- Verify all dependencies are installed: `cd server && npm install`
- Check that seed data loaded successfully

## Reset Everything

If nothing works, try a complete reset:

```bash
# Stop all Node processes
# Windows
taskkill /F /IM node.exe

# Clean everything
Remove-Item -Recurse -Force node_modules, server/node_modules, dist, .parcel-cache, build -ErrorAction SilentlyContinue

# Reinstall
npm install
cd server && npm install && cd ..

# Start fresh
npm run dev
```

## Still Having Issues?

1. Check server console for error messages
2. Check browser console for JavaScript errors
3. Check browser Network tab for API request/response details
4. Verify both frontend (port 3000) and backend (port 3001) are running
5. Try the health check endpoint: `http://localhost:3001/api/v1/health`

