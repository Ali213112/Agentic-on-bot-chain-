import { NextRequest, NextResponse } from "next/server";
import type { Address } from "viem";
import { runDeepResearch } from "@/lib/research";
import { runQuantResearch } from "@/lib/market-intelligence";
import {
  loadTradingContext,
  recordPortfolioSnapshot,
} from "@/lib/trading-memory";
import { recallSimilar, getMemoryStats } from "@/lib/vector-memory";

/** Memory + fresh market/news/technical research before any decision. */
export async function GET(req: NextRequest) {
  try {
    const wallet = req.nextUrl.searchParams.get("wallet");
    const [report, quant] = await Promise.all([
      runDeepResearch(),
      runQuantResearch(),
    ]);
    const memory =
      wallet?.startsWith("0x") && wallet.length === 42
        ? await loadTradingContext(wallet as Address)
        : undefined;

    let recall = undefined;
    let memoryStats = undefined;
    if (memory && wallet) {
      await recordPortfolioSnapshot(wallet as Address, {
        timestamp: Date.now(),
        totalValueUsd: memory.totalValueUsd,
        cashUsd: memory.cashUsd,
      });
      // Semantic recall: find past sessions whose market conditions look
      // like today's, so agents can learn from pattern repetition.
      const currentConditions = quant.assets
        .slice(0, 6)
        .map(
          (asset) =>
            `${asset.symbol} score ${asset.quant.score} RSI ${asset.quant.rsi14.toFixed(0)} ` +
            `RS ${asset.quant.relativeStrength.toFixed(1)}% vol ${asset.quant.volumeRatio.toFixed(2)}x ${asset.quant.signal}`
        )
        .join("; ");
      [recall, memoryStats] = await Promise.all([
        recallSimilar(wallet, currentConditions, 4),
        getMemoryStats(wallet),
      ]);
    }

    return NextResponse.json({
      ...report,
      quant,
      memory,
      recall,
      memoryStats,
      marketSummary:
        `${report.marketSummary} Quant: ${quant.eligibleSymbols.length} passed, ` +
        `${quant.rejectedSymbols.length} rejected. ` +
        (memory
          ? `Portfolio $${memory.totalValueUsd.toFixed(2)}, drawdown ${memory.drawdownPercent.toFixed(2)}%.`
          : ""),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Research failed" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
