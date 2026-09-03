import type { OnChainAsset } from "./stock-tokens";
import { getTradeTokensServer } from "./tokens-server";

export function getOnChainAssetsServer(): OnChainAsset[] {
  return getTradeTokensServer();
}

export function getOnChainAsset(symbol: string) {
  return getOnChainAssetsServer().find((a) => a.symbol === symbol);
}
