/**
 * Redeploy UsdcFaucet (pool model) and fund with 1,000,000 tUSDC
 * Usage: node scripts/fund-faucet.mjs
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  createPublicClient,
  createWalletClient,
  http,
  formatUnits,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const POOL_AMOUNT = 1_000_000n * 1_000_000n; // 1M USDC, 6 decimals

const chain = {
  id: 46630,
  name: "Robinhood Chain Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.chain.robinhood.com"] } },
};

function loadEnv() {
  const env = {};
  for (const line of readFileSync(join(root, ".env.local"), "utf8").split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim();
  }
  return env;
}

function bin(name) {
  return `0x${readFileSync(join(root, "contracts/build", name), "utf8").trim()}`;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const env = loadEnv();
  let pk = env.DEPLOYER_PRIVATE_KEY;
  if (!pk.startsWith("0x")) pk = `0x${pk}`;
  const account = privateKeyToAccount(pk);
  const transport = http("https://rpc.testnet.chain.robinhood.com");
  const publicClient = createPublicClient({ chain, transport });
  const walletClient = createWalletClient({ account, chain, transport });

  const deployed = JSON.parse(
    readFileSync(join(root, "contracts/deployed.json"), "utf8")
  );
  const usdc = deployed.usdcToken;

  console.log("Deploying new UsdcFaucet (pool model)...");
  await wait(2000);
  const hash = await walletClient.deployContract({
    abi: [{ inputs: [{ name: "usdcToken", type: "address" }], type: "constructor" }],
    bytecode: bin("contracts_UsdcFaucet_sol_UsdcFaucet.bin"),
    args: [usdc],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const faucet = receipt.contractAddress;
  console.log("Faucet:", faucet);

  console.log("Minting 1,000,000 tUSDC to faucet pool...");
  await wait(2000);
  const mintHash = await walletClient.writeContract({
    address: usdc,
    abi: [
      {
        inputs: [
          { name: "to", type: "address" },
          { name: "amount", type: "uint256" },
        ],
        name: "mint",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
      },
    ],
    functionName: "mint",
    args: [faucet, POOL_AMOUNT],
  });
  await publicClient.waitForTransactionReceipt({ hash: mintHash });

  const pool = await publicClient.readContract({
    address: faucet,
    abi: [
      {
        inputs: [],
        name: "poolBalance",
        outputs: [{ type: "uint256" }],
        stateMutability: "view",
        type: "function",
      },
    ],
    functionName: "poolBalance",
  });

  console.log("Pool balance:", formatUnits(pool, 6), "tUSDC");
  console.log("Claims available:", Number(pool / (300n * 1_000_000n)));

  deployed.faucetAddress = faucet;
  deployed.faucetPoolUsd = 1_000_000;
  writeFileSync(join(root, "contracts/deployed.json"), JSON.stringify(deployed, null, 2));
  console.log("Updated deployed.json");
}

main().catch(console.error);
