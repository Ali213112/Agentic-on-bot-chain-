/**
 * Resume deploy from saved usdc + faucet addresses
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
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

async function deploy(walletClient, publicClient, abi, bytecode, args = []) {
  await wait(2000);
  const hash = await walletClient.deployContract({ abi, bytecode, args });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (!receipt.contractAddress) throw new Error("No address");
  return { address: receipt.contractAddress, hash };
}

async function main() {
  const env = loadEnv();
  let pk = env.DEPLOYER_PRIVATE_KEY;
  if (!pk.startsWith("0x")) pk = `0x${pk}`;
  const account = privateKeyToAccount(pk);
  const transport = http("https://rpc.testnet.chain.robinhood.com");
  const publicClient = createPublicClient({ chain, transport });
  const walletClient = createWalletClient({ account, chain, transport });

  const deployed = existsSync(join(root, "contracts/deployed.json"))
    ? JSON.parse(readFileSync(join(root, "contracts/deployed.json"), "utf8"))
    : {
        usdcToken: "0x2109d8da4d659f82147b251a5e9b90c3735dbb29",
        faucetAddress: "0xeddeaf515e217d12d8a93ec99bc6c05266a16ae1",
      };

  console.log("USDC:", deployed.usdcToken);
  console.log("Faucet:", deployed.faucetAddress);

  if (!deployed.brokerAddress) {
    console.log("Deploying AgentBroker...");
    const broker = await deploy(
      walletClient,
      publicClient,
      [{ inputs: [{ name: "usdcToken", type: "address" }], type: "constructor" }],
      bin("contracts_AgentBroker_sol_AgentBroker.bin"),
      [deployed.usdcToken]
    );
    deployed.brokerAddress = broker.address;
    deployed.brokerDeployTx = broker.hash;
    console.log("Broker:", broker.address);
  }

  const MINTABLE_ABI = [
    { inputs: [{ name: "name_", type: "string" }, { name: "symbol_", type: "string" }], type: "constructor" },
    { inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], name: "mint", outputs: [], stateMutability: "nonpayable", type: "function" },
  ];
  const TRANSFER_ABI = [
    { inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], name: "transfer", outputs: [{ type: "bool" }], stateMutability: "nonpayable", type: "function" },
  ];

  const cryptos = [
    ["btcToken", "Test Bitcoin", "tBTC"],
    ["ethToken", "Test Ethereum", "tETH"],
    ["solToken", "Test Solana", "tSOL"],
    ["xrpToken", "Test Ripple", "tXRP"],
    ["dogeToken", "Test Dogecoin", "tDOGE"],
  ];

  for (const [key, name, symbol] of cryptos) {
    if (deployed[key]) continue;
    const t = await deploy(walletClient, publicClient, MINTABLE_ABI, bin("contracts_MintableAsset_sol_MintableAsset.bin"), [name, symbol]);
    deployed[key] = t.address;
    console.log(symbol, t.address);
  }

  const stocks = [
    ["AMZN", "0x5884aD2f920c162CFBbACc88C9C51AA75eC09E02"],
    ["AMD", "0x71178BAc73cBeb415514eB542a8995b82669778d"],
    ["NFLX", "0x3b8262A63d25f0477c4DDE23F83cfe22Cb768C93"],
    ["PLTR", "0x1FBE1a0e43594b3455993B5dE5Fd0A7A266298d0"],
    ["TSLA", "0xC9f9c86933092BbbfFF3CCb4b105A4A94bf3Bd4E"],
  ];

  console.log("Seeding broker...");
  for (const [sym, addr] of stocks) {
    try {
      await wait(1500);
      await walletClient.writeContract({
        address: addr,
        abi: TRANSFER_ABI,
        functionName: "transfer",
        args: [deployed.brokerAddress, parseEther("5")],
      });
      console.log("  stock", sym);
    } catch {
      console.log("  stock", sym, "skip");
    }
  }

  for (const [key, , symbol] of cryptos) {
    await wait(1500);
    await walletClient.writeContract({
      address: deployed[key],
      abi: MINTABLE_ABI,
      functionName: "mint",
      args: [deployed.brokerAddress, parseEther("100")],
    });
    console.log("  crypto", symbol);
  }

  writeFileSync(join(root, "contracts/deployed.json"), JSON.stringify(deployed, null, 2));
  console.log("\nSaved deployed.json");
}

main().catch(console.error);
