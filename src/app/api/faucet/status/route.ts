import { NextRequest, NextResponse } from "next/server";
import { getFaucetStatus, getBrokerStatus } from "@/lib/broker";
import type { Address } from "viem";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet") as Address | null;
  const faucet = await getFaucetStatus(wallet ?? undefined);
  const broker = await getBrokerStatus();
  return NextResponse.json({ ...faucet, ...broker });
}
