import { NextResponse } from "next/server";
import { getBrokerStatus } from "@/lib/broker";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getBrokerStatus());
}
