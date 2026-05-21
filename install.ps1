# Master-ForexTrader-MCP — Full Install Script (Windows PowerShell)
# Installs: MCP server + slash commands + CLAUDE.md registration
# Usage: powershell -ExecutionPolicy Bypass -File install.ps1

Write-Host "=== Master-ForexTrader-MCP Installer ===" -ForegroundColor Cyan
Write-Host ""

# 1. Install dependencies
Write-Host "[1/4] Installing npm dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: npm install failed" -ForegroundColor Red; exit 1 }

# 2. Register MCP server
Write-Host "[2/4] Registering MCP server with Claude Code..." -ForegroundColor Yellow
$serverPath = Join-Path $PWD "src\server.js"
claude mcp add master-forextrader -- node $serverPath
if ($LASTEXITCODE -ne 0) { Write-Host "WARNING: MCP registration may have failed. Try manually: claude mcp add master-forextrader -- node `"$serverPath`"" -ForegroundColor Yellow }

# 3. Copy slash command skills
Write-Host "[3/4] Installing slash commands..." -ForegroundColor Yellow
$skillsDir = Join-Path $env:USERPROFILE ".claude\skills"

$skills = @("forex", "forex-signal", "forex-checklist", "forex-orderflow", "forex-vwap", "forex-risk", "forex-scan", "forex-journal", "forex-session")

foreach ($skill in $skills) {
    $destDir = Join-Path $skillsDir $skill
    New-Item -ItemType Directory -Force -Path $destDir | Out-Null
    Copy-Item "skills\$skill\SKILL.md" -Destination "$destDir\SKILL.md" -Force
}

Write-Host "    Installed: /forex, /forex-signal, /forex-checklist, /forex-orderflow," -ForegroundColor Green
Write-Host "              /forex-vwap, /forex-risk, /forex-scan, /forex-journal, /forex-session" -ForegroundColor Green

# 4. Add to CLAUDE.md
Write-Host "[4/4] Registering commands in CLAUDE.md..." -ForegroundColor Yellow
$claudeMd = Join-Path $env:USERPROFILE ".claude\CLAUDE.md"

if (-not (Test-Path $claudeMd)) {
    New-Item -ItemType File -Force -Path $claudeMd | Out-Null
}

$content = Get-Content $claudeMd -Raw -ErrorAction SilentlyContinue
if ($content -notmatch "forex \(Master-ForexTrader-MCP\)") {
    $block = @"

# forex (Master-ForexTrader-MCP)
- **forex** (``~/.claude/skills/forex/SKILL.md``) - Main orchestrator: quick status check. Trigger: ``/forex``
- **forex-signal** (``~/.claude/skills/forex-signal/SKILL.md``) - 7-gate BUY/SELL/WAIT. Trigger: ``/forex-signal``
- **forex-checklist** (``~/.claude/skills/forex-checklist/SKILL.md``) - 10-point institutional checklist. Trigger: ``/forex-checklist``
- **forex-orderflow** (``~/.claude/skills/forex-orderflow/SKILL.md``) - Order flow: delta, absorption, imbalance. Trigger: ``/forex-orderflow``
- **forex-vwap** (``~/.claude/skills/forex-vwap/SKILL.md``) - Anchored VWAP + bands. Trigger: ``/forex-vwap``
- **forex-risk** (``~/.claude/skills/forex-risk/SKILL.md``) - Position sizing & risk management. Trigger: ``/forex-risk``
- **forex-scan** (``~/.claude/skills/forex-scan/SKILL.md``) - Scan watchlist, rank A+ to D. Trigger: ``/forex-scan``
- **forex-journal** (``~/.claude/skills/forex-journal/SKILL.md``) - Journal stats, log, close. Trigger: ``/forex-journal``
- **forex-session** (``~/.claude/skills/forex-session/SKILL.md``) - Kill Zone status & countdown. Trigger: ``/forex-session``
When the user types any ``/forex`` command, invoke the Skill tool with the matching skill name before doing anything else.
"@
    Add-Content -Path $claudeMd -Value $block
    Write-Host "    Added forex commands to CLAUDE.md" -ForegroundColor Green
} else {
    Write-Host "    CLAUDE.md already has forex commands (skipped)" -ForegroundColor Green
}

Write-Host ""
Write-Host "=== INSTALLATION COMPLETE ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Available commands:" -ForegroundColor White
Write-Host "  /forex              Quick status (Kill Zone? Open trades?)"
Write-Host "  /forex-signal       7-gate BUY/SELL/WAIT"
Write-Host "  /forex-checklist    Full 10-point institutional checklist"
Write-Host "  /forex-orderflow    Delta, absorption, imbalance"
Write-Host "  /forex-vwap         Anchored VWAP + bands"
Write-Host "  /forex-risk         Position sizing"
Write-Host "  /forex-scan         Scan watchlist A+ to D"
Write-Host "  /forex-journal      Win rate, P&L, edge"
Write-Host "  /forex-session      Kill Zone status & countdown"
Write-Host ""
Write-Host "Telegram alerts: Create a .env file with:" -ForegroundColor Yellow
Write-Host "  TELEGRAM_BOT_TOKEN=your_token"
Write-Host "  TELEGRAM_CHAT_ID=your_chat_id"
Write-Host ""
Write-Host "Ready to trade. Open Claude Code and type /forex" -ForegroundColor Green
