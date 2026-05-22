/**
 * Range Trading Engine
 * Detects sideways/consolidation zones and trades mean reversion at boundaries.
 *
 * Logic: When market is ranging (ADX < 25, price between S/R), buy at support, sell at resistance.
 * Exit: Opposite boundary or midpoint, stop beyond the range.
 * CRITICAL: Exit immediately if range breaks (breakout invalidation).
 */

export function analyzeRangeTrading(bars, config = {}) {
  const {
    lookback = 50,
    adxThreshold = 25,
    bounceConfirmation = true,
    atrPeriod = 14,
  } = config;

  if (!bars || bars.length < lookback) {
    return { signal: "WAIT", reason: "Insufficient data" };
  }

  const closes = bars.map(b => b.close);
  const highs = bars.map(b => b.high);
  const lows = bars.map(b => b.low);

  // Step 1: Is market ranging?
  const adx = computeADXSimple(highs, lows, closes, 14);
  const isRanging = adx < adxThreshold;

  if (!isRanging) {
    return {
      signal: "WAIT",
      reason: `ADX = ${Math.round(adx)} — Market is trending, not ranging. Use Trend Following instead.`,
      adx: Math.round(adx),
      marketState: "TRENDING",
    };
  }

  // Step 2: Define the range
  const range = detectRange(bars.slice(-lookback));

  if (!range.valid) {
    return { signal: "WAIT", reason: "No clear range detected", adx: Math.round(adx) };
  }

  // Step 3: Where is price within the range?
  const currentPrice = closes[closes.length - 1];
  const position = pricePositionInRange(currentPrice, range);

  // Step 4: Look for bounce confirmation at boundaries
  const recentBars = bars.slice(-5);
  const bounceSignal = detectBounce(recentBars, range, position);

  // Step 5: Generate signal
  let signal = "WAIT";
  let trade = null;
  const atr = computeATRSimple(highs.slice(-atrPeriod), lows.slice(-atrPeriod), closes.slice(-atrPeriod));

  if (position.zone === "SUPPORT" && bounceSignal.bouncing) {
    signal = "BUY";
    const entry = currentPrice;
    const stopLoss = range.support - atr * 1.0;
    trade = {
      entry: round5(entry),
      stopLoss: round5(stopLoss),
      target1: round5(range.midpoint),
      target2: round5(range.resistance),
      riskReward: round5((range.midpoint - entry) / (entry - stopLoss)),
      invalidation: `Close below ${round5(range.support - atr * 0.5)} = range broken, exit immediately`,
    };
  } else if (position.zone === "RESISTANCE" && bounceSignal.bouncing) {
    signal = "SELL";
    const entry = currentPrice;
    const stopLoss = range.resistance + atr * 1.0;
    trade = {
      entry: round5(entry),
      stopLoss: round5(stopLoss),
      target1: round5(range.midpoint),
      target2: round5(range.support),
      riskReward: round5((entry - range.midpoint) / (stopLoss - entry)),
      invalidation: `Close above ${round5(range.resistance + atr * 0.5)} = range broken, exit immediately`,
    };
  }

  // Score
  let score = 0;
  if (isRanging) score += 20;
  if (range.valid) score += 20;
  if (range.touches >= 4) score += 15;
  if (position.zone === "SUPPORT" || position.zone === "RESISTANCE") score += 20;
  if (bounceSignal.bouncing) score += 15;
  if (range.width / currentPrice * 100 > 1) score += 10; // Range wide enough to be tradeable

  return {
    signal,
    score: Math.min(100, score),
    marketState: "RANGING",
    adx: Math.round(adx),
    range: {
      resistance: round5(range.resistance),
      support: round5(range.support),
      midpoint: round5(range.midpoint),
      width: round5(range.width),
      widthPct: Math.round((range.width / currentPrice) * 10000) / 100,
      touches: range.touches,
      durationBars: range.duration,
    },
    pricePosition: position,
    bounce: bounceSignal,
    trade,
    rules: {
      entry: "Only at range boundaries with rejection candle confirmation",
      stop: "Beyond range boundary + 1 ATR buffer",
      target: "Midpoint (conservative) or opposite boundary (aggressive)",
      breakoutExit: "If price closes beyond range + 0.5 ATR, EXIT immediately — range is broken",
      maxTrades: "Max 3 round-trips per range before expecting breakout",
    },
  };
}

function detectRange(bars) {
  const highs = bars.map(b => b.high);
  const lows = bars.map(b => b.low);
  const closes = bars.map(b => b.close);

  // Find resistance (cluster of highs)
  const sortedHighs = [...highs].sort((a, b) => b - a);
  const topCluster = sortedHighs.slice(0, 5);
  const resistance = topCluster.reduce((a, b) => a + b, 0) / topCluster.length;

  // Find support (cluster of lows)
  const sortedLows = [...lows].sort((a, b) => a - b);
  const bottomCluster = sortedLows.slice(0, 5);
  const support = bottomCluster.reduce((a, b) => a + b, 0) / bottomCluster.length;

  const width = resistance - support;
  const midpoint = (resistance + support) / 2;

  // Count touches
  let resistanceTouches = 0;
  let supportTouches = 0;
  const touchZone = width * 0.1;

  for (const bar of bars) {
    if (bar.high >= resistance - touchZone) resistanceTouches++;
    if (bar.low <= support + touchZone) supportTouches++;
  }

  // Validate: range must have multiple touches and price must be contained
  const containedBars = bars.filter(b => b.close >= support && b.close <= resistance).length;
  const containmentPct = containedBars / bars.length;

  const valid = containmentPct > 0.7 && resistanceTouches >= 2 && supportTouches >= 2 && width > 0;

  return {
    valid,
    resistance,
    support,
    midpoint,
    width,
    touches: resistanceTouches + supportTouches,
    resistanceTouches,
    supportTouches,
    containmentPct: Math.round(containmentPct * 100),
    duration: bars.length,
  };
}

function pricePositionInRange(price, range) {
  const { resistance, support, width } = range;
  const pctFromSupport = ((price - support) / width) * 100;

  let zone;
  if (pctFromSupport <= 20) zone = "SUPPORT";
  else if (pctFromSupport >= 80) zone = "RESISTANCE";
  else if (pctFromSupport >= 40 && pctFromSupport <= 60) zone = "MIDPOINT";
  else zone = "NO_MANS_LAND";

  return {
    pctFromSupport: Math.round(pctFromSupport),
    zone,
    description: zone === "SUPPORT" ? "Near range bottom — look for BUY" :
      zone === "RESISTANCE" ? "Near range top — look for SELL" :
      zone === "MIDPOINT" ? "At midpoint — no trade (bad R:R)" :
      "Between levels — wait for boundary",
  };
}

function detectBounce(recentBars, range, position) {
  if (recentBars.length < 2) return { bouncing: false };

  const last = recentBars[recentBars.length - 1];
  const prev = recentBars[recentBars.length - 2];

  if (position.zone === "SUPPORT") {
    // Look for bullish rejection at support
    const lowerWick = Math.min(last.open, last.close) - last.low;
    const body = Math.abs(last.close - last.open);
    const bullishClose = last.close > last.open;

    if (bullishClose && lowerWick > body * 1.5) {
      return { bouncing: true, type: "PIN_BAR_BOUNCE", strength: 80 };
    }
    if (bullishClose && last.close > prev.high) {
      return { bouncing: true, type: "ENGULFING_BOUNCE", strength: 85 };
    }
    if (bullishClose) {
      return { bouncing: true, type: "GREEN_CLOSE_AT_SUPPORT", strength: 60 };
    }
  }

  if (position.zone === "RESISTANCE") {
    const upperWick = last.high - Math.max(last.open, last.close);
    const body = Math.abs(last.close - last.open);
    const bearishClose = last.close < last.open;

    if (bearishClose && upperWick > body * 1.5) {
      return { bouncing: true, type: "PIN_BAR_REJECTION", strength: 80 };
    }
    if (bearishClose && last.close < prev.low) {
      return { bouncing: true, type: "ENGULFING_REJECTION", strength: 85 };
    }
    if (bearishClose) {
      return { bouncing: true, type: "RED_CLOSE_AT_RESISTANCE", strength: 60 };
    }
  }

  return { bouncing: false, reason: "No confirmation candle" };
}

function computeADXSimple(highs, lows, closes, period) {
  if (highs.length < period * 3) return 0;

  let sumTR = 0, sumPlusDM = 0, sumMinusDM = 0;
  const dxValues = [];

  for (let i = 1; i < highs.length; i++) {
    const tr = Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i-1]), Math.abs(lows[i] - closes[i-1]));
    const upMove = highs[i] - highs[i-1];
    const downMove = lows[i-1] - lows[i];
    const plusDM = upMove > downMove && upMove > 0 ? upMove : 0;
    const minusDM = downMove > upMove && downMove > 0 ? downMove : 0;

    if (i <= period) {
      sumTR += tr;
      sumPlusDM += plusDM;
      sumMinusDM += minusDM;
    } else {
      sumTR = sumTR - sumTR / period + tr;
      sumPlusDM = sumPlusDM - sumPlusDM / period + plusDM;
      sumMinusDM = sumMinusDM - sumMinusDM / period + minusDM;
    }

    if (i >= period) {
      const plusDI = sumTR > 0 ? (sumPlusDM / sumTR) * 100 : 0;
      const minusDI = sumTR > 0 ? (sumMinusDM / sumTR) * 100 : 0;
      const diSum = plusDI + minusDI;
      const dx = diSum > 0 ? (Math.abs(plusDI - minusDI) / diSum) * 100 : 0;
      dxValues.push(dx);
    }
  }

  if (dxValues.length < period) return 0;
  const adxSlice = dxValues.slice(-period);
  return adxSlice.reduce((a, b) => a + b, 0) / adxSlice.length;
}

function computeATRSimple(highs, lows, closes) {
  let sum = 0;
  for (let i = 1; i < highs.length; i++) {
    sum += Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i-1]), Math.abs(lows[i] - closes[i-1]));
  }
  return sum / (highs.length - 1);
}

function round5(val) {
  return val ? Math.round(val * 100000) / 100000 : null;
}
