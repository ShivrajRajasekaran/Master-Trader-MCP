#!/bin/bash
# Master-ForexTrader-MCP — Full Install Script
# Installs: MCP server + slash commands + CLAUDE.md registration
# Usage: bash install.sh

set -e

echo "=== Master-ForexTrader-MCP Installer ==="
echo ""

# 1. Install dependencies
echo "[1/4] Installing npm dependencies..."
npm install

# 2. Register MCP server
echo "[2/4] Registering MCP server with Claude Code..."
claude mcp add master-forextrader -- node "$(pwd)/src/server.js"

# 3. Copy slash command skills
echo "[3/4] Installing slash commands..."
SKILLS_DIR="$HOME/.claude/skills"
mkdir -p "$SKILLS_DIR"

for skill in forex forex-signal forex-checklist forex-orderflow forex-vwap forex-risk forex-scan forex-journal forex-session; do
  mkdir -p "$SKILLS_DIR/$skill"
  cp "skills/$skill/SKILL.md" "$SKILLS_DIR/$skill/SKILL.md"
done

echo "    Installed: /forex, /forex-signal, /forex-checklist, /forex-orderflow,"
echo "              /forex-vwap, /forex-risk, /forex-scan, /forex-journal, /forex-session"

# 4. Add to CLAUDE.md
echo "[4/4] Registering commands in CLAUDE.md..."
CLAUDE_MD="$HOME/.claude/CLAUDE.md"

if [ ! -f "$CLAUDE_MD" ]; then
  touch "$CLAUDE_MD"
fi

if ! grep -q "forex (Master-ForexTrader-MCP)" "$CLAUDE_MD" 2>/dev/null; then
  cat >> "$CLAUDE_MD" << 'BLOCK'

# forex (Master-ForexTrader-MCP)
- **forex** (`~/.claude/skills/forex/SKILL.md`) - Main orchestrator: quick status check. Trigger: `/forex`
- **forex-signal** (`~/.claude/skills/forex-signal/SKILL.md`) - 7-gate BUY/SELL/WAIT. Trigger: `/forex-signal`
- **forex-checklist** (`~/.claude/skills/forex-checklist/SKILL.md`) - 10-point institutional checklist. Trigger: `/forex-checklist`
- **forex-orderflow** (`~/.claude/skills/forex-orderflow/SKILL.md`) - Order flow: delta, absorption, imbalance. Trigger: `/forex-orderflow`
- **forex-vwap** (`~/.claude/skills/forex-vwap/SKILL.md`) - Anchored VWAP + bands. Trigger: `/forex-vwap`
- **forex-risk** (`~/.claude/skills/forex-risk/SKILL.md`) - Position sizing & risk management. Trigger: `/forex-risk`
- **forex-scan** (`~/.claude/skills/forex-scan/SKILL.md`) - Scan watchlist, rank A+ to D. Trigger: `/forex-scan`
- **forex-journal** (`~/.claude/skills/forex-journal/SKILL.md`) - Journal stats, log, close. Trigger: `/forex-journal`
- **forex-session** (`~/.claude/skills/forex-session/SKILL.md`) - Kill Zone status & countdown. Trigger: `/forex-session`
When the user types any `/forex` command, invoke the Skill tool with the matching skill name before doing anything else.
BLOCK
  echo "    Added forex commands to CLAUDE.md"
else
  echo "    CLAUDE.md already has forex commands (skipped)"
fi

echo ""
echo "=== INSTALLATION COMPLETE ==="
echo ""
echo "Available commands:"
echo "  /forex              Quick status (Kill Zone? Open trades?)"
echo "  /forex-signal       7-gate BUY/SELL/WAIT"
echo "  /forex-checklist    Full 10-point institutional checklist"
echo "  /forex-orderflow    Delta, absorption, imbalance"
echo "  /forex-vwap         Anchored VWAP + bands"
echo "  /forex-risk         Position sizing"
echo "  /forex-scan         Scan watchlist A+ to D"
echo "  /forex-journal      Win rate, P&L, edge"
echo "  /forex-session      Kill Zone status & countdown"
echo ""
echo "Telegram alerts: Create a .env file with:"
echo "  TELEGRAM_BOT_TOKEN=your_token"
echo "  TELEGRAM_CHAT_ID=your_chat_id"
echo ""
echo "Ready to trade. Open Claude Code and type /forex"
