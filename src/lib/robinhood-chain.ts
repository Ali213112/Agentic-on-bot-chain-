/** BOT Chain Testnet — https://dev-docs.botchain.ai/docs/Developers/json-rpc-endpoint/ */
export const BOT_TESTNET = {
  chainId: 968,
  chainIdHex: "0x3c8" as const,
  name: "BOT Chain Testnet",
  rpcUrl: "https://rpc.bohr.life",
  explorer: "https://scan.bohr.life",
  currencySymbol: "BOT",
  currencyName: "BOT",
  faucetUrl: "https://faucet.botchain.ai/basic",
} as const;

export const BOT_TESTNET_WALLET_PARAMS = {
  chainId: BOT_TESTNET.chainIdHex,
  chainName: BOT_TESTNET.name,
  nativeCurrency: {
    name: BOT_TESTNET.currencyName,
    symbol: BOT_TESTNET.currencySymbol,
    decimals: 18,
  },
  rpcUrls: [BOT_TESTNET.rpcUrl],
  blockExplorerUrls: [BOT_TESTNET.explorer],
} as const;

export const FAUCET_POOL_USD = 1_000_000;
export const FAUCET_CLAIM_USD = 300;

// Legacy aliases so existing imports don't break
export const RH_TESTNET = BOT_TESTNET;
export const RH_TESTNET_WALLET_PARAMS = BOT_TESTNET_WALLET_PARAMS;
