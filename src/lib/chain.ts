import { createPublicClient, http, type PublicClient } from "viem";
import { CHAIN_CONFIG } from "./assets";

const botTestnet = {
  id: CHAIN_CONFIG.chainId,
  name: CHAIN_CONFIG.name,
  nativeCurrency: { name: "BOT", symbol: "BOT", decimals: 18 },
  rpcUrls: {
    default: { http: [CHAIN_CONFIG.rpcUrl] },
    public: { http: [CHAIN_CONFIG.rpcUrl] },
  },
} as const;

let client: PublicClient | null = null;

export function getChainClient(): PublicClient {
  if (!client) {
    client = createPublicClient({
      chain: botTestnet,
      transport: http(CHAIN_CONFIG.rpcUrl),
    });
  }
  return client;
}

export const AGGREGATOR_ABI = [
  {
    inputs: [],
    name: "latestRoundData",
    outputs: [
      { name: "roundId", type: "uint80" },
      { name: "answer", type: "int256" },
      { name: "startedAt", type: "uint256" },
      { name: "updatedAt", type: "uint256" },
      { name: "answeredInRound", type: "uint80" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
] as const;
