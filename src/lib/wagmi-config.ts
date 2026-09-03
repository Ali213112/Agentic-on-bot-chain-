import { http, createConfig } from "wagmi";
import { injected } from "wagmi/connectors";
import { CHAIN_CONFIG } from "./assets";

export const botTestnet = {
  id: CHAIN_CONFIG.chainId,
  name: CHAIN_CONFIG.name,
  nativeCurrency: { name: "BOT", symbol: "BOT", decimals: 18 },
  rpcUrls: {
    default: { http: [CHAIN_CONFIG.rpcUrl] },
    public: { http: [CHAIN_CONFIG.rpcUrl] },
  },
  blockExplorers: {
    default: { name: "BOT Explorer", url: CHAIN_CONFIG.explorer },
  },
} as const;

// Legacy alias (keeps any imports that reference robinhoodTestnet working)
export const robinhoodTestnet = botTestnet;

export const wagmiConfig = createConfig({
  chains: [botTestnet],
  connectors: [injected()],
  transports: {
    [botTestnet.id]: http(CHAIN_CONFIG.rpcUrl),
  },
  ssr: true,
});
