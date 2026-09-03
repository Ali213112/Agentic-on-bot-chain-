/**
 * Create Uniswap V2 pairs (if missing) and add tUSDC liquidity for each trade token.
 * Requires deployer to hold stock tokens + tUSDC.
 * Usage: node scripts/seed-pools.mjs
 */
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  formatUnits,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const ROUTER = "0x89e5DB8B5aA49aA85AC63f691524311AEB649eba";
const FACTORY = "0x8bcEaA40B9AcdfAedF85AdF4FF01F5Ad6517937f";

const TOKENS = [
  ["TSLA", "0xC9f9c86933092BbbfFF3CCb4b105A4A94bf3Bd4E"],
  ["AMZN", "0x5884aD2f920c162CFBbACc88C9C51AA75eC09E02"],
  ["AMD", "0x71178BAc73cBeb415514eB542a8995b82669778d"],
  ["NFLX", "0x3b8262A63d25f0477c4DDE23F83cfe22Cb768C93"],
  ["PLTR", "0x1FBE1a0e43594b3455993B5dE5Fd0A7A266298d0"],
  ["WETH", "0x7943e237c7F95DA44E0301572D358911207852Fa"],
];

const ROUTER_ABI = [
  {
    inputs: [
      { name: "tokenA", type: "address" },
      { name: "tokenB", type: "address" },
      { name: "amountADesired", type: "uint256" },
      { name: "amountBDesired", type: "uint256" },
      { name: "amountAMin", type: "uint256" },
      { name: "amountBMin", type: "uint256" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" },
    ],
    name: "addLiquidity",
    outputs: [
      { name: "amountA", type: "uint256" },
      { name: "amountB", type: "uint256" },
      { name: "liquidity", type: "uint256" },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
];

const ERC20_ABI = [
  { inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], name: "approve", outputs: [{ type: "bool" }], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ name: "account", type: "address" }], name: "balanceOf", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
];

const FACTORY_ABI = [
  { inputs: [{ name: "tokenA", type: "address" }, { name: "tokenB", type: "address" }], name: "getPair", outputs: [{ type: "address" }], stateMutability: "view", type: "function" },
  { inputs: [{ name: "tokenA", type: "address" }, { name: "tokenB", type: "address" }], name: "createPair", outputs: [{ type: "address" }], stateMutability: "nonpayable", type: "function" },
];

const chain = {
  id: 46630,
  name: "Robinhood Chain Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.chain.robinhood.com"] } },
};

const USDC_LIQ = parseUnits("5000", 6); // 5000 tUSDC per pool side
const TOKEN_LIQ = parseUnits("10", 18); // 10 tokens per pool (adjust by price manually)

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
  const usdc = deployed.usdcToken;

  for (const [sym, token] of TOKENS) {
    let pair = await publicClient.readContract({
      address: FACTORY,
      abi: FACTORY_ABI,
      functionName: "getPair",
      args: [usdc, token],
    });

    if (pair === "0x0000000000000000000000000000000000000000") {
      console.log(`Creating pair tUSDC/${sym}...`);
      const h = await walletClient.writeContract({
        address: FACTORY,
        abi: FACTORY_ABI,
        functionName: "createPair",
        args: [usdc, token],
      });
      await publicClient.waitForTransactionReceipt({ hash: h });
      pair = await publicClient.readContract({
        address: FACTORY,
        abi: FACTORY_ABI,
        functionName: "getPair",
        args: [usdc, token],
      });
    }
    console.log(`Pair tUSDC/${sym}:`, pair);

    const tokenBal = await publicClient.readContract({
      address: token,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [account.address],
    });
    if (tokenBal < TOKEN_LIQ) {
      console.log(`  Skip liquidity — deployer has ${formatUnits(tokenBal, 18)} ${sym}`);
      continue;
    }

    await walletClient.writeContract({
      address: usdc,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [ROUTER, USDC_LIQ],
    });
    await walletClient.writeContract({
      address: token,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [ROUTER, TOKEN_LIQ],
    });

    const hash = await walletClient.writeContract({
      address: ROUTER,
      abi: ROUTER_ABI,
      functionName: "addLiquidity",
      args: [
        usdc,
        token,
        USDC_LIQ,
        TOKEN_LIQ,
        0n,
        0n,
        account.address,
        BigInt(Math.floor(Date.now() / 1000) + 600),
      ],
    });
    await publicClient.waitForTransactionReceipt({ hash });
    console.log(`  Added liquidity tUSDC/${sym}`);
  }
}

main().catch(console.error);
