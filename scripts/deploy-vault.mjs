/**
 * Deploy AgentTradingVault + save address
 * Usage: node scripts/deploy-vault.mjs
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  createPublicClient,
  createWalletClient,
  http,
  encodeDeployData,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = join(root, "contracts/build");

const UNISWAP_ROUTER = "0x89e5DB8B5aA49aA85AC63f691524311AEB649eba";

const chain = {
  id: 46630,
  name: "Robinhood Chain Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.chain.robinhood.com"] } },
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

async function main() {
  const env = loadEnv();
  let pk = env.DEPLOYER_PRIVATE_KEY;
  if (!pk) throw new Error("DEPLOYER_PRIVATE_KEY missing");
  if (!pk.startsWith("0x")) pk = `0x${pk}`;

  const deployed = JSON.parse(
    readFileSync(join(root, "contracts/deployed.json"), "utf8")
  );
  const usdc = deployed.usdcToken;
  if (!usdc) throw new Error("usdcToken missing in deployed.json");

  const binPath = join(buildDir, "contracts_AgentTradingVault_sol_AgentTradingVault.bin");
  if (!existsSync(binPath)) {
    throw new Error(`Missing ${binPath}. Run: node scripts/compile-vault.mjs`);
  }
  const bytecode = `0x${readFileSync(binPath, "utf8").trim()}`;

  const account = privateKeyToAccount(pk);
  const transport = http("https://rpc.testnet.chain.robinhood.com");
  const publicClient = createPublicClient({ chain, transport });
  const walletClient = createWalletClient({ account, chain, transport });

  const data = encodeDeployData({
    abi: [
      {
        inputs: [
          { name: "usdcToken", type: "address" },
          { name: "uniswapRouter", type: "address" },
        ],
        type: "constructor",
      },
    ],
    bytecode,
    args: [usdc, UNISWAP_ROUTER],
  });

  console.log("Deploying AgentTradingVault...");
  const hash = await walletClient.sendTransaction({ data });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const vault = receipt.contractAddress;
  console.log("Vault:", vault);

  deployed.vaultAddress = vault;
  deployed.uniswapRouter = UNISWAP_ROUTER;
  writeFileSync(join(root, "contracts/deployed.json"), JSON.stringify(deployed, null, 2));
  console.log("Saved to contracts/deployed.json");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
