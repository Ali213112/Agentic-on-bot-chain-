import { NextRequest, NextResponse } from "next/server";
import {
  executePlanOnChain,
  getChainExecutionStatus,
} from "@/lib/chain-execute";
import { buildExecutionSteps } from "@/lib/pipeline-ai";
import type { Allocation } from "@/lib/debate";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { amount, allocation } = body as {
    amount: number;
    allocation: Allocation[];
  };

  if (!amount || !allocation?.length) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const chainStatus = await getChainExecutionStatus();
  const steps = buildExecutionSteps(allocation, amount, chainStatus);
  const chainResult = await executePlanOnChain(amount, allocation);

  const resultMessages = [...steps];

  if (chainResult.success) {
    resultMessages.push({
      agentId: "executor",
      agentName: "Chain",
      role: "Execution Agent",
      avatar: "⛓️",
      color: "#a78bfa",
      phase: "execution",
      content: `createPlan() confirmed — plan #${chainResult.planId}. Tx: ${chainResult.createTxHash?.slice(0, 18)}...`,
      timestamp: Date.now(),
      step: "tx-create-done",
    });
    resultMessages.push({
      agentId: "executor",
      agentName: "Chain",
      role: "Execution Agent",
      avatar: "⛓️",
      color: "#a78bfa",
      phase: "execution",
      content: `markExecuted() confirmed on Robinhood Chain testnet. Plan #${chainResult.planId} is live on-chain.`,
      timestamp: Date.now(),
      step: "tx-execute-done",
    });
  } else {
    resultMessages.push({
      agentId: "executor",
      agentName: "Chain",
      role: "Execution Agent",
      avatar: "⛓️",
      color: "#a78bfa",
      phase: "execution",
      content: `Execution blocked: ${chainResult.error ?? "Unknown error"}`,
      timestamp: Date.now(),
      step: "error",
    });
  }

  return NextResponse.json({
    steps: resultMessages,
    chainResult,
    chainStatus,
  });
}

export async function GET() {
  return NextResponse.json(await getChainExecutionStatus());
}
