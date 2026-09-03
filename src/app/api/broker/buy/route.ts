import { NextRequest, NextResponse } from "next/server";
import { executeFractionalBuys, executeProfitSells } from "@/lib/broker";
import type { Allocation } from "@/lib/debate";
import type { Address } from "viem";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { userAddress, allocation } = body as {
    userAddress: Address;
    allocation: Allocation[];
  };

  if (!userAddress?.startsWith("0x") || !allocation?.length) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const buyResults = await executeFractionalBuys(userAddress, allocation);
  const sellResults = await executeProfitSells(userAddress);
  const results = [...buyResults, ...sellResults];

  return NextResponse.json({
    results,
    summary: {
      bought: results.filter((r) => r.status === "bought").length,
      sold: results.filter((r) => r.status === "sold").length,
      skipped: results.filter((r) => r.status === "skipped").length,
      failed: results.filter((r) => r.status === "failed").length,
    },
  });
}
