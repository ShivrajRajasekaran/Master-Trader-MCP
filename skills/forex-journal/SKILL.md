# Forex Journal — Trading Performance & Edge Analysis

View trading stats, log trades, close trades, track your edge.

## What To Do

### Default (no arguments): Show stats
1. Run `trade_journal_stats`
2. Display:
   - Win rate, total P&L, profit factor
   - Current streak
   - Weekly P&L
   - Best session (London/NY AM/Silver Bullet)
   - Best symbol
   - Edge assessment

### If user says "log" or provides trade details:
1. Run `trade_journal_log` with the trade details
2. Confirm: logged, R:R, today's count, warnings

### If user says "close" or provides exit:
1. Run `trade_journal_close` with trade ID, exit price, result
2. Show updated stats

### If user says "open":
1. Run `trade_journal_open`
2. Show all open positions with unrealized status

## Key Stats To Highlight
- **Win Rate:** Target 60%+
- **Profit Factor:** Target 1.5+ (avg win / avg loss)
- **Edge:** GOOD RR / POSITIVE / NEEDS IMPROVEMENT
- **Streak:** If 3 losses → "STOP TRADING TODAY"
