import { NextRequest, NextResponse } from "next/server";
import { getAllPrices } from "@/lib/prices";
import { runResearchPhase } from "@/lib/pipeline-ai";
import { getAIProviderStatus } from "@/lib/ai";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { amount } = body as { amount: number };

  if (!amount || amount <= 0) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }

  const { prices } = await getAllPrices();
  const report = await runResearchPhase(prices, amount);

  return NextResponse.json({
    ...report,
    prices,
    ai: getAIProviderStatus(),
  });
}
