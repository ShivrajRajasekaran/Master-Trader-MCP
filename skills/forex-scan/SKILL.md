# Forex Scan — Watchlist Scanner

Scan multiple pairs and rank them by setup quality.

## What To Do

1. First run `trade_watchlist_status` — if outside Kill Zone, say WAIT
2. If ready, run `trade_auto_scan` or `trade_scanner` with pair data
3. Default watchlist: XAUUSD, EURUSD, GBPUSD, USDJPY, GBPJPY, AUDUSD, NZDUSD
4. Rank results A+ to D:
   - **A+ (9-10/10):** Maximum size — rare, take it immediately
   - **A (8/10):** Maximum size — strong setup
   - **B+ (7/10):** Standard size — good enough
   - **B (6/10):** Standard size — minimum threshold
   - **C-D (below 6):** NO TRADE
5. Show top 3 picks with direction, score, and key reason
6. If nothing qualifies: "No setups. WAIT. Patience is the edge."

## Rules
- Only scan during Kill Zones
- Don't force a trade — if nothing scores 6+, say WAIT
- Max 3 trades per day regardless of how many setups form
