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

export function readDeployed(): DeployedContracts {
  if (!existsSync(DEPLOYED_PATH)) return {};
  try {
    return JSON.parse(readFileSync(DEPLOYED_PATH, "utf8")) as DeployedContracts;
  } catch {
    return {};
  }
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
