/**
 * Breakout Trading Engine
 * Detects consolidation → breakout with volume confirmation.
 *
 * Logic: Identify tight consolidation (squeeze), wait for expansion candle
 * with volume spike, enter in breakout direction with retest confirmation.
 * Manages false breakouts with strict invalidation rules.
 */

export function analyzeBreakout(bars, config = {}) {
  const {
    consolidationBars = 20,
    volumeSpikeRatio = 1.5,
    atrPeriod = 14,
    atrSqueezePct = 0.6,
    retestMode = true,
  } = config;

  if (!bars || bars.length < consolidationBars + 10) {
    return { signal: "WAIT", reason: "Insufficient data" };
  }

  const closes = bars.map(b => b.close);
  const highs = bars.map(b => b.high);
  const lows = bars.map(b => b.low);
  const volumes = bars.map(b => b.volume || 0);

  // Step 1: Detect consolidation/squeeze
  const squeeze = detectSqueeze(bars, consolidationBars, atrPeriod, atrSqueezePct);

  // Step 2: Check for breakout candle
  const breakout = detectBreakoutCandle(bars, squeeze, volumeSpikeRatio);

  // Step 3: Volume confirmation
  const volumeConf = confirmVolume(volumes, volumeSpikeRatio);

  // Step 4: Retest check (if enabled)
  const retest = retestMode ? detectRetest(bars, squeeze, breakout) : { detected: true, type: "DISABLED" };

  // Generate signal
  let signal = "WAIT";
  let trade = null;
  const currentATR = computeATRSimple(
    highs.slice(-atrPeriod), lows.slice(-atrPeriod), closes.slice(-atrPeriod)
  );

  const currentPrice = closes[closes.length - 1];

  if (squeeze.detected && breakout.broken && volumeConf.confirmed) {
    signal = breakout.direction === "UP" ? "BUY" : "SELL";

    const entry = currentPrice;
    let stopLoss, targets;

    if (signal === "BUY") {
      stopLoss = Math.max(squeeze.low - currentATR * 0.5, entry - currentATR * 2);
      const range = squeeze.high - squeeze.low;
      targets = {
        t1: entry + range * 1.0,    // Measured move 1x
        t2: entry + range * 1.618,  // Fib extension
        t3: entry + range * 2.5,    // Extended target
      };
    } else {
      stopLoss = Math.min(squeeze.high + currentATR * 0.5, entry + currentATR * 2);
      const range = squeeze.high - squeeze.low;
      targets = {
        t1: entry - range * 1.0,
        t2: entry - range * 1.618,
        t3: entry - range * 2.5,
      };
    }

    trade = {
      entry: round5(entry),
      stopLoss: round5(stopLoss),
      targets: { t1: round5(targets.t1), t2: round5(targets.t2), t3: round5(targets.t3) },
      measuredMove: round5(squeeze.high - squeeze.low),
      atr: round5(currentATR),
      riskReward: round5(Math.abs(targets.t1 - entry) / Math.abs(entry - stopLoss)),
    };
  }

  // Score
  let score = 0;
  if (squeeze.detected) score += 25;
  if (squeeze.tight) score += 10;
  if (breakout.broken) score += 25;
  if (volumeConf.confirmed) score += 20;
  if (volumeConf.ratio > 2.0) score += 10;
  if (retest.detected) score += 10;

  return {
    signal,
    score: Math.min(100, score),
    squeeze: {
      detected: squeeze.detected,
      tight: squeeze.tight,
      high: round5(squeeze.high),
      low: round5(squeeze.low),
      range: round5(squeeze.high - squeeze.low),
      duration: squeeze.duration,
      atrRatio: Math.round(squeeze.atrRatio * 100) / 100,
    },
    breakout: {
      broken: breakout.broken,
      direction: breakout.direction,
      candle: breakout.candle,
      displacement: breakout.displacement,
    },
    volume: volumeConf,
    retest,
    trade,
    falseBreakoutRules: {
      rule1: "If price re-enters the consolidation range within 3 bars — EXIT (false breakout)",
      rule2: "If breakout candle body is < 50% of total range — SUSPECT (weak breakout)",
      rule3: "If volume doesn't spike 1.5x+ on breakout candle — SKIP (no conviction)",
      rule4: "First breakout from a range often fails — wait for retest of broken level",
    },
  };
}

function detectSqueeze(bars, lookback, atrPeriod, squeezePct) {
  const consolidation = bars.slice(-lookback);
  const highs = consolidation.map(b => b.high);
  const lows = consolidation.map(b => b.low);
  const closes = consolidation.map(b => b.close);

  const rangeHigh = Math.max(...highs);
  const rangeLow = Math.min(...lows);
  const rangeWidth = rangeHigh - rangeLow;

  // Calculate ATR for the period before consolidation
  const preBars = bars.slice(-(lookback + atrPeriod), -lookback);
  let preATR = 0;
  if (preBars.length >= atrPeriod) {
    const h = preBars.map(b => b.high);
    const l = preBars.map(b => b.low);
    const c = preBars.map(b => b.close);
    preATR = computeATRSimple(h, l, c);
  }

  // Squeeze = range is tighter than normal (ATR ratio < threshold)
  const atrRatio = preATR > 0 ? rangeWidth / (preATR * lookback * 0.5) : 1;
  const isSqueeze = atrRatio < squeezePct * 2;

  // Check if bars are getting tighter (volatility contraction)
  const firstHalf = consolidation.slice(0, Math.floor(lookback / 2));
  const secondHalf = consolidation.slice(Math.floor(lookback / 2));
  const firstRange = Math.max(...firstHalf.map(b => b.high)) - Math.min(...firstHalf.map(b => b.low));
  const secondRange = Math.max(...secondHalf.map(b => b.high)) - Math.min(...secondHalf.map(b => b.low));
  const contracting = secondRange < firstRange * 0.8;

  return {
    detected: isSqueeze || contracting,
    tight: isSqueeze && contracting,
    high: rangeHigh,
    low: rangeLow,
    duration: lookback,
    atrRatio,
    contracting,
  };
}

function detectBreakoutCandle(bars, squeeze, volumeRatio) {
  if (!squeeze.detected) return { broken: false };

  const last3 = bars.slice(-3);

  for (let i = last3.length - 1; i >= 0; i--) {
    const bar = last3[i];
    const body = Math.abs(bar.close - bar.open);
    const range = bar.high - bar.low;

    // Breakout above consolidation high
    if (bar.close > squeeze.high && body > range * 0.5) {
      return {
        broken: true,
        direction: "UP",
        candle: bar,
        displacement: body > range * 0.7,
        description: "Strong close above consolidation high",
      };
    }

    // Breakout below consolidation low
    if (bar.close < squeeze.low && body > range * 0.5) {
      return {
        broken: true,
        direction: "DOWN",
        candle: bar,
        displacement: body > range * 0.7,
        description: "Strong close below consolidation low",
      };
    }
  }

  return { broken: false, reason: "No breakout candle yet" };
}

function confirmVolume(volumes, requiredRatio) {
  if (!volumes || volumes.length < 10) {
    return { confirmed: true, reason: "No volume data — skipping check" };
  }

  const recentAvg = volumes.slice(-20, -1).reduce((a, b) => a + b, 0) / Math.min(19, volumes.length - 1);
  const currentVol = volumes[volumes.length - 1];
  const ratio = recentAvg > 0 ? currentVol / recentAvg : 1;

  return {
    confirmed: ratio >= requiredRatio,
    ratio: Math.round(ratio * 100) / 100,
    currentVolume: currentVol,
    avgVolume: Math.round(recentAvg),
    description: ratio >= requiredRatio ?
      `Volume ${ratio.toFixed(1)}x average — CONFIRMED` :
      `Volume only ${ratio.toFixed(1)}x — WEAK breakout`,
  };
}

function detectRetest(bars, squeeze, breakout) {
  if (!breakout.broken) return { detected: false };

  const last5 = bars.slice(-5);

  for (let i = 1; i < last5.length - 1; i++) {
    const bar = last5[i];

    if (breakout.direction === "UP") {
      // Price retested the broken resistance (now support)
      if (bar.low <= squeeze.high * 1.002 && bar.close > squeeze.high) {
        return { detected: true, type: "RETEST_OF_BROKEN_RESISTANCE", level: squeeze.high };
      }
    } else {
      // Price retested the broken support (now resistance)
      if (bar.high >= squeeze.low * 0.998 && bar.close < squeeze.low) {
        return { detected: true, type: "RETEST_OF_BROKEN_SUPPORT", level: squeeze.low };
      }
    }
  }

  return { detected: false, type: "NO_RETEST_YET" };
}

function computeATRSimple(highs, lows, closes) {
  if (highs.length < 2) return 0;
  let sum = 0;
  for (let i = 1; i < highs.length; i++) {
    sum += Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i-1]), Math.abs(lows[i] - closes[i-1]));
  }
  return sum / (highs.length - 1);
}

function round5(val) {
  return val ? Math.round(val * 100000) / 100000 : null;
}
