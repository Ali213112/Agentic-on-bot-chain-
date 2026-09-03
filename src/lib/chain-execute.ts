import { readFileSync, existsSync } from "fs";
import { join } from "path";
import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { CHAIN_CONFIG } from "./assets";
import type { Allocation } from "./debate";
import type { ChainTxResult } from "./pipeline-types";
import { readDeployed, saveDeployed } from "./deployed";

const botTestnet = {
  id: CHAIN_CONFIG.chainId,
  name: CHAIN_CONFIG.name,
  nativeCurrency: { name: "BOT", symbol: "BOT", decimals: 18 },
  rpcUrls: { default: { http: [CHAIN_CONFIG.rpcUrl] } },
} as const;

export const AGENT_VAULT_ABI = [
  {
    inputs: [],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    inputs: [
      { name: "totalAmount", type: "uint256" },
      { name: "symbols", type: "string[]" },
      { name: "percents", type: "uint8[]" },
      { name: "amounts", type: "uint256[]" },
      { name: "isCrypto", type: "bool[]" },
    ],
    name: "createPlan",
    outputs: [{ name: "planId", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "planId", type: "uint256" }],
    name: "markExecuted",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "planCount",
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

function loadBytecode(): Hex | null {
  const fromEnv = process.env.AGENT_VAULT_BYTECODE;
  if (fromEnv?.startsWith("0x")) return fromEnv as Hex;

  const paths = [
    join(process.cwd(), "contracts", "build", "contracts_AgentVault_sol_AgentVault.bin"),
    join(process.cwd(), "..", "contracts", "build", "contracts_AgentVault_sol_AgentVault.bin"),
  ];

  for (const p of paths) {
    if (existsSync(p)) {
      const raw = readFileSync(p, "utf8").trim();
      return (raw.startsWith("0x") ? raw : `0x${raw}`) as Hex;
    }
  }
  return null;
}

function getDeployerAccount() {
  const pk = process.env.DEPLOYER_PRIVATE_KEY;
  if (!pk) return null;
  const key = pk.startsWith("0x") ? pk : `0x${pk}`;
  return privateKeyToAccount(key as Hex);
}

/** Plan-store AgentVault address. Never reuse trading vaultAddress. */
function readPlanVaultAddress(): Address | null {
  const fromEnv = process.env.PLAN_VAULT_ADDRESS ?? process.env.AGENT_VAULT_ADDRESS;
  if (fromEnv?.startsWith("0x")) return fromEnv as Address;
  const data = readDeployed();
  const addr = data.planVaultAddress;
  return addr?.startsWith("0x") ? (addr as Address) : null;
}

function savePlanVault(address: Address, txHash: Hex) {
  // Merge into deployed.json — never wipe trading vault / pool / tokens.
  saveDeployed({
    planVaultAddress: address,
    planVaultDeployTx: txHash,
  });
}

export function getVaultAddress(): Address | null {
  return readPlanVaultAddress();
}

export async function getChainExecutionStatus() {
  const account = getDeployerAccount();
  const vault = getVaultAddress();
  const bytecode = loadBytecode();
  let balance = "0";

  if (account) {
    try {
      const client = createPublicClient({
        chain: botTestnet,
        transport: http(CHAIN_CONFIG.rpcUrl),
      });
      const bal = await client.getBalance({ address: account.address });
      balance = (Number(bal) / 1e18).toFixed(4);
    } catch {
      /* ignore */
    }
  }

  const canExecute = !!account && !!vault && parseFloat(balance) > 0;
  let setupMessage: string | undefined;

  if (!account) {
    setupMessage =
      "Add DEPLOYER_PRIVATE_KEY to .env.local with a wallet funded on BOT Chain testnet.";
  } else if (!vault) {
    setupMessage =
      "AgentVault not deployed yet. The execution agent will auto-deploy on first run.";
  } else if (parseFloat(balance) === 0) {
    setupMessage = `Fund deployer ${account.address} with testnet BOT from https://faucet.botchain.ai/basic`;
  }

  return {
    chainId: CHAIN_CONFIG.chainId,
    name: CHAIN_CONFIG.name,
    rpc: CHAIN_CONFIG.rpcUrl,
    explorer: CHAIN_CONFIG.explorer,
    vaultDeployed: !!vault,
    vaultAddress: vault,
    deployerAddress: account?.address ?? null,
    deployerBalanceEth: balance,
    canDeploy: !!account && !!bytecode,
    canExecute,
    setupMessage,
  };
}

export async function deployAgentVault(): Promise<{
  address: Address;
  txHash: Hex;
} | null> {
  const account = getDeployerAccount();
  const bytecode = loadBytecode();
  if (!account || !bytecode) return null;

  const transport = http(CHAIN_CONFIG.rpcUrl);
  const publicClient = createPublicClient({ chain: botTestnet, transport });
  const walletClient = createWalletClient({
    account,
    chain: botTestnet,
    transport,
  });

  const hash = await walletClient.deployContract({
    abi: AGENT_VAULT_ABI,
    bytecode,
    args: [],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const address = receipt.contractAddress;
  if (!address) throw new Error("Deploy failed — no contract address");

  return { address, txHash: hash };
}

export async function ensureVaultDeployed(): Promise<Address> {
  const existing = getVaultAddress();
  if (existing) return existing;

  const deployed = await deployAgentVault();
  if (!deployed) {
    throw new Error(
      "Cannot deploy AgentVault. Set DEPLOYER_PRIVATE_KEY and ensure compiled bytecode exists."
    );
  }

  savePlanVault(deployed.address, deployed.txHash);
  process.env.PLAN_VAULT_ADDRESS = deployed.address;
  return deployed.address;
}

export async function executePlanOnChain(
  totalAmount: number,
  allocation: Allocation[]
): Promise<ChainTxResult> {
  try {
    const account = getDeployerAccount();
    if (!account) {
      return {
        success: false,
        error: "DEPLOYER_PRIVATE_KEY not set in .env.local",
      };
    }

    const vaultAddress = await ensureVaultDeployed();
    const transport = http(CHAIN_CONFIG.rpcUrl);
    const publicClient = createPublicClient({ chain: botTestnet, transport });
    const walletClient = createWalletClient({
      account,
      chain: botTestnet,
      transport,
    });

    const balance = await publicClient.getBalance({ address: account.address });
    if (balance === BigInt(0)) {
      return {
        success: false,
        vaultAddress,
        error: `Deployer ${account.address} has 0 testnet BOT. Get BOT from https://faucet.botchain.ai/basic`,
      };
    }

    const symbols = allocation.map((a) => a.symbol);
    const percents = allocation.map((a) => a.percent as number);
    const amounts = allocation.map((a) => BigInt(a.amount));
    const isCrypto = allocation.map((a) => a.type === "crypto");

    const createHash = await walletClient.writeContract({
      address: vaultAddress,
      abi: AGENT_VAULT_ABI,
      functionName: "createPlan",
      args: [BigInt(totalAmount), symbols, percents, amounts, isCrypto],
    });

    const createReceipt = await publicClient.waitForTransactionReceipt({
      hash: createHash,
    });

    const planCount = await publicClient.readContract({
      address: vaultAddress,
      abi: AGENT_VAULT_ABI,
      functionName: "planCount",
    });

    const planId = Number(planCount) - 1;

    const executeHash = await walletClient.writeContract({
      address: vaultAddress,
      abi: AGENT_VAULT_ABI,
      functionName: "markExecuted",
      args: [BigInt(planId)],
    });

    await publicClient.waitForTransactionReceipt({ hash: executeHash });

    return {
      success: true,
      planId,
      createTxHash: createHash,
      executeTxHash: executeHash,
      vaultAddress,
      explorerUrl: `${CHAIN_CONFIG.explorer}/tx/${executeHash}`,
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "On-chain execution failed",
    };
  }
}
