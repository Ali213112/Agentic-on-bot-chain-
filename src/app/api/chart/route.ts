import { NextRequest, NextResponse } from "next/server";
import { fetchCandles } from "@/lib/finnhub";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol");
  const type = req.nextUrl.searchParams.get("type") as "stock" | "crypto" | null;
  if (!symbol || (type !== "stock" && type !== "crypto")) {
    return NextResponse.json({ error: "symbol and type required" }, { status: 400 });
  }
  try {
    const candles = await fetchCandles(symbol, type);
    return NextResponse.json({ symbol, type, candles, updatedAt: Date.now() });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Chart fetch failed" },
      { status: 500 }
    );
  }
}
