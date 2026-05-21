# Forex VWAP — Anchored Volume Weighted Average Price

Institutional dynamic support/resistance using Anchored VWAP.

## What To Do

1. Get OHLCV bars (full session data preferred)
2. Run `trade_vwap` with bars
3. Display:
   - **Session VWAP:** The volume-weighted average from session open
   - **Upper Band (+2 StdDev):** Overextended — reversal zone for shorts
   - **Lower Band (-2 StdDev):** Overextended — reversal zone for longs
   - **Price Position:** Premium (above VWAP) or Discount (below VWAP)
   - **Anchored VWAPs:** From swing high, swing low, or liquidity sweep
   - **Confluence:** Is price near VWAP or at bands?
4. Trading implication:
   - Price at VWAP = mean reversion zone (institutional entry point)
   - Price at upper band in downtrend = short entry zone
   - Price at lower band in uptrend = long entry zone
   - VWAP acts as magnet — price tends to return to it

## Key Concept
Institutions use VWAP to fill large orders. Price at VWAP = where the big boys are buying/selling. Trade WITH them, not against.
