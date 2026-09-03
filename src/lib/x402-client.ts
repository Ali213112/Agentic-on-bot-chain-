"use client";

import type { Address, Hex } from "viem";
import { parseUnits } from "viem";
import { RESEARCH_PRICE_USD } from "@/lib/x402-constants";
import type { ResearchReport } from "@/lib/research";
import type { X402PaymentRequiredBody } from "@/lib/x402";
import { TEST_USDC_ABI } from "@/lib/broker-abi";

export interface DeepResearchResult {
  report: ResearchReport;
  paymentTx: Hex;
  paidUsd: number;
}

/**
 * x402-compatible client: POST deep research → 402 → pay tUSDC → retry with tx header.
 */
export async function fetchDeepResearchWithX402(
  userAddress: Address,
  usdcAddress: Address,
  payTo: Address,
  writeTransfer: (args: {
    address: Address;
    abi: typeof TEST_USDC_ABI;
    functionName: "transfer";
    args: [Address, bigint];
  }) => Promise<Hex>,
  waitReceipt: (hash: Hex) => Promise<void>
): Promise<DeepResearchResult> {
  const first = await fetch("/api/research/deep", { method: "POST" });

  if (first.status !== 402) {
    if (!first.ok) {
      const err = await first.json().catch(() => ({}));
      throw new Error(err.error ?? "Deep research request failed");
    }
    const report = (await first.json()) as ResearchReport;
    return { report, paymentTx: "0x" as Hex, paidUsd: 0 };
  }

  const paymentReq = (await first.json()) as X402PaymentRequiredBody;
  const accept = paymentReq.accepts[0];
  if (!accept) throw new Error("No payment requirements in 402 response");

  const amount = parseUnits(String(RESEARCH_PRICE_USD), 6);
  const recipient = (accept.payTo ?? payTo) as Address;

  const txHash = await writeTransfer({
    address: usdcAddress,
    abi: TEST_USDC_ABI,
    functionName: "transfer",
    args: [recipient, amount],
  });

  await waitReceipt(txHash);

  const second = await fetch("/api/research/deep", {
    method: "POST",
    headers: {
      "x-payment-tx": txHash,
      "x-payment-from": userAddress,
    },
  });

  if (!second.ok) {
    const err = await second.json().catch(() => ({}));
    throw new Error(err.error ?? "Research failed after payment");
  }

  const report = (await second.json()) as ResearchReport;
  return { report, paymentTx: txHash, paidUsd: RESEARCH_PRICE_USD };
}
