# Forex Checklist — 10-Point Institutional Validation

Run the FULL 10-point institutional entry checklist. This is the MASTER validation.

## What To Do

1. Get bar data (LTF 5M/15M 50+ bars minimum)
2. Optionally get HTF bars (4H/Daily), ITF bars (1H), DXY bars, Daily bars
3. Run `trade_checklist_10` with all available data
4. Display the full checklist clearly:

```
[PASS/FAIL] Gate 1: Macro Bias (DXY)
[PASS/FAIL] Gate 2: 3 TF Aligned (HTF+ITF+LTF)
[PASS/FAIL] Gate 3: Liquidity Sweep (BSL/SSL)
[PASS/FAIL] Gate 4: At Institutional Zone (OB/FVG/OTE)
[PASS/FAIL] Gate 5: AMD Model (Manipulation/Distribution)
[PASS/FAIL] Gate 6: CHoCH/CISD on LTF
[PASS/FAIL] Gate 7: Indicator Confluence (6+/8)
[PASS/FAIL] Gate 8: Candlestick Confirmation
[PASS/FAIL] Gate 9: Inside Kill Zone
[PASS/FAIL] Gate 10: DOL Identified (TP Target)

SCORE: X/10 → VERDICT
```

5. Final verdict:
   - Below 6: NO TRADE — explain what's missing
   - 6-7: STANDARD SIZE — show entry/SL/TP
   - 8+: MAXIMUM SIZE (A+ setup) — show entry/SL/TP with emphasis

## Rules
- MINIMUM 6/10 to recommend any trade
- Always show ALL 10 gates
- If score < 6, be clear: "DO NOT TRADE"
- Never hide failed gates
