import { NextRequest, NextResponse } from "next/server";
import type { Address } from "viem";
import type { Allocation } from "@/lib/debate";
import { executeAllocationSwaps } from "@/lib/swap";
import { runQuantResearch } from "@/lib/market-intelligence";
import { loadTradingContext, recordSwapResults } from "@/lib/trading-memory";
import { assessAllocationRisk } from "@/lib/risk-management";
import { getAllPrices } from "@/lib/prices";
import { storeMemory } from "@/lib/vector-memory";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const userAddress = body.userAddress as Address | undefined;
    const allocation = body.allocation as Allocation[] | undefined;

    if (!userAddress?.startsWith("0x")) {
      return NextResponse.json({ error: "userAddress required" }, { status: 400 });
    }
    if (!allocation?.length) {
      return NextResponse.json({ error: "allocation required" }, { status: 400 });
    }

    const budgetUsd =
      typeof body.budgetUsd === "number" ? body.budgetUsd : undefined;
    if (!budgetUsd || budgetUsd <= 0) {
      return NextResponse.json({ error: "Valid budgetUsd required" }, { status: 400 });
    }

    // Recompute memory, market screens, and limits server-side. Client allocations
    // are proposals only and can never bypass portfolio risk controls.
    const [memory, quant, priceResult] = await Promise.all([
      loadTradingContext(userAddress),
      runQuantResearch(),
      getAllPrices(),
    ]);
    const risk = assessAllocationRisk(allocation, memory, quant, budgetUsd);

    const marketState = quant.assets
      .slice(0, 6)
      .map(
        (asset) =>
          `${asset.symbol} score ${asset.quant.score} RSI ${asset.quant.rsi14.toFixed(0)} ` +
          `RS ${asset.quant.relativeStrength.toFixed(1)}% vol ${asset.quant.volumeRatio.toFixed(2)}x ${asset.quant.signal}`
      )
      .join("; ");

    if (!risk.approved) {
      // Blocked sessions are lessons too — remember why the gate said no.
      await storeMemory(
        userAddress,
        "lesson",
        `Risk gate blocked execution. Market: ${marketState}. Reasons: ${risk.blockedReasons.join("; ")}. Drawdown ${risk.drawdownPercent.toFixed(2)}%.`,
        { outcome: "blocked", drawdown: risk.drawdownPercent }
      );
      return NextResponse.json({
        results: [],
        risk,
        executionBlocked: true,
      });
    }

    const results = await executeAllocationSwaps(
      userAddress,
      risk.approvedAllocation,
      budgetUsd
    );
    const priceMap = Object.fromEntries(
      priceResult.prices.map((price) => [price.symbol, price.price])
    );
    const reasonMap = Object.fromEntries(
      risk.approvedAllocation.map((item) => [item.symbol, item.reason])
    );
    const sessionId =
      typeof body.sessionId === "string" ? body.sessionId : crypto.randomUUID();
    await recordSwapResults(userAddress, sessionId, results, priceMap, reasonMap);

    const swapped = results.filter((r) => r.status === "swapped");
    const failed = results.filter((r) => r.status !== "swapped");
    await storeMemory(
      userAddress,
      "pattern",
      `Session executed. Market: ${marketState}. ` +
        `Bought: ${swapped.map((r) => `${r.symbol} $${r.usdcIn ?? "?"}`).join(", ") || "none"}. ` +
        `Skipped/failed: ${failed.map((r) => `${r.symbol} (${r.status})`).join(", ") || "none"}. ` +
        `Budget $${budgetUsd}, drawdown ${risk.drawdownPercent.toFixed(2)}%.`,
      {
        outcome: "executed",
        sessionId,
        buys: swapped.length,
        failures: failed.length,
        budgetUsd,
      }
    );

    return NextResponse.json({ results, risk, executionBlocked: false });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Swap execution failed" },
      { status: 500 }
    );
  }
}
