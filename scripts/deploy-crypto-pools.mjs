/**
 * Deploy BNB test token + seed crypto pools (BTC ETH SOL XRP BNB)
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
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const chain = {
  id: 46630,
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.chain.robinhood.com"] } },
};

const ERC20 = [
  { inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], name: "approve", outputs: [{ type: "bool" }], stateMutability: "nonpayable", type: "function" },
  { inputs: [{ name: "account", type: "address" }], name: "balanceOf", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
];
const MINT_ABI = [
  { inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], name: "mint", outputs: [], stateMutability: "nonpayable", type: "function" },
];
const POOL_ABI = [
  { inputs: [{ name: "token", type: "address" }, { name: "usdcAmount", type: "uint256" }, { name: "tokenAmount", type: "uint256" }], name: "addLiquidity", outputs: [], stateMutability: "nonpayable", type: "function" },
];

async function main() {
  let pk = readFileSync(join(root, ".env.local"), "utf8").match(/DEPLOYER_PRIVATE_KEY=(.+)/)?.[1]?.trim();
  if (!pk.startsWith("0x")) pk = `0x${pk}`;
  const account = privateKeyToAccount(pk);
  const transport = http("https://rpc.testnet.chain.robinhood.com");
  const publicClient = createPublicClient({ chain, transport });
  const walletClient = createWalletClient({ account, chain, transport });

  const deployed = JSON.parse(readFileSync(join(root, "contracts/deployed.json"), "utf8"));
  const usdc = deployed.usdcToken;
  const pool = deployed.poolAddress;

  if (!deployed.bnbToken) {
    const bin = readFileSync(join(root, "contracts/build/contracts_MintableAsset_sol_MintableAsset.bin"), "utf8").trim();
    const data = encodeDeployData({
      abi: [{ inputs: [{ name: "name_", type: "string" }, { name: "symbol_", type: "string" }], type: "constructor" }],
      bytecode: `0x${bin}`,
      args: ["Wrapped BNB", "BNB"],
    });
    const hash = await walletClient.sendTransaction({ data });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    deployed.bnbToken = receipt.contractAddress;
    writeFileSync(join(root, "contracts/deployed.json"), JSON.stringify(deployed, null, 2));
    console.log("Deployed BNB:", deployed.bnbToken);
  }

  const crypto = [
    ["BTC", deployed.btcToken],
    ["ETH", deployed.ethToken],
    ["SOL", deployed.solToken],
    ["XRP", deployed.xrpToken],
    ["BNB", deployed.bnbToken],
  ].filter(([, addr]) => addr);

  for (const [sym, token] of crypto) {
    const bal = await publicClient.readContract({ address: token, abi: ERC20, functionName: "balanceOf", args: [account.address] });
    if (bal < parseUnits("50", 18)) {
      await publicClient.waitForTransactionReceipt({
        hash: await walletClient.writeContract({
          address: token,
          abi: MINT_ABI,
          functionName: "mint",
          args: [account.address, parseUnits("100", 18)],
        }),
      });
      console.log("Minted 100", sym, "to deployer");
      await wait(1500);
    }
  }

  const usdcBal = await publicClient.readContract({ address: usdc, abi: ERC20, functionName: "balanceOf", args: [account.address] });
  if (usdcBal < parseUnits("500", 6)) {
    await publicClient.waitForTransactionReceipt({
      hash: await walletClient.writeContract({
        address: usdc,
        abi: MINT_ABI,
        functionName: "mint",
        args: [account.address, parseUnits("2000", 6)],
      }),
    });
    await wait(1500);
  }

  const USDC_LIQ = parseUnits("200", 6);
  const TOKEN_LIQ = parseUnits("2", 18);

  for (const [sym, token] of crypto) {
    try {
      await publicClient.waitForTransactionReceipt({
        hash: await walletClient.writeContract({ address: usdc, abi: ERC20, functionName: "approve", args: [pool, USDC_LIQ] }),
      });
      await wait(1200);
      await publicClient.waitForTransactionReceipt({
        hash: await walletClient.writeContract({ address: token, abi: ERC20, functionName: "approve", args: [pool, TOKEN_LIQ] }),
      });
      await wait(1200);
      await publicClient.waitForTransactionReceipt({
        hash: await walletClient.writeContract({
          address: pool,
          abi: POOL_ABI,
          functionName: "addLiquidity",
          args: [token, USDC_LIQ, TOKEN_LIQ],
        }),
      });
      console.log("Pool liquidity tUSDC/" + sym);
      await wait(2000);
    } catch (e) {
      console.log("Skip pool", sym, e.shortMessage ?? e.message);
    }
  }
}

main().catch(console.error);
