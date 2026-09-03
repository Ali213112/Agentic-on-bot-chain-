/**
 * Deploy SimpleMultiPool, link vault, seed tUSDC + token liquidity
 */
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  encodeDeployData,
  formatUnits,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const TOKENS = [
  ["TSLA", "0xC9f9c86933092BbbfFF3CCb4b105A4A94bf3Bd4E"],
  ["AMZN", "0x5884aD2f920c162CFBbACc88C9C51AA75eC09E02"],
  ["AMD", "0x71178BAc73cBeb415514eB542a8995b82669778d"],
  ["NFLX", "0x3b8262A63d25f0477c4DDE23F83cfe22Cb768C93"],
  ["PLTR", "0x1FBE1a0e43594b3455993B5dE5Fd0A7A266298d0"],
  ["WETH", "0x7943e237c7F95DA44E0301572D358911207852Fa"],
];

const chain = {
  id: 46630,
  name: "Robinhood Chain Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.chain.robinhood.com"] } },
};

const ERC20 = [
  { inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], name: "approve", outputs: [{ type: "bool" }], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ name: "account", type: "address" }], name: "balanceOf", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
];

const POOL_ABI = [
  { inputs: [{ name: "vault_", type: "address" }], name: "setVault", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ name: "token", type: "address" }, { name: "usdcAmount", type: "uint256" }, { name: "tokenAmount", type: "uint256" }], name: "addLiquidity", outputs: [], stateMutability: "nonpayable", type: "function" },
  { inputs: [], name: "vault", outputs: [{ type: "address" }], stateMutability: "view", type: "function" },
];

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  let pk = readFileSync(join(root, ".env.local"), "utf8").match(/DEPLOYER_PRIVATE_KEY=(.+)/)?.[1]?.trim();
  if (!pk.startsWith("0x")) pk = `0x${pk}`;
  const account = privateKeyToAccount(pk);
  const transport = http("https://rpc.testnet.chain.robinhood.com");
  const publicClient = createPublicClient({ chain, transport });
  const walletClient = createWalletClient({ account, chain, transport });

  const deployed = JSON.parse(readFileSync(join(root, "contracts/deployed.json"), "utf8"));
  const usdc = deployed.usdcToken;
  const vault = deployed.vaultAddress;
  if (!vault) throw new Error("Deploy vault first");

  const MINT_ABI = [{ inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], name: "mint", outputs: [], stateMutability: "nonpayable", type: "function" }];
  const deployerUsdc = await publicClient.readContract({ address: usdc, abi: ERC20, functionName: "balanceOf", args: [account.address] });
  const needUsdc = parseUnits("600", 6);
  if (deployerUsdc < needUsdc) {
    console.log("Minting tUSDC to deployer for pool liquidity...");
    await publicClient.waitForTransactionReceipt({
      hash: await walletClient.writeContract({
        address: usdc,
        abi: MINT_ABI,
        functionName: "mint",
        args: [account.address, needUsdc],
      }),
    });
  }

  let pool = deployed.poolAddress;
  if (!pool) {
    const bin = readFileSync(join(root, "contracts/build/contracts_SimpleMultiPool_sol_SimpleMultiPool.bin"), "utf8").trim();
    const data = encodeDeployData({
      abi: [{ inputs: [{ name: "usdcToken", type: "address" }], type: "constructor" }],
      bytecode: `0x${bin}`,
      args: [usdc],
    });
    console.log("Deploying SimpleMultiPool...");
    const hash = await walletClient.sendTransaction({ data });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    pool = receipt.contractAddress;
    deployed.poolAddress = pool;
    writeFileSync(join(root, "contracts/deployed.json"), JSON.stringify(deployed, null, 2));
    console.log("Pool:", pool);
  }

  const linkedVault = await publicClient.readContract({
    address: pool,
    abi: POOL_ABI,
    functionName: "vault",
  });
  if (linkedVault === "0x0000000000000000000000000000000000000000") {
    await walletClient.writeContract({
      address: pool,
      abi: POOL_ABI,
      functionName: "setVault",
      args: [vault],
    });
    console.log("Vault linked to pool");
  }

  const USDC_LIQ = parseUnits("100", 6);
  const TOKEN_LIQ = parseUnits("1", 18);

  for (const [sym, token] of TOKENS) {
    try {
    const tokenBal = await publicClient.readContract({
      address: token,
      abi: ERC20,
      functionName: "balanceOf",
      args: [account.address],
    });
    const usdcBal = await publicClient.readContract({
      address: usdc,
      abi: ERC20,
      functionName: "balanceOf",
      args: [account.address],
    });
    const tokenAmt = tokenBal < TOKEN_LIQ ? tokenBal : TOKEN_LIQ;
    const usdcAmt = usdcBal < USDC_LIQ ? usdcBal : USDC_LIQ;
    if (tokenAmt <= 0n || usdcAmt <= 0n) {
      console.log(`Skip ${sym} — token ${formatUnits(tokenBal, 18)} / usdc ${formatUnits(usdcBal, 6)}`);
      continue;
    }
    await publicClient.waitForTransactionReceipt({ hash: await walletClient.writeContract({ address: usdc, abi: ERC20, functionName: "approve", args: [pool, usdcAmt] }) });
    await wait(1500);
    await publicClient.waitForTransactionReceipt({ hash: await walletClient.writeContract({ address: token, abi: ERC20, functionName: "approve", args: [pool, tokenAmt] }) });
    await wait(1500);
    await publicClient.waitForTransactionReceipt({
      hash: await walletClient.writeContract({
      address: pool,
      abi: POOL_ABI,
      functionName: "addLiquidity",
      args: [token, usdcAmt, tokenAmt],
    }),
    });
    await wait(2000);
    console.log(`Liquidity added tUSDC/${sym}`);
    } catch (e) {
      console.log(`Failed ${sym}:`, e.shortMessage ?? e.message);
    }
  }
}

main().catch(console.error);
