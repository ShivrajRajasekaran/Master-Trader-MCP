import { z } from "zod";
import { computePDH_PDL, computePWH_PWL, getAsiaRange, getLondonRange, getNYRange, detectEqualHighs, detectEqualLows, getAllKeyLevels } from "../engine/levels.js";
import { detectSwings } from "../engine/structure.js";
import { computePOC } from "../engine/volume.js";

export function registerLevelsTools(server) {
  server.tool(
    "trade_key_levels",
    "Get all institutional key levels: PDH/PDL, PWH/PWL, Session Ranges (Asia/London/NY), EQH/EQL, POC. These are the #1 liquidity targets.",
    {
      bars: z.string().describe("JSON array of intraday OHLCV bars (5M/15M). Minimum 50 bars."),
      daily_bars: z.string().optional().describe("JSON array of daily bars (for PDH/PDL). Minimum 2."),
      weekly_bars: z.string().optional().describe("JSON array of weekly bars (for PWH/PWL). Minimum 2."),
    },
    async ({ bars: barsJson, daily_bars: dailyJson, weekly_bars: weeklyJson }) => {
      try {
        const bars = JSON.parse(barsJson);
        const dailyBars = dailyJson ? JSON.parse(dailyJson) : null;
        const weeklyBars = weeklyJson ? JSON.parse(weeklyJson) : null;

        const price = bars[bars.length - 1].close;
        const { highs, lows } = detectSwings(bars);

        const levels = {};

        // PDH/PDL
        if (dailyBars) {
          const pd = computePDH_PDL(dailyBars);
          if (pd) levels.previous_day = pd;
        }

        // PWH/PWL
        if (weeklyBars) {
          const pw = computePWH_PWL(weeklyBars);
          if (pw) levels.previous_week = pw;
        }

        // Session Ranges
        const asia = getAsiaRange(bars);
        const london = getLondonRange(bars);
        const ny = getNYRange(bars);
        levels.sessions = {
          asia: asia ? { high: asia.high.toFixed(2), low: asia.low.toFixed(2) } : null,
          london: london ? { high: london.high.toFixed(2), low: london.low.toFixed(2) } : null,
          ny: ny ? { high: ny.high.toFixed(2), low: ny.low.toFixed(2) } : null,
        };

        // EQH/EQL (Engineered Liquidity)
        const eqh = detectEqualHighs(highs);
        const eql = detectEqualLows(lows);
        levels.engineered_liquidity = {
          equalHighs: eqh.map((e) => ({ price: e.price.toFixed(2), type: "BSL" })),
          equalLows: eql.map((e) => ({ price: e.price.toFixed(2), type: "SSL" })),
        };

        // POC (Volume Profile)
        const poc = computePOC(bars);
        if (poc) {
          levels.volume_profile = {
            poc: poc.poc?.toFixed(2),
            vah: poc.vah?.toFixed(2),
            val: poc.val?.toFixed(2),
          };
        }

        // Nearest levels above/below price
        const allLevels = getAllKeyLevels(bars, dailyBars, weeklyBars, highs, lows);
        const above = allLevels.filter((l) => l.price > price).slice(-3);
        const below = allLevels.filter((l) => l.price < price).slice(0, 3);

        const output = {
          currentPrice: price.toFixed(2),
          levels,
          nearest: {
            above: above.map((l) => `${l.label}: ${l.price.toFixed(2)}`),
            below: below.map((l) => `${l.label}: ${l.price.toFixed(2)}`),
          },
          dol: above.length > 0 ? `Draw on Liquidity: ${above[above.length - 1].label} @ ${above[above.length - 1].price.toFixed(2)}` : "No clear DOL above",
        };

        return { content: [{ type: "text", text: JSON.stringify(output, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: err.message }) }] };
      }
    }
  );

  server.tool(
    "trade_dol",
    "Identify Draw on Liquidity (DOL) — where price is MOST LIKELY heading next based on nearest untapped liquidity.",
    {
      bars: z.string().describe("JSON array of OHLCV bars"),
      direction: z.enum(["bullish", "bearish"]).describe("Current market bias direction"),
      daily_bars: z.string().optional().describe("JSON array of daily bars"),
    },
    async ({ bars: barsJson, direction, daily_bars: dailyJson }) => {
      try {
        const bars = JSON.parse(barsJson);
        const dailyBars = dailyJson ? JSON.parse(dailyJson) : null;
        const price = bars[bars.length - 1].close;
        const { highs, lows } = detectSwings(bars);

        const targets = [];

        // Swing highs/lows as targets
        if (direction === "bullish") {
          highs.filter((h) => h.price > price).forEach((h) => {
            targets.push({ price: h.price, label: "Swing High (BSL)", priority: 2 });
          });
        } else {
          lows.filter((l) => l.price < price).forEach((l) => {
            targets.push({ price: l.price, label: "Swing Low (SSL)", priority: 2 });
          });
        }

        // PDH/PDL
        if (dailyBars) {
          const pd = computePDH_PDL(dailyBars);
          if (pd) {
            if (direction === "bullish" && pd.pdh > price) {
              targets.push({ price: pd.pdh, label: "PDH", priority: 1 });
            }
            if (direction === "bearish" && pd.pdl < price) {
              targets.push({ price: pd.pdl, label: "PDL", priority: 1 });
            }
          }
        }

        // EQH/EQL
        const eqh = detectEqualHighs(highs);
        const eql = detectEqualLows(lows);
        if (direction === "bullish") {
          eqh.filter((e) => e.price > price).forEach((e) => {
            targets.push({ price: e.price, label: "EQH (BSL)", priority: 1 });
          });
        } else {
          eql.filter((e) => e.price < price).forEach((e) => {
            targets.push({ price: e.price, label: "EQL (SSL)", priority: 1 });
          });
        }

        targets.sort((a, b) => a.priority - b.priority);
        const dol = targets[0] || null;

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              currentPrice: price.toFixed(2),
              direction,
              dol: dol ? { price: dol.price.toFixed(2), label: dol.label } : null,
              allTargets: targets.slice(0, 5).map((t) => `${t.label}: ${t.price.toFixed(2)}`),
              action: dol
                ? `DOL = ${dol.label} @ ${dol.price.toFixed(2)} — Use as TP target`
                : "No clear DOL found — use fixed RR instead",
            }, null, 2),
          }],
        };
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: err.message }) }] };
      }
    }
  );
}
