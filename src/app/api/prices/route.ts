import { NextResponse } from "next/server";
import { getAllPrices, computeMarketSummary } from "@/lib/prices";
import { CHAIN_CONFIG } from "@/lib/assets";
import { getAIProviderStatus } from "@/lib/ai";

export const dynamic = "force-dynamic";

export async function GET() {
  const { prices, lastRefreshAt, refreshing } = await getAllPrices();
  const summary = computeMarketSummary(prices);
  const ai = getAIProviderStatus();

  return NextResponse.json({
    prices,
    summary,
    chain: CHAIN_CONFIG,
    ai,
    meta: { lastRefreshAt, refreshing, source: "finnhub" },
    updatedAt: Date.now(),
  });
}
