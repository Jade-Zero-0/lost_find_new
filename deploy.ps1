# ============================================================
# AI Lost and Found - Deploy to Render Script
# ============================================================

$ErrorActionPreference = "Continue"
$ProjectDir = "D:\ai-lost-found"
$RepoName = "ai-lost-found"
$GitHubUser = "Jade-Zero-0"
$repoUrl = "https://github.com/$GitHubUser/$RepoName.git"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  AI Lost and Found - Deploy Script" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

# Set PATH
$env:Path = "D:\Program Files\Git\cmd;D:\Program Files\nodejs;D:\Program Files\GitHubCLI;" + $env:Path
Set-Location $ProjectDir

# Check tools
Write-Host ""
Write-Host "[Check] Verifying tools..." -ForegroundColor Yellow
git --version
node --version
npm.cmd --version

# 1. Install dependencies
Write-Host ""
Write-Host "[1/5] Installing dependencies..." -ForegroundColor Yellow
npm.cmd install 2>&1 | Select-Object -Last 3

# 2. Build frontend
Write-Host ""
Write-Host "[2/5] Building frontend..." -ForegroundColor Yellow
npm.cmd run build 2>&1 | Select-Object -Last 3

# 3. Git init
Write-Host ""
Write-Host "[3/5] Initializing Git..." -ForegroundColor Yellow
if (Test-Path ".git") {
    Remove-Item -Recurse -Force ".git"
}
git init
git config user.email "jade-zero-0@users.noreply.github.com"
git config user.name "Jade-Zero-0"
git add -A
$commitMsg = "Initial commit: AI Lost and Found platform for Render"
git commit -m $commitMsg

# 4. Push to GitHub
Write-Host ""
Write-Host "[4/5] Pushing to GitHub..." -ForegroundColor Yellow
git branch -M main
git remote add origin $repoUrl
git push -u origin main 2>&1

# 5. Done
Write-Host ""
Write-Host "[5/5] Done!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host "  Repo: $repoUrl" -ForegroundColor Green
Write-Host ""
Write-Host "  Now go to Render:" -ForegroundColor Cyan
Write-Host "  1. Open https://render.com" -ForegroundColor White
Write-Host "  2. Click New -> Web Service" -ForegroundColor White
Write-Host "  3. Select repo: $RepoName" -ForegroundColor White
Write-Host "  4. Click Create Web Service" -ForegroundColor White
Write-Host ""
Write-Host "  You will get a public URL!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
pause
