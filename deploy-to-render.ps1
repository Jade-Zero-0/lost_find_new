# ============================================================
# AI寻物宝 - 一键部署到Render脚本
# ============================================================
# 使用方法：右键点击此文件 → 使用PowerShell运行
# 注意：请先在GitHub上创建好空仓库 ai-lost-found
# ============================================================

$ErrorActionPreference = "Continue"
$ProjectDir = "D:\ai-lost-found"
$RepoName = "ai-lost-found"
$GitHubUser = "Jade-Zero-0"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  AI寻物宝 一键部署脚本" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

# 1. 设置PATH
$env:Path = "D:\Program Files\Git\cmd;D:\Program Files\nodejs;D:\Program Files\GitHubCLI;" + $env:Path
Set-Location $ProjectDir

# 2. 检查GitHub登录状态
Write-Host "`n[检查] 验证GitHub登录状态..." -ForegroundColor Yellow
gh auth status 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "请先在浏览器中完成GitHub登录！" -ForegroundColor Red
    gh auth login -p https -h github.com -w
    Write-Host "登录完成后请重新运行此脚本！" -ForegroundColor Red
    pause
    exit 1
}
Write-Host "GitHub已登录 ✓" -ForegroundColor Green

# 3. 创建或确认GitHub仓库
Write-Host "`n[1/5] 创建GitHub仓库 $RepoName ..." -ForegroundColor Yellow
gh repo create "$GitHubUser/$RepoName" --public --description "AI寻物宝 - 校园智能失物招领平台" --source="$ProjectDir" --remote=origin --push 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "创建仓库失败，可能已存在。继续推送到已有仓库..." -ForegroundColor Yellow
    git remote remove origin 2>$null
    git remote add origin "https://github.com/$GitHubUser/$RepoName.git"
}

# 4. 安装依赖
Write-Host "`n[2/5] 安装项目依赖..." -ForegroundColor Yellow
npm.cmd install 2>&1 | Select-Object -Last 3

# 5. 构建前端
Write-Host "`n[3/5] 构建前端..." -ForegroundColor Yellow
npm.cmd run build 2>&1 | Select-Object -Last 3

# 6. Git提交
Write-Host "`n[4/5] 提交并推送到GitHub..." -ForegroundColor Yellow
git add -A
git commit -m "Initial commit: AI Lost & Found platform for Render" --allow-empty 2>&1
git branch -M main
git push -u origin main --force 2>&1

# 7. 完成
Write-Host "`n[5/5] 完成！" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host "  ✓ 代码已推送到GitHub" -ForegroundColor Green
Write-Host "  仓库: https://github.com/$GitHubUser/$RepoName" -ForegroundColor Green
Write-Host ""
Write-Host "  👉 现在去Render部署：" -ForegroundColor Cyan
Write-Host "  1. 打开 https://render.com" -ForegroundColor White
Write-Host "  2. 点击 [New] → [Web Service]" -ForegroundColor White
Write-Host "  3. 选择你的GitHub仓库 $RepoName" -ForegroundColor White
Write-Host "  4. 保持默认设置（render.yaml会自动配置）" -ForegroundColor White
Write-Host "  5. 点击 [Create Web Service]" -ForegroundColor White
Write-Host ""
Write-Host "  部署完成后你将获得公网访问链接！" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
pause