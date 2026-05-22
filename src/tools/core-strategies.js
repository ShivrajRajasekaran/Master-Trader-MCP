import { z } from "zod";
import { analyzeTrendFollowing } from "../engine/trend-following.js";
import { analyzeRangeTrading } from "../engine/range-trading.js";
import { analyzeBreakout } from "../engine/breakout-trading.js";

export function registerCoreStrategyTools(server) {
  server.tool(
    "trade_trend_following",
    "Trend Following strategy — identifies pullback entries in confirmed trends using EMA stack alignment, ADX strength, and momentum resumption. Best for trending markets (ADX > 25).",
    {
      bars: z.string().describe("JSON array of OHLCV bars. Minimum 200 bars for full EMA stack."),
      config: z.string().optional().describe("JSON config: {emaFast, emaMid, emaSlow, adxThreshold, atrMultiplier}"),
    },
    async ({ bars: barsJson, config: configJson }) => {
      try {
        const bars = JSON.parse(barsJson);
        const config = configJson ? JSON.parse(configJson) : {};
        const result = analyzeTrendFollowing(bars, config);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text", text: JSON.stringify({ error: e.message }) }] };
      }
    }
  );

  server.tool(
    "trade_range_trading",
    "Range Trading strategy — detects sideways markets and trades mean reversion at S/R boundaries. Buy at support, sell at resistance with strict breakout exit rules. Best when ADX < 25.",
    {
      bars: z.string().describe("JSON array of OHLCV bars. Minimum 50 bars for range detection."),
      config: z.string().optional().describe("JSON config: {lookback, adxThreshold, bounceConfirmation}"),
    },
    async ({ bars: barsJson, config: configJson }) => {
      try {
        const bars = JSON.parse(barsJson);
        const config = configJson ? JSON.parse(configJson) : {};
        const result = analyzeRangeTrading(bars, config);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text", text: JSON.stringify({ error: e.message }) }] };
      }
    }
  );

  server.tool(
    "trade_breakout",
    "Breakout Trading strategy — detects consolidation squeezes and trades the expansion move with volume confirmation. Includes false breakout filters and measured move targets.",
    {
      bars: z.string().describe("JSON array of OHLCV bars. Minimum 30 bars for squeeze detection."),
      config: z.string().optional().describe("JSON config: {consolidationBars, volumeSpikeRatio, retestMode}"),
    },
    async ({ bars: barsJson, config: configJson }) => {
      try {
        const bars = JSON.parse(barsJson);
        const config = configJson ? JSON.parse(configJson) : {};
        const result = analyzeBreakout(bars, config);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text", text: JSON.stringify({ error: e.message }) }] };
      }
    }
  );

  server.tool(
    "trade_strategy_selector",
    "Auto-selects the best strategy (Trend/Range/Breakout) for current market conditions based on ADX, volatility contraction, and price structure.",
    {
      bars: z.string().describe("JSON array of OHLCV bars. Minimum 200 bars recommended."),
    },
    async ({ bars: barsJson }) => {
      try {
        const bars = JSON.parse(barsJson);

        const trend = analyzeTrendFollowing(bars);
        const range = analyzeRangeTrading(bars);
        const breakout = analyzeBreakout(bars);

        const strategies = [
          { name: "TREND_FOLLOWING", score: trend.score, signal: trend.signal, condition: trend.trend?.strength || "N/A" },
          { name: "RANGE_TRADING", score: range.score, signal: range.signal, condition: range.marketState || "N/A" },
          { name: "BREAKOUT", score: breakout.score, signal: breakout.signal, condition: breakout.squeeze?.detected ? "SQUEEZE" : "NO_SQUEEZE" },
        ];

        const best = strategies.reduce((a, b) => a.score > b.score ? a : b);

        const result = {
          recommended: best.name,
          scores: strategies,
          analysis: {
            trend: { signal: trend.signal, direction: trend.direction, adx: trend.trend?.adx },
            range: { signal: range.signal, adx: range.adx, rangeWidth: range.range?.widthPct },
            breakout: { signal: breakout.signal, squeeze: breakout.squeeze?.detected, volume: breakout.volume?.confirmed },
          },
          action: best.signal !== "WAIT" ?
            `Use ${best.name} — Signal: ${best.signal}` :
            "WAIT — No high-probability setup across any strategy",
        };

        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text", text: JSON.stringify({ error: e.message }) }] };
      }
    }
  );
}
