import {
  fetchCandles,
  fetchCompanyNews,
  fetchMarketNews,
  type FinnhubNewsItem,
  type MarketCandle,
} from "./finnhub";
import { screenAsset, type QuantScreen } from "./quant";
import { getTradeTokensServer } from "./tokens-server";

const CACHE_MS = 10 * 60_000;
let cachedReport: QuantResearchReport | null = null;

export interface AssetIntelligence {
  symbol: string;
  type: "stock" | "crypto";
  quant: QuantScreen;
  headlines: {
    headline: string;
    source: string;
    url: string;
    datetime: number;
  }[];
}

export interface QuantResearchReport {
  generatedAt: number;
  methodology: string[];
  assets: AssetIntelligence[];
  eligibleSymbols: string[];
  rejectedSymbols: string[];
  dataWarnings: string[];
}

function conciseNews(items: FinnhubNewsItem[], symbol?: string) {
  const relevant = symbol
    ? items.filter((item) => {
        const text = `${item.headline} ${item.related}`.toUpperCase();
        return text.includes(symbol.toUpperCase());
      })
    : items;
  return relevant.slice(0, 3).map((item) => ({
    headline: item.headline,
    source: item.source,
    url: item.url,
    datetime: item.datetime,
  }));
}

async function safeCandles(
  symbol: string,
  type: "stock" | "crypto"
): Promise<MarketCandle[]> {
  try {
    return await fetchCandles(symbol, type, "D", 40 * 86400);
  } catch {
    return [];
  }
}

export async function runQuantResearch(force = false): Promise<QuantResearchReport> {
  if (!force && cachedReport && Date.now() - cachedReport.generatedAt < CACHE_MS) {
    return cachedReport;
  }

  const tokens = getTradeTokensServer();
  const [btcCandles, qqqCandles, cryptoNews, generalNews] = await Promise.all([
    safeCandles("BTC", "crypto"),
    safeCandles("QQQ", "stock"),
    fetchMarketNews("crypto").catch(() => []),
    fetchMarketNews("general").catch(() => []),
  ]);

  const assets = await Promise.all(
    tokens.map(async (token): Promise<AssetIntelligence> => {
      const candles =
        token.symbol === "BTC"
          ? btcCandles
          : await safeCandles(token.symbol, token.type);
      const benchmarkCandles = token.type === "crypto" ? btcCandles : qqqCandles;
      const news =
        token.type === "stock"
          ? await fetchCompanyNews(token.finnhubSymbol ?? token.symbol).catch(() => [])
          : cryptoNews;
      return {
        symbol: token.symbol,
        type: token.type,
        quant: screenAsset(token.symbol, token.type, candles, benchmarkCandles),
        headlines: conciseNews(news.length ? news : generalNews, token.symbol),
      };
    })
  );

  const dataWarnings = assets
    .filter((asset) => asset.quant.warnings.some((warning) => warning.startsWith("Insufficient")))
    .map((asset) => `${asset.symbol}: candle history unavailable`);

  cachedReport = {
    generatedAt: Date.now(),
    methodology: [
      "20-session relative strength versus BTC (crypto) or QQQ (stocks)",
      "Recent volume versus prior baseline",
      "RSI(14) overbought and oversold filter",
      "ATR(14) volatility-adjusted sizing",
      "Trend consistency and single-session spike rejection",
    ],
    assets: assets.sort((a, b) => b.quant.score - a.quant.score),
    eligibleSymbols: assets.filter((asset) => asset.quant.passed).map((asset) => asset.symbol),
    rejectedSymbols: assets.filter((asset) => !asset.quant.passed).map((asset) => asset.symbol),
    dataWarnings,
  };
  return cachedReport;
}
