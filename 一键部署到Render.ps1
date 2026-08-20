# ============================================================
# AI寻物宝 - 一键部署到Render脚本
# ============================================================
# 使用方法：右键点击此文件 → 使用PowerShell运行
# 前提：已在GitHub上创建好空仓库 ai-lost-found
# ============================================================

$ErrorActionPreference = "Continue"
$ProjectDir = "D:\ai-lost-found"
$RepoName = "ai-lost-found"
$GitHubUser = "Jade-Zero-0"
$repoUrl = "https://github.com/$GitHubUser/$RepoName.git"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  AI寻物宝 一键部署脚本" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

# 设置PATH
$env:Path = "D:\Program Files\Git\cmd;D:\Program Files\nodejs;D:\Program Files\GitHubCLI;" + $env:Path
Set-Location $ProjectDir

# 检查Git
Write-Host "`n[环境检查]" -ForegroundColor Yellow
git --version
node --version

# 1. 安装依赖
Write-Host "`n[1/5] 安装项目依赖..." -ForegroundColor Yellow
npm.cmd install 2>&1 | Select-Object -Last 3

# 2. 构建前端
Write-Host "`n[2/5] 构建前端..." -ForegroundColor Yellow
npm.cmd run build 2>&1 | Select-Object -Last 3

# 3. Git初始化
Write-Host "`n[3/5] 初始化Git仓库..." -ForegroundColor Yellow
if (Test-Path ".git") {
    Remove-Item -Recurse -Force ".git"
}
git init
git config user.email "jade-zero-0@users.noreply.github.com"
git config user.name "Jade-Zero-0"
git add -A
git commit -m "Initial commit: AI Lost & Found platform for Render"

# 4. 推送到GitHub
Write-Host "`n[4/5] 推送到GitHub仓库 $RepoName ..." -ForegroundColor Yellow
git branch -M main
git remote add origin $repoUrl
Write-Host "请在弹出的窗口中输入你的GitHub用户名和密码/Token" -ForegroundColor Cyan
git push -u origin main 2>&1

# 5. 完成
Write-Host "`n[5/5] 推送完成！" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host "  代码仓库: $repoUrl" -ForegroundColor Green
Write-Host ""
Write-Host "  👉 接下来去Render创建服务：" -ForegroundColor Cyan
Write-Host "  1. 打开 https://render.com" -ForegroundColor White
Write-Host "  2. 登录后点击 [New] → [Web Service]" -ForegroundColor White
Write-Host "  3. 选择仓库 $RepoName" -ForegroundColor White
Write-Host "  4. Build Command: npm install && npm run build" -ForegroundColor White
Write-Host "  5. Start Command: npm start" -ForegroundColor White
Write-Host "  6. 点击 [Create Web Service]" -ForegroundColor White
Write-Host ""
Write-Host "  部署完成后你将获得公网访问链接！" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
pause