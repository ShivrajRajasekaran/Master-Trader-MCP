/**
 * AMD Engine (Accumulation → Manipulation → Distribution)
 * State machine that tracks the institutional dealing cycle.
 * Smart money accumulates in Asia, manipulates in London open, distributes in NY.
 */

import { computeATR } from "./kalman-filter.js";

export function detectAMDPhase(bars, sessionInfo = null) {
  if (bars.length < 30) return { phase: "Unknown", confidence: 0 };

  const lookback = Math.min(30, bars.length);
  const recent = bars.slice(-lookback);
  const curr = bars[bars.length - 1];

  const bodies = recent.map((b) => Math.abs(b.close - b.open));
  const avgBody = bodies.reduce((s, b) => s + b, 0) / bodies.length;
  const ranges = recent.map((b) => b.high - b.low);
  const avgRange = ranges.reduce((s, r) => s + r, 0) / ranges.length;

  const lastBody = Math.abs(curr.close - curr.open);
  const lastRange = curr.high - curr.low;

  // Volume analysis if available
  const volumes = recent.map((b) => b.volume || 0);
  const avgVol = volumes.reduce((s, v) => s + v, 0) / volumes.length;
  const currVol = curr.volume || 0;

  // Phase detection based on price action characteristics
  const tightRange = lastRange < avgRange * 0.6;
  const smallBodies = bodies.slice(-5).every((b) => b < avgBody * 0.7);
  const bigMove = lastBody > avgBody * 1.8;
  const volumeSpike = avgVol > 0 && currVol > avgVol * 1.5;

  // Check for sweep (wick exceeding recent range then closing back)
  const recentHigh = Math.max(...recent.slice(-10).map((b) => b.high));
  const recentLow = Math.min(...recent.slice(-10).map((b) => b.low));
  const wickAbove = curr.high > recentHigh && curr.close < recentHigh;
  const wickBelow = curr.low < recentLow && curr.close > recentLow;
  const swept = wickAbove || wickBelow;

  // Displacement after sweep
  const displacement = bigMove && (volumeSpike || lastBody > avgBody * 2);

  let phase, confidence, action;

  if (smallBodies && tightRange && !swept) {
    phase = "Accumulation";
    confidence = 70;
    action = "WAIT — Smart money is building positions. Mark range high/low.";
  } else if (swept && !displacement) {
    phase = "Manipulation";
    confidence = 80;
    action = wickBelow
      ? "SSL SWEPT — Watch for bullish reversal (CISD + displacement UP)"
      : "BSL SWEPT — Watch for bearish reversal (CISD + displacement DOWN)";
  } else if (swept && displacement) {
    phase = "Distribution";
    confidence = 90;
    action = curr.close > curr.open
      ? "BULLISH DISTRIBUTION — Real move UP confirmed. Enter on pullback to OB/FVG."
      : "BEARISH DISTRIBUTION — Real move DOWN confirmed. Enter on pullback to OB/FVG.";
  } else if (bigMove && !swept) {
    phase = "Distribution (Continuation)";
    confidence = 65;
    action = "Impulsive move without prior sweep — may be continuation. Look for retracement entry.";
  } else {
    phase = "Transition";
    confidence = 40;
    action = "No clear AMD phase — wait for setup to develop.";
  }

  // Session-based enhancement
  if (sessionInfo) {
    if (sessionInfo.sessionPivot?.key === "asia" && phase === "Accumulation") {
      confidence = Math.min(95, confidence + 15);
    }
    if (sessionInfo.activeKillZone?.type === "manipulation" && phase === "Manipulation") {
      confidence = Math.min(95, confidence + 10);
    }
    if (sessionInfo.activeKillZone?.type === "distribution" && phase === "Distribution") {
      confidence = Math.min(95, confidence + 10);
    }
  }

  return {
    phase,
    confidence,
    action,
    metrics: {
      avgBody: avgBody.toFixed(4),
      lastBody: lastBody.toFixed(4),
      avgRange: avgRange.toFixed(4),
      lastRange: lastRange.toFixed(4),
      swept,
      sweepDirection: wickBelow ? "SSL" : wickAbove ? "BSL" : null,
      displacement,
      volumeSpike,
    },
  };
}

export function getAMDModel(bars, sessionInfo = null) {
  const phase = detectAMDPhase(bars, sessionInfo);

  const tradeable = phase.phase === "Distribution" || phase.phase === "Manipulation";
  const direction =
    phase.phase === "Distribution"
      ? bars[bars.length - 1].close > bars[bars.length - 1].open
        ? "bullish"
        : "bearish"
      : phase.phase === "Manipulation"
        ? phase.metrics.sweepDirection === "SSL"
          ? "bullish_pending"
          : "bearish_pending"
        : null;

  return {
    ...phase,
    tradeable,
    direction,
    rule: "Only enter during Distribution phase or after Manipulation confirms. NEVER during Accumulation.",
  };
}
