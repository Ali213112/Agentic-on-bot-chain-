import { NextResponse } from "next/server";
import { testAIConnection, getAIProviderStatus } from "@/lib/ai";

export const dynamic = "force-dynamic";

export async function GET() {
  const status = getAIProviderStatus();
  const test = await testAIConnection();

  return NextResponse.json({
    configured: status.gemini || status.groq,
    provider: status.active,
    connected: test.ok,
    model: test.model,
    error: test.error,
  });
}
