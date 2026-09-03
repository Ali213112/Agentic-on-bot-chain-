import { NextRequest, NextResponse } from "next/server";
import { runBasicResearch } from "@/lib/research";

export async function GET() {
  try {
    const report = await runBasicResearch();
    return NextResponse.json(report);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Research failed" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const symbols = Array.isArray(body.symbols) ? body.symbols : [];
    const report = await runBasicResearch();
    if (symbols.length > 0) {
      report.insights = report.insights.filter((i) => symbols.includes(i.symbol));
    }
    return NextResponse.json(report);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Research failed" },
      { status: 500 }
    );
  }
}
