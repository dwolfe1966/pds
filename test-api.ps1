# Test API endpoints
Write-Host "Testing API Health Endpoint..." -ForegroundColor Green
try {
    $health = Invoke-RestMethod -Uri "http://localhost:3001/api/v1/health" -Method GET
    Write-Host "✓ Health check passed: $($health | ConvertTo-Json)" -ForegroundColor Green
} catch {
    Write-Host "✗ Health check failed: $_" -ForegroundColor Red
    exit 1
}

Write-Host "`nTesting Login Endpoint..." -ForegroundColor Green
$loginBody = @{
    email = "member@test.com"
    password = "password123"
} | ConvertTo-Json

try {
    $login = Invoke-RestMethod -Uri "http://localhost:3001/api/v1/login" -Method POST -Body $loginBody -ContentType "application/json"
    Write-Host "✓ Login successful!" -ForegroundColor Green
    Write-Host "  User: $($login.user.email)" -ForegroundColor Cyan
    Write-Host "  Role: $($login.user.role)" -ForegroundColor Cyan
    Write-Host "  Token received: $($login.accessToken.Substring(0, 20))..." -ForegroundColor Cyan
} catch {
    Write-Host "✗ Login failed: $_" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "  Response: $responseBody" -ForegroundColor Yellow
    }
}

Write-Host "`nTesting Search Endpoint..." -ForegroundColor Green
try {
    $search = Invoke-RestMethod -Uri "http://localhost:3001/api/v1/search?firstName=John&lastName=Doe" -Method GET
    Write-Host "✓ Search successful!" -ForegroundColor Green
    Write-Host "  Results: $($search.data.Count)" -ForegroundColor Cyan
    Write-Host "  Has more: $($search.pagination.hasMore)" -ForegroundColor Cyan
} catch {
    Write-Host "✗ Search failed: $_" -ForegroundColor Red
}

