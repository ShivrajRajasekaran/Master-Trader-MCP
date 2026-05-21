/**
 * Kalman Filter + Supertrend Trend Confirmation Engine
 * Ported from AlgoAlpha "Range Filtered Trend Signals"
 *
 * Detects TRENDING vs RANGING markets.
 * Master traders NEVER trade during ranging conditions.
 */

export class KalmanFilter {
  constructor(options = {}) {
    this.alpha = options.alpha || 0.01;
    this.beta = options.beta || 0.1;
    this.period = options.period || 77;
    this.deviation = options.deviation || 1.2;
    this.stFactor = options.stFactor || 0.7;
    this.stAtrPeriod = options.stAtrPeriod || 7;

    this.v1 = null;
    this.v2 = 1.0;
    this.v3 = this.alpha * this.beta;
  }

  computeKalmanLine(price) {
    if (this.v1 === null) {
      this.v1 = price;
      return price;
    }

    const v5 = this.v1;
    const v4 = this.v2 / (this.v2 + this.v3);
    this.v1 = v5 + v4 * (price - v5);
    this.v2 = (1 - v4) * this.v2 + this.beta / this.period;

    return this.v1;
  }

  reset() {
    this.v1 = null;
    this.v2 = 1.0;
  }
}

export function computeATR(bars, period = 14) {
  if (bars.length < period + 1) return null;

  let sum = 0;
  for (let i = bars.length - period; i < bars.length; i++) {
    const tr = Math.max(
      bars[i].high - bars[i].low,
      Math.abs(bars[i].high - bars[i - 1].close),
      Math.abs(bars[i].low - bars[i - 1].close)
    );
    sum += tr;
  }
  return sum / period;
}

export function computeWMA(values, period) {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  let weightedSum = 0;
  let weightTotal = 0;
  for (let i = 0; i < slice.length; i++) {
    const w = i + 1;
    weightedSum += slice[i] * w;
    weightTotal += w;
  }
  return weightedSum / weightTotal;
}

export function computeSupertrend(kalmanValues, bars, factor = 0.7, atrPeriod = 7) {
  if (bars.length < atrPeriod + 1 || kalmanValues.length < 2) {
    return { direction: 0, value: null };
  }

  const atr = computeATR(bars, atrPeriod);
  if (!atr) return { direction: 0, value: null };

  const k = kalmanValues[kalmanValues.length - 1];
  const kPrev = kalmanValues[kalmanValues.length - 2];
  const price = bars[bars.length - 1].close;
  const pricePrev = bars[bars.length - 2].close;

  const upperBand = k + factor * atr;
  const lowerBand = k - factor * atr;

  // Supertrend logic: price position relative to Kalman bands determines trend
  // Bullish: price closes above upper band (trend up)
  // Bearish: price closes below lower band (trend down)
  // Use state persistence: once bullish, stay bullish until price closes below lower
  let direction = 0;
  if (price > upperBand) direction = -1; // bullish (matches AlgoAlpha convention)
  else if (price < lowerBand) direction = 1; // bearish
  else {
    // Inside bands — use momentum of Kalman slope
    if (k > kPrev && price > k) direction = -1;
    else if (k < kPrev && price < k) direction = 1;
  }

  return { direction, value: direction === -1 ? lowerBand : upperBand, atr, upperBand, lowerBand };
}

export function analyzeTrend(bars, options = {}) {
  const kf = new KalmanFilter(options);
  const kalmanValues = [];
  const ranges = [];

  for (const bar of bars) {
    const kLine = kf.computeKalmanLine(bar.close);
    kalmanValues.push(kLine);
    ranges.push(bar.high - bar.low);
  }

  const k = kalmanValues[kalmanValues.length - 1];
  const price = bars[bars.length - 1].close;
  const deviation = options.deviation || 1.2;

  // Volatility bands (WMA of range * deviation)
  const vola = computeWMA(ranges, Math.min(200, ranges.length));
  const kalmanUpper = k + (vola || 0) * deviation;
  const kalmanLower = k - (vola || 0) * deviation;

  // Short-term trend (price vs Kalman bands)
  let trendAA = 0;
  if (price > kalmanUpper) trendAA = 1;
  else if (price < kalmanLower) trendAA = -1;

  // Long-term trend (Supertrend on Kalman)
  const st = computeSupertrend(kalmanValues, bars, options.stFactor, options.stAtrPeriod);
  const ktrend = st.direction < 0 ? 1 : st.direction > 0 ? -1 : 0;

  // Master flags
  const trendConfirmed = ktrend * trendAA === 1;
  const isRanging = ktrend * trendAA === -1;

  let label = "Neutral";
  if (isRanging) label = "Ranging";
  else if (trendAA === 1 && trendConfirmed) label = "Bullish";
  else if (trendAA === -1 && trendConfirmed) label = "Bearish";

  return {
    kalmanLine: k,
    kalmanUpper,
    kalmanLower,
    trendAA,
    ktrend,
    trendConfirmed,
    isRanging,
    label,
    atr: st.atr || computeATR(bars, 14),
    canTrade: !isRanging,
    reason: isRanging
      ? "RANGING — Kalman + Supertrend disagree. NO TRADE."
      : trendConfirmed
        ? `TRENDING ${label.toUpperCase()} — confirmed`
        : "Neutral — wait for confirmation",
  };
}
