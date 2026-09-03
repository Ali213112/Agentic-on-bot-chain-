import { NextRequest, NextResponse } from "next/server";
import { executeAllocation, getRobinhoodStatus, type TradeOrder } from "@/lib/robinhood";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { orders } = body as { orders: TradeOrder[] };

  if (!orders?.length) {
    return NextResponse.json({ error: "No orders" }, { status: 400 });
  }

  const results = await executeAllocation(orders);
  const robinhood = getRobinhoodStatus();

  return NextResponse.json({
    results,
    robinhood,
    summary: {
      placed: results.filter((r) => r.status === "placed").length,
      failed: results.filter((r) => r.status === "failed").length,
      skipped: results.filter((r) => r.status === "skipped").length,
    },
  });
}

export async function GET() {
  return NextResponse.json(getRobinhoodStatus());
}
