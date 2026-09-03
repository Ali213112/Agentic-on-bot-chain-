import { NextResponse } from "next/server";
import { getRobinhoodStatus } from "@/lib/robinhood";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getRobinhoodStatus());
}
