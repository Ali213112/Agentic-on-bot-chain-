/**
 * Deploy TestUSDC, UsdcFaucet, AgentBroker, crypto tokens, seed broker
 * Target: BOT Chain Testnet (Chain ID 968)
 * Usage: node scripts/deploy-all.mjs
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  createPublicClient,
  createWalletClient,
  http,
  formatEther,
  parseEther,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const buildDir = join(root, "contracts/build");

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

function bin(name) {
  const file = join(buildDir, name);
  if (!existsSync(file)) throw new Error(`Missing ${file}. Run: node scripts/compile-vault.mjs`);
  const raw = readFileSync(file, "utf8").trim();
  return raw.startsWith("0x") ? raw : `0x${raw}`;
}

const TEST_USDC_ABI = [{ inputs: [], type: "constructor" }];
const SET_MINTER_ABI = [
  {
    inputs: [
      { name: "minter", type: "address" },
      { name: "allowed", type: "bool" },
    ],
    name: "setMinter",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
];
const MINTABLE_ABI = [
  {
    inputs: [
      { name: "name_", type: "string" },
      { name: "symbol_", type: "string" },
    ],
    type: "constructor",
  },
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
];
const FAUCET_ABI = [{ inputs: [{ name: "usdcToken", type: "address" }], type: "constructor" }];
const BROKER_ABI = [{ inputs: [{ name: "usdcToken", type: "address" }], type: "constructor" }];
const ERC20_MINT_ABI = [
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
];
const ERC20_TRANSFER_ABI = [
  {
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "transfer",
    outputs: [{ type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function deploy(walletClient, publicClient, abi, bytecode, args = []) {
  const hash = await walletClient.deployContract({ abi, bytecode, args });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (!receipt.contractAddress) throw new Error("No contract address in receipt");
  await sleep(1500); // wait for nonce to settle on chain
  return { address: receipt.contractAddress, hash };
}

async function write(walletClient, publicClient, params) {
  const hash = await walletClient.writeContract(params);
  await publicClient.waitForTransactionReceipt({ hash });
  await sleep(1500);
  return hash;
}

async function main() {
  const env = loadEnv();
  let pk = env.OPERATOR_PRIVATE_KEY ?? env.DEPLOYER_PRIVATE_KEY;
  if (!pk) {
    console.error("❌ Set DEPLOYER_PRIVATE_KEY in .env.local");
    process.exit(1);
  }
  if (!pk.startsWith("0x")) pk = `0x${pk}`;

  const account = privateKeyToAccount(pk);
  const rpc = env.BOT_TESTNET_RPC_URL ?? "https://rpc.bohr.life";
  const transport = http(rpc);
  const publicClient = createPublicClient({ chain, transport });
  const walletClient = createWalletClient({ account, chain, transport });

  const bal = await publicClient.getBalance({ address: account.address });
  console.log("Operator :", account.address);
  console.log("BOT bal  :", formatEther(bal), "BOT");
  if (bal === 0n) {
    console.error("❌ No BOT for gas. Get testnet BOT at https://faucet.botchain.ai/basic");
    process.exit(1);
  }

  console.log("\n1. Deploy TestUSDC...");
  const usdc = await deploy(
    walletClient, publicClient,
    TEST_USDC_ABI,
    bin("contracts_TestUSDC_sol_TestUSDC.bin")
  );
  console.log("   ✓", usdc.address);

  console.log("2. Deploy UsdcFaucet...");
  const faucet = await deploy(
    walletClient, publicClient,
    FAUCET_ABI,
    bin("contracts_UsdcFaucet_sol_UsdcFaucet.bin"),
    [usdc.address]
  );
  console.log("   ✓", faucet.address);

  console.log("3. Set faucet as USDC minter...");
  await write(walletClient, publicClient, {
    address: usdc.address,
    abi: SET_MINTER_ABI,
    functionName: "setMinter",
    args: [faucet.address, true],
  });
  console.log("   ✓ minter set");

  console.log("4. Fund faucet pool with 1,000,000 tUSDC...");
  await write(walletClient, publicClient, {
    address: usdc.address,
    abi: ERC20_MINT_ABI,
    functionName: "mint",
    args: [faucet.address, BigInt(1_000_000 * 1e6)],
  });
  console.log("   ✓ 1,000,000 tUSDC in faucet");

  console.log("5. Deploy AgentBroker...");
  const broker = await deploy(
    walletClient, publicClient,
    BROKER_ABI,
    bin("contracts_AgentBroker_sol_AgentBroker.bin"),
    [usdc.address]
  );
  console.log("   ✓", broker.address);

  // 5 crypto synthetic tokens — crypto-only mode on BOT Chain
  const cryptos = [
    ["btcToken", "Test Bitcoin", "tBTC"],
    ["ethToken", "Test Ethereum", "tETH"],
    ["solToken", "Test Solana", "tSOL"],
    ["xrpToken", "Test Ripple", "tXRP"],
    ["bnbToken", "Test BNB", "tBNB"],
  ];

  console.log("6. Deploy crypto synthetic tokens...");
  const cryptoAddresses = {};
  for (const [key, name, symbol] of cryptos) {
    const t = await deploy(
      walletClient, publicClient,
      MINTABLE_ABI,
      bin("contracts_MintableAsset_sol_MintableAsset.bin"),
      [name, symbol]
    );
    cryptoAddresses[key] = t.address;
    console.log(`   ✓ ${symbol}:`, t.address);
  }

  console.log("7. Mint 1000 of each token to broker inventory...");
  for (const [key, , symbol] of cryptos) {
    const addr = cryptoAddresses[key];
    await write(walletClient, publicClient, {
      address: addr,
      abi: ERC20_MINT_ABI,
      functionName: "mint",
      args: [broker.address, parseEther("1000")],
    });
    console.log(`   ✓ 1000 ${symbol} → broker`);
  }

  const deployed = {
    usdcToken: usdc.address,
    faucetAddress: faucet.address,
    brokerAddress: broker.address,
    brokerDeployTx: broker.hash,
    ...cryptoAddresses,
  };

  mkdirSync(join(root, "contracts"), { recursive: true });
  writeFileSync(
    join(root, "contracts/deployed.json"),
    JSON.stringify(deployed, null, 2)
  );

  console.log("\n✅ All deployed! Saved to contracts/deployed.json");
  console.log("   USDC   :", usdc.address);
  console.log("   Faucet :", faucet.address);
  console.log("   Broker :", broker.address);
  console.log("\nNext: fund some tUSDC to a test wallet via the faucet at http://localhost:3000");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
