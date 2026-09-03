import { NextRequest, NextResponse } from "next/server";
import type { Address } from "viem";
import { AGENTS } from "@/lib/agents";
import { getAllPrices } from "@/lib/prices";
import {
  generateDebateRound,
  type Allocation,
  type DebateMessage,
} from "@/lib/debate";
import { generateAIDebateRound, getAIProviderStatus } from "@/lib/ai";
import { computeQuantAllocation } from "@/lib/allocation";
import {
  runQuantResearch,
  type QuantResearchReport,
} from "@/lib/market-intelligence";
import {
  loadTradingContext,
  type TradingContext,
} from "@/lib/trading-memory";
import {
  assessAllocationRisk,
  type RiskAssessment,
} from "@/lib/risk-management";
import type { ResearchReport } from "@/lib/research";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    agentIds,
    amount,
    round = 0,
    priorMessages = [],
    researchSummary,
    researchContext,
    wallet,
  } = body as {
    agentIds: string[];
    amount: number;
    round?: number;
    priorMessages?: DebateMessage[];
    researchSummary?: string;
    researchContext?: ResearchReport;
    wallet?: Address;
  };

  const selectedAgents = AGENTS.filter((a) => agentIds.includes(a.id));
  if (selectedAgents.length === 0) {
    return NextResponse.json({ error: "No agents selected" }, { status: 400 });
  }

  const { prices } = await getAllPrices();
  const aiStatus = getAIProviderStatus();
  const hasAI = aiStatus.gemini || aiStatus.groq;
  const memoryPrompt = researchContext?.memory
    ? `Current portfolio: $${researchContext.memory.totalValueUsd.toFixed(2)} total, ` +
      `$${researchContext.memory.cashUsd.toFixed(2)} cash, ` +
      `drawdown ${researchContext.memory.drawdownPercent.toFixed(2)}%. Positions: ` +
      `${researchContext.memory.positions
        .map((position) => `${position.symbol} ${position.portfolioWeightPercent.toFixed(1)}%`)
        .join(", ") || "none"}. Recent trades: ` +
      `${researchContext.memory.recentTrades
        .slice(0, 5)
        .map((trade) => `${trade.side} ${trade.symbol} ${trade.status}`)
        .join(", ") || "none"}.`
    : "";
  const quantPrompt = researchContext?.quant
    ? `Quant ranking: ${researchContext.quant.assets
        .slice(0, 6)
        .map(
          (asset) =>
            `${asset.symbol} ${asset.quant.score}/100 RSI ${asset.quant.rsi14.toFixed(1)} ` +
            `RS ${asset.quant.relativeStrength.toFixed(1)}% volume ${asset.quant.volumeRatio.toFixed(2)}x`
        )
        .join("; ")}. Verified headlines: ${researchContext.quant.assets
        .flatMap((asset) =>
          asset.headlines.slice(0, 1).map((news) => `${asset.symbol}: ${news.headline}`)
        )
        .slice(0, 5)
        .join(" | ") || "none available"}.`
    : "";
  const recallPrompt = researchContext?.recall?.length
    ? `Similar past situations (vector memory recall): ${researchContext.recall
        .map(
          (memory) =>
            `[${new Date(memory.timestamp).toLocaleDateString()}, ${(memory.similarity * 100).toFixed(0)}% match] ${memory.text}`
        )
        .join(" || ")}`
    : "";
  const informedResearch = [researchSummary, memoryPrompt, quantPrompt, recallPrompt]
    .filter(Boolean)
    .join("\n");

  let messages: DebateMessage[];

  if (hasAI) {
    messages = await generateAIDebateRound(
      selectedAgents,
      prices,
      round,
      amount,
      priorMessages,
      informedResearch
    );
  } else {
    messages = generateDebateRound(selectedAgents, prices, round);
  }

  let allocation: Allocation[] | null = null;
  let proposedAllocation: Allocation[] | null = null;
  let risk: RiskAssessment | null = null;
  let quant: QuantResearchReport | null = researchContext?.quant ?? null;
  let memory: TradingContext | null = researchContext?.memory ?? null;
  if (round >= 3) {
    if (!wallet?.startsWith("0x")) {
      return NextResponse.json({ error: "Wallet required for risk checks" }, { status: 400 });
    }
    [quant, memory] = await Promise.all([
      runQuantResearch(),
      loadTradingContext(wallet),
    ]);
    proposedAllocation = computeQuantAllocation(amount, prices, quant);
    risk = assessAllocationRisk(proposedAllocation, memory, quant, amount);
    allocation = risk.approvedAllocation;
  }

  return NextResponse.json({
    messages,
    allocation,
    proposedAllocation,
    risk,
    quant,
    memory,
    prices,
    round,
    ai: aiStatus,
    status: allocation ? "ready" : "debating",
  });
}
