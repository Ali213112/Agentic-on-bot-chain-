import { ALL_ASSETS, CRYPTOS, STOCKS } from "./assets";
import { getPriceEngine } from "./price-engine";

export interface PriceQuote {
  symbol: string;
  name: string;
  type: "stock" | "crypto";
  price: number;
  updatedAt: number;
  source: "finnhub";
  change24h?: number;
  change24hAbs?: number;
  high24h?: number;
  low24h?: number;
  volume24h?: number;
  previousClose?: number;
  trusted: boolean;
  stale?: boolean;
  error?: string;
}

export interface MarketSummary {
  totalAssets: number;
  stockCount: number;
  cryptoCount: number;
  avgChange24h: number;
  gainers: number;
  losers: number;
  updatedAt: number;
}

export async function getAllPrices(): Promise<{
  prices: PriceQuote[];
  lastRefreshAt: number;
  refreshing: boolean;
}> {
  const engine = getPriceEngine();
  const snap = engine.getSnapshot();

  if (snap.prices.every((p) => !p.trusted) && !snap.refreshing) {
    await engine.refresh();
    return engine.getSnapshot();
  }

  return snap;
}

export function computeMarketSummary(prices: PriceQuote[]): MarketSummary {
  const trusted = prices.filter((p) => p.price > 0);
  const changes = trusted.map((p) => p.change24h ?? 0);
  return {
    totalAssets: ALL_ASSETS.length,
    stockCount: STOCKS.length,
    cryptoCount: CRYPTOS.length,
    avgChange24h:
      changes.length > 0
        ? changes.reduce((a, b) => a + b, 0) / changes.length
        : 0,
    gainers: changes.filter((c) => c > 0).length,
    losers: changes.filter((c) => c < 0).length,
    updatedAt: Date.now(),
  };
}

export function formatPrice(price: number, type: "stock" | "crypto"): string {
  if (price <= 0) return "—";
  if (price >= 1000)
    return `$${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  if (type === "crypto" && price < 1)
    return `$${price.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 6 })}`;
  return `$${price.toFixed(2)}`;
}

export function formatVolume(vol?: number): string {
  if (!vol) return "—";
  if (vol >= 1e9) return `$${(vol / 1e9).toFixed(2)}B`;
  if (vol >= 1e6) return `$${(vol / 1e6).toFixed(2)}M`;
  if (vol >= 1e3) return `$${(vol / 1e3).toFixed(1)}K`;
  return `$${vol.toFixed(0)}`;
}
