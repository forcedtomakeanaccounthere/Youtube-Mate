# PowerShell script to prepare cookies for production deployment
Write-Host "🍪 Preparing cookies for production deployment..." -ForegroundColor Green

# Check if cookies file exists locally
$cookiesPath = "backend\www.youtube.com_cookies.txt"
if (!(Test-Path $cookiesPath)) {
    Write-Host "❌ Cookies file not found at $cookiesPath" -ForegroundColor Red
    Write-Host "   Please export cookies from your browser first" -ForegroundColor Yellow
    exit 1
}

# Create base64 encoded version for environment variable
Write-Host "📦 Creating base64 encoded cookies..." -ForegroundColor Blue
$cookiesContent = Get-Content $cookiesPath -Raw
$cookiesBytes = [System.Text.Encoding]::UTF8.GetBytes($cookiesContent)
$cookiesBase64 = [System.Convert]::ToBase64String($cookiesBytes)

Write-Host "✅ Cookies prepared successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "🔧 Add this environment variable to your Render dashboard:" -ForegroundColor Cyan
Write-Host "   Variable Name: YOUTUBE_COOKIES_BASE64" -ForegroundColor White
Write-Host "   Variable Value: $cookiesBase64" -ForegroundColor White
Write-Host ""
Write-Host "💡 The backend will automatically decode and use these cookies in production." -ForegroundColor Yellow

# Also save to a file for easy copying
$cookiesBase64 | Out-File -FilePath "cookies_base64.txt" -Encoding UTF8
Write-Host "📄 Base64 cookies also saved to: cookies_base64.txt" -ForegroundColor Magenta
