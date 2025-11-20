# Script to kill processes on ports 3000 and 3001
Write-Host "Killing processes on ports 3000 and 3001..." -ForegroundColor Yellow

# Kill port 3000
$port3000 = netstat -ano | findstr ":3000" | findstr LISTENING
if ($port3000) {
    $pid = ($port3000 -split '\s+')[-1]
    Write-Host "Killing process $pid on port 3000" -ForegroundColor Cyan
    taskkill /F /PID $pid 2>$null
}

# Kill port 3001
$port3001 = netstat -ano | findstr ":3001" | findstr LISTENING
if ($port3001) {
    $pid = ($port3001 -split '\s+')[-1]
    Write-Host "Killing process $pid on port 3001" -ForegroundColor Cyan
    taskkill /F /PID $pid 2>$null
}

# Kill all Node processes (nuclear option)
Write-Host "`nKilling all Node.js processes..." -ForegroundColor Yellow
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

Start-Sleep -Seconds 2

# Verify ports are free
Write-Host "`nChecking ports..." -ForegroundColor Yellow
$check3000 = netstat -ano | findstr ":3000" | findstr LISTENING
$check3001 = netstat -ano | findstr ":3001" | findstr LISTENING

if (-not $check3000 -and -not $check3001) {
    Write-Host "Ports 3000 and 3001 are now free!" -ForegroundColor Green
    Write-Host "You can now run: npm run dev" -ForegroundColor Cyan
} else {
    Write-Host "Some ports may still be in use. Wait a few seconds and try again." -ForegroundColor Yellow
}

