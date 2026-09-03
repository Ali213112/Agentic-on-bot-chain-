/**
 * Seed broker inventory — mint 1000 of each crypto token to AgentBroker
 * Usage: node scripts/seed-broker.mjs
 */
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createPublicClient, createWalletClient, http, formatEther, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const chain = {
  id: 968,
  name: "BOT Chain Testnet",
  nativeCurrency: { name: "BOT", symbol: "BOT", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.bohr.life"] } },
};

function loadEnv() {
  const envPath = join(root, ".env.local");
  if (!existsSync(envPath)) return {};
  const env = {};
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim();
  }
  return env;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const MINT_ABI = [
  {
    inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }],
    name: "mint",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
];

async function main() {
  const env = loadEnv();
  let pk = env.OPERATOR_PRIVATE_KEY ?? env.DEPLOYER_PRIVATE_KEY;
  if (!pk) { console.error("No DEPLOYER_PRIVATE_KEY"); process.exit(1); }
  if (!pk.startsWith("0x")) pk = `0x${pk}`;

  const deployed = JSON.parse(readFileSync(join(root, "contracts/deployed.json"), "utf8"));
  const broker = deployed.brokerAddress;
  if (!broker) { console.error("No brokerAddress in deployed.json"); process.exit(1); }

  const account = privateKeyToAccount(pk);
  const transport = http(env.BOT_TESTNET_RPC_URL ?? "https://rpc.bohr.life");
  const publicClient = createPublicClient({ chain, transport });
  const walletClient = createWalletClient({ account, chain, transport });

  const bal = await publicClient.getBalance({ address: account.address });
  console.log("Operator:", account.address, "| BOT:", formatEther(bal));

  const tokens = [
    ["tBTC", deployed.btcToken],
    ["tETH", deployed.ethToken],
    ["tSOL", deployed.solToken],
    ["tXRP", deployed.xrpToken],
    ["tBNB", deployed.bnbToken],
  ];

  for (const [symbol, addr] of tokens) {
    if (!addr) { console.log(`  skip ${symbol} — no address`); continue; }
    console.log(`Minting 1000 ${symbol} to broker...`);
    const hash = await walletClient.writeContract({
      address: addr,
      abi: MINT_ABI,
      functionName: "mint",
      args: [broker, parseEther("1000")],
    });
    await publicClient.waitForTransactionReceipt({ hash });
    await sleep(1500);
    console.log(`  ✓ ${symbol} done — tx: ${hash}`);
  }

  console.log("\n✅ Broker seeded!");
}

main().catch((e) => { console.error(e); process.exit(1); });
