# Forex Risk — Position Sizing & Risk Management

Calculate exact position size, SL, TP, and check daily limits.

## What To Do

1. Ask for (or use defaults):
   - Balance (default: use from memory — $25.60)
   - Risk % (default: 1%)
   - SL distance in pips
   - Symbol (default: XAUUSD)
2. Run `trade_risk_calc` with the values
3. Run `trade_daily_limit` to check if they can still trade today
4. Display:
   - **Lot Size:** Exact position size
   - **Dollar Risk:** How much they lose if SL hit
   - **TP Levels:** Using `trade_partial_tp` (30% @ 1.5R, 40% @ 2.5R, 30% @ 4R)
   - **R:R Ratio**
   - **Daily Status:** Trades taken / losses today
5. If daily limit hit, say STOP clearly
6. Optionally run `trade_money_management` for Kelly sizing and compounding plan

## Rules
- NEVER exceed 1% risk per trade
- NEVER exceed 3% daily loss
- If 3 losses in a row → STOP for today, halve risk tomorrow
- After TP1 hit → move SL to breakeven
