import { NextResponse } from "next/server";
import { deployAgentVault, getChainStatus } from "@/lib/chain-deploy";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getChainStatus());
}

export async function POST() {
  try {
    const result = await deployAgentVault();
    if (!result) {
      return NextResponse.json(
        {
          error:
            "Set DEPLOYER_PRIVATE_KEY and AGENT_VAULT_BYTECODE in .env.local. Compile with: npx solcjs --bin contracts/AgentVault.sol",
        },
        { status: 400 }
      );
    }
    return NextResponse.json({
      success: true,
      address: result.address,
      txHash: result.txHash,
      explorer: `https://explorer.testnet.chain.robinhood.com/address/${result.address}`,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Deploy failed" },
      { status: 500 }
    );
  }
}
