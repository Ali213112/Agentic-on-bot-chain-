import { TRADE_TOKENS, type TradeToken } from "./tokens";

export type OnChainAsset = TradeToken;

export const ON_CHAIN_STOCKS: OnChainAsset[] = TRADE_TOKENS.filter((t) => t.type === "stock");

export const ON_CHAIN_SYMBOLS = new Set(
  TRADE_TOKENS.filter((t) => t.tokenAddress !== "0x0000000000000000000000000000000000000000").map((t) => t.symbol)
);
