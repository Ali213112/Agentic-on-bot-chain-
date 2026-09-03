import { NextResponse } from "next/server";
import { getSwapStatus } from "@/lib/swap";

export async function GET() {
  try {
    const status = await getSwapStatus();
    return NextResponse.json(status);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Status failed" },
      { status: 500 }
    );
  }
}
