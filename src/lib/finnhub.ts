const BASE = "https://finnhub.io/api/v1";

export const FINNHUB_CRYPTO_SYMBOLS: Record<string, string> = {
  BTC: "BINANCE:BTCUSDT",
  ETH: "BINANCE:ETHUSDT",
  SOL: "BINANCE:SOLUSDT",
  XRP: "BINANCE:XRPUSDT",
  BNB: "BINANCE:BNBUSDT",
  WETH: "BINANCE:ETHUSDT",
  DOGE: "BINANCE:DOGEUSDT",
};

function getApiKey(): string {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) throw new Error("FINNHUB_API_KEY not set");
  return key;
}

async function finnhubGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set("token", getApiKey());
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (res.status === 429) throw new Error("Finnhub rate limit — retrying");
  if (!res.ok) throw new Error(`Finnhub ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export interface FinnhubQuote {
  c: number;
  h: number;
  l: number;
  o: number;
  pc: number;
  t: number;
}

export interface FinnhubCandle {
  c: number[];
  h: number[];
  l: number[];
  o: number[];
  s: string;
  t: number[];
  v: number[];
}

export interface MarketCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface FinnhubNewsItem {
  category: string;
  datetime: number;
  headline: string;
  id: number;
  image: string;
  related: string;
  source: string;
  summary: string;
  url: string;
}

export async function fetchStockQuote(symbol: string): Promise<FinnhubQuote> {
  return finnhubGet<FinnhubQuote>("/quote", { symbol });
}

export async function fetchCryptoQuote(symbol: string): Promise<{
  price: number;
  high: number;
  low: number;
  open: number;
  prevClose: number;
  updatedAt: number;
  change24h: number;
  change24hAbs: number;
}> {
  const pair = FINNHUB_CRYPTO_SYMBOLS[symbol];
  if (!pair) throw new Error(`Unknown crypto: ${symbol}`);

  const q = await finnhubGet<FinnhubQuote & { dp?: number; d?: number }>(
    "/quote",
    { symbol: pair }
  );

  if (!q.c) throw new Error(`No crypto price for ${symbol}`);

  const change24h = q.dp ?? (q.pc > 0 ? ((q.c - q.pc) / q.pc) * 100 : 0);
  const change24hAbs = q.d ?? q.c - q.pc;

  return {
    price: q.c,
    high: q.h,
    low: q.l,
    open: q.o,
    prevClose: q.pc,
    updatedAt: q.t * 1000,
    change24h,
    change24hAbs,
  };
}

export function quoteToChange(current: number, previous: number) {
  const change24h = previous > 0 ? ((current - previous) / previous) * 100 : 0;
  return { change24h, change24hAbs: current - previous };
}

function candleSymbol(symbol: string, type: "stock" | "crypto"): string {
  if (type === "crypto") {
    const pair = FINNHUB_CRYPTO_SYMBOLS[symbol];
    if (!pair) throw new Error(`No Finnhub pair for ${symbol}`);
    return pair;
  }
  return symbol;
}

/** Intraday candles for live chart (Finnhub free tier) */
export async function fetchCandles(
  symbol: string,
  type: "stock" | "crypto",
  resolution: "1" | "5" | "15" | "60" | "D" = "5",
  lookbackSeconds = 86400
): Promise<MarketCandle[]> {
  const now = Math.floor(Date.now() / 1000);
  const from = now - lookbackSeconds;
  const finnhubSym = candleSymbol(symbol, type);

  const data = await finnhubGet<FinnhubCandle>(
    type === "crypto" ? "/crypto/candle" : "/stock/candle",
    {
    symbol: finnhubSym,
    resolution,
    from: String(from),
    to: String(now),
    }
  );

  if (data.s !== "ok" || !data.t?.length) return [];

  return data.t.map((t, i) => ({
    time: t,
    open: data.o[i],
    high: data.h[i],
    low: data.l[i],
    close: data.c[i],
    volume: data.v[i] ?? 0,
  }));
}

export async function fetchCompanyNews(
  symbol: string,
  lookbackDays = 7
): Promise<FinnhubNewsItem[]> {
  const to = new Date();
  const from = new Date(to.getTime() - lookbackDays * 86400_000);
  const day = (date: Date) => date.toISOString().slice(0, 10);
  return finnhubGet<FinnhubNewsItem[]>("/company-news", {
    symbol,
    from: day(from),
    to: day(to),
  });
}

export async function fetchMarketNews(
  category: "general" | "forex" | "crypto" = "general"
): Promise<FinnhubNewsItem[]> {
  return finnhubGet<FinnhubNewsItem[]>("/news", { category, minId: "0" });
}
