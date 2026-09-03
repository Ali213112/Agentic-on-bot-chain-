import type { TradeToken } from "./tokens";
import { TRADE_TOKENS } from "./tokens";
import { readDeployed } from "./deployed";
import type { Address } from "viem";

/** Server: merge BNB address from deployed.json when available */
export function getTradeTokensServer(): TradeToken[] {
  const deployed = readDeployed();
  return TRADE_TOKENS.map((t) => {
    if (t.symbol === "BNB" && deployed.bnbToken?.startsWith("0x")) {
      return { ...t, tokenAddress: deployed.bnbToken as Address };
    }
    const key = `${t.symbol.toLowerCase()}Token` as keyof typeof deployed;
    if (t.type === "crypto") {
      const cryptoKey = ({ BTC: "btcToken", ETH: "ethToken", SOL: "solToken", XRP: "xrpToken", BNB: "bnbToken" } as const)[t.symbol as "BTC"];
      const addr = deployed[cryptoKey];
      if (addr?.startsWith("0x")) return { ...t, tokenAddress: addr as Address };
    }
    return t;
  }).filter((t) => t.tokenAddress !== "0x0000000000000000000000000000000000000000");
}

export function getTradeTokenServer(symbol: string): TradeToken | undefined {
  return getTradeTokensServer().find((t) => t.symbol === symbol);
}
