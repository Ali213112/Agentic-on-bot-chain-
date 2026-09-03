import { CRYPTOS, STOCKS, type Asset } from "./assets";
import {
  fetchStockQuote,
  fetchCryptoQuote,
  quoteToChange,
  FINNHUB_CRYPTO_SYMBOLS,
} from "./finnhub";
import type { PriceQuote } from "./prices";

const REFRESH_MS = 12_000;
const SYMBOL_DELAY_MS = 250;
const RETRY_DELAY_MS = 5_000;

type GlobalEngine = typeof globalThis & {
  __agenticPriceEngine?: PriceEngine;
};

class PriceEngine {
  private cache = new Map<string, PriceQuote>();
  private started = false;
  private refreshing = false;
  private lastRefreshAt = 0;

  start() {
    if (this.started) return;
    this.started = true;
    void this.refresh();
    setInterval(() => void this.refresh(), REFRESH_MS);
  }

  getSnapshot(): { prices: PriceQuote[]; lastRefreshAt: number; refreshing: boolean } {
    const assets = [...STOCKS, ...CRYPTOS];
    const prices = assets.map((a) => {
      const cached = this.cache.get(a.symbol);
      if (cached && cached.price > 0) {
        return { ...cached, trusted: true };
      }
      return this.placeholder(a);
    });

    return {
      prices,
      lastRefreshAt: this.lastRefreshAt,
      refreshing: this.refreshing,
    };
  }

  private placeholder(asset: Asset): PriceQuote {
    const cached = this.cache.get(asset.symbol);
    if (cached && cached.price > 0) return cached;
    return {
      symbol: asset.symbol,
      name: asset.name,
      type: asset.type,
      price: 0,
      updatedAt: Date.now(),
      source: "finnhub" as const,
      trusted: false,
    };
  }

  private placeholderBySymbol(symbol: string): PriceQuote {
    const asset = [...STOCKS, ...CRYPTOS].find((a) => a.symbol === symbol);
    if (!asset) throw new Error(`Unknown ${symbol}`);
    return this.placeholder(asset);
  }

  async refresh() {
    if (this.refreshing) return;
    this.refreshing = true;

    try {
      for (const asset of STOCKS) {
        await this.fetchOne(asset, () => fetchStockQuote(asset.symbol), (q) => {
          const { change24h, change24hAbs } = quoteToChange(q.c, q.pc);
          return {
            symbol: asset.symbol,
            name: asset.name,
            type: "stock" as const,
            price: q.c,
            updatedAt: q.t * 1000,
            source: "finnhub" as const,
            change24h,
            change24hAbs,
            high24h: q.h,
            low24h: q.l,
            previousClose: q.pc,
            trusted: true,
            stale: false,
          };
        });
        await sleep(SYMBOL_DELAY_MS);
      }

      for (const asset of CRYPTOS) {
        await this.fetchOne(asset, () => fetchCryptoQuote(asset.symbol), (q) => ({
          symbol: asset.symbol,
          name: asset.name,
          type: "crypto" as const,
          price: q.price,
          updatedAt: q.updatedAt,
          source: "finnhub" as const,
          change24h: q.change24h,
          change24hAbs: q.change24hAbs,
          high24h: q.high,
          low24h: q.low,
          previousClose: q.prevClose,
          trusted: true,
          stale: false,
        }));
        await sleep(SYMBOL_DELAY_MS);
      }

      this.lastRefreshAt = Date.now();
    } finally {
      this.refreshing = false;
    }
  }

  private async fetchOne<T>(
    asset: Asset,
    fetcher: () => Promise<T>,
    mapper: (data: T) => PriceQuote
  ) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const data = await fetcher();
        this.cache.set(asset.symbol, mapper(data));
        return;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg.includes("429") && attempt === 0) {
          await sleep(RETRY_DELAY_MS);
          continue;
        }
        const prev = this.cache.get(asset.symbol);
        if (prev && prev.price > 0) {
          this.cache.set(asset.symbol, { ...prev, stale: true });
        }
        return;
      }
    }
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function getPriceEngine(): PriceEngine {
  const g = globalThis as GlobalEngine;
  if (!g.__agenticPriceEngine) {
    g.__agenticPriceEngine = new PriceEngine();
    g.__agenticPriceEngine.start();
  }
  return g.__agenticPriceEngine;
}

export { FINNHUB_CRYPTO_SYMBOLS };
