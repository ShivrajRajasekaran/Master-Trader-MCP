/**
 * Key Levels Engine
 * PDH/PDL, PWH/PWL, Session Ranges, EQH/EQL detection.
 * These are the #1 liquidity targets institutions use.
 */

export function computePDH_PDL(dailyBars) {
  if (!dailyBars || dailyBars.length < 2) return null;
  const prevDay = dailyBars[dailyBars.length - 2];
  return {
    pdh: prevDay.high,
    pdl: prevDay.low,
    pdOpen: prevDay.open,
    pdClose: prevDay.close,
    pdMid: (prevDay.high + prevDay.low) / 2,
  };
}

export function computePWH_PWL(weeklyBars) {
  if (!weeklyBars || weeklyBars.length < 2) return null;
  const prevWeek = weeklyBars[weeklyBars.length - 2];
  return {
    pwh: prevWeek.high,
    pwl: prevWeek.low,
    pwOpen: prevWeek.open,
    pwClose: prevWeek.close,
    pwMid: (prevWeek.high + prevWeek.low) / 2,
  };
}

export function computeSessionRange(bars, sessionStartHourUTC, sessionEndHourUTC) {
  const sessionBars = bars.filter((b) => {
    const hour = new Date(b.time * 1000).getUTCHours();
    if (sessionStartHourUTC < sessionEndHourUTC) {
      return hour >= sessionStartHourUTC && hour < sessionEndHourUTC;
    }
    return hour >= sessionStartHourUTC || hour < sessionEndHourUTC;
  });

  if (sessionBars.length === 0) return null;

  return {
    high: Math.max(...sessionBars.map((b) => b.high)),
    low: Math.min(...sessionBars.map((b) => b.low)),
    open: sessionBars[0].open,
    close: sessionBars[sessionBars.length - 1].close,
    bars: sessionBars.length,
  };
}

export function getAsiaRange(bars) {
  return computeSessionRange(bars, 0, 6);
}

export function getLondonRange(bars) {
  return computeSessionRange(bars, 6, 12);
}

export function getNYRange(bars) {
  return computeSessionRange(bars, 12, 20);
}

export function detectEqualHighs(swingHighs, tolerance = 0.5) {
  const eqh = [];
  for (let i = 0; i < swingHighs.length - 1; i++) {
    for (let j = i + 1; j < swingHighs.length; j++) {
      const diff = Math.abs(swingHighs[i].price - swingHighs[j].price);
      if (diff <= tolerance) {
        eqh.push({
          price: (swingHighs[i].price + swingHighs[j].price) / 2,
          time1: swingHighs[i].time,
          time2: swingHighs[j].time,
          type: "EQH",
          liquidity: "BSL",
        });
      }
    }
  }
  return eqh;
}

export function detectEqualLows(swingLows, tolerance = 0.5) {
  const eql = [];
  for (let i = 0; i < swingLows.length - 1; i++) {
    for (let j = i + 1; j < swingLows.length; j++) {
      const diff = Math.abs(swingLows[i].price - swingLows[j].price);
      if (diff <= tolerance) {
        eql.push({
          price: (swingLows[i].price + swingLows[j].price) / 2,
          time1: swingLows[i].time,
          time2: swingLows[j].time,
          type: "EQL",
          liquidity: "SSL",
        });
      }
    }
  }
  return eql;
}

export function getAllKeyLevels(bars, dailyBars, weeklyBars, swingHighs, swingLows) {
  const levels = [];

  const pdh_pdl = computePDH_PDL(dailyBars);
  if (pdh_pdl) {
    levels.push({ price: pdh_pdl.pdh, label: "PDH", type: "liquidity", priority: 1 });
    levels.push({ price: pdh_pdl.pdl, label: "PDL", type: "liquidity", priority: 1 });
  }

  const pwh_pwl = computePWH_PWL(weeklyBars);
  if (pwh_pwl) {
    levels.push({ price: pwh_pwl.pwh, label: "PWH", type: "liquidity", priority: 1 });
    levels.push({ price: pwh_pwl.pwl, label: "PWL", type: "liquidity", priority: 1 });
  }

  const asia = getAsiaRange(bars);
  if (asia) {
    levels.push({ price: asia.high, label: "Asia High", type: "session", priority: 2 });
    levels.push({ price: asia.low, label: "Asia Low", type: "session", priority: 2 });
  }

  const london = getLondonRange(bars);
  if (london) {
    levels.push({ price: london.high, label: "London High", type: "session", priority: 2 });
    levels.push({ price: london.low, label: "London Low", type: "session", priority: 2 });
  }

  const eqh = detectEqualHighs(swingHighs);
  const eql = detectEqualLows(swingLows);
  eqh.forEach((e) => levels.push({ price: e.price, label: "EQH (BSL)", type: "engineered_liquidity", priority: 1 }));
  eql.forEach((e) => levels.push({ price: e.price, label: "EQL (SSL)", type: "engineered_liquidity", priority: 1 }));

  levels.sort((a, b) => b.price - a.price);
  return levels;
}
