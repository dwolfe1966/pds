# How to Restart Servers

## Quick Fix for Port Already in Use

### Option 1: Use the Kill Script (Easiest)
```powershell
.\kill-ports.ps1
```

Then restart:
```bash
npm run dev
```

### Option 2: Manual Kill
```powershell
# Kill all Node processes
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force

# Wait a moment
Start-Sleep -Seconds 2

# Then restart
npm run dev
```

### Option 3: Kill Specific Ports
```powershell
# Find and kill port 3001
netstat -ano | findstr :3001
taskkill /F /PID <PID_NUMBER>

# Find and kill port 3000
netstat -ano | findstr :3000
taskkill /F /PID <PID_NUMBER>

# Then restart
npm run dev
```

## After Restarting

1. **Check server console** - You should see:
   ```
   Loading seed data...
   Seed data loaded successfully
   - Users: 22
   - People: 100
   Mock API server running on http://localhost:3001
   ```

2. **Test login** with:
   - Email: `member@test.com`
   - Password: `password123`

3. **The login error should be fixed** - The `refreshTokens` Map issue has been resolved.

## If Ports Still Won't Free

1. Close all terminal windows
2. Open a new terminal
3. Run `.\kill-ports.ps1`
4. Wait 5 seconds
5. Run `npm run dev`

## Verify Servers Are Running

- Frontend: http://localhost:3000
- API Health: http://localhost:3001/api/v1/health

Both should respond without errors.

