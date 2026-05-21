import { z } from "zod";
import { analyzeTrend } from "../engine/kalman-filter.js";
import { detectSwings, classifyStructure, detectCISD } from "../engine/structure.js";
import { detectRecentSweep, detectOrderBlocks, detectFVGs } from "../engine/liquidity.js";
import { detectAMDPhase } from "../engine/amd.js";
import { analyzeVolume } from "../engine/volume.js";

export function registerScannerTools(server) {
  server.tool(
    "trade_scanner",
    "Scan multiple pairs for setups. Scores each pair on structure, sweep, AMD, volume. Returns ranked list of tradeable pairs.",
    {
      pairs: z
        .string()
        .describe("JSON object: {\"XAUUSD\": [{bar}, ...], \"EURUSD\": [{bar}, ...]} — each pair needs 50+ bars"),
    },
    async ({ pairs: pairsJson }) => {
      try {
        const pairs = JSON.parse(pairsJson);
        const results = [];

        for (const [symbol, bars] of Object.entries(pairs)) {
          if (!Array.isArray(bars) || bars.length < 30) {
            results.push({ symbol, score: 0, reason: "Insufficient data" });
            continue;
          }

          let score = 0;
          const notes = [];

          // 1. Trend (Kalman)
          const trend = analyzeTrend(bars);
          if (trend.canTrade && trend.trendConfirmed) {
            score += 2;
            notes.push(`Trend: ${trend.label}`);
          } else if (trend.canTrade) {
            score += 1;
            notes.push("Trend: Active but unconfirmed");
          } else {
            notes.push("RANGING — skip");
          }

          // 2. Structure
          const { highs, lows } = detectSwings(bars);
          const structure = classifyStructure(highs, lows);
          if (structure.bias !== "Neutral") {
            score += 1;
            notes.push(`Structure: ${structure.bias} (${structure.highType}/${structure.lowType})`);
          }

          // 3. CISD
          const cisd = detectCISD(bars);
          if (cisd.bullCISD || cisd.bearCISD) {
            score += 2;
            notes.push(`CISD: ${cisd.bullCISD ? "Bullish" : "Bearish"}`);
          }

          // 4. Liquidity sweep
          const sweep = detectRecentSweep(bars, highs, lows, 10);
          if (sweep.swept) {
            score += 2;
            notes.push(`Sweep: ${sweep.type} at ${sweep.price?.toFixed(2)}`);
          }

          // 5. Institutional zones
          const obs = detectOrderBlocks(bars);
          const fvgs = detectFVGs(bars);
          const price = bars[bars.length - 1].close;
          const allZones = [...obs.bullOBs, ...obs.bearOBs, ...fvgs.bullFVGs, ...fvgs.bearFVGs];
          const atZone = allZones.some((z) => price >= z.bottom && price <= z.top);
          if (atZone) {
            score += 1;
            notes.push("At OB/FVG zone");
          }

          // 6. AMD phase
          const amd = detectAMDPhase(bars);
          if (amd.phase === "Distribution" || amd.phase === "Manipulation") {
            score += 1;
            notes.push(`AMD: ${amd.phase}`);
          }

          // 7. Volume
          const vol = analyzeVolume(bars);
          if (vol && (vol.state === "HIGH" || vol.state === "CLIMAX")) {
            score += 1;
            notes.push(`Volume: ${vol.state}`);
          }

          const direction =
            (cisd.bullCISD || sweep.type === "bullish" || trend.label === "Bullish") ? "LONG" :
            (cisd.bearCISD || sweep.type === "bearish" || trend.label === "Bearish") ? "SHORT" : "—";

          results.push({
            symbol,
            score,
            maxScore: 10,
            direction,
            grade: score >= 8 ? "A+" : score >= 6 ? "A" : score >= 4 ? "B" : score >= 2 ? "C" : "D",
            notes: notes.join(" | "),
            tradeable: score >= 5,
          });
        }

        results.sort((a, b) => b.score - a.score);

        const output = {
          scanned: results.length,
          tradeable: results.filter((r) => r.tradeable).length,
          rankings: results,
          recommendation: results[0]?.tradeable
            ? `TOP PICK: ${results[0].symbol} (${results[0].direction}) — Score ${results[0].score}/10`
            : "No A-grade setups found. WAIT.",
        };

        return { content: [{ type: "text", text: JSON.stringify(output, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify({ error: err.message }) }] };
      }
    }
  );
}
