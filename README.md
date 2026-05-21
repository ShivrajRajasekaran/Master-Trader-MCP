# Master Trader MCP

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![MCP](https://img.shields.io/badge/MCP-Compatible-blue)](https://modelcontextprotocol.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Institutional-grade forex & gold trading analysis server for [Claude Code](https://claude.ai/code). Full SMC/ICT framework with a 7-gate entry system — no signal fires unless all conditions align.

---

## Quick Start

```bash
git clone https://github.com/ShivrajRajasekaran/Master-Trader-MCP.git
cd Master-Trader-MCP
npm install
```

**Add to Claude Code:**

```bash
claude mcp add master-trader node /absolute/path/to/Master-Trader-MCP/src/server.js
```

**Verify:**

```bash
npm test   # 24 tests, all passing
```

---

## How It Works

```
┌─────────────────────────────────────────────────────────┐
│                    CLAUDE CODE                           │
│                                                         │
│   "Should I trade XAUUSD right now?"                    │
│                        │                                │
│                        ▼                                │
│   ┌─────────────────────────────────────┐               │
│   │       MASTER TRADER MCP             │               │
│   │                                     │               │
│   │   Gate 1: Kill Zone         [PASS]  │               │
│   │   Gate 2: Kalman Trend      [PASS]  │               │
│   │   Gate 3: HTF Bias          [PASS]  │               │
│   │   Gate 4: Structure (CISD)  [PASS]  │               │
│   │   Gate 5: Liquidity Sweep   [PASS]  │               │
│   │   Gate 6: OB/FVG/OTE Zone   [PASS]  │               │
│   │   Gate 7: Trade Limits      [PASS]  │               │
│   │                                     │               │
│   │   → SELL SHORT @ 3242.50           │               │
│   │     SL: 3248.20 | TP: 3231.10     │               │
│   │     Grade: A+ | RR: 1:2.0          │               │
│   └─────────────────────────────────────┘               │
└─────────────────────────────────────────────────────────┘
```

---

## Tools (17 total)

### Signal & Analysis

| Tool | Purpose |
|------|---------|
| `trade_signal` | Full 7-gate system → BUY / SELL / WAIT with grade (A+ to B) |
| `trade_analyze` | Complete market breakdown (structure, OBs, FVGs, OTE, Kalman, AMD) |
| `trade_htf_bias` | Higher timeframe direction (4H / Daily) |
| `trade_scanner` | Score multiple pairs → ranked A+ to D |
| `trade_confirmation` | Entry confirmation: candle patterns, zone status, divergence, Judas Swing, news |
| `trade_mtf_check` | Multi-timeframe alignment (HTF + ITF + LTF) |

### Session & Timing

| Tool | Purpose |
|------|---------|
| `trade_session_check` | Kill Zone status + macro window + quarterly phase |
| `trade_next_killzone` | Countdown to next tradeable window |

### Levels & Targets

| Tool | Purpose |
|------|---------|
| `trade_key_levels` | PDH/PDL, PWH/PWL, Asia/London/NY ranges, EQH/EQL, POC |
| `trade_dol` | Draw on Liquidity — most probable TP target |
| `trade_fib_extensions` | Fibonacci extension TP targets (-27%, -62%, -100%) |

### Risk & Management

| Tool | Purpose |
|------|---------|
| `trade_risk_calc` | Position size from balance + risk% + SL distance |
| `trade_partial_tp` | Partial TP levels (30% / 40% / 30% at 1.5R / 2.5R / 4R) |
| `trade_daily_limit` | Daily loss & trade count check |
| `trade_money_management` | Kelly Criterion, compounding, drawdown recovery plan |

### Journal

| Tool | Purpose |
|------|---------|
| `trade_journal_log` | Record trade entry |
| `trade_journal_close` | Close with result (win/loss/BE) |
| `trade_journal_stats` | Win rate, streak, total P&L |

---

## The 7-Gate Entry System

Every signal must pass through these gates sequentially:

| # | Gate | Logic |
|---|------|-------|
| 1 | **Kill Zone** | London 2-5AM, NY AM 9:30-11AM, Silver Bullet 10-11AM, NY PM 1:30-3PM EST |
| 2 | **Kalman Trend** | Kalman Filter + Supertrend confirms trending (rejects ranging) |
| 3 | **HTF Bias** | 4H/Daily structure agrees (HH/HL = Bullish, LH/LL = Bearish) |
| 4 | **Structure Event** | BOS, CHoCH, or CISD detected on LTF |
| 5 | **Liquidity Sweep** | BSL or SSL swept within last 10 bars |
| 6 | **Institutional Zone** | Price at displacement-validated OB, FVG, or inside OTE (61.8-78.6%) |
| 7 | **Trade Limits** | Under 3 trades/day + 20-bar cooldown clear |

**Sensitivity modes:**
- Conservative — 7/7 gates required
- Balanced — 6/7 minimum
- Aggressive — 5/7 minimum

---

## Engines (17 total)

| Engine | Concepts |
|--------|----------|
| `kalman-filter.js` | Kalman Filter, Supertrend, ATR, WMA, trending vs ranging |
| `kill-zones.js` | ICT Kill Zones, session pivots, avoid zones |
| `structure.js` | Swing detection, BOS, CHoCH, CISD, CRT, HTF bias |
| `liquidity.js` | Order Blocks (displacement-validated), FVGs, OTE, sweeps |
| `amd.js` | AMD state machine — Accumulation/Manipulation/Distribution |
| `volume.js` | Volume profile, POC/VAH/VAL, exhaustion, displacement confirmation |
| `patterns.js` | Wyckoff Spring/UTAD, Breaker Blocks, Inducement |
| `levels.js` | PDH/PDL, PWH/PWL, session ranges, EQH/EQL |
| `time.js` | Quarterly Theory, Macro Windows (xx:50-xx:10), Silver Bullet |
| `candles.js` | Engulfing, Pin Bar, Hammer, Doji, Morning/Evening Star |
| `mitigation.js` | Zone lifecycle: FRESH → TESTED → MITIGATED → BROKEN |
| `blocks.js` | Rejection Blocks, Propulsion Blocks, Fib Extensions, Liquidity Voids |
| `mtf.js` | Multi-timeframe alignment (HTF direction + ITF structure + LTF entry) |
| `divergence.js` | Price/volume divergence, momentum divergence, hidden divergence |
| `sessions.js` | Session liquidity tracking, Asian Breakout, Judas Swing |
| `news.js` | High-impact event filter (NFP, FOMC, CPI, ECB, BOE) |
| `money.js` | Kelly Criterion, compounding, drawdown recovery, streak rules |

---

## Kill Zone Schedule

| Session | EST | IST | Role |
|---------|-----|-----|------|
| London KZ | 2:00 - 5:00 AM | 12:30 - 3:30 PM | Manipulation (sweeps Asia) |
| NY AM KZ | 9:30 - 11:00 AM | 8:00 - 9:30 PM | Distribution (real move) |
| Silver Bullet | 10:00 - 11:00 AM | 8:30 - 9:30 PM | Single FVG sniper entry |
| NY PM KZ | 1:30 - 3:00 PM | 12:00 - 1:30 AM | Continuation |

**Avoid:** Asian session (mark range only), NY Lunch (12-1:30 PM), Post-3 PM.

---

## Risk Rules

| Rule | Value |
|------|-------|
| Risk per trade | 1% of balance |
| Max daily loss | -3% → stop |
| Max weekly loss | -5% |
| Max trades/day | 3 |
| Signal cooldown | 20 bars |
| After TP1 | Move SL to breakeven |
| Partial TP | 30% @ 1.5R, 40% @ 2.5R, 30% trail @ 4R |

---

## Python Data Science Layer

For backtesting, Monte Carlo simulation, and statistical validation:

```bash
cd python
pip install -r requirements.txt

# Backtest the 7-gate system
python backtest.py --data ../data/XAUUSD_5M.csv --risk 1 --mode balanced --rr 2

# Monte Carlo (account survival probability)
python statistics.py --monte-carlo --balance 25 --risk 1 --winrate 55 --rr 2

# Generate equity curve charts
python equity_curve.py --data backtest_results.json --output charts/
```

| Script | What It Does |
|--------|-------------|
| `backtest.py` | Full 7-gate simulation on historical data → win rate, profit factor, Sharpe |
| `statistics.py` | Monte Carlo, edge validation (t-test), distribution analysis, correlation |
| `equity_curve.py` | Professional equity curve, drawdown, monthly returns, P&L distribution |

---

## Architecture

```
src/
├── server.js              MCP server entry (stdio transport)
├── index.js               Library exports (all engines)
├── engine/                Pure analysis engines (17 files, no I/O)
│   ├── kalman-filter.js   Trend detection
│   ├── kill-zones.js      Session timing
│   ├── structure.js       BOS, CHoCH, CISD, CRT
│   ├── liquidity.js       OBs, FVGs, OTE, sweeps
│   ├── amd.js             AMD state machine
│   ├── volume.js          Volume profile, POC
│   ├── patterns.js        Wyckoff, Breakers, Inducement
│   ├── levels.js          PDH/PDL, PWH/PWL, EQH/EQL
│   ├── time.js            Quarterly, Macro, Silver Bullet
│   ├── candles.js         Engulfing, Pin Bar, Hammer, Doji
│   ├── mitigation.js      Zone lifecycle tracking
│   ├── blocks.js          Rejection, Propulsion, Voids
│   ├── mtf.js             Multi-timeframe alignment
│   ├── divergence.js      Price/volume divergence
│   ├── sessions.js        Session liquidity, Judas Swing
│   ├── news.js            Event filter
│   └── money.js           Kelly, compounding, recovery
├── gates/
│   └── entry-gates.js     7-gate orchestrator
└── tools/                 MCP tool registrations (8 files, 17 tools)
    ├── analysis.js
    ├── signal.js
    ├── risk.js
    ├── session.js
    ├── scanner.js
    ├── journal.js
    ├── levels.js
    └── confirmation.js
tests/
└── engines.test.js        24 tests
python/
├── backtest.py            7-gate backtester
├── statistics.py          Monte Carlo, edge validation
├── equity_curve.py        Chart generation
└── requirements.txt
```

---

## Works With

- **Claude Code** — as the AI layer that calls tools
- **TradingView Desktop** — via CDP (port 9222) for live chart data
- **Any broker** — that connects through TradingView's trading panel

---

## License

MIT

---

Built by [ShivrajRajasekaran](https://github.com/ShivrajRajasekaran) — based on ICT/SMC methodology with Kalman Filter trend detection from AlgoAlpha.
