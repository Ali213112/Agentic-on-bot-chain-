import type { Address } from "viem";
import { parseUnits } from "viem";
import { getUsdcAddress } from "./deployed";
import { CHAIN_CONFIG } from "./assets";
import {
  X402_VERSION,
  RESEARCH_PRICE_USD,
  PAYMENT_TX_HEADER,
  PAYMENT_FROM_HEADER,
} from "./x402-constants";

export { X402_VERSION, RESEARCH_PRICE_USD, PAYMENT_TX_HEADER, PAYMENT_FROM_HEADER };

export const RESEARCH_PRICE_USDC = parseUnits(String(RESEARCH_PRICE_USD), 6);

export interface X402PaymentRequirement {
  scheme: "exact";
  network: `eip155:${number}`;
  maxAmountRequired: string;
  asset: Address;
  payTo: Address;
  resource: string;
  description: string;
  mimeType: string;
  maxTimeoutSeconds: number;
}

export interface X402PaymentRequiredBody {
  x402Version: number;
  error: string;
  accepts: X402PaymentRequirement[];
}

export function buildResearchPaymentRequired(
  payTo: Address,
  resourceUrl: string
): X402PaymentRequiredBody {
  const usdc = getUsdcAddress();
  if (!usdc) throw new Error("USDC not configured");

  return {
    x402Version: X402_VERSION,
    error: "Payment required for premium Finnhub research",
    accepts: [
      {
        scheme: "exact",
        network: `eip155:${CHAIN_CONFIG.chainId}`,
        maxAmountRequired: RESEARCH_PRICE_USDC.toString(),
        asset: usdc,
        payTo,
        resource: resourceUrl,
        description: "Deep market research (Finnhub quotes + company news)",
        mimeType: "application/json",
        maxTimeoutSeconds: 300,
      },
    ],
  };
}
