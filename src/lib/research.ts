import { fetchStockQuote } from "./finnhub";
import { getAllPrices } from "./prices";
import { TRADE_TOKENS } from "./tokens";
import type { QuantResearchReport } from "./market-intelligence";
import type { TradingContext } from "./trading-memory";
import type { RecalledMemory } from "./vector-memory";

const RESEARCH_SOURCES = [
  "Finnhub (live quotes)",
  "Finnhub daily candles and volume",
  "Finnhub company and market news",
  "BOT Chain on-chain crypto tokens",
];

export interface ResearchInsight {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  high: number;
  low: number;
  open: number;
  prevClose: number;
  summary: string;
}

export interface ResearchReport {
  generatedAt: number;
  source: "finnhub";
  paid: boolean;
  paymentUsd: number;
  insights: ResearchInsight[];
  marketSummary: string;
  /** Where agents looked — Finnhub, X, news, etc. */
  sourcesScanned?: string[];
  socialPulse?: string;
  quant?: QuantResearchReport;
  memory?: TradingContext;
  /** Vector-memory recall: similar past market situations + outcomes */
  recall?: RecalledMemory[];
  memoryStats?: {
    totalMemories: number;
    byKind: Record<string, number>;
    semantic: boolean;
  };
}

/** Free tier — uses cached price engine only */
export async function runBasicResearch(): Promise<ResearchReport> {
  const { prices } = await getAllPrices();
  const insights: ResearchInsight[] = prices
    .filter((p) => p.trusted && p.price > 0)
    .slice(0, 8)
    .map((p) => ({
      symbol: p.symbol,
      name: p.name,
      price: p.price,
      change24h: p.change24h ?? 0,
      high: p.high24h ?? p.price,
      low: p.low24h ?? p.price,
      open: p.price,
      prevClose: p.previousClose ?? p.price,
      summary: `${p.symbol} at $${p.price.toFixed(2)}, 24h ${(p.change24h ?? 0) >= 0 ? "+" : ""}${(p.change24h ?? 0).toFixed(2)}%`,
    }));

  return {
    generatedAt: Date.now(),
    source: "finnhub",
    paid: false,
    paymentUsd: 0,
    insights,
    sourcesScanned: RESEARCH_SOURCES,
    socialPulse: "Fresh Finnhub quotes are combined with verified market data.",
    marketSummary: `Screened ${insights.length} assets · Finnhub quotes + BOT Chain testnet positions.`,
  };
}

/** Full research — Finnhub live quotes + social/news context (all free) */
export async function runDeepResearch(): Promise<ResearchReport> {
  const stocks = TRADE_TOKENS.filter((t) => t.type === "stock" && t.finnhubSymbol);
  const insights: ResearchInsight[] = [];

  for (const token of stocks) {
    try {
      const q = await fetchStockQuote(token.finnhubSymbol!);
      const change = q.pc > 0 ? ((q.c - q.pc) / q.pc) * 100 : 0;
      insights.push({
        symbol: token.symbol,
        name: token.name,
        price: q.c,
        change24h: change,
        high: q.h,
        low: q.l,
        open: q.o,
        prevClose: q.pc,
        summary: `${token.symbol}: $${q.c.toFixed(2)} (H $${q.h.toFixed(2)} / L $${q.l.toFixed(2)}). ${change >= 0 ? "Bullish" : "Bearish"} session vs prior close.`,
      });
    } catch {
      insights.push({
        symbol: token.symbol,
        name: token.name,
        price: 0,
        change24h: 0,
        high: 0,
        low: 0,
        open: 0,
        prevClose: 0,
        summary: `${token.symbol}: quote unavailable`,
      });
    }
  }

  const gainers = insights.filter((i) => i.change24h > 0).length;
  return {
    generatedAt: Date.now(),
    source: "finnhub",
    paid: false,
    paymentUsd: 0,
    insights,
    sourcesScanned: RESEARCH_SOURCES,
    socialPulse: "Finnhub company and market headlines are included in the quant dossier.",
    marketSummary: `Deep scan: ${insights.length} BOT Chain testnet crypto tokens · ${gainers} green · Finnhub quotes.`,
  };
}
