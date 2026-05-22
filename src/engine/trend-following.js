/**
 * Trend Following Engine
 * Multi-timeframe trend detection with EMA stack, ADX, and momentum confirmation.
 * Enters WITH the trend on pullbacks — never counter-trend.
 *
 * Entry: Pullback to dynamic support (EMA) in confirmed trend + momentum resumption.
 * Exit: Trailing stop (ATR-based) or trend structure break.
 */

export function analyzeTrendFollowing(bars, config = {}) {
  const {
    emaFast = 9,
    emaMid = 21,
    emaSlow = 50,
    ema200 = 200,
    adxPeriod = 14,
    adxThreshold = 25,
    atrPeriod = 14,
    atrMultiplier = 2.0,
  } = config;

  if (!bars || bars.length < Math.max(ema200, 60)) {
    return { signal: "WAIT", reason: "Insufficient data for trend analysis" };
  }

  const closes = bars.map(b => b.close);
  const highs = bars.map(b => b.high);
  const lows = bars.map(b => b.low);

  const emaFastLine = computeEMAArray(closes, emaFast);
  const emaMidLine = computeEMAArray(closes, emaMid);
  const emaSlowLine = computeEMAArray(closes, emaSlow);
  const ema200Line = computeEMAArray(closes, ema200);
  const adx = computeADX(highs, lows, closes, adxPeriod);
  const atr = computeATRArray(highs, lows, closes, atrPeriod);

  const lastIdx = closes.length - 1;
  const currentPrice = closes[lastIdx];

  // EMA Stack alignment
  const emaStack = classifyEMAStack(
    emaFastLine[lastIdx], emaMidLine[lastIdx],
    emaSlowLine[lastIdx], ema200Line[lastIdx]
  );

  // ADX strength
  const currentADX = adx[lastIdx] || 0;
  const trendStrength = currentADX >= 40 ? "STRONG" :
    currentADX >= adxThreshold ? "MODERATE" : "WEAK";

  // Pullback detection
  const pullback = detectPullback(bars.slice(-10), emaFastLine.slice(-10), emaMidLine.slice(-10), emaStack.direction);

  // Momentum resumption
  const momentum = detectMomentumResumption(bars.slice(-5), emaStack.direction);

  // Signal generation
  let signal = "WAIT";
  let entry = null;
  let stopLoss = null;
  let targets = null;

  const currentATR = atr[lastIdx] || 0;

  if (emaStack.aligned && trendStrength !== "WEAK" && pullback.detected && momentum.resuming) {
    signal = emaStack.direction === "BULLISH" ? "BUY" : "SELL";

    entry = currentPrice;
    if (signal === "BUY") {
      stopLoss = entry - currentATR * atrMultiplier;
      targets = {
        t1: entry + currentATR * 1.5,
        t2: entry + currentATR * 3.0,
        t3: entry + currentATR * 5.0,
      };
    } else {
      stopLoss = entry + currentATR * atrMultiplier;
      targets = {
        t1: entry - currentATR * 1.5,
        t2: entry - currentATR * 3.0,
        t3: entry - currentATR * 5.0,
      };
    }
  }

  // Trailing stop calculation
  const trailingStop = signal !== "WAIT" ? computeTrailingStop(bars, atr, emaStack.direction, atrMultiplier) : null;

  // Score (0-100)
  let score = 0;
  if (emaStack.aligned) score += 30;
  if (trendStrength === "STRONG") score += 25;
  else if (trendStrength === "MODERATE") score += 15;
  if (pullback.detected) score += 20;
  if (momentum.resuming) score += 15;
  if (currentPrice > ema200Line[lastIdx]) score += 10;

  return {
    signal,
    direction: emaStack.direction,
    score: Math.min(100, score),
    trend: {
      emaStack: emaStack,
      adx: Math.round(currentADX * 100) / 100,
      strength: trendStrength,
      above200EMA: currentPrice > ema200Line[lastIdx],
    },
    pullback,
    momentum,
    trade: signal !== "WAIT" ? {
      entry: round5(entry),
      stopLoss: round5(stopLoss),
      targets: { t1: round5(targets.t1), t2: round5(targets.t2), t3: round5(targets.t3) },
      atr: round5(currentATR),
      trailingStop: round5(trailingStop),
      riskReward: "1:1.5 / 1:3 / 1:5",
    } : null,
    management: {
      trailMethod: "ATR trailing — move stop to breakeven at +1R, trail 2×ATR after +2R",
      partialTP: "30% at T1, 40% at T2, 30% runner to T3",
      exitSignal: "Close below EMA21 (bull) or above EMA21 (bear) = exit",
    },
  };
}

function classifyEMAStack(fast, mid, slow, ema200) {
  const bullish = fast > mid && mid > slow && slow > ema200;
  const bearish = fast < mid && mid < slow && slow < ema200;

  return {
    aligned: bullish || bearish,
    direction: bullish ? "BULLISH" : bearish ? "BEARISH" : "MIXED",
    order: bullish ? "9 > 21 > 50 > 200" : bearish ? "9 < 21 < 50 < 200" : "MIXED",
  };
}

function detectPullback(recentBars, emaFast, emaMid, direction) {
  const last = recentBars[recentBars.length - 1];
  const touchedEMA = false;
  let depth = 0;

  for (let i = recentBars.length - 3; i < recentBars.length; i++) {
    if (i < 0) continue;
    const bar = recentBars[i];

    if (direction === "BULLISH") {
      // Pullback = price touches or dips below EMA21, but holds above EMA50
      if (bar.low <= emaMid[i] * 1.002 && bar.close > emaMid[i] * 0.998) {
        depth = ((emaFast[i] - bar.low) / emaFast[i]) * 100;
        return { detected: true, depth: Math.round(depth * 100) / 100, level: "EMA21", type: "HEALTHY_PULLBACK" };
      }
    } else {
      if (bar.high >= emaMid[i] * 0.998 && bar.close < emaMid[i] * 1.002) {
        depth = ((bar.high - emaFast[i]) / emaFast[i]) * 100;
        return { detected: true, depth: Math.round(Math.abs(depth) * 100) / 100, level: "EMA21", type: "HEALTHY_PULLBACK" };
      }
    }
  }

  return { detected: false, reason: "No pullback to EMA detected" };
}

function detectMomentumResumption(recentBars, direction) {
  if (recentBars.length < 3) return { resuming: false };

  const last = recentBars[recentBars.length - 1];
  const prev = recentBars[recentBars.length - 2];

  if (direction === "BULLISH") {
    const greenCandle = last.close > last.open;
    const closesAbovePrev = last.close > prev.high;
    if (greenCandle && closesAbovePrev) {
      return { resuming: true, type: "BULLISH_MOMENTUM_CANDLE", description: "Green candle closes above prev high" };
    }
    if (greenCandle && last.close > prev.close) {
      return { resuming: true, type: "CONTINUATION", description: "Higher close" };
    }
  } else {
    const redCandle = last.close < last.open;
    const closesBelowPrev = last.close < prev.low;
    if (redCandle && closesBelowPrev) {
      return { resuming: true, type: "BEARISH_MOMENTUM_CANDLE", description: "Red candle closes below prev low" };
    }
    if (redCandle && last.close < prev.close) {
      return { resuming: true, type: "CONTINUATION", description: "Lower close" };
    }
  }

  return { resuming: false, reason: "No momentum candle yet" };
}

function computeTrailingStop(bars, atr, direction, multiplier) {
  const lastIdx = bars.length - 1;
  const currentATR = atr[lastIdx] || 0;

  if (direction === "BULLISH") {
    return bars[lastIdx].close - currentATR * multiplier;
  } else {
    return bars[lastIdx].close + currentATR * multiplier;
  }
}

// --- Utility functions ---

function computeEMAArray(data, period) {
  const ema = new Array(data.length).fill(0);
  const k = 2 / (period + 1);
  ema[0] = data[0];
  for (let i = 1; i < data.length; i++) {
    ema[i] = data[i] * k + ema[i - 1] * (1 - k);
  }
  return ema;
}

function computeATRArray(highs, lows, closes, period) {
  const tr = [highs[0] - lows[0]];
  for (let i = 1; i < highs.length; i++) {
    tr.push(Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    ));
  }

  const atr = new Array(tr.length).fill(0);
  let sum = 0;
  for (let i = 0; i < period && i < tr.length; i++) sum += tr[i];
  atr[period - 1] = sum / period;

  for (let i = period; i < tr.length; i++) {
    atr[i] = (atr[i - 1] * (period - 1) + tr[i]) / period;
  }
  return atr;
}

function computeADX(highs, lows, closes, period) {
  const len = highs.length;
  const adx = new Array(len).fill(0);

  if (len < period * 2) return adx;

  const plusDM = [];
  const minusDM = [];
  const tr = [];

  for (let i = 1; i < len; i++) {
    const upMove = highs[i] - highs[i - 1];
    const downMove = lows[i - 1] - lows[i];
    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
    tr.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])));
  }

  const smoothedTR = smoothArray(tr, period);
  const smoothedPlusDM = smoothArray(plusDM, period);
  const smoothedMinusDM = smoothArray(minusDM, period);

  const dx = [];
  for (let i = 0; i < smoothedTR.length; i++) {
    if (smoothedTR[i] === 0) { dx.push(0); continue; }
    const plusDI = (smoothedPlusDM[i] / smoothedTR[i]) * 100;
    const minusDI = (smoothedMinusDM[i] / smoothedTR[i]) * 100;
    const sum = plusDI + minusDI;
    dx.push(sum === 0 ? 0 : (Math.abs(plusDI - minusDI) / sum) * 100);
  }

  const adxSmoothed = smoothArray(dx, period);
  for (let i = 0; i < adxSmoothed.length && (i + period * 2 - 1) < len; i++) {
    adx[i + period * 2 - 1] = adxSmoothed[i];
  }

  return adx;
}

function smoothArray(arr, period) {
  if (arr.length < period) return [];
  const result = [];
  let sum = 0;
  for (let i = 0; i < period; i++) sum += arr[i];
  result.push(sum);
  for (let i = period; i < arr.length; i++) {
    result.push(result[result.length - 1] - result[result.length - 1] / period + arr[i]);
  }
  return result;
}

function round5(val) {
  return val ? Math.round(val * 100000) / 100000 : null;
}
