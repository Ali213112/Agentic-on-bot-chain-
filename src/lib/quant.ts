import type { MarketCandle } from "./finnhub";

export interface QuantScreen {
  symbol: string;
  benchmark: "BTC" | "QQQ";
  score: number;
  signal: "strong-buy" | "buy" | "watch" | "avoid";
  return20d: number;
  benchmarkReturn20d: number;
  relativeStrength: number;
  rsi14: number;
  atrPercent: number;
  volumeRatio: number;
  trendConsistency: number;
  spikeRatio: number;
  sizeMultiplier: number;
  passed: boolean;
  reasons: string[];
  warnings: string[];
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function pctChange(from: number, to: number) {
  return from > 0 ? ((to - from) / from) * 100 : 0;
}

function calculateRsi(closes: number[], period = 14) {
  if (closes.length <= period) return 50;
  const changes = closes.slice(-period - 1).slice(1).map((close, index) => {
    const previous = closes[closes.length - period - 1 + index];
    return close - previous;
  });
  const gains = changes.reduce((sum, change) => sum + Math.max(change, 0), 0) / period;
  const losses = changes.reduce((sum, change) => sum + Math.max(-change, 0), 0) / period;
  if (losses === 0) return gains > 0 ? 100 : 50;
  return 100 - 100 / (1 + gains / losses);
}

function calculateAtrPercent(candles: MarketCandle[], period = 14) {
  const sample = candles.slice(-period);
  if (sample.length < 2) return 0;
  const trueRanges = sample.slice(1).map((candle, index) => {
    const previousClose = sample[index].close;
    return Math.max(
      candle.high - candle.low,
      Math.abs(candle.high - previousClose),
      Math.abs(candle.low - previousClose)
    );
  });
  const atr = trueRanges.reduce((sum, value) => sum + value, 0) / trueRanges.length;
  const close = sample.at(-1)?.close ?? 0;
  return close > 0 ? (atr / close) * 100 : 0;
}

export function screenAsset(
  symbol: string,
  type: "stock" | "crypto",
  candles: MarketCandle[],
  benchmarkCandles: MarketCandle[]
): QuantScreen {
  const sample = candles.filter((c) => c.close > 0).slice(-21);
  const benchmarkSample = benchmarkCandles.filter((c) => c.close > 0).slice(-21);
  const benchmark = type === "crypto" ? "BTC" : "QQQ";
  const reasons: string[] = [];
  const warnings: string[] = [];

  if (sample.length < 15 || benchmarkSample.length < 15) {
    return {
      symbol,
      benchmark,
      score: 0,
      signal: "avoid",
      return20d: 0,
      benchmarkReturn20d: 0,
      relativeStrength: 0,
      rsi14: 50,
      atrPercent: 0,
      volumeRatio: 0,
      trendConsistency: 0,
      spikeRatio: 1,
      sizeMultiplier: 0,
      passed: false,
      reasons,
      warnings: ["Insufficient candle history for a defensible quant decision"],
    };
  }

  const closes = sample.map((c) => c.close);
  const return20d = pctChange(closes[0], closes.at(-1)!);
  const benchmarkReturn20d = pctChange(
    benchmarkSample[0].close,
    benchmarkSample.at(-1)!.close
  );
  const relativeStrength = return20d - benchmarkReturn20d;
  const rsi14 = calculateRsi(closes);
  const atrPercent = calculateAtrPercent(sample);

  const recentVolume = sample.slice(-5).reduce((sum, c) => sum + c.volume, 0) / 5;
  const baseVolume =
    sample.slice(0, -5).reduce((sum, c) => sum + c.volume, 0) /
    Math.max(1, sample.length - 5);
  const volumeRatio = baseVolume > 0 ? recentVolume / baseVolume : 0;

  const dailyReturns = closes.slice(1).map((close, index) => pctChange(closes[index], close));
  const direction = return20d >= 0 ? 1 : -1;
  const alignedDays = dailyReturns.filter((value) => value * direction > 0).length;
  const trendConsistency = alignedDays / Math.max(1, dailyReturns.length);
  const absoluteMove = dailyReturns.reduce((sum, value) => sum + Math.abs(value), 0);
  const spikeRatio = absoluteMove > 0
    ? Math.max(...dailyReturns.map(Math.abs)) / absoluteMove
    : 0;

  let score = 50;
  score += clamp(relativeStrength * 2, -20, 20);
  if (volumeRatio >= 1.1) {
    score += 10;
    reasons.push(`Volume confirms the move (${volumeRatio.toFixed(2)}× baseline)`);
  } else {
    score -= 8;
    warnings.push(`Weak volume confirmation (${volumeRatio.toFixed(2)}× baseline)`);
  }

  if (rsi14 >= 45 && rsi14 <= 68) {
    score += 8;
    reasons.push(`RSI ${rsi14.toFixed(1)} supports momentum without being overbought`);
  } else if (rsi14 > 72) {
    score -= 18;
    warnings.push(`RSI ${rsi14.toFixed(1)} is overbought; do not chase`);
  } else if (rsi14 < 30) {
    score -= 6;
    warnings.push(`RSI ${rsi14.toFixed(1)} is oversold but lacks reversal confirmation`);
  }

  if (trendConsistency >= 0.6 && spikeRatio <= 0.35) {
    score += 10;
    reasons.push("Trend is consistent rather than driven by one session");
  } else {
    score -= 10;
    warnings.push("Move is inconsistent or dominated by a single-session spike");
  }

  if (relativeStrength > 0) {
    reasons.push(`Outperformed ${benchmark} by ${relativeStrength.toFixed(2)}% over the window`);
  } else {
    warnings.push(`Underperformed ${benchmark} by ${Math.abs(relativeStrength).toFixed(2)}%`);
  }

  const volatilityTarget = type === "crypto" ? 5 : 3;
  const sizeMultiplier = clamp(
    atrPercent > 0 ? volatilityTarget / atrPercent : 0.5,
    0.25,
    1
  );
  if (sizeMultiplier < 0.75) {
    warnings.push(`ATR ${atrPercent.toFixed(2)}% requires reduced position size`);
  }

  score = Math.round(clamp(score, 0, 100));
  const hardFail = rsi14 > 78 || spikeRatio > 0.55 || relativeStrength < -8;
  const passed = score >= 58 && !hardFail;
  const signal =
    passed && score >= 78
      ? "strong-buy"
      : passed
        ? "buy"
        : score >= 45
          ? "watch"
          : "avoid";

  return {
    symbol,
    benchmark,
    score,
    signal,
    return20d,
    benchmarkReturn20d,
    relativeStrength,
    rsi14,
    atrPercent,
    volumeRatio,
    trendConsistency,
    spikeRatio,
    sizeMultiplier,
    passed,
    reasons,
    warnings,
  };
}
