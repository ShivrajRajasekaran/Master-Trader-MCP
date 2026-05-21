# Forex Signal — 7-Gate Entry System

Run the full 7-gate analysis for a trading signal.

## What To Do

1. Ask the user which pair (default XAUUSD) if not specified
2. Use `trade_session_check` first — if outside Kill Zone, say WAIT immediately
3. Get bar data from TradingView MCP if available, otherwise ask user to provide
4. Run `trade_signal` with the bar data
5. Display the full gate checklist:
   - Gate 1: Kill Zone
   - Gate 2: Kalman Trend
   - Gate 3: HTF Bias
   - Gate 4: Structure Event (BOS/CHoCH/CISD)
   - Gate 5: Liquidity Sweep
   - Gate 6: Institutional Zone (OB/FVG/OTE)
   - Gate 7: Trade Limits
6. Show final verdict: BUY / SELL / WAIT
7. If BUY/SELL: show entry, SL, TP, lot size, grade (A+/A/B+/B)
8. If WAIT: explain WHY and when to check again

## Rules
- NEVER give a signal outside Kill Zones
- NEVER trade ranging conditions
- Show ALL gates — don't hide failures
- If WAIT — say WAIT clearly. Don't sugarcoat.
