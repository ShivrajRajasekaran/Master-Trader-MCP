# Forex Order Flow — Who's In Control

Analyze order flow: delta, cumulative delta, imbalance, absorption, exhaustion.

## What To Do

1. Get OHLCV bar data (20+ bars, volume required)
2. Run `trade_orderflow` with the bars
3. Present clearly:
   - **Delta:** Current bar buy vs sell pressure
   - **Cumulative Delta:** Who's winning overall (buyers/sellers)
   - **Imbalance:** Any 3:1+ ratio bars (aggressive buyers/sellers)
   - **Absorption:** High volume + small body = opposite side being absorbed
   - **Exhaustion:** Spike volume + reversal candle = move done
   - **Divergence:** Price up but delta down (or vice versa) = hidden weakness
4. Give a clear verdict: "Buyers in control" / "Sellers in control" / "Absorption — reversal likely"
5. Confidence percentage

## How To Interpret
- Positive cumulative delta + price rising = strong trend, ride it
- Negative delta divergence = smart money distributing, exit soon
- Absorption = big players soaking up the move, reversal coming
- Exhaustion = last gasp, trend about to flip
