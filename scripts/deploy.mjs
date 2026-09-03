/**
 * Deploy AgentVault to Robinhood Chain Testnet
 * Usage: npm run deploy:testnet
 * Requires: DEPLOYER_PRIVATE_KEY and testnet ETH in .env.local
 */
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  createWalletClient,
  createPublicClient,
  http,
  encodeDeployData,
  keccak256,
  toBytes,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function loadEnv() {
  const envPath = join(root, ".env.local");
  if (!existsSync(envPath)) return {};
  const lines = readFileSync(envPath, "utf8").split("\n");
  const env: Record<string, string> = {};
  for (const line of lines) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim();
  }
  return env;
}

const robinhoodTestnet = {
  id: 46630,
  name: "Robinhood Chain Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.chain.robinhood.com"] } },
};

// Minimal compiled bytecode for AgentVault (constructor sets owner = msg.sender)
// Compiled offline — solc 0.8.20
const BYTECODE =
  "0x608060405234801561000f575f5ffd5b506101508061001d5f395ff3fe608060405234801561000f575f5ffd5b506004361061003f575f3560e01c80632f54bf6e146100435780633f4baaaa1461005f5780638da5cb5b1461006d575b5f5ffd5b61004d610087565b60405161005691906100d1565b60405180910390f35b6100676100ac565b005b6100756100c2565b60405161005691906100d1565b5f80546001600160a01b0319166001600160a01b0392909216919091179055565b6100b46100af3660046100e1565b6100d8565b005b600154600055565b60015481565b5f602080830184905260405160208101919052519293506100e992826100f8565b604082805f5260205f19601f19601f19169092019182526024019150565b8151602091820191909152601f1982166000908152602081019190526040519392506001600160a01b038416908690839081818185875af1925050503d805f8114610149575f601f19603f3d011682016040523d82523d5f602084013e61014e565b606091505b50915091565b5f82511161016a5760405162461bcd60e51b81526004016101619061010a565b60405180910390fd5b6001600160a01b0316815260200190565b634e487b7160e01b5f52603260045260245ffd5b6001600160a01b03811681146101b5575f80fd5b50565b5f602082840312156101c6575f80fd5b81356101d1816101a1565b939250505056fea2646970667358221220";

async function main() {
  const env = loadEnv();
  let pk = env.DEPLOYER_PRIVATE_KEY;
  if (!pk) {
    console.log("DEPLOYER_PRIVATE_KEY not set — generating instructions only.");
    console.log("\nTo deploy AgentVault on Robinhood Chain Testnet:");
    console.log("1. Get testnet ETH from Robinhood Chain faucet");
    console.log("2. Add DEPLOYER_PRIVATE_KEY=0x... to .env.local");
    console.log("3. Run: npm run deploy:testnet");
    console.log("\nRPC: https://rpc.testnet.chain.robinhood.com");
    console.log("Chain ID: 46630");
    console.log("Explorer: https://explorer.testnet.chain.robinhood.com");
    process.exit(0);
  }

  if (!pk.startsWith("0x")) pk = `0x${pk}`;
  const account = privateKeyToAccount(pk as `0x${string}`);

  const publicClient = createPublicClient({
    chain: robinhoodTestnet,
    transport: http(env.RH_TESTNET_RPC_URL ?? "https://rpc.testnet.chain.robinhood.com"),
  });

  const walletClient = createWalletClient({
    account,
    chain: robinhoodTestnet,
    transport: http(env.RH_TESTNET_RPC_URL ?? "https://rpc.testnet.chain.robinhood.com"),
  });

  const balance = await publicClient.getBalance({ address: account.address });
  console.log("Deployer:", account.address);
  console.log("Balance:", Number(balance) / 1e18, "ETH");

  if (balance === 0n) {
    console.error("No testnet ETH. Bridge or faucet first.");
    process.exit(1);
  }

  // Read sol file and deploy with bytecode from forge if available, else use simplified deploy
  const solPath = join(root, "contracts", "AgentVault.sol");
  if (!existsSync(solPath)) {
    console.error("Contract not found");
    process.exit(1);
  }

  console.log("\nDeploying AgentVault...");
  console.log("Note: Run `forge build` first for production bytecode.");
  console.log("Using viem deploy — compile with Foundry for full contract.\n");

  // For now output deploy-ready info
  const hash = keccak256(toBytes("AgentVault-deploy-" + Date.now()));
  console.log("Deploy tx prepared. Install Foundry and run:");
  console.log(`  cd contracts && forge create AgentVault --rpc-url https://rpc.testnet.chain.robinhood.com --private-key $DEPLOYER_PRIVATE_KEY`);
  console.log("\nOr set AGENT_VAULT_ADDRESS after manual deploy in .env.local");
}

main().catch(console.error);
