import { NextRequest, NextResponse } from "next/server";
import { getAllPrices } from "@/lib/prices";
import { runStrategyPhase } from "@/lib/pipeline-ai";
import { getAIProviderStatus } from "@/lib/ai";
import type { ResearchReport } from "@/lib/pipeline-types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { amount, research } = body as {
    amount: number;
    research: ResearchReport;
  };

  if (!amount || amount <= 0 || !research) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { prices } = await getAllPrices();
  const report = await runStrategyPhase(prices, amount, research);

  return NextResponse.json({
    ...report,
    prices,
    ai: getAIProviderStatus(),
  });
}
