/** Mint 1M USDC to existing faucet pool */
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createPublicClient, createWalletClient, http, formatUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const POOL = 1_000_000n * 1_000_000n;

const chain = {
  id: 46630,
  name: "Robinhood Chain Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.chain.robinhood.com"] } },
};

async function main() {
  const env = {};
  for (const line of readFileSync(join(root, ".env.local"), "utf8").split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim();
  }
  let pk = env.DEPLOYER_PRIVATE_KEY;
  if (!pk.startsWith("0x")) pk = `0x${pk}`;
  const account = privateKeyToAccount(pk);
  const transport = http("https://rpc.testnet.chain.robinhood.com");
  const publicClient = createPublicClient({ chain, transport });
  const walletClient = createWalletClient({ account, chain, transport });

  const deployed = JSON.parse(readFileSync(join(root, "contracts/deployed.json"), "utf8"));
  const faucet = deployed.faucetAddress;
  const usdc = deployed.usdcToken;

  const current = await publicClient.readContract({
    address: faucet,
    abi: [{ inputs: [], name: "poolBalance", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" }],
    functionName: "poolBalance",
  });
  console.log("Current pool:", formatUnits(current, 6));

  if (current >= POOL) {
    console.log("Already funded");
    return;
  }

  const needed = POOL - current;
  console.log("Minting", formatUnits(needed, 6), "to faucet...");
  const hash = await walletClient.writeContract({
    address: usdc,
    abi: [{ inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], name: "mint", outputs: [], stateMutability: "nonpayable", type: "function" }],
    functionName: "mint",
    args: [faucet, needed],
  });
  await publicClient.waitForTransactionReceipt({ hash });

  const pool = await publicClient.readContract({
    address: faucet,
    abi: [{ inputs: [], name: "poolBalance", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" }],
    functionName: "poolBalance",
  });
  console.log("Pool now:", formatUnits(pool, 6), "tUSDC");
}

main().catch(console.error);
