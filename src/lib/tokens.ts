import type { Address } from "viem";

export type AssetType = "stock" | "crypto";

export interface TradeToken {
  symbol: string;
  name: string;
  type: AssetType;
  tokenAddress: Address;
  decimals: number;
  finnhubSymbol?: string;
}

/** 5 crypto assets — BOT Chain testnet */
export const TRADE_TOKENS: TradeToken[] = [
  { symbol: "BTC", name: "Bitcoin", type: "crypto", tokenAddress: "0xa85468f30291d6a77cf0ff66eba0635b67273555", decimals: 18 },
  { symbol: "ETH", name: "Ethereum", type: "crypto", tokenAddress: "0xacf22fdac022bd1d33af0d0c40f48dc646c73b81", decimals: 18 },
  { symbol: "SOL", name: "Solana", type: "crypto", tokenAddress: "0x6175bcadb6463912fd914cab4b3659a0b6901867", decimals: 18 },
  { symbol: "XRP", name: "Ripple", type: "crypto", tokenAddress: "0x1ca45d3af2f98b3e05457caca41cee83db68667f", decimals: 18 },
  { symbol: "BNB", name: "BNB", type: "crypto", tokenAddress: "0xf248d4c77d81e24da2f08dcdbf2ac4766faf27a6", decimals: 18 },
];

export const TRADE_SYMBOLS = new Set(TRADE_TOKENS.filter((t) => t.tokenAddress !== "0x0000000000000000000000000000000000000000").map((t) => t.symbol));

export function getTradeToken(symbol: string): TradeToken | undefined {
  return TRADE_TOKENS.find((t) => t.symbol === symbol && t.tokenAddress !== "0x0000000000000000000000000000000000000000");
}

export const USDC_DECIMALS = 6;
