import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import type { Address } from "viem";

const DEPLOYED_PATH = join(process.cwd(), "contracts", "deployed.json");

export interface DeployedContracts {
  usdcToken?: string;
  faucetAddress?: string;
  /** AgentTradingVault — holds tUSDC and executes swaps */
  vaultAddress?: string;
  /** AgentVault (plan metadata only) — must never overwrite vaultAddress */
  planVaultAddress?: string;
  planVaultDeployTx?: string;
  poolAddress?: string;
  brokerAddress?: string;
  btcToken?: string;
  ethToken?: string;
  solToken?: string;
  xrpToken?: string;
  bnbToken?: string;
  dogeToken?: string;
  brokerDeployTx?: string;
}

/**
 * Compiled-in fallback for BOT Chain Testnet deployed contracts.
 * Used when filesystem reads fail on serverless (Vercel) runtimes.
 * Update these after every fresh mainnet/testnet deploy.
 */
const BUILTIN_DEPLOYED: DeployedContracts = {
  usdcToken: "0x5a85530bb68168fd8b3cab69594878b4cb95d4be",
  faucetAddress: "0x2109d8da4d659f82147b251a5e9b90c3735dbb29",
  brokerAddress: "0x3883889390ce6f7c1f9f8a47ef329b8e402f275b",
  btcToken: "0xa85468f30291d6a77cf0ff66eba0635b67273555",
  ethToken: "0xacf22fdac022bd1d33af0d0c40f48dc646c73b81",
  solToken: "0x6175bcadb6463912fd914cab4b3659a0b6901867",
  xrpToken: "0x1ca45d3af2f98b3e05457caca41cee83db68667f",
  bnbToken: "0xf248d4c77d81e24da2f08dcdbf2ac4766faf27a6",
};

export function readDeployed(): DeployedContracts {
  // Try filesystem first (works in dev + scripts), fall back to compiled-in
  // constants when running on Vercel serverless where CWD may differ.
  try {
    if (existsSync(DEPLOYED_PATH)) {
      const parsed = JSON.parse(readFileSync(DEPLOYED_PATH, "utf8")) as DeployedContracts;
      // Merge with built-ins so missing keys still resolve
      return { ...BUILTIN_DEPLOYED, ...parsed };
    }
  } catch {
    /* fall through to built-ins */
  }
  return BUILTIN_DEPLOYED;
}

export function saveDeployed(data: Partial<DeployedContracts>) {
  mkdirSync(join(process.cwd(), "contracts"), { recursive: true });
  const existing = readDeployed();
  writeFileSync(
    DEPLOYED_PATH,
    JSON.stringify({ ...existing, ...data }, null, 2)
  );
}

export function getUsdcAddress(): Address | null {
  const addr =
    process.env.TEST_USDC_ADDRESS ?? readDeployed().usdcToken;
  return addr?.startsWith("0x") ? (addr as Address) : null;
}

export function getFaucetAddress(): Address | null {
  const addr =
    process.env.USDC_FAUCET_ADDRESS ?? readDeployed().faucetAddress;
  return addr?.startsWith("0x") ? (addr as Address) : null;
}

export function getBrokerAddress(): Address | null {
  const addr =
    process.env.AGENT_BROKER_ADDRESS ?? readDeployed().brokerAddress;
  return addr?.startsWith("0x") ? (addr as Address) : null;
}

export function getVaultAddress(): Address | null {
  const addr =
    process.env.AGENT_VAULT_ADDRESS ?? readDeployed().vaultAddress;
  return addr?.startsWith("0x") ? (addr as Address) : null;
}
