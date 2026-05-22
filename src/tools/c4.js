import { z } from "zod";
import { identifyC4Setup, detectSRZones } from "../engine/c4-strategy.js";

export function registerC4Tools(server) {
  server.tool(
    "trade_c4_setup",
    "Run the C4 Strategy (4-Confirmation S/R Reversal System). Identifies setups where price reverses at key support/resistance with 4 layers of confirmation: Zone proximity, Price rejection, Momentum shift, Entry trigger.",
    {
      bars: z
        .string()
        .describe("JSON array of OHLCV bars [{time, open, high, low, close, volume}, ...]. Minimum 50 bars."),
      zones: z
        .string()
        .optional()
        .describe("JSON array of S/R zones [{type, high, low, touches, htf}]. If not provided, zones are auto-detected from price data."),
      rsi: z
        .string()
        .optional()
        .describe("JSON array of RSI values (same length as bars). Improves C3 momentum confirmation."),
      macd_hist: z
        .string()
        .optional()
        .describe("JSON array of MACD histogram values. Improves C3 confirmation."),
    },
    async ({ bars: barsJson, zones: zonesJson, rsi: rsiJson, macd_hist: macdJson }) => {
      try {
        const bars = JSON.parse(barsJson);

        if (bars.length < 20) {
          return {
            content: [{ type: "text", text: JSON.stringify({ error: "Need minimum 20 bars" }) }],
          };
        }

        let zones;
        if (zonesJson) {
          zones = JSON.parse(zonesJson);
        } else {
          zones = detectSRZones(bars, Math.min(50, bars.length));
        }

        const indicators = {};
        if (rsiJson) indicators.rsi = JSON.parse(rsiJson);
        if (macdJson) indicators.macdHist = JSON.parse(macdJson);
        if (bars[0].volume !== undefined) {
          indicators.volume = bars.map(b => b.volume);
        }

        const result = identifyC4Setup(bars, zones, indicators);

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (e) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: e.message }) }],
        };
      }
    }
  );

  server.tool(
    "trade_sr_zones",
    "Auto-detect Support and Resistance zones from price data. Returns key levels with touch count and zone type. Used by C4 strategy and general level analysis.",
    {
      bars: z
        .string()
        .describe("JSON array of OHLCV bars. Minimum 30 bars recommended for quality zones."),
      lookback: z
        .number()
        .optional()
        .describe("Number of bars to analyze (default 50)"),
      min_touches: z
        .number()
        .optional()
        .describe("Minimum touches to qualify as valid zone (default 2)"),
    },
    async ({ bars: barsJson, lookback = 50, min_touches = 2 }) => {
      try {
        const bars = JSON.parse(barsJson);
        const zones = detectSRZones(bars, lookback, min_touches);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              zones_found: zones.length,
              zones: zones,
              usage: "Pass these zones to trade_c4_setup for reversal analysis",
            }, null, 2),
          }],
        };
      } catch (e) {
        return {
          content: [{ type: "text", text: JSON.stringify({ error: e.message }) }],
        };
      }
    }
  );
}
