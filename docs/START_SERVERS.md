# How to Start the Servers

## Quick Start

### Option 1: Start Both Servers Together (Recommended)
```bash
npm run dev
```
This starts both the frontend (port 3000) and mock API server (port 3001) together.

### Option 2: Start Servers Separately

**Terminal 1 - Start Mock API Server:**
```bash
cd server
node index.js
```

You should see:
```
Mock API server running on http://localhost:3001
API base URL: http://localhost:3001/api/v1

Seed data loaded:
- Users: 22
- People: 100
- Searches: 200
- Alerts: X

Test credentials:
- Member: member@test.com / password123
- Admin: admin@test.com / admin123
```

**Terminal 2 - Start Frontend:**
```bash
npm start
```

Frontend will be available at: http://localhost:3000

## If Ports Are Already in Use

### Windows PowerShell
```powershell
# Find processes using ports
netstat -ano | findstr :3000
netstat -ano | findstr :3001

# Kill processes (replace PID with actual process ID)
taskkill /F /PID <PID>

# Or kill all Node processes
taskkill /F /IM node.exe
```

### Mac/Linux
```bash
# Find processes
lsof -i :3000
lsof -i :3001

# Kill processes
kill -9 <PID>
```

## Verify Servers Are Running

### Test API Server
Open in browser or use curl:
```
http://localhost:3001/api/v1/health
```

Should return:
```json
{"status":"ok","timestamp":"..."}
```

### Test Frontend
Open in browser:
```
http://localhost:3000
```

## Troubleshooting

### "Port already in use" Error
1. Kill the process using that port (see above)
2. Wait a few seconds
3. Try starting the server again

### "Cannot find module" Error
```bash
# Install dependencies
npm install
cd server && npm install && cd ..
```

### Server starts but endpoints don't work
1. Check server console for error messages
2. Verify seed data loaded (check server startup logs)
3. Test health endpoint first: `http://localhost:3001/api/v1/health`
4. Check browser console for CORS errors

### Frontend can't connect to API
1. Verify API server is running (test health endpoint)
2. Check API URL in `src/api.js` - should be `http://localhost:3001/api/v1`
3. Check browser Network tab for actual request URL
4. Verify CORS is configured on server

## Test Credentials

- **Member**: `member@test.com` / `password123`
- **Admin**: `admin@test.com` / `admin123`

These are pre-created in the seed data and should work immediately.

