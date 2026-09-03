import type { Allocation } from "./debate";
import type { PriceQuote } from "./prices";
import type { Agent } from "./agents";
import { scoreAsset } from "./debate";
import type { QuantResearchReport } from "./market-intelligence";

const MAX_PICKS = 6;
const MAX_PERCENT_PER_ASSET = 22;
const MIN_CRYPTO_PICKS = 2;
const MIN_STOCK_PICKS = 2;

function scoreAll(prices: PriceQuote[], agents: Agent[]) {
  const scores: Record<string, { score: number; quote: PriceQuote }> = {};
  for (const quote of prices) {
    if (!quote.trusted || quote.price <= 0) continue;
    let total = 0;
    for (const agent of agents) total += scoreAsset(quote, agent.id).score;
    scores[quote.symbol] = { score: total / agents.length, quote };
  }
  return scores;
}

/** Spread budget across stocks + crypto — never 100% in one token */
export function computeDiversifiedAllocation(
  amountUsd: number,
  prices: PriceQuote[],
  agents: Agent[]
): Allocation[] {
  const scores = scoreAll(prices, agents);
  const stocks = Object.entries(scores)
    .filter(([, v]) => v.quote.type === "stock")
    .sort(([, a], [, b]) => b.score - a.score);
  const cryptos = Object.entries(scores)
    .filter(([, v]) => v.quote.type === "crypto")
    .sort(([, a], [, b]) => b.score - a.score);

  const picks: Array<[string, number, PriceQuote]> = [];
  for (const [sym, v] of stocks.slice(0, Math.max(MIN_STOCK_PICKS, 3))) {
    picks.push([sym, v.score, v.quote]);
  }
  for (const [sym, v] of cryptos.slice(0, Math.max(MIN_CRYPTO_PICKS, 3))) {
    if (!picks.find((p) => p[0] === sym)) picks.push([sym, v.score, v.quote]);
  }

  const trimmed = picks.slice(0, MAX_PICKS);
  const totalScore = trimmed.reduce((s, [, sc]) => s + sc, 0) || 1;

  let raw = trimmed.map(([symbol, score, quote]) => ({
    symbol,
    name: quote.name,
    type: quote.type,
    percent: (score / totalScore) * 100,
    quote,
    score,
  }));

  raw = raw.map((r) => ({
    ...r,
    percent: Math.min(MAX_PERCENT_PER_ASSET, Math.max(8, Math.round(r.percent))),
  }));

  const sum = raw.reduce((s, r) => s + r.percent, 0);
  if (sum !== 100 && raw.length > 0) {
    const diff = 100 - sum;
    raw[0].percent += diff;
  }

  return raw.map((r) => ({
    symbol: r.symbol,
    name: r.name,
    type: r.type,
    percent: r.percent,
    amount: Math.round((amountUsd * r.percent) / 100),
    reason: `Split ${r.percent}% ($${Math.round((amountUsd * r.percent) / 100)}) · score ${(r.score * 100).toFixed(0)}/100`,
  }));
}

/** Quant-first allocation. Failed screens remain in cash instead of forcing a trade. */
export function computeQuantAllocation(
  amountUsd: number,
  prices: PriceQuote[],
  research: QuantResearchReport
): Allocation[] {
  const priceMap = new Map(prices.map((price) => [price.symbol, price]));
  const eligible = research.assets
    .filter((asset) => asset.quant.passed && priceMap.get(asset.symbol)?.trusted)
    .slice(0, MAX_PICKS);
  const totalScore = eligible.reduce((sum, asset) => sum + asset.quant.score, 0) || 1;

  return eligible.map((asset) => {
    const rawPercent = (asset.quant.score / totalScore) * 100;
    const percent = Math.min(MAX_PERCENT_PER_ASSET, Math.round(rawPercent));
    const amount = Math.round(amountUsd * (percent / 100) * 100) / 100;
    return {
      symbol: asset.symbol,
      name: priceMap.get(asset.symbol)?.name ?? asset.symbol,
      type: asset.type,
      percent,
      amount,
      reason:
        `Quant ${asset.quant.score}/100 · RS ${asset.quant.relativeStrength.toFixed(1)}% · ` +
        `RSI ${asset.quant.rsi14.toFixed(1)} · volume ${asset.quant.volumeRatio.toFixed(2)}×`,
    };
  });
}

export function describePurchase(
  symbol: string,
  usdcBudgetUsd: number,
  priceUsd: number,
  tokenAmount: number
): string {
  const qty = tokenAmount;
  const qtyStr =
    qty >= 1 ? qty.toFixed(4) : qty >= 0.01 ? qty.toFixed(6) : qty.toFixed(8);
  return `$${usdcBudgetUsd.toFixed(2)} tUSDC → ${qtyStr} ${symbol} @ $${priceUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}
