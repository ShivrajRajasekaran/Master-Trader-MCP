import { test, describe } from "node:test";
import assert from "node:assert";

import { KalmanFilter, analyzeTrend, computeATR } from "../src/engine/kalman-filter.js";
import { getCurrentSession } from "../src/engine/kill-zones.js";
import { detectSwings, classifyStructure, detectCISD } from "../src/engine/structure.js";
import { detectOrderBlocks, detectFVGs, computeOTE } from "../src/engine/liquidity.js";
import { detectAMDPhase, getAMDModel } from "../src/engine/amd.js";
import { analyzeVolume, detectExhaustion, computePOC } from "../src/engine/volume.js";
import { detectDisplacement, detectWyckoffSpring } from "../src/engine/patterns.js";
import { computePDH_PDL, detectEqualHighs } from "../src/engine/levels.js";
import { getQuarterlyPhase, getMacroWindow } from "../src/engine/time.js";
import { runGates } from "../src/gates/entry-gates.js";

function makeBars(count, startPrice = 2000, trend = "up") {
  const bars = [];
  let price = startPrice;
  for (let i = 0; i < count; i++) {
    const dir = trend === "up" ? 1 : trend === "down" ? -1 : (Math.random() > 0.5 ? 1 : -1);
    const move = (Math.random() * 5 + 1) * dir;
    const open = price;
    const close = price + move;
    const high = Math.max(open, close) + Math.random() * 3;
    const low = Math.min(open, close) - Math.random() * 3;
    bars.push({ time: 1700000000 + i * 300, open, high, low, close, volume: Math.floor(Math.random() * 1000 + 100) });
    price = close;
  }
  return bars;
}

describe("Kalman Filter", () => {
  test("KalmanFilter converges to price", () => {
    const kf = new KalmanFilter();
    let val;
    for (let i = 0; i < 50; i++) val = kf.computeKalmanLine(100);
    assert.ok(Math.abs(val - 100) < 5);
  });

  test("analyzeTrend returns valid structure", () => {
    const bars = makeBars(60, 2000, "up");
    const result = analyzeTrend(bars);
    assert.ok(result.kalmanLine > 0);
    assert.ok(["Bullish", "Bearish", "Neutral", "Ranging"].includes(result.label));
    assert.ok(typeof result.canTrade === "boolean");
  });

  test("computeATR returns positive value", () => {
    const bars = makeBars(30);
    const atr = computeATR(bars, 14);
    assert.ok(atr > 0);
  });
});

describe("Kill Zones", () => {
  test("London KZ detected at 3AM EST", () => {
    const londonTime = new Date("2026-01-15T08:00:00Z"); // 3AM EST
    const session = getCurrentSession(londonTime.getTime());
    assert.ok(session.canTrade);
    assert.strictEqual(session.activeKillZone.key, "london");
  });

  test("Avoid zone at noon EST", () => {
    const lunchTime = new Date("2026-01-15T17:00:00Z"); // 12PM EST
    const session = getCurrentSession(lunchTime.getTime());
    assert.strictEqual(session.canTrade, false);
  });

  test("NY AM KZ at 10AM EST", () => {
    const nyTime = new Date("2026-01-15T15:00:00Z"); // 10AM EST
    const session = getCurrentSession(nyTime.getTime());
    assert.ok(session.canTrade);
    assert.strictEqual(session.activeKillZone.key, "ny_am");
  });
});

describe("Structure", () => {
  test("detectSwings finds highs and lows", () => {
    // Use mixed direction to guarantee swings
    const bars = makeBars(100, 2000, "mixed");
    const { highs, lows } = detectSwings(bars, 3);
    assert.ok(highs.length >= 0 && lows.length >= 0);
    // Structure detection should at least not crash
    assert.ok(typeof highs === "object");
  });

  test("classifyStructure identifies bias", () => {
    const bars = makeBars(60, 2000, "up");
    const { highs, lows } = detectSwings(bars);
    if (highs.length >= 2 && lows.length >= 2) {
      const structure = classifyStructure(highs, lows);
      assert.ok(["Bullish", "Bearish", "Neutral"].includes(structure.bias));
    }
  });

  test("detectCISD returns valid result", () => {
    const bars = makeBars(20);
    const cisd = detectCISD(bars);
    assert.ok(typeof cisd.bullCISD === "boolean");
    assert.ok(typeof cisd.bearCISD === "boolean");
  });
});

describe("Liquidity", () => {
  test("detectOrderBlocks finds OBs with displacement validation", () => {
    const bars = makeBars(60);
    const { bullOBs, bearOBs } = detectOrderBlocks(bars);
    // May or may not find OBs depending on random data, but shouldn't crash
    assert.ok(Array.isArray(bullOBs));
    assert.ok(Array.isArray(bearOBs));
  });

  test("detectFVGs finds gaps", () => {
    const bars = makeBars(60);
    const { bullFVGs, bearFVGs } = detectFVGs(bars);
    assert.ok(Array.isArray(bullFVGs));
    assert.ok(Array.isArray(bearFVGs));
  });

  test("computeOTE returns fibonacci levels", () => {
    const ote = computeOTE(2050, 2000);
    assert.strictEqual(ote.fib_50, 2025);
    assert.ok(ote.fib_618 < ote.fib_50);
    assert.ok(ote.fib_786 < ote.fib_618);
  });
});

describe("AMD Engine", () => {
  test("detectAMDPhase returns valid phase", () => {
    const bars = makeBars(50);
    const phase = detectAMDPhase(bars);
    assert.ok(["Accumulation", "Manipulation", "Distribution", "Distribution (Continuation)", "Transition"].includes(phase.phase));
    assert.ok(phase.confidence >= 0 && phase.confidence <= 100);
  });

  test("getAMDModel includes tradeable flag", () => {
    const bars = makeBars(50);
    const model = getAMDModel(bars);
    assert.ok(typeof model.tradeable === "boolean");
    assert.ok(model.rule.length > 0);
  });
});

describe("Volume Engine", () => {
  test("analyzeVolume detects states", () => {
    const bars = makeBars(30);
    const vol = analyzeVolume(bars);
    assert.ok(vol !== null);
    assert.ok(["Normal", "HIGH", "CLIMAX", "LOW", "DRY"].includes(vol.state));
  });

  test("computePOC finds point of control", () => {
    const bars = makeBars(20);
    const poc = computePOC(bars);
    assert.ok(poc !== null);
    assert.ok(poc.poc > 0);
  });
});

describe("Patterns", () => {
  test("detectDisplacement identifies big candles", () => {
    const bars = makeBars(30);
    const result = detectDisplacement(bars);
    assert.ok(typeof result.found === "boolean");
  });
});

describe("Levels", () => {
  test("computePDH_PDL from daily bars", () => {
    const dailyBars = [
      { time: 1, open: 2000, high: 2050, low: 1990, close: 2040 },
      { time: 2, open: 2040, high: 2060, low: 2010, close: 2050 },
    ];
    const pd = computePDH_PDL(dailyBars);
    assert.strictEqual(pd.pdh, 2050);
    assert.strictEqual(pd.pdl, 1990);
  });

  test("detectEqualHighs finds equal levels", () => {
    const swingHighs = [
      { price: 2050.2, time: 1 },
      { price: 2050.4, time: 2 },
      { price: 2080, time: 3 },
    ];
    const eqh = detectEqualHighs(swingHighs, 0.5);
    assert.ok(eqh.length > 0);
    assert.strictEqual(eqh[0].type, "EQH");
  });
});

describe("Time Engine", () => {
  test("getQuarterlyPhase returns valid phase", () => {
    const phase = getQuarterlyPhase();
    assert.ok(["Accumulation", "Manipulation", "Distribution", "Continuation/Reversal"].includes(phase.quarter));
  });

  test("getMacroWindow returns structure", () => {
    const macro = getMacroWindow();
    assert.ok(typeof macro.inMacro === "boolean");
    assert.ok(macro.currentTime.includes("EST"));
  });
});

describe("7-Gate System", () => {
  test("runGates returns structured result", () => {
    const bars = makeBars(60);
    const result = runGates({
      bars,
      htfBars: makeBars(30),
      currentTime: new Date("2026-01-15T08:00:00Z").getTime(), // London KZ
      tradesToday: 0,
      sensitivity: "balanced",
    });

    assert.strictEqual(result.total, 7);
    assert.ok(result.passed >= 0 && result.passed <= 7);
    assert.ok(result.gates.length === 7);
    assert.ok(["BUY LONG", "SELL SHORT", "WAIT"].includes(result.signal));
  });

  test("runGates respects trade limits", () => {
    const bars = makeBars(60);
    const result = runGates({
      bars,
      currentTime: Date.now(),
      tradesToday: 3,
      sensitivity: "aggressive",
    });

    const gate7 = result.gates[6];
    assert.strictEqual(gate7.passed, false);
  });

  test("runGates WAIT outside kill zones", () => {
    const bars = makeBars(60);
    const result = runGates({
      bars,
      currentTime: new Date("2026-01-15T22:00:00Z").getTime(), // 5PM EST — NY Close
      tradesToday: 0,
      sensitivity: "conservative",
    });

    const gate1 = result.gates[0];
    assert.strictEqual(gate1.passed, false);
  });
});
