export type AssetType = "stock" | "crypto";

export interface Asset {
  symbol: string;
  name: string;
  type: AssetType;
}

// Crypto-only on BOT Chain
export const STOCKS: Asset[] = [];

export const CRYPTOS: Asset[] = [
  { symbol: "BTC", name: "Bitcoin", type: "crypto" },
  { symbol: "ETH", name: "Ethereum", type: "crypto" },
  { symbol: "SOL", name: "Solana", type: "crypto" },
  { symbol: "XRP", name: "Ripple", type: "crypto" },
  { symbol: "BNB", name: "BNB", type: "crypto" },
];

export const ALL_ASSETS = [...CRYPTOS];

export const CHAIN_CONFIG = {
  chainId: 968,
  name: "BOT Chain Testnet",
  rpcUrl:
    process.env.BOT_TESTNET_RPC_URL ??
    "https://rpc.bohr.life",
  wsUrl:
    process.env.BOT_TESTNET_WS_URL ??
    "wss://rpc.bohr.life",
  explorer: "https://scan.bohr.life",
  currencySymbol: "BOT",
} as const;
