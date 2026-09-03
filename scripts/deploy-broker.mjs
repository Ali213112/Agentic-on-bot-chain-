/**
 * Deploy AgentBroker to Robinhood Chain Testnet
 * Usage: node scripts/deploy-broker.mjs
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  createPublicClient,
  createWalletClient,
  http,
  formatEther,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

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

const chain = {
  id: 46630,
  name: "Robinhood Chain Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.chain.robinhood.com"] } },
};

const ABI = [{ inputs: [], stateMutability: "nonpayable", type: "constructor" }];

async function main() {
  const env = loadEnv();
  let pk = env.OPERATOR_PRIVATE_KEY ?? env.DEPLOYER_PRIVATE_KEY;
  if (!pk) {
    console.error("Set OPERATOR_PRIVATE_KEY or DEPLOYER_PRIVATE_KEY in .env.local");
    process.exit(1);
  }
  if (!pk.startsWith("0x")) pk = `0x${pk}`;

  const binPath = join(
    root,
    "contracts/build/contracts_AgentBroker_sol_AgentBroker.bin"
  );
  if (!existsSync(binPath)) {
    console.error("Bytecode not found. Run: npx solc@0.8.20 --bin contracts/AgentBroker.sol -o contracts/build");
    process.exit(1);
  }

  const bytecode = `0x${readFileSync(binPath, "utf8").trim()}`;
  const account = privateKeyToAccount(pk);
  const rpc = env.RH_TESTNET_RPC_URL ?? "https://rpc.testnet.chain.robinhood.com";
  const transport = http(rpc);
  const publicClient = createPublicClient({ chain, transport });
  const walletClient = createWalletClient({ account, chain, transport });

  const balance = await publicClient.getBalance({ address: account.address });
  console.log("Operator:", account.address);
  console.log("Balance:", formatEther(balance), "ETH");

  if (balance === 0n) {
    console.error("No testnet ETH. Get from https://faucet.testnet.chain.robinhood.com/");
    process.exit(1);
  }

  console.log("\nDeploying AgentBroker...");
  const hash = await walletClient.deployContract({ abi: ABI, bytecode, args: [] });
  console.log("Tx:", hash);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const address = receipt.contractAddress;
  if (!address) {
    console.error("Deploy failed — no address");
    process.exit(1);
  }

  mkdirSync(join(root, "contracts"), { recursive: true });
  const deployedPath = join(root, "contracts", "deployed.json");
  let existing = {};
  if (existsSync(deployedPath)) {
    try {
      existing = JSON.parse(readFileSync(deployedPath, "utf8"));
    } catch {
      /* ignore */
    }
  }
  writeFileSync(
    deployedPath,
    JSON.stringify(
      { ...existing, brokerAddress: address, brokerDeployTx: hash },
      null,
      2
    )
  );

  console.log("\nDeployed AgentBroker!");
  console.log("Address:", address);
  console.log("Explorer: https://explorer.testnet.chain.robinhood.com/address/" + address);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
