/**
 * Patterns Engine
 * Wyckoff Spring/UTAD, Displacement detection, Breaker Blocks, Inducement.
 */

import { computeATR } from "./kalman-filter.js";

export function detectDisplacement(bars, multiplier = 2.0) {
  /**
   * Displacement = impulsive candle with body > multiplier × average body.
   * This validates Order Blocks — no displacement = no valid OB.
   */
  if (bars.length < 20) return { found: false };

  const bodies = bars.slice(-20, -1).map((b) => Math.abs(b.close - b.open));
  const avgBody = bodies.reduce((s, b) => s + b, 0) / bodies.length;
  const threshold = avgBody * multiplier;

  const curr = bars[bars.length - 1];
  const currBody = Math.abs(curr.close - curr.open);

  if (currBody > threshold) {
    return {
      found: true,
      direction: curr.close > curr.open ? "bullish" : "bearish",
      body: currBody,
      avgBody,
      ratio: (currBody / avgBody).toFixed(1),
      candle: curr,
    };
  }

  return { found: false, body: currBody, avgBody, ratio: (currBody / avgBody).toFixed(1) };
}

export function detectWyckoffSpring(bars, swingLows, lookback = 20) {
  /**
   * Wyckoff Spring: price breaks below range/support (sweep),
   * then quickly recovers back inside the range.
   * Classic: wick below key low + close back above it.
   */
  if (bars.length < lookback || swingLows.length < 2) {
    return { spring: false };
  }

  const recentBars = bars.slice(-lookback);
  const rangelow = Math.min(...swingLows.slice(-3).map((l) => l.price));

  for (let i = recentBars.length - 1; i >= 1; i--) {
    const bar = recentBars[i];
    if (bar.low < rangelow && bar.close > rangelow) {
      return {
        spring: true,
        price: bar.low,
        recoveryClose: bar.close,
        rangelow,
        time: bar.time,
        type: "SPRING",
        action: "BULLISH — Smart money accumulated. Look for BUY entry above spring.",
      };
    }
  }

  return { spring: false };
}

export function detectWyckoffUTAD(bars, swingHighs, lookback = 20) {
  /**
   * UTAD (Upthrust After Distribution): price breaks above range/resistance,
   * then quickly drops back below. Classic distribution trap.
   */
  if (bars.length < lookback || swingHighs.length < 2) {
    return { utad: false };
  }

  const recentBars = bars.slice(-lookback);
  const rangeHigh = Math.max(...swingHighs.slice(-3).map((h) => h.price));

  for (let i = recentBars.length - 1; i >= 1; i--) {
    const bar = recentBars[i];
    if (bar.high > rangeHigh && bar.close < rangeHigh) {
      return {
        utad: true,
        price: bar.high,
        recoveryClose: bar.close,
        rangeHigh,
        time: bar.time,
        type: "UTAD",
        action: "BEARISH — Smart money distributed. Look for SELL entry below UTAD.",
      };
    }
  }

  return { utad: false };
}

export function detectBreakerBlock(bars, failedOBs = []) {
  /**
   * Breaker Block: an Order Block that FAILED (price ran through it),
   * then flips polarity. A broken Bull OB becomes a Bear Breaker (resistance).
   */
  const breakers = [];

  for (const ob of failedOBs) {
    // Check if price has broken through the OB
    const afterOB = bars.filter((b) => b.time > ob.timeEnd);
    const broken = afterOB.some((b) => {
      if (ob.side === "bull") return b.close < ob.bottom;
      if (ob.side === "bear") return b.close > ob.top;
      return false;
    });

    if (broken) {
      breakers.push({
        top: ob.top,
        bottom: ob.bottom,
        originalSide: ob.side,
        newSide: ob.side === "bull" ? "bear" : "bull",
        type: "BREAKER",
        action: ob.side === "bull"
          ? "Former Bull OB is now RESISTANCE (Bearish Breaker)"
          : "Former Bear OB is now SUPPORT (Bullish Breaker)",
      });
    }
  }

  return breakers;
}

export function detectInducement(bars, swingHighs, swingLows, tolerance = 0.3) {
  /**
   * Inducement: minor liquidity grab just before the real sweep.
   * Small equal highs/lows that retail traders put stops at.
   * Smart money takes these small stops first, then goes for the big pool.
   */
  const inducements = [];
  const recentBars = bars.slice(-15);

  // Look for minor equal highs taken before a major move
  for (let i = 1; i < recentBars.length - 1; i++) {
    const prev = recentBars[i - 1];
    const curr = recentBars[i];
    const next = recentBars[i + 1];

    // Minor high taken (wick above) then reversal
    if (curr.high > prev.high && next.close < curr.open && Math.abs(curr.high - prev.high) < tolerance) {
      inducements.push({
        type: "bearish_inducement",
        price: curr.high,
        time: curr.time,
        note: "Minor BSL taken — watch for real move DOWN",
      });
    }

    // Minor low taken (wick below) then reversal
    if (curr.low < prev.low && next.close > curr.open && Math.abs(prev.low - curr.low) < tolerance) {
      inducements.push({
        type: "bullish_inducement",
        price: curr.low,
        time: curr.time,
        note: "Minor SSL taken — watch for real move UP",
      });
    }
  }

  return inducements;
}

export function validateOrderBlock(bars, obIndex, displacementMultiplier = 1.5) {
  /**
   * Validates an OB by checking the displacement AFTER it.
   * Returns true only if the move away from the OB was impulsive.
   */
  if (obIndex >= bars.length - 1) return false;

  const bodies = bars.slice(Math.max(0, obIndex - 10), obIndex).map((b) => Math.abs(b.close - b.open));
  const avgBody = bodies.length > 0 ? bodies.reduce((s, b) => s + b, 0) / bodies.length : 0;

  // Check next 3 candles after OB for displacement
  for (let i = obIndex + 1; i < Math.min(obIndex + 4, bars.length); i++) {
    const body = Math.abs(bars[i].close - bars[i].open);
    if (body > avgBody * displacementMultiplier) return true;
  }

  return false;
}
