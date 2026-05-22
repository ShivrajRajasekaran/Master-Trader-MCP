/**
 * C4 Strategy Engine — Rules-Based S/R Reversal System
 *
 * C4 = 4 Confirmations before entry:
 *   C1: Key Support/Resistance Zone identified (HTF)
 *   C2: Price Action Rejection (wick, engulfing, pin bar at zone)
 *   C3: Momentum Shift (RSI divergence or structure break on LTF)
 *   C4: Entry Trigger (candle close confirmation + volume)
 *
 * Trades reversals/pullbacks at institutional S/R zones.
 * Works on Forex, Gold, Indices — any liquid market.
 */

export function identifyC4Setup(candles, zones, indicators) {
  if (!candles || candles.length < 20 || !zones || zones.length === 0) {
    return { setup: false, reason: "Insufficient data" };
  }

  const current = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  const prev2 = candles[candles.length - 3];

  const c1 = checkC1_ZoneProximity(current, zones);
  if (!c1.confirmed) {
    return { setup: false, stage: "C1", reason: "Price not at key S/R zone" };
  }

  const c2 = checkC2_PriceRejection(candles.slice(-5), c1.zone);
  if (!c2.confirmed) {
    return { setup: false, stage: "C2", reason: "No rejection pattern at zone" };
  }

  const c3 = checkC3_MomentumShift(candles.slice(-14), indicators);
  if (!c3.confirmed) {
    return { setup: false, stage: "C3", reason: "No momentum divergence/shift" };
  }

  const c4 = checkC4_EntryTrigger(candles.slice(-3), c1.zone.type, indicators);
  if (!c4.confirmed) {
    return { setup: false, stage: "C4", reason: "No confirmed entry trigger yet" };
  }

  const direction = c1.zone.type === "support" ? "BUY" : "SELL";
  const entry = current.close;
  const stopLoss = calculateStop(current, c1.zone, direction);
  const targets = calculateTargets(entry, stopLoss, direction);

  return {
    setup: true,
    direction,
    confirmations: {
      c1: c1,
      c2: c2,
      c3: c3,
      c4: c4,
    },
    trade: {
      entry,
      stopLoss,
      target1: targets.t1,
      target2: targets.t2,
      target3: targets.t3,
      riskReward: targets.rr,
    },
    zone: c1.zone,
    strength: calculateSetupStrength(c1, c2, c3, c4),
  };
}

/**
 * C1: Key S/R Zone Proximity
 * Price must be within 0.3% of a significant support or resistance level.
 */
export function checkC1_ZoneProximity(candle, zones, proximityPct = 0.3) {
  for (const zone of zones) {
    const zoneCenter = (zone.high + zone.low) / 2;
    const distance = Math.abs(candle.close - zoneCenter) / candle.close * 100;

    if (distance <= proximityPct) {
      const touchCount = zone.touches || 1;
      const strength = Math.min(100, touchCount * 20 + (zone.htf ? 30 : 0));

      return {
        confirmed: true,
        zone: zone,
        distance: Math.round(distance * 100) / 100,
        strength,
        description: `Price at ${zone.type} zone (${zone.high}-${zone.low}), touched ${touchCount}x`,
      };
    }
  }

  return { confirmed: false };
}

/**
 * C2: Price Action Rejection at Zone
 * Look for: pin bars, engulfing candles, long wicks, hammer/shooting star
 */
export function checkC2_PriceRejection(recentCandles, zone) {
  const patterns = [];
  const last3 = recentCandles.slice(-3);

  for (let i = 0; i < last3.length; i++) {
    const c = last3[i];
    const body = Math.abs(c.close - c.open);
    const range = c.high - c.low;
    const upperWick = c.high - Math.max(c.open, c.close);
    const lowerWick = Math.min(c.open, c.close) - c.low;

    if (range === 0) continue;

    // Pin bar at support (long lower wick)
    if (zone.type === "support" && lowerWick > body * 2 && lowerWick > range * 0.6) {
      patterns.push({ type: "PIN_BAR_BULLISH", candle: i, strength: 80 });
    }

    // Pin bar at resistance (long upper wick)
    if (zone.type === "resistance" && upperWick > body * 2 && upperWick > range * 0.6) {
      patterns.push({ type: "PIN_BAR_BEARISH", candle: i, strength: 80 });
    }

    // Bullish engulfing at support
    if (i > 0 && zone.type === "support") {
      const prev = last3[i - 1];
      if (prev.close < prev.open && c.close > c.open &&
          c.close > prev.open && c.open < prev.close) {
        patterns.push({ type: "BULLISH_ENGULFING", candle: i, strength: 85 });
      }
    }

    // Bearish engulfing at resistance
    if (i > 0 && zone.type === "resistance") {
      const prev = last3[i - 1];
      if (prev.close > prev.open && c.close < c.open &&
          c.close < prev.open && c.open > prev.close) {
        patterns.push({ type: "BEARISH_ENGULFING", candle: i, strength: 85 });
      }
    }

    // Doji at zone (indecision → reversal)
    if (body < range * 0.1 && range > 0) {
      patterns.push({ type: "DOJI_AT_ZONE", candle: i, strength: 60 });
    }
  }

  if (patterns.length === 0) {
    return { confirmed: false };
  }

  const bestPattern = patterns.reduce((a, b) => a.strength > b.strength ? a : b);

  return {
    confirmed: true,
    pattern: bestPattern.type,
    strength: bestPattern.strength,
    allPatterns: patterns,
    description: `${bestPattern.type} detected at ${zone.type} zone`,
  };
}

/**
 * C3: Momentum Shift
 * RSI divergence, MACD histogram flip, or LTF structure break
 */
export function checkC3_MomentumShift(candles, indicators = {}) {
  const signals = [];

  // RSI Divergence check
  if (indicators.rsi && indicators.rsi.length >= 5) {
    const rsiRecent = indicators.rsi.slice(-5);
    const pricesRecent = candles.slice(-5).map(c => c.close);

    // Bullish divergence: price making lower low, RSI making higher low
    const priceLowerLow = pricesRecent[pricesRecent.length - 1] < Math.min(...pricesRecent.slice(0, -1));
    const rsiHigherLow = rsiRecent[rsiRecent.length - 1] > Math.min(...rsiRecent.slice(0, -1));

    if (priceLowerLow && rsiHigherLow) {
      signals.push({ type: "BULLISH_RSI_DIVERGENCE", strength: 75 });
    }

    // Bearish divergence: price making higher high, RSI making lower high
    const priceHigherHigh = pricesRecent[pricesRecent.length - 1] > Math.max(...pricesRecent.slice(0, -1));
    const rsiLowerHigh = rsiRecent[rsiRecent.length - 1] < Math.max(...rsiRecent.slice(0, -1));

    if (priceHigherHigh && rsiLowerHigh) {
      signals.push({ type: "BEARISH_RSI_DIVERGENCE", strength: 75 });
    }

    // RSI oversold/overbought at zone
    const lastRSI = rsiRecent[rsiRecent.length - 1];
    if (lastRSI < 30) signals.push({ type: "RSI_OVERSOLD", strength: 60 });
    if (lastRSI > 70) signals.push({ type: "RSI_OVERBOUGHT", strength: 60 });
  }

  // MACD histogram flip
  if (indicators.macdHist && indicators.macdHist.length >= 3) {
    const hist = indicators.macdHist.slice(-3);
    if (hist[0] < 0 && hist[1] < 0 && hist[2] > 0) {
      signals.push({ type: "MACD_BULLISH_FLIP", strength: 70 });
    }
    if (hist[0] > 0 && hist[1] > 0 && hist[2] < 0) {
      signals.push({ type: "MACD_BEARISH_FLIP", strength: 70 });
    }
  }

  // Structure break (lower timeframe)
  if (candles.length >= 5) {
    const highs = candles.slice(-5).map(c => c.high);
    const lows = candles.slice(-5).map(c => c.low);
    const lastClose = candles[candles.length - 1].close;

    // Break of recent swing high (bullish structure shift)
    const recentSwingHigh = Math.max(...highs.slice(0, -1));
    if (lastClose > recentSwingHigh) {
      signals.push({ type: "BULLISH_STRUCTURE_BREAK", strength: 80 });
    }

    // Break of recent swing low (bearish structure shift)
    const recentSwingLow = Math.min(...lows.slice(0, -1));
    if (lastClose < recentSwingLow) {
      signals.push({ type: "BEARISH_STRUCTURE_BREAK", strength: 80 });
    }
  }

  if (signals.length === 0) {
    return { confirmed: false };
  }

  const bestSignal = signals.reduce((a, b) => a.strength > b.strength ? a : b);

  return {
    confirmed: true,
    signal: bestSignal.type,
    strength: bestSignal.strength,
    allSignals: signals,
    description: `Momentum shift: ${bestSignal.type}`,
  };
}

/**
 * C4: Entry Trigger — Final confirmation candle
 * Bullish: close above zone high (for support bounce)
 * Bearish: close below zone low (for resistance rejection)
 */
export function checkC4_EntryTrigger(recentCandles, zoneType, indicators = {}) {
  const current = recentCandles[recentCandles.length - 1];
  const prev = recentCandles[recentCandles.length - 2];

  let confirmed = false;
  let triggerType = "";

  if (zoneType === "support") {
    // Bullish close: green candle, closes above previous candle high
    if (current.close > current.open && current.close > prev.high) {
      confirmed = true;
      triggerType = "BULLISH_CLOSE_ABOVE_PREV_HIGH";
    }
    // Or: close above zone with momentum
    else if (current.close > current.open && current.close > prev.close) {
      confirmed = true;
      triggerType = "BULLISH_CONTINUATION_CLOSE";
    }
  } else {
    // Bearish close: red candle, closes below previous candle low
    if (current.close < current.open && current.close < prev.low) {
      confirmed = true;
      triggerType = "BEARISH_CLOSE_BELOW_PREV_LOW";
    }
    // Or: close below zone with momentum
    else if (current.close < current.open && current.close < prev.close) {
      confirmed = true;
      triggerType = "BEARISH_CONTINUATION_CLOSE";
    }
  }

  // Volume confirmation boost
  let volumeConfirmed = false;
  if (indicators.volume && indicators.volume.length >= 2) {
    const avgVol = indicators.volume.slice(0, -1).reduce((a, b) => a + b, 0) / (indicators.volume.length - 1);
    const currentVol = indicators.volume[indicators.volume.length - 1];
    volumeConfirmed = currentVol > avgVol * 1.2;
  }

  if (!confirmed) {
    return { confirmed: false };
  }

  return {
    confirmed: true,
    trigger: triggerType,
    volumeConfirmed,
    strength: volumeConfirmed ? 90 : 70,
    description: `Entry trigger: ${triggerType}${volumeConfirmed ? " + volume" : ""}`,
  };
}

function calculateStop(candle, zone, direction) {
  const buffer = (zone.high - zone.low) * 0.3;
  if (direction === "BUY") {
    return zone.low - buffer;
  } else {
    return zone.high + buffer;
  }
}

function calculateTargets(entry, stopLoss, direction) {
  const risk = Math.abs(entry - stopLoss);
  let t1, t2, t3;

  if (direction === "BUY") {
    t1 = entry + risk * 1.5;
    t2 = entry + risk * 2.5;
    t3 = entry + risk * 3.5;
  } else {
    t1 = entry - risk * 1.5;
    t2 = entry - risk * 2.5;
    t3 = entry - risk * 3.5;
  }

  return {
    t1: Math.round(t1 * 100000) / 100000,
    t2: Math.round(t2 * 100000) / 100000,
    t3: Math.round(t3 * 100000) / 100000,
    rr: "1:1.5 / 1:2.5 / 1:3.5",
  };
}

function calculateSetupStrength(c1, c2, c3, c4) {
  const weights = { c1: 0.2, c2: 0.3, c3: 0.25, c4: 0.25 };
  const score =
    (c1.strength || 50) * weights.c1 +
    (c2.strength || 50) * weights.c2 +
    (c3.strength || 50) * weights.c3 +
    (c4.strength || 50) * weights.c4;

  let grade;
  if (score >= 80) grade = "A+ (HIGH CONVICTION)";
  else if (score >= 65) grade = "A (GOOD SETUP)";
  else if (score >= 50) grade = "B (ACCEPTABLE)";
  else grade = "C (WEAK — SKIP)";

  return { score: Math.round(score), grade };
}

/**
 * Build S/R zones from price data (auto-detection)
 */
export function detectSRZones(candles, lookback = 50, touchThreshold = 2) {
  if (!candles || candles.length < lookback) return [];

  const relevant = candles.slice(-lookback);
  const zones = [];
  const tolerance = 0.002; // 0.2% clustering

  // Find swing highs and lows
  for (let i = 2; i < relevant.length - 2; i++) {
    const c = relevant[i];

    // Swing high
    if (c.high > relevant[i - 1].high && c.high > relevant[i - 2].high &&
        c.high > relevant[i + 1].high && c.high > relevant[i + 2].high) {
      addOrMergeZone(zones, c.high, "resistance", tolerance);
    }

    // Swing low
    if (c.low < relevant[i - 1].low && c.low < relevant[i - 2].low &&
        c.low < relevant[i + 1].low && c.low < relevant[i + 2].low) {
      addOrMergeZone(zones, c.low, "support", tolerance);
    }
  }

  // Filter by touch count
  return zones
    .filter(z => z.touches >= touchThreshold)
    .sort((a, b) => b.touches - a.touches);
}

function addOrMergeZone(zones, price, type, tolerance) {
  for (const zone of zones) {
    if (Math.abs(zone.center - price) / price < tolerance && zone.type === type) {
      zone.touches++;
      zone.high = Math.max(zone.high, price);
      zone.low = Math.min(zone.low, price);
      zone.center = (zone.high + zone.low) / 2;
      return;
    }
  }

  const spread = price * 0.001;
  zones.push({
    type,
    high: price + spread,
    low: price - spread,
    center: price,
    touches: 1,
  });
}
