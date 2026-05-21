/**
 * Volume Engine
 * Volume analysis for move validation, exhaustion detection, and POC.
 */

export function analyzeVolume(bars, lookback = 20) {
  if (bars.length < lookback) return null;

  const recent = bars.slice(-lookback);
  const volumes = recent.map((b) => b.volume || 0);
  const avgVol = volumes.reduce((s, v) => s + v, 0) / volumes.length;
  const currVol = volumes[volumes.length - 1];
  const prevVol = volumes[volumes.length - 2];

  const volRatio = avgVol > 0 ? currVol / avgVol : 0;

  let volState = "Normal";
  if (volRatio > 2.0) volState = "CLIMAX";
  else if (volRatio > 1.5) volState = "HIGH";
  else if (volRatio < 0.5) volState = "DRY";
  else if (volRatio < 0.75) volState = "LOW";

  return {
    currentVolume: currVol,
    averageVolume: avgVol.toFixed(0),
    ratio: volRatio.toFixed(2),
    state: volState,
    rising: currVol > prevVol,
    interpretation: getInterpretation(bars, volState),
  };
}

function getInterpretation(bars, volState) {
  const curr = bars[bars.length - 1];
  const isBullish = curr.close > curr.open;

  if (volState === "CLIMAX") {
    if (isBullish) return "HIGH VOLUME BULLISH — Institutional buying. Validates the move UP.";
    return "HIGH VOLUME BEARISH — Institutional selling. Validates the move DOWN.";
  }
  if (volState === "HIGH") {
    if (isBullish) return "Strong volume on green candle — move is backed by real orders.";
    return "Strong volume on red candle — selling pressure is real.";
  }
  if (volState === "DRY") {
    return "VERY LOW volume — no participation. Move is suspect. Wait for volume confirmation.";
  }
  if (volState === "LOW") {
    return "Below average volume — pullback/consolidation. Normal during retracement.";
  }
  return "Normal volume — neutral.";
}

export function validateDisplacementWithVolume(bars, displacementIndex) {
  /**
   * A true displacement should have above-average volume.
   * If displacement candle has LOW volume → it's a fake move (liquidity grab, not real).
   */
  if (!bars[displacementIndex]) return { valid: false, reason: "No bar at index" };

  const lookback = Math.min(20, displacementIndex);
  const prevBars = bars.slice(displacementIndex - lookback, displacementIndex);
  const avgVol = prevBars.reduce((s, b) => s + (b.volume || 0), 0) / prevBars.length;
  const displVol = bars[displacementIndex].volume || 0;

  const valid = displVol > avgVol * 1.2;

  return {
    valid,
    displacementVolume: displVol,
    averageVolume: avgVol.toFixed(0),
    ratio: avgVol > 0 ? (displVol / avgVol).toFixed(2) : "N/A",
    reason: valid
      ? "Displacement confirmed by volume"
      : "LOW VOLUME displacement — suspect. May be a fake move.",
  };
}

export function detectExhaustion(bars, lookback = 5) {
  /**
   * Exhaustion: price keeps moving in one direction but volume is DECLINING.
   * = Smart money is no longer pushing. Reversal incoming.
   */
  if (bars.length < lookback + 1) return { exhaustion: false };

  const recent = bars.slice(-lookback);
  const allBullish = recent.every((b) => b.close > b.open);
  const allBearish = recent.every((b) => b.close < b.open);

  if (!allBullish && !allBearish) return { exhaustion: false };

  const volumes = recent.map((b) => b.volume || 0);
  let declining = true;
  for (let i = 1; i < volumes.length; i++) {
    if (volumes[i] >= volumes[i - 1]) {
      declining = false;
      break;
    }
  }

  if (declining) {
    return {
      exhaustion: true,
      direction: allBullish ? "bullish_exhaustion" : "bearish_exhaustion",
      note: allBullish
        ? "Price rising on DECLINING volume — bulls exhausted. Reversal likely."
        : "Price falling on DECLINING volume — bears exhausted. Bounce likely.",
      volumes,
    };
  }

  return { exhaustion: false };
}

export function computePOC(bars) {
  /**
   * Point of Control (POC): price level where most volume was traded.
   * This acts as a magnet — price tends to return to POC.
   */
  if (bars.length < 10) return null;

  const priceStep = 1.0; // 1 point buckets
  const volumeProfile = {};

  for (const bar of bars) {
    const low = Math.floor(bar.low);
    const high = Math.ceil(bar.high);
    const barVol = bar.volume || 1;
    const levels = high - low || 1;
    const volPerLevel = barVol / levels;

    for (let p = low; p <= high; p += priceStep) {
      const key = p.toFixed(0);
      volumeProfile[key] = (volumeProfile[key] || 0) + volPerLevel;
    }
  }

  let maxVol = 0;
  let poc = null;
  for (const [price, vol] of Object.entries(volumeProfile)) {
    if (vol > maxVol) {
      maxVol = vol;
      poc = parseFloat(price);
    }
  }

  // Value Area (70% of total volume)
  const totalVol = Object.values(volumeProfile).reduce((s, v) => s + v, 0);
  const sorted = Object.entries(volumeProfile).sort((a, b) => b[1] - a[1]);
  let cumVol = 0;
  let vah = poc;
  let val = poc;
  for (const [price, vol] of sorted) {
    cumVol += vol;
    const p = parseFloat(price);
    if (p > vah) vah = p;
    if (p < val) val = p;
    if (cumVol >= totalVol * 0.7) break;
  }

  return { poc, vah, val, totalVolume: totalVol.toFixed(0) };
}
