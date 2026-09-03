import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { CHAIN_CONFIG } from "./assets";

const botTestnet = {
  id: CHAIN_CONFIG.chainId,
  name: CHAIN_CONFIG.name,
  nativeCurrency: { name: "BOT", symbol: "BOT", decimals: 18 },
  rpcUrls: { default: { http: [CHAIN_CONFIG.rpcUrl] } },
} as const;

const AGENT_VAULT_ABI = [
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
    inputs: [],
    name: "planCount",
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export function getVaultAddress(): Address | null {
  const addr = process.env.AGENT_VAULT_ADDRESS;
  return addr?.startsWith("0x") ? (addr as Address) : null;
}

export async function deployAgentVault(): Promise<{
  address: Address;
  txHash: Hex;
} | null> {
  const pk = process.env.DEPLOYER_PRIVATE_KEY;
  const bytecode = process.env.AGENT_VAULT_BYTECODE as Hex | undefined;

  if (!pk || !bytecode) return null;

  const key = pk.startsWith("0x") ? pk : `0x${pk}`;
  const account = privateKeyToAccount(key as Hex);

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

export async function getChainStatus() {
  const vault = getVaultAddress();
  let balance = "0";

  if (process.env.DEPLOYER_PRIVATE_KEY) {
    try {
      const key = process.env.DEPLOYER_PRIVATE_KEY.startsWith("0x")
        ? process.env.DEPLOYER_PRIVATE_KEY
        : `0x${process.env.DEPLOYER_PRIVATE_KEY}`;
      const account = privateKeyToAccount(key as Hex);
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

  return {
    chainId: CHAIN_CONFIG.chainId,
    name: CHAIN_CONFIG.name,
    rpc: CHAIN_CONFIG.rpcUrl,
    explorer: CHAIN_CONFIG.explorer,
    vaultDeployed: !!vault,
    vaultAddress: vault,
    deployerBalanceEth: balance,
    canDeploy: !!process.env.DEPLOYER_PRIVATE_KEY && !!process.env.AGENT_VAULT_BYTECODE,
  };
}
